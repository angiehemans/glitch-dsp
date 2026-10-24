#include "WebUi.h"
#include "Protocol.h"

namespace glitch
{

namespace
{
    juce::File findUiRoot()
    {
       #if JUCE_MAC
        return juce::File::getSpecialLocation (juce::File::currentApplicationFile).getChildFile ("Contents/Resources/ui");
       #else
        return juce::File::getSpecialLocation (juce::File::currentExecutableFile).getSiblingFile ("ui");
       #endif
    }

    const char* mimeTypeFor (const juce::String& extension)
    {
        static const std::map<juce::String, const char*> types {
            { "html", "text/html" },          { "js", "text/javascript" },
            { "css", "text/css" },            { "svg", "image/svg+xml" },
            { "png", "image/png" },           { "json", "application/json" },
            { "woff2", "font/woff2" },        { "wasm", "application/wasm" },
            { "webp", "image/webp" },         { "jpg", "image/jpeg" },
            { "jpeg", "image/jpeg" },
        };
        const auto it = types.find (extension.toLowerCase());
        return it != types.end() ? it->second : "application/octet-stream";
    }

    juce::WebBrowserComponent::Resource makeResource (const void* data, size_t size, const juce::String& mimeType)
    {
        const auto* bytes = static_cast<const std::byte*> (data);
        return { std::vector<std::byte> (bytes, bytes + size), mimeType };
    }

    juce::var object (std::initializer_list<std::pair<const char*, juce::var>> props)
    {
        auto* obj = new juce::DynamicObject();
        for (const auto& [key, value] : props)
            obj->setProperty (key, value);
        return obj;
    }

    /** Names of the channels the device actually opened. */
    juce::var activeChannelNames (const juce::StringArray& names, const juce::BigInteger& active)
    {
        juce::Array<juce::var> result;
        for (int i = 0; i < names.size(); ++i)
            if (active[i])
                result.add (names[i]);
        return result;
    }

    /** A user-typed name: trimmed, single line, at most 60 characters. Empty means "invalid". */
    juce::String cleanName (const juce::var& v)
    {
        return v.toString().replaceCharacters ("\r\n\t", "   ").trim().substring (0, 60).trim();
    }

    bool isChannel (const juce::var& v)
    {
        return (v.isInt() || v.isInt64()) && (int) v >= 1 && (int) v <= Engine::maxChannels;
    }

    /** Ids are 8 hex chars plus dashes (see newId); anything else never names a file. */
    bool isId (const juce::String& s)
    {
        return s.isNotEmpty() && s.length() <= 36 && s.containsOnly ("0123456789abcdef-");
    }

    /** A capture that came back one flat colour (nothing painted yet, or capture unsupported). */
    bool isBlank (const juce::Image& image)
    {
        const auto first = image.getPixelAt (0, 0);
        for (int y = 0; y < 8; ++y)
            for (int x = 0; x < 8; ++x)
                if (image.getPixelAt (x * (image.getWidth() - 1) / 7, y * (image.getHeight() - 1) / 7) != first)
                    return false;
        return true;
    }

    juce::String newId()
    {
        return juce::Uuid().toDashedString().substring (0, 8);
    }

    /**
        JUCE's ALSA type lists every ALSA PCM: per card a direct hardware device plus mixing, snooping,
        surround and S/PDIF variants. Keep the default, PipeWire and each direct hardware device, named by
        their card ("M4, USB Audio"). Returns an empty label for entries to hide.
    */
    juce::String deviceLabel (const juce::String& type, const juce::String& name)
    {
        if (type != "ALSA")
            return name;

        if (name.startsWith ("Default ALSA") || name.containsIgnoreCase ("PipeWire"))
            return name;

        if (! name.contains ("Direct hardware device"))
            return {};

        // "sof-hda-dsp, HDMI 1; Direct hardware device without any conversions (2)" -> "sof-hda-dsp, HDMI 1 (2)"
        const auto card = name.upToFirstOccurrenceOf (";", false, false).trim().trimCharactersAtEnd (", ");
        const auto suffix = name.endsWithChar (')') ? " " + name.fromLastOccurrenceOf ("(", true, false) : juce::String();
        return card + suffix;
    }

    juce::var pluginInfo (const juce::PluginDescription& d)
    {
        return object ({
            { "id", d.createIdentifierString() },
            { "name", d.name },
            { "manufacturer", d.manufacturerName },
            { "format", d.pluginFormatName },
            { "category", d.category },
        });
    }
}

WebUi::WebUi (Engine& e, ProjectStore& s, PluginLibrary& l)
    : engine (e),
      store (s),
      library (l),
      uiRoot (findUiRoot()),
      browser (juce::WebBrowserComponent::Options{}
                   .withNativeIntegrationEnabled()
                   .withKeepPageLoadedWhenBrowserIsHidden()
                   .withEventListener (protocol::commandEvent, [this] (const juce::var& command) { handleCommand (command); })
                   .withResourceProvider ([this] (const juce::String& url) { return getResource (url); }))
{
    addAndMakeVisible (browser);
    syncEngine();
    engine.getDeviceManager().addChangeListener (this);
    engine.onDeviceListChanged = [this] { sendState(); };

    if (devUrl.isNotEmpty())
    {
        browser.onNetworkError = [this]
        {
            juce::MessageManager::callAsync ([safe = juce::Component::SafePointer<WebUi> (this)]
            {
                if (safe != nullptr)
                    safe->browser.goToURL (juce::WebBrowserComponent::getResourceProviderRoot() + "dev-error");
            });
        };
        browser.goToURL (devUrl);
    }
    else
    {
        browser.goToURL (juce::WebBrowserComponent::getResourceProviderRoot());
    }

    startTimerHz (30);
}

WebUi::~WebUi()
{
    engine.onDeviceListChanged = nullptr;
    engine.getDeviceManager().removeChangeListener (this);
    editors.clear(); // before the plugins they show
    captureStates();
    store.saveIfDirty();
}

void WebUi::resized()
{
    browser.setBounds (getLocalBounds());
}

//==============================================================================
void WebUi::handleCommand (const juce::var& command)
{
    const auto type = command["type"].toString();

    if (type == protocol::command::appReady)
    {
        if (engine.getDeviceError().isNotEmpty())
            sendError ("Audio device: " + engine.getDeviceError());
        checkDevice();
    }
    else if (type == protocol::command::monitorSetGain)
    {
        engine.setGainDb (juce::jlimit (Engine::silenceDb, 10.0f, (float) command["gainDb"]));
    }
    else if (type == protocol::command::monitorSetMute)
    {
        engine.setMuted ((bool) command["muted"]);
    }
    else if (type == protocol::command::panicToggle)
    {
        engine.setPanic (! engine.isPanic());
    }
    else if (type == protocol::command::projectCreate || type == protocol::command::projectOpen)
    {
        captureStates(); // the project being left
        if (type == protocol::command::projectCreate)
        {
            const auto name = command["name"].toString().trim();
            store.create (name.isNotEmpty() ? name : "New project " + juce::String (store.getSummaries().size() + 1));
        }
        else if (! store.open (command["projectId"].toString()))
        {
            sendError ("Unknown project: " + command["projectId"].toString());
            return;
        }
        syncEngine();
    }
    else if (type == protocol::command::projectRename)
    {
        const auto name = cleanName (command["name"]);
        if (name.isEmpty() || ! store.renameProject (command["projectId"].toString(), name))
        {
            sendError (name.isEmpty() ? "A project needs a name" : "Unknown project: " + command["projectId"].toString());
            return;
        }
    }
    else if (type.startsWith ("chain."))
    {
        if (! handleChainCommand (type, command))
            return;
    }
    else if (type.startsWith ("block."))
    {
        if (! handleBlockCommand (type, command))
            return;
    }
    else if (type == protocol::command::deviceScan)
    {
        engine.rescanDevices();
    }
    else if (type == protocol::command::deviceSelect)
    {
        const auto error = engine.selectDevice (command["deviceType"].toString(), command["name"].toString());
        if (error.isNotEmpty())
            sendError ("Audio device: " + error);
        // On success the device manager's change callback syncs the graph and saves the choice.
    }
    else if (type == protocol::command::pluginsScan || type == protocol::command::pluginsImport)
    {
        auto onDone = [safe = juce::Component::SafePointer<WebUi> (this)]
        {
            if (safe != nullptr)
            {
                safe->syncEngine(); // blocks of plugins that were missing may load now
                safe->sendState();
            }
        };
        if (type == protocol::command::pluginsScan)
            library.scan (onDone);
        else
            library.import (onDone);
    }
    else
    {
        sendError ("Unknown command: " + type);
        return;
    }

    sendState();
}

// Returns false (after sending an error) when the command can't be applied.
bool WebUi::handleChainCommand (const juce::String& type, const juce::var& command)
{
    auto* chains = store.getCurrentChains();
    if (chains == nullptr)
    {
        sendError ("Open a project first");
        return false;
    }

    if (type == protocol::command::chainCreate)
    {
        if (chains->size() >= Engine::maxChains)
        {
            sendError ("A project can have up to " + juce::String (Engine::maxChains) + " chains");
            return false;
        }
        const auto name = command["name"].toString().trim();
        store.addChain (name.isNotEmpty() ? name : "Chain " + juce::String (chains->size() + 1));
        syncEngine();
        return true;
    }

    const auto chain = store.findChain (command["chainId"].toString());
    auto* obj = chain.getDynamicObject();
    if (obj == nullptr)
    {
        sendError ("Unknown chain: " + command["chainId"].toString());
        return false;
    }
    auto* output = chain["outputs"][0].getDynamicObject();

    if (type == protocol::command::chainSetInputs)
    {
        const auto hwChannel = command["inputs"][0]["hwChannel"];
        if (! isChannel (hwChannel))
        {
            sendError ("Invalid input channel");
            return false;
        }
        chain["inputs"][0].getDynamicObject()->setProperty ("hwChannel", (int) hwChannel);
        syncEngine();
    }
    else if (type == protocol::command::chainSetOutputs)
    {
        const auto requested = command["outputs"][0]["hwChannels"];
        juce::Array<juce::var> hwChannels;
        if (auto* list = requested.getArray())
            for (const auto& ch : *list)
                if (isChannel (ch) && ! hwChannels.contains ((int) ch))
                    hwChannels.add ((int) ch);

        if (hwChannels.isEmpty() || hwChannels.size() != requested.size())
        {
            sendError ("Invalid output channels");
            return false;
        }
        output->setProperty ("hwChannels", hwChannels);
        syncEngine();
    }
    else if (type == protocol::command::chainRemove)
    {
        store.removeChain (chain["id"].toString());
        syncEngine(); // closes its plugin windows and unloads its plugins
    }
    else if (type == protocol::command::chainRename)
    {
        const auto name = cleanName (command["name"]);
        if (name.isEmpty())
        {
            sendError ("A chain needs a name");
            return false;
        }
        obj->setProperty ("name", name);
    }
    else if (type == protocol::command::chainSetLevel)
    {
        output->setProperty ("level", juce::jlimit (Engine::silenceDb, 10.0f, (float) command["levelDb"]));
        applyChainParams (chain); // no rewiring at fader rate
    }
    else if (type == protocol::command::chainSetMute)
    {
        obj->setProperty ("muted", (bool) command["muted"]);
        applyChainParams (chain);
    }
    else
    {
        sendError ("Unknown command: " + type);
        return false;
    }

    store.markDirty();
    return true;
}

bool WebUi::handleBlockCommand (const juce::String& type, const juce::var& command)
{
    if (type == protocol::command::blockAdd)
    {
        const auto chain = store.findChain (command["chainId"].toString());
        if (! chain.isObject())
        {
            sendError ("Unknown chain: " + command["chainId"].toString());
            return false;
        }

        const auto description = library.find (command["block"]["pluginId"].toString());
        if (description == nullptr || command["block"]["type"].toString() != "plugin")
        {
            sendError ("Unknown plugin");
            return false;
        }

        store.addBlock (chain, object ({
            { "id", newId() },
            { "type", "plugin" },
            { "name", description->name },
            { "enabled", true },
            { "plugin", pluginInfo (*description) },
        }), command["index"].isVoid() ? -1 : (int) command["index"]);
        syncEngine();
        return true;
    }

    const auto blockId = command["blockId"].toString();
    const auto block = store.findBlock (blockId);
    if (! block.isObject())
    {
        sendError ("Unknown block: " + blockId);
        return false;
    }

    if (type == protocol::command::blockRemove)
        removeBlock (blockId);
    else if (type == protocol::command::blockToggle)
        toggleBlock (blockId);
    else if (type == protocol::command::blockOpenEditor)
        openEditor (blockId);
    else
    {
        sendError ("Unknown command: " + type);
        return false;
    }

    return true;
}

//==============================================================================
void WebUi::syncEngine()
{
    const auto* chains = store.getCurrentChains();

    juce::StringArray wanted;
    if (chains != nullptr)
        for (const auto& c : *chains)
            if (auto* blocks = c["blocks"].getArray())
                for (const auto& b : *blocks)
                    wanted.add (b["id"].toString());

    for (const auto& id : engine.getBlockIds())
    {
        if (! wanted.contains (id))
        {
            closeEditor (id);
            engine.removeBlock (id);
        }
    }

    std::vector<Engine::ChainSpec> specs;
    chainIds.clear();

    if (chains != nullptr)
    {
        for (const auto& c : *chains)
        {
            Engine::ChainSpec spec;
            spec.id = c["id"].toString();
            spec.input = (int) c["inputs"][0]["hwChannel"] - 1;
            if (auto* hwChannels = c["outputs"][0]["hwChannels"].getArray())
                for (const auto& ch : *hwChannels)
                    spec.outputs.push_back ((int) ch - 1);

            if (auto* blocks = c["blocks"].getArray())
            {
                for (const auto& b : *blocks)
                {
                    const auto id = b["id"].toString();

                    if (! engine.hasBlock (id))
                    {
                        juce::String error;
                        auto plugin = library.create (b["plugin"]["id"].toString(), engine.getSampleRate(), engine.getBlockSize(), error);

                        if (plugin != nullptr)
                        {
                            juce::MemoryBlock state;
                            if (state.fromBase64Encoding (store.getPluginState (id)) && state.getSize() > 0)
                                plugin->setStateInformation (state.getData(), (int) state.getSize());
                            engine.addBlock (id, std::move (plugin));
                        }
                    }

                    b.getDynamicObject()->setProperty ("missing", ! engine.hasBlock (id));
                    engine.setBlockEnabled (id, (bool) b["enabled"]);
                    spec.blockIds.push_back (id);
                }
            }

            specs.push_back (spec);
            chainIds.add (spec.id);
        }
    }

    engine.setChains (specs);

    if (chains != nullptr)
        for (const auto& c : *chains)
            applyChainParams (c);
}

void WebUi::applyChainParams (const juce::var& chain)
{
    engine.setChainParams (chain["id"].toString(), (float) chain["outputs"][0]["level"], (bool) chain["muted"]);
}

void WebUi::captureStates()
{
    for (const auto& id : engine.getBlockIds())
    {
        if (auto* processor = engine.getBlockProcessor (id))
        {
            juce::MemoryBlock state;
            processor->getStateInformation (state);
            store.setPluginState (id, state.toBase64Encoding());
        }
    }
}

void WebUi::openEditor (const juce::String& blockId)
{
    if (const auto it = editors.find (blockId); it != editors.end())
    {
        it->second->toFront (true);
        return;
    }

    const auto block = store.findBlock (blockId);
    auto* processor = engine.getBlockProcessor (blockId); // null when the plugin isn't installed
    const auto safe = juce::Component::SafePointer<WebUi> (this);

    // Window callbacks run inside the window, so anything that deletes it is deferred.
    const auto later = [safe] (std::function<void (WebUi&)> fn)
    {
        return [safe, fn]
        {
            juce::MessageManager::callAsync ([safe, fn]
            {
                if (safe != nullptr)
                    fn (*safe);
            });
        };
    };

    PluginWindow::Callbacks callbacks;
    callbacks.onClose = later ([blockId] (WebUi& ui)
    {
        ui.captureSnapshot (blockId); // the settings it was left at
        ui.closeEditor (blockId);
    });
    callbacks.onBypass = later ([blockId] (WebUi& ui) { ui.toggleBlock (blockId); ui.sendState(); });
    callbacks.onRemove = later ([blockId] (WebUi& ui) { ui.removeBlock (blockId); ui.sendState(); });

    editors[blockId] = std::make_unique<PluginWindow> (block["name"].toString(), processor, ! (bool) block["enabled"], callbacks);

    if (processor != nullptr)
    {
        // Give the plugin time to paint before the first snapshot.
        juce::Timer::callAfterDelay (800, [safe, blockId]
        {
            if (safe != nullptr)
                safe->captureSnapshot (blockId);
        });
    }
}

void WebUi::toggleBlock (const juce::String& blockId)
{
    const auto block = store.findBlock (blockId);
    if (auto* obj = block.getDynamicObject())
    {
        const auto enabled = ! (bool) block["enabled"];
        obj->setProperty ("enabled", enabled);
        engine.setBlockEnabled (blockId, enabled);
        if (const auto it = editors.find (blockId); it != editors.end())
            it->second->setBypassed (! enabled);
        store.markDirty();
    }
}

void WebUi::removeBlock (const juce::String& blockId)
{
    closeEditor (blockId);
    store.removeBlock (blockId);
    syncEngine();
}

void WebUi::captureSnapshot (const juce::String& blockId)
{
    const auto it = editors.find (blockId);
    auto* peer = it != editors.end() ? it->second->getPeer() : nullptr;
    const auto block = store.findBlock (blockId);
    if (peer == nullptr || ! block.isObject() || engine.getBlockProcessor (blockId) == nullptr)
        return;

    auto image = juce::createSnapshotOfNativeWindow (peer->getNativeHandle());
    if (! image.isValid())
        return;

    // Keep just the plugin: crop off Glitch's header. The capture may be at a different scale than the window.
    auto& window = *it->second;
    const auto area = window.getPluginArea();
    const auto sx = image.getWidth() / (double) window.getWidth(), sy = image.getHeight() / (double) window.getHeight();
    image = image.getClippedImage (juce::Rectangle<double> (area.getX() * sx, area.getY() * sy, area.getWidth() * sx, area.getHeight() * sy)
                                       .toNearestInt()
                                       .getIntersection (image.getBounds()));
    if (! image.isValid() || isBlank (image))
        return;

    // The tile shows it at the window's on-screen size; keep up to 2x pixels so it stays sharp on Retina.
    if (image.getHeight() > area.getHeight() * 2)
        image = image.rescaled (area.getWidth() * 2, area.getHeight() * 2, juce::Graphics::highResamplingQuality);

    const auto file = ProjectStore::getSnapshotFile (store.getCurrent()["id"].toString(), blockId);
    file.getParentDirectory().createDirectory();

    juce::TemporaryFile temp (file);
    {
        juce::FileOutputStream out (temp.getFile());
        if (! out.openedOk() || ! juce::PNGImageFormat().writeImageToStream (image, out))
            return;
    }
    if (! temp.overwriteTargetFileWithTemporary())
        return;

    block.getDynamicObject()->setProperty ("snapshotAt", juce::Time::currentTimeMillis());
    block.getDynamicObject()->setProperty ("snapshotWidth", area.getWidth());
    block.getDynamicObject()->setProperty ("snapshotHeight", area.getHeight());
    store.markDirty();
    sendState();
}

void WebUi::closeEditor (const juce::String& blockId)
{
    editors.erase (blockId);
}

//==============================================================================
void WebUi::sendState()
{
    auto& deviceManager = engine.getDeviceManager();
    juce::var device; // null when no device is open

    if (auto* d = deviceManager.getCurrentAudioDevice())
    {
        const auto sampleRate = d->getCurrentSampleRate();
        const auto latencySamples = d->getInputLatencyInSamples() + d->getOutputLatencyInSamples();

        device = object ({
            { "name", d->getName() },
            { "type", d->getTypeName() },
            { "sampleRate", sampleRate },
            { "bufferSize", d->getCurrentBufferSizeSamples() },
            { "latencyMs", sampleRate > 0 ? 1000.0 * latencySamples / sampleRate : 0.0 },
            { "inputs", activeChannelNames (d->getInputChannelNames(), d->getActiveInputChannels()) },
            { "outputs", activeChannelNames (d->getOutputChannelNames(), d->getActiveOutputChannels()) },
        });
    }

    juce::Array<juce::var> devices;
    const auto setup = deviceManager.getAudioDeviceSetup();
    for (auto* type : deviceManager.getAvailableDeviceTypes())
    {
        auto names = type->getDeviceNames (false);
        names.addArray (type->getDeviceNames (true));
        names.removeDuplicates (false);

        const auto isCurrentType = type->getTypeName() == deviceManager.getCurrentAudioDeviceType();
        for (const auto& name : names)
        {
            const auto current = isCurrentType && (setup.outputDeviceName == name || setup.inputDeviceName == name);
            auto label = deviceLabel (type->getTypeName(), name);
            if (label.isEmpty() && ! current)
                continue;

            devices.add (object ({
                { "type", type->getTypeName() },
                { "name", name },
                { "label", label.isNotEmpty() ? label : name },
                { "current", current },
            }));
        }
    }

    juce::Array<juce::var> plugins;
    for (const auto& d : library.getPlugins())
        plugins.add (pluginInfo (d));

    // The project without its plugin state blobs, which can be large and the UI doesn't need.
    juce::var project;
    if (auto* current = store.getCurrent().getDynamicObject())
    {
        project = new juce::DynamicObject (*current);
        project.getDynamicObject()->removeProperty ("pluginStates");
    }

    // Fields past midi are stubs until their milestone; see packages/protocol/src/model.ts.
    const auto state = object ({
        { "device", device },
        { "devices", devices },
        { "plugins", object ({ { "scanning", library.isScanning() }, { "list", plugins } }) },
        { "snapshotBase", project.isObject() ? juce::WebBrowserComponent::getResourceProviderRoot() + "snapshots/" + project["id"].toString() + "/"
                                             : juce::String() },
        { "monitor", object ({ { "gainDb", engine.getGainDb() }, { "muted", engine.isMuted() } }) },
        { "panic", engine.isPanic() },
        { "project", project },
        { "projects", store.getSummaries() },
        { "chains", project.isObject() ? project["chains"] : juce::var (juce::Array<juce::var>()) },
        { "presets", juce::Array<juce::var>() },
        { "currentPresetId", {} },
        { "mappings", juce::Array<juce::var>() },
        { "setlists", juce::Array<juce::var>() },
        { "songs", juce::Array<juce::var>() },
        { "transport", object ({ { "playing", false }, { "songId", {} }, { "position", 0 } }) },
        { "tuneMode", object ({ { "active", false }, { "tunerInput", 1 }, { "reference", 440 },
                                { "vocalChainId", {} }, { "backingTracks", "pause" } }) },
        { "midi", object ({ { "device", {} } }) },
    });

    emit (object ({ { "type", protocol::event::state }, { "state", state } }));
}

void WebUi::sendError (const juce::String& message)
{
    emit (object ({ { "type", protocol::event::error }, { "message", message } }));
}

void WebUi::emit (const juce::var& event)
{
    browser.emitEventIfBrowserIsVisible (protocol::engineEvent, event);
}

void WebUi::changeListenerCallback (juce::ChangeBroadcaster*)
{
    // The device changed (switched, restarted, or lost): channel counts may differ, so rewire.
    syncEngine();

    if (const auto xml = engine.getDeviceManager().createStateXml())
        store.setDeviceState (*xml);

    sendState();
    checkDevice();
}

void WebUi::checkDevice()
{
    auto& deviceManager = engine.getDeviceManager();
    auto* device = deviceManager.getCurrentAudioDevice();
    if (device == nullptr)
        return;

    const auto setup = deviceManager.getAudioDeviceSetup();
    const auto label = deviceLabel (device->getTypeName(), device->getName()).upToFirstOccurrenceOf (",", false, false);
    const auto noOutputs = setup.outputDeviceName.isNotEmpty() && device->getActiveOutputChannels().isZero();
    const auto noInputs = setup.inputDeviceName.isNotEmpty() && device->getActiveInputChannels().isZero();
    if (! noOutputs && ! noInputs)
        return;

    auto message = "Couldn't open the " + juce::String (noOutputs && noInputs ? "inputs or outputs" : noOutputs ? "outputs" : "inputs")
                 + " of " + (label.isNotEmpty() ? label : device->getName()) + ". Another app is probably using "
                 + (noOutputs && noInputs ? "them" : "it") + ".";
   #if JUCE_LINUX
    message << " On Linux that's usually the desktop's sound system: set this device's profile to Off in Settings > Sound,"
               " then pick it again here. Or choose PipeWire Sound Server to share it.";
   #endif
    sendError (message);
}

void WebUi::timerCallback()
{
    if (++ticks % 60 == 0)
    {
        captureStates();
        store.saveIfDirty();

       #if JUCE_LINUX
        // ALSA doesn't announce hotplug; the kernel's card list is cheap to read, so rescan when it changes.
        const auto cards = juce::File ("/proc/asound/cards").loadFileAsString();
        if (cards != std::exchange (soundCards, cards) && ticks > 60)
        {
            engine.rescanDevices();
            sendState();
        }
       #endif
    }

    const auto levels = object ({
        { "in:1", engine.takePeakDb (Engine::in1) },
        { "out:1", engine.takePeakDb (Engine::out1) },
        { "out:2", engine.takePeakDb (Engine::out2) },
    });

    for (const auto& id : chainIds)
    {
        levels.getDynamicObject()->setProperty ("chain:" + id + ":in", engine.takeChainPeakDb (id, false));
        levels.getDynamicObject()->setProperty ("chain:" + id + ":out", engine.takeChainPeakDb (id, true));
    }

    emit (object ({ { "type", protocol::event::meters }, { "levels", levels }, { "cpu", engine.getCpuUsage() } }));
}

//==============================================================================
std::optional<juce::WebBrowserComponent::Resource> WebUi::getResource (const juce::String& url)
{
    const auto path = url.upToFirstOccurrenceOf ("?", false, false).trimCharactersAtStart ("/");

    if (path == "dev-error")
    {
        // Retries every 2 s, so the UI appears as soon as the dev server comes up.
        const auto html = "<!doctype html><meta charset=utf-8><meta http-equiv=refresh content=\"2;url=" + devUrl + "\">"
                          "<body style=\"background:#101113;color:#d6d9de;font:16px system-ui;display:grid;place-items:center;height:100vh;margin:0\">"
                          "<div><h2>Can't reach the UI dev server at " + devUrl + "</h2>"
                          "<p>Start it with <code>./scripts/dev.sh</code>. Retrying&hellip;</p></div>";
        const auto utf8 = html.toStdString();
        return makeResource (utf8.data(), utf8.size(), "text/html");
    }

    // Plugin snapshots: snapshots/<projectId>/<blockId>.png, from the app data folder.
    if (path.startsWith ("snapshots/"))
    {
        const auto projectId = path.fromFirstOccurrenceOf ("snapshots/", false, false).upToFirstOccurrenceOf ("/", false, false);
        const auto name = path.fromLastOccurrenceOf ("/", false, false);
        const auto blockId = name.upToLastOccurrenceOf (".png", false, false);
        juce::MemoryBlock data;

        if (! isId (projectId) || ! isId (blockId) || name != blockId + ".png"
            || ! ProjectStore::getSnapshotFile (projectId, blockId).loadFileAsData (data))
            return std::nullopt;

        return makeResource (data.getData(), data.getSize(), "image/png");
    }

    auto file = uiRoot.getChildFile (path.isEmpty() ? "index.html" : path);

    // Client-side routes ("/rig") have no file of their own: serve the app shell.
    if (! file.existsAsFile() && file.getFileExtension().isEmpty())
        file = uiRoot.getChildFile ("index.html");

    if (! file.isAChildOf (uiRoot) || ! file.existsAsFile())
        return std::nullopt;

    juce::MemoryBlock data;
    if (! file.loadFileAsData (data))
        return std::nullopt;

    return makeResource (data.getData(), data.getSize(), mimeTypeFor (file.getFileExtension().trimCharactersAtStart (".")));
}

} // namespace glitch

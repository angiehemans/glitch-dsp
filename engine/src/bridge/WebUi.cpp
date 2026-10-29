#include "WebUi.h"
#include "Protocol.h"
#include "Vars.h"
#include "../blocks/IrBlock.h"
#include "../blocks/NamBlock.h"

namespace glitch
{

using namespace vars;

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

    /** Names of the channels the device actually opened. */
    juce::var activeChannelNames (const juce::StringArray& names, const juce::BigInteger& active)
    {
        juce::Array<juce::var> result;
        for (int i = 0; i < names.size(); ++i)
            if (active[i])
                result.add (names[i]);
        return result;
    }

    /** 44.1 kHz and up (devices also offer 8–32 kHz, which no guitar rig wants), plus the current rate. */
    juce::var sampleRates (juce::AudioIODevice* d)
    {
        juce::Array<juce::var> result;
        for (const auto rate : d->getAvailableSampleRates())
            if (rate >= 44100.0 || juce::approximatelyEqual (rate, d->getCurrentSampleRate()))
                result.addIfNotAlreadyThere (rate);
        return result;
    }

    /** Powers of two only: ALSA can offer dozens of sizes, and nobody picks 391. */
    juce::var bufferSizes (juce::AudioIODevice* d)
    {
        juce::Array<juce::var> result;
        for (const auto size : d->getAvailableBufferSizes())
            if (juce::isPowerOfTwo (size) || size == d->getCurrentBufferSizeSamples())
                result.addIfNotAlreadyThere (size);
        return result;
    }

    /** The chain's last block, when it's an ABY whose paths exit to their own outputs. */
    juce::var splitExit (const juce::var& chain)
    {
        const auto* blocks = chain["blocks"].getArray();
        const auto last = blocks != nullptr && ! blocks->isEmpty() ? blocks->getLast() : juce::var();
        return last["type"].toString() == "aby" && last["exit"].toString() == "split" ? last : juce::var();
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

    juce::var libraryFiles (const juce::Array<ModelLibrary::Entry>& entries)
    {
        juce::Array<juce::var> result;
        for (const auto& e : entries)
            result.add (object ({ { "id", e.id }, { "name", e.name } }));
        return result;
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

WebUi::WebUi (Engine& e, ProjectStore& s, PluginLibrary& l, ModelLibrary& m)
    : engine (e),
      store (s),
      library (l),
      models (m),
      uiRoot (findUiRoot()),
      browser (juce::WebBrowserComponent::Options{}
                   .withNativeIntegrationEnabled()
                   .withKeepPageLoadedWhenBrowserIsHidden()
                   .withEventListener (protocol::commandEvent, [this] (const juce::var& command) { handleCommand (command); })
                   .withResourceProvider ([this] (const juce::String& url) { return getResource (url); }))
{
    addAndMakeVisible (browser);
    syncEngine();
    songControl.loadSong();

    songControl.onError = footswitchControl.onError = [this] (const juce::String& message) { sendError (message); };
    songControl.onChanged = footswitchControl.onChanged = [this] { sendState(); };
    songControl.onLoadPreset = [this] (const juce::String& presetId)
    {
        handlePresetCommand (protocol::command::presetLoad, object ({ { "presetId", presetId } }));
    };
    footswitchControl.onCommand = [this] (const juce::var& command) { handleCommand (command); };
    footswitchControl.connectMidi();
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
        songControl.loadSong(); // the project's current song, routed its way
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
    else if (type.startsWith ("aby."))
    {
        if (! handleAbyCommand (type, command))
            return;
    }
    else if (type.startsWith ("route."))
    {
        if (! handleRouteCommand (type, command))
            return;
    }
    else if (type.startsWith ("preset."))
    {
        if (! handlePresetCommand (type, command))
            return;
    }
    else if (type.startsWith ("setlist.") || type.startsWith ("song.") || type.startsWith ("transport.") || type == protocol::command::trackMixSet)
    {
        if (! songControl.handleCommand (type, command))
            return;
    }
    else if (type.startsWith ("tune."))
    {
        if (! handleTuneCommand (type, command))
            return;
    }
    else if (type.startsWith ("midi.") || type.startsWith ("mapping.") || type.startsWith ("footswitch."))
    {
        if (! footswitchControl.handleCommand (type, command))
            return;
    }
    else if (type == protocol::command::deviceScan)
    {
        engine.rescanDevices();
    }
    else if (type == protocol::command::deviceSetFormat)
    {
        const auto error = engine.setFormat (command["sampleRate"].isVoid() ? 0.0 : (double) command["sampleRate"],
                                             command["bufferSize"].isVoid() ? 0 : (int) command["bufferSize"]);
        if (error.isNotEmpty())
            sendError ("Audio device: " + error);
        // On success the device restarts; its change callback re-prepares the graph and saves the setup.
    }
    else if (type == protocol::command::deviceSelect)
    {
        const auto error = engine.selectDevice (command["deviceType"].toString(), command["name"].toString());
        if (error.isNotEmpty())
            sendError ("Audio device: " + error);
        // On success the device manager's change callback syncs the graph and saves the choice.
    }
    else if (type == protocol::command::pluginsScan)
    {
        models.refresh(); // files dropped into the library folders by hand
        const auto safe = juce::Component::SafePointer<WebUi> (this);
        library.scan ([safe] { if (safe != nullptr) safe->sendState(); }, // the menu shows how far it has got
                      [safe] { if (safe != nullptr) { safe->syncEngine(); safe->sendState(); } }); // missing blocks may load now
    }
    else if (type == protocol::command::libraryImport)
    {
        if (library.isScanning())
        {
            sendError ("A plugin scan is still running. Wait for it to finish, then add the file.");
            return;
        }
        importToLibrary();
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
        // The chain's output chip: a shortcut that edits its first send (or adds one).
        const auto hwChannels = outputChannels (command["outputs"]);
        if (hwChannels.isEmpty())
        {
            sendError ("Invalid output channels");
            return false;
        }
        if (chain["outputs"].size() == 0)
            chain["outputs"].getArray()->add (newSend());
        chain["outputs"][0].getDynamicObject()->setProperty ("hwChannels", hwChannels);
        applyChainParams (chain); // routes are mixer gains: no rewiring
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
        obj->setProperty ("level", juce::jlimit (Engine::silenceDb, 10.0f, (float) command["levelDb"]));
        applyChainParams (chain); // no rewiring at fader rate
    }
    else if (type == protocol::command::chainSetMute)
    {
        obj->setProperty ("muted", (bool) command["muted"]);
        applyChainParams (chain);
    }
    else if (type == protocol::command::chainSplitAt)
    {
        const auto blocks = chain["blocks"];
        const auto index = command["index"].isVoid() ? blocks.size() : (int) command["index"];
        if (splitExit (chain).isObject() && index >= blocks.size())
        {
            sendError ("This chain ends in a split to separate outputs");
            return false;
        }
        if (store.splitAt (chain, index).isVoid())
        {
            sendError ("An ABY can't go inside another ABY's path");
            return false;
        }
        syncEngine();
    }
    else
    {
        sendError ("Unknown command: " + type);
        return false;
    }

    store.markDirty();
    return true;
}

bool WebUi::handleAbyCommand (const juce::String& type, const juce::var& command)
{
    const auto aby = store.findBlock (command["blockId"].toString());
    auto* obj = aby.getDynamicObject();
    if (obj == nullptr || aby["type"].toString() != "aby")
    {
        sendError ("Unknown ABY block: " + command["blockId"].toString());
        return false;
    }

    const auto pathKey = command["path"].toString() == "B" ? "pathB" : "pathA";

    if (type == protocol::command::abySetMode)
    {
        obj->setProperty ("mode", command["mode"].toString() == "Y" ? "Y" : "AB");
    }
    else if (type == protocol::command::abySelect)
    {
        obj->setProperty ("active", command["path"].toString() == "B" ? "B" : "A");
    }
    else if (type == protocol::command::abySetMute)
    {
        aby[pathKey].getDynamicObject()->setProperty ("mute", (bool) command["muted"]);
    }
    else if (type == protocol::command::abySetExit)
    {
        const auto split = command["exit"].toString() == "split";
        if (split)
        {
            const auto chain = store.findChainOf (aby["id"].toString());
            if (chain["blocks"].getArray() == nullptr || chain["blocks"].getArray()->getLast()["id"] != aby["id"])
            {
                sendError ("Only an ABY at the end of a chain can split to separate outputs");
                return false;
            }
            // Both paths start on the chain's outputs; pick each one's from there.
            if (! aby["splitOutputs"].isObject())
            {
                obj->setProperty ("splitOutputs", object ({ { "A", chain["outputs"].clone() }, { "B", chain["outputs"].clone() } }));
            }
        }
        obj->setProperty ("exit", split ? "split" : "merge");
        syncEngine();
    }
    else if (type == protocol::command::abySetOutputs)
    {
        const auto hwChannels = outputChannels (command["outputs"]);
        const auto output = aby["splitOutputs"][command["path"].toString() == "B" ? "B" : "A"][0];
        if (hwChannels.isEmpty() || output.getDynamicObject() == nullptr)
        {
            sendError ("Invalid output channels");
            return false;
        }
        output.getDynamicObject()->setProperty ("hwChannels", hwChannels);
        applyChainParams (store.findChainOf (aby["id"].toString()));
    }
    else
    {
        sendError ("Unknown command: " + type);
        return false;
    }

    applyAbyParams (aby); // no rewiring: switching and muting only change the merge's gains
    store.markDirty();
    return true;
}

bool WebUi::handlePresetCommand (const juce::String& type, const juce::var& command)
{
    if (! store.getCurrent().isObject())
    {
        sendError ("No project open");
        return false;
    }

    const auto presetId = command["presetId"].toString();
    const auto newName = [this] { return "Preset " + juce::String (store.getPresetSummaries().size() + 1); };

    if (type == protocol::command::presetSave || type == protocol::command::presetSaveAs)
    {
        captureStates(); // plugin knobs turned since the last capture
        const auto overwrite = type == protocol::command::presetSave ? store.getCurrentPresetId() : juce::String();
        const auto name = cleanName (command["name"]);
        store.savePreset (overwrite, name.isNotEmpty() ? name : overwrite.isEmpty() ? newName() : juce::String());
    }
    else if (type == protocol::command::presetLoad)
    {
        if (! store.loadPreset (presetId))
        {
            sendError ("Unknown preset: " + presetId);
            return false;
        }
        syncEngine (true);
    }
    else if (type == protocol::command::presetRename)
    {
        const auto name = cleanName (command["name"]);
        if (name.isEmpty() || ! store.renamePreset (presetId, name))
        {
            sendError (name.isEmpty() ? "A preset needs a name" : "Unknown preset: " + presetId);
            return false;
        }
    }
    else if (type == protocol::command::presetDelete)
    {
        if (! store.deletePreset (presetId))
        {
            sendError ("Unknown preset: " + presetId);
            return false;
        }
    }
    else
    {
        sendError ("Unknown command: " + type);
        return false;
    }
    return true;
}

bool WebUi::handleTuneCommand (const juce::String& type, const juce::var& command)
{
    auto* settings = store.getCurrent()["tuneMode"].getDynamicObject();
    if (settings == nullptr)
    {
        sendError ("No project open");
        return false;
    }

    if (type == protocol::command::tuneToggle)
    {
        applyTuneMode (! engine.isTuning());
        return true;
    }
    if (type == protocol::command::tuneSetInput)
    {
        if (! isChannel (command["hwChannel"]))
        {
            sendError ("Invalid input channel");
            return false;
        }
        settings->setProperty ("tunerInput", (int) command["hwChannel"]);
    }
    else if (type == protocol::command::tuneSetReference)
    {
        settings->setProperty ("reference", juce::jlimit (415.0, 466.0, (double) command["hz"]));
    }
    else if (type == protocol::command::tuneSetVocalChain)
    {
        const auto chainId = command["chainId"].toString();
        if (chainId.isNotEmpty() && ! store.findChain (chainId).isObject())
        {
            sendError ("Unknown chain: " + chainId);
            return false;
        }
        settings->setProperty ("vocalChainId", chainId.isNotEmpty() ? juce::var (chainId) : juce::var());
    }
    else
    {
        sendError ("Unknown command: " + type);
        return false;
    }
    store.markDirty();
    if (engine.isTuning())
        applyTuneMode (true); // a new input or live chain takes effect now
    return true;
}

void WebUi::applyTuneMode (bool on)
{
    if (on)
        engine.getPlayer().stop(); // the plan's default: the song doesn't keep running while muted
    const auto settings = store.getCurrent()["tuneMode"];
    engine.setTuneMode (on, juce::jmax (1, (int) settings["tunerInput"]) - 1, settings["vocalChainId"].toString());
}

bool WebUi::handleRouteCommand (const juce::String& type, const juce::var& command)
{
    juce::Array<juce::var>* sends = nullptr;
    const auto chain = store.findChain (command["chainId"].toString());

    if (command["trackId"].toString().isNotEmpty())
    {
        // A backing track of the current song: its sends in the project's track mix.
        const auto entry = songControl.trackMixEntry (command["trackId"].toString(), true);
        if (! entry.isObject())
        {
            sendError ("That track isn't in the current song");
            return false;
        }
        sends = entry["outputs"].getArray();
    }
    else
    {
        if (! chain.isObject())
        {
            sendError ("Unknown chain: " + command["chainId"].toString());
            return false;
        }

        // A chain whose ABY splits to separate outputs routes paths A and B; any other, its own output.
        const auto path = command["path"].toString();
        const auto split = splitExit (chain);
        if (path.isNotEmpty() != split.isObject())
        {
            sendError (split.isObject() ? "This chain splits to separate outputs: route path A or B" : "This chain doesn't split to separate outputs");
            return false;
        }
        sends = (split.isObject() ? split["splitOutputs"][path == "B" ? "B" : "A"] : chain["outputs"]).getArray();
    }

    const auto hwChannels = sendChannels (command["hwChannels"]);
    if (sends == nullptr || hwChannels.isEmpty())
    {
        sendError ("Invalid output channels");
        return false;
    }

    const auto key = juce::JSON::toString (hwChannels, true);
    const auto it = std::find_if (sends->begin(), sends->end(), [&] (const auto& s) { return juce::JSON::toString (s["hwChannels"], true) == key; });

    if (type == protocol::command::routeSet)
    {
        auto send = it != sends->end() ? *it : newSend (hwChannels);
        if (it == sends->end())
            sends->add (send);
        if (! command["level"].isVoid())
            send.getDynamicObject()->setProperty ("level", juce::jlimit (Engine::silenceDb, 10.0f, (float) command["level"]));
        if (! command["mute"].isVoid())
            send.getDynamicObject()->setProperty ("mute", (bool) command["mute"]);
    }
    else if (type == protocol::command::routeRemove)
    {
        if (it != sends->end())
            sends->remove (it);
    }
    else
    {
        sendError ("Unknown command: " + type);
        return false;
    }

    if (chain.isObject() && command["trackId"].toString().isEmpty())
        applyChainParams (chain); // mixer gains only: no rewiring
    else
        songControl.applyTrackMix();
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

        const auto spec = command["block"];
        const auto blockType = spec["type"].toString();
        juce::var block;

        if (blockType == "plugin")
        {
            const auto description = library.find (spec["pluginId"].toString());
            if (description == nullptr)
            {
                sendError ("Unknown plugin");
                return false;
            }
            block = object ({ { "id", newId() }, { "type", "plugin" }, { "name", description->name },
                              { "enabled", true }, { "plugin", pluginInfo (*description) } });
        }
        else if (blockType == "nam" || blockType == "ir")
        {
            const auto file = models.resolve (spec["file"].toString());
            if (file == juce::File())
            {
                sendError ("That file isn't in the library");
                return false;
            }
            block = object ({ { "id", newId() }, { "type", blockType }, { "name", file.getFileNameWithoutExtension() },
                              { "enabled", true }, { "file", spec["file"].toString() } });
        }
        else
        {
            sendError ("Unknown block type: " + blockType);
            return false;
        }

        const auto index = command["index"].isVoid() ? -1 : (int) command["index"];
        if (const auto abyId = command["abyId"].toString(); abyId.isNotEmpty())
        {
            if (! store.addBlockToPath (store.findBlock (abyId), command["path"].toString(), block, index))
            {
                sendError ("Unknown ABY block: " + abyId);
                return false;
            }
        }
        else
        {
            if (splitExit (chain).isObject() && (index < 0 || index >= chain["blocks"].size()))
            {
                sendError ("This chain ends in a split to separate outputs: add blocks to path A or B");
                return false;
            }
            store.addBlock (chain, block, index);
        }
        syncEngine();
        return true;
    }

    if (type == protocol::command::blockMove)
    {
        const auto error = store.moveBlock (command["blockId"].toString(), store.findChain (command["chainId"].toString()),
                                            (int) command["index"], command["abyId"].toString(), command["path"].toString());
        if (error.isNotEmpty())
        {
            sendError (error);
            return false;
        }
        syncEngine(); // rewires; blocks keep running, even when they change chain
        return true;
    }

    const auto blockId = command["blockId"].toString();
    const auto block = store.findBlock (blockId);
    if (! block.isObject())
    {
        sendError ("Unknown block: " + blockId);
        return false;
    }

    if (block["type"].toString() == "aby" && type != protocol::command::blockRemove)
    {
        sendError ("An ABY block has no window or bypass of its own");
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
void WebUi::syncEngine (bool presetLoaded)
{
    const auto* chains = store.getCurrentChains();
    const auto running = engine.getBlockIds(); // before this sync loads or unloads any

    juce::StringArray wantedBlocks, wantedSplits;
    if (chains != nullptr)
        for (const auto& c : *chains)
            for (auto* list : ProjectStore::getBlockLists (c))
                for (const auto& b : *list)
                    (b["type"].toString() == "aby" ? wantedSplits : wantedBlocks).add (b["id"].toString());

    for (const auto& id : engine.getBlockIds())
    {
        if (! wantedBlocks.contains (id))
        {
            closeEditor (id);
            engine.removeBlock (id);
        }
    }
    for (const auto& id : engine.getSplitIds())
        if (! wantedSplits.contains (id))
            engine.removeSplit (id);

    std::vector<Engine::ChainSpec> specs;
    chainIds.clear();

    // Loads a block if it isn't yet, and returns its id for the chain's wiring.
    const auto prepare = [this] (const juce::var& b)
    {
        const auto id = b["id"].toString();
        juce::String note;

        if (! engine.hasBlock (id))
        {
            auto processor = createBlock (b, note);

            if (processor != nullptr)
            {
                juce::MemoryBlock state;
                if (state.fromBase64Encoding (store.getPluginState (id)) && state.getSize() > 0)
                    processor->setStateInformation (state.getData(), (int) state.getSize());
                engine.addBlock (id, std::move (processor));
            }
        }

        // NAM models run at any rate but sound slightly different away from their training rate.
        if (auto* nam = dynamic_cast<NamBlock*> (engine.getBlockProcessor (id)))
        {
            const auto trained = nam->getExpectedSampleRate(), running = engine.getSampleRate();
            if (trained > 0 && std::abs (trained - running) > 1.0)
                note = "Trained at " + juce::String (trained / 1000.0, 1) + " kHz, running at " + juce::String (running / 1000.0, 1) + " kHz";
        }

        b.getDynamicObject()->setProperty ("missing", ! engine.hasBlock (id));
        b.getDynamicObject()->setProperty ("note", note);
        engine.setBlockEnabled (id, (bool) b["enabled"]);
        return id;
    };

    const auto preparePath = [&prepare] (const juce::var& path)
    {
        std::vector<juce::String> ids;
        if (auto* blocks = path["blocks"].getArray())
            for (const auto& b : *blocks)
                ids.push_back (prepare (b));
        return ids;
    };

    if (chains != nullptr)
    {
        for (const auto& c : *chains)
        {
            Engine::ChainSpec spec;
            spec.id = c["id"].toString();
            spec.input = (int) c["inputs"][0]["hwChannel"] - 1;

            if (auto* blocks = c["blocks"].getArray())
            {
                for (const auto& b : *blocks)
                {
                    Engine::ChainSpec::Step step;
                    if (b["type"].toString() == "aby")
                    {
                        step.id = b["id"].toString();
                        step.split = true;
                        step.exitSplit = b["exit"].toString() == "split" && b["id"] == c["blocks"].getArray()->getLast()["id"];
                        step.pathA = preparePath (b["pathA"]);
                        step.pathB = preparePath (b["pathB"]);
                        engine.addSplit (step.id);
                        applyAbyParams (b);
                    }
                    else
                    {
                        step.id = prepare (b);
                    }
                    spec.steps.push_back (step);
                }
            }

            specs.push_back (spec);
            chainIds.add (spec.id);
        }
    }

    // Blocks the preset shares with the rig before it keep running, with the preset's state.
    std::function<void()> atSwap;
    if (presetLoaded)
    {
        // Copied now: a capture before the swap would overwrite the store's with the old states.
        std::vector<std::pair<juce::String, juce::String>> states;
        for (const auto& id : running)
            states.emplace_back (id, store.getPluginState (id));
        atSwap = [this, states]
        {
            for (const auto& [id, base64] : states)
            {
                juce::MemoryBlock state;
                auto* processor = engine.getBlockProcessor (id);
                if (processor != nullptr && state.fromBase64Encoding (base64) && state.getSize() > 0)
                    processor->setStateInformation (state.getData(), (int) state.getSize());
            }
        };
    }
    engine.setChains (specs, std::move (atSwap));

    if (chains != nullptr)
        for (const auto& c : *chains)
            applyChainParams (c);
}

std::unique_ptr<juce::AudioProcessor> WebUi::createBlock (const juce::var& block, juce::String& error)
{
    const auto type = block["type"].toString();

    if (type == "plugin")
        return library.create (block["plugin"]["id"].toString(), engine.getSampleRate(), engine.getBlockSize(), error);

    if (type == "nam" || type == "ir")
    {
        const auto file = models.resolve (block["file"].toString());
        if (file == juce::File())
        {
            error = "File not in the library";
            return nullptr;
        }
        if (type == "nam")
            return NamBlock::load (file, error);
        return IrBlock::load (file, error);
    }

    error = "Unknown block type";
    return nullptr;
}

void WebUi::importToLibrary()
{
    if (chooser != nullptr)
        return; // already open

    chooser = std::make_unique<juce::FileChooser> ("Add plugins, NAM models or IRs",
                                                   juce::File::getSpecialLocation (juce::File::userHomeDirectory),
                                                   "*.nam;*.wav;*.aif;*.aiff;*.vst3;*.component");

    const auto safe = juce::Component::SafePointer<WebUi> (this);
    chooser->launchAsync (juce::FileBrowserComponent::openMode | juce::FileBrowserComponent::canSelectFiles
                              | juce::FileBrowserComponent::canSelectDirectories | juce::FileBrowserComponent::canSelectMultipleItems,
                          [safe] (const juce::FileChooser& fc)
                          {
                              if (safe == nullptr)
                                  return;
                              auto& ui = *safe;
                              const auto results = fc.getResults();
                              ui.chooser = nullptr;

                              // Models and IRs are copied into the library; anything else is a plugin, or a folder to scan.
                              juce::Array<juce::File> files, pluginPaths;
                              for (const auto& f : results)
                                  (ModelLibrary::kindOf (f).has_value() ? files : pluginPaths).add (f);

                              if (const auto failed = ui.models.import (files); ! failed.isEmpty())
                                  ui.sendError ("Couldn't copy " + failed.joinIntoString (", ") + " into the library");

                              if (! pluginPaths.isEmpty())
                                  ui.library.scanPaths (pluginPaths,
                                                        [safe] { if (safe != nullptr) safe->sendState(); },
                                                        [safe] { if (safe != nullptr) { safe->syncEngine(); safe->sendState(); } });
                              ui.syncEngine(); // blocks whose file was missing may load now
                              ui.sendState();
                          });
}

void WebUi::applyChainParams (const juce::var& chain)
{
    const auto id = chain["id"].toString();
    engine.setChainParams (id, (float) chain["level"], (bool) chain["muted"]);

    const auto sends = [] (const juce::var& list)
    {
        std::vector<Engine::Send> result;
        if (auto* items = list.getArray())
            for (const auto& item : *items)
            {
                Engine::Send send { {}, (float) item["level"], (bool) item["mute"] };
                if (auto* hwChannels = item["hwChannels"].getArray())
                    for (const auto& ch : *hwChannels)
                        send.outputs.push_back ((int) ch - 1);
                result.push_back (send);
            }
        return result;
    };

    // A split exit sends paths A and B on their own; otherwise the chain's own sends.
    if (const auto split = splitExit (chain); split.isObject())
        engine.setRoutes (id, sends (split["splitOutputs"]["A"]), sends (split["splitOutputs"]["B"]));
    else
        engine.setRoutes (id, sends (chain["outputs"]), {});
}

void WebUi::applyAbyParams (const juce::var& aby)
{
    Engine::SplitParams params;
    params.both = aby["mode"].toString() == "Y";
    params.activeB = aby["active"].toString() == "B";
    for (int p = 0; p < 2; ++p)
    {
        params.muted[p] = (bool) aby[p == 0 ? "pathA" : "pathB"]["mute"];
    }
    engine.setSplitParams (aby["id"].toString(), params);
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
    stateDue = true; // sent on the next tick: a fader drag's dozens of commands a second make one state per tick
}

void WebUi::emitState()
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
            { "sampleRates", sampleRates (d) },
            { "bufferSizes", bufferSizes (d) },
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
        { "plugins", object ({ { "scanning", library.isScanning() }, { "progress", library.getScanProgress() },
                               { "current", library.getScanningName() }, { "list", plugins } }) },
        { "library", object ({ { "nam", libraryFiles (models.get (ModelLibrary::Kind::nam)) },
                               { "ir", libraryFiles (models.get (ModelLibrary::Kind::ir)) } }) },
        { "snapshotBase", project.isObject() ? juce::WebBrowserComponent::getResourceProviderRoot() + "snapshots/" + project["id"].toString() + "/"
                                             : juce::String() },
        { "monitor", object ({ { "gainDb", engine.getGainDb() }, { "muted", engine.isMuted() } }) },
        { "panic", engine.isPanic() },
        { "project", project },
        { "projects", store.getSummaries() },
        { "chains", project.isObject() ? project["chains"] : juce::var (juce::Array<juce::var>()) },
        { "presets", store.getPresetSummaries() },
        { "currentPresetId", store.getCurrentPresetId().isNotEmpty() ? juce::var (store.getCurrentPresetId()) : juce::var() },
        { "presetModified", presetModified = store.isPresetModified() },
        { "mappings", project.isObject() ? project["mappings"] : juce::var (juce::Array<juce::var>()) },
        { "setlists", project.isObject() ? project["setlists"] : juce::var (juce::Array<juce::var>()) },
        { "songs", songControl.getSongs() },
        { "transport", object ({ { "playing", engine.getPlayer().isPlaying() },
                                 { "songId", project.isObject() ? project["songId"] : juce::var() },
                                 { "position", engine.getPlayer().getPositionSeconds() } }) },
        { "tuneMode", object ({ { "active", engine.isTuning() },
                                { "tunerInput", project.isObject() ? project["tuneMode"]["tunerInput"] : juce::var (1) },
                                { "reference", project.isObject() ? project["tuneMode"]["reference"] : juce::var (440) },
                                { "vocalChainId", project.isObject() ? project["tuneMode"]["vocalChainId"] : juce::var() },
                                { "backingTracks", "pause" } }) },
        { "midi", footswitchControl.getState() },
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
    if (std::exchange (stateDue, false))
        emitState();

    if (++ticks % 60 == 0)
    {
        footswitchControl.connectMidi(); // plugged in or out
        captureStates();
        store.saveIfDirty();
        if (store.isPresetModified() != presetModified)
            sendState(); // a plugin's state changed in its own window

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

    const auto levels = object ({ { "in:1", engine.takePeakDb (Engine::in1) } });
    for (int ch = 0; ch < Engine::maxChannels; ++ch)
        levels.getDynamicObject()->setProperty ("out:" + juce::String (ch + 1), engine.takeOutputPeakDb (ch));

    for (const auto& id : chainIds)
    {
        levels.getDynamicObject()->setProperty ("chain:" + id + ":in", engine.takeChainPeakDb (id, false));
        levels.getDynamicObject()->setProperty ("chain:" + id + ":out", engine.takeChainPeakDb (id, true));
    }

    emit (object ({ { "type", protocol::event::meters }, { "levels", levels }, { "cpu", engine.getCpuUsage() } }));

    // A song that played to its end moves the setlist on, when it auto-advances.
    if (wasPlaying && songControl.advanceAtEnd())
        sendState();

    // Where the song is, about 10 times a second, and once more when it stops (at its end, say).
    const auto playing = engine.getPlayer().isPlaying();
    if ((playing && ticks % 3 == 0) || playing != wasPlaying)
        emit (object ({ { "type", protocol::event::transport }, { "playing", playing },
                        { "songId", store.getCurrent()["songId"] }, { "position", engine.getPlayer().getPositionSeconds() } }));
    wasPlaying = playing;

    // The tuner's reading, about 15 times a second: the nearest note to A4 = reference, and how far off.
    if (engine.isTuning() && ticks % 2 == 0)
    {
        static const juce::StringArray names { "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B" }; // ASCII: JUCE reads literals as ASCII
        const auto hz = engine.getTunerHz();
        const auto reference = (double) store.getCurrent()["tuneMode"]["reference"];
        const auto midi = hz > 0 ? 69.0 + 12.0 * std::log2 (hz / (reference > 0 ? reference : 440.0)) : 0.0;
        const auto nearest = (int) std::lround (midi);
        emit (object ({ { "type", protocol::event::tuner },
                        { "hz", hz },
                        { "note", hz > 0 ? names[((nearest % 12) + 12) % 12] : juce::String() },
                        { "octave", nearest / 12 - 1 },
                        { "cents", hz > 0 ? (midi - nearest) * 100.0 : 0.0 } }));
    }
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

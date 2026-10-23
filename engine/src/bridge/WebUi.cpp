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

    juce::var stringArray (const juce::StringArray& strings)
    {
        juce::Array<juce::var> result;
        for (const auto& s : strings)
            result.add (s);
        return result;
    }
}

WebUi::WebUi (Engine& e)
    : engine (e),
      uiRoot (findUiRoot()),
      browser (juce::WebBrowserComponent::Options{}
                   .withNativeIntegrationEnabled()
                   .withKeepPageLoadedWhenBrowserIsHidden()
                   .withEventListener (protocol::commandEvent, [this] (const juce::var& command) { handleCommand (command); })
                   .withResourceProvider ([this] (const juce::String& url) { return getResource (url); }))
{
    addAndMakeVisible (browser);

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

void WebUi::resized()
{
    browser.setBounds (getLocalBounds());
}

void WebUi::handleCommand (const juce::var& command)
{
    const auto type = command["type"].toString();

    if (type == protocol::command::appReady)
    {
        if (engine.getDeviceError().isNotEmpty())
            sendError ("Audio device: " + engine.getDeviceError());
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
    else
    {
        sendError ("Unknown command: " + type);
        return;
    }

    sendState();
}

void WebUi::sendState()
{
    juce::var device; // null when no device is open

    if (auto* d = engine.getDeviceManager().getCurrentAudioDevice())
    {
        const auto sampleRate = d->getCurrentSampleRate();
        const auto latencySamples = d->getInputLatencyInSamples() + d->getOutputLatencyInSamples();

        device = object ({
            { "name", d->getName() },
            { "type", d->getTypeName() },
            { "sampleRate", sampleRate },
            { "bufferSize", d->getCurrentBufferSizeSamples() },
            { "latencyMs", sampleRate > 0 ? 1000.0 * latencySamples / sampleRate : 0.0 },
            { "inputs", stringArray (d->getInputChannelNames()) },
            { "outputs", stringArray (d->getOutputChannelNames()) },
        });
    }

    // Everything past panic is a stub until its milestone; see packages/protocol/src/model.ts.
    const auto state = object ({
        { "device", device },
        { "monitor", object ({ { "gainDb", engine.getGainDb() }, { "muted", engine.isMuted() } }) },
        { "panic", engine.isPanic() },
        { "project", {} },
        { "projects", juce::Array<juce::var>() },
        { "chains", juce::Array<juce::var>() },
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

void WebUi::timerCallback()
{
    const auto levels = object ({
        { "in:1", engine.takePeakDb (Engine::in1) },
        { "out:1", engine.takePeakDb (Engine::out1) },
        { "out:2", engine.takePeakDb (Engine::out2) },
    });

    emit (object ({ { "type", protocol::event::meters }, { "levels", levels }, { "cpu", engine.getCpuUsage() } }));
}

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

    const auto file = uiRoot.getChildFile (path.isEmpty() ? "index.html" : path);

    if (! file.isAChildOf (uiRoot) || ! file.existsAsFile())
        return std::nullopt;

    juce::MemoryBlock data;
    if (! file.loadFileAsData (data))
        return std::nullopt;

    return makeResource (data.getData(), data.getSize(), mimeTypeFor (file.getFileExtension().trimCharactersAtStart (".")));
}

} // namespace glitch

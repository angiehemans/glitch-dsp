#pragma once

#include <juce_gui_extra/juce_gui_extra.h>

#include "../audio/Engine.h"
#include "../blocks/ModelLibrary.h"
#include "../plugins/PluginLibrary.h"
#include "../plugins/PluginWindow.h"
#include "../project/ProjectStore.h"

#include <map>

namespace glitch
{

// Hosts the UI in a WebView: loads the dev server or the bundled ui/ folder, dispatches
// glitch:command events and emits glitch:event events. Keeps the engine's audio graph in step
// with the open project.
class WebUi : public juce::Component,
              private juce::Timer,
              private juce::ChangeListener
{
public:
    WebUi (Engine&, ProjectStore&, PluginLibrary&, ModelLibrary&);
    ~WebUi() override;

    void resized() override;

private:
    struct Browser : juce::WebBrowserComponent
    {
        using WebBrowserComponent::WebBrowserComponent;
        std::function<void()> onNetworkError;

        bool pageLoadHadNetworkError (const juce::String&) override
        {
            if (onNetworkError)
                onNetworkError();
            return false;
        }
    };

    void handleCommand (const juce::var& command);
    bool handleChainCommand (const juce::String& type, const juce::var& command);
    bool handleBlockCommand (const juce::String& type, const juce::var& command);

    /** Open project -> engine: creates and removes plugin nodes, rewires chains, sets parameters. */
    void syncEngine();
    /** The audio processor for a block (plugin, NAM model or IR), or null with an error. */
    std::unique_ptr<juce::AudioProcessor> createBlock (const juce::var& block, juce::String& error);
    /** Opens a chooser for plugins, folders, .nam models and IRs. */
    void importToLibrary();
    void applyChainParams (const juce::var& chain);
    /** Copies plugin states into the project, so they save. */
    void captureStates();
    void openEditor (const juce::String& blockId);
    void toggleBlock (const juce::String& blockId);
    void removeBlock (const juce::String& blockId);
    /** Saves a PNG of the block's open plugin window, shown as its tile artwork. */
    void captureSnapshot (const juce::String& blockId);
    void closeEditor (const juce::String& blockId);

    void sendState();
    /** Errors for a device that opened without the inputs or outputs it was asked for (e.g. busy). */
    void checkDevice();
    void sendError (const juce::String& message);
    void emit (const juce::var& event);
    void timerCallback() override; // meters ~30 Hz, saves ~every 2 s
    void changeListenerCallback (juce::ChangeBroadcaster*) override; // device changes

    std::optional<juce::WebBrowserComponent::Resource> getResource (const juce::String& url);

    Engine& engine;
    ProjectStore& store;
    PluginLibrary& library;
    ModelLibrary& models;
    std::unique_ptr<juce::FileChooser> chooser;
    juce::StringArray chainIds; // of the open project, for meter keys
    std::map<juce::String, std::unique_ptr<PluginWindow>> editors;
    juce::String soundCards; // Linux: /proc/asound/cards, polled for hotplug
    int ticks = 0;

    const juce::String devUrl { GLITCH_UI_DEV_URL };
    const juce::File uiRoot;
    Browser browser;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (WebUi)
};

} // namespace glitch

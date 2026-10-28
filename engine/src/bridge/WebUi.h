#pragma once

#include <juce_gui_extra/juce_gui_extra.h>

#include "../audio/Engine.h"
#include "../blocks/ModelLibrary.h"
#include "../midi/Footswitch.h"
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
    /** Loads, unloads and rewires blocks to match the project. After a preset load, blocks that keep
        running get their state from the store, while their chains are faded out. */
    void syncEngine (bool presetLoaded = false);
    /** The audio processor for a block (plugin, NAM model or IR), or null with an error. */
    std::unique_ptr<juce::AudioProcessor> createBlock (const juce::var& block, juce::String& error);
    /** Opens a chooser for plugins, folders, .nam models and IRs. */
    void importToLibrary();
    void applyChainParams (const juce::var& chain);
    void applyAbyParams (const juce::var& aby);
    bool handleAbyCommand (const juce::String& type, const juce::var& command);
    bool handleRouteCommand (const juce::String& type, const juce::var& command);
    bool handlePresetCommand (const juce::String& type, const juce::var& command);
    bool handleMidiCommand (const juce::String& type, const juce::var& command);

    // Footswitch: mappings are the project's, per switch and page, each with a tap and a hold action.
    juce::var findMapping (Footswitch::Switch, int onPage) const;
    int pageCount() const;
    /** Runs a mapped action: a command (block.toggle, preset.load, aby.select, panic.toggle) or a footswitch one
        (chain.toggleMute, preset.next/prev, aby.toggleAB/toggleY, page.next). */
    void runAction (const juce::var& action);
    /** Opens the chosen MIDI input when it's there, closes it when it's gone. Polled. */
    void connectMidi();
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
    bool presetModified = false; // as last sent, so a knob turned in a plugin window updates it

    Footswitch footswitch;
    int page = 0;
    juce::var learning;             // { action, gesture, page } while MIDI learn waits for a press
    juce::var lastSwitch;           // { channel, cc } of the last press, for the mapping screen
    juce::StringArray midiNames;    // MIDI inputs as last seen, polled for hotplug
    bool learnedNow = false;        // the press that was learned doesn't also run an action

    const juce::String devUrl { GLITCH_UI_DEV_URL };
    const juce::File uiRoot;
    Browser browser;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (WebUi)
};

} // namespace glitch

#pragma once

#include "../audio/Engine.h"
#include "../midi/Footswitch.h"
#include "../project/ProjectStore.h"

#include <functional>

namespace glitch
{

// The footswitch: the chosen MIDI input, the switches found on it, and the project's mappings
// (per switch and page, each with a tap and a hold action), which it runs. Message thread only.
class FootswitchControl
{
public:
    FootswitchControl (Engine&, ProjectStore&);

    std::function<void (const juce::var&)> onCommand; // runs a mapped action that's a UI command
    std::function<void (const juce::String&)> onError;
    std::function<void()> onChanged; // something the UI shows changed: send the state

    /** midi.*, mapping.* and footswitch.* commands. False after an error. */
    bool handleCommand (const juce::String& type, const juce::var& command);
    /** Opens the chosen MIDI input when it's there, closes it when it's gone. Polled. */
    void connectMidi();
    juce::var getState() const; // the state's midi field

private:
    juce::var findMapping (Footswitch::Switch, int onPage) const;
    int pageCount() const;
    /** Runs a mapped action: a command (block.toggle, preset.load, aby.select, panic.toggle) or a footswitch one
        (chain.toggleMute, preset.next/prev, aby.toggleAB/toggleY, page.next). */
    void runAction (const juce::var& action);
    void sendError (const juce::String& message) { if (onError) onError (message); }
    void sendState() { if (onChanged) onChanged(); }

    Engine& engine;
    ProjectStore& store;
    Footswitch footswitch;
    int page = 0;
    juce::var lastSwitch;           // { channel, cc } of the last press, for the mapping screen
    juce::StringArray midiNames;    // MIDI inputs as last seen, polled for hotplug

    JUCE_DECLARE_NON_COPYABLE (FootswitchControl)
};

} // namespace glitch

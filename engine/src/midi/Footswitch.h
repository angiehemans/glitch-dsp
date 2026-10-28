#pragma once

#include <juce_audio_devices/juce_audio_devices.h>

#include <functional>
#include <map>
#include <memory>

namespace glitch
{

// A momentary MIDI footswitch (the plan's M-Vave Chocolate): CC 64-127 is a press, 0-63 a release.
// A Program Change is a press and release at once (no release is sent), so such a switch only taps.
// Tap and hold are worked out here, not on the pedal, so any momentary controller behaves the same:
// a switch with no hold action taps on press, for an instant toggle; one with a hold action taps on
// release, or holds once it has been down for its hold time. Repeated presses without a release
// count as one, and a release with no press is ignored. MIDI arrives on its own thread and is handed
// to the message thread; everything public is message thread.
class Footswitch final : private juce::MidiInputCallback,
                         private juce::Timer
{
public:
    struct Switch
    {
        int channel = 1; // 1-16
        int cc = 0;  // or programChangeBase + program
        bool operator< (const Switch& o) const { return channel != o.channel ? channel < o.channel : cc < o.cc; }
        bool operator== (const Switch& o) const { return channel == o.channel && cc == o.cc; }
    };

    static constexpr int programChangeBase = 128; // switches that send Program Change: past the 0-127 CCs

    Footswitch();
    ~Footswitch() override;

    /** Asked on press: does this switch have a hold action, and how long is a hold (ms)? 0 = no hold. */
    std::function<double (Switch)> holdMsFor;
    /** A tap (hold false) or a hold (hold true) to act on. */
    std::function<void (Switch, bool hold)> onGesture;
    /** Any press, before it's worked out: for MIDI learn and the activity light. */
    std::function<void (Switch)> onPress;

    /** Opens a MIDI input by identifier; closing any other. False if it couldn't be opened. */
    bool open (const juce::String& identifier);
    void close();
    juce::String getOpenIdentifier() const { return openIdentifier; }

    // The tap/hold logic, with the time passed in (ms), so it can be tested without MIDI or a clock.
    void press (Switch, double now);
    void release (Switch, double now);
    void tick (double now);

private:
    void handleIncomingMidiMessage (juce::MidiInput*, const juce::MidiMessage&) override;
    void timerCallback() override;

    struct Held { double since = 0, holdMs = 0; bool done = false; }; // done: tapped on press, or held
    std::map<Switch, Held> held;

    std::unique_ptr<juce::MidiInput> input;
    juce::String openIdentifier;
    std::shared_ptr<bool> alive = std::make_shared<bool> (true); // for messages still in flight at destruction

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (Footswitch)
};

} // namespace glitch

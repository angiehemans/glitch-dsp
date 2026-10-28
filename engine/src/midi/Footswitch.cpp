#include "Footswitch.h"

namespace glitch
{

Footswitch::Footswitch() = default;

Footswitch::~Footswitch()
{
    *alive = false;
    close();
}

bool Footswitch::open (const juce::String& identifier)
{
    if (identifier == openIdentifier && input != nullptr)
        return true;

    close();
    input = juce::MidiInput::openDevice (identifier, this);
    if (input == nullptr)
        return false;

    input->start();
    openIdentifier = identifier;
    return true;
}

void Footswitch::close()
{
    if (input != nullptr)
        input->stop();
    input = nullptr;
    openIdentifier = {};
    held.clear(); // a hold in progress is cancelled when the device goes
    stopTimer();
}

void Footswitch::press (Switch sw, double now)
{
    if (held.count (sw) > 0)
        return; // a repeated press without a release

    if (onPress)
        onPress (sw);

    const auto holdMs = holdMsFor ? holdMsFor (sw) : 0.0;
    held[sw] = { now, holdMs, holdMs <= 0 };

    if (holdMs <= 0)
    {
        if (onGesture)
            onGesture (sw, false); // nothing to wait for: tap on press
    }
    else
    {
        startTimer (10);
    }
}

void Footswitch::release (Switch sw, double now)
{
    const auto it = held.find (sw);
    if (it == held.end())
        return; // a release with no press

    const auto [since, holdMs, done] = it->second;
    held.erase (it);
    if (! done && onGesture)
        onGesture (sw, now - since >= holdMs); // held long enough, though the timer hadn't seen it yet
}

void Footswitch::tick (double now)
{
    bool waiting = false;
    for (auto& [sw, h] : held)
    {
        if (h.done)
            continue;
        if (now - h.since >= h.holdMs)
        {
            h.done = true; // its release is ignored
            if (onGesture)
                onGesture (sw, true);
        }
        else
        {
            waiting = true;
        }
    }
    if (! waiting)
        stopTimer();
}

void Footswitch::timerCallback()
{
    tick (juce::Time::getMillisecondCounterHiRes());
}

void Footswitch::handleIncomingMidiMessage (juce::MidiInput*, const juce::MidiMessage& m)
{
    // A Program Change is a press with no release (the Chocolate's default mode): it can only tap.
    const auto programChange = m.isProgramChange();
    if (! m.isController() && ! programChange)
        return;

    const Switch sw { m.getChannel(), programChange ? programChangeBase + m.getProgramChangeNumber() : m.getControllerNumber() };
    const auto down = programChange || m.getControllerValue() >= 64;
    juce::MessageManager::callAsync ([this, sw, down, programChange, alive = alive]
    {
        if (! *alive)
            return;
        const auto now = juce::Time::getMillisecondCounterHiRes();
        down ? press (sw, now) : release (sw, now);
        if (programChange)
            release (sw, now);
    });
}

} // namespace glitch

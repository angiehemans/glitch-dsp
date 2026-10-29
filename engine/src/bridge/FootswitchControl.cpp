#include "FootswitchControl.h"
#include "Protocol.h"
#include "Vars.h"

namespace glitch
{

using namespace vars;

FootswitchControl::FootswitchControl (Engine& e, ProjectStore& s) : engine (e), store (s)
{
    footswitch.onPress = [this] (Footswitch::Switch sw)
    {
        lastSwitch = object ({ { "channel", sw.channel }, { "cc", sw.cc } });
        if (store.addMidiSwitch (sw.channel, sw.cc))
            sendState(); // a switch found: it gets a tile
    };
    footswitch.holdMsFor = [this] (Footswitch::Switch sw)
    {
        const auto mapping = findMapping (sw, page);
        if (! mapping["hold"].isObject())
            return 0.0;
        return mapping["holdMs"].isVoid() ? 500.0 : (double) mapping["holdMs"];
    };
    footswitch.onGesture = [this] (Footswitch::Switch sw, bool hold)
    {
        if (engine.isTuning())
        {
            // The plan: tap any switch (or hold again) to leave tune mode, whatever it's mapped to.
            onCommand (object ({ { "type", protocol::command::tuneToggle } }));
            return;
        }
        if (const auto action = findMapping (sw, page)[hold ? "hold" : "tap"]; action.isObject())
            runAction (action);
        else
            sendState(); // the press still shows on the mapping screen
    };
}

juce::var FootswitchControl::getState() const
{
    juce::Array<juce::var> devices;
    for (const auto& d : juce::MidiInput::getAvailableDevices())
        devices.add (d.name);
    const auto name = store.getMidiDevice();
    return object ({
        { "device", name.isNotEmpty() ? juce::var (name) : juce::var() },
        { "connected", footswitch.getOpenIdentifier().isNotEmpty() },
        { "devices", devices },
        { "page", page },
        { "pageCount", pageCount() },
        { "lastSwitch", lastSwitch },
        { "switches", store.getMidiSwitches() },
    });
}

bool FootswitchControl::handleCommand (const juce::String& type, const juce::var& command)
{
    const auto sw = Footswitch::Switch { (int) command["channel"], (int) command["cc"] };

    if (type == protocol::command::midiSelect)
    {
        store.setMidiDevice (command["name"].toString()); // "" = none
        footswitch.close();
        connectMidi();
        return true;
    }
    if (type == protocol::command::midiForgetSwitch)
    {
        // Gone from the found switches, and its mappings in this project with it (every page).
        store.removeMidiSwitch (sw.channel, sw.cc);
        if (auto* mappings = store.getCurrent()["mappings"].getArray())
        {
            mappings->removeIf ([&] (const juce::var& m) { return (int) m["switch"]["channel"] == sw.channel && (int) m["switch"]["cc"] == sw.cc; });
            store.markDirty();
        }
        return true;
    }
    if (type == protocol::command::footswitchPress)
    {
        // A switch pressed on screen (or by a test), as if from MIDI.
        const auto now = juce::Time::getMillisecondCounterHiRes();
        (bool) command["down"] ? footswitch.press (sw, now) : footswitch.release (sw, now);
        return true;
    }

    if (! store.getCurrent().isObject())
    {
        sendError ("No project open");
        return false;
    }

    if (type == protocol::command::mappingSet)
    {
        if (! command["action"].isObject())
        {
            sendError ("No action to map");
            return false;
        }
        auto* mappings = store.getCurrent()["mappings"].getArray();
        const auto onPage = (int) command["page"];
        auto mapping = findMapping (sw, onPage);
        if (! mapping.isObject())
        {
            mapping = object ({ { "switch", object ({ { "channel", sw.channel }, { "cc", sw.cc } }) }, { "page", onPage }, { "tap", {} }, { "hold", {} } });
            mappings->add (mapping);
        }
        mapping.getDynamicObject()->setProperty (command["gesture"].toString() == "hold" ? "hold" : "tap", command["action"]);
        store.markDirty();
    }
    else if (type == protocol::command::mappingClear || type == protocol::command::mappingHoldMs)
    {
        const auto mapping = findMapping (sw, (int) command["page"]);
        if (! mapping.isObject())
        {
            sendError ("No mapping for that switch");
            return false;
        }
        if (type == protocol::command::mappingHoldMs)
        {
            mapping.getDynamicObject()->setProperty ("holdMs", juce::jlimit (100, 3000, (int) command["holdMs"]));
        }
        else
        {
            mapping.getDynamicObject()->setProperty (command["gesture"].toString() == "hold" ? "hold" : "tap", {});
            if (! mapping["tap"].isObject() && ! mapping["hold"].isObject())
                store.getCurrent()["mappings"].getArray()->removeAllInstancesOf (mapping);
        }
        store.markDirty();
    }
    else if (type == protocol::command::footswitchPage)
    {
        page = juce::jlimit (0, pageCount(), (int) command["page"]); // one past the last: a new, empty page
    }
    else
    {
        sendError ("Unknown command: " + type);
        return false;
    }
    return true;
}

juce::var FootswitchControl::findMapping (Footswitch::Switch sw, int onPage) const
{
    if (auto* mappings = store.getCurrent()["mappings"].getArray())
        for (const auto& m : *mappings)
            if ((int) m["switch"]["channel"] == sw.channel && (int) m["switch"]["cc"] == sw.cc && (int) m["page"] == onPage)
                return m;
    return {};
}

int FootswitchControl::pageCount() const
{
    int count = 1;
    if (auto* mappings = store.getCurrent()["mappings"].getArray())
        for (const auto& m : *mappings)
            count = std::max (count, (int) m["page"] + 1);
    return count;
}

void FootswitchControl::runAction (const juce::var& action)
{
    const auto type = action["type"].toString();
    const auto toggled = [] (const juce::var& v) { return ! (bool) v; };

    if (type == "page.next")
    {
        page = (page + 1) % pageCount();
        sendState();
    }
    else if (type == "preset.next" || type == "preset.prev")
    {
        const auto* presets = store.getPresetSummaries().getArray();
        if (presets == nullptr || presets->isEmpty())
            return sendState();
        int at = -1;
        for (int i = 0; i < presets->size(); ++i)
            if ((*presets)[i]["id"].toString() == store.getCurrentPresetId())
                at = i;
        const auto n = presets->size();
        const auto next = type == "preset.next" ? (at + 1) % n : (at <= 0 ? n - 1 : at - 1);
        onCommand (object ({ { "type", protocol::command::presetLoad }, { "presetId", (*presets)[next]["id"] } }));
    }
    else if (type == "chain.toggleMute")
    {
        const auto chain = store.findChain (action["chainId"].toString());
        onCommand (object ({ { "type", protocol::command::chainSetMute }, { "chainId", action["chainId"] }, { "muted", toggled (chain["muted"]) } }));
    }
    else if (type == "aby.toggleAB" || type == "aby.toggleY")
    {
        // A/B picks the other path (from Y, back to AB); Y switches between Y and AB.
        const auto aby = store.findBlock (action["blockId"].toString());
        const auto y = aby["mode"].toString() == "Y";
        if (type == "aby.toggleY" || y)
            onCommand (object ({ { "type", protocol::command::abySetMode }, { "blockId", action["blockId"] }, { "mode", y ? "AB" : "Y" } }));
        else
            onCommand (object ({ { "type", protocol::command::abySelect }, { "blockId", action["blockId"] }, { "path", aby["active"].toString() == "A" ? "B" : "A" } }));
    }
    else if (type == "transport.toggle")
    {
        onCommand (object ({ { "type", engine.getPlayer().isPlaying() ? protocol::command::transportStop : protocol::command::transportPlay } }));
    }
    else if (type == protocol::command::blockToggle || type == protocol::command::presetLoad || type == protocol::command::abySelect
             || type == protocol::command::panicToggle || type == protocol::command::tuneToggle
             || type == protocol::command::transportNext || type == protocol::command::transportPrev
             || type == protocol::command::transportRestart)
    {
        onCommand (action);
    }
    else
    {
        sendError ("The footswitch can't do " + type + " yet");
    }
}

void FootswitchControl::connectMidi()
{
    const auto wanted = store.getMidiDevice();
    juce::String identifier;
    juce::StringArray names;
    for (const auto& d : juce::MidiInput::getAvailableDevices())
    {
        names.add (d.name);
        if (d.name == wanted)
            identifier = d.identifier;
    }
    const auto listChanged = names != std::exchange (midiNames, names); // plugged in or out: the menu lists it

    const auto wasOpen = footswitch.getOpenIdentifier().isNotEmpty();
    if (identifier.isEmpty())
        footswitch.close(); // unplugged, or none chosen
    else if (identifier != footswitch.getOpenIdentifier() && ! footswitch.open (identifier))
        sendError ("Couldn't open the MIDI device " + wanted);

    if (listChanged || wasOpen != footswitch.getOpenIdentifier().isNotEmpty())
        sendState();
}

} // namespace glitch

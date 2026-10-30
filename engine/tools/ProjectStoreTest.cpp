// Checks the project store: converting an old project, the split-exit move rule, "preset modified",
// and that settings save. Runs in a temporary data folder (GLITCH_DATA_DIR), never the user's.
// Build and run: cmake --build --preset dev --target ProjectStoreTest && <artefacts>/ProjectStoreTest

#include "../src/project/ProjectStore.h"

#include <cstdio>
#include <cstdlib>

namespace
{
    int failures = 0;

    void check (bool ok, const char* what)
    {
        if (! ok)
        {
            std::printf ("  failed: %s\n", what);
            ++failures;
        }
    }
}

int main()
{
    const juce::TemporaryFile tempDir;
    const auto dir = tempDir.getFile();
    dir.createDirectory();
    setenv ("GLITCH_DATA_DIR", dir.getFullPathName().toRawUTF8(), 1);

    // A project saved before the output matrix: the chain's fader is its first output's level, and its
    // last block is an ABY that splits to separate outputs.
    dir.getChildFile ("projects/old/project.json").create();
    dir.getChildFile ("projects/old/project.json").replaceWithText (R"({
      "id": "old", "name": "Old",
      "chains": [ {
        "id": "c1", "name": "Guitar",
        "outputs": [ { "hwChannels": [1, 2], "level": -6 } ],
        "blocks": [
          { "id": "b1", "type": "nam", "name": "Amp", "file": "nam/amp.nam", "enabled": true },
          { "id": "aby", "type": "aby", "exit": "split",
            "splitOutputs": { "A": [ { "hwChannels": [1, 2] } ], "B": [ { "hwChannels": [3] } ] },
            "pathA": { "blocks": [] }, "pathB": { "blocks": [] } }
        ]
      } ]
    })");
    dir.getChildFile ("settings.json").replaceWithText (R"({ "lastProjectId": "old" })");

    {
        glitch::ProjectStore store;
        const auto chain = store.findChain ("c1");
        check (chain.isObject(), "the old project opens");
        check (std::abs ((double) chain["level"] + 6.0) < 1.0e-9, "the fader level moves onto the chain");
        check (std::abs ((double) chain["outputs"][0]["level"]) < 1.0e-9, "and its first output becomes a 0 dB send");
        check (chain["blocks"][1]["splitOutputs"]["B"][0]["mute"].isBool(), "a split's sends get a mute");

        // A split to separate outputs ends its chain: moving it before another block is refused.
        check (store.moveBlock ("aby", chain, 0, {}, {}).isNotEmpty(), "a split exit can't move before another block");
        check (chain["blocks"][1]["id"].toString() == "aby", "and the chain is unchanged");
        check (store.moveBlock ("b1", chain, 0, "aby", "A").isEmpty(), "a block moves into the split's path A");
        check (chain["blocks"].size() == 1 && chain["blocks"][0]["pathA"]["blocks"][0]["id"].toString() == "b1", "and it's there");

        // Presets keep only mutes and bypasses: other changes don't modify them, and loading keeps the rig.
        const auto presetId = store.savePreset ({}, "Clean");
        check (! store.isPresetModified(), "a just-saved preset isn't modified");
        chain.getDynamicObject()->setProperty ("level", -12.0);
        check (! store.isPresetModified(), "the fader isn't part of it");
        const auto amp = store.findBlock ("b1");
        amp.getDynamicObject()->setProperty ("enabled", false);
        chain.getDynamicObject()->setProperty ("muted", true);
        check (store.isPresetModified(), "bypassing a block modifies it");
        check (store.loadPreset (presetId) && ! store.isPresetModified(), "loading it back undoes that");
        check ((bool) amp["enabled"] && ! (bool) chain["muted"], "with the saved bypass and mute");
        check (std::abs ((double) chain["level"] + 12.0) < 1.0e-9 && store.findBlock ("b1") == amp, "and the same blocks, fader as it was");
        chain.getDynamicObject()->setProperty ("level", -6.0);

        // A song linked to a deleted preset recalls nothing; other links stay.
        const auto other = store.savePreset ({}, "Lead");
        auto* links = store.getCurrent()["songPresets"].getDynamicObject();
        links->setProperty ("song1", presetId);
        links->setProperty ("song2", other);
        check (store.deletePreset (presetId), "a preset deletes");
        check (! links->hasProperty ("song1") && links->getProperty ("song2").toString() == other, "and only its song links go");

        store.setMidiDevice ("SINCO MIDI 1");
    } // saves on the way out

    const auto settings = juce::JSON::parse (dir.getChildFile ("settings.json"));
    check (settings["midiDevice"].toString() == "SINCO MIDI 1", "settings save");
    const auto saved = juce::JSON::parse (dir.getChildFile ("projects/old/project.json"));
    check (std::abs ((double) saved["chains"][0]["level"] + 6.0) < 1.0e-9, "the project saves converted");

    dir.deleteRecursively();
    std::printf (failures == 0 ? "projects: ok\n" : "projects: %d failures\n", failures);
    return failures == 0 ? 0 : 1;
}

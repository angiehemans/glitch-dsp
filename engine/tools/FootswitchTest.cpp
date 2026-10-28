// Checks the footswitch's tap/hold rules, with a fake clock.
// Build and run: cmake --build --preset dev --target FootswitchTest && <artefacts>/FootswitchTest

#include "../src/midi/Footswitch.h"

#include <cstdio>
#include <vector>

int main()
{
    juce::ScopedJuceInitialiser_GUI juce; // the footswitch's timer needs a message manager
    glitch::Footswitch fs;
    const glitch::Footswitch::Switch a { 1, 20 }, b { 1, 21 }; // a has a 500 ms hold action; b doesn't
    std::vector<juce::String> got;
    fs.holdMsFor = [&] (auto sw) { return sw == a ? 500.0 : 0.0; };
    fs.onGesture = [&] (auto sw, bool hold) { got.push_back (juce::String (sw.cc) + (hold ? " hold" : " tap")); };

    int failures = 0;
    const auto expect = [&] (const char* what, std::vector<juce::String> want)
    {
        if (got != want)
        {
            std::printf ("  %s: got [%s]\n", what, juce::StringArray (got.data(), (int) got.size()).joinIntoString (", ").toRawUTF8());
            ++failures;
        }
        got.clear();
    };

    fs.press (b, 0);
    expect ("no hold action: tap on press", { "21 tap" });
    fs.release (b, 50);
    expect ("its release does nothing", {});

    fs.press (a, 1000);
    fs.tick (1100);
    fs.release (a, 1200);
    expect ("hold action: a short press taps on release", { "20 tap" });

    fs.press (a, 2000);
    fs.tick (2499);
    expect ("not held long enough yet", {});
    fs.tick (2500);
    fs.release (a, 2700);
    expect ("held for the hold time: hold, and the release is ignored", { "20 hold" });

    fs.press (a, 3000);
    fs.release (a, 3600);
    expect ("released after the hold time, before the timer saw it: hold", { "20 hold" });

    fs.press (b, 4000);
    fs.press (b, 4010);
    fs.release (b, 4020);
    fs.release (b, 4030);
    expect ("a repeated press is one press; a release with no press is ignored", { "21 tap" });

    fs.press (a, 5000);
    fs.close();
    fs.tick (6000);
    fs.release (a, 6000);
    expect ("closing the device cancels a hold in progress", {});

    std::printf (failures == 0 ? "footswitch: ok\n" : "footswitch: %d failures\n", failures);
    return failures == 0 ? 0 : 1;
}

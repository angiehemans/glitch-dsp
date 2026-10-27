// Checks that BlockMix (bypass) and AbyMerge (ABY switching) fade without jumps.
// Build and run: cmake --build --preset dev --target FadeTest && <artefacts>/FadeTest

#include "../src/audio/AbyMerge.h"
#include "../src/audio/BlockMix.h"

#include <cmath>
#include <cstdio>

namespace
{
    constexpr double sampleRate = 48000.0;
    constexpr int blockSize = 128;
    int failures = 0;

    // Feeds a 4-input node +0.5 on inputs 0-1 and -0.5 on 2-3, n blocks at a time. Every step must
    // be at most maxStep, both outputs equal, and the last sample expectedEnd.
    struct Run
    {
        juce::AudioProcessor& node;
        float maxStep;
        float last;

        void operator() (int numBlocks, float expectedEnd)
        {
            juce::AudioBuffer<float> buffer (4, blockSize);
            juce::MidiBuffer midi;
            for (int b = 0; b < numBlocks; ++b)
            {
                for (int ch = 0; ch < 4; ++ch)
                    juce::FloatVectorOperations::fill (buffer.getWritePointer (ch), ch < 2 ? 0.5f : -0.5f, blockSize);
                node.processBlock (buffer, midi);

                for (int i = 0; i < blockSize; ++i)
                {
                    const auto s = buffer.getSample (0, i);
                    if (std::abs (s - last) > maxStep || std::abs (s - buffer.getSample (1, i)) > 1.0e-6f)
                        ++failures;
                    last = s;
                }
            }
            if (std::abs (last - expectedEnd) > 1.0e-4f)
            {
                std::printf ("  %s ended at %f, expected %f\n", node.getName().toRawUTF8(), last, expectedEnd);
                ++failures;
            }
        }
    };
}

int main()
{
    {
        glitch::BlockMix mix;
        mix.prepareToPlay (sampleRate, blockSize);
        Run run { mix, 1.5f / (float) (sampleRate * glitch::BlockMix::fadeSeconds), 0.5f };

        run (4, 0.5f);
        mix.wet = false;
        run (16, -0.5f);
        mix.wet = true;
        run (16, 0.5f);
    }

    {
        glitch::AbyMerge merge; // AB mode, path A heard
        merge.prepareToPlay (sampleRate, blockSize);
        Run run { merge, 1.5f / (float) (sampleRate * glitch::AbyMerge::fadeSeconds), 0.5f };

        run (4, 0.5f);
        merge.activeB = true; // crossfade to B
        run (8, -0.5f);
        merge.both = true; // Y: both paths summed, A + B = 0
        run (8, 0.0f);
        merge.muted[1] = true; // only A left
        run (8, 0.5f);
        merge.levelDb[0] = -100.0f; // silent
        run (8, 0.0f);
    }

    std::printf (failures == 0 ? "fades: ok\n" : "fades: %d failures\n", failures);
    return failures == 0 ? 0 : 1;
}

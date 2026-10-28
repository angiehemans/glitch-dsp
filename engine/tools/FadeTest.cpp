// Checks that BlockMix (bypass), AbyMerge (ABY switching) and OutputMixer (routing) fade without jumps.
// Build and run: cmake --build --preset dev --target FadeTest && <artefacts>/FadeTest

#include "../src/audio/AbyMerge.h"
#include "../src/audio/BlockMix.h"
#include "../src/audio/OutputMixer.h"

#include <cmath>
#include <cstdio>

namespace
{
    constexpr double sampleRate = 48000.0;
    constexpr int blockSize = 128;
    int failures = 0;
    const float yGain = juce::Decibels::decibelsToGain (-3.0f); // each path in Y mode

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
        merge.both = true; // Y: both paths summed at -3 dB each, A + B = 0
        run (8, 0.0f);
        merge.muted[1] = true; // only A left, at -3 dB
        run (8, 0.5f * yGain);
        merge.muted[0] = true; // silent
        run (8, 0.0f);
    }

    {
        // Split exit: Y mode keeps A on outputs 0-1 and B on 2-3. Then muting A fades it out, leaving B.
        glitch::AbyMerge merge;
        merge.both = true;
        merge.split = true;
        merge.prepareToPlay (sampleRate, blockSize);
        const auto maxStep = 1.5f / (float) (sampleRate * glitch::AbyMerge::fadeSeconds);
        juce::AudioBuffer<float> buffer (4, blockSize);
        juce::MidiBuffer midi;
        float lastLeft = 0.5f * yGain;

        const auto process = [&] (int numBlocks)
        {
            for (int b = 0; b < numBlocks; ++b)
            {
                for (int ch = 0; ch < 4; ++ch)
                    juce::FloatVectorOperations::fill (buffer.getWritePointer (ch), ch < 2 ? 0.5f : -0.5f, blockSize);
                merge.processBlock (buffer, midi);
                for (int i = 0; i < blockSize; ++i)
                {
                    if (std::abs (buffer.getSample (0, i) - lastLeft) > maxStep)
                        ++failures;
                    lastLeft = buffer.getSample (0, i);
                }
            }
        };
        const auto expect = [&] (int ch, float value)
        {
            if (std::abs (buffer.getSample (ch, blockSize - 1) - value) > 1.0e-4f)
            {
                std::printf ("  split output %d ended at %f, expected %f\n", ch, buffer.getSample (ch, blockSize - 1), value);
                ++failures;
            }
        };

        process (4);
        expect (0, 0.5f * yGain);
        expect (2, -0.5f * yGain);
        merge.muted[0] = true;
        process (16);
        expect (0, 0.0f);
        expect (1, 0.0f);
        expect (3, -0.5f * yGain);
    }

    {
        // Output matrix: source 3 is L = 0.5, R = 0.25. A pair sends L to out 1 and R to out 2; a single
        // output gets half of each. Turning the pair down ramps without a jump.
        glitch::OutputMixer mixer;
        glitch::OutputMixer::SourceGains gains {};
        gains[0][0] = 1.0f;                     // L -> out 1
        gains[1][1] = 1.0f;                     // R -> out 2
        gains[0][4] = gains[1][4] = 0.5f;       // both -> out 5
        mixer.setGains (3, gains);
        mixer.prepareToPlay (sampleRate, blockSize);

        juce::AudioBuffer<float> buffer (glitch::OutputMixer::numSources * 2, blockSize);
        juce::MidiBuffer midi;
        const auto maxStep = 1.5f * 0.5f / (float) (sampleRate * glitch::OutputMixer::fadeSeconds);
        float last = 0.5f;
        const auto process = [&] (int numBlocks)
        {
            for (int b = 0; b < numBlocks; ++b)
            {
                buffer.clear();
                juce::FloatVectorOperations::fill (buffer.getWritePointer (6), 0.5f, blockSize);
                juce::FloatVectorOperations::fill (buffer.getWritePointer (7), 0.25f, blockSize);
                mixer.processBlock (buffer, midi);
                for (int i = 0; i < blockSize; ++i)
                {
                    if (std::abs (buffer.getSample (0, i) - last) > maxStep)
                        ++failures;
                    last = buffer.getSample (0, i);
                }
            }
        };
        const auto expect = [&] (int out, float value)
        {
            if (std::abs (buffer.getSample (out, blockSize - 1) - value) > 1.0e-4f)
            {
                std::printf ("  mixer output %d ended at %f, expected %f\n", out + 1, buffer.getSample (out, blockSize - 1), value);
                ++failures;
            }
        };

        process (4);
        expect (0, 0.5f);
        expect (1, 0.25f);
        expect (4, 0.375f);
        expect (2, 0.0f);

        gains[0][0] = gains[1][1] = 0.0f; // unroute the pair
        mixer.setGains (3, gains);
        process (16);
        expect (0, 0.0f);
        expect (1, 0.0f);
        expect (4, 0.375f);
    }

    std::printf (failures == 0 ? "fades: ok\n" : "fades: %d failures\n", failures);
    return failures == 0 ? 0 : 1;
}

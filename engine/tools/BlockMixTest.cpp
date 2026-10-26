// Checks that BlockMix fades between a block and its dry signal without jumps.
// Build and run: cmake --build --preset dev --target BlockMixTest && <artefacts>/BlockMixTest

#include "../src/audio/BlockMix.h"

#include <cmath>
#include <cstdio>

int main()
{
    constexpr double sampleRate = 48000.0;
    constexpr int blockSize = 128;
    const auto fadeSamples = (int) (sampleRate * glitch::BlockMix::fadeSeconds);

    glitch::BlockMix mix;
    mix.prepareToPlay (sampleRate, blockSize);

    juce::AudioBuffer<float> buffer (4, blockSize);
    juce::MidiBuffer midi;
    float last = 0.5f;
    int failures = 0;

    // Runs n blocks of wet = +0.5, dry = -0.5; every step must be small, and the end value right.
    const auto run = [&] (int numBlocks, float expectedEnd)
    {
        for (int b = 0; b < numBlocks; ++b)
        {
            for (int ch = 0; ch < 4; ++ch)
                juce::FloatVectorOperations::fill (buffer.getWritePointer (ch), ch < 2 ? 0.5f : -0.5f, blockSize);
            mix.processBlock (buffer, midi);

            for (int i = 0; i < blockSize; ++i)
            {
                const auto s = buffer.getSample (0, i);
                if (std::abs (s - last) > 1.5f / (float) fadeSamples || s != buffer.getSample (1, i))
                    ++failures;
                last = s;
            }
        }
        if (std::abs (last - expectedEnd) > 1.0e-6f)
            ++failures;
    };

    run (4, 0.5f);
    mix.wet = false;
    run (16, -0.5f);
    mix.wet = true;
    run (16, 0.5f);

    std::printf (failures == 0 ? "BlockMix: ok\n" : "BlockMix: %d failures\n", failures);
    return failures == 0 ? 0 : 1;
}

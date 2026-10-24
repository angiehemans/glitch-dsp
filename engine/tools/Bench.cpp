// GlitchBench: how much of each audio buffer a NAM model or IR takes, using the app's own blocks.
// Usage: GlitchBench <model.nam | ir.wav> [sample rate, default 48000]
// Build: cmake --build --preset release --target GlitchBench (always measure an optimised build).

#include "../src/blocks/IrBlock.h"
#include "../src/blocks/NamBlock.h"

#include <cstdio>

int main (int argc, char** argv)
{
    if (argc < 2)
    {
        std::printf ("usage: GlitchBench <model.nam | ir.wav> [sample rate]\n");
        return 2;
    }

    const juce::ScopedJuceInitialiser_GUI juce; // Convolution loads IRs on a background thread
    const juce::File file (juce::File::getCurrentWorkingDirectory().getChildFile (argv[1]));
    const auto sampleRate = argc > 2 ? juce::String (argv[2]).getDoubleValue() : 48000.0;
    const auto isNam = file.hasFileExtension (".nam");

    std::printf ("%s at %.0f Hz\n", file.getFileName().toRawUTF8(), sampleRate);

    for (const int blockSize : { 64, 128, 256 })
    {
        juce::String error;
        std::unique_ptr<juce::AudioProcessor> block;
        if (isNam)
            block = glitch::NamBlock::load (file, error);
        else
            block = glitch::IrBlock::load (file, error);

        if (block == nullptr)
        {
            std::printf ("can't load: %s\n", error.toRawUTF8());
            return 1;
        }

        block->prepareToPlay (sampleRate, blockSize);
        if (! isNam)
            juce::Thread::sleep (500); // let the IR finish loading in the background

        juce::AudioBuffer<float> buffer (2, blockSize);
        juce::MidiBuffer midi;
        juce::Random random (1);
        const auto fill = [&]
        {
            for (int ch = 0; ch < 2; ++ch)
                for (int i = 0; i < blockSize; ++i)
                    buffer.setSample (ch, i, (random.nextFloat() * 2.0f - 1.0f) * 0.1f); // a guitar-ish level
        };

        const auto blocksPerSecond = (int) (sampleRate / blockSize);
        for (int i = 0; i < blocksPerSecond; ++i) // 1 s warm-up
        {
            fill();
            block->processBlock (buffer, midi);
        }

        constexpr int seconds = 10;
        double worst = 0.0, total = 0.0;
        for (int i = 0; i < blocksPerSecond * seconds; ++i)
        {
            fill();
            const auto t0 = juce::Time::getHighResolutionTicks();
            block->processBlock (buffer, midi);
            const auto t = juce::Time::highResolutionTicksToSeconds (juce::Time::getHighResolutionTicks() - t0);
            total += t;
            worst = std::max (worst, t);
        }

        const auto budget = blockSize / sampleRate;
        std::printf ("  %3d samples (%.2f ms buffer): average %5.1f%% of the buffer, worst %5.1f%%\n", blockSize, budget * 1000.0,
                     100.0 * total / (blocksPerSecond * seconds) / budget, 100.0 * worst / budget);
    }
    return 0;
}

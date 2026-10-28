#pragma once

#include <juce_audio_processors/juce_audio_processors.h>

#include <array>
#include <atomic>

namespace glitch
{

// The output matrix: every source (a chain's output, or the B path of a chain whose ABY splits to
// separate outputs) on a fixed pair of inputs, summed into the hardware outputs. Each source channel
// has a gain into each output; the engine sets them from the routes (setGains, message thread) and
// they're smoothed here, so routing and level changes never click and never need rewiring.
class OutputMixer final : public juce::AudioProcessor
{
public:
    static constexpr int numSources = 16;  // Engine::maxChains, two sources each
    static constexpr int numOutputs = 8;   // Engine::maxChannels
    static constexpr double fadeSeconds = 0.02;

    OutputMixer()
        : AudioProcessor (BusesProperties().withInput ("Sources", juce::AudioChannelSet::discreteChannels (numSources * 2))
                                           .withOutput ("Out", juce::AudioChannelSet::discreteChannels (numOutputs)))
    {
    }

    /** gains[channel][output] for one source: channel 0 is left, 1 right. Message thread. */
    using SourceGains = std::array<std::array<float, numOutputs>, 2>;
    void setGains (int source, const SourceGains& gains)
    {
        for (int ch = 0; ch < 2; ++ch)
            for (int out = 0; out < numOutputs; ++out)
                target[source][ch][out].store (gains[ch][out]);
    }

    /** Tune mode: a silenced source fades out (and back in) without its routes changing. */
    void setSilenced (int source, bool silenced) { quiet[source].store (silenced); }

    void prepareToPlay (double sampleRate, int maximumBlockSize) override
    {
        mix.setSize (numOutputs, maximumBlockSize);
        for (int s = 0; s < numSources; ++s)
            for (int ch = 0; ch < 2; ++ch)
                for (int out = 0; out < numOutputs; ++out)
                {
                    gain[s][ch][out].reset (sampleRate, fadeSeconds);
                    gain[s][ch][out].setCurrentAndTargetValue (quiet[s].load() ? 0.0f : target[s][ch][out].load());
                }
    }

    void processBlock (juce::AudioBuffer<float>& buffer, juce::MidiBuffer&) override
    {
        const auto numSamples = buffer.getNumSamples();
        mix.clear (0, numSamples); // the buffer's first channels are both inputs and outputs: mix apart

        for (int s = 0; s < numSources; ++s)
        {
            const auto silenced = quiet[s].load (std::memory_order_relaxed);
            for (int ch = 0; ch < 2; ++ch)
            {
                const auto* in = buffer.getReadPointer (s * 2 + ch);
                for (int out = 0; out < numOutputs; ++out)
                {
                    auto& g = gain[s][ch][out];
                    g.setTargetValue (silenced ? 0.0f : target[s][ch][out].load (std::memory_order_relaxed));
                    if (! g.isSmoothing() && g.getCurrentValue() == 0.0f)
                        continue; // not routed: most crosspoints, most of the time

                    auto* dest = mix.getWritePointer (out);
                    if (g.isSmoothing())
                        for (int i = 0; i < numSamples; ++i)
                            dest[i] += g.getNextValue() * in[i];
                    else
                        juce::FloatVectorOperations::addWithMultiply (dest, in, g.getCurrentValue(), numSamples);
                }
            }
        }

        for (int out = 0; out < numOutputs; ++out)
            buffer.copyFrom (out, 0, mix, out, 0, numSamples);
    }

    void releaseResources() override {}
    const juce::String getName() const override { return "Output mixer"; }
    double getTailLengthSeconds() const override { return 0.0; }
    bool acceptsMidi() const override { return false; }
    bool producesMidi() const override { return false; }
    bool hasEditor() const override { return false; }
    juce::AudioProcessorEditor* createEditor() override { return nullptr; }
    int getNumPrograms() override { return 1; }
    int getCurrentProgram() override { return 0; }
    void setCurrentProgram (int) override {}
    const juce::String getProgramName (int) override { return {}; }
    void changeProgramName (int, const juce::String&) override {}
    void getStateInformation (juce::MemoryBlock&) override {}
    void setStateInformation (const void*, int) override {}

private:
    std::atomic<float> target[numSources][2][numOutputs] {};
    std::atomic<bool> quiet[numSources] {};
    juce::SmoothedValue<float> gain[numSources][2][numOutputs]; // audio thread only
    juce::AudioBuffer<float> mix;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (OutputMixer)
};

} // namespace glitch

#pragma once

#include <juce_audio_processors/juce_audio_processors.h>

#include <atomic>

namespace glitch
{

// Sits after every block and crossfades between the block's output (inputs 0-1) and the signal
// that went into it (inputs 2-3), so bypassing never clicks. The graph delays the dry inputs by
// the block's latency, so the two stay aligned. `wet` is set from the message thread.
class BlockMix final : public juce::AudioProcessor
{
public:
    static constexpr double fadeSeconds = 0.02;

    BlockMix()
        : AudioProcessor (BusesProperties().withInput ("In", juce::AudioChannelSet::discreteChannels (4))
                                           .withOutput ("Out", juce::AudioChannelSet::stereo()))
    {
    }

    std::atomic<bool> wet { true };

    void prepareToPlay (double sampleRate, int) override
    {
        mix.reset (sampleRate, fadeSeconds);
        mix.setCurrentAndTargetValue (wet.load() ? 1.0f : 0.0f);
    }

    void processBlock (juce::AudioBuffer<float>& buffer, juce::MidiBuffer&) override
    {
        const auto numSamples = buffer.getNumSamples();
        mix.setTargetValue (wet.load() ? 1.0f : 0.0f);

        if (! mix.isSmoothing())
        {
            if (mix.getTargetValue() < 0.5f) // settled on dry
                for (int ch = 0; ch < 2; ++ch)
                    buffer.copyFrom (ch, 0, buffer, ch + 2, 0, numSamples);
            return;
        }

        auto* l = buffer.getWritePointer (0);
        auto* r = buffer.getWritePointer (1);
        const auto* dl = buffer.getReadPointer (2);
        const auto* dr = buffer.getReadPointer (3);

        for (int i = 0; i < numSamples; ++i)
        {
            const auto w = mix.getNextValue();
            l[i] = dl[i] + w * (l[i] - dl[i]);
            r[i] = dr[i] + w * (r[i] - dr[i]);
        }
    }

    void releaseResources() override {}
    const juce::String getName() const override { return "Block mix"; }
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
    juce::SmoothedValue<float> mix; // audio thread only

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (BlockMix)
};

} // namespace glitch

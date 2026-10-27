#pragma once

#include <juce_audio_processors/juce_audio_processors.h>

#include <atomic>

namespace glitch
{

// Where an ABY block's two paths meet: path A on inputs 0-1, path B on 2-3. Y mode plays both at
// -3 dB each, so the sum doesn't jump; AB plays the active one at full level. A merge sums them to outputs 0-1; a split exit keeps them apart, A on outputs 0-1
// and B on 2-3, for separate hardware outputs. In AB mode only the active path is heard, and
// switching crossfades.
// Both paths keep running either way, so tails ring out and amps stay warm. The graph delays the
// faster path by the slower one's latency, so a Y merge doesn't comb filter. Parameters are atomics
// set from the message thread.
class AbyMerge final : public juce::AudioProcessor
{
public:
    static constexpr double fadeSeconds = 0.01; // the plan's crossfadeMs default

    AbyMerge()
        : AudioProcessor (BusesProperties().withInput ("In", juce::AudioChannelSet::discreteChannels (4))
                                           .withOutput ("Out", juce::AudioChannelSet::discreteChannels (4)))
    {
    }

    std::atomic<bool> both { false };     // Y mode
    std::atomic<bool> activeB { false };  // AB mode: which path is heard
    std::atomic<bool> muted[2] { { false }, { false } };
    std::atomic<bool> split { false }; // set by the engine while the chain is faded out, as it rewires

    void prepareToPlay (double sampleRate, int) override
    {
        for (int p = 0; p < 2; ++p)
        {
            gain[p].reset (sampleRate, fadeSeconds);
            gain[p].setCurrentAndTargetValue (targetGain (p));
        }
    }

    void processBlock (juce::AudioBuffer<float>& buffer, juce::MidiBuffer&) override
    {
        const auto numSamples = buffer.getNumSamples();
        const auto apart = split.load();
        for (int p = 0; p < 2; ++p)
            gain[p].setTargetValue (targetGain (p));

        for (int ch = 0; ch < 2; ++ch)
        {
            auto ga = gain[0], gb = gain[1]; // the same ramp for each channel
            auto* a = buffer.getWritePointer (ch);
            auto* b = buffer.getWritePointer (ch + 2);

            for (int i = 0; i < numSamples; ++i)
            {
                const auto sa = ga.getNextValue() * a[i], sb = gb.getNextValue() * b[i];
                a[i] = apart ? sa : sa + sb;
                b[i] = apart ? sb : 0.0f;
            }
        }

        for (auto& g : gain)
            g.skip (numSamples);
    }

    void releaseResources() override {}
    const juce::String getName() const override { return "ABY merge"; }
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
    float targetGain (int path) const
    {
        if (muted[path].load())
            return 0.0f;
        if (both.load())
            return juce::Decibels::decibelsToGain (-3.0f);
        return activeB.load() == (path == 1) ? 1.0f : 0.0f;
    }

    juce::SmoothedValue<float> gain[2]; // audio thread only

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (AbyMerge)
};

} // namespace glitch

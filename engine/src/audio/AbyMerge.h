#pragma once

#include <juce_audio_processors/juce_audio_processors.h>

#include <atomic>

namespace glitch
{

// Where an ABY block's two paths meet: path A on inputs 0-1, path B on 2-3, summed to stereo with
// each path's level and mute. In AB mode only the active path is heard, and switching crossfades.
// Both paths keep running either way, so tails ring out and amps stay warm. The graph delays the
// faster path by the slower one's latency, so a Y merge doesn't comb filter. Parameters are atomics
// set from the message thread.
class AbyMerge final : public juce::AudioProcessor
{
public:
    static constexpr double fadeSeconds = 0.01; // the plan's crossfadeMs default

    AbyMerge()
        : AudioProcessor (BusesProperties().withInput ("In", juce::AudioChannelSet::discreteChannels (4))
                                           .withOutput ("Out", juce::AudioChannelSet::stereo()))
    {
    }

    std::atomic<bool> both { false };     // Y mode
    std::atomic<bool> activeB { false };  // AB mode: which path is heard
    std::atomic<float> levelDb[2] { { 0.0f }, { 0.0f } };
    std::atomic<bool> muted[2] { { false }, { false } };

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
        for (int p = 0; p < 2; ++p)
            gain[p].setTargetValue (targetGain (p));

        for (int ch = 0; ch < 2; ++ch)
        {
            auto* out = buffer.getWritePointer (ch);
            const auto* b = buffer.getReadPointer (ch + 2);
            auto ga = gain[0], gb = gain[1]; // the same ramp for each channel

            for (int i = 0; i < numSamples; ++i)
                out[i] = ga.getNextValue() * out[i] + gb.getNextValue() * b[i];
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
        const auto heard = both.load() || activeB.load() == (path == 1);
        const auto db = levelDb[path].load();
        return heard && ! muted[path].load() && db > -100.0f ? juce::Decibels::decibelsToGain (db) : 0.0f;
    }

    juce::SmoothedValue<float> gain[2]; // audio thread only

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (AbyMerge)
};

} // namespace glitch

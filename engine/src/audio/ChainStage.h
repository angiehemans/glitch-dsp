#pragma once

#include <juce_audio_processors/juce_audio_processors.h>

#include <atomic>

namespace glitch
{

// A stereo pass-through node at either end of a chain. The input stage only meters; the output
// stage also applies the chain's smoothed level and mute. Parameters are atomics set from the
// message thread.
class ChainStage final : public juce::AudioProcessor
{
public:
    explicit ChainStage (bool appliesGainIn)
        : AudioProcessor (BusesProperties().withInput ("In", juce::AudioChannelSet::stereo())
                                           .withOutput ("Out", juce::AudioChannelSet::stereo())),
          appliesGain (appliesGainIn)
    {
    }

    std::atomic<float> levelDb { 0.0f };
    std::atomic<bool> muted { false };
    std::atomic<bool> ducked { false }; // faded out while the engine rewires the chain
    std::atomic<float> peak { 0.0f };

    void prepareToPlay (double sampleRate, int) override
    {
        gain.reset (sampleRate, 0.02);
        gain.setCurrentAndTargetValue (0.0f); // fade in when a chain starts
    }

    void processBlock (juce::AudioBuffer<float>& buffer, juce::MidiBuffer&) override
    {
        const auto numSamples = buffer.getNumSamples();

        if (appliesGain)
        {
            const auto db = levelDb.load();
            gain.setTargetValue (muted.load() || ducked.load() || db <= -100.0f ? 0.0f : juce::Decibels::decibelsToGain (db));
            gain.applyGain (buffer, numSamples);
        }

        // Racy max with the reader's exchange, which at worst drops one block's peak. Fine for meters.
        const auto p = buffer.getMagnitude (0, numSamples);
        if (p > peak.load (std::memory_order_relaxed))
            peak.store (p, std::memory_order_relaxed);
    }

    void releaseResources() override {}
    const juce::String getName() const override { return appliesGain ? "Chain out" : "Chain in"; }
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
    const bool appliesGain;
    juce::SmoothedValue<float> gain; // audio thread only

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (ChainStage)
};

} // namespace glitch

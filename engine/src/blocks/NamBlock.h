#pragma once

#include "BuiltInBlock.h"
#include "NamModel.h"

namespace glitch
{

// A NAM amp/pedal model. NAM models are mono: the block runs the left channel through the model and
// feeds the result to both channels. Input and Output gain; the output is normalised to the model's
// recorded loudness when it has one, like the NAM plugin's Normalize.
class NamBlock final : public BuiltInBlock
{
public:
    static std::unique_ptr<NamBlock> load (const juce::File& file, juce::String& error);

    double getExpectedSampleRate() const { return model->getExpectedSampleRate(); }

    void prepareToPlay (double sampleRate, int maximumExpectedSamplesPerBlock) override;
    void processBlock (juce::AudioBuffer<float>&, juce::MidiBuffer&) override;

private:
    NamBlock (const juce::String& modelName, std::unique_ptr<NamModel>);

    static constexpr float targetLoudnessDb = -18.0f; // as the NAM plugin normalises to

    std::unique_ptr<NamModel> model;
    juce::AudioParameterFloat* inputDb;
    juce::AudioParameterFloat* outputDb;
    const float normaliseDb;
    std::vector<float> in, out; // sized in prepareToPlay
    int maxBlock = 0;
    juce::SmoothedValue<float> inputGain, outputGain; // audio thread only
};

} // namespace glitch

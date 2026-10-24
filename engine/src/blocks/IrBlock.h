#pragma once

#include "BuiltInBlock.h"

#include <juce_dsp/juce_dsp.h>

namespace glitch
{

// A cabinet impulse response: juce::dsp::Convolution, which loads and swaps IRs off the audio
// thread. A mono IR is applied to both channels. Level and Mix (dry/wet).
class IrBlock final : public BuiltInBlock
{
public:
    static std::unique_ptr<IrBlock> load (const juce::File& file, juce::String& error);

    void prepareToPlay (double sampleRate, int maximumExpectedSamplesPerBlock) override;
    void processBlock (juce::AudioBuffer<float>&, juce::MidiBuffer&) override;

private:
    IrBlock (const juce::File& file);

    juce::dsp::Convolution convolution;
    juce::dsp::DryWetMixer<float> mixer;
    juce::AudioParameterFloat* levelDb;
    juce::AudioParameterFloat* mix;
    juce::SmoothedValue<float> level; // audio thread only
};

} // namespace glitch

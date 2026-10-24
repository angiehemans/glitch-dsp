#include "IrBlock.h"

#include <juce_audio_formats/juce_audio_formats.h>

namespace glitch
{

std::unique_ptr<IrBlock> IrBlock::load (const juce::File& file, juce::String& error)
{
    // Check it decodes here, so a bad file shows as missing instead of silently passing audio through.
    juce::AudioFormatManager formats;
    formats.registerBasicFormats();
    if (std::unique_ptr<juce::AudioFormatReader> reader (formats.createReaderFor (file)); reader == nullptr || reader->lengthInSamples == 0)
    {
        error = file.existsAsFile() ? "Not an audio file" : "IR file not found";
        return nullptr;
    }
    return std::unique_ptr<IrBlock> (new IrBlock (file));
}

IrBlock::IrBlock (const juce::File& file)
    : BuiltInBlock (file.getFileNameWithoutExtension())
{
    addParameter (levelDb = dB ("level", "Level", -24.0f, 12.0f, 0.0f));
    addParameter (mix = new juce::AudioParameterFloat (juce::ParameterID { "mix", 1 }, "Mix", juce::NormalisableRange<float> (0.0f, 100.0f, 1.0f),
                                                       100.0f, juce::AudioParameterFloatAttributes().withLabel ("%")));
    convolution.loadImpulseResponse (file, juce::dsp::Convolution::Stereo::yes, juce::dsp::Convolution::Trim::yes, 0,
                                     juce::dsp::Convolution::Normalise::yes);
}

void IrBlock::prepareToPlay (double sampleRate, int maximumExpectedSamplesPerBlock)
{
    const juce::dsp::ProcessSpec spec { sampleRate, (juce::uint32) std::max (1, maximumExpectedSamplesPerBlock), 2 };
    convolution.prepare (spec);
    mixer.prepare (spec);
    level.reset (sampleRate, 0.02);
    level.setCurrentAndTargetValue (juce::Decibels::decibelsToGain (levelDb->get()));
}

void IrBlock::processBlock (juce::AudioBuffer<float>& buffer, juce::MidiBuffer&)
{
    juce::dsp::AudioBlock<float> block (buffer);
    mixer.setWetMixProportion (mix->get() / 100.0f);
    mixer.pushDrySamples (block);
    convolution.process (juce::dsp::ProcessContextReplacing<float> (block));
    mixer.mixWetSamples (block);

    level.setTargetValue (juce::Decibels::decibelsToGain (levelDb->get()));
    level.applyGain (buffer, buffer.getNumSamples());
}

} // namespace glitch

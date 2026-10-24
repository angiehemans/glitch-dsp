#include "NamBlock.h"

namespace glitch
{

std::unique_ptr<NamBlock> NamBlock::load (const juce::File& file, juce::String& error)
{
    if (! file.existsAsFile())
    {
        error = "Model file not found";
        return nullptr;
    }

    std::string message;
    auto model = NamModel::load (file.getFullPathName().toStdString(), message);
    if (model == nullptr)
    {
        error = message;
        return nullptr;
    }
    return std::unique_ptr<NamBlock> (new NamBlock (file.getFileNameWithoutExtension(), std::move (model)));
}

NamBlock::NamBlock (const juce::String& modelName, std::unique_ptr<NamModel> modelIn)
    : BuiltInBlock (modelName),
      model (std::move (modelIn)),
      normaliseDb (model->getLoudness().has_value() ? targetLoudnessDb - (float) *model->getLoudness() : 0.0f)
{
    addParameter (inputDb = dB ("input", "Input", -24.0f, 24.0f, 0.0f));
    addParameter (outputDb = dB ("output", "Output", -40.0f, 24.0f, 0.0f));
}

void NamBlock::prepareToPlay (double sampleRate, int maximumExpectedSamplesPerBlock)
{
    maxBlock = std::max (1, maximumExpectedSamplesPerBlock);
    in.assign ((size_t) maxBlock, 0.0f);
    out.assign ((size_t) maxBlock, 0.0f);
    model->reset (sampleRate, maxBlock);

    for (auto* g : { &inputGain, &outputGain })
        g->reset (sampleRate, 0.02);
    inputGain.setCurrentAndTargetValue (juce::Decibels::decibelsToGain (inputDb->get()));
    outputGain.setCurrentAndTargetValue (juce::Decibels::decibelsToGain (outputDb->get() + normaliseDb));
}

void NamBlock::processBlock (juce::AudioBuffer<float>& buffer, juce::MidiBuffer&)
{
    inputGain.setTargetValue (juce::Decibels::decibelsToGain (inputDb->get()));
    outputGain.setTargetValue (juce::Decibels::decibelsToGain (outputDb->get() + normaliseDb));

    // The host may hand over more than it promised; process in chunks the model was sized for.
    for (int start = 0; start < buffer.getNumSamples(); start += maxBlock)
    {
        const auto n = std::min (maxBlock, buffer.getNumSamples() - start);
        const auto* left = buffer.getReadPointer (0, start);

        for (int i = 0; i < n; ++i)
            in[(size_t) i] = left[i] * inputGain.getNextValue();

        model->process (in.data(), out.data(), n);

        for (int i = 0; i < n; ++i)
            out[(size_t) i] *= outputGain.getNextValue();

        for (int ch = 0; ch < buffer.getNumChannels(); ++ch)
            juce::FloatVectorOperations::copy (buffer.getWritePointer (ch, start), out.data(), n);
    }
}

} // namespace glitch

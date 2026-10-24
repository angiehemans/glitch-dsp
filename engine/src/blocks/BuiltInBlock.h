#pragma once

#include <juce_audio_processors/juce_audio_processors.h>

namespace glitch
{

// Shared plumbing for Glitch's own blocks (NAM, IR): stereo in/out, no editor of their own (the
// plugin window shows JUCE's generic one), parameters saved as XML through get/setStateInformation.
class BuiltInBlock : public juce::AudioProcessor
{
public:
    explicit BuiltInBlock (juce::String nameIn)
        : AudioProcessor (BusesProperties().withInput ("In", juce::AudioChannelSet::stereo())
                                           .withOutput ("Out", juce::AudioChannelSet::stereo())),
          name (std::move (nameIn))
    {
    }

    const juce::String getName() const override { return name; }
    void releaseResources() override {}
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

    void getStateInformation (juce::MemoryBlock& dest) override
    {
        juce::XmlElement xml ("PARAMS");
        for (auto* p : getParameters())
            if (auto* ranged = dynamic_cast<juce::RangedAudioParameter*> (p))
                xml.setAttribute (ranged->getParameterID(), ranged->getValue());
        copyXmlToBinary (xml, dest);
    }

    void setStateInformation (const void* data, int size) override
    {
        if (const auto xml = getXmlFromBinary (data, size))
            for (auto* p : getParameters())
                if (auto* ranged = dynamic_cast<juce::RangedAudioParameter*> (p))
                    if (xml->hasAttribute (ranged->getParameterID()))
                        ranged->setValueNotifyingHost ((float) xml->getDoubleAttribute (ranged->getParameterID()));
    }

protected:
    static juce::AudioParameterFloat* dB (const juce::String& id, const juce::String& label, float min, float max, float def)
    {
        return new juce::AudioParameterFloat (juce::ParameterID { id, 1 }, label, juce::NormalisableRange<float> (min, max, 0.1f), def,
                                              juce::AudioParameterFloatAttributes().withLabel ("dB"));
    }

private:
    const juce::String name;
};

} // namespace glitch

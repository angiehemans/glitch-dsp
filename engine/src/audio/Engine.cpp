#include "Engine.h"

namespace glitch
{

Engine::Engine()
{
    deviceError = deviceManager.initialiseWithDefaultDevices (2, 2);
    deviceManager.addAudioCallback (this);
}

Engine::~Engine()
{
    deviceManager.removeAudioCallback (this);
}

float Engine::takePeakDb (Meter m)
{
    return juce::Decibels::gainToDecibels (peaks[(size_t) m].exchange (0.0f), silenceDb);
}

void Engine::storePeak (std::atomic<float>& slot, float peak)
{
    // Racy max with the reader's exchange, which at worst drops one block's peak. Fine for meters.
    if (peak > slot.load (std::memory_order_relaxed))
        slot.store (peak, std::memory_order_relaxed);
}

void Engine::audioDeviceAboutToStart (juce::AudioIODevice* device)
{
    gain.reset (device->getCurrentSampleRate(), 0.02);
    gain.setCurrentAndTargetValue (0.0f); // fade in from silence on start
}

void Engine::audioDeviceStopped() {}

void Engine::audioDeviceIOCallbackWithContext (const float* const* inputs, int numInputs,
                                               float* const* outputs, int numOutputs,
                                               int numSamples,
                                               const juce::AudioIODeviceCallbackContext&)
{
    const auto db = gainDb.load();
    const auto silent = muted.load() || panic.load() || db <= silenceDb;
    gain.setTargetValue (silent ? 0.0f : juce::Decibels::decibelsToGain (db, silenceDb));

    const float* in = numInputs > 0 ? inputs[0] : nullptr;
    float inPeak = 0.0f, outPeak = 0.0f;

    for (int i = 0; i < numSamples; ++i)
    {
        const auto x = in != nullptr ? in[i] : 0.0f;
        const auto y = x * gain.getNextValue();
        inPeak = std::max (inPeak, std::abs (x));
        outPeak = std::max (outPeak, std::abs (y));

        for (int ch = 0; ch < std::min (numOutputs, 2); ++ch)
            if (outputs[ch] != nullptr)
                outputs[ch][i] = y;
    }

    for (int ch = 2; ch < numOutputs; ++ch)
        if (outputs[ch] != nullptr)
            juce::FloatVectorOperations::clear (outputs[ch], numSamples);

    storePeak (peaks[in1], inPeak);
    storePeak (peaks[out1], numOutputs > 0 ? outPeak : 0.0f);
    storePeak (peaks[out2], numOutputs > 1 ? outPeak : 0.0f);
}

} // namespace glitch

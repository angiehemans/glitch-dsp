#pragma once

#include <juce_audio_devices/juce_audio_devices.h>
#include <juce_audio_basics/juce_audio_basics.h>

#include <array>
#include <atomic>

namespace glitch
{

// Owns the audio device. M0: input 1 -> outputs 1 and 2 with smoothed gain and mute.
// Audio thread rules: no allocation, locks or logging. Everything shared is atomic.
class Engine : private juce::AudioIODeviceCallback
{
public:
    enum Meter { in1, out1, out2, numMeters };

    static constexpr float silenceDb = -100.0f; // mirrors SILENCE_DB in packages/protocol

    Engine();
    ~Engine() override;

    void setGainDb (float db)        { gainDb.store (db); }
    void setMuted (bool shouldMute)  { muted.store (shouldMute); }
    void setPanic (bool shouldPanic) { panic.store (shouldPanic); }

    float getGainDb() const { return gainDb.load(); }
    bool isMuted() const    { return muted.load(); }
    bool isPanic() const    { return panic.load(); }

    /** Peak since the last call, in dBFS. Message thread only. */
    float takePeakDb (Meter m);
    double getCpuUsage() const { return deviceManager.getCpuUsage(); }

    juce::AudioDeviceManager& getDeviceManager() { return deviceManager; }
    juce::String getDeviceError() const { return deviceError; }

private:
    void audioDeviceIOCallbackWithContext (const float* const* inputs, int numInputs,
                                           float* const* outputs, int numOutputs,
                                           int numSamples,
                                           const juce::AudioIODeviceCallbackContext&) override;
    void audioDeviceAboutToStart (juce::AudioIODevice*) override;
    void audioDeviceStopped() override;

    static void storePeak (std::atomic<float>& slot, float peak);

    juce::AudioDeviceManager deviceManager;
    juce::String deviceError;

    std::atomic<float> gainDb { 0.0f };
    std::atomic<bool> muted { false };
    std::atomic<bool> panic { false };
    std::array<std::atomic<float>, numMeters> peaks {};

    juce::SmoothedValue<float> gain; // audio thread only

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (Engine)
};

} // namespace glitch

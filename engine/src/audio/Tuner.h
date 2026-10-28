#pragma once

#include <juce_audio_basics/juce_audio_basics.h>
#include <juce_core/juce_core.h>

#include <atomic>
#include <vector>

namespace glitch
{

/** The fundamental of a window of mono audio by YIN (de Cheveigné & Kawahara, 2002), in Hz, or 0
    when there's no clear pitch (silence, noise, chords). Looks for 25 Hz to 1.5 kHz. */
float detectPitch (const float* samples, int numSamples, double sampleRate);

// The tuner: the audio thread pushes the tuner input's samples (push, real-time safe: it only copies
// into a lock-free FIFO, dropping what doesn't fit), and a background thread runs detectPitch on the
// most recent window about 25 times a second. getHz is the latest reading, for the message thread.
class Tuner final : private juce::Thread
{
public:
    Tuner();
    ~Tuner() override;

    void start (double sampleRate);
    void stop();
    bool isRunning() const { return running.load(); }

    void push (const float* samples, int numSamples); // audio thread
    float getHz() const { return hz.load(); }

private:
    void run() override;

    static constexpr int window = 4096; // two periods of 25 Hz at 48 kHz, enough for a bass's low B

    juce::AbstractFifo fifo { 1 << 15 };
    std::vector<float> fifoData = std::vector<float> (1 << 15);
    std::vector<float> history = std::vector<float> (window); // the thread's latest window, oldest first
    std::atomic<bool> running { false };
    std::atomic<float> hz { 0.0f };
    double rate = 48000.0;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (Tuner)
};

} // namespace glitch

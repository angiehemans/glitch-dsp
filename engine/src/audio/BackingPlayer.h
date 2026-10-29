#pragma once

#include <juce_audio_formats/juce_audio_formats.h>
#include <juce_audio_processors/juce_audio_processors.h>

#include <atomic>
#include <memory>
#include <vector>

namespace glitch
{

// A song's tracks, streamed from disk and played together: each track's file is read ahead on a
// background thread (BufferingAudioSource), resampled when its rate isn't the device's, and comes
// out on its own pair of outputs (track i on 2i, 2i + 1), which the engine feeds to the output mixer.
// All tracks start from the same sample and advance together, so they stay sample-locked. Message
// thread for everything public, except what processBlock reads (atomics, and the tracks under lock).
class BackingPlayer final : public juce::AudioProcessor
{
public:
    static constexpr int maxTracks = 16; // the plan's soft limit per song

    BackingPlayer();
    ~BackingPlayer() override;

    /** Replaces the song: opens each file (a mono one plays on both outputs). Stops, at the start.
        Returns the files that couldn't be opened. Instant when these files were preloaded. */
    juce::StringArray load (const juce::Array<juce::File>& files);
    /** Opens and starts reading ahead a song that may come next (a setlist's), so load() of the
        same files swaps it in without waiting for the disk. Replaces any earlier preload. */
    void preload (const juce::Array<juce::File>& files);
    void play();
    void stop(); // keeps the position
    void restart(); // to the start, playing or not

    bool isPlaying() const { return playing.load(); }
    double getPositionSeconds() const;
    double getLengthSeconds() const;
    int getNumTracks() const;

    void prepareToPlay (double sampleRate, int maximumBlockSize) override;
    void releaseResources() override;
    void processBlock (juce::AudioBuffer<float>&, juce::MidiBuffer&) override;
    using AudioProcessor::processBlock;

    const juce::String getName() const override { return "Backing tracks"; }
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
    struct Track
    {
        std::unique_ptr<juce::BufferingAudioSource> buffered; // owns the reader source
        std::unique_ptr<juce::ResamplingAudioSource> resampled; // reads from buffered; null when rates match
        double fileRate = 0;
        juce::int64 fileLength = 0; // in the file's samples
        juce::AudioSource& out() { return resampled != nullptr ? (juce::AudioSource&) *resampled : *buffered; }
    };

    std::vector<Track> open (const juce::Array<juce::File>&, juce::StringArray& failed);
    void prepare (Track&); // read-ahead at its file's rate, resampling to the device's
    juce::int64 lengthOf (const std::vector<Track>&) const;
    void seek (juce::int64 devicePosition); // with the lock held

    juce::AudioFormatManager formats;
    juce::TimeSliceThread readAhead { "Backing tracks" };
    juce::CriticalSection lock; // the audio thread only tries it, and plays silence if it's taken
    std::vector<Track> tracks;
    std::vector<Track> preloaded; // message thread only: the audio thread never sees these
    juce::Array<juce::File> preloadedFiles;
    std::atomic<bool> playing { false };
    std::atomic<juce::int64> position { 0 }; // in device samples
    std::atomic<juce::int64> length { 0 };   // in device samples: the longest track
    double rate = 48000.0;
    int blockSize = 512;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (BackingPlayer)
};

} // namespace glitch

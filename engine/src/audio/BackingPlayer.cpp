#include "BackingPlayer.h"

namespace glitch
{

BackingPlayer::BackingPlayer()
    : AudioProcessor (BusesProperties().withOutput ("Tracks", juce::AudioChannelSet::discreteChannels (maxTracks * 2)))
{
    formats.registerBasicFormats(); // WAV and AIFF, as the plan's v1 handles
    readAhead.startThread();
}

BackingPlayer::~BackingPlayer()
{
    {
        const juce::ScopedLock sl (lock);
        tracks.clear(); // before the thread that reads ahead for them
    }
    readAhead.stopThread (2000);
}

juce::StringArray BackingPlayer::load (const juce::Array<juce::File>& files)
{
    playing = false;
    juce::StringArray failed;
    // Preloaded: already open and read ahead from the start. Otherwise, open now.
    auto loaded = files == preloadedFiles && ! preloaded.empty() ? std::move (preloaded) : open (files, failed);
    preloaded.clear();
    preloadedFiles.clear();

    {
        const juce::ScopedLock sl (lock);
        std::swap (tracks, loaded);
        length = lengthOf (tracks);
        position = 0; // fresh sources start at the start
    }
    return failed; // the old tracks go here, outside the lock
}

void BackingPlayer::preload (const juce::Array<juce::File>& files)
{
    if (files == preloadedFiles)
        return;
    juce::StringArray failed; // load() reports them, if this song is played
    preloaded = open (files, failed);
    preloadedFiles = files;
}

std::vector<BackingPlayer::Track> BackingPlayer::open (const juce::Array<juce::File>& files, juce::StringArray& failed)
{
    std::vector<Track> loaded;
    for (const auto& file : files)
    {
        if ((int) loaded.size() >= maxTracks)
        {
            failed.add (file.getFileName() + " (more than " + juce::String (maxTracks) + " tracks)");
            continue;
        }
        auto* reader = formats.createReaderFor (file);
        if (reader == nullptr)
        {
            failed.add (file.getFileName());
            continue;
        }

        Track t;
        t.fileRate = reader->sampleRate;
        t.fileLength = reader->lengthInSamples;
        auto* source = new juce::AudioFormatReaderSource (reader, true);
        t.buffered = std::make_unique<juce::BufferingAudioSource> (source, readAhead, true, (int) (2 * t.fileRate), 2);
        prepare (t);
        loaded.push_back (std::move (t));
    }
    return loaded;
}

void BackingPlayer::prepare (Track& t)
{
    t.buffered->prepareToPlay (blockSize, t.fileRate);
    if (std::abs (t.fileRate - rate) > 0.5)
    {
        if (t.resampled == nullptr)
            t.resampled = std::make_unique<juce::ResamplingAudioSource> (t.buffered.get(), false, 2);
        t.resampled->setResamplingRatio (t.fileRate / rate);
        t.resampled->prepareToPlay (blockSize, rate);
    }
    else
    {
        t.resampled = nullptr;
    }
}

juce::int64 BackingPlayer::lengthOf (const std::vector<Track>& list) const
{
    juce::int64 longest = 0;
    for (const auto& t : list)
        longest = std::max (longest, (juce::int64) ((double) t.fileLength * rate / t.fileRate));
    return longest;
}

void BackingPlayer::seek (juce::int64 devicePosition)
{
    for (auto& t : tracks)
    {
        t.buffered->setNextReadPosition ((juce::int64) ((double) devicePosition * t.fileRate / rate));
        if (t.resampled != nullptr)
            t.resampled->flushBuffers();
    }
    position = devicePosition;
}

void BackingPlayer::play()
{
    {
        const juce::ScopedLock sl (lock);
        if (tracks.empty())
            return;
        if (position.load() >= length.load())
            seek (0); // at the end: play from the start
    }

    // After a seek the read-ahead refills in the background: wait (a little, half a second at most
    // for the whole song) until every track has its first quarter second, or it would start with a
    // gap. No lock: the audio thread doesn't read the tracks until playing, and this is the only
    // other thread that touches them.
    juce::AudioBuffer<float> scratch (2, (int) (0.25 * rate));
    const auto deadline = juce::Time::getMillisecondCounter() + 500;
    for (auto& t : tracks)
    {
        const auto left = (int) deadline - (int) juce::Time::getMillisecondCounter();
        if (left <= 0)
            break;
        t.buffered->waitForNextAudioBlockReady ({ &scratch, 0, (int) (0.25 * t.fileRate) }, left);
    }
    playing = true;
}

void BackingPlayer::stop()
{
    playing = false;
}

void BackingPlayer::restart()
{
    const juce::ScopedLock sl (lock);
    seek (0);
}

double BackingPlayer::getPositionSeconds() const { return (double) position.load() / rate; }
double BackingPlayer::getLengthSeconds() const   { return (double) length.load() / rate; }

int BackingPlayer::getNumTracks() const
{
    const juce::ScopedLock sl (lock);
    return (int) tracks.size();
}

void BackingPlayer::prepareToPlay (double sampleRate, int maximumBlockSize)
{
    const juce::ScopedLock sl (lock);
    const auto at = (double) position.load() / rate; // keep the place in the song across a rate change
    rate = sampleRate;
    blockSize = maximumBlockSize;
    for (auto* list : { &tracks, &preloaded })
        for (auto& t : *list)
            prepare (t);
    length = lengthOf (tracks);
    seek ((juce::int64) (at * rate));
}

void BackingPlayer::releaseResources()
{
    const juce::ScopedLock sl (lock);
    for (auto& t : tracks)
        t.out().releaseResources();
}

void BackingPlayer::processBlock (juce::AudioBuffer<float>& buffer, juce::MidiBuffer&)
{
    const auto numSamples = buffer.getNumSamples();
    buffer.clear();
    if (! playing.load())
        return;

    const juce::ScopedTryLock sl (lock);
    if (! sl.isLocked())
        return; // a song is being swapped in: this block is silent

    // Every track reads the same number of samples each block, so they stay together.
    for (int i = 0; i < (int) tracks.size() && i * 2 + 1 < buffer.getNumChannels(); ++i)
    {
        juce::AudioBuffer<float> pair (buffer.getArrayOfWritePointers() + i * 2, 2, numSamples);
        tracks[(size_t) i].out().getNextAudioBlock ({ &pair, 0, numSamples });
    }

    if (position.fetch_add (numSamples) + numSamples >= length.load())
        playing = false; // the song ends with its longest track
}

} // namespace glitch

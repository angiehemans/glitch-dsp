#pragma once

#include <juce_audio_formats/juce_audio_formats.h>

namespace glitch
{

// The library's songs (plan §7): <app data>/library/songs/<id>/song.json, with the song's audio files
// copied in beside it, so projects keep working if the originals move. And its standalone setlists
// (owner "library"), in <app data>/library/setlists.json; a project plays its own copy of one. A song is a title and its
// tracks ({ id, name, file, channels, role, defaultLevel }); how tracks are routed belongs to each
// project (its trackMix), not the song. Message thread only.
class SongLibrary
{
public:
    explicit SongLibrary (const juce::File& dataDir);
    ~SongLibrary();

    /** Every song, oldest first, as the UI sees them (plus length, in seconds). */
    juce::var getSongs() const;
    juce::var find (const juce::String& songId) const;
    /** The audio files of a song's tracks, in track order. */
    juce::Array<juce::File> getFiles (const juce::var& song) const;

    /** Copies WAV or AIFF files in as a new song (one track each), titled after their folder.
        Returns it, or void when none could be read; failed lists those that couldn't. */
    juce::var import (const juce::Array<juce::File>& files, juce::StringArray& failed);
    /** Songs saved before waveforms existed get theirs on a background thread, one at a time;
        done() runs on the message thread after each. */
    void fillWaveforms (std::function<void()> done);

    /** Copies WAV or AIFF files into a song as more tracks. False when none could be added. */
    bool addTracks (const juce::String& songId, const juce::Array<juce::File>& files, juce::StringArray& failed);
    bool rename (const juce::String& songId, const juce::String& title);
    /** Deletes the song and its files. */
    bool remove (const juce::String& songId);

    /** The standalone setlists, as an array var: edit them in place, then saveSetlists(). */
    juce::var getSetlists() const { return setlists; }
    void saveSetlists() const;

private:
    juce::File folder (const juce::String& songId) const { return root.getChildFile (songId); }
    void save (const juce::var& song) const;
    /** The song's outline for the Perform view: peaks of all its tracks together, 0-100, in waveformBuckets steps. */
    static juce::Array<juce::var> waveformOf (const juce::Array<juce::File>& files, double length);
    static constexpr int waveformBuckets = 240;
    /** Copies the readable files into dir as track entries; length grows to the longest. */
    juce::Array<juce::var> copyTracks (const juce::File& dir, const juce::Array<juce::File>& files, int numTracks,
                                       double& length, juce::StringArray& failed);

    const juce::File root;
    juce::AudioFormatManager formats;
    juce::Array<juce::var> songs;
    juce::var setlists;
    juce::ThreadPool waveformJobs { 1 };
    std::shared_ptr<bool> alive = std::make_shared<bool> (true); // jobs' results are dropped once this is gone
};

} // namespace glitch

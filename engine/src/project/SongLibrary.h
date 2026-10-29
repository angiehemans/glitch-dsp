#pragma once

#include <juce_audio_formats/juce_audio_formats.h>

namespace glitch
{

// The library's songs (plan §7): <app data>/library/songs/<id>/song.json, with the song's audio files
// copied in beside it, so projects keep working if the originals move. A song is a title and its
// tracks ({ id, name, file, channels, role, defaultLevel }); how tracks are routed belongs to each
// project (its trackMix), not the song. Message thread only.
class SongLibrary
{
public:
    explicit SongLibrary (const juce::File& dataDir);

    /** Every song, oldest first, as the UI sees them (plus length, in seconds). */
    juce::var getSongs() const;
    juce::var find (const juce::String& songId) const;
    /** The audio files of a song's tracks, in track order. */
    juce::Array<juce::File> getFiles (const juce::var& song) const;

    /** Copies WAV or AIFF files in as a new song (one track each), titled after their folder.
        Returns it, or void when none could be read; failed lists those that couldn't. */
    juce::var import (const juce::Array<juce::File>& files, juce::StringArray& failed);
    bool rename (const juce::String& songId, const juce::String& title);
    /** Deletes the song and its files. */
    bool remove (const juce::String& songId);

private:
    juce::File folder (const juce::String& songId) const { return root.getChildFile (songId); }
    void save (const juce::var& song) const;

    const juce::File root;
    juce::AudioFormatManager formats;
    juce::Array<juce::var> songs;
};

} // namespace glitch

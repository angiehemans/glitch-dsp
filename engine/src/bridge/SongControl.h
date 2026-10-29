#pragma once

#include "../audio/Engine.h"
#include "../project/ProjectStore.h"
#include "../project/SongLibrary.h"

#include <functional>

namespace glitch
{

// Backing tracks and setlists: the project's current song (its songId) in the player, routed by
// its trackMix, and the project's setlists (setlistId is the one it's on). Message thread only.
class SongControl
{
public:
    SongControl (Engine&, ProjectStore&);

    std::function<void (const juce::String&)> onError;
    std::function<void()> onChanged; // after an import finishes, so the state is sent
    std::function<void (const juce::String&)> onLoadPreset; // a song's linked preset, when it's selected

    /** song.*, transport.*, trackMix.set and setlist.* commands. False after an error. */
    bool handleCommand (const juce::String& type, const juce::var& command);

    /** A track of the current song's mix entry: its sends, level and mute. Before it's edited it's the
        default (the project's main output); create stores that default in the project. */
    juce::var trackMixEntry (const juce::String& trackId, bool create);
    void applyTrackMix();
    void loadSong(); // the current song into the player, then its routes
    /** After a song played to its end: the setlist's next one, playing, when it auto-advances. */
    bool advanceAtEnd();

    juce::var getSongs() const { return songs.getSongs(); }
    juce::var getLibrarySetlists() const { return songs.getSetlists(); }

private:
    bool handleSetlistCommand (const juce::String& type, const juce::var& command);
    bool handleSongCommand (const juce::String& type, const juce::var& command);
    /** A file chooser for WAV/AIFF files, then then(files) and the state sent. One at a time. */
    void chooseAudio (const juce::String& title, std::function<void (const juce::Array<juce::File>&)> then);
    /** Chosen files as a new song: into "project" (the project's set, made current), a library setlist's id, or "" (library only). */
    void importSong (const juce::String& into);
    void addTracks (const juce::String& songId); // chosen files as more tracks of the song
    /** Made current and loaded ("" for none), with its linked preset unless that's already the rig's. */
    void selectSong (const juce::String& songId);
    void preloadNext(); // the setlist's next song, read ahead; never touches the current one
    juce::var currentSetlist() const;
    /** The project's set: its current setlist (or its first), made when create and there's none. */
    juce::var projectList (bool create);
    static juce::var newSetlist (const juce::String& name, const juce::var& owner);
    /** The current setlist's song step places from the current one (1 next, -1 previous), or "". */
    juce::String setlistNeighbour (int step) const;
    void sendError (const juce::String& message) { if (onError) onError (message); }

    Engine& engine;
    ProjectStore& store;
    SongLibrary songs { ProjectStore::getDataDir() };
    std::unique_ptr<juce::FileChooser> chooser;

    JUCE_DECLARE_NON_COPYABLE (SongControl)
};

} // namespace glitch

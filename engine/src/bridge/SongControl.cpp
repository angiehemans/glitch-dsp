#include "SongControl.h"
#include "Protocol.h"
#include "Vars.h"

namespace glitch
{

using namespace vars;

SongControl::SongControl (Engine& e, ProjectStore& s) : engine (e), store (s) {}

bool SongControl::handleCommand (const juce::String& type, const juce::var& command)
{
    return type.startsWith ("setlist.") ? handleSetlistCommand (type, command) : handleSongCommand (type, command);
}

bool SongControl::advanceAtEnd()
{
    auto& player = engine.getPlayer();
    if (player.isPlaying() || player.getPositionSeconds() < player.getLengthSeconds() - 0.05 || ! (bool) currentSetlist()["autoAdvance"])
        return false;
    const auto next = setlistNeighbour (1);
    if (next.isEmpty())
        return false;
    selectSong (next);
    player.play();
    return true;
}

juce::var SongControl::trackMixEntry (const juce::String& trackId, bool create)
{
    const auto project = store.getCurrent();
    const auto song = songs.find (project["songId"].toString());
    juce::var track;
    if (auto* tracks = song["tracks"].getArray())
        for (const auto& t : *tracks)
            if (t["id"].toString() == trackId)
                track = t;
    if (! track.isObject())
        return {};

    const auto songId = song["id"].toString();
    if (const auto existing = project["trackMix"][juce::Identifier (songId)][juce::Identifier (trackId)]; existing.isObject())
        return existing;

    // Not edited yet: the plan's default, to the project's main output at the track's own level.
    auto entry = object ({ { "outputs", juce::Array<juce::var> { newSend (project["mainOutput"].clone()) } },
                           { "level", track["defaultLevel"] }, { "pan", 0.0 }, { "mute", false } });
    if (create)
    {
        auto* mix = project["trackMix"].getDynamicObject();
        if (! project["trackMix"][juce::Identifier (songId)].isObject())
            mix->setProperty (songId, juce::var (new juce::DynamicObject()));
        project["trackMix"][juce::Identifier (songId)].getDynamicObject()->setProperty (trackId, entry);
        store.markDirty();
    }
    return entry;
}

void SongControl::applyTrackMix()
{
    const auto song = songs.find (store.getCurrent()["songId"].toString());
    const auto* tracks = song["tracks"].getArray();
    for (int i = 0; i < BackingPlayer::maxTracks; ++i)
    {
        std::vector<Engine::Send> sends;
        float level = 0;
        bool muted = true; // tracks the song doesn't have: silent
        if (tracks != nullptr && i < tracks->size())
        {
            const auto entry = trackMixEntry ((*tracks)[i]["id"].toString(), false);
            if (auto* outputs = entry["outputs"].getArray())
                for (const auto& o : *outputs)
                {
                    Engine::Send send { {}, (float) o["level"], (bool) o["mute"] };
                    if (auto* hw = o["hwChannels"].getArray())
                        for (const auto& ch : *hw)
                            send.outputs.push_back ((int) ch - 1);
                    sends.push_back (send);
                }
            level = (float) entry["level"];
            muted = (bool) entry["mute"];
        }
        engine.setTrackRoutes (i, sends, level, muted);
    }
}

void SongControl::loadSong()
{
    const auto song = songs.find (store.getCurrent()["songId"].toString());
    const auto failed = engine.getPlayer().load (songs.getFiles (song));
    if (! failed.isEmpty())
        sendError ("Couldn't open " + failed.joinIntoString (", "));
    applyTrackMix();
    preloadNext();
}

void SongControl::preloadNext()
{
    // The setlist's next song reads ahead now, so moving on to it doesn't wait for the disk. Only the
    // preload: reloading the current song would stop it.
    engine.getPlayer().preload (songs.getFiles (songs.find (setlistNeighbour (1))));
}

juce::var SongControl::currentSetlist() const
{
    const auto project = store.getCurrent();
    if (auto* lists = project["setlists"].getArray())
        for (const auto& l : *lists)
            if (l["id"] == project["setlistId"])
                return l;
    return {};
}

juce::String SongControl::setlistNeighbour (int step) const
{
    // The current setlist's songs that are still in the library, and the current song's place in it.
    juce::StringArray ids;
    if (auto* list = currentSetlist()["songs"].getArray())
        for (const auto& id : *list)
            if (songs.find (id.toString()).isObject())
                ids.add (id.toString());
    if (ids.isEmpty())
        return {};
    const auto at = ids.indexOf (store.getCurrent()["songId"].toString());
    if (at < 0)
        return step > 0 ? ids[0] : juce::String(); // not in the setlist yet: next is its first song
    return juce::isPositiveAndBelow (at + step, ids.size()) ? ids[at + step] : juce::String();
}

void SongControl::selectSong (const juce::String& songId)
{
    store.getCurrent().getDynamicObject()->setProperty ("songId", songId.isNotEmpty() ? juce::var (songId) : juce::var());
    store.markDirty();
    loadSong();
    // The preset already loaded stays as it is, tweaks and all.
    if (songId.isEmpty())
        return;
    const auto presetId = store.getCurrent()["songPresets"][juce::Identifier (songId)].toString();
    if (presetId.isNotEmpty() && presetId != store.getCurrentPresetId() && onLoadPreset)
        onLoadPreset (presetId);
}

bool SongControl::handleSetlistCommand (const juce::String& type, const juce::var& command)
{
    auto* lists = store.getCurrent()["setlists"].getArray();
    if (lists == nullptr)
    {
        sendError ("Open a project first");
        return false;
    }

    if (type == protocol::command::setlistCreate)
    {
        const auto name = cleanName (command["name"]);
        const auto setlist = object ({ { "id", juce::Uuid().toDashedString().substring (0, 8) },
                                       { "name", name.isNotEmpty() ? name : "Setlist " + juce::String (lists->size() + 1) },
                                       { "owner", store.getCurrent()["id"] }, { "songs", juce::Array<juce::var>() },
                                       { "autoAdvance", false } });
        lists->add (setlist);
        store.getCurrent().getDynamicObject()->setProperty ("setlistId", setlist["id"]);
        store.markDirty();
        return true;
    }

    juce::var setlist;
    for (const auto& l : *lists)
        if (l["id"].toString() == command["setlistId"].toString())
            setlist = l;
    if (! setlist.isObject() && ! (type == protocol::command::setlistSelect && command["setlistId"].isVoid()))
    {
        sendError ("Unknown setlist: " + command["setlistId"].toString());
        return false;
    }
    auto* songIds = setlist["songs"].getArray();
    const auto index = (int) command["index"];

    if (type == protocol::command::setlistSelect)
    {
        store.getCurrent().getDynamicObject()->setProperty ("setlistId", setlist.isObject() ? setlist["id"] : juce::var());
        preloadNext();
    }
    else if (type == protocol::command::setlistRename)
    {
        const auto name = cleanName (command["name"]);
        if (name.isEmpty())
        {
            sendError ("A setlist needs a name");
            return false;
        }
        setlist.getDynamicObject()->setProperty ("name", name);
    }
    else if (type == protocol::command::setlistDelete)
    {
        lists->removeAllInstancesOf (setlist);
        if (store.getCurrent()["setlistId"] == setlist["id"])
            store.getCurrent().getDynamicObject()->removeProperty ("setlistId");
        preloadNext();
    }
    else if (type == protocol::command::setlistAddSong)
    {
        if (! songs.find (command["songId"].toString()).isObject())
        {
            sendError ("Unknown song: " + command["songId"].toString());
            return false;
        }
        songIds->insert (command["index"].isVoid() ? songIds->size() : juce::jlimit (0, songIds->size(), index), command["songId"].toString());
        preloadNext(); // it may be the next song now
    }
    else if (type == protocol::command::setlistRemoveSong || type == protocol::command::setlistMoveSong)
    {
        if (! juce::isPositiveAndBelow (index, songIds->size()))
        {
            sendError ("No song at that place in the setlist");
            return false;
        }
        const auto id = (*songIds)[index];
        songIds->remove (index);
        if (type == protocol::command::setlistMoveSong)
            songIds->insert (juce::jlimit (0, songIds->size(), (int) command["to"]), id);
        preloadNext();
    }
    else if (type == protocol::command::setlistSetAutoAdvance)
    {
        setlist.getDynamicObject()->setProperty ("autoAdvance", (bool) command["on"]);
    }
    else
    {
        sendError ("Unknown command: " + type);
        return false;
    }
    store.markDirty();
    return true;
}

void SongControl::importSong()
{
    if (chooser != nullptr)
        return; // already open
    chooser = std::make_unique<juce::FileChooser> ("Choose a song's audio files (WAV or AIFF): one track each",
                                                   juce::File::getSpecialLocation (juce::File::userMusicDirectory), "*.wav;*.aif;*.aiff");
    chooser->launchAsync (juce::FileBrowserComponent::openMode | juce::FileBrowserComponent::canSelectFiles
                              | juce::FileBrowserComponent::canSelectMultipleItems,
                          [this] (const juce::FileChooser& fc) // the chooser, and its callback, go with this
                          {
                              const auto files = fc.getResults();
                              chooser = nullptr;
                              if (files.isEmpty())
                                  return;

                              juce::StringArray failed;
                              const auto song = songs.import (files, failed);
                              if (! failed.isEmpty())
                                  sendError ("Couldn't import " + failed.joinIntoString (", "));
                              if (song.isObject() && store.getCurrent().isObject())
                              {
                                  store.getCurrent().getDynamicObject()->setProperty ("songId", song["id"]);
                                  store.markDirty();
                                  loadSong();
                              }
                              if (onChanged)
                                  onChanged();
                          });
}

bool SongControl::handleSongCommand (const juce::String& type, const juce::var& command)
{
    auto& player = engine.getPlayer();
    const auto songId = command["songId"].toString();

    if (type == protocol::command::songImport)
    {
        if (! store.getCurrent().isObject())
        {
            sendError ("Open a project first");
            return false;
        }
        importSong();
    }
    else if (type == protocol::command::songSelect)
    {
        auto* project = store.getCurrent().getDynamicObject();
        if (project == nullptr || (songId.isNotEmpty() && ! songs.find (songId).isObject()))
        {
            sendError (project == nullptr ? "Open a project first" : "Unknown song: " + songId);
            return false;
        }
        selectSong (songId);
    }
    else if (type == protocol::command::transportNext || type == protocol::command::transportPrev)
    {
        // Within the current setlist; the song is cued (stopped, at its start).
        const auto id = setlistNeighbour (type == protocol::command::transportNext ? 1 : -1);
        if (id.isEmpty())
        {
            sendError (currentSetlist().isObject() ? "That's the end of the setlist" : "Choose a setlist first");
            return false;
        }
        selectSong (id);
    }
    else if (type == protocol::command::songRename)
    {
        const auto title = cleanName (command["title"]);
        if (title.isEmpty() || ! songs.rename (songId, title))
        {
            sendError (title.isEmpty() ? "A song needs a title" : "Unknown song: " + songId);
            return false;
        }
    }
    else if (type == protocol::command::songSetPreset)
    {
        auto* links = store.getCurrent()["songPresets"].getDynamicObject();
        const auto presetId = command["presetId"].toString();
        if (links == nullptr || ! songs.find (songId).isObject())
        {
            sendError (links == nullptr ? "Open a project first" : "Unknown song: " + songId);
            return false;
        }
        const auto* presets = store.getPresetSummaries().getArray();
        if (presetId.isNotEmpty()
            && std::none_of (presets->begin(), presets->end(), [&] (const juce::var& p) { return p["id"].toString() == presetId; }))
        {
            sendError ("Unknown preset: " + presetId);
            return false;
        }
        if (presetId.isEmpty())
            links->removeProperty (songId);
        else
            links->setProperty (songId, presetId);
        store.markDirty();
    }
    else if (type == protocol::command::songDelete)
    {
        const auto current = store.getCurrent()["songId"].toString() == songId;
        if (! songs.remove (songId))
        {
            sendError ("Unknown song: " + songId);
            return false;
        }
        if (current)
        {
            store.getCurrent().getDynamicObject()->removeProperty ("songId");
            store.markDirty();
            loadSong(); // its files are gone: nothing to play
        }
        else
        {
            preloadNext(); // it may have been the next song
        }
    }
    else if (type == protocol::command::trackMixSet)
    {
        const auto entry = trackMixEntry (command["trackId"].toString(), true);
        if (! entry.isObject())
        {
            sendError ("That track isn't in the current song");
            return false;
        }
        if (! command["outputs"].isVoid())
        {
            // The Songs tab's output menu, a shortcut like a chain's chip: it sets the first send.
            const auto hwChannels = outputChannels (command["outputs"]);
            if (hwChannels.isEmpty())
            {
                sendError ("Invalid output channels");
                return false;
            }
            auto* sends = entry["outputs"].getArray();
            if (sends->isEmpty())
                sends->add (newSend (hwChannels));
            else
                (*sends)[0].getDynamicObject()->setProperty ("hwChannels", hwChannels);
        }
        if (! command["level"].isVoid())
            entry.getDynamicObject()->setProperty ("level", juce::jlimit (Engine::silenceDb, 10.0f, (float) command["level"]));
        if (! command["mute"].isVoid())
            entry.getDynamicObject()->setProperty ("mute", (bool) command["mute"]);
        store.markDirty();
        applyTrackMix();
    }
    else if (type == protocol::command::transportPlay)
    {
        player.play();
    }
    else if (type == protocol::command::transportStop)
    {
        player.stop();
    }
    else if (type == protocol::command::transportRestart)
    {
        player.restart();
    }
    else
    {
        sendError ("Unknown command: " + type);
        return false;
    }
    return true;
}

} // namespace glitch

#include "SongLibrary.h"

#include <juce_events/juce_events.h>

namespace glitch
{

namespace
{
    juce::var object (std::initializer_list<std::pair<const char*, juce::var>> properties)
    {
        auto result = juce::var (new juce::DynamicObject());
        for (const auto& [key, value] : properties)
            result.getDynamicObject()->setProperty (key, value);
        return result;
    }

    /** A guess from the file name, which the UI can show; the plan's roles. */
    juce::String roleFor (const juce::String& name, int numFiles)
    {
        const auto lower = name.toLowerCase();
        if (lower.contains ("click") || lower.contains ("metronome"))
            return "click";
        if (lower.contains ("cue") || lower.contains ("guide") || lower.contains ("count"))
            return "cue";
        return numFiles == 1 || lower.contains ("backing") || lower.contains ("mix") ? "backing" : "stem";
    }
}

SongLibrary::SongLibrary (const juce::File& dataDir)
    : root (dataDir.getChildFile ("library").getChildFile ("songs"))
{
    formats.registerBasicFormats();
    root.createDirectory();
    for (const auto& file : root.findChildFiles (juce::File::findFiles, true, "song.json"))
    {
        const auto song = juce::JSON::parse (file);
        if (song["id"].toString() == file.getParentDirectory().getFileName() && song["tracks"].isArray())
            songs.add (song);
    }
    std::sort (songs.begin(), songs.end(), [] (const auto& a, const auto& b) { return (juce::int64) a["createdAt"] < (juce::int64) b["createdAt"]; });

    setlists = juce::JSON::parse (root.getSiblingFile ("setlists.json"));
    if (! setlists.isArray())
        setlists = juce::Array<juce::var>();
}

void SongLibrary::saveSetlists() const
{
    const auto file = root.getSiblingFile ("setlists.json");
    juce::TemporaryFile temp (file);
    if (temp.getFile().replaceWithText (juce::JSON::toString (setlists)))
        temp.overwriteTargetFileWithTemporary();
}

juce::var SongLibrary::getSongs() const
{
    return juce::Array<juce::var> (songs);
}

juce::var SongLibrary::find (const juce::String& songId) const
{
    for (const auto& s : songs)
        if (s["id"].toString() == songId)
            return s;
    return {};
}

SongLibrary::~SongLibrary()
{
    *alive = false;
    waveformJobs.removeAllJobs (true, 10000);
}

juce::Array<juce::var> SongLibrary::waveformOf (const juce::Array<juce::File>& files, double length)
{
    juce::AudioFormatManager formats; // its own: this runs on the waveform thread too
    formats.registerBasicFormats();
    std::array<float, waveformBuckets> peaks {};
    for (const auto& file : files)
    {
        std::unique_ptr<juce::AudioFormatReader> reader (formats.createReaderFor (file));
        if (reader == nullptr || length <= 0)
            continue;
        std::vector<juce::Range<float>> levels ((size_t) reader->numChannels);
        for (int b = 0; b < waveformBuckets; ++b)
        {
            // The same stretch of time in every track, whatever its rate.
            const auto start = (juce::int64) (length * b / waveformBuckets * reader->sampleRate);
            const auto end = std::min ((juce::int64) (length * (b + 1) / waveformBuckets * reader->sampleRate), reader->lengthInSamples);
            if (end <= start)
                break;
            reader->readMaxLevels (start, end - start, levels.data(), (int) reader->numChannels);
            for (const auto& r : levels)
                peaks[(size_t) b] = std::max ({ peaks[(size_t) b], r.getEnd(), -r.getStart() });
        }
    }
    const auto loudest = *std::max_element (peaks.begin(), peaks.end());
    juce::Array<juce::var> result;
    for (const auto p : peaks)
        result.add (loudest > 0 ? juce::roundToInt (100.0f * p / loudest) : 0);
    return result;
}

void SongLibrary::fillWaveforms (std::function<void()> done)
{
    for (const auto& song : songs)
    {
        if (song["waveform"].isArray())
            continue;
        // Read on the message thread; the job only touches its own copies.
        const auto id = song["id"].toString();
        const auto files = getFiles (song);
        const auto length = (double) song["length"];
        waveformJobs.addJob ([this, id, files, length, done, alive = std::weak_ptr<bool> (alive)]
        {
            const auto waveform = waveformOf (files, length);
            juce::MessageManager::callAsync ([this, id, waveform, done, alive]
            {
                if (alive.expired() || ! *alive.lock())
                    return;
                if (const auto song = find (id); song.isObject())
                {
                    song.getDynamicObject()->setProperty ("waveform", waveform);
                    save (song);
                    done();
                }
            });
        });
    }
}

juce::Array<juce::File> SongLibrary::getFiles (const juce::var& song) const
{
    juce::Array<juce::File> files;
    if (auto* tracks = song["tracks"].getArray())
        for (const auto& t : *tracks)
        {
            // A name from the song's own file, never a path that leaves its folder.
            const auto file = folder (song["id"].toString()).getChildFile (juce::File::createLegalFileName (t["file"].toString()));
            files.add (file);
        }
    return files;
}

juce::Array<juce::var> SongLibrary::copyTracks (const juce::File& dir, const juce::Array<juce::File>& files, int numTracks,
                                               double& length, juce::StringArray& failed)
{
    juce::Array<juce::var> tracks;
    for (const auto& file : files)
    {
        std::unique_ptr<juce::AudioFormatReader> reader (formats.createReaderFor (file));
        if (reader == nullptr || reader->sampleRate <= 0)
        {
            failed.add (file.getFileName());
            continue;
        }
        const auto copy = dir.getNonexistentChildFile (file.getFileNameWithoutExtension(), file.getFileExtension(), false);
        if (! file.copyFileTo (copy))
        {
            failed.add (file.getFileName());
            continue;
        }
        length = std::max (length, (double) reader->lengthInSamples / reader->sampleRate);
        tracks.add (object ({ { "id", juce::Uuid().toDashedString().substring (0, 8) },
                              { "name", file.getFileNameWithoutExtension() },
                              { "file", copy.getFileName() },
                              { "channels", (int) reader->numChannels },
                              { "role", roleFor (file.getFileNameWithoutExtension(), numTracks) },
                              { "defaultLevel", 0.0 } }));
    }
    return tracks;
}

juce::var SongLibrary::import (const juce::Array<juce::File>& files, juce::StringArray& failed)
{
    const auto id = juce::Uuid().toDashedString().substring (0, 8);
    const auto dir = folder (id);
    dir.createDirectory();

    double length = 0;
    const auto tracks = copyTracks (dir, files, files.size(), length, failed);
    if (tracks.isEmpty())
    {
        dir.deleteRecursively();
        return {};
    }

    // Stems usually arrive as a folder per song: its name is the best title there is.
    const auto first = files.getFirst();
    const auto title = files.size() > 1 ? first.getParentDirectory().getFileName() : first.getFileNameWithoutExtension();
    const auto song = object ({ { "id", id }, { "title", title }, { "length", length },
                                { "createdAt", juce::Time::currentTimeMillis() }, { "tracks", tracks } });
    song.getDynamicObject()->setProperty ("waveform", waveformOf (getFiles (song), length));
    save (song);
    songs.add (song);
    return song;
}

bool SongLibrary::addTracks (const juce::String& songId, const juce::Array<juce::File>& files, juce::StringArray& failed)
{
    const auto song = find (songId);
    auto* tracks = song["tracks"].getArray();
    if (tracks == nullptr)
        return false;
    double length = song["length"];
    const auto added = copyTracks (folder (songId), files, tracks->size() + files.size(), length, failed);
    if (added.isEmpty())
        return false;
    tracks->addArray (added);
    song.getDynamicObject()->setProperty ("length", length);
    song.getDynamicObject()->setProperty ("waveform", waveformOf (getFiles (song), length));
    save (song);
    return true;
}

bool SongLibrary::rename (const juce::String& songId, const juce::String& title)
{
    const auto song = find (songId);
    if (! song.isObject())
        return false;
    song.getDynamicObject()->setProperty ("title", title);
    save (song);
    return true;
}

bool SongLibrary::remove (const juce::String& songId)
{
    const auto song = find (songId);
    if (! song.isObject())
        return false;
    songs.removeAllInstancesOf (song);
    folder (songId).deleteRecursively();
    return true;
}

void SongLibrary::save (const juce::var& song) const
{
    const auto file = folder (song["id"].toString()).getChildFile ("song.json");
    juce::TemporaryFile temp (file);
    if (temp.getFile().replaceWithText (juce::JSON::toString (song)))
        temp.overwriteTargetFileWithTemporary();
}

} // namespace glitch

#include "ModelLibrary.h"

namespace glitch
{

namespace
{
    const juce::String namPattern = "*.nam";
    const juce::String irPattern = "*.wav;*.aif;*.aiff";
}

ModelLibrary::ModelLibrary (juce::File dataDir)
    : root (dataDir.getChildFile ("library"))
{
    for (const auto kind : { Kind::nam, Kind::ir })
        folder (kind).createDirectory();
    refresh();
}

void ModelLibrary::refresh()
{
    for (const auto kind : { Kind::nam, Kind::ir })
    {
        auto& list = kind == Kind::nam ? models : irs;
        list.clear();

        // Subfolders are fine, so a library can be organised by amp or by cab.
        auto files = folder (kind).findChildFiles (juce::File::findFiles, true, kind == Kind::nam ? namPattern : irPattern);
        files.sort();
        for (const auto& f : files)
            list.add ({ f.getRelativePathFrom (root).replaceCharacter ('\\', '/'), f.getFileNameWithoutExtension() });
    }
}

juce::File ModelLibrary::resolve (const juce::String& id) const
{
    // Ids come from the UI and from project files: never let one reach outside the library.
    const auto file = root.getChildFile (id);
    return id.isNotEmpty() && file.isAChildOf (root) && file.existsAsFile() ? file : juce::File();
}

std::optional<ModelLibrary::Kind> ModelLibrary::kindOf (const juce::File& file)
{
    if (file.isDirectory())
        return std::nullopt;
    if (file.hasFileExtension (".nam"))
        return Kind::nam;
    if (file.hasFileExtension (".wav;.aif;.aiff"))
        return Kind::ir;
    return std::nullopt;
}

juce::StringArray ModelLibrary::import (const juce::Array<juce::File>& files)
{
    juce::StringArray failed;

    for (const auto& file : files)
    {
        const auto kind = kindOf (file);
        if (! kind.has_value())
            continue;

        const auto dest = folder (*kind).getNonexistentChildFile (file.getFileNameWithoutExtension(), file.getFileExtension(), false);
        if (! file.copyFileTo (dest))
            failed.add (file.getFileName());
    }

    refresh();
    return failed;
}

} // namespace glitch

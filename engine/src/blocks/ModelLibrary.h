#pragma once

#include <juce_core/juce_core.h>

#include <optional>

namespace glitch
{

// The user's NAM models and cabinet IRs: <app data>/library/nam and library/ir, per the plan.
// Imports are copied in, so projects keep working if the originals move; blocks refer to files by
// their path inside the library ("nam/Plexi.nam"). Message thread only.
class ModelLibrary
{
public:
    enum class Kind { nam, ir };

    struct Entry
    {
        juce::String id;   // path inside the library, e.g. "nam/Plexi.nam"
        juce::String name; // file name without extension
    };

    explicit ModelLibrary (juce::File dataDir);

    const juce::Array<Entry>& get (Kind kind) const { return kind == Kind::nam ? models : irs; }

    /** Re-reads the folders (after an import, or when the user scans). */
    void refresh();

    /** The file for an id, or {} if the id points outside the library or names nothing. */
    juce::File resolve (const juce::String& id) const;

    /** What a file would be imported as, if anything. */
    static std::optional<Kind> kindOf (const juce::File&);

    /** Copies model and IR files in (a clash gets a numbered name). Returns the ones that failed. */
    juce::StringArray import (const juce::Array<juce::File>& files);

private:
    juce::File folder (Kind kind) const { return root.getChildFile (kind == Kind::nam ? "nam" : "ir"); }

    const juce::File root;
    juce::Array<Entry> models, irs;
};

} // namespace glitch

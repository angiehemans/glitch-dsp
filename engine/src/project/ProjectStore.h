#pragma once

#include <juce_core/juce_core.h>

namespace glitch
{

// Projects and their chains, kept as JSON-shaped vars (the same shape the UI receives, see
// packages/protocol/src/model.ts) and saved to <app data>/Glitch/projects/<id>/project.json.
// Message thread only.
class ProjectStore
{
public:
    ProjectStore();
    ~ProjectStore(); // saves pending changes

    /** Summaries, most recently opened first. */
    juce::var getSummaries() const;

    /** The open project, or a void var. */
    juce::var getCurrent() const { return current; }
    juce::Array<juce::var>* getCurrentChains() const;
    juce::var findChain (const juce::String& chainId) const;

    void create (const juce::String& name); // and opens it
    bool open (const juce::String& projectId);
    /** Any project, open or not; one that isn't open is saved straight away. */
    bool renameProject (const juce::String& projectId, const juce::String& name);
    juce::var addChain (const juce::String& name);
    /** Removes a chain of the open project, with its blocks' saved states and snapshots. */
    void removeChain (const juce::String& chainId);

    /** Blocks of the open project, including those inside ABY paths. */
    juce::var findBlock (const juce::String& blockId) const;
    void addBlock (const juce::var& chain, const juce::var& block, int index);
    /** Into path "A" or "B" of an ABY block. An ABY can't go inside a path. */
    bool addBlockToPath (const juce::var& aby, const juce::String& path, const juce::var& block, int index);
    /** Moves a block (or an ABY, with its paths) to index in a chain, or in path "A"/"B" of that
        chain's ABY abyId. The index counts the block in its old place. Returns an error, or {}. */
    juce::String moveBlock (const juce::String& blockId, const juce::var& chain, int index, const juce::String& abyId, const juce::String& path);
    /** The open project's chain holding this block, at any depth. */
    juce::var findChainOf (const juce::String& blockId) const;
    /** Inserts an ABY at index, moving the blocks after it into path A. Returns it, or void. */
    juce::var splitAt (const juce::var& chain, int index);
    /** Removing an ABY keeps its path A in the chain and deletes path B's blocks. */
    void removeBlock (const juce::String& blockId);
    /** A chain's block lists: its own, then each ABY's path A and path B. */
    static juce::Array<juce::Array<juce::var>*> getBlockLists (const juce::var& chain);
    /** Plugin state blobs (base64), kept out of the chains so state events stay small. */
    juce::String getPluginState (const juce::String& blockId) const;
    void setPluginState (const juce::String& blockId, const juce::String& base64);
    /** Where a block's plugin-window snapshot is kept: projects/<id>/snapshots/<blockId>.png. */
    static juce::File getSnapshotFile (const juce::String& projectId, const juce::String& blockId);

    /** The open project's presets as summaries ({ id, name }), oldest first, and the one it's on. */
    juce::var getPresetSummaries() const;
    juce::String getCurrentPresetId() const { return current["currentPresetId"].toString(); }
    /** Saves the rig (chains, and their blocks' plugin states: capture them first) as a preset,
        replacing presetId, or a new one when it's empty, and makes it current. Returns its id. */
    juce::String savePreset (const juce::String& presetId, const juce::String& name);
    /** Replaces the rig with the preset's and makes it current. False for an unknown preset. */
    bool loadPreset (const juce::String& presetId);
    bool renamePreset (const juce::String& presetId, const juce::String& name);
    bool deletePreset (const juce::String& presetId);
    /** The rig differs from its preset's: chains, blocks, routing, levels or plugin states. */
    bool isPresetModified() const;

    /** The audio device setup (AudioDeviceManager XML), kept in settings.json. */
    std::unique_ptr<juce::XmlElement> getDeviceState() const;
    void setDeviceState (const juce::XmlElement&);

    static juce::File getDataDir();

    /** Call after changing anything in getCurrent(). Saves at most once per saveIfDirty(). */
    void markDirty() { dirty = true; }
    void saveIfDirty();

    static const juce::StringArray colours;

private:
    static juce::var normaliseProject (const juce::var&);
    void forgetBlock (const juce::String& blockId); // its plugin state and snapshot
    static bool save (const juce::var& project);
    static bool writeJson (const juce::File&, const juce::var&);
    juce::File getPresetsDir() const;
    void loadPresets(); // the open project's, from its presets folder
    juce::var findPreset (const juce::String& presetId) const;
    void saveSettings() const;

    juce::Array<juce::var> projects;
    juce::var current;
    juce::Array<juce::var> presets; // the open project's, whole (with plugin states)
    juce::var settings;
    bool dirty = false;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (ProjectStore)
};

} // namespace glitch

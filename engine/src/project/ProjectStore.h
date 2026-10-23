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
    juce::var addChain (const juce::String& name);

    /** Blocks of the open project. */
    juce::var findBlock (const juce::String& blockId) const;
    void addBlock (const juce::var& chain, const juce::var& block, int index);
    void removeBlock (const juce::String& blockId);
    /** Plugin state blobs (base64), kept out of the chains so state events stay small. */
    juce::String getPluginState (const juce::String& blockId) const;
    void setPluginState (const juce::String& blockId, const juce::String& base64);

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
    void saveSettings() const;

    juce::Array<juce::var> projects;
    juce::var current;
    juce::var settings;
    bool dirty = false;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (ProjectStore)
};

} // namespace glitch

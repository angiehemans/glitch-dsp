#pragma once

#include <juce_audio_processors/juce_audio_processors.h>

namespace glitch
{

// The plugins Glitch knows about: VST3 (and AU on macOS), found by scanning the standard folders
// or a plugin/folder the user picks. Saved to <app data>/plugins.xml. Scans run on a background
// thread; a plugin that crashes a scan is skipped next time (JUCE's dead man's pedal file).
// shortcut: scans run in-process, so a crashing plugin takes the app down once. Upgrade to an
// out-of-process scanner before relying on unknown plugins at a show.
class PluginLibrary : private juce::Thread
{
public:
    explicit PluginLibrary (juce::File dataDir);
    ~PluginLibrary() override;

    juce::Array<juce::PluginDescription> getPlugins() const { return known.getTypes(); }
    std::unique_ptr<juce::PluginDescription> find (const juce::String& pluginId) const;
    bool isScanning() const { return isThreadRunning(); }

    /** Scans the standard folders. onDone runs on the message thread. */
    void scan (std::function<void()> onDone);
    /** Opens a file chooser, then scans the chosen plugin or folder. onDone runs on the message thread. */
    void import (std::function<void()> onDone);

    std::unique_ptr<juce::AudioPluginInstance> create (const juce::String& pluginId, double sampleRate,
                                                       int blockSize, juce::String& error);

private:
    void run() override;
    void start (juce::Array<juce::File> targets, std::function<void()> onDone);

    juce::AudioPluginFormatManager formats;
    juce::KnownPluginList known;
    const juce::File listFile, deadMansPedal;

    juce::Array<juce::File> targets; // empty = the formats' default folders; set before the thread starts
    std::function<void()> onScanDone;
    std::unique_ptr<juce::FileChooser> chooser;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (PluginLibrary)
};

} // namespace glitch

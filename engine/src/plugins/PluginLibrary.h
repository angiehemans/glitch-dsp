#pragma once

#include <juce_audio_processors/juce_audio_processors.h>

namespace glitch
{

// The plugins Glitch knows about: VST3 (and AU on macOS), found by scanning the standard folders
// or a plugin/folder the user picks. Saved to <app data>/plugins.xml.
// Scans run on the message thread, one plugin per timer tick, as JUCE's own plugin list does:
// Audio Units (and some VST3s) must be loaded on the main thread, and scanning them on a background
// thread stalls on macOS. Each plugin is loaded in a helper process (Glitch started again with
// a scanner command line), so a plugin that crashes or hangs while being scanned only takes the
// helper down; it's then left out, and the next plugin gets a fresh helper. A crash of Glitch
// itself mid-scan is still caught by the dead man's pedal file, and that plugin skipped next time.
// shortcut: the UI still pauses while each plugin loads, since the scan waits on the message thread.
class PluginLibrary : private juce::Timer
{
public:
    /** In the scanner helper: starts serving scans if the command line is the helper's, else returns null. */
    static std::unique_ptr<juce::ChildProcessWorker> startScanHelper (const juce::String& commandLine);
    static bool isScanHelper (const juce::String& commandLine);

    explicit PluginLibrary (juce::File dataDir);
    ~PluginLibrary() override;

    juce::Array<juce::PluginDescription> getPlugins() const { return known.getTypes(); }
    std::unique_ptr<juce::PluginDescription> find (const juce::String& pluginId) const;

    bool isScanning() const { return scanning; }
    /** 0..1 across the whole scan, and the plugin file being scanned. */
    float getScanProgress() const;
    juce::String getScanningName() const { return scanningName; }

    /** Scans the standard folders. onProgress runs after each plugin, onDone at the end. */
    void scan (std::function<void()> onProgress, std::function<void()> onDone);
    /** Scans picked plugin bundles or folders. Returns false if a scan is already running. */
    bool scanPaths (const juce::Array<juce::File>& paths, std::function<void()> onProgress, std::function<void()> onDone);

    std::unique_ptr<juce::AudioPluginInstance> create (const juce::String& pluginId, double sampleRate,
                                                       int blockSize, juce::String& error);

private:
    void start (const juce::Array<juce::File>& targets);
    void timerCallback() override; // scans the next plugin
    void finish();

    juce::AudioPluginFormatManager formats;
    juce::KnownPluginList known;
    const juce::File listFile, deadMansPedal;

    // The scan in progress: plugin bundles picked directly, then one directory scanner per format.
    struct BundleToScan { juce::String path; juce::AudioPluginFormat* format; };
    juce::Array<BundleToScan> bundles;
    std::vector<std::unique_ptr<juce::PluginDirectoryScanner>> scanners;
    size_t currentScanner = 0;
    int bundlesTotal = 0;
    bool scanning = false;
    juce::String scanningName;
    std::function<void()> onScanProgress, onScanDone;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (PluginLibrary)
};

} // namespace glitch

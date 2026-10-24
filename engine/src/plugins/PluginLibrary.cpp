#include "PluginLibrary.h"

namespace glitch
{

PluginLibrary::PluginLibrary (juce::File dataDir)
    : listFile (dataDir.getChildFile ("plugins.xml")),
      deadMansPedal (dataDir.getChildFile ("plugin-scan-in-progress.txt"))
{
    dataDir.createDirectory();
    juce::addDefaultFormatsToManager (formats);

    if (const auto xml = juce::parseXML (listFile))
        known.recreateFromXml (*xml);
}

PluginLibrary::~PluginLibrary()
{
    stopTimer();
}

std::unique_ptr<juce::PluginDescription> PluginLibrary::find (const juce::String& pluginId) const
{
    return known.getTypeForIdentifierString (pluginId);
}

float PluginLibrary::getScanProgress() const
{
    const auto steps = bundlesTotal + (int) scanners.size();
    if (! scanning || steps == 0)
        return 0.0f;

    auto done = (float) (bundlesTotal - bundles.size());
    for (size_t i = 0; i < scanners.size(); ++i)
        done += i < currentScanner ? 1.0f : i == currentScanner ? scanners[i]->getProgress() : 0.0f;

    return juce::jlimit (0.0f, 1.0f, done / (float) steps);
}

void PluginLibrary::scan (std::function<void()> onProgress, std::function<void()> onDone)
{
    if (scanning)
        return;

    onScanProgress = std::move (onProgress);
    onScanDone = std::move (onDone);
    start ({});
}

bool PluginLibrary::import (std::function<void()> onProgress, std::function<void()> onDone)
{
    if (scanning)
        return false;
    if (chooser != nullptr)
        return true; // already open

    chooser = std::make_unique<juce::FileChooser> ("Add a plugin, or a folder of plugins",
                                                   juce::File::getSpecialLocation (juce::File::userHomeDirectory));

    chooser->launchAsync (juce::FileBrowserComponent::openMode
                              | juce::FileBrowserComponent::canSelectFiles
                              | juce::FileBrowserComponent::canSelectDirectories,
                          [this, onProgress = std::move (onProgress), onDone = std::move (onDone)] (const juce::FileChooser& fc)
                          {
                              const auto results = fc.getResults();
                              chooser = nullptr;
                              if (results.isEmpty() || scanning)
                                  return;

                              onScanProgress = onProgress;
                              onScanDone = onDone;
                              start (results);
                          });
    return true;
}

void PluginLibrary::start (const juce::Array<juce::File>& targets)
{
    bundles.clear();
    scanners.clear();
    currentScanner = 0;

    for (auto* format : formats.getFormats())
    {
        juce::FileSearchPath folders;

        if (targets.isEmpty())
        {
            folders = format->getDefaultLocationsToSearch();
            // AU components aren't files in folders: the format lists them itself, from an empty path.
            if (folders.getNumPaths() == 0 && ! format->canScanForPlugins())
                continue;
        }
        else
        {
            for (const auto& target : targets)
            {
                // A plugin bundle (.vst3/.component are folders on macOS and Linux) is added directly;
                // any other folder is searched.
                if (format->fileMightContainThisPluginType (target.getFullPathName()))
                    bundles.add ({ target.getFullPathName(), format });
                else if (target.isDirectory())
                    folders.add (target);
            }

            if (folders.getNumPaths() == 0)
                continue;
        }

        scanners.push_back (std::make_unique<juce::PluginDirectoryScanner> (known, *format, folders, true, deadMansPedal,
                                                                             true));
    }

    bundlesTotal = bundles.size();
    scanning = true;
    scanningName = {};
    startTimer (1);
}

void PluginLibrary::timerCallback()
{
    // One plugin per tick, so the UI keeps running between plugins.
    if (! bundles.isEmpty())
    {
        const auto bundle = bundles.removeAndReturn (0);
        scanningName = juce::File (bundle.path).getFileNameWithoutExtension();
        juce::OwnedArray<juce::PluginDescription> found;
        known.scanAndAddFile (bundle.path, true, found, *bundle.format);
    }
    else if (currentScanner < scanners.size())
    {
        auto& scanner = *scanners[currentScanner];
        scanningName = juce::File (scanner.getNextPluginFileThatWillBeScanned()).getFileNameWithoutExtension();
        juce::String name;
        if (! scanner.scanNextFile (true, name))
            ++currentScanner;
    }
    else
    {
        finish();
        return;
    }

    if (onScanProgress)
        onScanProgress();
}

void PluginLibrary::finish()
{
    stopTimer();
    scanners.clear();
    scanning = false;
    scanningName = {};

    if (const auto xml = known.createXml())
        xml->writeTo (listFile);

    if (onScanDone)
        onScanDone();
}

std::unique_ptr<juce::AudioPluginInstance> PluginLibrary::create (const juce::String& pluginId, double sampleRate,
                                                                  int blockSize, juce::String& error)
{
    const auto description = find (pluginId);
    if (description == nullptr)
    {
        error = "Plugin not installed";
        return nullptr;
    }

    // shortcut: synchronous creation, which some AUv3 plugins refuse. Move to createPluginInstanceAsync if one does.
    return formats.createPluginInstance (*description, sampleRate, blockSize, error);
}

} // namespace glitch

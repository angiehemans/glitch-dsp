#include "PluginLibrary.h"

namespace glitch
{

PluginLibrary::PluginLibrary (juce::File dataDir)
    : Thread ("Plugin scan"),
      listFile (dataDir.getChildFile ("plugins.xml")),
      deadMansPedal (dataDir.getChildFile ("plugin-scan-in-progress.txt"))
{
    dataDir.createDirectory();
    juce::addDefaultFormatsToManager (formats);

    if (const auto xml = juce::parseXML (listFile))
        known.recreateFromXml (*xml);
}

PluginLibrary::~PluginLibrary()
{
    stopThread (10000); // a plugin mid-scan can take a while to return
}

std::unique_ptr<juce::PluginDescription> PluginLibrary::find (const juce::String& pluginId) const
{
    return known.getTypeForIdentifierString (pluginId);
}

void PluginLibrary::scan (std::function<void()> onDone)
{
    start ({}, std::move (onDone));
}

void PluginLibrary::import (std::function<void()> onDone)
{
    if (isScanning() || chooser != nullptr)
        return;

    chooser = std::make_unique<juce::FileChooser> ("Add a plugin, or a folder of plugins",
                                                   juce::File::getSpecialLocation (juce::File::userHomeDirectory));

    chooser->launchAsync (juce::FileBrowserComponent::openMode
                              | juce::FileBrowserComponent::canSelectFiles
                              | juce::FileBrowserComponent::canSelectDirectories,
                          [this, onDone = std::move (onDone)] (const juce::FileChooser& fc)
                          {
                              const auto results = fc.getResults();
                              chooser = nullptr;
                              if (! results.isEmpty())
                                  start (results, onDone);
                          });
}

void PluginLibrary::start (juce::Array<juce::File> newTargets, std::function<void()> onDone)
{
    if (isScanning())
        return;

    targets = std::move (newTargets);
    onScanDone = std::move (onDone);
    startThread();
}

void PluginLibrary::run()
{
    for (auto* format : formats.getFormats())
    {
        juce::FileSearchPath folders;

        if (targets.isEmpty())
        {
            folders = format->getDefaultLocationsToSearch();
        }
        else
        {
            for (const auto& target : targets)
            {
                // A plugin bundle (.vst3 is a folder on Linux and macOS) is added directly;
                // any other folder is searched.
                if (format->fileMightContainThisPluginType (target.getFullPathName()))
                {
                    juce::OwnedArray<juce::PluginDescription> found;
                    known.scanAndAddFile (target.getFullPathName(), true, found, *format);
                }
                else if (target.isDirectory())
                {
                    folders.add (target);
                }
            }
        }

        if (folders.getNumPaths() == 0)
            continue;

        juce::PluginDirectoryScanner scanner (known, *format, folders, true, deadMansPedal);
        juce::String name;
        while (! threadShouldExit() && scanner.scanNextFile (true, name)) {}
    }

    if (const auto xml = known.createXml())
        xml->writeTo (listFile);

    juce::MessageManager::callAsync ([onDone = onScanDone]
    {
        if (onDone)
            onDone();
    });
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

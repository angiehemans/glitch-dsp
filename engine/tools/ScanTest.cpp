// GlitchScanTest: scans plugin bundles through Glitch's helper-process scanner and prints what it found.
// Usage: GlitchScanTest <plugin bundle>...   A plugin that crashes or hangs is reported as not found.
// Build: cmake --build --preset dev --target GlitchScanTest

#include "../src/plugins/PluginLibrary.h"

#include <cstdio>

int main (int argc, char** argv)
{
    juce::StringArray args;
    for (int i = 1; i < argc; ++i)
        args.add (argv[i]);

    const juce::ScopedJuceInitialiser_GUI juce;

    // Started again as the helper: serve scans until the scanner disconnects.
    if (const auto helper = glitch::PluginLibrary::startScanHelper (args.joinIntoString (" ")))
    {
        juce::MessageManager::getInstance()->runDispatchLoop();
        return 0;
    }

    if (args.isEmpty())
    {
        std::printf ("usage: GlitchScanTest <plugin bundle>...\n");
        return 2;
    }

    const auto dataDir = juce::File::createTempFile ("glitch-scan-test");
    juce::Array<juce::File> paths;
    for (const auto& a : args)
        paths.add (juce::File::getCurrentWorkingDirectory().getChildFile (a));

    {
        glitch::PluginLibrary library (dataDir);
        library.scanPaths (paths, [] {}, [] { juce::MessageManager::getInstance()->stopDispatchLoop(); });
        juce::MessageManager::getInstance()->runDispatchLoop();

        std::printf ("found %d\n", library.getPlugins().size());
        for (const auto& p : library.getPlugins())
            std::printf ("  %s (%s)\n", p.name.toRawUTF8(), p.pluginFormatName.toRawUTF8());
    }

    dataDir.deleteRecursively();
    return 0;
}

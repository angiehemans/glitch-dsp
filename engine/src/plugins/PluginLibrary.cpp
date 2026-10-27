#include "PluginLibrary.h"

#include <atomic>
#include <condition_variable>
#include <cstdlib>
#include <mutex>

#include <signal.h>
#include <unistd.h>

namespace glitch
{

namespace
{
    const juce::String helperId = "glitch-plugin-scanner";
    constexpr int helperTimeoutMs = 60000; // longest a plugin may take to load before it's given up on
    constexpr int helperPingMs = 2000;     // how soon a crashed helper is noticed (JUCE's default is 8 s)

    // A request is the format name and the plugin's file or identifier; the reply is a LIST of
    // PluginDescription XML (empty if the plugin loaded but had nothing to offer). On connecting,
    // the helper sends its process id, so a helper stuck in a hung plugin can be killed.
    const juce::String pidPrefix = "PID ";
    class ScanHelper final : public juce::ChildProcessWorker
    {
    public:
        ScanHelper() { juce::addDefaultFormatsToManager (formats); }

    private:
        void handleConnectionMade() override
        {
            const auto message = pidPrefix + juce::String ((int) getpid());
            sendMessageToCoordinator ({ message.toRawUTF8(), message.getNumBytesAsUTF8() });
        }

        void handleMessageFromCoordinator (const juce::MemoryBlock& request) override
        {
            // Arrives on the connection's thread; plugins load on the message thread, as in Glitch.
            juce::MessageManager::callAsync ([this, request]
            {
                juce::MemoryInputStream in (request, false);
                const auto formatName = in.readString(), identifier = in.readString();

                juce::OwnedArray<juce::PluginDescription> found;
                for (auto* format : formats.getFormats())
                    if (format->getName() == formatName)
                        format->findAllTypesForFile (found, identifier);

                juce::XmlElement list ("LIST");
                for (auto* description : found)
                    list.addChildElement (description->createXml().release());
                const auto reply = list.toString();
                sendMessageToCoordinator ({ reply.toRawUTF8(), reply.getNumBytesAsUTF8() });
            });
        }

        // Exit at once rather than quit: the message thread may be stuck inside a hung plugin.
        void handleConnectionLost() override { std::_Exit (0); }

        juce::AudioPluginFormatManager formats;
    };

    // Runs every scan through a ScanHelper process, started on first use and restarted after a crash.
    class HelperScanner final : public juce::KnownPluginList::CustomScanner,
                                private juce::ChildProcessCoordinator
    {
    public:
        ~HelperScanner() override { killWorkerProcess(); }

        bool findPluginTypesFor (juce::AudioPluginFormat& format, juce::OwnedArray<juce::PluginDescription>& result,
                                 const juce::String& fileOrIdentifier) override
        {
            if (! running)
                running = launchWorkerProcess (juce::File::getSpecialLocation (juce::File::currentExecutableFile), helperId, helperPingMs);

            juce::MemoryBlock request;
            {
                juce::MemoryOutputStream out (request, false);
                out.writeString (format.getName());
                out.writeString (fileOrIdentifier);
            }

            {
                const std::lock_guard<std::mutex> lock (mutex);
                reply.reset();
                lost = false;
            }

            if (! running || ! sendMessageToWorker (request))
                return giveUp();

            std::unique_lock<std::mutex> lock (mutex);
            if (! replied.wait_for (lock, std::chrono::milliseconds (helperTimeoutMs), [this] { return reply != nullptr || lost; })
                || reply == nullptr)
            {
                lock.unlock();
                return giveUp(); // crashed or hung: false leaves the plugin out
            }

            for (const auto* item : reply->getChildIterator())
                if (auto description = std::make_unique<juce::PluginDescription>(); description->loadFromXml (*item))
                    result.add (std::move (description));
            return true;
        }

        void scanFinished() override
        {
            killWorkerProcess();
            running = false;
        }

    private:
        bool giveUp()
        {
            if (const auto pid = helperPid.exchange (0); pid > 0)
                ::kill (pid, SIGKILL); // a hung helper never sees the disconnect
            killWorkerProcess();
            running = false;
            return false;
        }

        // Both on the connection's thread, while findPluginTypesFor waits on the message thread.
        void handleMessageFromWorker (const juce::MemoryBlock& message) override
        {
            if (const auto text = message.toString(); text.startsWith (pidPrefix))
                return helperPid.store (text.substring (pidPrefix.length()).getIntValue());

            const std::lock_guard<std::mutex> lock (mutex);
            reply = juce::parseXML (message.toString());
            if (reply == nullptr)
                lost = true;
            replied.notify_one();
        }

        void handleConnectionLost() override
        {
            const std::lock_guard<std::mutex> lock (mutex);
            lost = true;
            replied.notify_one();
        }

        bool running = false; // message thread only
        std::atomic<int> helperPid { 0 };
        std::mutex mutex;
        std::condition_variable replied;
        std::unique_ptr<juce::XmlElement> reply;
        bool lost = false;
    };
}

std::unique_ptr<juce::ChildProcessWorker> PluginLibrary::startScanHelper (const juce::String& commandLine)
{
    auto helper = std::make_unique<ScanHelper>();
    if (! helper->initialiseFromCommandLine (commandLine, helperId))
        return nullptr;
    return helper;
}

bool PluginLibrary::isScanHelper (const juce::String& commandLine)
{
    return commandLine.contains ("--" + helperId + ":");
}

PluginLibrary::PluginLibrary (juce::File dataDir)
    : listFile (dataDir.getChildFile ("plugins.xml")),
      deadMansPedal (dataDir.getChildFile ("plugin-scan-in-progress.txt"))
{
    dataDir.createDirectory();
    juce::addDefaultFormatsToManager (formats);

    if (const auto xml = juce::parseXML (listFile))
        known.recreateFromXml (*xml);

    known.setCustomScanner (std::make_unique<HelperScanner>());
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

bool PluginLibrary::scanPaths (const juce::Array<juce::File>& paths, std::function<void()> onProgress, std::function<void()> onDone)
{
    if (scanning)
        return false;

    onScanProgress = std::move (onProgress);
    onScanDone = std::move (onDone);
    start (paths);
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

    // Plugins that crashed the last scan are skipped, here as well as in the directory scanners.
    juce::PluginDirectoryScanner::applyBlacklistingsFromDeadMansPedal (known, deadMansPedal);

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
        deadMansPedal.replaceWithText (bundle.path); // left behind if this plugin crashes the app
        known.scanAndAddFile (bundle.path, true, found, *bundle.format);
        deadMansPedal.deleteFile();
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
    known.scanFinished(); // stops the helper
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

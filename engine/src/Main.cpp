#include <juce_gui_basics/juce_gui_basics.h>

#include "MainComponent.h"
#include "plugins/PluginLibrary.h"

namespace glitch
{

class GlitchApplication : public juce::JUCEApplication
{
public:
    const juce::String getApplicationName() override    { return JUCE_APPLICATION_NAME_STRING; }
    const juce::String getApplicationVersion() override { return JUCE_APPLICATION_VERSION_STRING; }
    // The plugin scanner helper is a second copy of Glitch, started by the first.
    bool moreThanOneInstanceAllowed() override           { return PluginLibrary::isScanHelper (getCommandLineParameters()); }

    void initialise (const juce::String& commandLine) override
    {
        if ((scanHelper = PluginLibrary::startScanHelper (commandLine)) != nullptr)
        {
           #if JUCE_MAC
            juce::Process::setDockIconVisible (false);
           #endif
            return;
        }

        if (PluginLibrary::isScanHelper (commandLine)) // a helper whose Glitch has already gone
            return quit();

        mainWindow = std::make_unique<MainWindow> (getApplicationName());
    }

    void shutdown() override
    {
        mainWindow = nullptr;
    }

    void systemRequestedQuit() override
    {
        quit();
    }

private:
    class MainWindow : public juce::DocumentWindow
    {
    public:
        explicit MainWindow (const juce::String& name)
            : DocumentWindow (name,
                              juce::Desktop::getInstance().getDefaultLookAndFeel().findColour (juce::ResizableWindow::backgroundColourId),
                              DocumentWindow::allButtons)
        {
            setUsingNativeTitleBar (true);
            setContentOwned (new MainComponent(), true);
            setResizable (true, true);
            centreWithSize (getWidth(), getHeight());
            setVisible (true);
        }

        void closeButtonPressed() override
        {
            JUCEApplication::getInstance()->systemRequestedQuit();
        }

    private:
        JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (MainWindow)
    };

    std::unique_ptr<MainWindow> mainWindow;
    std::unique_ptr<juce::ChildProcessWorker> scanHelper;
};

} // namespace glitch

START_JUCE_APPLICATION (glitch::GlitchApplication)

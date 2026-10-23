#pragma once

#include <juce_audio_processors/juce_audio_processors.h>

namespace glitch
{

// A native window for a plugin's own editor (or JUCE's generic one when it has none).
// Must be deleted before the plugin.
class PluginWindow final : public juce::DocumentWindow
{
public:
    PluginWindow (juce::AudioProcessor& processor, std::function<void()> onCloseIn)
        : DocumentWindow (processor.getName(), juce::Colours::black, DocumentWindow::closeButton),
          onClose (std::move (onCloseIn))
    {
        setUsingNativeTitleBar (true);

        auto* editor = processor.hasEditor() ? processor.createEditorAndMakeActive() : nullptr;
        if (editor == nullptr)
            editor = new juce::GenericAudioProcessorEditor (processor);

        setContentOwned (editor, true);
        setResizable (editor->isResizable(), false);
        centreWithSize (getWidth(), getHeight());
        setVisible (true);
    }

    void closeButtonPressed() override
    {
        onClose(); // the owner deletes this window, asynchronously
    }

private:
    std::function<void()> onClose;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (PluginWindow)
};

} // namespace glitch

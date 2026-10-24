#pragma once

#include <juce_audio_processors/juce_audio_processors.h>

namespace glitch
{

namespace colours // the Scamp theme's tokens, for native windows
{
    inline const juce::Colour background { 0xff1a1b1e }, button { 0xff26282c }, line { 0xff2e3035 },
                              text { 0xffd6d9de }, dim { 0xff8a8f98 }, clip { 0xffef4444 };
}

// A native window for a block: a Glitch header (Bypass, Remove from chain) above the plugin's own
// editor, or JUCE's generic one when it has none. A block whose plugin isn't installed gets a
// message instead of an editor, so it can still be removed. Must be deleted before the plugin.
class PluginWindow final : public juce::DocumentWindow
{
public:
    struct Callbacks
    {
        std::function<void()> onClose, onBypass, onRemove; // the owner deletes the window, asynchronously
    };

    PluginWindow (const juce::String& title, juce::AudioProcessor* processor, bool bypassed, Callbacks callbacksIn)
        : DocumentWindow (title, colours::background, DocumentWindow::closeButton),
          callbacks (std::move (callbacksIn))
    {
        setUsingNativeTitleBar (true);
        auto* content = new Content (title, processor, callbacks);
        setContentOwned (content, true);
        setResizable (content->isBodyResizable(), false);
        setBypassed (bypassed);
        centreWithSize (getWidth(), getHeight());
        setVisible (true);
    }

    void setBypassed (bool bypassed)
    {
        if (auto* content = dynamic_cast<Content*> (getContentComponent()))
            content->setBypassed (bypassed);
    }

    /** The plugin's part of the window (below the header), in this window's coordinates. */
    juce::Rectangle<int> getPluginArea() const
    {
        auto* content = getContentComponent();
        return content != nullptr ? getLocalArea (content, content->getLocalBounds().withTrimmedTop (Content::headerHeight)) : juce::Rectangle<int>();
    }

    void closeButtonPressed() override
    {
        callbacks.onClose();
    }

private:
    struct Content final : juce::Component,
                           private juce::ComponentListener
    {
        static constexpr int headerHeight = 44;
        static constexpr int minWidth = 320; // room for the header's buttons

        Content (const juce::String& title, juce::AudioProcessor* processor, const Callbacks& callbacks)
        {
            if (processor != nullptr)
            {
                auto* editor = processor->hasEditor() ? processor->createEditorAndMakeActive() : nullptr;
                body.reset (editor != nullptr ? editor : new juce::GenericAudioProcessorEditor (*processor));
                resizableBody = static_cast<juce::AudioProcessorEditor*> (body.get())->isResizable();
            }
            else
            {
                auto label = std::make_unique<juce::Label> ("", title + " isn't installed.\nScan for plugins or add it to load it again.");
                label->setJustificationType (juce::Justification::centred);
                label->setColour (juce::Label::textColourId, colours::dim);
                label->setSize (minWidth + 100, 120);
                body = std::move (label);
            }

            for (auto* button : { &bypass, &remove })
            {
                button->setColour (juce::TextButton::buttonColourId, colours::button);
                button->setColour (juce::TextButton::buttonOnColourId, colours::button);
                button->setColour (juce::ComboBox::outlineColourId, colours::line);
                button->setColour (juce::TextButton::textColourOffId, colours::text);
                addAndMakeVisible (*button);
            }
            remove.setButtonText ("Remove from chain");
            remove.setColour (juce::TextButton::textColourOffId, colours::clip);
            bypass.onClick = callbacks.onBypass;
            remove.onClick = callbacks.onRemove;
            bypass.setEnabled (processor != nullptr);

            addAndMakeVisible (*body);
            body->addComponentListener (this);
            fitToBody();
        }

        ~Content() override
        {
            body->removeComponentListener (this);
        }

        bool isBodyResizable() const { return resizableBody; }

        void setBypassed (bool bypassed)
        {
            bypass.setButtonText (bypassed ? "Enable" : "Bypass");
            bypass.setColour (juce::TextButton::textColourOffId, bypassed ? colours::dim : colours::text);
        }

        void paint (juce::Graphics& g) override
        {
            g.fillAll (colours::background);
            g.setColour (colours::line);
            g.fillRect (0, headerHeight - 1, getWidth(), 1);
        }

        void resized() override
        {
            auto header = getLocalBounds().removeFromTop (headerHeight).reduced (8, 7);
            remove.setBounds (header.removeFromRight (150));
            header.removeFromRight (8);
            bypass.setBounds (header.removeFromRight (90));

            // A resizable editor follows the window; a fixed one keeps its own size, under the header.
            const juce::ScopedValueSetter<bool> layingOut (laying, true);
            if (resizableBody)
                body->setBounds (getLocalBounds().withTrimmedTop (headerHeight));
            else
                body->setTopLeftPosition (0, headerHeight);
        }

    private:
        void componentMovedOrResized (juce::Component&, bool, bool wasResized) override
        {
            if (wasResized && ! laying)
                fitToBody(); // the plugin resized its own editor
        }

        void fitToBody()
        {
            setSize (std::max (minWidth, body->getWidth()), body->getHeight() + headerHeight);
        }

        std::unique_ptr<juce::Component> body; // the editor; deleted before the plugin, with the window
        juce::TextButton bypass, remove;
        bool resizableBody = false, laying = false;
    };

    Callbacks callbacks;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (PluginWindow)
};

} // namespace glitch

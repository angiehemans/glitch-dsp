#pragma once

#include <juce_gui_extra/juce_gui_extra.h>

#include "../audio/Engine.h"

namespace glitch
{

// Hosts the UI in a WebView: loads the dev server or the bundled ui/ folder,
// dispatches glitch:command events and emits glitch:event events.
class WebUi : public juce::Component,
              private juce::Timer
{
public:
    explicit WebUi (Engine&);

    void resized() override;

private:
    struct Browser : juce::WebBrowserComponent
    {
        using WebBrowserComponent::WebBrowserComponent;
        std::function<void()> onNetworkError;

        bool pageLoadHadNetworkError (const juce::String&) override
        {
            if (onNetworkError)
                onNetworkError();
            return false;
        }
    };

    void handleCommand (const juce::var& command);
    void sendState();
    void sendError (const juce::String& message);
    void emit (const juce::var& event);
    void timerCallback() override; // meters, ~30 Hz

    std::optional<juce::WebBrowserComponent::Resource> getResource (const juce::String& url);

    Engine& engine;
    const juce::String devUrl { GLITCH_UI_DEV_URL };
    const juce::File uiRoot;
    Browser browser;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (WebUi)
};

} // namespace glitch

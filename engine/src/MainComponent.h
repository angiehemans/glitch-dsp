#pragma once

#include <juce_gui_basics/juce_gui_basics.h>

#include "audio/Engine.h"
#include "bridge/WebUi.h"

namespace glitch
{

class MainComponent : public juce::Component
{
public:
    MainComponent();

    void resized() override;

private:
    Engine engine;
    WebUi webUi { engine };

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (MainComponent)
};

} // namespace glitch

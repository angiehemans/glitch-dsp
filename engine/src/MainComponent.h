#pragma once

#include <juce_gui_basics/juce_gui_basics.h>

#include "audio/Engine.h"
#include "bridge/WebUi.h"
#include "plugins/PluginLibrary.h"
#include "project/ProjectStore.h"

namespace glitch
{

class MainComponent : public juce::Component
{
public:
    MainComponent();

    void resized() override;

private:
    // Declaration order is construction order: settings and plugins before the engine that uses
    // them, and the UI (which owns plugin windows) last, so it's destroyed first.
    ProjectStore store;
    PluginLibrary library { ProjectStore::getDataDir() };
    Engine engine { store.getDeviceState().get() };
    WebUi webUi { engine, store, library };

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (MainComponent)
};

} // namespace glitch

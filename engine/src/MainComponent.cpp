#include "MainComponent.h"

namespace glitch
{

MainComponent::MainComponent()
{
    addAndMakeVisible (webUi);
    setSize (1280, 800);
}

void MainComponent::resized()
{
    webUi.setBounds (getLocalBounds());
}

} // namespace glitch

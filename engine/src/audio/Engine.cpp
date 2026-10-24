#include "Engine.h"
#include "ChainStage.h"

#include <set>

#if JUCE_LINUX
 #include <alsa/asoundlib.h>
#endif

namespace glitch
{

using IO = juce::AudioProcessorGraph::AudioGraphIOProcessor;
using Update = juce::AudioProcessorGraph::UpdateKind;

Engine::Engine (const juce::XmlElement* savedDeviceState)
{
    inputNode = graph.addNode (std::make_unique<IO> (IO::audioInputNode))->nodeID;
    outputNode = graph.addNode (std::make_unique<IO> (IO::audioOutputNode))->nodeID;
    player.setProcessor (&graph);

    deviceError = deviceManager.initialise (maxChannels, maxChannels, savedDeviceState, true);
    deviceManager.addAudioCallback (this);
    rescanDevices();

    for (auto* type : deviceManager.getAvailableDeviceTypes())
        type->addListener (this);
}

Engine::~Engine()
{
    for (auto* type : deviceManager.getAvailableDeviceTypes())
        type->removeListener (this);

    deviceManager.removeAudioCallback (this);
    player.setProcessor (nullptr);
}

//==============================================================================
void Engine::setChains (const std::vector<ChainSpec>& chains)
{
    std::set<juce::String> ids;
    for (const auto& c : chains)
        ids.insert (c.id);

    for (auto* stages : { &chainIn, &chainOut })
    {
        for (auto it = stages->begin(); it != stages->end();)
        {
            if (ids.count (it->first) == 0)
            {
                graph.removeNode (it->second, Update::none);
                it = stages->erase (it);
            }
            else
            {
                ++it;
            }
        }
    }

    for (const auto& c : chains)
    {
        if (chainIn.count (c.id) == 0)
            chainIn[c.id] = graph.addNode (std::make_unique<ChainStage> (false), {}, Update::none)->nodeID;
        if (chainOut.count (c.id) == 0)
            chainOut[c.id] = graph.addNode (std::make_unique<ChainStage> (true), {}, Update::none)->nodeID;
    }

    for (const auto& connection : graph.getConnections())
        graph.removeConnection (connection, Update::none);

    // Connections to channels the device doesn't have are refused by the graph, which leaves them silent.
    for (const auto& c : chains)
    {
        const auto in = chainIn[c.id], out = chainOut[c.id];

        for (int ch = 0; ch < 2; ++ch)
            graph.addConnection ({ { inputNode, c.input }, { in, ch } }, Update::none);

        auto previous = in;
        for (const auto& blockId : c.blockIds)
        {
            if (const auto it = blocks.find (blockId); it != blocks.end())
            {
                connect (previous, it->second);
                previous = it->second;
            }
        }
        connect (previous, out);

        if (c.outputs.size() >= 2)
        {
            graph.addConnection ({ { out, 0 }, { outputNode, c.outputs[0] } }, Update::none);
            graph.addConnection ({ { out, 1 }, { outputNode, c.outputs[1] } }, Update::none);
        }
        else if (c.outputs.size() == 1)
        {
            for (int ch = 0; ch < 2; ++ch)
                graph.addConnection ({ { out, ch }, { outputNode, c.outputs[0] } }, Update::none);
        }
    }

    graph.rebuild();
}

void Engine::connect (NodeID from, NodeID to)
{
    const auto outs = graph.getNodeForId (from)->getProcessor()->getTotalNumOutputChannels();
    const auto ins = graph.getNodeForId (to)->getProcessor()->getTotalNumInputChannels();

    // Stereo into mono takes the left channel; mono into stereo feeds both.
    for (int ch = 0; ch < ins && outs > 0; ++ch)
        graph.addConnection ({ { from, std::min (ch, outs - 1) }, { to, ch } }, Update::none);
}

ChainStage* Engine::getStage (const std::map<juce::String, NodeID>& stages, const juce::String& chainId) const
{
    const auto it = stages.find (chainId);
    if (it == stages.end())
        return nullptr;
    auto* node = graph.getNodeForId (it->second);
    return node != nullptr ? dynamic_cast<ChainStage*> (node->getProcessor()) : nullptr;
}

void Engine::setChainParams (const juce::String& chainId, float levelDb, bool isMuted)
{
    if (auto* stage = getStage (chainOut, chainId))
    {
        stage->levelDb.store (levelDb);
        stage->muted.store (isMuted);
    }
}

//==============================================================================
bool Engine::addBlock (const juce::String& blockId, std::unique_ptr<juce::AudioProcessor> plugin)
{
    if (plugin == nullptr || hasBlock (blockId))
        return false;

    // Chains are stereo: ask for stereo main buses, and keep whatever the plugin accepts.
    plugin->disableNonMainBuses();
    for (const auto isInput : { true, false })
        if (auto* bus = plugin->getBus (isInput, 0))
            bus->setCurrentLayout (juce::AudioChannelSet::stereo());

    auto node = graph.addNode (std::move (plugin), {}, Update::none);
    if (node == nullptr)
        return false;

    blocks[blockId] = node->nodeID;
    return true;
}

void Engine::removeBlock (const juce::String& blockId)
{
    if (const auto it = blocks.find (blockId); it != blocks.end())
    {
        graph.removeNode (it->second, Update::none);
        blocks.erase (it);
    }
}

juce::StringArray Engine::getBlockIds() const
{
    juce::StringArray ids;
    for (const auto& [id, node] : blocks)
        ids.add (id);
    return ids;
}

void Engine::setBlockEnabled (const juce::String& blockId, bool enabled)
{
    if (const auto it = blocks.find (blockId); it != blocks.end())
        if (auto* node = graph.getNodeForId (it->second))
            node->setBypassed (! enabled);
}

juce::AudioProcessor* Engine::getBlockProcessor (const juce::String& blockId) const
{
    const auto it = blocks.find (blockId);
    auto* node = it != blocks.end() ? graph.getNodeForId (it->second) : nullptr;
    return node != nullptr ? node->getProcessor() : nullptr;
}

//==============================================================================
float Engine::takePeakDb (Meter m)
{
    return juce::Decibels::gainToDecibels (peaks[(size_t) m].exchange (0.0f), silenceDb);
}

float Engine::takeChainPeakDb (const juce::String& chainId, bool output)
{
    auto* stage = getStage (output ? chainOut : chainIn, chainId);
    return juce::Decibels::gainToDecibels (stage != nullptr ? stage->peak.exchange (0.0f) : 0.0f, silenceDb);
}

void Engine::storePeak (std::atomic<float>& slot, float peak)
{
    // Racy max with the reader's exchange, which at worst drops one block's peak. Fine for meters.
    if (peak > slot.load (std::memory_order_relaxed))
        slot.store (peak, std::memory_order_relaxed);
}

double Engine::getSampleRate() const
{
    auto* device = deviceManager.getCurrentAudioDevice();
    return device != nullptr ? device->getCurrentSampleRate() : 48000.0;
}

int Engine::getBlockSize() const
{
    auto* device = deviceManager.getCurrentAudioDevice();
    return device != nullptr ? device->getCurrentBufferSizeSamples() : 512;
}

//==============================================================================
void Engine::rescanDevices()
{
   #if JUCE_LINUX
    // alsa-lib loads each card's config once per process, so cards plugged in later stay invisible.
    // Dropping the global config makes the next scan reload it; open devices hold their own reference.
    snd_config_update_free_global();
   #endif

    for (auto* type : deviceManager.getAvailableDeviceTypes())
        type->scanForDevices();
}

juce::String Engine::selectDevice (const juce::String& typeName, const juce::String& name)
{
    auto setup = deviceManager.getAudioDeviceSetup();
    const auto typeChanged = deviceManager.getCurrentAudioDeviceType() != typeName;

    deviceManager.setCurrentAudioDeviceType (typeName, true);
    auto* type = deviceManager.getCurrentDeviceTypeObject();
    if (type == nullptr || deviceManager.getCurrentAudioDeviceType() != typeName)
        return "Unknown device type: " + typeName;

    type->scanForDevices();
    const auto ins = type->getDeviceNames (true), outs = type->getDeviceNames (false);
    if (! ins.contains (name) && ! outs.contains (name))
        return "Device not found: " + name;

    if (typeChanged)
        setup = deviceManager.getAudioDeviceSetup(); // the new type's defaults

    if (ins.contains (name))
        setup.inputDeviceName = name;
    if (outs.contains (name))
        setup.outputDeviceName = name;

    setup.useDefaultInputChannels = setup.useDefaultOutputChannels = false;
    setup.inputChannels.clear();
    setup.inputChannels.setRange (0, maxChannels, true);
    setup.outputChannels.clear();
    setup.outputChannels.setRange (0, maxChannels, true);

    return deviceManager.setAudioDeviceSetup (setup, true);
}

juce::String Engine::setFormat (double sampleRate, int bufferSize)
{
    auto* device = deviceManager.getCurrentAudioDevice();
    if (device == nullptr)
        return "No audio device is open";

    auto setup = deviceManager.getAudioDeviceSetup();

    if (sampleRate > 0)
    {
        if (! device->getAvailableSampleRates().contains (sampleRate))
            return device->getName() + " can't run at " + juce::String (sampleRate / 1000.0, 1) + " kHz";
        setup.sampleRate = sampleRate;
    }

    if (bufferSize > 0)
    {
        if (! device->getAvailableBufferSizes().contains (bufferSize))
            return device->getName() + " doesn't offer a " + juce::String (bufferSize) + "-sample buffer";
        setup.bufferSize = bufferSize;
    }

    return deviceManager.setAudioDeviceSetup (setup, true);
}

//==============================================================================
void Engine::audioDeviceAboutToStart (juce::AudioIODevice* device)
{
    master.reset (device->getCurrentSampleRate(), 0.02);
    master.setCurrentAndTargetValue (0.0f); // fade in from silence on start
    player.audioDeviceAboutToStart (device);
}

void Engine::audioDeviceStopped()
{
    player.audioDeviceStopped();
}

void Engine::audioDeviceError (const juce::String& message)
{
    player.audioDeviceError (message);
}

void Engine::audioDeviceListChanged()
{
    rescanDevices();
    if (onDeviceListChanged)
        onDeviceListChanged();
}

void Engine::audioDeviceIOCallbackWithContext (const float* const* inputs, int numInputs,
                                               float* const* outputs, int numOutputs,
                                               int numSamples,
                                               const juce::AudioIODeviceCallbackContext& context)
{
    if (numInputs > 0 && inputs[0] != nullptr)
    {
        const auto range = juce::FloatVectorOperations::findMinAndMax (inputs[0], numSamples);
        storePeak (peaks[in1], std::max (range.getEnd(), -range.getStart()));
    }

    player.audioDeviceIOCallbackWithContext (inputs, numInputs, outputs, numOutputs, numSamples, context);

    const auto db = gainDb.load();
    master.setTargetValue (muted.load() || panic.load() || db <= silenceDb ? 0.0f : juce::Decibels::decibelsToGain (db));

    std::array<float, 2> outPeaks {};
    for (int i = 0; i < numSamples; ++i)
    {
        const auto m = master.getNextValue();

        for (int ch = 0; ch < numOutputs; ++ch)
        {
            if (outputs[ch] == nullptr)
                continue;

            outputs[ch][i] *= m;
            if (ch < 2)
                outPeaks[(size_t) ch] = std::max (outPeaks[(size_t) ch], std::abs (outputs[ch][i]));
        }
    }

    storePeak (peaks[out1], outPeaks[0]);
    storePeak (peaks[out2], outPeaks[1]);
}

} // namespace glitch

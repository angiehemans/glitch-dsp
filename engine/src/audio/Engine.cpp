#include "Engine.h"
#include "AbyMerge.h"
#include "BlockMix.h"
#include "ChainStage.h"
#include "OutputMixer.h"

#include <algorithm>
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
    mixerNode = graph.addNode (std::make_unique<OutputMixer>())->nodeID;
    playerNode = graph.addNode (std::make_unique<BackingPlayer>())->nodeID;
    static_assert (OutputMixer::chainSources == 2 * maxChains && OutputMixer::numOutputs == maxChannels
                   && OutputMixer::numSources == OutputMixer::chainSources + BackingPlayer::maxTracks);
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
void Engine::setChains (const std::vector<ChainSpec>& requested, std::function<void()> atSwap)
{
    const auto dropMissing = [this] (std::vector<juce::String>& ids)
    {
        ids.erase (std::remove_if (ids.begin(), ids.end(), [this] (const auto& id) { return ! hasBlock (id); }), ids.end());
    };

    auto chains = requested;
    for (auto& c : chains)
    {
        c.steps.erase (std::remove_if (c.steps.begin(), c.steps.end(),
                                       [this] (const auto& s) { return s.split ? ! hasSplit (s.id) : ! hasBlock (s.id); }),
                       c.steps.end());
        for (auto& s : c.steps)
        {
            dropMissing (s.pathA);
            dropMissing (s.pathB);
        }
    }

    // New chains get their stages now, so their parameters can be set; they fade in on their own.
    for (const auto& c : chains)
    {
        if (chainIn.count (c.id) == 0)
            chainIn[c.id] = graph.addNode (std::make_unique<ChainStage> (false), {}, Update::none)->nodeID;
        for (auto* stages : { &chainOut, &chainOutB })
            if (stages->count (c.id) == 0)
                (*stages)[c.id] = graph.addNode (std::make_unique<ChainStage> (true), {}, Update::none)->nodeID;

        // A mixer slot of its own, kept while the chain exists so its routes stay put.
        if (slots.count (c.id) == 0)
            for (int slot = 0; slot < maxChains; ++slot)
                if (std::none_of (slots.begin(), slots.end(), [slot] (const auto& s) { return s.second == slot; }))
                {
                    slots[c.id] = slot;
                    break;
                }
    }
    applyTuneSilence(); // a chain added while tuning stays quiet

    // Fade out every live chain whose wiring changes, or that goes away.
    std::set<juce::String> ids;
    bool changed = ! nodesToRemove.empty();
    for (const auto& c : chains)
    {
        ids.insert (c.id);
        if (const auto it = appliedChains.find (c.id); it != appliedChains.end() && (atSwap || ! (it->second == c)))
            changed = duck (c.id) || changed;
    }
    if (atSwap)
    {
        // A swap queued earlier still runs, then this one: both set state on blocks that may stay.
        pendingSwap = [first = std::move (pendingSwap), then = std::move (atSwap)] { if (first) first(); then(); };
        changed = true;
    }
    for (const auto& [id, spec] : appliedChains)
        if (ids.count (id) == 0)
            changed = duck (id) || changed;

    pendingChains = chains;
    if (changed || phase == Phase::fadingOut)
    {
        if (changed)
            phaseEnd = juce::Time::getMillisecondCounterHiRes() + 2000.0 * BlockMix::fadeSeconds;
        phase = Phase::fadingOut;
        startTimer (10);
    }
    else
    {
        applyChains (chains);
        if (phase == Phase::fadingIn) // ducked chains may have changed again: give the swap its time
            phaseEnd = juce::Time::getMillisecondCounterHiRes() + 2000.0 * BlockMix::fadeSeconds;
    }
}

void Engine::applyChains (const std::vector<ChainSpec>& chains)
{
    std::set<juce::String> ids;
    for (const auto& c : chains)
        ids.insert (c.id);

    for (auto* stages : { &chainIn, &chainOut, &chainOutB })
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

    for (const auto node : nodesToRemove)
        graph.removeNode (node, Update::none);
    nodesToRemove.clear();

    for (auto it = slots.begin(); it != slots.end();)
    {
        if (ids.count (it->first) == 0)
        {
            setRoutes (it->first, {}, {}); // silent before another chain takes the slot
            it = slots.erase (it);
        }
        else
        {
            ++it;
        }
    }

    for (const auto& connection : graph.getConnections())
        graph.removeConnection (connection, Update::none);

    // Connections to channels the device doesn't have are refused by the graph, which leaves them silent.
    for (int ch = 0; ch < maxChannels; ++ch)
        graph.addConnection ({ { mixerNode, ch }, { outputNode, ch } }, Update::none);
    for (int ch = 0; ch < BackingPlayer::maxTracks * 2; ++ch) // track i on the mixer's sources after the chains'
        graph.addConnection ({ { playerNode, ch }, { mixerNode, OutputMixer::chainSources * 2 + ch } }, Update::none);

    for (const auto& c : chains)
    {
        const auto in = chainIn[c.id], out = chainOut[c.id];

        for (int ch = 0; ch < 2; ++ch)
            graph.addConnection ({ { inputNode, c.input }, { in, ch } }, Update::none);

        auto previous = in;
        for (const auto& step : c.steps)
        {
            if (! step.split)
            {
                previous = connectBlocks (previous, { step.id });
                continue;
            }

            // Both paths start from the same point; an empty path is the dry signal.
            const auto merge = splits[step.id];
            connect (connectBlocks (previous, step.pathA), merge, 0, 2);
            connect (connectBlocks (previous, step.pathB), merge, 2, 2);
            if (auto* m = dynamic_cast<AbyMerge*> (graph.getNodeForId (merge)->getProcessor()))
                m->split.store (step.exitSplit); // the chain is faded out, so the switch doesn't click
            previous = merge;

            if (step.exitSplit)
            {
                const auto outB = chainOutB[c.id];
                for (int ch = 0; ch < 2; ++ch)
                    graph.addConnection ({ { merge, ch + 2 }, { outB, ch } }, Update::none);
                break; // a split exit ends the chain
            }
        }
        connect (previous, out); // a split's outputs 0-1 are path A, or the merged sum

        // Both output stages always feed the mixer; path B's is silent unless the chain splits.
        const auto slot = slots[c.id];
        connect (out, mixerNode, slot * 4, 2);
        connect (chainOutB[c.id], mixerNode, slot * 4 + 2, 2);
    }

    graph.rebuild();

    appliedChains.clear();
    for (const auto& c : chains)
        appliedChains[c.id] = c;
}

void Engine::setRoutes (const juce::String& chainId, const std::vector<Send>& main, const std::vector<Send>& pathB)
{
    const auto it = slots.find (chainId);
    auto* mixer = dynamic_cast<OutputMixer*> (graph.getNodeForId (mixerNode)->getProcessor());
    if (it == slots.end() || mixer == nullptr)
        return;

    for (int source = 0; source < 2; ++source)
        mixer->setGains (it->second * 2 + source, gainsFor (source == 0 ? main : pathB, 1.0f));
}

void Engine::setTrackRoutes (int track, const std::vector<Send>& sends, float levelDb, bool isMuted)
{
    auto* mixer = dynamic_cast<OutputMixer*> (graph.getNodeForId (mixerNode)->getProcessor());
    if (mixer == nullptr || track < 0 || track >= BackingPlayer::maxTracks)
        return;
    const auto scale = isMuted || levelDb <= silenceDb ? 0.0f : juce::Decibels::decibelsToGain (levelDb);
    mixer->setGains (OutputMixer::chainSources + track, gainsFor (sends, scale));
}

BackingPlayer& Engine::getPlayer()
{
    return *dynamic_cast<BackingPlayer*> (graph.getNodeForId (playerNode)->getProcessor());
}

std::array<std::array<float, Engine::maxChannels>, 2> Engine::gainsFor (const std::vector<Send>& sends, float scale)
{
    OutputMixer::SourceGains gains {};
    for (const auto& send : sends)
    {
        if (send.muted || send.levelDb <= silenceDb || send.outputs.empty())
            continue;
        const auto g = scale * juce::Decibels::decibelsToGain (send.levelDb);
        const auto valid = [] (int out) { return out >= 0 && out < maxChannels; };

        if (send.outputs.size() >= 2)
        {
            if (valid (send.outputs[0])) gains[0][(size_t) send.outputs[0]] += g;
            if (valid (send.outputs[1])) gains[1][(size_t) send.outputs[1]] += g;
        }
        else if (valid (send.outputs[0]))
        {
            gains[0][(size_t) send.outputs[0]] += 0.5f * g;
            gains[1][(size_t) send.outputs[0]] += 0.5f * g;
        }
    }
    return gains;
}

bool Engine::duck (const juce::String& chainId)
{
    auto* b = getStage (chainOutB, chainId);
    if (b != nullptr)
        b->ducked.store (true);
    auto* stage = getStage (chainOut, chainId);
    return stage != nullptr && ! stage->ducked.exchange (true);
}

void Engine::connect (NodeID from, NodeID to, int firstInput, int numInputs)
{
    const auto outs = graph.getNodeForId (from)->getProcessor()->getTotalNumOutputChannels();
    const auto ins = numInputs >= 0 ? numInputs : graph.getNodeForId (to)->getProcessor()->getTotalNumInputChannels();

    // Stereo into mono takes the left channel; mono into stereo feeds both.
    for (int ch = 0; ch < ins && outs > 0; ++ch)
        graph.addConnection ({ { from, std::min (ch, outs - 1) }, { to, firstInput + ch } }, Update::none);
}

Engine::NodeID Engine::connectBlocks (NodeID from, const std::vector<juce::String>& blockIds)
{
    auto previous = from;
    for (const auto& blockId : blockIds)
    {
        if (const auto it = blocks.find (blockId); it != blocks.end())
        {
            const auto mix = mixes[blockId];
            connect (previous, it->second);
            connect (it->second, mix, 0, 2);
            connect (previous, mix, 2, 2);
            previous = mix;
        }
    }
    return previous;
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
    for (auto* stages : { &chainOut, &chainOutB })
    {
        if (auto* stage = getStage (*stages, chainId))
        {
            stage->levelDb.store (levelDb);
            stage->muted.store (isMuted);
        }
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
    mixes[blockId] = graph.addNode (std::make_unique<BlockMix>(), {}, Update::none)->nodeID;
    return true;
}

void Engine::removeBlock (const juce::String& blockId)
{
    if (const auto it = blocks.find (blockId); it != blocks.end())
    {
        // Its chain keeps playing it until setChains has faded the chain out.
        nodesToRemove.push_back (it->second);
        nodesToRemove.push_back (mixes[blockId]);
        blocks.erase (it);
        mixes.erase (blockId);
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
    const auto it = blocks.find (blockId);
    auto* node = it != blocks.end() ? graph.getNodeForId (it->second) : nullptr;
    auto* mix = node != nullptr ? dynamic_cast<BlockMix*> (graph.getNodeForId (mixes[blockId])->getProcessor()) : nullptr;
    if (mix == nullptr)
        return;

    // Enabling: wake the block, then fade it in. Disabling: fade it out, and stop running it
    // (saving its CPU) once the fade is over, in timerCallback.
    if (enabled)
        node->setBypassed (false);
    else if (mix->wet.load())
    {
        bypassEnd = juce::Time::getMillisecondCounterHiRes() + 4000.0 * BlockMix::fadeSeconds;
        startTimer (10);
    }
    mix->wet.store (enabled);
}

void Engine::finishBypasses()
{
    for (const auto& [blockId, nodeId] : blocks)
        if (auto* mix = dynamic_cast<BlockMix*> (graph.getNodeForId (mixes[blockId])->getProcessor()); mix != nullptr && ! mix->wet.load())
            graph.getNodeForId (nodeId)->setBypassed (true);
}

void Engine::timerCallback()
{
    const auto now = juce::Time::getMillisecondCounterHiRes();

    if (bypassEnd > 0 && now >= bypassEnd)
    {
        bypassEnd = 0;
        finishBypasses();
    }

    if (phase == Phase::fadingOut && now >= phaseEnd)
    {
        if (auto swap = std::exchange (pendingSwap, {}))
            swap();
        applyChains (pendingChains);
        // The new wiring swaps in on the audio thread's next buffer: fade in only after that.
        phase = Phase::fadingIn;
        phaseEnd = now + 2000.0 * BlockMix::fadeSeconds;
    }
    else if (phase == Phase::fadingIn && now >= phaseEnd)
    {
        phase = Phase::idle;
        for (auto* stages : { &chainOut, &chainOutB })
            for (const auto& [id, node] : *stages)
                if (auto* stage = getStage (*stages, id))
                    stage->ducked.store (false);
    }

    if (bypassEnd <= 0 && phase == Phase::idle)
        stopTimer();
}

void Engine::addSplit (const juce::String& abyId)
{
    if (! hasSplit (abyId))
        splits[abyId] = graph.addNode (std::make_unique<AbyMerge>(), {}, Update::none)->nodeID;
}

void Engine::removeSplit (const juce::String& abyId)
{
    if (const auto it = splits.find (abyId); it != splits.end())
    {
        nodesToRemove.push_back (it->second); // removed once its chain has faded, like a block
        splits.erase (it);
    }
}

juce::StringArray Engine::getSplitIds() const
{
    juce::StringArray ids;
    for (const auto& [id, node] : splits)
        ids.add (id);
    return ids;
}

void Engine::setSplitParams (const juce::String& abyId, const SplitParams& params)
{
    const auto it = splits.find (abyId);
    auto* node = it != splits.end() ? graph.getNodeForId (it->second) : nullptr;
    if (auto* merge = node != nullptr ? dynamic_cast<AbyMerge*> (node->getProcessor()) : nullptr)
    {
        merge->both.store (params.both);
        merge->activeB.store (params.activeB);
        for (int p = 0; p < 2; ++p)
            merge->muted[p].store (params.muted[p]);
    }
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

void Engine::setTuneMode (bool on, int tunerInput, const juce::String& keepChainId)
{
    tunerChannel = tunerInput;
    keepChain = keepChainId;
    tuning = on;
    if (on)
        tuner.start (getSampleRate());
    else
        tuner.stop();
    applyTuneSilence();
}

void Engine::applyTuneSilence()
{
    auto* mixer = dynamic_cast<OutputMixer*> (graph.getNodeForId (mixerNode)->getProcessor());
    for (int slot = 0; slot < maxChains; ++slot)
    {
        const auto it = std::find_if (slots.begin(), slots.end(), [slot] (const auto& s) { return s.second == slot; });
        const auto silenced = tuning.load() && (it == slots.end() || it->first != keepChain);
        for (int source = 0; source < 2; ++source)
            mixer->setSilenced (slot * 2 + source, silenced);
    }
}

float Engine::takeOutputPeakDb (int channel)
{
    if (channel < 0 || channel >= maxChannels)
        return silenceDb;
    return juce::Decibels::gainToDecibels (outputPeaks[(size_t) channel].exchange (0.0f), silenceDb);
}

float Engine::takeChainPeakDb (const juce::String& chainId, bool output)
{
    // A split exit's output meter shows the louder of its two paths.
    auto* stage = getStage (output ? chainOut : chainIn, chainId);
    auto* b = output ? getStage (chainOutB, chainId) : nullptr;
    const auto peak = std::max (stage != nullptr ? stage->peak.exchange (0.0f) : 0.0f, b != nullptr ? b->peak.exchange (0.0f) : 0.0f);
    return juce::Decibels::gainToDecibels (peak, silenceDb);
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
    // The tuner hears its input before any chain, so effects and amps don't sway the reading.
    if (const auto ch = tunerChannel.load(); tuning.load() && ch < numInputs && inputs[ch] != nullptr)
        tuner.push (inputs[ch], numSamples);

    if (numInputs > 0 && inputs[0] != nullptr)
    {
        const auto range = juce::FloatVectorOperations::findMinAndMax (inputs[0], numSamples);
        storePeak (peaks[in1], std::max (range.getEnd(), -range.getStart()));
    }

    player.audioDeviceIOCallbackWithContext (inputs, numInputs, outputs, numOutputs, numSamples, context);

    const auto db = gainDb.load();
    master.setTargetValue (muted.load() || panic.load() || db <= silenceDb ? 0.0f : juce::Decibels::decibelsToGain (db));

    std::array<float, maxChannels> outPeaks {};
    for (int i = 0; i < numSamples; ++i)
    {
        const auto m = master.getNextValue();

        for (int ch = 0; ch < std::min (numOutputs, maxChannels); ++ch)
        {
            if (outputs[ch] == nullptr)
                continue;

            outputs[ch][i] *= m;
            outPeaks[(size_t) ch] = std::max (outPeaks[(size_t) ch], std::abs (outputs[ch][i]));
        }
    }

    for (int ch = 0; ch < maxChannels; ++ch)
        storePeak (outputPeaks[(size_t) ch], outPeaks[(size_t) ch]);
}

} // namespace glitch

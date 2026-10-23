#pragma once

#include <juce_audio_devices/juce_audio_devices.h>
#include <juce_audio_processors/juce_audio_processors.h>
#include <juce_audio_utils/juce_audio_utils.h>

#include <array>
#include <atomic>
#include <map>

namespace glitch
{

class ChainStage;

// Owns the audio device and the rig's audio graph. Each chain is
//   hardware input -> input stage (meter) -> plugins in order -> output stage (level, mute, meter) -> outputs
// and every chain sums into the outputs. A master stage (the monitor fader, mute and panic) then
// scales every output, in this class's own device callback around the graph.
// Structural changes go through juce::AudioProcessorGraph, which rebuilds off the audio thread.
// Parameters are atomics. Message thread for everything public.
class Engine : private juce::AudioIODeviceCallback,
               private juce::AudioIODeviceType::Listener
{
public:
    static constexpr int maxChains = 8;   // plan's v1 soft limit
    static constexpr int maxChannels = 8; // hardware inputs/outputs opened
    static constexpr float silenceDb = -100.0f; // mirrors SILENCE_DB in packages/protocol

    enum Meter { in1, out1, out2, numMeters };

    struct ChainSpec
    {
        juce::String id;
        int input = 0;                   // 0-based hardware input
        std::vector<int> outputs;        // 0-based hardware outputs: a pair is L/R, one gets both
        std::vector<juce::String> blockIds; // in order; blocks without a node are skipped
    };

    explicit Engine (const juce::XmlElement* savedDeviceState);
    ~Engine() override;

    // Master stage
    void setGainDb (float db)        { gainDb.store (db); }
    void setMuted (bool shouldMute)  { muted.store (shouldMute); }
    void setPanic (bool shouldPanic) { panic.store (shouldPanic); }
    float getGainDb() const { return gainDb.load(); }
    bool isMuted() const    { return muted.load(); }
    bool isPanic() const    { return panic.load(); }

    /** Rewires the graph to match. Creates and removes chain stages; blocks are added separately. */
    void setChains (const std::vector<ChainSpec>&);
    void setChainParams (const juce::String& chainId, float levelDb, bool isMuted);

    bool addBlock (const juce::String& blockId, std::unique_ptr<juce::AudioPluginInstance>);
    void removeBlock (const juce::String& blockId);
    bool hasBlock (const juce::String& blockId) const { return blocks.count (blockId) > 0; }
    juce::StringArray getBlockIds() const;
    void setBlockEnabled (const juce::String& blockId, bool enabled);
    juce::AudioProcessor* getBlockProcessor (const juce::String& blockId) const;

    /** Peaks since the last call, in dBFS. */
    float takePeakDb (Meter m);
    float takeChainPeakDb (const juce::String& chainId, bool output);

    double getCpuUsage() const { return deviceManager.getCpuUsage(); }
    double getSampleRate() const;
    int getBlockSize() const;

    juce::AudioDeviceManager& getDeviceManager() { return deviceManager; }
    juce::String getDeviceError() const { return deviceError; }
    void rescanDevices();
    /** Called (message thread) when a device is plugged in or out, after rescanning. Types that
        announce it: CoreAudio, JACK, Windows. ALSA doesn't; the owner polls for that. */
    std::function<void()> onDeviceListChanged;
    /** Switches device; a name the type only has for one direction keeps the other side as it is. */
    juce::String selectDevice (const juce::String& type, const juce::String& name);

private:
    using NodeID = juce::AudioProcessorGraph::NodeID;

    void audioDeviceIOCallbackWithContext (const float* const* inputs, int numInputs,
                                           float* const* outputs, int numOutputs,
                                           int numSamples,
                                           const juce::AudioIODeviceCallbackContext&) override;
    void audioDeviceAboutToStart (juce::AudioIODevice*) override;
    void audioDeviceStopped() override;
    void audioDeviceError (const juce::String&) override;
    void audioDeviceListChanged() override;

    ChainStage* getStage (const std::map<juce::String, NodeID>&, const juce::String& chainId) const;
    void connect (NodeID from, NodeID to);
    static void storePeak (std::atomic<float>& slot, float peak);

    juce::AudioDeviceManager deviceManager;
    juce::String deviceError;

    juce::AudioProcessorGraph graph;
    juce::AudioProcessorPlayer player;
    NodeID inputNode, outputNode;
    std::map<juce::String, NodeID> chainIn, chainOut, blocks;

    std::atomic<float> gainDb { 0.0f };
    std::atomic<bool> muted { false };
    std::atomic<bool> panic { false };
    std::array<std::atomic<float>, numMeters> peaks {};
    juce::SmoothedValue<float> master; // audio thread only

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (Engine)
};

} // namespace glitch

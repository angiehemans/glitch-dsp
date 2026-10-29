#pragma once

#include <juce_audio_devices/juce_audio_devices.h>
#include <juce_audio_processors/juce_audio_processors.h>
#include <juce_audio_utils/juce_audio_utils.h>

#include "BackingPlayer.h"
#include "Tuner.h"

#include <array>
#include <atomic>
#include <map>

namespace glitch
{

class ChainStage;

// Owns the audio device and the rig's audio graph. Each chain is
//   hardware input -> input stage (meter) -> plugins in order -> output stage (level, mute, meter) -> outputs
// with a BlockMix after each plugin that crossfades it against its own input for click-free bypass.
// Rewiring a chain fades its output stage out first and back in after, so edits don't click either.
// An ABY step feeds both of its paths from the same point and joins them again in an AbyMerge,
// or, as a split exit, ends the chain with path B through a second output stage.
// Every output stage feeds the OutputMixer on its own source slot, and the mixer's gains (the
// routes) send it to hardware outputs, so routing changes never rewire. A master stage (the monitor fader, mute and panic) then
// scales every output, in this class's own device callback around the graph.
// Structural changes go through juce::AudioProcessorGraph, which rebuilds off the audio thread.
// Parameters are atomics. Message thread for everything public.
class Engine : private juce::AudioIODeviceCallback,
               private juce::AudioIODeviceType::Listener,
               private juce::Timer
{
public:
    static constexpr int maxChains = 8;   // plan's v1 soft limit
    static constexpr int maxChannels = 8; // hardware inputs/outputs opened
    static constexpr float silenceDb = -100.0f; // mirrors SILENCE_DB in packages/protocol

    enum Meter { in1, numMeters };

    struct ChainSpec
    {
        juce::String id;
        int input = 0;                   // 0-based hardware input
        struct Step
        {
            juce::String id;                        // a block, or an ABY block when split is true
            bool split = false;
            bool exitSplit = false;                 // the paths go to separate outputs; must be the last step
            std::vector<juce::String> pathA, pathB; // a split's blocks, in order

            bool operator== (const Step& o) const { return id == o.id && split == o.split && exitSplit == o.exitSplit && pathA == o.pathA && pathB == o.pathB; }
        };
        std::vector<Step> steps; // in order; blocks and splits without a node are skipped

        bool operator== (const ChainSpec& o) const { return input == o.input && steps == o.steps; }
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

    /** Rewires the graph to match. Creates and removes chain stages; blocks are added separately.
        Chains that change are faded out first, so the rewiring itself lands a moment later.
        With atSwap (a preset load), every chain fades out, and atSwap runs just before the rewiring. */
    void setChains (const std::vector<ChainSpec>&, std::function<void()> atSwap = {});
    void setChainParams (const juce::String& chainId, float levelDb, bool isMuted);

    /** A crosspoint of the output matrix: 0-based hardware outputs (a pair takes left and right, a
        single output the two summed at half each, so a mono chain keeps its level), a level and a mute. */
    struct Send { std::vector<int> outputs; float levelDb = 0.0f; bool muted = false; };
    /** Where a chain's output goes, and its ABY's path B when that splits to separate outputs.
        Only gains change: no rewiring, no fade. */
    void setRoutes (const juce::String& chainId, const std::vector<Send>& main, const std::vector<Send>& pathB);
    /** Where a backing track (0-based, in the loaded song's order) goes: its sends, scaled by its level. */
    void setTrackRoutes (int track, const std::vector<Send>& sends, float levelDb, bool isMuted);

    /** The song's tracks; load, play and stop on it directly. Message thread. */
    BackingPlayer& getPlayer();

    bool addBlock (const juce::String& blockId, std::unique_ptr<juce::AudioProcessor>);
    void removeBlock (const juce::String& blockId);
    bool hasBlock (const juce::String& blockId) const { return blocks.count (blockId) > 0; }
    juce::StringArray getBlockIds() const;
    void setBlockEnabled (const juce::String& blockId, bool enabled);
    juce::AudioProcessor* getBlockProcessor (const juce::String& blockId) const;

    /** ABY splits, by their block id. Their paths' blocks are ordinary blocks. */
    void addSplit (const juce::String& abyId);
    void removeSplit (const juce::String& abyId);
    bool hasSplit (const juce::String& abyId) const { return splits.count (abyId) > 0; }
    juce::StringArray getSplitIds() const;
    struct SplitParams { bool both = false, activeB = false; bool muted[2] { false, false }; };
    void setSplitParams (const juce::String& abyId, const SplitParams&);

    /** Peaks since the last call, in dBFS. */
    float takePeakDb (Meter m);
    float takeChainPeakDb (const juce::String& chainId, bool output);
    /** Tune mode: every chain but keepChainId (none: all) fades out of the outputs, and the tuner
        listens to a hardware input (0-based) before any chain. Off restores everything as it was. */
    void setTuneMode (bool on, int tunerInput, const juce::String& keepChainId);
    bool isTuning() const { return tuning.load(); }
    /** The tuner's latest reading in Hz, 0 for no clear pitch. */
    float getTunerHz() const { return tuner.getHz(); }

    /** A hardware output's peak (0-based), after the master stage. */
    float takeOutputPeakDb (int channel);

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
    /** Restarts the device at this sample rate and/or buffer size (0 = keep). Returns an error, or {}. */
    juce::String setFormat (double sampleRate, int bufferSize);

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
    void timerCallback() override;

    ChainStage* getStage (const std::map<juce::String, NodeID>&, const juce::String& chainId) const;
    bool duck (const juce::String& chainId); // fades both output stages; true if it wasn't already
    void connect (NodeID from, NodeID to, int firstInput = 0, int numInputs = -1);
    NodeID connectBlocks (NodeID from, const std::vector<juce::String>& blockIds);
    void applyChains (const std::vector<ChainSpec>&);
    void finishBypasses();
    static void storePeak (std::atomic<float>& slot, float peak);

    juce::AudioDeviceManager deviceManager;
    juce::String deviceError;

    juce::AudioProcessorGraph graph;
    juce::AudioProcessorPlayer player;
    NodeID inputNode, outputNode, mixerNode, playerNode;
    static std::array<std::array<float, maxChannels>, 2> gainsFor (const std::vector<Send>&, float scale);
    std::map<juce::String, int> slots; // chain id -> its sources on the mixer: 2 * slot (main), 2 * slot + 1 (path B)
    std::map<juce::String, NodeID> chainIn, chainOut, chainOutB, blocks, mixes, splits; // chainOutB: path B of a split exit; mixes: by block id; splits: AbyMerge by ABY id

    // Rewiring and bypass both wait for fades; the timer runs while either is due.
    enum class Phase { idle, fadingOut, fadingIn };
    Phase phase = Phase::idle;
    double phaseEnd = 0, bypassEnd = 0; // Time::getMillisecondCounterHiRes
    std::vector<ChainSpec> pendingChains;
    std::function<void()> pendingSwap;
    std::map<juce::String, ChainSpec> appliedChains;
    std::vector<NodeID> nodesToRemove; // removed blocks, kept playing until their chain has faded

    std::atomic<float> gainDb { 0.0f };
    std::atomic<bool> muted { false };
    std::atomic<bool> panic { false };
    std::array<std::atomic<float>, numMeters> peaks {};
    std::array<std::atomic<float>, maxChannels> outputPeaks {};

    Tuner tuner;
    std::atomic<bool> tuning { false };
    std::atomic<int> tunerChannel { 0 };
    juce::String keepChain; // tune mode's live chain
    void applyTuneSilence(); // message thread: silences mixer sources for tune mode
    juce::SmoothedValue<float> master; // audio thread only

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (Engine)
};

} // namespace glitch

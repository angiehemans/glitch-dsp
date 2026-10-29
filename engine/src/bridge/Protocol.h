#pragma once

// Mirrors packages/protocol. Adding a command: commands.ts, this file, WebUi.cpp and mockEngine.ts.
namespace glitch::protocol
{
    inline constexpr auto commandEvent = "glitch:command"; // UI -> engine
    inline constexpr auto engineEvent  = "glitch:event";   // engine -> UI

    namespace command
    {
        inline constexpr auto appReady       = "app.ready";
        inline constexpr auto monitorSetGain = "monitor.setGain";
        inline constexpr auto monitorSetMute = "monitor.setMute";
        inline constexpr auto panicToggle    = "panic.toggle";
        inline constexpr auto projectCreate  = "project.create";
        inline constexpr auto projectOpen    = "project.open";
        inline constexpr auto projectRename  = "project.rename";
        inline constexpr auto chainRename    = "chain.rename";
        inline constexpr auto chainRemove    = "chain.remove";
        inline constexpr auto chainCreate    = "chain.create";
        inline constexpr auto chainSetInputs = "chain.setInputs";
        inline constexpr auto chainSetOutputs = "chain.setOutputs";
        inline constexpr auto chainSetLevel  = "chain.setLevel";
        inline constexpr auto chainSetMute   = "chain.setMute";
        inline constexpr auto chainSplitAt   = "chain.splitAt";
        inline constexpr auto abySetMode     = "aby.setMode";
        inline constexpr auto abySelect      = "aby.select";
        inline constexpr auto abySetMute     = "aby.setMute";
        inline constexpr auto abySetExit     = "aby.setExit";
        inline constexpr auto abySetOutputs  = "aby.setOutputs";
        inline constexpr auto deviceScan     = "device.scan";
        inline constexpr auto deviceSelect   = "device.select";
        inline constexpr auto deviceSetFormat = "device.setFormat";
        inline constexpr auto pluginsScan    = "plugins.scan";
        inline constexpr auto libraryImport  = "library.import";
        inline constexpr auto blockAdd       = "block.add";
        inline constexpr auto blockRemove    = "block.remove";
        inline constexpr auto blockToggle    = "block.toggle";
        inline constexpr auto blockOpenEditor = "block.openEditor";
        inline constexpr auto blockMove      = "block.move";
        inline constexpr auto routeSet       = "route.set";
        inline constexpr auto routeRemove    = "route.remove";
        inline constexpr auto presetSave     = "preset.save";
        inline constexpr auto presetSaveAs   = "preset.saveAs";
        inline constexpr auto presetLoad     = "preset.load";
        inline constexpr auto presetRename   = "preset.rename";
        inline constexpr auto presetDelete   = "preset.delete";
        inline constexpr auto midiSelect     = "midi.selectDevice";
        inline constexpr auto midiForgetSwitch = "midi.forgetSwitch";
        inline constexpr auto mappingSet     = "mapping.set";
        inline constexpr auto mappingClear   = "mapping.clear";
        inline constexpr auto mappingHoldMs  = "mapping.setHoldMs";
        inline constexpr auto footswitchPage = "footswitch.setPage";
        inline constexpr auto footswitchPress = "footswitch.press";
        inline constexpr auto songImport     = "song.import";
        inline constexpr auto songSelect     = "song.select";
        inline constexpr auto songRename     = "song.rename";
        inline constexpr auto songSetPreset  = "song.setPreset";
        inline constexpr auto songDelete     = "song.delete";
        inline constexpr auto trackMixSet    = "trackMix.set";
        inline constexpr auto transportPlay  = "transport.play";
        inline constexpr auto transportStop  = "transport.stop";
        inline constexpr auto transportRestart = "transport.restart";
        inline constexpr auto transportNext  = "transport.next";
        inline constexpr auto transportPrev  = "transport.prev";
        inline constexpr auto setlistCreate  = "setlist.create";
        inline constexpr auto setlistSelect  = "setlist.select";
        inline constexpr auto setlistRename  = "setlist.rename";
        inline constexpr auto setlistDelete  = "setlist.delete";
        inline constexpr auto setlistAddSong = "setlist.addSong";
        inline constexpr auto setlistRemoveSong = "setlist.removeSong";
        inline constexpr auto setlistMoveSong = "setlist.moveSong";
        inline constexpr auto setlistSetAutoAdvance = "setlist.setAutoAdvance";
        inline constexpr auto tuneToggle     = "tune.toggle";
        inline constexpr auto tuneSetInput   = "tune.setInput";
        inline constexpr auto tuneSetReference = "tune.setReference";
        inline constexpr auto tuneSetVocalChain = "tune.setVocalChain";
    }

    namespace event
    {
        inline constexpr auto state     = "state";
        inline constexpr auto meters    = "meters";
        inline constexpr auto transport = "transport";
        inline constexpr auto tuner     = "tuner";
        inline constexpr auto switch_   = "switch";
        inline constexpr auto error     = "error";
    }
}

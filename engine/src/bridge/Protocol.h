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
        inline constexpr auto deviceScan     = "device.scan";
        inline constexpr auto deviceSelect   = "device.select";
        inline constexpr auto deviceSetFormat = "device.setFormat";
        inline constexpr auto pluginsScan    = "plugins.scan";
        inline constexpr auto libraryImport  = "library.import";
        inline constexpr auto blockAdd       = "block.add";
        inline constexpr auto blockRemove    = "block.remove";
        inline constexpr auto blockToggle    = "block.toggle";
        inline constexpr auto blockOpenEditor = "block.openEditor";
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

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

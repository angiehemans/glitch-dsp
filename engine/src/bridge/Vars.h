#pragma once

#include "../audio/Engine.h"

// Small helpers for the JSON (juce::var) the UI sends and the project stores.
namespace glitch::vars
{

inline juce::var object (std::initializer_list<std::pair<const char*, juce::var>> props)
{
    auto* obj = new juce::DynamicObject();
    for (const auto& [key, value] : props)
        obj->setProperty (key, value);
    return obj;
}

/** A user-typed name: trimmed, single line, at most 60 characters. Empty means "invalid". */
inline juce::String cleanName (const juce::var& v)
{
    return v.toString().replaceCharacters ("\r\n\t", "   ").trim().substring (0, 60).trim();
}

inline bool isChannel (const juce::var& v)
{
    return (v.isInt() || v.isInt64()) && (int) v >= 1 && (int) v <= Engine::maxChannels;
}

/** Hardware outputs for a send, checked: one or two valid, distinct channels, else empty. */
inline juce::Array<juce::var> sendChannels (const juce::var& requested)
{
    juce::Array<juce::var> hwChannels;
    if (auto* list = requested.getArray())
        for (const auto& ch : *list)
            if (isChannel (ch) && ! hwChannels.contains ((int) ch))
                hwChannels.add ((int) ch);
    return hwChannels.size() == requested.size() && hwChannels.size() <= 2 ? hwChannels : juce::Array<juce::var>();
}

/** An outputs list's first hwChannels, checked like sendChannels. */
inline juce::Array<juce::var> outputChannels (const juce::var& outputs)
{
    return sendChannels (outputs[0]["hwChannels"]);
}

/** A matrix send: hardware outputs (one, or a left/right pair) with a level and mute. */
inline juce::var newSend (const juce::var& hwChannels = juce::Array<juce::var> { 1, 2 })
{
    return object ({ { "hwChannels", hwChannels }, { "level", 0.0 }, { "pan", 0.0 }, { "mute", false } });
}

} // namespace glitch::vars

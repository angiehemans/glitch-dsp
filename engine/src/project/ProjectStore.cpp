#include "ProjectStore.h"

namespace glitch
{

// Matches ChainStrip's and ProjectCard's `color` variants.
const juce::StringArray ProjectStore::colours { "orange", "cyan", "pink", "lime", "violet" };

namespace
{
    juce::var object()
    {
        return new juce::DynamicObject();
    }

    juce::var arrayOf (std::initializer_list<juce::var> items)
    {
        return juce::Array<juce::var> (items);
    }

    juce::int64 now()
    {
        return juce::Time::currentTimeMillis();
    }

    juce::String newId()
    {
        return juce::Uuid().toDashedString().substring (0, 8);
    }

    void setDefault (juce::DynamicObject& obj, const juce::Identifier& key, const juce::var& value)
    {
        if (! obj.hasProperty (key))
            obj.setProperty (key, value);
    }

    /** Fills missing fields, so older or hand-edited files load. */
    juce::var normaliseChain (const juce::var& chain)
    {
        auto* obj = chain.getDynamicObject();
        if (obj == nullptr || chain["id"].toString().isEmpty())
            return {};

        setDefault (*obj, "name", "Chain");
        setDefault (*obj, "color", ProjectStore::colours[0]);
        setDefault (*obj, "mode", "mono");
        setDefault (*obj, "blocks", juce::Array<juce::var>());
        setDefault (*obj, "bypassed", false);
        setDefault (*obj, "muted", false);

        juce::Array<juce::var> blocks;
        if (auto* loaded = chain["blocks"].getArray())
            for (const auto& b : *loaded)
                if (b.getDynamicObject() != nullptr && b["id"].toString().isNotEmpty() && b["type"].toString().isNotEmpty())
                    blocks.add (b);
        obj->setProperty ("blocks", blocks);

        if (! chain["inputs"].isArray() || chain["inputs"].size() == 0)
        {
            auto input = object();
            input.getDynamicObject()->setProperty ("hwChannel", 1);
            input.getDynamicObject()->setProperty ("gain", 0.0);
            obj->setProperty ("inputs", arrayOf ({ input }));
        }

        if (! chain["outputs"].isArray() || chain["outputs"].size() == 0)
        {
            auto output = object();
            output.getDynamicObject()->setProperty ("hwChannels", arrayOf ({ 1, 2 }));
            output.getDynamicObject()->setProperty ("level", 0.0);
            output.getDynamicObject()->setProperty ("pan", 0.0);
            obj->setProperty ("outputs", arrayOf ({ output }));
        }

        return chain;
    }
}

juce::var ProjectStore::normaliseProject (const juce::var& project)
{
    auto* obj = project.getDynamicObject();
    if (obj == nullptr || project["id"].toString().isEmpty())
        return {};

    setDefault (*obj, "name", "Untitled project");
    setDefault (*obj, "color", colours[0]);
    setDefault (*obj, "openedAt", now());
    setDefault (*obj, "mainOutput", arrayOf ({ 1, 2 }));
    setDefault (*obj, "setlists", juce::Array<juce::var>());
    setDefault (*obj, "songPresets", object());
    setDefault (*obj, "trackMix", object());
    if (! project["pluginStates"].isObject())
        obj->setProperty ("pluginStates", object());

    juce::Array<juce::var> chains;
    if (auto* loaded = project["chains"].getArray())
        for (const auto& c : *loaded)
            if (auto chain = normaliseChain (c); ! chain.isVoid())
                chains.add (chain);
    obj->setProperty ("chains", chains);

    return project;
}

juce::File ProjectStore::getDataDir()
{
    const auto base = juce::File::getSpecialLocation (juce::File::userApplicationDataDirectory);
   #if JUCE_MAC
    return base.getChildFile ("Application Support/Glitch");
   #else
    return base.getChildFile ("Glitch");
   #endif
}

ProjectStore::ProjectStore()
{
    for (const auto& file : getDataDir().getChildFile ("projects").findChildFiles (juce::File::findFiles, true, "project.json"))
        if (auto project = normaliseProject (juce::JSON::parse (file)); ! project.isVoid())
            projects.add (project);

    settings = juce::JSON::parse (getDataDir().getChildFile ("settings.json"));
    if (! settings.isObject())
        settings = object();
    open (settings["lastProjectId"].toString());
}

ProjectStore::~ProjectStore()
{
    saveIfDirty();
}

juce::var ProjectStore::getSummaries() const
{
    auto sorted = projects;
    std::sort (sorted.begin(), sorted.end(), [] (const juce::var& a, const juce::var& b)
    {
        return (juce::int64) a["openedAt"] > (juce::int64) b["openedAt"];
    });

    juce::Array<juce::var> result;
    for (const auto& p : sorted)
    {
        auto summary = object();
        auto* obj = summary.getDynamicObject();
        obj->setProperty ("id", p["id"]);
        obj->setProperty ("name", p["name"]);
        obj->setProperty ("color", p["color"]);
        obj->setProperty ("chainCount", p["chains"].size());
        obj->setProperty ("openedAt", p["openedAt"]);
        result.add (summary);
    }
    return result;
}

juce::Array<juce::var>* ProjectStore::getCurrentChains() const
{
    return current["chains"].getArray();
}

juce::var ProjectStore::findChain (const juce::String& chainId) const
{
    if (auto* chains = getCurrentChains())
        for (const auto& c : *chains)
            if (c["id"].toString() == chainId)
                return c;
    return {};
}

void ProjectStore::create (const juce::String& name)
{
    auto project = object();
    auto* obj = project.getDynamicObject();
    obj->setProperty ("id", newId());
    obj->setProperty ("name", name);
    obj->setProperty ("color", colours[projects.size() % colours.size()]);
    obj->setProperty ("createdAt", now());

    projects.add (normaliseProject (project));
    open (project["id"].toString());
}

bool ProjectStore::open (const juce::String& projectId)
{
    saveIfDirty(); // the project being left

    for (const auto& p : projects)
    {
        if (p["id"].toString() == projectId)
        {
            current = p;
            current.getDynamicObject()->setProperty ("openedAt", now());
            markDirty();
            saveSettings();
            return true;
        }
    }
    return false;
}

juce::var ProjectStore::addChain (const juce::String& name)
{
    auto* chains = getCurrentChains();
    jassert (chains != nullptr);

    auto chain = object();
    chain.getDynamicObject()->setProperty ("id", newId());
    chain.getDynamicObject()->setProperty ("name", name);
    chain.getDynamicObject()->setProperty ("color", colours[chains->size() % colours.size()]);
    chains->add (normaliseChain (chain));
    markDirty();
    return chain;
}

void ProjectStore::saveIfDirty()
{
    if (! dirty || ! current.isObject())
        return;

    const auto file = getDataDir().getChildFile ("projects").getChildFile (current["id"].toString()).getChildFile ("project.json");
    file.getParentDirectory().createDirectory();

    // Write to a temp file and move it over, so a crash mid-write never leaves a broken project.
    juce::TemporaryFile temp (file);
    if (temp.getFile().replaceWithText (juce::JSON::toString (current)) && temp.overwriteTargetFileWithTemporary())
    {
        dirty = false;
    }
    else
    {
        DBG ("Failed to save " << file.getFullPathName());
    }
}

juce::var ProjectStore::findBlock (const juce::String& blockId) const
{
    if (auto* chains = getCurrentChains())
        for (const auto& c : *chains)
            if (auto* blocks = c["blocks"].getArray())
                for (const auto& b : *blocks)
                    if (b["id"].toString() == blockId)
                        return b;
    return {};
}

void ProjectStore::addBlock (const juce::var& chain, const juce::var& block, int index)
{
    if (auto* blocks = chain["blocks"].getArray())
    {
        blocks->insert (index < 0 || index > blocks->size() ? blocks->size() : index, block);
        markDirty();
    }
}

void ProjectStore::removeBlock (const juce::String& blockId)
{
    if (auto* chains = getCurrentChains())
        for (const auto& c : *chains)
            if (auto* blocks = c["blocks"].getArray())
                for (int i = blocks->size(); --i >= 0;)
                    if ((*blocks)[i]["id"].toString() == blockId)
                        blocks->remove (i);

    if (auto* states = current["pluginStates"].getDynamicObject())
        states->removeProperty (blockId);
    markDirty();
}

juce::String ProjectStore::getPluginState (const juce::String& blockId) const
{
    return current["pluginStates"][juce::Identifier (blockId)].toString();
}

void ProjectStore::setPluginState (const juce::String& blockId, const juce::String& base64)
{
    auto* states = current["pluginStates"].getDynamicObject();
    if (states == nullptr || states->getProperty (blockId).toString() == base64)
        return;
    states->setProperty (blockId, base64);
    markDirty();
}

std::unique_ptr<juce::XmlElement> ProjectStore::getDeviceState() const
{
    return juce::parseXML (settings["audioDevice"].toString());
}

void ProjectStore::setDeviceState (const juce::XmlElement& xml)
{
    settings.getDynamicObject()->setProperty ("audioDevice", xml.toString (juce::XmlElement::TextFormat().singleLine()));
    saveSettings();
}

void ProjectStore::saveSettings() const
{
    settings.getDynamicObject()->setProperty ("lastProjectId", current["id"]);
    const auto file = getDataDir().getChildFile ("settings.json");
    file.getParentDirectory().createDirectory();
    file.replaceWithText (juce::JSON::toString (settings));
}

} // namespace glitch

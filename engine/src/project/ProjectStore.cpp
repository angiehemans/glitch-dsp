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

    juce::var object (std::initializer_list<std::pair<const char*, juce::var>> properties)
    {
        auto result = object();
        for (const auto& [key, value] : properties)
            result.getDynamicObject()->setProperty (key, value);
        return result;
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

    juce::var newPath()
    {
        auto path = object();
        auto* obj = path.getDynamicObject();
        obj->setProperty ("blocks", juce::Array<juce::var>());
        obj->setProperty ("mute", false);
        return path;
    }

    void normaliseAby (const juce::var& aby);

    /** The well-formed blocks of a list. ABY blocks are only allowed at the top of a chain (no nesting in v1). */
    juce::Array<juce::var> validBlocks (const juce::var& list, bool allowAby)
    {
        juce::Array<juce::var> blocks;
        if (auto* loaded = list.getArray())
        {
            for (const auto& b : *loaded)
            {
                if (b.getDynamicObject() == nullptr || b["id"].toString().isEmpty() || b["type"].toString().isEmpty())
                    continue;
                if (b["type"].toString() == "aby")
                {
                    if (! allowAby)
                        continue;
                    normaliseAby (b);
                }
                blocks.add (b);
            }
        }
        return blocks;
    }

    void normaliseAby (const juce::var& aby)
    {
        auto& obj = *aby.getDynamicObject();
        setDefault (obj, "name", "ABY");
        setDefault (obj, "enabled", true);
        setDefault (obj, "mode", "AB");
        setDefault (obj, "active", "A");
        setDefault (obj, "exit", "merge");
        if (! aby["splitOutputs"]["A"].isArray() || ! aby["splitOutputs"]["B"].isArray())
            obj.setProperty ("exit", "merge"); // nowhere to send a split's paths
        setDefault (obj, "crossfadeMs", 10);
        setDefault (obj, "alignLatency", true);

        for (const auto* key : { "pathA", "pathB" })
        {
            if (! aby[key].isObject())
                obj.setProperty (key, newPath());
            auto& path = *aby[key].getDynamicObject();
            setDefault (path, "mute", false);
            path.setProperty ("blocks", validBlocks (aby[key]["blocks"], false));
        }
    }

    /** Fills missing fields, so older or hand-edited files load. */
    juce::var newOutput (const juce::var& hwChannels)
    {
        auto output = object();
        auto* o = output.getDynamicObject();
        o->setProperty ("hwChannels", hwChannels);
        o->setProperty ("level", 0.0);
        o->setProperty ("pan", 0.0);
        o->setProperty ("mute", false);
        return output;
    }

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

        obj->setProperty ("blocks", validBlocks (chain["blocks"], true));

        if (! chain["inputs"].isArray() || chain["inputs"].size() == 0)
        {
            auto input = object();
            input.getDynamicObject()->setProperty ("hwChannel", 1);
            input.getDynamicObject()->setProperty ("gain", 0.0);
            obj->setProperty ("inputs", arrayOf ({ input }));
        }

        if (! chain["outputs"].isArray())
            obj->setProperty ("outputs", arrayOf ({ newOutput (arrayOf ({ 1, 2 })) }));

        // The chain's fader used to be its first output's level; now outputs are matrix sends.
        if (! chain.hasProperty ("level"))
        {
            obj->setProperty ("level", chain["outputs"][0].hasProperty ("level") ? (double) chain["outputs"][0]["level"] : 0.0);
            for (const auto& output : *chain["outputs"].getArray())
                if (auto* o = output.getDynamicObject())
                    o->setProperty ("level", 0.0);
        }

        // Every send (the chain's, and a split ABY's) has a level, pan and mute.
        juce::Array<juce::var> sendLists { chain["outputs"] };
        for (const auto& b : *chain["blocks"].getArray())
            for (const auto* path : { "A", "B" })
                sendLists.add (b["splitOutputs"][path]);
        for (const auto& list : sendLists)
            if (auto* sends = list.getArray())
                for (const auto& send : *sends)
                    if (auto* o = send.getDynamicObject())
                    {
                        setDefault (*o, "level", 0.0);
                        setDefault (*o, "pan", 0.0);
                        setDefault (*o, "mute", false);
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
            loadPresets();
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
    if (dirty && current.isObject() && save (current))
        dirty = false;
}

bool ProjectStore::save (const juce::var& project)
{
    return writeJson (getDataDir().getChildFile ("projects").getChildFile (project["id"].toString()).getChildFile ("project.json"), project);
}

bool ProjectStore::writeJson (const juce::File& file, const juce::var& value)
{
    file.getParentDirectory().createDirectory();

    // Write to a temp file and move it over, so a crash mid-write never leaves a broken file.
    juce::TemporaryFile temp (file);
    if (temp.getFile().replaceWithText (juce::JSON::toString (value)) && temp.overwriteTargetFileWithTemporary())
        return true;

    DBG ("Failed to save " << file.getFullPathName());
    return false;
}

//==============================================================================
namespace
{
    /** Ids of every block in these chains, ABY paths included. */
    juce::StringArray rigBlockIds (const juce::var& chains)
    {
        juce::StringArray ids;
        if (auto* list = chains.getArray())
            for (const auto& c : *list)
                for (auto* blocks : ProjectStore::getBlockLists (c))
                    for (const auto& b : *blocks)
                        ids.add (b["id"].toString());
        return ids;
    }

    /** The chains as JSON without what the engine fills in as it runs (load errors, notes, snapshots),
        for comparing a rig with its preset. */
    juce::String rigJson (const juce::var& chains)
    {
        const auto copy = chains.clone();
        if (auto* list = copy.getArray())
            for (const auto& c : *list)
                for (auto* blocks : ProjectStore::getBlockLists (c))
                    for (const auto& b : *blocks)
                        if (auto* o = b.getDynamicObject())
                            for (const auto* key : { "missing", "note", "snapshotAt", "snapshotWidth", "snapshotHeight" })
                                o->removeProperty (key);
        return juce::JSON::toString (copy, true);
    }
}

juce::File ProjectStore::getPresetsDir() const
{
    return getDataDir().getChildFile ("projects").getChildFile (current["id"].toString()).getChildFile ("presets");
}

void ProjectStore::loadPresets()
{
    presets.clear();
    for (const auto& file : getPresetsDir().findChildFiles (juce::File::findFiles, false, "*.json"))
    {
        const auto preset = juce::JSON::parse (file);
        if (auto* obj = preset.getDynamicObject(); obj != nullptr && preset["id"].toString() == file.getFileNameWithoutExtension())
        {
            juce::Array<juce::var> chains;
            if (auto* loaded = preset["chains"].getArray())
                for (const auto& c : *loaded)
                    if (auto chain = normaliseChain (c); ! chain.isVoid())
                        chains.add (chain);
            obj->setProperty ("chains", chains);
            if (! preset["pluginStates"].isObject())
                obj->setProperty ("pluginStates", object());
            presets.add (preset);
        }
    }
    std::sort (presets.begin(), presets.end(), [] (const auto& a, const auto& b) { return (juce::int64) a["createdAt"] < (juce::int64) b["createdAt"]; });
}

juce::var ProjectStore::findPreset (const juce::String& presetId) const
{
    for (const auto& p : presets)
        if (p["id"].toString() == presetId)
            return p;
    return {};
}

juce::var ProjectStore::getPresetSummaries() const
{
    juce::Array<juce::var> result;
    for (const auto& p : presets)
        result.add (object ({ { "id", p["id"] }, { "name", p["name"] } }));
    return result;
}

juce::String ProjectStore::savePreset (const juce::String& presetId, const juce::String& name)
{
    auto preset = findPreset (presetId);
    if (! preset.isObject())
    {
        preset = object ({ { "id", newId() }, { "createdAt", now() } });
        presets.add (preset);
    }

    auto* obj = preset.getDynamicObject();
    obj->setProperty ("name", name.isNotEmpty() ? name : preset["name"].toString());
    obj->setProperty ("chains", current["chains"].clone());

    auto states = object();
    for (const auto& id : rigBlockIds (current["chains"]))
        if (const auto state = current["pluginStates"][juce::Identifier (id)]; ! state.isVoid())
            states.getDynamicObject()->setProperty (id, state);
    obj->setProperty ("pluginStates", states);

    writeJson (getPresetsDir().getChildFile (preset["id"].toString() + ".json"), preset);
    current.getDynamicObject()->setProperty ("currentPresetId", preset["id"]);
    markDirty();
    return preset["id"].toString();
}

bool ProjectStore::loadPreset (const juce::String& presetId)
{
    const auto preset = findPreset (presetId);
    if (! preset.isObject())
        return false;

    // The rig's plugin states become the preset's; blocks that aren't in it are gone.
    auto* obj = current.getDynamicObject();
    obj->setProperty ("chains", preset["chains"].clone());
    obj->setProperty ("pluginStates", preset["pluginStates"].clone());
    obj->setProperty ("currentPresetId", presetId);
    markDirty();
    return true;
}

bool ProjectStore::renamePreset (const juce::String& presetId, const juce::String& name)
{
    const auto preset = findPreset (presetId);
    if (! preset.isObject())
        return false;
    preset.getDynamicObject()->setProperty ("name", name);
    return writeJson (getPresetsDir().getChildFile (presetId + ".json"), preset);
}

bool ProjectStore::deletePreset (const juce::String& presetId)
{
    const auto preset = findPreset (presetId);
    if (! preset.isObject())
        return false;
    presets.removeAllInstancesOf (preset);
    getPresetsDir().getChildFile (presetId + ".json").deleteFile();
    if (getCurrentPresetId() == presetId)
    {
        current.getDynamicObject()->removeProperty ("currentPresetId"); // the rig stays, as no preset
        markDirty();
    }
    return true;
}

bool ProjectStore::isPresetModified() const
{
    const auto preset = findPreset (getCurrentPresetId());
    if (! preset.isObject())
        return false;
    if (rigJson (current["chains"]) != rigJson (preset["chains"]))
        return true;
    for (const auto& id : rigBlockIds (current["chains"]))
        if (current["pluginStates"][juce::Identifier (id)] != preset["pluginStates"][juce::Identifier (id)])
            return true;
    return false;
}

bool ProjectStore::renameProject (const juce::String& projectId, const juce::String& name)
{
    for (const auto& p : projects)
    {
        if (p["id"].toString() == projectId)
        {
            p.getDynamicObject()->setProperty ("name", name);
            if (p["id"] == current["id"])
                markDirty();
            else
                save (p);
            return true;
        }
    }
    return false;
}

void ProjectStore::removeChain (const juce::String& chainId)
{
    auto* chains = getCurrentChains();
    if (chains == nullptr)
        return;

    for (int i = chains->size(); --i >= 0;)
    {
        const auto chain = (*chains)[i];
        if (chain["id"].toString() != chainId)
            continue;

        for (auto* list : getBlockLists (chain))
            for (const auto& b : *list)
                forgetBlock (b["id"].toString());

        chains->remove (i);
    }
    markDirty();
}

juce::Array<juce::Array<juce::var>*> ProjectStore::getBlockLists (const juce::var& chain)
{
    juce::Array<juce::Array<juce::var>*> lists;
    if (auto* blocks = chain["blocks"].getArray())
    {
        lists.add (blocks);
        for (const auto& b : *blocks)
            for (const auto* key : { "pathA", "pathB" })
                if (auto* path = b[key]["blocks"].getArray())
                    lists.add (path);
    }
    return lists;
}

juce::var ProjectStore::findBlock (const juce::String& blockId) const
{
    if (auto* chains = getCurrentChains())
        for (const auto& c : *chains)
            for (auto* list : getBlockLists (c))
                for (const auto& b : *list)
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

bool ProjectStore::addBlockToPath (const juce::var& aby, const juce::String& path, const juce::var& block, int index)
{
    auto* blocks = aby[path == "B" ? "pathB" : "pathA"]["blocks"].getArray();
    if (aby["type"].toString() != "aby" || blocks == nullptr || block["type"].toString() == "aby")
        return false;

    blocks->insert (index < 0 || index > blocks->size() ? blocks->size() : index, block);
    markDirty();
    return true;
}

juce::String ProjectStore::moveBlock (const juce::String& blockId, const juce::var& chain, int index,
                                     const juce::String& abyId, const juce::String& path)
{
    auto* to = chain["blocks"].getArray();
    if (abyId.isNotEmpty())
    {
        const auto aby = findBlock (abyId);
        if (aby["type"].toString() != "aby" || findChainOf (abyId)["id"] != chain["id"])
            return "Unknown ABY block: " + abyId;
        to = aby[path == "B" ? "pathB" : "pathA"]["blocks"].getArray();
    }
    if (to == nullptr)
        return "Unknown chain";

    juce::Array<juce::var>* from = nullptr;
    int at = -1;
    if (auto* chains = getCurrentChains())
        for (const auto& c : *chains)
            for (auto* list : getBlockLists (c))
                for (int i = 0; from == nullptr && i < list->size(); ++i)
                    if ((*list)[i]["id"].toString() == blockId)
                        from = list, at = i;
    if (from == nullptr)
        return "Unknown block: " + blockId;

    const auto block = (*from)[at];
    if (block["type"].toString() == "aby" && abyId.isNotEmpty())
        return "An ABY can't go inside another ABY's path";

    if (from == to && index > at)
        --index; // the index counted the block in its old place
    from->remove (at);
    index = index < 0 || index > to->size() ? to->size() : index;
    to->insert (index, block);

    // A split to separate outputs ends its chain, so it has to stay the last block.
    for (const auto& c : *getCurrentChains())
        if (auto* blocks = c["blocks"].getArray())
            for (int i = 0; i < blocks->size() - 1; ++i)
                if ((*blocks)[i]["type"].toString() == "aby" && (*blocks)[i]["exit"].toString() == "split")
                {
                    to->remove (index);
                    from->insert (at, block);
                    return "A split to separate outputs has to stay at the end of its chain";
                }

    markDirty();
    return {};
}

juce::var ProjectStore::findChainOf (const juce::String& blockId) const
{
    if (auto* chains = getCurrentChains())
        for (const auto& c : *chains)
            for (auto* list : getBlockLists (c))
                for (const auto& b : *list)
                    if (b["id"].toString() == blockId)
                        return c;
    return {};
}

juce::var ProjectStore::splitAt (const juce::var& chain, int index)
{
    auto* blocks = chain["blocks"].getArray();
    if (blocks == nullptr)
        return {};
    index = juce::jlimit (0, blocks->size(), index);

    // "Split here": the blocks after the split move into path A; path B starts empty.
    auto aby = object();
    auto* obj = aby.getDynamicObject();
    obj->setProperty ("id", newId());
    obj->setProperty ("type", "aby");
    normaliseAby (aby);
    auto* pathA = aby["pathA"]["blocks"].getArray();
    for (int i = index; i < blocks->size(); ++i)
    {
        if ((*blocks)[i]["type"].toString() == "aby")
            return {}; // no ABY inside a path in v1
        pathA->add ((*blocks)[i]);
    }

    blocks->removeRange (index, blocks->size() - index);
    blocks->add (aby);
    markDirty();
    return aby;
}

void ProjectStore::removeBlock (const juce::String& blockId)
{
    if (auto* chains = getCurrentChains())
    {
        for (const auto& c : *chains)
        {
            for (auto* list : getBlockLists (c))
            {
                for (int i = list->size(); --i >= 0;)
                {
                    const auto b = (*list)[i];
                    if (b["id"].toString() != blockId)
                        continue;

                    list->remove (i);
                    if (b["type"].toString() == "aby")
                    {
                        // Removing a split keeps path A in the chain, in its place, and drops path B.
                        if (auto* pathA = b["pathA"]["blocks"].getArray())
                            for (int j = pathA->size(); --j >= 0;)
                                list->insert (i, (*pathA)[j]);
                        if (auto* pathB = b["pathB"]["blocks"].getArray())
                            for (const auto& gone : *pathB)
                                forgetBlock (gone["id"].toString());
                    }
                    forgetBlock (blockId);
                    markDirty();
                    return;
                }
            }
        }
    }
}

void ProjectStore::forgetBlock (const juce::String& blockId)
{
    if (auto* states = current["pluginStates"].getDynamicObject())
        states->removeProperty (blockId);
    getSnapshotFile (current["id"].toString(), blockId).deleteFile();
    markDirty();
}

juce::File ProjectStore::getSnapshotFile (const juce::String& projectId, const juce::String& blockId)
{
    return getDataDir().getChildFile ("projects").getChildFile (projectId).getChildFile ("snapshots").getChildFile (blockId + ".png");
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

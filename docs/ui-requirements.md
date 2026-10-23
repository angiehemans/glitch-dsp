# DIY Rig: UI Requirements

Companion to `rig-plan.md`. Covers every view and every reusable component (with states) for the Scamp / Preact UI running inside the JUCE WebView.

---

## 1. Design Principles

- **Stage first.** Readable from 6 feet away on a dark stage. Big type, high contrast, no information carried by color alone.
- **Large targets.** Minimum 44 px hit area, 56 px or more for anything used during a show.
- **Feet first, hands second.** Anything needed mid-song must also be reachable from the footswitch. The UI shows what the switches will do.
- **Engine is the truth.** The UI renders engine state and shows pending state while a command is in flight. It never assumes success.
- **No surprise audio changes.** Destructive or loud actions (delete chain, change device, unmute all) need a confirmation or an undo.
- **Dark theme by default.** A light theme is optional, for setup at home.
- **Keyboard and mouse are fine for setup.** Show views can assume no keyboard.

### Global conventions
- **Signal colors:** each chain has a user-picked color, used on its strip, routing rows and meters.
- **Status colors:** green = signal / active, amber = warning (near clip, high CPU), red = clip / error / muted-by-panic. Always paired with an icon or label.
- **Units:** dB shown to one decimal, pan as L/C/R with a number (e.g. L30), time in ms or m:ss.
- **Motion:** 150 ms or less for UI transitions. Meters update at ~30 Hz without animation easing.

---

## 2. App Shell

Persistent frame around every view except fullscreen overlays.

**Contents**
- **Top bar:** current project (name + color, opens project switcher), current preset name (with modified dot), current song (if a setlist is loaded), CPU meter, audio device status, MIDI device status, panic button.
- **Nav:** Projects, Rig, Routing, Setlists, Perform, Settings. Icon + label. Collapsible to icons only.
- **Status toasts:** bottom-right, for errors and confirmations.
- **Footswitch strip (optional):** a slim bar showing the 4 switch labels for the current page. Can be pinned in any view.

**States**
- No project open (only Projects and Settings are enabled in the nav)
- Normal
- Switching project (full overlay with progress: "Loading Full Band, IEMs", audio faded out)
- Audio device disconnected (top bar shows red device status, banner across the top with "Reconnect" action)
- MIDI device disconnected (amber MIDI status, non-blocking)
- Panic active (red banner: "All outputs muted", with "Unmute" action)
- Tune mode active (tuner overlay covers the shell)
- Engine unresponsive (full overlay: "Audio engine not responding", with "Restart engine")

---

## 3. Views

### 3.0 Projects
Home view. A project is one complete rig: chains, presets, footswitch mappings, setlists and per-song track mixes.

**Layout**
- Grid of **Project Cards**, most recently opened first
- "New project" card at the start of the grid
- Search (when there are more than ~8 projects)

**Each card shows**
- Name, color, last opened
- Summary: number of chains, presets and setlists
- Main output pair (e.g. "Main: Out 1/2")
- Overflow menu: Open, Rename, Duplicate, Change color, Export, Delete

**New project flow**
- Name and color
- Start from: Empty, Template (e.g. Guitar to FOH, Guitar + vocals, Bass), or Duplicate an existing project
- Main output pair (default Out 1/2)

**States**
- Empty (no projects): "Create your first project" with templates
- Normal
- Current project (card highlighted, "Open" badge)
- Opening (card shows progress)
- Project has missing files or plugins (warning badge on card)
- Switch while playing (confirm: "Stop playback and switch to <project>?")
- Delete confirm (notes that library songs and setlists are not deleted)

### 3.0a Project Switcher
Popover from the top bar project name, for quick switching without leaving the current view.

**Contents**
- Recent projects list
- "All projects" link to the Projects view
- "New project"

**States**
- Default
- Switching (selected row shows progress)
- Confirm while playing

### 3.1 Rig (chain editor)
The main editing view. All signal chains as horizontal strips.

**Layout**
- One **Chain Strip** per chain, stacked vertically, scrollable.
- "Add chain" button at the bottom.
- Selected block opens the **Block Editor** panel (right side panel or bottom sheet).

**Each strip shows**
- Chain header: color swatch, name, mono/stereo badge, bypass toggle, overflow menu (rename, color, duplicate, delete)
- Input chips (left)
- Block sequence, with ABY blocks forking into two lanes
- Output chips (right)
- Input meter and output meter

**Interactions**
- Click/tap a block: select it and open Block Editor
- Click a block's power icon: bypass
- Drag a block: reorder within a chain or move between ABY lanes
- "+" between blocks: open **Block Picker** at that position
- Right-click / long-press a block: context menu (bypass, duplicate, delete, split here, MIDI learn)
- Click input or output chip: open **I/O Picker**

**States**
- Empty (no chains yet): illustration + "Add your first chain" with a suggested template (Guitar to FOH)
- Normal
- Chain bypassed (strip dimmed, "Bypassed" badge)
- Block loading (block shows spinner, rest of chain still live)
- Block failed to load (block shows error state, chain still passes audio around it)
- CPU near limit (amber banner: "CPU at 80%. Adding blocks may cause dropouts.")
- Unsaved changes (preset name shows modified dot)

### 3.2 Block Picker
Modal or popover for adding a block.

**Contents**
- Search field
- Category tabs: Amps (NAM), Cabs (IR), Effects (hosted plugins), Utility, Splitter (ABY)
- Results list or grid with name, type, and vendor (for plugins)
- Recently used and favorites sections

**States**
- Default (recents + favorites)
- Searching (filtered results)
- No results
- Plugin scan in progress (inline progress bar in the Effects tab)
- Plugin blocklisted (shown greyed with "Crashed during scan" note and "Retry" action)

### 3.3 Block Editor
Panel for editing the selected block. Content varies by block type.

**Common header:** block name, type icon, bypass toggle, mix knob (if supported), MIDI learn button, preset-level vs. snapshot indicator (later), close.

**Per type**
- **NAM:** model file picker (from library), model info (name, size class: feather/lite/standard), input gain, output gain, CPU cost estimate
- **IR:** IR file picker, waveform preview, low cut, high cut, level
- **Plugin:** generic parameter list (searchable), "Open plugin window" button, plugin latency readout
- **Utility:** controls for gain, EQ, gate, as relevant
- **ABY:** see 3.4

**States**
- Normal
- Loading file
- File missing (path no longer exists: "Locate file" action)
- Plugin window open (button shows "Plugin window open", focus action)
- Parameter in MIDI learn (that control pulses, "Press a footswitch or move a controller")

### 3.4 ABY Block Editor
Specialized Block Editor for the splitter.

**Contents**
- Mode toggle: Y / AB (large segmented control)
- Active path selector: A / B (AB mode only)
- Per-path level fader, pan, mute
- Exit selector: Merge / Split
- Split outputs pickers (Split only)
- Crossfade time (ms)
- Latency alignment toggle, with readout of compensation applied
- "Suspend inactive path" toggle (AB mode)
- Merge meter with clip indicator (Y + Merge)

**States**
- Y + Merge
- Y + Split
- AB, A active
- AB, B active
- Switching (brief crossfade indicator)
- Merge clipping (meter red, warning text)
- One path empty (empty lane shows "Add a block or leave empty for a dry path")

### 3.5 I/O Picker
Popover for choosing a chain's inputs or outputs.

**Contents**
- List of hardware channels with user names (e.g. "In 1: Guitar", "Out 3: Stage amp")
- Multi-select checkboxes
- Per-selection gain (inputs) or level + pan (outputs)
- Stereo pair toggle for outputs (e.g. 1/2)

**States**
- Default
- Channel in use by other chains (shows small badges of the other chains' colors)
- Device has fewer channels than the preset expects (missing channels shown struck through with a warning)

### 3.6 Routing (output matrix)
The "where does everything go" view.

**Layout**
- Grid: rows are sources, columns are hardware outputs.
- Row groups: Chains (and ABY split paths), Tracks (every track of the current song, using this project's track mix).
- Column headers: output name and output meter.
- Each cell is a **Matrix Cell** (level + mute).
- Row header: source name, color, solo, mute.

**Interactions**
- Click empty cell: route at 0 dB
- Drag vertically on a cell: adjust level
- Double-click a cell: reset to 0 dB
- Click active cell's mute: mute that crosspoint

**States**
- No song loaded (track rows show "No song loaded", greyed)
- Track rows at default routing ("Main" badge on the row until edited)
- Normal
- Source muted / soloed
- Output clipping (column header red)
- Tune mode active (non-vocal cells shown muted with a tune icon, read-only)
- Panic active (all cells shown muted, read-only)

### 3.7 Setlists and Songs
Library and setlist management, scoped to the current project or the app-wide library.

**Layout**
- **Scope switcher** at the top: This project / Library
- Left column: setlists in the current scope, then the selected setlist's ordered song list (drag to reorder)
- Right column: **Song Detail** for the selected song
- Top actions: New setlist, Import setlist, Import song, Add library setlist to project (project scope only)

**Scope behavior**
- **This project:** shows the project's setlists. Song Detail includes the project's track mix (outputs, level, pan, mute per track).
- **Library:** shows standalone setlists and all songs. Song Detail shows tracks with their default level only (no routing, since routing belongs to projects). Each library setlist shows which projects use a copy of it.

**Song Detail contents**
- Title, BPM (info), notes, duration (longest track)
- **Track list:** one **Track Row** per track, in order. Any number of tracks.
  - Name, role tag (Backing, Stem, Click, Cue), file, mini waveform, preview
  - Project scope: **Output chips** (default "Main"), level fader, pan, mute
  - Library scope: default level
- "Add track" (opens file picker, new track routes to Main in every project)
- "Reset routing to Main" (project scope, per track or all tracks)
- Linked preset for this song (project scope)

**States**
- Empty library: "Import your first song"
- Empty project (no setlists): "Create a setlist or add one from your library"
- Empty setlist
- Track at default routing (output chip reads "Main", neutral style)
- Track with custom routing (output chips list outputs, accent style)
- Track muted
- Song with missing files (Track Row shows error, "Locate file")
- Song with resampled files (info badge)
- Importing (progress per file)
- Previewing (one track or the whole song, through the preview output)
- Setlist loaded for performance (badge)
- Library setlist that's out of date compared to a project copy (info badge only, no auto-sync)

### 3.7a Add Setlist to Project
Dialog opened from the project scope.

**Contents**
- List of library setlists with song count and duration
- Search
- Note: "A copy is added to this project. All tracks route to Main (Out 1/2). You can change routing per track afterwards."

**States**
- Default
- Setlist already added (row shows "Already in this project", option to add another copy)
- Adding (progress while track mix entries are created)
- Added (toast with "Open setlist" action)

### 3.8 Song Import Flow
Modal wizard, opened from Setlists and Songs.

**Steps**
1. **Choose files:** drag-and-drop zone or file picker. Accepts WAV / AIFF. One song can have any number of tracks.
2. **Name tracks:** each file becomes a track. Name defaults to the filename; role (Backing, Stem, Click, Cue) is auto-guessed from the filename and editable. Reorder by drag.
3. **Details:** title, BPM, notes, and which setlist to add it to (optional).
4. **Confirm:** summary, then import (copy + resample if needed).

Routing is not part of import. In the current project every new track goes to Main; the user edits routing in Song Detail afterwards.

**States**
- Unsupported file type (file listed with error)
- Duplicate file (warning, can keep)
- Length mismatch warning (info only)
- More than 16 tracks (warning about the v1 soft limit, can continue)
- Importing / done / failed

### 3.8a Setlist Import
Opened from "Import setlist".

**Steps**
1. Choose a setlist file or a folder of songs
2. Review songs found (new songs vs. songs already in the library)
3. Destination: Library only, or Library + this project
4. Import

**States**
- Songs already in library (reuse existing, shown with "Existing" badge)
- Missing audio referenced by the setlist file (listed, can import the rest)
- Importing / done / failed

### 3.9 Perform
Show view. Fullscreen-capable, glanceable from 6 feet.

**Contents**
- **Now playing:** song title (very large), elapsed / remaining time, progress bar
- **Up next:** next song title
- **Transport state:** playing / stopped / ready, large icon
- **Footswitch Panel:** 4 large switch tiles showing tap and hold labels for the current page, with active state (e.g. Drive on) and hold progress
- **Page indicator**
- **Chain summary:** compact list of chains with key blocks on/off and ABY A/B state
- **Output meters:** compact, one per hardware output
- **CPU and device status:** small, corner

**States**
- No setlist loaded: "Load a setlist" action (still usable as a stompbox view)
- Ready (song loaded, stopped)
- Playing
- Song ending (last 10 s: remaining time turns amber)
- Between songs (auto-advance countdown, or "Press Next")
- End of setlist
- Tune mode (tuner overlay)
- Panic (red full-width banner)
- Device lost (red banner, transport disabled)

### 3.10 Tuner Overlay
Fullscreen overlay opened by tune mode.

**Contents**
- Note name (huge), octave (small)
- Cents offset with needle or strobe
- Hz readout
- Input selector (e.g. In 1 Guitar / In 2 Bass), large toggle
- "Vocals live" indicator showing which chain is still passing audio
- "Backing tracks paused" indicator
- Exit hint: "Tap any switch to exit"

**States**
- No signal (note shows "–", needle centered and dimmed)
- Flat / sharp (needle offset, arrows)
- In tune (within ±2 cents: green fill + check icon)
- No vocal chain set (indicator reads "All outputs muted")

### 3.11 Presets
Presets browser for the current project, opened from the top bar preset name. Presets belong to a project.

**Contents**
- List of the project's presets with name, last modified, linked songs count
- "Copy from another project" action
- Actions: Load, Save, Save as, Rename, Duplicate, Delete, Import, Export
- Search

**States**
- Current preset (highlighted)
- Unsaved changes on load attempt (dialog: Save / Discard / Cancel)
- Loading (crossfading to new preset)
- Load failed (missing plugin or file: list of missing items, "Load anyway" with those blocks disabled)

### 3.12 Footswitch Mapping
Under Settings, and reachable from any MIDI learn action.

**Contents**
- Visual of 4 switches per page, with Tap and Hold slots per switch
- Page list (add, rename, reorder, delete)
- Layer toggle: Project vs. This preset
- Per-switch hold time override
- Global hold threshold slider (default 500 ms)
- Live input monitor: shows incoming MIDI and which switch it maps to

**States**
- Unassigned slot
- Assigned slot (action name + target)
- Learning (slot pulses, "Press a switch")
- Conflict (same switch + gesture already used on this page: "Replace" or "Cancel")
- Preset override of a project mapping (badge "Overrides project")
- MIDI device not connected

### 3.13 Settings
Tabs:

- **Audio:** device, sample rate, buffer size, measured round-trip latency, test tone
- **Channels:** rename hardware inputs and outputs, set stereo pairs
- **MIDI:** device selection, footswitch mapping (3.12)
- **Library:** NAM folder, IR folder, songs folder, plugin scan (rescan, blocklist management)
- **Project:** name, color, main output pair, footswitch project layer (link to 3.12)
- **Tune mode (per project):** vocal chain default, tuner input default, backing tracks pause/mute, A4 reference
- **Show:** startup behavior (restore last project, preset and setlist, start muted and fade in), auto-advance default
- **Appearance:** theme, UI scale

**States**
- Changing device (confirm dialog: "Audio will stop briefly")
- Buffer too small (dropouts detected: amber warning with suggestion)
- Plugin scan running / complete / crashed plugin found

### 3.14 Dialogs and Overlays
- Confirm destructive action (delete chain, delete song, delete preset)
- Unsaved changes
- Engine restart
- Missing files resolver (list of missing files with Locate / Skip)
- Crash recovery on launch ("Restored last session" toast, or "Previous session crashed. Restored last saved preset.")
- About / version

---

## 4. Reusable Components

Each component lists props worth noting and its states. "Disabled" and "focus-visible" apply to every interactive component and aren't repeated.

### 4.1 Controls

**Button**
- Variants: primary, secondary, ghost, danger, icon-only
- Sizes: sm, md, lg (lg for show views)
- States: default, hover, pressed, disabled, loading, focus-visible

**Toggle (power / bypass)**
- States: on, off, pending (command sent, awaiting engine), disabled, MIDI-learning

**Segmented Control**
- Used for: Y / AB, A / B, Merge / Split, mono / stereo
- States: each option selected / unselected, pending, disabled

**Knob**
- Props: value, min, max, default, unit, curve (linear / log), label
- Interaction: vertical drag, fine adjust with modifier, double-click to reset, scroll wheel
- States: default, hover, dragging, at-default, modulated by MIDI (indicator), MIDI-learning, disabled

**Fader**
- Props: value (dB), range, unity mark
- States: default, dragging, at unity, muted (dimmed), clipping (track turns red when signal clips), MIDI-learning

**Pan Control**
- States: center (snap indicator), left, right, dragging

**Number Input**
- Props: value, unit, step, min, max
- States: default, editing, invalid, disabled

**Text Input / Search Field**
- States: empty (placeholder), filled, focused, error, disabled; search adds clear button

**Dropdown / Select**
- States: closed, open, selected, empty, error

**Checkbox / Multi-select item**
- States: checked, unchecked, indeterminate, disabled

**Slider (settings)**
- Used for hold threshold, crossfade time, UI scale
- States: default, dragging, disabled

### 4.2 Signal and Routing

**Meter**
- Props: orientation, mono / stereo, peak hold
- States: silent, signal, hot (amber, above -6 dBFS), clip (red, latched until clicked), muted (hatched)

**CPU Meter**
- States: normal, warning (above 70%), critical (above 90%), dropout detected (flash + count)

**I/O Chip**
- Shows hardware channel name, direction (in / out)
- States: connected, missing on current device, in use elsewhere (badge), selected, hover

**Block Tile**
- Props: type, name, icon, color accent
- States: active, bypassed (dimmed, power off), selected, loading, error, missing file, dragging, drop target, MIDI-mapped (small switch badge), high CPU cost badge

**Block Insert Point ("+")**
- States: hidden, hover-revealed, drop target during drag

**ABY Fork**
- Renders the split node, two lanes and the merge node or split outputs
- States: Y + Merge, Y + Split, AB with A active, AB with B active, switching, merge clipping, lane empty

**Chain Strip**
- Composes header, I/O chips, block tiles, ABY fork, meters
- States: normal, selected, bypassed, collapsed (header + meters only), dragging (reorder chains), error (a block failed)

**Chain Header**
- States: normal, editing name, bypassed, overflow menu open

**Matrix Cell**
- States: unrouted (empty), routed (shows level), muted, dragging (live value tooltip), clipping, read-only (tune / panic), soloed-out (dimmed)

**Source Row Header** (routing)
- States: normal, muted, soloed, group header

### 4.3 Projects, Setlists and Tracks

**Project Card**
- Props: name, color, last opened, chain / preset / setlist counts, main output
- States: default, hover, current (open), opening, missing files warning, menu open

**Project Switcher Row**
- States: default, hover, current, switching

**Scope Switcher**
- Segmented control: This project / Library
- States: project selected, library selected, project unavailable (no project open)

**Setlist Card / Row**
- Props: name, song count, duration, owner (project / library), used-in-projects count (library)
- States: default, selected, loaded for performance, empty, already in this project (in Add dialog)

**Track Row**
- Props: name, role, file, channels, outputs, level, pan, mute, scope
- States: default routing ("Main"), custom routing, muted, previewing, file missing, resampled (info badge), importing, dragging (reorder), library scope (default level only, no routing)

**Track Output Chip**
- Shows where a track goes: "Main" or the list of outputs
- States: default (Main, neutral), custom (accent), output missing on current device (struck through), open (I/O Picker)

**Role Tag**
- Variants: Backing, Stem, Click, Cue
- States: auto-guessed (dotted outline until confirmed), set

**Waveform**
- States: loading, ready, playing (playhead), missing

**Transport Controls**
- Buttons: play / stop, previous, next, restart
- States: stopped, playing, loading next song, disabled (no song / device lost)

**Progress Bar (song)**
- States: stopped, playing, ending (amber in last 10 s), complete

**Setlist Song Item**
- States: default, selected, now playing, up next, played (dimmed), dragging, missing files (warning icon)

**Drop Zone (file import)**
- States: idle, drag over (valid), drag over (invalid type), processing

### 4.4 Footswitch

**Footswitch Tile**
- Shows tap label and hold label for one switch
- States: idle, pressed (down), hold in progress (progress ring filling), hold triggered (flash), target active (e.g. Drive on: lit), target inactive, unassigned, MIDI-learning, device disconnected

**Footswitch Panel**
- 4 tiles + page indicator
- States: normal, page changing (brief transition), device disconnected

**Mapping Slot** (mapping editor)
- States: unassigned, assigned, learning, conflict, overrides global

**MIDI Activity Indicator**
- States: idle, receiving (blink), unmapped message received (amber blink)

### 4.5 Tuner

**Tuner Display**
- Props: note, octave, cents, hz
- States: no signal, flat, sharp, in tune

**Tuner Input Toggle**
- States: each input selected / unselected

### 4.6 Feedback and Structure

**Status Badge**
- Variants: info, success, warning, error, neutral
- Used for: modified preset, bypassed, mono / stereo, overrides global, resampled

**Toast**
- Variants: info, success, warning, error
- States: entering, visible, with action (e.g. Undo), dismissing

**Banner** (persistent, top of view)
- Variants: warning (CPU), error (device lost, panic, engine)
- States: visible, with action, dismissible / non-dismissible

**Modal / Dialog**
- Sizes: sm (confirm), md (picker), lg (import wizard)
- States: open, closing, with error, loading (action in progress)

**Side Panel / Bottom Sheet** (Block Editor)
- States: closed, open, resizing, pinned

**Context Menu**
- States: open, item hover, item disabled, submenu open

**Popover** (I/O Picker)
- States: open, anchored above / below

**Tabs**
- States: selected, unselected, with badge (e.g. scan running)

**Empty State**
- Props: icon, title, body, primary action

**Spinner / Progress**
- Variants: inline spinner, determinate bar (import, scan)

**Panic Button**
- States: armed (normal), active (all muted, red, pulsing), confirm-unmute (requires second press or hold)

**Device Status Indicator**
- Variants: audio, MIDI
- States: connected, disconnected, reconnecting, error

---

## 5. Engine State the UI Depends On

The UI needs these from `state`, `meters`, `transport`, `tuner` and `switch` events:

- Projects list (name, color, last opened, counts) and current project
- Library songs and setlists, project setlists
- Track mix for the current song (outputs, level, pan, mute per track, plus default-routing flag)
- Chains, blocks, ABY configuration, bypass states, block load status and errors
- Routing matrix (all crosspoints with level / mute)
- Current preset (within the project), modified flag
- Current song, setlist, transport position, next song
- Device info: name, channel count and names, sample rate, buffer size, latency
- MIDI device status and mappings (project + preset)
- Footswitch page and per-switch down / held / up
- Tune mode on / off, tuner readings, selected tuner input
- Panic state
- CPU load and dropout count
- Plugin scan status and blocklist
- Per-source and per-output meter levels

---

## 6. Responsive and Accessibility

- **Target screen:** 13" laptop at 1440 × 900 (2017 MacBook Pro default scaled). Must also work at 1280 × 800.
- **UI scale setting:** 100%, 125%, 150% for stage distance.
- **Minimum text size:** 14 px for setup views, 20 px for Perform, 96 px or more for tuner note and song title.
- **Contrast:** WCAG AA minimum, AAA for Perform and Tuner.
- **Keyboard:** full keyboard navigation in setup views. Shortcuts for panic (Esc held), play/stop (Space), next (→), tune mode (T).
- **Reduced motion:** respect the OS setting; meters still update but transitions are instant.

---

## 7. Open UI Questions

- Block Editor as a right side panel or a bottom sheet? Bottom sheet keeps chain strips full width on a 13" screen.
- Should Perform include quick block toggles by touch/click, or be footswitch-display only?
- Does Routing need a per-song view (backing track rows) separate from the chain rows, or is one combined matrix clear enough?
- Should the Projects view be the launch screen every time, or should the app reopen the last project directly? (Plan assumes reopen last project.)
- Phone remote later: which views does it need? Likely Perform, Tuner and a simplified Routing.

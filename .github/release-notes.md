A test build of Glitch for macOS 12 (Monterey) and later, universal (Intel and Apple Silicon), with the UI bundled in.

**Install**
1. Download `Glitch.dmg`, open it, and drag Glitch onto Applications.
2. The app isn't signed yet, so macOS blocks the first launch. Right-click Glitch in Applications, choose **Open**, then **Open** again. (Or run `xattr -dr com.apple.quarantine /Applications/Glitch.app` in Terminal.)
3. Allow microphone access when asked, so Glitch can hear your audio interface's inputs.

Projects, plugin lists and snapshots are kept in `~/Library/Application Support/Glitch/`. Plugin scans look in `~/Library/Audio/Plug-Ins` and `/Library/Audio/Plug-Ins` (VST3 and AU).

This is a pre-release: built on GitHub's macOS runner with a newer Xcode than 14.2.

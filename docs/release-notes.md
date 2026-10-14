Fix touch resizing on iPad and show priority when the mobile paper list has enough room.

- Drag the list/detail divider immediately without a long press. Divider touches no longer trigger Obsidian's global drawer swipe gestures; gestures elsewhere remain available.
- Clear the divider highlight after touch/pen release or cancellation. Touch resizing does not steal Notes focus, while mouse hover and keyboard focus retain their feedback.
- Show the Priority column when a mobile public-paper list has at least 560px of available width. It responds to pane resizing and split-screen layouts; narrow lists and manuscript/inbox columns retain their existing layout.

Requires Obsidian 1.8.7+. Existing pane sizes, paper selection, unsaved Notes and library data are preserved.

Validation: 39 regression suites on macOS; desktop, tablet and phone checks in an isolated demo vault, including real Obsidian swipe recognition with synthetic touch events, release/cancel feedback, responsive columns and retained Notes. Release CI tests macOS and Linux (two macOS-only suites are skipped on Linux) and verifies the locked dependency build. Physical mobile-device validation remains outside these checks.

Fix the phone toolbar overlapping the notch/status bar, and animate the stacked detail panel.

- Restore only the system-reported safe-area inset on phones. Version 4.5.1 incorrectly set it to zero; the phone workspace extends behind the status bar. Do not restore the hidden native header’s additional spacing. iPad top spacing is unchanged.
- Keep the detail expand/collapse button. Animate the stacked list/detail split over 240ms with a short list fade, preserving the current paper, scroll container and unsaved Notes. Rapid repeated taps can reverse the transition. Respect reduced motion and keep the collapsed list out of keyboard/assistive focus.
- Preserve the flat 3px divider and desktop UI. No paper, annotation, metadata or settings migration.

Requires Obsidian 1.8.7+. Validation uses the official mobile emulator and synthetic regression tests; physical iPhone/iPad verification still requires the receiving device. Reload the plugin on the phone after all three runtime files have synced.

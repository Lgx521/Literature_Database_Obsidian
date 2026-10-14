Remove the extra top gap on phones and tablets, keeping the detail expand/collapse control.

- Set the mobile library view’s top margin to zero. The plugin no longer adds a status-bar safe-area inset or space for the hidden native header; Obsidian and the OS handle their own chrome.
- Preserve the compact mobile toolbar, expandable details and flat 3px list/detail divider. Desktop layout and all library data remain unchanged.

Requires Obsidian 1.8.7+. Layout and expand/collapse are checked with Obsidian’s official mobile emulator at phone and tablet widths; physical devices are not available for verification. All 29 regression suites pass.

After syncing the three plugin runtime files, reload the plugin on each mobile device so it loads the new JavaScript and CSS. Do not install empty templates over an existing vault.

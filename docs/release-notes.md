Resize the paper list and details, and finish mobile edits without a hardware keyboard. This release skips versions 4.8.1 and 4.8.2.

- Drag the list/detail divider with a mouse or touch. Hover, focus and press highlight the divider; a wider touch target makes it easier to grab on iPad and phones.
- Adjust detail width in a side-by-side layout or list height in a stacked layout. Minimum pane sizes adapt to smaller windows, and each layout remembers its size in workspace view state.
- Keep the selected paper, pane contents and unsaved Notes in place while resizing. Detail expansion remains animated and restores the chosen size on collapse; reduced motion is respected. Keyboard arrows, Shift, Home/End and Escape are supported.
- Confirm mobile sidebar names with Done/Enter or an outside tap, even when the tap does not move focus. Categories, writing projects, venues and subcategories share this behavior. IME composition completes before saving; invalid names retain the draft for correction.
- Cancel an unfinished tag-map group, tag or child tag with a visible mobile cancel button, without closing the map or changing existing selections.

Requires Obsidian 1.8.7+. PDF filenames, citations, private manuscripts and personal notes are preserved. No scheduled agent, telemetry or full-library metadata scan is added.

Validated with 39 synthetic regression suites on macOS and desktop, tablet and phone emulator checks using a separate demo vault. Release CI also runs on Linux (skipping the two macOS-specific suites) and verifies the locked dependency build. Physical mobile devices and Windows/Linux GUI behavior are not part of this validation.

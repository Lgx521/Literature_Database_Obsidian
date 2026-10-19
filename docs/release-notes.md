Literature Database 4.9.5 adds search-and-jump results and improves mobile search.

- Search in a dropdown without changing the paper list. Check **Search all papers** to search across the public library, then select a result to open its category and focus the paper.
- Keep search terms across navigation, with keyboard selection, Chinese input support and a bounded result window for large libraries.
- On mobile, the search-field × clears and closes search and the keyboard. Closing search also handles delayed input events without reopening the menu.
- Keep result menus within 640px and the screen width, scroll vertically, and hover to read complete titles and category paths.
- Add **Show in Finder / file manager** at the top of desktop paper menus. Move subcategory actions below category actions, and current-collection removal beside Trash.

Validation: 63 offline regression suites on macOS, plus synthetic desktop/mobile viewport checks, cross-category navigation and 5,000-result scrolling. Requires Obsidian 1.8.7+.

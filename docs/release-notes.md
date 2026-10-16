Literature Database 4.9.3 adds advanced search and makes repeated searches faster.

- **Clear search in one click.** The search-field × clears the text while retaining advanced conditions and other filters.
- **Combine search conditions.** Search titles, tags, publication dates, venues, TL;DR, filenames and Notes using all/AND or any/OR. Text conditions include contains, excludes, exact match and empty/nonempty; dates support years, months and inclusive ranges.
- **Pick multiple tags visually.** Use the existing tag mind map to match any, all or none of the selected tags. Apply confirms changes; Cancel preserves the previous search.
- **Keep your place.** Searches persist across collections and projects, with existing Notes draft and focus protection.
- **Faster repeated searches.** Reuse sorting and normalized fields with bounded, view-scoped caching. Coalesce typing to one update per frame, wait for IME composition, and release cached data when the view closes.

Validation: 58 offline regression suites on macOS, plus isolated Obsidian checks for search controls, draft protection and dialog cleanup. In the synthetic 10,000-paper benchmark, warm filtering improved from 22.2 to 1.4 ms for plain search and from 33.8 to 1.3 ms for advanced search; these figures exclude painting. Requires Obsidian 1.8.7+.

[Performance measurements](https://github.com/Lgx521/Literature_Database_Obsidian/blob/4.9.3/docs/performance.md)

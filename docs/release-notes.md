Organize categories and writing projects with subcategories, and keep newly imported papers easy to find.

- Create one level of subcategories with inline naming, drag ordering and separate placements in each parent. Parent lists group papers once by subcategory; tags remain independent filters.
- Move papers between children of the same parent or add them to a child in another collection. Removing a subcategory returns its papers to Ungrouped, preserving PDFs, annotations, memberships and project notes. Existing parent-level trash safeguards remain in place.
- Import PDFs directly into child sections. The middle list supports edge, wheel and trackpad scrolling during a drag, with the purple destination following the pointer. Empty named children remain usable drop targets.
- Select successfully imported papers and bring the first one into view, clearing filters that would hide the result. Metadata-driven title sorting keeps an already visible selection in view without pulling back a user who has scrolled away.
- Animate sidebar expansion/collapse without recreating unrelated controls. Hide Ungrouped in the sidebar when it has no live papers; show it when papers return. Respect reduced motion and protect active inline edits.
- Order paper details as TL;DR, Categories, Tags, Venue and Notes, with project notes in the Notes area.

Requires Obsidian 1.8.7+. Existing libraries remain readable; the optional subcategory column is added only to a collection table when placement is explicitly changed. Existing papers are not automatically classified. PDF filenames, citations and personal notes are preserved; review/submission organization is unchanged.

Validated with 33 synthetic regression suites on macOS and desktop application checks using synthetic data. Release CI also runs on Linux (skipping the two macOS-specific suites) and verifies the locked dependency build. Physical mobile devices and Windows/Linux GUI behavior are not part of this validation.

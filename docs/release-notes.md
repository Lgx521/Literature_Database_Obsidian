Literature Database 4.9.0 brings AI-assisted paper organization into the regular release, alongside customizable fields and a streamlined workspace.

- **DeepSeek Beta, included and enabled by default.** Use your own API key and choose a model fetched from DeepSeek. Organize Inbox PDFs or library papers with missing information into editable title, TL;DR, tag and category previews. Apply individually or as a batch; review proposed new taxonomy through the tag mind map. Generation starts only when requested, and library changes require Apply. The feature can be turned off in settings.
- **Visible progress and reusable credentials.** Continue a batch with its panel closed, reopen pending edits, or stop processing. Remember the key securely on supported devices and optionally sync an encrypted copy between devices.
- **Custom fields.** Rename built-in labels and choices, hide fields, or add text and single-choice fields. Personal values and existing citation metadata remain preserved during AI organization.
- **Tag editing.** Rename or delete tag branches with guarded source updates. Inline editors have Save and Cancel controls on desktop and mobile.
- **Simpler navigation.** Keep the library heading fixed while the sidebar scrolls. AI tools and Trash live in the sidebar. Agent MCP has been removed; external agents use the vault workspace and its AGENTS.md.
- **Less repeated work.** Cache candidate and preview checks, coalesce rendering per frame, retain unchanged controls, and release dialog resources on close. Paper filtering reuses search text and a shared title collator.
- **Shorter README**, updated library screenshots and a new AI organization preview.

Requires Obsidian 1.8.7+. Existing disabled AI preferences are respected. PDF filenames, annotations, Notes, protected fields and citation provenance are retained.

Validation: 53 offline regression suites on macOS, including AI request/apply boundaries, credentials, custom fields, tag changes, mobile execution and UI cleanup. Demo checks cover retained drafts, lifecycle cleanup and phone/tablet emulation. Release CI tests macOS/Linux and rebuilds the locked citation dependencies before publishing. See [AI usage](https://github.com/Lgx521/Literature_Database_Obsidian/blob/4.9.0/docs/deepseek-beta.md) and [performance measurements](https://github.com/Lgx521/Literature_Database_Obsidian/blob/4.9.0/docs/performance.md).

# Maintaining Literature Database

This is the plugin source repository, not a user's vault. Never copy personal PDFs, notes, source tables, review/submission manuscripts, clipboard contents, workspace settings, recycle receipts or maintenance backups into Git. Tests must use synthetic fixtures and temporary directories.

- Edit modules in `scripts/`. Run `npm run build` to generate root `main.js` and `styles.css`; do not edit generated assets or commit them.
- `manifest.json` is authoritative for plugin identity/version. Keep `package.json` and `versions.json` consistent. Preserve the existing plugin ID unless an explicit migration is planned.
- Run `npm test`. macOS runs every suite; other platforms explicitly skip the two Finder/ditto/plutil integration suites. Keep tests offline and independent of a real vault.
- Public paper metadata has one canonical Markdown row. Collections/projects store relationships, not duplicate metadata. Preserve user notes and annotations. No per-paper Markdown records or second JSON metadata database.
- Never invent citation metadata. Agents may verify titles and maintain classifications, tags and TL;DR; deterministic code handles bibliographic evidence. Preserve existing bibliography/source fields and citation keys.
- Guard source mutations against concurrent edits, retain backups, preserve paired annotation files and never overwrite a file collision.
- Removing a paper's last collection membership must offer cancel or move to recoverable trash, never leave it unassigned through that action. For papers with multiple memberships, trash actions must offer current-collection removal or library-wide trash; smart views have no current collection. Categories and writing projects count together. Guard all removal entry points and recheck memberships before writes. Other recoverable deletion is immediate. Permanent deletion is restricted to selected archive receipts, with one explicit confirmation for the selected batch. Never use a real user's trash to test it.
- Network lookup is limited to public citation identifiers/titles on Crossref/arXiv, triggered by intake/export/manual retry. No background full-library scan, scheduled agent, telemetry or uploads of manuscripts/notes.
- Follow the AGPL project license and retain third-party notices. Citation dependencies and CSL styles are locked under `scripts/vendor/`; build instructions are there. Keep package-manager caches out of a vault and Git.
- Development and deployment are separate. Review a built version before copying its three runtime files into an explicitly named vault. Back up the old runtime first; never deploy templates over existing data.
- Community submission and official release publication are separate from source commits. See `docs/community-release.md`; do not claim directory approval or mobile compatibility without validation.

- Source filenames are `library.md`, `collections.md`, `reviews.md`, and `submissions.md`. Preserve the legacy table schema and Chinese stored status values; localization changes display labels only. Add translations for every new UI message in `scripts/i18n.js`. Never translate user content implicitly.

# Files, network access and privacy

The canonical files are `library.md` (paper metadata), `collections.md` (collection/project memberships), `reviews.md` (reviews) and `submissions.md` (submissions). Both the middle list and right-hand heading use the paper title. The actual PDF filename appears in smaller text in the details pane. Imported filenames are never normalized or renamed; same-name files use separate subfolders. Existing files are not renamed back. Until a real title is known, the original filename is a provisional title, excluded from title exports. Skim `.skim`, `.fdf` and `.xfdf` sidecars stay paired with their PDFs.

The plugin makes local backups before edits, checks for concurrent changes and keeps recoverable deletions under `.maintenance-backups/deleted/`. Permanent deletion removes only the selected archived record and its attachments. This is not a substitute for a separate backup. iCloud and other file sync are provided by your vault's storage provider; this plugin does not implement a sync service.

Web resources store a URL and metadata in the same `library.md`, without downloading an attachment. Adding a link makes no network request. Opening it launches the original URL in your browser. Web records do not enter PDF or citation recognition.

**Network access:** citation recognition uses `api.crossref.org`, `export.arxiv.org` and, when needed, `arxiv.org`. Requests contain a public identifier or paper title. It does not upload PDFs, personal notes, review manuscripts or submission attachments. Recognition runs for newly admitted public papers while the plugin is active, for exports missing citations, or after the explicit retry command; it does not scan the entire library on startup. Uncertain matches remain empty. Existing bibliography fields are preserved.

**Mobile import:** The Files picker reads only the files you select through browser File objects, then writes through the Obsidian vault API. It cannot discover neighboring annotation files or copy macOS extended attributes; select matching `.skim`/`.fdf`/`.xfdf` companions together, or sync them via iCloud. Mobile **Open ↗** uses Obsidian's PDF viewer.

**Outside-vault access:** when you explicitly drop or paste local PDFs on macOS, the importer reads those files and matching annotation sidecars and copies them into the vault using `ditto`, preserving extended attributes. It reads the clipboard only when Paste is chosen. Opening a PDF invokes the default desktop application (`/usr/bin/open` on macOS). The plugin does not change your default PDF application.

## AI organization

DeepSeek Beta is included and enabled by default; it can be hidden in settings. It requires your own provider API key, which may incur provider charges. Organization sends selected public PDF or webpage excerpts and taxonomy to `api.deepseek.com` only when you start a task. It excludes review/submission manuscripts, personal Notes and bibliography. Suggestions remain in memory until you choose Apply.

For web resources, organization first sends the saved URL to `api.deepseek.com/v1/tools/fetch`. If the service cannot return usable content, the plugin requests the original webpage directly without the API key, then extracts its text for organization. Authentication, billing and rate-limit errors stop the task instead of falling back. Direct HTML extraction executes no scripts or page assets; HTML and extracted text are not persisted. API credentials are sent only to DeepSeek. See [AI usage, credentials and data handling](deepseek-beta.md).

External agents use the vault workspace and its `AGENTS.md` with their own permissions and model configuration. Agent MCP was removed in 4.9.0.

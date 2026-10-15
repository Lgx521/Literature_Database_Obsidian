# Agent MCP (development preview)

Open **Agent MCP** next to **Trash** at the bottom of the sidebar. The panel is a short setup guide, not an agent launcher. These changes are not in the published 4.8.4 release yet.

1. On desktop, select **Prepare Codex connection** once per computer and keep this vault open in Obsidian. The local Codex host needs **Node.js 20+** available as `node`.
2. Open the **vault folder** as your Codex project, trust it when prompted, and start a new local session. Codex loads the project's MCP configuration automatically; no Codex plugin or pasted URL/token is required. An already running session needs a restart to load a newly added server.
3. Tell the connected agent what you want, for example: “Organize the inbox into Research,” “Fill missing TL;DRs and tags,” or “Check duplicate titles and propose clearer tag names.” The maintenance contract and tools are discoverable through MCP; no long prompt is needed.

The server is off by default. Once enabled, it resumes on this device while the vault is open. Its random Bearer token, port and enabled preference stay in device-local application storage, outside the synced vault. Disabling MCP closes connections and revokes the current export-folder grant. Closing or unloading the plugin also stops the server. No model, Codex launcher, background library scan or scheduled task is started. Phones and tablets display this guide and can receive the resulting Markdown/PDF changes through the user's existing sync provider; they do not host the server. A desktop test cannot establish that another device has finished syncing.

### How Codex discovers this vault

Setup adds one managed `mcp_servers.literature_database` block to **`.codex/config.toml` in the vault**, preserving other configuration and backing up an existing file before the first change. Edited/conflicting managed blocks and symlink configuration paths are rejected. It does not edit `~/.codex/config.toml`, grant project trust, or launch Codex. `AGENTS.md` provides instructions; it does not register MCP tools by itself. See [OpenAI's project-scoped MCP configuration](https://learn.chatgpt.com/docs/extend/mcp) and [trusted project configuration](https://learn.chatgpt.com/docs/config-file/config-advanced).

The synced block contains only a connection ID and a portable Node command. The bundled stdio adapter and a private connection descriptor live under `~/.literature-database/agent-mcp/<id>/` on each computer. The descriptor contains that computer's vault path, loopback URL and token, with owner-only access; none of these values enter the synced config. The adapter checks that Codex is running inside the connected vault and relays requests to the existing Obsidian service. It performs no library reads or edits independently. Closing or disabling the service removes the descriptor; requests then fail with instructions to enable it again. On another Mac, select **Prepare Codex connection** once to create its own local files. No always-running helper is installed.

If the tools are missing, check that Node is available to Codex, this exact vault is open in Obsidian with MCP enabled, the Codex project is trusted, and the Codex session was restarted after setup. Project configuration does not apply to cloud-only tasks. Opening a folder without first preparing its configuration does not discover a server automatically.

### Other MCP clients

Expand **Other agents / manual connection** for the Streamable HTTP URL and token controls. You can enable MCP here without preparing Codex. Add the displayed URL and Bearer token to a compatible local client; the generic JSON is not Codex's TOML format. A remote/cloud-only agent cannot connect directly to this loopback endpoint.

## Available tools

| Tool | Use |
| --- | --- |
| `library_context` | Read the contract, local AGENTS.md, collection/subcategory names and tag vocabulary |
| `list_papers` | Paginated public library, incomplete records or inbox; includes revision tokens |
| `read_paper` | Extract up to five pages from an indexed public/inbox PDF, on demand |
| `enrich_paper` | Fill title, TL;DR and additive tags; optionally mark AI organized |
| `file_inbox` | Archive one inbox PDF into an existing collection/subcategory, keeping its basename and sidecars |
| `migration_scan` | List PDFs from the export folder selected in Obsidian |
| `migration_import` | Copy an explicitly selected export PDF and deterministically preserve its associated source bibliography |
| `propose_tag_rename` | Preview a branch rename; the user applies it in the MCP panel |
| `library_audit` | Report missing PDFs, incomplete fields and possible duplicate titles |
| `export_references` | Return titles, BibTeX, APA or IEEE from existing records, including missing-data reports |

The MCP resource `library://guide` and prompt `organize_library` expose the contract. Tool schemas reject unknown fields. Writes use existing canonical Markdown, backups and concurrency checks. There is no second paper database. Agents cannot modify Notes, reading status, priority, bookmarks, citation fields or manually completed records. A paper must be read through `read_paper` before enrichment; a proposed title must match its first-page text. Human and unknown existing content remain protected. New AI tags are gray and attributed to **Agent MCP**. Uncertain fields stay empty. Opening a tag-renaming proposal never applies it; the user reviews it in Obsidian. Stale proposals must be regenerated.

Review/submission records and attachments are not available through these tools. The server provides no arbitrary file, shell or deletion tool. Connecting an agent allows that client to read the public paper text it requests; that agent/provider may process it remotely according to its own settings. Do not expose or forward the local endpoint to the Internet. These restrictions apply to MCP tools, not to an agent separately granted direct filesystem access.

## Zotero and other BibTeX exports

Export selected items or a library from Zotero as **BibTeX**, with **Export Files** enabled. In Agent MCP, expand **Migrate from Zotero** and select the **whole export folder**. Then ask the agent to scan it and import chosen files into an existing category/project. Folder authorization is session-only and can be revoked in the panel; it is not synced or automatically restored.

The importer reads the actual `.bib` file and matches its `file` field to an attachment inside that folder. It never accepts bibliography text from tool arguments or guesses associations from titles. It preserves source citation keys and raw entries; missing, ambiguous or conflicting matches are reported and left empty. Exact PDF hashes already in the public library are reported and skipped. Originals remain in the export folder; filename collisions use separate destination directories. Failed writes retain copied files for recovery and report their location.

This first migration path runs on **macOS**, using the existing annotation-preserving importer. It preserves embedded PDF annotations and same-stem `.skim`, `.fdf` and `.xfdf` files. It does **not** migrate Zotero's standalone notes, annotations still stored only in Zotero's database, original collection hierarchy, or items without PDFs. It does not open the live Zotero database. Other bibliography managers work only when their export has compatible braced BibTeX entries and relative attachment paths; unmatched formats are reported, not guessed.

## Tag renaming without an agent

In the tag map, right-click a tag or visual group (long-press on touch) and select **Rename**. Edit the name in place and press Enter or the checkmark. Escape cancels; touch devices also have an explicit cancel button. A tag rename updates the whole branch, vocabulary and affected public paper rows together. It preserves manual/AI/unknown provenance and unrelated fields, including manually completed status. Renaming into an existing branch is rejected rather than silently merging. Visual group renames do not change paper tags. Unsaved Notes in the current paper remain intact.

## Implementation and protocol

The desktop-only listener binds to `127.0.0.1`, validates Host/Origin and Bearer authentication, bounds request bodies and concurrent requests, and implements stateless [MCP Streamable HTTP](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports). It was checked with the official TypeScript SDK client 1.32.1. No extra runtime dependency or Node import is executed on mobile. [Zotero's export documentation](https://www.zotero.org/support/kb/exporting) explains its export workflow and limitations; the native [BibTeX translator](https://github.com/zotero/translators/blob/master/BibTeX.js) defines attachment fields.

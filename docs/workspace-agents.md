# Working with an external agent

Version 4.9.0 replaces Agent MCP with direct workspace maintenance. Open the **vault folder** (the folder containing `library.md` and `AGENTS.md`) in your agent, then ask it to read `AGENTS.md` and organize the current inbox or incomplete public papers. There is no plugin server to enable, connection token to copy, or MCP configuration to prepare.

For example: “Read AGENTS.md, review the PDFs in temp, and propose or apply organization within those rules. Preserve my notes and existing classifications. Report conflicts and unresolved papers.”

The vault's instructions define allowed fields, provenance, immutable PDF filenames, backup and concurrent-edit checks. Agents must read the source before writing, preserve human/unknown content and manually completed records, and never invent bibliography, citation keys or DOI data. Changes belong in the canonical Markdown tables; do not create one note per paper.

Before writing, back up and re-read the exact source text. Abort stale writes, preserve annotations and validate the result. The rules are an agent maintenance contract; they do not technically restrict an agent with filesystem permissions. Grant access only to the workspace and other source folders needed for the task.

For migrations, specify the source location and scope first. Preserve exported files and annotations; review duplicates and paper versions. Citation import is separate from AI organization and must use actual exported bibliography through deterministic parsing.

Plugin updates do not rewrite an existing vault's instructions automatically. If maintaining an older vault, retain its local rules and replace obsolete MCP setup instructions with this direct-workspace workflow. Remove only a verified plugin-generated MCP config block after backing it up; leave unrelated project and global settings alone.

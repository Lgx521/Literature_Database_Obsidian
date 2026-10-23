# Web links

Save a blog post or other webpage without downloading it:

- Drag a browser link into Inbox, a category, a subcategory, or a writing project.
- Paste a URL into the focused list, or use **Paste** in its blank-space context menu.
- Use **Add web link** in the toolbar, mobile menu, or command palette. The form supports one URL per line and an optional title for a single URL; mobile users can use the system Paste menu in this field.

Links use the same compact list, tags, bookmarks, projects, search and Notes as papers. **Open ↗** opens the current URL in the default browser. Edit the title or URL in the detail panel. Re-adding the same normalized URL preserves its metadata and adds the destination membership; moving it to trash removes only its local record.

Web links appear in All papers and also in Inbox until filed. Filing keeps the same record, title and Notes. URL changes keep the same memberships. A drag can supply its anchor title; otherwise the initial title is the hostname and path. The publication date stays unverified.

Choose **DeepSeek Beta** from a web link’s details or context menu to organize it. Inbox links participate in batch taxonomy planning; confirm the plan, review and edit the proposed title, TL;DR, tags and category, then **Apply to library**. Filed links can also receive missing information. Existing memberships and personal notes stay intact.

Webpages are fetched only when you start organization. DeepSeek Fetch reads the saved URL first; if it cannot return usable content, the plugin reads the original page directly. It never substitutes related search results for the article. Both planning and generation use up to 48,000 characters per item. The fallback extractor executes no scripts, loads no page assets and accepts up to 2 MiB of HTML. Login walls, blocked pages and pages without readable text report an error instead of generating from a URL. No offline copy is saved. Automatic PDF/citation recognition continues to process PDFs only.

Available in 4.10.0. The source format and maintenance rules are in [AGENTS.md](../AGENTS.md).

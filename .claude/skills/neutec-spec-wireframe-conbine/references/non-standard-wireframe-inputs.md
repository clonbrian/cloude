# Non-Standard Wireframe Inputs

Two situations `preflight.js` cannot resolve on its own. Both are functional/technical
judgment calls, not mechanical fixes, so the discipline is the same as everywhere else in
this skill: tell the user what the input actually is, get an explicit decision to proceed,
then execute deliberately — never automate the judgment itself, and never treat either
recipe below as a default fallback SKILL.md's own rules already tell you to avoid.

## JS-bundled Wireframe (labels rendered by an embedded JS payload)

**Trigger:** `preflight.js` reports injectability DOUBTFUL, or the visible-text / candidate-
label counts read implausibly low for how complex the mockup actually looks (a handful of
text nodes for what should be a full admin screen). One concrete signature seen in practice:
`<title>Bundled Page</title>` plus `<script type="__bundler/manifest">` /
`<script type="__bundler/template">` tags that reconstruct the page via JavaScript on load —
but the pattern generalizes to any Wireframe whose content is unpacked into the DOM at
runtime rather than present as static markup.

**This is still "say so plainly and stop" by default.** SKILL.md's Step 1 injectability
section is correct as written: report the limitation, explain it needs a different technique
(screenshot + pin coordinates, needing a browser, outside this skill's scope), and ask
whether the user can supply a Wireframe with real markup instead. The recipe below is not an
automatic escalation from that stop — it is what to do only after the user has been told the
Wireframe cannot be badged as delivered and has explicitly asked to proceed with it anyway
(e.g. "figure out the best way to handle it"), rather than supplying different source markup.

Recipe:

1. Serve the file locally: `node scripts/serve.js <folder containing the wireframe>`. A
   `file:` URL is refused outright by the browser, and the page's own `fetch()` calls for
   its embedded assets would be blocked by CORS even if it weren't.
2. Navigate to it with a browser tool and wait for the loading affordance to clear (e.g.
   wait for the text "Unpacking..." — or whatever the tool's own loading indicator says —
   to disappear).
3. **Take a snapshot and read it before capturing anything.** Confirm the unpacked content
   actually matches what the spec describes. This is not a formality — it is the only check
   that the unpack produced the real screen and not a silent error state.
4. Strip the now-inert bundler scaffolding before saving: the manifest/template `<script>`
   tags and any loading-indicator elements. They serve no purpose in the delivered snapshot
   and only inflate the file.
5. Capture the cleaned DOM as a **new static HTML file** — this is a new source file, never
   a hand-edit of the delivered `wireframe.html`. Record its path in `mapping.json`
   `sources.wireframeHtml` in place of the original bundler file.
6. **Known trap:** if the browser tool's evaluate-with-filename capability JSON-serializes
   the return value before writing it, the saved file starts with a literal `"` and contains
   `\n` / `\"` escape sequences instead of real newlines and quotes — the whole document got
   saved as a JSON string, not as HTML. Check the first ~200 bytes of the saved file before
   trusting it. If this happened, `JSON.parse()` the raw file content and rewrite the decoded
   string. Do not run preflight against a mis-escaped file — text-node counts and
   injectability will read wrong for a reason that has nothing to do with the actual content.
7. **Known trap: embedded binary assets (fonts, images) can look fine at capture time and
   still be broken in the saved file.** The manifest's swap step (`template.split(uuid)
   .join(blobUrls[uuid])`) resolves each asset differently by mime: an asset whose manifest
   `mime` matches a font pattern gets a portable `data:` URI baked directly into the swapped
   markup; anything else — including fonts whose manifest `mime` is a generic
   `application/octet-stream` rather than `font/woff2` etc., which is common for the legacy
   EOT/TTF/WOFF entries in a bundled icon-font's `@font-face` block — gets
   `URL.createObjectURL()`'d into a `blob:` URL instead. A `blob:` URL only resolves inside
   the *same browser tab* that minted it; it is never written back into the manifest or
   template source, so it cannot survive being saved as a static file, and step 3's snapshot
   check will not catch it — plain-text buttons and labels render correctly regardless of
   this bug (they were never assets to begin with), so the capture looks entirely correct at
   the time you confirm it. The defect only surfaces later, as pieces of the demo the badge
   numbers never point at — e.g. missing icons — reported back by the user. Signature: the
   saved static file still contains a literal `url("<uuid>")` (most often inside an
   `@font-face` rule) instead of a `data:` or working reference. Check for it directly —
   `grep -oE 'url\("?[0-9a-f]{8}-[0-9a-f]{4}[^)]*\)'` — don't wait for a visual report.
   Fix without re-touching the browser: read the **original** bundler file's
   `<script type="__bundler/manifest">` JSON (not the saved static file — the browser never
   persisted a fix into it), find the entry for each remaining uuid, base64-decode its `data`
   field and `gunzip` it if `compressed: true`, then rewrite every `url("<uuid>...")`
   occurrence in the saved static file into `url("data:<mime>;base64,<re-encoded data>")`.
   Trust the CSS's own `format()` hint for the mime, not the manifest's — `format('woff2')` →
   `font/woff2`, `format('woff')` → `font/woff`, `format('truetype')` → `font/ttf`,
   `format('embedded-opentype')` → `application/vnd.ms-fontobject`, `format('svg')` →
   `image/svg+xml` — the manifest field is frequently just the generic
   `application/octet-stream` regardless of what the file actually is. Re-grep for the uuid
   pattern afterward to confirm zero remain, then rebuild and reverify (numbering is
   unaffected — badges anchor on visible text, never on the asset itself — but confirm
   `standalone-assets` and `wireframe-integrity` still pass, since the wireframe **source**
   file changed).
8. Re-run `preflight.js` against the new static file. Injectability should now read OK. If it
   does not, the remaining problem is content, not format — stop and report as usual; do not
   attempt a second workaround on top of this one.

**Annotation content is not always confined to one obvious block.** A Flow & Logic diagram
is easy to spot and exclude — SKILL.md's Step 1 screen-split confirmation already puts that
choice to the user explicitly. Smaller per-screen captions — a short heading like
"B · Set PIN flow" plus one line of descriptive prose, sitting directly beside the real
screen mockup rather than inside a separate diagram — are easy to miss because they read as
part of the page. They are still not real UI, and their stray words (a field name appearing
inside a caption sentence) surface as extra, unexpected hits when computing anchor occurrence
counts (`nth`) in Step 2/3. Two ways to handle them, both legitimate — ask the user which
they want:

- **Strip them at capture time**, same treatment as the big flow diagram (a cleaner file,
  consistent with the "exclude design annotation" precedent already established for it).
- **Leave them in place** and account for their occurrences by hand when picking `nth` for
  each anchor (workable when there are few of them, at the cost of double-checking every
  anchor's context before assigning its number).

## Multiple Wireframe source files

**Trigger:** the user supplies more than one Wireframe HTML file for what is functionally
one export (e.g. a Frontend mockup and a Backend mockup for the same feature).
`mapping.json`'s schema (`sources.wireframeHtml`) accepts exactly one path — a hard
constraint, not an oversight to silently work around.

This is a functional decision, not a technical one — put it to the user (per SKILL.md's
"What to Ask vs. What to Decide"), it is not something to default on your own judgment:

- **Merge into one source, single export** — one `mapping.json`, numbers run 1..N across
  every screen in both files. Fits when the files describe one feature end-to-end (a
  player-facing flow and the admin settings that control it, for instance).
- **Two separate exports** — one folder and one `mapping.json` per file, each numbering from
  1. Fits when Frontend and Backend go to genuinely different engineers who will never need
  to cross-reference between the two documents.

If merging, before concatenating the two documents' markup:

1. **Check for `:root` CSS custom-property name collisions** between the two files' `<style>`
   blocks (extract each file's `:root { … }` block, collect its `--[\w-]+` declarations,
   diff the two sets). A collision means the later file's value silently wins for both
   documents' elements once concatenated into one DOM — corrupting whichever file's colors
   get overridden. No collision (the common case when the two files come from unrelated app
   shells with unrelated design-token naming) means a flat concatenation is safe. A real
   collision is a judgment call to bring back to the user, not something to auto-resolve by
   renaming variables — a rename risks a second, subtler class of visual bugs, and there is
   no script here to verify the rename was complete and correct.
2. **Check for duplicate `id` attributes** likely to matter (a root wrapper id repeated in
   both files, e.g. `id="dc-root"`). Harmless for this skill's own purposes — badge anchoring
   works on visible text, never on ids — but worth a quick check since a duplicate id is
   invalid HTML and could confuse anyone opening the file in dev tools later.
3. **Decide screen order deliberately, not by file order.** Match it to the spec document's
   own section order — if the spec describes the Frontend flow in an earlier chapter than
   the Backend settings, put Frontend's screens first — so the numbering the reader
   encounters follows the same order they would read the spec in. This is exactly the
   "screen list and processing order" confirmation Step 1 already requires; a multi-file
   input does not exempt it.
4. **Build the merged file with a script** (read both files, extract `<head>`/`<body>`,
   concatenate, write once) rather than by hand-editing — the same "nothing is
   hand-transcribed" principle that governs the rest of this skill's pipeline applies to a
   one-off merge just as much as to a routine build.

Record the merged file's path as `sources.wireframeHtml`. The original per-file inputs stay
wherever the user supplied them and are never themselves referenced by `mapping.json`.

**Delete intermediate snapshot files automatically once they are no longer load-bearing —
do not wait to be asked.** A per-file snapshot produced by the JS-bundled recipe above (step
5) is a work file on the way to the merged source, not a source in its own right: once it has
been folded into the merged file and `preflight.js` passes against that merged file, the
snapshot's only remaining reference is the merge script's own (already-run) input, and it
never appears in `mapping.json`. This is the same standing as `.playwright-mcp/`,
screenshots, and page snapshots under SKILL.md's Run Artifact Hygiene — transient by
construction, cleaned up as a normal part of finishing the step, not something left for the
user to notice and request removal of. Only the final merged source, the two original
per-file inputs, and the export folder's own contents need to persist past this point.

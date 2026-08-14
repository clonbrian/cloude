# verify.js Check Reference

What each mechanical check proves, and what a finding means. Read this when a check
FAILs or WARNs and the script's own evidence line is not enough to act on.

```
node <skill-folder>/scripts/verify.js <export-folder>
```

Plain Node, no dependencies. Reads `mapping.json` and the three delivered files; prints
a PASS / WARN / FAIL table with evidence; exits non-zero if any FAIL remains.

SKILL.md carries the rules that govern *how findings are handled* (zero-FAIL to deliver,
every WARN fixed or explained, `approvedExceptions` requires the user's explicit
approval). This file is the per-check detail behind those rules.

**verify.js imports nothing from `scripts/lib/`.** It re-derives everything it judges
from the delivered bytes — its own Markdown content-unit reader, its own heading scan,
its own badge counting. A verifier that shared the generator's interpretation of the
sources would agree with the generator's bugs, and neither could see it.

## The three non-waivable checks

`md-content-fidelity`, `cross-file-parity`, and `wireframe-integrity` are what this
skill promises: the spec's content survived the conversion, a number labels the same
component in both documents, and the Wireframe's own markup came through untouched.
No one waives them — not the user, not another BU's approver, not to meet a delivery
date. An `approvedExceptions` entry naming one is reported as its own FAIL rather than
honoured. Everything else on this page is a WARN or a fixable FAIL; these three are the
floor.

## The checks

| Check | Level | What it proves |
|---|---|---|
| `continuity` | FAIL | Approved numbers run 1..N with no gaps and no duplicate entries |
| `minted-numbers` | FAIL | No badge in any delivered file carries a number outside `mapping.json`. A number that appears in a document but not in the mapping was placed by a hand-edit |
| `badge-counts` | FAIL | Every number's badge count in each document equals what `mapping.json` asks for — one definition badge plus recorded narrative anchors on the spec side, one per wireframe anchor on the Wireframe side. Catches both a badge that never landed and one that landed twice |
| `cross-file-parity` | FAIL, **non-waivable** | Every `both`-sided number appears in **both** documents, and no single-side number appears on the side it does not belong to. This is the skill's core promise: `[7]` means the same component in spec.html and wireframe.html. Nothing else on this page substitutes for it |
| `wireframe-integrity` | FAIL, **non-waivable** | Deleting the injected block (everything between `<!-- ref-export:begin -->` and `<!-- ref-export:end -->`) and every `<span class="ref-num">N</span>` from the delivered wireframe.html reproduces the Wireframe source **byte for byte**. Not a node-tree comparison: byte equality is stronger, has no false positives, and needs no HTML parser. A finding names the first diverging source line — it means either the source changed after the build (rebuild) or someone hand-edited a delivered file (discard the edit; deliverables are build outputs) |
| `md-content-fidelity` | FAIL, **non-waivable** | Every content unit of the spec MD — heading, table cell, list item, blockquote line, paragraph — appears verbatim in spec.html. Written against the raw Markdown with its own parser, so a bug in `md-render.js` shows up here instead of agreeing with itself. Comparison removes all whitespace on both sides: the renderer legitimately adds and drops spaces at tag boundaries, and the team's documents are largely CJK, where spacing marks no word boundary. Every non-whitespace character still has to be present, in order |
| `cell-nesting` | FAIL | No badge sits inside a `<tr>` but outside any `<td>`/`<th>`. A badge landing between two cells breaks the table's column structure in a way that still renders plausibly |
| `badge-renderable` | FAIL | No wireframe badge lands inside `<option>`, `<title>`, or `<textarea>` — elements whose HTML content model is text-only, where a browser does not render a child `<span>` as an element at all. `anchorOffsets()` only excludes `<script>`/`<style>` content from matching, so an anchor whose text happens to sit inside one of these three still gets "found" and badged mechanically — the number lands in the source but is invisible (or garbled) on the rendered page, which every other check that counts badge occurrences cannot detect. Found via a real case: a `<select><option>` value used as a `wireframeAnchor`. Fix by re-anchoring on nearby visible text, typically the control's own `<label>` |
| `excluded-zones` | FAIL | Zero badges before the opening-section heading and inside the Metadata / Change Log sections. Titles come from `templateHeadings`, with built-in fallbacks (`Purpose` / `目的` / `背景與目標`, `Metadata` / `文件資訊`, `Change Log` / `修訂紀錄`). Downgrades to WARN when no opening-section heading is found at all — that is a template gap Step 1 already reported, not a badge defect |
| `style-presence` | FAIL | All three files define `.ref-num` and `.export-meta`. Each file must be openable on its own |
| `style-single-definition` | FAIL | combined.html declares `.ref-num` exactly once outside the Wireframe frame. Two declarations mean two sources of truth for the badge's appearance, and the losing one drifts unnoticed |
| `export-meta` | FAIL | All three files carry 功能名稱／匯出日期／Spec 版本／Spec 狀態, matching `mapping.json`. A mismatch usually means `mapping.json` was edited after the build — rebuild. An unset value must read `[TO CONFIRM]`, never be silently absent |
| `tab-markup` | FAIL | combined.html's tabs are two radios sharing one `name`, each with a `<label for>` that resolves, each with a panel whose id matches, each with its `#radio:checked ~ #panel` CSS rule present — and **no `<script>` anywhere**. Because the switch is pure CSS, this static check settles the switching behaviour completely; no browser is required, which is what lets a BU with no Playwright get the same proof |
| `combined-composition` | FAIL | combined.html's spec panel matches spec.html, and its Wireframe frame matches wireframe.html, after normalization. Normalization absorbs **indentation only**: whitespace *between* tags collapses, whitespace *inside* a text node does not — so 「預設 50,000」 versus 「預設 5,000」 still fails. Catches the drift where one file is regenerated and the other is not, leaving RD and QA reading different requirements |
| `source-freshness` | WARN | The sha256 recorded in each delivered file matches the sources as they are on disk right now. A mismatch means the spec MD or the Wireframe moved on after the build and the delivered files are stale — rebuild before delivering |
| `spec-version-freshness` | WARN | `mapping.json`'s cached `specVersion` / `specStatus` (when set) still match the spec MD's own Metadata table. These two fields are write-once: `build-export.js` only sets them when absent, so editing the spec MD's Version or Status afterward does **not** refresh them — a plain rebuild reproduces the stale value forever. `export-meta` cannot catch this: it only checks that the delivered files agree with `mapping.json`, not that `mapping.json` agrees with the spec MD. Fix by deleting the two cached fields from `mapping.json` and rebuilding, which lets `build-export.js` re-read them fresh |
| `spec-fidelity` | WARN | Heading and table-row counts of the spec MD match spec.html. A coarser, structural companion to `md-content-fidelity`: it catches a duplicated or dropped *row* whose text happens to appear elsewhere in the document |
| `to-confirm-recorded` | WARN | Every deferral recorded in `mapping.json` — an entry's `toConfirm` flag or a `toConfirmNotes` entry — is named, so it reaches the delivery message instead of evaporating between the run and the handover. FAILs instead when a `toConfirmNotes` entry has no `item` or no `question`: the question as it was actually put to the user is what makes the tag auditable months later. A PASS means nothing was deferred, not that deferrals were handled |
| `component-name-genericness` | WARN | No entry's `wireframeComponent` is a bare category word (按鈕, 文字顯示, 圖示) or a restatement of its own `category`. A wireframe-only row surfaces this value as its only name, so two adjacent rows both titled 按鈕 tell the reader nothing. Legitimate when the control's real on-screen label *is* that word — that is what an `approvedExceptions` entry is for |
| `standalone-assets` | WARN | No delivered file references an external host (remote CSS, JS, fonts, images). Such a file will not render fully on a machine without internet. Usually inherited from the Wireframe source, which this skill must not edit — so it surfaces for the user to decide, rather than being fixed silently |

## Checklist coverage map

Which check settles which Checklist row. The "Verified by" column in SKILL.md's
Checklist names the evidence source — machine-checkable rows are settled by the script,
never by AI self-declaration.

| Checklist row | Settled by |
|---|---|
| Number continuity | `continuity` |
| Numbers are all approved | `minted-numbers` |
| Number consistency across documents | `cross-file-parity` + `badge-counts` |
| Spec content integrity | `md-content-fidelity` + `spec-fidelity` |
| Wireframe structure integrity | `wireframe-integrity` |
| Valid cell nesting | `cell-nesting` |
| Badge renders where placed | `badge-renderable` |
| Excluded zones | `excluded-zones` |
| Style presence and single definition | `style-presence` + `style-single-definition` |
| Traceability header | `export-meta` |
| Source freshness | `source-freshness` |
| Spec version/status cache freshness | `spec-version-freshness` |
| Tab switching | `tab-markup` |
| Three files agree | `combined-composition` |
| Component naming | `component-name-genericness` |
| Deferrals reach the delivery | `to-confirm-recorded` (that they are recorded) + AI review (that each traces to a question actually asked) |
| Opens standalone | `standalone-assets` |
| Files are a clean build | a `build-export.js` re-run reproducing all three files byte-for-byte |
| Rendered verification | Playwright, when available (optional layer — see SKILL.md) |

The rows left to AI judgment — spec field naming read against the spec, badge reads as
belonging to the right component, single-side resolutions confirmed by the user, every
`[TO CONFIRM]` traceable to a question actually asked — stay in SKILL.md's Checklist,
since no script settles them.

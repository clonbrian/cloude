---
name: neutec-spec-wireframe-conbine
description: Use when the user wants a spec document and a Wireframe exported as cross-referenced HTML, so an engineer can locate a component in both by number alone. Produces three files - spec HTML, Wireframe HTML, and a dual-tab combined HTML - all carrying one globally incrementing reference number per component.
allowed-tools:
  - Read
  - Write
  - Edit
  - Grep
  - Bash(node .claude/skills/neutec-spec-wireframe-conbine/scripts/preflight.js *)
  - Bash(node .claude/skills/neutec-spec-wireframe-conbine/scripts/build-export.js *)
  - Bash(node .claude/skills/neutec-spec-wireframe-conbine/scripts/verify.js *)
  - Bash(node .claude/skills/neutec-spec-wireframe-conbine/scripts/serve.js *)
  - Bash(node preflight.js *)
  - Bash(node build-export.js *)
  - Bash(node verify.js *)
  - Bash(node serve.js *)
  - Bash(node --check *)
  - Bash(mkdir *)
  - Bash(shasum *)
  - Bash(ls *)
  - Bash(rm -rf .playwright-mcp)
  - Bash(rm -rf */.playwright-mcp)
  - mcp__playwright
---

# Spec & Wireframe Cross-Reference Export

## Overview

Export a spec document (MD) and a Wireframe (HTML) as three HTML files carrying the same
globally incrementing reference numbers, so an engineer can cross-reference a component
between the two documents by number alone rather than reading both line by line.

**The numbering is this skill's whole product.** Number `[7]` labelling the payout-cap
field in one document and the bet-limit field in the other is not a cosmetic defect — it
is the export being wrong in the one way it exists to prevent.

**Announce in the first message you send, in Traditional Chinese:** 「我正在使用
neutec-spec-wireframe-conbine skill 產出 spec 與 Wireframe 的交叉編號匯出檔。」 Every message
this skill sends the user is in Traditional Chinese; only the skill's own files are English.

That first message is Step 1's gate, which comes *after* the pre-flight has run — the
announcement opens it rather than preceding it, so the user gets one message rather than a
bare announcement followed by silence while a script runs.

**Save to:** `outputs/neutec-spec-wireframe-conbine-result/YYYY-MM-DD-<feature-name>/`,
relative to the working directory. That path is the `<export-folder>` argument that
`build-export.js` and `verify.js` take — the same directory, not a second convention.
(`preflight.js` is the exception: it runs before the folder exists and takes the two
**source** paths instead.) Create the folder in Step 1, after `<feature-name>` is confirmed
and before the first write to `mapping.json`.

`YYYY-MM-DD` is **the date the export is produced**, not the spec's `Last Updated` and not
whatever a pre-existing folder name says. It is the snapshot date the three files report, so
a re-run on a later day gets a new folder and a new date. Record the same value as
`exportDate` in `mapping.json`.

**A user who names the export folder overrides the path — but not `<feature-name>` and not
`exportDate`.** A folder handed to you may encode either, and either may be wrong,
abbreviated, or left over from another feature. Propose the slug you derive from the spec
title as usual, note the one the folder implies, and let the user settle it. Do the same for
the date: a folder named `2026-08-01-…` opened on 2026-08-08 produces files named
`2026-08-08-…` inside it, so **say that the two will disagree and ask which is intended**
rather than letting the user discover it in the file listing. Write into the folder they
named either way.

**`<skill-folder>` in every command below is this skill's own directory** — the one holding
the `SKILL.md` you are reading. Resolve it from that path rather than assuming a location:
it is `.claude/skills/neutec-spec-wireframe-conbine` in a project install and
`~/.claude/skills/neutec-spec-wireframe-conbine` in a personal one, and `allowed-tools`
carries a pattern for the project form plus a bare-filename form for a run whose working
directory is already `scripts/`. If a command is refused by permissions, the path form is
why — say so rather than working around it.

The export folder holds three deliverables and one work artifact:

| File | Role | Hand it to |
|---|---|---|
| `YYYY-MM-DD-<feature-name>-combined.html` | **The main deliverable.** Both documents behind a two-tab switch | **PG and QA** — anyone who has to move between the rules and the screen. When in doubt, this is the one file to send |
| `YYYY-MM-DD-<feature-name>-spec.html` | The spec, rendered and badged | Whoever needs the requirement text alone — QA writing test cases from it, a BA reviewing wording, anyone quoting a clause |
| `YYYY-MM-DD-<feature-name>-wireframe.html` | The Wireframe, unchanged except for badges | Whoever needs only the screen — UI implementation, a visual review, a discussion where the rules are not in question |
| `mapping.json` | Approved numbering and page structure. The single source of truth | Nobody — a work artifact, never part of the handover |

Step 5's delivery message states this mapping; it is not something to compose per run.

**`build-export.js` composes those three filenames** from `exportDate` and `featureName` —
they are not something to write by hand, and they do not follow the folder's name. A user who
names the folder `topup-bonus-final` still gets `2026-08-08-topup-bonus-spec.html` inside it.
Setting `files.spec` / `files.wireframe` / `files.combined` in `mapping.json` overrides a name
if the user asks for something specific; otherwise leave those keys alone and let the build
write them.

`mapping.json` stays in the folder — it is what makes a re-run and a later re-verification
possible, and it is the approved numbering in machine-readable form, which is worth keeping
whether or not anything else ever consumes it. It is never listed as a deliverable.

**`<feature-name>` is lowercase, hyphen-separated, and ASCII** — it names a folder and three
files. The spec's title is almost always Traditional Chinese, so it is the *source* of the
name, not the name itself: propose a short English or romanized slug derived from it
(「加值贈金活動」→ `topup-bonus`, 「VIP 週返水」→ `vip-rebate`) and confirm it with the user
in Step 1 before creating any file. Never transliterate mechanically and never leave CJK
characters in the name.

**What this skill does not do.** It delivers a *cross-referenced pair*: the reader still opens
both documents, and the numbers let them jump between the two. It does **not** produce a
single self-contained guide that replaces the sources — that needs a screenshot of each
rendered screen with pins measured onto it, which needs a browser and is a different job. If
the user's actual need is "PG and QA must be able to work without opening the spec or the
Wireframe at all", say plainly that this export does not meet it, rather than delivering
something that looks close enough. The numbering approved here is machine-readable in
`mapping.json`, so nothing is wasted if that other job is done afterwards.

## The pipeline is a script, not a transcription

Everything between the sources and the delivered files is deterministic and lives in
`scripts/`:

```
spec MD ───render──> HTML ───┐
        (md-render.js)       ├──inject badges──> the three files
Wireframe HTML ──────────────┘  (badge-inject.js,   (build-export.js)
                                 driven by mapping.json)
```

Nothing in that chain is hand-written. Three consequences worth internalizing:

- **Content cannot be lost in conversion.** Earlier revisions had the model transcribe the
  spec into HTML by hand, page by page, pausing for confirmation to stay inside output
  limits. A 32-row rules table quietly arriving as 31 rows is the failure that produced;
  QA then tests from a document missing a rule and nothing anywhere says so. A renderer
  cannot summarize, merge, or drop a row.
- **The Wireframe is provably untouched.** Badges are pure insertions of one fixed string,
  and everything else the export adds sits between two sentinel comments. Deleting both
  reproduces the source byte for byte — which `wireframe-integrity` checks on every run.
- **A revision is a re-run, not an edit.** Change the spec MD, the Wireframe, or
  `mapping.json`, then re-run. Editing a delivered HTML file directly is always wrong: the
  next run overwrites it, and `wireframe-integrity` or `combined-composition` will fail it
  anyway.

`scripts/lib/badge-inject.js` and `sections.js` are the generator's interpretation logic.
**verify.js must never import them** — the verifier reaches its verdict independently, and
sharing the interpretation would make a bug in it invisible to both.

## Team Document Conventions

This skill reads the spec MD's Metadata table and may propose edits to the spec itself.
Both depend on a document template, so the parts this skill actually touches are stated
here rather than assumed — the skill runs correctly in any environment, including a BU
with no project-level instruction file to inherit them from. Where a project file defines
them, it wins; these are the floor, not an override.

**Metadata table** — every spec document carries one, with exactly these four fields:

| Field | Format |
|---|---|
| Version | `v<major>.<minor>` — exactly two components, never a third. The first version is always `v1.0` |
| Author | Writer's name |
| Last Updated | YYYY-MM-DD |
| Status | Draft / In Review / Confirmed |

**Version bump** — content additions or revisions (a new rule, an added AC, a corrected
description, a wording fix) are **minor**: v1.0 → v1.1. A change of requirement direction
or a full redesign is **major**: v1.0 → v2.0. Every edit this skill proposes is a minor
bump; one that would justify a major bump is a requirement change the user must be asked
about first, not something to apply.

**Change Log** — appended on every update, never overwritten:

| Version | Date | Author | Summary |
|---|---|---|---|
| v1.0 | YYYY-MM-DD | Name | Initial release |

**Status decides whether an edit may be applied at all:**

| Status | Meaning | What this skill may do |
|---|---|---|
| Draft | Still under discussion | Edit directly, then bump the version and append the Change Log entry |
| In Review | Delivered to PG/QA for review | Edit allowed; every change must appear in the Change Log — no silent fixes |
| Confirmed | Requirements finalized | Record the change as `[CHANGE REQUEST]` with its reason and wait for approval. The user approving that specific item is the approval; a general "go ahead" earlier in the run is not |

**A different template is configured, not assumed.** A BU whose template names the same
things differently (文件資訊 for Metadata, 修訂紀錄 for Change Log, 背景與目標 for the
opening section) records the mapping in `mapping.json` `templateHeadings`. Step 1 checks
these anchors exist before any numbering work; it never proceeds silently past a missing
one.

**How this skill writes to the user.** Every message it sends — the Step 1 gate, each Step 2
question, the Step 3 table, the delivery — follows two rules, because both change what the
reader does:

- **No hedging.** Not 「應該」「可能」「看起來」「我想」, and not `should` / `might` / `seems
  to`. An uncertain item is marked `[TO CONFIRM]` or raised as an open question, both of which
  are defined below; softened wording is not a third option, it is the same uncertainty with
  the flag removed. 「驗證應該都過了」 and 「驗證全數通過（18 項）」 are different claims, and
  only one of them can be checked.
- **No vague superlatives and no filler.** Not 「全面的」「完善的」「無縫的」, not 「當然可以」
  「我很樂意協助」, and not 「很簡單」「只要…就好了」 — the last group reads as condescending to
  a reader who is about to discover it is not simple. State what was done, what it cost, and
  what is still open.

These apply to the skill's own messages. They are not a house style imposed on the spec: the
spec's wording belongs to whoever wrote it, and this skill only ever quotes it verbatim.

**Annotation tags** — three tags, distinct meanings, never interchangeable:

| Tag | Meaning |
|---|---|
| `[TO CONFIRM]` | Not yet verified; needs follow-up |
| `[ASSUMPTION]` | A working assumption, not yet aligned with stakeholders |
| `[CHANGE REQUEST]` | A request to modify a Confirmed requirement; needs re-approval before it is executed |

**`[TO CONFIRM]` has an entry condition, and it is not "I could not resolve this."** It may
only be written after that specific item was put to the user as its own question and the
user explicitly chose to defer it. Deciding unilaterally that a gap is unanswerable,
batching several gaps into one question, or marking an item the user was never shown all
produce the same defect: a deferral the user never made, surfacing in the delivery as
though they had. When in doubt, ask again rather than mark it.

## Workflow

Step 1 is a global input check; Steps 2–3 form a per-page loop over every screen in the
Wireframe; Step 4 builds; Step 5 verifies and delivers. Steps 2–3 are confirmation gates:
never number a page until its mapping table is approved, never start the next page until
the user confirms.

Three companion files under `references/` are read on demand, each with one trigger:

- **`mapping-schema.md`** — before the first write to `mapping.json` in a session (Step 1).
- **`verify-checks.md`** — before **telling the user anything about a specific named check**:
  what it will report, why it fired, or what to do about it. In practice that is Step 5 on a
  FAIL or WARN whose evidence line is not enough to act on. Merely mentioning a check's name
  in passing does not trigger it; committing to explain one does.
- **`non-standard-wireframe-inputs.md`** — before proceeding on either of two situations
  Step 1 cannot resolve mechanically: a Wireframe whose labels render from an embedded JS
  payload and the user has explicitly asked to proceed with it anyway (not the default —
  the default stays "say so plainly and stop"), or more than one Wireframe HTML file
  supplied for one export.

A step that names one of these is not satisfied until that file has actually been read.

**After any Step 2(a) or 2(b) edit to a source, the Step 1 checks on that source are stale.**
Adding a component to the Wireframe adds a label that has to be injectable and may collide
with existing text; adding a row to the spec MD can introduce an unsupported construct.
Re-run the pre-flight on the edited file before continuing the loop. Source hashes need no
attention — `build-export.js` records them at Step 4, after every edit is in.

### Step 1: Input check

Required inputs: one spec document in MD format, one Wireframe in HTML format. If either
is missing, stop and ask for it by name. There is no "mark and continue" fallback for a
missing input. If the user supplies **more than one** Wireframe HTML file for what is
functionally one export, this is a real fork, not a detail to default silently — read
`references/non-standard-wireframe-inputs.md` before deciding how to proceed.

**Run the pre-flight first — it performs all four checks below and prints their verdicts:**

```
node <skill-folder>/scripts/preflight.js <spec-md> <wireframe-html>
```

It needs no `mapping.json`, which is why it exists: `build-export.js` cannot run until Step
3 has produced approved entries, so before this script the spec-render and injectability
checks had no tool behind them and could only be "performed" by reading the generator's
source. Add `--headings "metadata=文件資訊,changeLog=修訂紀錄,purpose=背景與目標"` when the
document uses different titles. It exits non-zero on a blocking problem. Work through its
report with the user before Step 2; do not start numbering on a blocking exit.

**Spec template completeness check** (pre-flight reports it): the Metadata table, the
opening section heading, and the Change Log heading, per Team Document Conventions above.

**A reported-missing anchor has three possible causes, and the wrong two are the easy ones
to reach for.** Before treating it as a gap, settle which it is:

- **(1) The document calls it something else** — 文件資訊 for Metadata, 修訂紀錄 for Change
  Log, 背景與目標 for the opening section. This is the normal case for another BU and is not
  a gap at all: re-run the pre-flight with `--headings "metadata=<its title>,…"` and record
  the same values in `mapping.json` `templateHeadings`. **Check this first.** The flag's
  usage condition cannot be known before the first run — you learn the document's titles from
  reading it — so a first run without `--headings` reporting a miss is the expected way to
  discover you need it, not a failure.
- **(2) The anchor is genuinely absent.** Stop and ask the user to choose: (a) fix the spec MD
  first, then re-supply it, or (b) knowingly proceed — `specVersion` and `specStatus` are then
  recorded in `mapping.json` directly, badges can no longer be excluded from the missing
  region, and both consequences are stated in the delivery message.
- **(3) The heading exists but is worded differently from run to run** (a trailing space, a
  full-width colon). Same handling as (1); `templateHeadings` takes the exact string.

Never proceed silently on a template gap, and never record a `templateHeadings` override the
user has not seen — it changes which region badges are excluded from.

**This check is structural, not a spec-quality review.** It confirms only the anchors this
skill mechanically depends on. A spec missing Use Cases, Screen Location, or System Rules
passes it and still may be too thin to build from — that judgment belongs to whoever wrote
the spec, not to this skill, which numbers what a document says and never supplies what it
does not. Say so if the spec looks thin, name what you think is missing, and let the user
decide whether to fix it first; do not block on it, and never add the missing content.

**Markdown construct check** (pre-flight reports it): `md-render.js` covers the team
template's construct set — headings, pipe tables, bullet/ordered lists with nesting,
blockquotes, horizontal rules, inline code, bold. It throws on anything else (fenced code
blocks, images, links, raw HTML, task lists). If the render fails, do not work around it by
editing the spec's wording: report the construct to the user and agree how to handle it —
either the spec uses a supported construct, or the renderer is extended deliberately.

**Wireframe injectability check** (pre-flight reports it): this skill badges the Wireframe's
own markup, so every component to be numbered must have its label present as **visible
text** in the HTML source. Text inside an attribute — a `placeholder`, a `title`, an
`input`'s `value` — is not visible text and cannot be anchored on, and neither is text that
exists only inside `<script>`. A Wireframe that renders its labels from an embedded JS
payload, or one that is a flattened screenshot with no per-component structure, cannot be
badged here.

**Say so plainly and stop — do not work around it.** Never edit the Wireframe to make it
injectable, and never fall back to numbering only the components that happen to be
anchorable: a partial numbering is worse than none, because the gaps are invisible to the
reader. What such a Wireframe needs is a different technique altogether — annotating a
*screenshot of the rendered page* with measured pin coordinates, which needs a browser and is
outside this skill's scope. Tell the user that in those terms, so they can judge whether such
a tool exists in their environment, and ask whether they would rather supply a Wireframe whose
labels are real markup. Naming a specific tool is not this skill's business: an environment
that has one will recognise the description, and an environment that does not is not helped by
a name it cannot use. If the user, told this in those terms, explicitly asks to proceed with
the Wireframe as given anyway, read `references/non-standard-wireframe-inputs.md` before
doing anything further — it documents one way to do this carefully, including a serialization
trap worth knowing about in advance, and it is not a step to improvise from scratch.

**Ambiguous-anchor check** (pre-flight reports it, and nothing else can): anchor matching is
a **plain substring scan over all of the Wireframe's visible text**, not a lookup of label
elements. So a field label that also appears inside a sentence elsewhere — a `<th>` reading
「活動狀態」 and a helper note reading 「活動狀態變更後立即生效」 — resolves to two places, and
the build refuses to guess between them. The pre-flight lists every such collision. Resolve
each one in Step 2 and record the chosen occurrence as `nth`; a collision discovered at Step
4 means the user already approved a mapping table built on a false assumption.

**Step 1's confirmations are one gate, asked together — five of them:**

1. `<feature-name>`
2. **Brand-new feature, or a revision of an existing one?**
3. Numbering scope
4. Screen list and processing order
5. Each screen's Item Definition section

**(2) and (3) are the one dependent pair** — the answer to (2) decides which form (3) takes,
since for a brand-new feature the two scopes collapse and the real question becomes which
generic controls get numbers. Ask them adjacently and phrase (3) conditionally, both branches
spelled out, so a single reply answers both. The other three are independent of everything.

**The gate is a single message**, in this order: the announcement, then the pre-flight
verdicts (including every ambiguous anchor with its occurrences quoted, so the user sees the
state of both sources), then the five confirmations. Do not send the announcement, the
pre-flight report, and the questions as three separate messages — the user answers once. This
is the opposite of Step 2, which is one item at a time because there the answers do move each
other.

Confirm `<feature-name>` and the **numbering scope**:

- **(a) Only fields added or changed by this feature** (the formal default; recommend this)
  — pre-existing unchanged fields, list columns, and action buttons stay unnumbered
- **(b) All visible fields/components on every screen** — use only when the user
  explicitly wants the full screen documented

Warn explicitly when asking: **switching scope mid-run forces a full renumbering of
everything produced so far** — numbers follow Wireframe screen order, so fields added later
cannot simply take numbers appended at the end.

**For a brand-new feature the two scopes collapse into one** — every field is new, so
changed-only and all-fields select the same set. Say that when asking rather than presenting
a choice that makes no difference, and confirm the one real question hiding inside it:
whether generic controls the feature did not invent (a 儲存 button, a 取消 button, a
breadcrumb) are numbered.

**`numberingScope` alone cannot record that answer, so record the reasoning next to it.** The
enum is `changed-only` / `all-fields`, and the real decision is usually neither — "all fields,
but 儲存 is out as generic while 複製活動 is in" fits no value. Put the enum in
`numberingScope` and the actual rule in `numberingScopeNote`, naming the controls excluded and
why. Without it, the fact that 儲存 has no number survives nowhere: `continuity` and
`minted-numbers` only check internal consistency, so a later run sees a gapless 1..N and no
record of what was deliberately left out.

**"Brand-new" is confirmed, not inferred.** A spec at `v1.0` whose Change Log holds only an
initial entry is the signal to *ask* — it is not the answer, because a spec can be freshly
written for a screen that already exists in production. Put it to the user in the same
message: 「這是全新功能，還是既有功能的改版？」 Getting it wrong changes which question they
are asked about scope, so it is not something to settle by reading the version number.

**Scope decides what exists; Step 2 decides how to resolve what exists.** These two overlap
on exactly one kind of item — a generic control the Wireframe has and the spec does not (a
儲存 button) — and the precedence is: **a control ruled out of scope here never becomes a
Step 2 single-side item at all.** It is simply unnumbered, mentioned once in the delivery,
and never asked about again. Only controls that are *in* scope go through Step 2's
(a)/(b)/(c) resolution. Without this order the same button gets asked about twice and the
two answers can contradict each other. When it is unclear whether a control is generic or
feature-specific — 「複製活動」 is a real example, 儲存 is not — that ambiguity is itself the
question to ask here, not something to resolve on your own.

**Then list the screens detected in the Wireframe and confirm both the list and the
processing order** — numbering is global across screens, so their order determines numbering
order. A single-screen Wireframe runs the loop once and skips the "continue to next screen"
question.

**A "screen" is what the reader would call one page of the UI, and this skill cannot infer
it.** A Wireframe HTML file may hold one screen, or stack several as sibling containers
(`<section>`, `<div class="page">`), or separate them by `<hr>` or by `<h1>`. Propose the
split you read from the markup — naming the element you used and the heading text of each
screen — and have the user confirm or correct it. Do not treat a heading count as the
answer. Each confirmed screen becomes one `pages[]` entry; its `label` is the name the user
confirmed, and every entry's `page` must repeat that string exactly.

Finally, identify each page's **Item Definition section** in the spec — the field table
that page's components are defined in. This becomes `pages[].itemDefSection` and is where
definition badges are placed. A page whose fields are defined in no spec section is a gap
to raise with the user, not something to leave blank.

**Read `references/mapping-schema.md` before writing `mapping.json`'s header fields at the
end of this step** — every field's semantics live there and nowhere else.

### Step 2: Ambiguity confirmation for the current page (one item at a time)

Analyze the current page and the spec sections that map to it, and collect every item that
cannot be resolved with certainty:

- **UI block order unclear** — propose a concrete top-to-bottom, left-to-right order and
  ask the user to confirm or correct it. Do not assume an order.
- **Uncertain mapping** — a spec field that may or may not correspond to a Wireframe
  component. Ask.
- **Single-side items** — a spec field with no Wireframe counterpart, or a Wireframe
  component with no spec counterpart. **Before concluding "no spec counterpart," search the
  page's `itemDefSection` for narrative prose, not only its definition table** — a
  component's only spec-side existence is sometimes a descriptive sentence sitting before or
  after the table (e.g. "看到依幣別分組的清單" ahead of a field table that never names
  "幣別" as a row). `narrativeRefs` exists precisely to badge that sentence; skipping this
  check turns a genuine two-sided item into a false wireframe-only, and the export then
  omits a cross-reference the reader could have gotten for free. Only once both the table
  and the surrounding prose come up empty is it a real single-side item. Resolve item by
  item, offering three options in Traditional Chinese:
  - **(a) Modify the Wireframe** — propose the concrete addition first, matching the
    Wireframe's existing style and naming. After confirmation, edit the Wireframe **source**
    directly. The item becomes a normal two-sided row.
  - **(b) Modify the spec MD** — propose the concrete content change first (which
    section/table, exact wording). After confirmation, edit the spec MD per **Team Document
    Conventions**: check Status first to decide whether the edit may be applied at all, then
    bump the minor version, set `Last Updated` to the date of the edit, and append the Change
    Log entry. All three move together — a Metadata table whose `Last Updated` predates its
    own newest Change Log row tells the next reader the document is older than it is.
  - **(c) Keep single-side** — the item legitimately has no counterpart. Ask whether to
    number it or leave it unnumbered.

  For (a) and (b), never apply an edit before the user confirms the concrete change, and
  never invent requirement content — the proposal must be derived from the side that
  already has the item.
- **Repeated fields** — the same field in several screen locations. Identical rules
  everywhere → one shared number. Rules differing by location → different items, different
  numbers. Unclear → ask. Whether the shared number badges **every** location or just one
  depends on which of two shapes the repetition is:
  - **Sequential** — the same component recurs across different steps of one flow a player
    moves through in order (a step indicator shown on screen 2, then 2b, then 3, then 4).
    Badge **every** occurrence (`wireframeAnchors` with one entry per location). A reader
    who lands on any single one of those screens — without having seen the others — still
    needs the cross-reference right there.
  - **Parallel** — the same block structure repeats side by side because of data
    multiplicity, not flow (one table per currency, one card per settlement period, one row
    shape repeated down a list). **Default to badging only the first occurrence**
    (top-to-bottom, left-to-right, per the Wireframe's own order) and leaving the rest of
    the wireframe unbadged for that number — the pattern is fully demonstrated once, and
    repeating identical numbers across every parallel instance is visual noise that adds no
    information a reader doesn't already have from the first one. State this default when
    presenting the Step 3 table (e.g. "示範於 BDT，EUR／THB／VND 為相同結構不重複標號") so the
    user is confirming a stated choice, not discovering it later; a user who wants every
    instance badged anyway can say so.
  - Unclear which shape applies (e.g. a modal shown open vs. closed) → ask rather than
    assume.
  - **Common misjudgment to avoid**: the instances holding genuinely different data (row 1
    "Active, 2026-06-01~08-31", row 2 "Paused, 2026-04-01~09-30"; card 1 "Summer Top Wins",
    card 2 "Autumn Rush") is not, by itself, a reason to call the repetition Sequential.
    Different data populating identical row/card structure is exactly what Parallel means —
    a table demonstrating 4 history rows or a lobby showing 3 example boards is data
    multiplicity, not 4 or 3 distinct flow steps. Ask "would collapsing every parallel
    instance down to the Wireframe's own row/card count still show the same component
    structure?" — if yes, it is Parallel regardless of how varied the sample data looks.
- **Ambiguous Wireframe anchor** — the component's label text appears in more than one
  place in the Wireframe. Confirm which occurrence the number belongs to and record it as
  `nth`; the build refuses to guess.
- **Wireframe-visible attribute missing from the spec (safety net)** — check every mapped
  field for the four wireframe-visible attributes: default value, interaction/control type,
  required/optional marking, placeholder/format hint. If the Wireframe shows one the spec
  does not state, report it as a gap. This skill NEVER adds the missing content itself.
  Ask, item by item. Two outcomes, and they are **deliberately not lettered** — the single-side
  resolution above already owns (a)/(b)/(c), and its (b) means "modify the spec MD" while a
  lettered (b) here would mean "defer", so an answer given as a bare letter would be recorded
  against the opposite decision:
  - **Fill it in** — the user states the missing attribute. Apply it to the spec MD **exactly
    as the single-side option (b) prescribes**: propose the concrete wording first, check
    Status, then version bump + `Last Updated` + Change Log row. That is the only place the
    mechanics of editing a spec live, and they apply identically here. "Re-supply the spec"
    is not a separate path — you hold the file and edit it in place; a user who prefers to
    edit it themselves says so, and then you re-run the pre-flight on what comes back.
  - **Defer it** — mark `[TO CONFIRM]` and continue. The deferral must be the user's, per the
    entry condition above.
  - **Neither, because the user has not answered** — see Open Questions below. This is not a
    deferral and must never be recorded as one.

**Open questions: a third state, for a question you asked that has no answer yet.**
`[TO CONFIRM]` records the *user's* decision to defer. An asked-but-unanswered question is
the opposite — nobody has decided anything — and the two must not be conflated, because a
`[TO CONFIRM]` in a delivered document tells the next reader that a human weighed the item
and chose to leave it open. Meanwhile Step 5 forbids holding the delivery to wait for an
answer, so the question needs somewhere to live that is neither the spec, nor `[TO CONFIRM]`,
nor the conversation.

It goes in `mapping.json` `openQuestions` — the same shape as `toConfirmNotes` minus the
deferral date — and it is repeated verbatim in the delivery message under its own heading.
`verify.js` `to-confirm-recorded` surfaces both, so neither can be lost between the run and
the handover. The export ships; the question ships with it, attributed to the skill rather
than to the user. Read `references/mapping-schema.md` for the shape.

Nothing about the numbering waits on an open question: a field's number is decided by where
it sits on screen, not by what its default value turns out to be. Say so when raising one, so
the user knows whether answering it costs a re-run (usually a wording change — Post-Delivery
case (a)) or a renumbering (only if the answer adds or removes a component).

**One question per field, covering every attribute it is missing.** The default-value
trigger below and this safety-net check fire on the same field constantly — a pre-checked
toggle is simultaneously "a field that needs a default value" and "a Wireframe-visible
attribute the spec does not state". They are one finding, not two. Gather everything that
field is missing (control type, default, required marking, format hint, allowed options) and
put it to the user as a single question about that field. Asking the same field three times
under three headings reads as an interrogation and buries the one attribute that actually
mattered.

**The control-type limb is satisfied by words, not by a column — and `category` does not
satisfy it.** These are two different questions about the same fact, and conflating them
either floods the user with questions or silently swallows a real gap:

- **`category` (Step 3) is this export's own record of what the control is**, observed from
  the Wireframe. It is always filled, for every row, and it changes nothing about the spec.
- **The safety net asks whether the *spec* conveys that control type to someone who never
  sees the Wireframe.** Recording 下拉選單 in `mapping.json` does not put it in the spec.

Before reporting a control-type gap, check whether the field's spec description already
conveys it **in words, however loosely** — 「依 VIP 等級設定返水比例，最多 5 段」 conveys a
bounded selection, a field whose own name contains the word (「Columns 按鈕」) conveys it, a
description saying 「可多選」 conveys it. A bare 「決定贈金的計算方式」 with no hint of
dropdown-versus-radio-versus-free-text does not. Only report the ones genuinely unconveyed.
Expect most fields to need no edit — the value of the check is confirming that cheaply, not
rewriting every row. A spec whose Item table conveys no control type for **any** field is one
finding about the document, put to the user once, not one question per field.

**Where a `[TO CONFIRM]` is recorded.** The tag lives in `mapping.json`, never only in the
conversation — the conversation is not the source of truth for anything this export claims.
A deferral about a numbered field sets `toConfirm: true` on that entry; a deferral about
something with no entry of its own (a missing System Rule, an undefined field the spec's
Exception Handling references) goes in the top-level `toConfirmNotes` array, each with the
question that was asked and the date it was deferred. `verify.js` `to-confirm-recorded`
WARNs while any exist, so they cannot quietly fail to reach the delivery message. Read
`references/mapping-schema.md` for both shapes. Editing the spec MD to carry the tag is a
Step 2(b) edit and follows every Step 2(b) rule — version bump, Change Log row, Status
gate; never write the tag into the spec as a side effect of recording it.

Before asking anything, present the complete ambiguity list for the page as an overview —
grouped by category, ordered with the items most likely to change the numbering outcome
first — so the user sees the full picture before answering. Then confirm one at a time, in
that order. When the user is unsure, propose a concrete recommendation and get explicit
confirmation.

Three further triggers oblige a question even when nothing above fires, because each is a
place where a silent choice ships as a requirement:

- **A field needs a default value** — a Status toggle's ON/OFF, a display limit, a
  pre-selected tab. Never infer it from what the Wireframe happens to show.
- **A field has multiple options** — a Type, Mode, or Board Type whose allowed values the
  spec does not enumerate. List every option found and ask which apply. Never pick one.
- **The change may reach other modules** — a Step 2(a)/(b) edit whose effect is not
  contained by this feature. Name the affected scope and confirm before proceeding.

### Step 3: Mapping table confirmation for the current page

**Order check before presenting (mandatory):** the row order in this table — and therefore
the number sequence — must reflect each field's actual position on screen, never an order
inferred from the spec table's own row sequence. Read the Wireframe for this page before
assigning numbers. Spec tables are frequently ordered differently from the screen.

**Wireframe Component must name the specific element, never restate the category.** It is
the actual label on the component ("匯出報表", "確認", "Contact CS"). A wireframe-only row
surfaces it as the row's only name, so a bare category word (按鈕, 文字顯示, 圖示) leaves
the reader with two adjacent rows both titled 按鈕. That word belongs in `category` alone.
`verify.js` `component-name-genericness` WARNs on it, but confirming the specific label
here is cheaper.

**When the control's real on-screen label genuinely is a category word** — a button whose
visible text is 「儲存」, 「確認」, or literally 「按鈕」 — record it as it is; a component name
must match what the reader sees. The check still WARNs, and that WARN is resolved the normal
way: the user approves an `approvedExceptions` entry naming the finding and the reason (see
`references/mapping-schema.md`). Never rename a component to something it does not say on
screen in order to silence the check.

**Spec Field is the spec's own Item name, verbatim.** It is both the badge anchor and the
naming contract an engineer builds against. It must match the first cell of the row in that
page's `itemDefSection` exactly, or badge injection fails loudly.

Present the numbering mapping table. **Every value the user's approval is needed for gets
its own column** — approving a table that hides what will be written to `mapping.json` is
not an approval of what ships. Numbers continue from the previous screen; they never reset:

| No. | Spec Field | Wireframe Component | 類別 | 錨點 | Side | Note |
|---|---|---|---|---|---|---|
| [1] | 活動名稱 | 活動名稱 | 輸入框 | 活動名稱 | both | |
| [2] | 活動狀態 | 啟用 | 開關 | 活動狀態（第 1 處，欄位標題） | both | 第 2 處在說明文字「活動狀態變更後立即生效」內，不編號 |
| [3] | 活動類型 | 活動類型 | 下拉選單 | 活動類型 | both | [TO CONFIRM] 允許值待營運確認 |
| [4] | — | 複製活動 | 按鈕 | 複製活動 | wireframe-only | |
| [5] | 內部備註 | — | 輸入框 | — | spec-only | |

Column by column, and each maps to exactly one `mapping.json` field:

- **`類別`** (`category`) — the control type, read off the real Wireframe control and never
  off the field's name. It is what `component-name-genericness` measures a component name
  against, which is why a bare 按鈕 "belongs in `category` alone": this column is where it
  belongs.
- **`錨點`** (`wireframeAnchor` / `wireframeAnchors`) — the text the badge attaches to, **and
  which occurrence** when the pre-flight flagged that text as ambiguous. Name the occurrence
  in words the user can check against the screen ("第 1 處，欄位標題"), not a bare `nth=1`.
  It reads `—` for a Spec-only row and lists every location for a shared number.
- **`Side`** (`side`) — `both` / `spec-only` / `wireframe-only`, written out rather than
  inferred from a `—` in another column. A reader should not have to decode a dash to see
  that a row is single-sided, and the Step 2 (a)/(b)/(c) decision that produced it is exactly
  the kind of thing an approval should restate.
- **`Note`** — free text, and free text only: why a repeated field shares one number, what a
  `[TO CONFIRM]` on that row is waiting on. Nothing that a script reads is recorded here.

**A row carrying `[TO CONFIRM]` says so in `Note` and sets `toConfirm: true` on that
entry** — the two move together, like a version bump and its Change Log row.

Wait for confirmation. Apply requested changes and present again until approved. Only an
approved table may be used.

Immediately after approval, persist the rows into `mapping.json`. The conversation is never
the source of truth for numbering — `mapping.json` is.

Then present a short page summary (page name, numbers used, any `[TO CONFIRM]` items) and
ask, in Traditional Chinese, whether the page is approved and whether to continue. When the
last page is confirmed, proceed to Step 4.

### Step 4: Build

```
node <skill-folder>/scripts/build-export.js <export-folder>
```

It reads `mapping.json`, the spec MD, and the Wireframe HTML; writes the three files; and
prints the counts it emitted. It also records `files` and `sourceHashes` back into
`mapping.json`.

**Reconcile those counts, which means checking these four equalities** — a step with no
stated pass condition cannot be failed, and this one is the first place a mis-authored
`mapping.json` shows up as a number instead of as a wrong document:

| Printed | Must equal |
|---|---|
| `numbers` | the number of `entries` |
| `spec definition` | entries with a `specField` (i.e. all but the `wireframe-only` rows) |
| `spec narrative` | the total anchor count across `narrativeRefs` — `0` unless this export authored any |
| `wireframe badges` | the total wireframe anchors: entries that are not `spec-only`, counting a shared number once per location in its `wireframeAnchors` |

A discrepancy is always in `mapping.json`, never in the build — `verify.js` `badge-counts`
would catch it too, but at Step 4 you already know which entry to look at.

Worked example, deliberately mixing both single-side kinds and one shared number so no
equality is left untested: 8 entries — 6 two-sided, 1 Spec-only, 1 Wireframe-only, and one of
the two-sided rows pinned at 3 locations via `wireframeAnchors` — prints `numbers 8 / spec
definition 7 / spec narrative 0 / wireframe badges 9`. (7 = 8 − the Wireframe-only row; 9 =
8 − the Spec-only row, + 2 for the shared number's extra locations.)

The build fails loudly rather than guessing. A `specField` matching no row in its
`itemDefSection`, a wireframe anchor matching nothing, and a wireframe anchor matching
several places with no `nth` are all hard stops — an anchor resolving to the wrong element
is worse than a stopped build, because nothing downstream can detect it.

Running the build mid-loop to preview a page is fine; it is a build, not a delivery.

### Step 5: Verification and delivery

Verification runs in four layers. **The order below is itself a rule**: `build-export.js`
overwrites the three files, so any layer that rebuilds must come *before* the layer that
judges the final bytes — otherwise nothing has ever verified what actually ships.

**Layer 1 — clean build.** Prove the files on disk came from the generator and not from
someone's editor. The step order is the whole check:

```
shasum -a 256 <export-folder>/*.html                           # 1. hash what is on disk NOW
node <skill-folder>/scripts/build-export.js <export-folder>    # 2. rebuild over them
shasum -a 256 <export-folder>/*.html                           # 3. hash again, compare with 1
```

Rebuilding first and comparing afterwards compares each file with itself and passes
unconditionally — it would report a clean build on a file hand-edited beyond recognition. The
pre-rebuild hashes are the only evidence there is. Any hash that changes means the delivered
file did not come from the current sources and `mapping.json`: something was hand-edited, and
the edit is now gone. Report what changed rather than re-running until it settles.

**Be honest about what this establishes on a first delivery.** If Step 4 built the files
minutes ago and nothing has touched them since, a match is close to guaranteed — it proves
only that nothing changed *between Step 4 and here*, which is a narrow claim, though a real
one when a source was still being edited during the loop. The layer earns its keep on a
re-run, on any post-delivery change, and on an export someone else handed you. Say
「重新建置後位元組一致」 in the delivery, not 「已證明無人手改過」, unless the export actually
predates this session.

**Layer 2 — mechanical.** `node <skill-folder>/scripts/verify.js <export-folder>`. Every FAIL
must be fixed and the script re-run until zero remain. Every WARN must be fixed or explained
in the delivery message — never silently dropped. **On any FAIL or WARN whose evidence line is
not immediately actionable, read `references/verify-checks.md`.**

**Layer 3 — rendered (optional).** See Rendered Verification below. Tab switching is pure CSS
and fully settled by `tab-markup`, so this layer adds visual confirmation, not correctness.
Its absence is stated, never silently skipped.

**Layer 4 — AI review.** The Checklist rows no script settles.

**If any layer causes a rebuild, every layer from 1 onwards runs again.** Fixing a Layer-2
FAIL means editing `mapping.json` or a source and rebuilding, which invalidates the Layer-1
hashes and the Layer-2 result alike. Deliver only from a pass where the last thing to touch
the three files was a `verify.js` run that read them, not a build that rewrote them.

Verification is internal: run the layers, fix what they find, and do not present detailed
results as a deliverable or wait for approval. When every layer passes, deliver
immediately. The delivery message contains:

- a **one-line verification conclusion** with real totals, e.g.
  「verify.js 檢查全數通過（N 項）；三個檔案重新建置後位元組完全一致」. `N` is read off the
  script's own output for this run — never carried over from this example or from memory,
  since checks are added over time. Include the detailed Check / Result / Evidence
  table only when something needs the user's attention — an unresolved WARN, a skipped
  layer, an `approvedExceptions` entry — or when asked;
- the three deliverable paths, and which one to hand to whom;
- **the consolidated mapping table of ALL screens, rendered from `mapping.json`.** This is a
  different table from Step 3's, and deliberately so: Step 3's exists to be *approved*, so it
  carries the prose anchor description and free-text notes that make approval meaningful; this
  one exists to be *kept*, so every column reads straight out of `mapping.json` and stays true
  after a re-run. Its columns are 編號 (`no`) / 畫面 (`page`) / Spec 欄位 (`specField`, `—`
  when absent) / Wireframe 元件 (`wireframeComponent`, `—` when absent) / 類別 (`category`) /
  Side (`side`). Do not carry Step 3's 錨點 and Note columns into it — neither is stored, so
  reproducing them means retyping from the conversation, which is exactly the drift this table
  is meant not to have. Anything from those columns that the user still needs goes in the
  decision memo below, where prose belongs.

The message MUST also include a **decision memo** in Traditional Chinese: every technical
judgment made independently during the run, plus all `[TO CONFIRM]` items deferred across
all pages. If there are none, state 「本次無自行判斷事項」.

## Post-Delivery Changes

After an export is delivered, a change to either source routes one of two ways, and the
question that decides it is **whether the set of numbered components changed**. Getting
this wrong is how a delivered export becomes internally inconsistent, so when it is not
obvious which kind a change is, **ask** — never self-certify.

**Before touching anything, run `verify.js` on the delivered export and keep the result.**
A pre-existing WARN mistaken for damage this change caused sends the next hour in the
wrong direction.

**(a) Presentation or wording change — re-run, nothing else.** A spec sentence reworded, a
rule clarified, a Wireframe label restyled, a badge colour override, a version bump. The
numbered components are the same ones. Re-run `build-export.js` then `verify.js`. No
renumbering, no re-confirmation, no return to Step 2.

**(b) Component-set change — back through Steps 2–3 for the affected page.** A field added,
removed, renamed, merged, or split; a screen's block order changed; the numbering scope
switched between changed-only and all-fields. All of these change the numbering, because
**numbers follow screen order**: a field added in the middle of a screen takes the number
at that position and everything after it shifts. Do not avoid the shift by appending the
new field's number at the end — that silently breaks the screen-order contract the whole
export rests on, and no check can detect it because the file is still internally
consistent.

**Renumbering is a two-pass edit to `mapping.json`, never an in-place shift.** Overlapping
ranges corrupt silently: `[5]→[7]` followed by `[7]→[9]` turns the first field into `[9]`
with no error anywhere. Pass 1 moves every affected `no` to a unique temporary value
outside the final range (1001, 1002, …); pass 2 moves the temporaries to their final
numbers. Then rebuild.

**A renumbering invalidates every number already quoted outside the export** — a Jira
ticket, a review comment, a chat thread saying "[7] 的預設值要改". State in the delivery
message exactly which numbers moved and to what, so the user can decide who needs telling.
An export that renumbers silently is worse than one that never shipped.

**In both cases the files are regenerated in full through `build-export.js`, never patched
row by row.** Hand-patching a delivered file is what this skill's rules exist to prevent.

## What to Ask vs. What to Decide

Only ask about functional requirements. Resolve technical decisions independently.

| Type | Examples | Who decides | When |
|---|---|---|---|
| **Ask the user** | Which components are numbered, UI block order, whether a spec field maps to a Wireframe component, single-side resolution, numbering scope, which spec section is a page's `itemDefSection`, which occurrence an ambiguous anchor means, a field's default value, which of several allowed options a field takes, any change reaching beyond this feature | User | Steps 1–3 |
| **Decide independently** | HTML structure and tag choices, CSS values, badge colours, tab implementation, file naming, how the badge span is inserted without disturbing layout | AI | Never asked |

If something unclear falls under the technical category, decide, proceed, and record it in
the decision memo — do not pause to ask.

The three additions to the ask column — default value, multi-option field, cross-module
reach — are the ones most often rationalized into the technical column, because each has a
plausible-looking answer sitting right there in the Wireframe or the spec's prose. They are
requirement content regardless of how obvious the answer appears.

## Numbering Rules

- Numbers start at 1 and increment globally — no resets between sections, pages, or tabs.
  The only allowed duplication is a repeated component sharing its number across screen
  locations.
- **Numbering order follows Wireframe screen order**: top-to-bottom, left-to-right. The
  spec's own table order is irrelevant.
- **A Spec-only row has no screen position, so it is numbered after every two-sided and
  Wireframe-only row on its screen** — last within that screen, and in the spec table's own
  order when there are several. Screen order cannot rank something that is not on the screen,
  and placing it "where the spec lists it" would shift the numbers of real components to make
  room for one nobody can point at. Say so in that row's `Note` in Step 3, so the user reads
  it as a rule rather than an oversight.
- The same component uses the same number in the spec document and the Wireframe.
  **Exception:** approved single-side items appear on one side only and carry their "Spec
  Only" / "Wireframe Only" marking.
- **Numbering scope = exactly the rows in the approved mapping table.** The build never
  mints a number, and Change Log and Metadata are never badged.
- **Repeated components share one number**, provided their spec rules are identical in every
  location. Same-named fields with different rules are different items. Whether every
  location gets its own `wireframeAnchors` entry or only the first one is badged depends on
  whether the repetition is sequential (a flow's steps — badge every occurrence) or parallel
  (the same structure repeated for BDT/EUR/THB-style data multiplicity — badge the first
  occurrence only, by default). See Step 2's "Repeated fields" for the full distinction.
- **Renumbering safely.** Never replace old numbers with new ones directly — overlapping
  ranges corrupt silently ([5]→[7] then [7]→[9] turns the first field into [9] with no
  error). Since numbers live in `mapping.json` rather than in hand-edited HTML, renumbering
  is an edit to that file followed by a rebuild.

## Badge Style

Badges are one small rounded chip carrying the bare number, identical in all three files:

```html
<span class="ref-num">1</span>
```

The CSS lives in `build-export.js`, which emits it with each value defaulted and
overridable from `mapping.json` (`refNumBg`, `refNumColor`). It is deliberately not
duplicated here: a second copy in this file would be a second source of truth that silently
drifts. To change the style, edit the generator; to change one export's colours, set the
override keys.

Describe colours in conversation using semantic names — "primary colour", "accent colour",
"warning colour". Concrete colour values appear only in the CSS variable definitions the
generator emits, never scattered inline.

## Mechanical Verification (verify.js)

```
node <skill-folder>/scripts/verify.js <export-folder>
```

Plain Node, no dependencies. Reads `mapping.json` and the three delivered files; prints a
PASS / WARN / FAIL table with evidence; exits non-zero if any FAIL remains.

The checks it runs, and what each finding means, are documented in
`references/verify-checks.md` — that file's table is the authoritative list; this file
never states a count, so the two cannot drift when a check is added. **Read it whenever a
check FAILs or WARNs** and the script's own evidence line is not enough to act on.

FAIL = fix and re-run until zero remain; WARN = fix, or explain in the delivery. The script
run is the evidence — never claim a machine-checkable item passed without an actual run
behind it.

### The three non-waivable checks

`md-content-fidelity`, `cross-file-parity`, and `wireframe-integrity` cannot be waived — not
by the user, not by another BU's approver, not to meet a delivery date. They are what this
export promises: the spec's content survived the conversion, a number labels the same
component in both documents, and the Wireframe's markup came through untouched. A promise
that can be waived is not one. `verify.js` reports an `approvedExceptions` entry naming any
of them as its own FAIL.

Every other WARN may be waived, one finding at a time, with the user's explicit approval
recorded in `mapping.json` `approvedExceptions` — `check`, `target`, `approvedOn`,
`approvedBy`, `reason`, all required. An exception whose check did not fire this run is
reported as stale.

## Rendered Verification (Playwright, optional)

Tab switching is pure CSS — two radios, two labels, two panels, two `:checked ~` rules —
which `tab-markup` settles completely without a browser. That is deliberate: a BU with no
Playwright available gets the same proof of correctness as one that has it.

What a browser adds is visual judgment no static check reaches: whether the badge colour is
actually legible against this particular Wireframe's background, and whether a badge reads
as belonging to the component next to it. When Playwright is available:

0. **Serve the export folder:** `node <skill-folder>/scripts/serve.js <export-folder>`. A
   `file:` URL is refused outright by the browser Playwright drives, and the Wireframe
   frame's own `fetch` calls would be blocked by CORS even if it were not. The script prints
   the URL of each delivered file and shuts itself down after its timeout (default 300s,
   `--timeout`), so no process needs killing and no port is left held. Never hand-write a
   server for this — hand-written code in the verification path is exactly what verification
   exists to rule out.
1. Open the combined file and confirm the spec tab is active on load.
2. Click the Wireframe tab; confirm the frame renders and the panel switched.
3. Count `.ref-num` elements per panel and compare against `mapping.json`. **The Wireframe
   panel's badges are not reachable by a query on the panel** — it is an `<iframe>`, so they
   live in its `contentDocument` and a per-panel selector returns 0. Count the spec panel with
   a normal query and the Wireframe frame through `contentDocument`, or the check reports the
   Wireframe as having no badges at all.
4. Confirm badge colours are legible against the Wireframe's own background.
5. Confirm the traceability header appears **once** per tab — the outer header is hidden on
   the Wireframe tab because the frame carries wireframe.html's own copy.

When Playwright is unavailable, denied, or its browser profile is already in use by another
session, say so in the delivery and downgrade this layer to explicit user action — never
silently skip it, and never grab a browser another session is holding.

## Run Artifact Hygiene

The rendered layer leaves things behind that are not deliverables, and the Playwright tools
write some of them without being asked. As the last action before the delivery message,
confirm all of the following:

- **`.playwright-mcp/` is gone from the working directory.** The tools auto-save page
  snapshots, console logs, and screenshots there whenever they are used. Nobody requested
  them and nobody wants them in the project; delete the directory.
- **No screenshot or snapshot from this run persists anywhere.** They were a means of
  checking, not a record to keep. If one genuinely needs to be shown to the user, show it and
  then delete it — do not leave a copy behind "in case".
- **The serve script's port is free** — but **do not wait it out**. `serve.js` holds the port
  for its whole `--timeout` and then releases it by itself, so polling until it dies is a
  procedure this section does not ask for and the run does not need. Pass a `--timeout`
  matched to the checking you intend (60–120s is usually plenty) and move on. Only check the
  port when something ended abnormally, or when a later run reports the port in use.
- **Any intermediate snapshot file from the `references/non-standard-wireframe-inputs.md`
  recipes is gone once it stops being load-bearing.** A per-file rendered snapshot produced
  before merging multiple Wireframe sources is a work file, not a source — once folded into
  the merged file and `preflight.js` passes against that merged file, delete it the same way
  as `.playwright-mcp/`: automatically, as a normal part of finishing the step, not on the
  user's request.

The only files that survive a run are the three deliverables and `mapping.json`.

## Concurrent Session Guard

An export folder must only be worked on by one session at a time — two sessions editing the
same files or driving the same browser corrupt each other silently. Watch for:

- The Playwright browser refusing to launch with a "browser is already in use" profile error
- An output file or `mapping.json` changing on disk without this session having written it

On either signal, **stop and ask the user** whether another session is working on this
export; do not grab the browser, overwrite files, or "fix" the unexpected changes. Resume
only after confirmation — then re-read every file from disk, since the other session's state
supersedes this session's memory.

## Checklist

The "Verified by" column names the evidence source — machine-checkable rows are settled by
the script, never by AI self-declaration.

The rows settled by `verify.js` are not repeated here; each of its checks maps onto a
Checklist row in `references/verify-checks.md`. What remains below is everything no script
settles.

| Check | Verified by | Description |
|---|---|---|
| Files are a clean build | `shasum` before and after a `build-export.js` re-run | The delivered files hash the same before and after a rebuild — proof nothing came from a hand-edit. Hashing only *after* the rebuild proves nothing at all; see Step 5 for why the order is the check |
| Spec field naming | AI review | Every `specField` reads as the spec's own Item name, not a paraphrase of it |
| Badge points at the right component | AI review | Every badge reads as belonging to one specific element — `cross-file-parity` proves the number is on both sides, this settles whether it is on the right thing |
| Single-side resolution confirmed | AI review | Every Spec-only / Wireframe-only item went through the Step 2 (a)/(b)/(c) confirmation and carries its marking |
| Spec MD edits are template-conformant | AI review | Every Step 2(b) edit carries its minor version bump, its updated `Last Updated`, and its own Change Log row, and any edit to a Confirmed document carries its `[CHANGE REQUEST]` |
| Every `[TO CONFIRM]` traces to a question | AI review | Each tag names an item the user was asked about individually and chose to defer — none was applied on the skill's own judgment |
| Rendered verification | Playwright, when available | Tabs switch, frame renders, badge colours legible — or its absence is stated in the delivery |

If any item fails, fix it and re-check.

## Never Do

- Hand-write or hand-patch any of the three delivered HTML files — all are build outputs,
  the next run silently discards a manual edit, and `wireframe-integrity` or
  `combined-composition` fails it anyway. Fix `mapping.json`, the sources, or the
  generator, then re-run
- Waive `md-content-fidelity`, `cross-file-parity`, or `wireframe-integrity`, or record an
  `approvedExceptions` entry naming one — they are the export's entire promise
- Record any `approvedExceptions` entry without the user's explicit approval of that
  specific finding, or without `approvedOn` / `approvedBy` / `reason`
- Deliver without a zero-FAIL `verify.js` run over the final files, or claim a
  machine-checkable item passed without an actual run behind it
- Check "files are a clean build" by rebuilding and then comparing — the rebuild overwrites
  the files, so that comparison passes unconditionally. Hash first, then rebuild, then compare
- Decide on your own whether a feature is brand-new, which occurrence an ambiguous anchor
  means, or whether a control is generic enough to fall outside the numbering scope — all
  three change what the user is asked, so all three are asked
- Pause the delivery to ask the user to review verification results that passed —
  verification is internal
- Import `scripts/lib/badge-inject.js` or `sections.js` from verify.js — the verifier must
  judge the delivered output independently
- Modify original text content in the spec or the Wireframe — the only exception is a
  user-approved single-side resolution in Step 2, applied exactly as confirmed to the
  **source**, never to a delivered file
- Edit the Wireframe to make an un-injectable label injectable, or number only the components
  that happen to be anchorable — report the limitation and stop; a partial numbering hides its
  own gaps
- Edit the spec MD without first reading its Status — a Confirmed document takes a
  `[CHANGE REQUEST]` and its own approval
- Leave a spec MD edit without its version bump, its updated `Last Updated`, and its Change
  Log entry, or apply any one of the three without the other two — they move together, always
- Write `[TO CONFIRM]` on an item the user was never asked about individually, or on one
  they answered — the tag records the user's deferral, not an unresolved analysis
- Decide a field's default value or pick from its allowed options because the Wireframe or
  the prose makes one look obvious — both are requirement content and both are asked
- Resolve a single-side item silently — every one goes through the Step 2 (a)/(b)/(c)
  confirmation; never default to "keep single-side" on your own
- Start numbering a page before the user approves its mapping table, or start the next page
  before the user confirms the current one
- Treat a component-set change (a field added, removed, renamed, merged, split; block order
  changed; scope switched) as a plain re-run — it routes back through Steps 2–3; when unsure
  which kind a change is, ask instead of self-certifying
- Append a newly added field's number at the end of the range to avoid renumbering — numbers
  follow screen order, and no check can detect the violation because the file stays
  internally consistent
- Renumber by shifting numbers in place — always two passes through unique temporaries,
  because overlapping ranges corrupt silently
- Deliver a renumbered export without stating which numbers moved — numbers already quoted
  in a ticket or a review comment now point at the wrong field
- Start a post-delivery change without a baseline `verify.js` run — a pre-existing WARN then
  reads as damage the change caused
- Reset numbering between sections, pages, or tabs
- Use different numbers for the same component across the two documents
- Mint numbers outside the approved mapping table, or badge the Change Log or Metadata
- Guess which occurrence an ambiguous wireframe anchor means — set `nth`, or ask
- Treat the conversation as the source of truth for numbering — the approved state lives in
  `mapping.json`
- Write or edit `mapping.json` without having read `references/mapping-schema.md` this
  session — the field semantics live only there, and a guessed key name produces a file
  that builds but is wrong
- Restate a `references/` file's content in this file to avoid reading it — a second copy
  drifts from the first, and the drift is silent
- Add a `<script>` to combined.html — tab switching is pure CSS so that a BU without
  Playwright still gets a complete proof of the switching behaviour
- Declare `.ref-num` more than once in combined.html
- Proceed silently past a missing Metadata table or opening-section heading — Step 1 stops
  and asks
- Work around an `md-render.js` throw by rewording the spec — report the unsupported
  construct and agree how to handle it
- Scatter colour codes inline — they live only in the CSS variable definitions the
  generator emits
- Deliver `mapping.json` as if it were part of the handover — it stays in the folder for
  re-runs and audits
- Hand-write a server, or any other code, for the rendered layer — `scripts/serve.js` exists,
  and hand-written code in the verification path is what verification exists to rule out
- Leave `.playwright-mcp/`, a screenshot, or a snapshot on disk after the run
- Continue editing or verifying an export while signals indicate another active session

## Changelog Maintenance

Modifying any file in this skill folder (`scripts/`, `references/`, `SKILL.md`,
`TEAM-GUIDE.md`, `CHANGELOG.md`) requires the current user's explicit confirmation first —
this applies to every case, including a bug fix discovered via `verify.js` or any other
in-flow finding. Stop, describe the bug and the proposed fix, and wait for approval before
editing; never patch and report afterward. Once approved, append a new version entry to
`CHANGELOG.md` immediately as part of the same edit — patch for fixes/wording, minor for
feature additions or workflow changes, major for a full redesign. The `**Author:**` line is
always the person who just gave that approval, asked directly in the moment — never copied
forward from a previous entry's author.

Follow the format already established in that file (Keep a Changelog:
`## [X.Y.Z] - YYYY-MM-DD` newest on top, an `**Author:**` line, entries grouped under
`### Added` / `### Changed` / `### Removed` / `### Fixed`). Written entirely in English,
like the rest of this skill — read the file's first entry as the template rather than
working from memory.

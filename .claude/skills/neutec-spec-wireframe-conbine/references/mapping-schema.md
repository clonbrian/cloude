# mapping.json Schema

`mapping.json` is the single machine-readable source of truth for an export. The
conversation is never the source of truth for numbering — this file is. Read this
page before writing or editing one: guessing a key name from an example produces a
file that builds and is wrong.

Written incrementally: header fields at Step 1, `entries` as each page is approved at
Step 3, and `files` / `sourceHashes` by `build-export.js` itself at Step 4.

## Why the field names are what they are

`featureName`, `exportDate`, `specVersion`, `sources`, `pages`, `entries`, and
`narrativeRefs` are deliberately generic rather than named after this export's own
mechanics. An approved numbering is expensive — it costs a full pass of user
confirmations — and it is the kind of thing another tool may legitimately want to reuse:
a screenshot-based guide generator, a Jira exporter, a QA checklist builder. Any of those
can read this file and produce the same numbers, which is the point, because an engineer
must never hold two documents for one feature where `[7]` means different fields.

Nothing in this export depends on that ever happening. If no other tool in your
environment reads `mapping.json`, the file is still what makes a re-run and a
re-verification possible, and this section changes nothing about how you write it.

## Full example

```json
{
  "featureName": "vip-rebate",
  "exportDate": "2026-08-07",
  "specVersion": "v1.3",
  "specStatus": "Draft",
  "numberingScope": "changed-only",
  "sources": {
    "specMd": "../../specs/vip-rebate.md",
    "wireframeHtml": "../../wireframes/vip-rebate.html"
  },
  "tabLabels": { "spec": "Spec", "wireframe": "Wireframe" },
  "pages": [
    {
      "id": "setting",
      "label": "返水設定頁",
      "itemDefSection": { "chapter": "4. Feature Description", "section": "4.2.1 返水設定頁" }
    }
  ],
  "entries": [
    { "no": 1, "page": "返水設定頁", "specField": "返水級距", "wireframeComponent": "返水級距", "side": "both", "category": "下拉選單" },
    { "no": 2, "page": "返水設定頁", "specField": "結算週期", "wireframeComponent": "結算週期", "side": "both", "category": "文字顯示" },
    { "no": 3, "page": "返水設定頁", "specField": null, "wireframeComponent": "匯出報表", "side": "wireframe-only", "category": "按鈕" },
    { "no": 4, "page": "返水設定頁", "specField": "備註", "wireframeComponent": null, "side": "spec-only", "category": "輸入框" }
  ],
  "narrativeRefs": [],
  "approvedExceptions": [],
  "refNumBg": "rgba(214, 40, 40, 0.85)",
  "refNumColor": "#fff",
  "files": { "spec": "…-spec.html", "wireframe": "…-wireframe.html", "combined": "…-combined.html" },
  "sourceHashes": { "specMd": "d74fbe…", "wireframeHtml": "64d68b…" }
}
```

## Header fields

| Key | Required | Meaning |
|---|---|---|
| `featureName` | yes | Lowercase, hyphen-separated. Names the export folder and the three files |
| `exportDate` | yes | `YYYY-MM-DD`. The snapshot date the delivered files report |
| `specVersion` | no | Read from the spec's Metadata table when absent, **and written back by the build** — so it appears in the file after a build even if you never authored it. Set it explicitly only when the spec has no Metadata table |
| `specStatus` | no | Same rule, including the write-back. `Draft` / `In Review` / `Confirmed`. Reaches the reader on every file, so an RD opening only wireframe.html can tell the requirement is still under discussion |
| `numberingScope` | no | `changed-only` (default) or `all-fields`. Recorded for the audit trail; no script reads it |
| `numberingScopeNote` | no | Free text, and the field that actually carries the decision. The enum above rarely expresses it — "all fields, but 儲存 excluded as a generic control while 複製活動 is included" fits neither value. Name the controls left unnumbered and why, or the reason is lost: a gapless 1..N tells a later run nothing about what was deliberately left out |
| `sources.specMd` | yes | Path to the spec MD. Absolute, or **relative to the export folder** |
| `sources.wireframeHtml` | yes | Path to the Wireframe HTML. Same rule |
| `templateHeadings` | no | Heading titles this document uses for its Metadata table, Change Log, and opening section. See below |
| `tabLabels` | no | Tab captions in combined.html. Defaults `Spec` / `Wireframe` |
| `refNumBg` / `refNumColor` | no | Badge colours. Defaults to a semi-transparent red on white text |
| `files` | written by build | The three delivered file names. `verify.js` reads them |
| `sourceHashes` | written by build | sha256 of both sources at build time |

**`sources` paths resolve against the export folder, not the working directory.** A
path recorded relative to wherever the command happened to run makes
`md-content-fidelity` and `wireframe-integrity` unable to read the sources — and both
are non-waivable, so the run stops rather than degrading quietly.

## `templateHeadings`

**Omit this key entirely when the document uses the default titles** — that is why it is
absent from the example above. It is an override, and writing it out with the defaults in it
makes a document that needed no override look like one that did, which matters because the
key decides where badges are forbidden. SKILL.md's rule is that no `templateHeadings` value
is recorded without the user having seen it; a set of defaults nobody was shown is precisely
the case that rule exists to prevent.

The floor is this team's own template (`Metadata` / `Change Log` / `Purpose`). Another
BU whose template names the same things differently records the mapping here:

```json
"templateHeadings": { "metadata": "文件資訊", "changeLog": "修訂紀錄", "purpose": "背景與目標" }
```

`metadata` is what `build-export.js` reads Version and Status from. `changeLog` and
`purpose` are what `excluded-zones` uses to decide where badges are forbidden — a
wrong value there means the Change Log can be badged with nothing objecting, so
confirm the titles against the actual spec rather than assuming.

## `pages`

| Key | Meaning |
|---|---|
| `id` | Short slug, unique in the file |
| `label` | Display name. **Must equal the `page` value on every entry exactly** — that string is what assigns entries to a page |
| `itemDefSection.chapter` | The `<h2>` chapter title, verbatim |
| `itemDefSection.section` | The sub-heading whose field table defines this page's components, verbatim. **Omit it** when the chapter has no sub-heading — see below |

`itemDefSection` is where definition badges are placed. A page whose fields are
defined in no spec section is a gap to raise with the user, not a field to leave blank.

**When the Item table sits directly under the chapter heading with no sub-heading**, omit
`section` entirely rather than repeating the chapter title in it:

```json
"itemDefSection": { "chapter": "4. Feature Description" }
```

The lookup then scopes to the whole chapter, which is the correct region in that layout. Do
not invent a sub-heading that the spec does not have. (Setting `section` to the same string
as `chapter` resolves to the identical region — verified, not assumed — so an existing
mapping written that way is not broken and does not need changing. Omitting it is simply
clearer about what the spec actually contains.)

This shape only works while **one** page maps to that chapter. Two pages sharing a chapter
with no sub-headings between them cannot be told apart by any value here — that is a real
structural gap in the spec, and it is raised with the user (a sub-heading per screen) rather
than worked around.

## `entries`

One row per approved number.

| Key | Meaning |
|---|---|
| `no` | The number. Runs 1..N across the whole export, never resets |
| `page` | The owning page's `label` |
| `specField` | The spec's own Item name, **verbatim**. Must equal the first cell of its row in that page's `itemDefSection`, or the build fails loudly. `null` for a wireframe-only row |
| `wireframeComponent` | The component's actual on-screen label ("匯出報表", "確認"), never a category word ("按鈕", "文字顯示"). `null` for a spec-only row |
| `side` | `both` (default) / `spec-only` / `wireframe-only` |
| `category` | The control type (下拉選單, 輸入框, 按鈕). Recorded for the audit trail |
| `wireframeAnchor` | Optional. `{ "text": "…", "nth": 2 }` — where the wireframe badge goes when the component's own name is not the text to anchor on |
| `wireframeAnchors` | Optional. The array form, for a component appearing in several places |
| `toConfirm` | Optional. `true` when the user was asked about this field individually and explicitly chose to defer. Never set on the skill's own judgment |

**Anchoring on the Wireframe side.** With neither key set, the badge anchors on
`wireframeComponent` itself, which is the common case. Set `wireframeAnchor` when that
text does not appear in the Wireframe verbatim, or appears somewhere else first. When
the anchor text matches more than one place and no `nth` is given, the build **fails**
rather than picking one — an anchor resolving to the wrong element is worse than a
stopped build, because nothing downstream can detect it.

Anchor text is matched against the Wireframe's **visible text only**. Content inside
`<script>` and `<style>` is skipped: a label existing only as a JS string is not text
the reader sees, and injecting into a script body breaks the page. A Wireframe that
renders its labels from an embedded JS payload cannot be badged by this skill — say so and
stop. Annotating a screenshot of the rendered page is a different technique, needing a
browser, and is outside this skill's scope; see SKILL.md Step 1's injectability check.

## `narrativeRefs`

Empty by default in this skill, and part of the schema so a mapping file stays readable by
anything else that consumes it. Authoring one badges a mention of an already-numbered field
in prose:

```json
{ "no": 1, "chapter": "4. Feature Description", "section": "4.2.1 返水設定頁",
  "anchors": [ { "text": "返水級距" }, { "text": "返水級距", "nth": 2 } ] }
```

It never mints a number: every `no` must already be an approved entry. An anchor that
stops resolving means the spec was reworded — update the anchor to the new wording,
never shorten it until it happens to match something.

## `toConfirmNotes`

Where a deferral that belongs to no single entry is recorded — a missing System Rule, a
field the spec's Exception Handling references but never defines, an option set nobody could
confirm today. A deferral about a numbered field uses that entry's `toConfirm` flag instead.

```json
"toConfirmNotes": [
  { "item": "活動類型的允許值",
    "question": "Wireframe 顯示 固定比例 / 階梯式 / 首儲加倍 三個選項，spec 未列舉，請確認哪些成立",
    "deferredOn": "2026-08-07" }
]
```

`item` and `question` are both required, and `question` is the question **as it was actually
put to the user** — that is what makes the tag auditable later. `verify.js`
`to-confirm-recorded` WARNs while any entry or note carries a deferral, so it reaches the
delivery message instead of being forgotten in the conversation.

Neither field may be written on the skill's own judgment. `[TO CONFIRM]` records the user's
explicit deferral of a question they were individually asked — nothing else. An unresolved
analysis is not a deferral; ask the question again instead.

## `openQuestions`

A question that was put to the user and has **not been answered** — distinct from a
deferral, which is an answer ("leave it open"). The distinction matters to whoever reads the
delivered export later: a `[TO CONFIRM]` says a human weighed the item, an open question says
nobody has.

```json
"openQuestions": [
  { "item": "活動類型的預設值",
    "question": "Wireframe 的下拉選單預設顯示「固定比例」。新建活動時這是預設值，還是必須由使用者主動選擇？",
    "askedOn": "2026-08-08",
    "blocks": "none — 編號不受影響，答案只需在 spec 補一句" }
]
```

`item` and `question` are required and carry the same weight as in `toConfirmNotes`:
`question` is the wording actually put to the user. `blocks` states what the missing answer
holds up — almost always nothing, since numbering follows screen position rather than field
semantics, and saying so tells the user whether answering costs a wording re-run or a
renumbering.

`verify.js` `to-confirm-recorded` surfaces these alongside deferrals, so an unanswered
question cannot quietly fail to reach the delivery message. Delivery is not held for one:
Step 5 ships the export and repeats the question under its own heading.

## `approvedExceptions`

A flat array. Each entry waives one **WARN** that actually fired on this run:

```json
{ "check": "component-name-genericness", "target": "[4]",
  "approvedOn": "2026-08-07", "approvedBy": "Lina Chia",
  "reason": "此按鈕在畫面上的實際文字就是「確認」，無更具體名稱" }
```

Rules `verify.js` enforces on this array:

- **`md-content-fidelity`, `cross-file-parity`, and `wireframe-integrity` can never be
  waived** — by anyone, for any reason. An entry naming one of them is reported as its
  own FAIL. They are the export's entire promise; a waivable promise is not one.
- A FAIL is never waivable either. Only WARNs are.
- `approvedOn`, `approvedBy`, and `reason` are all required — an exception with no
  named approver is indistinguishable from a self-approval.
- An entry whose check did not fire this run is reported as stale and removed.
- The approval is the **user's**, given on that specific finding. A general "go ahead"
  earlier in the run is not it.

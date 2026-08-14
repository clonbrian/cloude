#!/usr/bin/env node
'use strict';

// Mechanical verification of a delivered export. Plain Node, no dependencies.
//
//   node scripts/verify.js <export-folder>
//
// Prints a PASS / WARN / FAIL table with evidence and exits non-zero if any FAIL remains.
// What each check proves, and what a finding means, is in references/verify-checks.md.
//
// INDEPENDENCE RULE — this file must never require() anything from scripts/lib/. It
// re-derives everything it judges straight from the delivered bytes: its own Markdown
// content-unit reader, its own heading scan, its own badge and anchor counting. A
// verifier that shares the generator's interpretation of the sources agrees with the
// generator's bugs, and neither of them can see it.
//
// THREE CHECKS ARE NOT WAIVABLE, by anyone, for any reason:
//   md-content-fidelity   the spec's content survived the conversion
//   cross-file-parity     a number labels the same component in both documents
//   wireframe-integrity   the Wireframe's own markup came through untouched
// They are this skill's entire promise. An approvedExceptions entry naming one of them
// is itself reported as a FAIL rather than honoured.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const NON_WAIVABLE = new Set(['md-content-fidelity', 'cross-file-parity', 'wireframe-integrity']);

const BADGE_RE = /<span class="ref-num">(\d+)<\/span>/g;
const SENTINEL_RE = /<!-- ref-export:begin -->[\s\S]*?<!-- ref-export:end -->\n?/g;

// ------------------------------------------------------------------- helpers

const results = [];
function record(name, status, evidence) {
  results.push({ name, status, evidence });
}
const pass = (n, e) => record(n, 'PASS', e);
const warn = (n, e) => record(n, 'WARN', e);
const fail = (n, e) => record(n, 'FAIL', e);

function die(msg) {
  process.stderr.write(`verify: ${msg}\n`);
  process.exit(2);
}

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

function decodeEntities(s) {
  return String(s)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

// Visible text of an HTML document: script/style bodies and comments dropped, tags
// replaced by a space so adjacent cells do not fuse into one word.
function visibleText(html) {
  return decodeEntities(
    String(html)
      .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<[^>]*>/g, ' ')
  );
}

// Comparison form. Whitespace is removed entirely rather than collapsed: the renderer
// legitimately introduces and removes spaces at tag boundaries (`A**B**C` becomes
// `A<strong>B</strong>C`), and the team's documents are largely CJK, where spacing
// carries no word boundary at all. Every non-whitespace character still has to be there
// in the same order.
const cmp = (s) => String(s).replace(/\s+/g, '');

function badgeNumbers(html) {
  const out = [];
  let m;
  const re = new RegExp(BADGE_RE.source, 'g');
  while ((m = re.exec(html)) !== null) out.push({ no: Number(m[1]), at: m.index });
  return out;
}

function countByNo(badges) {
  const map = new Map();
  for (const b of badges) map.set(b.no, (map.get(b.no) || 0) + 1);
  return map;
}

// The <iframe srcdoc="..."> payload of combined.html, decoded back to a document.
// srcdoc escapes only & and ", so the first bare " ends the value.
function srcdocOf(html) {
  const m = /srcdoc="([\s\S]*?)"/.exec(html);
  if (!m) return null;
  return m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&');
}

function withoutSrcdoc(html) {
  return String(html).replace(/srcdoc="[\s\S]*?"/, 'srcdoc=""');
}

// ------------------------------------------------- independent Markdown reader
//
// Content units of a spec MD, deliberately not md-render.js's parser. A unit is any
// piece of authored text a reader would notice going missing: a heading, a table cell,
// a list item, a blockquote line, a paragraph line.

// Strips inline markup the same way md-render.js's own inline() does: a backtick span
// is taken whole and literally, so a ** inside one (e.g. `ab***xyz`) is never mistaken
// for a bold marker. Chained regex replaces got this wrong — stripping backticks first
// and then blanket-stripping ** afterward ate one of the three asterisks in `ab***xyz`,
// producing an expected string spec.html could never match.
function stripInlineMarkup(text) {
  const s = String(text);
  let out = '';
  let i = 0;
  while (i < s.length) {
    if (s[i] === '`') {
      const end = s.indexOf('`', i + 1);
      if (end === -1) {
        out += s[i];
        i++;
        continue;
      }
      out += s.slice(i + 1, end);
      i = end + 1;
      continue;
    }
    if (s[i] === '*' && s[i + 1] === '*') {
      i += 2;
      continue;
    }
    out += s[i];
    i++;
  }
  return out;
}

function mdContentUnits(md) {
  const lines = String(md).replace(/\r\n?/g, '\n').split('\n');
  const units = [];
  const push = (text, lineNo, kind) => {
    const t = stripInlineMarkup(text).trim();
    if (t) units.push({ text: t, lineNo, kind });
  };

  lines.forEach((raw, i) => {
    const lineNo = i + 1;
    const line = raw.trim();
    if (!line) return;
    if (/^-{3,}$/.test(line)) return;

    let m;
    if ((m = /^#{1,6}\s+(.*\S)\s*$/.exec(line))) return push(m[1], lineNo, 'heading');

    if (/^\|/.test(line)) {
      const cells = line.replace(/^\|/, '').replace(/\|$/, '').split('|');
      if (cells.every((c) => /^\s*:?-{1,}:?\s*$/.test(c))) return; // separator row
      cells.forEach((c) => push(c, lineNo, 'table cell'));
      return;
    }

    if ((m = /^>\s?(.*)$/.exec(line))) return push(m[1], lineNo, 'blockquote');
    if ((m = /^(?:[-*]|\d+\.)\s+(.*\S)\s*$/.exec(line))) return push(m[1], lineNo, 'list item');
    return push(line, lineNo, 'paragraph');
  });

  return units;
}

// Headings of a rendered document, in order, with their offsets.
function htmlHeadings(html) {
  const out = [];
  const re = /<h(\d)[^>]*>([\s\S]*?)<\/h\1>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    out.push({
      level: Number(m[1]),
      title: decodeEntities(m[2].replace(/<[^>]*>/g, '')).trim(),
      start: m.index,
      end: m.index + m[0].length,
    });
  }
  return out;
}

// Region of one heading's section: from the heading to the next heading of the same or
// shallower level, or end of document.
function sectionRegion(headings, index, htmlLength) {
  const h = headings[index];
  for (let i = index + 1; i < headings.length; i++) {
    if (headings[i].level <= h.level) return { from: h.start, to: headings[i].start };
  }
  return { from: h.start, to: htmlLength };
}

// --------------------------------------------------------------------- checks

function checkContinuity(mapping) {
  const nos = (mapping.entries || []).map((e) => e.no);
  const dupes = nos.filter((n, i) => nos.indexOf(n) !== i);
  const sorted = [...new Set(nos)].sort((a, b) => a - b);
  const gaps = [];
  for (let i = 0; i < sorted.length; i++) if (sorted[i] !== i + 1) gaps.push(sorted[i]);
  if (!nos.length) return fail('continuity', 'mapping.json has no entries');
  if (dupes.length) return fail('continuity', `duplicate entry numbers: ${[...new Set(dupes)].join(', ')}`);
  if (gaps.length) {
    return fail('continuity', `numbers must run 1..${sorted.length}; first out of sequence: ${gaps[0]}`);
  }
  pass('continuity', `${sorted.length} numbers, 1..${sorted.length}`);
}

function checkMintedNumbers(mapping, docs) {
  const approved = new Set((mapping.entries || []).map((e) => e.no));
  const bad = [];
  for (const [name, html] of Object.entries(docs)) {
    for (const b of badgeNumbers(html)) {
      if (!approved.has(b.no)) bad.push(`${name}:[${b.no}]`);
    }
  }
  if (bad.length) return fail('minted-numbers', `badges outside mapping.json: ${[...new Set(bad)].join(', ')}`);
  pass('minted-numbers', 'every badge number is an approved entry');
}

function expectedCounts(mapping) {
  const spec = new Map();
  const wf = new Map();
  for (const e of mapping.entries || []) {
    const side = e.side || 'both';
    if (side !== 'wireframe-only' && e.specField) spec.set(e.no, (spec.get(e.no) || 0) + 1);
    if (side !== 'spec-only') {
      const anchors =
        e.wireframeAnchors ||
        (e.wireframeAnchor ? [e.wireframeAnchor] : null) ||
        (e.wireframeComponent ? [e.wireframeComponent] : []);
      wf.set(e.no, (wf.get(e.no) || 0) + anchors.length);
    }
  }
  for (const ref of mapping.narrativeRefs || []) {
    const n = Array.isArray(ref.anchors) ? ref.anchors.length : 0;
    spec.set(ref.no, (spec.get(ref.no) || 0) + n);
  }
  return { spec, wf };
}

function checkBadgeCounts(mapping, specHtml, wfHtml) {
  const exp = expectedCounts(mapping);
  const got = { spec: countByNo(badgeNumbers(specHtml)), wf: countByNo(badgeNumbers(wfHtml)) };
  const problems = [];
  for (const [side, key] of [['spec.html', 'spec'], ['wireframe.html', 'wf']]) {
    const expected = exp[key];
    const actual = got[key];
    for (const [no, n] of expected) {
      const a = actual.get(no) || 0;
      if (a !== n) problems.push(`${side} [${no}]: expected ${n}, found ${a}`);
    }
    for (const [no] of actual) {
      if (!expected.has(no)) problems.push(`${side} [${no}]: found but not expected on this side`);
    }
  }
  if (problems.length) return fail('badge-counts', problems.slice(0, 6).join('; ') + (problems.length > 6 ? ` (+${problems.length - 6} more)` : ''));
  pass('badge-counts', `spec ${[...exp.spec.values()].reduce((a, b) => a + b, 0)} badges, wireframe ${[...exp.wf.values()].reduce((a, b) => a + b, 0)} badges`);
}

function checkCrossFileParity(mapping, specHtml, wfHtml) {
  const inSpec = new Set(badgeNumbers(specHtml).map((b) => b.no));
  const inWf = new Set(badgeNumbers(wfHtml).map((b) => b.no));
  const problems = [];
  for (const e of mapping.entries || []) {
    const side = e.side || 'both';
    if (side === 'both') {
      if (!inSpec.has(e.no)) problems.push(`[${e.no}] missing from spec.html`);
      if (!inWf.has(e.no)) problems.push(`[${e.no}] missing from wireframe.html`);
    } else if (side === 'spec-only') {
      if (inWf.has(e.no)) problems.push(`[${e.no}] is spec-only but appears in wireframe.html`);
    } else if (side === 'wireframe-only') {
      if (inSpec.has(e.no)) problems.push(`[${e.no}] is wireframe-only but appears in spec.html`);
    }
  }
  if (problems.length) return fail('cross-file-parity', problems.slice(0, 6).join('; '));
  const both = (mapping.entries || []).filter((e) => (e.side || 'both') === 'both').length;
  pass('cross-file-parity', `${both} two-sided numbers present in both documents`);
}

function checkWireframeIntegrity(wfHtml, wireframeSource) {
  const stripped = wfHtml.replace(SENTINEL_RE, '').replace(new RegExp(BADGE_RE.source, 'g'), '');
  if (stripped === wireframeSource) {
    return pass('wireframe-integrity', 'source reconstructs byte-for-byte from the delivered file');
  }
  // Name the first divergence so the finding is actionable.
  let i = 0;
  while (i < Math.min(stripped.length, wireframeSource.length) && stripped[i] === wireframeSource[i]) i++;
  const line = wireframeSource.slice(0, i).split('\n').length;
  fail(
    'wireframe-integrity',
    `reconstruction differs from the Wireframe source at source line ${line} ` +
      `(delivered ${stripped.length} bytes vs source ${wireframeSource.length}); ` +
      `got "${stripped.slice(i, i + 40).replace(/\n/g, '\\n')}" where source has "${wireframeSource.slice(i, i + 40).replace(/\n/g, '\\n')}"`
  );
}

function checkMdContentFidelity(specMd, specHtml) {
  const hay = cmp(visibleText(specHtml.replace(new RegExp(BADGE_RE.source, 'g'), '')));
  const missing = [];
  for (const u of mdContentUnits(specMd)) {
    if (!hay.includes(cmp(u.text))) missing.push(`line ${u.lineNo} (${u.kind}): "${u.text.slice(0, 40)}"`);
  }
  if (missing.length) {
    return fail(
      'md-content-fidelity',
      `${missing.length} content unit(s) absent from spec.html — ${missing.slice(0, 3).join('; ')}`
    );
  }
  pass('md-content-fidelity', `${mdContentUnits(specMd).length} content units all present verbatim`);
}

function checkSpecFidelity(specMd, specHtml) {
  const mdHeadings = String(specMd).split('\n').filter((l) => /^#{1,6}\s+\S/.test(l.trim())).length;
  const mdRows = String(specMd)
    .split('\n')
    .filter((l) => /^\s*\|/.test(l) && !/^\s*\|[\s:|-]*\|?\s*$/.test(l)).length;
  const htmlHeadingCount = htmlHeadings(specHtml).length;
  const htmlRows = (specHtml.match(/<tr>/g) || []).length;
  const diffs = [];
  if (mdHeadings !== htmlHeadingCount) diffs.push(`headings MD ${mdHeadings} vs HTML ${htmlHeadingCount}`);
  if (mdRows !== htmlRows) diffs.push(`table rows MD ${mdRows} vs HTML ${htmlRows}`);
  if (diffs.length) return warn('spec-fidelity', diffs.join('; '));
  pass('spec-fidelity', `${htmlHeadingCount} headings, ${htmlRows} table rows`);
}

function checkCellNesting(specHtml) {
  const bad = [];
  for (const b of badgeNumbers(specHtml)) {
    const before = specHtml.slice(0, b.at);
    const marks = [...before.matchAll(/<t[dhr]\b[^>]*>|<\/t[dhr]>/g)];
    if (!marks.length) continue;
    const last = marks[marks.length - 1][0];
    if (/^<tr\b/.test(last) || /^<\/t[dh]>$/.test(last)) bad.push(b.no);
  }
  if (bad.length) return fail('cell-nesting', `badge(s) inside a table row but outside any cell: ${[...new Set(bad)].join(', ')}`);
  pass('cell-nesting', 'every in-table badge sits inside a <td>/<th>');
}

// Elements whose HTML content model is text-only: a browser does not render a child
// element placed inside one of these as an element at all — it gets silently dropped,
// foster-parented elsewhere, or shown as literal text, differently across browsers, but
// never as the intended visible badge. anchorOffsets() in badge-inject.js only excludes
// <script>/<style> content from matching, so a wireframe anchor whose text happens to sit
// inside one of these can still be "found" and badged mechanically — the badge lands in
// the source, but never renders where a reader can see it. Found via a real case: a
// <select><option> value used as a wireframeAnchor.
const TEXT_ONLY_ELEMENTS = ['option', 'title', 'textarea'];

function checkBadgeRenderable(wfHtml) {
  const tagRe = new RegExp(`<(/?)(${TEXT_ONLY_ELEMENTS.join('|')})\\b[^>]*>`, 'gi');
  const bad = [];
  for (const b of badgeNumbers(wfHtml)) {
    const before = wfHtml.slice(0, b.at);
    const marks = [...before.matchAll(tagRe)];
    if (!marks.length) continue;
    const last = marks[marks.length - 1];
    if (!last[1]) bad.push(`${b.no} (inside <${last[2].toLowerCase()}>)`);
  }
  if (bad.length) {
    return fail(
      'badge-renderable',
      `badge(s) land inside a text-only element, where a <span> is not rendered as an ` +
        `element by the browser: ${[...new Set(bad)].join(', ')} — re-anchor on nearby ` +
        `visible text instead (e.g. the control's own <label>)`
    );
  }
  pass('badge-renderable', `no badge lands inside <${TEXT_ONLY_ELEMENTS.join('>/<')}>`);
}

function checkExcludedZones(mapping, specHtml) {
  const headings = htmlHeadings(specHtml);
  const t = mapping.templateHeadings || {};
  const purposeTitles = [t.purpose, 'Purpose', '目的', '背景與目標'].filter(Boolean);
  const excludedTitles = [t.metadata, t.changeLog, 'Metadata', 'Change Log', '文件資訊', '修訂紀錄'].filter(Boolean);

  const badges = badgeNumbers(specHtml);
  const problems = [];

  const purposeAt = headings.find((h) => purposeTitles.includes(h.title));
  if (!purposeAt) {
    problems.push(`no opening-section heading found (looked for: ${purposeTitles.join(' / ')})`);
  } else {
    const early = badges.filter((b) => b.at < purposeAt.start).map((b) => b.no);
    if (early.length) problems.push(`badge(s) before "${purposeAt.title}": ${[...new Set(early)].join(', ')}`);
  }

  headings.forEach((h, i) => {
    if (!excludedTitles.includes(h.title)) return;
    const { from, to } = sectionRegion(headings, i, specHtml.length);
    const inside = badges.filter((b) => b.at >= from && b.at < to).map((b) => b.no);
    if (inside.length) problems.push(`badge(s) inside "${h.title}": ${[...new Set(inside)].join(', ')}`);
  });

  if (problems.length) {
    const level = purposeAt ? fail : warn;
    return level('excluded-zones', problems.join('; '));
  }
  pass('excluded-zones', 'no badges before the opening section or inside Metadata / Change Log');
}

function checkStylePresence(docs) {
  const missing = [];
  for (const [name, html] of Object.entries(docs)) {
    if (!/\.ref-num\s*\{/.test(html)) missing.push(`${name}: .ref-num`);
    if (!/\.export-meta\s*\{/.test(html)) missing.push(`${name}: .export-meta`);
  }
  if (missing.length) return fail('style-presence', `undefined style(s): ${missing.join(', ')}`);
  pass('style-presence', 'all three files define .ref-num and .export-meta');
}

function checkStyleSingleDefinition(combinedHtml) {
  const outer = withoutSrcdoc(combinedHtml);
  const n = (outer.match(/\.ref-num\s*\{/g) || []).length;
  if (n !== 1) return fail('style-single-definition', `combined.html defines .ref-num ${n} time(s) outside the Wireframe frame; expected exactly 1`);
  pass('style-single-definition', 'combined.html declares .ref-num once');
}

function checkExportMeta(mapping, docs) {
  const wanted = [
    ['功能名稱', mapping.featureName],
    ['匯出日期', mapping.exportDate],
    ['Spec 版本', mapping.specVersion],
    ['Spec 狀態', mapping.specStatus],
  ];
  const problems = [];
  for (const [name, html] of Object.entries(docs)) {
    const m = /<div class="export-meta">([\s\S]*?)<\/div>/.exec(html);
    if (!m) {
      problems.push(`${name}: no export-meta header`);
      continue;
    }
    const text = decodeEntities(m[1].replace(/<[^>]*>/g, ''));
    for (const [label, value] of wanted) {
      if (!text.includes(label)) problems.push(`${name}: missing ${label}`);
      else if (value == null && !text.includes('[TO CONFIRM]')) problems.push(`${name}: ${label} unset and not marked [TO CONFIRM]`);
      else if (value != null && !text.includes(String(value))) problems.push(`${name}: ${label} does not read "${value}"`);
    }
  }
  if (problems.length) return fail('export-meta', problems.slice(0, 5).join('; '));
  pass('export-meta', '功能名稱 / 匯出日期 / Spec 版本 / Spec 狀態 present in all three files');
}

function checkTabMarkup(combinedHtml) {
  const outer = withoutSrcdoc(combinedHtml);
  const problems = [];
  const radios = [...outer.matchAll(/<input\b[^>]*type="radio"[^>]*>/g)].map((m) => m[0]);
  const ids = radios.map((r) => (/(?:^|\s)id="([^"]+)"/.exec(r) || [])[1]).filter(Boolean);
  const names = new Set(radios.map((r) => (/(?:^|\s)name="([^"]+)"/.exec(r) || [])[1]).filter(Boolean));

  if (radios.length !== 2) problems.push(`expected 2 tab radios, found ${radios.length}`);
  if (names.size !== 1) problems.push(`tab radios must share one name attribute (found ${names.size} distinct)`);

  const checked = radios.filter((r) => /\bchecked\b/.test(r));
  if (checked.length !== 1) problems.push(`exactly one radio must be checked by default (found ${checked.length})`);
  else if (!/id="tab-spec"/.test(checked[0])) problems.push('the spec tab must be the one checked by default');

  for (const id of ids) {
    if (!new RegExp(`<label[^>]*for="${id}"`).test(outer)) problems.push(`no <label for="${id}">`);
    const panelId = id.replace(/^tab-/, 'panel-');
    if (!new RegExp(`id="${panelId}"`).test(outer)) problems.push(`no panel with id="${panelId}"`);
    if (!new RegExp(`#${id}:checked\\s*~\\s*#${panelId}\\s*\\{`).test(outer)) {
      problems.push(`no CSS rule "#${id}:checked ~ #${panelId}"`);
    }
  }

  const labels = [...outer.matchAll(/<label[^>]*for="([^"]+)"/g)].map((m) => m[1]);
  for (const f of labels) {
    if (!ids.includes(f)) problems.push(`<label for="${f}"> points at no tab radio`);
  }
  if (/<script\b/.test(outer)) problems.push('combined.html contains a <script> — tab switching must be pure CSS');

  if (problems.length) return fail('tab-markup', problems.slice(0, 5).join('; '));
  pass('tab-markup', 'two radios, matching labels, matching panels, pure-CSS switching, spec open by default');
}

function checkCombinedComposition(combinedHtml, specHtml, wfHtml) {
  const problems = [];

  // Both regions are anchored on both sides rather than matched greedily to "the last
  // </div>": the spec body itself contains no <div>, but anchoring is what keeps a
  // wrapper's own closing tag out of one side of the comparison and not the other.
  const specBody = (/<div class="export-body">([\s\S]*)<\/div>\s*<\/body>/.exec(specHtml) || [])[1];
  const panelBody = (/<div class="tab-panel" id="panel-spec">\s*<div class="export-body">([\s\S]*?)<\/div>\s*<\/div>\s*<div class="tab-panel" id="panel-wireframe">/.exec(
    combinedHtml
  ) || [])[1];

  if (specBody == null) problems.push('spec.html has no .export-body region');
  else if (panelBody == null) problems.push('combined.html has no spec panel body');
  else if (normalizeMarkup(panelBody) !== normalizeMarkup(specBody)) {
    problems.push(firstDiff('spec panel vs spec.html', normalizeMarkup(panelBody), normalizeMarkup(specBody)));
  }

  const frame = srcdocOf(combinedHtml);
  if (frame == null) problems.push('combined.html has no <iframe srcdoc> for the Wireframe');
  else if (normalizeMarkup(frame) !== normalizeMarkup(wfHtml)) {
    problems.push(firstDiff('wireframe frame vs wireframe.html', normalizeMarkup(frame), normalizeMarkup(wfHtml)));
  }

  if (problems.length) return fail('combined-composition', problems.join('; '));
  pass('combined-composition', 'both panels match their standalone file after indentation normalization');
}

// Normalization absorbs indentation only. Whitespace BETWEEN tags collapses to nothing;
// whitespace inside a text node is left exactly as authored, so "10 萬" and "10  萬"
// still differ. Anything looser would let a real content change pass as a formatting one.
function normalizeMarkup(html) {
  return String(html).replace(/>\s+</g, '><').trim();
}

function firstDiff(what, a, b) {
  let i = 0;
  while (i < Math.min(a.length, b.length) && a[i] === b[i]) i++;
  return `${what} diverge at offset ${i}: "${a.slice(i, i + 30)}" vs "${b.slice(i, i + 30)}"`;
}

function checkSourceFreshness(mapping, dir, docs) {
  const sources = mapping.sources || {};
  const problems = [];
  const live = {};
  for (const key of ['specMd', 'wireframeHtml']) {
    const p = sources[key];
    if (!p) {
      problems.push(`sources.${key} is not recorded`);
      continue;
    }
    const abs = path.isAbsolute(p) ? p : path.resolve(dir, p);
    if (!fs.existsSync(abs)) {
      problems.push(`sources.${key} not found at ${abs} (paths resolve against the export folder)`);
      continue;
    }
    live[key] = sha256(fs.readFileSync(abs));
  }
  for (const [name, html] of Object.entries(docs)) {
    const m = /<!-- ref-export-source-hashes specMd=([0-9a-f]+) wireframeHtml=([0-9a-f]+) -->/.exec(html);
    if (!m) {
      problems.push(`${name}: no source-hash comment`);
      continue;
    }
    if (live.specMd && m[1] !== live.specMd) problems.push(`${name}: spec MD changed since the build`);
    if (live.wireframeHtml && m[2] !== live.wireframeHtml) problems.push(`${name}: Wireframe changed since the build`);
  }
  if (problems.length) return warn('source-freshness', [...new Set(problems)].join('; ') + ' — rebuild before delivering');
  pass('source-freshness', 'delivered files were built from the current sources');
}

// Self-contained vertical-table reader for this team's Metadata convention (欄位/內容
// header, one field per row below it) — independent of md-render.js's readMetadata() by
// the same rule as everything else in this file. Only needs Version and Status, so it
// does not attempt the horizontal-table fallback md-render.js supports; a spec using that
// orientation just reads as "no metadata found" here, same as a missing table.
function readSpecMetadataVersion(specMd, headingTitle) {
  const title = headingTitle || 'Metadata';
  const lines = String(specMd)
    .replace(/\r\n?/g, '\n')
    .split('\n');
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const at = lines.findIndex((l) => new RegExp(`^#{1,6}\\s+${escaped}\\s*$`).test(l.trim()));
  if (at === -1) return null;
  const out = {};
  for (let i = at + 1; i < lines.length; i++) {
    if (/^#{1,6}\s+\S/.test(lines[i])) break;
    if (!/^\s*\|/.test(lines[i])) continue;
    const cells = lines[i]
      .trim()
      .replace(/^\||\|$/g, '')
      .split('|')
      .map((c) => c.trim());
    if (cells.length === 2 && !/^:?-+:?$/.test(cells[0])) out[cells[0]] = cells[1];
  }
  return Object.keys(out).length ? out : null;
}

// mapping.specVersion / specStatus are write-once caches (build-export.js only sets them
// when absent — see its own comment) — editing the spec MD's own Version/Status afterward
// does not refresh them. A stale cache still passes export-meta (which only checks the
// delivered files agree with mapping.json, not that mapping.json agrees with the spec MD),
// so this is the only check that can catch it. Found via a real case: winnerboard-v2.md's
// Version moved from v1.10 to v1.26 after a Change Log rewrite, and the delivered files
// kept reporting v1.10 until mapping.json's cached fields were cleared by hand and rebuilt.
function checkSpecVersionFreshness(mapping, specMd) {
  const meta = readSpecMetadataVersion(specMd, (mapping.templateHeadings || {}).metadata);
  if (!meta) return; // no Metadata table found here — Step 1's own template check owns that gap
  const problems = [];
  if (meta.Version && mapping.specVersion && meta.Version !== mapping.specVersion) {
    problems.push(`specVersion: mapping.json caches "${mapping.specVersion}", spec MD now says "${meta.Version}"`);
  }
  if (meta.Status && mapping.specStatus && meta.Status !== mapping.specStatus) {
    problems.push(`specStatus: mapping.json caches "${mapping.specStatus}", spec MD now says "${meta.Status}"`);
  }
  if (problems.length) {
    return warn(
      'spec-version-freshness',
      `${problems.join('; ')} — clear the stale field(s) from mapping.json (rebuilding alone will not refresh them) and rebuild`
    );
  }
  pass('spec-version-freshness', 'mapping.json specVersion/specStatus (when cached) match the spec MD Metadata table');
}

function checkComponentNameGenericness(mapping) {
  const generic = ['按鈕', '文字', '文字顯示', '圖示', '欄位', '輸入框', '下拉選單', '連結', '標籤', 'button', 'text', 'icon', 'field', 'label'];
  const hits = [];
  for (const e of mapping.entries || []) {
    const name = (e.wireframeComponent || '').trim();
    if (!name) continue;
    const cat = (e.category || '').trim();
    if (cat && name === cat) hits.push(`[${e.no}] "${name}" restates its own category`);
    else if (generic.includes(name)) hits.push(`[${e.no}] "${name}" is a category word, not a component label`);
  }
  if (hits.length) return warn('component-name-genericness', hits.slice(0, 5).join('; '));
  pass('component-name-genericness', 'every wireframeComponent names a specific element');
}

// Deferrals must reach the delivery message. They live in mapping.json rather than only in
// the conversation, and this is what stops "we agreed to come back to it" from evaporating
// between the run and the handover.
function checkToConfirmRecorded(mapping) {
  const items = [];
  for (const e of mapping.entries || []) {
    if (e.toConfirm) items.push(`[${e.no}] ${e.specField || e.wireframeComponent || '(unnamed)'}`);
  }
  // Deferrals and open questions are surfaced together but stay labelled apart: a
  // [TO CONFIRM] means a human weighed the item and chose to leave it open, an open question
  // means nobody has answered yet. Collapsing them would let the second masquerade as the
  // first in a delivered document.
  const malformed = [];
  for (const [key, label] of [['toConfirmNotes', 'deferred'], ['openQuestions', 'open question']]) {
    const list = mapping[key] || [];
    if (!Array.isArray(list)) {
      return fail('to-confirm-recorded', `${key} must be an array of { item, question, … }`);
    }
    for (const n of list) {
      if (!n || !n.item || !n.question) malformed.push(key);
      else items.push(`${label}: ${n.item}`);
    }
  }
  if (malformed.length) {
    return fail(
      'to-confirm-recorded',
      `${malformed.length} entr(ies) in ${[...new Set(malformed)].join(' / ')} missing "item" or "question" — the question as asked is what makes the record auditable`
    );
  }
  if (items.length) {
    return warn(
      'to-confirm-recorded',
      `${items.length} item(s) must appear in the delivery message: ${items.slice(0, 4).join('; ')}` +
        (items.length > 4 ? ` (+${items.length - 4} more)` : '')
    );
  }
  pass('to-confirm-recorded', 'no deferred items and no open questions');
}

function checkStandaloneAssets(docs) {
  const hits = [];
  const re = /(?:src|href)="((?:https?:)?\/\/[^"]+)"/g;
  for (const [name, html] of Object.entries(docs)) {
    let m;
    const r = new RegExp(re.source, 'g');
    while ((m = r.exec(html)) !== null) hits.push(`${name}: ${m[1].slice(0, 60)}`);
  }
  if (hits.length) {
    return warn(
      'standalone-assets',
      `${hits.length} external reference(s) — the file will not render fully offline: ${[...new Set(hits)].slice(0, 3).join('; ')}`
    );
  }
  pass('standalone-assets', 'no external references; all three files open standalone');
}

// ----------------------------------------------------------------- exceptions

function applyExceptions(mapping) {
  const list = mapping.approvedExceptions || [];
  if (!Array.isArray(list)) {
    record('approved-exceptions', 'FAIL', 'approvedExceptions must be an array of { check, target, approvedOn, approvedBy, reason }');
    return;
  }
  const notes = [];
  for (const ex of list) {
    if (!ex || !ex.check) {
      notes.push('an entry has no "check"');
      continue;
    }
    if (NON_WAIVABLE.has(ex.check)) {
      record(
        'approved-exceptions',
        'FAIL',
        `${ex.check} is not waivable by anyone — remove the exception and fix the finding`
      );
      continue;
    }
    for (const field of ['approvedOn', 'approvedBy', 'reason']) {
      if (!ex[field]) notes.push(`${ex.check}: missing "${field}"`);
    }
    const hit = results.find((r) => r.name === ex.check && r.status === 'WARN');
    if (!hit) {
      notes.push(`${ex.check}: approved but did not fire this run (stale — remove it)`);
      continue;
    }
    hit.status = 'WAIVED';
    hit.evidence = `${hit.evidence} — waived ${ex.approvedOn || '?'} by ${ex.approvedBy || '?'}: ${ex.reason || '?'}`;
  }
  if (notes.length) record('approved-exceptions', 'WARN', notes.join('; '));
}

// ----------------------------------------------------------------------- main

function main() {
  const exportDir = process.argv[2];
  if (!exportDir) die('usage: node scripts/verify.js <export-folder>');
  const dir = path.resolve(exportDir);
  const mappingPath = path.join(dir, 'mapping.json');
  if (!fs.existsSync(mappingPath)) die(`mapping.json not found in ${dir}`);

  let mapping;
  try {
    mapping = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
  } catch (e) {
    die(`mapping.json is not valid JSON: ${e.message}`);
  }

  const files = mapping.files || {};
  for (const key of ['spec', 'wireframe', 'combined']) {
    if (!files[key]) die(`mapping.json files.${key} is not set — run build-export.js first`);
    if (!fs.existsSync(path.join(dir, files[key]))) die(`delivered file missing: ${files[key]}`);
  }

  const specHtml = fs.readFileSync(path.join(dir, files.spec), 'utf8');
  const wfHtml = fs.readFileSync(path.join(dir, files.wireframe), 'utf8');
  const combinedHtml = fs.readFileSync(path.join(dir, files.combined), 'utf8');
  const docs = { 'spec.html': specHtml, 'wireframe.html': wfHtml, 'combined.html': combinedHtml };

  const sources = mapping.sources || {};
  const specMdPath = sources.specMd
    ? path.isAbsolute(sources.specMd)
      ? sources.specMd
      : path.resolve(dir, sources.specMd)
    : null;
  const wfSourcePath = sources.wireframeHtml
    ? path.isAbsolute(sources.wireframeHtml)
      ? sources.wireframeHtml
      : path.resolve(dir, sources.wireframeHtml)
    : null;

  checkContinuity(mapping);
  checkMintedNumbers(mapping, docs);
  checkBadgeCounts(mapping, specHtml, wfHtml);
  checkCrossFileParity(mapping, specHtml, wfHtml);

  if (wfSourcePath && fs.existsSync(wfSourcePath)) {
    checkWireframeIntegrity(wfHtml, fs.readFileSync(wfSourcePath, 'utf8'));
  } else {
    fail('wireframe-integrity', 'Wireframe source unreadable — this check is not waivable and cannot be skipped');
  }

  if (specMdPath && fs.existsSync(specMdPath)) {
    const specMd = fs.readFileSync(specMdPath, 'utf8');
    checkMdContentFidelity(specMd, specHtml);
    checkSpecFidelity(specMd, specHtml);
    checkSpecVersionFreshness(mapping, specMd);
  } else {
    fail('md-content-fidelity', 'spec MD unreadable — this check is not waivable and cannot be skipped');
  }

  checkCellNesting(specHtml);
  checkBadgeRenderable(wfHtml);
  checkExcludedZones(mapping, specHtml);
  checkStylePresence(docs);
  checkStyleSingleDefinition(combinedHtml);
  checkExportMeta(mapping, docs);
  checkTabMarkup(combinedHtml);
  checkCombinedComposition(combinedHtml, specHtml, wfHtml);
  checkSourceFreshness(mapping, dir, docs);
  checkComponentNameGenericness(mapping);
  checkToConfirmRecorded(mapping);
  checkStandaloneAssets(docs);

  applyExceptions(mapping);

  const width = Math.max(...results.map((r) => r.name.length));
  const lines = results.map((r) => `${r.status.padEnd(6)} ${r.name.padEnd(width)}  ${r.evidence}`);
  const fails = results.filter((r) => r.status === 'FAIL').length;
  const warns = results.filter((r) => r.status === 'WARN').length;
  const waived = results.filter((r) => r.status === 'WAIVED').length;

  process.stdout.write(
    lines.join('\n') +
      `\n\n${results.length} checks: ${results.length - fails - warns - waived} PASS, ${warns} WARN, ${waived} WAIVED, ${fails} FAIL\n` +
      (fails ? 'Every FAIL must be fixed and this script re-run before delivery.\n' : '') +
      (warns ? 'Every WARN must be fixed, or explained in the delivery message.\n' : '')
  );

  process.exit(fails ? 1 : 0);
}

main();

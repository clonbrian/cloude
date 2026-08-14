'use strict';

// Deterministic reference-badge injection into BOTH exported documents. Pure functions,
// no I/O.
//
// This skill's whole promise is that number N labels the same component in spec.html and
// in wireframe.html. That promise only holds if both sides are placed from one machine-
// readable source (mapping.json) rather than by hand on two separate passes — a hand pass
// over each document is exactly how [7] ends up on the bet-limit field in one file and on
// the payout-cap field in the other, with nothing to catch it.
//
// Three anchor kinds, matching the three ways a number appears:
//
//   definition — spec side, the number labels a field. Anchor: the Item Definition table
//     row whose FIRST cell equals the entry's specField, inside the page's own
//     itemDefSection. Derived from `entries`; nothing extra to author.
//   narrative  — spec side, the number is re-applied to a mention in prose, a rule cell,
//     an AC line. Anchor text is NOT the field name (spec field 「"CLOSED" tag」 is
//     mentioned in prose as 「CLOSED 標籤」), so it cannot be derived and is authored in
//     mapping.json `narrativeRefs`. Empty by default in this skill.
//   wireframe  — wireframe side, the number labels the component's own on-screen text.
//     Authored per entry as `wireframeAnchor` / `wireframeAnchors`.
//
// The badge carries no title, no data-*, no class beyond `ref-num`, and is byte-identical
// in all three delivered files. That is what lets verify.js compare the standalone files
// against combined.html, and what lets it strip badges back out of wireframe.html to
// prove the original markup survived untouched.

const { findHeading, sectionEnd } = require('./sections');

class BadgeInjectError extends Error {}

const BADGE = (no) => `<span class="ref-num">${no}</span>`;

// The exact pattern verify.js strips to reconstruct the wireframe source. Any change
// to BADGE() must be mirrored in verify.js's BADGE_RE and in references/verify-checks.md.
const BADGE_RE = /<span class="ref-num">\d+<\/span>/g;

function decode(s) {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

function stripTags(s) {
  return decode(s.replace(/<[^>]*>/g, ''));
}

// Range of one section's HTML, scoped to its chapter. `section` may be omitted to
// target a whole chapter.
function sectionRange(html, chapter, section) {
  const title = section || chapter;
  const h = findHeading(html, title, section ? chapter : null);
  if (!h) {
    throw new BadgeInjectError(`section not found: ${chapter ? chapter + ' > ' : ''}${title}`);
  }
  return { from: h.start, to: sectionEnd(html, h.contentAfter, h.level) };
}

// Text-node positions inside a range, as [{ start, raw }]. Content of <script> and
// <style> is skipped entirely: a label that exists only inside a JS string is not text
// the reader sees, and injecting a span into a script body breaks the page silently.
function textNodes(html, from, to) {
  const out = [];
  const re = /<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>|<[^>]*>/gi;
  re.lastIndex = from;
  let cursor = from;
  let m;
  while ((m = re.exec(html)) !== null && m.index < to) {
    if (m.index > cursor) out.push({ start: cursor, raw: html.slice(cursor, Math.min(m.index, to)) });
    cursor = m.index + m[0].length;
  }
  if (cursor < to) out.push({ start: cursor, raw: html.slice(cursor, to) });
  return out.filter((n) => n.raw.length);
}

// Map a decoded-text index back to a raw HTML offset by re-encoding the prefix.
function rawOffset(raw, decodedIndex) {
  let r = 0;
  let d = 0;
  while (d < decodedIndex) {
    const ent = /^&(lt|gt|amp|quot|#39);/.exec(raw.slice(r));
    r += ent ? ent[0].length : 1;
    d += 1;
  }
  return r;
}

// Every raw offset at which `anchor` occurs in the visible text of a range.
function anchorOffsets(html, from, to, anchor) {
  const hits = [];
  for (const node of textNodes(html, from, to)) {
    const decoded = decode(node.raw);
    let at = 0;
    for (;;) {
      const hit = decoded.indexOf(anchor, at);
      if (hit === -1) break;
      hits.push(node.start + rawOffset(node.raw, hit));
      at = hit + 1;
    }
  }
  return hits;
}

// Raw offset of the nth (1-based) occurrence, or -1.
function findAnchorOffset(html, from, to, anchor, nth) {
  const hits = anchorOffsets(html, from, to, anchor);
  return hits.length >= nth ? hits[nth - 1] : -1;
}

// Content start of the first cell of the row whose first cell reads exactly `field`.
function findDefinitionCell(html, from, to, field) {
  const rowRe = /<tr>([\s\S]*?)<\/tr>/g;
  rowRe.lastIndex = from;
  let m;
  const hits = [];
  while ((m = rowRe.exec(html)) !== null && m.index < to) {
    const rowStart = m.index + '<tr>'.length;
    const cellRe = /<(td|th)(\s[^>]*)?>([\s\S]*?)<\/\1>/g;
    const cm = cellRe.exec(m[1]);
    if (!cm || cm[1] !== 'td') continue;
    if (stripTags(cm[3]).trim() !== field) continue;
    hits.push(rowStart + cm.index + cm[0].indexOf('>') + 1);
  }
  if (hits.length === 0) return -1;
  if (hits.length > 1) {
    throw new BadgeInjectError(
      `ambiguous definition anchor: "${field}" matches ${hits.length} rows in the same section`
    );
  }
  return hits[0];
}

// Normalize an entry's wireframe anchor authoring into an array of { text, nth }.
// Absent authoring falls back to the component's own name, which is the common case.
function wireframeAnchorsOf(entry) {
  const raw =
    entry.wireframeAnchors ||
    (entry.wireframeAnchor ? [entry.wireframeAnchor] : null) ||
    (entry.wireframeComponent ? [{ text: entry.wireframeComponent }] : []);
  return raw.map((a) => (typeof a === 'string' ? { text: a } : a));
}

function hasSpecSide(e) {
  const side = e.side || 'both';
  return side !== 'wireframe-only' && !!e.specField;
}

function hasWireframeSide(e) {
  const side = e.side || 'both';
  return side !== 'spec-only';
}

// ---------------------------------------------------------------- spec side

function planSpecInsertions(html, mapping) {
  const plan = [];
  const pageByLabel = new Map((mapping.pages || []).map((p) => [p.label, p]));

  for (const e of mapping.entries || []) {
    if (!hasSpecSide(e)) continue;
    const page = pageByLabel.get(e.page);
    if (!page) throw new BadgeInjectError(`entry ${e.no}: page "${e.page}" is not in mapping.pages`);
    const ids = page.itemDefSection;
    if (!ids) {
      throw new BadgeInjectError(
        `page "${page.label}" has no itemDefSection — required to place definition badges`
      );
    }
    const { from, to } = sectionRange(html, ids.chapter, ids.section);
    const at = findDefinitionCell(html, from, to, e.specField);
    if (at === -1) {
      throw new BadgeInjectError(
        `entry ${e.no}: no row with first cell "${e.specField}" in ${ids.chapter} > ${ids.section}`
      );
    }
    plan.push({ at, no: e.no, kind: 'definition', label: `${e.no} @ ${ids.section}` });
  }

  for (const ref of mapping.narrativeRefs || []) {
    if (!Array.isArray(ref.anchors)) {
      throw new BadgeInjectError(`narrativeRefs entry for ${ref.no} has no "anchors" array`);
    }
    const { from, to } = sectionRange(html, ref.chapter, ref.section);
    for (const a of ref.anchors) {
      const nth = a.nth || 1;
      const at = findAnchorOffset(html, from, to, a.text, nth);
      if (at === -1) {
        throw new BadgeInjectError(
          `narrative anchor not found: ${ref.no} — occurrence ${nth} of "${a.text}" in ${ref.chapter || ''} > ${ref.section || ''}`
        );
      }
      plan.push({ at, no: ref.no, kind: 'narrative', label: `${ref.no} @ ${ref.section || ref.chapter}` });
    }
  }

  return plan;
}

// ----------------------------------------------------------- wireframe side

function planWireframeInsertions(html, mapping) {
  const plan = [];
  for (const e of mapping.entries || []) {
    if (!hasWireframeSide(e)) continue;
    const anchors = wireframeAnchorsOf(e);
    if (!anchors.length) {
      throw new BadgeInjectError(
        `entry ${e.no}: side is "${e.side || 'both'}" but no wireframeComponent and no wireframeAnchor`
      );
    }
    for (const a of anchors) {
      if (!a || !a.text) throw new BadgeInjectError(`entry ${e.no}: wireframe anchor has no "text"`);
      const hits = anchorOffsets(html, 0, html.length, a.text);
      if (hits.length === 0) {
        throw new BadgeInjectError(
          `entry ${e.no}: wireframe anchor "${a.text}" not found in the Wireframe's visible text. ` +
            `Text inside an attribute (a placeholder, a title, a value) and text that exists only ` +
            `inside <script> are both invisible to this search — see SKILL.md Step 1, ` +
            `"Wireframe injectability check"`
        );
      }
      if (hits.length > 1 && !a.nth) {
        throw new BadgeInjectError(
          `entry ${e.no}: wireframe anchor "${a.text}" matches ${hits.length} places — ` +
            `set "nth" (1-${hits.length}) to say which one, or use a longer anchor`
        );
      }
      const nth = a.nth || 1;
      if (nth > hits.length) {
        throw new BadgeInjectError(
          `entry ${e.no}: wireframe anchor "${a.text}" has ${hits.length} occurrence(s), nth=${nth} requested`
        );
      }
      plan.push({ at: hits[nth - 1], no: e.no, kind: 'wireframe', label: `${e.no} @ "${a.text}"` });
    }
  }
  return plan;
}

// ------------------------------------------------------------------ applying

// Apply back-to-front so earlier offsets stay valid. Ties resolve on number so the
// output is stable regardless of entry order in mapping.json.
function applyPlan(html, plan) {
  const sorted = plan.slice().sort((a, b) => b.at - a.at || b.no - a.no);
  let out = html;
  for (const p of sorted) out = out.slice(0, p.at) + BADGE(p.no) + out.slice(p.at);
  return out;
}

function injectSpec(html, mapping) {
  const plan = planSpecInsertions(html, mapping);
  return {
    html: applyPlan(html, plan),
    plan,
    counts: {
      definition: plan.filter((p) => p.kind === 'definition').length,
      narrative: plan.filter((p) => p.kind === 'narrative').length,
    },
  };
}

function injectWireframe(html, mapping) {
  const plan = planWireframeInsertions(html, mapping);
  return { html: applyPlan(html, plan), plan, counts: { wireframe: plan.length } };
}

module.exports = {
  injectSpec,
  injectWireframe,
  planSpecInsertions,
  planWireframeInsertions,
  wireframeAnchorsOf,
  hasSpecSide,
  hasWireframeSide,
  sectionRange,
  findAnchorOffset,
  findDefinitionCell,
  BADGE,
  BADGE_RE,
  BadgeInjectError,
};

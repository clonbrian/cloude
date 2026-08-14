#!/usr/bin/env node
'use strict';

// Step 1 source inspection, runnable BEFORE mapping.json exists. Plain Node, no deps.
//
//   node scripts/preflight.js <spec-md> <wireframe-html> [options]
//     --anchors "a,b,c"        exact occurrence count for each anchor text
//     --headings "metadata=文件資訊,changeLog=修訂紀錄,purpose=背景與目標"
//
// This exists because two Step 1 checks were previously unrunnable. `build-export.js`
// needs an approved mapping.json, which cannot exist until Step 3 — so "check the spec MD
// renders" and "check the Wireframe's labels are injectable" had no tool behind them, and
// the only way to perform them was to read the generator's source and reason about it.
// A check with no way to run it is not a check.
//
// The anchor-collision report is the other half. Anchor matching is a plain substring scan
// over the Wireframe's visible text, so a field label that also appears inside a prose
// sentence resolves to two places — and the build then hard-fails at Step 4, after the user
// has already approved a mapping table built on the assumption that it was unique. This
// surfaces that at Step 1, where it costs one question instead of a rebuild.

const fs = require('fs');
const path = require('path');
const { render, readMetadata, MdRenderError } = require('./lib/md-render');

function die(msg) {
  process.stderr.write(`preflight: ${msg}\n`);
  process.exit(2);
}

function parseArgs(argv) {
  const out = { positional: [], anchors: [], headings: {} };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--anchors') {
      out.anchors = String(argv[++i] || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (argv[i] === '--headings') {
      for (const pair of String(argv[++i] || '').split(',')) {
        const [k, v] = pair.split('=');
        if (k && v) out.headings[k.trim()] = v.trim();
      }
    } else {
      out.positional.push(argv[i]);
    }
  }
  return out;
}

function decodeEntities(s) {
  return String(s)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

// Visible text nodes of the Wireframe, matching badge-inject.js's own rule: <script> and
// <style> bodies are skipped, and text inside a tag's attributes is never reached.
function visibleTextNodes(html) {
  const out = [];
  const re = /<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>|<[^>]*>/gi;
  let cursor = 0;
  let m;
  while ((m = re.exec(html)) !== null) {
    if (m.index > cursor) out.push(html.slice(cursor, m.index));
    cursor = m.index + m[0].length;
  }
  if (cursor < html.length) out.push(html.slice(cursor));
  return out.map(decodeEntities).filter((s) => s.trim().length);
}

// Every occurrence, each with the text around it. The context is the point of this: a
// collision report that says only "×2" leaves whoever has to ask the user which occurrence
// the number means to go back and read the Wireframe themselves, and the element the
// candidate label was found in says nothing about where the OTHER occurrences are.
function occurrences(nodes, needle) {
  const out = [];
  for (const t of nodes) {
    let at = 0;
    for (;;) {
      const hit = t.indexOf(needle, at);
      if (hit === -1) break;
      const from = Math.max(0, hit - 14);
      const to = Math.min(t.length, hit + needle.length + 20);
      const snippet = t.slice(from, to).replace(/\s+/g, ' ').trim();
      out.push({ context: `${from > 0 ? '…' : ''}${snippet}${to < t.length ? '…' : ''}` });
      at = hit + 1;
    }
  }
  return out;
}

const countOccurrences = (nodes, needle) => occurrences(nodes, needle).length;

// Elements that carry a field label in a typical Wireframe. Used to propose the anchor
// set at Step 1 before the mapping table exists.
const LABEL_TAGS = ['th', 'label', 'legend', 'dt', 'button', 'summary', 'a'];

// Screen-split candidates. Numbering order across screens is decided at Step 1, and this is
// the evidence to put to the user — every other Step 1 verdict comes from this script, so
// leaving this one to be read off the markup by hand made it the odd one out, in a skill that
// elsewhere says not to reconstruct by hand what a script can state.
function screenCandidates(html) {
  const out = [];
  const containerRe = /<(section|article|main)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
  let m;
  while ((m = containerRe.exec(html)) !== null) {
    const attrs = m[2] || '';
    const id = (/id="([^"]*)"/i.exec(attrs) || [])[1];
    const cls = (/class="([^"]*)"/i.exec(attrs) || [])[1];
    const heading = /<h[1-3]\b[^>]*>([\s\S]*?)<\/h[1-3]>/i.exec(m[3]);
    out.push({
      kind: `<${m[1].toLowerCase()}>`,
      label: [id && `id="${id}"`, cls && `class="${cls}"`].filter(Boolean).join(' ') || '(no id/class)',
      heading: heading ? decodeEntities(heading[1].replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim() : null,
    });
  }
  return out;
}

function topHeadings(html) {
  const out = [];
  const re = /<h([12])\b[^>]*>([\s\S]*?)<\/h\1>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    out.push({
      level: Number(m[1]),
      text: decodeEntities(m[2].replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim(),
    });
  }
  return out;
}

function candidateLabels(html) {
  const out = [];
  for (const tag of LABEL_TAGS) {
    const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'gi');
    let m;
    while ((m = re.exec(html)) !== null) {
      const text = decodeEntities(m[1].replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
      if (text && text.length <= 40) out.push({ tag, text });
    }
  }
  const seen = new Set();
  return out.filter((c) => (seen.has(c.text) ? false : seen.add(c.text)));
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.positional.length < 2) {
    die('usage: node scripts/preflight.js <spec-md> <wireframe-html> [--anchors "a,b"] [--headings "metadata=…"]');
  }
  const specPath = path.resolve(args.positional[0]);
  const wfPath = path.resolve(args.positional[1]);
  for (const [p, what] of [[specPath, 'spec MD'], [wfPath, 'Wireframe HTML']]) {
    if (!fs.existsSync(p)) die(`${what} not found: ${p}`);
  }

  const specMd = fs.readFileSync(specPath, 'utf8');
  const wfHtml = fs.readFileSync(wfPath, 'utf8');
  const lines = [];
  let hardFail = false;

  // ---- spec MD
  lines.push('spec MD');
  let rendered = null;
  try {
    rendered = render(specMd);
    const headings = (rendered.match(/<h\d[^>]*>/g) || []).length;
    const rows = (rendered.match(/<tr>/g) || []).length;
    lines.push(`  render            OK — ${headings} headings, ${rows} table rows`);
  } catch (e) {
    hardFail = true;
    if (e instanceof MdRenderError) {
      lines.push(`  render            FAIL — ${e.message}`);
      lines.push('                    Do not reword the spec to work around this. Report the');
      lines.push('                    construct and agree how to handle it (SKILL.md Step 1).');
    } else {
      throw e;
    }
  }

  const h = args.headings;
  const meta = readMetadata(specMd, h.metadata);
  if (meta) {
    const want = ['Version', 'Author', 'Last Updated', 'Status'];
    const missing = want.filter((k) => !(k in meta));
    lines.push(
      `  metadata table    found${missing.length ? ` — missing field(s): ${missing.join(', ')}` : ''}` +
        (meta.Version ? ` — Version ${meta.Version}` : '') +
        (meta.Status ? ` / Status ${meta.Status}` : '')
    );
  } else {
    lines.push(
      `  metadata table    NOT FOUND (looked for heading "${h.metadata || 'Metadata'}")`
    );
    lines.push('                    If this document simply CALLS it something else (文件資訊, 修訂資訊),');
    lines.push('                    re-run with --headings "metadata=<its title>" and record the same');
    lines.push('                    value in mapping.json templateHeadings. Only a table that is genuinely');
    lines.push('                    absent is the template gap Step 1 stops and asks about.');
  }

  const mdLines = specMd.replace(/\r\n?/g, '\n').split('\n');
  const hasHeading = (title) =>
    mdLines.some((l) => new RegExp(`^#{1,6}\\s+${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`).test(l.trim()));
  const purposeCandidates = [h.purpose, 'Purpose', '目的', '背景與目標'].filter(Boolean);
  const purposeHit = purposeCandidates.find(hasHeading);
  lines.push(
    purposeHit
      ? `  opening section   found — "${purposeHit}"`
      : `  opening section   NOT FOUND (looked for: ${purposeCandidates.join(' / ')}) — excluded-zones will WARN`
  );
  const changeLogTitle = h.changeLog || 'Change Log';
  lines.push(
    hasHeading(changeLogTitle)
      ? `  change log        found — "${changeLogTitle}"`
      : `  change log        NOT FOUND (looked for "${changeLogTitle}") — badges there cannot be excluded`
  );
  lines.push(
    '  NOTE              this is a STRUCTURAL check of the anchors this skill depends on,'
  );
  lines.push('                    not a review of whether the spec is complete enough to build from.');

  // ---- Wireframe
  const nodes = visibleTextNodes(wfHtml);
  lines.push('');
  lines.push('Wireframe');
  lines.push(`  visible text      ${nodes.length} text node(s)`);
  if (!nodes.length) {
    hardFail = true;
    lines.push('  injectability     FAIL — no visible text at all. A flattened-screenshot or');
    lines.push('                    fully JS-rendered Wireframe cannot be badged by this skill;');
    lines.push('                    annotating a screenshot of the rendered page is a different');
    lines.push('                    technique and is out of scope — see SKILL.md Step 1.');
  }

  // Screen split — evidence for the Step 1 question, not a decision. The user confirms it.
  const screens = screenCandidates(wfHtml);
  const heads = topHeadings(wfHtml);
  const rules = (wfHtml.match(/<hr\b[^>]*>/gi) || []).length;
  lines.push('  screen split      evidence below — Step 1 puts this to the user, it is not decided here');
  if (screens.length) {
    lines.push(`                    ${screens.length} container(s):`);
    for (const s of screens) {
      lines.push(`                      ${s.kind} ${s.label}${s.heading ? ` — 「${s.heading}」` : ' — (no heading inside)'}`);
    }
  } else {
    lines.push('                    no <section>/<article>/<main> containers');
  }
  lines.push(
    `                    ${heads.filter((h) => h.level === 1).length} <h1>, ` +
      `${heads.filter((h) => h.level === 2).length} <h2>, ${rules} <hr>`
  );
  for (const h of heads) lines.push(`                      <h${h.level}> 「${h.text}」`);
  if (!screens.length && heads.filter((h) => h.level === 1).length <= 1) {
    lines.push('                    → reads as a SINGLE screen; confirm with the user before numbering');
  } else {
    lines.push('                    → reads as MULTIPLE screens; propose the split and the processing');
    lines.push('                      order to the user — numbering runs across screens in that order');
  }

  const cands = candidateLabels(wfHtml);
  const collisions = cands
    .map((c) => ({ ...c, n: countOccurrences(nodes, c.text) }))
    .filter((c) => c.n > 1);

  // An explicit verdict, not just counts. The injectability check has a hard consequence
  // (a Wireframe that fails it cannot be badged at all), so leaving
  // the reader to infer it from two numbers puts them back to reading the Wireframe by hand
  // — the exact work this script exists to remove.
  if (nodes.length && cands.length) {
    lines.push('  injectability     OK — component labels exist as visible text and can be anchored');
  } else if (nodes.length) {
    lines.push('  injectability     DOUBTFUL — visible text exists, but none of it sits in a label');
    lines.push(`                    element (${LABEL_TAGS.map((t) => `<${t}>`).join(' ')}). Anchoring may still`);
    lines.push('                    work on plain text; confirm the intended labels with --anchors before Step 2.');
  }
  lines.push(`  candidate labels  ${cands.length} in ${LABEL_TAGS.map((t) => `<${t}>`).join(' ')}`);
  for (const c of cands) lines.push(`                    "${c.text}"  (<${c.tag}>)`);
  if (collisions.length) {
    lines.push(`  AMBIGUOUS         ${collisions.length} label(s) occur more than once in visible text:`);
    for (const c of collisions) {
      lines.push(`                    "${c.text}" ×${c.n} — needs "nth", or a longer anchor`);
      occurrences(nodes, c.text).forEach((o, i) => {
        lines.push(`                      nth=${i + 1}  ${o.context}`);
      });
    }
    lines.push('                    The occurrence list above is what you put to the user — quote it,');
    lines.push('                    do not re-read the Wireframe to reconstruct it. Confirm which one');
    lines.push('                    each number means in Step 2 BEFORE presenting the Step 3 table.');
    lines.push('                    The build refuses to guess.');
  } else {
    lines.push('  AMBIGUOUS         none — every candidate label occurs exactly once');
  }

  // ---- explicit anchors
  if (args.anchors.length) {
    lines.push('');
    lines.push('Anchors given');
    for (const a of args.anchors) {
      const n = countOccurrences(nodes, a);
      if (n === 0) {
        hardFail = true;
        lines.push(`  "${a}"  ×0  NOT FOUND — attribute text (placeholder/title/value) and <script> content are invisible here`);
        lines.push('              (a Spec-only field has no Wireframe anchor by definition — do not list it here)');
      } else if (n > 1) {
        lines.push(`  "${a}"  ×${n}  needs "nth" (1-${n})`);
        occurrences(nodes, a).forEach((o, i) => lines.push(`              nth=${i + 1}  ${o.context}`));
      } else {
        lines.push(`  "${a}"  ×1  ok`);
      }
    }
  }

  lines.push('');
  lines.push(
    hardFail
      ? 'Blocking problem(s) above. Resolve with the user before starting Step 2.'
      : 'No blocking problem. Proceed to Step 1 confirmations.'
  );
  process.stdout.write(lines.join('\n') + '\n');
  process.exit(hardFail ? 1 : 0);
}

main();

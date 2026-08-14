#!/usr/bin/env node
'use strict';

// Builds the three delivered HTML files from mapping.json + the spec MD + the Wireframe
// HTML. Plain Node, no dependencies.
//
//   node scripts/build-export.js <export-folder>
//
// Everything between the sources and the delivered files is deterministic. Same inputs
// in, byte-identical files out — which is what makes "re-run and diff" a real check that
// nothing was hand-edited, and what removes the whole "content lost while transcribing
// the spec into HTML" failure class rather than checking for it afterwards.
//
// Three files, one numbering:
//   spec.html       rendered spec MD, badges on field definitions (+ narrative mentions)
//   wireframe.html  the Wireframe source, byte-for-byte, plus badges and one injected
//                   block delimited by <!-- ref-export:begin --> / <!-- ref-export:end -->
//   combined.html   both of the above behind a pure-CSS two-tab switch
//
// combined.html embeds the spec as inline markup and the Wireframe as an <iframe srcdoc>.
// The iframe is not decoration: the Wireframe carries its own global CSS (`table { … }`,
// `body { … }`), and inlining it would restyle the spec panel sitting next to it. The
// iframe guarantees the Wireframe tab renders exactly like the standalone file — which is
// the property verify.js's combined-composition check exists to assert.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { render, readMetadata, escapeHtml, MdRenderError } = require('./lib/md-render');
const { injectSpec, injectWireframe, BadgeInjectError } = require('./lib/badge-inject');

const SENTINEL_OPEN = '<!-- ref-export:begin -->';
const SENTINEL_CLOSE = '<!-- ref-export:end -->';

function die(msg) {
  process.stderr.write(`build-export: ${msg}\n`);
  process.exit(1);
}

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function resolveSource(exportDir, p, what) {
  if (!p) die(`mapping.json sources.${what} is not set`);
  const abs = path.isAbsolute(p) ? p : path.resolve(exportDir, p);
  if (!fs.existsSync(abs)) {
    die(`sources.${what} not found: ${abs}\n  paths are resolved against the export folder, or given absolute`);
  }
  return abs;
}

// ------------------------------------------------------------------- styles

function styleBlock(mapping) {
  const bg = mapping.refNumBg || 'rgba(214, 40, 40, 0.85)';
  const fg = mapping.refNumColor || '#fff';
  return `<style>
:root { --ref-num-bg: ${bg}; --ref-num-color: ${fg}; }
.ref-num {
  display: inline-block;
  background-color: var(--ref-num-bg);
  color: var(--ref-num-color);
  font-size: 11px;
  font-weight: bold;
  border-radius: 4px;
  padding: 1px 6px;
  margin-right: 6px;
  vertical-align: middle;
  line-height: 1.6;
}
.export-meta {
  font: 13px/1.6 system-ui, -apple-system, "Segoe UI", "Noto Sans TC", sans-serif;
  background: #f4f4f5;
  color: #27272a;
  border: 1px solid #d4d4d8;
  border-radius: 4px;
  padding: 8px 12px;
  margin: 0 0 16px;
}
.export-meta strong { font-weight: 700; }
</style>`;
}

const SPEC_BODY_STYLE = `<style>
body {
  font: 15px/1.75 system-ui, -apple-system, "Segoe UI", "Noto Sans TC", sans-serif;
  color: #18181b;
  background: #fff;
  margin: 0;
  padding: 24px;
}
.export-body { max-width: 1100px; margin: 0 auto; }
.export-body table { border-collapse: collapse; margin: 12px 0; width: 100%; }
.export-body th, .export-body td { border: 1px solid #d4d4d8; padding: 6px 10px; text-align: left; vertical-align: top; }
.export-body th { background: #f4f4f5; }
.export-body code { background: #f4f4f5; border-radius: 3px; padding: 1px 4px; }
.export-body blockquote { border-left: 3px solid #d4d4d8; margin: 12px 0; padding: 4px 12px; color: #52525b; }
.export-body hr { border: 0; border-top: 1px solid #e4e4e7; margin: 24px 0; }
</style>`;

const TAB_STYLE = `<style>
.tab-radio { position: absolute; opacity: 0; pointer-events: none; }
.tab-bar { display: flex; gap: 4px; border-bottom: 2px solid #d4d4d8; margin: 0 0 16px; position: sticky; top: 0; background: #fff; z-index: 5; }
.tab-label {
  font: 14px/1 system-ui, -apple-system, "Segoe UI", "Noto Sans TC", sans-serif;
  padding: 10px 18px;
  cursor: pointer;
  border: 1px solid #d4d4d8;
  border-bottom: none;
  border-radius: 4px 4px 0 0;
  background: #f4f4f5;
  color: #52525b;
  user-select: none;
}
.tab-panel { display: none; }
#tab-spec:checked ~ .tab-bar .tab-label[for="tab-spec"],
#tab-wireframe:checked ~ .tab-bar .tab-label[for="tab-wireframe"] {
  background: #fff;
  color: #18181b;
  font-weight: 700;
  box-shadow: inset 0 -2px 0 #fff;
}
#tab-spec:checked ~ #panel-spec { display: block; }
#tab-wireframe:checked ~ #panel-wireframe { display: block; }
/* The Wireframe frame embeds wireframe.html whole, and that file carries its own
   traceability header so it stands alone. On the Wireframe tab the outer header would
   sit directly above an identical copy of itself, which reads as a rendering bug. Hide
   the outer one there; the frame's own header is the one the reader sees — it renders
   right after the tab bar (the iframe's own position in the markup), which is why
   .export-meta is placed after .tab-bar here too: both tabs then show the header in the
   same slot, immediately below the tab bar, rather than above it on Spec and below it on
   Wireframe. This is why the radios still precede .export-meta in the markup — "~" only
   reaches later siblings, and .tab-bar sitting between them changes nothing about that. */
#tab-wireframe:checked ~ .export-meta { display: none; }
#panel-wireframe iframe { width: 100%; height: calc(100vh - 100px); border: 1px solid #d4d4d8; border-radius: 4px; background: #fff; }
</style>`;

// -------------------------------------------------------------------- parts

function metaLine(mapping) {
  const cells = [
    ['功能名稱', mapping.featureName],
    ['匯出日期', mapping.exportDate],
    ['Spec 版本', mapping.specVersion],
    ['Spec 狀態', mapping.specStatus],
  ];
  const body = cells
    .map(([k, v]) => `<strong>${escapeHtml(k)}</strong>：${escapeHtml(v == null ? '[TO CONFIRM]' : v)}`)
    .join('　｜　');
  return `<div class="export-meta">${body}</div>`;
}

function hashComment(hashes) {
  return `<!-- ref-export-source-hashes specMd=${hashes.specMd} wireframeHtml=${hashes.wireframeHtml} -->`;
}

// The one block injected into the Wireframe source. Everything the export adds to that
// file lives between the sentinels, so verify.js reconstructs the original by deleting
// this region and the badge spans — nothing else about the file is touched.
function wireframeInjectedBlock(mapping, hashes) {
  return [SENTINEL_OPEN, hashComment(hashes), styleBlock(mapping), metaLine(mapping), SENTINEL_CLOSE].join('\n');
}

function insertIntoWireframe(source, block) {
  const bodyOpen = /<body\b[^>]*>/i.exec(source);
  if (bodyOpen) {
    const at = bodyOpen.index + bodyOpen[0].length;
    return source.slice(0, at) + '\n' + block + source.slice(at);
  }
  return block + '\n' + source;
}

// ------------------------------------------------------------------- output

function specDocument(mapping, hashes, specBodyHtml) {
  return `<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(mapping.featureName)} — Spec</title>
${hashComment(hashes)}
${styleBlock(mapping)}
${SPEC_BODY_STYLE}
</head>
<body>
${metaLine(mapping)}
<div class="export-body">
${specBodyHtml}
</div>
</body>
</html>
`;
}

const srcdocEscape = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');

function combinedDocument(mapping, hashes, specBodyHtml, wireframeDocument, labels) {
  return `<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(mapping.featureName)} — Spec &amp; Wireframe</title>
${hashComment(hashes)}
${styleBlock(mapping)}
${SPEC_BODY_STYLE}
${TAB_STYLE}
</head>
<body>
<input type="radio" name="doc-tab" id="tab-spec" class="tab-radio" checked>
<input type="radio" name="doc-tab" id="tab-wireframe" class="tab-radio">
<div class="tab-bar">
<label class="tab-label" for="tab-spec">${escapeHtml(labels.spec)}</label>
<label class="tab-label" for="tab-wireframe">${escapeHtml(labels.wireframe)}</label>
</div>
${metaLine(mapping)}
<div class="tab-panel" id="panel-spec">
<div class="export-body">
${specBodyHtml}
</div>
</div>
<div class="tab-panel" id="panel-wireframe">
<iframe title="${escapeHtml(labels.wireframe)}" srcdoc="${srcdocEscape(wireframeDocument)}"></iframe>
</div>
</body>
</html>
`;
}

// --------------------------------------------------------------------- main

function main() {
  const exportDir = process.argv[2];
  if (!exportDir) die('usage: node scripts/build-export.js <export-folder>');
  const dir = path.resolve(exportDir);
  const mappingPath = path.join(dir, 'mapping.json');
  if (!fs.existsSync(mappingPath)) die(`mapping.json not found in ${dir}`);

  let mapping;
  try {
    mapping = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
  } catch (e) {
    die(`mapping.json is not valid JSON: ${e.message}`);
  }

  for (const field of ['featureName', 'exportDate']) {
    if (!mapping[field]) die(`mapping.json is missing "${field}"`);
  }

  const sources = mapping.sources || {};
  const specMdPath = resolveSource(dir, sources.specMd, 'specMd');
  const wireframePath = resolveSource(dir, sources.wireframeHtml, 'wireframeHtml');

  const specMdRaw = fs.readFileSync(specMdPath);
  const wireframeRaw = fs.readFileSync(wireframePath);
  const hashes = { specMd: sha256(specMdRaw), wireframeHtml: sha256(wireframeRaw) };

  const specMd = specMdRaw.toString('utf8');
  const wireframeSource = wireframeRaw.toString('utf8');

  // Metadata the header line reports. mapping.json wins when set — a spec whose template
  // has no Metadata table records the values there, flagged in the delivery.
  const headings = mapping.templateHeadings || {};
  const meta = readMetadata(specMd, headings.metadata) || {};
  if (!mapping.specVersion && meta.Version) mapping.specVersion = meta.Version;
  if (!mapping.specStatus && meta.Status) mapping.specStatus = meta.Status;

  let specHtml;
  try {
    specHtml = render(specMd);
  } catch (e) {
    if (e instanceof MdRenderError) {
      die(
        `spec MD uses a construct the renderer does not cover — ${e.message}\n` +
          `  Do not work around this by rewording the spec. Report the construct and agree how to handle it.`
      );
    }
    throw e;
  }

  let specInjected;
  let wireframeInjected;
  try {
    specInjected = injectSpec(specHtml, mapping);
    wireframeInjected = injectWireframe(wireframeSource, mapping);
  } catch (e) {
    if (e instanceof BadgeInjectError) die(e.message);
    throw e;
  }

  const files = mapping.files || {};
  const base = `${mapping.exportDate}-${mapping.featureName}`;
  const specName = files.spec || `${base}-spec.html`;
  const wireframeName = files.wireframe || `${base}-wireframe.html`;
  const combinedName = files.combined || `${base}-combined.html`;

  const labels = {
    spec: (mapping.tabLabels && mapping.tabLabels.spec) || 'Spec',
    wireframe: (mapping.tabLabels && mapping.tabLabels.wireframe) || 'Wireframe',
  };

  const wireframeDocument = insertIntoWireframe(
    wireframeInjected.html,
    wireframeInjectedBlock(mapping, hashes)
  );
  const specDoc = specDocument(mapping, hashes, specInjected.html);
  const combinedDoc = combinedDocument(mapping, hashes, specInjected.html, wireframeDocument, labels);

  fs.writeFileSync(path.join(dir, specName), specDoc);
  fs.writeFileSync(path.join(dir, wireframeName), wireframeDocument);
  fs.writeFileSync(path.join(dir, combinedName), combinedDoc);

  // Record what was actually built, so verify.js reads the same file names and the same
  // resolved metadata this run used rather than re-deriving them.
  mapping.files = { spec: specName, wireframe: wireframeName, combined: combinedName };
  mapping.sourceHashes = hashes;
  fs.writeFileSync(mappingPath, JSON.stringify(mapping, null, 2) + '\n');

  const numbers = new Set((mapping.entries || []).map((e) => e.no));
  process.stdout.write(
    [
      `built ${specName}, ${wireframeName}, ${combinedName}`,
      `  numbers            ${numbers.size}`,
      `  spec definition    ${specInjected.counts.definition}`,
      `  spec narrative     ${specInjected.counts.narrative}`,
      `  wireframe badges   ${wireframeInjected.counts.wireframe}`,
      `  spec version       ${mapping.specVersion || '[TO CONFIRM]'} / status ${mapping.specStatus || '[TO CONFIRM]'}`,
      '',
      'Reconcile these counts against mapping.json, then run scripts/verify.js.',
      '',
    ].join('\n')
  );
}

main();

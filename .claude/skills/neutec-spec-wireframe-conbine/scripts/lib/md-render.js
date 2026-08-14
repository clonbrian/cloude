'use strict';

// Deterministic Markdown -> HTML renderer for the team's spec template. Pure
// functions, no I/O, no dependencies.
//
// This replaces the hand-written spec.html conversion that used to be produced by
// whoever ran the skill. Two properties matter and both come from being a script:
//
//   1. Same MD in, same HTML out, always. combined.html's spec panel can be compared
//      against the standalone spec.html because both come from one reproducible render.
//   2. Content cannot be summarized, merged, or dropped in conversion. The entire
//      "MD content loss" failure class disappears rather than being checked for.
//
// This renderer may exist as a copy in more than one skill. If it does, keep the copies
// byte-identical: a divergence means the same spec MD renders differently depending on which
// skill produced the export, and a mapping.json moved between them stops lining up.
//
// The team's spec template uses a bounded construct set (headings, pipe tables,
// bullet/ordered lists at any nesting depth, blockquotes, horizontal rules, inline
// code, bold). Anything outside it THROWS — a spec using an unsupported construct must
// be handled deliberately, never silently rendered wrong or dropped.
//
// List nesting depth is intentionally uncapped: renderList() below is indent-based
// and recursive, so it was always structurally capable of arbitrary depth — the old
// UNSUPPORTED entry rejected deep nesting on sight without ever exercising that path.
// Removed once a real spec needed 4 levels; see CHANGELOG.

const UNSUPPORTED = [
  { re: /^```/, what: 'fenced code block' },
  { re: /^\s*[-*] \[[ xX]\]/, what: 'task list item' },
  { re: /^>\s*>/, what: 'nested blockquote' },
  { re: /!\[[^\]]*\]\(/, what: 'image' },
  { re: /\[[^\]]+\]\([^)]*\)/, what: 'link' },
  { re: /<\/?[a-zA-Z][a-zA-Z0-9]*(\s[^>]*)?>/, what: 'raw HTML' },
  { re: /~~/, what: 'strikethrough' },
];

class MdRenderError extends Error {}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Inline: a single left-to-right scan, not split-then-replace. Splitting on
// backtick first (the old approach) breaks a `**` pair that wraps a code span
// (`**\`code\`**`) into two separate .map() calls that can't see each other's
// dangling marker, and the leftover "**" gets cross-matched against the next
// unrelated bold span later in the line. Scanning once keeps bold state (open/
// closed) independent of code-span boundaries, so bold can wrap a code span.
function inline(text, lineNo) {
  const s = String(text);
  let out = '';
  let buf = '';
  let boldOpen = false;
  const flush = () => {
    out += escapeHtml(buf);
    buf = '';
  };
  let i = 0;
  while (i < s.length) {
    if (s[i] === '`') {
      const end = s.indexOf('`', i + 1);
      if (end === -1) {
        throw new MdRenderError(`line ${lineNo}: unclosed inline code span (odd number of backticks)`);
      }
      flush();
      out += `<code>${escapeHtml(s.slice(i + 1, end))}</code>`;
      i = end + 1;
      continue;
    }
    if (s[i] === '*' && s[i + 1] === '*') {
      flush();
      out += boldOpen ? '</strong>' : '<strong>';
      boldOpen = !boldOpen;
      i += 2;
      continue;
    }
    buf += s[i];
    i++;
  }
  flush();
  if (boldOpen) {
    throw new MdRenderError(`line ${lineNo}: unclosed bold marker (odd number of **)`);
  }
  return out;
}

function splitRow(line, lineNo) {
  let s = line.trim();
  if (!s.startsWith('|')) throw new MdRenderError(`line ${lineNo}: table row must start with |`);
  s = s.slice(1);
  if (s.endsWith('|')) s = s.slice(0, -1);
  return s.split('|').map((c) => c.trim());
}

const isBlank = (l) => /^\s*$/.test(l);
const isHeading = (l) => /^(#{1,6}) +(.*\S)\s*$/.test(l);
const isTable = (l) => /^\s*\|/.test(l);
const isHr = (l) => /^-{3,}\s*$/.test(l);
const isQuote = (l) => /^>\s?/.test(l);
const isBullet = (l) => /^(\s*)[-*] +\S/.test(l);
const isOrdered = (l) => /^(\s*)\d+\. +\S/.test(l);

// Every rule is line-scoped: the template has no multi-line construct that needs
// more, and a per-line check names the offending line in the error.
function checkUnsupported(lines) {
  for (const u of UNSUPPORTED) {
    for (let i = 0; i < lines.length; i++) {
      if (u.re.test(lines[i])) {
        throw new MdRenderError(
          `line ${i + 1}: unsupported Markdown construct (${u.what}): ${lines[i].trim().slice(0, 60)}`
        );
      }
    }
  }
}

// One bullet/ordered list, supporting a single level of nesting (the template's limit).
function renderList(lines, start, ordered) {
  const matcher = ordered ? isOrdered : isBullet;
  const strip = (l) => l.replace(/^(\s*)(?:[-*]|\d+\.) +/, '');
  const indentOf = (l) => (l.match(/^(\s*)/) || ['', ''])[1].length;

  const baseIndent = indentOf(lines[start]);
  const out = [];
  let i = start;

  while (i < lines.length && (matcher(lines[i]) || isBullet(lines[i]) || isOrdered(lines[i]))) {
    const ind = indentOf(lines[i]);
    if (ind < baseIndent) break;
    if (ind > baseIndent) {
      // Nested list: render it and fold into the previous <li>, which stays open.
      const nestedOrdered = isOrdered(lines[i]);
      const nested = renderList(lines, i, nestedOrdered);
      if (!out.length) throw new MdRenderError(`line ${i + 1}: nested list without a parent item`);
      const tag = nestedOrdered ? 'ol' : 'ul';
      const body = nested.html
        .split('\n')
        .map((l) => '  ' + l)
        .join('\n');
      out[out.length - 1] = out[out.length - 1].replace(/<\/li>$/, `\n${body}\n</li>`);
      out[out.length - 1] = out[out.length - 1].replace(
        /\n {2}<(ul|ol)>/,
        `\n  <${tag}>`
      );
      i = nested.next;
      continue;
    }
    out.push(`<li>${inline(strip(lines[i]), i + 1)}</li>`);
    i++;
  }

  const tag = ordered ? 'ol' : 'ul';
  return { html: `<${tag}>\n${out.join('\n')}\n</${tag}>`, next: i };
}

function render(md) {
  const lines = String(md).replace(/\r\n?/g, '\n').split('\n');
  checkUnsupported(lines);

  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (isBlank(line)) {
      i++;
      continue;
    }

    if (isHeading(line)) {
      const m = line.match(/^(#{1,6}) +(.*\S)\s*$/);
      const level = m[1].length;
      blocks.push({ kind: 'heading', level, html: `<h${level}>${inline(m[2], i + 1)}</h${level}>` });
      i++;
      continue;
    }

    if (isHr(line)) {
      blocks.push({ kind: 'hr', html: '<hr>' });
      i++;
      continue;
    }

    if (isTable(line)) {
      const rows = [];
      while (i < lines.length && isTable(lines[i])) {
        rows.push({ cells: splitRow(lines[i], i + 1), lineNo: i + 1, raw: lines[i] });
        i++;
      }
      if (rows.length < 2) throw new MdRenderError(`line ${rows[0].lineNo}: table needs a header and a separator row`);
      const sep = rows[1];
      if (!sep.cells.every((c) => /^:?-{1,}:?$/.test(c))) {
        throw new MdRenderError(`line ${sep.lineNo}: expected a table separator row (|---|---|)`);
      }
      const width = rows[0].cells.length;
      const html = [
        '<table>',
        `<tr>${rows[0].cells.map((c) => `<th>${inline(c, rows[0].lineNo)}</th>`).join('')}</tr>`,
      ];
      for (const r of rows.slice(2)) {
        if (r.cells.length !== width) {
          throw new MdRenderError(
            `line ${r.lineNo}: table row has ${r.cells.length} cells, header has ${width}`
          );
        }
        html.push(`<tr>${r.cells.map((c) => `<td>${inline(c, r.lineNo)}</td>`).join('')}</tr>`);
      }
      html.push('</table>');
      blocks.push({ kind: 'table', html: html.join('\n') });
      continue;
    }

    if (isQuote(line)) {
      // Consecutive quote lines form one blockquote; a blank line ends it.
      // The "> " marker is a Markdown control character, not content — it is not
      // reproduced in the output (verify.js strips it on the MD side to match).
      const buf = [];
      while (i < lines.length && isQuote(lines[i])) {
        buf.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      blocks.push({ kind: 'blockquote', html: `<blockquote>${inline(buf.join(' '), i)}</blockquote>` });
      continue;
    }

    if (isBullet(line) || isOrdered(line)) {
      const r = renderList(lines, i, isOrdered(line));
      blocks.push({ kind: 'list', html: r.html });
      i = r.next;
      continue;
    }

    // Paragraph: consecutive plain lines.
    const buf = [];
    while (
      i < lines.length &&
      !isBlank(lines[i]) &&
      !isHeading(lines[i]) &&
      !isTable(lines[i]) &&
      !isHr(lines[i]) &&
      !isQuote(lines[i]) &&
      !isBullet(lines[i]) &&
      !isOrdered(lines[i])
    ) {
      buf.push(lines[i].trim());
      i++;
    }
    blocks.push({ kind: 'paragraph', html: `<p>${inline(buf.join(' '), i)}</p>` });
  }

  // Blank line before every heading and around rules; single newline elsewhere.
  const out = [];
  blocks.forEach((b, idx) => {
    if (idx > 0 && (b.kind === 'heading' || b.kind === 'hr' || blocks[idx - 1].kind === 'hr')) {
      out.push('');
    }
    out.push(b.html);
  });
  return out.join('\n');
}

// Metadata table values, read from the Metadata section — the export needs Version and
// Status for the page header every delivered file carries.
//
// The heading title is a parameter rather than the literal "Metadata" because another
// BU's template names the same table differently (文件資訊, 修訂資訊). mapping.json's
// templateHeadings.metadata supplies it; the default is this team's own template.
//
// Two table orientations are both real: a horizontal one (header row IS the field names,
// one data row holds the values) and a vertical one (a generic two-column header such as
// 欄位/內容, one field per row below it) — the latter is this team's own convention. The
// header row's own cells decide which: if it names a known field, it is horizontal.
const isSeparatorRow = (r) => r.every((c) => /^:?-+:?$/.test(c.trim()));
const METADATA_FIELDS = ['Version', 'Author', 'Last Updated', 'Status'];

function readMetadata(md, heading) {
  const title = heading || 'Metadata';
  const lines = String(md).replace(/\r\n?/g, '\n').split('\n');
  const titleRe = new RegExp(`^#{1,6}\\s+${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`);
  const at = lines.findIndex((l) => titleRe.test(l));
  if (at === -1) return null;
  const rows = [];
  for (let i = at + 1; i < lines.length; i++) {
    if (/^#{1,6} /.test(lines[i])) break;
    if (isTable(lines[i])) rows.push(splitRow(lines[i], i + 1));
    else if (rows.length) break;
  }
  if (rows.length < 3) return null;
  const header = rows[0];
  const dataRows = rows.slice(1).filter((r) => !isSeparatorRow(r));
  if (!dataRows.length) return null;

  const out = {};
  const horizontal = header.some((h) => METADATA_FIELDS.includes(h.trim()));
  if (!horizontal && dataRows.every((r) => r.length === 2)) {
    for (const r of dataRows) out[r[0].trim()] = r[1];
  } else {
    header.forEach((h, i) => {
      out[h] = dataRows[0][i];
    });
  }
  return out;
}

module.exports = { render, readMetadata, inline, escapeHtml, MdRenderError };

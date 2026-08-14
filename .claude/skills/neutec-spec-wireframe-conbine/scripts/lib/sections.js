'use strict';

// spec.html section slicing — pure functions, no I/O.
//
// Locates the region of the rendered spec a badge anchor is allowed to resolve in. A
// section runs from its heading to the next heading of the same-or-shallower level, the
// next <hr>, or the end of the document, whichever comes first.
//
// Section titles are NOT unique document-wide ("B. System Logic" exists under several
// chapters), so every lookup is scoped to the chapter that owns it.
//
// This is the generator's interpretation of the spec's structure. verify.js must never
// import it — a verifier sharing the generator's interpretation cannot see a bug in it.

function chapterRange(specHtml, chapterTitle) {
  const open = `<h2>${chapterTitle}</h2>`;
  const from = specHtml.indexOf(open);
  if (from === -1) return null;
  const next = specHtml.indexOf('<h2', from + open.length);
  return { from, to: next === -1 ? specHtml.length : next };
}

function sectionEnd(specHtml, afterPos, level) {
  const stopRe = /<h(\d)[^>]*>|<hr\s*\/?>|<\/body>/g;
  stopRe.lastIndex = afterPos;
  let m;
  while ((m = stopRe.exec(specHtml)) !== null) {
    if (m[1] !== undefined) {
      if (Number(m[1]) <= level) return m.index;
    } else {
      return m.index;
    }
  }
  return specHtml.length;
}

// Find a heading by its exact text at any level, optionally scoped to one chapter.
function findHeading(specHtml, title, chapterTitle) {
  const range = chapterTitle
    ? chapterRange(specHtml, chapterTitle)
    : { from: 0, to: specHtml.length };
  if (!range) return null;
  const re = /<h(\d)[^>]*>([\s\S]*?)<\/h\1>/g;
  re.lastIndex = range.from;
  let m;
  while ((m = re.exec(specHtml)) !== null) {
    if (m.index >= range.to) break;
    if (m[2] === title) {
      return { level: Number(m[1]), start: m.index, contentAfter: m.index + m[0].length, raw: m[0] };
    }
  }
  return null;
}

module.exports = { chapterRange, findHeading, sectionEnd };

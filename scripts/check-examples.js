'use strict';

// Checks that every `Example #n:` line in this pack's step definitions
// matches exactly one step (its own, and none of webship-js's core steps),
// and that every step in tests/features is defined once. Run it with
// `npm run test:examples`; it exits non-zero when an example or a feature
// step has drifted away from its regex.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PACK_DIR = path.join(ROOT, 'tests/step-definitions');
const FEATURE_DIR = path.join(ROOT, 'tests/features');
const CORE_DIR = path.join(ROOT, 'node_modules/webship-js/tests/step-definitions');

function cucumberExprToRegex(expr) {
  let s = expr.replace(/[.*+?^$|[\]\\]/g, '\\$&');
  s = s.replace(/\(([^)]*)\)/g, '(?:$1)?');
  s = s.replace(/\b(\w+(?:\/\w+)+)\b/g, (m) => '(?:' + m.split('/').join('|') + ')');
  s = s.replace(/\{string\}/g, '(?:"[^"]*"|\'[^\']*\')');
  s = s.replace(/\{int\}/g, '-?\\d+');
  s = s.replace(/\{float\}/g, '-?\\d*\\.?\\d+');
  s = s.replace(/\{word\}/g, '[^\\s]+');
  s = s.replace(/\{\}/g, '.*');
  return new RegExp('^' + s + '$');
}

function extractDefs(src, file) {
  const defs = [];
  const re = /(?:^|\n)[ \t]*(Given|When|Then|defineStep)\(\s*(?:\/((?:\\\/|[^\/\n])+)\/([a-z]*)|'((?:\\'|[^'\n])*)'|"((?:\\"|[^"\n])*)"|`([^`\n]*)`)/g;
  let m;
  while ((m = re.exec(src))) {
    const line = src.slice(0, m.index).split('\n').length + (m[0].startsWith('\n') ? 1 : 0);
    let regex = null;
    let text;
    if (m[2] !== undefined) {
      text = '/' + m[2] + '/' + m[3];
      try { regex = new RegExp(m[2], m[3]); } catch (e) { regex = null; }
    } else {
      text = m[4] ?? m[5] ?? m[6];
      try { regex = cucumberExprToRegex(text); } catch (e) { regex = null; }
    }
    const before = src.slice(0, m.index);
    const docEnd = before.lastIndexOf('*/');
    const examples = [];
    if (docEnd !== -1 && /^\s*$/.test(before.slice(docEnd + 2))) {
      const docStart = before.lastIndexOf('/**', docEnd);
      if (docStart !== -1) {
        for (const l of before.slice(docStart, docEnd + 2).split('\n')) {
          const em = l.match(/Example\s*#?\d*\s*:\s*(.*)$/);
          if (em) examples.push(em[1].trim());
        }
      }
    }
    defs.push({ file, line, keyword: m[1], text, regex, examples });
  }
  return defs;
}

function loadDefs(dir, label) {
  if (!fs.existsSync(dir)) return [];
  let defs = [];
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.js'))) {
    defs = defs.concat(extractDefs(fs.readFileSync(path.join(dir, f), 'utf8'), label + f));
  }
  return defs;
}

const stripKeyword = (s) => s.replace(/^(Given|When|Then|And|But|\*)\s+/, '').trim();

const packDefs = loadDefs(PACK_DIR, '');
const coreDefs = loadDefs(CORE_DIR, 'core/');
const all = packDefs.concat(coreDefs).filter((d) => d.regex);
let problems = 0;

for (const d of packDefs) {
  if (!d.regex) { console.log(`${d.file}:${d.line} regex failed to compile`); problems++; continue; }
  if (d.examples.length < 5) { console.log(`${d.file}:${d.line} has ${d.examples.length} Example line(s); five are expected`); problems++; }
  for (const ex of d.examples) {
    const body = stripKeyword(ex);
    const hits = all.filter((o) => o.regex.test(body));
    if (!d.regex.test(body)) { console.log(`${d.file}:${d.line} example does not match its own step: "${ex}"`); problems++; }
    if (hits.length > 1) { console.log(`${d.file}:${d.line} example is ambiguous (${hits.map((h) => h.file + ':' + h.line).join(', ')}): "${ex}"`); problems++; }
  }
}

let total = 0;
for (const f of fs.readdirSync(FEATURE_DIR).filter((f) => f.endsWith('.feature'))) {
  fs.readFileSync(path.join(FEATURE_DIR, f), 'utf8').split('\n').forEach((l, i) => {
    const m = l.match(/^\s*(Given|When|Then|And|But)\s+(.*)$/);
    if (!m) return;
    total++;
    const hits = all.filter((d) => d.regex.test(m[2].trim()));
    if (hits.length === 0) { console.log(`UNDEFINED ${f}:${i + 1} ${l.trim()}`); problems++; }
    if (hits.length > 1) { console.log(`AMBIGUOUS ${f}:${i + 1} ${l.trim()} -> ${hits.map((h) => h.file + ':' + h.line).join(' | ')}`); problems++; }
  });
}

console.log(`${packDefs.length} step definitions, ${packDefs.reduce((n, d) => n + d.examples.length, 0)} examples, ${total} feature steps, ${problems} problem(s)`);
process.exit(problems ? 1 : 0);

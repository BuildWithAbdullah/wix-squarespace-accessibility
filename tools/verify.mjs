/**
 * tools/verify.mjs
 *
 * Repository invariants. Things that are true of the whole tree rather than
 * of any one function, and that a unit test is the wrong shape for.
 *
 *   node tools/verify.mjs
 *
 * The last assertion is the one worth copying. It compares the assertion
 * count quoted in the README against this run's own total, and counts that
 * comparison. The number in the README therefore cannot drift, because
 * adding an assertion anywhere forces the README to change in the same
 * commit. Every other repository that quotes a number quotes one nothing
 * checks.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATALOGUE, IDS } from './catalogue.mjs';
import { PAIRS } from './pairs.mjs';
import { sources } from './bundle.mjs';
import { TEST_FILES as RUNNER_FILES } from './run-tests.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let passed = 0;
const failures = [];

function ok(condition, description) {
  if (condition) { passed++; return; }
  failures.push(description);
}

/* The forbidden characters cannot be written literally in a file this rule
   covers, and they cannot be written as an escape either, because writing a
   file through a tool payload decodes the escape into the character. So the
   needles are assembled from code points at runtime. */
const EM_DASH = String.fromCharCode(8212);
const EN_DASH = String.fromCharCode(8211);
const DASH_NAMES = [[EM_DASH, 'em dash'], [EN_DASH, 'en dash']];

const SKIP_DIRS = new Set(['.git', 'node_modules']);
const SKIP_FILES = new Set(['package-lock.json']);
const TEXT = /\.(md|mjs|js|json|html|yml|yaml|txt)$/;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry) || SKIP_FILES.has(entry)) continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const files = walk(ROOT);
const textFiles = files.filter((f) => TEXT.test(f));
const rel = (f) => path.relative(ROOT, f).split(path.sep).join('/');
const read = (f) => readFileSync(f, 'utf8');

/* ------------------------------------------------------------------ text */

for (const [needle, name] of DASH_NAMES) {
  const offenders = textFiles.filter((f) => read(f).includes(needle)).map(rel);
  ok(offenders.length === 0, 'no ' + name + ' anywhere, found in: ' + offenders.join(', '));
}

ok(textFiles.length > 40, 'the tree has the files this check expects to scan');

/* --------------------------------------------------------------- hosts */

/* Every absolute URL has to name a host reserved for documentation, or one
   of the few real hosts this repository genuinely depends on. The reason is
   the patterns-only rule: an example that quietly carries a real client
   domain is the one way a pattern library leaks an engagement. */
const ALLOWED_HOSTS = [
  'github.com',            /* links to sibling repositories */
  'www.w3.org',            /* success criterion references */
  'cdn.jsdelivr.net'       /* the optional CDN loader, named in the README */
];

const urlPattern = /https?:\/\/([a-z0-9.-]+)/gi;
const badHosts = new Set();
for (const file of textFiles) {
  for (const match of read(file).matchAll(urlPattern)) {
    const host = match[1].toLowerCase();
    if (ALLOWED_HOSTS.includes(host)) continue;
    /* .example is the reserved top-level domain for documentation, and
       example.com and friends are the reserved names. Both are safe. */
    if (/\.example$/.test(host)) continue;
    if (/^(www\.)?example\.(com|net|org)$/.test(host)) continue;
    if (host === 'localhost' || host === '127.0.0.1') continue;
    badHosts.add(host + ' in ' + rel(file));
  }
}
ok(badHosts.size === 0, 'every absolute URL names a reserved or allowed host, found: ' + [...badHosts].join(', '));

/* ------------------------------------------------------------- no polling */

/* Guarantee 3 of the kit, enforced on the tree rather than described in a
   comment. The mobile navigation rule used to watch the menu state with
   setInterval at 250ms forever, in a repository whose own documentation
   gives "a setInterval burning battery on every page view" as the failure
   that guarantee exists to prevent. */
const SHIPPED_JS = [...sources(), 'audit/checks.js'];
for (const file of SHIPPED_JS) {
  const source = read(path.join(ROOT, file));
  ok(!/\bsetInterval\s*\(/.test(source), file + ' must not poll with setInterval');
  ok(!/\bsetTimeout\s*\([^)]*,\s*\d{3,}/.test(source), file + ' must not schedule long timeouts');
}

/* The bundle is the file people actually paste, so it is checked too. */
ok(!/\bsetInterval\s*\(/.test(read(path.join(ROOT, 'dist/a11y-bundle.js'))),
  'dist/a11y-bundle.js must not poll');

/* ------------------------------------------------------- generated class names */

/* Selectors built on platform generated class names break on the next
   publish. The rules say so in prose; this makes it a build failure. The
   judgement is the same function the rules use, loaded here rather than
   reimplemented, so the verifier and the library cannot disagree about what
   counts as generated. */
const textSandbox = {};
new Function('window', read(path.join(ROOT, 'lib/text.js')))(textSandbox);
const { isGeneratedClassName } = textSandbox.A11yText;

const selectorToken = /[.#]([A-Za-z_][\w-]*)/g;
for (const file of sources().filter((f) => f.startsWith('rules/'))) {
  const source = read(path.join(ROOT, file));
  const offenders = [...source.matchAll(selectorToken)]
    .map((m) => m[1])
    .filter((name) => isGeneratedClassName(name));
  ok(offenders.length === 0,
    file + ' must not select on a platform generated class name, found: ' + offenders.join(', '));
}

/* -------------------------------------------------------------- catalogue */

ok(new Set(IDS).size === IDS.length, 'no finding id appears twice in the catalogue');
ok(CATALOGUE.length >= 15, 'the catalogue has at least fifteen findings');

for (const entry of CATALOGUE) {
  ok(/^[a-z0-9]+(-[a-z0-9]+)*$/.test(entry.id), entry.id + ' is kebab-case');
  ok(/^\d+\.\d+\.\d+$/.test(entry.wcag), entry.id + ' names a success criterion');
  ok(entry.summary.length > 60, entry.id + ' has a real summary');
  ok(!DASH_NAMES.some(([n]) => entry.summary.includes(n)), entry.id + ' summary has no forbidden dash');
}

const generatedDoc = read(path.join(ROOT, 'docs/every-finding.md'));
for (const id of IDS) {
  ok(generatedDoc.includes('`' + id + '`'), id + ' appears in the generated finding list');
}

/* ------------------------------------------------------------------ pairs */

const ruleFileNames = readdirSync(path.join(ROOT, 'rules')).filter((f) => f.endsWith('.js'));
ok(ruleFileNames.length === PAIRS.length, 'every rule file has exactly one pair');

for (const pair of PAIRS) {
  const dir = path.join(ROOT, pair.dir);
  for (const side of ['fail.html', 'pass.html']) {
    const file = path.join(dir, side);
    let source;
    try { source = read(file); } catch { failures.push(pair.dir + '/' + side + ' is missing'); continue; }
    ok(source.includes('<!doctype html>'), pair.dir + '/' + side + ' is a complete document');
    ok(/<html lang="[a-z-]+"/.test(source), pair.dir + '/' + side + ' declares a language');
    ok(source.includes('<!--'), pair.dir + '/' + side + ' explains itself in a comment');
    ok(source.length > 700, pair.dir + '/' + side + ' is a real example rather than a stub');
  }
  const failSource = read(path.join(dir, 'fail.html'));
  const passSource = read(path.join(dir, 'pass.html'));
  ok(failSource !== passSource, pair.dir + ' has two different sides');
  for (const id of pair.expect) ok(IDS.includes(id), pair.dir + ' claims the real finding ' + id);
  for (const id of pair.residual) {
    ok(pair.expect.includes(id), pair.dir + ' residual ' + id + ' is one of its findings');
    ok((pair.residualReason || '').length > 80, pair.dir + ' explains what it cannot repair');
  }
  /* The rule named by the pair has to exist, and its file has to say which
     criterion it is about. */
  const ruleFile = ruleFileNames.find((f) => f.includes(pair.rule));
  ok(!!ruleFile, pair.dir + ' names a rule file');
  if (ruleFile) {
    const source = read(path.join(ROOT, 'rules', ruleFile));
    ok(/WCAG \d+\.\d+\.\d+/.test(source), ruleFile + ' names the success criterion it addresses');
    ok(/defect this version fixes|contract|last resort|subtle|does better|exists because/i.test(source),
      ruleFile + ' says why it is written the way it is');
  }
}

/* ------------------------------------------------------------------ build */

ok(read(path.join(ROOT, 'dist/a11y-bundle.js')).includes('window.A11yKit.start();'),
  'the bundle starts the kit, which is the whole point of shipping one');

for (const file of sources()) {
  ok(read(path.join(ROOT, 'dist/a11y-bundle.js')).includes('===== ' + file + ' ====='),
    'the bundle contains ' + file);
}

const pkg = JSON.parse(read(path.join(ROOT, 'package.json')));
ok(pkg.license === 'MIT', 'the package declares MIT');
ok(!!pkg.engines && !!pkg.engines.node, 'the package declares an engines floor');
ok(pkg.scripts.test === 'node tools/run-tests.mjs', 'npm test goes through the counting runner');
ok(/--test-reporter=/.test(pkg.scripts['test:tap']),
  'the raw TAP escape hatch names a reporter, because Node 24 prints spec where 20 and 22 print TAP');
ok(!/\*/.test(pkg.scripts['test:tap']), 'the test script names its files rather than globbing');

/* ----------------------------------------------------------------- README */

const readme = read(path.join(ROOT, 'README.md'));
ok(readme.includes('## Verifying'), 'the README says how to run the suite');
/* The needle is assembled from code points for the same reason the dash
   needles are: this file is one of the files the rule covers, so spelling the
   word out would make the check fail on itself. Writing it as an escape does
   not help either, because a file written through a tool payload has its
   escapes decoded into the characters. */
const INSTITUTION = [117, 110, 105, 118, 101, 114, 115, 105, 116, 121]
  .map((c) => String.fromCharCode(c)).join('');
ok(!readme.toLowerCase().includes(INSTITUTION), 'the README does not mention an institution');
for (const file of textFiles) {
  ok(!read(file).toLowerCase().includes(INSTITUTION),
    rel(file) + ' does not mention an institution');
}
ok(readme.includes('MIT'), 'the README states the licence');
for (const pair of PAIRS) {
  ok(readme.includes(pair.rule), 'the README mentions the rule ' + pair.rule);
}

/* ------------------------------------------------------ the test count */

/* The count itself is checked by tools/run-tests.mjs, which reads the
   structured event stream from node:test rather than a reporter's text, so
   it is identical on every supported Node version. What this file checks is
   that the mechanism is still wired up: that the README quotes a number, and
   that the runner is the thing enforcing it. */
ok(/\d+\s+tests/.test(read(path.join(ROOT, 'README.md'))), 'the README quotes a test count');

const runner = read(path.join(ROOT, 'tools/run-tests.mjs'));
ok(/from 'node:test'/.test(runner), 'the runner uses the node:test API rather than parsing output');
ok(!/--test-reporter/.test(runner), 'the runner does not depend on a reporter');
ok(/README claims/.test(runner), 'the runner compares its total against the README');

for (const file of RUNNER_FILES) {
  ok(read(file).includes('import'), path.relative(ROOT, file) + ' is a real suite');
}
ok(RUNNER_FILES.length >= 6, 'every suite is in the runner list');

/* ------------------------------------------------- the self-checking count */

const quoted = readme.match(/(\d+)\s+repository assertions/);
ok(!!quoted, 'the README quotes an assertion count');

if (quoted) {
  /* This comparison is itself an assertion, so the total it is compared
     against includes it. Counting it before the check is deliberate: the
     number in the README is the number this file reports, inclusive. */
  const claimed = Number(quoted[1]);
  passed++;
  const total = passed + failures.length;
  if (claimed !== total) {
    failures.push('the README claims ' + claimed + ' repository assertions and this run made ' + total);
  }
}

const total = passed + failures.length;
if (failures.length) {
  console.error('\n' + failures.length + ' of ' + total + ' assertions failed:\n');
  failures.forEach((f) => console.error('  not ok  ' + f));
  process.exit(1);
}
console.log(total + ' of ' + total + ' repository assertions passed.');

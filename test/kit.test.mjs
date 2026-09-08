/**
 * kit.test.mjs
 *
 * The injection kit makes four promises. Three of them are testable in a
 * browser, so they are tested rather than asserted in a README.
 *
 *   1. It repairs elements that need repair.
 *   2. It is idempotent: repeated passes never apply a fix twice.
 *   3. It is non-destructive: elements that already have a correct accessible
 *      name are left untouched.
 *   4. It catches content added after first paint, which is the whole reason
 *      it exists on a platform that re-renders.
 *
 * Run:  npm install && npm test
 */

import puppeteer from 'puppeteer';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = pathToFileURL(path.join(HERE, 'fixture.html')).href;

const results = [];
function check(name, condition, detail) {
  results.push({ name, ok: !!condition, detail });
}

const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.goto(FIXTURE, { waitUntil: 'load' });
await new Promise((r) => setTimeout(r, 100));

// 1. Repairs what needs repairing.
const unnamed = await page.$eval('#unnamed', (el) => el.textContent.trim());
check('names an unnamed button', unnamed === 'Named by kit', `got "${unnamed}"`);

// 3. Non-destructive.
const namedText = await page.$eval('#named-text', (el) => el.textContent.trim());
check('leaves a button with visible text alone', namedText === 'Checkout', `got "${namedText}"`);

const namedLabel = await page.$eval('#named-label', (el) => ({
  text: el.textContent.trim(),
  label: el.getAttribute('aria-label')
}));
check(
  'leaves an existing aria-label alone',
  namedLabel.text === '' && namedLabel.label === 'Existing label',
  JSON.stringify(namedLabel)
);

// 4. Catches content added after first paint.
await page.evaluate(() => window.__addLate());
await new Promise((r) => setTimeout(r, 200));
const late = await page.$eval('#late-btn', (el) => el.textContent.trim());
check('names a button added after first paint', late === 'Named by kit', `got "${late}"`);

// 2. Idempotent, even under repeated forced passes.
await page.evaluate(() => {
  for (let i = 0; i < 25; i++) window.A11yKit.refresh();
});
await new Promise((r) => setTimeout(r, 100));

const afterRepeat = await page.$eval('#unnamed', (el) => ({
  text: el.textContent.trim(),
  spans: el.querySelectorAll('span').length
}));
check(
  'does not apply a fix twice across 25 further passes',
  afterRepeat.spans === 1 && afterRepeat.text === 'Named by kit',
  JSON.stringify(afterRepeat)
);

// The report diagnostic should reflect real work, not passes.
const report = await page.evaluate(() => window.A11yKit.report());
check(
  'report counts elements touched, not passes',
  report.rules['name-buttons'] === 2,
  `touched ${report.rules['name-buttons']}, passes ${report.passes}`
);

await browser.close();

let failed = 0;
for (const r of results) {
  console.log(`${r.ok ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'}  ${r.name}`);
  if (!r.ok) { console.log(`      ${r.detail}`); failed++; }
}
console.log(`\n${results.length - failed}/${results.length} passing`);
process.exit(failed ? 1 : 0);

/**
 * test/bundle.test.mjs
 *
 * dist/a11y-bundle.js is the only file most people who use this repository
 * will ever read, because it is the thing that gets pasted into the code
 * injection box. A stale bundle would ship exactly the defects this suite
 * exists to prevent, and it would do so while every other test stayed green.
 *
 * So the bundle is tested the way the sources are: it is loaded into a real
 * page, and the same pairs are graded through it.
 */

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { build, sources } from '../tools/bundle.mjs';
import { PAIRS } from '../tools/pairs.mjs';
import { ABSENCE_IDS } from '../tools/catalogue.mjs';
import { getBrowser, closeBrowser, ROOT, idsOf, LIB_FILES, ruleFiles } from './harness.mjs';
import { runBehaviour } from '../audit/behaviour.mjs';
import { pathToFileURL } from 'node:url';

after(closeBrowser);

test('the committed bundle matches its sources', () => {
  const onDisk = readFileSync(path.join(ROOT, 'dist', 'a11y-bundle.js'), 'utf8');
  assert.equal(onDisk, build(), 'dist/a11y-bundle.js is out of date. Run: npm run bundle');
});

test('the bundle loads every source, in the order a browser needs them', () => {
  assert.deepEqual(sources(), [...LIB_FILES, ...ruleFiles()],
    'tools/bundle.mjs and test/harness.mjs disagree about load order, so the suite is not testing what ships');
});

test('the bundle registers exactly the rules that ship', async () => {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent('<!doctype html><html lang="en"><body><main></main></body></html>');
    await page.addScriptTag({ path: path.join(ROOT, 'dist', 'a11y-bundle.js') });
    const names = await page.evaluate(() => window.A11yKit.ruleNames());
    assert.deepEqual([...names].sort(), PAIRS.map((p) => p.rule).sort());
  } finally { await page.close(); }
});

test('the bundle earns the same grade on every failing example as the sources do', async () => {
  const browser = await getBrowser();
  for (const pair of PAIRS) {
    const page = await browser.newPage();
    try {
      await page.setViewport({ width: 480, height: 800 });
      await page.goto(pathToFileURL(path.join(ROOT, pair.dir, 'fail.html')).href, { waitUntil: 'load' });
      await page.evaluate(() => {
        window.__activations = 0;
        document.addEventListener('click', () => { window.__activations++; }, true);
      });
      /* The bundle calls start() itself, which is the whole point of it. */
      await page.addScriptTag({ path: path.join(ROOT, 'dist', 'a11y-bundle.js') });
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      await page.addScriptTag({ path: path.join(ROOT, 'audit', 'checks.js') });

      const statics = await page.evaluate(() => window.A11yChecks.runStatic(document));
      const behavioural = await runBehaviour(page);
      const found = idsOf(statics.concat(behavioural)).filter((id) => !ABSENCE_IDS.includes(id));
      assert.deepEqual(found, [...pair.residual].sort(),
        `the bundle graded ${pair.dir} differently from the sources`);
    } finally { await page.close(); }
  }
});

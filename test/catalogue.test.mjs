/**
 * test/catalogue.test.mjs
 *
 * Every finding this repository documents has to be reachable, and every
 * finding it emits has to be documented.
 *
 * tools/catalogue.mjs is metadata and nothing else, which makes it exactly
 * the kind of list that is wrong within a month unless something compares it
 * against the code. So this file drives all fifteen findings out of real
 * calls to the real checks, against artefacts built to trigger them, and
 * asserts set equality in both directions. A check that can never fire and a
 * finding that is emitted but undocumented are both build failures.
 *
 * Before this existed, the eight example pairs drove eleven of the fifteen
 * checks. The other four had never been observed to fire at all.
 */

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { CATALOGUE, IDS, STATIC_IDS, BEHAVIOURAL_IDS, ABSENCE_IDS } from '../tools/catalogue.mjs';
import { BEHAVIOUR_IDS, runBehaviour } from '../audit/behaviour.mjs';
import { getBrowser, closeBrowser, grade, idsOf, openExample, ROOT } from './harness.mjs';

after(closeBrowser);

/* One artefact per static finding, each the smallest page that provokes it. */
const ARTEFACTS = {
  'page-lang-missing': '<html><head></head><body><main></main></body></html>',
  'main-landmark-missing': '<html lang="en"><body><p>No landmark here.</p></body></html>',
  'skip-link-missing': '<html lang="en"><body><main></main><a href="#x">Contact</a></body></html>',
  'skip-link-target-missing':
    '<html lang="en"><body><main id="real"></main><a href="#gone">Skip to content</a></body></html>',
  'control-unnamed': '<html lang="en"><body><main></main><button></button></body></html>',
  'image-control-unnamed':
    '<html lang="en"><body><main></main><a href="/x"><img src="p.png"></a></body></html>',
  'alt-is-filename': '<html lang="en"><body><main></main><img src="p.png" alt="DSC_0043.jpg"></body></html>',
  'iframe-unnamed': '<html lang="en"><body><main></main><iframe src="https://maps.example/x"></iframe></body></html>',
  'link-text-generic': '<html lang="en"><body><main></main><a href="/a">Read More</a></body></html>',
  'promoted-control-unreachable':
    '<html lang="en"><body><main></main><div role="button" aria-label="Next">x</div></body></html>',
  'announcement-close-inert':
    '<html lang="en"><body><main></main><div class="sqs-announcement-bar-close"></div></body></html>'
};

/* And one page per behavioural finding. These need a widget to grade and a
   keyboard to grade it with, so they borrow the failing examples. */
const BEHAVIOUR_ARTEFACTS = {
  'nav-focus-not-moved': 'examples/05-mobile-nav-focus/fail.html',
  'nav-focus-escapes': 'examples/05-mobile-nav-focus/fail.html',
  'nav-escape-key-dead': 'examples/05-mobile-nav-focus/fail.html',
  'promoted-control-key-dead': 'examples/07-gallery-controls/fail.html'
};

async function runStaticOn(markup) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent('<!doctype html>' + markup);
    for (const file of ['lib/text.js', 'lib/accessible-name.js', 'audit/checks.js']) {
      await page.addScriptTag({ path: path.join(ROOT, file) });
    }
    return await page.evaluate(() => window.A11yChecks.runStatic(document));
  } finally {
    await page.close();
  }
}

test('the catalogue has no duplicate ids and every entry is complete', () => {
  assert.equal(new Set(IDS).size, IDS.length, 'a finding id appears twice');
  for (const entry of CATALOGUE) {
    assert.match(entry.id, /^[a-z0-9]+(-[a-z0-9]+)*$/, `${entry.id} is not kebab-case`);
    assert.match(entry.wcag, /^\d+\.\d+\.\d+$/, `${entry.id} has no success criterion`);
    assert.ok(['static', 'behavioural'].includes(entry.kind), `${entry.id} has no kind`);
    assert.equal(typeof entry.absence, 'boolean', `${entry.id} does not say whether it is an absence finding`);
    assert.equal(typeof entry.scanner, 'boolean', `${entry.id} does not say whether a scanner finds it`);
    assert.ok(entry.summary.length > 60, `${entry.id} has no real summary`);
  }
});

test('the catalogue lists exactly the checks that exist', async () => {
  const browser = await getBrowser();
  const page = await browser.newPage();
  let staticIds;
  try {
    await page.setContent('<!doctype html><html lang="en"><body></body></html>');
    for (const file of ['lib/text.js', 'lib/accessible-name.js', 'audit/checks.js']) {
      await page.addScriptTag({ path: path.join(ROOT, file) });
    }
    staticIds = await page.evaluate(() => window.A11yChecks.ids);
  } finally { await page.close(); }

  assert.deepEqual([...staticIds].sort(), [...STATIC_IDS].sort(),
    'audit/checks.js and the catalogue disagree about the static checks');
  assert.deepEqual([...BEHAVIOUR_IDS].sort(), [...BEHAVIOURAL_IDS].sort(),
    'audit/behaviour.mjs and the catalogue disagree about the behavioural checks');
});

test('every artefact names a finding in the catalogue', () => {
  for (const id of Object.keys(ARTEFACTS)) assert.ok(IDS.includes(id), `${id} is not catalogued`);
  for (const id of Object.keys(BEHAVIOUR_ARTEFACTS)) assert.ok(IDS.includes(id), `${id} is not catalogued`);
});

test('every catalogued finding has an artefact that triggers it', () => {
  const covered = new Set([...Object.keys(ARTEFACTS), ...Object.keys(BEHAVIOUR_ARTEFACTS)]);
  const missing = IDS.filter((id) => !covered.has(id));
  assert.deepEqual(missing, [], 'these findings have nothing that drives them');
});

test('every static finding fires on its own artefact', async () => {
  for (const [id, markup] of Object.entries(ARTEFACTS)) {
    const fired = idsOf(await runStaticOn(markup));
    assert.ok(fired.includes(id), `${id} did not fire on the artefact written for it`);
  }
});

test('every behavioural finding fires on its own page', async () => {
  for (const [id, file] of Object.entries(BEHAVIOUR_ARTEFACTS)) {
    const page = await openExample(file);
    try {
      const fired = idsOf(await runBehaviour(page));
      assert.ok(fired.includes(id), `${id} did not fire on ${file}`);
    } finally { await page.close(); }
  }
});

test('nothing fires that the catalogue does not list', async () => {
  const seen = new Set();
  for (const markup of Object.values(ARTEFACTS)) {
    idsOf(await runStaticOn(markup)).forEach((id) => seen.add(id));
  }
  for (const file of new Set(Object.values(BEHAVIOUR_ARTEFACTS))) {
    idsOf(await grade(file)).forEach((id) => seen.add(id));
  }
  const undocumented = [...seen].filter((id) => !IDS.includes(id));
  assert.deepEqual(undocumented, [], 'a check emitted an id that is not in the catalogue');
});

test('the union of every artefact covers the whole catalogue', async () => {
  const seen = new Set();
  for (const markup of Object.values(ARTEFACTS)) {
    idsOf(await runStaticOn(markup)).forEach((id) => seen.add(id));
  }
  for (const file of new Set(Object.values(BEHAVIOUR_ARTEFACTS))) {
    const page = await openExample(file);
    try {
      idsOf(await runBehaviour(page)).forEach((id) => seen.add(id));
    } finally { await page.close(); }
  }
  assert.deepEqual([...seen].sort(), [...IDS].sort(),
    'set equality failed: the catalogue and the reachable findings are different sets');
});

test('exactly the findings flagged as absence findings fire on nothing', async () => {
  const fired = idsOf(await runStaticOn('<html lang="en"><body></body></html>'));
  /* lang is present here on purpose, so this asserts the other two and
     nothing else. A page with no content is not a page with no language. */
  const expected = ABSENCE_IDS.filter((id) => id !== 'page-lang-missing');
  assert.deepEqual(fired.sort(), expected.sort());
});

test('a finding claiming a scanner does not report it is one of the hard ones', () => {
  const invisible = CATALOGUE.filter((c) => !c.scanner).map((c) => c.id);
  /* Every behavioural finding must be in that set by definition: if an
     off the shelf scanner could see it, there would be no reason to drive a
     browser for it. */
  for (const id of BEHAVIOURAL_IDS) {
    assert.ok(invisible.includes(id), `${id} is behavioural and claims a scanner reports it`);
  }
  assert.ok(invisible.length >= 7, 'the point of this repository is the findings a scanner misses');
});

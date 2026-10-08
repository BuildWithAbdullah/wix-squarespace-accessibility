/**
 * test/pairs.test.mjs
 *
 * Three questions per pair, and the third is the one the repository is for.
 *
 *   1. The failing example fails, with exactly the findings it claims.
 *   2. The corrected example is clean of those findings.
 *   3. The shipped repair layer, injected into the failing example, earns
 *      the same grade as correcting the page at source would.
 *
 * Plus the guard that makes the first question mean anything: a failing
 * example has to produce at least one finding that is not an absence
 * finding, and every check has to stay silent on an empty document unless
 * it is one of the three that report absence. Without that guard, a blank
 * HTML file is a valid failing example for any pair, because
 * skip-link-missing and friends fire on nothing at all.
 */

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { PAIRS } from '../tools/pairs.mjs';
import { ABSENCE_IDS, IDS } from '../tools/catalogue.mjs';
import { grade, idsOf, openExample, closeBrowser, getBrowser } from './harness.mjs';

after(closeBrowser);

const nonAbsence = (findings) => idsOf(findings.filter((f) => !ABSENCE_IDS.includes(f.id)));

for (const pair of PAIRS) {
  test(`${pair.dir}: the failing example produces exactly its claimed findings`, async () => {
    const findings = await grade(`${pair.dir}/fail.html`);
    assert.deepEqual(nonAbsence(findings), [...pair.expect].sort(),
      `fail.html findings did not match tools/pairs.mjs for ${pair.rule}`);
  });

  test(`${pair.dir}: every claimed finding is a real finding id`, () => {
    for (const id of pair.expect) {
      assert.ok(IDS.includes(id), `${id} is not in the catalogue`);
      assert.ok(!ABSENCE_IDS.includes(id),
        `${id} is an absence finding and cannot be what a failing example proves`);
    }
    assert.ok(pair.expect.length > 0, 'a pair must claim at least one finding');
  });

  test(`${pair.dir}: the corrected example is clean`, async () => {
    const findings = await grade(`${pair.dir}/pass.html`);
    const ids = idsOf(findings);
    for (const id of pair.expect) {
      assert.ok(!ids.includes(id), `pass.html still reports ${id}`);
    }
  });

  test(`${pair.dir}: the repair layer leaves exactly the residual it claims`, async () => {
    const findings = await grade(`${pair.dir}/fail.html`, { withRules: true });
    assert.deepEqual(nonAbsence(findings), [...pair.residual].sort(),
      pair.residual.length
        ? `rule "${pair.rule}" should leave only ${pair.residual.join(', ')} behind`
        : `rule "${pair.rule}" should clear every finding on fail.html`);
  });

  test(`${pair.dir}: anything the repair cannot fix is explained`, () => {
    for (const id of pair.residual) {
      assert.ok(pair.expect.includes(id),
        `${id} is claimed as residual but the failing example never reports it`);
    }
    if (pair.residual.length) {
      assert.ok((pair.residualReason || '').length > 80,
        `${pair.rule} leaves findings behind and does not say why`);
    }
  });
}

test('a corrected example never gains a finding the failing one did not have', async () => {
  for (const pair of PAIRS) {
    const failed = new Set(idsOf(await grade(`${pair.dir}/fail.html`)));
    const passed = idsOf(await grade(`${pair.dir}/pass.html`));
    for (const id of passed) {
      assert.ok(failed.has(id),
        `${pair.dir}/pass.html introduces ${id}, which fail.html does not have`);
    }
  }
});

test('the repair layer never introduces a finding of its own', async () => {
  for (const pair of PAIRS) {
    const before = new Set(idsOf(await grade(`${pair.dir}/fail.html`)));
    const after = idsOf(await grade(`${pair.dir}/fail.html`, { withRules: true }));
    for (const id of after) {
      assert.ok(before.has(id),
        `running the rules on ${pair.dir}/fail.html introduced ${id}`);
    }
  }
});

test('only absence findings fire on an empty document', async () => {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent('<!doctype html><html><head></head><body></body></html>');
    for (const file of ['lib/text.js', 'lib/accessible-name.js', 'audit/checks.js']) {
      await page.addScriptTag({ path: new URL(`../${file}`, import.meta.url).pathname });
    }
    const findings = await page.evaluate(() => window.A11yChecks.runStatic(document));
    const fired = idsOf(findings);
    for (const id of fired) {
      assert.ok(ABSENCE_IDS.includes(id),
        `${id} fired on an empty document, so it is not reading the page`);
    }
    /* And the absence findings really do fire, otherwise the guard above is
       satisfied by a suite in which nothing works at all. */
    for (const id of ABSENCE_IDS) {
      assert.ok(fired.includes(id), `${id} is flagged as an absence finding and did not fire on an empty page`);
    }
  } finally {
    await page.close();
  }
});

test('a rule marker cannot be forged by a page attribute', async () => {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    /* The element carries data-a11y-announcement-close because that is the
       stable hook the rule selects on. Marker attributes used to live in the
       same namespace, so the rule read its own hook as "already handled" and
       skipped every element it was written for. Found by a failing pair, not
       by reading the code. */
    await page.setContent(`<!doctype html><html lang="en"><body><main></main>
      <div class="sqs-announcement-bar-close" data-a11y-announcement-close></div></body></html>`);
    for (const file of ['lib/text.js', 'lib/accessible-name.js', 'shared/a11y-injection-kit.js',
                        'rules/08-announcement-close.js', 'audit/checks.js']) {
      await page.addScriptTag({ path: new URL(`../${file}`, import.meta.url).pathname });
    }
    await page.evaluate(() => window.A11yKit.start());
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const touched = await page.evaluate(() => window.A11yKit.report().rules['announcement-close']);
    assert.equal(touched, 1, 'the rule skipped the only element it exists for');
    const ids = idsOf(await page.evaluate(() => window.A11yChecks.runStatic(document)));
    assert.ok(!ids.includes('announcement-close-inert'));
  } finally {
    await page.close();
  }
});

test('the naive filename-alt repair causes the finding the shipped rule avoids', async () => {
  /* The defect this proves was real and shipped. The previous rule cleared
     every filename alt unconditionally. On an image that is the only content
     of a link, that removes the link's entire accessible name, so a repair
     installed to fix 1.1.1 created a 4.1.2 failure. Here the naive repair is
     applied and graded, then the shipped one, and the two grades differ. */
  const naive = await openExample('examples/03-filename-alt/fail.html');
  try {
    await naive.evaluate(() => {
      document.querySelectorAll('img[alt]').forEach((img) => {
        if (window.A11yText.isFilenameAlt(img.getAttribute('alt'))) img.setAttribute('alt', '');
      });
    });
    const ids = idsOf(await naive.evaluate(() => window.A11yChecks.runStatic(document)));
    assert.ok(ids.includes('image-control-unnamed'),
      'the naive repair was expected to unname the link and did not');
    assert.ok(!ids.includes('alt-is-filename'),
      'the naive repair was expected to clear the alt finding it targets');
  } finally {
    await naive.close();
  }

  const shipped = idsOf(await grade('examples/03-filename-alt/fail.html', { withRules: true }));
  assert.ok(!shipped.includes('image-control-unnamed'),
    'the shipped rule reintroduced the regression it was rewritten to avoid');
});

test('every rule shipped in rules/ owns a pair, and every pair owns a rule', async () => {
  const page = await openExample('examples/02-unnamed-icon-controls/fail.html', { withRules: true });
  try {
    const shipped = await page.evaluate(() => window.A11yKit.ruleNames());
    assert.deepEqual([...shipped].sort(), PAIRS.map((p) => p.rule).sort());
  } finally {
    await page.close();
  }
});

/**
 * test/kit.test.mjs
 *
 * The five guarantees in shared/a11y-injection-kit.js, tested rather than
 * asserted. Three of these tests exist because the guarantee they describe
 * was not actually true.
 *
 * Guarantee 4 is the interesting one. The kit disconnected its observer for
 * the duration of a pass so that its own writes could not re-trigger it. That
 * solved re-entrancy by creating something worse: MutationObserver discards
 * its queue on disconnect, so any DOM the platform replaced during those few
 * milliseconds was never seen again. On a closed platform the thing most
 * likely to replace DOM in that exact window is the page transition that
 * caused the pass in the first place. The layer would quietly stop repairing
 * the parts of the page it was most needed on, and report that every rule had
 * run.
 */

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { getBrowser, closeBrowser, ROOT } from './harness.mjs';

after(closeBrowser);

const BLANK = '<!doctype html><html lang="en"><body><main id="m"></main></body></html>';

async function kitPage(markup = BLANK) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  await page.setContent(markup);
  for (const file of ['lib/text.js', 'lib/accessible-name.js', 'shared/a11y-injection-kit.js']) {
    await page.addScriptTag({ path: path.join(ROOT, file) });
  }
  return page;
}

const settle = (page) =>
  page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

test('guarantee 1: a rule never processes the same element twice', async () => {
  const page = await kitPage('<!doctype html><html lang="en"><body><main></main><button id="b"></button></body></html>');
  try {
    await page.evaluate(() => {
      window.A11yKit.rule('stamp', (root, mark, kit) => {
        root.querySelectorAll('button').forEach((el) => {
          if (mark(el)) return;
          const span = kit.create('span');
          span.textContent = 'named';
          el.appendChild(span);
        });
      }).start();
    });
    await settle(page);
    await page.evaluate(() => { for (let i = 0; i < 25; i++) window.A11yKit.refresh(); });
    await settle(page);

    const state = await page.evaluate(() => ({
      spans: document.querySelectorAll('#b span').length,
      touched: window.A11yKit.report().rules.stamp,
      passes: window.A11yKit.report().passes
    }));
    assert.equal(state.spans, 1, 'the fix was applied more than once');
    assert.equal(state.touched, 1, 'report counts elements touched, not passes');
    assert.ok(state.passes > 25, 'the passes really did run');
  } finally { await page.close(); }
});

test('guarantee 3: nothing in the kit polls', async () => {
  const page = await kitPage();
  try {
    const polled = await page.evaluate(async () => {
      let calls = 0;
      const realInterval = window.setInterval;
      window.setInterval = function (...args) { calls++; return realInterval.apply(window, args); };
      window.A11yKit.rule('noop', () => {}).start();
      await new Promise((r) => setTimeout(r, 300));
      window.setInterval = realInterval;
      return calls;
    });
    assert.equal(polled, 0, 'the kit started an interval');
  } finally { await page.close(); }
});

test('guarantee 4: a platform change made while the rules are writing is not lost', async () => {
  const page = await kitPage('<!doctype html><html lang="en"><body><main></main><div id="host"></div></body></html>');
  try {
    const seen = await page.evaluate(async () => {
      let injected = false;
      window.__named = 0;

      window.A11yKit.rule('name-buttons', (root, mark, kit) => {
        /* On the first pass, and only then, the platform replaces a region
           of the page while this rule is still running. The old kit had its
           observer disconnected at this exact moment and discarded the
           record, so the button below was never repaired and nothing ever
           looked at it again. */
        if (!injected) {
          injected = true;
          document.getElementById('host').innerHTML = '<button id="late"></button>';
        }
        root.querySelectorAll('button').forEach((el) => {
          if (mark(el)) return;
          const span = kit.create('span');
          span.textContent = 'named';
          el.appendChild(span);
          window.__named++;
        });
      }).start();

      await new Promise((r) => setTimeout(r, 400));
      return {
        lateNamed: !!document.querySelector('#late span'),
        named: window.__named
      };
    });
    assert.ok(seen.lateNamed, 'a mutation that landed during a pass was never picked up');
    assert.equal(seen.named, 1, 'exactly the one late button should have been named');
  } finally { await page.close(); }
});

test('guarantee 4: the layer does not re-trigger itself into a loop', async () => {
  const page = await kitPage('<!doctype html><html lang="en"><body><main></main><button id="b"></button></body></html>');
  try {
    const passes = await page.evaluate(async () => {
      window.A11yKit.rule('stamp', (root, mark, kit) => {
        root.querySelectorAll('button').forEach((el) => {
          if (mark(el)) return;
          el.appendChild(kit.create('span'));
        });
      }).start();
      await new Promise((r) => setTimeout(r, 400));
      return window.A11yKit.report().passes;
    });
    /* One pass for the boot, and at most one more if the insertion was seen.
       An un-owned insertion costs a pass; a loop costs hundreds. */
    assert.ok(passes <= 3, `the layer ran ${passes} times for one insertion`);
  } finally { await page.close(); }
});

test('guarantee 5: one rule throwing does not take the others down', async () => {
  const page = await kitPage('<!doctype html><html lang="en"><body><main></main><button id="b"></button></body></html>');
  try {
    const report = await page.evaluate(async () => {
      window.A11yKit
        .rule('explodes', () => { throw new Error('platform changed the DOM shape'); })
        .rule('still-runs', (root, mark) => {
          root.querySelectorAll('button').forEach((el) => { if (!mark(el)) el.setAttribute('data-ok', '1'); });
        })
        .start();
      await new Promise((r) => setTimeout(r, 200));
      return { report: window.A11yKit.report(), ok: !!document.querySelector('#b[data-ok]') };
    });
    assert.ok(report.ok, 'a later rule did not run after an earlier one threw');
    assert.equal(report.report.problems.length >= 1, true, 'the failure was not recorded');
    assert.equal(report.report.problems[0].rule, 'explodes');
  } finally { await page.close(); }
});

test('two rules cannot share a name', async () => {
  const page = await kitPage();
  try {
    /* Sharing a name means sharing a marker attribute, so the second rule
       silently skips every element the first one touched. Half a repair
       layer that reports itself as whole is the quietest failure available,
       so it is an error at registration. */
    const message = await page.evaluate(() => {
      try {
        window.A11yKit.rule('dup', () => {}).rule('dup', () => {});
        return null;
      } catch (err) { return err.message; }
    });
    assert.match(message || '', /duplicate rule name/);
  } finally { await page.close(); }
});

test('a rule name must be kebab-case', async () => {
  const page = await kitPage();
  try {
    for (const bad of ['Name_Controls', 'nameControls', 'name--controls', '-leading', 'trailing-']) {
      const message = await page.evaluate((name) => {
        try { window.A11yKit.rule(name, () => {}); return null; } catch (e) { return e.message; }
      }, bad);
      assert.match(message || '', /kebab-case/, `${bad} was accepted`);
    }
  } finally { await page.close(); }
});

test('a marker attribute lives outside the namespace rules select on', async () => {
  const page = await kitPage();
  try {
    const attrs = await page.evaluate(() => {
      document.body.innerHTML = '<main></main><div id="x" data-a11y-thing></div>';
      window.A11yKit.rule('thing', (root, mark) => {
        root.querySelectorAll('[data-a11y-thing]').forEach((el) => {
          if (mark(el)) return;
          el.setAttribute('data-repaired', '1');
        });
      }).start();
      return null;
    });
    await settle(page);
    const repaired = await page.evaluate(() => !!document.querySelector('#x[data-repaired]'));
    assert.ok(repaired, 'the rule read the page own attribute as its own marker and skipped the element');
    assert.equal(attrs, null);
  } finally { await page.close(); }
});

test('stop leaves the DOM as it is and ends the watching', async () => {
  const page = await kitPage('<!doctype html><html lang="en"><body><main></main><div id="host"></div></body></html>');
  try {
    const after = await page.evaluate(async () => {
      window.A11yKit.rule('stamp', (root, mark) => {
        root.querySelectorAll('button').forEach((el) => { if (!mark(el)) el.setAttribute('data-ok', '1'); });
      }).start();
      await new Promise((r) => setTimeout(r, 100));
      window.A11yKit.stop();
      document.getElementById('host').innerHTML = '<button id="late"></button>';
      await new Promise((r) => setTimeout(r, 200));
      return {
        lateRepaired: !!document.querySelector('#late[data-ok]'),
        hostStillThere: !!document.getElementById('host')
      };
    });
    assert.equal(after.lateRepaired, false, 'the kit kept working after stop');
    assert.ok(after.hostStillThere, 'stop must not undo anything');
  } finally { await page.close(); }
});

test('refresh during a pass is queued rather than dropped', async () => {
  const page = await kitPage();
  try {
    const passes = await page.evaluate(async () => {
      let first = true;
      window.A11yKit.rule('reenter', () => {
        if (!first) return;
        first = false;
        window.A11yKit.refresh();      /* lands while this very pass is running */
      }).start();
      await new Promise((r) => setTimeout(r, 300));
      return window.A11yKit.report().passes;
    });
    assert.ok(passes >= 2, 'the queued refresh never ran');
    assert.ok(passes < 50, 'the queued refresh turned into a loop');
  } finally { await page.close(); }
});

test('report names every registered rule, including ones that matched nothing', async () => {
  const page = await kitPage();
  try {
    const report = await page.evaluate(async () => {
      window.A11yKit.rule('matches-nothing', () => {}).rule('also-nothing', () => {}).start();
      await new Promise((r) => setTimeout(r, 100));
      return window.A11yKit.report();
    });
    /* A rule reporting 0 after a platform update is how these layers die:
       the selector stops matching and everything still looks fine. The
       diagnostic has to list the rule, not omit it. */
    assert.equal(report.rules['matches-nothing'], 0);
    assert.equal(report.rules['also-nothing'], 0);
    assert.deepEqual(Object.keys(report.rules), ['matches-nothing', 'also-nothing']);
  } finally { await page.close(); }
});

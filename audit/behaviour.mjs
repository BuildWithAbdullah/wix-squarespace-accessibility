/**
 * audit/behaviour.mjs
 *
 * The half of the audit that cannot be done by reading markup.
 *
 * Nothing in the DOM distinguishes a mobile navigation overlay that moves
 * focus from one that does not, or an element with role="button" that
 * responds to Enter from one that ignores it. The difference only exists in
 * what happens when a key is pressed, so these checks press the key and look
 * at what moved. That is why this repository drives a real browser rather
 * than parsing HTML, and it is the reason the four findings here are the ones
 * worth having: an automated scanner will never report any of them.
 *
 * Each check takes a Puppeteer page, restores the page to a known state
 * first, and returns an array of findings. A check that cannot run because
 * the page has no such widget returns an empty array, which is the same
 * answer as "this page is fine" and is deliberate: these checks grade a
 * widget, and a page without the widget has nothing to grade. Coverage of
 * the checks themselves is the job of test/catalogue.test.mjs, which drives
 * every one of them out of an artefact built to trigger it.
 */

const TOGGLE = '.header-burger-btn, .Mobile-bar-menu, [data-test="header-burger"], .burger, [data-a11y-nav-toggle]';
const OVERLAY = '.header-menu, .Mobile-overlay, .header-menu-nav, [data-a11y-nav-overlay]';

async function hasNav(page) {
  return page.evaluate(
    ([t, o]) => !!document.querySelector(t) && !!document.querySelector(o),
    [TOGGLE, OVERLAY]
  );
}

/* Close the menu and park focus somewhere outside it, so one check cannot
   leave the page in a state that decides the next one's answer. */
async function resetNav(page) {
  await page.evaluate(
    ([t, o]) => {
      const toggle = document.querySelector(t);
      const overlay = document.querySelector(o);
      if (!toggle || !overlay) return;
      if (toggle.getAttribute('aria-expanded') === 'true') toggle.click();
      document.body.focus?.();
      if (document.activeElement && document.activeElement !== document.body) {
        document.activeElement.blur();
      }
    },
    [TOGGLE, OVERLAY]
  );
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}

async function openNav(page) {
  await page.click(TOGGLE);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}

async function focusIsInsideOverlay(page) {
  return page.evaluate(
    (o) => {
      const overlay = document.querySelector(o);
      return !!(overlay && document.activeElement && overlay.contains(document.activeElement));
    },
    OVERLAY
  );
}

export const BEHAVIOUR_CHECKS = [
  {
    id: 'nav-focus-not-moved',
    wcag: '2.4.3',
    absence: false,
    async run(page) {
      if (!(await hasNav(page))) return [];
      await resetNav(page);
      await openNav(page);
      const inside = await focusIsInsideOverlay(page);
      await resetNav(page);
      return inside ? [] : [{ detail: 'opening the menu left focus outside the overlay' }];
    }
  },
  {
    id: 'nav-focus-escapes',
    wcag: '2.4.3',
    absence: false,
    async run(page) {
      if (!(await hasNav(page))) return [];
      await resetNav(page);
      await openNav(page);

      /* Walk forward further than the overlay has focusable items. A page
         that does not contain focus will have handed it to the content
         behind the overlay well before the loop ends. */
      const steps = await page.evaluate(
        (o) => document.querySelector(o).querySelectorAll('a[href], button, [tabindex]').length + 2,
        OVERLAY
      );
      let escaped = false;
      for (let i = 0; i < steps; i++) {
        await page.keyboard.press('Tab');
        if (!(await focusIsInsideOverlay(page))) { escaped = true; break; }
      }
      await resetNav(page);
      return escaped ? [{ detail: 'tabbing moved focus out of the open overlay' }] : [];
    }
  },
  {
    id: 'nav-escape-key-dead',
    wcag: '2.1.2',
    absence: false,
    async run(page) {
      if (!(await hasNav(page))) return [];
      await resetNav(page);
      await openNav(page);
      await page.keyboard.press('Escape');
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      const stillOpen = await page.evaluate(
        (t) => document.querySelector(t).getAttribute('aria-expanded') === 'true',
        TOGGLE
      );
      await resetNav(page);
      return stillOpen ? [{ detail: 'Escape did not close the open overlay' }] : [];
    }
  },
  {
    id: 'promoted-control-key-dead',
    wcag: '2.1.1',
    absence: false,
    async run(page) {
      /* Find every element that advertises a button role and can be focused,
         focus it, press Enter and then Space, and see whether the page
         reacted. The page records reactions on window.__activations, which
         the examples wire to their own click handlers: a control that is
         genuinely operable fires click from the keyboard, and one that was
         handed a role and a tab stop and nothing else does not. */
      const targets = await page.evaluate(() => {
        const out = [];
        document.querySelectorAll('[role="button"]').forEach((el, i) => {
          if (el.matches('button, a[href], input, select, textarea')) return;
          const tabindex = el.getAttribute('tabindex');
          if (tabindex === null || Number(tabindex) < 0) return;  /* unreachable: a different finding */
          el.setAttribute('data-a11y-probe', String(i));
          out.push(String(i));
        });
        return out;
      });

      const findings = [];
      for (const probe of targets) {
        const selector = `[data-a11y-probe="${probe}"]`;
        await page.evaluate(() => { window.__activations = 0; });
        await page.focus(selector);
        await page.keyboard.press('Enter');
        await page.keyboard.press(' ');
        await page.evaluate(() => new Promise((r) => requestAnimationFrame(r)));
        const fired = await page.evaluate(() => window.__activations || 0);
        if (fired === 0) {
          const what = await page.$eval(selector, (el) =>
            el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).trim().split(/\s+/)[0] : ''));
          findings.push({ detail: 'role="button" with a tab stop that ignores Enter and Space: ' + what });
        }
      }
      await page.evaluate(() => {
        document.querySelectorAll('[data-a11y-probe]').forEach((el) => el.removeAttribute('data-a11y-probe'));
      });
      return findings;
    }
  }
];

export const BEHAVIOUR_IDS = BEHAVIOUR_CHECKS.map((c) => c.id);

export async function runBehaviour(page) {
  const out = [];
  for (const check of BEHAVIOUR_CHECKS) {
    const findings = await check.run(page);
    findings.forEach((f) => out.push({ id: check.id, wcag: check.wcag, absence: !!check.absence, detail: f.detail }));
  }
  return out;
}

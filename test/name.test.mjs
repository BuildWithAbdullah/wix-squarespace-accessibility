/**
 * test/name.test.mjs
 *
 * The case table for lib/accessible-name.js.
 *
 * This file exists because of a defect rather than a principle. Five rules in
 * this repository each decided "is this control already named?" with their
 * own inline expression, and all five agreed on the same wrong answer: they
 * read textContent. A button whose only content is an image with correct alt
 * text has an empty textContent and a perfectly good name, so every one of
 * those rules treated it as unnamed and appended a second name to it. On a
 * real site the result is a control that announces "Close Close", produced by
 * the layer installed to fix naming.
 *
 * One implementation now answers that question, and this is the table that
 * holds it honest. The cases that must return a name matter as much as the
 * ones that must return nothing: a naming computation that is too generous
 * makes every unlabelled control on a site look labelled, which is the
 * quietest way to ship a clean report on a broken page.
 */

import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import { getBrowser, closeBrowser, ROOT } from './harness.mjs';
import path from 'node:path';

after(closeBrowser);

let page;

before(async () => {
  const browser = await getBrowser();
  page = await browser.newPage();
  await page.setContent('<!doctype html><html lang="en"><body></body></html>');
  for (const file of ['lib/text.js', 'lib/accessible-name.js']) {
    await page.addScriptTag({ path: path.join(ROOT, file) });
  }
});

async function nameOf(html, selector) {
  return page.evaluate(
    ([markup, sel]) => {
      document.body.innerHTML = markup;
      return window.A11yName.accessibleName(document.querySelector(sel));
    },
    [html, selector]
  );
}

const NAMED = [
  ['visible text', '<button id="t">Checkout</button>', 'Checkout'],
  ['aria-label', '<button id="t" aria-label="Close"></button>', 'Close'],
  ['aria-label beats content', '<button id="t" aria-label="Close">x</button>', 'Close'],
  ['aria-labelledby', '<span id="l">Open menu</span><button id="t" aria-labelledby="l"></button>', 'Open menu'],
  ['aria-labelledby beats aria-label',
    '<span id="l">Real</span><button id="t" aria-labelledby="l" aria-label="Wrong"></button>', 'Real'],
  ['aria-labelledby naming several elements',
    '<span id="a">Delete</span><span id="b">item</span><button id="t" aria-labelledby="a b"></button>', 'Delete item'],
  ['a descendant image alt, which is the defect this file exists for',
    '<button id="t"><img src="x.png" alt="Close"></button>', 'Close'],
  ['an svg title', '<button id="t"><svg><title>Cart</title></svg></button>', 'Cart'],
  ['title as a last resort', '<button id="t" title="Search"></button>', 'Search'],
  ['an iframe title', '<iframe id="t" title="Map of the studio"></iframe>', 'Map of the studio'],
  ['an image own alt', '<img id="t" src="x.png" alt="A loom">', 'A loom'],
  ['a submit input value', '<input id="t" type="submit" value="Send">', 'Send'],
  ['a wrapping label', '<label>Email <input id="t" type="text"></label>', 'Email'],
  ['a label pointing with for', '<label for="t">Postcode</label><input id="t" type="text">', 'Postcode'],
  ['nested text across elements', '<button id="t"><span>Add </span><em>to bag</em></button>', 'Add to bag'],
  ['whitespace collapsed', '<button id="t">  Read   More \n</button>', 'Read More']
];

for (const [label, html, expected] of NAMED) {
  test(`names a control by ${label}`, async () => {
    assert.equal(await nameOf(html, '#t'), expected);
  });
}

const UNNAMED = [
  ['an empty button', '<button id="t"></button>'],
  ['a button holding only an aria-hidden svg',
    '<button id="t"><svg aria-hidden="true"><path/></svg></button>'],
  ['a button holding an image with no alt', '<button id="t"><img src="x.png"></button>'],
  ['a button holding an image marked decorative', '<button id="t"><img src="x.png" alt=""></button>'],
  ['a button whose only content is hidden', '<button id="t"><span hidden>Close</span></button>'],
  ['a button whose only content is aria-hidden', '<button id="t"><span aria-hidden="true">Close</span></button>'],
  ['an aria-labelledby pointing at nothing', '<button id="t" aria-labelledby="gone"></button>'],
  ['an aria-label of only whitespace', '<button id="t" aria-label="   "></button>'],
  ['a non-breaking space', '<button id="t"> </button>'],
  ['an iframe with an empty title, which the old selector skipped',
    '<iframe id="t" title=""></iframe>'],
  ['an iframe with no title at all', '<iframe id="t" src="https://maps.example/x"></iframe>'],
  ['an unlabelled text input', '<input id="t" type="text">'],
  ['an image with no alt attribute', '<img id="t" src="x.png">']
];

for (const [label, html] of UNNAMED) {
  test(`reports no name for ${label}`, async () => {
    assert.equal(await nameOf(html, '#t'), '');
  });
}

test('a select is never named by its selected option', async () => {
  /* The failure this prevents is specific and was found in a sibling
     repository: an accessible name implementation that falls through to text
     content names every select on a site after whichever option happens to be
     selected, so every unlabelled select looks labelled and the report comes
     back clean. */
  const html = '<select id="t"><option>Small</option><option selected>Medium</option></select>';
  assert.equal(await nameOf(html, '#t'), '');
});

test('a labelled select takes the label and nothing else', async () => {
  const html = '<label for="t">Size</label><select id="t"><option selected>Medium</option></select>';
  assert.equal(await nameOf(html, '#t'), 'Size');
});

test('a form control inside a labelled control does not leak into its name', async () => {
  const html = '<button id="t">Filter <input type="text" value="indigo"></button>';
  assert.equal(await nameOf(html, '#t'), 'Filter');
});

test('an element decorated with a marker attribute is still named normally', async () => {
  const html = '<button id="t" data-a11y-done-name-controls aria-label="Close"></button>';
  assert.equal(await nameOf(html, '#t'), 'Close');
});

test('hasAccessibleName agrees with accessibleName on every case in the table', async () => {
  for (const [, html] of NAMED) {
    assert.equal(await page.evaluate(([m]) => {
      document.body.innerHTML = m;
      const el = document.querySelector('#t');
      return window.A11yName.hasAccessibleName(el) === (window.A11yName.accessibleName(el) !== '');
    }, [html]), true);
  }
  for (const [, html] of UNNAMED) {
    assert.equal(await page.evaluate(([m]) => {
      document.body.innerHTML = m;
      const el = document.querySelector('#t');
      return window.A11yName.hasAccessibleName(el) === false;
    }, [html]), true);
  }
});

test('accessibleName never returns anything but a string', async () => {
  for (const sel of ['#missing', 'body']) {
    const value = await page.evaluate((s) => {
      const el = document.querySelector(s);
      return typeof window.A11yName.accessibleName(el);
    }, sel);
    assert.equal(value, 'string');
  }
});

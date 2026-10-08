/**
 * test/text.test.mjs
 *
 * The one suite in this repository that needs no browser at all.
 *
 * lib/text.js holds the judgements that were previously written inline, and
 * slightly differently, in each rule: is this alt a filename, is this link
 * text generic, what is this control probably called. Those are string
 * decisions, so they are tested as string decisions, against a table of
 * cases including the ones that must come back false.
 *
 * The negative cases are the ones worth having. A filename test that is too
 * eager silently deletes somebody's real alt text, and that is a far more
 * expensive mistake than leaving a filename in place.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../lib/text.js', import.meta.url), 'utf8');
const sandbox = {};
new Function('window', source)(sandbox);
const T = sandbox.A11yText;

test('the module loads outside a browser', () => {
  assert.ok(T, 'lib/text.js must not depend on anything a browser provides');
  for (const fn of ['normalize', 'isFilenameAlt', 'isGenericLinkText', 'hintFor', 'isGeneratedClassName']) {
    assert.equal(typeof T[fn], 'function', `${fn} is missing`);
  }
});

test('normalize collapses the whitespace platform editors insert', () => {
  assert.equal(T.normalize('  Read   More \n'), 'Read More');
  assert.equal(T.normalize(' '), '', 'an element holding only a non-breaking space is not named');
  assert.equal(T.normalize(null), '');
  assert.equal(T.normalize(undefined), '');
  assert.equal(T.normalize(0), '0', 'a falsy value that is not empty is still content');
});

test('isFilenameAlt accepts filenames', () => {
  for (const alt of ['DSC_0043.JPG', 'hero-final-2.png', 'image.jpeg', 'logo.SVG',
                     'Screenshot_2026-10-08.webp', 'img001.gif', 'photo.avif']) {
    assert.ok(T.isFilenameAlt(alt), `${alt} should read as a filename`);
  }
});

test('isFilenameAlt refuses prose, which is the expensive direction to get wrong', () => {
  for (const alt of [
    'The studio team on the stairs at the summer party',
    'Figure 1. The site map.',
    'Our 2024 team photo',
    'A close up of indigo dye in a steel vat',
    '',
    '   ',
    'Autumn collection',
    'hero image final 2.png'      /* spaces mean a human typed it */
  ]) {
    assert.ok(!T.isFilenameAlt(alt), `${alt} must not be treated as a filename`);
  }
});

test('isGenericLinkText catches the summary block wording and its punctuation', () => {
  for (const text of ['Read More', 'read more', 'READ MORE', 'Learn more',
                      'Continue reading', 'Click here', 'More...', 'View more', 'Details']) {
    assert.ok(T.isGenericLinkText(text), `${text} should read as generic`);
  }
});

test('isGenericLinkText leaves a link that says what it is', () => {
  for (const text of ['Read more about indigo', 'Autumn collection', 'Book a fitting',
                      'Download the care guide', 'More cowbell', '']) {
    assert.ok(!T.isGenericLinkText(text), `${text} must not read as generic`);
  }
});

test('hintFor names what it recognises and refuses the rest', () => {
  assert.equal(T.hintFor('header-burger-btn'), 'Open menu');
  assert.equal(T.hintFor('sqs-announcement-bar-close'), 'Close');
  assert.equal(T.hintFor('gallery-arrow-left'), 'Previous');
  assert.equal(T.hintFor('lightbox-control-next'), 'Next');
  assert.equal(T.hintFor('header-cart icon'), 'Cart');
  /* No fallback, on purpose. An unidentifiable control is reported for a
     human to name, never guessed at, because a wrong name is harder to find
     than a missing one. */
  assert.equal(T.hintFor('sqs-block-x7f2c'), null);
  assert.equal(T.hintFor(''), null);
  assert.equal(T.hintFor(null), null);
});

test('hintFor resolves the overlapping case the ordering exists for', () => {
  /* A control whose hook names both a widget and the word close is a close
     button for that widget, so close is tested first. */
  assert.equal(T.hintFor('search-close-button'), 'Close');
  assert.equal(T.hintFor('menu-dismiss'), 'Close');
});

test('isGeneratedClassName recognises the names a selector must never use', () => {
  for (const name of ['_1a2b3c', '_rk8Hq2', 'Header-module__a1b2c3', 'wixui-button-8f3ad91']) {
    assert.ok(T.isGeneratedClassName(name), `${name} is generated and unusable as a selector`);
  }
  for (const name of ['header-burger-btn', 'summary-item', 'sqs-announcement-bar-close', '']) {
    assert.ok(!T.isGeneratedClassName(name), `${name} is a stable hook`);
  }
});

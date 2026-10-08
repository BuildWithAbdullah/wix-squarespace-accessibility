/**
 * tools/catalogue.mjs
 *
 * Every finding this repository can emit, in one list.
 *
 * It holds metadata only. The logic lives in audit/checks.js and
 * audit/behaviour.mjs, and the reason the ids are duplicated here is exactly
 * the reason test/catalogue.test.mjs exists: a list that nothing compares
 * against the code is a list that is wrong within a month. That test drives
 * every id out of a real call to a real check and asserts set equality in
 * both directions, so a check that can never fire and a finding that is
 * emitted but undocumented are both build failures.
 *
 * Fields
 *   id          the string the check reports
 *   wcag        the success criterion it maps to
 *   kind        static, read from the DOM, or behavioural, which has to
 *               press a key and watch what moves
 *   absence     true when the finding reports that something is not on the
 *               page at all. Such a finding fires on an empty document,
 *               correctly, which makes it useless as evidence that a failing
 *               example demonstrates its own defect. See test/pairs.test.mjs.
 *   scanner     whether an off the shelf automated scanner reports this
 *   summary     one line, used to generate docs/every-finding.md
 */

export const CATALOGUE = [
  {
    id: 'page-lang-missing', wcag: '3.1.1', kind: 'static', absence: true, scanner: true,
    summary: 'The html element carries no lang attribute, so a screen reader reads the page in the user default voice.'
  },
  {
    id: 'main-landmark-missing', wcag: '1.3.1', kind: 'static', absence: true, scanner: true,
    summary: 'The page has no main landmark, so there is nothing for a skip link or a landmark shortcut to target.'
  },
  {
    id: 'skip-link-missing', wcag: '2.4.1', kind: 'static', absence: true, scanner: false,
    summary: 'No link offers to skip past the repeated header. Neither platform emits one and neither has a setting for it.'
  },
  {
    id: 'skip-link-target-missing', wcag: '2.4.1', kind: 'static', absence: false, scanner: false,
    summary: 'A skip link exists and resolves to nothing, or to an element that cannot take focus. Both look exactly like a working skip link.'
  },
  {
    id: 'control-unnamed', wcag: '4.1.2', kind: 'static', absence: false, scanner: true,
    summary: 'An interactive control has no accessible name. Icon only header and gallery controls are the usual source.'
  },
  {
    id: 'image-control-unnamed', wcag: '4.1.2', kind: 'static', absence: false, scanner: true,
    summary: 'A control whose only possible name is an image, and the image has no alt. This is the state a repair layer creates for itself when it clears a filename alt without asking what the image is doing.'
  },
  {
    id: 'alt-is-filename', wcag: '1.1.1', kind: 'static', absence: false, scanner: false,
    summary: 'An image alt is the uploaded filename, which both editors prefill. It carries no information and is read out in full.'
  },
  {
    id: 'iframe-unnamed', wcag: '4.1.2', kind: 'static', absence: false, scanner: true,
    summary: 'An embedded frame has no title, so it is announced only as a frame. Naming it is the whole of what the parent page can do.'
  },
  {
    id: 'link-text-generic', wcag: '2.4.4', kind: 'static', absence: false, scanner: false,
    summary: 'A link name carries no purpose on its own. Summary blocks and blog grids produce a page of identical Read More links.'
  },
  {
    id: 'promoted-control-unreachable', wcag: '2.1.1', kind: 'static', absence: false, scanner: true,
    summary: 'An element advertises a button role and has no tab stop, so it is announced as a control nobody can reach.'
  },
  {
    id: 'announcement-close-inert', wcag: '4.1.2', kind: 'static', absence: false, scanner: false,
    summary: 'The announcement bar close control is unnamed, roleless or unreachable. It sits first in the tab order on every page of the site.'
  },
  {
    id: 'nav-focus-not-moved', wcag: '2.4.3', kind: 'behavioural', absence: false, scanner: false,
    summary: 'Opening the mobile overlay leaves focus behind it. Nothing in the markup distinguishes an overlay that moves focus from one that does not.'
  },
  {
    id: 'nav-focus-escapes', wcag: '2.4.3', kind: 'behavioural', absence: false, scanner: false,
    summary: 'Tabbing inside the open overlay walks out into the page underneath, which is still fully tabbable and invisible.'
  },
  {
    id: 'nav-escape-key-dead', wcag: '2.1.2', kind: 'behavioural', absence: false, scanner: false,
    summary: 'Escape does not close the open overlay, so a keyboard user who opens it has no documented way back.'
  },
  {
    id: 'promoted-control-key-dead', wcag: '2.1.1', kind: 'behavioural', absence: false, scanner: false,
    summary: 'An element has a button role and a tab stop and ignores Enter and Space. It announces an interaction it does not have, which is worse than being unreachable.'
  }
];

export const IDS = CATALOGUE.map((c) => c.id);

export const ABSENCE_IDS = CATALOGUE.filter((c) => c.absence).map((c) => c.id);

export const STATIC_IDS = CATALOGUE.filter((c) => c.kind === 'static').map((c) => c.id);

export const BEHAVIOURAL_IDS = CATALOGUE.filter((c) => c.kind === 'behavioural').map((c) => c.id);

export function byId(id) {
  return CATALOGUE.find((c) => c.id === id) || null;
}

/**
 * tools/pairs.mjs
 *
 * What each failing example is supposed to prove.
 *
 * `expect` is the exact set of finding ids the failing page must produce,
 * ignoring absence findings. The set is asserted both ways in
 * test/pairs.test.mjs: every id listed here has to fire, and no id outside
 * this list may fire. Listing the exact set rather than a minimum is what
 * stops an example quietly growing a second unrelated defect and still
 * looking like a clean demonstration of its first one.
 *
 * `residual` is the set of findings that survive the repair layer, and
 * listing it is the point rather than an admission. An injected layer cannot
 * fix everything, and the difference between a repository that says so in a
 * paragraph and one that says so in an assertion is the difference between a
 * claim and a fact. test/pairs.test.mjs asserts the set exactly: a rule that
 * starts fixing something listed here fails the build, and so does one that
 * stops fixing something not listed here.
 *
 * Absence findings are deliberately not listed. Three of the checks report
 * that something is missing from the page entirely, so they fire on a blank
 * file, and an example whose only finding is one of those has demonstrated
 * that it is empty rather than that its defect is present.
 */

export const PAIRS = [
  {
    dir: 'examples/01-skip-link-stale-target',
    rule: 'skip-link',
    title: 'A skip link whose target the platform replaced',
    expect: ['skip-link-target-missing']
  },
  {
    dir: 'examples/02-unnamed-icon-controls',
    rule: 'name-controls',
    title: 'Icon only header controls with no accessible name',
    expect: ['control-unnamed']
  },
  {
    dir: 'examples/03-filename-alt',
    rule: 'filename-alt',
    title: 'Alt text prefilled with the uploaded filename',
    expect: ['alt-is-filename'],
    residual: ['alt-is-filename'],
    residualReason:
      'One of the two filename alts is the only accessible name on a link. ' +
      'Clearing it would turn a 1.1.1 finding into a 2.4.4 and 4.1.2 one, so ' +
      'the rule refuses, marks the image and reports it. Nothing automatic can ' +
      'do better: no script knows where the link goes or what the picture ' +
      'shows. This finding is supposed to survive, and a human writing an alt ' +
      'in the editor is the only thing that clears it.'
  },
  {
    dir: 'examples/04-unnamed-iframe',
    rule: 'name-iframes',
    title: 'Embedded frames with no title, including an empty one',
    expect: ['iframe-unnamed']
  },
  {
    dir: 'examples/05-mobile-nav-focus',
    rule: 'mobile-nav-focus',
    title: 'Mobile overlay that never takes focus and ignores Escape',
    expect: ['nav-focus-not-moved', 'nav-focus-escapes', 'nav-escape-key-dead']
  },
  {
    dir: 'examples/06-generic-link-text',
    rule: 'summary-read-more',
    title: 'Summary block where every link says the same thing',
    expect: ['link-text-generic']
  },
  {
    dir: 'examples/07-gallery-controls',
    rule: 'gallery-controls',
    title: 'Lightbox controls with a button role and no button behaviour',
    expect: ['control-unnamed', 'promoted-control-unreachable', 'promoted-control-key-dead']
  },
  {
    dir: 'examples/08-announcement-bar',
    rule: 'announcement-close',
    title: 'Announcement bar close that is unnamed, roleless and unreachable',
    expect: ['announcement-close-inert']
  }
];

for (const pair of PAIRS) {
  if (!pair.residual) pair.residual = [];
}

export const RULE_NAMES = PAIRS.map((p) => p.rule);

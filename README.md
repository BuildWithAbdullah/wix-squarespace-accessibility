# Wix and Squarespace Accessibility

Tested accessibility repairs for sites where you cannot edit the markup.

Wix and Squarespace generate their own DOM. You get settings, you get a code
injection box, and that is the whole surface. Generic WCAG guidance assumes you
can change a template, so most of it does not apply, and the advice that does
apply is scattered across support articles that describe the settings and not
the failures.

This repository covers three things: what each platform lets you reach, how to
patch the rest without creating a maintenance liability, and where to stop.

## What is in it

Eight repair rules, each with a failing page and a corrected one, each driven
in a real browser. Fifteen catalogued findings, four of which cannot be
detected by reading markup at all. One accessible name computation that every
rule and every check shares. And a generated bundle that is the single file
you paste into the injection box.

| Directory | What it holds |
|---|---|
| [`rules/`](rules/) | The eight repairs, one file each, each naming the success criterion it addresses and the defect it was rewritten to remove |
| [`examples/`](examples/) | A failing and a corrected page per rule, with the fault explained in the file |
| [`audit/`](audit/) | The checks that grade a page. `checks.js` reads the DOM, `behaviour.mjs` presses keys |
| [`lib/`](lib/) | The accessible name computation and the string judgements the rules share |
| [`shared/`](shared/) | The injection engine, and the contract it has to meet |
| [`dist/`](dist/) | `a11y-bundle.js`, generated, the file you actually paste |
| [`docs/`](docs/) | Platform reach, testing method, every finding, and what none of this fixes |

## The four findings a scanner will never give you

Most of what this repository catches is ordinary. Four of the fifteen findings
are not, and they are the reason the suite drives a browser instead of parsing
HTML:

- `nav-focus-not-moved`, `nav-focus-escapes`, `nav-escape-key-dead`. The mobile
  overlay navigation, which is the most reliable finding on any site built on
  either platform. The menu opens full screen, focus is never moved into it,
  the page behind stays tabbable, and Escape does nothing. There is nothing in
  the markup that distinguishes this from an overlay that behaves correctly:
  the toggle has a role, a name and `aria-expanded`, and the overlay has links.
  The failure only exists in what happens on a key press.
- `promoted-control-key-dead`. An element with a button role and a tab stop
  that ignores Enter and Space. Somebody added the role and the tabindex and
  stopped there. It is worse than leaving the control unreachable, because an
  unreachable control is a failure the user detects in a second, and one that
  announces an interaction it does not have wastes their time and makes them
  doubt their own keyboard.

The full list, with which ones a scanner does report, is in
[`docs/every-finding.md`](docs/every-finding.md).

## Start here

**[What you can reach on a closed platform](docs/01-what-you-can-reach.md)**

Findings live in one of four layers: settings, content, injected code, or out
of reach. Which layer a finding lives in determines what the fix costs, whether
it survives a platform update, and whether it is possible at all. Work top
down. A fix made in the site editor belongs to the client permanently; the same
fix made in injected code is yours to maintain forever and will eventually
break silently.

## The injection kit

**[`shared/a11y-injection-kit.js`](shared/a11y-injection-kit.js)**

Closed platforms re-render: page transitions without a reload, lightboxes,
galleries, filters. A script that runs once on `DOMContentLoaded` has its work
discarded by the first interaction. So the repair layer has to run repeatedly,
which means it has to be safe to run repeatedly.

The kit makes five guarantees, and each one exists because of a specific way
these layers go wrong. All five are tested in `test/kit.test.mjs`, and three of
those tests exist because the guarantee was not actually true.

| Guarantee | Failure it prevents |
|---|---|
| Idempotent, via marker attributes | Hidden text appended forty times to the same link |
| Non-destructive, via one shared name computation | A correct `aria-label` overwritten with a guess from a class name |
| Observed, never polled, enforced by the verifier | A `setInterval` burning battery on every page view forever |
| Re-entrant safe without going blind | The layer missing the page transition that triggered it |
| Failures contained and visible | One broken rule taking the layer down, or half a layer reporting itself as whole |

Plus `A11yKit.report()`, which prints how many elements each rule touched. That
is the diagnostic for the failure nobody plans for: a platform update changes a
class name, the selector stops matching, and the layer keeps running and fixes
nothing while everything still looks fine.

Read [`shared/README.md`](shared/README.md) before using it.

## The rules

| Rule | Criterion | What it repairs |
|---|---|---|
| [`skip-link`](rules/01-skip-link.js) | 2.4.1 | Adds the skip link neither platform emits, and re-points one whose target a page transition replaced |
| [`name-controls`](rules/02-name-controls.js) | 4.1.2 | Names icon only header and gallery controls, and refuses to guess at ones it cannot identify |
| [`filename-alt`](rules/03-filename-alt.js) | 1.1.1 | Clears alt text that is the uploaded filename, except where doing so would unname a control |
| [`name-iframes`](rules/04-name-iframes.js) | 4.1.2 | Names embedded frames, including the ones carrying an empty title |
| [`mobile-nav-focus`](rules/05-mobile-nav-focus.js) | 2.1.2 | Moves focus into the mobile overlay, keeps it there, and makes Escape work |
| [`summary-read-more`](rules/06-summary-read-more.js) | 2.4.4 | Makes every Read More link in a summary block say what it leads to, without changing the visible wording |
| [`gallery-controls`](rules/07-gallery-controls.js) | 4.1.2, 2.1.1 | Names lightbox controls, and adds key handling at the same moment it adds a button role |
| [`announcement-close`](rules/08-announcement-close.js) | 4.1.2, 2.1.1 | Same, for the control that sits first in the tab order on every page of the site |

## Wix

[Platform notes](wix/README.md) and a ready-made
[Custom Code block](wix/custom-code-a11y.html).

Covers the settings pass, where Velo helps and where it cannot reach, why Wix
class names are unusable as selectors, the platform-controlled viewport tag,
and how to report platform JavaScript weight honestly rather than as an
accessibility finding.

## Squarespace

[Platform notes](squarespace/README.md),
[header injection](squarespace/code-injection-header.html) and
[footer injection](squarespace/code-injection-footer.html).

Covers 7.0 versus 7.1 and why it decides what is possible, Fluid Engine and
focus order, and the failures that recur on every Squarespace site: the mobile
overlay navigation that never takes focus, summary blocks where every link says
"Read More", unnamed lightbox controls, and the announcement bar that sits
first in the tab order on every page.

## Testing

**[Testing a closed platform](docs/02-testing-closed-platforms.md)**

Test the published site logged out, not the editor preview, because the admin
bar changes the DOM and the tab order. Select the WCAG 2.2 ruleset explicitly,
because axe defaults to 2.1 and will silently skip the entire 2.2 layer. Expect
the scanner to be quiet about the failures that matter most, and budget a
manual keyboard pass per template.

## What this repository will not do

It will not tell you an injected script makes a site compliant. It does not.
Injection is a repair for what a closed platform genuinely puts out of reach,
and the honest scope of any engagement on these platforms includes naming the
parts nobody can fix: cross-origin embeds, platform-controlled markup, and the
content the client will add next week.

That list is not a disclaimer, it is a document:
**[what the kit cannot reach](docs/03-what-the-kit-cannot-reach.md)**. One of
the eight examples is there precisely because the repair layer cannot fix it,
and the finding it leaves behind is asserted on every CI run. A repository that
only tests what it fixes is a repository that will quietly start claiming more
than it does.

The argument against overlays, which is the same argument taken to its
conclusion, is in
[shopify-accessibility-patterns](https://github.com/BuildWithAbdullah/shopify-accessibility-patterns/blob/main/docs/06-why-overlays-fail.md).

## Verifying

```bash
npm install
npm test          # 115 tests across 6 suites
npm run verify    # 328 repository assertions
```

Nothing is asserted here that is not checked. `npm test` drives a real browser
through every example, grades it with the same checks twice, and asserts that
the repair layer earns the grade that fixing the page at source would.
`npm run verify` checks the invariants that are properties of the tree rather
than of any function: no rule polls, no selector uses a platform generated
class name, every catalogued finding appears in the generated documentation,
every pair has both sides and explains itself, and no file contains a dash
character this repository does not use.

Two numbers in this README are checked against the code that produces them.
`npm test` compares its own total against the count above, using the structured
event stream from `node:test` rather than a reporter's output, so the number
cannot drift and the check behaves identically on every supported Node version.
`npm run verify` ends by comparing the assertion count above against its own
total, and counts that comparison. Adding an assertion anywhere forces this
file to change in the same commit.

```
115 of 115 tests passed across 6 suites.
328 of 328 repository assertions passed.
```

The generated files are checked too: `dist/a11y-bundle.js` against its sources,
`docs/every-finding.md` and `examples/README.md` against the catalogue. The
bundle is the only file most people who use this repository will ever read, so
a stale one would ship exactly the defects this suite exists to catch while
every other check stayed green.

## Related

- [wcag-fix-library](https://github.com/BuildWithAbdullah/wcag-fix-library) - failing and corrected patterns by success criterion, verified in CI
- [shopify-accessibility-patterns](https://github.com/BuildWithAbdullah/shopify-accessibility-patterns) - theme-level Liquid and JS
- [site-audit-cli](https://github.com/BuildWithAbdullah/site-audit-cli) - one command that audits a page for accessibility, Core Web Vitals, technical SEO and header security

## Standard

WCAG 2.2 Level AA.

## Licence

MIT.

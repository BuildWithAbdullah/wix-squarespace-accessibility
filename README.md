# Wix and Squarespace Accessibility

Platform-specific workarounds for sites where you cannot edit the markup.

Wix and Squarespace generate their own DOM. You get settings, you get a code
injection box, and that is the whole surface. Generic WCAG guidance assumes you
can change a template, so most of it does not apply, and the advice that does
apply is scattered across support articles that describe the settings and not
the failures.

This repository covers three things: what each platform lets you reach, how to
patch the rest without creating a maintenance liability, and where to stop.

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

The kit provides four guarantees, and each one exists because of a specific
way these layers go wrong:

| Guarantee | Failure it prevents |
|---|---|
| Idempotent, via marker attributes | Hidden text appended forty times to the same link |
| Non-destructive | A correct `aria-label` overwritten with a guess from a class name |
| Observed, not polled | A `setInterval` burning battery on every page view forever |
| Re-entrant safe | The layer triggering itself, in the worst case looping |

Plus `A11yKit.report()`, which prints how many elements each rule touched.
That is the diagnostic for the failure nobody plans for: a platform update
changes a class name, the selector stops matching, and the layer keeps running
and fixes nothing while everything still looks fine.

Read [`shared/README.md`](shared/README.md) before using it.

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

The argument against overlays, which is the same argument taken to its
conclusion, is in
[shopify-accessibility-patterns](https://github.com/BuildWithAbdullah/shopify-accessibility-patterns/blob/main/docs/06-why-overlays-fail.md).

## Related

- [wcag-fix-library](https://github.com/BuildWithAbdullah/wcag-fix-library) - failing and corrected patterns by success criterion, verified in CI
- [shopify-accessibility-patterns](https://github.com/BuildWithAbdullah/shopify-accessibility-patterns) - theme-level Liquid and JS

## Standard

WCAG 2.2 Level AA.

## Licence

MIT.

## Verifying the kit

```bash
npm install
npm test
```

The four guarantees above are tested rather than asserted. The suite checks
that the kit repairs what needs repairing, leaves elements that already have a
correct accessible name untouched, catches content added after first paint, and
does not apply a fix twice across repeated passes.

```
PASS  names an unnamed button
PASS  leaves a button with visible text alone
PASS  leaves an existing aria-label alone
PASS  names a button added after first paint
PASS  does not apply a fix twice across 25 further passes
PASS  report counts elements touched, not passes
```

The non-destructive test is the one that matters most. A repair layer that
overwrites correct values with guesses produces defects that are considerably
harder to trace than the ones it was written to fix.

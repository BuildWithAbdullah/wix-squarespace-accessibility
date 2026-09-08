# Testing a closed platform

Auditing Wix and Squarespace differs from auditing a site whose source you
control, in ways that change results if you get them wrong.

## Test the published site

Not the editor preview. Not while logged in.

Both platforms render differently inside their editor, and both inject an admin
bar when you are logged in. The admin bar changes the DOM, adds elements to the
tab order, and can suppress the very focus styles you are testing. Findings
from a preview are unreliable in both directions: you will see problems that do
not exist on the live site, and miss ones that do.

Use a private window, logged out, on the published URL.

## Test on a real device, not only an emulator

Pinch-zoom behaviour under 1.4.4 and touch target behaviour under 2.5.8 are
both device-level. Emulated mobile viewports in DevTools do not reproduce
either reliably.

This matters most on Wix, where the viewport meta tag is platform-controlled
and you need to record what actually happens rather than what the tag says.

## Select the right ruleset

axe DevTools defaults to WCAG 2.1. If the engagement is against 2.2, select
2.2 explicitly, or the whole 2.2 layer is silently skipped: 2.4.11 Focus Not
Obscured, 2.5.7 Dragging Movements and 2.5.8 Target Size will not be evaluated
at all, and the scan will look clean because it never asked.

Re-running a scan after noticing the wrong ruleset was selected is normal.
Reporting the first run is not.

## Expect the scanner to be quiet about the real problems

On a closed platform the highest-impact failures are concentrated in exactly
the area automated tooling cannot see:

- mobile overlay navigation that never takes focus
- lightboxes that cannot be closed with `Escape`
- absolute-positioned layouts where tab order and visual order diverge
- galleries and sliders built from non-interactive elements
- hidden menus left in the tab order behind a transform

None of these produce a finding. Budget a manual keyboard pass per template
and treat the scan as a starting point.

## Scan the same page more than once

If the site has an accessibility overlay or auto-patch script, scores drift
between identical scans depending on when the scan ran relative to the patch
pass. Two scans a minute apart that differ by several points, with no change to
the site, is the signature.

Disable the overlay and scan again. That is the real baseline, and the only one
that supports a before-and-after claim.

## Record what a before-and-after can honestly say

If no baseline scan was captured before remediation began, you cannot report a
delta. Report the verified after-state and say plainly that no before-state was
captured. Inventing or reconstructing a baseline is the fastest way to lose an
argument you would otherwise win, and the after-state figures are usually
strong enough on their own.

## Sample pages properly

For a site of any size, audit every template type rather than every page:

- home
- a standard content page
- a page with a form
- a page with a third-party embed
- a gallery or portfolio page
- blog listing and a blog article
- the 404 page
- the cover page, on Squarespace, which uses a different template entirely and
  is the one most often missed

Then spot-check pages within each type. Findings on a template repeat across
every page using it, so a template-level fix resolves them all at once.

## Note what only exists at certain viewports

The mobile navigation only exists below a breakpoint. The desktop mega menu
only exists above one. Test both. A keyboard pass at desktop width will never
encounter the single most reliable failure on a Squarespace site.

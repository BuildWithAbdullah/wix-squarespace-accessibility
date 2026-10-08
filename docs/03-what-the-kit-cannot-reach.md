# What the kit cannot reach

The paragraph that decides whether the rest of this repository is worth
trusting. Everything here is a thing the repair layer does not fix, cannot
fix, or fixes only in a way that needs saying out loud.

## It cannot fix anything inside a cross-origin frame

Booking widgets, map embeds, payment forms and video players arrive as
iframes from another origin. No script on the parent page can read or modify
a cross-origin document, so an unlabelled date field inside a booking widget
is as unreachable to this layer as it is to the client.

`name-iframes` gives the frame a name, which makes it findable and tells a
user whether entering it is worth their time. That is the whole of what is
possible. Everything past the frame boundary is an escalation to the vendor
or a decision to change vendor, and it belongs in a scoping conversation
rather than in a backlog, because nobody on the project can close it.

## It cannot write alt text

`filename-alt` can tell that `DSC_0043.JPG` carries no information. It cannot
tell what the photograph shows, so it marks the image decorative and reports
it. Where the image is the only content of a link it does not even do that,
because clearing the alt there would remove the link's entire accessible name
and turn a 1.1.1 finding into a 4.1.2 one. It leaves the filename in place,
marks the image with `data-a11y-needs-alt` and warns.

That residual finding is asserted in `tools/pairs.mjs` and checked on every
run. It is supposed to survive. A human writing alt text in the editor is the
only thing that clears it.

## It cannot name a control it does not recognise

`name-controls` works from a hint table matched against test ids and class
names. A control the table does not recognise is logged to the console and
left exactly as it was. There is deliberately no fallback, because a guessed
name is worse than a missing one: a missing name is findable by any scanner
in seconds, and a wrong one is findable only by a person who already knows
what the control does.

## It cannot know whether a key is already handled

`gallery-controls` and `announcement-close` add Enter and Space handling to
elements they promote to a button role. If the platform already handles those
keys, activating again would fire the control twice. There is no way to ask a
DOM element whether it has a listener, so the only signal available is
`defaultPrevented`, and a platform handler that does not prevent the default
will produce a double activation. Watch for it on templates with custom
gallery scripts.

## The accessible name computation is a working subset, not accname

`lib/accessible-name.js` implements `aria-labelledby`, then `aria-label`,
then the native host-language label, then `title`, with images contributing
their alt and form controls taking their label rather than their contents. It
does not implement CSS generated content, `aria-describedby`, recursion
through a second level of `aria-labelledby`, or any name that depends on
resolving a cross-origin reference.

It will therefore disagree with a browser's own accessibility tree on
unusual markup. Where it disagrees it is built to say "no name" rather than
invent one, because a naming computation that is too generous makes every
unlabelled control on a site look labelled, and the report comes back clean
on a broken page.

## It does not run in a background tab, on purpose

Passes are scheduled with `requestAnimationFrame`, which does not fire while
the tab is hidden. A queued pass runs as soon as the tab is shown. A tab
nobody is looking at does not need its focus order repaired this instant, and
the alternative is a timer, which is the thing guarantee 3 exists to forbid.

## It cannot survive a platform update that renames things

Every selector in `rules/` keys off structure, roles, and stable hooks such
as `data-testid`. None of them use generated class names, and
`tools/verify.mjs` fails the build if one appears. That reduces the risk and
does not remove it: a template rewrite can change structure as easily as
class names.

This is the failure mode worth planning for, because it is silent. The layer
keeps running, every rule still executes, and it repairs nothing. The
diagnostic is `A11yKit.report()` in the console: a rule that reports `0` after
a platform update has almost certainly stopped matching. Put a date in the
calendar rather than trusting that no news is good news.

## What a scanner will not tell you either

Nine of the fifteen findings in `docs/every-finding.md` are not reported by an
off the shelf automated scanner, and four of them cannot be found by reading
markup at all. The mobile overlay that never takes focus is the clearest
case: the toggle has a role, a name and `aria-expanded`, the overlay has
links, and every attribute a scanner can read is correct. The failure only
exists in what happens when a key is pressed.

Budget a manual keyboard pass per template. The automated layer narrows what
a person has to look at. It does not replace them, and any report that
implies otherwise is selling something.

## What injection never fixes

It does not make a site compliant, and nothing in this repository should be
quoted as saying it does. Injection is a repair for what a closed platform
genuinely puts out of reach, bought at the cost of a maintenance liability
that belongs to whoever installed it, forever. The honest scope of any
engagement on these platforms names the parts nobody can fix: cross-origin
embeds, platform-controlled markup, and the content the client will add next
week.

The argument against overlay products, which is this same argument taken to
its conclusion, is in
[shopify-accessibility-patterns](https://github.com/BuildWithAbdullah/shopify-accessibility-patterns/blob/main/docs/06-why-overlays-fail.md).

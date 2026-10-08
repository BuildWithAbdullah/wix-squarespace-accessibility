# The shared injection layer

## Read this before using the kit

Injection is a last resort. On Wix and Squarespace it is sometimes the only
resort, which is why this directory exists, but the order of preference never
changes:

1. **Change the setting.** Both platforms expose alt text, heading levels, link
   text, button labels and colour choices in their editors. A value set in the
   editor belongs to the client, survives platform updates, and is visible to
   whoever edits the site next.
2. **Change the content.** A vague link is fixed by rewriting the link, not by
   appending hidden text to it from a script.
3. **Inject**, only for what the first two cannot reach.

A rule in this layer is a permanent maintenance liability. It runs on every
page view for every visitor, it breaks silently when the platform changes a
class name, and the next person to work on the site will not know it exists.
Every rule you add should be one you can justify in those terms.

## Why the guards exist

Closed platforms re-render constantly: page transitions without a reload,
lightboxes, galleries, filters, lazy-loaded sections. A script that runs once
on `DOMContentLoaded` will have its work discarded within seconds of the first
interaction.

So the layer has to run repeatedly, which means it has to be safe to run
repeatedly. Five properties make it so, and each one is tested in
`test/kit.test.mjs` rather than asserted here. Three of those tests exist
because the property they describe was not actually true.

**Idempotent.** Every element a rule touches gets a marker attribute. On the
next pass the rule sees the marker and skips. Without this, a rule that appends
hidden text appends it again on every mutation, and after a minute of browsing
the accessible name is the same phrase repeated forty times.

**Non-destructive.** A rule that finds a correct name leaves it alone. This is
the guard people skip, and it causes the worst failures: a blanket relabelling
rule that overwrites a good `aria-label` with a guess from a class name
produces defects that are far harder to trace than the ones it fixed.

The judgement of what counts as a name is made in one place,
`lib/accessible-name.js`, rather than per rule. That is not tidiness. Five
rules here used to make it inline, and all five agreed on the same wrong
answer: they read `textContent`, so a button whose only content is an image
with correct alt text looked unnamed and got a second name appended to it. The
control then announced itself twice, produced by the layer installed to fix
naming.

**Observed, not polled.** `MutationObserver` costs nothing until the DOM
changes. A `setInterval` running twice a second is a battery cost on every page
view for every user, forever. This one is now enforced on the tree rather than
promised in a paragraph: `tools/verify.mjs` fails the build if `setInterval`
appears anywhere in `rules/`, because the mobile navigation rule used to poll
at 250ms in a repository whose own documentation forbids it.

**Re-entrant safe, without going blind.** The layer must not trigger itself,
and it must not miss platform mutations that land while it is writing. The
first version solved the first problem by disconnecting the observer for the
duration of a pass, which created the second: `MutationObserver` discards its
queue on disconnect, so any DOM the platform replaced in that window was never
seen again. On a closed platform the thing most likely to replace DOM at that
exact moment is the page transition that caused the pass. The observer now
stays connected, and records describing only the layer's own insertions, which
carry a `data-a11y-own` marker, are ignored. Anything else that arrives mid
pass schedules one more pass.

**Failures contained and visible.** One rule throwing does not stop the
others, and the error is recorded in `A11yKit.report().problems`. Two rules
cannot share a name, because sharing a name means sharing a marker attribute,
which would make the second rule silently skip every element the first one
touched. Marker attributes also live in their own `data-a11y-done-` namespace
rather than the `data-a11y-` one rules select on, for the same reason: a rule
called `announcement-close` used to read `data-a11y-announcement-close`, the
obvious stable hook to select by, as proof that it had already handled the
element.

## Detecting when it has died

This is the failure mode nobody plans for. The platform updates, a class name
changes, the selector stops matching, and the layer keeps running and fixes
nothing. The elements it used to repair still exist, so nothing looks broken.
The site quietly stops being accessible and no one is told.

`A11yKit.report()` in the console prints how many elements each rule touched.
A rule reporting `0` that used to report `12` has lost its selector.

Put that one-line check in the handover document, along with what each rule
does and why the platform could not do it. Without that, the layer is invisible
debt with your name on it.

## Usage

In practice you paste `dist/a11y-bundle.js`, which is the library, the engine
and all eight rules concatenated in load order. To write a rule of your own:

```html
<script src="a11y-bundle.js"></script>
<script>
  A11yKit.rule('name-icon-buttons', function (root, mark, kit) {
    root.querySelectorAll('button').forEach(function (el) {
      if (A11yName.hasAccessibleName(el)) return;   // already named, leave alone
      if (mark(el)) return;                         // already handled
      var name = A11yText.hintFor(el.className + ' ' + el.id);
      if (!name) return;                            // do not guess
      var span = kit.create('span');                // kit.create tags it as ours
      span.className = 'a11y-visually-hidden';
      span.textContent = name;
      el.appendChild(span);
    });
  });
</script>
```

Note the two early returns before `mark()`, and that neither of them is an
inline judgement. A rule that cannot determine a correct value must do nothing:
guessing is how a repair layer becomes a source of defects, and a guessed name
is worse than a missing one because a missing name is findable by any scanner
in seconds.

Use `kit.create` rather than `document.createElement` for anything you insert.
It tags the node so the observer can tell the layer's own work from the
platform's, which is what keeps a pass from echoing into another pass.

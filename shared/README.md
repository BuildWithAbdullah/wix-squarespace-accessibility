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
repeatedly. Four properties make it so:

**Idempotent.** Every element a rule touches gets a marker attribute. On the
next pass the rule sees the marker and skips. Without this, a rule that appends
hidden text appends it again on every mutation, and after a minute of browsing
the accessible name is the same phrase repeated forty times.

**Non-destructive.** A rule that finds a correct name leaves it alone. This is
the guard people skip, and it causes the worst failures: a blanket relabelling
rule that overwrites a good `aria-label` with a guess from a class name
produces defects that are far harder to trace than the ones it fixed.

**Observed, not polled.** `MutationObserver` costs nothing until the DOM
changes. A `setInterval` running twice a second is a battery cost on every page
view for every user, forever.

**Re-entrant safe.** The observer disconnects while rules write. Without this
the layer triggers itself and, in the worst case, loops.

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

```html
<script src="a11y-injection-kit.js"></script>
<script>
  A11yKit
    .rule('name-icon-buttons', function (root, mark) {
      root.querySelectorAll('button:not([aria-label])').forEach(function (el) {
        if (el.textContent.trim()) return;      // already named, leave alone
        if (mark(el)) return;                   // already handled this pass
        var hint = el.className.match(/(search|cart|menu|close)/);
        if (!hint) return;                      // do not guess
        el.setAttribute('aria-label', hint[0]);
      });
    })
    .start();
</script>
```

Note the two early returns before `mark()`. A rule that cannot determine a
correct value must do nothing. Guessing is how a repair layer becomes a source
of defects.

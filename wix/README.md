# Wix

## What you can reach

| Layer | Access | Use it for |
|---|---|---|
| Editor element settings | Always | Alt text, heading tags, link text, button labels, colours |
| Accessibility Wizard | Always | A guided pass over the common settings. Run it first. |
| Velo by Wix | Dev Mode on | Page and site code, `$w` element API, event handlers |
| Custom Code injection | Premium plan | `<script>` and `<style>` in head or body, site-wide or per page |
| The generated markup | Never | Wix owns the DOM. You cannot edit the HTML it emits. |

The order matters. Almost every finding on a Wix site has a settings-level fix,
and a settings-level fix is worth more than a code-level one because it belongs
to the client and survives platform updates.

## Do the editor pass first

Before writing any code:

- **Alt text.** Every image, set in the editor. Decorative images get the
  "decorative" option, which emits `alt=""`, rather than a description.
- **Heading tags.** Wix text elements carry a semantic tag independent of their
  visual style. A "Heading 2" preset used for a large paragraph is a fake
  heading. Set the tag to match the structure and style it separately.
- **Link text.** Rename repeated "Read more" and "Learn more" links. In a
  repeater, this is one change that fixes every instance.
- **Button labels.** Icon-only buttons in the editor accept an accessible name.
- **Page titles and language.** Per page, in SEO settings.
- **Colours.** Fix them in the site theme palette rather than per element, or
  they will drift back.

Run the built-in Accessibility Wizard as a checklist. It covers the settings
and nothing else, so treat a clean wizard as the beginning of the audit.

## Velo

With Dev Mode on, page code runs after the page is ready:

```js
$w.onReady(function () {
  // The $w API addresses Wix elements by their editor ID, not by CSS
  // selector. It cannot reach arbitrary DOM.
  $w('#submitButton').accessibility.ariaAttributes.label = 'Submit enquiry';
});
```

Velo is the right tool for anything tied to a Wix element you can select in the
editor: labels, live regions on form submission, moving focus after a
validation error, and managing `aria-expanded` on a custom accordion built from
Wix elements.

Velo is the wrong tool for reaching into markup Wix generates around your
elements. It does not expose that. For those cases you need Custom Code.

## Custom Code

`Settings` then `Custom Code` on a Premium plan. Add to `Head` or `Body end`,
site-wide or on chosen pages.

This runs in the page context with full DOM access, so it is where the
injection kit goes. Two Wix-specific constraints shape how it must be written:

**Class names are generated and unstable.** Wix emits classes like
`_1a2b3c`. They change between publishes. Never key a selector on them. Use
structural selectors, ARIA attributes, element roles, and `data-testid`
attributes where Wix provides them, all of which are considerably more stable.

**Wix renders late and re-renders.** Content arrives after `DOMContentLoaded`,
and page transitions replace large parts of the DOM without a reload. A
one-shot script will run before the content exists. This is exactly what the
[injection kit](../shared/a11y-injection-kit.js) is for.

See [`custom-code-a11y.html`](custom-code-a11y.html) for a ready-made block.

## What breaks on Wix specifically

**The viewport meta tag.** Wix controls it, and it has historically included
`maximum-scale`. You cannot edit the tag. What you can do is verify current
behaviour on a real device, and if pinch-zoom is blocked, document it as a
platform-level limitation in the accessibility statement rather than claiming a
fix. Do not claim to have fixed something you cannot reach.

**Platform JavaScript weight.** A Wix site loads a large amount of platform
code that nobody working inside the editor can remove, including Wix Partners.
Across a typical site this accounts for the majority of measured load time.
This is a characteristic of the platform, not a fault in the site, and it is
worth stating plainly when a client asks why a performance score is what it is.
It is not an accessibility finding, and it should not be reported as one.

**Third-party embeds.** An embedded form, booking widget or estimator served
from another domain sits inside a cross-origin iframe. No script, stylesheet or
overlay on the parent page can modify its contents. This is the browser's
same-origin policy, it applies to every site on the web, and WCAG anticipates
it: claim partial conformance, identify the component, and document the
limitation in the accessibility statement.

**Focus order in the editor's absolute layout.** The classic editor positions
elements absolutely, so DOM order and visual order can diverge badly. Check tab
order on every page; it is one of the most common real failures on Wix sites
and no scanner reports it.

## Testing

Test the published site, never the editor preview. The preview renders
differently and will give you findings that do not exist and hide ones that do.

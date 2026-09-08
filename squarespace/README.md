# Squarespace

## What you can reach

| Layer | Access | Use it for |
|---|---|---|
| Block and page settings | Always | Alt text, heading levels, link text, button labels, form labels |
| Site styles | Always | Colours, type, button styles |
| Code Blocks | Business plan | Markup inside page content |
| Code Injection, site-wide | Business plan | `<style>` and `<script>` in head or footer |
| Code Injection, per page | Business plan | Page Settings then Advanced |
| Template files | 7.0 Developer Platform only | Direct template editing, legacy |
| Generated markup on 7.1 | Never | Squarespace owns the DOM |

As on any closed platform, settings beat code. Squarespace exposes more in its
editor than people expect: image alt text, heading levels on text blocks,
button labels, form field labels and help text are all editable without
touching code.

## 7.0 and 7.1

The distinction matters because it determines what is possible.

**7.0** is template-based. Each template family has its own markup and its own
quirks, and the Developer Platform allows direct template editing via Git or
SFTP. That is the only Squarespace configuration in which you can genuinely fix
markup at source. It is legacy, and Squarespace has been steering sites away
from it, but plenty of 7.0 sites are still live.

**7.1** has a single unified template. Every site shares the same underlying
markup, which makes fixes portable between sites, but there is no template
editing at all. Everything is settings plus Code Injection.

**Fluid Engine**, the drag-and-drop editor on newer 7.1 sites, adds a
complication: it positions blocks on a grid, and the DOM order does not always
match the visual order, particularly after a section is rearranged. Tab order
follows the DOM. Check it on every page that uses Fluid Engine sections.

Identify which you are on before quoting: `Design` then `Site Styles` shows a
7.1 interface, and 7.0 sites name their template family in Design.

## Do the settings pass first

- **Image alt text.** Per image, in the image block. Squarespace falls back to
  the filename in some contexts, which is worse than nothing.
- **Heading levels.** Text blocks expose Heading 1 through 4 and Paragraph. The
  common failure is a paragraph styled large to look like a heading, or a page
  that starts at Heading 3 because the designer preferred its size. Set the
  level for structure and adjust the size in Site Styles.
- **Link text.** Summary blocks default to "Read More" on every item. Change
  the wording in the block's design settings, or turn the excerpt link off and
  let the title carry the link.
- **Form fields.** Squarespace form blocks emit labels. Check that "Hide label"
  has not been ticked, which leaves the field with a placeholder and no
  accessible name.
- **Button labels.** Never "Click here". Never "Learn more" repeated eight
  times on one page.

## Code Injection

`Settings` then `Advanced` then `Code Injection`. Header and Footer apply
site-wide. Per-page injection is in Page Settings then Advanced.

Put styles in Header so they apply before first paint, and scripts in Footer so
they run after the DOM exists. See
[`code-injection-header.html`](code-injection-header.html) and
[`code-injection-footer.html`](code-injection-footer.html).

Squarespace uses AJAX page transitions on many templates, so a script that runs
once will not run again on the next page. This is what the
[injection kit](../shared/a11y-injection-kit.js) handles.

## What breaks on Squarespace specifically

**The mobile overlay navigation.** The most reliable finding on any
Squarespace site. The menu opens as a full-screen overlay, focus is never moved
into it, the page behind stays tabbable, and `Escape` does nothing. It is a
textbook 2.1.2 failure and no scanner reports it. The footer injection includes
a fix.

**Summary and archive blocks.** Every item links with the same "Read More"
text. A screen reader user listing links hears it repeated with no way to tell
the items apart.

**Gallery and lightbox blocks.** Lightboxes open without taking focus and often
cannot be closed with `Escape`. Gallery navigation arrows are frequently
unnamed buttons.

**Index pages on 7.0.** Each section carries its own heading, and stacking
several sections commonly produces multiple `h1` elements on one page, or a
heading order that jumps levels.

**Announcement bar.** Injected at the top of the DOM, so it is the first thing
in the tab order on every page, and its close button is often unnamed.

**Cover pages.** A separate template with its own markup that bypasses most
site-wide styling. Audit them separately; they are easy to miss entirely.

## Testing

Test the published site in a private window, not the editor preview and not
while logged in. The Squarespace admin bar changes the DOM and the tab order.

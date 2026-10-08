/* Rule: summary-read-more.  WCAG 2.4.4 Link Purpose (In Context).
   Squarespace summary blocks, and any blog or product grid built the same way.

   Every item in the list links with identical text. A screen reader user
   pulling up a list of links on the page gets twelve entries that all say
   "Read More" and no way to tell them apart.

   The visible wording is left alone on purpose. Changing it is a design
   decision that belongs to the client, and a repair layer that silently
   rewrites visible copy will eventually rewrite something it should not.
   Hidden text appended to the link makes each accessible name unique while
   the page looks exactly as the client built it.

   Two things this version does better. The generic phrase list is shared
   with the audit rather than written inline, so the rule and the check that
   grades it cannot disagree about what counts as generic. And the title it
   borrows is read with the shared accessible name computation, so an item
   whose title is an image with alt text gets a useful suffix instead of an
   empty one. */

(function () {
  'use strict';
  if (!window.A11yKit || !window.A11yName || !window.A11yText) return;

  var LINKS = '.summary-read-more-link, .summary-item a, [data-a11y-summary-item] a';
  var ITEM = '.summary-item, [data-a11y-summary-item], article, li';
  var TITLE = '.summary-title, .summary-title-link, h1, h2, h3, h4';

  window.A11yKit.rule('summary-read-more', function (root, mark, kit) {
    var links = root.querySelectorAll(LINKS);
    for (var i = 0; i < links.length; i++) {
      var link = links[i];
      if (!window.A11yText.isGenericLinkText(window.A11yName.accessibleName(link))) continue;
      if (mark(link)) continue;

      var item = link.closest ? link.closest(ITEM) : null;
      if (!item) continue;

      var titleEl = item.querySelector(TITLE);
      var title = titleEl ? window.A11yName.accessibleName(titleEl) : '';
      if (!title) continue;

      var span = kit.create('span');
      span.className = 'a11y-visually-hidden';
      span.textContent = ' about ' + title;
      link.appendChild(span);
    }
  });
})();

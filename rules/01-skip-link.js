/* Rule: skip-link.  WCAG 2.4.1 Bypass Blocks.  Wix and Squarespace.

   Neither platform emits a skip link and neither has a setting for one, so
   this is one of the few repairs that genuinely belongs in injected code
   rather than in the editor.

   The defect this version fixes. The previous rule began with
   "if a skip link already exists, do nothing". On a platform that navigates
   without a reload, the body survives the transition and the skip link
   survives with it, while the main region it points at is replaced by a new
   element with a different id. The link then resolves to nothing: pressing
   Enter moves neither focus nor scroll, and because the link is still there
   and still looks right, nothing about the page suggests it has stopped
   working. The rule now re-points an existing link whose target has gone.

   The target needs tabindex="-1". Without it several browsers scroll to the
   anchor without moving focus, which is the same silent half-failure in a
   different costume. */

(function () {
  'use strict';
  if (!window.A11yKit) return;

  var MAIN = 'main, [role="main"], #PAGES_CONTAINER, #SITE_PAGES, #page, #content';
  var TARGET_ID = 'a11y-main';

  window.A11yKit.rule('skip-link', function (root, mark, kit) {
    var main = root.querySelector(MAIN);
    if (!main) return;

    if (!main.id) main.id = TARGET_ID;
    if (!main.hasAttribute('tabindex')) main.setAttribute('tabindex', '-1');

    var link = root.querySelector('.a11y-skip-link');

    if (link) {
      /* Re-point rather than return. This is the whole fix. */
      var href = link.getAttribute('href') || '';
      var current = href.charAt(0) === '#' ? root.getElementById(href.slice(1)) : null;
      if (current !== main) link.setAttribute('href', '#' + main.id);
      return;
    }

    link = kit.create('a');
    link.className = 'a11y-skip-link';
    link.setAttribute('href', '#' + main.id);
    link.textContent = 'Skip to main content';
    root.body.insertBefore(link, root.body.firstChild);
    mark(link);
  });
})();

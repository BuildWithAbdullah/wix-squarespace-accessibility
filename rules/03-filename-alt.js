/* Rule: filename-alt.  WCAG 1.1.1 Non-text Content.  Wix and Squarespace.

   Both editors prefill alt with the uploaded filename, so a site ends up
   announcing "D S C underscore zero zero four three dot J P G" where it
   should say nothing at all or say something useful.

   The defect this version fixes, and it is the worst one in the old set. The
   previous rule cleared the alt unconditionally, on the reasoning that a
   filename carries no information so the image may as well be decorative.
   That reasoning holds for an image sitting in a paragraph. It does not hold
   for an image that is the only content of a link or a button, where the alt
   is the control's entire accessible name. Clearing it there turns a badly
   named link into an unnamed one: a 1.1.1 problem the client could live with
   becomes a 2.4.4 and 4.1.2 problem that stops the control being usable at
   all. The repair made the site worse, and it did so silently.

   So the rule now asks what the image is for. Inside an interactive ancestor
   whose only name is this alt, it leaves the value alone and reports it. Any
   other image with a filename alt is marked decorative, which is the honest
   repair, and also reported, because the real fix is a human writing a real
   alt in the editor. */

(function () {
  'use strict';
  if (!window.A11yKit || !window.A11yName || !window.A11yText) return;

  var INTERACTIVE = 'a[href], button, [role="button"], [role="link"]';

  window.A11yKit.rule('filename-alt', function (root, mark, kit) {
    var images = root.querySelectorAll('img[alt]');
    for (var i = 0; i < images.length; i++) {
      var img = images[i];
      if (!window.A11yText.isFilenameAlt(img.getAttribute('alt'))) continue;
      if (mark(img)) continue;

      var host = img.closest ? img.closest(INTERACTIVE) : null;
      if (host) {
        /* Would clearing this alt leave the control with no name at all? */
        var before = img.getAttribute('alt');
        img.setAttribute('alt', '');
        var nameWithoutIt = window.A11yName.accessibleName(host);
        img.setAttribute('alt', before);

        if (!nameWithoutIt) {
          img.setAttribute('data-a11y-needs-alt', 'names-a-control');
          if (window.console) {
            console.warn('[A11yKit] this filename alt is the only name on a control, ' +
                         'so it has been left in place. Name the control in the editor:', host);
          }
          continue;
        }
      }

      img.setAttribute('alt', '');
      img.setAttribute('data-a11y-needs-alt', 'cleared');
      if (window.console) {
        console.info('[A11yKit] filename alt cleared, set a real alt in the editor:', img.currentSrc || img.src);
      }
    }
  });
})();

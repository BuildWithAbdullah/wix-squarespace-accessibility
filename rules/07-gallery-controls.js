/* Rule: gallery-controls.  WCAG 4.1.2 Name, Role, Value, and 2.1.1 Keyboard.
   Squarespace galleries and lightboxes, Wix Pro Gallery.

   Lightbox close, previous and next are commonly unnamed, and on several
   templates they are div or span elements rather than buttons.

   The defect this version fixes, and it is the subtle one. The previous rule
   named the control, and when the control was not a button it also added
   role="button" and tabindex="0" so it could be reached. What it never added
   was a key handler. The result is a control that a keyboard user can now
   tab to, that a screen reader now announces as a button named "Next image",
   and that does absolutely nothing when they press Enter or Space. Before the
   repair the control was unreachable, which is a failure the user can at
   least detect. After it, the control advertises an interaction it does not
   have, which wastes the user's time and makes them doubt their own input.
   Promising a role is a promise to implement it.

   So promotion is now atomic: role, tab stop and key handling go on together
   or none of them do. */

(function () {
  'use strict';
  if (!window.A11yKit || !window.A11yName) return;

  var MAP = [
    ['.gallery-lightbox-close, .lightbox-close, [data-controls="close"]', 'Close image viewer'],
    ['.gallery-arrow-left, .lightbox-control-previous, [data-controls="previous"]', 'Previous image'],
    ['.gallery-arrow-right, .lightbox-control-next, [data-controls="next"]', 'Next image']
  ];

  /* A native button already does this. Anything promoted to role="button"
     has to do it by hand, including the detail that Space fires on keyup and
     scrolls the page on keydown unless that is prevented. */
  function makeOperable(el) {
    el.addEventListener('keydown', function (e) {
      /* If the platform already handles this key it will have prevented the
         default, and activating again would fire the control twice. There is
         no way to ask an element whether it has a listener, so this is the
         only signal available and its limits are in
         docs/03-what-the-kit-cannot-reach.md. */
      if (e.defaultPrevented) return;
      if (e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); return; }
      if (e.key === 'Enter') { e.preventDefault(); el.click(); }
    });
    el.addEventListener('keyup', function (e) {
      if (e.defaultPrevented) return;
      if (e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); el.click(); }
    });
  }

  window.A11yKit.rule('gallery-controls', function (root, mark, kit) {
    for (var m = 0; m < MAP.length; m++) {
      var found = root.querySelectorAll(MAP[m][0]);
      for (var i = 0; i < found.length; i++) {
        var el = found[i];
        var needsName = !window.A11yName.hasAccessibleName(el);
        var isNative = el.tagName === 'BUTTON' || (el.tagName === 'A' && el.hasAttribute('href'));

        /* A native control that already has a name needs nothing. Anything
           else is managed, including an element that someone has already
           given a role and a tab stop and no key handling, because that
           state is invisible in the markup and is the worst of the three. */
        if (isNative && !needsName) continue;
        if (mark(el)) continue;

        if (needsName) el.setAttribute('aria-label', MAP[m][1]);

        if (!isNative) {
          if (!el.getAttribute('role')) el.setAttribute('role', 'button');
          if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
          makeOperable(el);
        }
      }
    }
  });
})();

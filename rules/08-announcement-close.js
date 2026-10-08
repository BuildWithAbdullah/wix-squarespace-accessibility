/* Rule: announcement-close.  WCAG 4.1.2 Name, Role, Value, and 2.1.1 Keyboard.
   Squarespace announcement bar.

   It deserves its own rule rather than a line in the gallery one, because of
   where it sits: first in the tab order, on every page of the site. An
   unnamed, unreachable close button in that position is the first thing a
   keyboard user meets and the thing they meet again on every navigation.

   Same promotion contract as the gallery rule. If this gives an element a
   button role and a tab stop, it also gives it key handling, because a
   control that announces itself as a button and ignores Enter is a worse
   outcome than one that was never reachable. */

(function () {
  'use strict';
  if (!window.A11yKit || !window.A11yName) return;

  var CLOSE = '.sqs-announcement-bar-close, [data-a11y-announcement-close]';

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

  window.A11yKit.rule('announcement-close', function (root, mark, kit) {
    var found = root.querySelectorAll(CLOSE);
    for (var i = 0; i < found.length; i++) {
      var el = found[i];
      var needsName = !window.A11yName.hasAccessibleName(el);
      var isNative = el.tagName === 'BUTTON';

      /* Same contract as the gallery rule: a native button with a name is
         left alone, and anything else is managed as a whole. */
      if (isNative && !needsName) continue;
      if (mark(el)) continue;

      if (needsName) el.setAttribute('aria-label', 'Close announcement');
      if (!isNative) {
        if (!el.getAttribute('role')) el.setAttribute('role', 'button');
        if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
        makeOperable(el);
      }
    }
  });
})();

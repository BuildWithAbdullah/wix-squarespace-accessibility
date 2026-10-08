/* Rule: name-controls.  WCAG 4.1.2 Name, Role, Value.  Wix and Squarespace.

   Both platforms emit icon-only controls with no name: the header burger, the
   search toggle, gallery arrows, lightbox close buttons.

   The defect this version fixes. The previous rule decided a control was
   unnamed by reading textContent. A button whose only child is an image with
   correct alt text has an empty textContent and a perfectly good accessible
   name, so the rule appended a second name to it and the control announced
   its name twice. The same mistake treated an svg with a title element, and a
   control named through aria-labelledby pointing at a hidden span, as
   unnamed. All of that now goes through A11yName.accessibleName, which is one
   implementation tested against a case table in test/name.test.mjs.

   There is deliberately no fallback. A control this rule cannot identify is
   reported to the console for a human to name in the editor, and left alone.
   A guessed name is worse than a missing one, because a missing name is
   findable with a scanner and a wrong one is not. */

(function () {
  'use strict';
  if (!window.A11yKit || !window.A11yName || !window.A11yText) return;

  var CONTROLS = 'button, [role="button"], a[href], [role="link"], summary';

  window.A11yKit.rule('name-controls', function (root, mark, kit) {
    var all = root.querySelectorAll(CONTROLS);
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (window.A11yName.hasAccessibleName(el)) continue;
      if (mark(el)) continue;

      var probe = [
        el.getAttribute('data-testid'), el.getAttribute('data-hook'),
        el.getAttribute('data-test'), el.getAttribute('data-controls'),
        el.id, el.className
      ].join(' ');

      var name = window.A11yText.hintFor(probe);
      if (!name) {
        if (window.console) {
          console.info('[A11yKit] unnamed control, name it in the editor:', el);
        }
        continue;
      }

      var span = kit.create('span');
      span.className = 'a11y-visually-hidden';
      span.textContent = name;
      el.appendChild(span);
    }
  });
})();

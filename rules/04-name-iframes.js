/* Rule: name-iframes.  WCAG 4.1.2 Name, Role, Value.  Wix and Squarespace.

   Embedded maps, booking widgets, video players and payment forms arrive as
   iframes with no title, and a screen reader announces an unnamed frame,
   which tells the user nothing about whether it is worth entering.

   The defect this version fixes. The previous selector was
   iframe:not([title]), which skips an iframe carrying title="". An empty
   title is exactly as useless as a missing one and is more common, because
   several embed builders emit the attribute and leave it blank. The rule now
   asks whether the frame has an accessible name, not whether it has an
   attribute. It also leaves a frame named by aria-label alone, which the old
   selector would have added a redundant title to.

   The limit is worth stating where the repair is. Naming the frame makes it
   findable. It does nothing whatsoever about what is inside it: a booking
   widget with an unlabelled date field is unreachable from the parent page,
   because no script on this origin can read or modify a cross-origin
   document. That one is an escalation to the vendor, not a repair. */

(function () {
  'use strict';
  if (!window.A11yKit || !window.A11yName) return;

  window.A11yKit.rule('name-iframes', function (root, mark, kit) {
    var frames = root.querySelectorAll('iframe');
    for (var i = 0; i < frames.length; i++) {
      var frame = frames[i];
      if (window.A11yName.hasAccessibleName(frame)) continue;
      if (mark(frame)) continue;

      var host = '';
      try { host = new URL(frame.getAttribute('src') || '', location.href).hostname; } catch (e) { host = ''; }
      frame.setAttribute('title', host ? ('Embedded content from ' + host) : 'Embedded content');
    }
  });
})();

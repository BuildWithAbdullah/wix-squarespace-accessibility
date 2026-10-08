/* Rule: mobile-nav-focus.  WCAG 2.1.2 No Keyboard Trap, 2.4.3 Focus Order.
   Squarespace, and Wix templates that use the same pattern.

   The most reliable finding on any site built on these platforms. The menu
   opens as a full screen overlay, focus is never moved into it, the page
   behind stays tabbable, and Escape does nothing. A keyboard user opens the
   menu and then tabs through the entire page underneath it, invisibly.

   No scanner reports this, and it is worth being precise about why: there is
   nothing in the DOM that distinguishes an overlay which manages focus from
   one which does not. The difference is in what happens on a key press, so
   the only way to find it is to press the key. That is what the audit in
   audit/checks.js does, and it is the reason this repository tests in a real
   browser rather than against parsed markup.

   The defect this version fixes, and it is the one that embarrassed the
   repository. The previous implementation watched the menu's open state with
   setInterval at 250ms, forever, on every page view. The kit's own
   documentation lists "observed, not polled" as one of its guarantees and
   gives "a setInterval burning battery on every page view forever" as the
   failure that guarantee exists to prevent. The flagship rule did the exact
   thing the flagship principle forbids. Worse, nothing cleared the interval,
   so a platform navigation that replaced the toggle element left the old
   timer running against a detached node and started a second one.

   It now watches the same signals with a narrow MutationObserver scoped to
   the two elements and the attributes that actually carry the state, and it
   disconnects when the toggle leaves the document. tools/verify.mjs fails
   the build if setInterval reappears anywhere in rules/. */

(function () {
  'use strict';
  if (!window.A11yKit) return;

  var FOCUSABLE = [
    'a[href]', 'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])', 'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
  ].join(', ');

  var TOGGLE = '.header-burger-btn, .Mobile-bar-menu, [data-test="header-burger"], .burger, [data-a11y-nav-toggle]';
  var OVERLAY = '.header-menu, .Mobile-overlay, .header-menu-nav, [data-a11y-nav-overlay]';

  window.A11yKit.rule('mobile-nav-focus', function (root, mark, kit) {
    var toggle = root.querySelector(TOGGLE);
    var overlay = root.querySelector(OVERLAY);
    if (!toggle || !overlay) return;
    if (mark(toggle)) return;

    var wasOpen = false;
    var watcher = null;

    function visible(el) {
      if (!el.getClientRects) return true;
      if (el.getClientRects().length) return true;
      /* getClientRects is empty in a headless layout for elements that are
         present and unstyled, so fall back to the attributes that actually
         say hidden. */
      return !el.hasAttribute('hidden') && el.getAttribute('aria-hidden') !== 'true';
    }

    function isOpen() {
      return root.body.classList.contains('header--menu-open') ||
             root.documentElement.classList.contains('Mobile-overlay--active') ||
             overlay.getAttribute('aria-hidden') === 'false' ||
             overlay.getAttribute('data-open') === 'true' ||
             toggle.getAttribute('aria-expanded') === 'true';
    }

    function items() {
      return Array.prototype.filter.call(overlay.querySelectorAll(FOCUSABLE), visible);
    }

    function onKeydown(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        toggle.click();
        toggle.focus();
        return;
      }
      if (e.key !== 'Tab') return;

      var list = items();
      if (!list.length) return;
      var first = list[0];
      var last = list[list.length - 1];
      var active = root.activeElement;

      /* Focus escaping the overlay is the defect, so both edges are wrapped,
         and so is the case where focus is somehow outside the overlay
         entirely, which happens when the platform moves it during the
         opening animation. */
      if (!overlay.contains(active)) { e.preventDefault(); first.focus(); return; }
      if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
    }

    function sync() {
      if (!root.documentElement.contains(toggle)) {
        /* The platform replaced the header. Stop watching a detached node
           rather than leaking a watcher per navigation. */
        if (watcher) { watcher.disconnect(); watcher = null; }
        root.removeEventListener('keydown', onKeydown, true);
        return;
      }

      var open = isOpen();
      if (open === wasOpen) return;
      wasOpen = open;

      if (open) {
        var list = items();
        if (list.length) list[0].focus();
        root.addEventListener('keydown', onKeydown, true);
      } else {
        root.removeEventListener('keydown', onKeydown, true);
      }
    }

    /* Narrow and attribute scoped: the three nodes whose state matters, and
       only the attributes that carry it. This is the opposite of observing
       every attribute on the document, which is what the kit's global
       observer refuses to do for good reason. */
    watcher = new MutationObserver(sync);
    watcher.observe(toggle, { attributes: true, attributeFilter: ['aria-expanded', 'class'] });
    watcher.observe(overlay, { attributes: true, attributeFilter: ['aria-hidden', 'data-open', 'class'] });
    watcher.observe(root.body, { attributes: true, attributeFilter: ['class'] });
    watcher.observe(root.documentElement, { attributes: true, attributeFilter: ['class'] });

    sync();
  });
})();

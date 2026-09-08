/* ---------------------------------------------------------------------------
   a11y-injection-kit.js

   A guarded repair layer for closed platforms where the markup cannot be
   edited: Wix, Squarespace, and any embedded widget that renders its own DOM.

   Read shared/README.md before using this. Injection is a last resort. If the
   platform's own editor can set the thing you are about to patch, use the
   editor. A patch you own forever is worse than a setting the client owns.

   ---------------------------------------------------------------------------
   Design

   Closed platforms re-render. A page transition, a lightbox opening, a gallery
   advancing, a filter applying: all of them replace DOM that a one-shot
   DOMContentLoaded script has already processed. So the layer has to run
   again, which means it has to be safe to run again.

   Four properties make that safe:

   1. Idempotent. Every element it touches gets a marker attribute and is
      skipped on later passes. Nothing is processed twice.

   2. Non-destructive. A rule that finds an element already carrying a correct
      name, label or role leaves it alone and marks it. A repair layer that
      overwrites correct values with guessed ones is worse than no layer, and
      the resulting defects are much harder to trace.

   3. Observed, not polled. A MutationObserver costs nothing until the DOM
      changes. A setInterval costs battery on every page view forever.

   4. Re-entrant safe. The observer is disconnected while rules write, so the
      layer cannot trigger itself.

   ---------------------------------------------------------------------------
   Usage

     A11yKit.rule('name-cart-button', function (root, mark) {
       root.querySelectorAll('button[aria-label=""]').forEach(function (el) {
         if (mark(el)) return;                 // already handled, skip
         el.setAttribute('aria-label', 'Cart');
       });
     });

     A11yKit.start();

   Debug in the browser console:

     A11yKit.report();     // what ran, how many elements each rule touched
     A11yKit.stop();       // disconnect, leaving the DOM as it is
   --------------------------------------------------------------------------- */

window.A11yKit = (function () {
  'use strict';

  var PREFIX = 'data-a11y-';
  var rules = [];
  var observer = null;
  var scheduled = false;
  var passes = 0;
  var running = false;

  /* Returns true if this element was already handled by this rule, and marks
     it if not. Rules call it first and return early when it returns true. */
  function makeMark(ruleName, counters) {
    var attr = PREFIX + ruleName;
    return function mark(el) {
      if (el.hasAttribute(attr)) return true;
      el.setAttribute(attr, '');
      counters[ruleName] = (counters[ruleName] || 0) + 1;
      return false;
    };
  }

  var counters = {};

  function runAll() {
    scheduled = false;
    if (running) return;
    running = true;

    // Disconnect while writing so our own mutations do not re-trigger us.
    if (observer) observer.disconnect();

    try {
      passes++;
      for (var i = 0; i < rules.length; i++) {
        try {
          rules[i].fn(document, makeMark(rules[i].name, counters));
        } catch (err) {
          // One broken rule must not take the rest of the layer down with it.
          if (window.console) {
            console.warn('[A11yKit] rule "' + rules[i].name + '" threw:', err);
          }
        }
      }
    } finally {
      running = false;
      if (observer) connect();
    }
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    // Coalesce bursts of mutations into one pass per frame. Platform widgets
    // emit mutations in the dozens; without this the layer runs dozens of
    // times for one visible change.
    requestAnimationFrame(runAll);
  }

  function connect() {
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      // Deliberately not observing attributes. Watching attribute changes on
      // a platform that animates with inline styles produces a mutation storm
      // and buys nothing, because the rules here key off structure.
      attributes: false
    });
  }

  return {
    /* Register a repair. Rules run in registration order on every pass. */
    rule: function (name, fn) {
      if (!/^[a-z0-9-]+$/.test(name)) {
        throw new Error('[A11yKit] rule name must be kebab-case: ' + name);
      }
      rules.push({ name: name, fn: fn });
      return this;
    },

    start: function () {
      if (observer) return this;
      var boot = function () {
        observer = new MutationObserver(schedule);
        runAll();
      };
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
      } else {
        boot();
      }
      return this;
    },

    stop: function () {
      if (observer) { observer.disconnect(); observer = null; }
      return this;
    },

    /* Run once immediately. Useful after a known platform navigation. */
    refresh: runAll,

    /* Console diagnostic. If a rule reports 0 after a platform update, its
       selector has probably stopped matching, which is the normal way these
       layers die silently. */
    report: function () {
      var out = { passes: passes, rules: {} };
      rules.forEach(function (r) { out.rules[r.name] = counters[r.name] || 0; });
      if (window.console && console.table) console.table(out.rules);
      return out;
    }
  };
})();

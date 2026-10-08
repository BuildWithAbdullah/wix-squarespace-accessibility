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

   Five properties make that safe. Each one is tested in test/kit.test.mjs
   rather than asserted here.

   1. Idempotent. Every element a rule touches gets a marker attribute and is
      skipped on later passes. Nothing is processed twice.

   2. Non-destructive. A rule that finds an element already carrying a correct
      name, label or role leaves it alone. The judgement of what counts as a
      name is made in one place, lib/accessible-name.js, not per rule.

   3. Observed, not polled. A MutationObserver costs nothing until the DOM
      changes. A setInterval costs battery on every page view forever. No rule
      in this repository is allowed to poll, and tools/verify.mjs fails the
      build if one does.

   4. Re-entrant safe, without going blind. The layer must not trigger itself,
      and it must not miss platform mutations that land while it is writing.
      Earlier versions of this file disconnected the observer for the duration
      of a pass, which solved the first problem by creating the second: any
      DOM the platform replaced during those few milliseconds was never seen
      again, because disconnect discards the queue. The observer now stays
      connected and the layer ignores records that describe only its own
      insertions, which carry a data-a11y-own marker. Anything else that
      arrives mid pass sets a flag and schedules one more pass.

   5. Failures are contained and visible. One rule throwing must not take the
      layer down, and a rule whose selector has stopped matching after a
      platform update must be discoverable. Both are what report() is for.

   ---------------------------------------------------------------------------
   Usage

     A11yKit.rule('name-cart-button', function (root, mark, kit) {
       root.querySelectorAll('[data-hook="cart"]').forEach(function (el) {
         if (mark(el)) return;
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

  /* Marker attributes get their own namespace rather than sharing the one
     rules select on. A rule called "announcement-close" used to mark its
     elements with data-a11y-announcement-close, which is exactly the kind of
     stable hook a rule wants to select by, so any element the page already
     carried that attribute on was treated as already handled and silently
     skipped. The rule looked registered, reported zero elements touched, and
     the finding it existed to fix stayed on the page. */
  var PREFIX = 'data-a11y-done-';
  var OWN = 'data-a11y-own';

  var rules = [];
  var names = {};
  var counters = {};
  var problems = [];

  var observer = null;
  var scheduled = false;
  var running = false;
  var dirtyWhileRunning = false;
  var passes = 0;

  /* Returns true if this element was already handled by this rule, and marks
     it if not. Rules call it first and return early when it returns true. */
  function makeMark(ruleName) {
    var attr = PREFIX + ruleName;
    return function mark(el) {
      if (!el || el.nodeType !== 1) return true;
      if (el.hasAttribute(attr)) return true;
      el.setAttribute(attr, '');
      counters[ruleName] = (counters[ruleName] || 0) + 1;
      return false;
    };
  }

  /* Every node the layer inserts is tagged, so the observer can tell its own
     work from the platform's. A rule that inserts a node without this still
     behaves correctly; it just costs one extra pass, and passes are cheap
     because every rule is idempotent. */
  function own(el) {
    if (el && el.nodeType === 1) el.setAttribute(OWN, '');
    return el;
  }

  function create(tagName) {
    return own(document.createElement(tagName));
  }

  function isOurs(node) {
    if (!node) return false;
    if (node.nodeType === 1) return node.hasAttribute(OWN);
    if (node.nodeType === 3) {
      return !!(node.parentNode && node.parentNode.nodeType === 1 &&
                node.parentNode.hasAttribute(OWN));
    }
    return false;
  }

  /* True when every added node in this batch is something the layer inserted
     and nothing was removed. Such a batch is our own echo and is ignored. */
  function isSelfInflicted(records) {
    for (var i = 0; i < records.length; i++) {
      var r = records[i];
      if (r.removedNodes && r.removedNodes.length) return false;
      for (var j = 0; j < r.addedNodes.length; j++) {
        if (!isOurs(r.addedNodes[j])) return false;
      }
    }
    return true;
  }

  function onMutations(records) {
    if (isSelfInflicted(records)) return;
    if (running) { dirtyWhileRunning = true; return; }
    schedule();
  }

  function runAll() {
    scheduled = false;
    if (running) { dirtyWhileRunning = true; return; }
    running = true;

    try {
      passes++;
      for (var i = 0; i < rules.length; i++) {
        try {
          rules[i].fn(document, makeMark(rules[i].name), api);
        } catch (err) {
          problems.push({ rule: rules[i].name, message: String(err && err.message || err) });
          if (window.console) {
            console.warn('[A11yKit] rule "' + rules[i].name + '" threw:', err);
          }
        }
      }
    } finally {
      running = false;
    }

    /* Anything the platform changed while the rules were writing has not
       been looked at yet. One more pass, coalesced like any other. */
    if (dirtyWhileRunning) {
      dirtyWhileRunning = false;
      schedule();
    }
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    /* Coalesce bursts of mutations into one pass per frame. Platform widgets
       emit mutations in the dozens; without this the layer runs dozens of
       times for one visible change. requestAnimationFrame does not fire in a
       background tab, which is correct here: a tab nobody is looking at does
       not need its focus order repaired this instant, and the queued pass
       runs as soon as the tab is shown. */
    var raf = window.requestAnimationFrame || function (fn) { return setTimeout(fn, 16); };
    raf(runAll);
  }

  function connect() {
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      /* Deliberately not observing attributes. Watching attribute changes on
         a platform that animates with inline styles produces a mutation storm
         and buys nothing, because the rules here key off structure. Rules that
         genuinely need to watch an attribute, such as the mobile navigation
         rule watching aria-expanded, open their own narrow observer. */
      attributes: false
    });
  }

  var api = {
    /* Register a repair. Rules run in registration order on every pass. */
    rule: function (name, fn) {
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) {
        throw new Error('[A11yKit] rule name must be kebab-case: ' + name);
      }
      if (typeof fn !== 'function') {
        throw new Error('[A11yKit] rule "' + name + '" needs a function');
      }
      /* Two rules sharing a name share a marker attribute, so the second one
         silently skips every element the first one touched. That is a very
         quiet way to lose half a repair layer, so it is an error. */
      if (names[name]) {
        throw new Error('[A11yKit] duplicate rule name: ' + name);
      }
      names[name] = true;
      rules.push({ name: name, fn: fn });
      return this;
    },

    start: function () {
      if (observer) return this;
      var boot = function () {
        observer = new MutationObserver(onMutations);
        connect();
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

    /* Run once immediately. Useful after a known platform navigation. A call
       that lands during a pass is queued rather than dropped. */
    refresh: function () {
      if (running) { dirtyWhileRunning = true; return this; }
      runAll();
      return this;
    },

    /* Mark a node as the layer's own, so inserting it does not look like a
       platform change. Rules should build elements with kit.create. */
    create: create,
    own: own,

    /* Console diagnostic. If a rule reports 0 after a platform update, its
       selector has probably stopped matching, which is the normal way these
       layers die silently. */
    report: function () {
      var out = { passes: passes, rules: {}, problems: problems.slice() };
      rules.forEach(function (r) { out.rules[r.name] = counters[r.name] || 0; });
      if (window.console && console.table) console.table(out.rules);
      return out;
    },

    /* Rule names in registration order. Used by the audit suite so the list
       of shipped rules cannot drift from the list of tested ones. */
    ruleNames: function () {
      return rules.map(function (r) { return r.name; });
    }
  };

  return api;
})();

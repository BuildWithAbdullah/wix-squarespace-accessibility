/* ---------------------------------------------------------------------------
   audit/checks.js

   The static half of the audit. Each check reads a document and reports
   findings by id. Loaded into the page alongside the kit, so a check and the
   rule it grades see exactly the same DOM.

   The behavioural half lives in audit/behaviour.mjs, because those checks have
   to press a key and look at what moved, which cannot be done by reading
   markup. The split is the point of this repository: on a closed platform the
   findings that matter most are the ones a scanner cannot reach.

   Absence findings. Three of these report that something is not on the page
   at all, rather than that something on the page is wrong. They therefore
   fire on an empty document, correctly, and that makes them useless as proof
   that a failing example demonstrates its own defect: a blank file would
   satisfy a test that only asked for "at least one finding". Every absence
   finding is flagged here and test/pairs.test.mjs requires each failing
   example to produce at least one finding from outside that set.

   Exposed as window.A11yChecks.
   --------------------------------------------------------------------------- */

(function (global) {
  'use strict';

  var N = global.A11yName;
  var T = global.A11yText;

  var INTERACTIVE = 'button, [role="button"], a[href], [role="link"], summary';
  var NATIVELY_FOCUSABLE = 'a[href], button, input, select, textarea, summary, [contenteditable]';

  function visibleEnough(el) {
    if (el.hasAttribute('hidden')) return false;
    if (el.getAttribute('aria-hidden') === 'true') return false;
    var view = el.ownerDocument.defaultView;
    if (!view || !view.getComputedStyle) return true;
    var style = view.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden';
  }

  function describe(el) {
    var id = el.id ? '#' + el.id : '';
    var cls = el.className && typeof el.className === 'string'
      ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
    return el.tagName.toLowerCase() + id + cls;
  }

  var CHECKS = [
    {
      id: 'page-lang-missing',
      wcag: '3.1.1',
      absence: true,
      run: function (doc) {
        var lang = T.normalize(doc.documentElement.getAttribute('lang'));
        return lang ? [] : [{ detail: 'html element has no lang attribute' }];
      }
    },
    {
      id: 'main-landmark-missing',
      wcag: '1.3.1',
      absence: true,
      run: function (doc) {
        return doc.querySelector('main, [role="main"]')
          ? [] : [{ detail: 'no main landmark on the page' }];
      }
    },
    {
      id: 'skip-link-missing',
      wcag: '2.4.1',
      absence: true,
      run: function (doc) {
        var links = doc.querySelectorAll('a[href^="#"]');
        for (var i = 0; i < links.length; i++) {
          if (/skip/i.test(N.accessibleName(links[i]))) return [];
        }
        return [{ detail: 'no link whose name offers to skip to content' }];
      }
    },
    {
      id: 'skip-link-target-missing',
      wcag: '2.4.1',
      absence: false,
      run: function (doc) {
        var out = [];
        var links = doc.querySelectorAll('a[href^="#"]');
        for (var i = 0; i < links.length; i++) {
          var link = links[i];
          if (!/skip/i.test(N.accessibleName(link))) continue;
          var id = (link.getAttribute('href') || '').slice(1);
          var target = id ? doc.getElementById(id) : null;
          if (!target) {
            out.push({ detail: 'skip link points at missing id "' + id + '"' });
          } else if (!target.hasAttribute('tabindex') &&
                     !target.matches(NATIVELY_FOCUSABLE)) {
            out.push({ detail: 'skip link target "' + id + '" cannot take focus' });
          }
        }
        return out;
      }
    },
    {
      id: 'control-unnamed',
      wcag: '4.1.2',
      absence: false,
      run: function (doc) {
        var out = [];
        var all = doc.querySelectorAll(INTERACTIVE);
        for (var i = 0; i < all.length; i++) {
          var el = all[i];
          if (!visibleEnough(el)) continue;
          if (el.querySelector('img')) continue;   /* image-control-unnamed owns those */
          if (N.hasAccessibleName(el)) continue;
          out.push({ detail: 'control with no accessible name: ' + describe(el) });
        }
        return out;
      }
    },
    {
      id: 'image-control-unnamed',
      wcag: '4.1.2',
      absence: false,
      run: function (doc) {
        var out = [];
        var all = doc.querySelectorAll(INTERACTIVE);
        for (var i = 0; i < all.length; i++) {
          var el = all[i];
          if (!visibleEnough(el)) continue;
          if (!el.querySelector('img')) continue;
          if (N.hasAccessibleName(el)) continue;
          /* The control's only possible name was the image, and the image
             has none. This is the state a repair layer creates for itself
             when it clears a filename alt without asking what the image is
             doing. */
          out.push({ detail: 'control named only by an image with no alt: ' + describe(el) });
        }
        return out;
      }
    },
    {
      id: 'alt-is-filename',
      wcag: '1.1.1',
      absence: false,
      run: function (doc) {
        var out = [];
        var imgs = doc.querySelectorAll('img[alt]');
        for (var i = 0; i < imgs.length; i++) {
          var alt = imgs[i].getAttribute('alt');
          if (T.isFilenameAlt(alt)) out.push({ detail: 'alt is a filename: "' + alt + '"' });
        }
        return out;
      }
    },
    {
      id: 'iframe-unnamed',
      wcag: '4.1.2',
      absence: false,
      run: function (doc) {
        var out = [];
        var frames = doc.querySelectorAll('iframe, frame');
        for (var i = 0; i < frames.length; i++) {
          if (!N.hasAccessibleName(frames[i])) {
            out.push({ detail: 'frame with no title: ' + describe(frames[i]) });
          }
        }
        return out;
      }
    },
    {
      id: 'link-text-generic',
      wcag: '2.4.4',
      absence: false,
      run: function (doc) {
        var out = [];
        var links = doc.querySelectorAll('a[href], [role="link"]');
        for (var i = 0; i < links.length; i++) {
          var name = N.accessibleName(links[i]);
          if (T.isGenericLinkText(name)) {
            out.push({ detail: 'link name carries no purpose: "' + name + '"' });
          }
        }
        return out;
      }
    },
    {
      id: 'promoted-control-unreachable',
      wcag: '2.1.1',
      absence: false,
      run: function (doc) {
        var out = [];
        var all = doc.querySelectorAll('[role="button"], [role="link"], [role="tab"]');
        for (var i = 0; i < all.length; i++) {
          var el = all[i];
          if (!visibleEnough(el)) continue;
          if (el.matches(NATIVELY_FOCUSABLE)) continue;
          var tabindex = el.getAttribute('tabindex');
          if (tabindex === null || Number(tabindex) < 0) {
            out.push({ detail: 'element has a button role and no tab stop: ' + describe(el) });
          }
        }
        return out;
      }
    },
    {
      id: 'announcement-close-inert',
      wcag: '4.1.2',
      absence: false,
      run: function (doc) {
        var out = [];
        var all = doc.querySelectorAll('.sqs-announcement-bar-close, [data-a11y-announcement-close]');
        for (var i = 0; i < all.length; i++) {
          var el = all[i];
          var reasons = [];
          if (!N.hasAccessibleName(el)) reasons.push('no name');
          if (el.tagName !== 'BUTTON') {
            if (!el.getAttribute('role')) reasons.push('no role');
            var tabindex = el.getAttribute('tabindex');
            if (tabindex === null || Number(tabindex) < 0) reasons.push('no tab stop');
          }
          if (reasons.length) {
            out.push({ detail: 'announcement close is ' + reasons.join(', ') });
          }
        }
        return out;
      }
    }
  ];

  function runStatic(doc) {
    var out = [];
    CHECKS.forEach(function (check) {
      var findings;
      try {
        findings = check.run(doc) || [];
      } catch (err) {
        findings = [{ detail: 'check threw: ' + String(err && err.message || err) }];
      }
      findings.forEach(function (f) {
        out.push({ id: check.id, wcag: check.wcag, absence: !!check.absence, detail: f.detail });
      });
    });
    return out;
  }

  global.A11yChecks = {
    checks: CHECKS,
    ids: CHECKS.map(function (c) { return c.id; }),
    runStatic: runStatic
  };
})(typeof window !== 'undefined' ? window : this);

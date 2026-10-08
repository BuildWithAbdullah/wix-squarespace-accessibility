/* ---------------------------------------------------------------------------
   lib/accessible-name.js

   One accessible name computation, used by every rule and every audit.

   This file exists because of a defect rather than a principle. Five of the
   repair rules in this repository previously decided "is this control already
   named?" with their own inline expression, and all five agreed on the same
   wrong answer: they read textContent. A button whose only content is an
   image with correct alt text has an empty textContent and a perfectly good
   accessible name, so every one of those rules treated it as unnamed and
   appended a second name to it. The result on a real site is a control that
   announces "Close Close", produced by the layer that was installed to fix
   naming.

   Scope. This implements the part of accname that a repair layer on a closed
   platform actually needs, and nothing else:

     aria-labelledby, then aria-label, then the native host-language label,
     then title.

   What it does not implement is listed in docs/03-what-the-kit-cannot-reach.md
   and the short version is: no CSS generated content, no aria-describedby, no
   recursive traversal through further labelledby references, and no attempt
   to resolve a name through a cross-origin iframe. A repair layer that needs
   those is a repair layer that has been pushed past its honest limit.

   Exposed as window.A11yName.
   --------------------------------------------------------------------------- */

(function (global) {
  'use strict';

  var T = global.A11yText;

  /* Form controls take their name from a label, never from their contents.
     A select is named by its label, not by whichever option happens to be
     selected, and getting that wrong makes every unlabelled select on a site
     look labelled. */
  var NAME_FROM_LABEL = ['INPUT', 'SELECT', 'TEXTAREA', 'PROGRESS', 'METER'];

  /* Elements that contribute nothing to the name of an ancestor. */
  var NOT_RENDERED = ['SCRIPT', 'STYLE', 'TEMPLATE', 'NOSCRIPT', 'HEAD'];

  function isHidden(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.hasAttribute('hidden')) return true;
    if (el.getAttribute('aria-hidden') === 'true') return true;
    var doc = el.ownerDocument;
    var view = doc && doc.defaultView;
    if (!view || !view.getComputedStyle) return false;
    var style = view.getComputedStyle(el);
    return style.display === 'none' || style.visibility === 'hidden';
  }

  /* The text an element contributes when it is part of an ancestor's name.
     Images contribute their alt. This single line is the defect described at
     the top of the file. */
  function contributedText(node) {
    if (!node) return '';
    if (node.nodeType === 3) return node.nodeValue || '';
    if (node.nodeType !== 1) return '';
    if (NOT_RENDERED.indexOf(node.tagName) !== -1) return '';
    if (isHidden(node)) return '';

    var label = node.getAttribute('aria-label');
    if (T.normalize(label)) return ' ' + T.normalize(label) + ' ';

    if (node.tagName === 'IMG' || node.tagName === 'AREA') {
      return ' ' + T.normalize(node.getAttribute('alt')) + ' ';
    }
    if (node.tagName === 'SVG' || node.tagName === 'svg') {
      var titleEl = node.querySelector && node.querySelector('title');
      return titleEl ? ' ' + T.normalize(titleEl.textContent) + ' ' : '';
    }
    if (node.tagName === 'INPUT') {
      var type = (node.getAttribute('type') || '').toLowerCase();
      if (type === 'submit' || type === 'reset' || type === 'button') {
        return ' ' + T.normalize(node.value || node.getAttribute('value')) + ' ';
      }
      if (type === 'image') {
        return ' ' + T.normalize(node.getAttribute('alt')) + ' ';
      }
      return '';
    }
    if (NAME_FROM_LABEL.indexOf(node.tagName) !== -1) return '';

    var out = '';
    for (var i = 0; i < node.childNodes.length; i++) {
      out += contributedText(node.childNodes[i]);
    }
    return out;
  }

  function fromLabelledBy(el) {
    var ids = T.normalize(el.getAttribute('aria-labelledby'));
    if (!ids) return '';
    var doc = el.ownerDocument;
    var parts = [];
    ids.split(' ').forEach(function (id) {
      var target = doc.getElementById(id);
      if (!target) return;
      /* A referenced element contributes its own aria-label if it has one,
         and otherwise its text. It does not recurse into a further
         labelledby, which is where accname stops too. */
      var own = T.normalize(target.getAttribute('aria-label'));
      parts.push(own || T.normalize(contributedText(target)));
    });
    return T.normalize(parts.join(' '));
  }

  /* The native label of a form control: a wrapping label element, or one
     pointing at it with for. */
  function fromNativeLabel(el) {
    var doc = el.ownerDocument;
    var parts = [];
    if (el.id) {
      var forLabels = doc.querySelectorAll('label[for="' + CSS.escape(el.id) + '"]');
      for (var i = 0; i < forLabels.length; i++) {
        parts.push(T.normalize(contributedText(forLabels[i])));
      }
    }
    var wrapping = el.closest && el.closest('label');
    if (wrapping && parts.length === 0) {
      parts.push(T.normalize(contributedText(wrapping)));
    }
    return T.normalize(parts.join(' '));
  }

  /* The accessible name of an element, or the empty string when it has
     none. Never returns null, so callers cannot accidentally treat a missing
     name as a present one. */
  function accessibleName(el) {
    if (!el || el.nodeType !== 1) return '';

    var byRef = fromLabelledBy(el);
    if (byRef) return byRef;

    var label = T.normalize(el.getAttribute('aria-label'));
    if (label) return label;

    if (el.tagName === 'IMG' || el.tagName === 'AREA') {
      var alt = el.getAttribute('alt');
      /* alt="" is a deliberate statement that the image is decorative, and
         is a valid name of none. alt missing entirely is a defect. */
      if (alt !== null) return T.normalize(alt);
    }

    if (el.tagName === 'IFRAME' || el.tagName === 'FRAME') {
      return T.normalize(el.getAttribute('title'));
    }

    if (NAME_FROM_LABEL.indexOf(el.tagName) !== -1) {
      var native = fromNativeLabel(el);
      if (native) return native;
      var type = (el.getAttribute('type') || '').toLowerCase();
      if (el.tagName === 'INPUT' && (type === 'submit' || type === 'reset' || type === 'button')) {
        var v = T.normalize(el.value || el.getAttribute('value'));
        if (v) return v;
      }
      return T.normalize(el.getAttribute('title'));
    }

    var content = T.normalize(contributedText(el));
    if (content) return content;

    return T.normalize(el.getAttribute('title'));
  }

  function hasAccessibleName(el) {
    return accessibleName(el) !== '';
  }

  global.A11yName = {
    accessibleName: accessibleName,
    hasAccessibleName: hasAccessibleName,
    contributedText: contributedText
  };
})(typeof window !== 'undefined' ? window : this);

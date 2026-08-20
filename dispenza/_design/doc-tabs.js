/* ============================================================================
   doc-tabs.js — the service-page rail, driven as a tablist.
   Linked PER PAGE (like smoke-engine.js), not from the locked chrome: only the
   eight service pages mount a tablist, and a page that has none has no reason to
   fetch this.

   FAIL-OPEN BY CONSTRUCTION. The markup ships EVERY panel visible; the hiding is
   applied here, by script. If this file never loads, the page degrades to all
   panels stacked and readable — not to one visible panel and the rest permanently
   unreachable, which is what shipping `hidden` in the markup would cause. That is
   the same rule the reveal layer follows elsewhere on this site.
   ========================================================================== */
(function () {
  'use strict';

  function mount(root) {
    var tabs = [].slice.call(root.querySelectorAll('[data-tab]'));
    if (!tabs.length) return;

    var panels = tabs.map(function (t) {
      return document.getElementById(t.getAttribute('aria-controls'));
    });
    /* if ANY panel is missing, mount nothing: a half-wired tablist that hides four
       panels and cannot show them again is strictly worse than a plain stack. */
    if (panels.some(function (p) { return !p; })) return;

    function show(n, focus) {
      tabs.forEach(function (t, k) {
        var on = k === n;
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.setAttribute('tabindex', on ? '0' : '-1');
        panels[k].hidden = !on;
      });
      if (focus) tabs[n].focus();
    }

    tabs.forEach(function (t, k) {
      t.addEventListener('click', function () { show(k); });
      /* roving focus — what a vertical tablist owes a keyboard user */
      t.addEventListener('keydown', function (e) {
        var i = null;
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') i = (k + 1) % tabs.length;
        else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') i = (k - 1 + tabs.length) % tabs.length;
        else if (e.key === 'Home') i = 0;
        else if (e.key === 'End') i = tabs.length - 1;
        if (i !== null) { e.preventDefault(); show(i, true); }
      });
    });

    show(0);
  }

  function boot() {
    [].slice.call(document.querySelectorAll('[data-tabs]')).forEach(mount);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();

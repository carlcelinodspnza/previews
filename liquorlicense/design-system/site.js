/* =============================================================================
 * site.js — CANONICAL shared motion + chrome behavior for every client page.
 * Single source of truth: mobile-drawer toggle + scroll-reveal/stagger
 * (toggles .in-view) + count-up stats + subtle parallax.
 * Loaded via <script src="design-system/site.js" defer> on every page.
 * Null-safe: the drawer block is skipped on pages with no hamburger/drawer.
 * Targets the CANONICAL shared-chrome classes (.site-header__hamburger /
 * #mobile-drawer / .site-drawer-backdrop / .site-drawer__close) injected
 * identically on every page from _chrome.html.
 * All motion respects prefers-reduced-motion.
 *
 * ABOVE-THE-FOLD FIX (canonical): an IntersectionObserver does NOT reliably
 * (and on some loads does not at all) emit an entry for an element that is
 * ALREADY intersecting at first paint on a no-scroll load. structural.css
 * defaults .wow-reveal / .wow-stagger > * to opacity:0, un-hidden only when
 * .in-view is added, and .stat__num count-ups start at 0. So on a normal
 * (no-scroll) load the hero / first band could stay invisible and the stats
 * stay 0. This file does a MANUAL initial intersection check on init: any
 * reveal/stagger/count target already in OR above the viewport is revealed /
 * counted immediately, and only the rest is left to the observer. Belt-and-
 * braces: a requestAnimationFrame-deferred re-check after first layout.
 * ============================================================================= */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasIO = 'IntersectionObserver' in window;

  // True when the element's top is above the bottom of the viewport at first
  // paint — i.e. it is already in OR above the fold and must be shown on a
  // no-scroll load. Tolerant +1px so an element flush at the fold counts.
  function inOrAboveFold(el) {
    var r = el.getBoundingClientRect();
    var vh = window.innerHeight || document.documentElement.clientHeight;
    return r.top < vh + 1;
  }

  // ---- mobile drawer toggle (aria-expanded on hamburger + aria-hidden on drawer) ----
  // Skip when a page already wired the drawer inline (homepage carries its own
  // inline drawer script; this guard prevents a double-bind that would toggle twice).
  var alreadyWired = document.documentElement.getAttribute('data-drawer-wired') === '1';
  var hamburger = alreadyWired ? null : document.querySelector('.site-header__hamburger');
  var drawer = document.getElementById('mobile-drawer');
  var backdrop = document.querySelector('.site-drawer-backdrop');
  var closeBtn = document.querySelector('.site-drawer__close');
  function setDrawer(open) {
    hamburger.setAttribute('aria-expanded', String(open));
    drawer.setAttribute('aria-hidden', String(!open));
    if (backdrop) backdrop.setAttribute('data-open', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
  }
  if (hamburger && drawer) {
    hamburger.addEventListener('click', function () {
      var open = hamburger.getAttribute('aria-expanded') === 'true';
      setDrawer(!open);
    });
    if (closeBtn) closeBtn.addEventListener('click', function () { setDrawer(false); });
    if (backdrop) backdrop.addEventListener('click', function () { setDrawer(false); });
    drawer.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', function () { setDrawer(false); }); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setDrawer(false); });
    // FOCUS-TRAP + scroll-lock for the ported gold drawer: keep Tab inside the open
    // drawer and lock body scroll via the .mm-no-scroll class (structural.css owns the
    // overflow:hidden). Null-guarded — a page with no drawer never reaches here.
    document.addEventListener('keydown', function (e) {
      if (drawer.getAttribute('aria-hidden') !== 'false') return; // only while open
      if (e.key !== 'Tab') return;
      var f = Array.prototype.slice.call(drawer.querySelectorAll('a[href], button:not([disabled])'))
        .filter(function (el) { return el.offsetParent !== null || el === document.activeElement; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    // mirror the scroll-lock class onto <body> whenever the drawer opens/closes
    var lockObserver = new MutationObserver(function () {
      document.body.classList.toggle('mm-no-scroll', drawer.getAttribute('aria-hidden') === 'false');
    });
    lockObserver.observe(drawer, { attributes: true, attributeFilter: ['aria-hidden'] });
  }

  // =====================================================================
  // SCROLL-GLASS + STICKY-CTA REVEAL (ported gold chrome behavior)
  // The header turns glassy past a small scroll, and the mobile bottom
  // .mm-sticky-cta bar reveals past the fold. Null-guarded: a page without
  // either element simply does nothing.
  // =====================================================================
  var hdr = document.getElementById('site-header') || document.querySelector('.site-header');
  var stickyBar = document.getElementById('mm-sticky-cta') || document.querySelector('.mm-sticky-cta');
  if (hdr || stickyBar) {
    var onChromeScroll = function () {
      var y = window.scrollY || window.pageYOffset || 0;
      if (hdr) hdr.classList.toggle('scrolled', y > 24);
      if (stickyBar) stickyBar.classList.toggle('show', y > 480);
    };
    window.addEventListener('scroll', onChromeScroll, { passive: true });
    onChromeScroll();
  }

  // =====================================================================
  // DESKTOP GROUPED NAV — dropdown + mega-menu disclosure (ported gold)
  // Open on HOVER (CSS :hover on the li + a JS .is-open mirror so a pointer
  // that LEAVES keeps the panel open for a short close DELAY, defeating the
  // trigger→panel dead-gap — the .mm-panel::after hover-bridge spans it). Also
  // opens on click / keyboard. Keyboard: Enter/Space/ArrowDown opens + moves
  // into the panel; ArrowUp/Down/Home/End cycle items; Esc closes to trigger;
  // Tab + click-outside + blur-out close. Focus is managed into/out of the panel.
  // NULL-GUARDED: a page with no .mm-has-panel group skips this whole block.
  // =====================================================================
  var groups = Array.prototype.slice.call(document.querySelectorAll('.mm-has-panel'));
  if (groups.length) {
    var HOVER_CLOSE_DELAY = 240; // ms — keeps the menu open across a quick diagonal move
    var panelOf = function (group) { return group.querySelector('.mm-panel'); };
    var triggerOf = function (group) { return group.querySelector('.mm-trigger'); };
    var itemsOf = function (group) {
      var p = panelOf(group);
      return p ? Array.prototype.slice.call(p.querySelectorAll('a[href]')) : [];
    };
    var closeGroup = function (group, focusTrigger) {
      if (!group.classList.contains('is-open')) return;
      group.classList.remove('is-open');
      var t = triggerOf(group); if (t) t.setAttribute('aria-expanded', 'false');
      if (focusTrigger && t) t.focus();
    };
    var closeAllGroups = function (except) {
      groups.forEach(function (g) { if (g !== except) closeGroup(g, false); });
    };
    var openGroup = function (group, focusFirst) {
      closeAllGroups(group);
      group.classList.add('is-open');
      var t = triggerOf(group); if (t) t.setAttribute('aria-expanded', 'true');
      if (focusFirst) { var items = itemsOf(group); if (items.length) items[0].focus(); }
    };

    groups.forEach(function (group) {
      var trigger = triggerOf(group);
      var panel = panelOf(group);
      if (!trigger || !panel) return; // malformed group — skip safely
      var items = itemsOf(group);
      var closeTimer = null;
      var cancelClose = function () { if (closeTimer) { window.clearTimeout(closeTimer); closeTimer = null; } };
      var scheduleClose = function () { cancelClose(); closeTimer = window.setTimeout(function () { closeGroup(group, false); }, HOVER_CLOSE_DELAY); };

      // hover-intent: open immediately on enter, close on a delay (cursor can travel the bridged gap)
      group.addEventListener('pointerenter', function () { cancelClose(); openGroup(group, false); });
      group.addEventListener('pointerleave', scheduleClose);
      panel.addEventListener('pointerenter', cancelClose);

      // click toggles (works alongside hover)
      trigger.addEventListener('click', function (e) {
        e.preventDefault(); cancelClose();
        if (group.classList.contains('is-open')) closeGroup(group, false);
        else openGroup(group, false);
      });

      // keyboard on the trigger
      trigger.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
          e.preventDefault(); openGroup(group, true);
        } else if (e.key === 'Escape') {
          closeGroup(group, true);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault(); openGroup(group, true);
          var its = itemsOf(group); if (its.length) its[its.length - 1].focus();
        }
      });

      // keyboard inside the panel: cycle items, Home/End, Esc to trigger, Tab closes
      items.forEach(function (item, i) {
        item.addEventListener('keydown', function (e) {
          if (e.key === 'ArrowDown') { e.preventDefault(); (items[i + 1] || items[0]).focus(); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); (items[i - 1] || items[items.length - 1]).focus(); }
          else if (e.key === 'Home') { e.preventDefault(); items[0].focus(); }
          else if (e.key === 'End') { e.preventDefault(); items[items.length - 1].focus(); }
          else if (e.key === 'Escape') { e.preventDefault(); closeGroup(group, true); }
          else if (e.key === 'Tab') { closeGroup(group, false); }
        });
      });

      // close when focus leaves the whole group (blur-out)
      group.addEventListener('focusout', function (e) {
        if (!group.contains(e.relatedTarget)) closeGroup(group, false);
      });
    });

    // click outside any group closes all
    document.addEventListener('click', function (e) {
      if (!e.target.closest('.mm-has-panel')) closeAllGroups(null);
    });
  }

  // =====================================================================
  // DRAWER ACCORDIONS — .mm-acc groups expand / collapse inside the drawer
  // (ported gold). NULL-GUARDED: no .mm-acc__btn = nothing to wire.
  // =====================================================================
  var accBtns = Array.prototype.slice.call(document.querySelectorAll('.mm-acc__btn'));
  accBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var panel = document.getElementById(btn.getAttribute('aria-controls'));
      var open = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', open ? 'false' : 'true');
      if (panel) panel.classList.toggle('open', !open);
    });
  });

  // ---- scroll-reveal + stagger (toggles .in-view) ----
  var revealTargets = document.querySelectorAll('.wow-reveal, .wow-stagger');
  if (reduce || !hasIO) {
    // Reduced-motion or no IO support: reveal everything immediately.
    revealTargets.forEach(function (el) { el.classList.add('in-view'); });
  } else {
    var io = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { entry.target.classList.add('in-view'); obs.unobserve(entry.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    // (a) MANUAL initial intersection: reveal anything already in/above the
    //     viewport at first paint so a no-scroll load is never blank above fold.
    // (b) observe the rest for on-scroll reveal.
    revealTargets.forEach(function (el) {
      if (inOrAboveFold(el)) { el.classList.add('in-view'); }
      else { io.observe(el); }
    });
    // Belt-and-braces: re-run the initial check after layout settles. Web-font
    // swap (Fraunces/Inter load async), late images, and reflows can shift an
    // element INTO the fold AFTER first paint — past a single rAF — leaving a
    // card peeking at the fold edge permanently opacity:0. Re-check on rAF,
    // font-ready, full load, and two short timeouts; reveal any not-yet-shown
    // element now in/above the fold.
    var recheck = function () {
      revealTargets.forEach(function (el) {
        if (!el.classList.contains('in-view') && inOrAboveFold(el)) {
          el.classList.add('in-view'); io.unobserve(el);
        }
      });
    };
    requestAnimationFrame(recheck);
    if (document.fonts && document.fonts.ready && document.fonts.ready.then) { document.fonts.ready.then(recheck); }
    window.addEventListener('load', recheck);
    setTimeout(recheck, 200);
    setTimeout(recheck, 600);
  }

  // ---- count-up stats ----
  // Format a numeric value with en-US thousands grouping on the INTEGER part
  // while preserving the exact decimal count (4.9 -> "4.9", never "4.900";
  // 40000 -> "40,000"; 2400000000 -> "2,400,000,000"). Built from toFixed so
  // the decimal count matches data-count exactly, then commas are injected only
  // into the integer digits — avoids toLocaleString stripping/locale quirks.
  function groupNum(value, decimals) {
    var fixed = value.toFixed(decimals);          // e.g. "40000" or "4.9"
    var neg = fixed.charAt(0) === '-';
    if (neg) fixed = fixed.slice(1);
    var dot = fixed.indexOf('.');
    var intPart = dot === -1 ? fixed : fixed.slice(0, dot);
    var fracPart = dot === -1 ? '' : fixed.slice(dot);   // includes the '.'
    intPart = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (neg ? '-' : '') + intPart + fracPart;
  }
  function animateCount(el) {
    if (el.getAttribute('data-counted') === '1') return;
    el.setAttribute('data-counted', '1');
    var raw = el.getAttribute('data-count');
    var target = parseFloat(raw) || 0;
    var suffix = el.getAttribute('data-suffix') || '';
    var decimals = (String(raw).split('.')[1] || '').length;
    // EXACT final string the animation MUST land on (snap target). Computed
    // once so the last frame is value-identical to data-count (grouped), never a
    // rounded intermediate (fixes 184≠183 / 4000≠3973: the final frame ==
    // grouped data-count) and never an ungrouped 40000 next to a "40,000" label.
    var finalText = groupNum(target, decimals) + suffix;
    if (reduce) { el.textContent = finalText; return; }
    var dur = 1500, start = null;
    function frame(ts) {
      if (start === null) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      if (p >= 1) { el.textContent = finalText; return; } // snap to exact target; do NOT schedule another frame
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = groupNum(target * eased, decimals) + suffix;
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }
  var counts = document.querySelectorAll('.stat__num[data-count]');
  if (reduce || !hasIO) {
    counts.forEach(animateCount);
  } else {
    // SCROLLED-PAST FIX: a count IO that only fires while the element is
    // intersecting freezes any stat the viewport jumps PAST without settling on
    // (a fast user scroll, OR a multi-band page where a programmatic scroll to a
    // later band leaves an earlier band scrolled far above the fold). On every IO
    // callback animate the target if it is intersecting OR has already been
    // reached/passed (its top is above the bottom of the viewport). threshold:0
    // so the callback fires the instant any pixel enters AND when it leaves the
    // top — either delivery animates it. Belt-and-braces with the initial check.
    var cio = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting || inOrAboveFold(entry.target)) {
          animateCount(entry.target); obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0 });
    // MANUAL initial check: any count already in/above the fold animates now
    // (otherwise above-the-fold stats stay frozen at 0 on a no-scroll load).
    counts.forEach(function (el) {
      if (inOrAboveFold(el)) { animateCount(el); }
      else { cio.observe(el); }
    });
    // Belt-and-braces (mirrors the reveal re-check): after first layout settles,
    // animate any not-yet-counted stat that is now in/above the fold.
    requestAnimationFrame(function () {
      counts.forEach(function (el) {
        if (el.getAttribute('data-counted') !== '1' && inOrAboveFold(el)) {
          animateCount(el); cio.unobserve(el);
        }
      });
    });
    // SCROLL-DRIVEN SWEEP: an IntersectionObserver does NOT deliver a callback for
    // an element the viewport JUMPS PAST in a single frame (an instant scrollIntoView
    // to a later band, or a flung scroll), so a stat scrolled far above the fold can
    // stay observed-but-never-fired (frozen at 0). On every scroll, animate any
    // not-yet-counted stat now in OR above the fold — the reliable catch the IO
    // can't guarantee. rAF-throttled; self-removes once all counts have fired.
    var countTick = false;
    function sweepCounts() {
      countTick = false;
      var remaining = 0;
      counts.forEach(function (el) {
        if (el.getAttribute('data-counted') === '1') return;
        if (inOrAboveFold(el)) { animateCount(el); cio.unobserve(el); }
        else remaining++;
      });
      if (remaining === 0) window.removeEventListener('scroll', onCountScroll);
    }
    function onCountScroll() {
      if (countTick) return;
      countTick = true;
      requestAnimationFrame(sweepCounts);
    }
    window.addEventListener('scroll', onCountScroll, { passive: true });
  }

  // ---- subtle parallax (transform on .wow-parallax; rAF-throttled) ----
  if (!reduce) {
    var px = document.querySelectorAll('.wow-parallax');
    if (px.length) {
      var ticking = false;
      window.addEventListener('scroll', function () {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(function () {
          var y = window.scrollY;
          px.forEach(function (el) {
            var speed = parseFloat(el.getAttribute('data-parallax')) || 0.12;
            el.style.transform = 'translateY(' + (y * speed) + 'px)';
          });
          ticking = false;
        });
      }, { passive: true });
    }
  }
})();

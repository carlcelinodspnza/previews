/* =============================================================================
   DISPENZA PAGE EFFECTS - the shared motion/behaviour engine.

   WHY THIS FILE EXISTS: every effect on this site (scroll reveals, the number
   counters, gauges, decks, parallax, accordions, dividers, case tabs, the client
   marquee) lived INLINE in the foundation specimen. Nothing linked it, so the
   locked chrome template loaded ZERO scripts and every built inner page was
   completely inert - 1 data-* hook across a whole page against the foundation's 31.
   Extracted verbatim so one engine drives every page.

   THE SAFETY RULE THIS FILE ENCODES - read before editing:
     .js [data-reveal]        { opacity: 0 }      <- hidden
     .js [data-reveal].is-in  { opacity: 1 }      <- revealed
   The hiding is scoped to `.js`, which is set by SCRIPT. So:
     - no script at all  -> nothing is hidden. FAILS OPEN. Content is readable.
     - `.js` set, observer never runs -> EVERY revealed element is invisible FOREVER.
   Therefore the `.js` flag is set HERE, in the same file as the observer, and only
   after the observer is installed. It must NEVER be moved into the chrome or into a
   separate tag: a 404 on this file would then blank the content of every page.
   ============================================================================= */
(function () {
  'use strict';

  function boot() {
    /* ---- MARQUEE - pause when offscreen ---- */
    (function () {
      /* An infinite loop needs three brakes and the DS pattern supplies two
         (pause-on-hover, reduced-motion). This is the third: stop when nobody is
         looking. A marquee is on the owner's forbidden list because autoplay motion
         steals attention -- and motion nobody can see steals CPU for nothing. */
      var mq = document.querySelector('.mc-marquee');
      if (!mq || !('IntersectionObserver' in window)) { return; }
      new IntersectionObserver(function (es) {
        es.forEach(function (en) { mq.classList.toggle('is-offscreen', !en.isIntersecting); });
      }, { threshold: 0 }).observe(mq);
    })();

    /* ---- DIVIDERS ---- */
    (function () {
          /* THE HERO'S LIGHT, ON A HAIRLINE, and it has NO TIMELINE, which is what
             keeps it off the forbidden list. The spec bans animated gradients and
             anything looping in the viewport; nothing here repeats. The bright
             segment's position is a pure function of how far the rule has crossed the
             viewport, the same drive hero-field.js uses: alive while the visitor
             scrolls, perfectly still the moment they stop. */
          var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
          [].slice.call(document.querySelectorAll('[data-divider]')).forEach(function (el) {
            var light = el.querySelector('.mc-divider__light');
            if (!light) { return; }

            function place() {
              var box = el.getBoundingClientRect();
              var p = 1 - (box.top + box.height) / (window.innerHeight + box.height);
              if (p < 0) { p = 0; } else if (p > 1) { p = 1; }
              light.style.transform = 'translate3d(' + (p * el.clientWidth).toFixed(1) + 'px,0,0)';
            }

            if (reduce.matches) {
              /* frozen, but placed mid-rule so the resting divider is LIT, not dark */
              light.style.transform = 'translate3d(' + (el.clientWidth * 0.5).toFixed(1) + 'px,0,0)';
            } else {
              place();
              window.addEventListener('scroll', place, { passive: true });
              window.addEventListener('resize', place);
            }
          });
        }());

    /* ---- CASE TABS ---- */
    (function () {
          /* NO TIMELINE, so it is not the autoplay carousel the motion spec bans: it
             moves on a click or a key and never on its own. One panel open at a time.
             The panels are only ever CLIPPED by their card, never removed, so all four
             clients' numbers stay in the DOM and in the accessibility tree whatever is
             open. aria-expanded is what tells assistive tech which one is showing. */
          var wrap = document.querySelector('[data-cases]');
          if (!wrap) { return; }
          var cases = [].slice.call(wrap.querySelectorAll('[data-case]'));

          function open(card) {
            cases.forEach(function (c) {
              var on = (c === card);
              c.classList.toggle('is-open', on);
              var t = c.querySelector('[data-case-tab]');
              if (t) { t.setAttribute('aria-expanded', on ? 'true' : 'false'); }
            });
          }

          cases.forEach(function (c, i) {
            var tab = c.querySelector('[data-case-tab]');
            if (!tab) { return; }
            tab.addEventListener('click', function () { open(c); });
            tab.addEventListener('keydown', function (e) {
              var n = null;
              if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { n = cases[(i + 1) % cases.length]; }
              if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   { n = cases[(i - 1 + cases.length) % cases.length]; }
              if (!n) { return; }
              e.preventDefault();
              open(n);
              n.querySelector('[data-case-tab]').focus();
            });
          });
        }());

    /* ---- THE ENGINE - reveal, counters, gauges, decks, parallax, accordions ---- */
    /* ---------------------------------------------------------------------------
       PART A . CHROME BEHAVIOUR. Sourced verbatim from the locked chrome winner
       (chrome concept 1). Not re-derived here.
       --------------------------------------------------------------------------- */
    (function () {
      'use strict';

      var doc = document;
      var root = doc.documentElement;

      /* 1. RAIL STATE. Transparent over the hero; glass plus hairline plus the single
            violet edge-catch past 8px of scroll. */
      var shell = doc.getElementById('rail-shell');
      function syncRail() {
        if (!shell) return;
        if (window.pageYOffset > 8) shell.classList.add('is-stuck');
        else shell.classList.remove('is-stuck');
      }
      syncRail();
      window.addEventListener('scroll', syncRail, { passive: true });

      /* 2. GROUP PANELS. */
      var dock = doc.getElementById('rail-dock');
      var triggers = [].slice.call(doc.querySelectorAll('[data-panel]'));

      function setPanel(trigger, open) {
        var panel = doc.getElementById(trigger.getAttribute('data-panel'));
        if (!panel) return;
        trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (open) panel.classList.add('is-open');
        else panel.classList.remove('is-open');
      }
      function closePanels(except) {
        triggers.forEach(function (t) { if (t !== except) setPanel(t, false); });
      }

      triggers.forEach(function (trigger) {
        trigger.addEventListener('click', function () {
          var open = trigger.getAttribute('aria-expanded') === 'true';
          closePanels(trigger);
          setPanel(trigger, !open);
        });
        var group = trigger.parentNode;
        group.addEventListener('mouseenter', function () {
          if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
            closePanels(trigger);
            setPanel(trigger, true);
          }
        });
      });

      if (dock) {
        dock.addEventListener('mouseleave', function () {
          if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) closePanels(null);
        });
      }
      doc.addEventListener('click', function (e) {
        if (dock && !dock.contains(e.target)) closePanels(null);
      });

      /* 3. DRAWER. */
      var burger = doc.getElementById('hamburger');
      var drawer = doc.getElementById('mobile-drawer');
      var scrim = doc.getElementById('drawer-scrim');
      var closeBtn = doc.getElementById('drawer-close');

      function openDrawer() {
        if (!drawer) return;
        root.classList.add('is-drawer-open');
        if (scrim) scrim.removeAttribute('hidden');
        if (burger) { burger.setAttribute('aria-expanded', 'true'); burger.setAttribute('aria-label', 'Close menu'); }
        doc.body.style.overflow = 'hidden';
        if (closeBtn) closeBtn.focus();
      }
      function closeDrawer() {
        if (!drawer || !root.classList.contains('is-drawer-open')) return;
        root.classList.remove('is-drawer-open');
        if (scrim) scrim.setAttribute('hidden', '');
        if (burger) { burger.setAttribute('aria-expanded', 'false'); burger.setAttribute('aria-label', 'Open menu'); burger.focus(); }
        doc.body.style.overflow = '';
      }
      if (burger) burger.addEventListener('click', function () {
        if (root.classList.contains('is-drawer-open')) closeDrawer(); else openDrawer();
      });
      if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
      if (scrim) scrim.addEventListener('click', closeDrawer);

      doc.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { closePanels(null); closeDrawer(); }
      });

      [].slice.call(doc.querySelectorAll('[data-acc]')).forEach(function (trigger) {
        trigger.addEventListener('click', function () {
          var sub = doc.getElementById(trigger.getAttribute('data-acc'));
          if (!sub) return;
          var open = trigger.getAttribute('aria-expanded') === 'true';
          trigger.setAttribute('aria-expanded', open ? 'false' : 'true');
          if (open) sub.classList.remove('is-open');
          else sub.classList.add('is-open');
        });
      });

      /* 4. STICKY ACTION BAR. */
      var sticky = doc.getElementById('sticky-cta');
      var footer = doc.querySelector('.site-footer');
      if (sticky && footer && 'IntersectionObserver' in window) {
        var io = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            sticky.classList.toggle('is-hidden', entry.isIntersecting);
          });
        }, { rootMargin: '0px 0px -8% 0px' });
        io.observe(footer);
      }

      /* SERVICES preview — mirrors the hovered/focused row, rests on 01.
         PURELY ADDITIVE: if this block never runs, the preview simply stays on Performance marketing and
         all eight links keep working. It is a decoration over information that is already on screen. */
      var pvNum = doc.getElementById('svc-pv-num');
      var pvTitle = doc.getElementById('svc-pv-title');
      var pvDesc = doc.getElementById('svc-pv-desc');
      if (pvNum && pvTitle && pvDesc) {
        var svcRows = [].slice.call(doc.querySelectorAll('.svc-row'));
        var rest = { n: '01', t: 'Performance marketing', d: 'Paid and organic demand for a licensed dispensary.' };
        var showSvc = function (o) { pvNum.textContent = o.n; pvTitle.textContent = o.t; pvDesc.textContent = o.d; };
        svcRows.forEach(function (row) {
          var o = {
            n: row.getAttribute('data-n') || rest.n,
            t: row.getAttribute('data-title') || rest.t,
            d: row.getAttribute('data-desc') || rest.d
          };
          row.addEventListener('mouseenter', function () { showSvc(o); });
          row.addEventListener('focus', function () { showSvc(o); });
        });
        var svcList = doc.querySelector('.svc-list');
        if (svcList) svcList.addEventListener('mouseleave', function () { showSvc(rest); });
      }
    })();


    /* ---------------------------------------------------------------------------
       PART B . BODY MOTION. This is the concept's motion, and it is deliberately
       small: one reveal gesture, one media scale in, one gentle drift, one count up.
       Every branch below fails to the fully visible resting state.
       --------------------------------------------------------------------------- */
    (function () {
      'use strict';

      var doc = document;
      var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

      /* GAUGE GEOMETRY, DECLARED UP HERE ON PURPOSE.
         These were originally declared beside initGauge, further down. `var`
         declarations hoist but their ASSIGNMENTS do not -- and the reduced-motion
         branch below returns early, calling initGauge before that assignment ever
         ran. initGauge itself is a hoisted function declaration so the call
         succeeded; the constants inside it were simply `undefined`, and every tick
         coordinate came out NaN. The console said "attribute x1: Expected length,
         NaN" and the arc silently stayed empty for every reduced-motion visitor.
         Declaring them before the first possible use removes the ordering hazard. */
      var GA_R = 78, GA_CIRC = 2 * Math.PI * GA_R, GA_ARC = GA_CIRC * 270 / 360;
      var GA_START = 135, GA_SWEEP = 270;

      function show(el) { el.classList.add('is-in'); }

      function paintFinalCounts() {
        [].slice.call(doc.querySelectorAll('[data-count-to]')).forEach(function (node) {
          var to = parseFloat(node.getAttribute('data-count-to'));
          var dec = parseInt(node.getAttribute('data-count-dec') || '0', 10);
          var suffix = node.getAttribute('data-count-suffix') || '';
          var prefix = node.getAttribute('data-count-prefix') || '';
          if (isFinite(to)) node.textContent = prefix + to.toFixed(dec) + suffix;
          node.setAttribute('data-counted', '1');
        });
      }

      var targets = [].slice.call(doc.querySelectorAll('[data-reveal],[data-media-in]'));

      /* REDUCED MOTION, or no IntersectionObserver at all: everything is placed in its
         resting visible state immediately and no observer is created. */
      if (reduce.matches || !('IntersectionObserver' in window)) {
        targets.forEach(show);
        paintFinalCounts();
        /* THE GAUGES TOO. This branch returns before the observer is built, and the
           gauges are driven FROM that observer -- so without this a reduced-motion
           visitor got an empty ring where the arc should be. Measured: dasharray
           stuck at 0. Reduced motion means no ANIMATION, not no artwork. */
        [].slice.call(doc.querySelectorAll('[data-gauge]')).forEach(initGauge);
        return;
      }

      /* COUNT UP. The final value is already in the markup, so the animation only ever
         replaces text it is about to restore. */
      function countUp(node) {
        if (node.getAttribute('data-counted') === '1') return;
        node.setAttribute('data-counted', '1');
        var to = parseFloat(node.getAttribute('data-count-to'));
        var dec = parseInt(node.getAttribute('data-count-dec') || '0', 10);
        var suffix = node.getAttribute('data-count-suffix') || '';
        /* PREFIX SUPPORT. The counter REPLACES textContent, so anything authored
           around the number is destroyed when it runs -- the eight city figures are
           corpus verbatims of the form "+51.37%", and without this the leading "+"
           was silently dropped on every one of them the moment the section scrolled
           into view. Additive: absent the attribute this is '' and nothing changes.
           BOTH paths need it -- the animated one here and paintFinalCounts above,
           which is what a reduced-motion visitor gets. */
        var prefix = node.getAttribute('data-count-prefix') || '';
        if (!isFinite(to)) return;
        var start = null;
        var dur = 1400;
        function frame(t) {
          if (start === null) start = t;
          var p = Math.min((t - start) / dur, 1);
          var eased = 1 - Math.pow(1 - p, 3);
          node.textContent = prefix + (to * eased).toFixed(dec) + suffix;
          if (p < 1) window.requestAnimationFrame(frame);
          else node.textContent = prefix + to.toFixed(dec) + suffix;
        }
        window.requestAnimationFrame(frame);
      }

      /* ---------------------------------------------------------------------------
         THE SERVICE GAUGE. Revs like a tachometer, not like a dial.

         A tachometer does not ease to a stop, it overshoots and damps -- that is a
         second-order response, so it is written as one rather than approximated with
         keyframes:
             v(t) = target * (1 - e^(-zwt) * (cos(wd t) + (zw/wd) sin(wd t)))
         zeta 0.69 and omega 4.82 are solved from the two properties wanted, not
         dialled in by eye:
             overshoot = e^(-z*pi/sqrt(1-z^2)) = 5.0%
             peak time = pi/wd                 = 0.90s
         After settling, a small irregular flutter holds it at "high RPM": three
         mutually prime frequencies with a breathing amplitude, so it never reads as
         a loop. prefers-reduced-motion paints the settled state and starts no loop.
         --------------------------------------------------------------------------- */
      /* THE SCALE IS PER GAUGE, and it carries headroom on purpose. With the arc
         topping out at the target the rev is invisible -- the overshoot clamps and
         the needle just arrives. A max slightly above the value leaves the arc room
         to swing past and settle back, which is the whole gesture. */

      function initGauge(host) {
        if (host.getAttribute('data-gauge-on') === '1') { return; }
        host.setAttribute('data-gauge-on', '1');
        var target = parseFloat(host.getAttribute('data-gauge-to')) || 0;
        var GA_MAX = parseFloat(host.getAttribute('data-gauge-max')) || 10;
        var arc   = host.querySelector('.g-arc');
        var bloom = host.querySelector('.g-bloom');
        var knob  = host.querySelector('.g-knob');
        var halo  = host.querySelector('.g-halo');
        var numEl = host.querySelector('.mc-gauge__n');
        var tickG = host.querySelector('.g-ticks');

        var N = 30, tickEls = [], tickAt = [];
        for (var i = 0; i < N; i++) {
          var f = i / (N - 1), a = (GA_START + GA_SWEEP * f) * Math.PI / 180;
          var ln = doc.createElementNS('http://www.w3.org/2000/svg', 'line');
          ln.setAttribute('x1', (110 + 60 * Math.cos(a)).toFixed(2));
          ln.setAttribute('y1', (110 + 60 * Math.sin(a)).toFixed(2));
          ln.setAttribute('x2', (110 + 66 * Math.cos(a)).toFixed(2));
          ln.setAttribute('y2', (110 + 66 * Math.sin(a)).toFixed(2));
          ln.setAttribute('stroke-width', '1.6');
          ln.setAttribute('stroke-linecap', 'round');
          ln.setAttribute('stroke', 'var(--ds-line)');
          tickG.appendChild(ln); tickEls.push(ln); tickAt.push(f * GA_MAX);
        }

        function paint(v, glow) {
          var c = Math.max(0, Math.min(GA_MAX, v));
          var len = GA_ARC * (c / GA_MAX);
          arc.setAttribute('stroke-dasharray',   len.toFixed(2) + ' ' + GA_CIRC.toFixed(2));
          bloom.setAttribute('stroke-dasharray', len.toFixed(2) + ' ' + GA_CIRC.toFixed(2));
          bloom.setAttribute('opacity', glow.toFixed(3));
          var a = (GA_START + GA_SWEEP * (c / GA_MAX)) * Math.PI / 180;
          var kx = 110 + GA_R * Math.cos(a), ky = 110 + GA_R * Math.sin(a);
          knob.setAttribute('cx', kx.toFixed(2)); knob.setAttribute('cy', ky.toFixed(2));
          halo.setAttribute('cx', kx.toFixed(2)); halo.setAttribute('cy', ky.toFixed(2));
          knob.setAttribute('opacity', '1');
          halo.setAttribute('opacity', (0.5 + glow * 0.45).toFixed(3));
          numEl.textContent = String(Math.round(c));
          for (var i = 0; i < tickEls.length; i++) {
            tickEls[i].setAttribute('stroke',
              tickAt[i] <= c + 0.08 ? 'var(--ds-accent-light)' : 'var(--ds-line)');
          }
        }

        if (reduce.matches) { paint(target, 0.5); return; }

        var Z = 0.69, W = 4.82, WD = W * Math.sqrt(1 - Z * Z);
        var t0 = null, seated = false;
        function step(now) {
          if (t0 === null) { t0 = now; }
          var t = (now - t0) / 1000, v, glow;
          if (!seated) {
            var e = Math.exp(-Z * W * t);
            var s1 = 1 - e * (Math.cos(WD * t) + (Z * W / WD) * Math.sin(WD * t));
            var eP = Math.exp(-Z * W * Math.max(0, t - 1/60));
            var s0 = 1 - eP * (Math.cos(WD * Math.max(0,t-1/60)) + (Z*W/WD) * Math.sin(WD * Math.max(0,t-1/60)));
            v = target * s1;
            glow = Math.min(1, Math.abs(target * (s1 - s0)) * 3.4 + 0.28);
            if (t >= 1.45) { seated = true; }
          } else {
            var fl = (Math.sin(t*17.3)*0.62 + Math.sin(t*26.9)*0.38 + Math.sin(t*41.7)*0.22)
                   * (0.72 + 0.28*Math.sin(t*3.1)) * 1.5;      /* degrees */
            v = target + fl / GA_SWEEP * GA_MAX;
            glow = 0.40 + Math.abs(fl) * 0.5;
          }
          paint(v, glow);
          window.requestAnimationFrame(step);
        }
        window.requestAnimationFrame(step);
      }

      /* ---------------------------------------------------------------------------
         THE DECK. A row, and manual.

         The owner's motion spec forbids "autoplay carousels": there is no timer in
         here. It moves on a button, a drag, or an arrow key. That rule exists to
         stop content sliding out from under a reader, and a control that only moves
         on input is the opposite of that failure.

         IT WAS A FAN UNTIL THE MAP NEEDED ROOM. The overlapping stack put two of its
         three cards behind the front one at reduced opacity, spending horizontal
         space on decoration — and that space was the same space the map was starving
         for. A row weights all three equally and lets the frame edge imply the rest,
         which is what the reference does.

         THE STYLESHEET OWNS THE CARD WIDTH, not this script. The width is derived
         from the track so that three cards plus a peek of the fourth always fit,
         with a floor at the width the longest figure actually needs. This script
         only reads the resulting pitch off two real cards and translates by it.

         ALL EIGHT CARDS STAY IN THE DOM and in the accessibility tree — the track is
         translated, never emptied — so nothing is hidden from a screen reader, from
         find-in-page, or from verify-copy-fidelity.
         --------------------------------------------------------------------------- */
      [].slice.call(doc.querySelectorAll('[data-deck]')).forEach(function (root) {
        var vp    = root.querySelector('.mc-deck__viewport');
        var stage = root.querySelector('.mc-deck__stage');
        var cards = [].slice.call(stage.querySelectorAll('.mc-result'));
        var prev  = root.querySelector('[data-deck-prev]');
        var next  = root.querySelector('[data-deck-next]');
        var count = root.querySelector('[data-deck-count]');
        if (!cards.length) { return; }

        var i = 0;

        /* the row is applied by script, so with JS off the stage stays a plain
           readable column rather than eight cards jammed into one viewport */
        root.classList.add('is-slider');

        function pad(n) { return (n < 10 ? '0' : '') + n; }

        /* MEASURED, NOT ASSUMED. The pitch is read off two real cards, so it carries
           whatever the gap token resolves to at this width -- and the card width is
           set by the stylesheet from the track, not by this script. */
        function pitch() {
          if (cards.length < 2) { return cards[0].getBoundingClientRect().width; }
          return cards[1].getBoundingClientRect().left - cards[0].getBoundingClientRect().left;
        }
        function visible() {
          var p = pitch();
          if (!p) { return 1; }
          return Math.max(1, Math.floor((vp.clientWidth + 2) / p));
        }

        function render() {
          var max = Math.max(0, cards.length - visible());
          if (i > max) { i = max; }
          if (i < 0)   { i = 0; }

          stage.style.transform = 'translate3d(' + (-i * pitch()) + 'px,0,0)';
          count.textContent = pad(i + 1) + ' / ' + pad(cards.length);
          /* THE ROW HAS ENDS, so the buttons tell the truth about them. The fan
             wrapped and therefore never disabled; a row that silently refuses to
             move is worse than one that shows it cannot. */
          prev.disabled = (i <= 0);
          next.disabled = (i >= max);
        }

        function go(d) { i += d; render(); }
        prev.addEventListener('click', function () { go(-1); });
        next.addEventListener('click', function () { go(1); });

        /* keyboard: the bar is focusable through its buttons, and the deck answers
           the arrow keys once anything inside it has focus */
        root.addEventListener('keydown', function (e) {
          if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
          if (e.key === 'ArrowLeft')  { e.preventDefault(); go(-1); }
        });

        /* drag / swipe -- a row is a thing you push, so it should be */
        var x0 = 0, dragging = false, moved = 0;
        stage.addEventListener('pointerdown', function (e) {
          dragging = true; x0 = e.clientX; moved = 0;
          stage.setPointerCapture(e.pointerId);
        });
        stage.addEventListener('pointermove', function (e) {
          if (!dragging) { return; }
          moved = e.clientX - x0;
        });
        stage.addEventListener('pointerup', function (e) {
          if (!dragging) { return; }
          dragging = false;
          stage.releasePointerCapture(e.pointerId);
          if (Math.abs(moved) > 40) { go(moved < 0 ? 1 : -1); }
        });

        window.addEventListener('resize', render);
        render();
      });

      /* THE ONE GESTURE. Fires once, at 15% viewport entry. */
      var obs = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          show(entry.target);
          obs.unobserve(entry.target);
          if (entry.target.hasAttribute('data-gauge')) { initGauge(entry.target); }
          /* querySelectorAll, NOT querySelector. This was SINGULAR, so a reveal target holding
             more than one counter animated only its FIRST one. Measured across the site: 35 of
             103 counters never ran, and sibling pages built from the same template disagreed -
             frances/sergio/shay/thomas put one data-reveal on <ul class="tc-metrics"> wrapping 8
             <li> and animated 1 of 8, while james/nick put it on each <li> and animated 11 of 11.
             Nothing was ever WRONG - a non-animating counter still shows its exact source string,
             which is why this reads as a missing effect rather than a defect - but the treatment
             was inconsistent for no reason. Also match the target ITSELF: querySelectorAll never
             returns the element it is called on, so a counter carrying its own data-reveal was
             likewise skipped. countUp() is idempotent (it early-returns on data-counted="1"), so
             widening this cannot double-run anything. */
          var ns = entry.target.hasAttribute('data-count-to')
            ? [entry.target]
            : [].slice.call(entry.target.querySelectorAll('[data-count-to]'));
          ns.forEach(function (n) { countUp(n); });
        });
      }, { rootMargin: '0px 0px -15% 0px', threshold: 0 });

      targets.forEach(function (el) { obs.observe(el); });

      /* PARALLAX. 0.94x, which is a 6% differential, capped so the drift can never
         exceed the image overscan. Transform only, written as a custom property so the
         scale in and the drift compose in a single CSS declaration. rAF throttled. */
      var bands = [].slice.call(doc.querySelectorAll('[data-parallax]'));
      var ticking = false;

      function drift() {
        ticking = false;
        var vh = window.innerHeight || 1;
        bands.forEach(function (band) {
          var r = band.getBoundingClientRect();
          if (r.bottom < 0 || r.top > vh) return;
          /* progress runs from 1 to -1 as the band crosses the viewport */
          var progress = ((r.top + r.height / 2) - vh / 2) / (vh / 2 + r.height / 2);
          if (progress > 1) progress = 1;
          if (progress < -1) progress = -1;
          var travel = Math.min(r.height * 0.06, 40);
          band.style.setProperty('--ds-par', (progress * travel).toFixed(2) + 'px');
        });
      }
      function onScroll() {
        if (ticking) return;
        ticking = true;
        window.requestAnimationFrame(drift);
      }
      if (bands.length) {
        drift();
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onScroll, { passive: true });
      }
    })();


    // LAST: only now claim scripting. Everything above is registered, so the hide
    // rule can never outlive the code that undoes it.
    document.documentElement.className += ' js';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();

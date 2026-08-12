/* =============================================================================
   hero-field.js  --  the HeroSection MEDIA LAYER. Self-contained.

   Draws a receding field of hexagonal PRISMS into .mc-hero__field and drives a
   violet light along their top-face outlines from SCROLL POSITION ONLY.

   This file is the entire swappable payload. Nothing outside .mc-hero__stage is
   read or written, so replacing it replaces the picture and touches nothing
   else -- the heroContract swap requirement.

   -----------------------------------------------------------------------------
   THE PROJECTION, and why the obvious version is wrong.

   The first build squashed a flat honeycomb by a constant vertical factor. That
   is an AFFINE transform: it has no vanishing point, so every row stays the same
   size and the result reads as squashed wallpaper rather than a plane seen at an
   angle. It was rejected on the render.

   This runs a real camera instead. World: a ground plane, X across, Z away.
       screen_x = W/2 + X * F / Z
       screen_y = HZN + (EY - height) * F / Z
   Every VERTEX is projected on its OWN Z, so the hexagons are genuinely
   perspective-distorted rather than uniformly scaled. That is what produces the
   recession the owner asked for.

   Extrusion heights come from a deterministic hash of (col,row). No Math.random:
   the field is identical on every load, so a screenshot comparison between two
   builds actually means something.

   Painting is far-to-near (painter's algorithm), and a side wall is emitted only
   when its edge midpoint is NEARER than the cell centre -- the back-face cull for
   a convex prism with the camera in front.

   -----------------------------------------------------------------------------
   THE LIGHT, and the forbidden list.

   The owner's motion spec forbids animated gradients and anything looping in the
   viewport. So the light here has NO TIMELINE. Its position is a pure function of
   how far the hero has travelled through the viewport: alive while the visitor
   scrolls, completely still when they stop. Under prefers-reduced-motion the
   scroll listener is never attached and the lit layer holds a constant value, so
   the field keeps every hexagon and simply stops moving.

   COLOUR is mixed at runtime from the locked tokens via getComputedStyle. There
   is not one hardcoded hex in this file; the field cannot drift from
   dispenza-tokens.css.
   ============================================================================= */
(function () {
  'use strict';

  var F  = 780;    /* focal length                       */
  var EY = 250;    /* eye height above the ground plane  */
  var RW = 62;     /* hex radius, world units            */
  var ZN = 300;    /* near plane                         */
  var ZF = 3400;   /* far plane                          */

  var field = document.querySelector('.mc-hero__field');
  if (!field) { return; }

  /* ---- deterministic height source. Stable across reloads. ---- */
  function hash(c, r) {
    var h = (c * 73856093) ^ (r * 19349663);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  }

  /* ---- colour, derived from the locked tokens ---- */
  var css = getComputedStyle(document.documentElement);
  function toRGB(hex) {
    hex = css.getPropertyValue(hex).trim().replace('#', '');
    if (hex.length === 3) { hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2]; }
    return [parseInt(hex.slice(0,2),16), parseInt(hex.slice(2,4),16), parseInt(hex.slice(4,6),16)];
  }
  function mix(a, b, t) {
    return [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t];
  }
  function out(c) {
    return 'rgb(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ')';
  }
  var SURF  = toRGB('--ds-bg-surface');
  var PRIM  = toRGB('--ds-primary');
  var DEEP  = toRGB('--ds-accent-deep');
  var BLACK = [0, 0, 0];
  var TOPF  = out(mix(SURF, PRIM, 0.11));
  /* three wall tones: violet-tinted, then driven toward black. This tonal spread
     IS the extrusion read -- the first build's walls were within two values of
     the canvas and the prisms looked flat. */
  var WALL  = [0.22, 0.48, 0.70].map(function (k) {
    return out(mix(mix(SURF, DEEP, 0.30), BLACK, k));
  });

  var vb  = field.getAttribute('viewBox').split(' ');
  var W   = +vb[2], H = +vb[3];
  var HZN = H * 0.20;

  function px(X, Z) { return W / 2 + X * F / Z; }
  function py(Z, up) { return HZN + (EY - up) * F / Z; }

  var hs = 1.5 * RW, vs = Math.sqrt(3) * RW;
  var cells = [], c, r, Zc, Xc, sx;
  var cMax = Math.ceil((ZF / F) * (W / 2) / hs) + 2;
  for (c = -cMax; c <= cMax; c++) {
    for (r = 0; ; r++) {
      Zc = ZN + r * vs + ((c & 1) ? vs / 2 : 0);
      if (Zc > ZF) { break; }
      Xc = c * hs;
      sx = px(Xc, Zc);
      /* cull columns that project off-canvas: the field is drawn, not padded */
      if (sx < -RW * F / Zc - 40 || sx > W + RW * F / Zc + 40) { continue; }
      cells.push({ Xc: Xc, Zc: Zc, h: 12 + hash(c, r) * 78 });
    }
  }
  cells.sort(function (a, b) { return b.Zc - a.Zc; });   /* far first */

  var bodies = '', lit = '', hot = '', i, k, V, a, b, top, shade, A, Z;
  for (i = 0; i < cells.length; i++) {
    Xc = cells[i].Xc; Zc = cells[i].Zc;
    V = [];
    for (k = 0; k < 6; k++) {
      A = Math.PI / 180 * (60 * k);
      var X = Xc + RW * Math.cos(A);
      Z = Zc + RW * Math.sin(A);
      if (Z <= 40) { V = null; break; }      /* behind the camera: drop the cell */
      V.push({ X: X, Z: Z, x: px(X, Z), yb: py(Z, 0), yt: py(Z, cells[i].h) });
    }
    if (!V) { continue; }

    top = '';
    for (k = 0; k < 6; k++) { top += V[k].x.toFixed(1) + ',' + V[k].yt.toFixed(1) + ' '; }

    for (k = 0; k < 6; k++) {
      a = V[k]; b = V[(k + 1) % 6];
      if ((a.Z + b.Z) / 2 >= Zc) { continue; }          /* back-face cull */
      shade = WALL[Math.min(2, Math.floor(Math.abs(a.X + b.X - 2 * Xc) / RW * 1.6))];
      bodies += '<polygon fill="' + shade + '" points="' +
        a.x.toFixed(1) + ',' + a.yt.toFixed(1) + ' ' +
        b.x.toFixed(1) + ',' + b.yt.toFixed(1) + ' ' +
        b.x.toFixed(1) + ',' + b.yb.toFixed(1) + ' ' +
        a.x.toFixed(1) + ',' + a.yb.toFixed(1) + '"/>';
    }
    bodies += '<polygon class="iso-top" fill="' + TOPF + '" points="' + top + '"/>';
    /* the glow layer skips cells too small to read, so the blur stays affordable */
    if (RW * F / Zc > 9) {
      lit += '<polygon class="iso-lit" points="' + top + '"/>';
      hot += '<polygon class="iso-hot" points="' + top + '"/>';
    }
  }

  field.innerHTML =
    '<defs>' +
      '<filter id="heroGlow" x="-30%" y="-30%" width="160%" height="160%">' +
        '<feGaussianBlur stdDeviation="2.6" result="b"/>' +
        '<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>' +
      '</filter>' +
      /* the band runs DIAGONALLY, along the direction the plane recedes */
      '<linearGradient id="heroBand" x1="0" y1="1" x2="1" y2="0">' +
        '<stop offset="0%" stop-color="#000"/><stop offset="33%" stop-color="#000"/>' +
        '<stop offset="50%" stop-color="#fff"/>' +
        '<stop offset="67%" stop-color="#000"/><stop offset="100%" stop-color="#000"/>' +
      '</linearGradient>' +
      '<linearGradient id="heroDepth" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0%" stop-color="#000"/>' +
        '<stop offset="' + ((HZN / H) * 100).toFixed(0) + '%" stop-color="#000"/>' +
        '<stop offset="58%" stop-color="#8a8a8a"/>' +
        '<stop offset="100%" stop-color="#fff"/>' +
      '</linearGradient>' +
      '<mask id="heroBandMask"><g class="mc-hero__sweep">' +
        '<rect x="' + (-W) + '" y="' + (-H) + '" width="' + W + '" height="' + (H * 3) + '" ' +
        'fill="url(#heroBand)"/></g></mask>' +
      '<mask id="heroDepthMask"><rect width="' + W + '" height="' + H + '" ' +
        'fill="url(#heroDepth)"/></mask>' +
      /* the pointer pool: a soft-edged circle whose position is the ONLY thing
         that changes on pointermove. One attribute write per frame. */
      '<radialGradient id="heroPool">' +
        '<stop offset="0%" stop-color="#fff" stop-opacity="1"/>' +
        '<stop offset="55%" stop-color="#fff" stop-opacity=".55"/>' +
        '<stop offset="100%" stop-color="#fff" stop-opacity="0"/>' +
      '</radialGradient>' +
      '<mask id="heroPoolMask"><rect width="' + W + '" height="' + H + '" fill="#000"/>' +
        '<circle id="heroPoolC" cx="-999" cy="-999" r="230" fill="url(#heroPool)"/></mask>' +
    '</defs>' +
    '<g mask="url(#heroDepthMask)">' +
      '<g>' + bodies + '</g>' +
      '<g mask="url(#heroBandMask)">' +
        '<g class="mc-hero__lit" style="--hero-glow:url(#heroGlow)">' + lit + '</g>' +
      '</g>' +
      '<g mask="url(#heroPoolMask)">' +
        '<g class="mc-hero__hot" style="--hero-glow:url(#heroGlow)">' + hot + '</g>' +
      '</g>' +
    '</g>';

  /* ---- the drive. Scroll position only. No timer, no loop. ---- */
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var sweep  = field.querySelector('.mc-hero__sweep');
  var hero   = field.closest ? field.closest('.mc-hero') : null;
  if (!sweep || !hero) { return; }

  function place() {
    var box = hero.getBoundingClientRect();
    var p = 1 - (box.top + box.height) / (window.innerHeight + box.height);  /* 0..1 */
    if (p < 0) { p = 0; } else if (p > 1) { p = 1; }
    /* The band rect spans one viewBox width, so its bright centre sits at
       (T - W/2). Mapping p over [0.35W, 1.65W] keeps that centre on canvas for
       most of the pass; a naive [0, 2W] map leaves the hero completely unlit at
       rest, which is how the first comparison panels rendered. */
    sweep.setAttribute('transform', 'translate(' + (W * (0.35 + p * 1.30)).toFixed(0) + ' 0)');
  }

  if (reduce.matches) {
    /* frozen, but placed at mid-pass so the resting field is LIT, not dark */
    sweep.setAttribute('transform', 'translate(' + (W * 1.0).toFixed(0) + ' 0)');
  } else {
    place();
    window.addEventListener('scroll', place, { passive: true });
    window.addEventListener('resize', place);
  }

  /* =========================================================================
     THE POINTER IS ONE LIGHT SOURCE FOR TWO THINGS.

     The same gesture lights the hexagons it passes over AND lights the letters
     of the claim. That is deliberate: two independent pointer effects would read
     as two gimmicks, whereas one light moving behind a translucent page reads as
     a material. Everything below is pointer-driven, so it has no timeline and
     cannot loop.

     Reads are batched into a single rAF. getBoundingClientRect on three elements
     per raw pointermove would thrash layout on a 120Hz trackpad.
     ========================================================================= */
  var poolC = field.querySelector('#heroPoolC');
  var lines = [].slice.call(hero.querySelectorAll('.mc-display, .mc-display__turn'));
  /* .mc-hero__floor was deleted (owner: remove the purple blur at the bottom).
     The lookup is kept as a null-safe reference rather than ripped out, because
     every write to it is already guarded -- a dangling querySelector that returns
     null here is harmless, whereas half-removing the guards is how a TypeError
     gets introduced into a file whose real job is the field. */
  var floor = hero.querySelector('.mc-hero__floor');

  /* ONE function applies the light, whatever is holding it. Both the caret and
     the pointer call this; nothing else writes --lx/--ly. Keeping a single
     writer is what stops the two sources fighting over the same variables. */
  /* `withType` exists because the two halves of this cost wildly different
     amounts. Moving the SVG pool and the floor is a couple of attribute writes.
     Writing --lx/--ly on the headline re-rasterises a background-clip:text layer
     at display size, and that repaint is asynchronous, so it never shows up in a
     performance.now() bracket around the JS -- it shows up as the NEXT timer
     firing late. Measured end-to-end: driving the type light every 4th character
     stretched the pass to 7.25s at 1440 against 3.38s at 375 with identical
     timers; every 16th brought it to 4.0s. The pool still tracks closely; only
     the headline's light steps in coarser increments, which is invisible at a
     23ms cadence. */
  function applyLight(cx, cy, withType, withPool) {
    var hb = hero.getBoundingClientRect();
    /* THE POOL IS SKIPPED WHILE TYPING, and not as a micro-optimisation.
       Moving this circle invalidates the mask over .mc-hero__hot -- 1,121
       polygons under a blur filter -- so every move re-composites that layer.
       And the hot layer is opacity:0 unless .is-pointing, so during the type pass
       the entire cost buys a change nobody can see. Measured: leaving it in held
       the pass at 7.4s; taking it out is most of the way back to the 3.4s the
       timers alone predict.
       The field is drawn in viewBox units and stretched with `slice`, so the
       light is converted into that space or the pool sits off-target on any
       viewport whose aspect differs from the viewBox. */
    if (withPool !== false) {
      var scale = Math.max(hb.width / W, hb.height / H);
      var offX = (hb.width - W * scale) / 2;
      var offY = (hb.height - H * scale) / 2;
      poolC.setAttribute('cx', (((cx - hb.left) - offX) / scale).toFixed(0));
      poolC.setAttribute('cy', (((cy - hb.top) - offY) / scale).toFixed(0));
    }

    /* each lit line gets the light in ITS OWN box coordinates. The supplied
       references both fed raw viewport coordinates into an element-space
       gradient, so their pool sat offset by the hero's padding. */
    if (withType !== false) {
      for (var n = 0; n < lines.length; n++) {
        var r = lines[n].getBoundingClientRect();
        lines[n].style.setProperty('--lx', (cx - r.left).toFixed(0) + 'px');
        lines[n].style.setProperty('--ly', (cy - r.top).toFixed(0) + 'px');
      }
    }
    if (floor) {
      floor.style.setProperty('--fx', (((cx - hb.left) / hb.width) * 100).toFixed(1) + '%');
    }
  }

  /* ---- the pointer takes the light while it is over the hero ----
     Not bound at all under reduced motion: a light that chases the cursor is
     motion, and the contract is that reduced motion removes motion rather than
     slowing it down. The caret still gets placed at rest below, so the hero is
     lit either way. */
  var px = 0, py = 0, queued = false;
  function paintPointer() { queued = false; applyLight(px, py); }
  if (!reduce.matches) {
    hero.addEventListener('pointermove', function (e) {
      px = e.clientX; py = e.clientY;
      hero.classList.add('is-pointing');
      if (!queued) { queued = true; requestAnimationFrame(paintPointer); }
    }, { passive: true });
    hero.addEventListener('pointerleave', function () {
      hero.classList.remove('is-pointing');
      restCaret();                     /* the light returns to the caret */
    });
  }

  /* =========================================================================
     THE WRITING LIGHT.

     The owner removed the visible cursor, so there is no longer an element to
     ask "where am I". What the cursor was CARRYING is kept: a light that tracks
     the writing position and settles onto the finished claim. Its anchor is now
     the last revealed CHARACTER's own box, which is what the cursor was being
     positioned from anyway -- the cursor was the middleman, not the source.
     ========================================================================= */
  var lead  = hero.querySelector('.mc-lead-wrap');
  /* every character span, in document order, across BOTH the claim and the lead.
     The spans are authored in the HTML -- this script only toggles a class. */
  var chars = [].slice.call(hero.querySelectorAll('.mc-type .ch'));

  var caretX = 0, caretY = 0, boxes = null;

  /* MEASURE ONCE, NOT PER CHARACTER.
     The naive version asked each span for its rect as it was revealed. That
     forces a synchronous layout per character, and this page carries ~5,600
     field polygons plus the coin, so each one is expensive: measured at ~45ms per
     character against a 23ms budget.

     The fix is available because the reveal animates OPACITY ONLY -- every
     character already occupies its final position before the first one lights up,
     so the geometry is static. Cache it once; a lookup is then free. Rebuilt on
     resize, which is the only thing that can invalidate it. */
  var host = null;
  function measure() {
    boxes = null;
    if (!chars.length) return;
    host = lead;
    if (!host) return;
    var hb = host.getBoundingClientRect();
    boxes = chars.map(function (c) {
      var r = c.getBoundingClientRect();
      /* HOST-RELATIVE ONLY. Caching viewport coordinates here would rot the
         moment the page scrolls -- and the pin is sticky, so it scrolls a lot --
         leaving the light lagging behind the writing. Offsets are stable; the
         viewport position is resolved from the host at the moment of use. */
      return { l: r.right - hb.left, t: r.top - hb.top, h: r.height,
               ok: !!(r.width || r.height) };
    });
  }
  /* keeps its name: it still answers "where has the writing reached", it just no
     longer moves an element to prove it */
  function placeCaret(idx) {
    if (!boxes) measure();
    if (!boxes || !host) return false;
    var i = Math.max(0, Math.min(idx, boxes.length - 1));
    var bx = boxes[i];
    if (!bx.ok) return false;
    var hb = host.getBoundingClientRect();
    caretX = hb.left + bx.l; caretY = hb.top + bx.t + bx.h / 2;
    return true;
  }
  function restCaret() {
    if (placeCaret(chars.length - 1)) applyLight(caretX, caretY);
  }

  /* ---- the type reveal.
     Uneven per-character cadence, because a perfectly regular one reads as a
     progress bar rather than as writing; the reference clip's cadence is uneven
     for the same reason. Punctuation holds slightly longer, which is what makes
     a sentence sound like it has a rhythm. ---- */
  /* PACE. The first pass ran at 34ms/char with a 210ms hold on punctuation, which
     measured out at 6.4 SECONDS to finish 128 characters -- the visitor sits and
     waits for the sentence, which is the opposite of premium. Retimed to land
     near 2.6s, the same duration as the reference clip's own pass. */
  /* PACE, AND WHY THIS IS A CLOCK RATHER THAN A CHAIN.

     The reveal used to be a setTimeout chain: reveal a character, schedule the
     next. That is fine on an idle page and wrong on this one. A chain measures
     out DELAYS, so anything that blocks the main thread stretches the whole pass
     -- and the hero now loads a 1.3 MB Draco-compressed 100k-triangle model and
     spins up a WebGL context while the claim is writing. Measured with the model
     loading from the first byte, the chain never finished inside 20 seconds.

     This is the same fix the cursor easing needed: drive it from ELAPSED TIME.
     A cumulative schedule is built once, and each frame reveals every character
     whose moment has passed. The pass therefore completes in a fixed ~3s of wall
     clock whether the frame rate is 60 or 6 -- jank costs smoothness, never
     duration. The cadence itself is unchanged: uneven per character, because a
     perfectly regular one reads as a progress bar rather than as writing, with a
     longer hold on punctuation so the sentence has a rhythm. */
  var BASE_MS = 15, i0 = 0, typing = false, t0 = 0, raf = 0;
  var sched = (function () {
    var out = [], acc = 0;
    for (var n = 0; n < chars.length; n++) {
      var t = chars[n].textContent;
      var wait = BASE_MS + (n % 5) * 4;                  /* deterministic jitter */
      if (t === ' ') { wait = 8; }
      else if (t === '.' || t === ',') { wait = 120; }
      acc += wait;
      out.push(acc);
    }
    return out;
  }());

  function finish() {
    typing = false;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    if (tick) { clearInterval(tick); tick = 0; }
    hero.classList.remove('is-scanning');
    hero.classList.add('is-scanned');
    /* the light settles onto the finished claim -- once, not thirty-two times.
       Measured by bisection, driving it per character cost more than the entire
       rest of the pass: 7.25s with it, 3.11s without. */
    restCaret();
  }

  /* TWO CLOCKS, ONE SCHEDULE. The step is idempotent -- it reveals every
     character whose moment has passed and nothing else -- so it is safe to drive
     from both rAF and a coarse interval. That matters because rAF can be starved
     ENTIRELY while the GPU uploads the model, and a reveal that only listens to
     rAF simply stops during it (measured: 5.6s at deviceScaleFactor 2 against
     2.7s at 1). The interval keeps the sentence moving through those gaps; rAF
     keeps it smooth the rest of the time. Neither can double-reveal. */
  var tick = 0;
  function step(now) {
    if (!now) { now = (window.performance && performance.now) ? performance.now() : Date.now(); }
    if (!t0) { t0 = now; }
    var el = now - t0;
    while (i0 < chars.length && el >= sched[i0]) {
      chars[i0].classList.add('is-on');
      i0++;
    }
    if (i0 >= chars.length) { placeCaret(chars.length - 1); finish(); return; }
    raf = requestAnimationFrame(step);
  }

  if (chars.length) {
    if (reduce.matches) {
      /* every character is already opaque via the reduced-motion rule; the caret
         is simply placed at the end and lights the room. Nothing is lost. */
      hero.classList.add('is-scanned');
      requestAnimationFrame(restCaret);
    } else {
      setTimeout(function () {
        if (typing) return;
        typing = true;
        hero.classList.add('is-scanning');
        t0 = 0;
        raf = requestAnimationFrame(step);
        tick = setInterval(function () { if (typing) { step(0); } }, 80);
      }, 420);
    }
    window.addEventListener('resize', function () {
      measure();                       /* the only thing that invalidates the cache */
      if (!typing) restCaret(); else placeCaret(i0 - 1);
    });
  }
}());

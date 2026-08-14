/* =============================================================================
   smoke-engine.js  --  ONE VIOLET SMOKE, TWO PLACES TO PUT IT.

   The hero's plume and the section band ran identical physics from two separate
   files. Two copies of a tuning table is the non-propagation trap the build
   rules warn about: a change lands on the file you happened to open and the
   sibling silently keeps the old numbers. So the model lives here once, and the
   two callers supply only what genuinely differs between them.

   -----------------------------------------------------------------------------
   THE MODEL. Each particle integrates, per frame:
     buoyancy   smoke is hotter than the air, so it rises, and the lift DECAYS as
                the parcel cools: old smoke stops climbing and starts drifting.
     drag       velocity bleeds off toward the ambient field. Without it every
                impulse is permanent and the smoke ends up as streaks.
     curl       a divergence-free-ish swirl from a cheap sin/cos field, which is
                what gives smoke its billow instead of a smooth gradient.
     wind       the pointer's own velocity, applied with a radial falloff, PLUS a
                perpendicular component so the parcel curls around the path
                rather than being shoved along it. Real air does the second
                thing; only the first is what most cursor effects implement.
     expansion  the parcel grows and thins as it ages (diffusion), so it fades by
                spreading rather than by simply losing alpha.

   The load-bearing word in the owner's original ask was PASSES: a cursor that
   pushes by PROXIMITY produces a bubble that follows the mouse around, which
   reads as a force field, not as wind. Wind is momentum, so it is the pointer's
   VELOCITY that is injected. A fast sweep blows the smoke aside; a stationary
   cursor sitting in the middle of it does nothing at all.

   DRAWN with a single pre-rendered soft sprite per tint, tinted from the locked
   tokens and composited additively. Building a radial gradient per particle per
   frame is the obvious version and it is far too slow at this count.

   RESOLUTION IS DELIBERATELY BELOW DEVICE PIXELS. Backing the canvas at
   devicePixelRatio 2 made the hero 2880x1800 (5.2 MILLION pixels) with ~260
   additive sprite draws per frame over large radii. That fill rate saturated the
   main thread and starved every other timer on the page: the type pass, measured,
   went from 3.1s to 18.2s at DPR 2 while staying at 4.3s at DPR 1. Same code,
   same particle count; the only variable was fill. Smoke is a soft low-frequency
   field with no edge a device pixel would resolve, so 0.55x CSS pixels is
   visually indistinguishable and cuts fill by roughly 13x against DPR 2.

   NOT A DECORATION THAT RUNS FOREVER UNWATCHED: an IntersectionObserver stops
   the loop the moment the host leaves the viewport, and prefers-reduced-motion
   never starts it, painting one static haze instead so the page still sits in
   atmosphere.

   COLOUR is mixed at runtime from the locked tokens via getComputedStyle. There
   is not one hardcoded hex in this file; the fields cannot drift from
   dispenza-tokens.css.
   -----------------------------------------------------------------------------
   THE LID -- what 'ceiling' adds, and why it is a MODE and not a clamp.

   The owner asked for smoke that rises from the bottom of a section and "sticks
   at the top as if it defies gravity". Two things in the existing model fight
   that, and both had to be answered rather than clamped.

   1. NOTHING WAS REACHING THE TOP. Measured, not assumed: the 'band' field's
      steady state is entirely in the BOTTOM THIRD of its own canvas -- a
      900-frame deterministic capture reads 28.85 / 0.00 / 0.00 across the three
      thirds. The reason is in the model: buoyancy decays with heat, so a parcel
      reaches roughly 0.5 px/frame and stalls after ~150px, dies, and is refed at
      the bottom. A band field is therefore a haze ALONG the bottom, which is
      correct for a band and useless for a ceiling. So in 'ceiling' the lift KEEPS
      A FLOOR (CEIL_HEAT0) -- that persistence IS the gravity-defiance -- and the
      accel is solved from the field's own height so one traverse takes the same
      time whether the section is 1000px or 2200px tall.

   2. A HARD CLAMP AT y=0 READS AS A ROW OF DOTS, not as smoke. Real smoke meeting
      a ceiling arrives, loses its climb over a DEPTH, spreads sideways, and
      churns. So the lid is a BAND, not a line, and a parcel inside it is acted on
      by four things scaled by how deep into the band it is: its lift is cut, its
      vertical motion is damped hard, a small restoring pressure pushes an
      overshoot back down (so the layer finds an equilibrium depth instead of
      stacking on the edge), and its lateral curl is amplified plus given a
      sustained per-parcel drift, so the pooled layer creeps outward and jostles.

   AND IT HAS TO THIN, or the cap grows into a solid bar. Pooled parcels age
   FASTER (CEIL_AGE), so they fade and are refed at the bottom; one that creeps
   clear of either edge is refed too. The result is a steady-state population
   rather than an ever-thickening crust.

   The pointer wake, the curl field, the drag and the reduced-motion behaviour are
   NOT touched by any of this: 'ceiling' reuses them unchanged, which is what the
   owner meant by "the interactivity effects are the same".
   -----------------------------------------------------------------------------
   WHAT A CALLER SUPPLIES, and nothing else:

     canvas    the <canvas> to paint into
     box       element whose rect defines the field's size and pointer origin
     observe   element whose visibility starts and stops the loop
     emitter   'point'   -> a plume around a moving source (the hero's coin)
               'band'    -> spawned across the width, low, rising through the field
               'ceiling' -> the same rise, but the lift does not cool off and the
                            parcels GATHER under the top of the field instead of
                            passing out through it (see THE LID, below)
     source    ('point' only) function returning {x, y, r} in box coordinates,
               re-read on scroll so the plume stays attached to a moving object
     density   px^2 per particle. Lower means more particles.
     min, max  particle-count clamp, so a phone is not asked to run a desktop fluid
     seed      any integer; the field is reproducible across loads
   ============================================================================= */
(function (global) {
  'use strict';

  /* ---- the tuning table. ONE copy. Both fields are this. ---- */
  var RES        = 0.55;    /* canvas backing scale, see the note above          */
  var SPRITE_PX  = 128;
  var BUOYANCY   = 0.014;
  var CURL_X     = 0.012;
  var CURL_Y     = 0.010;
  var DRAG       = 0.972;
  var WIND_R     = 190;     /* how far the wake reaches                          */
  var WIND_ADV   = 0.085;   /* carried along with the moving air                 */
  var WIND_CURL  = 0.030;   /* curl around the path: what makes it read as air   */
  var WIND_PUSH  = 0.30;    /* displaced out of the way                          */
  var PT_DECAY   = 0.86;    /* pointer momentum decays even while held still     */
  var PT_SMOOTH  = 0.55;    /* so a jittery mouse is not turbulence of its own   */
  var FADE_IN    = 0.12;    /* fade in fast, out slow: smoke appears suddenly    */
  var ALPHA      = 0.55;
  var LIFE_MIN   = 3200, LIFE_VAR = 4200;
  var R0_MIN     = 34,   R0_VAR   = 62;
  var STATIC_A   = 0.16;    /* the one reduced-motion breath                     */
  var FRAME_MS   = 16.6667;

  /* ---- 'ceiling' only. Every one of these is inert in the other two modes. ---- */
  /* THE LID IS AN ABSOLUTE BAND, not a share of the field, and the clamp is the
     load-bearing part. Measured across 12 widths, #benchmarks is 897-1036px tall
     on desktop but 2215-2242px on a phone, and the clear ground above its first
     line of type is 128-180px on desktop against 84-116px on a phone -- i.e. the
     taller the section gets, the SHALLOWER the usable lid. A fraction of the
     height moves the wrong way on both counts, so the fraction only shapes the
     middle and the clamp decides the ends: the cap lands at 116-132px at every
     width, which is the space the section's own top rhythm reserves for it. */
  var CEIL_FRAC  = 0.13;
  var CEIL_MIN_H = 88, CEIL_MAX_H = 132;
  var CEIL_RISEF = 470;     /* frames one traverse should take, any field height */
  var CEIL_VMIN  = 1.5, CEIL_VMAX = 3.2;   /* ...but never a crawl or a draught  */
  var CEIL_HEAT0 = 0.55;    /* share of the lift that never cools: the defiance  */
  var CEIL_HAVG  = 0.73;    /* mean heat over a traverse, used to solve the accel*/
  var CEIL_VDAMP = 0.74;    /* per-frame vertical damping at full lid depth      */
  var CEIL_PRESS = 0.030;   /* restoring push-back, so an overshoot settles      */
  var CEIL_SPREAD= 2.2;     /* extra lateral curl gain under the lid             */
  var CEIL_SLIDE = 0.018;   /* the sustained sideways creep of pooled smoke      */
  var CEIL_WREF  = 1200;    /* ...measured against this width, scaled from it     */
  var CEIL_AGE   = 0.65;    /* pooled smoke ages faster, so the cap thins        */
  var CEIL_LIFEM = 2.5;     /* life as a multiple of one traverse                */
  var CEIL_SEEDP = 0.55;    /* share of the FIRST fill placed already pooled     */
  var CEIL_R0MIN = 26,  CEIL_R0VAR = 46;
  var CEIL_RBASE = 0.50, CEIL_RGROW = 0.95;

  function createSmoke(opt) {
    var cv = opt.canvas, box = opt.box, ctx = cv && cv.getContext && cv.getContext('2d');
    if (!cv || !box || !ctx) { return null; }

    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    var isBand = opt.emitter === 'band';
    var isCeil = opt.emitter === 'ceiling';
    /* both rising emitters share the spawn GEOMETRY (across the width, low) and
       differ only in what happens on the way up, so the geometry asks isRise and
       the physics asks isCeil. isRise === isBand whenever isCeil is false, which
       is what keeps 'band' and 'point' bit-for-bit what they were. */
    var isRise = isBand || isCeil;

    /* ---- colour from the locked tokens. No literals. ---- */
    var CSSV = getComputedStyle(document.documentElement);
    function toRGB(name) {
      var h = CSSV.getPropertyValue(name).trim().replace('#', '');
      if (h.length === 3) { h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]; }
      return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    }
    function sprite(rgb) {
      var c = document.createElement('canvas');
      c.width = c.height = SPRITE_PX;
      var g = c.getContext('2d');
      var r = SPRITE_PX / 2;
      var grad = g.createRadialGradient(r, r, 0, r, r, r);
      grad.addColorStop(0,    'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',0.42)');
      grad.addColorStop(0.45, 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',0.14)');
      grad.addColorStop(1,    'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, SPRITE_PX, SPRITE_PX);
      return c;
    }
    var SPRITES = [sprite(toRGB('--ds-primary')),
                   sprite(toRGB('--ds-accent-light')),
                   sprite(toRGB('--ds-accent-deep'))];

    /* deterministic pseudo-random: the field is reproducible across loads */
    var seed = opt.seed || 0x9e3779b1;
    function rnd() {
      seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
      return ((seed >>> 0) % 100000) / 100000;
    }

    var W = 0, H = 0, P = [], N = 0;
    var src = { x: 0, y: 0, r: 60 };

    /* solved from the field's own height in resize(), so the lid sits at a
       sensible depth and one traverse takes the same time on a 1000px desktop
       section and a 2200px phone one */
    var ceilH = 0, ceilBuoy = 0, ceilLife = 0, ceilSlide = 0, ceilEdge = 0;
    function tuneCeiling() {
      ceilH = Math.max(CEIL_MIN_H, Math.min(CEIL_MAX_H, H * CEIL_FRAC));
      var v = Math.max(CEIL_VMIN, Math.min(CEIL_VMAX, H / CEIL_RISEF));
      /* terminal velocity under this integrator is accel/(1-DRAG); solve it
         backwards for the accel that yields the rise speed we want */
      ceilBuoy = v * (1 - DRAG) / CEIL_HAVG;
      ceilLife = (H / v) * FRAME_MS * CEIL_LIFEM;
      /* THE CREEP IS A FRACTION OF THE WIDTH, NOT A FIXED SPEED. Measured with a
         fixed 0.018: on the 390px phone field the pooled layer drifted ~340px --
         most of the width -- so nearly every parcel left through a side and was
         recycled, and the cap thinned to a 1.6x top/bottom ratio by 70s against
         5.0x on desktop. Same code, same numbers, different width: the creep has
         to be relative to the field it is creeping across. */
      ceilSlide = CEIL_SLIDE * Math.max(0.34, Math.min(1, W / CEIL_WREF));
      ceilEdge  = Math.max(110, W * 0.14);
    }

    function locate() {
      if (isRise || !opt.source) { return; }
      var s = opt.source();
      if (s) { src.x = s.x; src.y = s.y; src.r = s.r; }
    }

    function spawn(scatter) {
      /* WIDE life spread in ceiling mode, deliberately. Narrow it and the field
         develops COHORTS: a group refed together arrives together, and the
         column shows a travelling clump rather than a steady rise. Measured at
         +-22%, the phone field's middle third spiked to the same density as its
         cap; at +-47% the clump smears out. */
      var life = isCeil ? ceilLife * (0.53 + rnd() * 0.94)
                        : LIFE_MIN + rnd() * LIFE_VAR;
      var x, y;
      if (isRise) {
        /* ACROSS the width, low in the field. A plume pinned to one point of a
           tall band would read as a stain in the middle of it. */
        x = rnd() * W;
        if (isCeil) {
          /* THE FIRST FILL IS SEEDED IN THE SHAPE OF THE STEADY STATE -- a cap
             already under the lid, a thinner column below it. Scattering flat
             instead would mean the section spends its first full traverse
             (~8s) looking like an ordinary haze before the effect the owner
             asked for appears, and on a page this long that is most of the time
             anyone actually spends looking at it. Refills (scatter false) still
             come from the bottom, so the RISE is what is seen from then on. */
          y = scatter ? (rnd() < CEIL_SEEDP ? ceilH * rnd()
                                           : H * (0.22 + rnd() * 0.78))
                      : H + rnd() * 70;
        } else {
          y = scatter ? rnd() * H : H + rnd() * 80;
        }
      } else {
        var a = rnd() * Math.PI * 2;
        var d = src.r * (0.15 + rnd() * 0.85);
        x = src.x + Math.cos(a) * d + (scatter ? (rnd() - 0.5) * W * 0.28 : 0);
        y = src.y + Math.sin(a) * d * 0.7 + (scatter ? (rnd() - 0.5) * H * 0.3 : 0);
      }
      return {
        x: x, y: y,
        vx: (rnd() - 0.5) * 0.18,
        vy: -(0.05 + rnd() * 0.16),
        age: scatter ? rnd() * life : 0,
        life: life,
        /* smaller parcels under the lid: a pooled layer built from the band's
           radii merges into one smear instead of reading as smoke */
        r0: (isCeil ? CEIL_R0MIN : R0_MIN) + rnd() * (isCeil ? CEIL_R0VAR : R0_VAR),
        heat: 0.6 + rnd() * 0.4,
        sp: (rnd() * 3) | 0,
        ph: rnd() * 6.283,
        /* a signed, sustained sideways bias, used ONLY under the lid, so pooled
           parcels creep apart instead of hanging in the column they arrived in.
           The rnd() is drawn only in ceiling mode, so the other two emitters'
           random sequence -- and therefore their exact field -- is untouched. */
        lat: isCeil ? (rnd() - 0.5) * 2 : 0
      };
    }

    function resize() {
      var r = box.getBoundingClientRect();
      W = Math.max(1, Math.round(r.width));
      H = Math.max(1, Math.round(r.height));
      cv.width  = Math.max(1, Math.round(W * RES));
      cv.height = Math.max(1, Math.round(H * RES));
      cv.style.width  = W + 'px';
      cv.style.height = H + 'px';
      ctx.setTransform(RES, 0, 0, RES, 0, 0);
      /* BEFORE the fill below: spawn() reads ceilLife and ceilH */
      if (isCeil) { tuneCeiling(); }
      N = Math.max(opt.min || 60, Math.min(opt.max || 190,
            Math.round((W * H) / (opt.density || 9000))));
      if (P.length > N) { P.length = N; }
      locate();
      while (P.length < N) { P.push(spawn(true)); }
    }

    /* ---- the pointer, tracked as a VELOCITY, not just a position ---- */
    var pt = { x: -9999, y: -9999, vx: 0, vy: 0, on: false };
    function onMove(e) {
      var r = box.getBoundingClientRect();
      var nx = e.clientX - r.left, ny = e.clientY - r.top;
      if (pt.on) {
        pt.vx = pt.vx * PT_SMOOTH + (nx - pt.x) * (1 - PT_SMOOTH);
        pt.vy = pt.vy * PT_SMOOTH + (ny - pt.y) * (1 - PT_SMOOTH);
      }
      pt.x = nx; pt.y = ny; pt.on = true;
    }

    var last = 0;
    function step(now) {
      var dt = last ? Math.min(48, now - last) : 16;
      last = now;
      var k = dt / 16;                       /* frame-rate independence */

      pt.vx *= Math.pow(PT_DECAY, k);
      pt.vy *= Math.pow(PT_DECAY, k);

      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';

      var t = now * 0.00013;
      for (var i = 0; i < P.length; i++) {
        var p = P[i];

        /* HOW DEEP INTO THE LID this parcel is: 0 anywhere in the open column,
           1 hard against the top. Zero in every other mode, which is what makes
           each guard below a no-op for 'band' and 'point'. */
        var cd = 0;
        if (isCeil) {
          cd = (ceilH - p.y) / ceilH;
          cd = cd < 0 ? 0 : (cd > 1 ? 1 : cd);
        }

        /* pooled smoke burns through what is left of its life faster, so the cap
           thins and re-feeds the bottom instead of thickening into a bar */
        p.age += cd ? dt * (1 + CEIL_AGE * cd) : dt;
        if (p.age >= p.life) { P[i] = spawn(false); continue; }
        var u = p.age / p.life;

        /* 'ceiling' keeps a floor under the lift -- that persistence is the
           gravity-defiance -- and loses it only to the lid itself, (1 - cd). */
        if (isCeil) {
          p.vy -= ceilBuoy * p.heat * (CEIL_HEAT0 + (1 - CEIL_HEAT0) * (1 - u)) * (1 - cd) * k;
        } else {
          var heat = p.heat * (1 - u);
          p.vy -= BUOYANCY * heat * k;
        }

        var cx1 = Math.sin(p.y * 0.0075 + t + p.ph) - Math.cos(p.x * 0.0052 - t * 1.3);
        var cy1 = Math.cos(p.x * 0.0068 - t + p.ph) - Math.sin(p.y * 0.0047 + t * 1.1);
        p.vx += cx1 * CURL_X * k;
        p.vy += cy1 * CURL_Y * k;

        if (cd) {
          /* MEETING THE LID. Not a clamp: the climb is damped out over the depth
             of the band, a small pressure returns an overshoot, and the energy
             goes SIDEWAYS instead -- amplified curl so the layer keeps churning,
             plus this parcel's own sustained drift so it creeps apart. */
          p.vy *= Math.pow(CEIL_VDAMP, k * cd);
          p.vy += CEIL_PRESS * cd * cd * k;
          p.vx += (cx1 * CURL_X * CEIL_SPREAD * cd + p.lat * ceilSlide * cd) * k;
        }

        if (pt.on) {
          var dx = p.x - pt.x, dy = p.y - pt.y;
          var d2 = dx * dx + dy * dy;
          if (d2 < WIND_R * WIND_R) {
            var d = Math.sqrt(d2) || 1;
            var f = 1 - d / WIND_R;
            f = f * f;                                   /* soft edge to the wake */
            p.vx += pt.vx * WIND_ADV * f * k;
            p.vy += pt.vy * WIND_ADV * f * k;
            var sgn = (dx * pt.vy - dy * pt.vx) > 0 ? 1 : -1;
            p.vx += -pt.vy * WIND_CURL * f * sgn * k;
            p.vy +=  pt.vx * WIND_CURL * f * sgn * k;
            p.vx += (dx / d) * WIND_PUSH * f * k;
            p.vy += (dy / d) * WIND_PUSH * f * k;
          }
        }

        p.vx *= Math.pow(DRAG, k);
        p.vy *= Math.pow(DRAG, k);

        p.x += p.vx * k;
        p.y += p.vy * k;

        /* a band parcel that has risen clear is refed at the bottom, so the field
           stays evenly populated instead of draining upward */
        if (isRise && p.y < -140) { P[i] = spawn(false); continue; }
        /* a pooled parcel that has crept clear of an edge is refed too: without
           this the sideways spread just piles up against the sides */
        if (isCeil && (p.x < -ceilEdge || p.x > W + ceilEdge)) { P[i] = spawn(false); continue; }

        var rad, a;
        if (isCeil) {
          rad = p.r0 * (CEIL_RBASE + u * CEIL_RGROW);
          /* HOLDS, THEN LETS GO. The band's linear ramp-down would have the cap
             -- which is old smoke by definition -- permanently dimmer than the
             fresh parcels at the bottom, i.e. the exact inverse of the effect.
             A cubic keeps a parcel lit through its middle and spends the fade in
             its last third, which is also the truer read: smoke dissipates when
             it finally breaks up, not steadily from the moment it forms. */
          var vf = (u - FADE_IN) / (1 - FADE_IN);
          a = u < FADE_IN ? u / FADE_IN : 1 - vf * vf * vf;
        } else {
          rad = p.r0 * (0.55 + u * 1.25);
          a = (u < FADE_IN ? u / FADE_IN : 1 - (u - FADE_IN) / (1 - FADE_IN));
        }
        a *= ALPHA;
        if (a <= 0.004) { continue; }

        ctx.globalAlpha = a;
        ctx.drawImage(SPRITES[p.sp], p.x - rad, p.y - rad, rad * 2, rad * 2);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    var raf = 0;
    function loop(now) { step(now); raf = requestAnimationFrame(loop); }
    function start() { if (!raf) { last = 0; raf = requestAnimationFrame(loop); } }
    function stop()  { if (raf) { cancelAnimationFrame(raf); raf = 0; } }

    resize();
    window.addEventListener('resize', resize);

    if (reduce.matches) {
      /* one static breath of atmosphere: the page still sits in something,
         nothing moves */
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      for (var q = 0; q < P.length; q++) {
        var s = P[q], rr = s.r0 * 1.15;
        ctx.globalAlpha = STATIC_A;
        ctx.drawImage(SPRITES[s.sp], s.x - rr, s.y - rr, rr * 2, rr * 2);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      return { start: function () {}, stop: function () {}, resize: resize };
    }

    box.addEventListener('pointermove', onMove, { passive: true });
    box.addEventListener('pointerleave', function () { pt.on = false; pt.vx = pt.vy = 0; });
    if (!isRise) { window.addEventListener('scroll', locate, { passive: true }); }

    var watch = opt.observe || box;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        es.forEach(function (en) { if (en.isIntersecting) { start(); } else { stop(); } });
      }, { threshold: 0.02 }).observe(watch);
    } else {
      start();
    }

    return { start: start, stop: stop, resize: resize };
  }

  global.DispenzaSmoke = { create: createSmoke };
}(window));

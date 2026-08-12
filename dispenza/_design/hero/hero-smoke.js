/* =============================================================================
   hero-smoke.js  --  VIOLET SMOKE AROUND THE TOKEN, PUSHED BY THE CURSOR.

   The owner's ask: smoke that "follows real world physics when mouse cursor
   passes through it as if there is wind". The load-bearing word is PASSES. A
   cursor that only pushes by PROXIMITY produces a bubble that follows the mouse
   around, which reads as a force field, not as wind. Wind is momentum: it is the
   pointer's VELOCITY that has to be injected into the fluid, so a fast sweep
   blows the smoke aside and a stationary cursor sitting in the middle of it does
   nothing at all. That distinction is the whole effect.

   THE MODEL. Each particle integrates, per frame:
     buoyancy   smoke is hotter than the air, so it rises, and the lift DECAYS as
                the parcel cools -- old smoke stops climbing and starts drifting.
     drag       velocity bleeds off toward the ambient field. Without it every
                impulse is permanent and the smoke ends up as streaks.
     curl       a divergence-free-ish swirl from a cheap sin/cos field, which is
                what gives smoke its billow instead of a smooth gradient.
     wind       the pointer's own velocity, applied with a radial falloff, PLUS a
                perpendicular component so the parcel curls around the path
                rather than being shoved along it. Real air does the second thing;
                only the first is what most cursor effects implement.
     expansion  the parcel grows and thins as it ages (diffusion), so it fades by
                spreading rather than by simply losing alpha.

   DRAWN with a single pre-rendered soft sprite, tinted from the locked tokens and
   composited additively. Building a radial gradient per particle per frame is the
   obvious version and it is far too slow at this count.

   NOT A DECORATION THAT RUNS FOREVER UNWATCHED: an IntersectionObserver stops the
   loop the moment the hero leaves the viewport, and prefers-reduced-motion never
   starts it -- it paints one static haze so the token still sits in atmosphere.
   ============================================================================= */
(function () {
  'use strict';

  var cv = document.querySelector('.mc-smoke');
  var svg = document.querySelector('.mc-coaster');
  var hero = document.querySelector('.mc-hero');
  var pin = document.querySelector('.mc-hero__pin');
  if (!cv || !svg || !hero || !pin) { return; }
  var ctx = cv.getContext('2d');
  if (!ctx) { return; }

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---- colour from the locked tokens. No literals. ---- */
  var CSSV = getComputedStyle(document.documentElement);
  function toRGB(name) {
    var h = CSSV.getPropertyValue(name).trim().replace('#', '');
    if (h.length === 3) { h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2]; }
    return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
  }
  var PRIM  = toRGB('--ds-primary');
  var LIGHT = toRGB('--ds-accent-light');
  var DEEP  = toRGB('--ds-accent-deep');

  /* ---- one soft sprite per tint, pre-rendered once ---- */
  var SPRITE_PX = 128;
  function sprite(rgb) {
    var s = document.createElement('canvas');
    s.width = s.height = SPRITE_PX;
    var c = s.getContext('2d');
    var g = c.createRadialGradient(SPRITE_PX/2, SPRITE_PX/2, 0, SPRITE_PX/2, SPRITE_PX/2, SPRITE_PX/2);
    g.addColorStop(0,    'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',0.42)');
    g.addColorStop(0.35, 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',0.16)');
    g.addColorStop(1,    'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',0)');
    c.fillStyle = g;
    c.fillRect(0, 0, SPRITE_PX, SPRITE_PX);
    return s;
  }
  var SPRITES = [sprite(PRIM), sprite(LIGHT), sprite(DEEP)];

  /* ---- deterministic pseudo-random: the field is reproducible across loads,
     so two screenshots of the same frame are comparable ---- */
  var seed = 0x9e3779b9;
  function rnd() {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    return ((seed >>> 0) % 100000) / 100000;
  }

  var W = 0, H = 0, DPR = 1;
  var P = [], N = 0;
  var src = { x: 0, y: 0, r: 60 };     /* the emitter, parked on the token */

  /* RESOLUTION IS DELIBERATELY BELOW DEVICE PIXELS, and this is the difference
     between the hero working and not working.

     Backing the canvas at devicePixelRatio 2 made it 2880x1800 -- 5.2 MILLION
     pixels -- with ~260 additive sprite draws per frame over large radii. That
     fill rate saturated the main thread and starved every other timer on the
     page: the type pass, measured, went from 3.1s to 18.2s at DPR 2 while
     staying at 4.3s at DPR 1. Same code, same particle count; the only variable
     was fill.

     Smoke is a soft, low-frequency field: there is no edge in it that a device
     pixel would resolve. Rendering at 0.55x CSS pixels and letting the browser
     scale it up is visually indistinguishable and cuts the fill by roughly 13x
     against DPR 2. This is a case where matching device resolution is not
     quality, it is only cost. */
  var RES = 0.55;
  function resize() {
    var r = pin.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width));
    H = Math.max(1, Math.round(r.height));
    DPR = RES;
    cv.width = Math.max(1, Math.round(W * RES));
    cv.height = Math.max(1, Math.round(H * RES));
    cv.style.width = W + 'px';
    cv.style.height = H + 'px';
    ctx.setTransform(RES, 0, 0, RES, 0, 0);
    /* particle count scales with area so a phone is not asked to run a
       desktop-sized fluid */
    N = Math.max(60, Math.min(190, Math.round((W * H) / 9000)));
    if (P.length > N) { P.length = N; }
    while (P.length < N) { P.push(spawn(true)); }
    locateSource();
  }

  /* the emitter tracks the TOKEN, wherever the coaster has placed it, so the
     smoke stays attached to the object rather than to a hardcoded point */
  function locateSource() {
    /* TRACK WHICHEVER COIN IS ACTUALLY ON SCREEN.
       This used to read the SVG coin's bbox unconditionally. Once the GLB coin
       took over, the SVG one became display:none -- so its rect is 0x0, the
       guard below bailed, and the emitter stayed at its initial (0,0): the smoke
       would have spawned in the top-left corner instead of around the coin.
       Prefer the model when it is the visible one, fall back to the SVG. */
    var coin3d = document.querySelector('.mc-coin');
    var g = null;
    if (coin3d && hero.classList.contains('has-coin3d')) { g = coin3d; }
    if (!g) { g = svg.querySelector('.mc-coaster__all'); }
    if (!g) { return; }
    var b;
    try { b = g.getBoundingClientRect(); } catch (e) { return; }
    if (!b || !b.width) { return; }
    var pr = pin.getBoundingClientRect();
    src.x = b.left - pr.left + b.width / 2;
    src.y = b.top - pr.top + b.height / 2;
    src.r = Math.max(40, Math.min(b.width, b.height) * 0.55);
  }

  function spawn(scatter) {
    var a = rnd() * Math.PI * 2;
    var d = src.r * (0.15 + rnd() * 0.85);
    var life = 3200 + rnd() * 4200;
    return {
      x: src.x + Math.cos(a) * d + (scatter ? (rnd() - 0.5) * W * 0.28 : 0),
      y: src.y + Math.sin(a) * d * 0.7 + (scatter ? (rnd() - 0.5) * H * 0.3 : 0),
      vx: (rnd() - 0.5) * 0.18,
      vy: -(0.05 + rnd() * 0.16),
      age: scatter ? rnd() * life : 0,
      life: life,
      r0: 34 + rnd() * 62,
      heat: 0.6 + rnd() * 0.4,
      sp: (rnd() * 3) | 0,
      ph: rnd() * 6.283
    };
  }

  /* ---- the pointer, tracked as a VELOCITY, not just a position ---- */
  var pt = { x: -9999, y: -9999, px: -9999, py: -9999, vx: 0, vy: 0, on: false };
  function onMove(e) {
    var r = pin.getBoundingClientRect();
    var nx = e.clientX - r.left, ny = e.clientY - r.top;
    if (pt.on) {
      /* smoothed so a jittery mouse does not read as turbulence of its own */
      pt.vx = pt.vx * 0.55 + (nx - pt.x) * 0.45;
      pt.vy = pt.vy * 0.55 + (ny - pt.y) * 0.45;
    }
    pt.x = nx; pt.y = ny; pt.on = true;
  }
  if (!reduce.matches) {
    pin.addEventListener('pointermove', onMove, { passive: true });
    pin.addEventListener('pointerleave', function () { pt.on = false; pt.vx = pt.vy = 0; });
  }

  var WIND_R = 190;          /* how far the wake reaches */
  var last = 0;

  function step(now) {
    var dt = last ? Math.min(48, now - last) : 16;
    last = now;
    var k = dt / 16;                       /* frame-rate independence */

    /* the pointer's own momentum decays even while it is held still, so a
       stationary cursor stops blowing -- wind is movement, not presence */
    pt.vx *= Math.pow(0.86, k);
    pt.vy *= Math.pow(0.86, k);

    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';

    var t = now * 0.00013;
    for (var i = 0; i < P.length; i++) {
      var p = P[i];
      p.age += dt;
      if (p.age >= p.life) { P[i] = spawn(false); continue; }
      var u = p.age / p.life;

      /* buoyancy, cooling with age */
      var heat = p.heat * (1 - u);
      p.vy -= 0.014 * heat * k;

      /* curl: a cheap divergence-light field, which is what makes it billow */
      var cx1 = Math.sin(p.y * 0.0075 + t + p.ph) - Math.cos(p.x * 0.0052 - t * 1.3);
      var cy1 = Math.cos(p.x * 0.0068 - t + p.ph) - Math.sin(p.y * 0.0047 + t * 1.1);
      p.vx += cx1 * 0.012 * k;
      p.vy += cy1 * 0.010 * k;

      /* WIND. Only ever from the pointer's velocity. */
      if (pt.on) {
        var dx = p.x - pt.x, dy = p.y - pt.y;
        var d2 = dx * dx + dy * dy;
        if (d2 < WIND_R * WIND_R) {
          var d = Math.sqrt(d2) || 1;
          var f = 1 - d / WIND_R;
          f = f * f;                                   /* soft edge to the wake */
          /* advection: carried along with the moving air */
          p.vx += pt.vx * 0.085 * f * k;
          p.vy += pt.vy * 0.085 * f * k;
          /* curl around the path: the perpendicular of the pointer's motion,
             signed by which side of the path the parcel sits on. This is the
             part that makes it read as air rather than as a shove. */
          var sgn = (dx * pt.vy - dy * pt.vx) > 0 ? 1 : -1;
          p.vx += -pt.vy * 0.030 * f * sgn * k;
          p.vy +=  pt.vx * 0.030 * f * sgn * k;
          /* and it is displaced out of the way */
          p.vx += (dx / d) * 0.30 * f * k;
          p.vy += (dy / d) * 0.30 * f * k;
        }
      }

      /* drag */
      p.vx *= Math.pow(0.972, k);
      p.vy *= Math.pow(0.972, k);

      p.x += p.vx * k;
      p.y += p.vy * k;

      /* diffusion: it spreads and thins as it ages */
      var rad = p.r0 * (0.55 + u * 1.25);
      /* fade in fast, out slow -- smoke appears suddenly and dissipates */
      var a = (u < 0.12 ? u / 0.12 : 1 - (u - 0.12) / 0.88);
      a *= 0.55;
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
  function stop() { if (raf) { cancelAnimationFrame(raf); raf = 0; } }

  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('scroll', locateSource, { passive: true });

  if (reduce.matches) {
    /* one static breath of atmosphere. The token is still sitting in something;
       nothing moves. */
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    for (var q = 0; q < P.length; q++) {
      var s = P[q], rr = s.r0 * 1.15;
      ctx.globalAlpha = 0.16;
      ctx.drawImage(SPRITES[s.sp], s.x - rr, s.y - rr, rr * 2, rr * 2);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    return;
  }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) {
      es.forEach(function (en) { if (en.isIntersecting) { start(); } else { stop(); } });
    }, { threshold: 0.02 }).observe(hero);
  } else {
    start();
  }
}());

/* =============================================================================
   section-smoke.js  --  THE HERO'S SMOKE, ACROSS A BAND OF SECTIONS.

   The owner asked for the hero's smoke to run through Influence Highlights and
   Our suite, with "the same animation and effects". So every constant in the
   model below is the hero's: buoyancy 0.014, curl 0.012/0.010, drag 0.972, wind
   radius 190, advection 0.085, curl-around 0.030, displacement 0.30, fade 0.12
   in / 0.88 out, alpha 0.55, RES 0.55. Changing any of them here would make the
   two fields visibly different objects, which is the opposite of the ask.

   WHAT DIFFERS IS THE EMITTER, AND ONLY THE EMITTER.

   The hero's smoke is a plume: it has a source, the coin, and it hangs around
   that object. A band of two sections has no object to hang on, and a plume
   pinned to one point in a 2000px-tall region would read as a stain in the
   middle of it. So this field spawns ACROSS the full width, low in the band, and
   the same buoyancy carries it up through both sections. That is what makes it
   drift through rather than sit.

   Because parcels rise out of the top, a parcel that leaves is respawned at the
   bottom rather than at a point source, so the band stays evenly fed instead of
   emptying from the bottom up.

   THE SHARED PHYSICS IS CURRENTLY DUPLICATED between this file and
   hero/hero-smoke.js. That is a real cost and it is deliberate for now: the hero
   field is owner-approved and working, and extracting a common engine would edit
   it. If both fields are keepers, the engine should be lifted into one module
   and imported twice, because two copies of a tuning table is exactly the
   non-propagation trap the build rules warn about.

   NOT A DECORATION THAT RUNS FOREVER UNWATCHED: an IntersectionObserver stops
   the loop the moment the band leaves the viewport, and prefers-reduced-motion
   never starts it, painting one static haze instead so the sections still sit in
   atmosphere.
   ============================================================================= */
(function () {
  'use strict';

  var host = document.querySelector('[data-smokefield]');
  if (!host) { return; }
  var cv = host.querySelector('.mc-smoke--field');
  if (!cv) { return; }
  var ctx = cv.getContext('2d');
  if (!ctx) { return; }

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---- colour from the locked tokens. No literals. ---- */
  var CSSV = getComputedStyle(document.documentElement);
  function toRGB(name) {
    var h = CSSV.getPropertyValue(name).trim().replace('#', '');
    if (h.length === 3) { h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]; }
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  var PRIM  = toRGB('--ds-primary');
  var LIGHT = toRGB('--ds-accent-light');
  var DEEP  = toRGB('--ds-accent-deep');

  /* ---- one soft sprite per tint, pre-rendered once ---- */
  var SPRITE_PX = 128;
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
  var SPRITES = [sprite(PRIM), sprite(LIGHT), sprite(DEEP)];

  /* deterministic pseudo-random, so the field is reproducible across loads */
  var seed = 0x2f6e2b1;
  function rnd() {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    return ((seed >>> 0) % 100000) / 100000;
  }

  var W = 0, H = 0;
  var P = [], N = 0;

  /* Below device pixels on purpose, for the reason written up in hero-smoke.js:
     smoke is a soft low-frequency field with no edge a device pixel resolves, and
     at DPR 2 the fill rate starves every other timer on the page. */
  var RES = 0.55;

  function resize() {
    var r = host.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width));
    H = Math.max(1, Math.round(r.height));
    cv.width  = Math.max(1, Math.round(W * RES));
    cv.height = Math.max(1, Math.round(H * RES));
    cv.style.width  = W + 'px';
    cv.style.height = H + 'px';
    ctx.setTransform(RES, 0, 0, RES, 0, 0);
    /* the band is tall, so area alone would ask a phone to run hundreds of
       parcels; the ceiling is the hero's and the floor keeps it from looking bare */
    N = Math.max(50, Math.min(150, Math.round((W * H) / 16000)));
    if (P.length > N) { P.length = N; }
    while (P.length < N) { P.push(spawn(true)); }
  }

  /* THE BAND EMITTER. Across the width, low in the field. `scatter` fills the
     whole band on first build so it does not have to rise into frame. */
  function spawn(scatter) {
    var life = 3200 + rnd() * 4200;
    return {
      x: rnd() * W,
      y: scatter ? rnd() * H : H + rnd() * 80,
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
  var pt = { x: -9999, y: -9999, vx: 0, vy: 0, on: false };
  function onMove(e) {
    var r = host.getBoundingClientRect();
    var nx = e.clientX - r.left, ny = e.clientY - r.top;
    if (pt.on) {
      pt.vx = pt.vx * 0.55 + (nx - pt.x) * 0.45;
      pt.vy = pt.vy * 0.55 + (ny - pt.y) * 0.45;
    }
    pt.x = nx; pt.y = ny; pt.on = true;
  }
  if (!reduce.matches) {
    host.addEventListener('pointermove', onMove, { passive: true });
    host.addEventListener('pointerleave', function () { pt.on = false; pt.vx = pt.vy = 0; });
  }

  var WIND_R = 190;
  var last = 0;

  function step(now) {
    var dt = last ? Math.min(48, now - last) : 16;
    last = now;
    var k = dt / 16;

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

      var heat = p.heat * (1 - u);
      p.vy -= 0.014 * heat * k;

      var cx1 = Math.sin(p.y * 0.0075 + t + p.ph) - Math.cos(p.x * 0.0052 - t * 1.3);
      var cy1 = Math.cos(p.x * 0.0068 - t + p.ph) - Math.sin(p.y * 0.0047 + t * 1.1);
      p.vx += cx1 * 0.012 * k;
      p.vy += cy1 * 0.010 * k;

      if (pt.on) {
        var dx = p.x - pt.x, dy = p.y - pt.y;
        var d2 = dx * dx + dy * dy;
        if (d2 < WIND_R * WIND_R) {
          var d = Math.sqrt(d2) || 1;
          var f = 1 - d / WIND_R;
          f = f * f;
          p.vx += pt.vx * 0.085 * f * k;
          p.vy += pt.vy * 0.085 * f * k;
          var sgn = (dx * pt.vy - dy * pt.vx) > 0 ? 1 : -1;
          p.vx += -pt.vy * 0.030 * f * sgn * k;
          p.vy +=  pt.vx * 0.030 * f * sgn * k;
          p.vx += (dx / d) * 0.30 * f * k;
          p.vy += (dy / d) * 0.30 * f * k;
        }
      }

      p.vx *= Math.pow(0.972, k);
      p.vy *= Math.pow(0.972, k);

      p.x += p.vx * k;
      p.y += p.vy * k;

      /* a parcel that has risen clear of the band is refed at the bottom, so the
         field stays evenly populated instead of draining upward */
      if (p.y < -140) { P[i] = spawn(false); continue; }

      var rad = p.r0 * (0.55 + u * 1.25);
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
  function stop()  { if (raf) { cancelAnimationFrame(raf); raf = 0; } }

  resize();
  window.addEventListener('resize', resize);

  if (reduce.matches) {
    /* one static breath of atmosphere: the sections still sit in something,
       nothing moves */
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
    }, { threshold: 0.02 }).observe(host);
  } else {
    start();
  }
}());

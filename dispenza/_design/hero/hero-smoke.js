/* =============================================================================
   hero-smoke.js  --  VIOLET SMOKE AROUND THE TOKEN, PUSHED BY THE CURSOR.

   The physics now lives in _design/smoke-engine.js, shared with the section
   band. This file supplies only what is HERO-specific: the element that defines
   the field, and an emitter that tracks the coin.

   Nothing about the look changed in the extraction. Every constant the hero used
   is the engine's default table, so the plume is the same object it was.
   ============================================================================= */
(function () {
  'use strict';

  var cv   = document.querySelector('.mc-smoke');
  var coin = document.querySelector('.mc-coin');
  var hero = document.querySelector('.mc-hero');
  var pin  = document.querySelector('.mc-hero__pin');
  if (!cv || !coin || !hero || !pin) { return; }
  if (!window.DispenzaSmoke) { return; }

  window.DispenzaSmoke.create({
    canvas: cv,
    box: pin,
    observe: hero,
    emitter: 'point',
    density: 9000,
    min: 60,
    max: 190,
    seed: 0x2f6e2b1,

    /* THE EMITTER TRACKS THE TOKEN, wherever the pose engine has placed it, so
       the smoke stays attached to the object rather than to a hardcoded point.
       This used to read the SVG coin's bbox, which became 0x0 the day the model
       took over: the guard bailed and the smoke would have spawned at (0,0) in
       the corner. There is only one coin now, so only one box to read. */
    source: function () {
      var b;
      try { b = coin.getBoundingClientRect(); } catch (e) { return null; }
      if (!b || !b.width) { return null; }
      var pr = pin.getBoundingClientRect();
      return {
        x: b.left - pr.left + b.width / 2,
        y: b.top - pr.top + b.height / 2,
        r: Math.max(40, Math.min(b.width, b.height) * 0.55)
      };
    }
  });
}());

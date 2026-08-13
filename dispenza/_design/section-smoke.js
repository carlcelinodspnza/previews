/* =============================================================================
   section-smoke.js  --  THE HERO'S SMOKE, ACROSS A BAND OF SECTIONS.

   The owner asked for the hero's smoke to run through Influence Highlights and
   Our suite with "the same animation and effects", so it runs the same engine:
   _design/smoke-engine.js holds the one tuning table and both fields read it.

   WHAT DIFFERS IS THE EMITTER, AND ONLY THE EMITTER. The hero's smoke is a
   plume: it has a source, the coin, and it hangs around that object. A band of
   two sections has no object to hang on, and a plume pinned to one point of a
   1500px-tall region would read as a stain in the middle of it. The 'band'
   emitter spawns across the full width, low, and the same buoyancy carries the
   parcels up through both sections, which is what makes it drift THROUGH rather
   than sit.

   Density is lower than the hero's because the band is far taller: particle
   count scales with area, and the hero's divisor would ask a phone to run
   several hundred parcels for a decorative field.
   ============================================================================= */
(function () {
  'use strict';

  var host = document.querySelector('[data-smokefield]');
  if (!host || !window.DispenzaSmoke) { return; }
  var cv = host.querySelector('.mc-smoke--field');
  if (!cv) { return; }

  window.DispenzaSmoke.create({
    canvas: cv,
    box: host,
    observe: host,
    emitter: 'band',
    density: 16000,
    min: 50,
    max: 150,
    seed: 0x5bd1e995
  });
}());

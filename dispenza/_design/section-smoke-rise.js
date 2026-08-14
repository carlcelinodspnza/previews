/* =============================================================================
   section-smoke-rise.js  --  THE SMOKE THAT DEFIES GRAVITY, ON PERFORMANCE
                              BENCHMARKS.

   The owner asked for "the smoke-like particles we have in other sections, but
   this time coming from the bottom of the section and sticking at the top as if
   they defy gravity. Of course the interactivity effects are the same."

   SO IT IS THE SAME ENGINE, NOT A SECOND ONE. _design/smoke-engine.js holds the
   one tuning table, the one curl field and the one pointer-wake model, and this
   file supplies an emitter and nothing else -- exactly as section-smoke.js does
   for the influence/suite band. Writing a second particle file would put a
   second copy of the wind constants on the page, which is the non-propagation
   trap the build rules name: a later tuning change lands on whichever file was
   open and the sibling silently keeps the old numbers.

   WHAT 'ceiling' CHANGES, and why 'band' could not simply be pointed at this
   section: measured, the band emitter's steady state is entirely in the BOTTOM
   THIRD of its own canvas (a 900-frame deterministic capture reads 28.85 / 0.00
   / 0.00 across the three thirds). Its buoyancy decays with heat, so a parcel
   climbs ~150px, stalls, dies and is refed at the bottom. Pointing that at
   #benchmarks would have produced a haze along the bottom edge -- the opposite
   of the ask. 'ceiling' keeps a floor under the lift so the parcels genuinely
   traverse, then arrests them in a BAND at the top rather than at a line, so the
   layer pools, spreads sideways, churns, thins and re-feeds. The full model is
   documented in smoke-engine.js under THE LID.

   THE HOST IS THE SECTION ITSELF, with no wrapper. The influence/suite field
   needed .mc-smokefield because it spans TWO sections and therefore needed a
   shared positioned ancestor -- and, because its canvas is a SIBLING of those
   sections, a ground of its own to sit on. Neither is true here: #benchmarks is
   one section and it already paints --ds-bg-surface itself, so the canvas is a
   CHILD of the element that owns the ground and the hero's own arrangement
   applies unchanged -- ground, then smoke at --ds-z-below, then every in-flow
   descendant. That costs one class, and no z-index or background override on
   any content.

   DENSITY is lower than the band's divisor because this field concentrates: a
   pooled cap of band-sized parcels merges into one smear. min/max are widened
   for the same reason -- the phone's section is 2215px tall against the
   desktop's 1019px, and the count has to hold a readable cap at both.

   The SEED differs from the band's so the two fields on the page are not
   running the same sequence of parcels at different sizes.
   ============================================================================= */
(function () {
  'use strict';

  var host = document.querySelector('[data-smokerise]');
  if (!host || !window.DispenzaSmoke) { return; }
  var cv = host.querySelector('.mc-smoke--rise');
  if (!cv) { return; }

  window.DispenzaSmoke.create({
    canvas: cv,
    box: host,
    observe: host,
    emitter: 'ceiling',
    density: 8500,
    min: 80,
    max: 200,
    seed: 0x1f83d9ab
  });
}());

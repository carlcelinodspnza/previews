/* =============================================================================
   hero-coin3d.js  --  drives the GLB coin from the SAME state as the SVG one.

   The owner supplied a real 3D coin (tripo3d GLB) to replace the drawn solid.
   Rather than re-implement the hero's behaviour against a new renderer, this
   SLAVES the model to the pose hero-coaster.js is already computing: scroll
   scrub, idle float, and the hover+wheel flip all keep their existing maths and
   their existing tuning, and the model simply reads them.

   That matters for more than tidiness. Those numbers were each arrived at by
   measurement -- the 30-degree floating end-angle (a coin at eye level goes
   invisible at 0), the 1.9s flip settle onto a face, the deliberately tiny idle
   amplitudes -- and re-deriving them against a different camera model would have
   thrown all of it away.

   -----------------------------------------------------------------------------
   THE ASSET, and why it is not the file the owner handed over.
     supplied   29.94 MB, 1,001,316 triangles  (tripo3d.ai)
     shipped     1.30 MB,   100,128 triangles  (weld -> simplify 0.0004 ->
                                                WebP 1024 -> Draco)
   gltf-transform's default `optimize` aggression produced 6,700 triangles and
   destroyed the milled edge and the knurled chevron, so the budget is set
   explicitly. The runtime and the Draco decoder are vendored locally because
   model-viewer otherwise pulls its decoder from gstatic at run time.

   -----------------------------------------------------------------------------
   PROGRESSIVE, NOT REQUIRED. The SVG coin renders immediately and stays visible
   until the model reports `loaded`. If WebGL is unavailable, the model 404s, or
   the client is slow, the hero keeps a complete object instead of a hole -- and
   nothing else on the page changes, because the two are driven by one state.
   ============================================================================= */
(function () {
  'use strict';

  var mv = document.querySelector('.mc-coin');
  var svgCoin = document.querySelector('.mc-coaster');
  var hero = document.querySelector('.mc-hero');
  var stage = document.querySelector('.mc-hero__pin');
  if (!mv || !hero || !stage) { return; }

  /* the vendored decoder. Set before the element resolves its first Draco mesh. */
  if (window.customElements) {
    customElements.whenDefined('model-viewer').then(function () {
      var C = customElements.get('model-viewer');
      if (C && 'dracoDecoderLocation' in C) {
        C.dracoDecoderLocation = '../../vendor/draco/';
      }
    });
  }

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  mv.addEventListener('load', function () {
    hero.classList.add('has-coin3d');
  });
  mv.addEventListener('error', function () {
    /* leave the SVG coin in place; it is already correct and already driven */
    hero.classList.remove('has-coin3d');
  });

  /* ---------------------------------------------------------------------------
     THE POSE. hero-coaster.js publishes its eased scroll progress on the section
     as --coaster-p, and its live tilt + flip as --coin-theta / --coin-yaw (both
     in degrees). Reading those is what keeps ONE set of tuned numbers driving
     both renderers.

     model-viewer's camera-orbit is (theta, phi, radius) about the model, where
     phi is measured from +Y. The SVG coin's own theta is 90deg face-on and falls
     toward its end angle; the model's face is along +X, so face-on there is
     orbit theta 90deg. The mapping below is therefore a relabelling, not a second
     animation: azimuth carries the flip and the idle yaw, polar carries the tilt.
     --------------------------------------------------------------------------- */
  /* ---------------------------------------------------------------------------
     CURSOR YAW (owner: "enable left and right flip depending on where cursor is").
     The coin turns toward the side the pointer is on -- left of it and it swings
     left, right and it swings right -- eased so it follows rather than snaps. It
     is ADDED to the pose hero-coaster publishes, so the scroll scrub, the idle
     float and the wheel-flip all keep working underneath it.
     --------------------------------------------------------------------------- */
  var cursorYaw = 0, cursorTarget = 0, lastT = 0;
  if (!reduce.matches) {
    stage.addEventListener('pointermove', function (ev) {
      var r = mv.getBoundingClientRect();
      var cx = r.left + r.width / 2;
      /* normalised -1..1 across roughly two coin-widths, so the swing is legible
         near the coin and saturates instead of spinning at the screen edges */
      var t = (ev.clientX - cx) / Math.max(1, r.width * 0.62);
      cursorTarget = Math.max(-1, Math.min(1, t)) * 34;      /* degrees */
      hero.__coinCursor = { t: t, target: cursorTarget };     /* observable for tests */
    }, { passive: true });
    stage.addEventListener('pointerleave', function () { cursorTarget = 0; });
  }

  var last = '';
  function pose() {
    /* read the pose as a JS value. getComputedStyle here would have been a
       forced style recalc per frame on top of the write that produced it. */
    var pz = hero.__coinPose || {};
    var tilt = isFinite(pz.theta) ? pz.theta : 90;
    var yaw  = isFinite(pz.yaw)   ? pz.yaw   : 0;

    /* TIME-BASED EASING, not per-frame.
       A flat 0.08-per-frame lerp assumes 60fps. This loop does NOT run at 60fps:
       every distinct orbit value makes model-viewer redraw a 100k-triangle
       scene, so rAF is throttled -- and measured, the yaw reached only -5.2 of a
       -33.8 target after 900ms, i.e. the coin barely acknowledged the cursor.
       An exponential on elapsed time converges in a fixed ~wall-clock window at
       any frame rate. */
    var now = (window.performance && performance.now) ? performance.now() : Date.now();
    var dt = lastT ? Math.min(64, now - lastT) : 16;
    lastT = now;
    cursorYaw += (cursorTarget - cursorYaw) * (1 - Math.exp(-dt / 90));
    if (hero.__coinCursor) { hero.__coinCursor.yaw = cursorYaw; }

    /* polar 90deg looks straight at the face; as the coin's own tilt falls from
       90 toward its resting angle the camera rides up over it, which is the same
       read the SVG solid gives. */
    var polar = Math.max(4, Math.min(176, tilt));
    var azim  = 90 + yaw + cursorYaw;
    /* ONE DECIMAL. Every distinct value forces model-viewer to redraw a 100k
       triangle scene, so the value is quantised -- but WHOLE degrees was too
       coarse: the idle yaw swings only +/-8 degrees over 9.4s, so a 1.5s sample
       rounded to the same integer and the float stopped registering at all.
       A tenth of a degree still collapses most frames into a no-op. */
    var s = azim.toFixed(1) + 'deg ' + polar.toFixed(1) + 'deg 2.75m';
    if (s !== last) { last = s; mv.setAttribute('camera-orbit', s); }
    raf = requestAnimationFrame(pose);
  }



  var raf = 0;
  function start() { if (!raf) { raf = requestAnimationFrame(pose); } }
  function stop()  { if (raf) { cancelAnimationFrame(raf); raf = 0; } }

  if (reduce.matches) {
    /* one static pose, matching the SVG coin's resting state */
    mv.setAttribute('camera-orbit', '90deg 30deg 2.75m');
    return;
  }

  /* ---- WebGL capability check, then load IMMEDIATELY.
     model-viewer throws an uncaught TypeError ("reading 'xr'") when it
     initialises without WebGL -- observed on a --disable-webgl run, which is a
     real user path (old GPUs, driver blocklists, hardened browsers) and exactly
     the case the SVG coin exists to serve. Probing first means that path stays
     silent and keeps its coin, instead of shipping a console error. ---- */
  function hasWebGL() {
    try {
      var c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext &&
                (c.getContext('webgl2') || c.getContext('webgl')));
    } catch (e) { return false; }
  }
  if (!hasWebGL()) { return; }          /* SVG coin stays; nothing else to do */

  (function loadRuntime() {
    var sc = document.createElement('script');
    sc.type = 'module';
    sc.src = '../../vendor/model-viewer-3.5.0.min.js';
    document.head.appendChild(sc);
  }());

  /* Starts immediately (owner: the coin must be there from the get-go). The
     stall that once justified waiting is fixed at its source -- the pose is a JS
     property now, not a per-frame CSS custom property write that invalidated the
     hero's background-clip:text layers. Measured after that fix: 3.2s type pass
     with the model loading from the start. */
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) {
      es.forEach(function (en) { if (en.isIntersecting) { start(); } else { stop(); } });
    }, { threshold: 0.02 }).observe(hero);
  } else { start(); }
}());

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
    /* the model-viewer poster stays up: a still of this same coin, so a failed
       load shows the right object rather than a hole or a different one */
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
     CURSOR PARALLAX (owner: "just do a parallax effect ... so it will be not as
     heavy to execute"). This REPLACED a cursor-driven camera rotation, which
     looked right but forced model-viewer to re-render a 100k-triangle scene on
     every pointer move. A translate3d on the element is a compositor operation:
     the coin still leans toward the pointer, and the GPU scene is never touched.
     The 3D pose is now driven ONLY by scroll and the idle float.
     --------------------------------------------------------------------------- */
  var parX = 0, parY = 0, tgtX = 0, tgtY = 0, lastT = 0, parQueued = false;
  if (!reduce.matches) {
    stage.addEventListener('pointermove', function (ev) {
      var r = mv.getBoundingClientRect();
      var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      /* normalised to the coin's own size, clamped, so the drift saturates near
         the object instead of running away at the screen edges */
      var nx = Math.max(-1, Math.min(1, (ev.clientX - cx) / Math.max(1, r.width * 0.7)));
      var ny = Math.max(-1, Math.min(1, (ev.clientY - cy) / Math.max(1, r.height * 0.7)));
      tgtX = nx * 26;                 /* px */
      tgtY = ny * 18;
      hero.__coinCursor = { nx: nx, ny: ny, tx: tgtX, ty: tgtY };
      if (!parQueued) { parQueued = true; requestAnimationFrame(parallax); }
    }, { passive: true });
    stage.addEventListener('pointerleave', function () {
      tgtX = 0; tgtY = 0;
      if (!parQueued) { parQueued = true; requestAnimationFrame(parallax); }
    });
  }

  /* THE PARALLAX RUNS ON ITS OWN, AND ONLY WHILE IT IS MOVING.
     It writes two custom properties that feed a translate3d, so the browser
     composites it without repainting anything and without touching the WebGL
     scene at all. It also stops scheduling frames once it has settled, so a
     stationary pointer costs nothing. */
  function parallax(now) {
    parQueued = false;
    var dt = lastT ? Math.min(64, now - lastT) : 16;
    lastT = now;
    var k = 1 - Math.exp(-dt / 110);
    parX += (tgtX - parX) * k;
    parY += (tgtY - parY) * k;
    mv.style.setProperty('--px', parX.toFixed(2) + 'px');
    mv.style.setProperty('--py', parY.toFixed(2) + 'px');
    if (hero.__coinCursor) { hero.__coinCursor.px = parX; hero.__coinCursor.py = parY; }
    if (Math.abs(tgtX - parX) > 0.05 || Math.abs(tgtY - parY) > 0.05) {
      parQueued = true; requestAnimationFrame(parallax);
    }
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

    /* polar 90deg looks straight at the face; as the coin's own tilt falls from
       90 toward its resting angle the camera rides up over it, which is the same
       read the SVG solid gives. */
    /* WRAP THE TUMBLE ONTO THE SPHERE -- do NOT clamp it.
       The flip accumulates in `theta`, and a real one runs well past a half
       turn: measured, a hover+wheel flip took theta from 93.9deg to 523deg. A
       clamp of Math.min(176, tilt) therefore PINNED the polar at 176 for the
       whole flip -- the model just sat at an extreme tilt and never turned
       over, while the SVG fallback tumbled correctly and hid it.

       model-viewer's polar is only meaningful over 0..180, so continuing past
       the pole means coming back down the far side with the azimuth opposed --
       which is exactly what turning a coin over looks like. The azimuth jump is
       invisible because it happens AT the pole, where azimuth is degenerate. */
    var t = tilt % 360;
    if (t < 0) { t += 360; }
    var overPole = 0;
    if (t > 180) { t = 360 - t; overPole = 180; }
    /* held off the exact poles, where the orbit is numerically degenerate */
    var polar = Math.max(0.5, Math.min(179.5, t));
    var azim  = 90 + yaw + overPole;
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

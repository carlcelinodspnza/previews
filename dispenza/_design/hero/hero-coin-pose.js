/* =============================================================================
   hero-coin-pose.js  --  THE MOTION STATE FOR THE HERO COIN.

   This file computes WHERE THE COIN IS and WHICH WAY IT FACES. It draws nothing.
   hero-coin3d.js reads the pose and points the model at it.

   It replaces hero-coaster.js, which did both jobs: it drew a parametric SVG
   coin AND owned the pose. That drawn coin is gone at the owner's instruction
   ("this version of the coin should no longer exist"), and with it ~450 lines of
   projection, painter sorting, back-face culling and per-face shading that
   nothing renders any more. What survives here is only the state -- which is all
   the GLB coin ever consumed.

   -----------------------------------------------------------------------------
   THREE MOTIONS, AND NOTHING ELSE TURNS IT.
   Owner: "the coin should only spin AND ONLY WHEN Hovered+Click Hold+ then
   cursor moved, otherwise it should only parallax or float."

     FLOAT     always on. A slow bob plus a slow tilt and turn, on three mutually
               prime periods so the motion never visibly repeats.
     PARALLAX  hero-coin3d.js, from cursor position. A compositor translate only.
     SPIN      press and drag, and only that. A trackball: horizontal turns the
               coin about its own vertical axis, vertical tumbles it top over
               bottom. Release carries the momentum, damps it, and seats a face.

   SCROLL DOES NOT ROTATE IT. It used to scrub the tilt from 90deg to 30deg --
   the Apple product move this component started as. That is deliberately gone;
   scroll now only moves and scales the coin through the pinned track, which is
   parallax rather than spin.
   ============================================================================= */
(function () {
  'use strict';

  var section = document.querySelector('.mc-hero');
  var stage   = document.querySelector('.mc-hero__pin');
  var coin    = document.querySelector('.mc-coin');
  if (!section || !stage || !coin) { return; }

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---- spin state. Two axes, because a drag can turn the coin either way and
     the old wheel flip could only tumble it. ---- */
  var spin = 0, spinVel = 0;          /* tumble: top over bottom */
  var spinYaw = 0, spinVelYaw = 0;    /* turn:   about its own vertical axis */
  var settling = false;
  var hoverCoin = false;
  var lastBox = { x: 0, y: 0, w: 0, h: 0 };

  function progress() {
    var r = section.getBoundingClientRect();
    var travel = r.height - stage.offsetHeight;
    if (travel <= 0) { return 1; }
    var p = -r.top / travel;
    return p < 0 ? 0 : (p > 1 ? 1 : p);
  }

  /* THE HIT BOX IS READ FROM THE COIN THAT IS ON SCREEN, every frame.
     Taking it from an element that is display:none yields a 0x0 rect, which
     silently makes the coin un-grabbable while every other behaviour keeps
     working -- exactly the failure that hid a dead flip once already. */
  function measure() {
    var b = coin.getBoundingClientRect();
    if (b.width) { lastBox = { x: b.left, y: b.top, w: b.width, h: b.height }; }
  }

  function pose(now) {
    var p = progress();
    var e = p < 0.5 ? 2*p*p : 1 - Math.pow(-2*p + 2, 2)/2;
    var t = now || 0;

    /* ---- IDLE FLOAT ----
       Amplitudes were raised once already: the first pass, tuned to the owner's
       "minimal fluid movements", read as almost static once the coin became a
       photoreal object rather than a flat drawing. The periods stay mutually
       prime so the sway drifts instead of oscillating on one clean sine. */
    var idleBob  = reduce.matches ? 0
      : (Math.sin(t / 2600) * 14 + Math.sin(t / 4300) * 6);          /* px */
    var idleTilt = reduce.matches ? 0 : Math.sin(t / 7100) * 5.5;    /* deg */
    var idleYaw  = reduce.matches ? 0
      : (Math.sin(t / 9400) * 15.0 + Math.sin(t / 5200) * 4.0);      /* deg */

    /* theta 90deg is face-on -- the read the coin was approved at. Only the
       float and a drag move it off that. */
    var theta = 90 + idleTilt + spin    * 180 / Math.PI;
    var yaw   =      idleYaw + spinYaw * 180 / Math.PI;

    section.__coinPose = { theta: theta, yaw: yaw };
    /* the bob is a transform, not a re-render: it composites alongside the
       cursor parallax that hero-coin3d.js writes into --px/--py */
    coin.style.setProperty('--bob', idleBob.toFixed(2) + 'px');
    section.style.setProperty('--coaster-p', e.toFixed(4));
    measure();
    return e;
  }

  /* ---------------------------------------------------------------------------
     THE SPIN IS A DRAG, AND ONLY A DRAG.

     This replaced a hover+wheel flip. Beyond the owner's preference, the wheel
     had a real defect: the wheel also scrolls the page, so the coin spun every
     time someone read past it with the pointer anywhere overhead. The rotation
     was never chosen -- it was a side effect of scrolling. A press-drag cannot
     fire by accident.

     Pointer capture is what makes release reliable: without it, dragging off the
     coin (the normal way to spin something) delivers pointerup to whatever is
     underneath and the coin stays stuck mid-drag.
     --------------------------------------------------------------------------- */
  var dragging = false, dragId = null, lastPX = 0, lastPY = 0, lastMoveT = 0;

  function inside(ev) {
    return ev.clientX >= lastBox.x && ev.clientX <= lastBox.x + lastBox.w &&
           ev.clientY >= lastBox.y && ev.clientY <= lastBox.y + lastBox.h;
  }
  function setCursor() {
    /* the affordance matters: a drag nobody knows about is not an interaction */
    stage.style.cursor = dragging ? 'grabbing' : (hoverCoin ? 'grab' : '');
  }

  if (!reduce.matches) {
    stage.addEventListener('pointermove', function (ev) {
      if (!dragging) { hoverCoin = inside(ev); setCursor(); return; }

      var dx = ev.clientX - lastPX, dy = ev.clientY - lastPY;
      var now = ev.timeStamp || performance.now();
      /* velocity per MILLISECOND, then scaled to a frame. Accumulating per event
         would make the same flick weaker at 60Hz than on a 120Hz pointer. */
      var dt = Math.max(8, Math.min(64, now - lastMoveT));
      lastPX = ev.clientX; lastPY = ev.clientY; lastMoveT = now;

      var K = 0.011;                       /* radians per pixel: 1:1 with the hand */
      spinYaw += dx * K;
      spin    += dy * K;
      spinVelYaw = (dx * K / dt) * 16;
      spinVel    = (dy * K / dt) * 16;
      settling = false;
    }, { passive: true });

    stage.addEventListener('pointerdown', function (ev) {
      if (!inside(ev)) { return; }          /* the coin, not the whole hero */
      if (ev.button !== undefined && ev.button !== 0) { return; }
      dragging = true; dragId = ev.pointerId;
      lastPX = ev.clientX; lastPY = ev.clientY;
      lastMoveT = ev.timeStamp || performance.now();
      spinVel = 0; spinVelYaw = 0; settling = false;
      try { stage.setPointerCapture(ev.pointerId); } catch (e) { /* older engines */ }
      setCursor();
    });

    function endDrag(ev) {
      if (!dragging || (ev && dragId !== null && ev.pointerId !== dragId)) { return; }
      dragging = false; dragId = null;
      /* a click that never moved must not launch a spin */
      if (Math.abs(spinVel) < 0.002 && Math.abs(spinVelYaw) < 0.002) {
        spinVel = 0; spinVelYaw = 0; settling = true;
      }
      try { if (ev) { stage.releasePointerCapture(ev.pointerId); } } catch (e) {}
      if (ev) { hoverCoin = inside(ev); }
      setCursor();
    }
    stage.addEventListener('pointerup', endDrag);
    stage.addEventListener('pointercancel', endDrag);
    stage.addEventListener('pointerleave', function () {
      if (dragging) { return; }             /* capture keeps the drag alive */
      hoverCoin = false; setCursor();
    });
  }

  /* THE DECAY IS TIME-BASED, NOT PER-FRAME -- and that is not a nicety here.

     A flat "v *= 0.90 each frame" assumes 60fps. This loop does NOT run at 60fps:
     every distinct pose makes model-viewer redraw a 212k-triangle scene, so rAF
     is throttled hard. Measured with the per-frame constant, a released spin
     decayed only 12x in SIX SECONDS (0.049 -> 0.0039 rad/frame) where 0.9^n
     predicts ~0.7s, `settling` never flipped true, and the coin coasted to rest
     36deg off a face -- edge-on-ish, the one orientation a coin must not stop in.
     hero-coin3d.js already carries this exact lesson for the camera easing; the
     settle needed it too.

     Both constants below are the 60fps behaviour re-expressed as time:
       damping  0.90 per 16.7ms  ->  exp(-dt/158ms)
       settle   0.16 per 16.7ms  ->  1 - exp(-dt/96ms)
     so the gesture keeps its measured ~1.9s weight at ANY frame rate. */
  var DAMP_TAU = 158, SETTLE_TAU = 96, lastSpinT = 0;

  function advanceSpin(now) {
    if (dragging) { lastSpinT = now; return; }   /* while held, the cursor IS the pose */
    var dt = lastSpinT ? Math.min(120, now - lastSpinT) : 16;
    lastSpinT = now;
    if (dt <= 0) { return; }
    var frames = dt / 16.667;                    /* velocities are per-frame units */

    if (Math.abs(spinVel) > 0.0006 || Math.abs(spinVelYaw) > 0.0006) {
      spin    += spinVel    * frames;
      spinYaw += spinVelYaw * frames;
      var d = Math.exp(-dt / DAMP_TAU);
      spinVel    *= d;
      spinVelYaw *= d;
      if (Math.abs(spinVel) <= 0.0006 && Math.abs(spinVelYaw) <= 0.0006) { settling = true; }
    } else if (settling) {
      /* seat on the nearest half turn ON BOTH AXES, so a FACE is showing and
         never the edge -- the one orientation in which a coin is invisible. A
         drag can leave it off-axis in yaw too, which the old wheel flip could
         not, so seating only the tumble would still have left it edge-on. */
      var k = 1 - Math.exp(-dt / SETTLE_TAU);
      var tT = Math.round(spin / Math.PI) * Math.PI;
      var tY = Math.round(spinYaw / Math.PI) * Math.PI;
      var dT = tT - spin, dY = tY - spinYaw;
      if (Math.abs(dT) < 0.002 && Math.abs(dY) < 0.002) {
        spin = tT; spinYaw = tY; settling = false;
      } else {
        spin += dT * k; spinYaw += dY * k;
      }
    }
  }

  var raf = 0;
  function frame(now) {
    advanceSpin(now);
    pose(now);
    raf = requestAnimationFrame(frame);
  }

  if (reduce.matches) {
    pose(0);                                 /* one resting pose, no loop */
  } else {
    pose(0);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        es.forEach(function (en) {
          if (en.isIntersecting && !raf) { raf = requestAnimationFrame(frame); }
          else if (!en.isIntersecting && raf) { cancelAnimationFrame(raf); raf = 0; }
        });
      }, { threshold: 0.02 }).observe(section);
    } else {
      raf = requestAnimationFrame(frame);
    }
    window.addEventListener('resize', function () { pose(performance.now()); });
  }
}());

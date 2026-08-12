/* =============================================================================
   hero-coaster.js  --  THE DISPENZA CHALLENGE COIN.

   A struck hexagonal coin that floats in the hero's right column: polished rim,
   milled edge, recessed enamel face with a guilloche turning, and the client's
   mark raised at its centre. It responds to three things and nothing else:

     SCROLL     rotates it from face-on toward a tilted read (the Apple product
                move), as a pure function of scroll position.
     TIME       an idle float -- a slow bob, a slow yaw, a slow tilt -- so a
                stationary page still shows an object hanging in air rather than
                a sticker. Owner: "when not scrolling, the coin must look like it
                is literally floating with minimal fluid movements."
     HOVER+WHEEL a flip. Wheel events while the pointer is over the coin add
                angular momentum; it spins, damps, and settles on a face.

   -----------------------------------------------------------------------------
   THE GEOMETRY IS MEASURED, NOT INVENTED.

   Read off the owner's reference mesh (hexagonal-metal-coaster.obj, 1,514 verts,
   Blender 3.4.1) by bucketing vertices into Y levels and taking the radius at
   each:
       circumradius R      0.05387
       inradius            0.04639   -> /R = 0.861 ~ cos30, a REGULAR hexagon
       thickness t         0.00686   -> 0.1273 R
       flat face radius    0.03988   -> 0.740 R
       chamfer height      0.00084   -> 0.122 t
   Rebuilt parametrically rather than shipping 1,512 faces: the source is a
   lathe-simple solid so the silhouette is identical, and per-frame shading
   becomes affordable.

   THE MATERIAL comes from the owner's photograph of the real coin: a polished
   silver rim and milled edge, a deep purple enamel field recessed inside it
   carrying concentric turning lines, and a polished raised mark. The first build
   painted the whole thing flat violet, which read as a shape rather than an
   object. Every colour is still mixed from the locked tokens at runtime -- the
   silver is --ds-signature, the enamel is --ds-accent-deep -- so nothing here can
   drift from dispenza-tokens.css.

   -----------------------------------------------------------------------------
   PROJECTION. Object local space: lx right, ly up, lz toward the viewer. The coin
   yaws about its own Y axis, then tilts about its X axis, then sits at (0,Yc,Zc)
   in front of a camera at the origin looking down +Z:

       yaw:   lx' =  lx*cosY + lz*sinY        lz' = -lx*sinY + lz*cosY
       tilt:  ry  =  ly*cosT + lz'*sinT       rz  = -ly*sinT + lz'*cosT
       screen_x = CX + lx' * F / Z            Z = Zc + rz
       screen_y = CY + (Yc - ry) * F / Z

   Two sign conventions in this file have bitten before and are called out where
   they are used: the tilt direction (theta=90 must face the camera) and the
   back-face test (world Y is DOWN-positive here while the rotated normal's Y is
   UP-positive). Both are derived below rather than approximated on screen.
   ============================================================================= */
(function () {
  'use strict';

  var svg = document.querySelector('.mc-coaster');
  if (!svg) { return; }
  var stage = svg.closest('.mc-hero__pin');
  var section = document.querySelector('.mc-hero');
  if (!stage || !section) { return; }

  var VB = svg.getAttribute('viewBox').split(' ').map(Number);
  var W = VB[2], H = VB[3];

  /* ---- measured proportions (see header) ---- */
  var R      = 1;
  var T      = 0.1273 * R;      /* thickness              */
  var RFLAT  = 0.740  * R;      /* flat face radius       */
  var CHAM   = 0.122  * T;      /* chamfer height         */
  var ENAMEL_R = 0.845;         /* enamel field, as a fraction of the flat face */

  var F = 1500;                 /* focal length */

  /* ---- colour, mixed from the locked tokens at runtime. No literals. ---- */
  var CSSV = getComputedStyle(document.documentElement);
  function toRGB(name) {
    var h = CSSV.getPropertyValue(name).trim().replace('#', '');
    if (h.length === 3) { h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2]; }
    return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
  }
  function mix(a, b, t) { return [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t]; }
  function css(c) {
    return 'rgb(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ')';
  }
  var SURF   = toRGB('--ds-bg-surface');
  var PRIM   = toRGB('--ds-primary');
  var LIGHT  = toRGB('--ds-accent-light');
  var DEEP   = toRGB('--ds-accent-deep');
  var SILVER = toRGB('--ds-signature');        /* #e3e3e3 -- the polished metal */
  var BLACK  = [0, 0, 0];
  var WHITE  = [255, 255, 255];

  /* ---- hexagon rings. POINTY along lz, matching the reference mesh, whose Z
     span (0.1064) is the long one against X (0.0940). ---- */
  function ring(radius, y) {
    var pts = [];
    for (var i = 0; i < 6; i++) {
      var a = Math.PI / 180 * (60 * i);
      pts.push([radius * Math.sin(a), y, radius * Math.cos(a)]);
    }
    return pts;
  }
  var r0 = ring(RFLAT, 0),          /* bottom flat edge   */
      r1 = ring(R,     CHAM),       /* bottom of the wall */
      r2 = ring(R,     T - CHAM),   /* top of the wall    */
      r3 = ring(RFLAT, T);          /* top flat edge      */

  var FACES = [];
  FACES.push([r3.slice(), 'top']);
  FACES.push([r0.slice().reverse(), 'bottom']);
  for (var i = 0; i < 6; i++) {
    var j = (i + 1) % 6;
    FACES.push([[r2[i], r2[j], r3[j], r3[i]], 'chamfer']);
    FACES.push([[r1[i], r1[j], r2[j], r2[i]], 'wall']);
    FACES.push([[r0[i], r0[j], r1[j], r1[i]], 'chamfer']);
  }

  var markEl   = svg.querySelector('.mc-coaster__mark');
  var facesEl  = svg.querySelector('.mc-coaster__faces');
  var shadowEl = svg.querySelector('.mc-coaster__shadow');
  var allEl    = svg.querySelector('.mc-coaster__all');
  var content  = section.querySelector('.mc-hero__content');

  function sub(a, b) { return [a[0]-b[0], a[1]-b[1], a[2]-b[2]]; }
  function cross(a, b) {
    return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
  }
  function norm(v) {
    var m = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0]/m, v[1]/m, v[2]/m];
  }
  var LIGHTDIR = norm([-0.45, 0.82, 0.36]);   /* key light: upper left, front */

  /* ---------------------------------------------------------------------------
     STATE: scroll pose + idle float + flip momentum
     --------------------------------------------------------------------------- */
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var spinVel = 0;        /* radians per frame, from the wheel while hovering */
  var spin    = 0;        /* accumulated flip                                  */
  var settling = false;
  var hoverCoin = false;
  var lastBox = { x: 0, y: 0, w: 0, h: 0 };   /* the coin's screen box, for hit-testing */

  function progress() {
    var r = section.getBoundingClientRect();
    var travel = r.height - stage.offsetHeight;
    if (travel <= 0) { return 1; }
    var p = -r.top / travel;
    return p < 0 ? 0 : (p > 1 ? 1 : p);
  }

  function render(p, now) {
    var e = p < 0.5 ? 2*p*p : 1 - Math.pow(-2*p + 2, 2)/2;

    /* the visible window: `slice` crops, so W/2 is NOT the centre of what the
       visitor can see, and sizing off H alone swallows a narrow screen */
    var rc = svg.getBoundingClientRect();
    var sc = Math.max(rc.width / W, rc.height / H) || 1;
    var VW = rc.width / sc, VH = rc.height / sc;

    var stacked = VW / VH < 1.15;
    var cxFrac = parseFloat(getComputedStyle(stage).getPropertyValue('--token-cx')) || 0.72;

    /* ---- IDLE FLOAT. Three slow, mutually prime periods so the motion never
       visibly repeats: a bob, a yaw and a tilt wobble. Amplitudes are small on
       purpose -- the owner asked for "minimal fluid movements", and a coin
       hanging in still air drifts, it does not bounce. ---- */
    var t = now || 0;
    /* Amplitudes raised on request (2026-08-12): the first pass was tuned to
       "minimal fluid movements" and read as almost static once the coin became a
       photoreal object. The three periods stay mutually prime so the sway still
       never visibly repeats, and a second slower term is added to the bob so it
       drifts rather than oscillating on one clean sine. */
    var idleBob  = reduce.matches ? 0
      : (Math.sin(t / 2600) * 0.020 + Math.sin(t / 4300) * 0.009) * VH;
    var idleTilt = reduce.matches ? 0 : Math.sin(t / 7100) * 5.5 * Math.PI / 180;
    var idleYaw  = reduce.matches ? 0
      : (Math.sin(t / 9400) * 15.0 + Math.sin(t / 5200) * 4.0) * Math.PI / 180;

    /* ---- POSE ----
       theta = 90deg is face-on. Floating stops short of flat: at eye level a
       fully flat coin is exactly edge-on, gets correctly culled, and collapses to
       a sliver with its face gone (measured: 9 faces -> 6, mark 0.95 -> 0). */
    var endTheta = stacked ? 4 : 30;
    var theta = (90 - (90 - endTheta) * e) * Math.PI / 180 + idleTilt + spin;
    var yaw   = idleYaw;

    var Zc    = 1050 - 120 * e;
    var diam  = stacked
      ? Math.min(0.62 * VW, 0.30 * VH) * (1 + 0.18 * e)
      : Math.min(0.42 * VW, 0.52 * VH) * (1 + 0.18 * e);
    var scale = diam * Zc / (2 * F);
    /* Yc is a WORLD offset and screen y = CY + Yc*F/Z, so the target screen
       offset is converted back rather than guessed -- guessing it once put the
       coin 174px below its own canvas with every assertion still green. */
    var Yc    = (((stacked ? 0.30 : 0.02) * VH) + idleBob) * Zc / F;

    publish(theta, yaw);
    var ct = Math.cos(theta), st = Math.sin(theta);
    var cy2 = Math.cos(yaw),  sy2 = Math.sin(yaw);
    var CX = (W - VW) / 2 + VW * (stacked ? 0.5 : cxFrac);
    var CY = H / 2;

    /* SIGN NOTE. An earlier build rotated the other way, which pointed the top
       face AWAY from the camera at theta=90 -- the coin showed its blank
       underside while "facing" the viewer. Caught by asserting the mark's opacity
       at BOTH ends of the scrub rather than by looking at one frame. */
    function project(v) {
      var lx0 = v[0]*scale, ly = v[1]*scale, lz0 = v[2]*scale;
      var lx =  lx0*cy2 + lz0*sy2;
      var lz = -lx0*sy2 + lz0*cy2;
      var ry =  ly*ct + lz*st;
      var rz = -ly*st + lz*ct;
      var Z = Zc + rz;
      return { x: CX + lx*F/Z, y: CY + (Yc - ry)*F/Z, z: Z, ry: ry, rz: rz, lx: lx };
    }
    function rotN(n) {
      var nx =  n[0]*cy2 + n[2]*sy2;
      var nz = -n[0]*sy2 + n[2]*cy2;
      return [nx, n[1]*ct + nz*st, -n[1]*st + nz*ct];
    }

    var drawn = [], topPts = null, botPts = null, topArea = 0, topVisible = false;

    for (var k = 0; k < FACES.length; k++) {
      var vs = FACES[k][0], kind = FACES[k][1];
      var n = norm(cross(sub(vs[1], vs[0]), sub(vs[2], vs[0])));
      var rn = rotN(n);

      var cxs = 0, cys = 0, czs = 0;
      for (var m = 0; m < vs.length; m++) { cxs += vs[m][0]; cys += vs[m][1]; czs += vs[m][2]; }
      cxs /= vs.length; cys /= vs.length; czs /= vs.length;

      /* BACK-FACE TEST, DERIVED IN WORLD SPACE. Building the view vector from
         screen deltas and dotting it against a normal whose Y is UP-positive
         (screen Y is DOWN-positive) disagrees in sign for any face away from the
         optical centre -- which is every face here. It silently culled the TOP
         face at the resting angle, so the logo could never appear on the coin. */
      var lxc0 = cxs*scale, lzc0 = czs*scale, lyc = cys*scale;
      var lxc =  lxc0*cy2 + lzc0*sy2;
      var lzc = -lxc0*sy2 + lzc0*cy2;
      var ryC =  lyc*ct + lzc*st;
      var rzC = -lyc*st + lzc*ct;
      var facing = -rn[0]*lxc + rn[1]*(Yc - ryC) - rn[2]*(Zc + rzC);
      if (facing <= 0) { continue; }

      var pts = [], depth = 0, PX = [], PY = [];
      for (var q = 0; q < vs.length; q++) {
        var pr = project(vs[q]);
        pts.push(pr.x.toFixed(1) + ',' + pr.y.toFixed(1));
        PX.push(pr.x); PY.push(pr.y);
        depth += pr.z;
      }
      depth /= vs.length;

      if (kind === 'top' || kind === 'bottom') {
        var sh = 0;
        for (var q2 = 0; q2 < PX.length; q2++) {
          var q3 = (q2 + 1) % PX.length;
          sh += PX[q2]*PY[q3] - PX[q3]*PY[q2];
        }
        if (kind === 'top') { topVisible = true; topArea = Math.abs(sh)/2; topPts = { X: PX, Y: PY }; }
        else { botPts = { X: PX, Y: PY }; }
      }

      var lam = Math.max(0, rn[0]*LIGHTDIR[0] + rn[1]*LIGHTDIR[1] + rn[2]*LIGHTDIR[2]);
      var s = '';

      if (kind === 'top' || kind === 'bottom') {
        /* THE POLISHED RIM. Silver, driven hard by the key light so it reads as
           metal rather than as grey paint: a mirror's whole character is that it
           swings from near-white to near-black across a small angle change. */
        /* The ramp carries the reflection; the Lambert term only sets how much of
           it survives, which is what keeps the metal reading as metal while the
           coin turns instead of flipping between two flat greys. */
        s += '<polygon points="' + pts.join(' ') + '" fill="url(#coinRim)" opacity="' +
             (0.42 + 0.58*Math.pow(lam, 0.85)).toFixed(3) + '"/>';

        /* THE ENAMEL, recessed inside the rim. Lerping the projected vertices
           toward their own centroid is exact enough for a flat face and costs no
           extra geometry. */
        var gx = 0, gy = 0;
        for (var q4 = 0; q4 < PX.length; q4++) { gx += PX[q4]; gy += PY[q4]; }
        gx /= PX.length; gy /= PY.length;
        var inner = function (f) {
          var o = [];
          for (var q5 = 0; q5 < PX.length; q5++) {
            o.push((gx + (PX[q5]-gx)*f).toFixed(1) + ',' + (gy + (PY[q5]-gy)*f).toFixed(1));
          }
          return o.join(' ');
        };
        /* a dark seam where the enamel steps down from the rim */
        s += '<polygon points="' + inner(ENAMEL_R + 0.035) + '" fill="' +
             css(mix(mix(SURF, DEEP, 0.55), BLACK, 0.45)) + '"/>';
        var enam = mix(mix(SURF, DEEP, 0.86), PRIM, 0.10 + 0.26*lam);
        s += '<polygon points="' + inner(ENAMEL_R) + '" fill="url(#coinEnamel)" opacity="' +
             (0.62 + 0.38*lam).toFixed(3) + '"/>';

        /* THE GUILLOCHE. The reference coin's enamel is turned with fine
           concentric rings; without them the face is a flat swatch and the whole
           object stops reading as struck metal. Seven rings, barely there. */
        var ringC = css(mix(enam, WHITE, 0.10));
        for (var g2 = 1; g2 <= 7; g2++) {
          s += '<polygon points="' + inner(ENAMEL_R * (0.16 + g2 * 0.105)) +
               '" fill="none" stroke="' + ringC + '" stroke-width="0.7" opacity="0.30"/>';
        }
      } else if (kind === 'wall') {
        var wallC = mix(mix(SURF, SILVER, 0.14 + 0.46*Math.pow(lam, 1.4)), DEEP, 0.16);
        s += '<polygon points="' + pts.join(' ') + '" fill="' + css(wallC) + '"/>';
        /* MILLING. The reference coin's edge is reeded; a plain band reads as
           plastic. Six strokes per wall segment, interpolated across the quad. */
        var millC = css(mix(wallC, BLACK, 0.42));
        for (var mm = 1; mm <= 6; mm++) {
          var f2 = mm / 7;
          var ax = PX[0] + (PX[1]-PX[0])*f2, ay = PY[0] + (PY[1]-PY[0])*f2;
          var bx = PX[3] + (PX[2]-PX[3])*f2, by = PY[3] + (PY[2]-PY[3])*f2;
          s += '<line x1="' + ax.toFixed(1) + '" y1="' + ay.toFixed(1) +
               '" x2="' + bx.toFixed(1) + '" y2="' + by.toFixed(1) +
               '" stroke="' + millC + '" stroke-width="0.6" opacity="0.55"/>';
        }
      } else {
        /* The chamfer is the coin's brightest edge -- the one place a polished
           bevel catches the key light almost specularly. It takes the SAME
           reflection ramp as the rim: filling it with a single mixed tone left
           the widest metal band on the object reading as flat lilac while the
           narrower seam beside it read as chrome, which is backwards. */
        var hot = Math.pow(lam, 1.15);
        s += '<polygon points="' + pts.join(' ') + '" fill="url(#coinRim)" opacity="' +
             (0.34 + 0.66*hot).toFixed(3) + '"/>';
      }

      drawn.push({ d: depth, s: s });
    }

    drawn.sort(function (a, b) { return b.d - a.d; });     /* far first */
    var outStr = '';
    for (var z = 0; z < drawn.length; z++) { outStr += drawn[z].s; }
    facesEl.innerHTML = outStr;

    /* ---- the mark, struck into the enamel of the FRONT face only. A challenge
       coin's reverse carries a different design; here the reverse is plain
       enamel, which is what makes the flip legible as a flip. ---- */
    if (markEl) {
      if (!topVisible) {
        markEl.setAttribute('opacity', '0');
      } else {
        var MK = RFLAT * 0.56;
        var o  = project([0, T, 0]);
        var px = project([MK, T, 0]);
        var pz = project([0, T, MK]);
        var sx = (px.x - o.x) / 32, sy = (px.y - o.y) / 32;
        var tx = (pz.x - o.x) / 32, ty = (pz.y - o.y) / 32;
        markEl.setAttribute('transform',
          'matrix(' + sx.toFixed(4) + ',' + sy.toFixed(4) + ',' +
                      tx.toFixed(4) + ',' + ty.toFixed(4) + ',' +
                      (o.x - 32*sx - 32*tx).toFixed(2) + ',' +
                      (o.y - 32*sy - 32*ty).toFixed(2) + ')');
        /* Threshold set from MEASUREMENT: the top face foreshortens to 0.226 at
           375px, 0.240 at 1100 and 0.361 at 1440 when resting. An earlier cut of
           0.30 switched the logo off at exactly the state the coin rests in on
           most screens. */
        var flatArea = 2.598 * Math.pow(RFLAT * scale * F / Zc, 2);
        var legible = flatArea > 0 ? Math.min(1, (topArea / flatArea) / 0.07) : 0;
        markEl.setAttribute('opacity', (legible * 0.95).toFixed(3));
      }
    }

    /* ---- contact shadow: tight and soft, tightening as the coin settles ---- */
    if (shadowEl) {
      var base = project([0, 0, 0]);
      var w2 = scale * F / Zc;
      shadowEl.setAttribute('cx', base.x.toFixed(1));
      shadowEl.setAttribute('cy', (base.y + w2 * 0.06).toFixed(1));
      shadowEl.setAttribute('rx', (w2 * (0.72 + 0.22*e)).toFixed(1));
      shadowEl.setAttribute('ry', (w2 * (0.10 + 0.16*e)).toFixed(1));
      shadowEl.setAttribute('opacity', (0.22 + 0.36*e).toFixed(2));
    }

    /* ---- remember where the coin is, for hover hit-testing ---- */
    try {
      var gb = allEl.getBoundingClientRect();
      lastBox = { x: gb.left, y: gb.top, w: gb.width, h: gb.height };
    } catch (err) { /* not laid out yet */ }

    /* ---- the coin never sits on the type. Measured, not predicted: ask for the
       real bbox and translate by the shortfall. Only applies when the two
       actually share horizontal space -- running it unconditionally once shoved
       the coin clean off the canvas while its bbox stayed measurable and every
       box-comparison assertion kept passing. ---- */
    if (allEl && content) {
      allEl.removeAttribute('transform');
      var bb = allEl.getBBox();
      var cr = content.getBoundingClientRect();
      var offX2 = (W - VW)/2, offY2 = (H - VH)/2;
      var claimLeftVB  = (cr.left  - rc.left)/sc + offX2;
      var claimRightVB = (cr.right - rc.left)/sc + offX2;
      if ((bb.x < claimRightVB) && (bb.x + bb.width > claimLeftVB)) {
        var claimBottomVB = (cr.bottom - rc.top)/sc + offY2;
        var floorVB = offY2 + VH;
        var GAP = Math.max(18, VH * 0.035);
        var dy = (claimBottomVB + GAP) - bb.y;
        if (dy < 0) { dy = 0; }
        var overshoot = (bb.y + dy + bb.height) - (floorVB - GAP*0.5);
        if (overshoot > 0 && bb.height > 1) {
          var kf = Math.max(0.35, 1 - overshoot/bb.height);
          var topY = bb.y + dy;
          allEl.setAttribute('transform',
            'translate(0 ' + dy.toFixed(1) + ') translate(0 ' + topY.toFixed(1) +
            ') scale(1 ' + kf.toFixed(3) + ') translate(0 ' + (-topY).toFixed(1) + ')');
        } else if (dy > 0) {
          allEl.setAttribute('transform', 'translate(0 ' + dy.toFixed(1) + ')');
        }
      }
    }
    return e;
  }

  /* ---------------------------------------------------------------------------
     THE FLIP.  Owner: "when user hovers on the coin and scrolls, the coin also
     flips."  ALSO is the operative word -- the page must keep scrolling normally,
     so the wheel is never consumed and nothing is preventDefault-ed. The wheel
     only adds ANGULAR MOMENTUM while the pointer is over the coin.

     It then behaves like a real flipped coin: momentum, damping, and a settle
     onto the nearest face. Without the settle it can come to rest exactly
     edge-on, which is the one orientation where a coin is invisible.
     --------------------------------------------------------------------------- */
  if (!reduce.matches) {
    stage.addEventListener('pointermove', function (ev) {
      hoverCoin = ev.clientX >= lastBox.x && ev.clientX <= lastBox.x + lastBox.w &&
                  ev.clientY >= lastBox.y && ev.clientY <= lastBox.y + lastBox.h;
    }, { passive: true });
    stage.addEventListener('pointerleave', function () { hoverCoin = false; });
    stage.addEventListener('wheel', function (ev) {
      if (!hoverCoin) { return; }
      spinVel += Math.max(-0.09, Math.min(0.09, ev.deltaY * 0.00055));
      settling = false;
    }, { passive: true });          /* passive: the page still scrolls */
  }

  /* DAMPING TUNED FROM A MEASUREMENT, not from feel. At 0.955 per frame with a
     0.08 settle ease, a hard flick took ~162 frames to shed its momentum and ~90
     more to seat -- about 4.2 SECONDS during which the coin is mid-tumble and
     often edge-on. A flipped coin lands in about a second and a half. 0.90 and
     0.16 put the whole gesture near 1.9s, which still reads as weight rather
     than as a snap. */
  function advanceSpin() {
    if (Math.abs(spinVel) > 0.0006) {
      spin += spinVel;
      spinVel *= 0.90;
      if (Math.abs(spinVel) <= 0.0006) { settling = true; }
    } else if (settling) {
      /* ease onto the nearest half turn so a FACE is showing, never the edge --
         the one orientation in which a coin is invisible */
      var target = Math.round(spin / Math.PI) * Math.PI;
      var d = target - spin;
      if (Math.abs(d) < 0.002) { spin = target; settling = false; }
      else { spin += d * 0.16; }
    }
  }

  /* ---------------------------------------------------------------------------
     THE LOOP. Continuous, because the idle float and the flip both need time --
     but stopped dead the moment the hero leaves the viewport, so nothing runs
     unwatched.
     --------------------------------------------------------------------------- */
  var raf = 0;
  function frame(now) {
    advanceSpin();
    var e = render(progress(), now);
    section.style.setProperty('--coaster-p', e.toFixed(4));
    raf = requestAnimationFrame(frame);
  }

  /* PUBLISH THE POSE. The GLB coin (hero-coin3d.js) is slaved to these rather
     than running its own animation, so the tilt, the idle float and the flip are
     computed ONCE and both renderers agree by construction. Every one of those
     numbers came out of a measurement -- the 30deg floating end-angle, the 1.9s
     settle, the deliberately small idle amplitudes -- and duplicating the maths
     for a second renderer is how two objects start disagreeing. */
  function publish(thetaRad, yawRad) {
    /* A PLAIN JS PROPERTY, NOT A CSS CUSTOM PROPERTY.
       The first version wrote --coin-theta/--coin-yaw onto .mc-hero every frame.
       That invalidates style for the WHOLE hero subtree 60 times a second -- and
       that subtree contains the two background-clip:text elements whose repaint
       was already measured as the most expensive thing on this page. Result: the
       type pass went from 3.0s to 13.4s, and it was NOT the 3D at all (the model
       and its runtime were already deferred until after typing).
       Passing the pose as a JS value touches no styles and costs nothing. */
    section.__coinPose = {
      theta: thetaRad * 180 / Math.PI,
      yaw:   yawRad   * 180 / Math.PI
    };
  }

  if (reduce.matches) {
    /* drawn once, in its resting pose. Every material, the mark and the shadow
       are all present; only movement is removed. */
    var e0 = render(1, 0);
    section.style.setProperty('--coaster-p', '1');
  } else {
    render(0, 0);
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
    window.addEventListener('resize', function () { render(progress(), performance.now()); });
  }
}());

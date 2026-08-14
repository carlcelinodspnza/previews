/* =============================================================================
   hex-field.js  --  the isometric hexagon field, lifted out of the hero and made
   mountable on ANY host. Self-contained. No dependencies.

   WHAT WAS LIFTED, AND WHAT WAS DELIBERATELY LEFT BEHIND.

   hero-field.js draws this picture but is welded to the hero: it queries
   .mc-hero__field, .mc-hero, .mc-display, .mc-lead-wrap and .mc-type .ch, and it
   owns the headline's type-lighting and the character reveal. None of those nodes
   exist under the case studies or the footer. This module keeps the FIELD and its
   two lights and drops every hero-only coupling; there is no querySelector in
   here for anything the caller did not hand it. hero-field.js is untouched and
   still owns the hero.

   -----------------------------------------------------------------------------
   THE PROJECTION. Unchanged in kind from the hero: a real perspective camera,
   not an affine squash. World: a ground plane, X across, Z away.

       screen_x = W/2 + X * F / Z
       screen_y = HZN + (EY - height) * F / Z

   Every VERTEX is projected on its OWN Z, so the hexagons are genuinely
   perspective-distorted rather than uniformly scaled.

   ONE CHANGE from the hero, and it is the reason this reads as ground rather
   than as a scene: HZN (the horizon) is placed ABOVE the top edge of the field,
   not inside it. The hero wants a visible horizon with sky over it. Here the
   field runs behind two adjacent page regions, so a horizon line would draw a
   hard rule across the case studies and announce "this is a picture". With the
   horizon off the top, every pixel of the region is ground plane: prisms simply
   get smaller as they go up and dissolve into the section's own darkness.

   Extrusion heights come from a deterministic hash of (col,row). No Math.random:
   the field is identical on every load, so a screenshot comparison between two
   builds actually means something.

   Painting is far-to-near (painter's algorithm), and a side wall is emitted only
   when its edge midpoint is NEARER than the cell centre -- the back-face cull for
   a convex prism with the camera in front.

   -----------------------------------------------------------------------------
   SEAMLESS, AND WHY IT CANNOT DRIFT.

   The brief is that the plane must read as ONE continuous surface running under
   the case studies AND the footer, with no butt-joint, no brightness step and no
   restart of the pattern where they meet.

   Two independently-mounted fields cannot do that. Even with a shared seed they
   would still be two cameras, two aspect ratios and two light phases, and every
   one of those is a visible step at the joint.

   So this module does not mount a field per host. It mounts ONE FIELD and gives
   each host a WINDOW onto it:

     * the union of every host's box, in document coordinates, IS the field. One
       width, one height, one camera, one geometry pass, one string of SVG.
     * each host gets that same string, in an <svg> sized to the WHOLE field and
       offset by (fieldOrigin - hostOrigin), so the host's box is a viewport onto
       the shared plane. The host clips; the plane does not move.
     * the scroll light and the pointer light are computed ONCE in field
       coordinates and written to every window with the SAME value.

   The joint is therefore not "tuned to match" -- the two windows are showing the
   same image at the same document position, so the pixel above the joint and the
   pixel below it come from one continuous render. There is no value anywhere in
   this file that could be set differently per host and open a seam.

   That also decides the mount. A single wrapper element cannot span the case
   studies and the footer, because </main> closes between them and a <div> may not
   cross that boundary without either swallowing the footer into <main> (which
   destroys the contentinfo landmark) or producing invalid nesting. Windows onto a
   shared plane need no wrapper at all: one absolutely-positioned, aria-hidden,
   pointer-events:none child inside each region. The landmark structure is
   untouched and the markup stays valid.

   -----------------------------------------------------------------------------
   UNCROPPED.

   Two things could slice a prism: the SVG's own scaling, and the field's outer
   edge.

   The first is designed out. The hero stretches a fixed 1400x760 viewBox with
   preserveAspectRatio="xMidYMid slice", which is right for a hero whose box is
   near that aspect. This field's box is 1440x1668 at desktop and 390x2987 at
   390 -- nowhere near a fixed aspect, and `slice` on those would blow the plane
   up by 4x and cut prisms in half. So the viewBox here is generated at the
   field's exact pixel size, 1:1, every time it is measured. There is no scaling
   step in which anything can be cut, and pointer coordinates need no conversion.

   The second is handled by fading rather than by hoping. The grid is OVER-SCANNED
   past all four edges, so cells always continue beyond the visible box, and the
   whole field is drawn through an edge mask that reaches exactly zero at each
   edge. A prism that crosses the boundary is therefore already invisible where
   the boundary cuts it. The mask lives INSIDE the shared render, in field
   coordinates, so it is continuous across the joint -- putting the fade on the
   hosts instead would produce a dark band exactly where the seam must not be.

   -----------------------------------------------------------------------------
   THE LIGHT, and the forbidden list.

   The owner's motion spec forbids timelines, autoplay and anything looping on a
   clock. Both lights here are position-driven and have no timeline:

     * the travelling light is a pure function of how far the field has crossed
       the viewport. Alive while the visitor scrolls, completely still when they
       stop.
     * the pointer light is a soft circle that follows the cursor. Nothing moves
       when the cursor does not.

   Under prefers-reduced-motion the module attaches NO listeners at all, runs no
   requestAnimationFrame, and renders exactly one static frame with the travelling
   light parked mid-pass so the field rests LIT rather than dark.

   COLOUR is mixed at runtime from the locked tokens via getComputedStyle. There
   is not one hardcoded colour in this file except the black and white of the mask
   channels, which are luminance values, not paint. The field cannot drift from
   dispenza-tokens.css, and if a token fails to parse the module renders nothing
   rather than inventing a colour.
   ============================================================================= */
(function () {
  'use strict';

  var INST = 0;

  /* ---- deterministic height source. Stable across reloads. ----
     Byte-identical to the hero's, on purpose: the two fields are the same
     material and a different hash would make them look like two ideas. */
  function hash(c, r) {
    var h = (c * 73856093) ^ (r * 19349663);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  }

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  /* ---- colour, derived from the locked tokens ----------------------------
     Returns null on anything it does not understand. Every caller treats null
     as "do not render": a field painted in a guessed colour is worse than no
     field, because it silently ships a value that is not in the token sheet. */
  function parseColor(v) {
    v = String(v == null ? '' : v).trim();
    if (!v) { return null; }
    if (v.charAt(0) === '#') {
      var s = v.slice(1);
      if (s.length === 3) { s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2]; }
      if (s.length !== 6 || /[^0-9a-f]/i.test(s)) { return null; }
      var n = parseInt(s, 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    var m = v.match(/^rgba?\(([^)]+)\)$/i);
    if (m) {
      var p = m[1].split(/[\s,/]+/).filter(function (x) { return x !== ''; }).map(parseFloat);
      if (p.length >= 3 && !isNaN(p[0]) && !isNaN(p[1]) && !isNaN(p[2])) {
        return [p[0], p[1], p[2]];
      }
    }
    return null;
  }
  function mix(a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  }
  function out(c) {
    return 'rgb(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ')';
  }
  function palette() {
    var css = getComputedStyle(document.documentElement);
    var surf  = parseColor(css.getPropertyValue('--ds-bg-surface'));
    var prim  = parseColor(css.getPropertyValue('--ds-primary'));
    var deep  = parseColor(css.getPropertyValue('--ds-accent-deep'));
    var light = parseColor(css.getPropertyValue('--ds-accent-light'));
    if (!surf || !prim || !deep || !light) { return null; }
    var black = [0, 0, 0];
    return {
      /* the top face sits a breath above the canvas -- enough to separate the
         prism from the ground, not enough to become a pattern behind type */
      top: out(mix(surf, prim, 0.085)),
      /* three wall tones, violet-tinted then driven toward black. This tonal
         spread IS the extrusion read: walls within two values of the canvas make
         the prisms look flat, which is how the hero's first build failed. */
      wall: [0.20, 0.46, 0.68].map(function (k) {
        return out(mix(mix(surf, deep, 0.28), black, k));
      }),
      edge: out(prim),
      lit:  out(light)
    };
  }

  /* =========================================================================
     GEOMETRY. Everything below is a pure function of (W, H, cfg) -- no DOM.
     ========================================================================= */

  /* Eye height. Fixed: only the RATIOS RW/EY and h/EY affect the picture, so one
     of the two is free and this is it. The focal length is NOT fixed -- see
     defaults(). */
  var EY = 250;

  /* THE TWO NUMBERS THAT ACTUALLY DESCRIBE THIS PICTURE.

     Neither is "focal length" or "horizon", because neither of those means
     anything until you know the box they are being used in. The two that survive
     a change of box are:

       STRETCH  the vertical:horizontal aspect of a NEAR hexagon. Algebraically
                it is exactly EY/Z, and at the bottom edge it works out to
                H*(1+osBot+horizon)/focal. Below ~1 the hexagons read wide and
                flat -- proper isometric honeycomb. Around 3 they read as tall
                cells on a plane tilting away. Past ~5 the near row degenerates
                into vertical corridors and stops looking like hexagons at all.

       RATIO    ZFar/ZNear, i.e. how much recession the plane shows. It equals
                (1+osBot+horizon)/(horizon-osTop), so it is the horizon fraction
                in disguise.

     The first build fixed the focal length at the hero's 780 and solved the
     horizon from a row budget. That is correct on a near-square box and wrong on
     a tall one, and the render proved it: at 1440 the region is 1440x1668 and the
     near row measured STRETCH 2.85, which looks right; at 390 the same region is
     390x2987 and the identical code measured STRETCH 6.19 -- the whole near half
     of the mobile field was vertical corridors, with nothing in it a person would
     call a hexagon.

     So both numbers are declared here and the focal length and horizon are solved
     BACKWARDS from them. That inverts which quantity is allowed to float: the row
     count now varies with the box (a 2987px-tall region genuinely needs more rows
     than a 1668px one) while the thing the eye actually judges is pinned.

     They are interpolated on the region's ASPECT rather than on its width,
     because aspect is what drives the degeneracy. A tall narrow region is given a
     flatter camera on purpose: at 390 you can only ever see 800px of a 2987px
     plane at once, so deep recession buys nothing and costs every hexagon its
     shape. */
  /* OWNER RETUNE: "BG looks warped ... do not squish", and "make it subtle ...
     they will serve as a break to plain black so BG doesn't have to be
     overpowering".

     Both notes point at the same two numbers. STRETCH was 2.90, which by this
     file's own scale is the "tall cells on a plane tilting away" reading -- the
     warp. It comes down to ~1.05, the "wide and flat, proper isometric
     honeycomb" end, so a near hexagon is hexagon-shaped instead of drawn out
     vertically. RATIO was 8.0, i.e. the far row was an eighth the scale of the
     near row; that steep recession is what made the plane read as a dramatic
     corridor rather than a ground. At 2.6 the plane still recedes, but as
     texture with depth rather than as the subject.

     Desktop and mobile are now nearly the same camera. The wide split existed
     only because a steep desktop camera degenerated on a tall narrow box; with
     the desktop camera already flat there is nothing to rescue mobile from, so
     the interpolation just holds the shape steady across both. */
  var ASPECT_LO = 1.2,  STRETCH_LO = 1.05, RATIO_LO = 2.6;   /* ~desktop  */
  var ASPECT_HI = 7.7,  STRETCH_HI = 1.00, RATIO_HI = 1.9;   /* ~390      */

  function defaults(W, H) {
    /* COLUMNS ACROSS THE NEAR ROW. Wide viewports can carry more, narrow ones
       need fewer or the prisms shrink into noise on a phone. */
    /* OWNER: "subtle ... a break to plain black". With the camera flattened, 5-7
       columns made each cell enormous, so the lattice read as a few big shapes
       competing with the cards rather than as a ground. More, smaller cells turn
       the same lattice into TEXTURE, which is what a break to plain black wants. */
    var cols = Math.round(clamp(9 + (W - 420) / (1200 - 420) * 3, 9, 12));

    var osTop = 0.10, osBot = 0.06;
    var t = clamp((H / Math.max(1, W) - ASPECT_LO) / (ASPECT_HI - ASPECT_LO), 0, 1);
    var stretch = STRETCH_LO + (STRETCH_HI - STRETCH_LO) * t;
    var ratio   = RATIO_LO   + (RATIO_HI   - RATIO_LO)   * t;

    /* invert  ratio = (1+osBot+horizon)/(horizon-osTop)  */
    var horizon = (1 + osBot + ratio * osTop) / (ratio - 1);
    /* invert  stretch = H*(1+osBot+horizon)/focal        */
    var focal   = H * (1 + osBot + horizon) / stretch;

    return {
      cols: cols,
      focal: focal,
      horizon: horizon,     /* horizon sits at y = -horizon*H, ABOVE the field  */
      stretch: stretch,     /* reported for verification; not read by build()   */
      ratio: ratio,         /* ditto                                            */
      osTop: osTop,         /* grid over-scan past the top edge, in H           */
      osBot: osBot,         /* ... past the bottom edge                         */
      osX: 0.06,            /* ... past the left/right edges, in W              */
      /* EXTRUSION, cut hard on the owner's "subtle" note. At hMax 1.50 a near
         prism stood one and a half cell-widths proud, so the side walls were the
         dominant shape and the field read as architecture. At 0.50 the walls are
         a chamfer that catches the light and little else -- the lattice reads as
         a surface, which is what "a break to plain black" asks for. */
      hMin: 0.08,           /* extrusion height range, in RW                    */
      hMax: 0.50,
      /* The resting hairline is the whole picture at rest, so this is the single
         most direct "overpowering" knob. Halved from 0.20. */
      edgeAlpha: 0.065,     /* resting hairline on the top faces                */
      litW: 1.00,           /* travelling light stroke width                    */
      hotW: 1.50,           /* pointer light stroke width                       */

      /* THE READING CLEARING. A soft elliptical hold-back over whatever the mount
         names as the block that must stay legible.

         It is here because it was MEASURED to be needed, not because it looked
         nice. With the field at full strength the case-studies head lands on
         backdrop pixels that take its gradient's dark stop (#8d3fe8) from 3.45:1
         down to 2.73:1 at 1440 -- under the 3.0 large-text floor. The lede went
         6.74 -> 5.03 and the standfirst 16.42 -> 11.70; those still pass, the head
         did not.

         It is expressed in FIELD coordinates and lives inside the shared render,
         so like every other mask here it is continuous across the joint. Anchored
         to the element the mount names rather than to a fraction of the region,
         because the region is 1440x1668 at desktop and 390x2987 at 390 and the
         reading block occupies 10-25% of the first and 5-17% of the second -- a
         fixed fraction would clear the wrong band at one of them.

         RE-TIGHTENED AFTER THE OWNER'S "do not squish / make it subtle" RETUNE,
         because that retune made this WORSE rather than better and the render
         proved it. Flattening the camera and going from 5-7 columns to 9-12 puts
         roughly twice as many lit cell EDGES through the head's box, so even
         though every edge is dimmer the head now lands on more of them: measured
         glyph-accurate, the turn fell to 2.46:1 at 1440 and 2.93:1 at 390, both
         under the floor it had been passing at 3.18/3.16. Dimming further would
         have cost the whole effect, so the CLEARING absorbs it instead -- floor
         0.30 -> 0.10 and a slightly wider ellipse. That keeps the field's
         character everywhere except the ~1 in 8 of the region where the reading
         actually happens. */
      clearMin: 0.05,       /* field strength across the floor of the clearing  */
      clearKX: 0.76,        /* ellipse rx = kx*boxW + pad                       */
      clearKY: 0.84,
      clearPad: 0.05        /* ... + pad*W, on BOTH axes: W not H, so a very tall
                               region does not inflate the clearing vertically   */
      /* No minimum-size cut on the glow layers. The hero needs one because its
         depth range is 11:1 and its far rows are 3px across, where a blurred
         stroke is pure cost. Here RATIO is 8 at the very widest and the smallest
         hexagon measured 17px, so a cut would remove nothing -- verified: the
         lit-layer count equalled the cell count at 1440/1024/768/390. Reinstate
         it if RATIO_LO is ever pushed past ~15. */
    };
  }

  function build(W, H, cfg, pal) {
    var F     = cfg.focal;
    var HZN   = -cfg.horizon * H;
    var osTop = cfg.osTop * H, osBot = cfg.osBot * H, osX = cfg.osX * W;

    /* depth of the ground plane at a given screen y */
    function zAt(y) { return EY * F / (y - HZN); }
    var ZN = zAt(H + osBot);        /* nearest: the over-scanned bottom edge */
    var ZF = zAt(-osTop);           /* farthest: the over-scanned top edge   */

    /* RW solved so the near row shows cfg.cols hexes across the field width */
    var RW = (W / cfg.cols) * ZN / (1.5 * F);
    var hs = 1.5 * RW, vs = Math.sqrt(3) * RW;

    function px(X, Z) { return W / 2 + X * F / Z; }
    function py(Z, up) { return HZN + (EY - up) * F / Z; }

    var cells = [], c, r, Zc, Xc, sx;
    /* the widest X the field can need is at the FAR plane, where F/Z is smallest */
    var cMax = Math.ceil(((W / 2 + osX) * ZF / F) / hs) + 2;
    for (c = -cMax; c <= cMax; c++) {
      for (r = 0; ; r++) {
        Zc = ZN + r * vs + ((c & 1) ? vs / 2 : 0);
        if (Zc > ZF) { break; }
        Xc = c * hs;
        sx = px(Xc, Zc);
        /* cull columns that project off-canvas: the field is drawn, not padded.
           The over-scan is applied here, so cells DO continue past the visible
           box -- which is what lets the edge mask fade them out instead of
           ending them. */
        if (sx < -osX - RW * F / Zc || sx > W + osX + RW * F / Zc) { continue; }
        cells.push({ Xc: Xc, Zc: Zc, h: RW * (cfg.hMin + hash(c, r) * (cfg.hMax - cfg.hMin)) });
      }
    }
    cells.sort(function (a, b) { return b.Zc - a.Zc; });   /* far first */

    /* TWO STRINGS, AND WHY THEY ARE SPLIT THE WAY THEY ARE.

       `bodies` keeps walls and top face INTERLEAVED, cell by cell, far to near.
       That interleaving IS the painter's algorithm: hoisting all the walls into
       one pass and all the tops into another would let a near cell's wall be
       painted under a far cell's top face and the occlusion would invert.

       `plates` is the bare top-face outline of every cell, with no paint on it at
       all. Both light layers are the SAME outlines in a different colour, so they
       are emitted once here and referenced twice with <use> rather than written
       out three times. On the widest measured case that is 1,096 fewer polygons
       and ~200KB less markup, and -- the reason that matters more than the bytes
       -- it makes it structurally impossible for the two lights to be drawn from
       different geometry than the field underneath them. */
    var bodies = '', plates = '', i, k, V, a, b, top, shade, A, Z, X, drawn = 0;
    for (i = 0; i < cells.length; i++) {
      Xc = cells[i].Xc; Zc = cells[i].Zc;
      V = [];
      for (k = 0; k < 6; k++) {
        A = Math.PI / 180 * (60 * k);
        X = Xc + RW * Math.cos(A);
        Z = Zc + RW * Math.sin(A);
        if (Z <= ZN * 0.2) { V = null; break; }   /* behind the camera: drop it */
        V.push({ X: X, Z: Z, x: px(X, Z), yb: py(Z, 0), yt: py(Z, cells[i].h) });
      }
      if (!V) { continue; }
      drawn++;

      top = '';
      for (k = 0; k < 6; k++) { top += V[k].x.toFixed(1) + ',' + V[k].yt.toFixed(1) + ' '; }

      for (k = 0; k < 6; k++) {
        a = V[k]; b = V[(k + 1) % 6];
        if ((a.Z + b.Z) / 2 >= Zc) { continue; }          /* back-face cull */
        shade = pal.wall[Math.min(2, Math.floor(Math.abs(a.X + b.X - 2 * Xc) / RW * 1.6))];
        bodies += '<polygon fill="' + shade + '" points="' +
          a.x.toFixed(1) + ',' + a.yt.toFixed(1) + ' ' +
          b.x.toFixed(1) + ',' + b.yt.toFixed(1) + ' ' +
          b.x.toFixed(1) + ',' + b.yb.toFixed(1) + ' ' +
          a.x.toFixed(1) + ',' + a.yb.toFixed(1) + '"/>';
      }
      /* Paint is written as ATTRIBUTES, not left to a stylesheet. The values
         still come from the tokens -- they are mixed above from getComputedStyle
         -- but keeping them on the element means the structural sheet carries no
         colour at all, and it keeps every rule this picture depends on OUTSIDE
         the <use> shadow trees below, where a document stylesheet is not
         guaranteed to reach. */
      bodies += '<polygon fill="' + pal.top + '" stroke="' + pal.edge +
        '" stroke-width="0.9" stroke-opacity="' + cfg.edgeAlpha + '" points="' + top + '"/>';
      plates += '<polygon points="' + top + '"/>';
    }
    return { bodies: bodies, plates: plates, cells: drawn, RW: RW, ZN: ZN, ZF: ZF,
             rows: Math.round((ZF - ZN) / vs) };
  }

  /* THE PLATE. One hidden <svg> holding every gradient, every mask, the geometry,
     and the whole assembled scene under a single id. Each window is then nothing
     but <svg viewBox="0 0 W H"><use href="#id-scene"/></svg>.

     This is the seam guarantee taken from "the same string in both places" to
     "the same NODES in both places". There is one sweep group and one pointer
     circle in the document, so the light in the footer is not a copy of the light
     in the case studies that has to be kept in step -- it is the same element.
     A future edit cannot introduce a per-window value because there is nowhere
     per-window left to put one.

     It also costs a third of the DOM: measured at 768 the direct-clone build was
     13,248 nodes and 1.8MB of markup across the two windows; this is one copy of
     ~5x cells plus one <use> per window.

     Nothing inside the plate is styled from the stylesheet. Paint, filter and
     opacity are all written as attributes or inline style, because a document
     stylesheet is not guaranteed to reach into a <use> shadow tree and a light
     that renders in one browser and not another is worse than no light. */
  function plate(id, W, H, cfg, geo, pal, reduce, ease, clear) {
    var pool = Math.round(clamp(Math.min(W, H) * 0.34, 170, 420));
    var bandH = H * 3;
    var glow = reduce ? '' : 'filter:url(#' + id + '-glow);';
    /* a 2px hard-zero band at each edge, as a percentage of the box. Clamped
       below the next stop so the offsets stay monotonic on a tiny field. */
    var vz = clamp(200 / H, 0, 1.5).toFixed(3);
    var hz = clamp(200 / W, 0, 1.0).toFixed(3);
    var vz2 = (100 - +vz).toFixed(3), hz2 = (100 - +hz).toFixed(3);
    /* the reading clearing, if the mount named a block to protect */
    var cg = '', copen = '', cclose = '';
    if (clear) {
      var g1 = Math.round(255 * cfg.clearMin);
      var g2 = Math.round(255 * (cfg.clearMin + (1 - cfg.clearMin) * 0.55));
      var hex = function (v) { v = ('0' + v.toString(16)).slice(-2); return '#' + v + v + v; };
      /* THE PLATEAU IS LOAD-BEARING. A radial that starts easing at offset 0 puts
         its minimum on a single point, and the block being protected is a BLOCK --
         the head sits about 0.44 of the way out along the minor axis, where a
         plain ease had already recovered to 65% and the head still measured
         2.97:1. Holding the floor flat to 45% covers the whole block instead of
         its centre pixel. */
      cg =
        '<radialGradient id="' + id + '-clearg">' +
          '<stop offset="0%" stop-color="' + hex(g1) + '"/>' +
          '<stop offset="45%" stop-color="' + hex(g1) + '"/>' +
          '<stop offset="75%" stop-color="' + hex(g2) + '"/>' +
          '<stop offset="100%" stop-color="#fff"/>' +
        '</radialGradient>' +
        '<mask id="' + id + '-cmask" maskUnits="userSpaceOnUse" x="0" y="0" width="' + W + '" height="' + H + '">' +
          '<rect width="' + W + '" height="' + H + '" fill="#fff"/>' +
          '<ellipse cx="' + clear.cx.toFixed(1) + '" cy="' + clear.cy.toFixed(1) +
            '" rx="' + clear.rx.toFixed(1) + '" ry="' + clear.ry.toFixed(1) +
            '" fill="url(#' + id + '-clearg)"/>' +
        '</mask>';
      copen = '<g mask="url(#' + id + '-cmask)">';
      cclose = '</g>';
    }
    return '' +
      '<defs>' +
        '<filter id="' + id + '-glow" x="-30%" y="-30%" width="160%" height="160%">' +
          '<feGaussianBlur stdDeviation="2.4" result="b"/>' +
          '<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>' +
        '</filter>' +
        /* THE EDGE MASK -- the uncropped guarantee. Two axes, nested rather than
           blended, so the result is a plain multiply that no compositing mode has
           to be trusted for. Both reach exactly 0 AT the edge, which is what makes
           a prism crossing the boundary invisible where it is cut. */
        /* THE HARD-ZERO BAND at each end is not belt-and-braces, it is a measured
           fix. A gradient that reaches 0 only AT offset 0 is sampled at the pixel
           CENTRE, half a pixel inside, so the outermost pixel row still carries a
           few percent of the field: measured 6/255 on the left edge at 390 and
           5/255 on the bottom edge at 1440. Small, but not the zero the uncropped
           claim wants to be able to state. Holding the mask at black for a full
           2px first makes the edge line exactly background. */
        '<linearGradient id="' + id + '-vfade" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0%" stop-color="#000"/>' +
          '<stop offset="' + vz + '%" stop-color="#000"/>' +
          '<stop offset="4%" stop-color="#595959"/>' +
          '<stop offset="16%" stop-color="#fff"/>' +
          '<stop offset="93%" stop-color="#fff"/>' +
          '<stop offset="98%" stop-color="#737373"/>' +
          '<stop offset="' + vz2 + '%" stop-color="#000"/>' +
          '<stop offset="100%" stop-color="#000"/>' +
        '</linearGradient>' +
        '<linearGradient id="' + id + '-hfade" x1="0" y1="0" x2="1" y2="0">' +
          '<stop offset="0%" stop-color="#000"/>' +
          '<stop offset="' + hz + '%" stop-color="#000"/>' +
          '<stop offset="2%" stop-color="#8c8c8c"/>' +
          '<stop offset="7%" stop-color="#fff"/>' +
          '<stop offset="93%" stop-color="#fff"/>' +
          '<stop offset="98%" stop-color="#8c8c8c"/>' +
          '<stop offset="' + hz2 + '%" stop-color="#000"/>' +
          '<stop offset="100%" stop-color="#000"/>' +
        '</linearGradient>' +
        '<mask id="' + id + '-vmask" maskUnits="userSpaceOnUse" x="0" y="0" width="' + W + '" height="' + H + '">' +
          '<rect width="' + W + '" height="' + H + '" fill="url(#' + id + '-vfade)"/></mask>' +
        '<mask id="' + id + '-hmask" maskUnits="userSpaceOnUse" x="0" y="0" width="' + W + '" height="' + H + '">' +
          '<rect width="' + W + '" height="' + H + '" fill="url(#' + id + '-hfade)"/></mask>' +
        /* THE TRAVELLING BAND. It leans, so it crosses the plane on the diagonal
           the hero's does, but it runs mostly along the DEPTH axis because that
           is the direction this plane recedes. Scroll translates it in Y; nothing
           here has a duration. */
        /* The peak is a GREY, not #fff, on the owner's "not overpowering" note.
           These stops are a luminance mask, so the value IS the light's alpha:
           #8c8c8c holds the sweep at ~55% of full. It is still clearly a light
           travelling the plane, it just stops being the brightest thing on the
           screen. (Not a palette colour -- no token applies to a mask channel.) */
        '<linearGradient id="' + id + '-band" x1="0" y1="0" x2="0.3" y2="1">' +
          '<stop offset="0%" stop-color="#000"/><stop offset="36%" stop-color="#000"/>' +
          '<stop offset="50%" stop-color="#8c8c8c"/>' +
          '<stop offset="64%" stop-color="#000"/><stop offset="100%" stop-color="#000"/>' +
        '</linearGradient>' +
        '<mask id="' + id + '-bandmask" maskUnits="userSpaceOnUse" x="0" y="0" width="' + W + '" height="' + H + '">' +
          '<g class="mc-hexfield__sweep">' +
            '<rect x="' + (-W) + '" y="' + (-H) + '" width="' + (W * 3) + '" height="' + bandH + '" ' +
            'fill="url(#' + id + '-band)"/>' +
          '</g></mask>' +
        /* the pointer pool: a soft-edged circle whose position is the ONLY thing
           that changes on pointermove. One attribute write per window per frame. */
        '<radialGradient id="' + id + '-pool">' +
          '<stop offset="0%" stop-color="#fff" stop-opacity="1"/>' +
          '<stop offset="55%" stop-color="#fff" stop-opacity=".55"/>' +
          '<stop offset="100%" stop-color="#fff" stop-opacity="0"/>' +
        '</radialGradient>' +
        '<mask id="' + id + '-poolmask" maskUnits="userSpaceOnUse" x="0" y="0" width="' + W + '" height="' + H + '">' +
          '<rect width="' + W + '" height="' + H + '" fill="#000"/>' +
          '<circle class="mc-hexfield__poolc" cx="-9999" cy="-9999" r="' + pool +
            '" fill="url(#' + id + '-pool)"/></mask>' +

        /* the bare top-face outlines, drawn by nobody, referenced by both lights */
        '<g id="' + id + '-plates" fill="none" stroke-linejoin="round">' + geo.plates + '</g>' +

        cg +

        '<g id="' + id + '-scene">' +
          copen +
          '<g mask="url(#' + id + '-vmask)"><g mask="url(#' + id + '-hmask)">' +
            '<g>' + geo.bodies + '</g>' +
            '<g mask="url(#' + id + '-bandmask)">' +
              '<g class="mc-hexfield__lit" style="' + glow + '" stroke="' + pal.lit +
                '" stroke-width="' + cfg.litW + '">' +
                '<use href="#' + id + '-plates"/></g>' +
            '</g>' +
            (reduce ? '' :
            '<g mask="url(#' + id + '-poolmask)">' +
              '<g class="mc-hexfield__hot" style="' + glow + 'opacity:0;transition:opacity ' + ease + '"' +
                ' stroke="' + pal.lit + '" stroke-width="' + cfg.hotW + '">' +
                '<use href="#' + id + '-plates"/></g>' +
            '</g>') +
          '</g></g>' +
          cclose +
        '</g>' +
      '</defs>';
  }
  function windowMarkup(id) { return '<use href="#' + id + '-scene"/>'; }

  /* =========================================================================
     THE MOUNT.
     ========================================================================= */

  function docRect(el) {
    var r = el.getBoundingClientRect();
    return { l: r.left + window.pageXOffset, t: r.top + window.pageYOffset, w: r.width, h: r.height };
  }

  function mount(hosts, userCfg) {
    hosts = [].slice.call(hosts || []).filter(Boolean);
    if (!hosts.length) { return null; }

    var pal = palette();
    if (!pal) { return null; }        /* fail closed: no tokens, no field */

    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    var id = 'hxf' + (++INST);
    var W = 0, H = 0, L = 0, T = 0, dx0 = 0, dy0 = 0, cfg = null, geo = null;
    var grounds = [], over = 0, plateSvg = null, sweep = null, poolc = null, hotG = null;
    var pending = 0, pxq = 0, pyq = 0, queued = false;

    /* the pointer light's fade, taken from the motion tokens rather than typed */
    var rootCss = getComputedStyle(document.documentElement);
    var dur  = (rootCss.getPropertyValue('--ds-dur') || '').trim();
    var ease = (rootCss.getPropertyValue('--ds-ease-out') || '').trim();
    var fade = (dur && ease) ? (dur + ' ' + ease) : (dur || '0s');

    function svgEl(tag) { return document.createElementNS('http://www.w3.org/2000/svg', tag); }

    /* -- A WINDOW THAT MIRRORS SOMETHING ELSE'S BOX -------------------------
       `data-hexfield-cover="<selector>"` makes a host size and place itself onto
       another element's box every time the field measures.

       WHY THIS EXISTS, and it is not a workaround -- it is the correct mount.
       The obvious way to get an aperture over the footer is to put a host inside
       <footer>. But everything outside <main> is the LOCKED CHROME BLOCK, carried
       by _design/_chrome-block.html and stamped into all 27 pages. A host added
       there would give a hex plane to every page in the site, including the 26
       that have no case-studies section and never asked for one -- and on those
       pages it would be a lone window, i.e. a field mounted for no reason. This
       plane is a HOME-PAGE treatment, so it belongs to the home page's markup.

       So the host lives inside <main>, where page-specific decoration belongs,
       and simply borrows the footer's geometry. The footer element itself is not
       touched, the chrome block is not touched, and nothing propagates.

       It is positioned against its offsetParent, which is whatever positioned
       ancestor it happens to have; that keeps it correct without requiring the
       page to add `position` to anything. right/bottom are cleared because the
       stylesheet's `inset:0` would otherwise over-constrain the box. */
    function syncCovers() {
      for (var i = 0; i < hosts.length; i++) {
        var sel = hosts[i].getAttribute('data-hexfield-cover');
        if (!sel) { continue; }
        var tgt = document.querySelector(sel);
        if (!tgt) { continue; }
        var op = hosts[i].offsetParent || document.body;
        var t = docRect(tgt), o = docRect(op);
        var s = hosts[i].style;
        s.position = 'absolute';
        s.right = 'auto'; s.bottom = 'auto';
        s.left   = (t.l - o.l) + 'px';
        s.top    = (t.t - o.t) + 'px';
        s.width  = t.w + 'px';
        s.height = t.h + 'px';
      }
    }

    /* -- one measure, one render, N windows onto it ------------------------ */
    function render() {
      var i, r, minL = Infinity, minT = Infinity, maxR = -Infinity, maxB = -Infinity;
      syncCovers();
      for (i = 0; i < hosts.length; i++) {
        r = docRect(hosts[i]);
        if (r.w <= 0 || r.h <= 0) { continue; }
        if (r.l < minL) { minL = r.l; }
        if (r.t < minT) { minT = r.t; }
        if (r.l + r.w > maxR) { maxR = r.l + r.w; }
        if (r.t + r.h > maxB) { maxB = r.t + r.h; }
      }
      if (!isFinite(minL) || maxR - minL < 8 || maxB - minT < 8) { return false; }

      L = minL; T = minT;
      W = Math.round(maxR - minL);
      H = Math.round(maxB - minT);
      /* THE FIELD ORIGIN IS REMEMBERED RELATIVE TO A HOST, not as a document
         coordinate, because a document coordinate goes stale silently. Anything
         above the case studies that changes height -- the benchmarks accordion is
         one click away from doing exactly that -- moves the whole region down
         without changing its SIZE, so no ResizeObserver fires and no rebuild is
         needed; but a cached document Y would then be wrong, and both lights are
         computed from it. The pointer pool would sit off-target by the shift.
         Storing the offset from hosts[0] and reading that host's live rect at use
         time makes both lights immune to it, for one getBoundingClientRect --
         the same trade hero-field.js makes in its own place(). */
      var h0 = docRect(hosts[0]);
      dx0 = L - h0.l; dy0 = T - h0.t;

      cfg = defaults(W, H);
      if (userCfg) { for (var k in userCfg) { if (userCfg.hasOwnProperty(k)) { cfg[k] = userCfg[k]; } } }

      geo = build(W, H, cfg, pal);

      for (i = 0; i < hosts.length; i++) {
        hosts[i].textContent = '';
        hosts[i].setAttribute('aria-hidden', 'true');
      }

      /* THE PLATE lives inside the first host, which is already aria-hidden and
         already click-through, so it needs no arrangements of its own. It is
         sized 0x0 and holds nothing but <defs>, so it paints nothing itself. */
      plateSvg = svgEl('svg');
      plateSvg.setAttribute('class', 'mc-hexfield__plate');
      plateSvg.setAttribute('width', '0');
      plateSvg.setAttribute('height', '0');
      plateSvg.setAttribute('aria-hidden', 'true');
      plateSvg.setAttribute('focusable', 'false');
      /* the block the mount asked to keep legible, measured into field space */
      var clear = null;
      if (cfg.clearSel) {
        var nodes = document.querySelectorAll(cfg.clearSel);
        var bl = Infinity, bt = Infinity, br = -Infinity, bb = -Infinity;
        for (i = 0; i < nodes.length; i++) {
          var b2 = docRect(nodes[i]);
          if (b2.w <= 0 || b2.h <= 0) { continue; }
          if (b2.l < bl) { bl = b2.l; }
          if (b2.t < bt) { bt = b2.t; }
          if (b2.l + b2.w > br) { br = b2.l + b2.w; }
          if (b2.t + b2.h > bb) { bb = b2.t + b2.h; }
        }
        if (isFinite(bl)) {
          var pad = cfg.clearPad * W;
          clear = {
            cx: (bl + br) / 2 - L,
            cy: (bt + bb) / 2 - T,
            rx: cfg.clearKX * (br - bl) + pad,
            ry: cfg.clearKY * (bb - bt) + pad
          };
        }
      }

      plateSvg.innerHTML = plate(id, W, H, cfg, geo, pal, reduce.matches, fade, clear);
      hosts[0].appendChild(plateSvg);

      sweep = plateSvg.querySelector('.mc-hexfield__sweep');
      poolc = plateSvg.querySelector('.mc-hexfield__poolc');
      hotG  = plateSvg.querySelector('.mc-hexfield__hot');

      for (i = 0; i < hosts.length; i++) {
        var hr = docRect(hosts[i]);
        var svg = svgEl('svg');
        svg.setAttribute('class', 'mc-hexfield__svg');
        svg.setAttribute('focusable', 'false');
        svg.setAttribute('aria-hidden', 'true');
        /* 1:1. The viewBox is the field's exact pixel box, so there is no scale
           step in which a prism can be cut and no conversion on the pointer.
           preserveAspectRatio is irrelevant at 1:1 and is set to none so that a
           sub-pixel rounding difference can never introduce one. */
        svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
        svg.setAttribute('preserveAspectRatio', 'none');
        /* UNROUNDED, DELIBERATELY. These offsets are the ONLY per-window value in
           the whole arrangement, so they are the only mechanism by which the two
           apertures could ever disagree about where the plane is -- i.e. the only
           way a seam could open. Rounding them to 2dp put the two windows' plane
           origins 0.0157px apart at 768 and 390 (they agreed exactly at 1440 and
           1024, which is why this hid at the widths one checks first). Harmless to
           look at, but it is the residual behind the last differing pixels at the
           390 joint, and "no per-window value exists" should be true rather than
           nearly true. The browser keeps the full float; let it. */
        svg.style.left   = (L - hr.l) + 'px';
        svg.style.top    = (T - hr.t) + 'px';
        svg.style.width  = W + 'px';
        svg.style.height = H + 'px';
        svg.innerHTML = windowMarkup(id);
        hosts[i].appendChild(svg);
      }
      place();
      return true;
    }

    /* the field's origin in VIEWPORT coordinates, read live */
    function origin() {
      var r = hosts[0].getBoundingClientRect();
      return { x: r.left + dx0, y: r.top + dy0 };
    }

    /* -- the drive. Scroll position only. No timer, no loop. --------------- */
    function progress() {
      if (reduce.matches) { return 0.5; }
      var top = origin().y;                             /* field top, viewport  */
      var p = 1 - (top + H) / (window.innerHeight + H); /* 0..1 across the pass */
      return clamp(p, 0, 1);
    }
    function place() {
      /* The band rect is 3H tall and its bright centre sits at (ty + 0.5H). It is
         mapped so the centre travels from just below the field to just above it
         across the pass, and so that p=0.5 -- the reduced-motion rest value --
         parks it in the middle of the plane rather than off-canvas. */
      if (!sweep) { return; }
      var ty = H * (0.70 - progress() * 1.40);
      sweep.setAttribute('transform', 'translate(0 ' + ty.toFixed(0) + ')');
    }

    /* -- the pointer light. Written ONCE, in FIELD coordinates. Both windows
          reference the same mask, so the pool crosses the joint unbroken and
          there is no second value to keep in step. --------------------------- */
    function paintPointer() {
      queued = false;
      if (!poolc) { return; }
      var o = origin();
      poolc.setAttribute('cx', (pxq - o.x).toFixed(0));
      poolc.setAttribute('cy', (pyq - o.y).toFixed(0));
    }
    function onMove(e) {
      pxq = e.clientX; pyq = e.clientY;
      if (!queued) { queued = true; requestAnimationFrame(paintPointer); }
    }
    function onEnter() {
      over++;
      if (hotG) { hotG.style.opacity = '1'; }
    }
    function onLeave() {
      over = Math.max(0, over - 1);
      if (over) { return; }
      if (hotG) { hotG.style.opacity = '0'; }
    }

    /* A REBUILD IS ONLY WARRANTED BY A SIZE CHANGE.
       ResizeObserver fires once the moment it starts observing, and `resize` fires
       on things that do not change the field at all, so an unguarded relayout
       throws away a 42ms geometry pass for nothing. The union is cheap to measure;
       the build is not. If only the POSITION moved, there is nothing to do at all:
       every window is offset from the field origin, so the hosts move together and
       the plane stays continuous, and both lights read that origin live. */
    function relayout() {
      if (pending) { clearTimeout(pending); }
      pending = setTimeout(function () {
        pending = 0;
        /* Covers first: a mirroring host still carries the PREVIOUS box until it
           is re-synced, so measuring before this would compare the new layout
           against a stale window and the size-unchanged guard below would skip
           the rebuild the resize actually needed. Re-writing identical pixel
           strings is a no-op, so this cannot feed the ResizeObserver back into
           itself. */
        syncCovers();
        var i, r, minL = Infinity, minT = Infinity, maxR = -Infinity, maxB = -Infinity;
        for (i = 0; i < hosts.length; i++) {
          r = docRect(hosts[i]);
          if (r.w <= 0 || r.h <= 0) { continue; }
          if (r.l < minL) { minL = r.l; }
          if (r.t < minT) { minT = r.t; }
          if (r.l + r.w > maxR) { maxR = r.l + r.w; }
          if (r.t + r.h > maxB) { maxB = r.t + r.h; }
        }
        if (isFinite(minL) && Math.round(maxR - minL) === W && Math.round(maxB - minT) === H) {
          place();
          return;
        }
        render();
      }, 120);
    }

    if (!render()) { return null; }

    /* REDUCED MOTION: one static frame and nothing else. No scroll listener, no
       pointer listener, no resize observer, no requestAnimationFrame. The field
       keeps every hexagon and the travelling light rests mid-pass, so the picture
       is complete -- it simply does not move. */
    if (!reduce.matches) {
      window.addEventListener('scroll', place, { passive: true });
      window.addEventListener('resize', relayout);
      for (var i = 0; i < hosts.length; i++) {
        var g = hosts[i].parentElement;
        if (g && grounds.indexOf(g) < 0) {
          grounds.push(g);
          g.addEventListener('pointermove', onMove, { passive: true });
          g.addEventListener('pointerenter', onEnter);
          g.addEventListener('pointerleave', onLeave);
        }
      }
      /* a host whose own box changes (text reflow, a panel opening above it)
         changes the field's size, which is the only thing that needs a rebuild.
         A host that merely MOVES does not: every window is offset from the field
         origin, so they all move together and the plane stays continuous. */
      if (window.ResizeObserver) {
        var ro = new ResizeObserver(relayout);
        for (var j = 0; j < hosts.length; j++) { ro.observe(hosts[j]); }
      }
    }

    return {
      id: id,
      hosts: hosts,
      refresh: render,
      /* live, not the value cached at build time: the region can move down the
         document without changing size, and a stale answer here would send any
         caller (including a verification harness) to the wrong pixels */
      field: function () {
        var o = origin();
        return { l: o.x + window.pageXOffset, t: o.y + window.pageYOffset, w: W, h: H };
      },
      config: function () { return cfg; }
    };
  }

  /* -- declarative boot ---------------------------------------------------
     Every element carrying data-hexfield="<group>" becomes a window onto the
     field for that group. The union of a group's boxes is the plane. */
  function boot() {
    var nodes = document.querySelectorAll('[data-hexfield]');
    var groups = {}, order = [], i, k;
    for (i = 0; i < nodes.length; i++) {
      k = nodes[i].getAttribute('data-hexfield') || 'default';
      if (!groups[k]) { groups[k] = []; order.push(k); }
      groups[k].push(nodes[i]);
    }
    for (i = 0; i < order.length; i++) {
      var g = groups[order[i]];
      var opt = {}, n;
      for (n = 0; n < g.length; n++) {
        var a = g[n].getAttribute('data-hex-cols');
        var c = g[n].getAttribute('data-hex-alpha');
        var s = g[n].getAttribute('data-hex-clear');
        if (a && !isNaN(+a)) { opt.cols = +a; }
        if (c && !isNaN(+c)) { opt.edgeAlpha = +c; }
        if (s) { opt.clearSel = s; }
      }
      var inst = mount(g, opt);
      if (inst) { window.HexField.instances.push(inst); }
    }
  }

  window.HexField = { mount: mount, instances: [] };

  /* Measured after LOAD, not after parse: the field's height is the sum of two
     real page regions, and those are not final until webfonts and the footer
     imagery have settled. Under reduced motion this one-shot bootstrap is the
     only listener the module ever attaches. */
  if (document.readyState === 'complete') { boot(); }
  else { window.addEventListener('load', boot, { once: true }); }
}());

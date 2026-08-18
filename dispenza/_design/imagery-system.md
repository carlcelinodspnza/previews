# Imagery system - dispenza

**What this is:** the single reviewable spec that governs every image on the Dispenza build. It is a
RECORD of what is actually on disk, not a wish list. Every row in §3 was measured from the real file
with Pillow on 2026-08-17; where a fact could not be verified it is marked UNKNOWN or recorded as an
attestation rather than as a finding.

Derived from C7 (`_handoff/visual-direction.md` §5) and the locked BRAND-SIGNATURE
(`surface_dominance: balanced`, `dark_ratio: 0.42`). Required on disk by G-IMG-SPEC
(`verify-imagery-spec-present.mjs`).

**Scope of this revision.** This revision covers `pages/case-studies.content.html` only, the first page
fragment authored in this build. It references **15 `<img>` elements drawing on 11 distinct files**: 10
first-party client assets under `assets/in-pages/`, plus **one generated asset**,
`assets/generated/results-map.webp`, reused from the homepage concept's equivalent band. See §2.4 for
the defect that asset carries. Every other page appends its own rows to §3 as it is built; the homepage
in particular will add the rest of the `assets/generated/` set, which this revision does not attempt to
document because those slots are not yet composed.

---

## §1 POSTURE: REAL-FIRST, with generation fenced to genuine gaps

Three ledger decisions stack to govern imagery on this build:

- **D7 proof strategy `real-only` + owner attestation.** Overrides the skill's documented
  `fabricated-fallback` default. Dispenza is a real operating agency, so results, clients and people are
  carried by real assets plus owner attestation. Unsubstantiable items became P7 blockers rather than
  being invented.
- **D21 IMAGERY: generate only the genuine gaps.** Generated imagery is editorial and atmospheric only.
  It must never read as a real client, a real result, or a real person.
- **D25 IMAGERY generated: 12 atmospheric images.** All 176 real first-party assets are used as-is; the
  12 generated files live in `assets/generated/` and are 8 service-page editorials, 3 full-bleed bands
  and 1 hero placeholder. **No person was generated** (the one person-shaped generation D21 had allowed
  was reconsidered and dropped).

**What that means for this page specifically:** a results page is the page where a generated image is
most dangerous, because most frames on it are evidence attached to a named client and a stated number.
**All 10 CLIENT-EVIDENCE frames here are the client's own existing assets, and no generated image may
ever stand in for one.** The single generated file on the page, `results-map.webp`, is not evidence for
any named client: it is the coverage plate, and it is reused verbatim (same file, same alt) from the
role it already occupies in the locked homepage concept's `#results` band. It carries a defect, recorded
in §2.4.

---

## §2 TREATMENT: the look every image obeys

This treatment is DESCRIPTIVE for the source material and PRESCRIPTIVE for the frame around it. The
underlying artwork is what the client already had; the build's job is to seat it honestly on a dark page
rather than to pretend it is studio work.

### 2.1 The three image classes on this page, and they are not the same material

⚠ **CORRECTED 2026-08-17 after visual inspection.** The first draft of this table described the portfolio
class as "rendered mockups of dispensary websites and menus ... not photographs of premises or people",
which was inferred from the FILENAMES (`*-marketing-portfolio-*`, `*-menu-mobile-view`) and is WRONG.
Opening the rendered page shows them to be real photographs of real dispensary interiors, and **people
are in frame in four of the five.** The corrected row is below and the consequence is §2.2's last bullet.

| class | what it actually is | count |
|---|---|---|
| **PREMISES PHOTOGRAPH** | Opaque RGB WebP photographs of real dispensary interiors: sales floors, counters, product shelving, neon signage, and in one case a hand holding a phone showing a client's live menu. Mixed ambient retail lighting, no colour grade, no visible retouch. Native widths 589 to 680px, so they are modest assets and are framed accordingly. **Four of the five contain people** (customers and staff), see §2.2. | 5 |
| **CLIENT MARK** | RGBA WebP brand logos with a live alpha channel and no baked ground. Wildly inconsistent as a set: aspect ratios run 1:1 to 2.17:1 and ink polarity runs from near-black to near-white. §2.3 is entirely about that inconsistency. | 5 distinct files, 9 placements |
| **COVERAGE PLATE** | One generated RGBA WebP: a North America map, transparent ground, pale grey landmass, operating states filled in brand violet, with illustrative stat callout cards composited on top. Not a photograph and not client evidence. **Carries baked text, see §2.4.** | 1 |

### 2.2 The rules that hold across all three classes

- **The dark canvas carries the evidence; the ONE light band carries only the coverage plate.** All 14
  client frames sit on dark grounds. The single image on the white financial band is
  `results-map.webp`, whose ground is transparent and whose meaning is carried by violet state fills
  measuring 13.24:1 on white. No client mark and no photograph is ever seated on white, which is why the
  polarity problem in §2.3 is solved per-mark rather than per-section.
- **Every frame declares intrinsic `width`/`height`.** VERIFIED 2026-08-17 in the rendered page, not
  from the manifest: all 15 attribute pairs in `case-studies.content.html` match the on-disk intrinsic
  pixel dimensions exactly (`naturalWidth`/`naturalHeight` compared against the attributes for every
  frame, 0 mismatches). No layout shift and no lying attribute.
- **Every frame is local.** No remote URL, no hotlink, no CDN.
- **Premises photographs are cropped, never letterboxed.** The three aspect ratios present (1.36, 1.49, 1.25)
  are normalised to a single 4:3 frame with `object-fit: cover`, so a row of cards never shows mixed
  frame heights or pillarboxing. Cropping a work sample is acceptable; distorting one is not, so
  `object-fit: fill` is banned.
- **Marks are contained, never cropped.** `object-fit: contain` inside a fixed-height plate, so no
  logo is ever clipped. A clipped client logo is a rights and respect problem, not just a visual one.
- **This build adds text to no image.** Words visible inside a portfolio shot are part of the website
  being shown, which is the point of the sample. **One asset arrives with text already baked in and it
  is a flagged exception, not a licence: `results-map.webp`. See §2.4.**
- **`alt` policy is split by class and is deliberate.** Portfolio shots take `alt=""`: they are
  decorative work samples, the source ships them with empty alt, and the card's meaning is carried by
  its mark and its figures. Marks take the client's name as their alt, which makes the mark the card's
  accessible identity. This is why a mark may never be replaced by a CSS background.
- **⚠ PEOPLE ARE IN FRAME, AND NO RELEASE IS ON RECORD.** Four of the five premises photographs show
  people: two masked customers at a counter, a sales floor with several customers, a retail floor with a
  staff member and customers, and a figure in a neon-lit interior. One shows only a hand holding a phone.
  Faces are partly obscured (masks, angles, motion) but at least some individuals are plausibly
  identifiable. **The handoff records no model release, no consent note and no photographer credit for
  any of them.** These are the client's own images, already published on the client's own live
  `case-studies` page, so this build is not the first publisher and D7's owner-attestation posture
  covers the assets in general. That is NOT the same as a release. **OWNER ITEM: confirm consent for
  identifiable customers, or swap the four frames for people-free alternatives.** Recorded here rather
  than resolved, because it is not a build decision.

### 2.3 MARK POLARITY IS MEASURED PER FILE. This is the governing rule of this page.

The five client marks are a **split set**, so no single plate ground can carry all of them. Dominant
opaque ink was sampled per file and its contrast computed against the candidate grounds:

| mark | dominant ink | px at that ink | on white | on `#15161a` | plate |
|---|---|---|---|---|---|
| `NuLeaf.webp` | rgb(84,84,84) | 728 | **7.57:1** | 2.39:1 | LIGHT |
| `Norcal.webp` | rgb(12,12,12) | 2561 | **19.56:1** | 1.08:1 | LIGHT |
| `TCG.webp` | rgb(252,252,252) | 8758 | 1.03:1 | **17.62:1** | DARK |
| `dispenza-flwrco-logo.webp` | rgb(36,36,36) | 80318 | **15.52:1** | 1.16:1 | LIGHT |
| `Firehouse.webp` | rgb(252,252,252) | 5209 | 1.03:1 | **17.62:1** | DARK |

**The rule:** every plate keeps the SAME size, radius and padding; only its ground flips, per mark, to
whichever polarity that artwork actually needs. Two marks are near-black and two are near-white, so a
uniform plate is not a style choice that was passed over, it is **arithmetically impossible**. Left on
the card ground, `Norcal.webp` would have rendered at 1.08:1 and `dispenza-flwrco-logo.webp` at 1.16:1,
which is invisible.

**⚠ FLAG for the owner, not a defect of this page.** The homepage concept seats Norcal and TCG using
*different* files (`norcal-logo-star-dispenza-client.webp`,
`the-cannabis-guys-logo-dispenza-dispensary-marketing-logo.webp`) which are alternate crops of the same
artwork. `norcal-logo-star-dispenza-client.webp` measures the same 88.3 mean luminance as `Norcal.webp`,
so **the homepage seats a near-black Norcal mark directly on a dark card**. That is very likely a live
legibility defect on the homepage concept and it is raised here rather than silently mirrored. A white
Norcal variant does not exist in the asset tree; `white-nuleaf-logo-dispensary-cient.webp` exists for
NuLeaf only.

### 2.4 ⚠ DEFECT ON `results-map.webp`: baked-in text. Raised, not silently reused.

Found by direct visual inspection of the rendered band on 2026-08-17, not by reading the manifest.

**The asset has stat callout cards composited onto the map, with live text baked into the pixels:**
`480% Direction Request Increase`, `110% Sales Increase` (twice), and a `110%` ring label.

Why that is a defect, on three counts:

1. **It is the exact anti-pattern C7 names.** `visual-direction.md` §5 lists "text baked into images (the
   current comparison widgets do this, which is part of why they fail)" among the anti-patterns this
   rebuild exists to remove. The build is reproducing it.
2. **The baked words are unreachable.** They cannot be read by a screen reader, cannot be translated,
   cannot be restyled, and go blurry on a 2x display. `110% Sales Increase` is a real corpus atom (TCG's
   second figure, owned by the homepage brief) and `480% Direction Request Increase` is a real atom that
   this very page renders as live text in the folded band. So the image duplicates live copy in a form
   nothing can index.
3. **The numbers read as claims but are decorative.** Nothing ties the callouts to the states under them.

**What was NOT done, deliberately.** The alt text was left exactly as the homepage concept wrote it
(`Map of North America with the states and provinces Dispenza operates in highlighted.`) rather than
extended to narrate the callouts. Reciting baked figures into the accessibility layer would harden
decorative numbers into spoken claims, which is worse than leaving them undescribed. The alt describes
the image's actual informational job, which is coverage.

**Why the asset was used at all.** It is not new here: the identical file, in the identical role, with
this identical alt string, already ships in the locked homepage concept's `#results` band beside these
same eight city figures, and that preview is owner-approved. Substituting a different image on this page
would have diverged from an approved decision on my own authority; dropping it would have left the one
band where a picture genuinely earns its place with nothing.

**OWNER ITEM:** regenerate `results-map.webp` with no baked text (map plus violet state fills only) and,
if the callouts are wanted, rebuild them as real DOM using the atoms the page already owns. **This is a
shared defect: fixing the file fixes the homepage too.**

### 2.5 Rights: right to DISPLAY confirmed, right to NAME is the open item

- The right to **display** the client marks was confirmed 2026-08-12.
- The homepage concept's markup carries an explicit caution that the per-client **NAME** claims were
  *not* confirmed at that date, and instructs that names not be added there without an owner sign-off.
- **This page names all five clients, and that is sourced rather than assumed:** every brand name
  rendered here is a verbatim string extracted from the client's own live `case-studies` page, where the
  client already publishes these names publicly, and the five tier-3 case-study pages are named client
  pages in the locked sitemap (`/case-studies/nuleafnv`, `/norcal`, `/tcg`, `/flwrco`, `/firehouse`).
- **Still open, and it belongs to the owner:** shopping-list item 2, "25 client marks - confirm each
  name and right-to-display", is not closed. The five marks on this page are the subset the client
  already publishes on this exact page, which is the strongest available position short of a signed
  confirmation, but it is not the same thing as one.
- ORIGINAL authorship of the premises photographs and the marks (client, brand rep, or a prior agency) is
  **UNKNOWN** and is recorded nowhere in the handoff.

---

## §3 THE LOCKED SET: every image on this page, measured

All 15 placements in DOM order, 11 distinct files. Dimensions are Pillow-measured from disk on
2026-08-17 and re-confirmed against the rendered page's `naturalWidth`/`naturalHeight`. Paths are
relative to `Code/client-site-build/dispenza/`, referenced from `pages/` as `../assets/<...>/<file>`.

| # | file | real px | format | alpha | size | section | placement | frame |
|---|---|---|---|---|---|---|---|---|
| 0 | `assets/generated/results-map.webp` | 940x628 | WebP RGBA | yes | 90 KB | financial-case-studies | coverage plate beside the head. GENERATED. **Baked text, §2.4** | `.rs-fin__map` capped 460px |
| 1 | `assets/in-pages/dispensary-marketing-portfolio-by-dispenza.webp` | 589x433 | WebP RGB | no | 33 KB | customer-journeys | card 01 shot (NuLeaf NV). **People in frame** | `.rs-jrn__shot` 4:3 cover |
| 2 | `assets/in-pages/NuLeaf.webp` | 200x200 | WebP RGBA | yes | 2 KB | customer-journeys | card 01 mark | `.rs-plate--light` contain |
| 3 | `assets/in-pages/marketing-portfolio-cannabis-menu-mobile-view.webp` | 589x433 | WebP RGB | no | 12 KB | customer-journeys | card 02 shot (NorCal). Hand holding a phone | `.rs-jrn__shot` 4:3 cover |
| 4 | `assets/in-pages/Norcal.webp` | 174x172 | WebP RGBA | yes | 8 KB | customer-journeys | card 02 mark | `.rs-plate--light` contain |
| 5 | `assets/in-pages/dispenary-marketing-portfolio-by-dispenza2.webp` | 589x433 | WebP RGB | no | 29 KB | customer-journeys | card 03 shot (The Cannabis Guys). **People in frame** | `.rs-jrn__shot` 4:3 cover |
| 6 | `assets/in-pages/TCG.webp` | 219x190 | WebP RGBA | yes | 5 KB | customer-journeys | card 03 mark | `.rs-plate--dark` contain |
| 7 | `assets/in-pages/dispenza-portfolio-flwr-co.webp` | 680x457 | WebP RGB | no | 36 KB | customer-journeys | card 04 shot (Flower Co). **People in frame** | `.rs-jrn__shot` 4:3 cover |
| 8 | `assets/in-pages/dispenza-flwrco-logo.webp` | 1300x600 | WebP RGBA | yes | 43 KB | customer-journeys | card 04 mark | `.rs-plate--light` contain |
| 9 | `assets/in-pages/dispenza-portfolio-firehouse-dispensary.webp` | 638x510 | WebP RGB | no | 48 KB | customer-journeys | card 05 shot, closing feature (Firehouse 360). **Person in frame** | `.rs-jrn__shot` cover, feature ratio |
| 10 | `assets/in-pages/Firehouse.webp` | 200x200 | WebP RGBA | yes | 9 KB | customer-journeys | card 05 mark | `.rs-plate--dark` contain |
| 11 | `assets/in-pages/NuLeaf.webp` | 200x200 | WebP RGBA | yes | 2 KB | customer-journeys, folded band | band mark 1 | `.rs-plate--light .rs-plate--sm` |
| 12 | `assets/in-pages/Norcal.webp` | 174x172 | WebP RGBA | yes | 8 KB | customer-journeys, folded band | band mark 2 | `.rs-plate--light .rs-plate--sm` |
| 13 | `assets/in-pages/TCG.webp` | 219x190 | WebP RGBA | yes | 5 KB | customer-journeys, folded band | band mark 3 | `.rs-plate--dark .rs-plate--sm` |
| 14 | `assets/in-pages/Firehouse.webp` | 200x200 | WebP RGBA | yes | 9 KB | customer-journeys, folded band | band mark 4 | `.rs-plate--dark .rs-plate--sm` |

**Total page image weight: 324 KB across 11 distinct files** (234 KB of client assets plus the 90 KB coverage plate). Four files are fetched once and placed
twice (the four marks that appear in both the cards and the folded band), so the transferred weight is
the distinct-file total, not the sum of placements.

**Deliberately NOT on this page:**

- `#financial-case-studies` ships **no photograph and no client mark.** Its only frame is the coverage
  plate. Eight violet tiles are the band's argument; a photograph behind or between them would compete
  with the numerals for the same attention.
- The hero/page-head ships **no photograph.** The source page-head is two strings, so a photographic
  frame there would have to be invented. What it does carry is a decorative inline-SVG lattice, which is
  the concept's own 44px `--ds-grid` motif redrawn so it can be radially masked; it holds no information
  and is `aria-hidden`.
- `#closing-ask` and `#partner-links` ship **no imagery**, deliberately. Both are thin navigational or
  administrative bands and an image in either would be filler.

### 3.1 Resolution ceiling: an accepted limitation, recorded

The five portfolio shots are 589 to 680px wide natively. In the 2x2 they are asked for roughly 250 to
340 CSS px, which is comfortable; in the full-measure closing feature the Firehouse shot at 638px native
is asked for roughly 480 CSS px, which is adequate at 1x and **soft on a 2x display**. No larger
original exists in the asset tree. This is recorded as a known ceiling, not fixed by upscaling, because
an upscaled work sample looks worse than a soft one. **Owner item: supply higher-resolution portfolio
exports if the feature card is to hold a retina display.**

---

## §4 FAL-EXTEND ALLOWANCE: what may be added, and what may never be

**On this page: NO EVIDENCE FRAME may be generated. Ever.** Every card frame here attaches to a named
client and a measured number, so a generated image in a card would read as fabricated evidence. This is
the hard case D21 and D25 were written for.

The one generated file present, `results-map.webp`, is the boundary case that proves the rule rather than
breaking it: it is a coverage plate in a band with no client card, it was inherited from an approved
homepage placement rather than commissioned here, and it is nonetheless carrying a defect (§2.4). **It is
the ceiling of what generation may do on this page, not a precedent to build on.**

If the imagery on this page is to be extended, the only permitted routes are:

1. **A real first-party asset** already in `assets/in-pages/` or newly supplied by the client, seated in
   an existing frame with its polarity measured per §2.3.
2. **A higher-resolution export of an existing premises photograph**, per §3.1.
3. **A white or light-ink variant of `Norcal.webp`**, which would let that mark move to the dark plate
   and make the plate set uniform. This is an asset request, not a generation prompt.

Generation stays available for the atmospheric slots elsewhere in the build, under D21's standing rule:
editorial and atmospheric only, every prompt explicitly excluding text, letters, logos, watermarks,
people and identifiable places, and never in a slot where the image could be read as a client, a result
or a person.

---

## §5 What a reviewer should check first

1. Do the five marks all read? Look specifically at Norcal and Flower Co, the two near-black marks that
   depend on the light plate. If either looks washed or invisible, the plate modifier was dropped.
   (Verified reading correctly in the 2026-08-17 render at 1440.)
2. **The two OWNER ITEMS, which are the reason this revision exists.** (a) `results-map.webp` has stat
   text baked into the pixels, reproducing the exact anti-pattern C7 bans, and the fix is shared with the
   homepage: §2.4. (b) Four premises photographs show plausibly identifiable customers and staff with no
   release, consent note or photographer credit anywhere in the handoff: §2.2.
3. Is the Firehouse feature shot acceptably sharp at your display density? See §3.1. It is the one frame
   asked to fill roughly 480 CSS px from a 638px original.
4. Is the homepage's Norcal mark legible? §2.3 predicts it is NOT, from measurement rather than
   inspection, and that flag is open. Note the homepage solves the same problem a different way, with
   `filter:brightness(1.9)` on the mark rather than a light plate; this page does not alter artwork.
5. Has anyone added a generated image to a CLIENT CARD? Per §4 the answer must stay no.

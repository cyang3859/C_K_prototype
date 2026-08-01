import { hash01 } from './facadeAtlas.js';

/**
 * massing.js — the five massing recipes (design spec §5), as pure functions.
 *
 * `DEN-1`'s diagnosis is not a mood, it is a literally true statement about the
 * Phase 1 code: every building is ONE `BoxGeometry`, full stop. These recipes are
 * the fix — 2 to 4 stacked boxes per building (podium, setback, cap), applied via
 * data rather than hand-placed per building.
 *
 * MASSING COSTS TRIANGLES, NOT DRAW CALLS. Every box a recipe emits is one more
 * geometry inside its family's `BatchedMesh`, so adding a recipe never changes
 * the family count and therefore never changes the draw-call count. A plain
 * `BoxGeometry` is 12 triangles (6 faces × 2), so the recipes cost 24, 48, 24 and
 * 36 triangles respectively — against a ~500,000-triangle whole-scene ceiling
 * (`BUD-7`). Triangles were never the binding constraint; draw calls were.
 *
 * COORDINATES. Every recipe returns boxes in BUILDING-LOCAL space: the footprint
 * centre is (0, 0) in X/Z, the ground is y = 0, and `cy` is each box's CENTRE
 * height (which is what `Object3D.position` and `Matrix4.compose` want). The
 * caller translates and rotates the whole stack into district space.
 *
 * DETERMINISM. Where a recipe has a range ("podium 10–14 m"), the value comes
 * from `hash01(seed)`, never `Math.random()`. The same world must build
 * byte-identically on every load or a screenshot diff means nothing.
 */

/** Triangles in one `BoxGeometry`. 6 faces × 2 triangles. Not an estimate. */
export const TRIANGLES_PER_BOX = 12;

/**
 * @typedef {{cx:number, cy:number, cz:number, w:number, h:number, d:number}} MassBox
 * @typedef {{w:number, d:number, h:number, seed?:number}} MassInput
 */

/**
 * MAS-1 — "Podium + Setback Slab". 2 boxes, District A primary/secondary towers.
 *
 * Podium at the full lot footprint, then a slab inset 1.5 m per side rising to
 * the building's full height. Flat roof: District A's §3.3 roof ordinance is
 * never broken by a recipe, only the silhouette leading up to it varies.
 *
 * @param {MassInput} b
 * @returns {MassBox[]}
 */
export function mas1PodiumSetbackSlab(b) {
  const podiumH = clamp(0.12 * b.h, 9, 15);
  const slabH = b.h - podiumH;
  return [
    { cx: 0, cy: podiumH / 2, cz: 0, w: b.w, h: podiumH, d: b.d },
    { cx: 0, cy: podiumH + slabH / 2, cz: 0, w: b.w - 3, h: slabH, d: b.d - 3 },
  ];
}

/**
 * MAS-2 — "Twin Setback Ziggurat". 4 boxes, District A secondary/infill towers.
 *
 * Podium (full footprint, 10–14 m), lower tower inset 1.2 m/side, upper tower
 * inset a further 1.2 m/side at ~65% of total height, cap inset a further
 * 0.8 m/side over the top 8–10%. This is the recipe that gives the plateau its
 * stepped-massing variety without inventing a non-flat roof.
 *
 * @param {MassInput} b
 * @returns {MassBox[]}
 */
export function mas2TwinSetbackZiggurat(b) {
  const seed = b.seed ?? 0;
  const podiumH = 10 + hash01(seed * 2654435761) * 4;
  const capH = b.h * (0.08 + hash01(seed * 40503 + 11) * 0.02);
  const midY = b.h * 0.65;
  const capY = b.h - capH;

  return [
    { cx: 0, cy: podiumH / 2, cz: 0, w: b.w, h: podiumH, d: b.d },
    {
      cx: 0,
      cy: (podiumH + midY) / 2,
      cz: 0,
      w: b.w - 2.4,
      h: midY - podiumH,
      d: b.d - 2.4,
    },
    { cx: 0, cy: (midY + capY) / 2, cz: 0, w: b.w - 4.8, h: capY - midY, d: b.d - 4.8 },
    { cx: 0, cy: capY + capH / 2, cz: 0, w: b.w - 6.4, h: capH, d: b.d - 6.4 },
  ];
}

/**
 * MAS-3 — "Bespoke Landmark Crown". District A's 150 m landmark.
 *
 * THIS IS THE ONE RECIPE LOCKED DECISION 19 CHANGED, so read the shape before
 * comparing it to the spec. §MAS-3 as written assumed a FLAT-topped landmark and
 * priced it at 2–4 boxes / 24–48 triangles; the user then chose a **sculpted,
 * non-flat crown** for this building alone, explicitly to make it a navigation
 * beacon. The crown is therefore two progressively inset steps that are also
 * OFFSET on X (an asymmetric silhouette reads as sculpted from any approach
 * angle, where a concentric one just reads as a smaller box) plus a slender
 * spire carrying the tip to exactly 150 m.
 *
 * Cost of the decision, measured rather than assumed: **5 boxes = 60 triangles**,
 * against §MAS-3's 48 for the flat version. +12 triangles. Decision 19 asked that
 * the crown's triangles "fit the §BGT-1 headroom rather than being assumed free" —
 * they do, by four orders of magnitude, and this is the number.
 *
 * The crown cannot join FAM-3's `BatchedMesh` (no per-instance material override,
 * `RVW-7`), so this stack goes into its own `Mesh` with its own atlas at
 * +1 main / +1 shadow — the §BGT-1 district-landmarks line, confirmed
 * load-bearing rather than optimizable.
 *
 * @param {MassInput} b footprint and TOTAL height including the spire tip
 * @returns {MassBox[]}
 */
export function mas3LandmarkCrown(b) {
  const podiumH = 15;
  const shaftTop = b.h * 0.773; // ~116 m on the 150 m landmark
  const step1Top = b.h * 0.88; // ~132 m
  const step2Top = b.h * 0.947; // ~142 m
  const spireW = 1.6;

  return [
    { cx: 0, cy: podiumH / 2, cz: 0, w: b.w, h: podiumH, d: b.d },
    {
      cx: 0,
      cy: (podiumH + shaftTop) / 2,
      cz: 0,
      w: b.w - 3,
      h: shaftTop - podiumH,
      d: b.d - 3,
    },
    // Crown step 1 — inset AND offset toward +X, so the silhouette is asymmetric.
    {
      cx: 2,
      cy: (shaftTop + step1Top) / 2,
      cz: 0,
      w: b.w - 8,
      h: step1Top - shaftTop,
      d: b.d - 10,
    },
    // Crown step 2 — offset further the same way, so the steps read as a lean.
    {
      cx: 3.5,
      cy: (step1Top + step2Top) / 2,
      cz: 0,
      w: b.w - 14,
      h: step2Top - step1Top,
      d: b.d - 18,
    },
    // Spire: carries the tip to exactly b.h, the tallest point in the built world.
    {
      cx: 3.5,
      cy: (step2Top + b.h) / 2,
      cz: 0,
      w: spireW,
      h: b.h - step2Top,
      d: spireW,
    },
  ];
}

/**
 * MAS-4 — "Stoop Podium Lowrise". 2 boxes, District B lowrise.
 *
 * Storefront podium at the full footprint, ~4 m; upper stucco block inset a
 * minimal 0.5 m per side — just enough to read as a massing step in shadow, not
 * a genuine setback. The dingbat typology's tuck-under parking (§6.5) is a
 * TEXTURE cue in the podium band, not undercut geometry: a real open ground floor
 * needs geometry a box cannot remove without a notch, which is a triangle cost
 * this recipe deliberately avoids for a detail that reads from texture at street
 * level anyway.
 *
 * @param {MassInput} b
 * @returns {MassBox[]}
 */
export function mas4StoopPodiumLowrise(b) {
  const podiumH = Math.min(4, b.h * 0.45);
  return [
    { cx: 0, cy: podiumH / 2, cz: 0, w: b.w, h: podiumH, d: b.d },
    {
      cx: 0,
      cy: (podiumH + b.h) / 2,
      cz: 0,
      w: b.w - 1,
      h: b.h - podiumH,
      d: b.d - 1,
    },
  ];
}

/**
 * MAS-5 — "Ornate Corniced Midrise". 3 boxes, District B midrise.
 *
 * Storefront/marquee podium (5–6 m), midrise slab inset 1 m per side, and a
 * cornice cap that OVERHANGS the footprint by 0.6 m per side — the geometric
 * citation of Broadway Theater District terracotta cornices (§5.5), and the one
 * place in this file where a box gets bigger rather than smaller as it goes up.
 *
 * @param {MassInput} b
 * @returns {MassBox[]}
 */
export function mas5OrnateCornicedMidrise(b) {
  const seed = b.seed ?? 0;
  const podiumH = 5 + hash01(seed * 668265263 + 3);
  const corniceH = 1 + hash01(seed * 3266489917 + 5) * 0.5;
  const slabTop = b.h - corniceH;

  return [
    { cx: 0, cy: podiumH / 2, cz: 0, w: b.w, h: podiumH, d: b.d },
    {
      cx: 0,
      cy: (podiumH + slabTop) / 2,
      cz: 0,
      w: b.w - 2,
      h: slabTop - podiumH,
      d: b.d - 2,
    },
    { cx: 0, cy: slabTop + corniceH / 2, cz: 0, w: b.w + 1.2, h: corniceH, d: b.d + 1.2 },
  ];
}

/** Recipe id → function, so district data can name a recipe as a string. */
export const MASSING_RECIPES = Object.freeze({
  mas1: mas1PodiumSetbackSlab,
  mas2: mas2TwinSetbackZiggurat,
  mas3: mas3LandmarkCrown,
  mas4: mas4StoopPodiumLowrise,
  mas5: mas5OrnateCornicedMidrise,
});

/**
 * Run a named recipe.
 * @param {keyof typeof MASSING_RECIPES} recipe
 * @param {MassInput} b
 * @returns {MassBox[]}
 */
export function massingBoxes(recipe, b) {
  const fn = MASSING_RECIPES[recipe];
  if (!fn) throw new Error(`massing: unknown recipe '${recipe}'`);
  return fn(b);
}

/** @param {number} v @param {number} lo @param {number} hi */
function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

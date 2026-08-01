import { FACADE_VARIANTS } from './StreetBlock.js';

/**
 * facadeFamilies.js — the seven Phase 2 facade families (design spec §4).
 *
 * WHY SEVEN, AND WHY THE FAMILY COUNT IS THE BUILDING DRAW-CALL COUNT.
 * `RESEARCH_PHASE_2_WORLD.md` §BUD-3 is the load-bearing constraint here:
 * buildings must batch by facade MATERIAL family, because `BatchedMesh` takes a
 * single material for the whole batch and has no per-instance material override.
 * (Settled against the installed three@0.185.1 by Review `RVW-7` and re-verified
 * by the orchestrator: the constructor takes one `material`, `geometryInfo`
 * carries no material index, and the render path unconditionally reads
 * `_mesh.material = this.material`.) So one family = one `BatchedMesh` = 1 main
 * + 1 shadow call, however many buildings are in it. Seven families is
 * 7 main / 7 shadow / **14 total, both passes** — and that is the entire
 * building population of both districts.
 *
 * LOCKED DECISION 22 IS ENFORCED HERE, NOT PROMISED.
 * FAM-1, FAM-4, FAM-6 and FAM-7 are not re-typed copies of the shipped Phase 1
 * constants — they are spread directly from `FACADE_VARIANTS`, so the shipped
 * values cannot drift out from under them and `tests/districts.test.js` can
 * assert byte-equality. FAM-5 is a single-hex `band` delta on `lowriseB`,
 * declared as such. Only FAM-2 and FAM-3 are new authoring, and §4 permits that
 * explicitly: District A has no shipped "stone podium" or "light glass" asset to
 * reuse, because Phase 1 built exactly one tower palette.
 */

/**
 * FAM-1 — "Dark Curtain-Wall Glass". District A workhorse, ~70% of its towers.
 * The shipped `towerShared`, unchanged (locked decision 22). Its palette is
 * browser-verified: spot-check 5 measured the far towers at +780%/+637% mean
 * luminance under the env map at exactly these values.
 */
const fam1DarkCurtainWall = { ...FACADE_VARIANTS.towerShared };

/**
 * FAM-2 — "Stone-Clad Podium". District A, ~20%: podium levels and free-standing
 * low annex/parking structures.
 *
 * §3.1's own phrase is "dark glass AND STONE-CLAD boxes" — the real DTLA cluster
 * is not glass-only, and Phase 1's kit never built the second half of it. Punched
 * masonry openings, not curtain-wall glazing: deliberately the lightest, driest
 * surface in either district's palette so it reads as a base course under the
 * glass above it. `columns: 3` gives the coarser fenestration rhythm a real
 * podium or parking structure has.
 */
const fam2StoneCladPodium = {
  wall: 0xb8b2a4, // warm limestone grey
  window: 0x25303c, // darker than any glass family: a recessed void, not a plane
  band: 0x8f8878, // neutral stone-adjacent, decoupled from the wall per convention
  columns: 3,
  wallRough: 0.85, // near-matte…
  wallMetal: 0.02, // …and effectively non-metallic. Stone, not glass.
  winRough: 0.3,
  winMetal: 0.25,
};

/**
 * FAM-3 — "Light Silver-Glass Accent". District A, ~10%: the landmark tower plus
 * one or two secondary towers marked as a newer generation.
 *
 * THE GLOSSIEST FAMILY IN THE SPEC, AND THAT IS SAFE FOR A SPECIFIC REASON.
 * `towerShared`'s conservative metalness was chosen for a rig with NO environment
 * map (see the long history comment in `StreetBlock.js`). That rig no longer
 * exists — `Sky.js` bakes a PMREM and assigns `scene.environment` — so a NEW
 * family may sit above those values without recreating the near-black defect.
 * The proxy check the tower-palette spec used, re-run for this window colour:
 * `0x4a6480` = (74, 100, 128); at `winMetal 0.58` the surviving diffuse term
 * `albedo × (1 − metal)` is 31–54, comparable to or above the shipped tower's
 * already-verified 25. This does NOT license touching the shipped constants —
 * locked decision 22 closed that, for the third and last time.
 */
const fam3LightSilverGlass = {
  wall: 0xa9b4c2, // pale silver-blue: lighter and cooler than FAM-1
  window: 0x4a6480,
  band: 0x5a5f66,
  columns: 5, // matches FAM-1's rhythm: "the same tower, newer glass"
  wallRough: 0.28,
  wallMetal: 0.38,
  winRough: 0.08,
  winMetal: 0.58,
};

/** FAM-4 — "Cream Stucco Dingbat". District B lowrise. Shipped `lowriseA`, unchanged. */
const fam4CreamStucco = { ...FACADE_VARIANTS.lowriseA };

/**
 * FAM-5 — "Ochre Terracotta Storefront". District B lowrise/storefront.
 *
 * A ONE-HEX DELTA on the shipped `lowriseB`, and nothing else: `band` moves from
 * `0xb8a888` to terracotta, carrying the Broadway Theater District cornice
 * reference (§5.5). Wall, window, columns and all four PBR numbers are the
 * shipped, browser-verified values. Zero draw calls; one constant.
 */
const fam5OchreTerracotta = { ...FACADE_VARIANTS.lowriseB, band: 0xa85a3c };

/** FAM-6 — "Steel-Blue Glass Midrise". District B midrise. Shipped `midriseA`, unchanged. */
const fam6SteelBlueGlass = { ...FACADE_VARIANTS.midriseA };

/** FAM-7 — "Bronze Glass Midrise". District B's taller 46 m band. Shipped `midriseB`, unchanged. */
const fam7BronzeGlass = { ...FACADE_VARIANTS.midriseB };

/**
 * The seven families, keyed by the id the district data references.
 * Iteration order is District A's three then District B's four, which is also
 * the order their `BatchedMesh`es are added to the scene.
 */
export const FACADE_FAMILIES = Object.freeze({
  fam1DarkCurtainWall: Object.freeze(fam1DarkCurtainWall),
  fam2StoneCladPodium: Object.freeze(fam2StoneCladPodium),
  fam3LightSilverGlass: Object.freeze(fam3LightSilverGlass),
  fam4CreamStucco: Object.freeze(fam4CreamStucco),
  fam5OchreTerracotta: Object.freeze(fam5OchreTerracotta),
  fam6SteelBlueGlass: Object.freeze(fam6SteelBlueGlass),
  fam7BronzeGlass: Object.freeze(fam7BronzeGlass),
});

/** The three families District A draws from. */
export const DISTRICT_A_FAMILIES = Object.freeze([
  'fam1DarkCurtainWall',
  'fam2StoneCladPodium',
  'fam3LightSilverGlass',
]);

/** The four families District B draws from. */
export const DISTRICT_B_FAMILIES = Object.freeze([
  'fam4CreamStucco',
  'fam5OchreTerracotta',
  'fam6SteelBlueGlass',
  'fam7BronzeGlass',
]);

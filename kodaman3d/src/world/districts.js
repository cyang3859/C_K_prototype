import * as THREE from 'three';

import { ANNEX, ANNEX_HALF_EXTENT, ANNEX_ORIGIN, BESPOKE_TOWER_INDEX } from './annex.js';
import { DISTRICT_A_FAMILIES, DISTRICT_B_FAMILIES } from './facadeFamilies.js';
import { hash01 } from './facadeAtlas.js';

/**
 * districts.js — the authored data for the two Phase 2 districts.
 *
 * DATA, NOT GEOMETRY. Everything here is plain numbers and pure functions;
 * `District.js` consumes it and builds meshes. That is the same separation
 * `StreetBlock.js` already uses (`BLOCK` beside the builders), kept deliberately
 * so a third district is data rather than a rewrite.
 *
 * LOCKED DECISION 10 IS THE WHOLE POINT OF THIS FILE.
 *   District A — dense tower plateau on the **36°-rotated historic grid**.
 *   District B — mixed-height boulevard corridor on the **cardinal grid**.
 * The rotation difference is not decoration: it is what makes the same sun rake
 * the two districts differently at the same hour, which buys per-district visual
 * differentiation for free once a day/night cycle exists. Do not "simplify" the
 * rotation away.
 *
 * WHAT IS DELIBERATELY NOT HERE. No chunks, no streaming, no load/unload, no LOD.
 * `RESEARCH_PHASE_2_WORLD.md` §BUD-2 is emphatic that a future `Chunk.js` must be
 * a data window into district-shared batches rather than a `StreetBlock` repeated
 * per tile; this run builds the district-shared batches that such a window would
 * later index into, and stops there.
 *
 * ---------------------------------------------------------------------------
 * THE GRID, ONCE, SO THE ARITHMETIC IS NOT REDERIVED THREE TIMES
 * ---------------------------------------------------------------------------
 * A district is a 300 × 300 m square in its own LOCAL frame, spanning ±150 on
 * local X and Z. Street centre-lines run at local ±50 and ±150 on both axes, so
 * the district is 3 × 3 cells of 100 m. Each street carries Phase 1's real
 * S-470-1 "Avenue I" section (30.48 m right-of-way: 21.34 m roadway + 4.57 m
 * sidewalk per side), so the buildable strip inside a cell is
 * `100 − 30.48 = 69.52 m`, and each cell holds a 2 × 2 grid of 34.76 m building
 * slots. Slot centres therefore sit at `cellCentre ± 17.38`.
 *
 * That is 6 × 6 = 36 slots per district. District A gives its four central slots
 * over to the landmark's full-lot footprint (§DA-4 sites it at the district's
 * geometric centre), leaving 32 batched buildings + 1 landmark. District B keeps
 * all 36 and puts its landmark on a sidewalk corner, because the landmark is a
 * mast rather than a building (locked decision 20).
 *
 * 68 batched buildings across the two districts sits inside `BUD-3`'s inherited
 * 30–50-per-district planning band — at its lower edge, which is the comfortable
 * direction to be wrong in.
 */

/** Metres. District half-extent in its own local frame. */
export const DISTRICT_HALF = 150;
/** Metres. Street grid pitch: cells are this wide, streets run between them. */
export const CELL_PITCH = 100;
/** Metres. Right-of-way, matching Phase 1's S-470-1 section exactly. */
export const ROW = 30.48;
export const ROADWAY = 21.34;
export const SIDEWALK = 4.57;
export const HALF_ROADWAY = ROADWAY / 2; // 10.67

/**
 * Local coordinates of the street centre-lines, both axes.
 *
 * ONLY THE TWO INTERIOR LINES, deliberately. A street on the district edge at
 * ±150 would be half outside the district and would need every road strip
 * clipped to the boundary — real work for a half-street nobody can drive down.
 * The outermost lots front onto the district edge instead, which is what the
 * edge of a real downtown core does anyway.
 */
export const STREET_LINES = Object.freeze([-50, 50]);
/** Local coordinates of the 3 cell centres, both axes. */
export const CELL_CENTRES = Object.freeze([-100, 0, 100]);
/** Metres. Half the gap between the two slot centres inside one cell. */
export const SLOT_OFFSET = (CELL_PITCH - ROW) / 4; // 17.38
/** Metres. The widest footprint a slot can hold without crossing into the setback. */
export const SLOT_SPAN = (CELL_PITCH - ROW) / 2; // 34.76

/**
 * District A's grid rotation. **36° off cardinal, per locked decision 10** — the
 * angle of the historic Ord grid, per `RESEARCH_LA_WORLDBUILDING.md` §1.1.
 */
export const DISTRICT_A_ROTATION = THREE.MathUtils.degToRad(36);
/** District B's grid rotation. **Cardinal — exactly zero**, per locked decision 10. */
export const DISTRICT_B_ROTATION = 0;

/**
 * Every slot centre in a district's local frame, in a stable order:
 * row-major over Z then X, so a building's index is reproducible.
 * @returns {Array<{lx:number, lz:number}>}
 */
export function slotCentres() {
  const axis = [];
  for (const c of CELL_CENTRES) {
    axis.push(c - SLOT_OFFSET, c + SLOT_OFFSET);
  }
  const out = [];
  for (const lz of axis) {
    for (const lx of axis) out.push({ lx, lz });
  }
  return out;
}

/** The four central slots District A's landmark consumes. */
const CENTRAL_SLOTS = new Set(['-17.38,-17.38', '17.38,-17.38', '-17.38,17.38', '17.38,17.38']);

const key = (s) => `${round2(s.lx)},${round2(s.lz)}`;

/**
 * District A's building population — the tower plateau.
 *
 * §DA-1/§DIS-2 want a NARROWER height spread than Phase 1's deliberately-mixed
 * block: mostly tower-class, no lowrise band at all, so the district reads as a
 * plateau rather than a skyline. §DA-2's shares are followed as closely as 32
 * buildings allow: 21 primary (66%), 9 secondary (28%), 2 podium-only (6%).
 *
 * FAMILY AND RECIPE ASSIGNMENT, and why podiums cross batches.
 * A building's boxes do NOT all have to live in the same `BatchedMesh` — the
 * batch is keyed by material, not by building. So MAS-2's podium box goes into
 * FAM-2's stone-clad batch while its three tower boxes go into FAM-1's glass
 * batch, which is exactly what §5 means by "MAS-2 applies to FAM-1 and FAM-2
 * (podium level)" and is what gives the plateau a stone base under glass shafts.
 * It costs zero extra draw calls: both batches exist regardless.
 *
 * @returns {DistrictBuilding[]}
 */
export function districtABuildings() {
  const slots = slotCentres().filter((s) => !CENTRAL_SLOTS.has(key(s)));
  const bands = dealBands(slots.length, [
    ['primary', 21],
    ['secondary', 9],
    ['podium', 2],
  ]);
  /** @type {DistrictBuilding[]} */
  const out = [];

  for (let i = 0; i < slots.length; i++) {
    const { lx, lz } = slots[i];
    const r = (n) => hash01(i * 2654435761 + n);
    const band = bands[i];

    if (band === 'podium') {
      out.push({
        band,
        lx,
        lz,
        w: 20 + r(1) * 8, // 20–28
        d: 20 + r(2) * 10, // 20–30
        h: 15 + r(3) * 5, // 15–20 m
        recipe: 'mas1',
        family: 'fam2StoneCladPodium',
        podiumFamily: null,
        seed: i,
      });
      continue;
    }

    if (band === 'secondary') {
      out.push({
        band,
        lx,
        lz,
        w: 16 + r(1) * 4, // 16–20
        d: 22 + r(2) * 6, // 22–28
        h: 40 + r(3) * 20, // 40–60 m
        recipe: 'mas2',
        family: 'fam1DarkCurtainWall',
        // The ziggurat's podium is stone, the shafts above it are glass.
        podiumFamily: 'fam2StoneCladPodium',
        seed: i,
      });
      continue;
    }

    // §FAM-3 is "the landmark plus 1–2 secondary towers marked as newer
    // generation". The landmark is not batched (it needs its own atlas), so
    // three primaries carry the family, which is what makes its two draw calls
    // buy something.
    const newerGeneration = i === 2 || i === 18 || i === 29;
    out.push({
      band,
      lx,
      lz,
      w: 18 + r(1) * 6, // 18–24
      d: 24 + r(2) * 6, // 24–30 — capped at 30 by the 34.76 m slot, not by §DA-2
      h: 70 + r(3) * 40, // 70–110 m
      recipe: 'mas1',
      family: newerGeneration ? 'fam3LightSilverGlass' : 'fam1DarkCurtainWall',
      podiumFamily: null, // MAS-1 stays inside its tower family, per §5
      seed: i,
    });
  }

  return out;
}

/**
 * District B's building population — the boulevard corridor.
 *
 * §DB-2's shares over 36 slots: 20 lowrise (56%), 14 midrise (39%), 2 at the
 * 46 m band (6%). The 46 m ceiling is not arbitrary — it is §3.4's exact figure
 * for the Capitol Records Building, "a physical monument to the height cap" that
 * every District A tower postdates. Borrowing the NUMBER is inside locked
 * decision 3 (real ordinances and dimensions are facts); borrowing that
 * building's cylindrical silhouette would not be, and nothing here does.
 *
 * @returns {DistrictBuilding[]}
 */
export function districtBBuildings() {
  const slots = slotCentres();
  const bands = dealBands(slots.length, [
    ['lowrise', 20],
    ['midrise', 14],
    ['tallMidrise', 2],
  ]);
  /** @type {DistrictBuilding[]} */
  const out = [];

  for (let i = 0; i < slots.length; i++) {
    const { lx, lz } = slots[i];
    const r = (n) => hash01(i * 40503 + n * 7919);
    const band = bands[i];

    if (band === 'tallMidrise') {
      out.push({
        band,
        lx,
        lz,
        w: 18 + r(1) * 4,
        d: 24 + r(2) * 4,
        h: 46,
        recipe: 'mas5',
        family: 'fam7BronzeGlass',
        podiumFamily: null,
        seed: i,
      });
      continue;
    }

    if (band === 'midrise') {
      out.push({
        band,
        lx,
        lz,
        w: 16 + r(1) * 6, // 16–22
        d: 22 + r(2) * 4, // 22–26
        h: 24 + r(3) * 11, // 24–35 m
        recipe: 'mas5',
        family: 'fam6SteelBlueGlass',
        podiumFamily: null,
        seed: i,
      });
      continue;
    }

    out.push({
      band,
      lx,
      lz,
      w: 16 + r(1) * 4, // 16–20
      d: 18 + r(2) * 4, // 18–22
      h: 8 + r(3) * 6, // 8–14 m
      recipe: 'mas4',
      // Cream and ochre alternate in slot order, so the two stucco families
      // interleave along a street instead of clustering.
      family: i % 2 === 0 ? 'fam4CreamStucco' : 'fam5OchreTerracotta',
      podiumFamily: null,
      seed: i,
    });
  }

  return out;
}

/**
 * District B's ANNEX — locked decision 24.
 *
 * Phase 1's standalone `StreetBlock` is gone as an area; its ten hand-authored
 * buildings are District B lots now. They are expressed in District B's LOCAL
 * frame, which for a cardinal district (rotation 0) is a pure translation of
 * `ANNEX_ORIGIN.x - origin.x = -320` on X — so every world coordinate the annex
 * has ever had is preserved bit for bit.
 *
 * WHY THEY DO NOT USE §5's MASSING RECIPES. `mas0` is one box, which is what
 * Phase 1 built. Retro-fitting setbacks onto ten reviewed buildings would be a
 * visual redesign nobody asked for; decision 24 is about where content lives,
 * not what it looks like.
 *
 * FAMILY MAPPING, and why it is not a repaint. Four of District B's five
 * families ARE the shipped Phase 1 variants, spread byte-identically under
 * locked decision 22 — so `lowriseA -> FAM-4`, `midriseA -> FAM-6`,
 * `midriseB -> FAM-7` and `towerShared -> FAM-1` change nothing at all about how
 * these buildings render. The one real change is `lowriseB -> FAM-5`, which adds
 * FAM-5's terracotta cornice string course to the two ochre lowrises; that is an
 * addition to the shipped spec rather than an alteration of it, and it is what
 * makes the annex read as part of District B's storefront corridor instead of as
 * a transplant.
 *
 * `bespoke: true` marks the 90 m helipad tower, which cannot join a batch.
 *
 * @returns {DistrictBuilding[]}
 */
export function annexBuildings() {
  const dx = ANNEX_ORIGIN.x - DISTRICT_B_ORIGIN.x;
  const dz = ANNEX_ORIGIN.z - DISTRICT_B_ORIGIN.z;
  const family = {
    lowriseA: 'fam4CreamStucco',
    lowriseB: 'fam5OchreTerracotta',
    midriseA: 'fam6SteelBlueGlass',
    midriseB: 'fam7BronzeGlass',
    towerShared: 'fam1DarkCurtainWall',
  };
  // Phase 1's own assignment rule, reproduced exactly: variants alternate A/B in
  // array order WITHIN each kind, and towers all share `towerShared`.
  const ordinal = { lowrise: 0, midrise: 0, tower: 0 };

  return ANNEX.buildings.map((b, i) => {
    const n = ordinal[b.kind]++;
    const variant = b.kind === 'tower' ? 'towerShared' : `${b.kind}${n % 2 === 0 ? 'A' : 'B'}`;
    return {
      band: 'annex',
      annexIndex: i,
      bespoke: i === BESPOKE_TOWER_INDEX,
      kind: b.kind,
      lx: b.x + dx,
      lz: b.z + dz,
      w: b.w,
      d: b.d,
      h: b.h,
      recipe: 'mas0',
      family: family[variant],
      podiumFamily: null,
      seed: 1000 + i,
    };
  });
}

/**
 * Deal band labels across `total` slots with EXACT counts and no clustering.
 *
 * Written as a deal rather than as `i % 10 < 3`-style modular tests because a
 * modular test gives whatever count the arithmetic happens to produce — the
 * first draft of this file silently shipped 19 primaries where §DA-2's share
 * called for 21, and nothing but a test caught it. Here the counts are the
 * input. The stride is coprime with `total`, so the walk visits every slot
 * exactly once and neighbouring slots get different bands.
 *
 * @param {number} total
 * @param {Array<[string, number]>} counts
 * @returns {string[]}
 */
function dealBands(total, counts) {
  const pool = [];
  for (const [name, n] of counts) for (let i = 0; i < n; i++) pool.push(name);
  if (pool.length !== total) {
    throw new Error(`dealBands: ${pool.length} labels for ${total} slots`);
  }
  const stride = total % 2 === 0 ? total / 2 + 1 : 3;
  const out = new Array(total);
  for (let i = 0; i < total; i++) out[(i * stride) % total] = pool[i];
  return out;
}

/** District A's centre in world space. */
export const DISTRICT_A_ORIGIN = Object.freeze({ x: -400, z: 0 });
/** District B's centre in world space. Its annex extends it west to x = -150. */
export const DISTRICT_B_ORIGIN = Object.freeze({ x: 320, z: 0 });

/**
 * The two districts, as consumed by `District.js`.
 *
 * `origin` is the district's centre in WORLD space and `rotation` its grid yaw.
 * `ground` is stated separately and in WORLD-AXIS-ALIGNED terms on purpose: the
 * ground plane is featureless, so rotating it with the grid would buy nothing,
 * and sizing it to the district's own square would leave visible void between
 * the districts. Instead the two ground planes tile the whole bounded world
 * between them, for the same TWO meshes §6 already budgets.
 *
 * WHERE THE GROUND SPLIT MOVED, and why it is not arbitrary (locked decision
 * 24). Before the absorption the split was at x = 0 and Phase 1's own block
 * ground covered ±150, hiding it. With that block ground gone the seam would
 * have run straight down the middle of the annex's boulevard, so District B's
 * ground was extended west to x = -150 — the annex's own edge — and District A's
 * shortened to meet it there. District B's ground colour is 0x9a927f, which is
 * byte-identical to the ground the annex used to own, so nothing under the
 * boulevard changed shade.
 */
export const DISTRICTS = Object.freeze([
  Object.freeze({
    id: 'districtA',
    label: 'tower plateau',
    origin: DISTRICT_A_ORIGIN,
    rotation: DISTRICT_A_ROTATION,
    families: DISTRICT_A_FAMILIES,
    buildings: districtABuildings,
    ground: Object.freeze({ cx: -380, cz: 0, w: 460, d: 1220, color: 0x8f8a78 }),
    roadColor: 0x3c3f45,
    /** §DA-4 — one 150 m landmark on the district's geometric centre lot. */
    landmark: Object.freeze({
      kind: 'tower',
      lx: 0,
      lz: 0,
      w: 22,
      d: 32,
      h: 150,
      recipe: 'mas3',
    }),
  }),
  Object.freeze({
    id: 'districtB',
    label: 'boulevard corridor',
    origin: DISTRICT_B_ORIGIN,
    rotation: DISTRICT_B_ROTATION,
    families: DISTRICT_B_FAMILIES,
    /**
     * The generated 3x3 grid PLUS the absorbed annex (locked decision 24).
     * `districtBBuildings()` stays pure so the §DB-2 band shares can still be
     * asserted on the population the spec actually describes.
     */
    buildings: () => [...districtBBuildings(), ...annexBuildings()],
    ground: Object.freeze({ cx: 230, cz: 0, w: 760, d: 1220, color: 0x9a927f }),
    roadColor: 0x3f4148,
    /**
     * The annex's own street: Phase 1's boulevard, running along world X at
     * z = 0 for ±150 m. Stated in District B LOCAL coordinates so `District.js`
     * can merge its strips into the district's four §6 surfaces without knowing
     * anything about where the annex came from.
     */
    annexStreets: Object.freeze([
      Object.freeze({
        axis: 'x',
        line: ANNEX_ORIGIN.z - DISTRICT_B_ORIGIN.z,
        from: ANNEX_ORIGIN.x - ANNEX_HALF_EXTENT - DISTRICT_B_ORIGIN.x,
        to: ANNEX_ORIGIN.x + ANNEX_HALF_EXTENT - DISTRICT_B_ORIGIN.x,
      }),
    ]),
    /**
     * §DB-4 / locked decision 20 — a sign/observation mast, NOT a building, on
     * the sidewalk corner of the district's busiest intersection.
     */
    landmark: Object.freeze({
      kind: 'mast',
      lx: 63,
      lz: 63,
      h: 75,
    }),
  }),
]);

/**
 * The world half-extent the two districts plus Phase 1's block require.
 *
 * THE ROTATION IS WHAT SETS THIS NUMBER, which is worth stating because the
 * first draft got it wrong. A 300 m square yawed 36° has an axis-aligned
 * envelope of 300·(cos36° + sin36°) = 419 m, not 300 — so District A needs
 * 60 m more room per side than District B does, and the two districts are
 * therefore NOT placed symmetrically about the origin. District A sits at
 * x = −400 (envelope x ∈ [−609.5, −190.5]); District B, cardinal and needing no
 * inflation, sits at x = 320 (x ∈ [170, 470]). Phase 1's block keeps ±150. A
 * square boundary at 610 contains all three with ~40 m of open ground between
 * each district and the block, and the two district ground planes together
 * floor the entire square. The world stays BOUNDED (locked decision 8) — this
 * raises the fence, it does not remove it.
 */
export const WORLD_HALF_EXTENT = 610;

/**
 * The world-space AABB of a district building, accounting for the district's
 * grid rotation.
 *
 * KNOWN APPROXIMATION, STATED RATHER THAN HIDDEN. `Collision.js` is
 * axis-aligned by design and this run does not change it, so a District A
 * building yawed 36° is registered as the CIRCUMSCRIBED world AABB of its
 * rotated footprint. That box is larger than the building — for a 22 × 32 m
 * footprint at 36° it is 36.6 × 38.8 m — so the hero stops a few metres short of
 * some corners and the camera arm pulls in slightly early there. It never lets
 * the hero inside geometry, which is the safe direction for this defect. Real
 * OBB support in `Collision.js` is the fix and is run 2's, not this run's.
 *
 * @param {DistrictBuilding} b
 * @param {{origin:{x:number,z:number}, rotation:number}} district
 * @returns {THREE.Box3}
 */
export function buildingWorldBox(b, district) {
  const c = Math.abs(Math.cos(district.rotation));
  const s = Math.abs(Math.sin(district.rotation));
  const halfW = (b.w * c + b.d * s) / 2;
  const halfD = (b.w * s + b.d * c) / 2;
  const { x, z } = localToWorld(b.lx, b.lz, district);

  return new THREE.Box3(
    new THREE.Vector3(x - halfW, 0, z - halfD),
    new THREE.Vector3(x + halfW, b.h, z + halfD),
  );
}

/**
 * District-local → world. A yaw of θ about +Y maps local (x, z) to
 * (x·cosθ + z·sinθ, −x·sinθ + z·cosθ), which is `Object3D.rotation.y = θ`'s own
 * convention — stated here because getting the sign wrong mirrors a whole
 * district and the mistake is invisible in a screenshot.
 *
 * @param {number} lx @param {number} lz
 * @param {{origin:{x:number,z:number}, rotation:number}} district
 */
export function localToWorld(lx, lz, district) {
  const cos = Math.cos(district.rotation);
  const sin = Math.sin(district.rotation);
  return {
    x: district.origin.x + lx * cos + lz * sin,
    z: district.origin.z - lx * sin + lz * cos,
  };
}

/** @param {number} v */
function round2(v) {
  return Math.round(v * 100) / 100;
}

/**
 * @typedef {{band:string, lx:number, lz:number, w:number, d:number, h:number,
 *   recipe:string, family:string, podiumFamily:(string|null), seed:number}} DistrictBuilding
 */

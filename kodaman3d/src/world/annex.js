import * as THREE from 'three';

import {
  atlasBoxUVs,
  fillAll,
  fillRect,
  grey,
  hash01,
  hex6,
  makeContext,
  paintFacadeRegion,
  scaleBoxUVs,
} from './facadeAtlas.js';

/**
 * annex.js — the hand-authored boulevard block, now **District B's west annex**.
 *
 * ===========================================================================
 * WHAT HAPPENED HERE, AND WHY THE FILE IS NO LONGER A CLASS — LOCKED DECISION 24
 * ===========================================================================
 * This file was `StreetBlock.js`: a self-contained third area with its own
 * ground plane, its own five road meshes, ten individual building meshes and its
 * own eight instanced prop pools — 25 main + 18 shadow = **43 draw calls** for a
 * 300 m square, budgeted nowhere in `DESIGN_SPEC_PHASE_2_DISTRICTS.md` §BGT-1.
 *
 * Locked decision 24 retires the standalone area. Everything it authored
 * survives — the boulevard, the ten buildings, the 90 m helipad tower, the
 * palms, lamps, parapets, HVAC, awnings and blade signs — but it now lives
 * inside District B, which is the cardinal-grid mixed-height boulevard corridor
 * this block always was. Concretely:
 *
 *   - the ground plane is gone; District B's ground was extended west to cover
 *     this square (`districts.js`, `ground.cx/w`);
 *   - the roadway, two sidewalks, two curbs and the instanced centreline are
 *     gone; the boulevard's strips are merged into District B's four §6 surfaces
 *     and its lane marking is painted into the shared roadway texture;
 *   - nine of the ten buildings joined District B's facade `BatchedMesh`es, so
 *     they cost nothing at all;
 *   - the 90 m tower keeps its own `Mesh`, because its bespoke helipad atlas
 *     cannot join a batch (`BatchedMesh` has no per-instance material override);
 *   - the eight prop pools became world-shared pools in `WorldProps.js`, where
 *     the districts' own props share them rather than duplicating them.
 *
 * **NOTHING IN THIS FILE MOVED IN WORLD SPACE.** The coordinates below are still
 * Phase 1's exact world coordinates, because District B's grid is cardinal
 * (locked decision 10) so the annex is a pure translation of -320 on X inside
 * it. The hero still spawns at (0, 0, 13); the helipad tower still stands at
 * (-2, 31). Five browser passes of human sign-off on this content are not
 * re-litigated by a bookkeeping change.
 *
 * WHAT REMAINS HERE is the authored DATA and the pure functions over it. There
 * is no builder class and no `update()`; `District.js` and `WorldProps.js`
 * consume this module.
 *
 * STREET DIMENSIONS ARE REAL, NOT INVENTED (Phase 1 brief §9.1).
 * The boulevard is built to the City of Los Angeles Standard Plan S-470-1
 * "Avenue I" class (Secondary Highway) — the actual classification of Hollywood
 * Blvd, Sunset Blvd and Wilshire Blvd west of Beverly Hills:
 *
 *     right-of-way (property line to property line)   100 ft  = 30.48 m
 *     roadway (curb to curb)                           70 ft  = 21.34 m
 *     sidewalk, each side (includes the parkway)       15 ft  =  4.57 m
 *                                                     21.34 + 4.57x2 = 30.48
 *
 * NO NAMED PLACES. Buildings are generic `lowrise` / `midrise` / `tower`. No
 * proper nouns for locations, businesses or characters (locked decision 6).
 */

export { atlasBoxUVs, scaleBoxUVs };

/** Metres. Right-of-way, roadway and sidewalk widths, per S-470-1. */
export const STREET = Object.freeze({
  RIGHT_OF_WAY: 30.48,
  ROADWAY: 21.34,
  SIDEWALK: 4.57,
  /** Half the roadway: the curb line sits at ±this on Z. */
  HALF_ROADWAY: 21.34 / 2, // 10.67
  /** Standard LA travel lane, 11 ft. */
  LANE: 3.35,
  /** Curb height above the roadway surface. */
  CURB_HEIGHT: 0.15,
  /** Where palms are planted: the parkway strip inside the sidewalk, nearest the curb. */
  PARKWAY_Z: 12.1,
  /** Street lamps sit further back on the sidewalk than the palms. */
  LAMP_Z: 14.2,

  /**
   * VISUAL CURB RELIEF — deliberately a few centimetres, not the real 15 cm.
   *
   * The collision model is an implicit FLAT ground plane at y = 0 plus building
   * AABBs, and the capsule controller has no step-up logic. A truthful 15 cm
   * curb would therefore be a lie the collision cannot back up: either the
   * hero's feet sink 15 cm into every sidewalk, or — if the slabs were made
   * colliders — the horizontal push-out would treat every curb as a wall and the
   * hero could never step onto a sidewalk at all.
   *
   * FOR LATER: once the controller gains step-up/ramp handling, restore these to
   * the real 0.15 m and make the slabs colliders.
   */
  SIDEWALK_RELIEF: 0.03,
  CURB_RELIEF: 0.07,
});

/** Metres. The annex square's half-extent on X and Z, about its own origin. */
export const ANNEX_HALF_EXTENT = 150;

/**
 * The annex's world-space origin. Phase 1's block was centred on the world
 * origin and it has not moved; this constant exists so `districts.js` can derive
 * the district-local offset instead of hard-coding -320 in three places.
 */
export const ANNEX_ORIGIN = Object.freeze({ x: 0, z: 0 });

/**
 * The authored block.
 *
 * Buildings: 10 total — 4 low-rise (8–12 m), 4 mid-rise (20–35 m), 2 towers
 * (60–90 m), arranged in two rows facing the boulevard. `x`/`z` are the
 * footprint CENTRE; `w`/`d` are full width (X) and depth (Z); `h` is height.
 * All sit on the y = 0 ground plane, in WORLD coordinates.
 *
 * They occupy the 100x100 m buildable core (±50 m on X and Z) minus the
 * boulevard right-of-way that cuts through it, so no footprint intrudes past
 * the sidewalk edge at |z| = 15.24 m.
 */
export const ANNEX = Object.freeze({
  buildings: Object.freeze([
    // --- north side of the boulevard (+Z) ---
    { kind: 'lowrise', x: -40, z: 27, w: 16, d: 20, h: 9 },
    { kind: 'midrise', x: -22, z: 29, w: 16, d: 24, h: 24 },
    { kind: 'tower', x: -2, z: 31, w: 20, d: 28, h: 90 },
    { kind: 'midrise', x: 18, z: 28, w: 16, d: 22, h: 31 },
    { kind: 'lowrise', x: 38, z: 26, w: 20, d: 18, h: 11 },
    // --- south side of the boulevard (-Z) ---
    { kind: 'lowrise', x: -39, z: -27, w: 18, d: 20, h: 8 },
    { kind: 'midrise', x: -19, z: -30, w: 18, d: 26, h: 27 },
    { kind: 'lowrise', x: 1, z: -26, w: 18, d: 18, h: 12 },
    { kind: 'tower', x: 21, z: -32, w: 18, d: 30, h: 64 },
    { kind: 'midrise', x: 40, z: -29, w: 16, d: 24, h: 33 },
  ]),

  /**
   * Washingtonia robusta — the Mexican fan palm that defines the LA street
   * silhouette, and District B's species per locked decision 21. 12–18 m, spaced
   * 12 m along the parkway on both sides.
   */
  palmSpacing: 12,
  palmRange: 144,
  lampSpacing: 24,
  lampRange: 132,
});

/**
 * The one building that gets a bespoke, non-repeating texture atlas instead of a
 * shared repeat-tiled family material.
 *
 * Index 2 is the 90 m tower at (-2, 31) — the building acceptance criterion 20
 * asks a human to fly over AND LAND ON, and the only one in the world with a
 * painted helipad. It is also the reason this building cannot join a facade
 * batch: `BatchedMesh` takes one material for the whole batch.
 */
export const BESPOKE_TOWER_INDEX = 2;

/**
 * Facade variants — the shipped Phase 1 palette.
 *
 * LOCKED DECISION 22: these values are frozen. `facadeFamilies.js` spreads FOUR
 * of them directly (`towerShared` -> FAM-1, `lowriseA` -> FAM-4, `midriseA` ->
 * FAM-6, `midriseB` -> FAM-7) and `districts.test.js` asserts byte-equality, so
 * nothing can drift them toward glassiness without failing a test. The question
 * was closed three times on measured evidence.
 *
 * `wallRough`/`wallMetal` and `winRough`/`winMetal` are the whole point of this
 * table: stucco is near-fully rough and non-metallic while glass is smooth and
 * half-metallic, which is what makes one throw a specular highlight and the
 * other not.
 */
export const FACADE_VARIANTS = Object.freeze({
  lowriseA: {
    wall: 0xd9c6a0, // cream stucco
    window: 0x293b4d,
    band: 0xb8a888, // roof/spandrel neutral — DECOUPLED from the wall colour
    columns: 3,
    wallRough: 0.98,
    wallMetal: 0.0,
    winRough: 0.22,
    winMetal: 0.45,
  },
  lowriseB: {
    wall: 0xc2a06e, // ochre stucco
    window: 0x293b4d,
    band: 0xb8a888,
    columns: 3,
    wallRough: 0.98,
    wallMetal: 0.0,
    winRough: 0.22,
    winMetal: 0.45,
  },
  midriseA: {
    wall: 0x8f96a3, // steel-blue glass box
    window: 0x1f2c3a,
    band: 0x6a675f,
    columns: 4,
    wallRough: 0.45,
    wallMetal: 0.4,
    winRough: 0.12,
    winMetal: 0.65,
  },
  midriseB: {
    wall: 0x8a7a68, // smoked bronze glass box
    window: 0x2e2519,
    band: 0x6a675f,
    columns: 4,
    wallRough: 0.45,
    wallMetal: 0.4,
    winRough: 0.12,
    winMetal: 0.65,
  },
  // WHY THESE ARE NOT DARKER, which is the obvious instinct for glass.
  //
  // HISTORY — these values were tuned when there was NO environment map. As of
  // commit 6a07c13 there IS one: a PMREM baked from the synthetic sky, applied
  // as `scene.environment` (`Sky.js`), so the reasoning below no longer holds as
  // stated. The values are kept because the fix worked and the towers now read
  // as glass.
  //
  // The original reasoning, for the record. In MeshStandardMaterial, metalness
  // SUBTRACTS from the diffuse term and moves that energy into specular
  // reflection of the environment — but with no environment to reflect, indirect
  // specular is exactly zero. Metal takes the brightness away and gives nothing
  // back. At the values that shipped first (wallMetal 0.45, winMetal 0.70) the
  // tower lost half to two thirds of its diffuse output on top of an albedo
  // already darker than the mid-rise's, and ACES crushes that low end hard. The
  // result read as near-black with pure-black window voids.
  //
  // So: albedo up, metalness down. The env map named above as the physically
  // correct fix SHIPPED in 6a07c13 and closed the dark-tower defect on its own.
  // Measured under Playwright (spot-check 5), ENV_INTENSITY 0 -> 1 lifts the far
  // towers by +780% / +637% mean luminance with these values unchanged, so there
  // is no problem left for a metalness raise to solve.
  towerShared: {
    wall: 0x828fa0,
    window: 0x32475e,
    band: 0x4a4844,
    columns: 5,
    wallRough: 0.4,
    wallMetal: 0.32,
    winRough: 0.1,
    winMetal: 0.5,
  },
});

/**
 * G1 — rooftop parapet coping. A low wall around the roof EDGE, so a roofline
 * reads as a hard parapet-edged silhouette instead of a box that simply stops
 * (post-1958 LA high-rises are flat-roofed by ordinance).
 *
 * A RING OF FOUR BARS, NOT A SLAB, and the difference is not cosmetic. The first
 * implementation was a single slab spanning the whole roof, raised 0.45 m. That
 * is what real coping is not — coping caps the wall — and it had a consequence
 * nobody traced until a human went looking for the helipad and could not find
 * it: the slab sat directly on top of the +Y face, which is exactly where the
 * roof atlas paints the helipad. **The marking was covered by the parapet at
 * every size.** Raising it from 3.5 m to 12 m changed nothing, because the
 * problem was never the size.
 *
 * Four bars cost the same ONE draw call — an InstancedMesh does not care whether
 * it draws 40 instances or 400 — and they leave the roof centre open, so the
 * roof art is visible and the hero lands on the real roof surface rather than on
 * a lid over it.
 */
export const PARAPET = Object.freeze({
  THICKNESS: 0.6,
  HEIGHT: 0.45,
  COLOR: 0x6b6a62,
  /** Bars per building. N and S span the full width; E and W fit between them. */
  BARS: 4,
});

/** G2 — rooftop mechanical units. Real geometry, deliberately not painted into the roof texture. */
export const HVAC = Object.freeze({
  W: 1.2,
  H: 0.9,
  D: 1.2,
  COLOR: 0x9aa0a6,
});

/** G3 — ground-floor storefront awnings. */
export const AWNING = Object.freeze({
  /** Fraction of the building's street-facing width the canopy spans. */
  WIDTH_FRACTION: 0.85,
  THICKNESS: 0.12,
  /** How far the canopy projects out over the sidewalk, metres. */
  PROJECTION: 1.4,
  /** Height of the canopy's attachment to the wall. Well above the 1.85 m hero. */
  Y: 3.2,
  /** Slope, radians. Sign is chosen per side so the LEADING edge drops. */
  TILT: 0.26,
  /** Cycled by building index so many canopies do not read as one asset copied. */
  FABRIC: Object.freeze([0x9c4632, 0x39543f, 0x6b2f3a]),
});

/** G4 — vertical blade signs. Silhouette only: no text, no graphics, no proper nouns. */
export const BLADE = Object.freeze({
  W: 0.15, // thin front-on: the blade's broad faces look down the street
  H: 2.5,
  D: 0.6, // projects perpendicular to the facade
  Y: 4.2, // spans 2.95–5.45 m, clear of the awnings below
  /** Distance from the facade plane to the sign's centre. */
  STANDOFF: 0.4,
  /** Distance in from the building corner. */
  CORNER_INSET: 0.8,
  COLOR: 0x1c1c1e,
});

/**
 * The bespoke tower's texture atlas. One 1024x1024 canvas divided into three
 * regions; the box's six faces are remapped into them by `atlasBoxUVs`.
 *
 * Region A — front/back (+Z/-Z), 20 m wide x 90 m tall
 * Region B — sides (+X/-X), 28 m wide x 90 m tall
 * Region C — roof (+Y, and -Y which is never visible), the 20 x 28 m roof plan
 *
 * A and B share the same V range on purpose: both represent the same 90 m of
 * real height, so the floor lines line up when the player flies around a corner.
 */
export const TOWER_ATLAS = Object.freeze({
  SIZE: 1024,
  /** Storey height, m. Backed into from Century Plaza Tower I (174.0 m / 44 floors = 3.95). */
  STOREY_M: 3.9,
  /** Structural bay width, m — a conventional commercial curtain-wall bay. */
  BAY_M: 3.2,
  /**
   * [uMin, uMax, vMin, vMax] per face, in BoxGeometry's fixed face order:
   * +X, -X, +Y, -Y, +Z, -Z.
   */
  REGIONS: Object.freeze([
    [0.5, 1.0, 0.0, 0.75], // +X -> region B
    [0.5, 1.0, 0.0, 0.75], // -X -> region B
    [0.0, 1.0, 0.75, 1.0], // +Y -> region C (roof)
    [0.0, 1.0, 0.75, 1.0], // -Y -> region C, reused; never visible
    [0.0, 0.5, 0.0, 0.75], // +Z -> region A
    [0.0, 0.5, 0.0, 0.75], // -Z -> region A
  ]),
  /** Roof art colours. */
  ROOF_BASE: 0x3d3a36, // tar/gravel
  SPECKLE_LIGHT: 0x55504a,
  SPECKLE_DARK: 0x2c2925,
  HELIPAD_RING: 0xd9c840, // safety yellow
  HELIPAD_GLYPH: 0xe8e4d6,
  /**
   * Helipad ring radii, in canvas pixels ALONG THE U AXIS. The V axis is
   * compensated at draw time (see `paintRoofRegion`), so these are the radii
   * that survive into world space. At 1024 px over the tower's 20 m width the
   * scale is 51.2 px/m, so 307 px is a 6 m radius — a **12 m helipad** on a
   * 20 x 28 m roof, and a ~1 m ring stroke.
   *
   * It shipped at 90/78 first, a 3.5 m marking straight from the reviewed spec.
   * A human flew over the roof and could not find it: 3.5 m on a 20 m roof is a
   * few pixels from flight altitude, so it read as a decal rather than a place
   * to land. 12 m is the real FATO proportion for a roof this size and is what
   * the user chose.
   */
  HELIPAD_OUTER_PX: 307,
  HELIPAD_INNER_PX: 256,
  /** Gravel speckle: authored in METRES so it stays square once V is compensated. */
  SPECKLE_M: 0.12,
  SPECKLE_COUNT: 400,
});

// ---------------------------------------------------------------------------
// The bespoke tower's material — the helipad
// ---------------------------------------------------------------------------

/**
 * Build the one bespoke, non-repeating material for `BESPOKE_TOWER_INDEX`.
 *
 * It is still one mesh and one draw call. This is the material that carries the
 * painted helipad a human signed off across five browser passes; if it is ever
 * lost, so is the only landable marked rooftop in the world.
 *
 * @param {{w:number,d:number,h:number}} b the authored building record
 * @param {(canvas:HTMLCanvasElement, opts:{repeat:boolean,srgb:boolean}) => THREE.Texture} register
 * @returns {THREE.MeshStandardMaterial}
 */
export function makeBespokeTowerMaterial(b, register) {
  const S = TOWER_ATLAS.SIZE;
  const diffuse = makeContext(S, S);
  const rough = makeContext(S, S);
  const metal = makeContext(S, S);
  const ctxs = { diffuse, rough, metal };
  const spec = FACADE_VARIANTS.towerShared;

  // Region pixel rectangles, using the SAME flipY convention as the tiled kit:
  // canvasY = (1 - v) x SIZE, so v in [0, 0.75] (the building's full height) is
  // the canvas's LOWER 768 rows and v in [0.75, 1] (the roof) is its TOP 256.
  const facadeTop = S * 0.25; // canvas y of the building's roofline
  const facadeH = S * 0.75;
  const halfW = S * 0.5;

  // Real floor count, not a repeat tile. Both regions use the same row height
  // because both represent the same 90 m — required, or the floor lines break
  // where the player flies around a corner.
  const floors = Math.round(b.h / TOWER_ATLAS.STOREY_M); // 90 / 3.9 -> 23
  const colsA = Math.round(b.w / TOWER_ATLAS.BAY_M); // 20 / 3.2 -> 6
  const colsB = Math.round(b.d / TOWER_ATLAS.BAY_M); // 28 / 3.2 -> 9

  fillAll(diffuse, `#${hex6(spec.wall)}`, S, S);
  fillAll(rough, grey(spec.wallRough), S, S);
  fillAll(metal, grey(spec.wallMetal), S, S);

  // Region A — front/back, 512 px over the 20 m width.
  paintFacadeRegion(ctxs, spec, {
    x: 0,
    y: facadeTop,
    w: halfW,
    h: facadeH,
    columns: colsA,
    floors,
    metresW: b.w,
    metresH: b.h,
  });
  // Region B — sides, 512 px over the 28 m depth.
  paintFacadeRegion(ctxs, spec, {
    x: halfW,
    y: facadeTop,
    w: halfW,
    h: facadeH,
    columns: colsB,
    floors,
    metresW: b.d,
    metresH: b.h,
  });
  // Region C — the roof plan, with the helipad.
  paintRoofRegion(ctxs, { x: 0, y: 0, w: S, h: facadeTop, metresW: b.w, metresD: b.d });

  return new THREE.MeshStandardMaterial({
    map: register(diffuse.canvas, { repeat: false, srgb: true }),
    roughnessMap: register(rough.canvas, { repeat: false, srgb: false }),
    metalnessMap: register(metal.canvas, { repeat: false, srgb: false }),
    roughness: 1,
    metalness: 1,
  });
}

/**
 * Paint the roof plan region of the bespoke atlas: tar and gravel, a
 * deterministic speckle, and the painted helipad.
 *
 * THE ASPECT PROBLEM, and why the ctx.scale below is not optional. This region
 * is 1024 px wide over the roof's 20 m X extent (51.2 px/m) but only 256 px tall
 * over its 28 m Z extent (9.14 px/m) — a 5.6x mismatch, because a 1024x256 px
 * region does not share the aspect ratio of a 20x28 m footprint. (BoxGeometry's
 * +Y face binds U to the box's X and V to its Z.) A circle drawn with equal x/y
 * radii here would land on the real roof as an ellipse 5.6x longer along Z than
 * along X. Squashing V by (256/28)/(1024/20) = 0.17857 before drawing makes it a
 * true circle in world space.
 *
 * @param {{diffuse:CanvasRenderingContext2D,rough:CanvasRenderingContext2D,metal:CanvasRenderingContext2D}} ctxs
 * @param {{x:number,y:number,w:number,h:number,metresW:number,metresD:number}} r
 */
export function paintRoofRegion(ctxs, r) {
  const { diffuse, rough, metal } = ctxs;

  fillRect(diffuse, `#${hex6(TOWER_ATLAS.ROOF_BASE)}`, r.x, r.y, r.w, r.h);
  fillRect(rough, grey(0.95), r.x, r.y, r.w, r.h); // tar and gravel: matte
  fillRect(metal, grey(0.0), r.x, r.y, r.w, r.h);

  const pxPerM_U = r.w / r.metresW; // 1024 / 20 = 51.2
  const pxPerM_V = r.h / r.metresD; // 256 / 28 = 9.142857
  const vSquash = pxPerM_V / pxPerM_U; // 0.178571...

  // Gravel speckle. Sized in metres and converted per axis so the flecks stay
  // roughly square once the 5.6x density mismatch is accounted for; a literal
  // 3x3 px dot would land on the roof as a 6 cm x 33 cm streak.
  const dotW = Math.max(1, Math.round(TOWER_ATLAS.SPECKLE_M * pxPerM_U));
  const dotH = Math.max(1, Math.round(TOWER_ATLAS.SPECKLE_M * pxPerM_V));
  for (let i = 0; i < TOWER_ATLAS.SPECKLE_COUNT; i++) {
    const px = r.x + hash01(i * 2246822519) * (r.w - dotW);
    const py = r.y + hash01(i * 3266489917 + 7) * (r.h - dotH);
    const light = hash01(i * 668265263 + 13) < 0.5;
    fillRect(
      diffuse,
      `#${hex6(light ? TOWER_ATLAS.SPECKLE_LIGHT : TOWER_ATLAS.SPECKLE_DARK)}`,
      px,
      py,
      dotW,
      dotH,
    );
  }

  // Helipad, centred in the region — which is the centre of the real roof,
  // because the region maps proportionally onto the whole +Y face.
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  const ro = TOWER_ATLAS.HELIPAD_OUTER_PX;
  const ri = TOWER_ATLAS.HELIPAD_INNER_PX;

  for (const [ctx, ringStyle, glyphStyle] of [
    [diffuse, `#${hex6(TOWER_ATLAS.HELIPAD_RING)}`, `#${hex6(TOWER_ATLAS.HELIPAD_GLYPH)}`],
    // Paint is smoother than the gravel it sits on, and stays non-metallic.
    [rough, grey(0.5), grey(0.5)],
    [metal, grey(0.0), grey(0.0)],
  ]) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, vSquash);

    // Annulus: outer circle then inner circle wound backwards, so the default
    // nonzero fill rule leaves the middle open.
    ctx.beginPath();
    ctx.arc(0, 0, ro, 0, Math.PI * 2, false);
    ctx.arc(0, 0, ri, 0, Math.PI * 2, true);
    ctx.fillStyle = ringStyle;
    ctx.fill();

    // "H", sized to roughly fill the ring's inner diameter. It is drawn INSIDE
    // the same squash transform, which is what keeps it upright rather than
    // stretched once it lands on the real roof.
    ctx.fillStyle = glyphStyle;
    ctx.font = `bold ${Math.round(ri * 1.4)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('H', 0, 0);

    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// Pure placement functions — shared by the batches, the prop pools and the tests
// ---------------------------------------------------------------------------

/**
 * The four bars of the G1 parapet ring for one building, as centre-and-scale
 * records ready for an InstancedMesh.
 *
 * Pure so the roof-landing behaviour acceptance criterion 20 depends on can be
 * tested headlessly, without a canvas or a WebGL context.
 *
 * @param {{x:number,z:number,w:number,d:number,h:number}} b
 */
export function parapetBars(b) {
  const T = PARAPET.THICKNESS;
  const cy = b.h + PARAPET.HEIGHT / 2;
  const halfW = b.w / 2;
  const halfD = b.d / 2;
  // N and S run the full width; E and W fit between them, so the four bars meet
  // at the corners without overlapping (overlap would double-shade the corners).
  return [
    { cx: b.x, cy, cz: b.z + halfD - T / 2, sx: b.w, sy: PARAPET.HEIGHT, sz: T },
    { cx: b.x, cy, cz: b.z - halfD + T / 2, sx: b.w, sy: PARAPET.HEIGHT, sz: T },
    { cx: b.x + halfW - T / 2, cy, cz: b.z, sx: T, sy: PARAPET.HEIGHT, sz: b.d - T * 2 },
    { cx: b.x - halfW + T / 2, cy, cz: b.z, sx: T, sy: PARAPET.HEIGHT, sz: b.d - T * 2 },
  ];
}

/**
 * The G1 parapet ring's collision boxes for one building — one per bar.
 * @param {{x:number,z:number,w:number,d:number,h:number}} b
 * @returns {THREE.Box3[]}
 */
export function parapetBoxes(b) {
  return parapetBars(b).map(
    (bar) =>
      new THREE.Box3(
        new THREE.Vector3(bar.cx - bar.sx / 2, b.h, bar.cz - bar.sz / 2),
        new THREE.Vector3(bar.cx + bar.sx / 2, b.h + PARAPET.HEIGHT, bar.cz + bar.sz / 2),
      ),
  );
}

/**
 * The clear roof area INSIDE the coping ring — where the roof art shows and
 * where anything standing on the roof has to fit.
 */
export function roofInnerBox(b) {
  const T = PARAPET.THICKNESS;
  return new THREE.Box3(
    new THREE.Vector3(b.x - b.w / 2 + T, b.h, b.z - b.d / 2 + T),
    new THREE.Vector3(b.x + b.w / 2 - T, b.h + PARAPET.HEIGHT, b.z + b.d / 2 - T),
  );
}

/**
 * The walkable top of a building's roof.
 *
 * This is the ROOF ITSELF (`b.h`), not the top of a parapet slab. When the
 * coping became a ring the lid came off, so the hero lands on the real roof —
 * which is also what makes the painted helipad something you land ON rather than
 * something buried under 0.45 m of concrete.
 */
export function roofTopY(b) {
  return b.h;
}

/**
 * Placement for the G2 rooftop mechanical units.
 *
 * Pure, deterministic and exported so both the InstancedMesh and the colliders
 * read from one source, and so the helipad-clearance claim is testable.
 * Returned `y` is each unit's BASE, which rests on the roof surface itself.
 *
 * @param {ReadonlyArray<{kind:string,x:number,z:number,w:number,d:number,h:number}>} [buildings]
 * @returns {Array<{x:number,y:number,z:number}>}
 */
export function hvacUnits(buildings = ANNEX.buildings) {
  /** @type {Array<{x:number,y:number,z:number}>} */
  const units = [];

  for (let i = 0; i < buildings.length; i++) {
    const b = buildings[i];
    const y = roofTopY(b);

    if (b.kind === 'tower') {
      // FIXED, not hashed. On the bespoke tower these must stay clear of the
      // painted helipad at the roof centre, and a hash that happened to land one
      // on the "H" would be a bug nobody could reproduce from the source.
      const bx = b.x + b.w * 0.32;
      const bz = b.z - b.d * 0.32;
      units.push({ x: bx, y, z: bz });
      units.push({ x: bx - 1.5, y, z: bz });
      units.push({ x: bx, y, z: bz + 1.5 });
    } else {
      // Scattered within the roof area inside the coping. `- 3` keeps a 1.5 m
      // margin on each side so a 1.2 m box never overhangs the coping.
      for (let u = 0; u < 2; u++) {
        const seed = i * 131 + u * 17;
        units.push({
          x: b.x + (hash01(seed) - 0.5) * (b.w - 3),
          y,
          z: b.z + (hash01(seed + 1) - 0.5) * (b.d - 3),
        });
      }
    }
  }

  return units;
}

/**
 * G3 awning placements for the annex's eight low/mid-rise buildings, in WORLD
 * space.
 *
 * NOT COLLIDERS, deliberately. Their underside sits at ~2.96 m at the leading
 * edge, well clear of the 1.85 m hero, so they can only ever be walked under.
 * Registering them would also feed them to the camera's spring-arm sphere-cast,
 * which would yank the camera in every time the player walked past a storefront.
 *
 * @returns {Array<{x:number,y:number,z:number,yaw:number,tilt:number,width:number,color:number}>}
 */
export function annexAwnings() {
  const out = [];
  for (let i = 0; i < ANNEX.buildings.length; i++) {
    const b = ANNEX.buildings[i];
    if (b.kind === 'tower') continue;
    // `outward` is +1 for buildings SOUTH of the boulevard (b.z < 0, whose
    // street frontage faces +Z) and -1 for those NORTH of it. Every sign below
    // is derived from it, so there is one place to be wrong rather than four.
    const outward = b.z > 0 ? -1 : 1;
    const facadeZ = b.z + outward * (b.d / 2);
    out.push({
      x: b.x,
      y: AWNING.Y,
      z: facadeZ + outward * (AWNING.PROJECTION / 2),
      yaw: 0,
      // Rotating by theta about X sends a point at local +z to y = -z.sin(theta).
      // The canopy's LEADING edge is at local z = outward x PROJECTION/2, and we
      // want it to drop, so theta takes the sign of `outward`.
      tilt: outward * AWNING.TILT,
      width: b.w * AWNING.WIDTH_FRACTION,
      // Cycled by the building's index in ANNEX.buildings, not by its position
      // in the filtered list, so a building keeps its colour if the filter ever
      // changes.
      color: AWNING.FABRIC[i % AWNING.FABRIC.length],
    });
  }
  return out;
}

/**
 * G4 blade-sign placements for the annex's four mid-rises, in WORLD space.
 * Silhouette only: no text, no graphics, no emissive.
 * @returns {Array<{x:number,y:number,z:number,yaw:number}>}
 */
export function annexBladeSigns() {
  const out = [];
  let k = 0;
  for (const b of ANNEX.buildings) {
    if (b.kind !== 'midrise') continue;
    const outward = b.z > 0 ? -1 : 1; // see annexAwnings for the convention
    const facadeZ = b.z + outward * (b.d / 2);
    // Alternate which corner the sign hangs off, so four signs do not line up on
    // the same side of every building.
    const side = k % 2 === 0 ? -1 : 1;
    out.push({
      x: b.x + side * (b.w / 2 - BLADE.CORNER_INSET),
      y: BLADE.Y,
      z: facadeZ + outward * BLADE.STANDOFF,
      yaw: 0,
    });
    k++;
  }
  return out;
}

/**
 * Mexican fan palm placements along both annex parkways, in WORLD space.
 *
 * The heights and leans are the shipped deterministic hashes, unchanged, so the
 * row a human has looked at five times is byte-identical after the move.
 * @returns {Array<{x:number,z:number,yaw:number,height:number,lean:number,crown:number}>}
 */
export function annexPalms() {
  const positions = [];
  for (let x = -ANNEX.palmRange; x <= ANNEX.palmRange; x += ANNEX.palmSpacing) {
    positions.push([x, STREET.PARKWAY_Z]);
    positions.push([x, -STREET.PARKWAY_Z]);
  }
  return positions.map(([x, z], i) => ({
    x,
    z,
    yaw: hash01(i * 97) * Math.PI * 2,
    crownYaw: hash01(i * 31) * Math.PI * 2,
    // Deterministic variation: same layout on every load, but not a uniform row
    // of clones. 12–18 m per the Phase 1 brief.
    height: 12 + hash01(i * 2654435761) * 6,
    lean: (hash01(i * 40503) - 0.5) * 0.08,
    crown: 1.9 + hash01(i * 7919) * 0.7,
  }));
}

/**
 * Street lamp placements, set back on the annex sidewalk, in WORLD space.
 * `yaw` turns the lamp so its head arm overhangs the roadway.
 * @returns {Array<{x:number,z:number,yaw:number}>}
 */
export function annexLamps() {
  const out = [];
  for (let x = -ANNEX.lampRange; x <= ANNEX.lampRange; x += ANNEX.lampSpacing) {
    for (const z of [STREET.LAMP_Z, -STREET.LAMP_Z]) {
      // Heads overhang toward the roadway, i.e. toward z = 0.
      out.push({ x, z, yaw: z > 0 ? Math.PI : 0 });
    }
  }
  return out;
}

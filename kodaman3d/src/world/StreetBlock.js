import * as THREE from 'three';

import { disposeObject3D } from '../core/dispose.js';

/**
 * StreetBlock.js — the one hand-authored street block.
 *
 * DATA-DRIVEN ON PURPOSE. All authored content lives in the exported `BLOCK`
 * object below, and the builder functions consume it generically. Phase 2 turns
 * that pattern into per-district data files; keeping the separation now means
 * Phase 2 adds data, not a rewrite.
 *
 * SCOPE: ONE BLOCK, FULLY RESIDENT, ALWAYS. No streaming, no LOD tiers, no
 * ChunkManager, no District abstraction (all Phase 2). If this file grows a
 * load/unload concept, Phase 1 scope has been breached.
 *
 * STREET DIMENSIONS ARE REAL, NOT INVENTED (brief §9.1).
 * The boulevard is built to the City of Los Angeles Standard Plan S-470-1
 * "Avenue I" class (Secondary Highway) — the actual classification of Hollywood
 * Blvd, Sunset Blvd and Wilshire Blvd west of Beverly Hills, which makes it the
 * correct template for an iconic LA boulevard:
 *
 *     right-of-way (property line to property line)   100 ft  = 30.48 m
 *     roadway (curb to curb)                           70 ft  = 21.34 m
 *     sidewalk, each side (includes the parkway)       15 ft  =  4.57 m
 *                                                     21.34 + 4.57×2 = 30.48 ✓
 *
 * Travel lanes are laid out at 4 lanes within the 21.34 m roadway. The LA
 * Street Design Manual's standard lane is 11 ft (3.35 m); the remaining width
 * goes to a centre turn lane, which is both visually truthful for a boulevard
 * of this class and gives the centreline something to be.
 *
 * EXTENT DISCIPLINE: nothing authored here may exceed ±150 m on X or Z.
 *
 * NO NAMED PLACES. Buildings are generic `lowrise` / `midrise` / `tower`. No
 * proper nouns for locations, businesses or characters, and no invented
 * placeholder names either — that exercise is blocked pending sign-off on a
 * separate trademark mapping table.
 *
 * BUILDING REALISM PASS (docs/handoff/DESIGN_SPEC_PHASE_1_BUILDINGS.md, gated by
 * REVIEW_DESIGN_SPEC_BUILDINGS.md). The facade materials below carry a diffuse,
 * a roughness AND a metalness canvas each so a glass mid-rise and a stucco
 * low-rise stop responding to light identically; the 90 m tower gets a unique
 * non-repeating atlas with a painted helipad; and four InstancedMeshes add
 * parapets, rooftop mechanical units, awnings and blade signs. Everything in
 * that pass is either free (textures) or exactly one draw call (the four
 * instanced items).
 */

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
   * Phase 1's collision model is an implicit FLAT ground plane at y = 0 plus
   * building AABBs, and the capsule controller has no step-up logic (adding one
   * is not in the brief's scope and would mean reworking the tested vertical
   * resolution). A truthful 15 cm curb would therefore be a lie the collision
   * cannot back up: either the hero's feet sink 15 cm into every sidewalk, or —
   * if the slabs were made colliders — the horizontal push-out would treat every
   * curb as a wall and the hero could never step onto a sidewalk at all.
   *
   * Keeping the whole walkable surface within a few centimetres of y = 0 means
   * the geometry matches the physics exactly. The curb still reads as a curb
   * because it is a distinct lighter strip with a visible edge, just a shallow
   * one. FOR PHASE 2: once the controller gains step-up/ramp handling, restore
   * these to the real 0.15 m and make the slabs colliders.
   */
  SIDEWALK_RELIEF: 0.03,
  CURB_RELIEF: 0.07,
});

/** The playable square's half-extent. Nothing authored may exceed this. */
export const HALF_EXTENT = 150;

/**
 * The authored block.
 *
 * Buildings: 10 total — 4 low-rise (8–12 m), 4 mid-rise (20–35 m), 2 towers
 * (60–90 m), arranged in two rows facing the boulevard. `x`/`z` are the
 * footprint CENTRE; `w`/`d` are full width (X) and depth (Z); `h` is height.
 * All sit on the y = 0 ground plane. The 90 m tower is the one acceptance
 * criterion 20 asks a human to fly over and land on.
 *
 * They occupy the 100×100 m buildable core (±50 m on X and Z) minus the
 * boulevard right-of-way that cuts through it, so no footprint intrudes past
 * the sidewalk edge at |z| = 15.24 m.
 */
export const BLOCK = Object.freeze({
  buildings: [
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
  ],

  /**
   * Washingtonia robusta — the Mexican fan palm that defines the LA street
   * silhouette. 12–18 m, spaced 12 m along the parkway on both sides.
   * Generated rather than hand-listed because it is a strict arithmetic
   * progression; the deterministic pseudo-random height keeps the row from
   * looking machine-stamped without introducing frame-to-frame nondeterminism.
   */
  palmSpacing: 12,
  palmRange: 144, // ±144 m: inside the ±150 m playable extent
  lampSpacing: 24,
  lampRange: 132,
});

/** Metres of facade per texture tile. Drives the window grid density. */
const FACADE_TILE_M = 4;

/**
 * The one building that gets a bespoke, non-repeating texture atlas instead of
 * the shared repeat-tiled kind material.
 *
 * Index 2 is the 90 m tower at (-2, 31) — the building acceptance criterion 20
 * asks a human to fly over AND LAND ON, so it is the only rooftop in the block
 * guaranteed close inspection. Everything else is seen from a distance, where a
 * repeat-tiled texture is indistinguishable from a unique one.
 */
const BESPOKE_TOWER_INDEX = 2;

/**
 * Facade variants — five repeat-tiled materials covering nine of the ten
 * buildings (the tenth is BESPOKE_TOWER_INDEX, above).
 *
 * `wallRough`/`wallMetal` and `winRough`/`winMetal` are the whole point of this
 * table. Before the realism pass every building shared `roughness: 0.85,
 * metalness: 0.05`, so a glass curtain-wall mid-rise and a stucco low-rise
 * scattered light identically. Now stucco is near-fully rough and non-metallic
 * while glass is smooth and half-metallic, which is what makes one throw a
 * specular highlight and the other not.
 *
 * Colours are the palette from DESIGN_SPEC_PHASE_1_BUILDINGS.md § Palette. The
 * cream/ochre low-rise split is Spanish Colonial Revival / dingbat stucco; the
 * steel-blue vs smoked-bronze mid-rise split is the 1971–1992 "dark glass and
 * stone-clad box" generation, which would plausibly not all be one shade.
 */
const FACADE_VARIANTS = Object.freeze({
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
  // There is NO ENVIRONMENT MAP in this project — no `scene.environment`, no
  // PMREM, no `.envMap` on any material. Lighting is one DirectionalLight plus
  // one HemisphereLight (`Sky.js`), and the renderer tone-maps with ACES
  // Filmic (`Renderer.js:45`).
  //
  // That combination changes what `metalness` means here. In
  // MeshStandardMaterial, metalness SUBTRACTS from the diffuse term and moves
  // that energy into specular reflection of the environment — but with no
  // environment to reflect, indirect specular is exactly zero. Metal takes the
  // brightness away and gives nothing back. At the values that shipped first
  // (wallMetal 0.45, winMetal 0.70) the tower lost half to two thirds of its
  // diffuse output on top of an albedo already darker than the mid-rise's, and
  // ACES crushes that low end hard. The result was a facade that read as
  // near-black with pure-black window voids — reported by a human flying past
  // it, and visible in two of five screenshots.
  //
  // So: albedo up, metalness down. Roughness is deliberately UNCHANGED — it was
  // never implicated, and the low `winRough` is what keeps the glass reading
  // glossy rather than chalky.
  //
  // If this still reads flat on a real GPU, the physically correct fix is a
  // real environment map (PMREM-baked from a synthetic gradient sky, no asset
  // file needed) rather than pushing these numbers further. That is written up
  // in DESIGN_SPEC_TOWER_PALETTE.md as an open question, and it would let the
  // metalness values go back up where they belong.
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
 * The frame/mullion around each window pane, in the roughness+metalness maps.
 * Anodised aluminium: smoother than stucco, rougher and less reflective than
 * the glass it holds. Diffuse-side the frame is drawn as a light/dark bevel
 * instead (see `paintWindowCell`).
 */
const FRAME_ROUGH = 0.55;
const FRAME_METAL = 0.3;

/**
 * Roof/spandrel band PBR. This band is ALSO the pixel the flat-roof UVs of the
 * nine repeat-tiled buildings collapse onto (see `scaleBoxUVs`), so its
 * roughness and metalness are authored for a ROOF, not for a facade detail:
 * built-up roofing and rooftop gravel are matte and non-metallic.
 */
const BAND_ROUGH = 0.92;
const BAND_METAL = 0.05;

/**
 * G1 — rooftop parapet coping. A low wall around the roof EDGE on every
 * building, so a roofline reads as a hard parapet-edged silhouette instead of a
 * box that simply stops (post-1958 LA high-rises are flat-roofed by ordinance).
 *
 * A RING OF FOUR BARS, NOT A SLAB, and the difference is not cosmetic. The
 * first implementation was a single slab spanning the whole roof, raised 0.45 m.
 * That is what real coping is not — coping caps the wall — and it had a
 * consequence nobody traced until a human went looking for the helipad and
 * could not find it: the slab sat directly on top of the +Y face, which is
 * exactly where the roof atlas paints the helipad. **The marking was covered by
 * the parapet at every size.** Raising it from 3.5 m to 12 m changed nothing,
 * because the problem was never the size.
 *
 * Four bars cost the same ONE draw call — an InstancedMesh does not care
 * whether it draws 10 instances or 40 — and they leave the roof centre open, so
 * the roof art is visible and the hero lands on the real roof surface rather
 * than on a lid over it.
 *
 * THICKNESS is the coping width; bars sit flush with the building edge.
 */
const PARAPET = Object.freeze({
  THICKNESS: 0.6,
  HEIGHT: 0.45,
  COLOR: 0x6b6a62,
  /** Bars per building. N and S span the full width; E and W fit between them. */
  BARS: 4,
});

/** G2 — rooftop mechanical units. Real geometry, deliberately not painted into the roof texture. */
const HVAC = Object.freeze({
  W: 1.2,
  H: 0.9,
  D: 1.2,
  COLOR: 0x9aa0a6,
});

/** G3 — ground-floor storefront awnings. */
const AWNING = Object.freeze({
  /** Fraction of the building's street-facing width the canopy spans. */
  WIDTH_FRACTION: 0.85,
  THICKNESS: 0.12,
  /** How far the canopy projects out over the sidewalk, metres. */
  PROJECTION: 1.4,
  /** Height of the canopy's attachment to the wall. Well above the 1.85 m hero. */
  Y: 3.2,
  /** Slope, radians. Sign is chosen per side so the LEADING edge drops. */
  TILT: 0.26,
  /** Cycled by building index so eight canopies do not read as one asset copied. */
  FABRIC: [0x9c4632, 0x39543f, 0x6b2f3a],
});

/** G4 — vertical blade signs. Silhouette only: no text, no graphics, no proper nouns. */
const BLADE = Object.freeze({
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
 * The bespoke tower's texture atlas. One 1024×1024 canvas divided into three
 * regions; the box's six faces are remapped into them by `atlasBoxUVs`.
 *
 * Region A — front/back (+Z/-Z), 20 m wide × 90 m tall
 * Region B — sides (+X/-X), 28 m wide × 90 m tall
 * Region C — roof (+Y, and -Y which is never visible), the 20 × 28 m roof plan
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
   * compensated at draw time (see `_paintRoofRegion`), so these are the radii
   * that survive into world space. At 1024 px over the tower's 20 m width the
   * scale is 51.2 px/m, so 307 px is a 6 m radius — a **12 m helipad** on a
   * 20 × 28 m roof, and a ~1 m ring stroke.
   *
   * It shipped at 90/78 first, a 3.5 m marking straight from the reviewed spec.
   * A human flew over the roof and could not find it: 3.5 m on a 20 m roof is a
   * few pixels from flight altitude, so it read as a decal rather than a place
   * to land. 12 m is the real FATO proportion for a roof this size and is what
   * the user chose.
   *
   * Both circles fit their region: 2 × 307 = 614 px of the 1024 px width, and
   * once squashed, 2 × 307 × 0.17857 ≈ 110 px of the 256 px height.
   */
  HELIPAD_OUTER_PX: 307,
  HELIPAD_INNER_PX: 256,
  /** Gravel speckle: authored in METRES so it stays square once V is compensated. */
  SPECKLE_M: 0.12,
  SPECKLE_COUNT: 400,
});

export class StreetBlock {
  /**
   * @param {object} args
   * @param {THREE.Scene} args.scene
   * @param {import('./Collision.js').CollisionWorld} args.collision
   */
  constructor({ scene, collision }) {
    this.scene = scene;
    this.collision = collision;

    this.group = new THREE.Group();
    this.group.name = 'streetBlock';

    /**
     * Every CanvasTexture and standalone material created here is tracked so
     * `dispose()` can free it. Textures in particular are NOT reachable by
     * traversing the scene graph once a material is disposed, and disposing a
     * material does not dispose its textures — see core/dispose.js. This is the
     * leak that shows up as a climbing `renderer.info.memory.textures` across an
     * afternoon of Vite HMR reloads.
     * @type {Array<{dispose:() => void}>}
     */
    this._disposables = [];

    this._buildGround();
    this._buildRoad();
    this._buildBuildings();
    this._buildParapets();
    this._buildRoofUnits();
    this._buildAwnings();
    this._buildBladeSigns();
    this._buildPalms();
    this._buildLamps();

    scene.add(this.group);
  }

  /**
   * Phase 1's world is static. Present so Game.js's fixed step has its final
   * shape — Phase 2 hangs streaming and time-of-day updates here.
   * @param {number} _dt
   */
  update(_dt) {}

  // ------------------------------------------------------------------ ground

  _buildGround() {
    // One large plane covering the whole playable square. Rotated -90° about X
    // so its +Z normal becomes +Y: PlaneGeometry is authored in the XY plane and
    // this is the standard incantation for turning one into a floor.
    const geo = new THREE.PlaneGeometry(HALF_EXTENT * 2, HALF_EXTENT * 2);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({ color: 0x9a927f, roughness: 1 });
    const ground = new THREE.Mesh(geo, mat);
    ground.name = 'ground';
    ground.receiveShadow = true;
    // Ground does not cast: it is the bottom of the world and casting from it
    // wastes shadow-map fill for zero visual gain.
    ground.castShadow = false;
    this.group.add(ground);
  }

  // -------------------------------------------------------------------- road

  _buildRoad() {
    const len = HALF_EXTENT * 2;

    // Asphalt, lifted a hair above the ground plane. Coplanar surfaces z-fight
    // violently at distance; 2 cm of separation is invisible and completely
    // removes the problem. Colour only, no texture, in Phase 1.
    const asphaltGeo = new THREE.PlaneGeometry(len, STREET.ROADWAY);
    asphaltGeo.rotateX(-Math.PI / 2);
    const asphalt = new THREE.Mesh(
      asphaltGeo,
      new THREE.MeshStandardMaterial({ color: 0x3c3f45, roughness: 0.95 }),
    );
    asphalt.name = 'roadway';
    asphalt.position.y = 0.02;
    asphalt.receiveShadow = true;
    this.group.add(asphalt);

    // Sidewalks: shallow slabs the full length of the block, one per side.
    // See STREET.SIDEWALK_RELIEF for why these are centimetres rather than the
    // real 15 cm.
    const walkGeo = new THREE.BoxGeometry(len, STREET.SIDEWALK_RELIEF, STREET.SIDEWALK);
    const walkMat = new THREE.MeshStandardMaterial({ color: 0xb0aca2, roughness: 0.9 });
    const walkZ = STREET.HALF_ROADWAY + STREET.SIDEWALK / 2;
    for (const sign of [1, -1]) {
      const walk = new THREE.Mesh(walkGeo, walkMat);
      walk.name = `sidewalk${sign > 0 ? 'North' : 'South'}`;
      walk.position.set(0, STREET.SIDEWALK_RELIEF / 2, sign * walkZ);
      walk.receiveShadow = true;
      this.group.add(walk);
    }

    // Curbs: a lighter strip at the roadway/sidewalk boundary. Purely visual and
    // NOT a collider — a kinematic capsule catching on every curb edge feels far
    // worse than walking over them freely.
    const curbGeo = new THREE.BoxGeometry(len, STREET.CURB_RELIEF, 0.35);
    const curbMat = new THREE.MeshStandardMaterial({ color: 0xd2cec4, roughness: 0.85 });
    for (const sign of [1, -1]) {
      const curb = new THREE.Mesh(curbGeo, curbMat);
      curb.name = `curb${sign > 0 ? 'North' : 'South'}`;
      curb.position.set(0, STREET.CURB_RELIEF / 2, sign * (STREET.HALF_ROADWAY + 0.17));
      curb.receiveShadow = true;
      this.group.add(curb);
    }

    // Dashed centreline down the middle of the centre turn lane. Instanced:
    // ~50 identical dashes as individual meshes would be 50 draw calls for
    // nothing.
    const dashLength = 2.4;
    const dashGap = 3.6;
    const stride = dashLength + dashGap;
    const dashCount = Math.floor(len / stride);
    const dashGeo = new THREE.BoxGeometry(dashLength, 0.02, 0.16);
    const dashMat = new THREE.MeshStandardMaterial({
      color: 0xe8d98a,
      roughness: 0.8,
      emissive: 0x2a2410,
    });
    const dashes = new THREE.InstancedMesh(dashGeo, dashMat, dashCount);
    dashes.name = 'centreline';
    const m = new THREE.Object3D();
    for (let i = 0; i < dashCount; i++) {
      m.position.set(-HALF_EXTENT + stride * i + dashLength / 2, 0.04, 0);
      m.updateMatrix();
      dashes.setMatrixAt(i, m.matrix);
    }
    dashes.instanceMatrix.needsUpdate = true;
    // Flat road paint neither casts nor receives usefully; skipping both keeps
    // it out of the shadow pass entirely.
    dashes.castShadow = false;
    this.group.add(dashes);
  }

  // --------------------------------------------------------------- buildings

  _buildBuildings() {
    // FIVE shared repeat-tiled materials, not three, and not ten.
    //
    // Not three: a glass mid-rise and a stucco low-rise need different PBR
    // response, and two buildings of the same kind sitting side by side in the
    // same shade of glass is the "ten boxes, three textures" read the user
    // called out. Two variants per kind fixes that for zero draw calls.
    //
    // Not ten: per-building UV scaling (below) already keeps a window the same
    // physical size on a 9 m low-rise and a 90 m tower, so a unique texture per
    // building would multiply texture memory for no visual difference — except
    // on the one rooftop a player actually stands on, which is why exactly one
    // building (BESPOKE_TOWER_INDEX) opts out into its own atlas.
    const tier1 = {
      lowriseA: this._makeFacadeMaterial('lowriseA'),
      lowriseB: this._makeFacadeMaterial('lowriseB'),
      midriseA: this._makeFacadeMaterial('midriseA'),
      midriseB: this._makeFacadeMaterial('midriseB'),
      towerShared: this._makeFacadeMaterial('towerShared'),
    };

    // Variant assignment alternates A/B in array order WITHIN each kind, so it
    // is deterministic and stays sensible if a building is added or reordered.
    const ordinal = { lowrise: 0, midrise: 0, tower: 0 };

    for (let i = 0; i < BLOCK.buildings.length; i++) {
      const b = BLOCK.buildings[i];
      const n = ordinal[b.kind]++;

      const geo = new THREE.BoxGeometry(b.w, b.h, b.d);
      let material;

      if (i === BESPOKE_TOWER_INDEX) {
        // Non-repeating atlas: every face gets its own slice of one canvas, so
        // the roof can carry unique art (a helipad) that a repeat-wrapped
        // texture physically cannot — any pixel in a tiled canvas also lands
        // somewhere on the walls.
        material = this._makeBespokeTowerMaterial(b);
        atlasBoxUVs(geo, TOWER_ATLAS.REGIONS);
      } else {
        // Scale each face's UVs by its real-world size so a window is the same
        // physical size on a 9 m low-rise and a 90 m tower.
        const key = b.kind === 'tower' ? 'towerShared' : `${b.kind}${n % 2 === 0 ? 'A' : 'B'}`;
        material = tier1[key];
        scaleBoxUVs(geo, b.w, b.h, b.d, FACADE_TILE_M);
      }

      const mesh = new THREE.Mesh(geo, material);
      mesh.name = `building_${b.kind}_${i}`;
      // Box geometry is centred on its origin, so lift it by half its height to
      // stand it on the ground plane.
      mesh.position.set(b.x, b.h / 2, b.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);

      // Register the colliders. Built from the authored numbers rather than from
      // `setFromObject(mesh)` so the collision world never depends on the mesh's
      // world matrix having been updated first — a classic source of
      // off-by-one-frame collider drift.
      this.collision.addBuilding(
        new THREE.Box3(
          new THREE.Vector3(b.x - b.w / 2, 0, b.z - b.d / 2),
          new THREE.Vector3(b.x + b.w / 2, b.h, b.z + b.d / 2),
        ),
      );
      // FOUR more boxes, one per bar of the G1 parapet ring, so the coping is
      // solid instead of something the hero walks through.
      //
      // This replaced a single slab-shaped box, and the ring is better in a way
      // worth recording. The slab covered the whole roof, so landing put the
      // hero on top of a lid at b.h + 0.45 and the true roof was unreachable —
      // and the slab's edge acted as a wall against the 0.3 m of un-raised lip
      // outside it, which nudged anyone standing there off the building. With a
      // ring the hero lands on the roof itself, the lip case disappears
      // entirely, and the coping becomes a low wall at the edge that stops you
      // walking off — which is what a real parapet is for.
      for (const box of parapetBoxes(b)) this.collision.addBuilding(box);
    }
  }

  /**
   * Build one repeat-tiled facade material: a diffuse canvas plus a roughness
   * and a metalness canvas.
   *
   * WHY THREE CANVASES AND `roughness: 1.0 / metalness: 1.0`. Three.js
   * multiplies `material.roughness × roughnessMap.g` and
   * `material.metalness × metalnessMap.b` — roughnessMap reads the GREEN
   * channel, metalnessMap reads BLUE (the glTF ORM convention, so one packed
   * texture can serve both). These are separate neutral-grey canvases here, so
   * every channel carries the same value and which one is sampled is moot — but
   * do NOT assume `.g` for metalness if these are ever packed into one texture.
   * Setting the scalars to 1.0 lets the maps carry 100% of the per-pixel value.
   *
   * @param {keyof typeof FACADE_VARIANTS} variant
   * @returns {THREE.MeshStandardMaterial}
   */
  _makeFacadeMaterial(variant) {
    const spec = FACADE_VARIANTS[variant];
    const size = 512; // up from 256: free in draw-call terms, ~1 MB per canvas
    const diffuse = makeContext(size, size);
    const rough = makeContext(size, size);
    const metal = makeContext(size, size);

    // Base fills.
    fillAll(diffuse, `#${hex6(spec.wall)}`, size, size);
    fillAll(rough, grey(spec.wallRough), size, size);
    fillAll(metal, grey(spec.wallMetal), size, size);

    // CANVAS-Y DIRECTION, stated explicitly because this file has been bitten by
    // comments that asserted the opposite of the arithmetic:
    //   CanvasTexture defaults to flipY = true, so UV v = 0 samples the canvas's
    //   BOTTOM row and v = 1 samples its TOP row. Combined with BoxGeometry's
    //   side faces (v = 1 at the box's top, v = 0 at its base — verified in
    //   BoxGeometry.js's buildPlane, which passes vdir = -1 for all four sides),
    //   SMALL canvas y is HIGH on the building and LARGE canvas y is low on it.
    // Therefore the plinth band, which must sit at the BOTTOM of each tile, is
    // drawn at the BOTTOM of the canvas.
    const bandH = Math.floor(size * 0.12);
    const bandY = size - bandH;
    const usableH = size - bandH;

    const rows = spec.columns;
    const cellW = size / spec.columns;
    const cellH = usableH / rows;
    const winW = cellW * 0.62;
    const winH = cellH * 0.55;
    // Frame width scales with resolution so the bevel keeps its proportions if
    // `size` ever changes. U and V pixel density are equal on a repeat tile
    // (both axes span FACADE_TILE_M), so one width serves both directions.
    const frame = Math.max(1, Math.round(size / 128));

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < spec.columns; c++) {
        const x = c * cellW + (cellW - winW) / 2;
        const y = r * cellH + (cellH - winH) / 2;
        // Slight per-window brightness variation so the grid does not read as a
        // perfect checkerboard. Deterministic: a hash of the cell coordinates,
        // never Math.random(), so the texture is identical on every load and a
        // screenshot diff stays meaningful. Range widened from 0.75–1.25 to
        // 0.65–1.35 so some panes clearly catch more sun than others.
        const t = ((r * 73856093) ^ (c * 19349663)) >>> 0;
        const jitter = 0.65 + ((t % 100) / 100) * 0.7;
        paintWindowCell(
          { diffuse, rough, metal },
          x,
          y,
          winW,
          winH,
          spec,
          jitter,
          frame,
          frame,
        );
      }
    }

    // Solid plinth band across the bottom of the tile. It reads as a floor-slab
    // edge when the texture tiles up a facade, AND it is where the roof faces'
    // UVs are pointed (see scaleBoxUVs) so rooftops get flat neutral roofing
    // instead of a nonsensical grid of windows — without needing a second
    // material and the extra draw call per building that would cost.
    //
    // The band colour is now an INDEPENDENT roof/spandrel neutral rather than
    // `shade(wallColor, 0.82)`. Tinting a rooftop with its own facade's hue is
    // physically backwards: real built-up roofing and rooftop gravel is a
    // neutral grey-brown whatever colour the wall below it is painted.
    fillRect(diffuse, `#${hex6(spec.band)}`, 0, bandY, size, bandH);
    fillRect(rough, grey(BAND_ROUGH), 0, bandY, size, bandH);
    fillRect(metal, grey(BAND_METAL), 0, bandY, size, bandH);

    const map = this._registerTexture(diffuse.canvas, {
      repeat: true,
      srgb: true,
    });
    const roughnessMap = this._registerTexture(rough.canvas, { repeat: true, srgb: false });
    const metalnessMap = this._registerTexture(metal.canvas, { repeat: true, srgb: false });

    const material = new THREE.MeshStandardMaterial({
      map,
      roughnessMap,
      metalnessMap,
      roughness: 1,
      metalness: 1,
    });
    this._disposables.push(material);
    return material;
  }

  /**
   * Build the one bespoke, non-repeating material for BESPOKE_TOWER_INDEX.
   *
   * Still one mesh and one draw call — it REPLACES the shared-tower material on
   * that mesh rather than adding anything. The only cost is texture memory and a
   * few milliseconds of canvas fill at construction.
   *
   * @param {{w:number,d:number,h:number}} b the authored building record
   * @returns {THREE.MeshStandardMaterial}
   */
  _makeBespokeTowerMaterial(b) {
    const S = TOWER_ATLAS.SIZE;
    const diffuse = makeContext(S, S);
    const rough = makeContext(S, S);
    const metal = makeContext(S, S);
    const ctxs = { diffuse, rough, metal };
    const spec = FACADE_VARIANTS.towerShared;

    // Region pixel rectangles. Derived from the UV regions with the SAME flipY
    // convention as above: canvasY = (1 - v) × SIZE, so v ∈ [0, 0.75] (the
    // building's full height) is the canvas's LOWER 768 rows and v ∈ [0.75, 1]
    // (the roof) is its TOP 256 rows.
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
    this._paintFacadeRegion(ctxs, spec, {
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
    this._paintFacadeRegion(ctxs, spec, {
      x: halfW,
      y: facadeTop,
      w: halfW,
      h: facadeH,
      columns: colsB,
      floors,
      metresW: b.d,
      metresH: b.h,
    });
    // Region C — the roof plan.
    this._paintRoofRegion(ctxs, { x: 0, y: 0, w: S, h: facadeTop, metresW: b.w, metresD: b.d });

    const map = this._registerTexture(diffuse.canvas, { repeat: false, srgb: true });
    const roughnessMap = this._registerTexture(rough.canvas, { repeat: false, srgb: false });
    const metalnessMap = this._registerTexture(metal.canvas, { repeat: false, srgb: false });

    const material = new THREE.MeshStandardMaterial({
      map,
      roughnessMap,
      metalnessMap,
      roughness: 1,
      metalness: 1,
    });
    this._disposables.push(material);
    return material;
  }

  /**
   * Paint one facade region of the bespoke atlas: a real floor × bay window grid
   * plus structural spandrel bands.
   *
   * @param {{diffuse:CanvasRenderingContext2D,rough:CanvasRenderingContext2D,metal:CanvasRenderingContext2D}} ctxs
   * @param {typeof FACADE_VARIANTS.towerShared} spec
   * @param {{x:number,y:number,w:number,h:number,columns:number,floors:number,metresW:number,metresH:number}} r
   */
  _paintFacadeRegion(ctxs, spec, r) {
    const cellW = r.w / r.columns;
    const rowH = r.h / r.floors;
    const winW = cellW * 0.66;
    const winH = rowH * 0.58;

    // ASPECT COMPENSATION, horizontal vs vertical. This region is 512 px over
    // metresW but 768 px over 90 m, so a pixel is not square in world space. The
    // window CELLS are safe (they come from real column/floor counts), but a
    // bevel measured in pixels would not be: express it in metres and convert
    // per axis, or the top/bottom bevels come out several times thicker than the
    // left/right ones.
    const pxPerM_U = r.w / r.metresW;
    const pxPerM_V = r.h / r.metresH;
    const BEVEL_M = 0.1;
    const frameU = Math.max(1, Math.round(BEVEL_M * pxPerM_U));
    const frameV = Math.max(1, Math.round(BEVEL_M * pxPerM_V));

    for (let floor = 0; floor < r.floors; floor++) {
      // Floor 0 is the GROUND floor. Canvas y grows downward while the building
      // grows upward (flipY, see _makeFacadeMaterial), so floor 0 is the region's
      // BOTTOM row.
      const rowY = r.y + r.h - (floor + 1) * rowH;

      // Structural spandrel band every 4th floor. Without it, 23 identical floor
      // rows read as an undifferentiated grid over the full 90 m.
      if (floor > 0 && floor % 4 === 0) {
        fillRect(ctxs.diffuse, `#${hex6(spec.band)}`, r.x, rowY, r.w, rowH);
        fillRect(ctxs.rough, grey(BAND_ROUGH), r.x, rowY, r.w, rowH);
        fillRect(ctxs.metal, grey(BAND_METAL), r.x, rowY, r.w, rowH);
        continue;
      }

      for (let c = 0; c < r.columns; c++) {
        const x = r.x + c * cellW + (cellW - winW) / 2;
        const y = rowY + (rowH - winH) / 2;
        const t = ((floor * 73856093) ^ (c * 19349663)) >>> 0;
        const jitter = 0.65 + ((t % 100) / 100) * 0.7;
        paintWindowCell(ctxs, x, y, winW, winH, spec, jitter, frameU, frameV);
      }
    }
  }

  /**
   * Paint the roof plan region of the bespoke atlas: tar and gravel, a
   * deterministic speckle, and a painted helipad.
   *
   * THE ASPECT PROBLEM, and why the ctx.scale below is not optional. This region
   * is 1024 px wide over the roof's 20 m X extent (51.2 px/m) but only 256 px
   * tall over its 28 m Z extent (9.14 px/m) — a 5.6× mismatch, because a
   * 1024×256 px region does not share the aspect ratio of a 20×28 m footprint.
   * (BoxGeometry's +Y face binds U to the box's X and V to its Z:
   * `buildPlane('x','z','y', 1, 1, width, depth, height, ...)`.) A circle drawn
   * with equal x/y radii here would land on the real roof as an ellipse 5.6×
   * longer along Z than along X. Squashing V by (256/28)/(1024/20) = 0.17857
   * before drawing makes it a true circle in world space.
   *
   * @param {{diffuse:CanvasRenderingContext2D,rough:CanvasRenderingContext2D,metal:CanvasRenderingContext2D}} ctxs
   * @param {{x:number,y:number,w:number,h:number,metresW:number,metresD:number}} r
   */
  _paintRoofRegion(ctxs, r) {
    const { diffuse, rough, metal } = ctxs;

    fillRect(diffuse, `#${hex6(TOWER_ATLAS.ROOF_BASE)}`, r.x, r.y, r.w, r.h);
    fillRect(rough, grey(0.95), r.x, r.y, r.w, r.h); // tar and gravel: matte
    fillRect(metal, grey(0.0), r.x, r.y, r.w, r.h);

    const pxPerM_U = r.w / r.metresW; // 1024 / 20 = 51.2
    const pxPerM_V = r.h / r.metresD; // 256 / 28 = 9.142857
    const vSquash = pxPerM_V / pxPerM_U; // 0.178571...

    // Gravel speckle. Sized in metres and converted per axis so the flecks stay
    // roughly square once the 5.6× density mismatch is accounted for; a literal
    // 3×3 px dot would land on the roof as a 6 cm × 33 cm streak.
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

  /**
   * Turn a canvas into a CanvasTexture with the project's standard settings and
   * register it for disposal.
   *
   * COLOUR SPACE IS NOT COSMETIC HERE. The diffuse map holds authored sRGB
   * colour and must be tagged sRGB so the renderer linearises it. The roughness
   * and metalness maps hold raw LINEAR data — a byte of 128 means "0.5
   * roughness", not "mid grey" — and tagging them sRGB would silently apply a
   * gamma curve to the material's PBR inputs.
   *
   * @param {HTMLCanvasElement} canvas
   * @param {{repeat:boolean, srgb:boolean}} options
   */
  _registerTexture(canvas, { repeat, srgb }) {
    const texture = new THREE.CanvasTexture(canvas);
    const wrap = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
    texture.wrapS = wrap;
    texture.wrapT = wrap;
    texture.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    // 8× anisotropy: window rhythm stays legible at the grazing angles you get
    // flying alongside a tower, which is most of what the player does with these
    // facades. Cheap; 16 would still be overkill for Phase 1.
    texture.anisotropy = 8;
    this._disposables.push(texture);
    return texture;
  }

  // ---------------------------------------------------------- roof furniture

  /**
   * G1 — the parapet coping cap on every roof. ONE draw call for all ten.
   *
   * The matching collision boxes are registered in `_buildBuildings` rather than
   * here, so that every collider this class creates is registered in one place.
   */
  _buildParapets() {
    const geo = new THREE.BoxGeometry(1, 1, 1); // unit cube, scaled per instance
    const mat = new THREE.MeshStandardMaterial({
      color: PARAPET.COLOR,
      roughness: 0.6,
      metalness: 0.2,
    });
    // Still ONE draw call: an InstancedMesh costs the same whether it draws ten
    // instances or forty. The ring is free relative to the slab it replaced.
    const mesh = new THREE.InstancedMesh(
      geo,
      mat,
      BLOCK.buildings.length * PARAPET.BARS,
    );
    mesh.name = 'roofParapets';
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const m = new THREE.Object3D();
    let i = 0;
    for (const b of BLOCK.buildings) {
      for (const bar of parapetBars(b)) {
        m.position.set(bar.cx, bar.cy, bar.cz);
        m.rotation.set(0, 0, 0);
        m.scale.set(bar.sx, bar.sy, bar.sz);
        m.updateMatrix();
        mesh.setMatrixAt(i++, m.matrix);
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    this.group.add(mesh);
  }

  /**
   * G2 — rooftop mechanical units. ONE draw call for all 22.
   *
   * DELIBERATE DECISION, flagged by the Review as the Engineer's call: these ARE
   * registered as colliders. A player who can land on a roof (criterion 20) can
   * walk into one, and walking through a condenser unit is exactly the
   * game-world tell this pass exists to remove. The cost is 22 more AABBs in a
   * linear scan of ~40 — nothing — and they sit 8 m or more up, so they can
   * never interfere with street-level movement or pull the camera arm in.
   */
  _buildRoofUnits() {
    const units = hvacUnits();
    const geo = new THREE.BoxGeometry(HVAC.W, HVAC.H, HVAC.D);
    const mat = new THREE.MeshStandardMaterial({
      color: HVAC.COLOR,
      roughness: 0.5,
      metalness: 0.4,
    });
    const mesh = new THREE.InstancedMesh(geo, mat, units.length);
    mesh.name = 'roofUnits';
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const m = new THREE.Object3D();
    for (let i = 0; i < units.length; i++) {
      const u = units[i];
      // `u.y` is the unit's BASE (it rests on the roof surface itself), so
      // the mesh centre is half a box-height above it.
      m.position.set(u.x, u.y + HVAC.H / 2, u.z);
      m.rotation.set(0, 0, 0);
      m.scale.set(1, 1, 1);
      m.updateMatrix();
      mesh.setMatrixAt(i, m.matrix);

      this.collision.addBuilding(
        new THREE.Box3(
          new THREE.Vector3(u.x - HVAC.W / 2, u.y, u.z - HVAC.D / 2),
          new THREE.Vector3(u.x + HVAC.W / 2, u.y + HVAC.H, u.z + HVAC.D / 2),
        ),
      );
    }
    mesh.instanceMatrix.needsUpdate = true;
    this.group.add(mesh);
  }

  // ------------------------------------------------------- street furniture

  /**
   * G3 — ground-floor storefront awnings on the eight low/mid-rise buildings.
   * ONE draw call.
   *
   * NOT COLLIDERS, deliberately. Their underside sits at ~2.96 m at the leading
   * edge, well clear of the 1.85 m hero, so they can only ever be walked under.
   * Registering them would also feed them to the camera's spring-arm sphere-cast,
   * which would yank the camera in every time the player walked past a storefront
   * — strictly worse than the nothing it would fix.
   */
  _buildAwnings() {
    const indices = [];
    for (let i = 0; i < BLOCK.buildings.length; i++) {
      if (BLOCK.buildings[i].kind !== 'tower') indices.push(i);
    }

    // Real thickness and projection are baked into the geometry; only the width
    // axis is scaled per instance, so the canopy's depth over the sidewalk is
    // identical on every building regardless of how wide the shopfront is.
    const geo = new THREE.BoxGeometry(1, AWNING.THICKNESS, AWNING.PROJECTION);
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0.0 });
    const mesh = new THREE.InstancedMesh(geo, mat, indices.length);
    mesh.name = 'awnings';
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const m = new THREE.Object3D();
    const color = new THREE.Color();
    for (let k = 0; k < indices.length; k++) {
      const i = indices[k];
      const b = BLOCK.buildings[i];
      // `outward` is +1 for buildings SOUTH of the boulevard (b.z < 0, whose
      // street frontage faces +Z) and -1 for those NORTH of it (b.z > 0, facing
      // -Z). Every sign below is derived from it, so there is one place to be
      // wrong rather than four.
      const outward = b.z > 0 ? -1 : 1;
      const facadeZ = b.z + outward * (b.d / 2);

      m.position.set(b.x, AWNING.Y, facadeZ + outward * (AWNING.PROJECTION / 2));
      // Rotating by θ about X sends a point at local +z to y = -z·sin θ. The
      // canopy's LEADING edge is at local z = outward × PROJECTION/2, and we
      // want it to drop, so θ must take the sign of `outward`.
      m.rotation.set(outward * AWNING.TILT, 0, 0);
      m.scale.set(b.w * AWNING.WIDTH_FRACTION, 1, 1);
      m.updateMatrix();
      mesh.setMatrixAt(k, m.matrix);

      // Cycled by the building's index in BLOCK.buildings, not by its position in
      // this filtered list, so a given building keeps its colour if the filter
      // ever changes.
      color.setHex(AWNING.FABRIC[i % AWNING.FABRIC.length]);
      mesh.setColorAt(k, color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    this.group.add(mesh);
  }

  /**
   * G4 — vertical blade signs on the four mid-rises. ONE draw call.
   *
   * Silhouette only: no text, no graphics, no emissive. Phase 1's lighting is
   * static midday and a sign glowing at noon reads as a bug, not a light. Not
   * colliders, for the same reasons as the awnings.
   */
  _buildBladeSigns() {
    const indices = [];
    for (let i = 0; i < BLOCK.buildings.length; i++) {
      if (BLOCK.buildings[i].kind === 'midrise') indices.push(i);
    }

    const geo = new THREE.BoxGeometry(BLADE.W, BLADE.H, BLADE.D);
    const mat = new THREE.MeshStandardMaterial({
      color: BLADE.COLOR,
      roughness: 0.6,
      metalness: 0.3,
    });
    const mesh = new THREE.InstancedMesh(geo, mat, indices.length);
    mesh.name = 'bladeSigns';
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const m = new THREE.Object3D();
    for (let k = 0; k < indices.length; k++) {
      const b = BLOCK.buildings[indices[k]];
      const outward = b.z > 0 ? -1 : 1; // see _buildAwnings for the convention
      const facadeZ = b.z + outward * (b.d / 2);
      // Alternate which corner the sign hangs off, so four signs do not line up
      // on the same side of every building.
      const side = k % 2 === 0 ? -1 : 1;

      m.position.set(
        b.x + side * (b.w / 2 - BLADE.CORNER_INSET),
        BLADE.Y,
        facadeZ + outward * BLADE.STANDOFF,
      );
      m.rotation.set(0, 0, 0);
      m.scale.set(1, 1, 1);
      m.updateMatrix();
      mesh.setMatrixAt(k, m.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    this.group.add(mesh);
  }

  // ------------------------------------------------------------ palms, lamps

  /**
   * Washingtonia robusta palms along both parkways.
   *
   * INSTANCED EVEN AT THIS COUNT, DELIBERATELY. Individual meshes would be a
   * perfectly fine 50 draw calls here, but Phase 2's Instancing.js is built on
   * exactly this pattern and a per-mesh implementation would have to be thrown
   * away. Establishing it now costs nothing.
   */
  _buildPalms() {
    const positions = [];
    for (let x = -BLOCK.palmRange; x <= BLOCK.palmRange; x += BLOCK.palmSpacing) {
      positions.push([x, STREET.PARKWAY_Z]);
      positions.push([x, -STREET.PARKWAY_Z]);
    }
    const count = positions.length;

    // Unit-height trunk, scaled per instance. Tapered: robusta trunks are
    // noticeably narrower at the crown.
    const trunkGeo = new THREE.CylinderGeometry(0.18, 0.3, 1, 7, 1);
    trunkGeo.translate(0, 0.5, 0); // origin at the base, so scaling grows upward
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8a7963, roughness: 1 });
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
    trunks.name = 'palmTrunks';
    trunks.castShadow = true;
    trunks.receiveShadow = true;

    // Crown: a squashed low-poly sphere. Not botanically detailed, but the
    // silhouette — bare stick with a small tuft on top — is what makes it read
    // as a fan palm at gameplay distance.
    const crownGeo = new THREE.IcosahedronGeometry(1, 0);
    crownGeo.scale(1, 0.45, 1);
    const crownMat = new THREE.MeshStandardMaterial({ color: 0x4c6b39, roughness: 0.95, flatShading: true });
    const crowns = new THREE.InstancedMesh(crownGeo, crownMat, count);
    crowns.name = 'palmCrowns';
    crowns.castShadow = true;

    const m = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      const [x, z] = positions[i];
      // Deterministic variation: same layout on every load, but not a uniform
      // row of clones. 12–18 m per the brief.
      const h = 12 + hash01(i * 2654435761) * 6;
      const lean = (hash01(i * 40503) - 0.5) * 0.08;

      m.position.set(x, 0, z);
      m.rotation.set(lean, hash01(i * 97) * Math.PI * 2, lean * 0.5);
      m.scale.set(1, h, 1);
      m.updateMatrix();
      trunks.setMatrixAt(i, m.matrix);

      m.position.set(x + lean * h * 0.5, h, z);
      m.rotation.set(0, hash01(i * 31) * Math.PI * 2, 0);
      const crownR = 1.9 + hash01(i * 7919) * 0.7;
      m.scale.set(crownR, crownR, crownR);
      m.updateMatrix();
      crowns.setMatrixAt(i, m.matrix);
    }
    trunks.instanceMatrix.needsUpdate = true;
    crowns.instanceMatrix.needsUpdate = true;

    this.group.add(trunks);
    this.group.add(crowns);
  }

  /** Street lamps, set back on the sidewalk. Instanced for the same reason as palms. */
  _buildLamps() {
    const positions = [];
    for (let x = -BLOCK.lampRange; x <= BLOCK.lampRange; x += BLOCK.lampSpacing) {
      positions.push([x, STREET.LAMP_Z]);
      positions.push([x, -STREET.LAMP_Z]);
    }
    const count = positions.length;
    const postH = 7.5;

    const postGeo = new THREE.CylinderGeometry(0.09, 0.13, postH, 6, 1);
    postGeo.translate(0, postH / 2, 0);
    const metalMat = new THREE.MeshStandardMaterial({
      color: 0x3a3f45,
      roughness: 0.5,
      metalness: 0.7,
    });
    const posts = new THREE.InstancedMesh(postGeo, metalMat, count);
    posts.name = 'lampPosts';
    posts.castShadow = true;

    // Lamp head. Emissive only — NO PointLight. Phase 1's lighting is static
    // midday; adding 22 real lights would cost far more than it shows.
    const headGeo = new THREE.BoxGeometry(1.1, 0.22, 0.4);
    const headMat = new THREE.MeshStandardMaterial({
      color: 0x6a6f76,
      emissive: 0x1a1c1f,
      roughness: 0.4,
      metalness: 0.6,
    });
    const heads = new THREE.InstancedMesh(headGeo, headMat, count);
    heads.name = 'lampHeads';
    heads.castShadow = true;

    const m = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      const [x, z] = positions[i];
      // Heads overhang toward the roadway, i.e. toward z = 0.
      const inward = z > 0 ? -1 : 1;

      m.position.set(x, 0, z);
      m.rotation.set(0, 0, 0);
      m.scale.set(1, 1, 1);
      m.updateMatrix();
      posts.setMatrixAt(i, m.matrix);

      m.position.set(x, postH - 0.2, z + inward * 0.5);
      m.rotation.set(0, Math.PI / 2, 0);
      m.updateMatrix();
      heads.setMatrixAt(i, m.matrix);
    }
    posts.instanceMatrix.needsUpdate = true;
    heads.instanceMatrix.needsUpdate = true;

    this.group.add(posts);
    this.group.add(heads);
  }

  /**
   * Free every GPU resource this block created.
   *
   * Two passes on purpose: `disposeObject3D` reaches everything attached to the
   * scene graph, and `_disposables` covers the CanvasTextures and shared
   * materials that are referenced by several meshes (traversal would visit them
   * repeatedly, which is harmless, but a shared resource whose last mesh was
   * already detached would be missed entirely).
   *
   * The realism pass tripled the texture count — every facade material now owns a
   * diffuse, a roughness AND a metalness CanvasTexture — which is exactly the
   * kind of growth that turns a missed dispose into a visible leak across an
   * afternoon of HMR reloads. All three are registered by `_registerTexture`.
   */
  dispose() {
    disposeObject3D(this.group);
    for (const d of this._disposables) d.dispose();
    this._disposables.length = 0;
    this.scene.remove(this.group);
    this.collision.clearBuildings();
  }
}

/**
 * The four bars of the G1 parapet ring for one authored building, as
 * centre-and-scale records ready for an InstancedMesh.
 *
 * Exported and pure so the roof-landing behaviour that acceptance criterion 20
 * depends on can be tested headlessly, without a canvas or a WebGL context.
 *
 * @param {{x:number,z:number,w:number,d:number,h:number}} b
 * @returns {THREE.Box3}
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
 * The G1 parapet ring's collision boxes for one authored building — one per bar.
 *
 * Exported and pure so the roof-landing behaviour acceptance criterion 20
 * depends on can be tested headlessly, without a canvas or a WebGL context.
 *
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
 * This is now the ROOF ITSELF (`b.h`), not the top of a parapet slab. When the
 * coping became a ring the lid came off, so the hero lands on the real roof —
 * which is also what makes the painted helipad something you land ON rather
 * than something buried under 0.45 m of concrete.
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
export function hvacUnits(buildings = BLOCK.buildings) {
  /** @type {Array<{x:number,y:number,z:number}>} */
  const units = [];

  for (let i = 0; i < buildings.length; i++) {
    const b = buildings[i];
    const y = roofTopY(b);

    if (b.kind === 'tower') {
      // FIXED, not hashed. On the bespoke tower these must stay clear of the
      // painted helipad at the roof centre, and a hash that happened to land one
      // on the "H" would be a bug nobody could reproduce from the source.
      // +X / -Z corner: 0.32 of the half-extent out from centre on each axis.
      const bx = b.x + b.w * 0.32;
      const bz = b.z - b.d * 0.32;
      units.push({ x: bx, y, z: bz });
      units.push({ x: bx - 1.5, y, z: bz });
      units.push({ x: bx, y, z: bz + 1.5 });
    } else {
      // Scattered within the roof area inside the coping. `- 3` keeps a 1.5 m margin
      // on each side so a 1.2 m box never overhangs the coping.
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
 * Scale a BoxGeometry's per-face UVs so the texture tiles at a constant
 * real-world size regardless of the box's dimensions, and point the roof/floor
 * faces at the texture's plain plinth band.
 *
 * BoxGeometry emits six 4-vertex faces in a fixed order — +X, -X, +Y, -Y, +Z,
 * -Z — each with UVs spanning 0..1. For the four side faces we multiply those
 * UVs by (faceWidth/tile, faceHeight/tile) so a taller building simply gets more
 * window rows instead of stretched ones. The two horizontal faces are collapsed
 * onto a single point inside the plain band, which gives flat rooftops without
 * needing a second material (and therefore without the extra draw call per
 * building that a material array would cost — 10 buildings × 6 groups = 60 draw
 * calls would blow acceptance criterion 6 on its own).
 *
 * THE SAMPLE POINT IS v = 0.06, AND THAT IS THE BOTTOM OF THE TILE. With
 * CanvasTexture's default flipY = true, v = 0 samples the canvas's BOTTOM row —
 * which is where `_makeFacadeMaterial` paints the roof/spandrel band. Do not
 * "fix" this to 0.94 without moving the band too.
 *
 * @param {THREE.BoxGeometry} geo
 * @param {number} w size on X
 * @param {number} h size on Y
 * @param {number} d size on Z
 * @param {number} tile metres per texture tile
 */
export function scaleBoxUVs(geo, w, h, d, tile) {
  const uv = geo.attributes.uv;
  // [uScale, vScale] per face, in BoxGeometry's face order.
  const faces = [
    [d / tile, h / tile], // +X
    [d / tile, h / tile], // -X
    null, // +Y (roof)
    null, // -Y (underside)
    [w / tile, h / tile], // +Z
    [w / tile, h / tile], // -Z
  ];

  for (let face = 0; face < 6; face++) {
    const scale = faces[face];
    for (let v = 0; v < 4; v++) {
      const i = face * 4 + v;
      if (!scale) {
        // Plain plinth band: the bottom 12% of the tile, sampled well inside it.
        uv.setXY(i, 0.5, 0.06);
      } else {
        uv.setXY(i, uv.getX(i) * scale[0], uv.getY(i) * scale[1]);
      }
    }
  }
  uv.needsUpdate = true;
}

/**
 * Remap a BoxGeometry's per-face UVs into sub-rectangles of a single
 * non-repeating atlas — the alternative to `scaleBoxUVs` for the one building
 * whose roof carries unique art.
 *
 * Every face gets the SAME linear remap with no per-face flip:
 *   newU = uMin + u × (uMax − uMin),  newV = vMin + v × (vMax − vMin)
 * That uniformity is what makes the floor lines meet at the corners. It is safe
 * because BoxGeometry gives all four side faces the same vertical convention:
 * `buildPlane` is called with vdir = -1 and v bound to the world Y axis for
 * +X, -X, +Z and -Z alike, putting UV v = 1 at the box's TOP and v = 0 at its
 * BASE on every one of them.
 *
 * @param {THREE.BoxGeometry} geo
 * @param {ReadonlyArray<readonly [number, number, number, number]>} regions
 *   Six [uMin, uMax, vMin, vMax] entries, in BoxGeometry's face order.
 */
export function atlasBoxUVs(geo, regions) {
  const uv = geo.attributes.uv;

  for (let face = 0; face < 6; face++) {
    const [uMin, uMax, vMin, vMax] = regions[face];
    const uSpan = uMax - uMin;
    const vSpan = vMax - vMin;
    for (let v = 0; v < 4; v++) {
      const i = face * 4 + v;
      uv.setXY(i, uMin + uv.getX(i) * uSpan, vMin + uv.getY(i) * vSpan);
    }
  }
  uv.needsUpdate = true;
}

// --------------------------------------------------------------- canvas util

/**
 * Paint one window pane into the diffuse, roughness and metalness canvases at
 * once.
 *
 * The diffuse bevel is the single highest-return addition in this pass: four
 * thin edge strokes are what turn a flat rectangle into something that reads as
 * inset glazing. Draw order is base, top, left, bottom, right, so corners
 * resolve to whichever of highlight/shadow was drawn last and the bottom-right
 * corner comes out as shadow — correct for an overhead sun.
 *
 * DIRECTION, stated explicitly: canvas y = 0 is the TOP of the canvas, and with
 * flipY the top of the canvas is HIGH on the building. So the strip at the
 * smallest y really is the geometric top of the pane, and really is the
 * highlight.
 *
 * @param {{diffuse:CanvasRenderingContext2D,rough:CanvasRenderingContext2D,metal:CanvasRenderingContext2D}} ctxs
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {{window:number,winRough:number,winMetal:number}} spec
 * @param {number} jitter per-pane brightness multiplier
 * @param {number} frameU frame thickness on the horizontal axis, px
 * @param {number} frameV frame thickness on the vertical axis, px
 */
function paintWindowCell(ctxs, x, y, w, h, spec, jitter, frameU, frameV) {
  const { diffuse, rough, metal } = ctxs;

  const glass = shade(spec.window, jitter);
  const hi = shade(spec.window, Math.min(1.8, jitter * 1.6));
  const lo = shade(spec.window, jitter * 0.45);

  fillRect(diffuse, glass, x, y, w, h);
  fillRect(diffuse, hi, x, y, w, frameV); // top edge: light catches the frame
  fillRect(diffuse, hi, x, y, frameU, h); // left edge
  fillRect(diffuse, lo, x, y + h - frameV, w, frameV); // bottom: lintel shadow
  fillRect(diffuse, lo, x + w - frameU, y, frameU, h); // right edge

  // PBR side: the pane is glass, the frame around it is anodised aluminium.
  fillRect(rough, grey(spec.winRough), x, y, w, h);
  fillRect(metal, grey(spec.winMetal), x, y, w, h);
  for (const [ctx, value] of [
    [rough, FRAME_ROUGH],
    [metal, FRAME_METAL],
  ]) {
    const style = grey(value);
    fillRect(ctx, style, x, y, w, frameV);
    fillRect(ctx, style, x, y, frameU, h);
    fillRect(ctx, style, x, y + h - frameV, w, frameV);
    fillRect(ctx, style, x + w - frameU, y, frameU, h);
  }
}

/**
 * Allocate a 2D canvas context.
 * @param {number} w
 * @param {number} h
 * @returns {CanvasRenderingContext2D}
 */
function makeContext(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return canvas.getContext('2d');
}

/** @param {CanvasRenderingContext2D} ctx @param {string} style */
function fillAll(ctx, style, w, h) {
  fillRect(ctx, style, 0, 0, w, h);
}

/** @param {CanvasRenderingContext2D} ctx @param {string} style */
function fillRect(ctx, style, x, y, w, h) {
  ctx.fillStyle = style;
  ctx.fillRect(x, y, w, h);
}

/** Six-digit zero-padded hex, for a CSS colour string. @param {number} n */
function hex6(n) {
  return n.toString(16).padStart(6, '0');
}

/**
 * A neutral grey CSS colour carrying a LINEAR 0..1 material value.
 *
 * Roughness and metalness maps are data, not colour: the renderer reads the byte
 * straight through (their textures are tagged NoColorSpace), so 0.5 must be
 * written as byte 128 and not as an sRGB-encoded mid grey.
 *
 * @param {number} v
 */
function grey(v) {
  const c = Math.round(Math.max(0, Math.min(1, v)) * 255);
  return `rgb(${c},${c},${c})`;
}

/**
 * Deterministic hash → [0, 1). Used instead of Math.random() so the block is
 * byte-identical on every load; a world that reshuffles itself between reloads
 * makes visual regressions impossible to spot.
 * @param {number} n
 */
function hash01(n) {
  let x = (n ^ 0x9e3779b9) >>> 0;
  x = Math.imul(x ^ (x >>> 15), 0x85ebca6b) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0;
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

/**
 * Multiply a hex colour's channels by `k`, clamped, returned as a CSS string.
 * @param {number} hex
 * @param {number} k
 */
function shade(hex, k) {
  const r = Math.min(255, Math.round(((hex >> 16) & 0xff) * k));
  const g = Math.min(255, Math.round(((hex >> 8) & 0xff) * k));
  const b = Math.min(255, Math.round((hex & 0xff) * k));
  return `rgb(${r},${g},${b})`;
}

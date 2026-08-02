import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import {
  DISTRICT_HALF,
  HALF_ROADWAY,
  ROADWAY,
  ROW,
  SIDEWALK,
  STREET_LINES,
  buildingWorldBox,
} from './districts.js';
import { TOWER_ATLAS, atlasBoxUVs, makeBespokeTowerMaterial } from './annex.js';
import {
  FACADE_TILE_M,
  fillAll,
  fillRect,
  hash01,
  hex6,
  makeContext,
  makeFacadeMaterial,
  scaleBoxUVs,
} from './facadeAtlas.js';
import { FACADE_FAMILIES } from './facadeFamilies.js';
import { buildLandmark } from './landmarks.js';
import { disposeObject3D } from '../core/dispose.js';
import { massingBoxes } from './massing.js';

/**
 * District.js — builds one district's meshes from `districts.js`'s data.
 *
 * ===========================================================================
 * THE DRAW-CALL LEDGER FOR ONE DISTRICT, WHICH IS THE POINT OF THIS FILE
 * ===========================================================================
 *   ground                        1 main, 0 shadow
 *   roadway (merged, all streets) 1 main, 0 shadow
 *   sidewalk (merged, both sides) 1 main, 0 shadow
 *   curb (merged)                 1 main, 0 shadow
 *   facade families               1 main + 1 shadow EACH (3 in A, 4 in B)
 *   landmark                      1 main + 1 shadow
 *   ------------------------------------------------------------------------
 *   District A: 4 + 3 + 1 = 8 main, 3 + 1 = 4 shadow  -> 12 both passes
 *   District B: 4 + 4 + 1 = 9 main, 4 + 1 = 5 shadow  -> 14 both passes
 *   Both:                         17 main, 9 shadow   -> 26 both passes
 * That is exactly §BGT-1's ground/road (8) + facade families (14) + district
 * landmarks (4) lines. Nothing here is estimated; it is one mesh per row.
 *
 * ===========================================================================
 * THE `BUD-2` TRAP, AND HOW THIS FILE AVOIDS IT
 * ===========================================================================
 * Phase 1's `StreetBlock` builds SEVEN ground/road meshes for one 300 m block:
 * ground, roadway, 2 sidewalks, 2 curbs, and an instanced centreline. Repeating
 * that pattern per 256 m chunk across a district costs **7 × 64 = 448 draw calls
 * before a single building**, and `RESEARCH_PHASE_2_WORLD.md` §BUD-2 calls a
 * design that implies it "unshippable".
 *
 * So the surfaces here are merged PER SURFACE TYPE, PER DISTRICT — every
 * roadway strip in the district is one `BufferGeometry` in one `Mesh`, and the
 * same for sidewalks and curbs. Adding a street to the grid adds triangles, not
 * draw calls. The count is 4 per district and it does not move with district
 * size, street count, or any future chunk subdivision.
 *
 * THE CENTRELINE IS NOT A MESH AT ALL. Phase 1's seventh mesh is an
 * `InstancedMesh` of dashes; §6 folds lane markings into the roadway's own
 * `CanvasTexture`, so a painted stripe costs nothing the material was not
 * already paying for. That is the whole difference between §6's 8-call
 * ground/road line and `BUD-6`'s ~10–16 estimate.
 *
 * NONE OF THE FOUR SURFACES CASTS A SHADOW, which is not a new decision — it is
 * what Phase 1 already does (`ground.castShadow = false`; the roadway and curb
 * meshes never set it and `Mesh`'s default is false). It also happens to be the
 * right call for a reason Phase 1 did not have: a district-length curb is thin,
 * long, and certain to straddle CSM cascade boundaries once cascades exist,
 * which `DESIGN_BRIEF_PHASE_2_DISTRICTS.md` §ATM-3 names as the likeliest way to
 * reintroduce shadow acne. This code only has to not turn it back on.
 *
 * ===========================================================================
 * WHY `BatchedMesh` AND NOT ONE MESH PER BUILDING
 * ===========================================================================
 * 68 buildings as individual meshes is ~136 draw calls both passes, which
 * exhausts the 150 ceiling on buildings alone. Batching by facade MATERIAL
 * family drops it to 14. This is load-bearing, not polish (`BUD-3`).
 *
 * And it must be by material, because **`BatchedMesh` has no per-instance
 * material override** — verified against the installed three@0.185.1: the
 * constructor takes one `material` for the whole batch
 * (`BatchedMesh.js:192`), the per-geometry `geometryInfo` record has no
 * material-index field (`:632`), and the render path unconditionally reads
 * `_mesh.material = this.material` (`:1390`). That is also why the landmarks
 * cannot join a batch and cost their own `Mesh` each.
 *
 * ONE MORE THING WORTH KNOWING, because it is a silent 10× budget risk.
 * `WebGLRenderer` draws a `BatchedMesh` with `WEBGL_multi_draw` when the
 * extension is present (one real GL call, `info.render.calls += 1`) and
 * otherwise **falls back to a per-geometry loop of ordinary draws**
 * (`WebGLRenderer.js:1305–1319`), which would report ~170 calls instead of 7.
 * The extension is present in this project's browser — measured, not assumed —
 * but a machine without it would blow the budget with no code change at all.
 */

/** Metres. Sidewalk slab and curb relief, carried over from Phase 1 unchanged. */
const SIDEWALK_RELIEF = 0.03;
const CURB_RELIEF = 0.07;
/** Metres. Curb strip width. */
const CURB_W = 0.35;
/** Metres of roadway per texture tile — one dash + one gap, Phase 1's figures. */
const ROAD_TILE_M = 6;
/** Metres. Dash length inside that tile (the rest is gap). */
const ROAD_DASH_M = 2.4;

export class District {
  /**
   * @param {object} args
   * @param {THREE.Scene} args.scene
   * @param {import('./Collision.js').CollisionWorld} args.collision
   * @param {object} args.spec one entry of `DISTRICTS`
   */
  constructor({ scene, collision, spec }) {
    this.scene = scene;
    this.collision = collision;
    this.spec = spec;

    /**
     * TWO GROUPS, AND THE SPLIT IS LOAD-BEARING.
     *
     * `group` is world-aligned and holds only the ground plane, because the
     * ground is featureless — rotating it with the grid would buy nothing, and
     * sizing it to the district's own 300 m square would leave visible void
     * between the districts. Instead each district's ground covers its whole
     * half of the bounded world.
     *
     * `grid` carries the district's yaw (locked decision 10: 36° for District A,
     * cardinal for District B) and holds everything that belongs to the street
     * grid — roads, buildings, the landmark. One rotation, applied once, rather
     * than a yaw baked into every instance matrix.
     */
    this.group = new THREE.Group();
    this.group.name = spec.id;

    this.grid = new THREE.Group();
    this.grid.name = `${spec.id}_grid`;
    this.grid.position.set(spec.origin.x, 0, spec.origin.z);
    this.grid.rotation.y = spec.rotation;
    this.group.add(this.grid);

    /** @type {Array<{dispose:() => void}>} textures and materials this district owns. */
    this._disposables = [];

    this.buildings = spec.buildings();

    this._buildGround();
    this._buildRoads();
    this._buildFacadeBatches();
    this._buildBespokeBuildings();
    this._buildLandmark();

    scene.add(this.group);
  }

  /** Districts are static this run. Present so the update shape matches StreetBlock. */
  update(_dt) {}

  // ------------------------------------------------------------------ ground

  /**
   * ONE ground plane, world-aligned, covering this district's half of the world.
   *
   * It sits 1 cm below y = 0 so Phase 1's block ground (at exactly 0) wins the
   * depth test inside ±150 rather than z-fighting with it — the same 'separate
   * coplanar surfaces by a hair' trick the roadway already uses, applied to the
   * one place two authored worlds overlap.
   */
  _buildGround() {
    const g = this.spec.ground;
    const geo = new THREE.PlaneGeometry(g.w, g.d);
    geo.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({ color: g.color, roughness: 1 }),
    );
    mesh.name = `${this.spec.id}_ground`;
    mesh.position.set(g.cx, -0.01, g.cz);
    mesh.receiveShadow = true;
    mesh.castShadow = false; // §6, and Phase 1's own convention
    this.group.add(mesh);
    this._disposables.push(mesh.material);
  }

  // ------------------------------------------------------------------- roads

  /**
   * Three merged meshes for the whole district's street grid: roadway, sidewalk,
   * curb. See the `BUD-2` note in the class header for why this is the shape.
   */
  _buildRoads() {
    const roadway = [];
    const walks = [];
    const curbs = [];

    // Strips that run along local X (at each Z centre-line) and along local Z.
    // The roadway covers intersections; sidewalks and curbs are broken at them,
    // because a sidewalk slab laid across a roadway is a slab in the street.
    for (const line of STREET_LINES) {
      roadway.push(roadStrip('x', line, -DISTRICT_HALF, DISTRICT_HALF));
      for (const seg of segments('z', HALF_ROADWAY)) {
        roadway.push(roadStrip('z', line, seg[0], seg[1]));
      }
    }

    // ABSORBED ANNEX STREETS — locked decision 24. Phase 1's boulevard used to
    // be five separate meshes of its own (roadway, 2 sidewalks, 2 curbs) plus an
    // instanced centreline. Its strips are appended to the same three arrays as
    // the grid's, so they land in the same three merged geometries and cost
    // NOTHING: 6 meshes -> 0. The lane marking comes back from the shared
    // roadway texture, at Phase 1's exact 2.4 m dash / 3.6 m gap rhythm.
    const annexStreets = this.spec.annexStreets ?? [];
    for (const s of annexStreets) {
      roadway.push(roadStrip(s.axis, s.line, s.from, s.to));
    }

    // ⚠️ WALKS AND CURBS ARE BROKEN AT EVERY CROSSING, GRID *AND* ANNEX ALIKE.
    // Both are cut against ONE street list for a reason found by the session-11
    // code review: the grid used to be cut only at `STREET_LINES` and the annex
    // strips not at all, so decision 27's connector was crossed twice over —
    // once by its own boulevard's kerb at the T-junction, and once by District
    // B's grid sidewalk at each end, where `segments()` had no idea an annex
    // street existed. Two instances of one defect: a strip cut against a street
    // list that did not contain every street. Cutting everything against
    // `streets` makes that class of miss structurally impossible.
    const streets = [...gridStreets(), ...annexStreets];
    for (const s of streets) {
      for (const side of [1, -1]) {
        // Along X, break at the crossing's ROADWAY edge, so the corner square is
        // covered by this strip; along Z, break at the full RIGHT-OF-WAY, so the
        // two directions meet edge to edge instead of overlapping.
        const walkLine = s.line + side * walkOffset();
        const curbLine = s.line + side * curbOffset();
        for (const seg of crossings(s, walkLine, streets)) {
          walks.push(slab(s.axis, walkLine, seg, SIDEWALK, SIDEWALK_RELIEF));
        }
        for (const seg of crossings(s, curbLine, streets)) {
          curbs.push(slab(s.axis, curbLine, seg, CURB_W, CURB_RELIEF));
        }
      }
    }

    this._addMerged(roadway, `${this.spec.id}_roadway`, this._roadMaterial(), 0.02);
    this._addMerged(
      walks,
      `${this.spec.id}_sidewalk`,
      new THREE.MeshStandardMaterial({ color: 0xb0aca2, roughness: 0.9 }),
      0,
    );
    this._addMerged(
      curbs,
      `${this.spec.id}_curb`,
      new THREE.MeshStandardMaterial({ color: 0xd2cec4, roughness: 0.85 }),
      0,
    );
  }

  /**
   * @param {THREE.BufferGeometry[]} parts
   * @param {string} name
   * @param {THREE.Material} material
   * @param {number} y
   */
  _addMerged(parts, name, material, y) {
    const merged = mergeGeometries(parts);
    for (const p of parts) p.dispose();
    const mesh = new THREE.Mesh(merged, material);
    mesh.name = name;
    mesh.position.y = y;
    mesh.receiveShadow = true;
    mesh.castShadow = false; // §6: none of the four surfaces casts
    this.grid.add(mesh);
    this._disposables.push(material);
    return mesh;
  }

  /**
   * The roadway material, WITH THE LANE MARKING PAINTED INTO IT.
   *
   * This is §6's one real saving over `BUD-6`'s estimate: Phase 1 spends a whole
   * `InstancedMesh` on centreline dashes, and a stripe in the diffuse canvas
   * costs nothing the asphalt material was not already paying for. One tile is
   * ROAD_TILE_M metres of road carrying one 2.4 m dash and a 3.6 m gap —
   * Phase 1's exact dash rhythm, reproduced without the mesh.
   */
  _roadMaterial() {
    const S = 256;
    const ctx = makeContext(S, S);
    fillAll(ctx, `#${hex6(this.spec.roadColor)}`, S, S);

    // Deterministic asphalt speckle, so the surface is not a flat colour field
    // at the grazing angles most of the flying is done at.
    for (let i = 0; i < 900; i++) {
      const light = hash01(i * 668265263 + 3) < 0.5;
      fillRect(
        ctx,
        `#${hex6(light ? 0x4a4d54 : 0x33363c)}`,
        hash01(i * 2246822519) * S,
        hash01(i * 3266489917 + 7) * S,
        2,
        2,
      );
    }

    // The centreline dash. U runs along the road, V across it, so the dash is a
    // horizontal bar at mid-V occupying the first ROAD_DASH_M/ROAD_TILE_M of U.
    const halfThickness = Math.max(1, Math.round((0.16 / ROADWAY) * S) / 2);
    fillRect(
      ctx,
      '#e8d98a',
      0,
      S / 2 - halfThickness,
      (ROAD_DASH_M / ROAD_TILE_M) * S,
      halfThickness * 2,
    );

    const map = this._registerTexture(ctx.canvas, { repeat: true, srgb: true });
    const material = new THREE.MeshStandardMaterial({ map, roughness: 0.95 });
    return material;
  }

  // ---------------------------------------------------------------- buildings

  /**
   * One `BatchedMesh` per facade family: 1 main + 1 shadow call each, whatever
   * the building count.
   *
   * A building's boxes may land in DIFFERENT batches — MAS-2's podium goes into
   * the stone-clad family while its shafts go into the glass one — because a
   * batch is keyed by material, not by building. That is free: both batches
   * exist either way.
   */
  _buildFacadeBatches() {
    /** @type {Map<string, Array<{box:object, b:object}>>} */
    const perFamily = new Map();
    for (const id of this.spec.families) perFamily.set(id, []);

    for (const b of this.buildings) {
      // The annex's 90 m helipad tower opts OUT of batching: its non-repeating
      // roof atlas needs its own material and `BatchedMesh` has none per
      // instance. It is built by `_buildBespokeBuildings` below, at its own
      // +1 main / +1 shadow — exactly what it cost as a Phase 1 mesh.
      if (b.bespoke) continue;
      const boxes = massingBoxes(b.recipe, b);
      for (let i = 0; i < boxes.length; i++) {
        const family = i === 0 && b.podiumFamily ? b.podiumFamily : b.family;
        perFamily.get(family).push({ box: boxes[i], b });
      }
    }

    /** @type {Map<string, THREE.BatchedMesh>} */
    this.batches = new Map();
    this.triangles = 0;
    const m = new THREE.Matrix4();

    for (const [id, entries] of perFamily) {
      const material = makeFacadeMaterial(
        FACADE_FAMILIES[id],
        (canvas, opts) => this._registerTexture(canvas, opts),
        512,
      );
      this._disposables.push(material);

      // 24 vertices and 36 indices per box: BoxGeometry's exact counts, so the
      // batch is allocated to fit rather than over-allocated by a guess.
      const batch = new THREE.BatchedMesh(
        entries.length,
        entries.length * 24,
        entries.length * 36,
        material,
      );
      batch.name = `${this.spec.id}_${id}`;
      batch.castShadow = true;
      batch.receiveShadow = true;

      for (const { box, b } of entries) {
        const geo = new THREE.BoxGeometry(box.w, box.h, box.d);
        // Same real-world texel density as Phase 1: a window is the same
        // physical size on a 9 m annex and a 110 m tower.
        scaleBoxUVs(geo, box.w, box.h, box.d, FACADE_TILE_M);
        const geometryId = batch.addGeometry(geo);
        const instanceId = batch.addInstance(geometryId);
        m.makeTranslation(b.lx + box.cx, box.cy, b.lz + box.cz);
        batch.setMatrixAt(instanceId, m);
        this.triangles += geo.index.count / 3;
        geo.dispose();
      }

      this.grid.add(batch);
      this.batches.set(id, batch);
    }

    // Colliders, built from the AUTHORED numbers rather than from the built
    // meshes, so the collision world never depends on a world matrix having been
    // updated first — Phase 1's rule, kept. See `buildingWorldBox` for the
    // rotated-footprint approximation District A carries.
    for (const b of this.buildings) {
      this.collision.addBuilding(buildingWorldBox(b, this.spec), this);
    }
  }

  /**
   * Buildings that cannot join a facade batch, because they carry a unique
   * non-repeating atlas. There is exactly one: the annex's 90 m helipad tower.
   *
   * THIS IS THE MOST LOAD-BEARING TWENTY LINES IN THE ABSORPTION. The painted
   * helipad on this roof is the only marked landing site in the world, it was
   * invisible once already (a parapet slab covered it), and a human has signed
   * it off across five browser passes. It is built here — geometry, atlas UVs
   * and bespoke material — exactly as `StreetBlock` built it, at the same one
   * mesh and the same two draw calls.
   */
  _buildBespokeBuildings() {
    /** @type {THREE.Mesh[]} */
    this.bespokeBuildings = [];

    for (const b of this.buildings) {
      if (!b.bespoke) continue;

      const geo = new THREE.BoxGeometry(b.w, b.h, b.d);
      // Non-repeating atlas: every face gets its own slice of one canvas, so the
      // roof can carry unique art (the helipad) that a repeat-wrapped texture
      // physically cannot — any pixel in a tiled canvas also lands on a wall.
      atlasBoxUVs(geo, TOWER_ATLAS.REGIONS);
      const material = makeBespokeTowerMaterial(b, (canvas, opts) =>
        this._registerTexture(canvas, opts),
      );
      this._disposables.push(material);

      const mesh = new THREE.Mesh(geo, material);
      mesh.name = `${this.spec.id}_bespoke_${b.annexIndex}`;
      // Box geometry is centred on its origin, so lift it by half its height to
      // stand it on the ground plane.
      mesh.position.set(b.lx, b.h / 2, b.lz);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.grid.add(mesh);
      this.bespokeBuildings.push(mesh);
      this.triangles += geo.index.count / 3;
    }
  }

  // ---------------------------------------------------------------- landmark

  /**
   * The district landmark: its own `Mesh`, +1 main / +1 shadow.
   *
   * It cannot be batched (no per-instance material override, see the class
   * header), so §BGT-1's 4-call district-landmarks line is load-bearing rather
   * than an optimisation waiting to happen. `DEN-6` calls landmark placement
   * "the cheapest lever in the whole density section" — 4 calls for the two of
   * them buys the most legible "this is a real, distinct place" signal in the
   * whole spec.
   */
  _buildLandmark() {
    const built = buildLandmark(this.spec.landmark, (canvas, opts) =>
      this._registerTexture(canvas, opts),
    );
    built.mesh.name = `${this.spec.id}_landmark`;
    this.landmark = built.mesh;
    this.triangles += built.triangles;
    this._disposables.push(built.mesh.material);
    this.grid.add(built.mesh);

    for (const box of built.colliderBoxes(this.spec)) this.collision.addBuilding(box, this);
  }

  // ----------------------------------------------------------------- plumbing

  /**
   * Turn a canvas into a CanvasTexture with the project's standard settings and
   * register it for disposal.
   *
   * COLOUR SPACE IS NOT COSMETIC. The diffuse map holds authored sRGB colour and
   * must be tagged sRGB so the renderer linearises it; roughness and metalness
   * maps hold raw LINEAR data and tagging them sRGB would silently apply a gamma
   * curve to the material's PBR inputs.
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
    texture.anisotropy = 8;
    this._disposables.push(texture);
    return texture;
  }

  /**
   * Free every GPU resource this district created.
   *
   * Two passes, for the same reason `StreetBlock.dispose()` needs two: scene
   * traversal reaches the geometries, but the `CanvasTexture`s and the shared
   * materials several meshes reference are only reachable through
   * `_disposables`. Every facade family owns three canvases, so a missed dispose
   * here is a visible leak across an afternoon of Vite HMR reloads.
   */
  dispose() {
    disposeObject3D(this.group);
    for (const d of this._disposables) d.dispose();
    this._disposables.length = 0;
    this.scene.remove(this.group);
    // This district's footprints and landmark boxes only — the other district's
    // survive. That is the whole reason `removeOwner` takes an owner.
    this.collision.removeOwner(this);
  }
}

// --------------------------------------------------------------------- strips

/** Distance from a street centre-line to the middle of its sidewalk. */
function walkOffset() {
  return HALF_ROADWAY + SIDEWALK / 2;
}

/** Distance from a street centre-line to the middle of its curb strip. */
function curbOffset() {
  return HALF_ROADWAY + CURB_W / 2;
}

/**
 * The runs of a strip along `axis` once every cross-street has been cut out of
 * it, clipped to the district square.
 *
 * @param {'x'|'z'} axis the axis the strip RUNS along
 * @param {number} halfGap half the width of the cut taken out at each crossing
 * @returns {Array<[number, number]>}
 */
function segments(axis, halfGap) {
  const cuts = STREET_LINES;
  const out = [];
  let from = -DISTRICT_HALF;
  for (const c of cuts) {
    if (c - halfGap > from) out.push([from, c - halfGap]);
    from = c + halfGap;
  }
  if (DISTRICT_HALF > from) out.push([from, DISTRICT_HALF]);
  return out.filter(([a, b]) => b - a > 0.01);
}

/**
 * The district's own grid, expressed in the same shape as `annexStreets` so both
 * can be cut against one list. Every grid street spans the full district square.
 *
 * @returns {Array<{axis:'x'|'z', line:number, from:number, to:number}>}
 */
function gridStreets() {
  const out = [];
  for (const line of STREET_LINES) {
    out.push({ axis: 'x', line, from: -DISTRICT_HALF, to: DISTRICT_HALF });
    out.push({ axis: 'z', line, from: -DISTRICT_HALF, to: DISTRICT_HALF });
  }
  return out;
}

/**
 * The runs of one sidewalk or curb strip once every street that crosses it has
 * been cut out.
 *
 * `segments()` above does the same job for the ROADWAY against the fixed
 * `STREET_LINES`. This one takes the street list as data, because the annex's
 * streets are authored and the grid cannot know them — which is exactly the gap
 * that let decision 27's connector ship with a kerb across its mouth.
 *
 * @param {{axis:'x'|'z', line:number, from:number, to:number}} s the street the
 *   strip belongs to; the strip runs along `s.axis` and spans `s.from..s.to`
 * @param {number} stripLine the strip's own cross-axis coordinate — NOT
 *   `s.line`. A strip is offset to one side, so whether a short street reaches
 *   it is a different question from whether that street reaches the centre-line.
 * @param {ReadonlyArray<{axis:'x'|'z', line:number, from:number, to:number}>} all
 * @returns {Array<[number, number]>}
 */
function crossings(s, stripLine, all) {
  const halfGap = s.axis === 'x' ? HALF_ROADWAY : ROW / 2;
  const cuts = all
    .filter(
      (c) =>
        // Only a street running the OTHER way can cross this one, and only if it
        // reaches this strip. ⚠️ The reach test is widened by HALF_ROADWAY at
        // both ends ON PURPOSE: streets ABUT at junctions rather than overlapping
        // (decision 27 stops the boulevard at the connector's west kerb, not at
        // its centreline, because coplanar roadway at one y is a z-fight). A
        // plain `from <= line <= to` finds no junction at the exact place a
        // T-junction is, which is the whole case this exists for.
        c.axis !== s.axis &&
        c.from - HALF_ROADWAY <= stripLine &&
        stripLine <= c.to + HALF_ROADWAY,
    )
    .map((c) => c.line)
    // Keep a cut whose BAND overlaps the strip, not one whose centre-line sits
    // strictly inside it. Decision 27's connector runs exactly ON the district
    // boundary, so its centre-line coincides with the grid strips' own start and
    // a strict interior test drops it — leaving the sidewalk covering the half
    // of the junction that lies inside the district.
    .filter((line) => line + halfGap > s.from && line - halfGap < s.to)
    .sort((a, b) => a - b);

  const out = [];
  let from = s.from;
  for (const c of cuts) {
    if (c - halfGap > from) out.push([from, c - halfGap]);
    from = Math.max(from, c + halfGap);
  }
  if (s.to > from) out.push([from, s.to]);
  return out.filter(([a, b]) => b - a > 0.01);
}

/**
 * One roadway quad, UV-scaled so the painted centreline tiles at
 * ROAD_TILE_M metres along the road regardless of the strip's length.
 *
 * @param {'x'|'z'} axis the axis the road RUNS along
 * @param {number} line the cross-axis coordinate of its centre-line
 * @param {number} from @param {number} to
 */
function roadStrip(axis, line, from, to) {
  const len = to - from;
  const geo = new THREE.PlaneGeometry(len, ROADWAY);
  geo.rotateX(-Math.PI / 2);
  scaleUVs(geo, len / ROAD_TILE_M, 1);
  if (axis === 'x') {
    geo.translate((from + to) / 2, 0, line);
  } else {
    // Rotate the strip a quarter turn so its U axis — and therefore the dash —
    // still runs ALONG the road rather than across it.
    geo.rotateY(Math.PI / 2);
    geo.translate(line, 0, (from + to) / 2);
  }
  return geo;
}

/**
 * One sidewalk or curb slab: a shallow box, not a plane, so its edge catches the
 * light and reads as a step.
 *
 * The relief is centimetres rather than the real 15 cm, and that is Phase 1's
 * deliberate choice carried forward unchanged: the collision model is a flat
 * plane at y = 0 with no step-up logic, so a truthful curb would be a lie the
 * physics cannot back up.
 *
 * @param {'x'|'z'} axis @param {number} line
 * @param {[number, number]} seg @param {number} width @param {number} relief
 */
function slab(axis, line, seg, width, relief) {
  const len = seg[1] - seg[0];
  const geo =
    axis === 'x'
      ? new THREE.BoxGeometry(len, relief, width)
      : new THREE.BoxGeometry(width, relief, len);
  if (axis === 'x') geo.translate((seg[0] + seg[1]) / 2, relief / 2, line);
  else geo.translate(line, relief / 2, (seg[0] + seg[1]) / 2);
  return geo;
}

/** Multiply every UV in place. @param {THREE.BufferGeometry} geo */
function scaleUVs(geo, su, sv) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  uv.needsUpdate = true;
}

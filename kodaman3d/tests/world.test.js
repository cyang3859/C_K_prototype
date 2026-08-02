import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';

import { CollisionWorld, resolveCapsule } from '../src/world/Collision.js';
import { HERO_HEIGHT_M, HERO_RADIUS_M } from '../src/core/Scale.js';
import {
  ANNEX,
  BESPOKE_TOWER_INDEX,
  TOWER_ATLAS,
  atlasBoxUVs,
  hvacUnits,
  parapetBoxes,
  roofInnerBox,
  roofTopY,
} from '../src/world/annex.js';
import { DISTRICTS, WORLD_HALF_EXTENT, annexBuildings } from '../src/world/districts.js';
import { District } from '../src/world/District.js';
import { Sky } from '../src/world/Sky.js';
import { Hero } from '../src/entities/Hero.js';
import { HILL, Terrain, hillColliderBoxes, hillHeight } from '../src/world/terrain.js';
import { WorldProps } from '../src/world/WorldProps.js';
import { createdContexts, installCanvasStub } from './support/canvas2d.js';

/**
 * world.test.js — the annex (Phase 1's absorbed block) and the whole-world
 * draw-call ledger.
 *
 * WHAT MOVED, AND WHAT DID NOT. Locked decision 24 retired `StreetBlock` as a
 * standalone area; every assertion below that encodes a still-true invariant —
 * the parapet is a four-bar ring not a slab, the helipad is a circle in world
 * space, the hero lands on the roof itself, the rooftop units clear the marking —
 * is here unchanged, re-pointed at the annex's new home in District B. The only
 * tests that changed shape are the ones that asserted a separate area existed.
 *
 * Everything here is headless. The scene-graph tests install the canvas stub in
 * tests/support/canvas2d.js.
 */

const R = HERO_RADIUS_M; // 0.35
const H = HERO_HEIGHT_M; // 1.85

/** The 90 m tower — the building criterion 20 asks a human to fly over and land on. */
const TOWER = ANNEX.buildings[BESPOKE_TOWER_INDEX];

// ---------------------------------------------------------------------------
// G1 parapet — the correction without which criterion 20 regresses
// ---------------------------------------------------------------------------

const structuralBox = (b) =>
  new THREE.Box3(
    new THREE.Vector3(b.x - b.w / 2, 0, b.z - b.d / 2),
    new THREE.Vector3(b.x + b.w / 2, b.h, b.z + b.d / 2),
  );

describe('G1 parapet collider', () => {
  it('is a RING of four bars at the edge, not a slab over the roof', () => {
    const bars = parapetBoxes(TOWER);
    expect(bars).toHaveLength(4);

    for (const box of bars) {
      // Every bar sits on the structural roof and rises 0.45 m.
      expect(box.min.y).toBe(TOWER.h);
      expect(box.max.y).toBeCloseTo(TOWER.h + 0.45, 10);
    }

    // THE POINT OF THE RING: the roof centre is clear, so the painted helipad
    // is visible and landable. A slab here is what hid it.
    const centre = new THREE.Vector3(TOWER.x, TOWER.h + 0.2, TOWER.z);
    for (const box of bars) expect(box.containsPoint(centre)).toBe(false);

    // And the walkable roof is the roof itself, no longer a lid above it.
    expect(roofTopY(TOWER)).toBe(TOWER.h);
  });

  it('the ring reaches every edge and closes at the corners', () => {
    const bars = parapetBoxes(TOWER);
    const union = new THREE.Box3();
    for (const box of bars) union.union(box);

    // Flush with the building footprint on all four sides.
    expect(union.min.x).toBeCloseTo(TOWER.x - TOWER.w / 2, 10);
    expect(union.max.x).toBeCloseTo(TOWER.x + TOWER.w / 2, 10);
    expect(union.min.z).toBeCloseTo(TOWER.z - TOWER.d / 2, 10);
    expect(union.max.z).toBeCloseTo(TOWER.z + TOWER.d / 2, 10);

    // No gap at a corner: the N bar spans the full width, so it overlaps the
    // ends of the E and W bars in X.
    const [north, , east] = bars;
    expect(north.max.x).toBeGreaterThanOrEqual(east.max.x);
  });

  it('criterion 20: a hero landing on the tower roof stands on the ROOF', () => {
    const boxes = [structuralBox(TOWER), ...parapetBoxes(TOWER)];

    // Descend onto the roof centre from well above it.
    const pos = new THREE.Vector3(TOWER.x, TOWER.h - 5, TOWER.z);
    const r = resolveCapsule(pos, R, H, boxes, { previousY: 200 });

    expect(r.onGround).toBe(true);
    expect(pos.y).toBeCloseTo(TOWER.h, 10);
    expect(r.pushed).toBe(false);
  });

  it('landing on the roof centre is not disturbed by the ring at all', () => {
    // The slab version needed its collider to avoid sinking 0.45 m. The ring
    // needs nothing: the structural box alone already lands the hero correctly,
    // and adding the ring changes the result by zero.
    const withRing = new THREE.Vector3(TOWER.x, TOWER.h - 5, TOWER.z);
    resolveCapsule(withRing, R, H, [structuralBox(TOWER), ...parapetBoxes(TOWER)], {
      previousY: 200,
    });
    const without = new THREE.Vector3(TOWER.x, TOWER.h - 5, TOWER.z);
    resolveCapsule(without, R, H, [structuralBox(TOWER)], { previousY: 200 });

    expect(withRing.y).toBeCloseTo(without.y, 10);
  });

  it('standing well inside the ring is not shoved sideways', () => {
    const boxes = [structuralBox(TOWER), ...parapetBoxes(TOWER)];
    // Two metres in from the coping's inner face.
    const pos = new THREE.Vector3(TOWER.x + TOWER.w / 2 - 2.6, TOWER.h, TOWER.z);
    const before = pos.clone();
    const r = resolveCapsule(pos, R, H, boxes, { previousY: TOWER.h });
    expect(r.onGround).toBe(true);
    expect(pos.x).toBeCloseTo(before.x, 10);
    expect(pos.z).toBeCloseTo(before.z, 10);
  });

  it('the coping stops the hero walking off the edge from inside', () => {
    // What a real parapet is for, and a straight gain over the slab.
    const boxes = [structuralBox(TOWER), ...parapetBoxes(TOWER)];
    const innerFace = TOWER.x + TOWER.w / 2 - 0.6; // coping inner face, x = 7.4
    const pos = new THREE.Vector3(innerFace - 0.2, TOWER.h, TOWER.z);
    const r = resolveCapsule(pos, R, H, boxes, { previousY: TOWER.h });

    expect(r.pushed).toBe(true);
    // Pushed back INWARD, and left clear of the coping rather than inside it.
    expect(pos.x).toBeLessThanOrEqual(innerFace - R + 1e-9);
  });

  it('KNOWN: standing on the coping itself ejects outward, off the roof', () => {
    // Pinned because it is a real behaviour, not because it is desirable. A
    // capsule whose centre is past the coping's midline takes the shorter way
    // out, which is over the edge. It needs the hero to be standing ON the
    // 0.6 m coping rather than on the roof, and the hero can fly.
    const boxes = [structuralBox(TOWER), ...parapetBoxes(TOWER)];
    const pos = new THREE.Vector3(TOWER.x + TOWER.w / 2 - 0.1, TOWER.h, TOWER.z);
    resolveCapsule(pos, R, H, boxes, { previousY: TOWER.h });
    expect(pos.x).toBeGreaterThan(TOWER.x + TOWER.w / 2);
  });
});

// ---------------------------------------------------------------------------
// G2 rooftop mechanical units
// ---------------------------------------------------------------------------

describe('G2 rooftop unit placement', () => {
  const units = hvacUnits();

  it('places 2 per low/mid-rise and 3 per tower', () => {
    const towers = ANNEX.buildings.filter((b) => b.kind === 'tower').length;
    const rest = ANNEX.buildings.length - towers;
    expect(units.length).toBe(rest * 2 + towers * 3);
    expect(units.length).toBe(22);
  });

  it('is deterministic', () => {
    expect(hvacUnits()).toEqual(units);
  });

  it('keeps every unit inside its building parapet, never overhanging the coping', () => {
    let u = 0;
    for (const b of ANNEX.buildings) {
      const count = b.kind === 'tower' ? 3 : 2;
      const cap = roofInnerBox(b);
      for (let k = 0; k < count; k++, u++) {
        const unit = units[u];
        expect(unit.y).toBeCloseTo(roofTopY(b), 10); // rests on the roof itself
        expect(unit.x - 0.6).toBeGreaterThanOrEqual(cap.min.x);
        expect(unit.x + 0.6).toBeLessThanOrEqual(cap.max.x);
        expect(unit.z - 0.6).toBeGreaterThanOrEqual(cap.min.z);
        expect(unit.z + 0.6).toBeLessThanOrEqual(cap.max.z);
      }
    }
    expect(u).toBe(units.length);
  });

  it('keeps the bespoke tower units clear of the painted helipad', () => {
    // Helipad outer radius in METRES: the ring is authored in canvas pixels on
    // the U axis, at SIZE px over the roof's X width.
    const pxPerM = TOWER_ATLAS.SIZE / TOWER.w;
    const helipadR = TOWER_ATLAS.HELIPAD_OUTER_PX / pxPerM;

    const towerUnits = hvacUnits([TOWER]);
    expect(towerUnits.length).toBe(3);
    for (const unit of towerUnits) {
      const dx = unit.x - TOWER.x;
      const dz = unit.z - TOWER.z;
      // Half the unit's diagonal footprint, so the CORNER clears too.
      const clearance = Math.hypot(dx, dz) - Math.hypot(0.6, 0.6);
      expect(clearance).toBeGreaterThan(helipadR);
    }
  });
});

// ---------------------------------------------------------------------------
// Bespoke atlas UVs
// ---------------------------------------------------------------------------

describe('atlasBoxUVs', () => {
  it('remaps every face into its declared region', () => {
    const geo = new THREE.BoxGeometry(TOWER.w, TOWER.h, TOWER.d);
    atlasBoxUVs(geo, TOWER_ATLAS.REGIONS);
    const uv = geo.attributes.uv;

    for (let face = 0; face < 6; face++) {
      const [uMin, uMax, vMin, vMax] = TOWER_ATLAS.REGIONS[face];
      for (let v = 0; v < 4; v++) {
        const i = face * 4 + v;
        expect(uv.getX(i)).toBeGreaterThanOrEqual(uMin - 1e-9);
        expect(uv.getX(i)).toBeLessThanOrEqual(uMax + 1e-9);
        expect(uv.getY(i)).toBeGreaterThanOrEqual(vMin - 1e-9);
        expect(uv.getY(i)).toBeLessThanOrEqual(vMax + 1e-9);
      }
    }
  });

  it('gives all four side faces the same vertical mapping, so floor lines meet at the corners', () => {
    const geo = new THREE.BoxGeometry(TOWER.w, TOWER.h, TOWER.d);
    atlasBoxUVs(geo, TOWER_ATLAS.REGIONS);
    const uv = geo.attributes.uv;

    // Face order is +X, -X, +Y, -Y, +Z, -Z; the side faces are 0, 1, 4, 5.
    const vs = [0, 1, 4, 5].map((face) => {
      const out = [];
      for (let v = 0; v < 4; v++) out.push(uv.getY(face * 4 + v));
      return out.sort((a, b) => a - b);
    });
    for (const set of vs) expect(set).toEqual(vs[0]);
    // And the span really is the full facade region, base to roofline.
    expect(vs[0][0]).toBeCloseTo(0, 10);
    expect(vs[0][3]).toBeCloseTo(0.75, 10);
  });

  it('reserves the top quarter of the atlas for the roof only', () => {
    // Region C is the ONLY region above v = 0.75; if a facade region ever
    // overlapped it, window art would bleed onto the helipad.
    const roof = TOWER_ATLAS.REGIONS[2];
    expect(roof[2]).toBeCloseTo(0.75, 10);
    for (const face of [0, 1, 4, 5]) {
      expect(TOWER_ATLAS.REGIONS[face][3]).toBeLessThanOrEqual(0.75);
    }
  });
});

// ---------------------------------------------------------------------------
// The absorption itself — locked decision 24
// ---------------------------------------------------------------------------

describe('the annex, absorbed into District B (locked decision 24)', () => {
  it('has no standalone area left: no StreetBlock module and no block ground', async () => {
    // The load-bearing half of decision 24. The content survived; the AREA did
    // not — no separate builder, no separate ground plane, no separate roads.
    await expect(import('../src/world/StreetBlock.js')).rejects.toThrow();
  });

  it('lands every annex building in District B at its EXACT Phase 1 world position', () => {
    // The whole reason the absorption is a translation and not a re-placement:
    // five browser passes of human sign-off are attached to these coordinates.
    const [, b] = DISTRICTS;
    for (const rec of annexBuildings()) {
      const src = ANNEX.buildings[rec.annexIndex];
      expect(rec.lx + b.origin.x).toBeCloseTo(src.x, 9);
      expect(rec.lz + b.origin.z).toBeCloseTo(src.z, 9);
      expect(rec.w).toBe(src.w);
      expect(rec.d).toBe(src.d);
      expect(rec.h).toBe(src.h);
    }
    expect(b.rotation).toBe(0); // …which is what makes a pure translation legal
  });

  it('keeps the annex on Phase 1 massing: one box, not a §5 recipe', () => {
    // Decision 24 is about where content lives, not what it looks like.
    for (const rec of annexBuildings()) expect(rec.recipe).toBe('mas0');
  });

  it('marks exactly one building bespoke — the helipad tower', () => {
    const bespoke = annexBuildings().filter((b) => b.bespoke);
    expect(bespoke).toHaveLength(1);
    expect(bespoke[0].annexIndex).toBe(BESPOKE_TOWER_INDEX);
    expect(bespoke[0].h).toBe(90);
  });

  it('spawns the hero on the sidewalk, clear of every building footprint', () => {
    // Game.js's spawn, asserted against the absorbed world rather than assumed.
    installCanvasStub();
    const scene = new THREE.Scene();
    const collision = new CollisionWorld({ halfExtent: WORLD_HALF_EXTENT });
    for (const spec of DISTRICTS) new District({ scene, collision, spec });
    new WorldProps({ scene, collision });

    const spawn = new THREE.Vector3(0, 0, 13);
    for (const box of collision.buildings) {
      // The capsule's radius, not just its centre, must clear every collider.
      expect(
        box.min.x - R < spawn.x &&
          spawn.x < box.max.x + R &&
          box.min.z - R < spawn.z &&
          spawn.z < box.max.z + R &&
          box.min.y <= 0,
      ).toBe(false);
    }
    // And it is on a sidewalk: inside the annex right-of-way, outside the
    // roadway, on the north walk.
    expect(spawn.z).toBeGreaterThan(21.34 / 2);
    expect(spawn.z).toBeLessThan(21.34 / 2 + 4.57);
  });
});

// ---------------------------------------------------------------------------
// The built world: canvas drawing, colliders
// ---------------------------------------------------------------------------

describe('District B with its annex, built', () => {
  /** @type {THREE.Scene} */
  let scene;
  /** @type {CollisionWorld} */
  let collision;
  /** @type {District} */
  let district;
  /** @type {WorldProps} */
  let props;
  /** Snapshot taken right after construction, so later tests that build another
   * world cannot contaminate the counts below. */
  let contexts;

  beforeAll(() => {
    installCanvasStub();
    scene = new THREE.Scene();
    collision = new CollisionWorld({ halfExtent: WORLD_HALF_EXTENT });
    district = new District({ scene, collision, spec: DISTRICTS[1] });
    props = new WorldProps({ scene, collision });
    contexts = createdContexts.slice();
  });

  it('builds the helipad tower as its own Mesh, because a batch cannot hold it', () => {
    // `BatchedMesh` takes ONE material for the whole batch, so the only building
    // in the world with a unique roof atlas is also the only one that cannot be
    // batched. Losing this mesh means losing the helipad.
    expect(district.bespokeBuildings).toHaveLength(1);
    const mesh = district.bespokeBuildings[0];
    expect(mesh.isMesh).toBe(true);
    expect(mesh.isBatchedMesh).toBeFalsy();
    expect(Array.isArray(mesh.material)).toBe(false);
    expect(mesh.castShadow).toBe(true);
    // Standing at Phase 1's coordinates, in world space, through the grid group.
    district.grid.updateMatrixWorld(true);
    const world = mesh.getWorldPosition(new THREE.Vector3());
    expect(world.x).toBeCloseTo(TOWER.x, 6);
    expect(world.z).toBeCloseTo(TOWER.z, 6);
    expect(world.y).toBeCloseTo(TOWER.h / 2, 6);
  });

  it('registers the structural box AND four parapet bars for every annex building', () => {
    for (const b of ANNEX.buildings) {
      for (const want of parapetBoxes(b)) {
        const found = collision.buildings.some(
          (box) =>
            Math.abs(box.min.x - want.min.x) < 1e-9 &&
            Math.abs(box.min.z - want.min.z) < 1e-9 &&
            Math.abs(box.max.x - want.max.x) < 1e-9 &&
            Math.abs(box.max.z - want.max.z) < 1e-9 &&
            Math.abs(box.max.y - want.max.y) < 1e-9,
        );
        expect(found, `parapet bar for building at ${b.x},${b.z}`).toBe(true);
      }
    }
    // 46 District B footprints + 1 landmark, plus everything WorldProps
    // registers for the WHOLE world (it is world-shared, so it does not care
    // that only District B was built here): 40 annex parapet bars + 158 rooftop
    // units — 22 the annex's, 64 District A's and 72 District B's.
    //
    // ⚠️ 86 -> 158 is locked decision 26, not a drift. Roof furniture used to be
    // scoped to District A (§10 item 5); the user extended it to District B's
    // generated buildings on 2026-08-01. Rooftop units are colliders ON PURPOSE
    // — a player who can land on a roof can walk into one — so extending the
    // pool necessarily extends the collider count. Draw calls are unchanged at
    // zero: both pools already existed and already spanned the annex.
    expect(collision.buildings.length).toBe(46 + 1 + 40 + 158);
  });

  it('registers a collider for every rooftop mechanical unit', () => {
    const units = hvacUnits();
    for (const u of units) {
      const found = collision.buildings.some(
        (box) =>
          Math.abs(box.min.x - (u.x - 0.6)) < 1e-9 &&
          Math.abs(box.min.y - u.y) < 1e-9 &&
          Math.abs(box.min.z - (u.z - 0.6)) < 1e-9,
      );
      expect(found).toBe(true);
    }
  });

  it('paints the plinth band at the BOTTOM of each repeat tile, where the roof UVs sample', () => {
    // scaleBoxUVs collapses the roof faces onto v = 0.06. CanvasTexture defaults
    // to flipY = true, so v = 0 is the canvas's BOTTOM row:
    //   canvasY = (1 - v) x size
    const size = 512;
    const bandH = Math.floor(size * 0.12); // 61
    const bandY = size - bandH; // 451
    const sampleY = (1 - 0.06) * size; // 481.28

    expect(sampleY).toBeGreaterThan(bandY);
    expect(sampleY).toBeLessThan(size);

    // The band fill really is drawn at that rect, on every family canvas.
    const bandFills = contexts.filter((ctx) =>
      ctx.calls.some(
        (c) =>
          c.op === 'fillRect' &&
          c.args[0] === 0 &&
          c.args[1] === bandY &&
          c.args[2] === size &&
          c.args[3] === bandH,
      ),
    );
    // District B's five families x three maps (diffuse, roughness, metalness).
    expect(bandFills.length).toBe(15);
  });

  it('draws the helipad inside the aspect compensation, so it is a circle', () => {
    const scales = [];
    for (const ctx of contexts) {
      for (const c of ctx.calls) if (c.op === 'scale') scales.push(c.args);
    }
    // One per bespoke-tower canvas: diffuse, roughness, metalness.
    expect(scales.length).toBe(3);
    for (const [sx, sy] of scales) {
      expect(sx).toBe(1);
      // (256 / 28) / (1024 / 20) — the V axis is 5.6x less dense than the U axis
      // because a 1024x256 px region does not match a 20x28 m footprint.
      expect(sy).toBeCloseTo(0.178571, 5);
    }

    // The compensation is what matters, so assert the OUTCOME in world space:
    // the ring's X and Z radii come out equal, i.e. it really is circular.
    const roofPxPerM_U = TOWER_ATLAS.SIZE / TOWER.w; // 51.2
    const roofPxPerM_V = (TOWER_ATLAS.SIZE * 0.25) / TOWER.d; // 9.142857
    const squash = roofPxPerM_V / roofPxPerM_U;
    const rx = TOWER_ATLAS.HELIPAD_OUTER_PX / roofPxPerM_U;
    const rz = (TOWER_ATLAS.HELIPAD_OUTER_PX * squash) / roofPxPerM_V;
    expect(rz).toBeCloseTo(rx, 10);
    // Sanity: the real-world size of the marking. A 6 m radius, i.e. a 12 m
    // helipad on the 20 x 28 m roof — the real FATO proportion. It shipped at
    // 1.76 m (3.5 m across) and a human flying over the roof could not find it.
    expect(rx).toBeCloseTo(5.996, 3);
    // And it still fits the region it is painted into, in both axes.
    expect(2 * TOWER_ATLAS.HELIPAD_OUTER_PX).toBeLessThan(TOWER_ATLAS.SIZE);
    expect(2 * TOWER_ATLAS.HELIPAD_OUTER_PX * squash).toBeLessThan(TOWER_ATLAS.SIZE * 0.25);
  });

  it('draws the helipad ring and glyph inside a save/restore pair', () => {
    const painted = contexts.filter((ctx) =>
      ctx.calls.some((c) => c.op === 'fillText' && c.args[0] === 'H'),
    );
    expect(painted.length).toBe(3);

    for (const ctx of painted) {
      const ops = ctx.calls.map((c) => c.op);
      const save = ops.lastIndexOf('save');
      const restore = ops.lastIndexOf('restore');
      const scale = ops.lastIndexOf('scale');
      const text = ops.lastIndexOf('fillText');
      expect(save).toBeLessThan(scale);
      expect(scale).toBeLessThan(text);
      expect(text).toBeLessThan(restore);

      // The annulus: outer ring wound forwards, inner wound backwards so the
      // default nonzero fill rule leaves the middle open.
      const arcs = ctx.calls.filter((c) => c.op === 'arc');
      expect(arcs.length).toBe(2);
      expect(arcs[0].args[2]).toBe(TOWER_ATLAS.HELIPAD_OUTER_PX);
      expect(arcs[1].args[2]).toBe(TOWER_ATLAS.HELIPAD_INNER_PX);
      expect(arcs[0].args[5]).toBe(false);
      expect(arcs[1].args[5]).toBe(true);
    }
  });

  it('creates 22 canvases: (5 families + bespoke atlas + landmark) x 3, + 1 road', () => {
    expect(contexts.length).toBe(22);
    // Every texture created is registered for disposal — the leak this guards
    // against is a climbing renderer.info.memory.textures across HMR reloads.
    const textures = district._disposables.filter((d) => d.isTexture);
    expect(textures.length).toBe(22);
  });

  it('disposes cleanly and drops every prop pool', () => {
    const local = new THREE.Scene();
    const world = new CollisionWorld({ halfExtent: WORLD_HALF_EXTENT });
    const p = new WorldProps({ scene: local, collision: world });
    expect(world.buildings.length).toBeGreaterThan(0);
    expect(local.children.length).toBe(1);
    p.dispose();
    expect(p._disposables.length).toBe(0);
    expect(local.children.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Worst-case draw calls — the whole world, both passes
// ---------------------------------------------------------------------------

/**
 * Count every object in a scene that would issue a draw call with NOTHING
 * culled.
 *
 * `renderer.info.render.calls` reports what was actually drawn last frame, so it
 * moves with frustum culling — which is why a human measured 42 and an earlier
 * reading said 45 without either being wrong. This walks the graph instead and
 * returns the static upper bound, and it is the number every budget figure in
 * this project is quoted against.
 *
 * TWO PASSES, NOT ONE. WebGLRenderer.render() calls `info.reset()` BEFORE
 * `shadowMap.render()`, and the shadow map issues its draws through the same
 * `renderer.renderBufferDirect` that feeds `info.update` — so every shadow
 * caster costs a SECOND draw call. Any ledger that counts only the main pass
 * understates the worst case by the number of casters in the scene.
 *
 * An InstancedMesh is one call regardless of instance count. A `BatchedMesh` is
 * one call ONLY where `WEBGL_multi_draw` is present (measured present here); a
 * machine without it falls back to one call per geometry. A Color background is
 * a clear, not a draw.
 *
 * @param {THREE.Scene} scene
 */
function drawCallInventory(scene) {
  const main = [];
  const shadow = [];
  scene.traverse((o) => {
    // isInstancedMesh implies isMesh, so this covers both.
    if (!o.isMesh && !o.isLine && !o.isPoints && !o.isSprite) return;
    if (o.visible === false) return;
    main.push(o.name || o.type);
    if (o.castShadow) shadow.push(o.name || o.type);
  });
  return { main, shadow, total: main.length + shadow.length };
}

/** The whole world, exactly as `Game.init()` assembles it. */
function buildWorld() {
  installCanvasStub();
  const scene = new THREE.Scene();
  const collision = new CollisionWorld({ halfExtent: WORLD_HALF_EXTENT });
  new Sky(scene);
  const districts = DISTRICTS.map((spec) => new District({ scene, collision, spec }));
  const props = new WorldProps({ scene, collision });
  const terrain = new Terrain({ scene, collision });
  new Hero({ scene, position: new THREE.Vector3(0, 0, 13) });
  return { scene, collision, districts, props, terrain };
}

describe('worst-case draw calls, both passes', () => {
  it('is 78: 44 main + 34 shadow, against the 150 ceiling', () => {
    const { scene } = buildWorld();
    const inv = drawCallInventory(scene);

    // MAIN, 40:
    //   District A   8 = ground + roadway + sidewalk + curb + 3 batches + landmark
    //   District B  11 = ground + roadway + sidewalk + curb + 5 batches
    //                    + bespoke helipad tower + landmark
    //   props       17 = one pool per silhouette, world-shared (§PROP-1)
    //   hill         1 = §PROP-3's landform, one displaced plane
    //   hero         7 = torso + head + 4 limbs + cape
    //   sky          0 = two lights and a Color background; no skybox mesh
    expect(inv.main.length).toBe(44);

    // SHADOW, 32: every castShadow object above. No ground or road surface
    // casts, in either district — §6, and Phase 1's own convention.
    expect(inv.shadow.length).toBe(34);
    for (const spec of DISTRICTS) {
      for (const surface of ['ground', 'roadway', 'sidewalk', 'curb']) {
        expect(inv.shadow).not.toContain(`${spec.id}_${surface}`);
      }
    }

    expect(inv.total).toBe(78);
    // The Phase 2 ceiling, both passes (RESEARCH_PHASE_2_WORLD.md §BUD-6). The
    // 78 calls of headroom are reserved for CSM's unmeasured shadow multiplier —
    // they are not spare budget.
    expect(inv.total).toBeLessThanOrEqual(150);
  });

  it('THE ABSORPTION: the world costs 44 calls before a single prop pool', () => {
    // The measurement locked decision 24 exists to produce, isolated from the
    // props that came after it.
    //
    // BEFORE (run 1, measured): 83 = districts 26 + hero 14 + Phase 1's block
    // 43, of which the block's own eight prop pools were 16.
    // AFTER: this figure + the 28 the world-shared pools now cost.
    //
    // 83 - 16 = 67 was the pre-absorption world with its prop pools set aside;
    // 44 is the same world after. The absorption gives back 23 there, plus the
    // 2 the lamp post/head merge saves inside the pools: 25 in total, which is
    // exactly the 83 -> 58 measured at the absorption commit.
    installCanvasStub();
    const scene = new THREE.Scene();
    const collision = new CollisionWorld({ halfExtent: WORLD_HALF_EXTENT });
    new Sky(scene);
    for (const spec of DISTRICTS) new District({ scene, collision, spec });
    new Hero({ scene, position: new THREE.Vector3(0, 0, 13) });

    const inv = drawCallInventory(scene);
    expect(inv.main.length).toBe(26);
    expect(inv.shadow.length).toBe(18);
    expect(inv.total).toBe(44);
    expect(67 - inv.total).toBe(23);
  });

  it('the annex costs 4 calls where it used to cost 43', () => {
    const { scene } = buildWorld();
    const inv = drawCallInventory(scene);
    // The helipad tower's own mesh…
    expect(inv.main).toContain('districtB_bespoke_2');
    expect(inv.shadow).toContain('districtB_bespoke_2');
    // …and District B's FAM-1 batch. Everything else the annex authored now
    // rides in a mesh that existed anyway.
    expect(inv.main).toContain('districtB_fam1DarkCurtainWall');
    expect(inv.shadow).toContain('districtB_fam1DarkCurtainWall');
  });

  it('the 17 world-shared prop pools cost exactly 32 of those calls', () => {
    // §PROP-4 budgets the whole props+terrain line at ~35 both passes. This is
    // the measured figure for everything §10 items 4-8 asked for, and the pool
    // COUNT is the whole cost — an InstancedMesh draws 4,000 instances for the
    // same two calls it draws 40.
    const { scene, props } = buildWorld();
    const inv = drawCallInventory(scene);
    const pools = [
      'roofParapets',
      'roofUnits',
      'awnings',
      'bladeSigns',
      'palmTrunks',
      'palmCrowns',
      'canaryTrunks',
      'canaryCrowns',
      'shadeTrees',
      'streetLamps',
      'utilityPoles',
      'parkedSedans',
      'parkedVans',
      'smallProps',
      'bollards',
      'cafeProps',
      'scaffolding',
    ];
    expect([...props.pools.keys()].sort()).toEqual([...pools].sort());
    for (const name of pools) {
      expect(inv.main, name).toContain(name);
    }
    // Two of the seventeen do not cast: §8 prices bollards and cafe tables
    // without a shadow, and a 0.9 m post's shadow is not worth a second pass
    // over 100+ instances.
    const noCast = ['bollards', 'cafeProps'];
    for (const name of noCast) expect(inv.shadow).not.toContain(name);
    expect(pools.length * 2 - noCast.length).toBe(32);
  });

  it('every pool actually has instances — an empty one still costs two calls', () => {
    const { props } = buildWorld();
    for (const [name, mesh] of props.pools) {
      const n = mesh.isBatchedMesh ? mesh.instanceCount : mesh.count;
      expect(n, `${name} is empty`).toBeGreaterThan(0);
    }
  });

  it('78 buildings cost 8 batch calls + 1 bespoke mesh, not 156', () => {
    const { scene, districts } = buildWorld();
    const buildings = districts.reduce((n, d) => n + d.buildings.length, 0);
    expect(buildings).toBe(78); // 32 in A, 36 + 10 annex in B

    let facadeBatches = 0;
    let instances = 0;
    scene.traverse((o) => {
      if (o.isBatchedMesh && o.name !== 'smallProps') {
        facadeBatches++;
        instances += o.instanceCount;
      }
    });
    expect(facadeBatches).toBe(8);
    // Every massing box is its own geometry+instance inside its family's batch.
    // 170 from the generated population + 9 annex single boxes (the tenth is the
    // un-batchable helipad tower).
    expect(instances).toBe(179);
    // One mesh per building would be 78 main + 78 shadow = 156 calls, which
    // exhausts the 150 ceiling on buildings alone. BUD-3 is not polish.
    expect(facadeBatches * 2).toBeLessThan(buildings * 2);
  });

  it('only ONE pool is a BatchedMesh, so the no-multi_draw fallback stays small', () => {
    // `BatchedMesh` falls back to one real draw call PER GEOMETRY when
    // `WEBGL_multi_draw` is absent. Every prop pool that can be an
    // `InstancedMesh` is one, and the single batch that earns its place
    // (`LOD-3`'s multi-variant case) holds three geometries — so the worst case
    // on a machine without the extension is 3 calls instead of 1, not 200.
    const { props } = buildWorld();
    const batched = [...props.pools.values()].filter((m) => m.isBatchedMesh);
    expect(batched).toHaveLength(1);
    expect(batched[0].name).toBe('smallProps');
  });
});

// ---------------------------------------------------------------------------
// The PMREM sky environment.
//
// WHAT THESE CAN AND CANNOT PROVE. There is no GL context under Node, so the
// bake itself cannot run here and nothing below asserts that the towers look
// better — that is a browser question and is stated as one. What they do pin
// down is the part that is pure structure: the env map must cost NO draw calls,
// must degrade cleanly when there is no renderer, and must be released on
// teardown. Each of those is a claim the Sky.js comments make in prose, and
// prose is not enforcement.
// ---------------------------------------------------------------------------

describe('sky environment map', () => {
  it('adds no renderable object to the scene, so the draw-call budget is unmoved', () => {
    // scene.environment is a TEXTURE consulted by the shader, not a node in the
    // graph. This is the whole reason image-based lighting is affordable here,
    // and it is worth an assertion rather than a comment: a future change that
    // implemented the sky as a skybox MESH would be a silent +2 calls.
    const scene = new THREE.Scene();
    // eslint-disable-next-line no-new
    new Sky(scene);
    const inv = drawCallInventory(scene);
    expect(inv.total).toBe(0);
  });

  it('degrades to analytic-lights-only when constructed without a renderer', () => {
    // Unit tests and any future headless path take this branch. It must not
    // throw, and must not leave a half-initialised environment behind.
    const scene = new THREE.Scene();
    const sky = new Sky(scene);
    expect(scene.environment).toBe(null);
    expect(sky.envTarget).toBe(null);
    // update() reads scene.environment before touching intensity; without this
    // guard the no-renderer path would throw on the first frame.
    expect(() => sky.update(1 / 60)).not.toThrow();
  });

  it('releases the baked render target on dispose', () => {
    // The env map hangs off the SCENE, not off any Object3D, so the project's
    // disposeObject3D() walk cannot reach it. If Sky does not free it by hand,
    // nothing does.
    const scene = new THREE.Scene();
    const sky = new Sky(scene);

    let disposed = false;
    sky.envTarget = { dispose: () => { disposed = true; } };
    scene.environment = {};

    sky.dispose();
    expect(disposed).toBe(true);
    expect(sky.envTarget).toBe(null);
    expect(scene.environment).toBe(null);
  });
});

// ---------------------------------------------------------------------------
// §PROP-3 — the hill landmark
// ---------------------------------------------------------------------------

describe('the hill (§PROP-3)', () => {
  it('meets the ground plane exactly at its rim, with no lip and no gap', () => {
    // A landform that stops 30 cm above the ground shows a black seam all the
    // way round it, and one that dips below shows the ground poking through.
    for (let a = 0; a < 32; a++) {
      const ang = (a / 32) * Math.PI * 2;
      // Sub-nanometre rather than bit-exact: `Math.hypot` on a point authored as
      // `cos·R, sin·R` lands a few ULPs inside R about half the time, so the
      // rim fade returns a denormal instead of a hard zero. Nothing at 1e-9 m
      // is visible, and forcing an exact zero would mean snapping the whole
      // height field to hide a rounding artefact.
      expect(hillHeight(Math.cos(ang) * HILL.radius, Math.sin(ang) * HILL.radius)).toBeLessThan(1e-9);
      expect(hillHeight(Math.cos(ang) * (HILL.radius + 5), Math.sin(ang) * 200)).toBe(0);
    }
    expect(hillHeight(0, 0)).toBeGreaterThan(HILL.height * 0.9);
  });

  it('is NOT radially symmetric — a cone reads the same from every approach', () => {
    // The same argument decision 19 made for District A's crown, applied to a
    // landform: the silhouette has to change as you fly around it.
    const r = HILL.radius * 0.45;
    const ring = [];
    for (let a = 0; a < 12; a++) {
      const ang = (a / 12) * Math.PI * 2;
      ring.push(hillHeight(Math.cos(ang) * r, Math.sin(ang) * r));
    }
    const spread = Math.max(...ring) - Math.min(...ring);
    expect(spread).toBeGreaterThan(HILL.height * 0.12);
  });

  it('stands clear of both districts and inside the bounded world', () => {
    // A third sightline anchor is only that if it is not standing in a district.
    expect(HILL.cz - HILL.radius).toBeGreaterThan(150);
    expect(Math.abs(HILL.cx) + HILL.radius).toBeLessThan(WORLD_HALF_EXTENT);
    expect(HILL.cz + HILL.radius).toBeLessThan(WORLD_HALF_EXTENT);
  });

  it('never puts a collider terrace ABOVE the surface it stands for', () => {
    // The stepped approximation errs SMALL, on purpose and unlike every other
    // collider in this project: a terrace whose top was above the real surface
    // would leave the hero standing inside the hillside. See terrain.js.
    for (const box of hillColliderBoxes()) {
      for (const [x, z] of [
        [box.min.x, box.min.z],
        [box.max.x, box.min.z],
        [box.min.x, box.max.z],
        [box.max.x, box.max.z],
        [(box.min.x + box.max.x) / 2, (box.min.z + box.max.z) / 2],
      ]) {
        const surface = hillHeight(x - HILL.cx, z - HILL.cz);
        expect(box.max.y).toBeLessThanOrEqual(surface + 1e-6);
      }
    }
  });

  it('costs one mesh and registers its terraces as colliders', () => {
    installCanvasStub();
    const scene = new THREE.Scene();
    const collision = new CollisionWorld({ halfExtent: WORLD_HALF_EXTENT });
    const terrain = new Terrain({ scene, collision });

    expect(terrain.mesh.isMesh).toBe(true);
    expect(Array.isArray(terrain.mesh.material)).toBe(false);
    expect(terrain.mesh.castShadow).toBe(true);
    // §PROP-3 carried BUD-6's 2-4 main / 2 shadow estimate forward unchecked.
    // Built, it is 1 main / 1 shadow — one displaced plane, one material.
    expect(drawCallInventory(scene).total).toBe(2);
    expect(collision.buildings.length).toBe(hillColliderBoxes().length);
    expect(collision.buildings.length).toBeGreaterThan(3);
  });
});

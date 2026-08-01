import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';

import { CollisionWorld, resolveCapsule } from '../src/world/Collision.js';
import { HERO_HEIGHT_M, HERO_RADIUS_M } from '../src/core/Scale.js';
import {
  BLOCK,
  StreetBlock,
  TOWER_ATLAS,
  atlasBoxUVs,
  hvacUnits,
  parapetBoxes,
  roofInnerBox,
  roofTopY,
} from '../src/world/StreetBlock.js';
import { DISTRICTS, WORLD_HALF_EXTENT } from '../src/world/districts.js';
import { District } from '../src/world/District.js';
import { Sky } from '../src/world/Sky.js';
import { Hero } from '../src/entities/Hero.js';
import { createdContexts, installCanvasStub } from './support/canvas2d.js';

/**
 * world.test.js — the building realism pass.
 *
 * Covers the two corrections the design-spec review made mandatory (the parapet
 * collider, acceptance criterion 20; and the helipad's aspect compensation), the
 * placement maths behind the new instanced geometry, and the scene's worst-case
 * draw-call count.
 *
 * Everything here is headless. The scene-graph tests install the canvas stub in
 * tests/support/canvas2d.js — see that file for why that is legitimate here and
 * still not a licence to give Collision.js a DOM dependency.
 */

const R = HERO_RADIUS_M; // 0.35
const H = HERO_HEIGHT_M; // 1.85

/** The 90 m tower at index 2 — the building criterion 20 asks a human to land on. */
const TOWER = BLOCK.buildings[2];

// ---------------------------------------------------------------------------
// G1 parapet — Review §2, the correction without which criterion 20 regresses
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
    //
    // This is much narrower than the slab version it replaced, where the whole
    // 0.3 m outer lip did it. The real fix is step-up logic, already Phase 2.
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
    const towers = BLOCK.buildings.filter((b) => b.kind === 'tower').length;
    const rest = BLOCK.buildings.length - towers;
    expect(units.length).toBe(rest * 2 + towers * 3);
    expect(units.length).toBe(22);
  });

  it('is deterministic', () => {
    expect(hvacUnits()).toEqual(units);
  });

  it('keeps every unit inside its building parapet, never overhanging the coping', () => {
    let u = 0;
    for (const b of BLOCK.buildings) {
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
// Tier 2 atlas UVs
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
// The built scene: canvas drawing, colliders, draw calls
// ---------------------------------------------------------------------------

describe('StreetBlock, built', () => {
  /** @type {THREE.Scene} */
  let scene;
  /** @type {CollisionWorld} */
  let collision;
  /** @type {StreetBlock} */
  let block;
  /** Snapshot taken right after construction, so later tests that build another
   * block cannot contaminate the counts below. */
  let contexts;

  beforeAll(() => {
    installCanvasStub();
    scene = new THREE.Scene();
    collision = new CollisionWorld({ halfExtent: 150 });
    block = new StreetBlock({ scene, collision });
    contexts = createdContexts.slice();
  });

  it('registers a structural box AND four parapet bars for every building', () => {
    const units = hvacUnits().length;
    expect(collision.buildings.length).toBe(BLOCK.buildings.length * 5 + units);

    // Every bar of every building's coping ring must be present.
    for (const b of BLOCK.buildings) {
      for (const want of parapetBoxes(b)) {
        const found = collision.buildings.some(
          (box) =>
            Math.abs(box.min.x - want.min.x) < 1e-9 &&
            Math.abs(box.min.z - want.min.z) < 1e-9 &&
            Math.abs(box.max.x - want.max.x) < 1e-9 &&
            Math.abs(box.max.z - want.max.z) < 1e-9 &&
            Math.abs(box.max.y - want.max.y) < 1e-9,
        );
        expect(found).toBe(true);
      }
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

    // The band fill really is drawn at that rect, on every Tier 1 canvas.
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
    // Five Tier 1 variants x three maps (diffuse, roughness, metalness).
    expect(bandFills.length).toBe(15);
  });

  it('Review §1: draws the helipad inside the aspect compensation, so it is a circle', () => {
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

  it('creates 18 canvases: 5 Tier 1 variants + 1 bespoke atlas, x 3 maps each', () => {
    expect(contexts.length).toBe(18);
    // Every texture created is registered for disposal — the leak this guards
    // against is a climbing renderer.info.memory.textures across HMR reloads.
    const textures = block._disposables.filter((d) => d.isTexture);
    expect(textures.length).toBe(18);
  });

  it('disposes cleanly and drops every collider', () => {
    const local = new THREE.Scene();
    const world = new CollisionWorld({ halfExtent: 150 });
    const b = new StreetBlock({ scene: local, collision: world });
    expect(world.buildings.length).toBeGreaterThan(0);
    b.dispose();
    expect(world.buildings.length).toBe(0);
    expect(b._disposables.length).toBe(0);
    expect(local.children.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Worst-case draw calls — locked decision 7 wants a MEASURED worst case
// ---------------------------------------------------------------------------

/**
 * Count every object in a scene that would issue a draw call with NOTHING
 * culled.
 *
 * `renderer.info.render.calls` reports what was actually drawn last frame, so it
 * moves with frustum culling — which is why a human measured 42 and an earlier
 * reading said 45 without either being wrong. This walks the graph instead and
 * returns the static upper bound.
 *
 * TWO PASSES, NOT ONE. WebGLRenderer.render() calls `info.reset()` BEFORE
 * `shadowMap.render()` (WebGLRenderer.js:1702 then :1707), and the shadow map
 * issues its draws through the same `renderer.renderBufferDirect` that feeds
 * `info.update` — so every shadow caster costs a SECOND draw call. Any ledger
 * that counts only the main pass understates the worst case by the number of
 * casters in the scene.
 *
 * An InstancedMesh is one call regardless of instance count. A Color background
 * (as opposed to a Texture or CubeTexture one) is a clear, not a draw.
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

describe('worst-case draw calls', () => {
  it('is 57 with nothing culled: 32 in the main pass + 25 shadow casters', () => {
    installCanvasStub();
    const scene = new THREE.Scene();
    const collision = new CollisionWorld({ halfExtent: 150 });
    // eslint-disable-next-line no-new
    new Sky(scene);
    // eslint-disable-next-line no-new
    new StreetBlock({ scene, collision });
    // eslint-disable-next-line no-new
    new Hero({ scene, position: new THREE.Vector3(0, 0, 13) });

    const inv = drawCallInventory(scene);

    // Main pass, 32:
    //   street  21 = ground + roadway + 2 sidewalks + 2 curbs + centreline
    //                + 10 buildings + palm trunks/crowns + lamp posts/heads
    //   realism  4 = parapets + roof units + awnings + blade signs
    //   hero     7 = torso + head + 4 limbs + cape
    //   sky      0 = two lights and a Color background; no skybox mesh
    expect(inv.main.length).toBe(32);

    // Shadow pass, 25: every castShadow object above. The ground, the road
    // surfaces and the centreline dashes are deliberately excluded from casting.
    expect(inv.shadow.length).toBe(25);
    expect(inv.shadow).not.toContain('ground');
    expect(inv.shadow).not.toContain('centreline');

    expect(inv.total).toBe(57);
    // Acceptance criterion 6's Phase 1 ceiling. Locked decision 7 raises it for
    // Phase 2 from this measured worst case; until then it must still fit.
    expect(inv.total).toBeLessThanOrEqual(60);
  });

  it('the four new instanced items cost exactly 8 of those calls', () => {
    installCanvasStub();
    const scene = new THREE.Scene();
    const collision = new CollisionWorld({ halfExtent: 150 });
    // eslint-disable-next-line no-new
    new StreetBlock({ scene, collision });

    const added = ['roofParapets', 'roofUnits', 'awnings', 'bladeSigns'];
    const inv = drawCallInventory(scene);
    for (const name of added) {
      expect(inv.main).toContain(name);
      // One main-pass call and one shadow-pass call each.
      expect(inv.shadow).toContain(name);
    }
    expect(added.length * 2).toBe(8);
  });
});

// ---------------------------------------------------------------------------
// Phase 2 worst-case draw calls — the whole world, both passes
// ---------------------------------------------------------------------------

describe('Phase 2 worst-case draw calls', () => {
  it('is 83 with nothing culled: 49 main + 34 shadow, against the 150 ceiling', () => {
    installCanvasStub();
    const scene = new THREE.Scene();
    const collision = new CollisionWorld({ halfExtent: WORLD_HALF_EXTENT });
    // eslint-disable-next-line no-new
    new Sky(scene);
    // eslint-disable-next-line no-new
    new StreetBlock({ scene, collision });
    for (const spec of DISTRICTS) {
      // eslint-disable-next-line no-new
      new District({ scene, collision, spec });
    }
    // eslint-disable-next-line no-new
    new Hero({ scene, position: new THREE.Vector3(0, 0, 13) });

    const inv = drawCallInventory(scene);

    // WHY A GRAPH WALK AND NOT renderer.info. `info.render.calls` reports what
    // was actually drawn last frame, so it moves with frustum culling and with
    // the shadow camera's own extent — the browser reads 53 for the Phase 1
    // scene the ledger below counts as 57. This is the static upper bound, and
    // it is the number every budget figure in this project is quoted against.
    //
    // Phase 1 baseline: 32 main / 25 shadow / 57 total.
    // Phase 2 districts add 17 main / 9 shadow / 26 total:
    //   ground+road   8 main, 0 shadow  (4 merged surfaces x 2 districts, §6)
    //   families      7 main, 7 shadow  (3 in A + 4 in B, §4)
    //   landmarks     2 main, 2 shadow  (own Mesh each — no batched material
    //                                    override exists to fold them in)
    // which is EXACTLY §BGT-1's ground/road + facade families + landmark lines.
    expect(inv.main.length).toBe(49);
    expect(inv.shadow.length).toBe(34);
    expect(inv.total).toBe(83);

    // The Phase 2 ceiling, both passes (RESEARCH_PHASE_2_WORLD.md §BUD-6).
    expect(inv.total).toBeLessThanOrEqual(150);

    // §6 again, from the other direction: not one ground or road surface casts.
    for (const spec of DISTRICTS) {
      for (const surface of ['ground', 'roadway', 'sidewalk', 'curb']) {
        expect(inv.shadow).not.toContain(`${spec.id}_${surface}`);
      }
    }
  });

  it('the districts cost 26 calls — exactly the three §BGT-1 lines they cover', () => {
    installCanvasStub();
    const bare = new THREE.Scene();
    const withDistricts = new THREE.Scene();
    const c1 = new CollisionWorld({ halfExtent: WORLD_HALF_EXTENT });
    const c2 = new CollisionWorld({ halfExtent: WORLD_HALF_EXTENT });
    // eslint-disable-next-line no-new
    new StreetBlock({ scene: bare, collision: c1 });
    // eslint-disable-next-line no-new
    new StreetBlock({ scene: withDistricts, collision: c2 });
    for (const spec of DISTRICTS) {
      // eslint-disable-next-line no-new
      new District({ scene: withDistricts, collision: c2, spec });
    }

    const before = drawCallInventory(bare);
    const after = drawCallInventory(withDistricts);
    expect(after.main.length - before.main.length).toBe(17);
    expect(after.shadow.length - before.shadow.length).toBe(9);
    expect(after.total - before.total).toBe(26);
  });

  it('68 buildings cost 7 calls, not 136 — this is what batching buys', () => {
    installCanvasStub();
    const scene = new THREE.Scene();
    const collision = new CollisionWorld({ halfExtent: WORLD_HALF_EXTENT });
    const districts = DISTRICTS.map(
      (spec) => new District({ scene, collision, spec }),
    );

    const buildings = districts.reduce((n, d) => n + d.buildings.length, 0);
    expect(buildings).toBe(68);

    let batches = 0;
    let instances = 0;
    scene.traverse((o) => {
      if (o.isBatchedMesh) {
        batches++;
        instances += o.instanceCount;
      }
    });
    expect(batches).toBe(7);
    // Every massing box is its own geometry+instance inside its family's batch.
    expect(instances).toBe(170);
    // One mesh per building would be 68 main + 68 shadow = 136 calls, which
    // exhausts the 150 ceiling on buildings alone. BUD-3 is not polish.
    expect(batches * 2).toBeLessThan(buildings * 2);
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
  it('adds no renderable object to the scene, so the 57-call budget is unmoved', () => {
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

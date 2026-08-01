import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';

import {
  DISTRICT_A_FAMILIES,
  DISTRICT_B_FAMILIES,
  FACADE_FAMILIES,
} from '../src/world/facadeFamilies.js';
import {
  CELL_PITCH,
  DISTRICTS,
  STREET_LINES,
  WORLD_HALF_EXTENT,
  DISTRICT_A_ROTATION,
  DISTRICT_B_ROTATION,
  HALF_ROADWAY,
  ROW,
  SIDEWALK,
  SLOT_SPAN,
  buildingWorldBox,
  districtABuildings,
  districtBBuildings,
  localToWorld,
  slotCentres,
} from '../src/world/districts.js';
import { CollisionWorld } from '../src/world/Collision.js';
import { District } from '../src/world/District.js';
import { FACADE_VARIANTS } from '../src/world/StreetBlock.js';
import { MAST_SIGN_TEXT } from '../src/world/landmarks.js';
import { installCanvasStub } from './support/canvas2d.js';
import { TRIANGLES_PER_BOX, massingBoxes } from '../src/world/massing.js';

/**
 * districts.test.js — Phase 2 district data and geometry rules.
 *
 * Everything here is pure data and pure functions; the built scene graph is
 * covered in `world.test.js` alongside the Phase 1 draw-call ledger, so the
 * two-pass budget lives in one place rather than two.
 */

// ---------------------------------------------------------------------------
// §4 — the seven facade families, and locked decision 22
// ---------------------------------------------------------------------------

describe('facade families (§4)', () => {
  it('is exactly seven: three for District A, four for District B', () => {
    // The family count IS the building draw-call count (§BUD-3), so this
    // assertion is a budget assertion wearing a data assertion's clothes.
    expect(Object.keys(FACADE_FAMILIES)).toHaveLength(7);
    expect(DISTRICT_A_FAMILIES).toHaveLength(3);
    expect(DISTRICT_B_FAMILIES).toHaveLength(4);
    for (const id of [...DISTRICT_A_FAMILIES, ...DISTRICT_B_FAMILIES]) {
      expect(FACADE_FAMILIES[id]).toBeDefined();
    }
  });

  it('LOCKED DECISION 22: the shipped constants are reused BYTE-IDENTICALLY', () => {
    // Not "close to", not "based on". The user closed the metalness-raise
    // question three times; a Phase 2 family that quietly nudged towerShared
    // toward glassiness is exactly the regression that decision exists to stop.
    expect(FACADE_FAMILIES.fam1DarkCurtainWall).toEqual(FACADE_VARIANTS.towerShared);
    expect(FACADE_FAMILIES.fam4CreamStucco).toEqual(FACADE_VARIANTS.lowriseA);
    expect(FACADE_FAMILIES.fam6SteelBlueGlass).toEqual(FACADE_VARIANTS.midriseA);
    expect(FACADE_FAMILIES.fam7BronzeGlass).toEqual(FACADE_VARIANTS.midriseB);
  });

  it('FAM-5 adds a cornice course to lowriseB and changes NOTHING else', () => {
    // §4 asked for a retinted `band`. That is wrong and a browser screenshot
    // caught it: `band` is also the pixel every flat roof's UVs collapse onto,
    // so retinting it painted terracotta ROOFS across District B. The terracotta
    // is a separate string course now, and `band` keeps the shipped neutral.
    const fam5 = FACADE_FAMILIES.fam5OchreTerracotta;
    const shipped = FACADE_VARIANTS.lowriseB;
    expect(fam5.cornice).toBe(0xa85a3c);
    expect(fam5.band).toBe(shipped.band);
    for (const k of Object.keys(shipped)) expect(fam5[k]).toBe(shipped[k]);
  });

  it('no family retints `band`, because `band` is also the roof pixel', () => {
    // The general form of the FAM-5 defect. A family whose band is a saturated
    // accent colour has a saturated roof, on every building using it, seen from
    // the air — which is most of how this game is played.
    const saturation = (hex) => {
      const c = [(hex >> 16) & 0xff, (hex >> 8) & 0xff, hex & 0xff];
      return Math.max(...c) - Math.min(...c);
    };
    for (const [id, spec] of Object.entries(FACADE_FAMILIES)) {
      expect(saturation(spec.band), `${id}.band is not a roof neutral`).toBeLessThan(60);
    }
  });

  it('every family carries a full PBR spec, so none silently falls back to a default', () => {
    const required = [
      'wall',
      'window',
      'band',
      'columns',
      'wallRough',
      'wallMetal',
      'winRough',
      'winMetal',
    ];
    for (const [id, spec] of Object.entries(FACADE_FAMILIES)) {
      for (const k of required) expect(spec[k], `${id}.${k}`).toBeTypeOf('number');
    }
  });

  it('FAM-3 stays out of the near-black band its higher metalness could have caused', () => {
    // The proxy check DESIGN_SPEC_TOWER_PALETTE.md used, re-run: the surviving
    // diffuse term is albedo x (1 - metalness), and it must not land below the
    // shipped tower's already-browser-verified value.
    const fam3 = FACADE_FAMILIES.fam3LightSilverGlass;
    const shipped = FACADE_VARIANTS.towerShared;
    const minChannel = (hex) => Math.min((hex >> 16) & 0xff, (hex >> 8) & 0xff, hex & 0xff);
    const survives = (spec) => minChannel(spec.window) * (1 - spec.winMetal);
    expect(survives(fam3)).toBeGreaterThan(survives(shipped));
  });
});

// ---------------------------------------------------------------------------
// §5 — the five massing recipes
// ---------------------------------------------------------------------------

describe('massing recipes (§5)', () => {
  const stack = (recipe, b) => massingBoxes(recipe, { seed: 3, ...b });

  it('emits the box counts §5 specifies', () => {
    expect(stack('mas1', { w: 20, h: 90, d: 28 })).toHaveLength(2);
    expect(stack('mas2', { w: 18, h: 50, d: 26 })).toHaveLength(4);
    expect(stack('mas4', { w: 18, h: 11, d: 20 })).toHaveLength(2);
    expect(stack('mas5', { w: 20, h: 30, d: 24 })).toHaveLength(3);
    // MAS-3 is 5 boxes, NOT §5's 2-4: locked decision 19 added a sculpted
    // non-flat crown after the spec was written. See massing.js.
    expect(stack('mas3', { w: 22, h: 150, d: 32 })).toHaveLength(5);
  });

  it('every stack starts on the ground and finishes at exactly the stated height', () => {
    const cases = [
      ['mas1', { w: 20, h: 90, d: 28 }],
      ['mas2', { w: 18, h: 50, d: 26 }],
      ['mas3', { w: 22, h: 150, d: 32 }],
      ['mas4', { w: 18, h: 11, d: 20 }],
      ['mas5', { w: 20, h: 30, d: 24 }],
    ];
    for (const [recipe, b] of cases) {
      const boxes = stack(recipe, b);
      const bottom = Math.min(...boxes.map((x) => x.cy - x.h / 2));
      const top = Math.max(...boxes.map((x) => x.cy + x.h / 2));
      expect(bottom, recipe).toBeCloseTo(0, 9);
      expect(top, recipe).toBeCloseTo(b.h, 9);
    }
  });

  it('leaves no vertical gap between stacked boxes', () => {
    // A gap would be a floating slab with daylight under it — the exact defect a
    // stacked-box recipe is most likely to produce and least likely to be
    // noticed from a screenshot taken at street level.
    for (const [recipe, b] of [
      ['mas1', { w: 20, h: 90, d: 28 }],
      ['mas2', { w: 18, h: 50, d: 26 }],
      ['mas3', { w: 22, h: 150, d: 32 }],
      ['mas4', { w: 18, h: 11, d: 20 }],
      ['mas5', { w: 20, h: 30, d: 24 }],
    ]) {
      const spans = stack(recipe, b)
        .map((x) => [x.cy - x.h / 2, x.cy + x.h / 2])
        .sort((p, q) => p[0] - q[0]);
      for (let i = 1; i < spans.length; i++) {
        expect(spans[i][0], `${recipe} box ${i}`).toBeCloseTo(spans[i - 1][1], 9);
      }
    }
  });

  it('every box has positive dimensions at the smallest authored footprint', () => {
    // MAS-2 insets 6.4 m off the width by its cap. District A's narrowest
    // secondary footprint is 16 m, which leaves 9.6 m — this pins that the
    // inset ladder never inverts.
    for (const boxes of [
      stack('mas2', { w: 16, h: 40, d: 22 }),
      stack('mas1', { w: 16, h: 40, d: 22 }),
      stack('mas4', { w: 16, h: 8, d: 18 }),
      stack('mas5', { w: 16, h: 24, d: 22 }),
    ]) {
      for (const box of boxes) {
        expect(box.w).toBeGreaterThan(0);
        expect(box.d).toBeGreaterThan(0);
        expect(box.h).toBeGreaterThan(0);
      }
    }
  });

  it('MAS-5 gives the cornice a real overhang — the one box that grows', () => {
    const [, slab, cornice] = stack('mas5', { w: 20, h: 30, d: 24 });
    expect(cornice.w).toBeCloseTo(20 + 1.2, 9);
    expect(cornice.d).toBeCloseTo(24 + 1.2, 9);
    expect(cornice.w).toBeGreaterThan(slab.w);
  });

  it('decision 19: MAS-3’s crown is asymmetric, which is what makes it read as sculpted', () => {
    const boxes = stack('mas3', { w: 22, h: 150, d: 32 });
    const [podium, shaft, step1, step2, spire] = boxes;
    expect(podium.cx).toBe(0);
    expect(shaft.cx).toBe(0);
    // The crown steps and the spire lean off-centre; a concentric crown would
    // just read as a smaller box from every angle.
    expect(step1.cx).toBeGreaterThan(0);
    expect(step2.cx).toBeGreaterThan(step1.cx);
    expect(spire.cx).toBe(step2.cx);
    // And it really is non-flat: each level is strictly narrower than the last.
    expect(step1.w).toBeLessThan(shaft.w);
    expect(step2.w).toBeLessThan(step1.w);
    expect(spire.w).toBeLessThan(step2.w);
  });

  it('is deterministic — the same seed builds the same stack', () => {
    expect(stack('mas2', { w: 18, h: 50, d: 26 })).toEqual(
      stack('mas2', { w: 18, h: 50, d: 26 }),
    );
  });

  it('a BoxGeometry really is 12 triangles, so the triangle arithmetic holds', () => {
    // [MEASURED] rather than asserted from the spec's prose.
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const tris = (geo.index ? geo.index.count : geo.attributes.position.count) / 3;
    expect(tris).toBe(TRIANGLES_PER_BOX);
    geo.dispose();
  });
});

// ---------------------------------------------------------------------------
// §1/§2 + locked decision 10 — the two districts
// ---------------------------------------------------------------------------

describe('district layout (locked decision 10)', () => {
  it('District A is on the 36° grid and District B is cardinal', () => {
    // THE ROTATION DIFFERENCE IS THE POINT of the pairing — it is what buys
    // per-district lighting differentiation for free. If this ever collapses to
    // two equal rotations, decision 10 has been silently undone.
    const [a, b] = DISTRICTS;
    expect(a.rotation).toBeCloseTo((36 * Math.PI) / 180, 12);
    expect(DISTRICT_A_ROTATION).toBe(a.rotation);
    expect(b.rotation).toBe(0);
    expect(DISTRICT_B_ROTATION).toBe(0);
    expect(a.rotation).not.toBe(b.rotation);
  });

  it('lays out 36 slots on the S-470-1 street section', () => {
    const slots = slotCentres();
    expect(slots).toHaveLength(36);
    // The buildable strip between two streets, and the slot span inside it.
    expect(CELL_PITCH - ROW).toBeCloseTo(69.52, 9);
    expect(SLOT_SPAN).toBeCloseTo(34.76, 9);
    // The section reconciles: roadway + two sidewalks = the right-of-way.
    expect(HALF_ROADWAY * 2 + SIDEWALK * 2).toBeCloseTo(ROW, 9);
  });

  it('no building footprint crosses the sidewalk into the roadway', () => {
    // The failure this guards against is a tower standing in the street, which
    // is both wrong and un-walkable.
    for (const district of DISTRICTS) {
      for (const b of district.buildings()) {
        expect(b.w, `${district.id} width`).toBeLessThanOrEqual(SLOT_SPAN);
        expect(b.d, `${district.id} depth`).toBeLessThanOrEqual(SLOT_SPAN);
      }
      const lm = district.landmark;
      if (lm.kind === 'tower') {
        // The landmark takes the whole central lot, so it gets the full cell.
        expect(Math.max(lm.w, lm.d)).toBeLessThanOrEqual(CELL_PITCH - ROW);
      }
    }
  });

  it('District A is a plateau: tower-class only, no lowrise band', () => {
    const buildings = districtABuildings();
    expect(buildings).toHaveLength(32);
    for (const b of buildings) {
      // §DIS-2: narrow the height variety relative to Phase 1's mixed block.
      // Podium-only annexes are the floor at 15 m; nothing dips into lowrise.
      expect(b.h).toBeGreaterThanOrEqual(15);
      expect(b.h).toBeLessThanOrEqual(110);
    }
    const primary = buildings.filter((b) => b.band === 'primary');
    const secondary = buildings.filter((b) => b.band === 'secondary');
    const podium = buildings.filter((b) => b.band === 'podium');
    expect(primary).toHaveLength(21);
    expect(secondary).toHaveLength(9);
    expect(podium).toHaveLength(2);
    for (const b of primary) expect(b.h).toBeGreaterThanOrEqual(70);
    for (const b of secondary) {
      expect(b.h).toBeGreaterThanOrEqual(40);
      expect(b.h).toBeLessThan(60.001);
    }
  });

  it('District B is a corridor: nothing exceeds the 46 m pre-1957 cap', () => {
    const buildings = districtBBuildings();
    expect(buildings).toHaveLength(36);
    for (const b of buildings) expect(b.h).toBeLessThanOrEqual(46);
    expect(buildings.filter((b) => b.band === 'lowrise')).toHaveLength(20);
    expect(buildings.filter((b) => b.band === 'midrise')).toHaveLength(14);
    expect(buildings.filter((b) => b.band === 'tallMidrise')).toHaveLength(2);
  });

  it('the two districts stay silhouette-distinct, which is §DEN-3’s whole ask', () => {
    const aMin = Math.min(...districtABuildings().map((b) => b.h));
    const bMax = Math.max(...districtBBuildings().map((b) => b.h));
    // District B's tallest ordinary building sits at the old cap; District A's
    // shortest ordinary structure is a podium annex. The two bands only touch
    // at the annex, never in the tower range.
    expect(bMax).toBe(46);
    expect(aMin).toBeGreaterThanOrEqual(15);
    const [a, b] = DISTRICTS;
    expect(a.landmark.h).toBe(150);
    expect(b.landmark.h).toBe(75);
    expect(b.landmark.kind).toBe('mast'); // locked decision 20: NOT a building
  });

  it('every building references a family its own district actually builds', () => {
    // A typo here would silently drop a building into no batch at all.
    for (const district of DISTRICTS) {
      const allowed = new Set(district.families);
      for (const b of district.buildings()) {
        expect(allowed.has(b.family), `${district.id}/${b.family}`).toBe(true);
        if (b.podiumFamily) expect(allowed.has(b.podiumFamily)).toBe(true);
      }
    }
  });

  it('populates every family it pays two draw calls for', () => {
    // An empty BatchedMesh still costs its main+shadow call. Seven families are
    // budgeted; seven must earn their place.
    for (const district of DISTRICTS) {
      const used = new Set();
      for (const b of district.buildings()) {
        used.add(b.family);
        if (b.podiumFamily) used.add(b.podiumFamily);
      }
      for (const id of district.families) {
        expect(used.has(id), `${district.id}: ${id} is unused`).toBe(true);
      }
    }
  });

  it('is deterministic across calls', () => {
    expect(districtABuildings()).toEqual(districtABuildings());
    expect(districtBBuildings()).toEqual(districtBBuildings());
  });
});

// ---------------------------------------------------------------------------
// Local -> world, and the rotated-footprint collider approximation
// ---------------------------------------------------------------------------

describe('district placement maths', () => {
  it('localToWorld matches Object3D’s own yaw convention', () => {
    // Derived independently rather than trusted: build the same transform with
    // three.js and compare. A sign error here mirrors a whole district and is
    // invisible in a screenshot.
    for (const district of DISTRICTS) {
      const group = new THREE.Object3D();
      group.position.set(district.origin.x, 0, district.origin.z);
      group.rotation.y = district.rotation;
      group.updateMatrixWorld(true);

      for (const [lx, lz] of [
        [0, 0],
        [117.38, -82.62],
        [-50, 150],
      ]) {
        const v = new THREE.Vector3(lx, 0, lz).applyMatrix4(group.matrixWorld);
        const got = localToWorld(lx, lz, district);
        expect(got.x).toBeCloseTo(v.x, 9);
        expect(got.z).toBeCloseTo(v.z, 9);
      }
    }
  });

  it('the rotated collider circumscribes the building — never smaller than it', () => {
    // The approximation is documented in districts.js; this pins its DIRECTION.
    // Erring large keeps the hero outside geometry; erring small would let the
    // camera and the capsule enter a wall.
    const [a] = DISTRICTS;
    const b = { lx: 0, lz: 0, w: 22, d: 32, h: 150 };
    const box = buildingWorldBox(b, a);
    const size = box.getSize(new THREE.Vector3());
    expect(size.x).toBeGreaterThan(b.w);
    expect(size.z).toBeGreaterThan(b.d);
    expect(size.x).toBeCloseTo(22 * Math.cos(a.rotation) + 32 * Math.sin(a.rotation), 9);
    expect(size.y).toBe(150);
  });

  it('District B’s cardinal grid needs no inflation at all', () => {
    const [, b] = DISTRICTS;
    const box = buildingWorldBox({ lx: 20, lz: -40, w: 18, d: 24, h: 30 }, b);
    const size = box.getSize(new THREE.Vector3());
    expect(size.x).toBeCloseTo(18, 9);
    expect(size.z).toBeCloseTo(24, 9);
    expect(box.min.x).toBeCloseTo(320 + 20 - 9, 9);
  });

  it('keeps both districts and the Phase 1 block inside the bounded world', () => {
    for (const district of DISTRICTS) {
      for (const b of district.buildings()) {
        const box = buildingWorldBox(b, district);
        expect(Math.abs(box.min.x)).toBeLessThanOrEqual(610);
        expect(Math.abs(box.max.x)).toBeLessThanOrEqual(610);
        expect(Math.abs(box.min.z)).toBeLessThanOrEqual(610);
        expect(Math.abs(box.max.z)).toBeLessThanOrEqual(610);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// The built districts — the §BUD-2 ground/road trap and the §BGT-1 ledger
// ---------------------------------------------------------------------------

describe('District, built', () => {
  /** @type {THREE.Scene} */
  let scene;
  /** @type {CollisionWorld} */
  let collision;
  /** @type {District[]} */
  let districts;

  beforeAll(() => {
    installCanvasStub();
    scene = new THREE.Scene();
    collision = new CollisionWorld({ halfExtent: WORLD_HALF_EXTENT });
    districts = DISTRICTS.map((spec) => new District({ scene, collision, spec }));
  });

  it('BUD-2: ground and road are FOUR meshes per district, not seven per tile', () => {
    // This is the single biggest budget risk in the whole phase. Phase 1 builds
    // 7 ground/road meshes for one block; repeating that per 256 m chunk costs
    // 7 x 64 = 448 draw calls before a single building, and §BUD-2 calls a
    // design that implies it unshippable. So: merged per surface type, per
    // district, and MEASURED here rather than asserted in a comment.
    for (const d of districts) {
      const surfaces = ['ground', 'roadway', 'sidewalk', 'curb'].map(
        (s) => `${d.spec.id}_${s}`,
      );
      const found = surfaces.filter((name) => scene.getObjectByName(name));
      expect(found).toHaveLength(4);
      // And none of them casts — §6, and Phase 1's own convention.
      for (const name of surfaces) {
        expect(scene.getObjectByName(name).castShadow, name).toBe(false);
      }
    }
  });

  it('BUD-2: the road mesh count does not move with the number of streets', () => {
    // The property that actually matters is that surfaces are merged, so adding
    // a street adds triangles and not draw calls. Assert on the merged geometry
    // instead of on the mesh count alone, which a single street would also pass.
    for (const d of districts) {
      const roadway = scene.getObjectByName(`${d.spec.id}_roadway`);
      // Each street line contributes one full-length strip along its own axis
      // plus (lines + 1) segments across the perpendicular streets, and all of
      // it lands in ONE geometry.
      const quads = STREET_LINES.length * (1 + (STREET_LINES.length + 1));
      expect(roadway.geometry.index.count / 3).toBe(quads * 2);
      expect(roadway.geometry.groups.length).toBeLessThanOrEqual(1);
    }
  });

  it('there is no centreline MESH anywhere — §6 folds it into the road texture', () => {
    // Phase 1's seventh ground/road mesh is an InstancedMesh of dashes. Removing
    // that whole category district-wide is the entire difference between §6's
    // 8-call line and BUD-6's ~10-16 estimate.
    let dashes = 0;
    scene.traverse((o) => {
      if (o.isInstancedMesh && /centre|center|dash/i.test(o.name)) dashes++;
    });
    expect(dashes).toBe(0);
  });

  it('§4: one BatchedMesh per facade family, and every family is populated', () => {
    for (const d of districts) {
      expect(d.batches.size).toBe(d.spec.families.length);
      for (const [id, batch] of d.batches) {
        expect(batch.isBatchedMesh, id).toBe(true);
        expect(batch.castShadow).toBe(true);
        // An empty batch would still cost its two draw calls.
        expect(batch.instanceCount, `${d.spec.id}/${id}`).toBeGreaterThan(0);
      }
    }
    expect(districts[0].batches.size).toBe(3);
    expect(districts[1].batches.size).toBe(4);
  });

  it('§DA-4/§DB-4: both landmarks exist as their own non-batched Mesh', () => {
    // BatchedMesh has no per-instance material override (RVW-7), so a bespoke
    // atlas cannot join a batch. The 4-call landmarks line is load-bearing.
    for (const d of districts) {
      const lm = scene.getObjectByName(`${d.spec.id}_landmark`);
      expect(lm).toBeDefined();
      expect(lm.isBatchedMesh).toBeFalsy();
      expect(lm.isMesh).toBe(true);
      expect(lm.castShadow).toBe(true);
      // One material, one merged geometry: "its own mesh" must mean 2 calls,
      // not 2 per part.
      expect(Array.isArray(lm.material)).toBe(false);
    }
  });

  it('the landmarks stand at the heights the spec and decisions 19/20 fix', () => {
    const a = scene.getObjectByName('districtA_landmark');
    const b = scene.getObjectByName('districtB_landmark');
    a.geometry.computeBoundingBox();
    b.geometry.computeBoundingBox();
    expect(a.geometry.boundingBox.max.y).toBeCloseTo(150, 6);
    expect(b.geometry.boundingBox.max.y).toBeCloseTo(75, 6);
  });

  it('the mast sign carries only the user-approved name (decisions 6/20/23)', () => {
    // Locked decision 6 reserves ALL naming to the user, and decision 20
    // restates it for this structure. This string arrived by explicit sign-off
    // on 2026-08-01 and is locked as decision 23.
    //
    // The assertion is not that this particular text is aesthetically right --
    // it is that a name here can only ever change by the same route it arrived.
    // A future edit that quietly swaps it should fail a test rather than pass
    // unnoticed, which is the whole reason the placeholder it replaced was
    // deliberately implausible.
    expect(MAST_SIGN_TEXT).toBe('AKC ENTERPRISE');
  });

  it('the grid group carries the district rotation, not the ground plane', () => {
    // Rotating the featureless ground would buy nothing and would stop it
    // covering its half of the world. The split is deliberate; pin it.
    for (const d of districts) {
      expect(d.grid.rotation.y).toBe(d.spec.rotation);
      expect(d.group.rotation.y).toBe(0);
      const ground = scene.getObjectByName(`${d.spec.id}_ground`);
      expect(ground.parent).toBe(d.group);
      expect(ground.position.y).toBeLessThan(0); // under Phase 1's block ground
    }
  });

  it('registers one collider per building plus one per landmark', () => {
    const expected = DISTRICTS.reduce((n, s) => n + s.buildings().length + 1, 0);
    expect(collision.buildings.length).toBe(expected);
  });

  it('disposes cleanly', () => {
    const local = new THREE.Scene();
    const world = new CollisionWorld({ halfExtent: WORLD_HALF_EXTENT });
    const d = new District({ scene: local, collision: world, spec: DISTRICTS[1] });
    expect(local.children.length).toBe(1);
    d.dispose();
    expect(local.children.length).toBe(0);
    expect(d._disposables.length).toBe(0);
  });
});

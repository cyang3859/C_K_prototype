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
  DISTRICT_HALF,
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
  dealBands,
  localToWorld,
  slotCentres,
} from '../src/world/districts.js';
import { CollisionWorld } from '../src/world/Collision.js';
import { District } from '../src/world/District.js';
import { FACADE_VARIANTS } from '../src/world/annex.js';
import { MAST_SIGN_TEXT } from '../src/world/landmarks.js';
import { HILL_NAME } from '../src/world/terrain.js';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { TUNING } from '../src/config/tuning.js';
import { installCanvasStub } from './support/canvas2d.js';
import {
  allPropPlacements,
  districtLocalToWorld,
  districtPropPlacements,
  localKeepOutBoxes,
  roofOf,
} from '../src/world/props.js';
import { WorldProps } from '../src/world/WorldProps.js';
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
  it('is exactly seven: three for District A, five batches in District B', () => {
    // The family count IS the building draw-call count (§BUD-3), so this
    // assertion is a budget assertion wearing a data assertion's clothes.
    //
    // §4 authors SEVEN families and that has not changed. District B draws on
    // FIVE of them, not four: locked decision 24 folded Phase 1's block into it,
    // and the block's 64 m tower is painted in the shipped `towerShared` palette
    // that FAM-1 already carries. Giving District B its own FAM-1 batch costs
    // +1 main / +1 shadow and preserves a reviewed building exactly; repainting
    // it in one of District B's own four would have been free but would have
    // changed how shipped content looks to make a ledger tidier.
    expect(Object.keys(FACADE_FAMILIES)).toHaveLength(7);
    expect(DISTRICT_A_FAMILIES).toHaveLength(3);
    expect(DISTRICT_B_FAMILIES).toHaveLength(5);
    expect(DISTRICT_B_FAMILIES).toContain('fam1DarkCurtainWall');
    for (const id of [...DISTRICT_A_FAMILIES, ...DISTRICT_B_FAMILIES]) {
      expect(FACADE_FAMILIES[id]).toBeDefined();
    }
  });

  it('LOCKED DECISION 22: the shipped constants are reused BYTE-IDENTICALLY', () => {
    // Not "close to", not "based on". The user closed the metalness-raise
    // question three times; a Phase 2 family that quietly nudged towerShared
    // toward glassiness is exactly the regression that decision exists to stop.
    //
    // ⚠️ THE ANCHOR BELOW IS THE POINT, and the session-11 code review caught its
    // absence. This test used to assert ONLY the four lines further down --
    // family against variant -- but every family IS a spread of its variant
    // (`facadeFamilies.js:34`), so it proved that the spread operator works.
    // Raising towerShared.winMetal in annex.js moved BOTH sides and the whole
    // suite still passed: the lock was not broken, it simply was not locked.
    //
    // These literals are the values Phase 1 shipped, read off
    // `05eb5df:src/world/StreetBlock.js`. They are duplicated ON PURPOSE. A
    // golden snapshot has to live outside the file it guards or it guards
    // nothing, and this is the one place in the repo where restating a constant
    // is the correct thing to do rather than a smell.
    expect(FACADE_VARIANTS.towerShared).toEqual({
      wall: 0x828fa0,
      window: 0x32475e,
      band: 0x4a4844,
      columns: 5,
      wallRough: 0.4,
      wallMetal: 0.32,
      winRough: 0.1,
      winMetal: 0.5,
    });
    expect(FACADE_VARIANTS.midriseA).toEqual({
      wall: 0x8f96a3,
      window: 0x1f2c3a,
      band: 0x6a675f,
      columns: 4,
      wallRough: 0.45,
      wallMetal: 0.4,
      winRough: 0.12,
      winMetal: 0.65,
    });
    expect(FACADE_VARIANTS.midriseB).toEqual({
      wall: 0x8a7a68,
      window: 0x2e2519,
      band: 0x6a675f,
      columns: 4,
      wallRough: 0.45,
      wallMetal: 0.4,
      winRough: 0.12,
      winMetal: 0.65,
    });
    expect(FACADE_VARIANTS.lowriseA).toEqual({
      wall: 0xd9c6a0,
      window: 0x293b4d,
      band: 0xb8a888,
      columns: 3,
      wallRough: 0.98,
      wallMetal: 0.0,
      winRough: 0.22,
      winMetal: 0.45,
    });

    // And only THEN that the Phase 2 families still reuse them unchanged.
    expect(FACADE_FAMILIES.fam1DarkCurtainWall).toEqual(FACADE_VARIANTS.towerShared);
    expect(FACADE_FAMILIES.fam4CreamStucco).toEqual(FACADE_VARIANTS.lowriseA);
    expect(FACADE_FAMILIES.fam6SteelBlueGlass).toEqual(FACADE_VARIANTS.midriseA);
    expect(FACADE_FAMILIES.fam7BronzeGlass).toEqual(FACADE_VARIANTS.midriseB);
  });

  it('the fence and the world geometry are the SAME 610, not two of them', () => {
    // `PLAYABLE_HALF_EXTENT` is what the running game passes to CollisionWorld
    // (Game.js); `WORLD_HALF_EXTENT` is derived from District A's 36°-rotated
    // envelope and is what every test constructs a world with. Two independent
    // constants encoded "the true edge", and tuning.js's own comment said this
    // one "must track it" -- in prose. So the shipped fence sat at the true edge
    // by coincidence, and the tests never exercised the number the game runs
    // with. Move District A and the fence silently stays put, ending up inside
    // built geometry: exactly the "unreachable safety net, never the player's
    // experience" property of locked decision 11, broken. Found by the
    // session-11 code review.
    expect(TUNING.PLAYABLE_HALF_EXTENT).toBe(WORLD_HALF_EXTENT);

    // And the derivation still holds: District A's rotated envelope is what sets
    // the number, so it must actually fit inside the fence.
    const envelope = 300 * (Math.cos(DISTRICT_A_ROTATION) + Math.sin(DISTRICT_A_ROTATION));
    const a = DISTRICTS.find((d) => d.id === 'districtA');
    expect(Math.abs(a.origin.x) + envelope / 2).toBeLessThanOrEqual(WORLD_HALF_EXTENT);
  });

  it('REFACTOR GUARD: every building and prop placement in the world is frozen', () => {
    // Added 2026-08-02 BEFORE the code review's duplication cleanup (Standards
    // 4, 5, 8, 10), as the safety net for it. Those refactors touch the
    // generators for 68 buildings and ~1,400 prop instances, and the one thing
    // that must not change is a single number any of them produces.
    //
    // Digested rather than enumerated because the enumeration is the world. A
    // failure here means a "pure" refactor moved something -- go and find out
    // what before regenerating anything.
    const digest = (o) =>
      createHash('sha256')
        .update(
          JSON.stringify(
            JSON.parse(
              JSON.stringify(o, (k, v) => (typeof v === 'number' ? Number(v.toFixed(6)) : v)),
            ),
          ),
        )
        .digest('hex')
        .slice(0, 16);

    expect({ districtA: digest(districtABuildings()), districtB: digest(districtBBuildings()) })
      .toEqual({ districtA: 'faffed3953de4979', districtB: '77d28831ca0db211' });

    const p = allPropPlacements();
    const got = Object.fromEntries(Object.keys(p).sort().map((k) => [k, digest(p[k])]));
    expect(got).toEqual({
      awnings: '215cba52e1f1e8fd',
      bladeSigns: '6f41e28f42013c0d',
      bollards: '6fa4f2dcc4017b80',
      cafeProps: 'eff3cd6461b39138',
      canaryPalms: '2b81b612a0083c87',
      hvac: 'f50da0c6767e4512',
      hvacColliders: 'c61804aff37837cc',
      lamps: '13237cd283dbe553',
      mexicanPalms: '5ca418f34807b1f6',
      parapetColliders: 'ab8146e814ff752e',
      parapets: 'd494e3c0fb77b0b8',
      parkedCars: '874a03ba8df28146',
      scaffolding: '45e7c6dea28e7813',
      shadeTrees: 'd2b2ca846c4cdada',
      smallProps: 'c1b5e7dc8b217f27',
      utilityPoles: 'ee6cf9f2620541a9',
    });
  });

  it('dealBands leaves no holes, for any total a third district might use', () => {
    // The stride used to be `total % 2 === 0 ? total / 2 + 1 : 3` under a comment
    // asserting it was coprime with `total`. That held for the only two totals
    // this file passes (32, 36) and failed for many others -- 10, 30 and 33 all
    // share a factor -- and when it failed it failed SILENTLY: the count check
    // has already passed, so the deal simply left `undefined` holes that every
    // consumer read straight through to its final `else`. This file exists so
    // "a third district is data rather than a rewrite", which makes untested
    // totals the case that matters. Found by the session-11 code review.
    for (let total = 4; total <= 64; total++) {
      const counts = [
        ['primary', Math.floor(total / 2)],
        ['secondary', Math.ceil(total / 2) - 1],
        ['podium', 1],
      ];
      const bands = dealBands(total, counts);
      expect(bands, `total ${total}`).toHaveLength(total);
      expect(bands.filter((b) => b === undefined), `holes at total ${total}`).toEqual([]);
      // And the deal is EXACT -- the property the function exists for.
      for (const [name, n] of counts) {
        expect(bands.filter((b) => b === name).length, `${name} at total ${total}`).toBe(n);
      }
    }
  });

  it('dealBands still deals 32 and 36 exactly as it shipped', () => {
    // The searched stride must return 17 and 19 for the two totals in the build,
    // or the fix would silently re-lay both districts.
    // Literals, not the formula -- recomputing the implementation would make
    // this test agree with any stride the code happened to pick.
    for (const [total, stride] of [
      [32, 17],
      [36, 19],
    ]) {
      const bands = dealBands(total, [
        ['primary', total - 3],
        ['secondary', 2],
        ['podium', 1],
      ]);
      const expected = new Array(total);
      const pool = [
        ...Array(total - 3).fill('primary'),
        'secondary',
        'secondary',
        'podium',
      ];
      for (let i = 0; i < total; i++) expected[(i * stride) % total] = pool[i];
      expect(bands).toEqual(expected);
    }
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
      // it lands in ONE geometry. District B's absorbed annex boulevard (locked
      // decision 24) adds one more strip to the SAME geometry — which is the
      // whole point: six Phase 1 meshes became zero.
      const annexQuads = (d.spec.annexStreets ?? []).length;
      const quads = STREET_LINES.length * (1 + (STREET_LINES.length + 1)) + annexQuads;
      expect(roadway.geometry.index.count / 3).toBe(quads * 2);
      expect(roadway.geometry.groups.length).toBeLessThanOrEqual(1);
    }
  });

  it('the annex boulevard reaches the district grid (decision 27)', () => {
    // Run 2 left the boulevard dead-ending 20 m short of District B's grid:
    // floored but empty, and a traversal dead end for anyone walking east. The
    // user's call on 2026-08-01 was to join them. These assertions pin the join
    // itself, not the cosmetics.
    const b = DISTRICTS.find((d) => d.id === 'districtB');
    const [boulevard, connector] = b.annexStreets;

    // 1. The boulevard runs along X and now ends at the connector's west kerb,
    //    NOT at the annex's old east edge (-170).
    expect(boulevard.axis).toBe('x');
    expect(boulevard.to).toBeCloseTo(-DISTRICT_HALF - HALF_ROADWAY, 9);
    expect(boulevard.to).toBeGreaterThan(-170);

    // 2. A north-south connector sits ON the district boundary. It has to: the
    //    boulevard runs at local z = 0, which is a CELL CENTRE and not a street
    //    line, so continuing straight would drive it into the building row.
    expect(connector.axis).toBe('z');
    expect(connector.line).toBeCloseTo(-DISTRICT_HALF, 9);
    expect(STREET_LINES).not.toContain(0);

    // 3. The connector spans between BOTH cross-streets, stopping a half-roadway
    //    short of each so the quads abut rather than overlap. Coplanar roadway
    //    at the same y is a z-fight, and it is invisible in a mesh count.
    expect(connector.from).toBeCloseTo(STREET_LINES[0] + HALF_ROADWAY, 9);
    expect(connector.to).toBeCloseTo(STREET_LINES[1] - HALF_ROADWAY, 9);

    // 4. The boulevard's east end and the connector's west kerb are the SAME
    //    line -- no gap left, no overlap introduced.
    expect(boulevard.to).toBeCloseTo(connector.line - HALF_ROADWAY, 9);
  });

  it('the coping ring stops the hero on a GENERATED District B roof too', () => {
    // Finding S1 from the session-11 code review, and the behaviour it is
    // actually about rather than a collider count. The annex's buildings have
    // had parapet colliders since Phase 1; District B's generated buildings did
    // not, so the ring stopped a hero walking off one roof and not off the roof
    // next door -- same district, same visual coping. User's call, 2026-08-02.
    //
    // Built with its own world because the props (which own these colliders) are
    // world-shared and are not part of this suite's district-only fixture.
    const local = new THREE.Scene();
    const world = new CollisionWorld({ halfExtent: WORLD_HALF_EXTENT });
    const b = DISTRICTS.find((d) => d.id === 'districtB');
    const district = new District({ scene: local, collision: world, spec: b });
    const props = new WorldProps({ scene: local, collision: world });

    const generated = b.buildings().filter((x) => x.band !== 'annex');
    expect(generated.length).toBeGreaterThan(0);

    const target = generated[0];
    const roof = roofOf(target);
    const w = districtLocalToWorld({ lx: roof.x, lz: roof.z }, b);

    // Walk east from the roof centre, straight at the coping.
    const pos = { x: w.x, y: roof.h, z: w.z };
    let pushed = false;
    for (let i = 0; i < 400; i++) {
      const prevY = pos.y;
      pos.x += 0.125;
      const r = world.resolve(pos, 0.35, 1.85, { previousY: prevY });
      if (r.pushed) pushed = true;
    }

    expect(pushed, 'the coping pushed back').toBe(true);
    // And the hero is still ON the roof, not out in the air past its edge.
    expect(pos.x).toBeLessThan(w.x + roof.w / 2);
    expect(pos.y).toBeCloseTo(roof.h, 6);

    props.dispose();
    district.dispose();
  });

  it('District A is deliberately NOT given parapet colliders', () => {
    // The exclusion is not an oversight and should fail loudly if someone
    // "fixes" it: District A's grid is yawed 36°, and a circumscribed AABB
    // around a bar this long and this thin is mostly empty space -- it would
    // wall off roof area for no visible reason. Same documented limitation as
    // its building colliders.
    const a = DISTRICTS.find((d) => d.id === 'districtA');
    const bSpec = DISTRICTS.find((d) => d.id === 'districtB');
    expect(a.rotation).not.toBe(0);
    expect(bSpec.rotation).toBe(0);

    const opts = { roofProps: true };
    expect(districtPropPlacements(a, opts).parapetColliders).toHaveLength(0);
    // ...and District B's generated buildings DO get them: 36 buildings x 4 bars.
    expect(districtPropPlacements(bSpec, opts).parapetColliders).toHaveLength(144);
  });

  it('no annex sidewalk or curb is laid ACROSS an annex roadway (decision 27)', () => {
    // THIS IS THE TEST THAT WAS MISSING, and its absence is why the defect
    // shipped. The assertions above pin the DECLARED spec numbers -- axis, line,
    // from/to -- and every one of them passed while the connector's west
    // sidewalk lay straight across the mouth of the T-junction. They verified
    // the declaration and never the road.
    //
    // The rule being enforced is `_buildRoads`'s own, stated there in prose and
    // applied to the grid but not, until now, to the annex: "a sidewalk slab
    // laid across a roadway is a slab in the street." So walk the BUILT vertices
    // and assert none of them sits inside an annex carriageway.
    const b = DISTRICTS.find((d) => d.id === 'districtB');
    const rects = b.annexStreets.map((s) =>
      s.axis === 'x'
        ? { x0: s.from, x1: s.to, z0: s.line - HALF_ROADWAY, z1: s.line + HALF_ROADWAY }
        : { x0: s.line - HALF_ROADWAY, x1: s.line + HALF_ROADWAY, z0: s.from, z1: s.to },
    );

    // Strict interior: strips legitimately ABUT a roadway edge, and a shared
    // edge is the correct result rather than a violation.
    const EPS = 0.01;
    const inside = (x, z, r) =>
      x > r.x0 + EPS && x < r.x1 - EPS && z > r.z0 + EPS && z < r.z1 - EPS;

    for (const surface of ['sidewalk', 'curb']) {
      const mesh = scene.getObjectByName(`districtB_${surface}`);
      const pos = mesh.geometry.attributes.position;
      const hits = [];
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const z = pos.getZ(i);
        for (const r of rects) if (inside(x, z, r)) hits.push([x.toFixed(2), z.toFixed(2)]);
      }
      expect(hits, `${surface} vertices inside an annex roadway`).toEqual([]);
    }
  });

  it('the boundary connector clears District B’s western building row', () => {
    // The margin between the district edge and the westernmost footprint is
    // exactly ROW / 2 -- half a right-of-way, which is the grid's tiling intent
    // rather than an accident. That is why the connector sits ON the boundary:
    // centred there, its right-of-way abuts the buildings precisely. Centred
    // any further east and its sidewalk would run through them.
    const b = DISTRICTS.find((d) => d.id === 'districtB');
    const connector = b.annexStreets[1];
    const rowEast = connector.line + ROW / 2;

    // Grid buildings only. `buildings()` also returns the absorbed annex, whose
    // local X sits ~320 m further west because it is Phase 1's block expressed
    // in District B's frame — it is nowhere near this connector.
    const grid = b.buildings().filter((x) => x.band !== 'annex');
    const westmost = Math.min(...grid.map((x) => x.lx - SLOT_SPAN / 2));
    expect(rowEast).toBeLessThanOrEqual(westmost + 1e-9);
    // And the margin really is half a right-of-way, so this is not luck.
    expect(westmost - -DISTRICT_HALF).toBeCloseTo(ROW / 2, 6);
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
    // Five in District B since the absorption — see the FAM-1 note in §4 above.
    expect(districts[1].batches.size).toBe(5);
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

  it('the hill carries only the user-approved name (decisions 6/25)', () => {
    // Same rule, same route, second name. `Coco Hill` arrived by explicit
    // sign-off on 2026-08-01 and is locked as decision 25.
    //
    // NOTHING RENDERS THIS YET and that is deliberate -- there is no signage,
    // map label or HUD for a landform name to appear on. The constant reserves
    // the name ahead of the surface that will show it, so the name cannot drift
    // in the meantime and so whatever displays it later has one place to read.
    expect(HILL_NAME).toBe('Coco Hill');
  });

  it('these are the ONLY two names in the build (decision 6)', () => {
    // The real invariant is not what the two strings say, it is that there are
    // exactly two. Every other proper noun in this world is still the user's to
    // supply, and an agent adding a third by inventing a shop name or a street
    // should fail here rather than ship.
    //
    // ⚠️ THIS TEST USED TO ASSERT `[MAST_SIGN_TEXT, HILL_NAME]` against the two
    // strings -- a verbatim restatement of the two tests above it, with no
    // visibility into the rest of the build at all. A new `export const
    // SHOP_NAME = 'Ruby Diner'` in props.js passed it untouched. The comment
    // stated the invariant correctly and the body checked something else; the
    // session-11 code review caught the gap. To fail for the reason the decision
    // cares about, it has to read the source.
    const files = walkJs(new URL('../src/', import.meta.url).pathname);
    const names = new Map();
    for (const file of files) {
      const source = stripComments(readFileSync(file, 'utf8'));
      for (const m of source.matchAll(/'([^'\\\n]{2,60})'|"([^"\\\n]{2,60})"/g)) {
        const value = m[1] ?? m[2];
        // A proper noun as this project would write one: Title Case or signage
        // ALL CAPS, two or more words. Single words are deliberately NOT matched
        // -- 'Phase', 'Sky' and every enum-ish literal in the build are single
        // capitalised words, and a test that cries wolf gets deleted.
        if (/^[A-Z][a-z]+(?: +[A-Z][a-z]+)+$/.test(value) || /^[A-Z0-9]{2,}(?: +[A-Z0-9]{2,})+$/.test(value)) {
          names.set(value, file);
        }
      }
    }

    const found = [...names.keys()].sort();
    expect(found, `proper nouns in src/: ${[...names].map(([n, f]) => `${n} (${f})`).join(', ')}`)
      .toEqual(['AKC ENTERPRISE', 'Coco Hill']);
    // And they are still the constants the two tests above pin, not stray
    // duplicates that happen to read the same.
    expect(found).toEqual([MAST_SIGN_TEXT, HILL_NAME].sort());
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

// ---------------------------------------------------------------------------
// §8 props — the checks a draw-call count cannot make
// ---------------------------------------------------------------------------

describe('prop placement (§8)', () => {
  const placements = allPropPlacements();

  it('locked decision 21: Canary palm in District A, Mexican fan palm in District B', () => {
    // The species split is not decoration — §PROP-2 uses it to carry a
    // formal-plaza vs boulevard distinction for free. A pool that leaked across
    // the district line would undo that silently.
    const [a, b] = DISTRICTS;
    const inA = (p) => localOf(p, a);
    const inB = (p) => localOf(p, b);
    for (const p of placements.canaryPalms) {
      const l = inA(p);
      expect(Math.max(Math.abs(l.lx), Math.abs(l.lz)), 'canary palm outside District A').toBeLessThan(151);
    }
    for (const p of placements.mexicanPalms) {
      const l = inB(p);
      const inGrid = Math.max(Math.abs(l.lx), Math.abs(l.lz)) < 151;
      const inAnnex = Math.max(Math.abs(p.x), Math.abs(p.z)) <= 150;
      expect(inGrid || inAnnex, 'fan palm outside District B').toBe(true);
    }
    expect(placements.canaryPalms.length).toBeGreaterThan(0);
    expect(placements.mexicanPalms.length).toBeGreaterThan(0);
  });

  it('THE SPECIES REALLY DIFFER: the two palms are not the same tree twice', () => {
    // §PROP-2's whole argument is silhouette contrast. A stocky 9-14 m trunk
    // under a big round crown, against a bare 12-18 m stick with a small tuft.
    const canaryH = placements.canaryPalms.map((p) => p.height);
    const fanH = placements.mexicanPalms.map((p) => p.height);
    expect(Math.max(...canaryH)).toBeLessThan(Math.min(...fanH) + 3);
    expect(Math.min(...placements.canaryPalms.map((p) => p.crown))).toBeGreaterThan(
      Math.max(...placements.mexicanPalms.map((p) => p.crown)),
    );
  });

  it('nothing is planted inside a building footprint, in either district', () => {
    // The defect a prop pass produces most easily and a draw-call count cannot
    // see. Checked in each district's OWN frame, where even the 36°-yawed grid
    // is axis-aligned and the test is exact rather than conservative.
    for (const spec of DISTRICTS) {
      const boxes = localKeepOutBoxes(spec);
      for (const key of ['canaryPalms', 'mexicanPalms', 'shadeTrees', 'lamps', 'utilityPoles']) {
        for (const p of placements[key]) {
          const l = localOf(p, spec);
          for (const box of boxes) {
            const inside =
              l.lx > box.min.x && l.lx < box.max.x && l.lz > box.min.z && l.lz < box.max.z;
            expect(inside, `${key} inside a footprint at ${l.lx},${l.lz}`).toBe(false);
          }
        }
      }
    }
  });

  it('props on the 36° grid carry the district rotation', () => {
    // A streetlamp row that ignores District A's yaw reads as broken — the props
    // would march across the facades at an angle instead of along the kerb.
    const [a] = DISTRICTS;
    const rotated = placements.lamps.filter((p) => Math.abs(p.yaw % (Math.PI / 2)) > 1e-6);
    expect(rotated.length, 'no lamp carries a non-cardinal yaw').toBeGreaterThan(0);
    for (const p of rotated) {
      const off = ((p.yaw - a.rotation) % (Math.PI / 2) + Math.PI) % (Math.PI / 2);
      expect(Math.min(off, Math.PI / 2 - off)).toBeLessThan(1e-6);
    }
  });

  it('parked cars sit in the roadway, never on the sidewalk', () => {
    // "Are parked cars floating, or half-buried, or facing into the kerb?" —
    // this pins the one of those three that is pure arithmetic.
    for (const spec of DISTRICTS) {
      for (const c of placements.parkedCars) {
        const l = localOf(c, spec);
        if (Math.max(Math.abs(l.lx), Math.abs(l.lz)) > 151) continue;
        const nearest = (v) =>
          STREET_LINES.reduce((best, s) => (Math.abs(v - s) < Math.abs(v - best) ? s : best), STREET_LINES[0]);
        const dx = Math.abs(l.lx - nearest(l.lx));
        const dz = Math.abs(l.lz - nearest(l.lz));
        // Inside the kerb line on at least one axis, i.e. on the asphalt.
        expect(Math.min(dx, dz)).toBeLessThan(HALF_ROADWAY);
      }
    }
  });

  it('nothing stands in the middle of an intersection', () => {
    for (const spec of DISTRICTS) {
      for (const key of ['lamps', 'utilityPoles', 'canaryPalms', 'mexicanPalms']) {
        for (const p of placements[key]) {
          const l = localOf(p, spec);
          if (Math.max(Math.abs(l.lx), Math.abs(l.lz)) > 151) continue;
          const onX = STREET_LINES.some((s) => Math.abs(l.lz - s) < ROW / 2);
          const onZ = STREET_LINES.some((s) => Math.abs(l.lx - s) < ROW / 2);
          expect(onX && onZ, `${key} in a crossing at ${l.lx},${l.lz}`).toBe(false);
        }
      }
    }
  });

  it('is deterministic — the same world builds the same props every load', () => {
    const again = allPropPlacements();
    for (const key of Object.keys(placements)) {
      expect(again[key].length, key).toBe(placements[key].length);
    }
    expect(again.mexicanPalms[0]).toEqual(placements.mexicanPalms[0]);
  });
});

/** World -> a district's local frame. The inverse of `districtLocalToWorld`. */
function localOf(p, district) {
  const cos = Math.cos(district.rotation);
  const sin = Math.sin(district.rotation);
  const dx = p.x - district.origin.x;
  const dz = p.z - district.origin.z;
  return { lx: dx * cos - dz * sin, lz: dx * sin + dz * cos };
}

/** Every .js file under a directory, recursively. */
function walkJs(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return walkJs(p);
    return e.name.endsWith('.js') ? [p] : [];
  });
}

/**
 * Strip block and line comments. The proper-noun scan above runs on CODE only —
 * this project's comments are dense with real place names (Los Angeles, Bunker
 * Hill, Mexican fan palm) and every one of them would be a false positive.
 */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

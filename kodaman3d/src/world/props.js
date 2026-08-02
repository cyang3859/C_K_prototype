import * as THREE from 'three';

import {
  ANNEX,
  AWNING,
  BLADE,
  HVAC,
  annexAwnings,
  annexBladeSigns,
  annexLamps,
  annexPalms,
  hvacUnits,
  parapetBars,
  parapetBoxes,
} from './annex.js';
import {
  DISTRICTS,
  DISTRICT_HALF,
  HALF_ROADWAY,
  ROW,
  SIDEWALK,
  STREET_LINES,
} from './districts.js';
import { hash01 } from './facadeAtlas.js';
import { massingBoxes } from './massing.js';

/**
 * props.js — WHERE every world prop stands, as pure data.
 *
 * `WorldProps.js` turns these lists into `InstancedMesh`/`BatchedMesh` pools.
 * Keeping the placement maths here, pure and headless, is the same separation
 * `districts.js`/`District.js` already use, and it is what lets the tests assert
 * "no palm intersects a building" without a WebGL context.
 *
 * ===========================================================================
 * WHY THE POOLS ARE WORLD-SHARED AND NOT PER-DISTRICT — §PROP-1
 * ===========================================================================
 * `BUD-4` recommends over-allocating `InstancedMesh` "at district scale". Read
 * literally as one pool per district per prop type, that doubles every shared
 * category's cost for no silhouette benefit. §PROP-1 reads it as a SIZING
 * target, not a mandate — a parapet coping bar looks the same in both districts,
 * so it is one pool with instances everywhere.
 *
 * This document goes one step further than §8's own table, which files rooftop
 * HVAC and the parapet ring under "District A — exclusive prop pools". They are
 * not exclusive: District B's annex has carried both since Phase 1, and the
 * silhouettes are identical. Sharing them saves 4 draw calls over §8's split and
 * is the same reasoning §PROP-1 already applies to streetlamps and parked cars.
 *
 * ===========================================================================
 * EVERYTHING HERE IS IN WORLD SPACE
 * ===========================================================================
 * District A's grid is yawed 36° (locked decision 10), so a prop row placed in
 * district-local coordinates has to be transformed AND its own yaw has to pick
 * up the district's — a streetlamp row that ignores the rotation reads as
 * broken. `districtLocalToWorld` below does both, once, and every district-side
 * placement goes through it.
 */

/**
 * Convert a district-local placement to world space, carrying the district's
 * grid yaw into the prop's own rotation.
 *
 * @param {{lx:number, lz:number, yaw?:number}} p
 * @param {{origin:{x:number,z:number}, rotation:number}} district
 */
export function districtLocalToWorld(p, district) {
  const cos = Math.cos(district.rotation);
  const sin = Math.sin(district.rotation);
  return {
    x: district.origin.x + p.lx * cos + p.lz * sin,
    z: district.origin.z - p.lx * sin + p.lz * cos,
    yaw: (p.yaw ?? 0) + district.rotation,
  };
}

/**
 * Reject candidate placements that land inside (or too near) any solid box.
 *
 * THIS IS THE ONE GUARD THAT MATTERS VISUALLY. A palm growing through a lobby
 * or a streetlamp standing in a wall is the defect a prop pass produces most
 * easily and a draw-call count cannot see. Testing against the district's own
 * registered collider AABBs is exact for the cardinal districts and
 * CONSERVATIVE for District A, whose colliders circumscribe its rotated
 * footprints — so on the rotated grid it rejects slightly more than it must,
 * which is the safe direction.
 *
 * Accepts records keyed either `x`/`z` or `lx`/`lz`, so a street-row point and a
 * finished world placement can both be filtered without a conversion step.
 *
 * @param {Array<{x?:number,z?:number,lx?:number,lz?:number}>} candidates
 * @param {THREE.Box3[]} boxes
 * @param {number} margin metres of clearance required around each box
 */
export function rejectInsideBoxes(candidates, boxes, margin) {
  return candidates.filter((c) => {
    const x = c.x ?? c.lx;
    const z = c.z ?? c.lz;
    for (const box of boxes) {
      if (
        x > box.min.x - margin &&
        x < box.max.x + margin &&
        z > box.min.z - margin &&
        z < box.max.z + margin
      ) {
        return false;
      }
    }
    return true;
  });
}

/**
 * Parapet coping bars for a set of buildings whose roofs are flat and whose
 * footprint is axis-aligned in the frame the placements are wanted in.
 *
 * @param {ReadonlyArray<{x:number,z:number,w:number,d:number,h:number}>} buildings
 * @returns {Array<{cx:number,cy:number,cz:number,sx:number,sy:number,sz:number,yaw:number}>}
 */
export function parapetPlacements(buildings, yaw = 0) {
  const out = [];
  for (const b of buildings) for (const bar of parapetBars(b)) out.push({ ...bar, yaw });
  return out;
}

/**
 * The annex's props, in world space. This is Phase 1's entire prop catalogue,
 * moved intact: same positions, same deterministic hashes, same colours.
 *
 * Every list is world-space and yaw-0, because District B's grid is cardinal and
 * the annex has not moved (see `annex.js`).
 */
export function annexPropPlacements() {
  const buildings = ANNEX.buildings;
  return {
    parapets: parapetPlacements(buildings),
    parapetColliders: buildings.flatMap((b) => parapetBoxes(b)),
    hvac: hvacUnits(buildings).map((u) => ({ ...u, yaw: 0 })),
    hvacColliders: hvacUnits(buildings).map((u) => hvacBox(u)),
    awnings: annexAwnings(),
    bladeSigns: annexBladeSigns(),
    mexicanPalms: annexPalms(),
    lamps: annexLamps(),
  };
}

/**
 * A rooftop mechanical unit's collision box.
 *
 * THESE ARE COLLIDERS ON PURPOSE, and it is Phase 1's own reasoning: a player
 * who can land on a roof can walk into one, and walking through a condenser is
 * exactly the game-world tell the realism pass existed to remove. The cost is a
 * handful more AABBs in a linear scan, and they sit 8 m or more up, so they can
 * never interfere with street-level movement or pull the camera arm in.
 *
 * @param {{x:number,y:number,z:number}} u unit centre in X/Z, BASE in Y
 */
export function hvacBox(u) {
  return new THREE.Box3(
    new THREE.Vector3(u.x - HVAC.W / 2, u.y, u.z - HVAC.D / 2),
    new THREE.Vector3(u.x + HVAC.W / 2, u.y + HVAC.H, u.z + HVAC.D / 2),
  );
}

// ---------------------------------------------------------------------------
// District street furniture — the rows that have to respect each grid's yaw
// ---------------------------------------------------------------------------

/** Metres. Clearance kept around each intersection so nothing stands in a crossing. */
const CROSSING_MARGIN = 5;

/** Metres. One scaffold lift — the vertical pitch of the bay geometry. */
export const SCAFFOLD_LIFT_M = 2.0;

/**
 * Candidate points in a district's LOCAL frame, laid along both sides of every
 * street in the grid.
 *
 * WHY LOCAL AND NOT WORLD. District A's grid is yawed 36°, and the whole point
 * of a street row is that it is parallel to its street. Generating in local
 * coordinates and transforming once (`districtLocalToWorld`) makes that
 * automatic; generating in world space and hoping is how a lamp row ends up
 * crossing a facade at an angle.
 *
 * `along` is the axis the street RUNS along, `side` is which side of the
 * centre-line the point sits on, and `inward` is the yaw that turns a prop's
 * local +Z toward the roadway — derived once here, because getting it wrong on
 * one of the four cases is invisible until a screenshot shows lamp heads
 * overhanging the buildings instead of the street.
 *
 * @param {{offset:number, spacing:number, phase?:number}} opts
 *   `offset` metres from the street centre-line; `spacing` metres between props.
 */
export function streetRowPoints({ offset, spacing, phase = 0 }) {
  const out = [];
  const limit = DISTRICT_HALF - 6;
  for (const along of ['x', 'z']) {
    for (const line of STREET_LINES) {
      for (const side of [1, -1]) {
        const cross = line + side * offset;
        for (let t = -limit + phase; t <= limit; t += spacing) {
          // Never inside a crossing: a prop in the middle of an intersection is
          // the most obviously wrong thing a row generator can produce.
          if (STREET_LINES.some((c) => Math.abs(t - c) < ROW / 2 + CROSSING_MARGIN)) continue;
          // Yaw taking local +Z toward the roadway. Yaw θ sends +Z to
          // (sin θ, 0, cos θ), and the roadway lies at -side on the cross axis.
          const inward = along === 'x' ? (side > 0 ? Math.PI : 0) : (side > 0 ? -Math.PI / 2 : Math.PI / 2);
          out.push(
            along === 'x'
              ? { lx: t, lz: cross, along, side, inward }
              : { lx: cross, lz: t, along, side, inward },
          );
        }
      }
    }
  }
  return out;
}

/**
 * A district's building footprints as LOCAL-frame keep-out boxes.
 *
 * Local, not world, and that is the point: in its own frame even District A's
 * yawed grid is axis-aligned, so this is EXACT rather than the circumscribed
 * approximation `buildingWorldBox` has to use for collision. A palm rejected
 * here is rejected because it really would have grown through a wall.
 *
 * @param {object} spec one entry of `DISTRICTS`
 */
export function localKeepOutBoxes(spec) {
  const boxes = spec.buildings().map(
    (b) =>
      new THREE.Box3(
        new THREE.Vector3(b.lx - b.w / 2, 0, b.lz - b.d / 2),
        new THREE.Vector3(b.lx + b.w / 2, b.h, b.lz + b.d / 2),
      ),
  );
  const lm = spec.landmark;
  // The mast has no w/d — it is a slender structure with a wide observation
  // collar, so it gets a generous square instead of a footprint.
  const half = lm.kind === 'tower' ? { w: lm.w / 2, d: lm.d / 2 } : { w: 7, d: 7 };
  boxes.push(
    new THREE.Box3(
      new THREE.Vector3(lm.lx - half.w, 0, lm.lz - half.d),
      new THREE.Vector3(lm.lx + half.w, lm.h, lm.lz + half.d),
    ),
  );
  return boxes;
}

/**
 * The topmost massing box of a district building, as a pseudo-building record
 * ready for `parapetBars`/`hvacUnits`.
 *
 * A parapet rings the roof that actually exists, which after §5's setback
 * recipes is the top box's footprint and not the lot's. Ringing the lot instead
 * would float a coping in mid-air around a slab that stepped in 3 m below it —
 * exactly the kind of defect a draw-call count cannot see.
 */
export function roofOf(b) {
  const boxes = massingBoxes(b.recipe, b);
  const top = boxes[boxes.length - 1];
  return {
    kind: 'district',
    x: b.lx + top.cx,
    z: b.lz + top.cz,
    w: top.w,
    d: top.d,
    h: top.cy + top.h / 2,
  };
}

/**
 * Which way a building faces, in its district's local frame.
 *
 * Storefront furniture has to hang off the STREET side. A building's slot is
 * always adjacent to a street on both axes, so "nearest centre-line wins" picks
 * the frontage the way a real corner lot does — the long side facing the wider
 * approach.
 *
 * @returns {{axis:'x'|'z', sign:number, yaw:number, width:number}}
 *   `yaw` orients a prop whose local +Z points AWAY from the facade.
 */
export function frontage(b) {
  const nearest = (v) =>
    STREET_LINES.reduce((best, c) => (Math.abs(v - c) < Math.abs(v - best) ? c : best), STREET_LINES[0]);
  const nx = nearest(b.lx);
  const nz = nearest(b.lz);
  const dx = Math.abs(b.lx - nx) - b.w / 2;
  const dz = Math.abs(b.lz - nz) - b.d / 2;

  if (dz <= dx) {
    // Fronting a street that runs along X: the facade normal is ±Z.
    const sign = b.lz > nz ? -1 : 1;
    return { axis: 'z', sign, yaw: sign > 0 ? 0 : Math.PI, width: b.w, depth: b.d };
  }
  const sign = b.lx > nx ? -1 : 1;
  return { axis: 'x', sign, yaw: sign > 0 ? Math.PI / 2 : -Math.PI / 2, width: b.d, depth: b.w };
}

/**
 * Everything a district contributes to the world-shared pools, in WORLD space.
 *
 * @param {object} spec one entry of `DISTRICTS`
 * @param {object} opts which categories this district gets — the spec's §8
 *   split between world-shared, District A exclusive and District B exclusive.
 */
export function districtPropPlacements(spec, opts) {
  const keepOut = localKeepOutBoxes(spec);
  const buildings = spec.buildings();
  const out = {
    parapets: [],
    hvac: [],
    hvacColliders: [],
    canaryPalms: [],
    mexicanPalms: [],
    shadeTrees: [],
    lamps: [],
    utilityPoles: [],
    parkedCars: [],
    smallProps: [],
    awnings: [],
    bladeSigns: [],
    bollards: [],
    cafeProps: [],
    scaffolding: [],
  };

  // ---- roof furniture -----------------------------------------------------
  if (opts.roofProps) {
    for (const b of buildings) {
      if (b.band === 'annex') continue; // the annex already contributes its own
      const roof = roofOf(b);
      for (const bar of parapetBars(roof)) {
        const w = districtLocalToWorld({ lx: bar.cx, lz: bar.cz }, spec);
        out.parapets.push({ ...bar, cx: w.x, cz: w.z, yaw: spec.rotation });
      }
      for (const u of hvacUnits([roof])) {
        const w = districtLocalToWorld({ lx: u.x, lz: u.z }, spec);
        out.hvac.push({ x: w.x, y: u.y, z: w.z, yaw: spec.rotation });
        out.hvacColliders.push(rotatedHvacBox({ x: w.x, y: u.y, z: w.z }, spec.rotation));
      }
    }
  }

  // ---- storefront furniture ----------------------------------------------
  if (opts.storefront) {
    let k = 0;
    for (const b of buildings) {
      if (b.band === 'annex') continue;
      if (b.h > 46) continue; // storefront kit is for the corridor's own scale
      const f = frontage(b);
      const half = f.axis === 'z' ? b.d / 2 : b.w / 2;
      const facade = { lx: b.lx, lz: b.lz };
      if (f.axis === 'z') facade.lz += f.sign * half;
      else facade.lx += f.sign * half;

      // Awning: projects out over the sidewalk from the facade plane.
      const aOut = { ...facade };
      if (f.axis === 'z') aOut.lz += f.sign * (AWNING.PROJECTION / 2);
      else aOut.lx += f.sign * (AWNING.PROJECTION / 2);
      const aw = districtLocalToWorld({ ...aOut, yaw: f.yaw }, spec);
      out.awnings.push({
        x: aw.x,
        y: AWNING.Y,
        z: aw.z,
        yaw: aw.yaw,
        tilt: AWNING.TILT,
        width: f.width * AWNING.WIDTH_FRACTION,
        color: AWNING.FABRIC[k % AWNING.FABRIC.length],
      });

      // Blade sign: only on the taller half of the corridor, and only every
      // other one, so a marquee reads as an event rather than as wallpaper.
      if (b.band !== 'lowrise' && k % 2 === 0) {
        const bOut = { ...facade };
        const lateral = (f.axis === 'z' ? b.w : b.d) / 2 - BLADE.CORNER_INSET;
        if (f.axis === 'z') {
          bOut.lz += f.sign * BLADE.STANDOFF;
          bOut.lx += k % 4 === 0 ? lateral : -lateral;
        } else {
          bOut.lx += f.sign * BLADE.STANDOFF;
          bOut.lz += k % 4 === 0 ? lateral : -lateral;
        }
        const bw = districtLocalToWorld({ ...bOut, yaw: f.yaw }, spec);
        out.bladeSigns.push({ x: bw.x, y: BLADE.Y, z: bw.z, yaw: bw.yaw });
      }
      k++;
    }
  }

  // ---- vegetation ---------------------------------------------------------
  const parkway = HALF_ROADWAY + 1.43; // Phase 1's PARKWAY_Z, relative to the kerb
  if (opts.canaryPalms) {
    // §PROP-2: the Canary Island date palm reads formal/estate rather than
    // street, so District A gets it at PLAZA spacing — a wide, deliberate rhythm
    // in the tower forecourts — not the boulevard's mass planting.
    const pts = rejectInsideBoxes(
      streetRowPoints({ offset: parkway, spacing: 26, phase: 13 }),
      keepOut,
      2.4,
    );
    for (const p of pts) {
      const w = districtLocalToWorld({ lx: p.lx, lz: p.lz }, spec);
      const i = out.canaryPalms.length;
      out.canaryPalms.push({
        x: w.x,
        z: w.z,
        yaw: hash01(i * 2654435761) * Math.PI * 2,
        height: 9 + hash01(i * 40503) * 5, // 9–14 m: stocky, not the 18 m robusta
        crown: 3.4 + hash01(i * 7919) * 0.9,
      });
    }
  }
  if (opts.mexicanPalms) {
    const pts = rejectInsideBoxes(
      streetRowPoints({ offset: parkway, spacing: 12 }),
      keepOut,
      1.6,
    );
    for (const p of pts) {
      const w = districtLocalToWorld({ lx: p.lx, lz: p.lz }, spec);
      const i = out.mexicanPalms.length + 500; // offset so it does not clone the annex row
      out.mexicanPalms.push({
        x: w.x,
        z: w.z,
        yaw: hash01(i * 97) * Math.PI * 2,
        crownYaw: hash01(i * 31) * Math.PI * 2,
        height: 12 + hash01(i * 2654435761) * 6,
        lean: (hash01(i * 40503) - 0.5) * 0.08,
        crown: 1.9 + hash01(i * 7919) * 0.7,
      });
    }
  }
  if (opts.shadeTrees) {
    // `DEN-7`: a palm-only district misreads for its non-boulevard side streets.
    // The broadleaf goes on the streets running the OTHER way from the corridor
    // spine, which is exactly the "courtyard-adjacent block" §8 describes.
    const pts = rejectInsideBoxes(
      streetRowPoints({ offset: parkway, spacing: 22, phase: 7 })
        .filter((p) => p.along === 'z'),
      keepOut,
      3,
    );
    for (const p of pts) {
      const w = districtLocalToWorld({ lx: p.lx, lz: p.lz }, spec);
      const i = out.shadeTrees.length;
      out.shadeTrees.push({
        x: w.x,
        z: w.z,
        yaw: hash01(i * 2246822519) * Math.PI * 2,
        scale: 0.85 + hash01(i * 668265263) * 0.4,
      });
    }
  }

  // ---- street furniture ---------------------------------------------------
  if (opts.lamps) {
    const pts = rejectInsideBoxes(
      streetRowPoints({ offset: HALF_ROADWAY + 3.53, spacing: 24, phase: 6 }),
      keepOut,
      1.2,
    );
    for (const p of pts) {
      const w = districtLocalToWorld({ lx: p.lx, lz: p.lz, yaw: p.inward }, spec);
      out.lamps.push({ x: w.x, z: w.z, yaw: w.yaw });
    }
  }
  if (opts.utilityPoles) {
    // District A's dense core is treated as undergrounded — a real and common
    // CBD condition, and it also avoids a fourth world-shared pool for a
    // silhouette District A does not want (§8).
    const pts = rejectInsideBoxes(
      streetRowPoints({ offset: HALF_ROADWAY + 4.1, spacing: 48, phase: 20 }),
      keepOut,
      1.5,
    );
    for (const p of pts) {
      const w = districtLocalToWorld({ lx: p.lx, lz: p.lz, yaw: p.inward }, spec);
      out.utilityPoles.push({ x: w.x, z: w.z, yaw: w.yaw });
    }
  }
  if (opts.cars) {
    // Kerbside parking: INSIDE the roadway, hard against the curb. A car placed
    // on the sidewalk instead is the single most obvious failure in this file.
    const pts = rejectInsideBoxes(
      streetRowPoints({ offset: HALF_ROADWAY - 1.35, spacing: 7.2, phase: 4 }),
      keepOut,
      0,
    );
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      if (hash01(i * 374761393) < 0.42) continue; // a full kerb reads as a car park
      // The car's local +Z is its nose. Along a street it must point down the
      // street, not at the kerb, and the two sides face opposite ways so the
      // parking matches the adjacent lane's direction of travel.
      const yaw =
        p.along === 'x'
          ? p.side > 0
            ? Math.PI / 2
            : -Math.PI / 2
          : p.side > 0
            ? Math.PI
            : 0;
      const w = districtLocalToWorld({ lx: p.lx, lz: p.lz, yaw }, spec);
      out.parkedCars.push({
        x: w.x,
        z: w.z,
        yaw: w.yaw,
        van: hash01(i * 2654435761 + 5) < 0.28,
        tint: hash01(i * 40503 + 9),
      });
    }
  }
  // ---- §10 item 10, the cut-priority tier ---------------------------------
  // `DEN-8` frames these as "an authoring discipline... not a system", and §10
  // ranks them last precisely so they are the first thing to go. They are here
  // because the budget held, not because anything depends on them.
  if (opts.bollards) {
    // Tower-base vehicle barriers: a short arc across each primary tower's
    // street frontage.
    for (const b of buildings) {
      if (b.band !== 'primary') continue;
      const f = frontage(b);
      const half = (f.axis === 'z' ? b.d : b.w) / 2;
      const span = (f.axis === 'z' ? b.w : b.d) * 0.7;
      for (let i = 0; i < 5; i++) {
        const t = (i / 4 - 0.5) * span;
        const p = { lx: b.lx, lz: b.lz };
        if (f.axis === 'z') {
          p.lz += f.sign * (half + 1.6);
          p.lx += t;
        } else {
          p.lx += f.sign * (half + 1.6);
          p.lz += t;
        }
        const w = districtLocalToWorld(p, spec);
        out.bollards.push({ x: w.x, z: w.z });
      }
    }
  }
  if (opts.cafeProps) {
    // Pavement tables outside the corridor's lowrise storefronts.
    for (const b of buildings) {
      if (b.band !== 'lowrise') continue;
      const f = frontage(b);
      const half = (f.axis === 'z' ? b.d : b.w) / 2;
      for (let i = 0; i < 3; i++) {
        const t = (i - 1) * 2.6;
        const p = { lx: b.lx, lz: b.lz };
        if (f.axis === 'z') {
          p.lz += f.sign * (half + 2.4);
          p.lx += t;
        } else {
          p.lx += f.sign * (half + 2.4);
          p.lz += t;
        }
        const w = districtLocalToWorld({ ...p, yaw: f.yaw }, spec);
        out.cafeProps.push({ x: w.x, z: w.z, yaw: w.yaw });
      }
    }
  }
  if (opts.scaffolding) {
    // `DEN-8`'s environmental storytelling: TWO buildings under work, not a
    // district-wide condition. A city where every block is scaffolded reads as a
    // texture, not as a story.
    const midrises = buildings.filter((b) => b.band === 'midrise');
    for (const b of [midrises[3], midrises[9]]) {
      if (!b) continue;
      const f = frontage(b);
      const half = (f.axis === 'z' ? b.d : b.w) / 2;
      const span = (f.axis === 'z' ? b.w : b.d) - 2;
      const lifts = Math.max(2, Math.floor(b.h / SCAFFOLD_LIFT_M) - 1);
      for (let bay = 0; bay < 4; bay++) {
        const t = (bay / 3 - 0.5) * span;
        const p = { lx: b.lx, lz: b.lz };
        if (f.axis === 'z') {
          p.lz += f.sign * (half + 0.9);
          p.lx += t;
        } else {
          p.lx += f.sign * (half + 0.9);
          p.lz += t;
        }
        const w = districtLocalToWorld({ ...p, yaw: f.yaw }, spec);
        // ONE INSTANCE PER LIFT, not one per bay scaled on Y. The first build
        // stretched a single 2 m bay over the building's whole height, which put
        // one deck at the top of two bare 12 m standards — a gantry, not
        // scaffolding. A screenshot caught it; the fix is instances, and
        // instances are free.
        for (let lift = 0; lift < lifts; lift++) {
          out.scaffolding.push({ x: w.x, y: lift * SCAFFOLD_LIFT_M, z: w.z, yaw: w.yaw });
        }
      }
    }
  }

  if (opts.smallProps) {
    const pts = rejectInsideBoxes(
      streetRowPoints({ offset: HALF_ROADWAY + SIDEWALK * 0.82, spacing: 17, phase: 11 }),
      keepOut,
      0.8,
    );
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const w = districtLocalToWorld({ lx: p.lx, lz: p.lz, yaw: p.inward }, spec);
      out.smallProps.push({ x: w.x, z: w.z, yaw: w.yaw, variant: i % 3 });
    }
  }

  return out;
}

/**
 * The world AABB of a rooftop unit that has been yawed with its district's
 * grid. Circumscribed, so it errs LARGE — which never lets the hero inside
 * geometry, the same safe direction `buildingWorldBox` takes.
 */
function rotatedHvacBox(u, rotation) {
  const c = Math.abs(Math.cos(rotation));
  const s = Math.abs(Math.sin(rotation));
  const halfW = (HVAC.W * c + HVAC.D * s) / 2;
  const halfD = (HVAC.W * s + HVAC.D * c) / 2;
  return new THREE.Box3(
    new THREE.Vector3(u.x - halfW, u.y, u.z - halfD),
    new THREE.Vector3(u.x + halfW, u.y + HVAC.H, u.z + halfD),
  );
}

/**
 * Every placement in the world, gathered once.
 *
 * THE §8 SPLIT LIVES HERE, in one readable table, so which district gets what is
 * a data question rather than something spread across six builders.
 *
 * Two deliberate departures from §8's own tables, both stated rather than
 * quietly taken:
 *
 *  1. **Rooftop HVAC and the parapet ring are world-shared, not District A
 *     exclusive.** §8 files them under District A; District B's annex has
 *     carried both since Phase 1 and the silhouettes are identical, so one pool
 *     serves everything and saves 4 calls over the split.
 *  2. **Awnings and blade signs cast shadows.** §8 prices them at 1 call each
 *     citing "confirmed no-shadow"; the shipped code sets `castShadow = true`.
 *     The code wins — see `WorldProps._buildAwnings`.
 */
export function allPropPlacements() {
  const sets = [annexPropPlacements()];
  for (const spec of DISTRICTS) {
    sets.push(
      districtPropPlacements(spec, {
        // §10 item 5 scoped roof furniture to District A. **User decision
        // 2026-08-01: they go on District B's generated buildings too.** Zero
        // draw calls — both pools already exist and already span the annex, so
        // this only adds instances to them. Locked as decision 26.
        roofProps: true,
        storefront: spec.id === 'districtB', // §10 item 6
        canaryPalms: spec.id === 'districtA', // locked decision 21
        mexicanPalms: spec.id === 'districtB', // locked decision 21
        shadeTrees: spec.id === 'districtB', // §10 item 8
        utilityPoles: spec.id === 'districtB', // §10 item 8
        lamps: true, // §10 item 7, world-shared
        cars: true,
        smallProps: true,
        // §10 item 10 — the cut tier, in the spec's own order.
        bollards: spec.id === 'districtA',
        cafeProps: spec.id === 'districtB',
        scaffolding: spec.id === 'districtB',
      }),
    );
  }

  const merged = {};
  for (const set of sets) {
    for (const [k, v] of Object.entries(set)) {
      (merged[k] ??= []).push(...v);
    }
  }
  return merged;
}

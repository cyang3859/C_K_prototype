import * as THREE from 'three';

import {
  ANNEX,
  HVAC,
  annexAwnings,
  annexBladeSigns,
  annexLamps,
  annexPalms,
  hvacUnits,
  parapetBars,
  parapetBoxes,
} from './annex.js';

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
 * @param {Array<{x:number,z:number}>} candidates
 * @param {THREE.Box3[]} boxes
 * @param {number} margin metres of clearance required around each box
 */
export function rejectInsideBoxes(candidates, boxes, margin) {
  return candidates.filter((c) => {
    for (const box of boxes) {
      if (
        c.x > box.min.x - margin &&
        c.x < box.max.x + margin &&
        c.z > box.min.z - margin &&
        c.z < box.max.z + margin
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

import * as THREE from 'three';

/**
 * Collision.js — static AABB set plus kinematic capsule resolution.
 *
 * NO PHYSICS ENGINE, AND THAT IS PERMANENT FOR THE HERO (brief §2).
 * The hero is the only collider in Phase 1 and the world is a dozen static
 * boxes. A ~150-line analytic controller is *less* integration complexity than
 * a physics engine here: no async WASM init gating the game loop's start, no
 * ~800 KB download, no physics-body↔Object3D transform sync every frame. And
 * physics-engine character controllers (including Rapier's own
 * KinematicCharacterController) do not apply gravity for you and are commonly
 * paired with a manual ground raycast anyway — this is not skipping a hard
 * problem, it is doing the same core technique by hand.
 * Rapier arrives in Phase 3 for props/enemies/vehicles only. The hero's
 * controller stays hand-rolled forever.
 *
 * NO THREE.JS SCENE ACCESS IN THIS FILE. It imports Box3/Vector3 as plain math
 * types, and every function below operates on `{x,y,z}` and `{min,max}` shaped
 * data. That is what lets tests/collision.test.js drive it directly with
 * `environment: 'node'` and no WebGL. Keep it that way: if this module ever
 * needs a Mesh, an Object3D or a raycaster from the scene graph, the design has
 * gone wrong.
 *
 * NO BROADPHASE. A linear scan over ~16 boxes is correct and sufficient. Adding
 * a spatial hash or BVH at this count is premature optimisation and unrequested
 * scope (brief §13).
 *
 * CAPSULE CONVENTION — read this before touching any math below:
 *   `position` is the capsule's BASE (the hero's feet), not its centre.
 *   The capsule spans y ∈ [position.y, position.y + height].
 *   Its vertical centre segment (the spine of the swept sphere) spans
 *   y ∈ [position.y + radius, position.y + height - radius].
 *   Feet-as-origin is chosen because it makes "standing on a surface" the
 *   trivially checkable `position.y === surfaceY`, and because the hero mesh is
 *   authored standing on its own origin.
 */

/** Numerical slack for "is at or below" comparisons, metres. */
const EPS = 1e-4;

/**
 * How far *above* a supporting surface the capsule's feet must be before the
 * horizontal push-out considers that surface's box a wall. Standing on a roof,
 * feet == box.max.y, so this gate skips the box the hero is standing on;
 * without it, the closest-point test would find a near-zero distance to the
 * roof's top face and shove the hero horizontally off the building.
 */
const STAND_CLEARANCE = 0.05;

/** Default extra distance below the capsule's feet that still counts as ground contact. */
const DEFAULT_SNAP_TOLERANCE = 0.05;

/**
 * How far the feet may be lifted onto TERRAIN in one fixed step, metres.
 *
 * Only applies to a registered height field, never to a box roof — stepping up
 * onto a building because you brushed its side is exactly the bug this project
 * already fixed once via `STAND_CLEARANCE`. See the use site for why a
 * per-step allowance is really a slope limit.
 */
const DEFAULT_MAX_TERRAIN_STEP = 0.5;

/**
 * Build the 4 thin, tall perimeter volumes that enforce the playable extent.
 *
 * The playable-extent mechanism is deliberately *not* a special case: the
 * boundary is four ordinary Box3s pushed through the exact same horizontal
 * push-out code path as buildings. One code path means one set of bugs, and the
 * boundary automatically inherits any future improvement to wall sliding.
 *
 * The walls' INNER faces sit exactly at ±halfExtent, so a capsule of radius r
 * comes to rest with its centre at ±(halfExtent - r) and no part of the hero
 * ever crosses the line.
 *
 * @param {number} halfExtent metres from origin to the boundary on X and Z
 * @param {number} [height] wall height; must exceed the hero's maximum altitude
 * @param {number} [thickness] wall thickness, metres
 * @returns {THREE.Box3[]} exactly 4 boxes: -X, +X, -Z, +Z
 */
export function createBoundaryBoxes(halfExtent, height = 400, thickness = 5) {
  const h = halfExtent;
  const t = thickness;
  const outer = h + t;
  // Extend each wall past the corners by `t` so the four walls overlap at the
  // corners and leave no diagonal gap for a fast-moving capsule to squeeze past.
  const span = outer;

  return [
    // -X wall: occupies x ∈ [-h-t, -h]
    new THREE.Box3(new THREE.Vector3(-outer, -1, -span), new THREE.Vector3(-h, height, span)),
    // +X wall
    new THREE.Box3(new THREE.Vector3(h, -1, -span), new THREE.Vector3(outer, height, span)),
    // -Z wall
    new THREE.Box3(new THREE.Vector3(-span, -1, -outer), new THREE.Vector3(span, height, -h)),
    // +Z wall
    new THREE.Box3(new THREE.Vector3(-span, -1, h), new THREE.Vector3(span, height, outer)),
  ];
}

/**
 * Resolve a kinematic capsule against the ground plane and a set of static AABBs.
 *
 * Mutates `position` in place — the controller integrates velocity into the
 * position first, then hands that provisional position here to be corrected.
 *
 * Step 1, VERTICAL (a downward ray, not a swept volume): find the highest
 * support surface the capsule's feet crossed or are resting on during this step,
 * and snap the feet onto it. Passing `previousY` is what makes this safe at any
 * speed — the test is "did the feet cross this surface between previousY and
 * position.y", so a capsule falling 150 m in one step still lands rather than
 * tunnelling (acceptance criterion 13). Ascending capsules are skipped entirely,
 * so flying up past a rooftop does not yank the hero back down onto it.
 *
 * Step 2, HORIZONTAL (2 iterations): closest-point push-out in the XZ plane
 * only. Vertical separation is already fully handled by step 1, and letting the
 * push-out act on Y as well would fight it — the two passes would take turns
 * moving the hero up and down a wall face. Two iterations let a capsule wedged
 * into a corner between two boxes converge instead of oscillating between the
 * two single-axis solutions.
 *
 * @param {{x:number,y:number,z:number}} position capsule BASE, mutated in place
 * @param {number} radius capsule radius, metres
 * @param {number} height capsule total height, metres
 * @param {Array<{min:{x:number,y:number,z:number}, max:{x:number,y:number,z:number}}>} boxes
 * @param {object} [options]
 * @param {number} [options.previousY] feet y before this step's vertical motion.
 *   Defaults to the current y (i.e. "no vertical motion this step").
 * @param {boolean} [options.groundPlane=true] whether an infinite plane at y=0 exists.
 * @param {number} [options.snapTolerance] how far below the feet still counts as contact.
 * @returns {{onGround:boolean, groundY:number, pushed:boolean, surfaceIndex:number}}
 *   `surfaceIndex` is the index in `boxes` of the roof landed on, or -1 for the
 *   ground plane / no contact.
 */
export function resolveCapsule(position, radius, height, boxes, options = {}) {
  const {
    previousY = position.y,
    groundPlane = true,
    snapTolerance = DEFAULT_SNAP_TOLERANCE,
    groundHeightAt = null,
    maxTerrainStep = DEFAULT_MAX_TERRAIN_STEP,
  } = options;

  const result = { onGround: false, groundY: position.y, pushed: false, surfaceIndex: -1 };

  // ---------------------------------------------------------------- vertical
  const from = previousY;
  const to = position.y;

  // Only look for support when level or descending. An ascending capsule cannot
  // land on anything, and testing it anyway is how "flying up through a roof
  // teleports you onto it" bugs happen.
  if (to <= from + EPS) {
    const lowerBound = to - snapTolerance;
    let bestY = -Infinity;
    let bestIndex = -1;

    if (groundPlane) {
      // The "ground" is y = 0 unless a terrain field says otherwise.
      const gy = groundHeightAt ? groundHeightAt(position.x, position.z) : 0;

      // Flat ground uses the strict crossed-it test. Terrain gets an extra
      // allowance UPWARD, and it needs one: walking uphill, the surface under
      // your feet is HIGHER than where the step began, so the crossed-it test
      // rejects it and the hero walks straight through the hillside. Allowing a
      // small step up is what turns a height field into a walkable slope — it is
      // the same allowance every character controller makes for stairs and
      // kerbs, applied to a continuous surface.
      //
      // The limit is per-step, not per-second, so it is a slope limit in
      // disguise: at 7.5 m/s the hero covers 0.125 m per fixed step, so a 0.5 m
      // allowance tops out around a 4:1 grade. Steeper than that and the hero
      // stops climbing instead of teleporting up a cliff face, which is the
      // behaviour to want.
      const rise = gy > 0 ? maxTerrainStep : EPS;
      if (gy <= from + rise && gy >= lowerBound) {
        bestY = gy;
      }
    }

    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i];
      const topY = b.max.y;
      // A pure downward ray: the feet must be horizontally over the footprint.
      // No radius expansion — standing with your centre off the edge means you
      // fall, which is the behaviour a player expects from a ledge.
      if (position.x < b.min.x || position.x > b.max.x) continue;
      if (position.z < b.min.z || position.z > b.max.z) continue;
      if (topY > from + EPS) continue; // surface is above where we started: not crossed
      if (topY < lowerBound) continue; // surface is below where we ended: not reached
      if (topY > bestY) {
        bestY = topY;
        bestIndex = i;
      }
    }

    if (bestY > -Infinity) {
      position.y = bestY;
      result.onGround = true;
      result.groundY = bestY;
      result.surfaceIndex = bestIndex;
    }
  }

  // -------------------------------------------------------------- horizontal
  // Two iterations: one pass resolves each box independently, which can push a
  // corner-wedged capsule back into the box it just left. The second pass
  // settles it. More iterations buy nothing at this geometry complexity.
  for (let iteration = 0; iteration < 2; iteration++) {
    let movedThisIteration = false;

    for (const b of boxes) {
      // Vertical-overlap gate. `+ STAND_CLEARANCE` on the feet is what stops the
      // box you are standing ON from being treated as a wall (see the constant's
      // doc comment).
      if (position.y + STAND_CLEARANCE >= b.max.y) continue;
      if (position.y + height <= b.min.y) continue;

      // Closest point on the box footprint to the capsule's vertical spine,
      // in the XZ plane. Because the spine is vertical and the box is an AABB,
      // this reduces exactly to a 2D circle-vs-rectangle test.
      const cx = clamp(position.x, b.min.x, b.max.x);
      const cz = clamp(position.z, b.min.z, b.max.z);
      const dx = position.x - cx;
      const dz = position.z - cz;
      const distSq = dx * dx + dz * dz;

      if (distSq >= radius * radius) continue; // outside the capsule's reach

      if (distSq > 1e-12) {
        // Outside the footprint but overlapping: push straight out along the
        // surface normal. This is what produces smooth wall sliding — the
        // component of motion along the wall is left untouched.
        const dist = Math.sqrt(distSq);
        const push = radius - dist;
        position.x += (dx / dist) * push;
        position.z += (dz / dist) * push;
      } else {
        // Centre is inside the footprint (deep penetration, e.g. spawned inside
        // a box or a huge single-step displacement). Escape along the axis with
        // the least penetration so the hero pops out of the nearest face.
        const toMinX = position.x - b.min.x;
        const toMaxX = b.max.x - position.x;
        const toMinZ = position.z - b.min.z;
        const toMaxZ = b.max.z - position.z;
        const m = Math.min(toMinX, toMaxX, toMinZ, toMaxZ);
        if (m === toMinX) position.x = b.min.x - radius;
        else if (m === toMaxX) position.x = b.max.x + radius;
        else if (m === toMinZ) position.z = b.min.z - radius;
        else position.z = b.max.z + radius;
      }

      movedThisIteration = true;
      result.pushed = true;
    }

    // Nothing overlapped on this pass: the second pass would be a no-op.
    if (!movedThisIteration) break;
  }

  return result;
}

/**
 * Ray vs AABB set, slab method. Used by the camera rig's spring-arm collision.
 *
 * Lives here rather than in CameraRig.js so the camera and the hero share ONE
 * box list and one intersection implementation — the brief is explicit that the
 * camera must not maintain a second copy of the world's colliders.
 *
 * @param {{x:number,y:number,z:number}} origin
 * @param {{x:number,y:number,z:number}} dir MUST be normalised
 * @param {number} maxDistance
 * @param {Array<{min:object,max:object}>} boxes
 * @returns {number} distance to the nearest hit, or `maxDistance` if none.
 */
export function raycastBoxes(origin, dir, maxDistance, boxes) {
  let nearest = maxDistance;

  for (const b of boxes) {
    const t = slabEntry(origin, dir, b, 0, nearest);
    if (t < nearest) nearest = t;
  }

  return nearest;
}

/**
 * SPHERE vs AABB set — the camera arm's obstruction test.
 *
 * WHY THIS EXISTS (bug B3). `raycastBoxes` above answers "is the arm's centre
 * LINE clear?", but the thing that visibly clips through a facade is the
 * camera's NEAR PLANE: a rectangle roughly 0.2 m across at near = 0.1 m. An arm
 * that passes within a near-plane half-diagonal of a building corner leaves the
 * ray reporting clearance while a corner of the near plane is already inside the
 * wall, and the renderer happily draws the building's interior. Human QA hit
 * exactly that by Shift-dashing into a wall.
 *
 * Note that CAM_COLLISION_PADDING cannot fix this: it shortens the arm ALONG the
 * ray, and the uncovered extent here is LATERAL to it. Raising the padding buys
 * a camera jammed into the hero's back in every corridor and still clips at a
 * grazing angle. Sweeping a sphere the size of the near plane is the fix that
 * matches the geometry of the problem.
 *
 * METHOD. Sweeping a sphere of radius `r` against a box is a plain ray cast
 * against the box's Minkowski sum with that sphere. That sum is the box inflated
 * by `r` with ROUNDED corners and edges; this function uses the inflated box
 * with SQUARE corners, which is the standard conservative approximation.
 * Consequence, stated so nobody rediscovers it as a bug: within `r` of a corner
 * the cast reports contact up to r·(√3 − 1) ≈ 0.73·r early on a pure diagonal
 * approach — about 0.13 m at Phase 1's radius. It errs by pulling the camera IN
 * slightly sooner at corners, which is the safe direction for this defect. If a
 * later phase needs exactness there, replace the corner case with a
 * ray-vs-sphere test on the eight corner spheres and edge capsules; the
 * near-plane radius is small enough that Phase 1 does not need it.
 *
 * @param {{x:number,y:number,z:number}} origin sphere centre at t = 0
 * @param {{x:number,y:number,z:number}} dir MUST be normalised
 * @param {number} maxDistance
 * @param {number} radius swept sphere radius, metres
 * @param {Array<{min:object,max:object}>} boxes
 * @returns {number} distance travelled before the sphere touches a box, or
 *   `maxDistance` if none is touched.
 */
export function spherecastBoxes(origin, dir, maxDistance, radius, boxes) {
  // A zero/negative radius is exactly the ray case; do not silently inflate by
  // a negative amount and shrink the world's colliders.
  if (!(radius > 0)) return raycastBoxes(origin, dir, maxDistance, boxes);

  let nearest = maxDistance;

  for (const b of boxes) {
    // Origin already overlapping the inflated box: SKIP IT rather than return 0.
    //
    // Returning 0 would collapse the camera arm to its floor and slam the camera
    // into the hero's head — strictly worse than the clip it is avoiding, and it
    // would happen while the player is merely standing near a wall. This is
    // unreachable in Phase 1 (the pivot sits above the hero's capsule centre,
    // which the horizontal push-out keeps HERO_RADIUS_M = 0.35 m clear of every
    // footprint, and the near-plane radius is ~0.2 m at the widest dash FOV), so
    // the branch is a guard for a future `near`/FOV change, not live behaviour.
    if (
      origin.x > b.min.x - radius &&
      origin.x < b.max.x + radius &&
      origin.y > b.min.y - radius &&
      origin.y < b.max.y + radius &&
      origin.z > b.min.z - radius &&
      origin.z < b.max.z + radius
    ) {
      continue;
    }

    const t = slabEntry(origin, dir, b, radius, nearest);
    if (t < nearest) nearest = t;
  }

  return nearest;
}

/**
 * Slab-method entry distance for one ray against one (optionally inflated) AABB.
 *
 * Shared by `raycastBoxes` and `spherecastBoxes` so there is exactly ONE
 * intersection routine in the project — the same reason both live in this file
 * rather than in CameraRig.js.
 *
 * @param {{x:number,y:number,z:number}} origin
 * @param {{x:number,y:number,z:number}} dir normalised
 * @param {{min:object,max:object}} box
 * @param {number} inflate metres added to the box on every axis (0 for a ray)
 * @param {number} tCap current best hit; slabs beyond it can exit early
 * @returns {number} entry distance, or Infinity for a miss
 */
function slabEntry(origin, dir, box, inflate, tCap) {
  let tMin = 0;
  let tMax = tCap;

  // One slab per axis. A zero direction component means the ray is parallel to
  // that pair of planes: it either misses entirely or imposes no constraint.
  for (const axis of AXES) {
    const o = origin[axis];
    const d = dir[axis];
    const lo = box.min[axis] - inflate;
    const hi = box.max[axis] + inflate;
    if (Math.abs(d) < 1e-8) {
      if (o < lo || o > hi) return Infinity;
      continue;
    }
    const inv = 1 / d;
    let t1 = (lo - o) * inv;
    let t2 = (hi - o) * inv;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    if (t1 > tMin) tMin = t1;
    if (t2 < tMax) tMax = t2;
    if (tMin > tMax) return Infinity;
  }

  return tMin;
}

const AXES = ['x', 'y', 'z'];

/**
 * @param {number} v
 * @param {number} lo
 * @param {number} hi
 * @returns {number}
 */
export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * The static collision world: buildings plus the playable-extent boundary.
 *
 * Buildings and boundary walls are kept in separate arrays but resolved through
 * one concatenated list, because the camera must ignore the boundary — the walls
 * are invisible, and letting the spring arm collide with them would yank the
 * camera in for no visible reason at the edge of the map. Same source of truth,
 * two views of it; not two copies.
 */
export class CollisionWorld {
  /**
   * @param {object} [options]
   * @param {number} [options.halfExtent=150] playable half-extent, metres.
   */
  constructor({ halfExtent = 150 } = {}) {
    /** @type {THREE.Box3[]} solid, visible geometry the camera should also respect. */
    this.buildings = [];
    /**
     * Who registered each entry in `buildings`, index for index.
     *
     * PARALLEL ARRAY RATHER THAN `{box, owner}` RECORDS, deliberately: `buildings`
     * is handed straight to `raycastBoxes`/`spherecastBoxes` as a plain `Box3[]`,
     * and several tests read it as one. Keeping the public shape unchanged is
     * worth one bookkeeping array.
     * @type {Array<object|null>}
     */
    this._owners = [];
    /**
     * Whether each entry in `buildings` also blocks the HERO, index for index.
     *
     * Almost everything does. The exception is terrain: the hill registers boxes
     * so the CAMERA cannot sink through the hillside, but the hero walks on the
     * real height field instead, and leaving those same boxes solid would have
     * their vertical faces shove him off the slope — the exact defect the height
     * field exists to remove.
     * @type {boolean[]}
     */
    this._solid = [];
    /** @type {THREE.Box3[]} invisible playable-extent walls. */
    this.boundaries = createBoundaryBoxes(halfExtent);
    /** @type {THREE.Box3[]} the concatenated list used for capsule resolution. */
    this.boxes = [...this.boundaries];
    /** @type {Array<(x:number,z:number)=>number>} registered terrain height fields. */
    this._terrain = [];
    this.halfExtent = halfExtent;
  }

  /**
   * Register a building's world-space AABB.
   *
   * `owner` is what makes teardown possible without a shared-list problem. Before
   * it existed, `StreetBlock.dispose()` called `clearBuildings()` — fine when one
   * module owned every collider, wrong the moment two districts and a prop pool
   * share the list, because clearing on behalf of one drops all three. Passing an
   * owner lets each module remove exactly its own.
   *
   * @param {THREE.Box3} box
   * @param {object|null} [owner] whatever registered it; identity-compared.
   * @param {object} [opts]
   * @param {boolean} [opts.solid=true] false registers the box for the CAMERA
   *   only — see `_solid`. Use it for anything the hero should pass through but
   *   the camera arm should not.
   */
  addBuilding(box, owner = null, { solid = true } = {}) {
    this.buildings.push(box);
    this._owners.push(owner);
    this._solid.push(solid);
    if (solid) this.boxes.push(box);
    return box;
  }

  /**
   * Drop every collider registered by one owner, leaving everyone else's alone.
   *
   * @param {object} owner the same reference passed to `addBuilding`
   * @returns {number} how many colliders were removed
   */
  removeOwner(owner) {
    const boxes = [];
    const owners = [];
    const solid = [];
    for (let i = 0; i < this.buildings.length; i++) {
      if (this._owners[i] === owner) continue;
      boxes.push(this.buildings[i]);
      owners.push(this._owners[i]);
      solid.push(this._solid[i]);
    }
    const removed = this.buildings.length - boxes.length;
    this.buildings = boxes;
    this._owners = owners;
    this._solid = solid;
    this._rebuildBoxes();
    return removed;
  }

  /** Drop every building collider, keeping the boundary. For teardown/HMR. */
  clearBuildings() {
    this.buildings.length = 0;
    this._owners.length = 0;
    this._solid.length = 0;
    this.boxes = [...this.boundaries];
  }

  /** Rebuild the capsule list from the boundary plus every SOLID building. */
  _rebuildBoxes() {
    this.boxes = [...this.boundaries];
    for (let i = 0; i < this.buildings.length; i++) {
      if (this._solid[i]) this.boxes.push(this.buildings[i]);
    }
  }

  /**
   * Register a terrain height field — a pure `(x, z) -> height` over world space.
   *
   * WHY A FUNCTION AND NOT A MESH. This module has no scene-graph access by
   * design (see the file header), so terrain arrives as maths, not as geometry.
   * A provider MUST return 0 outside its own footprint, so several can coexist
   * and the tallest simply wins.
   *
   * @param {(x:number, z:number) => number} heightAt
   */
  addTerrain(heightAt) {
    this._terrain.push(heightAt);
    return heightAt;
  }

  /**
   * Ground height at a world point: the tallest registered terrain field, or 0
   * where none applies. This is the surface `resolveCapsule` snaps feet onto in
   * place of the old hard-coded y = 0 plane.
   *
   * @param {number} x @param {number} z
   */
  groundHeightAt(x, z) {
    let best = 0;
    for (const f of this._terrain) {
      const h = f(x, z);
      if (h > best) best = h;
    }
    return best;
  }

  /**
   * Resolve a capsule against the whole world. See `resolveCapsule`.
   * @param {{x:number,y:number,z:number}} position mutated in place
   * @param {number} radius
   * @param {number} height
   * @param {object} [options]
   */
  resolve(position, radius, height, options) {
    return resolveCapsule(position, radius, height, this.boxes, {
      // Only pay for the lookup when terrain actually exists, so a world without
      // any keeps the exact flat-plane path it has always had.
      groundHeightAt: this._terrain.length ? (x, z) => this.groundHeightAt(x, z) : undefined,
      ...options,
    });
  }

  /**
   * Zero-radius camera-arm raycast. Boundary walls are excluded on purpose (see
   * class doc).
   *
   * The rig itself uses `spherecast` below — this stays as the primitive, and
   * because a point query is still the right tool anywhere the caller genuinely
   * has no volume to protect.
   *
   * @param {{x:number,y:number,z:number}} origin
   * @param {{x:number,y:number,z:number}} dir normalised
   * @param {number} maxDistance
   */
  raycast(origin, dir, maxDistance) {
    return raycastBoxes(origin, dir, maxDistance, this.buildings);
  }

  /**
   * Camera-arm sphere-cast — what CameraRig actually calls. Boundary walls are
   * excluded for the same reason as `raycast`: they are invisible, so colliding
   * with them would yank the camera in for no visible cause at the map edge.
   *
   * @param {{x:number,y:number,z:number}} origin
   * @param {{x:number,y:number,z:number}} dir normalised
   * @param {number} maxDistance
   * @param {number} radius swept sphere radius, metres
   */
  spherecast(origin, dir, maxDistance, radius) {
    return spherecastBoxes(origin, dir, maxDistance, radius, this.buildings);
  }
}

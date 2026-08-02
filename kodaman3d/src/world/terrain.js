import * as THREE from 'three';

import { disposeObject3D } from '../core/dispose.js';
import { hash01 } from './facadeAtlas.js';

/**
 * terrain.js — the hill landmark (design spec §PROP-3, §10 item 9).
 *
 * ===========================================================================
 * WHAT THIS IS FOR
 * ===========================================================================
 * `DEN-5` is explicit that "flat is not featureless" and that the world's ground
 * is genuinely flat with zero vertex displacement. §PROP-3 asks for ONE
 * deliberate rise: a **third silhouette class**, distinct from District A's
 * tower plateau and District B's low corridor, and a **third sightline anchor**
 * alongside the two district landmarks — `DEN-6`'s cheapest lever, applied to
 * something that is not a building.
 *
 * It stands north of the annex boulevard, roughly equidistant from both
 * districts' landmarks, so the three of them triangulate the bounded world
 * rather than lining up.
 *
 * ITS NAME IS `COCO HILL` — user-supplied and approved 2026-08-01, locked as
 * decision 25. It is the SECOND name in `kodaman3d/`, after the mast's
 * `AKC ENTERPRISE` (decision 23), and locked decision 6 still reserves every
 * future name to the user. The name lives in one exported constant, `HILL_NAME`,
 * pinned by a test — the same treatment `MAST_SIGN_TEXT` gets, and for the same
 * reason: not because the string is load-bearing, but so it can only ever change
 * by the same sign-off that put it there.
 *
 * ⚠️ NOTHING RENDERS IT YET, AND THAT IS DELIBERATE. There is no signage, map
 * label or HUD in this build for a landform name to appear on. The constant
 * reserves the name in code ahead of the surface that will show it; the mesh is
 * still called `hill`, because that is a scene-graph identifier and not a proper
 * noun. **Do not invent a sign to justify the constant** — a hillside sign is a
 * design decision nobody has made.
 *
 * ===========================================================================
 * WHAT §PROP-3 ASKED FOR THAT THIS FILE DOES **NOT** DO
 * ===========================================================================
 * §PROP-3 also proposes "gentle grade relief riding on the existing ground
 * subdivision" across the districts, on the argument that it is close to free.
 * It is free in triangles and it is NOT free in behaviour: `Collision.js` models
 * the ground as an implicit flat plane at y = 0 with no height query anywhere,
 * so displacing the district ground would put the hero's feet through every
 * slope in the world. Grading the districts needs a terrain height lookup in the
 * locomotion resolve path, which is a `Collision.js` change and is not this
 * run's. **The relief is cut and the reason is mechanical, not budgetary.**
 *
 * ===========================================================================
 * THE COLLIDER IS A STEPPED APPROXIMATION, STATED RATHER THAN HIDDEN
 * ===========================================================================
 * The same AABB-only collision model cannot represent a slope. The hill
 * registers a stack of nested boxes, each one's TOP at the true surface height
 * for its own footprint — so the hero landing anywhere on it lands ON the
 * surface or slightly above it, never inside. The error direction is deliberate:
 * a terrace edge may leave a metre of daylight under the hero's feet, where the
 * opposite choice would bury them in the hillside. Walking UP the hill is not
 * possible (there is no step-up logic); flying onto it is, which is how this
 * game is played. Real terrain collision is a follow-on.
 */

/**
 * The hill's name — **`Coco Hill`**, user-supplied and approved 2026-08-01,
 * locked as decision 25.
 *
 * Nothing renders this yet; see the header note. It is exported and pinned by a
 * test so the name cannot drift, and so the next thing that needs to display a
 * landform name has one place to read it from.
 */
export const HILL_NAME = 'Coco Hill';

/**
 * The hill's authored shape. All metres.
 *
 * Sited north of the annex, clear of both districts' 300 m squares and inside
 * the bounded world (`WORLD_HALF_EXTENT` 610): its footprint spans
 * x ∈ [-90, 210], z ∈ [180, 480].
 */
export const HILL = Object.freeze({
  cx: 60,
  cz: 330,
  /** Footprint radius. */
  radius: 150,
  /** Summit height above the ground plane. */
  height: 68,
  /** Grid resolution across the footprint. 56 x 56 quads = 6,272 triangles. */
  segments: 56,
  /**
   * Dry chaparral, not lawn: this is a Southern California hillside.
   *
   * `colorLow` is District B's ground colour EXACTLY, and that is not a
   * coincidence — the hill is a square displaced plane, so its four corners are
   * flat and sit 1 cm above the district ground. Any other skirt colour draws a
   * 300 m square around the landform, which is what the first build did and what
   * a screenshot caught immediately.
   */
  colorLow: 0x9a927f,
  colorHigh: 0x6f6a4a,
  /** Collider terraces. More is smoother and costs a linear-scan AABB each. */
  terraces: 7,
});

/**
 * Surface height at a point, measured from the hill's centre. Pure and
 * deterministic — the mesh, the colliders and the tests all read it.
 *
 * NOT A CONE, and that is the whole design. A radially symmetric dome reads as
 * the same smooth bump from every approach, which is exactly the failure the
 * District A landmark's asymmetric crown was also authored around (decision 19).
 * Two subordinate spurs and a three-lobed radial modulation give it a ridge
 * line, so the silhouette changes as you fly around it.
 *
 * Returns exactly 0 at and beyond `radius`, so the skirt meets the ground plane
 * with no lip and no gap.
 *
 * @param {number} dx @param {number} dz metres from the hill centre
 */
export function hillHeight(dx, dz) {
  const r = Math.hypot(dx, dz) / HILL.radius;
  if (r >= 1) return 0;

  // Raised cosine: 1 at the centre, 0 with zero gradient at the rim.
  const dome = Math.pow(Math.cos((r * Math.PI) / 2), 1.7);
  // Three-lobed modulation, so the contour lines are not circles.
  //
  // FADED OUT NEAR THE CENTRE, and it has to be: θ is undefined at r = 0, so an
  // un-faded lobe term makes the summit a pinched crease where three different
  // heights meet at one vertex. The first build did exactly that and a
  // screenshot showed a notch cut into the peak.
  const theta = Math.atan2(dz, dx);
  const lobes = 1 + 0.18 * Math.cos(3 * theta + 0.7) * smooth(r / 0.3);

  let h = HILL.height * dome * lobes;
  h += spur(dx, dz, -62, 44, 62, 15);
  h += spur(dx, dz, 55, -52, 55, 11);

  // Force the rim to zero regardless of what the spurs did near it.
  return h * Math.min(1, (1 - r) * 4);
}

/** Smoothstep on [0, 1], clamped. */
function smooth(t) {
  const c = t < 0 ? 0 : t > 1 ? 1 : t;
  return c * c * (3 - 2 * c);
}

/** One subordinate rise, added on top of the dome. */
function spur(dx, dz, sx, sz, reach, rise) {
  const d = Math.hypot(dx - sx, dz - sz) / reach;
  return d >= 1 ? 0 : rise * Math.pow(Math.cos((d * Math.PI) / 2), 2);
}

/**
 * The hill's collider stack: nested boxes whose tops sit at the real surface.
 *
 * Each terrace's footprint is the INSCRIBED square of that height's contour, so
 * a box's top is never above the surface it represents. See the class header for
 * why erring small is the right direction for terrain specifically, where for
 * buildings it is the wrong one.
 *
 * @returns {THREE.Box3[]}
 */
export function hillColliderBoxes() {
  const boxes = [];
  for (let i = 1; i <= HILL.terraces; i++) {
    const y = (HILL.height * i) / HILL.terraces;
    // Largest radius whose surface still reaches y, sampled on the axes and
    // diagonals and taken at its MINIMUM so the square inscribes the contour.
    let radius = HILL.radius;
    for (let a = 0; a < 8; a++) {
      const ang = (a * Math.PI) / 4;
      let lo = 0;
      let hi = HILL.radius;
      for (let it = 0; it < 24; it++) {
        const mid = (lo + hi) / 2;
        if (hillHeight(Math.cos(ang) * mid, Math.sin(ang) * mid) >= y) lo = mid;
        else hi = mid;
      }
      radius = Math.min(radius, lo);
    }
    // Inscribed square inside that circle.
    const half = (radius * Math.SQRT2) / 2;
    if (half < 2) continue;
    boxes.push(
      new THREE.Box3(
        new THREE.Vector3(HILL.cx - half, 0, HILL.cz - half),
        new THREE.Vector3(HILL.cx + half, y, HILL.cz + half),
      ),
    );
  }
  return boxes;
}

/**
 * Build the hill: ONE mesh, 1 main + 1 shadow call.
 *
 * §PROP-3 carried `BUD-6`'s estimate of 2–4 main / 2 shadow / 4–6 total for this
 * line without re-deriving it. Built, it is **2**, because the whole landform is
 * a single displaced plane with one material — the vertex-colour ramp that makes
 * the summit read drier than the skirt rides in the geometry and costs nothing.
 */
export class Terrain {
  /**
   * @param {object} args
   * @param {THREE.Scene} args.scene
   * @param {import('./Collision.js').CollisionWorld} args.collision
   */
  constructor({ scene, collision }) {
    this.scene = scene;
    this.collision = collision;

    const size = HILL.radius * 2;
    const geo = new THREE.PlaneGeometry(size, size, HILL.segments, HILL.segments);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const low = new THREE.Color(HILL.colorLow);
    const high = new THREE.Color(HILL.colorHigh);
    const c = new THREE.Color();

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      let y = hillHeight(x, z);
      // A little deterministic roughness so the slope is not glassy-smooth, but
      // only where there is slope to roughen — the rim must stay at exactly 0.
      if (y > 0.01) y += (hash01(i * 2654435761) - 0.5) * 1.6 * Math.min(1, y / 10);
      pos.setY(i, y);
      c.copy(low).lerp(high, Math.min(1, y / HILL.height));
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    pos.needsUpdate = true;
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: 1,
      metalness: 0,
    });

    this.mesh = new THREE.Mesh(geo, material);
    this.mesh.name = 'hill';
    this.mesh.position.set(HILL.cx, 0, HILL.cz);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.triangles = geo.index.count / 3;

    scene.add(this.mesh);

    /**
     * THE HILL IS REAL TERRAIN NOW, NOT A STACK OF BOXES.
     *
     * It used to register `hillColliderBoxes()` — nested AABBs whose tops sat at
     * the true surface. That was the honest best an AABB-only world could do, and
     * it had two costs the boxes could never shed: **you could not walk up the
     * hill** (each terrace presented a vertical face the horizontal push-out
     * shoved you off), and a terrace edge could leave a metre of daylight under
     * your feet.
     *
     * `CollisionWorld.addTerrain` takes the height field directly, so the ground
     * under the hero simply *is* the surface. `hillHeight` returns 0 outside the
     * footprint, which is exactly the contract a provider must satisfy, so the
     * rest of the world keeps its flat y = 0 plane untouched.
     *
     * `hillColliderBoxes()` is deliberately KEPT and still exported, registered
     * `solid: false`. It is the only description of this landform a pure-AABB
     * consumer can use, and the camera arm is one — `spherecast` reads
     * `buildings`, not terrain, so without the boxes the camera would sink
     * through the hillside the moment the hero could stand on it. Registering
     * them non-solid is the whole point: **the camera sees them, the hero does
     * not.** Leaving them solid would put the terraces' vertical faces back in
     * the push-out path and re-create the defect this change removes.
     */
    collision.addTerrain((x, z) => hillHeight(x - HILL.cx, z - HILL.cz), this);
    for (const box of hillColliderBoxes()) {
      collision.addBuilding(box, this, { solid: false });
    }
  }

  /** Static this run. Present so the update shape matches the districts'. */
  update(_dt) {}

  dispose() {
    // Same order as District/WorldProps/Sky: traverse-and-free, detach, then
    // drop this owner's colliders AND its terrain field. `disposeObject3D` has
    // already disposed the material and its textures, so no bare
    // `material.dispose()` belongs here -- it added nothing and invited a future
    // reader to assume textures were covered by it rather than by the traversal.
    disposeObject3D(this.mesh);
    this.scene.remove(this.mesh);
    this.collision.removeOwner(this);
  }
}

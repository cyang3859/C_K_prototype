/**
 * Scale.js — world units and the 2D→3D conversion rules.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * Porting a 2D canvas side-scroller to 3D fails most often on two things:
 * coordinate handedness, and mixing up *two different* scale factors. Both are
 * pinned down here so no other module has to improvise.
 *
 * COORDINATE CONVENTION (brief §10) — Y-up, metres, right-handed:
 *   +Y is up. The ground plane is y = 0. World origin (0,0,0) sits at the
 *   geometric centre of the street block.
 *   +X / +Z are the horizontal ground-plane axes.
 *   Yaw 0 means facing -Z (Three.js's default camera-forward direction).
 *   Positive yaw is a right-handed rotation about +Y, i.e. counter-clockwise
 *   when viewed from above.
 *
 *   Everything that computes a facing or a camera orbit — LocomotionController
 *   and CameraRig — must use this same convention. The two helper functions
 *   `yawForward()` / `yawRight()` below are the single implementation of it;
 *   call them rather than re-deriving sin/cos signs at each call site. That is
 *   exactly how one module ends up treating +yaw as clockwise while the other
 *   treats it as counter-clockwise.
 *
 * THE TWO SCALES — DO NOT CONFLATE THEM:
 *
 *   1. Position / placement scale: PX_TO_M = 0.2 metres per 2D pixel.
 *      Used only when porting a *location* out of the 2D game (landmark
 *      placement in later phases). The 2D game's 20,000 px corridor becomes a
 *      4,000 m spine under this factor.
 *
 *   2. Physical object scale: real metres, full stop.
 *      HERO_HEIGHT_M = 1.85 — NOT the 2D hero's 100 px drawn height × 0.2 = 20 m.
 *      The 2D game deliberately draws its hero oversized so it reads clearly at
 *      960×540. Porting that ratio into 3D would produce a 20 m giant walking
 *      through a normal-scale city. Positions port through PX_TO_M; physical
 *      dimensions never do.
 *
 * Phase 1 authors all of its geometry directly in metres and therefore barely
 * uses PX_TO_M — it is exported now so that Phase 2's landmark placement has a
 * single canonical constant to reach for instead of inventing its own.
 */

/** Metres per 2D-prototype pixel. Position/placement conversions only. */
export const PX_TO_M = 0.2;

/** Hero capsule total height, metres. A real-world adult figure, not a port of the 2D sprite. */
export const HERO_HEIGHT_M = 1.85;

/** Hero capsule radius, metres. */
export const HERO_RADIUS_M = 0.35;

/**
 * Convert a 2D-prototype pixel *position* to metres.
 * @param {number} n position in 2D pixels
 * @returns {number} position in metres
 */
export const px = (n) => n * PX_TO_M;

/**
 * Unit forward vector for a given yaw, written into `out`.
 * Yaw 0 → (0, 0, -1). Positive yaw rotates counter-clockwise seen from above.
 *
 * Derivation (right-handed rotation of (0,0,-1) about +Y by `yaw`):
 *   x' =  x·cos + z·sin  →  -sin(yaw)
 *   z' = -x·sin + z·cos  →  -cos(yaw)
 *
 * @param {number} yaw radians
 * @param {{x:number,y:number,z:number}} out vector-like to write into (a THREE.Vector3 works)
 * @returns {{x:number,y:number,z:number}} `out`
 */
export function yawForward(yaw, out) {
  out.x = -Math.sin(yaw);
  out.y = 0;
  out.z = -Math.cos(yaw);
  return out;
}

/**
 * Unit right vector for a given yaw (forward × up), written into `out`.
 * Yaw 0 → (1, 0, 0), i.e. +X is to the right of a hero facing -Z.
 *
 * @param {number} yaw radians
 * @param {{x:number,y:number,z:number}} out vector-like to write into
 * @returns {{x:number,y:number,z:number}} `out`
 */
export function yawRight(yaw, out) {
  out.x = Math.cos(yaw);
  out.y = 0;
  out.z = -Math.sin(yaw);
  return out;
}

/**
 * The yaw that would make `yawForward(yaw)` point along the horizontal
 * direction (dx, dz). Inverse of `yawForward`.
 *
 * @param {number} dx
 * @param {number} dz
 * @returns {number} yaw in radians, in (-PI, PI]
 */
export function yawFromDirection(dx, dz) {
  return Math.atan2(-dx, -dz);
}

/**
 * Shortest signed angular difference `to - from`, wrapped into (-PI, PI].
 * Used by every "turn toward" easement so a hero facing +179° and turning to
 * -179° takes the 2° path rather than the 358° one.
 *
 * @param {number} from radians
 * @param {number} to radians
 * @returns {number} radians in (-PI, PI]
 */
export function shortestAngleDelta(from, to) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

import * as THREE from 'three';

import { TUNING } from '../config/tuning.js';
import { clamp } from '../world/Collision.js';

/**
 * CameraRig.js — hand-rolled spring-arm ("boom") third-person camera.
 *
 * Three.js has no native SpringArm object, so this is built from parts: a pivot
 * above the hero, a spherical offset driven by mouse yaw/pitch, an obstruction
 * raycast, and a ground↔flight parameter cross-fade.
 *
 * UPDATE ORDER IS LOAD-BEARING (brief §5). This rig MUST run AFTER the
 * locomotion controller within the SAME fixed step, reading the hero's final
 * transform for that step. Updating it before locomotion — or in a separate
 * later pass — makes the camera lag the hero by one frame, and the whole game
 * reads as soft and laggy. Game.js enforces the order; do not "optimise" it.
 *
 * ONE DAMPING CONSTANT, REUSED EVERYWHERE
 * ---------------------------------------
 * Every eased property in this file uses the same exponential smoothing:
 *
 *     t = 1 - exp(-lambda * dt);   current += (desired - current) * t
 *
 * with lambda = 6.32. That is not an arbitrary feel number: it is the exact
 * framerate-independent equivalent of the 2D camera's per-frame
 * `camera.x += (dx - camera.x) * 0.1` at 60 fps, since
 * lambda = -60 · ln(1 - 0.1) ≈ 6.32.
 *
 * The naive `current.lerp(desired, 0.1)` form is framerate-DEPENDENT: at 144 Hz
 * it converges 2.4× faster than at 60 Hz, so the camera feels tighter on better
 * hardware. The exp() form gives identical motion at any step rate, which is
 * what acceptance criterion 25 checks.
 *
 * Do not introduce a second, different lerp rate for any one property. If a
 * property needs different responsiveness, that is a conversation about lambda,
 * not a licence to scatter ad hoc constants through this file.
 */

/**
 * Framerate-independent exponential smoothing weight.
 *
 * Exported so tests/locomotion.test.js can assert criterion 25 directly against
 * the formula. (Phase 1's file tree allows exactly two test files; the camera
 * smoothing assertion lives in the locomotion suite alongside the other
 * framerate-independence checks rather than justifying a third file.)
 *
 * @param {number} lambda decay rate, 1/s
 * @param {number} dt seconds
 * @returns {number} interpolation weight in [0, 1)
 */
export function smoothingWeight(lambda, dt) {
  return 1 - Math.exp(-lambda * dt);
}

/**
 * Apply framerate-independent exponential smoothing to a scalar.
 * @param {number} current
 * @param {number} desired
 * @param {number} lambda
 * @param {number} dt
 * @returns {number}
 */
export function damp(current, desired, lambda, dt) {
  return current + (desired - current) * smoothingWeight(lambda, dt);
}

export class CameraRig {
  /**
   * @param {object} args
   * @param {THREE.PerspectiveCamera} args.camera
   * @param {object} args.hero hero state from createHeroState()
   * @param {import('../world/Collision.js').CollisionWorld} args.collision
   * @param {object} [args.tuning]
   */
  constructor({ camera, hero, collision, tuning = TUNING }) {
    this.camera = camera;
    this.hero = hero;
    this.collision = collision;
    this.tuning = tuning;

    /** Orbit yaw, unbounded — it accumulates freely as the player spins. */
    this.yaw = 0;
    /** Orbit pitch, hard-clamped so the camera can never flip over the pole. */
    this.pitch = 0.25;

    /** User wheel-zoom offset applied on top of the blended base distance. */
    this.distanceOffset = 0;

    /**
     * Ground↔flight cross-fade in [0, 1]: 0 = fully grounded parameters,
     * 1 = fully flight parameters. Driven by a timer, not by an exponential, so
     * the transition has a defined 0.6 s duration that criterion 24 can sample
     * against.
     */
    this.blend = 0;
    this._lastFlightActive = false;

    // Smoothed working values.
    this.currentDistance = tuning.CAM_GROUND_DISTANCE;
    this.currentHeight = tuning.CAM_GROUND_HEIGHT;
    this.currentFov = tuning.CAM_GROUND_FOV;
    /** Obstruction-limited arm length, eased so recovery is smooth, not a pop. */
    this.currentArm = tuning.CAM_GROUND_DISTANCE;

    this.pivot = new THREE.Vector3();
    this.position = new THREE.Vector3();
    this._desired = new THREE.Vector3();
    this._dir = new THREE.Vector3();

    // Place the camera correctly on frame 0 rather than letting it fly in from
    // the origin over the first half second.
    this._updatePivot();
    this._computeDesired(this.currentDistance);
    this.position.copy(this._desired);
    this.camera.position.copy(this.position);
    this.camera.lookAt(this.pivot);
  }

  /**
   * @param {number} dt fixed timestep, seconds
   * @param {object} input input snapshot (look deltas and wheel)
   */
  update(dt, input) {
    const t = this.tuning;

    // ---- mouse look ----------------------------------------------------
    // Deltas are raw pointer-lock movement in pixels, accumulated by Input.js
    // and zeroed at the end of each fixed step, so no motion is double-counted
    // and none is dropped when a frame runs several steps.
    if (input && input.look) {
      this.yaw -= input.look.dx * t.CAM_MOUSE_SENSITIVITY;
      this.pitch += input.look.dy * t.CAM_MOUSE_SENSITIVITY;
      // Clamp, never wrap. A wrapping pitch flips the camera upside down at the
      // poles and there is no graceful recovery from it.
      this.pitch = clamp(this.pitch, t.CAM_PITCH_MIN, t.CAM_PITCH_MAX);
    }

    // ---- wheel zoom ----------------------------------------------------
    // The wheel adjusts the TARGET distance that the ground/flight blend eases
    // toward — it is not an instant jump, so a zoom during a takeoff blend does
    // not fight the cross-fade.
    if (input && input.wheel) {
      this.distanceOffset += input.wheel * t.CAM_WHEEL_STEP;
    }

    // ---- ground <-> flight cross-fade ----------------------------------
    // Triggered by the hero crossing the grounded/airborne boundary, i.e. on
    // grounded→takeoff and on flying/landing→grounded.
    const flightActive = this.hero.flightActive;
    if (flightActive !== this._lastFlightActive) {
      this._lastFlightActive = flightActive;
    }
    const blendTarget = flightActive ? 1 : 0;
    const blendStep = dt / Math.max(t.CAM_BLEND_TIME, 1e-6);
    if (this.blend < blendTarget) this.blend = Math.min(this.blend + blendStep, blendTarget);
    else if (this.blend > blendTarget) this.blend = Math.max(this.blend - blendStep, blendTarget);

    const baseDistance = lerp(t.CAM_GROUND_DISTANCE, t.CAM_FLIGHT_DISTANCE, this.blend);
    const baseHeight = lerp(t.CAM_GROUND_HEIGHT, t.CAM_FLIGHT_HEIGHT, this.blend);
    let baseFov = lerp(t.CAM_GROUND_FOV, t.CAM_FLIGHT_FOV, this.blend);

    // Dash FOV surge: the cheapest speed sensation available. Scaled by actual
    // horizontal speed against the flight dash cap, so it ramps in with the
    // acceleration curve rather than popping on the Shift keydown.
    if (flightActive) {
      const speed = Math.hypot(this.hero.velocity.x, this.hero.velocity.z);
      const surge = clamp(speed / t.FLIGHT_DASH_SPEED, 0, 1);
      baseFov += t.CAM_DASH_FOV_BOOST * surge;
    }

    // Wheel offset is clamped against absolute limits rather than baked into the
    // blend, so zoom preference survives a takeoff.
    const targetDistance = clamp(
      baseDistance + this.distanceOffset,
      t.CAM_MIN_DISTANCE,
      t.CAM_MAX_DISTANCE,
    );

    // Same lambda for all three. See the file header.
    this.currentDistance = damp(this.currentDistance, targetDistance, t.CAMERA_LAMBDA, dt);
    this.currentHeight = damp(this.currentHeight, baseHeight, t.CAMERA_LAMBDA, dt);
    this.currentFov = damp(this.currentFov, baseFov, t.CAMERA_LAMBDA, dt);

    // ---- placement + obstruction ---------------------------------------
    this._updatePivot();
    this._computeDesired(this.currentDistance);

    // Ray from the pivot toward where the camera wants to be. A PLAIN RAYCAST,
    // not a sphere-cast, is the deliberate Phase 1 choice: this block is large
    // flat-faced building AABBs with no thin or sharp obstacles, and the 0.2 m
    // padding already absorbs most of what a sphere-cast would buy at
    // near = 0.1. NAMED FALLBACK, not a silent gap — if QA finds visible
    // near-plane clipping at building corners, upgrade THIS ONE raycast to a
    // sphere-cast then. Do not preemptively build it.
    this._dir.copy(this._desired).sub(this.pivot);
    const wanted = this._dir.length();
    let armLength = wanted;
    if (wanted > 1e-5) {
      this._dir.divideScalar(wanted);
      const hit = this.collision.raycast(this.pivot, this._dir, wanted);
      if (hit < wanted) {
        armLength = Math.max(hit - t.CAM_COLLISION_PADDING, 0.1);
      }
    }

    // Pull IN immediately (a camera inside a wall for even one frame shows the
    // building's interior and reads as a bug), but recover OUT smoothly with the
    // same exponential everything else uses.
    if (armLength < this.currentArm) {
      this.currentArm = armLength;
    } else {
      this.currentArm = damp(this.currentArm, armLength, t.CAMERA_LAMBDA, dt);
    }

    this._computeDesired(this.currentArm);
    this.position.copy(this._desired);

    this.camera.position.copy(this.position);
    this.camera.lookAt(this.pivot);
    if (Math.abs(this.camera.fov - this.currentFov) > 1e-4) {
      this.camera.fov = this.currentFov;
      this.camera.updateProjectionMatrix();
    }
  }

  /** Pivot sits above the hero's feet by the blended height offset. */
  _updatePivot() {
    this.pivot.set(
      this.hero.position.x,
      this.hero.position.y + this.currentHeight,
      this.hero.position.z,
    );
  }

  /**
   * Spherical offset from the pivot at the current yaw/pitch.
   *
   * Uses the SAME yaw convention as the hero (yaw 0 = looking down -Z, positive
   * yaw counter-clockwise about +Y): the camera sits BEHIND the look direction,
   * i.e. at +forward-reversed. Positive pitch raises the camera and looks down.
   *
   * @param {number} distance arm length in metres
   */
  _computeDesired(distance) {
    const cosPitch = Math.cos(this.pitch);
    const sinPitch = Math.sin(this.pitch);
    // Behind the hero = -forward(yaw) = (sin(yaw), 0, cos(yaw)).
    this._desired.set(
      this.pivot.x + Math.sin(this.yaw) * cosPitch * distance,
      this.pivot.y + sinPitch * distance,
      this.pivot.z + Math.cos(this.yaw) * cosPitch * distance,
    );
  }
}

/**
 * @param {number} a
 * @param {number} b
 * @param {number} k
 */
function lerp(a, b, k) {
  return a + (b - a) * k;
}

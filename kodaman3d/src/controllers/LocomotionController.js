import * as THREE from 'three';

import { TUNING } from '../config/tuning.js';
import { HERO_HEIGHT_M, HERO_RADIUS_M, shortestAngleDelta, yawFromDirection } from '../core/Scale.js';

/**
 * LocomotionController.js — the hero's grounded/takeoff/flying/landing FSM.
 *
 * This is the heart of the Phase 1 slice. Everything else in the project exists
 * to render, drive or debug what happens in this file.
 *
 * WHY IT IS SHAPED THIS WAY
 * -------------------------
 * The controller never touches the scene graph. It reads a plain input snapshot
 * and mutates a plain hero-state object (`position`, `velocity`, `facing`, ...).
 * Hero.js is responsible for copying that state onto its THREE.Group each frame.
 * The separation is not ceremony: it is what allows tests/locomotion.test.js to
 * simulate three seconds of flight in `environment: 'node'` with no WebGL, no
 * DOM and no renderer — which is the only reason the acceptance criteria about
 * hover drift, dash altitude and framerate independence are checkable at all.
 *
 * If you add a feature here that needs a Mesh, put the Mesh part in Hero.js and
 * keep the decision-making here.
 *
 * READ TUNING VALUES AT CALL TIME. `TUNING` is live-bound to lil-gui; never
 * destructure its numbers into module scope, or live retuning silently breaks.
 *
 * THE ONE RULE THAT MUST NEVER BE BROKEN:
 *   GRAVITY is applied in exactly one place — the `grounded` state, when the
 *   hero is not on the ground (walked off a ledge). Never in takeoff, flying or
 *   landing. Reasserting gravity while `flightActive` is true is a regression,
 *   full stop, not a tuning choice. Descent in `landing` is a *scripted*
 *   acceleration (LANDING_DESCENT_ACCEL), deliberately a separate constant so
 *   that this rule stays mechanically checkable.
 */

/** The four FSM states. String values so debug readouts and tests are legible. */
export const LocomotionState = Object.freeze({
  GROUNDED: 'grounded',
  TAKEOFF: 'takeoff',
  FLYING: 'flying',
  LANDING: 'landing',
});

/**
 * Create the plain state object the controller operates on.
 *
 * Hero.js composes this into its Group; tests construct it standalone. Fields
 * mirror the brief's required hero state exactly, plus the bookkeeping the FSM
 * needs.
 *
 * @param {object} [init]
 * @param {THREE.Vector3} [init.position] starting feet position
 * @returns {object} hero state
 */
export function createHeroState({ position = new THREE.Vector3(0, 0, 0) } = {}) {
  return {
    /** Feet position in world space, metres. See Collision.js's capsule convention. */
    position: position.clone(),
    /** Velocity in m/s. */
    velocity: new THREE.Vector3(0, 0, 0),
    /** Yaw in radians. 0 = facing -Z (see core/Scale.js). */
    facing: 0,
    /** Visual body pitch in radians, flight lean only. Never affects movement. */
    pitch: 0,
    /** Set by the collision resolve each step. */
    onGround: true,
    /** True in takeoff/flying/landing. The gravity interlock keys off this. */
    flightActive: false,
    /**
     * Mirrors `state === 'landing'`. Redundant by design: the brief specifies it
     * as a hero state field, and the debug HUD and cape animation read it
     * without needing to know the FSM's string vocabulary. Kept in sync in one
     * place (`_setState`) so it can never drift.
     */
    landing: false,
    /** 'super' | 'civilian'. Cosmetic only; the controller never reads it. */
    persona: 'super',
    /** Current FSM state. */
    state: LocomotionState.GROUNDED,
    /** Fixed steps left in the scripted takeoff. */
    takeoffStepsRemaining: 0,
    /** True for the duration of takeoff; drives the cape flare visual. */
    capeFlare: false,
  };
}

/**
 * The effective horizontal speed cap, as a pure function of state and input.
 *
 * Exported separately because acceptance criteria 10 and 17 are specifically
 * about *the cap value*, and a pure function is far more meaningful to assert
 * against than an emergent speed after N simulated steps.
 *
 * SHIFT IS A CAP RAISE, NOT AN IMPULSE. Holding Shift raises the target that
 * the existing MOVE_ACCEL curve pursues; releasing it lowers the target and the
 * same curve decelerates back down. There is deliberately no burst/impulse code
 * path anywhere in this file.
 *
 * @param {object} args
 * @param {string} args.state one of LocomotionState
 * @param {boolean} args.dash Shift held
 * @param {boolean} args.fine J/K/L held
 * @param {object} [tuning]
 * @returns {number} speed cap in m/s
 */
export function horizontalSpeedCap({ state, dash, fine }, tuning = TUNING) {
  const airborne = state !== LocomotionState.GROUNDED;
  let cap = tuning.MAX_SPEED;
  if (dash) {
    // Takeoff and landing count as airborne for the dash cap: horizontal control
    // is fully active in all four states, so a Shift-dash mid-takeoff should not
    // suddenly be governed by the ground number.
    cap = airborne ? tuning.FLIGHT_DASH_SPEED : tuning.DASH_SPEED;
  }
  // Precision-aiming slowdown applies in `flying` only, per the brief's placement
  // of the rule inside the flying state.
  if (fine && state === LocomotionState.FLYING) {
    cap *= tuning.FLIGHT_FINE_MULT;
  }
  return cap;
}

/**
 * Exponential decay factor for a per-frame-at-60fps damping constant.
 * `pow(f, 60*dt)` is identical to `pow(f^60, dt)` but avoids keeping a derived
 * per-second constant in sync with the lil-gui-editable per-frame one.
 *
 * @param {number} perFrameFactor e.g. 0.82
 * @param {number} dt seconds
 * @returns {number} multiplier to apply to velocity this step
 */
export function frictionFactor(perFrameFactor, dt) {
  return Math.pow(perFrameFactor, 60 * dt);
}

/**
 * Half-life decay factor for hover damping.
 *
 * DELIBERATELY NOT `pow(FLIGHT_HOVER_DAMPING, 60*dt)`. See the long explanation
 * in config/tuning.js: 0.18^60 ≈ 2.1e-45, which zeroes vertical velocity inside
 * one step and offers no usable slider range. Half-life decay is the tunable
 * formulation, and `hoverDampingHalfLife` (seconds to halve the velocity) is a
 * quantity a human can reason about and retune by feel.
 *
 * @param {number} halfLife seconds
 * @param {number} dt seconds
 * @returns {number} multiplier to apply to vertical velocity this step
 */
export function hoverDampingFactor(halfLife, dt) {
  return Math.pow(0.5, dt / halfLife);
}

export class LocomotionController {
  /**
   * @param {object} args
   * @param {object} args.hero hero state from `createHeroState()`
   * @param {import('../world/Collision.js').CollisionWorld} args.collision
   * @param {object} [args.tuning] defaults to the live TUNING object
   * @param {number} [args.radius]
   * @param {number} [args.height]
   */
  constructor({
    hero,
    collision,
    tuning = TUNING,
    radius = HERO_RADIUS_M,
    height = HERO_HEIGHT_M,
  }) {
    this.hero = hero;
    this.collision = collision;
    this.tuning = tuning;
    this.radius = radius;
    this.height = height;

    /** Scratch vectors — allocated once. Allocating in a 60 Hz loop is how you
     *  get GC sawtooth in the frame-time graph. */
    this._dir = new THREE.Vector3();
    this._target = new THREE.Vector3();
    this._delta = new THREE.Vector3();

    /** Last contact report, exposed for the debug HUD. */
    this.lastContact = { onGround: true, groundY: 0, pushed: false, surfaceIndex: -1 };
  }

  /**
   * Advance the hero by one FIXED step.
   *
   * @param {number} dt fixed timestep in seconds (always 1/60 in the real loop;
   *   the tests deliberately vary it to prove framerate independence)
   * @param {object} input the input snapshot: { forward, back, left, right,
   *   jumpDown, jumpPressed, descend, dash, fine, landPressed }
   * @param {number} cameraYaw the camera's yaw, which defines the movement basis
   */
  update(dt, input, cameraYaw) {
    // 1. Edge/level-triggered transitions FIRST, so a state entered this step
    //    also runs its own vertical logic this step (takeoff's first of 12
    //    climb steps happens on the very step W was pressed — no dead frame).
    this._applyInputTransitions(input);

    // 2. Horizontal movement. Runs in ALL FOUR STATES, unconditionally.
    //    Horizontal input is never state-gated; only vertical motion is. A
    //    takeoff or landing that ignores steering reads as a canned cutscene and
    //    contradicts the 2D game's snappy feel.
    this._updateHorizontal(dt, input, cameraYaw);

    // 3. Vertical, which is entirely state-dependent.
    this._updateVertical(dt, input);

    // 4. Integrate. Semi-implicit Euler: velocity was updated above, position
    //    uses the new velocity. Stable at a fixed 60 Hz for these speeds.
    const previousY = this.hero.position.y;
    this.hero.position.x += this.hero.velocity.x * dt;
    this.hero.position.y += this.hero.velocity.y * dt;
    this.hero.position.z += this.hero.velocity.z * dt;

    // 5. Resolve against the static world. `previousY` is what makes the ground
    //    test a swept check rather than a point sample, so no velocity can
    //    tunnel the hero through the ground plane in one step.
    const contact = this.collision.resolve(this.hero.position, this.radius, this.height, {
      previousY,
    });
    this.lastContact = contact;
    this.hero.onGround = contact.onGround;

    // 6. Contact-driven transitions, evaluated after resolution.
    this._applyContactTransitions(contact);

    // 7. Visual-only orientation. Never feeds back into movement.
    this._updateOrientation(dt, input);
  }

  // ------------------------------------------------------------- transitions

  /**
   * @param {object} input
   */
  _applyInputTransitions(input) {
    const hero = this.hero;

    switch (hero.state) {
      case LocomotionState.GROUNDED:
        // Takeoff fires on the DOWN-EDGE of W/Space while standing. Edge, not
        // level: otherwise holding W to climb would re-enter takeoff forever.
        // There is no tap-vs-hold timer — see the long note in core/Input.js.
        if (input.jumpPressed && hero.onGround) {
          this._enterTakeoff();
        }
        break;

      case LocomotionState.FLYING:
        // G begins a controlled descent.
        if (input.landPressed) {
          this._setState(LocomotionState.LANDING);
        }
        break;

      case LocomotionState.LANDING:
        // Landing aborts on W/Space HELD — level-triggered, not an edge. The 2D
        // original reads `if (e.landing && input.jumpHeld) e.landing = false`,
        // so a player who is already holding W when they hit G never commits to
        // the descent at all. Preserved deliberately.
        if (input.jumpDown) {
          this._setState(LocomotionState.FLYING);
        }
        break;

      default:
        // TAKEOFF is scripted and ignores input transitions for its 12 steps.
        break;
    }
  }

  /**
   * @param {{onGround:boolean}} contact
   */
  _applyContactTransitions(contact) {
    const hero = this.hero;
    if (!contact.onGround) return;

    if (hero.state === LocomotionState.FLYING || hero.state === LocomotionState.LANDING) {
      // Touching down from flight returns to `grounded` directly, whether the
      // player pressed G or simply flew low enough to scuff the pavement.
      this._setState(LocomotionState.GROUNDED);
      hero.velocity.y = 0;
    } else if (hero.state === LocomotionState.GROUNDED && hero.velocity.y < 0) {
      // Landed after walking off a ledge: kill the accumulated fall speed so it
      // does not carry into the next airborne moment.
      hero.velocity.y = 0;
    }
    // TAKEOFF deliberately ignores ground contact: the first step of a takeoff
    // can still report contact on some surfaces, and cancelling there would make
    // takeoff unreliable.
  }

  _enterTakeoff() {
    this._setState(LocomotionState.TAKEOFF);
    this.hero.takeoffStepsRemaining = this.tuning.TAKEOFF_STEPS;
    this.hero.capeFlare = true;
  }

  /**
   * Single place where FSM state changes, so the derived flags can never drift
   * out of sync with `state`.
   * @param {string} next
   */
  _setState(next) {
    const hero = this.hero;
    if (hero.state === next) return;
    hero.state = next;
    hero.landing = next === LocomotionState.LANDING;
    hero.flightActive = next !== LocomotionState.GROUNDED;
    if (next !== LocomotionState.TAKEOFF) {
      hero.capeFlare = false;
      hero.takeoffStepsRemaining = 0;
    }
  }

  // -------------------------------------------------------------- horizontal

  /**
   * Camera-relative WASD. The 2D game has one horizontal axis; in 3D the input
   * is projected through the camera: forward = camera forward with Y zeroed and
   * renormalised, right = its XZ perpendicular. Both come from the shared yaw
   * helpers in core/Scale.js so the hero's facing math and the camera's orbit
   * math cannot disagree about which way positive yaw turns.
   *
   * @param {number} dt
   * @param {object} input
   * @param {number} cameraYaw
   */
  _updateHorizontal(dt, input, cameraYaw) {
    const t = this.tuning;
    const hero = this.hero;

    // Build the desired direction in the camera basis.
    // forward(yaw) = (-sin, 0, -cos); right(yaw) = (cos, 0, -sin).
    const sin = Math.sin(cameraYaw);
    const cos = Math.cos(cameraYaw);
    const fwd = (input.forward ? 1 : 0) - (input.back ? 1 : 0);
    const strafe = (input.right ? 1 : 0) - (input.left ? 1 : 0);

    let dx = -sin * fwd + cos * strafe;
    let dz = -cos * fwd - sin * strafe;

    const magSq = dx * dx + dz * dz;
    const hasInput = magSq > 1e-8;

    if (hasInput) {
      // Normalise so diagonal input is not ~41% faster than cardinal input.
      const inv = 1 / Math.sqrt(magSq);
      dx *= inv;
      dz *= inv;

      const cap = horizontalSpeedCap(
        { state: hero.state, dash: input.dash, fine: input.fine },
        t,
      );
      const fineMult =
        input.fine && hero.state === LocomotionState.FLYING ? t.FLIGHT_FINE_MULT : 1;
      const accel = t.MOVE_ACCEL * fineMult;

      // Accelerate the horizontal velocity toward the capped target. Using a
      // capped delta (rather than "add accel then clamp speed") is what makes
      // Shift a pure cap change: when the cap drops on Shift release, the same
      // expression decelerates toward the lower target at MOVE_ACCEL with no
      // separate braking code path.
      const targetX = dx * cap;
      const targetZ = dz * cap;
      let deltaX = targetX - hero.velocity.x;
      let deltaZ = targetZ - hero.velocity.z;
      const deltaMag = Math.hypot(deltaX, deltaZ);
      const maxDelta = accel * dt;
      if (deltaMag > maxDelta && deltaMag > 1e-9) {
        const s = maxDelta / deltaMag;
        deltaX *= s;
        deltaZ *= s;
      }
      hero.velocity.x += deltaX;
      hero.velocity.z += deltaZ;

      this._dir.set(dx, 0, dz);
    } else {
      // No directional input: exponential friction decay. Ground friction is
      // aggressive (0.82/frame) so the hero stops crisply; air friction (0.92)
      // lets flight coast. A hero in `grounded` but off the ground (mid-fall off
      // a ledge) uses air friction, which is the physically sensible choice and
      // stops a fall from feeling like it has brakes.
      const onSolidGround = hero.state === LocomotionState.GROUNDED && hero.onGround;
      const perFrame = onSolidGround ? t.GROUND_FRICTION : t.AIR_FRICTION;
      const f = frictionFactor(perFrame, dt);
      hero.velocity.x *= f;
      hero.velocity.z *= f;
      this._dir.set(0, 0, 0);
    }
  }

  // ---------------------------------------------------------------- vertical

  /**
   * @param {number} dt
   * @param {object} input
   */
  _updateVertical(dt, input) {
    const t = this.tuning;
    const hero = this.hero;

    switch (hero.state) {
      case LocomotionState.GROUNDED: {
        if (hero.onGround) {
          // Resting on a surface. Vertical velocity is exactly zero, not
          // "small": any residual would accumulate into a slow sink.
          hero.velocity.y = 0;
        } else {
          // THE ONLY PLACE GRAVITY IS EVER APPLIED. The hero walked off a
          // ledge. See the class doc comment.
          hero.velocity.y -= t.GRAVITY * dt;
        }
        break;
      }

      case LocomotionState.TAKEOFF: {
        // Scripted: a constant forced climb for exactly TAKEOFF_STEPS steps
        // (12 × 1/60 s = 0.2 s). Not an impulse, and JUMP_FORCE is deliberately
        // not used here — see its note in config/tuning.js.
        hero.velocity.y = t.TAKEOFF_CLIMB_SPEED;
        hero.takeoffStepsRemaining -= 1;
        if (hero.takeoffStepsRemaining <= 0) {
          this._setState(LocomotionState.FLYING);
        }
        break;
      }

      case LocomotionState.FLYING: {
        const fineMult = input.fine ? t.FLIGHT_FINE_MULT : 1;

        if (input.jumpDown) {
          // Climb. `_approach` also eases DOWN to the cap, which matters when
          // the player engages fine mode at full climb speed: without it the
          // velocity would sit above the fine cap indefinitely, because the
          // literal "only thrust while below the cap" rule never touches it.
          const cap = t.MAX_FLIGHT_UP_SPEED * fineMult;
          hero.velocity.y = approach(hero.velocity.y, cap, t.FLIGHT_UP_THRUST * fineMult * dt);
        } else if (input.descend) {
          // Dive.
          const cap = -t.MAX_FLIGHT_DOWN_SPEED * fineMult;
          hero.velocity.y = approach(hero.velocity.y, cap, t.FLIGHT_DOWN_THRUST * fineMult * dt);
        } else {
          // HOVER — the single most important feel property in the port.
          // Releasing both W and S must HOLD ALTITUDE, not sink. Half-life decay
          // bleeds off the residual vertical speed, then the snap threshold
          // zeroes it exactly, so altitude is held precisely rather than
          // asymptotically. Gravity is emphatically not applied here.
          hero.velocity.y *= hoverDampingFactor(t.hoverDampingHalfLife, dt);
          if (Math.abs(hero.velocity.y) < t.HOVER_SNAP_SPEED) {
            hero.velocity.y = 0;
          }
        }
        break;
      }

      case LocomotionState.LANDING: {
        // A scripted controlled descent, NOT gravity. Separate constants on
        // purpose so "gravity is never applied during flight" stays a
        // mechanically checkable statement rather than a matter of degree.
        hero.velocity.y -= t.LANDING_DESCENT_ACCEL * dt;
        if (hero.velocity.y < -t.LANDING_MAX_DOWN_SPEED) {
          hero.velocity.y = -t.LANDING_MAX_DOWN_SPEED;
        }
        break;
      }

      default:
        break;
    }
  }

  // ------------------------------------------------------------- orientation

  /**
   * Yaw and body pitch. VISUAL ONLY — nothing here feeds back into velocity.
   *
   * @param {number} dt
   * @param {object} input
   */
  _updateOrientation(dt, input) {
    const t = this.tuning;
    const hero = this.hero;

    // Yaw turns toward the travel direction at a limited angular RATE rather
    // than snapping, which is what acceptance criterion 9 checks. Rate-limited
    // (not exponential) so the turn speed is a number a designer can reason
    // about directly: 12 rad/s ≈ a 180° turn in a quarter second.
    if (this._dir.lengthSq() > 1e-8) {
      const targetYaw = yawFromDirection(this._dir.x, this._dir.z);
      const delta = shortestAngleDelta(hero.facing, targetYaw);
      const maxStep = t.YAW_SLERP_RATE * dt;
      hero.facing += Math.abs(delta) <= maxStep ? delta : Math.sign(delta) * maxStep;
    }
    // No input: yaw holds its current value. Deliberate — a hero that snaps back
    // to a default facing when you release the stick looks broken.

    // Body pitch leans the hero toward horizontal at speed (the Superman pose).
    // Positive pitch = nose down. At the flying dive cap of 6.1 m/s this reaches
    // ~0.76 rad; the 1.5 rad cap exists for future, faster dive tuning.
    if (hero.flightActive) {
      hero.pitch = clampNumber(
        -hero.velocity.y / t.PITCH_SPEED_DIVISOR,
        t.MIN_FORWARD_PITCH,
        t.MAX_FORWARD_PITCH,
      );
    } else {
      // Ease upright on landing instead of snapping, using the same exponential
      // form the camera rig uses everywhere.
      hero.pitch += (0 - hero.pitch) * (1 - Math.exp(-t.CAMERA_LAMBDA * dt));
    }
  }
}

/**
 * Move `value` toward `target` by at most `maxStep`, from either side.
 * @param {number} value
 * @param {number} target
 * @param {number} maxStep must be >= 0
 * @returns {number}
 */
export function approach(value, target, maxStep) {
  if (value < target) return Math.min(value + maxStep, target);
  if (value > target) return Math.max(value - maxStep, target);
  return target;
}

/**
 * @param {number} v
 * @param {number} lo
 * @param {number} hi
 */
function clampNumber(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

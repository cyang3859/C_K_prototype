import * as THREE from 'three';
import { afterEach, describe, expect, it } from 'vitest';

import {
  LocomotionController,
  LocomotionState,
  createHeroState,
  frictionFactor,
  hoverDampingFactor,
  horizontalSpeedCap,
} from '../src/controllers/LocomotionController.js';
import { damp, smoothingWeight } from '../src/controllers/CameraRig.js';
import { CollisionWorld } from '../src/world/Collision.js';
import { Hero } from '../src/entities/Hero.js';
import { Input } from '../src/core/Input.js';
import { yawForward } from '../src/core/Scale.js';
import { TUNING, resetTuning } from '../src/config/tuning.js';

/**
 * locomotion.test.js — acceptance criteria 4, 10, 15, 16, 17, 18, 19, 21, 25.
 *
 * These run against the real LocomotionController with the real CollisionWorld,
 * in `environment: 'node'`. The whole reason the controller keeps the scene
 * graph at arm's length is so that this file can simulate several seconds of
 * flight deterministically with no WebGL and no DOM.
 */

const DT = 1 / 60;

/** Fresh input snapshot; override only what a test cares about. */
function mkInput(overrides = {}) {
  return {
    forward: false,
    back: false,
    left: false,
    right: false,
    jumpDown: false,
    jumpPressed: false,
    descend: false,
    dash: false,
    fine: false,
    landPressed: false,
    look: { dx: 0, dy: 0 },
    wheel: 0,
    ...overrides,
  };
}

/** Controller over an empty world (ground plane + boundary walls only). */
function makeRig({ y = 0 } = {}) {
  const collision = new CollisionWorld({ halfExtent: 150 });
  const hero = createHeroState({ position: new THREE.Vector3(0, y, 0) });
  const controller = new LocomotionController({ hero, collision });
  return { collision, hero, controller };
}

/**
 * Force the hero into mid-air `flying` without simulating a takeoff, so a test
 * can isolate one behaviour. Mirrors exactly what the FSM sets on entry.
 */
function forceFlying(hero, altitude = 50) {
  hero.state = LocomotionState.FLYING;
  hero.flightActive = true;
  hero.landing = false;
  hero.onGround = false;
  hero.position.y = altitude;
  hero.velocity.set(0, 0, 0);
}

/** Run n fixed steps with a constant input. */
function step(controller, input, n = 1, dt = DT, cameraYaw = 0) {
  for (let i = 0; i < n; i++) controller.update(dt, input, cameraYaw);
}

afterEach(() => {
  // Several tests deliberately mutate TUNING (it is live-bound to lil-gui in
  // the app). Restore the shipped defaults so test order can never matter.
  resetTuning();
});

// ---------------------------------------------------------------------------
// FSM transitions
// ---------------------------------------------------------------------------

describe('FSM: grounded → takeoff → flying', () => {
  it('takes off on the down-edge of W while on the ground', () => {
    const { hero, controller } = makeRig();
    expect(hero.state).toBe(LocomotionState.GROUNDED);
    expect(hero.flightActive).toBe(false);

    step(controller, mkInput({ jumpPressed: true, jumpDown: true, forward: true }));
    expect(hero.state).toBe(LocomotionState.TAKEOFF);
    expect(hero.flightActive).toBe(true);
    expect(hero.capeFlare).toBe(true);
    expect(hero.velocity.y).toBeCloseTo(TUNING.TAKEOFF_CLIMB_SPEED, 9);
  });

  it('does not take off on the down-edge while already airborne', () => {
    const { hero, controller } = makeRig({ y: 20 });
    hero.onGround = false;
    step(controller, mkInput({ jumpPressed: true, jumpDown: true }));
    expect(hero.state).toBe(LocomotionState.GROUNDED); // falling, not flying
  });

  it('reaches `flying` after exactly TAKEOFF_STEPS (12) fixed steps', () => {
    const { hero, controller } = makeRig();
    const held = mkInput({ jumpDown: true, forward: true });

    controller.update(DT, mkInput({ jumpPressed: true, jumpDown: true, forward: true }), 0);
    // Steps 2..11 remain in takeoff.
    for (let i = 2; i <= 11; i++) {
      step(controller, held);
      expect(hero.state).toBe(LocomotionState.TAKEOFF);
    }
    // The 12th step completes the scripted climb.
    step(controller, held);
    expect(hero.state).toBe(LocomotionState.FLYING);
    expect(hero.capeFlare).toBe(false);
    expect(hero.flightActive).toBe(true);
  });

  it('climbs at exactly TAKEOFF_CLIMB_SPEED for the whole takeoff', () => {
    const { hero, controller } = makeRig();
    controller.update(DT, mkInput({ jumpPressed: true, jumpDown: true }), 0);
    const expected = TUNING.TAKEOFF_CLIMB_SPEED * TUNING.TAKEOFF_STEPS * DT;
    step(controller, mkInput({ jumpDown: true }), 11);
    expect(hero.position.y).toBeCloseTo(expected, 6);
  });

  it('B2: a tap of W gains 2.5-3 m of altitude and holds it', () => {
    // The whole of bug B2. Note that the scripted climb is only PART of the
    // gain: on entering `flying` with W already released, the hover half-life
    // bleeds the residual climb speed off over ~0.4 s, and because gravity is
    // never applied in flight, every metre of that coast is kept. Measuring only
    // TAKEOFF_CLIMB_SPEED × TAKEOFF_STEPS × dt (1.92 m here) understates the
    // apex by about 40% and is what made the original 4.8 look adequate on
    // paper. Assert the SETTLED altitude, which is what a player experiences.
    const { hero, controller } = makeRig();
    controller.update(DT, mkInput({ jumpPressed: true, jumpDown: true }), 0);
    step(controller, mkInput(), 180); // released immediately: a tap, not a climb

    expect(hero.position.y).toBeGreaterThan(2.5);
    expect(hero.position.y).toBeLessThan(3.0);
    expect(hero.state).toBe(LocomotionState.FLYING);
    // Hover HOLDS the apex. A tap that drifts back down would read as a hop.
    expect(hero.velocity.y).toBe(0);
  });

  it('B2: the burst still lands inside the camera cross-fade window', () => {
    // Criteria 14 and 24 passed human QA against a 0.2 s takeoff feeding a 0.6 s
    // camera cross-fade. TAKEOFF_STEPS was deliberately not touched, but the
    // taller climb must also not leave the hero still rising after the blend has
    // finished — that is what would turn a "burst" into a "drift".
    const { hero, controller } = makeRig();
    controller.update(DT, mkInput({ jumpPressed: true, jumpDown: true }), 0);
    step(controller, mkInput(), Math.round(TUNING.CAM_BLEND_TIME * 60) - 1);
    const atBlendEnd = hero.position.y;
    step(controller, mkInput(), 180);

    expect(atBlendEnd).toBeGreaterThan(hero.position.y * 0.95);
  });

  it('keeps horizontal control active during takeoff (not a canned animation)', () => {
    const { hero, controller } = makeRig();
    controller.update(DT, mkInput({ jumpPressed: true, jumpDown: true, right: true }), 0);
    step(controller, mkInput({ jumpDown: true, right: true }), 8);
    // Camera yaw 0 → "right" is +X.
    expect(hero.velocity.x).toBeGreaterThan(1);
    expect(hero.position.x).toBeGreaterThan(0);
  });
});

describe('FSM: flying ↔ landing ↔ grounded', () => {
  it('criterion 18: G begins landing, and ground contact returns to grounded', () => {
    const { hero, controller } = makeRig();
    forceFlying(hero, 30);

    step(controller, mkInput({ landPressed: true }));
    expect(hero.state).toBe(LocomotionState.LANDING);
    expect(hero.landing).toBe(true);
    expect(hero.flightActive).toBe(true);

    // Descend until touchdown: 30 m at a 6.8 m/s cap is well under 10 s.
    let steps = 0;
    while (hero.state !== LocomotionState.GROUNDED && steps < 60 * 15) {
      step(controller, mkInput());
      steps++;
    }
    expect(hero.state).toBe(LocomotionState.GROUNDED);
    expect(hero.onGround).toBe(true);
    expect(hero.landing).toBe(false);
    expect(hero.flightActive).toBe(false);
    expect(hero.position.y).toBe(0);
    expect(hero.velocity.y).toBe(0);
  });

  it('landing descent is capped at LANDING_MAX_DOWN_SPEED, not FLIGHT_DOWN', () => {
    const { hero, controller } = makeRig();
    forceFlying(hero, 200);
    step(controller, mkInput({ landPressed: true }));
    step(controller, mkInput(), 120);
    expect(hero.velocity.y).toBeCloseTo(-TUNING.LANDING_MAX_DOWN_SPEED, 9);
  });

  it('criterion 19: holding W during landing aborts back to flying before contact', () => {
    const { hero, controller } = makeRig();
    forceFlying(hero, 40);
    step(controller, mkInput({ landPressed: true }));
    expect(hero.state).toBe(LocomotionState.LANDING);

    step(controller, mkInput(), 30); // fall a while, still well above ground
    expect(hero.state).toBe(LocomotionState.LANDING);
    expect(hero.position.y).toBeGreaterThan(5);

    // Level-triggered: W HELD, not the press edge.
    step(controller, mkInput({ jumpDown: true, forward: true }));
    expect(hero.state).toBe(LocomotionState.FLYING);
    expect(hero.landing).toBe(false);
    expect(hero.position.y).toBeGreaterThan(0);
  });

  it('flying returns to grounded on incidental ground contact, skipping landing', () => {
    const { hero, controller } = makeRig();
    forceFlying(hero, 0.4);
    step(controller, mkInput({ descend: true }), 20);
    expect(hero.state).toBe(LocomotionState.GROUNDED);
    expect(hero.position.y).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Flight vertical behaviour
// ---------------------------------------------------------------------------

describe('flight vertical', () => {
  it('criterion 15: holding W climbs, capped at MAX_FLIGHT_UP_SPEED', () => {
    const { hero, controller } = makeRig();
    forceFlying(hero, 100);
    step(controller, mkInput({ jumpDown: true, forward: true }), 120);
    expect(hero.velocity.y).toBeCloseTo(TUNING.MAX_FLIGHT_UP_SPEED, 9);
    expect(hero.position.y).toBeGreaterThan(100);
  });

  it('criterion 15: holding S descends, capped at MAX_FLIGHT_DOWN_SPEED', () => {
    const { hero, controller } = makeRig();
    forceFlying(hero, 200);
    step(controller, mkInput({ descend: true, back: true }), 120);
    expect(hero.velocity.y).toBeCloseTo(-TUNING.MAX_FLIGHT_DOWN_SPEED, 9);
    expect(hero.position.y).toBeLessThan(200);
  });

  it('criterion 16: hover zeroes vertical velocity within 30 steps and keeps it there', () => {
    const { hero, controller } = makeRig();
    forceFlying(hero, 80);
    hero.velocity.y = TUNING.TAKEOFF_CLIMB_SPEED; // as if just out of takeoff

    let zeroedAt = -1;
    for (let i = 0; i < 30; i++) {
      step(controller, mkInput());
      if (zeroedAt < 0 && hero.velocity.y === 0) zeroedAt = i;
    }
    expect(zeroedAt).toBeGreaterThanOrEqual(0);

    for (let i = 0; i < 60; i++) {
      step(controller, mkInput());
      expect(hero.velocity.y).toBe(0);
    }
  });

  it('criterion 16: altitude drift is < 0.05 m over 3 simulated seconds of hover', () => {
    const { hero, controller } = makeRig();
    forceFlying(hero, 80);
    hero.velocity.y = TUNING.TAKEOFF_CLIMB_SPEED;

    step(controller, mkInput(), 60); // let the damping settle
    const settled = hero.position.y;
    step(controller, mkInput(), 180); // 3 seconds
    expect(Math.abs(hero.position.y - settled)).toBeLessThan(0.05);
  });

  it('criterion 16: GRAVITY is never applied while flightActive', () => {
    // Verified against the code path, not just the observed result: crank
    // gravity to an absurd value. If any flight branch touched it, altitude
    // would collapse instantly.
    const { hero, controller } = makeRig();
    TUNING.GRAVITY = 100000;

    forceFlying(hero, 90);
    step(controller, mkInput(), 180);
    expect(hero.flightActive).toBe(true);
    expect(hero.velocity.y).toBe(0);
    expect(hero.position.y).toBeCloseTo(90, 9);

    // Takeoff is likewise immune.
    const rig2 = makeRig();
    rig2.controller.update(DT, mkInput({ jumpPressed: true, jumpDown: true }), 0);
    step(rig2.controller, mkInput({ jumpDown: true }), 10);
    expect(rig2.hero.velocity.y).toBeCloseTo(TUNING.TAKEOFF_CLIMB_SPEED, 9);

    // And landing descends at its own scripted cap, not at gravity's mercy.
    const rig3 = makeRig();
    forceFlying(rig3.hero, 300);
    step(rig3.controller, mkInput({ landPressed: true }));
    step(rig3.controller, mkInput(), 120);
    expect(rig3.hero.velocity.y).toBeCloseTo(-TUNING.LANDING_MAX_DOWN_SPEED, 9);
  });

  it('applies GRAVITY only in `grounded` while off the ground', () => {
    const { hero, controller } = makeRig({ y: 50 });
    hero.onGround = false;
    step(controller, mkInput(), 30);
    expect(hero.state).toBe(LocomotionState.GROUNDED);
    expect(hero.flightActive).toBe(false);
    // 0.5 s of free fall at 23.8 m/s².
    expect(hero.velocity.y).toBeCloseTo(-TUNING.GRAVITY * 30 * DT, 6);
  });
});

// ---------------------------------------------------------------------------
// Speed caps: Shift and fine mode
// ---------------------------------------------------------------------------

describe('horizontalSpeedCap (pure)', () => {
  it('criterion 10: Shift on the ground raises the cap to DASH_SPEED', () => {
    const grounded = { state: LocomotionState.GROUNDED, dash: false, fine: false };
    expect(horizontalSpeedCap(grounded)).toBe(TUNING.MAX_SPEED);
    expect(horizontalSpeedCap({ ...grounded, dash: true })).toBe(TUNING.DASH_SPEED);
  });

  it('criterion 17: Shift in flight raises the cap to FLIGHT_DASH_SPEED', () => {
    const flying = { state: LocomotionState.FLYING, dash: false, fine: false };
    expect(horizontalSpeedCap(flying)).toBe(TUNING.MAX_SPEED);
    expect(horizontalSpeedCap({ ...flying, dash: true })).toBe(TUNING.FLIGHT_DASH_SPEED);
  });

  it('criterion 21: fine mode multiplies the flight cap by FLIGHT_FINE_MULT', () => {
    expect(
      horizontalSpeedCap({ state: LocomotionState.FLYING, dash: true, fine: true }),
    ).toBeCloseTo(TUNING.FLIGHT_DASH_SPEED * TUNING.FLIGHT_FINE_MULT, 9);
    expect(
      horizontalSpeedCap({ state: LocomotionState.FLYING, dash: false, fine: true }),
    ).toBeCloseTo(TUNING.MAX_SPEED * TUNING.FLIGHT_FINE_MULT, 9);
  });
});

describe('dash and fine mode in simulation', () => {
  it('criterion 10: ground dash actually reaches DASH_SPEED, and releasing decays back', () => {
    const { hero, controller } = makeRig();
    step(controller, mkInput({ forward: true, dash: true }), 120);
    const dashSpeed = Math.hypot(hero.velocity.x, hero.velocity.z);
    expect(dashSpeed).toBeCloseTo(TUNING.DASH_SPEED, 4);

    // Shift is a cap raise, not an impulse: releasing it decelerates via the
    // same MOVE_ACCEL curve back down to MAX_SPEED.
    step(controller, mkInput({ forward: true }), 120);
    expect(Math.hypot(hero.velocity.x, hero.velocity.z)).toBeCloseTo(TUNING.MAX_SPEED, 4);
  });

  it('criterion 17: flight dash raises horizontal speed with y unchanged (±0.01 m)', () => {
    const { hero, controller } = makeRig();
    forceFlying(hero, 60);
    const y0 = hero.position.y;

    step(controller, mkInput({ forward: true, dash: true }), 60);

    const speed = Math.hypot(hero.velocity.x, hero.velocity.z);
    expect(speed).toBeGreaterThan(TUNING.DASH_SPEED);
    expect(speed).toBeLessThanOrEqual(TUNING.FLIGHT_DASH_SPEED + 1e-9);
    expect(Math.abs(hero.position.y - y0)).toBeLessThanOrEqual(0.01);
    expect(hero.velocity.y).toBe(0);
  });

  it('criterion 21: fine mode slows both vertical thrust and horizontal speed', () => {
    const { hero, controller } = makeRig();
    forceFlying(hero, 60);
    step(controller, mkInput({ jumpDown: true, forward: true, dash: true, fine: true }), 180);

    expect(hero.velocity.y).toBeCloseTo(TUNING.MAX_FLIGHT_UP_SPEED * TUNING.FLIGHT_FINE_MULT, 6);
    expect(Math.hypot(hero.velocity.x, hero.velocity.z)).toBeCloseTo(
      TUNING.FLIGHT_DASH_SPEED * TUNING.FLIGHT_FINE_MULT,
      4,
    );
  });

  it('criterion 21: fine mode eases an over-cap climb back down rather than sticking', () => {
    const { hero, controller } = makeRig();
    forceFlying(hero, 60);
    step(controller, mkInput({ jumpDown: true }), 120); // full 7.5 m/s climb
    expect(hero.velocity.y).toBeCloseTo(TUNING.MAX_FLIGHT_UP_SPEED, 6);

    step(controller, mkInput({ jumpDown: true, fine: true }), 60);
    expect(hero.velocity.y).toBeCloseTo(TUNING.MAX_FLIGHT_UP_SPEED * TUNING.FLIGHT_FINE_MULT, 6);
  });
});

// ---------------------------------------------------------------------------
// Framerate independence — criteria 4 and 25
// ---------------------------------------------------------------------------

describe('framerate independence', () => {
  it('criterion 4: friction damping matches at 60 Hz and 120 Hz over 1 simulated second', () => {
    const a = makeRig();
    const b = makeRig();
    a.hero.velocity.set(6, 0, 0);
    b.hero.velocity.set(6, 0, 0);

    step(a.controller, mkInput(), 60, 1 / 60);
    step(b.controller, mkInput(), 120, 1 / 120);

    expect(Math.abs(a.hero.velocity.x - b.hero.velocity.x)).toBeLessThan(1e-3);
  });

  it('criterion 4: air friction in flight matches at 60 Hz and 120 Hz', () => {
    const a = makeRig();
    const b = makeRig();
    forceFlying(a.hero, 100);
    forceFlying(b.hero, 100);
    a.hero.velocity.set(15, 0, 0);
    b.hero.velocity.set(15, 0, 0);

    step(a.controller, mkInput(), 60, 1 / 60);
    step(b.controller, mkInput(), 120, 1 / 120);

    expect(Math.abs(a.hero.velocity.x - b.hero.velocity.x)).toBeLessThan(1e-3);
  });

  it('criterion 4: hover damping matches at 60 Hz and 120 Hz', () => {
    // Compared before the snap threshold fires, so the decay curve itself — not
    // the snap — is what is being checked.
    const v0 = 5;
    const total = 0.05;
    let a = v0;
    for (let i = 0; i < 3; i++) a *= hoverDampingFactor(TUNING.hoverDampingHalfLife, total / 3);
    let b = v0;
    for (let i = 0; i < 6; i++) b *= hoverDampingFactor(TUNING.hoverDampingHalfLife, total / 6);
    expect(Math.abs(a - b)).toBeLessThan(1e-9);
  });

  it('friction and hover factors are exact exponential decays', () => {
    expect(frictionFactor(0.82, 1 / 60)).toBeCloseTo(0.82, 12);
    expect(frictionFactor(0.82, 1)).toBeCloseTo(Math.pow(0.82, 60), 12);
    expect(hoverDampingFactor(0.065, 0.065)).toBeCloseTo(0.5, 12);
  });

  it('the degenerate FLIGHT_HOVER_DAMPING^60 conversion is NOT used anywhere', () => {
    // Guard test for the brief's single most likely subtle bug: "simplifying"
    // hover damping back onto the generic factor^60 conversion.
    const halfLife = hoverDampingFactor(TUNING.hoverDampingHalfLife, DT);
    const degenerate = Math.pow(Math.pow(0.18, 60), DT); // v *= (0.18^60)^dt

    // The shipped decay is gentle enough to be tunable: ~16% of vertical speed
    // bled off per step, so hover settles over ~20 steps rather than ~3.
    expect(halfLife).toBeGreaterThan(0.5);
    expect(halfLife).toBeLessThan(0.95);
    // The ^60 form is roughly 5× more aggressive per step at 60 Hz, and far
    // worse at any lower step rate.
    expect(degenerate).toBeLessThan(0.25);
    expect(halfLife / degenerate).toBeGreaterThan(3);

    // The real objection is that ^60 leaves NO USABLE TUNING RANGE. Nudging the
    // per-frame constant from 0.18 to 0.20 — a change a designer would call
    // imperceptible — moves the per-second rate by more than two orders of
    // magnitude.
    expect(Math.pow(0.2, 60) / Math.pow(0.18, 60)).toBeGreaterThan(100);

    // The half-life formulation, by contrast, is smooth across its whole
    // 0.05–0.08 s slider range: the per-step factor moves only a few percent.
    const atMin = hoverDampingFactor(0.05, DT);
    const atMax = hoverDampingFactor(0.08, DT);
    expect(atMax - atMin).toBeGreaterThan(0);
    expect(atMax - atMin).toBeLessThan(0.15);
  });

  it('criterion 25: camera exponential smoothing is framerate-independent', () => {
    const lambda = TUNING.CAMERA_LAMBDA;
    let a = 0;
    for (let i = 0; i < 60; i++) a = damp(a, 1, lambda, 1 / 60);
    let b = 0;
    for (let i = 0; i < 240; i++) b = damp(b, 1, lambda, 1 / 240);

    expect(Math.abs(a - b)).toBeLessThan(1e-9);
    // And it matches the closed-form solution of the underlying ODE.
    expect(a).toBeCloseTo(1 - Math.exp(-lambda), 9);
  });

  it('criterion 25: lambda 6.32 reproduces the 2D camera 0.1-per-frame lerp at 60 fps', () => {
    expect(smoothingWeight(TUNING.CAMERA_LAMBDA, 1 / 60)).toBeCloseTo(0.1, 4);
    expect(-60 * Math.log(1 - 0.1)).toBeCloseTo(TUNING.CAMERA_LAMBDA, 2);
  });
});

// ---------------------------------------------------------------------------
// Orientation and integration with collision
// ---------------------------------------------------------------------------

describe('orientation', () => {
  it('criterion 9: yaw turns toward the movement direction at a limited rate', () => {
    const { hero, controller } = makeRig();
    hero.facing = 0; // facing -Z
    // Camera yaw 0, input "right" → desired direction +X → target yaw -PI/2.
    step(controller, mkInput({ right: true }));
    expect(hero.facing).not.toBe(0);
    // One step at 12 rad/s can turn at most 0.2 rad — nowhere near the 1.57 rad
    // target. This is what proves it is not a snap.
    expect(Math.abs(hero.facing)).toBeLessThanOrEqual(TUNING.YAW_SLERP_RATE * DT + 1e-9);

    step(controller, mkInput({ right: true }), 60);
    expect(hero.facing).toBeCloseTo(-Math.PI / 2, 4);
  });

  it('holds yaw when there is no directional input', () => {
    const { hero, controller } = makeRig();
    hero.facing = 1.234;
    step(controller, mkInput(), 30);
    expect(hero.facing).toBe(1.234);
  });

  it('body pitch is visual only and stays within its clamps', () => {
    const { hero, controller } = makeRig();
    forceFlying(hero, 100);
    step(controller, mkInput({ jumpDown: true }), 120);
    expect(hero.pitch).toBeGreaterThanOrEqual(TUNING.MIN_FORWARD_PITCH);
    expect(hero.pitch).toBeLessThanOrEqual(TUNING.MAX_FORWARD_PITCH);
    expect(hero.pitch).toBeCloseTo(TUNING.MIN_FORWARD_PITCH, 9); // clamped while climbing
  });
});

// ---------------------------------------------------------------------------
// Hero visual orientation — bugs B1 (cape) and B4 (body pitch)
//
// These drive the REAL Hero mesh, not a stand-in. Hero.js only ever touches
// CPU-side Three.js (Group, geometries, materials, matrices) — no renderer, no
// canvas, no DOM — so it runs unchanged under `environment: 'node'`, and the
// assertions below therefore cover the whole transform chain: controller state
// -> syncTransform -> group yaw -> bodyPivot pitch -> capeAnchor lift.
//
// They live here rather than in a third test file for the same reason the
// camera smoothing assertion does: Phase 1's file tree allows exactly two.
//
// WHY ASSERT DOT PRODUCTS AND NOT RAW ROTATION SIGNS. Both bugs were sign errors
// that a comment asserting the wrong sign made invisible. A test that reasserted
// `rotation.x > 0` would have been written from the same wrong model and would
// have locked the bug in. Asking "is the cape hem BEHIND the hero's facing
// direction" through the real matrices cannot be satisfied by a bug.
// ---------------------------------------------------------------------------

describe('Hero visual orientation — B1 cape, B4 body pitch', () => {
  /** Build the real Hero mesh with a real controller driving its state object. */
  function makeHero({ facing = 0.9 } = {}) {
    const scene = new THREE.Scene();
    const hero3d = new Hero({ scene, position: new THREE.Vector3(0, 0, 0) });
    const collision = new CollisionWorld({ halfExtent: 150 });
    const controller = new LocomotionController({ hero: hero3d.state, collision });
    hero3d.state.facing = facing;
    return { hero3d, controller, state: hero3d.state };
  }

  /** Advance simulation and visuals together, exactly as Game.js does. */
  function stepHero(hero3d, controller, input, n) {
    for (let i = 0; i < n; i++) {
      controller.update(DT, input, 0);
      hero3d.syncTransform();
      hero3d.update(DT);
    }
    hero3d.group.updateMatrixWorld(true);
  }

  /** A local axis of `object`, expressed in world space as a unit direction. */
  function worldAxis(object, x, y, z) {
    const q = object.getWorldQuaternion(new THREE.Quaternion());
    return new THREE.Vector3(x, y, z).applyQuaternion(q).normalize();
  }

  /** The hero's own forward direction in world space. */
  function forwardOf(state) {
    return new THREE.Vector3().copy(yawForward(state.facing, { x: 0, y: 0, z: 0 }));
  }

  it('B1: the cape hem trails BEHIND the hero at a full ground dash', () => {
    const { hero3d, controller, state } = makeHero();
    stepHero(hero3d, controller, mkInput({ forward: true, dash: true }), 150);

    // The hem hangs at local -Y from the anchor; lift swings it about X.
    const hem = worldAxis(hero3d.capeAnchor, 0, -1, 0);
    const forward = forwardOf(state);

    // Negative dot = the hem points opposite to travel, i.e. it trails. The
    // shipped bug produced roughly +0.84 here.
    expect(hem.dot(forward)).toBeLessThan(-0.7);
    expect(hero3d.capeAnchor.rotation.x).toBeLessThan(0);
  });

  it('B1: the cape hem trails BEHIND the hero in dashing flight', () => {
    const { hero3d, controller, state } = makeHero();
    // Take off, then dash forward without climbing.
    controller.update(DT, mkInput({ jumpPressed: true, jumpDown: true }), 0);
    stepHero(hero3d, controller, mkInput({ forward: true, dash: true }), 240);

    expect(state.flightActive).toBe(true);
    const hem = worldAxis(hero3d.capeAnchor, 0, -1, 0);
    expect(hem.dot(forwardOf(state))).toBeLessThan(-0.8);
  });

  it('B1: a standing hero has a cape that hangs down, not out', () => {
    // Guard against "fixed" by simply reversing a constant: at zero speed the
    // lift is zero and the cape must still hang under gravity, both before and
    // after the sign fix.
    const { hero3d, controller } = makeHero();
    stepHero(hero3d, controller, mkInput(), 120);
    const hem = worldAxis(hero3d.capeAnchor, 0, -1, 0);
    expect(hem.y).toBeLessThan(-0.99);
  });

  it('B4: the hero dives HEAD-FIRST, not feet-first', () => {
    const { hero3d, controller, state } = makeHero();
    forceFlying(state, 100);
    // No directional input, so yaw holds at 0.9 — which is the point: a non-zero
    // facing proves the group's yaw is not what makes the sign come out right.
    stepHero(hero3d, controller, mkInput({ descend: true }), 120);

    expect(state.velocity.y).toBeLessThan(-5); // genuinely diving
    expect(state.pitch).toBeGreaterThan(0.5); // positive pitch == nose down

    // The head axis must lean INTO the direction of travel.
    const head = worldAxis(hero3d.bodyPivot, 0, 1, 0);
    const forward = forwardOf(state);
    expect(head.dot(forward)).toBeGreaterThan(0.5);
    // ...and the head must still be the high end of the body. A 90° over-rotation
    // would satisfy the dot test alone.
    expect(head.y).toBeGreaterThan(0.5);
  });

  it('B4: the hero climbs NOSE-UP', () => {
    const { hero3d, controller, state } = makeHero();
    forceFlying(state, 100);
    stepHero(hero3d, controller, mkInput({ jumpDown: true }), 120);

    expect(state.velocity.y).toBeGreaterThan(5);
    expect(state.pitch).toBeCloseTo(TUNING.MIN_FORWARD_PITCH, 9); // clamped, negative

    const head = worldAxis(hero3d.bodyPivot, 0, 1, 0);
    expect(head.dot(forwardOf(state))).toBeLessThan(-0.3);
    expect(head.y).toBeGreaterThan(0.5);
  });

  it('B4: a motionless hover leaves the hero upright', () => {
    const { hero3d, controller, state } = makeHero();
    forceFlying(state, 100);
    stepHero(hero3d, controller, mkInput(), 120);

    // toBeCloseTo, not toBe: hover zeroes velocity.y exactly, and `-velocity.y`
    // then yields the signed zero -0, which `toBe(0)` rejects.
    expect(state.pitch).toBeCloseTo(0, 12);
    const head = worldAxis(hero3d.bodyPivot, 0, 1, 0);
    expect(head.y).toBeGreaterThan(0.999);
  });

  // The two-term pitch model. Horizontal speed drives the lean; the vertical
  // term fades out as it rises. See `_updateOrientation` for the full rationale.
  // This is the defect a human reported as "the character is leaning back and
  // does not lean forward in the direction of travel."

  it('level flight AT SPEED leans forward — it is not upright', () => {
    const { hero3d, controller, state } = makeHero();
    forceFlying(state, 100);
    state.velocity.set(0, 0, -TUNING.MAX_SPEED); // travelling, not hovering
    controller._updateOrientation(1 / 60, mkInput());
    hero3d.syncTransform();

    // Leaning appreciably forward, and NOT the zero the old model produced.
    expect(state.pitch).toBeGreaterThan(0.7);
    // The head has tipped toward travel rather than staying straight up.
    const head = worldAxis(hero3d.bodyPivot, 0, 1, 0);
    expect(head.y).toBeLessThan(0.7);
    expect(head.z).toBeLessThan(0); // -Z is the facing/travel direction
  });

  it('a level dash reaches the full horizontal pose', () => {
    const { state, controller } = makeHero();
    forceFlying(state, 100);
    state.velocity.set(0, 0, -TUNING.FLIGHT_DASH_SPEED);
    controller._updateOrientation(1 / 60, mkInput());

    expect(state.pitch).toBeCloseTo(TUNING.MAX_FORWARD_PITCH, 6);
  });

  it('climbing STRAIGHT up still tips nose-up, since the vertical term rules there', () => {
    const { state, controller } = makeHero();
    forceFlying(state, 100);
    state.velocity.set(0, TUNING.MAX_FLIGHT_UP_SPEED, 0); // no horizontal speed
    controller._updateOrientation(1 / 60, mkInput());

    expect(state.pitch).toBeLessThan(0);
  });

  it('diving WHILE travelling forward is steeper than diving alone', () => {
    const dive = (vx, vz) => {
      const { state, controller } = makeHero();
      forceFlying(state, 100);
      state.velocity.set(vx, -TUNING.MAX_FLIGHT_DOWN_SPEED, vz);
      controller._updateOrientation(1 / 60, mkInput());
      return state.pitch;
    };

    // A vertical drop tips less than a dive carrying real forward speed, which
    // is the "the angle could use a bit more work" feedback from the browser.
    expect(dive(0, -TUNING.MAX_SPEED)).toBeGreaterThan(dive(0, 0));
  });
});

describe('movement basis', () => {
  it('is camera-relative: the same input moves a different way under a rotated camera', () => {
    const a = makeRig();
    step(a.controller, mkInput({ forward: true }), 30, DT, 0);
    // Camera yaw 0 → forward is -Z.
    expect(a.hero.position.z).toBeLessThan(-0.5);
    expect(Math.abs(a.hero.position.x)).toBeLessThan(1e-6);

    const b = makeRig();
    step(b.controller, mkInput({ forward: true }), 30, DT, Math.PI / 2);
    // Camera yaw +90° → forward is -X.
    expect(b.hero.position.x).toBeLessThan(-0.5);
    expect(Math.abs(b.hero.position.z)).toBeLessThan(1e-6);
  });

  it('does not let diagonal input exceed the speed cap', () => {
    const { hero, controller } = makeRig();
    step(controller, mkInput({ forward: true, right: true }), 120);
    expect(Math.hypot(hero.velocity.x, hero.velocity.z)).toBeLessThanOrEqual(
      TUNING.MAX_SPEED + 1e-6,
    );
  });
});

// ---------------------------------------------------------------------------
// Input hygiene — criterion 27's key-state half
// ---------------------------------------------------------------------------

describe('input state after a window blur', () => {
  // Criterion 27 is tagged [HEADLESS], but the stuck-key bug it guards against
  // is a LOCOMOTION failure (alt-tab while holding W and the hero flies upward
  // forever on return), and Input.js runs headlessly with no DOM when given a
  // null event target. Verifying the key-state half here is cheap; the
  // "no velocity spike on refocus" half still needs a browser.
  it('clears every held key and pending delta on blur, and the hero stops climbing', () => {
    const input = new Input({ element: null, target: null });
    const ev = (code) => ({ code, repeat: false, preventDefault() {} });

    input._onKeyDown(ev('KeyW'));
    input._onKeyDown(ev('ShiftLeft'));
    input.look.dx = 250;
    input.wheel = 3;
    input.beginStep();
    expect(input.jumpDown).toBe(true);
    expect(input.dash).toBe(true);

    // The browser delivers keydown but never keyup across an alt-tab.
    input._onBlur();

    expect(input.jumpDown).toBe(false);
    expect(input.dash).toBe(false);
    expect(input.jumpPressed).toBe(false);
    expect(input.forward).toBe(false);
    expect(input.look.dx).toBe(0);
    expect(input.wheel).toBe(0);
    for (const k of input.keys.values()) {
      expect(k.down).toBe(false);
      expect(k.pressed).toBe(false);
    }

    // And the FSM stops climbing once the cleared snapshot is fed to it.
    const { hero, controller } = makeRig();
    forceFlying(hero, 40);
    step(controller, mkInput({ jumpDown: true }), 30);
    expect(hero.velocity.y).toBeGreaterThan(0);
    step(controller, input, 60); // the post-blur snapshot: everything false
    expect(hero.velocity.y).toBe(0);
  });

  it('does not re-fire the press edge on browser key auto-repeat', () => {
    const input = new Input({ element: null, target: null });
    input._onKeyDown({ code: 'KeyW', repeat: false, preventDefault() {} });
    input.beginStep();
    expect(input.jumpPressed).toBe(true);

    input.endStep();
    input._onKeyDown({ code: 'KeyW', repeat: true, preventDefault() {} });
    input.beginStep();
    // Still held, but the takeoff edge must not fire again.
    expect(input.jumpDown).toBe(true);
    expect(input.jumpPressed).toBe(false);
  });
});

describe('controller + collision integration', () => {
  it('criterion 11: cannot walk through a building', () => {
    const collision = new CollisionWorld({ halfExtent: 150 });
    collision.addBuilding(new THREE.Box3(new THREE.Vector3(-5, 0, -20), new THREE.Vector3(5, 25, -10)));
    const hero = createHeroState({ position: new THREE.Vector3(0, 0, 0) });
    const controller = new LocomotionController({ hero, collision });

    step(controller, mkInput({ forward: true, dash: true }), 300);
    // Camera yaw 0 → walking toward -Z, straight into the building's +Z face.
    expect(hero.position.z).toBeGreaterThanOrEqual(-10 + 0.35 - 1e-6);
  });

  it('criterion 20 proxy: can fly above a tower and land on its roof', () => {
    const collision = new CollisionWorld({ halfExtent: 150 });
    collision.addBuilding(new THREE.Box3(new THREE.Vector3(-8, 0, -8), new THREE.Vector3(8, 90, 8)));
    const hero = createHeroState({ position: new THREE.Vector3(0, 0, 40) });
    const controller = new LocomotionController({ hero, collision });

    // Take off, climb past 90 m.
    controller.update(DT, mkInput({ jumpPressed: true, jumpDown: true }), 0);
    let guard = 0;
    while (hero.position.y < 95 && guard++ < 60 * 60) {
      step(controller, mkInput({ jumpDown: true }));
    }
    expect(hero.position.y).toBeGreaterThan(90);

    // Fly over the tower (camera yaw 0 → forward is -Z), then land.
    guard = 0;
    while (hero.position.z > 0 && guard++ < 60 * 60) {
      step(controller, mkInput({ forward: true, jumpDown: true }));
    }
    step(controller, mkInput({ landPressed: true }));
    guard = 0;
    while (hero.state !== LocomotionState.GROUNDED && guard++ < 60 * 60) {
      step(controller, mkInput());
    }

    expect(hero.onGround).toBe(true);
    expect(hero.position.y).toBe(90); // the rooftop, not the ground plane
  });
});

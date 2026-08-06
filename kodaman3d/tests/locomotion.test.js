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

  // ---------------------------------------------------------------------
  // Cape/torso interpenetration.
  //
  // The B1 tests above all ask about DIRECTION, and every one of them passed
  // while the cape was buried in the chest — because a cape can trail perfectly
  // backward and still be inside the body it trails from. A human found this by
  // looking at it. What follows is the clearance question the direction tests
  // never asked.
  //
  // Measured against the real capsule the torso is actually built from, so it
  // cannot be satisfied by tuning a number until an assertion goes green.
  // ---------------------------------------------------------------------

  /** Shortest distance from `p` to the segment `a`–`b`. All in world space. */
  function distanceToSegment(p, a, b) {
    const ab = new THREE.Vector3().subVectors(b, a);
    const t = THREE.MathUtils.clamp(
      new THREE.Vector3().subVectors(p, a).dot(ab) / ab.lengthSq(),
      0,
      1,
    );
    return p.distanceTo(new THREE.Vector3().copy(a).addScaledVector(ab, t));
  }

  /**
   * The smallest gap between the cape's centreline and the torso capsule's
   * surface, in metres. Negative means the cape is inside the torso.
   *
   * Samples down the cape rather than testing the hem alone: the hem is the part
   * FURTHEST from the anchor and so the part most likely to be clear. The bug
   * lived up near the shoulders.
   */
  function capeTorsoGap(hero3d) {
    hero3d.group.updateMatrixWorld(true);

    // TORSO_GEO: CapsuleGeometry(0.28, 0.6) — the cylinder's endpoints are half
    // the LENGTH (not half the total height) either side of centre.
    const TORSO_RADIUS = 0.28;
    const centre = hero3d.torso.getWorldPosition(new THREE.Vector3());
    const up = worldAxis(hero3d.bodyPivot, 0, 1, 0);
    const capA = new THREE.Vector3().copy(centre).addScaledVector(up, 0.3);
    const capB = new THREE.Vector3().copy(centre).addScaledVector(up, -0.3);

    // The cape hangs 1.1 m along the anchor's local -Y.
    const anchor = hero3d.capeAnchor.getWorldPosition(new THREE.Vector3());
    const down = worldAxis(hero3d.capeAnchor, 0, -1, 0);

    let min = Infinity;
    for (let i = 0; i <= 20; i++) {
      const p = new THREE.Vector3().copy(anchor).addScaledVector(down, (i / 20) * 1.1);
      min = Math.min(min, distanceToSegment(p, capA, capB) - TORSO_RADIUS);
    }
    return min;
  }

  it('the cape does not intersect the torso at a full dash-flight', () => {
    const { hero3d, controller, state } = makeHero();
    controller.update(DT, mkInput({ jumpPressed: true, jumpDown: true }), 0);
    stepHero(hero3d, controller, mkInput({ forward: true, dash: true }), 240);

    // Precondition: the body really is flat, which is the case that broke.
    expect(state.pitch).toBeGreaterThan(1.0);
    // The shipped build measured about -0.14 m here: cape inside torso.
    expect(capeTorsoGap(hero3d)).toBeGreaterThan(0.05);
  });

  it('the cape does not intersect the torso while standing', () => {
    // The anchor was buried in the capsule from the first frame, so this fails
    // on the shipped build too — at zero speed, with no lift involved at all.
    const { hero3d, controller } = makeHero();
    stepHero(hero3d, controller, mkInput(), 120);
    expect(capeTorsoGap(hero3d)).toBeGreaterThan(0.0);
  });

  it('standing keeps the cape near the back, not flared out behind', () => {
    // Guards the other direction: the standoff fades in with body pitch, so an
    // upright hero must NOT get the flying wedge. Without the fade this reads as
    // a hero standing in a permanent wind tunnel.
    const { hero3d, controller } = makeHero();
    stepHero(hero3d, controller, mkInput(), 120);
    expect(Math.abs(hero3d.capeAnchor.rotation.x)).toBeLessThan(0.05);
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
    // ...and must not have over-rotated PAST horizontal into a backflip, which
    // would satisfy the dot test on its own.
    //
    // The bound here is 0, not 0.5. It was 0.5 while PITCH_SPEED_DIVISOR was
    // 8.0, which capped a vertical dive at ~44° — and a human then reported the
    // dive "could still use a bit more lean downwards". At 5.0 the same dive
    // reaches ~70°, so the head is only just the high end of the body. That is
    // the requested steepness, not a regression; the assertion below is what
    // still catches a genuine over-rotation.
    expect(head.y).toBeGreaterThan(0);
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

    input._onKeyDown(ev('Space')); // the climb key — W no longer climbs
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
    input._onKeyDown({ code: 'Space', repeat: false, preventDefault() {} });
    input.beginStep();
    expect(input.jumpPressed).toBe(true);

    input.endStep();
    input._onKeyDown({ code: 'Space', repeat: true, preventDefault() {} });
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


/**
 * The W/S double-binding regression.
 *
 * `jumpDown` used to be `forward` and `descend` used to be `back`, which broke
 * three separate things at once and was reported from playtesting: holding W on
 * the ground took off, W in flight climbed instead of flying forward, and
 * dashing while descending reversed the hero. These pin the split so no future
 * "simplification" quietly re-aliases a movement key onto a vertical axis.
 */
describe('movement keys are never bound to the vertical axis', () => {
  const press = (input, ...codes) => {
    for (const code of codes) input._onKeyDown({ code, repeat: false, preventDefault() {} });
    input.beginStep();
    return input;
  };
  const fresh = () => new Input({ element: null, target: null });

  it('W moves forward and does NOT climb or take off', () => {
    const input = press(fresh(), 'KeyW');
    expect(input.forward).toBe(true);
    expect(input.jumpDown).toBe(false);
    expect(input.jumpPressed).toBe(false);
  });

  it('S moves backward and does NOT descend', () => {
    const input = press(fresh(), 'KeyS');
    expect(input.back).toBe(true);
    expect(input.descend).toBe(false);
  });

  it('Space climbs without driving any horizontal movement', () => {
    const input = press(fresh(), 'Space');
    expect(input.jumpDown).toBe(true);
    expect(input.jumpPressed).toBe(true);
    expect(input.forward).toBe(false);
  });

  it('X descends without driving any horizontal movement', () => {
    const input = press(fresh(), 'KeyX');
    expect(input.descend).toBe(true);
    expect(input.back).toBe(false);
  });

  it('Ctrl also descends, for players who expect the Saints Row IV convention', () => {
    expect(press(fresh(), 'ControlLeft').descend).toBe(true);
    expect(press(fresh(), 'ControlRight').descend).toBe(true);
  });

  it('lets a player dive FORWARD while dashing — the reported reversal bug', () => {
    // W + X + Shift: forward thrust, descending, dashing. The old mapping made
    // this drive BACKWARD, because X's job was done by S.
    const input = press(fresh(), 'KeyW', 'KeyX', 'ShiftLeft');
    expect(input.forward).toBe(true);
    expect(input.back).toBe(false);
    expect(input.descend).toBe(true);
    expect(input.dash).toBe(true);
  });

  it('lets a player climb while flying forward — two keys, not one overloaded one', () => {
    const input = press(fresh(), 'KeyW', 'Space');
    expect(input.forward).toBe(true);
    expect(input.jumpDown).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Velocity-derived bank (`RESEARCH_MANOFSTEEL_REPO.md` §2)
//
// WHY THE SIGN TESTS GO THROUGH THE REAL MATRICES, like the cape and pitch
// tests above. A bank is a third rotation axis composed with two existing ones,
// and asserting `roll > 0` would only restate whatever model wrote the code. The
// question a player actually asks is "does the hero lean INTO the turn", so the
// test asks that: it takes the hero's up axis in world space and checks it tips
// toward the hero's own left when turning left.
// ---------------------------------------------------------------------------

describe('flight bank — lean is computed from the velocity vector', () => {
  /**
   * Fly a constant-speed turn at a constant angular rate.
   *
   * The velocity is written directly each step rather than steered with input:
   * the thing under test is the mapping from a heading RATE to a bank, and
   * driving it with WASD would measure the acceleration curve as well.
   *
   * @param {number} rate rad/s the heading rotates; positive = turning LEFT.
   */
  function flyTurn(hero, controller, { rate, seconds = 1, speed = 20, dt = DT }) {
    let heading = 0;
    // PRIME THE HEADING with one step of straight flight first. The bank needs a
    // previous heading to difference against, so the very first step of any turn
    // banks by nothing — and that dead step is a fixed COUNT, not a fixed
    // DURATION, so it eats 1.7% of a 0.5 s window at 1/60 and 20% of the same
    // window at 1/10. Left in, it shows up as a framerate dependence that is
    // purely an artefact of starting the measurement from a standstill.
    hero.velocity.set(0, 0, -speed);
    controller.update(dt, mkInput(), 0);
    for (let i = 0; i < Math.round(seconds / dt); i++) {
      heading += rate * dt;
      hero.velocity.set(-Math.sin(heading) * speed, 0, -Math.cos(heading) * speed);
      controller.update(dt, mkInput(), 0);
    }
  }

  it('stays level in a straight line, however fast', () => {
    const { hero, controller } = makeRig();
    forceFlying(hero);
    flyTurn(hero, controller, { rate: 0, seconds: 2, speed: 30 });
    expect(Math.abs(hero.roll)).toBeLessThan(1e-6);
  });

  it('banks LEFT into a left turn and RIGHT into a right turn, symmetrically', () => {
    const left = makeRig();
    forceFlying(left.hero);
    flyTurn(left.hero, left.controller, { rate: 1.0 });

    const right = makeRig();
    forceFlying(right.hero);
    flyTurn(right.hero, right.controller, { rate: -1.0 });

    expect(left.hero.roll).toBeGreaterThan(0.1);
    expect(right.hero.roll).toBeLessThan(-0.1);
    expect(left.hero.roll).toBeCloseTo(-right.hero.roll, 6);
  });

  it('banks harder for a harder turn', () => {
    const gentle = makeRig();
    forceFlying(gentle.hero);
    flyTurn(gentle.hero, gentle.controller, { rate: 0.4 });

    const hard = makeRig();
    forceFlying(hard.hero);
    flyTurn(hard.hero, hard.controller, { rate: 2.0 });

    expect(hard.hero.roll).toBeGreaterThan(gentle.hero.roll * 1.5);
  });

  it('never exceeds MAX_BANK_ROLL, however violent the turn', () => {
    const { hero, controller } = makeRig();
    forceFlying(hero);
    // 20 rad/s is ~6x the rate that already saturates the bank.
    flyTurn(hero, controller, { rate: 20, seconds: 3 });
    expect(Math.abs(hero.roll)).toBeLessThanOrEqual(TUNING.MAX_BANK_ROLL + 1e-9);
  });

  it('returns to level when the turn stops', () => {
    const { hero, controller } = makeRig();
    forceFlying(hero);
    flyTurn(hero, controller, { rate: 1.5 });
    expect(Math.abs(hero.roll)).toBeGreaterThan(0.1);

    flyTurn(hero, controller, { rate: 0, seconds: 2 });
    expect(Math.abs(hero.roll)).toBeLessThan(0.01);
  });

  it('does not bank below BANK_MIN_SPEED — a drifting hover is not a turn', () => {
    const { hero, controller } = makeRig();
    forceFlying(hero);
    // A hover with a hair of drift whose heading swings wildly: the raw rate
    // here is enormous, and it must produce no bank at all.
    for (let i = 0; i < 60; i++) {
      const heading = i * 1.7; // radians, deliberately incoherent step to step
      hero.velocity.set(-Math.sin(heading) * 0.05, 0, -Math.cos(heading) * 0.05);
      controller.update(DT, mkInput(), 0);
    }
    expect(Math.abs(hero.roll)).toBeLessThan(1e-6);
  });

  it('does not carry a stale heading across a hover — no snap on resuming', () => {
    const { hero, controller } = makeRig();
    forceFlying(hero);
    // Fly north, stop dead, then fly SOUTH. Without forgetting the heading on
    // the hover, the first moving step computes a 180° turn in one step and
    // snaps to a full bank while the player has merely set off again.
    flyTurn(hero, controller, { rate: 0, seconds: 0.5, speed: 20 });
    for (let i = 0; i < 30; i++) {
      hero.velocity.set(0, 0, 0);
      controller.update(DT, mkInput(), 0);
    }
    hero.velocity.set(0, 0, 20); // reversed heading
    controller.update(DT, mkInput(), 0);
    expect(Math.abs(hero.roll)).toBeLessThan(1e-6);
  });

  it('stays level on the ground, whatever the hero is doing', () => {
    const { hero, controller } = makeRig();
    // Grounded, running a turn: bank is a FLIGHT pose. A banking runner is a
    // falling runner.
    flyTurn(hero, controller, { rate: 2.0, speed: 7 });
    expect(Math.abs(hero.roll)).toBeLessThan(1e-6);
  });

  it('reaches the same bank at the same WALL-CLOCK time, whatever the step size', () => {
    // MEASURED PART-WAY THROUGH THE RAMP, NOT AT THE SETTLED VALUE, and the
    // step sizes are deliberately far apart. Both choices are load-bearing:
    //
    //  - Every smoothing form converges to the same equilibrium, so a test that
    //    runs the turn to completion passes under `FInterpTo` too. Measured: it
    //    did. The transient is the only place the two forms differ at all.
    //  - At BANK_LAMBDA = 5, 60 Hz vs 144 Hz puts `lambda*dt` at 0.083 vs 0.035,
    //    where the dt-scaled lerp is within ~0.5% of the exponential — under any
    //    tolerance loose enough not to be flaky. The error grows with the step,
    //    so 1/60 vs 1/10 is what actually distinguishes them.
    //
    // 1/10 s is not a step the fixed loop ever runs (`Time` always hands out
    // 1/60). It is here as an instrument, the same way this file's other
    // framerate tests vary dt.
    const at = (dt) => {
      const r = makeRig();
      forceFlying(r.hero);
      flyTurn(r.hero, r.controller, { rate: 1.2, seconds: 0.5, dt });
      return r.hero.roll;
    };
    expect(at(1 / 60)).toBeCloseTo(at(1 / 10), 3);
    // And the ordinary display case still holds, which is the one players meet.
    expect(at(1 / 60)).toBeCloseTo(at(1 / 144), 3);
  });

  it('tips the hero INTO the turn on the scene graph, not just in the number', () => {
    const scene = new THREE.Scene();
    const hero3d = new Hero({ scene, position: new THREE.Vector3(0, 0, 0) });
    const collision = new CollisionWorld({ halfExtent: 150 });
    const controller = new LocomotionController({ hero: hero3d.state, collision });
    const state = hero3d.state;

    forceFlying(state);
    state.facing = 0; // facing -Z, so the hero's left is -X
    flyTurn(state, controller, { rate: 1.2, seconds: 1 });
    // Pitch is whatever the speed lean makes it; the bank must read correctly
    // composed WITH it, which is the whole reason it sits on a different node.
    hero3d.syncTransform();
    hero3d.group.updateMatrixWorld(true);

    const q = hero3d.group.getWorldQuaternion(new THREE.Quaternion());
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(q).normalize();
    // Turning LEFT: the head must lean toward the hero's left, which at
    // facing 0 is world -X.
    expect(up.x).toBeLessThan(-0.05);
  });
});

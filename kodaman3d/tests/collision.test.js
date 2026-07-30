import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import {
  CollisionWorld,
  createBoundaryBoxes,
  raycastBoxes,
  resolveCapsule,
} from '../src/world/Collision.js';
import { HERO_HEIGHT_M, HERO_RADIUS_M } from '../src/core/Scale.js';

/**
 * collision.test.js — acceptance criteria 4, 11, 12, 13.
 *
 * Everything here runs in `environment: 'node'`. Collision.js deliberately has
 * no scene-graph dependency, so these tests drive the real production code
 * path, not a simplified stand-in.
 */

const R = HERO_RADIUS_M; // 0.35
const H = HERO_HEIGHT_M; // 1.85

/** @param {number} x @param {number} y @param {number} z */
const p = (x, y, z) => new THREE.Vector3(x, y, z);

/** A single 10×10 m building, 30 m tall, centred on the origin. */
function tower(height = 30) {
  return new THREE.Box3(p(-5, 0, -5), p(5, height, 5));
}

describe('resolveCapsule — vertical / ground', () => {
  it('reports onGround for a capsule resting exactly on the ground plane', () => {
    const pos = p(0, 0, 0);
    const r = resolveCapsule(pos, R, H, []);
    expect(r.onGround).toBe(true);
    expect(pos.y).toBe(0);
  });

  it('reports airborne for a capsule above the ground plane', () => {
    const pos = p(0, 12, 0);
    const r = resolveCapsule(pos, R, H, [], { previousY: 12 });
    expect(r.onGround).toBe(false);
    expect(pos.y).toBe(12);
  });

  it('criterion 13: does not fall through the ground plane at any velocity', () => {
    // A single fixed step that displaces the capsule 150 m downward — far
    // beyond anything the tuning constants can produce — still resolves onto
    // the ground, because the ground test is swept between previousY and y.
    const pos = p(0, -50, 0);
    const r = resolveCapsule(pos, R, H, [], { previousY: 100 });
    expect(r.onGround).toBe(true);
    expect(pos.y).toBe(0);
  });

  it('criterion 13: repeated high-speed descent never leaves the capsule below y=0', () => {
    const pos = p(0, 200, 0);
    let velocity = 0;
    for (let i = 0; i < 600; i++) {
      const previousY = pos.y;
      velocity -= 500 * (1 / 60); // absurd acceleration, far past GRAVITY
      pos.y += velocity * (1 / 60);
      const r = resolveCapsule(pos, R, H, [], { previousY });
      if (r.onGround) velocity = 0;
      expect(pos.y).toBeGreaterThanOrEqual(0);
    }
    expect(pos.y).toBe(0);
  });

  it('lands on a rooftop rather than the ground plane when descending over one', () => {
    const boxes = [tower(30)];
    const pos = p(0, 25, 0);
    const r = resolveCapsule(pos, R, H, boxes, { previousY: 40 });
    expect(r.onGround).toBe(true);
    expect(pos.y).toBe(30);
    expect(r.surfaceIndex).toBe(0);
  });

  it('does not snap down onto a rooftop while ascending past it', () => {
    // Climbing from below the roof to above it must not yank the hero onto it.
    const boxes = [tower(30)];
    const pos = p(0, 31, 0);
    const r = resolveCapsule(pos, R, H, boxes, { previousY: 29.9 });
    expect(r.onGround).toBe(false);
    expect(pos.y).toBe(31);
  });

  it('falls off the edge of a rooftop once the feet leave the footprint', () => {
    const boxes = [tower(30)];
    const pos = p(6, 30, 0); // walked past the +X face at roof height
    const r = resolveCapsule(pos, R, H, boxes, { previousY: 30 });
    expect(r.onGround).toBe(false);
  });

  it('standing on a rooftop is not treated as standing inside a wall', () => {
    // The horizontal pass must skip the box the hero is standing on, or the
    // closest-point test would shove them off the roof.
    const boxes = [tower(30)];
    const pos = p(0, 30, 0);
    const r = resolveCapsule(pos, R, H, boxes, { previousY: 30 });
    expect(r.onGround).toBe(true);
    expect(r.pushed).toBe(false);
    expect(pos.x).toBe(0);
    expect(pos.z).toBe(0);
  });
});

describe('resolveCapsule — horizontal push-out', () => {
  it('criterion 11: pushes a capsule out of a box face by exactly the radius', () => {
    const boxes = [tower()];
    const pos = p(5.1, 0, 0); // 0.1 m from the +X face, inside the 0.35 m radius
    const r = resolveCapsule(pos, R, H, boxes, { previousY: 0 });
    expect(r.pushed).toBe(true);
    expect(pos.x).toBeCloseTo(5 + R, 6);
    expect(pos.z).toBeCloseTo(0, 6);
  });

  it('criterion 11: a capsule walked into a wall at dash speed never ends up inside it', () => {
    // FLIGHT_DASH_SPEED (20.5 m/s) at a 1/60 s step is 0.34 m per step, which is
    // the largest single-step displacement the tuning can produce. Drive it
    // straight into the +X face for 2 simulated seconds.
    const boxes = [tower()];
    const pos = p(12, 0, 0);
    for (let i = 0; i < 120; i++) {
      const previousY = pos.y;
      pos.x -= 20.5 / 60;
      resolveCapsule(pos, R, H, boxes, { previousY });
      // Never inside the footprint, always at least a radius clear of the face.
      expect(pos.x).toBeGreaterThanOrEqual(5 + R - 1e-9);
    }
  });

  it('slides along a wall without losing the tangential component', () => {
    const boxes = [tower()];
    const pos = p(5.2, 0, -4);
    const startZ = pos.z;
    for (let i = 0; i < 60; i++) {
      const previousY = pos.y;
      pos.x -= 0.05; // push into the wall
      pos.z += 0.1; // slide along it
      resolveCapsule(pos, R, H, boxes, { previousY });
    }
    expect(pos.x).toBeCloseTo(5 + R, 6); // held off the wall
    expect(pos.z).toBeCloseTo(startZ + 6, 6); // full tangential travel preserved
  });

  it('converges in a corner between two boxes without jitter', () => {
    // Two boxes meeting at an inside corner near (5, 5). Wedge the capsule in.
    const boxes = [
      new THREE.Box3(p(-5, 0, -5), p(5, 20, 5)),
      new THREE.Box3(p(5, 0, 5), p(15, 20, 15)),
    ];
    const pos = p(5.1, 0, 5.1);

    resolveCapsule(pos, R, H, boxes, { previousY: 0 });
    const afterFirst = pos.clone();

    // Re-resolving a settled position must be a no-op: that is what "converges
    // without jitter" means mechanically. A non-converging solver oscillates
    // between the two single-axis solutions and the hero visibly buzzes.
    for (let i = 0; i < 8; i++) {
      resolveCapsule(pos, R, H, boxes, { previousY: pos.y });
      expect(pos.x).toBeCloseTo(afterFirst.x, 9);
      expect(pos.z).toBeCloseTo(afterFirst.z, 9);
    }

    // And the settled point must genuinely be clear of both boxes.
    for (const b of boxes) {
      const cx = Math.min(Math.max(pos.x, b.min.x), b.max.x);
      const cz = Math.min(Math.max(pos.z, b.min.z), b.max.z);
      const d = Math.hypot(pos.x - cx, pos.z - cz);
      expect(d).toBeGreaterThanOrEqual(R - 1e-9);
    }
  });

  it('escapes a deep penetration along the least-penetrating axis', () => {
    const boxes = [tower()];
    const pos = p(4.0, 0, 0); // well inside the footprint, nearest face is +X
    resolveCapsule(pos, R, H, boxes, { previousY: 0 });
    expect(pos.x).toBeCloseTo(5 + R, 6);
  });

  it('ignores a box entirely below or above the capsule', () => {
    const low = [new THREE.Box3(p(-5, 0, -5), p(5, 2, 5))];
    const pos = p(0, 20, 0); // flying well above a 2 m box
    const r = resolveCapsule(pos, R, H, low, { previousY: 20 });
    expect(r.pushed).toBe(false);
    expect(pos.x).toBe(0);
  });
});

describe('playable-extent boundary', () => {
  it('creates exactly four boundary volumes', () => {
    expect(createBoundaryBoxes(150)).toHaveLength(4);
  });

  it('criterion 12: hero cannot leave the 300 m playable extent on any axis', () => {
    const world = new CollisionWorld({ halfExtent: 150 });
    const limit = 150 - R;

    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [-1, -1],
    ]) {
      const pos = p(0, 0, 0);
      // Sprint at the flight dash cap for 30 simulated seconds — far more than
      // enough to cross 150 m — and confirm the walls hold.
      for (let i = 0; i < 1800; i++) {
        const previousY = pos.y;
        pos.x += (dx * 20.5) / 60;
        pos.z += (dz * 20.5) / 60;
        world.resolve(pos, R, H, { previousY });
      }
      expect(Math.abs(pos.x)).toBeLessThanOrEqual(limit + 1e-6);
      expect(Math.abs(pos.z)).toBeLessThanOrEqual(limit + 1e-6);
    }
  });

  it('criterion 12: the boundary also holds at flight altitude', () => {
    const world = new CollisionWorld({ halfExtent: 150 });
    const pos = p(0, 120, 0);
    for (let i = 0; i < 1800; i++) {
      pos.x += 20.5 / 60;
      world.resolve(pos, R, H, { previousY: pos.y });
    }
    expect(pos.x).toBeLessThanOrEqual(150 - R + 1e-6);
  });
});

describe('raycastBoxes — camera arm obstruction', () => {
  it('returns the distance to the nearest face along the ray', () => {
    const boxes = [tower()];
    const d = raycastBoxes(p(20, 1, 0), p(-1, 0, 0), 100, boxes);
    expect(d).toBeCloseTo(15, 6); // 20 → the +X face at x = 5
  });

  it('returns maxDistance when nothing is hit', () => {
    const boxes = [tower()];
    const d = raycastBoxes(p(20, 1, 0), p(1, 0, 0), 100, boxes);
    expect(d).toBe(100);
  });

  it('misses a box the ray is parallel to and offset from', () => {
    const boxes = [tower()];
    const d = raycastBoxes(p(20, 100, 0), p(-1, 0, 0), 100, boxes);
    expect(d).toBe(100); // passes 70 m above a 30 m tower
  });

  it('takes the nearest of several boxes', () => {
    const boxes = [
      new THREE.Box3(p(30, 0, -5), p(40, 20, 5)),
      new THREE.Box3(p(10, 0, -5), p(20, 20, 5)),
    ];
    const d = raycastBoxes(p(0, 1, 0), p(1, 0, 0), 100, boxes);
    expect(d).toBeCloseTo(10, 6);
  });

  it('CollisionWorld.raycast ignores the invisible boundary walls', () => {
    // The camera must not be yanked inward by walls the player cannot see.
    const world = new CollisionWorld({ halfExtent: 150 });
    const d = world.raycast(p(0, 2, 0), p(1, 0, 0), 400);
    expect(d).toBe(400);
  });
});

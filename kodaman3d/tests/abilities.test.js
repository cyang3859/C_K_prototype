import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import {
  ABILITY,
  createAbilityState,
  freeze,
  isReady,
  laser,
  punch,
  punchDashTarget,
  tickAbilities,
} from '../src/combat/Abilities.js';
import { COMBAT, HP, createHealth, isFrozen } from '../src/combat/HealthSystem.js';
import { CombatSystem, SPAWNS } from '../src/combat/CombatSystem.js';
import { CameraRig } from '../src/controllers/CameraRig.js';
import { CollisionWorld } from '../src/world/Collision.js';
import { createHeroState } from '../src/controllers/LocomotionController.js';
import { HERO_HEIGHT_M } from '../src/core/Scale.js';
import { Hero } from '../src/entities/Hero.js';

/**
 * abilities.test.js — Phase 3 step 1, ability resolution.
 *
 * RNG is injected wherever the dodge branch is reachable, for the reason given
 * in health.test.js: "this run happened not to roll a dodge" is a flake, not a
 * pass. `never` is the default here so hit geometry is tested without dodges
 * masking a miss.
 */

const never = () => 0.99;
const always = () => 0;

/** Attacker at the origin facing +x. */
const hero = { pos: { x: 0, z: 0 }, facing: { x: 1, z: 0 } };
const target = (x, z = 0, hp = HP.STANDARD) => ({ pos: { x, z }, health: createHealth(hp) });

/** Just inside punch reach, dead ahead. */
const CLOSE = ABILITY.PUNCH_REACH_M * 0.5;
/** Default target body radius, mirroring Enemy.js's capsule. */
const BODY_R = 0.36;

describe('cooldowns', () => {
  it('starts every ability ready', () => {
    const s = createAbilityState();
    expect([isReady(s, 'punch'), isReady(s, 'laser'), isReady(s, 'freeze')]).toEqual([
      true,
      true,
      true,
    ]);
  });

  it('spends the cooldown on firing and refuses until it elapses', () => {
    const s = createAbilityState();
    expect(punch(s, hero, [target(CLOSE)], { rng: never }).fired).toBe(true);
    expect(punch(s, hero, [target(CLOSE)], { rng: never }).fired).toBe(false);
    tickAbilities(s, ABILITY.PUNCH_COOLDOWN_S);
    expect(punch(s, hero, [target(CLOSE)], { rng: never }).fired).toBe(true);
  });

  it('a refused ability does no damage at all', () => {
    const s = createAbilityState();
    const t = target(CLOSE);
    punch(s, hero, [t], { rng: never });
    const hpAfterFirst = t.health.hp;
    const second = punch(s, hero, [t], { rng: never });
    expect(second.hits).toEqual([]);
    expect(t.health.hp).toBe(hpAfterFirst);
  });

  it('keeps the three cooldowns independent', () => {
    const s = createAbilityState();
    punch(s, hero, [], { rng: never });
    expect(isReady(s, 'punch')).toBe(false);
    expect(isReady(s, 'laser')).toBe(true);
    expect(isReady(s, 'freeze')).toBe(true);
  });

  it('rejects a negative dt', () => {
    expect(() => tickAbilities(createAbilityState(), -1)).toThrow(/dt must be >= 0/);
  });

  it('carries the prototype cooldowns, converted from frames', () => {
    expect(ABILITY.PUNCH_COOLDOWN_S).toBeCloseTo(0.3); // 18 frames
    expect(ABILITY.LASER_COOLDOWN_S).toBeCloseTo(1.0); // 60 frames
    expect(ABILITY.FREEZE_COOLDOWN_S).toBeCloseTo(80 / 60);
  });
});

describe('punch', () => {
  it('damages a target dead ahead', () => {
    const t = target(CLOSE);
    const r = punch(createAbilityState(), hero, [t], { rng: never });
    expect(r.hits).toHaveLength(1);
    expect(r.hits[0].result.outcome).toBe('damaged');
    expect(t.health.hp).toBe(HP.STANDARD - COMBAT.PUNCH_DAMAGE);
  });

  it('misses one just beyond reach', () => {
    // Reach is to the SURFACE, so the miss threshold is reach + body radius.
    const t = target(ABILITY.PUNCH_REACH_M + BODY_R + 0.05);
    expect(punch(createAbilityState(), hero, [t], { rng: never }).hits).toEqual([]);
    expect(t.health.hp).toBe(HP.STANDARD);
  });

  it('reaches the target SURFACE, not its centre', () => {
    // A body of radius 0.36 whose centre sits just past nominal reach is still
    // touching the fist. Testing the centre alone silently shortened every
    // reach by a radius and produced misses at visible contact range.
    const justPastCentreReach = ABILITY.PUNCH_REACH_M + BODY_R * 0.5;
    const t = target(justPastCentreReach);
    expect(punch(createAbilityState(), hero, [t], { rng: never }).hits).toHaveLength(1);
  });

  it('honours a target that declares its own radius', () => {
    const big = { pos: { x: ABILITY.PUNCH_REACH_M + 1.4, z: 0 }, health: createHealth(9), radius: 1.5 };
    const small = { pos: { x: ABILITY.PUNCH_REACH_M + 1.4, z: 0 }, health: createHealth(9), radius: 0.1 };
    expect(punch(createAbilityState(), hero, [big], { rng: never }).hits).toHaveLength(1);
    expect(punch(createAbilityState(), hero, [small], { rng: never }).hits).toEqual([]);
  });

  it('misses one directly behind — this is a facing-direction attack', () => {
    const t = target(-CLOSE);
    expect(punch(createAbilityState(), hero, [t], { rng: never }).hits).toEqual([]);
  });

  it('misses one outside the wedge angle, even within reach', () => {
    // 80° off the facing axis, beyond the 60° half-angle, at half reach.
    const a = (80 * Math.PI) / 180;
    const d = ABILITY.PUNCH_REACH_M * 0.5;
    const t = target(Math.cos(a) * d, Math.sin(a) * d);
    expect(punch(createAbilityState(), hero, [t], { rng: never }).hits).toEqual([]);
  });

  it('HITS one off to the side but within the wedge — the regression that read as "attacks do nothing"', () => {
    // The narrow box this replaced missed an enemy 0.78 m away at a modest
    // angle; six consecutive punches whiffed in the browser at that distance.
    const a = (40 * Math.PI) / 180;
    const d = 0.78;
    const t = target(Math.cos(a) * d, Math.sin(a) * d);
    expect(punch(createAbilityState(), hero, [t], { rng: never }).hits).toHaveLength(1);
  });

  it('measures reach to the target, not along the facing axis', () => {
    // A target at 45° and 0.95 m is inside a 1.15 m reach. Projecting onto the
    // facing axis first would read it as 0.67 m along and could let something
    // genuinely out of range count as in range.
    const a = Math.PI / 4;
    const inside = target(Math.cos(a) * 0.95, Math.sin(a) * 0.95);
    const far = ABILITY.PUNCH_REACH_M + BODY_R + 0.4;
    const outside = target(Math.cos(a) * far, Math.sin(a) * far);
    expect(punch(createAbilityState(), hero, [inside], { rng: never }).hits).toHaveLength(1);
    expect(punch(createAbilityState(), hero, [outside], { rng: never }).hits).toEqual([]);
  });

  it('CLEAVES — every target in the arc is hit, not just the nearest', () => {
    const ts = [target(CLOSE * 0.4), target(CLOSE * 0.7), target(CLOSE)];
    const r = punch(createAbilityState(), hero, ts, { rng: never });
    expect(r.hits).toHaveLength(3);
    expect(ts.every((t) => t.health.hp === HP.STANDARD - 1)).toBe(true);
  });

  it('skips corpses instead of re-hitting them', () => {
    const t = target(CLOSE, 0, 1);
    punch(createAbilityState(), hero, [t], { rng: never });
    expect(t.health.alive).toBe(false);
    expect(punch(createAbilityState(), hero, [t], { rng: never }).hits).toEqual([]);
  });

  it('applies knockback, and reports a dodge as a miss without damage', () => {
    const hit = target(CLOSE);
    punch(createAbilityState(), hero, [hit], { rng: never });
    expect(hit.health.knockback).toBeCloseTo(ABILITY.PUNCH_KNOCKBACK_M);

    const dodger = target(CLOSE);
    const r = punch(createAbilityState(), hero, [dodger], { rng: always });
    expect(r.hits[0].result.outcome).toBe('dodged');
    expect(dodger.health.hp).toBe(HP.STANDARD);
    expect(dodger.health.knockback).toBe(0);
  });

  it('follows the attacker\'s facing rather than a world axis', () => {
    const facingZ = { pos: { x: 0, z: 0 }, facing: { x: 0, z: 1 } };
    expect(punch(createAbilityState(), facingZ, [target(0, CLOSE)], { rng: never }).hits).toHaveLength(1);
    expect(punch(createAbilityState(), facingZ, [target(CLOSE, 0)], { rng: never }).hits).toEqual([]);
  });
});

describe('laser', () => {
  const far = (x) => target(x, 0, 99);

  it('hits the NEAREST target in the cone, and only that one', () => {
    const near = far(10);
    const behind = far(40);
    const r = laser(createAbilityState(), hero, [behind, near], { rng: never });
    expect(r.hits).toHaveLength(1);
    expect(r.hits[0].target).toBe(near);
    expect(behind.health.hp).toBe(99);
  });

  it('deals laser damage — 5, not the 2 the handoff doc claims', () => {
    const t = far(10);
    laser(createAbilityState(), hero, [t], { rng: never });
    expect(t.health.hp).toBe(99 - 5);
  });

  it('applies no knockback, matching the 2D beam', () => {
    const t = far(10);
    laser(createAbilityState(), hero, [t], { rng: never });
    expect(t.health.knockback).toBe(0);
  });

  it('reaches far beyond punch range — it is hitscan, not melee', () => {
    const t = far(500);
    expect(laser(createAbilityState(), hero, [t], { rng: never }).hits).toHaveLength(1);
  });

  it('ignores anything behind the attacker', () => {
    expect(laser(createAbilityState(), hero, [far(-10)], { rng: never }).hits).toEqual([]);
  });

  it('ignores a target outside the aim cone, however close', () => {
    // 45° off-axis, well beyond the 25° half-angle.
    const off = { pos: { x: 5, z: 5 }, health: createHealth(99) };
    expect(laser(createAbilityState(), hero, [off], { rng: never }).hits).toEqual([]);
  });

  it('still spends the cooldown when it fires into empty air', () => {
    const s = createAbilityState();
    const r = laser(s, hero, [], { rng: never });
    expect(r.fired).toBe(true);
    expect(r.hits).toEqual([]);
    expect(isReady(s, 'laser')).toBe(false);
  });

  it('keeps its lock on a strafing target instead of flickering to a new one', () => {
    const s = createAbilityState();
    const locked = far(30);
    const interloper = far(5);
    laser(s, hero, [locked], { rng: never });
    expect(s.laserTarget).toBe(locked);

    // A nearer enemy walks in; the beam must stay on the one it locked.
    tickAbilities(s, ABILITY.LASER_COOLDOWN_S);
    const r = laser(s, hero, [locked, interloper], { rng: never });
    expect(r.hits[0].target).toBe(locked);
  });

  it('re-acquires once the locked target dies', () => {
    const s = createAbilityState();
    const dying = target(30, 0, 5);
    const next = far(40);
    laser(s, hero, [dying, next], { rng: never });
    expect(dying.health.alive).toBe(false);

    tickAbilities(s, ABILITY.LASER_COOLDOWN_S);
    const r = laser(s, hero, [dying, next], { rng: never });
    expect(r.hits[0].target).toBe(next);
  });

  it('re-acquires once the locked target leaves the cone', () => {
    const s = createAbilityState();
    const strafer = far(30);
    const other = far(40);
    laser(s, hero, [strafer, other], { rng: never });
    expect(s.laserTarget).toBe(strafer);

    strafer.pos = { x: -30, z: 0 }; // now behind the hero
    tickAbilities(s, ABILITY.LASER_COOLDOWN_S);
    const r = laser(s, hero, [strafer, other], { rng: never });
    expect(r.hits[0].target).toBe(other);
  });
});

describe('freeze', () => {
  it('stuns without dealing damage', () => {
    const t = target(ABILITY.FREEZE_REACH_M * 0.5);
    const r = freeze(createAbilityState(), hero, [t]);
    expect(r.hits).toHaveLength(1);
    expect(t.health.hp).toBe(HP.STANDARD);
    expect(isFrozen(t.health)).toBe(true);
  });

  it('CANNOT BE DODGED — the ability that shuts down dodge must not be dodgeable', () => {
    // Asserted as a RATE, not a single call. A single freeze landing proves
    // nothing: an implementation that routed freeze through the dodge roll
    // would still succeed ~72% of the time and pass a one-shot test. Over 300
    // fresh targets, any dodge path at all (28%) is a statistical certainty —
    // seeing 300/300 is what actually pins the property.
    //
    // Note also that `freeze()` accepts no `rng` parameter, so there is nowhere
    // for a dodge roll to enter. That is the structural half of the guarantee;
    // this is the behavioural half.
    let frozen = 0;
    for (let i = 0; i < 300; i++) {
      const t = target(ABILITY.FREEZE_REACH_M * 0.5);
      t.health.dodgeCooldownFor = 0; // fully eligible to dodge, if it could
      freeze(createAbilityState(), hero, [t]);
      if (isFrozen(t.health)) frozen++;
    }
    expect(frozen).toBe(300);
  });

  it('catches everything in the cone, like the 2D box did', () => {
    const ts = [
      target(ABILITY.FREEZE_REACH_M * 0.3),
      target(ABILITY.FREEZE_REACH_M * 0.6),
      target(ABILITY.FREEZE_REACH_M * 0.9),
    ];
    expect(freeze(createAbilityState(), hero, ts).hits).toHaveLength(3);
    expect(ts.every((t) => isFrozen(t.health))).toBe(true);
  });

  it('misses beyond its reach, which is shorter than the laser and longer than the punch', () => {
    const t = target(ABILITY.FREEZE_REACH_M + BODY_R + 0.2);
    expect(freeze(createAbilityState(), hero, [t]).hits).toEqual([]);
    expect(ABILITY.FREEZE_REACH_M).toBeGreaterThan(ABILITY.PUNCH_REACH_M);
  });

  it('covers a wider arc than the punch and a wider one than the laser', () => {
    // Ordering the three arcs is the design: a beam is aimed, a cone is swept,
    // a fist is swung.
    expect(ABILITY.FREEZE_HALF_ANGLE_RAD).toBeGreaterThan(ABILITY.LASER_HALF_ANGLE_RAD);
    expect(ABILITY.PUNCH_HALF_ANGLE_RAD).toBeGreaterThan(ABILITY.FREEZE_HALF_ANGLE_RAD);
  });

  it('does not freeze corpses', () => {
    const t = target(1, 0, 1);
    punch(createAbilityState(), hero, [t], { rng: never });
    expect(freeze(createAbilityState(), hero, [t]).hits).toEqual([]);
  });

  it('holds for the ported 2.5 s', () => {
    const t = target(1);
    freeze(createAbilityState(), hero, [t]);
    expect(t.health.frozenFor).toBeCloseTo(COMBAT.FREEZE_DURATION_S);
  });
});

describe('reaches are scaled by the BODY, not by PX_TO_M', () => {
  it('gives a punch a human reach rather than a nine-metre one', () => {
    // The trap: 62 px * PX_TO_M(0.2) = 12.4 m. Correct: 0.62 hero-heights.
    expect(ABILITY.PUNCH_REACH_M).toBeCloseTo(0.62 * HERO_HEIGHT_M);
    expect(ABILITY.PUNCH_REACH_M).toBeLessThan(1.5);
  });

  it('keeps freeze at a couple of metres rather than twenty-two', () => {
    expect(ABILITY.FREEZE_REACH_M).toBeCloseTo(1.1 * HERO_HEIGHT_M);
    expect(ABILITY.FREEZE_REACH_M).toBeLessThan(3);
  });

  it('scales knockback by PX_TO_M instead, because it is world displacement', () => {
    expect(ABILITY.PUNCH_KNOCKBACK_M).toBeCloseTo(9 * 0.2);
  });

  it('keeps knockback inside the cap so a single punch cannot exceed it', () => {
    expect(ABILITY.PUNCH_KNOCKBACK_M).toBeLessThanOrEqual(COMBAT.KNOCKBACK_CAP_M);
  });
});

describe('the balance the 2D game shipped', () => {
  it('laser one-shots a standard enemy where punch needs three', () => {
    const byLaser = target(10);
    laser(createAbilityState(), hero, [byLaser], { rng: never });
    expect(byLaser.health.alive).toBe(false);

    const byPunch = target(CLOSE);
    const s = createAbilityState();
    for (let i = 0; i < 2; i++) {
      punch(s, hero, [byPunch], { rng: never });
      tickAbilities(s, ABILITY.PUNCH_COOLDOWN_S);
    }
    expect(byPunch.health.alive).toBe(true);
    punch(s, hero, [byPunch], { rng: never });
    expect(byPunch.health.alive).toBe(false);
  });

  it('buys the laser its power with a cooldown three times the punch\'s', () => {
    expect(ABILITY.LASER_COOLDOWN_S / ABILITY.PUNCH_COOLDOWN_S).toBeCloseTo(60 / 18);
  });
});

/**
 * Spawn placement — the regression that made combat look broken on load.
 *
 * The first spawn list put every enemy at z = 26–40 while the hero spawns at
 * z = 13 facing -Z, i.e. entirely behind the player and off-camera. Nothing
 * threw; the game simply looked like combat did not work. Browser testing
 * missed it because every probe repositioned enemies before attacking.
 */
describe('starter encounter placement', () => {
  it('spawns every enemy IN FRONT of the hero — decreasing z from the spawn', () => {
    expect(CombatSystem.validateSpawns(null)).toEqual([]);
    for (const s of SPAWNS) expect(s.z).toBeLessThan(13);
  });

  it('reports a spawn placed behind the hero rather than failing silently', () => {
    const bad = [{ x: 0, z: 40, type: 'brute' }];
    const problems = CombatSystem.validateSpawns(null, bad);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/BEHIND the hero/);
  });

  it('reports a spawn standing inside a solid box', () => {
    // Collision resolution would eject an entity placed here metres sideways,
    // which previously read as "the punch has no reach".
    const collision = { boxes: [{ min: { x: -5, y: 0, z: -5 }, max: { x: 5, y: 20, z: 5 } }] };
    const problems = CombatSystem.validateSpawns(collision, [{ x: 0, z: 0, type: 'brute' }]);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/inside a solid box/);
  });

  it('keeps enemies close enough to reach on foot in a few seconds', () => {
    for (const s of SPAWNS) {
      expect(Math.hypot(s.x, s.z - 13)).toBeLessThan(20);
    }
  });
});


/**
 * Vertical reach — the "punch someone 120 m below you" regression.
 *
 * Every position and the facing vector used to be flattened to X/Z, so altitude
 * was invisible to combat: a target 1 m ahead horizontally was in range whether
 * it stood beside the hero or 120 m below. Measured in the browser before the
 * fix; these pin it.
 */
describe('altitude is part of reach, not ignored', () => {
  const level = { pos: { x: 0, y: 1.6, z: 0 }, facing: { x: 1, y: 0, z: 0 } };
  const at = (x, y) => ({ pos: { x, y, z: 0 }, health: createHealth(99) });

  it('hits a target level with the attacker and just ahead', () => {
    expect(punch(createAbilityState(), level, [at(0.9, 1.6)], { rng: never }).hits).toHaveLength(1);
  });

  it('MISSES a target 1 m ahead horizontally but 20 m below', () => {
    expect(punch(createAbilityState(), level, [at(0.9, -20)], { rng: never }).hits).toEqual([]);
  });

  it('MISSES one 120 m below — the exact case that shipped as a hit', () => {
    expect(punch(createAbilityState(), level, [at(0.9, -120)], { rng: never }).hits).toEqual([]);
  });

  it('MISSES one directly overhead but far above', () => {
    expect(punch(createAbilityState(), level, [at(0, 40)], { rng: never }).hits).toEqual([]);
  });

  it('laser respects altitude too', () => {
    const far = { pos: { x: 30, y: -60, z: 0 }, health: createHealth(99) };
    expect(laser(createAbilityState(), level, [far], { rng: never }).hits).toEqual([]);
  });

  it('freeze respects altitude too', () => {
    expect(freeze(createAbilityState(), level, [at(1.5, -30)]).hits).toEqual([]);
  });
});

describe('aim follows pitch, so looking down hits what is below', () => {
  /**
   * Attacker at 20 m, aiming steeply downward at 80 degrees below level.
   *
   * 80 rather than 60 deliberately: at exactly 60 a level target sits ON the
   * punch wedge's 60-degree boundary, so the test would be asserting a
   * tie-break rather than a behaviour.
   */
  const a = (80 * Math.PI) / 180;
  const diving = {
    pos: { x: 0, y: 20, z: 0 },
    facing: { x: Math.cos(a), y: -Math.sin(a), z: 0 },
  };

  it('hits a target along the downward aim line', () => {
    // 1.2 m along the aim vector — inside punch reach + body radius.
    const t = {
      pos: { x: Math.cos(a) * 1.2, y: 20 - Math.sin(a) * 1.2, z: 0 },
      health: createHealth(99),
    };
    expect(punch(createAbilityState(), diving, [t], { rng: never }).hits).toHaveLength(1);
  });

  it('still misses something level with the attacker when aiming down', () => {
    const t = { pos: { x: 1.2, y: 20, z: 0 }, health: createHealth(99) };
    expect(punch(createAbilityState(), diving, [t], { rng: never }).hits).toEqual([]);
  });

  it('lets the laser pick a target far below when aimed at it', () => {
    const t = {
      pos: { x: Math.cos(a) * 25, y: 20 - Math.sin(a) * 25, z: 0 },
      health: createHealth(99),
    };
    expect(laser(createAbilityState(), diving, [t], { rng: never }).hits).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Attack dash-to-target (`RESEARCH_MANOFSTEEL_REPO.md` §7a)
//
// The rule half only. Actually MOVING the hero is CombatSystem's job, because
// it has to be swept against the world's colliders first — see the sweep test
// further down.
// ---------------------------------------------------------------------------

describe('punchDashTarget — closing the last stride', () => {
  /** Distance at which a target's SURFACE sits `gap` metres outside reach. */
  const atGap = (gap) => ABILITY.PUNCH_REACH_M + BODY_R + gap;

  it('returns nothing when there is nothing to punch', () => {
    expect(punchDashTarget(hero, [])).toBeNull();
  });

  it('does not dash to a target already in reach — there is nothing to close', () => {
    expect(punchDashTarget(hero, [target(CLOSE)])).toBeNull();
  });

  it('does not dash to a target only JUST inside reach, either', () => {
    // The interesting case, and the one a deep-inside target does not cover.
    // With no vertical offset the hero is 0.05 m inside reach but still further
    // out than the dash's stopping distance, so a rule that only checked "am I
    // past where I want to stand" would shuffle forward at a target it can
    // already hit. The `gap <= 0` test is what refuses it.
    expect(punchDashTarget(hero, [target(atGap(-0.05))])).toBeNull();
  });

  it('dashes to a target just outside reach, reporting the exact shortfall', () => {
    const pick = punchDashTarget(hero, [target(atGap(0.5))]);
    expect(pick).not.toBeNull();
    expect(pick.gap).toBeCloseTo(0.5, 6);
  });

  it('refuses a target beyond reach + PUNCH_DASH_M — the attack does not travel', () => {
    expect(punchDashTarget(hero, [target(atGap(ABILITY.PUNCH_DASH_M + 0.01))])).toBeNull();
  });

  it('takes the target at the very edge of the window', () => {
    const pick = punchDashTarget(hero, [target(atGap(ABILITY.PUNCH_DASH_M - 1e-9))]);
    expect(pick).not.toBeNull();
  });

  it('forgives DISTANCE, never DIRECTION — a target behind you is not a target', () => {
    expect(punchDashTarget(hero, [target(-atGap(0.5))])).toBeNull();
  });

  it('respects the punch wedge exactly, so the dash cannot reach what a punch could not', () => {
    // Just outside the 60° half-angle, at a distance well inside the window.
    const d = atGap(0.4);
    const outside = ABILITY.PUNCH_HALF_ANGLE_RAD + 0.05;
    const t = target(Math.cos(outside) * d, Math.sin(outside) * d);
    expect(punchDashTarget(hero, [t])).toBeNull();

    const inside = ABILITY.PUNCH_HALF_ANGLE_RAD - 0.05;
    const t2 = target(Math.cos(inside) * d, Math.sin(inside) * d);
    expect(punchDashTarget(hero, [t2])).not.toBeNull();
  });

  it('ignores the dead', () => {
    const t = target(atGap(0.5));
    t.health.hp = 0;
    t.health.alive = false;
    expect(punchDashTarget(hero, [t])).toBeNull();
  });

  it('picks the NEAREST qualifying target when several are in the window', () => {
    const near = target(atGap(0.2));
    const far = target(atGap(0.8), 0.3);
    expect(punchDashTarget(hero, [far, near]).target).toBe(near);
  });

  it('measures to the target SURFACE, like every other reach in this file', () => {
    // A fat target at the same centre distance is CLOSER in surface terms, so a
    // gap judged to the centre would be wrong by exactly the radius difference.
    const fat = { ...target(atGap(0.5)), radius: BODY_R + 0.3 };
    expect(punchDashTarget(hero, [fat]).gap).toBeCloseTo(0.2, 6);
  });

  it('counts ALTITUDE, so a hovering hero does not dash at the ground', () => {
    // Directly below and far outside reach vertically: combat has been 2D once
    // in this project already (`0ded25e`) and this is the same trap.
    const below = { pos: { x: 0.2, y: -8, z: 0 }, health: createHealth(HP.STANDARD) };
    const attacker = { pos: { x: 0, y: 0, z: 0 }, facing: { x: 1, y: 0, z: 0 } };
    expect(punchDashTarget(attacker, [below])).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// The scene-side half: the dash is SWEPT, and a connecting blow freezes time.
//
// These build a real CombatSystem against a real CollisionWorld, because both
// behaviours are precisely the parts that `punchDashTarget` and `Time.hold`
// cannot state on their own.
// ---------------------------------------------------------------------------

describe('CombatSystem — dash sweep and hit stop', () => {
  /** A pressed-this-step input stub, in the shape `update` reads. */
  const keys = (...pressed) => ({ wasPressed: (c) => pressed.includes(c) });

  function makeCombat({ collision = null, enemyAt = { x: 0, z: -3 } } = {}) {
    const scene = new THREE.Scene();
    const hero = { position: new THREE.Vector3(0, 0, 0), facing: 0 };
    const held = [];
    const combat = new CombatSystem({
      scene,
      hero,
      collision,
      hitStop: (s) => held.push(s),
      // Dodges off: these tests are about geometry and wiring, and a dodge would
      // turn a real defect into an intermittent one.
      rng: never,
    });
    // Replace the starter encounter with one enemy in a known place: the spawn
    // list is a property of the game's opening, not of these rules.
    for (const e of combat.enemies) e.dispose();
    combat.enemies.length = 0;
    const enemy = combat.spawn({ ...enemyAt, type: 'robber' });
    return { combat, hero, enemy, held, scene };
  }

  /** Distance from the hero at which the enemy's surface is `gap` outside reach. */
  const gapAway = (gap) => ABILITY.PUNCH_REACH_M + 0.36 + gap;

  it('carries the hero into a target that was just out of reach', () => {
    const start = -gapAway(0.6);
    const { combat, hero } = makeCombat({ enemyAt: { x: 0, z: start } });
    combat.update(1 / 60, keys('KeyJ'));
    // It moved forward (−Z), it did not overshoot past the target, it stayed
    // inside the dash window, and — the point of all of it — the punch landed.
    expect(hero.position.z).toBeLessThan(0);
    expect(hero.position.z).toBeGreaterThan(start);
    expect(Math.abs(hero.position.z)).toBeLessThanOrEqual(ABILITY.PUNCH_DASH_M);
    expect(combat.lastEvent).toContain('damaged');
  });

  it('stops just INSIDE reach, not on its boundary', () => {
    // The dash is HORIZONTAL while reach is 3D, and the hero's eyes sit ~0.77 m
    // above an enemy's centre of mass. Moving horizontally by the 3D shortfall
    // therefore overshoots; this pins the corrected solve.
    const enemyZ = -gapAway(0.7);
    const { combat, hero } = makeCombat({ enemyAt: { x: 0, z: enemyZ } });
    combat.update(1 / 60, keys('KeyJ'));

    // ⚠️ MEASURED AGAINST WHERE THE ENEMY WAS, NOT WHERE IT NOW IS. The punch
    // connects and knocks it back 1.8 m in the same step, so reading `enemy.pos`
    // afterwards measures the knockback and calls it the dash.
    const eye = { y: hero.position.y + 1.62, z: hero.position.z };
    const d = Math.hypot(eye.y - 0.85, eye.z - enemyZ);
    const stop = (ABILITY.PUNCH_REACH_M + 0.36) * ABILITY.PUNCH_DASH_STOP_FRAC;
    expect(d).toBeCloseTo(stop, 3);
    // Comfortably inside reach, which is what stops the hit being a coin flip.
    expect(d - 0.36).toBeLessThan(ABILITY.PUNCH_REACH_M);
  });

  it('does not move the hero when the target is already in reach', () => {
    const { combat, hero } = makeCombat({ enemyAt: { x: 0, z: -1.0 } });
    combat.update(1 / 60, keys('KeyJ'));
    expect(hero.position.z).toBe(0);
  });

  it('does not move the hero on a punch refused by its cooldown', () => {
    const { combat, hero, enemy } = makeCombat({ enemyAt: { x: 0, z: -gapAway(0.6) } });
    combat.update(1 / 60, keys('KeyJ'));
    const after = hero.position.z;

    // ⚠️ RE-ARM THE SITUATION FIRST. The connecting punch knocks the enemy back
    // 1.8 m, which puts it outside the dash window on its own — so pressing J
    // again without this would find nothing to dash to, and the test would pass
    // with the cooldown guard deleted. Measured: it did.
    enemy.pos.x = hero.position.x;
    enemy.pos.z = hero.position.z - gapAway(0.6);
    expect(combat.abilities.punchFor).toBeGreaterThan(0);

    combat.update(1 / 60, keys('KeyJ'));
    expect(combat.lastEvent).toContain('cooldown');
    expect(hero.position.z).toBe(after);
  });

  it('SWEEPS the dash — a wall between hero and target stops it short', () => {
    // The failure this prevents is teleporting into geometry and being ejected
    // metres sideways by the next collision resolve, which has already happened
    // once in this project and read as "the punch has no reach".
    //
    // ⚠️ THE TARGET MUST BE INSIDE THE DASH WINDOW or this test proves nothing.
    // It first used a 0.9 m gap, which is 1.02 m of 3D shortfall once the
    // eye-to-centre offset is counted — outside PUNCH_DASH_M, so no dash ever
    // happened and the assertion passed with the sweep deleted. Measured.
    const collision = new CollisionWorld({ halfExtent: 150 });
    collision.addBuilding(
      new THREE.Box3(new THREE.Vector3(-5, 0, -0.9), new THREE.Vector3(5, 20, -0.7)),
    );
    const { combat, hero } = makeCombat({
      collision,
      enemyAt: { x: 0, z: -gapAway(0.7) },
    });
    const unobstructed = punchDashTarget(
      { pos: { x: 0, y: 1.62, z: 0 }, facing: { x: 0, y: 0, z: -1 } },
      [{ pos: { x: 0, y: 0.85, z: -gapAway(0.7) }, health: createHealth(HP.STANDARD) }],
    ).travel;
    expect(unobstructed).toBeGreaterThan(1.0); // it WOULD cross the wall

    combat.update(1 / 60, keys('KeyJ'));
    // Stopped at the wall's near face less the hero's own radius, not through it.
    expect(hero.position.z).toBeGreaterThan(-0.7 + 0.35 - 1e-6);
  });

  it('does not drag a hovering hero down to punch — the dash is horizontal', () => {
    const { combat, hero } = makeCombat({ enemyAt: { x: 0, z: -gapAway(0.5) } });
    hero.position.y = 40;
    combat.update(1 / 60, keys('KeyJ'));
    expect(hero.position.y).toBe(40);
  });

  it('freezes time on a connecting punch', () => {
    const { combat, held } = makeCombat({ enemyAt: { x: 0, z: -1.0 } });
    combat.update(1 / 60, keys('KeyJ'));
    expect(held).toEqual([ABILITY.HIT_STOP_S]);
  });

  it('freezes LONGER on a kill, so a finisher lands harder than a setup', () => {
    // A fresh encounter rather than a second punch on the same enemy: post-hit
    // invulnerability frames refuse that one, and the test would then be
    // measuring the i-frame window while claiming to measure a kill.
    const { combat, enemy, held } = makeCombat({ enemyAt: { x: 0, z: -1.0 } });
    enemy.health.hp = 1;
    combat.update(1 / 60, keys('KeyJ'));
    expect(combat.lastEvent).toContain('killed');
    expect(held).toEqual([ABILITY.KILL_STOP_S]);
  });

  it('does NOT freeze time on a miss — that reads as a frame drop, not a hit', () => {
    const { combat, held } = makeCombat({ enemyAt: { x: 0, z: -40 } });
    combat.update(1 / 60, keys('KeyJ'));
    expect(combat.lastEvent).toContain('miss');
    expect(held).toEqual([]);
  });

  it('does NOT freeze time on a DODGE — the swing was in range and still hit nothing', () => {
    // The subtle case, and the reason the code tests `connected` rather than
    // just "did anything come back". A miss returns an empty hit list and never
    // reaches the hit-stop line at all; a dodge returns a hit whose outcome is
    // `dodged`, so only an outcome check can tell them apart.
    const scene = new THREE.Scene();
    const hero = { position: new THREE.Vector3(0, 0, 0), facing: 0 };
    const held = [];
    const combat = new CombatSystem({
      scene,
      hero,
      collision: null,
      hitStop: (s) => held.push(s),
      rng: always, // every dodge roll succeeds
    });
    for (const e of combat.enemies) e.dispose();
    combat.enemies.length = 0;
    combat.spawn({ x: 0, z: -1.0, type: 'robber' });

    combat.update(1 / 60, keys('KeyJ'));
    expect(combat.lastEvent).toContain('dodged');
    expect(held).toEqual([]);
  });

  it('does NOT freeze time on freeze — it deals no damage and says nothing about impact', () => {
    const { combat, held } = makeCombat({ enemyAt: { x: 0, z: -1.0 } });
    combat.update(1 / 60, keys('KeyL'));
    expect(combat.lastEvent).toContain('frozen');
    expect(held).toEqual([]);
  });

  it('works with no hitStop wired at all — headless rigs pass none', () => {
    const scene = new THREE.Scene();
    const hero = { position: new THREE.Vector3(0, 0, 0), facing: 0 };
    const combat = new CombatSystem({ scene, hero, collision: null });
    expect(() => combat.update(1 / 60, keys('KeyJ'))).not.toThrow();
  });
});

describe('Hero punch animation — alternating arms', () => {
  function makeHero() {
    return new Hero({ scene: new THREE.Scene(), position: new THREE.Vector3(0, 0, 0) });
  }

  /**
   * The arm that swings FORWARD hardest in the current tell.
   *
   * ADVANCES THE TELL FIRST, which is not incidental: the thrust curve starts at
   * zero, so at t = 0 both arms read exactly 0 and "which is driving" has no
   * answer yet. Sampled at the peak instead.
   */
  const drivingArm = (hero) => {
    hero.update(ABILITY.PUNCH_FX_S * 0.3);
    const [l, r] = hero._attackArmPose();
    return l > r ? 'left' : 'right';
  };

  it('swings the other arm on each successive punch', () => {
    const hero = makeHero();
    hero.playAttack('punch');
    const first = drivingArm(hero);
    hero.playAttack('punch');
    expect(drivingArm(hero)).not.toBe(first);
    hero.playAttack('punch');
    expect(drivingArm(hero)).toBe(first);
  });

  it('counter-swings the idle arm, whichever side is driving', () => {
    const hero = makeHero();
    for (let i = 0; i < 2; i++) {
      hero.playAttack('punch');
      hero.update(ABILITY.PUNCH_FX_S * 0.3); // at the peak of the thrust
      const [l, r] = hero._attackArmPose();
      expect(Math.min(l, r)).toBeLessThan(0); // one arm is behind the body
      expect(Math.max(l, r)).toBeGreaterThan(1); // the other is thrust forward
    }
  });

  it('does not let a laser between two punches consume a side', () => {
    // Otherwise a punch-laser-punch sequence repeats the same arm, which is the
    // thing the alternation exists to remove.
    const hero = makeHero();
    hero.playAttack('punch');
    const first = drivingArm(hero);
    hero.playAttack('laser');
    hero.playAttack('punch');
    expect(drivingArm(hero)).not.toBe(first);
  });
});

// ---------------------------------------------------------------------------
// The seam between CameraRig's convention and CombatSystem's aim
//
// ⚠️ THIS IS THE TEST THAT WAS MISSING, and its shape is the point. The pure
// tests above prove `Abilities` handles a 3D aim vector correctly, and they are
// right — they build `facing` by hand. The defect lived in the ONE LINE that
// translates `CameraRig.pitch` into that vector, and no test crossed between the
// two modules, so both halves were "tested" while the game aimed 28.65° away
// from the crosshair at rest.
//
// The expected direction is therefore taken from a REAL CameraRig's camera
// matrix. Restating `_aimFrom`'s own formula here would have agreed with the
// bug, which is this repo's recurring hollow-enforcement failure.
// ---------------------------------------------------------------------------

describe('attacks aim where the CAMERA actually looks', () => {
  function rigAt(yaw, pitch) {
    const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 2000);
    const hero = createHeroState({ position: new THREE.Vector3(0, 0, 0) });
    const collision = new CollisionWorld({ halfExtent: 150 });
    const rig = new CameraRig({ camera, hero, collision });
    rig.yaw = yaw;
    rig.pitch = pitch;
    rig.update(1 / 60, { look: { dx: 0, dy: 0 }, wheel: 0 });
    // Settle the arm/height easing so the camera is where it means to be.
    for (let i = 0; i < 240; i++) rig.update(1 / 60, { look: { dx: 0, dy: 0 }, wheel: 0 });
    camera.updateMatrixWorld(true);
    const e = camera.matrixWorld.elements;
    return { rig, forward: new THREE.Vector3(-e[8], -e[9], -e[10]).normalize() };
  }

  /** The aim CombatSystem would use at this yaw/pitch. */
  function aimOf(yaw, pitch) {
    const combat = Object.create(CombatSystem.prototype);
    const attacker = { pos: { x: 0, y: 0, z: 0 }, facing: { x: 0, y: 0, z: 0 } };
    combat._aimFrom(yaw, pitch, attacker);
    return new THREE.Vector3(attacker.facing.x, attacker.facing.y, attacker.facing.z);
  }

  const cases = [
    ['default resting pitch', 0, 0.25],
    ['level', 0, 0],
    ['looking down hard', 0, 0.9],
    ['looking up', 0, -0.5],
    ['turned right and pitched down', 1.1, 0.4],
    ['turned left and pitched up', -2.2, -0.3],
  ];

  for (const [label, yaw, pitch] of cases) {
    it(`matches the camera's own forward direction — ${label}`, () => {
      const { forward } = rigAt(yaw, pitch);
      const aim = aimOf(yaw, pitch);
      const deg = (Math.acos(Math.min(1, Math.max(-1, aim.dot(forward)))) * 180) / Math.PI;
      expect(deg).toBeLessThan(0.5);
    });
  }

  it('aims BELOW the horizon when the camera looks down, and above when it looks up', () => {
    // The sign, stated in the terms a player would use. `CameraRig.pitch` is an
    // ORBIT angle — positive raises the camera, so positive means looking DOWN.
    expect(aimOf(0, 0.4).y).toBeLessThan(0);
    expect(aimOf(0, -0.4).y).toBeGreaterThan(0);
    expect(aimOf(0, 0).y).toBeCloseTo(0, 9);
  });

  it('leaves the punch wedge its full angular budget at the resting pitch', () => {
    // The user-visible symptom: at rest the aim error consumed half the 60°
    // punch wedge, so any horizontal offset then pushed the target outside it.
    // The laser's 25° cone was smaller than the error outright.
    const { forward } = rigAt(0, 0.25);
    const aim = aimOf(0, 0.25);
    const deg = (Math.acos(Math.min(1, Math.max(-1, aim.dot(forward)))) * 180) / Math.PI;
    expect(deg).toBeLessThan((25 * 0.1)); // well inside even the laser's cone
  });
});

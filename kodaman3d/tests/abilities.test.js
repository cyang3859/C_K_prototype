import { describe, expect, it } from 'vitest';

import {
  ABILITY,
  createAbilityState,
  freeze,
  isReady,
  laser,
  punch,
  tickAbilities,
} from '../src/combat/Abilities.js';
import { COMBAT, HP, createHealth, isFrozen } from '../src/combat/HealthSystem.js';
import { CombatSystem, SPAWNS } from '../src/combat/CombatSystem.js';
import { HERO_HEIGHT_M } from '../src/core/Scale.js';

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

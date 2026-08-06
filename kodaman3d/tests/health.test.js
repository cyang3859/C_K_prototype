import { describe, expect, it } from 'vitest';

import {
  COMBAT,
  HP,
  applyDamage,
  applyFreeze,
  createHealth,
  heal,
  healthFraction,
  isFrozen,
  tickHealth,
} from '../src/combat/HealthSystem.js';

/**
 * health.test.js — Phase 3 step 1, damage resolution.
 *
 * `environment: 'node'`, no WebGL, no Rapier: HealthSystem.js has no scene
 * dependency by design, so these drive the real production path rather than a
 * stand-in.
 *
 * RNG IS ALWAYS INJECTED. Every test that can reach the dodge branch passes an
 * explicit `rng`, so nothing here depends on `Math.random`. `never` and
 * `always` below are the two interesting poles; a test that does not care
 * still passes `never`, because "this test happened not to roll a dodge" is
 * exactly the kind of flake that gets re-run instead of fixed.
 */

/** Never dodges: 0.99 is above DODGE_CHANCE. */
const never = () => 0.99;
/** Always dodges: 0 is below DODGE_CHANCE. */
const always = () => 0;

const enemy = () => createHealth(HP.STANDARD);
const boss = () => createHealth(HP.BOSS, { boss: true });

describe('createHealth', () => {
  it('starts full, alive, and with every timer clear', () => {
    const h = enemy();
    expect(h).toMatchObject({ hp: 3, max: 3, alive: true, boss: false });
    expect([h.invulnFor, h.hitReactFor, h.frozenFor, h.dodgeCooldownFor, h.deathFadeFor]).toEqual([
      0, 0, 0, 0, 0,
    ]);
  });

  it('rejects a non-positive max rather than creating something already dead', () => {
    expect(() => createHealth(0)).toThrow(/max HP must be > 0/);
    expect(() => createHealth(-1)).toThrow(/max HP must be > 0/);
  });
});

describe('applyDamage — the basic ledger', () => {
  it('removes exactly the damage dealt', () => {
    const h = enemy();
    const r = applyDamage(h, 1, { rng: never });
    expect(r).toEqual({ outcome: 'damaged', applied: 1, hp: 2 });
  });

  it('kills when HP reaches zero and never reports negative HP', () => {
    const h = enemy();
    const r = applyDamage(h, COMBAT.LASER_DAMAGE, { rng: never }); // 5 into a 3 HP pool
    expect(r).toEqual({ outcome: 'killed', applied: 3, hp: 0 });
    expect(h.hp).toBe(0);
    expect(h.alive).toBe(false);
  });

  it('reports applied damage capped by remaining HP, not the raw amount', () => {
    const h = enemy();
    applyDamage(h, 2, { rng: never });
    // 1 HP left, hit for 5: the ledger says 1 was applied, not 5.
    expect(applyDamage(h, 5, { rng: never }).applied).toBe(1);
  });

  it('starts the flinch window on every landed hit', () => {
    const h = enemy();
    applyDamage(h, 1, { rng: never });
    expect(h.hitReactFor).toBeCloseTo(COMBAT.HIT_REACT_S);
  });

  it('does not re-kill a corpse', () => {
    const h = enemy();
    applyDamage(h, 99, { rng: never });
    h.deathFadeFor = 0.123; // pretend mid-fade
    const r = applyDamage(h, 99, { rng: never });
    expect(r.outcome).toBe('alreadyDead');
    expect(h.deathFadeFor).toBe(0.123); // fade not restarted
  });

  it('rejects negative damage instead of silently healing', () => {
    expect(() => applyDamage(enemy(), -5)).toThrow(/damage must be >= 0/);
  });

  it('lets a zero-damage hit land, since freeze is delivered that way', () => {
    const h = enemy();
    const r = applyDamage(h, COMBAT.FREEZE_DAMAGE, { rng: never });
    expect(r.outcome).toBe('damaged');
    expect(h.hp).toBe(3);
    expect(h.hitReactFor).toBeGreaterThan(0);
  });
});

describe('applyDamage — invulnerability', () => {
  it('ignores hits entirely while i-frames are up', () => {
    const h = enemy();
    applyDamage(h, 1, { invulnFor: 0.5, rng: never });
    const r = applyDamage(h, 1, { rng: never });
    expect(r).toEqual({ outcome: 'invulnerable', applied: 0, hp: 2 });
  });

  it('accepts hits again once i-frames expire', () => {
    const h = enemy();
    applyDamage(h, 1, { invulnFor: 0.5, rng: never });
    tickHealth(h, 0.5);
    expect(applyDamage(h, 1, { rng: never }).outcome).toBe('damaged');
  });

  it('does NOT burn a dodge on a hit that i-frames already stopped', () => {
    // Order matters: if dodge were tested first, an invulnerable enemy would
    // spend its dodge cooldown on a hit that could never have landed.
    const h = enemy();
    h.invulnFor = 1;
    const r = applyDamage(h, 1, { rng: always });
    expect(r.outcome).toBe('invulnerable');
    expect(h.dodgeCooldownFor).toBe(0);
  });
});

describe('applyDamage — dodge', () => {
  it('sidesteps the hit and takes no damage', () => {
    const h = enemy();
    const r = applyDamage(h, 5, { rng: always });
    expect(r).toEqual({ outcome: 'dodged', applied: 0, hp: 3 });
  });

  it('cannot dodge twice in a row — the cooldown gates it', () => {
    const h = enemy();
    expect(applyDamage(h, 1, { rng: always }).outcome).toBe('dodged');
    expect(applyDamage(h, 1, { rng: always }).outcome).toBe('damaged');
  });

  it('can dodge again once the cooldown elapses', () => {
    const h = enemy();
    applyDamage(h, 1, { rng: always });
    tickHealth(h, COMBAT.DODGE_COOLDOWN_S);
    expect(applyDamage(h, 1, { rng: always }).outcome).toBe('dodged');
  });

  it('bosses never dodge, however the dice fall', () => {
    const h = boss();
    expect(applyDamage(h, 1, { rng: always }).outcome).toBe('damaged');
    expect(h.dodgeCooldownFor).toBe(0);
  });

  it('honours the 28% rate at the boundary in both directions', () => {
    const justUnder = () => COMBAT.DODGE_CHANCE - 1e-9;
    const exactly = () => COMBAT.DODGE_CHANCE;
    expect(applyDamage(enemy(), 1, { rng: justUnder }).outcome).toBe('dodged');
    expect(applyDamage(enemy(), 1, { rng: exactly }).outcome).toBe('damaged');
  });
});

describe('freeze', () => {
  it('is not dodgeable — the ability that shuts down dodging cannot be dodged', () => {
    const h = enemy();
    expect(applyFreeze(h)).toBe(true);
    expect(isFrozen(h)).toBe(true);
  });

  it('disables dodge while it holds, so every follow-up hit lands', () => {
    const h = enemy();
    applyFreeze(h);
    expect(applyDamage(h, 1, { rng: always }).outcome).toBe('damaged');
    expect(applyDamage(h, 1, { rng: always }).outcome).toBe('damaged');
  });

  it('lets dodge return once the freeze expires', () => {
    const h = createHealth(20);
    applyFreeze(h);
    tickHealth(h, COMBAT.FREEZE_DURATION_S);
    expect(isFrozen(h)).toBe(false);
    expect(applyDamage(h, 1, { rng: always }).outcome).toBe('dodged');
  });

  it('refreshes rather than stacking toward a permanent lock', () => {
    const h = enemy();
    applyFreeze(h);
    tickHealth(h, 1.0);
    applyFreeze(h);
    expect(h.frozenFor).toBeCloseTo(COMBAT.FREEZE_DURATION_S);
  });

  it('never takes hold on a corpse, and a kill clears an existing freeze', () => {
    const h = enemy();
    applyFreeze(h);
    applyDamage(h, 99, { rng: never });
    expect(h.frozenFor).toBe(0);
    expect(applyFreeze(h)).toBe(false);
    expect(isFrozen(h)).toBe(false);
  });
});

describe('knockback', () => {
  it('accumulates across hits', () => {
    const h = createHealth(20);
    applyDamage(h, 1, { knock: 1, rng: never });
    applyDamage(h, 1, { knock: 1, rng: never });
    expect(h.knockback).toBeCloseTo(2);
  });

  it('caps in both directions, so a frozen target cannot be shoved forever', () => {
    const h = createHealth(99);
    for (let i = 0; i < 50; i++) applyDamage(h, 0, { knock: 1, rng: never });
    expect(h.knockback).toBeCloseTo(COMBAT.KNOCKBACK_CAP_M);
    for (let i = 0; i < 100; i++) applyDamage(h, 0, { knock: -1, rng: never });
    expect(h.knockback).toBeCloseTo(-COMBAT.KNOCKBACK_CAP_M);
  });

  it('is not decayed by the clock — it is a displacement budget, not a timer', () => {
    const h = createHealth(20);
    applyDamage(h, 1, { knock: 2, rng: never });
    tickHealth(h, 10);
    expect(h.knockback).toBeCloseTo(2);
  });
});

describe('tickHealth', () => {
  it('counts timers down to exactly zero without going negative', () => {
    const h = enemy();
    applyDamage(h, 1, { invulnFor: 0.1, rng: never });
    tickHealth(h, 999);
    expect(h.invulnFor).toBe(0);
    expect(h.hitReactFor).toBe(0);
  });

  it('signals despawn exactly once, on the frame the death fade completes', () => {
    const h = enemy();
    applyDamage(h, 99, { rng: never });
    expect(tickHealth(h, COMBAT.DEATH_FADE_S / 2)).toBe(false);
    expect(tickHealth(h, COMBAT.DEATH_FADE_S / 2)).toBe(true);
    // A caller that keeps polling must not be told to despawn a second time.
    expect(tickHealth(h, 1)).toBe(false);
    expect(tickHealth(h, 1)).toBe(false);
  });

  it('never signals despawn for something still alive', () => {
    const h = enemy();
    expect(tickHealth(h, 10)).toBe(false);
  });

  it('rejects a negative dt rather than running time backwards', () => {
    expect(() => tickHealth(enemy(), -0.016)).toThrow(/dt must be >= 0/);
  });
});

describe('heal', () => {
  it('restores up to max and reports what it actually restored', () => {
    const h = enemy();
    applyDamage(h, 2, { rng: never });
    expect(heal(h, 99)).toBe(2);
    expect(h.hp).toBe(3);
  });

  it('does not resurrect', () => {
    const h = enemy();
    applyDamage(h, 99, { rng: never });
    expect(heal(h, 99)).toBe(0);
    expect(h.alive).toBe(false);
  });

  it('rejects negative healing instead of using it as backdoor damage', () => {
    expect(() => heal(enemy(), -5)).toThrow(/heal must be >= 0/);
  });
});

describe('healthFraction', () => {
  it('reports 1 at full, a real fraction when hurt, and 0 when dead', () => {
    const h = createHealth(10);
    expect(healthFraction(h)).toBe(1);
    applyDamage(h, 5, { rng: never });
    expect(healthFraction(h)).toBeCloseTo(0.5);
    applyDamage(h, 99, { rng: never });
    expect(healthFraction(h)).toBe(0);
  });
});

describe('ported constants match the 2D prototype', () => {
  it('carries the prototype damage values, including the laser the handoff doc gets wrong', () => {
    expect(COMBAT.PUNCH_DAMAGE).toBe(1);
    expect(COMBAT.LASER_DAMAGE).toBe(5); // NOT the 2 in KODAMAN_HANDOFF.md
    expect(COMBAT.FREEZE_DAMAGE).toBe(0);
  });

  it('converts every frame-count duration at 60 fps', () => {
    expect(COMBAT.FREEZE_DURATION_S).toBeCloseTo(2.5); // 150 frames
    expect(COMBAT.HIT_REACT_S).toBeCloseTo(14 / 60);
    expect(COMBAT.DEATH_FADE_S).toBeCloseTo(0.4); // 24 frames
    expect(COMBAT.DODGE_COOLDOWN_S).toBeCloseTo(70 / 60);
  });

  it('scales the knockback cap from 16 px through PX_TO_M', () => {
    expect(COMBAT.KNOCKBACK_CAP_M).toBeCloseTo(3.2);
  });

  it('carries the prototype HP pools', () => {
    expect([HP.STANDARD, HP.BRUTE_ELITE, HP.BOSS, HP.HERO]).toEqual([3, 5, 6, 10]);
  });
});

describe('a laser opening beats a punch opening on a standard enemy', () => {
  it('kills in one hit where punches need three, matching the 2D balance', () => {
    const byLaser = enemy();
    expect(applyDamage(byLaser, COMBAT.LASER_DAMAGE, { rng: never }).outcome).toBe('killed');

    const byPunch = enemy();
    const outcomes = [];
    for (let i = 0; i < 3; i++) {
      outcomes.push(applyDamage(byPunch, COMBAT.PUNCH_DAMAGE, { rng: never }).outcome);
    }
    expect(outcomes).toEqual(['damaged', 'damaged', 'killed']);
  });
});

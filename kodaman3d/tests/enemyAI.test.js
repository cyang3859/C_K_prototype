import { afterEach, describe, expect, it } from 'vitest';

import {
  AI,
  createEnemyAI,
  stepEnemyAI,
  triggerChase,
} from '../src/controllers/EnemyAI.js';
import { HP, applyDamage, applyFreeze, createHealth } from '../src/combat/HealthSystem.js';
import { DEFAULT_TUNING, TUNING } from '../src/config/tuning.js';

/**
 * enemyAI.test.js — Phase 3 step 1, the enemy FSM.
 *
 * `environment: 'node'`: EnemyAI.js decides state and velocity intent and never
 * touches a mesh, so these drive the real production path.
 *
 * TUNING IS GLOBAL AND MUTABLE, so any test that retunes it restores the
 * shipped default afterwards. `tuning.js` keeps `DEFAULT_TUNING` frozen for
 * exactly this reason.
 */

afterEach(() => {
  TUNING.MAX_SPEED = DEFAULT_TUNING.MAX_SPEED;
});

const DT = 1 / 60;
const at = (x, z = 0) => ({ x, z });
const mook = (o) => createEnemyAI({ type: 'brute', home: at(0), halfRange: 10, ...o });
const ctx = (o) => ({ heroPos: at(1000, 1000), heroCarrying: false, civilians: [], ...o });
const speedOf = (r) => Math.hypot(r.intent.x, r.intent.z);

/**
 * Integrate the AI's own intent until it stops moving, and report where it
 * came to rest. The FSM returns a velocity rather than a position, so any
 * assertion about *where* an enemy is trying to get to has to run the loop —
 * a single tick only ever shows a direction.
 */
function settle(ai, start, context, ticks = 2000) {
  const health = createHealth(3);
  const pos = { ...start };
  for (let i = 0; i < ticks; i++) {
    const r = stepEnemyAI(ai, health, pos, context, DT);
    pos.x += r.intent.x * DT;
    pos.z += r.intent.z * DT;
    if (speedOf(r) === 0) break;
  }
  return pos;
}

describe('the cascade runs in the 2D game\'s priority order', () => {
  it('a dead enemy decides nothing else, whatever is happening around it', () => {
    const ai = mook();
    const h = createHealth(HP.STANDARD);
    applyDamage(h, 99, { rng: () => 0.99 });
    ai.chaseFor = 10;
    ai.thrown = true;
    const r = stepEnemyAI(ai, h, at(0), ctx({ heroCarrying: true }), DT);
    expect(r.state).toBe('dead');
    expect(speedOf(r)).toBe(0);
  });

  it('thrown outranks every live behaviour — no snapping back to the patrol lane mid-air', () => {
    const ai = mook();
    ai.thrown = true;
    ai.chaseFor = 10;
    const r = stepEnemyAI(ai, createHealth(3), at(0), ctx({ heroCarrying: true }), DT);
    expect(r.state).toBe('thrown');
    expect(speedOf(r)).toBe(0);
  });

  it('frozen outranks chase, which is the whole reason freeze is worth casting', () => {
    const ai = mook();
    const h = createHealth(3);
    ai.chaseFor = 10;
    applyFreeze(h);
    const r = stepEnemyAI(ai, h, at(0), ctx({ heroCarrying: true }), DT);
    expect(r.state).toBe('frozen');
    expect(speedOf(r)).toBe(0);
  });

  it('chase outranks guarding a civilian standing right next to it', () => {
    const ai = mook();
    ai.chaseFor = 10;
    const r = stepEnemyAI(
      ai,
      createHealth(3),
      at(0),
      ctx({ heroCarrying: true, heroPos: at(50), civilians: [{ pos: at(1) }] }),
      DT
    );
    expect(r.state).toBe('chase');
  });

  it('falls all the way through to patrol when nothing else applies', () => {
    const r = stepEnemyAI(mook(), createHealth(3), at(0), ctx(), DT);
    expect(r.state).toBe('patrol');
  });

  it('rejects a negative dt rather than running time backwards', () => {
    expect(() => stepEnemyAI(mook(), createHealth(3), at(0), ctx(), -DT)).toThrow(/dt must be >= 0/);
  });
});

describe('stagger — the one deliberate deviation from 2D', () => {
  it('a fresh hit suppresses movement, so a landed hit reads as connecting', () => {
    const ai = mook();
    const h = createHealth(3);
    applyDamage(h, 1, { rng: () => 0.99 });
    const r = stepEnemyAI(ai, h, at(0), ctx(), DT);
    expect(r.state).toBe('stagger');
    expect(speedOf(r)).toBe(0);
  });

  it('resumes as soon as the flinch elapses', () => {
    const ai = mook();
    const h = createHealth(3);
    applyDamage(h, 1, { rng: () => 0.99 });
    h.hitReactFor = 0; // flinch over
    expect(stepEnemyAI(ai, h, at(0), ctx(), DT).state).toBe('patrol');
  });
});

describe('patrol', () => {
  it('walks along its axis at the patrol fraction of hero speed', () => {
    const r = stepEnemyAI(mook(), createHealth(3), at(0), ctx(), DT);
    expect(speedOf(r)).toBeCloseTo(AI.PATROL_SPEED_FRAC * TUNING.MAX_SPEED);
    expect(r.intent.z).toBeCloseTo(0);
  });

  it('turns around at each end of the leg', () => {
    const ai = mook({ dir: 1 });
    stepEnemyAI(ai, createHealth(3), at(10), ctx(), DT); // at +halfRange
    expect(ai.dir).toBe(-1);
    stepEnemyAI(ai, createHealth(3), at(-10), ctx(), DT);
    expect(ai.dir).toBe(1);
  });

  it('walks back in after knockback shoves it past its bound', () => {
    // Regression guard: comparing unsigned distance-from-home would treat the
    // overshoot as "still outside" forever and stall the enemy out there.
    const ai = mook({ dir: 1 });
    const r = stepEnemyAI(ai, createHealth(3), at(25), ctx(), DT); // well past +10
    expect(ai.dir).toBe(-1);
    expect(r.intent.x).toBeLessThan(0); // heading home
  });

  it('patrols along an arbitrary axis, not just world X', () => {
    const ai = createEnemyAI({ home: at(0, 0), axis: { x: 0, z: 1 }, halfRange: 10 });
    const r = stepEnemyAI(ai, createHealth(3), at(0, 0), ctx(), DT);
    expect(r.intent.x).toBeCloseTo(0);
    expect(r.intent.z).toBeGreaterThan(0);
  });
});

describe('guard', () => {
  const civ = (x, extra = {}) => ({ pos: at(x), ...extra });

  it('converges on an un-rescued civilian inside the sense radius', () => {
    const r = stepEnemyAI(mook(), createHealth(3), at(0), ctx({ civilians: [civ(20)] }), DT);
    expect(r.state).toBe('guard');
    expect(r.intent.x).toBeGreaterThan(0);
  });

  it('ignores one beyond the sense radius', () => {
    const far = AI.SENSE_RADIUS_M + 1;
    const r = stepEnemyAI(mook(), createHealth(3), at(0), ctx({ civilians: [civ(far)] }), DT);
    expect(r.state).toBe('patrol');
  });

  it('ignores rescued and carried civilians — they are no longer worth guarding', () => {
    const c = ctx({ civilians: [civ(5, { rescued: true }), civ(6, { carried: true })] });
    expect(stepEnemyAI(mook(), createHealth(3), at(0), c, DT).state).toBe('patrol');
  });

  it('picks the nearest of several', () => {
    // Asserted by where it SETTLES, not by this tick's direction: three
    // civilians ahead of the enemy all produce a +x first step, so only the
    // resting place distinguishes which one it chose.
    const c = ctx({ civilians: [civ(30), civ(8), civ(20)] });
    const end = settle(mook({ postSlot: 0 }), at(-20), c);
    // slot 0 posts GUARD_POST_NEAR_M on the -axis side of the nearest (x=8).
    // Within ARRIVE_EPS_M, not exactly on it: the FSM stops pushing once it is
    // close enough, which is the behaviour that keeps guards from jittering.
    const post = 8 - AI.GUARD_POST_NEAR_M;
    expect(Math.abs(end.x - post)).toBeLessThanOrEqual(AI.ARRIVE_EPS_M);
    // and decisively nearer that post than the posts for the other two
    for (const other of [30, 20]) {
      expect(Math.abs(end.x - post)).toBeLessThan(Math.abs(end.x - (other - AI.GUARD_POST_NEAR_M)));
    }
  });

  it('flyers and bosses keep patrolling instead of swarming', () => {
    const c = ctx({ civilians: [civ(5)] });
    expect(stepEnemyAI(mook({ aerial: true }), createHealth(3), at(0), c, DT).state).toBe('patrol');
    expect(stepEnemyAI(mook({ boss: true }), createHealth(6), at(0), c, DT).state).toBe('patrol');
  });

  it('fans guards onto distinct posts so they ring the target rather than stack', () => {
    // Four guards released from the SAME spot must end up in four different
    // places. Checked by settling them, because on the first tick they all
    // simply head toward the civilian at identical speed — the divergence is
    // in where they stop, which is the property that actually matters.
    const c = ctx({ civilians: [civ(0)] });
    const ends = [0, 1, 2, 3].map((postSlot) => settle(mook({ postSlot }), at(-30), c).x);
    expect(new Set(ends.map((x) => x.toFixed(3))).size).toBe(4);
    // alternating sides: slots 0 and 2 land on -x, slots 1 and 3 on +x
    expect(ends[0]).toBeLessThan(0);
    expect(ends[1]).toBeGreaterThan(0);
    // and increasing distance: slot 2 rings wider than slot 0
    expect(Math.abs(ends[2])).toBeGreaterThan(Math.abs(ends[0]));
  });

  it('does not overshoot its post in a single tick', () => {
    const ai = mook({ postSlot: 0 });
    const post = -AI.GUARD_POST_NEAR_M; // slot 0 posts here relative to a civilian at 0
    const r = stepEnemyAI(ai, createHealth(3), at(post - 0.001), ctx({ civilians: [civ(0)] }), DT);
    expect(speedOf(r) * DT).toBeLessThanOrEqual(0.001 + 1e-9);
  });
});

describe('chase', () => {
  it('drives straight at the hero', () => {
    const ai = mook();
    ai.chaseFor = 10;
    const r = stepEnemyAI(ai, createHealth(3), at(0, 0), ctx({ heroCarrying: true, heroPos: at(10, 10) }), DT);
    expect(r.state).toBe('chase');
    expect(r.intent.x).toBeGreaterThan(0);
    expect(r.intent.z).toBeGreaterThan(0);
    expect(speedOf(r)).toBeCloseTo(AI.CHASE_SPEED_FRAC * TUNING.MAX_SPEED);
  });

  it('energy types chase faster than the rest', () => {
    const fast = mook({ type: 'energy' });
    const slow = mook({ type: 'brute' });
    fast.chaseFor = slow.chaseFor = 10;
    const c = ctx({ heroCarrying: true, heroPos: at(50) });
    const a = stepEnemyAI(fast, createHealth(3), at(0), c, DT);
    const b = stepEnemyAI(slow, createHealth(3), at(0), c, DT);
    expect(speedOf(a)).toBeGreaterThan(speedOf(b));
  });

  it('gives up when the chase times out', () => {
    const ai = mook();
    ai.chaseFor = DT;
    const c = ctx({ heroCarrying: true, heroPos: at(50) });
    stepEnemyAI(ai, createHealth(3), at(0), c, DT);
    expect(ai.chaseFor).toBe(0);
    expect(stepEnemyAI(ai, createHealth(3), at(0), c, DT).state).toBe('patrol');
  });

  it('gives up the moment the hero has nothing left to steal', () => {
    const ai = mook();
    ai.chaseFor = AI.CHASE_DURATION_S;
    const r = stepEnemyAI(ai, createHealth(3), at(0), ctx({ heroCarrying: false, heroPos: at(50) }), DT);
    expect(ai.chaseFor).toBe(0);
    expect(r.state).toBe('patrol');
  });

  it('reports contact only once actually within reach', () => {
    const ai = mook();
    ai.chaseFor = 10;
    const near = ctx({ heroCarrying: true, heroPos: at(AI.CONTACT_RANGE_M * 0.5) });
    const far = ctx({ heroCarrying: true, heroPos: at(AI.CONTACT_RANGE_M * 4) });
    expect(stepEnemyAI(ai, createHealth(3), at(0), near, DT).inContact).toBe(true);
    expect(stepEnemyAI(ai, createHealth(3), at(0), far, DT).inContact).toBe(false);
  });

  it('flashes the alert only at the start of the chase', () => {
    const ai = mook();
    ai.chaseFor = 10;
    ai.alertFor = AI.CHASE_ALERT_S;
    const c = ctx({ heroCarrying: true, heroPos: at(50) });
    expect(stepEnemyAI(ai, createHealth(3), at(0), c, DT).alert).toBe(true);
    ai.alertFor = 0;
    expect(stepEnemyAI(ai, createHealth(3), at(0), c, DT).alert).toBe(false);
  });
});

describe('triggerChase', () => {
  const pack = (n) =>
    Array.from({ length: n }, (_, i) => ({
      ai: mook(),
      health: createHealth(3),
      pos: at((i + 1) * 10),
    }));

  it('recruits the nearest enemies first', () => {
    const es = pack(5);
    triggerChase(es, at(0));
    expect(es.slice(0, 3).every((e) => e.ai.chaseFor > 0)).toBe(true);
    expect(es.slice(3).every((e) => e.ai.chaseFor === 0)).toBe(true);
  });

  it('never exceeds the cap, however often the hero grabs someone', () => {
    const es = pack(10);
    triggerChase(es, at(0));
    triggerChase(es, at(100));
    triggerChase(es, at(50));
    expect(es.filter((e) => e.ai.chaseFor > 0).length).toBe(AI.MAX_CHASERS);
  });

  it('counts already-chasing enemies toward the cap', () => {
    const es = pack(5);
    es[4].ai.chaseFor = 5;
    expect(triggerChase(es, at(0))).toBe(AI.MAX_CHASERS - 1);
  });

  it('skips the dead, the boss, the frozen and the airborne', () => {
    const es = pack(4);
    applyDamage(es[0].health, 99, { rng: () => 0.99 });
    es[1].ai.boss = true;
    applyFreeze(es[2].health);
    es[3].ai.thrown = true;
    expect(triggerChase(es, at(0))).toBe(0);
  });

  it('sets both the chase timer and the alert flash', () => {
    const es = pack(1);
    triggerChase(es, at(0));
    expect(es[0].ai.chaseFor).toBeCloseTo(AI.CHASE_DURATION_S);
    expect(es[0].ai.alertFor).toBeCloseTo(AI.CHASE_ALERT_S);
  });
});

describe('speeds track live tuning instead of snapshotting it', () => {
  /**
   * Every movement branch is checked separately and deliberately. An earlier
   * version of this suite only exercised the patrol path, and a mutation that
   * hard-coded the speed inside `chaseSpeed()` passed all of it — each branch
   * reads TUNING on its own line, so covering one proves nothing about the rest.
   */
  const branches = {
    patrol: () => [mook(), ctx()],
    guard: () => [mook(), ctx({ civilians: [{ pos: at(30) }] })],
    chase: () => {
      const ai = mook();
      ai.chaseFor = 10;
      return [ai, ctx({ heroCarrying: true, heroPos: at(500) })];
    },
    'chase (energy)': () => {
      const ai = mook({ type: 'energy' });
      ai.chaseFor = 10;
      return [ai, ctx({ heroCarrying: true, heroPos: at(500) })];
    },
  };

  for (const [name, setup] of Object.entries(branches)) {
    it(`${name} speed scales with live tuning rather than snapshotting it`, () => {
      const [ai1, c1] = setup();
      const before = speedOf(stepEnemyAI(ai1, createHealth(3), at(0), c1, DT));
      expect(before).toBeGreaterThan(0);

      TUNING.MAX_SPEED = DEFAULT_TUNING.MAX_SPEED * 2;
      const [ai2, c2] = setup();
      const after = speedOf(stepEnemyAI(ai2, createHealth(3), at(0), c2, DT));
      expect(after).toBeCloseTo(before * 2);
    });
  }

  it('keeps every enemy slower than the hero, so a chase is always outrunnable', () => {
    for (const frac of [
      AI.PATROL_SPEED_FRAC,
      AI.GUARD_SPEED_FRAC,
      AI.CHASE_SPEED_FRAC,
      AI.CHASE_SPEED_FRAC_ENERGY,
    ]) {
      expect(frac).toBeLessThan(1);
    }
  });
});

describe('ported constants', () => {
  it('converts durations from frames and distances through PX_TO_M', () => {
    expect(AI.CHASE_DURATION_S).toBeCloseTo(20); // 1200 frames
    expect(AI.CHASE_ALERT_S).toBeCloseTo(0.6); // 36 frames
    expect(AI.SENSE_RADIUS_M).toBeCloseTo(72); // 360 px
    expect(AI.MAX_CHASERS).toBe(3);
  });

  it('does NOT convert speed through PX_TO_M — that would give a 100 km/h enemy', () => {
    const naive = 2.3 * 60 * 0.2; // 27.6 m/s, the trap Scale.js warns about
    expect(AI.CHASE_SPEED_FRAC * TUNING.MAX_SPEED).toBeLessThan(naive / 4);
  });
});

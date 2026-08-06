import { COMBAT, isFrozen } from '../combat/HealthSystem.js';
import { TUNING } from '../config/tuning.js';

/**
 * EnemyAI.js — the enemy state machine, as pure decision logic.
 *
 * WHAT THIS FILE DOES AND DOES NOT DO. It decides which state an enemy is in
 * and what horizontal velocity it wants this tick. It does NOT move anything,
 * own a mesh, resolve collision, or know Three.js exists. `Enemy.js` will take
 * the intent this returns, run it through `Collision.js`, and drive a mesh.
 * That split is what lets the whole FSM be tested in `environment: 'node'`,
 * exactly as `Collision.js` and `HealthSystem.js` are.
 *
 * NO RAPIER HERE, EVER. Step 2 of Phase 3 brings Rapier in for thrown-prop
 * momentum; a thrown enemy's *arc* becomes Rapier's problem. The decision that
 * it is airborne and therefore not patrolling stays here.
 *
 * ---------------------------------------------------------------------------
 * THE 2D GAME ALREADY HAD THIS FSM — IT WAS JUST WRITTEN AS `continue`
 * ---------------------------------------------------------------------------
 * `updateEnemies()` (`kodaman_prototype.html:4778-5010`) is a priority cascade:
 * each behaviour checks its condition and `continue`s the loop, so exactly one
 * runs per tick. That is a state machine with the states left implicit. This
 * port makes them explicit and keeps the ORDER identical, because the order is
 * the design:
 *
 *   dead → thrown → dodging → frozen → chase → guard → patrol
 *
 * Get that order wrong and the bugs are subtle rather than loud: a frozen enemy
 * that still chases, or a thrown enemy that snaps back to its patrol lane
 * mid-air.
 *
 * ---------------------------------------------------------------------------
 * SPEEDS ARE FRACTIONS OF HERO SPEED, NOT CONVERTED PIXELS
 * ---------------------------------------------------------------------------
 * ⚠️ Do not port these through `PX_TO_M`. `Scale.js` is explicit that positions
 * convert and physical quantities do not, and speed is the trap: the 2D chase
 * speed of 2.3 px/frame naively converts to 27.6 m/s — a 100 km/h enemy.
 *
 * What actually matters is the RATIO to the hero, because that is what decides
 * whether you can outrun a chase. The 2D hero caps at 5.5 px/frame and the 3D
 * hero at `TUNING.MAX_SPEED`, so every speed here is stored as its fraction of
 * the 2D hero's cap and multiplied by the live 3D cap at call time.
 *
 * Read at CALL time, never destructured at import time — `TUNING` is mutable so
 * lil-gui can retune live, and snapshotting it silently breaks that (see
 * `tuning.js`). The payoff: retuning hero speed automatically preserves the
 * chase relationship instead of quietly making enemies uncatchable.
 */

/** The 2D prototype's hero speed cap, px/frame. The denominator for every ratio below. */
const HERO_2D_SPEED = 5.5;

/** Metres per 2D pixel, for the DISTANCES below — which do convert. */
const PX_TO_M = 0.2;

export const AI = Object.freeze({
  /** Patrol amble: 1.2 px/frame. */
  PATROL_SPEED_FRAC: 1.2 / HERO_2D_SPEED,
  /** Converging on a civilian to guard it: 1.7 px/frame. */
  GUARD_SPEED_FRAC: 1.7 / HERO_2D_SPEED,
  /** Pursuing the hero: 2.3 px/frame. */
  CHASE_SPEED_FRAC: 2.3 / HERO_2D_SPEED,
  /** Energy types are the fast ones: 2.9 px/frame. */
  CHASE_SPEED_FRAC_ENERGY: 2.9 / HERO_2D_SPEED,

  /** Metres. How far an enemy senses an un-rescued civilian. 360 px. */
  SENSE_RADIUS_M: 360 * PX_TO_M,
  /** Metres. Contact range at which a chaser can grab at the hero. */
  CONTACT_RANGE_M: 1.6,

  /** Seconds a chase persists before the enemy gives up. 1200 frames. */
  CHASE_DURATION_S: 1200 / 60,
  /** Seconds of "!" alert flash when a chase begins. 36 frames. */
  CHASE_ALERT_S: 36 / 60,
  /** At most this many enemies chase at once. */
  MAX_CHASERS: 3,

  /** Metres. Guard posts ring the civilian at these offsets: 40 px, then 78 px. */
  GUARD_POST_NEAR_M: 40 * PX_TO_M,
  GUARD_POST_STEP_M: 38 * PX_TO_M,
  /** Metres. Close enough to a target to stop pushing into it. */
  ARRIVE_EPS_M: 0.4,
});

/**
 * ⚠️ THE ONE DELIBERATE BEHAVIOURAL CHANGE FROM THE 2D GAME.
 *
 * In 2D, `hitReact` is a *visual* pain timer only — a flinching enemy keeps
 * walking its patrol. In 3D that reads as unresponsive: you land a hit, the
 * enemy plays a flinch, and strolls on regardless.
 *
 * With this true, a hit suppresses movement and attack for `HIT_REACT_S`
 * (0.23 s), which is what makes a hit feel like it connected.
 *
 * It is a flag rather than a hard-coded change so the user can A/B it against
 * 2D parity and overrule this. Set false for exact 2D behaviour.
 */
export const STAGGER_INTERRUPTS = true;

/**
 * @typedef {'dead'|'thrown'|'stagger'|'frozen'|'chase'|'guard'|'patrol'} EnemyState
 */

/**
 * @typedef {object} EnemyAIState
 * @property {string} type          archetype: brute/genius/energy/warlord/robber
 * @property {boolean} boss
 * @property {boolean} aerial       flyers patrol a Y band and ignore civilians
 * @property {{x:number,z:number}} home    patrol centre, world metres
 * @property {{x:number,z:number}} axis    unit vector the patrol runs along
 * @property {number} halfRange     metres either side of `home`
 * @property {number} dir           +1/-1, which way along `axis` it is walking
 * @property {boolean} thrown
 * @property {number} chaseFor      seconds of chase remaining; 0 = not chasing
 * @property {number} alertFor      seconds of alert flash remaining
 * @property {number} postSlot      stable guard-post index, 0..3
 * @property {EnemyState} state     last decided state, for transition edges
 */

/**
 * @param {object} opts
 * @returns {EnemyAIState}
 */
export function createEnemyAI({
  type = 'brute',
  boss = false,
  aerial = false,
  home = { x: 0, z: 0 },
  axis = { x: 1, z: 0 },
  halfRange = 120 * PX_TO_M,
  dir = 1,
  postSlot = 0,
} = {}) {
  const len = Math.hypot(axis.x, axis.z) || 1;
  return {
    type,
    boss,
    aerial,
    home: { x: home.x, z: home.z },
    axis: { x: axis.x / len, z: axis.z / len },
    halfRange,
    dir: dir >= 0 ? 1 : -1,
    thrown: false,
    chaseFor: 0,
    alertFor: 0,
    postSlot,
    state: 'patrol',
  };
}

/**
 * Decide this tick's state and movement intent.
 *
 * PURE apart from mutating `ai` (its patrol direction, chase timer and last
 * state). It never touches `health`, and never moves anything: the caller owns
 * position and applies `intent` through collision.
 *
 * @param {EnemyAIState} ai
 * @param {import('../combat/HealthSystem.js').Health} health
 * @param {{x:number,z:number}} pos  the enemy's current world position
 * @param {object} ctx
 * @param {{x:number,z:number}} ctx.heroPos
 * @param {boolean} [ctx.heroCarrying]  hero is carrying civilians — sustains chases
 * @param {Array<{pos:{x:number,z:number}, rescued?:boolean, carried?:boolean}>} [ctx.civilians]
 * @param {number} dt seconds
 * @returns {{state: EnemyState, intent: {x:number,z:number}, facing: {x:number,z:number}|null,
 *   inContact: boolean, alert: boolean}}
 */
export function stepEnemyAI(ai, health, pos, ctx, dt) {
  if (dt < 0) throw new Error(`EnemyAI: dt must be >= 0, got ${dt}`);
  const still = (state) => finish(ai, state, ZERO, null, false);

  // ---- the cascade, in the 2D game's order ------------------------------
  if (!health.alive) return still('dead');
  if (ai.thrown) return still('thrown');
  if (STAGGER_INTERRUPTS && health.hitReactFor > 0) return still('stagger');
  if (isFrozen(health)) return still('frozen');

  ai.alertFor = ai.alertFor <= dt ? 0 : ai.alertFor - dt;

  // ---- chase ------------------------------------------------------------
  if (ai.chaseFor > 0) {
    // Two ways a chase ends: it times out, or the hero has nothing left to
    // steal. The 2D game checks both every tick and drops straight back to
    // patrol rather than easing out.
    ai.chaseFor = ctx.heroCarrying === false ? 0 : Math.max(0, ai.chaseFor - dt);
    if (ai.chaseFor > 0) {
      const speed = chaseSpeed(ai);
      const to = delta(pos, ctx.heroPos);
      const d = Math.hypot(to.x, to.z);
      return finish(
        ai,
        'chase',
        d <= AI.ARRIVE_EPS_M ? ZERO : scale(to, speed / d),
        d > 0 ? scale(to, 1 / d) : null,
        d <= AI.CONTACT_RANGE_M
      );
    }
  }

  // ---- guard a civilian -------------------------------------------------
  // Flyers and the boss keep their patrol; only ground mooks converge, which is
  // what makes a rescue feel contested rather than uniformly swarmed.
  if (!ai.boss && !ai.aerial) {
    const target = nearestUnrescued(pos, ctx.civilians);
    if (target) {
      // Fan out into distinct posts so several guards ring the civilian rather
      // than stacking on one spot: alternating sides, increasing distance.
      const side = ai.postSlot % 2 === 0 ? -1 : 1;
      const dist = AI.GUARD_POST_NEAR_M + Math.floor(ai.postSlot / 2) * AI.GUARD_POST_STEP_M;
      const post = {
        x: target.pos.x + ai.axis.x * side * dist,
        z: target.pos.z + ai.axis.z * side * dist,
      };
      const to = delta(pos, post);
      const d = Math.hypot(to.x, to.z);
      const speed = AI.GUARD_SPEED_FRAC * TUNING.MAX_SPEED;
      return finish(
        ai,
        'guard',
        d <= AI.ARRIVE_EPS_M ? ZERO : scale(to, Math.min(speed, d / Math.max(dt, 1e-6)) / d),
        d > 0 ? scale(to, 1 / d) : null,
        false
      );
    }
  }

  // ---- patrol -----------------------------------------------------------
  // Turn at the ends of the leg. Compared against the SIGNED offset along the
  // axis, so an enemy shoved past its bound by knockback turns around and walks
  // back in rather than treating the overshoot as a new home.
  const offset = dot(delta(ai.home, pos), ai.axis);
  if (offset >= ai.halfRange) ai.dir = -1;
  else if (offset <= -ai.halfRange) ai.dir = 1;

  const speed = AI.PATROL_SPEED_FRAC * TUNING.MAX_SPEED;
  const heading = scale(ai.axis, ai.dir);
  return finish(ai, 'patrol', scale(heading, speed), heading, false);
}

/**
 * Start a chase on the nearest eligible enemies, capped at `MAX_CHASERS`.
 *
 * Ported from `triggerChase()` (`:3378`): fired when the hero picks a civilian
 * up. Already-chasing enemies count toward the cap, so repeatedly grabbing
 * civilians does not eventually recruit the whole map.
 *
 * @param {Array<{ai: EnemyAIState, health: import('../combat/HealthSystem.js').Health,
 *   pos: {x:number,z:number}}>} enemies
 * @param {{x:number,z:number}} pickupPos
 * @returns {number} how many chases actually started
 */
export function triggerChase(enemies, pickupPos) {
  const active = enemies.filter((e) => e.health.alive && e.ai.chaseFor > 0).length;
  const needed = AI.MAX_CHASERS - active;
  if (needed <= 0) return 0;

  const eligible = enemies
    .filter(
      (e) => e.health.alive && !e.ai.boss && e.ai.chaseFor <= 0 && !isFrozen(e.health) && !e.ai.thrown
    )
    .map((e) => ({ e, d: Math.hypot(e.pos.x - pickupPos.x, e.pos.z - pickupPos.z) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, needed);

  for (const { e } of eligible) {
    e.ai.chaseFor = AI.CHASE_DURATION_S;
    e.ai.alertFor = AI.CHASE_ALERT_S;
  }
  return eligible.length;
}

/** Chase speed for this archetype, in m/s, read from live tuning. */
function chaseSpeed(ai) {
  const frac = ai.type === 'energy' ? AI.CHASE_SPEED_FRAC_ENERGY : AI.CHASE_SPEED_FRAC;
  return frac * TUNING.MAX_SPEED;
}

function nearestUnrescued(pos, civilians) {
  if (!civilians || civilians.length === 0) return null;
  let best = null;
  let bestD = AI.SENSE_RADIUS_M;
  for (const c of civilians) {
    if (c.rescued || c.carried) continue;
    const d = Math.hypot(c.pos.x - pos.x, c.pos.z - pos.z);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

const ZERO = Object.freeze({ x: 0, z: 0 });
const delta = (from, to) => ({ x: to.x - from.x, z: to.z - from.z });
const scale = (v, k) => ({ x: v.x * k, z: v.z * k });
const dot = (a, b) => a.x * b.x + a.z * b.z;

function finish(ai, state, intent, facing, inContact) {
  ai.state = state;
  return { state, intent, facing, inContact, alert: ai.alertFor > 0 };
}

/** True on the tick an enemy first entered `state`, for one-shot FX and SFX. */
export function justEntered(prevState, result, state) {
  return result.state === state && prevState !== state;
}

/** Damage a thrown enemy deals to whatever it collides with. Prototype `:4805`. */
export const THROWN_CHAIN_DAMAGE = 4;

/** Seconds of i-frames the hero gets after a chaser connects. 55 frames, `:4907`. */
export const HERO_HIT_INVULN_S = 55 / 60;

/** Chance a connecting chaser knocks a carried civilian loose. `:4910`. */
export const CIVILIAN_STEAL_CHANCE = 0.35;

/** Re-export so callers tune one import, not two. */
export { COMBAT };

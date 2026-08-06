import { COMBAT, applyDamage, applyFreeze } from './HealthSystem.js';
import { HERO_HEIGHT_M } from '../core/Scale.js';

/**
 * Abilities.js — punch, laser and freeze, as pure resolution.
 *
 * Given an attacker's pose and a list of candidate targets, decide which are
 * hit and route them through `HealthSystem`. No mesh, no scene, no raycaster,
 * no Rapier — the same discipline as `Collision.js`, `HealthSystem.js` and
 * `EnemyAI.js`, and the reason all of this tests under `environment: 'node'`.
 *
 * VFX ARE NOT HERE AND ARE NOT MISSING. Each result reports what connected and
 * where; the beam, the impact burst and the freeze cone are the renderer's job
 * in Phase 7. Keeping the *decision* separate is what lets combat balance be
 * tested without a canvas.
 *
 * ---------------------------------------------------------------------------
 * THE SCALE TRAP, AGAIN — AND IT BITES DIFFERENTLY HERE THAN IN EnemyAI
 * ---------------------------------------------------------------------------
 * `Scale.js` splits conversions in two: *positions* port through `PX_TO_M`
 * (0.2), *physical dimensions* never do. An ability's reach is a physical
 * dimension of the attacker's body, so `PUNCH_RANGE = 48 px` is NOT 9.6 m —
 * that would be a punch landing from three car-lengths away.
 *
 * The 2D hero is 100 px tall and the 3D hero is `HERO_HEIGHT_M` (1.85 m), so
 * body-relative reaches are stored as **multiples of hero height** and scale
 * with the character rather than with the world:
 *
 *   punch 62 px reach → 0.62 hero-heights → 1.15 m
 *   freeze 110 px     → 1.10 hero-heights → 2.04 m
 *
 * KNOCKBACK IS THE EXCEPTION and does use `PX_TO_M`, because it is a
 * displacement through the world rather than a dimension of a body. That
 * matches `COMBAT.KNOCKBACK_CAP_M`, which ports the same way.
 *
 * ⚠️ Three quantities, three different conversions — reach by body, knockback
 * by world position, speed by ratio-to-hero (`EnemyAI.js`). Getting these
 * confused produces numbers that are wrong by 10x while still looking plausible
 * in source.
 */

/** The 2D prototype's hero height in pixels. Denominator for every reach below. */
const HERO_2D_HEIGHT = 100;
/** Metres per 2D pixel, for knockback only. */
const PX_TO_M = 0.2;

/** Convert a 2D body-relative pixel measurement to metres. */
const reach = (px) => (px / HERO_2D_HEIGHT) * HERO_HEIGHT_M;

export const ABILITY = Object.freeze({
  /**
   * Punch. `PUNCH_RANGE + 14` is the 2D hitbox's real reach — the prototype
   * pads it deliberately ("generous hitbox... not pixel-perfect") so a glancing
   * overlap still connects. That padding is gameplay, not sloppiness, so it
   * ports.
   */
  PUNCH_REACH_M: reach(48 + 14),
  /** Half-width of the punch arc. The 2D box is body-height tall; this is its 3D analogue. */
  PUNCH_HALF_WIDTH_M: reach(30),
  PUNCH_COOLDOWN_S: 18 / 60,
  PUNCH_KNOCKBACK_M: 9 * PX_TO_M,

  /**
   * Laser. Unlimited range in 2D — it acquires the closest living enemy in the
   * facing direction at ANY height, because a side-view game has no third axis
   * to miss along.
   *
   * ⚠️ DELIBERATE 3D CHANGE: an unbounded "anything in front of me" rule would
   * let the hero snipe a target 200 m away that is nowhere near the crosshair.
   * The beam is therefore an angular cone. It is generous (25°) because the 2D
   * feel is a lock-on, not a marksmanship test.
   */
  LASER_HALF_ANGLE_RAD: (25 * Math.PI) / 180,
  LASER_COOLDOWN_S: 60 / 60,
  /** The 2D call passes knock=0: "no knockback while beam is active". */
  LASER_KNOCKBACK_M: 0,

  /** Freeze: a forward box in 2D, drawn as a cone. No damage, pure control. */
  FREEZE_REACH_M: reach(110),
  FREEZE_HALF_WIDTH_M: reach(40),
  FREEZE_COOLDOWN_S: 80 / 60,
});

/**
 * @typedef {object} AbilityState
 * @property {number} punchFor  seconds until punch is ready again
 * @property {number} laserFor
 * @property {number} freezeFor
 * @property {object|null} laserTarget last acquired target, for lock persistence
 */

/** @returns {AbilityState} */
export function createAbilityState() {
  return { punchFor: 0, laserFor: 0, freezeFor: 0, laserTarget: null };
}

/** Advance every cooldown. @param {AbilityState} s @param {number} dt seconds */
export function tickAbilities(s, dt) {
  if (dt < 0) throw new Error(`Abilities: dt must be >= 0, got ${dt}`);
  s.punchFor = s.punchFor <= dt ? 0 : s.punchFor - dt;
  s.laserFor = s.laserFor <= dt ? 0 : s.laserFor - dt;
  s.freezeFor = s.freezeFor <= dt ? 0 : s.freezeFor - dt;
}

/** True if the named ability is off cooldown. */
export function isReady(s, name) {
  return s[`${name}For`] === 0;
}

/**
 * @typedef {object} Attacker
 * @property {{x:number,z:number}} pos
 * @property {{x:number,z:number}} facing unit vector the attacker is looking along
 */

/**
 * @typedef {object} Target
 * @property {{x:number,z:number}} pos
 * @property {import('./HealthSystem.js').Health} health
 */

/**
 * Punch — a short cleave in front of the attacker.
 *
 * HITS EVERY TARGET IN THE ARC, not just the nearest. The 2D punch loops over
 * all enemies overlapping its box, so wading into three mooks and hitting all
 * three is the intended feel, not a bug to fix on the way to 3D.
 *
 * @param {AbilityState} s
 * @param {Attacker} attacker
 * @param {Target[]} targets
 * @param {{rng?: () => number}} [opts]
 * @returns {{fired: boolean, hits: Array<{target: Target, result: object}>}}
 */
export function punch(s, attacker, targets, { rng } = {}) {
  if (!isReady(s, 'punch')) return NOT_FIRED;
  s.punchFor = ABILITY.PUNCH_COOLDOWN_S;

  const hits = [];
  for (const t of targets) {
    if (!t.health.alive) continue;
    if (!inArc(attacker, t.pos, ABILITY.PUNCH_REACH_M, ABILITY.PUNCH_HALF_WIDTH_M)) continue;
    const result = applyDamage(t.health, COMBAT.PUNCH_DAMAGE, {
      knock: ABILITY.PUNCH_KNOCKBACK_M,
      rng,
    });
    hits.push({ target: t, result });
  }
  return { fired: true, hits };
}

/**
 * Laser — hitscan, single target, the nearest living thing inside the cone.
 *
 * LOCK PERSISTENCE. The 2D beam keeps its existing target while that target is
 * alive and still roughly in front, so a strafing enemy does not make the beam
 * flicker between victims mid-burst. That is preserved: `s.laserTarget` is
 * reused when it still qualifies, and only re-acquired when it does not.
 *
 * @returns {{fired: boolean, hits: Array<{target: Target, result: object}>}}
 */
export function laser(s, attacker, targets, { rng } = {}) {
  if (!isReady(s, 'laser')) return NOT_FIRED;
  s.laserFor = ABILITY.LASER_COOLDOWN_S;

  const held = s.laserTarget;
  const keepHeld =
    held && held.health.alive && targets.includes(held) && inCone(attacker, held.pos);
  const target = keepHeld ? held : nearestInCone(attacker, targets);
  s.laserTarget = target;
  if (!target) return { fired: true, hits: [] }; // fired into empty air; cooldown still spent

  const result = applyDamage(target.health, COMBAT.LASER_DAMAGE, {
    knock: ABILITY.LASER_KNOCKBACK_M,
    rng,
  });
  return { fired: true, hits: [{ target, result }] };
}

/**
 * Freeze — a forward cone that stuns and deals no damage.
 *
 * Routed through `applyFreeze`, NOT through `applyDamage` with 0 damage, so it
 * cannot be dodged. The whole point of freeze is disabling dodge; letting it be
 * dodged would make it self-defeating (see `HealthSystem.applyFreeze`).
 *
 * @returns {{fired: boolean, hits: Array<{target: Target, result: object}>}}
 */
export function freeze(s, attacker, targets) {
  if (!isReady(s, 'freeze')) return NOT_FIRED;
  s.freezeFor = ABILITY.FREEZE_COOLDOWN_S;

  const hits = [];
  for (const t of targets) {
    if (!t.health.alive) continue;
    if (!inArc(attacker, t.pos, ABILITY.FREEZE_REACH_M, ABILITY.FREEZE_HALF_WIDTH_M)) continue;
    applyFreeze(t.health);
    hits.push({ target: t, result: { outcome: 'frozen', applied: 0, hp: t.health.hp } });
  }
  return { fired: true, hits };
}

const NOT_FIRED = Object.freeze({ fired: false, hits: Object.freeze([]) });

/**
 * Is `point` inside the attacker's forward box: within `range` ahead and
 * `halfWidth` to either side? A box rather than a wedge because that is the
 * shape the 2D hitbox actually is.
 */
function inArc(attacker, point, range, halfWidth) {
  const { along, lateral } = project(attacker, point);
  return along >= 0 && along <= range && Math.abs(lateral) <= halfWidth;
}

/** Is `point` inside the laser's forward angular cone, at any distance? */
function inCone(attacker, point) {
  const { along, lateral } = project(attacker, point);
  if (along <= 0) return false;
  return Math.atan2(Math.abs(lateral), along) <= ABILITY.LASER_HALF_ANGLE_RAD;
}

function nearestInCone(attacker, targets) {
  let best = null;
  let bestD = Infinity;
  for (const t of targets) {
    if (!t.health.alive || !inCone(attacker, t.pos)) continue;
    const d = Math.hypot(t.pos.x - attacker.pos.x, t.pos.z - attacker.pos.z);
    if (d < bestD) {
      bestD = d;
      best = t;
    }
  }
  return best;
}

/** Decompose the attacker→point offset into forward and sideways components. */
function project(attacker, point) {
  const dx = point.x - attacker.pos.x;
  const dz = point.z - attacker.pos.z;
  const f = attacker.facing;
  return { along: dx * f.x + dz * f.z, lateral: dx * -f.z + dz * f.x };
}

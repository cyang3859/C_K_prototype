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
  /**
   * Half-angle of the punch wedge.
   *
   * ⚠️ A WEDGE, NOT A BOX, AND THAT DISTINCTION IS THE WHOLE ABILITY.
   * The first port used a narrow forward box (±0.55 m lateral). In a side-view
   * game "in front of me" is a one-dimensional question and a box is exactly
   * right; in 3D the player approaches from arbitrary angles, and an enemy
   * standing 0.78 m away — comfortably inside the 1.15 m reach — fell outside
   * the box and every punch missed. Measured in the browser: six consecutive
   * punches at 0.78 m, all misses, which reads to a player as "attacks do
   * nothing".
   *
   * 60° is deliberately forgiving, because the 2D hitbox it ports from says so
   * in its own comment: "Generous hitbox: extends in front AND overlaps the
   * body vertically with padding, so any part of an enemy in front gets hit
   * (not pixel-perfect)." Generosity was the design; the box lost it.
   */
  PUNCH_HALF_ANGLE_RAD: (60 * Math.PI) / 180,
  PUNCH_COOLDOWN_S: 18 / 60,
  /**
   * Seconds the ability's VISIBLE tell lasts.
   *
   * Ported from the 2D game's `*_EFFECT` timers (`:185-187`), which are exactly
   * this: how long the swing, the beam and the cone are drawn. They are shorter
   * than the cooldowns on purpose — the tell ends well before the ability is
   * ready again, so the player reads "that fired" separately from "I can fire
   * again". Kept here rather than in the renderer so the numbers stay beside
   * the cooldowns they are paired with.
   */
  PUNCH_FX_S: 10 / 60,
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
  /**
   * ⚠️ THE LASER IS A HELD BEAM WITH NO COOLDOWN. User decision 2026-08-06.
   *
   * This supersedes the 2D port's one-shot-on-a-1-second-timer, and it is a
   * deliberate design fork rather than a bug fix — see
   * `RESEARCH_MANOFSTEEL_REPO.md` §7e, which found the same shape in a real
   * superhero prototype: `IsPressingLaserEyes` is press-and-HOLD, and the beam
   * sustains while held rather than firing once.
   *
   * A cooldown of 0 does NOT mean unlimited damage: the beam damages on a TICK
   * (`LASER_TICK_S`), so holding it deals damage at a bounded rate. Without the
   * tick, "no cooldown" would resolve a full laser hit every fixed step — 60
   * times a second — and one-shot every enemy in the game instantly.
   */
  LASER_COOLDOWN_S: 0,
  /** Seconds between damage ticks while the beam is held. */
  LASER_TICK_S: 20 / 60,
  LASER_FX_S: 12 / 60,
  /** The 2D call passes knock=0: "no knockback while beam is active". */
  LASER_KNOCKBACK_M: 0,

  /**
   * Freeze: a forward box in 2D, drawn as a cone — so in 3D it simply is one.
   * Wider than the punch, because it is the crowd-control option and a cone the
   * player can see should catch what it visibly covers.
   */
  FREEZE_REACH_M: reach(110),
  FREEZE_HALF_ANGLE_RAD: (45 * Math.PI) / 180,
  FREEZE_COOLDOWN_S: 80 / 60,
  FREEZE_FX_S: 18 / 60,

  /**
   * Hit stop — seconds the whole simulation freezes when a blow CONNECTS
   * (`RESEARCH_MANOFSTEEL_REPO.md` §7b). The cheapest weight in the game: one
   * timer, no art. Without it every hit resolves in a single 16 ms step and the
   * only evidence is a number changing.
   *
   * ⚠️ NOT ON A MISS AND NOT ON A COOLDOWN REFUSAL. Freezing the game when
   * nothing was struck reads as a frame drop, and the tells already distinguish
   * those two cases. Freeze is excluded for the same reason it deals no damage.
   *
   * 4 frames-at-60 for a hit; 8 for a kill, so a finishing blow lands harder
   * than the two that set it up. Both are under the 10-frame punch tell, so the
   * hold ends while the swing is still playing rather than freezing the recovery.
   */
  HIT_STOP_S: 4 / 60,
  KILL_STOP_S: 8 / 60,

  /**
   * Metres BEYOND the punch reach from which a punch will carry the hero to its
   * target (`RESEARCH_MANOFSTEEL_REPO.md` §7a).
   *
   * This is the real answer to the melee whiffing found in playtest, and it is
   * deliberately not the obvious one. The obvious fix is a bigger hitbox, which
   * buys hits that visibly connect with nothing; letting the attack close the
   * last stride instead keeps the reach honest and makes the swing look
   * committed. A patrolling enemy moves ~3 m/s, so a metre of slack is about a
   * third of a second of the player's aim being stale — which is exactly the
   * error being forgiven.
   */
  PUNCH_DASH_M: 1.0,
  /**
   * Fraction of full reach the dash actually stops at.
   *
   * ⚠️ NOT 1.0, AND THE REASON IS NOT TIMIDITY. Stopping exactly on the boundary
   * makes `dist - radius > range` a floating-point coin flip: measured, a dash
   * solved to land precisely on the edge resolved as a MISS, so the attack
   * closed the gap perfectly and then swung at nothing. It also reads better —
   * ending at arm's length rather than at full extension looks like stepping
   * into the blow.
   */
  PUNCH_DASH_STOP_FRAC: 0.9,

  /**
   * Seconds a too-early attack press is remembered and replayed when the
   * ability comes up (`RESEARCH_MANOFSTEEL_REPO.md` §7c, `HasPendingAttack`).
   *
   * ⚠️ WHAT THIS FIXES IS "I PRESSED IT AND NOTHING HAPPENED". Without it a
   * press made during a cooldown is silently discarded, so a player mashing at
   * a combo's natural rhythm loses inputs and the game reads as unresponsive
   * rather than as deliberate. Buffering turns the same press into the next
   * swing.
   *
   * ⚠️ THIS IS MEASURED AGAINST THE COOLDOWN REMAINING AT PRESS TIME, not
   * against how long ago the press happened. Those differ, and the difference
   * broke the first version: aged from the press, a 0.2 s window expires before
   * the 0.3 s punch cooldown clears, so no buffered punch could ever fire and
   * the feature was inert. A press qualifies when the ability is within 0.2 s
   * of being ready.
   *
   * 12 frames-at-60, deliberately short: it forgives a press made slightly too
   * early, and does NOT let a player queue attacks in advance and watch them
   * play out, which inverts who is driving. Pressing during the first 0.1 s of
   * the punch cooldown is still refused outright.
   */
  INPUT_BUFFER_S: 12 / 60,
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
 * @property {{x:number, y?:number, z:number}} pos eye position; `y` defaults to 0
 * @property {{x:number, y?:number, z:number}} facing UNIT vector, aim direction.
 *   Include `y` to aim up or down; omitting it means level.
 */

/**
 * @typedef {object} Target
 * @property {{x:number, y?:number, z:number}} pos centre of mass; `y` defaults to 0
 * @property {import('./HealthSystem.js').Health} health
 * @property {number} [radius] body radius, metres
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
    if (!inWedge(attacker, t.pos, ABILITY.PUNCH_REACH_M, ABILITY.PUNCH_HALF_ANGLE_RAD, radiusOf(t)))
      continue;
    const result = applyDamage(t.health, COMBAT.PUNCH_DAMAGE, {
      knock: ABILITY.PUNCH_KNOCKBACK_M,
      rng,
    });
    hits.push({ target: t, result });
  }
  return { fired: true, hits };
}

/**
 * The target a punch should CARRY THE HERO TO, or null to punch where you stand.
 *
 * Pure, and separate from `punch` on purpose: moving the hero is the scene's
 * business (it has to be swept against the world's colliders first), while
 * *which* target is worth closing on is a rule, and rules are testable without a
 * canvas. `CombatSystem` calls this, does the sweeping, and only then resolves
 * the punch from wherever the hero actually ended up.
 *
 * QUALIFYING IS DELIBERATELY NARROW — this forgives a near miss, it does not
 * grant a lunge:
 *  - already inside reach → null. Nothing to close, and a dash would shove the
 *    hero through a target they were correctly standing next to.
 *  - outside reach + `PUNCH_DASH_M` → null. The attack does not travel.
 *  - outside the punch WEDGE → null. Aim still has to be pointed at them; this
 *    forgives distance, never direction.
 *
 * ⚠️ `gap` AND `travel` ARE DIFFERENT NUMBERS AND BOTH ARE NEEDED. Reach is
 * judged in 3D, but the dash is horizontal (`CombatSystem._dashToTarget`
 * explains why), and the hero's eyes sit ~0.77 m above an enemy's centre of
 * mass even on flat ground. So moving horizontally by the 3D shortfall does not
 * close the 3D distance by that amount — it overshoots. `travel` solves for the
 * horizontal distance that actually puts the target on the edge of reach.
 *
 * @returns {{target: Target, gap: number, travel: number}|null} `gap` is the 3D
 *   surface-to-reach shortfall, which is what qualifies a target; `travel` is
 *   how far to move horizontally to close it.
 */
export function punchDashTarget(attacker, targets) {
  let best = null;
  let bestGap = Infinity;
  let bestTravel = 0;
  for (const t of targets) {
    if (!t.health.alive) continue;
    const { along, lateral } = project(attacker, t.pos);
    const dist = Math.hypot(along, lateral);
    if (dist === 0) continue;
    if (Math.atan2(Math.abs(lateral), along) > ABILITY.PUNCH_HALF_ANGLE_RAD) continue;
    // Surface distance, matching `inWedge`'s convention exactly — a dash judged
    // to the centre would stop a body radius short and whiff anyway.
    const gap = dist - radiusOf(t) - ABILITY.PUNCH_REACH_M;
    if (gap <= 0 || gap > ABILITY.PUNCH_DASH_M) continue;

    // Solve for the horizontal move. `want` is the 3D distance that just touches
    // reach; `dy` is the part of the offset no horizontal move can change.
    const want = (ABILITY.PUNCH_REACH_M + radiusOf(t)) * ABILITY.PUNCH_DASH_STOP_FRAC;
    const dy = (t.pos.y ?? 0) - (attacker.pos.y ?? 0);
    const remaining = want * want - dy * dy;
    // Purely vertical shortfall: the target is within the dash window but so far
    // above or below that no horizontal move brings it into reach. Walking under
    // it and swinging at nothing is worse than not dashing.
    if (remaining <= 0) continue;
    const horizontal = Math.sqrt(Math.max(dist * dist - dy * dy, 0));
    const travel = horizontal - Math.sqrt(remaining);
    if (travel <= 0) continue;

    if (gap < bestGap) {
      bestGap = gap;
      bestTravel = travel;
      best = t;
    }
  }
  return best ? { target: best, gap: bestGap, travel: bestTravel } : null;
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
    if (!inWedge(attacker, t.pos, ABILITY.FREEZE_REACH_M, ABILITY.FREEZE_HALF_ANGLE_RAD, radiusOf(t)))
      continue;
    applyFreeze(t.health);
    hits.push({ target: t, result: { outcome: 'frozen', applied: 0, hp: t.health.hp } });
  }
  return { fired: true, hits };
}

const NOT_FIRED = Object.freeze({ fired: false, hits: Object.freeze([]) });

/**
 * A target's body radius, metres. Targets may declare their own; the default
 * matches `Enemy.js`'s capsule so callers that pass a bare `{pos, health}` — as
 * every unit test does — still get contact-accurate reach.
 */
const DEFAULT_TARGET_RADIUS_M = 0.36;
const radiusOf = (t) => (typeof t.radius === 'number' ? t.radius : DEFAULT_TARGET_RADIUS_M);

/**
 * Is `point` inside the attacker's forward wedge — within `range` and within
 * `halfAngle` of the facing direction?
 *
 * Distance is measured to the point itself rather than along the facing axis,
 * so a target off to one side is not treated as further away than it is. The
 * angular test is what makes a melee arc feel fair in 3D: everything the player
 * can see themselves swinging at is inside it.
 *
 * ⚠️ FULLY 3D, AND IT USED TO NOT BE. Every position and the facing vector were
 * flattened to X/Z, which made altitude invisible to combat: measured, the hero
 * could punch an enemy standing 120 m below, because the only gap that counted
 * was the 1 m horizontal one. The same flattening meant looking down at a target
 * did not aim at it — pitch simply was not part of the calculation.
 */
function inWedge(attacker, point, range, halfAngle, radius = 0) {
  const { along, lateral } = project(attacker, point);
  const dist = Math.hypot(along, lateral);
  // Reach is to the target's SURFACE, not its centre. The 2D hitbox is explicit
  // that "any part of an enemy in front gets hit"; testing the centre alone
  // silently shortens every reach by a body radius and produces misses at
  // distances the player can see are contact.
  if (dist - radius > range) return false;
  if (dist === 0) return true;
  return Math.atan2(Math.abs(lateral), along) <= halfAngle;
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
    const d = Math.hypot(
      t.pos.x - attacker.pos.x,
      (t.pos.y ?? 0) - (attacker.pos.y ?? 0),
      t.pos.z - attacker.pos.z
    );
    if (d < bestD) {
      bestD = d;
      best = t;
    }
  }
  return best;
}

/**
 * Decompose the attacker→point offset into a forward component and the
 * magnitude of everything perpendicular to it.
 *
 * `y` is optional throughout and defaults to 0, so a caller that legitimately
 * works in a plane — every unit test here, and any future top-down mode — still
 * gets exactly the old behaviour.
 */
function project(attacker, point) {
  const f = attacker.facing;
  const fy = f.y ?? 0;
  const dx = point.x - attacker.pos.x;
  const dy = (point.y ?? 0) - (attacker.pos.y ?? 0);
  const dz = point.z - attacker.pos.z;

  const along = dx * f.x + dy * fy + dz * f.z;
  // The rejection of d onto the facing axis: what is left after removing the
  // forward part. Its magnitude is the true off-axis distance in 3D, which is
  // what the wedge's half-angle should be measured against.
  const px = dx - along * f.x;
  const py = dy - along * fy;
  const pz = dz - along * f.z;
  return { along, lateral: Math.hypot(px, py, pz) };
}

/**
 * HealthSystem.js — HP pools, damage resolution, and the timers a hit starts.
 *
 * THE PIECE EVERYTHING ELSE ASSERTS AGAINST. Abilities decide *what* hits and
 * the enemy FSM decides *how it reacts*; this file is the only place that
 * decides whether a hit lands, how much it takes off, and whether that killed
 * anything. Keeping that in one testable function is what stops three abilities
 * growing three subtly different definitions of "dead".
 *
 * NO THREE.JS, NO SCENE, NO RAPIER — and no physics engine is coming here in
 * step 2 either. Rapier arrives in Phase 3 for the *motion* a hit produces
 * (knockback, thrown props); the decision that a hit connects stays pure
 * arithmetic so `environment: 'node'` tests drive the real production path,
 * exactly as `Collision.js` does. If this module ever needs a Mesh or a
 * RigidBody, the design has gone wrong.
 *
 * ---------------------------------------------------------------------------
 * WHERE THE NUMBERS COME FROM
 * ---------------------------------------------------------------------------
 * Ported from `kodaman_prototype.html`'s combat block (`:185-187`) and its
 * `damage()` resolver (`:4078-4100`). The 2D game counts frames at 60 fps; this
 * build is fixed-timestep in SECONDS, so every duration below is `frames / 60`
 * and is written as that division rather than as a decimal, so the provenance
 * survives.
 *
 * ⚠️ `KODAMAN_HANDOFF.md` states laser damage is 2. **It is 5** (`LASER_DMG`,
 * `:186`). That document is independently known to be stale — this is a third
 * confirmed error in it, after its line count and its cape description. The
 * prototype source is the authority.
 *
 * ---------------------------------------------------------------------------
 * THE DODGE ROLL IS WHY THIS TAKES AN RNG
 * ---------------------------------------------------------------------------
 * The 2D resolver gives non-boss enemies a 28% chance to sidestep an incoming
 * attack (`Math.random() < 0.28`), gated on a cooldown and disabled while
 * frozen — which is what makes freeze worth casting. A bare `Math.random()`
 * here would make every damage test either flaky or forced to stub a global,
 * so the RNG is a parameter. `Math.random` stays the default, and tests pass a
 * deterministic one. The repo already prefers seeded hashing over ambient
 * randomness (`hash01` in `facadeAtlas.js`); this follows that.
 */

/** Seconds per frame in the 2D prototype's fixed 60 fps timebase. */
const FRAME = 1 / 60;

/**
 * Combat constants, ported 1:1 from the 2D prototype.
 *
 * Damage values are HP. Durations are seconds. Nothing here is tuned for 3D
 * feel yet — parity first, then the user retunes by feel, which is the same
 * order `tuning.js` documents for locomotion.
 */
export const COMBAT = Object.freeze({
  /** Punch: the cheap, spammable one. `PUNCH_DMG`, prototype `:185`. */
  PUNCH_DAMAGE: 1,
  /** Laser: the committed one, on a 1 s cooldown. `LASER_DMG`, `:186`. */
  LASER_DAMAGE: 5,
  /** Freeze deals NO damage — it is pure control. `:187`. */
  FREEZE_DAMAGE: 0,

  /** How long a freeze holds an enemy. 150 frames. */
  FREEZE_DURATION_S: 150 * FRAME,
  /** Flinch window after a hit lands; drives the pain animation. 14 frames. */
  HIT_REACT_S: 14 * FRAME,
  /** Corpse linger before despawn, for the tumble-fade. 24 frames. */
  DEATH_FADE_S: 24 * FRAME,

  /** Chance a non-boss enemy sidesteps an attack entirely. */
  DODGE_CHANCE: 0.28,
  /** Lockout after a successful dodge, so they cannot chain them. 70 frames. */
  DODGE_COOLDOWN_S: 70 * FRAME,

  /**
   * Metres. Cap on accumulated knockback displacement.
   *
   * The 2D cap is 16 px and `PX_TO_M` is 0.2. Its comment explains the cap
   * exists because freeze disables dodge, so every hit on a frozen enemy lands
   * and the shove stacks into runaway twitching on a target that cannot move
   * away to bleed it off. That reasoning survives the port exactly.
   */
  KNOCKBACK_CAP_M: 16 * 0.2,
});

/** Starting HP by role, prototype `:1646`, `:1666`, `:2408`, `:3324`. */
export const HP = Object.freeze({
  STANDARD: 3, // brute / genius / energy / robber
  BRUTE_ELITE: 5,
  BOSS: 6,
  HERO: 10,
});

/**
 * Why a damage attempt resolved the way it did.
 *
 * A discriminated outcome rather than a bare boolean, because the three
 * failure modes need three different presentations — a dodge spawns a dust
 * puff at the enemy, an i-frame hit shows nothing at all, and a hit on
 * something already dead must not re-trigger a death animation. The 2D code
 * returned `true`/`false` and pushed that distinction out to its callers.
 *
 * @typedef {'damaged' | 'killed' | 'dodged' | 'invulnerable' | 'alreadyDead'} DamageOutcome
 */

/**
 * A damageable thing's mutable combat state.
 *
 * @typedef {object} Health
 * @property {number} hp        current, clamped at 0
 * @property {number} max
 * @property {boolean} alive
 * @property {boolean} boss     bosses never dodge
 * @property {number} invulnFor seconds of remaining i-frames
 * @property {number} hitReactFor seconds of remaining flinch
 * @property {number} frozenFor seconds of remaining freeze
 * @property {number} dodgeCooldownFor seconds until it may dodge again
 * @property {number} deathFadeFor seconds a corpse lingers before despawn
 * @property {number} knockback accumulated metres, signed, capped
 */

/**
 * @param {number} max starting and maximum HP
 * @param {{boss?: boolean}} [opts]
 * @returns {Health}
 */
export function createHealth(max, { boss = false } = {}) {
  if (!(max > 0)) throw new Error(`HealthSystem: max HP must be > 0, got ${max}`);
  return {
    hp: max,
    max,
    alive: true,
    boss,
    invulnFor: 0,
    hitReactFor: 0,
    frozenFor: 0,
    dodgeCooldownFor: 0,
    deathFadeFor: 0,
    knockback: 0,
  };
}

/**
 * Resolve one incoming hit.
 *
 * ORDER OF CHECKS IS LOAD-BEARING and matches the 2D resolver: already-dead,
 * then i-frames, then dodge, then damage. Dodge is tested LAST of the three
 * rejections because it consumes the dodge cooldown — checking it before
 * i-frames would burn a dodge on a hit that could not have landed anyway, and
 * an enemy would appear to dodge while invulnerable.
 *
 * A dodge is only offered to a non-boss that is neither frozen nor on cooldown.
 * Freeze disabling dodge is the whole reason freeze is worth a slot.
 *
 * @param {Health} h        mutated in place
 * @param {number} amount   HP to remove; 0 is legal (freeze) and still lands
 * @param {object} [opts]
 * @param {number} [opts.knock]     signed metres of shove to accumulate
 * @param {number} [opts.invulnFor] i-frames to grant the victim after this hit
 * @param {() => number} [opts.rng] returns [0,1); defaults to `Math.random`
 * @returns {{outcome: DamageOutcome, applied: number, hp: number}}
 */
export function applyDamage(h, amount, { knock = 0, invulnFor = 0, rng = Math.random } = {}) {
  if (amount < 0) throw new Error(`HealthSystem: damage must be >= 0, got ${amount}`);

  if (!h.alive) return { outcome: 'alreadyDead', applied: 0, hp: h.hp };
  if (h.invulnFor > 0) return { outcome: 'invulnerable', applied: 0, hp: h.hp };

  const canDodge = !h.boss && h.frozenFor <= 0 && h.dodgeCooldownFor <= 0;
  if (canDodge && rng() < COMBAT.DODGE_CHANCE) {
    h.dodgeCooldownFor = COMBAT.DODGE_COOLDOWN_S;
    return { outcome: 'dodged', applied: 0, hp: h.hp };
  }

  const applied = Math.min(amount, h.hp);
  h.hp -= applied;
  h.hitReactFor = COMBAT.HIT_REACT_S;
  h.invulnFor = invulnFor;
  h.knockback = clamp(h.knockback + knock, -COMBAT.KNOCKBACK_CAP_M, COMBAT.KNOCKBACK_CAP_M);

  if (h.hp <= 0) {
    h.hp = 0;
    h.alive = false;
    h.deathFadeFor = COMBAT.DEATH_FADE_S;
    h.frozenFor = 0; // a corpse is not frozen; it is a corpse
    return { outcome: 'killed', applied, hp: 0 };
  }
  return { outcome: 'damaged', applied, hp: h.hp };
}

/**
 * Apply a freeze. Separate from `applyDamage` because freeze deals no damage
 * and must NOT be dodgeable — otherwise the ability that exists to shut down
 * dodging could itself be dodged.
 *
 * Refreshes rather than accumulates: re-freezing a frozen enemy resets the
 * timer to full instead of stacking toward a permanent lock.
 *
 * @param {Health} h
 * @param {number} [seconds]
 * @returns {boolean} whether it took effect
 */
export function applyFreeze(h, seconds = COMBAT.FREEZE_DURATION_S) {
  if (!h.alive) return false;
  h.frozenFor = Math.max(h.frozenFor, seconds);
  return true;
}

/**
 * Heal, never above `max`, never a corpse. Resurrection is a content decision,
 * not something a healing number should be able to do by accident.
 *
 * @returns {number} HP actually restored
 */
export function heal(h, amount) {
  if (amount < 0) throw new Error(`HealthSystem: heal must be >= 0, got ${amount}`);
  if (!h.alive) return 0;
  const before = h.hp;
  h.hp = Math.min(h.max, h.hp + amount);
  return h.hp - before;
}

/**
 * Advance every timer by `dt` seconds.
 *
 * Knockback is NOT decayed here. It is a displacement budget that the entity
 * controller consumes as it moves the body, so bleeding it off on a clock
 * would make the same hit shove different distances depending on frame timing.
 * `Enemy.js` zeroes it once spent.
 *
 * @param {Health} h
 * @param {number} dt seconds
 * @returns {boolean} true once a corpse's fade has fully elapsed — the frame on
 *   which the caller should despawn it. False forever after, so a caller that
 *   polls this cannot despawn twice.
 */
export function tickHealth(h, dt) {
  if (dt < 0) throw new Error(`HealthSystem: dt must be >= 0, got ${dt}`);
  h.invulnFor = countdown(h.invulnFor, dt);
  h.hitReactFor = countdown(h.hitReactFor, dt);
  h.dodgeCooldownFor = countdown(h.dodgeCooldownFor, dt);
  if (h.alive) {
    h.frozenFor = countdown(h.frozenFor, dt);
    return false;
  }
  if (h.deathFadeFor === 0) return false; // already reported and despawned
  h.deathFadeFor = countdown(h.deathFadeFor, dt);
  return h.deathFadeFor === 0;
}

/** True while the entity should be held in place by a freeze. */
export function isFrozen(h) {
  return h.alive && h.frozenFor > 0;
}

/** 0..1, for HP bars. A dead entity reads 0. */
export function healthFraction(h) {
  return h.alive ? h.hp / h.max : 0;
}

function countdown(t, dt) {
  return t <= dt ? 0 : t - dt;
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

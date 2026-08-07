import * as THREE from 'three';

import {
  ABILITY,
  createAbilityState,
  freeze,
  isReady,
  laser,
  punch,
  punchDashTarget,
  tickAbilities,
} from './Abilities.js';
import { AttackFX } from './AttackFX.js';
import { Enemy } from '../entities/Enemy.js';
import { HERO_HEIGHT_M, HERO_RADIUS_M, shortestAngleDelta, yawForward } from '../core/Scale.js';

/**
 * CombatSystem.js — owns the live enemies and routes the hero's attacks at them.
 *
 * WHY THIS EXISTS RATHER THAN LIVING IN Game.js. `Game.js` is a coordinator: it
 * runs systems in a documented order and owns none of their internals. Spawning,
 * despawning and hit routing are combat's business, so they live behind one
 * `update(dt, input)` the way locomotion and props already do. The alternative —
 * a growing enemy array plus three ability branches inlined into `fixedStep` —
 * is how that method stops being readable.
 *
 * THE PURE CORE IS STILL PURE. `Abilities`, `HealthSystem` and `EnemyAI` remain
 * free of Three.js; this file and `Enemy.js` are the only places that know both
 * the rules and the scene graph. Balance numbers do not belong here.
 */

/**
 * Metres. How far the starter encounter's enemies stray from their post.
 *
 * The default patrol leg is `120 px → 24 m`, ported from the 2D game where a
 * long lane is correct: that world is a 20,000 px corridor and an enemy walking
 * 24 m is walking on the spot. Here it meant the starter four wandered out of
 * reach before the player arrived — walking 8 m toward the nearest one still
 * left it 8.7 m away, and a punch at that distance is a miss, which reads
 * exactly like "attacks do nothing".
 *
 * A short leg keeps them where they were placed while still visibly moving, so
 * the first encounter is findable. It is a property of THIS encounter, not of
 * the archetype — `AI` keeps the ported default for enemies placed in a real
 * district later.
 */
const STARTER_PATROL_M = 2.5;

/** Metres above the feet an enemy's centre of mass sits. Matches Enemy.js's capsule. */
const ENEMY_CENTRE_Y = 0.85;
/** Metres above the feet the hero's attacks originate — the eyes, not the feet. */
const EYE_HEIGHT_M = 1.62;

/**
 * A starter encounter, in front of the hero's spawn.
 *
 * ⚠️ IN FRONT MEANS DECREASING Z, AND THIS IS EASY TO GET BACKWARDS.
 * The hero spawns at (0, 13) with `facing = 0`, and yaw 0 points along **−Z**
 * (`core/Scale.js`). The camera orbits to `+cos(yaw) * distance`, i.e. it sits
 * BEHIND the hero at higher z looking the same way. So the visible world in
 * front of a freshly-loaded game is `z < 13`.
 *
 * The first version of this list used z = 26–40, which is directly behind the
 * player. Every enemy spawned off-camera, punches hit nothing, and the game
 * looked broken on load. It survived my own browser testing because every probe
 * repositioned the enemies in front of the hero before attacking — the logic was
 * verified and the spawn never was. `spawnsAreInFront` in the tests now pins the
 * direction so this cannot come back silently.
 *
 * Deliberately a handful rather than a horde: a wiring check, not a difficulty
 * design. Kept clear of the building line, and validated at construction — see
 * `validateSpawns`.
 */
export const SPAWNS = Object.freeze([
  { x: -3.5, z: 6, type: 'brute', ai: { halfRange: STARTER_PATROL_M } },
  { x: 3.5, z: 4, type: 'genius', ai: { halfRange: STARTER_PATROL_M } },
  { x: 0, z: 0.5, type: 'energy', ai: { halfRange: STARTER_PATROL_M } },
  { x: -7, z: -2, type: 'robber', ai: { halfRange: STARTER_PATROL_M } },
]);

/** Metres. Hero spawn, mirrored from Game.js so the guard below can be honest. */
const HERO_SPAWN_Z = 13;

/**
 * rad/s the body turns toward the aim direction when attacking.
 *
 * 12 matches `TUNING.YAW_SLERP_RATE`, the rate the locomotion controller already
 * turns the hero at, so an attack turn reads as the same character rather than
 * as a different system yanking the model. A 180° about-face takes ~0.26 s.
 */
const AIM_TURN_RATE = 12.0;

/** Key code -> ability, in the order presses are read each step. */
const ATTACK_KEYS = Object.freeze([
  ['KeyJ', 'punch'],
  // KeyK/laser is deliberately ABSENT: it is a held beam handled separately in
  // `update`, not an edge-triggered press. Leaving it here as well fired it
  // twice on the frame the key went down.
  ['KeyL', 'freeze'],
]);


export class CombatSystem {
  /**
   * @param {object} opts
   * @param {THREE.Scene} opts.scene
   * @param {{position: THREE.Vector3, facing: number}} opts.hero the hero's sim state
   */
  constructor({
    scene,
    hero,
    collision = null,
    cameraRig = null,
    heroEntity = null,
    hitStop = null,
    rng = null,
  }) {
    this.scene = scene;
    /**
     * `(seconds) => void`, freezing the simulation on a connecting blow. A
     * callback rather than a `Time` reference because combat has no business
     * knowing what the clock is — it reports that something landed hard, and the
     * loop decides what that means. Headless rigs pass none.
     */
    this.hitStop = hitStop;
    /**
     * Injected randomness for the dodge roll, or null for `Math.random`.
     *
     * The seam exists for the reason `health.test.js` states: "this run happened
     * not to roll a dodge" is a flake, not a pass. Every pure ability already
     * takes an `rng`; without this the wiring layer was the one place a test
     * could not turn dodges off, and the integration tests below were one
     * unlucky roll away from red.
     */
    this.rng = rng;
    /** The hero's VISUAL, for attack animations. Optional: headless rigs pass none. */
    this.heroEntity = heroEntity;
    this.fx = new AttackFX({ scene });
    this.collision = collision;
    this.hero = hero;
    this.cameraRig = cameraRig;
    this.abilities = createAbilityState();
    /** @type {Enemy[]} */
    this.enemies = [];
    /** Last resolved attack, for the debug HUD. */
    this.lastEvent = '';
    this._forward = new THREE.Vector3();
    /**
     * A press made too early, waiting for its cooldown: `{name, age}` or null.
     *
     * ONE SLOT, NOT A QUEUE — see the note in `update`.
     */
    this._buffered = null;
    /** Aim yaw the body is easing toward, or null. See `_fire`. */
    this._faceTarget = null;
    /** Seconds the laser key has been held, and time until its next damage tick. */
    this._laserHeld = 0;
    this._laserTickIn = 0;
    this._dashDir = new THREE.Vector3();
    this._dashOrigin = new THREE.Vector3();

    for (const p of CombatSystem.validateSpawns(collision)) {
      // Loud, but not fatal: a bad spawn should be obvious in the console
      // rather than crash a playtest build someone is mid-session in.
      console.warn(`CombatSystem: ${p}`);
    }
    for (const s of SPAWNS) this.spawn(s);
  }

  /**
   * Spawn points must be in front of the hero and outside every solid box.
   *
   * Both failure modes have already happened once each in this project and
   * neither raised an error: spawning behind the camera looked like "combat is
   * broken", and standing an entity inside a building footprint got it ejected
   * metres sideways by collision resolution, which looked like "the punch has
   * no reach". Cheap to check, so it is checked.
   *
   * @returns {string[]} human-readable problems; empty when the list is sound
   */
  static validateSpawns(collision, spawns = SPAWNS, heroZ = HERO_SPAWN_Z) {
    const problems = [];
    for (const s of spawns) {
      if (s.z >= heroZ) {
        problems.push(`${s.type} at z=${s.z} is BEHIND the hero (spawn z=${heroZ}, facing -Z)`);
      }
      if (!collision) continue;
      for (const b of collision.boxes) {
        const inside =
          s.x > b.min.x && s.x < b.max.x && s.z > b.min.z && s.z < b.max.z && b.max.y > 0.2;
        if (inside) {
          problems.push(`${s.type} at (${s.x}, ${s.z}) is inside a solid box`);
          break;
        }
      }
    }
    return problems;
  }

  /** @param {{x:number,z:number,type?:string,hp?:number,boss?:boolean}} spec */
  spawn(spec) {
    const e = new Enemy({ scene: this.scene, position: spec, ...spec });
    this.enemies.push(e);
    return e;
  }

  /**
   * Live enemies only, in the shape `Abilities` expects.
   *
   * ⚠️ `pos` CARRIES Y HERE, and `Enemy.pos` deliberately does not. The AI walks
   * on a plane and has no use for altitude, but combat absolutely does — without
   * it the hero could punch a target on the ground from 120 m up, which is
   * exactly what shipped until this was measured. `y` is the enemy's centre of
   * mass, not its feet, so reach is judged to the middle of the body.
   */
  get targets() {
    return this.enemies
      .filter((e) => e.health.alive)
      .map((e) => ({
        pos: { x: e.pos.x, y: ENEMY_CENTRE_Y, z: e.pos.z },
        health: e.health,
        enemy: e,
      }));
  }

  /**
   * One fixed step: resolve any attack this step, then advance every enemy.
   *
   * ATTACKS RESOLVE BEFORE THE FSM RUNS, deliberately. A punch that lands this
   * step should interrupt this step's behaviour, not next step's — resolving
   * after would let a staggered enemy take one more free action, which is
   * precisely the "hits feel weightless" problem the stagger window exists to
   * fix.
   *
   * @param {number} dt
   * @param {import('../core/Input.js').Input} input
   */
  update(dt, input) {
    tickAbilities(this.abilities, dt);

    const p = this.hero.position;
    const heroPos = { x: p.x, z: p.z };
    // Reused scratch: this runs every fixed step, and per-step vector garbage in
    // the combat path is exactly what §D4 warns immediate-mode ports produce.
    yawForward(this.hero.facing, this._forward);
    // Attacks are aimed from the hero's EYES, not their feet, and the aim vector
    // carries pitch — see `_aimFrom`.
    const attacker = {
      pos: { x: p.x, y: p.y + EYE_HEIGHT_M, z: p.z },
      facing: { x: this._forward.x, y: 0, z: this._forward.z },
    };
    // Safety net only — the real gate is at press time, below. Kept so a buffered
    // press can never outlive its ability by an unbounded amount if something
    // later re-extends a cooldown after the press was accepted. The bound is
    // deliberately loose: making it tight enough to be the primary gate is what
    // broke the first version of this.
    if (this._buffered) {
      this._buffered.age += dt;
      if (this._buffered.age > ABILITY.INPUT_BUFFER_S * 4) this._buffered = null;
    }

    // A press either FIRES or is BUFFERED — it is never simply dropped.
    //
    // Each ability is still checked independently rather than collapsing to one
    // intent per step, so pressing two in the same 16 ms step behaves exactly as
    // it always has. Only the refusal path changed.
    for (const [code, name] of ATTACK_KEYS) {
      if (!input.wasPressed(code)) continue;
      if (isReady(this.abilities, name)) {
        this._fire(name, attacker);
        continue;
      }
      // ⚠️ THE WINDOW IS "HOW EARLY WAS THE PRESS", NOT "HOW OLD IS IT NOW".
      // The first version aged the buffer out 0.2 s after the press, which is
      // BEFORE the 0.3 s punch cooldown clears — so a buffered punch could never
      // survive long enough to fire, and the feature did nothing at all. What a
      // player is owed is forgiveness for pressing slightly too EARLY, so the
      // test is against the time still left on the cooldown.
      if (this.abilities[`${name}For`] <= ABILITY.INPUT_BUFFER_S) {
        // Latest press wins: a single slot is the standard shape, because a
        // queue lets a player stack inputs and watch them play out on their own
        // afterwards, which feels like the game is driving rather than them.
        this._buffered = { name, age: 0 };
        this.lastEvent = `${name.toUpperCase()} — buffered`;
      } else {
        // Pressed far too early. Still visibly a no-op, so "not ready" stays
        // distinguishable from "missed" exactly as before.
        this.lastEvent = `${name.toUpperCase()} — on cooldown`;
      }
    }

    // ⚠️ THE LASER IS HELD, NOT PRESSED. User decision 2026-08-06: it sustains
    // while the key is down and has no cooldown (`RESEARCH_MANOFSTEEL_REPO.md`
    // §7e found the same press-and-hold shape in a real superhero prototype).
    //
    // Damage is on a TICK, and that is what keeps "no cooldown" from meaning
    // "kills everything instantly": without it the beam would resolve a full
    // laser hit on every fixed step, 60 times a second. The tick is the rate
    // limit that the cooldown used to be.
    if (input.isDown?.('KeyK')) {
      this._laserHeld += dt;
      if (this._laserTickIn <= 0) {
        this._fire('laser', attacker);
        this._laserTickIn = ABILITY.LASER_TICK_S;
      } else {
        // Still firing: keep the beam drawn even on steps that deal no damage,
        // or a held beam would strobe at the tick rate.
        this._sustainBeam(attacker);
      }
      this._laserTickIn -= dt;
    } else if (this._laserHeld > 0) {
      this._laserHeld = 0;
      this._laserTickIn = 0;
    }

    // The buffered press fires the instant its cooldown clears.
    if (this._buffered && isReady(this.abilities, this._buffered.name)) {
      const name = this._buffered.name;
      this._buffered = null;
      this._fire(name, attacker);
    }

    // Ease the body toward the last aim direction. Rate-limited rather than
    // exponential so the turn has a duration a designer can reason about:
    // TURN_RATE rad/s means a 180° about-face takes ~0.25 s.
    if (this._faceTarget !== null) {
      const delta = shortestAngleDelta(this.hero.facing, this._faceTarget);
      const step = AIM_TURN_RATE * dt;
      if (Math.abs(delta) <= step) {
        this.hero.facing = this._faceTarget;
        this._faceTarget = null;
      } else {
        this.hero.facing += Math.sign(delta) * step;
      }
    }

    this.fx.update(dt);

    const ctx = { heroPos, heroCarrying: false, civilians: [] };
    for (const e of this.enemies) e.update(dt, ctx);

    // Sweep despawned corpses. Backwards so splicing cannot skip an entry.
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      if (!this.enemies[i].despawned) continue;
      this.enemies[i].dispose();
      this.enemies.splice(i, 1);
    }
  }

  /**
   * Write the camera's full 3D aim direction into `attacker.facing`.
   *
   * YAW ALONE IS NOT WHERE THE PLAYER IS LOOKING. The hero's body can only
   * yaw, so `hero.facing` is a single angle — but the CAMERA also pitches, and
   * a player looking down at something on the ground below reasonably expects
   * to hit it. Building the aim vector from yaw AND pitch is what makes
   * "attacks go where I am looking" true rather than "true in the horizontal
   * plane only".
   *
   * The vector is unit-length, which `project()` relies on.
   *
   * ⚠️ THE VERTICAL SIGN IS NEGATED, AND IT SHIPPED WRONG FOR A DAY.
   * `CameraRig.pitch` is an ORBIT angle, not a look angle: `_computeDesired`
   * places the camera at `pivot.y + sin(pitch) * distance`, so a POSITIVE pitch
   * raises the camera and it looks DOWN. The rig's own comment says exactly
   * that. The camera's forward is therefore
   * `(-sin(yaw)·cos(p), −sin(p), -cos(yaw)·cos(p))`, and this used `+sin(p)`.
   *
   * Measured in the browser at the DEFAULT pitch of 0.25 rad: the aim sat
   * **28.65° away from where the camera was actually looking**, always on the
   * wrong side of the horizon. Consequences, and they are not subtle:
   *  - the punch wedge is 60°, so **half the angular budget was gone before the
   *    player aimed at anything**, which is why attacks degraded as soon as a
   *    target moved off-centre horizontally — the two errors add.
   *  - the laser cone is 25°, which the error **exceeds on its own**, so a
   *    ground target centred on screen was outside the cone at any distance.
   *
   * ⚠️ WHY NO TEST CAUGHT IT, which matters more than the sign. The pure tests
   * in `abilities.test.js` build `facing` BY HAND (`y: -sin(a)` for "aiming
   * down") and prove `Abilities` handles a 3D aim correctly — which it does.
   * The defect was never in that layer. It was in this one line translating the
   * rig's convention into that vector, and nothing crossed the boundary between
   * the two modules. The regression test now derives the expected direction
   * from a REAL `CameraRig`'s camera matrix rather than restating this formula,
   * because a test that restates it would have agreed with the bug.
   */
  _aimFrom(yaw, pitch, attacker) {
    const cp = Math.cos(pitch);
    attacker.facing.x = -Math.sin(yaw) * cp;
    attacker.facing.y = -Math.sin(pitch);
    attacker.facing.z = -Math.cos(yaw) * cp;
  }

  /**
   * Fire one ability, from wherever the player is looking RIGHT NOW.
   *
   * ⚠️ THE AIM IS TAKEN AT FIRE TIME, NOT AT PRESS TIME, and for a buffered
   * press those are different moments. Aiming a buffered attack along the
   * direction the camera happened to face when the key went down would swing at
   * where the fight *was* — the same class of bug as attacks following the
   * hero's last walked direction (`1fe7d6a`), just displaced in time instead of
   * in space. A buffered punch is the player saying "hit it as soon as you can",
   * not "hit that spot".
   *
   * @param {'punch'|'laser'|'freeze'} name
   * @param {object} attacker mutated in place with the current aim
   */
  _fire(name, attacker) {
    // ATTACKS AIM WHERE THE CAMERA LOOKS, NOT WHERE THE HERO LAST WALKED.
    // `facing` is written by the locomotion controller from the MOVEMENT
    // direction, so it only changes while moving. Standing still and attacking
    // therefore swung at wherever the last step happened to end — which in
    // testing read as attacks doing nothing, because the player is looking
    // straight at an enemy and the hero is not. Snapping to the camera on the
    // attack frame also makes the hero visibly turn into the blow.
    if (this.cameraRig) {
      // ⚠️ THE BODY TURNS, IT DOES NOT SNAP — and the distinction only became
      // visible once the hero was a rigged human. Snapping `facing` to the
      // camera was invisible on a symmetric capsule, but a player who has
      // orbited the camera round to look at the hero's face sees them whip
      // 180° to face away the instant they press punch. Reported from a
      // playtest as "the axis shifted on the hero".
      //
      // THE AIM IS UNAFFECTED: `attacker.facing` is built from the camera
      // below, independent of the body, so hit registration is identical from
      // the firing step onward. The turn is purely how the hero LOOKS getting
      // there, which is why it can be smoothed at no gameplay cost.
      this._faceTarget = this.cameraRig.yaw;
      this._aimFrom(this.cameraRig.yaw, this.cameraRig.pitch ?? 0, attacker);
    }
    // Re-read the live targets: an earlier fire this same step may have killed
    // one, and a stale list would let the second attack swing at a corpse.
    const targets = this.targets;
    const opts = this.rng ? { rng: this.rng } : undefined;

    if (name === 'punch') {
      // Close the last stride BEFORE resolving, so the punch is judged from
      // where the hero ends up rather than where they started.
      this._dashToTarget(attacker, targets);
      this._resolve('PUNCH', punch(this.abilities, attacker, targets, opts), attacker);
    } else if (name === 'laser') {
      this._resolve('LASER', laser(this.abilities, attacker, targets, opts), attacker);
    } else {
      this._resolve('FREEZE', freeze(this.abilities, attacker, targets, opts), attacker);
    }
  }

  /**
   * Redraw the held beam on a step between damage ticks.
   *
   * Without this the beam is only drawn on the frames it deals damage, so a
   * held laser strobes at the tick rate — which reads as a broken effect rather
   * than a sustained beam. Damage and visibility are deliberately on different
   * clocks: the tick rate-limits the DAMAGE, the beam is continuous.
   */
  _sustainBeam(attacker) {
    const targets = this.targets;
    let best = null;
    let bestD = Infinity;
    for (const t of targets) {
      const dx = t.pos.x - attacker.pos.x;
      const dy = (t.pos.y ?? 0) - (attacker.pos.y ?? 0);
      const dz = t.pos.z - attacker.pos.z;
      const along = dx * attacker.facing.x + dy * attacker.facing.y + dz * attacker.facing.z;
      if (along <= 0) continue;
      const lat = Math.hypot(
        dx - along * attacker.facing.x,
        dy - along * attacker.facing.y,
        dz - along * attacker.facing.z,
      );
      if (Math.atan2(lat, along) > ABILITY.LASER_HALF_ANGLE_RAD) continue;
      const d = Math.hypot(dx, dy, dz);
      if (d < bestD) { bestD = d; best = t; }
    }
    this.fx.showBeam(this.hero.position, attacker.facing, best?.pos ?? null);
  }

  /**
   * Carry the hero the last metre into a punch's target (§7a).
   *
   * ⚠️ THE MOVE IS SWEPT, NOT TELEPORTED. `spherecast` at the hero's own radius
   * stops the dash at the first thing in the way, so closing on an enemy stood
   * against a facade puts the hero against the facade rather than inside it.
   * Teleporting the full gap and letting the next step's `resolve` push out
   * would work most of the time and eject the hero metres sideways the rest —
   * which has already happened once in this project and read as "the punch has
   * no reach".
   *
   * ⚠️ ONLY WHEN THE PUNCH WILL ACTUALLY FIRE. Dashing on a press refused by the
   * cooldown would slide the hero across the ground with no swing, which is both
   * baffling to look at and free mobility on a 0.3 s timer.
   *
   * Mutates `attacker.pos` to match, since the caller resolves against it.
   */
  _dashToTarget(attacker, targets) {
    if (!isReady(this.abilities, 'punch')) return;
    const pick = punchDashTarget(attacker, targets);
    if (!pick) return;

    const p = this.hero.position;
    const d = this._dashDir.set(
      pick.target.pos.x - p.x,
      0,
      pick.target.pos.z - p.z,
    );
    // Horizontal only. The vertical half of the gap is the aim working as
    // intended — a hero hovering above an enemy chose that altitude, and
    // yanking them down to punch it would fight the flight controls.
    if (d.lengthSq() < 1e-8) return;
    d.normalize();

    // Sweep from the capsule's CENTRE, not the feet: a cast at ground level
    // catches every kerb and step the capsule walks over quite happily.
    const origin = this._dashOrigin.set(p.x, p.y + HERO_HEIGHT_M / 2, p.z);
    const clear = this.collision
      ? this.collision.spherecast(origin, d, pick.travel, HERO_RADIUS_M)
      : pick.travel;
    const travel = Math.min(pick.travel, clear);
    if (travel <= 0) return;

    p.x += d.x * travel;
    p.z += d.z * travel;
    attacker.pos.x = p.x;
    attacker.pos.z = p.z;
  }

  /** Turn an ability result into animation, flashes and a HUD line. */
  _resolve(name, result, attacker) {
    if (!result.fired) {
      this.lastEvent = `${name} — on cooldown`;
      return;
    }

    // Fired: play the tell, hit or miss.
    const kind = name.toLowerCase();
    this.heroEntity?.playAttack(kind);
    const pos = this.hero.position;
    if (kind === 'laser') {
      this.fx.showBeam(pos, attacker.facing, result.hits[0]?.target.pos ?? null);
    } else if (kind === 'freeze') {
      this.fx.showCone(pos, this.hero.facing);
    }

    if (result.hits.length === 0) {
      this.lastEvent = `${name} — miss`;
      return;
    }
    const parts = [];
    let connected = false;
    let killed = false;
    for (const { target, result: r } of result.hits) {
      if (r.outcome === 'damaged' || r.outcome === 'killed') {
        target.enemy.flash();
        connected = true;
        killed ||= r.outcome === 'killed';
      }
      parts.push(r.outcome);
    }
    // Hit stop, on a CONNECTING blow only. Freeze excluded: it deals no damage,
    // so it never reaches here with a `damaged` outcome — and a frozen frame is
    // the language of impact, which is not what freeze is saying.
    if (connected && kind !== 'freeze') {
      this.hitStop?.(killed ? ABILITY.KILL_STOP_S : ABILITY.HIT_STOP_S);
    }
    this.lastEvent = `${name} — ${parts.join(', ')}`;
  }

  dispose() {
    for (const e of this.enemies) e.dispose();
    this.enemies.length = 0;
    this.fx.dispose();
  }
}

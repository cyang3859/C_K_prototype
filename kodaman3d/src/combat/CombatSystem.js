import * as THREE from 'three';

import { createAbilityState, freeze, laser, punch, tickAbilities } from './Abilities.js';
import { AttackFX } from './AttackFX.js';
import { Enemy } from '../entities/Enemy.js';
import { yawForward } from '../core/Scale.js';

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


export class CombatSystem {
  /**
   * @param {object} opts
   * @param {THREE.Scene} opts.scene
   * @param {{position: THREE.Vector3, facing: number}} opts.hero the hero's sim state
   */
  constructor({ scene, hero, collision = null, cameraRig = null, heroEntity = null }) {
    this.scene = scene;
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

  /** Live enemies only — the shape `Abilities` expects for its target list. */
  get targets() {
    return this.enemies.filter((e) => e.health.alive).map((e) => ({ pos: e.pos, health: e.health, enemy: e }));
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

    const heroPos = { x: this.hero.position.x, z: this.hero.position.z };
    // Reused scratch: this runs every fixed step, and per-step vector garbage in
    // the combat path is exactly what §D4 warns immediate-mode ports produce.
    yawForward(this.hero.facing, this._forward);
    const attacker = { pos: heroPos, facing: { x: this._forward.x, z: this._forward.z } };
    const targets = this.targets;

    const attacking =
      input.wasPressed('KeyJ') || input.wasPressed('KeyK') || input.wasPressed('KeyL');

    // ATTACKS AIM WHERE THE CAMERA LOOKS, NOT WHERE THE HERO LAST WALKED.
    // `facing` is written by the locomotion controller from the MOVEMENT
    // direction, so it only changes while moving. Standing still and attacking
    // therefore swung at wherever the last step happened to end — which in
    // testing read as attacks doing nothing, because the player is looking
    // straight at an enemy and the hero is not. Snapping to the camera on the
    // attack frame also makes the hero visibly turn into the blow.
    if (attacking && this.cameraRig) {
      this.hero.facing = this.cameraRig.yaw;
      yawForward(this.hero.facing, this._forward);
      attacker.facing = { x: this._forward.x, z: this._forward.z };
    }

    // The tell plays only when the ability actually FIRED, never on the mere
    // keypress — so a press refused by its cooldown is visibly a no-op and the
    // player can tell "not ready" from "missed".
    if (input.wasPressed('KeyJ')) {
      this._resolve('PUNCH', punch(this.abilities, attacker, targets), attacker);
    }
    if (input.wasPressed('KeyK')) {
      this._resolve('LASER', laser(this.abilities, attacker, targets), attacker);
    }
    if (input.wasPressed('KeyL')) {
      this._resolve('FREEZE', freeze(this.abilities, attacker, targets), attacker);
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
    for (const { target, result: r } of result.hits) {
      if (r.outcome === 'damaged' || r.outcome === 'killed') target.enemy.flash();
      parts.push(r.outcome);
    }
    this.lastEvent = `${name} — ${parts.join(', ')}`;
  }

  dispose() {
    for (const e of this.enemies) e.dispose();
    this.enemies.length = 0;
    this.fx.dispose();
  }
}

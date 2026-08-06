import * as THREE from 'three';

import { createAbilityState, freeze, laser, punch, tickAbilities } from './Abilities.js';
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
 * A starter encounter, placed on the annex sidewalk near the hero's spawn at
 * (0, 13) so the first thing a tester can do is walk a few metres and hit
 * something. Deliberately a handful rather than a horde: this is a wiring
 * check, not a difficulty design.
 */
const SPAWNS = Object.freeze([
  { x: -6, z: 26, type: 'brute' },
  { x: 6, z: 30, type: 'genius' },
  { x: 0, z: 36, type: 'energy' },
  { x: -14, z: 40, type: 'robber' },
]);

export class CombatSystem {
  /**
   * @param {object} opts
   * @param {THREE.Scene} opts.scene
   * @param {{position: THREE.Vector3, facing: number}} opts.hero the hero's sim state
   */
  constructor({ scene, hero }) {
    this.scene = scene;
    this.hero = hero;
    this.abilities = createAbilityState();
    /** @type {Enemy[]} */
    this.enemies = [];
    /** Last resolved attack, for the debug HUD. */
    this.lastEvent = '';
    this._forward = new THREE.Vector3();

    for (const s of SPAWNS) this.spawn(s);
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

    if (input.wasPressed('KeyJ')) this._resolve('PUNCH', punch(this.abilities, attacker, targets));
    if (input.wasPressed('KeyK')) this._resolve('LASER', laser(this.abilities, attacker, targets));
    if (input.wasPressed('KeyL')) this._resolve('FREEZE', freeze(this.abilities, attacker, targets));

    const ctx = { heroPos, heroCarrying: false, civilians: [] };
    for (const e of this.enemies) e.update(dt, ctx);

    // Sweep despawned corpses. Backwards so splicing cannot skip an entry.
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      if (!this.enemies[i].despawned) continue;
      this.enemies[i].dispose();
      this.enemies.splice(i, 1);
    }
  }

  /** Turn an ability result into flashes and a HUD line. */
  _resolve(name, result) {
    if (!result.fired) {
      this.lastEvent = `${name} — on cooldown`;
      return;
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
  }
}

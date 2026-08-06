import * as THREE from 'three';

import { createEnemyAI, stepEnemyAI } from '../controllers/EnemyAI.js';
import { createHealth, tickHealth } from '../combat/HealthSystem.js';
import { HP } from '../combat/HealthSystem.js';
import { disposeObject3D } from '../core/dispose.js';

/**
 * Enemy.js — the primitive-built enemy mesh, and the seam onto its logic.
 *
 * NO NAMES, same rule as `Hero.js`. These are archetypes — `brute`, `genius`,
 * `energy` — which `RESEARCH_FINDINGS.md` §C4 clears as generic descriptors
 * rather than protected marks. Do not give one a proper noun; the named
 * villains are Phase 6 content and gated on the approved mapping table.
 *
 * PRIMITIVES ONLY, as in Hero.js: capsules and boxes, no external assets, no
 * skeletal animation. Phase 5 brings authored characters.
 *
 * SEPARATION OF CONCERNS — the point of this file.
 * `EnemyAI` decides state and desired velocity. `HealthSystem` decides what a
 * hit does. NEITHER knows this class exists, which is why both are testable
 * with no WebGL. This class is the only thing that knows both, and its job is
 * exactly: run them, move a transform, and show the result.
 *
 *   ai + health  →  Enemy  →  scene graph
 *
 * Nothing here writes game rules. If a balance number appears in this file, it
 * is in the wrong place — it belongs in `COMBAT` or `AI`.
 */

/** Metres. Enemies are shorter and squatter than the 1.85 m hero. */
const BODY = Object.freeze({
  HEIGHT: 1.7,
  RADIUS: 0.36,
  HEAD: 0.34,
});

/** Per-archetype look. Purely cosmetic — behaviour differences live in `AI`. */
const LOOK = Object.freeze({
  brute: { color: 0x8c3b2f, scale: 1.15 },
  genius: { color: 0x2f6d4f, scale: 0.95 },
  energy: { color: 0x4a3f8c, scale: 1.0 },
  robber: { color: 0x38383f, scale: 1.0 },
  warlord: { color: 0x6b6b73, scale: 1.45 },
});

export class Enemy {
  /**
   * @param {object} opts
   * @param {THREE.Scene|THREE.Object3D} opts.scene
   * @param {{x:number,z:number}} opts.position
   * @param {string} [opts.type]
   * @param {number} [opts.hp]
   * @param {boolean} [opts.boss]
   * @param {object} [opts.ai] extra `createEnemyAI` options
   */
  constructor({ scene, position, type = 'brute', hp, boss = false, ai = {} }) {
    this.type = type;
    this.scene = scene;
    this.pos = { x: position.x, z: position.z };

    this.health = createHealth(hp ?? (boss ? HP.BOSS : HP.STANDARD), { boss });
    this.ai = createEnemyAI({
      type,
      boss,
      home: { x: position.x, z: position.z },
      ...ai,
    });

    /** Set by the owner when this enemy should be removed from the scene. */
    this.despawned = false;
    this._flashFor = 0;
    this._yaw = 0;

    const look = LOOK[type] ?? LOOK.brute;
    this.group = new THREE.Group();
    this.group.name = `enemy:${type}`;
    this.group.position.set(position.x, 0, position.z);
    this.group.scale.setScalar(look.scale);

    this.material = new THREE.MeshStandardMaterial({
      color: look.color,
      roughness: 0.7,
      metalness: 0.05,
    });
    // Transparent from birth: switching a material to transparent later forces a
    // shader recompile mid-fight, which is a visible hitch at exactly the wrong
    // moment. Costs nothing while opacity stays 1.
    this.material.transparent = true;

    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(BODY.RADIUS, BODY.HEIGHT - BODY.RADIUS * 2, 4, 10),
      this.material
    );
    body.position.y = BODY.HEIGHT / 2;
    body.castShadow = true;

    const head = new THREE.Mesh(new THREE.BoxGeometry(BODY.HEAD, BODY.HEAD, BODY.HEAD), this.material);
    head.position.y = BODY.HEIGHT + BODY.HEAD * 0.35;
    head.castShadow = true;

    this.group.add(body, head);
    scene.add(this.group);
  }

  /** World position as a fresh vector, for callers that want one. */
  get position() {
    return new THREE.Vector3(this.pos.x, 0, this.pos.z);
  }

  /**
   * One fixed step.
   *
   * ORDER MATTERS, for the same reason it does in `Game.js`: the AI decides
   * against the state as it stands at the top of the step, then timers advance.
   * Ticking health first would let a stagger expire before the AI ever saw it,
   * and hits would silently stop interrupting.
   *
   * @param {number} dt seconds
   * @param {object} ctx forwarded to the FSM: heroPos, heroCarrying, civilians
   */
  update(dt, ctx) {
    const before = this.health.alive;
    const r = stepEnemyAI(this.ai, this.health, this.pos, ctx, dt);

    this.pos.x += r.intent.x * dt;
    this.pos.z += r.intent.z * dt;

    // Spend accumulated knockback as displacement, then clear it. HealthSystem
    // deliberately does not decay it on a clock — see its `tickHealth` note.
    if (this.health.knockback !== 0) {
      const f = r.facing ?? { x: 1, z: 0 };
      this.pos.x += f.x * this.health.knockback;
      this.pos.z += f.z * this.health.knockback;
      this.health.knockback = 0;
    }

    if (r.facing) this._yaw = Math.atan2(r.facing.x, r.facing.z);

    const finished = tickHealth(this.health, dt);
    if (finished) this.despawned = true;
    if (before && !this.health.alive) this._flashFor = 0;

    this._flashFor = this._flashFor <= dt ? 0 : this._flashFor - dt;
    this.syncTransform();
    return r;
  }

  /** Flash white on a landed hit. Called by whoever resolved the damage. */
  flash(seconds = 0.1) {
    this._flashFor = seconds;
  }

  /** Copy simulation state onto the scene graph. Nothing here writes back. */
  syncTransform() {
    this.group.position.set(this.pos.x, 0, this.pos.z);
    this.group.rotation.y = this._yaw;

    if (!this.health.alive) {
      // Tumble and sink as the corpse fades, so a kill reads even when it
      // happens off to the side of the screen.
      const t = 1 - this.health.deathFadeFor / Math.max(this.health.deathFadeFor + 1e-6, 0.4);
      this.material.opacity = Math.max(0, this.health.deathFadeFor / 0.4);
      this.group.rotation.z = t * 1.4;
      this.group.position.y = -t * 0.5;
      return;
    }

    this.material.opacity = 1;
    this.group.rotation.z = 0;

    // Frozen reads blue, a fresh hit reads white, otherwise the archetype colour.
    const look = LOOK[this.type] ?? LOOK.brute;
    if (this.health.frozenFor > 0) this.material.color.setHex(0x6fb7ff);
    else if (this._flashFor > 0) this.material.color.setHex(0xffffff);
    else this.material.color.setHex(look.color);
  }

  dispose() {
    this.scene.remove(this.group);
    disposeObject3D(this.group);
  }
}

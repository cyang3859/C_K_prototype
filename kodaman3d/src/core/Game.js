import * as THREE from 'three';

import { CameraRig } from '../controllers/CameraRig.js';
import { CollisionWorld } from '../world/Collision.js';
import { DISTRICTS } from '../world/districts.js';
import { DebugHud } from '../ui/DebugHud.js';
import { District } from '../world/District.js';
import { Hero } from '../entities/Hero.js';
import { Input } from './Input.js';
import { LocomotionController } from '../controllers/LocomotionController.js';
import { Renderer } from './Renderer.js';
import { Sky } from '../world/Sky.js';
import { StreetBlock } from '../world/StreetBlock.js';
import { TUNING } from '../config/tuning.js';
import { Time } from './Time.js';
import { disposeObject3D } from './dispose.js';

/**
 * Game.js — owns every system and runs the fixed-timestep loop.
 *
 * THE LOOP (brief §5)
 * -------------------
 * A fixed-timestep accumulator, required rather than preferred: the tuning
 * constants are per-frame-at-60-Hz values converted to per-second rates, so a
 * variable timestep would make flight feel different on a 144 Hz monitor than a
 * 60 Hz one. It also makes the FSM deterministic, which is what makes the unit
 * tests meaningful. The accumulator arithmetic lives in core/Time.js; this class
 * drives it.
 *
 * ORDER WITHIN A FIXED STEP IS LOAD-BEARING — DO NOT REORDER:
 *
 *   1. input.beginStep()      refresh the derived input snapshot
 *   2. locomotion.update()    reads input, writes the hero transform
 *   3. world.update()         static in Phase 1; present so the shape is right
 *   4. cameraRig.update()     reads the hero's FINAL transform for this step
 *   5. input.endStep()        clear this-step edge flags
 *
 * The camera MUST update after locomotion within the SAME step. Updating it
 * first — or deferring it to the render phase — makes the camera trail the hero
 * by one frame and the entire game reads as soft and laggy. This is the single
 * most common way a third-person camera is quietly ruined.
 *
 * ONCE PER RENDERED FRAME (not per fixed step, since one frame may run 0, 1 or
 * several steps): debugHud.update(), then renderer.render().
 */

/** Simulation step, seconds. Do not change — the tuning assumes 60 Hz. */
export const FIXED_DT = 1 / 60;
/** Spiral-of-death guard: maximum catch-up steps in a single frame. */
export const MAX_STEPS = 5;

export class Game {
  /**
   * @param {object} [options]
   * @param {HTMLElement} [options.container]
   */
  constructor({ container = document.body } = {}) {
    this.container = container;
    this.running = false;
    this._raf = 0;
    this._tick = this._tick.bind(this);
    this._onFocus = this._onFocus.bind(this);
  }

  /**
   * Build the world.
   *
   * Async even though Phase 1 loads nothing: `await game.init()` is the seam
   * where Phase 2's chunk data and Phase 5's glTF characters will be awaited,
   * and retrofitting an async boundary into a running loop later is worse than
   * having a trivially-resolving one now.
   */
  async init() {
    this.renderer = new Renderer({ container: this.container });
    this.scene = new THREE.Scene();
    this.scene.name = 'world';

    this.time = new Time({ fixedDt: FIXED_DT, maxSteps: MAX_STEPS });

    // Static midday lighting, fog and background.
    // The renderer is handed over so Sky can bake its PMREM environment map;
    // that is the only thing it uses it for, and it is optional (unit tests
    // construct Sky without one, having no GL context).
    this.sky = new Sky(this.scene, this.renderer.renderer);

    // The collision world is created BEFORE the street block, because the block
    // registers its building AABBs into it as it builds them. One box list,
    // shared by the hero's capsule resolution and the camera's arm raycast.
    this.collision = new CollisionWorld({ halfExtent: TUNING.PLAYABLE_HALF_EXTENT });
    this.world = new StreetBlock({ scene: this.scene, collision: this.collision });

    // Phase 2's two districts, built statically alongside Phase 1's block. They
    // register into the SAME collision world, and for the same reason it is
    // created first. No streaming, no chunk loading, no LOD — a district is
    // built once and stays resident, which is all this phase's scope needs.
    this.districts = DISTRICTS.map(
      (spec) => new District({ scene: this.scene, collision: this.collision, spec }),
    );

    // Spawn on the sidewalk, clear of every building footprint, facing the
    // boulevard so the first thing the player sees is the street.
    this.hero = new Hero({ scene: this.scene, position: new THREE.Vector3(0, 0, 13) });

    this.locomotion = new LocomotionController({
      hero: this.hero.state,
      collision: this.collision,
      tuning: TUNING,
    });

    this.cameraRig = new CameraRig({
      camera: this.renderer.camera,
      hero: this.hero.state,
      collision: this.collision,
      tuning: TUNING,
    });

    this.input = new Input({ element: this.renderer.domElement });
    this.input.attach();
    this.input.onPointerLockChange = (locked) => {
      const hint = document.getElementById('lock-hint');
      if (hint) hint.style.display = locked ? 'none' : '';
    };

    this.debugHud = new DebugHud({
      renderer: this.renderer,
      time: this.time,
      hero: this.hero.state,
      cameraRig: this.cameraRig,
    });

    // Refocusing after an alt-tab must not produce a burst of catch-up steps.
    // Input.js already clears held keys on blur (criterion 27); this clears the
    // clock so the two halves of that guarantee are in one place conceptually.
    window.addEventListener('focus', this._onFocus);

    return this;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.time.resetBaseline();
    this._raf = requestAnimationFrame(this._tick);
  }

  stop() {
    this.running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = 0;
  }

  /**
   * @param {number} nowMs requestAnimationFrame timestamp
   */
  _tick(nowMs) {
    if (!this.running) return;
    this._raf = requestAnimationFrame(this._tick);

    this.debugHud.beginFrame();

    // Time.beginFrame() clamps the raw delta, fills the accumulator and reports
    // how many fixed steps are owed, applying both guards described in Time.js.
    const steps = this.time.beginFrame(nowMs);
    for (let i = 0; i < steps; i++) {
      this.fixedStep(FIXED_DT);
    }

    this.render(this.time.alpha);
    this.debugHud.endFrame();
  }

  /**
   * One simulation step. See the ordering note in this class's doc comment.
   * @param {number} dt always FIXED_DT
   */
  fixedStep(dt) {
    const input = this.input;

    // 1. Refresh the derived input snapshot from raw key state.
    input.beginStep();

    // Non-movement input is handled here rather than in the controller, so the
    // controller stays a pure movement machine.
    if (input.personaPressed) this.hero.togglePersona();
    if (input.debugPressed) this.debugHud.toggle();

    // 2. Locomotion: reads input, writes the hero's transform for this step.
    this.locomotion.update(dt, input, this.cameraRig.yaw);
    this.hero.syncTransform();
    this.hero.update(dt);

    // 3. World. Static in Phase 1; the call exists so the step has its final
    //    shape for Phase 2's time-of-day and streaming work.
    this.world.update(dt);
    for (const district of this.districts) district.update(dt);
    this.sky.update(dt);

    // 4. Camera, AFTER locomotion, reading the hero's final transform.
    this.cameraRig.update(dt, input);

    // 5. Clear this-step edge flags and consume the accumulated mouse deltas.
    input.endStep();
  }

  /**
   * @param {number} _alpha leftover accumulator fraction in [0, 1).
   *
   * Phase 1 does not interpolate: the hero and camera already update every
   * fixed step at 60 Hz, which is imperceptible from per-frame interpolation at
   * this slice's motion speeds. `alpha` is threaded through so the seam exists
   * for later phases without a refactor of the loop.
   */
  render(_alpha) {
    this.debugHud.update();
    this.renderer.render(this.scene);
  }

  _onFocus() {
    // Re-baseline the clock so the frame after a long blur is an ordinary frame.
    this.time.resetBaseline();
    this.input.clearAll();
  }

  /**
   * Tear everything down and free GPU resources.
   *
   * NOT COSMETIC. Vite's HMR re-evaluates modules on every source save; without
   * this, an afternoon of `npm run dev` leaks a full scene's worth of geometries
   * and textures per save, which shows up directly in `renderer.info.memory` —
   * the same counters acceptance criterion 28 reads. main.js wires this to the
   * HMR dispose hook.
   *
   * Order matters: owners dispose their own tracked resources (StreetBlock holds
   * CanvasTextures that scene-graph traversal alone would miss), then the scene
   * is swept, then the renderer releases the WebGL context last.
   */
  destroy() {
    this.stop();
    window.removeEventListener('focus', this._onFocus);

    if (this.input) this.input.detach();
    if (this.debugHud) this.debugHud.dispose();
    if (this.hero) this.hero.dispose();
    if (this.world) this.world.dispose();
    if (this.districts) for (const d of this.districts) d.dispose();
    if (this.sky) this.sky.dispose();
    if (this.scene) disposeObject3D(this.scene);
    if (this.renderer) this.renderer.dispose();
  }
}

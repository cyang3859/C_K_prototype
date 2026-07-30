import * as THREE from 'three';

import { HERO_HEIGHT_M } from '../core/Scale.js';
import { disposeObject3D } from '../core/dispose.js';
import { LocomotionState, createHeroState } from '../controllers/LocomotionController.js';

/**
 * Hero.js — the primitive-built hero mesh and its CPU-animated cape.
 *
 * NO NAMES. This is "the hero". Do not introduce a proper noun for this
 * character, or for any company or location, anywhere in this project —
 * including an invented placeholder. That naming exercise is explicitly blocked
 * pending user sign-off on a separate trademark mapping table and is not this
 * code's decision to make.
 *
 * PRIMITIVES ONLY, DELIBERATELY (brief §9.4 / §13):
 * boxes, capsules and spheres, zero external assets. No GLTFLoader, no glTF
 * file, no skeletal animation, no AnimationMixer, no cloth simulation. Authored
 * characters arrive in Phase 5. The cape is a CPU sine wobble written straight
 * into the position attribute — no vertex shader, and no physical solver.
 *
 * SEPARATION OF CONCERNS
 * ----------------------
 * This class owns the *visual*. `LocomotionController` owns the *simulation* and
 * mutates the plain `state` object below. Every frame, `syncTransform()` copies
 * simulation state onto the scene graph. Nothing in the controller reaches into
 * the mesh, and nothing here writes back into the simulation. That is what keeps
 * the controller unit-testable with no WebGL, and it is worth defending.
 *
 * HIERARCHY (each limb in its own named sub-group so Phase 5 can bind bones to
 * these joints without restructuring anything):
 *
 *   group            — feet at the origin; yaw applied here
 *     bodyPivot      — hip height; flight pitch applied here
 *       torso, head
 *       armLeft/armRight   — pivot AT THE SHOULDER, mesh offset below it
 *       legLeft/legRight   — pivot AT THE HIP, mesh offset below it
 *       capeAnchor   — pivot at the shoulders
 *         cape
 */

/** Vertical layout, metres above the feet. Sums to roughly HERO_HEIGHT_M. */
const RIG = Object.freeze({
  HIP_Y: 0.68,
  TORSO_Y: 1.18,
  HEAD_Y: 1.72,
  SHOULDER_Y: 1.6,
  SHOULDER_X: 0.34,
  HIP_X: 0.15,
  LIMB_DROP: 0.34, // half of a 0.68 m limb capsule: mesh offset below its joint
  CAPE_Y: 1.66,
  CAPE_Z: 0.14, // behind the hero: facing is -Z, so "behind" is +Z
});

/** Material colours per persona. Colours ONLY — see `setPersona`. */
const PERSONA_COLORS = Object.freeze({
  super: {
    suit: 0x3a6fd9, // primary blue
    accent: 0xc0392b, // red cape / trunks
    skin: 0xe0b48c,
  },
  civilian: {
    suit: 0x4a5058, // muted jacket
    accent: 0x6b5a48, // muted long-coat tone
    skin: 0xe0b48c,
  },
});

export class Hero {
  /**
   * @param {object} args
   * @param {THREE.Scene} args.scene
   * @param {THREE.Vector3} [args.position] starting feet position
   */
  constructor({ scene, position = new THREE.Vector3(0, 0, 30) }) {
    this.scene = scene;

    /**
     * The simulation state the locomotion controller mutates. Created here so
     * there is exactly one hero-state object in the running game, but defined in
     * LocomotionController.js so tests can build one without touching Three.js.
     */
    this.state = createHeroState({ position });

    this.group = new THREE.Group();
    this.group.name = 'hero';
    this.group.position.copy(this.state.position);

    // Shared materials. Three of them, reused across every part, which is what
    // makes a persona swap a three-line colour write rather than a mesh rebuild.
    this.materials = {
      suit: new THREE.MeshStandardMaterial({ color: 0x3a6fd9, roughness: 0.6, metalness: 0.05 }),
      accent: new THREE.MeshStandardMaterial({
        color: 0xc0392b,
        roughness: 0.7,
        side: THREE.DoubleSide,
      }),
      skin: new THREE.MeshStandardMaterial({ color: 0xe0b48c, roughness: 0.75 }),
    };

    this.bodyPivot = new THREE.Group();
    this.bodyPivot.name = 'bodyPivot';
    this.bodyPivot.position.y = RIG.HIP_Y;
    this.group.add(this.bodyPivot);

    this._buildBody();
    this._buildLimbs();
    this._buildCape();

    scene.add(this.group);

    // Animation phase accumulators. Kept on the instance rather than derived
    // from absolute time so that pausing (or a Phase 2 time-scale) does not
    // teleport the cape.
    this._capePhase = 0;
    this._stridePhase = 0;

    this.setPersona('super');
  }

  // ------------------------------------------------------------------- build

  _buildBody() {
    // CapsuleGeometry(radius, length): total height is length + 2×radius.
    const torsoGeo = new THREE.CapsuleGeometry(0.28, 0.6, 4, 12);
    const torso = new THREE.Mesh(torsoGeo, this.materials.suit);
    torso.name = 'torso';
    torso.position.y = RIG.TORSO_Y - RIG.HIP_Y;
    torso.castShadow = true;
    this.bodyPivot.add(torso);
    this.torso = torso;

    const headGeo = new THREE.SphereGeometry(0.16, 16, 12);
    const head = new THREE.Mesh(headGeo, this.materials.skin);
    head.name = 'head';
    head.position.y = RIG.HEAD_Y - RIG.HIP_Y;
    head.castShadow = true;
    this.bodyPivot.add(head);
    this.head = head;
  }

  _buildLimbs() {
    // One geometry instance shared by all four limbs — they are identical, and
    // four copies of the same 0.68 m capsule would be three wasted uploads.
    const limbGeo = new THREE.CapsuleGeometry(0.09, 0.5, 3, 8);
    this._limbGeo = limbGeo;

    /** @type {Record<string, THREE.Group>} */
    this.joints = {};

    const make = (name, x, y, material) => {
      // The GROUP sits at the joint; the MESH hangs below it. Rotating the group
      // therefore swings the limb about the shoulder/hip, which is exactly the
      // pivot a future skeletal rig will want.
      const joint = new THREE.Group();
      joint.name = name;
      joint.position.set(x, y - RIG.HIP_Y, 0);

      const mesh = new THREE.Mesh(limbGeo, material);
      mesh.name = `${name}Mesh`;
      mesh.position.y = -RIG.LIMB_DROP;
      mesh.castShadow = true;
      joint.add(mesh);

      this.bodyPivot.add(joint);
      this.joints[name] = joint;
      return joint;
    };

    make('armLeft', -RIG.SHOULDER_X, RIG.SHOULDER_Y, this.materials.suit);
    make('armRight', RIG.SHOULDER_X, RIG.SHOULDER_Y, this.materials.suit);
    make('legLeft', -RIG.HIP_X, RIG.HIP_Y, this.materials.suit);
    make('legRight', RIG.HIP_X, RIG.HIP_Y, this.materials.suit);
  }

  _buildCape() {
    this.capeAnchor = new THREE.Group();
    this.capeAnchor.name = 'capeAnchor';
    this.capeAnchor.position.set(0, RIG.CAPE_Y - RIG.HIP_Y, RIG.CAPE_Z);
    this.bodyPivot.add(this.capeAnchor);

    // 4×6 segments: enough rows for a visible travelling wave, few enough that
    // rewriting the position attribute every frame is free (35 vertices).
    const capeGeo = new THREE.PlaneGeometry(0.7, 1.1, 4, 6);
    // Move the pivot to the plane's TOP edge so it hangs from the shoulders
    // rather than being centred on them.
    capeGeo.translate(0, -0.55, 0);

    const cape = new THREE.Mesh(capeGeo, this.materials.accent);
    cape.name = 'cape';
    cape.castShadow = true;
    this.capeAnchor.add(cape);
    this.cape = cape;

    // Snapshot the rest pose. The animation writes ABSOLUTE positions derived
    // from this every frame rather than accumulating deltas onto the live
    // attribute — accumulating drifts, and a drifting cape slowly inflates into
    // a balloon over a few minutes of play.
    this._capeBase = capeGeo.attributes.position.array.slice();
  }

  // ------------------------------------------------------------------ update

  /**
   * Copy simulation state onto the scene graph. Called once per fixed step,
   * after the locomotion controller has run.
   */
  syncTransform() {
    this.group.position.copy(this.state.position);
    this.group.rotation.y = this.state.facing;
    // Positive body pitch = nose down. Rotating about +X tips the top of the
    // body toward -Z, which is the direction the hero faces, so the sign is
    // already correct for the "Superman horizontal" pose.
    this.bodyPivot.rotation.x = this.state.pitch;
  }

  /**
   * Advance the procedural animation.
   *
   * Driven per fixed step so the motion is deterministic and framerate
   * independent, like everything else in the simulation.
   *
   * @param {number} dt seconds
   */
  update(dt) {
    const s = this.state;
    const speed = Math.hypot(s.velocity.x, s.velocity.z);
    const flying = s.flightActive;

    this._animateLimbs(dt, speed, flying);
    this._animateCape(dt, speed, flying);
  }

  /**
   * Procedural limb motion. Not skeletal animation and not an AnimationMixer —
   * two sine waves driving four group rotations. It exists because a hero whose
   * legs do not move is very hard to judge "does locomotion feel right?" against,
   * which is what most of the [HUMAN] acceptance criteria ask a person to do.
   *
   * @param {number} dt
   * @param {number} speed horizontal speed, m/s
   * @param {boolean} flying
   */
  _animateLimbs(dt, speed, flying) {
    if (flying) {
      // Flight pose: arms forward and slightly out, legs together and trailing.
      // Eased rather than snapped so takeoff reads as a transition.
      const k = 1 - Math.exp(-8 * dt);
      approachRotation(this.joints.armLeft, -2.6, 0, 0.12, k);
      approachRotation(this.joints.armRight, -2.6, 0, -0.12, k);
      approachRotation(this.joints.legLeft, 0.12, 0, 0.05, k);
      approachRotation(this.joints.legRight, 0.12, 0, -0.05, k);
      return;
    }

    // Stride frequency scales with speed so a dash visibly cadences faster.
    // Normalised against 7.5 m/s (MAX_SPEED) rather than an absolute constant.
    this._stridePhase += dt * (2.2 + speed * 0.9);
    const swing = Math.min(speed / 7.5, 1.4) * 0.85;
    const wave = Math.sin(this._stridePhase);

    this.joints.legLeft.rotation.x = wave * swing;
    this.joints.legRight.rotation.x = -wave * swing;
    // Arms counter-swing against the legs, which is what sells a walk cycle.
    this.joints.armLeft.rotation.x = -wave * swing * 0.7;
    this.joints.armRight.rotation.x = wave * swing * 0.7;
    this.joints.armLeft.rotation.z = 0.08;
    this.joints.armRight.rotation.z = -0.08;
    this.joints.legLeft.rotation.z = 0;
    this.joints.legRight.rotation.z = 0;
  }

  /**
   * CPU sine-wobble cape.
   *
   * A travelling wave down the cape's rows, amplitude scaled by a speed-driven
   * trail factor, plus a lift that swings the whole cape toward horizontal when
   * flying or moving fast. No vertex shader, no cloth solver.
   *
   * Feel target: fast and snappy, with no floaty overshoot — qualitatively
   * matching the 2D reference. The waveform constants are eyeballed, not
   * ported: the 2D cape's exact pixel path is meaningless at 3D scale.
   *
   * @param {number} dt
   * @param {number} speed horizontal speed, m/s
   * @param {boolean} flying
   */
  _animateCape(dt, speed, flying) {
    // Phase advances faster at speed: a cape that ripples at a constant rate
    // while the hero accelerates reads as detached from the motion.
    this._capePhase += dt * (3 + speed * 0.35);

    const speedFactor = Math.min(speed / 12, 1);
    // Trail: how far the cape streams out behind. Flight gets a floor value so a
    // stationary hover still has a live cape rather than a dead sheet.
    const trail = flying ? 0.45 + speedFactor * 0.9 : speedFactor * 0.8;
    // Lift rotates the whole cape from hanging (0) toward horizontal (~90°).
    const targetLift = flying ? 1.15 + speedFactor * 0.35 : speedFactor * 1.0;
    // Cape flare on takeoff — a brief snap outward that punctuates the burst.
    const flare = this.state.capeFlare ? 0.45 : 0;

    this.capeAnchor.rotation.x = damp(
      this.capeAnchor.rotation.x,
      targetLift + flare,
      12,
      dt,
    );

    const pos = this.cape.geometry.attributes.position;
    const base = this._capeBase;
    const amp = 0.055 + trail * 0.11;

    for (let i = 0; i < pos.count; i++) {
      const bx = base[i * 3];
      const by = base[i * 3 + 1];
      const bz = base[i * 3 + 2];

      // `by` runs 0 at the shoulders to -1.1 at the hem; `row` is 0..1 down the
      // cape. Amplitude grows toward the hem so the shoulders stay attached.
      const row = -by / 1.1;
      const wave = Math.sin(this._capePhase * 3 + row * 4.2) * amp * row * row;
      // A second, faster wave across the width breaks up the "flapping flag"
      // uniformity cheaply.
      const cross = Math.cos(this._capePhase * 2.2 + bx * 5) * amp * 0.35 * row;

      pos.setXYZ(
        i,
        bx + cross * 0.35,
        by,
        bz + wave + cross + row * trail * 0.18,
      );
    }
    pos.needsUpdate = true;
    // The cape's vertices move every frame, so its bounding sphere is stale.
    // Recomputing keeps frustum culling honest — a stale sphere makes the cape
    // vanish at screen edges.
    this.cape.geometry.computeBoundingSphere();
  }

  // ----------------------------------------------------------------- persona

  /**
   * Swap the hero's appearance between personas.
   *
   * MATERIAL COLOURS ONLY. No mesh rebuild, no geometry swap, no texture
   * creation, and deliberately NO call to disposeObject3D — nothing is created
   * or destroyed here, so there is nothing to free. That is precisely what makes
   * the Q toggle instant and hitch-free, and what makes acceptance criterion 26
   * ("renderer.info geometry/texture counts unchanged") true by construction
   * rather than by luck.
   *
   * If a future phase wants a genuinely different civilian *model*, that is a
   * Phase 5 glTF concern and it must NOT be retrofitted into this method.
   *
   * @param {'super'|'civilian'} persona
   */
  setPersona(persona) {
    const colors = PERSONA_COLORS[persona] || PERSONA_COLORS.super;
    this.state.persona = persona;
    this.materials.suit.color.setHex(colors.suit);
    this.materials.accent.color.setHex(colors.accent);
    this.materials.skin.color.setHex(colors.skin);
  }

  /** Toggle between the two personas. Bound to Q. */
  togglePersona() {
    this.setPersona(this.state.persona === 'super' ? 'civilian' : 'super');
    return this.state.persona;
  }

  /** Convenience for the debug HUD. */
  get stateName() {
    return this.state.state;
  }

  dispose() {
    disposeObject3D(this.group);
    // The shared limb geometry is referenced by four meshes; traversal disposes
    // it four times, which is idempotent and fine. Materials are likewise
    // shared and covered by the traversal.
    this.scene.remove(this.group);
  }
}

/** Total hero height, re-exported so the debug HUD can show it without a second import. */
export { HERO_HEIGHT_M, LocomotionState };

/**
 * Ease a joint's rotation toward a target pose.
 * @param {THREE.Group} joint
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {number} k interpolation weight in [0,1]
 */
function approachRotation(joint, x, y, z, k) {
  joint.rotation.x += (x - joint.rotation.x) * k;
  joint.rotation.y += (y - joint.rotation.y) * k;
  joint.rotation.z += (z - joint.rotation.z) * k;
}

/**
 * Framerate-independent exponential smoothing, same form the camera rig uses.
 * @param {number} current
 * @param {number} target
 * @param {number} lambda
 * @param {number} dt
 */
function damp(current, target, lambda, dt) {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}

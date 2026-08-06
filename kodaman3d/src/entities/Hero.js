import * as THREE from 'three';

import { TUNING } from '../config/tuning.js';
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
  /**
   * Behind the hero: facing is -Z, so "behind" is +Z.
   *
   * This was 0.14, which put the anchor INSIDE the torso. The torso is a capsule
   * of radius 0.28 centred at y=1.18; at the anchor's y=1.66 it is into the top
   * hemisphere, where the surface stands at `sqrt(0.28² - 0.18²)` ≈ 0.214. So the
   * anchor sat ~0.07 m under the skin, and a cape hanging from it ran straight
   * down through the widest part of the chest. The clipping a human reported was
   * never only a speed case — the mount was buried from the first frame.
   *
   * 0.32 clears the 0.28 bulge at the torso's widest with 0.04 m to spare.
   */
  CAPE_Z: 0.32,
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

    // Shared materials, reused across every part, which is what makes a persona
    // swap a colour write rather than a mesh rebuild.
    //
    // FOUR GROUPS — SUIT, SKIN, ACCENT, AND THE CAPE AS ITS OWN — per LOCKED
    // DECISION 14. ⚠️ This shipped as THREE, with the cape drawing `accent` and
    // no other user, which is precisely the "3 material groups, accent/cape
    // folded together" reading decision 14 was AMENDED to reject (3 groups is
    // 3 main + 3 shadow = 6 calls, not the 8 that row states). The session-11
    // code review caught the code quietly committing to the rejected shape.
    //
    // It costs nothing today because the hero is not rigged: the number that
    // matters is the 8-call budget once a Quaternius rig lands, and whoever
    // merges that rig inherits THIS object's shape. A 3-key `materials` is the
    // thing that silently produces 3 groups and no accent at all. Splitting now
    // is a one-line change; splitting later is a signature change.
    //
    // The cape keeps the accent COLOUR — it is the same red, and nothing about
    // how the hero looks changes here — but it owns its material, which it needs
    // regardless: §CAPE-1 requires double-sided, and `accent` should not be
    // double-sided for belt/emblem/boot geometry that is closed.
    const capeRed = 0xc0392b;
    this.materials = {
      suit: new THREE.MeshStandardMaterial({ color: 0x3a6fd9, roughness: 0.6, metalness: 0.05 }),
      accent: new THREE.MeshStandardMaterial({ color: capeRed, roughness: 0.7 }),
      cape: new THREE.MeshStandardMaterial({
        color: capeRed,
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

    const cape = new THREE.Mesh(capeGeo, this.materials.cape);
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
    // Body pitch. `state.pitch` is POSITIVE FOR NOSE-DOWN by construction: the
    // controller computes it as `-velocity.y / PITCH_SPEED_DIVISOR`, so a dive
    // (velocity.y < 0) yields a positive number. That convention is what the
    // MIN_/MAX_FORWARD_PITCH names in tuning.js describe, and it is not changed
    // here — only the mapping onto the scene graph is.
    //
    // AXIS DIRECTION, EXPLICITLY. A rotation of +θ about +X maps the body's up
    // axis (0,+1,0) to (0, cosθ, sinθ): for θ > 0 the HEAD tips toward +Z. The
    // hero faces -Z (Scale.js), so +Z is BEHIND them — a positive rotation lays
    // the hero onto their back and makes the FEET lead. Nose-down therefore
    // needs a NEGATIVE rotation, which is why `state.pitch` is negated here.
    //
    // This was the B4 defect. The comment that used to sit here asserted the
    // opposite ("rotating about +X tips the top of the body toward -Z") and the
    // code faithfully followed the comment, so the hero dived feet-first. It is
    // the same reversal that produced the B1 cape bug 90 lines below, and the
    // two are one root cause: +X positive swings -Y toward -Z and +Y toward +Z,
    // never the other way round. Name the axis in any comment about a sign.
    this.bodyPivot.rotation.x = -this.state.pitch;
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
      //
      // AXIS DIRECTION, EXPLICITLY — this was the B5 defect and the signs here
      // are load-bearing. Arms pivot AT THE SHOULDER with the mesh hanging
      // below, so an arm's rest direction is local (0,-1,0). Under a rotation
      // of +a about +X that maps to (0, -cos a, -sin a). Reading off the two
      // components: a > 0 sends the hand toward -Z, and the hero faces -Z, so
      // POSITIVE IS FORWARD. Legs pivot at the hip with the same rest
      // direction, so the same rule applies to them.
      //
      // At +2.6 the hands sit at (0, +0.86, -0.52): forward and raised about
      // 59 deg — reaching ahead into travel. The value that shipped was -2.6,
      // the same magnitude with the sign inverted, which put the hands at
      // (0, +0.86, +0.52) — swept up and BEHIND the head. Composed with the
      // body's dive lean that pointed them nearly straight up in world space,
      // and a figure descending with its arms overhead reads as falling
      // feet-first however the torso is angled. That is what a human tester
      // saw and reported as "the arms don't point towards the direction of
      // travel."
      //
      // Legs go slightly NEGATIVE so they trail at ~7 deg behind rather than
      // leading by 7 deg, which is the pose the user chose.
      const k = 1 - Math.exp(-8 * dt);
      approachRotation(this.joints.armLeft, 2.6, 0, 0.12, k);
      approachRotation(this.joints.armRight, 2.6, 0, -0.12, k);
      approachRotation(this.joints.legLeft, -0.12, 0, 0.05, k);
      approachRotation(this.joints.legRight, -0.12, 0, -0.05, k);
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
    // Lift swings the whole cape up from hanging (0) toward horizontal (~90°).
    // It is a MAGNITUDE, always positive; the direction is applied once, at the
    // point of use below.
    const targetLift = flying ? 1.15 + speedFactor * 0.35 : speedFactor * 1.0;
    // Cape flare on takeoff — a brief snap outward that punctuates the burst.
    const flare = this.state.capeFlare ? 0.45 : 0;

    // AXIS DIRECTION, EXPLICITLY — this is the B1 fix, so do not "tidy" the sign
    // away. The cape hangs at local (0,-1,0) from `capeAnchor`, which sits at
    // CAPE_Z = +0.14, i.e. BEHIND the hero (facing is -Z). A rotation of +θ about
    // +X maps (0,-1,0) to (0,-cosθ,-sinθ): for θ > 0 the hem swings toward -Z,
    // which is the direction the hero is TRAVELLING. That is a cape streaming
    // forward into the wind, and it is what shipped. Trailing behind means
    // swinging the hem toward +Z, which is a NEGATIVE rotation — hence the
    // negation here.
    //
    // The 2D reference agrees: drawCape() in kodaman_prototype.html uses
    // `trail = -(8 + speed * 3.2)`, explicitly backward. The 3D port dropped the
    // sign, and the old comment ("toward horizontal (~90°)") never said WHICH
    // horizontal, which is exactly how it got through review.
    // BODY PITCH IS CANCELLED OUT HERE, and it has to be. `capeAnchor` is a
    // child of `bodyPivot`, so it inherits the body's pitch; the hem's total
    // world rotation is `-pitch + capeAnchor.rotation.x`. Once the body leans to
    // horizontal at dash speed, that inherited -1.5 rad ALREADY swings the cape
    // from hanging to trailing — and adding the lift on top of it double-counts,
    // rotating the hem a further 90° past the hero until it points straight up,
    // perpendicular to travel. Adding `state.pitch` back cancels the inherited
    // term, so the total world lift is exactly `-(targetLift + flare)` whatever
    // the body is doing, and `targetLift` keeps meaning what it says: the cape's
    // angle from hanging, measured against the world.
    //
    // This surfaced the moment body pitch started responding to horizontal
    // speed. A unit test caught it, not an eye.
    // MINIMUM BODY-FRAME STANDOFF. The world lift above is correct in world
    // terms and blind in body terms. `state.pitch - targetLift` is the cape's
    // angle away from the torso, and at dash speed the two arguments nearly
    // cancel: body pitch reaches MAX_FORWARD_PITCH (1.5) while targetLift tops
    // out at 1.5 as well, so the cape ends up lying ALONG the torso. Combined
    // with an anchor that stands only CAPE_Z off the back, the cape sinks into
    // the body — which is what a human saw and reported as the cape "blending
    // into the hero's body".
    //
    // Negative local rotation swings the hem toward +Z, away from the back (the
    // same sign convention the B1 note above spells out), so the clamp is a
    // `Math.min` toward the negative, not a max.
    //
    // Faded in by |pitch| rather than applied flat: standing upright the cape
    // SHOULD lie against the back, and a permanent 23° kick would read as a
    // hero standing in a wind tunnel.
    const pitchFactor = Math.min(Math.abs(this.state.pitch) / (Math.PI / 2), 1);
    // Read through TUNING at the point of use, never destructured into module
    // scope, so the lil-gui slider retunes it live.
    const standoff = TUNING.CAPE_MIN_STANDOFF * pitchFactor;

    this.capeAnchor.rotation.x = damp(
      this.capeAnchor.rotation.x,
      Math.min(this.state.pitch - (targetLift + flare), -standoff),
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
    // The cape is its own group (decision 14) but tracks the accent colour, so a
    // persona swap still reads as one costume change.
    this.materials.cape.color.setHex(colors.accent);
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

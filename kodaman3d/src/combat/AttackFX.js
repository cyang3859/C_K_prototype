import * as THREE from 'three';

import { ABILITY } from './Abilities.js';
import { disposeObject3D } from '../core/dispose.js';

/**
 * AttackFX.js — the visible tell for the laser beam and the freeze cone.
 *
 * WHY THIS IS SEPARATE FROM Hero.js. The punch is an arm swing, so it belongs
 * to the hero's rig. The beam and the cone are not body parts — they are world
 * geometry that happens to originate at the hero, and their length depends on
 * what was actually hit. Putting them in the rig would mean the rig needed to
 * know about targets.
 *
 * TWO PERSISTENT MESHES, REUSED. Both are built once and toggled, never
 * allocated per shot. A projectile pool is `§D4`'s explicit warning about
 * immediate-mode ports, and it applies just as much to VFX: at a 1 s laser
 * cooldown, allocating a beam per shot would be garbage on a timer.
 *
 * PRIMITIVES ONLY, as everywhere else pre-Phase-5: a cylinder, a cone and two
 * glow spheres, all additive and unlit. No shaders, no particles, no textures.
 * Phase 7 is where this becomes real VFX; this exists so the player can tell an
 * ability fired.
 *
 * ---------------------------------------------------------------------------
 * ⚠️ WHY THE BEAM ALONE IS NOT ENOUGH — THE FORESHORTENING PROBLEM
 * ---------------------------------------------------------------------------
 * Attacks snap the hero to face the CAMERA (see `CombatSystem.update`), so the
 * beam always fires directly away from the viewer. A cylinder pointing straight
 * down the view axis projects to almost nothing and is then hidden behind the
 * hero's own body — measured: the beam was confirmed visible, 7.2 m long and at
 * 0.67 opacity, and was still invisible in a screenshot from the default
 * third-person camera.
 *
 * That is geometry, not a tuning problem, and no beam thickness fixes it
 * honestly. What reads from behind is the ENDS: a flash at the eyes where the
 * beam starts and a burst where it lands. Both are billboarded-ish spheres, so
 * they present the same silhouette from any angle. The beam is kept because it
 * reads well from every OTHER angle — mid-flight, orbiting the camera, or
 * watching a companion fire.
 */

/** Metres. Beam thickness — thin enough to read as energy, thick enough to see. */
const BEAM_RADIUS = 0.09;
/** Metres. Glow sphere at the beam's origin (the eyes) and at its impact point. */
const GLOW_RADIUS = 0.22;
/** Metres. How far the beam travels when it hits nothing at all. */
const BEAM_MISS_LENGTH = 60;
/** Metres above the feet the beam and cone originate — roughly eye level. */
const EYE_HEIGHT = 1.62;

export class AttackFX {
  /**
   * @param {object} opts
   * @param {THREE.Scene|THREE.Object3D} opts.scene
   */
  constructor({ scene }) {
    this.scene = scene;
    this._beamFor = 0;
    this._coneFor = 0;

    this.group = new THREE.Group();
    this.group.name = 'attackFX';

    // Additive + depthWrite:false so the beam glows over the world rather than
    // z-fighting the geometry it passes through.
    this.beamMaterial = new THREE.MeshBasicMaterial({
      color: 0xff4433,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    // Unit-length cylinder along +Y; scaled and oriented per shot.
    const beamGeo = new THREE.CylinderGeometry(BEAM_RADIUS, BEAM_RADIUS, 1, 6, 1, true);
    beamGeo.translate(0, 0.5, 0); // origin at the base, so scale.y IS the length
    this.beam = new THREE.Mesh(beamGeo, this.beamMaterial);
    this.beam.visible = false;

    this.coneMaterial = new THREE.MeshBasicMaterial({
      color: 0x8fd8ff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    // A cone whose apex sits at the hero and whose mouth is the freeze reach.
    const r = Math.tan(ABILITY.FREEZE_HALF_ANGLE_RAD) * ABILITY.FREEZE_REACH_M;
    const coneGeo = new THREE.ConeGeometry(r, ABILITY.FREEZE_REACH_M, 12, 1, true);
    // Point it along -Z (the hero's forward) with the apex at the origin.
    coneGeo.rotateX(-Math.PI / 2);
    coneGeo.translate(0, 0, -ABILITY.FREEZE_REACH_M / 2);
    this.cone = new THREE.Mesh(coneGeo, this.coneMaterial);
    this.cone.visible = false;

    // The two glows. Same material so one opacity drives both, and both use a
    // low-poly sphere: from any angle a sphere's silhouette is a disc, which is
    // exactly the "bright point" read that survives the foreshortening above.
    this.glowMaterial = new THREE.MeshBasicMaterial({
      color: 0xffd6a0,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const glowGeo = new THREE.SphereGeometry(GLOW_RADIUS, 10, 8);
    this.muzzleGlow = new THREE.Mesh(glowGeo, this.glowMaterial);
    this.impactGlow = new THREE.Mesh(glowGeo, this.glowMaterial);
    this.muzzleGlow.visible = false;
    this.impactGlow.visible = false;

    this.group.add(this.beam, this.cone, this.muzzleGlow, this.impactGlow);
    scene.add(this.group);
  }

  /**
   * Show the beam from the hero's eyes to whatever it hit.
   *
   * @param {{x:number,y:number,z:number}} from hero feet position
   * @param {{x:number,z:number}} facing unit forward vector
   * @param {{x:number,z:number}|null} hit the struck target, or null for a miss
   */
  showBeam(from, facing, hit) {
    const ox = from.x;
    const oy = from.y + EYE_HEIGHT;
    const oz = from.z;

    // A miss still draws — firing into empty air is information too, and a beam
    // that only appears on a hit would teach the player that misses "did
    // nothing" rather than "missed".
    const tx = hit ? hit.x : ox + facing.x * BEAM_MISS_LENGTH;
    const tz = hit ? hit.z : oz + facing.z * BEAM_MISS_LENGTH;
    const ty = hit ? oy - 0.5 : oy; // aim at a struck body's centre mass

    const dx = tx - ox;
    const dy = ty - oy;
    const dz = tz - oz;
    const len = Math.hypot(dx, dy, dz) || 0.001;

    this.beam.position.set(ox, oy, oz);
    this.beam.scale.set(1, len, 1);
    // The cylinder points along +Y; aim that axis down the shot vector.
    this.beam.quaternion.setFromUnitVectors(
      UP,
      _v.set(dx / len, dy / len, dz / len)
    );
    // The ends, which are what actually read from behind the hero.
    this.muzzleGlow.position.set(ox, oy, oz);
    this.impactGlow.position.set(tx, ty, tz);
    // An impact on something is a bigger flash than a beam trailing off into
    // the distance, so a hit is distinguishable from a miss at a glance.
    this.impactGlow.scale.setScalar(hit ? 1.6 : 0.5);

    this._beamFor = ABILITY.LASER_FX_S;
    this.beam.visible = true;
    this.muzzleGlow.visible = true;
    this.impactGlow.visible = true;
  }

  /**
   * Show the freeze cone in front of the hero.
   *
   * @param {{x:number,y:number,z:number}} from hero feet position
   * @param {number} yaw hero facing, radians
   */
  showCone(from, yaw) {
    this.cone.position.set(from.x, from.y + EYE_HEIGHT * 0.8, from.z);
    this.cone.rotation.set(0, yaw, 0);
    this._coneFor = ABILITY.FREEZE_FX_S;
    this.cone.visible = true;
  }

  /**
   * Fade both tells out. Opacity tracks remaining time, so each shot fades
   * rather than vanishing — a hard cut at this duration reads as a glitch.
   *
   * @param {number} dt seconds
   */
  update(dt) {
    this._beamFor = this._beamFor <= dt ? 0 : this._beamFor - dt;
    this._coneFor = this._coneFor <= dt ? 0 : this._coneFor - dt;

    const beamT = this._beamFor / ABILITY.LASER_FX_S;
    this.beamMaterial.opacity = beamT;
    this.beam.visible = this._beamFor > 0;

    // Glows fade on a sharper curve than the beam so they punch at the moment
    // of firing rather than lingering as two dull dots.
    this.glowMaterial.opacity = beamT * beamT;
    this.muzzleGlow.visible = this._beamFor > 0;
    this.impactGlow.visible = this._beamFor > 0;

    this.coneMaterial.opacity = 0.45 * (this._coneFor / ABILITY.FREEZE_FX_S);
    this.cone.visible = this._coneFor > 0;
  }

  dispose() {
    this.scene.remove(this.group);
    disposeObject3D(this.group);
  }
}

const UP = new THREE.Vector3(0, 1, 0);
const _v = new THREE.Vector3();

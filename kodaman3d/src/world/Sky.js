import * as THREE from 'three';

import { disposeObject3D } from '../core/dispose.js';

/**
 * Sky.js — static midday lighting, background and atmospheric haze.
 *
 * STATIC MIDDAY ONLY. No day/night cycle, no CSM cascaded shadows, no animated
 * sky (all Phase 2). A single fixed shadow-camera frustum is the correct choice
 * at Phase 1's 300 m scale — cascades exist to solve long-sightline shadow
 * resolution over kilometres, which this slice does not have.
 *
 * The brief offers a choice between `three/addons/objects/Sky.js` and a flat
 * hemisphere-tinted background plus fog. This uses the flat version deliberately:
 * it is one fewer moving part, costs no draw call, and the animated Sky object
 * only earns its keep once there is a sun to move across it in Phase 2.
 */
export class Sky {
  /**
   * @param {THREE.Scene} scene
   */
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'sky';

    // LA haze: a blue-grey tint, not neutral grey. The specific colour matters
    // more than it looks — neutral grey fog reads as "fog machine", while a
    // slightly blue haze reads as distance and smog.
    const hazeColor = 0xbfc9d4;

    // NOTE: these fog distances are a fixed Phase 1 placeholder, not researched
    // atmospheric truth. Real LA haze/visibility numbers are a separate,
    // still-open research item aimed at Phase 2's sky upgrade. Do not cite these
    // as authoritative.
    scene.fog = new THREE.Fog(hazeColor, 120, 900);
    scene.background = new THREE.Color(hazeColor);

    // Key light. High and to one side so building faces get clearly separated
    // lit/unlit sides — the cheapest way to make box geometry read as volume.
    this.sun = new THREE.DirectionalLight(0xfff4e0, 2.5);
    this.sun.position.set(80, 120, 60);
    this.sun.castShadow = true;

    // Shadow camera: orthographic (a directional light is a parallel projection)
    // sized to ±60 m, which comfortably contains the authored block. The frustum
    // is deliberately NOT sized to the full 300 m playable extent: doing so
    // would spread the same 2048² texels over 25× the area and turn crisp
    // shadows into mush. Content outside ±60 m simply does not cast, which is
    // invisible in practice because there is no authored content out there.
    const s = 60;
    this.sun.shadow.camera.left = -s;
    this.sun.shadow.camera.right = s;
    this.sun.shadow.camera.top = s;
    this.sun.shadow.camera.bottom = -s;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 400;
    this.sun.shadow.mapSize.set(2048, 2048);
    // bias fights shadow acne (self-shadowing stripes on lit surfaces);
    // normalBias fights peter-panning on the capsule/cylinder geometry, which
    // constant bias alone handles badly on curved surfaces.
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.02;

    // The directional light's shadow follows its target, which defaults to the
    // origin — exactly where the authored block sits.
    this.group.add(this.sun);
    this.group.add(this.sun.target);

    // Ambient fill: sky blue from above, warm pavement bounce from below. This
    // is what keeps the shadowed sides of buildings readable instead of black.
    this.hemi = new THREE.HemisphereLight(0x9fc4e8, 0xb9a887, 0.6);
    this.group.add(this.hemi);

    scene.add(this.group);
  }

  /**
   * Phase 1's sky is static, so this is a no-op. It exists so that Game.js's
   * fixed step has the same shape it will need in Phase 2, when a day/night
   * cycle actually has something to advance here.
   * @param {number} _dt
   */
  update(_dt) {}

  dispose() {
    // Lights hold no geometry or material, but traversing is harmless and keeps
    // one teardown convention across every world module.
    disposeObject3D(this.group);
    this.scene.remove(this.group);
    this.scene.fog = null;
    this.scene.background = null;
  }
}

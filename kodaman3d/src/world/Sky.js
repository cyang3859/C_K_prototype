import * as THREE from 'three';

import { TUNING } from '../config/tuning.js';
import { disposeObject3D } from '../core/dispose.js';

/**
 * Sky.js — static midday lighting, background, atmospheric haze, and the
 * image-based lighting environment.
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
 *
 * ---------------------------------------------------------------------------
 * THE ENVIRONMENT MAP, AND WHY IT IS NOT OPTIONAL POLISH
 * ---------------------------------------------------------------------------
 * `MeshStandardMaterial` computes indirect specular — the "shiny surface
 * catching the sky" term — **exclusively from an environment map**. With none
 * present it is not dim, it is exactly ZERO, at any roughness. So `metalness`
 * in an env-less rig does not add reflectivity; it only SUBTRACTS from the
 * diffuse term and gives nothing back. A dark-albedo, high-metalness material
 * under ACES tone mapping then crushes to near-black.
 *
 * That is precisely what happened to the glass towers, and the palette pass
 * worked around it by pulling their metalness DOWN (0.45 -> 0.32 wall,
 * 0.70 -> 0.50 window) so the diffuse term had enough left to survive. Those
 * numbers are compensation for a missing mechanism, not a description of glass.
 * `DESIGN_SPEC_TOWER_PALETTE.md` says so explicitly and flags this as the real
 * fix.
 *
 * So: bake a small PMREM environment from a synthetic sky. **No asset file, and
 * zero draw calls** — `scene.environment` is a texture consulted by the shader,
 * not an object in the graph, so the 57-call worst case is unchanged. The bake
 * happens once at construction.
 *
 * Material metalness is deliberately LEFT AS THE PALETTE PASS SET IT. Raising it
 * back is a visual judgement that wants a browser, and stacking a speculative
 * retune on top of a new lighting mechanism would make it impossible to tell
 * which change did what.
 */
export class Sky {
  /**
   * @param {THREE.Scene} scene
   * @param {THREE.WebGLRenderer} [renderer] required only to bake the
   *   environment map. Omitted in unit tests, which have no GL context — the
   *   scene is then lit by the two analytic lights alone, exactly as before.
   */
  constructor(scene, renderer = null) {
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

    /** @type {THREE.WebGLRenderTarget|null} */
    this.envTarget = null;
    if (renderer) this._buildEnvironment(renderer, hazeColor);
  }

  /**
   * Bake a synthetic sky into a PMREM environment map.
   *
   * The source is a sphere seen from the inside, vertex-coloured into three
   * bands — zenith, horizon haze, ground bounce — plus a small very bright disc
   * standing in for the sun, placed along the real `DirectionalLight`'s
   * direction so reflections and shadows agree about where the light is.
   *
   * HDR MATTERS HERE. The sun's colour is set well ABOVE 1.0 per channel, which
   * `THREE.Color` allows and the PMREM's half-float target preserves. Clamped at
   * 1.0 the sun would be no brighter than the sky around it and glass would get
   * a flat wash instead of a hot highlight to catch — which is most of what
   * makes a window read as glass rather than as grey paint.
   *
   * @param {THREE.WebGLRenderer} renderer
   * @param {number} hazeColor the horizon tint, shared with the fog so the
   *   reflected horizon and the actual visible horizon cannot drift apart.
   */
  _buildEnvironment(renderer, hazeColor) {
    const envScene = new THREE.Scene();

    // Radius 50 keeps the dome inside PMREM's default 0.1-100 camera range.
    const domeGeo = new THREE.SphereGeometry(50, 32, 24);
    const colors = [];
    const pos = domeGeo.attributes.position;

    const zenith = new THREE.Color(0x8fb6e0);
    const horizon = new THREE.Color(hazeColor);
    // The pavement bounce. Matches the HemisphereLight's ground colour, so the
    // image-based fill and the analytic fill push light up from underneath in
    // the same hue rather than fighting each other.
    const ground = new THREE.Color(0xb9a887);

    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) / 50; // -1 at nadir, +1 at zenith
      if (y >= 0) {
        // Square the blend so the gradient stays near the horizon tint through
        // most of the visible sky and only deepens high overhead, which is how a
        // hazy LA sky actually reads.
        c.copy(horizon).lerp(zenith, y * y);
      } else {
        // Short fade rather than a hard seam: a visible band at the horizon
        // shows up in every reflective surface at once.
        c.copy(horizon).lerp(ground, Math.min(-y * 4, 1));
      }
      colors.push(c.r, c.g, c.b);
    }
    domeGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const dome = new THREE.Mesh(
      domeGeo,
      new THREE.MeshBasicMaterial({ side: THREE.BackSide, vertexColors: true }),
    );
    envScene.add(dome);

    const sunGeo = new THREE.SphereGeometry(3.2, 16, 12);
    const sunMat = new THREE.MeshBasicMaterial();
    // Above 1.0 deliberately — see the HDR note above. Warm, matching this.sun.
    sunMat.color.setRGB(12, 11.2, 9.6, THREE.LinearSRGBColorSpace);
    const sunDisc = new THREE.Mesh(sunGeo, sunMat);
    sunDisc.position.copy(this.sun.position).normalize().multiplyScalar(42);
    envScene.add(sunDisc);

    const pmrem = new THREE.PMREMGenerator(renderer);
    // sigma 0.04 gives a slight blur, which hides the dome's 32×24 faceting
    // without smearing the sun into a uniform glow.
    this.envTarget = pmrem.fromScene(envScene, 0.04);
    this.scene.environment = this.envTarget.texture;
    this.scene.environmentIntensity = TUNING.ENV_INTENSITY;

    // The generator and the source scene have both done their job; only the
    // baked target is still referenced. Not disposing these leaks a render
    // target and two geometries for the life of the page.
    pmrem.dispose();
    disposeObject3D(envScene);
  }

  /**
   * Phase 1's sky is static in every respect except one: `ENV_INTENSITY` is
   * bound to a lil-gui slider, and the whole point of that slider is that the
   * user can judge the glass response live. Reading TUNING here every step is
   * the project's standard way of keeping a constant retunable — see the note
   * at the top of tuning.js about never snapshotting these into module scope.
   *
   * @param {number} _dt
   */
  update(_dt) {
    if (this.scene.environment) {
      this.scene.environmentIntensity = TUNING.ENV_INTENSITY;
    }
  }

  dispose() {
    // Lights hold no geometry or material, but traversing is harmless and keeps
    // one teardown convention across every world module.
    disposeObject3D(this.group);
    this.scene.remove(this.group);
    this.scene.fog = null;
    this.scene.background = null;
    // The env map is a render target this module owns, and disposeObject3D
    // cannot reach it — it hangs off the scene, not off any Object3D.
    if (this.envTarget) {
      this.envTarget.dispose();
      this.envTarget = null;
    }
    this.scene.environment = null;
  }
}

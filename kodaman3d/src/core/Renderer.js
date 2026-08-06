import * as THREE from 'three';

import { TUNING } from '../config/tuning.js';

/**
 * Renderer.js — WebGLRenderer construction, camera, and resize handling.
 *
 * RENDERER CHOICE: `WebGLRenderer`. FINAL. DO NOT REVISIT (brief §4).
 * Stated here once so nobody re-litigates it while reading this file:
 *   - The official CSM (cascaded shadow map) addon that later phases need for
 *     long-sightline outdoor shadows is WebGL-only. The WebGPU equivalent
 *     (CSMShadowNode) is less mature with thinner prior art.
 *   - WebGPURenderer commits the project to TSL materials (or a dual GLSL/WGSL
 *     path) against an API that is still gaining features, not a frozen surface.
 *   - Reversing that choice after world and character code is built against it
 *     would be expensive.
 * This applies to the whole project, Phases 1–8, not just Phase 1. There is no
 * fallback path and none should be added.
 *
 * NO POST-PROCESSING. `EffectComposer` is Phase 7. We render straight to the
 * default framebuffer.
 */
export class Renderer {
  /**
   * @param {object} [options]
   * @param {HTMLElement} [options.container] element to append the canvas to.
   */
  constructor({ container = document.body } = {}) {
    this.container = container;

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });

    // Cap device pixel ratio at 2, unconditionally. Uncapped DPR on a 3×
    // display is the single most common browser-3D performance own-goal: it
    // costs 2.25× the fragment work of DPR 2 for a difference almost nobody can
    // see. Not a setting — a hard cap.
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // r185 defaults to SRGBColorSpace, but set it explicitly so a future
    // default change cannot silently shift the game's colour response.
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.container.appendChild(this.renderer.domElement);

    // Near/far come from tuning.js rather than being inlined here: Phase 2's
    // larger world must raise `near` to ~0.3–0.5 alongside a far plane of
    // 8–12 km. Raising `far` alone while leaving `near` at 0.1 is a documented
    // z-fighting trap, and the fix should be a one-line tuning edit.
    this.camera = new THREE.PerspectiveCamera(
      TUNING.CAM_GROUND_FOV,
      window.innerWidth / window.innerHeight,
      TUNING.CAM_NEAR,
      TUNING.CAM_FAR,
    );

    this._resizePending = false;
    this._onResize = this._onResize.bind(this);
    window.addEventListener('resize', this._onResize);

    this.setSize(window.innerWidth, window.innerHeight);
  }

  /** The canvas element, for pointer-lock binding. */
  get domElement() {
    return this.renderer.domElement;
  }

  /**
   * @param {number} width css pixels
   * @param {number} height css pixels
   */
  setSize(width, height) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    // setSize(.., false) leaves the CSS size to the stylesheet, which already
    // pins the canvas to 100%/100% of the fixed-position container. Letting JS
    // write inline CSS sizes as well causes a rounding fight on fractional DPR.
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
  }

  /**
   * Resize is debounced by one animation frame. Dragging a window edge fires
   * `resize` dozens of times a second, and each handled resize reallocates the
   * drawing buffer — coalescing to one per frame keeps a drag smooth.
   */
  _onResize() {
    if (this._resizePending) return;
    this._resizePending = true;
    requestAnimationFrame(() => {
      this._resizePending = false;
      this.setSize(window.innerWidth, window.innerHeight);
    });
  }

  /**
   * @param {THREE.Scene} scene
   */
  render(scene) {
    this.renderer.render(scene, this.camera);
  }

  /**
   * Free the WebGL context and detach listeners.
   * Note this disposes only the *renderer*; scene contents are the scene
   * owner's responsibility via core/dispose.js. Keeping the two separate is
   * what lets Game.destroy() tear down in a defined order.
   */
  dispose() {
    window.removeEventListener('resize', this._onResize);
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}

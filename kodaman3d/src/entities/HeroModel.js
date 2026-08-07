import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import { HERO_HEIGHT_M } from '../core/Scale.js';

/**
 * HeroModel.js — loads the rigged hero and its animation clips.
 *
 * WHY THIS IS A SEPARATE MODULE FROM Hero.js. `Hero.js` owns the hero's visual
 * *behaviour* — how it is posed each frame from simulation state. This owns the
 * one-time job of getting bytes off the network into a scene graph, which is
 * async, failable, and has nothing to do with per-frame work. Keeping them apart
 * means `Hero` never contains a promise and `Game.fixedStep` never awaits.
 *
 * ⚠️ NOTHING HERE MAY READ SIMULATION STATE. This runs once, at boot.
 *
 * ---------------------------------------------------------------------------
 * THE ASSET, AND THE THREE CORRECTIONS IT NEEDS
 * ---------------------------------------------------------------------------
 * Quaternius "Universal Base Characters", Superhero male, CC0. See
 * `public/models/hero/README.md` for provenance and every measured figure. Three
 * things must be corrected on the way in, all of them measured from the file
 * rather than guessed:
 *
 * 1. FACING. The model faces **+Z** (its eye and eyebrow meshes sit at positive
 *    z on the head). This project's yaw 0 faces **−Z** (`core/Scale.js`). So the
 *    model is rotated 180° once, HERE, at load. Doing it anywhere else means
 *    every animation, aim vector and attack direction needs a compensating
 *    negation, and this repo has already lost days to scattered sign fixes.
 *
 * 2. SCALE. The model is **1.81 m** tall; `HERO_HEIGHT_M` is **1.85**. The
 *    collider is tuned to ours and has been human-verified across five browser
 *    passes, so the MESH is scaled to the collider and never the reverse.
 *
 * 3. THE COSTUME. The shipped base texture is a nude body — "Superhero" names
 *    the proportions, not an outfit. The painted suit from
 *    `tools/make_costume.py` replaces the body material's base-colour map.
 */

/** Where the assets live, relative to the Vite `public/` root. */
const MODELS = 'models/hero';

/** The material name Quaternius gives the body mesh. Eyes/brows have their own. */
const BODY_MATERIAL = 'MI_Superhero_Male';

/** Authored height of the base model, metres. Measured from its POSITION bounds. */
const MODEL_HEIGHT_M = 1.81;

/**
 * Clips this project actually uses, mapped from the library's own names.
 *
 * The library ships 43; naming the handful we use keeps a missing or renamed
 * clip a loud failure at boot rather than a hero that silently stands still.
 */
export const CLIPS = Object.freeze({
  idle: 'Idle_Loop',
  walk: 'Walk_Loop',
  jog: 'Jog_Fwd_Loop',
  sprint: 'Sprint_Loop',
  jumpStart: 'Jump_Start',
  jumpLoop: 'Jump_Loop',
  jumpLand: 'Jump_Land',
  punchA: 'Punch_Cross',
  punchB: 'Punch_Jab',
});

/**
 * Load the rigged hero, its hair, its costume and its animation clips.
 *
 * @param {object} [opts]
 * @param {string} [opts.path] base URL for the assets
 * @returns {Promise<{root: THREE.Group, clips: THREE.AnimationClip[], stats: object}>}
 */
export async function loadHeroModel({ path = MODELS } = {}) {
  const loader = new GLTFLoader();
  const textures = new THREE.TextureLoader();

  const [body, hair, animLib, suitMap] = await Promise.all([
    loader.loadAsync(`${path}/Superhero_Male_FullBody.gltf`),
    loader.loadAsync(`${path}/Hair_SimpleParted.gltf`),
    loader.loadAsync(`${path}/UAL1_Standard.glb`),
    textures.loadAsync(`${path}/T_Hero_Suit_BaseColor.png`),
  ]);

  // Base-colour maps are authored in sRGB; normal/roughness are not. Getting
  // this wrong washes the costume out and is easy to miss on a stylized model.
  suitMap.colorSpace = THREE.SRGBColorSpace;
  suitMap.flipY = false; // glTF UV convention, which GLTFLoader also assumes

  const root = new THREE.Group();
  root.name = 'heroModel';

  const skinned = [];
  body.scene.traverse((o) => {
    if (!o.isMesh && !o.isSkinnedMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    if (o.isSkinnedMesh) skinned.push(o);
    if (o.material?.name === BODY_MATERIAL) {
      // The costume. Dispose the nude base map we are replacing rather than
      // leaving it resident — `core/dispose.js` exists because this project has
      // leaked GPU memory through exactly this kind of quiet replacement.
      o.material.map?.dispose();
      o.material.map = suitMap;
      o.material.needsUpdate = true;
    }
  });

  // The hair is rigged to the same 65-joint skeleton, so it binds to the body's
  // skeleton rather than carrying its own — otherwise it animates independently
  // and slides off the head.
  const bodySkeleton = skinned[0]?.skeleton ?? null;
  hair.scene.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    o.castShadow = true;
    if (bodySkeleton) o.bind(bodySkeleton, o.bindMatrix);
  });

  root.add(body.scene);
  if (bodySkeleton) root.add(hair.scene);

  // Correction 1: face −Z. See the header.
  root.rotation.y = Math.PI;
  // Correction 2: match the collider's height, never the other way round.
  const scale = HERO_HEIGHT_M / MODEL_HEIGHT_M;
  root.scale.setScalar(scale);

  const clips = animLib.animations;
  const names = new Set(clips.map((c) => c.name));
  const missing = Object.values(CLIPS).filter((n) => !names.has(n));
  if (missing.length) {
    // Loud, not fatal: a hero that stands still is far more confusing to debug
    // than a console error naming the exact clip that went missing.
    console.warn(`HeroModel: animation clips missing from the library: ${missing.join(', ')}`);
  }

  return {
    root,
    clips,
    stats: {
      scale,
      clipCount: clips.length,
      skinnedMeshes: skinned.length,
      bones: bodySkeleton ? bodySkeleton.bones.length : 0,
    },
  };
}

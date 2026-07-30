/**
 * dispose.js — the project's single recursive Object3D teardown utility.
 *
 * WHY THIS EXISTS FROM DAY ONE (brief §11)
 * ----------------------------------------
 * Three.js does not garbage-collect GPU resources. `scene.remove(mesh)` only
 * detaches the object from rendering; the underlying BufferGeometry, Material
 * and Texture keep their GPU buffers allocated until `.dispose()` is called on
 * each one *individually*. Disposing a Material does NOT dispose the textures
 * it references, because a texture may be shared by several materials and has
 * to be freed independently.
 *
 * Phase 1's own runtime churn is minimal — one block, one hero, nothing is
 * created or destroyed during play. The reason this file is written now rather
 * than "when we need it" is:
 *
 *   1. Vite's HMR reloads the module graph on every source save. Without a
 *      teardown path, an afternoon of `npm run dev` leaks a full scene's worth
 *      of geometries and textures per save, and `renderer.info.memory` climbs
 *      until the tab dies. That is the exact development loop this project runs.
 *   2. Retrofitting disposal discipline after Phase 2's chunk streaming and
 *      Phase 5's glTF persona swaps exist is a painful audit of every allocation
 *      site. Establishing the convention with the first allocating file is free.
 *
 * CONVENTION FOR EVERY MODULE THAT ALLOCATES GPU RESOURCES:
 *   - expose a `dispose()` method,
 *   - dispose anything it created that this utility cannot reach by traversal
 *     (standalone textures, render targets, geometries not attached to a mesh),
 *   - then let the owner call `disposeObject3D()` on its root node.
 *
 * NOTE: `Hero.setPersona()` deliberately does NOT call this. A persona swap
 * only writes `material.color`; no geometry, material or texture is created or
 * destroyed, which is precisely what keeps the Q toggle instant and hitch-free.
 * Adding a dispose call there would be a bug, not extra safety.
 */

/**
 * Recursively dispose every geometry, material and material-referenced texture
 * under `root`. Safe to call on a node that has already been disposed
 * (Three.js `dispose()` is idempotent) and safe on a null/undefined root.
 *
 * Does NOT remove `root` from its parent — detaching is the caller's decision,
 * because "dispose then keep the (now invalid) node around" is always a bug and
 * mixing the two operations here would hide it.
 *
 * @param {import('three').Object3D | null | undefined} root
 */
export function disposeObject3D(root) {
  if (!root) return;

  root.traverse((node) => {
    // Geometry: one per mesh, but several meshes may share one instance. Three's
    // dispose() is idempotent so double-disposing a shared geometry is harmless.
    if (node.geometry) {
      node.geometry.dispose();
    }

    if (node.material) {
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      for (const mat of materials) {
        disposeMaterial(mat);
      }
    }
  });
}

/**
 * Dispose a single material plus every texture it references.
 *
 * We enumerate the material's own keys rather than checking a hardcoded list of
 * map slots (`map`, `normalMap`, `roughnessMap`, ...) because the slot list
 * differs per material type and grows between Three.js releases; duck-typing on
 * `value.isTexture` is version-proof.
 *
 * @param {import('three').Material} mat
 */
export function disposeMaterial(mat) {
  if (!mat) return;

  for (const key of Object.keys(mat)) {
    const value = mat[key];
    if (value && value.isTexture) {
      value.dispose();
    }
  }

  mat.dispose();
}

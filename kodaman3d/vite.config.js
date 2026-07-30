import { defineConfig } from 'vite';

// Phase 1 needs no plugins: the entry is a plain ES module and every dependency
// ships ESM. Keep this file boring on purpose — the moment it grows special-case
// build logic, that is a signal Phase 1 scope has drifted (see brief §13).
export default defineConfig({
  server: {
    // Fail loudly instead of silently hopping ports, so a stale dev server is obvious.
    strictPort: false,
    open: false,
  },
  build: {
    // Three.js is large; the default 500 kB warning is pure noise for this project.
    chunkSizeWarningLimit: 1500,
    sourcemap: true,
  },
  // Vitest configuration lives here so there is exactly one config file.
  // `environment: 'node'` is deliberate: the two modules under test
  // (Collision.js, LocomotionController.js) are pure logic and must never
  // acquire a WebGL/DOM dependency. If a test ever needs a DOM, that is a
  // design smell in the module, not a reason to change this setting.
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    reporters: 'default',
  },
});

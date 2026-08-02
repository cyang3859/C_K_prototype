import { defineConfig } from 'vite';

// Phase 1 needs no plugins: the entry is a plain ES module and every dependency
// ships ESM. Keep this file boring on purpose — the moment it grows special-case
// build logic, that is a signal Phase 1 scope has drifted (see brief §13).
export default defineConfig({
  server: {
    // Fail loudly instead of silently hopping ports, so a stale dev server is
    // obvious. ⚠️ This was `false` -- the hopping behaviour, and Vite's default --
    // under this same comment, until the session-11 code review caught it. It
    // matters more here than it looks: CLAUDE.md hard-codes port 5173 for every
    // browser check, so a leftover server put the new one on 5174 and an agent
    // following those instructions drove the STALE build believing it was the
    // new one, with no error anywhere.
    strictPort: true,
    open: false,
  },
  build: {
    // Three.js is large; the default 500 kB warning is pure noise for this project.
    chunkSizeWarningLimit: 1500,
    sourcemap: true,
  },
  // Vitest configuration lives here so there is exactly one config file.
  // `environment: 'node'` is deliberate: the pure-logic core (Collision.js,
  // LocomotionController.js) must never acquire a WebGL/DOM dependency. If a
  // test ever needs a DOM, that is a design smell in the module, not a reason to
  // change this setting. The world and district suites do build real scene
  // graphs, which works because Three's object model is plain JS — only the
  // canvas 2D calls behind the procedural textures need the stub in
  // `tests/support/canvas2d.js`.
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    reporters: 'default',
  },
});

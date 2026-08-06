import { Game } from './core/Game.js';

/**
 * main.js — entry point.
 *
 * Construct the Game, await init, start the loop. Deliberately thin: anything
 * that grows here belongs in a system under src/core, src/world or
 * src/controllers instead.
 */

const container = document.getElementById('app') || document.body;
const game = new Game({ container });

await game.init();
game.start();

// Exposed for headless acceptance testing (Playwright reading renderer.info,
// camera.fov and FSM state) and for poking at things from the devtools console.
// Not a gameplay API — nothing in src/ may read from window.
if (typeof window !== 'undefined') {
  window.__game = game;
}

/**
 * Vite HMR teardown.
 *
 * Without this, every source save during development would leave the previous
 * Game's scene, WebGL context, DOM overlays and event listeners alive — leaking
 * a full scene's worth of GPU resources per save and stacking duplicate
 * keyboard handlers, which makes the hero move at double speed after two saves.
 * This is exactly the leak core/dispose.js exists to prevent.
 */
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    game.destroy();
  });
}

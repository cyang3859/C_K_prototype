/**
 * Time.js — fixed-timestep accumulator, dt clamping, and fps tracking.
 *
 * WHY A FIXED TIMESTEP IS REQUIRED, NOT A STYLE CHOICE (brief §5)
 * ---------------------------------------------------------------
 * Every tuning constant in config/tuning.js is a per-frame-at-60-Hz value from
 * the 2D game converted into a per-second rate. Running the simulation at a
 * variable timestep would make flight feel measurably different on a 144 Hz
 * monitor than on a 60 Hz one — the acceleration/damping curves are only
 * equivalent when integrated at a known, constant step.
 *
 * It is also what makes the locomotion FSM deterministic, and determinism is
 * the entire reason the vitest suites in tests/ are meaningful: "12 fixed steps
 * of takeoff" is a testable statement; "0.2 seconds of takeoff at whatever
 * framerate the CI box managed" is not.
 *
 * HOW THE PIECES FIT
 * ------------------
 * Game.js drives this: once per rendered frame it calls `beginFrame(nowMs)`,
 * which returns how many fixed simulation steps to run right now, then runs
 * exactly that many `fixedStep(FIXED_DT)` calls, then renders once using
 * `alpha` as the leftover-fraction hint.
 *
 * The loop is split across two files (accumulator here, stepping in Game.js)
 * rather than living entirely in Game.js as the brief sketches it, because the
 * file tree assigns "fixed-timestep accumulator, dt clamping, fps tracking" to
 * this module. The arithmetic is identical.
 *
 * TWO GUARDS, BOTH LOAD-BEARING
 * -----------------------------
 * 1. `maxFrameDt` (0.25 s) clamps the raw frame delta. Tab-out, a breakpoint in
 *    the debugger, or a laptop sleep produce a multi-second delta; without the
 *    clamp the accumulator would demand hundreds of catch-up steps and the hero
 *    would teleport (and, in a physics sense, tunnel through the world).
 * 2. `maxSteps` (5) caps catch-up work per frame. If the simulation genuinely
 *    cannot keep up, running more steps makes the next frame slower still —
 *    the classic spiral of death. On hitting the cap we drop the backlog
 *    entirely: the game runs in slow motion for a moment, which is recoverable,
 *    instead of locking up, which is not.
 */

export class Time {
  /**
   * @param {object} [options]
   * @param {number} [options.fixedDt=1/60] simulation step in seconds. Do not change:
   *   the tuning constants and the TAKEOFF_STEPS count assume 60 Hz.
   * @param {number} [options.maxSteps=5] spiral-of-death guard.
   * @param {number} [options.maxFrameDt=0.25] clamp for a single raw frame delta.
   */
  constructor({ fixedDt = 1 / 60, maxSteps = 5, maxFrameDt = 0.25 } = {}) {
    this.fixedDt = fixedDt;
    this.maxSteps = maxSteps;
    this.maxFrameDt = maxFrameDt;

    /** Seconds of simulation owed but not yet stepped. */
    this.accumulator = 0;
    /** Timestamp of the previous frame, ms, or null before the first frame. */
    this.lastMs = null;
    /** Raw (clamped) delta of the most recent frame, seconds. Render-side use only. */
    this.frameDt = 0;
    /** Total simulated time, seconds. Drives the cape wobble and any other visual phase. */
    this.elapsed = 0;
    /** Fixed steps run in the most recent frame — 0 is normal and expected on a 144 Hz display. */
    this.stepsLastFrame = 0;
    /** True when the most recent frame hit `maxSteps` and dropped its backlog. */
    this.droppedBacklog = false;

    // --- fps tracking (smoothed, so the readout is legible rather than jittery) ---
    this.fps = 0;
    this._fpsAccumTime = 0;
    this._fpsAccumFrames = 0;
  }

  /**
   * Advance wall-clock time and report how many fixed steps to run.
   *
   * @param {number} nowMs a `performance.now()`-style timestamp in milliseconds
   *   (requestAnimationFrame passes exactly this).
   * @returns {number} number of `fixedDt` steps the caller must run now.
   */
  beginFrame(nowMs) {
    // First frame: establish the baseline and simulate nothing. Without this the
    // very first delta would be the whole page-load duration.
    if (this.lastMs === null) {
      this.lastMs = nowMs;
      this.stepsLastFrame = 0;
      return 0;
    }

    const raw = (nowMs - this.lastMs) / 1000;
    this.lastMs = nowMs;

    // Guard 1: clamp tab-out / debugger-pause spikes. Also defends against a
    // negative delta, which some browsers can produce across a timer source change.
    this.frameDt = Math.min(Math.max(raw, 0), this.maxFrameDt);
    this.accumulator += this.frameDt;

    let steps = 0;
    while (this.accumulator >= this.fixedDt && steps < this.maxSteps) {
      this.accumulator -= this.fixedDt;
      steps++;
    }

    // Guard 2: give up on the backlog rather than spiral.
    this.droppedBacklog = steps === this.maxSteps && this.accumulator >= this.fixedDt;
    if (steps === this.maxSteps) {
      this.accumulator = 0;
    }

    this.stepsLastFrame = steps;
    this.elapsed += steps * this.fixedDt;

    this._trackFps(this.frameDt);
    return steps;
  }

  /**
   * Leftover accumulator as a fraction of one fixed step, in [0, 1).
   *
   * Phase 1 does not interpolate with this: the hero and camera already update
   * every fixed step at 60 Hz, which is imperceptible from per-frame
   * interpolation at this slice's motion speeds. It is threaded through to
   * `Game.render(alpha)` so the seam exists for later phases without a refactor.
   */
  get alpha() {
    return this.accumulator / this.fixedDt;
  }

  /**
   * Reset the clock baseline without touching tuning.
   *
   * Called on window focus (see Input.js's blur handling and acceptance
   * criterion 27): after an alt-tab, `lastMs` is stale by however long the user
   * was away. Clearing it makes the next frame re-baseline instead of producing
   * one enormous delta — belt and braces alongside the `maxFrameDt` clamp,
   * because it also guarantees the accumulator is empty, so refocusing can never
   * produce a velocity spike from a burst of catch-up steps.
   */
  resetBaseline() {
    this.lastMs = null;
    this.accumulator = 0;
    this.frameDt = 0;
    this.stepsLastFrame = 0;
  }

  /** @param {number} dt seconds */
  _trackFps(dt) {
    this._fpsAccumTime += dt;
    this._fpsAccumFrames++;
    // Recompute roughly twice a second: fast enough to notice a stall, slow
    // enough that the number is readable.
    if (this._fpsAccumTime >= 0.5) {
      this.fps = this._fpsAccumFrames / this._fpsAccumTime;
      this._fpsAccumTime = 0;
      this._fpsAccumFrames = 0;
    }
  }
}

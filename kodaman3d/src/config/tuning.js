/**
 * tuning.js — every movement and camera constant, single source of truth.
 *
 * HOW TO USE THIS FILE
 * --------------------
 * `TUNING` is a plain mutable object, not a set of `const` exports, and that is
 * deliberate: lil-gui binds directly to its properties so QA and the user can
 * retune the whole game live in the browser without a reload (brief §6 — the
 * debug UI is a required deliverable, not a nicety).
 *
 * Consequently, **read `TUNING.X` at call time inside the update loop**. Do not
 * destructure constants into module scope at import time (`const { MAX_SPEED }
 * = TUNING`) — that snapshots the value and silently breaks live tuning.
 *
 * The frozen `DEFAULT_TUNING` copy below exists so the debug UI can offer a
 * "reset" and so unit tests can assert against the shipped defaults even if a
 * test mutated `TUNING` earlier in the run.
 *
 * WHERE THE NUMBERS COME FROM
 * ---------------------------
 * These are ports of the 2D prototype's per-frame-at-60fps pixel values:
 *   velocities:     m/s  = px_per_frame  × 60   × PX_TO_M
 *   accelerations:  m/s² = px_per_frame² × 3600 × PX_TO_M
 * with PX_TO_M = 0.2 (see core/Scale.js).
 *
 * They are a tuned *starting point*, not gospel. Feel parity with the 2D game
 * matters more than arithmetic parity, and the user is expected to retune by
 * feel through the lil-gui panel.
 */

/* ------------------------------------------------------------------------- *
 * Damping: the single most important correction in the whole brief (§6.2)
 * ------------------------------------------------------------------------- *
 *
 * The 2D game applies its damping constants once per frame at 60 fps:
 *   v *= GROUND_FRICTION            (0.82 per frame)
 *   v *= AIR_FRICTION               (0.92 per frame)
 *   v *= FLIGHT_HOVER_DAMPING       (0.18 per frame)
 *
 * For a framerate-independent fixed-timestep port, a per-frame factor `f`
 * becomes a per-second factor `f^60`, applied as `v *= (f^60)^dt`. Equivalently
 * and with one fewer pow, `v *= Math.pow(f, 60 * dt)` — which is what the
 * controller actually evaluates, so that editing the per-frame factor in
 * lil-gui takes effect immediately with no derived value to keep in sync.
 *
 * GROUND_FRICTION and AIR_FRICTION convert cleanly this way:
 *   0.82^60 ≈ 6.75e-6   (compute it, never hand-copy: an earlier draft of the
 *                        spec quoted 6.3e-6, which is ~7% low)
 *   0.92^60 ≈ 6.74e-3
 *
 * FLIGHT_HOVER_DAMPING MUST NOT BE CONVERTED THIS WAY.
 *   0.18^60 ≈ 2.1e-45. That is not numerically broken — no NaN, no Infinity —
 *   but it collapses vertical velocity to zero inside a single fixed step at any
 *   realistic dt, and it offers no usable tuning range: the constant does
 *   nothing at all until its exponent approaches 1.0, at which point a tiny
 *   nudge swings the feel between "instant" and "never". It is unusable as a
 *   slider.
 *
 *   Hover damping is therefore implemented as its own explicit half-life decay,
 *   unrelated to the ^60 formula:
 *
 *       v.y *= Math.pow(0.5, dt / hoverDampingHalfLife)
 *
 *   `hoverDampingHalfLife` is seconds-to-halve-the-velocity: at 0.065 s,
 *   releasing W/S bleeds off ~90% of vertical speed in about 0.22 s and the
 *   HOVER_SNAP_SPEED threshold then hard-zeroes the remainder so altitude is
 *   held *exactly*, not asymptotically. That exact zero is what makes
 *   acceptance criterion 16 ("y drift < 0.05 m over 3 s") pass by construction
 *   rather than by luck.
 *
 *   DO NOT "simplify" this back into the ^60 conversion. That specific mistake
 *   is called out in the brief as the single most likely subtle bug in Phase 1.
 */

/** Per-frame-at-60fps ground damping factor, as authored in the 2D game. */
export const GROUND_FRICTION = 0.82;
/** Per-frame-at-60fps air damping factor, as authored in the 2D game. */
export const AIR_FRICTION = 0.92;

/** Documented per-second equivalents. Computed, never hand-typed. */
export const GROUND_FRICTION_PER_SEC = Math.pow(GROUND_FRICTION, 60); // ≈ 6.75e-6
export const AIR_FRICTION_PER_SEC = Math.pow(AIR_FRICTION, 60); // ≈ 6.74e-3

/**
 * The 2D game's per-frame hover damping constant, kept ONLY for provenance.
 * Nothing reads it. `TUNING.hoverDampingHalfLife` is what the controller uses.
 * See the block comment above for why converting this via ^60 is forbidden.
 */
export const FLIGHT_HOVER_DAMPING_2D = 0.18;

/* ------------------------------------------------------------------------- *
 * Locomotion + camera tuning
 * ------------------------------------------------------------------------- */

export const TUNING = {
  // ---- Ground movement -----------------------------------------------------
  /** m/s — ground walk/run speed cap. */
  MAX_SPEED: 7.5,
  /** m/s² — horizontal acceleration, used on the ground and in the air alike. */
  MOVE_ACCEL: 26.0,
  /** m/s² — applied ONLY in the `grounded` state while onGround === false
   *  (i.e. the hero walked off a ledge). Never in any flight state. */
  GRAVITY: 23.8,
  /**
   * m/s — ported from the 2D tuning table for completeness and future retuning.
   * INTENTIONALLY UNUSED IN PHASE 1: takeoff's vertical motion is governed
   * entirely by the scripted TAKEOFF_CLIMB_SPEED, not by an initial impulse.
   * The 2D source spec lists this constant but never references it in the FSM
   * it describes; rather than invent a use for it, it is surfaced in lil-gui and
   * left uncalled. Do not wire it into LocomotionController without a decision.
   */
  JUMP_FORCE: 9.4,
  /** m/s — ground speed cap while Shift is held. Shift RAISES THE CAP the
   *  existing acceleration curve pursues; it is never a one-shot impulse. */
  DASH_SPEED: 13.0,

  // ---- Flight --------------------------------------------------------------
  /** m/s — horizontal speed cap while Shift is held in flight. */
  FLIGHT_DASH_SPEED: 20.5,
  /** m/s² — climb acceleration while W/Space is held in `flying`. */
  FLIGHT_UP_THRUST: 36.7,
  /** m/s² — descend acceleration while S is held in `flying`. */
  FLIGHT_DOWN_THRUST: 30.2,
  /** m/s — climb speed cap. */
  MAX_FLIGHT_UP_SPEED: 7.5,
  /** m/s — dive speed cap while in `flying` (the `landing` state uses its own). */
  MAX_FLIGHT_DOWN_SPEED: 6.1,
  /** m/s² — scripted descent acceleration in `landing` (= FLIGHT_DOWN_THRUST × 0.9). */
  LANDING_DESCENT_ACCEL: 27.18,
  /** m/s — descent cap during `landing`, deliberately distinct from the 6.1 flying cap. */
  LANDING_MAX_DOWN_SPEED: 6.8,
  /**
   * m/s — constant forced climb rate for the whole scripted takeoff.
   *
   * RAISED 4.8 -> 9.6 to fix B2 ("tap-W flight ends too low"). How the number
   * was chosen, so the next person can re-derive it instead of guessing:
   *
   * A tap gains altitude in TWO parts, and only the first is obvious.
   *   1. The scripted climb: TAKEOFF_CLIMB_SPEED × TAKEOFF_STEPS × (1/60 s).
   *   2. A coast. On entering `flying` with W released, the hover half-life
   *      decay bleeds the residual climb speed off over ~0.4 s before
   *      HOVER_SNAP_SPEED zeroes it, and gravity is never applied in flight, so
   *      every metre of that coast is KEPT. It is worth ~0.085 m per m/s of
   *      TAKEOFF_CLIMB_SPEED.
   * At 4.8 that was 0.96 m scripted + 0.40 m coast = a 1.36 m apex — under the
   * hero's own 1.85 m height, which is why a tap read as a hop. At 9.6 it is
   * 1.92 m + 0.81 m = a 2.73 m apex, mid-band of the 2.5-3 m target.
   *
   * TAKEOFF_STEPS was deliberately LEFT AT 12. Speed is the lever the QA writeup
   * prefers (it keeps the burst punchy), and holding the takeoff duration at
   * 0.2 s means the FSM timeline that criterion 14's camera pull-back and
   * criterion 24's 0.6 s cross-fade were judged against does not move at all.
   * Extending the takeoff is the thing that could desync those; changing how
   * fast it climbs is not.
   *
   * Exceeding MAX_FLIGHT_UP_SPEED (7.5) for these 12 steps is intentional — a
   * burst is meant to out-run the sustained climb cap. Holding W through the
   * transition is safe: `flying` eases the velocity back down to the cap with
   * the ordinary `approach()` curve rather than clamping it.
   */
  TAKEOFF_CLIMB_SPEED: 9.6,
  /** fixed steps — takeoff duration: 12 × 1/60 s = 0.2 s. See the note above
   *  before changing this: criteria 14 and 24 were judged against this timeline. */
  TAKEOFF_STEPS: 12,
  /** unitless — multiplies BOTH vertical thrust/caps AND horizontal accel/caps
   *  while J/K/L is held, for precision aiming. No ability logic attached. */
  FLIGHT_FINE_MULT: 0.4,

  // ---- Damping -------------------------------------------------------------
  /** m/s — below this, hover vertical velocity hard-snaps to exactly 0. */
  HOVER_SNAP_SPEED: 0.11,
  /** seconds — half-life of the hover vertical damping. See the §6.2 block
   *  comment above. lil-gui slider range 0.05–0.08. */
  hoverDampingHalfLife: 0.065,
  /** per-frame-at-60fps factors; the controller applies pow(f, 60*dt). */
  GROUND_FRICTION,
  AIR_FRICTION,

  // ---- Orientation ---------------------------------------------------------
  /** rad/s — rate at which hero yaw turns toward the movement direction.
   *  Rate-limited, not an instant snap (acceptance criterion 9). */
  YAW_SLERP_RATE: 12.0,
  /** rad — flight body-pitch cap (≈86°, the Superman-horizontal pose). */
  MAX_FORWARD_PITCH: 1.5,
  /** rad — flight body-pitch floor (nose-up while climbing). */
  MIN_FORWARD_PITCH: -0.6,
  /**
   * Divisor on the VERTICAL half of the body-pitch calculation. See
   * `LocomotionController._updateOrientation` for the full two-term model —
   * this term is faded out as horizontal speed rises, so it governs the
   * near-vertical climb and dive poses rather than flight generally.
   * Lower = tips harder for the same vertical speed.
   */
  PITCH_SPEED_DIVISOR: 8.0,

  // ---- World bounds --------------------------------------------------------
  /** m — ±150 m on X and Z from the origin = a 300 m playable square. */
  PLAYABLE_HALF_EXTENT: 150.0,

  // ---- Camera rig ----------------------------------------------------------
  /**
   * Exponential smoothing rate, 1/s. This is the exact framerate-independent
   * equivalent of the 2D camera's per-frame `camera.x += (dx - camera.x) * 0.1`
   * at 60 fps:  lambda = -60 · ln(1 - 0.1) ≈ 6.32.
   * ONE damping constant, reused for every eased property in CameraRig — do not
   * introduce a second ad-hoc lerp rate per property.
   */
  CAMERA_LAMBDA: 6.32,
  /** m — spring-arm length while grounded. */
  CAM_GROUND_DISTANCE: 6.0,
  /** m — pivot height above the hero's feet while grounded. */
  CAM_GROUND_HEIGHT: 1.5,
  /** degrees — vertical FOV while grounded. */
  CAM_GROUND_FOV: 60,
  /** m — spring-arm length in any flight state. */
  CAM_FLIGHT_DISTANCE: 9.0,
  /** m — pivot height above the hero's feet in any flight state. */
  CAM_FLIGHT_HEIGHT: 2.2,
  /** degrees — vertical FOV in any flight state. */
  CAM_FLIGHT_FOV: 70,
  /** seconds — ground↔flight parameter cross-fade duration (criterion 24). */
  CAM_BLEND_TIME: 0.6,
  /** degrees — extra FOV at full flight-dash speed, on top of the base FOV,
   *  scaled by speed / FLIGHT_DASH_SPEED. The cheapest speed-sensation trick
   *  available (criterion 17's "surge"). */
  CAM_DASH_FOV_BOOST: 8,
  /** rad — camera pitch clamp, low end (looking up from below). */
  CAM_PITCH_MIN: -0.5,
  /** rad — camera pitch clamp, high end (looking down from above). */
  CAM_PITCH_MAX: 1.2,
  /** rad per pixel of mouse movement. */
  CAM_MOUSE_SENSITIVITY: 0.0025,
  /** m — how far one wheel notch changes the target arm length. */
  CAM_WHEEL_STEP: 0.9,
  /** m — user wheel-zoom clamp, applied as an offset around the blended base. */
  CAM_MIN_DISTANCE: 2.5,
  CAM_MAX_DISTANCE: 18.0,
  /** m — pull-in padding when the arm hits a building, so the near plane never
   *  ends up inside the wall. */
  CAM_COLLISION_PADDING: 0.2,

  /**
   * Camera near/far planes. NOT inlined at the construction site on purpose:
   * Phase 2's larger world must raise `near` to ~0.3–0.5 alongside a far plane
   * of ~8,000–12,000 m. Raising `far` while leaving `near` at 0.1 is a
   * documented z-fighting trap. Keeping both here makes that a one-line change.
   */
  CAM_NEAR: 0.1,
  CAM_FAR: 2000,
};

/** Frozen snapshot of the shipped defaults, for the debug UI's reset and for tests. */
export const DEFAULT_TUNING = Object.freeze({ ...TUNING });

/**
 * Restore every value in `TUNING` to its shipped default, in place.
 * In place, because lil-gui controllers hold a reference to the live object.
 */
export function resetTuning() {
  Object.assign(TUNING, DEFAULT_TUNING);
}

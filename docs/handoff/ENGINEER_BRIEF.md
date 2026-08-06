# Engineer Brief — Phase 1: Hero Locomotion Vertical Slice

**Status:** ready to implement. **This is the ONLY document you need.** Everything required to
build Phase 1 is below — exact dependencies, file list, math, constants, and acceptance criteria.
If you find yourself wanting to open `PHASE_1_SPEC.md`, `REVIEW_FLAGS.md`, `RESEARCH_FINDINGS.md`,
or `RESEARCH_LA_WORLDBUILDING.md`, stop — the answer is meant to be here. (Their content was
folded in during review; a few small numeric corrections were made along the way and are called
out inline and in the Appendix.)

**Branch:** `feat/3d-open-world`. **Do not push to `main`.** Work happens in `kodaman3d/`, a new
subdirectory. `kodaman_prototype.html` at the repo root is the 2D reference implementation and
must **never** be edited, referenced by import, or modified in any way.

---

## 1. Scope statement and non-goals

**Phase 1 ships exactly one thing:** a hero who can walk and fly on one hand-authored ~300×300 m
LA street block, viewed through a third-person camera, driven by a working fixed-timestep game
loop. That's the whole slice. Every acceptance criterion in §12 traces back to one of: loop
correctness, locomotion feel, camera behavior, or collision correctness.

**Explicit non-goals — none of the following exist in Phase 1, even as a stub beyond input
plumbing:**

- No combat, no enemies, no hit reactions, no HP.
- No dialogue, no quests, no quest state machines, no quest selector.
- No chunk streaming, no LOD tiers, no multi-district world. One block, fully resident, always.
- No interiors, no scene transitions.
- No companions.
- No named characters, companies, or locations of any kind. The hero is **"the hero."** Buildings
  are generic (`lowrise` / `midrise` / `tower`). Do not invent placeholder proper nouns either —
  that naming exercise is blocked pending user sign-off on the trademark mapping table and is not
  your job. If you need a variable name, use a generic one (`hero`, `heroGroup`, `district`, not
  any character or place name from the source 2D game or any invented substitute).
- No physics engine. The hero's capsule controller is 100% hand-rolled, and stays that way
  permanently (see §2) — this is not a temporary Phase 1 simplification.
- No post-processing (`EffectComposer` is Phase 7), no audio, no save/load, no minimap.
- No glTF models, no skeletal animation, no real cloth simulation. The hero is primitive-built
  (boxes/capsules/spheres) with a CPU-animated cape.

If a task is not named in §3's file tree, it is out of scope. See §13 for a longer list of
specific traps.

---

## 2. Dependencies — exact, pinned, one-line rationale each

Pin exactly (no `^`, no `~`) so you and QA resolve identical dependency trees.

| Package | Version | Type | Rationale |
|---|---|---|---|
| `three` | `0.185.1` | dependency | Core rendering engine (r185). Pinned exactly so behavior is reproducible; this exact version is what the renderer/camera/shadow guidance below was verified against. |
| `vite` | `7.3.6` | devDependency | Dev server + bundler. Conservative pin over 8.1.x — broader plugin ecosystem maturity, same Node engine requirement (`^20.19.0`), no feature Phase 1 needs from v8. |
| `vitest` | `4.1.10` | devDependency | Pure-logic unit test runner, `environment: 'node'` — no WebGL/DOM. Targets `Collision.js` and `LocomotionController.js`, the two modules that must be deterministic and testable. |
| `lil-gui` | `0.21.0` | devDependency | Live-tunable debug UI for every movement/camera constant. This is a **required deliverable**, not a nicety — QA and future retuning depend on it. |
| `stats.js` | `0.17.0` | devDependency | FPS/frame-time HUD panel. Cheap, standard, needed to verify the ≥60 fps acceptance criterion. |

**Node/tooling already verified on the dev machine:** Node v20.20.2, npm 10.8.2, git 2.50.1, gh
2.94.0. Node 20.20.2 satisfies Vite 7's `^20.19.0 || >=22.12.0` engine requirement — `npm install`
must produce **zero** `EBADENGINE` warnings.

### No physics engine in Phase 1 — and this is permanent for the hero, not temporary

The hero is the only collider in Phase 1 and the block is 12 static boxes. A ~150-line kinematic
capsule controller with analytic ground-raycast + AABB push-out resolution is less integration
complexity than wiring a physics engine: no async WASM init gate blocking the game loop's start,
no ~700–850 KB gzipped download, no physics-body↔`Object3D` transform sync step every frame.
Concretely, even physics-engine character controllers (including Rapier's own
`KinematicCharacterController`) do not apply gravity for you and are commonly paired with a manual
ground raycast anyway — a hand-rolled controller is not skipping a hard problem, it is doing the
same core technique a physics-engine-based one would still need.

**Rapier enters in Phase 3 — for props, enemies, and vehicles only, never for the hero.** When it
arrives, it must be `@dimforge/rapier3d-compat` (base64-embedded WASM, async-init, bundler-safe) —
**never** raw `rapier3d`, whose raw `.wasm` import is documented to break under Vite's default
bundling (dimforge/rapier.js#49). Load it via dynamic `import()` so Phase 1/2 bundles never pay
the download cost. **The hero's movement/flight controller stays hand-rolled forever**, even after
Rapier lands — migrating tuned, game-specific flight feel onto a generic physics character
controller is a real regression risk for zero capability gain (Rapier's controller doesn't do
gravity or fly-state logic for you either). None of this is Phase 1 work; it's stated here so you
don't second-guess the hand-rolled controller you're about to build.

---

## 3. Complete file tree for `kodaman3d/`

Every file you create in Phase 1 appears below. Nothing else.

```
kodaman3d/
├── index.html                      # single <canvas>-hosting page, loads src/main.js as a module
├── package.json                    # see §2 for exact dependency versions
├── vite.config.js                  # default Vite config; no special plugins needed in Phase 1
├── .gitignore                      # node_modules, dist
├── public/                         # empty in Phase 1 — no static assets to serve
├── src/
│   ├── main.js                     # entry point: construct Game, await game.init(), game.start()
│   ├── core/
│   │   ├── Game.js                 # owns all systems; runs the fixed-timestep loop (§5)
│   │   ├── Renderer.js             # WebGLRenderer construction, resize handling, tone mapping (§4)
│   │   ├── Input.js                # keyboard + pointer-lock mouse state, edge detection (§8)
│   │   ├── Time.js                 # fixed-timestep accumulator, dt clamping, fps tracking (§5)
│   │   ├── Scale.js                # PX_TO_M and other shared world-unit constants (§10)
│   │   └── dispose.js              # shared recursive Object3D disposal utility (§11)
│   ├── entities/
│   │   └── Hero.js                 # primitive-built hero mesh + persona swap + state fields (§6)
│   ├── controllers/
│   │   ├── LocomotionController.js # grounded/takeoff/flying/landing FSM, all tuning math (§6)
│   │   └── CameraRig.js            # spring-arm third-person camera, collision, ground/flight blend (§7)
│   ├── world/
│   │   ├── StreetBlock.js          # the one hand-authored block: buildings, palms, lamps, roads (§9)
│   │   ├── Collision.js            # static Box3 set + capsule ground/AABB resolution, pure logic (§6)
│   │   └── Sky.js                  # static midday sky: hemisphere light, directional light, fog (§9)
│   ├── ui/
│   │   └── DebugHud.js             # stats.js panel + lil-gui folders + DOM state readout (§12)
│   └── config/
│       └── tuning.js                # every movement/camera constant, single source of truth (§6, §7)
└── tests/
    ├── locomotion.test.js          # FSM transitions, hover-hold, framerate-independence (§6, §12)
    └── collision.test.js           # capsule vs ground/box resolution, corner convergence (§6, §12)
```

No other files. If a later need arises that isn't covered here (it shouldn't be, for Phase 1's
scope), that's a signal you've drifted into Phase 2+ territory — see §13.

---

## 4. Renderer decision — `WebGLRenderer`, final, do not deliberate

Use exactly this, in `src/core/Renderer.js`:

```js
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));   // hard cap at 2
renderer.outputColorSpace = THREE.SRGBColorSpace;                // r185 default; set explicitly
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
```

- Pixel ratio is capped at 2 unconditionally — uncapped DPR on a 3× display is the single most
  common browser-3D perf own-goal.
- Resize handler on `window.resize`, debounced one frame; updates camera aspect and renderer size.
- **No `EffectComposer` in Phase 1.** Post-processing is Phase 7. Render straight to the default
  framebuffer.

**Why `WebGLRenderer` and not `WebGPURenderer`, stated once so you never need to weigh it:** the
official CSM (cascaded shadow map) addon that this project's later phases depend on for
long-sightline outdoor shadows is **WebGL-only**; the WebGPU equivalent (`CSMShadowNode`) is
less-mature, thinner-documented prior art. `WebGPURenderer` also commits the project to TSL
materials (or a dual GLSL/WGSL path) against an API that, as of the version this project targets,
is still gaining features — not a frozen surface. Choosing WebGPU now would be expensive to
reverse once world/character code is built against it. This decision applies to the **whole
project (Phases 1–8), not just Phase 1** — a future WebGPU migration is deliberately out of scope
for this entire pipeline and would only be revisited after Phase 8, as an isolated follow-on
project. Do not implement `WebGPURenderer`, do not add a fallback path, do not raise this again.

---

## 5. Game loop shape

Fixed-timestep accumulator. This is required, not a style preference: the tuning constants in §6
are per-frame-at-60-Hz values converted to per-second rates, and a variable timestep would make
flight feel different on a 144 Hz monitor than a 60 Hz one. It also makes the locomotion FSM
deterministic, which is what makes the unit tests in §12 meaningful.

```js
// core/Game.js
const FIXED_DT  = 1 / 60;   // simulation step, seconds — do not change
const MAX_STEPS = 5;        // spiral-of-death guard

start() {
  this._raf = requestAnimationFrame(this._tick);
}

_tick = (nowMs) => {
  this._raf = requestAnimationFrame(this._tick);

  const raw = (nowMs - this._lastMs) / 1000;
  this._lastMs = nowMs;
  this.accumulator += Math.min(raw, 0.25);        // clamp tab-out/debugger-pause spikes

  let steps = 0;
  while (this.accumulator >= FIXED_DT && steps < MAX_STEPS) {
    this.fixedStep(FIXED_DT);
    this.accumulator -= FIXED_DT;
    steps++;
  }
  if (steps === MAX_STEPS) this.accumulator = 0;   // give up rather than spiral

  const alpha = this.accumulator / FIXED_DT;        // leftover fraction, for render interpolation
  this.render(alpha);
};
```

**Order per fixed step is load-bearing — do not reorder:**

```
1. input.beginStep()
2. locomotion.update(fixedDt, input)      // reads input, writes hero transform
3. world.update(fixedDt)                  // Phase 1: no-op / sky is static, present for shape only
4. cameraRig.update(fixedDt, hero)        // reads the hero's FINAL transform for this step
5. input.endStep()                        // clears this-step edge flags (pressed/released)
```

Camera must update **after** locomotion within the same fixed step, never before — updating it
first (or in a separate, later step) makes the camera lag the hero by one frame and the whole game
reads as soft/laggy.

**Once per rendered frame** (not once per fixed step — a single rendered frame may run 0, 1, or
several fixed steps depending on `accumulator`): `debugHud.update()`, then `renderer.render(scene,
camera)`. Phase 1 does not need render-side interpolation beyond passing `alpha` through — the hero
and camera already update every fixed step at 60 Hz, which is imperceptibly different from
per-frame interpolation at any realistic display refresh rate for this slice's motion speeds. Wire
`alpha` through to `Game.render()` so the seam exists for later phases, but no interpolation logic
is required in Phase 1.

---

## 6. The locomotion controller, in full

`src/controllers/LocomotionController.js` is the heart of the slice. It is a finite state machine
with four states: `grounded`, `takeoff`, `flying`, `landing`. All constants below live in
`src/config/tuning.js` as named exports and must **all** be exposed live in lil-gui (`Locomotion`
folder) — the numbers below are a tuned starting point, not gospel; feel parity with the 2D game
matters more than arithmetic parity, and the user will retune by feel.

### 6.1 Tuning constants (`src/config/tuning.js`)

Converted from the 2D game's per-frame-at-60fps px values using `m/s = px_per_frame × 60 × 0.2` for
velocities and `m/s² = px_per_frame² × 3600 × 0.2` for accelerations (`PX_TO_M = 0.2`, see §10).

| Constant | Value | Unit | Notes |
|---|---|---|---|
| `MAX_SPEED` | 7.5 | m/s | ground walk/run cap |
| `MOVE_ACCEL` | 26.0 | m/s² | ground horizontal acceleration |
| `GRAVITY` | 23.8 | m/s² | applied **only** in `grounded` state when not `onGround` (e.g. walked off a ledge) — see §6.3 |
| `JUMP_FORCE` | 9.4 | m/s | ported from the 2D tuning table; **unused/reserved in Phase 1** — see note below |
| `DASH_SPEED` | 13.0 | m/s | ground Shift speed cap (see F9 note in §6.4) |
| `FLIGHT_DASH_SPEED` | 20.5 | m/s | flight Shift speed cap |
| `FLIGHT_UP_THRUST` | 36.7 | m/s² | climb acceleration while W/Space held in `flying` |
| `FLIGHT_DOWN_THRUST` | 30.2 | m/s² | descend acceleration while S held in `flying` |
| `MAX_FLIGHT_UP_SPEED` | 7.5 | m/s | climb speed cap |
| `MAX_FLIGHT_DOWN_SPEED` | 6.1 | m/s | dive speed cap (in `flying`) |
| `LANDING_DESCENT_ACCEL` | 27.18 | m/s² | `FLIGHT_DOWN_THRUST × 0.9`, used only in `landing` |
| `LANDING_MAX_DOWN_SPEED` | 6.8 | m/s | descent cap during `landing` (distinct from the 6.1 flying cap) |
| `TAKEOFF_CLIMB_SPEED` | 4.8 | m/s | constant forced climb during `takeoff` |
| `TAKEOFF_STEPS` | 12 | fixed steps | duration of `takeoff` = 12 × 1/60 s = 0.2 s |
| `FLIGHT_FINE_MULT` | 0.4 | unitless | multiplies thrust accel + speed caps while J/K/L held (precision aiming) |
| `HOVER_SNAP_SPEED` | 0.11 | m/s | hard snap-to-zero threshold for vertical hover velocity |
| `hoverDampingHalfLife` | 0.065 | s | **see §6.2 — do not derive from `FLIGHT_HOVER_DAMPING`**; lil-gui slider, range 0.05–0.08, default 0.065 |
| `GROUND_FRICTION_PER_SEC` | `Math.pow(0.82, 60)` ≈ 6.75×10⁻⁶ | 1/s (decay factor) | precomputed constant, see §6.2 |
| `AIR_FRICTION_PER_SEC` | `Math.pow(0.92, 60)` ≈ 6.74×10⁻³ | 1/s (decay factor) | precomputed constant, see §6.2 |
| `YAW_SLERP_RATE` | 12.0 | rad/s | hero yaw turn-toward-movement rate |
| `MAX_FORWARD_PITCH` | 1.5 | rad | flight body-pitch cap (Superman-horizontal pose, ≈86°) |
| `PLAYABLE_HALF_EXTENT` | 150.0 | m | ±150 m on X and Z from origin = 300 m playable square (§9) |

**`JUMP_FORCE` is carried over from the 2D tuning table for lil-gui completeness but is not applied
anywhere in the Phase 1 FSM below** — takeoff's vertical motion is governed entirely by the scripted
`TAKEOFF_CLIMB_SPEED` constant, not by an initial impulse. Wire the constant into `tuning.js` and
the lil-gui panel so it exists for later retuning, but do not call it from
`LocomotionController.js`. (This is a genuine gap in the source spec — it lists the constant but
never references it in the described FSM. Documented as a default in the Appendix.)

### 6.2 Damping — the F7 correction, mandatory

The 2D game's per-frame damping constants (`GROUND_FRICTION 0.82`, `AIR_FRICTION 0.92`,
`FLIGHT_HOVER_DAMPING 0.18`) do **not** all convert the same way to a per-second rate.

`GROUND_FRICTION` and `AIR_FRICTION` convert fine via `perSecond = factor^60`, applied each fixed
step as `v *= Math.pow(perSecond, dt)`:

```js
// tuning.js — precompute once, not in the hot loop
export const GROUND_FRICTION_PER_SEC = Math.pow(0.82, 60);   // ≈ 6.75e-6
export const AIR_FRICTION_PER_SEC    = Math.pow(0.92, 60);   // ≈ 6.74e-3
```

(If you see `0.82^60 ≈ 6.3e-6` anywhere, that figure is a ~7% arithmetic error in an illustrative
comment in an earlier draft of this spec — harmless, but compute it with `Math.pow`, don't hand-copy
that number. The correct value is `≈ 6.75e-6`.)

**`FLIGHT_HOVER_DAMPING 0.18` must NOT be converted this way.** `0.18^60 ≈ 2.1×10⁻⁴⁵` — so close to
zero that `v *= Math.pow(2.1e-45, dt)` collapses vertical velocity to zero within a single fixed
step at any realistic `dt`. It is not numerically broken (no NaN/Infinity), but it provides **no
usable tuning range** — the constant does nothing until its exponent nears 1.0, at which point tiny
changes swing between "instant" and "never."

**Implement hover damping as its own explicit half-life decay, unrelated to the `factor^60`
formula:**

```js
// applied each fixed step, only in the flying state's hover sub-case (§6.3)
hero.velocity.y *= Math.pow(0.5, dt / hoverDampingHalfLife);   // hoverDampingHalfLife ≈ 0.065 s
if (Math.abs(hero.velocity.y) < HOVER_SNAP_SPEED) {
  hero.velocity.y = 0;
}
```

`hoverDampingHalfLife` is exposed in lil-gui, default `0.065`, slider range `0.05`–`0.08`. This is
what makes "releasing W and S holds altitude" (acceptance criterion 16) actually tunable by feel.

### 6.3 FSM states and transitions

Ported faithfully from the 2D prototype's `updateEntity` (referenced at `kodaman_prototype.html`
L4281–4360 in the source spec — **do not open that file**; the behavior is fully described below).

**`grounded`**
- Horizontal: camera-relative WASD, accelerate toward `MAX_SPEED` (or `DASH_SPEED` while Shift is
  held — see §6.4 on Shift semantics) at `MOVE_ACCEL`; apply `GROUND_FRICTION_PER_SEC` decay to
  horizontal velocity when no directional input is held.
- Vertical: if `Collision.js` reports `onGround === false` (e.g. hero walked off a ledge),
  apply `GRAVITY` (23.8 m/s²) downward. This is the **only** state/case in which `GRAVITY` is ever
  applied. If `onGround === true`, vertical velocity is 0.
- **Transition:** W or Space pressed on the down-edge (this-step-only `pressed` flag, not `down`)
  while `onGround === true` → `takeoff`. (2D equivalent: `jumpPressed && e.onGround`.)

**`takeoff`** (scripted, 12 fixed steps = 0.2 s)
- Vertical velocity is forced to `TAKEOFF_CLIMB_SPEED` (4.8 m/s) for the full duration; gravity is
  off; a `flightActive` flag and a cape-flare visual flag are set true for the duration.
- Horizontal: camera-relative WASD movement basis remains **fully active** during takeoff (F8
  ruling — see below). Do not lock horizontal control out during this state; a scripted-feeling
  "canned" takeoff that ignores steering input contradicts the 2D game's snappy feel.
- After 12 fixed steps elapsed → `flying`.

**`flying`**
- Horizontal: camera-relative WASD continues, same basis as `grounded`, accelerating toward
  `MAX_SPEED` normally or `FLIGHT_DASH_SPEED` while Shift is held (§6.4); `AIR_FRICTION_PER_SEC`
  decay applies when no directional input is held.
- Vertical, evaluated each fixed step:
  - W or Space **held** and `velocity.y < MAX_FLIGHT_UP_SPEED` → apply `FLIGHT_UP_THRUST`
    acceleration upward, clamp to `MAX_FLIGHT_UP_SPEED` (7.5 m/s).
  - else if S **held** → apply `FLIGHT_DOWN_THRUST` acceleration downward, clamp to
    `MAX_FLIGHT_DOWN_SPEED` (6.1 m/s).
  - else (**hover** — neither held) → apply the half-life vertical damping from §6.2. This is the
    "holds altitude when you let go" behavior and is the single most important feel property to
    preserve in the port (acceptance criterion 16).
  - **Gravity is never applied in this state, under any sub-case.** This is a hard rule, not a
    tuning choice — reasserting gravity while `flightActive` is true is a regression, full stop.
- Shift held → raises the effective horizontal speed cap toward `FLIGHT_DASH_SPEED` (20.5 m/s) via
  the existing acceleration curve; **does not touch vertical velocity** — altitude is preserved
  while dashing (F9, acceptance criterion 17).
- J, K, or L held → sets a `fine` input flag (already read by the FSM, produces no ability effect
  in Phase 1 — see §8). While `fine` is true, multiply **both** the active vertical thrust
  acceleration/caps **and** the horizontal acceleration/caps by `FLIGHT_FINE_MULT` (0.4) — this
  visibly slows all flight movement for precision aiming, satisfying acceptance criterion 21, with
  zero ability logic attached.
- Body pitch (visual only, applied to the hero's torso/root): `pitch = clamp(-velocity.y / 8, -0.6,
  1.5)` radians — leans the hero toward horizontal at speed, capped at `MAX_FORWARD_PITCH` (1.5 rad
  ≈ 86°) to reproduce the Superman-horizontal pose at max climb/dive rate.
- **Transition:** G pressed (down-edge) → `landing`.
- **Transition:** if `Collision.js` reports ground contact (capsule bottom resolves onto the ground
  plane or a rooftop) while in this state — i.e. the hero flew low enough to touch down without
  pressing G — → `grounded` directly, skipping `landing`.

**`landing`**
- Vertical: apply `LANDING_DESCENT_ACCEL` (27.18 m/s², i.e. `FLIGHT_DOWN_THRUST × 0.9`) downward,
  clamped to `LANDING_MAX_DOWN_SPEED` (6.8 m/s). Gravity is **not** used here either — this is a
  scripted controlled descent, distinct from `GRAVITY`.
- Horizontal: camera-relative WASD remains fully active (F8, same rule as `takeoff`).
- **Transition:** W or Space **held** (this one is level-triggered, i.e. `down`, not edge — 2D
  equivalent: `if (e.landing && input.jumpHeld) e.landing = false`) → aborts back to `flying`.
- **Transition:** ground contact (per `Collision.js`) → `grounded`.

### 6.4 Movement basis, yaw, and Shift semantics

**Camera-relative movement.** The 2D game is 1-axis; in 3D, WASD input is projected through the
camera: take the camera's forward vector, zero its Y component, normalize — that's forward; its
perpendicular in the XZ plane is right. W/S/A/D combine into a desired horizontal direction in this
basis, in **all four FSM states** (F8 ruling, stated explicitly here so it is never left to
interpretation: horizontal input is never state-gated, only vertical motion is).

**Yaw.** The hero's yaw slerps toward the desired movement direction at `YAW_SLERP_RATE` (12 rad/s)
— not an instant snap. If there is no horizontal input, yaw holds its current value.

**Shift is a speed-cap raise, not an impulse (F9).** `ShiftLeft`/`ShiftRight` held raises the
*target* the existing acceleration curve pursues — `MAX_SPEED → DASH_SPEED` on the ground,
`MAX_SPEED → FLIGHT_DASH_SPEED` in flight — while held. It is not a one-shot burst/teleport and
needs no separate impulse code path; releasing Shift simply lowers the target back down and the
existing `MOVE_ACCEL`/thrust acceleration decelerates toward the lower cap.

### 6.5 Collision — `src/world/Collision.js`

Pure functions, **no Three.js scene access** — this is the module the unit tests target directly.

**State:** a static `Array<Box3>` for the 8–12 buildings, plus 4 additional thin, tall `Box3`
perimeter boundary volumes forming a box around the 300×300 m playable extent at
`±PLAYABLE_HALF_EXTENT` on X and Z (this is how criterion 12, "hero cannot leave the playable
extent," is implemented — the boundary participates in the exact same horizontal push-out logic as
buildings, no special-case boundary code; the source spec does not name a specific mechanism for
this, so this is the chosen default — see Appendix). A ground plane is implicit at `y = 0`.

**`resolveCapsule(position, radius, height, boxes)`:**
1. **Vertical:** raycast straight down from `position` against the ground plane and building-roof
   top faces. On the nearest hit at or below the capsule's current bottom, snap `y` so the capsule
   bottom rests exactly on the surface and set `onGround = true`. If no hit within the capsule's
   fall tolerance for this step, `onGround = false`.
2. **Horizontal:** for each candidate box (including the 4 boundary volumes), compute the closest
   point on the box to the capsule's vertical center segment; if the distance is less than
   `radius`, push the capsule out along the minimum-penetration axis by the penetration depth. Run
   **two iterations** of this pass so corner cases (capsule wedged between two boxes) converge
   without jitter.
3. **Broadphase:** linear scan over all ~16 boxes (12 buildings + 4 boundary volumes). A spatial
   hash is premature at this count — do not add one (see §13).

`radius = HERO_RADIUS_M` (0.35 m), `height = HERO_HEIGHT_M` (1.85 m) — from `Scale.js`, §10.

---

## 7. Camera rig — `src/controllers/CameraRig.js`

A spring-arm ("boom") third-person rig, hand-rolled (Three.js has no native `SpringArm` object).

**Pivot:** hero position + `(0, 1.5, 0)`.

**Desired camera position:** `pivot + sphericalOffset(yaw, pitch, distance)`. Mouse movement
(pointer-locked, see §8) drives `yaw` (unbounded, accumulates freely) and `pitch` (clamped to
`[-0.5, 1.2]` radians — do not let pitch wrap or the camera flips).

**Smoothing — critically damped exponential, not naive per-frame lerp:**

```js
const lambda = 6.32;                          // derived below — do not re-derive or change casually
const t = 1 - Math.exp(-lambda * dt);
currentCameraPos.lerp(desiredCameraPos, t);
```

`lambda ≈ 6.32` is the exact framerate-independent equivalent of the 2D camera's `camera.x += (dx -
camera.x) * 0.1` per-frame lerp at 60 fps: `lambda = -60 * ln(1 - 0.1) ≈ 6.32`. Apply the same
formula (same `t`, same `lambda`) to yaw/pitch/distance/FOV smoothing wherever this rig eases
toward a target value — one damping constant, reused everywhere in this file, not a different ad
hoc lerp per property.

**Collision:** raycast from `pivot` toward the desired camera position against the building `Box3`
set from `Collision.js` (reuse the same static box list — do not maintain a second copy). On a hit,
pull the camera in to `hitDistance - 0.2` (0.2 m padding to avoid near-plane clipping into the
wall). Recover back out to the full desired distance using the same exponential smoothing as
everything else in this rig — do not snap back instantly.

**Ship a plain raycast, not a sphere-cast, for Phase 1 (F10 ruling).** Research recommends a
sphere-cast to account for the camera's near-plane volume and avoid corner-clipping, but Phase 1's
geometry is large flat-faced building AABBs with no thin/sharp obstacles, and the 0.2 m padding
already absorbs most of what a sphere-cast would buy at `near = 0.1`. **Named fallback, not a
silent gap:** if QA finds visible near-plane clipping at building corners during acceptance
testing, upgrade this one raycast to a sphere-cast then — do not preemptively build the
sphere-cast now.

**Ground/flight parameter blend.** Two named parameter sets, cross-faded over a 0.6 s timer
whenever the FSM state crosses the grounded/airborne boundary (i.e. on `grounded → takeoff` and on
`landing/flying → grounded`):

| | distance | height offset | FOV |
|---|---|---|---|
| grounded | 6.0 m | 1.5 m | 60° |
| flying (takeoff/flying/landing) | 9.0 m | 2.2 m | 70° |

Interpolate distance/height/FOV linearly (or with the same exponential smoothing — either is
acceptable, but be consistent) across the 0.6 s window; this cross-fade is what acceptance
criterion 24 checks for ("visible cross-fade... not a cut"). FOV widening on takeoff is the
cheapest speed-sensation trick available — on top of the ground/flight base FOV, add **`+8°`
scaled by `speed / FLIGHT_DASH_SPEED`** while Shift-dashing in flight (criterion 17's "surge" should
visibly widen FOV further).

**Near/far planes:** `near = 0.1`, `far = 2000`. This is generous for a 300 m block. **This pair
must not simply be kept as-is when the world grows in later phases** — Phase 2's larger world needs
`near` to scale up alongside `far` (roughly `near 0.3–0.5` / `far 8,000–12,000`) to avoid z-fighting;
leaving `near = 0.1` while raising `far` alone in a later phase is a documented risk, not a Phase 1
concern, but do not hardcode `near = 0.1` anywhere it would be awkward to change later (put it in
`tuning.js`, not inlined).

---

## 8. Input mapping — `src/core/Input.js`

Preserves the 2D prototype's key bindings exactly. Track `event.code` (physical key position, not
`event.key`) — layout-independent, matches the 2D game's approach.

| Key | Action | Phase 1 behavior |
|---|---|---|
| `KeyW` / `KeyA` / `KeyS` / `KeyD` | move | camera-relative horizontal movement basis, active in all 4 FSM states (§6.4) |
| `KeyW` (down-edge) on ground | take off | triggers `grounded → takeoff` — see tap/hold note below |
| `Space` | alias for W | same edge/held semantics as `KeyW` throughout |
| `KeyS` | descend while flying | held-based, see §6.3 `flying` vertical logic |
| `KeyG` (down-edge) | toggle landing | `flying → landing` |
| `ShiftLeft` / `ShiftRight` | dash / flight speed-cap raise | held-based, see §6.4 |
| `KeyQ` | persona toggle super ↔ civilian | instant material-only swap, see §9's Hero note |
| Mouse move (pointer-locked) | camera yaw/pitch | accumulate `movementX/movementY` into `look.dx/dy`, consumed and zeroed every fixed step |
| Mouse wheel | camera distance | adjusts the *target* distance the ground/flight blend (§7) eases toward, not an instant jump |
| `Escape` | release pointer lock | standard `document.exitPointerLock()` |
| `KeyJ` | punch | **stub** — sets `input.fine = true` while held (§6.3), logs to console once per press-edge, no combat effect |
| `KeyK` | laser | **stub** — same as `KeyJ` |
| `KeyL` | freeze | **stub** — same as `KeyJ` |
| `KeyZ` | block | **stub** — wired into the input struct, logs, no effect |
| `KeyC` | dodge roll | **stub** — wired into the input struct, logs, no effect |
| `F1` | toggle debug overlay | shows/hides the DOM readout in `DebugHud.js` |

**Tap-vs-hold discrimination for W — concrete resolution.** There is no genuine time-based tap/hold
timer. Takeoff triggers on the **down-edge** of W or Space — i.e. the single fixed step in which
the key transitions from up to down (`Input.js`'s `pressed` flag, cleared every step by
`endStep()`). This edge window is inherently **≤ 1 fixed step = 16.67 ms** at 60 Hz — there is no
duration measurement beyond that. Critically, pressing-and-holding W behaves identically to a quick
tap for *triggering* takeoff (the edge fires once, regardless of how long the key stays down
afterward), and the continued hold is simply read again as "W held" once the FSM is already in
`takeoff`/`flying`, driving the climb. This is intentional and requires no separate debounce logic
— it's the same input state machine (`down` + `pressed` + `released` per key) used for every other
key.

**Other input hygiene requirements (already in the file tree, stated here for completeness):**
- `event.preventDefault()` on `Space` and arrow keys (prevents page scroll).
- A `window.blur` handler that clears **all** key state — prevents a stuck-key bug when the user
  alt-tabs mid-flight (this is what acceptance criterion 27 verifies).
- Click-to-lock: clicking the canvas calls `requestPointerLock()`.

---

## 9. The street block — `src/world/StreetBlock.js`

Data-driven from a local exported array (`BLOCK = { buildings: [...], palms: [...], lamps: [...] }`)
so Phase 2 can generalize the pattern into per-district data files without a rewrite.

### 9.1 Street dimensions — grounded in the real LA standard, not invented

The primary boulevard in this block uses the City of LA's **Standard Plan S-470-1 "Avenue I"**
class (Secondary Highway) — this is the real classification of Hollywood Blvd, Sunset Blvd, and
Wilshire Blvd (west of Beverly Hills), making it the correct choice for an "iconic LA boulevard"
feel:

| Element | Value (exact, from S-470-1) |
|---|---|
| Right-of-way (property line to property line) | 100 ft = **30.48 m** |
| Roadway (curb to curb) | 70 ft = **21.34 m** |
| Sidewalk, each side | 15 ft = **4.57 m** (includes the parkway/planting strip — S-470-1 does not separately dimension it) |
| Half-roadway | 35 ft each direction |
| Typical travel lanes | 4 |

Build the boulevard to these exact figures: **30.48 m total ROW, 21.34 m roadway, 4.57 m sidewalk
each side** (`21.34 + 4.57×2 = 30.48`, confirms). Use **11 ft (3.35 m)** standard travel lane width
per the LA Street Design Manual (E 612.2) to lay out the 4 lanes within the 21.34 m roadway (≈5.34
m per lane at 4 lanes, or use a center turn lane / median split if you prefer visual variety — not
prescribed further, use judgment).

### 9.2 Block and world layout

| Element | Value |
|---|---|
| Block footprint | 100 m × 100 m buildable core |
| Boulevard right-of-way | 30.48 m (§9.1) |
| Playable extent | 300 m × 300 m, hard-clamped via the 4 boundary volumes in `Collision.js` (§6.5) |
| World origin | `(0, 0, 0)` at the geometric center of the block; ground plane at `y = 0` |
| Axis convention | +X and +Z are the horizontal ground-plane axes; +Y is up (§10) |
| Extent from origin | ±150 m on both X and Z |
| Building count | 8–12 |
| Building heights | 4 × low-rise 8–12 m, 4 × mid-rise 20–35 m, 2 × tower 60–90 m |

This 300×300 m figure is **Phase 1's own scope, independent of the larger world-scale reconciliation
(2,048×2,048 m built target) that governs Phase 2's multi-district world.** Do not attempt to make
Phase 1's block "fit into" or anticipate the Phase 2 world grid — Phase 1 ships exactly one
self-contained block; Phase 2 replaces it with real streamed geography.

**Palms:** `Washingtonia robusta`, 12–18 m tall, spaced 12 m along the boulevard parkway (the strip
within the 4.57 m sidewalk zone nearest the curb).

**Buildings:** `BoxGeometry` per building, with either a per-face material array or a simple
window-strip texture drawn to an offscreen `<canvas>` at init time (mirrors the 2D game's
`drawWindowRow` technique) and applied as a `CanvasTexture`. Mixed heights per the table above,
arranged around the block core.

**Roads:** one large `PlaneGeometry` for the asphalt (colored, not textured, in Phase 1), plus thin
`BoxGeometry` curbs at the roadway/sidewalk boundary and a dashed centerline (either a thin
repeated-segment geometry or a simple canvas-texture strip — implementation detail, use judgment).

**Instancing:** use **`InstancedMesh` for palms and lamps even at this small count.** This costs
nothing at 8–20 instances and establishes the pattern Phase 2's `Instancing.js` depends on — do not
build individual meshes per palm/lamp "because there are only a few," since that pattern would need
to be thrown away in Phase 2 anyway.

### 9.3 Sky and lighting — `src/world/Sky.js`

Static midday only — no day/night cycle (that's Phase 2).

- `DirectionalLight`, intensity 2.5, position `(80, 120, 60)`, `castShadow = true`.
- Shadow camera: orthographic, `±60` frustum, `near = 1`, `far = 400`, shadow map `2048×2048`,
  `bias = -0.0005`, `normalBias = 0.02`.
- `HemisphereLight(skyBlue, groundTan, 0.6)`.
- `THREE.Fog(0xbfc9d4, 120, 900)` — a blue-grey LA haze tint, not neutral grey. These fog distances
  are a fixed Phase 1 placeholder; do not treat them as researched atmospheric truth (a separate,
  not-yet-closed research item covers real LA haze/visibility numbers, and it targets Phase 2's sky
  upgrade, not Phase 1).
- Use either the `Sky` object from `three/addons/objects/Sky.js` **or** a flat hemisphere-tinted
  background color + the `Fog` above — prefer the simpler flat-color-plus-fog version for Phase 1;
  save the animated `Sky` object for when Phase 2 adds day/night.

### 9.4 The hero mesh — `src/entities/Hero.js`

Primitive-built, zero external assets, per the deliberate low-risk Phase 1 choice (glTF characters
arrive in Phase 5 — do not pull in `GLTFLoader` or any model file in Phase 1).

A `THREE.Group` named `hero`, containing:
- torso: `CapsuleGeometry(0.28, 0.6)`
- head: `SphereGeometry(0.16)`
- arms/legs: 4 × `CapsuleGeometry(0.09, 0.5)`, each in its own named sub-group so a future phase can
  swap in bones without restructuring the hierarchy
- cape: `PlaneGeometry(0.7, 1.1, 4, 6)`, `side: THREE.DoubleSide` — animate with a CPU-side sine
  wobble on the position attribute (no vertex shader, no cloth sim) each frame: displace vertices
  by something like `Math.sin(capePhase + t * 3)` scaled by a speed-driven trail factor and a
  flight-dependent lift, matching the 2D game's cape motion qualitatively (fast, snappy, no floaty
  overshoot). Exact waveform constants are not prescribed further — tune by eye against the 2D
  reference's feel, not its exact pixel path.

**State fields on the hero object:** `{ persona: 'super' | 'civilian', facing: number (yaw
radians), velocity: THREE.Vector3, onGround: boolean, flightActive: boolean, landing: boolean }`.

**`setPersona(p)`** swaps material **colors only** — super: primary blue `#3a6fd9` body, red cape;
civilian: muted jacket tones. **No mesh rebuild, no geometry swap, no disposal call needed** for
this operation — this is what keeps the Q toggle instant and hitch-free (acceptance criterion 26).

---

## 10. Coordinate system and units

**Y-up, metres, right-handed** — Three.js/WebGL's standard convention. This is the single most
common failure mode when porting a 2D canvas game to 3D (coordinate-handedness and scale mixups),
so read this section carefully and do not improvise.

**The 2D game is Y-down, origin top-left, pixel units, single horizontal world axis** (it's a
side-scroller: `WORLD_WIDTH = 20000` px, `GROUND_Y = 1000` px, canvas 960×540, hero drawn at
`52w × 100h` px). None of that carries over directly. The mapping:

- **2D world-X (px, the side-scroller's single horizontal axis) → 3D X (m).** Scale factor:
  **`PX_TO_M = 0.2`**. So the 20,000 px corridor becomes a 4,000 m spine — this is the number used
  when porting any 2D *position* value (landmark placement, etc.) into 3D, in later phases.
- **3D Z is a new axis that does not exist in the 2D game.** It's the lateral/depth axis introduced
  by moving from a side-scroller to full 3D — street width, camera orbit, and strafing all use Z.
  There is no 2D value to port for it; author it directly in metres.
- **3D Y (up) is not a direct port of 2D's vertical canvas coordinate.** The 2D game's vertical
  canvas-Y encodes jump/flight height relative to `GROUND_Y`; in 3D this becomes literal height
  above the `y = 0` ground plane, in metres, governed by the locomotion constants in §6 — it is not
  scaled by `PX_TO_M` (see below), it's a fresh metric quantity.
- **Two independent scales — do not conflate them:**
  - **Position/placement scale:** `PX_TO_M = 0.2` (m per 2D px), used for *where things are placed*.
  - **Character/object real-world scale:** actual metres, `HERO_HEIGHT_M = 1.85`, `HERO_RADIUS_M =
    0.35`. **Not** `100px_hero_height × 0.2 = 20 m`. The 2D game deliberately draws the hero
    oversized relative to its own world so it reads clearly at 960×540; porting that ratio into 3D
    would produce a 20 m giant walking through a normal-scale city. Positions port through the 0.2
    scale; physical dimensions do not, ever.

`src/core/Scale.js` exports:

```js
export const PX_TO_M = 0.2;
export const HERO_HEIGHT_M = 1.85;
export const HERO_RADIUS_M = 0.35;
export const px = (n) => n * PX_TO_M;   // helper for any future 2D-px → 3D-m position conversions
```

**Handedness / orientation convention (not specified upstream — this is the chosen default, follow
it exactly so hero-facing math and camera math agree):** yaw `0` corresponds to the hero (and
camera, when unrotated) facing **−Z**, matching Three.js's default camera-forward convention.
Positive yaw is a counterclockwise rotation viewed from above, i.e. the standard right-hand rotation
about `+Y`. Every yaw/facing calculation in `LocomotionController.js` and `CameraRig.js` must use
this same convention — do not let one module treat +yaw as clockwise and the other counterclockwise.

---

## 11. Disposal and memory discipline

Three.js does **not** garbage-collect GPU resources when an object leaves the scene graph —
`scene.remove(mesh)` only detaches it from rendering; `BufferGeometry`, `Material`, and any
`Texture` keep GPU buffers allocated until `.dispose()` is called explicitly on each, and disposing
a material does **not** dispose textures it references (a texture can be shared across materials
and must be freed independently). This is a well-documented, easy-to-hit Three.js footgun, and the
pattern must be established starting with the **first** file that creates disposable resources —
not retrofitted later.

**Write one shared utility, `src/core/dispose.js`, in Phase 1, even though Phase 1's own runtime
churn is minimal:**

```js
// core/dispose.js
export function disposeObject3D(root) {
  root.traverse((node) => {
    if (node.geometry) node.geometry.dispose();
    if (node.material) {
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      for (const mat of materials) {
        for (const key of Object.keys(mat)) {
          const value = mat[key];
          if (value && value.isTexture) value.dispose();
        }
        mat.dispose();
      }
    }
  });
}
```

**Where this gets called in Phase 1, specifically:**
- The canvas-drawn window-strip `CanvasTexture`(s) created at `StreetBlock` init should be tracked
  so they can be disposed on teardown — relevant primarily for Vite's dev-server hot module reload
  (HMR), which will otherwise leak geometries/textures on every source-file save during development.
- `Game.js` must expose a `destroy()` method that calls `renderer.dispose()` and
  `disposeObject3D(scene)`. This is not cosmetic: without it, iterative `npm run dev` work leaks a
  full scene's worth of GPU resources on every HMR reload, which will visibly show up in
  `renderer.info.memory` during exactly the kind of development session this brief is written for.
- `setPersona()` on `Hero.js` does **not** call this utility — it only swaps material colors, no
  geometry/material/texture is created or destroyed by a persona swap (§9.4). Do not add a spurious
  dispose call there.
- `renderer.info.memory.geometries` / `.textures` are the free built-in counters — acceptance
  criterion 28 (flat memory over 5 min idle) is verified by reading these, not by instrumenting
  anything custom.

Every later phase that swaps glTF models at runtime (Phase 5's persona/companion swaps, Phase 2's
streamed chunk unloading) reuses this exact utility — do not let a later phase reinvent it.

---

## 12. Acceptance criteria

Every item below is written to be checked pass/fail without judgment calls. Each is tagged with how
QA verifies it:

- **`[VITEST]`** — pure-logic unit test, no WebGL/DOM, `environment: 'node'`. Deterministic,
  runs in CI.
- **`[HEADLESS]`** — verifiable via a headless/automated browser (Playwright or equivalent) reading
  `renderer.info`, `camera.fov`, scene-graph state, or console output. Reliable for correctness and
  resource counts; **not** reliable for frame-pacing/fps, since default headless Chrome does not use
  real GPU acceleration (falls back to software rendering) — a `[HEADLESS]`-tagged fps number is not
  evidence of real-player performance.
- **`[HUMAN]`** — requires a person at a real GPU, real display, real input devices. Subjective feel,
  visual smoothness, and exploratory checks (does the camera clip *anywhere*, not just at one
  scripted position) are not automatable; do not let a QA agent report these as passed from a
  headless run.

### Build & run
1. `[HEADLESS]` `npm install` completes on Node 20.20.2 with zero `EBADENGINE` warnings.
2. `[HEADLESS]`+`[HUMAN]` `npm run dev` serves the page; zero console errors and zero Three.js
   warnings on load (console-checkable headlessly); the block visibly renders correctly (human
   confirms it looks right, not just that it didn't throw).
3. `[HEADLESS]` `npm run build` succeeds; `npm run preview` serves the built bundle and it loads
   with zero console errors, matching `npm run dev` behavior.
4. `[VITEST]` `npm test` passes; both `tests/locomotion.test.js` and `tests/collision.test.js` are
   present and green, covering at minimum: FSM transitions (`grounded`→`takeoff`→`flying` after 12
   steps, `flying`↔`landing`, landing-abort), hover-hold (`velocity.y → 0` within 30 steps and stays
   0 for 60 more), flight dash preserves altitude (±0.01 m over 60 steps), gravity never applied
   while `flightActive`, damping is framerate-independent (simulating 1 s as 60×(1/60) vs.
   120×(1/120) yields matching velocity within 1e-3), capsule-on-ground reports `onGround`, capsule
   pushed out of a box never passes through it, corner case converges without jitter, capsule lands
   on a rooftop not the ground plane when above one.

### Rendering
5. `[HUMAN]` Debug overlay reports ≥60 fps sustained on the dev machine at 1920×1080. **Do not
   accept a headless fps reading as satisfying this criterion.**
6. `[HEADLESS]` `renderer.info.render.calls` is < 60 on a static frame.
7. `[HUMAN]` Shadows are visible and stable — no shadow acne, no swimming as the hero moves.
8. `[HEADLESS]`+`[HUMAN]` Window resize updates camera aspect and renderer size without distortion
   (headless: assert `camera.aspect` matches new dimensions, `renderer.getPixelRatio() <= 2`);
   visual sharpness/no blur is a human check.

### Ground movement
9. `[HUMAN]` WASD moves the hero relative to the camera; yaw turns to face the travel direction
   smoothly (not a snap).
10. `[VITEST]`+`[HUMAN]` Shift on the ground raises the effective speed cap toward `DASH_SPEED` (13.0
    m/s) — the cap value itself is a `[VITEST]`-checkable pure function; that it "feels" like a
    visible speed increase in play is `[HUMAN]`.
11. `[VITEST]`+`[HUMAN]` Hero cannot pass through a building `Box3` (`[VITEST]`, exercised directly
    against `Collision.js`); that sliding along a wall reads as smooth, not sticky/jittery, is
    `[HUMAN]`.
12. `[VITEST]` Hero cannot leave the 300 m playable extent — exercised directly against the 4
    boundary `Box3` volumes in `Collision.js`.
13. `[VITEST]` Hero does not fall through the ground plane at any velocity — a high-speed capsule
    still resolves onto the ground raycast within one fixed step.

### Flight — the phase's real test
14. `[HEADLESS]`+`[HUMAN]` Tapping W on the ground triggers `grounded → takeoff → flying`
    (`[HEADLESS]`-checkable via FSM state); camera pulls back and FOV widens per §7's parameter
    table (`[HEADLESS]`-checkable via `camera.fov`); "visible burst" quality is `[HUMAN]`.
15. `[VITEST]` Holding W climbs, capped at `MAX_FLIGHT_UP_SPEED` (7.5 m/s); holding S descends,
    capped at `MAX_FLIGHT_DOWN_SPEED` (6.1 m/s).
16. `[VITEST]` Releasing both W and S holds altitude: `y` drift < 0.05 m over 3 simulated seconds;
    gravity is never applied while `flightActive` is true, verified directly against the FSM code
    path, not just observed behavior.
17. `[VITEST]` Shift while flying raises the horizontal speed target toward `FLIGHT_DASH_SPEED` (20.5
    m/s) with `y` unchanged (±0.01 m) across 60 steps of Shift-held dash with no vertical input.
18. `[VITEST]` G begins `landing`; hero's `onGround` becomes true and FSM returns to `grounded` once
    the capsule resolves onto the ground.
19. `[VITEST]` Pressing (holding) W during `landing` aborts back to `flying` before ground contact.
20. `[HUMAN]` Hero can fly above the tallest tower (90 m) and land on its roof — full-scene
    integration behavior (rendering + collision + FSM together), best verified by a person actually
    flying there, though a `[HEADLESS]` scripted-input smoke test that drives the hero to a known
    rooftop position and checks `onGround === true` is an acceptable automated proxy.
21. `[VITEST]`+`[HUMAN]` Holding J, K, or L while flying sets `fine = true` and multiplies active
    thrust/caps by `FLIGHT_FINE_MULT` (0.4) — `[VITEST]`-checkable directly; that no ability fires is
    a trivial `[HUMAN]` absence-check (nothing should happen beyond the slowdown and a console log).

### Camera
22. `[HUMAN]` Mouse look orbits smoothly under pointer lock; pitch clamps at `[-0.5, 1.2]` rad
    without a visible snap.
23. `[HUMAN]` Camera never penetrates a building at any hero position/angle — this needs exploratory
    traversal (walking the hero along multiple walls from multiple approach angles), not a single
    scripted path; pulls in smoothly and recovers smoothly on stepping away.
24. `[HEADLESS]`+`[HUMAN]` Ground↔flight camera transition completes its interpolation over ~0.6 s
    (`[HEADLESS]`-checkable by sampling distance/FOV over time against the timer); reading as a
    genuine cross-fade rather than a cut is `[HUMAN]`.
25. `[VITEST]`+`[HUMAN]` Camera motion is framerate-independent — the exponential smoothing formula
    itself is `[VITEST]`-checkable (same `dt`-scaled result regardless of step rate, same test
    pattern as criterion 4's damping test); confirming no perceptible lag on a real 144 Hz display
    (if available) is `[HUMAN]`.

### Persona
26. `[HEADLESS]`+`[HUMAN]` Q instantly swaps hero appearance super↔civilian with `renderer.info`
    geometry/texture counts unchanged (`[HEADLESS]`, proves no mesh rebuild); no visible hitch is
    `[HUMAN]`.

### Hygiene
27. `[HEADLESS]` Alt-tabbing away mid-flight (simulate via a `blur` event) and back does not leave
    any key stuck in the `down` state and does not produce a velocity/physics spike on refocus
    (assert `accumulator` and key state are sane immediately after).
28. `[HEADLESS]` No memory growth: `renderer.info.memory.geometries` and `.textures` are flat (not
    monotonically increasing) across a 5-minute idle run.

---

## 13. Do-not-do — scope traps to actively avoid

These are the specific ways this slice tends to balloon into Phase 2+ work. If you catch yourself
doing any of these, stop and re-read §1.

- **Do not add combat, enemy AI, hit reactions, or HP.** J/K/L/Z/C are input-plumbing stubs only —
  wire them, log them, do nothing else. That is Phase 3.
- **Do not add any quest/dialogue system**, including the title-screen quest selector already
  present in the 2D game. Phase 1 has zero quest content. That is Phase 4.
- **Do not add chunk streaming, `ChunkManager`, `LOD`, `District`, or multi-block geography.** One
  block, fully resident, no streaming logic of any kind. That is Phase 2.
- **Do not add a day/night cycle, CSM cascaded shadows, or floating-origin/camera-relative
  rendering.** Static midday lighting and a single fixed shadow camera frustum are correct for
  Phase 1's 300 m scale. That is Phase 2.
- **Do not add Rapier or any physics engine dependency**, and do not investigate alternatives — the
  hand-rolled capsule is final for the hero, permanently (§2). That is Phase 3, and only for
  non-hero entities even then.
- **Do not add glTF models, `GLTFLoader`, skeletal animation, `AnimationMixer`, or a real cloth/cape
  simulation.** The hero is primitive-built with a CPU sine-wobble cape, full stop. That is Phase 5.
- **Do not add companions, interiors, or scene transitions.** That is Phase 5/6.
- **Do not add `EffectComposer` or any post-processing pass.** That is Phase 7.
- **Do not add audio, save/load, or a minimap.** That is Phase 7.
- **Do not introduce any named characters, companies, or locations — including invented replacement
  names.** The hero stays "the hero." This is not your call to make even provisionally; the naming
  exercise is explicitly blocked pending user sign-off on a separate mapping table. If you need an
  identifier, use a generic one.
- **Do not deliberate the renderer choice.** `WebGLRenderer` is final and stated in §4 — do not
  spend time evaluating `WebGPURenderer`, do not add a fallback path.
- **Do not derive hover damping from `FLIGHT_HOVER_DAMPING^60`.** Use the explicit half-life decay
  in §6.2. This specific mistake (copying the general `factor^60` conversion onto the hover constant)
  is the single most likely subtle bug in this entire brief if §6.2 is skimmed rather than read.
- **Do not, under any circumstance, edit `kodaman_prototype.html`.** It is read-only reference
  material for this entire pipeline.
- **Do not exceed the 300×300 m playable extent** with any authored content (buildings, palms,
  lamps, or the boulevard itself) — everything must fit within `±150 m` on X and Z.
- **Do not add a spatial hash, BVH, or any collision broadphase optimization.** A linear scan over
  ~16 boxes (§6.5) is correct and sufficient at this scale; adding one is premature optimization
  and unrequested scope.

---

## Appendix — corrections, ambiguities resolved, and defaults chosen

This project's rule is that no agent edits the source review/spec/research documents — findings
that surface after those documents were written land here instead. All of the following are either
(a) already-adjudicated rulings from the review stage, restated here so this brief is self-contained,
or (b) new gaps found while writing this brief and resolved with an explicit default, marked as such.

**Already-adjudicated (carried forward, not new):**
- Renderer: `WebGLRenderer`, project-wide (§4).
- Hero primitive-built rationale citation: the correct source section describes "keep primitive-built
  characters for Phase 1 as already decided" — an earlier spec draft mis-cited a different,
  unrelated section (the trademark audit) at this point. Not relevant to implementation; noted only
  so you're not confused if you ever see the mis-citation elsewhere.
- `GROUND_FRICTION_PER_SEC` correct value is `Math.pow(0.82, 60) ≈ 6.75×10⁻⁶`; an earlier illustrative
  comment elsewhere states `≈ 6.3×10⁻⁶`, about 7% low. Compute with `Math.pow`, never hand-copy an
  illustrative figure (§6.2).
- `FLIGHT_HOVER_DAMPING`'s naive `factor^60` conversion is degenerate (`0.18^60 ≈ 2.1×10⁻⁴⁵`) and
  must not be used — explicit half-life decay instead (§6.2, this is the most important correction
  in the whole brief).
- Horizontal WASD input is active in all 4 FSM states, not gated to `grounded`/`flying` (§6.3, §6.4).
- Shift is a speed-cap raise, not an impulse (§6.4).
- Camera collision ships as a plain raycast + 0.2 m padding, not a sphere-cast, with sphere-cast as
  a named fallback if QA finds corner-clipping (§7).
- Near/far planes (`0.1`/`2000`) are correct for Phase 1 but must not be left at `near = 0.1` when a
  later phase raises `far` for a bigger world (§7).

**New gaps found while writing this brief, resolved with an explicit default:**
- **`JUMP_FORCE` (9.4 m/s) is listed in the ported tuning table but never referenced by any FSM
  transition or state description.** Resolution: wire it into `tuning.js`/lil-gui for completeness
  and future use, but do not call it anywhere in `LocomotionController.js` — takeoff's climb speed
  is fully governed by `TAKEOFF_CLIMB_SPEED` instead (§6.1).
- **The mechanism for enforcing the 300 m playable-extent boundary was not specified upstream.**
  Resolution: 4 thin, tall static `Box3` perimeter volumes reused through the exact same
  horizontal-push-out code path as buildings — no special-case boundary logic (§6.5, §9.2).
- **The yaw-zero orientation/handedness convention was not specified upstream.** Resolution: yaw `0`
  = facing `−Z` (Three.js's default camera-forward), positive yaw = counterclockwise about `+Y`,
  applied consistently in both `LocomotionController.js` and `CameraRig.js` (§10).
- **A concrete tap-vs-hold discrimination threshold for W was requested but the underlying mechanism
  turned out not to need one.** Resolution: takeoff triggers on the down-edge (≤1 fixed step, 16.67
  ms at 60 Hz) via the same edge-detection already used for every key; holding W afterward is read
  continuously for climb, with no separate timer (§8).
- **The exact real-world street-standard figures for Phase 1's boulevard were approximated (30 m
  ROW, 4.5 m sidewalks) rather than cited from source.** Resolution: these approximations were
  already very close to the real figure — the City of LA's S-470-1 "Avenue I" class (100 ft / 70 ft
  / 15 ft = 30.48 m / 21.34 m / 4.57 m ROW/roadway/sidewalk), which is also the real classification
  of Hollywood Blvd, Sunset Blvd, and Wilshire Blvd. This brief cites the precise standard directly
  (§9.1) rather than the rounded approximation — not a contradiction, a refinement.



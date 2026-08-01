# Knowledge Base — 3D Migration Project

**Status:** written by the Overview agent, session 5, 2026-07-31. This is the terminal stage of
the 6-agent pipeline (Research → Review → Design → Engineer → QA → Overview). It exists so a
reader — especially the Phase 2 Research agent — does not have to read fourteen other documents
to know what exists.

**If this file and an older doc disagree, this file is the corrected version** (it was written
after the corrections landed). **If this file and the code disagree, the code wins** — say so
inline rather than silently trusting either.

---

## Quick index

1. What this project is
2. Build wireframe — `kodaman3d/src/`
3. App lifecycle — boot to frame loop
4. The locomotion state machine
5. `tuning.js` — the constants and the hover-damping correction
6. Decisions already made (settled)
7. What is open
8. Map of `docs/handoff/`

---

## 1. What this project is

This is a from-scratch **3D rebuild** of a 16,507-line single-file 2D canvas superhero game
(`kodaman_prototype.html`, repo root). The 2D file is the **design reference** — it is never
edited, has zero diff throughout this project, and stays playable. The 3D build lives entirely
in `kodaman3d/` on branch `feat/3d-open-world` (PR #3 against `dev`, open and unmerged).

**Stack:** Three.js + Vite, npm, ES modules, hot reload. The original single-file/no-build-step
constraint was deliberately abandoned early — this is a locked decision, not an oversight.

**Strategy:** new build, port content forward — not an in-place conversion. LA is rendered with
recognizable landmarks but invented streets (no OSM geodata import). World is meant to be vast
and explorable but explicitly bounded, not endless. Trademarked character/place names from the
2D game (Lois, Wayne, Arkham, LexCorp, Gotham, etc. — ~900 occurrences across 10+ marks) are
**not ported as-is**: the 3D build uses original, legally distinct names from day one, chosen by
the user with agents proposing. This file does not use or repeat any of the old marks or invent
new proper nouns — see the naming section under Open Items.

**Delivery model:** feature branch + PR against `dev`. No agent ever pushes `main`; there is no
deploy target. Six-agent pipeline (Research → Review → Design → Engineer → QA → Overview) with a
human orchestrator gating every handoff — agents do not spawn each other.

**Where the project actually is right now:** Phase 1 (a vertical slice — walk/fly hero, one LA
street block, third-person camera) is built, tested (105/105), and human-verified across four
browser spot-checks. All known visual defects are fixed. PR #3 is open, unreviewed, unmerged.
Phase 2 (broader world, skeletal animation, trademark-safe names, realism pass) has not started.
See §6–7 below for what's settled vs. open.

---

## 2. Build wireframe — `kodaman3d/src/`

15 files, ~5,100 lines (measured directly: `wc -l` across the tree, 2026-07-31 — this
supersedes the "25 files, 6,691/6,691" figures in `PIPELINE_STATE.md`, which counted build
artifacts and docs from an earlier snapshot before Phase 1 closed out).

| File | Lines | Owns |
|---|---:|---|
| `main.js` | 37 | Entry point. Constructs `Game`, awaits `init()`, calls `start()`. Wires Vite HMR teardown to `game.destroy()`. Exposes `window.__game` for headless test/devtools access only — nothing under `src/` may read `window`. |
| `core/Game.js` | 235 | Owns every system instance and runs the fixed-timestep loop (see §3). The orchestration hub — everything else is a system it drives. |
| `core/Time.js` | 158 | Fixed-timestep accumulator: clamps raw frame delta, tracks owed steps, guards against the spiral of death. |
| `core/Input.js` | 311 | Raw keyboard/mouse/pointer-lock state → a derived per-step snapshot (`beginStep`/`endStep`), including edge-triggered flags (`personaPressed`, `debugPressed`) and mouse-delta accumulation. Clears held keys on blur. |
| `core/Renderer.js` | 125 | `WebGLRenderer`, camera, canvas sizing/resize. |
| `core/Scale.js` | 120 | Shared unit-conversion / scale constants used across world and character code. |
| `core/dispose.js` | 88 | `disposeObject3D()` — walks a scene graph and frees GPU geometries/materials/textures. Exists because Vite HMR re-evaluates modules on every save; without disciplined disposal, `npm run dev` leaks a full scene per save. |
| `config/tuning.js` | 281 | **The single source of truth for every tunable constant** — movement speeds, friction/damping, camera, world extent, etc. Carries a long, load-bearing block comment on unit conversion (see §6, hover-damping correction). Exposed live via lil-gui. |
| `entities/Hero.js` | 509 | The hero's **visual** representation: primitive meshes (capsule torso, limbs, cape polygon), material/color, persona toggle, per-frame pose application. Deliberately holds no movement logic. |
| `controllers/LocomotionController.js` | 569 | The hero's **simulation**: the flight/ground finite-state machine, velocity integration, collision resolution calls. Deliberately holds no rendering. This split from `Hero.js` is load-bearing — see the callout below. |
| `controllers/CameraRig.js` | 288 | Third-person camera: follows the hero's post-locomotion transform, arm raycast against `CollisionWorld` to avoid clipping through buildings, yaw/pitch from mouse input. |
| `world/Collision.js` | 466 | `CollisionWorld` — AABB (`Box3`) registry and capsule/box resolution. Shared by the hero (movement collision) and the camera rig (arm raycast), which is why `Game.init()` constructs it before `StreetBlock`. |
| `world/StreetBlock.js` | 1,608 | The largest module by far. Procedurally builds the one Phase-1 city block: building meshes (via `InstancedMesh` for draw-call economy), the roof/facade texture atlases (`CanvasTexture`), parapet colliders, ground plane. Registers its building AABBs into the shared `CollisionWorld` as it builds. |
| `world/Sky.js` | 222 | Static midday lighting, fog, background colour, and the PMREM-baked environment map — see the note at the end of this section. |
| `ui/DebugHud.js` | 199 | On-screen debug readout (fps, draw calls, geometries/textures counts, FSM state) plus lil-gui tuning panel wiring. Not part of the simulation; purely observational. |

**Dependency shape (informal):** `main.js` → `Game.js`, which imports and wires everything else.
`Game.js` is the only module that knows about all systems simultaneously; other modules do not
import each other laterally except through what `Game.js` hands them (e.g. `LocomotionController`
and `CameraRig` both receive the same `CollisionWorld` instance, but neither imports the other).
`tuning.js` has no upstream dependencies and is imported wherever a constant is needed — it is
the one file every simulation/camera/world module touches.

### The Hero / LocomotionController split — load-bearing, do not casually cross it

`entities/Hero.js` is **visual** (meshes, materials, persona swap, pose application).
`controllers/LocomotionController.js` is **simulation** (the flight FSM, velocity integration,
collision calls). `Hero.js` exposes a plain `state` object (position, velocity, FSM state,
orientation) that `LocomotionController` reads and writes and that `Hero.js` renders from every
frame via `syncTransform()`/`update()`. Neither module reaches into the other's internals.

This separation is why `CameraRig` and `LocomotionController` can both hold a reference to
`hero.state` without either depending on `Hero.js`'s rendering code, and why the FSM has
deterministic unit tests (105 passing) with no WebGL context required — the simulation has no
rendering dependency to mock. Collapsing this boundary (e.g. computing pose or camera-relevant
math inside `Hero.js`, or writing mesh transforms directly from `LocomotionController`) would
break both properties.

### `Sky.js` and the environment map — LANDED, `6a07c13`

This document was written while that change was in flight, and its author correctly reported
catching it half-applied — `Sky.js` already baking, `TUNING.ENV_INTENSITY` not yet existing,
`Game.js` not yet passing a renderer. **That seam is closed.** The paragraph below replaces the
snapshot description and is accurate as of `6a07c13`; `Renderer.js` was not modified after all.

`MeshStandardMaterial` computes indirect specular — the "shiny surface catching the sky" term —
**exclusively from an environment map.** With none present it is not dim, it is exactly zero, at
any roughness. So `metalness` in an env-less rig never added reflectivity; it only subtracted
from the diffuse term and gave nothing back, and under ACES tone mapping a dark, metallic
surface then crushed to black. That is the root cause of the flat/near-black tower facades, and
it is a lighting-mechanism defect rather than a palette mistake.

`Sky.js` now bakes a synthetic sky into a PMREM at construction: a vertex-coloured dome in three
bands (zenith, horizon haze, ground bounce) plus a small HDR sun disc placed along the real
`DirectionalLight`'s direction, so reflections and shadows agree about where the light is. The
sun's colour is deliberately set above 1.0 per channel, which the half-float target preserves;
clamped at 1.0 it would be no brighter than the surrounding sky and glass would catch a flat
wash instead of a highlight.

**No asset file, and zero draw calls** — `scene.environment` is a texture the shader consults,
not a node in the scene graph, so the 57-call worst case in §7 is unchanged. There is a test
pinning that, because a future implementation using a skybox *mesh* would be a silent +2.

`Game.js` passes `this.renderer.renderer` to the constructor. The argument is **optional**: unit
tests construct `new Sky(scene)` with no GL context and take an analytic-lights-only path.
`ENV_INTENSITY` is live in lil-gui, and 0 disables image-based lighting entirely — the honest
before/after.

**Verified in a browser 2026-07-31, spot-check 5, 4/4.** The towers read as glass at street level
and at distance — the exact case that failed before. Matte surfaces did not go milky, draw calls
and frame rate were unchanged, and `ENV_INTENSITY` was left at its 1.0 default.

**The towers' metalness was deliberately NOT raised back**, and that is now settled rather than
pending. It sits where the palette pass put it (0.32 wall / 0.50 window, reduced from 0.45/0.70
to compensate for the then-missing environment map). The plan was to restore it if the
environment map alone proved insufficient; it proved sufficient. Restoring it is still physically
defensible and remains available to a Phase 2 pass that wants more glassiness — but as an
enhancement, not a fix.

---

## 3. App lifecycle — boot to frame loop

**Boot** (`main.js`): grab (or fall back to `document.body`) the `#app` container, construct
`new Game({ container })`, `await game.init()`, then `game.start()`. `window.__game` is exposed
strictly for headless test/devtools inspection — nothing under `src/` may itself read `window`.
Vite HMR is wired so that `import.meta.hot.dispose(() => game.destroy())` runs on every source
save in dev mode; without it, HMR would leak a full scene's GPU resources per save and stack
duplicate input listeners (verified reasoning in the code comment, not independently re-tested
here).

**`Game.init()`** builds systems in a specific, meaningful order:
1. `Renderer` (WebGL renderer + camera + canvas)
2. `THREE.Scene`
3. `Time` (fixed-step accumulator)
4. `Sky` (lighting/fog/background)
5. `CollisionWorld` — **created before `StreetBlock`** because the block registers its building
   AABBs into it while it constructs itself
6. `StreetBlock` (the world geometry)
7. `Hero`, spawned at `(0, 0, 13)` — on the sidewalk, clear of building footprints, facing the
   boulevard
8. `LocomotionController` (reads/writes `hero.state`, holds `collision`, reads `TUNING` live)
9. `CameraRig` (reads `hero.state` and `collision`, drives `renderer.camera`)
10. `Input`, attached to `renderer.domElement`, with a pointer-lock-change callback that toggles
    a DOM lock hint
11. `DebugHud` (fps/draw-calls/geometry/texture counters, FSM state readout, lil-gui panel)
12. A `window.addEventListener('focus', ...)` handler that re-baselines `Time` and clears input
    on refocus, so an alt-tab does not produce a burst of catch-up steps.

`init()` is `async` even though Phase 1 awaits nothing — deliberately, as the seam where Phase
2's chunk streaming and later glTF character loading will hook in.

**Per rendered frame** (`Game._tick(nowMs)`, driven by `requestAnimationFrame`):
1. `debugHud.beginFrame()`
2. `time.beginFrame(nowMs)` → clamps the raw delta (max 0.25 s), fills the accumulator, returns
   the number of owed fixed steps (capped at `MAX_STEPS = 5`, the spiral-of-death guard)
3. Run that many `fixedStep(FIXED_DT)` calls, `FIXED_DT = 1/60` — **not configurable**; every
   tuning constant assumes 60 Hz
4. `render(time.alpha)` — Phase 1 does not interpolate on `alpha`; it is threaded through only
   so the seam exists for a later phase
5. `debugHud.endFrame()`

**Per fixed step** (`Game.fixedStep(dt)`) — **the ordering is explicitly load-bearing, called
out in the code comment as the single most common way a third-person camera is quietly ruined:**

1. `input.beginStep()` — refresh the derived input snapshot
2. Non-movement input handled inline: persona toggle, debug HUD toggle (kept out of the
   controller so it stays a pure movement machine)
3. `locomotion.update(dt, input, cameraRig.yaw)` — reads input, writes the hero's transform for
   this step
4. `hero.syncTransform()` then `hero.update(dt)` — visual sync and per-frame visual animation
   (cape wobble, etc.)
5. `world.update(dt)` and `sky.update(dt)` — static in Phase 1; present so the step has its final
   shape ahead of Phase 2's time-of-day/streaming work
6. `cameraRig.update(dt, input)` — **must run after locomotion, in the same step.** Updating the
   camera first, or deferring it to the render phase, makes it trail the hero by one frame.
7. `input.endStep()` — clears this-step edge flags, consumes accumulated mouse deltas

**Render** (`Game.render`): `debugHud.update()` then `renderer.render(scene)`. Nothing else.

**Teardown** (`Game.destroy()`): stop the RAF loop, remove the focus listener, then dispose in
order — `input.detach()`, `debugHud.dispose()`, `hero.dispose()`, `world.dispose()`,
`sky.dispose()`, a full `disposeObject3D(scene)` sweep, and the renderer's WebGL context last.
Order matters: owners that hold resources a scene-graph walk would miss (e.g. `StreetBlock`'s
`CanvasTexture`s) dispose themselves before the generic sweep runs.

---

## 4. The locomotion state machine

Lives entirely in `controllers/LocomotionController.js` (569 lines). This is deliberately
described by the code's own doc comment as "the heart of the Phase 1 slice — everything else
exists to render, drive, or debug what happens in this file." It never touches the scene graph;
it reads a plain input snapshot and mutates a plain `hero.state` object (`createHeroState()`),
which is why 105 unit tests can simulate seconds of flight in a headless `node` environment with
no WebGL.

### States

| State | Entered from | Vertical behavior | Horizontal behavior |
|---|---|---|---|
| `grounded` | default / landing from flight | `velocity.y = 0` while on a surface; gravity (`TUNING.GRAVITY`) applied **only** here, only while `onGround === false` (walked off a ledge) | Full WASD, ground friction (`0.82`/frame) when idle and on solid ground; air friction while falling |
| `takeoff` | `grounded`, on the down-edge of jump/space while `onGround` | Scripted: forced constant climb at `TAKEOFF_CLIMB_SPEED` (9.6 m/s) for exactly `TAKEOFF_STEPS` (12) fixed steps = 0.2 s, then auto-transitions to `flying`. Ignores ground contact by design. | Full WASD, unconditionally |
| `flying` | end of `takeoff`, or touching ground while `landing` aborts back here | Climb (jump held) / dive (descend held) both ease toward a cap via `approach()`; **hover** (neither held) decays velocity.y by a half-life (`hoverDampingHalfLife`, default 0.065 s) then hard-snaps to exactly 0 below `HOVER_SNAP_SPEED` (0.11 m/s) — this is what holds altitude *exactly*, not asymptotically | Full WASD, `FLIGHT_DASH_SPEED` cap on Shift, `FLIGHT_FINE_MULT` (0.4×) slowdown on J/K/L, unique to this state |
| `landing` | `flying`, on `landPressed` (G) | Scripted descent: `LANDING_DESCENT_ACCEL` (not gravity — a separate constant, deliberately, so "gravity never applies in flight" stays mechanically checkable), capped at `LANDING_MAX_DOWN_SPEED` | Full WASD |

### Transitions

- `grounded → takeoff`: edge-triggered (not level) on jump/space press while `onGround` — edge,
  because level-triggered would re-enter takeoff every step W is held.
- `takeoff → flying`: automatic, after exactly 12 fixed steps. Ignores all input during this
  window.
- `flying → landing`: on `landPressed` (G).
- `landing → flying`: **level-triggered** (not edge) on jump held — mirrors the 2D game exactly:
  a player already holding W when they press G never actually commits to landing.
- `flying`/`landing → grounded`: on ground contact (evaluated post-collision-resolve, not as an
  input transition), regardless of which flight state they were in. `velocity.y` is zeroed.
- `grounded` (falling) `→ grounded` (resting): implicit — when contact resumes after a fall off
  a ledge, accumulated fall speed is zeroed so it doesn't carry into the next airborne moment.

All state changes funnel through one method, `_setState()`, so the derived flags (`landing`,
`flightActive`, `capeFlare`, `takeoffStepsRemaining`) can never drift out of sync with `state`.

### The one invariant the whole design protects

**Gravity is applied in exactly one place**: the `grounded` state, when `onGround === false`.
Never in `takeoff`, `flying`, or `landing`. The code comment calls reasserting gravity while
`flightActive` is true "a regression, full stop, not a tuning choice." `landing`'s descent uses a
separate scripted constant (`LANDING_DESCENT_ACCEL`) specifically so this stays mechanically
checkable rather than a matter of degree.

### Per-step order inside `update()`

1. `_applyInputTransitions` (edge/level transitions, before this step's vertical logic runs —
   this is why takeoff's first climb step happens the same frame W is pressed, no dead frame)
2. `_updateHorizontal` — runs in **all four states unconditionally**; only vertical motion is
   state-gated. A takeoff/landing that ignored steering would read as a canned cutscene.
3. `_updateVertical` — fully state-dependent, see table above
4. Semi-implicit Euler integration (position updated from the *new* velocity)
5. `collision.resolve(...)` against the static world, swept against `previousY` so no velocity
   can tunnel through the ground plane in one step
6. `_applyContactTransitions` — ground-contact-driven transitions, evaluated after resolution
7. `_updateOrientation` — **visual only, never feeds back into velocity**

### Orientation (visual, not physical)

Yaw rate-limits toward the travel direction (`YAW_SLERP_RATE`, 12 rad/s) rather than snapping,
and holds its last value when there's no input (snapping back to a default facing on release
"looks broken," per the code comment).

Body pitch (the "Superman lean") is a **two-term model**, and the split is called out in the
code as "the whole design": a speed-lean term (`sqrt(horizontalSpeed / FLIGHT_DASH_SPEED)`,
reaching `MAX_FORWARD_PITCH` at dash speed) plus a vertical-lean term (`-velocity.y /
PITCH_SPEED_DIVISOR`) that **fades out as horizontal speed rises**. The code comment documents
that the first shipped version used the vertical term alone, which meant flying fast and level
produced pitch = 0 — the hero cruised upright, "standing in the air." **This is the same bug
`PIPELINE_STATE.md`'s "OPEN FINDING — body pitch ignores horizontal speed" (session 4 notes)
describes** — the code today has already been fixed with the two-term model described above, and
that fix is what spot-check 3 confirmed by eye ("flight lean... confirmed"). Anyone reading the
older "open finding" note in isolation would think this is still outstanding; it is not, per the
code as it stands. `PITCH_SPEED_DIVISOR` is 5.0 (dropped from 8.0 after a browser pass wanted
more dive lean).

The cape has its own body-frame standoff clamp (`CAPE_MIN_STANDOFF`, 0.4 rad) layered on top of
its world-space lift so it can't go colinear with a fully-pitched-forward torso and sink into it
— see §6's cape fix writeup for why this existed as a real bug, not hypothetical.

---

## 5. `config/tuning.js` — constants and the hover-damping correction

`TUNING` is a single **mutable** plain object (not `const` exports) so lil-gui can bind to it
live. Every module that reads a tunable value must do so **at call time inside the update loop**
— destructuring a constant into module scope at import time silently breaks live retuning. This
rule is stated in the file's header and enforced by convention, not by a lint rule.

`DEFAULT_TUNING` is a frozen snapshot of the shipped defaults, used by the debug UI's reset
button and by tests that need to assert against shipped values even after another test mutated
`TUNING`.

**The most important correction carried by this file (verified directly against the code, not
just the docs):** the 2D game's three per-frame-at-60fps damping constants do **not** all convert
to a per-second rate the same way.

| Constant | Per-frame (2D) | `factor^60` | Verdict |
|---|---|---|---|
| `GROUND_FRICTION` | 0.82 | ≈ 6.75e-6 | Converts cleanly. Applied as `Math.pow(f, 60*dt)` (`frictionFactor()`). |
| `AIR_FRICTION` | 0.92 | ≈ 6.74e-3 | Converts cleanly, same formula. |
| `FLIGHT_HOVER_DAMPING` (2D value 0.18) | 0.18 | ≈ **2.1e-45** | **Degenerate.** Would collapse vertical velocity to zero inside a single fixed step and gives no usable tuning range. |

Hover damping is therefore **not** derived from `0.18^60` at all. It ships as its own explicit
half-life decay — `hoverDampingHalfLife` (default 0.065 s, lil-gui range 0.05–0.08), applied as
`v.y *= 0.5 ** (dt / halfLife)` (`hoverDampingFactor()` in `LocomotionController.js`), combined
with a hard snap to exactly 0 below `HOVER_SNAP_SPEED` (0.11 m/s). The old 2D constant
(`FLIGHT_HOVER_DAMPING_2D = 0.18`) is retained in the file **only for provenance** — nothing
reads it. This matches what `PIPELINE_STATE.md` documents (F7 / the tuning.js block comment);
confirmed here by reading `frictionFactor()` and `hoverDampingFactor()` directly.

**Other tuning notes worth carrying forward:**
- `TAKEOFF_CLIMB_SPEED` is 9.6 m/s (raised from 4.8 to fix bug B2) precisely because a tap-W
  takeoff gains altitude in two parts — the 12-step scripted climb *and* an unavoidable coast
  while hover damping bleeds off the residual climb speed (gravity is never applied in flight).
  The real apex at 4.8 was 1.36 m, not the 0.96 m the original QA write-up assumed; sizing against
  the wrong number would have overshot by ~40%. `TAKEOFF_STEPS` (12, i.e. 0.2 s) was deliberately
  left untouched so it doesn't desync the camera-blend/cross-fade timing other criteria were
  judged against.
- `PITCH_SPEED_DIVISOR` is 5.0 (down from 8.0) for more dive lean.
- `JUMP_FORCE` is ported but **intentionally unused** — takeoff's vertical motion is entirely
  scripted via `TAKEOFF_CLIMB_SPEED`, not an initial impulse. Do not wire it in without a
  decision.
- `PLAYABLE_HALF_EXTENT` is 150 m → a 300 m playable square, enforced by four boundary `Box3`es
  in `Collision.js` using the same push-out code path as buildings (no special-cased boundary
  logic).
- `CAM_NEAR`/`CAM_FAR` and their Phase-2 target values (near ~0.3–0.5, far ~8–12 km) are kept in
  this file rather than inlined at their construction site specifically so raising the far plane
  later is a one-line edit instead of a documented z-fighting trap.
- `ENV_INTENSITY` (added `6a07c13`): multiplier on `scene.environmentIntensity`, i.e. the
  strength of indirect specular — the sky reflected in glass. `Sky.update()` writes it onto the
  scene every fixed step, which is what makes the lil-gui slider live. 1.0 is physically neutral;
  0 disables image-based lighting entirely. See §2.

---

## 6. Decisions already made (settled — do not revisit without new information)

### Project-level, from `PIPELINE_STATE.md`'s locked-decisions table (user decisions, dated)

| # | Decision |
|---|---|
| 1 | Stack: **Three.js + Vite**, npm/ESM/hot-reload. Single-file/no-build constraint abandoned. |
| 2 | Strategy: **new 3D build, port content forward.** `kodaman_prototype.html` is never edited. |
| 3 | LA realism: recognizable landmarks, **invented streets** — no OSM geodata import. |
| 4 | Delivery: feature branch + PR against `dev`. **No agent ever pushes `main`.** No deploy target. |
| 5 | Trademarks: rename **in the 3D build only**; the 2D file keeps its current names untouched. |
| 6 | Naming authority: **agents propose, user approves.** No agent applies a rename pre-sign-off. |
| 7 | Draw-call ceiling: raised for Phase 2 from a **measured worst case**, not a guess — see the correction below; the real Phase-1 worst case is 57, not the ~45–49 figures used before 2026-07-31. |
| 8 | World extent: vast and explorable but **explicitly bounded**, not endless. |
| 9 | Skeletal animation: pulled forward into **Phase 2** (was Phase 5); Phase 2 onward accepts imported rigged assets, superseding the Phase-1 primitives-only rule. |

### Architecture-level, verified against the code in this pass

- **WebGL, not WebGPU, for the whole project (Phases 1–8).** Stated in `Renderer.js` as final —
  the CSM shadow addon later phases need is WebGL-only, and WebGPU commits to TSL against a
  moving API. There is deliberately no fallback path.
- **No physics engine for the hero, permanently.** `Collision.js` is a hand-rolled AABB set plus
  kinematic capsule resolution; the code's own reasoning (confirmed by reading it) is that a
  physics engine adds async WASM init and transform-sync overhead without removing the need for a
  manual ground check, since character controllers don't apply gravity for you either. Rapier
  arrives in Phase 3 for props/enemies/vehicles only — the hero controller stays hand-rolled.
  Verified: no broadphase either (linear scan over ~16 boxes), explicitly called out as
  correct-and-sufficient at this count, not an oversight.
- **Hero/LocomotionController split is load-bearing** — see §2's callout. Confirmed by reading
  both files: `Hero.js` never mutates simulation fields, `LocomotionController.js` never touches
  `THREE.Mesh`/scene-graph objects.
- **Fixed 60 Hz timestep, non-negotiable.** Every tuning constant assumes it; `Time.js`'s own
  doc comment states this is what makes the FSM deterministic and the unit tests meaningful, not
  a style preference.
- **Gravity applies in exactly one place** — `grounded`, off-ground. Confirmed directly in
  `LocomotionController._updateVertical` (§4).
- **Camera must update after locomotion within the same fixed step.** Enforced by `Game.js`'s
  step order; both `Game.js` and `CameraRig.js` independently document why (a one-frame lag reads
  as camera "softness/lag" — called "the single most common way a third-person camera is quietly
  ruined").
- **Static midday lighting only in Phase 1** — no day/night cycle, no CSM, confirmed in `Sky.js`.
- **No post-processing in Phase 1** — `EffectComposer` is Phase 7, per `Renderer.js`.
- **No named characters, places, or companies anywhere in `kodaman3d/`, including placeholders.**
  Stated explicitly in `Hero.js` and `StreetBlock.js`; this document follows the same rule.

### Bugs fixed, with the real root cause (verified against code, not just the fix reports)

| Bug | Symptom reported | Real root cause (confirmed in code comments + math) |
|---|---|---|
| B1 | Cape didn't trail behind travel | Sign error in the cape's world-lift rotation — a `+θ` about `+X` was applied where the direction convention required `-θ`. Same root cause as B4: "+X positive swings -Y toward -Z and +Y toward +Z, never the other way round," documented explicitly in `Hero.js`. |
| B4 | Dive pose looked feet-first | Same sign-convention reversal, applied to `bodyPivot.rotation.x` in `syncTransform()`. |
| B5 | "Arms don't point toward direction of travel" in flight | Arms shipped at `rotation.x = -2.6` (swept back over the head) instead of `+2.6` (reaching forward); a **design/taste call**, not an arithmetic bug — the Engineer correctly declined to auto-fix it, and the sign was set by the user (arms forward, legs trailing) in commit `44df9fe`. |
| Body pitch "inverted" complaint | "Flying fast and level, the hero stood upright in the air" | The original pitch calculation used vertical velocity only, so level-fast flight gave `pitch = 0`. Fixed with a **two-term model** (speed-lean + fading vertical-lean) — confirmed live in `LocomotionController._updateOrientation` today. `PIPELINE_STATE.md`'s session-4 "OPEN FINDING" section describing this bug is **stale as of this document** — the code already carries the fix and spot-check 3 confirmed it by eye. |
| Cape "clipping"/"buried in the chest" | Reported as a speed-dependent clipping bug | Two causes, only one of which is speed-dependent: (1) `CAPE_Z` was 0.14 m while the torso capsule has radius 0.28 m, so the cape anchor sat ~0.07 m *inside* the mesh **from frame zero, at zero speed** — fixed by raising `CAPE_Z` to 0.32; (2) at dash speed the body pitch and the cape's world-lift angle become colinear, so the cape sinks along the torso — fixed by `CAPE_MIN_STANDOFF`, a body-frame clamp faded in by body pitch. Both confirmed directly in `Hero.js`'s `RIG.CAPE_Z` comment and `_animateCape()`. |
| Helipad invisible | Roof art present but nothing visible on the roof | `StreetBlock.js`'s roof parapet (G1) originally shipped as a solid slab covering ~97% of the roof, directly over the same face the atlas paints the helipad onto. Raising its height (3.5 m → 12 m) changed nothing because the slab still covered the pad. Fixed by making the parapet a **ring of four instanced bars** instead — same one draw call, roof centre left clear, and real coping reads more correctly than a slab. |

### Draw-call ceiling — the correction that matters most to any future budget work

`renderer.info.render.calls` accumulates across **both** the shadow pass and the main pass —
`WebGLRenderer` calls `info.reset()`, then `shadowMap.render()`, then the main scene render, all
before the counter is read. Every shadow-casting object therefore costs **two** calls, not one.
This was independently verified in the project (by direct read of the installed `three` bundle,
per `PIPELINE_STATE.md`) and is **not** re-verified again in this pass, but nothing in the code
read here contradicts it.

| | Main pass | Shadow pass | **Total** |
|---|---:|---:|---:|
| Phase 1, before the building realism pass | 28 | 21 | **49** |
| Phase 1, after (shipped) | 32 | 25 | **57** |

**The true position is 57 against a 60 ceiling — three calls of headroom, not the eleven that
`DESIGN_SPEC_PHASE_1_BUILDINGS.md` promises** (that document's ledger counts main-pass objects
only). Any Phase 2 draw-call ceiling must state explicitly whether it counts one pass or both, or
this exact mistake repeats at a larger scale.

---

## 7. What is open

### Active / near-term

1. **The envMap work** (`Renderer.js`, `Sky.js`) — in progress concurrently with this document,
   see §2 and §5. Goal: fix the distant tower facades, which read as near-black slabs at street
   level and distance even after the palette fix (`DESIGN_SPEC_TOWER_PALETTE.md`) made close-up
   glass read correctly. Judgement call the user hasn't finally made — the flatness is cosmetic,
   not a defect anyone has called blocking.
2. **A one-step browser look at the cape fix.** `CAPE_Z` (0.14→0.32) and `CAPE_MIN_STANDOFF`
   (new, 0.4 rad) are unverified beyond spot-check 4's confirmation of "no interpenetration" —
   the standing-pose screenshot was front-on and edge-on to the cape, so "hangs as a sheet against
   the back" specifically has not been confirmed visually, only inferred.
3. **PR #3** (`github.com/cyang3859/C_K_prototype/pull/3`, `feat/3d-open-world` → `dev`) is open
   and unmerged. Review and merge are the user's call, not an agent's.
4. **Phase 2 research** — scoped by locked decisions 7–9 (§6) plus the user's deferred design
   feedback: character not human enough / wants a comic-accurate read, world feels empty with too
   few landmarks, buildings/landscape "too blocky and rigid," open-world inspiration named as
   RDR2, the Watch Dogs series, and Ghost of Tsushima for animation fluidity. This was explicitly
   recognized as scope creep against Phase 1 and deferred by the user themselves — it is Phase 2
   Research input, not a Phase 1 defect list.

### Requires a user decision, not further investigation

- **The trademark rename table is not yet usable.** `RESEARCH_FINDINGS.md` §C4 has the
  old→new mapping *structure* but its "proposed replacement" column holds descriptions
  ("new reporter-companion name") rather than actual names. Per locked decision 6, only the user
  can supply or approve names — no agent may fill this in and apply it. The repo is already
  public, so this blocks trademark-safe public release, not Phase 1 development. Roughly 900+
  occurrences across 10+ marks in `kodaman_prototype.html` (that file is never edited; this is
  about what Phase 2 ports forward). Suggested split, offered previously and still standing: the
  user names the highest-reference character personally, agents propose the rest for sign-off.
- **Phase 2's draw-call ceiling** needs to be set from the corrected 57 (§6), with an explicit
  statement of whether it counts one render pass or both.
- **`JUMP_FORCE`** is ported into `tuning.js` and exposed in lil-gui but wired into nothing. Left
  as a decision, not implemented speculatively.

### Lower-priority / hygiene

- `REVIEW_FLAGS.md` records three items marked **NEEDS RESEARCH, not judgment** (R1–R3), not
  independently re-verified in this pass: LA haze/visibility parameters (currently a placeholder
  in `Sky.js`, explicitly flagged in its own comment as "not researched atmospheric truth"); DTLA
  and suburban block dimensions; and a full (not sampled) classification of the trademark
  occurrence counts into player-visible strings vs. code identifiers vs. comments.
- A **headless QA agent** (`QA_REPORT.md`) was planned but never run — superseded for the 13
  `[HUMAN]`-tagged criteria by the human test pass, per the pipeline status table. Whether it's
  still worth running for the non-`[HUMAN]` criteria is unresolved, not decided against.

---

## 8. Map of `docs/handoff/`

This file is meant to replace the need to read the other 21 documents end-to-end. Consult them
**by section**, and only when this file doesn't answer the question.

| Document | Lines | What it's for | Read it when... |
|---|---:|---|---|
| `PIPELINE_STATE.md` | 630 | **The single source of truth for status, decisions, and the resume pointer.** Everything in this knowledge base's §6/§7 traces back to it. | You need the *current* status of anything, or the full history of a decision. Read first, always. |
| `RESEARCH_FINDINGS.md` | 920 | Architecture/character/constraints research: A1–A13 (technical), C1–C4 (trademark mapping table, characters), D1–D4. | You need the *reasoning* behind an architecture choice, or the trademark mapping table structure (not yet usable names, see §7). |
| `RESEARCH_LA_WORLDBUILDING.md` | 688 | LA-specific worldbuilding research — landmarks, street classifications, block dimensions. | Phase 2 world content work; sourced the S-470-1 boulevard spec used in `StreetBlock.js`. |
| `PHASE_1_SPEC.md` | 511 | The original Research-agent Phase 1 spec. | Historical reference only — superseded by `ENGINEER_BRIEF.md` for anything binding. Has a known citation bug (Hero.js section cites §C4, means §C3). |
| `REVIEW_FLAGS.md` | 355 | 12 adjudicated review flags (rulings = decisions already made) + 3 NEEDS RESEARCH items (R1–R3) + the F7 hover-damping finding. | You need the *ruling* on a specific known conflict (e.g. WebGL vs WebGPU) or the open research items. |
| `IMPLEMENTATION_PLAN.md` | 594 | Phases beyond Phase 1. | Planning Phase 2+. |
| `ENGINEER_BRIEF.md` | 917 | The self-contained Phase 1 build order — 28 tagged acceptance criteria. | You need to know exactly what Phase 1 was supposed to build, criterion by criterion. |
| `ENGINEER_SUMMARY.md` | 301 | Engineer's own summary of the initial Phase 1 build. | Cross-reference against the brief; largely superseded by `ENGINEER_PHASE1_CLOSE.md` for final state. |
| `ENGINEER_FIX_REPORT.md` | 496 | B1–B4 bug fix writeup (root causes, commits, the B5 non-fix). | Understanding *why* a specific bug fix was shaped the way it was — this document's §6 bug table is drawn from here plus a direct code read. |
| `ENGINEER_PHASE1_CLOSE.md` | 306 | Building-spec implementation + budget close-out. | Final Phase 1 Engineer state, draw-call reconciliation. |
| `QA_HUMAN_RESULTS.md` | 209 | First human test pass: 10 pass, 1 pass-with-defect, 1 fail. | Historical — the defects it found are fixed; read for the *methodology* of a human pass, or to see the original B2 apex-height miscalculation caught here. |
| `HUMAN_TEST_GUIDE.md` | 263 | The 13-criteria guide the first human pass followed. | Template for writing a future test pass guide. |
| `SPOT_CHECK_RESULTS.md` | 97 | Diagnosis notes behind the B5 flight-pose decision. | Understanding the arm/leg sign-flip reasoning before it was committed. |
| `BROWSER_SPOT_CHECK.md` / `_2` / `_3` / `_4` | 198 / 218 / 165 / 77 | Sequential browser spot-check guides (9, then follow-ups) written for the user to run and report back against. | You need the exact verification steps for a specific fix, or want to write the next one following the established format. `_3` covers the cape-fix diagnosis correction and the tower-facade screenshots; `_4` is the cape-fix re-verification. |
| `DESIGN_AGENT_BRIEF.md` | 168 | Charter for the sixth pipeline stage (Design), added session 3. | Before spawning any Design-stage agent. |
| `DESIGN_SPEC_PHASE_1_BUILDINGS.md` | 446 | Building realism design spec — facades, roof atlas, parapet/HVAC/awning/sign instancing. | Understanding why `StreetBlock.js` looks the way it does. **Its draw-call ledger is wrong** — see §6's correction. |
| `REVIEW_DESIGN_SPEC_BUILDINGS.md` | 330 | Feasibility gate on the buildings spec — APPROVED WITH CORRECTIONS (roof-atlas aspect fix, second `Box3` for parapet collision). | Understanding which parts of the buildings spec shipped as-is vs. corrected. |
| `DESIGN_SPEC_TOWER_PALETTE.md` | 197 | The tower-facade palette fix (metalness pulled down to compensate for no envMap) and the envMap recommendation that's now in progress. | Understanding the current metalness values in `StreetBlock.js`'s tower material, or the reasoning behind the in-flight envMap work in §2/§5. |
| `KODAMAN_HANDOFF.md` (repo root, not in `docs/handoff/`) | — | Pre-pipeline handoff doc. **Stale — do not use.** Wrong line count (~5,200 vs actual 16,507) and wrong cape description (claims bezier quad-strip; it's a 7-segment closed polygon). | Never, except to confirm it's still the thing everyone correctly avoids. |

# Knowledge Base — 3D Migration Project

**Status:** written by the Overview agent, session 5, 2026-07-31. **Refreshed inline by the
orchestrator, session 10, 2026-08-01** — every figure below was re-measured against the code and
the document tree rather than carried forward. This is the terminal stage of the 6-agent pipeline
(Research → Review → Design → Engineer → QA → Overview). It exists so a reader does not have to
read thirty other documents to know what exists.

**If this file and an older doc disagree, this file is the corrected version.** **If this file and
the code disagree, the code wins** — say so inline rather than silently trusting either. **The one
exception: `PIPELINE_STATE.md`'s locked-decisions table is authoritative over this file** for any
decision's binding text; §6 below is a summary of it, not a second source.

### What changed in the session-10 refresh

The previous revision was written before Phase 2 existed and had drifted in five places, all now
corrected: the build wireframe (**15 files / ~5,100 lines → 21 files / 7,199 lines**), the settled-
decision list (**stopped at 9 → now 24**), the open-items list (the envMap work it described as
"in progress" **landed in `6a07c13`**), the document index (**missing 11 documents** added since),
and the draw-call position (**57 against a 60 ceiling → 83 against a 150 ceiling**). A new §2
subsection records the `WEBGL_multi_draw` hardware dependency the whole batching strategy rests on.

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
9. Working practices that have repeatedly paid

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

**Where the project actually is right now (2026-08-01, end of session 9):** Phase 1 (a vertical
slice — walk/fly hero, one LA street block, third-person camera) is built and human-verified across
four browser spot-checks; all known visual defects are fixed. **Phase 2's world half is half-built.**
Its research is complete (two runs, 1,946 lines), its district design spec passed Review's
feasibility gate, and **Engineer run 1 of 2 has landed** — both districts exist, at the two
different grid rotations locked decision 10 exists for. **148/148 tests.** PR #3 is open, unreviewed,
unmerged.

**What is NOT built:** Phase 2's props half (Engineer run 2 — vegetation, rooftop detail, street
furniture, parked cars), the whole **character half** (skeletal animation; fully researched and
decided in decisions 12–18, but unstarted), the day/night cycle, CSM shadows, and the trademark-safe
renaming. See §6–7 for what's settled vs. open, and `PIPELINE_STATE.md`'s resume pointer for the
next action.

**There is a playtester build:** `npm run build:standalone` emits `kodaman3d/dist-standalone/
kodaman3d.html`, the whole game as one 0.6 MB self-contained double-clickable file, gitignored and
overwritten in place. It works **only because the build has no asset files** — every texture is
painted procedurally and the env map is PMREM-baked from a synthetic sky. Decisions 15/18 bring
Quaternius glTF in for the hero rig, and that ends; the script has a hard guard that fails loudly
rather than emitting a file that 404s on a tester's machine.

---

## 2. Build wireframe — `kodaman3d/src/`

**21 files, 7,199 lines** (measured directly: `wc -l` across `src/`, 2026-08-01, session 10). This
supersedes both the "15 files / ~5,100 lines" of this document's previous revision and the "25 files
/ 6,691 lines" in `PIPELINE_STATE.md`, which counted build artifacts and docs from a pre-Phase-1-
close snapshot.

**Six modules are new in Phase 2 run 1**, all under `world/`, and they are marked ★ below. Note
`StreetBlock.js` **shrank 1,608 → 1,288 lines** in that run: its private canvas-painting kit was
lifted into `facadeAtlas.js` so seven new facade families could share it instead of duplicating
~200 lines. The lift was behaviour-preserving and the Phase 1 canvas-call assertions in
`tests/world.test.js` are what pin that down — they are unmodified.

| File | Lines | Owns |
|---|---:|---|
| `main.js` | 37 | Entry point. Constructs `Game`, awaits `init()`, calls `start()`. Wires Vite HMR teardown to `game.destroy()`. Exposes `window.__game` for headless test/devtools access only — nothing under `src/` may read `window`. |
| `core/Game.js` | 258 | Owns every system instance and runs the fixed-timestep loop (see §3). The orchestration hub — everything else is a system it drives. |
| `core/Time.js` | 158 | Fixed-timestep accumulator: clamps raw frame delta, tracks owed steps, guards against the spiral of death. |
| `core/Input.js` | 311 | Raw keyboard/mouse/pointer-lock state → a derived per-step snapshot (`beginStep`/`endStep`), including edge-triggered flags (`personaPressed`, `debugPressed`) and mouse-delta accumulation. Clears held keys on blur. |
| `core/Renderer.js` | 125 | `WebGLRenderer`, camera, canvas sizing/resize. |
| `core/Scale.js` | 120 | Shared unit-conversion / scale constants used across world and character code. |
| `core/dispose.js` | 88 | `disposeObject3D()` — walks a scene graph and frees GPU geometries/materials/textures. Exists because Vite HMR re-evaluates modules on every save; without disciplined disposal, `npm run dev` leaks a full scene per save. |
| `config/tuning.js` | 312 | **The single source of truth for every tunable constant** — movement speeds, friction/damping, camera, world extent, etc. Carries a long, load-bearing block comment on unit conversion (see §6, hover-damping correction). Exposed live via lil-gui. |
| `entities/Hero.js` | 509 | The hero's **visual** representation: primitive meshes (capsule torso, limbs, cape polygon), material/color, persona toggle, per-frame pose application. Deliberately holds no movement logic. |
| `controllers/LocomotionController.js` | 569 | The hero's **simulation**: the flight/ground finite-state machine, velocity integration, collision resolution calls. Deliberately holds no rendering. This split from `Hero.js` is load-bearing — see the callout below. |
| `controllers/CameraRig.js` | 288 | Third-person camera: follows the hero's post-locomotion transform, arm raycast against `CollisionWorld` to avoid clipping through buildings, yaw/pitch from mouse input. |
| `world/Collision.js` | 466 | `CollisionWorld` — AABB (`Box3`) registry and capsule/box resolution. Shared by the hero (movement collision) and the camera rig (arm raycast), which is why `Game.init()` constructs it before `StreetBlock`. |
| ~~`world/StreetBlock.js`~~ | — | **GONE as of `453c21b`.** Locked decision 24 dissolved it into District B; its content is `world/annex.js` and nothing moved in world space. The hero still spawns at `(0, 0, 13)` and the helipad tower still stands at `(−2, 31)`. This row is kept rather than deleted so an older document's references to `StreetBlock.js` can still be placed. ⚠️ Every other mention of the module below is pre-absorption history — read it as such. Corrected 2026-08-02, session 11. |
| `world/Sky.js` | 222 | Static midday lighting, fog, background colour, and the PMREM-baked environment map — see the note at the end of this section. Its shadow frustum is **±60 m in what is now a 1,220 m world**, which is why the districts cast no shadows; CSM is the fix and it is not built. |
| ★ `world/districts.js` | 426 | **Data, not geometry** — the authored numbers and pure functions for both districts (grid, lot sizes, roadway/sidewalk widths, per-building family and recipe assignment). Same `BLOCK`-beside-the-builders separation `StreetBlock.js` uses, kept deliberately so a third district is data rather than a rewrite. Holds the two grid rotations locked decision 10 exists for: District A at 36°, District B at 0°. |
| ★ `world/District.js` | 530 | Consumes `districts.js` and builds the meshes: the `BatchedMesh` per facade family, and the §6 merged ground/road surfaces (4 per district, **not** 7 per tile — the `BUD-2` trap, avoided and measured). |
| ★ `world/facadeAtlas.js` | 397 | The shared procedural-facade painting kit, lifted verbatim out of `StreetBlock.js`. **Read its flipY/canvas-y convention comment before touching any of it** — `CanvasTexture` defaults to `flipY = true`, so UV v=0 samples the canvas's bottom row. |
| ★ `world/facadeFamilies.js` | 142 | The seven facade families (3 District A, 4 District B). **The family count IS the building draw-call count** — one family = one `BatchedMesh` = 1 main + 1 shadow, however many buildings are in it, because `BatchedMesh` has no per-instance material override (see §2's batching note). 7 families = **14 calls both passes** for the entire building population of both districts. **Locked decision 22 is enforced here, not promised:** FAM-1/4/6/7 are spread directly from `FACADE_VARIANTS` rather than re-typed, and a byte-equality test pins it. |
| ★ `world/massing.js` | 244 | The five massing recipes as pure functions — 2–4 stacked boxes per building (podium, setback, cap), the fix for `DEN-1`'s "every building is one `BoxGeometry`" diagnosis. **Massing costs triangles, not draw calls:** every box joins its family's existing batch. Returns boxes in building-local space. |
| ★ `world/landmarks.js` | 483 | The two district landmarks — District A's 150 m tower with decision 19's sculpted crown (which **cannot** join its family's batch, so it costs its own `Mesh`), and District B's sign/observation mast per decision 20. Exports `MAST_SIGN_TEXT` (`AKC ENTERPRISE`, locked decision 23), **pinned by a test** so a name can only change by the same sign-off that put it there. |
| `ui/DebugHud.js` | 226 | On-screen debug readout (fps, draw calls, geometries/textures counts, FSM state) plus lil-gui tuning panel wiring. Not part of the simulation; purely observational. Takes a `startHidden` flag so the standalone playtest build (`VITE_PLAYTEST=1`) boots with every debug surface hidden; **F1 still reveals them**, so a tester can be talked through showing them. |

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

**Verified in a browser under Playwright, spot-check 5, 4/4.** ⚠️ **Date corrected in the session-10
refresh:** this previously read "2026-07-31," but that claim was never backed by a recorded run —
`BROWSER_SPOT_CHECK_5.md`'s result boxes were empty. It was **actually executed in session 8,
2026-08-01**, and the filled-in document is the authority. The towers read as glass at street level
and at distance — the exact case that failed before. Matte surfaces did not go milky, draw calls and
frame rate were unchanged, and `ENV_INTENSITY` was left at its 1.0 default.

**⚠️ The env map turned out to be the scene's global ambient fill, not just a tower-glass fix.** An
environment map feeds **diffuse irradiance** to every `MeshStandardMaterial`, and **the diffuse term
does not care about metalness** — so the prediction that matte surfaces would "barely move" was
wrong. Measured ENV 0 → 1: road **+70%**, sidewalk **+33%**, mid-rise **+253%**, hero cape **+637%**,
far towers **+780%/+637%**, sky unchanged. **Consequence: anything that changes `ENV_INTENSITY` is
changing scene-wide brightness, not just glass.** If ambient fill ever gets its own control,
`ENV_INTENSITY` must stop carrying it.

**The towers' metalness was deliberately NOT raised back, and that question is now CLOSED for the
third and last time** (locked decision 22). It sits where the palette pass put it (0.32 wall / 0.50
window, reduced from 0.45/0.70 to compensate for the then-missing environment map). Sessions 5 and 8
both closed it on the same reasoning — once by eye, once on the measurements above — and session 9
locked it. **The dark-tower defect is fixed; there is no problem left for a constants change to
solve, and changing browser-verified values with no defect driving them is how regressions enter.**
The option stays physically defensible if a later phase finds a real reason. "It would be cheap right
now" is not one.

### ⚠️ `BatchedMesh` has an unstated hardware dependency — `WEBGL_multi_draw`

**The entire Phase 2 batching strategy (`BUD-3`, §BGT-1, and every draw-call figure in this
document) silently assumes the `WEBGL_multi_draw` extension is present.** Verified at source in the
installed `three@0.185.1` — `node_modules/three/src/renderers/WebGLRenderer.js`, in the
`object.isBatchedMesh` branch:

```js
if ( ! extensions.get( 'WEBGL_multi_draw' ) ) {
  for ( let i = 0; i < drawCount; i ++ ) {
    uniforms.setValue( _gl, '_gl_DrawID', i );
    renderer.render( starts[ i ] / bytesPerElement, counts[ i ] );   // a REAL draw call, per geometry
  }
} else {
  renderer.renderMultiDraw( ... );                                    // one call for the whole batch
}
```

**Without the extension a `BatchedMesh` is not one draw call — it is one per geometry.** For this
build that is roughly **170 calls instead of 7**, which blows the 150 ceiling on its own.

The extension was **measured present** in the test environment, so the build is fine there. But
this is a **hardware/driver dependency of the budget, not of correctness** — the scene still renders,
it just costs an order of magnitude more. It is invisible in every measurement taken so far because
every measurement was taken on hardware that has the extension. **A runtime capability check is a
real candidate**, and any future performance report from a machine whose numbers look inexplicably
bad should check this first.

**A second, related fact settled by reading the same library:** `BatchedMesh` takes **one `material`
for the whole batch** (`BatchedMesh.js:192`), `geometryInfo` carries no material-index field
(`:632`), and the render path unconditionally reads `this.material` (`:1390`). **There is no
per-instance material override.** Two consequences: the facade-family count *is* the building
draw-call count (§2's `facadeFamilies.js` row), and **decision 19's sculpted crown cannot join its
family's batch** — it costs its own `Mesh`.

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
| 10 | The two Phase 2 districts: **a dense tower plateau on the 36°-rotated historic grid, paired with a mixed-height boulevard corridor on the cardinal grid.** The rotation difference is the point — the same sun rakes them differently at the same hour, so the day/night cycle gets per-district differentiation for free. **Confirmed to work** in spot-check 6. |
| 11 | World edge: **a hard wall behind an atmospheric fade — both, not either.** Phase 1's four-`Box3` mechanism moves out to the true edge; a radial distance-from-centre fade whites out visibility well before the hero reaches it. No new rendering system — the fade feeds the existing `Fog`. |
| 12 | Hero shading: **stay on PBR (`MeshStandardMaterial`). No toon.** `MeshToonMaterial` has no `envMap` property at all, so it would opt the hero out of the env-map mechanism entirely. Proportion carries the comic read instead. |
| 13 | Outline treatment: **none. Not built, not toggled.** Screen-space edge detection is blocked until Phase 7 by the no-post-processing rule; inverted hull costs +1 call per outlined group. |
| 14 | Hero material grouping: **4 groups — suit, skin, accent, and the cape as its own group. Visible face, NOT a full cowl. 8 draw calls both passes** (4 main / 4 shadow), down from Phase 1's 14. **The 8 is a budget the Engineer must hit, not an aspiration** — a rig built object-by-object instead of merged stays at 14 and silently wastes the whole gain. ⚠️ This row's *group description* was wrong until session 9 (it said 3 groups, which is 6 calls, contradicting its own 8); the **number was always right**. |
| 15 | Asset source: **Quaternius only for Phase 2. Mixamo is OUT of scope this phase** — a permanently-archived public git history of Mixamo-derived `.glb` is not a scenario its terms clearly anticipate. Quaternius is unambiguous CC0, so this **sidesteps the question rather than answering it.** |
| 16 | Animation scope: **floor first, then decide on the enhanced tier.** Ship 4 assets (idle/walk/run sourced CC0 + one custom flight hold), see the rig move in a browser, then decide on the remaining ~6. Deferred, **not** rejected. |
| 17 | Floating-origin precision: **run the §ORG-6 synthetic test as soon as a rigged hero exists.** It is **a test, not a system.** Running it late risks discovering jitter after the animation work is already built on the rig. |
| 18 | Quaternius tiers: **the "60–70% free" figure is a CONTENT/FORMAT tier, not a licence split. Everything is CC0.** Free tiers ship glTF/GLB, the only format this project needs. Paid is a content upgrade, **not** a licence unlock, and can be bought later without rework. |
| 19 | District A landmark cap: **sculpted, non-flat crown on the 150 m landmark alone.** Every other roof stays flat. Its job is to be a navigation beacon, which serves the "empty world, too few landmarks" feedback. Cost: one un-landable roof out of ~40, and it **cannot join a batch** (see §2). |
| 20 | District B landmark: **a sign / observation mast, not a landmark building.** Cheaper, authentic to a boulevard corridor, and a **distinct silhouette class** against District A's tower plateau — which reinforces what decision 10 exists for. |
| 21 | Vegetation split: **District A swaps to Canary Island date palm; District B keeps Phase 1's Mexican fan palm.** ⚠️ This is a real change to what Phase 1 currently renders, not new-content-only. **Not yet built — it is Engineer run 2.** |
| 22 | Shipped facade constants: **leave `towerShared` / `midriseA` / `midriseB` exactly as they ship. Do NOT nudge toward glassiness.** See §2's metalness paragraph — closed for the third and last time, and enforced by a byte-equality test rather than a promise. |
| 23 | The mast's name: **`AKC ENTERPRISE`.** User-supplied. **This is the ONLY name anywhere in `kodaman3d/`** — everything else stays generic pending the naming table, and decision 6 still reserves every future name to the user. It replaced the literal string `PLACEHOLDER`, which was deliberately implausible **so an unapproved name could not ship by looking reasonable. That worked** — the question reached the user instead of being settled by an agent. |
| 24 | **Phase 1's block is ABSORBED into District B.** The standalone `StreetBlock` does not survive as a third area. The spec's budget assumed the two districts *are* the world; the build kept Phase 1's block as well, which is why it measured 83 rather than 81. Left unreconciled, run 2's ~35-call props line would land the world near ~118 and leave only ~32 for CSM. ⚠️ **Real engineering, not bookkeeping** — see `StreetBlock.js`'s row in §2 for what must not be lost. |

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

| | Main pass | Shadow pass | **Total** | Ceiling |
|---|---:|---:|---:|---:|
| Phase 1, before the building realism pass | 28 | 21 | **49** | 60 |
| Phase 1, after (shipped) | 32 | 25 | **57** | 60 |
| **Phase 2 run 1 (current)** | **49** | **34** | **83** | **150** |

**`DESIGN_SPEC_PHASE_1_BUILDINGS.md`'s ledger counts main-pass objects only**, which is why it
promised eleven calls of headroom where three existed. **Every draw-call figure in this project must
state whether it counts one pass or both.** All figures in this document count both.

**The current position: 83 against a 150 ceiling, 67 headroom** — a graph walk, with a measured
worst-viewpoint `info.render.calls` of **81**. Triangles are **14,724** against a ~500,000 ceiling,
so triangles were never the binding constraint and still are not. **GPU frame time is 0.5 ms median
/ 1.1 ms p95** against a 16.7 ms budget at 60 Hz — about 3% used.

**Three things to know before budgeting against that 83:**

1. **It assumes `WEBGL_multi_draw`.** Without it the number is ~10× worse. See §2.
2. **The 83 includes Phase 1's block, which locked decision 24 dissolves into District B.** The
   spec's ~69-call rollup budgeted as though the two districts *are* the world; the build preserved
   the block as well. The absorption is the first item of Engineer run 2 precisely because it is
   what pays for run 2's own ~35-call props line.
3. **CSM's real shadow cost is still the biggest unmeasured unknown in the project** — nothing has
   measured it, and it is what the remaining headroom is being protected for.

**Prefer GPU frame time over fps in every report.** Headless Chrome pins rAF to 60, so the fps HUD
is meaningless there; and on real hardware a flat 60 is **vsync, not a cap and not a problem**.
Nothing in the code limits frame rate — the loop renders once per `requestAnimationFrame`,
independent of the fixed simulation step. **fps cannot distinguish "capped by vsync" from "just
barely managing"; frame time can.**

---

## 7. What is open

**Two items this list carried in its previous revision are DONE and have been removed:** the envMap
work (landed in `6a07c13`; see §2) and Phase 2 research (complete, two runs, all its decisions locked
as 10–24). The cape-fix browser look was subsumed by later spot-checks.

### Active / near-term

1. **Engineer run 2 — the props half of Phase 2's world.** This is the designated next action.
   Scope, in order: **locked decision 24's block absorption first** (it is what pays for the rest),
   then the design spec's §10 items 4–11 — vegetation (decision 21), rooftop HVAC and parapet rings,
   awnings and blade signs, streetlamps, small props, parked cars, utility poles, the terrain
   landmark, and the cut-priority tier. **Budget from the measured 83, not the spec's ~69.**
2. **The whole character half is unstarted and fully briefed.** Decisions 12–18 settle its art
   direction and `RESEARCH_PHASE_2_CHARACTER.md` is its research. The two halves are independent, so
   this is an equally valid thing to pick up. Two hard requirements carry into whatever builds it:
   **decision 14's 8 calls both passes**, and **decision 17's ORG-6 precision test as soon as any
   rigged mesh exists.**
3. **CSM shadows.** The new districts cast none — `Sky.js`'s shadow frustum is ±60 m in a 1,220 m
   world. Pre-existing, correctly out of run 1's scope, and **CSM is the fix**. Its real cost is the
   biggest unmeasured unknown in the project and is what the draw-call headroom is being saved for.
4. **PR #3** (`github.com/cyang3859/C_K_prototype/pull/3`, `feat/3d-open-world` → `dev`) — open,
   unmerged, 51+ commits. **Review and merge are the user's call, not an agent's.**

### Deliberately not touched, so nobody "fixes" them

- **Fog is 120–900 m against a 1,725 m sightline.** This looks like a bug and is not one to fix
  independently: **locked decision 11 makes that exact `Fog` object the world-edge-fade mechanism**,
  so retuning it now would pre-empt a locked design decision.
- **`JUMP_FORCE`** is ported into `tuning.js` and exposed in lil-gui but wired into nothing.
  Takeoff's vertical motion is entirely scripted. Left as a decision, not implemented speculatively.

### Requires a user decision, not further investigation

- **The trademark rename table is not yet usable.** `RESEARCH_FINDINGS.md` §C4 has the
  old→new mapping *structure* but its "proposed replacement" column holds descriptions
  ("new reporter-companion name") rather than actual names. Per locked decision 6, only the user
  can supply or approve names — no agent may fill this in and apply it. The repo is already
  public, so this blocks trademark-safe public release, not Phase 1 development. Roughly 900+
  occurrences across 10+ marks in `kodaman_prototype.html` (that file is never edited; this is
  about what Phase 2 ports forward). Suggested split, offered previously and still standing: the
  user names the highest-reference character personally, agents propose the rest for sign-off.
- ~~**Phase 2's draw-call ceiling**~~ — **SET at 150, both passes**, per locked decision 7. See §6.
- **Day/night cycle length.** Deliberately not put to the user yet: it is a feel call that needs
  `DayNightCycle.js` to exist before it can be judged, and asking now would only collect a guess.

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

This file is meant to replace the need to read the other **32 documents (14,006 lines)** end-to-end.
Consult them **by section**, and only when this file doesn't answer the question. Line counts
re-measured 2026-08-01; **11 documents were missing from the previous revision** and are added below.

**Two files outside `docs/handoff/` load or matter before any of them:**

| File | What it's for |
|---|---|
| `CLAUDE.md` (repo root) | **Loads automatically every session.** Carries the Playwright-first browser-testing rule and the `window.__game` driving notes. It supersedes the "agents in this pipeline have no browser" premise that still appears throughout the older documents below. |
| `KODAMAN_HANDOFF.md` (repo root) | Pre-pipeline handoff for the 2D prototype. **Stale — do not use.** Wrong line count (~5,200 vs actual 16,507) and wrong cape description (claims bezier quad-strip; it's a 7-segment closed polygon). Deliberately left untracked and uncommitted, because committing a known-wrong document would give it authority it should not have. |

| Document | Lines | What it's for | Read it when... |
|---|---:|---|---|
| `PIPELINE_STATE.md` | 1,493 | **The single source of truth for status, decisions, and the resume pointer.** Everything in this knowledge base's §6/§7 traces back to it. | You need the *current* status of anything, or the full history of a decision. Read first, always. |
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
| `BROWSER_SPOT_CHECK.md` / `_2` / `_3` / `_4` | 198 / 218 / 165 / 77 | Sequential browser spot-check guides, **written for the user to run** back when that was the only option. `_5` and `_6` are in the Phase 2 table below and were run by the assistant instead. | You need the exact verification steps for a specific fix, or want to write the next one. `_3` covers the cape-fix diagnosis correction and the tower-facade screenshots; `_4` is the cape-fix re-verification. **Their "the human is the only instrument" framing is obsolete** — see `CLAUDE.md`. |
| `DESIGN_AGENT_BRIEF.md` | 220 | Charter for the sixth pipeline stage (Design), added session 3. **Corrected at source 2026-08-01** — five stale places, including a constraints table that still said *45 measured / 60 ceiling* and *primitives-only*. Phase 1 figures were kept and **labelled as history rather than deleted**, because this project has repeatedly been bitten by documents that quietly changed a number. | Before spawning any Design-stage agent. Safe to spawn from directly again. |
| `DESIGN_SPEC_PHASE_1_BUILDINGS.md` | 446 | Building realism design spec — facades, roof atlas, parapet/HVAC/awning/sign instancing. | Understanding why `StreetBlock.js` looks the way it does. **Its draw-call ledger is wrong** — see §6's correction. |
| `REVIEW_DESIGN_SPEC_BUILDINGS.md` | 330 | Feasibility gate on the buildings spec — APPROVED WITH CORRECTIONS (roof-atlas aspect fix, second `Box3` for parapet collision). | Understanding which parts of the buildings spec shipped as-is vs. corrected. |
| `DESIGN_SPEC_TOWER_PALETTE.md` | 197 | The tower-facade palette fix (metalness pulled down to compensate for no envMap) and the envMap recommendation that's now in progress. | Understanding the current metalness values in `StreetBlock.js`'s tower material, or the reasoning behind the in-flight envMap work in §2/§5. |

### Phase 2 documents — all added after this file's first revision

| Document | Lines | What it's for | Read it when... |
|---|---:|---|---|
| `RESEARCH_PHASE_2_WORLD.md` | 1,009 | Phase 2 research run 1 of 2 — the world half. 38 findings: `DIS-*` (districts), `BUD-*` (draw-call budget strategy), `DEN-*` (massing/density), `PROP-*`, `MAT-*`, `ORG-1..3`. | **Consult by finding ID, never end-to-end.** IDs are unique across both research runs — run 2 continued run 1's numbering, so bare citations are safe. |
| `RESEARCH_PHASE_2_CHARACTER.md` | 937 | Phase 2 research run 2 of 2 — the character half. 29 findings: `ASSET-*`, `RIG-*`, `ANIM-*`, `PROC-*`, `CAPE-*`, `ART-*`, `DRAW-*`, `ORG-4..7`, `CLIP-*`. | Anything to do with the hero rig, animation, or the cape. **This is the character half's brief** — it plus decisions 12–18 is everything that work needs. |
| `PHASE_2_RESEARCH_BRIEF.md` / `_CHARACTER.md` | 227 / 184 | The two research briefs. | Historical, or as a template for writing the next research brief. |
| `DESIGN_BRIEF_PHASE_2_DISTRICTS.md` | 235 | The Design agent's brief for the districts, written to the charter's five-part Research→Design contract. | Template for a future Design brief. Notable for **overriding three stale rows in the charter as a visible table rather than a quiet restatement** — left uncorrected the agent would have designed to less than half the real budget. |
| `DESIGN_SPEC_PHASE_2_DISTRICTS.md` | 781 | **The spec Engineer runs 1 and 2 build from.** 7 facade families, 5 massing recipes, the §6 merged ground/road scheme, both landmarks, and the §10 priority order that defines run 2's scope. | Before any district work. **§BGT-1 carries an annotated orchestrator correction** — its hero row originally used 14 calls where decision 14 says 8. The error was conservative (it over-budgeted), so nothing specified was ever at risk. |
| `REVIEW_DESIGN_SPEC_PHASE_2_DISTRICTS.md` | 222 | Review's feasibility gate on that spec — **budget and feasibility only; it gets no vote on taste.** | Understanding which parts of the spec were challenged. Its most valuable act was closing §11 item 1 (the `BatchedMesh` per-instance material question, §2 above). One of its two findings, `RVW-9`, was **itself wrong** and was fixed differently than it framed. |
| `ENGINEER_BRIEF_PHASE_2_DISTRICTS.md` | 234 | Run 1's build order. | **Before briefing Engineer run 2** — it is a good template and its process rules, budget facts and trap warnings all still apply. |
| `ENGINEER_PHASE_2_DISTRICTS.md` | 431 | Run 1's own report: what was built, the measured budget, and **four places the spec was wrong**, all handled. | Understanding why the districts are shaped the way they are. §3.1 documents FAM-5's terracotta landing on every roof — a defect **caught in a screenshot, not in review.** |
| `BROWSER_SPOT_CHECK_5.md` | 162 | The PMREM env map, run under Playwright in session 8, 4/4. | The measured ENV 0→1 luminance table (§2 above summarizes it). |
| `BROWSER_SPOT_CHECK_6.md` | 83 | The two districts, run under Playwright in session 9. | Confirmation that decision 10's central bet pays off — the districts do read as two distinct places. Also records the mast-signage defect and its three fixes. |

---

## 9. Working practices that have repeatedly paid

Added in the session-10 refresh. These are not style preferences — each one is here because it
caught something real, and in several cases caught it more than once.

**Measure; don't estimate, and don't look harder.** The three mast-signage fixes are the cleanest
example. Fix 2 was diagnosed by comparing the sign board's 7 m width against the mast column's
radius *at that height*; fix 3 by reading the texture atlas back with `getImageData` and measuring
the text's bounding box — which showed the texture was **already** correct at 88% of face width and
the board's portrait aspect ratio was the real problem. Enlarging text that was already the right
size would have wasted several rounds. Similarly, `gl.readPixels` over fixed screen regions turned
"the towers look dark" into a defensible +780% before/after.

**Size from measurement, not from constants.** The original signage defect came precisely from a
font size hard-coded at `bh * 0.11`, a constant that happened to suit the old `PLACEHOLDER` string
and broke the moment a real name replaced it. Everything now sizes from `measureText`, so a future
approved name of any length or word count fits without another round.

**"The object renders" is not the same check as "the object reads."** Session 9's automated pass
verified the mast existed and its sign text was present, and signed the landmark off. **A human
caught in one screenshot what that pass had approved.** The Playwright-first rule is still right —
it caught FAM-5's terracotta, which no human would have hunted for — but legibility, silhouette and
"does this look right" are a different question from presence.

**Two defects in Phase 2 run 1 were catchable only in a browser** — FAM-5's terracotta on every roof,
and the signage overflow. Neither was catchable by review or by the test suite. That is the strongest
evidence in the project for driving the browser rather than reasoning about it.

**Write briefs that invite an agent to distrust what it was handed.** Four times now an agent has
been right to contradict its own brief or the document it was given — and once, an agent's own
finding needed the same treatment (`RVW-9`, which called two readings "identical either way" when
they differed by two draw calls). Both halves of that practice should continue.

**Enforce decisions in code, not in prose.** Locked decision 22 is a byte-equality test, not a
promise. Locked decision 23's name is one exported constant pinned by a test — not because the
string is aesthetically load-bearing, but so it can only ever change by the same sign-off that put
it there. And `PLACEHOLDER` was deliberately implausible so an unapproved name could not ship by
looking reasonable; **that worked**, and the question reached the user instead of being settled by
an agent.

**Re-derive numbers rather than checking someone's arithmetic for plausibility.** Every draw-call
and triangle figure in run 1 was recomputed from scratch rather than sanity-checked, which is how
the §BGT-1 reconciliation (locked decision 24) surfaced at all.

**Never quietly change a number and leave readers unable to tell which figure an older document
meant.** When `DESIGN_AGENT_BRIEF.md` was corrected, its Phase 1 figures were kept and **labelled as
history** rather than deleted. This document's header does the same for its own refresh.

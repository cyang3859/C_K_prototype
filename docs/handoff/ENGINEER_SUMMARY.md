# Engineer Summary — Phase 1 Vertical Slice

**Branch:** `feat/3d-open-world` · **Location:** `kodaman3d/` · **Not pushed** — local commits only.

Built against `docs/handoff/ENGINEER_BRIEF.md` as the sole specification.
`kodaman_prototype.html` was never opened, imported or modified.

**Status:** complete and building. `npm run build` succeeds, `npm run dev` and
`npm run preview` both serve, and 60 unit tests pass. **No part of this was
visually verified** — this environment has no browser and no GPU. Everything
tagged `[HUMAN]`, and the runtime half of everything tagged `[HEADLESS]`, is
untested. See §3.

---

## 1. What was built, file by file

### Commits

| Commit | Contents |
|---|---|
| `9660a73` | scaffold, `core/` time/input/renderer, `Scale.js`, `dispose.js`, `tuning.js` |
| `ff2c3a5` | `Collision.js`, `LocomotionController.js`, `CameraRig.js`, both test suites |
| `4c354fc` | `Sky.js`, `StreetBlock.js`, `Hero.js`, `DebugHud.js`, `Game.js`, `main.js` |
| (final) | `README.md`, this summary, input-hygiene tests |

### `src/core/`

- **`Scale.js`** — `PX_TO_M = 0.2`, `HERO_HEIGHT_M = 1.85`, `HERO_RADIUS_M = 0.35`, `px()`.
  Also holds the *only* implementation of the yaw convention (`yawForward`,
  `yawRight`, `yawFromDirection`, `shortestAngleDelta`). Both the locomotion
  controller and the camera rig derive their basis from these, which is what
  structurally prevents one module treating +yaw as clockwise and the other
  counter-clockwise. The two-independent-scales rule (positions port through
  `PX_TO_M`, physical dimensions never do) is documented at length in the header.

- **`dispose.js`** — `disposeObject3D(root)` and `disposeMaterial(mat)`.
  Texture disposal duck-types on `value.isTexture` across the material's own keys
  rather than checking a hardcoded map-slot list, because that list differs per
  material type and grows between Three.js releases.

- **`Time.js`** — the fixed-timestep accumulator, `fixedDt = 1/60`, `maxSteps = 5`,
  `maxFrameDt = 0.25`. Exposes `beginFrame(nowMs) → stepsToRun`, `alpha`, `fps`,
  and `resetBaseline()` for focus recovery.

- **`Input.js`** — `event.code` keyboard state with `down`/`pressed`/`released`
  per key, edges cleared by `endStep()` so they live exactly one fixed step.
  Auto-repeat filtered. Pointer-lock mouse accumulation, wheel normalisation
  across `deltaMode`, `preventDefault` on Space/arrows, `blur` clears all state,
  click-to-lock, Escape-to-release. J/K/L/Z/C log once per press and do nothing
  else; J/K/L additionally set the `fine` flag.

- **`Renderer.js`** — `WebGLRenderer` exactly as specified: `antialias`,
  `high-performance`, DPR hard-capped at 2, `SRGBColorSpace`, ACES tone mapping at
  exposure 1.0, `PCFSoftShadowMap`. Resize debounced one animation frame. No
  `EffectComposer`. Near/far read from `tuning.js` rather than inlined, so Phase 2
  can raise them together.

- **`Game.js`** — owns every system, runs the loop, enforces the mandated step
  order (input → locomotion → world → camera → endStep), and implements a real
  `destroy()` wired to Vite HMR.

### `src/config/tuning.js`

Every constant from the brief's table, as a **mutable object** (`TUNING`) so
lil-gui binds to it live, plus a frozen `DEFAULT_TUNING` and `resetTuning()`.
`JUMP_FORCE` is present and exposed in the panel but is called from nowhere, as
instructed. The header carries the full §6.2 explanation of why hover damping is
a half-life and not a `^60` conversion.

### `src/world/`

- **`Collision.js`** — `resolveCapsule()`, `raycastBoxes()`, `createBoundaryBoxes()`,
  and a `CollisionWorld` class. Vertical resolution is a **swept** downward test
  between `previousY` and the new `y`, which is what makes the "cannot fall
  through the ground at any velocity" guarantee hold. Horizontal is a
  two-iteration closest-point push-out restricted to XZ. The playable extent is
  four ordinary boundary boxes running through the same push-out path as
  buildings — no special-case clamping code anywhere. Linear scan, no broadphase.
  No Three.js scene access; imports `Box3`/`Vector3` as plain math types only.

- **`StreetBlock.js`** — data-driven via the exported `BLOCK` and `STREET`
  objects. Boulevard built to City of LA Standard Plan S-470-1 "Avenue I":
  30.48 m ROW, 21.34 m roadway, 4.57 m sidewalks, 3.35 m lanes. 10 generic
  buildings (4 low-rise 8–12 m, 4 mid-rise 24–33 m, 2 towers at 90 m and 64 m),
  all inside ±50 m. Facade textures are procedurally drawn to an offscreen canvas
  (one `CanvasTexture` per building *kind*, not per building) with per-building UV
  scaling so window size is constant in metres. Palms (50), lamps (24) and the
  centreline are `InstancedMesh`. All authored content is inside ±150 m.

- **`Sky.js`** — directional key light intensity 2.5 at (80, 120, 60), 2048²
  shadow map over a ±60 m ortho frustum, `bias -0.0005`, `normalBias 0.02`,
  hemisphere fill 0.6, `Fog(0xbfc9d4, 120, 900)` and matching background. Flat
  colour + fog, not the addon `Sky` object.

### `src/entities/Hero.js`

`THREE.Group` with torso `CapsuleGeometry(0.28, 0.6)`, head `SphereGeometry(0.16)`,
four limbs `CapsuleGeometry(0.09, 0.5)` each in its own named joint group pivoted
at the shoulder/hip, and a `PlaneGeometry(0.7, 1.1, 4, 6)` `DoubleSide` cape.
The cape is a CPU sine wobble writing **absolute** positions computed from a
rest-pose snapshot each step — not accumulated deltas, which drift and inflate
the mesh over a few minutes. `setPersona()` writes three material colours and
nothing else: no rebuild, no geometry swap, no dispose call.

### `src/controllers/`

- **`LocomotionController.js`** — the four-state FSM. Horizontal movement runs in
  all four states. `GRAVITY` appears in exactly one branch. Shift is a cap raise
  implemented through a capped-delta acceleration toward the target, so releasing
  it decelerates through the same curve with no separate braking path. Hover uses
  the half-life decay plus the 0.11 m/s snap. Exports `horizontalSpeedCap()`,
  `frictionFactor()`, `hoverDampingFactor()`, `approach()` and `createHeroState()`
  as pure, directly testable units.

- **`CameraRig.js`** — spring arm with one damping constant (`lambda = 6.32`)
  reused for distance, height, FOV and arm recovery. Pitch clamped to
  `[-0.5, 1.2]`, yaw unbounded. Plain raycast obstruction with 0.2 m padding,
  pulling in immediately and recovering out smoothly. Ground/flight parameters
  cross-fade on a 0.6 s **linear timer** (not an exponential) so the transition
  has a defined, samplable duration. Dash FOV surge scales with actual speed.

### `src/ui/DebugHud.js`

stats.js panel, lil-gui folders covering every tuning constant (ground, flight,
hover damping, camera, reset/log actions), and a DOM readout showing FSM state,
`onGround`, persona, position, velocity, facing, camera blend/FOV/arm, fps,
steps-per-frame, **draw calls, triangles, geometries and textures** — the last
four being exactly the counters criteria 6 and 28 read. F1 toggles it.

---

## 2. Acceptance criteria — verified, unverified, failed

**Nothing failed.** The split below is between what I could actually execute and
what genuinely needs a browser or a person.

### Verified by execution

| # | Criterion | How |
|---|---|---|
| 1 | `npm install` clean on Node 20.20.2 | Ran it: 44 packages, **zero `EBADENGINE`**, zero vulnerabilities |
| 3 | `npm run build` succeeds; `preview` serves | Build: 25 modules, `dist/assets/index-*.js` 585.44 kB / 151.37 kB gzipped, 846 ms. `npm run preview` returns 200 for both the page and the bundle |
| 4 | `npm test` passes, both suites green | **60 tests, 2 files, all passing** |
| 10 | Ground Shift raises the cap to `DASH_SPEED` | Pure-function assertion plus a 120-step simulation reaching 13.0 m/s, and decaying back to 7.5 on release |
| 11 | Cannot pass through a building | Push-out lands exactly at face + radius; 120 steps driving into a wall at the 20.5 m/s dash cap never enter the footprint; wall-slide preserves the full tangential component |
| 12 | Cannot leave the 300 m extent | 30 simulated seconds at dash speed along six directions, on the ground and at 120 m altitude — clamped to 150 − radius every time |
| 13 | Never falls through the ground | A single 150 m one-step drop still resolves onto the plane; 600 steps of absurd acceleration never put `y` below 0 |
| 15 | Climb/descend caps | 7.5 m/s and −6.1 m/s exactly |
| 16 | Hover holds altitude; gravity never applied in flight | `velocity.y` reaches exactly 0 within 30 steps and stays 0 for 60 more; altitude drift over 3 s is **0**. Gravity proved absent by setting `GRAVITY = 100000` and showing flying, takeoff and landing are all unaffected |
| 17 | Flight dash preserves altitude | Speed rises to 20.5 m/s while `y` changes by 0 over 60 steps |
| 18 | G lands, FSM returns to grounded | Full descent simulated to touchdown; `onGround`, `landing`, `flightActive`, `y` and `velocity.y` all correct |
| 19 | Holding W aborts landing | Aborts to `flying` mid-descent, above ground |
| 21 | Fine mode multiplies thrust and caps by 0.4 | Both the pure cap function and a 180-step simulation; also covers easing an over-cap climb down instead of sticking |
| 25 | Camera smoothing is framerate-independent | 60 × 1/60 vs 240 × 1/240 agree to < 1e-9 and match the closed form `1 − e^(−λ)`; `λ = 6.32` confirmed to reproduce the 2D 0.1-per-frame lerp |
| 4 (framerate) | Damping is framerate-independent | Ground and air friction at 60 vs 120 Hz agree within 1e-3; a dedicated guard test fails if hover damping is ever "simplified" onto the `^60` formula |
| 20 (proxy) | Fly above the 90 m tower and land on its roof | The automated proxy the brief permits: the hero takes off, climbs past 95 m, flies over an 8×8×90 m tower, lands, and ends with `onGround === true` at `y === 90` — the roof, not the ground plane |
| 27 (part) | Blur does not leave a key stuck | Held W+Shift, fired `blur`, asserted every key and delta cleared and the hero stops climbing when fed the post-blur snapshot. Auto-repeat also proven not to re-fire the takeoff edge |

Also covered by tests but not separately numbered: rooftop landing vs ground
plane, not snapping down onto a roof while ascending, falling off a roof edge,
standing on a roof not being treated as standing in a wall, corner convergence
without jitter over 8 re-resolves, deep-penetration escape, camera-relative
basis under a rotated camera, diagonal input not exceeding the cap, and yaw
turning at a limited rate rather than snapping (criterion 9's mechanical half).

### Could not verify — no browser, no GPU in this environment

| # | Criterion | State |
|---|---|---|
| 2 | dev server + zero console errors + block renders correctly | Dev server confirmed serving; every module returns 200 and transforms. **Console output and the visual result are unverified.** |
| 5 | ≥ 60 fps at 1920×1080 | Needs real hardware. A headless number would not count anyway |
| 6 | `render.calls` < 60 on a static frame | **Estimated ~49** (28 main pass + ~21 shadow pass, before frustum culling). Designed for this budget — it is why buildings share three materials instead of using per-face material arrays, which would have cost 60 draw calls on their own. **Please confirm from the HUD readout.** |
| 7 | Shadows stable, no acne or swimming | Bias values are the specified ones; unverified |
| 8 | Resize | Implemented and debounced; unverified at runtime |
| 9 | WASD feel and smooth yaw | Mechanically tested; the feel half is human |
| 14 | Takeoff burst + camera pull-back + FOV widen | FSM half is tested. `camera.fov` behaviour is implemented but never observed |
| 20 | Flying to the real tower in the real scene | Only the proxy is verified |
| 22, 23 | Mouse look, camera never penetrating a building | Exploratory human checks by definition |
| 24 | 0.6 s cross-fade | Linear timer, so it completes in exactly `CAM_BLEND_TIME`; never sampled at runtime |
| 26 | Q swap with unchanged resource counts | True by construction (three colour writes, no allocation) but unobserved |
| 28 | Flat memory over 5 minutes idle | Needs a running browser |

---

## 3. Deviations from the brief, and why

1. **Sidewalk and curb height reduced from the real 15 cm to 3 cm / 7 cm.**
   The most significant deviation. Phase 1's collision model is a flat implicit
   ground plane plus building AABBs, with no step-up logic (not in scope). A
   truthful 15 cm curb would be a lie the collision cannot back: either the
   hero's feet sink 15 cm into every sidewalk, or — if the slabs became colliders
   — the horizontal push-out treats every curb as a wall and the hero can never
   step onto a sidewalk at all. Keeping the walkable surface within centimetres of
   `y = 0` makes the geometry match the physics. Documented in place with a
   Phase 2 note to restore the real dimensions once step-up exists. **The ROW,
   roadway and sidewalk *widths* are exactly the S-470-1 figures** — only the
   vertical relief was changed.

2. **Fine mode eases an over-cap climb down to the lowered cap** rather than
   leaving it untouched. The brief's literal rule ("thrust only while
   `velocity.y < cap`") means engaging J/K/L at full 7.5 m/s climb leaves the
   hero stuck above the 3.0 m/s fine cap indefinitely, which defeats the purpose
   of a precision mode. `approach()` eases toward the cap from either side at the
   thrust rate — identical behaviour in every normal case.

3. **The accumulator lives in `Time.js`, not inlined in `Game.js`.** The brief
   sketches the `while` loop inside `Game.js` but the file tree assigns
   "fixed-timestep accumulator, dt clamping, fps tracking" to `Time.js`. The
   arithmetic and both guards are identical; `Game.js` calls
   `time.beginFrame(now)` and runs the returned number of steps.

4. **`frictionFactor` computes `pow(f, 60·dt)`** rather than
   `pow(precomputed_f60, dt)`. Mathematically identical, one fewer `pow`, and it
   means editing the per-frame factor in lil-gui takes effect immediately with no
   derived constant to keep in sync. `GROUND_FRICTION_PER_SEC` and
   `AIR_FRICTION_PER_SEC` are still exported as documented computed constants.

5. **`CollisionWorld.raycast()` excludes the boundary walls.** The camera and the
   hero share one box list, as required, but the camera sees only the `buildings`
   view of it. The boundary volumes are invisible, and letting the spring arm
   collide with them would yank the camera inward for no visible reason at the
   edge of the map. One source of truth, two views — not a second copy.

6. **Building roof/floor UVs are collapsed onto a plain band in the facade
   texture** instead of using a second roof material. A `BoxGeometry` material
   array renders one draw call per group, so 10 buildings × 6 groups = 60 draw
   calls would have blown criterion 6 by itself. This gives flat rooftops for free.

7. **Procedural limb swing added to the hero.** The brief specifies only cape
   animation. Two sine waves drive the four joint groups (plus an eased flight
   pose). No `AnimationMixer`, no skeleton, ~10 lines. Added because most
   `[HUMAN]` criteria ask a person to judge whether locomotion feels right, and a
   hero whose legs never move makes that judgement much harder.

8. **Two input-hygiene tests live in `locomotion.test.js`.** Criterion 27 is
   tagged `[HEADLESS]`, not `[VITEST]`, but the stuck-key bug it guards is a
   locomotion failure and `Input.js` runs with no DOM when given a null target.
   Cheap to verify, so I did. The "no velocity spike on refocus" half still needs
   a browser.

9. **The camera-smoothing framerate test is in `locomotion.test.js`** because the
   file tree permits exactly two test files.

10. **Dash cap treats `takeoff` and `landing` as airborne**, so a Shift-dash
    mid-takeoff uses `FLIGHT_DASH_SPEED`. Horizontal control is fully active in
    all four states, so governing it by the ground number mid-takeoff would be
    inconsistent.

11. **`public/.gitkeep`** — the file tree lists an empty `public/`, and git cannot
    track an empty directory.

12. **10 buildings**, within the brief's 8–12 range. Heights: 9, 24, **90**, 31,
    11, 8, 27, 12, **64**, 33 m.

Nothing on the non-goals list was added: no combat, enemies, HP, dialogue,
quests, streaming, LOD, interiors, companions, physics engine, glTF, skeletal
animation, post-processing, audio, save/load, minimap, day/night, CSM, or spatial
hash. No named characters, companies or locations — the hero is "the hero", and
buildings are `lowrise`/`midrise`/`tower`. `WebGLRenderer` only, no fallback path.

---

## 4. What QA should look at especially closely

1. **Draw calls (criterion 6).** My estimate is ~49 against a 60 budget. It is the
   tightest number in the slice. Read it straight off the HUD on a static frame.

2. **Everything visual, without exception.** I have not seen a single frame. The
   block's composition, the facade textures, the hero's proportions, the cape's
   motion, shadow quality and the fog distances are all unobserved. The cape in
   particular is tuned by arithmetic, not by eye — expect to retune
   `_animateCape`'s constants.

3. **Curb and sidewalk relief.** See deviation 1. Confirm the shallow curbs read
   acceptably, or decide the raised curb matters enough to schedule step-up logic.

4. **Camera corner clipping (criterion 23).** The plain raycast is the brief's
   deliberate Phase 1 choice with a sphere-cast as the *named* fallback. If you
   find near-plane clipping at building corners, that upgrade is a change to one
   call in `CameraRig.update()` — this is the expected trigger, not a surprise.

5. **Horizontal collision is not swept.** Vertical is; horizontal is a
   closest-point push-out. A single-step horizontal displacement exceeding a
   box's thickness would tunnel. Not reachable at Phase 1 tuning — the maximum is
   0.34 m per step against buildings at least 16 m thick — but if someone raises
   `FLIGHT_DASH_SPEED` past roughly 480 m/s in the lil-gui panel, it becomes
   reachable. Worth knowing before anyone reports it as a mystery bug.

6. **Palms and lamps have no colliders,** by design — the brief specifies 12
   buildings plus 4 boundary volumes as the entire collider set. The hero walks
   and flies straight through palm trunks. Confirm that is acceptable for Phase 1.

7. **Takeoff timing.** The FSM reaches `flying` on the 12th fixed step counting
   the step in which W was pressed. If the intent was 12 steps *after* that step,
   it is a one-line change — but the tests encode the current reading.

8. **Persona swap keeps the cape** (recoloured to a muted long-coat tone) because
   the brief mandates a colour-only swap. If a caped civilian looks wrong,
   toggling `cape.visible` is still allocation-free and would not violate
   criterion 26 — but it is a deliberate decision, not an oversight.

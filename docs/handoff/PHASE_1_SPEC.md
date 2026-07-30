# Phase 1 Spec — Vertical Slice

**Status:** ready to implement
**Branch:** `feat/3d-open-world`
**Scope discipline:** This phase ships a hero who walks and flies on one LA street block with a
third-person camera and a working loop. **Nothing else.** No combat, no enemies, no dialogue, no
quests, no streaming, no interiors. Those are Phases 2–6. If a task is not in the file list below,
it is out of scope.

---

## 1. Verified toolchain

Confirmed on the dev machine at time of writing:

| Tool | Version | Note |
|---|---|---|
| Node | v20.20.2 | satisfies `^20.19.0` |
| npm | 10.8.2 | |
| git | 2.50.1 | |
| gh | 2.94.0 | authenticated |

---

## 2. Exact dependencies

Versions confirmed against the npm registry. Pin exactly (no `^`) for Phase 1 so QA and the
engineer resolve identical trees; loosen later once the build is stable.

### `package.json`

```json
{
  "name": "kodaman3d",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "engines": { "node": "^20.19.0 || >=22.12.0" },
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "three": "0.185.1"
  },
  "devDependencies": {
    "vite": "7.3.6",
    "vitest": "4.1.10",
    "lil-gui": "0.21.0",
    "stats.js": "0.17.0"
  }
}
```

**Why Vite 7.3.6 and not 8.1.5.** Both declare `engines.node: ^20.19.0 || >=22.12.0`, so both run
on Node 20.20.2. Vite 7 is the conservative pin with the broader plugin ecosystem. Vite 8 is a
valid choice and is logged as an open question in `IMPLEMENTATION_PLAN.md` — it is a one-line
change if the user prefers latest.

**Why no physics engine in Phase 1.** The hero is the only collider and the block is hand-authored.
A ~150-line kinematic capsule controller with analytic ground/AABB resolution is less code than
wiring Rapier's WASM init, and it keeps the slice dependency-light. Rapier enters in Phase 3 when
enemies, thrown objects, and vehicles arrive. See `RESEARCH_FINDINGS.md` §A7 for the full
comparison and justification.

**Three.js import style.** `three` 0.185.1 = r185. Addons import from `three/addons/…` (which maps
to `three/examples/jsm/…`). Phase 1 needs no addons beyond `GLTFLoader` (only if a placeholder
model is used — the default is primitive-built, so likely zero addons).

---

## 3. Directory layout for Phase 1

New project lives in a subdirectory. `kodaman_prototype.html` at repo root is untouched.

```
kodaman3d/
├── index.html
├── package.json
├── vite.config.js
├── .gitignore
├── public/
│   └── (empty in Phase 1)
├── src/
│   ├── main.js                     # entry: bootstrap + start loop
│   ├── core/
│   │   ├── Game.js                 # owns systems, fixed-timestep loop
│   │   ├── Renderer.js             # WebGLRenderer setup, resize, tone mapping
│   │   ├── Input.js                # keyboard/pointer state + edge detection
│   │   ├── Time.js                 # accumulator, dt clamping, frame stats
│   │   └── Scale.js                # px→m constants, shared world units
│   ├── entities/
│   │   └── Hero.js                 # hero model + state, persona swap
│   ├── controllers/
│   │   ├── LocomotionController.js # ground+flight FSM, capsule collision
│   │   └── CameraRig.js            # spring-arm third-person camera
│   ├── world/
│   │   ├── StreetBlock.js          # the one hand-authored block
│   │   ├── Collision.js            # static AABB set + capsule resolve
│   │   └── Sky.js                  # sky dome + sun + fog (static midday)
│   ├── ui/
│   │   └── DebugHud.js             # stats.js + lil-gui + state readout
│   └── config/
│       └── tuning.js               # all movement constants (ported values)
└── tests/
    ├── locomotion.test.js
    └── collision.test.js
```

---

## 4. World units and the px→m scale

The 2D prototype is a side-scroller: `WORLD_WIDTH = 20000`, `GROUND_Y = 1000`, canvas 960×540,
hero `52w × 100h` px.

**Two independent scales, and this must be explicit or the city comes out wrong:**

- **World-position scale: `1 px = 0.2 m`.** The 20,000 px corridor becomes a **4,000 m** spine.
  This is the number used to place landmarks.
- **Character scale: real proportions.** Hero is **1.85 m** tall, not `100 px × 0.2 = 20 m`.

The 2D game deliberately draws characters oversized relative to the world so they read at 960×540.
Carrying that ratio into 3D would produce a city of 20 m giants. So: **positions port through the
0.2 m/px scale; dimensions do not.** Consequence: landmarks end up generously spaced, which is
correct for a real city and good for a flying hero.

`src/core/Scale.js` exports:

```js
export const PX_TO_M = 0.2;
export const HERO_HEIGHT_M = 1.85;
export const HERO_RADIUS_M = 0.35;
export const px = (n) => n * PX_TO_M;   // 2D world px -> metres
```

### Phase 1 block extents

One block, centred on origin, sized from real LA figures (`RESEARCH_FINDINGS.md` §B1):

| Element | Value |
|---|---|
| Block footprint | 100 m × 100 m buildable core |
| Boulevard right-of-way | 30 m (roadway + parkway + sidewalk) |
| Sidewalk width | 4.5 m each side |
| Playable extent | 300 m × 300 m, hard-clamped |
| Ground plane | y = 0 |
| Building count | 8–12 |
| Building heights | mixed: 4 × low-rise 8–12 m, 4 × mid-rise 20–35 m, 2 × tower 60–90 m |

Palms: `Washingtonia robusta`, 12–18 m, spaced 12 m along the boulevard parkway.

---

## 5. Module responsibilities

### `src/main.js`
Create `Game`, `await game.init()`, `game.start()`. Expose `window.__game` in dev only
(`import.meta.env.DEV`) for QA poking. No logic here.

### `src/core/Renderer.js`
- `WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })`
- `setPixelRatio(Math.min(devicePixelRatio, 2))` — hard cap at 2; uncapped DPR on a 3× display is
  the single most common browser-3D perf own-goal.
- `outputColorSpace = THREE.SRGBColorSpace` (r185 default, set explicitly for clarity)
- `toneMapping = THREE.ACESFilmicToneMapping`, `toneMappingExposure = 1.0`
- `shadowMap.enabled = true`, `type = THREE.PCFSoftShadowMap`
- Resize handler on `window.resize`, debounced one frame; updates camera aspect.
- **No `EffectComposer` in Phase 1.** Post-processing is Phase 7.

### `src/core/Time.js`
Fixed-timestep accumulator.

```
FIXED_DT   = 1/60      // simulation step, seconds
MAX_STEPS  = 5         // spiral-of-death guard
dt_clamped = min(rawDeltaSeconds, 0.25)
```

Exposes `{ fixedDt, alpha, fps }`. `alpha` is the leftover fraction for render interpolation.

### `src/core/Input.js`
Tracks `event.code` (physical keys — matches the 2D prototype, layout-independent).

State per key: `down`, `pressed` (this step only), `released`. `Input.endStep()` clears edges.
Also: `preventDefault` on Space and arrows; `blur` handler clears all keys (prevents stuck-key
when the user alt-tabs mid-flight).

Pointer lock for mouse-look: click canvas → `requestPointerLock()`; Escape releases.
Accumulate `movementX/movementY` into `look.dx/dy`, consumed and zeroed each step.

### `src/core/Game.js`
Owns: renderer, scene, camera, input, time, hero, controller, camera rig, world, debug HUD.
Runs the loop. Order per fixed step is load-bearing:

```
1. input.beginStep()
2. locomotion.update(fixedDt, input)      // reads input, writes hero transform
3. world.update(fixedDt)                  // (Phase 1: no-op / sky only)
4. cameraRig.update(fixedDt, hero)        // reads final hero transform
5. input.endStep()
```

Then once per rendered frame (not per fixed step): `debugHud.update()`, `renderer.render()`.

Camera must update **after** locomotion in the same step, or the camera lags the hero by one frame
and the whole game feels soft.

### `src/entities/Hero.js`
Primitive-built, no external assets (see `RESEARCH_FINDINGS.md` §C4 — this is the deliberate
Phase 1 choice; glTF characters arrive Phase 5).

`THREE.Group` named `hero`, containing:
- torso: `CapsuleGeometry(0.28, 0.6)`
- head: `SphereGeometry(0.16)`
- arms/legs: 4 × `CapsuleGeometry(0.09, 0.5)` in named sub-groups so Phase 5 can swap in bones
- cape: `PlaneGeometry(0.7, 1.1, 4, 6)`, `DoubleSide` — Phase 1 animates it with a vertex-shader-free
  CPU sine wobble on the position attribute; real cloth sim is Phase 5.

State: `{ persona: 'super'|'civilian', facing: number (radians), velocity: Vector3, onGround: bool,
flightActive: bool, landing: bool }`.

`setPersona(p)` swaps material colours only (super: primary blue `#3a6fd9`, cape red; civilian:
muted jacket). No mesh rebuild — this keeps the Q toggle instant.

### `src/world/Collision.js`
Static `Array<Box3>` for buildings + a ground plane at y=0.

`resolveCapsule(position, radius, height, boxes)`:
1. Vertical: raycast down from `position` for ground/rooftop contact → sets `onGround`, snaps y.
2. Horizontal: for each candidate box, compute closest point to the capsule's vertical segment,
   push out along the minimum-penetration axis. Two iterations to settle corners.
3. Broadphase for Phase 1: linear scan. 12 boxes — a spatial hash is premature.

Pure functions, no Three.js scene access. **This is the module the unit tests target.**

### `src/controllers/LocomotionController.js`
The heart of the slice. FSM with states: `grounded`, `takeoff`, `flying`, `landing`.

Ported tuning, converted from px/frame to m/s. The 2D values are per-frame at 60 fps, so
`m/s = px_per_frame × 60 × PX_TO_M` for velocities and `× 3600 ×  PX_TO_M` for accelerations.

| 2D constant | 2D value | 3D value | Unit |
|---|---|---|---|
| `MAX_SPEED` | 5.5 px/f | 7.5 | m/s walk/run cap |
| `MOVE_SPEED` (accel) | 0.6 px/f² | 26.0 | m/s² |
| `GRAVITY` | 0.55 px/f² | 23.8 | m/s² |
| `JUMP_FORCE` | −14 px/f | 9.4 | m/s initial up |
| `DASH_SPEED` | 9.5 px/f | 13.0 | m/s ground dash |
| `FLIGHT_DASH_SPEED` | 15 px/f | 20.5 | m/s flight boost |
| `FLIGHT_UP_THRUST` | −0.85 px/f² | 36.7 | m/s² |
| `FLIGHT_DOWN_THRUST` | 0.7 px/f² | 30.2 | m/s² |
| `MAX_FLIGHT_UP_SPEED` | −5.5 px/f | 7.5 | m/s climb cap |
| `MAX_FLIGHT_DOWN_SPEED` | 4.5 px/f | 6.1 | m/s dive cap |
| `FLIGHT_HOVER_DAMPING` | 0.18 /frame | — | see note |
| `FLIGHT_FINE_MULT` | 0.4 | 0.4 | unitless |
| `GROUND_FRICTION` | 0.82 /frame | — | see note |
| `AIR_FRICTION` | 0.92 /frame | — | see note |

**Per-frame damping factors must not be copied literally.** Convert to a rate:
`perSecond = factor ^ 60`, applied as `v *= perSecond ** dt`. So `GROUND_FRICTION 0.82` →
`0.82^60 ≈ 6.3e-6` per second, applied `v *= Math.pow(6.3e-6, dt)`. Put the exponentiation in
`tuning.js` as a precomputed constant, not in the hot loop.

These 3D numbers are a **starting point, not gospel** — expose every one in lil-gui and expect the
user to retune by feel. Feel parity with the 2D game matters more than arithmetic parity.

**FSM transitions, ported faithfully from `updateEntity` (prototype L4281–4360):**

- `grounded` + W pressed (edge, not held) → `takeoff`. Matches 2D `jumpPressed && e.onGround`.
- `takeoff`: 12 fixed steps of forced climb at 3.5 px/f → **4.8 m/s**, gravity off, cape flare. Then → `flying`.
- `flying`:
  - W held and below climb cap → apply up thrust
  - S held → apply down thrust
  - neither → **hover**: damp vertical velocity toward 0, snap to 0 below 0.11 m/s. Gravity stays
    off. This "holds altitude when you let go" behaviour is what makes the 2D flight feel good and
    it must survive the port.
  - Shift → horizontal surge to `FLIGHT_DASH_SPEED`, **altitude preserved** (no gravity)
  - punch/laser/freeze held → multiply thrust and caps by `FLIGHT_FINE_MULT` for precise aiming
    (Phase 1 has no abilities, but wire the `fine` input flag now so Phase 3 slots in)
- `flying` + G pressed (edge) → `landing`; controlled descent at `FLIGHT_DOWN_THRUST × 0.9`,
  vertical clamp `+5 px/f → 6.8 m/s`.
- `landing` + W held → abort back to `flying`. (2D: `if (e.landing && input.jumpHeld) e.landing = false`)
- `landing` or `flying` + ground contact → `grounded`.

**Movement basis.** 2D is 1-axis. In 3D, WASD is **camera-relative**: project the camera's forward
onto the XZ plane, normalize, and build the basis from that. Hero yaw slerps toward the movement
direction at ~12 rad/s. When flying, the hero additionally pitches: `pitch = clamp(-vy / 8, -0.6,
1.5)` rad — the 2D game leans the body toward horizontal at speed (`baseFlat = 1.50` rad ≈ 86°,
prototype L5295), so cap forward pitch at 1.5 rad to reproduce the Superman-horizontal pose.

### `src/controllers/CameraRig.js`
Spring-arm ("boom") third-person rig. Full math in `RESEARCH_FINDINGS.md` §A9.

- Pivot at hero position + `(0, 1.5, 0)`.
- Desired camera position: pivot + spherical offset from `(yaw, pitch, distance)`.
- Mouse look drives `yaw` (unbounded) and `pitch` (clamped `[-0.5, 1.2]` rad).
- **Critically damped smoothing**, not naive lerp, so it is framerate-independent:

  ```
  // exponential smoothing, equivalent to the 2D camera's 0.1 lerp at 60fps
  const t = 1 - Math.exp(-lambda * dt);   // lambda ≈ 6.3 for parity with 0.1/frame
  current.lerp(desired, t);
  ```

  The 2D camera used `camera.x += (dx - camera.x) * 0.1` per frame (prototype L5179). The
  framerate-independent equivalent is `lambda = -60 * ln(1 - 0.1) ≈ 6.32`.

- **Collision-aware:** raycast pivot → desired position against building AABBs; if hit, pull the
  camera to `hitDistance - 0.2`. Recover to full distance with the same exponential smoothing.
- **Ground/flight blend:** two parameter sets, cross-faded on a 0.6 s timer.

  | | distance | height offset | FOV |
  |---|---|---|---|
  | grounded | 6.0 m | 1.5 m | 60° |
  | flying | 9.0 m | 2.2 m | 70° |

  FOV widening on takeoff is the cheapest speed-sensation trick available; also add
  `+8°` scaled by `speed / FLIGHT_DASH_SPEED` while dashing.
- `near = 0.1`, `far = 2000`. Phase 1's block is 300 m so `far` is generous; Phase 2 revisits it
  alongside fog.

### `src/world/StreetBlock.js`
Hand-authored, data-driven from a local array so Phase 2 can generalize it:

```js
export const BLOCK = {
  buildings: [ { x, z, w, d, h, kind: 'lowrise'|'midrise'|'tower', color } , … ],
  palms:     [ { x, z, height } , … ],
  lamps:     [ { x, z } , … ],
};
```

Buildings: `BoxGeometry` with a per-face material array or a simple window-strip texture drawn to
a canvas at init (mirrors the 2D `drawWindowRow`). Use **`InstancedMesh` for palms and lamps** even
at this count — it establishes the pattern Phase 2 depends on and costs nothing.

Roads: a single large `PlaneGeometry` with an asphalt colour, plus thin box "curbs" and a dashed
centre line. Nothing fancy.

### `src/world/Sky.js`
Static midday. `Sky` from `three/addons/objects/Sky.js` **or** a hemisphere-tinted background
colour + `THREE.Fog`. Prefer the simpler fog version in Phase 1; the animated day/night cycle
(2D `DAY_CYCLE = 14400` frames ≈ 4 min, `dayPhase`, golden-hour overlay, sun+moon — prototype
L5141, L8184–8250) lands in Phase 2.

Lighting:
- `DirectionalLight` intensity 2.5, position `(80, 120, 60)`, `castShadow`
- shadow camera: orthographic `±60`, `near 1`, `far 400`, map `2048²`, `bias -0.0005`,
  `normalBias 0.02`
- `HemisphereLight(skyBlue, groundTan, 0.6)`
- `Fog(0xbfc9d4, 120, 900)` — LA haze tint, not neutral grey

### `src/ui/DebugHud.js`
`stats.js` panel. lil-gui folders: `Locomotion` (every tuning constant, live), `Camera`
(distance/height/FOV/lambda), `Debug` (toggle collision AABB wireframes, toggle
`renderer.info` readout). Plus a DOM text overlay showing: FSM state, position, velocity
magnitude, `onGround`, persona, `renderer.info.render.calls`, `renderer.info.render.triangles`.

QA needs this overlay to verify the acceptance criteria, so it is a **deliverable, not a nicety.**

---

## 6. Input mapping (Phase 1)

Preserved from the 2D prototype (`computeP1Input`, prototype L4516–4525, and the keydown handler
L3449+). Uses `event.code`.

| Key | Action | Phase 1? |
|---|---|---|
| `KeyW` / `KeyA` / `KeyS` / `KeyD` | move (camera-relative) | yes |
| `KeyW` tap on ground | **take off** | yes |
| `Space` | alias for W (jump/ascend) | yes |
| `KeyS` | descend while flying | yes |
| `KeyG` | toggle landing | yes |
| `ShiftLeft` / `ShiftRight` | dash / flight boost | yes |
| `KeyQ` | persona toggle super↔civilian | yes |
| Mouse move (pointer locked) | camera yaw/pitch | yes |
| Mouse wheel | camera distance | yes |
| `Escape` | release pointer lock | yes |
| `KeyJ` | punch | **stub** — logs, no effect |
| `KeyK` | laser | **stub** |
| `KeyL` | freeze | **stub** |
| `KeyZ` | block | **stub** |
| `KeyC` | dodge roll | **stub** |
| `F1` | toggle debug overlay | yes |

J/K/L/Z/C are wired into the input struct and set the `fine` flight flag, but perform no combat.
This is intentional: it proves the input plumbing without pulling combat into Phase 1.

---

## 7. Game loop shape

```js
// core/Game.js
start() {
  this._raf = requestAnimationFrame(this._tick);
}

_tick = (nowMs) => {
  this._raf = requestAnimationFrame(this._tick);

  const raw = (nowMs - this._lastMs) / 1000;
  this._lastMs = nowMs;
  this.accumulator += Math.min(raw, 0.25);      // clamp tab-out spikes

  let steps = 0;
  while (this.accumulator >= FIXED_DT && steps < MAX_STEPS) {
    this.fixedStep(FIXED_DT);
    this.accumulator -= FIXED_DT;
    steps++;
  }
  if (steps === MAX_STEPS) this.accumulator = 0;  // give up, don't spiral

  this.render(this.accumulator / FIXED_DT);       // alpha for interpolation
};
```

Fixed timestep is required, not optional: the ported tuning constants are per-frame-at-60 values,
and a variable step would make flight feel different on a 144 Hz monitor. It also makes the
locomotion FSM deterministic, which is what lets Phase 1 ship real unit tests.

---

## 8. Tests (Phase 1)

Vitest, `environment: 'node'` — these modules must not touch WebGL.

`tests/collision.test.js`
- capsule resting on ground reports `onGround === true`, y snapped to `height/2`
- capsule driven into a box's side is pushed out along X or Z, never through
- capsule in a corner between two boxes settles without jitter (two iterations converge)
- capsule above a rooftop lands on the roof, not the ground

`tests/locomotion.test.js`
- `grounded` + W edge → `takeoff`; after 12 steps → `flying`
- in `flying` with no vertical input, `vy → 0` within 30 steps and **stays** 0 for 60 more
  (this is the hover-hold guarantee)
- `flying` + G → `landing`; `landing` + W → back to `flying`
- flight dash preserves altitude: y unchanged (±0.01 m) across 60 steps of Shift+W-less dash
- gravity never applied while `flightActive`
- damping is framerate-independent: simulating 1 s as 60×(1/60) and as 120×(1/120) yields the
  same velocity within 1e-3

Manual smoke checklist lives in the acceptance criteria below.

---

## 9. Acceptance criteria

QA verifies each of these directly. Every one is observable.

**Build & run**
1. `npm install` completes on Node 20.20.2 with no `EBADENGINE` warnings.
2. `npm run dev` serves and the page renders the block with zero console errors and zero
   Three.js warnings.
3. `npm run build` succeeds; `npm run preview` runs the built bundle identically.
4. `npm test` passes; all tests in §8 present and green.

**Rendering**
5. Debug overlay reports **≥ 60 fps** sustained on the dev machine at 1920×1080.
6. `renderer.info.render.calls` is **< 60** on a static frame.
7. Shadows visible and stable — no shadow acne, no swimming when the hero moves.
8. Window resize does not distort aspect or blur; pixel ratio capped at 2.

**Ground movement**
9. WASD moves the hero relative to the camera; hero yaw turns to face travel direction smoothly.
10. Shift on the ground visibly increases speed; overlay speed rises toward ~13 m/s.
11. Hero cannot walk through any building; sliding along a wall is smooth, not sticky or jittery.
12. Hero cannot leave the 300 m playable extent.
13. Hero does not fall through the ground plane at any speed.

**Flight** (the phase's real test)
14. Tapping W on the ground triggers takeoff: hero rises with a visible burst, FSM shows
    `takeoff` → `flying`, camera pulls back and FOV widens.
15. Holding W climbs, capped ~7.5 m/s; holding S descends, capped ~6.1 m/s.
16. **Releasing both W and S holds altitude** — y drifts < 0.05 m over 3 s. Gravity must not
    reassert while flying.
17. Shift while flying surges forward at ~20.5 m/s **without losing altitude**.
18. G begins a controlled descent; hero lands and FSM returns to `grounded`.
19. Pressing W during descent aborts landing and returns to `flying`.
20. Hero can fly up past the tallest tower (90 m) and land on its roof.
21. Holding J, K, or L while flying visibly slows vertical movement (the `fine` multiplier), even
    though no ability fires.

**Camera**
22. Mouse look orbits smoothly under pointer lock; pitch clamps without snapping.
23. Camera never penetrates a building — walking the hero against a wall with the camera behind it
    pulls the boom in, and it recovers smoothly on stepping away.
24. Ground↔flight camera transition is a visible cross-fade over ~0.6 s, not a cut.
25. Camera motion is smooth at both 60 Hz and (if available) 144 Hz — no framerate-dependent lag.

**Persona**
26. Q instantly swaps hero appearance super↔civilian with no hitch or mesh rebuild.

**Hygiene**
27. Alt-tabbing away mid-flight and back does not leave a stuck key or produce a physics spike.
28. No memory growth: 5 min idle shows flat `renderer.info.memory.geometries` and `.textures`.

---

## 10. Explicitly out of scope for Phase 1

Combat, enemies, hit FX, HP; dialogue and portraits; quest state machines; the quest selector;
interiors and scene transitions; companions (Hound / Lois / Power Girl); chunk streaming; LOD;
day/night cycle; post-processing; audio; glTF character models; skeletal animation; cloth-sim cape;
minimap; save/load; the IP renames (Phase 2 gate — see `IMPLEMENTATION_PLAN.md`).

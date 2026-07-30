# Phase 1 — Hero Locomotion Vertical Slice

A 3D open-world prototype: one hero who can walk and fly on a single hand-authored
~300 × 300 m LA street block, viewed through a spring-arm third-person camera,
driven by a fixed-timestep game loop.

This is **Phase 1 of 8**. It ships locomotion and nothing else. There is no
combat, no dialogue, no quests, no streaming, no interiors and no audio — those
are later phases, and adding any of them here is out of scope.

The 2D reference implementation at the repository root
(`kodaman_prototype.html`) is read-only design reference. It is never imported,
never edited, and nothing here depends on it at runtime.

---

## Requirements

| Tool | Version used |
|---|---|
| Node | 20.20.2 (Vite 7 needs `^20.19.0 \|\| >=22.12.0`) |
| npm | 10.8.2 |

## Install, run, build, test

```bash
cd kodaman3d

npm install       # pinned dependency tree; must produce zero EBADENGINE warnings
npm run dev       # dev server on http://localhost:5173
npm run build     # production bundle into dist/
npm run preview   # serve the built bundle on http://localhost:4173
npm test          # vitest, 60 unit tests, environment: 'node'
npm run test:watch
```

Dependencies are pinned exactly (no `^`, no `~`) so every machine and CI run
resolves an identical tree.

| Package | Version | Why |
|---|---|---|
| `three` | 0.185.1 | renderer, scene graph, math |
| `vite` | 7.3.6 | dev server + bundler |
| `vitest` | 4.1.10 | pure-logic unit tests, no WebGL/DOM |
| `lil-gui` | 0.21.0 | live tuning panel — a required deliverable, not a nicety |
| `stats.js` | 0.17.0 | frame-time HUD |

## Controls

Click the canvas to capture the mouse. `Escape` releases it.

| Input | Action |
|---|---|
| `W` `A` `S` `D` | move, relative to the camera, in all four FSM states |
| `W` / `Space` (tap or hold, on the ground) | take off |
| `W` / `Space` (held, in flight) | climb |
| `S` (held, in flight) | descend |
| `G` | begin a controlled landing; hold `W` to abort back to flight |
| `Shift` | raise the speed cap — dash on the ground, faster flight in the air |
| `Q` | toggle persona (super ↔ civilian), colours only |
| Mouse | camera yaw / pitch |
| Mouse wheel | camera distance |
| `F1` | toggle the debug overlay and stats panel |
| `J` `K` `L` | **stubs.** No ability fires. They set a precision-aiming flag that slows flight to 40% and log once per press |
| `Z` `C` | **stubs.** Wired and logged, no effect |

Key handling uses `event.code` (physical key position), so the bindings are
layout-independent.

## Project structure

```
kodaman3d/
├── index.html                       page shell + click-to-lock hint
├── vite.config.js                   Vite + Vitest config (one file, no plugins)
├── src/
│   ├── main.js                      entry: build the Game, init, start, HMR teardown
│   ├── core/
│   │   ├── Game.js                  owns every system; runs the fixed-timestep loop
│   │   ├── Renderer.js              WebGLRenderer, camera, resize handling
│   │   ├── Input.js                 keyboard edges + pointer-lock mouse look
│   │   ├── Time.js                  fixed-timestep accumulator, dt clamp, fps
│   │   ├── Scale.js                 units, PX_TO_M, and the yaw convention
│   │   └── dispose.js               shared recursive Object3D teardown
│   ├── entities/
│   │   └── Hero.js                  primitive hero mesh + CPU cape + persona swap
│   ├── controllers/
│   │   ├── LocomotionController.js  the grounded/takeoff/flying/landing FSM
│   │   └── CameraRig.js             spring-arm camera, obstruction, ground/flight blend
│   ├── world/
│   │   ├── StreetBlock.js           the one authored block (data-driven)
│   │   ├── Collision.js             static AABBs + capsule resolution (pure logic)
│   │   └── Sky.js                   static midday lighting, fog, background
│   ├── ui/
│   │   └── DebugHud.js              stats.js + lil-gui + DOM readout
│   └── config/
│       └── tuning.js                every movement/camera constant, one source of truth
└── tests/
    ├── locomotion.test.js           FSM, hover, dash, framerate independence
    └── collision.test.js            ground, push-out, corners, boundary
```

## Things worth knowing before you change anything

**Read `src/config/tuning.js` first.** Every movement and camera number lives
there and is bound live to the lil-gui panel. Read `TUNING.X` at call time —
destructuring its values into module scope silently breaks live tuning.

**Hover damping is a half-life, not a `factor^60` conversion.** The 2D game's
`FLIGHT_HOVER_DAMPING = 0.18` must *not* be converted the way `GROUND_FRICTION`
and `AIR_FRICTION` are: `0.18^60 ≈ 2.1e-45` leaves no usable tuning range at all.
Vertical hover damping uses `v *= 0.5 ** (dt / hoverDampingHalfLife)` plus a hard
snap to zero below 0.11 m/s. There is a unit test that fails if someone
"simplifies" this back. See the long comment in `tuning.js`.

**Gravity is applied in exactly one place** — the `grounded` state when the hero
is off the ground. Never during takeoff, flight or landing. A test proves it by
setting `GRAVITY` to 100000 and showing flight is unaffected.

**The camera updates after locomotion, inside the same fixed step.** Moving it
anywhere else makes the whole game feel laggy.

**The hero's controller is hand-rolled and stays that way permanently.** No
physics engine, not now and not when Rapier arrives in Phase 3 for props and
enemies.

**Dispose what you allocate.** Three.js does not free GPU memory when an object
leaves the scene graph, and disposing a material does not dispose its textures.
`src/core/dispose.js` is the one utility for this; every module that allocates
exposes a `dispose()`.

**Coordinates:** Y-up, metres, right-handed. Yaw `0` faces `-Z`; positive yaw is
counter-clockwise seen from above. `src/core/Scale.js` holds the only
implementation of that convention — use its helpers rather than re-deriving
sin/cos signs.

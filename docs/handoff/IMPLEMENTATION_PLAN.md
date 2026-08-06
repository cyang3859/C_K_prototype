# Implementation Plan — `kodaman3d`

**Status:** ready for Phase 1 to begin under `ENGINEER_BRIEF.md`. Phases 2–8 are planned to file-list
depth but not yet spec'd to the line-by-line precision of `PHASE_1_SPEC.md` — each phase gets its own
`PHASE_N_SPEC.md` (Review or Engineer stage) once the prior phase ships.

**Relationship to other docs:** this plan does not rewrite or contradict `PHASE_1_SPEC.md` — Phase 1
below is a summary with a pointer. Rulings from `REVIEW_FLAGS.md` (renderer, world scale, trademark
gating) are load-bearing inputs here and are not re-argued, only applied.

**Ground rules carried from `PIPELINE_STATE.md` (do not relitigate):** Three.js + Vite, new build in
`kodaman3d/`, `kodaman_prototype.html` never edited, LA = recognizable landmarks + invented streets
(no OSM), feature branch + PR against `dev` only, trademark renames apply to `kodaman3d/` only and
require explicit user sign-off before any content is authored under new names.

---

## Phase overview

| # | Name | One-line goal | Playable proof |
|---|---|---|---|
| 1 | Hero Locomotion Vertical Slice | Walk + fly on one LA street block, third-person camera, working fixed-timestep loop | Explore one block on foot and in flight |
| 2 | World Geography & Streaming | Chunk-streaming architecture + a ~2,048×2,048 m hand-authored two-district world with day/night | Fly the full built world, no combat/quests |
| 3 | Combat & Physics | Rapier physics for props/enemies/vehicles; J/K/L abilities go live; enemy FSM + HP | Fight and defeat enemies in the open world |
| 4 | Dialogue & Quest Engine + Level 1 Content | Data-driven quest/dialogue engine, decoupled from rendering; Level 1 fully ported | Complete the Level 1 quest end-to-end with dialogue |
| 5 | Characters, Companions & Animation | glTF skeletal characters (Quaternius+Mixamo), real cape physics, first companion | Hero and a companion NPC traverse together, animated |
| 6 | Level 2 & Level 3 Content Port | Remaining companions, quest arcs, interiors, second world district | Full 3-level game is content-complete |
| 7 | Polish & Systems | Post-processing, audio, minimap, save/load, asset compression | Game looks/sounds/saves like a finished product |
| 8 | Release Readiness | Cross-browser QA, full trademark sweep, PR against `dev` | Branch is mergeable and demonstrably shippable |

Complexity estimates use solo-dev-with-AI-agent pacing per `RESEARCH_FINDINGS.md` §D1 (agent
accelerates boilerplate/systems code; a human remains the bottleneck on feel-tuning, art direction,
and playtesting — estimates assume that bottleneck, not raw coding throughput).

---

## Phase 1 — Hero Locomotion Vertical Slice *(summary only — see `PHASE_1_SPEC.md` for the real spec)*

**Goal:** prove the core loop — camera-relative WASD movement, a walk/fly FSM with hover-hold, a
spring-arm third-person camera, one hand-authored 300×300 m street block, zero combat/quest/content.

**Deliverables:** `kodaman3d/` scaffold (Vite + Three.js 0.185.1), `Game.js` fixed-timestep loop,
`LocomotionController.js` (grounded/takeoff/flying/landing FSM), `CameraRig.js` (spring-arm,
critically-damped), `Hero.js` (primitive-built), `StreetBlock.js` (data-driven), `Collision.js`
(capsule vs static AABBs), `DebugHud.js`, Vitest unit tests for collision/locomotion.

**Acceptance criteria:** the 28 items in `PHASE_1_SPEC.md` §9 — build/run, rendering budget, ground
movement, flight (the phase's real test), camera, persona, hygiene.

**Renderer decision (resolved, see `REVIEW_FLAGS.md` F1):** `WebGLRenderer`, project-wide, not just
Phase 1.

**Dependencies:** none (first phase).
**Complexity:** already spec'd; Engineer-ready.

---

## Phase 2 — World Geography & Streaming

**Goal:** replace the single hand-authored block with the full built world geography for this plan —
a hand-authored, chunk-streamed, two-district world at the reconciled **2,048 × 2,048 m** scale
(`REVIEW_FLAGS.md` F3), with day/night lighting. No quests, no combat, no named characters — this
phase is purely geography + streaming tech + atmosphere, so it carries zero trademark exposure and
is not gated by the rename sign-off.

**Why geography-first, before combat/quests:** every later phase (3–6) places content *into* a world
that must already exist and stream correctly. Building the world once here, then layering content in
later phases, avoids re-authoring geography per phase.

**Deliverables:**
- `src/world/ChunkManager.js` — flat registry of chunk `Group`s (per §A1: 2–3 levels of hierarchy
  max), velocity-predictive load/unload radii (expand in travel direction, shrink behind), hysteresis
  between load and unload rings so chunks don't thrash at the boundary.
- `src/world/Chunk.js` — owns its own geometry/material references, exposes `dispose()` that walks
  its subtree and frees geometry/material/texture (the shared recursive-dispose utility named in
  `RESEARCH_FINDINGS.md` §A12 — write it once here, reuse everywhere after).
- `src/world/District.js` × 2 — data-driven district definitions (buildings, streets, palms, lamps,
  signage) for the two chosen hero districts (see Open Questions — which two districts is a
  user-weighted creative call, not purely technical).
- `src/world/LOD.js` — `THREE.LOD` wrapper implementing the three tiers from §A2 (0–40 m full detail,
  40–150 m simplified, 150 m+ impostor).
- `src/world/Instancing.js` — `InstancedMesh` for repeated single-geometry props (palms, lamps,
  parked-car variants), `BatchedMesh` for the building "kit of parts" (facade/roof/trim variants) per
  §A3.
- `src/world/DayNightCycle.js` — ports the 2D game's `DAY_CYCLE`/`dayPhase` state machine
  (`kodaman_prototype.html` L5141, L8184–8250) onto 3D light objects: animates `DirectionalLight`
  position (sin/cos arc), color (warm horizon → white noon → cool moonlight), intensity; interpolates
  sky/fog color alongside it; thresholds street-light/window-emissive materials near dusk/dawn.
- `src/world/CSM.js` — wraps `three/addons/csm/CSM.js` (WebGL-only, per F1's renderer ruling this is
  safe), 4 frustum splits, `CSMHelper` wired into the debug HUD.
- `src/world/Sky.js` upgrade — replaces Phase 1's static fog constants with the day/night-driven
  values; **near/far planes move to something in the `near 0.3–0.5 / far 8,000–12,000` range as the
  world grows (per `REVIEW_FLAGS.md` F11 — near must scale with far, do not leave `near = 0.1` from
  Phase 1)**.
- `src/core/FloatingOrigin.js` — camera-relative rendering / floating-origin insurance (per §9.2/§9.4
  — cheap even at 2,048 m, protects against future growth to 4,096/6,144 m and against skinned-mesh
  degradation once Phase 5 adds real character rigs).
- `tests/chunkStreaming.test.js` — load/unload radius math, hysteresis behavior, dispose-on-unload
  leaves zero resident geometries (pure logic, no WebGL, per D2 tier 1).

**Acceptance criteria (QA-verifiable):**
1. Flying from one district to the other crosses the connective-tissue terrain with no visible pop-in
   at conversational flight speed (~20 m/s).
2. `renderer.info.render.calls` stays under budget (target: under 150, since two dense districts is a
   step up from Phase 1's single block) at any fixed viewpoint.
3. `renderer.info.memory.geometries`/`.textures` are flat after 5 minutes of flying a loop between
   districts and back (chunk dispose is leak-free).
4. Day/night cycle completes a full loop and sun position/color/fog visibly track it; CSM cascades
   visible via `CSMHelper` and shadows do not degrade at the far cascade split.
5. Hero can fly to the world's edge (±1,024 m) without falling through geometry or hitting a hard
   wall — edge behavior is a soft boundary or an atmospheric fade, not a collision wall (open
   question below).
6. Unit tests for chunk load/unload/hysteresis pass.

**Dependencies:** Phase 1 (`LocomotionController`, `CameraRig`, `Hero` all carry forward unchanged;
`Collision.js` generalizes from 12 static boxes to per-chunk box sets).
**Complexity:** Large. This is the single biggest engineering lift in the plan outside Phase 1 itself
— streaming, LOD, instancing, and day/night are each nontrivial systems, done together.
**Trademark status:** not gated — no named characters or locations from the protected-marks list are
introduced here (district *names* used internally should already be the invented/approved
placeholders, decided as part of this phase's own scoping, not the DC-adjacent names).

---

## Phase 3 — Combat & Physics

**Goal:** bring Rapier online for dynamic props/enemies/vehicles (per `RESEARCH_FINDINGS.md` §A7's
recommendation — hero locomotion stays hand-rolled, unchanged from Phase 1/2), wire the J/K/L/Z/C
input stubs from Phase 1 into real abilities, add an enemy FSM with HP and hit reactions.

**Deliverables:**
- `src/physics/PhysicsWorld.js` — `@dimforge/rapier3d-compat`, lazy `import()` so Phase 1/2 bundle
  size is unaffected (per §A7's explicit mitigation for the ~700–850 KB gzipped cost), one-time
  `await RAPIER.init()` gate before physics-dependent systems start.
- `src/entities/Enemy.js` + `src/controllers/EnemyAI.js` — FSM per enemy archetype (`brute`,
  `genius`, `energy`, `warlord`, `robber` — generic type-strings already cleared as non-trademarked
  in `RESEARCH_FINDINGS.md` §C4), Rapier-backed dynamic bodies for knockback/ragdoll-adjacent
  reactions.
- `src/combat/Abilities.js` — punch (melee), laser (raycast/projectile), freeze (status effect) —
  the three previously-stubbed abilities, each keyed off the existing `fine`-flag-aware input struct
  from Phase 1.
- `src/combat/HealthSystem.js` — HP pools, hit FX hookup (particle/flash, not full VFX polish —
  that's Phase 7), pure-logic damage resolution (unit-testable, no WebGL).
- `src/entities/Projectile.js` — pooled (not allocate-per-shot, per §D4's immediate-mode-porting
  warning) projectile objects for laser/thrown-object abilities.
- `src/physics/VehicleController.js` — Rapier's `RayCastVehicleController` per the official
  `physics_rapier_vehicle_controller` example (§A7) — scaffolding only in this phase; a full
  drivable companion vehicle is Phase 6 content.
- `tests/combat.test.js`, `tests/enemyAI.test.js` — FSM transitions, damage math, pure logic.

**Acceptance criteria:**
1. `npm run dev` shows zero console errors with Rapier's WASM loaded; `await RAPIER.init()` gates
   correctly (no race where physics-dependent code runs before init resolves).
2. Punch/laser/freeze each produce a visible, distinct effect on an enemy and register damage.
3. At least one enemy archetype's FSM (idle → aggro → attack → stagger/death) is fully wired and
   testable.
4. Hero capsule (still hand-rolled, per §A7's "keep the hero's own controller hand-rolled even after
   Rapier lands") is unaffected by Rapier's presence — no behavior regression versus Phase 2's
   locomotion.
5. Thrown/dropped objects exhibit real momentum/restitution via Rapier, not scripted motion.
6. Bundle-size check: Phase 1/2-only entry paths do not pull in the Rapier WASM (verify via build
   output — lazy import boundary holds).

**Dependencies:** Phase 2 (world + streaming must exist for enemies to be placed in it); Phase 1
(hero controller, input struct with `fine` flag already wired).
**Complexity:** Large. Physics engine integration plus three new ability implementations plus an
enemy AI FSM is a lot of new surface area, though each piece individually is well-precedented (§A7
cites official Three.js/Rapier examples to build from directly).
**Trademark status:** not gated — generic enemy archetypes only, no named villains yet (Lex Luthor
analog and others land in Phase 6 content).

---

## Phase 4 — Dialogue & Quest Engine + Level 1 Content

**Goal:** the single most architecturally important phase for the 2D→3D content port. Build a
rendering-agnostic quest/dialogue engine and prove it by porting Level 1 end-to-end — this is also
the phase where the trademark rename sign-off first has teeth (see Porting Strategy below).

**Deliverables:**
- `src/quest/QuestEngine.js` — pure-logic state machine interpreter (no `document`/`window`/WebGL
  access — Vitest `environment: 'node'`, per §D2 tier 1). Reads a declarative quest definition (see
  Porting Strategy) and exposes `{ currentState, availableTransitions, advance(triggerId) }`.
- `src/dialogue/DialogueEngine.js` — same pattern for dialogue trees: pure-logic node-graph walker,
  `{ currentNode, choices, choose(choiceId) }`.
- `src/data/quests/level1.json` — Level 1's `questPhase` state machine, ported to the declarative
  schema, **authored under approved (post-rename) names from the start**.
- `src/data/dialogue/level1.json` — Level 1's dialogue trees, same rule.
- `src/ui/DialogueUI.js` — presentation layer: subscribes to `DialogueEngine` state, renders
  speaker/text/choice UI (DOM overlay, not in-3D-world text, for legibility) with portraits.
- `src/ui/QuestSelector.js` — ports the existing title-screen Level 1 quest selector (already present
  in the 2D game per recent commit history) into the 3D shell.
- `src/world/QuestMarkers.js` — 3D-world quest-giver/objective markers (billboarded icons), a thin
  presentation layer over `QuestEngine` state, no game logic of its own.
- `tests/questEngine.test.js`, `tests/dialogueEngine.test.js` — state-machine correctness, pure logic,
  the ideal unit-test target per §D2.

**Acceptance criteria:**
1. Level 1's quest can be started, progressed through every state, and completed, driven entirely by
   `level1.json` — no quest logic hardcoded in rendering code.
2. Dialogue trees display correctly with speaker/portrait/choices; choices affect subsequent quest
   state.
3. `QuestEngine`/`DialogueEngine` unit tests pass with zero WebGL/DOM dependency.
4. Every name appearing in `level1.json`/dialogue content is a name from the **approved** rename
   mapping table — grep confirms zero occurrences of any protected mark from
   `RESEARCH_FINDINGS.md` §C4's table anywhere under `kodaman3d/src` or `kodaman3d/public`.
5. Quest selector on the title screen launches directly into the ported Level 1 flow.

**Dependencies:** Phase 3 (combat must exist if Level 1's quest involves any fights — verify against
the actual 2D Level 1 content); Phase 2 (world must exist to place quest givers/objectives in).
**Complexity:** Large — this is a new engine, not a port of rendering code, and the data-modeling
work (converting imperative `if/else` quest logic into a declarative schema) is genuine design work,
not mechanical translation.
**Trademark status: GATED.** Per `REVIEW_FLAGS.md` F4, this is the first phase where content
authoring happens — the mapping table in `RESEARCH_FINDINGS.md` §C4 must be user-approved (or
amended) before any `level1.json` content is written. See Porting Strategy and Open Questions.

---

## Phase 5 — Characters, Companions & Animation

**Goal:** replace primitive-built characters with real glTF skeletal characters and animation, upgrade
the cape from CPU sine-wobble to bone-chain physics, introduce the first companion NPC.

**Deliverables:**
- `src/assets/characters/` — Quaternius CC0 Universal Base Characters (Mixamo-rig-compatible) as the
  base humanoid mesh, per `RESEARCH_FINDINGS.md` §C3's staged recommendation.
- `src/pipeline/` (build-time, not runtime) — Mixamo → Blender/`gltf-transform` normalization
  pipeline notes/scripts (T-pose bake, scale-to-1, bone-name mapping) per §A10's documented gotchas;
  output committed as normalized `.glb` under `public/models/`.
- `src/entities/Hero.js` rewrite — swaps primitive `Group` for `GLTFLoader`-loaded skinned mesh +
  `AnimationMixer`; persona swap (Q) becomes a material/skin swap on the same rig, not a mesh rebuild
  (preserves Phase 1's "instant, no hitch" acceptance criterion).
- `src/animation/BlendSpace.js` — 1D blend spaces per §A10: grounded idle/walk/run on speed, flying
  idle-hover/forward-fly on speed plus a bank-angle additive layer; takeoff/landing as short
  crossfades gated by the same FSM transition that already drives collision-mode switching (§A8).
- `src/entities/Cape.js` — upgrades from Phase 1's CPU sine-wobble to bone-chain + Verlet (§C2 option
  1: ~6–12 joints, gravity + hero-velocity + wind-vector driven, 1–2 constraint-relaxation
  iterations/frame). Explicitly **not** full particle-grid cloth (§C2 rules this out as
  complexity-to-payoff-inappropriate for a solo project).
- `src/entities/Companion.js` — first companion NPC (name per the approved mapping table), its own
  lightweight locomotion (follow-the-hero behavior, not full player-parity FSM) and its own
  `AnimationMixer`.
- `tests/blendSpace.test.js` — weight math for blend spaces is pure logic, testable.

**Acceptance criteria:**
1. Hero renders as a rigged, animated character; idle/walk/run/hover/fly animations blend smoothly
   with no visible popping at blend-space boundaries.
2. Persona toggle (Q) remains instant and hitch-free with the new skinned-mesh pipeline (regression
   check against Phase 1's criterion 26).
3. Cape visibly reacts to hero velocity/turns (lag, settle, flap) — not a flat rigid plane, not a
   pure procedural wave with no gross trailing motion.
4. Companion NPC follows the hero through at least one district's terrain (streets + a flight
   segment) without getting stuck on geometry.
5. No skinned-mesh deformation artifacts at any point within the built ±1,024 m world extent
   (regression check against §9.2's flagged skinned-mesh large-coordinate degradation risk — the
   Phase 2 floating-origin work is what prevents this; confirm it actually does).
6. `renderer.info.memory.geometries`/`.textures` flat after repeated persona swaps and companion
   spawn/despawn cycles (leak check, per §A12).

**Dependencies:** Phase 2 (floating origin, world); Phase 4 optional but recommended first (having a
companion with dialogue hooks is more valuable once the dialogue engine exists — order is not a hard
technical dependency, only a value-sequencing one; see Open Questions).
**Complexity:** Large. Character pipeline setup (even with CC0 assets, no original art needed) plus
bone-chain cape physics plus a new animation blend-space system is substantial, though well-precedented
by §A10/§C2/§C3's cited tooling.
**Trademark status: content-bearing.** The companion's name, dialogue hooks, and any visual identity
choices must already reflect the approved mapping table (Phase 4's gate carries forward — this phase
doesn't re-open the sign-off question, it consumes the already-approved decision).

---

## Phase 6 — Level 2 & Level 3 Content Port

**Goal:** content-complete the 3-level game — remaining companions, the Level 2/3 quest arcs
(including the renamed Wonder-Woman-analog companion/villain arc, 61 occurrences in the source
material), interiors/scene transitions, and the second world district's remaining detail pass.

**Deliverables:**
- `src/data/quests/level2.json`, `level3.json` — same declarative schema as Phase 4's Level 1,
  authored entirely under approved names (no old-name intermediate state — see Porting Strategy).
- `src/data/dialogue/level2.json`, `level3.json`.
- `src/entities/Companion.js` instances for the remaining companions (renamed analogs of the
  reporter/ally-hero/warrior-companion roles) — reusing Phase 5's companion system, not rebuilding it.
- `src/world/Interior.js` + `src/world/SceneTransition.js` — interior spaces and scene-to-scene
  transitions (e.g., entering a building), which Phase 1–5 explicitly deferred.
- Second district's building/prop detail pass (Phase 2 built the geography; this phase adds the
  quest-specific dressing that geography needed content for).
- `src/entities/Boss.js` + boss-specific AI (the renamed Lex-Luthor-analog boss, 142 combined
  occurrences in source) — built on Phase 3's `Enemy.js`/`EnemyAI.js` base, not a separate system.

**Acceptance criteria:**
1. All three levels are completable start-to-finish through the ported quest/dialogue engine.
2. Every companion and villain in the shipped `kodaman3d/src` tree uses only approved names — a
   second grep sweep against the full `RESEARCH_FINDINGS.md` §C4 mark list returns zero hits (the
   first sweep was Phase 4's Level 1 only; this is the full-game sweep).
3. Interior/exterior scene transitions have no loading-screen-shaped hitch longer than [QA to set a
   number once Phase 2's chunk-load profiling data exists — open question, not guessable now].
4. Boss encounter is completable using Phase 3's combat system without new bespoke combat code paths
   (validates that Phase 3's system generalizes, rather than each boss needing one-off code).

**Dependencies:** Phase 4 (quest/dialogue engine), Phase 5 (companion system, animation), Phase 3
(combat/boss), Phase 2 (second district must exist geographically before this phase details it).
**Complexity:** XL. This is the largest single content-volume phase — three levels' worth of
quest/dialogue/companion work, even with the engine already built in Phase 4. Expect this to be the
longest phase in the plan by elapsed time, not by architectural novelty.
**Trademark status: content-bearing, same rule as Phase 4/5** — author under approved names only,
from the start.

---

## Phase 7 — Polish & Systems

**Goal:** the systems Phase 1 explicitly deferred wholesale: post-processing, audio, minimap,
save/load, and an asset-compression pass now that there's enough content to make compression worth
doing.

**Deliverables:**
- `src/postprocessing/Composer.js` — `EffectComposer` with `GTAOPass` (preferred over `SSAOPass` per
  §A6's quality note), `SMAAPass` (preferred over FXAA per §A6), `UnrealBloomPass` at half-resolution
  by default (§A6's documented 75% cost-cut with no visible loss on typical screens). Composer chain
  runs at 0.75× device resolution by default per §A6's single biggest cost lever, with a lil-gui
  toggle back to native res.
- `src/audio/AudioManager.js` — positional audio (Three.js `PositionalAudio` or a lightweight Howler
  wrapper — decide at implementation time), ambient city bed, ability/combat SFX, music state machine.
- `src/ui/Minimap.js` — top-down or radar-style minimap driven by the same world/chunk data Phase 2
  built, no separate world representation to maintain.
- `src/save/SaveSystem.js` — serializes quest state (from `QuestEngine`), hero position/persona,
  companion states to `localStorage` (or IndexedDB if payload size demands it — decide at
  implementation time); load path reconstructs game state from the same data `QuestEngine` already
  treats as its source of truth (no parallel save-specific state to keep in sync).
- Asset compression pass: Draco on large static environment geometry, KTX2/Basis (ETC1S for
  diffuse/albedo, UASTC for normal maps) on all textures, via `gltf-transform` per §A11's documented
  pipeline. Applied retroactively to Phase 2/5/6 assets, not authored compressed from the start (compression
  tooling is easiest to apply once, in bulk, at the end).
- Perf pass: `renderer.shadowMap.autoUpdate = false` with manual `needsUpdate` triggers on static
  geometry (per §A4), draw-call audit against the by-then-larger world.

**Acceptance criteria:**
1. Post-processing chain runs at 60 fps sustained on the dev machine with all passes enabled; toggling
   any individual pass off in lil-gui measurably changes frame time (proves each pass is actually
   costing what's expected, not silently disabled).
2. Save → reload reconstructs quest progress, hero state, and companion state exactly (a scripted
   round-trip test, not just "doesn't crash").
3. Total asset payload (gzipped) after compression is measured and reported; Draco/KTX2 application
   verified via `gltf-transform inspect` showing the expected extensions present.
4. Minimap accurately reflects hero position/heading against the actual world geometry (spot-checked
   at both district centers and the connective-tissue midpoint).
5. Audio does not leak `AudioContext` nodes across scene transitions (a leak-check parallel to §A12's
   geometry/texture leak check, same methodology, different resource type).

**Dependencies:** Phase 6 (there needs to be a content-complete game to save/polish/compress).
**Complexity:** Medium-Large. Individually well-precedented systems (§A6/§A11 both cite concrete,
low-risk tooling), but there are five of them bundled into one phase, and integration/regression risk
across a now-large codebase is real.
**Trademark status:** not gated — no new named content, only systems work.

---

## Phase 8 — Release Readiness

**Goal:** cross-browser QA, a final trademark sweep, and the actual PR against `dev`.

**Deliverables:**
- Cross-browser smoke pass (Chrome, Firefox, Safari — all four majors now ship WebGL2/desktop per
  §A13, no WebGPU dependency per F1's ruling so this is lower-risk than it would otherwise be).
- Final full-repo grep sweep against every mark in `RESEARCH_FINDINGS.md` §C4's table, across
  `kodaman3d/` in its entirety (source, `public/`, comments, `.glb`/`.gltf` embedded strings if any) —
  the definitive check that R3's per-occurrence classification concern (`REVIEW_FLAGS.md`) is fully
  closed for the shipped build.
- Accessibility/hygiene pass: keyboard-only navigability of any UI (dialogue, quest selector, save
  menu), alt-tab/focus-loss robustness (extends Phase 1's criterion 27 to the now-much-larger input
  surface), colorblind-safe HUD contrast check.
- `npm run build && npm run preview` full smoke test on the final bundle.
- PR against `origin/dev` with a summary of all 8 phases, QA sign-off attached.

**Acceptance criteria:**
1. Zero occurrences of any protected mark from the §C4 table anywhere in the final `kodaman3d/`
   tree (source, assets, comments) — grep-verifiable, binary pass/fail.
2. Game is playable start-to-finish on each of the three major desktop browsers with no
   browser-specific console errors.
3. `npm run build` produces a bundle `npm run preview` serves identically to `npm run dev`.
4. PR is open against `dev`, not `main`, per locked decision #4.

**Dependencies:** Phase 7 (polish must be in place before a release-readiness pass is meaningful).
**Complexity:** Medium. Mostly verification and cross-cutting sweeps, not new feature work — but
cross-browser bugs are notoriously unpredictable in scope until found.
**Trademark status:** this phase's entire purpose includes closing out the trademark question
definitively before any PR is opened.

---

## Full target directory structure for `kodaman3d/`

```
kodaman3d/
├── index.html
├── package.json
├── vite.config.js
├── .gitignore
├── public/
│   ├── models/                  # normalized .glb (Phase 5+), Draco/KTX2-compressed (Phase 7)
│   ├── textures/
│   └── audio/                   # Phase 7
├── src/
│   ├── main.js
│   ├── core/
│   │   ├── Game.js
│   │   ├── Renderer.js
│   │   ├── Input.js
│   │   ├── Time.js
│   │   ├── Scale.js
│   │   └── FloatingOrigin.js    # Phase 2
│   ├── entities/
│   │   ├── Hero.js
│   │   ├── Cape.js              # Phase 5 (upgrades Phase 1's inline sine-wobble)
│   │   ├── Companion.js         # Phase 5
│   │   ├── Enemy.js             # Phase 3
│   │   ├── Boss.js              # Phase 6
│   │   └── Projectile.js        # Phase 3
│   ├── controllers/
│   │   ├── LocomotionController.js
│   │   ├── CameraRig.js
│   │   └── EnemyAI.js           # Phase 3
│   ├── animation/
│   │   └── BlendSpace.js        # Phase 5
│   ├── physics/
│   │   ├── PhysicsWorld.js      # Phase 3, lazy-imported
│   │   └── VehicleController.js # Phase 3/6
│   ├── combat/
│   │   ├── Abilities.js         # Phase 3
│   │   └── HealthSystem.js      # Phase 3
│   ├── world/
│   │   ├── StreetBlock.js       # Phase 1 (superseded in role by District.js in Phase 2, kept for tests)
│   │   ├── Collision.js
│   │   ├── Sky.js
│   │   ├── ChunkManager.js      # Phase 2
│   │   ├── Chunk.js             # Phase 2
│   │   ├── District.js          # Phase 2
│   │   ├── LOD.js               # Phase 2
│   │   ├── Instancing.js        # Phase 2
│   │   ├── DayNightCycle.js     # Phase 2
│   │   ├── CSM.js               # Phase 2
│   │   ├── QuestMarkers.js      # Phase 4
│   │   ├── Interior.js          # Phase 6
│   │   └── SceneTransition.js   # Phase 6
│   ├── quest/
│   │   └── QuestEngine.js       # Phase 4
│   ├── dialogue/
│   │   └── DialogueEngine.js    # Phase 4
│   ├── data/
│   │   ├── quests/
│   │   │   ├── level1.json      # Phase 4
│   │   │   ├── level2.json      # Phase 6
│   │   │   └── level3.json      # Phase 6
│   │   └── dialogue/
│   │       ├── level1.json      # Phase 4
│   │       ├── level2.json      # Phase 6
│   │       └── level3.json      # Phase 6
│   ├── postprocessing/
│   │   └── Composer.js          # Phase 7
│   ├── audio/
│   │   └── AudioManager.js      # Phase 7
│   ├── save/
│   │   └── SaveSystem.js        # Phase 7
│   ├── ui/
│   │   ├── DebugHud.js
│   │   ├── DialogueUI.js        # Phase 4
│   │   ├── QuestSelector.js     # Phase 4
│   │   └── Minimap.js           # Phase 7
│   └── config/
│       └── tuning.js
├── pipeline/                    # build-time asset tooling, not shipped runtime code
│   └── mixamo-normalize/        # Phase 5 — Mixamo→glTF normalization scripts
└── tests/
    ├── collision.test.js
    ├── locomotion.test.js
    ├── chunkStreaming.test.js   # Phase 2
    ├── combat.test.js           # Phase 3
    ├── enemyAI.test.js          # Phase 3
    ├── questEngine.test.js      # Phase 4
    ├── dialogueEngine.test.js   # Phase 4
    └── blendSpace.test.js       # Phase 5
```

---

## Porting strategy: quest/dialogue state machines → data-driven modules

The 2D game's `questPhase` / `l2QuestPhase` / `l3QuestPhase` variables are imperative state held
directly in game logic, with transitions triggered by inline `if`/`else` checks scattered across
update functions, and dialogue trees similarly embedded as inline object literals referenced by
scene code. This is exactly the pattern that makes a rename expensive (`RESEARCH_FINDINGS.md` §C4:
"a rename touches character logic, dialogue trees, and quest-state variable names... not just
display strings") and the pattern that must **not** be carried into `kodaman3d`.

**Target shape, built in Phase 4 and reused unchanged in Phase 6:**

1. **Quest definitions are pure JSON** (`src/data/quests/levelN.json`): a set of named states, each
   with the transitions available from it (trigger id → target state, optional guard condition
   referencing world/hero flags), and side-effect hooks (spawn an objective marker, unlock a
   companion, flip a world flag) expressed as data (`{ "effect": "spawnMarker", "args": {...} }`),
   not inline function calls. This mirrors the general FSM shape `RESEARCH_FINDINGS.md` §A8 already
   validates as correct for this project ("the 2D FSM's shape is correct... only new work is
   collision-mode swapping and input unification" — the same validation applies to quest FSMs: the
   *shape* survives the port, only the *representation* changes from imperative to declarative).
2. **`QuestEngine.js` is a pure interpreter**, no rendering/DOM/WebGL access, that loads one of these
   JSON files and exposes `advance(triggerId)` / `currentState` / `availableTransitions`. This is
   directly unit-testable per `RESEARCH_FINDINGS.md` §D2 tier 1 ("state machines specifically are
   cited as an ideal unit-test target").
3. **Dialogue trees are pure JSON node graphs** (`src/data/dialogue/levelN.json`): each node has
   speaker, text, portrait reference, and choices (each choice pointing to a next node id and,
   optionally, a quest-engine trigger id to fire). `DialogueEngine.js` is the same kind of pure
   interpreter as `QuestEngine.js`.
4. **Presentation is a separate, thin layer** (`DialogueUI.js`, `QuestMarkers.js`, `QuestSelector.js`)
   that only reads engine state and renders it — it contains no game logic, so it can be redesigned
   or reskinned without touching quest/dialogue correctness, and it's exactly the layer that stays
   *outside* the Vitest-node-environment unit tests (per §D2, anything touching `document`/WebGL
   moves to the Playwright/headless-browser tier, not node-environment unit tests).
5. **The rename is not a separate pass — it is how the JSON gets written the first time.** Because
   Phase 4/6 are authoring `levelN.json` from scratch (extracting logic out of the 2D prototype's
   imperative code, not literally copying its strings), whoever writes that JSON simply uses the
   approved replacement names from `RESEARCH_FINDINGS.md` §C4's mapping table as they go. This is the
   concrete mechanism behind `PIPELINE_STATE.md`'s framing: "rename cost is paid once, during Phase
   2+ porting, when that code is being rewritten anyway." There is no intermediate state where
   `kodaman3d`'s JSON contains an old name that later gets find-replaced — the gate (`REVIEW_FLAGS.md`
   F4) exists precisely to prevent that intermediate state from ever being written.

**What is explicitly not ported as-is:** the imperative `if (e.questPhase === 'wayne_interior')`-style
branching itself. Only the *behavior* it encodes (what state comes next, under what trigger, with
what side effects) gets extracted into the JSON schema above. The state *names* in the new JSON should
be renamed to match the approved character/location names from the start (e.g., a state historically
named `'wayne_interior'` becomes whatever the new informant-character's location state is called),
not kept as internal-only identifiers with only player-visible text renamed — per `RESEARCH_FINDINGS.md`
§C4's own risk table, code identifiers carry real (if lower-direct) exposure in a public repo, and
there is no cost saving to preserving them once the state machine is being rewritten as data anyway.

---

## Where trademark rename work lands

- **Policy:** already locked (`PIPELINE_STATE.md` decisions #5–#6) — rename applies to `kodaman3d/`
  only, agents propose, user approves, no agent renames unilaterally. Not revisited here.
- **The mapping table exists** (`RESEARCH_FINDINGS.md` §C4, ~11 marks, 900+ occurrences in the
  source 2D file) but is **PENDING USER SIGN-OFF** — the table itself, not just the policy, needs
  explicit approval or amendment.
- **Gate placement (per `REVIEW_FLAGS.md` F4):** Phases 1–3 introduce zero named content from the
  protected-marks list (Phase 1 is hero+block only; Phase 2 is geography; Phase 3 is generic enemy
  archetypes only) and are **not blocked** by the pending sign-off. **Phase 4 is the first gated
  phase** — `level1.json`/dialogue content authoring cannot begin until the mapping table is
  approved, because Phase 4 is exactly where old-named content would otherwise get written into the
  new codebase. Phases 5 and 6 inherit Phase 4's already-resolved decision; they do not re-open it.
- **Verification, not just intent:** Phase 4's acceptance criteria and Phase 6/8's full-sweep grep
  checks (see those phases above) are the mechanism that confirms the gate actually held, not just
  that it was declared.

---

## Open questions / needs user decision

1. **Trademark mapping table approval** (`RESEARCH_FINDINGS.md` §C4). Blocks Phase 4 content
   authoring. This is the single highest-priority open item in the whole plan — everything else can
   proceed without the user, this cannot.
2. **Which two districts for the Phase 2 world** (`REVIEW_FLAGS.md` F3 reconciled the *size*
   — 2,048×2,048 m — but not the *choice*). `RESEARCH_LA_WORLDBUILDING.md` §9.5 lists eight candidate
   districts; this plan needs exactly two for the built target, chosen for what best serves the
   quest content Phases 4/6 will place there. Recommend the user weigh in given they know the
   intended Level 1/2/3 story beats better than any research document does; a placeholder default
   (Historic Core/Broadway + Hollywood Blvd corridor, both flagged in §9.5 as near-1:1-viable and
   high-landmark-density) is reasonable if no preference exists.
3. **Vite 7.3.6 vs 8.1.5.** Flagged as open in `PHASE_1_SPEC.md` itself — both satisfy the Node
   engine requirement; Vite 7 is the conservative pin already chosen. No action needed unless the
   user prefers latest; a one-line `package.json` change either way.
4. **WebGPU migration timing** (`REVIEW_FLAGS.md` F1). This plan commits to WebGL for all 8 phases.
   If the user wants a WebGPU migration considered at some point, the natural window is after Phase
   8, as an explicit follow-on project once TSL/`CSMShadowNode` are further along — not scheduled
   within this plan. Flagging so the user knows this was a deliberate exclusion, not an oversight.
5. **World edge behavior** (Phase 2 acceptance criterion 5). Should flying to the ±1,024 m world
   boundary be a hard collision wall (like Phase 1's 300 m hard-clamp), a soft atmospheric fade-to-
   haze that discourages but doesn't prevent going further, or an actual boundary-triggered scene
   transition (e.g., "you've left the mapped area")? This is a design/feel decision, not a technical
   one — flagged for the user or for human playtesting judgment per §D1's own point that feel
   decisions are exactly where the human stays the bottleneck.
6. **Phase 4 vs Phase 5 ordering** is listed sequentially above but their hard dependencies only run
   one direction (Phase 5's companion system benefits from Phase 4's dialogue hooks existing, but Phase
   5's character/animation pipeline work has no technical dependency on Phase 4). If schedule pressure
   makes sense to parallelize or reorder these two, that's a legitimate call — flagged so it isn't
   mistaken for a hard technical constraint.
7. **Save data storage: `localStorage` vs IndexedDB** (Phase 7). Deferred to implementation time in
   that phase's own spec once actual save-payload size is known; not blocking anything upstream.
8. **NEEDS RESEARCH items R1–R3 from `REVIEW_FLAGS.md`** (LA haze/visibility numbers, LA block
   dimensions, full trademark occurrence classification) should each be scheduled as a small
   dedicated research task before the phase that needs them (Phase 2 for R1/R2, Phase 4 for R3) —
   not before Phase 1, and not required to unblock this plan's approval.

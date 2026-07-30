# Research Findings — Three.js Architecture, DC-Inspired Character Design, Practical Constraints

**Status:** complete. All researched subsections (A1–A13, C1–C4, D1–D4) are filled in below with
sources. No gaps remain as of this revision.

**Scope note:** This document does **not** cover LA urban morphology, world scale, or float32
precision limits — that is `RESEARCH_LA_WORLDBUILDING.md` (Section B), written concurrently by a
separate agent. Reference it for those topics rather than looking here.

**Why this file exists in this state:** the coordinating session is operating near a token/session
limit. A prior research agent in this pipeline died mid-task and lost unpersisted work. This file
prioritizes being real and on disk — with honest gaps — over being complete but unwritten.

---

## Section A — Three.js open-world architecture

### A1 — Scene graph organization for a large streaming world

Structure the world as a flat registry of chunk `Object3D`/`Group` nodes directly under (or one
level under) `scene`, not a deep tree — every extra parent level adds a matrix-multiply per frame
per object when `updateMatrixWorld()` walks the graph, so keep hierarchy depth shallow (chunk →
static-mesh-batch/InstancedMesh, 2–3 levels max) rather than nesting per-building-per-part groups.
Each chunk should own its own geometry/material references and expose a single `dispose()` that
also disposes the InstancedMesh/BatchedMesh buffers it created, since Three.js does not
garbage-collect GPU resources automatically — undisposed geometries/textures leak VRAM across
load/unload cycles.

For chunk sizing, game-industry practice (Unreal World Partition-style guidance) treats 256 m as
the standard starting cell size, with a viable range of ~128–256 m depending on character speed
and scene density, and up to ~500 m for sparser small open worlds — too small and you get
frequent-load hitching, too large and memory/streaming-IO overhead grows. Because this hero can
**fly**, plan streaming triggers on a velocity-predictive radius, not pure static distance: expand
the load radius in the direction of travel and shrink/unload aggressively behind the player.
Frustum-only triggers are insufficient alone since a flying player can reverse direction quickly;
combine a distance ring (unload) with a slightly larger prefetch ring (load) plus hysteresis so
chunks don't thrash at the boundary.

The dominant hitch cause on chunk load isn't triangle count, it's **shader/program compilation**
the first time a new material/light combination is seen. Mitigate by keeping a warm pool of
geometry/material objects reused across unload/reload cycles instead of re-instantiating, and by
pre-warming materials for a chunk's asset kit before the player gets close.

*This is forward-looking architecture guidance for Phase 2+; Phase 1 is a single static 300×300 m
block with no streaming.*

**Sources:** https://mjurczyk.github.io/three.js/docs/manual/en/introduction/How-to-dispose-of-objects.html · https://discourse.threejs.org/t/dispose-things-correctly-in-three-js/6534 · https://medium.com/@sarah.hyperdense/world-partition-explained-open-worlds-for-small-teams-d10e81e6bf95 · https://salivity.github.io/game-development/article/level-streaming-triggers-for-open-world-games · https://salivity.github.io/game-development/article/seamless-scene-streaming-in-open-world-games

### A2 — LOD strategies, frustum culling, occlusion culling

`THREE.LOD` is a small container object: `addLevel(object, distance, hysteresis)` registers a
child to show at ≥ `distance` units from camera, `hysteresis` (fraction of distance, default 0)
prevents flicker at the boundary, and `update(camera)` runs automatically every frame via
`autoUpdate` unless disabled for manual control. It's a CPU-side visibility swap only — it does
not merge draws or reduce triangle counts on the GPU beyond what's authored into each level, and
all levels are resident in memory simultaneously (only one renders), so it costs VRAM, not just
compute. R3F's `<Detailed>` (a THREE.LOD wrapper) uses `distances={[0, 50, 100]}` as a concrete
3-tier example; LOD adoption is reported to yield 30–40% framerate gains in large scenes. For a
dense LA street-block scale, a reasonable extrapolation (no city-specific Three.js benchmark
exists) is: **tier 0 full detail 0–40 m** (facade/trim/signage, thousands of tris/building),
**tier 1 simplified 40–150 m** (merged/decimated mass, no small props, hundreds of tris), **tier 2
impostor/billboard 150 m+** (flat card or heavily decimated block, <100 tris) — treat this as a
profiling starting point, not a cited hard number.

Frustum culling is automatic per-`Object3D` (bounding-sphere test) and on by default, but not
free: it needs an up-to-date `boundingSphere` and scales with total object count in the graph, not
visible count. **There is no built-in occlusion culling in Three.js** — maintainer donmccurdy
confirms directly ("three does frustum culling – not occlusion culling unfortunately"). A real
scene profiled at 775,707 vertices / ~4,200 draw calls ran 13 ms/frame on a GTX 1080 Ti but
50–66 ms/frame on integrated graphics, with the fix being draw-call/instancing reduction, not
occlusion. For a street-grid city where buildings are natural occluders: (1) coarse manual
portal/cell culling — hide whole blocks behind the current one using precomputed visibility sets,
cheap for a grid; (2) `three-mesh-bvh` (gkjohnson) for BVH-accelerated raycasts usable as a
heuristic "can I see this block" sampler (benchmarked at 500 rays against an 80,000-poly model at
60 fps), not true GPU occlusion; (3) hardware occlusion queries are not exposed by Three.js's
WebGL2 renderer core — DIY WebGL2 extension work if pursued.

**Sources:** https://threejs.org/docs/pages/LOD.html · https://www.utsubo.com/blog/threejs-best-practices-100-tips · https://discourse.threejs.org/t/is-computing-bounding-sphere-bounding-box-necessary-if-i-dont-need-ray-casting/21846 · https://discourse.threejs.org/t/performance-issues-occlusion-culling/63511 · https://github.com/gkjohnson/three-mesh-bvh

### A3 — InstancedMesh / BatchedMesh for repeated geometry

`THREE.InstancedMesh(geometry, material, count)` renders `count` copies of one geometry+material
in a single draw call via the `instanceMatrix` attribute; `count` is **fixed at construction** —
resizing means building a new InstancedMesh. Per-instance transforms use
`setMatrixAt(index, matrix4)` + `instanceMatrix.needsUpdate = true`; per-instance color uses
`setColorAt(index, color)`. It cannot vary geometry or material per instance, so it's the right
tool for one repeated asset — one palm-tree model, one streetlight, one parked-car variant.

`THREE.BatchedMesh` (landed pre-r159, still evolving through r184/r185) solves "many different
geometries, one material": `addGeometry()` registers a variant, `addInstance(geometryId)` places
it, all drawn via multi-draw in effectively one call; instances/geometries can be added/removed
dynamically. This is the fit for a building "kit of parts" — dozens of facade/roof/trim variants
sharing one material. **Caveat: still maturing at r185** — r184 fixed `getColorAt` and wireframe
bugs, r185 fixed a `dispose()` declaration bug, and an open issue (#32741) notes deleting all
geometries + `optimize()` can leave buffer bookkeeping wrong ("Reserved space request exceeds the
maximum buffer size") — budget QA time for this. Rule of thumb: single geometry → InstancedMesh;
2–4 variants → a few parallel InstancedMeshes; many variants → BatchedMesh. A documented win: a
real-estate demo cut draw calls from 9,000 to 300 via instancing.

Instancing stops paying off at low counts (a few dozen unique, non-repeating assets are cheaper as
plain Meshes), when each instance needs a unique texture/material (defeats the shared-material
constraint), or when instances need independent per-instance physics bodies (CPU-side sync
dominates regardless of draw-call savings).

For crowds: Three.js has **no native GPU-instanced skeletal skinning** — `SkinnedMesh` instancing
is a known gap. Standard workaround (GPU Gems 3 ch.2, "Animated Crowd Rendering"): bake all
animation frames' bone matrices into a data texture sampled per-vertex, moving pose lookup into
the vertex shader. Naive per-mesh `SkinnedMesh` crowds reportedly drop below 60 fps past ~20
avatars without this. Third-party `InstancedMesh2` (agargaro) adds culling, BVH raycasting,
sorting, and skinning on top of core InstancedMesh — worth evaluating before hand-rolling.

**Sources:** https://threejs.org/docs/#api/en/objects/InstancedMesh · https://threejs.org/docs/pages/BatchedMesh.html · https://discourse.threejs.org/t/how-to-choose-between-instancedmesh-and-batchedmesh/81221/3 · https://github.com/mrdoob/three.js/issues/32741 · https://discourse.threejs.org/t/instancedmesh-animations-like-with-skinnedmesh/12388 · https://developer.nvidia.com/gpugems/gpugems3/part-i-geometry/chapter-2-animated-crowd-rendering · https://github.com/agargaro/instanced-mesh

### A4 — Realistic draw-call and triangle budgets for 60 fps

Recurring 2025–2026 figures converge on: **under ~100 draw calls/frame** as the safe target for
broad compatibility (integrated-GPU laptops included), desktop discrete GPUs tolerating 500+
before dropping frames, mobile GPUs struggling past ~100. Triangle count is secondary to draw-call
count — a practical whole-scene ceiling of **~500,000 triangles** for broad compatibility,
**50,000–100,000** for a hero/focal object, **500–5,000 per environment prop**. This matches the
A2 example: 775,707 vertices / ~4,200 draw calls ran 13 ms/frame (≈77 fps headroom) on a GTX 1080
Ti but 50–66 ms/frame (15–20 fps) on integrated graphics — draw-call count, not vertex count, was
the dominant cost per Three.js contributor donmccurdy.

Shadows multiply the budget directly: each shadow-casting light re-renders shadow-casting geometry
into a depth pass. `DirectionalLight`/`SpotLight` shadows cost one extra pass
(`meshCount × 1`); `PointLight` shadows cost **six** extra passes (one per cube face,
`meshCount × 6`). A worked example: 5 meshes + 2 shadow-casting point lights → 65 draw calls from
lighting alone. Practical guidance: one primary shadow-casting light (a directional "sun"),
shadow map resolution 1024–2048 px desktop / 512–1024 px mobile (4096 only for hero close-ups),
3–4 cascades for CSM on a large outdoor scene, `renderer.shadowMap.autoUpdate = false` with manual
`needsUpdate` triggers so static geometry doesn't re-render its shadow pass every frame. KTX2/Basis
texture compression is reported to cut VRAM ~10x versus uncompressed; Draco cuts geometry transfer
90–95% — both relevant for keeping a multi-chunk city within integrated-GPU VRAM (typically 2–4 GB
shared on 2026 mid-range laptops).

**Sources:** https://www.utsubo.com/blog/threejs-best-practices-100-tips · https://discourse.threejs.org/t/performance-issues-occlusion-culling/63511 · https://gist.github.com/iErcann/2a9dfa51ed9fc44854375796c8c24d92

### A5 — Lighting a large outdoor scene

`DirectionalLight` is the standard sun for a city block — one orthographic shadow camera, the
cheapest shadow-casting light type, and physically correct for an effectively-infinitely-distant
parallel light source. Three.js ships an **official CSM (Cascaded Shadow Maps) addon** at
`three/addons/csm/CSM.js`, maintained in the mrdoob/three.js repo itself (based on StrandedKitty's
`three-csm`). It's **explicitly WebGLRenderer-only** — WebGPURenderer needs the separate
`CSMShadowNode` (relevant to the A13 renderer-choice discrepancy flagged in Open Questions).
Default configuration creates 4 frustum splits, each with its own directional light and shadow map
size, giving high resolution near the camera and progressively lower resolution into the distance,
plus a `CSMHelper` for visual debugging. Usage requires calling an update method on every material
that should receive CSM shading, plus a per-frame frustum-split update call — real integration work
beyond a plain DirectionalLight, but it directly solves "one shadow map stretched over a whole city
block looks blurry up close or needs an enormous texture."

Shadow map type is a straightforward quality/cost dial: `BasicShadowMap` (hard edges, cheapest) →
`PCFShadowMap` (moderate) → `PCFSoftShadowMap` (smoothest, most expensive — already the Phase 1
choice per `PHASE_1_SPEC.md` §5). PCSS-style variable-penumbra soft shadows are explicitly called
out as unsuitable for most mobile GPUs; a `PCFSoftShadowMapFast` variant exists for low-power
hardware. Given this project's desktop-only 2026 target, standard `PCFSoftShadowMap` is reasonable,
but CSM cascade resolution should still be tuned per-cascade (higher res only on the nearest 1–2
splits) rather than uniformly high everywhere.

**Baked vs. realtime, and the day/night tension:** baked lightmaps/AO are the standard way to make
static geometry look good cheaply, but baked *directional* lighting is fundamentally incompatible
with a moving sun. The resolved pattern from Unity's own community threads on this exact problem:
either (a) bake only indirect/AO contribution and keep the direct sun light realtime, (b) bake
multiple lightmap sets for different times of day and cross-fade them, or (c) go fully realtime.
**Recommended split for this project:** bake static ambient occlusion only (lighting-direction-
independent, e.g. an offline AO pass in Blender) applied as a multiply on buildings/street
materials, combined with a fully realtime DirectionalLight+CSM sun animated through the day/night
cycle. This avoids re-baking anything when the cycle changes while keeping AO contact-shadow detail.

**Driving the cycle:** animate the sun `DirectionalLight`'s position (circular arc via sin/cos of
cycle-progress angle), `color` (warm orange/red near horizon → white at noon → cool blue-tinted
moonlight at night), and `intensity` (peak at noon, near-zero at night, ambient/hemisphere picking
up the slack after dark) — consistent across every source found. Scene background/sky color and
`THREE.Fog` color should interpolate alongside it. Street lights and window-emissive materials
should threshold-toggle (or emissive-intensity-lerp) near dusk/dawn rather than animate
continuously — a straight port of the 2D game's existing golden-hour-overlay/sun+moon-swap state
machine onto 3D light objects instead of 2D canvas overlays.

**Sources:** https://threejs.org/docs/pages/CSM.html · https://github.com/StrandedKitty/three-csm · https://github.com/mrdoob/three.js/blob/dev/examples/webgl_shadowmap_csm.html · https://dev.to/outriding/mastering-shadows-in-threejs-setup-configuration-and-optimization-39nn · https://github.com/mrdoob/three.js/issues/15577 · https://github.com/mrdoob/three.js/pull/15591/files · https://discourse.threejs.org/t/complete-sky-system-for-three-js-skybox-sun-moon-day-night-cycle-clouds-stars-lensflares/88311 · https://discussions.unity.com/t/realistic-day-cycle-real-time-day-to-baked-lights-at-night/677684

### A6 — Post-processing (`EffectComposer`)

The r185 `three/addons/postprocessing/` inventory includes `UnrealBloomPass`, `SSAOPass`, `SAOPass`
(older alternative AO), `GTAOPass`, `FXAAPass`, `SMAAPass`, `OutlinePass`, `OutputPass`,
`TAARenderPass`, `SSAARenderPass`, `SSRPass`, and more. SSAOPass and GTAOPass coexist (neither is
deprecated), but the docs explicitly state **GTAOPass gives better quality than SSAOPass but is
more expensive** — GTAO (Ground Truth AO) is the newer, more physically-based technique and the
better default given this project's desktop-2026 headroom. `ACESFilmicToneMapping` (already the
Phase 1 renderer setting) is applied during the existing final color-conversion step, not a
composer pass, so it carries negligible extra cost.

**Bloom cost:** no formal published ms-benchmark exists, but concrete guidance does: `UnrealBloomPass`
defaults to full canvas resolution, which is unnecessarily expensive — constructing it at half
resolution (`Vector2(width/2, height/2)`) "looks identical on a 6-inch screen" while cutting GPU
cost by roughly 75%. Bloom is one of the most commonly reported "why did my FPS tank" passes on the
Three.js forum. Treat it as a reduced-resolution pass by default, not full-res; on constrained
hardware, disable it and fake the look via emissive materials instead.

**AA passes:** no Three.js-specific ms numbers were found, but general graphics benchmarks put both
in the same cheap tier — **FXAA ≈ 2–7% of frame time, SMAA ≈ 3–8%**, nearly identical cost, with
SMAA consistently rated higher quality (edge/shape-aware blending vs. FXAA's blur-prone full-image
smoothing). **Prefer SMAAPass over FXAAPass** given the near-identical cost. Note `SSAOPass` needs a
correctly-wired `NormalPass` to look right in a composer chain — a known source of setup bugs.

**Vignette/color grading:** no dedicated first-party pass by that name; typically a small custom
`ShaderPass`, or `LUTPass` (present in r185) for 3D-LUT color grading — cheap, single texture
sample per pixel, standard in production pipelines.

**The single biggest cost lever, consistently across every source:** composer render-target
resolution. Most passes (bloom, SSAO/GTAO, AA) scale roughly linearly or worse with pixel count.
Running the whole `EffectComposer` chain at 0.75× or 0.5× device resolution and letting the final
`OutputPass`/canvas upscale is a standard, low-risk way to buy back frame budget without removing
effects outright — cheaper and less visually disruptive than dropping individual passes first.

**Sources:** https://threejs.org/docs/#examples/en/postprocessing/EffectComposer · https://threejs.org/docs/pages/GTAOPass.html · https://threejs.org/docs/pages/SSAOPass.html · https://threejs.org/docs/pages/UnrealBloomPass.html · https://digitalstrategyforce.com/journal/how-do-you-optimize-threejs-performance-for-mobile-devices/ · https://discourse.threejs.org/t/unreal-bloom-optimize/35476 · https://9meters.com/technology/graphics/smaa-vs-fxaa-a-guide-to-anti-aliasing-techniques · https://discourse.threejs.org/t/ssao-used-with-effectcomposer-how-to-enable-normalpass/62423

### A7 — Physics: rapier.js vs. cannon-es vs. hand-rolled kinematic controller

This is the section `PHASE_1_SPEC.md` §2 ("Why no physics engine in Phase 1") cites by name for
its decision to ship a hand-rolled ~150-line kinematic capsule controller in Phase 1 and defer
Rapier to Phase 3. **That decision is supported by direct evidence below, not overturned.**

**rapier.js** — Rust compiled to WASM, distributed as `@dimforge/rapier3d` (raw WASM, needs
bundler WASM support) or `@dimforge/rapier3d-compat` (WASM base64-embedded in the JS bundle,
async-init, works with any bundler). Verified directly against the npm registry
(`rapier3d-compat@0.19.3`): the raw `.wasm` binary is **1.57 MB uncompressed / ~585 KB gzipped**;
the compat `rapier.mjs` (JS + embedded WASM) is **2.24 MB uncompressed / ~836 KB gzipped** — the
real download cost is **~600–850 KB gzipped**, transferred once and cacheable. Init is a one-time
`await RAPIER.init()` before constructing a `World` — a real but small architectural seam (a
loading gate before the game loop starts). A GitHub issue (dimforge/rapier.js#49) confirms Vite's
default bundling **breaks on raw `.wasm` imports** from `rapier3d`; the documented fix is to use
`rapier3d-compat`, which "works as expected" with no extra Vite plugin config — a known, solved
problem, not a live risk, **provided the compat package is used specifically.**

Rapier is not a hobby dependency: Three.js ships **first-party integration** — a `RapierPhysics`
addon (`three/addons/physics/RapierPhysics.js`) plus official examples including
`physics_rapier_vehicle_controller` (a working WASD-drive/space-brake car — directly applicable to
porting Lois's car) and `physics_rapier_instancing`. Rapier ships a purpose-built
`RayCastVehicleController`. npm shows releases as recent as **November 2025** — actively maintained.

Rapier's `KinematicCharacterController` does real work: `computeColliderMovement()` does
shape-cast-based sliding collision with configurable slope-climb/slide thresholds, autostep, and
snap-to-ground. But it is explicitly ground-relative (snap-to-ground, slope climbing, "up
direction" are all ground concepts), and **critically, it does not apply gravity for you at all** —
per Rapier's own docs, "it is up to you to emulate gravity by adding a downward component to the
movement vector" every frame regardless of whether the built-in controller is used. So even
Rapier's helper is a collision-sliding utility invoked with a manually-computed movement vector each
frame — not fundamentally different in spirit from a hand-rolled controller; the movement/gravity/
flight-state logic is owned by the game either way.

**cannon-es** — a TypeScript ESM fork of the abandoned original `cannon.js`, under the `pmndrs`
org. Checked directly against npm and GitHub (not just the "maintained fork" label): **latest npm
release is 0.20.0, published 2022-08-12** — no release in ~4 years as of mid-2026. GitHub API
confirms the last default-branch commit landed **2024-01-06** (a docs-build commit); 57 open
issues, not archived, but no substantive commit activity in 2+ years. No built-in character
controller, weaker narrow-phase collision than a Rust solver, positioned for simple dynamic-rigid-
body scenes rather than character/vehicle control. **No real argument for cannon-es over Rapier**
in this stack given Rapier's active releases, first-party Three.js integration, and comparable
(not dramatically smaller) bundle cost.

**Hand-rolled kinematic capsule** — for Phase 1's actual scope (one player capsule, one static
block, 12 building AABBs, no other dynamic actors), a ~150-line controller genuinely is less
integration complexity than Rapier, concretely: no async init boundary gating the game loop, no
WASM asset in the build (no 600–850 KB download for a feature set that's currently just "walk into
an AABB, get pushed out"), no physics-body↔Object3D transform sync step every frame, and full
simple control over the ground↔flight transition (which, per above, Rapier does not materially
simplify anyway since gravity/movement logic stays manual either way). Raycast-for-ground plus
closest-point-on-segment push-out against boxes is well-understood, corroborated by the fact that
even physics-engine-based character controllers are frequently *paired with* a manual downward
raycast for reliable ground detection because built-in ground checks are commonly unreliable in
practice — i.e., Phase 1 isn't skipping a hard problem, it's doing the same core technique a
physics-engine-based controller would still need.

What a hand-rolled capsule genuinely can't do, justifying deferral (not rejection) of Rapier:
**dynamic rigid body dynamics** for thrown/dropped/grabbed objects (momentum, restitution, torque,
resting-contact resolution — reimplementing a general impulse solver is weeks, not 150 lines);
**vehicle physics** for Lois's car (suspension, wheel friction/slip, chassis roll — Rapier ships a
purpose-built `RayCastVehicleController` and an official Three.js example doing exactly this,
making it near-drop-in); **enemy-vs-enemy/enemy-vs-world physical interactions** (mass-aware
knockback, potential ragdolls) — all genuinely many-dynamic-body problems where a real solver earns
its cost.

**Does the player capsule stay hand-rolled even after Rapier arrives in Phase 3? Yes — this is the
key nuance the plan should state explicitly.** Rapier's own character controller is a thin
shape-cast/sliding utility layered on manually-supplied movement vectors — it offers autostep/
slope-slide conveniences but not gravity, not fly-state logic, and is not fundamentally less code
to drive than the existing hand-rolled controller. The strongest pattern across official examples
and community projects is **Rapier-for-everything-except-the-player**, alongside a kinematic player
capsule that stays outside physics entirely or is represented as a kinematic (non-dynamic) body
purely so it can push/be-detected-by Rapier's dynamic props. **Add Rapier in Phase 3 as an
additional system for props/vehicles/enemies, not as a replacement for the hero's movement code** —
this avoids destabilizing a working, tuned controller (flight feel is bespoke, game-specific tuning
no general physics engine gets right out of the box) while still gaining Rapier's dynamics for
everything that actually needs them.

**Red flags found: none disqualifying.** The only real friction points are the ~700–850 KB gzipped
download (mitigate with lazy `import()` so Phase 1/2 players never pay for it until Phase 3 content
is reached), the async-init boundary (one-time, well-documented, not ongoing complexity), and raw
`rapier3d` breaking under plain Vite WASM handling (solved by using `-compat` specifically, not a
reason to avoid Rapier). No browser-support concerns for a desktop-2026 WebGL2 target — WASM is
universal in target browsers.

**Recommendation:** the existing Phase 1/Phase 3 plan is well-supported. Ship the hand-rolled
kinematic capsule in Phase 1 (justified: avoids an async WASM boundary and an ~800 KB dependency
for a problem that doesn't need a general solver, and even Rapier-based controllers commonly fall
back to manual ground-raycasting anyway). Introduce `@dimforge/rapier3d-compat` (not raw
`rapier3d`) in Phase 3, loaded via dynamic `import()` so it doesn't affect Phase 1/2 bundle size —
specifically for dynamic props, Lois's car (via Rapier's `RayCastVehicleController`), and enemy
physics. **Keep the hero's own movement/flight controller hand-rolled even after Rapier lands** —
loosely coupled to or outside the Rapier world — rather than migrating it onto Rapier's character
controller, since that migration carries real risk (destabilizing tuned flight feel) for no
capability gain Rapier's controller actually provides for a flying character.

**Sources:** https://www.npmjs.com/package/@dimforge/rapier3d-compat (registry data: sizes, versions, publish dates) · https://rapier.rs/docs/user_guides/javascript/getting_started_js/ · https://rapier.rs/javascript3d/classes/KinematicCharacterController.html · https://rapier.rs/docs/user_guides/javascript/character_controller/ · https://rapier.rs/docs/user_guides/javascript/rigid_body_gravity/ · https://github.com/dimforge/rapier.js/issues/49 · https://threejs.org/docs/pages/RapierPhysics.html · https://threejs.org/examples/physics_rapier_vehicle_controller.html · https://github.com/pmndrs/cannon-es (commit/issue data via GitHub API) · https://www.npmjs.com/package/cannon-es (publish-date data) · https://github.com/doppl3r/kinematic-character-controller-example · https://discourse.threejs.org/t/first-person-character-controller/91945

### A8 — Character controllers for an entity that both walks AND flies

State-machine (FSM) locomotion remains the dominant pattern for hybrid grounded/aerial controllers
in 2025–2026 shipping games and hobbyist frameworks; nothing has displaced it with a pure
physics-driven or ML-driven approach for player characters. The canonical shape — Grounded
(Idle/Walk/Run) → Takeoff → Flying (with a Hover sub-state) → Landing → back to Grounded — matches
general FSM game-dev guidance: a set of states connected by transitions, each gated by an input or
environmental event. This **validates** the 2D game's existing grounded/takeoff/flying/landing FSM
with hover-hold rather than complicating it — the state logic is dimension-agnostic; only the
motion integration per state changes across the port.

Collision response is what genuinely differs 2D→3D and ground→air. Grounded state should keep a
capsule collider swept against ground/wall geometry, gravity-snapped to ground normal, while
Flying state should drop ground snapping entirely and use full 3D freedom with only sparse
avoidance raycasts against buildings/terrain — two different collision *modes* driven by the same
FSM state, not one universal collider tuned for both. Takeoff/Landing are the natural place to
blend between modes.

Prior art specific to this stack: the open-source `three-player-controller` (three-mesh-bvh +
Rapier physics) explicitly supports movement, sprinting, jumping, flying, and camera-mode
switching, using BVH raycasting restricted to nearby geometry rather than full physics simulation
— a good efficiency reference for building-dense open-world flight. It also documents a real UX
seam worth avoiding: its flight mode used mouse-look for pitch/yaw while ground mode was
keyboard-only, requiring a later retrofit to unify input schemes — an argument for one shared
input-mapping layer across all FSM states from the start. No published GDC talk specifically on
Superman-style flight or Just Cause traversal was found (only forum/wiki-level discussion). City of
Heroes' community wiki does document flight design values worth carrying over: Fly is fast but
reduces maneuverability/combat responsiveness, Hover is slow but combat-capable and cancels
knockback, and attacking while in Fly temporarily demotes movement to Hover-speed — a
state-dependent property override, not a full mode switch, which maps directly onto a "Flying"
state with an internal combat-sub-state modifier (relevant once Phase 3 combat lands).

**Net takeaway:** the 2D FSM's shape is correct; the 3D port's main new work is (a) per-state
collision-mode swapping (capsule vs. sparse-raycast) and (b) unifying input mapping across states.

**Sources:** https://www.gamedevpills.com/p/finite-state-machines-creating-structure · https://blog.littlepolygon.com/posts/fsm/ · https://discourse.threejs.org/t/character-controller/89137 · https://github.com/hh-hang/three-player-controller · https://cityofheroes.fandom.com/wiki/Flight · https://homecoming.wiki/wiki/Travel_Powers · https://homecoming.wiki/wiki/Flight

### A9 — Third-person camera rigs

The spring-arm ("boom") camera remains the standard third-person pattern across Unreal, Unity, and
Godot in 2025–2026, and maps cleanly onto Three.js despite there being no native `SpringArm`
object — it must be hand-rolled from an Object3D pivot + raycast/spherecast. Pattern: a pivot
follows the target's position (with its own smoothing), a desired camera offset is computed in the
pivot's local space, and a collision check — ideally a **sphere-cast**, not a zero-radius raycast,
to account for the camera's near-plane volume — from pivot toward desired position clamps boom
length to the first hit, pulled in by ~0.2–0.5 units of padding to prevent near-plane clipping.
Godot's own docs explicitly recommend shape-casting over plain raycasting for this reason. Unreal's
camera guidance frames the same six reusable primitives regardless of engine: lag, collision,
offset, FOV, look-ahead, shake.

For the ground-to-flight transition specifically, no single canonical implementation was found,
but the composable pattern is: treat boom distance, height offset, and FOV as target values the
camera lerps toward per FSM state — Grounded gets a shorter boom/lower height/narrower FOV for
near-geometry readability, Flying gets a longer boom/higher offset/wider FOV for speed sensation
and downward visibility. This is a direct extension of state-dependent spring-arm parameterization
already established for sprint/aim/cover cameras elsewhere.

Smoothing should **not** use naive `lerp(current, target, k)` per frame — framerate-dependent (a
144 Hz player converges much faster than 60 Hz for the same `k`). The correct, widely-cited
formula is exponential/critically-damped smoothing: `t = 1 - exp(-lambda * dt)`, then
`current = lerp(current, target, t)`. Documented independently by Rory Driscoll's "Frame Rate
Independent Damping using Lerp," Freya Holmér's "Lerp Smoothing is Broken" (which shows converting
an old fixed-fraction lerp into an equivalent half-life value), and a Godot proposal thread
requesting it as a built-in. Typical lambda values cited: 3–10 for camera-follow smoothing; higher
= snappier. `PHASE_1_SPEC.md` §5 already derives `lambda ≈ 6.32` from the 2D game's `0.1`-per-frame
lerp via `lambda = -60 * ln(1 - 0.1)` — this is exactly the correct conversion per the sources
above, and needs no revision. Squirrel Eiserloh's 2016 GDC talk "Math for Game Programmers:
Juicing Your Cameras With Math" remains the standard broader reference (asymptotic smoothing,
shake, feathering, points of interest).

**Sources:** https://docs.godotengine.org/en/stable/tutorials/3d/spring_arm.html · https://supermatrix.studio/blog/camera-controller-and-spring-arm-3d-in-godot · https://www.unrealengine.com/en-US/tech-blog/six-ingredients-for-a-dynamic-third-person-camera · https://www.rorydriscoll.com/2016/03/07/frame-rate-independent-damping-using-lerp/ · https://x.com/FreyaHolmer/status/1757836988495847568 · https://github.com/godotengine/godot-proposals/discussions/9895 · http://www.mathforgameprogrammers.com/gdc2016/GDC2016_Eiserloh_Squirrel_JuicingYourCameras.pdf

### A10 — Animation: glTF skeletal pipeline, AnimationMixer, blend trees, Mixamo

Three.js's animation system centers on `AnimationMixer` (one per skinned model), `AnimationClip`
(keyframe tracks, typically one per glTF/Mixamo action), and `AnimationAction` (per-clip playback
handle with weight/timeScale/loop, via `mixer.clipAction(clip)`). Blending is weight-based:
`action.crossFadeTo(otherAction, durationSeconds, warp)` ramps weight between two actions over an
interval, optionally warping playback speed so foot-timing aligns; `fadeIn`/`fadeOut` do the
one-sided version. A manual walk/run blend is done by directly driving
`walkAction.setEffectiveWeight(w)` / `runAction.setEffectiveWeight(1-w)` per frame on speed — this
builds a simple 1D blend space (walk↔run↔fly-hover) without needing Unreal/Unity-style blend-tree
assets. For this game's dual-mode locomotion: one blend space per FSM cluster — Grounded gets an
idle/walk/run 1D blend on speed, Flying gets idle-hover/forward-fly blend on speed plus a
weight/additive layer for bank angle, Takeoff/Landing are short crossfades gated by the same
transition that drives collision-mode switching (A8).

Mixamo remains the default free humanoid-animation source and is **still operating as of mid-2026**
despite being long past active Adobe development — no discontinuation timeline given, no
subscription required, license explicitly covers personal/commercial/non-profit use for both
characters and animations, royalty-free. Community reports as recent as June 2025 describe
upload/download/login instability (preview animations still work), consistent with no meaningful
updates since acquisition — **recommendation: download and locally archive all needed Mixamo
assets early** rather than depend on live access mid-project.

Gotchas porting Mixamo → Three.js via GLTFLoader: (1) bone naming — Mixamo uses a
`mixamorig<BoneName>` prefix that must be mapped for retargeting onto a different skeleton, since
retargeting tools require matching bone names/hierarchy; (2) T-pose vs. A-pose — source and target
must share reference pose or limbs twist; export in clean T-pose/A-pose with clear limb separation;
(3) scale — Mixamo FBX export commonly introduces scale mismatch (a documented workaround chain is
FBX→Blender→BVH re-export at scale 0.01); bake scale to 1 on both character and rig; (4) a live
GLTFLoader issue thread notes bind-pose can come through incorrect for freshly-loaded armatures,
flagged by maintainers as something the loader should paper over. **Recommended pipeline:** export
FBX from Mixamo, convert once via Blender or `FBX2glTF`/`gltf-transform` into GLB with a normalized
T-pose skeleton, then load via `GLTFLoader` + `AnimationMixer` — do the retarget/normalization
offline once rather than at runtime.

**Sources:** https://threejs.org/docs/#api/en/animation/AnimationAction.crossFadeTo · https://discourse.threejs.org/t/smooth-fading-between-animation-clips/10189 · https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html · https://www.licenseorg.com/guide/3d-assets/mixamo · https://community.adobe.com/t5/mixamo-discussions/expired-licenses/td-p/15377434 · https://discourse.threejs.org/t/pose-3d-character-using-bone-orientation-data-from-motion-capture-normalise-retarget-preparation/56331 · https://github.com/mrdoob/three.js/issues/24772 · https://github.com/saori-eth/vrm-mixamo-retargeter

### A11 — Asset formats and compression

glTF 2.0 binary (`.glb`) is the settled Three.js interchange/runtime format in 2025–2026; no
competitor has displaced it. Two stackable compression layers apply: geometry (Draco) and texture
(KTX2/Basis Universal), plus a third geometry codec (meshopt) trading ratio for decode speed.

**Draco** (`DRACOLoader`) uses edge-breaker connectivity encoding (2–3 bits/triangle vs. 32 bits
raw) plus vertex quantization (down to 11–14 bits) and entropy coding, commonly yielding **90–95%**
geometry size reduction (a cited example: 50 MB → 2.5 MB, visually identical). Trade-off: requires
shipping/running a WASM decoder — for geometry under ~1 MB, decoder init cost can outweigh
savings, so apply Draco selectively to large meshes (city geometry), not small hero-character
meshes.

**KTX2/Basis Universal** (`KTX2Loader` + transcoder) solves texture VRAM, not just transfer size: a
2048×2048 RGBA PNG decodes to 16 MB in VRAM regardless of disk size, whereas KTX2 stays compressed
into GPU-native block-compressed formats (BC7/ETC/ASTC/RGTC) via transcoding, typically cutting
texture VRAM **4–8×**. Two encode modes: ETC1S (smaller/lower quality, good for diffuse/albedo) and
UASTC (larger/higher quality, recommended for normal maps). A measured example on the glTF
`FlightHelmet` sample dropped total package size 43.06 MB → 29.37 MB (32%) — a real but more modest
number than the VRAM-side figure, since on-disk transmission and in-VRAM footprint are different
metrics.

**Meshopt** (`MeshoptDecoder`, `EXT_meshopt_compression`) complements rather than replaces Draco:
"considerably faster than Draco decoding" per gltf-transform's own docs, and unlike Draco can also
compress morph targets and animation curves (Draco covers static geometry only) — but its raw
compression ratio is smaller, and it needs a secondary lossless pass (gzip/brotli) to realize its
full size benefit. **Practical guidance:** use `gltf-transform` (Don McCurdy's toolkit, the de
facto glTF optimization pipeline) to apply Draco to large static environment geometry, meshopt
where per-frame decode latency matters more than final size (streamed/LOD city chunks), and
KTX2/UASTC-or-ETC1S to all textures, targeting desktop WebGL2/2026 hardware where transcoder cost
is negligible.

**Sources:** https://medium.com/@adibzailan/the-95-solution-how-draco-compression-makes-the-impossible-possible-on-the-web-04b78be45a25 · https://gltf-transform.dev/modules/extensions/classes/KHRDracoMeshCompression · https://www.khronos.org/news/press/khronos-ktx-2-0-textures-enable-compact-visually-rich-gltf-3d-assets · https://deepwiki.com/KhronosGroup/glTF-Sample-Models/5.1-texture-compression-with-ktx2-and-basis-universal · https://gltf-transform.dev/modules/extensions/classes/EXTMeshoptCompression

### A12 — Memory management and disposal patterns

Three.js does **not** garbage-collect GPU resources when an object is removed from the scene graph
— `scene.remove(mesh)` only detaches it from the render graph; `BufferGeometry`, `Material`, and
any `Texture`s keep GPU buffers allocated until `.dispose()` is called explicitly on each. This is
among the most consistently reported Three.js footguns: disposing a material has no effect on
textures it references (a texture can be shared across materials) and must be freed independently.
Shader programs compiled for a `Material` are freed only once every material referencing that
program is disposed, so swapping many small-variant materials without disposal silently
accumulates compiled-program memory.

The most likely real-world leak pattern for this project — swapping glTF character/prop models at
runtime (persona swap, streaming building LODs) — is: load new GLB, add to scene, discard the
reference to the old `Object3D` without walking its subtree to dispose geometry/material/texture
on every mesh; the renderer's internal WebGL resource cache, not the JS object, holds the leaking
reference. A second source: `EffectComposer` allocates its own internal ping-pong render targets;
while `EffectComposer.dispose()` frees those, individual passes (e.g. `OutlinePass`) historically
lack their own `dispose()`, so a many-pass pipeline can leak render-target memory that survives a
composer-level dispose — a documented, still-open pain point (relevant to A6/Phase 7).

For detection: `renderer.info.memory.geometries`/`.textures` are the free, built-in counters —
logging them on scene/persona transitions is the cheapest leak smoke test (monotonic growth =
leak). Chrome DevTools' Memory tab (heap snapshots, before/after a transition) catches JS-side
reference leaks preventing GC of wrapper objects; Spector.js is the standard WebGL frame-capture
tool for GPU-resource-level diagnosis. Three.js has **no official built-in recursive-dispose
helper** in core as of r185 — the standard community pattern is a small `traverse()`-based utility
that disposes geometry + material(s) + their texture maps for every node in a removed subtree.
**This project should write that utility once, shared,** rather than re-implement it per system
(persona swap, building streaming, projectile pooling).

**Sources:** https://discourse.threejs.org/t/dispose-things-correctly-in-three-js/6534 · https://yannliao.github.io/threejs.miniprogram/docs/manual/en/introduction/How-to-dispose-of-objects.html · https://discourse.threejs.org/t/how-to-free-up-render-memory/21228 · https://github.com/mrdoob/three.js/issues/24710 · https://discourse.threejs.org/t/properly-disposing-of-three-effectcomposer/8415 · https://github.com/mrdoob/three.js/issues/10981

### A13 — WebGL2 vs. WebGPU readiness as of 2026; browser targets

WebGPU has reached broad browser support by mid-2026: Chromium-based browsers (Chrome, Edge, Opera,
Brave) since Chrome 113 (April 2023); Firefox shipped default-on from version 141 (Windows),
extended to Apple Silicon macOS in 145, Linux still flag-only, Android targeted "late 2026"; Safari
shipped default in Safari 26 (mid-2025) across macOS Tahoe/iOS 26/iPadOS 26/visionOS 26. For this
project's desktop-2026 audience, all four major desktop browsers now ship WebGPU without a flag.

Three.js's `WebGPURenderer` (`three/webgpu`) auto-detects support and transparently falls back to a
WebGL2 backend if unavailable (`forceWebGL: true` pins WebGL2 explicitly) — this fallback-by-default
design means adopting `WebGPURenderer` today doesn't require abandoning WebGL2 users. Community
sources describe it as "production-ready for most use cases" since roughly r171 (~Sept 2025), but
Three.js has not formally dropped "experimental" from all messaging, with maintainers signaling
full stable status "by end of 2026" — as of r185 (current), it sits in a late-beta/soft-production
state. TSL (Three.js Shading Language, `three/tsl`) compiles one node-based shader source to both
WGSL (WebGPU) and GLSL (WebGL2), making dual-backend targeting practical from one codebase; r185's
changelog shows continued active TSL feature work, indicating the API surface isn't fully frozen.

**Recommendation:** target `WebGPURenderer` + TSL materials from day one rather than classic
`WebGLRenderer`/`ShaderMaterial`, specifically because it auto-falls-back to WebGL2 — automatic
forward compatibility with zero downside for a 2026 desktop-only audience, avoiding a costly
renderer-swap migration later. Caution: avoid depending on the newest/least-battle-tested TSL node
features or compute-shader paths for anything on the critical path (core character rendering,
camera); stick to well-established node-material patterns (standard PBR via TSL, basic
post-processing) for load-bearing systems.

*Note: `PHASE_1_SPEC.md` specifies `WebGLRenderer` directly (§5, `src/core/Renderer.js`), not
`WebGPURenderer`. This is a live discrepancy between that already-committed spec and this finding
— flagged in Open Questions below, not resolved unilaterally here.*

**Sources:** https://web.dev/blog/webgpu-supported-major-browsers · https://threejs.org/docs/pages/WebGPURenderer.html · https://www.utsubo.com/blog/webgpu-threejs-migration-guide · https://altersquare.medium.com/three-js-vs-webgpu-in-2026-what-changed-for-large-scale-construction-viewers-79a7ed8b0b34 · https://threejs.org/docs/pages/TSL.html · https://github.com/mrdoob/three.js/releases/tag/r185

---

## Section C — DC-inspired character design

### C1 — Superhero design fundamentals

**Silhouette readability.** The industry-standard test is the "squint test": fill the character
solid black (or blur/darken) and check identifiability from outline alone, at multiple rotation
angles, not just front-on. This is rooted in a basic perceptual fact — brains recognize gross shape
far faster than surface detail — which is exactly the situation a 3D open-world game puts a
character in (distance, motion, silhouetted against sky). A useful supporting framework: "Silhouette,
Palette, Exaggeration" as the three fundamentals of clarity, with shape language mapped to
archetype (curves = friendly/safe, rectangles = strong/stable, triangles/sharp angles =
fast/dangerous). *Team Fortress 2* and *Overwatch* are the canonical examples of a cast where every
character has a genuinely unique outline, height, posture, and bulk. **Implication:** the hero's
cape, cowl/hair silhouette, and stance should read distinct from any NPC/enemy silhouette instantly
— there's no texture-detail budget to fall back on.

**Color blocking.** Superhero costumes traditionally use two or three bold, high-contrast hues in
large simple shapes, not fine patterning — a convention tracing to four-color comic printing
constraints (red/blue/yellow were the easiest inks) that persisted as a readability convention
independent of the original technology. Superman and Spider-Man are the reference cases: two
dominant hues, each a large contiguous shape. TV Tropes' "Primary-Color Champion" names the same
pattern: red+blue(+yellow) as the default "unambiguously a hero" signal. This maps directly onto
low-poly/no-texture 3D characters: distinct `MeshStandardMaterial` colors per body region (torso
vs. limbs vs. cape) does most of the recognizability work a costume artist would otherwise do with
fabric and trim.

**Cheap material treatment.** `MeshMatcapMaterial` bakes a pre-lit material-capture sphere as a
view-space lookup, giving a convincing rounded/lit look at zero real-time lighting cost and no
cloth/PBR texture maps — good for stylized low-poly capes/spandex where the camera doesn't do
extreme close-ups. Complementary: tune `roughness`/`metalness` on `MeshStandardMaterial` (low
roughness + slight sheen fakes spandex; higher roughness + fabric-like normal noise fakes cloth),
and rim/fresnel lighting via shader injection (`onBeforeCompile`) to fake "cloth catching light"
without any texture painting.

**Sources:** https://binus.ac.id/bandung/dkv/2025/11/04/the-power-of-silhouette-designing-readable-characters-in-motion/ · https://bigredillustration.com/articles/importance-of-silhouette-in-character-design/ · https://salivity.github.io/game-development/article/importance-of-character-silhouettes-in-game-design · https://comicbookco.com/comics/superhero-costume-design-symbolism-color-theory/ · https://islandpaints.com/home-decorating-tips/superhero-color-schemes-and-theory/ · https://tvtropes.org/pmwiki/pmwiki.php/Main/PrimaryColorChampion · https://threejs.org/docs/#api/en/materials/MeshMatcapMaterial · https://sbcode.net/threejs/meshmatcapmaterial/

### C2 — Cape and cloth simulation in Three.js

**Correction to existing project documentation, verified directly against the source:**
`KODAMAN_HANDOFF.md` describes the 2D game's cape as a "multi-segment bezier quad-strip." **This is
wrong.** `drawCape()` at `kodaman_prototype.html` line 5188 builds a **7-segment closed polygon**
using `ctx.moveTo`/`ctx.lineTo` — no `bezierCurveTo` calls anywhere in the function. Each of the 7
vertices per edge gets a per-vertex `Math.sin(e.capePhase + t * 3)` wave-displacement (`t` = segment
fraction 0..1), a speed-driven backward trail (`trail = -(8 + speed * 3.2)`), and a small
altitude/flight lift term (`lift = e.flightActive ? 10 : (e.vy < -1 ? 6 : 2)`), filled with a
linear gradient from a lit base color to a darker shade. It is procedural polygon wobble, not a
bezier curve of any kind. `KODAMAN_HANDOFF.md` is stale on this specific point (consistent with
`PIPELINE_STATE.md`'s existing note that this doc is generally stale — it undercounts the whole
file by ~11,000 lines). Anyone using that handoff doc to plan the 3D cape should disregard the
"bezier" claim.

**Comparing 3D approaches, in increasing cost/fidelity order:**

1. **Bone-chain + Verlet integration.** Rig the cape as a short chain of bones (~6–12 joints), skin
   a plane to the chain, drive each tip with a simple Verlet/spring-damper responding to gravity,
   hero velocity, and a wind vector, then re-derive bone rotations from resulting point positions
   each frame. Well-documented outside pure cloth sims for "cloaks, capes, and flags," and can
   layer on top of (respect) an existing skeletal pose rather than replace it. Cost: moderate — a
   ~10-point 1D chain with 1–2 constraint-relaxation iterations/frame is sub-millisecond, and gives
   genuinely physical secondary motion (lag, settle, flap) reacting believably to turns and dives.
2. **Full spring-mass particle-grid cloth.** Three.js's own `webgl_animation_cloth` example
   implements a full 2D particle grid with Verlet integration and constraint solving; community
   projects extend this with GPU compute shaders for skeletal-attached cloth. Overkill for a single
   cape — built for draping fabric over furniture or full-body clothing with self-collision, not a
   strip trailing off one attachment point. Highest implementation/debugging cost of the four
   options for the least additional payoff over a bone chain, for a solo dev with no dedicated
   graphics engineer.
3. **Vertex-shader procedural displacement.** Displace a `PlaneGeometry`'s vertices in a vertex
   shader via sine/noise driven by uniforms (time, velocity, wind strength) — directly analogous to
   the 2D game's actual polygon-wobble technique (see correction above), just computed per-vertex
   on GPU instead of per-polygon-vertex on CPU. Cheapest option computationally (no CPU physics
   loop, no bone chain), and is exactly the same *category* of technique as the Phase 1 CPU
   sine-wobble already decided (`PHASE_1_SPEC.md` §5: "Phase 1 animates it with a
   vertex-shader-free CPU sine wobble on the position attribute").
4. **Pre-baked animation clips.** Bake cape motion into a handful of clips (idle-flutter,
   running-flap, diving-stream, hard-turn), crossfade by speed/state via `AnimationMixer`. Cheapest
   at runtime, easiest to author without a physics rig, but least dynamic — won't react to arbitrary
   wind/unscripted maneuvers, and blending discrete clips can look canned during rapid direction
   changes (this game's core traversal mode).

**Recommendation — staged path.** Ship **option 3 (vertex-shader displacement)** first: it is a
near-zero-marginal-cost GPU upgrade of the Phase 1 CPU wobble already committed to, needs no
rigging pipeline, and is trivially tunable by an AI agent (windStrength, velocityInfluence,
frequency, amplitude uniforms). **Upgrade to option 1 (bone-chain + Verlet) in Phase 5**, once the
cape needs to sell sharp velocity changes (hard banking, sudden stops) that a pure procedural wave
can't — a bounded amount of added complexity (a few hundred lines, no external physics dependency)
that can coexist with the shader (shader handles fine ripple, chain handles gross trailing lag).
**Skip option 2 entirely** — it solves a problem (draped fabric, self-collision) this project
doesn't have, and is the worst complexity-to-payoff ratio here. Option 4 is a fallback only if
shader/physics tuning proves too fiddly — staying procedural (3→1) is more consistent with the
existing Phase 1 commitment than detouring through baked clips.

**Sources:** https://graphics.cs.wisc.edu/Courses/559-sp21-three/three.js/examples/webgl_animation_cloth.html · https://github.com/RobertoLovece/Cloth · https://pikuma.com/blog/verlet-integration-2d-cloth-physics-simulation · https://github.com/chonjay21/AnimVerlet · https://medium.com/@pablobandinopla/simple-cloth-simulation-with-three-js-and-compute-shaders-on-skeletal-animated-meshes-acb679a70d9f · https://github.com/kshaa/sinewave-3js · https://tympanus.net/codrops/2020/03/17/create-a-wave-motion-effect-on-an-image-with-three-js/

### C3 — Character asset strategy given no artist and no budget

**Option 1 — Procedural/primitive-built characters.** Composing humanoids from
`CapsuleGeometry`/`SphereGeometry`/`BoxGeometry` with distinct materials per body segment directly
generalizes what the 2D game already does with silhouette shapes — zero art time, entirely
AI-agent-authorable (pure code, no external tooling, no license concerns), and leans on C1's
finding that silhouette + bold color blocking carries most of a superhero's recognizability anyway.
Ceiling: no true rigged skeletal animation (transform-level tweening of primitive parts only), no
expressive faces, doesn't scale to a large distinct NPC cast.

**Option 2 — Free CC0/open-license sources.** **Quaternius** (quaternius.com) publishes low-poly
character packs plus a dedicated **Universal Base Characters** pack and **Universal Animation
Library**, both built around a shared humanoid rig "compatible with retargeting in any engine" and
explicitly "compatible with other common rigs like Mixamo," CC0 (public domain, no attribution
required), .FBX/.glTF. **Kenney.nl** offers several CC0 packs (Modular, Blocky, Roguelike,
Platformer, Mini, Animated Characters 3), all public-domain and commercial-safe, though skewing
blockier/simpler than Quaternius's more explicitly humanoid, Mixamo-rig-compatible meshes. For a
superhero specifically, Quaternius's base-character + Mixamo-compatible-rig combination is the
stronger fit.

**Option 3 — Mixamo for animation.** Auto-rigs an uploaded custom mesh (OBJ/FBX) via a handful of
placed skeletal markers, then offers its full mocap library (locomotion, combat, jumps, idles)
applicable directly to that rig, exportable as FBX for Three.js import via glTF conversion.
Quaternius explicitly advertises Mixamo-rig compatibility — the intended pipeline is: CC0 base mesh
→ confirm/adjust rig → pull from Mixamo's library or Quaternius's own Universal Animation Library
(built to match Mixamo's skeleton) → drive through `AnimationMixer`.

**Recommendation, consistent with the existing Phase 1 decision.** Keep primitive-built
(`CapsuleGeometry`/`SphereGeometry`) characters for Phase 1 as already decided — correct low-risk
starting point with zero art budget, fastest path to a playable slice. **In Phase 5** (per
`PHASE_1_SPEC.md`'s stated "glTF characters arrive Phase 5"), adopt a Quaternius CC0 base humanoid
mesh rigged Mixamo-compatibly, driven by a blend of Quaternius's Universal Animation Library and/or
Mixamo library clips via glTF/FBX-to-glTF pipelines. Real skeletal rig and a large pre-made
animation set, no hired artist ever required.

**Sources:** https://quaternius.com/packs/universalbasecharacters.html · https://quaternius.itch.io/universal-animation-library · https://kenney.nl/assets/modular-characters · https://kenney.nl/assets/blocky-characters · https://kenney.nl/support · https://www.tripo3d.ai/blog/collect/automate-your--d-character-rigging-and-animation-process-with-mixamo-vogzxjpc_9k · https://rebusfarm.net/blog/how-to-use-mixamo-with-blender-full-beginner-guide

### C4 — Trademark audit (PENDING USER SIGN-OFF — no agent renames anything unilaterally)

**This entire section is a finding, not an action.** Nothing below has been renamed, and nothing
should be renamed by any agent in this pipeline without explicit user sign-off. Character
*designs* in `kodaman_prototype.html` are already original and legally distinct from DC's — cape
shape, color choices, powers, and art style are the project's own. **Only the names are the
problem.**

**Scale of the problem — larger than the original task brief assumed.** The brief named five terms
to check (`wayne`, `arkham`, "Lexcorp", "Lois", "Power Girl"). Direct grep against
`kodaman_prototype.html` (16,507 lines) found those five plus at least six more: Gotham City,
Metropolis, Kryptonite/Kryptonian, and a full Wonder Woman/Diana/Themyscira/Ares companion arc in
Level 3, plus "Daily Planet" in ambient NPC dialogue. **Total exposure is roughly 900+ occurrences
across 10+ distinct protected marks.** This is not a cosmetic find-and-replace — `Lois` alone is
345 occurrences and the Wonder Woman/Diana/Themyscira/Ares arc is 61, meaning a rename touches
character logic, dialogue trees, and quest-state variable names (`l2QuestPhase`, `wayneDialogueDone`,
`arkhamPrisoners`, etc.), not just display strings.

**Per-category breakdown.** Occurrences fall into three categories with different risk and
different refactor cost, sampled directly from the grep output (exact per-term category counts
below are a representative sample, not an exhaustive line-by-line audit — flagged as a limitation,
not a final number):

| Category | Risk | Refactor cost | Example |
|---|---|---|---|
| **Player-visible strings** (dialogue lines, speaker labels, UI text, title-card copy) | Highest — directly visible in a public repo's shipped game | Medium — mostly string-literal edits, but dialogue trees reference speaker keys used elsewhere in logic | `speaker: 'Lois Lane'`, `'FLIGHT MANIFEST — filed under "LexCorp Holdings"'`, `'Newspapers! Get your Daily Planet!'` |
| **Code identifiers** (variable/function/constant names) | Lower direct player exposure, but visible to anyone reading a public repo's source | Highest — touches logic, not just text; renaming `WAYNE_X`, `powerGirl`, `bruceWayne`, `arkhamPrisoners`, `l2QuestPhase` states like `'travel_wayne'`/`'wayne_interior'` risks breaking quest-state string matching if done carelessly | `const WAYNE_X = 3200`, `function enterArkham()`, `powerGirl.captured` |
| **Source comments** (not player-visible, only visible if the repo goes public) | Low gameplay risk, nonzero repo-visibility risk | Lowest — free-text edits, no logic risk | `// Wayne Enterprises — Gotham financial district`, `// THE SUBJUGATOR: Darkseid-class colossus`, `// FIGHT MODE: full Batman-style combat AI` |

Sampled counts (case-insensitive grep against the full file; "comments" = lines starting with
`//` after trim; "quoted" = rough heuristic for string-literal occurrences — both are
lower-bound samples, not exhaustive classification):

| Term | Total | Comment-line sample | Quoted-string sample |
|---|---|---|---|
| wayne | 112 | 16 | 15 |
| arkham | 126 | 13 | 19 |
| lexcorp | 114 | 24 | 20 |
| lois | 345 | 43 | 30 |

(Power Girl, Gotham, Metropolis, Kryptonite, Wonder Woman/Diana/Themyscira/Ares did not
categorize cleanly under this quick heuristic — mostly because they appear as camelCase
identifiers like `powerGirl` rather than a plain word match, or because relevant dialogue uses
possessive/inflected forms the regex missed. Treat the "Total" column as the reliable number and
the category split as directional, not final.)

**Full mapping table.** "Proposed replacement" names are placeholders for user selection, not
recommendations to adopt as-is — flagged with — where genuine renaming judgment (tone, era,
in-universe consistency) is needed rather than a mechanical swap.

| Current name | Type | Occurrences | Proposed replacement (placeholder) | Rationale |
|---|---|---|---|---|
| `wayne` / Wayne Enterprises / Bruce Wayne | scene id, building, character | 112 | e.g. a new building name + new civilian-identity name for the informant character | Wayne is a core literal DC/Batman trademark; used as both a location and a named character here |
| `arkham` / Arkham Asylum | scene id, building | 126 | e.g. an invented secure-facility name (avoid reusing any other real DC facility name, e.g. "Blackgate," which is itself DC-owned) | Arkham Asylum is a DC-owned facility name |
| `lexcorp` / Lex Luthor | building, boss character (28 occurrences of "Lex Luthor" specifically, overlapping with the 114 lexcorp count) | 114 + 28 | e.g. new corporate name + new villain identity, keeping the "genius industrialist-turned-warlord" archetype which is not itself protectable | Lex Luthor is one of DC's most recognizable trademarked characters; LexCorp is his trademarked company |
| `Lois` / Lois Lane | companion character (reporter) | 345 | e.g. a new reporter-companion name | Lois Lane is a specifically named, trademarked DC character; the largest single rename by occurrence count |
| `powerGirl` (Power Girl) | companion character | 93 | e.g. a new hero-companion name | Power Girl is a trademarked DC character name |
| Gotham / Gotham City | destination location (referenced, not the primary LA setting) | 31 | e.g. an invented city name distinct from both Gotham and the game's own LA setting | Gotham City is a DC trademark; not covered by the LA-worldbuilding research since it's referenced as a separate destination, not the main map |
| Metropolis | location reference (dialogue only) | 4 | e.g. reuse the game's own invented city name, or a new one | Metropolis is a DC trademark |
| Kryptonite / Kryptonian | material / origin term | 5 + 1 | e.g. an invented element/origin term | Kryptonite is one of the most recognizable trademarked substances in fiction; low occurrence count makes this one of the cheaper renames |
| Wonder Woman / Diana / Themyscira / Ares | companion character, location, Level-3 villain | 19 + 11 + 1 + 30 = 61 | e.g. new companion identity + new island name; Ares specifically is Greek myth (public domain) but strongly DC-coded in this exact combination (companion is explicitly "Wonder Woman," island is explicitly "Themyscira") — renaming the companion/island breaks the association even if "a war god" is kept | Wonder Woman and Themyscira are DC trademarks; Ares alone is not DC's, but the surrounding context makes the combination recognizable as the DC version specifically |
| "Daily Planet" | ambient NPC dialogue (newspaper vendor line) | 1 | e.g. an invented newspaper name | Daily Planet is a DC trademark (Superman's paper); cheapest single-line fix in this whole table |
| Darkseid (comment only: "Darkseid-class colossus") | source comment describing enemy design inspiration | 2 | reword the comment, e.g. "colossus-class" | Not player-visible in current gameplay, but a public GitHub repo exposes source comments too |
| Superman (comment only: "classic Superman-villain molds," "Superman horizontal") | source comments | 2 | reword, e.g. "heroic-flight horizontal lean" | Same — comment-only exposure, low but nonzero risk in a public repo |
| Batman (comment only: "full Batman-style combat AI") | source comment | 1 | reword, e.g. "stealth-combat AI" | Same — comment-only |

**Explicitly not flagged as a problem:** "Kodaman" (the game's own title, lines 114 and 15261) is
an original name and needs no change. Enemy archetype type-strings (`brute`, `genius`, `energy`,
`warlord`, `robber`) are generic descriptors, not trademarked names.

**Status: PENDING USER SIGN-OFF.** This table is a finding for the user's decision, not an
instruction. `PIPELINE_STATE.md` already records this as an open item blocking public release; this
section supersedes that document's five-term list with the fuller ~11-term audit above. No agent
in this pipeline — including the Engineer stage — should rename any of these unilaterally before
the user has reviewed and approved (or amended) this table.

---

## Section D — Practical constraints

### D1 — Realistic scope for a solo developer working with an AI coding agent

Solo indie postmortems converge on one statistic repeatedly: scope, not skill, is the dominant
failure mode. Surveys cited in solo-dev retrospectives put "scope too large" as a factor in a large
majority of stalled or abandoned projects; individual postmortems describe multi-x overruns — one
cited case ballooned from a planned 9 months to 27 months, a 3x blowout, purely from scope creep.
Standard mitigations: write down 3–5 non-negotiable "core pillars" and refuse features outside them,
run new-feature requests through an impact/effort filter before committing, timebox work, accept
"good enough" over polish-everywhere (citing games like *Undertale* as wins built on intentional
simplification).

AI-agent-assisted development changes the calculus but does not remove it. Coverage of 2026-era
solo-dev-with-AI-agent workflows is consistent on where acceleration lands: boilerplate, repetitive
systems code, batch operations, first-draft glue code, and test/debug loops speed up dramatically —
one cited case used eight parallel agent roles on a shared codebase to ship a small game in 10
days. But the human remains the bottleneck on playtesting/feel-tuning, asset creation/curation (an
agent can't originate original 3D art), art-direction decisions, and architectural calls requiring
judgment against unstated project goals. One source names the actual new risk directly: "when you
had to do everything manually, scope was naturally limited by your capacity. With AI, scope is
limited only by your ability to manage it" — AI agents can make scope creep *worse*, not better, by
removing the friction that used to force prioritization.

**Applied to this project:** porting a 16,507-line 2D game (11 scenes, 3 quest-driven levels,
dialogue engine, multiple companions, day/night cycle) to 3D is unambiguously large scope by
solo-dev standards even with AI-agent leverage on coding. The realistic model is phased, vertically
sliced delivery — a playable core loop (movement, one scene, one quest) fully working in 3D before
horizontally expanding to the remaining scenes/levels — with each phase gated on **human**
playtesting/feel approval rather than agent-reported "done," since feel-tuning and art-direction
judgment are exactly the categories AI acceleration does not touch. This matches
`PIPELINE_STATE.md`'s own framing of Phase 1 as "a vertical slice… porting 16.5k lines… is many
sessions beyond this."

**Sources:** https://www.wayline.io/blog/scope-creep-solo-indie-game-development · https://www.wayline.io/blog/scope-creep-indie-games-avoiding-development-hell · https://www.gamedeveloper.com/business/the-last-humble-bee-postmortem-staying-sane-in-solo-development · https://www.strayspark.studio/blog/solo-dev-ai-stack-2026-ship-game-without-team

### D2 — Testing a 3D game: what's genuinely automatable vs. what needs a human

**Tier 1 — pure logic unit tests (Vitest, `environment: 'node'`).** Anything not touching
`document`/`window`/WebGL is genuinely reliable and fast: state machines (dialogue engine, quest
progression, day/night transitions), collision math (AABB/sphere overlap), tuning conversions
(px/frame → m/s scaling), inventory/companion-state logic. Vitest's default environment is plain
Node with no DOM — the right sandbox for this class of test, fast, deterministic, zero rendering
flakiness. State machines specifically are cited as an ideal unit-test target because they're pure
JS with no browser dependency. `PHASE_1_SPEC.md` §8 already targets exactly this tier for
`tests/collision.test.js` and `tests/locomotion.test.js` — that design choice is validated here.

**Tier 2 — headless browser smoke tests (Playwright/Puppeteer, real WebGL).** CAN reliably verify:
page loads without thrown console errors, `<canvas>` exists with nonzero dimensions,
`renderer.info.render.calls` / `.memory.geometries` / `.memory.textures` stay within sane bounds
(catches draw-call explosions or resource leaks), WebGL context isn't lost
(`webglcontextlost` never fires), and gross visual regressions via screenshot diffing. Playwright
ships this natively: `expect(page).toHaveScreenshot()` pixel-compares against a stored baseline
using `pixelmatch` internally, with `maxDiffPixelRatio`/`maxDiffPixels` tolerance and
`--update-snapshots` for intentional baseline changes.

**What this tier CANNOT verify, and a critical gotcha for the downstream QA agent:** subjective
game feel ("does flight feel good") has no automated proxy. Subtle visual/lighting bugs typically
fall through screenshot-diff tolerance bands, especially since WebGL can render slightly
differently headed vs. headless even on identical code (brightness/AA noise), forcing loosened
diff thresholds that hide real regressions. **Frame-pacing and perf-under-real-GPU-load are NOT
reliably measurable in default headless Chrome** — headless Chrome does not use hardware GPU
acceleration by default, falling back to SwiftShader/ANGLE software rendering; one measured case
ran an animation at 8 fps in default headless config vs. 60 fps once `--use-angle=gl` (or
equivalent real-GPU flags) was explicitly passed. **A QA agent must not report "60fps in headless
CI" as evidence the game performs well for a real player** — this is the single most important
boundary in this subsection.

**WebGL/Three.js in CI — prior art and flakiness.** Real precedent exists: Playwright configs
commonly pass `--no-sandbox --disable-dev-shm-usage --use-gl=swiftshader` for CI-safe software
WebGL without a GPU; GitHub-hosted GPU runners exist (GA for Linux/Windows, mesa/llvmpipe
preinstalled) when real hardware rendering is required for perf-sensitive checks. **Known dead
end:** `headless-gl` (a common older Node WebGL testing choice) no longer works with modern
Three.js — Three.js deprecated WebGL1 as of v0.163.0 and `headless-gl` never gained WebGL2 support;
current Three.js-forum advice is to mock WebGL2 calls as no-ops for logic-only unit tests, or move
fully to a real-browser tool (Playwright/Puppeteer) instead of in-process Node WebGL.

**Where a human's authority is non-negotiable — the QA agent must defer, not adjudicate:** game
feel (jump/flight/punch feel — no automated substitute), exploit-finding (adversarial creative
play a scripted suite won't attempt), camera clipping in edge-case geometry/positions (needs
exploratory traversal, not a fixed test path), combat balance (numeric tuning that "passes" any
unit test but isn't fun), dialogue pacing (timing/emotional beats, not just "did the text render"),
and art-direction quality (does a silhouette/color/material choice actually read well — see C1).
**The QA agent's authority ends at "does it run, does it not crash, did the numbers/coarse pixels
stay in expected bounds" — anything in this list gets flagged for a human pass, not resolved by the
agent.**

**Sources:** https://vitest.dev/config/environment · https://baptiste.devessier.fr/writing/unit-test-a-state-machine/ · https://playwright.dev/docs/test-snapshots · https://playwright.dev/docs/api/class-snapshotassertions · https://www.createit.com/blog/headless-chrome-testing-webgl-using-playwright/ · https://michelkraemer.com/enable-gpu-for-slow-playwright-tests-in-headless-mode/ · https://github.blog/changelog/2024-07-08-github-actions-gpu-hosted-runners-are-now-generally-available/ · https://discourse.threejs.org/t/suggestions-for-unit-testing-with-headless-gl-and-webgl-2/66891 · https://github.com/cypress-io/cypress/discussions/20837

### D3 — Performance profiling workflow

Four tools, each suited to a different layer. **stats.js** (already in the Phase 1 dependency list)
gives a real-time FPS/ms-per-frame overlay (plus allocated MB on its third panel) — the correct
always-on first signal during normal play/dev sessions. **`renderer.info`** is Three.js's built-in,
essentially free counter exposing `render.calls`, `render.triangles`, `memory.geometries`,
`memory.textures` — cheap enough to log or overlay continuously as a budget tripwire (draw calls
over N, or geometry/texture counts climbing frame-over-frame signaling a disposal leak).
**Spector.js** (browser extension) captures a single WebGL frame in full detail — every draw call,
texture bind, shader program, state change in sequence — the right tool once stats.js/renderer.info
have flagged *that* something is wrong but not *what*. **Chrome DevTools Performance panel** (plus
GPU/rendering tabs) is right for CPU-vs-GPU-bound diagnosis at the JS-engine level: flame graphs
show whether time is going into JS (scene traversal, physics/AI loops, GC) versus waiting on GPU
submission.

**Recommended order when a scene runs slow:** (1) stats.js first — steady-state slow (points to
per-frame work volume) vs. spiky (points to GC/allocation). (2) `renderer.info` — draw-call/
triangle/texture count higher than expected (batching or LOD problem), or growing over time
(disposal leak). (3) If JS-side, Chrome DevTools Performance panel to flame-graph the frame —
commonly per-frame object/geometry allocation, expensive traversal, or an unthrottled physics/AI
loop. (4) If GPU-side (DevTools shows JS finishing fast but frame still slow), Spector.js to
inspect individual draw calls/shaders/state changes.

**Sources:** https://tympanus.net/codrops/2025/02/11/building-efficient-three-js-scenes-optimize-performance-while-maintaining-quality/ · https://discourse.threejs.org/t/performance-profiling-tools-cpu-gpu/17469 · https://developer.chrome.com/blog/profiling-cpu · https://developer.chrome.com/docs/devtools/performance/reference · https://www.utsubo.com/blog/threejs-best-practices-100-tips

### D4 — Common failure modes when porting a 2D canvas game to 3D

**Coordinate-system handedness.** HTML canvas 2D is Y-down, origin top-left; Three.js/WebGL is
Y-up, right-handed, +Z toward the camera by convention. This project has already resolved the
primary mapping (2D world-X and ground-Y → 3D X/Z ground plane, Y promoted to "up" — see
`PHASE_1_SPEC.md` §4). General gotchas remain for anything not yet ported: handedness is a
property of the *whole* system, not a per-axis flip — naively negating one axis to "fix"
orientation can silently introduce a mirrored/backwards rotation direction elsewhere (clockwise
reads as counterclockwise, or triangle winding-order flips that break backface culling).
Camera-space vs. world-space mixups are the other classic trap: 2D code that positioned
UI/effects directly in screen pixels has no 3D equivalent without deliberately choosing
camera-space (billboarded/HUD) vs. world-space (scene-anchored) placement — carelessly ported code
tends to apply world-space transforms to what should be camera-relative elements, producing drift
or double-transform as the camera moves.

**Immediate-mode → retained-mode mental shift.** The 2D game's per-frame `ctx.fillRect`/
`ctx.drawImage` calls are immediate-mode: every drawing command is re-issued every frame, and the
canvas keeps no memory of the scene between frames. Three.js's scene graph is retained-mode:
geometries/materials/meshes are created once and persist; per-frame work should *mutate* existing
objects' transforms/uniforms/material properties, not recreate them. **The classic porting
mistake is bringing the immediate-mode habit along literally** — allocating new
`Geometry`/`Mesh`/`Material` instances inside the render loop, mirroring how `ctx.fillRect` "just
draws" each frame. This tanks performance (GC pressure, redundant GPU uploads every frame) and
leaks memory, since Three.js doesn't garbage-collect GPU resources automatically (see A12) — code
that recreates instead of disposes grows `renderer.info.memory.geometries`/`.textures` without
bound. Corollary: scene-graph mutation itself costs (traversal, matrix updates), so at scale it
matters *when* to hide (`object.visible = false`, cheap, keeps GPU resources resident) vs.
remove-and-dispose (frees memory, costs re-creation later) — a decision the old immediate-mode
code never had to make, since "not drawing this frame" was simply "don't call the draw function."
Batching has a similar new consequence: many small separate meshes (mirroring many small separate
`fillRect` calls) each cost a draw call, whereas 2D canvas drawing had no equivalent per-shape GPU
submission cost — a naive one-2D-shape-to-one-3D-mesh port can inadvertently multiply draw calls
versus the 2D original (directly relevant to the A4 draw-call budget).

**Sources:** https://medium.com/@alexbates39/an-overview-of-the-three-js-coordinate-system-07f75ee76e64 · https://discourse.threejs.org/t/convert-from-one-coordinate-system-to-another/13240 · https://discoverthreejs.com/book/first-steps/transformations/ · https://grokipedia.com/page/Immediate_mode_(computer_graphics) · https://grokipedia.com/page/Retained_mode · https://learn.microsoft.com/en-us/windows/win32/learnwin32/retained-mode-versus-immediate-mode · https://www.utsubo.com/blog/threejs-best-practices-100-tips

---

## Open questions / needs user decision

1. **§A7 is now filled** — `PHASE_1_SPEC.md`'s citation to this section is fulfilled. Its Rapier-
   deferral decision (hand-rolled kinematic capsule in Phase 1, Rapier added in Phase 3 for props/
   vehicles/enemies only, hero controller stays hand-rolled even after Rapier lands) is now backed
   by direct evidence (npm/GitHub-verified bundle sizes and maintenance activity, Three.js's own
   first-party Rapier integration and vehicle-controller example). No open item remains here.
2. **§A5 and §A6 are now filled** (outdoor lighting/CSM/day-night driving; post-processing pass
   costs and the resolution-scaling lever). One new cross-reference to flag: §A5 notes the CSM
   shadow addon is **WebGLRenderer-only** (WebGPURenderer needs a separate `CSMShadowNode`) — this
   interacts with item 3 below and should be considered together when that renderer decision is made.
3. **Renderer choice discrepancy:** `PHASE_1_SPEC.md` §5 specifies `WebGLRenderer` directly; §A13
   here recommends `WebGPURenderer` (with automatic WebGL2 fallback) as the better default for a
   2026 desktop-only audience. This is a real disagreement between an already-committed spec and a
   later finding — needs a user or Engineer-stage decision on whether to amend the spec before
   implementation starts, or proceed with `WebGLRenderer` as already specified and revisit later.
4. **Possible cross-reference bug in `PHASE_1_SPEC.md`:** its `src/entities/Hero.js` section cites
   "`RESEARCH_FINDINGS.md` §C4" for the primitive-built-character decision. Per this document's
   structure (matching the original research brief), §C4 is the trademark audit and §C3 is
   character asset strategy — the citation likely should point to §C3. Not fixed here since this
   agent was instructed not to modify `PHASE_1_SPEC.md`; flagging for the Review stage.
5. **Trademark rename (§C4) requires an explicit user decision before any renaming work begins.**
   The scope is larger than previously documented (~11 marks, 900+ occurrences, not the 5 originally
   flagged) and touches code identifiers and quest-state logic, not just display strings — this
   likely changes the size/timing estimate for whatever phase is meant to absorb the IP-rename work
   (referenced in `PHASE_1_SPEC.md` §10 as "the IP renames (Phase 2 gate — see
   `IMPLEMENTATION_PLAN.md`)"). The user should review the full mapping table above and either
   approve, amend, or defer specific renames before that phase is scoped in detail.
6. **The per-category trademark counts in §C4 are sampled, not exhaustive.** A full line-by-line
   classification (player-visible string vs. code identifier vs. comment, for every one of the
   ~900 occurrences) was not performed here for time/token reasons. If precise refactor-cost
   estimation is needed before Phase 2 gate planning, that classification pass should be done as
   a dedicated task, ideally by the Engineer or Review agent working directly in the rename branch.

# Phase 2 Research — World, Streaming, and Density (Run 1 of 2)

**Written by:** the Phase 2 Research agent (Sonnet), session 6, 2026-07-31.
**Scope:** world geography, chunk streaming, LOD/instancing, day/night + CSM + fog, floating
origin, the draw-call budget, world density/realism technique, and two district recommendations.
**Explicitly out of scope:** skeletal animation, character rigging, glTF character assets — that
is run 2, a separate agent, after the user has read this document.

**Precedence, inherited from `KNOWLEDGE_BASE.md`'s header:** if this document and an older doc
disagree, this document is not automatically right — check the date and reasoning. **If this
document and the code disagree, the code wins**, and every place that happened during this research
is called out inline rather than silently resolved either way.

## How to read the confidence labels

Every finding below is tagged with exactly one of:

- **[MEASURED]** — read directly from the installed code or a test that asserts the number. Most
  reliable; re-derivable by anyone with the repo.
- **[SOURCED]** — from a cited external or internal document, itself sourced (not a blog-tier
  guess). Reliable insofar as the source is; the citation is given so it can be checked.
- **[ESTIMATE]** — this agent's judgment, extrapolation, or recommendation. Defensible reasoning is
  given, but it is not measured and not independently sourced. Treat as a starting position, not a
  settled number.
- **[GUESS, INHERITED]** — a number that was already flagged as a guess by an earlier document and
  is carried forward unchanged because this run could not close it. Distinguished from [ESTIMATE]
  because this agent did not even attempt to improve on it beyond what §8 (open questions) records.

Findings are numbered by section prefix (`STR` streaming, `LOD` LOD/instancing, `DEN` density,
`ATM` atmosphere, `ORG` floating origin, `BUD` budget, `DIS` districts) so a later document can cite
them by ID.

---

## 1. Streaming architecture

### STR-1 — The drafted module list is directionally right; one dependency needs re-sequencing **[ESTIMATE]**

`IMPLEMENTATION_PLAN.md`'s Phase 2 deliverable list (`ChunkManager.js`, `Chunk.js`, `District.js`
×2, `LOD.js`, `Instancing.js`, `DayNightCycle.js`, `CSM.js`, `Sky.js` upgrade,
`core/FloatingOrigin.js`) survives contact with the shipped Phase 1 code without needing a
structural rewrite. The one thing worth re-sequencing: the plan lists `FloatingOrigin.js` last in
its bullet list but it is a **cross-cutting concern that `ChunkManager.js` and `Chunk.js` need to
be aware of from their first line**, not a bolt-on. A chunk's authored geometry is built in
chunk-local coordinates and only placed at world coordinates when its `Group` is added to the
scene; if floating-origin re-centering later needs to shift that placement without rebuilding
geometry, `Chunk.js`'s constructor should take a **chunk-local origin and a world-offset
`Vector3`/`Group.position` separately** from day one, not compute a single baked world-space
position into vertex data. This costs nothing now and avoids a retrofit. See §5 for whether
floating origin is needed at all at this scale.

### STR-2 — `StreetBlock.js` is the generalization target, and it is a monolith, not a template **[MEASURED]**

`kodaman3d/src/world/StreetBlock.js` is 1,608 lines (`wc -l`, confirmed) and currently does
everything a future `Chunk.js` + `District.js` would need to split across: procedural building
placement, a bespoke `CanvasTexture` facade/roof atlas system, `InstancedMesh` construction for
street furniture, and `CollisionWorld` registration, all for **exactly one hand-authored block**.
It is not written as a reusable chunk class — it is one `StreetBlock` object with hardcoded content
(`BLOCK.buildings`, a fixed array baked at module scope). Generalizing it means extracting three
genuinely separate concerns that are currently fused:

1. **Content data** (which buildings, where, what facade) → becomes `District.js`'s job, as
   data, not code.
2. **Geometry construction from that data** (the atlas-painting, the `InstancedMesh` assembly, the
   `BoxGeometry` building meshes) → becomes `Chunk.js`'s job, parameterized by whatever content
   data the district hands it for that 256 m cell.
3. **Collider registration** → stays the same shape (`collision.addBox(box3)`) but must become
   per-chunk-scoped so it can be **deregistered on unload** (`Collision.js` today has no `removeBox`
   — see STR-4).

None of this is a rewrite-from-scratch; `StreetBlock.js`'s atlas-painting and instancing code is
directly reusable as the guts of `Chunk.js`'s building-construction routine. But treating
`StreetBlock.js` as "the chunk code, just needs a loop around it" undersells the work — the data/
construction split does not exist yet in the shipped code and is real engineering, not
refactoring.

### STR-3 — `StreetBlock.js` itself is explicitly kept, not deleted, per the plan's own directory listing **[MEASURED]**

`IMPLEMENTATION_PLAN.md`'s target directory tree keeps `world/StreetBlock.js` alongside the new
Phase 2 files with the comment "superseded in role by `District.js` in Phase 2, kept for tests."
Confirmed consistent with the code: `tests/world.test.js` pins the 57-call worst case (§6) against
`StreetBlock` directly, and rewriting that test against `Chunk`/`District` before those modules
exist would be premature. **Recommendation: leave `StreetBlock.js` and its test in place
unmodified through Phase 2**, and have `Chunk.js`/`District.js` be new files that do not import
from it — the shared logic (atlas painting, instancing helpers) should be lifted into a new shared
module (e.g. `world/BuildingKit.js`, not currently in the plan) that both `StreetBlock.js` and the
new `Chunk.js` import, rather than `Chunk.js` importing `StreetBlock.js` or `StreetBlock.js` being
mutated in place to serve double duty. This keeps the Phase 1 regression test meaningful and avoids
coupling the new streaming system to the old single-block code path.

### STR-4 — `Collision.js` needs a real generalization, and the plan's one-line description undersells it **[MEASURED + ESTIMATE]**

Read directly: `CollisionWorld` (`kodaman3d/src/world/Collision.js`) holds two arrays — `boundaries`
(exactly 4 `Box3`, the playable-extent walls) and everything added via `addBox()`, concatenated
into a single flat `this.boxes` array used by one linear scan (`resolveCapsule`) per fixed step.
The file's own doc comment is explicit: *"NO BROADPHASE. A linear scan over ~16 boxes is correct
and sufficient. Adding one would be premature."* **There is no `removeBox()` method at all** —
`addBox` only appends, and `boxes` is only ever rebuilt from scratch in the constructor via
`_boxes = [...this.boundaries]`.

This matters for chunk unload: `IMPLEMENTATION_PLAN.md`'s Phase 2 dependency line says
"`Collision.js` generalizes from 12 static boxes to per-chunk box sets" as if it were a sizing
change. It is not — **it is a missing capability.** A chunk that unloads and disposes its meshes but
never removes its boxes from `CollisionWorld` leaks colliders: the hero would keep colliding with
buildings that are no longer rendered, and the box array would grow unboundedly across a long play
session, which is exactly the kind of leak `core/dispose.js`'s own design philosophy (write
disposal discipline before you need it, not after) says to avoid.

**Recommendation, [ESTIMATE]:**
- Add `CollisionWorld.addBoxSet(chunkId, boxes[])` and `CollisionWorld.removeBoxSet(chunkId)`,
  keyed by chunk id, backed internally by a `Map<chunkId, Box3[]>` that `resolve()` flattens (or
  iterates map-of-arrays directly — flattening is unnecessary since `resolveCapsule` already just
  wants an iterable).
- **Keep the linear scan.** At the load-ring sizes implied by `REVIEW_FLAGS.md` F3's own estimate
  (25–80 chunks in view at flight speed, §6 below derives the load-ring number more precisely), a
  fully loaded prefetch ring at Phase 1's per-chunk box density (~16 boxes/chunk per the file's own
  comment) is on the order of 400–1,300 boxes. An AABB-vs-capsule test is arithmetic, not a
  bottleneck; 1,300 iterations at 60 Hz is under 100,000 comparisons/second, trivial for a modern
  CPU and consistent with the file's own stated philosophy that a broadphase is premature until
  proven necessary. **This is not benchmarked in this pass — it is a reasoned extrapolation from the
  existing code comment, not a measurement, and should be spot-checked once `ChunkManager.js`
  exists and box counts are real, not estimated.**
- **Narrower scope than the full prefetch ring is available as a cheaper alternative if the above
  estimate turns out wrong**: only register colliders for chunks inside the (smaller) *load* ring,
  not the full velocity-predictive *prefetch* ring — the hero cannot physically reach a
  not-yet-visually-loaded chunk's buildings before it crosses into the load ring anyway, so
  deferring collider registration slightly behind mesh loading is free and roughly halves worst-case
  box count.

### STR-5 — Velocity-predictive load/unload and hysteresis: a concrete scheme, since the plan only names the technique **[ESTIMATE]**

`IMPLEMENTATION_PLAN.md` and `RESEARCH_FINDINGS.md` §A1 both name "velocity-predictive radius" and
"hysteresis" as the right shape but neither gives numbers. Proposing a concrete scheme, since the
brief wants sharpened technique, not a re-statement of the goal:

- **Two rings, not one radius.** A *load* ring radius `R_load` and a strictly larger *prefetch* ring
  `R_prefetch = R_load + R_margin`. Chunks whose center falls within `R_prefetch` of the hero begin
  loading (geometry construction + collider registration, per STR-4's note that collider
  registration can lag slightly behind if box count needs trimming); chunks within `R_load` are
  guaranteed fully resident.
- **Velocity bias, not a second geometric shape.** Rather than a genuinely asymmetric
  forward-expanded prefetch shape (more complex to reason about and test), bias the *center* of the
  prefetch ring along the velocity vector: `prefetchCenter = heroPosition + velocity.normalize() *
  min(|velocity| * lookaheadSeconds, R_margin)`, clamped so a stationary or slow hero gets a
  symmetric ring and a fast-flying hero gets a ring pushed ahead of them. `lookaheadSeconds` on the
  order of 1–2 s is a reasonable starting point — enough to cover one chunk's load time at typical
  flight speed (the FSM's `FLIGHT_DASH_SPEED`, not independently re-read in this pass but known
  from `KNOWLEDGE_BASE.md` §4 to be the flight speed cap) without pushing so far ahead that a sudden
  reversal (well within this hero's turn responsiveness, since orientation snaps at 12 rad/s per
  §4) causes thrashing at the trailing edge.
- **Unload ring smaller than load ring — the hysteresis itself.** Unload triggers only once a
  chunk's distance from the hero (not the biased prefetch center — unload should use the *hero's*
  actual position, not a predictive one, so a chunk is never unloaded while still prefetch-relevant)
  exceeds `R_unload = R_load + R_hysteresis_margin`. A chunk that just crossed into the load ring
  and is oscillating at the boundary (e.g., hero hovering exactly at a chunk edge) never triggers
  unload because `R_unload > R_load` by a fixed margin — this is the entire mechanism; no separate
  "cooldown timer" is needed if the margin is chosen larger than one fixed-step's worth of hero
  displacement at max speed, which at 60 Hz and any plausible flight speed is on the order of single
  metres, so a margin of one chunk-width fraction (e.g. 32–64 m, an eighth to a quarter of the 256 m
  chunk size) comfortably dominates.
- **Testability.** This is exactly the kind of pure-logic module `RESEARCH_FINDINGS.md` §D2 flags
  as an ideal unit-test target — `tests/chunkStreaming.test.js` (already in the plan's deliverable
  list) can assert load/unload/hysteresis behavior against synthetic position/velocity sequences
  with no WebGL context, the same pattern the 105 existing locomotion tests already use.

### STR-6 — Shader/material compile hitching is a real risk this project has not yet hit, because Phase 1 never streams **[SOURCED]**

`RESEARCH_FINDINGS.md` §A1 states the dominant chunk-load hitch cause is shader/program
compilation on first sight of a new material combination, not triangle count, and recommends a
warm pool of reused geometry/material objects plus pre-warming a chunk's material kit before the
player gets close. This is unverified against Phase 1 code because **Phase 1 has no streaming to
verify it against** — `StreetBlock.js` builds its entire (single) block once at `Game.init()` and
never again. **This is a real, not hypothetical, risk for `ChunkManager.js`**: if every chunk
constructs its own fresh `CanvasTexture` atlas and materials (as `StreetBlock.js`'s current
per-instance atlas-painting code does), a chunk load at flight speed could visibly hitch on first
paint. Two mitigations worth costing at Chunk.js design time, not deferring: (a) share a small,
fixed set of atlas variants across chunks within a district (a "kit of parts" texture library, not
one bespoke atlas per chunk) so the shader/texture-combination space is bounded regardless of world
size; (b) prefetch-ring loading (STR-5) already buys a few seconds of lead time before a chunk needs
to render, which is exactly the window pre-warming needs.

---

## 2. LOD and instancing

### LOD-1 — The three-tier scheme is a reasonable extrapolation, explicitly not a cited hard number **[SOURCED, labelled as estimate by its own source]**

`RESEARCH_FINDINGS.md` §A2 proposes tier 0 full detail 0–40 m, tier 1 simplified 40–150 m, tier 2
impostor/billboard 150 m+, and is explicit that this is "a reasonable extrapolation (no
city-specific Three.js benchmark exists)... treat this as a profiling starting point, not a cited
hard number." Nothing found in this pass improves on that — no LA-city-scale or superhero-flight-
specific LOD benchmark exists (§8(e) of `RESEARCH_LA_WORLDBUILDING.md` confirms this search was
already tried and came up empty). **Carry the three tiers forward unchanged, but budget QA time to
re-tune the two distance thresholds empirically once real chunk content exists** — they are a
starting position, not a derived result.

One correction worth making to how the tiers get used: `THREE.LOD` is confirmed **CPU-side
visibility swapping only** — all levels stay resident in VRAM simultaneously even though only one
renders (§A2). For a chunk-based world this means `LOD.js` reduces draw calls and fragment cost at
distance, but **does not reduce memory pressure** — a chunk holding all three LOD tiers in memory is
not cheaper to keep loaded than one holding only its current tier. If VRAM becomes the binding
constraint before draw calls do (plausible on an integrated-GPU laptop per `RESEARCH_FINDINGS.md`
§A4's 2–4 GB shared-VRAM figure), the fix is unloading whole chunks sooner (STR-5's unload ring),
not a `LOD.js` change — worth stating explicitly because it is an easy thing to expect `THREE.LOD`
to solve that it structurally cannot.

### LOD-2 — `BatchedMesh` API status in the installed three 0.185.1, verified directly against the source **[MEASURED]**

`RESEARCH_FINDINGS.md` §A3 flagged `BatchedMesh` as "still maturing at r185" with a specific open
issue (#32741) about buffer bookkeeping after `optimize()`. Re-checked directly against
`kodaman3d/node_modules/three/src/objects/BatchedMesh.js` in the installed 0.185.1 tree (not the
docs, not release notes): `addGeometry()`, `addInstance()`, `setGeometryAt()`, and `optimize()` are
all present and implemented as described. `dispose()` is present at line 1498 and explicitly frees
`this.geometry`, `_matricesTexture`, `_indirectTexture`, and `_colorsTexture` — the r185 fix
`RESEARCH_FINDINGS.md` cited (a prior `dispose()` declaration bug) reads as landed in this installed
version; there is no half-finished or stubbed method visible in the source. **This is a positive
confirmation, not a full functional test** — this pass read the implementation, it did not exercise
`optimize()` with add/remove churn against the specific buffer-overrun issue (#32741) the way a
runtime reproduction would. Treat `BatchedMesh` as safe to build against for the building
kit-of-parts use case, but keep #32741 in mind if `Chunk.js` ever needs to delete-then-re-add many
geometries in a tight loop (e.g., during aggressive LOD tier switching implemented via
`BatchedMesh` rather than `THREE.LOD` — not currently proposed, but worth flagging as a combination
to avoid without re-testing #32741 first).

### LOD-3 — Where each tool actually pays off in this codebase, stated concretely **[ESTIMATE, grounded in STR-2/BUD-1's measured object inventory]**

Cross-referencing `RESEARCH_FINDINGS.md` §A3's rule of thumb ("single geometry → `InstancedMesh`;
2–4 variants → a few parallel `InstancedMesh`es; many variants → `BatchedMesh`") against what
`StreetBlock.js` actually contains (§6's inventory): the street-furniture layer (palms, lamp posts,
rooftop HVAC units, parapet bars, awnings, blade signs) is already exactly the single-geometry
`InstancedMesh` case and Phase 1 already builds it that way — **nothing to change here, Phase 2 just
needs `Instancing.js` to be the reusable version of what `StreetBlock.js`'s private instancing code
already does inline.** The one place `BatchedMesh` earns its complexity is **building massing
itself**: Phase 1's 10 buildings are each one plain `Mesh` with one `BoxGeometry` (§DEN-1 below
covers why this reads as "blocky"), so scaling to dozens of buildings per district as one-`Mesh`-
each would scale draw calls 1:1 with building count — the opposite of what a 64-chunk world needs.
**Recommendation: `Instancing.js` owns props (single/few-geometry, per-instance transform only);
`Chunk.js`'s building construction should use `BatchedMesh` for its per-building geometry once
buildings stop being simple boxes (§DEN-2's setback/facade-break proposal produces exactly the
"many geometry variants, one shared material family" shape `BatchedMesh` is for).** This is the
direct link between the LOD/instancing section and the density section below — they are not
separate problems, the realism fix is what makes `BatchedMesh` worth adopting in the first place.

### LOD-4 — Occlusion culling: confirmed absent from Three.js core, and the cheap substitute this project's own geometry provides **[SOURCED]**

`RESEARCH_FINDINGS.md` §A2 confirms directly from a Three.js maintainer that there is no built-in
occlusion culling ("three does frustum culling – not occlusion culling unfortunately"). For a
street-grid city, the practical substitute is coarse manual portal/cell culling — hiding whole
blocks behind the current one via precomputed visibility, which is cheap specifically *because* the
world is a grid of chunks (this project's own architecture, not a general-city solution). **This
maps directly onto `ChunkManager.js`: since chunks already have known grid-adjacency, a simple
"is this chunk's bounding box entirely behind an unbroken row of taller buildings from the camera's
current chunk" heuristic is a natural, cheap extension of the load/unload logic already being
built, not a separate system.** `three-mesh-bvh`, the more general BVH-raycast-sampling approach
`RESEARCH_FINDINGS.md` cites, is not currently a project dependency (`package.json` confirmed —
only `three`, `lil-gui`, `stats.js`, `vite`, `vitest`) and adding it should be weighed against the
grid-native cheap version above before reaching for a general-purpose library.

---

## 3. The density and realism techniques — answering the user's feedback

The user's feedback ("the world feels empty, too few landmarks," "buildings and the landscape are
too blocky and rigid," RDR2 and Watch Dogs named as inspiration) is treated here as a set of
translatable technique questions, per the brief. Each item below states the diagnosis, the
technique, its cost, and whether it transfers to a browser WebGL build.

### DEN-1 — Diagnosis: "blocky and rigid" is not a mood, it is a literally true statement about the code **[MEASURED]**

Read directly, `kodaman3d/src/world/StreetBlock.js` line 550: every building is constructed as
`new THREE.BoxGeometry(b.w, b.h, b.d)` — **one rectangular prism per building, full stop.** Massing
*variety* exists (the 10 buildings have different `w`/`h`/`d` values, confirmed from `BLOCK.buildings`
data), and surface *detail* exists (the bespoke `CanvasTexture` facade/roof atlas paints windows,
floor lines, and — per the roof-fix history in `KNOWLEDGE_BASE.md` §6 — a helipad). But there is
**no setback, no notch, no corner articulation, no non-rectangular footprint anywhere in Phase 1's
geometry.** The user's complaint is accurate at the geometry level, not just the texture level — a
higher-resolution texture or better palette (already done, per the envMap work) cannot fix a
silhouette problem, because the silhouette is genuinely a plain box regardless of what is painted
on it. This reframes the fix from "better textures" to **"buildings need compound geometry,"**
which is a `BatchedMesh` problem (§LOD-3), not a material problem.

### DEN-2 — Facade articulation and setbacks: the direct fix, costed **[ESTIMATE]**

The real-world reference is already in the research: the DTLA tower cluster (§3.1 of
`RESEARCH_LA_WORLDBUILDING.md`) is "a cluster of ~10 towers... a *plateau*, not a spire," built in
one architectural generation (1971–1992, "dark glass and stone-clad boxes with flat tops") — i.e.
**real LA towers are also fairly boxy**, which means the fix is not "make every tower an organic
shape," it is specifically: (a) a small number of **massing variants** built from 2–4 stacked boxes
each (a wider base podium, a narrower tower above a setback line, an optional cap/parapet detail —
already partially present via the instanced parapet-bar ring), and (b) **corner and edge
articulation** — chamfered or recessed corners, vertical pilaster lines suggested by the facade
atlas's existing UV-tiling mechanism rather than new geometry where geometry isn't needed.

**Cost, [ESTIMATE] since no such asset exists yet to measure:** a 3-box podium+setback+cap massing
kit, built as `BatchedMesh` geometry variants sharing the existing facade material family, is **one
`BatchedMesh` per building type-class (2–4 draw calls total for the whole kit, main pass; the same
again for shadow pass if all cast shadows)** regardless of how many actual buildings use it — this
is exactly `BatchedMesh`'s value proposition (§LOD-3) and is why it is worth adopting now rather
than shipping more single-box buildings. Triangle cost per building rises from 12 (one box) to
roughly 60–100 (3 boxes plus a handful of corner/parapet details) — trivial against the ~500,000
triangle whole-scene ceiling (`RESEARCH_FINDINGS.md` §A4). **Authoring cost is the real cost here,
not rendering** — this is 3–5 massing "recipes" (which boxes, what proportions) to design once and
apply per building via data (district JSON, following the same declarative-data philosophy
`IMPLEMENTATION_PLAN.md` already uses for quests), not new geometry hand-placed per building.

### DEN-3 — Roofline and skyline variety: LA is polycentric, and Phase 1's single block cannot show that **[SOURCED + ESTIMATE]**

`RESEARCH_LA_WORLDBUILDING.md` §3.1 makes an explicit point worth carrying into district design:
*"LA's skyline is polycentric: DTLA, Century City, plus the Wilshire Corridor... a single downtown
misreads LA badly."* Phase 1's one block cannot demonstrate this (it is one block); Phase 2's two
districts can, cheaply, **if the two chosen districts are visually distinct silhouette classes
rather than two similar dense cores** (this bears directly on §7's district recommendation below).
The flat-helipad-roof fact (§3.3: LAFD Requirement No. 10, rescinded 2014, "hundreds of legible,
authentic landing pads" for a flying hero) is **already implemented** — `KNOWLEDGE_BASE.md` §6
records the roof-parapet-ring fix that made the helipad visible — so this specific piece of realism
is done, not proposed. What is not done: **height-band variety district-to-district.** §3.2's
150 ft (46 m) pre-1957 height-limit fact and §6.5's dingbat/mini-mall typologies (1–2 story dominant
sprawl fabric) argue that the *contrast* between a tower cluster and a low, dense district (like
Koreatown's "Manhattan-adjacent density achieved almost entirely with 4–6 story... no towers," §5.8)
reads as more real than uniform mid-rise everywhere — and is also **cheaper**, since low buildings
cost fewer triangles and fewer shadow-casting tall silhouettes per chunk.

### DEN-4 — Street-level clutter density: instancing-first, and where the character-work boundary actually falls **[ESTIMATE]**

"The world feels empty" is very plausibly about **street furniture and set-dressing density**, not
just building geometry — a real LA block reads as full of parked cars, awnings, signage, trash
cans, scaffolding, café tables, utility poles and wires, not just buildings and sidewalk. Phase 1
already has the mechanism: `StreetBlock.js`'s instanced HVAC/awning/blade-sign/palm/lamp layer
(§DEN-1's sibling code) proves the pattern works and is cheap (the realism pass added 44 objects
for +8 draw calls total, per `ENGINEER_PHASE1_CLOSE.md`, confirmed in §6 below). **Recommendation:
`Instancing.js` should ship a genuinely wider clutter library from Phase 2's start** — parked-car
variants (3–5 body shapes × a few color instances via `setColorAt`, one `InstancedMesh` per body
shape), trash cans, newspaper boxes, scaffolding/construction props for one or two blocks
(environmental storytelling — a district doesn't have to be uniformly finished to read as alive),
utility poles with instanced cross-arms. **Cost is dominated by authoring the source geometry (a
few dozen small prop models), not by draw calls** — each new prop type is one more `InstancedMesh`,
i.e. one more main-pass call (and one more shadow-pass call if it casts), so 10 new prop categories
is +10 to +20 calls total against the 57-call baseline (§6), which is affordable within the ceiling
proposed there.

**The character-work boundary, stated precisely so it isn't mis-scoped into this run:** static/
instanced set-dressing (parked cars with no driver, market stalls, scaffolding) is squarely in
scope for this run and costs what's described above. **Populated sidewalks — pedestrian NPCs
walking, idling, reacting** — require skeletal characters and animation and are explicitly run 2's
territory (per the brief's scope line). If "empty" partly means "no people," that half of the fix
is out of this document's authority to propose technique for; flagged here only so the boundary is
visible, not to answer it.

### DEN-5 — Terrain: LA is famously flat, but "flat" is not "featureless," and the two are being conflated **[SOURCED + ESTIMATE]**

`RESEARCH_LA_WORLDBUILDING.md` §4 gives real numbers: Mount Lee (Hollywood Sign) 521 m, Mount
Hollywood 495 m, Griffith Observatory 346 m, against a Basin that is otherwise genuinely flat (the
150 ft height-limit history in §3.2 is itself evidence of how flat and low LA reads at street
level). The same section's own caution matters: *"the Hollywood Hills are modest — they read as
dramatic because they rise directly out of a flat basin at close range... do not over-scale them;
exaggerating the hills is the classic mistake."* This directly informs the "landscape... too rigid"
complaint: **Phase 1's ground plane is a flat, unbroken `BoxGeometry`/plane** (confirmed:
`StreetBlock.js`'s `_buildGround()` builds a flat ground mesh with no vertex displacement). A
completely flat ground plane under a city block reads as a diorama base, not terrain, independent
of building quality. The fix does not require true topographic hills everywhere — it requires
**subtle, cheap relief**: gentle grade on connective-tissue terrain between districts (§2.8/§2.9's
real grade data — 15% normal max, real outliers to 32% on Baxter St — gives authentic reference
numbers for street grade if streets climb at all), and one deliberate hill feature (a Griffith-
Park-analog rise, generic-named per the naming constraint) as a **third silhouette class** distinct
from both districts, serving §DEN-6's sightline-anchor role below.

**Cost, [ESTIMATE]:** a displaced/subdivided ground plane per chunk (the float32-jitter warning in
`RESEARCH_LA_WORLDBUILDING.md` §9.2 — large flat planes need intermediate vertices regardless of
world size — means chunk ground geometry needs subdivision anyway, so terrain relief is close to
free once that subdivision exists for precision reasons alone) costs **zero additional draw calls**
(still one ground mesh per chunk, or one merged ground `BatchedMesh` across a district) and a modest
triangle increase (a 256 m chunk ground plane subdivided to, say, 16×16 quads = 512 triangles,
trivial against the whole-scene budget). The one hill feature is authored once, not per chunk.

### DEN-6 — Landmark placement and sightlines: the cheapest lever in this whole section **[SOURCED, cross-district]**

`RESEARCH_LA_WORLDBUILDING.md` §7.2's GTA V analysis is directly transferable *technique*, not just
trivia: Rockstar horizontally compressed Los Santos ~10:1 versus real LA while vertically
*exaggerating* Mount Chiliad ~5.3× — *"horizontal compression makes a city feel small, and
exaggerated verticality is the cheap compensation — it restores a sense of scale and gives long
sightlines a terminus."* This project's own world-scale ruling (`REVIEW_FLAGS.md` F3: 2,048 m built
target, itself a real compression relative to the ~4–6 km real distances between the districts
under discussion) is in exactly the regime where this lesson applies. **A tall, distinctive,
sight-line-terminating landmark per district — visible from most of the built world, not just up
close — is the single cheapest fix for "feels empty, too few landmarks":** it costs one hero asset
(built once, at tier-0 LOD fidelity, everywhere else at tier-2 impostor per §LOD-1) and does more
for the "does this feel like a real, inhabited place" reaction than a proportional amount of street
clutter, because it works from *outside* the district too — a flying hero orienting from 500 m up
sees the landmark from everywhere, which street-level clutter cannot achieve. This is the same
mechanism `RESEARCH_LA_WORLDBUILDING.md` §5.9 documents for the Sunset Strip's own signage ("on a
1.6-mile corridor these are the dominant vertical elements, not the buildings") — vertical signage
and landmark towers are a real, sourced LA visual-language feature, not just a game-design trick
borrowed from GTA.

### DEN-7 — Vegetation: species and canopy variety is cheap instancing, already validated by Phase 1 **[SOURCED + MEASURED]**

`StreetBlock.js` already instances one palm species (trunk + crown, 2 `InstancedMesh`es, confirmed
in code). `RESEARCH_LA_WORLDBUILDING.md` §6.1 gives three real, distinguishable species with real
height/silhouette differences (Mexican fan palm 40–80 ft, whip-thin; California fan palm 30–50 ft,
stouter; Canary Island date palm 40–50 ft, "massive pineapple-shaped crown... reads as formal/
estate, not street") — swapping a **second and third palm geometry into the existing
`InstancedMesh` pattern is a direct, near-zero-cost extension of code that already works**: each
additional species is +1 or +2 draw calls (trunk/crown), not a new system. §6.2's note that LA has
~1,000 street tree species (only totals confirmed, no per-species share — see §8 open items) argues
for at least one broadleaf shade-tree instanced type alongside palms for districts that are not
palm-boulevard-coded (a courtyard/dingbat residential district reads wrong with only palms).
**This is one of the highest value-per-engineering-hour items in this section** because the
mechanism is proven, not proposed.

### DEN-8 — Environmental storytelling: small, cheap, and explicitly a Phase 2+ authoring habit, not a system **[ESTIMATE]**

Watch Dogs and RDR2 both lean heavily on small non-interactive detail (posters, graffiti, parked
delivery trucks with open doors, laundry lines, construction barriers) to make static geometry read
as inhabited rather than staged. None of this needs new engineering beyond what §DEN-4's clutter
library already proposes — it is an **authoring discipline** (vary instance placement rules so
clutter clusters unevenly rather than on a uniform grid, mix in a few "broken" or "in-progress"
variants rather than uniform-clean prop instances) more than a new module. Flagged here mainly so
it is not mistaken for something that needs its own `EnvironmentalStorytelling.js` — it is a
content-authoring pattern layered onto `District.js`'s existing data, not new code.

### DEN-9 — What does NOT transfer from RDR2/Watch Dogs to a WebGL browser build, stated plainly **[ESTIMATE, the honesty section the brief asks for]**

- **Nanite-style virtual geometry / unbounded per-triangle detail.** RDR2's ground-cover and
  rock/vegetation density relies on a console-native, decade-long studio art pipeline with
  aggressive proprietary streaming of enormous unique-geometry libraries. There is no WebGL
  equivalent, and a solo/kit-of-parts project should not chase per-blade grass density — the
  ceiling in §6 (a both-pass draw-call total, not thousands) makes that structurally impossible
  regardless of skill. Fake density with normal maps and a modest number of instanced grass-clump
  cards instead, at tier-0 LOD distance only.
- **Simulated crowd density.** RDR2/Watch Dogs both run hundreds of independently-simulated,
  animated NPCs per district with full AI. `RESEARCH_FINDINGS.md` §A3's own finding is blunt: naive
  `SkinnedMesh` crowds drop below 60 fps past ~20 avatars without GPU-instanced skinning (a
  nontrivial bone-matrix-texture technique Three.js has no native support for). This is a Phase 5+
  problem at best, not a Phase 2 density fix, and is explicitly out of this run's scope regardless.
- **Fully dynamic, destructible, or physically-simulated world detail** (RDR2's mud/snow
  deformation, Watch Dogs' hackable city infrastructure as a systemic layer). Both are large,
  bespoke systems on top of an already-large engine team; nothing in this project's Phase 3+ plan
  (Rapier for props/enemies/vehicles only, per locked decisions) budgets for world-deformation
  systems, and nothing above proposes one.
- **Console-scale texture memory and asset library size.** Both reference games ship many gigabytes
  of unique textures per district. This project's own asset-compression plan (Phase 7: KTX2/Basis,
  Draco) exists specifically because a browser build cannot assume console-scale VRAM or download
  budgets — the kit-of-parts/instancing-first approach throughout this section is not a stylistic
  choice, it is the only approach compatible with `RESEARCH_FINDINGS.md` §A4's 2–4 GB shared-VRAM
  integrated-GPU target.
- **What genuinely does transfer, restated as the throughline of this section:** modular kit-of-
  parts building massing (§DEN-2), instanced set-dressing density (§DEN-4/§DEN-7), a small number
  of high-fidelity landmark assets doing disproportionate work for scale/orientation (§DEN-6), and
  authored-not-simulated environmental storytelling (§DEN-8) — all of which are standard even in
  AAA production and are exactly the techniques that scale down to a solo/kit-of-parts WebGL
  project without their cost structure changing qualitatively, only in volume.

---

## 4. Day/night, CSM, and fog

### ATM-1 — The 2D game's day/night state machine, read directly, gives `DayNightCycle.js` a real starting point **[MEASURED]**

Targeted `grep`/`sed` reads of `kodaman_prototype.html` (a few dozen lines total, not a bulk read,
per the brief's constraint) around the cited `L5141` and `L8184–8250` ranges confirm the plan's
description and add detail worth carrying into `DayNightCycle.js`:

- `const DAY_CYCLE = 14400;` — a full day/night loop is **14,400 frames, ≈4 minutes at 60 fps**
  (the comment states this explicitly: "~4 min at 60fps; day lasts ~75% of the cycle").
- `dayPhase = Math.pow(rawSine, 0.62)`, where `rawSine` is a `(sin(...) + 1) / 2` normalized sine —
  **the exponent is a deliberate bias toward longer daytime**, not an arbitrary curve. This is a
  considered design choice in the source material, not incidental, and worth preserving rather than
  reverting to a plain sine when porting to a 3D `DirectionalLight` arc.
- Day window: `isDay = dayPhase > 0.25 && dayPhase < 0.75`. Sun visible `0.08 < dayPhase < 0.92`.
  Moon fades in as `dayPhase` approaches 0/1. Golden-hour intensity peaks at `dayPhase ≈ 0.25` and
  `≈ 0.75` (dawn/dusk) via `goldenP = max(0, 1 - |dayPhase - 0.5| * 8) * 0.85`.
- The sky gradient is **district-tinted** in the 2D game (`docks`/`uptown`/default each get a
  different night-sky gradient) — a detail with no direct 3D equivalent yet, but worth carrying as
  a design intent: **the two Phase 2 districts should read as visually distinct at night, not just
  by day**, which argues for `DayNightCycle.js` taking a per-district color-scheme parameter rather
  than one global palette.

**Recommendation:** port the phase math (the `pow(sin, 0.62)` curve, the day/golden-hour/night
windows as fractions of the cycle) onto `DirectionalLight.position` (circular arc), `.color`
(interpolated per `RESEARCH_FINDINGS.md` §A5's warm-horizon → white-noon → cool-moonlight scheme),
and `.intensity` (peaking at `dayPhase = 0.5`, near-zero at night with hemisphere/ambient light
picking up the slack, exactly as §A5 recommends). **Whether 4 minutes is the right real-time cycle
length for a 3D flight game (long enough to be a moment-to-moment aesthetic beat, but the 2D game
was a top-down action game with a much smaller traversal radius) is a feel decision, not answered
here — flagged in §8.**

### ATM-2 — CSM: confirmed present and usable, one factual correction to the existing research **[MEASURED]**

`three/addons/csm/CSM.js` (plus `CSMFrustum.js`, `CSMHelper.js`, `CSMShader.js`) is present in the
installed `three@0.185.1` tree, confirmed by listing `node_modules/three/examples/jsm/csm/`. It is
importable and usable as `RESEARCH_FINDINGS.md` §A5 and `IMPLEMENTATION_PLAN.md` describe.
`CSMShadowNode.js` (the WebGPU-path equivalent) is also present in the same directory but is
correctly not the one to use, per the binding WebGL-only constraint.

**One correction, read directly from the source rather than trusted from the docs:**
`RESEARCH_FINDINGS.md` §A5 states *"default configuration creates 4 frustum splits."* The installed
source says otherwise — `kodaman3d/node_modules/three/examples/jsm/csm/CSM.js` line 61:
`this.cascades = data.cascades || 3;`. **The addon's actual default is 3 cascades, not 4.** This is
a minor doc/code disagreement (the earlier research was likely going from an older addon version or
a specific example's configuration rather than the constructor default), and per this document's
own precedence rule, the code wins: **`CSM.js` (the Phase 2 wrapper) should treat 3 as the default
and explicitly document the choice if it raises to 4** rather than assuming 4 was always the
baseline.

### ATM-3 — CSM's real draw-call cost is not "one shadow pass like before" — this needs measurement once it lands, not an assumed formula **[ESTIMATE, flagged explicitly as unverified]**

Read directly from `CSM.js`: each cascade gets **its own real `THREE.DirectionalLight`**
(`this.lights.push(light)`, one per cascade, confirmed in source) with its own shadow camera scoped
to that cascade's frustum slice. `WebGLShadowMap` tests every `castShadow` object against **every**
light's shadow-camera frustum independently (this is how Three.js has always worked — confirmed by
the same mechanism `KNOWLEDGE_BASE.md` §6 and `ENGINEER_PHASE1_CLOSE.md` used to derive the 57-call
figure for a *single* directional light). **The consequence: an object that straddles two
cascades' depth ranges can be drawn into the shadow pass twice, not once** — CSM shadow cost is not
simply "the same shadow pass as Phase 1, now with prettier resolution falloff," it can be **more**
expensive per caster than Phase 1's single-light shadow pass, in proportion to how much geometry
sits in cascade-overlap zones. Whether that turns out to be a small tax (most street-level geometry
sits comfortably inside the nearest cascade) or a real budget problem (tall towers spanning multiple
cascade depths, exactly the geometry §DEN-2/§DEN-3 are proposing more of) **is not knowable without
building `CSM.js` and reading `renderer.info.render.calls` against it — this document does not
assert a number and flags it as needing measurement at implementation time, not before.** This is a
direct, load-bearing consequence for §6's budget derivation: the 57→X ceiling proposed there **must
be re-verified once CSM is live**, not assumed to hold from the pre-CSM math alone.

### ATM-4 — R1 (LA visibility/haze parameters) — substantially closed, with a finding that changes how the number should be used **[SOURCED — primary source extracted this pass]**

`REVIEW_FLAGS.md`'s R1 flagged this as needing the cached LaDochy & Fuentes *"Visibility trends in
the Los Angeles Basin, 1933–present"* PDF, last known at a scratchpad path from an earlier session
that the brief assumed was gone. **It was not gone** — both the cached PDF
(`webfetch-1785374656488-qj3r5v.pdf` under that session's `tool-results/`) and the `pypdf` install
under that session's scratchpad `pylibs/` were still present on disk and were used to extract the
document's text in this pass (10 pages, ~31,500 characters extracted cleanly).

**Real figures from the primary source, Keith's downtown L.A. noon-visibility study as cited within
it:**
- Mean visibility at noon, downtown L.A.: **12.6 miles (1933–41) → 8.3 miles (1960–68) → 7.9 miles
  (1969).** A clear multi-decade decline through the smog era.
- **"Excellent visibility"** is defined in the source as **over 35 miles**, and the fraction of days
  reaching it fell sharply over the same period.
- Two low-visibility thresholds used across the cited studies: **under 3 miles** (Keith's own
  preferred pollution-trend indicator, argued as more meaningful than the regulatory standard) and
  **under 10 miles** (the period's state air-quality visibility standard).
- The paper's own conclusion (covering airport data through 1995, the most recent in this 1999
  publication): **"Coastal and downtown visibilities have improved since the 1960's, although
  recently there has been little change. Inland valley location visibilities steadily
  deteriorated."** Coastal visibility correlates most with humidity; inland visibility correlates
  more with nitrates/sulfates — this detail was already captured secondhand in
  `RESEARCH_LA_WORLDBUILDING.md` §8(a)'s fragments and is confirmed directly here.

**The finding that actually matters for `Sky.js`, not just the raw numbers:** even the *worst*
historical downtown figure recovered here (7.9 miles ≈ **12.7 km**, 1969) and the *low-visibility*
regulatory threshold (3 miles ≈ **4.8 km**) are both **larger than this project's entire built world
(2,048–4,096 m, i.e. 2.05–4.1 km at the far corner)**. In other words: **real LA visibility, even on
a bad smog day by historical standards, would not produce visible atmospheric fog anywhere inside
this game's world extent** — the world is simply too small for literal LA haze physics to be the
thing that determines the fog-far distance. This means `RESEARCH_LA_WORLDBUILDING.md` §9.5's
placeholder numbers ("haze onset ~1,200 m, saturating ~6,000 m") were never going to be a literal
mile-to-meter conversion of real visibility data, and **should be understood and documented as a
deliberate stylization choice for depth cueing and to hide the far clip plane, not as "the
researched LA visibility number translated to meters."** That reframing is this document's actual
answer to R1: **the precise question the brief asks ("does it translate into Three.js `Fog`
near/far distances for a 2,048–4,096 m world") has a real answer, and the answer is "no, not
directly — the world is smaller than real LA's visual range even in bad conditions, so fog
near/far should be tuned as an art-direction/gameplay-visibility parameter, informed by mood
(marine layer, golden-hour haze) rather than derived from mileage."** The one place the real data
*does* transfer directly: `RESEARCH_LA_WORLDBUILDING.md` §6.3's marine-layer numbers (base below
~760 m / 2,500 ft, thickness 30–1,500 m) are geometrically comparable to this world's *vertical*
extent (Mt Lee analog at 521 m, DTLA towers to 335 m) and remain a genuinely sourced, usable
set-piece — "the marine layer buries the observatory and leaves the [hill landmark] in sunlight
above the deck" is real, filmable-scale atmosphere, unlike the horizontal haze-distance numbers.
Fog color, at least, should still track the day/night cycle per §A5's guidance — this closes the
*mechanism*, not the *specific near/far numbers*, which remain a tuning pass (§8).

### ATM-5 — `Sky.js`'s current fog is explicitly a Phase 1 placeholder, confirmed in its own code comment **[MEASURED]**

`kodaman3d/src/world/Sky.js` line 68: `scene.fog = new THREE.Fog(hazeColor, 120, 900);`, with a
code comment at line 64 stating plainly these are *"a fixed Phase 1 placeholder, not researched
atmospheric truth."* This matches — Phase 1's 300 m playable square makes a 120–900 m fog range
generous rather than binding. `tuning.js`'s `CAM_NEAR`/`CAM_FAR` are currently `0.1`/`2000`
(confirmed directly), **not yet raised to the `Renderer.js`-anticipated 0.3–0.5 / 8,000–12,000
range** — `Renderer.js`'s own comment already documents this exact seam ("Phase 2's larger world
must raise `near` to ~0.3–0.5 alongside a far plane of 8–12 km... a documented z-fighting trap").
Nothing here contradicts the plan; this is a confirmation that the seam is real and still open, one
of the concrete one-line `tuning.js` edits Phase 2 needs to make.

---

## 5. Floating origin — needed now, or insurance for later?

### ORG-1 — At 2,048–6,144 m, floating origin buys essentially nothing for coordinate precision **[SOURCED, re-verified against the confirmed math]**

`RESEARCH_LA_WORLDBUILDING.md` §9.4's own table is unambiguous and this pass re-checked the
arithmetic rather than just trusting it: at a ±2,048 m half-extent, worst-case float32 precision at
the far corner is **0.12 mm**; at the ±3,072 m hard-ceiling half-extent it is **0.18 mm**. Both are
"vastly more than adequate" by the source's own characterization, and both are far inside the
documented practical edge (~1 mm, reached only around ±16,384 m). **This project's entire planned
growth path — 2,048 m built target up to a 6,144 m hard ceiling — never approaches a regime where
floating origin is solving a real coordinate-precision problem.** Restated plainly: if the only
justification for `FloatingOrigin.js` were numeric precision, the correct recommendation would be
"skip it, at any size this project will realistically reach."

### ORG-2 — The one real justification is skinned-mesh degradation, which is explicitly Phase 5's territory, not this run's **[SOURCED, with an honest gap]**

`RESEARCH_LA_WORLDBUILDING.md` §9.2 flags, separately from the general float32-jitter story, that
*"skinned/bone models exhibit unique deformation problems at large coordinates that standard fixes
do not address... a superhero character is a skinned mesh. If the player model deforms at
distance, this is the cause."* This is the actual reason floating origin is in the Phase 2 plan at
all — not world geometry precision, but insurance against the hero (and, later, companions/enemies)
visibly deforming once they carry Phase 5's glTF skeletal rig instead of Phase 1's primitive meshes.
**This is a genuine gap this pass could not close, and is being stated as a gap rather than papered
over:** the source material describes the *existence* of the skinned-mesh problem but does not give
a distance threshold independent of the general ~200,000-unit jitter figure — it is unclear whether
bone-matrix precision degrades at the same coordinate magnitude as vertex jitter, or earlier (the
source's own phrasing — "suggesting shader-level precision loss during bone calculations" — reads
as a hypothesis, not a measured threshold). **Skinned characters do not exist yet in this codebase**
(Phase 1/current Phase 2 scope is primitive meshes only), so there is nothing to test this against
today, and skeletal animation is explicitly out of scope for this run. This is exactly the kind of
finding that should be handed to run 2 rather than guessed at here.

### ORG-3 — Recommendation: cheap prep now, full mechanism deferred **[ESTIMATE]**

Given ORG-1/ORG-2, the recommendation is not "build `FloatingOrigin.js` in Phase 2" nor "ignore it
entirely" — it is a split:

- **Do now, at effectively zero cost:** the architectural habit already recommended in §STR-1 —
  `Chunk.js` (and, by extension, the hero/camera state) should keep a clean separation between
  **chunk-local/entity-local geometry** and **the `Vector3`/`Group.position` that places it in world
  space**, rather than baking a single absolute world position into vertex data or deeply-nested
  transform chains. This is good practice independent of floating origin and costs nothing extra to
  do from Phase 2's first `Chunk.js` commit — retrofitting it after content exists is real,
  avoidable rework.
- **Defer the actual re-centering mechanism** (the runtime logic that shifts a world-root
  `Group.position` and rebases every loaded object when the hero crosses a distance threshold from
  the current origin) **to Phase 5, gated on an actual test against real skinned meshes** at the
  built world's real coordinate range. If Phase 5's glTF hero shows no visible deformation at
  ±1,024–3,072 m (plausible, since even the general jitter threshold is roughly 100× further out),
  floating origin may not be needed even then, and building it in Phase 2 against a problem that
  might not materialize would be speculative engineering — the exact anti-pattern
  `RESEARCH_FINDINGS.md` §D1 warns solo-dev-with-agent projects against (scope, not skill, is the
  dominant failure mode).
- **Cost to retrofit later, if the §STR-1 habit is followed now:** moderate, not severe — the
  re-centering trigger itself is a bounded, well-precedented pattern (shift one root group's
  position, iterate loaded chunks/entities to rebase their local positions, update the camera and
  any lights/shadow cameras whose frustums are defined in world space, e.g. CSM's per-cascade
  shadow cameras per §ATM-3). The part that would be **expensive** to retrofit is exactly the part
  §STR-1 proposes doing for free right now: if `Chunk.js` bakes absolute world coordinates into
  geometry from day one, adding floating origin later means re-authoring how every chunk stores its
  content, not just adding a re-centering function.

---

## 6. The draw-call and triangle budget

### BUD-1 — The baseline, restated precisely, both passes, test-pinned **[MEASURED]**

`renderer.info.render.calls` accumulates across **both** the shadow pass and the main pass —
confirmed directly against the installed `WebGLRenderer` source (`info.reset()` runs, then
`shadowMap.render()`, then the main render, all before the counter is read; every shadow-casting
object costs a second draw call). Phase 1's worst case, nothing culled, is:

| | Main pass | Shadow pass | **Total** |
|---|---:|---:|---:|
| Ground & road (7) + buildings (10) + street furniture/realism (8) + hero (7) + sky (0) | **32** | **25** | **57** |

`tests/world.test.js`'s `describe('worst-case draw calls')` asserts this exact split
(`inv.main.length === 32`, `inv.shadow.length === 25`, `inv.total === 57`) against a real scene
graph walk, not a manual count — it fails loudly if a future change adds an uncounted draw call.
**Every figure in this section is a both-pass total unless explicitly marked otherwise, per the
orchestrator's ruling; the main/shadow split is always shown alongside.**

### BUD-2 — The single biggest budget risk: naively repeating Phase 1's per-block pattern once per chunk **[ESTIMATE, but the arithmetic is exact given the stated assumption]**

This is the most important finding in this section, and it is not in any prior document. Phase 1's
"ground & road: 7" line item (`ground`, `roadway`, 2×sidewalk, 2×curb, `centreline`) is **7 separate
`Mesh`/`InstancedMesh` objects for one ~300 m block.** If `Chunk.js` is built by literally
instantiating this same pattern once per 256 m chunk — which is the naive reading of "generalize
`StreetBlock.js` into `Chunk.js`" — a fully-loaded 8×8 = 64-chunk built-target world would cost
**7 × 64 = 448 draw calls from ground/road geometry alone**, before a single building or prop is
counted, an order of magnitude over any sane ceiling. **This is the one place where "per-chunk"
must not mean "one `StreetBlock`'s worth of separate meshes, repeated."** Ground and road surfaces
must be merged or instanced *across* chunks within a district — a handful of large tiled ground
meshes (or one `BatchedMesh` per surface type: asphalt, sidewalk, curb) covering many chunks' worth
of area, with per-chunk *content* (buildings, props) still individually streamable on top. This
reframes `Chunk.js`'s actual job: it is not "a `StreetBlock` at 256 m instead of 300 m," it is "a
data window into district-shared render batches, plus its own colliders and its own load/unload
lifecycle." Getting this wrong is the most likely way Phase 2 blows the draw-call budget, and it is
a design decision to get right in `Chunk.js`'s first draft, not a later optimization pass.

### BUD-3 — Buildings must move from one-`Mesh`-per-building to a shared per-district `BatchedMesh`, or the budget cannot close **[ESTIMATE, arithmetic shown]**

Phase 1's buildings cost **1 main-pass call per building** (10 buildings → 10 calls, confirmed in
§BUD-1's table), because each is a plain `Mesh`. A plausible two-district Phase 2 building count —
not researched as a hard number, but a reasonable planning figure given the district sizes discussed
in §7 — is on the order of 30–50 buildings per district. At Phase 1's one-`Mesh`-per-building rate,
**2 districts × 40 buildings × 2 passes (most casting shadows) ≈ 160 draw calls from buildings
alone** — already over a 150-total ceiling before ground, props, hero, or CSM overhead are counted.
**This is the concrete, costed reason §DEN-2/§LOD-3's `BatchedMesh` recommendation is load-bearing,
not a nice-to-have:** grouping buildings into a small number of `BatchedMesh` instances by facade
material family (e.g. 3–4 families — glass tower, stucco low-rise, ornate theater district, per
§6.5's typologies) per district, with individual buildings added/removed as `BatchedMesh` instances
during chunk load/unload (the API supports this — `addInstance`/`setGeometryAt`, confirmed present
in §LOD-2), keeps building draw-call cost at **roughly one call per facade-family per district,
regardless of how many individual buildings exist or how many chunks are loaded** — call it
3–4 families × 2 districts × 2 passes ≈ **12–16 calls total**, a >10× reduction versus the
one-`Mesh`-per-building approach at the same building count.

### BUD-4 — `InstancedMesh`'s fixed-count-at-construction constraint is in real tension with per-chunk streaming, and needs a resolved answer, not a re-statement of the API **[ESTIMATE]**

`RESEARCH_FINDINGS.md` §A3 states plainly: `InstancedMesh` count is "fixed at construction —
resizing means building a new InstancedMesh." This is fine for Phase 1 (one block, built once,
never streamed) but is a real design problem for Phase 2's props (palms, lamps, parked cars, etc.,
per §DEN-4/§DEN-7): if chunks stream in and out, the set of "currently needed" prop instances
changes continuously, and rebuilding an `InstancedMesh` (and its shadow-casting registration) on
every chunk load/unload defeats the point of using it. **Two resolutions, with their real costs,
neither currently specified in the plan:**

1. **Over-allocate at district scale, toggle via degenerate transform.** Build each prop category's
   `InstancedMesh` once, sized to the district's worst-case total instance count (all chunks loaded
   simultaneously), and for unloaded chunks' instances, set their matrix to a zero-scale/far-away
   transform via `setMatrixAt` rather than truly removing them. Cost: the instance buffer (and the
   GPU's per-instance vertex-shader invocations, even for degenerate ones — modern GPUs do not skip
   zero-scale instances for free, though the fragment cost is near-zero once culled by the
   rasterizer) is sized for the *worst case*, not the *typical loaded set*, which is a small,
   bounded memory cost at this project's scale (a district's total prop count, per §DEN-4/§DEN-7,
   is plausibly in the low hundreds, not thousands) but real developer discipline to keep bounded
   as content grows.
2. **Use `BatchedMesh` for streamed props too, not just buildings.** Since `BatchedMesh` supports
   genuine dynamic `addInstance`/instance removal (confirmed present in the installed source per
   §LOD-2), it sidesteps the fixed-count problem entirely, at the cost of inheriting the maturity
   caution already flagged (#32741, buffer bookkeeping after repeated add/remove +
   `optimize()` cycles) — worth real QA attention if chosen, precisely because chunk streaming is
   exactly the "repeated add/remove churn" pattern the open issue warns about.

**Recommendation: option 1 (over-allocate, toggle) for Phase 2**, since it uses the better-proven
`InstancedMesh` API and this project's per-district instance counts are small enough that the
memory cost is not a real constraint — but this is an ESTIMATE-level judgment call given neither
option has been built or measured here, and should be revisited if `Instancing.js`'s actual counts
turn out larger than assumed.

### BUD-5 — CSM's shadow-pass cost is a genuine open multiplier on this budget, not yet quantifiable **[cross-reference to §ATM-3, restated here because it is load-bearing for this section's total]**

§ATM-3 established that each CSM cascade is a real, separate `DirectionalLight` with its own shadow
camera, and that objects straddling cascade boundaries can be drawn into the shadow pass more than
once. **This section's total below is stated *before* that overhead**, because it cannot be
estimated responsibly without building `CSM.js` and measuring — any number offered here would be
exactly the "confident prose that is actually a guess" failure mode the brief warns against.

### BUD-6 — A derived working ceiling, replacing `IMPLEMENTATION_PLAN.md`'s "under 150" placeholder **[ESTIMATE, full arithmetic shown for re-derivation]**

Building up from fixed, known, and estimated components, both passes combined:

| Component | Main | Shadow | Total | Basis |
|---|---:|---:|---:|---|
| Hero | 7 | 7 | 14 | **[MEASURED]** — unchanged from Phase 1, carries forward |
| Sky (lights + background, no skybox mesh) | 0 | 0 | 0 | **[MEASURED]** — unchanged, pinned by a Phase 1 test per `KNOWLEDGE_BASE.md` §2 |
| Ground/road, merged per district (§BUD-2's fix applied) | ~10–16 | 0 | ~10–16 | **[ESTIMATE]** — a handful of large tiles/`BatchedMesh` per surface type per district, ×2 districts; road surfaces don't cast per Phase 1's own pattern |
| Buildings, `BatchedMesh` by facade family (§BUD-3) | ~6–8 | ~6–8 | ~12–16 | **[ESTIMATE]** — 3–4 families × 2 districts × 2 passes |
| Instanced props, district-shared pools (§DEN-4/§DEN-7/§BUD-4) | ~15–18 | ~12–15 | ~27–33 | **[ESTIMATE]** — 15–18 categories, most casting shadows |
| One terrain/hill landmark feature (§DEN-5/§DEN-6) | ~2–4 | ~2 | ~4–6 | **[ESTIMATE]** |
| **Subtotal, before CSM overhead** | **~40–53** | **~27–32** | **~67–85** | |

**Recommended working ceiling: 150, both passes combined, stated explicitly as covering both
passes** — which leaves roughly **65–85 calls of headroom over the itemized estimate above**, sized
specifically to absorb §BUD-5's unquantified CSM multiplier, this pass's own acknowledged estimate
error (every line above is [ESTIMATE], not measured), and normal content growth as districts are
authored in detail. This is **numerically close to the plan's original placeholder but for a
different, now-stated reason**: it is not "150 main-pass calls as a guess," it is "150 both-pass
calls as a working target with ~70 calls of explicit, itemized headroom over a from-first-principles
estimate, re-verifiable the same way `tests/world.test.js` pins 57 today." **This number should be
converted into a real test once `ChunkManager.js`/`District.js`/`CSM.js` exist** (a worst-case
scene-graph walk with a district fully loaded, mirroring `tests/world.test.js`'s method exactly),
at which point it stops being an estimate and either confirms or corrects this figure — this
document's ceiling is a **starting budget to build against, not a verified result.**

### BUD-7 — Triangle budget: not independently re-measured this pass, but nothing found changes the existing ~500,000 figure **[SOURCED, with an honest gap]**

`RESEARCH_FINDINGS.md` §A4's whole-scene ceiling of ~500,000 triangles for broad compatibility
(desktop-integrated-GPU inclusive) is not challenged by anything found in this pass. What this pass
could **not** produce: a measured *current* total triangle count for Phase 1's scene (only deltas
are documented — e.g. the realism pass's +528 triangles for 8 draw calls, per
`ENGINEER_PHASE1_CLOSE.md` — not a running total; getting the true baseline requires reading
`renderer.info.render.triangles` from a live browser session, which this research pass, confined to
static code/doc reading, cannot do). Every geometry addition proposed in §3 and this section (§DEN-2's
building massing kit at ~60–100 tris/building, §DEN-5's subdivided ground at ~512 tris/chunk) is
small enough relative to the 500,000 ceiling that this gap does not block a recommendation — but the
true baseline should be captured (via `DebugHud`'s existing live readout, already wired per
`KNOWLEDGE_BASE.md` §2) the first time `Chunk.js` renders anything, so triangle growth has a real
starting point rather than an assumed one.

---

## 7. District recommendations and the remaining open questions

### DIS-1 — What Phase 1's shipped block actually is, read from the code, not assumed **[MEASURED]**

Before recommending districts, it matters what asset kit already exists to build from. Read
directly from `StreetBlock.js`'s `BLOCK.buildings` data (line 103 on) and its own header comment
("...correct template for an iconic LA boulevard"): Phase 1's one block is **not** a uniform tower
cluster. It mixes three building classes — `lowrise` (8–12 m), `midrise` (24–33 m), and `tower`
(64–90 m) — 10 buildings total, deliberately varied. This means Phase 1 has already built and
browser-verified (per `KNOWLEDGE_BASE.md` §2's envMap spot-check) **two different reusable asset
classes at once**: a tower-with-glass-palette-and-helipad kind, and a lowrise/midrise
stucco-and-signage kind. Both district recommendations below are chosen specifically to let each
class generalize into its own district rather than staying mixed, which is a lower-risk path than
authoring two entirely new building classes from nothing.

### DIS-2 — Recommendation: a DTLA-style tower-plateau district, paired with a Hollywood-Blvd-style mixed boulevard corridor **[ESTIMATE — a proposal, not a decision; the user approves per locked decision 6's naming-authority principle applied here]**

**District A — a dense, uniform tower-plateau district on the rotated historic grid.**
`RESEARCH_LA_WORLDBUILDING.md` §3.1 describes the real reference precisely: "a cluster of ~10
towers in the 210–335 m band... a *plateau*, not a spire," one architectural generation (flat,
dark-glass-and-stone boxes), with §3.3's flat-roof/helipad ordinance giving every tower a legible,
landable roof — exactly the geometry Phase 1's `tower` building kind and its already-built
parapet-ring/helipad-atlas work (per `KNOWLEDGE_BASE.md` §6's roof-fix history) were built for.
Recommend this district be **narrower in height variety than Phase 1's mixed block** — mostly
`tower`-class buildings, few or no `lowrise` — specifically to read as the "plateau" §3.1 describes,
which Phase 1's own mixed block currently does not attempt.

**District B — a mixed-height boulevard corridor on the cardinal grid**, using the Hollywood Blvd
Walk of Fame corridor as the real-world yardstick (§5.4: 1.3 mi real length, 15 blocks + 3 on Vine,
~460 ft/block). This directly generalizes Phase 1's `lowrise`/`midrise` building classes and its
already-built awning/blade-sign instancing (the same mechanism §5.5 documents for Broadway's
marquees — the code doesn't care which street it's simulating, the geometry is the same kind of
object).

**Why this pairing over the plan's own placeholder (Historic Core/Broadway + Hollywood Blvd, both
on the Ord grid):** `RESEARCH_LA_WORLDBUILDING.md` §6.4 documents a specific, sourced, and free
piece of visual differentiation this pairing captures and the plan's placeholder does not — *"around
the equinoxes the setting sun aligns down the east–west boulevards [cardinal grid]... but the DTLA
core is rotated 36°, so the same sunset rakes DTLA streets at an angle instead. The two grids light
differently at the same hour."* Pairing a rotated-grid tower district with a cardinal-grid boulevard
gives genuine street-orientation contrast, not just a height-class difference, and directly serves
`DayNightCycle.js`'s work (§ATM-1) — the day/night system gets a visibly different result in each
district for free, at the same in-game time, with no per-district special-casing beyond grid
rotation that the district data already has to specify anyway.

**The alternative seriously considered and set aside: Historic Core/Broadway instead of Hollywood
Blvd for District B.** Broadway's landmark density is higher per block (§5.5: 12 theatres in 6
blocks, "2 marquees per block, both sides" — denser than Hollywood's more linearly-spread 2,840
stars over 1.3 mi), and its defining visual feature (marquees/blade signs) is **already the exact
thing Phase 1 built** (`_buildBladeSigns()`, confirmed in code), arguably even lower authoring risk
than Hollywood's un-built terrazzo-star sidewalk treatment and its unresearched signature landmark
(the Chinese Theatre analog — §8(c) of `RESEARCH_LA_WORLDBUILDING.md` confirms this was never
researched). **Historic Core loses only on the grid-contrast point** — it shares DTLA's 36°
rotation, so pairing it with District A above sacrifices the free day/night differentiation. **This
is a real trade-off, not a clear-cut call**, which is exactly why this is a proposal for the user to
weigh in on, not a settled recommendation: if landmark density and lower authoring risk matter more
than grid-orientation contrast, Historic Core/Broadway is the stronger District B. If it does not
get chosen now, it is a strong candidate for `IMPLEMENTATION_PLAN.md`'s later "second district's
remaining detail pass" (Phase 6) or a third district if the world later grows toward the 4,096 m
figure.

**Naming note, consistent with the binding constraint list:** everything above describes districts
by real-world type and geography, per the "no invented proper nouns for in-game places" rule this
document follows throughout. Actual in-game district names are a separate, later decision under
locked decision 6 (agents propose, user approves) — not addressed here.

### DIS-3 — World edge behavior: recommend combining the two cheapest options, not choosing one **[ESTIMATE]**

Three options, costed:

1. **Hard collision wall** (what Phase 1 does today at 300 m). **Cost: effectively zero** — the
   exact same four-`Box3` boundary mechanism in `Collision.js` (confirmed: `boundaryBoxes()`
   already pushes through the identical capsule-resolution code path as buildings, "no special-cased
   boundary logic") just needs its extent moved from 150 m to 1,024 m. Con: for a flying hero in a
   world explicitly sold as "vast and explorable," hitting an invisible wall reads as arbitrary and
   undercuts the feeling the whole density pass (§3) is trying to build.
2. **Soft atmospheric fade.** Reuse the existing `Fog` mechanism, but drive `near`/`far` (or a
   separate radial haze parameter) from the hero's **distance from world center**, not just depth
   from camera — as the hero approaches the boundary, visibility shortens toward a whiteout/haze-out
   well before the true edge. **Cost: low-to-moderate** — no new rendering system, just a per-frame
   tuning-value computation (already the exact kind of thing `Sky.update()` does every fixed step
   per `KNOWLEDGE_BASE.md` §5's `ENV_INTENSITY` precedent) feeding the existing `Fog` object. This
   is also the option most consistent with §ATM-4's finding: fog in this project was already
   established as a stylization tool, not a literal-visibility simulation, so using it for edge
   discouragement is the same tool doing double duty, not a new mechanism.
3. **Boundary-triggered transition** (a "you've left the mapped area" message/fade). **Cost: real
   and not free** — this needs UI infrastructure (`DialogueUI.js`-adjacent presentation work) that
   is not scheduled until Phase 4, so building it in Phase 2 pulls Phase 4 work forward for a
   Phase 2 feature, which `IMPLEMENTATION_PLAN.md`'s own phase sequencing argues against.

**Recommendation: combine 1 and 2, not choose between them.** Keep Phase 1's existing hard-wall
collision code unchanged in mechanism (§1's cost, effectively zero — it's a proven code path) but
placed at the true boundary, while tuning the soft atmospheric fade (§2) to reach full whiteout
**well before** the hero could ever visually or physically reach that wall. The result: a player
who flies toward the edge experiences shortening visibility and a discouraging haze-out, and in
practice never perceives the underlying hard wall as a wall — it exists only as an unreachable
safety net behind fog thick enough that the collision is never the player's actual experience. This
gets the "vast and explorable but bounded" feel locked decision 8 requires, at close to the combined
cost of the two cheapest options individually, with no new system.

### DIS-4 — R2 (LA block dimensions): substantially advanced this pass, with a clear implication for chunk size **[SOURCED, primary/secondary sources now examined]**

Two new sources were fetched this pass that `RESEARCH_LA_WORLDBUILDING.md` §8(b) had flagged as
unexamined:

- **The Ord survey (1849), the "unconfirmed lead," now confirmed via direct fetch of the Homestead
  Museum's article:** *"Blocks were to be, respectively 112 and 200 yards long,"* corresponding to
  two different street-width zones (75 ft streets in the southwest survey area, 60 ft streets
  toward the hills). **112 yards = 336 ft ≈ 102 m; 200 yards = 600 ft ≈ 183 m** — this is a direct
  unit conversion (yards, not varas, so the vara-length ambiguity the earlier document worried about
  does not actually apply to the block-length figure itself, only to the separately-cited lot size,
  "40 *varas* wide and 56 deep," which is a different number). **This confirms the historic
  Ord-grid/DTLA-core block length at ~102–183 m**, consistent with (and now a primary-source-backed
  upgrade of) the existing cross-check from §5.4 (Hollywood Blvd, ~140 m/block, though that street
  is on the cardinal grid, not the Ord grid).
- **LAMC §17.05 (subdivision design standards), the "unexamined primary source"**: a direct
  `WebFetch` of the code page itself returned HTTP 403 (blocked), so this could **not** be confirmed
  by first-hand reading of the primary text — **flagged honestly as a search-engine-synthesized
  answer, not a verified primary-source read**: search results converge on **residential/industrial
  blocks capped at 1,700 ft (≈518 m), commercial blocks capped at 800 ft (≈244 m)** unless the
  prevailing nearby block length is shorter. **This is a regulatory ceiling for new subdivisions,
  not a measurement of typical existing block length** — conflating the two would repeat exactly the
  kind of confident-but-wrong inference this document is trying to avoid. The suburban "typical"
  figure remains genuinely unconfirmed beyond the original tertiary blog estimate (~300–350 ft /
  91–107 m), which happens to sit well inside the regulatory ceiling and is therefore still
  plausible, just not verified.

**The implication for chunk size, which `RESEARCH_LA_WORLDBUILDING.md` §9.5 itself said to revisit
once this closed:** at 256 m chunks, the confirmed dense-grid figures (~102–183 m historic Ord
blocks, ~140 m Hollywood cross-check) give **roughly 1.4–2.5 blocks per chunk** — squarely inside
the "roughly 2 LA blocks plus their streets" reasoning §9.5 used to pick 256 m in the first place.
**No change to the 256 m chunk size is warranted by this closure** — it holds up under the now
better-sourced numbers rather than being undermined by them. The suburban/low-density figure, even
taken at its unverified tertiary estimate, does not push the other direction either. **This closes
R2's practical question (does it affect chunk sizing) even though the underlying number itself is
not 100% primary-source-confirmed for the suburban case** — the honest state is "confirmed enough to
validate the existing decision," not "definitively researched to a primary source in every case."

---

## 8. What I could not answer

Listed honestly rather than papered over, per the brief's explicit instruction. Distinguished from
§7's user-facing decisions (district choice, edge behavior) — those are *answered with a
recommendation*, awaiting approval, not gaps. These are genuinely unresolved.

1. **CSM's real shadow-pass draw-call cost (§ATM-3/§BUD-5).** Established *why* it can exceed a
   naive single-light estimate (per-cascade `DirectionalLight`s, independent frustum culling per
   cascade), but not *by how much* for this project's actual geometry. Requires building `CSM.js`
   and reading `renderer.info.render.calls` against it — not answerable from source code or docs
   alone. This is the single most consequential unknown for §6's budget figure.
2. **Skinned-mesh coordinate-precision degradation threshold (§ORG-2).** The source material
   describes the problem's existence but not a distance threshold independent of the general
   float32-jitter figure. No skinned mesh exists in this codebase yet to test against. This is
   explicitly handed to run 2 / Phase 5, not answered here.
3. **Phase 1's current total triangle count (§BUD-7).** Only deltas are documented in prior
   handoff docs; the true baseline requires reading `DebugHud`'s live counter in a running browser
   session, which a static-code-reading research pass cannot do. Does not block this document's
   recommendations (the additions proposed are all small relative to the ~500,000 ceiling) but
   should be captured as a real number early in Phase 2 implementation.
4. **`CollisionWorld`'s linear-scan performance at realistic multi-chunk box counts (§STR-4).**
   Reasoned from the existing code's own stated philosophy and back-of-envelope arithmetic
   (hundreds to ~1,300 boxes, tens of thousands of comparisons/second at 60 Hz), not benchmarked.
   Should be spot-checked once `ChunkManager.js` produces real box counts.
5. **`BatchedMesh` issue #32741 (buffer bookkeeping after repeated add/remove + `optimize()`)
   under this project's actual streaming churn pattern (§LOD-2/§BUD-4).** Confirmed the method
   exists and is implemented in the installed version by reading source; did not exercise it at
   runtime against the specific reported failure mode, because doing so would require writing and
   running code, which this research pass does not do.
6. **LAMC §17.05's exact text (§DIS-4/R2).** Direct `WebFetch` of the code library page returned
   HTTP 403 both for the URL cited in the earlier document and for the URL found via search this
   pass. The 1,700 ft / 800 ft figures reported come from a search-engine synthesis of the page's
   content, not a first-hand read of the primary source. A different access method (a cached
   mirror, a PDF version, or a browser session with different headers) might close this fully; not
   attempted further in this pass once the search-synthesized answer was judged good enough to
   validate the chunk-size decision (§DIS-4's actual point of need).
7. **Typical (not maximum-allowed) suburban/cardinal-grid block length.** LAMC §17.05 gives a
   regulatory ceiling for new subdivisions, not a measurement of what most existing suburban blocks
   actually are. The only figure for that remains the original tertiary blog estimate
   (~300–350 ft), not independently verified this pass.
8. **Per-district building/prop counts (§BUD-3/§BUD-6's "30–50 buildings per district," "15–18 prop
   categories").** These are planning assumptions used to make the draw-call arithmetic concrete
   and re-derivable, not researched figures — no source gives an authoritative building count for
   an as-yet-unauthored invented district. Flagged inline at first use as [ESTIMATE]; restated here
   because the entire §6 budget total inherits this uncertainty.
9. **Whether a 4-minute day/night cycle (ported unchanged from the 2D game, §ATM-1) is the right
   real-time length for a 3D flight game covering much more traversal distance per minute than the
   2D top-down game did.** A feel decision; not something a research pass can settle without
   playtesting.
10. **Queen palm heights and per-species street-tree percentages** (`RESEARCH_LA_WORLDBUILDING.md`
    §8(d), inherited). Not attempted in this pass — not load-bearing for any recommendation made
    here (§DEN-7's vegetation-variety argument holds with the three already-confirmed palm species
    alone), so this pass did not spend budget chasing a number that would only refine, not change,
    an already-supported recommendation.

---

## Summary of what needs a user decision

Consolidated from throughout this document, so the orchestrator has a single list to carry forward:

1. **Which two districts** (§DIS-2) — recommendation given (DTLA-style tower plateau + Hollywood-
   Blvd-style boulevard corridor), with an honestly-argued alternative (swap in Historic Core/
   Broadway for the boulevard district) that trades grid-orientation contrast for landmark density
   and lower authoring risk.
2. **World edge behavior** (§DIS-3) — recommendation given (hard wall retained as a never-reached
   safety net, fronted by a soft atmospheric fade tuned to whiteout well before it).
3. **Day/night cycle length** (§ATM-1, restated in §8.9) — not a technical question; needs a feel
   call, informed by playtesting once `DayNightCycle.js` exists.
4. **`InstancedMesh` vs `BatchedMesh` for streamed props** (§BUD-4) — a recommendation is given
   (over-allocate `InstancedMesh` at district scale) but flagged as revisable once real per-district
   instance counts exist.

---

*End of Phase 2 Research, Run 1 of 2. Run 2 (skeletal animation, character rigging, glTF assets,
the "character not human enough" feedback) is a separate agent, reading this document as prior
context once the user has reviewed it.*


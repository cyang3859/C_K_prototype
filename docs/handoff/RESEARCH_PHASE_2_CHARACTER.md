# Phase 2 Research — Character, Rigging, and Animation (Run 2 of 2)

**Written by:** the Phase 2 Research agent (Sonnet), session 6, 2026-08-01.
**Scope:** skeletal animation and rigging, the glTF asset pipeline, animation state machines/
blending/transitions, procedural/additive layers (IK, look-at, lean, cape), the hero's visual
redesign toward a "comic-accurate read," asset sourcing and licensing, and the draw-call/
performance consequences of all of it.
**Explicitly out of scope:** world geography, chunk streaming, LOD, day/night, fog, districts (run
1's territory, done — see `RESEARCH_PHASE_2_WORLD.md`). Combat/abilities (Phase 3). Quests,
dialogue, companions (Phase 4). The trademark naming table (a user decision, not a research
question).

**Precedence, inherited from `KNOWLEDGE_BASE.md`'s header and restated by run 1:** if this document
and an older doc disagree, this document is not automatically right — check the date and
reasoning. **If this document and the code disagree, the code wins**, and every place that happened
during this research is called out inline.

**Inherited from run 1, not re-litigated:** §BUD-6's draw-call ceiling (150, both passes, ~65–85
calls of headroom over an itemized estimate), §BUD-2's chunk reframing (ground/road must be merged
or instanced *across* chunks, not repeated per chunk), and §ORG-1/§ORG-2's floating-origin
reasoning (no coordinate-precision case at this project's scale; the only live justification is
skinned-mesh degradation, which run 1 could not assess because no skinned mesh existed yet). §7 of
this document picks that thread up directly, continuing run 1's `ORG-*` numbering rather than
starting a new one, since it is the same open question, not a new one.

## How to read the confidence labels

Every finding below is tagged with exactly one of:

- **[MEASURED]** — read directly from the installed code (`kodaman3d/src/`, the installed
  `three@0.185.1` package under `kodaman3d/node_modules/`, or a test that asserts the number).
  Most reliable; re-derivable by anyone with the repo.
- **[SOURCED]** — from a cited external document or a live web search performed during this pass
  (dated inline), itself reliable insofar as the source is. Distinguished from [MEASURED] because
  it describes someone else's system (a licence, an asset pack, a technique writeup), not this
  project's own code.
- **[ESTIMATE]** — this agent's judgment, extrapolation, or recommendation. Defensible reasoning is
  given, but it is not measured and not independently sourced. Treat as a starting position, not a
  settled number.
- **[GUESS, INHERITED]** — a number already flagged as a guess by an earlier document, carried
  forward unchanged because this run could not close it.

Findings are numbered by section prefix (`ASSET` sourcing/licensing, `RIG` the glTF/retargeting
pipeline, `ANIM` the animation system proper, `PROC` procedural/additive layers, `CAPE`, `ART` the
visual redesign, `DRAW` draw calls and skinning cost, `ORG` floating origin — continuing run 1's
numbering, `CLIP` authoring volume) so a later document can cite them by ID.

---

## 1. Asset sourcing and licensing

### ASSET-1 — The strongest available fit is Quaternius's Universal Base Characters, and it happens to already ship a "Superhero" proportion set **[SOURCED — live web search, 2026-08-01]**

`RESEARCH_FINDINGS.md` §C3 (an earlier research pass) already identified Quaternius
(`quaternius.com`) as the strongest free/CC0 humanoid source. Re-checked live rather than trusted
from that earlier pass: **Quaternius's Universal Base Characters pack ships six character models
across three proportion sets explicitly named "Superhero," "Regular," and "Teen" (male and female
each), CC0-licensed (public domain, no attribution required), free for personal/educational/
commercial use, delivered as .FBX and .glTF, rigged with a shared "Universal" humanoid skeleton
built for cross-engine retargeting.** This is a direct, unplanned hit against the brief's
"comic-accurate read" ask: a proportion class literally named for the genre already exists in the
candidate source, with exaggerated heroic proportions (broader shoulders, longer limbs) rather than
the anatomically neutral base mesh a generic "free rigged human" search would turn up. This is the
single most load-bearing finding in this section — it changes "find a rigged human and reshape it
toward comic proportions" (real modeling work) into "select the proportion variant already built
for this" (an asset-selection decision).

### ASSET-2 — The same source also ships the animation library, on the same rig — this is what actually de-risks the pipeline **[SOURCED — live web search, 2026-08-01]**

Quaternius's **Universal Animation Library** (120+ clips) and the newer **Universal Animation
Library 2** (2026, 130+ clips — melee/combat combos, parkour movement, locomotion, farming,
fishing, zombie locomotion) are both built on the **same** Universal rig as the base characters, CC0
licensed for personal/educational/commercial use. Because mesh and clips share one skeleton by
construction, **the retargeting problem `RESEARCH_FINDINGS.md` §A10 spent most of its length on
(bone-name mapping, T-pose/A-pose mismatch, scale correction) does not arise at all for this
specific mesh+clip pairing** — retargeting is a real cost only when *mixing* sources (a Quaternius
mesh driven by Mixamo clips, or vice versa), not when staying inside one vendor's matched kit. This
is a materially better starting position than `IMPLEMENTATION_PLAN.md`'s original Phase 5 plan
assumed, which treated Quaternius mesh + Mixamo animation as the default combination and budgeted
the full Mixamo normalization pipeline (§RIG-1 below) as necessary from the first clip.

**One caveat, not fully closed this pass:** the search result describing Universal Animation
Library 2 states *"60–70% of the pack being completely free"* without specifying which clips sit
outside that free tier or what the remainder costs. This reads as a possible free/paid split within
the pack (a newer, larger 2026 release monetizing part of its content), not a blanket CC0 claim
identical to the original library — **flagged as an open item in §9**, worth a direct visit to
`quaternius.com`/`quaternius.itch.io` before committing to which specific clips ship, rather than
assuming the entire 130+ count is free.

### ASSET-3 — Mixamo: still live and free, but explicitly unmaintained, and the terms matter for a public repo **[SOURCED — live web search, 2026-08-01]**

As of this pass (checked live, not from the earlier research document's mid-2026 snapshot): Mixamo
remains operational, its auto-rigger works, and both characters and animations are free for
unlimited personal/commercial use with no royalty — the one real restriction being that raw
character/animation files may not be repackaged and resold or redistributed as a standalone asset
pack or engine template (shipping them *inside* a finished game is explicitly fine). Adobe has
shipped no meaningful updates since acquiring it in 2015, Fuse (its companion character creator) was
discontinued and pulled from Creative Cloud in 2020, and community reports through 2025 describe
recurring outages with at least one support interaction suggesting Adobe considers it unsupported —
consistent with `RESEARCH_FINDINGS.md` §A10's "still operating... no meaningful updates" framing,
now reconfirmed roughly a year later rather than assumed stable.

**The repo-is-public point the brief raises is worth being precise about:** this project's practice
is to commit processed, normalized `.glb` output into a public repository
(`github.com/cyang3859/C_K_prototype`, public since 2026-06-14, per the brief) — that is closer to
"shipping the asset inside the project" than "reselling a standalone asset pack," and Mixamo's terms
are not violated by a public game repo containing its converted output. It is a **milder** tension
than a literal resale, but a genuinely public, permanently-archived git history of Mixamo-derived
`.glb` files is not a scenario Mixamo's terms were obviously written with in mind either — **this
is flagged, not resolved: it is not a clear violation, but it is also not unambiguously clean**, and
leaning on Quaternius (unambiguous CC0, no restriction of this kind) as the primary source per
ASSET-1/ASSET-2 sidesteps the question rather than needing to answer it. Recommend Mixamo be treated
as a **supplementary** clip source (extra locomotion variety, later phases' combat mocap) layered on
top of a Quaternius-primary pipeline, not the primary source `IMPLEMENTATION_PLAN.md`'s original
Phase 5 draft assumed.

### ASSET-4 — Kenney.nl: real, CC0, but the wrong aesthetic fit for the hero specifically **[SOURCED — live web search, 2026-08-01; consistent with `RESEARCH_FINDINGS.md` §C3]**

Confirmed live: all Kenney.nl asset packs are CC0/public domain, free for unlimited commercial use,
no attribution required. This is unambiguous and the cleanest possible licence of any candidate
here. But Kenney's character packs (Modular, Blocky, Roguelike, Platformer, Mini, Animated
Characters 3) skew toward simplified/blocky low-poly aesthetics built for stylized indie games in
general, not specifically toward the heroic-proportion, Mixamo-rig-compatible humanoid Quaternius
ships — **the fit is better for future crowd/NPC set-dressing (a genuinely large, cheap, license-
clean source of varied pedestrian meshes for a later populated-sidewalks pass, per run 1's §DEN-4
boundary note) than for the hero itself.** Recommend Kenney as the crowd/NPC candidate when that
work happens (explicitly out of this run's scope, per run 1 §DEN-4), not as a hero source.

### ASSET-5 — What this section recommends, stated plainly **[ESTIMATE, synthesizing ASSET-1–4]**

**Primary path:** Quaternius Universal Base Characters, "Superhero" proportion set, one mesh per
persona need (see §ART's persona-swap discussion) driven by Quaternius Universal Animation
Library/2 clips on the same shared rig — CC0, cross-engine, no retargeting step required for this
specific pairing, and the proportion class already matches the ask. **Supplementary path:** Mixamo,
for any specific motion the Quaternius libraries don't cover, accepting the retargeting cost
(§RIG-1) and the milder public-repo terms tension (ASSET-3) for those clips only. **Not
recommended for the hero:** Kenney (wrong aesthetic fit), reserved for future crowd work instead.

---

## 2. The glTF pipeline and rig-retargeting

### RIG-1 — The loader chain is confirmed present and current in the installed dependency, not assumed from docs **[MEASURED]**

Read directly against `kodaman3d/node_modules/three/examples/jsm/loaders/`: `GLTFLoader.js`,
`DRACOLoader.js`, and `KTX2Loader.js` are all present in the installed `three@0.185.1` tree,
consistent with `RESEARCH_FINDINGS.md` §A11's description of the settled glTF 2.0/Draco/KTX2
pipeline. This project's `package.json` currently lists only `three`, `lil-gui`, `stats.js`, `vite`,
`vitest` as dependencies (confirmed, also read directly) — none of the loader addons need a new
package install, since they ship inside the `three` package's `examples/jsm/` tree and are imported
by path (`three/examples/jsm/loaders/GLTFLoader.js` or the `three/addons/...` alias), not as a
separate npm dependency. Adding glTF character loading in Phase 2 is therefore an import-path
change, not a new dependency to vet or a version to pin.

### RIG-2 — Three.js ships a runtime retargeting utility, which changes the pipeline the earlier research assumed **[MEASURED]**

`RESEARCH_FINDINGS.md` §A10 describes only the offline path: export FBX from Mixamo, convert via
Blender or `FBX2glTF`/`gltf-transform` into a normalized GLB with a shared T-pose skeleton, *then*
load. Read directly against the installed source
(`kodaman3d/node_modules/three/examples/jsm/utils/SkeletonUtils.js`, 496 lines): the module exports
`retarget(target, source, options)` and `retargetClip(target, source, clip, options)` functions,
explicitly documented as retargeting a skeleton (or an `AnimationClip`) from a source rig onto a
target rig with a different name-mapped bone hierarchy, entirely at runtime, no external DCC tool
required. **This does not replace the offline pipeline for every case** — bone-count/hierarchy
mismatches, non-humanoid proportions, and scale correction still benefit from doing the messy part
once, offline, per §A10's documented Mixamo-specific gotchas (bone naming, T-pose/A-pose mismatch,
FBX scale bugs) — but for the ASSET-1/ASSET-2 Quaternius-only pairing, **retargeting is not needed
at all** (same rig), and for the ASSET-3 Mixamo-supplementary case, `SkeletonUtils.retargetClip()`
is a real, installed, zero-additional-dependency alternative to standing up a Blender step, worth
evaluating before committing to the heavier offline pipeline `IMPLEMENTATION_PLAN.md`'s original
Phase 5 draft assumed as the only option.

### RIG-3 — `CCDIKSolver` is present and is the IK mechanism the brief's scope line asks about **[MEASURED]**

`kodaman3d/node_modules/three/examples/jsm/animation/CCDIKSolver.js` (595 lines) is present in the
installed tree and exports `CCDIKSolver`/`CCDIKHelper`. This is a Cyclic-Coordinate-Descent solver —
iterative, per-joint, no external physics dependency — the standard lightweight choice for a small
number of IK chains (e.g. a look-at head/neck adjustment, a hand-to-ledge or hand-to-prop reach) as
opposed to a full analytic two-bone IK or a physics-based solve. See §PROC below for where this
project's FSM actually has a use for it (the honest answer is: less than it might seem, at Phase 2's
scope).

### RIG-4 — Where the pipeline lives relative to the Hero.js/LocomotionController.js split **[ESTIMATE, direct application of the binding constraint]**

Everything in this section — `GLTFLoader`, `AnimationMixer`, `SkeletonUtils`, `CCDIKSolver` — reads
and writes bone transforms, materials, and mesh geometry. All of it is **visual**, and per the
binding constraint, none of it may live in `LocomotionController.js` or read/write anything beyond
the same plain `hero.state` fields `Hero.js` already reads today (`velocity`, `flightActive`,
`state`, `pitch`, `facing`, `capeFlare`). Concretely: `Hero.js` (or a new sibling module it
constructs and owns, e.g. `entities/HeroAnimation.js`, still visual-side) should own the
`GLTFLoader` load, the `AnimationMixer` instance, the blend-space weight math (§ANIM below), and any
IK solver instance. `LocomotionController.js` should not gain a single new field or method for any
of this — the existing `hero.state` object is already sufficient input for every animation decision
this section proposes, which is itself evidence the seam holds without modification, not something
that needs to be re-argued from scratch.

---

## 3. The animation system: from the four-state FSM to `AnimationMixer`

### ANIM-1 — `AnimationMixer.update()` belongs in `fixedStep`, not `render` — and the reason is a hard project rule, not a style preference **[MEASURED, argued from the code]**

`core/Time.js`/`Game.js` (per `KNOWLEDGE_BASE.md` §3) run a fixed 1/60 s step; `render(time.alpha)`
does not currently interpolate on `alpha` — Phase 1 threads it through only as a seam. `tuning.js`'s
own header states every tunable constant assumes 60 Hz, and `TAKEOFF_STEPS = 12` (confirmed,
`tuning.js`) is expressed **in fixed steps**, not seconds-with-a-comment — the 0.2 s duration is a
consequence of the step count, not an independently authored time value. If `AnimationMixer.update()`
were called from `render()` with the actual wall-clock frame delta, animation playback would
decouple from the physics step and become framerate-dependent — exactly the property `Time.js`'s own
doc comment says the fixed step exists to prevent, and specifically it would desync a takeoff clip
authored to land its beats against a 12-step window from the actual 12-step window, since the two
would then run on different clocks. **`AnimationMixer.update(dt)` must be called once per owed fixed
step, with the same `dt = 1/60` `fixedStep()` already uses**, immediately alongside
`hero.syncTransform()`/`hero.update(dt)` in `Game.fixedStep()`'s existing step order
(`KNOWLEDGE_BASE.md` §3, step 4) — not a new step, an addition to the existing one.

**One real consequence for testability, stated honestly:** `AnimationMixer` requires a `THREE`
object graph (a `THREE.Object3D` root with bones) to operate on — unlike `LocomotionController.js`,
it cannot run in a headless `node` environment the way the 105 existing locomotion tests do. This
does not threaten the load-bearing seam (the FSM itself stays exactly as headlessly testable as it
is today, because nothing about the FSM changes), but it does mean **animation-specific behavior
(blend weights reaching the right values, transition timing) needs either a lightweight in-memory
`THREE.Skeleton`/`AnimationMixer` fixture in `environment: 'jsdom'` or `'node'` with a minimal WebGL
stub, or accepted as browser-verified-only** — this is a real, new gap in what's automatically
testable that Phase 1 did not have to solve, worth flagging to whichever agent scopes the actual
test plan.

### ANIM-2 — Mapping animation states onto the existing four FSM states, not inventing a fifth **[ESTIMATE, direct application of the brief's mapping instruction]**

Per the brief: the blend/transition design has to sit *on top of* `grounded`/`takeoff`/`flying`/
`landing`, not duplicate them. Concretely, per state:

- **`grounded`** — a continuous 1D blend space (idle ↔ walk ↔ run) driven by `Math.hypot(velocity.x,
  velocity.z)`, exactly the pattern `RESEARCH_FINDINGS.md` §A10 already describes
  (`walkAction.setEffectiveWeight(w)` / `runAction.setEffectiveWeight(1-w)` per frame on speed) and
  exactly the input `Hero.js`'s current `_animateLimbs()` already computes (`speed`) for its sine-
  wave procedural walk — the animation system's input signal is unchanged, only what consumes it
  changes.
- **`takeoff`** — scripted and **exactly** 12 fixed steps (0.2 s, `TAKEOFF_STEPS`, confirmed). This
  is a hard, known duration an animation can be authored exactly to, per the brief. But
  `_updateHorizontal` (§4 of `KNOWLEDGE_BASE.md`) runs unconditionally in every state including
  takeoff, so a player strafing during the scripted climb is still steering. **Recommend the takeoff
  clip be authored as a short additive "launch" layer** (torso/arm snap into the flight pose, timed
  to the existing `capeFlare` boolean the state already sets on entry) crossfaded on top of whatever
  grounded blend was already playing, rather than a full-body override `.play()` clip — an override
  clip would visibly fight steering input for the entire 0.2 s window, which is exactly the "reads
  as a canned cutscene" failure mode `LocomotionController.js`'s own doc comment warns about for
  *movement*, translated into animation terms.
- **`flying`** — its own idle-hover ↔ forward-cruise blend space on horizontal speed, mirroring
  `grounded`'s shape. **The existing two-term procedural body pitch (`KNOWLEDGE_BASE.md` §4) must
  stay exactly as it is and must not be duplicated inside an authored clip.** `state.pitch` is
  computed once by `LocomotionController._updateOrientation()` and applied once, to
  `bodyPivot.rotation.x`, in `Hero.js.syncTransform()` — a rigged replacement should apply that same
  value to the equivalent root/spine bone and nothing else should also be leaning the character.
  Author flight clips in a **neutral pitch pose** (arms-forward/legs-trailing per the settled B5
  silhouette, but with zero baked forward/backward lean) so the one procedural pitch write is the
  only source of lean, exactly preserving "orientation is visual only" and the two-term model's
  documented rationale (the original bug this two-term model fixed — flying fast and level reading
  as upright — was exactly a case of a lean signal not being applied where it needed to be; an
  authored clip re-introducing a second, competing lean signal is the same failure mode from the
  opposite direction).
- **`landing`** — the FSM's own transition rule (`landing → flying` is **level-triggered**, not
  edge-triggered, per `KNOWLEDGE_BASE.md` §4) is a direct animation-system requirement: the landing
  motion must be a **member of the same blend-space territory as `flying`**, interruptible by a
  normal crossfade back into the flying blend space at any point, not a committed `AnimationAction`
  played to completion. A `.play()`-and-wait-for-`finished` landing clip would mechanically prevent
  a player who is already holding the climb key from actually aborting the landing the instant they
  press it — the exact case the FSM's own comment calls out ("a player already holding W when they
  press G never commits to landing"). This is not a new rule invented for animation; it is the
  existing FSM rule read through to its animation-system consequence.

### ANIM-3 — Additive layers are a native `AnimationMixer` feature, confirmed in the installed source, not something to hand-roll **[MEASURED]**

`kodaman3d/node_modules/three/src/animation/AnimationAction.js` line 369 confirms `crossFadeTo(
fadeInAction, duration, warp )` is implemented and present (also `fadeIn`/`fadeOut`,
`setEffectiveWeight`, `setEffectiveTimeScale`); `AnimationMixer.js` line 557's `clipAction(clip,
optionalRoot, blendMode)` accepts a `blendMode` argument, and `AnimationUtils.js` (confirmed present)
exports `makeClipAdditive()`, converting a normal clip into one played with
`AdditiveAnimationBlendMode`. **This directly answers the Ghost-of-Tsushima "fluidity" ask with a
concrete, already-available mechanism rather than a new system to build:** most of what reads as
"fluid" in a AAA third-person action game is (a) long, generously-tuned crossfade durations between
locomotion states rather than hard cuts, and (b) additive layers (a turn-lean, an idle breathing
sway, a hit-reaction) riding on top of a single base locomotion clip instead of authoring a full new
clip for every combination of base motion × modifier. Both are stock `AnimationMixer` features in
the exact three.js version this project already depends on — no addon, no version bump, no new
dependency to vet.

---

## 4. Procedural/additive layers: IK, look-at, lean

### PROC-1 — Body lean is already solved and should not be re-solved as IK **[MEASURED, cross-reference to ANIM-2]**

The brief's scope line lists "lean" alongside IK and look-at as if it were an open technique
question. It is not, for this project specifically: `LocomotionController._updateOrientation()`
already computes the flight lean as a documented two-term model (speed-lean + fading vertical-lean,
`KNOWLEDGE_BASE.md` §4), and per ANIM-2 the rigged replacement's job is to **apply** that existing
value to a bone, not recompute lean via IK or a second procedural system. Listing this correctly as
"already solved, just needs re-plumbing" rather than "an open question" matters because it is easy
for an animation-system design to accidentally re-derive something the FSM already provides
correctly, producing exactly the double-lean bug PROC-1's sibling finding (ANIM-2) warns about.

### PROC-2 — Look-at (head/eye tracking) has a real use here, and `CCDIKSolver` is the right-sized tool for it **[ESTIMATE, grounded in RIG-3]**

A head/neck look-at toward the camera-forward direction (or toward a point of interest once Phase 3+
adds targets to look at) is the one IK use case that plausibly earns its cost at Phase 2: it is
cheap (a 1–2 bone chain, head + optionally neck), it directly serves "comic-accurate read" (a static-
faced character reads as a mannequin; a head that tracks even crudely reads as alive at a
distance, which is exactly the silhouette/readability register `RESEARCH_FINDINGS.md` §C1 argues
this project should be optimizing for over fine detail), and `CCDIKSolver` (RIG-3, confirmed present)
is sized correctly for a 1–2 joint chain rather than being overkill. **Recommend scoping IK to
head-look only for Phase 2** — a foot-IK system (planting feet correctly on sloped/stepped geometry)
is a much larger, per-surface-normal problem that this project's flat-ground-plus-buildings world
(run 1 §DEN-5's ground-relief proposal aside) does not yet have enough terrain variety to justify,
and the hero spends a large fraction of playtime airborne, where foot-IK is moot by construction.

### PROC-3 — What genuinely does NOT need IK, stated so it isn't scope-crept in **[ESTIMATE]**

The flight arm/leg silhouette (B5, `44df9fe`) is a **fixed pose**, not a reach target — it does not
need IK, because there is nothing in the world for the arms to reach toward; it is a costume/stance
choice, correctly implemented today as a direct joint rotation and correctly replaceable by an
authored flight-pose clip (ANIM-2) rather than an IK-driven pose. Similarly, the cape's motion (§5
below) is a secondary-motion problem, not a targeting problem, and does not benefit from CCDIKSolver
— IK exists to solve "where should this chain's end effector be, given a target," and nothing about
cape motion has a target in that sense. Naming this explicitly because "IK" is listed in the brief's
scope line broadly enough that a less careful reading could reach for it in the wrong places.

---

## 5. The cape

### CAPE-1 — Correcting the brief's own premise: the "direction, not position" gap it describes has already been closed in the shipped tests **[MEASURED — the code disagrees with the brief, and per the brief's own precedence rule, the code wins]**

The brief states "the three cape tests asserted *direction* and none asserted *position*." Read
directly, `tests/locomotion.test.js` (`describe('Hero visual orientation — B1 cape, B4 body pitch')`)
now contains **six** cape-related tests, not three, and three of them are explicitly position-based:
`'the cape does not intersect the torso at a full dash-flight'` and `'...while standing'` both call a
`capeTorsoGap()` helper (lines 638–667) that samples 21 points down the cape's centreline and
measures the shortest distance to the torso capsule's actual surface (`TORSO_RADIUS = 0.28`,
matching `Hero.js`'s real geometry) — a genuine clearance measurement in metres, not a dot-product
direction check. The test file's own comment block (lines 614–625) states the lesson explicitly:
*"The B1 tests above all ask about DIRECTION... What follows is the clearance question the direction
tests never asked... it cannot be satisfied by tuning a number until an assertion goes green."*
**This means the "direction assertion is not a position assertion" lesson the brief describes as
something this document should apply is something the project has already applied, between whatever
snapshot the brief was written from and the current code.** The correct framing for this document is
not "avoid repeating a gap that exists" but **"any replacement geometry must preserve an equivalent
clearance measurement, because one already exists and already caught the real bug once."** Restated
in §CAPE-4 below as a concrete requirement, not a warning against a hypothetical.

### CAPE-2 — What ships today, exactly, as the baseline any replacement must not regress **[MEASURED]**

`Hero.js`'s cape is a single `PlaneGeometry(0.7, 1.1, 4, 6)` (35 vertices), CPU-animated every fixed
step: a per-vertex sine wave down the cape (`row² × amplitude`, amplitude driven by a speed-scaled
`trail` term), a second faster cross-wave for surface break-up, a world-space "lift" rotation on the
whole `capeAnchor` toward horizontal at speed/flight, and a body-frame `CAPE_MIN_STANDOFF` (0.4 rad,
`tuning.js`) clamp that fades in with `|pitch|` to stop the lift term and the body's own forward pitch
from becoming colinear at dash speed (§B1/interpenetration bug, `KNOWLEDGE_BASE.md` §6). `CAPE_Z` is
0.32 (raised from a shipped 0.14 that put the anchor **inside** the torso capsule from frame zero —
not a speed-dependent bug at all, a placement bug). This is one `Mesh`, one material (`accent`),
7 main + shadow draw calls' worth of the hero's existing 14-call total (§DRAW below breaks this
down further). The 2D reference (`kodaman_prototype.html:5188`, re-confirmed by targeted grep this
pass, not a bulk read) is a **7-segment closed polygon** with per-vertex `Math.sin` displacement, a
backward `trail` term, and an altitude `lift` term — `RESEARCH_FINDINGS.md` §C2's correction (it is
not a bezier curve, contra the stale `KODAMAN_HANDOFF.md`) is re-confirmed here directly against the
source, unchanged.

### CAPE-3 — The four options, re-costed for a rig that now exists rather than a primitive that doesn't **[ESTIMATE, updating `RESEARCH_FINDINGS.md` §C2's staging to reflect locked decision 9]**

§C2 already compared four techniques in increasing cost order (bone-chain+Verlet, full particle-grid
cloth, vertex-shader procedural displacement, pre-baked clips) and recommended a **staged path**:
ship vertex-shader displacement now, upgrade to bone-chain+Verlet "in Phase 5." **That staging no
longer makes sense, and this is worth stating plainly because it is a real correction to standing
guidance, not a restatement of it:** §C2 deferred the bone-chain upgrade specifically because Phase 5
was where a skeletal rig would first exist — building a bone chain before there was any skeleton to
attach it to would have been premature. **Locked decision 9 moved skeletal animation into this
phase.** The rig this project is building right now already has bones; a cape bone chain is a handful
of extra joints on the same skeleton the hero's limbs already need, authored and skinned in the same
pass, not a separate system bolted on later. Paying the bone-chain cost once, now, while the rig is
already being built, is cheaper in total engineering time than shipping vertex-shader displacement
first and then re-touching the cape a second time in a later phase to redo it as bones — the
"upgrade later" framing only saved cost when "later" meant "once a skeleton exists," and a skeleton
exists as of this phase.

**Recommendation: build the cape as a bone chain on the same rig as the body (§C2 option 1, ~6–12
joints) from Phase 2's first cape commit, not vertex-shader displacement first.** Cost, re-derived
for this context: a Verlet/spring-damper relaxation over 6–12 points, 1–2 constraint-relaxation
iterations per fixed step, is sub-millisecond CPU work (unchanged from §C2's own characterization) —
the *hand-rolled* nature of this is consistent with the project's existing decision that the hero
never gets a physics-engine dependency (`KNOWLEDGE_BASE.md` §6: "No physics engine for the hero,
permanently... Rapier arrives in Phase 3 for props/enemies/vehicles only"); a Verlet cape chain is the
same category of hand-rolled, deterministic, physics-adjacent code the hero's own collision resolve
already is, not a new dependency or a violation of that rule. **Full particle-grid cloth (§C2 option
2) remains ruled out** for the same reason §C2 gave — it solves draped-fabric/self-collision problems
this project does not have, worst complexity-to-payoff ratio of the four. **Vertex-shader
displacement (§C2 option 3) is not wasted if built anyway** — it can still ride on top of the bone
chain's gross motion as a fine ripple layer (exactly the "shader handles fine ripple, chain handles
gross trailing lag" combination §C2 already named as viable), but is now the second-priority layer,
not the first-priority replacement. **Pre-baked clips (option 4) stay a fallback only**, per §C2's
own reasoning: staying procedural is more consistent with what shipped, and blended discrete clips
read as canned during the hard direction changes that are this game's entire core traversal mode.

### CAPE-4 — Interpenetration must be a structural property of the new chain, not a tuned clamp re-derived per anchor **[ESTIMATE, direct response to the brief's "must not reintroduce interpenetration" instruction]**

The real root cause of the shipped interpenetration bug was **not** an insufficiently strong clamp —
it was a placement error (`CAPE_Z` literally inside the capsule) that no clamp, however well-tuned,
would have caught, because the clamp only governs the lift *rotation*, not the anchor's base
*position*. `CAPE_MIN_STANDOFF` is a second, genuinely different fix (the colinear-at-dash-speed
case) layered on top once the placement was corrected. **For a bone-chain cape, recommend replacing
"tune a clamp and hope it covers every case" with a structural per-point minimum-distance constraint
against the torso capsule**, enforced inside the same relaxation loop that already resolves the
chain's stretch/bend constraints each fixed step: after each Verlet integration step, project any
chain point found closer than a fixed radius to the torso capsule's centreline back out to that
radius, exactly the same primitive `capeTorsoGap()` (§CAPE-1) already measures against. This turns
"the cape cannot be inside the torso" from a property that has to be separately verified against
every new anchor placement and every new pose into a property the simulation cannot violate by
construction — the same shift in kind (from "we checked this looks right" to "this cannot be wrong")
that made `HOVER_SNAP_SPEED`'s hard zero more robust than an asymptotic decay alone
(`KNOWLEDGE_BASE.md` §5). **The existing `capeTorsoGap()` test helper (§CAPE-1) should be preserved
as the regression test for this**, rewritten against whatever the new rig's actual torso bone/capsule
proxy is rather than `Hero.js`'s current primitive-mesh field names, but keeping its core method
(sample N points down the cape, measure true distance to a capsule surface, assert a positive
minimum) — that method is what caught the real bug and is the artifact of this project's cape work
most worth carrying forward unchanged in spirit.

### CAPE-5 — The cape's draw-call cost depends entirely on whether it shares a material group with the body, not on which of §CAPE-3's techniques is chosen **[ESTIMATE, cross-referenced in full in §DRAW]**

Bone-chain vs. vertex-shader vs. CPU wobble are all **CPU/GPU animation techniques operating on the
same underlying geometry-and-material unit** — none of them, by themselves, change how many draw
calls the cape costs. What does change the draw-call count is whether the cape's geometry is folded
into the body's `SkinnedMesh` as an additional material group (sharing the skinning system, costing
exactly one more main-pass and one more shadow-pass call for its own material, per §DRAW-2) or kept
as a fully separate `Mesh`/`SkinnedMesh` object (the same cost, in fact, since a separate material
already forces a separate draw call either way — see §DRAW-2 for why merging does not help here the
way it helps `StreetBlock.js`'s ground/road merge in run 1's §BUD-2). This is stated here rather than
re-derived in §DRAW so the cape section is self-contained on the *technique* question, while §DRAW
owns the actual number.

---

## 6. The comic-accurate visual redesign

### ART-1 — The proportion lever (ASSET-1) does more of this work than a shading model would **[ESTIMATE, synthesizing ASSET-1 and `RESEARCH_FINDINGS.md` §C1]**

"The character is not human enough" is, per the brief, a fair description of Phase 1's primitives
(a capsule torso, a sphere head, capsule limbs — genuinely a mannequin, not a stylization choice) —
not a complaint that needs a shading-model answer by itself. §C1's own framing (silhouette, palette,
exaggeration as the three fundamentals of readable character design; the "squint test" — solid-black
silhouette identifiability from outline alone) argues the single highest-leverage fix is **shape**,
not surface treatment. ASSET-1 already supplies this directly: Quaternius's "Superhero" proportion
class (broader shoulders, longer limbs, heavier chest-to-waist taper than the "Regular" variant, per
its own naming and stated purpose) is exaggerated humanoid geometry authored for exactly this
register, sourced rather than modeled. **Recommend leading with the proportion swap (adopting the
Superhero-class base mesh) before any shading-model change**, and treating shading (below) as the
second, smaller lever — this ordering matters because a correctly-exaggerated silhouette in flat
PBR-lit `MeshStandardMaterial` reads far closer to "comic-accurate" than a neutrally-proportioned mesh
in a full cel-shaded/outlined treatment would.

### ART-2 — Cel/toon shading is available as a stock material with no new dependency, but it opts the hero out of the world's environment map — a real, code-confirmed trade-off, not a hypothetical one **[MEASURED]**

`kodaman3d/node_modules/three/src/materials/MeshToonMaterial.js` (confirmed present, core three, no
addon) implements banded diffuse shading via an optional `gradientMap` lookup texture — a real-time,
zero-post-processing cel-shading material, directly usable today. **Read directly against its
source: `MeshToonMaterial` has no `envMap` property** (unlike `MeshStandardMaterial`, which the rest
of the world including the hero's current materials use) — it does not consume `scene.environment`
at all. `KNOWLEDGE_BASE.md` §2 documents that the world's `Sky.js` now bakes a PMREM environment map
specifically so `MeshStandardMaterial` surfaces (the towers) catch a sky reflection, fixing a
previously flat/near-black facade defect. **Switching the hero to `MeshToonMaterial` is therefore not
a free stylistic swap — it deliberately opts the hero out of the same indirect-specular mechanism
the world just spent a fix on**, producing a flat-shaded hero standing in a scene of subtly
reflective glass towers. This may be exactly the intended contrast — a stylized, "drawn" hero reading
as flatter/bolder against a more physically-lit background is itself a recognizable comic-book visual
convention, not just an inconsistency — or it may read as a mismatch. **This is a genuine
art-direction call this document cannot make for the user**, flagged in §10.

### ART-3 — Outline treatment: the inverted-hull technique is the one compatible with this project's no-post-processing-until-Phase-7 rule; a naive answer would violate it **[SOURCED — live web search, 2026-08-01, cross-checked against a binding project constraint]**

`Renderer.js`'s own comment is explicit and project-wide, not Phase-1-scoped: *"NO POST-PROCESSING.
`EffectComposer` is Phase 7."* (confirmed, read directly). The most commonly reached-for way to get a
comic-style outline — a screen-space edge-detection post-process pass (Sobel/depth-normal edge
detection via `EffectComposer`) — **is directly blocked by this rule until Phase 7**, three phases
after this one. The alternative technique confirmed live this pass, standard and well-precedented
(cited in prior shipped stylized 3D games, e.g. the Breath-of-the-Wild-style cel look): **inverted
hull** — render the character twice per frame, once normally (front faces), once with faces flipped
to render only back-facing geometry, vertices extruded a small distance outward along their normals,
shaded flat black — producing an outline as a real, if degenerate, second copy of the geometry rather
than a screen-space effect. **This is compatible with the no-post-processing rule** (it is ordinary
geometry rendering, not `EffectComposer`), but it is **not free**: it is a second draw call per
outlined mesh/material-group, in both the main and (if the outline shell should also read correctly
in shadow, which is arguable either way) potentially the shadow pass — a direct, quantifiable addition
to §DRAW's hero total, not a zero-cost visual toggle. **Recommend: if an outline is wanted, budget it
explicitly as +1 draw call per outlined material group (§DRAW-4 folds this into the hero total) and
treat it as optional/toggleable** rather than assumed-on, given the brief's own framing that
draw-call headroom is a real, finite resource this phase must account for precisely.

### ART-4 — The persona swap must survive whichever material path is chosen, and this is a real constraint, not a footnote **[MEASURED, cross-referencing Phase 1's own acceptance criterion]**

`Hero.js.setPersona()` is explicitly commented as "MATERIAL COLOURS ONLY... nothing is created or
destroyed here" specifically so the Q-key persona toggle is instant and hitch-free, and
`IMPLEMENTATION_PLAN.md`'s own Phase 5 draft names this as a regression check ("Persona toggle
remains instant and hitch-free with the new skinned-mesh pipeline... regression check against Phase
1's criterion 26"). Whatever material family the redesign lands on (`MeshStandardMaterial`,
`MeshToonMaterial`, or a mix), the persona swap should remain a **colour/uniform write on an already-
loaded material**, not a mesh or material-object swap, or a texture load — the same property that
made Phase 1's swap free applies unchanged to a rigged hero, since nothing about swapping colours on
an existing material depends on whether the mesh underneath is primitive or skinned. Worth stating
explicitly because a naive "civilian has different clothing" interpretation of the persona system
could tempt a mesh-swap implementation that reintroduces exactly the hitch Phase 1 deliberately
avoided.

---

## 7. Draw calls, and what skinning costs that draw calls don't capture

### DRAW-1 — The baseline this section revises: 7 objects, 14 calls, both passes **[MEASURED]**

`tests/world.test.js` (line 457, confirmed) pins the hero at exactly 7 objects — torso, head, 4
limbs, cape — each a separate `Mesh`, each therefore one main-pass and (all `castShadow`) one
shadow-pass call: **7 main + 7 shadow = 14 total**, consistent with `KNOWLEDGE_BASE.md`'s BUD-6 table
and run 1's inherited baseline. This is the number the brief says may go *down*, and it does — but
the reason is more specific than "skinning is efficient," and worth stating precisely rather than
asserted.

### DRAW-2 — The real lever is material-group count, not skinning itself, and this bounds how low the number can actually go **[ESTIMATE, arithmetic shown]**

A draw call in Three.js is one (geometry, material) pair submitted to the GPU per render pass — this
is true for a plain `Mesh` and equally true for a `SkinnedMesh`; skinning changes what happens
*inside* the vertex shader for that call, not how many calls are issued. The reason a rigged hero
can cost fewer draw calls than Phase 1's primitives is **not** "skinned meshes are cheap" as a
general property — it is that **6 of Phase 1's 7 objects (torso + 4 limbs) already share one
material (`suit`)**, but as 5 separate `Mesh` instances they still cost 5 separate draw calls, because
Three.js has no automatic same-material batching across independently-instantiated `Mesh` objects
(that is what `InstancedMesh`/`BatchedMesh` exist to solve, per run 1's §LOD-3). **A rigged
replacement can merge everything sharing one material into one continuous skinned mesh with one
material group**, something the primitive rig structurally could not do (each limb needed to be its
own `Object3D` specifically so it could be independently rotated by direct transform writes — the
same reason `Hero.js`'s own header comment frames each joint as "so Phase 5 can bind bones to these
joints without restructuring anything"). Once bones do the posing instead of per-object transforms,
the material-sharing meshes no longer need to be separate objects.

**Worked arithmetic, current materials (`suit`, `skin`, `accent`), both passes:**

| Grouping | Objects → material groups | Main | Shadow | Total |
|---|---|---:|---:|---:|
| Phase 1, primitives (current) | 7 objects, 3 materials, no merging possible | 7 | 7 | **14** |
| Rigged, naive (one `SkinnedMesh` per former object) | 7 objects, still 7 meshes | 7 | 7 | **14** — no improvement if the rig is built object-by-object instead of merged |
| Rigged, materials merged (recommended) | 1 `SkinnedMesh`, 3 material groups (suit/skin/accent), cape as a 4th group or separate mesh | 4 | 4 | **8** |
| Rigged, skin folded into suit (head shares body material, e.g. a full-face mask/cowl look) | 1 `SkinnedMesh`, 2 material groups (suit incl. head, accent/cape) | 2 | 2 | **4** |

**The floor is set by material-group count, not by skinning or by object count** — a `Mesh` (or
`SkinnedMesh`) with an array of N materials issues N draw calls internally (one per geometry group),
so consolidating 7 objects into 1 `SkinnedMesh` only helps to the extent it also consolidates
materials. **Recommendation: 8 total (both passes) is the realistic, art-direction-neutral target**
(3 material families is a normal humanoid-costume material count — skin, suit fabric, cape fabric —
and forcing fewer risks looking like a cost-driven compromise rather than a design choice); **4 total
is reachable only if the head/face is deliberately designed to share the suit material** (a full
cowl/mask silhouette, which is itself a legitimate superhero design convention, not purely a
performance hack — worth noting as a case where the cost constraint and the "comic-accurate"
art-direction goal could point the same direction rather than trading off against each other).
**Either way, this is a real reduction from Phase 1's 14** — the brief's instinct that this number
might go down, not up, is correct, and by a wide enough margin (14 → 4–8) that it comfortably absorbs
§ART-3's optional +1–3 outline draw calls (one per outlined material group) without threatening run
1's §BUD-6 working ceiling (150, both passes, ~65–85 calls of itemized headroom) even before that
headroom is spent.

### DRAW-3 — The cape does not benefit from the same merge, and should be budgeted as its own group **[ESTIMATE, cross-reference to §CAPE-5]**

The cape's `accent` material is not shared with any other part of the hero, so folding the cape into
the same `SkinnedMesh` as the body changes *how* it is skinned (§CAPE-3's bone-chain recommendation)
but not *how many draw calls it costs* — it remains its own material group, 1 main + 1 shadow, in
every row of §DRAW-2's table above. This is already reflected in that table (the cape is counted as
its own group throughout) but is worth stating as its own finding because it directly answers the
brief's question 2 ("work out the real figure including the cape") rather than leaving the cape's
contribution implicit in a combined total.

### DRAW-4 — What skinning costs that the draw-call number does not capture: bone-matrix upload, vertex-shader cost, and the shadow-pass re-skinning question, all confirmed directly against the installed renderer source **[MEASURED]**

The brief asks this explicitly, and it is answerable precisely by reading the renderer, not by
general knowledge about how skinning "usually" works:

- **CPU-side bone matrix computation happens at most once per frame, deduped across passes.**
  `kodaman3d/node_modules/three/src/renderers/webgl/WebGLObjects.js`, lines 46–58: for every object
  with `object.isSkinnedMesh === true`, the renderer checks an `updateMap` keyed by the object's
  `skeleton` against the current frame number (`info.render.frame`) before calling
  `skeleton.update()`; if that skeleton was already updated this frame (i.e., a second pass — the
  shadow pass — is about to render the same object), the call is skipped. **`Skeleton.update()`
  (`kodaman3d/node_modules/three/src/objects/Skeleton.js`, lines 199–225: flattening every bone's
  `matrixWorld × boneInverse` into the flat bone-matrix array and flagging the bone texture
  `needsUpdate`) therefore runs once per frame, not once per render pass**, regardless of how many
  passes (main + N shadow cascades) render the skinned mesh. This directly matters for run 1's
  §ATM-3 CSM finding: CSM's real cost is per-cascade shadow-camera culling and potential double-
  drawing of geometry that straddles cascade boundaries, **not** a multiplied bone-matrix CPU cost —
  the CPU side of skinning does not scale with cascade count. **This is a genuine positive finding
  for the CSM-interacts-with-skinning combination §ATM-3 flagged as unquantified**, though it answers
  only the CPU-bone-matrix piece of that question, not the full per-cascade draw-call multiplier
  §ATM-3 is actually about.
- **GPU-side vertex-shader skinning cost is paid once per draw call, i.e. once per pass.**
  `kodaman3d/node_modules/three/src/renderers/webgl/WebGLPrograms.js` line 328 sets the shader
  program's `skinning` parameter directly from `object.isSkinnedMesh`, generically across whatever
  material is active for that draw call — including `MeshDepthMaterial`/`MeshDistanceMaterial`, the
  materials the shadow pass substitutes in. **This confirms `castShadow` on a skinned mesh does
  re-skin in the shadow pass**: the shadow pass's depth-material program also carries `skinning:
  true` and applies the same per-vertex bone transform, from the (already-computed, per the point
  above) bone matrix texture. So the answer to the brief's precise question is layered: **the
  expensive CPU matrix math is not duplicated across passes; the comparatively cheap per-vertex GPU
  matrix-multiply *is* duplicated, once per pass, because each pass is a separate shader invocation
  over the same vertex count.** For a low-poly stylized humanoid (hundreds to low thousands of
  vertices, not a photoreal high-poly character), this GPU-side duplication is a minor, not a major,
  cost — vertex shaders at this vertex count are not the bottleneck class this project's own budget
  work (draw calls, per run 1 throughout) has been organized around.
- **Bone-texture upload is a texture write, gated the same way as the CPU matrix computation.**
  `Skeleton.update()` sets `boneTexture.needsUpdate = true` once per frame (same dedup as above); the
  actual GPU upload happens on first use after that flag is set, which the render loop's main-pass-
  then-shadow-pass ordering means happens once, not once per pass, for the same reason the CPU
  computation is deduped.

**Net finding: skinning's real, uncounted-by-draw-calls cost is small and mostly GPU-side (a doubled
per-vertex transform in the shadow pass), not CPU-side and not proportional to shadow-cascade count**
— a materially different (and more favorable) picture than "skinning re-does everything per pass,"
which is the assumption a less careful pass at this question might have shipped.

### DRAW-5 — Cross-referencing run 1's §BUD-6 line item directly **[ESTIMATE]**

Run 1's §BUD-6 itemized budget carried the hero forward unchanged at "7 → 14, [MEASURED] —
unchanged from Phase 1, carries forward," explicitly because run 1 was told the hero was out of its
scope. **This document updates that line item: the hero's realistic Phase 2 cost is 4–8 total (both
passes), per §DRAW-2, not 14** — a genuine, if small relative to the 150-call ceiling, piece of extra
headroom for whichever agent next reconciles the full Phase 2 budget, and one of the few places in
this whole research pass where the answer is unambiguously *better* than the number it replaces
rather than a wash or a new cost.

---

## 8. Floating origin — closing run 1's §ORG-2

Run 1's §ORG-1/§ORG-2 established that floating origin buys essentially nothing for *general*
coordinate precision at this project's scale (worst case 0.18 mm at the ±3,072 m hard-ceiling
half-extent), and that the one real justification — skinned-mesh degradation — was a genuine gap it
could not close, because no skinned mesh existed to test against. Continuing that numbering rather
than starting a new one, since this is the same question, not a new one.

### ORG-4 — Cross-engine evidence exists, and it changes the confidence level of run 1's deferral, even though it does not fully close the question **[SOURCED — live web search, 2026-08-01]**

Searched directly for what run 1 could not find (no skinned mesh existed then to test): reports from
**Unreal Engine's own developer forums** describe skeletal meshes visibly jittering/stuttering
starting **around 3 km from the world origin**, worsening further at 10 km, specifically calling out
that *"bones that are supposed to stay still relative to the camera"* are where the stutter is most
noticeable — i.e., the artifact is a skeletal/bone-space problem, not merely the general vertex
jitter every large-coordinate scene has. Separately, general Unity guidance on floating-point
precision at scale bands it as: **under 1,000 units safe, 1,000–5,000 units "may show slight jitter
in high-precision actions,"** 10,000+ showing clear jitter — again a distinctly different (and much
closer) band than the ~16,384 m practical edge run 1's own §ORG-1 arithmetic derived for *general*
float32 vertex precision (Godot's documented figure, re-verified by run 1's own math, not disputed
here).

**Why this matters concretely for this project:** run 1's built-target/hard-ceiling range is
**2,048 m / 6,144 m half-extent**. The Unreal-reported skeletal-jitter onset (~3 km) sits **inside**
this project's own hard-ceiling range, not comfortably beyond it the way it does for static geometry
— the hard ceiling is roughly **2×** the reported onset distance, not the ~5× margin run 1 found for
general precision at the same ceiling. This is a real, sourced data point that **narrows the
confidence gap** run 1 left open, even though it does not close it outright: it is evidence from a
different engine (Unreal), not a direct measurement of this project's own Three.js/WebGL skinning
implementation, and engines differ in how they compute bone matrices — the number should be read as
"the right order of magnitude to worry about," not "the number this project will also see."

### ORG-5 — The specific mechanism, read directly from this project's actual dependency, gives a reason to expect *some* structural mitigation already present — and a reason the risk is not fully mitigated either **[MEASURED, mechanistic reasoning — not a measured threshold]**

Reading `kodaman3d/node_modules/three/src/objects/SkinnedMesh.js` and `Skeleton.js` directly (not
inferred from general knowledge) surfaces two facts that cut in opposite directions:

- **Mitigating:** `SkinnedMesh.updateMatrixWorld()` (confirmed, `bindMode === AttachedBindMode`, the
  default) recomputes `bindMatrixInverse` **fresh from the mesh's current `matrixWorld` every
  frame** — not once at bind time. This means the mesh-root-level large world-position component is
  re-cancelled at the current frame's own float32 precision every frame, rather than accumulating
  drift against a stale bind-time position the way a naive "bind once, never refresh" implementation
  would. This is a real, code-confirmed property this project's stack already has, not a
  hypothetical mitigation.
- **Not mitigating:** the per-bone offset matrix each frame (`Skeleton.update()`,
  `bones[i].matrixWorld × boneInverses[i]`) still combines one matrix carrying the hero's full
  current world-position translation (`bones[i].matrixWorld`, which itself is the product of a chain
  of parent-to-child local transforms up the bone hierarchy, each link inheriting the accumulated
  world position) with one matrix computed once, near the model's bind/authoring origin
  (`boneInverses[i]`, near zero for a typically-authored glTF character). **A rigid `Mesh` is placed
  in world space by exactly one transform** (its own `matrixWorld`); **a `SkinnedMesh`'s vertices are
  placed by a chain of per-bone transforms whose depth equals the bone hierarchy's depth** (root →
  hip → spine → shoulder → elbow → wrist is a chain of 5–6 links for a human arm). Each additional
  link in that chain is one more float32 matrix multiplication carrying a large-magnitude world
  translation before the mesh-level `bindMatrixInverse` cancellation (confirmed above) brings the
  result back down to local scale. **This is a genuine, code-grounded reason skinned-mesh
  degradation could plausibly set in earlier than rigid-mesh vertex jitter, distinct from and
  additional to** the general float32-jitter story run 1's §ORG-1 already closed — it is not the
  same phenomenon at a different scale, it is a related but structurally different failure mode
  (compounding relative error through a multi-link transform chain, rather than absolute-position
  representable-value spacing).

**This is not a derived threshold.** Turning "a chain of N matrix multiplications, each carrying a
translation of magnitude M, compounds relative float32 error by roughly a factor related to N" into
an actual visible-artifact distance requires either a literature figure specific to this exact
computation (not found this pass) or an empirical measurement against this project's own rig once
one exists. Both ORG-4 and ORG-5 are offered as **the most this pass can respectably conclude without
running code**: real cross-engine evidence that the concern is not hypothetical, and a specific,
source-code-grounded reason it is structurally plausible for *this* engine too, distinguishing this
from the general jitter question run 1 already closed.

### ORG-6 — The practical consequence: run 1's deferral-to-Phase-5 recommendation should move up, because the premise that blocked it no longer holds **[ESTIMATE, revising run 1's §ORG-3]**

Run 1's §ORG-3 recommended cheap architectural prep now (chunk-local-vs-world-position separation,
already independently justified) and **deferring the actual re-centering mechanism to Phase 5,
"gated on an actual test against real skinned meshes"** — explicitly because no skinned mesh existed
in the codebase at the time run 1 wrote that recommendation, so there was nothing to test. **Locked
decision 9 removes that precondition**: this phase's own Engineer stage is about to build the first
skinned hero mesh. The reason to defer the *test* no longer applies once this phase ships a rig —
only the reason to defer the *re-centering mechanism itself* (real engineering, not worth building
speculatively per run 1's own anti-speculative-engineering reasoning, still sound) survives.
**Recommendation: as soon as the rigged hero exists in Phase 2 (not deferred to Phase 5), run the
cheap synthetic test run 1 could not run and this pass cannot run either** — spawn the rigged hero at
a sequence of world-space offsets (0 m, 1,024 m, 2,048 m, 3,072 m, 6,144 m along one axis, matching
the built-target and hard-ceiling figures exactly), apply an identical bind pose and an identical
animated pose at each offset, and diff the resulting world-space vertex positions against the same
pose computed near the origin and then rigidly translated by the offset — any divergence beyond the
general float32 jitter baseline (already known and small, per run 1's §ORG-1 math) is the skinned-
mesh-specific artifact ORG-4/ORG-5 predict might exist. **This is a test, not a system** — it needs no
`FloatingOrigin.js`, no re-centering logic, nothing beyond the rig that is being built anyway; it is
strictly cheaper than run 1's own §ORG-3 deferred-mechanism cost, and it converts ORG-4/ORG-5 from
"plausible reasoning" into either a measured number (closing the question for real) or a measured
"no visible effect at these distances" (which would mean run 1's original "skip it" instinct was
right after all, just not yet verified). **This is the single most concrete, actionable output of
this whole floating-origin thread across both research runs — a specific test, runnable this phase,
that was not runnable before this phase for a structural reason (no rig existed) that no longer
applies.**

### ORG-7 — If the test in ORG-6 finds a real effect, the fix is cheap and does not require the full re-centering mechanism **[ESTIMATE]**

Worth stating so a positive test result does not read as a crisis: if ORG-6's test finds visible
bone-chain degradation at the project's own hard ceiling, the cheapest fix is very plausibly **not**
`FloatingOrigin.js`'s full world-root re-centering (run 1's §ORG-3 "expensive to retrofit" mechanism)
but simply **keeping the hero's `SkinnedMesh` and its bone hierarchy authored/updated in a coordinate
space close to its own local origin, with the large world-position offset applied at exactly one
place** — e.g., a wrapping `Group` that holds the world-space position, with the skinned mesh and its
skeleton living at a small, bind-pose-local offset inside it, so the bone-matrix chain (ORG-5) never
itself carries the large-magnitude translation, only the single outer `Group.position` does. This is
a narrower, character-scoped version of exactly the chunk-local/world-offset separation run 1's
§STR-1 already recommended for world geometry — the same architectural habit, applied to the hero
specifically, and cheaper than a scene-wide floating-origin system if it turns out to be sufficient
on its own. Whether it *is* sufficient on its own is itself downstream of ORG-6's test, not
determinable from source reading alone — flagged honestly rather than asserted.

---

## 9. Animation authoring volume

### CLIP-1 — The FSM's own yaw behavior collapses what would naively be a directional blend tree down to a single speed axis per state-cluster **[MEASURED, the single biggest authoring-volume finding in this section]**

A careless pass at "how many clips does a walk/run/takeoff/fly/dive/land hero need" would reach for
a standard 2D locomotion blend tree — forward/back × left/right, 8 directions × N speed tiers — the
shape most third-person games need because the character can strafe while facing the camera. **This
project's hero does not do that.** `LocomotionController._updateOrientation()` (confirmed, read
directly, `KNOWLEDGE_BASE.md` §4) rate-limits yaw toward the **travel direction**, not the camera
direction — the hero visually turns to face wherever it is currently moving, at up to 12 rad/s, and
holds its last facing when there is no input. **This means the hero, by construction, is always
moving in its own local -Z ("forward") once yaw has caught up** — camera-relative WASD determines
*where* the hero goes, but the hero's *body* always ends up facing that direction, not strafing
sideways relative to a fixed facing. **Consequence: the entire grounded and flying locomotion sets
need only forward-facing clips — no strafe-left/right, no walk/run-backward** — because those
motions never actually occur from the character's own local perspective; what looks like "the player
pressed A to strafe left" is, from the rig's point of view, "the character turned to face its new
left-ward travel direction and is now walking forward in a new heading." This is a direct, load-
bearing consequence of a design decision run 1 and this document both inherited rather than
questioned, and it is worth stating explicitly because it changes the clip count by roughly the same
factor a naive 8-directional blend tree would have needlessly multiplied it by.

### CLIP-2 — Correction to a premise the brief's phrasing invites: Phase 1's shipped "flying" pose is a single static hold, not a speed-blended pair, and this sets the honest floor for what "matching current fidelity" actually requires **[MEASURED]**

Read directly, `Hero.js._animateLimbs()`'s flight branch eases every limb toward one fixed target
rotation set (`armLeft`/`armRight` at 2.6, `legLeft`/`legRight` at −0.12, the B5 silhouette) via
`approachRotation(..., k)` where `k` depends only on `dt`, **never on `speed`** — the `speed`
parameter passed into `_animateLimbs()` is read only in the non-flight (grounded) branch. **Phase 1's
hero holds exactly one flight pose regardless of whether it is hovering motionless or dashing at
`FLIGHT_DASH_SPEED` (20.5 m/s)** — all of the sense of speed in flight comes from the *procedural
body pitch* (§4/ANIM-2, unchanged and correctly not duplicated by a clip) and the cape, not from the
limb pose itself changing. §ANIM-2 above proposed a genuine hover-↔-cruise blend space as an
*improvement* over this — worth being explicit that this is new authoring scope beyond what "port
the existing pose to bones" would require, not a re-statement of what already ships. The rest of this
section prices both the honest floor (parity with Phase 1) and the enhanced version (what actually
answers "Ghost of Tsushima was named for fluidity") separately, so the gap between them is visible
rather than blurred into one number.

### CLIP-3 — Minimum viable count: parity with Phase 1's existing fidelity, rig included **[ESTIMATE]**

| Clip | Source | Notes |
|---|---|---|
| Idle (grounded) | Off-the-shelf CC0 (Quaternius library) | Standard library content |
| Walk (grounded) | Off-the-shelf CC0 | Standard library content |
| Run (grounded) | Off-the-shelf CC0 | Standard library content |
| Flight pose (single, held) | **Custom-authored** | The B5 silhouette; a static hold, so this is 1–2 keyframes, not a cycling loop |
| Takeoff | **No new clip** — a crossfade from grounded idle/run into the flight pose, timed to the existing scripted 12-step/0.2 s window | The existing `capeFlare` flag already marks the moment; the "animation" is the crossfade itself |
| Landing | **No new clip** — the reverse crossfade, interruptible per ANIM-2's requirement | Same mechanism, opposite direction |

**Minimum viable is 4 actual assets** (3 sourced, 1 custom), with takeoff/landing handled entirely by
`AnimationMixer`'s native crossfade machinery (§ANIM-3) rather than authored transition clips. This
is a materially smaller number than "6 states named in the brief = 6 clips," and the reduction is a
direct, re-derivable consequence of CLIP-1/CLIP-2 above, not a hand-wave.

### CLIP-4 — The enhanced count: what actually answers the fluidity complaint, priced separately from the floor **[ESTIMATE]**

| Addition over CLIP-3 | Purpose | Source |
|---|---|---|
| A genuine cruise pose, distinct from hover | Speed-driven blend space (§ANIM-2), the specific upgrade over Phase 1's single static pose | Custom |
| A dive-specific pose (tucked/streamlined) | Blended in as `state.pitch` approaches its dive extreme — an authored payoff for the two-term pitch model already computing when a dive is happening | Custom |
| A real authored takeoff-launch beat (arm-snap, torso coil-and-release) | Replaces CLIP-3's plain crossfade with an actual authored impulse, additive over the base crossfade | Custom, short (fits the fixed 0.2 s window) |
| A real authored landing touchdown/absorb beat | Same idea, opposite transition; still must remain interruptible per ANIM-2 | Custom, short |
| Turn-lean additive layer | Answers "fluidity" cheaply via `AdditiveAnimationBlendMode` (§ANIM-3) rather than a full new clip per turn angle | Custom, very short (single joint chain, a few keyframes) |
| Idle breathing/sway additive layer | Same mechanism, sells "alive" at a stand-still | Custom, very short |

**Enhanced total: roughly 8 base clips + 2 additive layers ≈ 10 distinct animation assets.** This is
the number worth budgeting against if the goal is genuinely answering the Ghost of Tsushima
reference rather than technically satisfying "the hero has animations now."

### CLIP-5 — Where the real authoring cost actually concentrates, and why it is still agent-tractable **[ESTIMATE + SOURCED, synthesizing §1's licensing findings]**

The ground-locomotion set (idle/walk/run, both CLIP-3 and CLIP-4) is **free** in the literal sense —
CC0, off-the-shelf, matched-rig, zero authoring time, per §ASSET-1/§ASSET-2. **Every flight-specific
asset in both tables is custom**, and this is structural, not a sourcing gap to search harder for: a
flying human is not a real motion-capture category, so no generic humanoid animation library (Mixamo,
Quaternius, or otherwise) is going to ship "superhero flight cruise" as a stock clip the way it ships
walk/run/jump. **This is where Phase 2's animation-authoring effort actually concentrates**, and it
is worth naming precisely rather than leaving "some clips are custom" vague: 1 clip at the floor, up
to 6 at the enhanced tier. The mitigating fact, though, is real and directly evidenced by this
project's own history: **Phase 1's flight pose was itself hand-authored as explicit rotation values**
(`Hero.js`'s `2.6`/`−0.12`/`0.12` constants, with the B5 bug-fix commentary showing exactly how those
values were reasoned about and corrected by an agent, not a human animator) — **the same
explicit-rotation-value posing technique that already produced a shipped, user-approved flight
silhouette translates directly to hand-keyframing a handful of bone rotations for a static or
near-static pose on a rig**, which is a fundamentally smaller task than authoring a full walk-cycle
from scratch would be (a static hold needs 1–2 keyframes; a locomotion cycle needs a full loop with
foot-contact timing). **Quaternius's Universal Animation Library 2 (2026) explicitly covers "parkour
movement"** among its 130+ clips (§ASSET-2) — untested this pass, but a plausible source of an
adaptable base pose (a leap, a glide-adjacent hold) that hand-tweaking could shortcut from rather than
posing every flight clip from a blank rig; worth checking at implementation time rather than assumed
either way here.

---

## 10. What I could not answer

Listed honestly, per the brief's explicit instruction, and distinguished from §11's user-facing
decisions below — those are answered with a recommendation awaiting approval, not gaps. These are
genuinely unresolved.

1. **Universal Animation Library 2's free/paid split (§ASSET-2).** The live search this pass turned
   up "60–70% of the pack being completely free" without specifying which of the 130+ clips that
   covers. Not closed — needs a direct visit to `quaternius.com`/`quaternius.itch.io` before
   committing to which specific clips ship in Phase 2, since the ASSET-5 recommendation assumes the
   core locomotion set (idle/walk/run) is in the free tier, which is plausible (it is the oldest,
   most standard content category) but not confirmed.
2. **The exact skinned-mesh precision-degradation distance for this project's own Three.js/WebGL
   stack (§ORG-4/§ORG-5/§ORG-6).** Advanced meaningfully beyond run 1's state — real cross-engine
   evidence (~3 km Unreal onset) and a specific, source-grounded mechanism (bone-hierarchy
   matrix-chain depth compounding float32 error, distinct from general vertex jitter) — but not
   closed to an actual number for this codebase. §ORG-6 specifies the exact test that would close it;
   this pass could not run it, because running it requires a browser and a rigged mesh neither of
   which a static-code-reading research pass has access to.
3. **`SkeletonUtils.retarget()`/`retargetClip()`'s real-world quality (§RIG-2).** Confirmed present
   and implemented in the installed source; not exercised against an actual Mixamo-sourced clip
   driving a non-Mixamo skeleton, so its practical fidelity versus the offline Blender/gltf-transform
   pipeline `RESEARCH_FINDINGS.md` §A10 documents is unverified. Matters most for the ASSET-3
   Mixamo-supplementary path, not the ASSET-1/2 Quaternius-only path (which needs no retargeting at
   all).
4. **Whether Quaternius's Universal Animation Library 2's "parkour movement" category contains
   anything genuinely adaptable to a flight pose (§CLIP-5).** Named as a plausible authoring-cost
   shortcut, not verified — this pass did not fetch the pack's actual clip list.
5. **AnimationMixer's testability story (§ANIM-1).** Established that it needs a `THREE`
   object graph and cannot run in the same headless-`node`-with-no-WebGL environment the 105
   existing locomotion tests do; did not design the actual replacement test strategy (a `jsdom` +
   minimal skeleton fixture, or accepting browser-only verification for this specific layer) — that
   is implementation-stage work, not a research question this pass is positioned to resolve without
   writing and running test code.
6. **Whether committing Mixamo-derived `.glb` output into the now-public repository sits inside or
   outside Mixamo's terms (§ASSET-3).** Read the terms directly; concluded this is milder than a
   literal resale but not unambiguously clean either. This is a licence-interpretation question, not
   a technical one, and this document is not positioned to give it a definitive legal answer — only
   to flag that it exists and that leaning on Quaternius as primary (ASSET-5) sidesteps it rather
   than resolves it.
7. **CSM's real shadow-pass draw-call multiplier, inherited unresolved from run 1's §ATM-3/§BUD-5.**
   This document adds one piece (§DRAW-4: the CPU-side bone-matrix computation does *not* scale with
   cascade count, since it is deduped once per frame regardless of pass count) but does not close the
   larger question of how much cascade-overlap double-drawing costs in this project's actual
   geometry — still requires building `CSM.js` and measuring, exactly as run 1 already concluded.

---

## Summary of what needs a user decision

Consolidated from throughout this document, so the orchestrator has a single list to carry forward,
matching run 1's closing format.

1. **Cel/toon shading vs. continued PBR for the hero (§ART-2).** A real, code-confirmed trade-off:
   `MeshToonMaterial` gives a stock, zero-dependency cel-shaded look but structurally cannot consume
   the world's new PMREM environment map (no `envMap` property), producing a flat-shaded hero against
   a subtly reflective world. This may be the intended stylistic contrast or may read as a mismatch —
   a genuine art-direction call, not a technical one.
2. **Whether to add an outline treatment at all, and if so, budget it explicitly (§ART-3).** The only
   technique compatible with the binding no-post-processing-until-Phase-7 rule (inverted hull) costs
   a real, quantifiable extra draw call per outlined material group. Worth deciding as a deliberate
   trade against §DRAW's otherwise-favorable hero total, not defaulting to "on."
3. **Whether the head/face shares the suit material for a 4-call hero, or stays a separate material
   for an 8-call hero with a more conventional exposed-face look (§DRAW-2).** A case where the
   draw-call floor and an art-direction choice (a full cowl/mask silhouette vs. a visible face) point
   toward the same decision rather than trading off against each other — worth deciding together
   rather than defaulting to whichever a first implementation pass happens to produce.
4. **Primary asset-sourcing commitment: Quaternius-first (§ASSET-5) now, or wait to confirm Universal
   Animation Library 2's free/paid split (§ASSET-2, open item 1 above) first.** Affects how much of
   §CLIP-3/§CLIP-4's clip budget is genuinely free versus needing a fallback source.
5. **Whether Mixamo remains in scope as a supplementary clip source given the public-repo licence
   tension (§ASSET-3, open item 6 above), or whether Phase 2 stays Quaternius-only to avoid the
   question entirely.** A risk-tolerance call, not a technical one.
6. **Minimum-viable (§CLIP-3, ~4 animation assets, matches Phase 1's existing fidelity) vs. enhanced
   (§CLIP-4, ~10 assets, actually answers the Ghost of Tsushima fluidity reference) authoring scope
   for Phase 2.** A real scope/budget decision — the two tiers differ by roughly 6 custom-authored
   flight-specific assets (§CLIP-5), all hand-keyframed rather than sourced, since no library ships
   flying-human motion capture.
7. **Whether to run §ORG-6's synthetic skinned-mesh precision test early in Phase 2's engineering
   work, ahead of any other rig-dependent work, given §ORG-4/§ORG-5 raise the stakes on a question
   run 1 had scoped as safely deferrable to Phase 5.** This document recommends running it as soon as
   any rigged mesh exists rather than waiting, since the precondition that justified deferring it (no
   skinned mesh in the codebase) no longer holds as of this phase — but scheduling it relative to the
   rest of Phase 2's engineering work is the orchestrator's call, not this document's.

---

*End of Phase 2 Research, Run 2 of 2. Both runs are now complete: run 1 (`RESEARCH_PHASE_2_WORLD.md`)
covered world geography, streaming, LOD, atmosphere, and the draw-call budget; this document covers
skeletal animation, rigging, the glTF pipeline, the cape, the comic-accurate visual redesign, and
character-specific draw-call/precision consequences. §ORG-4–§ORG-7 above close out the one open
question run 1 explicitly handed forward (§ORG-2); everything else in this document is new ground,
not a continuation. The consolidated user-decision lists from both documents are the orchestrator's
starting point for whatever review/design stage comes next.*

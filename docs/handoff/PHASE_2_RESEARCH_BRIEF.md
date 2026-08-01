# Phase 2 Research Brief — Run 1 of 2: World, Streaming, and Density

**Written by:** the orchestrator, session 6, 2026-07-31.
**For:** the Phase 2 Research agent (Sonnet).
**Deliverable:** `docs/handoff/RESEARCH_PHASE_2_WORLD.md`.

Phase 1 is complete, verified across five browser passes, and merge-ready as
[PR #3](https://github.com/cyang3859/C_K_prototype/pull/3). This brief opens Phase 2.

---

## Read this first, and only this

**`docs/handoff/KNOWLEDGE_BASE.md` (501 lines).** It is the Overview agent's consolidated map of
the entire build — module wireframe, app lifecycle, the flight FSM written from the code, every
settled decision, and an index of the other 21 documents with a note on when each is worth opening.

**It exists precisely so you do not read the document pile cold. Do not read all 21 documents.**
Consult the others **by section**, via the index in `KNOWLEDGE_BASE.md` §8, and only when the
knowledge base does not answer the question.

Two rules on precedence, both from that file's header:
- If `KNOWLEDGE_BASE.md` and an older doc disagree, the knowledge base is the corrected version.
- **If `KNOWLEDGE_BASE.md` and the code disagree, the code wins.** Say so inline rather than
  silently trusting either. The last agent to work in this project found a real doc/code
  contradiction by doing exactly that, and that is the behaviour this brief wants.

**Never read `kodaman_prototype.html` in bulk.** It is 16,507 lines and has killed agent budgets in
this project. Targeted `grep` only. It is the 2D design reference and is never edited.

---

## Scope — what this run covers, and what it does not

Phase 2 as it now stands spans three large areas. **This run is the first of two and covers the
first two only.**

### IN SCOPE for this run

1. **World geography and streaming.** The core of the plan of record — see
   `IMPLEMENTATION_PLAN.md` §"Phase 2 — World Geography & Streaming" (lines 58–121) for the
   deliverable list already drafted: `ChunkManager.js`, `Chunk.js`, `District.js` ×2, `LOD.js`,
   `Instancing.js`, `DayNightCycle.js`, `CSM.js`, the `Sky.js` upgrade, and
   `core/FloatingOrigin.js`. **Treat that list as a starting proposal to validate, correct and
   sharpen — not as settled truth.** It was written before Phase 1 shipped and before the
   draw-call correction below.
2. **World density and realism.** The user's deferred design feedback (below). This is *new* input
   the drafted plan does not account for, and it is the reason this research is not merely a
   re-read of the existing plan.

### OUT OF SCOPE for this run — do not research it

**Skeletal animation, character rigging, glTF character assets, and the "character not human
enough" feedback.** That is locked decision 9's work and it is **run 2 of this research**, a
separate agent after the user has read your output. Mentioning a dependency in passing is fine
("the floating-origin work matters more once skinned meshes exist"); researching it is not.

Also out of scope: the trademark naming table (a user decision, blocks content porting, not this),
combat/physics (Phase 3), quests and dialogue (Phase 4).

---

## Binding constraints — these are decided, do not relitigate them

From `KNOWLEDGE_BASE.md` §6. Research *within* these, not around them.

| # | Constraint |
|---|---|
| 3 | LA realism: **recognizable landmarks, invented streets.** No OpenStreetMap geodata import. |
| 7 | Draw-call ceiling: raised for Phase 2 **from a measured worst case, not a guess.** See below. |
| 8 | World extent: **vast and explorable but explicitly BOUNDED.** Not an endless open world. |
| — | **WebGL, not WebGPU**, for all eight phases. Stated as final in `Renderer.js`. The CSM addon later phases need is WebGL-only. There is deliberately no fallback path. |
| — | **No physics engine for the hero, permanently.** `Collision.js` is hand-rolled AABB + kinematic capsule resolution. Rapier arrives in Phase 3 for props/enemies/vehicles only. |
| — | **Fixed 60 Hz timestep, non-negotiable.** Every tuning constant assumes it. |
| — | **The `Hero.js` / `LocomotionController.js` split is load-bearing** (visual vs simulation). Do not propose anything that crosses it. |
| — | **Camera updates after locomotion, within the same fixed step.** |
| — | **No named characters, places, or companies anywhere in `kodaman3d/`, including placeholders.** Your document must follow this rule too: describe districts by type and real-world geography, and do not invent proper nouns for in-game places. |

**World scale is already reconciled** (`REVIEW_FLAGS.md` F3): a **2,048 × 2,048 m built target**
(≈4.19 km²) at **256 m chunks** — 8×8 = 64 chunks — engineered to grow to 4,096 m or the 6,144 m
hard ceiling without re-architecture. Phase 1 currently ships a 300 m playable square
(`PLAYABLE_HALF_EXTENT` = 150). **Validate this ruling against what you find; do not silently
assume it, and do not silently discard it.** If the density work below implies it is wrong, say so
with numbers.

---

## The draw-call budget — the single most important number, and the mistake to avoid

**Every draw-call figure this project used before 2026-07-31 undercounted by roughly half.**

`renderer.info.render.calls` accumulates across **both** the shadow pass and the main pass:
`WebGLRenderer` calls `info.reset()`, *then* `shadowMap.render()`, then the main scene render, all
before the counter is read. **Every shadow-casting object therefore costs two calls, not one.**
Verified by direct read of the installed `three` 0.185.1 bundle.

| Phase 1 worst case (nothing culled) | Main pass | Shadow pass | **Total** |
|---|---:|---:|---:|
| Before the building realism pass | 28 | 21 | **49** |
| **After — what ships today** | **32** | **25** | **57** |

**Budget from 57.** Not from 49, not from 45, not from the 42 a human measured (that figure is a
culled runtime reading, not a worst case). The Phase 1 ceiling of 60 leaves **three calls of
headroom, not the eleven `DESIGN_SPEC_PHASE_1_BUILDINGS.md`'s ledger promises** — that ledger counts
main-pass objects only and is wrong.

**Orchestrator ruling on the pass convention, so you do not have to guess it:**

> **State every draw-call figure you produce as a TOTAL across both passes**, because that is what
> `renderer.info.render.calls` actually reports and therefore what anyone can measure in the debug
> HUD. **Always give the main/shadow split alongside it.** Any ceiling you propose must say, in the
> sentence that states it, that it counts both passes.

`IMPLEMENTATION_PLAN.md`'s Phase 2 acceptance criterion 2 currently says "target: under 150." That
number is a guess, predates the correction, and does not state its pass convention. **Replacing it
with a defensible figure derived from the real 57 is one of your deliverables**, and locked decision
7 requires it be derived, not asserted.

Two levers already identified, worth costing properly:
- **Instancing is free at the margin.** Phase 1's realism pass added 44 world objects for 8 calls.
- **`castShadow = false` on things nobody looks at the shadow of is worth a full call each** — the
  cheapest lever when calls get tight.

---

## The design feedback that motivates this phase

The user gave this after the Phase 1 spot-check, **recognised it themselves as scope creep against
Phase 1, and deferred it to Phase 2.** It is input to your research, not a defect list.

- **The world feels empty — too few landmarks.**
- **Buildings and the landscape are "too blocky and rigid."**
- **Open-world inspiration: Red Dead Redemption 2 and the Watch Dogs series.**
- (Ghost of Tsushima was named for *animation fluidity* — that is run 2, not this run.)

Take these seriously and translate them into **specific, costed, implementable technique**, not
adjectives. The useful question is not "how do we make it feel like RDR2" — it is *which concrete
techniques those games use to produce the effect the user is describing, which of them are viable
in WebGL/Three.js at this scale, and what each costs in draw calls, triangles, memory and authoring
time.* Silhouette variety, facade articulation and setbacks, street-level clutter density,
landmark placement and sightlines, terrain that is not flat, vegetation, and environmental
storytelling are all more tractable than they sound; say which are worth it and which are not.

**Be honest about what does not transfer.** RDR2 is a console-native engine with a decade of
studio-authored assets. Part of the value of this research is separating what a WebGL browser build
with procedural/kit-of-parts authoring can genuinely reach from what it cannot, so the user's
expectations are set by evidence rather than by a mood board.

---

## Open questions you should answer or bring to a decision

These are already flagged in `IMPLEMENTATION_PLAN.md` §"Open questions" and `REVIEW_FLAGS.md`.

1. **Which two districts** (`IMPLEMENTATION_PLAN.md` open question 2). F3 settled the world's
   *size* but not the *choice*. `RESEARCH_LA_WORLDBUILDING.md` §9.5 lists eight candidates.
   **Recommend exactly two, with reasoning**, weighing landmark density, visual contrast between
   them, and how well each serves later quest content. The plan's own placeholder default is the
   Historic Core/Broadway corridor plus the Hollywood Blvd corridor, both flagged as near-1:1
   viable. **The user approves the final choice** — propose, do not decide.
2. **World edge behaviour** (open question 5). At the ±1,024 m boundary: hard collision wall (what
   Phase 1 does at 300 m), soft atmospheric fade that discourages without preventing, or a
   boundary-triggered transition? Locked decision 8 requires *bounded*; it does not say *how*.
   This is a feel decision — lay out the options with their costs and give a recommendation.
3. **R1 — LA visibility and haze parameters.** `RESEARCH_LA_WORLDBUILDING.md` §9.5's fog numbers
   ("haze onset ~1,200 m, saturating ~6,000 m") are explicitly labelled guesses by their own
   author. Needed before the `Sky.js` day/night upgrade. The precise question: what is the typical
   and hazy visual range in the LA Basin, and does it translate into Three.js `Fog` near/far
   distances for a 2,048–4,096 m world? **A LaDochy & Fuentes visibility PDF was cached in an
   earlier session's scratchpad — that scratchpad is long gone. Re-source it if you want it.**
4. **R2 — LA block dimensions.** Only tertiary blog figures exist (~300–350 ft), plus an
   unconfirmed lead (the 1849 Ord survey in varas, giving 336 ft / 600 ft) and an unexamined
   primary source (LAMC §17.05 subdivision design standards). Wanted separately for the Ord-grid
   core and the cardinal-PLSS suburban grid. This sets the chunk-to-block ratio, which §9.5's own
   chunk-size reasoning says to revisit once this is closed.

---

## Deliverable

**`docs/handoff/RESEARCH_PHASE_2_WORLD.md`.**

Follow the house style of `RESEARCH_FINDINGS.md`: numbered sections, tagged findings you can cite
by ID from a later document, sources linked inline, and — importantly — **explicit confidence
labelling.** This project has been bitten repeatedly by confident prose that turned out to be a
guess. Mark what is measured, what is sourced, and what is your estimate, and never let the three
read alike.

Cover, at minimum:

1. **Streaming architecture** — chunk load/unload, velocity-predictive radii, hysteresis so chunks
   do not thrash at the boundary, and disposal that provably leaks nothing. Validate the drafted
   module list; correct it where Phase 1's shipped reality differs from what the plan assumed.
2. **LOD and instancing** — the three-tier scheme already sketched (0–40 m / 40–150 m / 150 m+
   impostor), `InstancedMesh` vs `BatchedMesh`, and what each is actually worth here. Confirm
   `BatchedMesh`'s API status in the installed `three` 0.185.1 rather than trusting older notes.
3. **The density and realism techniques** — the section that answers the user's feedback, costed.
4. **Day/night, CSM, and fog** — including R1's numbers if you close them.
5. **Floating origin** — whether it is genuinely needed at 2,048 m or is insurance for later
   growth, and what it costs to add now versus retrofit.
6. **The draw-call and triangle budget** — derived from 57, stated as a both-pass total with the
   split shown, with the reasoning legible enough that the next person can re-derive it.
7. **The two district recommendations**, and the open questions above.
8. **A "what I could not answer" section.** Explicitly list what you could not close and why. Do
   not paper over a gap with plausible prose — that failure mode has cost this project real time.

**Write the file incrementally, section by section, from your first section onward.** Three agents
in this project have been killed mid-task by session limits and **only work already on disk
survived.** Do not hold the document in your context and write it at the end. This is the single
most important process instruction in this brief.

---

## Working rules — non-negotiable

- **You must not spawn subagents. Not one, not read-only, not "small and foreground."** This rule
  exists because an agent once fanned out to four children unprompted and burned the budget, and it
  has since been violated by an agent explicitly told not to. Do all the work yourself.
- **Write incrementally.** See above.
- **Do not modify any code.** This is a research run. `kodaman3d/` and `kodaman_prototype.html` are
  both read-only to you. Your only writes are to your own deliverable in `docs/handoff/`.
- **Reading the Phase 1 source is encouraged** — `kodaman3d/src/` is ~5,100 lines across 15 files
  and it is the ground truth. `StreetBlock.js` (1,608 lines) in particular is the thing Phase 2
  generalises, and `Collision.js` is what has to go from 12 static boxes to per-chunk box sets.
- **If you are genuinely unsure at a decision point, write down the question rather than guessing.**
  The orchestrator will take it to the user. A flagged open question is worth more here than a
  confident invention.

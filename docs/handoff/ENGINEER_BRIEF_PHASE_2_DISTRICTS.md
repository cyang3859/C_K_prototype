# Engineer Brief — Phase 2 Districts, run 1 of 2

**Written:** 2026-08-01, session 9, by the orchestrator
**Model:** Opus (per the standing rule — all agents Sonnet except the Engineer)
**Your deliverable:** working code in `kodaman3d/`, plus `docs/handoff/ENGINEER_PHASE_2_DISTRICTS.md`

---

## 0. Process rules — absolute, and they exist because of real incidents

1. **Do NOT spawn subagents.** Do not use the Agent/Task tool for any reason. One agent in this
   pipeline fanned out to four children unprompted and burned the session budget. Do all work
   yourself.
2. **Commit incrementally, and often.** Three agents in this pipeline have been killed mid-task by
   session limits; only work already written to disk survived. **Commit after each numbered work
   item below, with tests green at every commit.** A half-finished run that left five good commits
   is a success; one that held everything in memory and died is a total loss.
3. **Never read `kodaman_prototype.html` in bulk.** 16,507 lines; it has killed agent budgets.
   Targeted `grep` only. You almost certainly do not need it at all. **It must end with a zero
   diff** — it is the untouched 2D design reference, per locked decision 2.
4. **Do not touch `main`.** Work on the current branch `feat/3d-open-world`. Do not merge, do not
   open or modify PRs. PR #3 is open and is the user's to handle.
5. **Tests must pass at every commit.** The suite is `cd kodaman3d && npm test` — currently
   **108/108**. Add tests for what you build; do not weaken existing ones to make something pass.
   If an existing test genuinely encodes a now-wrong assumption, say so explicitly in your report
   rather than quietly changing it.
6. **If a document contradicts the code, the code wins — and say so in your report.** This has
   happened four times in this pipeline and each time the agent was right to flag it. It is a valued
   outcome, not insubordination.

---

## 1. What you are building, and what you are NOT

You are implementing **`DESIGN_SPEC_PHASE_2_DISTRICTS.md`** (772 lines), which has **passed Review's
feasibility gate** (`REVIEW_DESIGN_SPEC_PHASE_2_DISTRICTS.md`, APPROVED WITH CORRECTIONS, both
corrections already applied). The spec is authoritative for *what the districts look like*. You do
not get to redesign it; you get to build it and to report where it is unbuildable.

**This is run 1 of 2, deliberately scoped by the orchestrator.** The spec's §10 priority order exists
"so cuts are this document's decision, not the Engineer's" — so this split follows that order rather
than inventing one.

### IN SCOPE for this run — §10 priority items 1–3, plus the scaffolding they need

| # | Item | Spec section |
|---|---|---|
| A | **District scaffolding** — whatever minimal structure is needed to place two districts with different grid rotations. See §3 below on how far to go. | §1, §2 |
| B | **Facade families** — 7 total (3 District A, 4 District B). **Do not cut.** | §4 |
| C | **Massing recipes** — 5 recipes, ~2,376 triangles across the district population. **Do not cut.** | §5 |
| D | **Ground/road district-merge** — the `BUD-2` trap. **Not optional**; a build that fails this is unshippable by the spec's own words. | §6 |
| E | **The two district landmarks** — District A's tower with a **sculpted crown**, District B's **sign/observation mast**. **Do not cut.** | §DA-4, §DB-4 |

### OUT OF SCOPE for this run — leave for run 2

§10 items 4–11: vegetation, rooftop HVAC/parapet rings for the new districts, awnings and blade
signs, streetlamps, small props, parked cars, broadleaf trees, utility poles, the hill/terrain
landmark, and the whole cut-priority tier. **Do not start them.** If you finish A–E early with
budget left, **stop and report** rather than starting run 2's scope — the orchestrator will spawn it.

**Also explicitly out of scope:** CSM/cascaded shadow maps, the day/night cycle, world streaming and
chunk loading/unloading, the world-edge fade (locked decision 11), and anything to do with the hero,
the rig, or animation. Several of those are Phase 2 work but they are *other* work.

---

## 2. The budget — this is a hard requirement, not a target

- **Every draw-call figure in this project is a TOTAL ACROSS BOTH PASSES** (main + shadow), because
  that is what `renderer.info.render.calls` reports. **Always state the main/shadow split alongside
  any total.**
- **Measured Phase 1 baseline: 57 calls (32 main / 25 shadow), 11,324 triangles, 13 programs,
  22 textures.**
- **Phase 2 ceiling: 150 calls, both passes** (`RESEARCH_PHASE_2_WORLD.md` §BUD-6).
  `IMPLEMENTATION_PLAN.md`'s "under 150" is a pre-correction guess with no pass convention and is
  superseded by §BUD-6.
- **The spec's §BGT-1 rollup is ~69 calls with ~81 headroom, and Review re-derived every figure in
  it independently and confirmed it.** Your build should land near that.
- **Headroom is not free.** CSM's real shadow cost is unmeasured and is the single most consequential
  open unknown (spec §11 item 3). The 81 calls of headroom exist to absorb it. Do not spend it.

**You must measure, not estimate.** See §5 below — you have a browser.

---

## 3. How much scaffolding to build — the judgment call this run turns on

The spec describes two districts but this codebase has exactly one hand-authored `StreetBlock`
(`kodaman3d/src/world/StreetBlock.js`, 1,618 lines, a single 300 m block at `HALF_EXTENT = 150`).
**There is no district system, no chunk system, and no streaming.** Run 1's research (`§BUD-2`)
is emphatic that `Chunk.js` must be "a data window into district-shared batches," **not** a
`StreetBlock` repeated at 256 m — repeating Phase 1's 7-mesh ground/road pattern per chunk costs
**7 × 64 = 448 draw calls before a single building.**

**Build the least scaffolding that lets items B–E exist and be measured, and no more.** Concretely:

- **Do build** whatever lets two districts with **different grid rotations** (District A on the 36°
  historic grid, District B cardinal — locked decision 10) hold their own facade families, massing
  recipes and a district-merged ground/road plane.
- **Do build** the ground/road merge *across* the district, per §6 — this is item D and it is the
  `BUD-2` fix.
- **Do NOT build** chunk streaming, load/unload, LOD switching, or a `Chunk.js`. Those are real
  Phase 2 work and they are not this run's. A statically-built pair of districts is the correct
  deliverable here.
- **Preserve the existing `StreetBlock` behaviour** unless the spec requires changing it. The Phase 1
  block is browser-verified and signed off by a human across five passes; regressing it would be a
  real cost. **If the cleanest path is to generalize `StreetBlock.js` rather than sit beside it, that
  is your call to make** — but say what you did and why in your report, and keep the tests green.

`Collision.js` exposes `CollisionWorld`, `createBoundaryBoxes(halfExtent, ...)`, and the cast helpers;
`Game.js:84-88` creates the collision world **before** the street block because the block registers
into it. Keep that ordering property intact for whatever you build.

---

## 4. Locked decisions that bind this run

`PIPELINE_STATE.md`'s locked-decisions table is **authoritative over every other document**,
including the knowledge base and the design spec. The ones that bind you:

| # | What it means for you |
|---|---|
| **1** | Three.js + Vite, ES modules. No new heavy dependencies without saying so. |
| **3** | Recognizable landmarks, **invented streets**. No real proper nouns; no OpenStreetMap geodata. |
| **7** | The 60-call Phase 1 ceiling is history. Budget against **150 both passes**. |
| **8** | The world is **bounded**, not endless. |
| **10** | The two districts: **District A** = dense tower plateau on the **36°-rotated** historic grid; **District B** = mixed-height boulevard corridor on the **cardinal** grid. **The rotation difference is the point** — it is what gives per-district lighting differentiation for free. Do not "simplify" it away. |
| **19** | **District A's 150 m landmark gets a sculpted, non-flat crown.** Every *other* District A roof stays flat per the §3.3 ordinance. **See the warning in §6 below.** |
| **20** | **District B's landmark is a sign/observation mast, not a building.** ⚠️ **Its name and signage text are NOT yours to invent** — locked decision 6 reserves all naming to the user. Build it with clearly-placeholder text and flag it in your report. |
| **21** | District A uses **Canary Island date palm**, District B keeps the shipped **Mexican fan palm**. *Vegetation is run 2's scope* — this is here so you do not contradict it in any shared code you touch. |
| **22** | **Leave `towerShared` / `midriseA` / `midriseB` facade constants exactly as they ship.** Do not nudge them toward glassiness. The dark-tower defect is closed on measured evidence and there is no problem left to solve. **New** families are yours to author freely; the *shipped* ones are frozen. |

---

## 5. You have a browser — use it, and prefer numbers to impressions

**`CLAUDE.md` at the repo root loads automatically and is binding.** Read it. Short version:

- `cd kodaman3d && npm run dev` (port 5173), then drive the scene through `window.__game`, which
  exposes `scene`, `renderer`, `hero`, `cameraRig`, `world`, `sky`.
- Set hero pose via `hero.state.position` / `.facing`, **not** `hero.group.position` — the group is
  overwritten from state every frame. This costs ten minutes to rediscover.
- Camera via `cameraRig.yaw` / `.pitch`; allow ~1.2 s for the rig to settle before capturing.
- Tuning is live on the shared object at `cameraRig.tuning`.
- **`renderer.renderer.info` gives draw calls, triangles, programs, textures.** This is how you
  verify the budget. `gl.readPixels` over fixed screen regions gives mean luminance.
- **Headless Chrome pins rAF to 60, so the fps HUD is meaningless.** Report **GPU frame time**
  instead (median and p95 over ~60 renders with a `gl.finish()` sync — spot-check 5 did this).
- Clean up when done: screenshots to the scratchpad, delete `.playwright-mcp/`, stop the dev server.
  **Leave the repo clean.**

**Report measured draw calls with the main/shadow split, triangles, programs and textures, before
and after your work.** An estimate where a measurement was possible is not acceptable in this
project.

---

## 6. Two things that will bite you if you do not know them up front

**⚠️ `BatchedMesh` has NO per-instance material override.** Settled this session by Review
(`RVW-7`) and independently re-verified by the orchestrator against the installed library:
the constructor takes one `material` for the whole batch
(`kodaman3d/node_modules/three/src/objects/BatchedMesh.js:192`), the per-geometry `geometryInfo`
record has **no material-index field** (`:632`), and the render path unconditionally reads
`_mesh.material = this.material` (`:1390`).

**Consequences you must design around, not discover:**
- §BGT-1's **4-call district-landmarks line stands** and cannot be optimized away.
- **Decision 19's sculpted crown cannot join District A's facade-family batch.** It needs its own
  `Mesh`. That is budgeted; just do not plan otherwise and then be surprised.
- Batching must be keyed by **facade material family** (§BUD-3, §4). One `Mesh` per building at
  realistic district counts is ~160 calls from buildings alone; batching by family drops it to
  ~12–16. **This is load-bearing, not polish.**

**⚠️ The `BUD-2` ground/road trap, restated because it is the single biggest budget risk and it
appears in no document before run 1's research.** Phase 1's `StreetBlock` builds 7 ground/road meshes
for one block. Repeating that pattern per district-tile is how this build silently costs 448 calls.
§6 of the spec designs around it explicitly — **implement §6's scheme, and measure it.**

---

## 7. What to read, in order

1. **`DESIGN_SPEC_PHASE_2_DISTRICTS.md`** — the artifact you are building. Read §1, §2, §4, §5, §6,
   §DA-4/§DB-4, §9/§BGT-1 and §10 fully. §3 (legal boundary) matters for the landmarks.
2. **`REVIEW_DESIGN_SPEC_PHASE_2_DISTRICTS.md`** (222 lines) — the gate it passed, the re-derived
   budget arithmetic, and the `BatchedMesh` finding. Short; read it all.
3. **`PIPELINE_STATE.md`** — **the locked-decisions table (1–22) and the "START HERE" section.**
   The file is ~1,300 lines; **do not read it end to end.** The table is near the top.
4. **`KNOWLEDGE_BASE.md`** (478 lines) — the consolidated map of the build: module wireframe, app
   lifecycle, the flight FSM. **Written 2026-07-31; its document index and decision list are
   incomplete (stops at decision 11). Incomplete, not wrong.** Best single orientation document.
5. **`RESEARCH_PHASE_2_WORLD.md`** — **consult by finding ID** (§BUD-2, §BUD-3, §BUD-6, §DEN-1,
   §DIS-2, §LOD-2), never end to end.
6. The code: `kodaman3d/src/world/StreetBlock.js`, `world/Sky.js`, `world/Collision.js`,
   `core/Game.js`, `core/Renderer.js`, and the three test files.

---

## 8. Acceptance criteria

Tag these in your report and state pass/fail with evidence for each.

1. Two districts exist with the **correct, different grid rotations** per locked decision 10.
2. **7 facade families** are implemented per §4, with the **shipped Phase 1 constants unchanged**
   (locked decision 22).
3. **5 massing recipes** are implemented per §5.
4. **Ground/road satisfies §6's district-merge scheme** — and you have *measured* that it does not
   reproduce the `BUD-2` per-tile explosion.
5. **Both landmarks exist**: District A's sculpted crown (decision 19) and District B's sign-mast
   (decision 20, placeholder text only).
6. **Measured total draw calls, both passes, with the main/shadow split**, against §BGT-1's ~69 and
   the 150 ceiling. Report triangles, programs and textures too.
7. **GPU frame time** median and p95, measured as described in §5. (Not fps — headless pins rAF.)
8. **`npm test` passes**, with new tests covering what you built.
9. **`kodaman_prototype.html` has a zero diff.**
10. **The repo is clean** — no stray screenshots, no `.playwright-mcp/`, dev server stopped.

---

## 9. Your report

Write `docs/handoff/ENGINEER_PHASE_2_DISTRICTS.md`. Model it on the existing
`ENGINEER_PHASE1_CLOSE.md` and `ENGINEER_FIX_REPORT.md`.

Cover: what you built and where; the acceptance criteria above with evidence; **the measured
before/after budget table**; every place the spec was wrong, unbuildable, or contradicted the code;
anything you cut and why; and anything you deliberately left for run 2. **Be honest about what you
did not finish** — a partial run reported accurately is far more useful to this pipeline than an
optimistic one.

If you hit something that genuinely needs a user decision, **do not guess** — write it into the
report under a clear heading and leave it. Naming anything is automatically in that category
(locked decision 6).

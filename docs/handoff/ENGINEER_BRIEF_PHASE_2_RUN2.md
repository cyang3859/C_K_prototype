# Engineer Brief — Phase 2 Districts, run 2 of 2

**Written:** 2026-08-01, session 10, by the orchestrator
**Model:** Opus (per the standing rule — all agents Sonnet except the Engineer)
**Your deliverable:** working code in `kodaman3d/`, plus `docs/handoff/ENGINEER_PHASE_2_RUN2.md`

**Run 1 built the districts. You do two things: dissolve Phase 1's block into District B, then
populate both districts with props.** The first pays for the second, which is why it comes first.

---

## 0. Process rules — absolute, and they exist because of real incidents

1. **Do NOT spawn subagents.** Do not use the Agent/Task tool for any reason. One agent in this
   pipeline fanned out to four children unprompted and burned the session budget. Do all work
   yourself.
2. **Commit incrementally, and often.** Three agents in this pipeline have been killed mid-task by
   session limits; only work already written to disk survived. **Commit after each numbered work
   item below, with tests green at every commit.** A half-finished run that left six good commits is
   a success; one that held everything in memory and died is a total loss.
3. **Never read `kodaman_prototype.html` in bulk.** 16,507 lines; it has killed agent budgets.
   Targeted `grep` only. You almost certainly do not need it at all. **It must end with a zero
   diff** — it is the untouched 2D design reference, per locked decision 2.
4. **Do not touch `main`.** Work on the current branch `feat/3d-open-world`. Do not merge, do not
   open or modify PRs. PR #3 is open and is the user's to handle.
5. **Tests must pass at every commit.** The suite is `cd kodaman3d && npm test` — currently
   **148/148**. Add tests for what you build; do not weaken existing ones to make something pass.
   **See §2 — this run has a specific and serious version of that risk.**
6. **If a document contradicts the code, the code wins — and say so in your report.** This has
   happened four times in this pipeline and each time the agent was right to flag it. It is a valued
   outcome, not insubordination. Once, an agent's *own* finding needed the same treatment.

---

## 1. What you are building

Run 1 delivered both districts: 7 facade families, 5 massing recipes, the §6 ground/road merge, and
both landmarks. It measured **83 draw calls (49 main / 34 shadow)** and **14,724 triangles**. Read
`ENGINEER_PHASE_2_DISTRICTS.md` for what it built and the four places it found the spec wrong.

Your scope is **locked decision 24, then the design spec's §10 priority items 4–11**, in that order.

| # | Item | Spec section | §10 rank |
|---|---|---|---|
| **1** | **Absorb Phase 1's `StreetBlock` into District B** — locked decision 24. **Do this FIRST.** | — (see §2) | — |
| 2 | **Primary vegetation** — Canary Island date palm (District A), Mexican fan palm (District B) | §8, §PROP-2 | 4 |
| 3 | **Rooftop HVAC + parapet coping ring** (District A) | §8 | 5 |
| 4 | **Storefront awnings + blade signs** (District B) | §8 | 6 |
| 5 | **Streetlamps + small props + parked cars** (world-shared) | §8 | 7 |
| 6 | **Broadleaf shade tree + utility poles** (District B) | §8 | 8 |
| 7 | **Hill/terrain landmark** | §PROP-3 | 9 |
| 8 | **Cut-priority tier** — café/market props → loading-dock bollards → scaffolding | §8 | 10 |

**§10 item 11 (FAM-3 / MAS-2 variety) is NOT in scope** — run 1 already built all 7 families and all
5 recipes, so that item is moot.

**Work the list in order and stop where you run out of budget** — either draw-call budget or session
budget. **The order is the spec's own, and it exists "so cuts are this document's decision, not the
Engineer's."** Items 7 and 8 are explicitly the first cut candidates. **Cutting from the bottom is a
success; silently reordering is not.**

### Explicitly out of scope

CSM/cascaded shadow maps, the day/night cycle, world streaming and chunk loading/unloading, the
world-edge fade (locked decision 11), and **anything to do with the hero, the rig, or animation**.
Several of those are Phase 2 work but they are *other* work — the character half has its own
research document and its own decisions (12–18) and is not yours.

---

## 2. Work item 1 — the absorption. Read this section twice.

**Locked decision 24: Phase 1's `StreetBlock` does not survive as a separate third area. Its content
folds into District B and the standalone block goes away.**

### Why, so you can make good judgment calls inside it

The design spec's ~69-call rollup **budgeted as though the two districts ARE the world.** Run 1
preserved Phase 1's block as well — correctly, it was not asked to remove it — which is why the
build measured **83 with 67 headroom** rather than ~81. Left unreconciled, **your own props line
(~35 calls) would land the world near ~118 and leave only ~32 for CSM**, whose cost is still the
biggest unmeasured unknown in the project.

**District B is the natural home:** it is the cardinal-grid mixed-height boulevard corridor, which
is exactly what the Phase 1 block already is.

### ⚠️ This is real engineering, not bookkeeping. Four things must not be lost.

`StreetBlock.js` (1,288 lines) carries load-bearing content that predates the districts:

1. **The hero spawn.** `Game.init()` spawns the hero at `(0, 0, 13)` — "on the sidewalk, clear of
   building footprints, facing the boulevard." Wherever the hero ends up spawning after the move, it
   must still be on a sidewalk, clear of footprints, and not inside a building.
2. **The 90 m helipad tower.** **This has been signed off by a human across five browser passes.**
   Its roof-atlas helipad art and its 4-bar parapet ring (the fix that made the helipad visible at
   all — a solid slab was covering it) must survive. **If you lose the helipad, the run has failed
   regardless of what else it achieved.**
3. **Its collider registrations.** `Game.js` creates the `CollisionWorld` **before** the street block
   because the block registers its AABBs into it as it builds. Whatever replaces that ordering must
   preserve the property, and the parapet's second `Box3` must survive too.
4. **Most of `tests/world.test.js`.** This is where rule 0.5 gets sharp: **a large fraction of the
   existing suite asserts against `StreetBlock`.** You will be tempted to delete failing tests.

**On those tests specifically.** Some genuinely encode "the Phase 1 block exists as a standalone
area," and that assumption is what decision 24 retires — those may legitimately change. Others
encode things that must remain true no matter where the content lives (the helipad exists; the
parapet is a 4-bar ring not a slab; the facade constants are byte-identical; the hero spawns clear
of geometry). **Those must survive the move, re-pointed at their new home rather than deleted.**

**In your report, list every test you changed or removed, with one line on which of those two
categories it fell into.** That list is the main evidence the orchestrator will check this work by.

### How far to go

**The generalization call is yours** — run 1 was given the same latitude and used it well (it lifted
`StreetBlock.js`'s canvas kit into `facadeAtlas.js`, which is why the file shrank 1,608 → 1,288).
The block's content may become District B lots, a hand-authored sub-district within District B, or
something else you judge cleaner. **What matters is: the content survives, the standalone area does
not, and you say what you did and why.**

**Measure the draw-call delta of the absorption on its own, before you add a single prop.** That
number is the whole justification for doing this first, and nobody has measured it yet.

---

## 3. The budget — this is a hard requirement, not a target

- **Every draw-call figure in this project is a TOTAL ACROSS BOTH PASSES** (main + shadow), because
  that is what `renderer.info.render.calls` reports. **Always state the main/shadow split alongside
  any total.**
- **Your starting point is the MEASURED 83 (49 main / 34 shadow), not §BGT-1's ~69.** The spec's
  rollup is a pre-absorption planning figure; the 83 is what the code actually does today.
- **Ceiling: 150 calls, both passes** (`RESEARCH_PHASE_2_WORLD.md` §BUD-6).
- **Your props line is ~35 calls** (§PROP-4: ~20 main / ~15 shadow). The absorption gives some back
  before you spend it — **how much is a thing you will measure, not a thing anyone knows.**
- **Headroom is not free.** CSM's real shadow cost is unmeasured and is the single most consequential
  open unknown in the project. The headroom exists to absorb it. **Do not spend it.**

**If the absorption gives back less than you need for items 2–8, cut from the bottom of §10's order
and say so.** That is the correct outcome, not a failure.

### ⚠️ A budget dependency you must know about: `WEBGL_multi_draw`

**`BatchedMesh` falls back to a real draw call per geometry when the `WEBGL_multi_draw` extension is
absent** — verified at source in `node_modules/three/src/renderers/WebGLRenderer.js`, in the
`object.isBatchedMesh` branch. **~170 calls instead of 7 for this build.** The extension was measured
**present** in this environment, so your measurements will be fine — but it means **every batched
figure in this project is conditional on hardware you are not testing on.** Relevant to you because
§8 puts small props in a `BatchedMesh`: prefer `InstancedMesh` where a single geometry suffices, and
reserve `BatchedMesh` for the genuinely multi-variant pools (`LOD-3`'s case), so the fallback's blast
radius stays small. **Do not build a capability check** — that is a separate decision, not this run's.

### And one that will bite you: `BatchedMesh` has NO per-instance material override

Settled against the installed `three@0.185.1` by Review (`RVW-7`) and independently re-verified
twice: the constructor takes one `material` for the whole batch (`BatchedMesh.js:192`),
`geometryInfo` has no material-index field (`:632`), and the render path unconditionally reads
`this.material` (`:1390`). **One batch = one material.** Colour variety within a pool comes from
`setColorAt` on an `InstancedMesh` (which is what §8 specifies for parked cars), not from
per-instance materials.

---

## 4. Locked decisions that bind this run

`PIPELINE_STATE.md`'s locked-decisions table is **authoritative over every other document**,
including the knowledge base and the design spec. The ones that bind you:

| # | What it means for you |
|---|---|
| **1** | Three.js + Vite, ES modules. No new heavy dependencies without saying so. |
| **3** | Recognizable landmarks, **invented streets**. No real proper nouns; no OpenStreetMap geodata. |
| **6** | **Naming authority is the user's. You may not invent a name for anything** — not a shop, not a street, not the hill. Use clearly-placeholder text and flag it in your report. The last run's `PLACEHOLDER` string was deliberately implausible **so an unapproved name could not ship by looking reasonable, and that worked.** Do the same. |
| **7** | The 60-call Phase 1 ceiling is history. Budget against **150 both passes**. |
| **8** | The world is **bounded**, not endless. |
| **10** | District A = 36°-rotated grid; District B = cardinal. **The rotation difference is the point.** Props you place must respect each district's grid — a streetlamp row that ignores District A's 36° rotation will read as broken. |
| **21** | **District A gets Canary Island date palm; District B keeps the shipped Mexican fan palm.** ⚠️ **This is a real change to what Phase 1 currently renders, not new-content-only** — the shipped block's palms change species as part of the absorption. Do not miss that half of it. |
| **22** | **Leave `towerShared` / `midriseA` / `midriseB` facade constants exactly as they ship.** Do not nudge them toward glassiness. Closed three times on measured evidence; a byte-equality test enforces it (`districts.test.js:60-63`). **New** prop materials are yours to author freely. |
| **23** | The mast's sign text is `AKC ENTERPRISE`, lives in `MAST_SIGN_TEXT` (`landmarks.js`) and is **pinned by a test**. **This is the only name anywhere in `kodaman3d/`. Do not add a second one.** |
| **24** | Work item 1. See §2. |

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
  instead (median and p95 over ~60 renders with a `gl.finish()` sync).
- Clean up when done: screenshots to the scratchpad, delete `.playwright-mcp/`, stop the dev server.
  **Leave the repo clean.**

### ⚠️ "The object renders" is not the same check as "the object reads"

**This run's most likely failure mode, and it caught the last run.** Session 9's automated pass
verified the sign-mast existed and its text was present, and signed the landmark off. **A human then
caught in one screenshot that the name was illegible** — the column bisected the board and the text
overflowed its face. Three separate fixes followed.

You are placing **hundreds of small props**. A scene-graph walk proving they exist proves almost
nothing about whether they read correctly. **Look at screenshots of what you build**, and check the
things a count cannot: are palms intersecting buildings? Are streetlamps standing on the roadway
instead of the sidewalk? Do District A's props follow its 36° grid? Are parked cars floating, or
half-buried, or facing into the kerb?

**Two defects in run 1 were catchable only in a browser** — FAM-5's terracotta landing on every roof,
and the signage overflow. Neither was catchable by review or by the test suite.

**And when something looks wrong, measure rather than look harder.** Fix 3 of the signage defect was
diagnosed by reading the texture atlas back with `getImageData` and measuring the text's bounding
box — which showed the texture was *already* correct and the board's aspect ratio was the real
problem. Enlarging text that was already the right size would have wasted several rounds.

---

## 6. What to read, in order

1. **`ENGINEER_PHASE_2_DISTRICTS.md`** (431 lines) — run 1's report. **Read it first**; it is the
   state you are building on, and its "where the spec was wrong" section will save you time.
2. **`DESIGN_SPEC_PHASE_2_DISTRICTS.md`** — read **§8 fully** (it is your scope), plus §PROP-1
   through §PROP-4, §9/§BGT-1, and §10. §6 matters for how ground/road already works.
3. **`KNOWLEDGE_BASE.md`** (705 lines) — **refreshed 2026-08-01 and current.** Module wireframe, app
   lifecycle, the settled decisions (1–24), the `WEBGL_multi_draw` note, and §9's working practices.
   **Best single orientation document — start here for the code, not the spec.**
4. **`PIPELINE_STATE.md`** — **the locked-decisions table and the "START HERE" section only.** The
   file is ~1,550 lines; **do not read it end to end.** The table is near the top.
5. **`RESEARCH_PHASE_2_WORLD.md`** — **consult by finding ID** (§BUD-4 for instancing strategy,
   §BUD-6 for the ceiling, §DEN-4/§DEN-5/§DEN-7/§DEN-8 for props, vegetation and terrain), never end
   to end.
6. The code: `world/StreetBlock.js` (what you are dissolving), `world/District.js`,
   `world/districts.js`, `world/landmarks.js`, `core/Game.js`, `world/Collision.js`, and
   `tests/world.test.js` + `tests/districts.test.js`.

---

## 7. Acceptance criteria

Tag these in your report and state pass/fail with evidence for each.

1. **The standalone Phase 1 block no longer exists as a separate area**, and its content lives in
   District B (locked decision 24).
2. **The helipad tower survives** — geometry, roof art, and the 4-bar parapet ring. **Show a
   screenshot.**
3. **The hero spawns on a sidewalk, clear of building footprints**, wherever it now spawns.
4. **Collider registrations survive**, including the parapet's second `Box3`, and `Game.js`'s
   create-collision-before-world ordering property is intact.
5. **Every test change is listed and categorized** per §2. No test that encodes a still-true
   invariant was deleted.
6. **The absorption's draw-call delta, measured on its own**, before any props were added.
7. **Vegetation per decision 21** — Canary palm in District A, Mexican fan palm in District B,
   **including the species change to the absorbed Phase 1 content.**
8. **§10 items 5–8 built, or explicitly cut from the bottom of the order with the reason stated.**
9. **Measured total draw calls, both passes, with the main/shadow split**, against the 83 baseline
   and the 150 ceiling. Report triangles, programs and textures too.
10. **GPU frame time** median and p95. (Not fps — headless pins rAF.)
11. **Props were looked at in a browser, not just counted** — see §5. Report what you checked.
12. **`npm test` passes**, with new tests covering what you built.
13. **`kodaman_prototype.html` has a zero diff.**
14. **The repo is clean** — no stray screenshots, no `.playwright-mcp/`, dev server stopped.

---

## 8. Your report

Write `docs/handoff/ENGINEER_PHASE_2_RUN2.md`. Model it on `ENGINEER_PHASE_2_DISTRICTS.md`.

Cover: what you built and where; the acceptance criteria above with evidence; **the measured
before/after budget table, with the absorption broken out separately from the props**; the test
change list from §2; every place the spec was wrong, unbuildable, or contradicted the code; anything
you cut and why. **Be honest about what you did not finish** — a partial run reported accurately is
far more useful to this pipeline than an optimistic one, and this brief is deliberately scoped so
that stopping partway down §10's order is a normal outcome rather than a failure.

If you hit something that genuinely needs a user decision, **do not guess** — write it into the
report under a clear heading and leave it. **Naming anything is automatically in that category**
(locked decision 6).

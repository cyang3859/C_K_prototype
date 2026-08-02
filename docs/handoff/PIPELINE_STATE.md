# Pipeline State — Resume Checkpoint

**Last updated:** 2026-08-02 (session 12 — session 11's mid-refactor break is repaired, Standards 10 is done, and the refactor guard's blind spot is closed. Previously session 11 — the code review ran and 16 of its 18 findings are fixed; see the resume block. Previously session 8 — closed by the user. Browser testing moved to Playwright MCP, see `CLAUDE.md`; spot-check 5 run and recorded; no code touched)
**Branch:** `feat/3d-open-world` (based on `origin/dev` @ `5f62309`)
**Purpose:** Read this file FIRST. It is the single source of truth for where the 3D
migration pipeline stopped and what to do next. Written to survive a cleared chat history.

---

## START HERE — cold resume in five minutes

**The project.** Migrating `kodaman_prototype.html` — a 16,507-line single-file 2D canvas
superhero game — into a 3D open-world game set in Los Angeles, built with Three.js + Vite in
a new `kodaman3d/` directory. The 2D game is never edited; it is the design reference.

**How work is organized.** A **6-agent** pipeline the user specified. Research **branches**:
technical and worldbuilding requirements go Research -> Review -> Engineer, while visual and
look-and-feel components go Research -> **Design** -> Engineer, with Design's output passing
through Review for a **budget and feasibility check only** on the way. Then Engineer -> QA ->
Overview. The main assistant orchestrates and gates each handoff rather than having agents
spawn one another, because the user's feedback loops (Review->Research, QA->Engineer) require
something to evaluate output and decide to send it back. All handoff documents live in
`docs/handoff/`.

The Design agent was added 2026-07-30 (session 3) after the human QA pass. See
`DESIGN_AGENT_BRIEF.md` for its charter, the Research->Design handoff contract, and its spawn
prompt.

**Read these in order to get current:**
0. **`CLAUDE.md` (repo root) — loads automatically, but know it exists.** New in session 8. Carries
   the Playwright-first browser-testing rule and the `window.__game` driving notes.
0. **`KNOWLEDGE_BASE.md` (705 lines) — START HERE.** The Overview agent's consolidated map: module
   wireframe, app lifecycle, the flight FSM written from the code, the settled decisions, and an
   index of every other document with when to read it. It exists precisely so nobody has to read the
   document pile cold. **✅ REFRESHED 2026-08-01, session 10 — the staleness warning that used to sit
   here is resolved.** Its wireframe, decision list (now 1–24), open-items list and document index
   are all current and were re-measured rather than carried forward. It gained a §2 subsection on the
   `WEBGL_multi_draw` dependency and a §9 on working practices. **Its header documents exactly what
   changed**, so an older document's figures can still be placed.
1. This file — decisions 1–18, status, resume pointer. **The locked-decisions table is authoritative
   over every other document**, including the knowledge base.
2. **`RESEARCH_PHASE_2_WORLD.md`** (1,009 lines) and **`RESEARCH_PHASE_2_CHARACTER.md`** (937 lines) —
   Phase 2's two research runs, complete and spot-checked. **Consult by finding ID, never
   end-to-end.** IDs are unique across both (run 2 continued run 1's numbering).
3. **`DESIGN_SPEC_PHASE_2_DISTRICTS.md`** (760 lines) — the current live deliverable, awaiting
   Review's feasibility gate. Its §BGT-1 carries an annotated orchestrator correction.
4. **`DESIGN_AGENT_BRIEF.md`** — the Design agent's charter. **Corrected at source 2026-08-01**;
   safe to spawn from directly again. Read before spawning anything design-related.
5. `QA_HUMAN_RESULTS.md` — the human test pass; 3 confirmed bugs + 1 suspected, assigned
6. `REVIEW_FLAGS.md` — 12 adjudicated flags; the rulings are decisions already made
7. `ENGINEER_BRIEF.md` — the self-contained Phase 1 build order
8. `IMPLEMENTATION_PLAN.md` — phases beyond 1. **Its Phase 2 acceptance criterion 2 ("under 150") is
   a pre-correction guess with no stated pass convention** — superseded by §BUD-6's derived ceiling.
9. `RESEARCH_FINDINGS.md` and `RESEARCH_LA_WORLDBUILDING.md` — consult by section, never end-to-end

**Never read `kodaman_prototype.html` in bulk.** 16,507 lines; it has killed agent budgets.
Targeted `grep` only.

**Standing working rules** (also stored in persistent memory, so they survive a cleared chat):
- **Run browser checks yourself via the Playwright MCP connector** — see `CLAUDE.md` at the repo
  root, which loads automatically. Ask the user only for what genuinely needs a human eye, and say
  what and why. **This supersedes the older "agents have no browser or GPU" premise** that appears
  throughout this file and the spot-check documents. Added 2026-08-01, session 8.
- All agents run **Sonnet** except the **Engineer**, which runs **Opus**.
- **Every agent prompt must explicitly forbid spawning subagents.** One fanned out to four
  children unprompted and burned budget.
- Instruct agents to **write files incrementally**. Three agents have been killed mid-task;
  only persisted work survived.
- Log cumulative subagent tokens per session. Begin prepping to pause near **400k**. Do not
  pause until the user says so. **Never attempt to look up account usage** — no tool exposes
  it, and the user asked for that to stop.
- If genuinely unsure at a handoff, pause and ask the user rather than guessing.

---

## Locked decisions — do not revisit

| # | Decision | Value |
|---|---|---|
| 1 | 3D stack | **Three.js + Vite** (npm, ES modules, hot reload). Single-file/no-build-step constraint deliberately abandoned. |
| 2 | Migration strategy | **New 3D build, port content forward.** `kodaman_prototype.html` stays untouched and playable as spec/reference. |
| 3 | LA realism | **Recognizable landmarks, invented streets.** No OpenStreetMap geodata import. |
| 4 | Delivery | **Feature branch + PR against `dev`.** No agent pushes `main`. No deploy target exists. |
| 5 | Trademark handling | **Rename in the 3D build ONLY.** `kodaman3d/` uses original, legally-distinct names from day one. `kodaman_prototype.html` keeps its current names and is NOT edited. |
| 6 | Naming authority | **Agents propose, user approves.** Research delivers the old->new mapping table with rationale. No agent applies a rename before user sign-off. |
| 7 | Draw-call ceiling | **The 60 ceiling is a Phase 1 number and is deliberately raised for Phase 2.** Set the new figure from a **measured worst case**, not a guess. User decision 2026-07-30. **See the correction below — every draw-call figure used before 2026-07-31 undercounted by roughly half.** |
| 8 | World extent | **Vast and explorable, but BOUNDED.** Explicitly *not* endless open world. User decision 2026-07-30. |
| 9 | Skeletal animation | **Pulled forward into Phase 2** (was Phase 5). Accepts imported rigged assets, which supersedes the Phase 1 primitives-only constraint from Phase 2 onward. User decision 2026-07-30. |
| 10 | The two Phase 2 districts | **A dense tower-plateau district on the 36°-rotated historic grid, paired with a mixed-height boulevard corridor on the cardinal grid.** User decision 2026-07-31, on `RESEARCH_PHASE_2_WORLD.md` §DIS-2's recommendation. The rotation difference between the two grids is the point: the same sun rakes them differently at the same hour, so `DayNightCycle.js` gets per-district visual differentiation for free. Historic Core/Broadway was the argued alternative — higher landmark density and lower authoring risk, but it shares DTLA's rotation and loses the contrast. It stays a strong candidate for a later detail pass or a third district. |
| 11 | World edge behaviour | **A hard wall behind an atmospheric fade — both, not either.** User decision 2026-07-31, on §DIS-3. Phase 1's four-`Box3` boundary mechanism carries forward unchanged but moves out to the true edge; a radial fade driven by distance-from-centre whites out visibility well before the hero can reach it. The wall is an unreachable safety net, never the player's experience. No new rendering system — the fade is a per-frame tuning value feeding the existing `Fog`, the same shape as `Sky.update()`'s `ENV_INTENSITY` write. |
| 12 | Hero shading model | **Stay on PBR (`MeshStandardMaterial`). No toon shading.** User decision 2026-08-01, on §ART-2. The hero keeps consuming the world's PMREM environment map — the same indirect-specular mechanism the tower-facade fix was built for. Per §ART-1 the **Superhero proportion set carries the comic-accurate read instead of the shading model**, and the user's own reference games (RDR2, Watch Dogs, Ghost of Tsushima) are stylized-realistic, not cel-shaded. `MeshToonMaterial` was the argued alternative and is rejected: it has no `envMap` property at all, so it would opt the hero out of that mechanism entirely. |
| 13 | Outline treatment | **None. Not built, not toggled.** User decision 2026-08-01, on §ART-3. Screen-space edge detection is blocked until Phase 7 by the standing no-post-processing rule; inverted hull was the only compatible technique and costs +1 draw call per outlined material group. Skipping it keeps the hero's budget clean and avoids committing to a look before a rig exists. Revisit only if the PBR hero reads as insufficiently comic once seen in a browser. |
| 14 | Hero material grouping | **4 material groups — suit, skin, accent, and the cape as its own group. Visible face, NOT a full cowl. 8 draw calls total across both passes (4 main / 4 shadow).** User decision 2026-08-01, on §DRAW-2. Down from Phase 1's 14. The 4-call full-cowl floor was the argued alternative and is rejected: a visible face directly serves the user's "character isn't human enough" feedback, and §DRAW-2 calls the 3 *body* groups the art-direction-neutral target. **The 8 is a budget the Engineer must hit, not an aspiration** — a rig built object-by-object instead of merged stays at 14 and silently wastes the entire gain. **⚠️ WORDING CORRECTED 2026-08-01, session 9, after Review's `RVW-9` flagged a contradiction with the design spec's §BGT-1.** This row previously read "3 material groups — suit, skin, accent/cape", folding the cape in with accent. **That was wrong and self-contradictory: 3 groups is 3 main + 3 shadow = 6 calls, not the 8 this same row states.** `RESEARCH_PHASE_2_CHARACTER.md` §DRAW-2's recommended row is explicit — *"1 `SkinnedMesh`, 3 material groups (suit/skin/accent), cape as a 4th group or separate mesh → 4 / 4 / **8***"*, and the cape needs its own material either way (§CAPE-1, double-sided, different shading). **No budget figure anywhere changes** — every downstream document already used the 8, which was only ever derivable from the 4-group reading. Review called the two readings "identical either way"; they are not, and the 4-group reading is the correct one. |
| 15 | Asset source | **Quaternius only for Phase 2. Mixamo is OUT of scope this phase.** User decision 2026-08-01, on §ASSET-3/§ASSET-5. Mixamo's terms permit shipping inside a game, but a permanently-archived *public* git history of Mixamo-derived `.glb` is not a scenario those terms clearly anticipate — not a violation, not unambiguously clean. Quaternius is unambiguous CC0, so this **sidesteps the question rather than answering it.** Mixamo may be reconsidered in a later phase if a specific motion is genuinely unavailable. Kenney stays reserved for future crowd/NPC work per §ASSET-4, never for the hero. |
| 16 | Animation authoring scope | **Floor first, then decide on the enhanced tier.** User decision 2026-08-01, on §CLIP-3/§CLIP-4. Ship §CLIP-3's 4 assets (idle/walk/run sourced CC0, one custom flight hold), see the rig moving in a browser, and only then decide whether §CLIP-4's remaining ~6 are worth authoring. Every flight-specific clip is custom either way (§CLIP-5 — flying humans are not a mocap category), so this **defers the expensive half until the cheap half is proven.** The enhanced tier is deferred, NOT rejected — it is what actually answers the Ghost of Tsushima fluidity reference. |
| 17 | Floating-origin precision test | **Run §ORG-6's synthetic test as soon as a rigged hero exists in Phase 2. Do not defer to Phase 5.** User decision 2026-08-01. It is **a test, not a system** — no `FloatingOrigin.js`, nothing beyond the rig being built anyway. Spawn the rigged hero at 0 / 1,024 / 2,048 / 3,072 / 6,144 m, apply identical bind and animated poses, diff world-space vertex positions against an origin-computed pose rigidly translated. Run 1 deferred this only because no skinned mesh existed to test; locked decision 9 removes that precondition. Running it late risks discovering jitter after the animation work is already built on the rig. |
| 18 | Quaternius tiers | **The "60–70% free" figure is a CONTENT/FORMAT tier, not a licence split. Everything is CC0.** Orchestrator-verified 2026-08-01 — see the §ASSET-2 correction in the session 7 block. Free tiers ship **glTF/GLB**, which is the only format this project needs. **Start on the free tiers; the paid tiers are a $9.99–$20 content upgrade, not a licence unlock, and can be bought later without rework.** |
| 19 | District A landmark cap | **Sculpted, non-flat crown on the 150 m landmark alone.** User decision 2026-08-01, on the design spec's §12 item 1 / §DA-4. Every other District A roof stays flat per §3.3's ordinance. The landmark's job is to be a **navigation beacon**, which directly serves the user's own "empty world, too few landmarks" feedback; a distinctive silhouette does that and equal height alone does not. Flat-topped was the argued alternative and is rejected: it preserves "every roof is a legible helipad" with no exceptions, but the cost of the exception is **one un-landable roof out of ~40**, which is cheap against a district-scale readability gain. **Two consequences the Engineer owns:** the crown is bespoke geometry, so it is the exact case §11 item 1's `BatchedMesh` per-instance-material question decides (batchable → 0 extra calls; not → the dedicated `Mesh` line stands), and its triangles must fit the §BGT-1 headroom rather than being assumed free. |
| 20 | District B landmark identity | **A sign / observation mast, not a landmark building.** User decision 2026-08-01, taking the spec's own recommendation at §12 item 2 / §DB-4. Cheaper, authentic to a boulevard corridor per §5.9, and it reads as a **distinct silhouette class** against District A's tower plateau — which reinforces the district contrast that locked decision 10 exists for. A landmark building was the argued alternative; `MAS-3` stays on the shelf as a fallback recipe, so overturning this later costs no redesign. **The mast's name, signage text and specific art remain the user's per locked decision 6** — nothing has proposed them and no agent may invent them. |
| 21 | Vegetation species split | **District A swaps to Canary Island date palm; District B keeps Phase 1's shipped Mexican fan palm.** User decision 2026-08-01, on §12 item 3 / §PROP-2. District differentiation is the point of the two-district pairing, this is cheap to author, and both species are confirmed in `RESEARCH_LA_WORLDBUILDING.md`. ⚠️ **This row's original closing note said "the shipped block's palms change species." That is now WRONG, and decision 24 is what made it wrong** — corrected 2026-08-01, session 10, after the Engineer flagged it. The note was written when Phase 1's block was still a separate area. **Decision 24 folds that block into District B, and District B is the district that KEEPS the Mexican fan palm** — which the block already had. So decision 21 requires the absorbed content to *stay* as it is, and Phase 2 changes no shipped palm at all. **Neither decision anticipated the other; the interaction is only visible once both are applied.** Verified: the absorbed palms' placement hashes are byte-identical to Phase 1's. |
| 22 | Shipped facade constants | **Leave `towerShared` / `midriseA` / `midriseB` exactly as they ship. Do NOT nudge toward glassiness.** User decision 2026-08-01, on §12 item 4 / §MAT-1. Spot-check 5 measured the far towers at **+780% / +637% mean luminance** under the env map at these exact values; the dark-tower defect is closed and there is no problem left for a constants change to solve. Changing browser-verified values with no defect driving them is how regressions enter. **This closes the metalness-raise question for the third and last time** — sessions 5 and 8 both closed it on the same reasoning, once by eye and once on measurement. The option stays physically defensible if a later phase finds a real reason; "it would be cheap right now" is not one. |

| 23 | The mast's name | **`AKC ENTERPRISE`.** User-supplied and approved 2026-08-01, on the sign/observation mast of locked decision 20. **This is the ONLY name anywhere in `kodaman3d/`** — everything else stays generic pending the trademark naming table, and locked decision 6 still reserves every future name to the user. It replaced the literal string `PLACEHOLDER`, which was deliberately implausible so an unapproved name could not ship by looking reasonable; that worked, and the question reached the user instead of being settled by an agent. The text now lives in one exported constant, `MAST_SIGN_TEXT` (`landmarks.js`), **pinned by a test** (`districts.test.js`) — not because this string is aesthetically load-bearing, but so a name can only ever change by the same sign-off that put it there. |
| 24 | Phase 1's block is ABSORBED into the districts | **The Phase 1 `StreetBlock` does not survive as a separate third area. Its content is folded into District B and the standalone block goes away.** User decision 2026-08-01, resolving the §BGT-1 reconciliation the Engineer's run 1 surfaced. **The spec's ~69-call rollup budgeted as though the two districts ARE the world; the build preserved Phase 1's block as well, which is why it measured 83 with 67 headroom rather than 81.** Left unreconciled, run 2's ~35-call props line would have landed the world near ~118 and left only ~32 for CSM — whose cost is still the biggest unmeasured unknown in the project. **District B is the natural home: it is the cardinal-grid mixed-height boulevard corridor, which is exactly what the Phase 1 block already is.** ⚠️ **This is real engineering work, not bookkeeping** — the block carries the hero spawn, the browser-verified 90 m helipad tower, its collider registrations, and most of `tests/world.test.js`. **None of that may be lost in the move**; the helipad tower in particular has been signed off by a human across five browser passes. Scoped into **Engineer run 2**, ahead of the props line it pays for. |

| 25 | The hill's name | **`Coco Hill`.** User-supplied and approved 2026-08-01, on the §PROP-3 landform Engineer run 2 built. **The second name in `kodaman3d/`**, after decision 23's `AKC ENTERPRISE`; locked decision 6 still reserves every future name to the user. Lives in one exported constant, `HILL_NAME` (`terrain.js`), **pinned by a test** — plus a second test asserting these are the **only two** names in the build, so an agent inventing a third (a shop, a street) fails rather than ships. ⚠️ **Nothing renders it yet and that is deliberate:** there is no signage, map label or HUD for a landform name to appear on. The constant reserves the name ahead of the surface that will display it. **Do not invent a hillside sign to justify it** — that is a design decision nobody has made. |
| 26 | Roof furniture on District B | **Rooftop HVAC and parapet coping rings go on District B's generated buildings too, not just District A's.** User decision 2026-08-01. The design spec's §10 item 5 scoped them to District A and run 2 followed it. **Zero draw calls** — both pools already existed and already spanned the annex, so this only adds instances: parapet bars **168 → 312**, rooftop units **86 → 158**, world total **still 78 (44/34)**, verified in a browser. ⚠️ **One real consequence: rooftop units are colliders on purpose** (a player who can land on a roof can walk into one), so the world's collider count rises by 72. That is why `world.test.js`'s collider-count assertion changed, and the change is this decision rather than drift. |
| 27 | The annex/District B road join | **The absorbed boulevard joins District B's grid via a connector on the district boundary.** User decision 2026-08-01, choosing the orchestrator's recommendation over the two alternatives in run 2's report §8.2. Run 2 left the boulevard dead-ending 20 m short — floored but empty, and **a traversal dead end for anyone walking east**, not merely an aerial blemish. **A straight extension does not work:** the boulevard runs at local z = 0, which is a *cell centre* in District B's grid, not a street line (`STREET_LINES` is ±50), so continuing it drives the road into the western building row — which is exactly the objection run 2 raised. **The connector answers it:** the boulevard T-junctions into a north–south link centred on the district boundary, and that link meets both of District B's east–west streets. **It sits ON the boundary because the margin there is exactly `ROW / 2`** — half a right-of-way, which is the grid's tiling intent rather than an accident, so a boundary street abuts the building row precisely. Shifting District B's origin west was the argued alternative and is rejected: it moves 36 reviewed-in-aggregate buildings for a cosmetic gain. **Zero draw calls** — the strips merge into the same three geometries as every other district street. |

## Model assignment

Per user instruction: **all agents run Sonnet except the Engineer agent, which runs Opus.**

Exception on record: the LA worldbuilding agent was resumed on its original model (Opus)
because its research existed only in its transcript. Resuming to persist it was cheaper than
re-running ~59 tool calls of research on Sonnet. One-time, deliberate.

---

## Agent pipeline status

**Session 2 ended 2026-07-30, paused deliberately by user.**

| Stage | Model | Status | Output |
|---|---|---|---|
| Research — Phase 1 spec | Opus | **done** | `PHASE_1_SPEC.md` (511 lines) |
| Research — LA worldbuilding | Opus | **done** | `RESEARCH_LA_WORLDBUILDING.md` (688 lines) |
| Research — architecture/characters/constraints | Sonnet | **done** | `RESEARCH_FINDINGS.md` (920 lines, A1–A13 / C1–C4 / D1–D4, no gaps) |
| Review — flags | Sonnet | **done** | `REVIEW_FLAGS.md` (355 lines) |
| Review — implementation plan | Sonnet | **done** | `IMPLEMENTATION_PLAN.md` (594 lines) |
| Review — engineer brief | Sonnet | **done** | `ENGINEER_BRIEF.md` (917 lines, 28 tagged acceptance criteria) |
| Review — summary | Sonnet | **not written** (low value now; the brief superseded it) | `REVIEW_SUMMARY.md` |
| Engineer — Phase 1 | **Opus** | **done** | `kodaman3d/` — 25 files, 6,691 lines, 4 commits |
| QA — headless agent | Sonnet | **never run** (superseded for the 13 `[HUMAN]` criteria) | `QA_REPORT.md` |
| QA — human test pass | user | **done** | `QA_HUMAN_RESULTS.md` — 10 pass, 1 pass-with-defect, 1 fail |
| Engineer — bug fixes B1–B4 | **Opus** | **done** — 4 commits, tests 76/76 | `ENGINEER_FIX_REPORT.md` |
| Human spot-check of the fixes | user | **NOT DONE — user declined for now** | 6-step checklist in the fix report |
| Design — buildings | Sonnet | **done** | `DESIGN_SPEC_PHASE_1_BUILDINGS.md` (446 lines) |
| Review — feasibility gate | Sonnet | **done** — APPROVED WITH CORRECTIONS | `REVIEW_DESIGN_SPEC_BUILDINGS.md` |
| Engineer — B5 limb pose | orchestrator, inline | **done** — commit `44df9fe` | `Hero.js` flight pose |
| Engineer — building spec + budget | **Opus** | **done** — 3 commits, tests 95/95 | `ENGINEER_PHASE1_CLOSE.md` |
| Browser spot-check 2 | user | **done** — all steps pass; 2 feel notes, 1 palette defect | results in this file |
| Flight lean + 12 m helipad | orchestrator, inline | **done** — commit `fd33b41`, 99/99 tests | not yet seen in a browser |
| Design — character | Sonnet | not spawned (**blocked on the B5 decision**) | `DESIGN_SPEC_PHASE_1_CHARACTER.md` |
| Overview | Sonnet | **done** — 127,078 tokens | `KNOWLEDGE_BASE.md` (478 lines) |
| envMap — PMREM sky environment | orchestrator, inline | **done** — commit `6a07c13`, 108/108 | `BROWSER_SPOT_CHECK_5.md` — **run under Playwright, session 8, 4/4 pass, results recorded in the doc** |
| Research — Phase 2 world (run 1 of 2) | Sonnet | **done** — 198,801 tokens | `RESEARCH_PHASE_2_WORLD.md` (1,009 lines, 38 findings) |
| Research — Phase 2 character (run 2 of 2) | Sonnet | **done** — 215,614 tokens | `RESEARCH_PHASE_2_CHARACTER.md` (937 lines, 29 findings) |

⚠️ **That table stops at session 6 and is not maintained.** For current status read the resume block
above; for the code read `KNOWLEDGE_BASE.md`. **Re-measured 2026-08-01, session 10: the planning
corpus is ~14,300 lines across 34 documents, and `kodaman3d/src` is 8,867 lines across 24 files** —
the "4,132 lines across 7 documents / 6,691 lines of code" figures this line used to carry were a
session-5 snapshot.

---

## >>> ✅ SESSION 11's BREAK IS REPAIRED — Standards 10 is DONE (session 12, 2026-08-02) <<<

**The repo is clean again. `af0672a`. 189 tests. Working tree clean apart from the pre-existing
untracked `KODAMAN_HANDOFF.md`.**

`WorldProps.js` parses and all 15 `_build*` sites are on the `_fill(mesh, list, place)` helper.
**The malformed site was `_buildShadeTrees`, NOT `_buildParkedCars`** as this file predicted — the
loop header had been replaced with a `_fill` call but the body and its closing brace were left
behind, so the method closed a `for` loop with `});`. **Repaired in place** (resume option 2)
rather than reverted, because the diff read cleanly hunk by hunk and only that one site was
broken. The three sites the machine pass had skipped — parked cars, bollards, cafe props — were
then converted by hand. `_buildSmallProps` stays as it is: a `BatchedMesh` writes through
`addInstance`/`setMatrixAt` into a texture and is not the shape `_fill` extracts.

**Verified in a browser after the fix: 78 draw calls (44 main / 34 shadow), unmoved.** 16
instanced pools, 1,835 instances, **zero stranded at the origin**, console clean apart from the
known favicon 404 and the `PCFSoftShadowMap` deprecation.

### ⚠️ THE REFACTOR GUARD DID NOT GUARD THIS REFACTOR — read this before trusting a digest test

This file previously recorded the guard as the safety net for exactly this work: *"golden digests
of all 68 buildings and ~1,400 prop placements. If a 'pure' refactor moves a single number, it
fails."* **For Standards 10 it could not fail.**

It digests what the **generators** produce (`props.js`, `districts.js`). `WorldProps.js` then reads
those placements and **writes instance matrices**, and nothing checked that second step.
**Perturbing a `_fill` callback by 1 mm left all 188 tests green** — measured, not reasoned about.

**That is the fourth instance of the session-11 review's hollow-enforcement pattern, and the first
one found inside a test written to prevent it.** The three the review caught were pinning tests for
locked decisions 21, 22 and 25; this one was the pinning test for the cleanup those findings
triggered.

**Now closed at the other end:** a second guard over the matrices themselves, per pool, including
per-instance colour, reading the `BatchedMesh` back through `getMatrixAt`. **It was verified to
fail before being trusted** — the same 1 mm perturbation moves `cafeProps`' digest and nothing
else. Both guards are needed and neither subsumes the other: the first covers Standards 4, 5 and 8
(generator changes), the second covers Standards 10 (matrix-writing changes).

### Still open from the review: Standards 4, 5 and 8

The user asked on 2026-08-02 for the duplication cluster to be done **before the merge**, so this
is not optional deferral. **Standards 10 is now done.** Untouched: **4** (`districtA/BBuildings`
duplication), **5** (`CENTRAL_SLOTS` stringified floats) and **8** (`props.js` facade-offset blocks
plus a 9-site repeated switch). All three are generator-side, which is the half the **original**
guard genuinely does cover.

### What IS finished and committed

- **The code review: 16 of 18 findings fixed**, browser-verified. See below.
- **Finding S1 is DONE** (`4c950a1`) — District B's generated roofs now carry parapet colliders
  (+144), District A still deliberately excluded, pinned by a walk-off-the-roof test. **187 tests.**
- **The refactor guard is committed** as part of the in-flight work — check `git status`; if it is
  still unstaged, keep it.
- Remaining from the review: **Standards 4, 5 and 8** — see the section above. **Standards 10 is
  done** (`af0672a`).

**Draw calls were 78 (44/34) at the last browser check and must still be 78 when this is done.**

---

## >>> RESUME HERE — session 11, 2026-08-02: THE CODE REVIEW IS DONE AND ITS FINDINGS ARE FIXED <<<

**Read `CODE_REVIEW_FINDINGS.md` first** — 18 findings, ranked, with what was fixed and what was not.
The two axis reports (`REVIEW_STANDARDS_AXIS.md`, `REVIEW_SPEC_AXIS.md`) hold the full detail.

**185/185 tests** (was 177). Working tree clean apart from the pre-existing untracked
`KODAMAN_HANDOFF.md`. `main` untouched at `5f62309`. `kodaman_prototype.html` zero diff.
**Verified in a browser after the fixes: 78 draw calls (44 main / 34 shadow), unmoved.**

### What the review found, in one paragraph

Two parallel Opus sub-agents (Standards and Spec), **230,594 tokens**. **16 of 18 findings fixed.**
The worst was a real traversal defect: **decision 27's connector shipped with a sidewalk and curb
laid across the mouth of its own T-junction** — the thing the decision existed to remove. Fixing it
surfaced a **second instance neither agent found**, where District B's grid sidewalk crossed the
connector too, because `segments()` cuts only at `STREET_LINES` and knew nothing about annex
streets. Both are one mechanism now.

**The most important pattern is not any single defect.** Three findings were **locked decisions
whose "pinning" tests could not fail**: decision 22's byte-identical test compared a constant to its
own spread; decision 25's "only two names" test restated the two names instead of scanning the
build; decision 21's byte-identical placement claim had no test at all. **In all three the code was
correct and the enforcement was hollow** — §9's own rule failing inside the tests written to satisfy
it. All three now fail for the right reason, and **each was verified to fail before being trusted.**

**The brief's predicted #1 risk — `Collision.js`'s three parallel arrays — came back clean.** Neither
agent could desync it. The worst defect was in `District.js`, which was not on the risk list.

### ⚠️ ONE THING NEEDS YOU before the merge

**Finding S1: District B's generated buildings have no parapet colliders; the absorbed annex's do.**
Same district, same visual coping, different collision — the ring stops the hero walking off one roof
and not off the roof next door. The code matches the **letter** of decision 26, whose arithmetic
accounts only for HVAC's +72 colliders. District B is cardinal, so its parapet boxes would be exactly
as correct as the annex's and cost only AABBs in a linear scan. **Decision 26 did not consider this;
it is a decision, not a patch.**

**Also filed but NOT done:** Standards 4, 5 and 10 — real duplication in `districts.js`, `props.js`
and `WorldProps.js` (~200 lines). Taking it now would churn working, tested, browser-verified code on
the eve of a merge. **Deliberately deferred, not forgotten.**

### Then: you read the diff → merge → QA on the merged base

Locked decision 4 keeps the merge with you. PR #3 is open against `dev`.

---

## Session 10 closed 2026-08-01, deliberately, by the user

**Nothing is half-finished. Everything is committed AND pushed** — `origin/feat/3d-open-world` in
sync, **0 unpushed commits**, working tree clean apart from the pre-existing untracked
`KODAMAN_HANDOFF.md`. **177/177 tests.** `main` untouched at `5f62309`. `kodaman_prototype.html`
**zero diff**. No agent was running when the session ended and **nothing was interrupted or
stranded.** 6 commits this session.

### Do this first next session: **the code review.** It is fully briefed.

**`CODE_REVIEW_BRIEF.md` is written and committed** — self-contained, written to be run cold. It
targets `main...HEAD` (74 files, +29,101, −0), names the seven highest-risk areas in priority order,
and lists what is **already verified** so budget is not spent re-deriving measurements.

**⚠️ It needs ONE user decision before spawning: the model.** The standing rule is all agents Sonnet
except the Engineer on Opus; this stage did not exist when that rule was set. **The recommendation is
Opus** — 4,000 lines of subtle geometry, collision and disposal code is closer to the Engineer's kind
of work than to a document review. **Ask; do not deviate silently.**

**Preferred vehicle is `/code-review ultra`, which the USER must trigger** — the assistant cannot
launch it. `/code-review` is the assistant-invocable alternative.

**Why this stage exists:** everything verified so far is *output* — draw calls, frame time,
screenshots, tests. **Nobody has read the code critically.** ~4,000 lines have been examined by
nothing but their own author. And the orchestrator both commissioned and spot-checked that code, so
its own review is weak independence, not real independence. **The review informs the merge decision;
it does not close it.** Locked decision 4 keeps the merge with the user.

**Then:** fix findings → user reads the diff → merge → QA on the merged base.

### Session 10 in one paragraph

`KNOWLEDGE_BASE.md` was refreshed against the code (500 → 705 lines, five stale areas, 11 missing
documents); **Engineer run 2 landed** and completed Phase 2's world half; its four open questions were
all answered and locked as decisions 25–27; **both collision debts were paid**, which made the hill
genuinely walkable; and PR #3 was brought up to date with an accurate title and description. **One
orchestrator error, corrected in the same session** — see the PR note below.

### `KNOWLEDGE_BASE.md` is refreshed — 500 → 705 lines

It had drifted in five places, because it was written in session 5 before Phase 2 existed. **Every
figure in it was re-measured against the code and the document tree rather than carried forward:**

| What was stale | Was | Now |
|---|---|---|
| Build wireframe | 15 files / ~5,100 lines | **21 files / 7,199 lines**, with the 6 new Phase 2 modules described |
| Settled decisions | stopped at 9 | **1–24** |
| Open items | envMap "in progress"; Phase 2 research pending | envMap **landed** (`6a07c13`); research complete. Both removed |
| Document index | missing **11** documents | all 32 listed, line counts re-measured |
| Draw-call position | 57 against a 60 ceiling | **83 against a 150 ceiling**, 67 headroom |

**Two things it did not previously carry, now recorded:**

1. **The `WEBGL_multi_draw` dependency, verified at source again this session** rather than taken
   from session 9's note. `WebGLRenderer.js`'s `object.isBatchedMesh` branch issues **one real
   `renderer.render()` per geometry** when the extension is absent — ~170 calls instead of 7, which
   blows the 150 ceiling on its own. **It is a budget dependency, not a correctness one**: the scene
   still renders, it just costs an order of magnitude more, and it is invisible in every measurement
   taken so far because every measurement was taken on hardware that has it.
2. **A §9 on working practices that have repeatedly paid** — measure rather than look harder; size
   from measurement rather than constants; **"the object renders" is not "the object reads"**;
   enforce decisions in code rather than prose; write briefs that invite an agent to distrust what it
   was handed. Each is there because it caught something real, several of them more than once.

**Also corrected: spot-check 5's date.** The knowledge base said "verified in a browser 2026-07-31,"
which was the unsourced session-5 claim session 8 had already flagged — the document's result boxes
were empty. It was actually run in session 8. Now says so.

### Engineer run 2 has LANDED — the world half of Phase 2 is complete

| Stage | Model | Status | Output |
|---|---|---|---|
| Engineer — Phase 2, run 2 of 2 | **Opus** | **done** — 395,367 tokens, 169 tool calls, 4 commits | `ENGINEER_PHASE_2_RUN2.md`; brief was `ENGINEER_BRIEF_PHASE_2_RUN2.md`; **148 → 169 tests** |

**`StreetBlock.js` is gone.** Its content is District B's **annex**, and nothing moved in world
space — District B is the cardinal district, so Phase 1's block at the origin is a pure −320
translation inside its grid group. **The hero still spawns at exactly `(0, 0, 13)`; the helipad tower
still stands at `(−2, 31)`.** Items 4–10 of the spec's §10 all built; **nothing was cut from the
priority order.**

### The measured budget — orchestrator-verified, not taken from the report

| | Phase 2 run 1 | After absorption | After props | Ceiling |
|---|---:|---:|---:|---:|
| Draw calls (main/shadow) | 83 (49/34) | **58** | **78 (44/34)** | 150 |

**The absorption's own delta was −25 (−16 main / −9 shadow)**, measured before a single prop was
added — which is what justified doing it first, and nobody had that number until now. The props line
then cost 34 against §PROP-4's estimate of ~35. **72 calls of headroom, unspent, for CSM.**

**Independently re-measured by the orchestrator in a browser:** graph walk **44 main / 34 shadow =
78**, exactly matching. GPU frame time **0.5 ms median / 0.9 ms p95**. `WEBGL_multi_draw` present.
Console clean apart from the pre-existing favicon 404 and the known `PCFSoftShadowMap` deprecation.
**The helipad was confirmed by screenshot** — ring, yellow FATO circle and "H" all read correctly.

**The 78 reconciles exactly against §BGT-1's ~69, which also closes run 1's open §6.1:** +6 is the
still-un-rigged hero (decision 14's 8-call budget applies only once a rig exists), +4 is decision
24's two irreducible meshes. **No double-counting risk remains, because the block no longer has a
separate budget line.**

### Two doc-vs-code contradictions, both resolved in the code's favour

1. **§8 says awnings and blade signs don't cast shadows. The shipped code sets `castShadow = true`
   on both.** They cost 2 calls each, not 1. Verified at `WorldProps.js:175`.
2. **§8 files rooftop HVAC and parapet rings as District A exclusive. They are not** — the annex has
   carried both since Phase 1. Sharing the pools instead saves 4 calls.

**That is the fifth time an agent in this pipeline has been right to distrust a document it was
handed.** The practice continues to pay.

### One collider-teardown behaviour change, self-flagged rather than buried

`StreetBlock.dispose()` called `collision.clearBuildings()`. **Nothing does now** — `WorldProps`
cannot, because clearing the shared list would drop the districts' colliders too, and
`District.dispose()` never cleared them either. **Not a leak in practice**: `Game.destroy()` discards
the whole `CollisionWorld` and `init()` builds a fresh one, so HMR starts clean. But the old test
asserted `world.buildings.length === 0` after dispose and **that assertion is gone**. The real fix,
if anyone wants one, is a per-owner handle from `CollisionWorld` — **a design change, not a patch.**

### Three defects only screenshots caught

A 300 m square drawn around the hill (flat corners of a displaced square plane), a pinched crease at
its summit (`atan2` undefined at r=0), and scaffolding that rendered as a bare gantry because one bay
was scaled on Y instead of instanced per lift. **All fixed.** This is the third run in a row where
the browser caught something neither review nor the test suite could.

### ⚠️ Four things needed the user — ALL FOUR ARE ANSWERED

**Answered 2026-08-01, same session, and applied inline by the orchestrator. 173/173 tests, world
still 78 draw calls (44/34), verified in a browser.**

1. ~~The hill has no name~~ — **`Coco Hill`, locked as decision 25.**
2. ~~The boulevard dead-ends 20 m short~~ — **joined via a boundary connector, locked as decision
   27.** The road network is now continuous and it was confirmed by screenshot, not just by data.
3. ~~Parapet rings on District B?~~ — **yes, locked as decision 26.** Zero draw calls; +72 colliders.
4. ~~Grade relief~~ — **stays cut, and the reason stays mechanical.** The user approved proceeding on
   the stated recommendation, which was that it **needs a `Collision.js` terrain height query before
   it can exist at all** — the AABB model has no height-at-point concept, so displacing the district
   ground would put the hero's feet through every slope. **Nothing was built for this.** It is a
   collision-system design change, and it is the natural companion to the two other collision debts
   below. **The hill itself is built and unaffected** — it carries a stepped-box collider.

### Both collision debts are PAID — `Collision.js`, session 10

They were the same shape and were taken together, at the user's instruction. **177/177 tests, world
still 78 draw calls (44/34), verified in a browser.**

**1. Per-owner collider handles.** `addBuilding(box, owner)` now records who registered each box, and
`removeOwner(owner)` drops exactly that owner's. `District.dispose()` and `WorldProps.dispose()` call
it. **The teardown assertion run 2 had to delete is restored** — and it is now meaningful rather than
merely passable, backed by a second test proving a co-owner's colliders survive. The old
`clearBuildings()` remains for whole-world teardown.

**2. A real terrain height query, and the hill is walkable.** `addTerrain(heightAt)` takes a pure
`(x, z) -> height` function — no scene-graph access, so `Collision.js` keeps its no-Three.js-objects
property and its headless tests. `resolveCapsule`'s hard-coded `y = 0` ground became "the tallest
registered field, or 0". **The hero now walks from the rim to the summit continuously** — measured in
the live world through the real resolve path: 0 → 66.5 m, `onGround` true at every step.

⚠️ **The subtle part, worth knowing before touching it: terrain needed a STEP-UP allowance, and boxes
must not get one.** Walking uphill, the surface under your feet is *higher* than where the step began,
so the existing crossed-it test rejects it and the hero walks straight through the hillside. Terrain
gets a 0.5 m per-step allowance, which is **a slope limit in disguise** (at 7.5 m/s the hero covers
0.125 m per fixed step, so it tops out near a 4:1 grade — steeper and he stops climbing rather than
teleporting up a cliff). **Roof boxes deliberately do NOT get it**, and a test pins that: brushing a
30 cm kerb must never lift the hero on top of it.

⚠️ **The hill's terrace boxes are still registered, now `solid: false`** — a new flag meaning *the
camera sees this, the hero does not.* They exist so the camera arm cannot sink through the hillside
(`spherecast` reads `buildings`, not terrain). **Leaving them solid would have put the terraces'
vertical faces back in the push-out path and re-created the exact defect the height field removes** —
that is why walking up the hill was impossible before.

**§PROP-3's district grade relief is now UNBLOCKED but still not built.** The mechanical blocker is
gone; whether to grade the district ground is a design call nobody has made, and locked decision 21's
lesson about un-anticipated interactions applies — the districts' buildings, roads and 1,376 props
all assume a flat y = 0.

### The original four, as run 2 reported them

1. **The hill has no name.** Locked decision 6; the Engineer correctly did not invent even a
   placeholder. `AKC ENTERPRISE` remains the only name in `kodaman3d/`.
2. **The annex's boulevard dead-ends 20 m short of District B's grid.** Three options in report
   §8.2; all are design calls.
3. **Whether District B's generated buildings should also get parapet rings.** §10 scopes them to
   District A, so they don't. **Zero-call change** if wanted.
4. **`§PROP-3`'s district grade relief was cut for a MECHANICAL reason, not a budgetary one** —
   `Collision.js` has no terrain height query, so displacing the district ground would put the hero's
   feet through every slope. The hill itself is built, at 2 calls where the spec carried an
   un-rederived 4–6. **Grade relief needs a collision feature before it can exist.**

### Still open, unchanged

Run 1's §6.3 (**the districts cast no shadows** — `Sky.js`'s frustum is ±60 m in a now-1,220 m world;
CSM is the fix) and §6.4 (**fog is 120–900 m against a far longer sightline** — deliberately
untouched, because locked decision 11 makes that exact `Fog` object the world-edge-fade mechanism).
Neither was run 2's scope. **CSM's real cost remains the biggest unmeasured unknown in the project**,
and the 72 calls of headroom exist for it.

---

### PR #3 is current — and an orchestrator error about it, corrected

**All 9 held-back commits were pushed at the user's instruction.** PR #3 now carries an accurate title
(*"3D migration: Phase 1 vertical slice + Phase 2 world"*) and a rewritten description; the old one
still said Phase 1, 105 tests, and 57 calls against a 60 ceiling. **Open, MERGEABLE, +29,101 / −0, 74
files. The review and the merge remain the user's.**

⚠️ **An error worth recording, because it produced confident wrong advice.** The orchestrator reported
that PR #3's diff falsely showed a ~4,100-line change to `kodaman_prototype.html`, blamed a stale base
branch, and offered the user three remedies. **All of it was wrong.** The cause was a **stale local
`dev` ref** — the merge-base was computed without fetching first. `origin/dev` was already at
`5f62309`, identical to `main`, and GitHub's own diff never included the file. **Lesson, now in the
code-review brief: `git fetch` before computing any merge-base, and verify against `origin/*` rather
than local branches.** The wrong section was removed from the PR description and the local ref reset.

### Cost log — session 10

| Agent | Tokens |
|---|---|
| Engineer — Phase 2, run 2 (Opus) | 395,367 |
| **Session 10 total** | **~395,367** |

Cross-session observable total: **~3,031,000.** **At ~395k, just under the 400k prep-to-pause mark —
the user was told and chose to close here.** Everything else this session — the knowledge-base
refresh, decisions 25–27, both collision debts, the browser verification, the PR work and this brief —
was inline orchestrator work. Report raw counts only, never a percentage, and **never attempt to look
up account usage.**

---

## Session 9 closed 2026-08-01, deliberately, by the user

**Nothing is half-finished. Everything is committed AND pushed** — `origin/feat/3d-open-world` in
sync, **0 unpushed commits**, working tree clean apart from the pre-existing untracked
`KODAMAN_HANDOFF.md`. **148/148 tests.** `main` untouched at `5f62309`. `kodaman_prototype.html`
**zero diff**. No agent was running when the session ended and **nothing was interrupted or
stranded**. 12 commits this session.

### Do this first next session: **Engineer run 2.**

Everything it needs is decided and written. Its scope, in order:

1. **Absorb Phase 1's block into District B (locked decision 24)** — do this FIRST, because it is
   what pays for the props line. **Real engineering, not bookkeeping:** the block carries the hero
   spawn, the browser-verified 90 m helipad tower, its collider registrations and most of
   `tests/world.test.js`. **None of that may be lost.**
2. **Then the spec's §10 priority items 4–11** — vegetation (decision 21: Canary palm in A, Mexican
   fan in B), rooftop HVAC and parapet rings, awnings and blade signs, streetlamps, small props,
   parked cars, utility poles, the terrain landmark, and the cut-priority tier.

**Model: Opus.** Brief run 1 from `ENGINEER_BRIEF_PHASE_2_DISTRICTS.md` — it is a good template and
its process rules, budget facts and trap warnings all still apply. **Budget from the real measured 83
(49 main / 34 shadow), not from §BGT-1's ~69**, and remember run 2's own props line is ~35 calls
before the absorption gives any back.

### There is now a playtester build — `npm run build:standalone`

Added at the end of session 9. Emits `kodaman3d/dist-standalone/kodaman3d.html`: **the whole game as
one 0.6 MB self-contained file** that opens by double-click, nothing to install, nothing to fetch.
Stable path, overwritten in place, **gitignored** (build artifact; a fresh 0.6 MB copy per iteration
would bloat the history of a repo with an open PR). **Regenerate it after any change you want a
tester to see.**

**Debug surfaces start HIDDEN in that build only** — `VITE_PLAYTEST=1` → `Game.js` → `DebugHud`'s
`startHidden`. F1 still reveals the lil-gui panel, stats meter and state readout, so a tester can be
talked through showing them. **The dev server is unchanged**; both were verified.

⚠️ **This works ONLY because the build has no asset files** — every texture is painted procedurally
into a canvas and the env map is PMREM-baked from a synthetic sky. **Locked decisions 15/18 bring
Quaternius glTF in for the hero rig, and that ends.** The script has a hard guard that fails loudly
rather than emitting a file that works here and 404s on the tester's machine; when it fires, inline
the assets as base64 data URIs.

**A question already answered, so it is not re-litigated:** a tester reporting a flat **60 fps is
vsync, not a cap and not a problem.** Nothing in the code limits frame rate — the loop renders once
per `requestAnimationFrame` (`Game.js:165`), independent of fixed steps. GPU frame time is **0.5 ms
median / 1.1 ms p95** against a 16.7 ms budget at 60 Hz, i.e. ~3% used. The simulation is fixed at
60 Hz by design (`FIXED_DT`) so feel is identical at any refresh rate. **Prefer GPU frame time over
fps in every future report** — fps cannot distinguish "capped by vsync" from "just barely managing".

**Still open, and unchanged by this session:** PR #3 (open, unmerged, base `dev` — **the review and
the merge are the user's**), the **trademark naming table** (still descriptions, not names; the
companion at 345 references is the one the user should name personally), the **day/night cycle
length** (a feel call needing `DayNightCycle.js` to exist first), and **CSM's real shadow cost** —
still the biggest unmeasured unknown in the project.

---

## Session 9 detail — the two districts are built Review's gate passed, all four §12 taste decisions were made
(decisions 19–22), and the Engineer's run 1 landed. **147/147 tests**, working tree clean apart from
the pre-existing untracked `KODAMAN_HANDOFF.md`, `kodaman_prototype.html` zero diff, `main` untouched.

**The next pipeline action is a decision, not an agent** — see "Three things need you" below. After
that it is either **Engineer run 2** (the props/vegetation half) or a **QA/browser pass** on what
exists.

| Stage | Model | Status | Output |
|---|---|---|---|
| Review — Phase 2 districts feasibility gate | Sonnet | **done** — 101,218 tokens, 18 tool calls | `REVIEW_DESIGN_SPEC_PHASE_2_DISTRICTS.md` (222 lines) |
| Engineer — Phase 2 districts, run 1 of 2 | **Opus** | **done** — 293,993 tokens, 84 tool calls, 5 commits | `ENGINEER_PHASE_2_DISTRICTS.md`; 6 new modules, 108→**147 tests** |

### The build, measured — not estimated

| | Phase 1 | Phase 2 run 1 | Δ | Ceiling |
|---|---:|---:|---:|---:|
| Draw calls, graph walk (main/shadow) | 57 (32/25) | **83 (49/34)** | +26 (+17/+9) | 150 |
| Measured `info.render.calls`, worst viewpoint | 53 | **81** | | 150 |
| Triangles | 11,324 | 14,724 | +3,400 | ~500k |
| GPU frame time, whole world | — | **0.5 ms median / 1.1 ms p95** | | |

**The +26 is exactly §BGT-1's three district lines** — ground/road 8, facade families 14, landmarks 4.
`BUD-2` was avoided *and measured*: 4 merged surfaces per district, not 7 per tile (the trap's number
was 448). An A/B toggle measured all 68 buildings / 170 massing boxes at **13 calls**.

**Scoped as run 1 of 2 by the orchestrator, following the spec's own §10 priority order** rather than
an invented cut line. Run 1 = items 1–3 (the "do not cut" tier): district scaffolding, 7 facade
families, 5 massing recipes, the §6 ground/road merge, both landmarks. **Run 2 = items 4–11**:
vegetation, rooftop detail, awnings, blade signs, streetlamps, props, parked cars, utility poles, the
terrain landmark, the cut-priority tier. Brief: `ENGINEER_BRIEF_PHASE_2_DISTRICTS.md`.

**Orchestrator spot-checks — all confirmed:** 147/147 tests; tree clean; `kodaman_prototype.html`
zero diff; no `.playwright-mcp/` left behind; locked decision 22 enforced by a **byte-equality test**
(`districts.test.js:60-63`) rather than a promise; the sign-mast text is the literal string
`PLACEHOLDER` (`landmarks.js:345`); and the `WEBGL_multi_draw` finding below verified at source.

### ⚠️ A silent 10× budget risk the whole §BUD-3 strategy depends on

**`BatchedMesh` falls back to a per-geometry loop of REAL draw calls when `WEBGL_multi_draw` is
absent** — verified at `node_modules/three/src/renderers/WebGLRenderer.js:1303-1319`: no extension
means a `for` loop issuing one `renderer.render()` per geometry. **~170 calls instead of 7.**

The extension was measured **present** in this environment, so the build is fine here. But **this is
an unstated hardware dependency of the entire batching strategy** — §BUD-3, §BGT-1 and this build all
assume it. On a GPU or driver lacking it the district budget silently multiplies. **This belongs in
`KNOWLEDGE_BASE.md` and is a real candidate for a runtime capability check.**

### The mast signage took three fixes, and the user found the defect

`AKC ENTERPRISE` shipped unreadable, and **the user's own screenshot caught it** after the assistant's
Playwright pass had already signed the landmark off. Three distinct defects, only the first diagnosed
before that screenshot:

1. **Text overflowed its 512 px face** — the name measures **883 px** at 100 px bold. The font was
   hard-coded at `bh * 0.11`. Fixed by sizing from `measureText`.
2. **The column bisected the board** — the real cause. A single 7 m board sat centred on a mast
   tapering 2.4 → 0.9 m radius, so 4+ m of steel covered its middle third and the name read
   `AKC` … `RISE`. Fixed with **two boards per level flanking the column**, each starting outside its
   radius *at that height*. **+48 triangles, ZERO extra draw calls** — the mast is still one merged
   geometry with one material, so §BGT-1's 2-calls-per-landmark line holds.
3. **The name still sat small** — the face is **portrait** (512 × 768 px on a 7 × 9 m board), so one
   line can only use a strip of it. Fixed by setting **one word per line**, each sized from its own
   measured width. Text block **39 px → 138 px** tall, glyphs ~**1.9×** larger.

**Two lessons worth carrying.** First, **2 and 3 were found by measurement, not by looking harder** —
3 in particular was diagnosed by reading the atlas back with `getImageData` and measuring the text's
bounding box, which showed the texture was *already* correct at 88% of face width and the board's
aspect ratio was the problem. Enlarging text that was already the right size would have wasted
several rounds. Second, **the original failure came from a constant that happened to suit the old
`PLACEHOLDER` string** — which is why everything now sizes from measurement and any future approved
name fits without another round of this.

**A caveat about this session's Playwright pass, worth being honest about:** it verified the mast
*existed* and that the sign text was *present*, and called the landmark a pass. It did not verify the
name was **legible**. A human caught in one screenshot what an automated pass had signed off. The
Playwright-first rule is still right — it caught FAM-5's terracotta, which no human would have hunted
for — but **"the object renders" is not the same check as "the object reads."**

### Three things needed the user — ALL THREE ARE ANSWERED

1. ~~The §BGT-1 headroom reconciliation~~ — **ANSWERED, locked as decision 24: absorb Phase 1's block
   into District B.** This is now **the first item of Engineer run 2**, ahead of the props line it
   pays for. It is real engineering work, not bookkeeping — see decision 24 for what must not be lost
   in the move.
2. ~~The mast's name~~ — **ANSWERED, locked as decision 23: `AKC ENTERPRISE`.** Applied, pinned by a
   test, 148/148.
3. ~~A human look at whether the districts read as two distinct places~~ — **ANSWERED: they do.** Run
   under Playwright and recorded in `BROWSER_SPOT_CHECK_6.md`. **District A reads as a dense tower
   plateau with streets visibly diagonal on the 36° grid; District B as an orthogonal mixed-height
   boulevard corridor** with centrelines, crosswalks and cream/steel-blue/bronze facades. **Locked
   decision 10's central bet — that the rotation difference alone would make the two districts read as
   different places — is confirmed.** The user then reviewed the mast and found the signage defect
   above.

### Two pre-existing issues the build surfaced but correctly did not touch

- **The new districts cast no shadows.** `Sky.js`'s shadow frustum is ±60 m in what is now a 1,220 m
  world, so it excludes them entirely. **Pre-existing, and CSM is the fix** — out of run 1's scope.
  The Engineer measured around it by widening the frustum in-browser.
- **Fog is 120–900 m against a 1,725 m sightline.** Deliberately untouched: **locked decision 11 makes
  that exact `Fog` object the world-edge-fade mechanism**, so retuning it now would pre-empt a locked
  design decision.

### Where the spec was wrong — four findings, all handled

- **FAM-5's terracotta landed on every roof.** §4 asks for a `band` re-tint, but `band` is also the
  pixel `scaleBoxUVs` collapses every flat roof onto. **Caught in a screenshot, not in review** — a
  good argument for the Playwright-first rule. Rebuilt as a separate cornice string course, which
  makes FAM-5 a pure *addition* to `lowriseB` and therefore safer for decision 22 than what was asked.
- **§DA-2's 32 m depths do not fit the 34.76 m slot** the S-470-1 grid yields. Built at 24–30; the
  landmark keeps its full 22×32 on the central lot.
- **MAS-3 is 60 triangles, not 24–48** — decision 19's sculpted crown postdates the spec. +12 tri.
- **§MAS-6 assumed ~80 buildings; the grid holds 68.** Measured 2,212 tri against its estimated 2,376.

**It re-derived every draw-call and triangle figure independently rather than checking the spec's
arithmetic for plausibility** — §4, §6, §8, §9/§BGT-1 and §5/§MAS-6 all confirmed: 14 calls for
facade families, 8 for ground/road, 35 for props and terrain, **69 subtotal against the 150 ceiling,
81 headroom.** It found one immaterial slip (MAS-6's building counts sum to 79, not the stated ~80;
the 2,376-triangle total is exact regardless) and correctly declined to raise it as a correction. It
recorded **no aesthetic objection anywhere**, per its charter.

**The most valuable thing it did was close the spec's own §11 item 1** — the "five-minute
Engineer-side check" that had been the cheapest open question in the pile. Read directly from the
installed library and **re-verified by the orchestrator**: `BatchedMesh` takes one `material` for the
whole batch (`BatchedMesh.js:192`), `geometryInfo` has no material-index field (`:632`), and the
render path always reads `this.material` (`:1390`). **There is no per-instance material override.**
Consequences: §BGT-1's 4-call district-landmarks line **stands and cannot be deleted**, and
**decision 19's sculpted crown cannot join its facade family's batch** — it costs its own `Mesh`.
That dependency is now answered before the Engineer could trip over it.

### Both corrections are APPLIED, and one of them was slightly wrong

- **`RVW-11`** (cosmetic) — the centreline `castShadow=false` citation said line 515; it is 525.
  Fixed in the spec.
- **`RVW-9`** — decision 14's group wording contradicted the design spec's §BGT-1. **Fixed at source
  in the locked table above, but not as Review framed it.** Review called the two readings "identical
  either way, no budget consequence." **They are not identical:** 3 material groups is 3 main + 3
  shadow = **6** calls, not the 8 the same row states. §DRAW-2's recommended row is explicit — 3 body
  groups *plus the cape as a 4th* → 4/4/**8**. So decision 14's **number was always right and its
  group description was wrong**, and the table now says 4 groups. **No budget figure anywhere
  changed**, because every downstream document already used the 8. This mattered enough to fix
  properly: the character Design run needs an unambiguous *group count*, not just a total.

**That is the fourth time an agent in this pipeline has been right to distrust something handed to
it, and the first time one of its own findings needed the same treatment.** Both practices should
continue.

### Cost log — session 9

| Agent | Tokens |
|---|---|
| Review — Phase 2 districts feasibility gate (Sonnet) | 101,218 |
| Engineer — Phase 2 districts, run 1 (Opus) | 293,993 |
| **Session 9 total** | **~395,211** |

Cross-session observable total: **~2,636,000.** **At ~395k, just under the 400k prep-to-pause mark — the user was told and chose to close here.** State is fully committed and pushed, so a pause costs nothing and strands nothing. Everything
else this session — the decisions, the corrections, the spot-checks, the `StreetBlock.js` comment fix
— was inline orchestrator work. Report raw counts only, never a percentage, and **never attempt to
look up account usage.**

---

## Session 8 closed 2026-08-01, deliberately, by the user

**Nothing is half-finished. Working tree is clean and everything is committed.** 108/108 tests.
`main` untouched (`5f62309`). `kodaman_prototype.html` zero diff. **No agent ran this session at
all** — subagent spend **0 tokens**, all work inline. Nothing was interrupted and nothing is stranded.

**ONE COMMIT IS UNPUSHED: `86ec6b5`** — this session's whole output, documentation only, no code.
Deliberately not pushed: **PR #3 is open and the user is reviewing its diff**, and pushing adds to
what they are reading. Session 7 hit the identical situation and the user's answer then was to push;
they have **not** been asked this time. A plain `git push` sends it up — `origin/feat/3d-open-world`
already exists. **Low stakes either way, since no code is affected.**

### A standing working rule CHANGED this session — read this before any browser work

**Browser spot-checks are now run by the assistant via the Playwright MCP connector, not handed to
the user as a checklist.** User instruction, 2026-08-01. The long-standing premise in this file and
in the spot-check documents — *"agents in this pipeline have no browser or GPU, so the human is the
only instrument for anything visual"* — **is obsolete.** Headless WebGL renders fine, and most of
what was being sent to a human is directly measurable.

The rule and its operational detail now live in **`CLAUDE.md` at the repo root** (new this session,
first CLAUDE.md this project has had). It is loaded automatically every session, so it does not need
restating here — but the short version:

- Drive the scene through `window.__game` (`scene`, `renderer`, `hero`, `cameraRig`, `world`, `sky`).
- Set pose via `hero.state.position` / `.facing`, **not** `hero.group.position` — the group is
  overwritten from state every frame. This costs ten minutes to rediscover.
- Tuning is live on the shared object at `cameraRig.tuning`.
- Prefer numbers: `renderer.renderer.info` for draw calls/triangles, `gl.readPixels` over fixed
  screen regions for mean luminance. A/B one variable by toggling between two `render()` calls.
- **Ask the user only for what genuinely needs an eye, and say what and why.** Known human-only:
  real frame rate (headless pins rAF to 60, so the fps HUD is meaningless — report GPU frame time),
  driver-specific rendering, and final "does this look right" calls.

The `BROWSER_SPOT_CHECK_*.md` format survives unchanged for the cases that still need a human — but
**fill in every result you measured yourself first.**

### Spot-check 5 was actually run, and step 3's premise was wrong

`BROWSER_SPOT_CHECK_5.md` (the PMREM env map, commit `6a07c13`) was executed end to end under
Playwright. **All four steps pass**; results are written into the document's `> Result:` boxes.

**⚠️ Note a contradiction this surfaced in THIS file.** Line ~128's status table said spot-check 5 was
"awaiting a human," while the session 5 block (item 4 under "Next, and nothing is blocking") claims
it "passed 4/4 on 2026-07-31." The document's result boxes were **empty**, so the session 5 claim was
not backed by a recorded run. It is now genuinely run and recorded. **Treat the session 5 block's 4/4
line as unsourced;** the filled-in document is the authority.

**The substantive finding — a correction that matters for Phase 2 art direction.** Step 3 predicted
matte surfaces would "barely move" because they have low metalness. **That is wrong.** An environment
map feeds **diffuse irradiance** to every `MeshStandardMaterial`, and **the diffuse term does not care
about metalness.** Measured ENV 0 → 1: road **+70%**, sidewalk **+33%**, mid-rise **+253%**, hero cape
**+637%**, far towers **+780%/+637%**, sky **unchanged**.

**So `6a07c13` is doing double duty as the scene's global ambient fill, not just a tower-glass fix.**
That is a happy accident, not a design decision. Consequences worth carrying into Phase 2:

- At `ENV_INTENSITY` 0 the **whole scene** is underlit, not only the towers. The old rig was short of
  ambient fill generally.
- **`ENV_INTENSITY` stays at 1.0.** 0.6 also reads fine; nothing about 1.0 looked overdone.
- **The tower-metalness raise stays closed as not needed** — consistent with the session 5 ruling,
  now on measured evidence rather than eyeball.
- **If ambient fill ever gets its own control, `ENV_INTENSITY` must stop carrying it.** Anything that
  changes it is changing scene-wide brightness, not just glass.

Perf: **57 draw calls, 11,324 triangles, 13 programs, 22 textures — identical at ENV 0 and 1.**
Median GPU frame 0.20 ms, p95 0.30 ms over 60 renders with a `gl.finish()` sync. The bake costs
nothing per frame. **The 120 fps target was NOT verified** — headless pins rAF to 60. That is the one
item still wanting a human at real hardware, and it is low-stakes.

### Housekeeping

**The two long-standing untracked files are resolved.** Every session block above notes the tree
"clean apart from `.claude/` and `KODAMAN_HANDOFF.md`" — that caveat is gone:

- **`.claude/` is now gitignored** (new `.gitignore`). It holds machine-specific permission
  allow-lists and a checkout of another repo; it was never committable.
- **`KODAMAN_HANDOFF.md` is deliberately left untracked and NOT committed.** It documents the old
  single-file 2D prototype and persistent memory records it as **stale and wrong** on line count and
  cape rendering. Committing a known-wrong document would give it authority it should not have.
  **It is a user call whether to fix it or delete it** — it is on disk either way and nothing depends
  on it. `KNOWLEDGE_BASE.md` is the live equivalent for the 3D build.

There is also a **prunable stale worktree** registered at `/Users/calvinyang/C_K_prototype/.claude/
worktrees/agent-a7249838f691a7088`. Harmless; `git worktree prune` clears it. Left alone deliberately
— it points into the other repo.

### What to do next is UNCHANGED by this session

**Session 8 touched no code and made no pipeline decisions.** The next action is still
**Review's feasibility gate on `DESIGN_SPEC_PHASE_2_DISTRICTS.md`** — see the session 7 block below,
which remains the authoritative statement of the queue. The four outstanding spec decisions, PR #3,
and the trademark naming table are all still open exactly as described there.

One small thing this session ADDS to that queue: **`StreetBlock.js:205-208` still carries the stale
comment claiming "There is NO ENVIRONMENT MAP in this project."** Session 7 confirmed it stale; this
session confirmed the env map is not merely present but load-bearing for scene-wide brightness. It is
a one-line fix and the next engineer to read it would be actively misled.

---

## Session 7 closed 2026-08-01, deliberately, by the user

**Nothing is half-finished. Everything is committed AND pushed** — `origin/feat/3d-open-world` is in
sync, 0 unpushed commits, working tree clean apart from `.claude/` and `KODAMAN_HANDOFF.md` (both
pre-existing and untracked). 108/108 tests. `main` untouched. `kodaman_prototype.html` zero diff.
**No agent was running when the session ended and nothing was interrupted.**

**Session 7 in one paragraph.** The four held-back documentation commits were pushed; Phase 2
research run 2 was spawned and landed (`RESEARCH_PHASE_2_CHARACTER.md`, 937 lines) with five of its
claims spot-checked and confirmed; all seven of its user decisions were made in one sitting and
locked as decisions 12–18; the one open licensing question was verified live against the vendor and
closed as decision 18; the user chose the world half over the character half and Design-first within
it; the district design spec landed (760 lines) and had one real budget error found and corrected;
and `DESIGN_AGENT_BRIEF.md` was finally corrected at source.

**Session 7 spend: ~477,266 subagent tokens** across two agents. Past the 400k prep-to-pause mark;
the user was told and chose to pause here.

---

## What to do next

**PHASE 2 RESEARCH IS COMPLETE, spot-checked, and its decision gate is CLOSED.** Both runs landed,
all seven of run 2's user decisions were made this session and are locked as **decisions 12–18**, and
the one open licensing question (§ASSET-2) was verified live and closed. **Nothing in either research
document is waiting on the user any more.**

**The user chose the world half, and Design first within it. That spec has landed and been
spot-checked.** See the session 7 block below for what it specifies and the one error corrected in it.

**Do this first next session: Review's feasibility gate on `DESIGN_SPEC_PHASE_2_DISTRICTS.md`.** That
is the pipeline's next stage per `DESIGN_AGENT_BRIEF.md` — Design→Review→Engineer, and Review's gate
is **budget and feasibility ONLY. It gets no vote on taste.** It may send the spec back for exceeding
the draw-call/triangle budget, requiring renderer features the locked stack lacks, requiring assets
with no pipeline, or breaking a locked decision — **and for nothing else.**

~~**Four user decisions are outstanding on the spec** (its §12)~~ — **ALL FOUR ARE MADE**, 2026-08-01
in session 9, and locked as **decisions 19–22**. They were taste and content calls, so they never
blocked Review; they did block Engineer, and **they no longer do.** The spec's §12 is closed. Note
decision 19 hands the Engineer two obligations (the sculpted crown's batchability and its triangle
cost) and decision 20 leaves the mast's *name and signage text* still unset, per locked decision 6.

**Two things carry forward as hard requirements into whatever builds this:** the **8 draw calls both
passes** of decision 14 (a rig built object-by-object silently stays at 14 and wastes the whole gain),
and **decision 17's ORG-6 precision test as soon as any rigged mesh exists.**

**The character half remains unstarted and fully briefed** — decisions 12–18 settle its art direction,
and `RESEARCH_PHASE_2_CHARACTER.md` is its research. The two halves are independent, so the character
half is an equally valid thing to pick up instead.

### Still open, unchanged by this session

- **PR #3** — open, unmerged, 51 commits, base `dev`. **The review and the merge are the user's — do
  not merge it for them.** Untouched all session.
- **The trademark naming table** — still descriptions, not names. Blocks Phase 2 *content porting*,
  not the design or engineering work queued above. Per locked decision 6 the user approves every
  name; the companion at 345 references is the one they should name personally.
- **Day/night cycle length** — deliberately not put to the user. Run 1 calls it a feel call that needs
  `DayNightCycle.js` to exist before it can be judged; asking now would collect a guess.
- **`InstancedMesh` vs `BatchedMesh` for streamed props** — run 1's §BUD-4 recommends over-allocated
  `InstancedMesh`, explicitly revisable once real per-district counts exist. **Meant to be settled by
  measurement at the Engineer stage, not chosen blind.** Note it leaves the build mixed: buildings
  batched, props instanced.
- **`BatchedMesh` per-instance material override** — the design spec's §11 item 1. **A five-minute
  Engineer-side check** that could delete the 4-call landmark line entirely. Cheapest open question
  in the pile.

### The unpushed-commits situation from session 6 is RESOLVED

The four local commits (`31c5cba`, `3ce893d`, `0123c48`, `c0d9eb5`) were **pushed at the user's
explicit instruction at the top of session 7** (`87992b6..c0d9eb5`). They were documentation only, so
PR #3's code diff is unaffected. **There is no longer any unpushed work.** Older lines in this file
describing stranded local commits describe session 6, not now.

They were held back **deliberately, by the orchestrator, not by accident**: PR #3 is open and the
user is deciding whether to merge it, and pushing would add commits to the diff they are reviewing.
**The user was told and has not yet decided.** Ask them; a plain `git push` sends them up, since
`origin/feat/3d-open-world` already exists.

They are all documentation — the two Phase 2 briefs, run 1's research, and this file. **No code is
affected either way**, so this is a low-stakes decision, not a risk to the build.

**Session 6 in one paragraph.** Phase 1 was re-verified rather than assumed (108/108, 0 unpushed,
`main` untouched), the user chose Phase 2 research over the naming table and agreed to split it into
two runs, run 1 delivered `RESEARCH_PHASE_2_WORLD.md` and had its claims spot-checked against the
code, two user decisions came out of it and were locked as decisions 10 and 11, and run 2 was
briefed and then stopped at the user's request before it wrote anything.

### Cost log — session 6

| Agent | Tokens |
|---|---|
| Research — Phase 2 world, run 1 (Sonnet) | 198,801 |
| Research — Phase 2 character, run 2 (Sonnet) | stopped after ~2 min, no work produced |
| **Session 6 total** | **~198,801** |

Cross-session observable total: **~1,763,000.** Everything else this session — the two briefs, the
spot-checks, the state updates — was done inline by the orchestrator.

**Well inside the 400k prep-to-pause mark.** Run 2 would likely add 150–200k on run 1's evidence,
which would put a resumed session around 350–400k on its own. As always: report raw subagent token
counts only, never a percentage of a ceiling, and **never attempt to look up account usage** — no
tool exposes it and the user has asked that it stop.

### Still open, unchanged by this session

- **PR #3** — open, unmerged, 51 commits, base `dev`. **The review and the merge are the user's.**
- **The trademark naming table** — still descriptions, not names. Blocks Phase 2 *content porting*,
  not Phase 2 research. The companion at 345 references is the one the user should name personally.
- **Day/night cycle length** and **`InstancedMesh` vs `BatchedMesh` for streamed props** — see the
  note below on why neither was put to the user.

---

## Session 7 detail — opened 2026-08-01

**State re-verified independently at the top of the session, not taken from this file:** 108/108
tests, working tree clean apart from the two known untracked files, `kodaman_prototype.html` zero
diff, branch 4 commits ahead of origin (since pushed).

### The user's decisions this session

1. **Push the four held-back documentation commits.** Done — `87992b6..c0d9eb5`. No code affected.
2. **Spawn run 2.** Done, on Sonnet, pointed at the committed brief.

### Run 2 has landed — Phase 2 research is now complete

| Stage | Model | Status | Output |
|---|---|---|---|
| Research — Phase 2 character/animation (run 2 of 2) | Sonnet | **done** — 215,614 tokens, 61 tool calls | `RESEARCH_PHASE_2_CHARACTER.md` (937 lines) |

**It obeyed both process rules**: no subagents spawned, and it wrote incrementally in 9 append
passes, one per section. Code untouched — `git status` clean apart from the known untracked files,
`kodaman_prototype.html` zero diff.

Finding IDs: `ASSET-1..5`, `RIG-1..4`, `ANIM-1..3`, `PROC-1..3`, `CAPE-1..5`, `ART-1..4`,
`DRAW-1..5`, `ORG-4..7`, `CLIP-1..5`. It **continued run 1's numbering rather than restarting it**,
so IDs are unique across both documents and safe to cite bare.

**Orchestrator spot-checks, run independently rather than taken at face value — all five confirmed:**

| Claim | Verdict |
|---|---|
| `CAPE-1` — the brief's "cape tests assert direction, never position" premise is stale; position tests already ship | **Confirmed** — `tests/locomotion.test.js:646` defines `capeTorsoGap()`, asserted at `:677` and `:685` |
| `DRAW-4` — CPU bone-matrix computation is deduped once per frame, not once per shadow pass | **Confirmed** — `WebGLObjects.js:50–54`, `skeleton.update()` behind a per-frame `WeakMap` guard |
| `DRAW-1` — the hero is 7 meshes = 14 calls both passes | **Confirmed** — `Hero.js` torso `:139`, head `:147`, 4 limbs via `make()` `:172`, cape `:202` |
| `ART-2` — `MeshToonMaterial` structurally cannot consume the world's PMREM env map | **Confirmed** — no `envMap` property anywhere in the installed material's constructor |
| `RIG-2`/`RIG-3` — `SkeletonUtils.retarget()` and `CCDIKSolver` ship in the installed `three@0.185.1` | **Confirmed** — both files present; `retarget()` at `SkeletonUtils.js:39`, `retargetClip()` at `:226` |

**This is the third time an agent has been right to distrust something handed to it** — `CAPE-1`
contradicts its own brief, correctly, and says so under the brief's own code-wins rule. The practice
of writing briefs that invite this is now three-for-three and should continue.

### Run 2's headline findings

1. **`DRAW-2` — the hero's draw calls go DOWN, 14 → 4–8, but not for the reason you'd guess.**
   Skinning isn't inherently cheaper; it's that a rig lets 6 same-material primitives merge into one
   mesh, which separate `Object3D` joint groups structurally could not. **The lever is material-group
   count, not skinning.** That reframes the art-direction calls below as budget decisions too.
2. **`ASSET-1`/`ASSET-2` — Quaternius ships a "Superhero" proportion class on a shared rig with its
   own CC0 animation library.** An unplanned but strong fit for the "comic-accurate read" feedback,
   and the shared rig is what actually de-risks the pipeline.
3. **`CLIP-1` — the FSM's yaw-always-faces-travel behaviour eliminates strafe and backward clips
   entirely**, collapsing a naive directional blend tree to one speed axis per state cluster. Largest
   single reduction in authoring volume.
4. **`ORG-4`–`ORG-7` close run 1's handed-forward `§ORG-2`** as far as evidence allows: cross-engine
   reports put skinned-mesh jitter onset around 3 km, with a sourced mechanism (bone-chain matrix
   error compounding). **It revises run 1's "defer to Phase 5" recommendation** — the precondition
   that justified deferring (no skinned mesh exists) stops holding this phase. It specifies the exact
   synthetic test that would close it.

### All seven of run 2's user decisions are MADE — locked as decisions 12–18

The user walked the full list in one sitting. **The Phase 2 decision gate is closed. Nothing in run
2's document is awaiting a user answer any more.** See the locked-decisions table above for the
binding text of each; the short version:

| # | Decision | Chosen |
|---|---|---|
| 12 | Shading | PBR, keep the env map. No toon. |
| 13 | Outline | None. |
| 14 | Material grouping | 3 groups, visible face, **8 draw calls both passes** |
| 15 | Asset source | Quaternius only; Mixamo out this phase |
| 16 | Clip scope | Floor (4 assets) first, enhanced tier deferred not rejected |
| 17 | ORG-6 precision test | Run it as soon as a rig exists |
| 18 | Quaternius tiers | Free tiers, glTF; paid is a content upgrade, not a licence unlock |

**They cohere as a set, which is worth noting for whoever specifies the work:** 12, 13 and 14 all
push the same direction — let *proportion and silhouette* carry the comic read rather than shading
tricks — and 15 plus 18 mean the entire Phase 2 asset path is CC0 and costs nothing to start.

### Orchestrator correction to §ASSET-2 — verified live, 2026-08-01

**Run 2 flagged Quaternius's "60–70% of my pack is completely free" line as a possible licence
ambiguity and left it open. It is not a licence ambiguity, and the document's worry can be closed.**
Checked directly against the vendor's own pack and itch.io pages this session:

| Pack | Licence | Free tier | Paid |
|---|---|---|---|
| Universal Base Characters | CC0 throughout | ~60–70%, in **FBX / OBJ / glTF** | $20 — full set + `.BLEND` + engine projects |
| Universal Animation Library | CC0 throughout | **45 animations**, FBX + **GLB** | $9.99 → 120+; $14.99 → `.BLEND` source |
| Universal Animation Library 2 | CC0 throughout | **42 animations**, OBJ/FBX/glTF | $14.99+ → `.BLEND` source, 110+ |

**Three things this establishes.** First, **CC0 covers the whole pack in every case** — paying buys
more content and the `.BLEND` sources, it does not buy different rights. Second, **glTF/GLB ships in
the free tier of all three**, and that is the only format this project consumes. Third, **the
Superhero proportion set §ASSET-1 recommends is confirmed to exist** — the pack ships 6 characters
across Superhero / Regular / Teen proportions, male and female.

**Consequence: §CLIP-3's sourced clips (idle, walk, run) are bread-and-butter locomotion and will
almost certainly sit inside a 42–45-clip free standard tier** — verify at implementation time, but
plan on zero spend. If a specific clip turns out to be paywalled, $9.99 unlocks 120+ on the original
library. That is a rounding error against the risk of designing around a constraint that isn't real.

### The world half started — Design went first, and its spec has landed

**User chose the world half over the character half** (2026-08-01), then **Design first** within it.
The sequencing argument, worth keeping because it generalizes: **the batch key is a design output.**
`BUD-3` groups buildings into `BatchedMesh` instances keyed by *facade material family*, and `DEN-2`'s
massing recipes are applied per building via data — so both are things Design defines and the
Engineer consumes. Building first would have specified them by implementing them, which is precisely
how Phase 1 ended up blocky (the Design agent was only added *after* human QA reported it).

| Stage | Model | Status | Output |
|---|---|---|---|
| Design — Phase 2 districts | Sonnet | **done** — 261,652 tokens, 90 tool calls | `DESIGN_SPEC_PHASE_2_DISTRICTS.md` (760 lines) |

Brief: `DESIGN_BRIEF_PHASE_2_DISTRICTS.md`, written to the charter's five-part Research→Design
contract. **It had to override three stale rows in `DESIGN_AGENT_BRIEF.md`'s "Hard constraints"
table** — that table still says *45 measured / 60 ceiling* and *primitives-only*, and the charter's
own spawn prompt calls it binding. Left uncorrected the agent would have designed to **less than half
the real budget.** The override is a visible table in the brief, not a quiet restatement.

**`DESIGN_AGENT_BRIEF.md` HAS NOW BEEN CORRECTED AT SOURCE** — user instruction, 2026-08-01, at the
end of session 7. It is safe to spawn a Design agent directly from the charter again. Five stale
places were fixed, not one: the constraints table, the spawn prompt's budget paragraph, the
"why the extra hop" rationale, the Research-handoff contract's "primitives-only reality" line, and
the header status ("not yet spawned" — it had run three times). **Phase 1 figures were kept and
labelled as history rather than deleted**, because this project has repeatedly been bitten by
documents that quietly changed a number and left readers unable to tell which figure an older
document meant. The charter also gained the both-pass convention, the hero's 8-call budget, the
no-post-processing rule, the CSM cascade correction, and a run-history table.

It obeyed both process rules — no subagents, wrote incrementally. Code untouched, 108/108 tests.

**What it specified:** 7 facade families (3 District A, 4 District B — **4 of the 5 shipped Phase 1
variants reused unchanged or single-hex retinted**, which is why the count lands inside `BUD-3`'s
band), 5 massing recipes at ~2,376 triangles across an assumed 80-building population, and a
district-merged ground/road scheme that satisfies `BUD-2`.

### Orchestrator spot-checks — one real error found and corrected

| Claim | Verdict |
|---|---|
| `MAT-1` — `StreetBlock.js`'s `FACADE_VARIANTS` comment claiming "no environment map" is stale | **Confirmed** — `StreetBlock.js:205-208` says "There is NO ENVIRONMENT MAP in this project"; the PMREM env map shipped in `6a07c13`. **A stale *code comment*, the more dangerous kind — the next engineer to read it would believe it.** Its lines 225-229 even name the env map as the precondition for raising metalness, and that precondition is now met |
| 7 families → 14 calls both passes, inside `BUD-3` | **Confirmed** — arithmetic correct, and 5 variants do ship (`lowriseA/B`, `midriseA/B`, `towerShared`), so the reuse claim holds |
| Hero budgeted at 14, "carried unchanged, decision 14" | **WRONG — corrected in place.** Locked decision 14 says **8**, explicitly "down from Phase 1's 14." **The spec conflated the decision's *number* with a *value*.** §BUD-6's 14 is right for run 1's time, so only the spec's own column was wrong |
| Code untouched, tests green | **Confirmed** — 108/108, `git status` clean apart from known untracked |

**The correction is annotated in the document, not silently applied** (§BGT-1). Hero → 4 main / 4
shadow / 8 total; subtotal **~75 → ~69**; headroom **75 → 81**. §11's dependent figures updated too.
**The error was conservative — it over-budgeted, so nothing specified was ever at risk.**

### Cost log — session 7

| Agent | Tokens |
|---|---|
| Research — Phase 2 character, run 2 (Sonnet) | 215,614 |
| Design — Phase 2 districts (Sonnet) | 261,652 |
| **Session 7 total** | **~477,266** |

Cross-session observable total: **~2,241,000.** Everything else — the spot-checks, the corrections,
the briefs, the state updates, the pushes — was inline orchestrator work.

### ⚠️ PAST THE 400k PREP-TO-PAUSE MARK — at ~477k

**The standing rule is: begin prepping to pause near 400k, and do not pause until the user says so.**
That mark is passed. **The user has been told and has not yet decided.** State is fully committed and
pushed after every step this session, so a pause costs nothing and strands nothing.

Report raw subagent token counts only, never a percentage of a ceiling, and **never attempt to look
up account usage** — no tool exposes it and the user has asked that it stop.

---

## Session 6 detail — opened 2026-07-31

**Phase 2 research has started. Phase 1 remains complete, verified and merge-ready — nothing in
it changed this session.**

State re-verified independently at the top of session 6: **108/108 tests**, branch fully in sync
with `origin/feat/3d-open-world` (**0 unpushed commits**), working tree clean apart from `.claude/`
and `KODAMAN_HANDOFF.md` (both pre-existing and untracked), `main` untouched.
[PR #3](https://github.com/cyang3859/C_K_prototype/pull/3) is **open and unmerged**, 51 commits,
base `dev`. **The review and the merge are the user's — do not merge it for them.**

### The user's decisions this session

1. **Phase 2 research, ahead of the naming table.** Offered the three options session 5 left open;
   they chose research. The naming table is still outstanding and still blocks Phase 2 *content
   porting*, not Phase 2 research.
2. **Phase 2 research is SPLIT INTO TWO RUNS, world first.** Phase 2 now spans three large areas —
   world/streaming (the plan of record), skeletal animation (pulled in by locked decision 9), and
   the deferred density/realism feedback. That is too much for one agent in a project that has lost
   three of them to session limits. **Run 1 = world, streaming and density. Run 2 = skeletal
   animation and the character work, spawned only after the user has read run 1's output.**

### Orchestrator ruling, made inline so the researcher did not have to guess

**Every draw-call figure from here on is stated as a TOTAL across both passes**, because that is
what `renderer.info.render.calls` reports and therefore what anyone can measure in the debug HUD,
**with the main/shadow split always shown alongside it.** Any proposed ceiling must say in the
sentence that states it that it counts both passes. This closes the "one pass or both" question
locked decision 7 required an explicit answer to.

Consequence for the plan of record: `IMPLEMENTATION_PLAN.md`'s Phase 2 acceptance criterion 2
("target: under 150") is a **pre-correction guess** with no stated pass convention. Replacing it
with a figure derived from the real 57 is one of run 1's deliverables.

### Run 1 has landed

| Stage | Model | Status | Output |
|---|---|---|---|
| Research — Phase 2 world (run 1 of 2) | Sonnet | **done** — 198,801 tokens | `RESEARCH_PHASE_2_WORLD.md` (1,009 lines, 38 tagged findings) |

**It obeyed the no-fanout rule and wrote incrementally.** Code untouched — `git status` clean apart
from the two known untracked files, `kodaman_prototype.html` zero diff.

**Orchestrator spot-checks, run independently rather than taken at face value:**

| Claim | Verdict |
|---|---|
| CSM's addon default is **3** cascades, not the 4 `RESEARCH_FINDINGS.md` asserts | **Confirmed** — `CSM.js:61`, `data.cascades \|\| 3` |
| Every Phase 1 building is a single `BoxGeometry`, so "blocky" is literally true | **Confirmed** — `StreetBlock.js:550` |
| The 57-call baseline and its 32/25 split | **Confirmed** — matches the test and `ENGINEER_PHASE1_CLOSE.md` |
| `BUD-2`'s 448-call figure (7 ground/road meshes × 64 chunks) | Arithmetic **correct** given its stated assumption, which it labels honestly |
| `ATM-4`'s claim that an earlier session's cached PDF and `pypdf` survived on disk | **Partly confirmed, and the brief was wrong** — see below |

**The brief told it the old scratchpad was gone; it checked anyway and found otherwise.**
`pypdf` is still on disk at the earlier session's `scratchpad/pylibs/`, dated **Jul 29**. The
LaDochy PDF itself is no longer findable (those directories get cleaned), so **that specific
citation cannot be re-verified now** — but the provenance account holds up where it can be checked.
**Treat `ATM-4`'s exact mileage figures as sourced-but-unre-verifiable.** Its *conclusion* is robust
independently of them: real LA visibility is kilometres-scale, so a 2–4 km world cannot show
literal haze physics and the fog numbers must be understood as deliberate stylization.

This is the second time an agent has been right to distrust something handed to it. Keep writing
briefs that invite it.

### Run 1's headline findings

1. **`BUD-2` — the biggest budget risk, and it is in no prior document.** Building `Chunk.js` by
   naively repeating Phase 1's per-block ground/road pattern (7 meshes) once per 256 m chunk costs
   **7 × 64 = 448 draw calls** before a single building. Ground and road must be merged or instanced
   *across* chunks; `Chunk.js` is "a data window into district-shared batches," not "a `StreetBlock`
   at 256 m."
2. **`BUD-3` — `BatchedMesh` is load-bearing, not polish.** One `Mesh` per building at realistic
   district counts is ~160 calls from buildings alone. Batching by facade family drops it to ~12–16.
3. **`BUD-6` — a derived ceiling of 150, both passes**, itemised up from ~67–85 with the headroom
   explicitly sized to absorb CSM's unmeasured cost. Numerically close to the old placeholder but
   for a stated, re-derivable reason — and it is a starting budget, not a verified result.
4. **`DIS-4` closes R2 in the way that matters:** Ord-grid blocks confirmed at 112/200 yards
   (~102/183 m) from a primary source, which **validates the existing 256 m chunk size** rather than
   disturbing it. LAMC §17.05 stayed behind a 403 and is flagged as search-synthesised, not read.
5. **§8 lists 10 unresolved gaps**, CSM's real shadow cost being the most consequential.

Its charter is `PHASE_2_RESEARCH_BRIEF.md` (new this session). That brief hands it
`KNOWLEDGE_BASE.md` rather than the document pile, scopes it against locked decisions 3, 7 and 8,
carries the 57-call correction and the pass-convention ruling, and puts four open questions to it:
the **two districts** to build (it proposes, the user approves), **world edge behaviour** at the
±1,024 m boundary, and research items **R1** (LA haze/visibility numbers) and **R2** (LA block
dimensions). It is explicitly forbidden from spawning subagents and instructed to write its
deliverable incrementally.

### Both user decisions from run 1 are made — locked decisions 10 and 11

The user took the researcher's recommendation on both, 2026-07-31. See the locked-decisions table.
**Two lesser questions run 1 raised were deliberately NOT put to the user:**

- **Day/night cycle length** (the 2D game's 4 minutes, ported unchanged). The researcher itself says
  this needs playtesting, and nothing exists to play yet. Premature — revisit once
  `DayNightCycle.js` runs.
- **`InstancedMesh` vs `BatchedMesh` for streamed props** (§BUD-4). A technical call inside the
  researcher's remit, not a user one. Its recommendation — over-allocate `InstancedMesh` at district
  scale and toggle unloaded instances via degenerate transforms — **stands as the working answer**,
  and it flags the tension honestly: `InstancedMesh`'s count is fixed at construction, which fights
  per-chunk streaming. Review or the Engineer may overturn it with measurements.

### ~~RUN 2 IS BRIEFED BUT NOT STARTED~~ — SUPERSEDED: run 2 ran and landed in session 7

**This block is history. See the session 7 block above.** Kept for the scope detail below, which is
still an accurate description of what run 2 was asked to cover.

| Stage | Model | Status | Output |
|---|---|---|---|
| Research — Phase 2 character/animation (run 2 of 2) | Sonnet | **done in session 7** | `RESEARCH_PHASE_2_CHARACTER.md` (937 lines) |

It was spawned and then **stopped within about two minutes, deliberately, when the user asked to
pause the session.** It had written **nothing** — `RESEARCH_PHASE_2_CHARACTER.md` does not exist.
**Nothing is stranded and nothing needs recovering. Spawn it fresh next session.**

**Its brief is written and committed: `PHASE_2_RESEARCH_BRIEF_CHARACTER.md`.** That is the whole
setup cost, already paid. To resume, spawn a **Sonnet** agent pointed at that brief — it carries the
full spawn instruction set, and the brief itself tells the agent to read `KNOWLEDGE_BASE.md` and
then `RESEARCH_PHASE_2_WORLD.md` as prior context.

Scope: skeletal animation, rig and glTF pipeline, animation state machines and blending, the cape,
asset sourcing and licensing, Ghost of Tsushima-grade fluidity, and the "character not human enough
/ wants a comic-accurate read" feedback. It inherits run 1's budget and conclusions.

Three things the brief leans on hardest, worth knowing before you read it:
- **The `Hero.js` / `LocomotionController.js` seam** is the constraint an animation system is most
  likely to break, since it wants to read velocity and write transforms in one place.
- **The cape's bug history** — three tests passed straight through two real defects because every
  one asserted *direction* and none asserted *position*.
- **Draw calls may go DOWN.** The hero is 7 primitives = 14 calls both passes; one skinned mesh
  could be 2.

---

## Session 5 closed 2026-07-31, deliberately, by the user

**PHASE 1 IS COMPLETE, FULLY VERIFIED, AND MERGE-READY. There is nothing left in it to do.**
Five browser passes, all 28 acceptance criteria, 108/108 tests, clean build, `main` untouched,
`kodaman_prototype.html` zero diff. **Everything is committed AND pushed** — unlike previous
sessions, nothing is stranded locally. Working tree clean apart from `.claude/` and
`KODAMAN_HANDOFF.md`, both pre-existing and untracked.

**The whole six-agent pipeline has now run at least once.**

### Do this first next session — ANSWERED in session 6, see the block above

**The user was asked at the top of session 6 and chose option 1, Phase 2 research.** Options 2 and
3 remain open and unstarted. Kept below for the detail on each:

1. **Phase 2 research** — the plan of record and the natural next step. Locked decisions 7, 8
   and 9 are the binding scope; the user's deferred design feedback is the input (RDR2 and the
   Watch Dogs series for open world, Ghost of Tsushima for animation fluidity). **Hand the
   researcher `KNOWLEDGE_BASE.md`, not the document pile.** Budget from the real **57**, and say
   explicitly whether any new ceiling counts one pass or both. Does NOT need the naming table.
2. **The trademark naming table** — still descriptions, not names. Blocks Phase 2 *content
   porting*, not Phase 2 research. Per locked decision 6 the user approves every name; the
   companion at 345 references is the one they should name personally.
3. **PR #3** — open, 49 commits, base `dev`. Verified and merge-ready. **The review and the
   merge are the user's; do not merge it for them.** Merging before Phase 2 means that work
   builds on landed code.

### Session 5 in one paragraph

Fixed the cape (it was mounted *inside* the torso, not merely colliding at speed — the recorded
diagnosis had been half wrong), opened PR #3, ran the Overview agent to produce
`KNOWLEDGE_BASE.md`, and built the PMREM environment map that finally closed the dark-tower
defect. Every one of those was verified by the user in a browser except the PR. Two stale entries
in this file were found and corrected rather than propagated — the body-pitch "open finding" that
the code had already implemented, and the cape diagnosis.

---

## Session 5 detail

**Spot-check 3 was run by the user 2026-07-31. Six of seven steps pass.** Flight lean, the
tuning sliders, the dive angle, the helipad, and roof art + landing on the real roof are all
confirmed by eye. The parapet-ring change is verified: screenshots show the yellow ring and
**H** clearly, the coping running around the roof edge, and the hero standing on the roof plane
with the HVAC boxes at his feet.

**Step 3 — the cape — FAILED, and the diagnosis was wrong.** It had been recorded here as a
speed case: "with the body flat, the cape's world lift is colinear with the torso." That is
real, but it is the *second* cause. The first is that **`CAPE_Z` was 0.14 while the torso is a
capsule of radius 0.28** — the anchor sat ~0.07 m *inside* the chest, so the cape was buried
from the first frame, at zero speed, with no lift involved at all. Both are fixed in `e382edb`:
`CAPE_Z` 0.14 → 0.32, plus a new `CAPE_MIN_STANDOFF` (0.4 rad, faded in by body pitch, live in
lil-gui). **Not verified visually.**

**Why three passing tests did not catch it.** All three B1 cape tests ask about **direction** —
does the hem point away from travel. A cape can trail perfectly backward while buried in the
chest it trails from. Two new tests measure **clearance** against the real capsule the torso is
built from, sampled down the cape rather than at the hem. Both were confirmed to fail on the
shipped values before the fix landed. **Lesson: a direction assertion is not a position
assertion.** Worth applying to the rest of the rig.

**Step 7 — the tower facade — the user shared screenshots rather than a verdict.** Reading them:
close up the facades now genuinely read as glass — blue-grey, visible window rhythm, banding,
light response across the surface. The palette fix worked at that range. **At street level and
at distance they still read as near-black slabs.** So the envMap question below is live, and it
is the user's call whether it is worth doing.

**The user also shared a street-level screenshot as general context on how the world looks.**
That is Phase 2 input, not a Phase 1 defect — it is the same "too blocky and rigid / empty
world" note they already deferred themselves. Recorded, not acted on.

**Spot-check 4 (the cape fix) passed 2026-07-31.** Dash flight and the mid-air pose both show
clear separation between cape and torso — two distinct shapes, no merging. The standing pose was
screenshotted from the front, so the cape is edge-on there and the shot cannot fully exercise
"hangs as a sheet against the back"; what it does confirm is **no interpenetration**, which is
the fix, and no sign of the wind-tunnel overcorrection. Judged a pass on that basis, with the
limitation recorded rather than papered over. `CAPE_MIN_STANDOFF` stayed at its 0.4 default —
the user did not retune it.

### Next, and nothing is blocking

Tests **105/105**, build clean, `kodaman_prototype.html` zero diff, nothing pushed, `main`
untouched. The queue is unchanged apart from the cape moving to "fixed, unverified":

1. **A one-step browser look at the cape.** It is two unverified visual changes.
2. ~~**Open the PR against `dev`.**~~ **DONE — [PR #3](https://github.com/cyang3859/C_K_prototype/pull/3)**,
   opened 2026-07-31. 47 files, +16,809, base `dev`, **open and unmerged — the review and the
   merge are the user's.** `main` untouched, as it must stay. The branch is now pushed, so
   `origin/feat/3d-open-world` exists and further commits go up with a plain `git push`.
3. ~~**The Overview agent**~~ **DONE** — `KNOWLEDGE_BASE.md`, 478 lines, Sonnet, 127,078 tokens.
   **Read it first from now on**, ahead of this file: it is the consolidated map of the build,
   the app lifecycle, the flight FSM, and the other 21 documents. It wrote the FSM tables from
   the code rather than from prose, and it found the stale body-pitch finding above.
   **The pipeline is now complete — all six stages have run at least once.**
4. ~~**The envMap**~~ **DONE AND VERIFIED** — `6a07c13`, spot-check 5 passed 4/4 on 2026-07-31.
   PMREM baked from a synthetic sky, no asset file, zero draw calls, no frame-rate cost.
   **The dark-tower defect is closed.** The towers now read as glass with visible window rhythm
   at street level and at distance, which is exactly where they failed before; matte surfaces did
   not go milky; draw calls and frame rate unchanged. `ENV_INTENSITY` stayed at its 1.0 default —
   the user did not retune it.

   **The metalness question is closed too, as not needed.** The plan was to raise the towers back
   toward 0.45/0.70 if the environment map alone was not enough. It was enough. Raising it now
   would be a change with no problem left to solve, on a build a human has just signed off. The
   option stays available and physically defensible if a Phase 2 pass wants more glassiness.
5. **Phase 2 research** — now unblocked and the natural next big step. Locked decisions 7, 8 and
   9 are the binding scope; the user's deferred design feedback is the input. Hand the researcher
   `KNOWLEDGE_BASE.md` rather than the fourteen-document pile.
6. **The trademark naming table** — still descriptions, not names. Blocks Phase 2 content
   porting. The companion at 345 references is the one the user should name personally.

**PHASE 1 IS FULLY VERIFIED AND HAS NO OPEN VISUAL DEFECTS.** Every bug found across **five**
browser passes is fixed and re-verified by eye, including the dark towers — the last one. All 28
acceptance criteria pass. 108/108 tests, build clean, `kodaman_prototype.html` zero diff.

There is nothing left in Phase 1 that needs a human at a keyboard. The next work is Phase 2, and
it needs two decisions from the user before it starts — see below.

---

## Earlier resume notes (session 4 and before)

**Phase 1 is BUILT, independently verified, and human-tested. It survived the test pass in good
shape: 10 of 13 browser criteria clean, one measurement recorded, one defect, one fail.**

**Scope note, from the user 2026-07-30.** After the spot-check they gave a batch of broader
design feedback — character not human enough and wanting a comic-accurate read, empty world with
too few landmarks, buildings and landscape "too blocky and rigid," open-world inspiration from
RDR2 and Watch Dogs, animation fluidity like Ghost of Tsushima. They then recognised it as scope
creep against the phase plan themselves and **deferred it to Phase 2+**. Locked decisions 7, 8
and 9 are what survived into binding scope. **Do not fold the deferred feedback into Phase 1
work** — it is Phase 2 Research input and is recorded here so it is not lost.

**Session 4 continued past this point; see below for current status.**

**The user is running the browser spot-check between sessions.** The guide is
`docs/handoff/BROWSER_SPOT_CHECK.md` — 9 steps, written for them, covering B1–B4 visually, the
draw-call count, regressions on criteria 14/20/24, and the B5 decision. **Ask for their results
first thing.** They report back as a numbered pass/fail list.

### Session 4 closed here, deliberately, by the user

**Phase 1 is complete and verified.** All 28 acceptance criteria pass. Three browser passes were
run by the user. Current state on real hardware: **120 fps**, draw calls 50 in flight against a
57 computed worst case, geometries/textures flat.

**Everything committed. Working tree clean** except `.claude/` and `KODAMAN_HANDOFF.md`, both
pre-existing and untracked. Nothing pushed. `main` untouched.

**Latest tests: 102/102. Build clean.**

#### FIRST THING NEXT SESSION — a short browser re-check

Four changes landed after the user's last pass and **none has been seen**:

1. **The helipad should now be visible.** It never was: G1's parapet shipped as a solid slab
   covering the whole roof, sitting on the exact face the atlas paints the helipad onto. Raising
   it 3.5 m → 12 m changed nothing. G1 is now a **ring of four bars** (same one draw call), so
   the roof centre is clear.
2. **Dives reach ~70°** instead of ~44° (`PITCH_SPEED_DIVISOR` 8.0 → 5.0).
3. **Criterion 20 needs re-confirming** — landing now puts the hero on the real roof at `b.h`
   rather than on the slab at `b.h + 0.45`.
4. **Roof art should now be visible generally**, not just the helipad.

Write the guide before asking — see the standing preference in persistent memory. Format:
`BROWSER_SPOT_CHECK_3.md`.

#### Open, in rough priority order

- ~~**Cape clips through the body at speed.**~~ **FIXED in `e382edb`**, and the cause recorded
  here was only half of it. See the session 5 resume block at the top — the anchor was mounted
  *inside* the torso capsule, which the "at speed" framing missed entirely.
- **The envMap question.** `DESIGN_SPEC_TOWER_PALETTE.md` flags that the physically correct fix
  for glass is a real environment map, PMREM-baked from a synthetic sky, **no asset file needed**.
  It would let metalness go back up where it belongs. Touches `Renderer.js` and `Sky.js`. Only
  worth doing if the user still finds the towers flat.
- **The PR against `dev` has never been opened.** Phase 1 is done and should land before Phase 2
  builds on it. **Never push `main`.**
- **The Overview agent has never run** — the last pipeline stage. `KNOWLEDGE_BASE.md` plus the
  build wireframe. Worth doing BEFORE Phase 2 research, since that research needs to understand
  what exists and it is currently spread across fourteen documents.
- **Phase 2 research.** Locked decisions 7, 8 and 9 are the binding scope; the user's deferred
  design feedback (recorded above) is the input. References they named: **RDR2, the Watch Dogs
  series, Ghost of Tsushima** for animation fluidity. Budget from the real **57**, and say
  whether any new ceiling counts one pass or both.
- **The trademark mapping table still holds descriptions, not names**, and blocks Phase 2 content
  porting. Per locked decision 6 the user approves names. The companion at 345 references is the
  one they should name personally.

---

**B1–B4 are fixed and committed.** Tests (76/76 at the time), build, and the 2D-file zero-diff
were re-verified independently by the orchestrator. **Nothing was verified visually** — the
Engineer had no GPU and correctly refused to claim any visual result.

**Then the next action is: spawn an Opus Engineer to implement the building design spec.**
Hand it both documents together — the spec and the review are a pair:

- `DESIGN_SPEC_PHASE_1_BUILDINGS.md` — 446 lines, what to build.
- `REVIEW_DESIGN_SPEC_BUILDINGS.md` — APPROVED WITH CORRECTIONS. **Two corrections are
  mandatory and both ship as drop-in code:** the roof-atlas `ctx.scale(1, 0.17857)` aspect
  compensation, and the second `Box3` per building registering parapet collision. Without the
  second one, landing on the tower roof (criterion 20) breaks.

Fold in whatever the spot-check turns up, plus the **B5** decision, so it is one Engineer run
rather than three.

**An open option nobody has decided:** G1's parapet is specified as a solid slab over ~97% of
each roof. Real coping is a perimeter **ring** — 4 instances per building instead of 1, which
on an `InstancedMesh` is **still one draw call and zero budget change**, looks more like real
coping, and leaves the roof centre clear so the collision correction is not needed at all. Put
this to the user before the Engineer starts.

**B5 is decided and fixed** — arms forward, legs trailing, commit `44df9fe`. Done inline by the
orchestrator rather than by an agent: the diagnosis was already complete in
`SPOT_CHECK_RESULTS.md` and the change was two sign flips. Unverified visually.

### Phase 1 is verified end to end

**Spot-check 2 passed on every step**, including criterion 20 — landing on the tallest roof —
which confirms the parapet collider holds. Between the Engineer's headless work and two human
browser passes, all 28 acceptance criteria are now verified. **Phase 1 is done.**

Measured on real hardware: **120 fps**, draw calls **47 street / 52 peak** against the 57
computed worst case, geometries and textures **flat at 27 / 21** over five minutes.

Three items came out of it, none blocking:

1. **Flight lean and dive angle** — fixed inline, commit `fd33b41`. Unverified visually.
2. **The helipad was invisible** at 3.5 m — now 12 m. Unverified visually.
3. **The dark tower facade reads as near-black** with pure-black window voids and almost no
   light response. The tan mid-rise, by contrast, reads well — window rhythm, banding, depth.
   **This is a palette defect, not taste**, and it is the one substantive visual problem left.
   It belongs to Design, not to a guess at hex values.

### CORRECTION — the draw-call budget was counting half the work

**Every draw-call figure this project used before 2026-07-31 was a main-pass count. The real
number includes the shadow pass.**

`renderer.info.render.calls` accumulates across **both** passes: `WebGLRenderer` calls
`info.reset()` and *then* `shadowMap.render()`, and the shadow map draws through the same
`renderBufferDirect`. So every shadow-casting object costs **two** calls, not one. Verified
independently by the orchestrator in the installed `three` 0.185.1 bundle — `info.reset()` at
line 17696, `shadowMap.render()` at 17702, main scene render at 17751.

Worst case with nothing culled, from a scene-graph walk:

| | Main pass | Shadow pass | **Total** |
|---|---|---|---|
| Before the building pass | 28 | 21 | **49** |
| After | 32 | 25 | **57** |

**Consequences:**

- `DESIGN_SPEC_PHASE_1_BUILDINGS.md`'s ledger — 45 baseline, +4, "eleven calls of headroom left
  for the character pass" — **counts main-pass objects only.** The headroom it promises does not
  exist.
- The real position is **57 against a 60 ceiling: three calls of headroom, not eleven.** The
  character pass cannot be budgeted against 49.
- The human's 42 and the earlier 45 are both consistent with a 49 worst case; they differ
  because each pass culls independently.

**For locked decision 7: raise from 57, and state explicitly whether the new ceiling counts one
pass or both.** Getting this wrong in the other direction — setting a ceiling that silently
assumes single-pass — would repeat the same mistake with a bigger world.

### ~~OPEN FINDING — body pitch ignores horizontal speed~~ — CLOSED, and this entry was stale

**The Overview agent caught this 2026-07-31 and it was right.** The finding below describes a
fix as missing that the code already implements: `LocomotionController._updateOrientation` now
carries the full two-term model — a `sqrt`-curved speed lean from horizontal speed, plus the
original vertical term faded out as horizontal speed rises. Verified by reading the code.
Spot-check 3 step 1 confirmed it by eye and the user passed it.

Kept below only for the reasoning, which is still worth having. **Do not act on it.**

Original entry follows.

Raised while fixing B5, **not yet acted on, needs a user decision.**

`LocomotionController.js:507-511` computes `pitch = -velocity.y / PITCH_SPEED_DIVISOR` — from
**vertical velocity alone.** So flying fast and level produces `pitch = 0` and leaves the hero
**upright**, standing in the air, however fast they are travelling. The comment directly above it
claims the opposite: "Body pitch leans the hero toward horizontal at speed (the Superman pose)."

This is very likely the deeper cause of the user's "the flight pose is inverted, the arms don't
point towards the direction of travel." The B5 sign fix makes the arms reach forward *relative to
the body*, but if the body stays vertical during level cruise, forward-reaching arms still point
upward in world space.

**Candidate fix:** derive pitch from horizontal speed as well as vertical — lean toward
horizontal as the hero approaches `FLIGHT_DASH_SPEED`, with the existing vertical term added on
top. **This is a feel change, not a bug fix**, so it is the user's call, and it wants a browser
to tune. Do not fold it into an unrelated run.

**B5 — flight limb poses carry the same inversion as B1/B4.** Arms at `rotation.x = -2.6`
sweep **back** over the head while the comment says "arms forward"; legs point forward ~7°
while the comment says "trailing". The Engineer deliberately did **not** fix this, correctly:
unlike B1/B4 there is no arithmetic answer — both silhouettes are legitimate flight poses, so
it is a **design and taste call, not a correctness call.** Written up in the fix report; a
two-line edit once someone decides. The grounded walk cycle is unaffected (symmetric signs
cancel). **Resolve this before Design runs**, since it decides the hero's flight silhouette and
Design would otherwise be speccing around an open question.

**Then, in order:**
1. **Design (Sonnet)** — the new sixth agent. Read `DESIGN_AGENT_BRIEF.md` first; it holds the
   charter, the binding constraints table, and a ready spawn prompt.
2. **Review (Sonnet)** — budget gate on the design spec. Draw calls, triangles, renderer
   feasibility, locked decisions. **Not a vote on taste.**
3. **Engineer (Opus)** — implement the reviewed design spec.
4. **Overview (Sonnet)** — `KNOWLEDGE_BASE.md` and the build wireframe.

**Draw calls measured at 45 against the 60 ceiling.** Fifteen calls of headroom is the single
most important number for everything downstream of here — the whole realism pass has to fit
inside it.

**A PR against `dev` has not been opened.** The original plan was to open it after a clean QA
pass; QA was not clean. Open it once B1–B3 are fixed and verified. **Never push `main`.**

### Independent verification already performed by the orchestrator

Do not redo these — they are confirmed:
- `npm test` -> **60/60 passing** (collision 22, locomotion 38)
- `npm run build` -> clean, `585.44 kB` / `151.37 kB` gzipped, 25 modules, ~900 ms
- `node_modules/` and `dist/` correctly gitignored
- **`kodaman_prototype.html` has a zero diff** — the 2D game is untouched
- 4 Engineer commits, nothing pushed

---

## What happened so far

**Session 1**
1. Verified the real state of the codebase. `KODAMAN_HANDOFF.md` is **stale** — it claims
   ~5,200 lines; the actual file is **16,507 lines / 896 KB**, 100% 2D canvas, no dependencies.
   Trust the code over that doc.
2. Branch was initially cut from a stale local `dev` (34 commits behind `origin/dev`).
   Fast-forwarded to `origin/dev`. The first research agent read the stale file for part of its
   run and was sent a correction mid-flight.
3. First research agent completed `PHASE_1_SPEC.md`, then **terminated on a session token
   limit** while writing the implementation plan. Its LA child agent finished substantial
   research but had written **no files**.

**Session 2**
4. Resumed the LA agent for the sole purpose of persisting its findings to disk. Cost ~138k
   tokens but rescued ~100k tokens of research that existed nowhere else.
5. A Sonnet research agent spawned **four unauthorized child agents**. It was stopped and
   redirected. Its children's work had already returned, so the 920-line findings file is
   complete rather than wasteful — but the fan-out was not sanctioned and should not recur.
   **Lesson: explicitly forbid subagent spawning in every agent prompt.**
6. User decided trademark handling (locked decisions 5 and 6).
7. Review agent resolved all three known conflicts, produced 12 flags + 3 research items,
   and wrote the implementation plan before being stopped for the session pause.

### Cost log (observable subagent tokens only)

| Agent | Tokens |
|---|---|
| LA worldbuilding (session 1) | 100,056 |
| Findings, first pass | 63,697 |
| LA worldbuilding recovery | 137,871 |
| Findings, completion | 151,384 |
| Review (partial, stopped) | not reported |
| **Observable total** | **~453,000** |

The first Opus research agent's spend before it died is not reported.

**Session 3 (in progress)**

| Agent | Tokens |
|---|---|
| `ENGINEER_BRIEF.md` writer (Sonnet) | 131,281 |
| Engineer — Phase 1 build (Opus) | 187,269 |
| **Session 3 total** | **318,550** |

**Approaching the 400k prep-to-pause mark.** A QA agent would likely add 100–150k and cross
it. Slowing down; awaiting the user's call on whether to run QA now or pause first.

Cross-session observable total: **~771,000.**

**Session 5 — 2026-07-31.**

| Agent | Tokens |
|---|---|
| Overview — `KNOWLEDGE_BASE.md` (Sonnet) | 127,078 |
| **Session 5 total** | **127,078** |

Everything else this session was done inline by the orchestrator: the cape fix, the envMap, PR #3,
and three browser guides. Cross-session observable total: **~1,564,000.**

The Overview agent **obeyed the no-fanout rule** — worth recording, since the previous two agents
did not. It also caught a real doc/code contradiction rather than propagating it, which is the
behaviour the brief asked for and the thing this project has most often failed at.

**Session 4 — ended 2026-07-30, closed deliberately by the user.**

| Agent | Tokens |
|---|---|
| Engineer — B1–B4 bug fixes (Opus) | 152,611 |
| Design — building spec (Sonnet) | 122,497 |
| Review — feasibility gate on that spec (Sonnet) | 113,626 |
| Engineer — Phase 1 close, attempt 1 (Opus) | died on a session limit, no work done |
| Engineer — Phase 1 close, attempt 2 (Opus) | 180,786 |
| Design — tower palette follow-up (Sonnet) | 96,040 |
| **Session 4 total** | **665,560** |

Cross-session observable total: **~1,437,000**.

**The Design agent broke the no-fanout rule.** Its prompt forbade spawning subagents in those
words; it delegated a lighting lookup to a read-only Explore agent anyway, foreground and small,
and disclosed it unprompted. The finding was correct and was independently verified. Recorded
because the rule exists after an earlier agent burned budget fanning out, and it has now been
violated by an agent explicitly told not to — worth weighing when trusting that instruction.

Cross-session observable total: **~1,160,000**.

**AT THE 400k PREP-TO-PAUSE MARK.** The next Engineer run costs ~150–190k on the evidence of
the last one, which would put this session near 550k. Prep to pause is underway; **do not pause
until the user says so.** Never attempt to look up account usage — no tool exposes it and the
user has asked that it stop.

What happened:
1. The user ran `HUMAN_TEST_GUIDE.md` in full and reported all 13 results.
2. Each failure was diagnosed against the actual source before being written up — not taken at
   face value from the report. That is how B3's real cause (near-plane geometry, not hero
   penetration) and the suspected B4 were found.
3. The user approved adding a **Design agent** as a sixth pipeline stage, with Research
   branching and a Review budget gate on Design's output.
4. Wrote `QA_HUMAN_RESULTS.md` and `DESIGN_AGENT_BRIEF.md`; rewrote this file's pipeline shape,
   status table, and resume pointer. Committed as `c409068`.
5. Spawned the Opus Engineer against `QA_HUMAN_RESULTS.md`. It fixed B1, B2, B3, confirmed and
   fixed B4, and raised a new **B5** it deliberately did not fix. Four commits
   (`a9fa760`, `e2a2e87`, `95a15ab`, `5cde9e8`). Report: `ENGINEER_FIX_REPORT.md`.

**Orchestrator re-verification of the Engineer's gate claims** — run independently, all
confirmed:

- `npm test` → **76/76** (was 60/60; +16 new tests)
- `npm run build` → clean, 25 modules, 585.89 kB
- `kodaman_prototype.html` → **zero diff**
- Working tree clean, nothing pushed, `main` untouched
- The B1/B4 rotation math in the new comments was checked against the arithmetic and is correct

**Not re-verified:** draw calls still 45. The Engineer's reasoning (no mesh, geometry or
material added or removed) is sound, but nobody has measured it since the fixes. Confirm with
`F1` on the next browser pass.

**Only `.claude/` and `KODAMAN_HANDOFF.md` remain untracked**, both pre-existing.

### The Engineer's correction to the B2 diagnosis — worth carrying forward

`QA_HUMAN_RESULTS.md` states the tap-`W` apex as **0.96 m**. That was the *scripted climb
only*. A tap also keeps a coast: the FSM enters `flying` with `W` released, hover damping
bleeds the residual climb speed off over its half-life, and **gravity is never applied in any
flight state** — so roughly `0.087 m` of extra altitude is retained per `m/s` of climb speed.
The real shipped apex was **1.36 m**. Sizing the fix against 0.96 m would have overshot the
target by ~40%. The Engineer caught this and sized against 1.36 m instead.

Lesson for future QA write-ups: in this FSM, altitude is not just the scripted phase.

Report raw subagent token counts only. Never a percentage of a ceiling — no tool exposes
account usage, and the user has asked that it not be attempted.

---

## Review outcomes — see `REVIEW_FLAGS.md` for full detail

**Headline: zero unresolved BLOCKERs remain for Phase 1.**
12 flags total (3 BLOCKER-designated-and-resolved, 4 MAJOR resolved, 5 MINOR) plus 3 items
marked NEEDS RESEARCH.

### Rulings on the three known conflicts

| Flag | Conflict | Ruling |
|---|---|---|
| F1 | `WebGLRenderer` (spec §5) vs `WebGPURenderer` (findings §A13) | **WebGL for the whole plan.** The official CSM cascaded-shadow addon is WebGL-only; WebGPU would need the less-mature `CSMShadowNode`. Choosing WebGPU also commits to TSL vs classic materials and is expensive to reverse once world/character code is built against it. |
| F2 | `PHASE_1_SPEC.md` Hero.js cites §C4, means §C3 | Confirmed citation bug. Corrected in the brief. |
| F3 | 4,096 m world extent (LA research §9.5, provisional) | Reconciled against the §A4 draw-call/triangle budgets. See `REVIEW_FLAGS.md` F3 for the reconciled figure and reasoning. |

### F7 — the most important technical correction

`PHASE_1_SPEC.md` §5 gives a general per-frame→per-second damping conversion of
`perSecond = factor^60`, but it only holds for two of the three constants:

| Constant | per-frame | `factor^60` | Verdict |
|---|---|---|---|
| `GROUND_FRICTION` | 0.82 | ~6.75x10^-6 | fine |
| `AIR_FRICTION` | 0.92 | ~6.74x10^-3 | fine |
| `FLIGHT_HOVER_DAMPING` | 0.18 | **~2.1x10^-45** | **degenerate** |

`0.18^60` is so close to zero that `v *= Math.pow(2.1e-45, dt)` collapses velocity to zero
within a single fixed step. Not numerically broken — JS doubles handle it, no NaN risk — but
it provides **no usable tuning knob**: the constant does nothing until the exponent nears 1.0,
at which point it swings between "instant" and "never."

**Resolution the Engineer must implement:** give hover damping its own explicit decay with a
half-life of ~0.05–0.08 s, exposed in lil-gui as `hoverDampingHalfLife`, applied as
`v *= 0.5 ** (dt / halfLife)`, combined with the spec's existing hard snap-to-zero below
0.11 m/s. **Do not derive it from `0.18^60`.** `GROUND_FRICTION` and `AIR_FRICTION` are fine
as specified.

### Three items needing research, not judgment

- **R1** — LA visibility/haze parameters. The fog numbers in LA research §9.5 are guesses. The
  LaDochy visibility PDF is cached in the session scratchpad and needs text extraction.
- **R2** — DTLA and suburban block dimensions. Lead: the 1849 Ord survey in varas.
- **R3** — Trademark rename per-occurrence classification. The §C4 counts are **sampled, not
  exhaustively classified** into player-visible strings vs. code identifiers vs. comments.
  Totals are reliable; the per-category split is approximate.

---

## Open items needing user sign-off

### Trademark exposure — MUCH larger than first assessed. Blocks public release.

Measured occurrence counts in `kodaman_prototype.html` (case-insensitive). The `wayne` count
of 112 and the `drawCape` location were independently verified by the orchestrator.

| Mark | Count | Type |
|---|---|---|
| `Lois` / Lois Lane | 345 | companion character |
| `arkham` | 126 | scene id, building |
| `lexcorp` | 114 | building |
| `wayne` (+ Wayne Enterprises, Bruce Wayne) | 112 | scene id, building, character |
| `powerGirl` | 93 | companion character |
| Wonder Woman / Diana / Themyscira / Ares | 61 | L3 companion arc, location, villain |
| Gotham City | 31 | destination location |
| Lex Luthor | 28 | boss character |
| Kryptonite / Kryptonian | 6 | material / origin term |
| Metropolis | 4 | location reference |
| "Daily Planet" | 1 | ambient NPC dialogue line |
| Darkseid / Superman / Batman | 5 | **source comments only**, not player-visible |

**Roughly 900+ occurrences across 10+ distinct protected marks.** This is NOT a cosmetic
find-and-replace. `Lois` at 345 and the Wonder Woman/Diana/Themyscira/Ares Level 3 arc mean a
rename touches character logic, dialogue trees, and quest state machines — not just display
strings.

Character *designs* are already legally distinct. **Only the names are the problem.**

**The repo is ALREADY PUBLIC** — `github.com/cyang3859/C_K_prototype`, public since
2026-06-14. All ~900 references are already published. Calibration: non-commercial fan
prototypes are ubiquitous on GitHub and enforcement against one is unlikely. This is a real
decision, not an emergency.

### RESOLVED — user decision 2026-07-30

- **Scope: rename in the 3D build only.** `kodaman3d/` uses original names from day one.
  `kodaman_prototype.html` is NOT edited — it stays a working design reference with its
  current names. This avoids regression risk in 16.5k lines where `Lois` (345 refs) and the
  Diana/Themyscira Level 3 arc are load-bearing in quest state and dialogue trees.
- **Authority: agents propose, user approves.** Research produces the mapping table with
  rationale. **No agent applies any rename before explicit user sign-off on the list.**
- Rename cost is paid once, during Phase 2+ porting, when that code is being rewritten anyway.

**Not blocking Phase 1** — the vertical slice is hero + street block + camera, no named
characters. The mapping table is needed before Phase 2 content porting begins.

### STILL OUTSTANDING — the proposed names are not yet actual names

`RESEARCH_FINDINGS.md` §C4 contains the full mapping table, but its "proposed replacement"
column currently holds **descriptions, not names** — e.g. "new reporter-companion name",
"invented secure-facility name". Nothing in it is usable as-is.

Before Phase 2 porting starts, someone must turn that column into concrete names. Per locked
decision 6 the user approves them. A reasonable split, offered when the user next engages:
the user supplies names for the characters they care about (the companion at 345 refs
especially), and agents fill in the remainder for sign-off.

---

## Corrections to existing project docs

`KODAMAN_HANDOFF.md` is stale and wrong on at least these points:

1. **Line count.** Claims ~5,200; actual is **16,507**.
2. **Cape rendering.** Claims a "multi-segment bezier quad-strip." Actually
   `drawCape()` at `kodaman_prototype.html:5188` is a **7-segment closed polygon** built with
   `ctx.lineTo` + `closePath()`, using per-vertex `Math.sin(e.capePhase + t*3)` wave
   displacement, a speed-driven backward trail (`trail = -(8 + speed * 3.2)`), and a flight-
   dependent `lift`. No bezier curves are used anywhere in it. Verified by direct read.
   This is good news for the 3D port: a sine-displaced polygon strip maps cleanly onto a
   bone-chain or vertex-shader cape.

---

## Verified environment

Node v20.20.2 · npm 10.8.2 · git 2.50.1 · gh 2.94.0 (authenticated, account `cyang3859`)

Node 20.20.2 satisfies Vite 7's `^20.19.0` engine requirement. Remote is
`git@github.com:cyang3859/C_K_prototype.git`. Branches: `main`, `dev`, `phase4-onto-dev`.

---

## Scope expectation

This pipeline delivers a **Phase 1 vertical slice** (Vite + Three.js scaffold, walk/fly hero,
one LA street block, third-person camera) plus the full written plan for later phases. Porting
16.5k lines of quests, dialogue, 11 scenes, and 3 levels into 3D is many sessions beyond this.
The plan is the durable deliverable; the slice proves the plan holds.

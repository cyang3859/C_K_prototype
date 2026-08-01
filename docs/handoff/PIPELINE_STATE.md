# Pipeline State — Resume Checkpoint

**Last updated:** 2026-08-01 (session 7 — Phase 2 research COMPLETE, both runs landed and spot-checked)
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
0. **`KNOWLEDGE_BASE.md` (478 lines) — START HERE as of 2026-07-31.** The Overview agent's
   consolidated map: module wireframe, app lifecycle, the flight FSM written from the code, the
   settled decisions, and an index of every other document with when to read it. It exists
   precisely so nobody has to read the fourteen-document pile cold.
1. This file — decisions, status, resume pointer
2. `QA_HUMAN_RESULTS.md` — the human test pass; 3 confirmed bugs + 1 suspected, assigned
3. `REVIEW_FLAGS.md` — 12 adjudicated flags; the rulings are decisions already made
4. `DESIGN_AGENT_BRIEF.md` — the new sixth agent; read before spawning anything design-related
5. `ENGINEER_BRIEF.md` — the self-contained Phase 1 build order
6. `IMPLEMENTATION_PLAN.md` — phases beyond 1
7. `RESEARCH_FINDINGS.md` and `RESEARCH_LA_WORLDBUILDING.md` — consult by section, never
   end-to-end

**Never read `kodaman_prototype.html` in bulk.** 16,507 lines; it has killed agent budgets.
Targeted `grep` only.

**Standing working rules** (also stored in persistent memory, so they survive a cleared chat):
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
| 14 | Hero material grouping | **3 material groups — suit, skin, accent/cape. Visible face, NOT a full cowl. 8 draw calls total across both passes.** User decision 2026-08-01, on §DRAW-2. Down from Phase 1's 14. The 4-call full-cowl floor was the argued alternative and is rejected: a visible face directly serves the user's "character isn't human enough" feedback, and §DRAW-2 itself calls 3 groups the art-direction-neutral target. **The 8 is a budget the Engineer must hit, not an aspiration** — a rig built object-by-object instead of merged stays at 14 and silently wastes the entire gain. |
| 15 | Asset source | **Quaternius only for Phase 2. Mixamo is OUT of scope this phase.** User decision 2026-08-01, on §ASSET-3/§ASSET-5. Mixamo's terms permit shipping inside a game, but a permanently-archived *public* git history of Mixamo-derived `.glb` is not a scenario those terms clearly anticipate — not a violation, not unambiguously clean. Quaternius is unambiguous CC0, so this **sidesteps the question rather than answering it.** Mixamo may be reconsidered in a later phase if a specific motion is genuinely unavailable. Kenney stays reserved for future crowd/NPC work per §ASSET-4, never for the hero. |
| 16 | Animation authoring scope | **Floor first, then decide on the enhanced tier.** User decision 2026-08-01, on §CLIP-3/§CLIP-4. Ship §CLIP-3's 4 assets (idle/walk/run sourced CC0, one custom flight hold), see the rig moving in a browser, and only then decide whether §CLIP-4's remaining ~6 are worth authoring. Every flight-specific clip is custom either way (§CLIP-5 — flying humans are not a mocap category), so this **defers the expensive half until the cheap half is proven.** The enhanced tier is deferred, NOT rejected — it is what actually answers the Ghost of Tsushima fluidity reference. |
| 17 | Floating-origin precision test | **Run §ORG-6's synthetic test as soon as a rigged hero exists in Phase 2. Do not defer to Phase 5.** User decision 2026-08-01. It is **a test, not a system** — no `FloatingOrigin.js`, nothing beyond the rig being built anyway. Spawn the rigged hero at 0 / 1,024 / 2,048 / 3,072 / 6,144 m, apply identical bind and animated poses, diff world-space vertex positions against an origin-computed pose rigidly translated. Run 1 deferred this only because no skinned mesh existed to test; locked decision 9 removes that precondition. Running it late risks discovering jitter after the animation work is already built on the rig. |
| 18 | Quaternius tiers | **The "60–70% free" figure is a CONTENT/FORMAT tier, not a licence split. Everything is CC0.** Orchestrator-verified 2026-08-01 — see the §ASSET-2 correction in the session 7 block. Free tiers ship **glTF/GLB**, which is the only format this project needs. **Start on the free tiers; the paid tiers are a $9.99–$20 content upgrade, not a licence unlock, and can be bought later without rework.** |

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
| envMap — PMREM sky environment | orchestrator, inline | **done** — commit `6a07c13`, 108/108 | `BROWSER_SPOT_CHECK_5.md` awaiting a human |
| Research — Phase 2 world (run 1 of 2) | Sonnet | **done** — 198,801 tokens | `RESEARCH_PHASE_2_WORLD.md` (1,009 lines, 38 findings) |
| Research — Phase 2 character (run 2 of 2) | Sonnet | **done** — 215,614 tokens | `RESEARCH_PHASE_2_CHARACTER.md` (937 lines, 29 findings) |

Total planning corpus: **4,132 lines across 7 documents.** Plus **6,691 lines of code.**

---

## >>> RESUME HERE — session 7, 2026-08-01 <<<

**PHASE 2 RESEARCH IS COMPLETE, spot-checked, and its decision gate is CLOSED.** Both runs landed,
all seven of run 2's user decisions were made this session and are locked as **decisions 12–18**, and
the one open licensing question (§ASSET-2) was verified live and closed. **Nothing in either research
document is waiting on the user any more.**

**Do this first next session: pick the Phase 2 build path.** Research is done and the decisions that
gate specification are made, so the next stage is **Design or Engineer, not more research.** The open
question is which, and it is a genuine fork worth putting to the user rather than assuming:

1. **Design first** — spawn the Design agent (Sonnet) for a character/animation spec, the way
   `DESIGN_SPEC_PHASE_1_BUILDINGS.md` preceded the Phase 1 building work, then gate it through Review
   for the budget/feasibility check per `DESIGN_AGENT_BRIEF.md`. Decisions 12/13/14 are exactly the
   art-direction inputs such a spec needs, and they are now settled.
2. **Engineer first** — go straight to the glTF/rig pipeline, since decisions 14–18 arguably specify
   enough already (8 draw calls, Quaternius free tier, 4 clips, run the ORG-6 test). Faster to
   something visible in a browser; risks specifying-by-implementing.
3. **World first instead** — run 1's output (`RESEARCH_PHASE_2_WORLD.md`) is equally ready and has its
   own decisions locked (10, 11). The character work and the world work are **independent**; nothing
   forces character to go first.

**Whichever is chosen, two things carry into it as hard requirements, not suggestions:** the **8
draw calls both passes** of decision 14 (a rig built object-by-object silently stays at 14 and wastes
the whole gain), and **decision 17's ORG-6 precision test as soon as any rigged mesh exists.**

**Nothing is half-finished.** Everything is committed and **pushed** — `origin/feat/3d-open-world` is
in sync as of this session. Phase 1 is untouched and still complete, verified and merge-ready.

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

### Cost log — session 7

| Agent | Tokens |
|---|---|
| Research — Phase 2 character, run 2 (Sonnet) | 215,614 |
| **Session 7 total** | **~215,614** |

Cross-session observable total: **~1,979,000.** Everything else — the spot-checks, the state
updates, the push — was inline orchestrator work.

**Past the 400k prep-to-pause mark? No — this session is at ~216k.** Report raw subagent token counts
only, never a percentage of a ceiling, and **never attempt to look up account usage.**

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

# Pipeline State — Resume Checkpoint

**Last updated:** 2026-07-31 (session 4 — Phase 1 complete and verified; paused by the user)
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
| Overview | Sonnet | not started | `KNOWLEDGE_BASE.md`, wireframe |

Total planning corpus: **4,132 lines across 7 documents.** Plus **6,691 lines of code.**

---

## >>> RESUME HERE — session 5 <<<

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
2. **Open the PR against `dev`.** Phase 1 is complete and has never been landed.
3. **The Overview agent** — the last pipeline stage, never run. Worth doing before Phase 2
   research, which otherwise has to read fourteen documents.
4. **The envMap**, only if the user wants the distant towers fixed.
5. **Phase 2 research**, then the trademark naming table.

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

### OPEN FINDING — body pitch ignores horizontal speed

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

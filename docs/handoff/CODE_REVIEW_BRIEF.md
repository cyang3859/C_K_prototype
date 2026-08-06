# Code Review Brief — the 3D build, before merge and before QA

**Written:** 2026-08-01, session 10, by the orchestrator, for session 11 to run cold.
**Status:** NOT YET RUN. This is the first item of session 11.

---

## 0. Why this stage exists at all — read this first

**This is a NEW pipeline stage, not a re-run of an existing one.** The pipeline's `Review` agent is a
**design-spec gate**: its charter is explicitly *"budget and feasibility ONLY, it gets no vote on
taste"*, and it reads specs *before* the Engineer builds. **It has never read code and is not shaped
to.** Do not brief it for this and do not reuse `REVIEW_*` documents as a template.

**The gap this fills, stated precisely.** Everything verified so far is **output**: draw calls, GPU
frame time, screenshots, test counts, browser spot-checks. **Nobody has read the code critically.**
A scene that renders at 78 draw calls says nothing about whether the code producing it is sound.

**Roughly 4,000 lines have never been examined by anything but their own author.**

⚠️ **Independence caveat, and it is the reason this brief exists in writing.** The orchestrator
commissioned this code, spot-checked it, and would otherwise be briefing its reviewer — same model
family, same documents, same framing. That is weak independence, not real independence. **This review
informs the merge decision. It does not close it.** The merge stays the user's per locked decision 4.

---

## 1. What to review

**Target the range `main...HEAD`**, not `dev...HEAD`.

`main` is this branch's true fork point (`5f62309`). `origin/dev` happens to be at the same commit
today, so both currently give the same answer — but `main` is the one that stays correct if `dev`
moves. **Against `main` the diff is 74 files, +29,101, −0: pure addition.**

⚠️ **`git fetch` before computing any merge-base.** A stale local `dev` ref produced a confident,
completely wrong finding in session 10 — a claimed 4,100-line change to `kodaman_prototype.html` that
does not exist. Verify refs against `origin/*`, not local branches.

### Read these, in this order

1. **`KNOWLEDGE_BASE.md`** (705 lines) — refreshed 2026-08-01 and current. Module wireframe, app
   lifecycle, settled decisions 1–24, the `WEBGL_multi_draw` note, §9's working practices. **Best
   single orientation document; start here.**
2. **`PIPELINE_STATE.md`** — the **locked-decisions table only** (now 1–27). ~1,600 lines; do not read
   end to end. Decisions 22, 23, 24, 25, 26 and 27 are enforced in code and a violation is a real
   finding.
3. **`ENGINEER_PHASE_2_DISTRICTS.md`** and **`ENGINEER_PHASE_2_RUN2.md`** — what the two Engineer runs
   built and what they already know is imperfect. **Read these before reporting anything as new**;
   several known limitations are documented deliberately and re-reporting them is noise.
4. The code.

---

## 2. Where the risk actually is

Ordered by how likely a real defect is, based on what is newest and least examined.

| # | Area | Why it is the top of this list |
|---|---|---|
| 1 | **`Collision.js` — the terrain step-up and `removeOwner`** | Written **last**, by the orchestrator, in the final hour of session 10. Least-reviewed code in the repo. Three parallel arrays (`buildings` / `_owners` / `_solid`) must stay index-aligned through `addBuilding`, `removeOwner`, `clearBuildings` and `_rebuildBoxes` — a classic desync source. Check whether `_rebuildBoxes` and `removeOwner` can ever disagree, and whether the `solid:false` path leaks a box into `boxes`. |
| 2 | **The terrain step-up allowance itself** | `DEFAULT_MAX_TERRAIN_STEP` (0.5 m) applies only when `gy > 0`. Is that the right discriminator? What happens where terrain height is exactly 0 at the hill rim, or if a future height field returns a small negative? Does the allowance interact with `snapTolerance` in a way that lets a fast descent skip the surface? |
| 3 | **`districts.js` — the boundary connector (decision 27)** | Orchestrator-authored geometry data. The abutment arithmetic (`-DISTRICT_HALF - HALF_ROADWAY`, `STREET_LINES[0] + HALF_ROADWAY`) is asserted by tests, but check the sidewalk/curb strips the connector generates for overlap with District B's own — the tests pin the **roadway** quads, not the walks. |
| 4 | **`District.js` / `WorldProps.js` / `terrain.js` dispose paths** | HMR re-evaluates modules on every save; this project has an explicit disposal discipline. Verify every `dispose()` frees what it allocated, that `removeOwner` is called exactly once per owner, and that merged geometries and their materials are both released. |
| 5 | **`props.js` — determinism and placement** | ~1,400 instances placed by hash. Determinism is asserted; **keep-out correctness across the 36° frame is the subtler property.** Also check `allPropPlacements`'s merge loop for accidental aliasing between district sets. |
| 6 | **`facadeFamilies.js` — decision 22 enforcement** | The shipped Phase 1 constants must be byte-identical. A test asserts it. **Verify the test actually covers what the decision says**, rather than a weaker property. |
| 7 | **`annex.js` / `districts.js` — decision 24's coordinate preservation** | The absorption claims every annex world coordinate is preserved bit for bit via a pure −320 translation. Check the claim holds for colliders and props, not only buildings. |

---

## 3. What is ALREADY verified — do not spend budget re-deriving it

All of the following were measured in a browser by the orchestrator this session and are not open
questions:

- **78 draw calls (44 main / 34 shadow)** against the 150 ceiling, graph-walked and confirmed twice.
- **GPU frame time 0.5 ms median / 0.9 ms p95.** `WEBGL_multi_draw` present.
- **177/177 tests.** `kodaman_prototype.html` zero diff, and it is absent from the PR's file list.
- The helipad, both districts, the props and the boulevard join were **looked at in screenshots**, not
  merely counted.

**Report a finding only if the code is wrong, not if a number is unfamiliar.** If the code contradicts
a document, **the code wins and say so** — that has happened five times in this pipeline and each time
the agent was right.

---

## 4. Out of scope

- **Taste and art direction.** Whether the world looks good is the user's call and Design's remit.
- **The draw-call budget.** Measured, reconciled, and closed.
- **`kodaman_prototype.html`.** 16,507 lines, never edited, zero diff. **Never read it in bulk** — it
  has killed agent budgets. Targeted `grep` only, and you almost certainly do not need it.
- **Known, documented limitations**: no CSM (districts cast no shadows), fog at 120–900 m (reserved to
  locked decision 11's world-edge fade), District A's circumscribed OBB-less colliders, no parapet
  colliders on District A, grade relief unbuilt. All deliberate; see the Engineer reports.
- **Security review.** No auth, no network, no user input beyond keyboard. Low value here.

---

## 5. How to run it

**Preferred: `/code-review ultra`** — the multi-agent cloud review. ⚠️ **The user must trigger this;
the assistant cannot launch it.** Strongest option available.

**Alternative: `/code-review`** — runs Standards and Spec reviews in parallel; the assistant can
invoke this one. Point it at `main...HEAD`.

**If a bespoke agent is briefed instead**, the standing pipeline rules apply: **no subagent fanout**
(an agent here once spawned four children unprompted and burned a session), and **write findings
incrementally** (three agents have been killed mid-task; only persisted work survived). Note the
`/code-review` skill's own parallel sub-agents are its documented design and are not what that rule
prohibits.

### ~~One thing needs a user decision before spawning~~ — ANSWERED 2026-08-02, session 11

**Vehicle: `/code-review ultra`, triggered by the user.** Asked and answered at the top of session 11.
**Model: Opus.** The standing rule is *all agents Sonnet except the Engineer, which runs Opus*; this
stage did not exist when that rule was set, and the user took the orchestrator's recommendation —
4,000 lines of subtle geometry, collision and disposal code is closer to the Engineer's kind of work
than to a document review. **The standing rule is not changed; this is a named exception, like the
one-time Opus resume of the LA worldbuilding agent.**

Base verified green immediately before launch: **177/177 tests**, 0 unpushed commits, `main` untouched.

---

## 6. Deliverable

`docs/handoff/CODE_REVIEW_FINDINGS.md`, findings ranked most-severe first, each with a concrete
failure scenario — inputs or state → wrong output. **A finding without a failure scenario is a
suggestion, and this project has enough of those.** Separate confirmed defects from suspicions and say
which is which.

Then: fix what it finds, the user reads the diff, merge, and QA on the merged base.

# Pipeline State — Resume Checkpoint

**Last updated:** 2026-07-30
**Branch:** `feat/3d-open-world` (based on `origin/dev` @ `5f62309`)
**Purpose:** If a session ends abruptly, read this file first. It is the single source of
truth for where the 3D migration pipeline stopped and what to do next.

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
| Review — engineer brief | Sonnet | **NOT WRITTEN — resume here** | `ENGINEER_BRIEF.md` |
| Review — summary | Sonnet | **not written** | `REVIEW_SUMMARY.md` |
| Engineer | **Opus** | not started | `kodaman3d/` vertical slice |
| QA | Sonnet | not started | `QA_REPORT.md` or PR |
| Overview | Sonnet | not started | `KNOWLEDGE_BASE.md`, wireframe |

Total research + planning corpus on disk: **3,215 lines across 6 documents.**

---

## >>> RESUME HERE <<<

The Review agent was stopped mid-task, immediately after finishing `IMPLEMENTATION_PLAN.md`
and just as it began `ENGINEER_BRIEF.md`. Nothing was lost — it wrote incrementally.

**Next action:** spawn a **Sonnet** agent to write `docs/handoff/ENGINEER_BRIEF.md`. Do NOT
resume the old agent from its transcript — replaying that context is expensive (a comparable
resume cost ~138k tokens). A fresh agent is cheaper because every input it needs is already
committed to disk.

That brief must be the single, self-contained, ambiguity-free Phase 1 build order: exact
pinned dependencies, exact file list with per-module responsibility, data structures, game
loop shape, camera math, input mapping (WASD move, W-tap flight toggle, Q persona toggle,
J/K/L abilities, Shift dash), the resolved WebGL renderer decision, and precise acceptance
criteria. It must fold in the F7 damping correction below. The Engineer should never need a
second document.

Then, in order: **Engineer (Opus)** builds the slice -> **QA (Sonnet)** tests -> **Overview
(Sonnet)** assembles the knowledge base.

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

The first Opus research agent's spend before it died is not reported. There is **no tool that
exposes the user's account usage percentage** — only per-agent subagent token counts. Do not
promise usage-threshold alerts that cannot be measured.

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

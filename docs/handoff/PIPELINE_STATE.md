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

| Stage | Model | Status | Output |
|---|---|---|---|
| Research — Phase 1 spec | Opus | **done** | `PHASE_1_SPEC.md` (511 lines, committed `3d6218b`) |
| Research — LA worldbuilding | Opus | **in progress** | `RESEARCH_LA_WORLDBUILDING.md` |
| Research — findings + plan | Sonnet | **not started** | `RESEARCH_FINDINGS.md`, `IMPLEMENTATION_PLAN.md`, `RESEARCH_SUMMARY.md` |
| Review | Sonnet | not started | `REVIEW_HANDOFF.md` |
| Engineer | **Opus** | not started | `kodaman3d/` vertical slice |
| QA | Sonnet | not started | `QA_REPORT.md` or PR |
| Overview | Sonnet | not started | `KNOWLEDGE_BASE.md`, wireframe |

---

## What happened so far

1. Verified the real state of the codebase. `KODAMAN_HANDOFF.md` is **stale** — it claims
   ~5,200 lines; the actual file is **16,507 lines / 896 KB**, 100% 2D canvas, no dependencies.
   Trust the code over that doc.
2. Branch was initially cut from a stale local `dev` (34 commits behind `origin/dev`).
   Fast-forwarded to `origin/dev`. The first research agent read the stale file for part of its
   run and was sent a correction mid-flight.
3. First research agent completed `PHASE_1_SPEC.md`, then **terminated on a session token
   limit** while writing the implementation plan.
4. Its LA worldbuilding child agent completed substantial research but wrote **no files**;
   being resumed now solely to persist findings.

## Known gaps to close

- `PHASE_1_SPEC.md` references `RESEARCH_FINDINGS.md` §A7 (physics-engine comparison) — that
  file does not exist yet. Dangling reference.
- `IMPLEMENTATION_PLAN.md` is referenced as holding the Vite 7 vs 8 open question — also
  does not exist yet.
- No research yet written for Three.js architecture (section A), DC-inspired character design
  (section C), or practical constraints (section D). Only LA worldbuilding (B) is in flight.

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

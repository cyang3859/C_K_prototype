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

**Trademark exposure — unresolved, blocking public release.** The existing code uses literal
DC marks: scene names `wayne` and `arkham`, an enemy named "Lexcorp Warsuit", and characters
named "Lois" and "Power Girl". Harmless in a private prototype; not harmless in a public
GitHub repo, which is where delivery is headed. A rename mapping table (old -> proposed new)
is owed to the user for sign-off. **No agent should rename anything unilaterally.** The
character *designs* are already legally distinct; only the names are the problem.

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

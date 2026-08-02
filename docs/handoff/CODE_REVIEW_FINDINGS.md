# Code Review Findings — the 3D build, before merge

**Run:** 2026-08-02, session 11. **Target:** `main...HEAD` (`main` = `5f62309`), code only —
9,066 lines across 27 files under `kodaman3d/src` and `kodaman3d/tests`. The other ~20,000 lines
of the diff are the `docs/handoff/` planning corpus and were read as *sources*, not reviewed.

**Vehicle:** the repo's `/code-review` skill — two parallel sub-agents on **Opus**, one per axis
(user decision, recorded in `CODE_REVIEW_BRIEF.md` §5). Not `/code-review ultra`; the `ultra`
argument landed on the local skill.

**Full detail lives in the two axis reports** and is not duplicated here:
- `REVIEW_STANDARDS_AXIS.md` (415 lines) — 12 findings, 4 hard / 8 judgement
- `REVIEW_SPEC_AXIS.md` (331 lines) — 8 findings + scope-creep note + a clean list

**Cost:** 230,594 subagent tokens (101,176 Standards / 129,418 Spec).

---

## The headline, before the list

**Three of the most serious findings are tests that pass without proving what a locked decision
claims** — C1 (decision 22), C2 (decision 25), and S5 (decision 21's untested hash claim). In all
three the *code is correct*; the **enforcement is hollow**. That is precisely the failure mode
`KNOWLEDGE_BASE.md` §9 exists to warn about ("enforce decisions in code, not in prose"), showing up
in the very tests written to satisfy it. A test that restates a constant against itself is prose
wearing a test's clothes.

**The brief's predicted #1 risk came back clean.** `Collision.js`'s three parallel arrays
(`buildings` / `_owners` / `_solid`) could not be desynced by either agent; all four mutators stay
aligned. The worst defect is in `District.js`, which was not on the risk list at all.

**Both axes independently found the same stale header** (Standards 2 / Spec S3) from different
directions — one as a documented-standard breach, one as a spec-fidelity problem. Counted once.

---

## Ranked — what I intend to fix, most severe first

| # | Axis | Finding | Status |
|---|---|---|---|
| 1 | Spec C3 | Decision 27's connector lays a sidewalk + curb **across** the boulevard roadway | **fix** |
| 2 | Std 1 | Terrain height fields registered but never disposed — HMR leak | **fix** |
| 3 | Spec C1 | Decision 22's "byte-identical" test is a tautology | **fix** |
| 4 | Spec C2 | Decision 25's "only two names" test cannot see a third name | **fix** |
| 5 | Std 6 | `strictPort: false` under a comment saying "fail loudly" | **fix** |
| 6 | Std 3 | `dealBands` asserts coprimality in prose; false for many totals | **fix** |
| 7 | Std 2 / Spec S3 | `terrain.js`'s header asserts the opposite of its own code | **fix** |
| 8 | Spec S2 | Hero commits to the 3-group cape/accent reading decision 14 rejected | **fix** |
| 9 | Spec S5 | Annex prop placements have no test; decision 21's claim rests on nothing | **fix** |
| 10 | Spec S4 | `PLAYABLE_HALF_EXTENT` and `WORLD_HALF_EXTENT` are two unrelated 610s | **fix** |
| 11 | Std 7 | `surfaceIndex` is dead and now mis-indexes across the `boxes`/`buildings` split | **fix** |
| 12 | Std 8 | `hvacUnits()` called twice; colliders wrap a second generated list | **fix** |
| 13 | Std 9 | `frontage()` returns an undeclared dead `depth` | **fix** |
| 14 | Std 11 | `Terrain.dispose()` idiom drift; duplicate `this.collision =` | **fix** |
| 15 | Std 12 | Closure allocated per fixed step in the collision hot path | **fix** |
| 16 | Std — | `README.md` / `KNOWLEDGE_BASE.md` still document `world/StreetBlock.js` | **fix** |
| 17 | Spec S1 | District B's generated parapets have no colliders; the annex's do | **user** |
| 18 | Std 4, 5, 10 | Duplication in `districts.js` / `props.js` / `WorldProps.js` | **defer** |

**17 needs a decision, not a patch** — see below. **18 is real but is a refactor of ~200 lines of
working, tested, browser-verified code**; taking it now trades a measured-good world against churn
on the eve of a merge. Filed, not done.

---

## 1. C3 — the connector's sidewalk crosses the boulevard *(the worst finding)*

`District.js:233-241` builds the annex sidewalks and curbs over the **full unbroken span**, never
calling `segments()` — the exact rule stated 30 lines above at `:200-202`: *"a sidewalk slab laid
across a roadway is a slab in the street."* The grid's own strips break at intersections; the annex
strips do not, and the two annex strips **cross each other**.

Worked in District B local coordinates: the connector's west sidewalk lands at
x ∈ **[−165.24, −160.67]** across z ∈ **[−39.33, +39.33]**, which sits inside the boulevard roadway's
x-span and *contains* its full 21.34 m width. So a **4.57 × 21.34 m raised slab plus a 0.35 m curb
lie across the mouth of the T-junction**, rendered above the road at `SIDEWALK_RELIEF`.

**Consequence:** the junction decision 27 was built to open is floored as a kerb-and-pavement barrier
across the carriageway — close to the traversal dead end the decision existed to remove, plus a
pavement stripe across a road that is plainly visible from the air.

**Why no test caught it:** `districts.test.js:482-508` asserts the *declared spec numbers* only
(axis, line, from/to). It verifies the declaration and never the built geometry.

**Verified independently by the orchestrator** — the missing `segments()` call is real.

## 2. Standards 1 — terrain height fields leak

`Collision.js:538`'s `addTerrain` has no removal counterpart. `removeOwner` and `clearBuildings`
walk only the three building arrays and never touch `_terrain`, so `Terrain.dispose()` cannot undo
its own registration. Breaches `README.md`'s *"dispose what you allocate"* and `dispose.js:25-29`.
Under HMR — which re-evaluates modules on every save, and is the whole reason `removeOwner` exists —
each save appends another closure that `groundHeightAt` scans on **every capsule resolve, forever**.

## 3–4. C1 and C2 — two locked decisions whose tests prove nothing

**C1.** `districts.test.js:69-77` compares `FACADE_FAMILIES.fam1DarkCurtainWall` against
`FACADE_VARIANTS.towerShared` — but the family *is* `{...FACADE_VARIANTS.towerShared}`
(`facadeFamilies.js:34`). It proves the spread operator works. An agent nudging `towerShared` toward
glassiness inside `annex.js` changes both sides and the suite still passes — **the exact regression
decision 22 exists to stop**, named in the test's own comment. The Spec agent hand-diffed the values
against `05eb5df:StreetBlock.js`: **genuinely unchanged across all 52 lines.** The lock is not
broken; it is not locked.

**C2.** `districts.test.js:607-614` asserts `[MAST_SIGN_TEXT, HILL_NAME]` equals the two strings — a
verbatim restatement of the two preceding tests. The comment states the real invariant correctly
(*"an agent adding a third by inventing a shop name … should fail here"*) and then asserts something
else. A new `export const SHOP_NAME` in `props.js` passes untouched. It must scan the source tree.

## 5. Standards 6 — `strictPort: false` under a comment reading "fail loudly"

`vite.config.js:9`. The setting **is** the port-hopping behaviour, and is also Vite's default, so the
line is a no-op documenting its own reverse. This one bites *this project's own testing discipline*:
`CLAUDE.md` hard-codes port 5173 for every browser check, so a leftover dev server puts the new one
on 5174 and **an agent following `CLAUDE.md` drives the stale build believing it is the new one** —
silently. Verified by the orchestrator.

## 6–16. The rest

See the axis reports. 6 is a silent-corruption trap for any future third district (`dealBands`'s
stride is coprime for 32 and 36 only; totals of 10/30/33 leave `undefined` holes with no throw).
7 tells the next reader that grade relief is still mechanically blocked when the block was paid off
in `c09f9db` — it is the *reason of record* for a cut, which is why a stale comment matters here.
8 is latent: `Hero.js:102-112` ships three materials with the cape sharing `accent`, the precise
3-group reading decision 14 was amended to reject, leaving a 3-key shape for whoever merges the rig.

## 17. S1 — needs a decision, not a patch

Annex buildings get parapet collider bars; District B's *generated* buildings get HVAC colliders but
**no parapet colliders** — same district, same visual coping, different collision. The code matches
the letter of decision 26 (whose arithmetic accounts only for HVAC's +72). District B is cardinal, so
its parapet boxes would be exactly as correct as the annex's and cost only AABBs in a linear scan.
**As shipped, the ring stops the hero walking off one roof and not off the roof next door.**
Decision 26 did not consider this. **Your call.**

---

## What was checked and found clean

Worth recording so a later session does not re-derive it: `Collision.js`'s parallel-array alignment
(the predicted top risk); exact dependency pinning; no `TUNING` destructuring anywhere in `src/`;
`Collision.js`'s scene-graph purity; owner-scoped teardown in all three world modules; decisions
12, 13, 19, 20, 23, 26 and 27's *data*; decision 21's species split, whose "not the same tree twice"
test is a genuinely strong silhouette assertion rather than a label check; and every `[VITEST]`
Phase 1 acceptance criterion, all present as named test titles.

**Scope creep: one item, and it was the right call.** Height-field terrain collision is scoped *out*
by §PROP-3 and was built anyway in `c09f9db` — justified, because the stepped-box hill it replaced
had a real player-visible defect. Flagged for the record; note it is what made finding 7 stale, and
that nothing has re-derived §BGT-1 or the collider counts against it.

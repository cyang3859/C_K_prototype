# Engineer — Phase 2 Districts, run 1 of 2

**Written:** 2026-08-01, session 9. **Brief:** `ENGINEER_BRIEF_PHASE_2_DISTRICTS.md`.
**Spec built:** `DESIGN_SPEC_PHASE_2_DISTRICTS.md` §§1, 2, 4, 5, 6, DA-4, DB-4 (its own §10 priority
items 1–3). **Gate it passed:** `REVIEW_DESIGN_SPEC_PHASE_2_DISTRICTS.md`.
**Branch:** `feat/3d-open-world`. **Tests:** 108/108 → **147/147**.

**Status: A–E complete. Run 2's scope was not started.** Four things below need the orchestrator or
the user, and they are collected in §6 rather than scattered.

---

## 0. The headline numbers, measured

Every figure is a **both-pass total (main + shadow)** with the split shown, per the standing ruling.

| | Phase 1 | Phase 2 (this run) | Δ | Ceiling |
|---|---:|---:|---:|---:|
| **Worst-case draw calls, graph walk** | **57** (32 main / 25 shadow) | **83** (49 main / 34 shadow) | **+26** (+17 main / +9 shadow) | **150** |
| Measured `renderer.info.render.calls`, worst viewpoint | 53 | **81** | +28 | 150 |
| Triangles (graph, whole scene) | 11,324 | **14,724** | +3,400 | ~500,000 |
| Programs | 13 | 18 | +5 | — |
| Textures | 22 | 65 | +43 | — |
| GPU frame time, spawn (median / p95) | 0.3 / 0.4 ms | 0.4 / 1.4 ms | — | — |
| GPU frame time, whole world visible (median / p95) | — | **0.5 / 1.1 ms** | — | — |

**The +26 is not close to §BGT-1's three district lines. It is exactly them:**

| §BGT-1 line | Spec | Built | Main / shadow |
|---|---:|---:|---|
| Ground/road (§6) | 8 | **8** | 8 / 0 |
| Building facade families (§4) | 14 | **14** | 7 / 7 |
| District landmarks (§DA-4/§DB-4) | 4 | **4** | 2 / 2 |
| **Total** | **26** | **26** | **17 / 9** |

**Headroom to the 150 ceiling: 150 − 83 = 67 calls.** Not spent. See §6.1 for why this is 67 and not
§BGT-1's 81 — the difference is entirely that Phase 1's block still exists, which §BGT-1 does not
account for and which the brief told me to preserve.

---

## 1. Acceptance criteria, with evidence

### AC-1 — Two districts at the correct, different grid rotations — **PASS**

`src/world/districts.js`. District A is the dense tower plateau at `DISTRICT_A_ROTATION =
degToRad(36)`; District B is the mixed-height boulevard corridor at `DISTRICT_B_ROTATION = 0`, exactly
per locked decision 10. The rotation lives on a per-district `grid` `Group` (`District.js`), applied
once, so it is one transform rather than a yaw baked into 170 instance matrices.

Evidence beyond "the constant says 36": `tests/districts.test.js` builds the same transform with
`Object3D` and compares it against `localToWorld` at three points per district, because a sign error
mirrors a whole district and is invisible in a screenshot. Visually confirmed in the browser — the
two districts' street grids meet the eye at visibly different angles from the same camera.

### AC-2 — 7 facade families, shipped constants unchanged — **PASS**

`src/world/facadeFamilies.js`. Three for District A (FAM-1/2/3), four for District B (FAM-4/5/6/7).

Locked decision 22 is **enforced rather than promised**: FAM-1, FAM-4, FAM-6 and FAM-7 are spread
directly from `StreetBlock.FACADE_VARIANTS` (`{ ...FACADE_VARIANTS.towerShared }`), not re-typed, and
a test asserts byte-equality against the shipped objects. Nothing can drift them toward glassiness
without failing. FAM-5 is now a pure *addition* to `lowriseB` — see §3.1, this is where the spec was
wrong. Only FAM-2 and FAM-3 are new authoring, which §4 authorises explicitly.

### AC-3 — 5 massing recipes — **PASS**

`src/world/massing.js`, pure functions, no scene-graph dependency. MAS-1 (2 boxes), MAS-2 (4),
MAS-4 (2), MAS-5 (3) exactly as §5 specifies. **MAS-3 is 5 boxes / 60 triangles, not §5's 2–4 /
24–48** — locked decision 19 added a sculpted crown after the spec was written; the delta is
+12 triangles and is stated at the call site. Tests pin every stack to start at y = 0, finish at
exactly the stated height, and leave no vertical gap between boxes (a floating slab with daylight
under it is the defect a stacked-box recipe is most likely to produce and least likely to be spotted
from a street-level screenshot).

`TRIANGLES_PER_BOX = 12` is asserted against a real `BoxGeometry` index count rather than taken from
the spec's prose.

### AC-4 — Ground/road satisfies §6's district-merge, and the `BUD-2` explosion was measured away — **PASS**

`District._buildRoads()`. **4 meshes per district, 8 total, none casting.** Ground, roadway, sidewalk
and curb are each ONE merged `BufferGeometry` covering every street in the district.

The measurement, not the assertion: `tests/districts.test.js` checks the *merge* rather than the mesh
count, because a district with one street would pass a mesh count too. It asserts the roadway's
single geometry carries all `lines × (1 + lines + 1)` strips' triangles in one group, so adding a
street adds triangles and not draw calls. A test also proves **no centreline mesh exists anywhere** —
§6 folds the dashes into the roadway `CanvasTexture` at Phase 1's exact 2.4 m dash / 3.6 m gap
rhythm, which is the whole difference between §6's 8 and `BUD-6`'s ~10–16.

Against `BUD-2`'s trap: the naive pattern is 7 meshes × 64 tiles = **448 calls**. This is **8**, and it
does not move with district size or with any future chunk subdivision.

### AC-5 — Both landmarks exist — **PASS**

`src/world/landmarks.js`.

- **District A, decision 19:** a 150 m tower with a **sculpted, non-flat crown** — two progressively
  inset crown steps that are also *offset on X*, plus a spire carrying the tip to exactly 150 m. The
  asymmetry is deliberate: a concentric crown reads as a smaller box from every angle. Its roof
  region paints a **service deck, not a helipad**, because the crown stands on that surface; decision
  19 already accepted "one un-landable roof out of ~33".
- **District B, decision 20:** a 75 m **sign / observation mast** — tapered octagonal prism,
  observation collar, four sign panels. Not a building.

Both are standalone merged `Mesh`es with one material each, because `BatchedMesh` has no per-instance
material override. A test asserts they are `isMesh && !isBatchedMesh` with a non-array material, so
"its own mesh" really means 2 calls and not 2 per part.

**⚠️ The mast's sign reads the literal string `PLACEHOLDER`.** See §6.2.

### AC-6 — Measured draw calls with the split — **PASS**, see §0 and §2.

### AC-7 — GPU frame time — **PASS**

Median and p95 over 60 renders with a `gl.finish()` sync per render, first 10 discarded. Not fps:
headless Chrome pins rAF to 60 and the HUD is meaningless.

| Viewpoint | Calls | Triangles | Median | p95 |
|---|---:|---:|---:|---:|
| Spawn (Phase 1 block) — **baseline, before this run** | 53 | 11,276 | 0.3 ms | 0.4 ms |
| Spawn (Phase 1 block) — after | 56 | 11,292 | 0.4 ms | 1.4 ms |
| District A, from the air | 72 | 13,748 | 0.5 ms | 2.5 ms |
| District B, from the air | 43 | 9,152 | 0.4 ms | 4.3 ms |
| Whole world, shipped shadow camera | 74 | 14,724 | 0.6 ms | 2.0 ms |
| Whole world, **every caster forced into the shadow pass** | **81** | 16,272 | 0.5 ms | 1.1 ms |

GPU time is not a constraint here at any viewpoint — the worst median is 0.6 ms. The p95 spread is
noise on a headless software-ish GL path (the p95 does not track the call count: District B's 4.3 ms
p95 comes at the *lowest* call count in the table), so treat p95 as unreliable on this instrument and
the medians as sound.

### AC-8 — `npm test` passes with new coverage — **PASS**

**147/147.** 108 pre-existing (unchanged, none weakened) + 39 new: 36 in the new
`tests/districts.test.js`, 3 in `tests/world.test.js`'s draw-call section.

### AC-9 — `kodaman_prototype.html` zero diff — **PASS**. `git diff main...HEAD -- kodaman_prototype.html` is empty. Never opened.

### AC-10 — Repo clean — **PASS**. Screenshots moved to the scratchpad, `.playwright-mcp/` deleted, dev server stopped, `dist/` removed. `git status` shows only the pre-existing untracked `KODAMAN_HANDOFF.md`.

---

## 2. Two draw-call numbers, and which one to believe

**Use the graph walk (83). It is the number every budget figure in this project is quoted against.**

`renderer.info.render.calls` reports what was actually drawn last frame, so it moves with frustum
culling *and* with the shadow camera's own extent. Phase 1 is the precedent: the ledger says 57, the
browser reads 53 at spawn, and neither is wrong. The same gap appears here — 83 vs 81 at the most
demanding viewpoint I could construct.

**Why the browser cannot reach 83 without help.** `Sky.js` gives the sun a fixed **±60 m orthographic
shadow frustum around the origin**. That was correct at Phase 1's 300 m scale; in a 1,220 m world it
means **nothing in either district enters the shadow pass at all**. To get an honest both-pass
reading I widened the frustum to ±900 in the browser and re-measured: **81 calls**. That is the real
cost with every caster counted, and it is 2 short of the ledger only because two objects fall outside
even that camera's frustum.

**This is also a real visual finding, not just a measurement artefact:** the districts currently cast
no shadows. It is a *pre-existing* Phase 1 limitation that got bigger rather than something this run
introduced, and CSM — the fix — is explicitly out of this run's scope. Flagged in §6.3.

### The `BatchedMesh` A/B, because §BUD-3 deserved a measurement

With the whole world visible and every caster in the shadow pass, toggling the 7 `BatchedMesh`es
invisible and re-rendering:

| | Calls |
|---|---:|
| With the 7 batches | 81 |
| Without them | 68 |
| **Cost of all 68 buildings, both passes** | **13** |

68 buildings, 170 massing boxes, **13 draw calls** (14 minus one batch frustum-culled from one pass at
that viewpoint). One mesh per building would be 136; one mesh per box would be 340. `BUD-3` is
load-bearing and now it is measured.

### ⚠️ A silent 10× budget risk nobody had written down

`WebGLRenderer.js:1303–1319`: three.js draws a `BatchedMesh` with `WEBGL_multi_draw` when the
extension is present — **one** real GL call, `info.render.calls += 1` — and **otherwise falls back to
a per-geometry `for` loop of ordinary draws**, each of which increments the counter. Without the
extension, this build's 7 batches would report **~170 calls instead of 7** and blow the ceiling with
no code change at all.

**Measured: `WEBGL_multi_draw` is present in this project's browser.** It is widely supported on
desktop, so this is not a live defect — but it is an unstated dependency of the entire §BUD-3
strategy and it belongs in the knowledge base.

---

## 3. Where the spec was wrong, unbuildable, or contradicted by the code

Four items. Two are genuine spec defects; two are places the spec's arithmetic did not survive
contact with the geometry.

### 3.1 — FAM-5's terracotta went on every ROOF, not on the cornice *(spec defect, fixed)*

§4 specifies FAM-5 as a re-tint of `lowriseB`'s `band` from `0xb8a888` to terracotta `0xa85a3c`,
"carrying the Broadway Theater District cornice reference". Built exactly as written, and it gave
**every ochre building in District B a bright terracotta rooftop**, seen from the air — which is most
of how this game is played.

**`band` is not only the spandrel colour.** `scaleBoxUVs` collapses every flat roof face onto that
exact pixel — which is precisely why `StreetBlock.js` authors it as a roof neutral: *"real built-up
roofing and rooftop gravel is a neutral grey-brown whatever colour the wall below it is painted."*
The code said so; the spec did not read it that way.

**Fix:** the terracotta became its own `cornice` string course painted directly above the plinth band
(`facadeAtlas.makeFacadeMaterial`), repeating every `FACADE_TILE_M` metres up the facade the way a
real string course does. `band` keeps the shipped value. Same reference carried, same zero draw
calls, same single constant — and FAM-5 is now a pure *addition* to `lowriseB` rather than an
alteration of it, which is strictly better for decision 22 than what the spec asked for.

**This was caught by a browser screenshot, not by review or by a test.** A second test now
generalises it: no family's `band` may be a saturated colour, because `band` is also the roof.

### 3.2 — §DA-2's 22 × 32 m footprints do not fit the street grid they imply *(arithmetic, adjusted)*

§DA-2 gives District A's primary towers footprints of 18–24 × 24–32 m. On an S-470-1 grid — the same
30.48 m right-of-way Phase 1 uses, which is the only street section this project has — a 100 m block
leaves a 69.52 m buildable strip, i.e. **34.76 m per building slot**. A 32 m depth leaves 2.76 m
between neighbours across a lot line, and anything more crosses into the sidewalk.

**Built at 24–30 m depth** rather than 24–32, and a test asserts no footprint exceeds the slot span
in either district. The 32 m figure survives where it matters: the landmark takes the whole central
lot (its four slots), so it gets its full 22 × 32 m.

### 3.3 — MAS-3 costs 60 triangles, not 24–48 *(decision 19 postdates the spec)*

§5 priced MAS-3 for a **flat-topped** landmark. Decision 19 then chose a sculpted crown. The built
recipe is 5 boxes / 60 triangles against §5's 48. Decision 19 asked that the crown's triangles "fit
the §BGT-1 headroom rather than being assumed free" — **+12 triangles**, against a ~500,000 ceiling.
That is the number.

### 3.4 — §MAS-6's ~2,376 triangles assumed ~80 buildings; the grid holds 68

§MAS-6 used `BUD-3`'s inherited 30–50-per-district midpoint. The 3 × 3-cell grid at Phase 1's real
street section holds 36 slots per district; District A gives four of them to the landmark's full-lot
footprint. **68 batched buildings + 2 landmarks.** Still inside `BUD-3`'s band, at its lower edge.

Measured triangles, since the spec's were estimated:

| | Boxes | Triangles |
|---|---:|---:|
| District A batched (82 boxes) | 82 | 984 |
| District A landmark (MAS-3) | 5 | 60 |
| District B batched (88 boxes) | 88 | 1,056 |
| District B sign-mast | — | 112 |
| **Buildings + landmarks** | **175** | **2,212** |
| Ground/road, both districts | — | 1,188 |
| **Total added** | | **3,400** |

§MAS-6 predicted ~2,376 for the building population; the built figure is 2,212. Under estimate.

---

## 4. What was built, and where

| File | Lines | What |
|---|---:|---|
| `src/world/facadeAtlas.js` | new | The procedural-facade kit, **lifted out of `StreetBlock.js`** |
| `src/world/facadeFamilies.js` | new | §4's 7 families |
| `src/world/massing.js` | new | §5's 5 recipes, pure functions |
| `src/world/districts.js` | new | The two districts' data, grid arithmetic, placement maths |
| `src/world/District.js` | new | The builder: merged ground/road, family batches, colliders |
| `src/world/landmarks.js` | new | §DA-4's crowned tower, §DB-4's sign-mast |
| `src/world/StreetBlock.js` | edited | Kit extracted; `FACADE_VARIANTS` exported; behaviour unchanged |
| `src/core/Game.js` | edited | Builds both districts after the collision world |
| `src/config/tuning.js` | edited | `PLAYABLE_HALF_EXTENT` 150 → 610 |
| `tests/districts.test.js` | new | 36 tests |
| `tests/world.test.js` | edited | +3 tests; the Phase 1 ledger is untouched |

Five commits, each with tests green.

### The one judgment call the brief left me: generalise or sit beside

**I extracted `facadeAtlas.js` from `StreetBlock.js` rather than duplicating ~200 lines of canvas
painting.** The brief made this my call and asked me to say what I did and why.

The kit — `makeFacadeMaterial`, `paintFacadeRegion`, `paintWindowCell`, `scaleBoxUVs`, `atlasBoxUVs`
and the canvas utilities — was private to `StreetBlock.js` and correct there. Seven new families need
exactly it. Copying it would have meant two copies of the flipY convention, two copies of the bevel
draw order, and two places to fix the next flipY bug.

What protects Phase 1: the extraction changed no arithmetic, and `tests/world.test.js`'s canvas-call
assertions — "creates 18 canvases", the 15 plinth-band `fillRect`s, the helipad's
`save`/`scale(1, 0.17857)`/`fillText`/`restore` ordering, the two `arc` windings — are **untouched and
still pass**. `scaleBoxUVs`/`atlasBoxUVs` are re-exported from `StreetBlock.js` because they were part
of its public surface first. `StreetBlock`'s own behaviour, geometry and draw-call count are
byte-identical, confirmed by the unchanged 57-call ledger test and by a browser screenshot of the
Phase 1 block.

### World layout, and where 610 came from

Not picked — derived, and the first draft got it wrong.

A 300 m square yawed 36° has an **axis-aligned envelope of 300 × (cos 36° + sin 36°) = 419 m**, not
300. So District A needs ~60 m more room per side than District B, and **the two districts cannot be
placed symmetrically about the origin**. District A sits at world x = −400 (envelope x ∈ [−609.5,
−190.5]); District B, cardinal, at x = 320 (x ∈ [170, 470]); Phase 1's block keeps ±150. 610 is the
smallest square boundary containing all three, with ~40 m of open ground between each district and
the block.

The world stays **bounded** (decision 8). This moves the fence; it does not remove it. A test asserts
every building in both districts sits inside it.

Each district's ground plane is world-aligned (not in the rotated group) and sized to cover its whole
half of the world, sitting 1 cm below Phase 1's block ground so the two do not z-fight. That floors
the entire square for the same **one** mesh §6 already budgets — no extra call for the gaps.

### Collision: a documented approximation

`Collision.js` is axis-aligned by design and this run does not change it. District A's yawed buildings
are registered as the **circumscribed** world AABB of their rotated footprint — for a 22 × 32 m
footprint at 36° that is 36.6 × 38.8 m. The hero therefore stops a few metres short of some corners
and the camera arm pulls in slightly early there.

It errs **large**, which never lets the hero inside geometry — the safe direction. A test pins that
direction explicitly so a future "optimisation" to the inscribed box fails. Real OBB support is run
2's, not this run's.

---

## 5. What I did NOT build, deliberately

Everything in the brief's out-of-scope list, untouched: vegetation, rooftop HVAC/parapet rings on the
new districts, awnings, blade signs, streetlamps, small props, parked cars, utility poles, the
hill/terrain landmark, the cut-priority tier, CSM, the day/night cycle, world streaming, `Chunk.js`,
LOD, the world-edge fade, and anything touching the hero, rig or animation.

**A–E finished with budget left and I stopped, per the brief.** The 67 calls of headroom are not
spent.

Consequences worth naming for run 2:

- **The new districts have no rooftop parapet rings.** Phase 1's blocks do. So District A's flat roofs
  currently stop rather than reading as parapet-edged — visible from the air. It is §10 item 5, which
  is run 2's, and the mechanism already exists and is proven (`parapetBars`/`parapetBoxes` are pure,
  exported and tested); it wants ~2 calls per district.
- **The districts are un-vegetated.** §10 item 4 and decision 21 (Canary Island date palm for A,
  Mexican fan palm for B). Decision 21 also says Phase 1's *shipped* block changes species — that is a
  real change to what already renders and I did not make it.
- **`Chunk.js` does not exist and nothing here presumes its shape**, except that the district-shared
  batches it should be "a data window into" (`BUD-2`) now exist to be windowed into.

---

## 6. What needs a decision — not guessed

### 6.1 — §BGT-1's ~69 total does not account for Phase 1's block still existing

This is the one number I could not reconcile, and I do not think it is my call to resolve.

§BGT-1 rolls up the Phase 2 world at ~69 calls: hero 8, sky 0, ground/road 8, families 14, landmarks
4, props+terrain ~35. **It has no line for Phase 1's block** — its 21 street meshes, 10 buildings and
4 instanced items. The brief told me to preserve that block, so it is still there, and the built world
is 83 rather than 69.

Reading it the other way, the three lines this run actually covers came in at **exactly** their
budgeted 26, and the block's remaining 43 non-hero calls plausibly *are* §BGT-1's ~35 props line plus
change (the block carries palms, lamps, parapets, HVAC, awnings and blade signs, which is most of §8's
prop catalogue for one block).

Either way the ceiling is fine — **67 calls of headroom** against 150 — but the reconciliation matters
before run 2 spends the props line, or it will be double-counted. **Suggested resolution: treat the
Phase 1 block as consuming part of §8's prop budget rather than as a separate line, and re-baseline
§BGT-1 at 83 for the built world.** Not applied; the orchestrator owns the budget document.

### 6.2 — The mast's name and signage text (locked decisions 6 and 20)

The sign panels carry the literal string **`PLACEHOLDER`**. Chosen so it cannot be mistaken for a
proposal — a plausible-looking placeholder is how an un-approved name ships. Decision 20 reserves the
mast's name, signage text and specific art to the user. Nothing here proposes any of them, and the
code comment says so at the point where a future agent would be tempted.

### 6.3 — The districts cast no shadows, and the fix is out of this run's scope

`Sky.js` uses a fixed **±60 m** orthographic shadow frustum centred on the origin. Correct at Phase
1's 300 m scale; in a 1,220 m world it excludes both districts entirely. CSM is the fix, is Phase 2
work, and was explicitly out of this run's scope — so I measured around it (§2) rather than widening
it, because a wider single cascade trades all shadow resolution for coverage and would visibly
degrade the Phase 1 block that a human has signed off five times.

**This is the concrete case for CSM.** It also means the 81-call figure is what CSM's *baseline* both-pass
cost looks like before cascades multiply the shadow pass — which is precisely the unmeasured
multiplier the 67-call headroom exists to absorb.

### 6.4 — The fog range is now much too tight for the world, and it collides with decision 11

`Sky.js` sets `Fog(hazeColor, 120, 900)` and its own comment calls these *"a fixed Phase 1
placeholder, not researched"*. The world's corner-to-corner sightline is now **1,725 m**, and
`Fog` is linear: at 640 m the fog factor is `(640 − 120) / 780 = 0.67`, and anything past 900 m is
fully saturated. Measured consequence: from a high camera over the origin both districts are washed
to near-invisibility, though each district reads correctly from within and from ~400 m.

**I did not change it, deliberately.** Locked decision 11 makes exactly this `Fog` object the
mechanism for the world-edge fade, and re-ranging it now would pre-empt a design that belongs to
another run. But somebody should own it: as shipped, a hero flying between districts loses sight of
the destination for most of the trip.

---

## 7. What I could not verify, and what needs a human eye

Everything measurable was measured. Two things genuinely need a person:

1. **Whether the 36° rotation contrast reads as two different places** rather than as one city with a
   crooked bit. I can prove the rotation is applied and show it in a screenshot; I cannot judge
   whether it achieves what decision 10 wants it to achieve. This is the criterion the whole pairing
   exists for.
2. **Whether the 150 m crowned landmark and the 75 m mast read at this world's scale** — the spec's
   own §11 item 5 flagged this as unanswerable without a browser, and it is a feel question a
   measurement cannot close.

Both are for a `BROWSER_SPOT_CHECK_6.md` if the orchestrator wants one; I have not written it, because
everything else on such a checklist is already a number in this document.

---

*End of Phase 2 Districts Engineer report, run 1 of 2.*

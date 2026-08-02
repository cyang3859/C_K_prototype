# Engineer — Phase 2 Districts, run 2 of 2

**Written:** 2026-08-01, session 10. **Brief:** `ENGINEER_BRIEF_PHASE_2_RUN2.md`.
**Built:** locked decision 24 (the absorption), then `DESIGN_SPEC_PHASE_2_DISTRICTS.md` §10 priority
items 4–10. **Branch:** `feat/3d-open-world`. **Tests:** 148/148 → **169/169**.

**Status: work items 1–8 complete. Nothing in the brief's scope was cut** — §10 items 4 through 10
are all built, including the two the brief named as first cut candidates. One *half* of one item was
cut and §5.4 says why. Three commits, tests green at each.

---

## 0. The headline numbers, measured

Every figure is a **both-pass total (main + shadow)** with the split shown, per the standing ruling.

| | Run 1 | After the absorption | **After the props** | Ceiling |
|---|---:|---:|---:|---:|
| **Worst-case draw calls, graph walk** | **83** (49 / 34) | **58** (33 / 25) | **78** (44 / 34) | **150** |
| Measured `renderer.info.render.calls`, worst viewpoint | 81 | — | **77** | 150 |
| Triangles, whole scene (graph walk, instances expanded) | 14,724 | ~15,000 | **99,070** | ~500,000 |
| Programs | 18 | — | **25** | — |
| Textures | 65 | — | **57** | — |
| GPU frame time, spawn (median / p95) | 0.4 / 1.4 ms | — | **0.5 / 0.9 ms** | — |
| GPU frame time, whole world (median / p95) | 0.5 / 1.1 ms | — | **0.6 / 0.9 ms** | — |

**Headroom to the 150 ceiling: 72 calls.** Not spent. It exists for CSM.

The triangle jump (14,724 → 99,070) is entirely instanced vegetation and street furniture — 1,376
prop instances plus the hill's 6,272-triangle landform — against a ~500,000 ceiling (`BUD-7`).
Triangles were never the binding constraint and still are not.

---

## 1. Work item 1 — the absorption, and its delta measured on its own

**Locked decision 24 is done: `StreetBlock` no longer exists.** `src/world/StreetBlock.js` is gone;
`src/world/annex.js` holds its authored data and its pure functions, and District B builds all of it.

### 1.1 What I did, and why this shape

**The annex is a hand-authored sub-area of District B that did not move one metre in world space.**

That is the whole design decision, and it is available only because of locked decision 10: District B
is the **cardinal** district. Its grid group sits at world x = 320 with rotation 0, so Phase 1's block
at the world origin is a **pure translation of −320 on X inside it** — no rotation, no re-placement, no
re-derivation of any coordinate. The hero still spawns at `(0, 0, 13)`. The helipad tower still stands
at `(−2, 31)`. Five browser passes of human sign-off attach to those numbers and none of them were
re-litigated by what is fundamentally a bookkeeping change.

The alternative I considered and rejected was re-slotting the ten buildings into District B's 3 × 3
grid. It would have been a *visual redesign* of reviewed content — new positions, new neighbours, new
massing under §5's recipes — which decision 24 did not ask for and no browser pass has approved.

Concretely, per category:

| Phase 1 owned | Now | Cost |
|---|---|---|
| Its own ground plane | District B's ground was extended west to x = −150; District A's shortened to meet it | −1 main |
| Roadway, 2 sidewalks, 2 curbs | Strips appended to District B's three merged §6 surfaces | −5 main |
| Instanced centreline (a whole mesh) | Painted into District B's shared roadway texture, at Phase 1's exact 2.4 m dash / 3.6 m gap | −1 main |
| 10 building meshes | 9 joined District B's facade `BatchedMesh`es; the 10th is the helipad tower and cannot be batched | −9 main / −9 shadow |
| — | District B gains a FAM-1 batch so the 64 m tower keeps its shipped `towerShared` palette | +1 main / +1 shadow |
| 8 instanced prop pools | 7 world-shared pools in `WorldProps.js` (§8's lamp post/head merge removes the eighth) | −1 main / −1 shadow |

**Where the ground seam went, and why it moved.** Before the absorption the two district ground planes
met at x = 0, and Phase 1's own block ground covered ±150 and hid the join. With that ground gone the
seam would have run straight down the middle of the boulevard. District B's ground now runs to
x = −150 — the annex's own edge — and District A's stops there. District B's ground colour is
`0x9a927f`, **byte-identical to the colour the annex's own ground used**, so nothing under the
boulevard changed shade.

### 1.2 The delta, measured before a single prop was added

This is the number the brief asked for and nobody had.

| | Main | Shadow | Total |
|---|---:|---:|---:|
| Phase 1's block, as a standalone area | 25 | 18 | **43** |
| What survives it after the absorption | 9 | 9 | **18** |
| **Delta** | **−16** | **−9** | **−25** |

World total, graph walk: **83 (49 / 34) → 58 (33 / 25)**, measured at commit `453c21b` with
`WorldProps` carrying only the annex's own props and no district props built. `tests/world.test.js`
pins the 44-call pre-props world so this stays checkable.

**The 18 that survives is exactly two things that genuinely cannot merge**, and both are named in the
code:

1. **The 90 m helipad tower's own `Mesh`** (2 calls). Its non-repeating roof atlas needs its own
   material and `BatchedMesh` has no per-instance material override. It cost 2 calls as a Phase 1
   mesh and it costs 2 now.
2. **District B's FAM-1 batch** (2 calls). The annex's *other* tower, the 64 m one, is painted in the
   shipped `towerShared` palette. Repainting it in one of District B's own four families would have
   been free — and would have changed how reviewed content looks in order to make a ledger tidier. I
   paid the 2 calls. The batch is shared with any future District B tower, so it is not a special
   case for one building.

Plus the 7 prop pools (14 calls), which are not *absorption* cost — they are the props line, and they
existed before the absorption too.

### 1.3 Nothing the brief said must not be lost, was lost

| Brief §2 requirement | Evidence |
|---|---|
| **The hero spawn** — sidewalk, clear of footprints, not inside a building | Unchanged at `(0, 0, 13)`. `world.test.js` "spawns the hero on the sidewalk, clear of every building footprint" builds the whole world and asserts the capsule radius clears **every registered collider**, then asserts the point is outside the roadway and inside the sidewalk. Not a comment — a test over the real collider list. |
| **The 90 m helipad tower**, roof art and 4-bar parapet ring | Screenshot below. `District._buildBespokeBuildings` builds it, `annex.makeBespokeTowerMaterial` paints it, and the three canvas-recording tests (aspect compensation, `save`/`scale`/`fillText`/`restore` order, the two arc windings) are **unchanged and still pass**. |
| **Collider registrations**, incl. the parapet's boxes | `WorldProps` registers all 4 bars per annex building and all 22 rooftop units; `world.test.js` looks up **every bar of every building** by coordinate. Total 206 colliders in the built world. |
| **`Game.js`'s create-collision-before-world ordering** | Preserved and generalised: the `CollisionWorld` is created before the districts, `WorldProps` and `Terrain`, all of which register into it as they build. The comment in `Game.init()` says so. |

### 1.4 The helipad, in a browser

Camera at (14, 118, 66) looking at the roof. The yellow FATO ring and the white "H" read clearly, the
four-bar coping ring is visible as a raised light edge around the roof, and the three rooftop units
sit in the corner clear of the marking — exactly as they did before the move.

*(Screenshots are in the session scratchpad, not committed: `helipad.png`, `annex-aerial3.png`,
`dA-aerial.png`, `dA-roof.png`, `dB-aerial.png`, `scaffold2.png`, `hill2.png`.)*

---

## 2. Every test I changed or removed, categorised

The brief asks for this list explicitly, with each entry in one of two categories:

- **(A)** encoded *"the Phase 1 block exists as a standalone area"* — the assumption decision 24
  retires. These may legitimately change.
- **(B)** encodes something that must remain true wherever the content lives. These had to survive,
  re-pointed rather than deleted.

**No test in category B was deleted.**

### `tests/world.test.js`

| Test | Cat. | What happened |
|---|---|---|
| Module import block | — | Re-pointed `StreetBlock.js` → `annex.js`, `BLOCK` → `ANNEX`. Mechanical. |
| `const TOWER = BLOCK.buildings[2]` | B | Now `ANNEX.buildings[BESPOKE_TOWER_INDEX]` — same building, named rather than indexed. |
| `G1 parapet collider` — all **7** tests | B | **Unchanged** but for the constant's name. Ring-not-slab, corner closure, criterion-20 landing, ring-is-inert, no sideways shove, coping stops a walk-off, and the pinned known coping-ejection behaviour. |
| `G2 rooftop unit placement` — all **4** tests | B | **Unchanged** but for `BLOCK` → `ANNEX`. Counts, determinism, coping containment, helipad clearance. |
| `atlasBoxUVs` — all **3** tests | B | **Unchanged.** |
| `paints the plinth band at the BOTTOM of each repeat tile` | B | **Kept**, re-pointed at District B's canvases. Expectation is still 15 fills (5 families × 3 maps, where it was 5 Phase 1 variants × 3 maps). |
| `draws the helipad inside the aspect compensation` | B | **Kept verbatim.** |
| `draws the helipad ring and glyph inside a save/restore pair` | B | **Kept verbatim.** |
| `registers a structural box AND four parapet bars for every building` | B | **Kept**, re-pointed at `District` + `WorldProps`. The per-bar coordinate lookup is unchanged; only the collider TOTAL changed, and that part was (A). |
| `creates 18 canvases` | A | → `creates 22 canvases`. 18 was `StreetBlock`'s own canvas count; the number is now District B's (5 families + bespoke atlas + landmark, × 3 maps, + 1 road). |
| `disposes cleanly and drops every collider` | A | → `disposes cleanly and drops every prop pool`, re-pointed at `WorldProps`. See §6.5 — it no longer asserts the collision world empties, and that is a real behaviour change I am flagging rather than hiding. |
| `worst-case draw calls: is 57 …` | A | **Replaced.** 57 was the standalone block's ledger. Its two real invariants survive: *the ground and road surfaces do not cast* is re-asserted per district in the new ledger, and *the centreline does not cast* is superseded by `districts.test.js`'s stronger "there is no centreline MESH anywhere". |
| `the four new instanced items cost exactly 8 of those calls` | A | **Replaced** by `the 17 world-shared prop pools cost exactly 32 of those calls`, which asserts the same property (one pool = one main + one shadow) over a superset. |
| `Phase 2 worst-case draw calls` — **3** tests (83 total / districts cost 26 / 68 buildings cost 7) | A | **Replaced** by six tests: the 78-call world ledger, the 44-call pre-props world, the annex's 4-call residue, the 32-call pool line, every-pool-non-empty, and 78 buildings in 8 batches. |
| `sky environment map` — **3** tests | B | **Unchanged**; one title reworded off "the 57-call budget". |
| **NEW** `the annex, absorbed into District B` — 5 tests | — | The standalone module is gone; annex buildings land at exact Phase 1 world coordinates; annex massing stays `mas0`; exactly one building is bespoke; the hero spawns clear. |
| **NEW** `District B with its annex, built` — 2 tests | — | The helipad tower is its own non-batched `Mesh` at Phase 1's world position; every rooftop unit has a collider. |
| **NEW** `the hill (§PROP-3)` — 5 tests | — | See §5.4. |

### `tests/districts.test.js`

| Test | Cat. | What happened |
|---|---|---|
| `import { FACADE_VARIANTS } from 'StreetBlock.js'` | — | Re-pointed to `annex.js`. Mechanical. |
| `is exactly seven: three for A, four for B` | A | → `…five batches in District B`. Seven families is unchanged; District B draws on five because decision 24 gave it FAM-1. **The decision-22 byte-equality test on the next line is untouched.** |
| `§4: one BatchedMesh per facade family` | A | `districts[1].batches.size` 4 → 5, same cause. |
| `BUD-2: the road mesh count does not move with the number of streets` | A | Extended: the expected quad count now includes the annex's boulevard strip, which lands in the **same** merged geometry. The merge property it exists to test is unchanged and still asserted. |
| **NEW** `prop placement (§8)` — 7 tests | — | Species split per decision 21; the two palms are measurably different trees; nothing planted inside a footprint (checked in each district's own frame, where even the yawed grid is exact); props carry the 36° yaw; cars are on the roadway; nothing stands in a crossing; determinism. |

Everything else in `districts.test.js`, `collision.test.js` and `locomotion.test.js` is untouched.
**148 → 169 tests, none weakened.**

---

## 3. Work items 2–8 — what was built, and where

| # | §10 item | Built | Where |
|---|---|---|---|
| 2 | 4 — primary vegetation | ✅ Canary Island date palm (District A), Mexican fan palm (District B + annex) | `WorldProps._buildCanaryPalms` / `_buildMexicanPalms`, placement in `props.js` |
| 3 | 5 — rooftop HVAC + parapet ring | ✅ Extended over District A | `props.roofOf` + `WorldProps._buildParapets` / `_buildHvac` |
| 4 | 6 — awnings + blade signs | ✅ Extended over District B's corridor | `props.frontage` + `_buildAwnings` / `_buildBladeSigns` |
| 5 | 7 — streetlamps, small props, parked cars | ✅ All three | `_buildLamps`, `_buildSmallProps`, `_buildParkedCars` |
| 6 | 8 — broadleaf shade tree + utility poles | ✅ Both, District B | `_buildShadeTrees`, `_buildUtilityPoles` |
| 7 | 9 — hill/terrain landmark | ✅ Built. **Half of §PROP-3 cut — see §5.4** | `src/world/terrain.js` |
| 8 | 10 — cut tier (café → bollards → scaffolding) | ✅ All three | `_buildCafeProps`, `_buildBollards`, `_buildScaffolding` |

### 3.1 The architecture, in two files

- **`src/world/props.js`** — pure placement data. Street rows are generated in each district's **local**
  frame and transformed once through `districtLocalToWorld`, which carries the district's yaw into
  each prop's own rotation. That is what makes a lamp row on District A's 36° grid parallel to its
  street rather than crossing the facades at an angle, and it is the one thing in this run that a
  count could never have verified.
- **`src/world/WorldProps.js`** — the pools. **One pool per silhouette for the whole world**, so the
  pool COUNT is the entire draw-call cost: 4,000 instances cost what 40 do.

### 3.2 The keep-out, which is the guard that actually matters visually

Every candidate placement is rejected against its district's building footprints **and** against
intersections. The rejection runs in the district's **local** frame, where even the yawed grid is
axis-aligned — so it is **exact**, not the circumscribed approximation `buildingWorldBox` has to use
for collision. A test asserts no palm, tree, lamp or pole sits inside any footprint, in either
district.

### 3.3 One merged geometry, two colours, one draw call

`tintGeometry()` bakes a flat colour into a geometry's vertex-colour attribute, which is what lets a
multi-part prop keep its colours while costing one material. It is used by the streetlamp
(dark pole / light fitting), the shade tree (trunk / canopy), the utility pole (pole / crossarm), the
café table, the scaffold bay, and the parked cars — where it does something better than save a call:
the instance colour multiplies the vertex colour, so a body authored white takes the paint at full
strength while near-black tyres and dark glazing stay near-black whatever colour the car is.

### 3.4 The one `BatchedMesh`, deliberately

`BatchedMesh` falls back to one real draw call **per geometry** without `WEBGL_multi_draw`. Per the
brief, every pool that can be an `InstancedMesh` is one; the single batch that earns its place is the
sidewalk clutter (`LOD-3`'s multi-variant case: trash can, newspaper box, hydrant behind one
material). **The fallback's blast radius is therefore 3 calls instead of 1, not 192.** A test pins
that only one pool is batched.

---

## 4. The budget, reconciled

### 4.1 Against §BGT-1, which also settles run 1's §6.1

Run 1 could not reconcile its 83 against §BGT-1's ~69 and left it open. **The absorption resolves it**,
and the reconciliation is now exact:

| §BGT-1 line | Spec | **Built** | Difference |
|---|---:|---:|---|
| Hero | 8 | **14** | +6 — the hero is still Phase 1's un-rigged 7-mesh hero. Decision 14's 8 is for the **rigged** hero, which is the character half's work, not this run's. |
| Sky | 0 | **0** | — |
| Ground/road (§6) | 8 | **8** | Exact, and it now carries the annex's boulevard too |
| Building facade families (§4) | 14 | **16** | +2 — decision 24's FAM-1 batch in District B |
| District landmarks | 4 | **4** | Exact |
| *(new line)* the annex's bespoke helipad tower | — | **2** | +2 — decision 24; it cannot be batched |
| Instanced props + terrain (§8) | ~35 | **34** | Under estimate |
| **Total** | **~69** | **78** | **+9**, of which **+6 is the un-rigged hero** and **+4 is decision 24's two irreducible meshes** |

**Suggested re-baseline for the orchestrator: §BGT-1 is now correct within 4 calls for everything
this run owns.** The remaining +6 closes by itself when the character half lands decision 14's rigged
hero. There is no longer a double-counting risk: the Phase 1 block has no separate line because it has
no separate existence.

### 4.2 Against §PROP-4, the props line

| §PROP-4 line | Spec | Built |
|---|---:|---:|
| World-shared props | 8 | 12 (parapets, HVAC, awnings, blades, lamps, 2 car pools — all world-shared here) |
| District A exclusive | 9 | 6 (Canary palm ×2, bollards) |
| District B exclusive | 13 | 14 (fan palm ×2, shade tree, utility poles, small props, café, scaffolding) |
| Hill/terrain | ~5 | **2** |
| **Section total** | **~35** | **34** (18 main / 16 shadow) |

**Inside the estimate, and the hill came in at 2 where §PROP-3 carried `BUD-6`'s un-rederived 4–6.**
It is one displaced plane with one material; the vertex-colour ramp that dries the summit rides in
the geometry.

The per-district split differs from §8's tables in one place — see §6.1.

### 4.3 GPU frame time, measured

Median and p95 over 60 renders with a `gl.finish()` sync per render, first 10 discarded. **Not fps:**
headless Chrome pins rAF to 60 and the HUD is meaningless.

| Viewpoint | Calls | Triangles | Median | p95 |
|---|---:|---:|---:|---:|
| Spawn, annex boulevard | 54 | 145,490 | 0.5 ms | 0.9 ms |
| District A from the air | 65 | 161,006 | 0.5 ms | 0.7 ms |
| District B from the air | 60 | 168,118 | 0.4 ms | 0.6 ms |
| Whole world, shipped ±60 m shadow camera | 70 | 183,610 | 0.5 ms | 0.7 ms |
| Whole world, **every caster forced into the shadow pass** | **77** | 196,726 | **0.6 ms** | **0.9 ms** |

GPU time is not a constraint at any viewpoint. The p95 spread is much tighter than run 1's, which is
noise on this instrument rather than a real improvement — treat the medians as sound.

The measured 77 against the graph walk's 78 is the same 1-object gap run 1 saw: `info.render.calls`
moves with frustum culling and with the shadow camera's own extent. **Use the graph walk (78).**

`WEBGL_multi_draw` re-verified **present** in this browser. Every batched figure above is still
conditional on that.

---

## 5. Where the spec was wrong, unbuildable, or contradicted by the code

Five items. Two are doc-vs-code contradictions where the code wins; three are places the design did
not survive contact with the geometry.

### 5.1 §8 says awnings and blade signs do not cast shadows. The shipped code says they do. **The code wins.**

§8's District B table prices storefront awnings and blade signs at **1 call each**, citing
`ENGINEER_PHASE1_CLOSE.md` for *"confirmed no-shadow"*. `StreetBlock._buildAwnings` and
`_buildBladeSigns` both set `mesh.castShadow = true`.

Turning casting off would have been a **visible change to reviewed Phase 1 content made purely to
make a budget table's arithmetic come out right**. They cast; the real cost is 2 each, not 1. That is
+2 against §PROP-4 and the section still came in under. Recorded in `WorldProps._buildAwnings`.

### 5.2 §8 files rooftop HVAC and the parapet ring under "District A — exclusive prop pools". They are not exclusive.

District B's annex has carried both since Phase 1, and the silhouettes are identical between the
districts. Read literally, §8 would have meant **two parapet pools and two HVAC pools** — 8 calls for
what one pair of pools does. Made world-shared: **saves 4 calls**, and it is the same reasoning
§PROP-1 itself applies to streetlamps and parked cars. Stated in `props.js`'s header rather than done
quietly.

### 5.3 §PROP-2's "tower-plaza forecourts" needed a spacing decision the spec did not make

§PROP-2 gives District A the Canary Island date palm on the grounds that it *"reads as formal/estate,
not street"*, but does not say how it is planted. Mass-planting it at the boulevard's 12 m rhythm
would have thrown away the exact distinction the species split exists to buy. Built at **26 m plaza
spacing** against District B's 12 m, so the two districts differ in planting *rhythm* as well as in
species. That is my call; it is cheap to reverse.

### 5.4 §PROP-3's district grade relief is **unbuildable this run**, for a mechanical reason

§PROP-3 asks for two things: one deliberate hill (built) **and** *"gentle grade relief riding on the
existing ground subdivision"* across the districts, argued as close to free.

**It is free in triangles and not free in behaviour.** `Collision.js` models the ground as an implicit
flat plane at y = 0 with **no height query anywhere** — `resolveCapsule` has no terrain concept.
Displacing the district ground would put the hero's feet through every slope in the world. Grading the
districts needs a terrain height lookup inside the locomotion resolve path, which is a `Collision.js`
change and is not this run's.

**Cut, and the reason is mechanical rather than budgetary.** The named hill is built and is the part
that carries §PROP-3's actual argument (a third silhouette class, a third sightline anchor).

The hill's own collider is a documented approximation: a stack of terraces whose tops are **inscribed
under** the real surface. Note the direction is the **opposite** of the building rule — for buildings,
erring large keeps the hero outside geometry; for terrain, erring large would bury a landing hero
inside the hillside. A test pins the direction so a future "consistency" fix fails.

### 5.5 §MAS-3 aside: the annex needed a sixth recipe that is not a recipe

§5 has five recipes and every one of them stacks 2–5 boxes. The annex's ten buildings are single
boxes, which is what Phase 1 built and what a human reviewed. I added **`mas0`, one box**, and say
plainly in `massing.js` that it is not a §5 recipe — it is the shipped massing, kept so the absorption
is not a visual redesign. `DEN-1`'s "every building is one BoxGeometry" complaint is real and §5 is
the fix; it applies to the generated population, not retroactively to ten reviewed buildings.

---

## 6. Judgment calls the brief left me, stated

### 6.1 Parapet rings on District B's generated buildings: **not built**, following §10

§10 item 5 is *"Rooftop HVAC + parapet coping ring (§8, **District A**)"*. District B's generated
buildings therefore have none. This is defensible beyond "the spec said so": MAS-5's cornice cap
already overhangs the footprint and MAS-4 has a setback, so District B's roofs read as edged rather
than as boxes that stop. The annex's ten keep their rings.

If a human looks from the air and disagrees, it is a **zero-call change** — one flag in
`allPropPlacements`. Flagged in §8 as a possible user call.

### 6.2 Parapet colliders on District A: **deliberately not registered**

The visual rings are there. The colliders are not, and this is not an oversight.

`Collision.js` is axis-aligned. A 20 m parapet bar 0.6 m thick, yawed 36°, circumscribes to a
**16.5 × 12.2 m AABB** — a blob covering most of the roof it was supposed to edge. Registering them
would make District A's roofs unwalkable. Rooftop HVAC units *are* registered even on the rotated grid,
because a near-cubic 1.2 m box circumscribes to 1.66 m and the error is harmless.

The annex and District B (rotation 0) get exact parapet colliders, so the roof a human actually lands
on — the helipad tower — behaves exactly as before. Real OBB support in `Collision.js` is the fix.

### 6.3 The streetlamp merge loses one thing

§8 explicitly asks for the lamp post and head to be merged into one geometry, and it saves 2 calls at
world scale. One material where Phase 1 had two, so the colour difference moved to a vertex attribute
— free. **The one thing genuinely lost is the head's `emissive: 0x1a1c1f`**, which is (26, 28, 31)/255
under a static midday sun, below anything a screenshot can resolve. Recorded in `WorldProps`.

### 6.4 `lowriseB` → FAM-5 is the absorption's one real visual change

Four of District B's five families **are** the shipped Phase 1 variants, spread byte-identically under
decision 22, so `lowriseA → FAM-4`, `midriseA → FAM-6`, `midriseB → FAM-7` and `towerShared → FAM-1`
change nothing at all. The exception is `lowriseB → FAM-5`, which adds FAM-5's terracotta cornice
string course to the annex's two ochre lowrises. It is an *addition* to the shipped spec rather than
an alteration of it (decision 22 safe), and it is what makes the annex read as part of District B's
storefront corridor instead of as a transplant. Say the word and it maps to FAM-4 instead.

### 6.5 Collider teardown behaviour changed, and I am flagging it rather than hiding it

`StreetBlock.dispose()` called `collision.clearBuildings()`. Nothing does now — `WorldProps.dispose()`
cannot, because clearing the shared list would drop the districts' colliders too, and `District.dispose()`
never cleared them either (that is run 1's shape, unchanged).

**This is not a leak in practice**: `Game.destroy()` discards the whole `CollisionWorld` and
`Game.init()` builds a fresh one, so an HMR cycle starts clean. But the old test asserted
`world.buildings.length === 0` after dispose and that assertion is gone, so I am naming it. The right
fix, if anyone wants one, is for `CollisionWorld` to hand out a per-owner handle — a design change, not
a patch.

---

## 7. Acceptance criteria, with evidence

| # | Criterion | Result |
|---|---|---|
| 1 | The standalone Phase 1 block no longer exists as a separate area; its content lives in District B | **PASS.** `src/world/StreetBlock.js` deleted (`git log --diff-filter=D`). A test asserts importing it rejects. No separate ground, roads, building meshes or prop pools exist. |
| 2 | The helipad tower survives — geometry, roof art, 4-bar ring. **Screenshot** | **PASS.** §1.4. Screenshot taken and inspected; ring, yellow FATO circle, white "H" and three clear rooftop units all read. Three canvas-recording tests unchanged and green. |
| 3 | The hero spawns on a sidewalk, clear of building footprints | **PASS.** Unchanged at `(0, 0, 13)`; tested against the built world's 206 colliders with the capsule radius, plus the roadway/sidewalk bounds. |
| 4 | Collider registrations survive, incl. the parapet's boxes; create-collision-before-world intact | **PASS.** All 4 bars per annex building and all 22 rooftop units, looked up by coordinate. `Game.init()` creates the `CollisionWorld` first and everything registers into it. |
| 5 | Every test change listed and categorised; no still-true invariant deleted | **PASS.** §2. |
| 6 | The absorption's draw-call delta, measured on its own, before props | **PASS.** **−25** (−16 main / −9 shadow); world 83 → 58. §1.2. |
| 7 | Vegetation per decision 21, **including the species change to the absorbed content** | **PASS** — with a nuance worth stating. District A gets the Canary palm; District B gets the Mexican fan palm. **The annex was already Washingtonia robusta**, and it is in District B, so decision 21 requires it to *stay* the fan palm — which it does, with byte-identical hashes. The species *change* decision 21 implies would have applied only if the block had gone to District A. |
| 8 | §10 items 5–8 built, or cut from the bottom with reasons | **PASS.** Items 4–10 all built. Nothing cut from §10's order. One half of §PROP-3 cut for a mechanical reason (§5.4). |
| 9 | Measured total draw calls, both passes, with split; triangles, programs, textures | **PASS.** 78 (44 / 34) graph walk, 77 measured worst case, against 83 before and 150 ceiling. 99,070 triangles, 25 programs, 57 textures. §0. |
| 10 | GPU frame time, median and p95 | **PASS.** 0.4–0.6 ms median, 0.6–0.9 ms p95 across five viewpoints. §4.3. |
| 11 | Props were **looked at** in a browser, not just counted | **PASS.** §9 lists what I checked and the two defects it caught. |
| 12 | `npm test` passes with new coverage | **PASS. 169/169**, up from 148. 21 new tests. |
| 13 | `kodaman_prototype.html` zero diff | **PASS.** `git diff main...HEAD -- kodaman_prototype.html` is empty. Never opened. |
| 14 | Repo clean | **PASS.** Screenshots moved to the scratchpad, `.playwright-mcp/` deleted, `dist/` removed, dev server stopped. `git status` shows only the pre-existing untracked `KODAMAN_HANDOFF.md`. |

---

## 8. What needs a user decision — not guessed

### 8.1 The hill has no name, and must not acquire one from me

Locked decision 6 reserves all naming to the user; §PROP-3 restates it for this feature specifically.
The landform is called `hill` in code and nothing in `terrain.js` is a proper noun. **`AKC ENTERPRISE`
on the sign mast remains the only name anywhere in `kodaman3d/`** and I did not add a second one.

Following the precedent that worked last run, I did not invent a plausible placeholder either — a
plausible-looking name is how an unapproved one ships.

### 8.2 The annex's boulevard dead-ends 20 m short of District B's grid

The annex spans world x ∈ [−150, 150]; District B's grid starts at x = 170. The 20 m between them is
floored but empty, so the boulevard stops rather than continuing into the district. It is not a bug —
the two were separately authored and decision 24 only asked that the content merge — but from the air
it reads as an unfinished join.

Three options, none of which I took because they are all design calls: extend the annex's boulevard
east to meet the district edge (cheap, ~0 calls, but it terminates in a building); shift District B's
origin west so the grid abuts the annex (moves 36 reviewed-in-aggregate buildings); or leave it as an
open lot and let a later pass fill it. **Left as-is.**

### 8.3 Should District B's generated buildings get parapet rings?

§10 item 5 scopes them to District A and I followed it (§6.1). If a human looks from the air and wants
them everywhere, it is a **zero-call, one-line change**.

### 8.4 Still open from run 1, and still not mine

- **§6.3, the districts cast no shadows.** `Sky.js`'s fixed ±60 m shadow frustum still excludes both
  districts. CSM is the fix and remains out of scope. My 77-call figure is what CSM's baseline
  both-pass cost looks like before cascades multiply the shadow pass.
- **§6.4, the fog range.** `Fog(hazeColor, 120, 900)` in a 1,725 m-diagonal world. I hit this
  measuring — the hill at 400 m is visibly washed. Still collides with decision 11 and still belongs
  to whoever owns the world-edge fade. **Not changed.**

---

## 9. What I looked at in a browser, and what it caught

The brief's warning that *"the object renders" is not the same check as "the object reads"* was
correct, and it earned its place twice.

**Checked by eye, not by count:**

| Check | Result |
|---|---|
| Does the helipad still read? | Yes — ring, glyph, coping ring, clear units. |
| Are palms intersecting buildings? | No. The local-frame keep-out holds; verified across District A, District B and the annex. |
| Are streetlamps on the sidewalk or in the roadway? | Sidewalk, with the head arm overhanging the road on all four street orientations. |
| Do District A's props follow the 36° grid? | Yes — rows run parallel to the yawed streets; visible in the intersection shot. |
| Are parked cars floating, half-buried, or facing the kerb? | None of the three. On the asphalt inside the kerb, aligned along the street, opposite sides facing opposite ways. |
| Is anything standing in an intersection? | No. |
| Do the two palm species read as different trees? | Yes — clearly, side by side at the district boundary. |
| Does the hill read as a landform? | Yes, after two fixes. |

**Two defects only a screenshot could have caught:**

1. **The hill had a 300 m square drawn around it.** A displaced *square* plane has flat corners, and
   those corners sat 1 cm above the district ground in a different colour. Invisible to every test I
   had. Fixed by setting the skirt colour to District B's ground colour exactly.
2. **The hill's summit was pinched into a crease**, because the three-lobed contour modulation uses
   `atan2` and θ is undefined at r = 0 — three different heights met at one vertex. Fixed by fading
   the lobe term out near the centre.

And a third that was catchable but wasn't caught by anything else:

3. **The scaffolding was a gantry.** I authored one scaffold bay and scaled it on Y by the building's
   lift count, which gives two bare 12 m standards with a single deck at the top. The count was right,
   the pool was right, the placement was right, and it looked nothing like scaffolding. Fixed by
   emitting one **instance** per lift — instances inside a pool are free; the scale trick was not.

---

## 10. What I did not build

- **§PROP-3's district grade relief** — cut, mechanically blocked. §5.4.
- **Parapet rings on District B's generated buildings** — §10 scopes them to District A. §6.1.
- **Parapet colliders on District A** — the AABB model cannot represent a rotated thin bar without
  blanketing the roof. §6.2.
- **OBB collision** — run 1 called this "run 2's". It was not in my brief's scope table and I did not
  take it. District A's colliders remain circumscribed and err large.
- **§10 item 11 (FAM-3 / MAS-2 variety)** — moot, per the brief; run 1 built all 7 families and 5
  recipes.
- **Everything in the brief's out-of-scope list**: CSM, day/night, streaming/chunking, the world-edge
  fade, and anything touching the hero, the rig or animation. Untouched.

---

## 11. What still needs a human eye

Everything measurable was measured. Three things genuinely need a person, and the first two are
carried over unchanged from run 1 because nothing this run could close them:

1. **Whether the 36° rotation contrast reads as two different places.** I can prove the rotation is
   applied, show it in a screenshot, and now also show that the props follow it. I cannot judge
   whether it achieves what decision 10 wants.
2. **Whether the 150 m crowned landmark, the 75 m mast and now the 68 m hill read at this world's
   scale** — and specifically whether **three** anchors triangulate or compete.
3. **Whether the prop density is right.** 1,376 instances is a number, not a judgment. District B's
   boulevard is mass-planted at 12 m per §PROP-2's "iconic LA street palm, mass-planted" and it may
   read as too much; District A's 26 m plaza rhythm may read as too sparse. Both are one constant
   each in `props.js` and cost nothing to change.

I have not written a `BROWSER_SPOT_CHECK_7.md` — everything else that would be on one is already a
number in this document.

---

*End of Phase 2 Districts Engineer report, run 2 of 2.*

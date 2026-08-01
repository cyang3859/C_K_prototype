# Design Spec — Phase 2 Districts: Tower Plateau and Boulevard Corridor

**Author:** Design agent, session 7 continuation, 2026-08-01.
**Subject:** the two Phase 2 districts locked by decision 10 — District A (dense tower plateau,
36°-rotated historic grid) and District B (mixed-height boulevard corridor, cardinal grid).
**Reads against:** `RESEARCH_PHASE_2_WORLD.md` (world/streaming/density/budget research, run 1),
`RESEARCH_LA_WORLDBUILDING.md` (cited by section per the brief), `kodaman3d/src/world/StreetBlock.js`
(the generalization target, read directly — not assumed from docs), and `DESIGN_SPEC_TOWER_PALETTE.md`
(the shipped tower palette fix this spec builds on and does not re-derive).
**Next gate:** Review, for a **budget and feasibility check only** — no vote on taste, per
`DESIGN_AGENT_BRIEF.md` and `DESIGN_BRIEF_PHASE_2_DISTRICTS.md`.

---

## How to read this document

**Every draw-call figure in this document is a both-pass total (main + shadow), stated as such,
with the split shown alongside it.** That is the standing orchestrator ruling and it is honored
throughout — a number here without a split shown is an error, not a convention.

Confidence labels, per the brief's convention:
- **[MEASURED]** — read directly from the installed code, not inferred.
- **[SOURCED]** — from a cited external or internal document.
- **[ESTIMATE]** — this agent's judgment or extrapolation. Defensible, not measured.
- **[ESTIMATE, INHERITED]** — carries forward an estimate `RESEARCH_PHASE_2_WORLD.md` already made
  (e.g. "30–50 buildings per district," §BUD-3) rather than re-deriving it. Flagged as inherited so
  it's clear the uncertainty is not new to this document.

Design taste (palette choices, silhouette proportions, which reference to lean on) needs no label.
Claims about what the code or a source document actually says do.

Finding IDs used: **DA-** (District A specifics), **DB-** (District B specifics), **FAM-** (facade
families), **MAS-** (massing recipes), **MAT-** (shared material/code findings, including doc/code
corrections), **PROP-** (clutter, vegetation, terrain, landmarks), **BGT-** (this spec's own budget
rollup, distinguished from the research document's `BUD-` IDs it draws on).

---

## 0. A doc/code correction, found while reading `StreetBlock.js` directly — MAT-1

**[MEASURED]** `FACADE_VARIANTS`'s block comment in `StreetBlock.js` (lines 203–229) states flatly:
*"There is NO ENVIRONMENT MAP in this project — no `scene.environment`, no PMREM... Metal takes the
brightness away and gives nothing back."* This is stale. `Sky.js` (lines 178–183) constructs a
`THREE.PMREMGenerator`, bakes a synthetic sky into it, and assigns `this.scene.environment =
this.envTarget.texture` with `this.scene.environmentIntensity = TUNING.ENV_INTENSITY`. Per
`KNOWLEDGE_BASE.md` §2, this landed at `6a07c13`, is verified in a browser (spot-check 5, 4/4), and
is live today. **The code comment predates the environment map; the environment map is real and
shipping.** Per this project's own precedence rule, the code wins, and this is worth surfacing
explicitly rather than silently working around: `FACADE_VARIANTS.towerShared`'s current metalness
values (`wallMetal 0.32`, `winMetal 0.5`) were deliberately chosen *for a rig with no indirect
specular at all* (`DESIGN_SPEC_TOWER_PALETTE.md`), and that constraint no longer fully holds. The
tower-palette spec itself flagged this as the expected outcome and left the door open: *"Restoring
[metalness] is still physically defensible and remains available to a Phase 2 pass that wants more
glassiness — but as an enhancement, not a fix"* (`KNOWLEDGE_BASE.md` §2). **This document is that
Phase 2 pass for the two new facade families it introduces (§4)** — it does not touch the shipped,
browser-verified `towerShared`/`midriseA`/`midriseB`/`lowriseA`/`lowriseB` constants, which District
B reuses unchanged (§2, §FAM-B). New families are free to use moderately higher metalness than the
pre-envMap constants did, because the physical mechanism the original spec was compensating for the
absence of no longer applies at full force. Still conservative, not reverted all the way to the
pre-fix 0.45/0.70 that caused the original near-black defect — the synthetic PMREM sky is a modest
three-band gradient, not an HDR photo environment, and ACES Filmic tone mapping (`Renderer.js`) still
compresses the dark end hard regardless of envMap presence.

---

## 1. District A — the tower plateau

### DA-1 — What District A is, and what it is not **[SOURCED, cites RESEARCH_LA_WORLDBUILDING.md §3.1/§3.2/§3.3]**

District A sits on the 36°-rotated historic Ord grid (locked decision 10; grid geometry per
`RESEARCH_LA_WORLDBUILDING.md` §1.1). The real reference is DTLA's financial core: *"a cluster of ~10
towers in the 210–335 m band... a plateau, not a spire"* (§3.1), one architectural generation
(1971–1992, dark glass and stone-clad boxes, flat tops), with §3.3's flat-roof/helipad ordinance
(rescinded 2014, exempting only new buildings over 420 ft) making every tower's roof a legible
landing pad. §3.2 explains *why* the plateau is a plateau and not a single spire: a 150 ft (46 m)
height cap held from ~1904/1905 until a 1957 referendum, so the buildings that define the skyline
today are almost all products of the one post-1957, pre-2014-ordinance-change window. **This is the
opposite silhouette move from a single hero tower dominating a skyline** — District A's read comes
from a dense field of similar-height, flat-topped boxes, with exactly one deliberate outlier (the
landmark, §DA-4/MAS-3) breaking the pattern. `RESEARCH_PHASE_2_WORLD.md` §DIS-2 recommends narrowing
District A's height variety *relative to Phase 1's mixed block* — mostly tower-class, few or no
lowrise — specifically so it reads as the plateau rather than Phase 1's deliberately-mixed one block.
This spec follows that recommendation.

### DA-2 — Height bands **[ESTIMATE, grounded in the real reference and Phase 1's existing tower footprint precedent]**

Real DTLA towers run 175–335 m; this project's built-world compression (§ATM-4/§DEN-6 discuss the
general compression this project already accepts — a 2,048–4,096 m world cannot host kilometre-scale
real distances literally) means District A's towers should read as a plateau at *this* world's scale,
not attempt real DTLA's absolute heights. Phase 1 already shipped two tower instances at 90 m and 64
m (`BLOCK.buildings` indices 2 and 8) and both read correctly in five browser passes — that precedent
is the anchor, not real DTLA's raw metres.

| Band | Height range | Share of District A buildings | Footprint (w × d) |
|---|---|---|---|
| Landmark (one only, §DA-4) | 150 m | 1 building | 22 × 32 m |
| Primary tower | 70–110 m | ~65% | 18–24 × 24–32 m |
| Secondary/infill tower | 40–60 m | ~30% | 16–20 × 22–28 m |
| Podium-only structure | 15–20 m | ~5% (parking/annex buildings at tower bases) | 20–28 × 20–30 m |

All bands stay tower-class or podium-annex — no `lowrise`-band buildings in District A, per DIS-2.
Footprints extend Phase 1's existing tower range (18–20 × 28–30 m) rather than inventing a new one.

### DA-3 — Palette differs from District B primarily by material family, not by a single "district tint" **[design rationale]**

District A does not get one uniform colour wash — that would read as a lighting gel over the same
buildings, not "a different generation of architecture." Instead it gets its own facade family set
(§FAM-A1 through FAM-A3, §4) built the same way Phase 1's tower/midrise/lowrise kinds already are:
distinct wall/window hex pairs and distinct roughness/metalness pairs per family. What *is* shared
district-wide: flat rooflines (DA-1's ordinance constraint), the existing parapet-ring coping
mechanism (`KNOWLEDGE_BASE.md` §6's roof-fix history — reused unchanged, §PROP-6), and the general
"dark, glossy, saturated-blue-grey" tonal register that reads as curtain-wall glass rather than
stucco. Airborne legibility (the hero flies, per the brief) comes from **silhouette and roofline
density** at the district level, not from a single top-down colour cue — a flying hero sees roughly
uniform block heights and flat tops over District A and a jagged, low, varied skyline over District B
long before facade colour is resolvable at altitude.

### DA-4 — The landmark **[design proposal, ties to PROP-9/DEN-6]**

One building, at 150 m (the tallest in the built world, ahead of every other structure in either
district), sited near District A's geometric centre so it is visible from the greatest span of the
district and serves as an orientation anchor for a flying hero approaching from any direction — the
technique `RESEARCH_LA_WORLDBUILDING.md` §7.2's GTA V analysis documents and `RESEARCH_PHASE_2_WORLD.md`
§DEN-6 names as *"the cheapest lever in the whole density section."* Built via MAS-3 (§5) and given a
bespoke roof atlas exactly the way Phase 1's `building_tower_2` already does (`_makeBespokeTowerMaterial`,
confirmed in code) — same technique, one new asset. Costed at §BGT as two calls beyond the family
budget (§FAM), because a bespoke-atlas building needs its own material and this project's `BatchedMesh`
usage is not verified to support mixed materials within one batch (see §11, "what I could not answer").

---

## 2. District B — the boulevard corridor

### DB-1 — What District B is **[SOURCED, cites RESEARCH_LA_WORLDBUILDING.md §1.2/§3.4/§5.4/§5.5/§5.8/§6.5]**

District B sits on the cardinal PLSS grid (locked decision 10; §1.2). The real reference is the
Hollywood Blvd Walk of Fame corridor (§5.4: 1.3 mi, 2,840 stars, 15 blocks + 3 on Vine, ~460 ft/block)
generalizing Phase 1's already-shipped `lowrise`/`midrise` kinds and blade-sign instancing — the same
mechanism §5.5 documents for Broadway's marquees ("the code doesn't care which street it's
simulating"). This is the deliberate rotation-contrast pairing locked decision 10 requires: *"the
same sun rakes them differently at the same hour"* (§6.4) — a spec that erased this contrast would
defeat the decision, so District B's street grid, unlike District A's, runs true east–west/north–south.

### DB-2 — Height bands **[ESTIMATE, grounded in Phase 1's lowrise/midrise precedent and §3.4's real reference]**

| Band | Height range | Share of District B buildings | Footprint (w × d) |
|---|---|---|---|
| Landmark (one only, §DB-4) | 75 m | 1 structure | thin mast, not a building footprint |
| Midrise | 24–35 m | ~40% | 16–22 × 22–26 m |
| Lowrise | 8–14 m | ~55% | 16–20 × 18–22 m |
| Occasional taller midrise | up to 46 m | ~5% | 18–22 × 24–28 m |

The 46 m ceiling on the "occasional taller midrise" band is not arbitrary: it is §3.4's exact figure
for the Capitol Records Building ("151 ft (46 m)... a physical monument to the height cap"), the real
150 ft pre-1957 limit District A's towers all postdate. Capping District B's tallest ordinary building
at that number (rather than letting it drift toward District A's tower heights) keeps the two
districts silhouette-distinct at a glance, per DIS-2's requirement, and is itself a small piece of
authentic period detail — a boulevard corridor genuinely would not exceed the old cap the way DTLA's
post-1957 towers do. **Do not use the Capitol Records Building's actual cylindrical silhouette** —
this is a real number borrowed from a real building, not its design; see the "Legal boundary" section
below (§3) for why the number is fine to cite and the shape is not.

---

## 3. The legal boundary, applied to these two districts specifically

Locked decisions 3, 5, and 6 govern this. Decision 3 explicitly permits **recognizable landmarks,
invented streets** — so citing real dimensions, real ordinances, and real district *types* (DTLA's
tower plateau, Hollywood Blvd's boulevard corridor) throughout this document is inside the locked
scope, not a risk. The line sits at **specific protected designs**, not at real-world facts:

- **The Capitol Records Building's 46 m height (§DB-2) is a fact — a real number tied to a real
  ordinance — and is fine to cite.** Its actual cylindrical stack-of-records silhouette is a specific,
  recognizable building design, and this document does not propose reproducing it. District B's
  46 m-band buildings use FAM-6/FAM-7's ordinary rectilinear massing (§5), not a citation of that
  building's shape.
- **District A's landmark (§DA-4) and District B's sign-mast (§DB-4) are original silhouettes** at
  cited-but-generic heights (150 m, 75 m) — neither is described here as resembling any specific real
  tower or sign structure, only as belonging to the *category* real LA examples establish (a tall
  flat-topped tower; a tall illuminated corridor sign). Actual names, signage text, and specific art
  are explicitly left to the user, per locked decision 6 (§12 item 2).
- **No proper nouns are introduced anywhere in this document** — every district, building class, and
  landmark is described by real-world type and geography, matching the convention
  `RESEARCH_PHASE_2_WORLD.md` §DIS-2 already follows and this document does not deviate from.
- **If a specific real landmark ever feels like a genuine edge case** (a facade family or massing
  recipe that starts to read as a citation of one specific real building rather than a typology), this
  document's position is to flag it rather than decide it, per the brief's own instruction — nothing
  in §1, §2, or §4–§8 reads that way to this author, but the call belongs to the user if it arises
  during implementation.

### DB-3 — Palette and identity **[design rationale]**

District B's four families (§FAM-B1–B4, §4) are, deliberately, near-direct reuses of Phase 1's
already-shipped `lowriseA`/`lowriseB`/`midriseA`/`midriseB` — cream stucco, ochre stucco, steel-blue
glass, smoked-bronze glass. This is a lower-risk choice than authoring new District B palettes from
scratch: those four constants are already browser-verified across five Phase 1 spot-checks, and
`RESEARCH_PHASE_2_WORLD.md` §DIS-1 makes the same observation independently — Phase 1's one block
"has already built and browser-verified two different reusable asset classes at once," and District B
is exactly where the lowrise/midrise class generalizes. The one new element is FAM-B2's terracotta
band re-tint (§4), which is a single-hex change with the same zero-draw-call shape as the tower
palette fix.

### DB-4 — The landmark: signage, not a building **[design proposal, ties to PROP-9/DEN-6/DEN-9]**

District B's landmark is deliberately **not** a tall building — it is a slender illuminated sign/
observation mast, 75 m tall, thin cross-section (a tapered cylinder or octagonal prism, not a boxy
building silhouette), sited at District B's busiest boulevard intersection. Two reasons this beats a
tall building for District B specifically:

1. **It is the authentic answer, not a borrowed game-design trick.** `RESEARCH_LA_WORLDBUILDING.md`
   §5.9 documents that on the real 1.6-mile Sunset Strip corridor, signage structures up to 90 ft
   (27 m) are *"the dominant vertical elements, not the buildings."* A mast landmark is what a real
   boulevard corridor's tallest vertical feature actually would be, not a stylistic compromise.
2. **It is cheap relative to a landmark building.** A thin mast is tens of triangles, not the 24–48 a
   massed building recipe costs (§5), and — because it is not part of any facade `BatchedMesh` family
   — it does not risk the "does `BatchedMesh` support mixed materials in one batch" open question
   DA-4 flags. It is unambiguously a standalone `Mesh`, the same shape Phase 1's bespoke tower already
   is.

75 m (roughly half District A's 150 m landmark) is deliberate, not a compromise: it needs to dominate
District B's own 8–46 m skyline (it does, by a wide margin) without approaching District A's tower
heights, which would blur the two districts' silhouette contrast the pairing exists to create.

---

## 4. Facade families — the highest-leverage decision in this document

This is `BUD-3`'s central requirement: buildings must batch by facade material family, and **the
family count *is* the building draw-call count** — every family costs ~2 calls (main + shadow), every
one merged saves the same. Seven families total, three for District A and four for District B, for
**14 calls both passes (7 main / 7 shadow)** from the general building population, before the two
landmarks (§DA-4/DB-4, priced separately at §BGT because they are not `BatchedMesh` members). This
sits inside `BUD-3`'s own "3–4 families per district" sizing and inside `BUD-6`'s ~12–16-call estimate
for the buildings line.

### District A — three families

**FAM-1 — "Dark Curtain-Wall Glass"** (District A workhorse, ~70% of towers)

**[MEASURED — unchanged from the shipped, browser-verified constant]** This is `FACADE_VARIANTS.towerShared`
exactly as it ships today. Not re-derived, not re-tuned — `DESIGN_SPEC_TOWER_PALETTE.md`'s fix is
confirmed working in a browser (`KNOWLEDGE_BASE.md` §2, spot-check 5, 4/4) and this document does not
second-guess a verified result.

| Property | Value |
|---|---|
| `wall` | `0x828fa0` |
| `window` | `0x32475e` |
| `band` | `0x4a4844` |
| `columns` | 5 |
| `wallRough` / `wallMetal` | 0.4 / 0.32 |
| `winRough` / `winMetal` | 0.1 / 0.5 |

Rationale: §3.1's "1971–1992… dark glass and stone-clad boxes" reference, already the basis for the
original tower design. Applies to the primary and secondary/infill tower bands (§DA-2).

**FAM-2 — "Stone-Clad Podium"** (District A, ~20% — podium bases and standalone low annex structures)

**[design proposal, new]** §3.1's own phrase — "dark glass **and stone-clad** boxes" — names a second
material family the Phase 1 kit never built: the real DTLA cluster is not glass-only. This family is
for podium levels (the base of MAS-1/MAS-2 recipes, §5) and free-standing low annex/parking structures,
where punched masonry openings rather than curtain-wall glazing are the authentic read.

| Property | Value | Rationale |
|---|---|---|
| `wall` | `0xb8b2a4` (warm limestone grey) | Matte stone cladding, not glass — deliberately the lightest, driest surface in either district's palette, for contrast against the glass towers above it |
| `window` | `0x25303c` | Darker than any glass family's window — punched openings read as recessed voids, not a reflective plane |
| `band` | `0x8f8878` | Neutral stone-adjacent, decoupled from wall per the existing `band` convention (`StreetBlock.js`'s own comment: "roof/spandrel neutral — DECOUPLED from the wall colour") |
| `columns` | 3 | Fewer, wider punched openings than a curtain-wall grid — matches the coarser fenestration rhythm real podium/parking structures actually have |
| `wallRough` / `wallMetal` | 0.85 / 0.02 | Near-matte, effectively non-metallic — stone, not glass |
| `winRough` / `winMetal` | 0.3 / 0.25 | Modest gloss and reflectivity, well short of the glass families — a punched window with visible frame, not a mirror plane |

**FAM-3 — "Light Silver-Glass Accent"** (District A, ~10% — the landmark tower plus 1–2 secondary
towers marked as newer-generation)

**[design proposal, new — see MAT-1 for why its metalness can sit above the pre-envMap tower constants]**
Gives District A's plateau a small amount of generational variety — not every tower need read as the
same 1971–1992 vintage — while staying inside §3.3's flat-roof convention (the landmark does not get
a sculpted crown; see §12 item 1's open question on this). This is deliberately the glossiest, lightest family
in either district, so the landmark reads as visually distinct from altitude, not just taller.

| Property | Value | Rationale |
|---|---|---|
| `wall` | `0xa9b4c2` (pale silver-blue) | Lighter and cooler than FAM-1, evoking a later-generation reflective glazing without literally citing Wilshire Grand Center's real facade |
| `window` | `0x4a6480` | More saturated blue than FAM-1's window, and — per MAT-1 — safely bright enough under ACES that the higher metalness below does not recreate the original near-black defect (proxy check: `0x4a6480` ≈ (74,100,128); at `winMetal 0.58` the diffuse term `albedo × (1 − metal)` lands at 31–54, comparable to or above the shipped tower's already-verified 25, using the same linear-space sanity check `DESIGN_SPEC_TOWER_PALETTE.md` used) |
| `band` | `0x5a5f66` | Cooler, lighter neutral than FAM-1's `0x4a4844` |
| `columns` | 5 | Matches FAM-1's window rhythm, for a family that reads as "the same kind of tower, newer glass" rather than a different typology |
| `wallRough` / `wallMetal` | 0.28 / 0.38 | Glossier and slightly more metallic than FAM-1 (0.4 / 0.32) |
| `winRough` / `winMetal` | 0.08 / 0.58 | Tighter, brighter highlight than FAM-1 (0.1 / 0.5) — the glassiest window in the whole spec |

### District B — four families

**FAM-4 — "Cream Stucco Dingbat"** (District B, lowrise)

**[MEASURED — unchanged]** `FACADE_VARIANTS.lowriseA` exactly as shipped: `wall 0xd9c6a0`,
`window 0x293b4d`, `band 0xb8a888`, `columns 3`, `wallRough 0.98`, `wallMetal 0.0`, `winRough 0.22`,
`winMetal 0.45`. Rationale: `RESEARCH_LA_WORLDBUILDING.md` §6.5's dingbat typology — two-story stucco
box, flat top, built lot-line to lot-line.

**FAM-5 — "Ochre Terracotta Storefront"** (District B, lowrise/storefront)

**[design proposal — a single-hex delta on a shipped constant, same shape as `DESIGN_SPEC_TOWER_PALETTE.md`'s
fix]** `FACADE_VARIANTS.lowriseB` today shares `lowriseA`'s exact `band`/`window`/numeric properties
and differs only in `wall` (`0xc2a06e`, ochre). This family retints the `band` only — from `0xb8a888`
to **`0xa85a3c`** (terracotta) — to carry a specific reference §5.5 names directly: Broadway Theater
District cornices, the "ornate theater district" texture the brief's own sketch names. Everything
else — `wall 0xc2a06e`, `window 0x293b4d`, `columns 3`, `wallRough 0.98`, `wallMetal 0.0`,
`winRough 0.22`, `winMetal 0.45` — is unchanged from the shipped, browser-verified `lowriseB`.
Zero draw-call cost; one hex constant.

**FAM-6 — "Steel-Blue Glass Midrise"** (District B, midrise)

**[MEASURED — unchanged]** `FACADE_VARIANTS.midriseA` exactly as shipped: `wall 0x8f96a3`,
`window 0x1f2c3a`, `band 0x6a675f`, `columns 4`, `wallRough 0.45`, `wallMetal 0.4`, `winRough 0.12`,
`winMetal 0.65`.

**FAM-7 — "Bronze Glass Midrise"** (District B, midrise, the taller 46 m band per DB-2)

**[MEASURED — unchanged]** `FACADE_VARIANTS.midriseB` exactly as shipped: `wall 0x8a7a68`,
`window 0x2e2519`, `band 0x6a675f`, `columns 4`, `wallRough 0.45`, `wallMetal 0.4`, `winRough 0.12`,
`winMetal 0.65`.

### FAM-8 — Why District B leans on reuse and District A does not **[design rationale]**

This asymmetry is deliberate, not an oversight. District B's four families are three near-exact and
one single-hex-delta reuse of already-shipped, already-browser-verified constants — the lowest-risk
path available, and it is available *because* Phase 1's one block already mixed lowrise and midrise
kinds (`RESEARCH_PHASE_2_WORLD.md` §DIS-1). District A has no equivalent shipped "stone podium" or
"light glass" asset to reuse — Phase 1 built exactly one tower palette — so two of its three families
are new. This is not spending budget unevenly by accident: both districts land at 3–4 families, the
ceiling `BUD-3` sets, and the new work goes where Phase 1 genuinely has no existing asset to extend,
not where it's merely convenient.

### Corner and edge articulation — texture, not geometry **[FAM-9, design proposal]**

`DEN-2` specifically asks for chamfers, recesses, and pilaster lines "suggested by the facade atlas's
existing UV-tiling mechanism rather than new geometry where geometry isn't needed." `StreetBlock.js`'s
`scaleBoxUVs()` (confirmed in code, lines 1428–1453) already tiles each facade at `FACADE_TILE_M = 4`
metres per repeat, independent of building size — this is the exact mechanism to lean on:

- **Pilaster lines**: paint a single darker vertical seam (a few pixels wide) at the tile edge inside
  the facade atlas canvas, so it repeats automatically every 4 m — aligned with the existing window-
  column rhythm (`columns` already divides each tile into that many bays) rather than fighting it.
  **Cost: zero draw calls, zero triangles** — a change to the existing atlas-painting routine
  (`_makeFacadeMaterial`/`_paintFacadeRegion`, not touched by this document's numbers, since it does
  not write code), applied per family.
- **Corner chamfer read**: a real geometric chamfer needs extra vertices per corner (an octagonal
  rather than rectangular cross-section) and was deliberately *not* used — the massing recipes'
  setback lines (§5) already provide genuine corner/edge articulation via real geometry breaks, which
  is the more load-bearing move `DEN-2` asks for. A textural corner *shadow* gradient (darkening the
  outer ~5% of each facade tile's width) is a cheap, optional second layer on top, same zero-cost
  shape as the pilaster line.
- **Spandrel banding**: already exists (`band`, the `if (floor % 4 === 0)` spandrel branch in
  `_paintFacadeRegion`, confirmed present) — every family above inherits it for free by using the
  existing atlas machinery unmodified except for the specific hex/numeric deltas listed.

---

## 5. Massing recipes — the geometry half of the DEN-1 fix

`DEN-1` establishes the diagnosis precisely: *"blocky and rigid" is not a mood, it is a literally true
statement about the code* — every Phase 1 building is one `BoxGeometry`, full stop. `DEN-2` proposes
the fix as 3–5 recipes of 2–4 stacked boxes (podium, setback, cap), applied **via data, not hand-placed
per building** — the same declarative-data philosophy `IMPLEMENTATION_PLAN.md` already uses for
quests. Five recipes follow, each specifying box count, proportions, triangle cost (a plain
`BoxGeometry` is 12 triangles; this is [MEASURED] — it is the standard cube-mesh count, 6 faces × 2
triangles), and which district/family it applies to. **Massing recipes cost triangles, not draw
calls** — because every building using a recipe still batches into its family's `BatchedMesh` (§4),
adding a recipe never changes the family count. This is the direct payoff of `LOD-3`'s observation
that `BatchedMesh` is exactly the tool for "many geometry variants, one shared material family."

### MAS-1 — "Podium + Setback Slab" (2 boxes, District A primary)

Podium: full lot footprint (`w × d`), height = `clamp(0.12 × towerHeight, 9, 15)` metres. Slab: same
centre, footprint inset **1.5 m per side** (width and depth each reduced by 3 m) above the podium
line, rising to the building's full height. Flat roof; coping uses the existing instanced parapet-bar
ring mechanism (§PROP-6), not new per-building geometry. **Triangle cost: 24 (2 × 12).** Applies to
FAM-1 and FAM-3, District A primary/secondary tower bands (~65% of District A's population per DA-2).

### MAS-2 — "Twin Setback Ziggurat" (4 boxes, District A secondary)

Podium (full footprint, 10–14 m), lower-tower (inset 1.2 m/side above the podium line), upper-tower
(inset a further 1.2 m/side at roughly 65% of total height), cap (inset a further 0.8 m/side, the top
8–10% of height). Flat roof throughout — the ordinance constraint (§3.3) is never broken, only the
*silhouette leading up to it* varies. **Triangle cost: 48 (4 × 12).** Applies to FAM-1 and FAM-2
(podium level), District A secondary/infill tower band (~30% of District A per DA-2) — this is the
recipe that gives the plateau its stepped-massing variety without inventing a non-flat roof.

### MAS-3 — "Bespoke Landmark Crown" (2–4 boxes + unique atlas, one per district)

Base geometry reuses MAS-1 or MAS-2's box stack (2–4 boxes depending on which better suits the
specific landmark's proportions) but the finished building gets a **dedicated, non-batched `Mesh`**
with its own bespoke roof/facade atlas — the exact technique `_makeBespokeTowerMaterial` already
implements for Phase 1's `building_tower_2` (confirmed in code). This is deliberately *not* inside any
`BatchedMesh` family, because a bespoke atlas needs its own material and this project's `BatchedMesh`
has not been confirmed to support per-instance material overrides within one batch (§11). Corner
chamfer cues, if wanted for the landmark specifically, are painted into its unique atlas rather than
built as geometry, consistent with FAM-9's preference. **Triangle cost: 24–48 (same as the base
recipe — the bespoke atlas is a texture change, not a geometry change). Draw-call cost: +2 both passes
per landmark** (1 main + 1 shadow — a whole extra `Mesh`, priced at §DA-4/§BGT, outside the family
budget in §4). One per district — District A's 150 m tower (§DA-4) and District B's equivalent hero
asset if a building-shaped landmark is ever wanted instead of the sign-mast (§DB-4 recommends the
mast; this recipe is kept available as the fallback if that recommendation is overturned).

### MAS-4 — "Stoop Podium Lowrise" (2 boxes, District B lowrise)

Storefront podium: full lot footprint, ~4 m height. Upper stucco block: inset a minimal 0.5 m per
side — just enough to read as a distinct massing step in shadow, not a genuine setback. The dingbat
typology's signature "tuck-under parking on stilts" (§6.5) is carried as a **texture cue** in the
podium band region, not built as real undercut geometry — building an actual open ground floor would
require removing geometry a box can't remove without a bevel/notch, which is a real triangle cost this
recipe deliberately avoids for a detail that reads correctly from texture at street level. **Triangle
cost: 24 (2 × 12).** Applies to FAM-4 and FAM-5, District B lowrise band (~55% of District B per DB-2).

### MAS-5 — "Ornate Corniced Midrise" (3 boxes, District B midrise)

Storefront/marquee podium: full footprint, ~5–6 m — the blade-sign instancing (§PROP-8) provides the
marquee read here without any notch or recess cut into the box. Midrise slab: inset 1 m per side above
the podium line. Cornice cap: a thin overhanging box, width = footprint **plus 0.6 m overhang per
side**, height 1–1.5 m, positioned at the top of the midrise slab — the geometric citation of Broadway
Theater District terracotta cornices (§5.5). **Triangle cost: 36 (3 × 12).** Applies to FAM-6 and
FAM-7, District B midrise band (~40% of District B per DB-2) and the occasional-taller-midrise band.

### Recipe economics — why this stays cheap **[MAS-6, arithmetic shown for re-derivation]**

Building population is `RESEARCH_PHASE_2_WORLD.md` §BUD-3's own planning figure — **[ESTIMATE,
INHERITED]**, ~30–50 buildings per district, no authoritative count exists for an as-yet-unauthored
district. Using the midpoint (40/district, 80 total) and the recipe-share percentages stated above:

| District | Recipe | Share | Buildings | Tri/building | Subtotal tri |
|---|---|---:|---:|---:|---:|
| A | MAS-1 | 65% | 26 | 24 | 624 |
| A | MAS-2 | 30% | 12 | 48 | 576 |
| A | MAS-3 (landmark) | 1 building | 1 | ~48 | 48 |
| A | remainder (single-box legacy) | ~2.5% | 1 | 12 | 12 |
| B | MAS-4 | 55% | 22 | 24 | 528 |
| B | MAS-5 | 40% | 16 | 36 | 576 |
| B | MAS-3-shaped equivalent (if landmark is a building, not the mast) | — | 0* | — | 0 |
| B | remainder (single-box legacy) | ~2.5% | 1 | 12 | 12 |
| **Total** | | | **~80** | | **~2,376** |

*District B's landmark is the sign-mast (§DB-4), not a MAS-3 building, so its triangle cost is priced
separately and is small (§PROP-9) — the table's District B row is left at 0 to avoid double-counting.

**~2,400 triangles for the entire two-district building population**, against the ~500,000
whole-scene triangle ceiling (`BUD-7`) — three orders of magnitude of headroom, and notably *below*
`DEN-2`'s own 60–100 tri/building estimate, because these recipes deliberately favour 2-box massing
(24 tri) over 3–4-box massing (36–48 tri) wherever the district-share table allows, pushing corner/
edge detail to texture (FAM-9) instead. **Triangle budget was never the binding constraint here —
draw calls were, and this section spends none beyond the family and landmark costs already priced
in §4 and §DA-4/§DB-4.**

---

## 6. Ground and road — the `BUD-2` trap, designed around explicitly

**[design mandate, directly answering §BUD-2's warning]** `BUD-2` is explicit that naively repeating
Phase 1's per-block ground/road pattern (7 meshes: ground, roadway, 2× sidewalk, 2× curb, centreline)
once per 256 m chunk costs **7 × 64 = 448 draw calls before a single building** — and that "a spec
that implies per-chunk ground meshes is unshippable." This document does not imply that. Ground and
road are **merged per surface type, per district** — a handful of large tiled meshes covering many
chunks' worth of area, exactly the shape `BUD-2` requires (`Chunk.js` supplies per-chunk *content* —
buildings, props — on top of a district-shared render batch it does not own).

| Surface | Meshes | Districts | Shadow | Total |
|---|---:|---:|---|---:|
| Roadway (asphalt, with painted centreline — see below) | 1/district | 2 | none | 2 |
| Sidewalk (both sides merged into one mesh per district) | 1/district | 2 | none | 2 |
| Curb | 1/district | 2 | none | 2 |
| Ground (planting strips / non-paved lot area) | 1/district | 2 | none | 2 |
| **Total** | | | | **8 main, 0 shadow, 8 total** |

**Two things worth stating explicitly, both [MEASURED] against the shipped code:**

1. **The centreline is not a separate mesh in this design.** Phase 1's 7-mesh count includes a
   dedicated `centreline` `InstancedMesh` of dashes (confirmed, `StreetBlock.js` line 505). This spec
   folds lane markings into the roadway's own `CanvasTexture` instead — a painted stripe costs nothing
   the material isn't already paying for, and eliminates one whole mesh category district-wide. This
   is the same "texture over geometry" lever `DEN-2`/FAM-9 use for pilaster lines, applied to the
   street surface.
2. **None of these four surfaces cast shadows, and that is not a new decision — it is what Phase 1
   already does.** Checked directly: `StreetBlock.js`'s ground mesh explicitly sets `castShadow =
   false` (line 441); the roadway (`asphalt`) and curb meshes never set `castShadow` at all, and
   `THREE.Mesh`'s own default is `false`; the centreline dashes explicitly set `castShadow = false`
   (line 525 — corrected from 515 per Review's `RVW-11`). This carries forward unchanged and is worth calling out because it also happens to be
   the right call for a reason Phase 1 didn't need to worry about: `DESIGN_BRIEF_PHASE_2_DISTRICTS.md`
   flags that **large thin geometry straddling CSM cascade boundaries is the likeliest way to
   reintroduce shadow acne** (§ATM-3). A district-length curb (3–7 cm tall, per the locked, do-not-fix
   curb height) run continuously across a merged district mesh is exactly that shape — thin, long,
   certain to cross cascade boundaries at district scale. Its shadow being already off is a defect
   this document does not need to design around; it only needs to not be turned back on.

This lands at **8 total**, under `BUD-6`'s own ~10–16 estimate for this line — the centreline fold-in
is the reason.

---

## 7. Roofline and skyline variety

`DEN-3` is direct: *"Phase 1's single block cannot show [that LA is polycentric]... if the two chosen
districts are visually distinct silhouette classes rather than two similar dense cores."* This spec's
height bands (§DA-2, §DB-2) are built to satisfy that from opposite ends:

- **District A** reads as a dense field of similar-height (40–150 m), uniformly flat-topped boxes —
  the "plateau, not spire" read (§3.1), with exactly one outlier (the 150 m landmark) breaking the
  pattern on purpose.
- **District B** reads as a low, varied skyline (8–46 m, no flat-topped uniformity — lowrise and
  midrise mixed per DB-2's table) with one thin, tall vertical accent (the 75 m sign-mast) that is
  *not* a building at all.

This is the cheapest possible version of `DEN-3`'s ask: the contrast is entirely a height-distribution
and landmark-type difference, costing nothing beyond what §4/§5/§DA-4/§DB-4 already price. No new
geometry category exists solely for "skyline variety" — it falls out of the height-band tables already
specified.

---

## 8. Street-level clutter, vegetation, landmarks, and terrain

`DEN-4` (clutter), `DEN-7` (vegetation), and `DEN-6` (landmarks) are grouped here because they share a
budget line and an instancing-first design approach. `DEN-9` draws the honest line on what does not
transfer from RDR2/Watch Dogs (crowd simulation, per-blade grass, destructible detail) — nothing below
proposes any of that; everything is static/instanced set-dressing, per `DEN-4`'s own stated boundary
("populated sidewalks... are explicitly run 2's territory").

### PROP-1 — Where prop pools live: world-shared where the silhouette is shared, district-exclusive where it isn't **[design correction to a naive first pass, reasoned through below]**

`BUD-4` recommends over-allocating `InstancedMesh` "at district scale." Read literally as "one pool
per district per prop type," this roughly doubles every shared category's draw-call cost for no
silhouette benefit — a shared silhouette (parked cars, streetlamps, generic small props) does not need
a separate GPU buffer per district; it needs one pool sized for the whole built world, with per-chunk
streaming toggling which instances are active via `BUD-4`'s own degenerate-transform mechanism.
**This document treats "district scale" as the sizing target, not a mandate for one pool per
district** — only genuinely district-*exclusive* silhouettes (a family only District A or only
District B uses) get their own pool. This halves the cost of every shared category relative to a
naive per-district reading, and is the reason this section's total lands inside `BUD-6`'s ~27–33
estimate despite covering two full districts rather than one block.

### World-shared prop pools (one pool each, used by both districts)

| Category | Meshes | Shadow | Total | Notes |
|---|---:|---|---:|---|
| Parked cars (2 body shapes: sedan, van) | 2 | both cast | 4 | `setColorAt` for colour variety within each shape, per `DEN-4` |
| Streetlamps (post + head merged into one geometry) | 1 | casts | 2 | Merged at authoring time (`BufferGeometryUtils`) specifically to avoid Phase 1's 2-mesh post/head split costing double at world scale |
| Small props (trash cans, newspaper boxes, fire hydrants — one `BatchedMesh`, several geometry variants) | 1 | casts | 2 | `BatchedMesh` earns its complexity here exactly as `LOD-3` describes: several small variants, one shared material, one call regardless of variant count |
| **Subtotal** | | | **8** | |

### District A — exclusive prop pools

| Category | Meshes | Shadow | Total | Notes |
|---|---:|---|---:|---|
| Canary Island date palm (trunk + crown) | 2 | both cast | 4 | See PROP-2 below for why this species, not District B's, in District A |
| Rooftop HVAC units | 1 | casts | 2 | Reuses Phase 1's mechanism unchanged (`hvacUnits()`, confirmed in code) |
| Parapet coping ring — **PROP-6** | 1 | casts | 2 | Reuses Phase 1's 4-bar ring fix unchanged — same mechanism that made the helipad visible (`KNOWLEDGE_BASE.md` §6) |
| Loading-dock bollards *(cut-priority, §10)* | 1 | no cast | 1 | Tower-base vehicle barriers — lowest-return item in this table |
| **Subtotal** | | | **9** | |

### District B — exclusive prop pools

| Category | Meshes | Shadow | Total | Notes |
|---|---:|---|---:|---|
| Mexican fan palm (trunk + crown) | 2 | both cast | 4 | Phase 1's existing species (`RESEARCH_LA_WORLDBUILDING.md` §6.1), kept for District B's boulevard identity |
| Broadleaf shade tree (single merged mesh) | 1 | casts | 2 | `DEN-7`'s note that a palm-only district misreads for non-boulevard side streets — District B's courtyard-adjacent blocks get this instead |
| Storefront awnings | 1 | no cast | 1 | Reuses Phase 1's mechanism (`G3`, confirmed no-shadow in `ENGINEER_PHASE1_CLOSE.md`) |
| Blade signs / marquees — **PROP-8** | 1 | no cast | 1 | Reuses Phase 1's mechanism (`G4`, confirmed no-shadow) — the direct citation of §5.5's Broadway marquees |
| Utility poles (merged single geometry) | 1 | casts | 2 | District B only — District A's dense core is treated as undergrounded, a real and common CBD condition, which also avoids adding a fourth world-shared pool for a silhouette District A doesn't need |
| Scaffolding / construction props *(cut-priority, §10)* | 1 | casts | 2 | `DEN-8`'s environmental-storytelling suggestion — one or two blocks only, not district-wide |
| Café tables / market stalls *(cut-priority, §10)* | 1 | no cast | 1 | Lowest-return item in this table |
| **Subtotal** | | | **13** | |

### PROP-2 — Why the two districts get different palm species **[design rationale]**

`DEN-7` names three real, distinguishable palm species with real silhouette differences and
specifically argues for "at least one broadleaf shade-tree type alongside palms for districts that are
not palm-boulevard-coded." This spec goes one step further than the minimum: District A gets the
**Canary Island date palm** (§6.1: "massive pineapple-shaped crown... reads as formal/estate, not
street") for its tower-plaza forecourts, while District B keeps the **Mexican fan palm** (§6.1: "the
iconic LA street palm... mass-planted... 1930s") for its boulevard identity, plus the broadleaf tree
for its non-boulevard blocks. This is a free reinforcement of the districts' silhouette contrast
(§7) at zero extra cost over `DEN-7`'s own minimum ask — it was going to cost one species-swap's worth
of draw calls regardless of which species were chosen, so choosing species that also carry a formal-
vs-boulevard distinction is a strictly better use of the same budget line.

### PROP-9 — Landmark costing cross-reference

This ID is cited from §DA-4, §DB-4, and §MAS-6 for the two district landmarks' draw-call and triangle
pricing. It is not a separate line item in this section's tables because both landmarks are priced
where they are specified — District A's bespoke tower under `MAS-3` and §BGT-1's "district landmarks"
line, District B's sign-mast under `DB-4`/§MAS-6's footnote — rather than duplicated here. Kept as one
ID across three citations so a reader can trace all three without re-deriving the number.

### PROP-3 — Terrain: the hill landmark and subtle relief **[carries `BUD-6`'s own estimate forward]**

`DEN-5` is explicit that "flat is not featureless" and that Phase 1's ground plane genuinely is flat
with zero vertex displacement (`_buildGround()`, confirmed). This document's §5 ground/road merge
already requires subdividing the district-shared ground mesh for float32-precision reasons alone
(`RESEARCH_LA_WORLDBUILDING.md` §9.2) — gentle grade relief riding on that existing subdivision is
close to free, exactly as `DEN-5` argues. One deliberate hill feature (a Griffith-Park-analog rise,
generic-named per the naming constraint — not proposed here, per locked decision 6) serves as a third
silhouette class distinct from both districts and a third sightline anchor alongside the two district
landmarks. **[ESTIMATE, carried from `BUD-6` unchanged — this document does not re-derive it]**: 2–4
main / 2 shadow / 4–6 total, authored once, not per chunk.

### PROP-4 — Section subtotal

| Line | Main | Shadow | Total |
|---|---:|---:|---:|
| World-shared props | 4 | 4 | 8 |
| District A exclusive props | 5 | 4 | 9 |
| District B exclusive props | 8 | 5 | 13 |
| Hill/terrain landmark | ~3 | ~2 | ~5 |
| **Section total** | **~20** | **~15** | **~35** |

---

## 9. Draw-call and triangle budget rollup — BGT-1

**Every figure below is a both-pass total, split shown, per the standing convention.** This table
reconciles this document's actual specification against `RESEARCH_PHASE_2_WORLD.md` §BUD-6's own
itemized estimate, so a reader can see where this spec landed relative to the research document's
planning figures rather than taking a new number on faith.

| Component | Main | Shadow | Total | §BUD-6's estimate | This spec vs. estimate |
|---|---:|---:|---:|---|---|
| Hero | 4 | 4 | **8** | 14 | **Under estimate — ORCHESTRATOR CORRECTION, see note below.** §BUD-6's 14 is the pre-rig Phase 1 figure; locked decision 14 sets the rigged hero at 8 |
| Sky | 0 | 0 | 0 | 0 | Exact match |
| Ground/road (§6) | 8 | 0 | 8 | ~10–16 | **Under estimate** — the centreline fold-into-texture (§6) saves what would have been a separate line |
| Building facade families (§4) | 7 | 7 | 14 | ~12–16 | Inside estimate — 7 families as specified |
| District landmarks (§DA-4/§DB-4) | 2 | 2 | 4 | *(not itemized separately in §BUD-6)* | New line this spec adds — §BUD-6 folded landmark cost into its buildings estimate; this spec prices it explicitly because the landmarks are architecturally distinct (non-batched `Mesh`es, §MAS-3) from the family population |
| Instanced props + terrain (§8) | ~20 | ~15 | ~35 | ~31–39 (props ~27–33 + terrain ~4–6) | Inside estimate |
| **Subtotal, before CSM overhead** | **~41** | **~28** | **~69** | **~67–85 (§BUD-6)** | **Inside §BUD-6's own band, near its lower edge** |

> **⚠️ ORCHESTRATOR CORRECTION, 2026-08-01 — the hero row and this subtotal were changed after
> delivery.** As written, the spec budgeted the hero at **14** calls and cited "decision 14" as its
> authority. **Locked decision 14 says the opposite: 8 calls, explicitly "down from Phase 1's 14."**
> The spec conflated the decision's *number* with a *value*. §BUD-6's 14 is correct for run 1's time —
> it predates the decision — so the estimate column is unchanged; only this spec's own column was
> wrong. Corrected here to 4 main / 4 shadow / **8 total** per §DRAW-2's recommended row (suit, skin,
> accent, cape = 4 material groups), which drops the subtotal from ~75 to **~69** and raises headroom
> from 75 to **81**. **The error was conservative — it over-budgeted, so nothing specified above was
> ever at risk of being unshippable.** Every other line in this table was checked and stands.

**Headroom to the working ceiling: 150 − 69 = 81 calls**, slightly more than `BUD-6`'s own
stated ~65–85-call headroom band (this spec's total sits near that band's lower edge, which is the
comfortable direction to be wrong in). This headroom is explicitly **not this document's to spend** —
per the brief, it is reserved
for `ATM-3`/`BUD-5`'s unmeasured CSM shadow-pass multiplier, and this spec does not treat it as
available slack. Every line above is either **[MEASURED]** (carried unchanged from shipped code —
hero, sky, three of the seven facade families) or **[ESTIMATE]** (this document's own arithmetic,
shown for re-derivation, same as `BUD-6`'s own convention) — none of it becomes a verified number
until `ChunkManager.js`/`District.js`/`CSM.js` exist and `tests/world.test.js`'s method (a real
scene-graph walk, not a manual count) is extended to cover them, exactly as `BUD-6` itself recommends.

**Triangle cost**, separately from draw calls: massing recipes total ~2,376 (§MAS-6), plus whatever
the individual prop/vegetation geometries and the district-shared ground subdivision (§PROP-3, ~512
tri/chunk per `DEN-5`'s own figure) add — all of it small relative to the ~500,000 whole-scene ceiling
(`BUD-7`). Triangles were never this document's binding constraint; draw calls were, per `DEN-2`'s own
framing, and this rollup reflects that throughout.

---

## 10. Priority order — so cuts are this document's decision, not the Engineer's

Highest visual return first. If budget pressure appears once CSM lands (the one real open multiplier,
per `ATM-3`/`BUD-5`), cut from the bottom of this list, not by guessing.

1. **Facade families (§4) and massing recipes (§5).** Do not cut. This is the direct answer to
   `DEN-1`'s diagnosis — the "blocky and rigid" complaint is a geometry-and-material problem, and
   these two sections are the fix. Cutting either regresses the document's central purpose.
2. **Ground/road district-merge compliance (§6).** Do not cut, and not optional — a spec that fails
   `BUD-2`'s requirement is unshippable by the brief's own words, not merely lower priority.
3. **The two district landmarks (§DA-4/§DB-4).** Do not cut. `DEN-6` calls landmark placement "the
   cheapest lever in the whole density section" for a reason — 4 calls total buys the single most
   legible "this is a real, distinct place" signal in the entire document, visible from anywhere in
   the built world per `DEN-6`'s GTA V citation.
4. **Primary vegetation species (Canary palm / Mexican fan palm, §PROP-2).** Keep. Cheap (8 calls for
   both districts' primary species) and it is also carrying district-differentiation weight (§PROP-2),
   not just "the world has trees."
5. **Rooftop HVAC + parapet coping ring (§8, District A).** Keep. Reuses a proven, already-shipped
   mechanism (the exact fix that made the helipad visible, `KNOWLEDGE_BASE.md` §6) at 4 calls total.
6. **Storefront awnings + blade signs (§8, District B).** Keep. 2 calls total, no shadow cost, and
   this is `DEN-4`'s and §5.5's most directly cited technique for the boulevard corridor's identity.
7. **Streetlamps + small props + parked cars (world-shared, §8).** Keep. 8 calls for three categories
   that read everywhere in the built world, not just one district.
8. **Broadleaf shade tree + utility poles (§8, District B).** Keep, moderate priority. 4 calls; answers
   `DEN-7`'s explicit "not every district should read as palm-only" note.
9. **Hill/terrain landmark (§PROP-3).** Keep if budget allows; first real cut candidate under CSM
   pressure. `DEN-5` calls this "a genuine opportunity, cheaply" but — unlike items 1–3 — nothing
   about the two-district pairing itself depends on it existing this phase.
10. **Cut-priority tier, in order: café/market props (1 call) → loading-dock bollards (1 call) →
    scaffolding/construction storytelling (2 calls).** Total 4 calls instantly reclaimable. `DEN-8`
    itself frames these as "an authoring discipline... not a system" — the least load-bearing items
    in this entire document, included because they are cheap and genuine, not because they are
    required.
11. **FAM-3 ("Light Silver-Glass Accent") and MAS-2 ("Twin Setback Ziggurat") variety, if authoring
    time rather than draw-call budget is the binding constraint.** These add generational/silhouette
    variety within District A but the district reads correctly (as a plateau) on FAM-1/MAS-1 alone —
    this is the one place in the document where the *authoring* cost (designing a second and third
    family/recipe) is a more plausible reason to cut than the *rendering* cost, which is why it is
    called out separately from the draw-call-ordered list above.

---

## 11. What I could not answer

1. **Whether `BatchedMesh` in the installed `three@0.185.1` supports a per-instance material override
   within one batch**, which would let a landmark (§MAS-3) live inside its family's `BatchedMesh`
   rather than needing a dedicated `Mesh` at +2 calls. `RESEARCH_PHASE_2_WORLD.md` §LOD-2 confirms
   `addGeometry`/`addInstance`/`setGeometryAt`/`optimize`/`dispose` are all present and correctly
   implemented, but did not specifically check multi-material support, and this document — reading,
   not writing code — did not either. If it is supported, §BGT-1's "district landmarks" line (4 calls)
   could shrink to zero, since the landmark's bespoke geometry/atlas could join its family's batch as
   one more instance. Worth a five-minute Engineer-side check before implementation rather than
   assuming either answer.
   > **SETTLED 2026-08-01 by Review (`RVW-7`), and independently re-verified by the orchestrator.**
   > **There is NO per-instance material override.** `BatchedMesh`'s constructor takes a single
   > `material` for the whole batch (`node_modules/three/src/objects/BatchedMesh.js:192`), its
   > per-geometry `geometryInfo` record carries no material index field (`:632`), and the render
   > path unconditionally reads `_mesh.material = this.material` (`:1390`). **So the landmark's
   > dedicated `Mesh` at +2 calls both passes is load-bearing, not a placeholder** — the 4-call
   > district-landmarks line in §BGT-1 stands as budgeted and cannot be deleted. This also settles
   > the dependency **locked decision 19** created when the user chose a sculpted crown for District
   > A's landmark: the crown cannot join its facade family's batch, so it costs its own `Mesh`.
2. **Real per-district building and prop counts.** This document inherits `BUD-3`'s 30–50-per-district
   planning figure unchanged (§MAS-6 explicitly labels it `[ESTIMATE, INHERITED]`) — no source gives
   an authoritative count for an as-yet-unauthored district, and every recipe-share percentage and
   triangle total in §5 and §8 is downstream of that same planning assumption.
3. **CSM's real shadow-pass overhead**, unmeasured per `ATM-3`/`BUD-5`, and therefore whether this
   document's ~69-call subtotal genuinely survives inside the 81-call headroom it currently has
   (figures per §BGT-1's orchestrator correction; as delivered this read ~75 and 75). This
   is the single most consequential unknown carried forward from the research document, and nothing
   in this design pass can close it — it requires `CSM.js` to exist.
4. **Whether the curb thin-geometry-across-cascade-boundaries risk this document names (§6) would
   actually produce acne if shadows were ever turned on for it.** Not measurable without CSM existing;
   flagged as a reason to *keep* the existing no-shadow convention, not as a solved problem.
5. **Whether District A's 150 m landmark and District B's 75 m sign-mast feel right at this project's
   actual world scale** (a 2,048–4,096 m built world, per the compression `ATM-4`/`DEN-6` already
   establish this project accepts). This is a feel question a static design pass cannot resolve —
   flagged for a browser look once either exists.
6. **Per-species street-tree percentages beyond the three named palm species** (`RESEARCH_LA_WORLDBUILDING.md`
   §8(d), inherited gap, not attempted here either — `PROP-2`'s district-differentiation argument
   holds with the species already confirmed, so this does not block the recommendation, only refine
   it).

---

## 12. What needs a user decision

Consolidated so the orchestrator has one list, per the brief's own convention (both research
documents' equivalent sections were the most immediately useful part of each).

1. **District A landmark cap style (§DA-4).** This spec keeps the 150 m landmark flat-topped, per
   §3.3's ordinance, for internal consistency with every other District A tower. The alternative —
   giving the landmark alone a sculpted, non-flat crown to visually mark it as a newer-generation
   building (the real post-2014, post-ordinance-change pattern `RESEARCH_LA_WORLDBUILDING.md` §3.3
   itself documents, "Post-2017 towers (Wilshire Grand) = sculpted/spired crowns") — would be more
   historically accurate for a single exempted building but breaks the "every roof is a legible
   helipad" read this document otherwise holds district-wide. Flagged as a genuine either-way call,
   not decided here.
2. **District B landmark identity: sign-mast vs. building (§DB-4).** This spec recommends a sign/
   observation mast over a landmark building, for both authenticity (§5.9) and cost reasons. `MAS-3`
   is kept as a fallback recipe if this recommendation is overturned. Either way, **the landmark's
   actual name, signage text, and specific art are the user's per locked decision 6** — nothing here
   proposes them.
3. **The vegetation species reallocation (§PROP-2)** — swapping District A from Phase 1's shipped
   Mexican fan palm to a new Canary Island date palm, while District B keeps the Mexican fan. This is
   a deliberate district-differentiation choice this document makes, not a change `RESEARCH_PHASE_2_WORLD.md`
   asked for — worth confirming rather than silently accepting, since it is a real change from what's
   currently on screen in Phase 1's one block.
4. **§MAT-1's implication carried forward**: now that the environment map is confirmed live (not the
   state `FACADE_VARIANTS`'s own code comment still describes), is a Phase 2 pass — this one, or a
   later one — welcome to also nudge the *shipped* `towerShared`/`midriseA`/`midriseB` constants
   toward more glassiness, the way `KNOWLEDGE_BASE.md` §2 says remains available? This document
   deliberately left those alone (§FAM-1/FAM-6/FAM-7 are unchanged reuses) to avoid re-opening a
   browser-verified result without cause, but the option is real and this is the moment it would be
   cheapest to act on it, if wanted.

---

*End of Phase 2 Design Spec, Districts run.*


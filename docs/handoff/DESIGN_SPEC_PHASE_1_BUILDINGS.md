# Design Spec — Phase 1, Buildings

**Author:** Design agent, first run. **Subject:** buildings only — no hero/character content.
**Status:** ready for Review (budget/feasibility gate only — not a vote on taste).
**Reads against:** `kodaman3d/src/world/StreetBlock.js` (583 lines, read in full) as it stood at
the start of this run. Every geometry and colour reference below is to that file's current
state; `_makeFacadeMaterial()` (lines 311–362) and `scaleBoxUVs()` (lines 533–558) are the two
functions this spec rewrites the behaviour of, not necessarily the literal code.

## Brief in one paragraph

The user's verdict: "the overall look feels good but I want it to look more realistic." Ten
`BoxGeometry` buildings, three shared canvas-texture materials, flat single-colour roofs. This
spec spends the draw-call-free lever (richer canvas textures, roughness/metalness maps, palette
variety) as hard as it goes, and asks for exactly four new draw calls — all `InstancedMesh`,
all covering every relevant building in one call apiece — for the handful of things a texture
genuinely cannot fake: rooftop silhouette, awning projection, sign profile.

---

## Draw-call ledger

| Step | Item | Draw calls added | Running total |
|---|---|---|---|
| — | Baseline, measured at session start | — | **45** |
| 1 | Palette/material rework (roughness+metalness maps, glass-vs-stucco split) | 0 | 45 |
| 2 | Canvas texture rework — resolution, window bevel, band decoupling, variants | 0 | 45 |
| 3 | Bespoke landing-tower (`building_tower_2`) rooftop atlas material | 0 (replaces its existing call) | 45 |
| 4 | **G1** — rooftop parapet coping, all 10 buildings, 1 `InstancedMesh` | +1 | 46 |
| 5 | **G2** — rooftop HVAC blocks, all 10 buildings, 1 `InstancedMesh` | +1 | 47 |
| 6 | **G3** — ground-floor awnings, 8 low/mid-rise buildings, 1 `InstancedMesh` | +1 | 48 |
| 7 | **G4** — vertical blade signs, 4 mid-rise buildings, 1 `InstancedMesh` | +1 | **49** |

**Result: 49 / 60. Eleven calls of headroom remain for the character pass.** Steps 1–3 are the
majority of the visual delta and cost nothing; steps 4–7 are the only spend, ordered so that if
Review or the budget forces a cut, **cut from the bottom of this table first** (§ Priority order
restates this as the authoritative cut order).

Triangle cost of the four new items: 120 + 264 + 96 + 48 = **528 triangles**, against a
whole-scene ceiling of ~500,000 (`RESEARCH_FINDINGS.md` §A4). Not a binding constraint at this
scale — noted for completeness, not because it does any work here.

---

## Priority order (also the cut order, read bottom-up)

1. **Roughness/metalness maps + glass-vs-stucco material split** (0 calls) — currently all
   three building kinds share nearly identical `roughness:0.85, metalness:0.05`, so a glass
   tower and a stucco low-rise respond to light identically. This is the single highest-return,
   zero-cost fix in the whole spec.
2. **Window bevel + higher-resolution canvas** (0 calls) — turns flat rectangles into things
   that read as inset glazing.
3. **Palette variants + roof/spandrel colour decoupled from wall colour** (0 calls) — breaks
   the "ten boxes, three textures" monotony and stops rooftops being tinted the same hue as the
   wall beneath them.
4. **Bespoke landing-tower rooftop** (0 net calls) — concentrated effort on the one rooftop
   acceptance criterion 20 guarantees the player inspects up close.
5. **G1 rooftop parapet** (+1 call) — cheapest of the four geometry items, reads at flight
   altitude across the whole block.
6. **G2 rooftop HVAC blocks** (+1 call) — completes the flat-roof read; pairs directly with G1.
7. **G3 ground-floor awnings** (+1 call) — pedestrian-eye-level detail; lower return than 5–6
   because the player spends less time at that eye height than airborne.
8. **G4 vertical blade signs** (+1 call) — pure flavour, narrowest research grounding of the
   four (a density claim about one specific historic district applied to an invented block).
   **Cut this first** if Review or a later pass needs the call back.

Items 1–4 should never be cut on budget grounds — they cost nothing. If they are cut it can only
be for implementation-complexity reasons, which is outside Review's mandate per the charter (its
gate is calls, triangles, renderer features, and locked decisions — not effort).

---

## Assumptions not sourced from research — flagged, not blocking

`RESEARCH_LA_WORLDBUILDING.md` gives building *heights* but no floor-to-floor storey height or
structural bay width. Both are needed to compute real window-row/column counts for the bespoke
tower texture (§ Tier 2). I derived them from the same document's own data rather than
inventing round numbers:

- **Storey height, tower: 3.9 m.** Backed into from §3.1's table: Century Plaza Tower I
  (174.0 m / 44 floors = 3.95 m/floor) is the closest comparator in the table to our 90 m
  tower — closer than the supertalls (Wilshire Grand: 4.59 m/floor; U.S. Bank: 4.25 m/floor),
  which are taller and carry proportionally more services per floor.
- **Bay width, all kinds: 3.0–3.4 m.** Not sourced — a conventional commercial curtain-wall
  structural bay. If this is wrong it is wrong by a small, purely cosmetic margin (window count
  per face), not a functional one.

Neither is worth pausing for; both are stated as concrete numbers below so the Engineer isn't
left to guess, and both are cheap to retune later if someone finds a better source.

---

## Palette

Hex values, sRGB, matching the codebase's existing convention of authoring colour as a JS number
(`0xRRGGBB`) fed to `THREE.Color`.

| Name | Hex | Applies to |
|---|---|---|
| Lowrise stucco A (cream) | `0xd9c6a0` | Wall base, lowrise variant A |
| Lowrise stucco B (ochre) | `0xc2a06e` | Wall base, lowrise variant B |
| Lowrise trim (dark wood) | `0x4a3c28` | Window bevel shadow tone source, variant A |
| Lowrise trim (darker wood) | `0x3a2e1c` | Window bevel shadow tone source, variant B |
| Midrise steel-blue glass | `0x8f96a3` | Wall base, midrise variant A (unchanged from current) |
| Midrise smoked bronze glass | `0x8a7a68` | Wall base, midrise variant B |
| Window glass, cool | `0x1f2c3a` | Window fill, midrise A / tower shared |
| Window glass, warm bronze | `0x2e2519` | Window fill, midrise B |
| Window glass, lowrise | `0x293b4d` | Window fill, both lowrise variants (unchanged hue family from current `0x2b3a4a`) |
| Tower dark glass (shared, `building_tower_8`) | `0x6f7b8c` | Wall base, the one non-bespoke tower (unchanged from current) |
| Roof/spandrel neutral, lowrise | `0xb8a888` | Decoupled roof + inter-floor band colour, lowrise (was `shade(wallColor,0.82)`, now independent) |
| Roof/spandrel neutral, midrise | `0x6a675f` | Decoupled roof + inter-floor band colour, midrise |
| Roof/spandrel neutral, tower (shared) | `0x4a4844` | Decoupled roof + inter-floor band colour, `building_tower_8` |
| Roof tar/gravel base, bespoke tower | `0x3d3a36` | `building_tower_2` roof art region base fill |
| Roof gravel speckle (light) | `0x55504a` | Bespoke tower roof, scattered speckle, see § Tier 2 |
| Roof gravel speckle (dark) | `0x2c2925` | Bespoke tower roof, scattered speckle |
| Helipad ring/H | `0xd9c840` (ring), `0xe8e4d6` (H glyph) | Bespoke tower roof art only |
| Parapet coping (all buildings, G1) | `0x6b6a62` | Rooftop coping cap, uniform across every building regardless of kind |
| HVAC unit body (G2) | `0x9aa0a6` | Rooftop mechanical block |
| Awning fabric 1 (terracotta) | `0x9c4632` | G3, cycled `index % 3 == 0` |
| Awning fabric 2 (forest green) | `0x39543f` | G3, cycled `index % 3 == 1` |
| Awning fabric 3 (burgundy) | `0x6b2f3a` | G3, cycled `index % 3 == 2` |
| Blade sign body (G4) | `0x1c1c1e` | Vertical sign box |

**Rationale.** The cream/ochre split serves the Spanish Colonial Revival and dingbat stucco
tones of §6.5; the steel-blue/bronze glass split reproduces the "1971–1992… dark glass and
stone-clad boxes" generational note in §3.1 — two buildings from that era would plausibly not
be the identical shade of glass. Decoupling roof colour from wall colour is not aesthetic
whimsy: right now `_makeFacadeMaterial`'s plinth band is `shade(wallColor, 0.82)`, so a cream
stucco low-rise gets a cream-tinted roof, which is physically backwards — real built-up
roofing and rooftop gravel is a neutral grey-brown regardless of the facade colour below it.

---

## Materials

Material class stays **`THREE.MeshStandardMaterial`** throughout — no change from the current
code, and no reason to change it: PBR roughness/metalness is exactly the workflow needed to
separate "glass" from "stucco" response to light, which is the single biggest realism gap today.

| Material | roughness | metalness | emissive | Notes |
|---|---|---|---|---|
| Lowrise (stucco), both variants | **1.0** (see maps, below) | **1.0** (see maps) | none | Was `0.85 / 0.05` flat scalars for *all three* kinds — this is the core fix. |
| Midrise (glass box), both variants | **1.0** (see maps) | **1.0** (see maps) | none | |
| Tower, shared (`building_tower_8`) | **1.0** (see maps) | **1.0** (see maps) | none | |
| Tower, bespoke (`building_tower_2`) | **1.0** (see maps) | **1.0** (see maps) | none | Same scheme, unique texture (§ Tier 2). |
| G1 parapet coping | 0.6 | 0.2 | none | Weathered concrete/metal cap, uniform tone regardless of building kind — real coping/flashing is a utilitarian material independent of the facade under it. |
| G2 HVAC blocks | 0.5 | 0.4 | none | Galvanized sheet metal. |
| G3 awning fabric | 0.85 | 0.0 | none | Cloth; per-instance colour via `instanceColor` (see § G3), material itself needs `vertexColors: true`. |
| G4 blade sign | 0.6 | 0.3 | none | Painted metal sign box, unlit — see rationale below on why *not* emissive. |

**Why `roughness:1.0 / metalness:1.0` with maps instead of scalars.** Setting the scalar to 1.0
and letting a `roughnessMap` / `metalnessMap` carry 100% of the per-pixel value (Three.js
multiplies `material.roughness × texture.g`, `material.metalness × texture.g`) is the standard
way to get spatially-varying PBR response from one material without a shader. It costs a second
and third `CanvasTexture` per material — texture memory, not draw calls, exactly the free lever
the charter names. Window regions get low roughness / moderate metalness (reads as glazing that
throws a specular highlight); stucco/wall regions get high roughness / zero metalness (reads as
matte plaster). This is *the* fix for why every building currently looks like the same matte
material regardless of whether it's supposed to be glass or stucco.

**Why no emissive on the blade signs.** Phase 1 lighting is static midday (existing lamp-head
comment, `StreetBlock.js:458`). An emissive sign glowing at noon reads as a bug, not a light. The
value here is pure silhouette — §5.5's "vertical blade signs and projecting marquees… are the
defining silhouette" is about *shape*, not illumination. Emissive night signage is a legitimate
future ask once Phase 2 has a day/night cycle; out of scope here.

---

## Canvas texture specs — Tier 1 (9 of 10 buildings, repeat-wrapped)

Nine of ten buildings — every building except `building_tower_2` (§ Tier 2) — keep the current
architecture: one shared `CanvasTexture` per kind-and-variant, `RepeatWrapping` on both axes,
UV-scaled per building by `scaleBoxUVs()` so a window is the same physical size on every
building regardless of footprint. This is deliberately the *cheap* path — five materials total
(lowrise A/B, midrise A/B, tower shared) instead of ten unique ones — because a repeat-tiled
texture cannot represent a real, non-repeating rooftop (see the note at the end of this section
for why), and nine of these ten rooftops are never inspected up close. Spend precision where the
player actually looks (§ Tier 2); spend cheaply everywhere else.

**Canvas resolution:** 512×512, up from the current 256×256. Free in draw-call terms; costs
roughly 1 MB per RGBA canvas before mipmaps (~1.3 MB with them), ×5 materials for the diffuse
maps and ×5 more each for the roughness and metalness maps (§ Materials) — on the order of
15–20 MB of texture memory total for every building material in the scene. Trivial against a
modern GPU's texture budget; a little more canvas-fill time at scene construction, one-time.

**Layout within the 512×512 canvas** (unchanged in concept from the current code, refined in
content):

- `bandH = size * 0.12` (≈ 61 px): the bottom-of-tile band. Still doubles as (a) the visual
  inter-floor spandrel line that appears at every vertical tile repeat, and (b) the sample point
  the roof/underside UVs are collapsed onto (§ "Why roofs stay flat colour" below). Fill colour:
  the kind's **roof/spandrel neutral** from the palette table, not `shade(wallColor, 0.82)` as
  today — this is the decoupling fix.
- `usableH = size - bandH`, split into `rows = columns` cells exactly as today. **Column counts
  per kind are unchanged** — lowrise 3, midrise 4, tower 5 — because these values are per-*tile*
  density, not per-building: `scaleBoxUVs`'s `uScale = faceWidth / FACADE_TILE_M` (4 m) means
  the *effective* on-building column count is already `columns × faceWidth/4`, e.g. 5 × (20/4)
  = 25 visible columns across the shared tower's 20 m face. That is already a reasonable
  density; the current sparseness read is a false impression from looking at the 256 px tile in
  isolation, not from the built result.
- Window cell fill and jitter: **unchanged formula** (`shade(windowColor, jitter)`,
  `jitter = 0.75 + (hash % 100)/100 * 0.5`, hash from `(r*73856093) ^ (c*19349663)`) — still
  deterministic, still no `Math.random()`. Only the **range widens** to `0.65–1.35` (was
  `0.75–1.25`) for slightly more contrast between windows; some panes should read as catching
  more sun than others.

**New: window bevel.** For each window cell at `(x, y, winW, winH)`, after the base glass fill,
draw four thin edge strokes to fake an inset frame — the single highest-return addition in this
tier, because it is what turns a flat rectangle into something with depth:

- `frameW = 4 px` (scaled from 512; use `Math.round(size / 128)` so it scales automatically if
  resolution ever changes).
- Top edge: `fillRect(x, y, winW, frameW)`, colour `shade(windowColor, min(1.8, jitter * 1.6))`
  — highlight, light catching the top of the frame.
- Left edge: `fillRect(x, y, frameW, winH)`, same highlight colour.
- Bottom edge: `fillRect(x, y + winH - frameW, winW, frameW)`, colour
  `shade(windowColor, jitter * 0.45)` — shadow, underside of the lintel.
- Right edge: `fillRect(x + winW - frameW, y, frameW, winH)`, same shadow colour.

Draw order: base fill, then top, then left, then bottom, then right (so the corners resolve to
whichever of highlight/shadow is drawn last — bottom-right corners read as shadow, which is
correct for an overhead light source).

**Variants.** Each kind gets two wall-colour variants (lowrise A/B, midrise A/B; the shared
tower has only one, since only one building uses it). Assignment is deterministic by the
building's index in `BLOCK.buildings`, alternating within kind in array order:

| Kind | Buildings (index) | Variant order |
|---|---|---|
| lowrise | 0, 4, 5, 7 | A, B, A, B |
| midrise | 1, 3, 6, 9 | A, B, A, B |
| tower (shared) | 8 | — (single material, `building_tower_2` at index 2 is bespoke, § Tier 2) |

**Why roofs stay flat colour in this tier, deliberately.** `RepeatWrapping` means *every* pixel
anywhere in the 512×512 canvas already appears somewhere on the tiled wall — there is no unused
region to hide unique, non-repeating art in without it also smearing across the facade at every
tile repeat. The current code's workaround — collapsing the roof/underside UVs to a single point
inside the band (`scaleBoxUVs`, the `null` face entries) — sidesteps this by sampling one flat
colour rather than a pattern, which is exactly why today's rooftops are a solid colour with no
detail. This spec keeps that mechanism for the nine Tier-1 buildings (just repoints the sampled
colour at the roof/spandrel neutral instead of a wall-tinted shade) and does **not** attempt to
paint a pattern into a repeat-tiled texture — that would require either a second material
(a geometry-group material array, which the existing code comment at `StreetBlock.js:520–525`
correctly identifies as costing one draw call *per face group per building*, i.e. unaffordable)
or the non-repeating atlas approach used for the one bespoke tower below. Real rooftop pattern
detail is reserved for the one rooftop that matters.

---

## Canvas texture specs — Tier 2 (the one bespoke tower, `building_tower_2`)

`building_tower_2` — `{ x: -2, z: 31, w: 20, d: 28, h: 90 }`, the tower acceptance criterion 20
asks a human to fly over *and land on*. It is the only rooftop in the block guaranteed close
inspection, and per §3.3 ("the single most important skyline fact for the game… For a flying
superhero, the flat helipad roofs are also a gift") a painted helipad on exactly this building
is the highest-value single texture asset in this spec. This building gets its **own, unique,
non-repeating `CanvasTexture`** — one material, still one mesh, still one draw call (the one it
already has). The only cost is texture memory and canvas-fill time at startup, both free per the
charter.

**Canvas: 1024×1024, `ClampToEdgeWrapping` on both axes** (not `RepeatWrapping` — this canvas is
laid out once, to this building's exact 20×28×90 m dimensions, and never tiles).

**Region layout** (fractions of the 1024×1024 canvas; all UV assignment below replaces
`scaleBoxUVs`'s per-face scale for this one geometry only — the other nine buildings keep
`scaleBoxUVs` unchanged):

| Region | U range | V range | Pixel size | Maps to | Represents |
|---|---|---|---|---|---|
| A — front/back | `[0.00, 0.50]` | `[0.00, 0.75]` | 512 × 768 | `+Z` and `-Z` faces (both, mirrored — identical art, acceptable since a player never sees both simultaneously) | 20 m wide × 90 m tall |
| B — sides | `[0.50, 1.00]` | `[0.00, 0.75]` | 512 × 768 | `+X` and `-X` faces (both) | 28 m wide × 90 m tall |
| C — roof | `[0.00, 1.00]` | `[0.75, 1.00]` | 1024 × 256 | `+Y` face (and `-Y`, reused — never visible) | 20 m × 28 m roof plan |

**Region A/B window grid.** Real floor count, not a repeat tile: `floors = round(90 / 3.9) = 23`
(storey height sourced in § Assumptions). Row height in canvas pixels: `768 / 23 ≈ 33.4 px`,
**identical for both regions** since both represent the same 90 m of real height — this is
required, not optional, or the floor lines won't align when the player flies around the corner
of the building.

- Region A columns: `round(20 / 3.2) = 6`. Cell size: `512/6 ≈ 85.3 px` wide × `33.4 px` tall.
- Region B columns: `round(28 / 3.2) = 9`. Cell size: `512/9 ≈ 56.9 px` wide × `33.4 px` tall.
- Window fill, jitter range, and bevel: **identical technique to Tier 1** (base fill +
  4-edge-stroke bevel, jitter `0.65–1.35`), window colours from the palette's tower-shared glass
  entries (`0x6f7b8c` wall / `0x16212e` glass) — this building is visually a member of the tower
  kind, just individually detailed.
- Floor-line band: draw a 1-storey-tall spandrel strip every 4th floor row (rows 4, 8, 12, 16,
  20 of 23) at the roof/spandrel neutral tone `0x4a4844`, full width — real curtain-wall towers
  break up 23 identical floors with visible structural bands roughly every fourth floor; without
  this the tower reads as an undifferentiated grid at its full 90 m height.

**Region C — roof art.**
1. Base fill: tar/gravel `0x3d3a36` across the full 1024×256 region.
2. Gravel speckle: for a deterministic scatter of ~400 points (`hash01`-seeded, same technique
   as the palm/lamp placement — no `Math.random()`), draw 3×3 px dots alternating
   `0x55504a` (light) and `0x2c2925` (dark) at 50/50 split by hash parity. This is cheap noise
   that stops the roof reading as a flat computer-generated fill when the player is standing on
   it.
3. Helipad marking, centred in the region (centre of the region = centre of the real 20×28 m
   roof, since UVs map proportionally): a ring of outer radius 90 px / inner radius 78 px in
   colour `0xd9c840` (safety yellow), and inside it the glyph "H" in `0xe8e4d6` (off-white),
   drawn with `ctx.font` bold sans-serif sized to roughly fill the ring's inner diameter. This is
   the single asset in the whole spec most directly tied to the research: §3.3's "hundreds of
   legible, authentic landing pads" is written for exactly this moment.
4. **Do not** paint HVAC units into this texture — they are real geometry instead (§ G2), placed
   with deliberate clearance from the helipad centre. Painting them would be redundant with real
   3D blocks the player can also see in relief and possibly stand near when landed.

**Anisotropy:** bump to 8 for this material (from the shared 4), and to 8 for the Tier-1
materials too — cheap, and legibility of window rhythm at the grazing angles of a flight pass
alongside a tower is exactly what anisotropic filtering buys.

---

## Geometry changes

All four items follow the pattern already established by `_buildPalms()` and `_buildLamps()` in
the existing file: one `InstancedMesh` per item, one draw call regardless of instance count,
per-instance transform (and, for G3, per-instance colour) set via `setMatrixAt` /
`setColorAt` in a loop over `BLOCK.buildings`. Every mesh below gets `castShadow = true` (and
`receiveShadow = true` where it plausibly catches light from above) — consistent with every
other solid object in the scene; verify shadow-map bias still holds with the added geometry
before calling shadows done (the charter flags shadow stability as a hard constraint, not
something this spec can waive, but this is ordinary regression testing, not a new decision).

### G1 — Rooftop parapet coping

**Cost: 1 draw call, 12 triangles × 10 instances = 120 triangles rendered.**

- Geometry: one `BoxGeometry(1, 1, 1)` (unit cube, 12 triangles), instanced 10×, one per
  building in `BLOCK.buildings` order.
- Per-instance transform: `scale.set(b.w - 0.6, 0.45, b.d - 0.6)`,
  `position.set(b.x, b.h + 0.225, b.z)` — inset 0.3 m from each roof edge, 0.45 m tall, base
  sitting flush on the roof plane.
- Material: `0x6b6a62`, roughness 0.6, metalness 0.2, shared across all instances (no per-
  instance colour needed — see § Materials rationale for why this is deliberately uniform).
- **Rationale.** Sourced from §3.3: post-1958 LA high-rises are flat-roofed by ordinance,
  which reads as a hard, parapet-edged silhouette from above and alongside — not a box that
  simply stops. This is the cheapest possible way to stop every rooftop reading as a bare
  extruded box, and it's visible at flight altitude across all ten buildings, not just the one
  with the bespoke texture.

### G2 — Rooftop HVAC blocks

**Cost: 1 draw call, 12 triangles × 22 instances = 264 triangles rendered.**

- Geometry: one `BoxGeometry(1.2, 0.9, 1.2)`, instanced 22×: 2 per low/mid-rise building (8
  buildings × 2 = 16) + 3 per tower (2 towers × 3 = 6).
- Low/mid-rise placement: pseudo-random within the parapet-inset roof area, deterministic via
  the existing `hash01(n)` helper keyed on `(buildingIndex, unitIndex)` — e.g.
  `offsetX = (hash01(seed) - 0.5) * (b.w - 3)`, `offsetZ = (hash01(seed + 1) - 0.5) * (b.d - 3)`,
  `y = b.h + 0.45`.
- Tower placement (both `building_tower_2` and `building_tower_8`): **fixed, not random** — 3
  units clustered toward one corner, e.g. `(b.x + b.w * 0.32, b.h + 0.45, b.z - b.d * 0.32)` and
  two neighbours offset by ±1.5 m along that corner — chosen so that on `building_tower_2`
  specifically they sit clear of the helipad centre (§ Tier 2, region C).
- Material: `0x9aa0a6`, roughness 0.5, metalness 0.4.
- **Rationale.** Every real flat roof in the 1958–2014 LA high-rise generation this spec is
  modelling (§3.3) carries visible mechanical clutter — elevator penthouses, condenser units,
  vent stacks. Bare rooftops read as a game-world tell; a handful of blocks fixes it for
  negligible triangle cost.

### G3 — Ground-floor storefront awnings

**Cost: 1 draw call, 12 triangles × 8 instances = 96 triangles rendered.**

- Geometry: one `BoxGeometry(1, 0.12, 1.4)` (fixed real thickness 0.12 m and projection 1.4 m
  baked into the geometry; only the width axis is scaled per instance), instanced 8×, one per
  low/mid-rise building (`BLOCK.buildings` indices 0, 1, 3, 4, 5, 6, 7, 9 — every building
  except the two towers).
- Per-instance transform: `scale.set(faceWidth * 0.85, 1, 1)` where `faceWidth` is the
  building's street-facing dimension (`b.w` for all ten buildings, since every entry's `w` is
  its boulevard-facing width per the `BLOCK` layout). Position at
  `y = 3.2`, `z = b.z - b.d/2 - 0.7` for north-side buildings (`b.z > 0`, facing `-Z` toward the
  boulevard) or `z = b.z + b.d/2 + 0.7` for south-side buildings (`b.z < 0`, facing `+Z`); `x =
  b.x`. Tilt for the classic awning slope: `rotation.x = -0.26` (north-facing) or `+0.26`
  (south-facing) radians (~15°) — sign chosen so the leading edge drops toward the sidewalk on
  each side; a cosmetic call the Engineer can adjust on sight if it reads wrong for a given
  orientation.
- Per-instance colour: enable `vertexColors: true` on the material, then
  `mesh.setColorAt(i, color)` cycling the three awning fabric colours by `i % 3` in
  `BLOCK.buildings` array order (not filtered-array order, so the same building always gets the
  same colour run to run).
- Material: roughness 0.85, metalness 0.0.
- **Rationale.** §6.5's dingbat and mini-mall typologies are both ground-floor-retail-forward,
  lot-line-to-lot-line forms; a bare glazed ground floor with nothing projecting over the
  sidewalk under-sells that. Fabric colour variety (three cycled tones) is what stops eight
  identical canopies reading as one asset copy-pasted eight times.

### G4 — Vertical blade signs

**Cost: 1 draw call, 12 triangles × 4 instances = 48 triangles rendered.**

- Geometry: one `BoxGeometry(0.15, 2.5, 0.6)` (thin front-on profile, 2.5 m tall, 0.6 m deep —
  the "blade" projects perpendicular to the facade), instanced 4×, one per **mid-rise** building
  only (`BLOCK.buildings` indices 1, 3, 6, 9).
- Per-instance transform: mounted at the street-facing corner nearest the boulevard centreline —
  `x = b.x - b.w/2 + 0.8` (or `+ b.w/2 - 0.8`, alternate by building for visual variety rather
  than every sign on the same side), `y = 4.2` (spans roughly 3.0–5.5 m, well above head
  height), `z` = the building's boulevard-facing plane ± 0.5 m projection, same north/south
  logic as G3.
- Material: `0x1c1c1e`, roughness 0.6, metalness 0.3, no per-instance colour needed.
- **Rationale.** §5.5: "12 theatres in 6 blocks = 2 marquees per block, both sides. Vertical
  blade signs and projecting marquees over the sidewalk are the defining silhouette." Four signs
  across ten buildings approximates that density without literally claiming this is Broadway —
  the block has no named businesses (locked — `StreetBlock.js:35–38`), so this is silhouette
  only, no signage text or graphics. Lowest-priority item in this spec: narrowest research
  grounding (one specific historic district's density, applied to an invented block) and the
  smallest visual return of the four geometry items. **Cut this first** if the budget needs the
  call back.

---

## What this spec deliberately does not touch

- **Street geometry, curb relief, collision** — locked, per the charter and the file's own
  header comments. Not evaluated, not proposed against.
- **The hero** — out of scope this run per the brief; B5 (flight limb pose) is still open and
  this spec does not depend on or reference its resolution.
- **Lighting rig / time of day** — Phase 1's static midday sun is assumed throughout (no
  emissive signage, no lit windows). §6.3's marine-layer and §6.4's sun-angle material are
  read but not spent here; they matter once a day/night or weather system exists to drive them,
  which is not this run.
- **Palm and lamp geometry** — already instanced, already reasonably detailed for Phase 1;
  not part of the user's "buildings" framing for this pass.

---

## Handoff to Review

No constraint in the charter's table is broken by this spec: renderer stays WebGL/classic
materials (`roughnessMap`/`metalnessMap`/`instanceColor` are all ordinary `MeshStandardMaterial`
+ `InstancedMesh` features, not TSL, not WebGPU-only); no imported meshes or external art files
(every new object is a primitive `BoxGeometry`, every new texture is `CanvasTexture`); street
geometry, curb relief, and collision are untouched; no character IP question arises since this
run is buildings-only. The one geometry change with any real subtlety — the bespoke
`building_tower_2` material switching from `RepeatWrapping`/shared to `ClampToEdgeWrapping`/
unique — is a material swap on an existing mesh, not a new draw call, and is explained in full
in § Tier 2 including *why* the other nine buildings deliberately don't get the same treatment.

Nothing in this spec required an escalation to the orchestrator. The two constants not sourced
from research (§ Assumptions) are flagged, not hidden, and are cheap to correct later if
disputed.

**Total ask: 4 new draw calls (45 → 49), 528 triangles, texture memory only for everything
else.** Eleven draw calls remain of the fifteen-call budget for whatever the character pass
needs.

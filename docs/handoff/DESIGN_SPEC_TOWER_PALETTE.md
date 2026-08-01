# Design Spec — Tower Palette Delta

**Author:** Design agent, follow-up run. **Subject:** the dark tower facade only — a delta
against `DESIGN_SPEC_PHASE_1_BUILDINGS.md`, not a rewrite of it.
**Status:** ready for Review (feasibility gate only).
**Reads against:** `kodaman3d/src/world/StreetBlock.js` (1519 lines) as it stands today —
specifically `TOWER_ATLAS` (293–338), `FACADE_VARIANTS.towerShared` (203–212), the shared
`FRAME_ROUGH`/`FRAME_METAL`/`BAND_ROUGH`/`BAND_METAL` constants (216–231), `_makeFacadeMaterial`
(582–672), `_makeBespokeTowerMaterial` (684–749), and `paintWindowCell` (1425–1451). Also read:
`kodaman3d/src/world/Sky.js` (lights) and `kodaman3d/src/core/Renderer.js` (tone mapping) —
confirmed by search, not by reading the whole files.

---

## Diagnosis: this is a lighting-response mechanism, not a colour-picking mistake

Two facts about the rig, both confirmed by search, neither present in the previous spec's
reasoning:

1. **There is no environment map anywhere in the codebase.** No `scene.environment`, no PMREM,
   no `RoomEnvironment`, no material sets `.envMap`. `scene.background` is a flat `THREE.Color`.
2. **Lighting is exactly two sources** (`Sky.js`): a `DirectionalLight` (`0xfff4e0`, intensity
   2.5) and a `HemisphereLight` (sky `0x9fc4e8`, ground `0xb9a887`, intensity 0.6). No
   `AmbientLight`, no point lights.
3. **Tone mapping is ACES Filmic** (`Renderer.js:44-46`, exposure 1.0), which compresses the
   low end of the brightness range hard — small differences in already-dark input radiance
   collapse toward true black much faster than the same delta would in the midtones.

Combine these with how `MeshStandardMaterial` actually computes light: **indirect specular
(the "shiny surface catching the sky" term) comes from an environment map, full stop.** With
none present, a metallic surface's indirect specular contribution is exactly zero — not dim,
zero — regardless of roughness. What's left is direct diffuse (`albedo × (1 − metalness) ×
N·L × light colour`, from the sun and hemisphere fill) plus a narrow, easy-to-miss glint where
the sun's own specular lobe happens to align with the camera. **`metalness` in this rig doesn't
add reflectivity — it subtracts diffuse and gives nothing back.** A dark-albedo, high-metalness
material is not "glass that catches the sky." It is a surface with almost no diffuse response
and no indirect specular to compensate: exactly the near-black void reported.

**Why the tan mid-rise escapes this and the tower doesn't**, even though their `wallRough` /
`wallMetal` / `winRough` / `winMetal` are nearly identical (midrise 0.45/0.4/0.12/0.65 vs. tower
0.4/0.45/0.1/0.7, `StreetBlock.js:183-212`): the mid-rise's base albedo is meaningfully lighter
— wall `0x8f96a3` (143,150,163) vs. tower `0x6f7b8c` (111,123,140); window `0x1f2c3a` (31,44,58)
vs. tower `0x16212e` (22,33,46), the tower window nearly half as bright per channel. The
diffuse term (`albedo × (1 − metal)`) starts from a darker number and gets the same
metalness-tax applied, landing it inside ACES's crush zone while the mid-rise's stays just
outside it. **This is squarely "the dark end of the palette fails," as diagnosed** — the
technique (canvas-based roughness/metalness split) is sound; the specific numbers chosen for
the darkest kind weren't survivable under a no-envMap rig.

---

## Real-world reference

`RESEARCH_LA_WORLDBUILDING.md` §3.1's own note — "1971–1992… dark glass and stone-clad boxes" —
describes real reflective curtain-wall towers of exactly this era (dark bronze and blue mirrored
glazing). Even the darkest commercial reflective glass in real use (roughly 6–8% visible light
transmittance) still reflects on the order of 20–30% of incident sky light off its outer coated
pane. That glass reads as a moody, saturated, *coloured* mirror — never a flat black void. The
fix below is aimed at exactly that reference: keep the tower the darkest, most saturated kind in
the block, but stop it from having a diffuse response that renders as absent.

---

## The fix — four numbers, one object

All four changes are inside `FACADE_VARIANTS.towerShared` (`StreetBlock.js:203-212`), the single
spec object both towers consume — `building_tower_8` (index 8, shared repeat-tiled material)
directly, and `building_tower_2` (index 2, the bespoke atlas) via
`_makeBespokeTowerMaterial`'s `const spec = FACADE_VARIANTS.towerShared;` (line 690). **One
object, both towers fixed.**

| Field | Before | After | Δ |
|---|---|---|---|
| `wall` (hex) | `0x6f7b8c` — (111,123,140) | **`0x828fa0`** — (130,143,160) | +14–17%/channel |
| `window` (hex) | `0x16212e` — (22,33,46) | **`0x32475e`** — (50,71,94) | +104–127%/channel |
| `wallMetal` | `0.45` | **`0.32`** | −29% |
| `winMetal` | `0.70` | **`0.50`** | −29% |

**Everything else in the object is unchanged: `wallRough: 0.4`, `winRough: 0.1`, `columns: 5`,
`band: 0x4a4844` stay exactly as they are.** Roughness controls the *size and sharpness* of the
specular lobe, not whether it exists — since indirect specular is already zero with no envMap,
touching roughness would change the tower's glint character (currently the tightest, most
mirror-like of any kind, correctly) without fixing the brightness problem. Leaving it alone also
keeps the tower the glossiest kind in the block, which is the one part of its current identity
that already reads correctly and shouldn't move. `band` is unchanged because it's already
low-metal (`BAND_METAL = 0.05`, module-level, `StreetBlock.js:230`) and isn't implicated in the
failure — the "near-black, no light response" report is about the wall and window regions, both
of which sit at `metalness ≥ 0.45` today.

**Why metalness and albedo together, not one alone.** Cutting metalness alone (more diffuse
multiplier, same dark colour feeding it) or lightening albedo alone (a brighter number still
multiplied by `1 − 0.7 = 0.3`) each leaves meaningful risk of staying inside ACES's crush zone —
neither move is enough on its own given how hard that compression bites near zero. Doing both at
once is what reliably clears it. As a linear-space sanity check (sRGB 0–255 units, a proxy for
relative magnitude, not exact renderer math): the window's `albedo × (1 − metal)` product goes
from `22 × 0.30 = 6.6` to `50 × 0.50 = 25` — **roughly 3.8×**. The wall's goes from
`111 × 0.55 = 61.05` to `130 × 0.68 = 88.4` — **roughly 1.45×**. The window needed (and got) the
larger jump because it was the more severe half of the "pure-black window voids" complaint.

**Why metalness lands below the mid-rise's (0.50/0.32 vs. midrise's 0.65/0.4) despite the tower
being the more "glass" typology.** This is a deliberate, physics-forced trade, not an oversight:
under a no-envMap rig, the metalness ceiling a material can carry before crushing to black is a
function of how bright its albedo is allowed to be. The tower's albedo is intentionally darker
than the mid-rise's — that's the whole point of it being "the dark tower" — so it cannot sustain
the mid-rise's metalness level without recrushing. Glassiness here is carried by the low,
unchanged `winRough: 0.1` (tighter highlight than the mid-rise's 0.12) and by the surviving
`0.50` metalness (still well above the low-rise window's `0.45` and far above any wall's), not by
out-metal-ing the mid-rise on a scalar the player never compares side by side.

---

## What changes in the canvas texture drawing: nothing

No code change to `paintWindowCell`, `_paintFacadeRegion`, `_makeFacadeMaterial`, or
`_makeBespokeTowerMaterial`. Every one of those functions already reads colour and
roughness/metalness from the `spec` object rather than a hardcoded literal, so the four
constant edits above propagate automatically through the existing pipeline:

- The window base fill (`shade(spec.window, jitter)`) picks up the new lighter blue.
- The bevel highlight and shadow strokes (`shade(spec.window, jitter * 1.6)` and
  `shade(spec.window, jitter * 0.45)`, `paintWindowCell`) scale off the same new base colour, so
  the inset-glazing read stays intact with no separate edit.
- The roughness/metalness canvases fill with `grey(spec.wallMetal)` / `grey(spec.winMetal)`
  (module-level `grey()`, `StreetBlock.js:1491`) — these are flat per-region fills, not painted
  patterns, so changing the two numbers is the entire edit. Per the material setup
  (`_makeFacadeMaterial`, `_makeBespokeTowerMaterial`), `material.roughness` and
  `material.metalness` scalars stay at `1.0`/`1.0` throughout — unchanged — so the map values
  above **are** the effective per-pixel roughness/metalness the renderer uses. Since these maps
  are plain neutral-grey canvases (`grey()` writes equal R/G/B), it is moot whether
  `metalnessMap` reads blue and `roughnessMap` reads green — both channels already carry the
  identical value.

Both towers' spandrel bands (`_paintFacadeRegion`'s `if (floor % 4 === 0)` branch and the
Tier-1 plinth band in `_makeFacadeMaterial`) already source `band`/`BAND_ROUGH`/`BAND_METAL`
unchanged from this edit, so no separate band handling is needed.

---

## Before/after reasoning

**Now:** the tower wall and window regions sit at `metalness 0.45`/`0.70` with albedo roughly
half the brightness of the mid-rise's. With zero indirect specular available (no envMap) and
ACES crushing the resulting low diffuse output further, both regions render as close to black
outside the sun's narrow direct-specular glint — exactly "near-black… pure-black window voids…
almost no light response across the surface."

**After:** `wallMetal 0.32` / `winMetal 0.50` restore a diffuse multiplier the sun and
hemisphere fill can actually push visible light through, and the brighter, more saturated blue
albedo (`0x828fa0` wall, `0x32475e` window) gives that diffuse channel something worth seeing —
a legible, moody blue-grey rather than navy-black. The tower stays the darkest, glossiest kind
in the block (unchanged low roughness preserves its tight mirror-like highlight), it just no
longer depends on a lighting feature (indirect specular / envMap) that doesn't exist in this
scene to be visible at all. That reads as **dark tinted curtain-wall glass** — the real-world
reference above — rather than an absent surface.

---

## Draw-call cost: zero

This delta edits four numeric fields inside the existing `FACADE_VARIANTS.towerShared` object
literal (`StreetBlock.js:203-212`). No new `THREE.Mesh`, `THREE.InstancedMesh`, geometry, or
material is created; `_makeFacadeMaterial` and `_makeBespokeTowerMaterial` run exactly the code
paths they already run, building the same five Tier-1 materials plus the one bespoke atlas the
scene already has. `renderer.info.render.calls` counts draw *submissions*, not the content of an
existing texture or material scalar — nothing here changes how many objects are submitted in
either the shadow pass or the main pass. **57/60 stands unchanged.**

---

## Scope question for the orchestrator — not assumed, not proposed

If Review or a human pass finds the constants-only fix above still insufficient once seen on a
real GPU, the more physically correct fix is a genuine environment map, so metallic surfaces get
real indirect specular instead of a diffuse-only substitute. This would need to be generated
without an external asset file — e.g. `THREE.PMREMGenerator` baked once at startup from a small
synthetic gradient scene (a sky-colour-to-ground-colour gradient matching the existing
`HemisphereLight` colours, or from `Sky.js`'s own background), assigned to `scene.environment`.
**That is a texture, not a draw call, so it is very likely affordable under the 57/60 ledger** —
but it touches `Renderer.js`/`Sky.js` construction order and scene-wide state, not just
`StreetBlock.js`'s material tables, which is outside this run's mandate (tower palette only).
I am not proposing it now. Flagging it here so it isn't independently reinvented if the
constants-only fix under-delivers.

---

## What this delta deliberately does not touch

- The mid-rise or low-rise palettes — reported as working, not evaluated here.
- Any geometry, draw call, or InstancedMesh from the previous spec (parapets, HVAC, awnings,
  blade signs) — untouched.
- The bespoke tower's roof art (helipad, gravel speckle) — not part of the "facade reads dead"
  complaint; region C's material is already non-metallic (`grey(0.0)`) and matte
  (`grey(0.95)`), not implicated.
- `FRAME_ROUGH` / `FRAME_METAL` (`StreetBlock.js:221-222`) — shared across all three kinds'
  window-frame bevel, not tower-specific; changing it would also move the low-rise and mid-rise
  frame look, which is out of this run's scope.
- The street, sidewalks, palms, lampposts, and hero — out of scope per the brief.

# Engineer — Phase 1 Close

**Agent:** Engineer (Opus). **Branch:** `feat/3d-open-world`. **Commits:** `a85ea20`, `e26ed25`.
**Subject:** implement `DESIGN_SPEC_PHASE_1_BUILDINGS.md` with `REVIEW_DESIGN_SPEC_BUILDINGS.md`'s
corrections applied (Task 1), and compute the static worst-case draw-call ceiling (Task 2).

**Gates:** `npm test` **95/95** (was 76/76, +19). `npm run build` clean, 25 modules, 593.83 kB /
154.31 kB gzipped. `kodaman_prototype.html` untouched — zero diff. Nothing pushed, `main` not
touched, no PR opened.

**Nothing was cut.** All seven items in the spec's ledger shipped, including G4.

---

## TASK 2 FIRST — the worst-case draw-call ceiling

### The headline numbers

| | Main pass | Shadow pass | **Worst case** |
|---|---|---|---|
| **Before** (commit `2f6ceb4`) | 28 | 21 | **49** |
| **After** (commit `e26ed25`) | 32 | 25 | **57** |
| Delta | +4 | +4 | **+8** |

Both figures are *computed by walking the scene graph with nothing culled*, not measured. The
"after" figure is asserted by a test (`tests/world.test.js`, `describe('worst-case draw calls')`),
so it fails loudly the moment someone adds a draw call. The "before" figure was produced by
restoring the pre-change `StreetBlock.js` from git and running the identical walk over it, so the
two numbers are the same measurement of two revisions — not one measured and one estimated.

### The derivation, and the thing everyone has been missing

**`renderer.info.render.calls` counts TWO passes, not one.** In `WebGLRenderer.render()`:

```
WebGLRenderer.js:1702   if ( this.info.autoReset === true ) this.info.reset();
WebGLRenderer.js:1707   shadowMap.render( shadowsArray, scene, camera );
```

`info.reset()` happens **before** the shadow map is rendered, and `WebGLShadowMap` issues its draws
through the same `renderer.renderBufferDirect` (`WebGLShadowMap.js:537/551`) that increments
`info.update`. So **every shadow caster costs a second draw call.** The design spec's ledger
(45 → 49) counts main-pass objects only; it is not wrong about what it counts, it just does not
count the shadow pass. That is the whole gap between its 49 and this 57.

Everything else in the count is ordinary:

- One call per `Mesh`.
- One call per `InstancedMesh` **regardless of instance count** — the 22 rooftop units are one call.
- `scene.background` is a `THREE.Color`, not a texture, so `WebGLBackground` issues a *clear*, not a
  draw. **The sky costs zero calls.** Two lights cost zero.
- No post-processing (`Renderer.js` says so explicitly), and `PCFSoftShadowMap` — not VSM — so
  there are no extra full-screen blur passes.

**Main pass, 32:**

| Group | Count | Objects |
|---|---|---|
| Ground & road | 7 | `ground`, `roadway`, 2 × sidewalk, 2 × curb, `centreline` (instanced) |
| Buildings | 10 | one `Mesh` each |
| Street trees & lamps | 4 | `palmTrunks`, `palmCrowns`, `lampPosts`, `lampHeads` (all instanced) |
| **New this pass** | **4** | `roofParapets`, `roofUnits`, `awnings`, `bladeSigns` (all instanced) |
| Hero | 7 | torso, head, 4 limbs, cape |
| Sky | 0 | lights + `Color` background |

**Shadow pass, 25:** every object above with `castShadow === true` — the 10 buildings, the 4
street-furniture instanced meshes, the 4 new instanced meshes, and the hero's 7 parts. The
`ground`, the `roadway`, both sidewalks, both curbs and the `centreline` are deliberately excluded
from casting, which is why 32 becomes 25 rather than 32.

### Why the human measured 42 and an earlier reading said 45

Both are consistent with a 49 worst case at the time. `info.render.calls` reports what was
*actually drawn*, so it moves with frustum culling in both passes independently: buildings behind
the main camera drop out of the main pass, and buildings outside the sun's ±60 m orthographic
shadow frustum (`Sky.js:51`) drop out of the shadow pass. 42 and 45 are two camera positions, not
a discrepancy.

### What this means for locked decision 7

**The number to raise the Phase 2 ceiling from is 57, not 49 and not 45.** Three notes for whoever
sets it:

1. **57 still fits under the Phase 1 ceiling of 60,** so criterion 6 holds even in the worst case —
   but with 3 calls of headroom, not the 11 the spec's ledger implies. The character pass cannot be
   budgeted against 49.
2. **The shadow pass roughly doubles the cost of any new casting object.** A Phase 2 budget stated
   as a single number should say which passes it covers, or the same confusion recurs at a larger
   scale. The cheapest Phase 2 lever, if calls get tight, is `castShadow = false` on things whose
   shadows nobody looks at — each one is worth a full call.
3. **Instancing remains free at the margin.** The realism pass added 44 new objects to the world
   for 8 calls. Anything Phase 2 adds in bulk should follow the same pattern.

---

## TASK 1 — what changed and where

Everything is in `kodaman3d/src/world/StreetBlock.js` (583 → 1,511 lines) plus two new test files
(`tests/world.test.js`, 439 lines; `tests/support/canvas2d.js`, 110 lines).
No other source file was touched. The hero was not touched: B5 is done and the body-pitch question
is explicitly out of scope for this run.

### Steps 1–3 — the zero-draw-call work (spec priority 1–4)

**Five facade variants replace three kind materials, each with three canvases instead of one.**
`_makeFacadeMaterial()` now builds a diffuse, a roughness **and** a metalness `CanvasTexture` at
512×512 (was one at 256×256), and the material is `roughness: 1.0, metalness: 1.0` so the maps
carry 100% of the per-pixel value. Stucco is `0.98 / 0.0`, curtain-wall glass is `0.10–0.12 /
0.65–0.70`, window frames are anodised aluminium at `0.55 / 0.30`. Before this pass all ten
buildings shared `roughness: 0.85, metalness: 0.05`, which is why a glass tower and a stucco
low-rise scattered light identically — the spec was right that this is the single highest-return
zero-cost fix in the set.

**Window bevel.** Four edge strokes per pane, highlight on top and left, shadow on bottom and
right, drawn in that order so the bottom-right corner resolves to shadow. Jitter range widened to
0.65–1.35. Still hash-derived, still no `Math.random()`.

**Roof/spandrel colour decoupled from the wall colour** — an independent neutral per kind rather
than `shade(wallColor, 0.82)`, because real built-up roofing is grey-brown whatever colour the
facade beneath it is painted.

**A bespoke 1024×1024 non-repeating atlas for `building_tower_2`** (index 2, the criterion-20
landing target), replacing its shared material on the same mesh — no new draw call. Three regions:
front/back (6 bays × 23 floors), sides (9 bays × 23 floors) sharing the *same* row height so floor
lines meet at the corners, and the 20 × 28 m roof plan carrying tar-and-gravel, a deterministic
400-fleck speckle and a painted helipad. `atlasBoxUVs()` is the new exported counterpart to
`scaleBoxUVs()`.

### Steps 4–7 — the four instanced items (+8 worst-case calls)

| Item | Instances | Colliders? |
|---|---|---|
| **G1** parapet coping | 10 | **Yes** — mandatory, see below |
| **G2** rooftop mechanical units | 22 | **Yes** — deliberate, see below |
| **G3** storefront awnings | 8, per-instance fabric colour | No |
| **G4** vertical blade signs | 4 | No |

**G1 was implemented as the reviewed slab, not as the perimeter ring.** The ring alternative was
raised with the user twice and not selected; substituting it would have been an unrequested design
change, and the collision correction that makes the slab safe is small and now tested.

**G3/G4 are not colliders, deliberately.** Their undersides sit at ~2.96 m and 2.95 m respectively,
clear of the 1.85 m hero, so they can only ever be walked under. Registering them would also feed
them to the camera arm's sphere-cast (`CollisionWorld.spherecast` reads `this.buildings`), which
would yank the camera in every time the player walked past a storefront — strictly worse than the
nothing it would fix.

### The two mandatory corrections

**Review §1 — the helipad ellipse.** Region C allocates 1024 × 256 px to a 20 × 28 m footprint:
51.2 px/m on U (bound to the box's X) against 9.14 px/m on V (bound to its Z) — verified against
`BoxGeometry.js:78`, `buildPlane('x','z','y', 1, 1, width, depth, height, ...)`. The ring and the
"H" are drawn inside `ctx.save(); ctx.translate(cx, cy); ctx.scale(1, 0.17857); … ctx.restore()`,
where `0.17857 = (256/28) / (1024/20)`. A test asserts both the transform and the outcome: the
ring's X and Z radii come out equal to 10 decimal places.

The same 5.6× mismatch applies to the gravel speckle, which the spec sized as 3×3 px dots — that
would land on the roof as 6 cm × 33 cm streaks. The speckle is now authored in **metres**
(`SPECKLE_M: 0.12`) and converted per axis. Same fix, same reasoning, one line.

**Review §2 — the parapet collider.** Every building now registers a **second** `Box3` alongside
its structural one, spanning the slab from `b.h` to `b.h + 0.45` over the inset footprint.
`resolveCapsule` takes the highest surface the feet crossed, so a hero landing anywhere over the
slab settles on the slab. Tested three ways: the landing lands at 90.45 on the tower, the same
landing without the box is 0.45 m lower (pinned so a regression explains itself), and standing on
the parapet top is not shoved sideways by either box.

### The Review's minor corrections

- **§3 `metalnessMap` reads BLUE, not green.** Applied to the material comment, and re-verified
  against the installed 0.185.1 source. Moot in practice here — the maps are separate neutral-grey
  canvases — but the comment now says so and warns against assuming `.g` if they are ever packed.
- **§4 `vertexColors: true` is unnecessary.** Not set. `setColorAt` alone creates `instanceColor`,
  which is sufficient in 0.185.1. The awning material also leaves `color` unset (white), so the
  per-instance colour is not double-tinted.
- **§5 texture memory ≈ 38 MB, not 15–20 MB.** Confirmed by the built result: 18 canvases (5 Tier-1
  variants × 3 maps + 1 bespoke × 3 maps), ~21 MB + ~17 MB. Asserted by test.
- **§6 bay width 3.2 m** is a named constant (`TOWER_ATLAS.BAY_M`) rather than an inline literal.
- **§7 the atlas UV remap formula** is implemented verbatim as given and documented on the function.

---

## Findings — things nobody had noticed

### 1. A pre-existing flipY bug: the plinth band was at the wrong end of the tile

`CanvasTexture` defaults to `flipY = true`, so UV `v = 0` samples the canvas's **bottom** row. The
old `_makeFacadeMaterial` drew the band with `ctx.fillRect(0, 0, size, bandH)` — the canvas **top**,
i.e. `v ∈ [0.88, 1.0]` — while `scaleBoxUVs` collapsed the roof faces onto `v = 0.06`, which is
canvas row ~481 of 512, well outside the band. Two consequences, both live in the shipped build:

- The "plinth band across the bottom of the tile" actually appeared at the **top** of every tile.
- **Rooftops sampled bare wall colour**, not the band colour — which is a large part of why the
  design spec's complaint about flat, wall-tinted rooftops was true.

Fixed by drawing the band at `y = size - bandH`. The sample point `v = 0.06` (canvas y = 481.28)
now lands squarely inside the band `[451, 512]`, and a test pins that arithmetic so it cannot drift
back. The direction convention is now spelled out in three places in the file rather than assumed.

This is the fourth time this codebase has been bitten by a comment asserting the opposite of the
arithmetic, so every new sign and axis in this change names its direction explicitly.

### 2. Review §7's V-direction claim is backwards — conclusion unaffected

The review states BoxGeometry's side faces have "V=1 at the box's bottom, V=0 at its top." It is the
other way round: `buildPlane` is called with `vdir = -1` for all four side faces, so `iy = 0`
produces `y = +heightHalf` (the box's **top**) with `uv.v = 1`. The review's actual conclusion —
that all four side faces share one convention and the atlas remap must be applied uniformly with no
per-face flip — is correct and is what shipped. Recording the correction so the next reader doesn't
inherit the wrong mental model.

### 3. The parapet leaves a 0.3 m lip you slide off — accepted, documented

The reviewed collider is inset 0.3 m per edge, so there is a 0.3 m perimeter band where the feet
rest at `b.h` while the parapet's top is at `b.h + 0.45`. `resolveCapsule`'s horizontal push-out
gate (`position.y + STAND_CLEARANCE >= b.max.y`) therefore treats the parapet as a **wall** there,
and nudges a 0.35 m-radius hero off the edge. Walking off the parapet's inner edge has the same
result: the vertical search finds nothing within `snapTolerance` of 90.45, so the hero starts to
fall and is then pushed clear.

**Accepted, not fixed.** It is a 0.3 m band on a 19.4 × 27.4 m roof, it reads as "you walked off a
ledge", and the hero can fly. Fixing it properly means step-up logic in the controller, which
`STREET.SIDEWALK_RELIEF`'s own comment already defers to Phase 2. Written into the code at the
registration site so nobody rediscovers it as a mystery.

### 4. G2 rooftop units ARE colliders — the Review left this to the Engineer

Registered. A player who can land on a roof can walk into a condenser unit, and walking through one
is exactly the game-world tell this pass exists to remove. The cost is 22 more AABBs in a linear
scan of ~42 (nothing), and they all sit 8 m or higher, so they can never affect street-level
movement or pull the camera arm in. The three units on the bespoke tower are placed at **fixed**
offsets rather than hashed ones, specifically so they cannot land on the helipad; a test asserts
they clear the ring by ~9 m.

### 5. The helipad is 3.5 m across — smaller than a real one

The reviewed radii (90 px outer, 78 px inner, on the U axis) work out to a **1.76 m radius / 3.5 m
diameter** marking on a 20 × 28 m roof, once the aspect compensation is applied. That is a legible
marking rather than a real FATO circle (which would be 10–15 m). It is what the spec and review
specify, so it is what shipped — but it is a single constant, `TOWER_ATLAS.HELIPAD_OUTER_PX`, and
the comment above it says so. **This is the one item most likely to want a browser-eye adjustment.**

---

## What was verified, and how

**Verified headlessly, by test (95/95):**

- Criterion 20's landing height, the no-push-out condition, and the 0.45 m regression guard.
- G2 placement: 22 units, deterministic across runs, none overhanging its coping, tower units clear
  of the helipad.
- `atlasBoxUVs`: every face inside its declared region, all four side faces sharing one vertical
  mapping, no facade region intruding on the roof region.
- The `ctx.scale(1, 0.17857)` transform on all three bespoke canvases, in the right order inside a
  `save`/`restore`, wrapping both arcs and the glyph — and the world-space outcome (equal X and Z
  radii).
- The plinth band's canvas rect and the `v = 0.06` sample point landing inside it.
- 18 canvases created, all 18 textures registered in `_disposables`, `dispose()` emptying both the
  collider list and the group (criterion 28's mechanism, though not its runtime behaviour).
- The worst-case draw-call count, and that it is ≤ 60.

**Verified by build:** `npm run build` clean, 25 modules. `kodaman_prototype.html` zero diff.

**NOT verified — no GPU in this environment.** Nothing visual is claimed. Every colour, tone,
shadow, framerate and memory figure below needs a browser.

---

## Human checklist — what still needs a browser

1. **Draw calls (criterion 6).** `F1`. Expect a number in the mid-40s to low-50s in normal play and
   **never above 57**. If you see >57, something is drawing that this analysis did not find.
2. **Frame rate (criterion 5).** 60 fps at 1920×1080. The added cost is 8 draw calls and 528
   triangles; if this moves at all, it is the shadow pass, not the fragment work.
3. **Land on the 90 m tower (criterion 20).** Feet should sit on top of the parapet, not sunk into
   it. Then walk to the roof edge — you should slide off at the coping rather than stand on the
   0.3 m lip. That is expected (finding 3), not a bug to report.
4. **The helipad.** Is the ring a **circle**, not an ellipse stretched along the building's depth?
   And is 3.5 m across big enough to read from the air? If not, raise
   `TOWER_ATLAS.HELIPAD_OUTER_PX` (and `HELIPAD_INNER_PX` with it).
5. **Shadows (criterion 7).** Look for acne or peter-panning on the new geometry specifically —
   parapets and rooftop units are thin boxes sitting on a large flat surface, which is the worst
   case for `shadow.bias`. Current values are `bias = -0.0005`, `normalBias = 0.02` (`Sky.js:62`).
6. **Memory (criterion 28).** `renderer.info.memory.textures` should settle and stay flat. It is
   now ~18 textures higher than before (~38 MB); what matters is that it does not **climb** across
   a few HMR saves.
7. **Glass vs stucco.** The whole point of step 1: do the mid-rises and towers now throw a specular
   highlight the low-rises don't? Fly past a mid-rise and watch the sun move across it.
8. **Rooftops of the other nine buildings.** They should be a neutral grey-brown, clearly *not*
   tinted with the facade colour below (this is finding 1's visible payoff).
9. **Awning tilt on both sides of the boulevard.** The leading edge should drop toward the sidewalk
   on the north side *and* the south side. If one side tilts the wrong way, the sign on
   `AWNING.TILT` is the single place to flip.
10. **Blade signs.** Four, on the mid-rises, alternating corners, projecting over the sidewalk and
    clear of the awnings below.

---

## Open questions — not answered here, deliberately

- **Should the Phase 2 draw-call ceiling be stated per-pass or as a total?** 57 is the total. If it
  is stated as a total, whoever budgets Phase 2 needs to know that a new casting object costs two.
- **The helipad's real-world size** (finding 5) is a taste call with a browser, not an arithmetic
  one.
- **Body pitch from vertical velocity alone** (`LocomotionController.js:507-511`) was explicitly out
  of scope for this run and remains open.

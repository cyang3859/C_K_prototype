# Review — Design Spec, Phase 1 Buildings

**Reviewer:** Review agent. **Subject:** `DESIGN_SPEC_PHASE_1_BUILDINGS.md` (446 lines).
**Scope:** feasibility only — UV/material/geometry buildability, texture memory, collision and
shadow regression risk, locked-decision compliance. No vote on palette, silhouette choices, or
whether blade signs belong on Broadway. Draw-call/triangle ledger (45→49, 528 tri) was
independently verified by the orchestrator before this run and is **not re-derived** here except
where a downstream correction changes an instance count.

**Verdict: APPROVED WITH CORRECTIONS.**

Two findings are real, concrete build defects (§1 and §2) — one would ship a visibly wrong
helipad, the other would visibly break the one landing criterion this spec touches. Both have
exact, unambiguous fixes below that the Engineer can apply directly; neither requires sending
the spec back to Design. The rest are minor prose/arithmetic corrections or confirmations that a
section is fine as written.

---

## 1. [HIGH] Region C (bespoke roof atlas) is anisotropically stretched — the helipad will not be circular

**What's wrong.** The Tier 2 region table (spec lines 268–272) assigns Region C — the roof art,
including the helipad ring and "H" glyph — a canvas allocation of **1024×256 px** representing a
**20 m × 28 m** real footprint (`building_tower_2`'s `w`/`d`). Those two axes are not proportional:

- U-axis (spec's `[0.00, 1.00]`, full canvas width) maps to the box's **X** width (20 m):
  `1024 / 20 = 51.2 px/m`.
- V-axis (spec's `[0.75, 1.00]`, 256 px) maps to the box's **Z** depth (28 m):
  `256 / 28 ≈ 9.14 px/m`.

**Evidence for the U/X, V/Z assignment.** `BoxGeometry`'s `+Y` face is built with
`buildPlane('x', 'z', 'y', 1, 1, width, depth, height, ...)`
(`node_modules/three/src/geometries/BoxGeometry.js:78`) — `u` is bound to `'x'`, `v` to `'z'`,
confirming the roof face's default U spans the box's X-width and V spans its Z-depth, exactly as
`scaleBoxUVs`'s own comment describes for the side faces. The two axes end up **5.6× different in
pixel density** (`51.2 / 9.14 ≈ 5.6`). Computed and confirmed numerically.

**Consequence.** The helipad ring (spec: outer radius 90 px, inner 78 px, drawn presumably via
`ctx.arc` with equal x/y radius — a true circle in canvas-pixel space) will render as an **ellipse
stretched ~5.6× taller along the building's Z-axis than its X-axis** once mapped onto the real
roof — not remotely a circular helipad marking. This is the asset the spec itself calls "the
single asset in the whole spec most directly tied to the research" (line 302) and "the highest-
value single texture asset in this spec" (line 256). It also undercuts the HVAC-clearance
rationale in G2 (line 354), which implicitly assumes a roughly circular exclusion zone around the
helipad centre — a real ellipse elongated toward Z changes what "clear of the helipad" means in
the Z direction.

**Why this is a gap, not a taste call.** The spec's own standard is "implementable without
further interpretation" (`DESIGN_AGENT_BRIEF.md` line 80). As written, an Engineer following the
region table and the "radius 90/78 px" instruction literally will ship the distorted ellipse
without knowing anything is wrong — there is no interpretation step where they'd catch this
themselves; it requires an aspect-ratio arithmetic check the spec doesn't do.

**Correction (drop-in, does not touch region layout, floor counts, or any other Tier 2 number).**
Add one line to § Tier 2, Region C, step 3 (the helipad marking):

> Before drawing the ring and "H" glyph, apply a local vertical compensation to correct for
> Region C's non-uniform pixel density (U: 51.2 px/m over the 20 m width; V: 9.14 px/m over the
> 28 m depth — a 5.6× mismatch, since a 1024×256 px region does not share the aspect ratio of a
> 20×28 m footprint). Concretely: `ctx.save(); ctx.translate(cx, cy); ctx.scale(1, 0.17857);` (the
> factor is `(256/28) / (1024/20)`), draw the ring (`ctx.arc(0, 0, 90, ...)` outer,
> `ctx.arc(0, 0, 78, ...)` inner) and the "H" glyph inside that transform, then `ctx.restore()`.
> This makes the marking a true circle once mapped onto the real roof; drawn without the
> compensation it renders as an ellipse ~5.6× taller (Z) than wide (X).

(Equivalently: pre-compute `ry = rx * 0.17857` per radius and skip the canvas transform — either
is fine, the transform is less error-prone since it also correctly squashes the glyph.)

---

## 2. [MAJOR] G1 rooftop parapet is a solid slab with no matching collision update — regression risk against criterion 20

**What's wrong.** G1 (spec lines 325–340) is specified as **one `BoxGeometry(1,1,1)` scaled to
`(b.w - 0.6, 0.45, b.d - 0.6)`** — i.e. a single solid box covering the *entire* roof footprint
minus a 0.3 m inset on each edge (97%+ of the roof area for every building, including
`building_tower_2`, `w=20, d=28`), sitting from `y = b.h` to `y = b.h + 0.45`. This is not a
perimeter coping ring (a real parapet is a low wall around the *edge* of a roof, open in the
middle) — as specified it is a raised platform covering almost the whole roof.

**Evidence this breaks collision.** Building colliders are registered once, in `_buildBuildings()`
(`StreetBlock.js:293–298`), as a single `Box3` per building with its top at exactly `y = b.h`:

```js
this.collision.addBuilding(
  new THREE.Box3(
    new THREE.Vector3(b.x - b.w / 2, 0, b.z - b.d / 2),
    new THREE.Vector3(b.x + b.w / 2, b.h, b.z + b.d / 2),
  ),
);
```

Nothing in the spec's G1 section, or anywhere else in the geometry-changes section, touches
collision. The visual roof top for `building_tower_2` becomes `b.h + 0.45` across nearly the
whole footprint; the collision top stays at `b.h`. Acceptance criterion 20 requires a human to fly
over *and land on* this exact building. A character landing on the (unmodified) collision surface
will appear to stand with their lower body inside the parapet slab — roughly 0.45 m of visible
clipping — for a criterion that currently passes.

**Why this isn't "obviously fine."** The "What this spec deliberately does not touch" section
(line 415) says collision is "locked... not evaluated, not proposed against" — but that line is
about *street* collision (curb relief etc.), which this spec correctly leaves alone. It does not
cover the fact that G1 *adds new geometry that the existing per-building collision box no longer
matches*. That's a gap the spec doesn't flag at all, unlike its explicit, correct treatment of
shadow regression (line 320–323, which *does* call out re-verification as a requirement before
"calling shadows done"). Collision gets no equivalent flag.

**Correction.** Add to G1's spec text:

> For every building, additionally register a second collision `Box3` matching the parapet
> platform, alongside (not replacing) the existing per-building box:
> ```js
> this.collision.addBuilding(new THREE.Box3(
>   new THREE.Vector3(b.x - (b.w - 0.6) / 2, b.h, b.z - (b.d - 0.6) / 2),
>   new THREE.Vector3(b.x + (b.w - 0.6) / 2, b.h + 0.45, b.z + (b.d - 0.6) / 2),
> ));
> ```
> This raises the walkable surface to match the visual parapet top everywhere the slab covers,
> while the original box3 still handles the 0.3 m un-raised lip at the true edge. No step-up
> logic is needed for this to work — landing is via flight, not walking, so the 0.45 m rise is
> never climbed, only touched down on.

Flagging for completeness, not as a second blocking item: G2's HVAC blocks (12×0.9×1.2 boxes)
also get no collision registration. This is lower severity than G1 — they're small, scattered
obstacles rather than a full-footprint platform, and a human is unlikely to walk directly through
one while standing on a 20×28 m roof — but the Engineer should decide deliberately whether that's
acceptable (visual clipping if a character brushes one) rather than by omission.

---

## 3. [MINOR] `metalnessMap` channel claim is wrong in the spec's own rationale

**What's wrong.** Spec line 154: "Three.js multiplies `material.roughness × texture.g`,
`material.metalness × texture.g`" — both maps are described as reading the **green** channel.

**Verified against the installed Three.js (0.185.1) source:**

```
node_modules/three/src/renderers/shaders/ShaderChunk/roughnessmap_fragment.glsl.js
  roughnessFactor *= texelRoughness.g;   // reads channel G

node_modules/three/src/renderers/shaders/ShaderChunk/metalnessmap_fragment.glsl.js
  metalnessFactor *= texelMetalness.b;   // reads channel B
```

`roughnessMap` reads **G**, `metalnessMap` reads **B** (the glTF ORM convention, so a single
packed occlusion/roughness/metalness texture can serve all three material inputs). The spec's
claim that metalness also reads `.g` is incorrect.

**Why this is low severity, not blocking.** The spec has each map as its own separate
`CanvasTexture` (not a packed ORM texture), and every fill/shade helper in this codebase
(`shade()`, `ctx.fillStyle` from a hex string) produces **neutral grey** pixels — equal R, G, B —
so which channel gets read is immaterial to the actual rendered result as specified. It is worth
correcting anyway: if a future pass (or this Engineer, mid-implementation) decides to pack
roughness/metalness into one texture to save texture count, the wrong-channel claim would produce
a real bug at that point.

**Correction.** Replace line 154 with: "Three.js multiplies `material.roughness × texture.g`
(`roughnessMap` reads the green channel), `material.metalness × texture.b` (`metalnessMap` reads
blue) — the glTF ORM convention. Since these are separate, neutral-grey canvases in this spec, not
a packed texture, painting with equal R/G/B values (as `shade()` already does) makes the specific
channel moot here — but do not assume `.g` if these are ever packed into one texture later."

---

## 4. [MINOR] G3's `vertexColors: true` requirement is unnecessary (but harmless) in this Three.js version

**What's wrong.** Spec line 148/379–380 states the awning material "needs `vertexColors: true`"
for per-instance `setColorAt` colours to take effect.

**Verified against the installed source.** `WebGLPrograms.js:209` derives the shader's
`instancingColor` flag purely from `object.isInstancedMesh && object.instanceColor !== null` —
i.e. calling `mesh.setColorAt(...)` alone (which lazily creates `instanceColor`) is sufficient.
`WebGLProgram.js:497/737` shows `USE_COLOR` (the flag that actually multiplies the fragment colour
by the per-instance value) is defined by `parameters.vertexColors || parameters.instancingColor`
— either one alone is enough. `material.vertexColors = true` is not required for instance colour
to work in 0.185.1.

**Why this doesn't block anything.** Setting it anyway is redundant, not wrong — `USE_COLOR` just
ends up true for two independent reasons instead of one, with no different runtime behaviour. No
correction needed for buildability; noted so the Engineer doesn't waste time chasing why the
"requirement" doesn't show up in the docs, and so nobody generalizes this to "instance colour
always needs `vertexColors: true`" for a future material.

---

## 5. [MINOR] Texture memory total omits Tier 2, understating the true figure by ~2×

**What's wrong.** Spec lines 180–184 compute "on the order of 15–20 MB of texture memory total
for every building material in the scene" from the Tier 1 set only: 5 materials
(lowrise A/B, midrise A/B, tower-shared) × 3 maps each (diffuse + new roughness + new metalness)
× ~1.3 MB per 512×512 RGBA canvas with mipmaps ≈ **21 MB**. That arithmetic is correct as far as
it goes, but the claim to be a scene-wide total is made *before* § Tier 2 (the bespoke
1024×1024 atlas) is introduced, and nothing later revises it.

**Corrected total.** Tier 2 adds one more material × 3 maps (diffuse + roughness + metalness) at
1024×1024, ~5.33 MB each with mipmaps ≈ **16 MB** more. Computed total: **21 MB + 16 MB ≈ 38 MB**,
not 15–20 MB — roughly double the stated figure.

**Why this doesn't change the verdict.** 38 MB of texture memory is still trivial against a
modern GPU's budget (hundreds of MB to several GB), and does not threaten the 60 fps @ 1920×1080
target — this is a pure browser/GPU-memory-headroom question, not a frame-time one, and canvas
textures this size cost nothing per-frame once uploaded. Correction is to the stated number only:
change "15–20 MB... total for every building material in the scene" to "~38 MB total across all
eleven building materials (five Tier 1 × 3 maps + one Tier 2 × 3 maps), still trivial against a
browser's GPU texture budget."

---

## 6. Assumptions review (spec's own §, lines 73–89) — neither constant is actually blocking

The spec pre-flags storey height (3.9 m) and bay width (3.0–3.4 m) as unsourced. Assessed both:

- **Storey height, 3.9 m** — used once, consistently: `floors = round(90 / 3.9) = 23`
  (line 274). Arithmetically correct (`90/3.9 = 23.08`). Single committed value, no ambiguity.
  **Not blocking.**
- **Bay width** — stated as a *range*, "3.0–3.4 m" (line 84), but the two column-count formulas
  that follow (lines 280–281, `round(20 / 3.2)` and `round(28 / 3.2)`) silently commit to
  **3.2 m**, the range's rough midpoint, without saying so explicitly. The Engineer doesn't have
  to resolve anything — the formulas already have the concrete number baked in — but the
  disconnect between "we don't know this exactly, here's a range" and then a formula that picks
  one value without saying which or why reads as an oversight. **Not blocking; cosmetic fix:**
  insert "**We use 3.2 m, the range's midpoint, in the formulas below**" after the range is
  stated on line 84.

---

## 7. UV coexistence (Tier 1 repeat-wrapped vs. Tier 2 non-repeating atlas) — confirmed buildable

This was the review's primary reason for existing (per the spawn brief). Conclusion: **the
architecture works**, with one implementation note.

- **Material assignment must be by array index, not by `kind` alone.** Current code
  (`StreetBlock.js:266–270`) assigns material purely by `kinds[b.kind]`; both towers share
  `kind: 'tower'`. The spec is aware of this and resolves it explicitly — its Tier 1 variant table
  (line 232) states "tower (shared): index 8... `building_tower_2` at index 2 is bespoke" — so the
  Engineer has the exact indices needed to special-case `i === 2` and skip both the shared
  tower material and `scaleBoxUVs` for that one mesh. This is a real rewrite of `_buildBuildings()`
  (from 3 shared kind-materials to 5 Tier-1 materials + 1 bespoke, selected by array index), but
  the spec's own framing preface (lines 6–8) already says it "rewrites the behaviour... not
  necessarily the literal code" of exactly these two functions, so this is disclosed, not hidden.
- **UV direction consistency, worth flagging as an implementation caution (not a spec gap).**
  `BoxGeometry`'s default UVs (`node_modules/three/src/geometries/BoxGeometry.js:139-140`,
  `v = 1 - (iy/gridY)`) give **all four side faces** (`+X`, `-X`, `+Z`, `-Z`) the same V-direction
  convention — V=1 at the box's bottom, V=0 at its top — because `px`/`nx` and `pz`/`nz` all bind
  `v` to the world-`y` axis identically. This is *why* the spec's claim that Region A and Region B
  floor rows will align (line 278, "or the floor lines won't align when the player flies around
  the corner") is actually achievable: the geometry itself already treats front/back and side
  faces the same way vertically. The one thing the spec doesn't say explicitly, and the Engineer
  must not get backwards: **the new atlas-UV function must apply the same U/V remap formula
  (offset + scale into the assigned region, no per-face flip) to all four side faces uniformly**,
  the same way `scaleBoxUVs` already does for its scale-only case. Worth one added sentence in
  § Tier 2 for the Engineer's benefit; not severe enough to hold up approval since it follows
  directly from the precedent already in the file.
- **The atlas UV remap formula itself is not spelled out** — the region table gives bounding
  boxes (U/V ranges) but not the linear-remap arithmetic. Trivial to derive from the existing
  `scaleBoxUVs` pattern (`newU = uMin + origU × (uMax - uMin)`, same for V), but strictly speaking
  the spec asks the Engineer to write this without stating it. **Not blocking** — it's a one-line
  generalization of code already in the file the spec explicitly names as a rewrite target — but
  since the standard is "implementable without further interpretation," worth handing over
  verbatim: *"For each face assigned to a region, remap `uv.getX(i)` and `uv.getY(i)` (both in
  [0,1] from `BoxGeometry`'s default) via `newU = uMin + u × (uMax − uMin)`,
  `newV = vMin + v × (vMax − vMin)`, using that face's region bounds from the table."*

---

## 8. `InstancedMesh` per-instance transforms — computable from `BLOCK`, spot-checked

- **G1** (10 instances, 1:1 with `BLOCK.buildings`): all inputs (`b.x`, `b.h`, `b.z`, `b.w`,
  `b.d`) exist on every entry. Computable as written (modulo the collision fix in §2).
- **G2** (22 instances: 2×8 low/mid-rise + 3×2 towers = 16+6=22, matches spec's count). Low/mid
  placement formula (`hash01(seed)` keyed on `(buildingIndex, unitIndex)`) is given as an
  illustrative example (`e.g.`) rather than a pinned formula — low severity given the file already
  has three working precedents for exactly this kind of deterministic-hash placement (`_buildPalms`,
  `_buildLamps`); an Engineer has ample pattern to copy. For `building_tower_2` specifically, spot-
  checked the stated fixed offset `(b.x + b.w*0.32, b.h+0.45, b.z - b.d*0.32)` = `(x+6.4, h+0.45,
  z-8.96)` against the roof half-extents (`w/2=10`, `d/2=14`) — comfortably inside the footprint,
  and far enough from roof centre to plausibly clear the helipad **once §1's ellipse-distortion
  fix is applied** (before that fix, "clear of the helipad" is not a well-defined circle to be
  clear of — another reason §1 needs to land first).
- **G3** (8 instances, all buildings except the two towers): `faceWidth = b.w` is confirmed
  correct — `scaleBoxUVs`'s own face-order comment confirms `+Z/-Z` (the boulevard-facing faces)
  scale by `w`, i.e. `w` is the street-facing dimension for every entry in `BLOCK.buildings`, as
  the spec claims.
- **G4** (4 instances, mid-rise only): straightforward, all inputs present.
- **Triangle ledger, spot-checked:** `12×10=120` (G1), `12×22=264` (G2), `12×8=96` (G3),
  `12×4=48` (G4); sum `528`, matches the spec's own total exactly. Confirmed, not re-derived from
  scratch beyond this arithmetic check.

---

## 9. Shadow regression (criterion 7) — adequately handled, no finding

Spec lines 320–323 require `castShadow = true` on all new geometry and explicitly instruct
verifying shadow-map bias holds "before calling shadows done," correctly framing it as regression
testing rather than a new design decision. This is the right amount of specificity for something
inherently empirical (acne/peter-panning thresholds can't be predicted from a document) — no
correction needed.

---

## 10. Locked decisions — full compliance, no findings

Checked against `PIPELINE_STATE.md`'s locked-decisions table and `DESIGN_AGENT_BRIEF.md`'s
constraints table:

- **Renderer:** stays `MeshStandardMaterial` + `InstancedMesh`, no TSL, no WebGPU-only feature
  used anywhere in the spec. Compliant with F1.
- **Street geometry / curb relief:** untouched — spec's own scope section (line 415) confirms,
  and nothing in the geometry or material sections touches `STREET` or the road/sidewalk/curb
  meshes.
- **Character work:** explicitly out of scope, not referenced.
- **No named places / no imported meshes:** every new object is a primitive `BoxGeometry` or a
  procedural `CanvasTexture`; no proper nouns introduced.

No violations found.

---

## Summary for the Engineer

Apply corrections in §1 (helipad ellipse fix — one `ctx.scale` addition to Region C's drawing
step) and §2 (second collision `Box3` per building for the G1 parapet) before or during
implementation; both are small, localized, and don't touch the draw-call/triangle ledger except
that §2's fix is collision-only (zero rendering cost). §3–§6 are prose/number corrections with no
implementation impact once applied. §7–§10 confirm the spec is buildable as scoped, with one
formula (the atlas UV remap) worth stating explicitly rather than left implicit.

**Everything else in the spec — palette, material rationale, priority/cut order, the two
unsourced-but-committed constants, the "don't touch" list — is feasible as written.** No
draw-call, triangle, renderer, or locked-decision problems beyond what's listed above.

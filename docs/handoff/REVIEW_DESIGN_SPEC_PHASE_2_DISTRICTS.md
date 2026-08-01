# Review — Design Spec, Phase 2 Districts

**Reviewer:** Review agent. **Subject:** `DESIGN_SPEC_PHASE_2_DISTRICTS.md` (760 lines).
**Scope:** budget and feasibility only, per `DESIGN_AGENT_BRIEF.md` and `PIPELINE_STATE.md`'s
locked-decisions table. No vote on palette, silhouette, species, or landmark taste. Any aesthetic
objection this reviewer might have had was deleted, per the gate's own charter — see this
document's findings for what stayed.

**Verdict: APPROVED WITH CORRECTIONS.**

No budget, renderer-feasibility, or asset-pipeline problem was found large enough to send this
back. The document's own arithmetic re-derives cleanly (§1 below) and its one open technical
question (`BatchedMesh` per-instance materials, §11 item 1) is now **settled, not open** — verified
directly against the installed `three@0.185.1` source. Two small corrections are listed; neither
touches the draw-call total.

---

## 1. Draw-call and triangle arithmetic — fully re-derived, RVW-1 through RVW-6

**RVW-1 — §4 facade families: 14 calls, both districts, verified.** 7 families (3 District A + 4
District B), each costing 1 main + 1 shadow call as a `BatchedMesh` per family: `7 × 2 = 14`.
Matches the spec's stated 7 main / 7 shadow / 14 total. **[arithmetic re-derived, confirmed
correct.]**

**RVW-2 — §6 ground/road: 8 calls, verified.** 4 surface types (roadway, sidewalk, curb, ground) ×
1 mesh/district × 2 districts = 8 meshes. None cast shadow (verified against code, RVW-7 below), so
main = 8, shadow = 0, total = 8. Matches the spec's table exactly. **[arithmetic re-derived,
confirmed correct.]**

**RVW-3 — §8 prop/terrain subtotals, verified line by line.**

| Line | Spec's stated main/shadow/total | Re-derived from its own row-level table |
|---|---|---|
| World-shared props | 4 / 4 / 8 | cars 2+2, streetlamps 1+1, small props 1+1 → 4/4/8 ✓ |
| District A exclusive | 5 / 4 / 9 | palm 2+2, HVAC 1+1, parapet 1+1, bollards 1+0 → 5/4/9 ✓ |
| District B exclusive | 8 / 5 / 13 | palm 2+2, broadleaf 1+1, awnings 1+0, blade signs 1+0, poles 1+1, scaffolding 1+1, café 1+0 → 8/5/13 ✓ |
| Hill/terrain | ~3 / ~2 / ~5 | midpoint of the inherited `BUD-6` range (2–4 / 2 / 4–6) ✓ |
| **Section total** | ~20 / ~15 / ~35 | 4+5+8+3 / 4+4+5+2 / 8+9+13+5 = 20/15/35 ✓ |

**[arithmetic re-derived, confirmed correct, no error found.]**

**RVW-4 — §9 `BGT-1` subtotal, re-derived independently.** Summing the corrected table's own rows:
main `4+0+8+7+2+20 = 41`; shadow `4+0+0+7+2+15 = 28`; total `8+0+8+14+4+35 = 69`. All three match
the spec's stated subtotal exactly, and `41 + 28 = 69` internally (main+shadow reconciles to the
stated total, which is not automatic — a table can have an internal split error even when the
grand total happens to be right; checked separately and it holds). **Headroom: `150 − 69 = 81`**,
also verified. **The orchestrator's hero correction (14 → 8) was itself checked and is correct**:
before it, hero at 14 would have made the subtotal 75 and the headroom 75 (the "~75 and 75" phrase
in §11 item 3 is this pre-correction pair, not a new error — confusingly worded but not wrong).
**[arithmetic re-derived, confirmed correct.]**

**RVW-5 — §5 `MAS-6` triangle table: correct total, one-building rounding slip, immaterial.**
Recomputing each row (buildings × tri/building): MAS-1 `26×24=624`, MAS-2 `12×48=576`, landmark
`1×48=48`, District A remainder `1×12=12`, MAS-4 `22×24=528`, MAS-5 `16×36=576`, District B
remainder `1×12=12`. Sum: `624+576+48+12+528+576+12 = 2,376` — **matches the stated ~2,376 exactly.**
The building-count column, however, sums to **79** (`26+12+1+1+22+16+0+1`), not the stated "~80."
This is a footnote, not a finding: the table already labels the 80 figure "~" (approximate), the
underlying 30–50-per-district count is itself `[ESTIMATE, INHERITED]` with no authoritative source,
and the 1-building gap contributes at most 12–48 triangles against a ~2,400 total that sits three
orders of magnitude under the 500,000-triangle ceiling. **Not a correction; noted for completeness
only.**

**RVW-6 — Reconciliation against `RESEARCH_PHASE_2_WORLD.md` §BUD-6, verified by direct read.**
Read §BUD-6 directly (not taken on the spec's word): its table states Hero 7/7/14 `[MEASURED]`
(the pre-rig Phase 1 figure, confirmed — this is genuinely what §BUD-6 says, so the spec's
characterization of it is accurate, not a misquote), ground/road ~10–16, buildings ~12–16, props
~27–33, terrain ~4–6, subtotal ~67–85. The spec's own totals (8 for ground/road... wait, 8 not
10-16, but stated correctly as "under estimate"; 14 for buildings, inside 12–16; ~35 for
props+terrain, inside 31–39) are each checked against this source table directly, and the spec's
own characterization of each ("under estimate," "inside estimate") is accurate in every case.
**[verified against source document, not taken on trust.]**

**Conclusion: no budget error found anywhere in this document.** The one error present
(hero at 14) was already caught and corrected before this gate, and that correction's own
downstream arithmetic (subtotal, headroom) is itself correct.

---

## 2. `BatchedMesh` per-instance material override — RVW-7, the spec's own open question, now settled

The spec flags this in §11 item 1 as "a five-minute Engineer-side check" worth doing before
implementation, since a positive answer would delete the 4-call landmark line entirely. Read
`kodaman3d/node_modules/three/src/objects/BatchedMesh.js` directly (three@0.185.1, the installed
version):

- The constructor is `constructor(maxInstanceCount, maxVertexCount, maxIndexCount, material)` —
  **one `material` (or `Material[]`) for the whole `BatchedMesh`**, passed straight to `super(...)`
  the same way a plain `Mesh` takes one material. There is no per-`addInstance` or per-`addGeometry`
  material parameter anywhere in the API.
- `addGeometry()`'s `geometryInfo` object (lines ~626–670) tracks `vertexStart`, `vertexCount`,
  `indexStart`, `indexCount`, `boundingBox`, `boundingSphere`, `active` — **no material or material-
  index field at all.**
- `onBeforeRender()` (line 1518) and the render path read `this.material` — the single mesh-level
  material — for every draw, regardless of which geometry/instance is being multi-drawn.
- The class doc comment states its own intended use directly: *"a large number of objects with the
  same material but with different geometries or world transformations"* — geometry variety, not
  material variety, is the documented feature.

**Verdict: `BatchedMesh` in three@0.185.1 does not support a per-instance material override within
one batch.** The landmark cannot join its family's `BatchedMesh` with a bespoke atlas; it needs the
dedicated `Mesh` the spec already assumed as its working design (§MAS-3). **This closes §11 item 1
outright — no Engineer-side check is needed before implementation, and §BGT-1's 4-call "district
landmarks" line is confirmed load-bearing, not a placeholder that might shrink to zero.** This is
the cheapest and most concrete finding available from this gate, and it resolves in the spec's
favor: nothing was budgeted optimistically here.

**Directly relevant to `PIPELINE_STATE.md`'s newly-locked decision 19** (District A's landmark gets
a sculpted, non-flat crown — made after this document was drafted, resolving the spec's own §12
item 1). Decision 19's text names this exact question as the fork in the road for the crown's cost:
*"batchable → 0 extra calls; not → the dedicated `Mesh` line stands."* This review's finding answers
it: **not batchable — the dedicated `Mesh` line stands.** The crown's triangles (still small, per
§MAS-6) and its +2-call `Mesh` registration are both real, already-priced costs the Engineer should
build against directly, not a question to re-check.

---

## 3. Locked-decision compliance — RVW-8

Checked against `PIPELINE_STATE.md`'s table, decisions 1, 3, 7, 8, 10, 11, 14, 15, 18:

- **1 (stack), 7 (150-ceiling convention), 10 (the two districts as specified)** — full compliance,
  confirmed above.
- **3 (recognizable landmarks, invented streets)** — §3's legal-boundary section correctly locates
  the line at protected *designs*, not real-world facts; the Capitol Records height citation, the
  two original landmark silhouettes, and the "no proper nouns" convention all sit inside the
  decision as written. No violation.
- **8 (bounded world)** and **11 (edge fade/wall)** — out of this spec's scope (it specifies two
  districts' interior content, not the world edge); nothing in it contradicts either decision.
- **14 (hero: 3 material groups, 8 calls total)** — **RVW-9, a wording inconsistency worth flagging,
  not a budget error.** Decision 14's own text reads "3 material groups — suit, skin, accent/cape"
  (accent and cape combined into one group), but §BGT-1's orchestrator-correction note describes the
  same row as "suit, skin, accent, cape = 4 material groups." The number that matters for this
  gate — **8 calls total, both passes** — is identical either way and is what the spec actually
  carries forward into its own rollup, so this has no budget consequence. But it is a genuine
  textual contradiction between the locked-decision table's own wording and how a downstream
  document describes it, and it should be resolved at the source (`PIPELINE_STATE.md`'s decision 14
  or `RESEARCH_PHASE_2_CHARACTER.md`'s `§DRAW-2`, whichever is authoritative) rather than carried
  forward again in the next document that cites it. **Correction: not to this spec** (it did not
  introduce the inconsistency, it inherited it) — **flagging for the orchestrator to reconcile at
  the source before the character subject's Design run**, since that run will need an unambiguous
  group count, not just an unambiguous total.
- **15 (Quaternius/CC0 only), 18 (glTF/GLB, CC0 tiers)** — not triggered. This spec introduces no
  imported meshes; every new asset (facade families, landmark atlas, sign-mast) uses the existing
  primitive + `CanvasTexture` pipeline already shipping in `StreetBlock.js`. No asset-pipeline
  finding.

---

## 4. Renderer and stack feasibility — RVW-10

- **No post-processing.** Nothing in the spec requires a screen-space pass. FAM-9's "corner shadow
  gradient" and pilaster lines are painted into the existing atlas canvas at authoring time, not a
  runtime composite — correctly identified as a texture technique, not an effect.
- **`MeshStandardMaterial`, `BoxGeometry`, `InstancedMesh`, `BatchedMesh`** are all present and used
  as documented in the installed `three@0.185.1`. No TSL, no WebGPU-only feature anywhere.
- **MAT-1's environment-map claim, verified.** `Sky.js` (read directly) does construct a
  `THREE.PMREMGenerator`, bake a synthetic sky scene into it via `pmrem.fromScene(envScene, 0.04)`,
  and assign `this.scene.environment = this.envTarget.texture` with `this.scene.environmentIntensity
  = TUNING.ENV_INTENSITY`. `StreetBlock.js`'s `FACADE_VARIANTS` block comment does still read, in
  its own words, "HISTORY — these values were tuned when there was NO environment map... As of
  commit 6a07c13 there IS one" — i.e. the comment has already been partially corrected in place and
  explains its own history rather than flatly asserting no envMap exists (the spec's line 44
  characterization, "states flatly... no scene.environment," is a shade stronger than what the
  comment currently says, which already flags itself as historical — a minor overstatement of a
  correction that's substantively right regardless). The core claim — environment map real and
  shipping, `towerShared`'s current metalness values chosen for a no-envMap rig, that constraint
  loosening is available as an enhancement — is **confirmed accurate**, and FAM-3's higher-metalness
  proxy-check arithmetic (`0x4a6480` at `winMetal 0.58` → diffuse `31–54`) is independently correct:
  `74 × (1−0.58) = 31.08`, `128 × (1−0.58) = 53.76`. **[verified against code, arithmetic
  re-derived.]**
- **RVW-11 — §6's no-shadow claims on ground/road, verified.** `StreetBlock.js` line 451:
  `ground.castShadow = false`, confirmed. Line 525 (spec cites 515; off by 10 lines, an immaterial
  citation drift — the statement itself is correct): `dashes.castShadow = false`, confirmed. The
  asphalt (`roadway`) and curb `Mesh` constructions (lines ~463–494) never set `castShadow` at all,
  and `THREE.Mesh`'s own default is `false` — confirmed by inspection, no `castShadow` assignment
  present on either. **Correction: none needed; cite-line drift only** (515→525 for the centreline
  claim). Not blocking.
- **RVW-12 — `_makeBespokeTowerMaterial`, `hvacUnits()`, parapet-ring mechanism (`parapetBars`/
  `parapetBoxes`), and `scaleBoxUVs`/`FACADE_TILE_M = 4` all confirmed present in `StreetBlock.js`**
  exactly as the spec describes them, by direct grep and read. No fabricated code citation found
  anywhere in this document.

---

## 5. What I could not settle

1. **`RESEARCH_PHASE_2_WORLD.md` §BUD-6's own itemized ranges are estimates, not measurements** —
   this gate confirms the spec's arithmetic matches what §BUD-6 says, not that §BUD-6's ranges
   themselves will hold once `ChunkManager.js`/`District.js`/`CSM.js` exist. That was never this
   spec's or this gate's to close.
2. **CSM's real shadow-pass overhead** (§11 item 3 of the spec, cross-referencing `ATM-3`/`BUD-5`)
   remains genuinely unmeasurable without `CSM.js` existing. The 81-call headroom this spec leaves
   is judged, on inspection, to be an honestly-sized cushion against an unquantified risk — not
   padded, not reckless — but "honestly sized" is a judgment call, not a verified number, and stays
   that way until the multiplier is measured.
3. **Whether District A's 150 m landmark and District B's 75 m sign-mast read correctly at this
   project's world scale** — a feel question, explicitly out of this gate's scope (taste) and also
   out of a static document's scope (needs a browser). Correctly flagged by the spec itself (§11
   item 5) rather than by this review.

---

## Summary for the orchestrator

**APPROVED WITH CORRECTIONS.** Two items, neither blocking, neither changing any draw-call or
triangle figure:

1. **RVW-9 — reconcile locked decision 14's "3 material groups (accent/cape combined)" against
   §BGT-1's "4 material groups (suit, skin, accent, cape)" at the source**, before the character
   Design run needs an unambiguous group count. The 8-call total is correct and consistent
   everywhere; only the group-count wording disagrees between documents.
2. **RVW-11 — cosmetic citation fix**: the centreline `castShadow = false` claim (§6) cites line
   515; it is at line 525 in the current file. No behavioral claim is affected.

Everything else — the full draw-call and triangle rollup (§1), the `BatchedMesh` material-override
question (§2, now closed rather than open), locked-decision compliance (§3), and renderer/asset
feasibility (§4) — is **verified correct or confirmed compliant**, most of it against the code
directly rather than taken on the document's word. No aesthetic objection is recorded anywhere in
this review, per the gate's charter.

*End of Phase 2 Districts Review.*

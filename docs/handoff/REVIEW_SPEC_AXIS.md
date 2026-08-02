# Code review — SPEC axis

Scope: `git diff main...HEAD`, code only (9,066 lines / 27 files under `kodaman3d/src`, `kodaman3d/tests`).
Question: does the code faithfully implement what the locked decisions and specs asked for?

Status: COMPLETE.

---
## C1 — Decision 22's "byte-identical" test is a tautology (category c)

**Spec** — PIPELINE_STATE.md, locked decision 22: *"Leave `towerShared` / `midriseA` /
`midriseB` exactly as they ship. Do NOT nudge toward glassiness. … Changing browser-verified
values with no defect driving them is how regressions enter."*

**Code** — `kodaman3d/tests/districts.test.js:69-77`, the test literally titled
`LOCKED DECISION 22: the shipped constants are reused BYTE-IDENTICALLY`:

```js
expect(FACADE_FAMILIES.fam1DarkCurtainWall).toEqual(FACADE_VARIANTS.towerShared);
expect(FACADE_FAMILIES.fam4CreamStucco).toEqual(FACADE_VARIANTS.lowriseA);
expect(FACADE_FAMILIES.fam6SteelBlueGlass).toEqual(FACADE_VARIANTS.midriseA);
expect(FACADE_FAMILIES.fam7BronzeGlass).toEqual(FACADE_VARIANTS.midriseB);
```

Both sides are live repo values. `FACADE_FAMILIES.fam1DarkCurtainWall` is literally defined as
`{ ...FACADE_VARIANTS.towerShared }` (`kodaman3d/src/world/facadeFamilies.js:34`, `:109`, `:112`).
The test therefore proves only *"the spread operator works"* — it pins the **families to the
variants**, not the **variants to the values Phase 1 shipped**. An agent that raised
`towerShared.winMetal` from 0.30 to 0.70 inside `annex.js` (which is where `FACADE_VARIANTS`
now lives, `kodaman3d/src/world/annex.js:168-260`) changes both sides at once and **the entire
suite still passes**. That is precisely the regression decision 22 exists to stop, and it names
the failure mode ("quietly nudged towerShared toward glassiness") in the test's own comment.

I grepped `tests/world.test.js` and `tests/districts.test.js` for any hard-coded literal of the
shipped palette; there is none anywhere in the suite.

**Is the doc stale or the code wrong?** The code is wrong (the test is). I verified by hand that
the *values* are in fact unchanged — extracting the `FACADE_VARIANTS` literal block from
`05eb5df:kodaman3d/src/world/StreetBlock.js` and from `HEAD:kodaman3d/src/world/annex.js` and
diffing gives zero differences across all 52 lines. So the behaviour is correct today; only the
guard is fake. Severity is therefore "the lock is not locked", not "the lock is broken".

**Fix**: pin the four variants to hard-coded literals in the test (a golden snapshot), so the
assertion has an anchor outside the source file it guards.

---

## C2 — Decision 25's "only two names" test cannot detect a third name (category c)

**Spec** — PIPELINE_STATE.md, locked decision 25: *"Lives in one exported constant, `HILL_NAME`
(`terrain.js`), pinned by a test — plus a second test asserting these are the **only two** names
in the build, so an agent inventing a third (a shop, a street) fails rather than ships."*

**Code** — `kodaman3d/tests/districts.test.js:607-614`:

```js
it('these are the ONLY two names in the build (decision 6)', () => {
  expect([MAST_SIGN_TEXT, HILL_NAME]).toEqual(['AKC ENTERPRISE', 'Coco Hill']);
});
```

The test's own comment states the invariant correctly — *"The real invariant is not what the two
strings say, it is that there are exactly two … an agent adding a third by inventing a shop name
or a street should fail here rather than ship"* — and then asserts something else entirely. The
body is a verbatim restatement of the two preceding tests (`:584-595`, `:597-605`), which already
pin each string individually. It has **no visibility into the rest of the build at all**: a new
`export const SHOP_NAME = 'Ruby Diner'` in `props.js`, or a street label baked into a canvas
texture, passes untouched.

**Fix**: the check has to scan the source tree — e.g. read `src/**/*.js` and assert that the set
of string literals matching a proper-noun shape (capitalised multi-word, or an all-caps signage
string) is exactly `{AKC ENTERPRISE, Coco Hill}`. That is the only form that can fail for the
reason the decision cares about.

---
## C3 — Decision 27's connector lays a sidewalk and curb ACROSS the boulevard roadway (category c)

**Spec** — PIPELINE_STATE.md, locked decision 27: *"the boulevard T-junctions into a north–south
link centred on the district boundary, and that link meets both of District B's east–west
streets."* Run 2's objection it answers: the boulevard was *"a traversal dead end for anyone
walking east, not merely an aerial blemish."*

The geometry data is right. The **road-surface generation for `annexStreets` is not**.

**Code** — `kodaman3d/src/world/District.js:233-241`:

```js
for (const s of this.spec.annexStreets ?? []) {
  roadway.push(roadStrip(s.axis, s.line, s.from, s.to));
  for (const side of [1, -1]) {
    walks.push(slab(s.axis, s.line + side * walkOffset(), [s.from, s.to], SIDEWALK, SIDEWALK_RELIEF));
    curbs.push(slab(s.axis, s.line + side * curbOffset(), [s.from, s.to], CURB_W, CURB_RELIEF));
  }
}
```

The annex strips lay their sidewalk and curb over the **full unbroken span** `[s.from, s.to]`.
The grid's own strips 30 lines above deliberately do not — they run through `segments()`
(`District.js:203-224`, `:533-543`), and the comment at `:200-202` states exactly why:
*"sidewalks and curbs are broken at them, because a sidewalk slab laid across a roadway is a
slab in the street."* The annex loop never calls `segments()`, and the two annex strips
**cross each other**, so the rule it skips is the one that matters.

Working the numbers, all in District B local coordinates
(`districts.js:52,56,59,70`, `District.js:105,516-523`):

- `HALF_ROADWAY` = 10.67, `SIDEWALK` = 4.57, `walkOffset()` = 10.67 + 2.285 = **12.955**,
  `curbOffset()` = 10.67 + 0.175 = **10.845**.
- Boulevard (`districts.js:429-445`): axis `x`, `line` 0, spans x ∈ **[−470, −160.67]**,
  roadway z ∈ [−10.67, +10.67].
- Connector (`districts.js:472-478`): axis `z`, `line` −150, spans z ∈ **[−39.33, +39.33]**.
- Connector's **west sidewalk**: centred x = −150 − 12.955 = −162.955, width 4.57 →
  x ∈ **[−165.24, −160.67]**, for the whole z span.
- Connector's **west curb**: centred x = −160.845, width 0.35 → x ∈ **[−161.02, −160.67]**.

Both of those x-ranges sit **inside** the boulevard roadway's x-span, and their z-span
**contains** the boulevard's full 21.34 m roadway width. So a 4.57 m × 21.34 m sidewalk slab
plus a 0.35 m curb are laid straight across the mouth of the T-junction — over the roadway, at
`SIDEWALK_RELIEF`/`CURB_RELIEF` above it (`District.js:243-249` merges roadway at y = 0.02 and
walks/curbs at y = 0, with the relief baked into the slab), so they render *on top of* the road
and present a step.

**Consequence**: the junction decision 27 was built to open is floored as a kerb-and-pavement
barrier across the road. A player walking east along the boulevard does not emerge onto the
connector — they walk into a raised sidewalk spanning the carriageway, which is very close to
the dead end the decision existed to remove, plus a new visual defect (a pavement stripe across
a road, clearly visible from the air, which the doc notes is most of how this game is played).

**The test does not catch it** — `tests/districts.test.js:482-508` asserts only the *spec
numbers* (`connector.axis === 'z'`, `connector.line ≈ −DISTRICT_HALF`, `from/to ≈ STREET_LINES ±
HALF_ROADWAY`). It never inspects the built sidewalk/curb geometry, so it verifies the
declaration and not the road.

**Fix**: break the annex strips against each other the way `segments()` breaks the grid's — cut
the connector's sidewalk and curb at the boulevard's right-of-way (±`ROW / 2` about z = 0),
mirroring the `segments('z', ROW / 2)` rule already used at `District.js:220`.

**Doc stale, or code wrong?** Code wrong. Decision 27's text is coherent and the data in
`districts.js` implements it faithfully; only the surface generation in `District.js` fails to
honour the junction.

---

## S1 — Decision 26 leaves District B's generated parapets non-solid, unlike the annex's (category c, minor)

**Spec** — PIPELINE_STATE.md, locked decision 26: *"Rooftop HVAC and parapet coping rings go on
District B's generated buildings too… **One real consequence: rooftop units are colliders on
purpose** (a player who can land on a roof can walk into one), so the world's collider count
rises by 72."*

The decision's own arithmetic (parapet bars 168 → 312, rooftop units 86 → 158, colliders +72)
confirms only HVAC gained colliders, so the code matches the letter of decision 26. But the
resulting world is internally inconsistent in a way worth a decision rather than a default:

- Annex buildings: structural box + **4 parapet collider bars** + HVAC colliders
  (`props.js:136-139`, registered at `WorldProps.js:98-99`).
- District B generated buildings: structural box + HVAC colliders, **no parapet colliders** —
  `districtPropPlacements` (`props.js:330-343`) pushes `out.parapets` (visual) and
  `out.hvacColliders`, and there is no `out.parapetColliders` for the district branch at all.

The known-and-deliberate list covers *District A* (rotated AABBs, no OBB support). District B is
**cardinal**, so its parapet boxes would be exactly as correct as the annex's and cost nothing
but AABBs in a linear scan. As shipped, the parapet ring stops the hero walking off an annex
roof and does not stop them walking off the roof next door — same district, same visual coping.

Not a spec violation; flagging as an unstated inconsistency the decision did not consider.

---
## S2 — Decision 14's cape-as-its-own-group is not what the hero code commits to (category a, latent)

**Spec** — PIPELINE_STATE.md, locked decision 14: *"**4 material groups — suit, skin, accent, and
the cape as its own group.**… This row previously read '3 material groups — suit, skin,
accent/cape', folding the cape in with accent. **That was wrong and self-contradictory.**"*

**Code** — `kodaman3d/src/entities/Hero.js:102-112` builds exactly **three** materials, and the
cape is given `materials.accent` at `:202`:

```js
// Shared materials. Three of them, reused across every part…
this.materials = {
  suit:   new THREE.MeshStandardMaterial({ color: 0x3a6fd9, roughness: 0.6, metalness: 0.05 }),
  accent: new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.7, side: THREE.DoubleSide }),
  skin:   new THREE.MeshStandardMaterial({ color: 0xe0b48c, roughness: 0.75 }),
};
```

The hero is not rigged, so the draw-call number (7 meshes → 14 calls) is expected to be wrong and
is not the finding. The finding is the **grouping the code commits to**: `accent` is used by the
cape and by nothing else (grep: `materials.accent` appears at `:202` and in `setPersona`
`:459`), and it already carries `side: THREE.DoubleSide` — i.e. the code has silently adopted the
**exact 3-group "accent/cape folded together" reading that decision 14 was amended to reject**.
There is no distinct accent group (belt, emblem, boots) at all, and `setPersona` (`:458-460`)
hard-codes three colour writes, so the fourth group would be a signature change, not an addition.

Consequence if left: whoever merges the Quaternius rig has an existing 3-key `this.materials`
shape to merge into, which produces 3 groups = 6 calls and no accent — the decision's stated
failure mode ("a rig built object-by-object … silently wastes the entire gain", inverted). This
costs nothing to fix now (split `cape` out of `accent` and give `accent` its own colour) and is a
signature change later.

---

## S3 — `terrain.js`'s file header now contradicts the code below it (category c, doc-in-code)

**Spec/context** — the brief lists §PROP-3's district grade relief as *"was mechanically blocked,
now unblocked but still a design call nobody has made."*

**Code** — `kodaman3d/src/world/terrain.js:38-60`, the file header, still states the block as a
present fact:

> *"`Collision.js` models the ground as an implicit flat plane at y = 0 with **no height query
> anywhere**… Grading the districts needs a terrain height lookup in the locomotion resolve path,
> which is a `Collision.js` change and **is not this run's**."*
> *"**Walking UP the hill is not possible** (there is no step-up logic)… **Real terrain collision
> is a follow-on.**"*

All three claims are false as of commit `c09f9db`. `CollisionWorld.addTerrain` /
`groundHeightAt` exist (`kodaman3d/src/world/Collision.js:529-556`), `resolve` consumes the field
(`:140-141`, `:159-175`, including a `maxTerrainStep` rise allowance), and `Terrain`'s own
constructor comment 200 lines further down in the *same file*
(`kodaman3d/src/world/terrain.js:256-281`) says so explicitly — *"THE HILL IS REAL TERRAIN NOW,
NOT A STACK OF BOXES… you could not walk up the hill"* in the past tense.

**Doc stale, or code wrong?** The code is right; the header is stale. It matters more than a
normal stale comment because it is the *reason of record* for cutting §PROP-3's grade relief. A
future agent reading it will conclude the relief is still mechanically impossible when in fact
the only thing left is the design call.

---

## S4 — The world fence and the world geometry are two unrelated 610s (category c, low)

**Spec** — PIPELINE_STATE.md, locked decision 11: *"Phase 1's four-`Box3` boundary mechanism
carries forward unchanged but **moves out to the true edge**."*

Two independent constants encode "the true edge" and nothing ties them together:

- `kodaman3d/src/config/tuning.js:249` — `PLAYABLE_HALF_EXTENT: 610.0`, which is what the running
  game passes to the collision world (`kodaman3d/src/core/Game.js:93`).
- `kodaman3d/src/world/districts.js:508` — `export const WORLD_HALF_EXTENT = 610`, derived at
  `:495-507` from District A's 36°-rotated envelope, and the value **every test** uses when
  constructing a `CollisionWorld`.

So the tests never exercise the number the game actually runs with, and the shipped fence sits at
the true edge only by coincidence. Change District A's placement or rotation and
`WORLD_HALF_EXTENT` updates with its derivation while the fence silently stays at 610 — the wall
ends up inside built geometry, which is exactly the "unreachable safety net, never the player's
experience" property decision 11 asks for, broken. `Game.js` should import `WORLD_HALF_EXTENT`,
or `tuning.js` should assert equality.

---

## S5 — Decision 24's "bit for bit" is tested for buildings and colliders but not for props (category a)

**Spec** — PIPELINE_STATE.md, locked decision 24: *"the block carries the hero spawn, the
browser-verified 90 m helipad tower, its collider registrations, and most of `tests/world.test.js`.
**None of that may be lost in the move.**"* Decision 21 adds: *"Verified: the absorbed palms'
placement hashes are byte-identical to Phase 1's."*

What is tested (`kodaman3d/tests/world.test.js:260-400`) is genuinely good: exact building world
positions (`:267-280`), one-box massing, the single bespoke helipad tower and its world transform
(`:346-363`), every annex parapet collider box (`:364-388`), every HVAC collider (`:390+`), the
hero spawn at `(0, 0, 13)` against the rebuilt world (`:294-317`), and the absence of the
`StreetBlock` module (`:261-265`).

What is **not** tested at all: the annex's **prop placements**. `annexPalms`, `annexLamps`,
`annexAwnings`, `annexBladeSigns` and `annexPropPlacements` appear nowhere under `tests/`
(verified by grep). Decision 21's byte-identical-hash claim therefore rests on nothing
executable, and the palms are the one Phase 2 touched a decision about.

I checked the four generators by hand against `05eb5df:kodaman3d/src/world/StreetBlock.js` and
they do reproduce Phase 1 exactly — same `hash01` multipliers (`2654435761`, `40503`, `97`,
`31`, `7919`), same `positions` loop over `±palmRange`, same crown offset `x + lean*h*0.5`, same
awning `outward` convention and unfiltered-index colour cycling, and the merged lamp geometry is
geometrically equivalent to Phase 1's yaw-`π/2`-plus-`inward*0.5` head. The one genuine loss —
the lamp head's `emissive: 0x1a1c1f` — is documented deliberately at
`docs/handoff/ENGINEER_PHASE_2_RUN2.md:367-371`, so it is not a finding.

So this is a coverage gap, not a defect: the property holds today and nothing would catch it
breaking. A single test comparing `annexPalms()` against a checked-in golden array closes it.

---

## Scope creep (category b)

I found **one** item, and I think it was the right call:

**Height-field terrain collision** (`kodaman3d/src/world/Collision.js:140-141`, `:159-175`,
`:529-556` — `addTerrain`, `groundHeightAt`, `maxTerrainStep`, plus the `solid: false` collider
flag and per-owner `removeOwner` handles at `:512-522`). Nothing in the districts spec, either
Phase 2 Engineer brief, or decisions 1–27 asks for it. §PROP-3 explicitly scopes it *out*: *"a
terrain height lookup in the locomotion resolve path, which is a `Collision.js` change and is not
this run's"* (`DESIGN_SPEC_PHASE_2_DISTRICTS.md` §PROP-3, restated at `terrain.js:44-48`).

It is nonetheless justified: the stepped-box hill it replaced had a real, player-visible defect
(you could not walk up the world's third landmark, and terrace edges left daylight under the
hero), and it unblocks §PROP-3's relief. The commit `c09f9db` frames it as paying a known debt.
Flagged for the record rather than as something to undo — but note it is the change that made S3
stale and that nothing has re-derived §BGT-1 or the collider counts against it.

Everything else I checked traces to a spec line: the `VITE_PLAYTEST` debug-surface gate
(`Game.js:137-144`) is the user-requested playtester build (`d518a32`); `facadeAtlas.js` is the
lift-out §4 required; §10's items 1–11 are all present, including the cut tier (bollards in
District A, café props and scaffolding in District B, `props.js:664-667`) and item 11's FAM-3 and
MAS-2.

---

## Things I checked that are clean

- **Decision 19** — District A's landmark is a dedicated `Mesh` with a sculpted, non-flat crown
  (`landmarks.js:78-125`: podium, shaft, two crown steps, spire; crown-fin atlas region at
  `:163-168`), and it deliberately does **not** paint a helipad on the crown base (`:218-241`).
  Height pinned at 150 m (`districts.test.js:575-582`).
- **Decision 20/23** — the mast is a tapered octagonal prism, not a building
  (`landmarks.js:268-288`), with the sign text in one exported constant (`:48`).
- **Decision 27's data** — the connector's declared geometry is exactly what the decision
  describes: axis `z`, centred on the boundary at local −150, spanning between both east–west
  streets with a `HALF_ROADWAY` abutment at each (`districts.js:472-478`). Only the surface
  generation fails it — see C3.
- **Decision 26** — roof props are enabled for both districts (`props.js:650-656`), HVAC boxes are
  registered as colliders for both (`props.js:341`, `WorldProps.js:99`), and the collider-count
  assertion carries the decision's own arithmetic (`world.test.js:376-389`).
- **Decision 21** — the species split holds, and the "the two palms are not the same tree twice"
  test (`districts.test.js:667-680`) is a genuinely strong assertion of §PROP-2's silhouette
  argument rather than a label check.
- **Decisions 12/13** — hero is `MeshStandardMaterial` throughout, no `MeshToonMaterial`, no
  inverted-hull or edge-detection outline anywhere in `src/`.
- **Phase 1 acceptance criteria** — the `[VITEST]` ones are individually named and green
  (criteria 4, 10, 11, 12, 13, 15, 16, 17, 18, 19, 21, 25 all appear as test titles in
  `tests/collision.test.js` / `tests/locomotion.test.js`). Full suite: **177 passing, 4 files.**

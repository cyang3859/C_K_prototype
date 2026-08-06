# Engineer Fix Report — B1–B4

**Agent:** Engineer (Opus), bug-fix run.
**Branch:** `feat/3d-open-world`. Nothing pushed, no PR opened, `main` untouched.
**Input:** `QA_HUMAN_RESULTS.md` (B1–B3 assigned, B4 to investigate).
**Date:** 2026-07-30.

**Status: B1, B2, B3 fixed. B4 confirmed and fixed.** One new defect of the same
family found and deliberately **not** fixed — see "New finding B5" at the end; it
is a decision for the Design agent, not for me.

| | Bug | Outcome |
|---|---|---|
| B1 | Cape streams forward | **Fixed** — sign negated at the point of use, comment rewritten to name the axis |
| B2 | Tap-`W` takeoff too low | **Fixed** — `TAKEOFF_CLIMB_SPEED` 4.8 → 9.6; apex 1.36 m → 2.73 m |
| B3 | Camera renders building interiors | **Fixed** — arm raycast upgraded to a near-plane-sized sphere-cast in `Collision.js` |
| B4 | Body pitch suspected inverted | **Confirmed inverted, fixed** — negated at the render site; reasoning below |
| B5 | *(new)* Flight limb poses inverted the same way | **Reported, not changed** — aesthetic, and Design owns it |

**Regression bar met:**

| Gate | Before | After |
|---|---|---|
| `npm test` | 60/60 | **76/76** (+16 new) |
| `npm run build` | clean, 25 modules | **clean, 25 modules**, 585.89 kB / 151.56 kB gzipped |
| Draw calls | 45 | **45** — no mesh, geometry or material was added or removed |
| `kodaman_prototype.html` | zero diff | **zero diff** — never opened except by targeted `grep` |

---

## The one root cause behind B1, B4 and B5

Three separate defects, one mistake. Writing it down once because it will
otherwise be made a fourth time.

The hero faces **−Z** (`Scale.js`: "Yaw 0 means facing −Z"). So in the hero's own
local frame, **+Z is behind them**. A rotation of +θ about **+X** is:

```
(0, +1, 0)  ->  (0,  cosθ,  sinθ)     the head tips toward +Z, i.e. BACKWARD
(0, −1, 0)  ->  (0, −cosθ, −sinθ)     a hanging part swings toward −Z, i.e. FORWARD
```

Phase 1 was written against the opposite belief, and — this is the part that
matters — **the comments asserted the wrong version**, so every reviewer who
checked the code against its comment found agreement. `Hero.js:211` said outright
"rotating about +X tips the top of the body toward −Z", which is false. `Hero.js:297`
said the cape lift went "toward horizontal (~90°)" without saying *which*
horizontal, which is how it survived.

Every comment I touched now states the axis and the resulting direction
explicitly, and the new tests assert **direction**, not sign — see "Why the tests
assert dot products" below.

---

## B1 — cape streams forward instead of trailing

### What changed

`kodaman3d/src/entities/Hero.js`, in `_animateCape()`:

```js
this.capeAnchor.rotation.x = damp(
  this.capeAnchor.rotation.x,
  -(targetLift + flare),   // was: targetLift + flare
  12,
  dt,
);
```

Plus a rewritten comment block above it that derives the direction from the
rotation, cites `CAPE_Z = +0.14` and the −Z facing convention, and records that
the 2D reference's `trail = -(8 + speed * 3.2)` agrees.

### Why this fix and not the alternatives

- **Negate at the point of use, not in the constants.** `targetLift` and `flare`
  stay positive magnitudes tuned against the intended feel, exactly as QA
  instructed. The sign now appears once, where the direction is decided, which is
  the only place a reader will look for it.
- **Not flipping `CAPE_Z`.** That moves the anchor onto the hero's chest and
  breaks the rig layout. Ruled out by QA and independently correct.
- **Left the per-vertex trail term alone** (`bz + ... + row * trail * 0.18`). It
  displaces vertices toward +Z in the *cape's* local frame, which was already the
  backward direction, and it is a ≤0.24 m billow that Design owns. Retuning the
  waveform was not in scope.

### Verified

- New test: at a full ground dash, the world-space hem direction dotted against
  the hero's own forward vector is **< −0.7** (it was ≈ +0.84 before the fix).
- New test: same in dashing flight, **< −0.8**.
- New test: a standing hero's cape still hangs straight down (`hem.y < −0.99`),
  so the fix cannot be "a constant got reversed and now the rest pose is wrong".

All three run the **real** `Hero` mesh through the **real** transform chain
including a non-zero yaw, in `environment: 'node'`.

### Unverified without a browser

How it *looks*. The direction is now provably backward; whether the 1.15 rad
flight lift reads as an elegant streaming cape or a stiff plank is a judgement
call I cannot make headlessly, and it is Design's call anyway.

---

## B2 — tap-`W` takeoff ends too low

### What changed

`kodaman3d/src/config/tuning.js`: `TAKEOFF_CLIMB_SPEED: 4.8` → **`9.6`**.
`TAKEOFF_STEPS` deliberately **unchanged at 12**. Long comment added recording
the derivation.

### Correction to the QA diagnosis

QA computed the gain as `4.8 × 12 × (1/60) = 0.96 m`. That is the scripted climb
only. A tap actually gains altitude in **two** parts:

1. the scripted climb, and
2. a **coast** — on entering `flying` with `W` already released, the hover
   half-life decay bleeds the residual climb speed off over ~0.4 s before
   `HOVER_SNAP_SPEED` zeroes it, and since gravity is never applied in flight,
   every metre of that coast is kept. It is worth **~0.085 m per m/s** of
   `TAKEOFF_CLIMB_SPEED`.

Measured against the real controller, the shipped apex was **1.36 m**, not 0.96 m.
Still too low — under the hero's own 1.85 m height, which is exactly why it read
as a hop — but the target had to be computed against the right baseline or the
new constant would have overshot by ~40%.

| `TAKEOFF_CLIMB_SPEED` | scripted | coast | **apex** |
|---|---|---|---|
| 4.8 (shipped) | 0.96 m | 0.40 m | **1.36 m** |
| 8.0 | 1.60 m | 0.68 m | 2.28 m |
| 9.0 | 1.80 m | 0.76 m | 2.56 m |
| **9.6 (chosen)** | 1.92 m | 0.81 m | **2.73 m** |
| 10.5 | 2.10 m | 0.89 m | 2.99 m |

9.6 sits mid-band of the 2.5–3 m target.

### Why this fix and not the alternatives

- **`JUMP_FORCE` was not wired in**, per instruction. It remains unused and its
  "do not wire this in" note in `tuning.js` is untouched. Takeoff stays scripted.
- **`TAKEOFF_STEPS` left at 12** — the preferred lever per QA, and the
  conservative choice: criteria 14 (takeoff burst) and 24 (0.6 s camera
  cross-fade) were judged by a human against a 0.2 s takeoff. Changing how *fast*
  the hero climbs cannot desync that timeline; changing how *long* the state lasts
  can. It also keeps the existing "reaches `flying` after exactly 12 steps" test
  meaningful rather than merely re-passing.
- Exceeding `MAX_FLIGHT_UP_SPEED` (7.5) for 12 steps is intentional — a burst
  should out-run the sustained climb cap. Holding `W` through the transition is
  safe: `flying` eases back down to the cap through the ordinary `approach()`
  curve, so there is no discontinuity. Verified by simulation.
- Both constants remain lil-gui sliders (`TAKEOFF_CLIMB_SPEED` range 0–20), so
  the user can dial 9.6 by feel without a code edit.

### Verified

- New test: a tap settles between **2.5 m and 3.0 m**, ends in `flying`, and
  `velocity.y === 0` — it *holds* the apex rather than drifting back down.
- New test: ≥95% of the altitude is gained within `CAM_BLEND_TIME` (0.6 s), so
  the climb still finishes inside the camera cross-fade window and reads as a
  burst rather than a drift.
- The existing 12-step FSM timing tests still pass unmodified.

### Unverified without a browser

Whether 2.73 m *feels* right, and whether the camera pull-back still reads as
deliberate. Those are criteria 14 and 24 and they need the human re-run that the
QA doc already asks for.

---

## B3 — camera renders building interiors on a dash into a wall

### What changed

Three files.

**`kodaman3d/src/world/Collision.js`** — new `spherecastBoxes(origin, dir,
maxDistance, radius, boxes)` beside `raycastBoxes`, as instructed, plus
`CollisionWorld.spherecast()` which excludes the invisible boundary walls exactly
as `raycast()` does. The slab loop was extracted into one private `slabEntry()`
helper shared by both, so the project still contains exactly one ray/AABB
intersection routine. `raycastBoxes`' behaviour is bit-identical — a test asserts
that the sphere-cast at radius 0 returns precisely what the raycast returns.

**`kodaman3d/src/controllers/CameraRig.js`** — the single arm cast now calls
`spherecast`, with the radius **derived, not tuned**:

```js
const halfFovY  = (this.currentFov * Math.PI) / 360;
const nearHalfH = this.camera.near * Math.tan(halfFovY);
const nearHalfW = nearHalfH * this.camera.aspect;
const armRadius = Math.hypot(this.camera.near, nearHalfW, nearHalfH);
```

That is the distance from the camera's position to a **corner of its own near
plane**, so the swept sphere provably encloses every point the near plane
occupies. It is ~0.154 m at FOV 60 / 16:9 / near 0.1, and it tracks the dash FOV
surge and any window resize for free. `currentFov` rather than `camera.fov`
because the camera's own field is not written until the end of `update()`.

The predecessor's "NAMED FALLBACK" comment was replaced with one recording that
the fallback was taken, why a ray was insufficient, and why the padding is not
the lever.

**`Collision.js` header + `CameraRig.js` header** — updated prose.

### Why this fix and not the alternatives

- **`CAM_COLLISION_PADDING` was not raised**, per instruction — and the geometry
  says why it could never have worked: the padding shortens the arm **along** the
  ray, while the uncovered extent is **lateral** to it. No amount of padding
  covers a near-plane corner poking sideways through a facade at a grazing angle;
  it only buys a camera jammed into the hero's back in every corridor.
- **The immediate-pull-in / damped-push-out asymmetry at what is now
  `CameraRig.js:231-238` is untouched.** It is correct and criterion 23 depends on
  it.
- **The sphere-cast lives in `Collision.js`, not inline in the rig**, so the
  camera and the hero still share one box list and one intersection
  implementation.
- **Approximation, stated openly:** sweeping a sphere against a box is exactly a
  ray against the box's Minkowski sum with that sphere, which has *rounded*
  corners. This uses the inflated box with *square* corners — the standard
  conservative approximation. Within `r` of a corner it reports contact up to
  `r·(√3−1) ≈ 0.73r` early on a pure diagonal approach, about **0.13 m** at this
  radius. It errs by pulling the camera **in** slightly sooner at corners, which
  is the safe direction for this defect. Documented in the function's doc
  comment with the upgrade path if a later phase needs exactness.
- **Guard on an origin already inside the inflated box: skip that box, don't
  return 0.** Returning 0 would collapse the arm to its 0.1 m floor and slam the
  camera into the hero's head while the player was merely standing near a wall —
  strictly worse than the clip. It is unreachable in Phase 1 (the horizontal
  push-out keeps the hero's capsule centre `HERO_RADIUS_M = 0.35 m` clear of every
  footprint, and the radius is ≤0.2 m at the widest dash FOV), so it is a guard
  for a future `CAM_NEAR`/FOV change, not live behaviour. A test pins it.

### Confirmed: this is a camera bug, not a hero-penetration bug

QA asked for this to be checked before assuming. It holds. The existing test
"a capsule walked into a wall at dash speed never ends up inside it" drives the
capsule into a face at `FLIGHT_DASH_SPEED` (20.5 m/s = 0.342 m per fixed step,
the largest single-step displacement the tuning can produce — larger than the
13 m/s ground dash in the repro) for 120 steps and asserts it never gets closer
than a radius to the face. It passes. The hero is not penetrating; the camera was.

### Verified

Eight new unit tests, each written as *"the ray says clear, the sphere says
blocked"*, because that difference **is** the bug: a grazing pass along a facade,
a corner the ray genuinely slips past, monotonicity (an inflated box can only
bring contact nearer, never push it further out — a violation would mean the
camera pops **out** into geometry), radius-0 equivalence, the inside-origin guard,
and boundary-wall exclusion.

Beyond unit tests, I ran the real `CameraRig` against the real street block's ten
building AABBs across **20,160 settled camera poses** — the hero parked at every
legal station on each building's perimeter (the footprint inflated by the capsule
radius, which is exactly where the push-out parks a hero who dashed into it),
crossed with 24 orbit yaws — and measured whether the near-plane sphere ended up
inside any building:

| | near-plane clips | worst penetration | mean arm |
|---|---|---|---|
| ray (pre-fix), grounded | **6,491 / 20,160** | 0.146 m | 3.094 m |
| **sphere (fixed), grounded** | **0 / 20,160** | **0** | 2.921 m |
| ray (pre-fix), airborne | **7,917 / 20,160** | 0.130 m | 4.737 m |
| **sphere (fixed), airborne** | **0 / 20,160** | **0** | 4.523 m |

Two things to take from that. The defect was **not** a rare corner case — roughly
a third of settled poses against a facade had the near plane inside geometry, and
QA found it on the first dash. And the cost is small: the mean arm shortens by
**0.17 m (5.6%)** grounded and 0.21 m (4.5%) airborne. That is the concrete
evidence that this fix does not do what raising the padding would have done.

### Unverified without a browser

The sweep settles the camera at each pose; it does not reproduce the **dynamic**
dash, where `currentArm` is easing while the hero moves. The immediate-pull-in
path is what covers that and it is unchanged, but "no interior is ever visible
during a 13 m/s dash into a wall" is a claim only the human repro can make. It is
step 3 of the checklist below.

I also cannot confirm the near plane is the *only* thing that was clipping —
e.g. I cannot rule out a separate shadow or fog artefact at a facade. Nothing
suggests one; I simply have no renderer.

---

## B4 — flight body pitch inverted

**Filed as SUSPECTED. I am confirming it and fixing it.** Reasoning first, because
the instruction was to verify rather than guess, and a behaviour change needs to
earn itself.

### The argument

1. **The arithmetic.** `bodyPivot.rotation.x = state.pitch`. A +θ rotation about
   +X maps the body's up axis `(0,+1,0)` to `(0, cosθ, sinθ)`: for θ > 0 the head
   tips toward **+Z**. Facing is −Z, so +Z is behind: a positive rotation lays the
   hero onto their back.
2. **The sign of `pitch`.** `LocomotionController.js` computes
   `pitch = clamp(−velocity.y / PITCH_SPEED_DIVISOR, …)`, so a **dive** (negative
   `velocity.y`) yields **positive** pitch. Combined with (1): the hero dived
   **feet-first**, reclining backward. Climbing gave the mirror error, nose-down.
3. **Nothing upstream flips it.** `bodyPivot` is a child of `group`; `group` only
   ever takes a **yaw** (`rotation.y`), which cannot change the sign of a rotation
   about the child's local X. The two are separate `Object3D`s, so Euler order is
   not in play either. I checked the whole chain.
4. **The decisive point — B1 is the empirical confirmation.** The human tester saw
   the cape stream **forward**. The cape hangs at `(0,−1,0)` from an anchor in
   **the same local frame**, under a **positive** `rotation.x`. That observation
   *is* a browser measurement of this exact convention: it establishes, from the
   real renderer, that a positive `rotation.x` swings `(0,−1,0)` toward −Z. The
   head axis `(0,+1,0)` is the mirror of that vector, so it necessarily goes to
   +Z. B4 is not an independent guess; it is the same measured fact read off the
   opposite end of the same rotation.

QA's stated reason for filing it as suspected was that the tester passed criteria
6 and 7 without remarking on the flight pose. Point (4) resolves that: the tester
*did* observe the sign — as the cape — and reported it. The pose went unremarked
because criteria 6 and 7 ask "did you take off" and "did you reach the roof and
land", neither of which directs attention at the body's lean, and because the
hero is a primitive assembly with no face and no front/back asymmetry other than
the cape. There was nothing to read the pitch against **except** the cape, and the
cape was reported.

I record this as **confirmed by arithmetic plus one empirical anchor**, not by
direct observation, and the human checklist below has a step to look at it.

### What changed

`Hero.js`, in `syncTransform()`:

```js
this.bodyPivot.rotation.x = -this.state.pitch;   // was: this.state.pitch
```

Negated at the **render site**, not in the controller. `state.pitch`'s "positive
= nose down" convention is what `MIN_FORWARD_PITCH` / `MAX_FORWARD_PITCH` are
named for and what the existing clamp test asserts; inverting it in
`LocomotionController` would have made those names lie and pushed the confusion
one file further upstream. The scene-graph mapping was the thing that was wrong,
so the scene-graph mapping is what changed.

The false comment is replaced with a derivation that names the axis and the
resulting direction, and cross-references B1 as the same root cause.

### Verified

- New test: in a dive, `velocity.y < −5`, `pitch > 0.5`, and the world-space head
  axis dotted with the hero's forward vector is **> 0.5** — the head leads.
- New test: climbing, the head axis dot is **< −0.3** — nose-up, as
  `MIN_FORWARD_PITCH`'s doc comment intends.
- Both also assert `head.y > 0.5`, so a 90° over-rotation cannot satisfy the dot
  test alone.
- New test: level hover leaves the hero upright (`head.y > 0.999`).
- All run at a **non-zero facing** (0.9 rad), which is deliberate: it proves the
  group's yaw is not what makes the sign come out right.

### Unverified without a browser

That the corrected dive pose looks good. It is now provably head-first; whether
43° of lean at the 6.1 m/s dive cap is the right amount is a tuning/Design
question, not a correctness one.

**If a human looks at this and the feet still lead, revert exactly one character**
— the `-` in `Hero.js`'s `syncTransform` — and nothing else is affected.

---

## Why the tests assert dot products and not rotation signs

Worth stating, because it is the actual defence against this recurring.

Both B1 and B4 were sign errors made invisible by a comment asserting the wrong
sign. A test written as `expect(capeAnchor.rotation.x).toBeGreaterThan(0)` would
have been written from the same wrong mental model, passed on the broken build,
and **locked the bug in**. So every new orientation test asks a question that a
bug cannot satisfy: *is the cape hem behind the hero's facing direction?* — posed
in world space, through the real matrices, at a non-zero yaw.

They drive the real `Hero` mesh. `Hero.js` only touches CPU-side Three.js
(`Group`, geometries, materials, matrices) with no renderer, canvas or DOM, so it
runs unchanged under `environment: 'node'` and the `vite.config.js` note about
never acquiring a WebGL/DOM dependency still holds. They live in
`locomotion.test.js` rather than a third file, for the same reason the camera
smoothing assertion does: Phase 1's file tree allows exactly two test files.

---

## New finding B5 — the flight limb poses are inverted the same way (NOT fixed)

Found while confirming B4. **I have deliberately not changed it** and want a
decision rather than a guess. `Hero.js`, `_animateLimbs()`, flight branch:

```js
// Flight pose: arms forward and slightly out, legs together and trailing.
approachRotation(this.joints.armLeft,  -2.6, 0,  0.12, k);
approachRotation(this.joints.legLeft,   0.12, 0,  0.05, k);
```

Same convention error, so the comment and the code disagree:

- **Arms** at `rotation.x = −2.6` put the arm direction at `(0, +0.86, +0.52)` —
  up and **backward**, swept over the head. The comment says *forward*. Classic
  Superman would be `+2.6`.
- **Legs** at `+0.12` point down and **forward** by 7°. The comment says
  *trailing*. Correct would be `−0.12`. Visually negligible either way.

The grounded walk cycle is **unaffected** — its signs are symmetric and
alternating, so the convention error cancels out. Only the flight pose has an
absolute intended direction.

**Why I stopped here.** Unlike B1 and B4, there is no correctness answer. Arms
swept back is a legitimate flight silhouette (streamlined dive) and arms forward
is the other legitimate one; only the *comment* is unambiguously wrong. Picking
between two valid looks is Design's remit, my brief says not to restyle the hero,
and I was told to write questions down rather than guess at ambiguous calls.

**Question for the Design agent (or the user):** should the flight pose be arms
**forward** (matching the comment's stated intent — flip to `+2.6` / `−0.12`) or
arms **back** (matching what currently ships — leave the numbers, fix the
comment)? Either way the comment must change. It is a two-line edit once someone
decides.

---

## Files changed

| File | Bug | Change |
|---|---|---|
| `kodaman3d/src/entities/Hero.js` | B1, B4 | Negate cape lift target; negate body pitch at the render site; both comments rewritten to name the axis |
| `kodaman3d/src/config/tuning.js` | B2 | `TAKEOFF_CLIMB_SPEED` 4.8 → 9.6, with the derivation recorded |
| `kodaman3d/src/world/Collision.js` | B3 | New `spherecastBoxes` + `CollisionWorld.spherecast`; slab loop extracted to a shared `slabEntry` |
| `kodaman3d/src/controllers/CameraRig.js` | B3 | Arm cast upgraded to the sphere-cast with a near-plane-derived radius; fallback comment updated |
| `kodaman3d/tests/collision.test.js` | B3 | +8 sphere-cast tests |
| `kodaman3d/tests/locomotion.test.js` | B1, B2, B4 | +8 tests: takeoff apex, blend window, cape direction ×3, body pitch ×3 |

Not touched: `LocomotionController.js`, `StreetBlock.js`, `DebugHud.js`,
`Game.js`, `Renderer.js`, `Input.js`, `Scale.js`, and
`kodaman_prototype.html` (zero diff, as required).

---

## What a human must run to confirm this

Three of the four are visual and I have no GPU. `npm run dev`, then:

**1. B1 — cape trails (30 s).**
Run forward on the ground at full speed, then hold `Shift` and dash. Orbit the
camera to a side view. The cape must stream **behind** the hero in both. Take off
and dash in flight; same check. Then stand still — the cape must hang straight
down, not stick out. *This re-runs criterion 9's cape defect.*

**2. B2 — takeoff height (30 s).**
From standing, **tap** `W` once and release. The hero should clear roughly
head-height plus a body length — about **2.7 m**, call it one and a half hero
heights — and **hold** that altitude rather than sinking. Watch the camera while
you do it: the pull-back and FOV widen must still read as a deliberate burst, not
a drift. *This re-runs criteria 14 and 24, which QA flagged as at risk.* If it
feels too strong, `TAKEOFF_CLIMB_SPEED` is a live lil-gui slider under
"Locomotion — flight" — dial it and report the number you like.

**3. B3 — camera never enters a building (2–3 min, the important one).**
The reported repro first: `Shift`-dash straight into a wall and hold against it.
Then go beyond it — several different walls, several approach angles, back into
the corner between two buildings, stand with a building between camera and hero,
and repeat all of it while hovering as well as grounded. Orbit the camera fully
around at each. **No building interior may ever be visible.** Also confirm the
opposite failure did not appear: the camera should not be jammed into the hero's
back in normal open-street play — the arm should still sit at its full 6 m when
nothing is in the way. *This re-runs criterion 23.*

**4. B4 — dive pose (30 s).**
Take off, get some altitude, then hold `S` for a fast dive and look at the hero
from the side. **The head must lead.** Then hold `W` to climb — the nose should
tip up. If the feet lead in the dive, B4's fix is wrong: revert the single `-` in
`Hero.js`'s `syncTransform()` and tell me.

**5. Regression sweep (2 min).**
Re-run the criteria most exposed to these edits: **5** (camera-relative WASD,
smooth yaw), **7** (fly to the tallest roof and land), **9** (camera never enters
a building — same as step 3), **12** (persona swap, no hitch). And confirm
**draw calls are still 45** in the debug HUD — no geometry was added, so it should
be unchanged, but it is the number everything downstream is budgeted against and
it is cheap to read off.

**6. B5 — a look, not a test.**
While you are diving in step 4, look at the arms. They are currently swept **back**
over the head. Decide whether you want that or the classic arms-forward pose, and
answer the question in the B5 section above.

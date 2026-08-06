# Human QA Results — Phase 1 Vertical Slice

**Tester:** the user, at the keyboard, real browser + GPU.
**Source:** `HUMAN_TEST_GUIDE.md`, all 13 browser-dependent criteria.
**Date:** 2026-07-30.
**Status:** 10 pass, 1 pass-with-defect, 1 fail, 1 measurement recorded.

This document is the **QA→Engineer loop**. Bugs B1–B3 are confirmed and assigned. B4 is a
suspected defect found while diagnosing B1 — it was not part of the test guide and needs
visual confirmation before it is fixed.

The headless QA agent never ran. These human results supersede it for the 13 `[HUMAN]`
criteria; the other 16 remain orchestrator-verified (see `PIPELINE_STATE.md`).

---

## Results table

| # | Criterion | Result |
|---|---|---|
| 1 | C2 — page loads clean | **Pass** |
| 2 | C6 — draw calls under 60 | **Pass — 45 measured** (Engineer estimated ~49) |
| 3 | C5 — sustained 60 fps | **Pass** |
| 4 | C8 — resize without distortion | **Pass** |
| 5 | C9 — camera-relative WASD, smooth yaw | **Pass on movement — cape direction defect → B1** |
| 6 | C14 — takeoff burst | **Pass, but tap-`W` flight ends too low → B2** |
| 7 | C20 — fly to tallest roof and land | **Pass** |
| 8 | C22 — mouse look and pitch clamp | **Pass** |
| 9 | C23 — camera never enters a building | **FAIL → B3** |
| 10 | C24 — ground↔flight cross-fade | **Pass** |
| 11 | C26 — persona swap, no hitch | **Pass** |
| 12 | C7 — shadows stable | **Pass** |
| 13 | C28 — no memory growth over 5 min | **Pass** |

**Draw calls: 45.** Record it against the Phase 2 budget. 15 calls of headroom, and the
Design agent's realism work will spend into it — see `DESIGN_AGENT_BRIEF.md`, which is gated
on this number.

---

## B1 — cape streams forward instead of trailing behind

**Severity:** major, visual. **Confirmed** by report and by reading the math.

**Reported:** "the cape is flowing in the direction that the character is headed."

**Location:** `kodaman3d/src/entities/Hero.js:302-307`.

```js
this.capeAnchor.rotation.x = damp(
  this.capeAnchor.rotation.x,
  targetLift + flare,   // <- positive
  12,
  dt,
);
```

**Why it is wrong.** The cape hangs at local `−Y` from `capeAnchor`, which sits at
`CAPE_Z = +0.14` — behind the hero, since facing is `−Z` (`Hero.js:52`). A **positive**
rotation about `+X` maps `(0,−1,0) → (0,0,−1)`: it swings the hem toward `−Z`, which is the
direction the hero faces. So `targetLift` lifts the cape **forward into travel**. It should
swing toward `+Z`.

**Corroboration.** The 2D reference does this correctly and negatively:
`drawCape()` at `kodaman_prototype.html:5188` uses `trail = -(8 + speed * 3.2)` — explicitly
backward. The 3D port dropped the sign.

**Fix:** negate the lift target so positive `targetLift`/`flare` produce backward swing. Keep
the constants at `Hero.js:296-300` as they are — they were tuned against the intended feel and
only the direction is wrong. Do not simply flip `CAPE_Z`; that would move the anchor to the
hero's chest.

**Also fix the comment.** `Hero.js:297` says lift rotates "from hanging (0) toward horizontal
(~90°)" without saying *which* horizontal. That ambiguity is how this shipped. State the axis
direction explicitly.

**Verify:** run forward on the ground at full speed, and in flight. Cape trails behind in both.

---

## B2 — tap-`W` takeoff ends too low

**Severity:** minor, feel. **Confirmed.**

**Reported:** "the flight was very short lived when tapping W. Take off should end higher."

**Location:** `kodaman3d/src/config/tuning.js:132-135`.

**Why it happens.** Takeoff is a **scripted climb**, not an impulse:
`TAKEOFF_CLIMB_SPEED: 4.8` m/s held for `TAKEOFF_STEPS: 12` fixed steps = 0.2 s. Total
altitude gained is **0.96 m**. The FSM then enters `flying`, where the hero hovers unless `W`
is held — and hover damping (half-life 0.05–0.08 s) kills any residual vertical velocity
almost immediately. So a tap buys under a metre.

Note for whoever reads this expecting an impulse: `JUMP_FORCE: 9.4` exists but is
**deliberately unwired** (`tuning.js:104-112`). Do not wire it in as the fix for this — that
changes the takeoff architecture from scripted to ballistic, and the scripted design is what
makes criterion 14's camera blend land on a predictable timeline.

**Fix:** raise the scripted climb. Target roughly **2.5–3 m** gained on a tap. Preferred lever
is `TAKEOFF_CLIMB_SPEED` (keeps the burst punchy); extend `TAKEOFF_STEPS` modestly only if
speed alone reads as too abrupt. Both are already lil-gui sliders (`DebugHud.js:93-94`), so
dial it live rather than guessing.

**Constraint:** criterion 14 **passed** — the camera pull-back and FOV widen read as a
deliberate burst. Do not regress that. If a longer takeoff desyncs from the ~0.6 s camera
cross-fade (criterion 24, also passed), keep the takeoff under that duration.

**Verify:** tap `W` from standing. Hero clears roughly head-height plus a body length and holds
it. Camera blend still reads as a burst, not a drift.

---

## B3 — camera renders building interior on a dash into a wall

**Severity:** major. **Confirmed fail.** This is the one the guide flags as worth fixing
before Phase 2, because it gets harder as the world grows.

**Reported:** "using shift and running into a wall did render the inside of the building."

**Location:** `kodaman3d/src/controllers/CameraRig.js:189-214`.

**Root cause — read this before fixing.** The Engineer's own note at `CameraRig.js:189-195`
predicted this exact failure and named the fix:

> A PLAIN RAYCAST, not a sphere-cast, is the deliberate Phase 1 choice… NAMED FALLBACK, not a
> silent gap — if QA finds visible near-plane clipping at building corners, upgrade THIS ONE
> raycast to a sphere-cast then.

QA found it. **The fallback is now authorised.** A zero-radius ray from pivot to camera can
report clearance while the camera's **near plane** (0.1 m, and wider than a point) is already
intersecting the wall. Pressed flat against a facade the arm compresses to its `0.1` floor
(`CameraRig.js:203`), which is exactly where the near plane has nothing left to hide behind.

**This is a camera bug, not a hero-penetration bug.** Horizontal capsule resolution already
runs, two iterations with a deep-penetration pop-out (`Collision.js:174-210`), so the hero is
not ending up inside the wall at dash speed — 13 m/s is 0.216 m per fixed step, well inside
what that resolves. Confirm this before assuming otherwise; if the hero *is* penetrating, that
is a different and larger bug and it should come back to the orchestrator.

**Fix:** upgrade the single raycast at `CameraRig.js:201` to a sphere-cast whose radius covers
the near-plane half-diagonal at the current FOV and aspect. `Collision.js` owns the AABB set;
add the sphere-cast beside `raycastBoxes` (`Collision.js:246`) rather than inlining it in the
rig. Keep the existing immediate-pull-in / damped-push-out asymmetry at
`CameraRig.js:210-214` — that logic is correct and criterion 23's pass condition depends on it.

**Do not** simply raise `CAM_COLLISION_PADDING` (`tuning.js:205`) as the fix. It trades the
clip for a camera that shoves itself into the hero's back in every corridor, and it does not
address the geometry of the problem.

**Swept horizontal collision stays in Phase 2.** It is not what caused this.

**Verify with the reported repro, then beyond it:** `Shift`-dash straight into a wall, several
walls, several approach angles. Back into corners. Stand with a building between camera and
hero. Grounded and hovering. The interior must never be visible.

---

## B4 — SUSPECTED: flight body pitch may be inverted the same way

**Severity:** unknown. **Not reported by the tester. Not on the test guide. Verify before
fixing.**

Found while diagnosing B1 — same axis, same sign question, same misleading comment.

**Location:** `Hero.js:211-214`, with `LocomotionController.js:503-507`.

`syncTransform()` sets `bodyPivot.rotation.x = state.pitch`, and the comment asserts:

> Positive body pitch = nose down. Rotating about +X tips the top of the body toward −Z, which
> is the direction the hero faces…

**That claim does not survive the arithmetic.** A positive rotation about `+X` maps
`(0,+1,0) → (0,0,+1)`, tipping the top toward **`+Z`** — the cape side, i.e. backward. The
comment states the opposite of what the rotation does, and it is the same reversal that
produced B1.

Downstream, `pitch = clamp(−velocity.y / DIVISOR, …)` makes pitch **positive in a dive**. If
the analysis holds, the hero dives **nose-up**.

**Why this is filed as suspected rather than confirmed:** the tester passed criteria 6 and 7
(takeoff, fly to the tallest roof and land) without remarking on the flight pose, and an
inverted dive posture is the kind of thing you would expect someone to notice. Either it was
not scrutinised, or something upstream flips the sign that this reading missed.

**Action:** put the hero in a fast dive in the browser and look at it. If the head leads, the
pose is correct and only the comment at `Hero.js:211-213` needs fixing. If the feet lead,
negate it alongside B1 and treat both as one root cause. **Either way the comment gets
corrected** — it is actively misleading as written.

---

## Assignment

**To:** Engineer agent (Opus, per standing model assignment).
**Scope:** B1, B2, B3 confirmed. B4 to be visually confirmed first, then fixed or downgraded to
a comment correction.
**Out of scope:** anything the Design agent owns — see `DESIGN_AGENT_BRIEF.md`. Fix the bugs;
do not restyle the hero or the buildings while in there.

**Standing rules apply:** no subagent spawning, write files incrementally, pause and ask rather
than guess at an ambiguous call.

**Regression bar:** `npm test` stays green (60/60), `npm run build` stays clean, draw calls
stay at 45, and the 10 passing human criteria stay passing. B1 and B2 both touch things
criteria 14 and 24 measure — re-run those two by hand after the fix.

**Not reported as bugs, correctly:** sidewalk/curb height (3–7 cm vs the real 15 cm) is the
documented Phase 1 compromise and stays until step-up collision lands in Phase 2.

# Spot-Check Results — the B1–B4 fix run

**Tester:** the user, real browser + GPU. **Date:** 2026-07-30.
**Source:** `BROWSER_SPOT_CHECK.md`, all 9 steps.
**Result:** 7 pass, 1 fail, 1 non-issue. The B5 decision is made.

| # | Check | Result |
|---|---|---|
| 1 | Draw calls | **42** — see note below, this is not a regression |
| 2 | B1 cape trails behind | **Pass** — plus a flight-pose observation, same root as 7 |
| 3 | B2 takeoff ~2.7 m | **Pass** |
| 4 | Criteria 14 / 24 not regressed | **Pass** |
| 5 | **B3 camera vs buildings** | **Pass** — the original failure is fixed |
| 6 | Criterion 20 roof landing | **Pass** |
| 7 | B4 dive leads with the head | **FAIL — still dives feet first** |
| 8 | B5 flight silhouette | **Decided: arms forward, legs trailing** |
| 9 | Console clean | Chrome-extension noise only, not app code |

**B3 passing is the headline.** That was the one hard failure from the first round, and the
sphere-cast fix holds up under exactly the dash-into-walls exploration that broke the old one.

---

## Note on step 1 — draw calls are 42, not 45

**Not a regression, and nothing was removed.** `renderer.info.render.calls` counts what was
actually drawn last frame, so it moves with **frustum culling** — stand somewhere fewer
buildings are in view and the number drops.

**The real consequence is for the budget ledger.** `DESIGN_SPEC_PHASE_1_BUILDINGS.md` treats
**45** as a fixed baseline. It is not a constant; it is one measurement from one camera
position. The number that matters is the **worst case** — camera high, looking across the whole
block, everything in frustum — and nobody has measured that. It is certainly higher than 45.

**Action:** before spending draw calls, measure the worst case. Fly to the tallest roof, look
across the block, and read the peak. Budget against that, not against 42 or 45.

---

## B4 — why it still reads as feet-first, and why the sign is NOT the problem

**Do not revert the B4 fix.** The negation at `Hero.js:229` is applied and is correct. Three
separate things stack up to produce what the tester saw, and none of them is the sign.

**1. The torso barely tips.** `LocomotionController.js:503-511` computes
`pitch = -velocity.y / PITCH_SPEED_DIVISOR`, and the code's own comment says the flying dive cap
of 6.1 m/s reaches only **~0.76 rad = 43°**. The `MAX_FORWARD_PITCH` of 1.5 rad (86°, the
"Superman horizontal" pose) is **never reached in normal play** — it exists for "future, faster
dive tuning" that has not happened. A 43° lean on a figure that is otherwise upright does not
read as a dive.

**2. The arms point backward — this is B5, and it dominates the silhouette.** Arms are set to
`rotation.x = -2.6` (`Hero.js:264-265`). The arm pivots at the shoulder with the mesh hanging
below, so local `(0,-1,0)` under a rotation of `-2.6` maps to `(0, +0.857, +0.516)`: **up and
toward +Z, which is behind the hero.** Arms swept up over the head.

Compose that with the 43° torso lean and the arms end up pointing **almost straight up in world
space** `(0, +0.976, -0.217)` during a dive. A figure descending with its arms above its head
reads as falling feet-first no matter what the torso is doing.

**3. The legs point slightly forward.** `rotation.x = +0.12` maps to `(0, -0.993, -0.120)` —
down and ~7° toward `-Z`, the facing direction. Legs lead very slightly instead of trailing.

**So the tester's step-2 observation and step-7 failure are one defect**: in level cruise the
arms read as raised overhead rather than extended toward travel, and in a dive that same pose
plus a shallow lean reads as feet-first. The B4 sign fix is real but invisible underneath it.

### The fix

**B5 is now decided — the user chose arms forward, legs trailing.** That is also the pose the
existing code comments always claimed was intended.

- **Arms:** rotate to point **forward** (`-Z`) and slightly up. `(0,-1,0)` needs a rotation of
  about **`+1.6`** to reach roughly `(0, ~0, -1)`; bias a little above horizontal to taste.
  Note the sign flip: the current `-2.6` is not "too far," it is the wrong direction.
- **Legs:** trail behind, so a small **negative** `rotation.x` in place of `+0.12`.
- **Then re-check the dive.** With arms extended forward the 43° lean may be enough to read
  correctly. **Only if it still fails** should the pitch magnitude be touched — and that means
  `PITCH_SPEED_DIVISOR`, not the clamp, since the clamp is not what is binding.
- The grounded walk cycle at `Hero.js:277-285` is a separate code path with symmetric signs and
  **must not change**. Criterion 9 passed; keep it passing.

---

## Step 9 — the console message is not ours

```
Uncaught (in promise) Error: A listener indicated an asynchronous response by
returning true, but the message channel closed before a response was received
```

This is a **Chrome extension** error — the extension messaging API, not Three.js, not Vite, and
not any code in `kodaman3d/`. Nothing in this project registers a `chrome.runtime` listener.

**Confirm rather than assume:** reload in an Incognito window with extensions disabled. It
should vanish. If it survives with extensions off, it becomes a real bug and needs a stack
trace.

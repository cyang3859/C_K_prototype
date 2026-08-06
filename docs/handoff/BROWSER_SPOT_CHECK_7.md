# Browser spot-check 7 — the feel cluster (bank, hit stop, dash, alternating punch)

**Built 2026-08-06, session 15.** Everything below that could be measured **was** measured, in a
real browser via the Playwright MCP connector, per `CLAUDE.md`. Only the genuinely human items are
left open at the bottom.

**Build state:** 380 tests, clean production build (663.8 kB / 176.9 kB gzip). Console clean apart
from the two known lines (favicon 404, `PCFSoftShadowMap` deprecation).

---

## What was verified, and how

### 1. Velocity-derived bank (`RESEARCH_MANOFSTEEL_REPO.md` §2)

Flown with **real dispatched keys** — Space to climb, W+Shift to cruise, then the camera swung to
turn (movement is camera-relative, so that is the player's own turn).

| Condition | Measured |
|---|---|
| Straight flight at 20.5 m/s | roll **0.000** — dead level |
| Hard left turn | peak **+0.301 rad (17.3°)** |
| Hard right turn | peak **−0.263 rad** |
| After straightening | easing back through **−0.08** toward level |
| Cap | `MAX_BANK_ROLL` 0.7 never approached at these turn rates |

**The bank is visible on screen, not just in the matrix.** This was checked deliberately, because
this project has already shipped an effect that measured correctly and projected to nothing (the
laser beam, `996cfc7`). Projecting the hero's own shoulder line through the **live camera**, from
the chase position the player actually occupies:

| Roll applied | Shoulder-line tilt on screen |
|---|---|
| 0 | 0.00° |
| +0.45 rad (25.8°) | **+25.78°** |
| −0.45 rad | **−25.78°** |

Essentially 1:1 and symmetric. A bank is a rotation about the flight axis, and the chase camera
looks **along** that axis — the one case where a view-axis effect projects at full strength rather
than vanishing.

### 2. Hit stop (§7b)

Measured by wall-clock, during a real fight: walk in, aim, punch until the enemy dies.

| Blow | Designed freeze | Measured freeze |
|---|---|---|
| Punch, 3 → 2 HP | 66.7 ms | **82.9 ms** (10 frames) |
| Punch, 2 → 1 HP | 66.7 ms | **74.9 ms** (9 frames) |
| Punch, 1 → 0 HP (kill) | 133.3 ms | **141.6 ms** (17 frames) |

Measured values run one sampling frame long at each end (8.3 ms per frame at the 120 Hz rAF
headless gives), which accounts for the overhang. **The 2× kill-to-hit ratio holds.**

Also confirmed: a **dodged** punch produced **no freeze at all**, which is the case the unit tests
pin — a miss returns an empty hit list and never reaches the hit-stop line, but a dodge returns a
hit whose outcome is `dodged`, so only an outcome check separates them.

### 3. Attack dash-to-target (§7a)

**Run the way a player meets it** — fresh load, no enemy repositioned, real dispatched keys, the
hero walking in from its own spawn.

| | Measured |
|---|---|
| Gap before the punch | **0.405 m** outside reach |
| Hero moved | **0.633 m**, horizontally |
| Vertical movement | **0.000 m** |
| Result | the punch connected |

⚠️ **One earlier run looked like a defect and was not.** With the camera left at its default, the
nearest enemy sat **71.4° off the aim axis** — outside the 60° punch wedge — so the correct
behaviour was no dash and a miss. The probe's "nearest enemy" helper ignored direction. Worth
recording: *a distance-only measure will call correct wedge behaviour a bug.*

### 4. Alternating punch (§7d)

Successive punches drive opposite arms: measured `left: false` then `left: true`, with the driving
arm's rotation rising to ~0.75 rad while the other counter-swings negative. A laser thrown between
two punches does **not** consume a side.

---

## Still needs a human eye — and only these

1. **Does the bank magnitude feel right?** A hard turn peaks at ~17°, and the cap allows 40°. The
   numbers are defensible and the *taste* is not measurable. `TUNING.MAX_BANK_ROLL` and
   `BANK_FULL_RATE` are live on the tuning panel, so this is a slider question, not a rebuild.
2. **Does the hit stop read as weight or as a stutter?** 67 ms is a common value in shipped action
   games, but 120 ms of frozen frames is exactly what a frame hitch looks like, and only a person
   can say which one it feels like. `ABILITY.HIT_STOP_S` / `KILL_STOP_S`.
3. **Does the dash read as committed or as a teleport?** It moves up to ~1 m in a single step.
   That is deliberate — the swing carries you — but a step is 16 ms, and whether that reads as a
   lunge or a snap is a judgement.
4. **The banked pose itself.** A screenshot at 28.6° is in the session scratchpad
   (`bank-28deg.png`): the body rolls and the cape swings out to the low side. The rig's sign
   conventions have bitten this project twice (`Hero.js` documents both at length), so a human
   look at the pose in motion is cheap insurance.

**Not asked for, because it was measured:** whether the bank appears on screen, whether the freeze
duration matches its constant, whether the dash closes the gap, whether the arms alternate.

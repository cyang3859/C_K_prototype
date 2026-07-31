# Browser Spot-Check 3 — flight lean, cape, helipad

**For:** the person at the keyboard.
**Time:** ~5 minutes. This is a short one.
**Covers:** three changes made after your last pass, none of which has been seen by a human.

Tests are 99/99 and the build is clean, but all three of these are things only an eye can
judge — and one of them is a **feel** change you can now tune yourself without going through me.

---

## Setup

```bash
cd /Users/calvinyang/game_prototype/kodaman3d
npm run dev          # http://localhost:5173
```

Press **`F1`** for the overlay. You will want the **lil-gui panel** open for step 2 — it is the
control panel on the right, under **Flight**.

---

## 1. Flight lean — the main event

Your report last time: *"the body position remains vertical and does not transition to horizontal
traditional flying pose"* and *"when using W and either D or A, character is leaning back."*

Body lean now comes from **horizontal speed**, not just vertical, and reaches the full horizontal
pose at dash speed.

**Do:** Take off and fly, watching the hero from side-on. Work through:
- Hover still
- Cruise forward at normal speed
- Hold `Shift` and dash
- Climb straight up with `W` and no horizontal input
- Climb *and* travel — `W` plus `A` or `D`, the case you flagged

**Pass:**
- Hover — upright.
- Normal cruise — clearly leaning forward into travel, roughly 50°.
- Dash — **flat, the classic horizontal flying pose.**
- Straight-up climb — tips nose-up. This one *should* still lean back; that is correct.
- Climb while travelling — leans **forward**, not back. This is the case you reported.

**Fail:** Still upright at speed. Still leaning back while climbing and moving. Or the lean is
so aggressive at low speed that ordinary flight looks like a nosedive.

> Result:

---

## 2. Tune it if you want to — you no longer need me for this

Two sliders are now live in **lil-gui → Flight**:

- **`MAX_FORWARD_PITCH`** — how flat the hero gets at full dash. Currently 1.5 rad (86°).
- **`PITCH_SPEED_DIVISOR`** — how hard vertical speed tips the body on climbs and vertical
  dives. **Lower tips harder.** Currently 8.
- **`MIN_FORWARD_PITCH`** — the nose-up limit while climbing. Currently -0.6 rad (34°).

**Do:** Fly with the panel open and drag them until it feels right.

> If you changed anything, tell me the numbers and I will make them the defaults:

---

## 3. The cape at speed

A real bug was found and fixed here by a unit test, not by an eye: with the body leaning flat,
the cape was being rotated a further 90° past the hero and pointed **straight up**.

**Do:** Dash at full speed and watch the cape from side-on and from behind.

**Pass:** The cape streams **backward**, roughly in line with the body — behind the hero and
opposite to travel.

**Fail:** Cape sticking straight up, perpendicular to travel. Or folding through the body.

> Result:

---

## 4. Dive angle

Your note last time: head-first was right, but *"the angle could use a bit more work."*

**Do:** Get some forward speed, then dive.

**Pass:** A dive carrying forward speed is now **much steeper** — close to fully committed,
head leading.

**Fail:** Still shallow. If so, `PITCH_SPEED_DIVISOR` in step 2 is the slider — lower it.

> Result:

---

## 5. The helipad

You could not find it last time. It was 3.5 m on a 20 × 28 m roof — a few pixels from altitude.
It is now **12 m**, the real proportion for a roof that size.

**Do:** Fly above the tallest tower (90 m, north side of the boulevard) and look down.

**Pass:** An obvious yellow ring with an **H**, clearly circular, reading as somewhere you could
actually land.

**Fail:** Still invisible. Squashed into an ellipse. Or now so large it overruns the roof edges.

> Result:

---

## Not in this pass

**The dark tower facade** — near-black with pure-black windows. You flagged it, I agree it is a
real defect, and the Design agent is writing a palette fix for it now. It will be its own check.

**Still deliberately not a bug:** sidewalk and curb height at 3–7 cm, pending Phase 2 step-up
collision.

# Browser Spot-Check 3 — flight lean, cape, helipad

**For:** the person at the keyboard.
**Time:** ~7 minutes. This is a short one.
**Covers:** everything changed since your last pass. None of it has been seen by a human.

Tests are 102/102 and the build is clean, but all of these are things only an eye can
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
  dives. **Lower tips harder.** Currently **5** — it was 8 when you last flew, dropped so that
  dives commit properly (step 4).
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
head leading. A straight vertical dive reaches roughly **70°**, where before it stopped at ~44°.

**Fail:** Still shallow. If so, `PITCH_SPEED_DIVISOR` in step 2 is the slider — lower it further.

> Result:

---

## 5. The helipad — the real fix

You could not find it last time even after it went from 3.5 m to 12 m, and the reason turned out
to have nothing to do with size. **The parapet was a solid slab covering the entire roof**, laid
directly over the face the roof texture paints the helipad onto. It was hidden at every size.

The parapet is now **four bars around the roof edge** — actual coping, which is what a real
parapet is. Same one draw call. The roof centre is clear.

**Do:** Fly above the tallest tower (90 m, north side of the boulevard) and look down.

**Pass:** An obvious yellow ring with an **H**, clearly circular, reading as somewhere you could
actually land. A low wall runs around the roof edge, not across the middle.

**Fail:** Still invisible. Squashed into an ellipse. Or now so large it overruns the roof edges.

> Result:

---

## 6. Roof art in general, and landing on it

Same change as step 5, but the slab was hiding **every** roof's art, not just the helipad — grime,
speckle, mechanical-unit staining. And the hero used to land on top of the slab; now it lands on
the actual roof.

**Do:** Fly low over several different roofs and look at them. Then land on the tall tower —
this is re-confirming a test that passed before the change, so it matters.

**Pass:** Roofs carry visible surface detail rather than reading as blank lids. You land solidly
on the roof surface with the HVAC boxes sitting on the same plane you are standing on, and the
coping ring stops you walking off the edge.

**Fail:** You fall through the roof, land floating above it, or the HVAC boxes are sunk into it
or hovering over it. Or the coping does not stop you at the edge.

> Result:

---

## 7. The dark tower facade

Added after this guide was written — the palette fix landed, so it is in this pass after all.

The cause turned out not to be the colours. **Metalness moves brightness out of the diffuse
term and into reflections of the environment — and this project has no environment map at all**,
so the towers were paying the cost and getting nothing back. Metalness is down, albedo is up.

**Do:** Walk and fly past the dark towers, the ones that read as black slabs last time. Compare
them against the tan mid-rise, which already looked right.

**Pass:** The towers now read as **glass** — lighter, with visible light response across the
facade as your angle changes, and windows that are dark blue-grey rather than pure black voids.
They should still look glossy and distinct from the matte stucco low-rises.

**Fail:** Still black slabs. Or overcorrected — chalky, washed out, or no longer reading as
glass at all.

**If it is still flat**, say so rather than nudging the numbers. The physically correct fix is a
real environment map baked from a synthetic sky, which needs no asset file and would let
metalness go back up where it belongs. That is a bigger change and it is written up and waiting.

> Result:

**Still deliberately not a bug:** sidewalk and curb height at 3–7 cm, pending Phase 2 step-up
collision.

# Browser Spot-Check 2 — Phase 1 close

**For:** the person at the keyboard, with a real GPU and display.
**Time:** ~20 minutes, including one 5-minute idle test you can walk away from.
**Covers:** the B5 flight-pose fix, the whole building realism pass, and the regressions both
could have caused.

Since the last check, two things changed: the hero's flight limb pose (arms forward, legs
trailing — your choice), and every building's materials, textures and rooftops. Tests are
95/95 and the build is clean, but **none of it has been seen by a human.**

Two steps ask you to **record a number** rather than pass or fail — steps 2 and 10. Both feed
the Phase 2 budget.

---

## Setup

```bash
cd /Users/calvinyang/game_prototype/kodaman3d
npm run dev          # http://localhost:5173
```

Chrome, DevTools open on **Console**, press **`F1`** for the overlay.

**Controls:** click to capture the mouse (`Escape` releases) · `WASD` move · `W` tap takes off ·
`W`/`S` climb/descend · `G` lands · `Shift` dash · `Q` persona · `F1` overlay.

---

## 1. Loads clean

**Do:** Load the page and read the Console.

**Pass:** Zero red errors, zero Three.js warnings. The street renders.

**Fail:** Any error. Ignore the Chrome-extension message about "a listener indicated an
asynchronous response" — that one is not ours. If unsure, reload in Incognito.

> Result:

---

## 2. Draw calls — record two numbers

The budget was being reasoned against the wrong figure, so this step matters more than usual.
**`renderer.info.render.calls` counts the shadow pass as well as the main pass** — every
shadow-casting object costs two calls, which nobody had accounted for.

**Do:** Press `F1`. Record `draw calls` **standing at street level**. Then fly up above the
tallest tower, look back across the whole block so everything is on screen, and record the
**highest** number you see.

**Expected:** street level in the 40s–50s. Peak **at or below 57**, which is the computed
worst case with nothing culled.

**Flag it if:** the peak exceeds 57. That would mean something draws that the static count
missed.

> Result (street level → peak):

---

## 3. B5 — the flight pose

Your report last time: *"the flight pose is inverted. The arms don't point towards the
direction of travel."*

**Do:** Take off and fly forward at speed, first normally and then holding `Shift`. Orbit to a
**side-on** view.

**Pass:** Arms reach **forward**, ahead of the hero, raised somewhat above horizontal. Legs
**trail behind**.

**Fail:** Arms still swept back or overhead. Legs still leading.

**Expect a caveat.** In *level* cruise the hero's body stays upright, because body lean is
computed from vertical speed only — flying fast and level produces no lean at all. So the arms
may reach forward-and-up rather than along your direction of travel. **That is a separate known
issue, already written up**, and it needs your decision rather than a bug report. Judge this
step on the arms and legs relative to the body, not on the body's angle.

> Result:

---

## 4. B4 — the dive (this failed last time)

**Do:** Fly up, then dive hard on `S` and pick up speed. Side-on view.

**Pass:** The hero goes **head-first**, angled into the dive, arms leading.

**Fail:** Still feet-first. If so, say so and stop — do not let anyone flip the body-pitch sign,
which is correct and has been verified twice. The remaining cause would be lean magnitude.

> Result:

---

## 5. Buildings — do they read as different materials

The single biggest change. Every facade previously shared one roughness and metalness, so glass
towers and stucco low-rises responded to light identically.

**Do:** Walk and fly past all three building types. Watch how light moves across them as you
change angle.

**Pass:** Towers read as **glass** — sharper, more reflective, more directional response.
Low-rises read as **stucco or masonry** — matte, diffuse. They are visibly different materials,
not just different colours.

**Fail:** Everything still responds identically. Or the effect is so strong buildings look wet,
plastic, or metallic.

> Result:

---

## 6. Facades and rooftops

**Do:** Look at facades close up and at a distance. Then fly above the block and look **down** at
several rooftops.

**Pass:** Windows have depth rather than reading as flat painted rectangles. Buildings differ
from one another. **Rooftops look like rooftops** — gravel, plant, parapet edges — not bare
wall colour.

**Fail:** Uniform, flat, or repeating so obviously it reads as wallpaper. Rooftops still bare.

**Note:** a real pre-existing bug was found here — canvas textures sample **bottom-up**, so
rooftops had been sampling wall colour. Fixed. This step is where you confirm it.

> Result:

---

## 7. The helipad — most likely thing to want adjusting

**Do:** Fly above the tallest tower and look straight down at its roof.

**Pass:** A helipad ring and glyph, **circular** — not squashed into an ellipse.

**Judgment call, please answer:** it is currently **3.5 m across**, sized as a legible marking
rather than a real landing circle. Does it read right, or should it be bigger? It is one
constant to change.

> Result + your call on size:

---

## 8. Criterion 20 — land on the tallest roof

The roof now has a parapet and rooftop units, and the parapet needed its own collider.

**Do:** Fly above the tallest tower, position over the roof, press `G`.

**Pass:** You land **on the parapet surface** and stand on it. No sinking in, no dropping
through, no landing inside geometry.

**Fail:** Any sinking or falling through.

**Known and accepted, do not report:** a 0.3 m lip runs around the roof edge that you can slide
off, because the parapet edge acts as a wall there. The real fix is step-up collision, already
scheduled for Phase 2.

> Result:

---

## 9. Criterion 7 — shadows still stable

New rooftop geometry means new shadow casters, and the shadow pass is now known to be half the
draw-call cost.

**Do:** Walk and fly slowly past buildings and palms, watching shadow edges.

**Pass:** Shadows present, holding still relative to what casts them.

**Fail:** **Acne** — stripey shimmer on lit surfaces. **Swimming** — edges crawling as you move.

> Result:

---

## 10. Criterion 5 — frame rate

**Do:** Roughly 1920×1080. Fly around for ~30 seconds including a look across the whole block.

**Pass:** ≥60 fps sustained.

**Fail:** Drops below 60, or visible stutter even at 60.

> Result (record the low point):

---

## 11. Criterion 28 — memory over 5 minutes

**This run added textures**, so this one is no longer a formality.

**Do:** Load, press `F1`, note **geometries** and **textures**. Leave it untouched for 5
minutes. Compare.

**Pass:** Both flat.

**Fail:** Either climbing steadily — that is a leak, and it compounds as the world grows.

> Result (before → after):

---

## When you are done

Report back as a numbered pass/fail list, same as before, plus the two numbers from step 2, your
helipad size call from step 7, and the memory figures from step 11.

**Still deliberately not a bug:** sidewalk and curb height at 3–7 cm instead of 15 cm, pending
Phase 2 step-up collision.

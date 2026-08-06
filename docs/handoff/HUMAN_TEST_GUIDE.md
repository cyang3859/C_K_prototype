# Human Test Guide — Phase 1 Vertical Slice

**For:** the person at the keyboard, with a real GPU and display.
**Time:** ~20 minutes, plus one 5-minute idle test you can walk away from.
**Why this exists:** the Engineer agent verified 16 of 28 acceptance criteria by running
code. It had **no browser and no GPU** and correctly refused to claim the rest. Those 13
remaining criteria are below. Nothing has failed — these are simply unverified.

Each check tells you what to do, what passing looks like, and what failure looks like. Write
the result in the box. Anything that fails goes back to the Engineer agent as a bug.

---

## Setup

```bash
cd /Users/calvinyang/game_prototype/kodaman3d
npm install          # if you have not already
npm run dev          # serves http://localhost:5173
```

Open **http://localhost:5173** in Chrome. Open DevTools (`Cmd+Option+I`) and keep the
**Console** tab visible — several checks depend on it.

**Controls you will need:**

| Input | Action |
|---|---|
| Click canvas | capture mouse (`Escape` releases) |
| `W` `A` `S` `D` | move, relative to camera |
| `W` tap (grounded) | take off |
| `W` / `S` held (flying) | climb / descend |
| `G` | land (hold `W` to abort back to flight) |
| `Shift` | dash / faster flight |
| `Q` | toggle persona |
| Mouse / wheel | camera look / distance |
| `F1` | **toggle debug overlay — you need this** |

---

## 1. Criterion 2 — page loads clean and looks right

**Do:** Load the page. Read the Console. Look at the scene.

**Pass:** Zero red errors and zero Three.js warnings in the Console. A street block renders:
road surface, sidewalks, buildings, palms, lampposts, a hero figure. It reads as a street.

**Fail:** Any console error. Black screen. Geometry in the wrong place, z-fighting (surfaces
flickering against each other), or objects floating disconnected from the ground.

> Result:

---

## 2. Criterion 6 — draw calls under 60

**Do:** Press `F1`. Find the draw-call readout. Stand still.

**Pass:** Under 60 on a static frame.

**Fail:** 60 or above.

**Note:** The Engineer estimated **~49** — the tightest margin in the slice, and it never
measured this for real. If it comes in over budget this is a genuine finding, not a fluke.
Record the actual number even if it passes; Phase 2 adds geometry against this budget.

> Result (record the number):

---

## 3. Criterion 5 — sustained 60 fps

**Do:** With `F1` up, set the browser to roughly 1920×1080. Walk and fly around for ~30
seconds, including looking across the whole block.

**Pass:** ≥60 fps sustained.

**Fail:** Drops below 60, or visible stutter even if the counter reads 60.

> Result (record the low point):

---

## 4. Criterion 8 — resize without distortion

**Do:** Drag the window between narrow and wide. Try a very tall/narrow shape.

**Pass:** Image stays correctly proportioned. The hero is never stretched or squashed. No
blurring.

**Fail:** Aspect distortion, blur, or the canvas failing to fill the window.

> Result:

---

## 5. Criterion 9 — WASD is camera-relative, yaw is smooth

**Do:** Click to capture the mouse. Rotate the camera ~90°, then press `W`.

**Pass:** The hero moves **the way the camera faces**, not a fixed world direction. When you
change direction, the hero *turns* to face travel over a few frames.

**Fail:** Movement locked to world axes regardless of camera. Or the hero **snaps** instantly
to the new facing — the brief requires smooth, not instant.

> Result:

---

## 6. Criterion 14 — takeoff feels like a burst

**Do:** Standing still, tap `W`.

**Pass:** Hero enters flight. Camera **pulls back** and **FOV widens**, and it reads as a
deliberate burst upward.

**Fail:** Camera doesn't change. Or the transition is a hard cut rather than a move.

> Result:

---

## 7. Criterion 20 — fly to the tallest roof and land on it

**Do:** Take off. Hold `W` to climb above the tallest tower (**90 m**). Position over its
roof, then press `G` to land.

**Pass:** You land **on the roof** and stand there. You do not sink through it or drop to the
street.

**Fail:** Falling through the roof, hovering above it without contact, or being unable to
climb high enough.

**Note:** This is the single best integration test in the slice — it exercises rendering,
collision, and the flight FSM together. If only one check gets done, do this one.

> Result:

---

## 8. Criterion 22 — mouse look and pitch clamp

**Do:** Under pointer lock, orbit fully around. Push the mouse all the way **up**, then all
the way **down**.

**Pass:** Smooth orbit. Pitch stops at its limits (about −29° down, +69° up) by easing to a
halt.

**Fail:** Jitter, or a visible **snap** when hitting a limit. Being able to flip the camera
past vertical.

> Result:

---

## 9. Criterion 23 — camera never enters a building

**Do:** This one needs **exploration, not a single path.** Walk the hero along several
different walls, approaching each from multiple angles. Back into corners. Stand with a
building directly between camera and hero. Try it both grounded and hovering.

**Pass:** The camera always pulls in to stay outside geometry, and pushes back out smoothly
when you step away. You never see inside a wall.

**Fail:** Any position or angle where the camera clips inside a building and you see through
it. Note *where* — position and approach angle.

**Note:** The Engineer flagged that horizontal collision is **not swept**, only vertical.
Believed unreachable at Phase 1 speeds. Try `Shift`-dashing straight into a wall to probe it.

> Result:

---

## 10. Criterion 24 — ground↔flight camera cross-fade

**Do:** Take off, then land, several times. Watch the camera rather than the hero.

**Pass:** Camera distance and FOV **interpolate over roughly 0.6 s** — a glide.

**Fail:** An instant cut, or a transition so slow it feels disconnected from the takeoff.

> Result:

---

## 11. Criterion 26 — persona swap with no hitch

**Do:** Press `Q` repeatedly, grounded and in flight.

**Pass:** Appearance swaps super↔civilian instantly. **No frame hitch, no stutter.** It is a
colour change only — silhouette should not change.

**Fail:** Any stall on swap. That would mean meshes are being rebuilt rather than recoloured,
which is the specific thing this criterion exists to catch.

> Result:

---

## 12. Criterion 7 — shadows are stable

**Do:** Walk and fly slowly past buildings and palms, watching shadow edges.

**Pass:** Shadows are present and hold still relative to their casters.

**Fail:** **Acne** — stripey shimmering on lit surfaces. **Swimming** — shadow edges crawling
as you move. Shadows detached from their objects.

> Result:

---

## 13. Criterion 28 — no memory growth over 5 minutes

**Do:** Load the page, press `F1`, note the **geometries** and **textures** counts. Leave it
running untouched for 5 minutes. Come back and compare.

**Pass:** Both counts **flat** — identical, or fluctuating around a stable value.

**Fail:** Either count climbing steadily. That is a leak, and it compounds badly in later
phases.

> Result (before → after):

---

## Bonus — Criterion 3, the production build

```bash
npm run build
npm run preview      # http://localhost:4173
```

**Pass:** Loads with zero console errors and behaves identically to `npm run dev`.

**Fail:** Anything that works in dev but breaks in the built bundle.

> Result:

---

## Known issue — expect this, it is not a bug

**Sidewalk and curb height is 3–7 cm instead of the real 15 cm.** Deliberate. Phase 1
collision is a flat ground plane with no step-up logic, so a truthful 15 cm curb would either
sink the hero's feet into the pavement or wall him off the sidewalk entirely. **Street widths
are exact** S-470-1 Avenue I figures (30.48 m ROW / 21.34 m roadway / 4.57 m sidewalks).

Consequence: **sidewalks will look subtly flat.** Scheduled for Phase 2 with step-up
collision. Do not report it.

---

## If something fails

Note the criterion number, exactly what you did, and what happened instead. Failures go back
to the Engineer agent as a bug report — that is the QA→Engineer loop in the pipeline.

Judgment call worth making: a **camera clip (9)** or a **memory leak (13)** is worth fixing
before Phase 2, because both get harder to fix as the world grows. A **draw-call overage (2)**
is worth knowing but not necessarily worth blocking on — Phase 2 revisits the budget anyway.

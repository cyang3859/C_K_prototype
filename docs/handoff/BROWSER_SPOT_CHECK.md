# Browser Spot-Check — the B1–B4 fix run

**For:** the person at the keyboard, with a real GPU and display.
**Time:** ~15 minutes.
**Why this exists:** the Engineer fixed four bugs and verified everything it could by running
code — 76/76 tests, clean build. It had **no browser and no GPU**, so **none of the visual
results are verified**. Three of the four fixes are things only an eye can confirm.

There is also **one decision** waiting for you at step 8. It is not a pass/fail; it blocks the
character design work until you answer it.

Same format as `HUMAN_TEST_GUIDE.md`: what to do, what passing looks like, what failure looks
like, and a box for the result. Anything that fails goes back to the Engineer.

---

## Setup

```bash
cd /Users/calvinyang/game_prototype/kodaman3d
npm run dev          # serves http://localhost:5173
```

Open **http://localhost:5173** in Chrome, open DevTools (`Cmd+Option+I`), keep the **Console**
visible, and press **`F1`** for the debug overlay. You need the overlay for steps 1, 3 and 5.

**Controls:** click canvas to capture the mouse (`Escape` releases) · `W`/`A`/`S`/`D` move ·
`W` tap takes off · `W`/`S` climb/descend in flight · `G` lands · `Shift` dash · `Q` persona ·
mouse/wheel camera · `F1` overlay.

**Readouts you will use**, all in the `F1` overlay: `pos` (x y z — `y` is your altitude),
`vel h/v`, `cam blend` / `fov` / `arm`, `draw calls`, `fps`.

---

## 1. Draw calls unchanged

**Do:** Load, press `F1`, stand still. Read `draw calls`.

**Pass:** **45.** Same as before the fixes.

**Fail:** Anything else. The Engineer added no mesh, geometry or material, so a change here
means something unintended happened.

> Result (record the number):

---

## 2. B1 — the cape trails behind

This is the bug you reported: the cape streamed forward, in the direction of travel.

**Do:** Run forward on the ground at full speed, then hold `Shift` and dash. Then take off and
fly forward at speed. Orbit the camera to a side-on view for both.

**Pass:** The cape streams **behind** the hero in both. Faster travel makes it stream flatter
and further back. It never leads.

**Fail:** Any forward stream. Or a cape that sticks to the hero's back without lifting at all —
that would mean the magnitude got lost along with the sign.

> Result:

---

## 3. B2 — takeoff clears about 2.7 m

Was 1.36 m, which is what "very short lived" felt like.

**Do:** Stand still. Note `pos` **y** in the overlay. Tap `W` once and release immediately.
Watch `pos` y climb and note its **highest** value before it settles.

**Pass:** Peak y is roughly **2.5–3.0 m above** the standing value. It should read as clearing
your own height and then some.

**Fail:** Under ~2 m, or a climb that keeps going — a tap must not turn into a sustained ascent.

> Result (standing y → peak y):

---

## 4. Criteria 14 and 24 have not regressed

Both passed on your first run and step 3 changed the constant they depend on.

**Do:** Tap `W` a few times, then land with `G`, several cycles. Watch the **camera**, not the
hero. `cam blend` and `fov` in the overlay move as it happens.

**Pass:** Takeoff still reads as a **deliberate burst** — camera pulls back, FOV widens.
Distance and FOV still **interpolate over roughly 0.6 s** rather than cutting.

**Fail:** The burst now feels like a drift, or the camera move finishes long before or after the
hero does.

> Result:

---

## 5. B3 — the camera stays out of buildings

**The most important step. This is the criterion that failed.** The Engineer's 20,160-pose
sweep settles the camera at each position, so it does **not** reproduce the dynamic dash that
broke it — only you can.

**Do:** This needs **exploration, not one path.**
- `Shift`-dash straight into a wall. Do it at **several different walls and several approach
  angles**, not just head-on.
- Back into corners.
- Stand with a building directly between camera and hero.
- Repeat all of it **hovering** as well as grounded.
- Watch `cam arm` in the overlay — it should shrink as you close on a wall, then recover
  smoothly when you step away.

**Pass:** You **never** see inside a building. No flicker of interior, not even for one frame.
The camera pulls in and pushes back out smoothly.

**Fail:** Any glimpse of a building's inside. **Note where** — position from `pos`, and the
approach angle.

> Result:

---

## 6. Criterion 20 — land on the tallest roof

The best integration test in the slice, and step 5 changed camera collision.

**Do:** Take off, hold `W` above the tallest tower (**90 m**), position over the roof, press `G`.

**Pass:** You land on the roof and stand on it. No sinking through, no dropping to the street.

**Fail:** Falling through, hovering without contact, or not being able to get high enough.

> Result:

---

## 7. B4 — the dive pose leads with the head

Found while diagnosing the cape. Same axis, same sign error, and the old comment asserted the
opposite of what the code did. The Engineer fixed it on the arithmetic, but **nobody has seen
it**.

**Do:** Fly up, then dive hard — hold `S` and pick up speed. Orbit to a **side-on** view.

**Pass:** The hero goes **head-first**, angled into the dive.

**Fail:** The hero dives **feet-first**, lying back. If so the fix is inverted and reverting is
one character — report it and stop, don't try to fix it live.

> Result:

---

## 8. B5 — a decision, not a test

**The Engineer found this and deliberately did not fix it.** The flight limb poses have the same
inversion as the cape and the body pitch: **arms sweep back over the head**, and the legs point
slightly forward (~7°), while the code comments claim the opposite. Unlike B1 and B4 there is no
correct answer here — both silhouettes are real flight poses. So it is a design call, and it is
yours.

**Do:** Fly around and look at the hero's silhouette from the side.

**Decide between:**

- **Arms forward, legs trailing** — the classic flying-brick silhouette, arms extended ahead.
  Matches what the comments in the code always claimed was intended.
- **Arms back, legs forward** — what currently ships. Reads faster and more swept, closer to a
  dive or a skydiver.

There is no wrong answer and it is a two-line edit either way. **This blocks the character
design pass**, so it needs an answer before that runs.

> Decision:

---

## 9. Console is still clean

**Do:** Look at the Console after all of the above.

**Pass:** Zero red errors, zero Three.js warnings.

**Fail:** Anything. Note the exact text.

> Result:

---

## When you are done

Paste the results back in whatever form suits you — the numbered list with pass/fail is plenty,
same as last time. Failures go to the Engineer; the step 8 decision unblocks the character
design pass.

**Still deliberately not a bug:** sidewalk and curb height at 3–7 cm instead of the real 15 cm.
Phase 1 collision has no step-up logic. Scheduled for Phase 2. Do not report it.

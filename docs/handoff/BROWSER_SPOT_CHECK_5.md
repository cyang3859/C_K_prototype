# Browser Spot-Check 5 — the environment map

**For:** the person at the keyboard.
**Time:** ~4 minutes.
**Covers:** commit `6a07c13`. One change, but it affects every reflective surface in the world.

> **Status: all four checks run under Playwright (headless WebGL), 2026-08-01.** Results are
> filled in below. Everything here was measurable without a human eye except the 120 fps target
> — headless Chrome pins the rAF loop to 60, so step 4 reports GPU frame time instead. If you
> want to confirm the frame rate on real hardware, that is the one thing left.

This is the fix for the dark towers you photographed at street level. It is a **mechanism**
change, not a colour change — nothing in the palette moved.

## What was actually wrong

`MeshStandardMaterial` gets its indirect specular — the "shiny surface catching the sky" term —
**only from an environment map.** With none in the scene that term is not dim, it is exactly
**zero**, at any roughness. So `metalness` in the old rig never added reflectivity. It only
subtracted from the diffuse term and gave nothing back, and under ACES tone mapping a dark,
metallic surface then fell off a cliff into black.

The earlier palette pass compensated by pulling the towers' metalness *down* — 0.45 → 0.32 on
the walls, 0.70 → 0.50 on the windows. That helped, which is why the close-up shots you took
looked better. But those numbers are a workaround for a missing mechanism, not a description of
glass. The mechanism now exists: a synthetic sky baked into a PMREM at startup. **No asset file,
no new draw calls.**

**Metalness has deliberately not been touched.** Changing both at once would make it impossible
to tell which one did the work.

---

## Setup

```bash
cd /Users/calvinyang/game_prototype/kodaman3d
npm run dev          # http://localhost:5173
```

Open **lil-gui → Environment lighting**. There is one slider: **`ENV_INTENSITY`**, default 1.0.

---

## 1. The before/after — do this one first

`ENV_INTENSITY` at **0** is exactly the old behaviour. This is the only honest comparison, and
it costs you one drag.

**Do:** Stand on the street where you took the dark-slab screenshot. Drag `ENV_INTENSITY`
between **0** and **1** a few times, watching the towers.

**Pass:** At 1 the towers pick up a visible sky reflection — lighter, with the facade brightening
as it turns toward the sky and the windows reading as reflective rather than as holes. At 0 they
snap back to the slabs you photographed.

**Fail:** No difference at all between 0 and 1. That would mean the bake silently failed, and it
is the single most useful thing you could tell me — it cannot be tested without a GPU, so your
eye is the only check that exists.

> Result: **PASS.** The bake did not fail — `scene.environment` is a non-null texture and
> `scene.environmentIntensity` tracks the slider live. Mean luminance (0–255) over fixed screen
> regions, from the boulevard at `(-85, 0, 8)` looking down the street:
>
> | region | ENV 0 | ENV 1 |
> |---|---|---|
> | far tower (left) | 10.5 | 92.4 |
> | far tower (right) | 12.8 | 94.3 |
> | tan mid-rise | 38.2 | 134.7 |
> | roadway | 45.1 | 76.6 |
> | sidewalk | 114.0 | 151.9 |
> | hero cape | 8.7 | 64.1 |
> | sky | 199.7 | 199.7 |
>
> At 0 the towers sit at luminance ~11 — the black slabs from the original screenshot. At 1 they
> are ~93. The sky is byte-identical between the two, so the change is entirely in surface
> response and nothing in the backdrop moved.

---

## 2. Street level and distance — the actual complaint

**Do:** Walk the boulevard. Look down the street at the towers in the distance, which is where
they read worst.

**Pass:** They read as buildings with glass on them rather than as black cutouts against the sky.

**Fail:** Still black at distance even though close-ups improved. Say so — the remaining lever is
raising metalness back toward its original 0.45/0.70 now that there is finally something for it
to reflect, which is a one-line change I deliberately held back.

> Result: **PASS.** Down the boulevard the towers read as buildings with glass on them, not as
> black cutouts. Close up on `building_tower_2`'s facade the difference is total: at ENV 0 the
> wall is near-black and the window panes are pure holes; at ENV 1 the wall reads light
> blue-grey and each pane carries a visible top-to-bottom gradient — glass catching sky. On this
> evidence the held-back metalness raise looks unnecessary.

---

## 3. Check it did not wreck anything else

The environment lights **every** material in the world, not just the towers.

> **Correction — this step originally predicted the wrong thing.** It said matte surfaces "have
> low metalness and should barely move." That is wrong, and measurement caught it. An
> environment map feeds **diffuse irradiance** to every `MeshStandardMaterial` as well as
> indirect specular, and **the diffuse term does not care about metalness**. So this commit acts
> as a global ambient fill, not only as a tower-glass fix. Expect matte surfaces to brighten
> substantially. Judge this step on whether the scene looks *right*, not on whether matte
> surfaces held still.

**Do:** Look at the tan mid-rise you have always said reads well, the sidewalks, and the hero.

**Pass:** The mid-rise still reads right. Roads and sidewalks are brighter but still read as
matte. The hero's suit and cape are brighter without looking wet or plastic.

**Fail:** Everything has gone milky or washed out, or matte surfaces now look wet or plastic.
That would mean `ENV_INTENSITY` wants to sit below 1.0 — try 0.6 and tell me.

> Result: **PASS visually — but the step's original premise was wrong, see the correction above.**
> Nothing is milky, wet, or plastic, and the tan mid-rise still reads well. But the matte
> surfaces move a great deal: road **+70%**, sidewalk **+33%**, mid-rise **+253%**, hero cape
> **+637%** (luminance, ENV 0 → 1). Under the step as originally written that reads as a failure;
> it is not one, it is the mechanism being broader than the step described.
>
> The practical consequence: at ENV 0 the **whole scene** is underlit, not just the towers. The
> old rig was short of ambient fill generally, and this commit fixes that too. `ENV_INTENSITY`
> 0.6 is only slightly darker than 1.0 and still reads fine; 1.0 is not washed out.
> **Recommend keeping the 1.0 default.**

---

## 4. Performance

**Do:** Press **`F1`**.

**Pass:** Draw calls unchanged from last time — around **50 in flight**. Frame rate still 120.
The bake is a one-off at startup; it should cost nothing per frame.

**Fail:** Draw calls went up, or the frame rate dropped.

> Result: **PASS on cost; frame rate not verifiable headless.** Identical at ENV 0 and ENV 1:
> **57 draw calls, 11,324 triangles, 13 programs, 22 textures.** Median GPU frame **0.20 ms**,
> p95 **0.30 ms**, measured over 60 renders with a `gl.finish()` sync each frame. The bake
> genuinely costs nothing per frame — no extra draw call, no extra shader program.
>
> **Caveat:** headless Chrome pins the rAF loop to 60, so the HUD read 60 fps throughout and the
> 120 fps target could not be checked. The frame-time numbers are the meaningful evidence here;
> the fps line is not. **This is the one item that still wants a human at real hardware.**

---

> **`ENV_INTENSITY` was left at 1.0 — no change recommended.** 0.6 also reads fine if you prefer
> a darker street, but nothing about 1.0 looked overdone.

**Still open after this, and still your call:** whether to raise the towers' metalness back
toward 0.45/0.70. On the measurements above I would **not** — the environment map alone closed
the gap, and raising metalness now would push the glass past where it needs to be.

**Also worth deciding:** the environment map is currently doing double duty as the scene's
ambient fill (step 3). That is a happy accident, not a design decision. If ambient fill ever
gets its own control, `ENV_INTENSITY` should stop carrying it.

# Browser Spot-Check 5 — the environment map

**For:** the person at the keyboard.
**Time:** ~4 minutes.
**Covers:** commit `6a07c13`. One change, but it affects every reflective surface in the world.

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

> Result:

---

## 2. Street level and distance — the actual complaint

**Do:** Walk the boulevard. Look down the street at the towers in the distance, which is where
they read worst.

**Pass:** They read as buildings with glass on them rather than as black cutouts against the sky.

**Fail:** Still black at distance even though close-ups improved. Say so — the remaining lever is
raising metalness back toward its original 0.45/0.70 now that there is finally something for it
to reflect, which is a one-line change I deliberately held back.

> Result:

---

## 3. Check it did not wreck anything else

The environment lights **every** material in the world, not just the towers. The matte
surfaces — stucco low-rises, pavement, road — have low metalness and should barely move.

**Do:** Look at the tan mid-rise you have always said reads well, the sidewalks, and the hero.

**Pass:** The mid-rise still reads right. Roads and sidewalks look about as before. The hero's
suit and cape are not noticeably shinier.

**Fail:** Everything has gone milky or washed out, or matte surfaces now look wet or plastic.
That would mean `ENV_INTENSITY` wants to sit below 1.0 — try 0.6 and tell me.

> Result:

---

## 4. Performance

**Do:** Press **`F1`**.

**Pass:** Draw calls unchanged from last time — around **50 in flight**. Frame rate still 120.
The bake is a one-off at startup; it should cost nothing per frame.

**Fail:** Draw calls went up, or the frame rate dropped.

> Result:

---

> **If you changed `ENV_INTENSITY` from 1.0, tell me the number and I will make it the default.**

**Still open after this, and still your call:** whether to raise the towers' metalness back
toward 0.45/0.70. Worth deciding only once you have seen what the environment map alone does.

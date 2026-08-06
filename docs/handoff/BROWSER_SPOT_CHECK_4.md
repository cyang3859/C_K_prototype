# Browser Spot-Check 4 — the cape, and nothing else

**For:** the person at the keyboard.
**Time:** ~2 minutes. One thing.
**Covers:** commit `e382edb`, the only change since your last pass.

You reported the cape blending into the body. The cause on file was wrong — or rather, it was
half right. It had been recorded as a *speed* problem: when the body flattens out at dash speed,
the cape ends up lying along the torso instead of trailing off it. That does happen. But the
bigger cause was that **the cape was bolted on inside the chest.**

The mount point sat 0.14 m behind centre. The torso is a capsule of radius **0.28**. So the
anchor was about 7 cm under the skin, and the cape hung down through the widest part of the body
from the very first frame — standing still, no flight, no speed involved. Your screenshot was
showing both problems at once, which is why it looked worse than the note predicted.

Both are fixed. Tests are 105/105 and the build is clean, but a clipping fix is exactly the kind
of thing that only an eye can sign off.

---

## Setup

```bash
cd /Users/calvinyang/game_prototype/kodaman3d
npm run dev          # http://localhost:5173
```

---

## 1. Standing still

**Do:** Just stand there. Orbit the camera around behind the hero.

**Pass:** The cape hangs down the back as a separate sheet — you can see it is *behind* the body,
not embedded in it. It should still look like it is resting against the back, not held out.

**Fail:** Red still poking through the blue torso. **Or** the opposite overcorrection — the cape
standing off the back at an angle as if in a permanent wind, which would look wrong on someone
standing on a street corner.

> Result:

---

## 2. Full dash flight — the case you screenshotted

**Do:** Take off, hold `Shift` and dash. Watch from side-on, then from directly behind.

**Pass:** The cape streams behind and slightly above the body, with **clear daylight between the
cape and the torso**. From behind you should read two distinct shapes, not one merged red-and-blue
mass.

**Fail:** They still merge. Or the cape now sits so far off the back it looks detached — floating
rather than attached at the shoulders.

> Result:

---

## 3. If it is close but not right, tune it yourself

**lil-gui → Flight → `CAPE_MIN_STANDOFF (rad)`**, currently **0.4** (≈23°).

This is how far the cape is pushed off the torso *once the body is flat*. It fades in with body
pitch, so moving it does not affect the standing pose at all.

- **Higher** — more separation in flight, more of a held-out flag.
- **Lower** — hugs the body more.
- **0** — restores the old behaviour exactly, if you want to see the difference side by side.

> If you changed it, tell me the number and I will make it the default:

---

**After this passes, the PR against `dev` goes up.** Phase 1 has been complete for a while and
has never been landed — 43 commits sitting on the branch. Nothing will be pushed to `main`.

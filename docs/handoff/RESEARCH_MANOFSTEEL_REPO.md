# Research: `ProdiG66/ManOfSteel` — a real UE5 superhero prototype, and what to take from it

**Source:** [github.com/ProdiG66/ManOfSteel](https://github.com/ProdiG66/ManOfSteel) — UE5 C++,
**MIT licensed**, © 2024 Jan Enri Arquero. 11 stars, 7 forks, last pushed 2025-07-18. Read via the
GitHub API (authenticated `gh`), not scraped — so every number below is quoted from source files,
not from a listing page or a summary.

This supersedes the "Comprehensive Technical Specification" document the user found online as the
better reference. That document does not compile (see §1); this repository is real code with
tuned constants.

---

## 1. Why this replaces the other document

The user-supplied spec contained `virtual Greenwood() override;` where `virtual void BeginPlay()
override;` belongs — no return type, and a function that does not exist on `ACharacter`, while
its own `.cpp` defines `BeginPlay()` the header never declares. That is two compile errors in one
line, so the file has never been built. Treat it as a plausible-sounding sketch, not a spec.

Where the two disagree, **this repository wins on evidence**, and the disagreements are not small:

| Quantity | The online document | ManOfSteel (actual source) |
|---|---|---|
| Hover speed | 600 uu/s (6 m/s) | **1500 uu/s (15 m/s)** |
| Cruise / sprint | 3000 uu/s (30 m/s) | **6000 uu/s (60 m/s)** |
| "Supersonic" tier | 12,000 uu/s, labelled supersonic | **no such tier exists** |
| Flight braking | 2000 uu/s² | **9000 uu/s²** |
| Tier model | 3 discrete enum tiers | **2 speeds + a continuous 0–1 ramp** |

Two things worth drawing out:

- The document's braking of 2000 uu/s² would take **6 seconds** to stop from its own claimed
  12,000 uu/s top speed while describing itself as "ensures quick stopping". The real project uses
  **9000 — 1.5× its top speed**, i.e. roughly 0.67 s to a standstill. That ratio is the usable
  number.
- The document's "Supersonic Boost — 12,000 units/sec" is 120 m/s ≈ **Mach 0.35**. Mach 1 is
  ~34,300 uu/s. The real project never claims supersonic and never needed to.

---

## 2. The best find: lean is computed, not animated

`Flight.cpp:338-349`. This is the single most transferable thing in the repository, and it needs
**no skeleton, no blend space and no animation pipeline** — it is arithmetic on the velocity
vector:

```cpp
DeltaRotator            = NormalizedDeltaRotator(LastVelocityRotation, PreviousVelocityRotation);
YawVelocityDifference   = DeltaRotator.Yaw   / DeltaTime;   // deg/s the velocity is turning
PitchVelocityDifference = DeltaRotator.Pitch / DeltaTime;
YawClamped              = MapRangeClamped(YawVelocityDifference,   -180, 180, -1, 1);
PitchClamped            = MapRangeClamped(PitchVelocityDifference, -180, 180, -1, 1);
Lean.X = FInterpTo(Lean.X, YawClamped,   DeltaTime, 5);     // bank, smoothed slowly
Lean.Y = FInterpTo(Lean.Y, PitchClamped, DeltaTime, 15);    // pitch, 3x more responsive
```

**Lean is the smoothed, normalised angular velocity of the velocity vector.** Turn hard and the
body banks into the turn; pull up sharply and it pitches back. In UE this drives a blend space; in
`kodaman3d` it can drive a roll and pitch on the hero group directly, which is exactly the kind of
motion capsules *can* express.

Note the asymmetry: **pitch is smoothed at 15 and yaw at 5**, so the body pitches nearly three
times more eagerly than it banks. That is a feel decision someone made deliberately and it is free
to copy.

⚠️ **Port the maths, not the smoothing function.** `FInterpTo` is `Delta * Clamp(dt * speed, 0, 1)`
— a dt-scaled lerp that is only approximately framerate-independent. `kodaman3d` already has the
correct exponential form in `LocomotionController.js:150`
(`hoverDampingFactor = 0.5^(dt/halfLife)`), and `tuning.js` documents at length why the per-frame
version is wrong. Use ours.

---

## 3. Other mechanisms worth taking

### 3a. A continuous boost ramp, not discrete tiers (`Flight.cpp:316-317`)

```cpp
FastFlightTime       = IsFlying && IsSprint ? FastFlightTime + Delta : 0;   // resets on release
FastFlightTimeMapped = MapRangeClamped(FastFlightTime, 0, MaxFlightTime /*3s*/, 0, 1);
```

Holding sprint ramps a 0→1 value over **3 seconds**, and that value drives effect intensity
continuously. This is strictly better than the online document's three hard enum tiers: the boost
*builds*, so the camera and VFX escalate rather than snapping between states. One float, no new
systems.

### 3b. Landing style is chosen by speed (`Flight.h`)

```cpp
float SuperheroLandingThreshold = 3000;   // uu/s == 30 m/s
```

Land faster than this → the three-point superhero landing montage and its VFX; slower → a soft
landing. **This answers one of the questions I was going to have to ask the user to watch the
video for.** The rule ports even though our landing is a squash on a capsule rather than a montage.

### 3c. Target lock exists as its own component (`TargetLock.h`)

```cpp
float ScanRadius   = 1000;    // 10 m
float ScanDistance = 30000;   // 300 m
```

Directly relevant to the aiming friction found in playtesting — a patrolling enemy is hard to hit
with a 1.5 m punch reach at 7.5 m/s. A soft-lock that biases aim toward a scanned target is a
known-good answer, and this is a working reference for the shape of it.

### 3d. Architecture worth noting

Flight, Combat, FlightCombat, HeatVision, TargetLock and BaseStats are **separate components**, not
one god-character. `FlightCombat` existing as its own component is the interesting part: combat
while flying is treated as its own mode rather than as ground combat with gravity off. Worth
remembering when Phase 3 step 2 arrives.

---

## 4. What does NOT port

- **Camera FOV and camera lag are driven by `AnimNotifyState`s** (`SetCameraFOV.h`: `BeginFOV =
  120`, `EndFOV = 90`; `SetCameraLag`). The *animation* drives the camera. We have no montages, so
  the same effect has to be driven from speed instead. The FOV range 90→120 is still a usable
  reference; the delivery mechanism is not.
- Niagara VFX, Chaos, anim montages, blend spaces, the whole AnimNotify layer.
- `MOVE_Flying`, `CharacterMovementComponent` — we are hand-rolled and staying that way.

---

## 5. ⚠️ Licensing and naming

**MIT licensed**, so the code may be adopted with attribution — genuinely permissive, unlike most
game repos.

**But do not copy its names.** The repo contains `Superman.cpp`, `KryptonianStats.cpp` and heat
vision naming — precisely the trademark class this project spent a whole session mapping away from
(`RENAME_MAPPING.md`, approved 2026-08-05). Take the mechanics; leave `Superman`, `Kryptonian` and
every other mark where they are. Adopting this file's ideas must not quietly reintroduce the names
we just removed.

---

## 6. Recommended order of adoption

1. **Velocity-derived lean** (§2) — biggest readability win per line, no rig, works on capsules.
2. **Continuous boost ramp + FOV/arm coupling** (§3a, §4) — camera-only, fits `TUNING`'s
   live-tunable pattern.
3. **Speed-thresholded landing** (§3b) — one comparison, real payoff in readability.
4. **Soft target lock** (§3c) — the real fix for melee aiming friction, but it is a design change
   and should be the user's call, not a silent adoption.

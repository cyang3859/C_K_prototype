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

---

## 7. Combat and heat vision — yes, and more useful than the flight material

Read from `Combat.h` and `HeatVision.h`. **Four of these map directly onto problems this project
actually hit in playtesting**, which makes them worth more than any of the flight tuning.

### 7a. Attacks dash to the target — the fix for our melee aiming friction

```cpp
bool IsWithinStrikeDistance();
bool StopWhenNearTarget(bool PendingAction);
bool IsDashingToAttack;
```

Attacking closes the distance rather than requiring the player to already be in range. This is
**exactly** the friction found on 2026-08-05: a 1.5 m punch reach against a patrolling enemy while
the hero moves at 7.5 m/s meant swings whiffed because the target drifted. The answer shipped in
this repo is not "make the hitbox bigger" — it is "let the attack carry you the last metre."
Combined with §3c's target lock, that is the real solution to melee feeling fiddly.

### 7b. Hit stop — the cheapest game-feel win available

```cpp
void StartHitStop();  void EndHitStop();
float HitStopTimer;   bool HitStopEnabled;
```

A brief freeze-frame on impact. This is the single most standard technique for making a hit feel
like it connected, it costs one timer, and it needs no art. It complements the
`STAGGER_IMMUNITY_S` work rather than duplicating it: stagger is what the *victim* does, hit stop
is what the *frame* does.

### 7c. Input buffering

```cpp
bool HasPendingAttack;  void CheckForPendingAttack();
```

An attack pressed *during* an attack is queued and plays next, instead of being dropped. Our
current model silently discards a press made during a cooldown — the HUD says "on cooldown" and
nothing happens. Buffering is what makes a combo feel responsive rather than sticky.

### 7d. Alternating strikes, non-repeating

```cpp
TArray<UAnimMontage*> StrikeL, StrikeR;
bool ArmUsed;
UAnimMontage* GetLeftOrRightStrike(bool LeftOrRight);
UAnimMontage* GetRandomMontageFromArray(int& Previous, TArray<UAnimMontage*> Montages);
```

Punches alternate arms, and the variant is drawn at random *while excluding the previous one*
(`Previous` is passed by reference for exactly that). **This one we can use immediately** — the
hero rig already has `armLeft` and `armRight` joints and `playAttack('punch')` currently always
swings the right. Alternating arms is a two-line change with a real readability payoff.

Also present: `IsBeatdown` / `Beatdown.cpp` — a finisher/flurry mode — and `CheckMovementMode`,
so combat behaves differently on the ground versus in the air. `FlightCombat` being its own
component (§3d) is the same idea at the architectural level.

### 7e. Heat vision is a SUSTAINED beam that travels, not our one-shot hitscan

```cpp
float LaserSpeed = 3000;          // uu/s — the beam EXTENDS at a speed
float LaserDistance;              // grows over time, set from a trace
void LaserDistanceCalculation(const FHitResult&, bool IsTargetGotHit);
bool IsPressingLaserEyes;         // press-and-HOLD, not a single shot
void LaserTriggered(); void LaserStarted(); void LaserCompleted(); void StopLaser();
void SpawnLaserHitSparks(const FVector& Scale);
void SpawnLaserSmoke(const FVector& Scale);
void SetMeshPhysics(UStaticMeshComponent* Target, bool Enable);
```

This is a genuinely different design from ours. Ours is an instant hitscan on a 1 s cooldown that
fires once. Theirs is **held**, the beam **extends at 3000 uu/s** until a trace stops it, and it
sprays sparks and smoke at the contact point while burning decals into the surface
(`BurnVFX.cpp`, `FBurnDecalStruct.h`) and can unfreeze physics on what it hits.

**Not a bug in ours — a fork.** A held beam you sweep across a target is a different feel from a
committed one-shot, and the 2D prototype's laser is a one-shot, so ours is the faithful port. But
if the user wants the sustained-beam feel, the pieces are: a beam length that ramps at a speed
rather than snapping to the hit point, and a hold input rather than an edge.

Our recently-added impact glow (`AttackFX.js`) is the same instinct as their hit sparks + smoke,
which is mild corroboration that endpoint VFX is the right call for a beam.

### Ranked for adoption

| | Why | Cost |
|---|---|---|
| 1. Alternating L/R punch | rig already has both arms; `playAttack` always swings right | ~2 lines |
| 2. Hit stop | biggest feel-per-line win in the whole repo | one timer |
| 3. Attack dash-to-target | the actual fix for the melee whiffing found in playtest | moderate |
| 4. Input buffering | turns "on cooldown, nothing happened" into a queued swing | small |
| 5. Sustained beam | a design fork, not a fix — user's call | moderate |

# Research: The "Superman UE5" fan demo — what's sourceable, and what it does/doesn't offer `kodaman3d`

**Status:** complete within the honesty constraint stated below. Every claim is cited inline;
anything not cited is marked **Inference:**.

**Method note, read before trusting anything below:** I cannot watch video. The YouTube video at
`https://youtu.be/VIwIlmxMYI4` is a **third-party reaction/coverage video by the channel gameranx**
(`This Unreal Engine 5 Superman Demo is MIND BLOWING [4K]`, confirmed via oEmbed lookup — author
`gameranx` / `@gameranxTV`), published April 21 2022 per search-indexed date — **it is not the
developer's own devlog**, it is commentary footage of someone else's build. YouTube's watch page is
JS-rendered and returned no fetchable description, chapters, or comments through either direct
fetch or an oEmbed proxy — those fields could not be recovered by any tool available to me, video
or text. Everything below therefore comes from the **developer's own itch.io page and comment
replies**, his portfolio/ArtStation pages (partially blocked — see Gaps), a Twitter/X post, and one
third-party article (dsogaming.com) that quotes him directly. Where a claim could only come from
watching the gameplay footage itself, I say so and do not guess.

**Correction to this task's framing:** the brief describes `kodaman3d` as "primitives-only until
Phase 5." Per `docs/handoff/PIPELINE_STATE.md` locked decision 9, skeletal animation was **pulled
forward into Phase 2** (not deferred to Phase 5) on 2026-07-30, and Phase 2 world/character work is
done — the project is now in Phase 3 (combat). But no rigged/skinned hero has actually landed yet
(decision 9 is a plan the Engineer has not executed; the hero is still 7 primitives per the
`Hero.js` note in `PIPELINE_STATE.md`). So the practical reality this document plans against is
correct — **no skeletal animation exists in the running game today** — but the phase number in the
brief is stale. I use "the animation pipeline, once it lands" below rather than "Phase 5."

---

## Part 1 — What the sources actually say

### 1a. The itch.io page itself

Source: [tjatomica.itch.io/superman-ue5](https://tjatomica.itch.io/superman-ue5), "A Superman
Style Flight Experience (UE5)" by Tyson Butler-Boschma.

Direct quotes recovered from the page:
- **"This project was built simply as a test for what a future Superhero game like Superman might
  be like in a large scale modern city running on UE5."**
- **"This game uses Epic's The Matrix Awaken's Project City and replaces the character with a
  flying superhero variant"** — i.e. the environment is Epic's own **Matrix Awakens "City Sample"**
  megacity demo, not an original level; only the player character is his.
- **"this character isn't Superman and I have made sure this is totally free"** — legal-cover
  language distancing the character design from the DC trademark.
- **"this is an incredibly heavy game and lower end PC's will struggle"** and **"this is based on
  Epic's Matrix Demo, just for fun, and I haven't done any kind of optimisation myself"** — he is
  explicit that this is an unoptimized tech demo riding on someone else's (Epic's) heavyweight
  showcase content, not a from-scratch playable game.
- **"And no, I am not currently working on this in any major compacity further."** — no active
  development; there will be no further devlog to mine later.
- Credit line: **"Shout out to Alec Shea for helping me with some SFX work."**
- Rating at time of fetch: 4.8/5 from 27 ratings.

**No flight-model numbers, no animation list, no combat description, and no engine-version number
appear on the page itself.** Everything else below had to be triangulated from comments and
off-site sources.

### 1b. Combat: explicitly absent, confirmed by a direct comment exchange

A commenter, `kalledTV`, wrote on the itch.io page (quoted verbatim from the comment thread):
**"fantastic game but I can't hear the sonic boom when I fly or any other type of noise produced by
the hero. p.s. If you could add fight mode and heat vision it would be awesome."**

This is the single most useful sourced fact for the "combat mechanics" priority in this brief: **a
player asking for heat vision and a "fight mode" is direct evidence that neither exists in the
shipped build.** No comment, reply, or page text describes melee, heat vision, freeze breath, super
strength, lock-on, or hit reactions as present. **Verdict: this demo is flight-only. There is no
combat system to reverse-engineer from text sources, and the video cannot be watched to check
whether something combat-adjacent appears that was never described.**

The same comment is also evidence of an intended-but-broken feature: a **sonic boom sound effect**
was apparently supposed to trigger at speed and didn't play for this user (audio bug, or missing
from that build) — so a "sonic boom" concept exists at least as an SFX cue tied to flight speed,
per this thread, corroborating the brief's suspicion that a speed-triggered audio/FX moment is part
of the intended design even where the video can't be watched to confirm the visual side.

Source: itch.io comment thread on
[tjatomica.itch.io/superman-ue5](https://tjatomica.itch.io/superman-ue5) (comment by `kalledTV`).

A separate comment by `iignored` requested **cape physics improvements, citing clipping issues** —
confirming the character does have a simulated/physics cape that clips against geometry, but
nothing about how it's implemented (cloth sim vs. bone-driven vs. Chaos) is stated anywhere in
text.

### 1c. Flight model: only what a developer reply and an asset listing state

Direct developer reply, from a separate itch.io comment thread (source:
[itch.io/post/5750697](https://itch.io/post/5750697)): **"It uses the Epic Matrix demo as a base
for the city. It's more just a proof of concept."** This is the developer's own characterization —
"proof of concept," not a designed, tuned flight model with documented speed tiers or camera
behavior. **No numbers (speed tiers, FOV values, camera lag, boost thresholds) are stated anywhere
in the sources I could reach.**

The one concrete technical fact about the flight *system* (not the tuning) comes from the credited
third-party animation asset, not from the developer's own words — see 1d below.

### 1d. Animation: the asset pack is identified, and its own listing describes what it contains

Search results (not a page I could fetch directly — the primary Fab.com/Marketplace listing pages
returned 403/expired-certificate errors, see Gaps) surfaced that the demo credits/uses
**"Superhero Flight Animations" by Indie-us Games**, sold on Epic's Fab marketplace (formerly the
Unreal Engine Marketplace):
[unrealengine.com/marketplace/.../155fca2ed82d4823b560985b07c6361a](https://www.unrealengine.com/marketplace/en-US/item-detail/155fca2ed82d4823b560985b07c6361a/questions).
Per the search-indexed listing summary (not independently re-verified by opening the live page,
so treat this tier as **secondary, not primary**):
- The pack is **"a set of animations, additive poses, simple VFX, and Blueprints to form a flight
  system,"** compatible with **UE5 mannequins** but explicitly **not built on UE5 Control Rig.**
  If accurate, that means this specific demo's flight animation is **not** an example of the
  UE5 Control Rig / Motion Warping workflow the brief asked me to look for — it's an
  additive-pose-on-a-standard-skeleton approach, which is actually a simpler, more portable
  technique than Control Rig-driven IK.
- Listed contents (per the same secondary summary): **5 hover-mode and fast-flight-mode
  animations**, a third-person character Blueprint, an Animation Blueprint, **blend spaces**, and
  simple VFX; Blueprints/VFX are described as network-compatible and use physics materials to
  spawn effects (implying landing/impact VFX keyed to what surface material is hit).
- **I could not independently confirm the exact animation names** (no "Takeoff," "Hover Idle,"
  "Dive," "Landing" list was recoverable verbatim) — the "5 animations" count is as specific as the
  source gets. **This is exactly the kind of claim that needs the user's own eyes on the asset
  listing or the video to firm up** (see Gaps).

**No mention anywhere in text sources of Mixamo.** The asset is a paid/free marketplace pack
(Indie-us Games), not Mixamo, not fully custom, and not stated to use Control Rig. That directly
answers the brief's "Mixamo vs. marketplace vs. custom vs. unstated" question for the flight poses:
**marketplace pack, named and identifiable, built on standard skeleton + additive poses + blend
spaces, not Control Rig.**

### 1e. What the developer has said about how it was built, and his own history with the project

- Direct quote via [dsogaming.com](https://www.dsogaming.com/news/this-cool-superman-unreal-engine-5-demo-is-available-for-download/)
  and corroborated by [80.lv](https://80.lv/articles/a-new-superman-game-prototype-made-in-unreal-engine-5):
  **"I dream of a modern Superman game and, with the release of UE5, seemed like fertile ground for
  some experimentation with the amazing packages Epic has made available."**
- dsogaming.com states this is **his second Superman UE5 demo** — a first version existed in **June
  2021** (pre-UE5-public-release, likely an early-access-build experiment), and the April 2022
  version discussed here is the first one he made **publicly downloadable**. This detail could not
  be cross-verified against a second independent source and should be treated as single-sourced.
- His own tweet (found via search, full text not independently re-fetched — X/Twitter returned
  HTTP 402 on direct fetch, see Gaps) is indexed as saying: **"With the release of #UE5 and after
  being inspired by @volodXYZ's amazing video, I decided to revisit my own #Superman demo from last
  year and move it to the #UE5's Matrix city..."** — this states the demo is a **port of a
  pre-existing project onto Epic's Matrix Awakens city**, and names an inspiration source
  (`@volodXYZ`) that I did not further pursue (out of scope, and a second-hand inspiration chain
  rather than this demo's own build notes).
- **No mention anywhere in the reachable text** of Blueprints-vs-C++ split, Motion Warping, Control
  Rig (the asset listing explicitly says the flight pack does *not* use it), Chaos destruction, or
  Niagara specifics beyond the asset listing's generic "simple VFX." **This item from the brief's
  priority list is mostly a gap, not a finding** — see Gaps.

His job title, confirmed on his own portfolio site nav (the only part of that site that actually
loaded through my fetch tool — see Gaps for what didn't): **"Creative Director / Lead Unreal Engine
Lighting & Technical Artist / Games Designer."** He is a lighting/technical artist by trade, which
is circumstantial support for "impressive-looking tech demo built by stitching together Epic's own
best-in-class environment sample with a purchased animation pack," consistent with everything else
sourced above, rather than a from-scratch gameplay-systems build.

---

## Part 2 — What can be adopted cheaply in Three.js *now*, no rig required

None of this is sourced from the demo's own tuning (no numbers were recoverable — see Part 1c).
These are ideas the sourced material makes *plausible as a target*, evaluated against what's
already true of `kodaman3d`'s current primitives-only, no-physics-engine, fixed-timestep hero.

- **A speed-triggered camera/FOV/VFX moment tied to a "sonic boom" concept.** Sourced only as far
  as "a sonic boom sound effect was intended to exist at speed" (1b) — the visual treatment is not
  described anywhere in text. **Inference:** widening FOV and adding streak/speed-line geometry
  past a velocity threshold is standard practice across the genre generally (not sourced to *this*
  game specifically) and is pure camera/shader work — no skeleton needed. This is squarely in reach
  of the current `CameraRig`/`TUNING` object described in `CLAUDE.md` and costs nothing beyond a
  velocity check plus an FOV lerp and a particle/line-billboard system, which the project already
  has primitives and materials for.
- **Camera behavior at speed (arm length, lag) as a tunable, not an animation.** Same reasoning —
  camera rig tuning is data, not rig-dependent, and is exactly the kind of thing `cameraRig.tuning`
  already exposes live per `CLAUDE.md`.
- **"Proof of concept" as the honest bar to hold this comparison to.** The developer's own words
  (1c) — "It's more just a proof of concept" — mean there is no tuned flight-feel target to chase
  from this source. **Do not treat "the Superman demo" as a spec with hidden numbers to reverse
  engineer; there don't appear to be any published.** This is itself a useful (if negative) finding
  for whoever picks this up next: stop looking for numbers that were never written down.
- **Landing/impact VFX keyed to surface material**, per the asset-pack summary in 1d ("physics
  materials to spawn effects"). **Inference, cheap today:** `kodaman3d`'s landing state already
  knows what it's landing on if raycasts report a material/tag; a small dust/impact-particle swap
  keyed by ground material is a data-table change, not an animation-system change.
- **No combat carryover to adopt** — Part 1b establishes the source demo has none. `kodaman3d`'s
  own Phase 3 combat work (heat vision/laser, freeze, punch — per `PIPELINE_STATE.md`'s
  2026-08-05 entries) is **ahead of this reference game**, not behind it, on combat. This source is
  not useful for combat design at all; it should not be cited as precedent for how flight and
  combat combine, because the reference game evidently never combined them.

---

## Part 3 — What needs the (not-yet-built) skeletal animation pipeline

Everything about *how the demo's flight looks* — hover idle pose, forward-flight lean angle,
dive silhouette, landing pose (soft vs. three-point), and the takeoff/landing transition itself —
is gated behind two separate blockers, and this document cannot remove either one:

1. **It's gated behind information I could not source.** The Indie-us Games asset listing (1d) is
   the closest thing to a spec, and even that only gives a count ("5 hover/fast-flight animations")
   and a technique (additive poses + blend spaces on a standard skeleton, not Control Rig) — not
   named clips, not curves, not timing. **The video would show the actual poses, but I cannot watch
   it.**
2. **It's gated behind `kodaman3d`'s own roadmap.** Per `PIPELINE_STATE.md` locked decision 9,
   skeletal animation now targets Quaternius rigs (decision 15) via glTF, explicitly **not**
   Mixamo, and no rig has landed in the running game yet. Every item below is therefore blocked on
   that work landing first, regardless of what this research finds:

- **Named flight animation states** (takeoff, hover idle, forward-lean cruise, dive, landing).
  Cannot be sourced from text; would require either watching the video frame-by-frame or opening
  the Indie-us Games asset's own clip list inside the Unreal editor/marketplace preview (neither
  available to a text-only research pass).
- **Additive-pose-on-blend-space as a *technique*, not clip names, is the one transferable idea**
  from 1d: once `kodaman3d` has a rigged hero with a base locomotion blend space (already the plan
  per Quaternius decision 15), layering a flight lean/bank as an **additive** pose on top of a
  base pose — rather than authoring fully separate baked clips per lean angle — is a cheaper
  authoring pattern than one-clip-per-state, and Three.js's `AnimationMixer` supports additive
  blending (`.setEffectiveWeight` + additive clip mode) natively. This is genuinely worth carrying
  into the animation-pipeline research when it starts, but it is a **technique borrowed from the
  asset listing's own description of itself, not a fact about what this specific demo's poses look
  like.**
- **Cape behavior.** Confirmed only that a cape exists and clips through geometry per a user
  complaint (1b) — no information on whether it's cloth-simulated, bone-driven, or a shader trick.
  Not usable as a spec for anything.
- **Punch/heat-vision/freeze-breath poses.** Not sourced at all — Part 1b establishes these
  features don't exist in this demo, so there is nothing to port even once the rig lands.

---

## Part 4 — What could not be verified / needs the user's own eyes

Being specific and generous here, per the brief:

1. **Everything demonstrated only in the video itself** — this is the big one. I cannot watch
   `https://youtu.be/VIwIlmxMYI4`. Specifically unrecoverable by any text-based method I have:
   - Whether forward flight visually follows camera aim or is decoupled (the asset listing's blend
     spaces don't say; this is a feel question only visible in motion).
   - Actual takeoff and landing animation shapes (soft two-foot landing vs. Superman's iconic
     three-point crouch-punch landing) — never described in any text source found.
   - Whether speed lines, motion blur, a sonic-boom shockwave ring, or any other speed-VFX are
     visually present — only the *sound effect* is textually confirmed as intended (1b); the visual
     treatment is unconfirmed.
   - Actual hover idle pose, dive silhouette, and flight-to-ground transition animation quality —
     zero text description exists.
   - Camera FOV/arm-length/lag behavior at any speed tier — no numbers or even qualitative
     description recoverable from text.
2. **The video's own description, chapters, and comments** — YouTube's page did not yield fetchable
   text through direct WebFetch or an oEmbed proxy (title/author only). If the user can open the
   video directly, the description box and pinned/top comments may contain detail (dev commentary,
   a build link, timestamps) that no tool available to me could reach.
3. **The exact animation clip list and names** from the Indie-us Games "Superhero Flight
   Animations" pack — the canonical listing pages (`fab.com`, `unrealengine.com/marketplace`, and a
   mirror site) each failed to load (403 Forbidden ×2, one expired TLS certificate). Only a
   search-engine-indexed summary of that listing was recoverable, which I've flagged as
   secondary-sourced throughout Part 1d, not independently verified against the live page.
4. **Tyson Butler-Boschma's ArtStation project page**
   ([tjatomica.artstation.com/projects/vJxKEE](https://tjatomica.artstation.com/projects/vJxKEE))
   and his **own portfolio project page**
   ([tysonbb.com/a-superman-style-flight-experience-ue5](https://www.tysonbb.com/a-superman-style-flight-experience-ue5/))
   both returned only site navigation/header through WebFetch — both are JS-rendered pages whose
   actual body content (which may include his own written technical breakdown, exactly the kind of
   "how it was built" material the brief prioritizes) never reached the fetch tool. **These are the
   single most promising unexplored leads** — a developer's own portfolio writeup is normally the
   best source for build details, and it exists but couldn't be read.
5. **The full text of his X/Twitter post and any reply thread**
   ([x.com/TJATOMICA/status/1515322676856127493](https://x.com/TJATOMICA/status/1515322676856127493))
   — returned HTTP 402 on fetch; only a search-engine-indexed partial quote was recoverable.
   Twitter/X threads often contain the most candid build commentary; unreachable here.
6. **Engine version number.** Never stated in any reachable source — only "UE5" generically.
7. **Whether Blueprints, C++, Motion Warping, Chaos, or Niagara specifically were used.** The one
   concrete technical claim found (the flight asset does *not* use Control Rig) is second-hand via
   a search summary, not a page I read myself. Everything else in this category is an unfilled gap,
   not a "no" — absence of a source is not evidence the systems weren't used.
8. **Any devlog, postmortem, or Discord content.** The developer states he is not actively
   developing this further and none of the sources found point to a devlog beyond the itch.io
   comment replies quoted above. If a Discord exists (one non-developer commenter offers to share a
   download link "via discord"), I did not and could not join it to check for pinned build notes.

**Bottom line for the user:** if you want the animation *shapes* (lean angles, landing pose, hover
silhouette) — the thing this task's priority list actually ranks #1 and #2 — the video and the two
blocked portfolio pages (#4 above) are where that lives, and none of it is recoverable through text
tools. Everything sourced in Parts 1–3 above is real and citable, but it answers "what pack did he
use and what does the community say is missing," not "what does the flight actually look like."

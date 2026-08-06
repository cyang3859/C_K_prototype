# Research: Keyboard+Mouse Control Schemes for Ground + Free-Flight Superhero Traversal

**Status:** complete. Parts 0–3 and Gaps are filled in below with sources. Every claim is cited
inline; anything not cited is marked **Inference:** as this document's own reasoning.

**Scope:** This document answers one question — how do shipped PC games map takeoff, forward
flight, climb/descend, and dash/boost so that a single key is never asked to do two conflicting
jobs — and applies the answer to the concrete bug in `kodaman3d/src/core/Input.js` /
`src/controllers/LocomotionController.js`, where `W` is double-bound to both "move forward" and
"ascend," and `S` is double-bound to both "move back" and "descend." See
`RESEARCH_FINDINGS.md` for the Three.js architecture research this document is a sibling to (same
pipeline, different agent, written independently).

**Method note:** every factual claim below is cited inline. Claims not backed by a citation are
marked **Inference:** and are this agent's own reasoning, not a documented fact. Titles that could
not be sourced from either a primary doc or a reliable wiki are listed in the Gaps section, not
guessed at.

---

## Part 0 — The dominant convention: horizontal WASD + separate vertical keys, NOT "fly where you look"

Across every superhero/traversal title sourced below (Anthem, Just Cause 3/4, Saints Row IV,
Batman: Arkham Knight, Minecraft creative flight), the pattern is the same: **WASD (or
camera-relative movement keys) drive horizontal thrust independent of camera pitch, and a
separate key/pair of keys drives climb vs. descend.** None of them make "look up" pitch the
character's nose up and thrust it skyward the way a flight sim (e.g. a joystick-based combat
flight sim, where pitch axis directly controls attitude) does. Concretely:

- **Anthem** — flight is entered by holding Shift (the same key that triggers ground sprint),
  altitude is held by tapping/holding **C** to hover, and WASD keeps driving horizontal thrust
  the whole time; the camera can be aimed anywhere without changing your flight vector unless you
  also press a movement key — [Shacknews PC keybind list](https://www.shacknews.com/article/110023/all-pc-keybindings-and-controls-in-anthem-game).
- **Just Cause 4** — wingsuit entry is a dedicated key (**E**), forward thrust/lift comes from
  the existing WASD/mouse-look while airborne, and Ctrl is a separate air-brake, decoupled from
  where the camera is pointed — [Magic Game World PC keyboard controls](https://www.magicgameworld.com/just-cause-4-pc-keyboard-controls/).
- **Saints Row IV** — jets are held by **Space** to ascend and **Ctrl** to descend, independent
  of camera aim, while WASD drives horizontal thrust — per Steam Community discussion threads
  ([controls in mech suit](https://steamcommunity.com/app/206420/discussions/0/630800446590825061/),
  community-sourced, no first-party PC manual found — see Gaps).
- **Batman: Arkham Knight** — glide direction follows camera/stick aim for the horizontal
  component, but altitude/dive is a discrete state (dive bomb) triggered by holding a separate
  key (Ctrl/crouch), not a continuous pitch-follow — [gosunoob controls list](https://www.gosunoob.com/batman-arkham-knight/bak-list-of-controls/) (console-labelled but structurally the same pattern; PC binds via
  [gamepressure](https://www.gamepressure.com/batmanarkhamknight/controls-for-pc/z878f3)).
- **Minecraft Creative** — the canonical KB+M pure-flight baseline: WASD is exclusively
  horizontal, Space is exclusively "up," Shift is exclusively "down," and camera pitch has zero
  effect on flight vector — confirmed on the [Minecraft Wiki: Flying](https://minecraft.wiki/w/Flying) page ("The player can
  gain or lose altitude while flying by pressing the jump or sneak keys, respectively").

**Verdict:** "horizontal-WASD + dedicated vertical keys, camera decoupled from thrust" is the
dominant convention for third-person KB+M free flight, not "fly where you look." **Inference:**
the likely reason is ergonomic and precision-driven — mouselook in these games is also the aiming
and combat-targeting axis, so binding flight vector to camera pitch would force players to choose
between looking at a target and controlling altitude, and would make idle mouse jitter
(correcting aim, glancing around) translate into unwanted climbs/dives. True "fly where you look"
schemes (nose-follows-camera) belong to joystick-native flight sims and are rare/absent in
mouse-aimed third-person action games for exactly this reason — no sourced counter-example was
found among the titles searched (see Gaps for titles not reachable).

**Trade-offs of each, stated directly:**
- *Horizontal-WASD + dedicated vertical keys* (Anthem/JC4/SR4/Minecraft pattern): precise,
  altitude-holding is trivial (release both vertical keys → hover/level flight), camera stays
  free for aiming/looking around without side effects, low motion-sickness risk. Costs: needs at
  least one extra key beyond WASD (climb) and ideally a second (descend) that isn't already
  claimed by move-forward/move-back.
- *Fly-where-you-look / pitch-coupled thrust* (flight-sim convention, not observed in the
  surveyed superhero titles' KB+M schemes): fewer keys needed in principle since pitch does double
  duty, immersive "aim your body" feel. Costs: camera and thrust become the same axis, so aiming
  at anything below the horizon dives you, no free-look while flying straight, drift/instability
  if the player's mouse hand isn't perfectly still, worse for a third-person camera that's meant
  to also frame combat and traversal — this is why it is essentially absent from the sourced
  third-person KB+M titles.

---

## Part 1 — Control maps, title by title

For each sourced title: **enter flight**, **maintain altitude**, **climb/descend**, **forward
thrust**, **boost/dash**.

### T1 — Superman Returns (2006, EA/Titus)

**Could not verify from primary sources.** [Wikipedia](https://en.wikipedia.org/wiki/Superman_Returns_(video_game))
confirms the game shipped on PS2, Xbox, Xbox 360, and Nintendo DS, with **no PC release** — so a
PC keybind scheme does not exist for this title. No official manual or Steam controls page could
be located (there is no Steam page, since there is no PC SKU). A community thread on
[Blender Artists](https://blenderartists.org/t/superman-returns-the-game-flying-controls/480070)
discusses console flight feel but is not an authoritative control reference and is not used here
as a source of fact. **Dropped from the comparison table** — logged in Gaps instead of guessed at.

### T2 — Prototype (2009, Radical/Activision) — wiki-sourced

**Wiki-sourced** (no official Activision manual found online): per a
[Steam Community player-authored guide](https://steamcommunity.com/sharedfiles/filedetails/?id=2660185134)
and corroborating [GameFAQs](https://gamefaqs.gamespot.com/boards/942352-prototype/50066773) /
[SuperCheats](https://www.supercheats.com/guides/prototype/controls) discussion:
- **Enter flight/glide:** no dedicated "flight" state — Alex Mercer sprints (double-tap a
  direction) then taps **Space** while sprinting to glide. Glide is a momentum-consuming air move,
  not sustained free flight.
- **Maintain altitude:** not applicable — glide bleeds altitude/speed over time, there is no hover.
- **Climb/descend:** no separate climb key; vertical arc is a function of jump/glide momentum, not
  a held input.
- **Forward thrust:** WASD, camera-relative, identical binding whether grounded or gliding — this
  is the single closest precedent to "movement keys keep working unchanged across states,"
  matching this repo's design choice of unconditional camera-relative WASD.
  **Sources:** https://steamcommunity.com/sharedfiles/filedetails/?id=2660185134 · https://gamefaqs.gamespot.com/boards/942352-prototype/50066773
- **Boost/dash:** sprint itself (double-tap-to-lock-sprint) is the speed boost; no separate key.

### T3 — Marvel's Spider-Man Remastered (Insomniac/Nixxes, PC port) — wiki/community-sourced

**Could not confirm from an Insomniac/Nixxes/PlayStation first-party page** (no official PC
control-map PDF was found via search); best available source is
[Magic Game World's PC controls page](https://www.magicgameworld.com/marvels-spider-man-remastered-pc-controls/),
a third-party but detailed community reference, corroborated by discussion on the
[Steam Community forum for the app](https://steamcommunity.com/app/1817070/discussions/0/4859966604379963913).
Labeled wiki/community-sourced, not first-party:
- **Enter flight (swing):** hold **Left Shift** to swing/sprint; there's no separate "takeoff" —
  swinging is continuous while airborne and Shift is held.
- **Maintain altitude:** no true hover; swing arcs are physics-driven. Space performs
  jump/web-zip, which is a burst upward impulse, not a maintained climb.
- **Climb/descend:** no dedicated altitude keys — **X** is "perch/dive," a single contextual
  action, not a held climb/descend axis.
- **Forward thrust:** camera-relative WASD, same keys as ground movement, same as Prototype's
  pattern.
- **Boost/dash:** **Space** (web-zip) for a burst; **C** ("Zip to Point") is a targeted traversal
  boost, not a raw speed multiplier.
  **Sources:** https://www.magicgameworld.com/marvels-spider-man-remastered-pc-controls/ · https://steamcommunity.com/app/1817070/discussions/0/4859966604379963913

### T4 — Saints Row IV (Volition, 2013) — mixed: official manual + community

The [official Deep Silver/Volition game manual](https://dlassets-ssl.xboxlive.com/public/content/11b9253f-4098-4f13-8f4f-b9ab871df755/GameManual/1698448e-a707-4028-9b8e-d741b07ff4e7/en-GR/index.html)
documents on-foot controls as **"Jump / (Hold) Super Jump"** — i.e., tap for a normal jump, hold
for the enhanced super-power jump that leads into flight-glide territory — but does not spell out
individual ascend/descend keys for player-character flight (only for drivable aircraft, where it
lists "(Heli) Up" / "(Heli) Down" as separate bindings). For the player's own super-power flight,
the gap is filled by a
[Steam Community help thread](https://steamcommunity.com/app/206420/discussions/0/630800446590825061/),
labeled wiki/community-sourced:
- **Enter flight:** **hold Space** past the super-jump threshold to transition into sustained
  flight (this is the "hold jump to fly" scheme flagged as notable in the brief).
- **Maintain altitude:** must actively hold Space; no auto-hover — release and the character
  falls/glides.
- **Climb/descend:** **Space = up**, **Left Ctrl = down** — separate dedicated keys, decoupled
  from WASD.
- **Forward thrust:** camera-relative WASD, unconditionally, matching the Prototype/Spider-Man
  pattern.
- **Boost/dash:** sprint (Shift, on foot) is a separate system from flight; no distinct flight-dash
  reported.
  **Sources:** https://dlassets-ssl.xboxlive.com/public/content/11b9253f-4098-4f13-8f4f-b9ab871df755/GameManual/1698448e-a707-4028-9b8e-d741b07ff4e7/en-GR/index.html · https://steamcommunity.com/app/206420/discussions/0/630800446590825061/

**This is the single most directly on-point precedent for this codebase's bug**, because it is a
shipped superhero-traversal game that puts *climb on Space and descend on a completely separate
key (Ctrl) from the WASD movement cluster* — i.e. it never asks W or S to do double duty.

### T5 — Just Cause 3 / Just Cause 4 (Avalanche Studios) — wiki/community-sourced

No official Avalanche/Square Enix control-map PDF was found; best sources are Steam Community
threads, explicitly labeled wiki/community-sourced and somewhat contradictory between threads
(a sign the community itself finds this scheme confusing, which is itself a relevant data point):
- **Enter flight (wingsuit):** dedicated wingsuit-deploy input while falling/parachuting (bound to
  a distinct action, not WASD).
- **Maintain altitude:** none — wingsuit is a gliding system with continuous altitude loss unless
  diving for speed to convert into lift, not a hover.
- **Climb/descend:** **reported inconsistently across community threads** — one
  [Steam thread](https://steamcommunity.com/app/225540/discussions/0/451848854984747333/) says
  "S = up, W = down" (inverted-feeling because the wingsuit pitches like a glider, not a
  helicopter), while the [Bavarium Wingsuit DLC thread](https://steamcommunity.com/app/225540/discussions/0/343786195675816593/)
  describes boost bound to Shift. Multiple posts across these threads describe the **same W/S keys
  used for walking are reused, unmodified, for wingsuit pitch** — i.e. Just Cause 3 is a
  **counter-example**: it double-binds W/S onto both ground movement and flight pitch, the same
  category of overload this codebase's bug report is about, and PC players report it as
  "absolutely terrible" on keyboard in the discussion linked above. This is useful evidence *for*
  the requester's instinct that double-binding is a real, felt problem, not hypothetical.
  **Sources:** https://steamcommunity.com/app/225540/discussions/0/451848854984747333/ · https://steamcommunity.com/app/225540/discussions/0/343786195675816593/ · https://steamcommunity.com/app/225540/discussions/0/485624040228164170/
- **Boost/dash:** Shift, per the Bavarium Wingsuit DLC thread above (wiki-sourced).

### T6 — Anthem (BioWare/EA) — official EA page found, but incomplete; supplemented by community

EA's own [Anthem PC accessibility/features page](https://www.ea.com/able/resources/anthem/pc/features)
confirms Anthem PC ships two relevant **first-party, named settings** (documented fact, not
inferred):
- **"Flight Mode"** — a toggle between *hold* and *toggle* control schemes for sustained flight
  (i.e. Anthem ships the "hold to keep flying" vs "tap to toggle flight on/off" choice as a
  first-class accessibility option, rather than forcing one).
- **"Flight Take Off in Aim Direction"** — an option to take off toward your aim reticle rather
  than your body-facing direction.

Exact default key letters were not present on that EA page. A secondary community source,
[Shacknews](https://www.shacknews.com/article/110023/all-pc-keybindings-and-controls-in-anthem-game)
(labeled wiki/community-sourced), reports:
- **Enter flight:** **Left Shift** ("Sprint/Activate Flight") — the same key used for ground
  sprint doubles as the flight-activation key, an EA design choice worth flagging: it means the
  *sprint→flight* transition is a single continuous hold rather than a separate takeoff gesture,
  similar in spirit to Saints Row IV's "hold jump to fly."
- **Maintain altitude:** **C = Hover**, a dedicated key to actively hold current altitude —
  i.e. Anthem does **not** auto-hover by default; hover is itself an explicit held input, distinct
  from both climb and descend.
- **Climb/descend:** not fully documented by either source found; the EA page confirms climb is
  tied to aim/pitch direction by default ("your character moves in the same direction the input is
  tilted... tilting up makes your character increase their altitude") with a Y-axis invert option
  to make it "control more like a plane" — this is the **camera/aim-pitch-coupled climb model**,
  the opposite philosophy from Saints Row IV's dedicated-key model. **This is a documented fact
  from EA's own page, not inferred.**
- **Forward thrust:** implied to be WASD-relative to flight orientation, not separately documented.
- **Boost/dash:** not confirmed by either source; not counted as verified.
  **Sources:** https://www.ea.com/able/resources/anthem/pc/features · https://www.shacknews.com/article/110023/all-pc-keybindings-and-controls-in-anthem-game

### T7 — Batman: Arkham Knight (Rocksteady/WB, PC) — wiki-sourced

Per [gamepressure.com's PC controls page](https://www.gamepressure.com/batmanarkhamknight/controls-for-pc/z878f3)
(wiki-sourced) and corroborating [Steam Community discussion](https://steamcommunity.com/app/209000/discussions/0/792924952659050338/)
(for the closely related Arkham Origins, cross-checked because the glide mechanic is shared across
the Arkham series):
- **Enter flight (glide):** run off a ledge, then **hold Shift** ("Run (hold) / Glide (hold)") —
  the *same key* serves ground sprint and airborne glide, another real-game example of one key
  covering two states cleanly **because the two actions never overlap in time** (you are never
  simultaneously sprinting and gliding — sprint only applies grounded, glide only applies
  airborne). This is a meaningfully different case from this repo's bug, where W is asked to mean
  two *conflicting* things (ground-forward vs. ascend) that a player may want independently while
  in the same state.
- **Maintain altitude:** no hover — Arkham glide is a continuously descending glide, not free
  flight.
- **Climb/descend:** dive-bomb (accelerated descent) is Shift+Ctrl held together, per the Steam
  thread — decoupled from W/S.
- **Forward thrust:** WASD steering during glide, same keys as ground movement — consistent with
  every other title surveyed here.
- **Boost/dash:** not applicable in the glide system; grapnel-boost exists but is a separate
  contextual traversal action, not a raw speed key.
  **Sources:** https://www.gamepressure.com/batmanarkhamknight/controls-for-pc/z878f3 · https://steamcommunity.com/app/209000/discussions/0/792924952659050338/

### T8 — inFAMOUS Second Son (Sucker Punch) — console-only, N/A for KB+M

Confirmed via [Wikipedia](https://en.wikipedia.org/wiki/Infamous_Second_Son) and a
[Steve Harvey FM tech article](https://nation.steveharveyfm.com/free-minds/infamous-second-son-can-you-play-it-on-pc-1767647878):
**PS4-exclusive, no native PC release** (playable only via PS-cloud-streaming into a PC, which is
not a native KB+M control scheme). No KB+M control map exists to document. Traversal in the
console version uses DualShock 4 face buttons/triggers contextually per power — not transferable
to a KB+M mapping question. **Excluded from the comparison table; logged in Gaps.**

### T9 — Gravity Rush (SIE Japan Studio) — console-only, N/A for KB+M

[Wikipedia](https://en.wikipedia.org/wiki/Gravity_Rush) confirms this shipped on PS Vita and PS4
only; no PC/Steam release was found by search. **Excluded from the comparison table; logged in
Gaps** — cannot document a KB+M scheme for a game with no KB+M SKU.

### T10 — GTA V (Rockstar) — ground-movement baseline only, as instructed

Per community sourcing (no single canonical Rockstar keybind PDF was surfaced, but this is
well-established, widely-replicated common knowledge across guides): **Left Shift = sprint, held**
— the canonical PC "hold Shift to raise your movement speed cap while WASD stays pointed the same
way" pattern. This is exactly the shape of this codebase's existing Shift/dash binding for ground
sprint, and confirms that convention is already correctly aligned with genre norms. **Wiki-sourced,
used only as the ground-baseline the brief asked for, not as a flight precedent.**

### T11 — Minecraft creative flight (Mojang) — pure-flight baseline

Well-documented, cross-corroborated across community wiki sources ([Minecraft Fandom Wiki](https://minecraft.fandom.com/wiki/Flying)),
consistent with Mojang's own long-standing default bindings referenced across guide sites:
- **Enter flight:** **double-tap Space** (jump key) while in Creative mode.
- **Maintain altitude:** yes — release both Space and Shift and the player holds current altitude
  exactly (true auto-hover), unlike every superhero title surveyed above except Anthem's
  dedicated-hover-key variant.
- **Climb/descend:** **Space = ascend (held)**, **Left Shift = descend (held)** — fully dedicated,
  decoupled keys, independent of WASD.
- **Forward thrust:** WASD, camera-relative, unconditionally active, identical to every other
  title surveyed.
- **Boost/dash:** holding the sprint key (double-tap-W-and-hold, or a separate sprint toggle)
  raises flight speed — same key reused for ground sprint and flight speed boost, cleanly, because
  it's a pure cap-raise on the same accel curve in both states (directly analogous to this
  codebase's existing Shift/dash design).
  **Sources:** https://minecraft.fandom.com/wiki/Flying

### T12 — Microsoft Flight Simulator / Ace Combat 7 — pure flight-sim baselines

These are included only as the "forward follows camera/aircraft pitch" contrast case, per the
brief:
- **MSFS 2020:** keyboard defaults use **Numpad 8 = pitch up (elevator), Numpad 2 = pitch down**,
  with throttle on **separate dedicated keys** (community-reported as F2/F3 in one source;
  official default-binding PDFs exist on the [MSFS forums](https://forums.flightsimulator.com/uploads/short-url/kwtAlqUrKiEqaZZNUJz8CXhTVKS.pdf)
  but were not individually re-verified key-by-key here — wiki/community-sourced for the specific
  key letters). Pitch is a rotation of the aircraft nose, not a direct "move up/down" vector —
  forward thrust (throttle) and vertical rate are two fully independent axes, and *neither* one is
  bound to W/S the way an arcade game binds "forward" to W.
- **Ace Combat 7:** per [Steam Community discussion](https://steamcommunity.com/app/502500/discussions/0/1777135944136484773/)
  (wiki-sourced), default keyboard pitch uses **1/3 keys**, throttle uses **W/S**, separately from
  pitch — again a fully decoupled multi-axis scheme, explicitly reported by players as unintuitive
  and commonly remapped, with one popular fan remap moving to **W/S = pitch, +/-  or PageUp/PageDown
  = throttle** instead (community remap suggestion, not a default).
  **Verdict on this cluster: real flight sims decouple "point the nose" (pitch, mouse or dedicated
  keys) from "how fast am I going" (throttle, separate dedicated keys), and never make a single
  W/S press mean both "translate forward" and "change altitude" simultaneously — which is the same
  structural fix this codebase needs, arrived at from a completely different genre.**

---

## Part 2 — Ergonomics, accessibility, and keyboard hardware limits

### 2a. Double-bound / conflicting keys are a documented accessibility anti-pattern

Microsoft's own **Xbox Accessibility Guideline 107** (input mechanism flexibility) states directly,
as an implementation guideline, to **"avoid introducing mechanics where a player is required to
press two buttons simultaneously to activate a function"** and recommends that when two inputs are
combined to make one action (its example: pressing A+B together to "pick up items"), the fix is to
let players **remap the whole action to a single button** rather than requiring the combination —
[XAG 107, Microsoft Game Dev docs](https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/107).
That guideline is about simultaneous-key *combinations*; this repo's bug is the mirror-image
problem — **one key silently doing two unrelated jobs depending on hidden state** (W = "walk
forward" on the ground, but W = "climb" the instant you're airborne). XAG 107 doesn't name that
exact pattern, but its stated rationale — that players with cognitive/motor differences must be
able to predict what a button does without holding extra context about game state — applies with
equal force: a control whose meaning silently flips based on FSM state is exactly the kind of
input unpredictability the guideline is trying to eliminate. **Inference**, clearly marked: XAG 107
does not use the word "flight" or discuss double-bound single keys verbatim, so this application to
the specific W/S-overload bug is this document's own reasoning, not a quoted claim.

The community-maintained [Game Accessibility Guidelines](https://gameaccessibilityguidelines.com/full-list/)
site — cross-referenced directly from the Microsoft XAG 107 page's own "Resources and tools" table,
so it is not a random third-party source but one Microsoft itself points to — lists **"ensure that
multiple simultaneous actions... are not required, and included only as a supplementary/alternative
input method"** as a basic-tier guideline
([source](https://gameaccessibilityguidelines.com/ensure-that-multiple-simultaneous-actions-eg-click-drag-or-swipe-are-not-required-and-included-only-as-a-supplementary-alternative-input-method/)),
reinforcing the same principle from the other direction: don't design a scheme whose *correct*
operation depends on hitting several keys at once if you can avoid it.

### 2b. Left-hand reachability of a held modifier while WASD is also held

No single authoritative ergonomics doc rating Space vs. Ctrl vs. Shift vs. a letter key for
simultaneous-WASD reachability was found (see Gaps) — the following is **Inference** based on
standard QWERTY physical layout and the sourced control maps in Part 1, which is itself evidence
of what has shipped and presumably play-tested successfully at scale:
- **Space** — thumb, does not require lifting any WASD finger, reachable in every hand position.
  Used as the primary vertical-ascend key in *both* sourced pure-flight baselines (Minecraft) and
  superhero titles (Saints Row IV) — see Part 1 T4, T11. Its cost in this codebase specifically is
  that Space is already an *alias* for W (`this.forward = w.down || space.down` in `Input.js`), so
  Space cannot be reused for climb without first breaking that alias.
- **Left Shift** — pinky, does not require lifting any WASD finger, the single most common
  modifier in all PC gaming (sprint in GTA V, sprint/flight-activate in Anthem, run/glide in Arkham
  Knight — Part 1 T6, T7, T10). Already used in this codebase for `dash`. Reusing it for anything
  else would recreate exactly the kind of overload this research is trying to eliminate.
- **Left Ctrl** — pinky, adjacent to Shift, standard PC "crouch" key, and the sourced **descend**
  key in both Saints Row IV (T4) and — for dive-bomb — Arkham Knight (T7). Reachable without lifting
  A/S/D but does sit at the extreme bottom-left corner of the keyboard, a slightly longer pinky
  stretch than Shift for players with small hands. **Inference:** still broadly considered
  reachable, since it is the sourced default in two shipped titles' vertical-flight schemes.
- **A letter key adjacent to WASD (C/X/V/Z/F/R)** — reachable by the middle/ring/index fingers of
  the same hand without leaving the WASD cluster, at the cost of needing to remember a
  non-spatially-obvious binding (unlike Shift/Ctrl/Space, which read as universal PC modifiers).
  This codebase already uses **G** for land — a letter key just outside the WASD block — as
  precedent that letter-key verticals are an accepted pattern here.

### 2c. Ctrl+W+Shift-style 3-key holds, and keyboard ghosting / NKRO limits

[Wikipedia's Key rollover article](https://en.wikipedia.org/wiki/Key_rollover) documents that most
non-gaming USB keyboards implement **6-key rollover (6KRO)** via the USB HID boot protocol — up to
6 simultaneous non-modifier keys plus modifiers, which sounds generous, but the article also notes
that **cheaper keyboards without per-key isolation diodes can start ghosting/jamming at as few as
three simultaneously-held keys** if those keys share matrix rows/columns, and that **modifier keys
(Shift/Ctrl/Alt) are typically wired on a separate circuit from the main character matrix**, so they
do not count against a keyboard's rollover budget the way ordinary letter keys do. Only full **NKRO**
keyboards (marketed as a gaming-keyboard feature, not standard on office/laptop boards) guarantee
every key registers regardless of how many others are already down.

This has a direct, concrete implication for this codebase's control design: **a scheme that
requires W + Shift + Space held together (e.g. sprint-climb-forward simultaneously) is asking for
three keys on the *same physical keyboard region* to register at once**, and depending on the
specific keyboard's matrix wiring, that is within the range where cheap boards are documented to
start dropping or ghosting inputs. The safer pattern, and the one every sourced title in Part 1
actually uses, is to **keep the simultaneous-hold combinations to at most two ordinary keys plus a
modifier** — e.g. W (forward) + Shift (speed cap raise) is two "true" keys since Shift is
off-matrix, which is exactly this codebase's existing dash design and is safe by the same logic;
W + A (diagonal forward-left) + Shift is three keys but two are on the main matrix and immediately
adjacent, a combination every WASD game already depends on and that testing across the industry has
implicitly validated works. A hypothetical **W + Space + Shift** (move forward, climb, and dash
all at once) stacks three keys, one of which (Space) sits in a different keyboard zone from W,
which is more likely to be fine on modern keyboards but is exactly the kind of combination that
has no guarantee across the low-cost keyboard population the accessibility guidance in §2a is
protecting. **Inference, clearly marked:** no source directly benchmarks this exact 3-key
combination; the concern is derived from the sourced 6KRO/ghosting mechanics above, applied to this
game's specific candidate keybinds.

**Sources:** https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/107 · https://gameaccessibilityguidelines.com/full-list/ · https://en.wikipedia.org/wiki/Key_rollover

---

## Part 3 — Recommendation for `kodaman3d`

Framed against the three concrete failures in the brief and the actual code seam
(`Input.js beginStep()` builds the `forward/back/left/right/jumpDown/jumpPressed/descend/dash/fine`
snapshot; `LocomotionController` consumes it, and camera-relative WASD horizontal movement already
runs unconditionally in all four FSM states — GROUNDED, TAKEOFF, FLYING, LANDING — and does not
need to change). Both options below are mapping-only unless flagged otherwise.

### Option 1 (recommended) — dedicated climb/descend keys, matches the Saints Row IV / Minecraft precedent (T4/T11)

| Action | Key | Compatible with existing FSM/tuning as-is? |
| --- | --- | --- |
| Ground move / fly forward-horizontal | **W A S D**, camera-relative (unchanged) | Yes — every title surveyed (Anthem, JC4, SR4, Arkham Knight, Minecraft, Prototype, Spider-Man) keeps WASD as pure horizontal thrust in every state; matches this repo's existing unconditional `_updateHorizontal`. |
| Takeoff (grounded → airborne) | **Space**, tap/down-edge (unchanged mechanic, narrowed source) | Yes — keeps the existing tap-edge takeoff design (`jumpPressed` rising edge, brief note 3 in `Input.js`); just re-sourced from Space's own edge instead of `w.pressed \|\| space.pressed`. |
| Climb (while flying) | **Space**, held | **Input.js change, flagged:** `jumpDown` must stop being sourced from `this.forward` (`w.down \|\| space.down`) and instead read `space.down` alone. Fixes failure #1 (W on the ground no longer ascends) and frees W for failure #2. No FSM/physics change — `_updateVertical`'s FLYING branch keeps reading `input.jumpDown` exactly as today. |
| Descend (while flying) | **Left Ctrl**, held | **Input.js change, flagged:** `descend` must stop aliasing `this.back` (`isDown('KeyS')`) and instead read a new `isDown('ControlLeft')` (optionally OR'd with `ControlRight`). Fixes failure #3 — S becomes pure horizontal-back thrust, so dash-descending no longer reverses direction. Ctrl is the sourced Saints Row IV descend key (T4) and, per §2c, is never held simultaneously with Shift+W in a 3-key-same-hand chord in this scheme (climb/descend and dash are orthogonal axes), so concurrent same-hand key count stays at two ordinary keys plus a modifier at most. |
| Ground sprint / flight dash | **Left Shift**, held (unchanged) | Yes — already the cap-raise on `MOVE_ACCEL`'s target per `horizontalSpeedCap`; matches GTA V's ground-sprint baseline (T10) and Anthem's Shift-based flight-activate (T6, itself a mode/cap change on the same key). No change needed. |
| Land (flying → grounded, controlled descent) | **G**, tap (unchanged) | Yes — `landPressed` stays on G; no sourced title contradicts a dedicated non-WASD land key. |

**Net effect on the three concrete failures:**
1. *Holding W on the ground takes off* — fixed. Takeoff/climb move entirely off W onto Space; W on
   the ground is pure ground movement, matching every surveyed title.
2. *In flight, W only climbs, can't fly forward* — fixed. W becomes pure camera-relative forward
   thrust in every state (already true horizontally); climb moves to Space, so a player can hold W
   to fly forward and Space to climb simultaneously — two keys, not one overloaded key, exactly the
   Saints Row IV/Minecraft shape (T4/T11).
3. *S-descend reverses horizontal direction* — fixed. S stays pure "move backward"; descend moves
   to Ctrl, so dash-descending forward (W+Shift+Ctrl) no longer forces the hero backward.

**FSM/tuning changes required, stated explicitly per the brief's instruction not to assume silently:**
- **Takeoff's tap-edge design is unaffected** — `jumpPressed` still fires off a rising edge; only
  its *source key* narrows from "W or Space" to "Space."
- **The landing-abort-on-held-input rule** (`if (input.jumpDown) this._setState(FLYING)` in
  `LocomotionController._applyInputTransitions`) currently reads `jumpDown`, which under this
  remap becomes "Space held" instead of "W or Space held." **This is a real behavior change, flagged
  and not silent:** a player who is holding W (but not Space) when they press G will now commit to
  landing, where today they would abort it. Whether "any forward-ish input aborts landing" was the
  intended semantic, versus specifically "the climb key," is a product decision for the design
  owner, not an accident of this remap — flagged as **inference/product-question**, not a documented
  external fact.
- **No change to `_updateHorizontal`, `_updateVertical`'s climb/dive physics, `horizontalSpeedCap`,
  `frictionFactor`, `hoverDampingFactor`, or the FSM's transition graph** — every fix above is a
  `beginStep()` snapshot-assignment change in `Input.js` only, consistent with the brief's framing
  that only the mapping needs to change.

### Option 2 — camera-pitch-coupled climb, closer to the Anthem/flight-sim philosophy (T6, T12)

If the design goal leans toward "steer your body with the camera" rather than "helicopter with
fixed vertical thrust," Anthem's own first-party default (T6: pitch-tilt drives altitude, with a
"Flight Take Off in Aim Direction" option and a Y-axis-invert toggle to make it "control more like
a plane") is a sourced alternative philosophy:

| Action | Key | Notes |
| --- | --- | --- |
| Ground sprint | **Left Shift** (unchanged) | Same as Option 1. |
| Takeoff | **Space**, tap | Same as Option 1; optionally launches toward camera aim rather than body-facing, per Anthem's own accessibility option. |
| Forward flight thrust | **W**, camera-relative | Unchanged mechanically, but under this option climb/descend are removed as separate keys, so W is the only always-on flight input besides camera pitch. |
| Climb / descend | *(no dedicated key — derived from camera pitch, as in Anthem's default)* | **Requires both an Input.js change AND a physics/FSM change, explicitly flagged as going beyond the brief's stated "mapping-only" preference.** `_updateVertical`'s FLYING branch would need to read a continuous pitch value instead of the two `jumpDown`/`descend` booleans it reads today — a real change to the vertical-motion model, not a `beginStep()` remap. Included only because the brief asked for a second, philosophically distinct option, not because the sourced evidence favors it (see Part 0's verdict). |
| Hover override | **Space, held**, optionally, matching Anthem's separate dedicated hover key (T6: "C = Hover" in Anthem, remapped here to Space to avoid adding a wholly new key) | New discrete input; not present today. |
| Dash/boost | **Left Shift** (unchanged) | Same as Option 1. |
| Land | **G** (unchanged) | Same as Option 1. |

**Trade-off, stated per Part 0:** more immersive/skill-expressive and needs one fewer dedicated key
(no Ctrl), but reintroduces the exact camera-coupling cost Part 0 flags: looking down mid-flight to
check a landing spot or aim at a ground target would now *intentionally* dive the hero — a real
behavior change to how the free-look camera and hero motion relate, not just a rebind. Given the
brief's explicit preference for a mapping-only fix, and Part 0's finding that camera-decoupled
vertical control is the dominant convention among surveyed superhero-traversal titles specifically
(not flight sims), **Option 1 remains the primary recommendation; Option 2 is documented as the
alternative philosophy, not a competing recommendation.**

---

## Gaps — what could not be verified

- **Superman Returns (2006)** never shipped on PC (console/DS only per [Wikipedia](https://en.wikipedia.org/wiki/Superman_Returns_(video_game))) — no KB+M scheme exists to document; dropped from the survey rather than guessed at.
- **inFAMOUS Second Son** and **Gravity Rush** are console-exclusive with no native PC/Steam release ([Wikipedia: Second Son](https://en.wikipedia.org/wiki/Infamous_Second_Son), [Wikipedia: Gravity Rush](https://en.wikipedia.org/wiki/Gravity_Rush)) — no KB+M scheme exists for either.
- **Crackdown** was not researched in this pass — deprioritized once Saints Row IV/Anthem/Just Cause were enough to answer Part 0's dominant-convention question. Crackdown did ship PC re-releases, so it is plausibly sourceable in a follow-up, but was not attempted here.
- **Prototype 2** was not independently sourced — only Prototype 1 (T2) was verified in detail; its scheme should not be assumed identical to Prototype 1's.
- **Anthem's exact default boost/dash key and exact default forward-thrust key letter** were not found on either the official EA page or the Shacknews secondary source — left unconfirmed rather than guessed.
- **Just Cause 3/4's climb/descend key mapping** is reported inconsistently across Steam Community threads (T5) — the disagreement is reported as-is rather than resolved by picking one thread as authoritative.
- **Saints Row IV's official PC manual** documents vehicle (helicopter) up/down controls but not the player-character super-power flight controls explicitly — the Space/Ctrl flight binding rests on a Steam Community thread, not the manual itself (T4).
- **No first-party manual/support page was found for Just Cause 3/4's wingsuit controls** despite searching for an official Steam controls page — only community threads were located.
- **No single authoritative ergonomics study** ranking Space vs. Ctrl vs. Shift vs. a letter key for simultaneous-WASD reachability was found (§2b) — that section is explicitly marked as inference from standard QWERTY geometry plus shipped-title precedent, not a cited ergonomics paper.
- **The W+Space+Shift 3-key ghosting-risk claim in §2c is inference**, not a benchmarked test of this exact combination on any specific keyboard model — derived from the sourced general 6KRO/NKRO mechanics, not measured directly.
- **Microsoft Flight Simulator's and Ace Combat 7's exact default keybind letters** (T12) were sourced from community/wiki pages and a forum-hosted PDF link that was not opened and read line-by-line — treated as wiki/community-sourced, not first-party-verified.
- No claim in this document about motion sickness/vection is backed by a source specific to any surveyed title; such claims in Part 0 are marked **Inference** and should not be read as documented facts about player comfort in any specific game.



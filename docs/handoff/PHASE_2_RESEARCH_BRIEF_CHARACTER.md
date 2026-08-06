# Phase 2 Research Brief — Run 2 of 2: Character, Rigging, and Animation

**Written by:** the orchestrator, session 6, 2026-07-31.
**For:** the Phase 2 Research agent, run 2 (Sonnet).
**Deliverable:** `docs/handoff/RESEARCH_PHASE_2_CHARACTER.md`.

Run 1 (`RESEARCH_PHASE_2_WORLD.md`) is complete and its two user decisions are made. This run
covers the half of Phase 2 that run 1 was explicitly forbidden from touching.

---

## Read these two, and only these, before starting

1. **`docs/handoff/KNOWLEDGE_BASE.md`** (501 lines) — the consolidated map of the build. Module
   wireframe, app lifecycle, the flight FSM written from the code, every settled decision, and an
   index of the other documents in §8. **It exists so you do not read the 22-document pile cold.**
2. **`docs/handoff/RESEARCH_PHASE_2_WORLD.md`** (1,009 lines) — run 1's output, your prior context.
   You inherit its budget and its architectural conclusions. **Do not re-litigate them.** §BUD-6's
   ceiling, §BUD-2's chunk reframing and §ORG-1/2's floating-origin reasoning are all now settled
   inputs to your work, not open questions. Read §ORG-2 with particular care — it explicitly hands
   you an open question (below).

Consult anything else **by section**, via `KNOWLEDGE_BASE.md` §8. **Never read
`kodaman_prototype.html` in bulk** — 16,507 lines, and it has killed agent budgets here. Targeted
`grep` only; it is the read-only 2D design reference.

**If the docs and the code disagree, the code wins** — and say so inline. Both prior agents on this
project found real doc/code contradictions by checking rather than trusting, and one of them
correctly contradicted its own brief. That is the behaviour this brief wants, including about this
brief.

---

## Scope

**IN:** skeletal animation and rigging; the glTF asset pipeline; animation state machines, blending
and transitions; procedural/additive layers (IK, look-at, lean, cape); the hero's visual redesign
toward the "comic-accurate read" the user asked for; asset sourcing and its licensing; and the
draw-call/performance consequences of all of it.

**OUT:** world geography, chunk streaming, LOD, day/night, fog, districts — all of that is run 1's,
and it is done. Combat and abilities are Phase 3. Quests, dialogue and companions are Phase 4. The
trademark naming table is a user decision that blocks content porting, not this.

---

## What locked decision 9 actually changed

> **Skeletal animation is pulled forward from Phase 5 into Phase 2. From Phase 2 onward the project
> accepts imported rigged assets, which supersedes Phase 1's primitives-only constraint.**

That is the mandate. Phase 1's hero is **primitives** — a capsule torso, a head, four limbs and a
cape polygon, posed by direct `rotation` writes. Your job is to specify what replaces it and what
that costs.

---

## Binding constraints — decided, do not relitigate

| Constraint | Why it binds you specifically |
|---|---|
| **WebGL, not WebGPU**, all eight phases. Final, stated in `Renderer.js`, no fallback path. | Rules out any technique that needs compute shaders. Skinning is vertex-shader skinning. |
| **The `Hero.js` / `LocomotionController.js` split is load-bearing.** `Hero.js` is visual only; `LocomotionController.js` is simulation only and never touches the scene graph. | **This is the constraint most likely to be broken by animation work**, because an animation system is tempted to read velocity and write transforms in the same place. Whatever you propose must respect the seam. Say explicitly which side each new module lives on. |
| **Fixed 60 Hz timestep, non-negotiable.** Every tuning constant assumes it. | `AnimationMixer` is normally driven off a variable frame delta. Say how it fits a fixed-step loop, and whether it belongs in `fixedStep` or in `render`. |
| **Gravity is applied in exactly one place** — `grounded`, off-ground. Never in `takeoff`, `flying` or `landing`. | Do not propose anything that reasserts it. |
| **No named characters, places or companies anywhere in `kodaman3d/`, including placeholders.** | Applies to your document too. Describe the hero by role and silhouette. Do not invent proper nouns, and do not name the 2D game's protected marks. |
| **The hero's flight silhouette is already decided** — arms forward, legs trailing (bug B5, commit `44df9fe`, a taste call made by the user, not an arithmetic fix). | Do not reopen it. Animation should express it, not overturn it. |

---

## The existing FSM your animation system has to serve

From `KNOWLEDGE_BASE.md` §4, written from the code. `LocomotionController.js` has four states —
**`grounded`, `takeoff`, `flying`, `landing`** — with these properties that matter to you:

- **`takeoff` is scripted and lasts exactly 12 fixed steps (0.2 s)**, ignoring input throughout.
  That is a hard, known duration — an animation can be authored exactly to it.
- **Horizontal movement runs in all four states unconditionally.** Only vertical motion is
  state-gated, deliberately: "a takeoff/landing that ignored steering would read as a canned
  cutscene." Your blend tree has to cope with steering during scripted vertical phases.
- **`landing → flying` is level-triggered, not edge-triggered** — a player already holding the climb
  key when they press land never commits. So the landing animation must be interruptible at any
  point, not a committed one-shot.
- **Orientation is visual only and never feeds back into velocity.** Yaw rate-limits toward travel
  at 12 rad/s rather than snapping. Body pitch is a **two-term model** — a `sqrt`-curved speed lean
  plus a vertical term that fades out as horizontal speed rises. Any procedural animation layer you
  add sits on top of this, and must not fight it.

**Map your proposed animation states onto these four.** Do not invent a parallel state machine that
duplicates them — that is a well-known way to get two sources of truth that drift.

---

## The user's feedback, which is the reason this run exists

- **"The character is not human enough."** Phase 1's hero is capsules and boxes; this is a fair
  description of primitives, not a complaint about tuning.
- **They want a "comic-accurate read."**
- **Ghost of Tsushima was named for animation fluidity.**

As in run 1: translate these into **specific, costed, implementable technique**, not adjectives.
The useful question about Ghost of Tsushima is not "how do we feel like it" — it is *which concrete
techniques produce that read (transition blending, additive layers, root-motion policy, IK, cloth,
animation counts), which are viable in Three.js/WebGL, and what each costs.* **Be honest about what
does not transfer** from a console-native engine with a studio animation team; separating reachable
from unreachable is part of the value here.

On "comic-accurate": the project's own research records that the 2D game's **character designs are
already legally distinct — only the names are a problem.** So this is an art-direction question
(proportion, silhouette, shading model, outline treatment, how a cape reads) and not a legal one.
Cel/toon shading versus the `MeshStandardMaterial` PBR the world is built in is a real question with
a real cost, and the world now has a PMREM environment map the hero would either use or deliberately
opt out of.

---

## Specific questions worth answering

1. **Asset sourcing and licensing.** Where do rigged humanoid assets actually come from, and under
   what licence? **The repo is already public** (`github.com/cyang3859/C_K_prototype`, public since
   2026-06-14), so anything committed is published. Say plainly what each candidate source permits.
   Cover the rig-retargeting story too — a downloaded rig is rarely the rig you want.
2. **Draw calls — and note this may go DOWN, not up.** Phase 1's hero is **7 objects = 7 main + 7
   shadow = 14 calls** (`KNOWLEDGE_BASE.md`/§BUD-6). A single skinned mesh could be 2. Work out the
   real figure including the cape and any separate materials, **stated as a both-pass total with the
   main/shadow split shown** — that convention is now project policy. Then say what skinning costs
   that draw calls do not capture: per-frame bone matrix upload, vertex-shader cost, and whether
   `castShadow` on a skinned mesh re-skins in the shadow pass.
3. **The cape.** Currently a primitive polygon with a hand-written world-lift and a
   `CAPE_MIN_STANDOFF` clamp, both of which exist because of real shipped bugs — the anchor was
   mounted *inside* the torso capsule (`CAPE_Z` 0.14 against a 0.28 radius) and separately went
   colinear with the torso at speed. The 2D reference is a 7-segment sine-displaced polygon, not a
   bezier. **Bone chain, vertex shader, or a cloth solver?** Cost each. Whatever you propose must
   not reintroduce interpenetration — that bug was found by eye twice and by no test, because the
   three cape tests asserted *direction* and none asserted *position*. **A direction assertion is
   not a position assertion** — the project wrote that lesson down; apply it to whatever you spec.
4. **Floating origin, handed to you explicitly by run 1 §ORG-2.** Run 1 concluded floating origin
   buys essentially nothing for coordinate precision at 2,048–6,144 m, and that the one real
   justification is **skinned-mesh degradation** — which it could not assess, because no skinned mesh
   exists yet. It recommended cheap architectural prep now and deferring the mechanism. **Close this
   if you can:** is there a real distance threshold at which skinned meshes visibly degrade, distinct
   from general float32 jitter? If you cannot close it, say so and say what would.
5. **Animation authoring volume.** How many clips does a hero with walk/run/takeoff/fly/dive/land
   actually need, and what is the realistic authoring or sourcing effort? This is the number most
   likely to make Phase 2 bigger than anyone expects, and it is better known now than discovered
   later.

---

## Deliverable

**`docs/handoff/RESEARCH_PHASE_2_CHARACTER.md`.**

Follow run 1's format, which worked well and which the orchestrator has now spot-checked and
largely confirmed: numbered sections, findings tagged with a short ID so later documents can cite
them, sources linked inline, and — most importantly — **explicit `[MEASURED]` / `[SOURCED]` /
`[ESTIMATE]` confidence labels on every finding.** Never let the three read alike. This project has
repeatedly been bitten by confident prose that was actually a guess.

**End with a "what I could not answer" section** listing your genuine gaps, and a consolidated
**"what needs a user decision"** list. Run 1 did both and they were the most immediately useful
parts of the document.

**Write the file incrementally, section by section, from your first section onward.** Three agents
in this project have been killed mid-task by session limits and **only work already on disk
survived.** Do not hold the document in context and write it at the end. This is the single most
important process instruction in this brief.

---

## Working rules — non-negotiable

- **You must not spawn subagents. Not one, not read-only, not "small and foreground."** An agent
  once fanned out to four children unprompted and burned the budget; another violated this rule
  after being told in these words. Do the work yourself.
- **Write incrementally.** See above.
- **Do not modify any code.** `kodaman3d/` and `kodaman_prototype.html` are read-only to you. Your
  only writes are to your own deliverable in `docs/handoff/`.
- **Reading the Phase 1 source is encouraged.** `kodaman3d/src/entities/Hero.js` (509 lines) and
  `controllers/LocomotionController.js` (569 lines) are the ground truth for everything above, and
  `Hero.js`'s comments carry the sign-convention history that produced bugs B1, B4 and B5.
- **If you hit a decision you cannot resolve, write the question down rather than inventing an
  answer.** The orchestrator takes it to the user. A flagged open question is worth more here than
  a confident invention.

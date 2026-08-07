# Engineer brief — replace the primitive hero with a rigged humanoid

**Written 2026-08-06, session 15.** User decision, on a side-by-side comparison they supplied:
our hero reads "novice and blocky"; they want the **human-like** read of a real character mesh.

**This is authorized already.** Locked decision 9: *"Accepts imported rigged assets, which
supersedes the Phase 1 primitives-only constraint from Phase 2 onward."* Nobody had acted on it —
the hero is still primitives because of inertia, not policy.

---

## 1. Why parameter tuning was rejected

`RESEARCH_SSKTJL_CHARACTER.md` proposed widening `SHOULDER_X` 0.34 → 0.39, raising suit roughness,
and so on. **Those recommendations are not wrong, they are insufficient**, and the reason is
structural: the entire hero is **four geometries** —

| Part | Geometry |
|---|---|
| Torso | one `CapsuleGeometry(0.28, 0.6)` |
| Head | one `SphereGeometry(0.16)` |
| Limbs | one `CapsuleGeometry(0.09, 0.5)`, reused 4× |
| Cape | one `PlaneGeometry(0.7, 1.1)` |

No face, no hair, no hands, no shoulders, no belt, no boots, no emblem. "Blocky" **is** those four
shapes. Retuning their radii rearranges the same four primitives. The §3 numbers in that document
should be treated as **superseded for the body**, though its material/colour reasoning may still
inform the new mesh's materials.

## 2. The asset — and the ONE thing still unresolved

**Quaternius "Universal Base Characters"** — and it fits the locked decisions almost exactly:

| Requirement | Status |
|---|---|
| Decision 15: Quaternius, CC0 | ✅ CC0 |
| §ART-1: a "Superhero proportion set" | ✅ **the vendor's own name for one of its three builds** (Superhero / Regular / Teen, male+female) |
| Decision 14: visible face, not a cowl | ✅ real modelled head, 20 hairstyles, customisable skin/eye colour |
| Format | ✅ glTF / GLB |
| Budget | ~13k triangles per model |
| Decision 16: an animation floor | ✅ **Universal Animation Library**, 120+ CC0 clips on the same universal humanoid rig — 8-directional locomotion, jog, sprint, combat. Far beyond §CLIP-3's four. |

⚠️ **UNRESOLVED, AND IT NEEDS THE USER: which models are in the FREE tier.** The itch.io page
states Standard = **"2 base models and 5 hairstyles"**, with all 8 models and 20 hairstyles in the
**$19.99 Source** tier. The pack's own description reads as though all 6 proportions are in the
free download. **These two claims contradict each other and I could not resolve them** — the
download is behind an itch.io flow. **If the Superhero build is not in the free tier, buying it is
a $19.99 decision that belongs to the user.**

**Locked decision 18 already anticipated exactly this** and pre-answered the licence half: the tier
split is **content, not licence** — everything is CC0, free tiers ship glTF/GLB, and *"the paid
tiers are a $9.99–$20 content upgrade, not a licence unlock, and can be bought later without
rework."* So starting on the Regular build and swapping to Superhero later costs nothing structural.

## 3. Order of work — spike first, and the spike is the point

**Do NOT start by rewriting `Hero.js`.** Every real risk here is in the asset and the loader, not in
our code, and all of it is measurable before a single line of `Hero.js` changes.

### Step 1 — the spike (do this first, throw it away)

Load the GLB in a scratch page and **measure**, per `CLAUDE.md`:
- `renderer.info.render.calls` and `.triangles` with the hero in frame
- **how many materials and meshes the model actually arrives as.** This is the gating number:
  **locked decision 14 budgets 8 draw calls (4 main / 4 shadow) across 4 material groups.** A
  modular character that arrives as 4+ separate meshes with their own materials will blow that,
  and the fix (merging, or a texture atlas) is asset work, not engine work. **Decision 14 warns in
  its own text that a rig built object-by-object "stays at 14 and silently wastes the entire gain."**
- whether the Superhero proportion actually reads as heroic at our 1.85 m `HERO_HEIGHT_M`

### Step 2 — the async seam

There is **no asset pipeline at all** today: no `public/`, no `GLTFLoader`, no `.glb`, and `Game`
boots synchronously. Loading is async, so `Game.init()` grows a load phase. Decide deliberately
whether the game shows a loading state or spawns the hero once loaded — do not bolt a promise onto
the constructor and hope.

### Step 3 — `Hero.js`, preserving the seam that makes the tests work

**The controller/visual separation is load-bearing and must survive.** `LocomotionController` never
touches the scene graph, which is the only reason `locomotion.test.js` can simulate flight with no
WebGL. The skinned mesh replaces the *visual*; `hero.state` stays exactly as it is.

Specific things that must keep working:
- `syncTransform()` — position, `facing`, `pitch`, and the **new `roll`** (group Euler order `YZX`;
  see the axis/order comment there, it is not optional)
- `_animateLimbs` / `_attackArmPose` currently write `joints.armLeft/armRight.rotation.x`.
  **`_attackArmPose` must keep working** — attack tells are the difference between a readable
  ability and an invisible one (`996cfc7`). Either drive the rig's arm bones directly, or replace
  the tell with a clip and keep the same `playAttack(kind)` interface. **The alternating-arm
  behaviour is pinned by tests and must survive.**
- **The cape.** The Quaternius base almost certainly has none. Ours is a CPU sine-wobble plane on
  `capeAnchor`; re-anchor it to a spine/shoulder bone. `capeTorsoGap()` (§CAPE-1) must be re-run —
  the torso geometry is changing completely, which is exactly what that test guards.

### Step 4 — decision 17 comes due the moment this lands

*"Run §ORG-6's synthetic floating-origin test as soon as a rigged hero exists in Phase 2. Do not
defer to Phase 5."* Its stated precondition — no skinned mesh existing — disappears here. Spawn the
rigged hero at 0 / 1,024 / 2,048 / 3,072 / 6,144 m, apply identical poses, diff world-space vertex
positions. **It is a test, not a system.**

## 4. Traps specific to this job

- **Scale.** Quaternius models are authored at their own scale; `HERO_HEIGHT_M` is 1.85 and
  `Collision.js`'s capsule (`HERO_RADIUS_M` 0.35) is tuned to it. Scale the *mesh* to the collider,
  never the collider to the mesh — the collider's numbers are browser-verified across five human
  passes.
- **Feet at the origin.** `state.position` is the **feet**, not the centre (`Collision.js`'s
  convention). A model authored around its hips will float or sink.
- **Facing.** Yaw 0 faces **−Z** (`Scale.js`). If the model faces +Z, correct it once, at load, and
  comment it — do not scatter compensating negations.
- **No names.** Locked decisions 5/6 and `RENAME_MAPPING.md`. The build currently contains exactly
  **two** approved names (`AKC ENTERPRISE`, `Coco Hill`) and **a test asserts those are the only
  two**. Do not let an asset's own filenames introduce a third.

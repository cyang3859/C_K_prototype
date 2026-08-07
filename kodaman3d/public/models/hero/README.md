# Hero assets — provenance, licence, and the one repair applied

## Source

**Quaternius, "Universal Base Characters" — Standard (free) tier.**
https://quaternius.com/packs/universalbasecharacters.html

**Licence: CC0 1.0 Universal (public domain dedication).** The pack's own licence file is kept
beside these assets as `LICENSE_Quaternius_CC0.txt`, unmodified.

This satisfies **locked decision 15** (Quaternius only for this phase; CC0 unambiguous) and
**locked decision 18** (the free/paid split is a *content* tier, not a licence gate).

⚠️ **The Superhero proportion IS in the free tier.** The itch.io listing's "2 base models" is
`Superhero_Male_FullBody` and `Superhero_Female_FullBody` — i.e. the free download is exactly the
build this project wanted (§ART-1's "Superhero proportion set"). No purchase was needed.

## What is here, and what was deliberately left out

Copied from the 127 MB pack; everything not listed was left out on purpose (the female base, second
hair set, Unity/FBX variants, other hairstyles).

| File | Purpose |
|---|---|
| `Superhero_Male_FullBody.gltf` / `.bin` | The hero. 3 meshes (body / eyes / eyebrows), 3 materials, **14,318 triangles**, 1 skin, **65 joints**, **0 animations**. |
| `Hair_SimpleParted.gltf` / `.bin` | Hair, rigged to the head bone, 1,301 tris. Shares material `MI_Hair_1` with the body's eyebrows mesh. |
| `T_Superhero_Male_{Normal,Dark,Roughness}.png` | Body maps. `_Dark` is the base colour. |
| `T_Eye_{Brown,Normal}.png` | Eyes. |
| `T_Hair_1_{BaseColor,Normal}.png` | Hair + eyebrows. |

## ⚠️ ONE REPAIR WAS APPLIED TO `Superhero_Male_FullBody.gltf`

**The pack ships with two dangling texture references.** The glTF asks for:

    T_Hair_1_Normal_png.png     -> does not exist anywhere in the pack
    T_Eye_Normal_png.png        -> does not exist anywhere in the pack

The actual files are `T_Hair_1_Normal.png` and `T_Eye_Normal.png`, without the `_png` suffix. This
is an export-naming bug on Quaternius's side, not something we caused. **Both URIs were rewritten
in our copy to point at the real filenames**; nothing else in the file was touched.

**Why this is written down:** unrepaired, two normal maps 404 at load, and during integration that
would present as "our GLTFLoader is broken" rather than "the asset is mislabelled." If these assets
are ever re-downloaded, the repair must be re-applied.

## Facts measured from the file, for whoever wires this up

- **Height 1.81 m** (bounds y ∈ [−0.01, 1.81]). `HERO_HEIGHT_M` is **1.85**, so the model is
  already at our scale — a 1.022× scale at most. Do not rescale the collider.
- **Feet sit at the origin**, matching `Collision.js`'s feet-at-`state.position` convention.
- **The model faces +Z** — the eye and eyebrow meshes sit at positive z on the head. **Our yaw 0
  faces −Z** (`Scale.js`), so the model needs a 180° yaw correction **once, at load**. Do not
  scatter compensating negations through the animation code.
- **Draw calls**: 3 primitives → 3 main + 3 shadow = **6**. Adding hair and our cape gives 5 main /
  5 shadow = 10, which **exceeds locked decision 14's budget of 8**. The way back under: the
  eyebrows mesh and the hair mesh **already share `MI_Hair_1`**, so merging them is one material
  group, giving body + eyes + hair/brows + cape = **4 groups / 8 calls — exactly the budget.**

## Known follow-up: these textures are oversized for the web

**15 MB of PNG, against a current production bundle of 664 kB.** The normal maps are ~4 MB each
(4K) on a stylized low-poly character that will never resolve that detail. Downscaling to 1K would
cut the total to roughly 1 MB with no visible loss at gameplay distances.

**Deliberately NOT done yet** — it is a visual-quality change, and the user should see the hero at
full fidelity before anything is thrown away. Committed at vendor resolution so the decision stays
reversible.

## Animations — `UAL1_Standard.glb`

Quaternius **Universal Animation Library**, Standard (free) tier. **CC0**, licence kept as
`LICENSE_Quaternius_AnimLib_CC0.txt`. **43 clips** (the advertised "120+" is the paid tier).

### ⚠️ THE SKELETONS MATCH EXACTLY — NO RETARGETING IS NEEDED

Verified by comparing both files' joint lists: **65 joints, identical names, identical order.**
Names are Unreal-mannequin style (`root`, `pelvis`, `spine_01`, `clavicle_l`, `upperarm_l`,
`hand_l`, `index_01_l`, …). Three.js `AnimationMixer` binds tracks by node name, so these clips
apply directly to the hero's skeleton. **Do not write a retargeting layer; there is nothing to
retarget.**

### ⚠️ THE NON-ROOT-MOTION FILE IS THE CORRECT ONE, AND THIS IS NOT A PREFERENCE

The pack ships two builds: `UAL1_Standard_RM.glb` has **root motion baked into every clip**, and
`UAL1_Standard.glb` does not. **Only the non-RM file is committed here.**

`LocomotionController` owns the hero's position outright — it integrates velocity and writes
`state.position`, and every tuning constant, the collision resolve and the whole flight FSM depend
on that being the single source of truth. A clip that also translates the root would fight it, and
the symptom (a hero that drifts, or slides during a walk cycle) reads as a physics bug rather than
an animation one. Root motion would have to be stripped at load anyway, so the correct file is the
one that never had it.

### Clips this project actually needs, all confirmed present

| Need | Clip |
|---|---|
| Decision 16's floor: idle / walk / run | `Idle_Loop`, `Walk_Loop`, `Jog_Fwd_Loop`, `Sprint_Loop` |
| Takeoff / landing (the flight FSM has real states for these) | `Jump_Start`, `Jump_Loop`, `Jump_Land` |
| **The alternating punch** — two distinct strikes, which is exactly what `playAttack`'s L/R toggle wants | `Punch_Cross`, `Punch_Jab` |
| Enemy hit reactions and death (`HealthSystem` already models both) | `Hit_Chest`, `Hit_Head`, `Death01` |
| Dodge (`EnemyAI`'s dodge roll is currently invisible) | `Roll` |
| Bind-pose reference for decision 17's floating-origin test | `A_TPose` |

**There is no flight clip, exactly as §CLIP-5 predicted** ("flying humans are not a mocap
category"), and locked decision 16 already accepts that the flight hold is custom. **`Swim_Fwd_Loop`
is worth trying as the base for it** — a horizontal body with the arms leading is the same posture
a flying pose needs, and it is free.

### Known follow-up: the animation GLB carries a mesh we do not use

7.6 MB, and it contains a mannequin mesh alongside the clips. Only `gltf.animations` is wanted; the
scene should be discarded at load. Stripping the mesh and the unused clips offline (e.g.
`gltf-transform`) would cut this substantially. Not done yet — same reasoning as the textures below:
measure the real cost in a browser first.

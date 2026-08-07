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

## Still missing: the animations

**This pack contains 0 animation clips.** The rig is posed but has nothing to play. Clips come from
Quaternius's separate **Universal Animation Library** (120+ clips, CC0, GLB, authored on this same
universal humanoid rig), which satisfies **locked decision 16**'s floor several times over. That is
a separate download.

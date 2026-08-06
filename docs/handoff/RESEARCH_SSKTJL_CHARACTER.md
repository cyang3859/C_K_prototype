# Research — Suicide Squad: Kill the Justice League's Superman design, translated for our hero

**Status:** COMPLETE.
**Scope:** Design-language research only. No assets, no names. See the legal-line note below.

---

## ⚠️ The legal line, stated once, up front

This document describes design language observed in **publicly available marketing material,
press coverage, and developer statements** about *Suicide Squad: Kill the Justice League*
(Rocksteady/WB Games, 2024). It contains **no extracted assets, no ripped/datamined files, no
textures or meshes from that game**, and recommends none. Every number in the "concrete
translation" section below is an **original parameter proposed for our own primitive-built hero**,
not a measurement taken from the source game's files.

This document proposes **no name** for our hero, costume, or anything else. Locked decision 6
(`PIPELINE_STATE.md`) reserves naming to the user. Where this document must refer to the source
character to describe what it is describing, it uses the source game's own public title only.

---

## 1. Sources consulted and their tier

No live browser/Playwright work was needed for this task — it is pure external research, not a
`kodaman3d` browser check. All access was via `WebSearch`/`WebFetch`; several primary sources
(ArtStation piece pages, GameSpot, Arkham Wiki) returned HTTP 403/402 to the fetch tool and could
only be read through the search tool's own summarization, which is a weaker form of access than
reading the page directly. That is flagged inline wherever it applies.

| Tier | Source | What it gave |
|---|---|---|
| 1 (developer-published art) | *ArtStation Magazine*, "Rocksteady Studios' Suicide Squad: Kill the Justice League" (Jul 2024) — could not be fetched (403); only its existence and title confirmed. | Not usable — see gap list. |
| 1 (developer-published art) | Individual ArtStation concept-art posts tagged `SuicideSquadRSArtBlast`, and named-artist Superman pieces (David Richardson, Adam Oresten, Davide Beghetto, Pablo Hoyos Isusquiza) | Not usable — ArtStation blocks the fetch tool (403) on every piece page tried. Their existence confirms official concept art was published, but no captions or descriptions could be read. |
| 2 (games press, describing the shipped game directly) | CBR, "Every Costume In Suicide Squad: Kill The Justice League (So Far)" | The one concrete, specific costume description obtained: crest, panel language, surface texture (quoted in §2). |
| 2 (games press) | GameSpot review coverage, via search-tool summary only (direct fetch 403'd) | A build/proportion comparison ("looks like John Cena") — **low-confidence, could not verify the exact wording or confirm it wasn't the tool's own paraphrase.** Treat as a directional signal only. |
| 2 (games press, aggregated via search) | Multiple outlets on Metropolis's visual tone (paraphrased by the search tool, exact outlet not separable in every case) | Directional evidence that the game's overall palette is bright/saturated, explicitly contrasted against the darker Arkham series. |
| 2 (games press) | ScreenRant, "10 Coolest Outfits In Suicide Squad: Kill the Justice League" | One proportion data point: Superman is described as "a larger, statuesque figure" (via the King Shark "Supershark" costume joke, where the suit is shown ripped from being sized for Superman). |
| 3 (secondary, general/background, not game-specific) | GamesRadar / Den of Geek / ComicBook.com / general comics press on the **New 52 Superman comic redesign** (Jim Lee, 2011) | Strong, well-documented background on the design language CBR says the game's suit draws from: trunkless armored bodysuit, Kryptonian-armor panel/scale texture, high collar, gauntlet wrist detail, "more regal" cape. This is **not itself a source about the game** — it is corroborating context for the one game-specific claim (CBR) that the game's suit is "a crest straight out of the New 52" with "triangular accents." |
| 3 (fan wiki, blocked) | Arkham Wiki, `Justice_League_(Brainiac)` | Fetch returned HTTP 402 (paywalled/blocked). Not used. |
| 3 (fan wiki, via search summary) | Screen Rant, Fandom wiki summaries on the Brainiac-corrupted Justice League | Narrative/cosmetic tell: brainwashed Superman's eyes glow (red heat-vision-primed, with Brainiac's own victims elsewhere described as showing purple), not a costume-silhouette fact. Kept out of the costume recommendations below because it describes a corruption VFX, not the base design. |

**What this table means for confidence:** the single most load-bearing, directly-sourced claim in
this whole document is CBR's one paragraph (Tier 2, describing the shipped game): *New 52 crest,
triangular-accent panels across the whole bodysuit, a "rocky/meteorite" surface texture.*
Everything else is either corroborating background on New 52 (well-documented but about the comic,
not the game) or directional signal from search-tool paraphrases I could not verify against the
original page text. I was not able to reach a single interview or art-of breakdown that discusses
the game's Superman specifically, in the artists' own words, with the tools available.

## 2. Design language: silhouette, proportion, material story, cape, colour

### Silhouette and proportion

- **[Tier 2, weak]** The game's Superman is described as "a larger, statuesque figure" — the joke
  being that King Shark's Superman-costume alt-skin comes visibly ripped and oversized because it
  was cut for Superman's frame (ScreenRant). This is a proportion claim, not a number: it says
  "bigger than a normal human," not by how much.
- **[Tier 2, unverifiable wording]** A search-tool paraphrase of GameSpot's coverage describes
  Superman's build as reading like "John Cena" — i.e., heavy-shouldered, thick-necked, more
  bodybuilder than swimmer. I could not confirm this against the actual review text (fetch
  blocked), so I am reporting it as a directional signal only, not a citable fact.
- **No source I reached states a height-in-heads figure, a shoulder-to-waist ratio, or any other
  measurable proportion number for the game's Superman.** Anything more specific than "bigger and
  bulkier than an ordinary adult male" is not stated in any source I found.
- **[Inference from the New 52 corroboration, Tier 3 background]** The broader "New 52 Superman"
  redesign this suit is stated to draw from is consistently described (comics press) as replacing
  the classic lean, swimmer-shaped silhouette with a visibly armored, bulkier one — the panel lines
  themselves read as plate/scale boundaries, which reads bulkier at a glance even before the actual
  body proportions change. This is inference bridging two sources, not a single stated fact.

### Costume material story

- **[Tier 2, directly sourced — the strongest single fact in this document]** CBR, describing the
  in-game suit directly: *"a crest straight out of the New 52 and an emphasis on triangular accents
  across the entire bodysuit... The suit's texture is also interesting, looking almost like the
  rocky texture of a meteorite."* Read literally, this is: (1) a chest emblem matching the New 52
  comic's crest shape, (2) **triangular panel accents distributed over the whole suit, not just the
  chest**, (3) a surface texture the writer likens to rock/meteorite rather than cloth or smooth
  armor plate.
- **[Tier 3 background, corroborating]** The New 52 comic costume this draws from is described
  across multiple comics-press sources as: a **trunkless, one-piece armored bodysuit** (no separate
  briefs — the single biggest silhouette change from the classic look), **Kryptonian armor-style
  paneling with subtle muscle texturing built into the suit as seams**, a **high "Mao-style" collar**
  rather than an open V-neck, and **gauntlet-like wrist detailing**.
- **Reading the two together**: the design language is *"the suit is not cloth over a body — it is
  a segmented, faceted second skin,"* with the facets read through triangular seam/panel lines and a
  rough, geological (not glossy, not smooth-cloth) surface. This is consistent with a **matte-to-
  semi-rough armor-weave read, not a wet/shiny superhero-spandex read, and not a soft cloth read.**
  I did not find a stated numeric gloss/roughness value anywhere — no source states this in PBR
  terms, for the obvious reason that no source is a technical art breakdown I could reach. The
  "matte, faceted, geological" read is my synthesis of the two citations above, not a quoted fact.

### Cape

- **[Tier 3 background only — no game-specific citation found]** The New 52 comic redesign is
  described in passing as giving Superman "a more regal-looking cape," which is adjective-only and
  not a length, weight, or motion spec.
- **No source I reached — official or press — describes the game's cape specifically**: not its
  length relative to body height, not its motion (heavy drape vs. windswept streamer), not whether
  it reads as fabric, energy, or something else. **This is a real gap.** I did not fabricate a
  number here; see §7.
- Everything the RIG/cape recommendations below assert about the game's cape is therefore **not
  sourced** and is deliberately absent from §3 — I am not proposing cape numbers "translated from"
  a source I never found. The cape recommendation in §3 instead argues from the *silhouette-bulk*
  and *"regal, not tattered"* adjectives that ARE sourced, which is a narrower and more honest claim.

### Colour treatment

- **[Tier 2, aggregated via search, moderate confidence]** Reviewers describe *Suicide Squad: Kill
  the Justice League*'s Metropolis as explicitly **brighter and more colorful than Rocksteady's own
  earlier Arkham games**, with one paraphrase calling the city "a colorful onion" rather than "a
  desaturated dystopia." This is a city/environment claim, not a costume-swatch claim, but it sets
  the surrounding light environment the suit is meant to read against: **saturated, not
  moody-desaturated.**
  - Practically: a suit rendered in a flat, low-saturation blue would read as *duller* than its
    surroundings in this reference, which is the opposite of what a hero costume should do. The
    palette pull for our hero should stay saturated, not muddy it down toward "grounded realism."
- **No source states an exact hex or Pantone reference for the suit's blue, red, or any accent.**
  I did not find a stated palette anywhere — official or press. Any hex values below are original
  authored guesses at "a saturated, comic-primary blue/red consistent with what the sources
  describe," not extracted or reverse-engineered from any image.

### What this adds up to, stated plainly

The sourced design language is: **a bulkier, more heavily-built silhouette than a classic lean
Superman; a suit read as faceted/segmented armor rather than smooth cloth, via triangular panel
accents and a rough surface; a "regal" (not tattered, not utilitarian) cape of unstated length; and
an overall saturated, comic-bright colour environment rather than a desaturated one.** That is a
narrower, more honest summary than "the SSKTJL Superman look" as a single describable thing — most
of what makes that character's design read the way it does in motion (lighting, exact texture
maps, how the cape is simulated) is precisely the part official sources don't describe and the
part covered by the legal line at the top of this document.

## 3. Concrete translation to our `RIG` and `PERSONA_COLORS`

All numbers below are **original values authored for our own primitive rig**, chosen to match the
*adjectives* the sources above actually support (bulkier, faceted/armored, regal cape, saturated
palette) — not reverse-engineered from any image or file belonging to the source game. Baseline is
the current `Hero.js` (read 2026-08-06); current values are shown for every change so it is a diff,
not a rewrite.

### `RIG` changes — bulkier, more heavily-built silhouette

| Field | Current | Proposed | Why |
|---|---|---|---|
| `SHOULDER_X` | 0.34 | **0.39** | Widens the shoulder joints ~15%. This is the single highest-leverage silhouette change available in primitives: it directly answers the sourced "larger, statuesque figure" / bulkier-than-classic read (§2), and it is a one-line `RIG` edit with no geometry rewrite. |
| `HIP_X` | 0.15 | **0.14** | Small narrowing increases the shoulder:hip taper (was 0.34:0.15 = 2.27:1, becomes 0.39:0.14 = 2.79:1), sharpening the V-silhouette that reads as "heroic build" at a glance — the classic silhouette lever §ART-1 already identified as the highest-leverage fix, applied in the specific direction this reference argues for. |
| Torso capsule radius (`_buildBody()`, not currently a named `RIG` field) | `0.28` (hardcoded in `CapsuleGeometry(0.28, 0.6, 4, 12)`) | **0.31** | The torso itself, not just the shoulder joints, needs to read as bulkier — widening only `SHOULDER_X` moves where the arms attach but leaves a slim torso between them. **Flagging explicitly: this constant currently lives outside the `RIG` object, hardcoded in `_buildBody()`. Worth promoting to a named `RIG.TORSO_RADIUS` while touching this line, both for discoverability and because Phase 5's rig will want a named value here too.** |
| Limb capsule radius (`_buildLimbs()`, `CapsuleGeometry(0.09, 0.5, 3, 8)`) | 0.09 | **0.10** | Minor, lowest priority of the three — thicker arms/legs reinforce the bulkier read but contribute far less to the silhouette than shoulder width and torso radius. Only worth doing in the same pass since it is the same geometry call. |
| `HEAD_Y`, `TORSO_Y`, `SHOULDER_Y`, `HIP_Y`, `CAPE_Y` (vertical layout) | — | **No change proposed.** | No source gives a height-in-heads figure (§2), so there is nothing to translate here. Changing vertical proportions on no evidence would be guessing, not translating. |

### Cape geometry — longer, "regal" rather than short and utilitarian

The cape is the one area §2 found **the least game-specific evidence for** — no source describes
the game's cape directly. The only sourced adjective is "regal" (from the New 52 comic background,
not the game itself), which is a claim about a *tastefulness register* (formal, sweeping), not a
number. I am treating this as weak evidence for "longer and fuller reads more regal than short and
utilitarian" and nothing more specific.

| Field | Current | Proposed | Why |
|---|---|---|---|
| Cape `PlaneGeometry` height (`_buildCape()`) | `1.1` (hem sits ~0.56 m off the ground on a 1.85 m hero — roughly knee-length) | **1.3** | Extends the hem to roughly ankle-length, reading fuller/more sweeping. **Weak justification — flagged as the lowest-confidence RIG change in this document.** |
| Cape `PlaneGeometry` width | `0.7` | **0.78** | Modest width increase to keep the longer cape from reading as a narrow strip. |
| `CAPE_Z` (mount standoff behind the torso) | 0.32 | **No change proposed**, but **re-run `capeTorsoGap()` (§CAPE-1) after the width/length change** | The torso radius is also increasing (0.28 → 0.31) in this same proposal, and a wider, longer cape swinging near a wider torso is exactly the clearance question that test exists to catch. Do not ship the geometry change without re-running it. |

### `PERSONA_COLORS.super` — saturated, not muted

| Field | Current | Proposed | Why |
|---|---|---|---|
| `suit` | `0x3a6fd9` | **`0x2454d1`** | A deeper, more saturated cobalt-blue. Same hue family (no source gives a specific blue), pushed toward the "saturated, comic-bright" environment §2 found reviewers describing, rather than the flatter mid-blue currently shipped. |
| `accent` / cape colour | `0xc0392b` | **`0xd8221f`** | A more vivid, less brick-toned red — same reasoning: the sourced environment is bright and colorful, and a desaturated brick-red under that light reads as duller than its surroundings. |
| `skin` | `0xe0b48c` | **No change proposed.** | Nothing in any source I found addresses skin tone treatment specifically; changing it would be an unsupported guess. |

### Material `roughness`/`metalness` per group (locked decision 12: stay on `MeshStandardMaterial`, no toon)

Current values (confirmed by reading `Hero.js`'s constructor): `suit` roughness 0.6 / metalness 0.05
(explicit); `accent` roughness 0.7 / metalness **0.0 (THREE's own default — confirmed by reading
`node_modules/three/src/materials/MeshStandardMaterial.js` line 96, not assumed)**; `cape` roughness
0.7 / metalness 0.0 (default), double-sided; `skin` roughness 0.75 / metalness 0.0 (default).

| Group | Current roughness / metalness | Proposed | Why |
|---|---|---|---|
| `suit` | 0.6 / 0.05 | **0.7 / 0.15** | §2's sourced texture description is "rocky/meteorite," i.e. rough and faceted, not smooth spandex — pushes roughness up. A **small** metalness bump (not a large one) sells "Kryptonian tech armor" as a subtle sheen at grazing angles under the world's PMREM env map, without making the suit read as chrome. Deliberately conservative on metalness: decision 22 already found that pushing metalness up on the *world's* facades was rejected as an unmeasured, unjustified change, and this document is not proposing the hero repeat that mistake — 0.15 is a small nudge, not a materials rewrite, and should be spot-checked with `gl.readPixels` the same way decision 22's world materials were, before being called final. |
| `accent` | 0.7 / 0.0 | **0.6 / 0.1** | Slightly less matte than the suit so panel/emblem accents (see the emblem proposal below) catch a bit more specular highlight and read as a distinct material from the suit body, which is what "accent" is for. |
| `cape` | 0.7 / 0.0 | **No change proposed.** | The cape is fabric in every source that mentions it at all ("regal cape," not "armored cape") — it should stay the most matte, least metallic of the four groups, which is what it already is. Changing it would work against the one adjective §2 actually found. |
| `skin` | 0.75 / 0.0 | **No change proposed.** | Not addressed by any source. |

### One more concrete, low-cost addition: a chest emblem

§2's single most specific, most directly-sourced claim is the **triangular panel accents and New-52-style crest** — and our hero currently has **zero geometry expressing either.** This is worth calling out as its own recommendation because it is cheap and highly leveraged:

- Add a **flat primitive (a thin box or plane) on the torso front, in the `accent` material**, sized
  and positioned as an emblem. This uses a material group the hero **already has** (`accent`) — it
  adds triangle count and possibly one more mesh under the existing 8-draw-call budget (a coplanar
  decal-style shape wouldn't need a new material, only new geometry merged into the same draw call
  if authored as part of the same `BufferGeometry`, or a cheap extra call if it is its own `Mesh` —
  **an Engineer question, not a Research one, but flagged here because it is the single most
  direct, cheapest way to put the source's most specific claim on screen.**
- This is a primitives-only change (a box/plane is exactly what decision 14's "primitives only"
  constraint already allows) and needs **no rig, no new material group, and no new asset.**

## 4. What our current hero gets wrong, ranked

Ranked by how much each costs the read against §2's sourced design language, cheapest/highest-value
fixes first where the ranking is close.

1. **No panel/emblem detail anywhere.** §2's single strongest, most specific, most directly-sourced
   claim is the triangular panel accents and crest. Our hero is currently four smooth primitive
   shapes with flat colour fields — there is nothing on the model that could read as "faceted armor"
   at any distance. This costs the most because it's the one claim the sources actually commit to,
   and we currently express zero of it. Cheap primitives-only fix (§3, chest emblem).
2. **Silhouette reads slimmer/more uniform than the sourced "larger, statuesque" build.** Current
   shoulder:hip taper (2.27:1) is already reasonably heroic, but the torso capsule (0.28 radius) and
   limb capsules (0.09 radius) are proportionally slim next to that shoulder width, so the taper
   reads as "narrow-waisted" rather than "big all over." A one-line `RIG`/geometry-constant change
   (§3) fixes this directly.
3. **Suit material reads as slightly too smooth/spandex-like for an "armored" claim.** Roughness 0.6
   is not wrong on its own (decision 12 already correctly rejects toon shading), but it sits closer
   to the "smooth superhero cloth" end of the range than the "faceted, rocky-textured armor" the one
   direct source describes. A small roughness/metalness nudge (§3) closes most of this gap without
   contradicting decision 12.
4. **Cape reads shorter/more utilitarian than "regal."** Lowest-ranked because it is also the
   least-sourced claim (§2) — I would not spend much budget here relative to items 1–3, and the
   length change proposed in §3 is explicitly flagged as the weakest-evidence recommendation in this
   document.
5. **Colour is close but slightly under-saturated relative to the sourced "bright, colorful"
   environment claim.** Ranked last because it is the smallest visual delta of the five and the
   current colours are not wrong, just slightly flatter than the environment described in §2.

**What is NOT on this list, deliberately:** anything about facial detail, expression, hair, or
Superman-specific iconography beyond the crest (e.g. the specific glyph shape) — those require
either a rig (§5) or a name/likeness decision this document is barred from making (see the legal
line). Nothing above asks for either.

## 5. What needs a rig and cannot be done with primitives

Everything §3 and §4 propose is a primitive/material change and is doable today under decision 14's
constraints. The following genuinely cannot be done without the Phase-5 skeletal rig / Quaternius
asset work (decisions 9, 15) and should not be attempted as a primitives workaround:

- **The specific crest glyph shape.** A flat accent-material box can suggest "there is an emblem
  here" (§3), but a recognizable, specific glyph needs either a textured decal (a texture map, which
  the primitives-only build does not currently use anywhere — this would be a new kind of asset, not
  just new geometry) or actual authored geometry with enough resolution to read as a symbol rather
  than a coloured rectangle. Either is a bigger scope decision than this document should make
  unilaterally; flagging it rather than quietly deciding it.
- **Panel seam lines / surface detail beyond a flat colour field.** "Triangular accents across the
  entire bodysuit" (§2) as an actual surface pattern — not just one chest emblem — needs either a
  normal/roughness texture map or enough extra primitive geometry (ridges, plates) to be a real
  authoring project, not a tuning-value change. This is squarely Phase 5 rig-and-texture territory.
- **Cape cloth behavior beyond the current CPU sine wobble.** A "regal, sweeping" cape in motion —
  the way weight and drape read, not just resting length — is an animation-fidelity question the
  current CPU vertex wobble was never trying to solve (`Hero.js`'s own comment: "eyeballed, not
  ported"). A cloth solver or a much more elaborate wobble function could chase this, but it is a
  disproportionate amount of engineering for a claim (§2, "regal") that is itself weakly sourced.
  Not recommended even for Phase 5 unless the user specifically wants cape fidelity as a project.
- **Build/bulk conveyed through actual muscle definition or a differently-proportioned mesh**
  (rather than uniform capsule scaling) — e.g., a visibly broader trapezius/deltoid silhouette,
  which is part of how the "John Cena"-style build reads (if that report is accurate; see the
  confidence caveat in §2) — needs sculpted or authored geometry, which primitives cannot produce.
  The `RIG`/radius changes in §3 are the primitives-only approximation of this; they are a real
  improvement but a capsule will never read as a modeled trapezius.

## 6. CC0 sources (Quaternius-first, per locked decision 15)

Checked Quaternius's public catalog for anything matching this specific style — a heavily-built,
armored-read male superhero base mesh with a separate cape.

- **Honest finding: nothing in Quaternius's free catalog is purpose-built for this.** Quaternius's
  strength is stylized low-poly characters (their well-known "Ultimate Modular" and ready-to-use
  character packs), fantasy/sci-fi kits, and animals — not a realistic-proportioned, armored
  superhero base mesh with a cape. I did not find a specific asset pack, free or paid tier, that
  matches "bulky armored humanoid + separate cape" closely enough to recommend by name.
- What Quaternius **does** offer that is relevant, but only partially: their humanoid base
  meshes/rigs are a plausible **skeleton donor** for Phase 5's rig once one exists (per decision 9,
  imported rigged assets are in scope from Phase 2 onward) — i.e., a generic Quaternius rig could
  supply bones/animation, with a custom-authored mesh skinned to it, rather than using a Quaternius
  character mesh as the hero's actual body. That is a **rig/skinning strategy**, not an asset match,
  and is an Engineer-phase decision, not something this document can respsonsibly recommend as "use
  asset X."
  - I did not verify this against Quaternius's actual current catalog contents in enough depth to
    name a specific pack — flagging as a gap (§7) rather than asserting a specific SKU I have not
    confirmed still exists or is licensed CC0 today.
- **Cape specifically:** capes/cloaks are a common accessory in Quaternius's fantasy character packs
  (their "Fantasy" and RPG-adjacent character sets typically include cloak variants), which is a
  more promising match than the body itself — but again, I could not verify a specific current pack
  against this project's needs with confidence, and am not naming one without that verification.
- **Bottom line:** if a Quaternius asset is wanted for the *body* of the eventual rigged hero,
  nothing found here is a clean match — the primitives-first, custom-authored approach this document
  already assumes (§3) stays the better near-term path. Quaternius is more promising as a rig/skeleton
  and animation-clip donor (decisions 9/15/16 already point this direction) than as a character-mesh
  source for this specific silhouette.

## 7. Gap list — what I could not verify

- **Could not read the one ArtStation Magazine feature article specifically about this game's art
  direction** (403 on every fetch attempt) — this is the single most likely place an actual named
  art director's own words about the Superman design would live, and I could not get past the
  paywall/bot-block with the tools available. Everything in §2 is a workaround for not having this.
- **Could not read any individual ArtStation concept-art piece page** (all 403'd) — so no captions,
  artist statements, or process notes from the named concept artists (David Richardson, Adam
  Oresten, Davide Beghetto, Pablo Hoyos Isusquiza) who are confirmed (by search results existing at
  all) to have posted official-adjacent Superman art for this game.
- **Could not verify the "John Cena" build comparison against GameSpot's actual review text** (403
  on fetch) — reporting it only as a search-tool paraphrase, explicitly downgraded in confidence
  throughout this document.
- **No source anywhere states a height-in-heads figure, a shoulder-width number, or any other
  measurable proportion** for the game's Superman. All proportion claims in this document are
  qualitative ("larger," "statuesque," "bulkier"), and every number in §3 is my own authored
  translation of those adjectives, not a sourced figure.
- **No source describes the game's cape specifically** — length, motion, material. The one adjective
  used ("regal") comes from background material about the 2011 comic redesign, not the game itself.
- **Could not confirm current Quaternius catalog contents in enough depth to name a specific asset
  pack** for either a cape-equipped humanoid or a rig/skeleton donor — §6's recommendation stops at
  "this general category is promising" rather than naming a SKU, deliberately, because I could not
  verify one.
- **Did not find any stated numeric material values (roughness/metalness/hex) for the suit in any
  source** — every number in §3's materials table is an original value I chose to match the
  qualitative language sourced in §2, explicitly not extracted from any image or file.
- **Did not investigate the corrupted/Brainiac-controlled variant's design as a separate visual
  target** (glowing eyes, purple Brainiac tells) beyond noting it exists — it reads as a narrative/
  VFX state change layered on the base costume, not a different base silhouette, and the user asked
  about "the Superman character design," which I read as the base costume rather than the corruption
  state. Flagging this reading in case it's wrong — if the user specifically likes the corrupted
  look (e.g., the glowing-eye VFX), that is a different, narrower research question this document
  does not answer.

## 8. Ranked adoption order

Ordered by (sourced confidence × visual impact) ÷ implementation cost — highest first. All items are
primitives/material changes doable now unless marked Phase 5.

1. **Chest emblem primitive, `accent` material** (§3). Highest confidence source (CBR, direct), zero
   new material groups, cheapest possible geometry addition (one box/plane). Do this first.
2. **`SHOULDER_X` 0.34→0.39 and `HIP_X` 0.15→0.14** (§3). One-line `RIG` edit, directly answers the
   two independent "bulkier/statuesque" citations, no test risk beyond the existing hero-proportion
   sanity checks.
3. **Torso capsule radius 0.28→0.31 and limb capsule radius 0.09→0.10** (§3). Same justification as
   #2, slightly more invasive (touches `_buildBody()`/`_buildLimbs()` geometry calls, not just
   `RIG`), and worth promoting the torso radius into a named `RIG` constant while there.
4. **`suit` material roughness 0.6→0.7, metalness 0.05→0.15** (§3). Directly sourced texture
   language, small numeric change, but needs a browser spot-check (`gl.readPixels`, per this
   project's own CLAUDE.md convention and the precedent of decision 22) before being called final —
   PBR metalness bumps have burned this project with unmeasured brightness changes before.
5. **`PERSONA_COLORS.super` hex updates** (§3). Lowest sourced confidence of the material changes
   (no source gives an exact colour), smallest visual delta, cheap to apply and cheap to revert.
6. **Cape geometry lengthening** (§3). Weakest-evidence RIG change in this document — do it last,
   and re-run `capeTorsoGap()` (§CAPE-1) before shipping given the simultaneous torso-radius
   increase in #3.
7. **Phase 5 items** (§5: panel surface texture, specific crest glyph, cloth-fidelity cape, sculpted
   musculature) — not orderable against 1–6 because they require the rig/asset pipeline that does
   not exist yet; listed here only so they are not lost, not because they compete with the
   primitives-only items above on cost.

---

**Status: COMPLETE.**

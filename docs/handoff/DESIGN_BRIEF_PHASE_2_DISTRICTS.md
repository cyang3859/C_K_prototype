# Design Brief — Phase 2, Run 1: The Two Districts

**Written by:** the orchestrator, session 7, 2026-08-01.
**For:** the Design agent (Sonnet).
**Deliverable:** `docs/handoff/DESIGN_SPEC_PHASE_2_DISTRICTS.md`.
**Next gate after you:** Review, for a **budget and feasibility check only** — it has no vote on
your taste. See `DESIGN_AGENT_BRIEF.md` "Where it sits in the pipeline."

This is the Research→Design handoff the charter requires: a document, not a gesture at existing
files. It has all five required parts — reference set, what is locked, what is open, known
constraints, and the legal boundary.

---

## ⚠️ READ THIS FIRST: `DESIGN_AGENT_BRIEF.md`'s constraints table is STALE and this brief overrides it

The charter is still correct about your **charter** — what you own, what you produce, the five-part
handoff contract, and that you do not write code. **Its "Hard constraints" table is Phase 1 and three
of its rows are now wrong.** Design to the numbers here, not there.

| Charter row (Phase 1) | Status now | The Phase 2 value |
|---|---|---|
| "Draw calls: **45 measured, 60 ceiling**" | **SUPERSEDED** — twice over | The 60 ceiling was raised by **locked decision 7**, and every pre-2026-07-31 figure undercounted by ~half because it counted one pass. The real Phase 1 baseline is **57 total (32 main + 25 shadow)** and the Phase 2 working ceiling is **150 total, both passes** (`RESEARCH_PHASE_2_WORLD.md` §BUD-6). |
| "Phase 1 assets: **no imported meshes**, geometry is primitives" | **SUPERSEDED** by locked decision 9 | From Phase 2 onward the project accepts imported rigged assets. **For your subject this run it barely matters** — districts are geometry you specify, not sourced art — but you are no longer forbidden from assuming an asset pipeline exists. |
| "Street dimensions exact and locked" | **STILL BINDING** | Unchanged. See §2. |
| "Curb height 3–7 cm — not a defect, do not fix" | **STILL BINDING** | Unchanged. |
| "Shadows stable — a spec that reintroduces acne will be sent back" | **STILL BINDING, and harder now** | Phase 2 adds CSM. See §4. |
| "Procedural `CanvasTexture` is the cheapest realism lever — use it" | **STILL BINDING, and more important than ever** | See §4. This is the single most useful sentence in the charter. |

**Every draw-call number you write must state that it counts both passes.** That is a standing
orchestrator ruling, because `renderer.info.render.calls` reports both and that is what anyone can
read off the debug HUD. A figure without the convention stated is an incomplete spec.

---

## Read these, in this order, and nothing else end-to-end

1. **`docs/handoff/KNOWLEDGE_BASE.md`** — the consolidated map of the build. Module wireframe, app
   lifecycle, settled decisions, and a document index in §8. It exists so you do not read the
   24-document pile cold.
2. **`docs/handoff/RESEARCH_PHASE_2_WORLD.md`** — your Research handoff, and the reason this run
   exists. **§DEN-1 through §DEN-9 are addressed to you specifically.** Also read §BUD-2, §BUD-3 and
   §BUD-6 (they price your decisions), and §DIS-1/§DIS-2/§DIS-4 (they define your districts).
3. **`docs/handoff/PIPELINE_STATE.md`** — locked decisions 1–18. **Decisions 7, 8, 10, 11 and 14 bind
   this run.**
4. **`docs/handoff/DESIGN_AGENT_BRIEF.md`** — your charter. Constraints table superseded as above.

Consult `RESEARCH_LA_WORLDBUILDING.md` **by section** — the sections you want are listed in §1 below.
Consult `RESEARCH_FINDINGS.md` by section via the knowledge base's index.

**Never read `kodaman_prototype.html` in bulk.** 16,507 lines; it has killed agent budgets here.
Targeted `grep` only.

**If the docs and the code disagree, the code wins — and say so inline.** Three agents on this
project have now found real doc/code contradictions by checking rather than trusting, and one
correctly contradicted its own brief. That includes this brief.

---

## 1. Reference set — what these districts are modelled on, specifically

Everything below is already researched and cited. **Cite these sections; do not restate them, and do
not re-research them.**

### District A — the tower plateau

- `RESEARCH_LA_WORLDBUILDING.md` **§3.1** — the 20 tallest LA buildings, with real dimensions.
- **§3.2** — the 150 ft height limit, and why LA is flat. This is the *reason* the skyline looks how
  it looks; it is not trivia.
- **§3.3** — the flat-roof/helipad ordinance, **the reason LA's towers have no interesting tops.**
  Phase 1 already ships a 12 m helipad on its bespoke tower.
- **§1.1** — the Spanish/Ord grid, ~36° off cardinal. District A sits on this.
- `RESEARCH_PHASE_2_WORLD.md` **§DEN-2** — the key reframing: **real LA towers are also fairly boxy.**
  The fix is not "make every tower organic," it is massing variants and edge articulation. Read this
  before you design anything.

### District B — the mixed-height boulevard corridor

- **§1.2** — the cardinal PLSS/township grid. District B sits on this. **The rotation difference
  between A and B is the entire point of the pairing** (locked decision 10).
- **§3.4** — mid-rise and low-rise reference.
- **§5.4** — Hollywood Walk of Fame. **§5.9** — Sunset Strip signage. **§5.5** — Broadway Theater
  District (a strong candidate for borrowed detail even though it lost the district vote).
- **§5.8** — Koreatown density.

### Shared

- **§6.5 — Architecture typologies, distinguishing features.** This is the most directly useful
  section in the entire worldbuilding document for your purpose, and `BUD-3` explicitly names it as
  the source of the facade families you must define. **Start here.**
- **§6.1 palms, §6.2 street tree stock, §6.3 marine layer/June gloom, §6.4 sun angles.**
- **§2.x** — street right-of-way standards. Locked; see §2 below.
- `DESIGN_SPEC_TOWER_PALETTE.md` — **a prior spec of yours that shipped.** Its four-constant palette
  fix, and the PMREM environment map its §"Scope question" escalated, are both **implemented and
  live** (`Sky.js`, `TUNING.ENV_INTENSITY`). **Build on it; do not re-derive or contradict it.**

---

## 2. What is LOCKED — not open to redesign

| Locked | Value | Source |
|---|---|---|
| **The two districts** | A dense **tower plateau on the 36°-rotated historic grid**, paired with a **mixed-height boulevard corridor on the cardinal grid**. | Locked decision 10 |
| **Why they were chosen** | The rotation contrast: the same sun rakes them differently at the same hour, giving `DayNightCycle.js` per-district differentiation for free. **A spec that erases the rotation contrast defeats the decision.** | Locked decision 10 |
| **World extent** | Vast and explorable but **BOUNDED**. Explicitly not endless. | Locked decision 8 |
| **World edge** | A hard wall behind an atmospheric fade — **both, not either.** The wall is an unreachable safety net; the fade is the player's experience. The fade is a tuning value feeding the existing `Fog`, **not a new rendering system.** | Locked decision 11 |
| **Street dimensions** | **Exact.** S-470-1: 30.48 m ROW / 21.34 m roadway / 4.57 m sidewalks. **You change the look, never the survey.** | Charter, §2.x |
| **Chunk size** | **256 m, validated not disturbed** — §DIS-4 confirmed real Ord-grid blocks at 112/200 yards (~102/183 m) from a primary source. | §DIS-4 |
| **Curb height** | 3–7 cm. A known deliberate compromise pending Phase 2 step-up collision. **Not a defect. Do not fix it.** | Charter |
| **Renderer** | **WebGL**, not WebGPU. Classic materials, not TSL. | Flag F1 |
| **Frame budget** | 60 fps at 1920×1080. Non-negotiable. | Charter |
| **No post-processing** | `EffectComposer` is **Phase 7**. `Renderer.js` says so in its own comment. Any effect you specify must be achievable in ordinary forward rendering. | `Renderer.js` |

---

## 3. What is OPEN — your actual design latitude

This is the run's real work.

1. **The facade families.** `BUD-3` requires buildings to be grouped into a small number of
   `BatchedMesh` instances **keyed by facade material family** — it names "glass tower, stucco
   low-rise, ornate theater district" as a *sketch*, at 3–4 families per district. **Defining those
   families for real is your deliverable, and it is the single highest-leverage thing in this
   brief**, because the family count *is* the building draw-call count. Every family you add costs
   ~2 calls per district (main + shadow). Every one you merge saves the same. **Name them, say what
   each is applied to, and justify the count.**
2. **The massing recipes.** `DEN-2` proposes **3–5 recipes** built from 2–4 stacked boxes (podium,
   setback, cap/parapet), applied per building **via data** — following the declarative-data
   philosophy `IMPLEMENTATION_PLAN.md` already uses for quests — not hand-placed per building. Design
   the recipes: which boxes, what proportions, which district each suits.
3. **Palette and materials per district**, in hex, with roughness/metalness as numbers. The two
   districts should be **tellable apart at a glance from the air**, since the hero flies.
4. **Corner and edge articulation** — `DEN-2` specifically suggests chamfers, recesses and pilaster
   lines **suggested by the facade atlas's existing UV-tiling rather than new geometry.** Prefer that.
5. **Roofline and skyline variety** (`DEN-3`) — LA is polycentric and Phase 1's single block cannot
   show it. §3.3's flat-roof ordinance constrains you *and* gives you the authentic answer.
6. **Street-level clutter** (`DEN-4`) and **vegetation** (`DEN-7`) — instancing-first. `DEN-7` notes
   Phase 1 already validated this. **Stay on the world side of the boundary `DEN-4` draws:**
   pedestrians and crowd meshes are character work and are explicitly out of scope here.
7. **Terrain** (`DEN-5`) — "LA is famously flat, but flat is not featureless, and the two are being
   conflated." A genuine opportunity, cheaply.
8. **Landmark placement and sightlines** (`DEN-6`) — flagged as **the cheapest lever in the whole
   density section.** Landmarks with real dimensions are in §5.x.

---

## 4. Known constraints — the budget, stated properly

**The ceiling is 150 draw calls total, both passes** (`§BUD-6`). Do not treat that as an allowance to
spend down. Three things make it tighter than it sounds:

1. **§BUD-6 itemises only ~67–85 of it.** The remaining headroom is **deliberately reserved to
   absorb CSM's unmeasured shadow cost** (`§ATM-3`/`§BUD-5`), which is a real open multiplier nobody
   has measured because `CSM.js` does not exist yet. **That headroom is not yours.**
2. **§BUD-2 is the biggest budget risk in the project and it lands on your subject.** Naively
   repeating Phase 1's per-block ground/road pattern (7 meshes) once per 256 m chunk costs
   **7 × 64 = 448 draw calls before a single building.** Ground and road must be merged or instanced
   *across* chunks. `Chunk.js` is **"a data window into district-shared batches," not "a `StreetBlock`
   at 256 m."** **If your spec implies per-chunk ground meshes, it is unshippable.**
3. **The hero is already budgeted at 8** (locked decision 14), down from 14. That gain exists to be
   spent on the world, but it is 8 calls, not a windfall.

**The free lever, restated because it is the most useful thing in your charter:** procedural
`CanvasTexture` is already how every facade material is built (`StreetBlock.js:311-362` draws a
window grid to a 2D canvas). **Texture and material richness costs texture memory, not draw calls.
Geometry costs calls. Prefer texture every time it can carry the load.** `DEN-2`'s pilaster-lines-via-
UV-tiling suggestion is exactly this move, and `DESIGN_SPEC_TOWER_PALETTE.md` was a zero-draw-call
spec that fixed a real visual defect purely through constants.

**Shadows and CSM.** Phase 2 introduces cascaded shadow maps (`§ATM-2` — the addon default is **3**
cascades, not the 4 an older document claimed; confirmed at `CSM.js:61`). Objects straddling cascade
boundaries can be drawn into the shadow pass more than once. **A spec that reintroduces shadow acne
or swimming will be sent back, and large thin geometry across cascade boundaries is the likeliest
way to cause it.**

**Every geometry addition carries its draw-call and triangle cost, stated, both passes. An
unbudgeted geometry request is an incomplete spec.** Triangle ceiling is ~500,000 whole-scene
(`§BUD-7`), which `DEN-2` notes is not the binding constraint — draw calls are.

---

## 5. The legal boundary

Locked decisions 5 and 6. **The 3D build uses original, legally-distinct names and designs from day
one.** For districts this is a lighter constraint than it is for characters, but it is not absent:
**recognizable real LA landmarks are explicitly permitted** (locked decision 3 — "recognizable
landmarks, invented streets"), while anything trademarked — a named studio's logo, a specific
company's signage, a protected building silhouette used as a brand — is not. Invent the signage and
the business names. **Street names are invented; landmarks are recognizable.** If a specific landmark
feels like a genuine edge case, **flag it rather than deciding it** — naming authority is the user's
per locked decision 6.

---

## 6. Deliverable

**`docs/handoff/DESIGN_SPEC_PHASE_2_DISTRICTS.md`**, to the charter's contents list: palette in hex,
materials as numbers, proportions in metres, geometry changes with **both-pass** draw-call and
triangle costs, one-or-two-line rationale per choice tied to a cited reference, and **priority order
so that cuts are your decision and not the Engineer's.**

Follow the two research runs' conventions, which have worked well here:

- **Tag every finding with a short ID** so later documents can cite it bare. Runs 1 and 2 used
  `BUD-`/`DEN-`/`ASSET-` etc. and continued each other's numbering rather than restarting. **Use
  fresh prefixes** — suggest `DA-` (district A), `DB-` (district B), `FAM-` (facade families),
  `MAS-` (massing recipes), `MAT-` (palette/materials), `PROP-` (clutter/vegetation).
- **Label confidence explicitly on anything factual** — `[MEASURED]` / `[SOURCED]` / `[ESTIMATE]`.
  This project has repeatedly been bitten by confident prose that was a guess. Design choices are
  taste and need no label; claims about the code or the world do.
- **End with "what I could not answer"** and a consolidated **"what needs a user decision."** In both
  research runs these were the most immediately useful sections in the document.

---

## 7. Working rules — non-negotiable

- **You must not spawn subagents. Not one, not read-only, not "small and foreground."** One agent
  here fanned out to four children unprompted and burned the budget; another violated this rule after
  being told in these exact words. Do the work yourself.
- **Write the file incrementally, section by section, from your first section onward.** Three agents
  in this project have been killed mid-task and **only work already on disk survived.** Do not hold
  the document in context and write it at the end. This is the most important process instruction
  here.
- **You do not write code.** Not a patch, not a diff, not a snippet beyond an illustrative constant.
  `kodaman3d/` and `kodaman_prototype.html` are read-only to you; your only writes are your own
  deliverable in `docs/handoff/`.
- **Reading the Phase 1 source is encouraged** — `kodaman3d/src/world/StreetBlock.js` is the monolith
  you are generalizing (`§STR-2`), and its lines 311–362 are the procedural facade texture mechanism
  you should lean on hardest.
- **If realism genuinely requires breaking a locked constraint, that is a legitimate finding.
  Escalate it to the orchestrator as a scope question. Do not assume it, and do not silently design
  around it.** `DESIGN_SPEC_TOWER_PALETTE.md` did exactly this correctly — it flagged the environment
  map as out of its mandate rather than specifying it, and the orchestrator then implemented it.
  That is the model.

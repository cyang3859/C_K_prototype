# Rename mapping — APPROVED

**Status: APPROVED by the user 2026-08-05.** All proposed names below are accepted as written.
This is now the reference the Engineer stage ports Phase 2 content against.

**One item is still unnamed and needs the user:** the Level 1 subtitle replacing
`City of Heroes` (see below). It was deliberately left open for the user to choose and the
approval did not name it, so it stays open rather than being filled in by an agent.

Nothing is applied yet — approval settles *which names*, and the renames land as content ports,
per the 2026-07-30 decision that the cost is paid during Phase 2 porting when the code is being
rewritten anyway. `kodaman_prototype.html` is still never edited.

**Original status line, for the record: PROPOSAL. Nothing here is applied.** Per locked decision 6, agents propose and the
user approves. This document turns `RESEARCH_FINDINGS.md` §C4's "proposed replacement" column —
which held *descriptions* ("a new reporter-companion name") rather than usable names — into
concrete candidates you can accept, swap, or overrule line by line.

**Scope, per the user decision of 2026-07-30:** these names are for the **3D build only**.
`kodaman_prototype.html` is NOT edited; it stays a working design reference under its current
names. Verified 2026-08-05: `kodaman3d/src` contains **zero** occurrences of any flagged term,
so this table is a naming decision for content not yet ported, not a refactor of shipped code.

---

## ⚠️ Two things the §C4 audit missed

**1. "City of Heroes" is a live trademark, and it is player-visible.**
`kodaman_prototype.html:15298` and `:15308` render `City of Heroes` as the Level 1 subtitle on
the title screen — `ctx.fillText`, not a comment. It is NCsoft's mark for a **superhero game**,
i.e. the same goods and services, which is the strongest possible collision and worse than
anything in §C4's table. §C4 does not list it because its grep covered DC terms only.

The other two level subtitles on that screen are `The Badlands` (`:15320`) and **`The Amazon`**
(`:15330`). *The Amazon* is not an incidental geographic label — it is the Level 3 arc's name,
sitting directly on top of Diana/Themyscira/Ares, and "the Amazon" is exactly how DC refers to
Wonder Woman. It should be renamed **with** that arc rather than treated separately. *The
Badlands* looks clean: a generic landform and a real US national park, with no games-class
collision I am aware of.

**2. The "Daily Planet" fix is free and internally consistent.**
§C4 proposes "an invented newspaper name" for the single `Daily Planet` NPC line. The game
already has its own paper — **The Weekly Planet** — as its central hub. That line should simply
say Weekly Planet. No invention needed, and it fixes a continuity bug: a vendor in the hero's
own city was hawking a rival paper that exists nowhere else in the game.

---

## Proposed names

Rationale for the set as a whole: LA-rooted where the fiction is LA-rooted, period-plausible for
a newspaper-and-noir register, and deliberately *not* structural clones — an L-initialled
industrialist is not protectable, but reusing a mark's cadence invites the comparison the rename
exists to avoid.

### The two you should pick personally

These carry the most references and the most characterisation. Primary is my recommendation;
alternates are there so you have something to react against.

| Current | Refs | **Primary** | Alternates | Note |
|---|---:|---|---|---|
| **Lois / Lois Lane** — reporter companion | 345 | **Nora Vance** | Reyna Cruz · June Castellan · Marisol Vega | The largest single rename in the project. "Vance" is short, headline-friendly, and survives being shouted mid-fight. Cruz/Vega lean into LA's actual demographics if you want the cast less Anglo by default. |
| **Power Girl** — hero companion | 93 | **Meridian** | Halcyon · Lumen · Cinder | Sun-at-its-highest, which ties to the solar-origin term proposed below and to the LA light the worldbuilding doc keeps returning to. Avoided: *Solstice* and *Zenith* are both taken (DC and 2000AD respectively). |

### The rest

| Current | Refs | Proposed | Rationale |
|---|---:|---|---|
| **Wayne / Wayne Enterprises / Bruce Wayne** | 112 | **Ashgrove Industries** · informant **Elliot Ashgrove** | Keeps the one-family-one-company structure the quest logic assumes, so `wayneDialogueDone` → `ashgroveDialogueDone` is mechanical. |
| **Arkham / Arkham Asylum** | 126 | **Kestrel Ridge Secure Hospital** | Invented. Deliberately avoids Blackgate and Belle Reve (both DC) and Ravencroft (Marvel) — the obvious substitutes are all themselves marks. "Secure hospital" is the neutral real-world term. |
| **LexCorp / Lex Luthor** | 114 + 28 | **Aurum Dynamics** · **Lucian Arden** | The genius-industrialist-turned-warlord archetype is not protectable and is kept intact. Gold/alchemy reading for a man who thinks he is refining the world. |
| **Gotham City** | 31 | **Ironhaven** | A separate destination city, referenced not visited. Industrial register, distinct from the LA setting. |
| **Metropolis** | 4 | **Ironhaven**, or the game's own city | Dialogue-only. If the four lines mean "that other big city," reuse Ironhaven rather than minting a third. |
| **Kryptonite / Kryptonian** | 5 + 1 | **helionite** · **helion-born** | Sun-derived, so the hero's weakness and origin share a root with Meridian's name. Cheapest rename with the highest recognisability payoff. |
| **Wonder Woman / Diana / Themyscira / Ares** | 61 | companion **Alexia** · island **Enthalia** · antagonist **Enyalios** · level name **The Enthalian Coast** | §C4's own reasoning: Ares alone is public-domain Greek, but *this* combination is DC-coded. Renaming companion and island breaks the association. **Enyalios** is a genuine classical epithet of Ares — public domain, keeps the war-god register, drops the DC read. The level's `The Amazon` subtitle moves with the arc. |
| **"Daily Planet"** | 1 | **The Weekly Planet** | See above. Free, and fixes a continuity bug. |
| **"City of Heroes"** (missed by §C4) | 2, player-visible | **needs your call** | Level 1's title-screen subtitle. Suggestions: *The Sunlit City* · *Angel City* · *Cityside*. Flagging rather than picking, because level names are tone-setting in a way an agent should not decide alone. |
| Darkseid / Superman / Batman | 5 | reword in place | Comment-only: "colossus-class", "heroic-flight lean", "stealth-combat AI". No logic touched. |

**Not flagged, confirmed fine:** "Kodaman" is the project's own name. Enemy archetype strings
(`brute`, `genius`, `energy`, `warlord`, `robber`) are generic descriptors.

---

## What I could not verify, and you should

**I have not run a trademark clearance search, and I cannot.** These names were checked against
my own knowledge of DC, Marvel and adjacent comics/game marks — which is how *City of Heroes*
slipped past the original audit in the first place, and my knowledge has the same blind spots.

Before any of these ship publicly, each proposed name wants a USPTO TESS search plus a plain web
search for existing games and comics using it, in the **entertainment/game** class specifically.
The names most worth checking hardest, because they are the most generic and therefore the most
likely already taken in this space: **Meridian**, **Halcyon**, **Ironhaven**, **Aurum**.

This is a real gap, not a formality — but it is also cheap to close, and it does not block
choosing the names.

---

## Sign-off — GRANTED 2026-08-05

The user approved the table as proposed. Settled: **Nora Vance** (reporter companion),
**Meridian** (hero companion), **Ashgrove Industries / Elliot Ashgrove**, **Kestrel Ridge Secure
Hospital**, **Aurum Dynamics / Lucian Arden**, **Ironhaven**, **helionite / helion-born**,
**Alexia / Enthalia / Enyalios** with **The Enthalian Coast**, and **The Weekly Planet** for the
stray `Daily Planet` line.

**Still open — Level 1's subtitle.** `City of Heroes` must not ship, but the replacement was left
to the user and has not been chosen. Standing suggestions: *The Sunlit City* · *Angel City* ·
*Cityside*. Until it is named, treat the Level 1 title card as blocked for porting.

**Still owed — trademark clearance.** No search has been run and no agent can run one. Approval
settles taste, not availability. **Meridian, Halcyon, Ironhaven, Aurum** are the most generic and
want a USPTO TESS plus games-class web search before public release. This is the same gap that
let `City of Heroes` survive the original audit.

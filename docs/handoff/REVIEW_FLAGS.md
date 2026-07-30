# Review Flags — Pipeline Audit

**Reviewer:** Review Agent (Sonnet), 2026-07-30
**Scope:** `PIPELINE_STATE.md`, `PHASE_1_SPEC.md`, `RESEARCH_FINDINGS.md`, `RESEARCH_LA_WORLDBUILDING.md`
**Rule:** severity is about *impact if unresolved*, not about how much text it took to find. BLOCKER =
would stop the Engineer mid-Phase-1. MAJOR = would cause rework, contradiction, or a wrong later
decision if not resolved before the relevant phase starts. MINOR = cosmetic, easily fixed, or
already self-healing.

**Headline result: zero unresolved BLOCKERs remain for Phase 1 after this review.** The three known
conflicts are adjudicated below (F1–F3) and the rulings are carried into `ENGINEER_BRIEF.md` — the
Engineer does not need to make any of these calls itself. Everything else found is MAJOR or MINOR,
and the MAJOR items are either resolved here with a concrete ruling or explicitly deferred to a
later phase (never to Phase 1).

---

## F1 — BLOCKER→RESOLVED. Renderer conflict (WebGL vs WebGPU)

**What's wrong:** `PHASE_1_SPEC.md` §5 specifies `new THREE.WebGLRenderer({ antialias: true,
powerPreference: 'high-performance' })`. `RESEARCH_FINDINGS.md` §A13 recommends `WebGPURenderer`
(with automatic WebGL2 fallback) as the better default for a 2026 desktop-only audience, and flags
this exact discrepancy in its own Open Questions. `RESEARCH_FINDINGS.md` §A5 adds a complicating
fact: the official CSM (cascaded shadow map) addon is **WebGL-only**; WebGPU needs a separate,
less-mature `CSMShadowNode`.

**Why it matters:** Two committed documents actively disagree on the single most foundational line
of Phase 1's rendering code. An Engineer reading both would not know which to implement, and the
choice has downstream consequences (TSL vs classic materials, addon compatibility, CSM path) that
are expensive to reverse once character/world code is built against one API.

**Ruling: WebGLRenderer, for Phase 1 AND as the project's renderer for the full plan (Phases 1–8),
not just Phase 1.** This confirms the orchestrator's lean and overrides §A13's recommendation for
this project specifically. Reasoning:

1. **CSM is not optional for this project's end state.** RESEARCH_LA_WORLDBUILDING's own scale
   analysis (see F3) concludes the world will grow well beyond a single block, with long flight
   sightlines over an outdoor city — exactly the case CSM exists for ("one shadow map stretched
   over a whole city block looks blurry up close or needs an enormous texture," §A5). The
   WebGPU-path equivalent (`CSMShadowNode`) is not established prior art here; using it would mean
   this project debugging shadow-cascade correctness on a newer, thinner-documented code path
   instead of the addon that ships in the mrdoob/three.js repo itself.
2. **§A13's own language undercuts adopting WebGPU now:** "late-beta/soft-production state,"
   maintainers targeting full stable "by end of 2026," r185's TSL changelog still shows active
   feature work — i.e. the API surface isn't frozen. That is a live-project risk, not a
   theoretical one, for a solo-dev-plus-agent team that cannot afford to chase a moving target.
3. **Consistency with every other locked choice in this pipeline.** Vite 7 over 8 ("the
   conservative pin"), pinned exact dependency versions, hand-rolled capsule over Rapier in Phase
   1 — the project's standing bias is "conservative now, upgrade later once stable," and the
   renderer should follow the same rule for the same reason.
4. **WebGPU buys Phase 1 nothing.** §A13's own case for WebGPU is throughput/compute-shader
   headroom for large-scale scenes; Phase 1 is a single 300×300 m block with ~12 buildings. There
   is no workload in scope that WebGL2 cannot handle at 60 fps.
5. **Fallback-by-default doesn't neutralize the risk cited in point 2** — adopting `WebGPURenderer`
   today still means writing/maintaining TSL materials (or dual GLSL/WGSL paths) against an API
   still gaining features, for a benefit (compute-shader throughput) this project's scope does not
   need before Phase 7 post-processing at the earliest.

**What this means for the documents:** `RESEARCH_FINDINGS.md` §A13's WebGPU recommendation stands
as a *documented alternative for future consideration*, not a contradiction requiring either file
to be edited (per the "do not modify the research files" rule). `ENGINEER_BRIEF.md` states the
resolved decision directly so the Engineer never sees the disagreement. Revisit WebGPU migration
after Phase 8, once `CSMShadowNode` and TSL are further along and the game has a working content-
complete baseline to protect via a careful, isolated migration — not mid-build.

---

## F2 — MAJOR→RESOLVED. Citation bug: Hero.js cites §C4, means §C3

**What's wrong:** `PHASE_1_SPEC.md` §5, `src/entities/Hero.js` section, line 213: "Primitive-built,
no external assets (see `RESEARCH_FINDINGS.md` §C4 — this is the deliberate Phase 1 choice...)."

**Verified:** `RESEARCH_FINDINGS.md`'s actual section structure is:
- **§C3 — Character asset strategy given no artist and no budget.** This is the section that
  actually recommends "Keep primitive-built (`CapsuleGeometry`/`SphereGeometry`) characters for
  Phase 1 as already decided — correct low-risk starting point with zero art budget." This is the
  content the spec's sentence is describing.
- **§C4 — Trademark audit (PENDING USER SIGN-OFF).** Unrelated to character-asset technique; this
  is the ~900-occurrence rename mapping table.

`RESEARCH_FINDINGS.md`'s own Open Questions item 4 already self-flags this exact bug and defers the
fix to the Review stage — which is this document.

**Why it matters:** minor in isolation (a citation, not logic), but if left uncorrected an Engineer
or future contributor chasing the citation lands on the trademark audit while trying to understand
why the hero is primitive-built — confusing and easy to propagate into later docs.

**Ruling: confirmed bug. Correct citation is §C3.** Not fixed in `PHASE_1_SPEC.md` itself (out of
scope, file is frozen per pipeline rules). Carried corrected into `ENGINEER_BRIEF.md`, which cites
§C3 directly and does not repeat the error.

---

## F3 — MAJOR→RESOLVED. World-scale reconciliation (4,096 m provisional figure)

**What's wrong / what needed checking:** `RESEARCH_LA_WORLDBUILDING.md` §9.5 provisionally
recommends a **4,096 × 4,096 m (16.8 km²)** world, hard ceiling 6,144 × 6,144 m (37.8 km²), and
explicitly invites challenge ("⚠️ This section is provisional... treat the numbers as a starting
position to be challenged"). The task was to check this against `RESEARCH_FINDINGS.md` §A4
(draw-call/triangle budgets) and §A1 (streaming design).

**Analysis:**

*At the rendering-architecture level, 4,096 m is not actually inconsistent with §A1/§A4.* §A1
recommends 128–256 m chunks as industry-standard, up to 500 m for sparser worlds; 4,096 m at 256 m
chunks is a clean 16×16 = 256-chunk grid, exactly matching "standard cell size" guidance. §A4's
budgets (~100 draw calls/frame broad-compat target, ~500k triangle whole-scene ceiling) apply to
the *rendered/loaded working set*, not total authored world content — with streaming (§A1) loading
only a prefetch ring around the player, a flying hero's worst case (visibility to the haze onset of
~1,200 m per §9.5's own provisional fog numbers) implies roughly a 5×5 to 9×9 chunk window at 256 m
— on the order of 25–80 chunks in view. Hitting the draw-call ceiling across that many chunks
requires the LOD tiers (§A2: full detail 0–40 m, simplified 40–150 m, impostor 150 m+) and
aggressive InstancedMesh/BatchedMesh use (§A3) to be executed correctly, but it is *architecturally
achievable* — no numeric contradiction exists between "4,096 m world" and "under ~100 draw calls."

**The real inconsistency is not rendering budget — it's content-authoring scope (§D1), which §9.4
itself names as the actual binding constraint** ("The real constraints are (i) content authoring
cost, (ii) draw-call/overdraw budget... — not coordinate precision"). This project has locked
decision #3: hand-authored streets, no OSM import. §D1's own solo-dev research is unambiguous that
scope, not skill, is the dominant failure mode, and that this project's existing 16,507-line 2D
port is already "unambiguously large scope... even with AI-agent leverage." A 16.8 km² fully
hand-authored world — §9.5's own suggested district budget lists **eight** separate districts
(DTLA core, Historic Core/Broadway, Hollywood Blvd corridor, Koreatown, Sunset Strip, Hollywood
Hills/Observatory, LA River + Sixth Street Viaduct, Venice/beach) — is a content-authoring
commitment far beyond what six-to-eight further phases of this same pipeline can realistically
absorb, especially layered on top of quest/dialogue/companion porting for 3 levels.

§9.5's own strongest insight cuts the other way and points to the resolution: **"the Historic Core
lesson... several of LA's most iconic set-pieces are genuinely small (6 blocks, 1.3 mi, 1.6 mi).
Build those at or near 1:1 and compress only the connective tissue between districts. This is the
opposite of uniform scaling and is probably the single most important authoring decision."** That
insight argues for *fewer, denser* districts, not eight sparse ones — echoing §7's own cautionary
example, *True Crime: Streets of LA* (620 km², "buildings random except for certain landmarks" —
"the cautionary tale: largest area, thinnest content").

**Ruling: reconcile down to a 2,048 × 2,048 m (≈4.19 km²) built target for this implementation
plan (Phases 1–8), engineered so it can grow to §9.5's 4,096 m figure (or the 6,144 m hard
ceiling) later without rearchitecting.**

- 2,048 m is exactly half the linear extent (a quarter the area) of §9.5's provisional 4,096 m
  figure — roughly **25% of that provisional area**, **~35% of Spider-Man PS4's ~11.9 km²** (built
  by a full AAA studio), and comfortably fits **two** near-1:1 hero districts (e.g. a
  Historic-Core-style theatre block and a Hollywood-Blvd-style boulevard corridor) plus connective
  flight terrain — matching the Historic Core lesson rather than fighting it.
- Chunk size stays **256 m** (unchanged from §9.5/§A1 guidance) — 2,048 / 256 = 8×8 = 64 chunks for
  the built target, scaling cleanly to 16×16 = 256 chunks if the world later grows to 4,096 m.
  No re-architecture needed to grow; only more authored chunks.
- Float32 precision is a non-issue either way (§9.4's own table: ±2,048 m half-extent gives 0.12 mm
  precision at the far corner — "vastly more than adequate"), so this ruling is driven entirely by
  authoring realism, not the precision math.
- This does **not** contradict §9.5's engineering recommendations (floating origin, camera-relative
  rendering, near/far plane guidance, chunk streaming) — all of that is retained as designed, just
  applied to a smaller initial built extent with headroom to grow.

**Where this lands in the plan:** see `IMPLEMENTATION_PLAN.md` Phase 2 (world geography +
streaming) and the Open Questions section — the exact districts chosen (which two, not eight) is
flagged there as a decision the user should weigh in on, since it is partly a creative/priority
call, not purely technical.

---

## Other flags

### F4 — MAJOR. Trademark rename gates Phase 2's *completion*, not its start, and needs explicit sequencing

`RESEARCH_FINDINGS.md` §C4 is a ~900-occurrence, 11-mark mapping table explicitly marked "PENDING
USER SIGN-OFF... no agent... should rename any of these unilaterally." `PIPELINE_STATE.md` already
records this as resolved-in-scope ("rename in the 3D build only," "agents propose, user approves")
but the *mapping table itself* has not been approved yet — only the *policy* has. `PHASE_1_SPEC.md`
§10 references this as "the IP renames (Phase 2 gate — see `IMPLEMENTATION_PLAN.md`)" but until this
review, no `IMPLEMENTATION_PLAN.md` existed to define what "gate" means operationally.

**Why it matters:** without a precise statement of *what* is gated, an Engineer could plausibly
start authoring Phase 2 quest/companion content under old names "temporarily" and plan to rename
later — exactly the expensive mechanical-refactor risk `PIPELINE_STATE.md` is trying to avoid by
deferring rename cost to first-write time.

**Resolution, carried into `IMPLEMENTATION_PLAN.md`:** the gate is not "Phase 2 cannot start" — Phase
2 is world geography and streaming tech, which touches no named characters. The gate is **no
dialogue tree, quest data, or companion identity may be authored under an old/protected name from
Phase 2 onward once quest/character content authoring begins (Phase 4+)** — the mapping table must
be user-approved (or amended) before that point, so new content is written once, under final names,
never refactored.

### F5 — MINOR. `PIPELINE_STATE.md` status table is stale

The agent pipeline status table (lines 33–41) shows "LA worldbuilding — in progress" and "Research —
findings + plan — not started," but both `RESEARCH_LA_WORLDBUILDING.md` (689 lines, complete through
§9 with an explicit provisional flag) and `RESEARCH_FINDINGS.md` (921 lines, "Status: complete") are
now fully written and were read in full for this review. Not fixed here (outside this review's
deliverable list and the file isn't in the do-not-edit list, but updating a "resume checkpoint" doc
outside the assigned scope risks stepping on a field the orchestrator manages). **Recommend the
orchestrator update this table** before the next agent resumes from it, so a future session doesn't
re-run research that already exists.

### F6 — MINOR. Illustrative arithmetic in `PHASE_1_SPEC.md` §5 is off by ~7%, but harmless

`PHASE_1_SPEC.md` §5 states "`GROUND_FRICTION 0.82` → `0.82^60 ≈ 6.3e-6` per second." Recomputed
directly: `0.82^60 ≈ 6.75×10⁻⁶`, about 7% higher than the stated illustrative figure. **This does
not affect implementation** — the spec's own instruction is to "put the exponentiation in
`tuning.js` as a precomputed constant" i.e. compute `Math.pow(factor, 60)` in code, not hand-copy
the approximate prose figure. Flagged only so the Engineer doesn't second-guess a correct
`Math.pow` result against the (slightly-off) illustrative number in the spec and "fix" working code
to match a wrong comment. `ENGINEER_BRIEF.md` states the correct values and states explicitly:
compute, don't hardcode.

### F7 — MAJOR (technical correction). `FLIGHT_HOVER_DAMPING`'s per-second conversion formula is degenerate

`PHASE_1_SPEC.md` §5 gives the general per-frame→per-second conversion `perSecond = factor^60` for
all three damping constants (`FLIGHT_HOVER_DAMPING 0.18`, `GROUND_FRICTION 0.82`,
`AIR_FRICTION 0.92`), but only actually works the `0.82` example. Computed directly:

| Constant | per-frame | `factor^60` |
|---|---|---|
| `GROUND_FRICTION` | 0.82 | ≈ 6.75×10⁻⁶ |
| `AIR_FRICTION` | 0.92 | ≈ 6.74×10⁻³ |
| `FLIGHT_HOVER_DAMPING` | 0.18 | ≈ 2.1×10⁻⁴⁵ |

`0.18^60` is not a usable exponential-decay rate constant — it's so close to zero that
`v *= Math.pow(2.1e-45, dt)` collapses velocity to (effectively) zero within a single fixed step at
any `dt` above a few microseconds, i.e. the formula degenerates to a hard reset, not a smooth decay.
This isn't numerically broken (JS doubles handle 2.1e-45 fine, no NaN/Infinity risk), but it means
the general conversion formula gives no actual *tuning knob* for hover damping — feel-tuning "how
fast hover settles" via this constant would do nothing until the exponent is near 1.0, at which
point tiny changes swing between "instant" and "never." A real per-second decay rate needs a
different-shaped constant than the one carried over from the 2D per-frame value.

**Resolution, carried into `ENGINEER_BRIEF.md`:** implement hover damping as its own explicit decay
with a sane half-life (recommend ~0.05–0.08 s, tunable in lil-gui as `hoverDampingHalfLife`), applied
via `v *= 0.5 ** (dt / halfLife)`, combined with the spec's already-stated hard snap-to-zero below
0.11 m/s. Do not derive it from `0.18^60`. `GROUND_FRICTION` and `AIR_FRICTION` are fine as
specified — their `factor^60` values are well-behaved decay rates, not degenerate.

### F8 — MINOR (resolved ambiguity). Horizontal input during `takeoff` and `landing` states

`PHASE_1_SPEC.md`'s FSM description (§5, `LocomotionController.js`) fully specifies vertical motion
for `takeoff` (forced climb) and `landing` (controlled descent) but does not say whether
camera-relative WASD horizontal movement continues to apply during those two states, or is locked
out while the vertical motion is scripted. An Engineer would have to guess.

**Ruling:** horizontal WASD movement-basis logic (§5's camera-relative projection + yaw-slerp)
applies continuously across **all four** FSM states — only vertical motion (gravity, thrust,
climb/descent) is state-gated. Locking horizontal control during takeoff/landing would read as an
unresponsive "canned" animation, which cuts against the spec's own stated feel-parity goal with the
2D game's snappy flight. Stated explicitly in `ENGINEER_BRIEF.md` so this is not left to
interpretation.

### F9 — MINOR (resolved ambiguity). Ground/flight "Shift" is a cap raise, not a burst impulse

`PHASE_1_SPEC.md`'s tuning table lists `DASH_SPEED`/`FLIGHT_DASH_SPEED` as if they might be
one-shot impulses, but acceptance criteria #10 ("overlay speed *rises toward* ~13 m/s") and #17
("surges forward... without losing altitude") both describe continuous approach toward a cap, not
an instantaneous teleport. **Ruling:** Shift raises the effective speed cap that the existing
`MOVE_SPEED`/flight-thrust acceleration curve targets (`MAX_SPEED → DASH_SPEED` grounded,
`→ FLIGHT_DASH_SPEED` flying) while held; it is not a burst/impulse and needs no separate
implementation path. Stated explicitly in `ENGINEER_BRIEF.md`.

### F10 — MINOR (resolved ambiguity). Camera collision: raycast vs. spherecast

`RESEARCH_FINDINGS.md` §A9 recommends a sphere-cast over a zero-radius raycast for camera-collision
checks, specifically to account for the camera's near-plane volume and avoid corner clipping.
`PHASE_1_SPEC.md` §5 specifies a plain raycast (pivot → desired position against building AABBs),
pulled in by a fixed 0.2 m padding on hit.

**Ruling: ship the spec's raycast + 0.2 m padding as-is for Phase 1.** The padding already absorbs
most of what a spherecast buys at this small a near-plane distance (`near = 0.1`), and Phase 1's
block geometry (large flat-faced AABBs, no thin/sharp obstacles) is a low-risk case for raycast
corner-clipping. Not worth the added complexity of sphere-vs-box intersection for a vertical slice.
**If QA finds visible near-plane clipping at building corners during Phase 1 acceptance testing,
upgrade to a spherecast then** — flagged in `ENGINEER_BRIEF.md` as a named fallback, not a silent
gap.

### F11 — MINOR. Near/far plane guidance differs by phase — not a contradiction, needs stating

`PHASE_1_SPEC.md` uses `near = 0.1, far = 2000` for the 300 m block.
`RESEARCH_LA_WORLDBUILDING.md` §9.5 recommends `near = 0.5, far = 12,000` for the eventual full-scale
world, and specifically warns that `near = 0.1` paired with `far = 12,000` risks z-fighting (ratio
1.2×10⁵). These are not in conflict — Phase 1's `near 0.1 / far 2000` ratio (2×10⁴) is in the same
safe order of magnitude as §9.5's own recommended `near 0.5 / far 12,000` ratio (2.4×10⁴). But
nothing currently states that **`near` must scale up alongside `far`** as the world grows in later
phases, so a naive port that keeps `near = 0.1` while raising `far` to 12,000 in Phase 2 would hit
exactly the z-fighting risk §9.5 warns about. Stated explicitly as a phase-transition rule in
`IMPLEMENTATION_PLAN.md`'s Phase 2 section.

### F12 — MINOR. Acceptance criteria did not exist for any phase beyond Phase 1

Not a defect in the source documents (no `IMPLEMENTATION_PLAN.md` existed before this review to
hold them) — noted here only so it's traceable as a gap this review closes, not missed. See
`IMPLEMENTATION_PLAN.md` for per-phase acceptance criteria QA can verify directly, in the same style
as `PHASE_1_SPEC.md` §9.

---

## Flags requiring further research, not just a judgment call

### NEEDS RESEARCH — R1. LA visibility/haze parameters (§9.5's fog numbers are guesses)

`RESEARCH_LA_WORLDBUILDING.md` §9.5 states plainly: "haze onset ~1,200 m, saturating ~6,000 m. These
two numbers are guesses." §8(a) documents that a primary source (LaDochy & Fuentes, visibility
trends in the LA Basin) is already downloaded and cached at a known path but was never extracted
due to a binary-parsing failure, with a documented fix (`pypdf`, already installed) that the
research agent flagged as one extraction away from closing this gap.
**Precise question:** what is the average/range visual range (miles or km) in the LA Basin under
typical and hazy conditions, and does the source give a number translatable into Three.js `Fog`
near/far distances for a ~2,048–4,096 m world? This should be resolved before Phase 2's `Sky.js`
upgrade (day/night + fog) is implemented, not before Phase 1 (Phase 1's fog is a fixed, small-scale
placeholder already fully specified).

### NEEDS RESEARCH — R2. DTLA and suburban block dimensions (§8(b))

Only tertiary blog-sourced figures exist ("~300–350 ft") plus an unconfirmed lead (Ord survey varas
giving 336 ft / 600 ft blocks) and an unexamined primary source (LAMC §17.05 subdivision design
standards, likely to state the suburban block-length figure directly).
**Precise question:** what is the authoritative LA city block dimension, separately for the
Ord-grid core (DTLA) and the cardinal-PLSS suburban grid, per a primary source (Ord survey record or
LAMC §17.05)? This affects Phase 2's chunk-to-block ratio (§9.5's own chunk-size reasoning
explicitly says "revisit once (b) is closed") and should be resolved before Phase 2's district
geometry is authored in detail — not before Phase 1.

### NEEDS RESEARCH — R3. Trademark rename per-occurrence classification (§C4's counts are sampled)

`RESEARCH_FINDINGS.md` §C4 states its player-visible-string / code-identifier / comment breakdown is
"a representative sample, not an exhaustive line-by-line audit." The aggregate totals (900+
occurrences, ~11 marks) are reliable; the per-category cost split is not.
**Precise question:** for each of the ~900 occurrences, is it a player-visible string, a code
identifier (touches logic/state-matching), or a comment? This is not needed before Phase 2 starts
(Phase 2 touches no named content) but should be done as a dedicated pass — by the Engineer or
Review agent working directly in the rename branch, per `RESEARCH_FINDINGS.md`'s own suggestion —
before Phase 4 (Level 1 dialogue/quest port, the first phase that actually rewrites old-named
content) is scoped in file-level detail.

---

## Summary table

| ID | Severity | Topic | Status |
|---|---|---|---|
| F1 | BLOCKER→RESOLVED | Renderer conflict | Ruling: WebGL for the whole plan |
| F2 | MAJOR→RESOLVED | Hero.js citation bug | Ruling: §C4 → §C3 |
| F3 | MAJOR→RESOLVED | World-scale reconciliation | Ruling: 2,048×2,048 m built target, engineered to grow to 4,096/6,144 m |
| F4 | MAJOR→RESOLVED | Trademark rename gate sequencing | Ruling: gates content-authoring (Phase 4+), not Phase 2's start |
| F5 | MINOR | Stale pipeline status table | Flagged for orchestrator, not fixed here |
| F6 | MINOR | Illustrative arithmetic ~7% off | Harmless; compute don't hardcode |
| F7 | MAJOR→RESOLVED | Degenerate hover-damping formula | Ruling: explicit half-life decay instead |
| F8 | MINOR→RESOLVED | Horizontal input during takeoff/landing | Ruling: always active |
| F9 | MINOR→RESOLVED | Shift is a cap raise, not a burst | Ruling: confirmed, stated explicitly |
| F10 | MINOR→RESOLVED | Camera collision raycast vs spherecast | Ruling: raycast ships, spherecast is a named fallback |
| F11 | MINOR | Near/far plane must scale together | Stated as a phase-2 rule |
| F12 | MINOR | No acceptance criteria existed for Phases 2–8 | Closed by `IMPLEMENTATION_PLAN.md` |
| R1 | NEEDS RESEARCH | LA haze/visibility numbers | Before Phase 2 `Sky.js` upgrade |
| R2 | NEEDS RESEARCH | LA block dimensions | Before Phase 2 district geometry |
| R3 | NEEDS RESEARCH | Trademark occurrence classification | Before Phase 4 file-level scoping |

**Total: 12 flags (3 BLOCKER-designated-and-resolved, 4 MAJOR-resolved, 5 MINOR) + 3 NEEDS RESEARCH
items, none of which block Phase 1.**

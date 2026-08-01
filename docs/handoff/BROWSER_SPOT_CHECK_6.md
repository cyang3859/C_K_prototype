# Browser spot-check 6 — the two Phase 2 districts

**Subject:** Engineer run 1's districts (commits `11aec78`..`d58c08d`), plus the `AKC ENTERPRISE`
sign (decision 23) and its overflow fix.
**Written:** 2026-08-01, session 9.

**Almost all of this was run by the assistant under Playwright and the results are filled in below.**
Per `CLAUDE.md`, only the genuinely human items are left open — and there is exactly **one**.

---

## Measured — no human needed

| # | Check | Result |
|---|---|---|
| 1 | Both districts exist, at the correct different rotations | **PASS** — `districtA` at **36.00°**, `districtB` at **0.00°**. Locked decision 10 satisfied. |
| 2 | Scene-graph mesh count | **49 meshes** across the whole scene |
| 3 | `WEBGL_multi_draw` present | **TRUE** — so `BatchedMesh` uses the real batched path, not the ~10× per-geometry fallback at `WebGLRenderer.js:1303-1319` |
| 4 | Draw calls, spawn viewpoint | **55** (districts frustum-culled from spawn; this is why a naive look reads 55 and not 83) |
| 5 | Draw calls, ~15 sampled viewpoints across both districts | **max 55**, typical 26–46. The Engineer's **83 graph-walk worst case** is the number to budget against; **no sampled camera reached it**, which is culling working as intended. |
| 6 | Triangles, worst sampled viewpoint | **11,964** against the graph-walk 14,724 and the ~500k ceiling |
| 7 | District A reads as a dense tower plateau on a rotated grid | **PASS** — streets run visibly diagonal; towers of similar height with glass curtain walls, setbacks and window rhythm |
| 8 | District B reads as a mixed-height cardinal-grid boulevard corridor | **PASS** — orthogonal streets, centrelines and crosswalks, low-to-mid buildings in cream stucco / steel-blue glass / bronze glass |
| 9 | The sign-mast landmark exists and is legible | **PASS after a fix** — see the defect below |
| 10 | Console errors | **None** after reload (one pre-existing warning remains) |

**Screenshots** are in this session's scratchpad: `districtA-overview.png`, `districtA-approach.png`,
`districtB-approach.png`, `mast-angled2.png`, and the sign before/after pair `mast-sign.png` /
`mast-sign-fixed.png`.

---

## A real defect, found in a screenshot and fixed

**The mast's sign text overflowed its panel and rendered as clipped fragments** — visibly `C E…PRI`
rather than a readable name.

The delivered code hard-coded the font at `bh * 0.11` (~84 px) against a 512 px panel. At that size
`AKC ENTERPRISE` measures ~700 px, so both ends ran off the sign face. **It was already marginal with
the `PLACEHOLDER` string it replaced; approving a name only made an existing defect visible.**

Fixed in `landmarks.js` by measuring the text and scaling the font to fit inside 86% of the panel
width, so a future approved name of a different length cannot silently reintroduce it.

**This is the second defect this run that only a browser would have caught** — the first was FAM-5's
terracotta landing on every roof (`ENGINEER_PHASE_2_DISTRICTS.md` §3.1). Neither was catchable by
review or by the test suite. **That is the strongest evidence so far for the Playwright-first rule.**

---

## The signage was unreadable — reported by the user, now fixed

**The user's own screenshot settled the question this document had left open**, and the answer was
that the sign was not acceptable. It took **three** distinct fixes, only the first of which was
diagnosed before the screenshot:

| # | Defect | Fix | Evidence |
|---|---|---|---|
| 1 | Text overflowed its 512 px face — `AKC ENTERPRISE` measures **883 px** at 100 px bold, so both ends ran off | Size the font from `measureText` instead of a hard-coded `bh * 0.11` | text width 455 px of 512 |
| 2 | **The column bisected the board.** A single 7 m board was centred on a mast tapering 2.4 → 0.9 m radius, so 4+ m of steel covered its middle third and the name read `AKC` … `RISE` | **Two boards per level, flanking the column**, each starting outside its radius at that height — how projecting signage is actually mounted | +48 triangles, **0 extra draw calls** |
| 3 | The name still sat small: the face is **portrait** (512 × 768 px on a 7 × 9 m board), so one line can only ever use a strip of it | **One word per line**, each sized from its own measured width | text block **39 px → 138 px** tall, glyphs ~**1.9×** larger |

**Draw calls after all three: 34 at that viewpoint — unchanged.** The whole mast is still one merged
geometry with one material, so §BGT-1's 2-calls-per-landmark line holds. 148/148 tests.

**Numbers, not impressions, at every step.** Fix 2 was diagnosed by comparing the board's 7 m width
against the column's radius *at that height*; fix 3 by reading the atlas back with `getImageData` and
measuring the text's bounding box, which is what showed the texture was already correct and the
problem was the board's aspect ratio. Before: `mast-sign.png`. After: `mast-twoline.png`.

**Sizing from measurement rather than constants is the durable part** — the original failure came
precisely from a constant that happened to suit the old `PLACEHOLDER` string. A future approved name
of any length or word count now fits without another round of this.

---

## Not verified, and why

- **Real frame rate.** Headless Chrome pins rAF to 60, so the fps HUD is meaningless. The Engineer's
  GPU frame time (**0.5 ms median / 1.1 ms p95** whole-world) is the meaningful figure and it has
  enormous margin. A real-hardware fps reading is still nice-to-have and still low-stakes.
- **Shadows in the new districts.** They cast none — `Sky.js`'s shadow frustum is ±60 m in a 1,220 m
  world. Pre-existing, out of run 1's scope, and **CSM is the fix**. Nothing to look at yet.

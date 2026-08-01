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

## ⚠️ THE ONE THING THAT NEEDS A HUMAN

**Does the sign read acceptably with the mast pole running in front of it?**

The mast's structural pole passes directly over the centre of the sign face, so head-on the name
reads as `AKC` … `RISE` with the middle occluded. From an angle the sign is legible and the mast
reads well as a landmark silhouette.

This is a **taste call, not a defect**, and it is deliberately not being decided by an agent:

- **Real sign masts genuinely do have structure in front of the panels**, so this may simply read as
  authentic — and the mast's job per `DEN-6` is to be a *silhouette* visible across the world, not a
  legible nameplate.
- The alternative is to offset the sign panels clear of the pole, or widen them, which is a small
  change to `landmarks.js` and costs no draw calls.

**Look at `mast-sign-fixed.png` (head-on) and `mast-angled2.png` (angled) and say which you prefer.**
Nothing is blocked on the answer — run 2 can proceed either way.

---

## Not verified, and why

- **Real frame rate.** Headless Chrome pins rAF to 60, so the fps HUD is meaningless. The Engineer's
  GPU frame time (**0.5 ms median / 1.1 ms p95** whole-world) is the meaningful figure and it has
  enormous margin. A real-hardware fps reading is still nice-to-have and still low-stakes.
- **Shadows in the new districts.** They cast none — `Sky.js`'s shadow frustum is ±60 m in a 1,220 m
  world. Pre-existing, out of run 1's scope, and **CSM is the fix**. Nothing to look at yet.

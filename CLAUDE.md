# Project instructions

## Browser testing: drive it yourself first

**Use the Playwright MCP connector for any browser test you need to run.** Do not hand the user
a checklist for things you could have checked yourself. The old assumption that agents in this
pipeline have no browser is out of date — headless WebGL works, the scene renders, and most of
what used to be "the human is the only instrument" is now directly measurable.

What this means in practice for `kodaman3d`:

- Start the dev server (`cd kodaman3d && npm run dev`, port 5173), navigate, and drive the scene
  through `window.__game` — it exposes `scene`, `renderer`, `hero`, `cameraRig`, `world`, `sky`.
- Set hero pose via `hero.state.position` / `hero.state.facing`, **not** `hero.group.position`
  — the group is overwritten from state every frame. Camera via `cameraRig.yaw` / `.pitch`;
  allow ~1.2 s for the rig to settle before capturing.
- Tuning values are live on the shared `TUNING` object, reachable as `cameraRig.tuning`.
  Writing to it takes effect on the next frame.
- Prefer **numbers over impressions**. `renderer.renderer.info` gives draw calls, triangles,
  programs, textures. `gl.readPixels` over fixed screen regions gives mean luminance, which
  turns "the towers look dark" into a defensible before/after table. A/B a single variable by
  toggling it between two `render()` calls in one evaluate.
- Clean up: move screenshots to the scratchpad, delete `.playwright-mcp/`, stop the dev server.
  Leave the repo clean.

**Ask the user for a human eye only for what genuinely needs one**, and say specifically what
and why. Known cases: real frame rate (headless Chrome pins rAF to 60, so the fps HUD is
meaningless — report GPU frame time instead), GPU-driver-specific rendering, and final calls on
whether something *looks* right. When you do ask, keep using the
`docs/handoff/BROWSER_SPOT_CHECK_*.md` format — but fill in every result you were able to
measure yourself first, so the user is only left with the genuinely human part.

If a check turns out to be measurable after all, record the number rather than asking.

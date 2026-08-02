# Code review — STANDARDS axis

Scope: `git diff main...HEAD` restricted to code (`kodaman3d/src`, `kodaman3d/tests`,
`vite.config.js`, `package.json`, `scripts`) — 9,066 lines / 27 files. Markdown planning
docs not reviewed.

Standards sources treated as binding: `CLAUDE.md`, `kodaman3d/README.md`,
`docs/handoff/KNOWLEDGE_BASE.md` §9 + module wireframe, and the idiom of `core/` and
`controllers/`. Fowler smell baseline applied as judgement calls only.

Legend: **[HARD]** = breach of a documented repo standard. **[JUDGEMENT]** = baseline smell
or idiom drift.

---

## 1. [HARD] Terrain height fields are registered but never disposed — the disposal discipline has a hole

`kodaman3d/src/world/Collision.js:538` registers a height field:

```js
addTerrain(heightAt) {
  this._terrain.push(heightAt);
  return heightAt;
}
```

There is **no `removeTerrain`**, and `clearBuildings()` (`Collision.js:513-518`) resets
`buildings`, `_owners`, `_solid` and `boxes` but leaves `this._terrain` untouched.
`removeOwner()` (`:494`) likewise only walks the three building arrays.

`Terrain.dispose()` (`terrain.js:290-295`) therefore cannot undo its own registration:

```js
dispose() {
  disposeObject3D(this.mesh);
  this.mesh.material.dispose();
  this.scene.remove(this.mesh);
  this.collision.removeOwner(this);   // drops the camera boxes; the height field survives
}
```

The standard breached, `kodaman3d/README.md`:
> **Dispose what you allocate.** … every module that allocates exposes a `dispose()`.

and `src/core/dispose.js:25-29`:
> CONVENTION FOR EVERY MODULE THAT ALLOCATES GPU RESOURCES: … dispose anything it created
> that this utility cannot reach by traversal.

The height field is not a GPU resource, but it is exactly the class of allocation the
convention exists for: something the traversal cannot reach, registered into a longer-lived
object. `Game.destroy()` (`core/Game.js:264-271`) is the HMR teardown hook, and if the
`CollisionWorld` ever outlives a `Terrain` — which is the whole reason `removeOwner` was
introduced over `clearBuildings` (see `Collision.js:467-472`) — each save appends another
closure to `_terrain`, and `groundHeightAt` (`:550`) pays a growing linear scan for every
capsule resolve, forever.

Note the asymmetry is self-documented as an intentional owner model everywhere else:
`District.dispose()`, `WorldProps.dispose()` and `Terrain.dispose()` all call
`removeOwner(this)`. Terrain is the one allocation that has no owner-scoped removal path.

**Fix:** give `addTerrain` an owner argument, keep a parallel `_terrainOwners`, and clear it
in both `removeOwner` and `clearBuildings`.

---

## 2. [HARD] `terrain.js`'s file header states the opposite of what `terrain.js` does

Two sections of the *same file*, both added by this diff, contradict each other, and the
header is the stale one.

`terrain.js:38-60` (header):
> `Collision.js` models the ground as an implicit flat plane at y = 0 **with no height query
> anywhere** … Grading the districts needs a terrain height lookup in the locomotion resolve
> path, which is a `Collision.js` change and is **not this run's**.
>
> THE COLLIDER IS A STEPPED APPROXIMATION … **Walking UP the hill is not possible** (there is
> no step-up logic) … Real terrain collision is a follow-on.

`terrain.js:256-279` (constructor comment), 200 lines later:
> **THE HILL IS REAL TERRAIN NOW, NOT A STACK OF BOXES.** … `CollisionWorld.addTerrain` takes
> the height field directly, so the ground under the hero simply *is* the surface.

And the code at `terrain.js:281` does `collision.addTerrain(...)`; `Collision.js:175`
implements the step-up. **The code wins** — the header is a leftover from the pre-`addTerrain`
build and is now actively misleading: it tells the next reader that the height query does not
exist and that grading the districts is blocked on work that has in fact already shipped.

`KNOWLEDGE_BASE.md` §9 is explicit that this is the failure mode to avoid:
> Never quietly change a number and leave readers unable to tell which figure an older
> document meant… kept and **labelled as history** rather than deleted.

The header should be rewritten or labelled as history, not left asserting a live constraint
that no longer holds.

---

## 3. [HARD] `dealBands` asserts its key invariant in a comment instead of in code — and the assertion is false in general

`kodaman3d/src/world/districts.js:351-361`:

```js
function dealBands(total, counts) {
  const pool = [];
  for (const [name, n] of counts) for (let i = 0; i < n; i++) pool.push(name);
  if (pool.length !== total) {
    throw new Error(`dealBands: ${pool.length} labels for ${total} slots`);
  }
  const stride = total % 2 === 0 ? total / 2 + 1 : 3;
  const out = new Array(total);
  for (let i = 0; i < total; i++) out[(i * stride) % total] = pool[i];
  return out;
}
```

The doc comment claims:
> The stride is coprime with `total`, so the walk visits every slot exactly once and
> neighbouring slots get different bands.

That is true for the two totals this file actually passes (32 → stride 17, 36 → stride 19,
both coprime) and **false for many others**:

| `total` | `stride` | `gcd` | result |
|---:|---:|---:|---|
| 32 | 17 | 1 | ok (District A) |
| 36 | 19 | 1 | ok (District B) |
| 10 | 6 | 2 | 5 slots `undefined`, 5 labels dropped |
| 30 | 16 | 2 | half the array `undefined` |
| 33 | 3 | 3 | two-thirds `undefined` |

When it fails it fails **silently**: `out` keeps `undefined` holes, the count check has
already passed, and every consumer reads `bands[i]` and falls through to the final `else`
branch. No throw, no test failure at the seam.

This breaches `KNOWLEDGE_BASE.md` §9:
> **Enforce decisions in code, not in prose.** Locked decision 22 is a byte-equality test, not
> a promise.

The same function already demonstrates the right pattern one line earlier — the count
invariant *is* a `throw`. The coprimality invariant is the one that got prose. It also
undercuts this file's own stated purpose (`districts.js:12-13`, "so a third district is data
rather than a rewrite"): a third district with 30 slots gets a silently corrupt band deal.

**Fix:** either compute a stride that is provably coprime (search upward from `total/2` for
the first `gcd(stride, total) === 1`), or add a `gcd` assertion next to the existing throw.

---

## 4. [JUDGEMENT] Possible Duplicated Code / Repeated Switches — `districtABuildings` and `districtBBuildings`

`districts.js:126-194` and `districts.js:208-272` are the same 60-line shape twice: same
`slotCentres()` → `dealBands()` → `for` loop → per-band `if (band === …) { out.push({...}); continue; }`
cascade → fall-through default. The pushed literal carries the identical ten fields
(`band, lx, lz, w, d, h, recipe, family, podiumFamily, seed`) at **six** sites — a Data Clump
the file names as a type (`@typedef DistrictBuilding`, `:564`) but never constructs through
one place.

A band-keyed spec table (`{primary: {w:[18,24], d:[24,30], h:[70,110], recipe, family}, …}`)
plus one shared builder would collapse both functions and make a third district genuinely
"data rather than a rewrite", which is what `districts.js:12-13` says the file is for.

**Repo override to weigh:** the file's header explicitly frames this as *authored data*, and
authored data legitimately resists being folded into a generator — the per-band comments
(`:174-178`, `:263-264`) carry design rationale that a table would have to re-home. This is a
judgement call, not a defect. The `seed` and `hash01` salts differ between the two
(`i * 2654435761 + n` vs `i * 40503 + n * 7919`) for good reason, and any extraction must keep
them distinct.

---

## 5. [JUDGEMENT] Possible Primitive Obsession — `CENTRAL_SLOTS` is a set of stringified floats

`districts.js:104-106`:

```js
const CENTRAL_SLOTS = new Set(['-17.38,-17.38', '17.38,-17.38', '-17.38,17.38', '17.38,17.38']);
const key = (s) => `${round2(s.lx)},${round2(s.lz)}`;
```

`17.38` is `SLOT_OFFSET`, which is *computed* at `:74` as `(CELL_PITCH - ROW) / 4` and happens
to round to 17.38. The literal strings hard-code the result of that arithmetic, so changing
`CELL_PITCH` or `ROW` silently de-selects the four central slots. It does at least fail loudly
(`dealBands` then throws `32 labels for 36 slots`), which is why this is a judgement call and
not a hard finding — but the fix is one line: build the set from `SLOT_OFFSET` rather than
from typed decimals.

---

## 6. [HARD] `vite.config.js` — the comment says "fail loudly", the setting does the opposite

`kodaman3d/vite.config.js:7-11`:

```js
server: {
  // Fail loudly instead of silently hopping ports, so a stale dev server is obvious.
  strictPort: false,
  open: false,
},
```

`strictPort: false` **is** the silently-hop-ports behaviour, and it is also Vite's default —
so the line is a no-op that documents the reverse of what it does. The intent stated in the
comment requires `strictPort: true`.

This matters against a documented standard rather than being a style nit. `CLAUDE.md`:
> Start the dev server (`cd kodaman3d && npm run dev`, **port 5173**), navigate, and drive the
> scene through `window.__game`

Every browser-verification instruction in this repo hard-codes 5173. With `strictPort: false`,
a leftover dev server means the new one comes up on 5174 and an agent following `CLAUDE.md`
drives **the stale build** while believing it is testing the new one — silently, with no error.
That is exactly the failure the comment was written to prevent.

**Fix:** `strictPort: true`, or change the comment to match. The comment is the correct
intent; the code is wrong.

Same file, `:18-21`, has a smaller instance of the finding-2 pattern:
> `environment: 'node'` is deliberate: **the two modules under test** (Collision.js,
> LocomotionController.js) are pure logic…

The diff ships four test files covering `districts.js`, `props.js`, `annex.js`, `massing.js`,
`facadeFamilies.js` and `terrain.js` as well. The setting is still right; the count is stale.

---

## 7. [JUDGEMENT] Possible Speculative Generality — `surfaceIndex` is computed, documented at length, and never read

`Collision.js:131-133, 144, 191-201` computes and returns `surfaceIndex`, with a dedicated
`bestIndex` tracking variable and two lines of JSDoc. Grepping the whole tree:

```
src/world/Collision.js       (definition + docs)
tests/collision.test.js:77   expect(r.surfaceIndex).toBe(0);
src/controllers/LocomotionController.js:183  this.lastContact = { …, surfaceIndex: -1 };
```

`LocomotionController` only ever *writes* the initial `-1`; nothing in `src/` reads the field.

It also carries a live trap worth flagging while it is still unused. The doc says
"`surfaceIndex` is the index in `boxes`", and `CollisionWorld.resolve` (`:566-573`) passes
`this.boxes` — which is `[...boundaries, ...solid buildings]`. A caller who has only
`world.buildings` (the array with the boundary walls absent and the non-solid terrain terraces
*present*) and indexes it with `surfaceIndex` gets a different box entirely. Since the
`_solid` split landed in this same diff, the two arrays now diverge in both directions.

Either delete it, or rename to something that cannot be mistaken for a `buildings` index.

---

## 8. [JUDGEMENT] Possible Duplicated Code — three verbatim facade-offset blocks in `props.js`

`props.js:519-541` (bollards), `:542-562` (cafeProps) and `:563-595` (scaffolding) each open
with the same six lines, differing only in one offset constant (`1.6`, `2.4`, `0.9`):

```js
const f = frontage(b);
const half = (f.axis === 'z' ? b.d : b.w) / 2;
const p = { lx: b.lx, lz: b.lz };
if (f.axis === 'z') {
  p.lz += f.sign * (half + 1.6);
  p.lx += t;
} else {
  p.lx += f.sign * (half + 1.6);
  p.lz += t;
}
```

The `f.axis === 'z' ? … : …` ternary appears **nine** times in the file (`:353`, `:355-356`,
`:360-361`, `:377-383`, `:525-526`, `:530-535`, `:547`, `:551-556`, `:571-572`, `:577-582`) —
a Repeated Switch on the same `axis` discriminator. One helper, e.g.
`offsetFromFacade(b, f, { out, along })`, retires all of it.

Related, in the same file: `annexPropPlacements()` (`:138-139`) calls `hvacUnits(buildings)`
twice and discards one result's identity —

```js
hvac: hvacUnits(buildings).map((u) => ({ ...u, yaw: 0 })),
hvacColliders: hvacUnits(buildings).map((u) => hvacBox(u)),
```

— so the colliders are boxes around a *second, separately generated* unit list. It is
deterministic today, so they coincide; the coupling is nonetheless implicit and one line of
`const units = hvacUnits(buildings)` removes it.

---

## 9. [JUDGEMENT] Possible Speculative Generality — `frontage()` returns a `depth` nobody reads and its JSDoc does not declare

`props.js:281-299`. The JSDoc:

```js
 * @returns {{axis:'x'|'z', sign:number, yaw:number, width:number}}
```

Both return statements ship a fifth field:

```js
return { axis: 'z', sign, yaw: sign > 0 ? 0 : Math.PI, width: b.w, depth: b.d };
…
return { axis: 'x', sign, yaw: sign > 0 ? Math.PI / 2 : -Math.PI / 2, width: b.d, depth: b.w };
```

`grep -rn '\.depth\b' src/ tests/` returns nothing. Dead field, and the JSDoc and the code
disagree about the function's own shape.

---

## 10. [JUDGEMENT] Possible Duplicated Code — the instance-matrix fill repeats in all 15 `_build*` methods of `WorldProps.js`

`WorldProps.js` (839 lines, the largest new file) has fifteen `_buildX(list)` methods and every
one ends with the same block, e.g. `:435-444` and `:474-485`:

```js
const m = new THREE.Object3D();
for (let i = 0; i < lamps.length; i++) {
  const l = lamps[i];
  m.position.set(l.x, 0, l.z);
  m.rotation.set(0, l.yaw, 0);
  m.scale.set(1, 1, 1);
  m.updateMatrix();
  mesh.setMatrixAt(i, m.matrix);
}
mesh.instanceMatrix.needsUpdate = true;
```

The class already found the right seam once — `_pool()` (`:730`) extracts the
allocate-material-register-dispose shape. The matrix fill is the second half of that same
shape and is not extracted; a `_fill(mesh, list, (m, item) => …)` would remove ~120 lines and,
more usefully, make `instanceMatrix.needsUpdate = true` structurally impossible to forget.

Also **Divergent Change** in the Fowler sense: this one file is edited for fifteen unrelated
reasons (add a prop, change a prop's silhouette, retune a colour). That is a design
observation rather than a defect — the pools genuinely must be built somewhere — but it is the
file most likely to want splitting when a sixteenth prop lands.

---

## 11. [JUDGEMENT] Idiom drift — `Terrain.dispose()` does not match the shape the other three world modules share

`District.dispose()` (`District.js:502-510`), `WorldProps.dispose()` (`WorldProps.js:743-754`)
and `Sky.dispose()` all follow one order: `disposeObject3D(root)` → drain `_disposables` →
`scene.remove(root)` → `removeOwner(this)`. `Terrain.dispose()` (`terrain.js:290-295`) has no
`_disposables` list and instead does:

```js
disposeObject3D(this.mesh);
this.mesh.material.dispose();   // redundant, and weaker than what already ran
```

`disposeObject3D` has already traversed the mesh and called `disposeMaterial` on that same
material (`dispose.js:58-63`), which disposes the material **and every texture it references**.
The extra bare `material.dispose()` adds nothing (Three's `dispose()` is idempotent) and, by
looking like the disposal step, invites a future reader to add textures to this material and
assume they are covered. `Terrain.js:280` also re-assigns `this.collision = collision`, which
the constructor already did at `:210`.

None of this leaks today. It matters because `dispose.js:25-29` states the convention
explicitly and three of four world modules follow it exactly; the fourth should read the same.

---

## 12. [JUDGEMENT] Minor — a closure allocated per fixed step in the collision hot path

`Collision.js:566-573`:

```js
resolve(position, radius, height, options) {
  return resolveCapsule(position, radius, height, this.boxes, {
    groundHeightAt: this._terrain.length ? (x, z) => this.groundHeightAt(x, z) : undefined,
    ...options,
  });
}
```

The comment above it says "Only pay for the lookup when terrain actually exists", but the
arrow wrapper is allocated on **every** call — i.e. every fixed step, for the hero and for
anything else that resolves. `this.groundHeightAt.bind(this)` cached once in the constructor,
or a pre-bound field, keeps the stated intent without the per-step allocation. Trivial in
absolute terms; noted only because this is the one function on the per-step path.

---

## What I checked and found clean

- **`Collision.js` parallel-array alignment** — the stated top risk. `addBuilding` (`:480`)
  pushes to all three; `removeOwner` (`:494`) rebuilds all three in one pass; `clearBuildings`
  (`:513`) truncates all three; `_rebuildBoxes` (`:521`) reads `_solid` index-for-index. I
  could not construct a desync. The only duplication is `clearBuildings` inlining
  `this.boxes = [...this.boundaries]` instead of calling `_rebuildBoxes()`, which is correct
  either way.
- **Locked decision 22 / byte-identical facades** — `facadeFamilies.js:34` and its siblings
  spread from `FACADE_VARIANTS` rather than re-typing, exactly as `KNOWLEDGE_BASE.md` §9's
  "enforce decisions in code, not in prose" requires, and `tests/districts.test.js` asserts it.
  This is the standard being met, not breached.
- **Dependency pinning** — `package.json` pins all five deps exactly, matching the README's
  version table (`three` 0.185.1, `vite` 7.3.6, `vitest` 4.1.10, `lil-gui` 0.21.0,
  `stats.js` 0.17.0). No `^`, no `~`.
- **`TUNING` read at call time** — README warns that destructuring `TUNING` into module scope
  silently breaks live tuning. No `const { … } = TUNING` appears anywhere in `src/`.
- **`Collision.js` scene-graph purity** — the file's own header forbids Mesh/Object3D/raycaster
  access; it imports only `Box3`/`Vector3` as math types, and `environment: 'node'` tests drive
  it directly. Held.
- **Owner-scoped teardown** — `District`, `WorldProps` and `Terrain` all pass `this` to
  `addBuilding` and call `removeOwner(this)`; no module calls `clearBuildings()`.

## Not reported, per brief

Formatting, import order and semicolons (tooling's job); the absence of a
`CONTRIBUTING.md`/ESLint/Prettier/`.editorconfig` (process, not a defect in this diff); the
~20,000 lines of Markdown in `docs/handoff/`.

One documentation note, offered rather than filed as a finding: `kodaman3d/README.md:88-92`
still describes `world/StreetBlock.js` as the project structure, and `KNOWLEDGE_BASE.md`'s
wireframe still lists it at 1,288 lines. That file no longer exists in this branch —
`districts.js` / `District.js` / `annex.js` replaced it under locked decision 24. The code
wins; the README's structure block is stale.

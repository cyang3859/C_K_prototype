import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import {
  BAND_ROUGH,
  atlasBoxUVs,
  fillAll,
  fillRect,
  grey,
  hash01,
  hex6,
  makeContext,
  paintFacadeRegion,
} from './facadeAtlas.js';
import { FACADE_FAMILIES } from './facadeFamilies.js';
import { massingBoxes } from './massing.js';

/**
 * landmarks.js — the two district landmarks (§DA-4, §DB-4).
 *
 * EACH IS ONE STANDALONE `Mesh`, AND THAT IS NOT AN IMPLEMENTATION CHOICE.
 * `BatchedMesh` in the installed three@0.185.1 takes a single material for the
 * whole batch and has no per-instance override (Review `RVW-7`, re-verified
 * against `node_modules/three/src/objects/BatchedMesh.js:192/632/1390`), so a
 * building with a bespoke atlas cannot join its family's batch. §BGT-1's 4-call
 * "district landmarks" line is therefore load-bearing: 1 main + 1 shadow each.
 *
 * Each landmark's several parts are merged into ONE `BufferGeometry` with ONE
 * material, so "its own mesh" really does mean 2 calls and not 2 per part.
 *
 * NAMING AND SIGNAGE TEXT ARE NOT THIS CODE'S TO INVENT (locked decision 6,
 * restated in decision 20 for the mast specifically). The mast's sign text was
 * supplied and approved by the user on 2026-08-01 and is locked as decision 23;
 * it is the only name anywhere in `kodaman3d/`. Everything else in this project
 * is still generic on purpose, pending the trademark naming table.
 */

/** Atlas edge, px. Same size as Phase 1's bespoke tower atlas. */
const ATLAS = 1024;

/**
 * The mast's sign text. USER-APPROVED, locked decision 23 — see the module note.
 *
 * Exported so a test can pin it: the point is not that this particular string is
 * correct, but that a name here can only ever arrive by user sign-off. A future
 * edit that quietly swaps it should fail a test, not pass review.
 */
export const MAST_SIGN_TEXT = 'AKC ENTERPRISE';

/**
 * Atlas regions, in `BoxGeometry`'s face order and the same [uMin, uMax, vMin,
 * vMax] form Phase 1's `TOWER_ATLAS` uses.
 *
 *   A — u 0…0.5,  v 0…0.75   the shaft's curtain wall
 *   B — u 0.5…1,  v 0…0.75   the crown's fin treatment
 *   C — u 0…1,    v 0.75…1   roof and every horizontal face
 */
const REGION_A = [0.0, 0.5, 0.0, 0.75];
const REGION_B = [0.5, 1.0, 0.0, 0.75];
const REGION_C = [0.0, 1.0, 0.75, 1.0];

/** +X, -X, +Y, -Y, +Z, -Z */
const SHAFT_FACES = [REGION_A, REGION_A, REGION_C, REGION_C, REGION_A, REGION_A];
const CROWN_FACES = [REGION_B, REGION_B, REGION_C, REGION_C, REGION_B, REGION_B];

/**
 * Build a district landmark.
 *
 * @param {object} spec the district's `landmark` record
 * @param {(canvas: object, opts: {repeat: boolean, srgb: boolean}) => THREE.Texture} register
 * @returns {{mesh: THREE.Mesh, triangles: number, colliderBoxes: (district: object) => THREE.Box3[]}}
 */
export function buildLandmark(spec, register) {
  return spec.kind === 'mast' ? buildSignMast(spec, register) : buildLandmarkTower(spec, register);
}

/**
 * §DA-4 + locked decision 19 — District A's 150 m tower with a SCULPTED,
 * NON-FLAT CROWN.
 *
 * Every other District A roof stays flat per §3.3's helipad ordinance; this one
 * building is the deliberate exception, and its job is to be a navigation
 * beacon. The user weighed that against "every roof is a legible helipad with no
 * exceptions" and accepted the cost as **one un-landable roof out of ~33** — so
 * this atlas paints a service deck on the roof region rather than the helipad
 * ring Phase 1's `building_tower_2` carries. Painting a helipad the crown stands
 * on would be worse than painting none.
 *
 * The shaft wears FAM-3, the district's lightest and glossiest family, so the
 * landmark reads as visually distinct from altitude and not merely taller.
 */
function buildLandmarkTower(spec, register) {
  const boxes = massingBoxes(spec.recipe, spec);
  const parts = [];

  for (let i = 0; i < boxes.length; i++) {
    const box = boxes[i];
    const geo = new THREE.BoxGeometry(box.w, box.h, box.d);
    // Boxes 0–1 are podium and shaft; 2–4 are the two crown steps and the spire.
    atlasBoxUVs(geo, i < 2 ? SHAFT_FACES : CROWN_FACES);
    geo.translate(box.cx, box.cy, box.cz);
    parts.push(geo);
  }

  const merged = mergeGeometries(parts);
  for (const p of parts) p.dispose();

  const material = paintTowerAtlas(spec, boxes, register);
  const mesh = new THREE.Mesh(merged, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.position.set(spec.lx, 0, spec.lz);

  return {
    mesh,
    triangles: merged.index.count / 3,
    colliderBoxes: (district) => [
      // The podium footprint carried the full height: the crown is inset, so a
      // single box over the widest part is conservative in the safe direction.
      worldBox(spec.lx, spec.lz, spec.w, spec.d, spec.h, district),
    ],
  };
}

/**
 * The landmark's bespoke atlas: shaft curtain wall, crown fins, service roof.
 */
function paintTowerAtlas(spec, boxes, register) {
  const S = ATLAS;
  const diffuse = makeContext(S, S);
  const rough = makeContext(S, S);
  const metal = makeContext(S, S);
  const ctxs = { diffuse, rough, metal };
  const facade = FACADE_FAMILIES.fam3LightSilverGlass;

  fillAll(diffuse, `#${hex6(facade.wall)}`, S, S);
  fillAll(rough, grey(facade.wallRough), S, S);
  fillAll(metal, grey(facade.wallMetal), S, S);

  // Region geometry in canvas pixels. Same flipY convention as Phase 1's atlas:
  // canvasY = (1 − v) × SIZE, so v ∈ [0, 0.75] is the canvas's LOWER 768 rows.
  const facadeTop = S * 0.25;
  const facadeH = S * 0.75;
  const halfW = S * 0.5;

  // Region A — the shaft. Real floors over the real height the region covers,
  // so floor lines land at plausible storey heights rather than an arbitrary
  // tiling. The region represents the podium + shaft, i.e. everything below the
  // crown.
  const shaftTop = boxes[1].cy + boxes[1].h / 2;
  const floors = Math.max(1, Math.round(shaftTop / 3.9));
  paintFacadeRegion(ctxs, facade, {
    x: 0,
    y: facadeTop,
    w: halfW,
    h: facadeH,
    columns: Math.max(2, Math.round(spec.w / 3.2)),
    floors,
    metresW: spec.w,
    metresH: shaftTop,
  });

  // Region B — the crown. Deliberately NOT a window grid: tall vertical fins
  // with a few structural bands, which is what makes the crown read as a
  // different piece of architecture rather than more of the same tower. It is
  // also what a sculpted post-2014 crown actually looks like from a distance —
  // structure, not glazing.
  paintCrownRegion(ctxs, facade, { x: halfW, y: facadeTop, w: halfW, h: facadeH });

  // Region C — every horizontal face, including the shaft's real roof around the
  // crown's base. A service deck, NOT a helipad: see the function header.
  paintServiceRoof(ctxs, { x: 0, y: 0, w: S, h: facadeTop });

  return new THREE.MeshStandardMaterial({
    map: register(diffuse.canvas, { repeat: false, srgb: true }),
    roughnessMap: register(rough.canvas, { repeat: false, srgb: false }),
    metalnessMap: register(metal.canvas, { repeat: false, srgb: false }),
    roughness: 1,
    metalness: 1,
  });
}

/** Vertical fins plus structural bands — the crown's own treatment. */
function paintCrownRegion(ctxs, facade, r) {
  const { diffuse, rough, metal } = ctxs;
  fillRect(diffuse, `#${hex6(facade.band)}`, r.x, r.y, r.w, r.h);
  fillRect(rough, grey(0.35), r.x, r.y, r.w, r.h);
  fillRect(metal, grey(0.55), r.x, r.y, r.w, r.h);

  const fins = 14;
  const finW = r.w / fins;
  for (let i = 0; i < fins; i++) {
    // Alternate lit and shaded fin faces so the crown reads as ribbed rather
    // than striped — the same trick the window bevel uses one scale down.
    const lit = i % 2 === 0;
    fillRect(
      diffuse,
      `#${hex6(lit ? facade.wall : facade.window)}`,
      r.x + i * finW,
      r.y,
      finW * 0.62,
      r.h,
    );
  }

  // Four structural bands across the fins.
  for (let b = 1; b <= 4; b++) {
    const y = r.y + (r.h * b) / 5;
    fillRect(diffuse, `#${hex6(facade.band)}`, r.x, y, r.w, r.h * 0.03);
    fillRect(rough, grey(BAND_ROUGH), r.x, y, r.w, r.h * 0.03);
  }
}

/**
 * The roof region: tar, gravel and service-deck markings.
 *
 * NO HELIPAD, and that is decision 19's direct consequence rather than an
 * oversight — the crown stands on this surface, so a landing marking here would
 * be a marking under a building.
 */
function paintServiceRoof(ctxs, r) {
  const { diffuse, rough, metal } = ctxs;
  fillRect(diffuse, `#${hex6(0x3d3a36)}`, r.x, r.y, r.w, r.h);
  fillRect(rough, grey(0.95), r.x, r.y, r.w, r.h);
  fillRect(metal, grey(0.0), r.x, r.y, r.w, r.h);

  for (let i = 0; i < 500; i++) {
    const light = hash01(i * 668265263 + 13) < 0.5;
    fillRect(
      diffuse,
      `#${hex6(light ? 0x55504a : 0x2c2925)}`,
      r.x + hash01(i * 2246822519) * r.w,
      r.y + hash01(i * 3266489917 + 7) * r.h,
      6,
      3,
    );
  }

  // A painted service walkway around the deck edge. Legible from the air as
  // "a working roof", which is the read §3.3's flat-roof convention wants,
  // without promising a landing pad the crown occupies.
  const inset = r.h * 0.12;
  const stroke = Math.max(2, r.h * 0.02);
  fillRect(diffuse, '#c9c2a8', r.x + inset, r.y + inset, r.w - inset * 2, stroke);
  fillRect(diffuse, '#c9c2a8', r.x + inset, r.y + r.h - inset - stroke, r.w - inset * 2, stroke);
  fillRect(diffuse, '#c9c2a8', r.x + inset, r.y + inset, stroke, r.h - inset * 2);
  fillRect(diffuse, '#c9c2a8', r.x + r.w - inset - stroke, r.y + inset, stroke, r.h - inset * 2);
}

/**
 * §DB-4 + locked decision 20 — District B's 75 m sign / observation mast.
 *
 * NOT A BUILDING, on purpose. `RESEARCH_LA_WORLDBUILDING.md` §5.9 documents that
 * on a real boulevard corridor "signage structures up to 90 ft are the dominant
 * vertical elements, not the buildings" — so a mast is the authentic answer here
 * rather than a game-design compromise, and it also gives District B a silhouette
 * class District A's tower plateau has nothing like. 75 m dominates District B's
 * own 8–46 m skyline by a wide margin without approaching District A's towers,
 * which is what keeps the two districts distinct at a glance.
 *
 * NO EMISSIVE, following Phase 1's blade-sign rule exactly: the lighting is
 * static midday and a sign glowing at noon reads as a bug, not as a light.
 */
function buildSignMast(spec, register) {
  const h = spec.h;
  const parts = [];

  // The mast: a tapered octagonal prism. 8 radial segments is the whole point —
  // it reads as a fabricated steel column rather than a smooth pipe, and it is
  // 32 triangles.
  const mast = new THREE.CylinderGeometry(0.9, 2.4, h, 8, 1);
  mast.translate(0, h / 2, 0);
  remapUVs(mast, REGION_A);
  parts.push(mast);

  // Observation collar, roughly two thirds up.
  const pod = new THREE.CylinderGeometry(3.6, 3.6, 4.5, 8, 1);
  pod.translate(0, h * 0.66, 0);
  remapUVs(pod, REGION_A);
  parts.push(pod);

  // Four sign levels climbing the mast, alternating which pair of faces they
  // present, so the mast reads from all four approaches down the boulevard.
  //
  // EACH LEVEL IS TWO BOARDS FLANKING THE COLUMN, NOT ONE BOARD THROUGH IT.
  //
  // The delivered version centred a single 7 m board on the mast axis. But the
  // column is tapered from r = 2.4 m to r = 0.9 m, so down at the sign levels it
  // is over 4 m across — it covered the middle ~60% of the board and bisected the
  // name, which read as "AKC" ... "RISE" with the middle swallowed. Scaling the
  // text to fit the panel (see `paintMastAtlas`) fixed the text overflowing its
  // panel, but could not fix the panel being occluded by the thing it is mounted
  // on. Reported from a screenshot by the user.
  //
  // So each board now starts OUTSIDE the column's radius at its own height and
  // projects clear of it, the way real projecting/blade signage is actually
  // mounted. Two per level, on opposite sides, so no approach ever sees only the
  // back of a board.
  //
  // Cost: 8 boxes instead of 4, +48 triangles, and ZERO extra draw calls — the
  // whole mast is merged into one geometry with one material, which is what makes
  // §BGT-1's 2-calls-per-landmark line hold.
  const signH = 9;
  const boardW = 7;
  const boardT = 0.4;
  for (let i = 0; i < 4; i++) {
    const y = h * 0.2 + i * (signH + 2.5);
    // The column's radius at this height, so the gap is right at every level
    // rather than tuned for one of them.
    const radiusHere = 2.4 + (0.9 - 2.4) * (y / h);
    const offset = radiusHere + 0.2 + boardW / 2;
    for (const side of [1, -1]) {
      const panel = new THREE.BoxGeometry(boardT, signH, boardW);
      atlasBoxUVs(panel, [REGION_B, REGION_B, REGION_C, REGION_C, REGION_B, REGION_B]);
      panel.translate(0, 0, side * offset);
      if (i % 2 === 1) panel.rotateY(Math.PI / 2);
      panel.translate(0, y, 0);
      parts.push(panel);
    }
  }

  const merged = mergeGeometries(parts);
  for (const p of parts) p.dispose();

  const mesh = new THREE.Mesh(merged, paintMastAtlas(register));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.position.set(spec.lx, 0, spec.lz);

  return {
    mesh,
    triangles: merged.index.count / 3,
    // A 5 m box around the base. The mast stands on a sidewalk corner, so the
    // hero can walk right up to it; without a collider they would walk through
    // it, which is exactly the game-world tell landmarks exist to avoid.
    colliderBoxes: (district) => [worldBox(spec.lx, spec.lz, 5, 5, h, district)],
  };
}

/**
 * The mast's atlas: brushed steel for the structure, a sign face for the panels.
 *
 * THE SIGN READS "AKC ENTERPRISE" — approved by the user 2026-08-01, locked as
 * decision 23. Locked decision 6 reserves all naming to the user, so this is the
 * only authority under which a name may appear here. It replaced the literal
 * string "PLACEHOLDER", which was deliberately implausible so that an unapproved
 * name could never ship by looking reasonable. Do not change it, and do not add
 * further names anywhere without the same sign-off.
 */
function paintMastAtlas(register) {
  const S = ATLAS;
  const diffuse = makeContext(S, S);
  const rough = makeContext(S, S);
  const metal = makeContext(S, S);

  fillAll(diffuse, `#${hex6(0x6d7178)}`, S, S);
  fillAll(rough, grey(0.42), S, S);
  fillAll(metal, grey(0.72), S, S);

  // Region A — the structure. Horizontal ribs so the taper reads as fabricated
  // sections rather than one extruded shape.
  const ribs = 26;
  for (let i = 0; i < ribs; i++) {
    const y = (i / ribs) * S * 0.75 + S * 0.25;
    fillRect(diffuse, `#${hex6(0x54585f)}`, 0, y, S * 0.5, 3);
    fillRect(rough, grey(0.62), 0, y, S * 0.5, 3);
  }

  // Region B — the sign face.
  const bx = S * 0.5;
  const by = S * 0.25;
  const bw = S * 0.5;
  const bh = S * 0.75;
  fillRect(diffuse, `#${hex6(0xd8d2c4)}`, bx, by, bw, bh);
  fillRect(rough, grey(0.6), bx, by, bw, bh);
  fillRect(metal, grey(0.05), bx, by, bw, bh);
  // Border.
  fillRect(diffuse, `#${hex6(0x8c2f2a)}`, bx, by, bw, 18);
  fillRect(diffuse, `#${hex6(0x8c2f2a)}`, bx, by + bh - 18, bw, 18);

  // FIT THE TEXT TO THE PANEL, rather than trusting a fixed font size.
  //
  // The delivered code hard-coded `bh * 0.11` (~84 px), which silently overflows
  // the 512 px panel: at that size "AKC ENTERPRISE" is ~700 px wide, so the sign
  // rendered as clipped fragments ("C E...PRI") with the ends running off the
  // face. It was already marginal with the "PLACEHOLDER" string it replaced —
  // the name change only made an existing defect visible.
  //
  // Caught in a screenshot, not in review or by a test, which is the second time
  // this run that only a browser would have found it (see the FAM-5 terracotta
  // note in ENGINEER_PHASE_2_DISTRICTS.md §3.1).
  //
  // Measuring instead of guessing also means a future approved name of a
  // different length cannot silently reintroduce this.
  // SET THE NAME ON ONE LINE PER WORD, EACH SIZED TO FILL THE BOARD'S WIDTH.
  //
  // Three things had to be got right here and only the first was obvious.
  //
  // 1. The original hard-coded `bh * 0.11` (~84 px) overflowed the 512 px face —
  //    "AKC ENTERPRISE" measures ~883 px at 100 px bold, so both ends ran off and
  //    the sign rendered as clipped fragments.
  // 2. Shrinking to fit fixed the overflow but left the name small: the sign face
  //    is PORTRAIT (512 x 768 px, on a 7 m x 9 m board) and a single line of text
  //    can only ever use one strip of it, however well fitted.
  // 3. So the name is set one word per line. Each line is then sized from its own
  //    measured width, which fills the board in both directions and makes the
  //    glyphs several times larger than a single fitted line could be.
  //
  // Sizing from `measureText` rather than from a fraction of the atlas means a
  // future approved name of any length or word count still fits — the failure in
  // (1) came precisely from a constant that happened to suit the old string.
  const inset = bw * 0.9; // margin so the text never touches the border
  const lines = MAST_SIGN_TEXT.trim().split(/\s+/);
  const probePx = 100;
  const lineGap = 1.18; // baseline-to-baseline, as a multiple of font size
  // Each line fills the width; the whole block is then capped so it cannot grow
  // past the face's height when the name is short (one big word) or tall (many).
  const byWidth = lines.map((w) => {
    diffuse.font = `bold ${probePx}px sans-serif`;
    const m = diffuse.measureText(w).width || inset;
    return probePx * (inset / m);
  });
  const maxByHeight = (bh * 0.72) / (lines.length * lineGap);
  const fontPx = Math.max(8, Math.floor(Math.min(...byWidth, maxByHeight)));

  diffuse.fillStyle = `#${hex6(0x2a2723)}`;
  diffuse.font = `bold ${fontPx}px sans-serif`;
  diffuse.textAlign = 'center';
  diffuse.textBaseline = 'middle';
  const step = fontPx * lineGap;
  const startY = by + bh / 2 - ((lines.length - 1) * step) / 2;
  lines.forEach((line, i) => {
    diffuse.fillText(line, bx + bw / 2, startY + i * step);
  });

  // Region C — the panels' thin top and bottom edges.
  fillRect(diffuse, `#${hex6(0x54585f)}`, 0, 0, S, S * 0.25);
  fillRect(rough, grey(0.5), 0, 0, S, S * 0.25);

  return new THREE.MeshStandardMaterial({
    map: register(diffuse.canvas, { repeat: false, srgb: true }),
    roughnessMap: register(rough.canvas, { repeat: false, srgb: false }),
    metalnessMap: register(metal.canvas, { repeat: false, srgb: false }),
    roughness: 1,
    metalness: 1,
  });
}

/**
 * Remap a whole geometry's 0…1 UVs into one atlas region. Used for the
 * cylinders, whose faces are not the six a `BoxGeometry` has.
 *
 * @param {THREE.BufferGeometry} geo
 * @param {readonly [number, number, number, number]} region
 */
function remapUVs(geo, [uMin, uMax, vMin, vMax]) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uMin + uv.getX(i) * (uMax - uMin), vMin + uv.getY(i) * (vMax - vMin));
  }
  uv.needsUpdate = true;
}

/**
 * A world-space AABB for a landmark footprint, inflated for the district's grid
 * rotation exactly the way `districts.buildingWorldBox` does. Duplicated as a
 * local helper rather than imported to keep `districts.js` free of any
 * dependency on this module (it would be a cycle).
 */
function worldBox(lx, lz, w, d, h, district) {
  const c = Math.abs(Math.cos(district.rotation));
  const s = Math.abs(Math.sin(district.rotation));
  const halfW = (w * c + d * s) / 2;
  const halfD = (w * s + d * c) / 2;
  const cos = Math.cos(district.rotation);
  const sin = Math.sin(district.rotation);
  const x = district.origin.x + lx * cos + lz * sin;
  const z = district.origin.z - lx * sin + lz * cos;
  return new THREE.Box3(
    new THREE.Vector3(x - halfW, 0, z - halfD),
    new THREE.Vector3(x + halfW, h, z + halfD),
  );
}

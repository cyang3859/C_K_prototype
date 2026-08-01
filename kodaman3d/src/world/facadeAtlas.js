import * as THREE from 'three';

/**
 * facadeAtlas.js — the shared procedural-facade painting kit.
 *
 * WHY THIS MODULE EXISTS. Every one of these functions was private to
 * `StreetBlock.js` and worked correctly there for one hand-authored block. Phase
 * 2's districts (`districts.js` / `District.js`) need the *same* atlas machinery
 * for seven new facade families, and the choice was between duplicating ~200
 * lines of canvas painting or lifting it into one place. It was lifted.
 *
 * NOTHING HERE CHANGED BEHAVIOUR IN THE MOVE. The window-cell bevel order, the
 * flipY/canvas-y direction convention, the plinth-band placement, the spandrel
 * `floor % 4` branch and the roof region's aspect compensation are byte-for-byte
 * what shipped in Phase 1 — the Phase 1 canvas-call assertions in
 * `tests/world.test.js` are what pin that down, and they are unmodified.
 *
 * THE ONE CONVENTION TO READ BEFORE TOUCHING ANY OF THIS:
 *   `CanvasTexture` defaults to `flipY = true`, so UV v = 0 samples the canvas's
 *   BOTTOM row and v = 1 its TOP row. `BoxGeometry`'s four side faces put v = 1
 *   at the box's top. Therefore SMALL canvas y is HIGH on the building and LARGE
 *   canvas y is low on it. The plinth band lives at the bottom of the canvas
 *   because it must sit at the bottom of each tile.
 */

/** Metres of facade per texture tile. Drives the window grid density. */
export const FACADE_TILE_M = 4;

/**
 * The frame/mullion around each window pane, in the roughness+metalness maps.
 * Anodised aluminium: smoother than stucco, rougher and less reflective than
 * the glass it holds. Diffuse-side the frame is drawn as a light/dark bevel
 * instead (see `paintWindowCell`).
 */
export const FRAME_ROUGH = 0.55;
export const FRAME_METAL = 0.3;

/**
 * Roof/spandrel band PBR. This band is ALSO the pixel the flat-roof UVs of a
 * repeat-tiled building collapse onto (see `scaleBoxUVs`), so its roughness and
 * metalness are authored for a ROOF, not for a facade detail: built-up roofing
 * and rooftop gravel are matte and non-metallic.
 */
export const BAND_ROUGH = 0.92;
export const BAND_METAL = 0.05;

/**
 * Paint one repeat-tiled facade family onto three fresh canvases and return a
 * `MeshStandardMaterial` built from them.
 *
 * WHY THREE CANVASES AND `roughness: 1.0 / metalness: 1.0`. Three.js multiplies
 * `material.roughness × roughnessMap.g` and `material.metalness ×
 * metalnessMap.b` — roughnessMap reads the GREEN channel, metalnessMap reads
 * BLUE (the glTF ORM convention, so one packed texture can serve both). These
 * are separate neutral-grey canvases here, so every channel carries the same
 * value and which one is sampled is moot — but do NOT assume `.g` for metalness
 * if these are ever packed into one texture. Setting the scalars to 1.0 lets the
 * maps carry 100% of the per-pixel value.
 *
 * @param {FacadeSpec} spec
 * @param {(canvas: object, opts: {repeat: boolean, srgb: boolean}) => THREE.Texture} register
 *   the caller's texture factory — it owns disposal, this module does not.
 * @param {number} [size] canvas edge, px
 * @returns {THREE.MeshStandardMaterial}
 */
export function makeFacadeMaterial(spec, register, size = 512) {
  const diffuse = makeContext(size, size);
  const rough = makeContext(size, size);
  const metal = makeContext(size, size);

  fillAll(diffuse, `#${hex6(spec.wall)}`, size, size);
  fillAll(rough, grey(spec.wallRough), size, size);
  fillAll(metal, grey(spec.wallMetal), size, size);

  const bandH = Math.floor(size * 0.12);
  const bandY = size - bandH;
  const usableH = size - bandH;

  const rows = spec.columns;
  const cellW = size / spec.columns;
  const cellH = usableH / rows;
  const winW = cellW * 0.62;
  const winH = cellH * 0.55;
  // Frame width scales with resolution so the bevel keeps its proportions if
  // `size` ever changes. U and V pixel density are equal on a repeat tile (both
  // axes span FACADE_TILE_M), so one width serves both directions.
  const frame = Math.max(1, Math.round(size / 128));

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < spec.columns; c++) {
      const x = c * cellW + (cellW - winW) / 2;
      const y = r * cellH + (cellH - winH) / 2;
      // Deterministic per-window brightness: a hash of the cell coordinates,
      // never Math.random(), so the texture is identical on every load and a
      // screenshot diff stays meaningful.
      const t = ((r * 73856093) ^ (c * 19349663)) >>> 0;
      const jitter = 0.65 + ((t % 100) / 100) * 0.7;
      paintWindowCell({ diffuse, rough, metal }, x, y, winW, winH, spec, jitter, frame, frame);
    }
  }

  // Solid plinth band across the bottom of the tile. It reads as a floor-slab
  // edge when the texture tiles up a facade, AND it is where the roof faces' UVs
  // are pointed (see `scaleBoxUVs`) so rooftops get flat neutral roofing instead
  // of a nonsensical grid of windows — without needing a second material and the
  // extra draw call per building that would cost.
  fillRect(diffuse, `#${hex6(spec.band)}`, 0, bandY, size, bandH);
  fillRect(rough, grey(BAND_ROUGH), 0, bandY, size, bandH);
  fillRect(metal, grey(BAND_METAL), 0, bandY, size, bandH);

  /**
   * OPTIONAL STRING COURSE, AND WHY IT IS NOT JUST A RETINTED `band`.
   *
   * The design spec's FAM-5 asks for a terracotta re-tint of `band` to carry the
   * Broadway Theater District cornice reference. Taken literally that is wrong,
   * and the screenshot proves it: `band` is not only the spandrel colour, it is
   * ALSO the single pixel `scaleBoxUVs` collapses every flat roof onto. Retinting
   * it painted every ochre building in District B with a bright terracotta ROOF.
   *
   * So the cornice is its own thin course drawn directly above the plinth band
   * instead. It repeats with the tile, i.e. every FACADE_TILE_M metres up the
   * facade, which is what a string course actually does on an ornate storefront —
   * and the roof stays the neutral the band was always authored to be. Same zero
   * draw calls, same one hex constant, and it does not require touching a shipped
   * value.
   */
  if (spec.cornice !== undefined) {
    const courseH = Math.max(1, Math.round(size * 0.03));
    fillRect(diffuse, `#${hex6(spec.cornice)}`, 0, bandY - courseH, size, courseH);
    fillRect(rough, grey(0.8), 0, bandY - courseH, size, courseH);
    fillRect(metal, grey(BAND_METAL), 0, bandY - courseH, size, courseH);
  }

  return new THREE.MeshStandardMaterial({
    map: register(diffuse.canvas, { repeat: true, srgb: true }),
    roughnessMap: register(rough.canvas, { repeat: true, srgb: false }),
    metalnessMap: register(metal.canvas, { repeat: true, srgb: false }),
    roughness: 1,
    metalness: 1,
  });
}

/**
 * Paint one facade region of a bespoke (non-repeating) atlas: a real floor × bay
 * window grid plus structural spandrel bands.
 *
 * @param {AtlasContexts} ctxs
 * @param {FacadeSpec} spec
 * @param {{x:number,y:number,w:number,h:number,columns:number,floors:number,metresW:number,metresH:number}} r
 */
export function paintFacadeRegion(ctxs, spec, r) {
  const cellW = r.w / r.columns;
  const rowH = r.h / r.floors;
  const winW = cellW * 0.66;
  const winH = rowH * 0.58;

  // ASPECT COMPENSATION, horizontal vs vertical. This region's pixels are not
  // square in world space, so a bevel measured in pixels would come out several
  // times thicker on one axis than the other. Express it in metres and convert
  // per axis.
  const pxPerM_U = r.w / r.metresW;
  const pxPerM_V = r.h / r.metresH;
  const BEVEL_M = 0.1;
  const frameU = Math.max(1, Math.round(BEVEL_M * pxPerM_U));
  const frameV = Math.max(1, Math.round(BEVEL_M * pxPerM_V));

  for (let floor = 0; floor < r.floors; floor++) {
    // Floor 0 is the GROUND floor. Canvas y grows downward while the building
    // grows upward (flipY, see the module header), so floor 0 is the region's
    // BOTTOM row.
    const rowY = r.y + r.h - (floor + 1) * rowH;

    // Structural spandrel band every 4th floor. Without it, a tall stack of
    // identical floor rows reads as an undifferentiated grid.
    if (floor > 0 && floor % 4 === 0) {
      fillRect(ctxs.diffuse, `#${hex6(spec.band)}`, r.x, rowY, r.w, rowH);
      fillRect(ctxs.rough, grey(BAND_ROUGH), r.x, rowY, r.w, rowH);
      fillRect(ctxs.metal, grey(BAND_METAL), r.x, rowY, r.w, rowH);
      continue;
    }

    for (let c = 0; c < r.columns; c++) {
      const x = r.x + c * cellW + (cellW - winW) / 2;
      const y = rowY + (rowH - winH) / 2;
      const t = ((floor * 73856093) ^ (c * 19349663)) >>> 0;
      const jitter = 0.65 + ((t % 100) / 100) * 0.7;
      paintWindowCell(ctxs, x, y, winW, winH, spec, jitter, frameU, frameV);
    }
  }
}

/**
 * Paint one window pane into the diffuse, roughness and metalness canvases at
 * once.
 *
 * The diffuse bevel is what turns a flat rectangle into something that reads as
 * inset glazing. Draw order is base, top, left, bottom, right, so corners
 * resolve to whichever of highlight/shadow was drawn last and the bottom-right
 * corner comes out as shadow — correct for an overhead sun.
 *
 * DIRECTION, stated explicitly: canvas y = 0 is the TOP of the canvas, and with
 * flipY the top of the canvas is HIGH on the building. So the strip at the
 * smallest y really is the geometric top of the pane, and really is the
 * highlight.
 *
 * @param {AtlasContexts} ctxs
 * @param {number} x @param {number} y @param {number} w @param {number} h
 * @param {{window:number,winRough:number,winMetal:number}} spec
 * @param {number} jitter per-pane brightness multiplier
 * @param {number} frameU frame thickness on the horizontal axis, px
 * @param {number} frameV frame thickness on the vertical axis, px
 */
export function paintWindowCell(ctxs, x, y, w, h, spec, jitter, frameU, frameV) {
  const { diffuse, rough, metal } = ctxs;

  const glass = shade(spec.window, jitter);
  const hi = shade(spec.window, Math.min(1.8, jitter * 1.6));
  const lo = shade(spec.window, jitter * 0.45);

  fillRect(diffuse, glass, x, y, w, h);
  fillRect(diffuse, hi, x, y, w, frameV); // top edge: light catches the frame
  fillRect(diffuse, hi, x, y, frameU, h); // left edge
  fillRect(diffuse, lo, x, y + h - frameV, w, frameV); // bottom: lintel shadow
  fillRect(diffuse, lo, x + w - frameU, y, frameU, h); // right edge

  // PBR side: the pane is glass, the frame around it is anodised aluminium.
  fillRect(rough, grey(spec.winRough), x, y, w, h);
  fillRect(metal, grey(spec.winMetal), x, y, w, h);
  for (const [ctx, value] of [
    [rough, FRAME_ROUGH],
    [metal, FRAME_METAL],
  ]) {
    const style = grey(value);
    fillRect(ctx, style, x, y, w, frameV);
    fillRect(ctx, style, x, y, frameU, h);
    fillRect(ctx, style, x, y + h - frameV, w, frameV);
    fillRect(ctx, style, x + w - frameU, y, frameU, h);
  }
}

/**
 * Scale a BoxGeometry's per-face UVs so the texture tiles at a constant
 * real-world size regardless of the box's dimensions, and point the roof/floor
 * faces at the texture's plain plinth band.
 *
 * BoxGeometry emits six 4-vertex faces in a fixed order — +X, -X, +Y, -Y, +Z,
 * -Z — each with UVs spanning 0..1. For the four side faces we multiply those
 * UVs by (faceWidth/tile, faceHeight/tile) so a taller building simply gets more
 * window rows instead of stretched ones. The two horizontal faces are collapsed
 * onto a single point inside the plain band, which gives flat rooftops without
 * needing a second material (and therefore without the extra draw call per
 * building that a material array would cost).
 *
 * THE SAMPLE POINT IS v = 0.06, AND THAT IS THE BOTTOM OF THE TILE. With
 * CanvasTexture's default flipY = true, v = 0 samples the canvas's BOTTOM row —
 * which is where `makeFacadeMaterial` paints the roof/spandrel band. Do not
 * "fix" this to 0.94 without moving the band too.
 *
 * @param {THREE.BufferGeometry} geo
 * @param {number} w size on X
 * @param {number} h size on Y
 * @param {number} d size on Z
 * @param {number} tile metres per texture tile
 */
export function scaleBoxUVs(geo, w, h, d, tile) {
  const uv = geo.attributes.uv;
  // [uScale, vScale] per face, in BoxGeometry's face order.
  const faces = [
    [d / tile, h / tile], // +X
    [d / tile, h / tile], // -X
    null, // +Y (roof)
    null, // -Y (underside)
    [w / tile, h / tile], // +Z
    [w / tile, h / tile], // -Z
  ];

  for (let face = 0; face < 6; face++) {
    const scale = faces[face];
    for (let v = 0; v < 4; v++) {
      const i = face * 4 + v;
      if (!scale) {
        // Plain plinth band: the bottom 12% of the tile, sampled well inside it.
        uv.setXY(i, 0.5, 0.06);
      } else {
        uv.setXY(i, uv.getX(i) * scale[0], uv.getY(i) * scale[1]);
      }
    }
  }
  uv.needsUpdate = true;
}

/**
 * Remap a BoxGeometry's per-face UVs into sub-rectangles of a single
 * non-repeating atlas — the alternative to `scaleBoxUVs` for a building whose
 * roof carries unique art.
 *
 * Every face gets the SAME linear remap with no per-face flip:
 *   newU = uMin + u × (uMax − uMin),  newV = vMin + v × (vMax − vMin)
 * That uniformity is what makes the floor lines meet at the corners. It is safe
 * because BoxGeometry gives all four side faces the same vertical convention:
 * `buildPlane` is called with vdir = -1 and v bound to the world Y axis for
 * +X, -X, +Z and -Z alike, putting UV v = 1 at the box's TOP and v = 0 at its
 * BASE on every one of them.
 *
 * @param {THREE.BufferGeometry} geo
 * @param {ReadonlyArray<readonly [number, number, number, number]>} regions
 *   Six [uMin, uMax, vMin, vMax] entries, in BoxGeometry's face order.
 */
export function atlasBoxUVs(geo, regions) {
  const uv = geo.attributes.uv;

  for (let face = 0; face < 6; face++) {
    const [uMin, uMax, vMin, vMax] = regions[face];
    const uSpan = uMax - uMin;
    const vSpan = vMax - vMin;
    for (let v = 0; v < 4; v++) {
      const i = face * 4 + v;
      uv.setXY(i, uMin + uv.getX(i) * uSpan, vMin + uv.getY(i) * vSpan);
    }
  }
  uv.needsUpdate = true;
}

// --------------------------------------------------------------- canvas util

/**
 * Allocate a 2D canvas context.
 * @param {number} w @param {number} h
 * @returns {CanvasRenderingContext2D}
 */
export function makeContext(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return canvas.getContext('2d');
}

/** @param {CanvasRenderingContext2D} ctx @param {string} style */
export function fillAll(ctx, style, w, h) {
  fillRect(ctx, style, 0, 0, w, h);
}

/** @param {CanvasRenderingContext2D} ctx @param {string} style */
export function fillRect(ctx, style, x, y, w, h) {
  ctx.fillStyle = style;
  ctx.fillRect(x, y, w, h);
}

/** Six-digit zero-padded hex, for a CSS colour string. @param {number} n */
export function hex6(n) {
  return n.toString(16).padStart(6, '0');
}

/**
 * A neutral grey CSS colour carrying a LINEAR 0..1 material value.
 *
 * Roughness and metalness maps are data, not colour: the renderer reads the byte
 * straight through (their textures are tagged NoColorSpace), so 0.5 must be
 * written as byte 128 and not as an sRGB-encoded mid grey.
 *
 * @param {number} v
 */
export function grey(v) {
  const c = Math.round(Math.max(0, Math.min(1, v)) * 255);
  return `rgb(${c},${c},${c})`;
}

/**
 * Deterministic hash → [0, 1). Used instead of Math.random() so the world is
 * byte-identical on every load; a world that reshuffles itself between reloads
 * makes visual regressions impossible to spot.
 * @param {number} n
 */
export function hash01(n) {
  let x = (n ^ 0x9e3779b9) >>> 0;
  x = Math.imul(x ^ (x >>> 15), 0x85ebca6b) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0;
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

/**
 * Multiply a hex colour's channels by `k`, clamped, returned as a CSS string.
 * @param {number} hex @param {number} k
 */
export function shade(hex, k) {
  const r = Math.min(255, Math.round(((hex >> 16) & 0xff) * k));
  const g = Math.min(255, Math.round(((hex >> 8) & 0xff) * k));
  const b = Math.min(255, Math.round((hex & 0xff) * k));
  return `rgb(${r},${g},${b})`;
}

/**
 * @typedef {{wall:number, window:number, band:number, columns:number,
 *   wallRough:number, wallMetal:number, winRough:number, winMetal:number}} FacadeSpec
 * @typedef {{diffuse:CanvasRenderingContext2D, rough:CanvasRenderingContext2D,
 *   metal:CanvasRenderingContext2D}} AtlasContexts
 */

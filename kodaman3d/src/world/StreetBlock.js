import * as THREE from 'three';

import { disposeObject3D } from '../core/dispose.js';

/**
 * StreetBlock.js — the one hand-authored street block.
 *
 * DATA-DRIVEN ON PURPOSE. All authored content lives in the exported `BLOCK`
 * object below, and the builder functions consume it generically. Phase 2 turns
 * that pattern into per-district data files; keeping the separation now means
 * Phase 2 adds data, not a rewrite.
 *
 * SCOPE: ONE BLOCK, FULLY RESIDENT, ALWAYS. No streaming, no LOD tiers, no
 * ChunkManager, no District abstraction (all Phase 2). If this file grows a
 * load/unload concept, Phase 1 scope has been breached.
 *
 * STREET DIMENSIONS ARE REAL, NOT INVENTED (brief §9.1).
 * The boulevard is built to the City of Los Angeles Standard Plan S-470-1
 * "Avenue I" class (Secondary Highway) — the actual classification of Hollywood
 * Blvd, Sunset Blvd and Wilshire Blvd west of Beverly Hills, which makes it the
 * correct template for an iconic LA boulevard:
 *
 *     right-of-way (property line to property line)   100 ft  = 30.48 m
 *     roadway (curb to curb)                           70 ft  = 21.34 m
 *     sidewalk, each side (includes the parkway)       15 ft  =  4.57 m
 *                                                     21.34 + 4.57×2 = 30.48 ✓
 *
 * Travel lanes are laid out at 4 lanes within the 21.34 m roadway. The LA
 * Street Design Manual's standard lane is 11 ft (3.35 m); the remaining width
 * goes to a centre turn lane, which is both visually truthful for a boulevard
 * of this class and gives the centreline something to be.
 *
 * EXTENT DISCIPLINE: nothing authored here may exceed ±150 m on X or Z.
 *
 * NO NAMED PLACES. Buildings are generic `lowrise` / `midrise` / `tower`. No
 * proper nouns for locations, businesses or characters, and no invented
 * placeholder names either — that exercise is blocked pending sign-off on a
 * separate trademark mapping table.
 */

/** Metres. Right-of-way, roadway and sidewalk widths, per S-470-1. */
export const STREET = Object.freeze({
  RIGHT_OF_WAY: 30.48,
  ROADWAY: 21.34,
  SIDEWALK: 4.57,
  /** Half the roadway: the curb line sits at ±this on Z. */
  HALF_ROADWAY: 21.34 / 2, // 10.67
  /** Standard LA travel lane, 11 ft. */
  LANE: 3.35,
  /** Curb height above the roadway surface. */
  CURB_HEIGHT: 0.15,
  /** Where palms are planted: the parkway strip inside the sidewalk, nearest the curb. */
  PARKWAY_Z: 12.1,
  /** Street lamps sit further back on the sidewalk than the palms. */
  LAMP_Z: 14.2,

  /**
   * VISUAL CURB RELIEF — deliberately a few centimetres, not the real 15 cm.
   *
   * Phase 1's collision model is an implicit FLAT ground plane at y = 0 plus
   * building AABBs, and the capsule controller has no step-up logic (adding one
   * is not in the brief's scope and would mean reworking the tested vertical
   * resolution). A truthful 15 cm curb would therefore be a lie the collision
   * cannot back up: either the hero's feet sink 15 cm into every sidewalk, or —
   * if the slabs were made colliders — the horizontal push-out would treat every
   * curb as a wall and the hero could never step onto a sidewalk at all.
   *
   * Keeping the whole walkable surface within a few centimetres of y = 0 means
   * the geometry matches the physics exactly. The curb still reads as a curb
   * because it is a distinct lighter strip with a visible edge, just a shallow
   * one. FOR PHASE 2: once the controller gains step-up/ramp handling, restore
   * these to the real 0.15 m and make the slabs colliders.
   */
  SIDEWALK_RELIEF: 0.03,
  CURB_RELIEF: 0.07,
});

/** The playable square's half-extent. Nothing authored may exceed this. */
export const HALF_EXTENT = 150;

/**
 * The authored block.
 *
 * Buildings: 10 total — 4 low-rise (8–12 m), 4 mid-rise (20–35 m), 2 towers
 * (60–90 m), arranged in two rows facing the boulevard. `x`/`z` are the
 * footprint CENTRE; `w`/`d` are full width (X) and depth (Z); `h` is height.
 * All sit on the y = 0 ground plane. The 90 m tower is the one acceptance
 * criterion 20 asks a human to fly over and land on.
 *
 * They occupy the 100×100 m buildable core (±50 m on X and Z) minus the
 * boulevard right-of-way that cuts through it, so no footprint intrudes past
 * the sidewalk edge at |z| = 15.24 m.
 */
export const BLOCK = Object.freeze({
  buildings: [
    // --- north side of the boulevard (+Z) ---
    { kind: 'lowrise', x: -40, z: 27, w: 16, d: 20, h: 9 },
    { kind: 'midrise', x: -22, z: 29, w: 16, d: 24, h: 24 },
    { kind: 'tower', x: -2, z: 31, w: 20, d: 28, h: 90 },
    { kind: 'midrise', x: 18, z: 28, w: 16, d: 22, h: 31 },
    { kind: 'lowrise', x: 38, z: 26, w: 20, d: 18, h: 11 },
    // --- south side of the boulevard (-Z) ---
    { kind: 'lowrise', x: -39, z: -27, w: 18, d: 20, h: 8 },
    { kind: 'midrise', x: -19, z: -30, w: 18, d: 26, h: 27 },
    { kind: 'lowrise', x: 1, z: -26, w: 18, d: 18, h: 12 },
    { kind: 'tower', x: 21, z: -32, w: 18, d: 30, h: 64 },
    { kind: 'midrise', x: 40, z: -29, w: 16, d: 24, h: 33 },
  ],

  /**
   * Washingtonia robusta — the Mexican fan palm that defines the LA street
   * silhouette. 12–18 m, spaced 12 m along the parkway on both sides.
   * Generated rather than hand-listed because it is a strict arithmetic
   * progression; the deterministic pseudo-random height keeps the row from
   * looking machine-stamped without introducing frame-to-frame nondeterminism.
   */
  palmSpacing: 12,
  palmRange: 144, // ±144 m: inside the ±150 m playable extent
  lampSpacing: 24,
  lampRange: 132,
});

/** Metres of facade per texture tile. Drives the window grid density. */
const FACADE_TILE_M = 4;

export class StreetBlock {
  /**
   * @param {object} args
   * @param {THREE.Scene} args.scene
   * @param {import('./Collision.js').CollisionWorld} args.collision
   */
  constructor({ scene, collision }) {
    this.scene = scene;
    this.collision = collision;

    this.group = new THREE.Group();
    this.group.name = 'streetBlock';

    /**
     * Every CanvasTexture and standalone material created here is tracked so
     * `dispose()` can free it. Textures in particular are NOT reachable by
     * traversing the scene graph once a material is disposed, and disposing a
     * material does not dispose its textures — see core/dispose.js. This is the
     * leak that shows up as a climbing `renderer.info.memory.textures` across an
     * afternoon of Vite HMR reloads.
     * @type {Array<{dispose:() => void}>}
     */
    this._disposables = [];

    this._buildGround();
    this._buildRoad();
    this._buildBuildings();
    this._buildPalms();
    this._buildLamps();

    scene.add(this.group);
  }

  /**
   * Phase 1's world is static. Present so Game.js's fixed step has its final
   * shape — Phase 2 hangs streaming and time-of-day updates here.
   * @param {number} _dt
   */
  update(_dt) {}

  // ------------------------------------------------------------------ ground

  _buildGround() {
    // One large plane covering the whole playable square. Rotated -90° about X
    // so its +Z normal becomes +Y: PlaneGeometry is authored in the XY plane and
    // this is the standard incantation for turning one into a floor.
    const geo = new THREE.PlaneGeometry(HALF_EXTENT * 2, HALF_EXTENT * 2);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({ color: 0x9a927f, roughness: 1 });
    const ground = new THREE.Mesh(geo, mat);
    ground.name = 'ground';
    ground.receiveShadow = true;
    // Ground does not cast: it is the bottom of the world and casting from it
    // wastes shadow-map fill for zero visual gain.
    ground.castShadow = false;
    this.group.add(ground);
  }

  // -------------------------------------------------------------------- road

  _buildRoad() {
    const len = HALF_EXTENT * 2;

    // Asphalt, lifted a hair above the ground plane. Coplanar surfaces z-fight
    // violently at distance; 2 cm of separation is invisible and completely
    // removes the problem. Colour only, no texture, in Phase 1.
    const asphaltGeo = new THREE.PlaneGeometry(len, STREET.ROADWAY);
    asphaltGeo.rotateX(-Math.PI / 2);
    const asphalt = new THREE.Mesh(
      asphaltGeo,
      new THREE.MeshStandardMaterial({ color: 0x3c3f45, roughness: 0.95 }),
    );
    asphalt.name = 'roadway';
    asphalt.position.y = 0.02;
    asphalt.receiveShadow = true;
    this.group.add(asphalt);

    // Sidewalks: shallow slabs the full length of the block, one per side.
    // See STREET.SIDEWALK_RELIEF for why these are centimetres rather than the
    // real 15 cm.
    const walkGeo = new THREE.BoxGeometry(len, STREET.SIDEWALK_RELIEF, STREET.SIDEWALK);
    const walkMat = new THREE.MeshStandardMaterial({ color: 0xb0aca2, roughness: 0.9 });
    const walkZ = STREET.HALF_ROADWAY + STREET.SIDEWALK / 2;
    for (const sign of [1, -1]) {
      const walk = new THREE.Mesh(walkGeo, walkMat);
      walk.name = `sidewalk${sign > 0 ? 'North' : 'South'}`;
      walk.position.set(0, STREET.SIDEWALK_RELIEF / 2, sign * walkZ);
      walk.receiveShadow = true;
      this.group.add(walk);
    }

    // Curbs: a lighter strip at the roadway/sidewalk boundary. Purely visual and
    // NOT a collider — a kinematic capsule catching on every curb edge feels far
    // worse than walking over them freely.
    const curbGeo = new THREE.BoxGeometry(len, STREET.CURB_RELIEF, 0.35);
    const curbMat = new THREE.MeshStandardMaterial({ color: 0xd2cec4, roughness: 0.85 });
    for (const sign of [1, -1]) {
      const curb = new THREE.Mesh(curbGeo, curbMat);
      curb.name = `curb${sign > 0 ? 'North' : 'South'}`;
      curb.position.set(0, STREET.CURB_RELIEF / 2, sign * (STREET.HALF_ROADWAY + 0.17));
      curb.receiveShadow = true;
      this.group.add(curb);
    }

    // Dashed centreline down the middle of the centre turn lane. Instanced:
    // ~50 identical dashes as individual meshes would be 50 draw calls for
    // nothing.
    const dashLength = 2.4;
    const dashGap = 3.6;
    const stride = dashLength + dashGap;
    const dashCount = Math.floor(len / stride);
    const dashGeo = new THREE.BoxGeometry(dashLength, 0.02, 0.16);
    const dashMat = new THREE.MeshStandardMaterial({
      color: 0xe8d98a,
      roughness: 0.8,
      emissive: 0x2a2410,
    });
    const dashes = new THREE.InstancedMesh(dashGeo, dashMat, dashCount);
    dashes.name = 'centreline';
    const m = new THREE.Object3D();
    for (let i = 0; i < dashCount; i++) {
      m.position.set(-HALF_EXTENT + stride * i + dashLength / 2, 0.04, 0);
      m.updateMatrix();
      dashes.setMatrixAt(i, m.matrix);
    }
    dashes.instanceMatrix.needsUpdate = true;
    // Flat road paint neither casts nor receives usefully; skipping both keeps
    // it out of the shadow pass entirely.
    dashes.castShadow = false;
    this.group.add(dashes);
  }

  // --------------------------------------------------------------- buildings

  _buildBuildings() {
    // One shared CanvasTexture + material per building KIND, not per building.
    // Per-building UV scaling (below) is what lets ten differently-sized boxes
    // share three materials while keeping a consistent real-world window size —
    // the alternative, a cloned texture per building with its own `repeat`,
    // would triple the texture count for no visual difference.
    const kinds = {
      lowrise: this._makeFacadeMaterial(0xb9a58c, 0x2b3a4a, 3),
      midrise: this._makeFacadeMaterial(0x8f96a3, 0x1f2c3a, 4),
      tower: this._makeFacadeMaterial(0x6f7b8c, 0x16212e, 5),
    };

    for (let i = 0; i < BLOCK.buildings.length; i++) {
      const b = BLOCK.buildings[i];

      const geo = new THREE.BoxGeometry(b.w, b.h, b.d);
      // Scale each face's UVs by its real-world size so a window is the same
      // physical size on a 9 m low-rise and a 90 m tower.
      scaleBoxUVs(geo, b.w, b.h, b.d, FACADE_TILE_M);

      const mesh = new THREE.Mesh(geo, kinds[b.kind]);
      mesh.name = `building_${b.kind}_${i}`;
      // Box geometry is centred on its origin, so lift it by half its height to
      // stand it on the ground plane.
      mesh.position.set(b.x, b.h / 2, b.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);

      // Register the collider. Built from the authored numbers rather than from
      // `setFromObject(mesh)` so the collision world never depends on the mesh's
      // world matrix having been updated first — a classic source of
      // off-by-one-frame collider drift.
      this.collision.addBuilding(
        new THREE.Box3(
          new THREE.Vector3(b.x - b.w / 2, 0, b.z - b.d / 2),
          new THREE.Vector3(b.x + b.w / 2, b.h, b.z + b.d / 2),
        ),
      );
    }
  }

  /**
   * Build a facade material from a procedurally drawn window-strip canvas,
   * mirroring the 2D game's `drawWindowRow` technique.
   *
   * @param {number} wallColor base facade colour
   * @param {number} windowColor window glass colour
   * @param {number} columns windows across one tile
   * @returns {THREE.MeshStandardMaterial}
   */
  _makeFacadeMaterial(wallColor, windowColor, columns) {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = `#${wallColor.toString(16).padStart(6, '0')}`;
    ctx.fillRect(0, 0, size, size);

    // Window grid. The bottom band is left plain — see the roof-UV note below.
    const bandH = Math.floor(size * 0.12);
    const usableH = size - bandH;
    const rows = columns;
    const cellW = size / columns;
    const cellH = usableH / rows;
    const winW = cellW * 0.62;
    const winH = cellH * 0.55;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < columns; c++) {
        const x = c * cellW + (cellW - winW) / 2;
        const y = bandH + r * cellH + (cellH - winH) / 2;
        // Slight per-window brightness variation so the grid does not read as a
        // perfect checkerboard. Deterministic: a hash of the cell coordinates,
        // never Math.random(), so the texture is identical on every load and a
        // screenshot diff stays meaningful.
        const t = ((r * 73856093) ^ (c * 19349663)) >>> 0;
        const jitter = 0.75 + ((t % 100) / 100) * 0.5;
        ctx.fillStyle = shade(windowColor, jitter);
        ctx.fillRect(x, y, winW, winH);
      }
    }

    // Solid plinth band across the bottom of the tile. It reads as a floor-slab
    // edge when the texture tiles up a facade, AND it is where the roof faces'
    // UVs are pointed (see scaleBoxUVs) so rooftops get flat concrete instead of
    // a nonsensical grid of windows — without needing a second material and the
    // extra draw call per building that would cost.
    ctx.fillStyle = shade(wallColor, 0.82);
    ctx.fillRect(0, 0, size, bandH);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    // 4× anisotropy keeps facades legible at the grazing angles you get when
    // flying alongside a tower. Cheap; 16 would be overkill for Phase 1.
    texture.anisotropy = 4;
    this._disposables.push(texture);

    const material = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.85,
      metalness: 0.05,
    });
    this._disposables.push(material);
    return material;
  }

  // ------------------------------------------------------------ palms, lamps

  /**
   * Washingtonia robusta palms along both parkways.
   *
   * INSTANCED EVEN AT THIS COUNT, DELIBERATELY. Individual meshes would be a
   * perfectly fine 50 draw calls here, but Phase 2's Instancing.js is built on
   * exactly this pattern and a per-mesh implementation would have to be thrown
   * away. Establishing it now costs nothing.
   */
  _buildPalms() {
    const positions = [];
    for (let x = -BLOCK.palmRange; x <= BLOCK.palmRange; x += BLOCK.palmSpacing) {
      positions.push([x, STREET.PARKWAY_Z]);
      positions.push([x, -STREET.PARKWAY_Z]);
    }
    const count = positions.length;

    // Unit-height trunk, scaled per instance. Tapered: robusta trunks are
    // noticeably narrower at the crown.
    const trunkGeo = new THREE.CylinderGeometry(0.18, 0.3, 1, 7, 1);
    trunkGeo.translate(0, 0.5, 0); // origin at the base, so scaling grows upward
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8a7963, roughness: 1 });
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
    trunks.name = 'palmTrunks';
    trunks.castShadow = true;
    trunks.receiveShadow = true;

    // Crown: a squashed low-poly sphere. Not botanically detailed, but the
    // silhouette — bare stick with a small tuft on top — is what makes it read
    // as a fan palm at gameplay distance.
    const crownGeo = new THREE.IcosahedronGeometry(1, 0);
    crownGeo.scale(1, 0.45, 1);
    const crownMat = new THREE.MeshStandardMaterial({ color: 0x4c6b39, roughness: 0.95, flatShading: true });
    const crowns = new THREE.InstancedMesh(crownGeo, crownMat, count);
    crowns.name = 'palmCrowns';
    crowns.castShadow = true;

    const m = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      const [x, z] = positions[i];
      // Deterministic variation: same layout on every load, but not a uniform
      // row of clones. 12–18 m per the brief.
      const h = 12 + hash01(i * 2654435761) * 6;
      const lean = (hash01(i * 40503) - 0.5) * 0.08;

      m.position.set(x, 0, z);
      m.rotation.set(lean, hash01(i * 97) * Math.PI * 2, lean * 0.5);
      m.scale.set(1, h, 1);
      m.updateMatrix();
      trunks.setMatrixAt(i, m.matrix);

      m.position.set(x + lean * h * 0.5, h, z);
      m.rotation.set(0, hash01(i * 31) * Math.PI * 2, 0);
      const crownR = 1.9 + hash01(i * 7919) * 0.7;
      m.scale.set(crownR, crownR, crownR);
      m.updateMatrix();
      crowns.setMatrixAt(i, m.matrix);
    }
    trunks.instanceMatrix.needsUpdate = true;
    crowns.instanceMatrix.needsUpdate = true;

    this.group.add(trunks);
    this.group.add(crowns);
  }

  /** Street lamps, set back on the sidewalk. Instanced for the same reason as palms. */
  _buildLamps() {
    const positions = [];
    for (let x = -BLOCK.lampRange; x <= BLOCK.lampRange; x += BLOCK.lampSpacing) {
      positions.push([x, STREET.LAMP_Z]);
      positions.push([x, -STREET.LAMP_Z]);
    }
    const count = positions.length;
    const postH = 7.5;

    const postGeo = new THREE.CylinderGeometry(0.09, 0.13, postH, 6, 1);
    postGeo.translate(0, postH / 2, 0);
    const metalMat = new THREE.MeshStandardMaterial({
      color: 0x3a3f45,
      roughness: 0.5,
      metalness: 0.7,
    });
    const posts = new THREE.InstancedMesh(postGeo, metalMat, count);
    posts.name = 'lampPosts';
    posts.castShadow = true;

    // Lamp head. Emissive only — NO PointLight. Phase 1's lighting is static
    // midday; adding 22 real lights would cost far more than it shows.
    const headGeo = new THREE.BoxGeometry(1.1, 0.22, 0.4);
    const headMat = new THREE.MeshStandardMaterial({
      color: 0x6a6f76,
      emissive: 0x1a1c1f,
      roughness: 0.4,
      metalness: 0.6,
    });
    const heads = new THREE.InstancedMesh(headGeo, headMat, count);
    heads.name = 'lampHeads';
    heads.castShadow = true;

    const m = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      const [x, z] = positions[i];
      // Heads overhang toward the roadway, i.e. toward z = 0.
      const inward = z > 0 ? -1 : 1;

      m.position.set(x, 0, z);
      m.rotation.set(0, 0, 0);
      m.scale.set(1, 1, 1);
      m.updateMatrix();
      posts.setMatrixAt(i, m.matrix);

      m.position.set(x, postH - 0.2, z + inward * 0.5);
      m.rotation.set(0, Math.PI / 2, 0);
      m.updateMatrix();
      heads.setMatrixAt(i, m.matrix);
    }
    posts.instanceMatrix.needsUpdate = true;
    heads.instanceMatrix.needsUpdate = true;

    this.group.add(posts);
    this.group.add(heads);
  }

  /**
   * Free every GPU resource this block created.
   *
   * Two passes on purpose: `disposeObject3D` reaches everything attached to the
   * scene graph, and `_disposables` covers the CanvasTextures and shared
   * materials that are referenced by several meshes (traversal would visit them
   * repeatedly, which is harmless, but a shared resource whose last mesh was
   * already detached would be missed entirely).
   */
  dispose() {
    disposeObject3D(this.group);
    for (const d of this._disposables) d.dispose();
    this._disposables.length = 0;
    this.scene.remove(this.group);
    this.collision.clearBuildings();
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
 * building that a material array would cost — 10 buildings × 6 groups = 60 draw
 * calls would blow acceptance criterion 6 on its own).
 *
 * @param {THREE.BoxGeometry} geo
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
 * Deterministic hash → [0, 1). Used instead of Math.random() so the block is
 * byte-identical on every load; a world that reshuffles itself between reloads
 * makes visual regressions impossible to spot.
 * @param {number} n
 */
function hash01(n) {
  let x = (n ^ 0x9e3779b9) >>> 0;
  x = Math.imul(x ^ (x >>> 15), 0x85ebca6b) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0;
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

/**
 * Multiply a hex colour's channels by `k`, clamped, returned as a CSS string.
 * @param {number} hex
 * @param {number} k
 */
function shade(hex, k) {
  const r = Math.min(255, Math.round(((hex >> 16) & 0xff) * k));
  const g = Math.min(255, Math.round(((hex >> 8) & 0xff) * k));
  const b = Math.min(255, Math.round((hex & 0xff) * k));
  return `rgb(${r},${g},${b})`;
}

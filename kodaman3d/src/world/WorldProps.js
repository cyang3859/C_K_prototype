import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import { AWNING, BLADE, HVAC, PARAPET } from './annex.js';
import { annexPropPlacements } from './props.js';
import { disposeObject3D } from '../core/dispose.js';

/**
 * WorldProps.js — the world-shared instanced prop pools (design spec §8).
 *
 * ===========================================================================
 * THE LEDGER, WHICH IS THE POINT OF THIS FILE
 * ===========================================================================
 * ONE POOL PER SILHOUETTE, FOR THE WHOLE WORLD. Not per district, not per block
 * — §PROP-1's reading of `BUD-4`. An `InstancedMesh` costs exactly one main-pass
 * call and one shadow-pass call whether it draws 40 instances or 4,000, so the
 * pool count IS the draw-call count and nothing else here matters to the budget.
 *
 *   parapet coping ring       1 main + 1 shadow
 *   rooftop HVAC              1 main + 1 shadow
 *   storefront awnings        1 main + 1 shadow
 *   blade signs               1 main + 1 shadow
 *   Mexican fan palm trunk    1 main + 1 shadow
 *   Mexican fan palm crown    1 main + 1 shadow
 *   streetlamps (merged)      1 main + 1 shadow
 *
 * ===========================================================================
 * WHAT MOVED HERE, AND WHAT IT SAVED — LOCKED DECISION 24
 * ===========================================================================
 * Phase 1's `StreetBlock` owned eight pools: parapets, HVAC, awnings, blade
 * signs, palm trunks, palm crowns, lamp POSTS and lamp HEADS. Seven pools do the
 * same work here, because §8 asks for the lamp post and head to be **merged into
 * one geometry** — Phase 1's 2-mesh split would have cost double at world scale
 * for a 1.1 m box on top of a 7.5 m pole.
 *
 * The merge forces one material where Phase 1 had two, so the post/head colour
 * difference is carried as a **vertex colour attribute** instead. That is free
 * (it rides in the geometry), it keeps the head reading as a lighter fitting on
 * a dark pole, and it is the same trick the shade tree and the utility pole use.
 * The one thing genuinely lost is the head's `emissive: 0x1a1c1f` — a value of
 * (26, 28, 31)/255 under a static midday sun, which is below the noise floor of
 * anything a screenshot can show.
 *
 * ===========================================================================
 * WHY `InstancedMesh` AND NOT `BatchedMesh` FOR ALL OF THESE
 * ===========================================================================
 * `BatchedMesh` falls back to a real draw call PER GEOMETRY when the
 * `WEBGL_multi_draw` extension is absent (`WebGLRenderer.js`, the
 * `object.isBatchedMesh` branch) — one pool of 400 palms would become 400 calls
 * on a machine without it. `InstancedMesh` has no such cliff. So `BatchedMesh`
 * is reserved for pools that genuinely need several DIFFERENT geometries behind
 * one material, which is `LOD-3`'s case and nothing here.
 */

/** Metres. Street lamp post height, Phase 1's figure. */
const LAMP_POST_H = 7.5;

export class WorldProps {
  /**
   * @param {object} args
   * @param {THREE.Scene} args.scene
   * @param {import('./Collision.js').CollisionWorld} args.collision
   */
  constructor({ scene, collision }) {
    this.scene = scene;
    this.collision = collision;

    this.group = new THREE.Group();
    this.group.name = 'worldProps';

    /** @type {Array<{dispose:() => void}>} */
    this._disposables = [];
    /** @type {Map<string, THREE.Object3D>} */
    this.pools = new Map();

    const p = this._gather();

    this._buildParapets(p.parapets);
    this._buildHvac(p.hvac);
    this._buildAwnings(p.awnings);
    this._buildBladeSigns(p.bladeSigns);
    this._buildMexicanPalms(p.mexicanPalms);
    this._buildLamps(p.lamps);

    // Colliders. The collision world is created BEFORE this object for the same
    // reason it was created before `StreetBlock`: pools register their AABBs as
    // they build. The parapet ring's four boxes per building are the ones that
    // must not be lost — they are what stops the hero walking off a roof edge.
    for (const box of p.parapetColliders) this.collision.addBuilding(box);
    for (const box of p.hvacColliders) this.collision.addBuilding(box);

    scene.add(this.group);
  }

  /** Static this run. Present so the update shape matches the districts'. */
  update(_dt) {}

  /**
   * Collect every placement list this world needs.
   *
   * Split out so the set of contributing areas is one readable list rather than
   * being threaded through six builders.
   */
  _gather() {
    const annex = annexPropPlacements();
    return {
      parapets: [...annex.parapets],
      parapetColliders: [...annex.parapetColliders],
      hvac: [...annex.hvac],
      hvacColliders: [...annex.hvacColliders],
      awnings: [...annex.awnings],
      bladeSigns: [...annex.bladeSigns],
      mexicanPalms: [...annex.mexicanPalms],
      lamps: [...annex.lamps],
    };
  }

  // -------------------------------------------------------------- roof props

  /**
   * G1 — the parapet coping ring on every flat roof that has one. One draw call
   * for all of them.
   *
   * A RING OF FOUR BARS, NOT A SLAB. The slab version covered the roof centre,
   * which is exactly where the bespoke tower's atlas paints the helipad, and it
   * hid the marking at every size. Four bars cost the same one call and leave
   * the roof open. See `annex.js` for the full history.
   */
  _buildParapets(bars) {
    const geo = new THREE.BoxGeometry(1, 1, 1); // unit cube, scaled per instance
    const mat = new THREE.MeshStandardMaterial({
      color: PARAPET.COLOR,
      roughness: 0.6,
      metalness: 0.2,
    });
    const mesh = this._pool('roofParapets', geo, mat, bars.length, { receive: true });

    const m = new THREE.Object3D();
    for (let i = 0; i < bars.length; i++) {
      const bar = bars[i];
      m.position.set(bar.cx, bar.cy, bar.cz);
      m.rotation.set(0, bar.yaw ?? 0, 0);
      m.scale.set(bar.sx, bar.sy, bar.sz);
      m.updateMatrix();
      mesh.setMatrixAt(i, m.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }

  /** G2 — rooftop mechanical units. One draw call. */
  _buildHvac(units) {
    const geo = new THREE.BoxGeometry(HVAC.W, HVAC.H, HVAC.D);
    const mat = new THREE.MeshStandardMaterial({
      color: HVAC.COLOR,
      roughness: 0.5,
      metalness: 0.4,
    });
    const mesh = this._pool('roofUnits', geo, mat, units.length, { receive: true });

    const m = new THREE.Object3D();
    for (let i = 0; i < units.length; i++) {
      const u = units[i];
      // `u.y` is the unit's BASE (it rests on the roof surface itself), so the
      // mesh centre is half a box-height above it.
      m.position.set(u.x, u.y + HVAC.H / 2, u.z);
      m.rotation.set(0, u.yaw ?? 0, 0);
      m.scale.set(1, 1, 1);
      m.updateMatrix();
      mesh.setMatrixAt(i, m.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }

  // ----------------------------------------------------------- street façade

  /**
   * G3 — ground-floor storefront awnings. One draw call.
   *
   * NOT COLLIDERS, deliberately. Their underside sits at ~2.96 m at the leading
   * edge, well clear of the 1.85 m hero, so they can only ever be walked under —
   * and registering them would feed them to the camera's spring-arm sphere-cast,
   * which would yank the camera in every time the player passed a storefront.
   *
   * ⚠️ THESE CAST SHADOWS, and the spec says they do not. §8's District B table
   * prices awnings and blade signs at 1 call each, citing `ENGINEER_PHASE1_CLOSE.md`
   * for "confirmed no-shadow". The shipped code sets `castShadow = true` on both
   * (`StreetBlock._buildAwnings`/`_buildBladeSigns`). The code wins: turning
   * casting off would be a visible change to reviewed Phase 1 content in order
   * to make a budget table's arithmetic right. Real cost is 2 each, not 1.
   */
  _buildAwnings(awnings) {
    // Real thickness and projection are baked into the geometry; only the width
    // axis is scaled per instance, so the canopy's depth over the sidewalk is
    // identical on every building regardless of how wide the shopfront is.
    const geo = new THREE.BoxGeometry(1, AWNING.THICKNESS, AWNING.PROJECTION);
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0.0 });
    const mesh = this._pool('awnings', geo, mat, awnings.length, { receive: true });

    const m = new THREE.Object3D();
    const color = new THREE.Color();
    for (let i = 0; i < awnings.length; i++) {
      const a = awnings[i];
      m.position.set(a.x, a.y, a.z);
      // Tilt about the LOCAL X axis, then yaw: order matters once a district
      // rotation is involved, and `Euler`'s default 'XYZ' applies X first.
      m.rotation.set(a.tilt, a.yaw ?? 0, 0);
      m.scale.set(a.width, 1, 1);
      m.updateMatrix();
      mesh.setMatrixAt(i, m.matrix);
      color.setHex(a.color);
      mesh.setColorAt(i, color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  /**
   * G4 — vertical blade signs. One draw call.
   *
   * Silhouette only: no text, no graphics, no emissive, no proper nouns (locked
   * decision 6). Not colliders, for the same reasons as the awnings.
   */
  _buildBladeSigns(signs) {
    const geo = new THREE.BoxGeometry(BLADE.W, BLADE.H, BLADE.D);
    const mat = new THREE.MeshStandardMaterial({
      color: BLADE.COLOR,
      roughness: 0.6,
      metalness: 0.3,
    });
    const mesh = this._pool('bladeSigns', geo, mat, signs.length, { receive: true });

    const m = new THREE.Object3D();
    for (let i = 0; i < signs.length; i++) {
      const s = signs[i];
      m.position.set(s.x, s.y, s.z);
      m.rotation.set(0, s.yaw ?? 0, 0);
      m.scale.set(1, 1, 1);
      m.updateMatrix();
      mesh.setMatrixAt(i, m.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }

  // -------------------------------------------------------------- vegetation

  /**
   * Washingtonia robusta — the Mexican fan palm, District B's species per locked
   * decision 21. Two pools: trunk and crown.
   *
   * WHY NOT ONE MERGED POOL, when the streetlamp got merged. The crown's radius
   * and the trunk's height are independently hashed per palm — a bare stick with
   * a small tuft is the whole silhouette, and a merged geometry would force the
   * crown to scale with the trunk, which turns a 12 m and an 18 m palm into the
   * same tree at two sizes. §8 prices this species at two meshes for that reason.
   */
  _buildMexicanPalms(palms) {
    // Unit-height trunk, scaled per instance. Tapered: robusta trunks are
    // noticeably narrower at the crown.
    const trunkGeo = new THREE.CylinderGeometry(0.18, 0.3, 1, 7, 1);
    trunkGeo.translate(0, 0.5, 0); // origin at the base, so scaling grows upward
    const trunks = this._pool(
      'palmTrunks',
      trunkGeo,
      new THREE.MeshStandardMaterial({ color: 0x8a7963, roughness: 1 }),
      palms.length,
      { receive: true },
    );

    // Crown: a squashed low-poly sphere. Not botanically detailed, but the
    // silhouette — bare stick with a small tuft on top — is what makes it read
    // as a fan palm at gameplay distance.
    const crownGeo = new THREE.IcosahedronGeometry(1, 0);
    crownGeo.scale(1, 0.45, 1);
    const crowns = this._pool(
      'palmCrowns',
      crownGeo,
      new THREE.MeshStandardMaterial({ color: 0x4c6b39, roughness: 0.95, flatShading: true }),
      palms.length,
    );

    const m = new THREE.Object3D();
    for (let i = 0; i < palms.length; i++) {
      const p = palms[i];
      m.position.set(p.x, 0, p.z);
      m.rotation.set(p.lean, p.yaw, p.lean * 0.5);
      m.scale.set(1, p.height, 1);
      m.updateMatrix();
      trunks.setMatrixAt(i, m.matrix);

      m.position.set(p.x + p.lean * p.height * 0.5, p.height, p.z);
      m.rotation.set(0, p.crownYaw, 0);
      m.scale.set(p.crown, p.crown, p.crown);
      m.updateMatrix();
      crowns.setMatrixAt(i, m.matrix);
    }
    trunks.instanceMatrix.needsUpdate = true;
    crowns.instanceMatrix.needsUpdate = true;
  }

  // ---------------------------------------------------------------- lighting

  /**
   * Street lamps — post and head MERGED into one geometry (§8), one draw call.
   *
   * Emissive only, and in fact not even that: NO PointLight. The lighting is
   * static midday and adding hundreds of real lights would cost far more than it
   * could ever show.
   */
  _buildLamps(lamps) {
    const postGeo = new THREE.CylinderGeometry(0.09, 0.13, LAMP_POST_H, 6, 1);
    postGeo.translate(0, LAMP_POST_H / 2, 0);
    tintGeometry(postGeo, 0x3a3f45);

    // The head is an arm overhanging the roadway along local +Z, so a lamp's yaw
    // is all that decides which way it leans out.
    const headGeo = new THREE.BoxGeometry(0.4, 0.22, 1.1);
    headGeo.translate(0, LAMP_POST_H - 0.2, 0.5);
    tintGeometry(headGeo, 0x6a6f76);

    const merged = mergeGeometries([postGeo, headGeo]);
    postGeo.dispose();
    headGeo.dispose();

    const mesh = this._pool(
      'streetLamps',
      merged,
      new THREE.MeshStandardMaterial({
        // White base colour: the real colours ride in the vertex attribute, which
        // is what lets one material carry a dark pole and a lighter fitting.
        color: 0xffffff,
        vertexColors: true,
        roughness: 0.5,
        metalness: 0.7,
      }),
      lamps.length,
    );

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
  }

  // ----------------------------------------------------------------- plumbing

  /**
   * Create, name, register and add one instanced pool.
   *
   * A pool with zero instances is still a scene-graph node and would still cost
   * its two draw calls, so an empty one is dropped rather than added — the same
   * discipline `districts.test.js` enforces on empty facade batches.
   *
   * @param {string} name
   * @param {THREE.BufferGeometry} geo
   * @param {THREE.Material} mat
   * @param {number} count
   */
  _pool(name, geo, mat, count, { receive = false } = {}) {
    const mesh = new THREE.InstancedMesh(geo, mat, Math.max(count, 1));
    mesh.name = name;
    mesh.castShadow = true;
    mesh.receiveShadow = receive;
    mesh.count = count;
    this._disposables.push(mat);
    this.pools.set(name, mesh);
    if (count > 0) this.group.add(mesh);
    return mesh;
  }

  /** Free every GPU resource these pools created. */
  dispose() {
    disposeObject3D(this.group);
    for (const d of this._disposables) d.dispose();
    this._disposables.length = 0;
    this.pools.clear();
    this.scene.remove(this.group);
  }
}

/**
 * Bake a flat colour into a geometry's vertex-colour attribute.
 *
 * The lever that lets a MERGED multi-part prop (lamp post + head, tree trunk +
 * canopy, pole + crossarm) keep two colours while costing ONE material and
 * therefore one draw call. `mergeGeometries` requires identical attribute sets,
 * so every part of a merged prop must be tinted, including single-colour ones.
 *
 * @param {THREE.BufferGeometry} geo
 * @param {number} hex
 */
export function tintGeometry(geo, hex) {
  const c = new THREE.Color(hex);
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

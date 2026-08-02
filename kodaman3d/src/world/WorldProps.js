import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import { AWNING, BLADE, HVAC, PARAPET } from './annex.js';
import { SCAFFOLD_LIFT_M, allPropPlacements } from './props.js';
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

    const p = allPropPlacements();
    this.placements = p;

    this._buildParapets(p.parapets);
    this._buildHvac(p.hvac);
    this._buildAwnings(p.awnings);
    this._buildBladeSigns(p.bladeSigns);
    this._buildMexicanPalms(p.mexicanPalms);
    this._buildCanaryPalms(p.canaryPalms);
    this._buildShadeTrees(p.shadeTrees);
    this._buildLamps(p.lamps);
    this._buildUtilityPoles(p.utilityPoles);
    this._buildParkedCars(p.parkedCars);
    this._buildSmallProps(p.smallProps);
    this._buildBollards(p.bollards);
    this._buildCafeProps(p.cafeProps);
    this._buildScaffolding(p.scaffolding);

    // Colliders. The collision world is created BEFORE this object for the same
    // reason it was created before `StreetBlock`: pools register their AABBs as
    // they build. The parapet ring's four boxes per building are the ones that
    // must not be lost — they are what stops the hero walking off a roof edge.
    for (const box of p.parapetColliders) this.collision.addBuilding(box, this);
    for (const box of p.hvacColliders) this.collision.addBuilding(box, this);

    scene.add(this.group);
  }

  /** Static this run. Present so the update shape matches the districts'. */
  update(_dt) {}

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

  /**
   * Phoenix canariensis — the Canary Island date palm, District A's species per
   * locked decision 21.
   *
   * THE SILHOUETTE IS THE WHOLE POINT OF THE SPECIES SPLIT (§PROP-2). Where the
   * Mexican fan palm is a bare 18 m stick with a small tuft, this is a stocky
   * 9–14 m trunk under a massive near-spherical crown — "formal/estate, not
   * street". Two districts planted with two silhouettes read as two places for
   * the same four draw calls either species would have cost alone.
   *
   * Two pools again, and for the same reason as the fan palm: crown radius and
   * trunk height vary independently.
   */
  _buildCanaryPalms(palms) {
    // Much fatter and barely tapered — a date palm's trunk is a column.
    const trunkGeo = new THREE.CylinderGeometry(0.62, 0.8, 1, 8, 1);
    trunkGeo.translate(0, 0.5, 0);
    const trunks = this._pool(
      'canaryTrunks',
      trunkGeo,
      new THREE.MeshStandardMaterial({ color: 0x7a6a55, roughness: 1 }),
      palms.length,
      { receive: true },
    );

    // Detail 1 rather than the fan palm's detail 0, and barely squashed: the
    // "pineapple" crown is dense and round where the robusta's is a flat tuft.
    const crownGeo = new THREE.IcosahedronGeometry(1, 1);
    crownGeo.scale(1, 0.82, 1);
    const crowns = this._pool(
      'canaryCrowns',
      crownGeo,
      new THREE.MeshStandardMaterial({ color: 0x415c31, roughness: 0.95, flatShading: true }),
      palms.length,
    );

    const m = new THREE.Object3D();
    for (let i = 0; i < palms.length; i++) {
      const p = palms[i];
      m.position.set(p.x, 0, p.z);
      m.rotation.set(0, p.yaw, 0);
      m.scale.set(1, p.height, 1);
      m.updateMatrix();
      trunks.setMatrixAt(i, m.matrix);

      m.position.set(p.x, p.height, p.z);
      m.rotation.set(0, p.yaw, 0);
      m.scale.set(p.crown, p.crown, p.crown);
      m.updateMatrix();
      crowns.setMatrixAt(i, m.matrix);
    }
    trunks.instanceMatrix.needsUpdate = true;
    crowns.instanceMatrix.needsUpdate = true;
  }

  /**
   * A broadleaf shade tree, `DEN-7`'s answer to "not every district should read
   * as palm-only". District B's cross streets get these where its spine gets
   * palms.
   *
   * ONE MESH, TWO COLOURS: trunk and canopy are merged and tinted per vertex, so
   * the whole tree is a single draw call rather than the palms' two. It can be
   * merged where a palm cannot because a shade tree scales as a unit — a bigger
   * tree has a proportionally thicker trunk, which is not true of a palm.
   */
  _buildShadeTrees(trees) {
    // `IcosahedronGeometry` is NON-INDEXED and `CylinderGeometry` is indexed;
    // `mergeGeometries` refuses a mix and returns null, which would hand the
    // pool a null geometry and take the whole scene down. Drop the trunk's index
    // so both sides match.
    const trunkGeo = new THREE.CylinderGeometry(0.3, 0.45, 4.2, 7, 1)
      .translate(0, 2.1, 0)
      .toNonIndexed();
    tintGeometry(trunkGeo, 0x6b5844);

    const canopyGeo = new THREE.IcosahedronGeometry(3.4, 1);
    canopyGeo.scale(1, 0.78, 1);
    canopyGeo.translate(0, 6.2, 0);
    tintGeometry(canopyGeo, 0x4f6b3c);

    const merged = mergeGeometries([trunkGeo, canopyGeo]);
    trunkGeo.dispose();
    canopyGeo.dispose();

    const mesh = this._pool(
      'shadeTrees',
      merged,
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        vertexColors: true,
        roughness: 0.95,
        flatShading: true,
      }),
      trees.length,
    );

    const m = new THREE.Object3D();
    for (let i = 0; i < trees.length; i++) {
      const t = trees[i];
      m.position.set(t.x, 0, t.z);
      m.rotation.set(0, t.yaw, 0);
      m.scale.setScalar(t.scale);
      m.updateMatrix();
      mesh.setMatrixAt(i, m.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
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

  /**
   * Timber utility poles with a crossarm — District B only.
   *
   * §8 treats District A's dense core as undergrounded, which is a real and
   * common CBD condition and also keeps a silhouette out of a district that does
   * not want it. Merged pole + crossarm, vertex-tinted, one draw call.
   */
  _buildUtilityPoles(poles) {
    const poleGeo = new THREE.CylinderGeometry(0.17, 0.22, 9.4, 6, 1);
    poleGeo.translate(0, 4.7, 0);
    tintGeometry(poleGeo, 0x6a5a48);

    const armGeo = new THREE.BoxGeometry(2.6, 0.16, 0.16);
    armGeo.translate(0, 8.5, 0);
    tintGeometry(armGeo, 0x59493a);

    const merged = mergeGeometries([poleGeo, armGeo]);
    poleGeo.dispose();
    armGeo.dispose();

    const mesh = this._pool(
      'utilityPoles',
      merged,
      new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 1 }),
      poles.length,
    );

    const m = new THREE.Object3D();
    for (let i = 0; i < poles.length; i++) {
      const p = poles[i];
      m.position.set(p.x, 0, p.z);
      // The crossarm is authored across local X, so a pole's yaw puts it
      // perpendicular to the street rather than along it.
      m.rotation.set(0, p.yaw + Math.PI / 2, 0);
      m.scale.set(1, 1, 1);
      m.updateMatrix();
      mesh.setMatrixAt(i, m.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }

  // ------------------------------------------------------------ street level

  /**
   * Kerbside parked cars — two body shapes, one pool each, `setColorAt` for
   * colour variety within a shape (§8, and `DEN-4`'s own recommendation).
   *
   * WHY `setColorAt` AND NOT TWO MORE POOLS. `InstancedMesh` multiplies the
   * per-instance colour into the material, so one sedan pool can hold twenty
   * paint colours for one draw call. `BatchedMesh` could hold both shapes in one
   * pool, but it has NO per-instance material override and — more importantly —
   * falls back to one real draw call per geometry without `WEBGL_multi_draw`, so
   * a 200-car pool would become 200 calls on the wrong machine. Two instanced
   * pools cost 4 calls and have no such cliff.
   *
   * THE VERTEX TINT IS WHAT KEEPS THE GLASS AND TYRES OUT OF THE PAINT. The
   * instance colour multiplies the vertex colour, so a body authored white takes
   * the paint at full strength while near-black wheels and dark glazing stay
   * near-black whatever colour the car is.
   */
  _buildParkedCars(cars) {
    const sedans = [];
    const vans = [];
    for (const c of cars) (c.van ? vans : sedans).push(c);

    const paint = [0xb8c0c8, 0x2f3336, 0x8a2f2a, 0x27405c, 0xd8d4c8, 0x4a5a3e, 0x8d7a52];
    const build = (name, geo, list) => {
      const mesh = this._pool(
        name,
        geo,
        new THREE.MeshStandardMaterial({
          color: 0xffffff,
          vertexColors: true,
          roughness: 0.35,
          metalness: 0.45,
        }),
        list.length,
        { receive: true },
      );
      const m = new THREE.Object3D();
      const col = new THREE.Color();
      for (let i = 0; i < list.length; i++) {
        const c = list[i];
        m.position.set(c.x, 0, c.z);
        m.rotation.set(0, c.yaw, 0);
        m.scale.set(1, 1, 1);
        m.updateMatrix();
        mesh.setMatrixAt(i, m.matrix);
        col.setHex(paint[Math.floor(c.tint * paint.length) % paint.length]);
        mesh.setColorAt(i, col);
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    };

    build('parkedSedans', carGeometry(4.5, 1.28, 1.82, 0.42), sedans);
    build('parkedVans', carGeometry(5.4, 1.95, 1.98, 0.3), vans);
  }

  /**
   * `DEN-4`'s small sidewalk clutter — trash cans, newspaper boxes, hydrants.
   *
   * THE ONE PLACE `BatchedMesh` EARNS ITS COMPLEXITY, exactly as `LOD-3`
   * describes: several genuinely different geometries behind one material, one
   * call regardless of how many variants exist. Everywhere else in this file an
   * `InstancedMesh` suffices and is preferred, because `BatchedMesh` without
   * `WEBGL_multi_draw` degrades to one draw call per geometry.
   *
   * The blast radius of that fallback is deliberately small here: THREE
   * geometries, so the worst case is 3 calls rather than 1, not 200.
   */
  _buildSmallProps(props) {
    if (props.length === 0) return;

    const variants = [
      tintGeometry(cylinderAt(0.34, 0.3, 0.95), 0x4a4f52), // trash can
      tintGeometry(boxAt(0.52, 1.05, 0.42), 0x2f4a5c), // newspaper box
      tintGeometry(cylinderAt(0.16, 0.18, 0.78), 0x9c3a2c), // fire hydrant
    ];

    const batch = new THREE.BatchedMesh(
      props.length,
      variants.reduce((n, g) => n + g.attributes.position.count, 0),
      variants.reduce((n, g) => n + g.index.count, 0),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        vertexColors: true,
        roughness: 0.7,
        metalness: 0.15,
      }),
    );
    batch.name = 'smallProps';
    batch.castShadow = true;
    batch.receiveShadow = true;
    this._disposables.push(batch.material);

    const ids = variants.map((g) => batch.addGeometry(g));
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const pos = new THREE.Vector3();
    const one = new THREE.Vector3(1, 1, 1);
    for (const p of props) {
      const instanceId = batch.addInstance(ids[p.variant % ids.length]);
      pos.set(p.x, 0, p.z);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.yaw);
      m.compose(pos, q, one);
      batch.setMatrixAt(instanceId, m);
    }
    for (const g of variants) g.dispose();

    this.pools.set('smallProps', batch);
    this.group.add(batch);
  }

  // ------------------------------------------- §10 item 10, the cut tier

  /**
   * Loading-dock bollards at the tower bases (District A).
   *
   * NO SHADOW, per §8's own table — a 0.9 m post's shadow is not worth a second
   * pass over 100+ instances, and this is the lowest-return item in the whole
   * document. One call, and the first thing to delete under budget pressure.
   */
  _buildBollards(bollards) {
    const geo = new THREE.CylinderGeometry(0.13, 0.15, 0.92, 8, 1);
    geo.translate(0, 0.46, 0);
    const mesh = this._pool(
      'bollards',
      geo,
      new THREE.MeshStandardMaterial({ color: 0x54585c, roughness: 0.5, metalness: 0.6 }),
      bollards.length,
      { cast: false, receive: true },
    );
    const m = new THREE.Object3D();
    for (let i = 0; i < bollards.length; i++) {
      m.position.set(bollards[i].x, 0, bollards[i].z);
      m.rotation.set(0, 0, 0);
      m.scale.set(1, 1, 1);
      m.updateMatrix();
      mesh.setMatrixAt(i, m.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }

  /**
   * Pavement café tables outside District B's storefronts. One merged
   * top-and-pedestal geometry, vertex-tinted, no shadow (§8).
   */
  _buildCafeProps(tables) {
    const topGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.06, 10, 1).translate(0, 0.75, 0);
    tintGeometry(topGeo, 0xc9c2b2);
    const stemGeo = new THREE.CylinderGeometry(0.05, 0.14, 0.72, 8, 1).translate(0, 0.36, 0);
    tintGeometry(stemGeo, 0x3b3f42);
    const merged = mergeGeometries([topGeo, stemGeo]);
    topGeo.dispose();
    stemGeo.dispose();

    const mesh = this._pool(
      'cafeProps',
      merged,
      new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.7 }),
      tables.length,
      { cast: false, receive: true },
    );
    const m = new THREE.Object3D();
    for (let i = 0; i < tables.length; i++) {
      m.position.set(tables[i].x, 0, tables[i].z);
      m.rotation.set(0, tables[i].yaw, 0);
      m.scale.set(1, 1, 1);
      m.updateMatrix();
      mesh.setMatrixAt(i, m.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }

  /**
   * `DEN-8`'s construction storytelling: a scaffold bay — two standards, the
   * ledgers between them and a boarded lift — repeated up a facade.
   *
   * The bay is authored ONE lift tall and stacked as one INSTANCE per lift.
   * Scaling a single instance on Y instead — which is what the first build did —
   * gives two bare 12 m standards with one deck at the top, i.e. a gantry rather
   * than scaffolding. Instances inside a pool are free; the scale trick was not.
   */
  _buildScaffolding(bays) {
    const LIFT = SCAFFOLD_LIFT_M;
    const parts = [];
    for (const sx of [1, -1]) {
      const std = new THREE.BoxGeometry(0.09, LIFT, 0.09);
      std.translate(sx * 1.2, LIFT / 2, 0);
      parts.push(tintGeometry(std, 0x8d9298));
      const outer = new THREE.BoxGeometry(0.09, LIFT, 0.09);
      outer.translate(sx * 1.2, LIFT / 2, -0.85);
      parts.push(tintGeometry(outer, 0x8d9298));
    }
    const ledger = new THREE.BoxGeometry(2.5, 0.08, 0.08);
    ledger.translate(0, LIFT - 0.15, -0.85);
    parts.push(tintGeometry(ledger, 0x8d9298));
    const board = new THREE.BoxGeometry(2.5, 0.06, 0.9);
    board.translate(0, LIFT - 0.06, -0.45);
    parts.push(tintGeometry(board, 0xa8895c)); // timber deck
    const merged = mergeGeometries(parts);
    for (const p of parts) p.dispose();

    const mesh = this._pool(
      'scaffolding',
      merged,
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        vertexColors: true,
        roughness: 0.6,
        metalness: 0.4,
      }),
      bays.length,
      { receive: true },
    );

    const m = new THREE.Object3D();
    for (let i = 0; i < bays.length; i++) {
      const b = bays[i];
      m.position.set(b.x, b.y, b.z);
      m.rotation.set(0, b.yaw, 0);
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
  _pool(name, geo, mat, count, { receive = false, cast = true } = {}) {
    const mesh = new THREE.InstancedMesh(geo, mat, Math.max(count, 1));
    mesh.name = name;
    mesh.castShadow = cast;
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
    // Drops exactly this module's parapet and rooftop-unit colliders. Before
    // `removeOwner` existed the only tool was `clearBuildings()`, which would
    // also have dropped both districts' footprints — so nothing was dropped at
    // all, and the teardown assertion had to be deleted. It is back.
    this.collision.removeOwner(this);
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
/**
 * A parked car: body, cabin and four wheels merged into ONE geometry, tinted per
 * vertex so a single instance colour can paint the body without painting the
 * glass or the tyres.
 *
 * The car's nose is local +Z, so a placement's yaw alone decides which way it
 * points down the street. Everything sits on the roadway surface at y = 0.02 —
 * a car floating a hand's width above the asphalt, or half sunk into it, is the
 * defect this geometry's y offsets exist to avoid.
 *
 * @param {number} len overall length, m
 * @param {number} bodyH body height above the wheel centres, m
 * @param {number} width overall width, m
 * @param {number} cabinFrac fraction of the length the glasshouse spans
 */
function carGeometry(len, bodyH, width, cabinFrac) {
  const ROAD_Y = 0.02;
  const wheelR = 0.33;
  const parts = [];

  const body = new THREE.BoxGeometry(width, bodyH * 0.62, len);
  body.translate(0, ROAD_Y + wheelR + (bodyH * 0.62) / 2, 0);
  parts.push(tintGeometry(body, 0xffffff)); // takes the instance paint at full strength

  const cabin = new THREE.BoxGeometry(width * 0.88, bodyH * 0.5, len * cabinFrac);
  cabin.translate(0, ROAD_Y + wheelR + bodyH * 0.62 + (bodyH * 0.5) / 2, -len * 0.05);
  parts.push(tintGeometry(cabin, 0x39404a)); // glazing: stays dark whatever the paint

  for (const sx of [1, -1]) {
    for (const sz of [1, -1]) {
      const wheel = new THREE.CylinderGeometry(wheelR, wheelR, 0.22, 8, 1);
      wheel.rotateZ(Math.PI / 2); // axle along X
      wheel.translate(sx * (width / 2 - 0.06), ROAD_Y + wheelR, sz * (len * 0.31));
      parts.push(tintGeometry(wheel, 0x1a1c1e));
    }
  }

  const merged = mergeGeometries(parts);
  for (const p of parts) p.dispose();
  // `mergeGeometries` returns null on an attribute mismatch rather than
  // throwing, and a null geometry on an InstancedMesh fails much later and much
  // less legibly. Fail here instead.
  if (!merged) throw new Error('carGeometry: incompatible part geometries');
  return merged;
}

/** A small upright cylinder standing on the ground, for the sidewalk clutter batch. */
function cylinderAt(rTop, rBottom, h) {
  const geo = new THREE.CylinderGeometry(rTop, rBottom, h, 8, 1);
  geo.translate(0, h / 2, 0);
  return geo;
}

/** A small upright box standing on the ground, for the sidewalk clutter batch. */
function boxAt(w, h, d) {
  const geo = new THREE.BoxGeometry(w, h, d);
  geo.translate(0, h / 2, 0);
  return geo;
}

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

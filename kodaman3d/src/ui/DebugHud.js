import GUI from 'lil-gui';
import Stats from 'stats.js';

import { TUNING, resetTuning } from '../config/tuning.js';

/**
 * DebugHud.js — stats.js panel, lil-gui tuning folders, and a DOM state readout.
 *
 * THIS IS A REQUIRED DELIVERABLE, NOT A NICETY (brief §2/§6).
 * Every movement and camera constant must be live-tunable here. The numbers in
 * config/tuning.js are a starting point ported from the 2D game; feel parity
 * matters more than arithmetic parity, and the user retunes by feel. A constant
 * that is not exposed here is a constant nobody can evaluate.
 *
 * The readout also surfaces the exact counters the headless acceptance criteria
 * read — `renderer.info.render.calls` (criterion 6, must be < 60 on a static
 * frame) and `renderer.info.memory.geometries` / `.textures` (criterion 28, must
 * be flat across a 5-minute idle run). Those are Three.js's own free counters;
 * nothing custom is instrumented for them.
 */
export class DebugHud {
  /**
   * @param {object} args
   * @param {import('../core/Renderer.js').Renderer} args.renderer
   * @param {import('../core/Time.js').Time} args.time
   * @param {object} args.hero hero state
   * @param {import('../controllers/CameraRig.js').CameraRig} args.cameraRig
   */
  constructor({ renderer, time, hero, cameraRig }) {
    this.renderer = renderer;
    this.time = time;
    this.hero = hero;
    this.cameraRig = cameraRig;
    this.visible = true;

    // ---- stats.js: frame time panel -------------------------------------
    // Panel 0 is fps. Criterion 5 (≥60 fps sustained at 1920×1080) is read from
    // here BY A HUMAN ON REAL HARDWARE — a headless-browser fps number is
    // meaningless, because headless Chrome falls back to software rendering.
    this.stats = new Stats();
    this.stats.showPanel(0);
    Object.assign(this.stats.dom.style, {
      position: 'fixed',
      left: '8px',
      top: '8px',
      zIndex: '30',
    });
    document.body.appendChild(this.stats.dom);

    // ---- DOM readout -----------------------------------------------------
    this.readout = document.createElement('div');
    this.readout.id = 'debug-readout';
    Object.assign(this.readout.style, {
      position: 'fixed',
      left: '8px',
      top: '58px',
      padding: '8px 10px',
      background: 'rgba(10,14,20,0.72)',
      border: '1px solid rgba(255,255,255,0.15)',
      borderRadius: '4px',
      color: '#cfd8e3',
      font: '11px/1.5 ui-monospace, Menlo, Consolas, monospace',
      whiteSpace: 'pre',
      pointerEvents: 'none',
      zIndex: '30',
    });
    document.body.appendChild(this.readout);

    this._buildGui();
  }

  _buildGui() {
    this.gui = new GUI({ title: 'Tuning (Phase 1)' });
    this.gui.domElement.style.zIndex = '40';

    const loco = this.gui.addFolder('Locomotion — ground');
    loco.add(TUNING, 'MAX_SPEED', 1, 20, 0.1).name('MAX_SPEED (m/s)');
    loco.add(TUNING, 'DASH_SPEED', 1, 30, 0.1).name('DASH_SPEED (m/s)');
    loco.add(TUNING, 'MOVE_ACCEL', 1, 80, 0.5).name('MOVE_ACCEL (m/s²)');
    loco.add(TUNING, 'GRAVITY', 0, 60, 0.1).name('GRAVITY (m/s²)');
    loco.add(TUNING, 'GROUND_FRICTION', 0.5, 0.99, 0.005).name('GROUND_FRICTION /frame');
    loco.add(TUNING, 'YAW_SLERP_RATE', 1, 30, 0.5).name('YAW_SLERP_RATE (rad/s)');
    // Exposed for completeness and future retuning; NOT referenced by the FSM.
    // See its note in config/tuning.js before wiring it to anything.
    loco.add(TUNING, 'JUMP_FORCE', 0, 30, 0.1).name('JUMP_FORCE (unused)');

    const flight = this.gui.addFolder('Locomotion — flight');
    flight.add(TUNING, 'FLIGHT_DASH_SPEED', 1, 40, 0.1).name('FLIGHT_DASH_SPEED');
    flight.add(TUNING, 'FLIGHT_UP_THRUST', 1, 80, 0.1).name('FLIGHT_UP_THRUST');
    flight.add(TUNING, 'FLIGHT_DOWN_THRUST', 1, 80, 0.1).name('FLIGHT_DOWN_THRUST');
    flight.add(TUNING, 'MAX_FLIGHT_UP_SPEED', 1, 30, 0.1).name('MAX_FLIGHT_UP_SPEED');
    flight.add(TUNING, 'MAX_FLIGHT_DOWN_SPEED', 1, 30, 0.1).name('MAX_FLIGHT_DOWN_SPEED');
    flight.add(TUNING, 'TAKEOFF_CLIMB_SPEED', 0, 20, 0.1).name('TAKEOFF_CLIMB_SPEED');
    flight.add(TUNING, 'TAKEOFF_STEPS', 1, 60, 1).name('TAKEOFF_STEPS (fixed)');
    flight.add(TUNING, 'LANDING_DESCENT_ACCEL', 1, 80, 0.1).name('LANDING_DESCENT_ACCEL');
    flight.add(TUNING, 'LANDING_MAX_DOWN_SPEED', 1, 30, 0.1).name('LANDING_MAX_DOWN_SPEED');
    flight.add(TUNING, 'FLIGHT_FINE_MULT', 0.05, 1, 0.05).name('FLIGHT_FINE_MULT (J/K/L)');
    flight.add(TUNING, 'AIR_FRICTION', 0.5, 0.99, 0.005).name('AIR_FRICTION /frame');
    flight.add(TUNING, 'MAX_FORWARD_PITCH', 0, 1.6, 0.01).name('MAX_FORWARD_PITCH (rad)');
    // Both halves of the body-pitch model are tunable live, because how much
    // lean reads as "right" is a judgement nobody can make without a screen.
    flight.add(TUNING, 'MIN_FORWARD_PITCH', -1.6, 0, 0.01).name('MIN_FORWARD_PITCH (rad)');
    flight.add(TUNING, 'PITCH_SPEED_DIVISOR', 1, 30, 0.1).name('PITCH_SPEED_DIVISOR');
    // How far the cape is held off the torso once the body is flat. Live because
    // "the cape is inside the body" was a browser finding, so the fix has to be
    // judgeable in the same place it was found. 0 restores the old behaviour.
    flight.add(TUNING, 'CAPE_MIN_STANDOFF', 0, 1.2, 0.01).name('CAPE_MIN_STANDOFF (rad)');

    // The hover damping folder gets its own home and an explanatory name,
    // because this is the single most important — and most easily broken —
    // number in the port. It is a HALF-LIFE in seconds, not a per-frame factor:
    // deriving it from FLIGHT_HOVER_DAMPING^60 is degenerate (see tuning.js).
    const hover = this.gui.addFolder('Hover damping (F7 correction)');
    hover
      .add(TUNING, 'hoverDampingHalfLife', 0.05, 0.08, 0.001)
      .name('halfLife (s) — NOT ^60');
    hover.add(TUNING, 'HOVER_SNAP_SPEED', 0, 0.5, 0.005).name('HOVER_SNAP_SPEED (m/s)');

    // Sky.update() writes this onto the scene every step, so dragging the
    // slider changes the glass response live. 0 turns image-based lighting off
    // entirely, which is the honest before/after for the dark-tower problem.
    const env = this.gui.addFolder('Environment lighting');
    env.add(TUNING, 'ENV_INTENSITY', 0, 3, 0.05).name('ENV_INTENSITY (0 = off)');

    const cam = this.gui.addFolder('Camera');
    cam.add(TUNING, 'CAMERA_LAMBDA', 1, 20, 0.01).name('CAMERA_LAMBDA (1/s)');
    cam.add(TUNING, 'CAM_GROUND_DISTANCE', 1, 20, 0.1).name('ground distance');
    cam.add(TUNING, 'CAM_GROUND_HEIGHT', 0, 5, 0.05).name('ground height');
    cam.add(TUNING, 'CAM_GROUND_FOV', 30, 110, 1).name('ground FOV');
    cam.add(TUNING, 'CAM_FLIGHT_DISTANCE', 1, 25, 0.1).name('flight distance');
    cam.add(TUNING, 'CAM_FLIGHT_HEIGHT', 0, 6, 0.05).name('flight height');
    cam.add(TUNING, 'CAM_FLIGHT_FOV', 30, 110, 1).name('flight FOV');
    cam.add(TUNING, 'CAM_BLEND_TIME', 0.05, 3, 0.05).name('blend time (s)');
    cam.add(TUNING, 'CAM_DASH_FOV_BOOST', 0, 30, 0.5).name('dash FOV boost');
    cam.add(TUNING, 'CAM_MOUSE_SENSITIVITY', 0.0005, 0.01, 0.0001).name('mouse sensitivity');
    cam.add(TUNING, 'CAM_COLLISION_PADDING', 0, 1, 0.01).name('collision padding');
    cam.close();

    const actions = this.gui.addFolder('Actions');
    actions.add({ reset: () => resetTuning() }, 'reset').name('reset all to defaults');
    actions
      .add({ log: () => console.log('[tuning]', JSON.parse(JSON.stringify(TUNING))) }, 'log')
      .name('log current values');
    actions.close();
  }

  /**
   * Refresh the readout. Called ONCE PER RENDERED FRAME, not per fixed step —
   * a single frame may run zero or several fixed steps, and updating DOM text
   * several times before one paint is wasted work.
   */
  update() {
    if (!this.visible) return;

    const h = this.hero;
    const info = this.renderer.renderer.info;
    const rig = this.cameraRig;

    const speed = Math.hypot(h.velocity.x, h.velocity.z);
    this.readout.textContent = [
      `state      ${h.state}${h.flightActive ? '  [flight]' : ''}`,
      `onGround   ${h.onGround}`,
      `persona    ${h.persona}`,
      `pos        ${fmt(h.position.x)} ${fmt(h.position.y)} ${fmt(h.position.z)}`,
      `vel h/v    ${fmt(speed)} / ${fmt(h.velocity.y)} m/s`,
      `facing     ${fmt(h.facing)} rad`,
      `cam blend  ${fmt(rig.blend)}  fov ${fmt(rig.currentFov)}  arm ${fmt(rig.currentArm)}`,
      `fps        ${fmt(this.time.fps, 1)}   steps/frame ${this.time.stepsLastFrame}`,
      `draw calls ${info.render.calls}   tris ${info.render.triangles}`,
      `geometries ${info.memory.geometries}   textures ${info.memory.textures}`,
    ].join('\n');
  }

  /** F1 toggles the readout and the stats panel. */
  toggle() {
    this.visible = !this.visible;
    this.readout.style.display = this.visible ? '' : 'none';
    this.stats.dom.style.display = this.visible ? '' : 'none';
  }

  /** Called at the very start of a rendered frame. */
  beginFrame() {
    this.stats.begin();
  }

  /** Called at the very end of a rendered frame, after renderer.render(). */
  endFrame() {
    this.stats.end();
  }

  /** Remove every DOM node this HUD owns. Matters for HMR — see core/dispose.js. */
  dispose() {
    this.gui.destroy();
    this.stats.dom.remove();
    this.readout.remove();
  }
}

/**
 * @param {number} n
 * @param {number} [digits]
 */
function fmt(n, digits = 2) {
  return Number.isFinite(n) ? n.toFixed(digits).padStart(7) : '   n/a';
}

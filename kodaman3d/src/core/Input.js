/**
 * Input.js — keyboard state with edge detection, plus pointer-locked mouse look.
 *
 * DESIGN NOTES
 * ------------
 * 1. Everything keys off `event.code`, never `event.key`. `code` is the physical
 *    key position, so the bindings work identically on QWERTY, AZERTY and Dvorak
 *    and are unaffected by modifiers. This matches the 2D prototype's approach.
 *
 * 2. Three flags per key — `down` (level), `pressed` (this-step rising edge) and
 *    `released` (this-step falling edge). Edge flags are raised by the DOM event
 *    handler and cleared by `endStep()`, so they are true for exactly one fixed
 *    simulation step. Browser key-repeat is filtered out (`event.repeat`), so
 *    holding a key raises `pressed` once, not 30 times a second.
 *
 * 3. TAP-VS-HOLD FOR TAKEOFF — there is deliberately no timer.
 *    Takeoff fires on the DOWN-EDGE of W/Space, i.e. the single fixed step in
 *    which the key goes from up to down. That window is inherently ≤ 1 fixed
 *    step = 16.67 ms at 60 Hz, and no duration is measured beyond that.
 *    Press-and-hold therefore triggers takeoff identically to a quick tap (the
 *    edge fires once regardless of how long the key stays down); the continued
 *    hold is simply read again as "W held" once the FSM is already in
 *    takeoff/flying, which is what drives the climb. This is intentional and
 *    needs no debounce logic — it is the same down/pressed/released machine used
 *    for every other key.
 *
 * 4. The snapshot fields (`forward`, `jumpPressed`, `fine`, ...) are what the
 *    locomotion controller consumes. They are plain booleans and numbers on
 *    purpose: the controller must be drivable from a unit test with a hand-built
 *    object literal and no DOM anywhere in sight. Anything added here that the
 *    controller reads must stay equally trivial to fake.
 *
 * PHASE 1 STUBS: J / K / L / Z / C are input plumbing only. J/K/L additionally
 * set the `fine` flag (a precision-aiming slowdown, brief §6.3) — that is a
 * movement effect, not an ability. No combat exists in Phase 1 and none may be
 * added here (brief §13).
 */

/** Keys whose default browser behaviour (page scroll) must be suppressed. */
const PREVENT_DEFAULT_CODES = new Set([
  'Space',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
]);

/** Ability stubs: wired, logged once per press, no gameplay effect in Phase 1. */
const STUB_CODES = {
  KeyJ: 'punch',
  KeyK: 'laser',
  KeyL: 'freeze',
  KeyZ: 'block',
  KeyC: 'dodge roll',
};

export class Input {
  /**
   * @param {object} [options]
   * @param {HTMLElement|null} [options.element] element that receives pointer lock
   *   on click. Usually the renderer canvas.
   * @param {Window|null} [options.target] event target, injectable for testing.
   */
  constructor({ element = null, target = typeof window !== 'undefined' ? window : null } = {}) {
    this.element = element;
    this.target = target;

    /** @type {Map<string, {down:boolean, pressed:boolean, released:boolean}>} */
    this.keys = new Map();

    /** Accumulated pointer-lock mouse delta, consumed and zeroed every fixed step. */
    this.look = { dx: 0, dy: 0 };
    /** Accumulated wheel delta in notches, consumed and zeroed every fixed step. */
    this.wheel = 0;
    /** True while the document has pointer lock on our element. */
    this.pointerLocked = false;

    // ---- Snapshot consumed by LocomotionController (see class doc note 4) ----
    this.forward = false;
    this.back = false;
    this.left = false;
    this.right = false;
    this.jumpDown = false;
    this.jumpPressed = false;
    this.descend = false;
    this.dash = false;
    this.fine = false;
    this.landPressed = false;
    this.personaPressed = false;
    this.debugPressed = false;

    this._bound = false;
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onBlur = this._onBlur.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onWheel = this._onWheel.bind(this);
    this._onPointerLockChange = this._onPointerLockChange.bind(this);
    this._onCanvasClick = this._onCanvasClick.bind(this);

    /** Optional hook: called with (name) when a stub ability key is pressed. */
    this.onStub = null;
    /** Optional hook: called with (locked:boolean) whenever pointer lock changes. */
    this.onPointerLockChange = null;
  }

  /** Attach DOM listeners. No-op if there is no event target (unit tests). */
  attach() {
    if (this._bound || !this.target) return;
    this.target.addEventListener('keydown', this._onKeyDown);
    this.target.addEventListener('keyup', this._onKeyUp);
    this.target.addEventListener('blur', this._onBlur);
    this.target.addEventListener('mousemove', this._onMouseMove);
    this.target.addEventListener('wheel', this._onWheel, { passive: true });
    if (this.element) {
      this.element.addEventListener('click', this._onCanvasClick);
      this.element.ownerDocument.addEventListener('pointerlockchange', this._onPointerLockChange);
    }
    this._bound = true;
  }

  /** Detach every listener. Called from Game.destroy() so HMR does not stack handlers. */
  detach() {
    if (!this._bound || !this.target) return;
    this.target.removeEventListener('keydown', this._onKeyDown);
    this.target.removeEventListener('keyup', this._onKeyUp);
    this.target.removeEventListener('blur', this._onBlur);
    this.target.removeEventListener('mousemove', this._onMouseMove);
    this.target.removeEventListener('wheel', this._onWheel);
    if (this.element) {
      this.element.removeEventListener('click', this._onCanvasClick);
      this.element.ownerDocument.removeEventListener('pointerlockchange', this._onPointerLockChange);
    }
    this._bound = false;
  }

  /**
   * @param {string} code
   * @returns {{down:boolean, pressed:boolean, released:boolean}}
   */
  _key(code) {
    let k = this.keys.get(code);
    if (!k) {
      k = { down: false, pressed: false, released: false };
      this.keys.set(code, k);
    }
    return k;
  }

  /** @param {string} code */
  isDown(code) {
    const k = this.keys.get(code);
    return !!k && k.down;
  }

  /** @param {string} code */
  wasPressed(code) {
    const k = this.keys.get(code);
    return !!k && k.pressed;
  }

  /**
   * Refresh the derived snapshot fields. Called at the top of every fixed step,
   * BEFORE the locomotion controller reads them (brief §5's step order).
   */
  beginStep() {
    const space = this._key('Space');

    // ---- HORIZONTAL: WASD, and ONLY WASD --------------------------------
    // Camera-relative in every state, ground and air alike.
    this.forward = this.isDown('KeyW');
    this.back = this.isDown('KeyS');
    this.left = this.isDown('KeyA');
    this.right = this.isDown('KeyD');

    // ---- VERTICAL: never a movement key ---------------------------------
    // ⚠️ W AND S USED TO BE DOUBLE-BOUND HERE, and it broke three things at
    // once. `jumpDown` was `forward` and `descend` was `back`, so:
    //   1. holding W on the ground took off instead of running;
    //   2. in flight W climbed rather than flying forward, because full climb
    //      thrust drowned out the horizontal component it was also driving;
    //   3. holding S to descend also drove BACKWARD thrust, so dashing while
    //      descending reversed the hero.
    // `RESEARCH_CONTROLS.md` surveyed shipped titles: Anthem, Just Cause,
    // Saints Row IV, Arkham Knight and Minecraft all keep WASD as pure
    // horizontal thrust and put climb/descend on their own keys, camera
    // decoupled from thrust. Nothing in that survey double-binds a movement
    // key to a vertical axis.
    this.jumpDown = space.down;
    this.jumpPressed = space.pressed;

    // ⚠️ DESCEND IS DELIBERATELY BOUND TWICE, and Ctrl is NOT the safe one.
    // Ctrl is the convention (Saints Row IV) and is fine on macOS, but this
    // game ships in a browser and `Ctrl+W` is "close tab" on Windows and
    // Linux — a shortcut a page CANNOT preventDefault away. A player holding
    // descend and forward together would lose the tab mid-flight. X is bound
    // as the always-safe alternative and is what the on-screen hint teaches.
    this.descend =
      this.isDown('KeyX') || this.isDown('ControlLeft') || this.isDown('ControlRight');

    this.dash = this.isDown('ShiftLeft') || this.isDown('ShiftRight');

    // J / K / L are ability stubs, but they also set the precision-aiming flag,
    // which multiplies flight thrust and caps by FLIGHT_FINE_MULT. No ability.
    this.fine = this.isDown('KeyJ') || this.isDown('KeyK') || this.isDown('KeyL');

    this.landPressed = this.wasPressed('KeyG');
    this.personaPressed = this.wasPressed('KeyQ');
    this.debugPressed = this.wasPressed('F1');
  }

  /**
   * Clear per-step edge flags and consume the mouse/wheel deltas.
   * Called at the END of every fixed step (brief §5's step order), so a rising
   * edge is visible to exactly one simulation step no matter how many DOM events
   * arrived between frames.
   */
  endStep() {
    for (const k of this.keys.values()) {
      k.pressed = false;
      k.released = false;
    }
    this.look.dx = 0;
    this.look.dy = 0;
    this.wheel = 0;
  }

  /**
   * Clear ALL key state and pending deltas.
   *
   * This is the fix for the classic stuck-key bug: alt-tabbing while holding W
   * means the browser delivers the keydown but never the keyup, so on return the
   * hero flies upward forever. Bound to `window.blur` (acceptance criterion 27).
   * It also zeroes the look/wheel deltas so refocusing cannot inject a
   * camera whip from events queued during the blur.
   */
  clearAll() {
    for (const k of this.keys.values()) {
      k.down = false;
      k.pressed = false;
      k.released = false;
    }
    this.look.dx = 0;
    this.look.dy = 0;
    this.wheel = 0;
    this.beginStep(); // recompute the snapshot so it cannot report a stale hold
  }

  /** Release pointer lock, if held. */
  exitPointerLock() {
    if (this.element && this.element.ownerDocument.pointerLockElement) {
      this.element.ownerDocument.exitPointerLock();
    }
  }

  // ------------------------------------------------------------------ events

  /** @param {KeyboardEvent} e */
  _onKeyDown(e) {
    if (PREVENT_DEFAULT_CODES.has(e.code)) e.preventDefault();

    // Escape releases pointer lock. The browser does this natively too, but
    // handling it explicitly keeps the behaviour true when lock is not engaged.
    if (e.code === 'Escape') {
      this.exitPointerLock();
      return;
    }

    // Ignore auto-repeat so `pressed` is a genuine rising edge, once per press.
    if (e.repeat) return;

    const k = this._key(e.code);
    if (!k.down) {
      k.down = true;
      k.pressed = true;

      const stub = STUB_CODES[e.code];
      if (stub) {
        // Phase 1: log and nothing else. No combat, no effect. See brief §13.
        console.log(`[stub] ${stub} (${e.code}) — no effect in Phase 1`);
        if (this.onStub) this.onStub(stub);
      }
    }
  }

  /** @param {KeyboardEvent} e */
  _onKeyUp(e) {
    if (PREVENT_DEFAULT_CODES.has(e.code)) e.preventDefault();
    const k = this._key(e.code);
    if (k.down) {
      k.down = false;
      k.released = true;
    }
  }

  _onBlur() {
    this.clearAll();
  }

  /** @param {MouseEvent} e */
  _onMouseMove(e) {
    // Only accumulate while pointer-locked: unlocked movement would spin the
    // camera as the user moves the cursor toward the browser chrome.
    if (!this.pointerLocked) return;
    this.look.dx += e.movementX || 0;
    this.look.dy += e.movementY || 0;
  }

  /** @param {WheelEvent} e */
  _onWheel(e) {
    // Normalise to "notches". deltaMode 0 is pixels (trackpads), 1 is lines.
    const scale = e.deltaMode === 1 ? 1 / 3 : 1 / 100;
    this.wheel += e.deltaY * scale;
  }

  _onCanvasClick() {
    if (this.element && !this.element.ownerDocument.pointerLockElement) {
      this.element.requestPointerLock();
    }
  }

  _onPointerLockChange() {
    if (!this.element) return;
    this.pointerLocked = this.element.ownerDocument.pointerLockElement === this.element;
    if (!this.pointerLocked) {
      // Losing lock (Escape, alt-tab) must not leave a half-consumed delta.
      this.look.dx = 0;
      this.look.dy = 0;
    }
    if (this.onPointerLockChange) this.onPointerLockChange(this.pointerLocked);
  }
}

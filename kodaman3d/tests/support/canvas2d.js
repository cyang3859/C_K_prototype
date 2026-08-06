/**
 * canvas2d.js — a recording stand-in for `document.createElement('canvas')`.
 *
 * WHY THIS EXISTS. vite.config.js pins vitest to `environment: 'node'` and says
 * so deliberately: Collision.js and LocomotionController.js are pure logic and
 * must never acquire a DOM dependency. StreetBlock.js is a different animal — it
 * is a rendering module, and drawing procedural facades onto a 2D canvas is its
 * job, not a design smell. Rather than pull in jsdom (which ships no real 2D
 * context anyway, so it would buy nothing) this file installs the smallest
 * possible canvas surface on `globalThis`.
 *
 * DELIBERATELY NOT A PROXY. Every method the production code may call is listed
 * explicitly, so a call to something outside this list throws instead of being
 * silently swallowed. That keeps the stub honest about which canvas API the
 * world builder actually depends on.
 *
 * Each context records its calls, which is what lets a headless test assert on
 * things a screenshot would otherwise be needed for — notably that the helipad
 * is drawn inside the aspect-compensating `ctx.scale(1, 0.17857)` transform.
 */

/** One recorded 2D context. */
class RecordingContext2D {
  /** @param {{width:number,height:number}} canvas */
  constructor(canvas) {
    this.canvas = canvas;
    /** @type {Array<{op:string, args:number[], fillStyle:string}>} */
    this.calls = [];

    this.fillStyle = '#000000';
    this.strokeStyle = '#000000';
    this.lineWidth = 1;
    this.font = '10px sans-serif';
    this.textAlign = 'start';
    this.textBaseline = 'alphabetic';
  }

  /** @param {string} op @param {(number|string)[]} args */
  _record(op, args) {
    this.calls.push({ op, args, fillStyle: this.fillStyle });
  }

  fillRect(x, y, w, h) {
    this._record('fillRect', [x, y, w, h]);
  }
  save() {
    this._record('save', []);
  }
  restore() {
    this._record('restore', []);
  }
  translate(x, y) {
    this._record('translate', [x, y]);
  }
  scale(x, y) {
    this._record('scale', [x, y]);
  }
  beginPath() {
    this._record('beginPath', []);
  }
  closePath() {
    this._record('closePath', []);
  }
  arc(x, y, r, a0, a1, ccw) {
    this._record('arc', [x, y, r, a0, a1, ccw]);
  }
  fill() {
    this._record('fill', []);
  }
  stroke() {
    this._record('stroke', []);
  }
  fillText(text, x, y) {
    this._record('fillText', [text, x, y]);
  }
  measureText(text) {
    // Enough for layout arithmetic; no test depends on the exact figure.
    return { width: String(text).length * 8 };
  }
}

/** Every context handed out since `installCanvasStub()` was called. */
export const createdContexts = [];

/**
 * Install the stub on `globalThis.document`. Idempotent, and safe to call from
 * a `beforeAll` in any test file that needs to construct scene-graph modules.
 */
export function installCanvasStub() {
  createdContexts.length = 0;

  globalThis.document = {
    /** @param {string} tag */
    createElement(tag) {
      if (tag !== 'canvas') {
        throw new Error(`canvas2d stub: unexpected createElement('${tag}')`);
      }
      const canvas = { width: 0, height: 0, nodeName: 'CANVAS' };
      canvas.getContext = (type) => {
        if (type !== '2d') {
          throw new Error(`canvas2d stub: unexpected getContext('${type}')`);
        }
        const ctx = new RecordingContext2D(canvas);
        createdContexts.push(ctx);
        return ctx;
      };
      return canvas;
    },
  };
}

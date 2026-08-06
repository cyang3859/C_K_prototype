import { describe, expect, it } from 'vitest';

import { Time } from '../src/core/Time.js';

/**
 * time.test.js — the fixed-step accumulator, its two guards, and hit stop.
 *
 * The clock had no test file before hit stop was added to it, which is the wrong
 * way round: the accumulator is the thing every tuning constant in the project
 * is calibrated against. Its existing behaviour is pinned here alongside the new
 * hold, so a future change to one cannot quietly move the other.
 */

/** Run `frames` frames of `ms` each, returning the steps each frame reported. */
function run(time, frames, ms, startMs = 1000) {
  const steps = [];
  let t = startMs;
  time.beginFrame(t); // first frame only establishes the baseline
  for (let i = 0; i < frames; i++) {
    t += ms;
    steps.push(time.beginFrame(t));
  }
  return steps;
}

describe('fixed-step accumulator', () => {
  it('simulates nothing on the very first frame', () => {
    expect(new Time().beginFrame(1000)).toBe(0);
  });

  it('runs one step per frame, on average, at 60 Hz', () => {
    // ON AVERAGE, not every frame, and the difference is not slack in the test.
    // A 60 Hz frame is 16.666… ms, which as a double divided back by 1000 lands
    // a hair UNDER 1/60 s — so an occasional frame genuinely owes zero steps and
    // the next owes two. That is the accumulator working: it is conserving time,
    // not matching frames. Asserting `every(s => s === 1)` pins a rounding
    // artefact and fails on arithmetic nobody wrote.
    const steps = run(new Time(), 60, 1000 / 60);
    const total = steps.reduce((a, b) => a + b, 0);
    expect(total).toBeGreaterThanOrEqual(59);
    expect(total).toBeLessThanOrEqual(60);
    expect(Math.max(...steps)).toBeLessThanOrEqual(2);
  });

  it('runs a step only every other frame at 144 Hz — 0 steps is normal', () => {
    const steps = run(new Time(), 20, 1000 / 144);
    expect(steps).toContain(0);
    // 20 frames at 144 Hz is 0.139 s, which owes 8 steps of 1/60.
    expect(steps.reduce((a, b) => a + b, 0)).toBe(8);
  });

  it('clamps a tab-out spike instead of demanding hundreds of catch-up steps', () => {
    const time = new Time();
    time.beginFrame(0);
    // A 30-second freeze. Unclamped this is 1,800 steps.
    expect(time.beginFrame(30_000)).toBe(time.maxSteps);
    expect(time.droppedBacklog).toBe(true);
  });

  it('drops the backlog rather than spiralling', () => {
    const time = new Time();
    time.beginFrame(0);
    time.beginFrame(1000);
    expect(time.accumulator).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Hit stop (`RESEARCH_MANOFSTEEL_REPO.md` §7b)
// ---------------------------------------------------------------------------

describe('hit stop', () => {
  it('simulates nothing while the hold is running', () => {
    const time = new Time();
    time.beginFrame(0);
    time.hold(4 / 60);
    // Four 60 Hz frames, entirely inside the hold.
    const steps = [1, 2, 3].map((i) => time.beginFrame((i * 1000) / 60));
    expect(steps).toEqual([0, 0, 0]);
  });

  it('resumes normally once the hold expires', () => {
    const time = new Time();
    time.beginFrame(0);
    time.hold(2 / 60);
    let t = 0;
    const steps = [];
    for (let i = 0; i < 8; i++) {
      t += 1000 / 60;
      steps.push(time.beginFrame(t));
    }
    // First two frames burn the hold and simulate nothing; the rest are ordinary.
    expect(steps.slice(0, 2)).toEqual([0, 0]);
    expect(steps.slice(2).reduce((a, b) => a + b, 0)).toBeGreaterThanOrEqual(5);
    expect(time.holdRemaining).toBeLessThanOrEqual(0);
  });

  it('DISCARDS the held time rather than banking it — no catch-up sprint', () => {
    // The whole point. If the hold's time reached the accumulator, releasing it
    // would run a burst of steps and the game would fast-forward through
    // exactly what the freeze was emphasising.
    const time = new Time();
    time.beginFrame(0);
    time.hold(0.2); // 12 frames' worth
    let t = 0;
    for (let i = 0; i < 12; i++) {
      t += 1000 / 60;
      time.beginFrame(t);
    }
    // Twelve frames swallowed by the hold. If any of that time had been banked
    // the accumulator would now be holding ~0.2 s and the next few frames would
    // each run the `maxSteps` cap.
    const after = [];
    for (let i = 0; i < 4; i++) {
      t += 1000 / 60;
      after.push(time.beginFrame(t));
    }
    // ~4 steps for 4 frames. Banked, the accumulator would be holding 0.2 s and
    // these four frames would run the `maxSteps` cap over and over — 12+ steps.
    // (An individual frame owing 2 is the 16.666… ms rounding noted above, not a
    // burst, which is why this counts the total rather than the per-frame max.)
    expect(after.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(5);
    expect(time.accumulator).toBeLessThan(1 / 60);
  });

  it('takes the LONGEST hold rather than adding them up', () => {
    // Two enemies caught by one laser must read as one impact, not as a
    // double-length stutter.
    const time = new Time();
    time.hold(4 / 60);
    time.hold(8 / 60);
    time.hold(2 / 60);
    expect(time.holdRemaining).toBeCloseTo(8 / 60, 9);
  });

  it('ignores a zero or negative hold', () => {
    const time = new Time();
    time.hold(0);
    time.hold(-1);
    expect(time.holdRemaining).toBe(0);
  });

  it('still tracks wall-clock frames while held, so fps does not read as a hang', () => {
    const time = new Time();
    time.beginFrame(0);
    time.hold(1.0);
    let t = 0;
    for (let i = 0; i < 40; i++) {
      t += 1000 / 60;
      time.beginFrame(t);
    }
    expect(time.fps).toBeGreaterThan(50);
  });

  it('clears the hold on a baseline reset — a frozen game after an alt-tab reads as a hang', () => {
    const time = new Time();
    time.hold(0.5);
    time.resetBaseline();
    expect(time.holdRemaining).toBe(0);
  });
});

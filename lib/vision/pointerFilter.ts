/**
 * One-Euro filter: adaptive low-pass filter tuned for human-pointing signals —
 * smooths tremor at low speed, tracks closely at high speed. Used to damp the
 * raw fingertip landmark before it drives the on-screen cursor.
 * Reference: Casiez, Roussel, Vogel — "1€ Filter" (CHI 2012).
 */
class LowPassFilter {
  private hasValue = false;
  private value = 0;

  filter(x: number, alpha: number): number {
    const result = this.hasValue ? alpha * x + (1 - alpha) * this.value : x;
    this.hasValue = true;
    this.value = result;
    return result;
  }

  get lastValue() {
    return this.value;
  }
}

function alphaFor(cutoff: number, dt: number): number {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dt);
}

export interface OneEuroOptions {
  minCutoff?: number;
  beta?: number;
  dCutoff?: number;
}

export class OneEuroFilter {
  private minCutoff: number;
  private beta: number;
  private dCutoff: number;
  private xFilter = new LowPassFilter();
  private dxFilter = new LowPassFilter();
  private lastTime: number | null = null;

  constructor(options: OneEuroOptions = {}) {
    this.minCutoff = options.minCutoff ?? 1.0;
    this.beta = options.beta ?? 0.02;
    this.dCutoff = options.dCutoff ?? 1.0;
  }

  reset() {
    this.xFilter = new LowPassFilter();
    this.dxFilter = new LowPassFilter();
    this.lastTime = null;
  }

  filter(value: number, timestampMs: number): number {
    if (this.lastTime === null) {
      this.lastTime = timestampMs;
      this.xFilter.filter(value, 1);
      return value;
    }
    const dt = Math.max((timestampMs - this.lastTime) / 1000, 1 / 120);
    this.lastTime = timestampMs;

    const prevX = this.xFilter.lastValue;
    const dx = (value - prevX) / dt;
    const edx = this.dxFilter.filter(dx, alphaFor(this.dCutoff, dt));

    const cutoff = this.minCutoff + this.beta * Math.abs(edx);
    return this.xFilter.filter(value, alphaFor(cutoff, dt));
  }
}

/** 2D convenience wrapper + a dead zone so sub-pixel tremor never moves the cursor. */
export class PointerFilter2D {
  private fx: OneEuroFilter;
  private fy: OneEuroFilter;
  private lastOutput: { x: number; y: number } | null = null;
  private deadZone: number;

  constructor(options: OneEuroOptions & { deadZone?: number } = {}) {
    this.fx = new OneEuroFilter(options);
    this.fy = new OneEuroFilter(options);
    this.deadZone = options.deadZone ?? 0.0025; // normalized units
  }

  reset() {
    this.fx.reset();
    this.fy.reset();
    this.lastOutput = null;
  }

  apply(x: number, y: number, timestampMs: number): { x: number; y: number } {
    const fx = this.fx.filter(x, timestampMs);
    const fy = this.fy.filter(y, timestampMs);

    if (this.lastOutput) {
      const dist = Math.hypot(fx - this.lastOutput.x, fy - this.lastOutput.y);
      if (dist < this.deadZone) {
        return this.lastOutput;
      }
    }
    this.lastOutput = { x: fx, y: fy };
    return this.lastOutput;
  }
}

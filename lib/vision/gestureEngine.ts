import { dist, handScale, isFingerExtended, LM, type HandLandmarks } from "./landmarks";

export type GestureType =
  | "NONE"
  | "POINT"
  | "PINCH"
  | "PALM"
  | "FIST"
  | "TWO_FINGER"
  | "SWIPE_LEFT"
  | "SWIPE_RIGHT";

export interface GestureEvent {
  type: GestureType;
  timestamp: number;
}

export interface GestureFrame {
  gesture: GestureType;
  confidence: number;
  pinchActive: boolean;
  palmHoldMs: number;
  cursor: { x: number; y: number } | null; // index fingertip, normalized [0,1]
  events: GestureEvent[]; // discrete edge-triggered events fired this frame
}

// Thresholds tuned as a starting point — same "confidence + debounce + cooldown"
// safety-filtering philosophy as the Python GestureEngine, not the same numbers
// (different signal/camera pipeline).
const PINCH_ON_RATIO = 0.35;
const PINCH_OFF_RATIO = 0.45; // hysteresis so pinch doesn't flicker at the boundary
const RAW_DEBOUNCE_FRAMES = 3;
const SWIPE_COOLDOWN_MS = 700;
const SWIPE_MIN_VELOCITY = 1.6; // normalized units / second
const PALM_PAUSE_HOLD_MS = 1000;
const SWIPE_WINDOW_MS = 250;

function classifyRawPose(lm: HandLandmarks): { pose: GestureType; confidence: number } {
  const scale = handScale(lm);
  const pinchDist = dist(lm[LM.THUMB_TIP], lm[LM.INDEX_TIP]) / scale;

  const indexExt = isFingerExtended(lm, LM.INDEX_TIP, LM.INDEX_MCP);
  const middleExt = isFingerExtended(lm, LM.MIDDLE_TIP, LM.MIDDLE_MCP);
  const ringExt = isFingerExtended(lm, LM.RING_TIP, LM.RING_MCP);
  const pinkyExt = isFingerExtended(lm, LM.PINKY_TIP, LM.PINKY_MCP);

  const extendedCount = [indexExt, middleExt, ringExt, pinkyExt].filter(Boolean).length;

  if (pinchDist < PINCH_ON_RATIO) {
    return { pose: "PINCH", confidence: Math.max(0, 1 - pinchDist / PINCH_ON_RATIO) };
  }
  if (extendedCount === 0) {
    return { pose: "FIST", confidence: 0.85 };
  }
  if (indexExt && middleExt && !ringExt && !pinkyExt) {
    return { pose: "TWO_FINGER", confidence: 0.8 };
  }
  if (extendedCount >= 3) {
    return { pose: "PALM", confidence: 0.75 + 0.05 * extendedCount };
  }
  return { pose: "POINT", confidence: 0.6 };
}

export class GestureEngine {
  private rawHistory: GestureType[] = [];
  private confirmedPose: GestureType = "NONE";
  private pinchActive = false;
  private poseEnteredAt = 0;
  private lastSwipeAt = 0;
  private positionHistory: { x: number; y: number; t: number }[] = [];

  reset() {
    this.rawHistory = [];
    this.confirmedPose = "NONE";
    this.pinchActive = false;
    this.poseEnteredAt = 0;
    this.lastSwipeAt = 0;
    this.positionHistory = [];
  }

  /**
   * Feed one frame of landmarks (or null when no hand is detected) at `timestampMs`.
   * `events` only carries discrete triggers (swipe, two-finger); pinch click/drag is
   * derived by the caller from the `pinchActive` edge (press = drag start, quick
   * release = click) since that needs the caller's own hold-time/movement context.
   */
  update(lm: HandLandmarks | null, timestampMs: number): GestureFrame {
    const events: GestureEvent[] = [];

    if (!lm) {
      this.rawHistory = [];
      this.pinchActive = false;
      this.confirmedPose = "NONE";
      this.positionHistory = [];
      return { gesture: "NONE", confidence: 0, pinchActive: false, palmHoldMs: 0, cursor: null, events: [] };
    }

    const cursor = { x: lm[LM.INDEX_TIP].x, y: lm[LM.INDEX_TIP].y };
    const { pose, confidence } = classifyRawPose(lm);

    // hysteresis: once pinched, require the larger "off" distance before releasing
    const scale = handScale(lm);
    const pinchDist = dist(lm[LM.THUMB_TIP], lm[LM.INDEX_TIP]) / scale;
    const effectivePose: GestureType = this.pinchActive && pinchDist < PINCH_OFF_RATIO ? "PINCH" : pose;

    this.rawHistory.push(effectivePose);
    if (this.rawHistory.length > RAW_DEBOUNCE_FRAMES) this.rawHistory.shift();
    const debounced =
      this.rawHistory.length === RAW_DEBOUNCE_FRAMES && this.rawHistory.every((p) => p === this.rawHistory[0])
        ? this.rawHistory[0]
        : this.confirmedPose;

    if (debounced !== this.confirmedPose) {
      this.confirmedPose = debounced;
      this.poseEnteredAt = timestampMs;
      this.pinchActive = debounced === "PINCH";
      if (debounced === "TWO_FINGER") {
        events.push({ type: "TWO_FINGER", timestamp: timestampMs });
      }
    } else if (this.pinchActive && pinchDist >= PINCH_OFF_RATIO) {
      this.pinchActive = false;
      this.confirmedPose = effectivePose;
    }

    // swipe detection: horizontal velocity of the wrist while the hand is open/pointing
    this.positionHistory.push({ x: lm[LM.WRIST].x, y: lm[LM.WRIST].y, t: timestampMs });
    this.positionHistory = this.positionHistory.filter((p) => timestampMs - p.t <= SWIPE_WINDOW_MS);
    if (
      this.positionHistory.length >= 2 &&
      (this.confirmedPose === "PALM" || this.confirmedPose === "POINT") &&
      timestampMs - this.lastSwipeAt > SWIPE_COOLDOWN_MS
    ) {
      const first = this.positionHistory[0];
      const last = this.positionHistory[this.positionHistory.length - 1];
      const dt = (last.t - first.t) / 1000;
      if (dt > 0.03) {
        const vx = (last.x - first.x) / dt;
        if (Math.abs(vx) > SWIPE_MIN_VELOCITY) {
          const type: GestureType = vx > 0 ? "SWIPE_RIGHT" : "SWIPE_LEFT";
          events.push({ type, timestamp: timestampMs });
          this.lastSwipeAt = timestampMs;
          this.positionHistory = [];
        }
      }
    }

    // exposed so callers can decide when a held-open-palm crosses the pause
    // threshold (PALM_PAUSE_HOLD_MS) — kept as a duration rather than a fired
    // event here, since "pause" is a continuous state, not a discrete trigger.
    const palmHoldMs =
      this.confirmedPose === "PALM" ? Math.max(0, timestampMs - this.poseEnteredAt) : 0;

    return {
      gesture: this.confirmedPose,
      confidence,
      pinchActive: this.pinchActive,
      palmHoldMs,
      cursor,
      events,
    };
  }
}

export const PALM_PAUSE_HOLD_MS_EXPORT = PALM_PAUSE_HOLD_MS;

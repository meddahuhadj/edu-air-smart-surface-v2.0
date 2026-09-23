/** Mirrors @mediapipe/tasks-vision's NormalizedLandmark shape without importing it here. */
export interface Landmark {
  x: number;
  y: number;
  z: number;
}

export type HandLandmarks = Landmark[]; // 21 points, MediaPipe hand topology

export const LM = {
  WRIST: 0,
  THUMB_CMC: 1,
  THUMB_MCP: 2,
  THUMB_IP: 3,
  THUMB_TIP: 4,
  INDEX_MCP: 5,
  INDEX_PIP: 6,
  INDEX_DIP: 7,
  INDEX_TIP: 8,
  MIDDLE_MCP: 9,
  MIDDLE_PIP: 10,
  MIDDLE_DIP: 11,
  MIDDLE_TIP: 12,
  RING_MCP: 13,
  RING_PIP: 14,
  RING_DIP: 15,
  RING_TIP: 16,
  PINKY_MCP: 17,
  PINKY_PIP: 18,
  PINKY_DIP: 19,
  PINKY_TIP: 20,
} as const;

export function dist(a: Landmark, b: Landmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Wrist-to-middle-MCP distance: a rotation/scale-stable proxy for "how big is this hand in frame". */
export function handScale(lm: HandLandmarks): number {
  return Math.max(dist(lm[LM.WRIST], lm[LM.MIDDLE_MCP]), 1e-6);
}

export function isFingerExtended(lm: HandLandmarks, tip: number, mcp: number): boolean {
  const scale = handScale(lm);
  const wrist = lm[LM.WRIST];
  return dist(wrist, lm[tip]) > dist(wrist, lm[mcp]) + scale * 0.08;
}

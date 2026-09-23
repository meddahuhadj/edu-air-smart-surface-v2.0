/**
 * 4-point planar homography: maps a point observed in camera space (the
 * physical surface, as seen by the webcam) to normalized screen space.
 * Same purpose as the Python app's interaction-plane homography — an
 * estimated mapping, not a physical touch measurement.
 */
export interface Point {
  x: number;
  y: number;
}

export type Homography = number[]; // 9 values, row-major 3x3, h[8] === 1

/** Solves an 8x8 linear system Ax=b via Gauss-Jordan elimination with partial pivoting. */
function solveLinearSystem(A: number[][], b: number[]): number[] | null {
  const n = A.length;
  const M = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    let pivotRow = col;
    let maxAbs = Math.abs(M[col][col]);
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > maxAbs) {
        maxAbs = Math.abs(M[r][col]);
        pivotRow = r;
      }
    }
    if (maxAbs < 1e-10) return null; // singular — degenerate corner configuration
    [M[col], M[pivotRow]] = [M[pivotRow], M[col]];

    const pivot = M[col][col];
    for (let c = col; c <= n; c++) M[col][c] /= pivot;

    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = M[r][col];
      if (factor === 0) continue;
      for (let c = col; c <= n; c++) M[r][c] -= factor * M[col][c];
    }
  }

  return M.map((row) => row[n]);
}

/** Computes the homography mapping `src[i] -> dst[i]` for exactly 4 point pairs. */
export function computeHomography(src: Point[], dst: Point[]): Homography | null {
  if (src.length !== 4 || dst.length !== 4) {
    throw new Error("computeHomography requires exactly 4 point correspondences");
  }

  const A: number[][] = [];
  const b: number[] = [];

  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i];
    const { x: X, y: Y } = dst[i];
    A.push([x, y, 1, 0, 0, 0, -x * X, -y * X]);
    b.push(X);
    A.push([0, 0, 0, x, y, 1, -x * Y, -y * Y]);
    b.push(Y);
  }

  const h = solveLinearSystem(A, b);
  if (!h) return null;
  return [...h, 1];
}

export function applyHomography(h: Homography, point: Point): Point {
  const [h11, h12, h13, h21, h22, h23, h31, h32, h33] = h;
  const denom = h31 * point.x + h32 * point.y + h33;
  if (Math.abs(denom) < 1e-9) return point;
  return {
    x: (h11 * point.x + h12 * point.y + h13) / denom,
    y: (h21 * point.x + h22 * point.y + h23) / denom,
  };
}

export const IDENTITY_HOMOGRAPHY: Homography = [1, 0, 0, 0, 1, 0, 0, 0, 1];

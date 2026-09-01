/**
 * Project A.E.G.I.S — Pure Analytical 2-Bone 3D Inverse Kinematics Solver (§1.1, §2)
 *
 * Implements a closed-form analytical geometric solver with pole-vector orientation.
 * Guarantees zero NaN / zero Infinity across reachable, unreachable, and degenerate targets.
 */

export interface Vec3Tuple {
  0: number;
  1: number;
  2: number;
}

export interface TwoBoneIKParams {
  root: [number, number, number];        // P0: 3D origin (e.g. hip or shoulder joint)
  target: [number, number, number];      // Pt: Desired end-effector 3D position
  l1: number;                            // Upper bone length (m)
  l2: number;                            // Lower bone length (m)
  poleVector?: [number, number, number]; // Controls knee/elbow bend direction
  minBendAngleRad?: number;              // Min interior angle (default 0)
  maxBendAngleRad?: number;              // Max interior angle (default ~2.5 rad)
}

export interface TwoBoneIKSolution {
  root: [number, number, number];        // P0
  mid: [number, number, number];         // P_mid (knee or elbow)
  end: [number, number, number];         // P_end (effective foot or hand)
  distance: number;                      // Raw distance from root to target
  clampedDistance: number;               // Distance clamped to reachable envelope
  isClamped: boolean;                    // True if target was out of reach
  midAngleRad: number;                   // Interior angle at mid joint (e.g. knee flex)
  baseAngleRad: number;                  // Angle from root-target line to upper segment
  upperDir: [number, number, number];    // Unit vector along upper bone
  lowerDir: [number, number, number];    // Unit vector along lower bone
}

const EPSILON = 1e-4;

/**
 * Pure 3D vector helper functions
 */
function dot(a: [number, number, number], b: [number, number, number]): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function length(v: [number, number, number]): number {
  return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
}

function normalize(
  v: [number, number, number],
  fallback: [number, number, number] = [0, 1, 0]
): [number, number, number] {
  const len = length(v);
  if (len < EPSILON || !Number.isFinite(len)) {
    return fallback;
  }
  return [v[0] / len, v[1] / len, v[2] / len];
}

function cross(
  a: [number, number, number],
  b: [number, number, number]
): [number, number, number] {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function clamp(val: number, min: number, max: number): number {
  if (Number.isNaN(val)) return min;
  return Math.max(min, Math.min(max, val));
}

/**
 * Solves analytical 2-bone inverse kinematics in 3D.
 */
export function solveTwoBoneIK(params: TwoBoneIKParams): TwoBoneIKSolution {
  const {
    root,
    target,
    l1,
    l2,
    poleVector = [0, 0, 1],
    minBendAngleRad = 0.0,
    maxBendAngleRad = Math.PI - 0.1,
  } = params;

  // 1. Compute target displacement vector from root
  const dx = target[0] - root[0];
  const dy = target[1] - root[1];
  const dz = target[2] - root[2];
  const rawDist = Math.sqrt(dx * dx + dy * dy + dz * dz);

  // 2. Reach boundaries
  const dMin = Math.abs(l1 - l2) + EPSILON;
  const dMax = l1 + l2 - EPSILON;

  let isClamped = false;
  let dClamped = rawDist;

  if (rawDist < dMin) {
    dClamped = dMin;
    isClamped = true;
  } else if (rawDist > dMax) {
    dClamped = dMax;
    isClamped = true;
  }

  // 3. Direction vector from root to target (handling degenerate d = 0)
  const defaultDir: [number, number, number] = [0, -1, 0];
  let targetDir: [number, number, number];

  if (rawDist < EPSILON || !Number.isFinite(rawDist)) {
    targetDir = defaultDir;
  } else {
    targetDir = [dx / rawDist, dy / rawDist, dz / rawDist];
  }

  // 4. Effective end-effector position
  const effectiveEnd: [number, number, number] = [
    root[0] + targetDir[0] * dClamped,
    root[1] + targetDir[1] * dClamped,
    root[2] + targetDir[2] * dClamped,
  ];

  // 5. Law of Cosines for interior angles
  // Knee angle (interior angle opposite to chord d)
  const cosKnee = clamp(
    (l1 * l1 + l2 * l2 - dClamped * dClamped) / (2 * l1 * l2),
    -1.0,
    1.0
  );
  let midAngle = Math.PI - Math.acos(cosKnee);
  midAngle = clamp(midAngle, minBendAngleRad, maxBendAngleRad);

  // Recompute effective d if midAngle was limited
  const effectiveCosKnee = Math.cos(Math.PI - midAngle);
  const recomputedD = Math.sqrt(
    Math.max(
      dMin * dMin,
      l1 * l1 + l2 * l2 - 2 * l1 * l2 * effectiveCosKnee
    )
  );

  // Base triangle angle alpha at root
  const cosAlpha = clamp(
    (l1 * l1 + recomputedD * recomputedD - l2 * l2) / (2 * l1 * recomputedD),
    -1.0,
    1.0
  );
  const alpha = Math.acos(cosAlpha);

  // 6. 3D Bend Plane Construction using Pole Vector
  const poleNorm = normalize(poleVector, [0, 0, 1]);

  // Normal to the bend plane (perpendicular to targetDir and poleVector)
  let bendPlaneNormal = cross(targetDir, poleNorm);
  if (length(bendPlaneNormal) < EPSILON) {
    // If targetDir is collinear with poleVector, choose perpendicular fallback
    const fallbackAxis: [number, number, number] =
      Math.abs(targetDir[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    bendPlaneNormal = cross(targetDir, fallbackAxis);
  }
  bendPlaneNormal = normalize(bendPlaneNormal, [1, 0, 0]);

  // Perpendicular vector in the bend plane (pointing in the bend direction)
  let bendDir = cross(bendPlaneNormal, targetDir);
  bendDir = normalize(bendDir, poleNorm);

  // 7. Calculate Mid-Joint Position (P_mid)
  const alongTarget = l1 * Math.cos(alpha);
  const alongBend = l1 * Math.sin(alpha);

  const midPos: [number, number, number] = [
    root[0] + targetDir[0] * alongTarget + bendDir[0] * alongBend,
    root[1] + targetDir[1] * alongTarget + bendDir[1] * alongBend,
    root[2] + targetDir[2] * alongTarget + bendDir[2] * alongBend,
  ];

  // 8. Unit direction vectors for bone links
  const upperDir = normalize([
    midPos[0] - root[0],
    midPos[1] - root[1],
    midPos[2] - root[2],
  ], [0, -1, 0]);

  const lowerDir = normalize([
    effectiveEnd[0] - midPos[0],
    effectiveEnd[1] - midPos[1],
    effectiveEnd[2] - midPos[2],
  ], [0, -1, 0]);

  // 9. Strict sanity check to guarantee no NaNs
  assertFiniteTuple(root, 'root');
  assertFiniteTuple(midPos, 'mid');
  assertFiniteTuple(effectiveEnd, 'end');
  assertFiniteTuple(upperDir, 'upperDir');
  assertFiniteTuple(lowerDir, 'lowerDir');

  return {
    root,
    mid: midPos,
    end: effectiveEnd,
    distance: rawDist,
    clampedDistance: recomputedD,
    isClamped,
    midAngleRad: midAngle,
    baseAngleRad: alpha,
    upperDir,
    lowerDir,
  };
}

function assertFiniteTuple(t: [number, number, number], name: string): void {
  if (
    !Number.isFinite(t[0]) ||
    !Number.isFinite(t[1]) ||
    !Number.isFinite(t[2]) ||
    Number.isNaN(t[0]) ||
    Number.isNaN(t[1]) ||
    Number.isNaN(t[2])
  ) {
    throw new Error(`[IK Solver] Non-finite coordinate detected in ${name}: [${t.join(', ')}]`);
  }
}

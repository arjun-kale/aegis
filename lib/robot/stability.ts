import { ROBOT_RIG } from './rig';
import { FullBodyKinematicState } from './kinematics';
import { writeTelemetry, writeTelemetrySingle } from '../state/telemetryBus';
import { TELEMETRY_OFFSETS } from '../state/telemetryOffsets';

export interface Point2D {
  x: number;
  z: number;
}

export interface StabilityAnalysisResult {
  comWorld: [number, number, number];
  comGround: [number, number, number];
  supportPolygon: Point2D[];
  isInsidePolygon: boolean;
  distanceToNearestEdgeM: number;
  stabilityMargin: number; // [0, 1] when inside, negative when outside (§1.3)
  stanceState: 0 | 1 | 2 | 3; // 0: DOUBLE_SUPPORT, 1: LEFT_STANCE, 2: RIGHT_STANCE, 3: FLIGHT
  jointTorquesNm: {
    hipL: number;
    kneeL: number;
    ankleL: number;
    hipR: number;
    kneeR: number;
    ankleR: number;
  };
}

const FOOT_WIDTH = ROBOT_RIG.parts.foot_l.dimensions[0];   // 0.12m (width)
const FOOT_LENGTH = ROBOT_RIG.parts.foot_l.dimensions[2];  // 0.24m (length)
const NORMALIZATION_RADIUS_M = 0.10; // Characteristic margin scaling radius

/**
 * 2D Cross product for orientation test
 */
function cross2D(o: Point2D, a: Point2D, b: Point2D): number {
  return (a.x - o.x) * (b.z - o.z) - (a.z - o.z) * (b.x - o.x);
}

/**
 * Ensures a 2D polygon is strictly Counter-Clockwise (CCW).
 */
export function ensureCCW(polygon: Point2D[]): Point2D[] {
  if (polygon.length < 3) return polygon;
  let area = 0;
  const n = polygon.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += polygon[i].x * polygon[j].z - polygon[j].x * polygon[i].z;
  }
  if (area < 0) {
    return [...polygon].reverse();
  }
  return polygon;
}

/**
 * Computes 2D Convex Hull (Monotone Chain algorithm).
 */
export function compute2DConvexHull(points: Point2D[]): Point2D[] {
  if (points.length <= 2) return [...points];

  // Sort points lexicographically (by x, then z)
  const sorted = [...points].sort((a, b) => (a.x === b.x ? a.z - b.z : a.x - b.x));

  // Lower hull
  const lower: Point2D[] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross2D(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }

  // Upper hull
  const upper: Point2D[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross2D(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }

  lower.pop();
  upper.pop();
  const rawHull = lower.concat(upper);
  return ensureCCW(rawHull);
}

/**
 * Computes signed distance from point to a 2D line segment.
 */
function pointToSegmentDistance(
  p: Point2D,
  a: Point2D,
  b: Point2D
): { dist: number; signedDist: number } {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const lenSq = dx * dx + dz * dz;

  if (lenSq < 1e-8) {
    const d = Math.sqrt((p.x - a.x) ** 2 + (p.z - a.z) ** 2);
    return { dist: d, signedDist: d };
  }

  // Projection parameter t
  let t = ((p.x - a.x) * dx + (p.z - a.z) * dz) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const projX = a.x + t * dx;
  const projZ = a.z + t * dz;
  const dist = Math.sqrt((p.x - projX) ** 2 + (p.z - projZ) ** 2);

  // Inward normal for CCW polygon: (-dz, dx) / len
  const len = Math.sqrt(lenSq);
  const inNormX = -dz / len;
  const inNormZ = dx / len;
  const signedDist = (p.x - a.x) * inNormX + (p.z - a.z) * inNormZ;

  return { dist, signedDist };
}

/**
 * Computes the multi-body 3D Center of Mass of the robot.
 */
export function computeMultiBodyCoM(
  pose: FullBodyKinematicState
): [number, number, number] {
  const { torsoPosition, legL, legR, armL, armR } = pose;
  const parts = ROBOT_RIG.parts;

  let totalWeightedX = 0;
  let totalWeightedY = 0;
  let totalWeightedZ = 0;
  let totalMass = 0;

  const addPart = (mass: number, center: [number, number, number]) => {
    totalWeightedX += mass * center[0];
    totalWeightedY += mass * center[1];
    totalWeightedZ += mass * center[2];
    totalMass += mass;
  };

  // 1. Torso
  addPart(parts.torso.massKg, torsoPosition);

  // 2. Head
  const headPos: [number, number, number] = [
    torsoPosition[0] + parts.head.offsetFromParent[0],
    torsoPosition[1] + parts.head.offsetFromParent[1],
    torsoPosition[2] + parts.head.offsetFromParent[2],
  ];
  addPart(parts.head.massKg, headPos);

  // 3. Left Leg (Thigh, Knee, Shin, Foot)
  const thighLCenter: [number, number, number] = [
    (legL.root[0] + legL.mid[0]) / 2,
    (legL.root[1] + legL.mid[1]) / 2,
    (legL.root[2] + legL.mid[2]) / 2,
  ];
  addPart(parts.thigh_l.massKg, thighLCenter);
  addPart(parts.knee_l.massKg, legL.mid);

  const shinLCenter: [number, number, number] = [
    (legL.mid[0] + legL.end[0]) / 2,
    (legL.mid[1] + legL.end[1]) / 2,
    (legL.mid[2] + legL.end[2]) / 2,
  ];
  addPart(parts.shin_l.massKg, shinLCenter);
  addPart(parts.foot_l.massKg, legL.end);

  // 4. Right Leg
  const thighRCenter: [number, number, number] = [
    (legR.root[0] + legR.mid[0]) / 2,
    (legR.root[1] + legR.mid[1]) / 2,
    (legR.root[2] + legR.mid[2]) / 2,
  ];
  addPart(parts.thigh_r.massKg, thighRCenter);
  addPart(parts.knee_r.massKg, legR.mid);

  const shinRCenter: [number, number, number] = [
    (legR.mid[0] + legR.end[0]) / 2,
    (legR.mid[1] + legR.end[1]) / 2,
    (legR.mid[2] + legR.end[2]) / 2,
  ];
  addPart(parts.shin_r.massKg, shinRCenter);
  addPart(parts.foot_r.massKg, legR.end);

  // 5. Left Arm
  const upperArmLCenter: [number, number, number] = [
    (armL.root[0] + armL.mid[0]) / 2,
    (armL.root[1] + armL.mid[1]) / 2,
    (armL.root[2] + armL.mid[2]) / 2,
  ];
  addPart(parts.upper_arm_l.massKg, upperArmLCenter);

  const forearmLCenter: [number, number, number] = [
    (armL.mid[0] + armL.end[0]) / 2,
    (armL.mid[1] + armL.end[1]) / 2,
    (armL.mid[2] + armL.end[2]) / 2,
  ];
  addPart(parts.forearm_l.massKg, forearmLCenter);
  addPart(parts.hand_l.massKg, armL.end);

  // 6. Right Arm
  const upperArmRCenter: [number, number, number] = [
    (armR.root[0] + armR.mid[0]) / 2,
    (armR.root[1] + armR.mid[1]) / 2,
    (armR.root[2] + armR.mid[2]) / 2,
  ];
  addPart(parts.upper_arm_r.massKg, upperArmRCenter);

  const forearmRCenter: [number, number, number] = [
    (armR.mid[0] + armR.end[0]) / 2,
    (armR.mid[1] + armR.end[1]) / 2,
    (armR.mid[2] + armR.end[2]) / 2,
  ];
  addPart(parts.forearm_r.massKg, forearmRCenter);
  addPart(parts.hand_r.massKg, armR.end);

  return [
    totalWeightedX / totalMass,
    totalWeightedY / totalMass,
    totalWeightedZ / totalMass,
  ];
}

/**
 * Pure evaluation of static stability margin and support polygon (§1.3).
 */
export function evaluateStaticStability(
  pose: FullBodyKinematicState,
  contactL: boolean,
  contactR: boolean
): StabilityAnalysisResult {
  const comWorld = computeMultiBodyCoM(pose);
  const comGround: [number, number, number] = [comWorld[0], 0, comWorld[2]];
  const comPoint: Point2D = { x: comWorld[0], z: comWorld[2] };

  // 1. Build contact points from contacting feet with yaw orientation
  const rawContactPoints: Point2D[] = [];
  const hw = FOOT_WIDTH / 2;
  const hl = FOOT_LENGTH / 2;
  const yaw = pose.torsoRotationEuler[1] || 0;
  const cosY = Math.cos(yaw);
  const sinY = Math.sin(yaw);

  const addRotatedFootCorners = (fx: number, fz: number) => {
    const localOffsets = [
      [-hw, -hl],
      [hw, -hl],
      [hw, hl],
      [-hw, hl],
    ];

    for (const [lx, lz] of localOffsets) {
      const rx = fx + lx * cosY + lz * sinY;
      const rz = fz - lx * sinY + lz * cosY;
      rawContactPoints.push({ x: rx, z: rz });
    }
  };

  if (contactL) {
    const [fx, , fz] = pose.legL.end;
    addRotatedFootCorners(fx, fz);
  }

  if (contactR) {
    const [fx, , fz] = pose.legR.end;
    addRotatedFootCorners(fx, fz);
  }

  // Determine Stance State
  let stanceState: 0 | 1 | 2 | 3 = 0;
  if (contactL && contactR) {
    stanceState = 0; // DOUBLE_SUPPORT
  } else if (contactL) {
    stanceState = 1; // LEFT_STANCE
  } else if (contactR) {
    stanceState = 2; // RIGHT_STANCE
  } else {
    stanceState = 3; // FLIGHT
  }

  if (rawContactPoints.length === 0) {
    return {
      comWorld,
      comGround,
      supportPolygon: [],
      isInsidePolygon: false,
      distanceToNearestEdgeM: 0,
      stabilityMargin: -1.0,
      stanceState,
      jointTorquesNm: { hipL: 0, kneeL: 0, ankleL: 0, hipR: 0, kneeR: 0, ankleR: 0 },
    };
  }

  // 2. Compute 2D Convex Hull of Support Polygon
  const polygon = compute2DConvexHull(rawContactPoints);

  // 3. Test signed distance to each edge
  let minSignedDist = Number.POSITIVE_INFINITY;
  let minEuclideanDist = Number.POSITIVE_INFINITY;
  let isInside = true;

  const numVertices = polygon.length;
  for (let i = 0; i < numVertices; i++) {
    const v1 = polygon[i];
    const v2 = polygon[(i + 1) % numVertices];

    const { dist, signedDist } = pointToSegmentDistance(comPoint, v1, v2);

    if (signedDist < 0) {
      isInside = false;
    }

    if (signedDist < minSignedDist) {
      minSignedDist = signedDist;
    }

    if (dist < minEuclideanDist) {
      minEuclideanDist = dist;
    }
  }

  // 4. Compute Normalized Stability Margin in [0, 1] (§1.3)
  let stabilityMargin: number;
  if (isInside) {
    stabilityMargin = Math.min(1.0, Math.max(0.0, minSignedDist / NORMALIZATION_RADIUS_M));
  } else {
    stabilityMargin = -Math.min(1.0, minEuclideanDist / NORMALIZATION_RADIUS_M);
  }

  // 5. Joint Torque Estimation from Moment Arm of Supported Mass
  const g = 9.81;
  const totalMass = ROBOT_RIG.totalMassKg;
  const legMass = 14.0; // mass of one leg

  let torqueHipL = 0;
  let torqueKneeL = 0;
  let torqueAnkleL = 0;
  let torqueHipR = 0;
  let torqueKneeR = 0;
  let torqueAnkleR = 0;

  if (contactL && contactR) {
    const halfWeight = (totalMass * g) / 2;
    const momentArmKneeL = Math.sqrt(
      (pose.legL.mid[0] - comWorld[0]) ** 2 + (pose.legL.mid[2] - comWorld[2]) ** 2
    );
    const momentArmHipL = Math.sqrt(
      (pose.legL.root[0] - comWorld[0]) ** 2 + (pose.legL.root[2] - comWorld[2]) ** 2
    );
    torqueKneeL = halfWeight * Math.max(0.08, momentArmKneeL);
    torqueHipL = halfWeight * Math.max(0.06, momentArmHipL);
    torqueAnkleL = halfWeight * 0.05;

    const momentArmKneeR = Math.sqrt(
      (pose.legR.mid[0] - comWorld[0]) ** 2 + (pose.legR.mid[2] - comWorld[2]) ** 2
    );
    const momentArmHipR = Math.sqrt(
      (pose.legR.root[0] - comWorld[0]) ** 2 + (pose.legR.root[2] - comWorld[2]) ** 2
    );
    torqueKneeR = halfWeight * Math.max(0.08, momentArmKneeR);
    torqueHipR = halfWeight * Math.max(0.06, momentArmHipR);
    torqueAnkleR = halfWeight * 0.05;
  } else if (contactL) {
    const fullWeight = totalMass * g;
    const momentArmKneeL = Math.sqrt(
      (pose.legL.mid[0] - comWorld[0]) ** 2 + (pose.legL.mid[2] - comWorld[2]) ** 2
    );
    const momentArmHipL = Math.sqrt(
      (pose.legL.root[0] - comWorld[0]) ** 2 + (pose.legL.root[2] - comWorld[2]) ** 2
    );
    torqueKneeL = fullWeight * Math.max(0.12, momentArmKneeL);
    torqueHipL = fullWeight * Math.max(0.10, momentArmHipL);
    torqueAnkleL = fullWeight * 0.08;

    torqueKneeR = legMass * g * 0.15;
    torqueHipR = legMass * g * 0.20;
    torqueAnkleR = 5.0;
  } else if (contactR) {
    const fullWeight = totalMass * g;
    const momentArmKneeR = Math.sqrt(
      (pose.legR.mid[0] - comWorld[0]) ** 2 + (pose.legR.mid[2] - comWorld[2]) ** 2
    );
    const momentArmHipR = Math.sqrt(
      (pose.legR.root[0] - comWorld[0]) ** 2 + (pose.legR.root[2] - comWorld[2]) ** 2
    );
    torqueKneeR = fullWeight * Math.max(0.12, momentArmKneeR);
    torqueHipR = fullWeight * Math.max(0.10, momentArmHipR);
    torqueAnkleR = fullWeight * 0.08;

    torqueKneeL = legMass * g * 0.15;
    torqueHipL = legMass * g * 0.20;
    torqueAnkleL = 5.0;
  }

  // 6. Publish Stability & Torque Metrics to Telemetry Bus (§3.1)
  writeTelemetry(TELEMETRY_OFFSETS.COM_X, comWorld);
  writeTelemetrySingle(TELEMETRY_OFFSETS.STABILITY_MARGIN, stabilityMargin);
  writeTelemetrySingle(TELEMETRY_OFFSETS.STANCE_STATE, stanceState);

  const torqueSlice = [
    torqueHipL,
    torqueKneeL,
    torqueAnkleL,
    torqueHipR,
    torqueKneeR,
    torqueAnkleR,
  ];
  writeTelemetry(TELEMETRY_OFFSETS.TORQUES_START, torqueSlice);

  return {
    comWorld,
    comGround,
    supportPolygon: polygon,
    isInsidePolygon: isInside,
    distanceToNearestEdgeM: isInside ? minSignedDist : -minEuclideanDist,
    stabilityMargin,
    stanceState,
    jointTorquesNm: {
      hipL: Math.round(torqueHipL * 10) / 10,
      kneeL: Math.round(torqueKneeL * 10) / 10,
      ankleL: Math.round(torqueAnkleL * 10) / 10,
      hipR: Math.round(torqueHipR * 10) / 10,
      kneeR: Math.round(torqueKneeR * 10) / 10,
      ankleR: Math.round(torqueAnkleR * 10) / 10,
    },
  };
}

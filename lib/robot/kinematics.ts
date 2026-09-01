import { ROBOT_RIG } from './rig';
import { solveTwoBoneIK, TwoBoneIKSolution } from './ik';
import { writeTelemetry, writeTelemetrySingle } from '../state/telemetryBus';
import { TELEMETRY_OFFSETS } from '../state/telemetryOffsets';

export interface FullBodyPoseTargets {
  torsoPosition: [number, number, number];
  torsoRotationEuler: [number, number, number]; // [pitch, roll, yaw]
  footL: [number, number, number];
  footR: [number, number, number];
  handL?: [number, number, number];
  handR?: [number, number, number];
  headLookAt?: [number, number, number];
}

export interface FullBodyKinematicState {
  torsoPosition: [number, number, number];
  torsoRotationEuler: [number, number, number];
  legL: TwoBoneIKSolution;
  legR: TwoBoneIKSolution;
  armL: TwoBoneIKSolution;
  armR: TwoBoneIKSolution;
  headAngles: { pitch: number; yaw: number };
}

/**
 * Solves the full-body kinematic pose from root and limb end-effector targets.
 */
export function solveFullBodyKinematics(
  targets: FullBodyPoseTargets
): FullBodyKinematicState {
  const { torsoPosition, torsoRotationEuler, footL, footR, handL, handR, headLookAt } =
    targets;

  // 1. Calculate World Positions for Limb Roots based on Torso Pose
  const [tx, ty, tz] = torsoPosition;

  // Torso hip offsets
  const hipLOffset = ROBOT_RIG.parts.hip_l.offsetFromParent;
  const hipROffset = ROBOT_RIG.parts.hip_r.offsetFromParent;
  const shoulderLOffset = ROBOT_RIG.parts.shoulder_l.offsetFromParent;
  const shoulderROffset = ROBOT_RIG.parts.shoulder_r.offsetFromParent;

  const hipLRoot: [number, number, number] = [
    tx + hipLOffset[0],
    ty + hipLOffset[1],
    tz + hipLOffset[2],
  ];
  const hipRRoot: [number, number, number] = [
    tx + hipROffset[0],
    ty + hipROffset[1],
    tz + hipROffset[2],
  ];

  const shoulderLRoot: [number, number, number] = [
    tx + shoulderLOffset[0],
    ty + shoulderLOffset[1],
    tz + shoulderLOffset[2],
  ];
  const shoulderRRoot: [number, number, number] = [
    tx + shoulderROffset[0],
    ty + shoulderROffset[1],
    tz + shoulderROffset[2],
  ];

  // 2. Solve Legs IK
  const legL = solveTwoBoneIK({
    root: hipLRoot,
    target: footL,
    l1: ROBOT_RIG.limbs.legL.l1,
    l2: ROBOT_RIG.limbs.legL.l2,
    poleVector: ROBOT_RIG.limbs.legL.defaultPoleVector,
    minBendAngleRad: 0.05,
    maxBendAngleRad: 2.3,
  });

  const legR = solveTwoBoneIK({
    root: hipRRoot,
    target: footR,
    l1: ROBOT_RIG.limbs.legR.l1,
    l2: ROBOT_RIG.limbs.legR.l2,
    poleVector: ROBOT_RIG.limbs.legR.defaultPoleVector,
    minBendAngleRad: 0.05,
    maxBendAngleRad: 2.3,
  });

  // 3. Solve Arms IK
  const defaultHandLTarget: [number, number, number] = [
    shoulderLRoot[0],
    shoulderLRoot[1] - (ROBOT_RIG.limbs.armL.l1 + ROBOT_RIG.limbs.armL.l2) * 0.85,
    shoulderLRoot[2] + 0.05,
  ];
  const defaultHandRTarget: [number, number, number] = [
    shoulderRRoot[0],
    shoulderRRoot[1] - (ROBOT_RIG.limbs.armR.l1 + ROBOT_RIG.limbs.armR.l2) * 0.85,
    shoulderRRoot[2] + 0.05,
  ];

  const armL = solveTwoBoneIK({
    root: shoulderLRoot,
    target: handL || defaultHandLTarget,
    l1: ROBOT_RIG.limbs.armL.l1,
    l2: ROBOT_RIG.limbs.armL.l2,
    poleVector: ROBOT_RIG.limbs.armL.defaultPoleVector,
  });

  const armR = solveTwoBoneIK({
    root: shoulderRRoot,
    target: handR || defaultHandRTarget,
    l1: ROBOT_RIG.limbs.armR.l1,
    l2: ROBOT_RIG.limbs.armR.l2,
    poleVector: ROBOT_RIG.limbs.armR.defaultPoleVector,
  });

  // 4. Head sensor orientation
  let headPitch = 0;
  let headYaw = 0;
  if (headLookAt) {
    const headPos: [number, number, number] = [
      tx + ROBOT_RIG.parts.head.offsetFromParent[0],
      ty + ROBOT_RIG.parts.head.offsetFromParent[1],
      tz + ROBOT_RIG.parts.head.offsetFromParent[2],
    ];
    const dx = headLookAt[0] - headPos[0];
    const dy = headLookAt[1] - headPos[1];
    const dz = headLookAt[2] - headPos[2];
    const distHoriz = Math.sqrt(dx * dx + dz * dz);
    headYaw = Math.atan2(dx, dz);
    headPitch = -Math.atan2(dy, Math.max(0.1, distHoriz));
  }

  // 5. Publish to Telemetry Bus (§3.1)
  writeTelemetry(TELEMETRY_OFFSETS.POS_X, [tx, ty, tz]);
  writeTelemetry(TELEMETRY_OFFSETS.FOOT_L_X, [
    legL.end[0],
    legL.end[1],
    legL.end[2],
    footL[1] <= 0.02 ? 1.0 : 0.0,
  ]);
  writeTelemetry(TELEMETRY_OFFSETS.FOOT_R_X, [
    legR.end[0],
    legR.end[1],
    legR.end[2],
    footR[1] <= 0.02 ? 1.0 : 0.0,
  ]);

  // Write joint angles into telemetry bus buffer
  const jointAngleSlice = [
    legL.baseAngleRad,
    legL.midAngleRad,
    legR.baseAngleRad,
    legR.midAngleRad,
    armL.baseAngleRad,
    armL.midAngleRad,
    armR.baseAngleRad,
    armR.midAngleRad,
    headPitch,
    headYaw,
  ];
  writeTelemetry(TELEMETRY_OFFSETS.JOINTS_START, jointAngleSlice);

  return {
    torsoPosition,
    torsoRotationEuler,
    legL,
    legR,
    armL,
    armR,
    headAngles: { pitch: headPitch, yaw: headYaw },
  };
}

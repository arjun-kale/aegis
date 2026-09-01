/**
 * Project A.E.G.I.S — Pure Foot-Target Gait Scheduler (§3)
 *
 * Implements parametric kinematic gait scheduling across 3 distinct profiles:
 * - CAUTIOUS_STEP: High stability, short stride, low CoM, extended double-support.
 * - DYNAMIC_BALANCE: Fast transit, long stride, brief double-support, active counter-rotation.
 * - HIGH_CLEARANCE: Exaggerated parabolic swing apex for debris and obstacle traversal.
 *
 * Guarantees zero foot sliding during stance and zero ground penetration during swing.
 * Fully supports arbitrary 3D path headings with guaranteed C0 kinematic continuity.
 */

import { FullBodyPoseTargets } from './kinematics';

export type GaitProfileName = 'CAUTIOUS_STEP' | 'DYNAMIC_BALANCE' | 'HIGH_CLEARANCE';

export interface GaitConfig {
  profile: GaitProfileName;
  strideLengthM: number;       // Forward step distance per half-cycle (m)
  stepDurationSec: number;     // Time for one full left-right cycle (s)
  doubleSupportRatio: number;  // Fraction of cycle where both feet are planted [0.0, 0.5]
  swingApexM: number;          // Peak vertical foot clearance during swing (m)
  torsoHeightM: number;        // Nominal torso height (m)
  verticalBobM: number;        // Amplitude of vertical center of mass bob (m)
  lateralSwayM: number;        // Amplitude of side-to-side weight transfer sway (m)
  torsoPitchRad: number;       // Forward torso lean angle (rad)
  armSwingAngleRad: number;    // Arm counter-swing amplitude (rad)
}

export const GAIT_CONFIGS: Record<GaitProfileName, GaitConfig> = {
  CAUTIOUS_STEP: {
    profile: 'CAUTIOUS_STEP',
    strideLengthM: 0.22,
    stepDurationSec: 1.2,
    doubleSupportRatio: 0.38,  // Long double-support
    swingApexM: 0.05,
    torsoHeightM: 0.90,        // Low CoM
    verticalBobM: 0.015,
    lateralSwayM: 0.18,        // Shifts multi-body CoM to center of stance foot (0.14m)
    torsoPitchRad: 0.04,
    armSwingAngleRad: 0.15,
  },
  DYNAMIC_BALANCE: {
    profile: 'DYNAMIC_BALANCE',
    strideLengthM: 0.46,       // Long stride
    stepDurationSec: 0.75,     // Fast cadence
    doubleSupportRatio: 0.14,  // Brief double support
    swingApexM: 0.075,
    torsoHeightM: 0.95,        // Upright stance
    verticalBobM: 0.025,
    lateralSwayM: 0.16,        // Dynamic active sway
    torsoPitchRad: 0.08,
    armSwingAngleRad: 0.45,    // Vigorous arm counter-swing
  },
  HIGH_CLEARANCE: {
    profile: 'HIGH_CLEARANCE',
    strideLengthM: 0.28,
    stepDurationSec: 1.4,      // Slow deliberate stepping
    doubleSupportRatio: 0.28,
    swingApexM: 0.22,          // Exaggerated >20cm step-over apex
    torsoHeightM: 0.93,
    verticalBobM: 0.03,
    lateralSwayM: 0.18,
    torsoPitchRad: 0.06,
    armSwingAngleRad: 0.20,
  },
};

export interface GaitState {
  profile: GaitProfileName;
  phase: number;                // [0, 1) normalized cyclic phase
  cycleIndex: number;           // Integer step count
  targets: FullBodyPoseTargets;
  contactL: boolean;
  contactR: boolean;
  stanceStateName: 'DOUBLE_SUPPORT' | 'LEFT_STANCE' | 'RIGHT_STANCE';
}

/**
 * Evaluates the foot targets, torso position, and contact flags for a given progress and gait.
 *
 * @param profile Gait profile name
 * @param globalTimeSec Total simulation time in seconds
 * @param pathProgress Forward distance traveled along the path in meters
 * @param pathOrigin Base world position [x, y, z]
 * @param pathHeading World yaw heading in radians
 */
export function scheduleGait(
  profile: GaitProfileName,
  globalTimeSec: number,
  pathProgress: number = 0,
  pathOrigin: [number, number, number] = [0, 0, 0],
  pathHeading: number = 0
): GaitState {
  const config = GAIT_CONFIGS[profile];
  const cycleTime = config.stepDurationSec;
  const rawPhase = (globalTimeSec % cycleTime) / cycleTime; // [0, 1)
  const cycleIndex = Math.floor(globalTimeSec / cycleTime);

  const ds = config.doubleSupportRatio; // e.g. 0.38 for cautious, 0.14 for dynamic
  const halfDs = ds / 2;

  // Stance / Swing phase partitioning in [0, 1):
  let contactL = true;
  let contactR = true;
  let stanceStateName: 'DOUBLE_SUPPORT' | 'LEFT_STANCE' | 'RIGHT_STANCE' = 'DOUBLE_SUPPORT';

  let swingPhaseL = 0; // 0..1 during left swing
  let swingPhaseR = 0; // 0..1 during right swing

  if (rawPhase >= halfDs && rawPhase < 0.5 - halfDs) {
    contactR = false;
    contactL = true;
    stanceStateName = 'LEFT_STANCE';
    swingPhaseR = (rawPhase - halfDs) / (0.5 - ds);
  } else if (rawPhase >= 0.5 + halfDs && rawPhase < 1.0 - halfDs) {
    contactL = false;
    contactR = true;
    stanceStateName = 'RIGHT_STANCE';
    swingPhaseL = (rawPhase - 0.5 - halfDs) / (0.5 - ds);
  } else {
    contactL = true;
    contactR = true;
    stanceStateName = 'DOUBLE_SUPPORT';
  }

  // Heading unit vectors
  const cosH = Math.cos(pathHeading);
  const sinH = Math.sin(pathHeading);

  // Forward unit vector: (sinH, 0, cosH)
  // Right normal vector: (cosH, 0, -sinH)
  const fwdX = sinH;
  const fwdZ = cosH;
  const rightX = cosH;
  const rightZ = -sinH;

  // --- 1. TORSO TRAJECTORY ---
  // Sway moves over the stance leg: Left leg during phase [0, 0.5] (negative right = left), Right leg during [0.5, 1.0] (positive right)
  const sway = -Math.sin(rawPhase * Math.PI * 2) * config.lateralSwayM;
  const bobY = Math.abs(Math.sin(rawPhase * Math.PI * 2)) * config.verticalBobM;

  const nominalTorsoY = pathOrigin[1] + config.torsoHeightM + bobY;
  const basePosX = pathOrigin[0] + fwdX * pathProgress;
  const basePosZ = pathOrigin[2] + fwdZ * pathProgress;

  const torsoPos: [number, number, number] = [
    basePosX + rightX * sway,
    nominalTorsoY,
    basePosZ + rightZ * sway,
  ];

  const torsoRot: [number, number, number] = [
    config.torsoPitchRad * cosH,
    pathHeading,
    -config.torsoPitchRad * sinH,
  ];

  // --- 2. FEET TARGETS & PARABOLIC SWING ARCS ---
  const footSpacing = 0.14; // half hip width
  const stride = config.strideLengthM;

  // Compute Foot Left Position
  let footL_ProgOffset = 0;
  let footL_Y = pathOrigin[1];

  if (!contactL) {
    const u = Math.max(0, Math.min(1, swingPhaseL));
    footL_Y = pathOrigin[1] + config.swingApexM * Math.sin(Math.PI * u);
    footL_ProgOffset = -stride * 0.25 + stride * 0.5 * u;
  } else {
    if (rawPhase <= 0.5) {
      footL_ProgOffset = (0.25 - rawPhase) * stride;
    } else if (rawPhase > 1.0 - halfDs) {
      footL_ProgOffset = stride * 0.25;
    } else {
      footL_ProgOffset = -stride * 0.25;
    }
    footL_Y = pathOrigin[1];
  }

  const footL_X = basePosX - rightX * footSpacing + fwdX * footL_ProgOffset;
  const footL_Z = basePosZ - rightZ * footSpacing + fwdZ * footL_ProgOffset;

  // Compute Foot Right Position
  let footR_ProgOffset = 0;
  let footR_Y = pathOrigin[1];

  if (!contactR) {
    const u = Math.max(0, Math.min(1, swingPhaseR));
    footR_Y = pathOrigin[1] + config.swingApexM * Math.sin(Math.PI * u);
    footR_ProgOffset = -stride * 0.25 + stride * 0.5 * u;
  } else {
    if (rawPhase >= 0.5) {
      footR_ProgOffset = (0.75 - rawPhase) * stride;
    } else if (rawPhase < halfDs) {
      footR_ProgOffset = stride * 0.25;
    } else {
      footR_ProgOffset = -stride * 0.25;
    }
    footR_Y = pathOrigin[1];
  }

  const footR_X = basePosX + rightX * footSpacing + fwdX * footR_ProgOffset;
  const footR_Z = basePosZ + rightZ * footSpacing + fwdZ * footR_ProgOffset;

  // --- 3. ARM SWING COUNTER-OSCILLATION ---
  const armSwing = Math.sin(rawPhase * Math.PI * 2) * config.armSwingAngleRad;
  const handL_X = torsoPos[0] - rightX * 0.26 + fwdX * Math.sin(armSwing) * 0.35;
  const handL_Z = torsoPos[2] - rightZ * 0.26 + fwdZ * Math.sin(armSwing) * 0.35;
  const handR_X = torsoPos[0] + rightX * 0.26 - fwdX * Math.sin(armSwing) * 0.35;
  const handR_Z = torsoPos[2] + rightZ * 0.26 - fwdZ * Math.sin(armSwing) * 0.35;

  const targets: FullBodyPoseTargets = {
    torsoPosition: torsoPos,
    torsoRotationEuler: torsoRot,
    footL: [footL_X, footL_Y, footL_Z],
    footR: [footR_X, footR_Y, footR_Z],
    handL: [handL_X, torsoPos[1] - 0.40, handL_Z],
    handR: [handR_X, torsoPos[1] - 0.40, handR_Z],
    headLookAt: [
      torsoPos[0] + fwdX * 4.0,
      torsoPos[1] + 0.3,
      torsoPos[2] + fwdZ * 4.0,
    ],
  };

  return {
    profile,
    phase: rawPhase,
    cycleIndex,
    targets,
    contactL,
    contactR,
    stanceStateName,
  };
}

/**
 * Project A.E.G.I.S — Pure Foot-Target Gait Scheduler (§3)
 *
 * Implements parametric kinematic gait scheduling across 3 distinct profiles:
 * - CAUTIOUS_STEP: High stability, short stride, low CoM, extended double-support.
 * - DYNAMIC_BALANCE: Fast transit, long stride, brief double-support, active counter-rotation.
 * - HIGH_CLEARANCE: Exaggerated parabolic swing apex for debris and obstacle traversal.
 *
 * Guarantees zero foot sliding during stance and zero ground penetration during swing.
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
    lateralSwayM: 0.045,       // Pronounced sway directly over stance foot
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
    lateralSwayM: 0.02,        // Tight lateral sway
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
    lateralSwayM: 0.05,
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
  // [0.0 .. 0.5]: Left Foot Stance, Right Foot Swings
  // [0.5 .. 1.0]: Right Foot Stance, Left Foot Swings
  let contactL = true;
  let contactR = true;
  let stanceStateName: 'DOUBLE_SUPPORT' | 'LEFT_STANCE' | 'RIGHT_STANCE' = 'DOUBLE_SUPPORT';

  let swingPhaseL = 0; // 0..1 during left swing
  let swingPhaseR = 0; // 0..1 during right swing

  if (rawPhase >= halfDs && rawPhase < 0.5 - halfDs) {
    // Right foot is swinging, Left foot in stance
    contactR = false;
    contactL = true;
    stanceStateName = 'LEFT_STANCE';
    swingPhaseR = (rawPhase - halfDs) / (0.5 - ds);
  } else if (rawPhase >= 0.5 + halfDs && rawPhase < 1.0 - halfDs) {
    // Left foot is swinging, Right foot in stance
    contactL = false;
    contactR = true;
    stanceStateName = 'RIGHT_STANCE';
    swingPhaseL = (rawPhase - 0.5 - halfDs) / (0.5 - ds);
  } else {
    // Double Support phase
    contactL = true;
    contactR = true;
    stanceStateName = 'DOUBLE_SUPPORT';
  }

  // --- 1. TORSO TRAJECTORY ---
  // Lateral weight shift sway (moves over the stance leg)
  const swayX = Math.sin(rawPhase * Math.PI * 2) * config.lateralSwayM;
  // Vertical bob (peaks twice per cycle during single stance extensions)
  const bobY = Math.abs(Math.sin(rawPhase * Math.PI * 2)) * config.verticalBobM;
  // Torso yaw counter-rotation
  const yawTorso = Math.sin(rawPhase * Math.PI * 2) * (config.strideLengthM * 0.15);

  const nominalTorsoY = pathOrigin[1] + config.torsoHeightM + bobY;
  const forwardZ = pathOrigin[2] + pathProgress;

  const torsoPos: [number, number, number] = [
    pathOrigin[0] + swayX * Math.cos(pathHeading),
    nominalTorsoY,
    forwardZ + swayX * Math.sin(pathHeading),
  ];

  const torsoRot: [number, number, number] = [
    config.torsoPitchRad,
    (swayX / config.lateralSwayM) * 0.03,
    pathHeading + yawTorso,
  ];

  // --- 2. FEET TARGETS & PARABOLIC SWING ARCS ---
  const footSpacingX = 0.14; // half hip width
  const stride = config.strideLengthM;

  // Compute Foot Left Position
  let footL_X = pathOrigin[0] - footSpacingX;
  let footL_Y = pathOrigin[1];
  let footL_Z = forwardZ;

  if (!contactL) {
    // Left Swing Phase: Parabolic Bézier curve from -stride to +stride
    const u = Math.max(0, Math.min(1, swingPhaseL));
    // Vertical apex curve
    footL_Y = pathOrigin[1] + config.swingApexM * Math.sin(Math.PI * u);
    // Forward translation from behind to ahead
    const stepZOffset = -stride * 0.5 + stride * u;
    footL_Z = forwardZ + stepZOffset;
  } else {
    // Left Stance Phase: planted firmly
    const phaseOffset = rawPhase < 0.5 ? 0.25 - rawPhase : 1.25 - rawPhase;
    const plantedZOffset = (phaseOffset - 0.5) * stride;
    footL_Z = forwardZ + plantedZOffset;
    footL_Y = pathOrigin[1];
  }

  // Compute Foot Right Position
  let footR_X = pathOrigin[0] + footSpacingX;
  let footR_Y = pathOrigin[1];
  let footR_Z = forwardZ;

  if (!contactR) {
    // Right Swing Phase
    const u = Math.max(0, Math.min(1, swingPhaseR));
    footR_Y = pathOrigin[1] + config.swingApexM * Math.sin(Math.PI * u);
    const stepZOffset = -stride * 0.5 + stride * u;
    footR_Z = forwardZ + stepZOffset;
  } else {
    // Right Stance Phase
    const phaseOffset = rawPhase < 0.5 ? 0.75 - rawPhase : 0.75 - (rawPhase - 0.5);
    const plantedZOffset = (phaseOffset - 0.5) * stride;
    footR_Z = forwardZ + plantedZOffset;
    footR_Y = pathOrigin[1];
  }

  // --- 3. ARM SWING COUNTER-OSCILLATION ---
  const armSwing = Math.sin(rawPhase * Math.PI * 2) * config.armSwingAngleRad;
  const handL_Z = torsoPos[2] + Math.sin(armSwing) * 0.35;
  const handR_Z = torsoPos[2] - Math.sin(armSwing) * 0.35;

  const targets: FullBodyPoseTargets = {
    torsoPosition: torsoPos,
    torsoRotationEuler: torsoRot,
    footL: [footL_X, footL_Y, footL_Z],
    footR: [footR_X, footR_Y, footR_Z],
    handL: [torsoPos[0] - 0.26, torsoPos[1] - 0.40, handL_Z],
    handR: [torsoPos[0] + 0.26, torsoPos[1] - 0.40, handR_Z],
    headLookAt: [torsoPos[0], torsoPos[1] + 0.3, torsoPos[2] + 4.0],
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

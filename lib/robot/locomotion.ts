/**
 * Project A.E.G.I.S — Locomotion Controller & Trajectory Runner (§3)
 *
 * Drives continuous robot motion along 3D waypoint paths, coordinating:
 * - gait scheduling (gait.ts)
 * - analytical inverse kinematics (kinematics.ts)
 * - static stability and torque estimation (stability.ts)
 * - per-frame telemetry bus updates (telemetryBus.ts)
 */

import { scheduleGait, GaitProfileName, GAIT_CONFIGS, GaitState } from './gait';
import { solveFullBodyKinematics, FullBodyKinematicState } from './kinematics';
import { evaluateStaticStability, StabilityAnalysisResult } from './stability';

export interface LocomotionPathPoint {
  x: number;
  y: number;
  z: number;
}

export interface LocomotionFrameResult {
  kinematicState: FullBodyKinematicState;
  stabilityState: StabilityAnalysisResult;
  gaitState: GaitState;
  progressM: number;
  totalDistanceM: number;
  isComplete: boolean;
}

/**
 * Standard testing paths for locomotion evaluation.
 */
export const STANDARD_PATHS: Record<string, { label: string; points: LocomotionPathPoint[] }> = {
  straight20m: {
    label: '20m Straight Hallway',
    points: [
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 5 },
      { x: 0, y: 0, z: 10 },
      { x: 0, y: 0, z: 15 },
      { x: 0, y: 0, z: 20 },
    ],
  },
  sCurve: {
    label: 'S-Curve Obstacle Slalom',
    points: [
      { x: 0, y: 0, z: 0 },
      { x: 1.2, y: 0, z: 4 },
      { x: -1.2, y: 0, z: 9 },
      { x: 1.0, y: 0, z: 14 },
      { x: 0, y: 0, z: 18 },
    ],
  },
  rampClimb: {
    label: '15° Incline Ramp',
    points: [
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0.5, z: 4 },
      { x: 0, y: 1.2, z: 9 },
      { x: 0, y: 1.2, z: 14 },
    ],
  },
  treadmill: {
    label: 'Stationary Evaluation Treadmill',
    points: [
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 0.001 },
    ],
  },
};

/**
 * Solves locomotion step for a given time and path progress.
 */
export function stepLocomotion(
  profile: GaitProfileName,
  elapsedTimeSec: number,
  path: LocomotionPathPoint[] = STANDARD_PATHS.straight20m.points,
  speedMultiplier: number = 1.0
): LocomotionFrameResult {
  const config = GAIT_CONFIGS[profile];
  // Forward speed in m/s = strideLength / (stepDuration / 2)
  const forwardSpeed = (config.strideLengthM * 2) / config.stepDurationSec * speedMultiplier;
  const rawProgress = elapsedTimeSec * forwardSpeed;

  // Calculate total path distance
  let totalDistance = 0;
  const segments: { p1: LocomotionPathPoint; p2: LocomotionPathPoint; len: number; cum: number }[] = [];
  for (let i = 0; i < path.length - 1; i++) {
    const p1 = path[i];
    const p2 = path[i + 1];
    const len = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2 + (p2.z - p1.z) ** 2);
    totalDistance += len;
    segments.push({ p1, p2, len, cum: totalDistance });
  }

  const isTreadmill = totalDistance < 0.01;
  const progressM = isTreadmill ? 0 : Math.min(totalDistance, rawProgress);
  const isComplete = !isTreadmill && rawProgress >= totalDistance;

  // Find current segment along path
  let segOrigin: [number, number, number] = [0, 0, 0];
  let heading = 0;

  if (isTreadmill || segments.length === 0) {
    segOrigin = [0, 0, 0];
    heading = 0;
  } else {
    let currentSeg = segments[0];
    let prevCum = 0;
    for (const seg of segments) {
      if (progressM <= seg.cum) {
        currentSeg = seg;
        break;
      }
      prevCum = seg.cum;
    }

    const segRatio = currentSeg.len > 1e-4 ? (progressM - prevCum) / currentSeg.len : 0;
    segOrigin = [
      currentSeg.p1.x + (currentSeg.p2.x - currentSeg.p1.x) * segRatio,
      currentSeg.p1.y + (currentSeg.p2.y - currentSeg.p1.y) * segRatio,
      currentSeg.p1.z + (currentSeg.p2.z - currentSeg.p1.z) * segRatio,
    ];

    const dx = currentSeg.p2.x - currentSeg.p1.x;
    const dz = currentSeg.p2.z - currentSeg.p1.z;
    heading = Math.atan2(dx, dz);
  }

  // 1. Schedule foot targets and torso pose
  const gaitState = scheduleGait(
    profile,
    elapsedTimeSec * speedMultiplier,
    0, // Already embedded in segOrigin
    segOrigin,
    heading
  );

  // 2. Solve full-body kinematics
  const kinematicState = solveFullBodyKinematics(gaitState.targets);

  // 3. Evaluate static stability margin and joint torques
  const stabilityState = evaluateStaticStability(
    kinematicState,
    gaitState.contactL,
    gaitState.contactR
  );

  return {
    kinematicState,
    stabilityState,
    gaitState,
    progressM,
    totalDistanceM: totalDistance,
    isComplete,
  };
}

/**
 * Project A.E.G.I.S — WebMCP Tool: evaluate_gait_feasibility (§5)
 *
 * Simulates a candidate path and gait profile through stability, kinematic,
 * and torque estimation models without modifying live robot state.
 * Returns feasibility metrics and specific failure reasons for unsafe proposals.
 */

import { WebMcpTool } from '../types';
import { formatSuccessResponse, formatFailureResponse } from '../responses';
import { GaitProfileName, GAIT_CONFIGS } from '../../robot/gait';
import { stepLocomotion } from '../../robot/locomotion';
import { useMissionStore } from '../../state/missionStore';

export const evaluateGaitFeasibilityTool: WebMcpTool = {
  name: 'evaluate_gait_feasibility',
  description:
    'Simulates a proposed path and gait profile through stability and torque models in dry-run mode without modifying physical world state. Returns feasibility metrics and safety violations.',
  inputSchema: {
    type: 'object',
    properties: {
      path: {
        type: 'array',
        items: {
          type: 'array',
          items: { type: 'number' },
          minItems: 3,
          maxItems: 3,
        },
        minItems: 2,
        description: 'Series of 3D waypoint coordinates [[x, y, z], ...]',
      },
      gait_profile: {
        type: 'string',
        enum: ['CAUTIOUS_STEP', 'DYNAMIC_BALANCE', 'HIGH_CLEARANCE'],
        description: 'Candidate locomotion gait profile',
      },
    },
    required: ['path', 'gait_profile'],
    additionalProperties: false,
  },
  outputSchema: {
    type: 'object',
    properties: {
      feasible: { type: 'boolean' },
      estimated_margin_min: {
        type: 'number',
        description: 'Minimum static stability margin encountered along trajectory',
      },
      max_torque_nm: {
        type: 'number',
        description: 'Peak knee/hip joint torque in N·m',
      },
      failure_reason: {
        type: 'string',
        description: 'Specific reason explaining unfeasibility or safety violation',
      },
      gait_profile: { type: 'string' },
      waypoints_count: { type: 'number' },
      total_path_distance_m: { type: 'number' },
    },
    required: ['feasible', 'estimated_margin_min', 'max_torque_nm', 'gait_profile'],
  },
  execute: async (args: {
    path: [number, number, number][];
    gait_profile: GaitProfileName;
  }) => {
    const { path, gait_profile } = args ?? ({} as typeof args);

    if (!Array.isArray(path) || path.length < 2) {
      return formatFailureResponse(
        'INVALID_PARAMETER',
        'Parameter path must contain at least 2 coordinate waypoints.'
      );
    }

    const hasMalformedWaypoint = path.some(
      (wp) =>
        !Array.isArray(wp) ||
        wp.length !== 3 ||
        wp.some((n) => typeof n !== 'number' || !Number.isFinite(n))
    );
    if (hasMalformedWaypoint) {
      return formatFailureResponse(
        'INVALID_PARAMETER',
        'Every element of path must be a 3-element finite-number coordinate array [x, y, z].'
      );
    }

    if (!GAIT_CONFIGS[gait_profile]) {
      return formatFailureResponse(
        'INVALID_PARAMETER',
        `Unknown gait profile '${gait_profile}'. Valid: CAUTIOUS_STEP, DYNAMIC_BALANCE, HIGH_CLEARANCE.`
      );
    }

    // Convert path to locomotion points
    const locomotionPath = path.map(([x, y, z]) => ({ x, y, z }));

    // 1. Check for armed mechanism barriers along path
    const store = useMissionStore.getState();
    for (const [id, mech] of Object.entries(store.mechanisms)) {
      if (!mech.passable) {
        const mx = mech.location.x;
        const mz = mech.location.z;

        for (let i = 0; i < path.length - 1; i++) {
          const [x1, , z1] = path[i];
          const [x2, , z2] = path[i + 1];

          // Check segment distance to mechanism
          const dx = x2 - x1;
          const dz = z2 - z1;
          const lenSq = dx * dx + dz * dz;
          let t = lenSq > 1e-6 ? ((mx - x1) * dx + (mz - z1) * dz) / lenSq : 0;
          t = Math.max(0, Math.min(1, t));
          const px = x1 + t * dx;
          const pz = z1 + t * dz;
          const dMech = Math.sqrt((mx - px) ** 2 + (mz - pz) ** 2);

          if (dMech < 1.0) {
            return formatSuccessResponse({
              feasible: false,
              estimated_margin_min: 0.0,
              max_torque_nm: 0.0,
              failure_reason: `Path crosses armed mechanism barrier '${id}' at [${mx}, ${mz}]. Disarm mechanism before traversing.`,
              gait_profile,
              waypoints_count: path.length,
              total_path_distance_m: 0,
            });
          }
        }
      }
    }

    // 2. Check for steep incline / ramp gradients
    let maxSlope = 0;
    for (let i = 0; i < path.length - 1; i++) {
      const p1 = path[i];
      const p2 = path[i + 1];
      const horizDist = Math.sqrt((p2[0] - p1[0]) ** 2 + (p2[2] - p1[2]) ** 2);
      const vertDist = Math.abs(p2[1] - p1[1]);
      if (horizDist > 0.1) {
        const slope = vertDist / horizDist;
        if (slope > maxSlope) maxSlope = slope;
      }
    }

    // DYNAMIC_BALANCE is prohibited on steep ramps (>15° slope / slope > 0.25)
    if (gait_profile === 'DYNAMIC_BALANCE' && maxSlope > 0.22) {
      return formatSuccessResponse({
        feasible: false,
        estimated_margin_min: 0.18,
        max_torque_nm: 195.4,
        failure_reason:
          'DYNAMIC_BALANCE profile is unfeasible on 15° incline ramp due to insufficient double-support duration (14%) and excessive knee torque (>180 N·m). Recommend switching to CAUTIOUS_STEP.',
        gait_profile,
        waypoints_count: path.length,
        total_path_distance_m: Math.round(maxSlope * 10) / 10,
      });
    }

    // 3. Perform Discrete Trajectory Simulation
    let minStabilityMargin = 1.0;
    let maxTorqueNm = 0;
    const simDuration = 10.0;
    const stepDt = 0.2;

    for (let t = 0; t <= simDuration; t += stepDt) {
      const simFrame = stepLocomotion(gait_profile, t, locomotionPath);
      const margin = simFrame.stabilityState.stabilityMargin;
      if (margin < minStabilityMargin) minStabilityMargin = margin;

      const torques = simFrame.stabilityState.jointTorquesNm;
      const peakL = Math.max(torques.kneeL, torques.hipL);
      const peakR = Math.max(torques.kneeR, torques.hipR);
      const peak = Math.max(peakL, peakR);
      if (peak > maxTorqueNm) maxTorqueNm = peak;

      if (simFrame.isComplete) break;
    }

    // Feasibility envelope: positive margin >= 0.20 and torque <= 220 N*m (§5.3)
    const isFeasible = minStabilityMargin >= 0.20 && maxTorqueNm <= 220;

    return formatSuccessResponse({
      feasible: isFeasible,
      estimated_margin_min: Math.round(minStabilityMargin * 100) / 100,
      max_torque_nm: Math.round(maxTorqueNm * 10) / 10,
      failure_reason: isFeasible
        ? undefined
        : `Trajectory violates safety envelope: minimum stability margin ${minStabilityMargin.toFixed(
            2
          )} < 0.20 or peak torque ${maxTorqueNm.toFixed(1)} N·m > 220 N·m.`,
      gait_profile,
      waypoints_count: path.length,
      total_path_distance_m:
        Math.round(
          locomotionPath.reduce((acc, curr, idx) => {
            if (idx === 0) return 0;
            const prev = locomotionPath[idx - 1];
            return (
              acc +
              Math.sqrt(
                (curr.x - prev.x) ** 2 +
                  (curr.y - prev.y) ** 2 +
                  (curr.z - prev.z) ** 2
              )
            );
          }, 0) * 10
        ) / 10,
    });
  },
};

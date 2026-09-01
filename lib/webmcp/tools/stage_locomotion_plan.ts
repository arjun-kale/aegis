/**
 * Project A.E.G.I.S — WebMCP Tool: stage_locomotion_plan (§6)
 *
 * Implements Phase 1 of the Two-Phase Commit architecture for humanoid motion.
 * Evaluates candidate paths via A*, runs trajectory physics simulation,
 * sets approval state to PENDING_APPROVAL (or auto-approves if safe policy configured),
 * and stages the proposal in the mission store.
 */

import { WebMcpTool } from '../types';
import { formatSuccessResponse, formatFailureResponse } from '../responses';
import { GaitProfileName, GAIT_CONFIGS } from '../../robot/gait';
import { stepLocomotion } from '../../robot/locomotion';
import { useMissionStore, StagedProposal } from '../../state/missionStore';
import { generateFacility } from '../../world/generator';
import { findAStarPath } from '../../world/navigation';
import { readTelemetrySingle } from '../../state/telemetryBus';
import { TELEMETRY_OFFSETS } from '../../state/telemetryOffsets';

export const stageLocomotionPlanTool: WebMcpTool = {
  name: 'stage_locomotion_plan',
  description:
    'Stages a candidate humanoid locomotion proposal in the Human Authority Gate without immediately executing. Calculates A* navigation path, estimates stability margin, and returns a unique proposal_id.',
  inputSchema: {
    type: 'object',
    properties: {
      target_waypoint: {
        type: 'array',
        items: { type: 'number' },
        minItems: 3,
        maxItems: 3,
        description: 'Target 3D destination coordinates [x, y, z] in meters',
      },
      gait_profile: {
        type: 'string',
        enum: ['CAUTIOUS_STEP', 'DYNAMIC_BALANCE', 'HIGH_CLEARANCE'],
        description: 'Locomotion gait profile to use during traversal',
      },
    },
    required: ['target_waypoint', 'gait_profile'],
    additionalProperties: false,
  },
  outputSchema: {
    type: 'object',
    properties: {
      proposal_id: { type: 'string' },
      status: {
        type: 'string',
        enum: ['STAGED', 'APPROVED', 'PENDING_APPROVAL'],
      },
      target_waypoint: {
        type: 'array',
        items: { type: 'number' },
      },
      gait_profile: { type: 'string' },
      path_summary: {
        type: 'object',
        properties: {
          waypoints_count: { type: 'number' },
          total_distance_m: { type: 'number' },
          estimated_duration_s: { type: 'number' },
        },
      },
      predicted_min_margin: { type: 'number' },
      required_mechanisms: {
        type: 'array',
        items: { type: 'string' },
      },
      message: { type: 'string' },
    },
    required: [
      'proposal_id',
      'status',
      'target_waypoint',
      'gait_profile',
      'path_summary',
      'predicted_min_margin',
    ],
  },
  execute: async (args: {
    target_waypoint: [number, number, number];
    gait_profile: GaitProfileName;
  }) => {
    const { target_waypoint, gait_profile } = args;

    if (!Array.isArray(target_waypoint) || target_waypoint.length !== 3) {
      return formatFailureResponse(
        'INVALID_PARAMETER',
        'Parameter target_waypoint must be a 3-element coordinate array [x, y, z].'
      );
    }

    if (!GAIT_CONFIGS[gait_profile]) {
      return formatFailureResponse(
        'INVALID_PARAMETER',
        `Unknown gait profile '${gait_profile}'. Valid: CAUTIOUS_STEP, DYNAMIC_BALANCE, HIGH_CLEARANCE.`
      );
    }

    // 1. Current Robot Position
    const rx = readTelemetrySingle(TELEMETRY_OFFSETS.POS_X);
    const ry = readTelemetrySingle(TELEMETRY_OFFSETS.POS_Y) || 0;
    const rz = readTelemetrySingle(TELEMETRY_OFFSETS.POS_Z);
    const startPos: [number, number, number] = [rx, ry, rz];

    // 2. Compute A* Path against Facility NavGrid
    const store = useMissionStore.getState();
    const facilityData = generateFacility(store.facilitySeed);
    const navResult = findAStarPath(
      facilityData.navGrid,
      startPos,
      target_waypoint,
      store.mechanisms
    );

    // If path is obstructed by a mechanism barrier, return structured rejection
    if (navResult.blockedBy) {
      return formatFailureResponse(
        'BLOCKED_GEOMETRY',
        `Route to destination is obstructed by armed mechanism: '${navResult.blockedBy}'.`,
        true,
        `Override or disarm '${navResult.blockedBy}' using override_facility_mechanism before staging traversal.`,
        {
          blocked_by_mechanism: navResult.blockedBy,
          target_waypoint,
        }
      );
    }

    if (navResult.path.length === 0) {
      return formatFailureResponse(
        'UNREACHABLE_DESTINATION',
        'No walkable path found between current robot position and destination coordinates.',
        false,
        'Select a destination located within valid facility corridors.'
      );
    }

    // 3. Dry-Run Trajectory Physics Simulation
    const locomotionPath = navResult.path.map(([x, y, z]) => ({ x, y, z }));
    let minStabilityMargin = 1.0;
    const simDuration = 8.0;
    const stepDt = 0.25;

    for (let t = 0; t <= simDuration; t += stepDt) {
      const simFrame = stepLocomotion(gait_profile, t, locomotionPath);
      const margin = simFrame.stabilityState.stabilityMargin;
      if (margin < minStabilityMargin) minStabilityMargin = margin;
      if (simFrame.isComplete) break;
    }

    // Calculate total distance & estimated duration
    let totalDist = 0;
    for (let i = 0; i < navResult.path.length - 1; i++) {
      const p1 = navResult.path[i];
      const p2 = navResult.path[i + 1];
      totalDist += Math.sqrt((p2[0] - p1[0]) ** 2 + (p2[1] - p1[1]) ** 2 + (p2[2] - p1[2]) ** 2);
    }

    const config = GAIT_CONFIGS[gait_profile];
    const forwardSpeed = (config.strideLengthM * 2) / config.stepDurationSec;
    const estimatedDurationSec = Math.max(1.0, Math.round((totalDist / forwardSpeed) * 10) / 10);

    // 4. Generate Proposal Record
    const proposalId = `prop-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const requiredMechanisms: string[] = [];
    if (target_waypoint[1] > 1.5) {
      requiredMechanisms.push('ramp_01', 'laser_gate_02');
    }

    const proposal: StagedProposal = {
      id: proposalId,
      targetWaypoint: {
        x: target_waypoint[0],
        y: target_waypoint[1],
        z: target_waypoint[2],
      },
      gaitProfile: gait_profile,
      waypoints: navResult.path.map(([x, y, z], idx) => ({
        x,
        y,
        z,
        stepIndex: idx,
      })),
      predictedMinMargin: Math.round(minStabilityMargin * 100) / 100,
      estimatedDurationSec,
      requiredMechanisms,
      stagedAt: Date.now(),
    };

    // 5. Stage the proposal. The store alone decides approval, from the
    // human-controlled autonomyMode/safetyThreshold (§0: agents cannot grant
    // themselves approval — only the operator's Authority Gate toggle can).
    store.stageProposal(proposal);
    const finalStatus = useMissionStore.getState().approvalStatus as
      | 'APPROVED'
      | 'PENDING_APPROVAL';

    // Append to audit log
    store.addLogEntry({
      type: 'TOOL_CALL',
      source: 'AGENT',
      title: `Staged Locomotion Proposal (${proposalId})`,
      detail: `Target: [${target_waypoint.join(', ')}] • Profile: ${gait_profile} • Margin: ${proposal.predictedMinMargin} • Status: ${finalStatus}`,
      payload: { proposalId, finalStatus, target_waypoint, predictedMinMargin: proposal.predictedMinMargin },
      status: finalStatus === 'APPROVED' ? 'OK' : 'INFO',
    });

    return formatSuccessResponse({
      proposal_id: proposalId,
      status: finalStatus,
      target_waypoint,
      gait_profile,
      path_summary: {
        waypoints_count: navResult.path.length,
        total_distance_m: Math.round(totalDist * 10) / 10,
        estimated_duration_s: estimatedDurationSec,
      },
      predicted_min_margin: proposal.predictedMinMargin,
      required_mechanisms: requiredMechanisms,
      message:
        finalStatus === 'APPROVED'
          ? 'Proposal automatically approved per safety policy. Invoke execute_staged_proposal to begin motion.'
          : 'Proposal staged in Human Authority Gate. Awaiting operator approval before execution.',
    });
  },
};

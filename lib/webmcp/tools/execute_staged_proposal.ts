/**
 * Project A.E.G.I.S — WebMCP Tool: execute_staged_proposal (§6)
 *
 * Implements Phase 2 of the Two-Phase Commit architecture for humanoid motion.
 * Strictly verifies Human Authority Gate approval.
 * Rejects unapproved proposals with GATE_LOCKED.
 * Rejects rejected proposals with the human operator's specific feedback.
 * When approved, initiates locomotion execution and audit log streaming.
 */

import { WebMcpTool } from '../types';
import { formatSuccessResponse, formatFailureResponse } from '../responses';
import { useMissionStore } from '../../state/missionStore';

export const executeStagedProposalTool: WebMcpTool = {
  name: 'execute_staged_proposal',
  description:
    'Executes a previously staged locomotion proposal. Strictly enforces human approval: fails immediately with GATE_LOCKED if pending operator authorization or if rejected.',
  inputSchema: {
    type: 'object',
    properties: {
      proposal_id: {
        type: 'string',
        description: 'Unique identifier of the staged locomotion proposal to execute',
      },
    },
    required: ['proposal_id'],
    additionalProperties: false,
  },
  outputSchema: {
    type: 'object',
    properties: {
      proposal_id: { type: 'string' },
      status: {
        type: 'string',
        enum: ['EXECUTING', 'COMPLETED', 'FAILED'],
      },
      message: { type: 'string' },
      target_waypoint: {
        type: 'object',
        properties: {
          x: { type: 'number' },
          y: { type: 'number' },
          z: { type: 'number' },
        },
      },
      gait_profile: { type: 'string' },
      waypoints_count: { type: 'number' },
      estimated_duration_s: { type: 'number' },
    },
    required: ['proposal_id', 'status', 'message', 'waypoints_count'],
  },
  execute: async (args: { proposal_id: string }) => {
    const { proposal_id } = args;

    if (!proposal_id || typeof proposal_id !== 'string') {
      return formatFailureResponse(
        'INVALID_PARAMETER',
        'Parameter proposal_id is required and must be a valid string.'
      );
    }

    const store = useMissionStore.getState();
    const staged = store.stagedProposal;

    // 1. Verify Proposal Existence
    if (!staged || staged.id !== proposal_id) {
      return formatFailureResponse(
        'PROPOSAL_NOT_FOUND',
        `No staged proposal matching ID '${proposal_id}' exists.`,
        false,
        'Stage a new motion proposal using stage_locomotion_plan.'
      );
    }

    // 2. Check Human Authority Gate Status
    const approvalStatus = store.approvalStatus;

    if (approvalStatus === 'PENDING_APPROVAL') {
      return formatFailureResponse(
        'GATE_LOCKED',
        `Proposal '${proposal_id}' requires human approval before execution can begin.`,
        true,
        'Wait for human operator to click APPROVE in the Authority Gate HUD or configure AUTO_APPROVE_SAFE mode.',
        {
          proposal_id,
          approval_status: 'PENDING_APPROVAL',
          predicted_min_margin: staged.predictedMinMargin,
        }
      );
    }

    if (approvalStatus === 'REJECTED') {
      const reason = store.rejectionReason || 'Operator rejected this proposal.';
      return formatFailureResponse(
        'PROPOSAL_REJECTED',
        `Proposal '${proposal_id}' was rejected by human operator. Reason: "${reason}"`,
        true,
        'Review the rejection feedback, adjust waypoints or gait profile, and stage a revised proposal.',
        {
          proposal_id,
          rejection_reason: reason,
        }
      );
    }

    if (approvalStatus === 'EXECUTING') {
      return formatSuccessResponse({
        proposal_id,
        status: 'EXECUTING',
        message: 'Locomotion proposal is already executing.',
        target_waypoint: staged.targetWaypoint,
        gait_profile: staged.gaitProfile,
        waypoints_count: staged.waypoints.length,
        estimated_duration_s: staged.estimatedDurationSec,
      });
    }

    // 3. Start Execution
    store.setApprovalStatus('EXECUTING');

    // Append to audit log
    store.addLogEntry({
      type: 'APPROVAL',
      source: 'OPERATOR',
      title: `Execution Started (${proposal_id})`,
      detail: `Human approval verified. Commencing motion to [${staged.targetWaypoint.x}, ${staged.targetWaypoint.y}, ${staged.targetWaypoint.z}] using ${staged.gaitProfile}.`,
      payload: { proposal_id, target: staged.targetWaypoint, gait: staged.gaitProfile },
      status: 'OK',
    });

    return formatSuccessResponse({
      proposal_id,
      status: 'EXECUTING',
      message: 'Human approval verified. Locomotion sequence initiated successfully.',
      target_waypoint: staged.targetWaypoint,
      gait_profile: staged.gaitProfile,
      waypoints_count: staged.waypoints.length,
      estimated_duration_s: staged.estimatedDurationSec,
    });
  },
};

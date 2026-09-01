/**
 * Project A.E.G.I.S — WebMCP Read Tool 7: get_mission_plan (§5.3, §9)
 *
 * Returns the accumulated, approved mission plan, facility seed, mechanism configuration,
 * and execution telemetry for agent summary generation and plan export.
 */

import { WebMcpTool } from '../types';
import { formatSuccessResponse } from '../responses';
import { useMissionStore } from '../../state/missionStore';
import { buildMissionPlanExport } from '../../world/missionExport';

export const getMissionPlanTool: WebMcpTool = {
  name: 'get_mission_plan',
  description:
    'Retrieves the current mission plan, including ordered waypoints, gait profiles, facility seed, mechanism states, and approval audit history. Conforms to AegisMissionPlan schema v1.0.0 for session export and agent self-summarization.',
  inputSchema: {
    type: 'object',
    properties: {
      include_execution_history: {
        type: 'boolean',
        description: 'Whether to include the full log of agent tool calls and operator approvals (default: true).',
      },
    },
    additionalProperties: false,
  },
  outputSchema: {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['OK'] },
      mission_plan: {
        type: 'object',
        properties: {
          schema_version: { type: 'string' },
          exported_at: { type: 'string' },
          facility_seed: { type: 'number' },
          mission_metadata: { type: 'object' },
          target_waypoint: { type: 'object' },
          waypoints: { type: 'array' },
          mechanism_states: { type: 'object' },
          execution_history: { type: 'array' },
        },
        required: ['schema_version', 'facility_seed', 'target_waypoint', 'waypoints'],
      },
    },
    required: ['status', 'mission_plan'],
  },
  execute: async (params?: { include_execution_history?: boolean }) => {
    const store = useMissionStore.getState();
    const includeHistory = params?.include_execution_history !== false;

    const plan = buildMissionPlanExport(
      store.facilitySeed,
      store.stagedProposal,
      store.mechanisms,
      includeHistory ? store.missionLog : []
    );

    // Append log entry
    store.addLogEntry({
      type: 'TOOL_CALL',
      source: 'AGENT',
      title: 'get_mission_plan',
      status: 'OK',
      payload: { waypoints_count: plan.waypoints.length, seed: plan.facility_seed },
      detail: `Retrieved mission plan v${plan.schema_version} with ${plan.waypoints.length} waypoints on seed ${plan.facility_seed}.`,
    });

    return formatSuccessResponse({
      mission_plan: plan,
    });
  },
};

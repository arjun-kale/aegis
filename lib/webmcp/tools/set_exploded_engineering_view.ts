/**
 * Project A.E.G.I.S — WebMCP Action Tool 6: set_exploded_engineering_view (§5.3, §8)
 *
 * Smoothly interpolates the robot's physical subassemblies outward along precomputed
 * displacement vectors for joint human-agent engineering inspection and stress analysis.
 * Purely visual tool; safe to invoke without authority gate lock.
 */

import { WebMcpTool } from '../types';
import { formatSuccessResponse, formatFailureResponse } from '../responses';
import { useMissionStore } from '../../state/missionStore';
import { ROBOT_RIG } from '../../robot/rig';
import { readTelemetry } from '../../state/telemetryBus';
import { TELEMETRY_OFFSETS } from '../../state/telemetryOffsets';

export const setExplodedEngineeringViewTool: WebMcpTool = {
  name: 'set_exploded_engineering_view',
  description:
    'Controls the 3D exploded engineering disassembly view of the robot chassis and joint subsystems. Displaces kinematic links outward along precomputed structural vectors for joint torque and thermal stress inspection. Purely visual inspection tool; does not alter physical robot pose or trajectory.',
  inputSchema: {
    type: 'object',
    properties: {
      disassembly_factor: {
        type: 'number',
        description:
          'Exploded displacement factor between 0.0 (fully assembled nominal state) and 1.0 (maximum outward mechanical expansion).',
        minimum: 0.0,
        maximum: 1.0,
      },
      part_filter: {
        type: 'string',
        enum: ['ALL', 'LEGS', 'ARMS', 'HEAD', 'TORSO'],
        description:
          'Optional subassembly filter to focus exploded view on specific mechanical systems (default: ALL).',
      },
    },
    required: ['disassembly_factor'],
    additionalProperties: false,
  },
  outputSchema: {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['OK', 'ERROR'] },
      disassembly_factor: { type: 'number' },
      part_filter: { type: 'string' },
      active_parts_count: { type: 'number' },
      subsystems: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            part_id: { type: 'string' },
            name: { type: 'string' },
            rated_torque_nm: { type: 'number' },
            rated_temp_c: { type: 'number' },
            current_load_nm: { type: 'number' },
            thermal_headroom_pct: { type: 'number' },
          },
        },
      },
      message: { type: 'string' },
    },
    required: ['status', 'disassembly_factor', 'part_filter', 'active_parts_count', 'subsystems'],
  },
  execute: async (params: { disassembly_factor: number; part_filter?: string }) => {
    // 1. Parameter Validation
    const factor = params?.disassembly_factor;
    if (typeof factor !== 'number' || Number.isNaN(factor) || factor < 0.0 || factor > 1.0) {
      return formatFailureResponse(
        'INVALID_PARAMETER',
        `disassembly_factor must be a valid number between 0.0 and 1.0 (received ${factor}).`,
        true,
        'Pass disassembly_factor as a float between 0.0 and 1.0'
      );
    }

    const filter = params?.part_filter || 'ALL';
    const validFilters = ['ALL', 'LEGS', 'ARMS', 'HEAD', 'TORSO'];
    if (!validFilters.includes(filter)) {
      return formatFailureResponse(
        'INVALID_PARAMETER',
        `part_filter '${filter}' is invalid. Allowed filters: ${validFilters.join(', ')}.`,
        true,
        `Choose one of the allowed part filters: ${validFilters.join(', ')}`
      );
    }

    // 2. Read live telemetry for component stress inspection
    const torques = readTelemetry(TELEMETRY_OFFSETS.TORQUES_START, 6);
    const store = useMissionStore.getState();
    const thermalHeadroom = store.thermalHeadroom;

    // 3. Mutate store disassembly factor
    store.setDisassemblyFactor(factor);

    // 4. Build subsystem inspection metadata
    const subsystemsList = [
      {
        part_id: 'torso',
        name: ROBOT_RIG.parts.torso.name,
        rated_torque_nm: ROBOT_RIG.parts.torso.ratedTorqueNm,
        rated_temp_c: ROBOT_RIG.parts.torso.ratedTempC,
        current_load_nm: 0,
        thermal_headroom_pct: Math.round(thermalHeadroom * 100),
      },
      {
        part_id: 'head',
        name: ROBOT_RIG.parts.head.name,
        rated_torque_nm: ROBOT_RIG.parts.head.ratedTorqueNm,
        rated_temp_c: ROBOT_RIG.parts.head.ratedTempC,
        current_load_nm: 0,
        thermal_headroom_pct: Math.round(thermalHeadroom * 100),
      },
      {
        part_id: 'knee_l',
        name: ROBOT_RIG.parts.knee_l.name,
        rated_torque_nm: ROBOT_RIG.parts.knee_l.ratedTorqueNm,
        rated_temp_c: ROBOT_RIG.parts.knee_l.ratedTempC,
        current_load_nm: Math.round((torques[1] || 0) * 10) / 10,
        thermal_headroom_pct: Math.round(thermalHeadroom * 100),
      },
      {
        part_id: 'knee_r',
        name: ROBOT_RIG.parts.knee_r.name,
        rated_torque_nm: ROBOT_RIG.parts.knee_r.ratedTorqueNm,
        rated_temp_c: ROBOT_RIG.parts.knee_r.ratedTempC,
        current_load_nm: Math.round((torques[4] || 0) * 10) / 10,
        thermal_headroom_pct: Math.round(thermalHeadroom * 100),
      },
      {
        part_id: 'hip_l',
        name: ROBOT_RIG.parts.hip_l.name,
        rated_torque_nm: ROBOT_RIG.parts.hip_l.ratedTorqueNm,
        rated_temp_c: ROBOT_RIG.parts.hip_l.ratedTempC,
        current_load_nm: Math.round((torques[0] || 0) * 10) / 10,
        thermal_headroom_pct: Math.round(thermalHeadroom * 100),
      },
      {
        part_id: 'hip_r',
        name: ROBOT_RIG.parts.hip_r.name,
        rated_torque_nm: ROBOT_RIG.parts.hip_r.ratedTorqueNm,
        rated_temp_c: ROBOT_RIG.parts.hip_r.ratedTempC,
        current_load_nm: Math.round((torques[3] || 0) * 10) / 10,
        thermal_headroom_pct: Math.round(thermalHeadroom * 100),
      },
    ];

    // Filter subsystems if requested
    let filteredSubsystems = subsystemsList;
    if (filter === 'LEGS') {
      filteredSubsystems = subsystemsList.filter((s) => s.part_id.includes('knee') || s.part_id.includes('hip'));
    } else if (filter === 'HEAD') {
      filteredSubsystems = subsystemsList.filter((s) => s.part_id === 'head');
    } else if (filter === 'TORSO') {
      filteredSubsystems = subsystemsList.filter((s) => s.part_id === 'torso');
    }

    // 5. Append structured log entry
    store.addLogEntry({
      type: 'TOOL_CALL',
      source: 'AGENT',
      title: 'set_exploded_engineering_view',
      status: 'OK',
      payload: { disassembly_factor: factor, part_filter: filter },
      detail: `Set exploded disassembly factor to ${(factor * 100).toFixed(0)}% (filter: ${filter}).`,
    });

    return formatSuccessResponse({
      disassembly_factor: factor,
      part_filter: filter,
      active_parts_count: filteredSubsystems.length,
      subsystems: filteredSubsystems,
      message:
        factor === 0.0
          ? 'Exploded engineering view closed. Robot assembled in nominal configuration.'
          : `Exploded view active at ${(factor * 100).toFixed(0)}% expansion for subsystem inspection.`,
    });
  },
};

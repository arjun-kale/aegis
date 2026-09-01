/**
 * Project A.E.G.I.S — WebMCP Tool: get_robot_telemetry (§5)
 *
 * Returns real-time telemetry of the humanoid robot including 3D pose,
 * joint angles, gravitational torques, stability margin, thermal headroom,
 * battery SOC, and active faults.
 */

import { WebMcpTool } from '../types';
import { formatSuccessResponse } from '../responses';
import { readTelemetry, readTelemetrySingle } from '../../state/telemetryBus';
import { TELEMETRY_OFFSETS } from '../../state/telemetryOffsets';
import { useMissionStore } from '../../state/missionStore';

export const getRobotTelemetryTool: WebMcpTool = {
  name: 'get_robot_telemetry',
  description:
    'Returns real-time telemetry of the humanoid robot including 3D position, orientation, joint angles, joint torques, thermal headroom, static stability margin, battery SOC, and active faults.',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
    additionalProperties: false,
  },
  outputSchema: {
    type: 'object',
    properties: {
      position: {
        type: 'array',
        items: { type: 'number' },
        description: '3D world coordinates [x, y, z] in meters',
      },
      orientation_euler: {
        type: 'array',
        items: { type: 'number' },
        description: 'Euler orientation angles [roll, pitch, yaw] in radians',
      },
      joint_angles: {
        type: 'object',
        description: 'Current joint angles across all 10 articulating joints',
      },
      joint_torques: {
        type: 'object',
        description: 'Gravitational joint torque estimates in N·m',
      },
      thermal_headroom: {
        type: 'number',
        description: 'Normalized thermal headroom remaining [0.0 - 1.0]',
      },
      stability_margin: {
        type: 'number',
        description:
          'Static stability margin (CoM signed distance to 2D support polygon). Value in [0, 1] when stable, negative when unstable.',
      },
      battery_soc: {
        type: 'number',
        description: 'Battery state of charge [0.0 - 1.0]',
      },
      active_faults: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of active hardware or sensor fault codes',
      },
      stance_state: {
        type: 'string',
        enum: ['DOUBLE_SUPPORT', 'LEFT_STANCE', 'RIGHT_STANCE', 'FLIGHT'],
        description: 'Current foot contact stance state',
      },
    },
    required: [
      'position',
      'orientation_euler',
      'joint_angles',
      'joint_torques',
      'thermal_headroom',
      'stability_margin',
      'battery_soc',
      'active_faults',
    ],
  },
  execute: async () => {
    // 1. Read position and orientation from 60Hz Telemetry Buffer
    const posX = readTelemetrySingle(TELEMETRY_OFFSETS.POS_X);
    const posY = readTelemetrySingle(TELEMETRY_OFFSETS.POS_Y);
    const posZ = readTelemetrySingle(TELEMETRY_OFFSETS.POS_Z);

    const rotR = readTelemetrySingle(TELEMETRY_OFFSETS.ROT_QX);
    const rotP = readTelemetrySingle(TELEMETRY_OFFSETS.ROT_QY);
    const rotY = readTelemetrySingle(TELEMETRY_OFFSETS.ROT_QZ);

    // 2. Read joint angles from buffer
    const jointAngleValues = readTelemetry(TELEMETRY_OFFSETS.JOINTS_START, 10);
    const jointAngles = {
      hipL: Math.round(jointAngleValues[0] * 100) / 100,
      kneeL: Math.round(jointAngleValues[1] * 100) / 100,
      ankleL: Math.round(jointAngleValues[2] * 100) / 100,
      hipR: Math.round(jointAngleValues[3] * 100) / 100,
      kneeR: Math.round(jointAngleValues[4] * 100) / 100,
      ankleR: Math.round(jointAngleValues[5] * 100) / 100,
      shoulderL: Math.round(jointAngleValues[6] * 100) / 100,
      elbowL: Math.round(jointAngleValues[7] * 100) / 100,
      shoulderR: Math.round(jointAngleValues[8] * 100) / 100,
      elbowR: Math.round(jointAngleValues[9] * 100) / 100,
    };

    // 3. Read joint torques
    const torqueValues = readTelemetry(TELEMETRY_OFFSETS.TORQUES_START, 6);
    const jointTorques = {
      hipL: Math.round(torqueValues[0] * 10) / 10,
      kneeL: Math.round(torqueValues[1] * 10) / 10,
      ankleL: Math.round(torqueValues[2] * 10) / 10,
      hipR: Math.round(torqueValues[3] * 10) / 10,
      kneeR: Math.round(torqueValues[4] * 10) / 10,
      ankleR: Math.round(torqueValues[5] * 10) / 10,
    };

    // 4. Read stability margin and stance state
    const stabilityMargin = readTelemetrySingle(TELEMETRY_OFFSETS.STABILITY_MARGIN);
    const stanceRaw = readTelemetrySingle(TELEMETRY_OFFSETS.STANCE_STATE);
    const stanceState =
      stanceRaw === 0
        ? 'DOUBLE_SUPPORT'
        : stanceRaw === 1
        ? 'LEFT_STANCE'
        : stanceRaw === 2
        ? 'RIGHT_STANCE'
        : 'FLIGHT';

    // 5. Read discrete metrics from Mission Store
    const store = useMissionStore.getState();
    const batterySoc = store.batterySoc;
    const thermalHeadroom = store.thermalHeadroom;
    const activeFaults = store.activeFaults;

    return formatSuccessResponse({
      position: [
        Math.round(posX * 100) / 100,
        Math.round((posY || 0.95) * 100) / 100,
        Math.round(posZ * 100) / 100,
      ],
      orientation_euler: [
        Math.round(rotR * 1000) / 1000,
        Math.round(rotP * 1000) / 1000,
        Math.round(rotY * 1000) / 1000,
      ],
      joint_angles: jointAngles,
      joint_torques: jointTorques,
      thermal_headroom: Math.round(thermalHeadroom * 100) / 100,
      stability_margin: Math.round(stabilityMargin * 100) / 100,
      battery_soc: Math.round(batterySoc * 100) / 100,
      active_faults: activeFaults,
      stance_state: stanceState,
    });
  },
};

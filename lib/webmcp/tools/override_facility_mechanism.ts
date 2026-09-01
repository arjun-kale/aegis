/**
 * Project A.E.G.I.S — WebMCP Tool: override_facility_mechanism (§6)
 *
 * Disarms laser gates, raises/lowers freight lifts, and opens security blast doors.
 * Enforces security authorization codes for high-security barriers.
 * Mutates world passability and updates the navigation grid in real-time.
 */

import { WebMcpTool } from '../types';
import { formatSuccessResponse, formatFailureResponse } from '../responses';
import { useMissionStore } from '../../state/missionStore';
import { applyMechanismCommand, FACILITY_MECHANISMS } from '../../world/mechanisms';

const VALID_SECURITY_AUTH_CODES = ['AEGIS-7749-AUTH', 'AEGIS-OVERRIDE-ALPHA', 'AEGIS-9901-SEC'];

export const overrideFacilityMechanismTool: WebMcpTool = {
  name: 'override_facility_mechanism',
  description:
    'Overrides or reconfigures a facility mechanism (disarming laser barriers, operating freight elevators, or diverting auxiliary power to open sealed blast doors). Enforces security authorization codes for restricted mechanisms.',
  inputSchema: {
    type: 'object',
    properties: {
      mechanism_id: {
        type: 'string',
        enum: ['laser_gate_01', 'laser_gate_02', 'freight_lift_01', 'sealed_door_01'],
        description: 'Identifier of the target facility mechanism to manipulate',
      },
      command: {
        type: 'string',
        enum: ['DEACTIVATE', 'ACTIVATE', 'RAISE', 'LOWER', 'DIVERT_POWER', 'SEAL'],
        description: 'Operation command to apply to the mechanism',
      },
      authorization_code: {
        type: 'string',
        description:
          'Security credential required for high-security operations (e.g. DIVERT_POWER on sealed_door_01)',
      },
    },
    required: ['mechanism_id', 'command'],
    additionalProperties: false,
  },
  outputSchema: {
    type: 'object',
    properties: {
      mechanism_id: { type: 'string' },
      previous_state: { type: 'string' },
      new_state: { type: 'string' },
      passable: { type: 'boolean' },
      message: { type: 'string' },
    },
    required: ['mechanism_id', 'previous_state', 'new_state', 'passable', 'message'],
  },
  execute: async (args: {
    mechanism_id: string;
    command: string;
    authorization_code?: string;
  }) => {
    const { mechanism_id, command, authorization_code } = args;

    const def = FACILITY_MECHANISMS[mechanism_id];
    if (!def) {
      return formatFailureResponse(
        'MECHANISM_NOT_FOUND',
        `Mechanism '${mechanism_id}' does not exist in this facility.`,
        false,
        `Valid mechanism IDs: ${Object.keys(FACILITY_MECHANISMS).join(', ')}`
      );
    }

    const store = useMissionStore.getState();
    const current = store.mechanisms[mechanism_id];
    const previousState = current?.state || def.defaultState;

    // Security Authorization Check for Sealed Vault Doors
    const upperCmd = command.toUpperCase();
    if (mechanism_id === 'sealed_door_01' && (upperCmd === 'DIVERT_POWER' || upperCmd === 'OPEN')) {
      if (!authorization_code || !VALID_SECURITY_AUTH_CODES.includes(authorization_code)) {
        return formatFailureResponse(
          'AUTHORIZATION_REQUIRED',
          `Security protocol requires a valid authorization code to execute '${command}' on ${mechanism_id}.`,
          true,
          'Provide a valid facility authorization code in authorization_code parameter (e.g. AEGIS-7749-AUTH).'
        );
      }
    }

    // Apply Mechanism Command
    const res = applyMechanismCommand(mechanism_id, command, current);
    if (!res.success) {
      return formatFailureResponse(
        'INVALID_COMMAND',
        res.reason || `Command '${command}' could not be executed on ${mechanism_id}.`,
        true,
        `Allowed commands: ${def.allowedCommands.join(', ')}`
      );
    }

    // Update Store
    store.updateMechanism(mechanism_id, res.newState);

    // Append to audit log
    store.addLogEntry({
      type: 'MECHANISM_OVERRIDE',
      source: 'AGENT',
      title: `Mechanism Overridden: ${mechanism_id}`,
      detail: `Transitioned from ${previousState} -> ${res.newState.state} via '${command}'. Passable: ${res.newState.passable}.`,
      payload: { mechanism_id, command, previousState, newState: res.newState.state },
      status: 'OK',
    });

    return formatSuccessResponse({
      mechanism_id,
      previous_state: previousState,
      new_state: res.newState.state,
      passable: res.newState.passable,
      message: `Mechanism '${mechanism_id}' transitioned to state '${res.newState.state}'. Corridor passability updated.`,
    });
  },
};

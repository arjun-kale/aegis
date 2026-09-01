/**
 * Project A.E.G.I.S — WebMCP Tool: query_facility_state (§5)
 *
 * Queries the operational status of facility mechanisms, security alarms,
 * power distribution grid, and extraction route passability.
 */

import { WebMcpTool } from '../types';
import { formatSuccessResponse } from '../responses';
import { useMissionStore } from '../../state/missionStore';
import { generateFacility } from '../../world/generator';
import { findAStarPath } from '../../world/navigation';

export const queryFacilityStateTool: WebMcpTool = {
  name: 'query_facility_state',
  description:
    'Queries the operational status of facility mechanisms, security alarms, power routing, and extraction route passability.',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
    additionalProperties: false,
  },
  outputSchema: {
    type: 'object',
    properties: {
      facility_seed: { type: 'number' },
      mechanisms: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            type: { type: 'string' },
            state: { type: 'string' },
            passable: { type: 'boolean' },
            location: {
              type: 'object',
              properties: {
                x: { type: 'number' },
                y: { type: 'number' },
                z: { type: 'number' },
              },
            },
          },
        },
      },
      power_status: { type: 'string' },
      active_alarms: {
        type: 'array',
        items: { type: 'string' },
      },
      extraction_route_status: {
        type: 'string',
        enum: ['OPEN', 'BLOCKED', 'UNKNOWN'],
      },
      extraction_route_blocked_by: {
        type: 'string',
        description: 'Identifier of mechanism sealing the extraction route',
      },
      extraction_point: {
        type: 'array',
        items: { type: 'number' },
      },
    },
    required: [
      'facility_seed',
      'mechanisms',
      'power_status',
      'active_alarms',
      'extraction_route_status',
      'extraction_point',
    ],
  },
  execute: async () => {
    const store = useMissionStore.getState();
    const facilityData = generateFacility(store.facilitySeed);

    // Evaluate A* path from Entry Point [0, 0, 0] to Extraction Point [18, 2.5, 19]
    const navResult = findAStarPath(
      facilityData.navGrid,
      [0, 0, 0],
      facilityData.extractionPoint,
      store.mechanisms
    );

    const isRouteOpen = navResult.path.length > 0;
    const routeStatus = isRouteOpen ? 'OPEN' : 'BLOCKED';

    const mechanismList = Object.values(store.mechanisms).map((m) => ({
      id: m.id,
      name: m.id,
      type: m.type,
      state: m.state,
      passable: m.passable,
      location: m.location,
    }));

    const alarms: string[] = [];
    if (store.mechanisms.laser_gate_02?.state === 'ARMED') {
      alarms.push('SECURITY_PERIMETER_ACTIVE: Corridor E Laser Grid Armed');
    }
    if (store.mechanisms.sealed_door_01?.state === 'SEALED') {
      alarms.push('VAULT_SEALED: Sub-Level Blast Door Closed');
    }

    return formatSuccessResponse({
      facility_seed: store.facilitySeed,
      mechanisms: mechanismList,
      power_status: 'NOMINAL_GRID_AUXILIARY',
      active_alarms: alarms,
      extraction_route_status: routeStatus,
      extraction_route_blocked_by: navResult.blockedBy,
      extraction_point: facilityData.extractionPoint,
    });
  },
};

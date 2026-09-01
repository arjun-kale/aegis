/**
 * Project A.E.G.I.S — WebMCP Tool: scan_spatial_environment (§5)
 *
 * Performs a line-of-sight spatial scan around the robot, returning
 * detected obstacles, mechanisms, terrain features, and unexplored frontiers.
 * Rejects out-of-range sensor requests with structured error messages.
 */

import { WebMcpTool } from '../types';
import { formatSuccessResponse, formatFailureResponse } from '../responses';
import { readTelemetrySingle } from '../../state/telemetryBus';
import { TELEMETRY_OFFSETS } from '../../state/telemetryOffsets';
import { useMissionStore } from '../../state/missionStore';
import { generateFacility } from '../../world/generator';
import { getMechanismColliders } from '../../world/mechanisms';
import { performSpatialScan } from '../../world/exploration';

const MAX_SENSOR_RANGE_M = 25.0;
const MIN_SENSOR_RANGE_M = 1.0;

export const scanSpatialEnvironmentTool: WebMcpTool = {
  name: 'scan_spatial_environment',
  description:
    'Performs an onboard LIDAR/optical spatial scan around the robot, returning detected obstacles, mechanisms, terrain features, and unexplored frontiers. Enforces a maximum range of 25m.',
  inputSchema: {
    type: 'object',
    properties: {
      scan_mode: {
        type: 'string',
        enum: ['fast', 'high_res'],
        description: 'Scan fidelity: fast (coarse 2m) or high_res (dense 1m)',
      },
      range_m: {
        type: 'number',
        description: 'Scan radius in meters (min: 1.0, max: 25.0)',
      },
    },
    required: ['scan_mode', 'range_m'],
    additionalProperties: false,
  },
  outputSchema: {
    type: 'object',
    properties: {
      scan_origin: {
        type: 'array',
        items: { type: 'number' },
      },
      range_m: { type: 'number' },
      scan_mode: { type: 'string' },
      total_scanned_cells: { type: 'number' },
      newly_discovered_cells: { type: 'number' },
      obstacles: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            type: { type: 'string' },
            distance_m: { type: 'number' },
          },
        },
      },
      mechanisms: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            state: { type: 'string' },
            passable: { type: 'boolean' },
          },
        },
      },
      terrain_features: {
        type: 'array',
        items: { type: 'string' },
      },
      unexplored_frontiers: {
        type: 'array',
        items: {
          type: 'array',
          items: { type: 'number' },
        },
        description: 'Coordinates of unexplored frontiers bordering scanned cells',
      },
    },
    required: [
      'scan_origin',
      'range_m',
      'scan_mode',
      'total_scanned_cells',
      'obstacles',
      'mechanisms',
      'unexplored_frontiers',
    ],
  },
  execute: async (args: { scan_mode: 'fast' | 'high_res'; range_m: number }) => {
    const { scan_mode, range_m } = args ?? ({} as typeof args);

    // 1. Validate Sensor Range Bounds
    if (typeof range_m !== 'number' || isNaN(range_m)) {
      return formatFailureResponse(
        'INVALID_PARAMETER',
        'Parameter range_m must be a valid numeric value.'
      );
    }

    if (range_m > MAX_SENSOR_RANGE_M) {
      return formatFailureResponse(
        'OUT_OF_BOUNDS',
        `Requested range_m (${range_m}m) exceeds maximum LIDAR/sensor range of ${MAX_SENSOR_RANGE_M}m.`
      );
    }

    if (range_m < MIN_SENSOR_RANGE_M) {
      return formatFailureResponse(
        'OUT_OF_BOUNDS',
        `Requested range_m (${range_m}m) is below minimum sensor range of ${MIN_SENSOR_RANGE_M}m.`
      );
    }

    // 2. Read Robot Position
    const rx = readTelemetrySingle(TELEMETRY_OFFSETS.POS_X);
    const ry = readTelemetrySingle(TELEMETRY_OFFSETS.POS_Y) || 0.95;
    const rz = readTelemetrySingle(TELEMETRY_OFFSETS.POS_Z);
    const origin: [number, number, number] = [rx, ry, rz];

    // 3. Retrieve Facility State & Active Colliders
    const store = useMissionStore.getState();
    const facilityData = generateFacility(store.facilitySeed);
    const dynamicColliders = getMechanismColliders(store.mechanisms);
    const allColliders = [...facilityData.colliders, ...dynamicColliders];

    // 4. Execute Line-of-Sight Spatial Scan
    const scanResult = performSpatialScan(
      origin,
      range_m,
      allColliders,
      store.explorationGrid
    );

    // 5. Update Exploration Grid in Mission Store
    if (scanResult.newlyScannedCells.length > 0) {
      const updates: Record<string, 'scanned'> = {};
      scanResult.newlyScannedCells.forEach((k) => (updates[k] = 'scanned'));
      store.batchUpdateExplorationCells(updates);
    }

    // 6. Assemble Detected Obstacles
    const detectedObstacles = allColliders
      .filter((c) => {
        if (c.type === 'FLOOR') return false;
        const cx = (c.min[0] + c.max[0]) / 2;
        const cy = (c.min[1] + c.max[1]) / 2;
        const cz = (c.min[2] + c.max[2]) / 2;
        const dist = Math.sqrt((cx - rx) ** 2 + (cy - ry) ** 2 + (cz - rz) ** 2);
        return dist <= range_m;
      })
      .slice(0, 10)
      .map((c) => {
        const cx = (c.min[0] + c.max[0]) / 2;
        const cy = (c.min[1] + c.max[1]) / 2;
        const cz = (c.min[2] + c.max[2]) / 2;
        const dist = Math.sqrt((cx - rx) ** 2 + (cy - ry) ** 2 + (cz - rz) ** 2);
        return {
          id: c.id,
          type: c.type,
          distance_m: Math.round(dist * 10) / 10,
        };
      });

    // 7. Assemble Detected Mechanisms
    const detectedMechanisms = Object.values(store.mechanisms)
      .filter((m) => {
        const dist = Math.sqrt(
          (m.location.x - rx) ** 2 +
            (m.location.y - ry) ** 2 +
            (m.location.z - rz) ** 2
        );
        return dist <= range_m;
      })
      .map((m) => ({
        id: m.id,
        state: m.state,
        passable: m.passable,
      }));

    // 8. Assemble Terrain Features
    const terrainFeatures: string[] = ['Level_0_Concrete_Slab'];
    if (origin[1] > 1.0) terrainFeatures.push('Level_1_Observation_Deck');
    if (detectedObstacles.some((o) => o.type === 'RAMP')) {
      terrainFeatures.push('15_Deg_Incline_Ramp');
    }

    return formatSuccessResponse({
      scan_origin: [Math.round(rx * 10) / 10, Math.round(ry * 10) / 10, Math.round(rz * 10) / 10],
      range_m,
      scan_mode,
      total_scanned_cells: scanResult.totalScannedCount,
      newly_discovered_cells: scanResult.newlyScannedCells.length,
      obstacles: detectedObstacles,
      mechanisms: detectedMechanisms,
      terrain_features: terrainFeatures,
      unexplored_frontiers: scanResult.unexploredFrontiers,
    });
  },
};

import { describe, it, expect, beforeEach } from 'vitest';
import { getRobotTelemetryTool } from '@/lib/webmcp/tools/get_robot_telemetry';
import { scanSpatialEnvironmentTool } from '@/lib/webmcp/tools/scan_spatial_environment';
import { evaluateGaitFeasibilityTool } from '@/lib/webmcp/tools/evaluate_gait_feasibility';
import { queryFacilityStateTool } from '@/lib/webmcp/tools/query_facility_state';
import { validateAgainstSchema } from '@/lib/webmcp/schemas';
import { useMissionStore } from '@/lib/state/missionStore';
import { writeTelemetry, writeTelemetrySingle } from '@/lib/state/telemetryBus';
import { TELEMETRY_OFFSETS } from '@/lib/state/telemetryOffsets';

describe('WebMCP Read Tools & Perception (§5)', () => {
  beforeEach(() => {
    // Reset mission store state
    useMissionStore.setState({
      facilitySeed: 42,
      batterySoc: 0.92,
      thermalHeadroom: 0.85,
      activeFaults: [],
      mechanisms: {
        laser_gate_01: {
          id: 'laser_gate_01',
          type: 'LASER_GATE',
          state: 'DISARMED',
          location: { x: 0, y: 0, z: 4 },
          passable: true,
        },
        laser_gate_02: {
          id: 'laser_gate_02',
          type: 'LASER_GATE',
          state: 'ARMED',
          location: { x: 10, y: 0, z: 0 },
          passable: false,
        },
        freight_lift_01: {
          id: 'freight_lift_01',
          type: 'FREIGHT_LIFT',
          state: 'LOWERED',
          location: { x: 14, y: 0, z: 0 },
          passable: true,
        },
        sealed_door_01: {
          id: 'sealed_door_01',
          type: 'SEALED_DOOR',
          state: 'SEALED',
          location: { x: -8, y: 0, z: 0 },
          passable: false,
        },
      },
      explorationGrid: {},
      scannedCellsCount: 0,
    });

    // Populate telemetry bus with representative metrics
    writeTelemetrySingle(TELEMETRY_OFFSETS.ROBOT_X, 0.0);
    writeTelemetrySingle(TELEMETRY_OFFSETS.ROBOT_Y, 0.95);
    writeTelemetrySingle(TELEMETRY_OFFSETS.ROBOT_Z, 0.0);
    writeTelemetrySingle(TELEMETRY_OFFSETS.STABILITY_MARGIN, 0.78);
    writeTelemetrySingle(TELEMETRY_OFFSETS.STANCE_STATE, 0); // DOUBLE_SUPPORT
  });

  describe('Tool 1: get_robot_telemetry', () => {
    it('returns compliant output schema on valid query', async () => {
      const res = await getRobotTelemetryTool.execute({});
      expect(res.isError).toBe(false);

      const parsed = JSON.parse(res.content[0].text);
      expect(parsed.status).toBe('OK');

      // Validate Output Schema
      const schemaCheck = validateAgainstSchema(parsed, getRobotTelemetryTool.outputSchema!);
      expect(schemaCheck.valid).toBe(true);

      // Verify specific metrics
      expect(parsed.position).toEqual([0, 0.95, 0]);
      expect(parsed.battery_soc).toBe(0.92);
      expect(parsed.thermal_headroom).toBe(0.85);
      expect(parsed.stability_margin).toBe(0.78);
      expect(parsed.stance_state).toBe('DOUBLE_SUPPORT');
    });
  });

  describe('Tool 2: scan_spatial_environment', () => {
    it('rejects range requests exceeding 25m with structured error', async () => {
      const res = await scanSpatialEnvironmentTool.execute({
        scan_mode: 'high_res',
        range_m: 50,
      });

      expect(res.isError).toBe(true);
      const parsed = JSON.parse(res.content[0].text);
      expect(parsed.status).toBe('OUT_OF_BOUNDS');
      expect(parsed.reason).toContain('25m');
    });

    it('returns line-of-sight scan results and frontiers for valid range', async () => {
      const res = await scanSpatialEnvironmentTool.execute({
        scan_mode: 'high_res',
        range_m: 15,
      });

      expect(res.isError).toBe(false);
      const parsed = JSON.parse(res.content[0].text);
      expect(parsed.status).toBe('OK');

      // Validate Output Schema
      const schemaCheck = validateAgainstSchema(parsed, scanSpatialEnvironmentTool.outputSchema!);
      expect(schemaCheck.valid).toBe(true);

      expect(parsed.range_m).toBe(15);
      expect(parsed.total_scanned_cells).toBeGreaterThan(10);
      expect(parsed.unexplored_frontiers.length).toBeGreaterThan(0);
      expect(parsed.obstacles.length).toBeGreaterThan(0);
      expect(parsed.mechanisms.length).toBeGreaterThan(0);
    });
  });

  describe('Tool 3: evaluate_gait_feasibility', () => {
    it('returns feasible: true for level corridor path with CAUTIOUS_STEP', async () => {
      const res = await evaluateGaitFeasibilityTool.execute({
        path: [
          [0, 0, 0],
          [4, 0, 0],
          [8, 0, 0],
        ],
        gait_profile: 'CAUTIOUS_STEP',
      });

      expect(res.isError).toBe(false);
      const parsed = JSON.parse(res.content[0].text);
      expect(parsed.status).toBe('OK');

      // Validate Output Schema
      const schemaCheck = validateAgainstSchema(parsed, evaluateGaitFeasibilityTool.outputSchema!);
      expect(schemaCheck.valid).toBe(true);

      expect(parsed.feasible).toBe(true);
      expect(parsed.estimated_margin_min).toBeGreaterThan(0.20);
      expect(parsed.max_torque_nm).toBeLessThan(200);
    });

    it('returns feasible: false with specific reason for DYNAMIC_BALANCE on steep ramp', async () => {
      const res = await evaluateGaitFeasibilityTool.execute({
        path: [
          [10, 0, 2],
          [10, 0.5, 4],
          [10, 2.0, 9],
        ],
        gait_profile: 'DYNAMIC_BALANCE',
      });

      expect(res.isError).toBe(false);
      const parsed = JSON.parse(res.content[0].text);
      expect(parsed.status).toBe('OK');
      expect(parsed.feasible).toBe(false);
      expect(parsed.failure_reason).toContain('DYNAMIC_BALANCE profile is unfeasible');
      expect(parsed.failure_reason).toContain('CAUTIOUS_STEP');
    });

    it('returns feasible: false when path intersects an armed mechanism barrier', async () => {
      const res = await evaluateGaitFeasibilityTool.execute({
        path: [
          [8, 0, 0],
          [12, 0, 0],
        ],
        gait_profile: 'CAUTIOUS_STEP',
      });

      expect(res.isError).toBe(false);
      const parsed = JSON.parse(res.content[0].text);
      expect(parsed.status).toBe('OK');
      expect(parsed.feasible).toBe(false);
      expect(parsed.failure_reason).toContain('laser_gate_02');
    });
  });

  describe('Tool 4: query_facility_state', () => {
    it('reports extraction_route_status: BLOCKED when laser_gate_02 is ARMED', async () => {
      const res = await queryFacilityStateTool.execute({});
      expect(res.isError).toBe(false);

      const parsed = JSON.parse(res.content[0].text);
      expect(parsed.status).toBe('OK');

      // Validate Output Schema
      const schemaCheck = validateAgainstSchema(parsed, queryFacilityStateTool.outputSchema!);
      expect(schemaCheck.valid).toBe(true);

      expect(parsed.extraction_route_status).toBe('BLOCKED');
      expect(parsed.extraction_route_blocked_by).toBe('laser_gate_02');
      expect(parsed.active_alarms.length).toBeGreaterThan(0);
    });

    it('reports extraction_route_status: OPEN when laser_gate_02 is DISARMED', async () => {
      // Disarm laser_gate_02 in store
      useMissionStore.getState().updateMechanism('laser_gate_02', {
        id: 'laser_gate_02',
        type: 'LASER_GATE',
        state: 'DISARMED',
        location: { x: 10, y: 0, z: 0 },
        passable: true,
      });

      const res = await queryFacilityStateTool.execute({});
      expect(res.isError).toBe(false);

      const parsed = JSON.parse(res.content[0].text);
      expect(parsed.status).toBe('OK');
      expect(parsed.extraction_route_status).toBe('OPEN');
    });
  });
});

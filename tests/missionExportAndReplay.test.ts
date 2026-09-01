import { describe, it, expect, beforeEach } from 'vitest';
import { useMissionStore } from '@/lib/state/missionStore';
import {
  buildMissionPlanExport,
  validateMissionPlan,
  AegisMissionPlanV1,
} from '@/lib/world/missionExport';
import { getMissionPlanTool } from '@/lib/webmcp/tools/get_mission_plan';

describe('Mission Plan Export, Replay & Schema Validation (Phase 9)', () => {
  beforeEach(() => {
    useMissionStore.setState({
      facilitySeed: 42,
      stagedProposal: {
        id: 'prop-exp-01',
        targetWaypoint: { x: 12, y: 0, z: 4 },
        gaitProfile: 'CAUTIOUS_STEP',
        waypoints: [
          { x: 0, y: 0, z: 0 },
          { x: 6, y: 0, z: 2 },
          { x: 12, y: 0, z: 4 },
        ],
        predictedMinMargin: 0.62,
        estimatedDurationSec: 14.5,
        requiredMechanisms: ['laser_gate_01'],
        stagedAt: Date.now(),
      },
      approvalStatus: 'APPROVED',
      missionLog: [],
    });
  });

  describe('Mission Plan Schema Serialization (§5.3, §9)', () => {
    it('serializes state into a compliant AegisMissionPlanV1 structure', () => {
      const store = useMissionStore.getState();
      const plan = buildMissionPlanExport(
        store.facilitySeed,
        store.stagedProposal,
        store.mechanisms,
        store.missionLog
      );

      expect(plan.schema_version).toBe('1.0.0');
      expect(plan.facility_seed).toBe(42);
      expect(plan.target_waypoint.x).toBe(12);
      expect(plan.waypoints.length).toBe(3);
      expect(plan.mission_metadata.gait_profile).toBe('CAUTIOUS_STEP');
      expect(plan.mission_metadata.predicted_min_margin).toBeCloseTo(0.62, 2);
      expect(plan.mechanism_states.laser_gate_01).toBeDefined();
    });

    it('validates a correct mission plan with validateMissionPlan()', () => {
      const store = useMissionStore.getState();
      const plan = buildMissionPlanExport(
        store.facilitySeed,
        store.stagedProposal,
        store.mechanisms,
        store.missionLog
      );

      const res = validateMissionPlan(plan);
      expect(res.valid).toBe(true);
      expect(res.plan?.facility_seed).toBe(42);
      expect(res.error).toBeUndefined();
    });

    it('rejects invalid or corrupted plan schemas with explicit error messages', () => {
      // 1. Incompatible schema version
      const badVer = { schema_version: '2.0.0', facility_seed: 42, waypoints: [{ x: 0, y: 0, z: 0 }] };
      const resVer = validateMissionPlan(badVer);
      expect(resVer.valid).toBe(false);
      expect(resVer.error).toContain("Unsupported schema_version '2.0.0'");

      // 2. Missing/NaN facility seed
      const badSeed = { schema_version: '1.0.0', facility_seed: 'invalid' as any, waypoints: [{ x: 0, y: 0, z: 0 }] };
      const resSeed = validateMissionPlan(badSeed);
      expect(resSeed.valid).toBe(false);
      expect(resSeed.error).toContain('facility_seed');

      // 3. Empty or missing waypoints
      const emptyWp = { schema_version: '1.0.0', facility_seed: 42, waypoints: [] };
      const resWp = validateMissionPlan(emptyWp);
      expect(resWp.valid).toBe(false);
      expect(resWp.error).toContain('Missing or empty waypoints');

      // 4. Corrupt coordinate values
      const corruptCoords = {
        schema_version: '1.0.0',
        facility_seed: 42,
        waypoints: [{ x: 0, y: 'corrupted' as any, z: 0 }],
      };
      const resCoords = validateMissionPlan(corruptCoords);
      expect(resCoords.valid).toBe(false);
      expect(resCoords.error).toContain('Invalid coordinate numbers at waypoint index 0');
    });
  });

  describe('WebMCP Tool: get_mission_plan (§5.3, §9)', () => {
    it('retrieves the active plan and logs execution to missionLog', async () => {
      const res = await getMissionPlanTool.execute({ include_execution_history: true });
      expect(res.isError).toBe(false);

      const data = JSON.parse(res.content[0].text);
      expect(data.status).toBe('OK');
      expect(data.mission_plan.schema_version).toBe('1.0.0');
      expect(data.mission_plan.facility_seed).toBe(42);
      expect(data.mission_plan.waypoints.length).toBe(3);

      // Verify log entry written
      const logs = useMissionStore.getState().missionLog;
      expect(logs.length).toBe(1);
      expect(logs[0].title).toBe('get_mission_plan');
      expect(logs[0].status).toBe('OK');
    });
  });

  describe('Deterministic Replay Lifecycle (§9)', () => {
    it('restores facility seed and stages proposal for deterministic replay playback', () => {
      const mockImportedPlan: AegisMissionPlanV1 = {
        schema_version: '1.0.0',
        exported_at: new Date().toISOString(),
        facility_seed: 108,
        mission_metadata: {
          title: 'Imported Route',
          total_waypoints_count: 4,
          estimated_duration_sec: 18.0,
          predicted_min_margin: 0.70,
          gait_profile: 'DYNAMIC_BALANCE',
        },
        target_waypoint: { x: 16, y: 0, z: -4 },
        waypoints: [
          { x: 0, y: 0, z: 0 },
          { x: 5, y: 0, z: -1 },
          { x: 10, y: 0, z: -2 },
          { x: 16, y: 0, z: -4 },
        ],
        mechanism_states: {},
        execution_history: [],
      };

      // Apply imported plan
      const store = useMissionStore.getState();
      store.setFacilitySeed(mockImportedPlan.facility_seed);
      store.stageProposal({
        id: 'replay-test-01',
        targetWaypoint: mockImportedPlan.target_waypoint,
        gaitProfile: mockImportedPlan.mission_metadata.gait_profile,
        waypoints: mockImportedPlan.waypoints,
        predictedMinMargin: mockImportedPlan.mission_metadata.predicted_min_margin,
        estimatedDurationSec: mockImportedPlan.mission_metadata.estimated_duration_sec,
        requiredMechanisms: [],
        stagedAt: Date.now(),
      });
      store.setApprovalStatus('EXECUTING');

      // Verify store state
      const updated = useMissionStore.getState();
      expect(updated.facilitySeed).toBe(108);
      expect(updated.approvalStatus).toBe('EXECUTING');
      expect(updated.stagedProposal?.waypoints.length).toBe(4);
      expect(updated.stagedProposal?.gaitProfile).toBe('DYNAMIC_BALANCE');
    });
  });
});

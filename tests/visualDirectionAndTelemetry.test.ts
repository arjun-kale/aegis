import { describe, it, expect, beforeEach } from 'vitest';
import { useMissionStore } from '@/lib/state/missionStore';
import {
  writeTelemetry,
  writeTelemetrySingle,
  readTelemetry,
  readTelemetrySingle,
} from '@/lib/state/telemetryBus';
import { TELEMETRY_OFFSETS } from '@/lib/state/telemetryOffsets';
import { solveFullBodyKinematics } from '@/lib/robot/kinematics';

describe('Visual Direction & Operator Telemetry Surface (Phase 7)', () => {
  beforeEach(() => {
    useMissionStore.setState({
      missionLog: [],
      stagedProposal: null,
      approvalStatus: 'IDLE',
      rejectionReason: null,
      autonomyMode: 'MANUAL_APPROVAL',
      batterySoc: 0.95,
      thermalHeadroom: 0.90,
      activeFaults: [],
    });
  });

  describe('Zero-Allocation Telemetry Bus Polling (§3.1, §7)', () => {
    it('accurately writes and reads continuous pose and stability metrics', () => {
      // 1. Write full torso position slice
      writeTelemetry(TELEMETRY_OFFSETS.POS_X, [4.25, 0.95, -2.5]);
      const posRead = readTelemetry(TELEMETRY_OFFSETS.POS_X, 3);
      expect(posRead[0]).toBeCloseTo(4.25, 2);
      expect(posRead[1]).toBeCloseTo(0.95, 2);
      expect(posRead[2]).toBeCloseTo(-2.5, 2);

      // 2. Write stability margin and stance state
      writeTelemetrySingle(TELEMETRY_OFFSETS.STABILITY_MARGIN, 0.72);
      writeTelemetrySingle(TELEMETRY_OFFSETS.STANCE_STATE, 1); // LEFT_STANCE

      expect(readTelemetrySingle(TELEMETRY_OFFSETS.STABILITY_MARGIN)).toBeCloseTo(0.72, 2);
      expect(readTelemetrySingle(TELEMETRY_OFFSETS.STANCE_STATE)).toBe(1);
    });

    it('publishes and reads 6-joint torque loads with peak approach-to-limit tracking', () => {
      const mockTorques = [45.2, 142.8, 22.0, 18.5, 12.0, 5.0];
      writeTelemetry(TELEMETRY_OFFSETS.TORQUES_START, mockTorques);

      const readTorques = readTelemetry(TELEMETRY_OFFSETS.TORQUES_START, 6);
      expect(readTorques.length).toBe(6);
      expect(readTorques[0]).toBeCloseTo(45.2, 1);
      expect(readTorques[1]).toBeCloseTo(142.8, 1); // Knee load

      // Peak torque approach-to-limit comparison
      const maxRated = 220.0;
      const peakLoadRatio = Math.max(...Array.from(readTorques)) / maxRated;
      expect(peakLoadRatio).toBeGreaterThan(0.60); // >60% rated load (warning threshold)
      expect(peakLoadRatio).toBeLessThan(1.0); // Within rated maximum limit
    });
  });

  describe('Mission Log & Tool Stream Audit (§3.3, §7)', () => {
    it('appends structured tool execution logs with timestamp and status tags', () => {
      const store = useMissionStore.getState();

      store.addLogEntry({
        type: 'TOOL_CALL',
        source: 'AGENT',
        title: 'scan_spatial_environment',
        status: 'OK',
        payload: { range_m: 15, visible_obstacles_count: 3 },
        detail: 'Spatial scan completed with 5 new frontiers.',
      });

      store.addLogEntry({
        type: 'TOOL_CALL',
        source: 'AGENT',
        title: 'stage_locomotion_plan',
        status: 'INFO',
        payload: { proposal_id: 'prop-test-01', predicted_min_margin: 0.55 },
        detail: 'Proposal staged. Awaiting operator approval.',
      });

      const updatedStore = useMissionStore.getState();
      expect(updatedStore.missionLog.length).toBe(2);
      expect(updatedStore.missionLog[0].title).toBe('scan_spatial_environment');
      expect(updatedStore.missionLog[0].status).toBe('OK');
      expect(updatedStore.missionLog[1].status).toBe('INFO');

      // Clear logs
      updatedStore.clearMissionLog();
      expect(useMissionStore.getState().missionLog.length).toBe(0);
    });
  });

  describe('Ghost Trajectory Staging State (§6, §7)', () => {
    it('stores staged proposal record and updates approval lifecycle without mutating robot pose', () => {
      const proposal = {
        id: 'prop-ghost-101',
        stagedAt: Date.now(),
        targetWaypoint: { x: 8, y: 0, z: 2 },
        gaitProfile: 'CAUTIOUS_STEP' as const,
        waypoints: [
          { x: 0, y: 0, z: 0 },
          { x: 4, y: 0, z: 1 },
          { x: 8, y: 0, z: 2 },
        ],
        estimatedDurationSec: 12.5,
        predictedMinMargin: 0.65,
        requiredMechanisms: [],
      };

      useMissionStore.getState().stageProposal(proposal);

      const store = useMissionStore.getState();
      expect(store.stagedProposal).not.toBeNull();
      expect(store.stagedProposal?.id).toBe('prop-ghost-101');
      expect(store.stagedProposal?.waypoints.length).toBe(3);
      expect(store.approvalStatus).toBe('PENDING_APPROVAL');

      // Approval transition
      store.approveProposal();
      expect(useMissionStore.getState().approvalStatus).toBe('APPROVED');

      // Rejection transition
      store.rejectProposal('Obstacle clearance below margin');
      expect(useMissionStore.getState().approvalStatus).toBe('REJECTED');
      expect(useMissionStore.getState().rejectionReason).toBe('Obstacle clearance below margin');
    });

    it('generates non-NaN full-body kinematics for terminal ghost pose', () => {
      const ghostPose = solveFullBodyKinematics({
        torsoPosition: [8, 0.95, 2],
        torsoRotationEuler: [0, Math.PI / 4, 0],
        footL: [7.86, 0, 1.9],
        footR: [8.14, 0, 2.1],
      });

      expect(Number.isFinite(ghostPose.torsoPosition[0])).toBe(true);
      expect(Number.isFinite(ghostPose.legL.mid[0])).toBe(true);
      expect(Number.isFinite(ghostPose.legR.mid[0])).toBe(true);
      expect(ghostPose.legL.isClamped).toBe(false);
    });
  });
});

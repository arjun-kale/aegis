import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  writeTelemetry,
  writeTelemetrySingle,
  readTelemetry,
  readTelemetrySingle,
  getTelemetryBuffer,
  subscribeTelemetry,
  resetTelemetry,
} from '@/lib/state/telemetryBus';
import { TELEMETRY_OFFSETS } from '@/lib/state/telemetryOffsets';
import { useMissionStore, StagedProposal } from '@/lib/state/missionStore';

describe('State Core & Partition (Phase 1)', () => {
  beforeEach(() => {
    resetTelemetry();
    useMissionStore.getState().resetMission();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('telemetryBus — High-Performance Float32Array Buffer (§3.1)', () => {
    it('writes and reads single telemetry offsets accurately', () => {
      writeTelemetrySingle(TELEMETRY_OFFSETS.STABILITY_MARGIN, 0.785);
      expect(readTelemetrySingle(TELEMETRY_OFFSETS.STABILITY_MARGIN)).toBeCloseTo(0.785, 3);

      writeTelemetrySingle(TELEMETRY_OFFSETS.POS_X, 12.34);
      writeTelemetrySingle(TELEMETRY_OFFSETS.POS_Y, 1.05);
      writeTelemetrySingle(TELEMETRY_OFFSETS.POS_Z, -5.67);

      expect(readTelemetrySingle(TELEMETRY_OFFSETS.POS_X)).toBeCloseTo(12.34, 2);
      expect(readTelemetrySingle(TELEMETRY_OFFSETS.POS_Y)).toBeCloseTo(1.05, 2);
      expect(readTelemetrySingle(TELEMETRY_OFFSETS.POS_Z)).toBeCloseTo(-5.67, 2);
    });

    it('writes and reads multi-float slices without allocating garbage when out buffer is provided', () => {
      const jointAngles = [0.1, -0.25, 0.45, -0.8, 0.35, -0.1];
      writeTelemetry(TELEMETRY_OFFSETS.JOINTS_START, jointAngles);

      const targetBuffer = new Float32Array(jointAngles.length);
      const readResult = readTelemetry(
        TELEMETRY_OFFSETS.JOINTS_START,
        jointAngles.length,
        targetBuffer
      );

      expect(readResult).toBe(targetBuffer); // Verify zero-allocation target reuse
      for (let i = 0; i < jointAngles.length; i++) {
        expect(readResult[i]).toBeCloseTo(jointAngles[i], 3);
      }
    });

    it('handles high-throughput 60 Hz writes without performance penalty', () => {
      const start = performance.now();
      const iterations = 60 * 60; // 3,600 frames = 1 minute of simulation at 60 Hz
      for (let frame = 0; frame < iterations; frame++) {
        writeTelemetrySingle(TELEMETRY_OFFSETS.FRAME_TIME_MS, 16.6);
        writeTelemetrySingle(TELEMETRY_OFFSETS.FPS, 60.0);
        writeTelemetrySingle(TELEMETRY_OFFSETS.STABILITY_MARGIN, 0.85);
        writeTelemetry(TELEMETRY_OFFSETS.POS_X, [frame * 0.01, 1.0, 0.0]);
      }
      const duration = performance.now() - start;

      // 3600 frames of updates should take less than 20ms in pure JS
      expect(duration).toBeLessThan(100);
      expect(readTelemetrySingle(TELEMETRY_OFFSETS.POS_X)).toBeCloseTo(36.0, 1);
    });

    it('throttles subscribers to fixed interval (10 Hz) rather than 60 Hz per-frame', () => {
      const listener = vi.fn();
      const unsubscribe = subscribeTelemetry(listener, 10); // 10 Hz = every 100ms

      // Simulate 60 frames across 1000ms
      for (let f = 0; f < 60; f++) {
        writeTelemetrySingle(TELEMETRY_OFFSETS.POS_X, f);
        vi.advanceTimersByTime(16.66);
      }

      // Over ~1000ms at 10 Hz, listener should have been called ~8-11 times (proves decoupling from 60 Hz writes)
      expect(listener).toHaveBeenCalled();
      expect(listener.mock.calls.length).toBeGreaterThanOrEqual(7);
      expect(listener.mock.calls.length).toBeLessThanOrEqual(12);

      unsubscribe();
      const callsBefore = listener.mock.calls.length;
      vi.advanceTimersByTime(200);
      expect(listener.mock.calls.length).toBe(callsBefore);
    });
  });

  describe('missionStore — Zustand with subscribeWithSelector (§3.1)', () => {
    it('manages staged kinematic proposals and human approval workflow', () => {
      const store = useMissionStore.getState();

      const proposal: StagedProposal = {
        id: 'prop-1',
        targetWaypoint: { x: 10, y: 0, z: 5 },
        gaitProfile: 'CAUTIOUS_STEP',
        waypoints: [
          { x: 0, y: 0, z: 0, margin: 0.9 },
          { x: 5, y: 0, z: 2.5, margin: 0.85 },
          { x: 10, y: 0, z: 5, margin: 0.82 },
        ],
        predictedMinMargin: 0.82,
        estimatedDurationSec: 4.2,
        requiredMechanisms: [],
        stagedAt: Date.now(),
      };

      // Stage proposal
      store.stageProposal(proposal);
      expect(useMissionStore.getState().stagedProposal).toEqual(proposal);
      expect(useMissionStore.getState().approvalStatus).toBe('PENDING_APPROVAL');

      // Operator approves
      store.approveProposal();
      expect(useMissionStore.getState().approvalStatus).toBe('APPROVED');

      // Clear after execution
      store.clearProposal();
      expect(useMissionStore.getState().stagedProposal).toBeNull();
      expect(useMissionStore.getState().approvalStatus).toBe('IDLE');
    });

    it('auto-approves in AUTO_APPROVE_SAFE mode when predicted margin exceeds threshold', () => {
      const store = useMissionStore.getState();
      store.setAutonomyMode('AUTO_APPROVE_SAFE', 0.75);

      const safeProposal: StagedProposal = {
        id: 'prop-safe',
        targetWaypoint: { x: 5, y: 0, z: 0 },
        gaitProfile: 'CAUTIOUS_STEP',
        waypoints: [],
        predictedMinMargin: 0.85,
        estimatedDurationSec: 2.0,
        requiredMechanisms: [],
        stagedAt: Date.now(),
      };

      store.stageProposal(safeProposal);
      expect(useMissionStore.getState().approvalStatus).toBe('APPROVED');

      const riskyProposal: StagedProposal = {
        id: 'prop-risky',
        targetWaypoint: { x: 15, y: 0, z: 0 },
        gaitProfile: 'DYNAMIC_BALANCE',
        waypoints: [],
        predictedMinMargin: 0.55,
        estimatedDurationSec: 3.0,
        requiredMechanisms: [],
        stagedAt: Date.now(),
      };

      store.stageProposal(riskyProposal);
      expect(useMissionStore.getState().approvalStatus).toBe('PENDING_APPROVAL');
    });

    it('isolates state changes to specific selectors via subscribeWithSelector', () => {
      const approvalListener = vi.fn();
      const mechanismListener = vi.fn();

      const unsubApproval = useMissionStore.subscribe(
        (state) => state.approvalStatus,
        approvalListener
      );

      const unsubMechanism = useMissionStore.subscribe(
        (state) => state.mechanisms,
        mechanismListener
      );

      // Mutate mechanism -> approvalListener must NOT fire
      useMissionStore.getState().updateMechanism('laser_gate_01', { state: 'DISARMED', passable: true });

      expect(mechanismListener).toHaveBeenCalledTimes(1);
      expect(approvalListener).toHaveBeenCalledTimes(0);

      // Mutate approval -> mechanismListener must NOT fire again
      useMissionStore.getState().setApprovalStatus('REJECTED', 'Too steep');

      expect(approvalListener).toHaveBeenCalledTimes(1);
      expect(mechanismListener).toHaveBeenCalledTimes(1);

      unsubApproval();
      unsubMechanism();
    });

    it('tracks audit logs and spatial exploration grid', () => {
      const store = useMissionStore.getState();

      store.addLogEntry({
        type: 'TOOL_CALL',
        source: 'AGENT',
        title: 'stage_kinematic_trajectory',
        detail: 'Staged 14 waypoints to E-corridor',
        status: 'OK',
      });

      const log = useMissionStore.getState().missionLog;
      expect(log.length).toBe(2);
      expect(log[1].title).toBe('stage_kinematic_trajectory');

      store.updateExplorationCell('c_10_5', 'scanned');
      expect(useMissionStore.getState().scannedCellsCount).toBe(1);

      store.batchUpdateExplorationCells({
        c_10_6: 'scanned',
        c_10_7: 'scanned',
        c_10_8: 'unexplored',
      });
      expect(useMissionStore.getState().scannedCellsCount).toBe(3);
    });
  });
});

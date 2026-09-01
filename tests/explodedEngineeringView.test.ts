import { describe, it, expect, beforeEach } from 'vitest';
import { useMissionStore } from '@/lib/state/missionStore';
import { setExplodedEngineeringViewTool } from '@/lib/webmcp/tools/set_exploded_engineering_view';
import { ROBOT_RIG } from '@/lib/robot/rig';
import { writeTelemetry } from '@/lib/state/telemetryBus';
import { TELEMETRY_OFFSETS } from '@/lib/state/telemetryOffsets';

describe('Exploded Engineering View & Stress Inspection (Phase 8)', () => {
  beforeEach(() => {
    useMissionStore.setState({
      disassemblyFactor: 0.0,
      missionLog: [],
      thermalHeadroom: 0.85,
    });
  });

  describe('WebMCP Tool: set_exploded_engineering_view (§5.3, §8)', () => {
    it('rejects invalid disassembly factor inputs with structured error envelope', async () => {
      // Negative factor
      const resNeg = await setExplodedEngineeringViewTool.execute({
        disassembly_factor: -0.2,
      });
      expect(resNeg.isError).toBe(true);
      const errNeg = JSON.parse(resNeg.content[0].text);
      expect(errNeg.status).toBe('INVALID_PARAMETER');

      // Greater than 1.0
      const resOver = await setExplodedEngineeringViewTool.execute({
        disassembly_factor: 1.5,
      });
      expect(resOver.isError).toBe(true);

      // Non-numeric
      const resNaN = await setExplodedEngineeringViewTool.execute({
        disassembly_factor: NaN as any,
      });
      expect(resNaN.isError).toBe(true);
    });

    it('rejects unrecognized part filter enum values', async () => {
      const res = await setExplodedEngineeringViewTool.execute({
        disassembly_factor: 0.5,
        part_filter: 'WINGS' as any,
      });
      expect(res.isError).toBe(true);
      const data = JSON.parse(res.content[0].text);
      expect(data.status).toBe('INVALID_PARAMETER');
      expect(data.reason).toContain('Allowed filters');
    });

    it('smoothly sets disassembly factor in mission store and returns subsystem telemetry', async () => {
      // Simulate live knee torque
      writeTelemetry(TELEMETRY_OFFSETS.TORQUES_START, [20, 145.5, 10, 25, 80.0, 12]);

      const res = await setExplodedEngineeringViewTool.execute({
        disassembly_factor: 0.75,
        part_filter: 'ALL',
      });

      expect(res.isError).toBe(false);
      const data = JSON.parse(res.content[0].text);

      expect(data.status).toBe('OK');
      expect(data.disassembly_factor).toBe(0.75);
      expect(data.active_parts_count).toBe(6);

      // Verify mission store updated
      expect(useMissionStore.getState().disassemblyFactor).toBe(0.75);

      // Verify knee_l live torque reported
      const kneeLSub = data.subsystems.find((s: any) => s.part_id === 'knee_l');
      expect(kneeLSub).toBeDefined();
      expect(kneeLSub.current_load_nm).toBeCloseTo(145.5, 1);
      expect(kneeLSub.rated_torque_nm).toBe(320);

      // Verify structured missionLog entry written
      const logs = useMissionStore.getState().missionLog;
      expect(logs.length).toBe(1);
      expect(logs[0].title).toBe('set_exploded_engineering_view');
      expect(logs[0].status).toBe('OK');
    });

    it('correctly filters subsystems when part_filter is specified', async () => {
      const resLegs = await setExplodedEngineeringViewTool.execute({
        disassembly_factor: 0.5,
        part_filter: 'LEGS',
      });

      expect(resLegs.isError).toBe(false);
      const dataLegs = JSON.parse(resLegs.content[0].text);
      expect(dataLegs.part_filter).toBe('LEGS');
      expect(dataLegs.subsystems.every((s: any) => s.part_id.includes('knee') || s.part_id.includes('hip'))).toBe(true);

      const resHead = await setExplodedEngineeringViewTool.execute({
        disassembly_factor: 0.0,
        part_filter: 'HEAD',
      });
      const dataHead = JSON.parse(resHead.content[0].text);
      expect(dataHead.subsystems.length).toBe(1);
      expect(dataHead.subsystems[0].part_id).toBe('head');
    });
  });

  describe('Rig Data & Component Stress Thresholds (§1.2, §1.5)', () => {
    it('defines valid rated torque and thermal limits for all robot parts', () => {
      const partIds = Object.keys(ROBOT_RIG.parts);
      expect(partIds.length).toBeGreaterThan(10);

      partIds.forEach((id) => {
        const part = ROBOT_RIG.parts[id];
        expect(part.ratedTorqueNm).toBeGreaterThan(0);
        expect(part.ratedTempC).toBeGreaterThan(50);
        expect(part.massKg).toBeGreaterThan(0);
      });
    });
  });
});

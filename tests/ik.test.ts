import { describe, it, expect } from 'vitest';
import { solveTwoBoneIK } from '@/lib/robot/ik';
import { ROBOT_RIG } from '@/lib/robot/rig';
import { solveFullBodyKinematics } from '@/lib/robot/kinematics';

describe('Inverse Kinematics & Robot Rig (Phase 2)', () => {
  const l1 = ROBOT_RIG.limbs.legL.l1; // 0.42m
  const l2 = ROBOT_RIG.limbs.legL.l2; // 0.42m
  const maxReach = l1 + l2;          // 0.84m

  describe('Analytical 2-Bone IK Edge Cases & Zero-NaN Contract (§1.1, §2)', () => {
    it('solves reachable targets accurately with correct segment lengths', () => {
      const root: [number, number, number] = [0, 1.0, 0];
      const target: [number, number, number] = [0, 0.35, 0.2]; // Reachable bend

      const sol = solveTwoBoneIK({
        root,
        target,
        l1,
        l2,
        poleVector: [0, 0, 1],
      });

      expect(sol.isClamped).toBe(false);
      expect(Number.isFinite(sol.midAngleRad)).toBe(true);
      expect(sol.midAngleRad).toBeGreaterThan(0.1);

      // Verify bone segment 1 length (root -> mid)
      const d1 = Math.sqrt(
        (sol.mid[0] - sol.root[0]) ** 2 +
        (sol.mid[1] - sol.root[1]) ** 2 +
        (sol.mid[2] - sol.root[2]) ** 2
      );
      expect(d1).toBeCloseTo(l1, 3);

      // Verify bone segment 2 length (mid -> end)
      const d2 = Math.sqrt(
        (sol.end[0] - sol.mid[0]) ** 2 +
        (sol.end[1] - sol.mid[1]) ** 2 +
        (sol.end[2] - sol.mid[2]) ** 2
      );
      expect(d2).toBeCloseTo(l2, 3);

      // Verify effective end matches target
      expect(sol.end[0]).toBeCloseTo(target[0], 3);
      expect(sol.end[1]).toBeCloseTo(target[1], 3);
      expect(sol.end[2]).toBeCloseTo(target[2], 3);
    });

    it('solves exactly-reachable extension (d = l1 + l2 - eps) without NaN or singularity crash', () => {
      const root: [number, number, number] = [0, 1.0, 0];
      const target: [number, number, number] = [0, 1.0 - (maxReach - 1e-3), 0];

      const sol = solveTwoBoneIK({
        root,
        target,
        l1,
        l2,
        poleVector: [0, 0, 1],
      });

      expect(Number.isNaN(sol.midAngleRad)).toBe(false);
      expect(Number.isFinite(sol.midAngleRad)).toBe(true);
      expect(sol.midAngleRad).toBeLessThan(0.1); // Nearly straight
      expect(sol.isClamped).toBe(false);
    });

    it('clamps overreach targets (d > l1 + l2) cleanly with isClamped: true and zero NaN', () => {
      const root: [number, number, number] = [0, 1.0, 0];
      const farTarget: [number, number, number] = [0, -1.5, 2.0]; // Dist ~3.2m >> 0.84m

      const sol = solveTwoBoneIK({
        root,
        target: farTarget,
        l1,
        l2,
        poleVector: [0, 0, 1],
      });

      expect(sol.isClamped).toBe(true);
      expect(sol.clampedDistance).toBeLessThanOrEqual(maxReach);
      expect(Number.isFinite(sol.midAngleRad)).toBe(true);
      expect(Number.isNaN(sol.mid[0])).toBe(false);
      expect(Number.isNaN(sol.end[0])).toBe(false);
    });

    it('handles degenerate zero-distance targets (target-at-root d = 0) gracefully', () => {
      const root: [number, number, number] = [0.14, 0.95, 0.0];
      const targetAtRoot: [number, number, number] = [0.14, 0.95, 0.0];

      const sol = solveTwoBoneIK({
        root,
        target: targetAtRoot,
        l1,
        l2,
        poleVector: [0, 0, 1],
      });

      expect(sol.isClamped).toBe(true);
      expect(Number.isFinite(sol.midAngleRad)).toBe(true);
      expect(Number.isFinite(sol.mid[1])).toBe(true);
      expect(Number.isFinite(sol.end[1])).toBe(true);
      expect(Number.isNaN(sol.midAngleRad)).toBe(false);
    });

    it('handles minimum reach compression for unequal bone lengths (d < |l1 - l2|) without NaN', () => {
      const root: [number, number, number] = [0, 1.0, 0];
      const unequalL1 = 0.42;
      const unequalL2 = 0.20; // min reach difference = 0.22m
      const tightTarget: [number, number, number] = [0, 1.0 - 0.05, 0]; // 5cm from root (< 22cm)

      const sol = solveTwoBoneIK({
        root,
        target: tightTarget,
        l1: unequalL1,
        l2: unequalL2,
        poleVector: [0, 0, 1],
      });

      expect(sol.isClamped).toBe(true);
      expect(sol.clampedDistance).toBeGreaterThanOrEqual(unequalL1 - unequalL2);
      expect(sol.clampedDistance).toBeCloseTo(unequalL1 - unequalL2, 1);
      expect(Number.isFinite(sol.midAngleRad)).toBe(true);
      expect(Number.isFinite(sol.end[0])).toBe(true);
    });
  });

  describe('Pole Vector Orientation & No Inversion', () => {
    it('directs knee bend forward (+Z) when poleVector is [0, 0, 1]', () => {
      const root: [number, number, number] = [0, 0.8, 0];
      const target: [number, number, number] = [0, 0.2, 0];

      const sol = solveTwoBoneIK({
        root,
        target,
        l1,
        l2,
        poleVector: [0, 0, 1], // Forward knee
      });

      // Knee (mid.z) should be displaced positively in Z
      expect(sol.mid[2]).toBeGreaterThan(root[2]);
    });

    it('directs elbow bend backward (-Z) when poleVector is [0, 0, -1]', () => {
      const root: [number, number, number] = [0, 1.2, 0];
      const target: [number, number, number] = [0, 0.7, 0];

      const sol = solveTwoBoneIK({
        root,
        target,
        l1: ROBOT_RIG.limbs.armL.l1,
        l2: ROBOT_RIG.limbs.armL.l2,
        poleVector: [0, 0, -1], // Backward elbow
      });

      // Elbow (mid.z) should be displaced negatively in Z
      expect(sol.mid[2]).toBeLessThan(root[2]);
    });
  });

  describe('Kinematic Sweep Continuity Test (Zero Popping)', () => {
    it('sweeps foot target through full reachable envelope with continuous joint angles', () => {
      const root: [number, number, number] = [0, 0.95, 0];
      let prevAngle = -1;
      const steps = 200;

      // Sweep foot target along Z from -0.35m to +0.35m at constant height y=0.15
      for (let i = 0; i <= steps; i++) {
        const z = -0.35 + (0.7 * i) / steps;
        const target: [number, number, number] = [0, 0.15, z];

        const sol = solveTwoBoneIK({
          root,
          target,
          l1,
          l2,
          poleVector: [0, 0, 1],
        });

        expect(Number.isFinite(sol.midAngleRad)).toBe(true);

        if (prevAngle !== -1) {
          const deltaAngle = Math.abs(sol.midAngleRad - prevAngle);
          // Angle change per small delta step should be smooth (< 0.1 rad per step)
          expect(deltaAngle).toBeLessThan(0.1);
        }

        prevAngle = sol.midAngleRad;
      }
    });
  });

  describe('Full Body Kinematics Coordinator', () => {
    it('solves complete humanoid body pose and updates telemetry', () => {
      const targets = {
        torsoPosition: [0, 0.95, 0] as [number, number, number],
        torsoRotationEuler: [0, 0, 0] as [number, number, number],
        footL: [-0.14, 0.0, 0.0] as [number, number, number],
        footR: [0.14, 0.0, 0.0] as [number, number, number],
        handL: [-0.28, 0.55, 0.05] as [number, number, number],
        handR: [0.28, 0.55, 0.05] as [number, number, number],
      };

      const pose = solveFullBodyKinematics(targets);

      expect(pose.legL).toBeDefined();
      expect(pose.legR).toBeDefined();
      expect(pose.armL).toBeDefined();
      expect(pose.armR).toBeDefined();

      expect(pose.legL.end[1]).toBeCloseTo(0.0, 2);
      expect(pose.legR.end[1]).toBeCloseTo(0.0, 2);
    });
  });
});

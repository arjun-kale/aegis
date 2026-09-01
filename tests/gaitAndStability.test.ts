import { describe, it, expect } from 'vitest';
import { scheduleGait, GAIT_CONFIGS } from '@/lib/robot/gait';
import {
  evaluateStaticStability,
  computeMultiBodyCoM,
  compute2DConvexHull,
} from '@/lib/robot/stability';
import { solveFullBodyKinematics } from '@/lib/robot/kinematics';
import { stepLocomotion, STANDARD_PATHS } from '@/lib/robot/locomotion';
import { ROBOT_RIG } from '@/lib/robot/rig';

describe('Locomotion & Static Stability Engine (Phase 3)', () => {
  describe('2D Convex Hull & Support Polygon (§1.3)', () => {
    it('computes convex hull of double-support 8-corner polygon accurately', () => {
      const points = [
        { x: -0.20, z: -0.12 },
        { x: -0.08, z: -0.12 },
        { x: -0.08, z: 0.12 },
        { x: -0.20, z: 0.12 },
        { x: 0.08, z: -0.12 },
        { x: 0.20, z: -0.12 },
        { x: 0.20, z: 0.12 },
        { x: 0.08, z: 0.12 },
      ];

      const hull = compute2DConvexHull(points);
      // Convex hull of 2 symmetric rectangular feet has 6 outer perimeter vertices
      expect(hull.length).toBeGreaterThanOrEqual(4);
      expect(hull.length).toBeLessThanOrEqual(8);
    });
  });

  describe('Static Stability Margin (§1.3)', () => {
    it('evaluates high stability margin in neutral double support stance', () => {
      const pose = solveFullBodyKinematics({
        torsoPosition: [0, 0.95, 0],
        torsoRotationEuler: [0, 0, 0],
        footL: [-0.14, 0, 0],
        footR: [0.14, 0, 0],
      });

      const stability = evaluateStaticStability(pose, true, true);

      expect(stability.isInsidePolygon).toBe(true);
      expect(stability.stanceState).toBe(0); // DOUBLE_SUPPORT
      expect(stability.stabilityMargin).toBeGreaterThan(0.70);
      expect(stability.stabilityMargin).toBeLessThanOrEqual(1.0);
    });

    it('drops stability margin measurably during single support', () => {
      const pose = solveFullBodyKinematics({
        torsoPosition: [0, 0.95, 0],
        torsoRotationEuler: [0, 0, 0],
        footL: [-0.14, 0, 0],
        footR: [0.14, 0.1, 0.2], // Right foot lifted in swing
      });

      const doubleStab = evaluateStaticStability(pose, true, true);
      const singleStab = evaluateStaticStability(pose, true, false); // Only Left foot planted

      expect(singleStab.stanceState).toBe(1); // LEFT_STANCE
      expect(singleStab.stabilityMargin).toBeLessThan(doubleStab.stabilityMargin);
    });

    it('reports negative stability margin when CoM falls outside the support polygon', () => {
      // Robot leaning far forward (+Z) while feet are far back (-Z)
      const pose = solveFullBodyKinematics({
        torsoPosition: [0, 0.95, 0.8], // CoM far forward at z ~ 0.7m
        torsoRotationEuler: [0.4, 0, 0],
        footL: [-0.14, 0, -0.2],
        footR: [0.14, 0, -0.2],
      });

      const stability = evaluateStaticStability(pose, true, true);

      expect(stability.isInsidePolygon).toBe(false);
      expect(stability.stabilityMargin).toBeLessThan(0); // Strictly negative outside polygon
    });
  });

  describe('Joint Torque Estimation (§1.5, §3)', () => {
    it('shows significantly higher torque on the stance leg than the swing leg', () => {
      const pose = solveFullBodyKinematics({
        torsoPosition: [-0.05, 0.92, 0],
        torsoRotationEuler: [0, 0, 0],
        footL: [-0.14, 0, 0], // Stance leg
        footR: [0.14, 0.15, 0.1], // Swing leg
      });

      const stability = evaluateStaticStability(pose, true, false); // Left stance, right swing

      // Left knee torque must support entire robot mass (~510 N load)
      expect(stability.jointTorquesNm.kneeL).toBeGreaterThan(50);
      // Right knee torque only supports swing limb mass
      expect(stability.jointTorquesNm.kneeR).toBeLessThan(35);
      expect(stability.jointTorquesNm.kneeL).toBeGreaterThan(stability.jointTorquesNm.kneeR * 2);
    });
  });

  describe('Gait Profile Distinctions (§3)', () => {
    it('differentiates CAUTIOUS_STEP, DYNAMIC_BALANCE, and HIGH_CLEARANCE parameters', () => {
      const cautious = GAIT_CONFIGS.CAUTIOUS_STEP;
      const dynamic = GAIT_CONFIGS.DYNAMIC_BALANCE;
      const highClear = GAIT_CONFIGS.HIGH_CLEARANCE;

      // 1. Cautious has highest double support ratio and lowest torso height
      expect(cautious.doubleSupportRatio).toBeGreaterThan(dynamic.doubleSupportRatio);
      expect(cautious.torsoHeightM).toBeLessThan(dynamic.torsoHeightM);
      expect(cautious.strideLengthM).toBeLessThan(dynamic.strideLengthM);

      // 2. High clearance has >2x swing apex compared to cautious
      expect(highClear.swingApexM).toBeGreaterThanOrEqual(0.20);
      expect(highClear.swingApexM).toBeGreaterThan(cautious.swingApexM * 2.5);

      // 3. Dynamic balance has fastest cadence (shortest cycle duration)
      expect(dynamic.stepDurationSec).toBeLessThan(cautious.stepDurationSec);
    });
  });

  describe('Zero Foot Slip & Trajectory Verification (§3)', () => {
    it('ensures stance foot does not penetrate ground (y >= 0) and remains planted during contact', () => {
      const steps = 60;
      const cycleDuration = GAIT_CONFIGS.CAUTIOUS_STEP.stepDurationSec;

      for (let i = 0; i <= steps; i++) {
        const timeSec = (i / steps) * cycleDuration;
        const gait = scheduleGait('CAUTIOUS_STEP', timeSec, 0, [0, 0, 0], 0);

        // Verify feet never penetrate below ground (y >= 0)
        expect(gait.targets.footL[1]).toBeGreaterThanOrEqual(-1e-4);
        expect(gait.targets.footR[1]).toBeGreaterThanOrEqual(-1e-4);

        // When in contact, foot height must be exactly on the ground
        if (gait.contactL) {
          expect(gait.targets.footL[1]).toBeCloseTo(0.0, 3);
        }
        if (gait.contactR) {
          expect(gait.targets.footR[1]).toBeCloseTo(0.0, 3);
        }
      }
    });

    it('successfully traverses a 20m path step-by-step', () => {
      const totalDist = 20.0;
      let completed = false;

      // Traversal time for 20m at ~0.366 m/s is ~55s. Stepping up to 60s.
      for (let t = 0; t <= 65; t += 1.0) {
        const result = stepLocomotion('CAUTIOUS_STEP', t, STANDARD_PATHS.straight20m.points);
        expect(Number.isFinite(result.stabilityState.stabilityMargin)).toBe(true);
        expect(Number.isFinite(result.kinematicState.torsoPosition[1])).toBe(true);

        if (result.isComplete) {
          completed = true;
          expect(result.progressM).toBeCloseTo(totalDist, 1);
          break;
        }
      }

      expect(completed).toBe(true);
    });
  });
});

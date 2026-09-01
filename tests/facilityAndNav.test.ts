import { describe, it, expect } from 'vitest';
import { generateFacility } from '@/lib/world/generator';
import { findAStarPath } from '@/lib/world/navigation';
import { performSpatialScan, findUnexploredFrontiers } from '@/lib/world/exploration';
import { raycast, queryRadius, hasLineOfSight } from '@/lib/world/spatialIndex';
import { applyMechanismCommand, FACILITY_MECHANISMS, getMechanismColliders } from '@/lib/world/mechanisms';
import { MechanismRecord } from '@/lib/state/missionStore';

describe('Facility Generation, Mechanisms, & Navigation Engine (Phase 4)', () => {
  describe('Deterministic Seeded Facility Generator (§4)', () => {
    it('produces byte-identical geometry and colliders for identical seed', () => {
      const facility1 = generateFacility(42);
      const facility2 = generateFacility(42);

      expect(facility1.wallTransforms.length).toBe(facility2.wallTransforms.length);
      expect(facility1.floorTransforms.length).toBe(facility2.floorTransforms.length);
      expect(facility1.colliders.length).toBe(facility2.colliders.length);
      expect(Object.keys(facility1.navGrid).length).toBe(Object.keys(facility2.navGrid).length);

      // Deep equality check
      expect(JSON.stringify(facility1)).toEqual(JSON.stringify(facility2));
    });

    it('generates multi-level facility with connecting ramp and extraction zone', () => {
      const facility = generateFacility(42);

      // Verify Level 0 Staging Point
      expect(facility.entryPoint).toEqual([0, 0, 0]);

      // Verify Level 1 Extraction Zone elevation (y = 2.5m)
      expect(facility.extractionPoint[1]).toBeCloseTo(2.5, 1);

      // Verify Ramp collider exists
      const ramp = facility.colliders.find((c) => c.type === 'RAMP');
      expect(ramp).toBeDefined();
    });
  });

  describe('Spatial Index & Raycasting (§1.4)', () => {
    it('performs accurate ray-AABB intersections against walls', () => {
      const facility = generateFacility(42);

      // Cast ray from [0, 1.5, 0] towards south wall at [0, 1.5, -6]
      const hit = raycast(facility.colliders, [0, 1.5, 0], [0, 0, -1], 20);

      expect(hit).not.toBeNull();
      expect(hit?.type).toBe('WALL');
      expect(hit?.point[2]).toBeCloseTo(-5.85, 1);
      expect(hit?.distance).toBeCloseTo(5.85, 1);
    });

    it('performs spherical range queries finding nearby colliders', () => {
      const facility = generateFacility(42);
      const results = queryRadius(facility.colliders, [0, 0, 0], 8.0);

      expect(results.length).toBeGreaterThan(2);
      // Closest should be floor_staging
      expect(results[0].collider.id).toBe('floor_staging');
    });

    it('tests line-of-sight occlusion by walls', () => {
      const facility = generateFacility(42);

      // 1. Direct open view in staging hub
      expect(hasLineOfSight(facility.colliders, [0, 1.5, 0], [2, 1.5, 2])).toBe(true);

      // 2. View blocked by south wall (target at z = -10 behind wall at z = -6)
      expect(hasLineOfSight(facility.colliders, [0, 1.5, 0], [0, 1.5, -10])).toBe(false);
    });
  });

  describe('A* Navigation & Mechanism Blocker Detection (§3.5, §4)', () => {
    const defaultMechanisms: Record<string, MechanismRecord> = {
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
        state: 'ARMED', // Armed by default
        location: { x: 10, y: 0, z: 0 },
        passable: false,
      },
      sealed_door_01: {
        id: 'sealed_door_01',
        type: 'SEALED_DOOR',
        state: 'SEALED',
        location: { x: -8, y: 0, z: 0 },
        passable: false,
      },
    };

    it('detects BLOCKED_GEOMETRY and reports blockedBy: laser_gate_02 when corridor is armed', () => {
      const facility = generateFacility(42);

      // Route from Staging Hub [0, 0, 0] to Upper Extraction Zone [18, 2.5, 19]
      const result = findAStarPath(
        facility.navGrid,
        [0, 0, 0],
        facility.extractionPoint,
        defaultMechanisms
      );

      // Must be blocked because laser_gate_02 seals the only corridor to the ramp
      expect(result.path.length).toBe(0);
      expect(result.blockedBy).toBe('laser_gate_02');
    });

    it('opens path to Extraction immediately when laser_gate_02 is DEACTIVATED', () => {
      const facility = generateFacility(42);

      // Disarm laser_gate_02
      const updatedMechanisms = {
        ...defaultMechanisms,
        laser_gate_02: {
          ...defaultMechanisms.laser_gate_02,
          state: 'DISARMED' as const,
          passable: true,
        },
      };

      const result = findAStarPath(
        facility.navGrid,
        [0, 0, 0],
        facility.extractionPoint,
        updatedMechanisms
      );

      expect(result.blockedBy).toBeUndefined();
      expect(result.path.length).toBeGreaterThan(6);
      expect(result.cost).toBeLessThan(40);
    });

    it('mutates mechanism state cleanly via applyMechanismCommand', () => {
      const current = defaultMechanisms.laser_gate_02;
      const mutated = applyMechanismCommand('laser_gate_02', 'DEACTIVATE', current);

      expect(mutated.success).toBe(true);
      expect(mutated.newState.state).toBe('DISARMED');
      expect(mutated.newState.passable).toBe(true);

      const invalidCmd = applyMechanismCommand('laser_gate_02', 'INVALID_ACTION', current);
      expect(invalidCmd.success).toBe(false);
    });
  });

  describe('Line-of-Sight Spatial Exploration & Frontiers (§4)', () => {
    it('scans visible cells within radius while walls occlude hidden cells', () => {
      const facility = generateFacility(42);
      const initialGrid = {};

      // Scan from Staging Hub origin [0, 1.5, 0] with 10m radius
      const scan = performSpatialScan([0, 1.5, 0], 10, facility.colliders, initialGrid);

      expect(scan.newlyScannedCells.length).toBeGreaterThan(20);
      expect(scan.totalScannedCount).toBe(scan.newlyScannedCells.length);

      // Staging hub center must be scanned
      expect(scan.newlyScannedCells).toContain('c_0_0');

      // Cell deep behind south wall (z = -9) must NOT be scanned due to occlusion
      expect(scan.newlyScannedCells).not.toContain('c_0_-9');
    });

    it('detects unexplored frontier coordinates on the perimeter of discovered cells', () => {
      const grid = {
        c_0_0: 'scanned' as const,
        c_0_1: 'scanned' as const,
        c_1_0: 'scanned' as const,
      };

      const frontiers = findUnexploredFrontiers(grid, 0);

      expect(frontiers.length).toBeGreaterThan(0);
      // Frontiers must be adjacent to scanned cells
      expect(frontiers).toContainEqual([0, 0, 2]);
    });
  });
});

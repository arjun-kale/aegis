/**
 * Project A.E.G.I.S — Spatial Exploration & Line-of-Sight Scanner (§4)
 *
 * Implements:
 * - 2D/3D Discrete Exploration Grid map (1.0m resolution)
 * - Line-of-sight raycasting from scan origin (walls occlude discovery)
 * - Frontier coordinate detection for iterative agent exploration loops.
 */

import { CellExplorationStatus } from '../state/missionStore';
import { ColliderAABB } from './generator';
import { hasLineOfSight } from './spatialIndex';

export interface SpatialScanResult {
  scanOrigin: [number, number, number];
  scanRadiusM: number;
  newlyScannedCells: string[];
  totalScannedCount: number;
  unexploredFrontiers: [number, number, number][];
  detectedMechanisms: string[];
}

export function cellKey(x: number, z: number): string {
  return `c_${Math.round(x)}_${Math.round(z)}`;
}

export function parseCellKey(key: string): [number, number] {
  const parts = key.split('_');
  return [parseInt(parts[1], 10), parseInt(parts[2], 10)];
}

/**
 * Performs a line-of-sight spatial scan from origin.
 * Marks only cells visible to the scan origin within radius as 'scanned'.
 */
export function performSpatialScan(
  origin: [number, number, number],
  radius: number,
  colliders: ColliderAABB[],
  currentGrid: Record<string, CellExplorationStatus>
): SpatialScanResult {
  const [ox, oy, oz] = origin;
  const newlyScannedCells: string[] = [];
  const updatedGrid = { ...currentGrid };
  const detectedMechanisms = new Set<string>();

  const step = 1.0; // 1m resolution
  const minX = Math.floor(ox - radius);
  const maxX = Math.ceil(ox + radius);
  const minZ = Math.floor(oz - radius);
  const maxZ = Math.ceil(oz + radius);

  for (let x = minX; x <= maxX; x += step) {
    for (let z = minZ; z <= maxZ; z += step) {
      const dx = x - ox;
      const dz = z - oz;
      const distSq = dx * dx + dz * dz;

      if (distSq <= radius * radius) {
        const cellPos: [number, number, number] = [x, oy, z];
        const key = cellKey(x, z);

        // Check line-of-sight visibility
        const isVisible = hasLineOfSight(colliders, origin, cellPos);
        if (isVisible) {
          if (updatedGrid[key] !== 'scanned' && updatedGrid[key] !== 'traversed') {
            updatedGrid[key] = 'scanned';
            newlyScannedCells.push(key);
          }

          // Check if any mechanism is within visible scan range
          for (const c of colliders) {
            if (c.isMechanism && c.mechanismId) {
              const mx = (c.min[0] + c.max[0]) / 2;
              const mz = (c.min[2] + c.max[2]) / 2;
              const dMech = Math.sqrt((mx - ox) ** 2 + (mz - oz) ** 2);
              if (dMech <= radius && hasLineOfSight(colliders, origin, [mx, oy, mz])) {
                detectedMechanisms.add(c.mechanismId);
              }
            }
          }
        }
      }
    }
  }

  // Count total scanned
  let totalScanned = 0;
  for (const status of Object.values(updatedGrid)) {
    if (status === 'scanned' || status === 'traversed') totalScanned++;
  }

  // Find unexplored frontiers (cells adjacent to scanned cells that remain unexplored)
  const frontiers = findUnexploredFrontiers(updatedGrid, oy);

  return {
    scanOrigin: origin,
    scanRadiusM: radius,
    newlyScannedCells,
    totalScannedCount: totalScanned,
    unexploredFrontiers: frontiers,
    detectedMechanisms: Array.from(detectedMechanisms),
  };
}

/**
 * Finds unexplored frontier coordinates bordering the scanned region.
 */
export function findUnexploredFrontiers(
  grid: Record<string, CellExplorationStatus>,
  elevationY: number = 0
): [number, number, number][] {
  const frontiers: [number, number, number][] = [];
  const checked = new Set<string>();

  const offsets = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];

  for (const [key, status] of Object.entries(grid)) {
    if (status === 'scanned' || status === 'traversed') {
      const [cx, cz] = parseCellKey(key);

      for (const [dx, dz] of offsets) {
        const nx = cx + dx;
        const nz = cz + dz;
        const neighborKey = cellKey(nx, nz);

        if (!grid[neighborKey] || grid[neighborKey] === 'unexplored') {
          if (!checked.has(neighborKey)) {
            checked.add(neighborKey);
            // Limit frontier count to prevent overwhelming output
            if (frontiers.length < 12) {
              frontiers.push([nx, elevationY, nz]);
            }
          }
        }
      }
    }
  }

  return frontiers;
}

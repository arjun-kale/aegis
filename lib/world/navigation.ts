/**
 * Project A.E.G.I.S — Pure A* Navigation Grid Engine (§4)
 *
 * Implements A* pathfinding over the 3D NavGrid graph with:
 * - Euclidean distance heuristic
 * - Wall clearance penalty (favors wide open paths and corridor centers)
 * - Dynamic mechanism passability evaluation
 * - Blocker detection: returns blockedBy with the offending mechanismId
 *   to support the BLOCKED_GEOMETRY structured recovery loop (§3.5).
 */

import { NavNode } from './generator';
import { MechanismRecord } from '../state/missionStore';

export interface NavPathResult {
  path: [number, number, number][];
  cost: number;
  blockedBy?: string;
  visitedNodesCount: number;
  isDirectPath: boolean;
}

interface AStarNodeRecord {
  id: string;
  gScore: number;
  fScore: number;
  parent: string | null;
  blockedByMechanism?: string;
}

/**
 * Finds the nearest NavNode ID for any arbitrary 3D world position.
 */
export function findNearestNavNode(
  navGrid: Record<string, NavNode>,
  point: [number, number, number]
): string | null {
  const [px, py, pz] = point;
  let closestId: string | null = null;
  let closestDistSq = Infinity;

  for (const [id, node] of Object.entries(navGrid)) {
    const dx = node.x - px;
    const dy = node.y - py;
    const dz = node.z - pz;
    // Penalize elevation mismatch heavily
    const distSq = dx * dx + dy * dy * 4 + dz * dz;
    if (distSq < closestDistSq) {
      closestDistSq = distSq;
      closestId = id;
    }
  }

  return closestId;
}

/**
 * Pure A* pathfinder with clearance weighting and mechanism blocker analysis.
 */
export function findAStarPath(
  navGrid: Record<string, NavNode>,
  startPos: [number, number, number],
  goalPos: [number, number, number],
  mechanismStates: Record<string, MechanismRecord> = {}
): NavPathResult {
  const startId = findNearestNavNode(navGrid, startPos);
  const goalId = findNearestNavNode(navGrid, goalPos);

  if (!startId || !goalId || !navGrid[startId] || !navGrid[goalId]) {
    return {
      path: [],
      cost: Infinity,
      visitedNodesCount: 0,
      isDirectPath: false,
    };
  }

  const startNode = navGrid[startId];
  const goalNode = navGrid[goalId];

  // Helper heuristic: Euclidean distance
  const heuristic = (n: NavNode): number => {
    const dx = n.x - goalNode.x;
    const dy = n.y - goalNode.y;
    const dz = n.z - goalNode.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  };

  const openSet = new Set<string>([startId]);
  const nodesRecord: Record<string, AStarNodeRecord> = {
    [startId]: {
      id: startId,
      gScore: 0,
      fScore: heuristic(startNode),
      parent: null,
    },
  };
  const closedSet = new Set<string>();

  // Track if we encountered any mechanism blocker along optimal direction
  let primaryBlockerMechanism: string | undefined = undefined;

  while (openSet.size > 0) {
    // Pick node in openSet with lowest fScore
    let currentId: string | null = null;
    let lowestF = Infinity;
    for (const id of openSet) {
      const f = nodesRecord[id]?.fScore ?? Infinity;
      if (f < lowestF) {
        lowestF = f;
        currentId = id;
      }
    }

    if (!currentId) break;

    if (currentId === goalId) {
      // Reconstruct path
      const pathWaypoints: [number, number, number][] = [];
      let curr: string | null = goalId;
      while (curr) {
        const n = navGrid[curr];
        pathWaypoints.unshift([n.x, n.y, n.z]);
        curr = nodesRecord[curr]?.parent ?? null;
      }

      // Add exact goal if distinct
      const last = pathWaypoints[pathWaypoints.length - 1];
      if (
        Math.abs(last[0] - goalPos[0]) > 0.1 ||
        Math.abs(last[2] - goalPos[2]) > 0.1
      ) {
        pathWaypoints.push(goalPos);
      }

      return {
        path: pathWaypoints,
        cost: nodesRecord[goalId].gScore,
        visitedNodesCount: closedSet.size,
        isDirectPath: true,
      };
    }

    openSet.delete(currentId);
    closedSet.add(currentId);

    const currentNode = navGrid[currentId];
    const currentRecord = nodesRecord[currentId];

    for (const neighborId of currentNode.neighbors) {
      if (closedSet.has(neighborId)) continue;

      const neighborNode = navGrid[neighborId];
      if (!neighborNode) continue;

      // Check mechanism passability
      if (neighborNode.mechanismId) {
        const mech = mechanismStates[neighborNode.mechanismId];
        const isPassable = mech ? mech.passable : false;

        if (!isPassable) {
          // Node is sealed/armed by mechanism
          if (!primaryBlockerMechanism) {
            primaryBlockerMechanism = neighborNode.mechanismId;
          }
          continue; // Cannot traverse through sealed mechanism
        }
      }

      const dx = neighborNode.x - currentNode.x;
      const dy = neighborNode.y - currentNode.y;
      const dz = neighborNode.z - currentNode.z;
      const edgeDist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      // Wall clearance penalty: nodes with clearance < 1.0m receive extra cost penalty
      const clearancePenalty = Math.max(0, 1.2 - neighborNode.clearance) * 0.8;
      const tentativeG = currentRecord.gScore + edgeDist + clearancePenalty;

      const neighborRecord = nodesRecord[neighborId];
      if (!neighborRecord || tentativeG < neighborRecord.gScore) {
        nodesRecord[neighborId] = {
          id: neighborId,
          gScore: tentativeG,
          fScore: tentativeG + heuristic(neighborNode),
          parent: currentId,
        };
        openSet.add(neighborId);
      }
    }
  }

  // Path could not be found -> Return blockedBy mechanism if detected
  return {
    path: [],
    cost: Infinity,
    blockedBy: primaryBlockerMechanism,
    visitedNodesCount: closedSet.size,
    isDirectPath: false,
  };
}

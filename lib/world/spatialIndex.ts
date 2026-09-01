/**
 * Project A.E.G.I.S — Spatial Index & Collider Raycasting Module (§1.4)
 *
 * Implements brute-force spatial queries and fast ray-AABB intersections
 * over the static facility collider array.
 */

import { ColliderAABB } from './generator';

export interface RaycastHit {
  colliderId: string;
  point: [number, number, number];
  distance: number;
  normal: [number, number, number];
  type: ColliderAABB['type'];
  mechanismId?: string;
}

export interface SpatialQueryResult {
  collider: ColliderAABB;
  distance: number;
}

/**
 * Fast Ray-AABB intersection algorithm (Slab method).
 */
export function intersectRayAABB(
  origin: [number, number, number],
  direction: [number, number, number],
  box: ColliderAABB,
  maxDistance: number = 100
): RaycastHit | null {
  const [ox, oy, oz] = origin;
  const [dx, dy, dz] = direction;

  let tmin = -Infinity;
  let tmax = Infinity;
  let hitNormal: [number, number, number] = [0, 1, 0];

  // Axis X
  if (Math.abs(dx) > 1e-8) {
    let t1 = (box.min[0] - ox) / dx;
    let t2 = (box.max[0] - ox) / dx;
    let n1: [number, number, number] = [-1, 0, 0];
    let n2: [number, number, number] = [1, 0, 0];

    if (t1 > t2) {
      const tempT = t1;
      t1 = t2;
      t2 = tempT;
      const tempN = n1;
      n1 = n2;
      n2 = tempN;
    }

    if (t1 > tmin) {
      tmin = t1;
      hitNormal = n1;
    }
    tmax = Math.min(tmax, t2);

    if (tmin > tmax || tmax < 0) return null;
  } else {
    if (ox < box.min[0] || ox > box.max[0]) return null;
  }

  // Axis Y
  if (Math.abs(dy) > 1e-8) {
    let t1 = (box.min[1] - oy) / dy;
    let t2 = (box.max[1] - oy) / dy;
    let n1: [number, number, number] = [0, -1, 0];
    let n2: [number, number, number] = [0, 1, 0];

    if (t1 > t2) {
      const tempT = t1;
      t1 = t2;
      t2 = tempT;
      const tempN = n1;
      n1 = n2;
      n2 = tempN;
    }

    if (t1 > tmin) {
      tmin = t1;
      hitNormal = n1;
    }
    tmax = Math.min(tmax, t2);

    if (tmin > tmax || tmax < 0) return null;
  } else {
    if (oy < box.min[1] || oy > box.max[1]) return null;
  }

  // Axis Z
  if (Math.abs(dz) > 1e-8) {
    let t1 = (box.min[2] - oz) / dz;
    let t2 = (box.max[2] - oz) / dz;
    let n1: [number, number, number] = [0, 0, -1];
    let n2: [number, number, number] = [0, 0, 1];

    if (t1 > t2) {
      const tempT = t1;
      t1 = t2;
      t2 = tempT;
      const tempN = n1;
      n1 = n2;
      n2 = tempN;
    }

    if (t1 > tmin) {
      tmin = t1;
      hitNormal = n1;
    }
    tmax = Math.min(tmax, t2);

    if (tmin > tmax || tmax < 0) return null;
  } else {
    if (oz < box.min[2] || oz > box.max[2]) return null;
  }

  const hitDist = tmin > 0 ? tmin : tmax;
  if (hitDist < 0 || hitDist > maxDistance) return null;

  return {
    colliderId: box.id,
    point: [ox + dx * hitDist, oy + dy * hitDist, oz + dz * hitDist],
    distance: hitDist,
    normal: hitNormal,
    type: box.type,
    mechanismId: box.mechanismId,
  };
}

/**
 * Casts a ray against all colliders and returns the closest hit.
 */
export function raycast(
  colliders: ColliderAABB[],
  origin: [number, number, number],
  direction: [number, number, number],
  maxDistance: number = 50
): RaycastHit | null {
  // Normalize direction
  const len = Math.sqrt(direction[0] ** 2 + direction[1] ** 2 + direction[2] ** 2);
  const normDir: [number, number, number] =
    len > 1e-6
      ? [direction[0] / len, direction[1] / len, direction[2] / len]
      : [0, 0, 1];

  let closestHit: RaycastHit | null = null;
  let closestDist = maxDistance;

  for (const box of colliders) {
    const hit = intersectRayAABB(origin, normDir, box, closestDist);
    if (hit && hit.distance < closestDist) {
      closestHit = hit;
      closestDist = hit.distance;
    }
  }

  return closestHit;
}

/**
 * Performs a spherical range query against all colliders.
 */
export function queryRadius(
  colliders: ColliderAABB[],
  origin: [number, number, number],
  radius: number
): SpatialQueryResult[] {
  const [ox, oy, oz] = origin;
  const results: SpatialQueryResult[] = [];

  for (const box of colliders) {
    // Closest point on AABB
    const cx = Math.max(box.min[0], Math.min(ox, box.max[0]));
    const cy = Math.max(box.min[1], Math.min(oy, box.max[1]));
    const cz = Math.max(box.min[2], Math.min(oz, box.max[2]));

    const distSq = (ox - cx) ** 2 + (oy - cy) ** 2 + (oz - cz) ** 2;
    if (distSq <= radius * radius) {
      results.push({
        collider: box,
        distance: Math.sqrt(distSq),
      });
    }
  }

  return results.sort((a, b) => a.distance - b.distance);
}

/**
 * Tests direct line-of-sight visibility between two points.
 * Returns true if no wall or blocking mechanism collider obstructs the line.
 */
export function hasLineOfSight(
  colliders: ColliderAABB[],
  p1: [number, number, number],
  p2: [number, number, number]
): boolean {
  const dx = p2[0] - p1[0];
  const dy = p2[1] - p1[1];
  const dz = p2[2] - p1[2];
  const targetDist = Math.sqrt(dx * dx + dy * dy + dz * dz);

  if (targetDist < 1e-4) return true;

  const dir: [number, number, number] = [
    dx / targetDist,
    dy / targetDist,
    dz / targetDist,
  ];

  // Cast ray from p1 with slight epsilon offset
  const offsetOrigin: [number, number, number] = [
    p1[0] + dir[0] * 0.05,
    p1[1] + dir[1] * 0.05,
    p1[2] + dir[2] * 0.05,
  ];

  for (const box of colliders) {
    // Ignore floors and ramps for line-of-sight occlusion
    if (box.type === 'FLOOR' || box.type === 'RAMP') continue;

    const hit = intersectRayAABB(offsetOrigin, dir, box, targetDist - 0.1);
    if (hit && hit.distance < targetDist - 0.1) {
      return false; // Occluded
    }
  }

  return true;
}

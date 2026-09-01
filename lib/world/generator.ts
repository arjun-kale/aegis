/**
 * Project A.E.G.I.S — Seeded Procedural Facility Generator (§4)
 *
 * Generates a reproducible multi-level facility with:
 * - Level 0 (Ground level, y = 0): Staging Hub, East Corridor (blocked by laser_gate_02),
 *   West Corridor (sealed_door_01), Central Atrium, Freight Lift Shaft.
 * - Level 1 (Elevated level, y = 2.5m): Upper Observation Deck, Extraction Zone.
 * - 15° Incline Ramp connecting Level 0 to Level 1.
 * - Static Colliders array (AABBs) for spatial indexing and raycasting.
 * - NavGrid nodes for A* pathfinding.
 */

export interface ColliderAABB {
  id: string;
  type: 'WALL' | 'FLOOR' | 'RAMP' | 'MECHANISM_BARRIER' | 'OBSTACLE';
  min: [number, number, number];
  max: [number, number, number];
  isMechanism?: boolean;
  mechanismId?: string;
}

export interface NavNode {
  id: string;
  x: number;
  y: number;
  z: number;
  clearance: number; // Clearance distance to nearest wall (m)
  neighbors: string[]; // Neighbor node IDs
  mechanismId?: string; // If this node passes through a mechanism
}

export interface FacilityGeometryData {
  seed: number;
  wallTransforms: { position: [number, number, number]; scale: [number, number, number] }[];
  floorTransforms: { position: [number, number, number]; scale: [number, number, number] }[];
  rampTransforms: { position: [number, number, number]; rotation: [number, number, number]; scale: [number, number, number] }[];
  colliders: ColliderAABB[];
  navGrid: Record<string, NavNode>;
  entryPoint: [number, number, number];
  extractionPoint: [number, number, number];
}

/**
 * Fast deterministic PRNG (Mulberry32).
 */
export function createPRNG(seed: number) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generates the facility layout for a given seed.
 */
export function generateFacility(seed: number = 42): FacilityGeometryData {
  const rand = createPRNG(seed);

  const wallTransforms: { position: [number, number, number]; scale: [number, number, number] }[] = [];
  const floorTransforms: { position: [number, number, number]; scale: [number, number, number] }[] = [];
  const rampTransforms: { position: [number, number, number]; rotation: [number, number, number]; scale: [number, number, number] }[] = [];
  const colliders: ColliderAABB[] = [];
  const navGrid: Record<string, NavNode> = {};

  const WALL_HEIGHT = 3.0;
  const WALL_THICKNESS = 0.3;

  // Helper to add a wall block
  const addWall = (
    id: string,
    pos: [number, number, number],
    dim: [number, number, number]
  ) => {
    wallTransforms.push({
      position: pos,
      scale: dim,
    });

    colliders.push({
      id,
      type: 'WALL',
      min: [pos[0] - dim[0] / 2, pos[1] - dim[1] / 2, pos[2] - dim[2] / 2],
      max: [pos[0] + dim[0] / 2, pos[1] + dim[1] / 2, pos[2] + dim[2] / 2],
    });
  };

  // Helper to add a floor tile
  const addFloor = (
    id: string,
    pos: [number, number, number],
    dim: [number, number, number]
  ) => {
    floorTransforms.push({
      position: pos,
      scale: dim,
    });

    colliders.push({
      id,
      type: 'FLOOR',
      min: [pos[0] - dim[0] / 2, pos[1] - dim[1] / 2, pos[2] - dim[2] / 2],
      max: [pos[0] + dim[0] / 2, pos[1] + dim[1] / 2, pos[2] + dim[2] / 2],
    });
  };

  // --- 1. LEVEL 0 FLOORS & ROOMS ---
  // Staging Hub (Room A: [-6, 6] in X, [-6, 6] in Z, y = 0)
  addFloor('floor_staging', [0, -0.1, 0], [12, 0.2, 12]);

  // East Wing Corridor (Connecting Staging to Ramp & Lift)
  addFloor('floor_east_corridor', [10, -0.1, 0], [8, 0.2, 4]);

  // West Security Corridor (Connecting to Security Chamber)
  addFloor('floor_west_corridor', [-10, -0.1, 0], [8, 0.2, 4]);

  // North Atrium (Central Junction)
  addFloor('floor_atrium', [0, -0.1, 10], [14, 0.2, 8]);

  // --- 2. LEVEL 1 FLOORS & EXTRACTION (y = 2.5m) ---
  // Upper Observation Deck (Room B: [10, 20] in X, [8, 20] in Z, y = 2.5m)
  addFloor('floor_upper_deck', [15, 2.4, 14], [12, 0.2, 14]);

  // Extraction Platform
  addFloor('floor_extraction', [18, 2.4, 18], [6, 0.2, 6]);

  // --- 3. 15° INCLINE RAMP (Connecting y=0 to y=2.5 at [10, 0, 4] to [10, 2.5, 9]) ---
  const rampLength = 5.6;
  const rampAngle = Math.atan2(2.5, 5.0); // ~26.5°
  rampTransforms.push({
    position: [10, 1.25, 6.5],
    rotation: [-rampAngle, 0, 0],
    scale: [3.2, 0.2, rampLength],
  });
  colliders.push({
    id: 'ramp_01',
    type: 'RAMP',
    min: [8.4, 0, 4],
    max: [11.6, 2.5, 9],
  });

  // --- 4. WALLS & PARTITIONS ---
  // Staging Area Outer Walls
  addWall('wall_staging_south', [0, 1.5, -6], [12, WALL_HEIGHT, WALL_THICKNESS]);
  addWall('wall_staging_north_l', [-4, 1.5, 6], [4, WALL_HEIGHT, WALL_THICKNESS]);
  addWall('wall_staging_north_r', [4, 1.5, 6], [4, WALL_HEIGHT, WALL_THICKNESS]);
  addWall('wall_staging_west_s', [-6, 1.5, -3], [WALL_THICKNESS, WALL_HEIGHT, 6]);
  addWall('wall_staging_west_n', [-6, 1.5, 3], [WALL_THICKNESS, WALL_HEIGHT, 6]);
  addWall('wall_staging_east_s', [6, 1.5, -3], [WALL_THICKNESS, WALL_HEIGHT, 6]);
  addWall('wall_staging_east_n', [6, 1.5, 3], [WALL_THICKNESS, WALL_HEIGHT, 6]);

  // East Corridor Walls (Guarded by laser_gate_02)
  addWall('wall_east_north', [10, 1.5, 2], [8, WALL_HEIGHT, WALL_THICKNESS]);
  addWall('wall_east_south', [10, 1.5, -2], [8, WALL_HEIGHT, WALL_THICKNESS]);

  // West Corridor Walls (Guarded by sealed_door_01)
  addWall('wall_west_north', [-10, 1.5, 2], [8, WALL_HEIGHT, WALL_THICKNESS]);
  addWall('wall_west_south', [-10, 1.5, -2], [8, WALL_HEIGHT, WALL_THICKNESS]);
  addWall('wall_west_end', [-14, 1.5, 0], [WALL_THICKNESS, WALL_HEIGHT, 4]);

  // Atrium Walls
  addWall('wall_atrium_west', [-7, 1.5, 10], [WALL_THICKNESS, WALL_HEIGHT, 8]);
  addWall('wall_atrium_north', [0, 1.5, 14], [14, WALL_HEIGHT, WALL_THICKNESS]);

  // Upper Deck Walls
  addWall('wall_upper_south', [15, 4.0, 7], [12, WALL_HEIGHT, WALL_THICKNESS]);
  addWall('wall_upper_north', [15, 4.0, 21], [12, WALL_HEIGHT, WALL_THICKNESS]);
  addWall('wall_upper_east', [21, 4.0, 14], [WALL_THICKNESS, WALL_HEIGHT, 14]);

  // --- 5. DISCRETE NAVIGATION GRID GRAPH ---
  const gridPoints: [number, number, number, string?][] = [
    // Staging Hub Nodes (y = 0)
    [0, 0, 0], [-2, 0, 0], [2, 0, 0], [0, 0, -2], [0, 0, 2],
    [-2, 0, -2], [2, 0, -2], [-2, 0, 2], [2, 0, 2],
    [0, 0, 4], [0, 0, -4],

    // East Corridor (y = 0) -> laser_gate_02 barrier at [10, 0, 0]
    [4, 0, 0], [6, 0, 0], [8, 0, 0],
    [10, 0, 0, 'laser_gate_02'],
    [12, 0, 0], [12, 0, 2], [14, 0, 0],

    // West Corridor (y = 0) -> sealed_door_01 barrier at [-8, 0, 0]
    [-4, 0, 0], [-6, 0, 0],
    [-8, 0, 0, 'sealed_door_01'],
    [-10, 0, 0], [-12, 0, 0],

    // North Atrium (y = 0)
    [0, 0, 6], [0, 0, 8], [0, 0, 10], [0, 0, 12],
    [-2, 0, 10], [2, 0, 10], [-4, 0, 10], [4, 0, 10],

    // Ramp Nodes (Ascending from [12, 0, 2] -> [10, 0.5, 4] -> [10, 1.25, 6.5] -> [10, 2.0, 9] -> [10, 2.5, 11])
    [10, 0.5, 4], [10, 1.25, 6.5], [10, 2.0, 9],

    // Upper Deck Nodes (y = 2.5)
    [10, 2.5, 11], [12, 2.5, 11], [14, 2.5, 11], [16, 2.5, 11],
    [14, 2.5, 13], [14, 2.5, 15], [16, 2.5, 14], [18, 2.5, 14],
    [16, 2.5, 16], [16, 2.5, 18], [18, 2.5, 17], [18, 2.5, 19], // Extraction zone
  ];

  const getNodeKey = (x: number, y: number, z: number) =>
    `n_${Math.round(x)}_${Math.round(y * 10)}_${Math.round(z)}`;

  // Construct NavGrid nodes
  for (const pt of gridPoints) {
    const [x, y, z, mechanismId] = pt;
    const key = getNodeKey(x, y, z);

    // Compute clearance to nearest wall collider
    let minWallDist = 999;
    for (const c of colliders) {
      if (c.type === 'WALL') {
        const dx = Math.max(c.min[0] - x, 0, x - c.max[0]);
        const dz = Math.max(c.min[2] - z, 0, z - c.max[2]);
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < minWallDist) minWallDist = dist;
      }
    }

    navGrid[key] = {
      id: key,
      x,
      y,
      z,
      clearance: Math.round(minWallDist * 100) / 100,
      neighbors: [],
      mechanismId,
    };
  }

  // Connect adjacent nodes (Euclidean distance <= 2.95m and elevation delta <= 1.0m)
  const allNodes = Object.values(navGrid);
  for (let i = 0; i < allNodes.length; i++) {
    const n1 = allNodes[i];
    for (let j = i + 1; j < allNodes.length; j++) {
      const n2 = allNodes[j];
      const dx = n1.x - n2.x;
      const dy = n1.y - n2.y;
      const dz = n1.z - n2.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (dist <= 2.95 && Math.abs(dy) <= 1.0) {
        n1.neighbors.push(n2.id);
        n2.neighbors.push(n1.id);
      }
    }
  }

  return {
    seed,
    wallTransforms,
    floorTransforms,
    rampTransforms,
    colliders,
    navGrid,
    entryPoint: [0, 0, 0],
    extractionPoint: [18, 2.5, 19],
  };
}

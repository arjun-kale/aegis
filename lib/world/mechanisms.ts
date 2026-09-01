/**
 * Project A.E.G.I.S — Facility Mechanisms Engine (§4)
 *
 * Implements concrete mechanisms with state that toggles navigation passability:
 * - Laser Gate (ARMED -> blocks traversal with laser barrier; DISARMED -> passable)
 * - Freight Lift (LOWERED -> ground level junction; RAISED -> connects upper level)
 * - Sealed Door (SEALED -> sealed security partition; OPEN -> passable on DIVERT_POWER)
 */

import { MechanismRecord } from '../state/missionStore';
import { ColliderAABB } from './generator';

export interface MechanismDefinition {
  id: string;
  name: string;
  type: 'LASER_GATE' | 'FREIGHT_LIFT' | 'SEALED_DOOR';
  location: [number, number, number];
  barrierDimensions: [number, number, number];
  defaultState: MechanismRecord['state'];
  allowedCommands: string[];
}

export const FACILITY_MECHANISMS: Record<string, MechanismDefinition> = {
  laser_gate_01: {
    id: 'laser_gate_01',
    name: 'Sector 01 Perimeter Laser Grid',
    type: 'LASER_GATE',
    location: [0, 0, 4],
    barrierDimensions: [4.0, 2.8, 0.2],
    defaultState: 'DISARMED',
    allowedCommands: ['ACTIVATE', 'DEACTIVATE'],
  },
  laser_gate_02: {
    id: 'laser_gate_02',
    name: 'Corridor E Security Laser Barrier',
    type: 'LASER_GATE',
    location: [10, 0, 0],
    barrierDimensions: [0.2, 2.8, 3.8],
    defaultState: 'ARMED', // Blocks access to ramp / upper wing
    allowedCommands: ['ACTIVATE', 'DEACTIVATE'],
  },
  freight_lift_01: {
    id: 'freight_lift_01',
    name: 'Heavy Freight Hydraulic Elevator',
    type: 'FREIGHT_LIFT',
    location: [14, 0, 0],
    barrierDimensions: [3.0, 0.2, 3.0],
    defaultState: 'LOWERED',
    allowedCommands: ['LOWER', 'RAISE'],
  },
  sealed_door_01: {
    id: 'sealed_door_01',
    name: 'Sub-Level Vault Blast Door',
    type: 'SEALED_DOOR',
    location: [-8, 0, 0],
    barrierDimensions: [0.3, 2.8, 3.8],
    defaultState: 'SEALED',
    allowedCommands: ['DIVERT_POWER', 'SEAL'],
  },
};

/**
 * Returns dynamic collider bounding boxes for mechanisms that currently block passability.
 */
export function getMechanismColliders(
  mechanismStates: Record<string, MechanismRecord>
): ColliderAABB[] {
  const colliders: ColliderAABB[] = [];

  for (const [id, def] of Object.entries(FACILITY_MECHANISMS)) {
    const current = mechanismStates[id];
    const isArmed = current ? !current.passable : def.defaultState === 'ARMED' || def.defaultState === 'SEALED';

    if (isArmed) {
      const [x, y, z] = def.location;
      const [w, h, d] = def.barrierDimensions;
      colliders.push({
        id: `barrier_${id}`,
        type: 'MECHANISM_BARRIER',
        min: [x - w / 2, y, z - d / 2],
        max: [x + w / 2, y + h, z + d / 2],
        isMechanism: true,
        mechanismId: id,
      });
    }
  }

  return colliders;
}

/**
 * Evaluates the result of a mechanism command mutation.
 */
export function applyMechanismCommand(
  id: string,
  command: string,
  currentState: MechanismRecord
): { newState: MechanismRecord; success: boolean; reason?: string } {
  const def = FACILITY_MECHANISMS[id];
  if (!def) {
    return {
      newState: currentState,
      success: false,
      reason: `Mechanism '${id}' not recognized. Valid IDs: ${Object.keys(FACILITY_MECHANISMS).join(', ')}`,
    };
  }

  const upperCmd = command.toUpperCase();
  if (!def.allowedCommands.includes(upperCmd)) {
    return {
      newState: currentState,
      success: false,
      reason: `Command '${command}' not valid for ${def.type}. Allowed: ${def.allowedCommands.join(', ')}`,
    };
  }

  let newStateName = currentState.state;
  let passable = currentState.passable;

  switch (def.type) {
    case 'LASER_GATE':
      if (upperCmd === 'DEACTIVATE' || upperCmd === 'DISARM') {
        newStateName = 'DISARMED';
        passable = true;
      } else {
        newStateName = 'ARMED';
        passable = false;
      }
      break;

    case 'FREIGHT_LIFT':
      if (upperCmd === 'LOWER') {
        newStateName = 'LOWERED';
        passable = true;
      } else if (upperCmd === 'RAISE') {
        newStateName = 'RAISED';
        passable = true;
      }
      break;

    case 'SEALED_DOOR':
      if (upperCmd === 'DIVERT_POWER' || upperCmd === 'OPEN') {
        newStateName = 'OPEN';
        passable = true;
      } else {
        newStateName = 'SEALED';
        passable = false;
      }
      break;
  }

  return {
    newState: {
      ...currentState,
      state: newStateName,
      passable,
    },
    success: true,
  };
}

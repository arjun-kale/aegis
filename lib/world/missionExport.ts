/**
 * Project A.E.G.I.S — Mission Plan Export & Schema Validation (§5.3, §9)
 *
 * Defines standard Schema v1.0.0 for exporting approved motion plans, facility seed,
 * mechanism overrides, and execution telemetry for deterministic replay and auditing.
 */

import { GaitProfile, StagedProposal, MechanismRecord, MissionLogEntry } from '../state/missionStore';

export interface AegisMissionPlanV1 {
  schema_version: '1.0.0';
  exported_at: string;
  facility_seed: number;
  mission_metadata: {
    title: string;
    total_waypoints_count: number;
    estimated_duration_sec: number;
    predicted_min_margin: number;
    gait_profile: GaitProfile;
  };
  target_waypoint: { x: number; y: number; z: number };
  waypoints: Array<{
    x: number;
    y: number;
    z: number;
    margin?: number;
    stepIndex?: number;
  }>;
  mechanism_states: Record<string, {
    id: string;
    type: string;
    state: string;
    passable: boolean;
  }>;
  execution_history: Array<{
    id: string;
    timestamp: number;
    type: string;
    source: string;
    title: string;
    status?: string;
  }>;
}

/**
 * Serializes the active mission state into an AegisMissionPlanV1 object.
 */
export function buildMissionPlanExport(
  facilitySeed: number,
  stagedProposal: StagedProposal | null,
  mechanisms: Record<string, MechanismRecord>,
  missionLog: MissionLogEntry[]
): AegisMissionPlanV1 {
  const waypoints = stagedProposal?.waypoints || [
    { x: 0, y: 0, z: 0 },
    { x: 4, y: 0, z: 0 },
  ];

  const target = stagedProposal?.targetWaypoint || { x: 4, y: 0, z: 0 };
  const gait = stagedProposal?.gaitProfile || 'CAUTIOUS_STEP';
  const duration = stagedProposal?.estimatedDurationSec || 10.0;
  const margin = stagedProposal?.predictedMinMargin ?? 0.65;

  const mechanismSummary: AegisMissionPlanV1['mechanism_states'] = {};
  Object.values(mechanisms).forEach((m) => {
    mechanismSummary[m.id] = {
      id: m.id,
      type: m.type,
      state: m.state,
      passable: m.passable,
    };
  });

  const logSummary = missionLog.map((l) => ({
    id: l.id,
    timestamp: l.timestamp,
    type: l.type,
    source: l.source,
    title: l.title,
    status: l.status,
  }));

  return {
    schema_version: '1.0.0',
    exported_at: new Date().toISOString(),
    facility_seed: facilitySeed,
    mission_metadata: {
      title: `A.E.G.I.S Mission Plan (Seed ${facilitySeed})`,
      total_waypoints_count: waypoints.length,
      estimated_duration_sec: duration,
      predicted_min_margin: margin,
      gait_profile: gait,
    },
    target_waypoint: target,
    waypoints,
    mechanism_states: mechanismSummary,
    execution_history: logSummary,
  };
}

/**
 * Validates an unknown object against the AegisMissionPlanV1 schema.
 */
export function validateMissionPlan(
  data: unknown
): { valid: boolean; plan?: AegisMissionPlanV1; error?: string } {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Input data is not a valid JSON object.' };
  }

  const obj = data as Partial<AegisMissionPlanV1>;

  if (obj.schema_version !== '1.0.0') {
    return {
      valid: false,
      error: `Unsupported schema_version '${obj.schema_version}'. Expected '1.0.0'.`,
    };
  }

  if (typeof obj.facility_seed !== 'number' || Number.isNaN(obj.facility_seed)) {
    return { valid: false, error: 'Missing or invalid field: facility_seed (must be number).' };
  }

  if (!Array.isArray(obj.waypoints) || obj.waypoints.length === 0) {
    return { valid: false, error: 'Missing or empty waypoints array.' };
  }

  for (let i = 0; i < obj.waypoints.length; i++) {
    const wp = obj.waypoints[i];
    if (typeof wp.x !== 'number' || typeof wp.y !== 'number' || typeof wp.z !== 'number') {
      return { valid: false, error: `Invalid coordinate numbers at waypoint index ${i}.` };
    }
  }

  return { valid: true, plan: obj as AegisMissionPlanV1 };
}

/**
 * Triggers a browser file download for the mission plan JSON.
 */
export function downloadMissionPlanJSON(plan: AegisMissionPlanV1): void {
  if (typeof window === 'undefined') return;

  const jsonStr = JSON.stringify(plan, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  anchor.href = url;
  anchor.download = `aegis-mission-plan-${timestamp}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

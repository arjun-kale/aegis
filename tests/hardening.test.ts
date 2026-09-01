import { describe, it, expect, beforeEach } from 'vitest';
import { ACTIVE_TOOLS } from '@/lib/webmcp/register';
import { overrideFacilityMechanismTool } from '@/lib/webmcp/tools/override_facility_mechanism';
import { evaluateGaitFeasibilityTool } from '@/lib/webmcp/tools/evaluate_gait_feasibility';
import { stageLocomotionPlanTool } from '@/lib/webmcp/tools/stage_locomotion_plan';
import { scanSpatialEnvironmentTool } from '@/lib/webmcp/tools/scan_spatial_environment';
import { useMissionStore } from '@/lib/state/missionStore';
import { writeTelemetrySingle } from '@/lib/state/telemetryBus';
import { TELEMETRY_OFFSETS } from '@/lib/state/telemetryOffsets';

/**
 * Project A.E.G.I.S — Input Hardening / Fuzz Suite (Phase 10 §10)
 *
 * Every registered WebMCP tool must survive out-of-range numbers, wrong
 * types, missing required fields, unknown enum values, and unreachable
 * coordinates without ever throwing across the tool boundary (§3.5). A
 * thrown exception here is always a bug in the tool handler, never an
 * acceptable outcome — malformed input must come back as a structured
 * { isError: true, ... } response instead.
 */

// A battery of universally malformed payloads applied to every tool,
// regardless of its own schema. None of these should ever throw.
const UNIVERSAL_FUZZ_PAYLOADS: Array<{ label: string; payload: unknown }> = [
  { label: 'empty object', payload: {} },
  { label: 'null', payload: null },
  { label: 'undefined', payload: undefined },
  { label: 'empty array', payload: [] },
  { label: 'string instead of object', payload: 'not-an-object' },
  { label: 'number instead of object', payload: 42 },
  { label: 'boolean instead of object', payload: true },
  { label: 'deeply nested garbage', payload: { a: { b: { c: [1, 2, { d: null }] } } } },
  { label: 'prototype-pollution-shaped key', payload: { __proto__: { polluted: true } } },
  {
    label: 'every plausible field set to null',
    payload: {
      target_waypoint: null,
      gait_profile: null,
      mechanism_id: null,
      command: null,
      path: null,
      scan_mode: null,
      range_m: null,
      disassembly_factor: null,
      part_filter: null,
      proposal_id: null,
      authorization_code: null,
      verbose: null,
      include_execution_history: null,
    },
  },
  {
    label: 'every plausible field set to wrong type',
    payload: {
      target_waypoint: 'not-an-array',
      gait_profile: 12345,
      mechanism_id: 12345,
      command: [],
      path: 'not-an-array',
      scan_mode: 999,
      range_m: 'fifteen',
      disassembly_factor: 'half',
      part_filter: 42,
      proposal_id: 42,
      authorization_code: 42,
      verbose: 'yes',
      include_execution_history: 'true',
    },
  },
  {
    label: 'huge / out-of-range numerics',
    payload: {
      target_waypoint: [Number.MAX_SAFE_INTEGER, -Number.MAX_SAFE_INTEGER, Infinity],
      range_m: -Infinity,
      disassembly_factor: 99999,
      gait_profile: 'CAUTIOUS_STEP',
      mechanism_id: 'laser_gate_01',
      command: 'ACTIVATE',
      path: [[0, 0, 0], [1e30, -1e30, NaN]],
      proposal_id: 'x'.repeat(10000),
    },
  },
  {
    label: 'unknown enum values',
    payload: {
      gait_profile: 'TELEPORT',
      scan_mode: 'omniscient',
      command: 'SELF_DESTRUCT',
      part_filter: 'SOUL',
    },
  },
];

describe('Input Hardening — Universal Fuzz Matrix (Phase 10 §10)', () => {
  beforeEach(() => {
    useMissionStore.getState().resetMission();
    writeTelemetrySingle(TELEMETRY_OFFSETS.POS_X, 0);
    writeTelemetrySingle(TELEMETRY_OFFSETS.POS_Y, 0.95);
    writeTelemetrySingle(TELEMETRY_OFFSETS.POS_Z, 0);
  });

  for (const tool of ACTIVE_TOOLS) {
    describe(`tool: ${tool.name}`, () => {
      for (const { label, payload } of UNIVERSAL_FUZZ_PAYLOADS) {
        it(`never throws on fuzz input — ${label}`, async () => {
          let result: Awaited<ReturnType<typeof tool.execute>> | undefined;
          let thrown: unknown = null;

          try {
            result = await tool.execute(payload as any);
          } catch (err) {
            thrown = err;
          }

          expect(thrown, `${tool.name} threw across the tool boundary on "${label}": ${thrown}`).toBeNull();
          expect(result).toBeDefined();
          expect(Array.isArray(result!.content)).toBe(true);
          expect(result!.content.length).toBeGreaterThan(0);
          // Every text payload must at least be parseable JSON per the response envelope (§3.2).
          expect(() => JSON.parse(result!.content[0].text)).not.toThrow();
        });
      }
    });
  }
});

describe('Input Hardening — Regression Coverage for Specific Fixed Bugs', () => {
  beforeEach(() => {
    useMissionStore.getState().resetMission();
    writeTelemetrySingle(TELEMETRY_OFFSETS.POS_X, 0);
    writeTelemetrySingle(TELEMETRY_OFFSETS.POS_Y, 0.95);
    writeTelemetrySingle(TELEMETRY_OFFSETS.POS_Z, 0);
  });

  it('override_facility_mechanism: missing command no longer throws on .toUpperCase()', async () => {
    const res = await overrideFacilityMechanismTool.execute({
      mechanism_id: 'sealed_door_01',
    } as any);
    expect(res.isError).toBe(true);
    const parsed = JSON.parse(res.content[0].text);
    expect(parsed.status).toBe('INVALID_PARAMETER');
  });

  it('override_facility_mechanism: non-string command no longer throws on .toUpperCase()', async () => {
    const res = await overrideFacilityMechanismTool.execute({
      mechanism_id: 'sealed_door_01',
      command: 42,
    } as any);
    expect(res.isError).toBe(true);
    const parsed = JSON.parse(res.content[0].text);
    expect(parsed.status).toBe('INVALID_PARAMETER');
  });

  it('evaluate_gait_feasibility: null waypoint element no longer throws on destructure', async () => {
    const res = await evaluateGaitFeasibilityTool.execute({
      path: [[0, 0, 0], null, [4, 0, 0]],
      gait_profile: 'CAUTIOUS_STEP',
    } as any);
    expect(res.isError).toBe(true);
    const parsed = JSON.parse(res.content[0].text);
    expect(parsed.status).toBe('INVALID_PARAMETER');
  });

  it('evaluate_gait_feasibility: non-array waypoint element no longer throws on destructure', async () => {
    const res = await evaluateGaitFeasibilityTool.execute({
      path: [[0, 0, 0], 5, [4, 0, 0]],
      gait_profile: 'CAUTIOUS_STEP',
    } as any);
    expect(res.isError).toBe(true);
    const parsed = JSON.parse(res.content[0].text);
    expect(parsed.status).toBe('INVALID_PARAMETER');
  });

  it('stage_locomotion_plan: unreachable coordinates return a structured rejection, not a throw', async () => {
    const res = await stageLocomotionPlanTool.execute({
      target_waypoint: [99999, 99999, 99999],
      gait_profile: 'CAUTIOUS_STEP',
    } as any);
    expect(res.isError).toBe(true);
    const parsed = JSON.parse(res.content[0].text);
    expect(['UNREACHABLE_DESTINATION', 'BLOCKED_GEOMETRY']).toContain(parsed.status);
  });

  it('scan_spatial_environment: range_m far out of bounds returns OUT_OF_BOUNDS, not a throw', async () => {
    const res = await scanSpatialEnvironmentTool.execute({
      scan_mode: 'high_res',
      range_m: 1_000_000,
    } as any);
    expect(res.isError).toBe(true);
    const parsed = JSON.parse(res.content[0].text);
    expect(parsed.status).toBe('OUT_OF_BOUNDS');
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { stageLocomotionPlanTool } from '@/lib/webmcp/tools/stage_locomotion_plan';
import { executeStagedProposalTool } from '@/lib/webmcp/tools/execute_staged_proposal';
import { overrideFacilityMechanismTool } from '@/lib/webmcp/tools/override_facility_mechanism';
import { queryFacilityStateTool } from '@/lib/webmcp/tools/query_facility_state';
import { useMissionStore } from '@/lib/state/missionStore';
import { writeTelemetrySingle } from '@/lib/state/telemetryBus';
import { TELEMETRY_OFFSETS } from '@/lib/state/telemetryOffsets';

describe('WebMCP Action Tools & Human Authority Gate (§6)', () => {
  beforeEach(() => {
    // Reset mission store state
    useMissionStore.setState({
      facilitySeed: 42,
      stagedProposal: null,
      approvalStatus: 'IDLE',
      rejectionReason: null,
      autonomyMode: 'MANUAL_APPROVAL',
      safetyThreshold: 0.6,
      batterySoc: 0.94,
      thermalHeadroom: 0.88,
      activeFaults: [],
      mechanisms: {
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
        freight_lift_01: {
          id: 'freight_lift_01',
          type: 'FREIGHT_LIFT',
          state: 'LOWERED',
          location: { x: 14, y: 0, z: 0 },
          passable: true,
        },
        sealed_door_01: {
          id: 'sealed_door_01',
          type: 'SEALED_DOOR',
          state: 'SEALED',
          location: { x: -8, y: 0, z: 0 },
          passable: false,
        },
      },
      explorationGrid: {},
      scannedCellsCount: 0,
    });

    writeTelemetrySingle(TELEMETRY_OFFSETS.POS_X, 0.0);
    writeTelemetrySingle(TELEMETRY_OFFSETS.POS_Y, 0.0);
    writeTelemetrySingle(TELEMETRY_OFFSETS.POS_Z, 0.0);
    writeTelemetrySingle(TELEMETRY_OFFSETS.STABILITY_MARGIN, 0.80);
    writeTelemetrySingle(TELEMETRY_OFFSETS.STANCE_STATE, 0);
  });

  describe('Two-Phase Commit Proposal Staging (§3.3, §6)', () => {
    it('stages proposal in PENDING_APPROVAL state under MANUAL_APPROVAL policy', async () => {
      const res = await stageLocomotionPlanTool.execute({
        target_waypoint: [4, 0, 0],
        gait_profile: 'CAUTIOUS_STEP',
      });

      expect(res.isError).toBe(false);
      const parsed = JSON.parse(res.content[0].text);
      expect(parsed.status).toBe('PENDING_APPROVAL');
      expect(parsed.proposal_id).toBeDefined();
      expect(parsed.path_summary.waypoints_count).toBeGreaterThan(1);

      // Verify state in store
      const store = useMissionStore.getState();
      expect(store.stagedProposal).not.toBeNull();
      expect(store.stagedProposal?.id).toBe(parsed.proposal_id);
      expect(store.approvalStatus).toBe('PENDING_APPROVAL');
    });

    it('cannot be self-approved by an agent-supplied override under default MANUAL_APPROVAL policy', async () => {
      // Regression test: an earlier version of this tool accepted an
      // `auto_approve_if_margin_above` argument and used it to call
      // store.setApprovalStatus('APPROVED') directly, letting the calling
      // agent bypass the human Authority Gate regardless of autonomyMode.
      // Approval must only ever come from the store's own autonomyMode /
      // safetyThreshold, which only the human-operated HUD can set.
      const res = await stageLocomotionPlanTool.execute({
        target_waypoint: [4, 0, 0],
        gait_profile: 'CAUTIOUS_STEP',
        // @ts-expect-error — this field must not exist on the tool's input type
        auto_approve_if_margin_above: 0,
      } as any);

      expect(res.isError).toBe(false);
      const parsed = JSON.parse(res.content[0].text);
      expect(parsed.status).toBe('PENDING_APPROVAL');

      const store = useMissionStore.getState();
      expect(store.approvalStatus).toBe('PENDING_APPROVAL');
    });

    it('auto-approves proposal when AUTO_APPROVE_SAFE is configured and margin meets threshold', async () => {
      useMissionStore.getState().setAutonomyMode('AUTO_APPROVE_SAFE', 0.20);

      const res = await stageLocomotionPlanTool.execute({
        target_waypoint: [4, 0, 0],
        gait_profile: 'CAUTIOUS_STEP',
      });

      expect(res.isError).toBe(false);
      const parsed = JSON.parse(res.content[0].text);
      expect(parsed.status).toBe('APPROVED');

      const store = useMissionStore.getState();
      expect(store.approvalStatus).toBe('APPROVED');
    });

    it('rejects proposal staging with BLOCKED_GEOMETRY when route is blocked by armed laser_gate_02', async () => {
      // Extraction point [18, 2.5, 19] requires passing through laser_gate_02
      const res = await stageLocomotionPlanTool.execute({
        target_waypoint: [18, 2.5, 19],
        gait_profile: 'CAUTIOUS_STEP',
      });

      expect(res.isError).toBe(true);
      const parsed = JSON.parse(res.content[0].text);
      expect(parsed.status).toBe('BLOCKED_GEOMETRY');
      expect(parsed.reason).toContain('laser_gate_02');
      expect(parsed.suggested_action).toContain('override_facility_mechanism');
    });
  });

  describe('Human Authority Gate Execution Enforcement (§3.3, §6)', () => {
    it('fails with GATE_LOCKED when executing a proposal that is pending human approval', async () => {
      // 1. Stage proposal
      const stageRes = await stageLocomotionPlanTool.execute({
        target_waypoint: [4, 0, 0],
        gait_profile: 'CAUTIOUS_STEP',
      });
      const { proposal_id } = JSON.parse(stageRes.content[0].text);

      // 2. Attempt execute without approving
      const execRes = await executeStagedProposalTool.execute({ proposal_id });

      expect(execRes.isError).toBe(true);
      const parsed = JSON.parse(execRes.content[0].text);
      expect(parsed.status).toBe('GATE_LOCKED');
      expect(parsed.reason).toContain('requires human approval');
    });

    it('fails with PROPOSAL_REJECTED and propagates exact operator rejection reason', async () => {
      // 1. Stage proposal
      const stageRes = await stageLocomotionPlanTool.execute({
        target_waypoint: [4, 0, 0],
        gait_profile: 'CAUTIOUS_STEP',
      });
      const { proposal_id } = JSON.parse(stageRes.content[0].text);

      // 2. Operator rejects in HUD with custom feedback
      useMissionStore.getState().rejectProposal('Clearance too tight near north wall');

      // 3. Agent attempts to execute
      const execRes = await executeStagedProposalTool.execute({ proposal_id });

      expect(execRes.isError).toBe(true);
      const parsed = JSON.parse(execRes.content[0].text);
      expect(parsed.status).toBe('PROPOSAL_REJECTED');
      expect(parsed.reason).toContain('Clearance too tight near north wall');
    });

    it('succeeds when operator approves proposal and initiates motion', async () => {
      // 1. Stage proposal
      const stageRes = await stageLocomotionPlanTool.execute({
        target_waypoint: [4, 0, 0],
        gait_profile: 'CAUTIOUS_STEP',
      });
      const { proposal_id } = JSON.parse(stageRes.content[0].text);

      // 2. Operator clicks APPROVE
      useMissionStore.getState().approveProposal();

      // 3. Agent executes
      const execRes = await executeStagedProposalTool.execute({ proposal_id });

      expect(execRes.isError).toBe(false);
      const parsed = JSON.parse(execRes.content[0].text);
      expect(parsed.status).toBe('EXECUTING');
      expect(useMissionStore.getState().approvalStatus).toBe('EXECUTING');
    });
  });

  describe('Facility Mechanism Overrides & Security (§6)', () => {
    it('requires security authorization code for sealed_door_01 DIVERT_POWER', async () => {
      // 1. Attempt without auth code
      const failRes = await overrideFacilityMechanismTool.execute({
        mechanism_id: 'sealed_door_01',
        command: 'DIVERT_POWER',
      });

      expect(failRes.isError).toBe(true);
      const parsedFail = JSON.parse(failRes.content[0].text);
      expect(parsedFail.status).toBe('AUTHORIZATION_REQUIRED');

      // 2. Attempt with valid security auth code
      const successRes = await overrideFacilityMechanismTool.execute({
        mechanism_id: 'sealed_door_01',
        command: 'DIVERT_POWER',
        authorization_code: 'AEGIS-7749-AUTH',
      });

      expect(successRes.isError).toBe(false);
      const parsedSuccess = JSON.parse(successRes.content[0].text);
      expect(parsedSuccess.new_state).toBe('OPEN');
      expect(parsedSuccess.passable).toBe(true);
    });

    it('disarms laser_gate_02 and immediately opens extraction route for staging', async () => {
      // 1. Disarm laser_gate_02
      const overrideRes = await overrideFacilityMechanismTool.execute({
        mechanism_id: 'laser_gate_02',
        command: 'DEACTIVATE',
      });

      expect(overrideRes.isError).toBe(false);

      // 2. Query facility state
      const queryRes = await queryFacilityStateTool.execute({});
      const queryParsed = JSON.parse(queryRes.content[0].text);
      expect(queryParsed.extraction_route_status).toBe('OPEN');

      // 3. Stage locomotion to extraction now succeeds
      const stageRes = await stageLocomotionPlanTool.execute({
        target_waypoint: [18, 2.5, 19],
        gait_profile: 'CAUTIOUS_STEP',
      });

      expect(stageRes.isError).toBe(false);
      const stageParsed = JSON.parse(stageRes.content[0].text);
      expect(stageParsed.status).toBe('PENDING_APPROVAL');
    });
  });
});

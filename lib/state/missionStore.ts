import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

export type GaitProfile = 'CAUTIOUS_STEP' | 'DYNAMIC_BALANCE' | 'HIGH_CLEARANCE';
export type ApprovalStatus =
  | 'IDLE'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'EXECUTING'
  | 'COMPLETED';

export type AutonomyMode = 'MANUAL_APPROVAL' | 'AUTO_APPROVE_SAFE';
export type QualityMode = 'PERFORMANCE' | 'HIGH';

export interface Waypoint {
  x: number;
  y: number;
  z: number;
  margin?: number;
  stepIndex?: number;
}

export interface StagedProposal {
  id: string;
  targetWaypoint: { x: number; y: number; z: number };
  gaitProfile: GaitProfile;
  waypoints: Waypoint[];
  predictedMinMargin: number;
  estimatedDurationSec: number;
  requiredMechanisms: string[];
  stagedAt: number;
}

export interface MechanismRecord {
  id: string;
  type: 'LASER_GATE' | 'FREIGHT_LIFT' | 'SEALED_DOOR';
  state: 'ARMED' | 'DISARMED' | 'LOWERED' | 'RAISED' | 'OPEN' | 'SEALED';
  location: { x: number; y: number; z: number };
  passable: boolean;
}

export interface MissionLogEntry {
  id: string;
  timestamp: number;
  type: 'TOOL_CALL' | 'APPROVAL' | 'REJECTION' | 'MECHANISM_OVERRIDE' | 'SYSTEM';
  source: 'AGENT' | 'OPERATOR' | 'SYSTEM';
  title: string;
  detail?: string;
  payload?: Record<string, unknown>;
  status?: 'OK' | 'REJECTED' | 'ERROR' | 'INFO';
}

export type CellExplorationStatus = 'unexplored' | 'scanned' | 'traversed';

export interface MissionState {
  // Discrete Staged Motion Proposal
  stagedProposal: StagedProposal | null;

  // Human Authority Gate & Autonomy Settings
  approvalStatus: ApprovalStatus;
  rejectionReason: string | null;
  autonomyMode: AutonomyMode;
  safetyThreshold: number;

  // Robot Discrete Metrics
  batterySoc: number;
  thermalHeadroom: number;
  activeFaults: string[];

  // Facility Mechanisms
  mechanisms: Record<string, MechanismRecord>;

  // Mission Audit Log
  missionLog: MissionLogEntry[];

  // Spatial Exploration Grid
  explorationGrid: Record<string, CellExplorationStatus>;
  scannedCellsCount: number;

  // Seed & Engineering View
  facilitySeed: number;
  disassemblyFactor: number;

  // Rendering Quality (Phase 10 — postprocessing toggle, default off)
  qualityMode: QualityMode;

  // Actions
  stageProposal: (proposal: StagedProposal) => void;
  clearProposal: () => void;
  approveProposal: () => void;
  rejectProposal: (reason: string) => void;
  setApprovalStatus: (status: ApprovalStatus, rejectionReason?: string) => void;
  setAutonomyMode: (mode: AutonomyMode, threshold?: number) => void;
  setBatterySoc: (soc: number) => void;
  setThermalHeadroom: (headroom: number) => void;
  setActiveFaults: (faults: string[]) => void;
  updateMechanism: (id: string, updates: Partial<MechanismRecord>) => void;
  setMechanisms: (mechanisms: Record<string, MechanismRecord>) => void;
  addLogEntry: (entry: Omit<MissionLogEntry, 'id' | 'timestamp'>) => void;
  clearMissionLog: () => void;
  updateExplorationCell: (cellKey: string, status: CellExplorationStatus) => void;
  batchUpdateExplorationCells: (cells: Record<string, CellExplorationStatus>) => void;
  setDisassemblyFactor: (factor: number) => void;
  setFacilitySeed: (seed: number) => void;
  setQualityMode: (mode: QualityMode) => void;
  resetMission: () => void;
}

const INITIAL_MECHANISMS: Record<string, MechanismRecord> = {
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
    state: 'ARMED',
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
};

export const useMissionStore = create<MissionState>()(
  subscribeWithSelector((set) => ({
    stagedProposal: null,
    approvalStatus: 'IDLE',
    rejectionReason: null,
    autonomyMode: 'MANUAL_APPROVAL',
    safetyThreshold: 0.6,
    batterySoc: 0.94,
    thermalHeadroom: 0.88,
    activeFaults: [],
    mechanisms: INITIAL_MECHANISMS,
    missionLog: [
      {
        id: 'init-0',
        timestamp: Date.now(),
        type: 'SYSTEM',
        source: 'SYSTEM',
        title: 'Workbench Initialized',
        detail: 'Facility loaded with seed 42. Human approval gate active.',
        status: 'INFO',
      },
    ],
    explorationGrid: {},
    scannedCellsCount: 0,
    facilitySeed: 42,
    disassemblyFactor: 0.0,
    qualityMode: 'PERFORMANCE',

    stageProposal: (proposal) =>
      set((state) => ({
        stagedProposal: proposal,
        approvalStatus:
          state.autonomyMode === 'AUTO_APPROVE_SAFE' &&
          proposal.predictedMinMargin >= state.safetyThreshold
            ? 'APPROVED'
            : 'PENDING_APPROVAL',
        rejectionReason: null,
      })),

    clearProposal: () =>
      set(() => ({
        stagedProposal: null,
        approvalStatus: 'IDLE',
        rejectionReason: null,
      })),

    approveProposal: () =>
      set((state) => {
        if (!state.stagedProposal) return state;
        return {
          approvalStatus: 'APPROVED',
          rejectionReason: null,
        };
      }),

    rejectProposal: (reason) =>
      set((state) => {
        if (!state.stagedProposal) return state;
        return {
          approvalStatus: 'REJECTED',
          rejectionReason: reason,
        };
      }),

    setApprovalStatus: (status, rejectionReason) =>
      set(() => ({
        approvalStatus: status,
        rejectionReason: rejectionReason ?? null,
      })),

    setAutonomyMode: (mode, threshold) =>
      set((state) => ({
        autonomyMode: mode,
        safetyThreshold: threshold !== undefined ? threshold : state.safetyThreshold,
      })),

    setBatterySoc: (soc) =>
      set(() => ({
        batterySoc: Math.max(0, Math.min(1, soc)),
      })),

    setThermalHeadroom: (headroom) =>
      set(() => ({
        thermalHeadroom: Math.max(0, Math.min(1, headroom)),
      })),

    setActiveFaults: (faults) =>
      set(() => ({
        activeFaults: faults,
      })),

    updateMechanism: (id, updates) =>
      set((state) => {
        const existing = state.mechanisms[id];
        if (!existing) return state;
        return {
          mechanisms: {
            ...state.mechanisms,
            [id]: { ...existing, ...updates },
          },
        };
      }),

    setMechanisms: (mechanisms) =>
      set(() => ({
        mechanisms,
      })),

    addLogEntry: (entry) =>
      set((state) => ({
        missionLog: [
          ...state.missionLog,
          {
            ...entry,
            id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            timestamp: Date.now(),
          },
        ],
      })),

    clearMissionLog: () =>
      set(() => ({
        missionLog: [],
      })),

    updateExplorationCell: (cellKey, status) =>
      set((state) => {
        const wasScanned = state.explorationGrid[cellKey] === 'scanned';
        const isNowScanned = status === 'scanned';
        return {
          explorationGrid: {
            ...state.explorationGrid,
            [cellKey]: status,
          },
          scannedCellsCount:
            state.scannedCellsCount + (!wasScanned && isNowScanned ? 1 : 0),
        };
      }),

    batchUpdateExplorationCells: (newCells) =>
      set((state) => {
        const updated = { ...state.explorationGrid, ...newCells };
        let count = 0;
        for (const val of Object.values(updated)) {
          if (val === 'scanned' || val === 'traversed') count++;
        }
        return {
          explorationGrid: updated,
          scannedCellsCount: count,
        };
      }),

    setDisassemblyFactor: (factor) =>
      set(() => ({
        disassemblyFactor: Math.max(0, Math.min(1, factor)),
      })),

    setFacilitySeed: (seed) =>
      set(() => ({
        facilitySeed: seed,
      })),

    setQualityMode: (mode) =>
      set(() => ({
        qualityMode: mode,
      })),

    resetMission: () =>
      set(() => ({
        stagedProposal: null,
        approvalStatus: 'IDLE',
        rejectionReason: null,
        explorationGrid: {},
        scannedCellsCount: 0,
        mechanisms: INITIAL_MECHANISMS,
        disassemblyFactor: 0.0,
      })),
  }))
);

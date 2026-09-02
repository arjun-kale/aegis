'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Header } from '@/components/hud/Header';
import { FallbackConsole } from '@/components/hud/FallbackConsole';
import { FrameTimeOverlay } from '@/components/hud/FrameTimeOverlay';
import { IkDevPanel, STANCE_PRESETS } from '@/components/hud/IkDevPanel';
import { GaitDevPanel } from '@/components/hud/GaitDevPanel';
import { FacilityDevPanel } from '@/components/hud/FacilityDevPanel';
import { AuthorityGateHUD } from '@/components/hud/AuthorityGateHUD';
import { TelemetryPanel } from '@/components/hud/TelemetryPanel';
import { ToolCallLog } from '@/components/hud/ToolCallLog';
import { EngineeringViewHUD } from '@/components/hud/EngineeringViewHUD';
import { MissionExportModal } from '@/components/hud/MissionExportModal';
import { ViewportErrorBoundary } from '@/components/viewport/ViewportErrorBoundary';
import { registerWebMcpTools, resolveModelContext } from '@/lib/webmcp/register';
import {
  FullBodyPoseTargets,
  solveFullBodyKinematics,
} from '@/lib/robot/kinematics';
import { GaitProfileName } from '@/lib/robot/gait';
import {
  stepLocomotion,
  STANDARD_PATHS,
  LocomotionFrameResult,
} from '@/lib/robot/locomotion';
import { evaluateStaticStability } from '@/lib/robot/stability';
import { generateFacility, FacilityGeometryData } from '@/lib/world/generator';
import { findAStarPath, NavPathResult } from '@/lib/world/navigation';
import { performSpatialScan } from '@/lib/world/exploration';
import { applyMechanismCommand, getMechanismColliders } from '@/lib/world/mechanisms';
import { useMissionStore } from '@/lib/state/missionStore';

// Pass 1 layout redesign: shared dock-panel identifiers (see Header.tsx).
export type LeftDockPanel = 'telemetry' | 'ik' | 'gait' | 'perf' | null;
export type RightDockPanel = 'toolstream' | 'facility' | 'exploded' | 'console' | null;

// Dynamic client import with ssr: false
const Viewport = dynamic(() => import('@/components/viewport/Viewport'), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col items-center justify-center w-full h-full bg-[#F6F7F9] text-[#5B6470] font-mono text-xs gap-3">
      <div className="w-8 h-8 border-2 border-accent-teal border-t-transparent rounded-full animate-spin" />
      <div>INITIALIZING 3D FACILITY & ENGINE...</div>
    </div>
  ),
});

export default function Home() {
  // Pass 1 layout redesign: two docked regions (left/right) each hold one
  // panel at a time instead of nine independently-positioned floating
  // panels with ad-hoc mutual exclusion. Left holds the always-useful
  // Telemetry plus the dev-only tuning harnesses (IK/Gait/Perf); right
  // holds the always-useful Tool Stream plus the operator-facing Facility
  // Workbench, Exploded View, and Fallback Console.
  const [leftDock, setLeftDock] = useState<LeftDockPanel>('telemetry');
  const [rightDock, setRightDock] = useState<RightDockPanel>('toolstream');
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);

  const isIkDevOpen = leftDock === 'ik';
  const isGaitDevOpen = leftDock === 'gait';

  // Facility & Store State
  const facilitySeed = useMissionStore((state) => state.facilitySeed);
  const setFacilitySeed = useMissionStore((state) => state.setFacilitySeed);
  const mechanisms = useMissionStore((state) => state.mechanisms);
  const updateMechanism = useMissionStore((state) => state.updateMechanism);
  const explorationGrid = useMissionStore((state) => state.explorationGrid);
  const batchUpdateExplorationCells = useMissionStore((state) => state.batchUpdateExplorationCells);
  const scannedCellsCount = useMissionStore((state) => state.scannedCellsCount);

  // Human Authority Gate Staged Proposal State
  const stagedProposal = useMissionStore((state) => state.stagedProposal);
  const approvalStatus = useMissionStore((state) => state.approvalStatus);
  const setApprovalStatus = useMissionStore((state) => state.setApprovalStatus);

  // Generate facility geometry
  const facilityData: FacilityGeometryData = useMemo(
    () => generateFacility(facilitySeed),
    [facilitySeed]
  );

  // Combined colliders (static walls + dynamic active mechanism barriers)
  const activeColliders = useMemo(() => {
    const dynamicBarriers = getMechanismColliders(mechanisms);
    return [...facilityData.colliders, ...dynamicBarriers];
  }, [facilityData, mechanisms]);

  // A* Navigation Query State
  const [navTargetKey, setNavTargetKey] = useState<'extraction' | 'eastWing' | 'westVault'>('extraction');

  const navGoalPos = useMemo<[number, number, number]>(() => {
    if (navTargetKey === 'extraction') return facilityData.extractionPoint;
    if (navTargetKey === 'eastWing') return [14, 0, 0];
    return [-12, 0, 0];
  }, [navTargetKey, facilityData]);

  // Compute A* route from Entry Point [0, 0, 0] to Target
  const navPathResult: NavPathResult = useMemo(() => {
    return findAStarPath(facilityData.navGrid, [0, 0, 0], navGoalPos, mechanisms);
  }, [facilityData, navGoalPos, mechanisms]);

  // Manual IK Targets
  const [manualTargets, setManualTargets] = useState<FullBodyPoseTargets>(
    STANCE_PRESETS.default.targets
  );

  // Locomotion Engine State
  const [gaitProfile, setGaitProfile] = useState<GaitProfileName>('CAUTIOUS_STEP');
  const [selectedPathKey, setSelectedPathKey] = useState<string>('straight20m');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [elapsedSimTime, setElapsedSimTime] = useState<number>(0);

  // Active path for Locomotion Runner
  const activePath = useMemo(() => {
    // If a proposal is actively executing, use its exact staged waypoints
    if (stagedProposal && approvalStatus === 'EXECUTING' && stagedProposal.waypoints.length > 1) {
      return stagedProposal.waypoints.map((pt) => ({ x: pt.x, y: pt.y, z: pt.z }));
    }
    if (navPathResult.path.length > 1) {
      return navPathResult.path.map((pt) => ({ x: pt[0], y: pt[1], z: pt[2] }));
    }
    return STANDARD_PATHS[selectedPathKey]?.points || STANDARD_PATHS.straight20m.points;
  }, [stagedProposal, approvalStatus, navPathResult, selectedPathKey]);

  const activeGait = stagedProposal && approvalStatus === 'EXECUTING' ? stagedProposal.gaitProfile : gaitProfile;

  // Step locomotion
  const locomotionResult: LocomotionFrameResult = useMemo(() => {
    return stepLocomotion(activeGait, elapsedSimTime, activePath, playbackSpeed);
  }, [activeGait, elapsedSimTime, activePath, playbackSpeed]);

  // When staged proposal completes path execution
  useEffect(() => {
    if (approvalStatus === 'EXECUTING' && locomotionResult.isComplete) {
      setApprovalStatus('COMPLETED');
    }
  }, [approvalStatus, locomotionResult.isComplete, setApprovalStatus]);

  // Compute manual pose fallback
  const manualPose = useMemo(() => {
    const pose = solveFullBodyKinematics(manualTargets);
    const stab = evaluateStaticStability(pose, true, true);
    return { kinematicState: pose, stabilityState: stab };
  }, [manualTargets]);

  const isLocomoting = isPlaying || isGaitDevOpen || approvalStatus === 'EXECUTING';
  const currentPose = isLocomoting ? locomotionResult.kinematicState : manualPose.kinematicState;
  const currentStability = isLocomoting ? locomotionResult.stabilityState : manualPose.stabilityState;

  // Unexplored Frontiers from Spatial Scanner
  const [unexploredFrontiers, setUnexploredFrontiers] = useState<[number, number, number][]>([]);

  // Spatial Scan Trigger
  const handleTriggerScan = () => {
    const robotOrigin = currentPose.torsoPosition;
    const scanRes = performSpatialScan(robotOrigin, 15, activeColliders, explorationGrid);

    const updateRecord: Record<string, 'scanned'> = {};
    scanRes.newlyScannedCells.forEach((k) => (updateRecord[k] = 'scanned'));
    batchUpdateExplorationCells(updateRecord);

    setUnexploredFrontiers(scanRes.unexploredFrontiers);
  };

  // Mechanism Toggle Handler
  const handleToggleMechanism = (id: string, cmd: string) => {
    const current = mechanisms[id];
    if (!current) return;
    const res = applyMechanismCommand(id, cmd, current);
    if (res.success) {
      updateMechanism(id, res.newState);
    }
  };

  // Real-time animation loop when walking or executing.
  //
  // Fixed simulation timestep with an accumulator (§10 "Determinism"): the
  // mission clock advances in constant 1/60s quanta rather than the raw
  // rAF delta, so a given wall-clock duration always produces the same
  // number of simulation ticks regardless of the render framerate. A
  // single frame's real delta is clamped to 250ms and the catch-up loop
  // capped at MAX_STEPS_PER_FRAME so a tab-suspend/resume or a debugger
  // pause doesn't fire a "spiral of death" burst of steps on resume.
  const FIXED_DT = 1 / 60;
  const MAX_STEPS_PER_FRAME = 5;
  const lastTimeRef = useRef<number>(performance.now());
  const accumulatorRef = useRef<number>(0);

  useEffect(() => {
    const shouldAnimate = isPlaying || approvalStatus === 'EXECUTING';
    if (!shouldAnimate) return;

    let animId: number;
    lastTimeRef.current = performance.now();
    accumulatorRef.current = 0;

    const loop = (now: number) => {
      const frameDeltaSec = Math.min((now - lastTimeRef.current) / 1000, 0.25);
      lastTimeRef.current = now;
      accumulatorRef.current += frameDeltaSec;

      let advancedSec = 0;
      let steps = 0;
      while (accumulatorRef.current >= FIXED_DT && steps < MAX_STEPS_PER_FRAME) {
        accumulatorRef.current -= FIXED_DT;
        advancedSec += FIXED_DT;
        steps += 1;
      }

      if (advancedSec > 0) {
        setElapsedSimTime((prev) => prev + advancedSec);
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, approvalStatus]);

  // Lifetime-scoped WebMCP tool registration. Degrade honestly rather than
  // silently: when no WebMCP agent context is present (unsupported browser,
  // or a non-secure origin), record it in the audit log so the operator
  // sees why the console starts in fallback mode instead of guessing.
  //
  // The "Workbench Initialized" entry is seeded here (client-only, post-mount)
  // rather than as static missionStore initial state — a Date.now() value
  // baked into module-eval-time state would differ between the SSR pass and
  // client hydration, producing a text-content hydration mismatch.
  useEffect(() => {
    useMissionStore.getState().addLogEntry({
      type: 'SYSTEM',
      source: 'SYSTEM',
      title: 'Workbench Initialized',
      detail: `Facility loaded with seed ${useMissionStore.getState().facilitySeed}. Human approval gate active.`,
      status: 'INFO',
    });

    const mc = resolveModelContext();
    if (!mc) {
      useMissionStore.getState().addLogEntry({
        type: 'SYSTEM',
        source: 'SYSTEM',
        title: 'WebMCP Agent Context Unavailable',
        detail: window.isSecureContext
          ? 'No navigator.modelContext was found. Degrading to the fallback console — every tool remains invokable by hand.'
          : 'This origin is not a SecureContext, so navigator.modelContext is unavailable per the WebMCP spec. Degrading to the fallback console.',
        status: 'INFO',
      });
    }

    const unregister = registerWebMcpTools();
    return () => {
      unregister();
    };
  }, []);

  // Keyboard shortcut listener (F1: Telemetry, F2: Perf, F3: IKDev, F4: GaitDev, F5: FacilityDev, F6: Exploded, F7: Export)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F1') {
        e.preventDefault();
        setLeftDock((prev) => (prev === 'telemetry' ? null : 'telemetry'));
      } else if (e.key === 'F2') {
        e.preventDefault();
        setLeftDock((prev) => (prev === 'perf' ? null : 'perf'));
      } else if (e.key === 'F3') {
        e.preventDefault();
        setLeftDock((prev) => (prev === 'ik' ? null : 'ik'));
      } else if (e.key === 'F4') {
        e.preventDefault();
        setLeftDock((prev) => (prev === 'gait' ? null : 'gait'));
      } else if (e.key === 'F5') {
        e.preventDefault();
        setRightDock((prev) => (prev === 'facility' ? null : 'facility'));
      } else if (e.key === 'F6') {
        e.preventDefault();
        setRightDock((prev) => (prev === 'exploded' ? null : 'exploded'));
      } else if (e.key === 'F7') {
        e.preventDefault();
        setIsExportModalOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#F6F7F9] flex flex-col">
      {/* Top Mission HUD Header — fixed height, in normal flow (Pass 1) */}
      <Header
        leftDock={leftDock}
        onSetLeftDock={setLeftDock}
        rightDock={rightDock}
        onSetRightDock={setRightDock}
        isExportModalOpen={isExportModalOpen}
        onToggleExportModal={() => setIsExportModalOpen((prev) => !prev)}
      />

      {/* Human Authority Gate — fixed-height bar, in normal flow (Pass 1).
          The single most safety-critical surface now occupies a constant,
          unmistakable position directly under the header, in every state. */}
      <AuthorityGateHUD
        onAbortExecution={() => {
          setApprovalStatus('REJECTED', 'Operator Emergency Abort');
        }}
      />

      {/* Main 3D Viewport Subtree — fills all remaining space */}
      <div className="relative flex-1 min-h-0">
        <ViewportErrorBoundary>
          <Viewport
            pose={currentPose}
            stabilityState={currentStability}
            pathPoints={navPathResult.path.length > 1 ? navPathResult.path : activePath}
            facilityData={facilityData}
            mechanismStates={mechanisms}
            unexploredFrontiers={unexploredFrontiers}
            stagedProposal={stagedProposal}
            showTargetGizmos={isIkDevOpen}
            showSupportPolygon={true}
          />
        </ViewportErrorBoundary>

        {/* Left dock — Telemetry (default) or a dev tuning harness, one at a time */}
        <TelemetryPanel isOpen={leftDock === 'telemetry'} onClose={() => setLeftDock(null)} />
        <IkDevPanel
          isOpen={leftDock === 'ik'}
          onClose={() => setLeftDock(null)}
          targets={manualTargets}
          onChangeTargets={setManualTargets}
          currentPose={manualPose.kinematicState}
        />
        <GaitDevPanel
          isOpen={leftDock === 'gait'}
          onClose={() => setLeftDock(null)}
          selectedProfile={gaitProfile}
          onSelectProfile={setGaitProfile}
          selectedPathKey={selectedPathKey}
          onSelectPathKey={(key) => {
            setSelectedPathKey(key);
            setElapsedSimTime(0);
          }}
          isPlaying={isPlaying}
          onTogglePlay={() => setIsPlaying((prev) => !prev)}
          onReset={() => {
            setIsPlaying(false);
            setElapsedSimTime(0);
          }}
          onStepForward={() => setElapsedSimTime((prev) => prev + 0.1)}
          playbackSpeed={playbackSpeed}
          onChangeSpeed={setPlaybackSpeed}
          stabilityResult={locomotionResult.stabilityState}
          progressM={locomotionResult.progressM}
          totalDistanceM={locomotionResult.totalDistanceM}
        />
        <FrameTimeOverlay isOpen={leftDock === 'perf'} onClose={() => setLeftDock(null)} />

        {/* Right dock — Tool Stream (default), Facility, Exploded View, or Console, one at a time */}
        <ToolCallLog isOpen={rightDock === 'toolstream'} onClose={() => setRightDock(null)} />
        <FacilityDevPanel
          isOpen={rightDock === 'facility'}
          onClose={() => setRightDock(null)}
          seed={facilitySeed}
          onChangeSeed={setFacilitySeed}
          mechanisms={mechanisms}
          onToggleMechanism={handleToggleMechanism}
          navPathResult={navPathResult}
          selectedNavTargetName={navTargetKey}
          onSelectNavTarget={setNavTargetKey}
          onTriggerScan={handleTriggerScan}
          scannedCellsCount={scannedCellsCount}
          unexploredFrontiersCount={unexploredFrontiers.length}
        />
        <EngineeringViewHUD isOpen={rightDock === 'exploded'} onClose={() => setRightDock(null)} />
        <FallbackConsole isOpen={rightDock === 'console'} onClose={() => setRightDock(null)} />
      </div>

      {/* Mission Plan Export & Replay Modal (§9) — a true modal, unaffected by dock layout */}
      <MissionExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        onReplayPlan={() => {
          setIsPlaying(true);
          setElapsedSimTime(0);
        }}
      />
    </main>
  );
}

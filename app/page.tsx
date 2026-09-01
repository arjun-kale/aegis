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
import { registerWebMcpTools } from '@/lib/webmcp/register';
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

// Dynamic client import with ssr: false
const Viewport = dynamic(() => import('@/components/viewport/Viewport'), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col items-center justify-center w-full h-full bg-[#14171A] text-foreground-muted font-mono text-xs gap-3">
      <div className="w-8 h-8 border-2 border-accent-teal border-t-transparent rounded-full animate-spin" />
      <div>INITIALIZING 3D FACILITY & ENGINE...</div>
    </div>
  ),
});

export default function Home() {
  const [isConsoleOpen, setIsConsoleOpen] = useState<boolean>(false);
  const [isFrameTimeOpen, setIsFrameTimeOpen] = useState<boolean>(false);
  const [isIkDevOpen, setIsIkDevOpen] = useState<boolean>(false);
  const [isGaitDevOpen, setIsGaitDevOpen] = useState<boolean>(false);
  const [isFacilityDevOpen, setIsFacilityDevOpen] = useState<boolean>(false);

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

  // Real-time animation loop when walking or executing
  const lastTimeRef = useRef<number>(performance.now());
  useEffect(() => {
    const shouldAnimate = isPlaying || approvalStatus === 'EXECUTING';
    if (!shouldAnimate) return;

    let animId: number;
    lastTimeRef.current = performance.now();

    const loop = (now: number) => {
      const deltaSec = (now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;
      setElapsedSimTime((prev) => prev + deltaSec);
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, approvalStatus]);

  // Lifetime-scoped WebMCP tool registration
  useEffect(() => {
    const unregister = registerWebMcpTools();
    return () => {
      unregister();
    };
  }, []);

  // Keyboard shortcut listener (F2: Perf, F3: IKDev, F4: GaitDev, F5: FacilityDev)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        setIsFrameTimeOpen((prev) => !prev);
      } else if (e.key === 'F3') {
        e.preventDefault();
        setIsIkDevOpen((prev) => !prev);
      } else if (e.key === 'F4') {
        e.preventDefault();
        setIsGaitDevOpen((prev) => !prev);
      } else if (e.key === 'F5') {
        e.preventDefault();
        setIsFacilityDevOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#14171A]">
      {/* Top Mission HUD Header */}
      <Header
        isConsoleOpen={isConsoleOpen}
        onToggleConsole={() => setIsConsoleOpen((prev) => !prev)}
        isFrameTimeOpen={isFrameTimeOpen}
        onToggleFrameTime={() => setIsFrameTimeOpen((prev) => !prev)}
        isIkDevOpen={isIkDevOpen}
        onToggleIkDev={() => {
          setIsIkDevOpen((prev) => !prev);
          if (!isIkDevOpen) {
            setIsGaitDevOpen(false);
            setIsFacilityDevOpen(false);
          }
        }}
        isGaitDevOpen={isGaitDevOpen}
        onToggleGaitDev={() => {
          setIsGaitDevOpen((prev) => !prev);
          if (!isGaitDevOpen) {
            setIsIkDevOpen(false);
            setIsFacilityDevOpen(false);
          }
        }}
        isFacilityDevOpen={isFacilityDevOpen}
        onToggleFacilityDev={() => {
          setIsFacilityDevOpen((prev) => !prev);
          if (!isFacilityDevOpen) {
            setIsIkDevOpen(false);
            setIsGaitDevOpen(false);
          }
        }}
      />

      {/* Human Authority Gate Prominent HUD Banner (§3.3) */}
      <AuthorityGateHUD
        onAbortExecution={() => {
          setApprovalStatus('REJECTED', 'Operator Emergency Abort');
        }}
      />

      {/* Main 3D Viewport Subtree */}
      <div className="w-full h-full pt-12">
        <Viewport
          pose={currentPose}
          stabilityState={currentStability}
          pathPoints={navPathResult.path.length > 1 ? navPathResult.path : activePath}
          facilityData={facilityData}
          mechanismStates={mechanisms}
          unexploredFrontiers={unexploredFrontiers}
          showTargetGizmos={isIkDevOpen}
          showSupportPolygon={true}
        />
      </div>

      {/* Fallback Console & Interactive WebMCP Harness */}
      <FallbackConsole
        isOpen={isConsoleOpen}
        onClose={() => setIsConsoleOpen(false)}
      />

      {/* Dev-only Frame Time & Latency Sparkline */}
      <FrameTimeOverlay
        isOpen={isFrameTimeOpen}
        onClose={() => setIsFrameTimeOpen(false)}
      />

      {/* IK Rig Dev Panel */}
      <IkDevPanel
        isOpen={isIkDevOpen}
        onClose={() => setIsIkDevOpen(false)}
        targets={manualTargets}
        onChangeTargets={setManualTargets}
        currentPose={manualPose.kinematicState}
      />

      {/* Locomotion & Gait Bench Panel */}
      <GaitDevPanel
        isOpen={isGaitDevOpen}
        onClose={() => setIsGaitDevOpen(false)}
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

      {/* Facility & Navigation Workbench Panel */}
      <FacilityDevPanel
        isOpen={isFacilityDevOpen}
        onClose={() => setIsFacilityDevOpen(false)}
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
    </main>
  );
}

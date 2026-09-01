'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Header } from '@/components/hud/Header';
import { FallbackConsole } from '@/components/hud/FallbackConsole';
import { FrameTimeOverlay } from '@/components/hud/FrameTimeOverlay';
import { IkDevPanel, STANCE_PRESETS } from '@/components/hud/IkDevPanel';
import { GaitDevPanel } from '@/components/hud/GaitDevPanel';
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

// Dynamic client import with ssr: false
const Viewport = dynamic(() => import('@/components/viewport/Viewport'), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col items-center justify-center w-full h-full bg-[#14171A] text-foreground-muted font-mono text-xs gap-3">
      <div className="w-8 h-8 border-2 border-accent-teal border-t-transparent rounded-full animate-spin" />
      <div>INITIALIZING 3D ENGINE & ROBOT RIG...</div>
    </div>
  ),
});

export default function Home() {
  const [isConsoleOpen, setIsConsoleOpen] = useState<boolean>(false);
  const [isFrameTimeOpen, setIsFrameTimeOpen] = useState<boolean>(false);
  const [isIkDevOpen, setIsIkDevOpen] = useState<boolean>(false);
  const [isGaitDevOpen, setIsGaitDevOpen] = useState<boolean>(true); // Open by default for Phase 3

  // Manual IK Targets (used when Gait locomotion is paused/inactive)
  const [manualTargets, setManualTargets] = useState<FullBodyPoseTargets>(
    STANCE_PRESETS.default.targets
  );

  // Locomotion Engine State
  const [gaitProfile, setGaitProfile] = useState<GaitProfileName>('CAUTIOUS_STEP');
  const [selectedPathKey, setSelectedPathKey] = useState<string>('straight20m');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [elapsedSimTime, setElapsedSimTime] = useState<number>(0);

  const activePath = STANDARD_PATHS[selectedPathKey]?.points || STANDARD_PATHS.straight20m.points;

  // Evaluate locomotion state for current time
  const locomotionResult: LocomotionFrameResult = useMemo(() => {
    return stepLocomotion(gaitProfile, elapsedSimTime, activePath, playbackSpeed);
  }, [gaitProfile, elapsedSimTime, activePath, playbackSpeed]);

  // Compute manual pose fallback
  const manualPose = useMemo(() => {
    const pose = solveFullBodyKinematics(manualTargets);
    const stab = evaluateStaticStability(pose, true, true);
    return { kinematicState: pose, stabilityState: stab };
  }, [manualTargets]);

  // Determine active displayed pose & stability state
  const currentPose = isGaitDevOpen || isPlaying ? locomotionResult.kinematicState : manualPose.kinematicState;
  const currentStability = isGaitDevOpen || isPlaying ? locomotionResult.stabilityState : manualPose.stabilityState;

  // Real-time animation loop when playing
  const lastTimeRef = useRef<number>(performance.now());
  useEffect(() => {
    if (!isPlaying) return;

    let animId: number;
    lastTimeRef.current = performance.now();

    const loop = (now: number) => {
      const deltaSec = (now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;

      // Advance simulation clock
      setElapsedSimTime((prev) => prev + deltaSec);

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying]);

  // Lifetime-scoped WebMCP tool registration
  useEffect(() => {
    const unregister = registerWebMcpTools();
    return () => {
      unregister();
    };
  }, []);

  // Keyboard shortcut listener (F2: FrameTime, F3: IKDev, F4: GaitDev)
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
          if (!isIkDevOpen) setIsGaitDevOpen(false);
        }}
        isGaitDevOpen={isGaitDevOpen}
        onToggleGaitDev={() => {
          setIsGaitDevOpen((prev) => !prev);
          if (!isGaitDevOpen) setIsIkDevOpen(false);
        }}
      />

      {/* Main 3D Viewport Subtree */}
      <div className="w-full h-full pt-12">
        <Viewport
          pose={currentPose}
          stabilityState={currentStability}
          pathPoints={isGaitDevOpen ? activePath : []}
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

      {/* IK Rig & Kinematics Dev Control Panel */}
      <IkDevPanel
        isOpen={isIkDevOpen}
        onClose={() => setIsIkDevOpen(false)}
        targets={manualTargets}
        onChangeTargets={setManualTargets}
        currentPose={manualPose.kinematicState}
      />

      {/* Locomotion & Gait Bench Control Panel */}
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
    </main>
  );
}

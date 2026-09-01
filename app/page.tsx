'use client';

import React, { useEffect, useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Header } from '@/components/hud/Header';
import { FallbackConsole } from '@/components/hud/FallbackConsole';
import { FrameTimeOverlay } from '@/components/hud/FrameTimeOverlay';
import { IkDevPanel, STANCE_PRESETS } from '@/components/hud/IkDevPanel';
import { registerWebMcpTools } from '@/lib/webmcp/register';
import {
  FullBodyPoseTargets,
  solveFullBodyKinematics,
} from '@/lib/robot/kinematics';

// Dynamic client import with ssr: false to isolate Three.js
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

  // Live End-Effector Targets (initialized to Default Stance)
  const [targets, setTargets] = useState<FullBodyPoseTargets>(
    STANCE_PRESETS.default.targets
  );

  // Solve full body kinematics continuously
  const currentPose = useMemo(() => solveFullBodyKinematics(targets), [targets]);

  // Lifetime-scoped WebMCP tool registration
  useEffect(() => {
    const unregister = registerWebMcpTools();
    return () => {
      unregister();
    };
  }, []);

  // Keyboard shortcut listener (F2: Frame Time, F3: IK Dev)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        setIsFrameTimeOpen((prev) => !prev);
      } else if (e.key === 'F3') {
        e.preventDefault();
        setIsIkDevOpen((prev) => !prev);
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
        onToggleIkDev={() => setIsIkDevOpen((prev) => !prev)}
      />

      {/* Main 3D Viewport Subtree */}
      <div className="w-full h-full pt-12">
        <Viewport pose={currentPose} showTargetGizmos={isIkDevOpen} />
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
        targets={targets}
        onChangeTargets={setTargets}
        currentPose={currentPose}
      />
    </main>
  );
}

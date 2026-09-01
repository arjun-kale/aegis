'use client';

import React, { useEffect, useState } from 'react';
import { FpsCounter } from './FpsCounter';
import { resolveModelContext, ACTIVE_TOOLS } from '@/lib/webmcp/register';
import { useMissionStore } from '@/lib/state/missionStore';
import type { LeftDockPanel, RightDockPanel } from '@/app/page';
import {
  Shield,
  Radio,
  Terminal,
  Activity,
  Sliders,
  Footprints,
  Compass,
  Gauge,
  ListFilter,
  Layers,
  FileJson,
  Sparkles,
} from 'lucide-react';

interface HeaderProps {
  leftDock: LeftDockPanel;
  onSetLeftDock: (panel: LeftDockPanel) => void;
  rightDock: RightDockPanel;
  onSetRightDock: (panel: RightDockPanel) => void;
  onToggleExportModal: () => void;
  isExportModalOpen: boolean;
}

function PanelButton({
  active,
  onClick,
  title,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={`flex items-center gap-1.5 px-2.5 h-8 text-[11px] font-medium transition-colors border ${
        active
          ? 'bg-accent-teal/20 border-accent-teal text-accent-teal'
          : 'bg-[#14171A] hover:bg-[#262B30] border-[#262B30] text-[#E8E3DA]'
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
      <span>{label}</span>
    </button>
  );
}

function DevButton({
  active,
  onClick,
  title,
  label,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={`px-2 h-6 text-[10px] font-medium tracking-wide transition-colors border ${
        active
          ? 'bg-accent-cyan/15 border-accent-cyan/50 text-accent-cyan'
          : 'bg-transparent hover:bg-[#262B30] border-[#262B30] text-[#5C646D]'
      }`}
    >
      {label}
    </button>
  );
}

export function Header({
  leftDock,
  onSetLeftDock,
  rightDock,
  onSetRightDock,
  onToggleExportModal,
  isExportModalOpen,
}: HeaderProps) {
  const [hasWebMcp, setHasWebMcp] = useState<boolean | null>(null);
  const [isSecure, setIsSecure] = useState<boolean>(true);
  const qualityMode = useMissionStore((state) => state.qualityMode);
  const setQualityMode = useMissionStore((state) => state.setQualityMode);

  useEffect(() => {
    const mc = resolveModelContext();
    setHasWebMcp(mc !== null);
    setIsSecure(typeof window !== 'undefined' ? window.isSecureContext : false);
  }, []);

  return (
    <header className="relative w-full h-11 shrink-0 z-40 flex items-center justify-between px-4 bg-[#1E2226] border-b border-[#262B30] text-[#E8E3DA] font-mono text-xs select-none shadow-md">
      {/* Brand & Project Identity */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="flex items-center justify-center w-6 h-6 bg-[#14171A] border border-[#262B30] text-accent-teal">
          <Shield className="w-3.5 h-3.5" />
        </div>
        <span className="font-semibold text-sm tracking-wider text-[#E8E3DA]">A.E.G.I.S</span>
        <span className="text-[9px] px-1.5 py-0.5 bg-[#14171A] border border-[#262B30] text-[#8E99A2] uppercase tracking-widest">
          v0.1.0 · Phase 10
        </span>
      </div>

      {/* Center: connectivity + perf vitals */}
      <div className="flex items-center gap-3 shrink-0">
        {hasWebMcp === false ? (
          <button
            onClick={() => onSetRightDock('console')}
            title="No WebMCP-capable agent context was detected on this page (or the origin is not a secure context). Degrading gracefully: use the fallback console to invoke every tool by hand — it calls the exact same execute() handlers an agent would."
            className="flex items-center gap-2 px-2.5 h-7 bg-[#14171A] border border-accent-amber/60 text-xs hover:bg-[#262B30] transition-colors cursor-help"
          >
            <Radio className="w-3.5 h-3.5 text-[#8E99A2]" />
            <span className="text-[#8E99A2]">WebMCP:</span>
            <span className="font-semibold text-accent-amber">FALLBACK_HARNESS</span>
            <span className="text-[10px] text-[#8E99A2] ml-1 underline">open console</span>
            {!isSecure && <span className="text-[10px] text-accent-red ml-1">(INSECURE_ORIGIN)</span>}
          </button>
        ) : (
          <div className="flex items-center gap-2 px-2.5 h-7 bg-[#14171A] border border-[#262B30] text-xs">
            <Radio className={`w-3.5 h-3.5 ${hasWebMcp ? 'text-accent-teal animate-pulse' : 'text-[#8E99A2]'}`} />
            <span className="text-[#8E99A2]">WebMCP:</span>
            <span className={`font-semibold ${hasWebMcp ? 'text-accent-teal' : 'text-[#8E99A2]'}`}>
              {hasWebMcp === null ? 'DETECTING...' : `CONNECTED (${ACTIVE_TOOLS.length} TOOLS)`}
            </span>
          </div>
        )}
        <FpsCounter />
      </div>

      {/* Right: three deliberate tiers, separated by dividers (Pass 1 hierarchy fix) */}
      <div className="flex items-center gap-3 min-w-0">
        {/* Tier 1 — operator panels (primary weight) */}
        <div className="flex items-center gap-1.5">
          <PanelButton
            active={leftDock === 'telemetry'}
            onClick={() => onSetLeftDock(leftDock === 'telemetry' ? null : 'telemetry')}
            title="Toggle Live Telemetry Panel (10Hz)"
            icon={Gauge}
            label="TELEMETRY"
          />
          <PanelButton
            active={rightDock === 'toolstream'}
            onClick={() => onSetRightDock(rightDock === 'toolstream' ? null : 'toolstream')}
            title="Toggle WebMCP Tool Execution Stream"
            icon={ListFilter}
            label="TOOL STREAM"
          />
          <PanelButton
            active={rightDock === 'facility'}
            onClick={() => onSetRightDock(rightDock === 'facility' ? null : 'facility')}
            title="Toggle Facility & Navigation Workbench (F5)"
            icon={Compass}
            label="FACILITY"
          />
          <PanelButton
            active={rightDock === 'exploded'}
            onClick={() => onSetRightDock(rightDock === 'exploded' ? null : 'exploded')}
            title="Toggle Exploded Engineering View (F6)"
            icon={Layers}
            label="EXPLODED VIEW"
          />
        </div>

        <div className="w-px h-6 bg-[#262B30]" />

        {/* Tier 2 — primary actions */}
        <div className="flex items-center gap-1.5">
          <PanelButton
            active={isExportModalOpen}
            onClick={onToggleExportModal}
            title="Export / Replay Mission Plan (F7)"
            icon={FileJson}
            label="EXPORT"
          />
          <PanelButton
            active={rightDock === 'console'}
            onClick={() => onSetRightDock(rightDock === 'console' ? null : 'console')}
            title="Open the WebMCP Fallback Console — invoke any tool by hand"
            icon={Terminal}
            label="CONSOLE"
          />
        </div>

        <div className="w-px h-6 bg-[#262B30]" />

        {/* Tier 3 — dev/debug harnesses, deliberately demoted (Pass 1 hierarchy fix) */}
        <div className="flex items-center gap-1">
          <span className="text-[9px] text-[#5C646D] uppercase tracking-widest mr-0.5">Dev</span>
          <DevButton
            active={leftDock === 'ik'}
            onClick={() => onSetLeftDock(leftDock === 'ik' ? null : 'ik')}
            title="IK Rig Dev Sliders (F3) — internal tuning harness, not an operator control"
            label="IK"
          />
          <DevButton
            active={leftDock === 'gait'}
            onClick={() => onSetLeftDock(leftDock === 'gait' ? null : 'gait')}
            title="Gait & Locomotion Bench (F4) — internal tuning harness, not an operator control"
            label="GAIT"
          />
          <DevButton
            active={qualityMode === 'HIGH'}
            onClick={() => setQualityMode(qualityMode === 'HIGH' ? 'PERFORMANCE' : 'HIGH')}
            title="Toggle postprocessing quality (Bloom + Vignette). Default off to protect framerate."
            label="FX"
          />
          <DevButton
            active={leftDock === 'perf'}
            onClick={() => onSetLeftDock(leftDock === 'perf' ? null : 'perf')}
            title="Frame Time Dev Graph (F2)"
            label="PERF"
          />
        </div>
      </div>
    </header>
  );
}

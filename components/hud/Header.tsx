'use client';

import React, { useEffect, useState } from 'react';
import { FpsCounter } from './FpsCounter';
import { resolveModelContext, ACTIVE_TOOLS } from '@/lib/webmcp/register';
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
} from 'lucide-react';

interface HeaderProps {
  onToggleConsole: () => void;
  isConsoleOpen: boolean;
  onToggleFrameTime: () => void;
  isFrameTimeOpen: boolean;
  onToggleIkDev: () => void;
  isIkDevOpen: boolean;
  onToggleGaitDev: () => void;
  isGaitDevOpen: boolean;
  onToggleFacilityDev: () => void;
  isFacilityDevOpen: boolean;
  onToggleTelemetry?: () => void;
  isTelemetryOpen?: boolean;
  onToggleToolLog?: () => void;
  isToolLogOpen?: boolean;
  onToggleEngineeringView?: () => void;
  isEngineeringViewOpen?: boolean;
  onToggleExportModal?: () => void;
  isExportModalOpen?: boolean;
}

export function Header({
  onToggleConsole,
  isConsoleOpen,
  onToggleFrameTime,
  isFrameTimeOpen,
  onToggleIkDev,
  isIkDevOpen,
  onToggleGaitDev,
  isGaitDevOpen,
  onToggleFacilityDev,
  isFacilityDevOpen,
  onToggleTelemetry,
  isTelemetryOpen = false,
  onToggleToolLog,
  isToolLogOpen = false,
  onToggleEngineeringView,
  isEngineeringViewOpen = false,
  onToggleExportModal,
  isExportModalOpen = false,
}: HeaderProps) {
  const [hasWebMcp, setHasWebMcp] = useState<boolean | null>(null);
  const [isSecure, setIsSecure] = useState<boolean>(true);

  useEffect(() => {
    const mc = resolveModelContext();
    setHasWebMcp(mc !== null);
    setIsSecure(typeof window !== 'undefined' ? window.isSecureContext : false);
  }, []);

  return (
    <header className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-2 bg-[#1E2226] border-b border-[#262B30] text-[#E8E3DA] font-mono text-xs select-none shadow-md">
      {/* Brand & Project Identity */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-7 h-7 bg-[#14171A] border border-[#262B30] text-accent-teal">
          <Shield className="w-4 h-4" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm tracking-wider text-[#E8E3DA]">
              A.E.G.I.S
            </span>
            <span className="text-[10px] px-1.5 py-0.5 bg-[#14171A] border border-[#262B30] text-[#8E99A2] uppercase tracking-widest">
              v0.1.0 • Phase 9
            </span>
          </div>
          <div className="text-[10px] text-[#8E99A2]">
            Autonomous Exploration & Gait Inversion Studio
          </div>
        </div>
      </div>

      {/* Center Status Indicators */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-2.5 py-1 bg-[#14171A] border border-[#262B30] text-xs">
          <Radio
            className={`w-3.5 h-3.5 ${
              hasWebMcp ? 'text-accent-teal animate-pulse' : 'text-[#8E99A2]'
            }`}
          />
          <span className="text-[#8E99A2]">WebMCP:</span>
          <span
            className={`font-semibold ${
              hasWebMcp ? 'text-accent-teal' : 'text-accent-amber'
            }`}
          >
            {hasWebMcp === null
              ? 'DETECTING...'
              : hasWebMcp
              ? `CONNECTED (${ACTIVE_TOOLS.length} TOOLS)`
              : 'FALLBACK_HARNESS'}
          </span>
          {!isSecure && (
            <span className="text-[10px] text-accent-red ml-1">(INSECURE_ORIGIN)</span>
          )}
        </div>

        <FpsCounter />
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-1.5">
        {onToggleExportModal && (
          <button
            onClick={onToggleExportModal}
            title="Export / Replay Mission Plan (F7)"
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs transition-colors border ${
              isExportModalOpen
                ? 'bg-accent-teal/20 border-accent-teal text-accent-teal'
                : 'bg-[#14171A] hover:bg-[#262B30] border-[#262B30] text-[#E8E3DA]'
            }`}
          >
            <FileJson className="w-3.5 h-3.5" />
            <span>EXPORT / REPLAY</span>
          </button>
        )}

        {onToggleEngineeringView && (
          <button
            onClick={onToggleEngineeringView}
            title="Toggle Exploded Engineering View (F6)"
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs transition-colors border ${
              isEngineeringViewOpen
                ? 'bg-accent-teal/20 border-accent-teal text-accent-teal'
                : 'bg-[#14171A] hover:bg-[#262B30] border-[#262B30] text-[#E8E3DA]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>EXPLODED VIEW</span>
          </button>
        )}

        {onToggleTelemetry && (
          <button
            onClick={onToggleTelemetry}
            title="Toggle Live Telemetry Panel (10Hz)"
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs transition-colors border ${
              isTelemetryOpen
                ? 'bg-accent-teal/20 border-accent-teal text-accent-teal'
                : 'bg-[#14171A] hover:bg-[#262B30] border-[#262B30] text-[#E8E3DA]'
            }`}
          >
            <Gauge className="w-3.5 h-3.5" />
            <span>TELEMETRY</span>
          </button>
        )}

        {onToggleToolLog && (
          <button
            onClick={onToggleToolLog}
            title="Toggle Tool Execution Stream"
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs transition-colors border ${
              isToolLogOpen
                ? 'bg-accent-teal/20 border-accent-teal text-accent-teal'
                : 'bg-[#14171A] hover:bg-[#262B30] border-[#262B30] text-[#E8E3DA]'
            }`}
          >
            <ListFilter className="w-3.5 h-3.5" />
            <span>TOOL STREAM</span>
          </button>
        )}

        <button
          onClick={onToggleFacilityDev}
          title="Toggle Facility & Navigation (F5)"
          className={`flex items-center gap-1.5 px-2.5 py-1 text-xs transition-colors border ${
            isFacilityDevOpen
              ? 'bg-accent-teal/20 border-accent-teal text-accent-teal'
              : 'bg-[#14171A] hover:bg-[#262B30] border-[#262B30] text-[#E8E3DA]'
          }`}
        >
          <Compass className="w-3.5 h-3.5" />
          <span>FACILITY</span>
        </button>

        <button
          onClick={onToggleGaitDev}
          title="Toggle Gait & Locomotion Bench (F4)"
          className={`flex items-center gap-1.5 px-2.5 py-1 text-xs transition-colors border ${
            isGaitDevOpen
              ? 'bg-accent-teal/20 border-accent-teal text-accent-teal'
              : 'bg-[#14171A] hover:bg-[#262B30] border-[#262B30] text-[#E8E3DA]'
          }`}
        >
          <Footprints className="w-3.5 h-3.5" />
          <span>GAIT</span>
        </button>

        <button
          onClick={onToggleIkDev}
          title="Toggle IK Rig Dev Sliders (F3)"
          className={`flex items-center gap-1.5 px-2.5 py-1 text-xs transition-colors border ${
            isIkDevOpen
              ? 'bg-accent-teal/20 border-accent-teal text-accent-teal'
              : 'bg-[#14171A] hover:bg-[#262B30] border-[#262B30] text-[#E8E3DA]'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>IK RIG</span>
        </button>

        <button
          onClick={onToggleFrameTime}
          title="Toggle Frame Time Dev Graph (F2)"
          className={`flex items-center gap-1.5 px-2.5 py-1 text-xs transition-colors border ${
            isFrameTimeOpen
              ? 'bg-accent-teal/20 border-accent-teal text-accent-teal'
              : 'bg-[#14171A] hover:bg-[#262B30] border-[#262B30] text-[#E8E3DA]'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>PERF</span>
        </button>

        <button
          onClick={onToggleConsole}
          className={`flex items-center gap-2 px-3 py-1 text-xs transition-colors border ${
            isConsoleOpen
              ? 'bg-accent-teal/20 border-accent-teal text-accent-teal'
              : 'bg-[#14171A] hover:bg-[#262B30] border-[#262B30] text-[#E8E3DA]'
          }`}
        >
          <Terminal className="w-3.5 h-3.5" />
          <span>CONSOLE</span>
        </button>
      </div>
    </header>
  );
}

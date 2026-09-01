'use client';

import React, { useEffect, useState } from 'react';
import { FpsCounter } from './FpsCounter';
import { resolveModelContext } from '@/lib/webmcp/register';
import { Shield, Radio, Terminal, Activity, Sliders, Footprints, Compass } from 'lucide-react';

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
}: HeaderProps) {
  const [hasWebMcp, setHasWebMcp] = useState<boolean | null>(null);
  const [isSecure, setIsSecure] = useState<boolean>(true);

  useEffect(() => {
    const mc = resolveModelContext();
    setHasWebMcp(mc !== null);
    setIsSecure(typeof window !== 'undefined' ? window.isSecureContext : false);
  }, []);

  return (
    <header className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-2.5 bg-surface/90 backdrop-blur-sm border-b border-surface-border">
      {/* Brand & Project Identity */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-7 h-7 rounded bg-surface-raised border border-surface-border text-accent-cyan">
          <Shield className="w-4 h-4" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-sm tracking-wider text-foreground">
              A.E.G.I.S
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-raised border border-surface-border text-foreground-muted uppercase tracking-widest font-mono">
              v0.1.0 • Phase 4
            </span>
          </div>
          <div className="text-[11px] text-foreground-muted">
            Autonomous Exploration & Gait Inversion Studio
          </div>
        </div>
      </div>

      {/* Center Status Indicators */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-2.5 py-1 rounded bg-surface-muted border border-surface-border text-xs font-mono">
          <Radio
            className={`w-3.5 h-3.5 ${
              hasWebMcp ? 'text-accent-green animate-pulse' : 'text-foreground-muted'
            }`}
          />
          <span className="text-foreground-muted">WebMCP:</span>
          <span
            className={`font-medium ${
              hasWebMcp ? 'text-accent-green' : 'text-accent-amber'
            }`}
          >
            {hasWebMcp === null
              ? 'DETECTING...'
              : hasWebMcp
              ? 'CONNECTED'
              : 'FALLBACK_MODE'}
          </span>
          {!isSecure && (
            <span className="text-[10px] text-accent-red ml-1">(INSECURE_ORIGIN)</span>
          )}
        </div>

        <FpsCounter />
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleFacilityDev}
          title="Toggle Facility & Navigation (F5)"
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-mono transition-colors border ${
            isFacilityDevOpen
              ? 'bg-accent-teal/30 border-accent-teal text-accent-cyan'
              : 'bg-surface-raised hover:bg-surface border-surface-border text-foreground'
          }`}
        >
          <Compass className="w-3.5 h-3.5" />
          <span>FACILITY & NAV</span>
        </button>

        <button
          onClick={onToggleGaitDev}
          title="Toggle Gait & Locomotion Bench (F4)"
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-mono transition-colors border ${
            isGaitDevOpen
              ? 'bg-accent-teal/30 border-accent-teal text-accent-cyan'
              : 'bg-surface-raised hover:bg-surface border-surface-border text-foreground'
          }`}
        >
          <Footprints className="w-3.5 h-3.5" />
          <span>GAIT</span>
        </button>

        <button
          onClick={onToggleIkDev}
          title="Toggle IK Rig Dev Sliders (F3)"
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-mono transition-colors border ${
            isIkDevOpen
              ? 'bg-accent-teal/30 border-accent-teal text-accent-cyan'
              : 'bg-surface-raised hover:bg-surface border-surface-border text-foreground'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>IK RIG</span>
        </button>

        <button
          onClick={onToggleFrameTime}
          title="Toggle Frame Time Dev Graph (F2)"
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-mono transition-colors border ${
            isFrameTimeOpen
              ? 'bg-accent-cyan/20 border-accent-cyan text-accent-cyan'
              : 'bg-surface-raised hover:bg-surface border-surface-border text-foreground'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>PERF</span>
        </button>

        <button
          onClick={onToggleConsole}
          className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-mono transition-colors border ${
            isConsoleOpen
              ? 'bg-accent-teal/20 border-accent-teal text-accent-cyan'
              : 'bg-surface-raised hover:bg-surface border-surface-border text-foreground'
          }`}
        >
          <Terminal className="w-3.5 h-3.5" />
          <span>CONSOLE</span>
        </button>
      </div>
    </header>
  );
}

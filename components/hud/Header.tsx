'use client';

import React, { useEffect, useState, useRef } from 'react';
import { FpsCounter } from './FpsCounter';
import { resolveModelContext, ACTIVE_TOOLS } from '@/lib/webmcp/register';
import { useMissionStore } from '@/lib/state/missionStore';
import type { LeftDockPanel, RightDockPanel } from '@/app/page';
import {
  Shield,
  Radio,
  Terminal,
  Wrench,
  Compass,
  Gauge,
  ListFilter,
  Layers,
  FileJson,
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
      // Explicit aria-label, independent of the visually-collapsed span
      // below: a `hidden` element is excluded from the accessible name
      // computation, so without this a screen-reader user at <2xl widths
      // would get a nameless icon button. Label-in-name (WCAG 2.5.3) is
      // preserved since the visible text, when shown, is this same string.
      aria-label={label}
      className={`flex items-center gap-1.5 px-2.5 h-8 text-[11px] font-medium transition-colors border ${
        active
          ? 'bg-accent-teal/20 border-accent-teal text-accent-teal'
          : 'bg-[#14171A] hover:bg-[#262B30] border-[#262B30] text-[#E8E3DA]'
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
      {/* Responsive collapse (Pass 3): below 2xl (1536px) the header's five
          button groups don't fit at once — confirmed by measurement at the
          plan's own 1280px target, where the label text alone accounted for
          ~230px of a ~370px overflow. Icon + title tooltip + aria-label
          carry the same information at every width; visible text is a
          bonus once there's room. */}
      <span className="hidden 2xl:inline" aria-hidden="true">{label}</span>
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
      role="menuitem"
      className={`w-full text-left whitespace-nowrap px-2.5 h-7 text-[10px] font-medium tracking-wide transition-colors border ${
        active
          ? 'bg-accent-cyan/15 border-accent-cyan/50 text-accent-cyan'
          : 'bg-transparent hover:bg-[#262B30] border-transparent text-[#8E99A2]'
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
  const [isDevMenuOpen, setIsDevMenuOpen] = useState<boolean>(false);
  const qualityMode = useMissionStore((state) => state.qualityMode);
  const setQualityMode = useMissionStore((state) => state.setQualityMode);
  const devMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mc = resolveModelContext();
    setHasWebMcp(mc !== null);
    setIsSecure(typeof window !== 'undefined' ? window.isSecureContext : false);
  }, []);

  // Close the dev-tools disclosure on outside click or Escape (§38 Menu Engine).
  useEffect(() => {
    if (!isDevMenuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (devMenuRef.current && !devMenuRef.current.contains(e.target as Node)) {
        setIsDevMenuOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsDevMenuOpen(false);
    };
    window.addEventListener('mousedown', handleClick);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('mousedown', handleClick);
      window.removeEventListener('keydown', handleKey);
    };
  }, [isDevMenuOpen]);

  return (
    // z-50, one layer above AuthorityGateHUD (z-40): both are same-height
    // siblings in normal flow with no visual overlap of their own boxes,
    // but the Dev dropdown below is an absolutely-positioned descendant
    // that extends past the header's box into the gate bar's vertical
    // space — its z-50 is scoped to header's own stacking context, so
    // without this the header (and everything in it) loses the tie to
    // the gate bar, which renders later in the DOM.
    <header className="relative w-full h-11 shrink-0 z-50 flex items-center justify-between px-4 bg-[#1E2226] border-b border-[#262B30] text-[#E8E3DA] font-mono text-xs select-none shadow-md">
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
            <Radio className={`w-3.5 h-3.5 ${hasWebMcp ? 'text-accent-green animate-pulse' : 'text-[#8E99A2]'}`} />
            <span className="text-[#8E99A2]">WebMCP:</span>
            <span className={`font-semibold ${hasWebMcp ? 'text-accent-green' : 'text-[#8E99A2]'}`}>
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

        {/* Tier 3 — dev/debug harnesses, gated behind a single disclosure
            (Pass 1 demoted these visually; Pass 3 removes them from the
            primary chrome entirely — freeing ~150px is also what makes the
            header fit at the plan's 1280px target). */}
        <div className="relative" ref={devMenuRef}>
          <button
            onClick={() => setIsDevMenuOpen((v) => !v)}
            title="Internal tuning harnesses — not operator controls"
            aria-expanded={isDevMenuOpen}
            aria-haspopup="true"
            aria-label="Dev"
            className={`flex items-center gap-1.5 px-2 h-8 text-[10px] font-medium tracking-wide transition-colors border ${
              isDevMenuOpen || leftDock === 'ik' || leftDock === 'gait' || leftDock === 'perf' || qualityMode === 'HIGH'
                ? 'bg-accent-cyan/15 border-accent-cyan/50 text-accent-cyan'
                : 'bg-transparent hover:bg-[#262B30] border-[#262B30] text-[#5C646D]'
            }`}
          >
            <Wrench className="w-3 h-3" />
            <span className="hidden 2xl:inline uppercase tracking-widest" aria-hidden="true">Dev</span>
          </button>

          {isDevMenuOpen && (
            <div
              className="absolute top-full right-0 mt-1.5 flex flex-col gap-1 p-1.5 bg-[#1E2226] border border-[#262B30] shadow-2xl z-50"
              role="menu"
              aria-label="Developer tools"
            >
              <DevButton
                active={leftDock === 'ik'}
                onClick={() => onSetLeftDock(leftDock === 'ik' ? null : 'ik')}
                title="IK Rig Dev Sliders (F3) — internal tuning harness, not an operator control"
                label="IK RIG"
              />
              <DevButton
                active={leftDock === 'gait'}
                onClick={() => onSetLeftDock(leftDock === 'gait' ? null : 'gait')}
                title="Gait & Locomotion Bench (F4) — internal tuning harness, not an operator control"
                label="GAIT BENCH"
              />
              <DevButton
                active={qualityMode === 'HIGH'}
                onClick={() => setQualityMode(qualityMode === 'HIGH' ? 'PERFORMANCE' : 'HIGH')}
                title="Toggle postprocessing quality (Bloom + Vignette). Default off to protect framerate."
                label="QUALITY FX"
              />
              <DevButton
                active={leftDock === 'perf'}
                onClick={() => onSetLeftDock(leftDock === 'perf' ? null : 'perf')}
                title="Frame Time Dev Graph (F2)"
                label="PERF GRAPH"
              />
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

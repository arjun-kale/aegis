'use client';

import React from 'react';
import { FACILITY_MECHANISMS } from '@/lib/world/mechanisms';
import { MechanismRecord } from '@/lib/state/missionStore';
import { NavPathResult } from '@/lib/world/navigation';
import {
  Compass,
  Zap,
  Radio,
  Eye,
  X,
  CheckCircle,
  AlertOctagon,
  CornerDownRight,
} from 'lucide-react';

interface FacilityDevPanelProps {
  isOpen: boolean;
  onClose: () => void;
  seed: number;
  onChangeSeed: (seed: number) => void;
  mechanisms: Record<string, MechanismRecord>;
  onToggleMechanism: (id: string, command: string) => void;
  navPathResult: NavPathResult;
  selectedNavTargetName: string;
  onSelectNavTarget: (target: 'extraction' | 'eastWing' | 'westVault') => void;
  onTriggerScan: () => void;
  scannedCellsCount: number;
  unexploredFrontiersCount: number;
}

export function FacilityDevPanel({
  isOpen,
  onClose,
  seed,
  onChangeSeed,
  mechanisms,
  onToggleMechanism,
  navPathResult,
  selectedNavTargetName,
  onSelectNavTarget,
  onTriggerScan,
  scannedCellsCount,
  unexploredFrontiersCount,
}: FacilityDevPanelProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed right-4 top-[100px] bottom-4 w-[400px] max-w-[calc(100vw-32px)] z-30 flex flex-col bg-[#FFFFFF] border border-[#DDE1E6] shadow-2xl overflow-hidden font-mono text-xs select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 bg-surface-raised border-b border-surface-border">
        <div className="flex items-center gap-2 text-foreground font-semibold">
          <Compass className="w-4 h-4 text-accent-cyan" />
          <span>FACILITY & NAVIGATION WORKBENCH</span>
        </div>
        <button
          onClick={onClose}
          className="text-foreground-muted hover:text-foreground p-1 rounded hover:bg-surface-border"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-3 overflow-y-auto space-y-4">
        {/* Seed Info */}
        <div className="p-2.5 rounded bg-surface-muted border border-surface-border flex items-center justify-between">
          <span className="text-foreground-muted text-[11px]">Procedural Seed:</span>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-surface border border-surface-border text-accent-cyan font-bold">
              {seed}
            </span>
            <button
              onClick={() => onChangeSeed((seed + 1) % 1000)}
              className="px-2 py-0.5 rounded bg-surface-raised hover:bg-surface border border-surface-border text-foreground text-[10px]"
            >
              Re-Seed
            </button>
          </div>
        </div>

        {/* Dynamic Facility Mechanisms Controls */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-[11px] text-foreground-muted uppercase tracking-wider">
            <Zap className="w-3.5 h-3.5 text-accent-amber" />
            <span>Facility Mechanisms (§4)</span>
          </div>

          <div className="space-y-2">
            {Object.entries(FACILITY_MECHANISMS).map(([id, def]) => {
              const current = mechanisms[id];
              const state = current?.state || def.defaultState;
              const isPassable = current ? current.passable : state === 'DISARMED' || state === 'OPEN' || state === 'LOWERED';

              return (
                <div
                  key={id}
                  className="p-2.5 rounded bg-surface border border-surface-border flex items-center justify-between"
                >
                  <div className="space-y-0.5">
                    <div className="text-foreground font-semibold text-[11px]">{id}</div>
                    <div className="text-[10px] text-foreground-muted flex items-center gap-1.5">
                      <span>Status:</span>
                      <span
                        className={`font-bold ${
                          isPassable ? 'text-accent-green' : 'text-accent-redText'
                        }`}
                      >
                        {state}
                      </span>
                    </div>
                  </div>

                  {/* Toggle Button */}
                  {def.type === 'LASER_GATE' && (
                    <button
                      onClick={() =>
                        onToggleMechanism(id, state === 'ARMED' ? 'DEACTIVATE' : 'ACTIVATE')
                      }
                      className={`px-2.5 py-1 rounded text-[11px] font-bold border transition-colors ${
                        state === 'ARMED'
                          ? 'bg-[#F1F2F5] border-accent-red text-accent-redText hover:bg-[#EDEFF2]'
                          : 'bg-accent-green/20 border-accent-green text-accent-green hover:bg-accent-green/30'
                      }`}
                    >
                      {state === 'ARMED' ? 'DEACTIVATE' : 'ARM'}
                    </button>
                  )}

                  {def.type === 'SEALED_DOOR' && (
                    <button
                      onClick={() =>
                        onToggleMechanism(id, state === 'SEALED' ? 'DIVERT_POWER' : 'SEAL')
                      }
                      className={`px-2.5 py-1 rounded text-[11px] font-bold border transition-colors ${
                        state === 'SEALED'
                          ? 'bg-accent-amber/20 border-accent-amber text-accent-amber hover:bg-accent-amber/30'
                          : 'bg-accent-green/20 border-accent-green text-accent-green hover:bg-accent-green/30'
                      }`}
                    >
                      {state === 'SEALED' ? 'DIVERT POWER' : 'SEAL'}
                    </button>
                  )}

                  {def.type === 'FREIGHT_LIFT' && (
                    <button
                      onClick={() =>
                        onToggleMechanism(id, state === 'LOWERED' ? 'RAISE' : 'LOWER')
                      }
                      className="px-2.5 py-1 rounded text-[11px] font-bold bg-surface-raised hover:bg-surface border border-surface-border text-foreground"
                    >
                      {state === 'LOWERED' ? 'RAISE' : 'LOWER'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* A* Navigation Path Query */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-[11px] text-foreground-muted uppercase tracking-wider">
            <Radio className="w-3.5 h-3.5 text-accent-cyan" />
            <span>A* Navigation Query (§4)</span>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            <button
              onClick={() => onSelectNavTarget('extraction')}
              className={`p-1.5 rounded text-[10px] font-bold border truncate text-center ${
                selectedNavTargetName === 'extraction'
                  ? 'bg-accent-teal/30 border-accent-teal text-accent-cyan'
                  : 'bg-surface hover:bg-surface-raised border-surface-border text-foreground'
              }`}
            >
              EXTRACTION
            </button>
            <button
              onClick={() => onSelectNavTarget('eastWing')}
              className={`p-1.5 rounded text-[10px] font-bold border truncate text-center ${
                selectedNavTargetName === 'eastWing'
                  ? 'bg-accent-teal/30 border-accent-teal text-accent-cyan'
                  : 'bg-surface hover:bg-surface-raised border-surface-border text-foreground'
              }`}
            >
              EAST WING
            </button>
            <button
              onClick={() => onSelectNavTarget('westVault')}
              className={`p-1.5 rounded text-[10px] font-bold border truncate text-center ${
                selectedNavTargetName === 'westVault'
                  ? 'bg-accent-teal/30 border-accent-teal text-accent-cyan'
                  : 'bg-surface hover:bg-surface-raised border-surface-border text-foreground'
              }`}
            >
              WEST VAULT
            </button>
          </div>

          {/* A* Query Result Box */}
          <div className="p-3 rounded bg-[#ECEEF1] border border-surface-border space-y-1.5 text-[11px]">
            {navPathResult.blockedBy ? (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-accent-redText font-bold">
                  <AlertOctagon className="w-4 h-4" />
                  <span>BLOCKED_GEOMETRY</span>
                </div>
                <div className="text-foreground-muted text-[10px]">
                  Corridor sealed by:{' '}
                  <span className="text-accent-amber font-bold">
                    {navPathResult.blockedBy}
                  </span>
                </div>
                <div className="text-[10px] text-foreground-muted pt-1 border-t border-surface-border">
                  Suggested Action: Disarm or override {navPathResult.blockedBy} to open path.
                </div>
              </div>
            ) : navPathResult.path.length > 0 ? (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-accent-green font-bold">
                  <CheckCircle className="w-4 h-4" />
                  <span>ROUTE COMPUTED (CLEAR)</span>
                </div>
                <div className="flex justify-between text-[10px] text-foreground-muted">
                  <span>Waypoints: {navPathResult.path.length}</span>
                  <span>Cost: {navPathResult.cost.toFixed(1)}m</span>
                </div>
              </div>
            ) : (
              <div className="text-foreground-muted text-[10px]">No route calculated.</div>
            )}
          </div>
        </div>

        {/* Spatial Line-of-Sight Scanner */}
        <div className="p-3 bg-surface-raised rounded border border-surface-border space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-accent-cyan font-semibold text-[11px]">
              <Eye className="w-4 h-4" />
              <span>SPATIAL EXPLORATION (§4)</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div className="p-2 rounded bg-[#ECEEF1] border border-surface-border">
              <div className="text-foreground-muted">SCANNED CELLS:</div>
              <div className="text-foreground font-bold text-xs">{scannedCellsCount}</div>
            </div>
            <div className="p-2 rounded bg-[#ECEEF1] border border-surface-border">
              <div className="text-foreground-muted">FRONTIERS:</div>
              <div className="text-accent-cyan font-bold text-xs">{unexploredFrontiersCount}</div>
            </div>
          </div>

          <button
            onClick={onTriggerScan}
            className="w-full py-2 px-3 rounded bg-accent-teal hover:bg-accent-teal/80 text-white font-bold flex items-center justify-center gap-1.5"
          >
            <CornerDownRight className="w-3.5 h-3.5" />
            <span>TRIGGER 15m SPATIAL SCAN</span>
          </button>
        </div>
      </div>
    </div>
  );
}

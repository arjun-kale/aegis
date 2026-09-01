'use client';

import React from 'react';
import { GaitProfileName, GAIT_CONFIGS } from '@/lib/robot/gait';
import { STANDARD_PATHS } from '@/lib/robot/locomotion';
import { StabilityAnalysisResult } from '@/lib/robot/stability';
import {
  Footprints,
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  Shield,
  X,
  Gauge,
  Zap,
} from 'lucide-react';

interface GaitDevPanelProps {
  isOpen: boolean;
  onClose: () => void;
  selectedProfile: GaitProfileName;
  onSelectProfile: (profile: GaitProfileName) => void;
  selectedPathKey: string;
  onSelectPathKey: (key: string) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onReset: () => void;
  onStepForward: () => void;
  playbackSpeed: number;
  onChangeSpeed: (speed: number) => void;
  stabilityResult: StabilityAnalysisResult;
  progressM: number;
  totalDistanceM: number;
}

export function GaitDevPanel({
  isOpen,
  onClose,
  selectedProfile,
  onSelectProfile,
  selectedPathKey,
  onSelectPathKey,
  isPlaying,
  onTogglePlay,
  onReset,
  onStepForward,
  playbackSpeed,
  onChangeSpeed,
  stabilityResult,
  progressM,
  totalDistanceM,
}: GaitDevPanelProps) {
  if (!isOpen) return null;

  const currentConfig = GAIT_CONFIGS[selectedProfile];
  const margin = stabilityResult.stabilityMargin;

  const marginColor =
    margin >= 0.6
      ? 'text-accent-green'
      : margin >= 0.4
      ? 'text-accent-amber'
      : 'text-accent-redText';

  const marginBgColor =
    margin >= 0.6
      ? 'bg-accent-green'
      : margin >= 0.4
      ? 'bg-accent-amber'
      : 'bg-accent-red';

  const stanceLabel =
    stabilityResult.stanceState === 0
      ? 'DOUBLE SUPPORT'
      : stabilityResult.stanceState === 1
      ? 'LEFT STANCE'
      : stabilityResult.stanceState === 2
      ? 'RIGHT STANCE'
      : 'FLIGHT';

  return (
    <div className="fixed left-4 top-[100px] bottom-4 w-[360px] max-w-[calc(100vw-32px)] z-30 flex flex-col bg-[#1E2226] border border-[#262B30] shadow-2xl overflow-hidden font-mono text-xs select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 bg-surface-raised border-b border-surface-border">
        <div className="flex items-center gap-2 text-foreground font-semibold">
          <Footprints className="w-4 h-4 text-accent-cyan" />
          <span>LOCOMOTION & GAIT BENCH</span>
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
        {/* Gait Profile Selector */}
        <div className="space-y-2">
          <div className="text-[11px] text-foreground-muted uppercase tracking-wider">
            Gait Profile (§3)
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {(['CAUTIOUS_STEP', 'DYNAMIC_BALANCE', 'HIGH_CLEARANCE'] as GaitProfileName[]).map(
              (p) => (
                <button
                  key={p}
                  onClick={() => onSelectProfile(p)}
                  className={`p-2 rounded text-[11px] font-bold border transition-colors text-center ${
                    selectedProfile === p
                      ? 'bg-accent-teal/30 border-accent-teal text-accent-cyan'
                      : 'bg-surface hover:bg-surface-raised border-surface-border text-foreground'
                  }`}
                >
                  {p === 'CAUTIOUS_STEP'
                    ? 'CAUTIOUS'
                    : p === 'DYNAMIC_BALANCE'
                    ? 'DYNAMIC'
                    : 'HIGH CLEAR'}
                </button>
              )
            )}
          </div>

          {/* Profile Specs */}
          <div className="p-2.5 rounded bg-[#0E1012] border border-surface-border text-[10px] space-y-1">
            <div className="flex justify-between">
              <span className="text-foreground-muted">Stride Length:</span>
              <span className="text-foreground">{currentConfig.strideLengthM} m</span>
            </div>
            <div className="flex justify-between">
              <span className="text-foreground-muted">Cycle Duration:</span>
              <span className="text-foreground">{currentConfig.stepDurationSec} s</span>
            </div>
            <div className="flex justify-between">
              <span className="text-foreground-muted">Double Support:</span>
              <span className="text-foreground">{(currentConfig.doubleSupportRatio * 100).toFixed(0)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-foreground-muted">Swing Apex:</span>
              <span className="text-accent-cyan font-bold">{currentConfig.swingApexM * 100} cm</span>
            </div>
          </div>
        </div>

        {/* Path Scenarios */}
        <div className="space-y-1.5">
          <div className="text-[11px] text-foreground-muted uppercase tracking-wider">
            Test Path Trajectory
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {Object.entries(STANDARD_PATHS).map(([key, val]) => (
              <button
                key={key}
                onClick={() => onSelectPathKey(key)}
                className={`px-2.5 py-1.5 rounded text-[11px] border transition-colors text-left truncate ${
                  selectedPathKey === key
                    ? 'bg-surface-raised border-accent-cyan text-accent-cyan'
                    : 'bg-surface hover:bg-surface-raised border-surface-border text-foreground-muted hover:text-foreground'
                }`}
              >
                {val.label}
              </button>
            ))}
          </div>
        </div>

        {/* Playback Controls */}
        <div className="p-3 bg-surface-muted rounded border border-surface-border space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <button
                onClick={onTogglePlay}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-accent-teal hover:bg-accent-teal/80 text-white font-bold text-xs"
              >
                {isPlaying ? (
                  <>
                    <Pause className="w-3.5 h-3.5 fill-current" /> PAUSE
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" /> WALK
                  </>
                )}
              </button>

              <button
                onClick={onStepForward}
                disabled={isPlaying}
                title="Step +0.1s"
                className="p-1.5 rounded bg-surface hover:bg-surface-raised border border-surface-border text-foreground disabled:opacity-40"
              >
                <SkipForward className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={onReset}
                title="Reset Trajectory"
                className="p-1.5 rounded bg-surface hover:bg-surface-raised border border-surface-border text-foreground"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="text-[11px] text-foreground-muted">
              Speed: <span className="text-accent-cyan font-bold">{playbackSpeed}x</span>
            </div>
          </div>

          {/* Speed Slider */}
          <input
            type="range"
            min="0.25"
            max="2.0"
            step="0.25"
            value={playbackSpeed}
            onChange={(e) => onChangeSpeed(parseFloat(e.target.value))}
            className="w-full accent-[#00E5FF]"
          />

          {/* Progress Bar */}
          {totalDistanceM > 0.1 && (
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] text-foreground-muted">
                <span>Progress: {progressM.toFixed(1)}m</span>
                <span>Total: {totalDistanceM.toFixed(1)}m</span>
              </div>
              <div className="w-full h-1.5 rounded bg-[#0E1012] overflow-hidden">
                <div
                  className="h-full bg-accent-cyan transition-all duration-75"
                  style={{ width: `${Math.min(100, (progressM / totalDistanceM) * 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Live Stability Margin Meter (§1.3) */}
        <div className="p-3 bg-surface-raised rounded border border-surface-border space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-accent-cyan font-semibold text-[11px]">
              <Shield className="w-4 h-4" />
              <span>STATIC STABILITY MARGIN (§1.3)</span>
            </div>
            <span className={`font-bold text-xs ${marginColor}`}>
              {margin.toFixed(2)}
            </span>
          </div>

          {/* Gauge Bar */}
          <div className="w-full h-2 rounded bg-[#0E1012] overflow-hidden relative">
            <div
              className={`h-full ${marginBgColor} transition-all duration-75`}
              style={{ width: `${Math.max(0, Math.min(100, margin * 100))}%` }}
            />
          </div>

          <div className="flex justify-between items-center text-[10px]">
            <span className="text-foreground-muted">STANCE STATE:</span>
            <span className="px-1.5 py-0.5 rounded bg-surface border border-surface-border text-foreground font-bold">
              {stanceLabel}
            </span>
          </div>
        </div>

        {/* Dynamic Joint Torque Estimation Readout */}
        <div className="p-3 rounded bg-[#0E1012] border border-surface-border space-y-2 text-[10px]">
          <div className="flex items-center gap-1.5 text-accent-amber font-bold">
            <Zap className="w-3.5 h-3.5" />
            <span>GRAVITATIONAL JOINT TORQUES (N·m)</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <div className="text-foreground-muted font-bold">LEFT LEG (L)</div>
              <div className="flex justify-between">
                <span className="text-foreground-muted">Hip:</span>
                <span className="text-foreground">{stabilityResult.jointTorquesNm.hipL}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-foreground-muted">Knee:</span>
                <span className="text-accent-amber font-semibold">{stabilityResult.jointTorquesNm.kneeL}</span>
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-foreground-muted font-bold">RIGHT LEG (R)</div>
              <div className="flex justify-between">
                <span className="text-foreground-muted">Hip:</span>
                <span className="text-foreground">{stabilityResult.jointTorquesNm.hipR}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-foreground-muted">Knee:</span>
                <span className="text-accent-amber font-semibold">{stabilityResult.jointTorquesNm.kneeR}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

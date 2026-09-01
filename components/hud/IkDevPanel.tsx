'use client';

import React from 'react';
import { FullBodyPoseTargets, FullBodyKinematicState } from '@/lib/robot/kinematics';
import { Sliders, RefreshCw, X, AlertTriangle, CheckCircle } from 'lucide-react';

interface IkDevPanelProps {
  isOpen: boolean;
  onClose: () => void;
  targets: FullBodyPoseTargets;
  onChangeTargets: (newTargets: FullBodyPoseTargets) => void;
  currentPose: FullBodyKinematicState;
}

export const STANCE_PRESETS: Record<string, { label: string; targets: FullBodyPoseTargets }> = {
  default: {
    label: 'Default Stance',
    targets: {
      torsoPosition: [0, 0.95, 0],
      torsoRotationEuler: [0, 0, 0],
      footL: [-0.14, 0.0, 0.0],
      footR: [0.14, 0.0, 0.0],
      handL: [-0.28, 0.55, 0.05],
      handR: [0.28, 0.55, 0.05],
      headLookAt: [0, 1.2, 5.0],
    },
  },
  squat: {
    label: 'Deep Squat',
    targets: {
      torsoPosition: [0, 0.62, 0.0],
      torsoRotationEuler: [0.15, 0, 0],
      footL: [-0.18, 0.0, 0.05],
      footR: [0.18, 0.0, 0.05],
      handL: [-0.30, 0.45, 0.25],
      handR: [0.30, 0.45, 0.25],
      headLookAt: [0, 0.8, 4.0],
    },
  },
  stride: {
    label: 'Forward Stride',
    targets: {
      torsoPosition: [0, 0.90, 0.0],
      torsoRotationEuler: [0.05, 0, 0],
      footL: [-0.14, 0.0, 0.35],
      footR: [0.14, 0.0, -0.30],
      handL: [-0.28, 0.55, -0.20],
      handR: [0.28, 0.55, 0.25],
      headLookAt: [0, 1.0, 5.0],
    },
  },
  highStep: {
    label: 'High Step / Obstacle',
    targets: {
      torsoPosition: [0, 0.92, -0.05],
      torsoRotationEuler: [0.08, -0.05, 0],
      footL: [-0.14, 0.28, 0.30],
      footR: [0.14, 0.0, -0.10],
      handL: [-0.32, 0.65, 0.10],
      handR: [0.32, 0.55, -0.15],
      headLookAt: [0, 0.5, 2.0],
    },
  },
  overreach: {
    label: 'Clamped Overreach',
    targets: {
      torsoPosition: [0, 0.95, 0],
      torsoRotationEuler: [0, 0, 0],
      footL: [-0.60, -0.20, 0.85], // Out of reach
      footR: [0.14, 0.0, 0.0],
      handL: [-0.50, 0.90, 0.60],
      handR: [0.28, 0.55, 0.05],
      headLookAt: [-0.5, 0.5, 2.0],
    },
  },
};

export function IkDevPanel({
  isOpen,
  onClose,
  targets,
  onChangeTargets,
  currentPose,
}: IkDevPanelProps) {
  if (!isOpen) return null;

  const updateTorso = (axis: number, val: number) => {
    const nextPos: [number, number, number] = [...targets.torsoPosition];
    nextPos[axis] = val;
    onChangeTargets({ ...targets, torsoPosition: nextPos });
  };

  const updateFootL = (axis: number, val: number) => {
    const nextFoot: [number, number, number] = [...targets.footL];
    nextFoot[axis] = val;
    onChangeTargets({ ...targets, footL: nextFoot });
  };

  const updateFootR = (axis: number, val: number) => {
    const nextFoot: [number, number, number] = [...targets.footR];
    nextFoot[axis] = val;
    onChangeTargets({ ...targets, footR: nextFoot });
  };

  return (
    <div className="absolute left-4 top-16 bottom-4 w-[360px] max-w-[calc(100vw-32px)] z-30 flex flex-col bg-surface/95 backdrop-blur-md border border-surface-border rounded-lg shadow-2xl overflow-hidden font-mono text-xs select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 bg-surface-raised border-b border-surface-border">
        <div className="flex items-center gap-2 text-foreground font-semibold">
          <Sliders className="w-4 h-4 text-accent-cyan" />
          <span>IK RIG & KINEMATICS DEV</span>
        </div>
        <button
          onClick={onClose}
          className="text-foreground-muted hover:text-foreground p-1 rounded hover:bg-surface-border"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Preset Stance Selector */}
      <div className="p-3 bg-surface-muted border-b border-surface-border flex flex-col gap-2">
        <div className="text-[11px] text-foreground-muted uppercase tracking-wider">
          Stance Presets
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {Object.entries(STANCE_PRESETS).map(([key, preset]) => (
            <button
              key={key}
              onClick={() => onChangeTargets(preset.targets)}
              className="px-2 py-1.5 rounded bg-surface hover:bg-surface-raised border border-surface-border text-foreground hover:text-accent-cyan text-[11px] transition-colors text-left truncate"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sliders Container */}
      <div className="flex-1 p-3 overflow-y-auto space-y-4">
        {/* Torso Controls */}
        <div className="space-y-2">
          <div className="text-accent-cyan font-semibold text-[11px] border-b border-surface-border pb-1">
            TORSO ROOT POSE
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-foreground-muted">Height (Y):</span>
              <span className="text-foreground">{targets.torsoPosition[1].toFixed(2)} m</span>
            </div>
            <input
              type="range"
              min="0.50"
              max="1.15"
              step="0.01"
              value={targets.torsoPosition[1]}
              onChange={(e) => updateTorso(1, parseFloat(e.target.value))}
              className="w-full accent-[#00E5FF]"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-foreground-muted">Sway (X):</span>
              <span className="text-foreground">{targets.torsoPosition[0].toFixed(2)} m</span>
            </div>
            <input
              type="range"
              min="-0.40"
              max="0.40"
              step="0.01"
              value={targets.torsoPosition[0]}
              onChange={(e) => updateTorso(0, parseFloat(e.target.value))}
              className="w-full accent-[#00E5FF]"
            />
          </div>
        </div>

        {/* Left Foot Controls */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-accent-cyan font-semibold text-[11px] border-b border-surface-border pb-1">
            <span>LEFT FOOT (END-EFFECTOR)</span>
            {currentPose.legL.isClamped ? (
              <span className="flex items-center gap-1 text-accent-amber text-[10px]">
                <AlertTriangle className="w-3 h-3" /> CLAMPED
              </span>
            ) : (
              <span className="flex items-center gap-1 text-accent-green text-[10px]">
                <CheckCircle className="w-3 h-3" /> REACHABLE
              </span>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-foreground-muted">Forward (Z):</span>
              <span className="text-foreground">{targets.footL[2].toFixed(2)} m</span>
            </div>
            <input
              type="range"
              min="-0.60"
              max="0.80"
              step="0.01"
              value={targets.footL[2]}
              onChange={(e) => updateFootL(2, parseFloat(e.target.value))}
              className="w-full accent-[#00E5FF]"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-foreground-muted">Lift (Y):</span>
              <span className="text-foreground">{targets.footL[1].toFixed(2)} m</span>
            </div>
            <input
              type="range"
              min="0.00"
              max="0.60"
              step="0.01"
              value={targets.footL[1]}
              onChange={(e) => updateFootL(1, parseFloat(e.target.value))}
              className="w-full accent-[#00E5FF]"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-foreground-muted">Spread (X):</span>
              <span className="text-foreground">{targets.footL[0].toFixed(2)} m</span>
            </div>
            <input
              type="range"
              min="-0.60"
              max="0.10"
              step="0.01"
              value={targets.footL[0]}
              onChange={(e) => updateFootL(0, parseFloat(e.target.value))}
              className="w-full accent-[#00E5FF]"
            />
          </div>
        </div>

        {/* Right Foot Controls */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-accent-cyan font-semibold text-[11px] border-b border-surface-border pb-1">
            <span>RIGHT FOOT (END-EFFECTOR)</span>
            {currentPose.legR.isClamped ? (
              <span className="flex items-center gap-1 text-accent-amber text-[10px]">
                <AlertTriangle className="w-3 h-3" /> CLAMPED
              </span>
            ) : (
              <span className="flex items-center gap-1 text-accent-green text-[10px]">
                <CheckCircle className="w-3 h-3" /> REACHABLE
              </span>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-foreground-muted">Forward (Z):</span>
              <span className="text-foreground">{targets.footR[2].toFixed(2)} m</span>
            </div>
            <input
              type="range"
              min="-0.60"
              max="0.80"
              step="0.01"
              value={targets.footR[2]}
              onChange={(e) => updateFootR(2, parseFloat(e.target.value))}
              className="w-full accent-[#00E5FF]"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-foreground-muted">Lift (Y):</span>
              <span className="text-foreground">{targets.footR[1].toFixed(2)} m</span>
            </div>
            <input
              type="range"
              min="0.00"
              max="0.60"
              step="0.01"
              value={targets.footR[1]}
              onChange={(e) => updateFootR(1, parseFloat(e.target.value))}
              className="w-full accent-[#00E5FF]"
            />
          </div>
        </div>

        {/* Diagnostics & IK Solver Readout */}
        <div className="p-2.5 rounded bg-[#0E1012] border border-surface-border text-[10px] space-y-1">
          <div className="text-foreground-muted uppercase font-bold">IK Solver Diagnostics</div>
          <div className="flex justify-between">
            <span className="text-foreground-muted">Knee Bend (L):</span>
            <span className="text-foreground">{((currentPose.legL.midAngleRad * 180) / Math.PI).toFixed(1)}°</span>
          </div>
          <div className="flex justify-between">
            <span className="text-foreground-muted">Knee Bend (R):</span>
            <span className="text-foreground">{((currentPose.legR.midAngleRad * 180) / Math.PI).toFixed(1)}°</span>
          </div>
          <div className="flex justify-between">
            <span className="text-foreground-muted">Target Dist (L):</span>
            <span className="text-foreground">{currentPose.legL.distance.toFixed(3)} m</span>
          </div>
          <div className="flex justify-between">
            <span className="text-foreground-muted">Target Dist (R):</span>
            <span className="text-foreground">{currentPose.legR.distance.toFixed(3)} m</span>
          </div>
        </div>
      </div>
    </div>
  );
}

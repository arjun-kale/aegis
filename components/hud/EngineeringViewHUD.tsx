'use client';

import React from 'react';
import { useMissionStore } from '@/lib/state/missionStore';
import { ROBOT_RIG } from '@/lib/robot/rig';
import { readTelemetry } from '@/lib/state/telemetryBus';
import { TELEMETRY_OFFSETS } from '@/lib/state/telemetryOffsets';
import { Layers, RotateCcw, ShieldCheck, Zap } from 'lucide-react';

interface EngineeringViewHUDProps {
  isOpen: boolean;
  onClose: () => void;
}

export function EngineeringViewHUD({ isOpen, onClose }: EngineeringViewHUDProps) {
  const disassemblyFactor = useMissionStore((state) => state.disassemblyFactor);
  const setDisassemblyFactor = useMissionStore((state) => state.setDisassemblyFactor);

  if (!isOpen) return null;

  const torques = readTelemetry(TELEMETRY_OFFSETS.TORQUES_START, 6);
  const kneeL = torques[1] || 0;
  const kneeR = torques[4] || 0;
  const hipL = torques[0] || 0;
  const hipR = torques[3] || 0;

  const subsystems = [
    {
      name: 'Main Chassis / Core',
      id: 'torso',
      rated: ROBOT_RIG.parts.torso.ratedTorqueNm,
      load: 0,
      temp: ROBOT_RIG.parts.torso.ratedTempC,
    },
    {
      name: 'LiDAR / Sensor Head',
      id: 'head',
      rated: ROBOT_RIG.parts.head.ratedTorqueNm,
      load: 0,
      temp: ROBOT_RIG.parts.head.ratedTempC,
    },
    {
      name: 'Knee (L) Planetary Drive',
      id: 'knee_l',
      rated: ROBOT_RIG.parts.knee_l.ratedTorqueNm,
      load: kneeL,
      temp: ROBOT_RIG.parts.knee_l.ratedTempC,
    },
    {
      name: 'Knee (R) Planetary Drive',
      id: 'knee_r',
      rated: ROBOT_RIG.parts.knee_r.ratedTorqueNm,
      load: kneeR,
      temp: ROBOT_RIG.parts.knee_r.ratedTempC,
    },
    {
      name: 'Hip (L) Actuator Complex',
      id: 'hip_l',
      rated: ROBOT_RIG.parts.hip_l.ratedTorqueNm,
      load: hipL,
      temp: ROBOT_RIG.parts.hip_l.ratedTempC,
    },
    {
      name: 'Hip (R) Actuator Complex',
      id: 'hip_r',
      rated: ROBOT_RIG.parts.hip_r.ratedTorqueNm,
      load: hipR,
      temp: ROBOT_RIG.parts.hip_r.ratedTempC,
    },
  ];

  return (
    <div
      className="fixed right-4 top-[100px] bottom-4 z-30 w-[400px] max-w-[calc(100vw-32px)] bg-[#1E2226] border border-[#262B30] text-[#E8E3DA] font-mono text-xs shadow-2xl select-none flex flex-col"
      role="region"
      aria-label="Exploded Engineering View Controller"
    >
      {/* Panel Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#262B30] bg-[#181B1E]">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-accent-teal" />
          <span className="font-semibold tracking-wider text-[11px]">
            EXPLODED ENGINEERING VIEW (§8)
          </span>
        </div>
        <button
          onClick={() => {
            setDisassemblyFactor(0);
            onClose();
          }}
          className="text-[#8E99A2] hover:text-[#E8E3DA] px-1 py-0.5 transition-colors"
          aria-label="Close Engineering View"
        >
          ✕
        </button>
      </div>

      <div className="p-3 space-y-3">
        {/* 1. Expansion Slider & Quick Presets */}
        <div>
          <div className="flex justify-between items-center mb-1 text-[11px]">
            <span className="text-[#8E99A2] uppercase tracking-wider">
              Disassembly Expansion Factor:
            </span>
            <span className="font-semibold tabular-nums text-accent-teal">
              {(disassemblyFactor * 100).toFixed(0)}%
            </span>
          </div>

          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={disassemblyFactor}
            onChange={(e) => setDisassemblyFactor(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-[#14171A] rounded-lg appearance-none cursor-pointer accent-accent-teal border border-[#262B30]"
          />

          {/* Quick Preset Buttons */}
          <div className="grid grid-cols-3 gap-2 mt-2">
            <button
              onClick={() => setDisassemblyFactor(0.0)}
              className={`py-1 rounded border text-[10px] font-semibold transition-colors ${
                disassemblyFactor === 0
                  ? 'bg-accent-teal/20 border-accent-teal text-accent-teal'
                  : 'bg-[#14171A] hover:bg-[#262B30] border-[#262B30] text-[#8E99A2]'
              }`}
            >
              0% ASSEMBLED
            </button>
            <button
              onClick={() => setDisassemblyFactor(0.5)}
              className={`py-1 rounded border text-[10px] font-semibold transition-colors ${
                disassemblyFactor === 0.5
                  ? 'bg-accent-teal/20 border-accent-teal text-accent-teal'
                  : 'bg-[#14171A] hover:bg-[#262B30] border-[#262B30] text-[#8E99A2]'
              }`}
            >
              50% EXPANDED
            </button>
            <button
              onClick={() => setDisassemblyFactor(1.0)}
              className={`py-1 rounded border text-[10px] font-semibold transition-colors ${
                disassemblyFactor === 1.0
                  ? 'bg-accent-teal/20 border-accent-teal text-accent-teal'
                  : 'bg-[#14171A] hover:bg-[#262B30] border-[#262B30] text-[#8E99A2]'
              }`}
            >
              100% FULL EXPLODE
            </button>
          </div>
        </div>

        {/* 2. Subsystem Stress & Thermal Inspect Table */}
        <div className="pt-2 border-t border-[#262B30]">
          <div className="text-[#8E99A2] text-[10px] uppercase mb-1.5 flex justify-between">
            <span>Subsystem Stress & Thermal Telemetry</span>
            <span className="text-accent-teal flex items-center gap-1">
              <Zap className="w-3 h-3" />
              LIVE TELEMETRY
            </span>
          </div>

          <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
            {subsystems.map((sub) => {
              const stressRatio = sub.load / sub.rated;
              const badgeClass =
                stressRatio >= 0.8
                  ? 'text-accent-red border-accent-red/40 bg-accent-red/10'
                  : stressRatio >= 0.5
                  ? 'text-accent-amber border-accent-amber/40 bg-accent-amber/10'
                  : 'text-accent-teal border-accent-teal/40 bg-accent-teal/10';

              return (
                <div
                  key={sub.id}
                  className="flex items-center justify-between p-1.5 bg-[#14171A] border border-[#262B30] rounded text-[10px]"
                >
                  <span className="font-semibold text-[#E8E3DA] truncate">{sub.name}</span>
                  <div className="flex items-center gap-2 tabular-nums">
                    <span className="text-[#8E99A2]">
                      {sub.load > 0 ? `${sub.load.toFixed(0)} N·m` : 'Nominal'} / {sub.rated} N·m
                    </span>
                    <span className={`px-1.5 py-0.5 rounded border font-semibold ${badgeClass}`}>
                      {sub.load > 0 ? `${(stressRatio * 100).toFixed(0)}%` : 'OK'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

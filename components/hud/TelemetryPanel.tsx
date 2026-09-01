'use client';

import React, { useState, useEffect } from 'react';
import { readTelemetrySingle, readTelemetry } from '@/lib/state/telemetryBus';
import { TELEMETRY_OFFSETS } from '@/lib/state/telemetryOffsets';
import { useMissionStore } from '@/lib/state/missionStore';

interface TelemetryPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TelemetryPanel({ isOpen, onClose }: TelemetryPanelProps) {
  const [telemetry, setTelemetry] = useState({
    posX: 0,
    posY: 0,
    posZ: 0,
    comX: 0,
    comY: 0,
    comZ: 0,
    stabilityMargin: 0.85,
    stanceState: 0,
    torqueHipL: 0,
    torqueKneeL: 0,
    torqueAnkleL: 0,
    torqueHipR: 0,
    torqueKneeR: 0,
    torqueAnkleR: 0,
  });

  const batterySoc = useMissionStore((state) => state.batterySoc);
  const thermalHeadroom = useMissionStore((state) => state.thermalHeadroom);
  const activeFaults = useMissionStore((state) => state.activeFaults);

  // Poll zero-allocation Telemetry Bus at 10Hz (§3.1, §6)
  useEffect(() => {
    if (!isOpen) return;

    const interval = setInterval(() => {
      const pos = readTelemetry(TELEMETRY_OFFSETS.POS_X, 3);
      const com = readTelemetry(TELEMETRY_OFFSETS.COM_X, 3);
      const margin = readTelemetrySingle(TELEMETRY_OFFSETS.STABILITY_MARGIN);
      const stance = Math.round(readTelemetrySingle(TELEMETRY_OFFSETS.STANCE_STATE));
      const torques = readTelemetry(TELEMETRY_OFFSETS.TORQUES_START, 6);

      setTelemetry({
        posX: pos[0],
        posY: pos[1],
        posZ: pos[2],
        comX: com[0],
        comY: com[1],
        comZ: com[2],
        stabilityMargin: Number.isFinite(margin) ? margin : 0,
        stanceState: stance,
        torqueHipL: torques[0] || 0,
        torqueKneeL: torques[1] || 0,
        torqueAnkleL: torques[2] || 0,
        torqueHipR: torques[3] || 0,
        torqueKneeR: torques[4] || 0,
        torqueAnkleR: torques[5] || 0,
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen) return null;

  const stanceNames = ['DOUBLE_SUPPORT', 'LEFT_STANCE', 'RIGHT_STANCE', 'FLIGHT'];
  const currentStance = stanceNames[telemetry.stanceState] || 'UNKNOWN';

  // Stability margin color classification (§7). Green = safe status,
  // kept distinct from the interactive/selection teal used in the header
  // and panel toggles — a repeated color should have exactly one job.
  const marginColor =
    telemetry.stabilityMargin >= 0.6
      ? 'text-accent-green'
      : telemetry.stabilityMargin >= 0.35
      ? 'text-accent-amber'
      : 'text-accent-red';

  const marginBgColor =
    telemetry.stabilityMargin >= 0.6
      ? 'bg-accent-green'
      : telemetry.stabilityMargin >= 0.35
      ? 'bg-accent-amber'
      : 'bg-accent-red';

  const maxTorqueRated = 220; // N·m rated peak threshold

  const joints = [
    { name: 'Knee (L)', val: telemetry.torqueKneeL },
    { name: 'Knee (R)', val: telemetry.torqueKneeR },
    { name: 'Hip (L)', val: telemetry.torqueHipL },
    { name: 'Hip (R)', val: telemetry.torqueHipR },
    { name: 'Ankle (L)', val: telemetry.torqueAnkleL },
    { name: 'Ankle (R)', val: telemetry.torqueAnkleR },
  ];

  return (
    <div
      className="fixed left-4 top-[100px] bottom-4 z-30 w-[360px] max-w-[calc(100vw-32px)] bg-[#1E2226] border border-[#262B30] text-[#E8E3DA] font-mono text-xs shadow-2xl flex flex-col"
      role="region"
      aria-label="Robot Live Telemetry"
    >
      {/* Panel Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#262B30] bg-[#181B1E]">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-accent-teal animate-pulse" />
          <span className="font-semibold tracking-wider text-[11px]">TELEMETRY BUS // 10HZ</span>
        </div>
        <button
          onClick={onClose}
          className="text-[#8E99A2] hover:text-[#E8E3DA] px-1 py-0.5 transition-colors"
          aria-label="Close Telemetry Panel"
        >
          ✕
        </button>
      </div>

      <div className="p-3 space-y-3 flex-1 overflow-y-auto">
        {/* 1. Static Stability Margin Meter (§1.3, §7) */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-[#8E99A2] text-[10px] uppercase tracking-wider">Stability Margin</span>
            <span className={`font-semibold tabular-nums text-sm ${marginColor}`}>
              {(telemetry.stabilityMargin * 100).toFixed(1)}%
            </span>
          </div>
          <div className="w-full bg-[#14171A] h-2 rounded overflow-hidden border border-[#262B30]">
            <div
              className={`h-full transition-all duration-100 ${marginBgColor}`}
              style={{
                width: `${Math.max(0, Math.min(100, telemetry.stabilityMargin * 100))}%`,
              }}
            />
          </div>
        </div>

        {/* 2. Stance State & Body Coordinates */}
        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#262B30]">
          <div>
            <div className="text-[#8E99A2] text-[10px] uppercase">Stance State</div>
            <div className="font-semibold text-[#E8E3DA] text-[11px] mt-0.5">{currentStance}</div>
          </div>
          <div>
            <div className="text-[#8E99A2] text-[10px] uppercase">Torso World (m)</div>
            <div className="tabular-nums text-[11px] mt-0.5">
              [{telemetry.posX.toFixed(1)}, {telemetry.posY.toFixed(1)}, {telemetry.posZ.toFixed(1)}]
            </div>
          </div>
        </div>

        {/* 3. Joint Torque Load Approach-To-Limit Meters (§1.5, §7) */}
        <div className="pt-1 border-t border-[#262B30]">
          <div className="text-[#8E99A2] text-[10px] uppercase mb-1.5 flex justify-between">
            <span>Joint Torque Loads (N·m)</span>
            <span className="text-[#5C646D]">Max: 220 N·m</span>
          </div>
          <div className="space-y-1.5">
            {joints.map((j) => {
              const pct = Math.min(100, (j.val / maxTorqueRated) * 100);
              const barColor =
                j.val >= 180
                  ? 'bg-accent-red'
                  : j.val >= 120
                  ? 'bg-accent-amber'
                  : 'bg-accent-green';

              return (
                <div key={j.name} className="flex items-center gap-2">
                  <span className="text-[10px] text-[#8E99A2] w-16 truncate">{j.name}</span>
                  <div className="flex-1 bg-[#14171A] h-1.5 rounded overflow-hidden border border-[#262B30]">
                    <div
                      className={`h-full transition-all duration-100 ${barColor}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="tabular-nums text-[10px] w-10 text-right">
                    {j.val.toFixed(0)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 4. Power & Thermal Health (§5) */}
        <div className="pt-1 border-t border-[#262B30] grid grid-cols-2 gap-2">
          <div>
            <div className="text-[#8E99A2] text-[10px] uppercase mb-1">Battery SoC</div>
            <div className="flex items-center gap-1.5">
              <div className="flex-1 bg-[#14171A] h-1.5 rounded overflow-hidden border border-[#262B30]">
                <div
                  className="bg-accent-green h-full"
                  style={{ width: `${batterySoc * 100}%` }}
                />
              </div>
              <span className="tabular-nums text-[11px]">{(batterySoc * 100).toFixed(0)}%</span>
            </div>
          </div>
          <div>
            <div className="text-[#8E99A2] text-[10px] uppercase mb-1">Thermal Margin</div>
            <div className="flex items-center gap-1.5">
              <div className="flex-1 bg-[#14171A] h-1.5 rounded overflow-hidden border border-[#262B30]">
                <div
                  className="bg-accent-green h-full"
                  style={{ width: `${thermalHeadroom * 100}%` }}
                />
              </div>
              <span className="tabular-nums text-[11px]">{(thermalHeadroom * 100).toFixed(0)}%</span>
            </div>
          </div>
        </div>

        {/* 5. Active Faults List */}
        {activeFaults.length > 0 && (
          <div className="pt-1 border-t border-[#262B30]">
            <div className="text-accent-red text-[10px] uppercase font-semibold mb-1 flex items-center gap-1">
              <span>⚠ ACTIVE ALERTS ({activeFaults.length})</span>
            </div>
            <ul className="text-[10px] text-[#E8E3DA] space-y-0.5 list-disc list-inside">
              {activeFaults.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

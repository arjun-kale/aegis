'use client';

import React, { useState } from 'react';
import { useMissionStore } from '@/lib/state/missionStore';
import {
  ShieldCheck,
  ShieldAlert,
  Check,
  X,
  Footprints,
  Clock,
  Navigation,
  Lock,
  Unlock,
  AlertTriangle,
  Play,
  RotateCcw,
} from 'lucide-react';

interface AuthorityGateHUDProps {
  onAbortExecution?: () => void;
}

const COMMON_REJECTION_REASONS = [
  'Clearance too tight near wall collider',
  'Predicted stability margin below safety threshold',
  'Gait profile inappropriate for incline grade',
  'Route traverses unverified sector',
];

export function AuthorityGateHUD({ onAbortExecution }: AuthorityGateHUDProps) {
  const stagedProposal = useMissionStore((state) => state.stagedProposal);
  const approvalStatus = useMissionStore((state) => state.approvalStatus);
  const rejectionReason = useMissionStore((state) => state.rejectionReason);
  const autonomyMode = useMissionStore((state) => state.autonomyMode);
  const safetyThreshold = useMissionStore((state) => state.safetyThreshold);

  const approveProposal = useMissionStore((state) => state.approveProposal);
  const rejectProposal = useMissionStore((state) => state.rejectProposal);
  const clearProposal = useMissionStore((state) => state.clearProposal);
  const setAutonomyMode = useMissionStore((state) => state.setAutonomyMode);

  const [isRejectOpen, setIsRejectOpen] = useState<boolean>(false);
  const [customReason, setCustomReason] = useState<string>(COMMON_REJECTION_REASONS[0]);

  if (!stagedProposal && approvalStatus === 'IDLE') {
    // Show compact Autonomy Policy pill at top
    return (
      <div className="absolute top-14 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-3 py-1 rounded-full bg-surface/90 backdrop-blur-md border border-surface-border text-xs font-mono select-none">
        <button
          onClick={() =>
            setAutonomyMode(
              autonomyMode === 'MANUAL_APPROVAL' ? 'AUTO_APPROVE_SAFE' : 'MANUAL_APPROVAL'
            )
          }
          className="flex items-center gap-1.5 hover:text-accent-cyan transition-colors"
        >
          {autonomyMode === 'MANUAL_APPROVAL' ? (
            <>
              <Lock className="w-3.5 h-3.5 text-accent-amber" />
              <span className="text-foreground-muted">GATE:</span>
              <span className="font-bold text-accent-amber">MANUAL_APPROVAL</span>
            </>
          ) : (
            <>
              <Unlock className="w-3.5 h-3.5 text-accent-green" />
              <span className="text-foreground-muted">GATE:</span>
              <span className="font-bold text-accent-green">AUTO_SAFE (&gt;{safetyThreshold})</span>
            </>
          )}
        </button>
      </div>
    );
  }

  const margin = stagedProposal?.predictedMinMargin ?? 0.5;
  const marginColor =
    margin >= 0.6
      ? 'text-accent-green'
      : margin >= 0.4
      ? 'text-accent-amber'
      : 'text-accent-red';

  const marginBgColor =
    margin >= 0.6
      ? 'bg-accent-green'
      : margin >= 0.4
      ? 'bg-accent-amber'
      : 'bg-accent-red';

  return (
    <div className="absolute top-14 left-1/2 -translate-x-1/2 z-30 w-[540px] max-w-[calc(100vw-32px)] bg-surface/95 backdrop-blur-md border-2 border-accent-cyan/60 rounded-lg shadow-2xl overflow-hidden font-mono text-xs select-none animate-in fade-in slide-in-from-top-2 duration-150">
      {/* Top Banner Bar */}
      <div className="flex items-center justify-between px-3.5 py-2 bg-surface-raised border-b border-surface-border">
        <div className="flex items-center gap-2">
          {approvalStatus === 'PENDING_APPROVAL' ? (
            <ShieldAlert className="w-4 h-4 text-accent-amber animate-pulse" />
          ) : approvalStatus === 'APPROVED' ? (
            <ShieldCheck className="w-4 h-4 text-accent-green" />
          ) : approvalStatus === 'EXECUTING' ? (
            <Play className="w-4 h-4 text-accent-cyan animate-pulse" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-accent-red" />
          )}
          <span className="font-bold text-foreground tracking-wider text-[11px]">
            HUMAN AUTHORITY GATE (§3.3)
          </span>
          <span
            className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
              approvalStatus === 'PENDING_APPROVAL'
                ? 'bg-accent-amber/20 text-accent-amber border border-accent-amber/40'
                : approvalStatus === 'APPROVED'
                ? 'bg-accent-green/20 text-accent-green border border-accent-green/40'
                : approvalStatus === 'EXECUTING'
                ? 'bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/40'
                : 'bg-accent-red/20 text-accent-red border border-accent-red/40'
            }`}
          >
            {approvalStatus}
          </span>
        </div>

        {/* Clear Proposal Button */}
        {approvalStatus !== 'EXECUTING' && (
          <button
            onClick={clearProposal}
            className="text-foreground-muted hover:text-foreground text-[10px] p-1 rounded hover:bg-surface-border"
          >
            DISMISS
          </button>
        )}
      </div>

      {/* Staged Proposal Details */}
      {stagedProposal && (
        <div className="p-3.5 space-y-3">
          <div className="grid grid-cols-3 gap-2 text-[10px]">
            {/* Target Destination */}
            <div className="p-2 rounded bg-[#0E1012] border border-surface-border">
              <div className="text-foreground-muted flex items-center gap-1">
                <Navigation className="w-3 h-3 text-accent-cyan" />
                <span>TARGET COORDS:</span>
              </div>
              <div className="text-foreground font-bold mt-0.5">
                [{stagedProposal.targetWaypoint.x}, {stagedProposal.targetWaypoint.y},{' '}
                {stagedProposal.targetWaypoint.z}]
              </div>
            </div>

            {/* Gait Profile */}
            <div className="p-2 rounded bg-[#0E1012] border border-surface-border">
              <div className="text-foreground-muted flex items-center gap-1">
                <Footprints className="w-3 h-3 text-accent-teal" />
                <span>GAIT PROFILE:</span>
              </div>
              <div className="text-accent-cyan font-bold mt-0.5 truncate">
                {stagedProposal.gaitProfile}
              </div>
            </div>

            {/* Est. Duration & Waypoints */}
            <div className="p-2 rounded bg-[#0E1012] border border-surface-border">
              <div className="text-foreground-muted flex items-center gap-1">
                <Clock className="w-3 h-3 text-accent-amber" />
                <span>TRAJECTORY:</span>
              </div>
              <div className="text-foreground font-bold mt-0.5">
                {stagedProposal.waypoints.length} pts • {stagedProposal.estimatedDurationSec}s
              </div>
            </div>
          </div>

          {/* Predicted Stability Margin Gauge */}
          <div className="p-2.5 rounded bg-surface-muted border border-surface-border space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-foreground-muted font-semibold">
                PREDICTED MIN STABILITY MARGIN (§1.3):
              </span>
              <span className={`font-bold ${marginColor}`}>{margin.toFixed(2)}</span>
            </div>
            <div className="w-full h-1.5 rounded bg-[#0E1012] overflow-hidden">
              <div
                className={`h-full ${marginBgColor} transition-all duration-150`}
                style={{ width: `${Math.max(0, Math.min(100, margin * 100))}%` }}
              />
            </div>
          </div>

          {/* Action Decision Area */}
          {approvalStatus === 'PENDING_APPROVAL' && (
            <div className="space-y-2 pt-1">
              {!isRejectOpen ? (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={approveProposal}
                    className="flex items-center justify-center gap-2 py-2.5 px-4 rounded bg-accent-green hover:bg-accent-green/80 text-background font-bold transition-colors"
                  >
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>APPROVE PROPOSAL</span>
                  </button>

                  <button
                    onClick={() => setIsRejectOpen(true)}
                    className="flex items-center justify-center gap-2 py-2.5 px-4 rounded bg-accent-red hover:bg-accent-red/80 text-foreground font-bold transition-colors"
                  >
                    <X className="w-4 h-4 stroke-[3]" />
                    <span>REJECT WITH REASON...</span>
                  </button>
                </div>
              ) : (
                <div className="p-2.5 rounded bg-[#0E1012] border border-accent-red space-y-2">
                  <div className="text-accent-red font-bold text-[11px] flex items-center justify-between">
                    <span>SPECIFY REJECTION REASON:</span>
                    <button
                      onClick={() => setIsRejectOpen(false)}
                      className="text-foreground-muted hover:text-foreground text-[10px]"
                    >
                      CANCEL
                    </button>
                  </div>

                  <select
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    className="w-full p-1.5 bg-surface border border-surface-border rounded text-foreground text-xs focus:outline-none focus:border-accent-red"
                  >
                    {COMMON_REJECTION_REASONS.map((r, i) => (
                      <option key={i} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>

                  <input
                    type="text"
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    placeholder="Or type custom rejection reason..."
                    className="w-full p-1.5 bg-surface border border-surface-border rounded text-foreground text-xs focus:outline-none focus:border-accent-red"
                  />

                  <button
                    onClick={() => {
                      rejectProposal(customReason);
                      setIsRejectOpen(false);
                    }}
                    className="w-full py-2 rounded bg-accent-red hover:bg-accent-red/80 text-foreground font-bold text-xs"
                  >
                    CONFIRM REJECTION & TRANSMIT TO AGENT
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Approved Banner */}
          {approvalStatus === 'APPROVED' && (
            <div className="p-2.5 rounded bg-accent-green/10 border border-accent-green text-accent-green flex items-center justify-between text-[11px]">
              <span className="font-bold flex items-center gap-1.5">
                <Check className="w-4 h-4" />
                AUTHORIZED FOR EXECUTION
              </span>
              <span className="text-foreground-muted text-[10px]">
                Awaiting execute_staged_proposal tool call...
              </span>
            </div>
          )}

          {/* Rejected Feedback Banner */}
          {approvalStatus === 'REJECTED' && (
            <div className="p-2.5 rounded bg-accent-red/10 border border-accent-red text-accent-red space-y-1 text-[11px]">
              <div className="font-bold flex items-center gap-1.5">
                <X className="w-4 h-4" />
                PROPOSAL REJECTED BY HUMAN OPERATOR
              </div>
              <div className="text-foreground text-[10px]">Reason: &quot;{rejectionReason}&quot;</div>
            </div>
          )}

          {/* Executing Status Banner */}
          {approvalStatus === 'EXECUTING' && (
            <div className="p-2.5 rounded bg-accent-cyan/10 border border-accent-cyan flex items-center justify-between">
              <div className="flex items-center gap-2 text-accent-cyan font-bold text-[11px]">
                <div className="w-2 h-2 rounded-full bg-accent-cyan animate-ping" />
                <span>ROBOT EXECUTING STAGED TRAJECTORY...</span>
              </div>
              {onAbortExecution && (
                <button
                  onClick={onAbortExecution}
                  className="px-2 py-0.5 rounded bg-accent-red hover:bg-accent-red/80 text-foreground text-[10px] font-bold"
                >
                  EMERGENCY STOP
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

'use client';

import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';

interface AuthorityGateHUDProps {
  onAbortExecution?: () => void;
}

const COMMON_REJECTION_REASONS = [
  'Route clearance too tight near north corridor wall',
  'Predicted stability margin below safety threshold',
  'Gait profile inappropriate for incline grade',
  'Route crosses unverified or occluded sector',
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

  // Keyboard shortcut listener (§6, §7): [A] / [Enter] -> Approve, [R] -> Reject modal, [Esc] -> Dismiss/Cancel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept when user is typing in an input/textarea/select
      if (
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement ||
        document.activeElement instanceof HTMLSelectElement
      ) {
        if (e.key === 'Escape') {
          setIsRejectOpen(false);
        }
        return;
      }

      if (stagedProposal && approvalStatus === 'PENDING_APPROVAL') {
        if (e.key === 'a' || e.key === 'A' || e.key === 'Enter') {
          e.preventDefault();
          approveProposal();
        } else if (e.key === 'r' || e.key === 'R') {
          e.preventDefault();
          setIsRejectOpen(true);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          if (isRejectOpen) {
            setIsRejectOpen(false);
          } else {
            clearProposal();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [stagedProposal, approvalStatus, isRejectOpen, approveProposal, clearProposal]);

  if (!stagedProposal && approvalStatus === 'IDLE') {
    // Compact Autonomy Policy Pill
    return (
      <div className="absolute top-14 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-3 py-1 bg-[#1E2226] border border-[#262B30] text-xs font-mono select-none shadow-md">
        <button
          onClick={() =>
            setAutonomyMode(
              autonomyMode === 'MANUAL_APPROVAL' ? 'AUTO_APPROVE_SAFE' : 'MANUAL_APPROVAL'
            )
          }
          className="flex items-center gap-1.5 hover:text-accent-teal transition-colors"
          aria-label="Toggle Autonomy Gate Policy"
        >
          {autonomyMode === 'MANUAL_APPROVAL' ? (
            <>
              <Lock className="w-3.5 h-3.5 text-accent-amber" />
              <span className="text-[#8E99A2]">GATE:</span>
              <span className="font-semibold text-accent-amber">MANUAL_APPROVAL</span>
            </>
          ) : (
            <>
              <Unlock className="w-3.5 h-3.5 text-accent-teal" />
              <span className="text-[#8E99A2]">GATE:</span>
              <span className="font-semibold text-accent-teal">AUTO_SAFE (&gt;{safetyThreshold})</span>
            </>
          )}
        </button>
      </div>
    );
  }

  const margin = stagedProposal?.predictedMinMargin ?? 0.5;
  const marginColor =
    margin >= 0.6
      ? 'text-accent-teal'
      : margin >= 0.35
      ? 'text-accent-amber'
      : 'text-accent-red';

  const marginBgColor =
    margin >= 0.6
      ? 'bg-accent-teal'
      : margin >= 0.35
      ? 'bg-accent-amber'
      : 'bg-accent-red';

  return (
    <div
      className="absolute top-14 left-1/2 -translate-x-1/2 z-30 w-[540px] max-w-[calc(100vw-32px)] bg-[#1E2226] border border-[#262B30] shadow-2xl font-mono text-xs select-none"
      role="dialog"
      aria-label="Human Authority Gate"
    >
      {/* Top Banner Bar */}
      <div className="flex items-center justify-between px-3.5 py-2 bg-[#181B1E] border-b border-[#262B30]">
        <div className="flex items-center gap-2">
          {approvalStatus === 'PENDING_APPROVAL' ? (
            <ShieldAlert className="w-4 h-4 text-accent-amber animate-pulse" />
          ) : approvalStatus === 'APPROVED' ? (
            <ShieldCheck className="w-4 h-4 text-accent-teal" />
          ) : approvalStatus === 'EXECUTING' ? (
            <Play className="w-4 h-4 text-accent-teal" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-accent-red" />
          )}
          <span className="font-semibold text-[#E8E3DA] tracking-wider text-[11px]">
            HUMAN AUTHORITY GATE (§3.3)
          </span>
          <span
            className={`px-1.5 py-0.5 text-[10px] font-semibold border ${
              approvalStatus === 'PENDING_APPROVAL'
                ? 'bg-accent-amber/20 text-accent-amber border-accent-amber/40'
                : approvalStatus === 'APPROVED'
                ? 'bg-accent-teal/20 text-accent-teal border-accent-teal/40'
                : approvalStatus === 'EXECUTING'
                ? 'bg-accent-teal/20 text-accent-teal border-accent-teal/40'
                : 'bg-accent-red/20 text-accent-red border-accent-red/40'
            }`}
          >
            {approvalStatus}
          </span>
        </div>

        {/* Clear Proposal Button */}
        {approvalStatus !== 'EXECUTING' && (
          <button
            onClick={clearProposal}
            className="text-[#8E99A2] hover:text-[#E8E3DA] text-[10px] px-2 py-0.5 border border-[#262B30] hover:border-[#3E7C79] transition-colors"
          >
            DISMISS [ESC]
          </button>
        )}
      </div>

      {/* Staged Proposal Details */}
      {stagedProposal && (
        <div className="p-3.5 space-y-3">
          <div className="grid grid-cols-3 gap-2 text-[10px]">
            {/* Target Destination */}
            <div className="p-2 bg-[#14171A] border border-[#262B30]">
              <div className="text-[#8E99A2] flex items-center gap-1">
                <Navigation className="w-3 h-3 text-accent-teal" />
                <span>TARGET:</span>
              </div>
              <div className="text-[#E8E3DA] font-semibold mt-0.5 tabular-nums">
                [{stagedProposal.targetWaypoint.x}, {stagedProposal.targetWaypoint.y},{' '}
                {stagedProposal.targetWaypoint.z}]
              </div>
            </div>

            {/* Gait Profile */}
            <div className="p-2 bg-[#14171A] border border-[#262B30]">
              <div className="text-[#8E99A2] flex items-center gap-1">
                <Footprints className="w-3 h-3 text-accent-teal" />
                <span>GAIT:</span>
              </div>
              <div className="text-accent-teal font-semibold mt-0.5 truncate">
                {stagedProposal.gaitProfile}
              </div>
            </div>

            {/* Est. Duration & Waypoints */}
            <div className="p-2 bg-[#14171A] border border-[#262B30]">
              <div className="text-[#8E99A2] flex items-center gap-1">
                <Clock className="w-3 h-3 text-accent-amber" />
                <span>TRAJECTORY:</span>
              </div>
              <div className="text-[#E8E3DA] font-semibold mt-0.5 tabular-nums">
                {stagedProposal.waypoints.length} pts • {stagedProposal.estimatedDurationSec}s
              </div>
            </div>
          </div>

          {/* Predicted Stability Margin Gauge */}
          <div className="p-2.5 bg-[#14171A] border border-[#262B30] space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-[#8E99A2] font-semibold uppercase tracking-wider">
                Predicted Min Stability Margin (§1.3):
              </span>
              <span className={`font-semibold tabular-nums ${marginColor}`}>
                {(margin * 100).toFixed(0)}%
              </span>
            </div>
            <div className="w-full h-2 bg-[#181B1E] border border-[#262B30] overflow-hidden">
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
                    className="flex items-center justify-center gap-2 py-2 px-4 bg-accent-teal hover:bg-accent-teal/80 text-[#14171A] font-bold transition-colors focus:ring-1 focus:ring-accent-teal"
                    aria-label="Approve Route"
                  >
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>APPROVE ROUTE [A]</span>
                  </button>

                  <button
                    onClick={() => setIsRejectOpen(true)}
                    className="flex items-center justify-center gap-2 py-2 px-4 bg-accent-red hover:bg-accent-red/80 text-[#E8E3DA] font-bold transition-colors focus:ring-1 focus:ring-accent-red"
                    aria-label="Reject Plan With Reason"
                  >
                    <X className="w-4 h-4 stroke-[3]" />
                    <span>REJECT PLAN [R]</span>
                  </button>
                </div>
              ) : (
                <div className="p-3 bg-[#14171A] border border-accent-red space-y-2.5">
                  <div className="text-accent-red font-semibold text-[11px] flex items-center justify-between">
                    <span>OPERATOR REJECTION FEEDBACK:</span>
                    <button
                      onClick={() => setIsRejectOpen(false)}
                      className="text-[#8E99A2] hover:text-[#E8E3DA] text-[10px]"
                    >
                      CANCEL [ESC]
                    </button>
                  </div>

                  <select
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    className="w-full p-1.5 bg-[#181B1E] border border-[#262B30] text-[#E8E3DA] text-xs focus:outline-none focus:border-accent-teal"
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
                    placeholder="Type custom operator reason..."
                    className="w-full p-1.5 bg-[#181B1E] border border-[#262B30] text-[#E8E3DA] text-xs focus:outline-none focus:border-accent-teal"
                  />

                  <button
                    onClick={() => {
                      rejectProposal(customReason);
                      setIsRejectOpen(false);
                    }}
                    className="w-full py-2 bg-accent-red hover:bg-accent-red/80 text-[#E8E3DA] font-bold text-xs"
                  >
                    CONFIRM REJECTION & TRANSMIT TO AGENT
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Authorized Banner */}
          {approvalStatus === 'APPROVED' && (
            <div className="p-2.5 bg-accent-teal/10 border border-accent-teal text-accent-teal flex items-center justify-between text-[11px]">
              <span className="font-semibold flex items-center gap-1.5">
                <Check className="w-4 h-4" />
                ROUTE AUTHORIZED FOR EXECUTION
              </span>
              <span className="text-[#8E99A2] text-[10px]">
                Awaiting execute_staged_proposal invocation...
              </span>
            </div>
          )}

          {/* Rejected Feedback Banner */}
          {approvalStatus === 'REJECTED' && (
            <div className="p-2.5 bg-accent-red/10 border border-accent-red text-accent-red space-y-1 text-[11px]">
              <div className="font-semibold flex items-center gap-1.5">
                <X className="w-4 h-4" />
                PROPOSAL REJECTED BY OPERATOR
              </div>
              <div className="text-[#E8E3DA] text-[10px]">Reason: &quot;{rejectionReason}&quot;</div>
            </div>
          )}

          {/* Executing Status Banner */}
          {approvalStatus === 'EXECUTING' && (
            <div className="p-2.5 bg-accent-teal/10 border border-accent-teal flex items-center justify-between">
              <div className="flex items-center gap-2 text-accent-teal font-semibold text-[11px]">
                <div className="w-2 h-2 rounded-full bg-accent-teal animate-pulse" />
                <span>ROBOT EXECUTING STAGED TRAJECTORY...</span>
              </div>
              {onAbortExecution && (
                <button
                  onClick={onAbortExecution}
                  className="px-2 py-0.5 bg-accent-red hover:bg-accent-red/80 text-[#E8E3DA] text-[10px] font-bold"
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

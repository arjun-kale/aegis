'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useMissionStore } from '@/lib/state/missionStore';
import {
  ShieldCheck,
  ShieldAlert,
  Check,
  X,
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

/**
 * Human Authority Gate (§3.3) — Pass 1 layout redesign.
 *
 * Previously a floating, variable-height pill/card centered independently
 * of the header. Now a fixed-height (h-14) full-width bar directly under
 * the header, in normal document flow — the single most safety-critical
 * surface in the product (nothing moves without this) now occupies a
 * constant, unmistakable position regardless of state, instead of growing
 * and shifting. The reject-reason form is a popover that doesn't change
 * the bar's height.
 */
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
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close the reject popover on outside click.
  useEffect(() => {
    if (!isRejectOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsRejectOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClick);
    return () => window.removeEventListener('mousedown', handleClick);
  }, [isRejectOpen]);

  // Keyboard shortcut listener (§6, §7): [A] / [Enter] -> Approve, [R] -> Reject popover, [Esc] -> Dismiss/Cancel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement ||
        document.activeElement instanceof HTMLSelectElement
      ) {
        if (e.key === 'Escape') setIsRejectOpen(false);
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
          if (isRejectOpen) setIsRejectOpen(false);
          else clearProposal();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [stagedProposal, approvalStatus, isRejectOpen, approveProposal, clearProposal]);

  // Green = safe status; kept distinct from the interactive/selection teal
  // used for the autonomy toggle and Approve button below (§7.3 — a
  // repeated color needs exactly one job).
  const margin = stagedProposal?.predictedMinMargin ?? 0;
  const marginColor =
    margin >= 0.6 ? 'text-accent-green' : margin >= 0.35 ? 'text-accent-amber' : 'text-accent-red';
  const marginBarColor =
    margin >= 0.6 ? 'bg-accent-green' : margin >= 0.35 ? 'bg-accent-amber' : 'bg-accent-red';

  const statusBadge =
    approvalStatus === 'PENDING_APPROVAL'
      ? { icon: ShieldAlert, cls: 'text-accent-amber', bg: 'bg-accent-amber/15 border-accent-amber/40' }
      : approvalStatus === 'APPROVED'
      ? { icon: ShieldCheck, cls: 'text-accent-green', bg: 'bg-accent-green/15 border-accent-green/40' }
      : approvalStatus === 'EXECUTING'
      ? { icon: Play, cls: 'text-accent-green', bg: 'bg-accent-green/15 border-accent-green/40' }
      : approvalStatus === 'REJECTED'
      ? { icon: AlertTriangle, cls: 'text-accent-red', bg: 'bg-accent-red/15 border-accent-red/40' }
      : null;

  return (
    <div
      className="relative w-full h-14 shrink-0 z-40 flex items-center gap-4 px-4 bg-[#1E2226] border-b border-[#262B30] font-mono text-xs select-none"
      role="region"
      aria-label="Human Authority Gate"
    >
      {!stagedProposal || approvalStatus === 'IDLE' ? (
        // Idle state — same bar, same height, autonomy policy control only.
        <button
          onClick={() =>
            setAutonomyMode(autonomyMode === 'MANUAL_APPROVAL' ? 'AUTO_APPROVE_SAFE' : 'MANUAL_APPROVAL')
          }
          className="flex items-center gap-2 hover:text-accent-teal transition-colors"
          aria-label="Toggle Autonomy Gate Policy"
        >
          {autonomyMode === 'MANUAL_APPROVAL' ? (
            <>
              <Lock className="w-3.5 h-3.5 text-accent-amber" />
              <span className="text-[#8E99A2]">AUTHORITY GATE:</span>
              <span className="font-semibold text-accent-amber">MANUAL_APPROVAL</span>
            </>
          ) : (
            <>
              <Unlock className="w-3.5 h-3.5 text-accent-teal" />
              <span className="text-[#8E99A2]">AUTHORITY GATE:</span>
              <span className="font-semibold text-accent-teal">
                AUTO_SAFE (&gt;{safetyThreshold})
              </span>
            </>
          )}
          <span className="text-[#5C646D] text-[10px]">— no motion commits without this</span>
        </button>
      ) : (
        <>
          {/* Status badge */}
          {statusBadge && (
            <div
              className={`flex items-center gap-1.5 px-2 py-1 border shrink-0 ${statusBadge.bg}`}
            >
              <statusBadge.icon className={`w-3.5 h-3.5 ${statusBadge.cls} ${approvalStatus === 'PENDING_APPROVAL' ? 'animate-pulse' : ''}`} />
              <span className={`font-semibold text-[11px] ${statusBadge.cls}`}>{approvalStatus}</span>
            </div>
          )}

          {/* Route summary — single-line, compact */}
          <div className="flex items-center gap-3 text-[11px] text-[#8E99A2] truncate min-w-0">
            <span className="text-[#E8E3DA] tabular-nums truncate">
              [{stagedProposal.targetWaypoint.x}, {stagedProposal.targetWaypoint.y}, {stagedProposal.targetWaypoint.z}]
            </span>
            <span className="text-accent-teal font-semibold shrink-0">{stagedProposal.gaitProfile}</span>
            <span className="tabular-nums shrink-0">
              {stagedProposal.waypoints.length}pts · {stagedProposal.estimatedDurationSec}s
            </span>
          </div>

          {/* Margin gauge — compact horizontal */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-20 h-1.5 bg-[#14171A] border border-[#262B30] overflow-hidden">
              <div
                className={`h-full ${marginBarColor}`}
                style={{ width: `${Math.max(0, Math.min(100, margin * 100))}%` }}
              />
            </div>
            <span className={`font-semibold tabular-nums text-sm ${marginColor}`}>
              {(margin * 100).toFixed(0)}%
            </span>
          </div>

          <div className="flex-1" />

          {/* Right-side actions, state-dependent */}
          {approvalStatus === 'PENDING_APPROVAL' && (
            <div className="flex items-center gap-2 shrink-0 relative">
              <button
                onClick={approveProposal}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-teal hover:bg-accent-teal/80 text-[#14171A] font-bold transition-colors focus:ring-1 focus:ring-accent-teal"
                aria-label="Approve Route"
              >
                <Check className="w-3.5 h-3.5 stroke-[3]" />
                <span>APPROVE [A]</span>
              </button>
              <button
                onClick={() => setIsRejectOpen((v) => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-red hover:bg-accent-red/80 text-[#E8E3DA] font-bold transition-colors focus:ring-1 focus:ring-accent-red"
                aria-label="Reject Plan With Reason"
                aria-expanded={isRejectOpen}
              >
                <X className="w-3.5 h-3.5 stroke-[3]" />
                <span>REJECT [R]</span>
              </button>

              {isRejectOpen && (
                <div
                  ref={popoverRef}
                  className="absolute top-full right-0 mt-2 w-80 p-3 bg-[#14171A] border border-accent-red shadow-2xl space-y-2.5 z-50"
                  role="dialog"
                  aria-label="Operator Rejection Feedback"
                >
                  <div className="text-accent-red font-semibold text-[11px]">
                    OPERATOR REJECTION FEEDBACK
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

          {approvalStatus === 'APPROVED' && (
            <div className="text-accent-green text-[11px] font-semibold shrink-0">
              AUTHORIZED — awaiting execute_staged_proposal
            </div>
          )}

          {approvalStatus === 'REJECTED' && (
            <div className="text-[11px] text-[#E8E3DA] truncate max-w-[280px] shrink-0" title={rejectionReason ?? ''}>
              Reason: &quot;{rejectionReason}&quot;
            </div>
          )}

          {approvalStatus === 'EXECUTING' && onAbortExecution && (
            <button
              onClick={onAbortExecution}
              className="px-3 py-1.5 bg-accent-red hover:bg-accent-red/80 text-[#E8E3DA] text-[11px] font-bold shrink-0"
            >
              EMERGENCY STOP
            </button>
          )}

          {approvalStatus !== 'EXECUTING' && (
            <button
              onClick={clearProposal}
              className="text-[#8E99A2] hover:text-[#E8E3DA] text-[10px] px-2 py-1 border border-[#262B30] hover:border-[#3E7C79] transition-colors shrink-0"
            >
              DISMISS [ESC]
            </button>
          )}
        </>
      )}
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import { useMissionStore, MissionLogEntry } from '@/lib/state/missionStore';

interface ToolCallLogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ToolCallLog({ isOpen, onClose }: ToolCallLogProps) {
  const missionLog = useMissionStore((state) => state.missionLog);
  const clearMissionLog = useMissionStore((state) => state.clearMissionLog);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  if (!isOpen) return null;

  const toggleExpand = (idx: number) => {
    setExpandedIndex((prev) => (prev === idx ? null : idx));
  };

  return (
    <div
      className="fixed right-4 top-[100px] bottom-4 z-30 w-[400px] max-w-[calc(100vw-32px)] bg-[#FFFFFF] border border-[#DDE1E6] text-[#1B1F24] font-mono text-xs shadow-2xl flex flex-col"
      role="region"
      aria-label="WebMCP Tool Execution Stream"
    >
      {/* Panel Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#DDE1E6] bg-[#EEF0F3]">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-accent-teal" />
          <span className="font-semibold tracking-wider text-[11px]">WEBMCP TOOL STREAM</span>
          <span className="text-[10px] text-[#5B6470] tabular-nums">({missionLog.length})</span>
        </div>
        <div className="flex items-center gap-2">
          {missionLog.length > 0 && (
            <button
              onClick={clearMissionLog}
              className="text-[10px] text-[#5B6470] hover:text-[#1B1F24] px-1.5 py-0.5 border border-[#DDE1E6] rounded hover:border-[#3E7C79] transition-colors"
            >
              Clear
            </button>
          )}
          <button
            onClick={onClose}
            className="text-[#5B6470] hover:text-[#1B1F24] px-1 py-0.5 transition-colors"
            aria-label="Close Tool Log"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Log Feed */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {missionLog.length === 0 ? (
          <div className="text-center py-8 text-[#6B7280] text-[11px]">
            No WebMCP tools invoked yet.
            <div className="text-[10px] mt-1 text-[#5B6470]">
              Trigger actions via WebMCP agent, Fallback Console, or HUD controls.
            </div>
          </div>
        ) : (
          missionLog.map((entry: MissionLogEntry, idx: number) => {
            const isExpanded = expandedIndex === idx;
            const timeStr = new Date(entry.timestamp).toLocaleTimeString();

            // Status color classification
            let statusBadge = 'bg-[#DDE1E6] text-[#5B6470]';
            if (entry.status === 'OK') {
              statusBadge = 'bg-accent-green/20 text-accent-green border border-accent-green/40';
            } else if (entry.status === 'INFO') {
              statusBadge = 'bg-accent-amber/20 text-accent-amber border border-accent-amber/40';
            } else {
              statusBadge = 'bg-[#F1F2F5] text-accent-redText border border-accent-red';
            }

            return (
              <div
                key={entry.id}
                className="bg-[#F1F2F5] border border-[#DDE1E6] rounded p-2 text-[11px] transition-colors hover:border-[#C7CCD3]"
              >
                <div
                  className="flex items-center justify-between cursor-pointer select-none"
                  onClick={() => toggleExpand(idx)}
                >
                  <div className="flex items-center gap-2 truncate pr-2">
                    <span className="text-[#5B6470] text-[10px] tabular-nums">{timeStr}</span>
                    <span className="font-semibold text-[#1B1F24] truncate">{entry.title}</span>
                  </div>
                  {entry.status && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold shrink-0 ${statusBadge}`}>
                      {entry.status}
                    </span>
                  )}
                </div>

                {/* Inline summary / detail */}
                {entry.detail && (
                  <div className="text-[10px] text-[#5B6470] mt-1 truncate">
                    {entry.detail}
                  </div>
                )}

                {/* Expanded Details Drawer */}
                {isExpanded && entry.payload && (
                  <div className="mt-2 pt-2 border-t border-[#DDE1E6] space-y-1.5 text-[10px]">
                    <div className="text-[#5B6470] uppercase tracking-wider text-[9px] mb-0.5">
                      Payload:
                    </div>
                    <pre className="p-1.5 bg-[#EEF0F3] rounded border border-[#DDE1E6] overflow-x-auto text-accent-tealText">
                      {JSON.stringify(entry.payload, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

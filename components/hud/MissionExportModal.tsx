'use client';

import React, { useState, useMemo } from 'react';
import { useMissionStore } from '@/lib/state/missionStore';
import {
  buildMissionPlanExport,
  validateMissionPlan,
  downloadMissionPlanJSON,
  AegisMissionPlanV1,
} from '@/lib/world/missionExport';
import { Download, Upload, Copy, Check, Play, FileJson, AlertCircle } from 'lucide-react';

interface MissionExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReplayPlan?: (plan: AegisMissionPlanV1) => void;
}

export function MissionExportModal({ isOpen, onClose, onReplayPlan }: MissionExportModalProps) {
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');
  const [copied, setCopied] = useState<boolean>(false);
  const [importJsonText, setImportJsonText] = useState<string>('');
  const [importError, setImportError] = useState<string | null>(null);
  const [parsedPlan, setParsedPlan] = useState<AegisMissionPlanV1 | null>(null);

  // Store state
  const facilitySeed = useMissionStore((state) => state.facilitySeed);
  const setFacilitySeed = useMissionStore((state) => state.setFacilitySeed);
  const stagedProposal = useMissionStore((state) => state.stagedProposal);
  const stageProposal = useMissionStore((state) => state.stageProposal);
  const setApprovalStatus = useMissionStore((state) => state.setApprovalStatus);
  const mechanisms = useMissionStore((state) => state.mechanisms);
  const missionLog = useMissionStore((state) => state.missionLog);

  // Current exported plan object
  const currentExportPlan = useMemo(() => {
    return buildMissionPlanExport(facilitySeed, stagedProposal, mechanisms, missionLog);
  }, [facilitySeed, stagedProposal, mechanisms, missionLog]);

  if (!isOpen) return null;

  const handleCopyClipboard = () => {
    navigator.clipboard.writeText(JSON.stringify(currentExportPlan, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    downloadMissionPlanJSON(currentExportPlan);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setImportJsonText(content);
      handleParseImport(content);
    };
    reader.readAsText(file);
  };

  const handleParseImport = (text: string) => {
    setImportError(null);
    setParsedPlan(null);

    try {
      const parsed = JSON.parse(text);
      const validation = validateMissionPlan(parsed);
      if (!validation.valid || !validation.plan) {
        setImportError(validation.error || 'Failed schema validation.');
      } else {
        setParsedPlan(validation.plan);
      }
    } catch {
      setImportError('Invalid JSON syntax. Ensure file or text is valid JSON.');
    }
  };

  const handleExecuteReplay = () => {
    if (!parsedPlan) return;

    // 1. Synchronize facility seed
    setFacilitySeed(parsedPlan.facility_seed);

    // 2. Stage imported proposal
    stageProposal({
      id: `replay-${Date.now()}`,
      targetWaypoint: parsedPlan.target_waypoint,
      gaitProfile: parsedPlan.mission_metadata.gait_profile || 'CAUTIOUS_STEP',
      waypoints: parsedPlan.waypoints,
      predictedMinMargin: parsedPlan.mission_metadata.predicted_min_margin || 0.65,
      estimatedDurationSec: parsedPlan.mission_metadata.estimated_duration_sec || 10.0,
      requiredMechanisms: Object.keys(parsedPlan.mechanism_states || {}),
      stagedAt: Date.now(),
    });

    // 3. Mark approved & executing for immediate replay playback
    setApprovalStatus('EXECUTING');

    if (onReplayPlan) {
      onReplayPlan(parsedPlan);
    }

    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs select-none"
      role="dialog"
      aria-label="Mission Plan Export and Replay"
    >
      <div className="w-[620px] max-w-[calc(100vw-32px)] max-h-[85vh] bg-[#1E2226] border border-[#262B30] text-[#E8E3DA] font-mono text-xs shadow-2xl flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#181B1E] border-b border-[#262B30]">
          <div className="flex items-center gap-2">
            <FileJson className="w-4 h-4 text-accent-teal" />
            <span className="font-semibold tracking-wider text-xs">
              MISSION PLAN ARTIFACT // V1.0.0 (§9)
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-[#8E99A2] hover:text-[#E8E3DA] px-1 py-0.5 transition-colors"
            aria-label="Close Modal"
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-[#262B30] bg-[#14171A]">
          <button
            onClick={() => setActiveTab('export')}
            className={`flex-1 py-2 flex items-center justify-center gap-2 font-semibold text-xs border-r border-[#262B30] transition-colors ${
              activeTab === 'export'
                ? 'bg-[#1E2226] text-accent-teal border-b-2 border-b-accent-teal'
                : 'text-[#8E99A2] hover:text-[#E8E3DA]'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>EXPORT CURRENT PLAN</span>
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className={`flex-1 py-2 flex items-center justify-center gap-2 font-semibold text-xs transition-colors ${
              activeTab === 'import'
                ? 'bg-[#1E2226] text-accent-teal border-b-2 border-b-accent-teal'
                : 'text-[#8E99A2] hover:text-[#E8E3DA]'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>IMPORT & REPLAY PLAN</span>
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 p-4 overflow-y-auto max-h-[60vh]">
          {activeTab === 'export' ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#8E99A2]">
                  Seed {facilitySeed} • {currentExportPlan.waypoints.length} Waypoints • Gait:{' '}
                  <span className="text-accent-teal font-semibold">
                    {currentExportPlan.mission_metadata.gait_profile}
                  </span>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyClipboard}
                    className="flex items-center gap-1.5 px-2 py-1 bg-[#14171A] hover:bg-[#262B30] border border-[#262B30] text-[10px] rounded transition-colors"
                  >
                    {copied ? <Check className="w-3 h-3 text-accent-teal" /> : <Copy className="w-3 h-3" />}
                    <span>{copied ? 'COPIED' : 'COPY JSON'}</span>
                  </button>
                  <button
                    onClick={handleDownload}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-accent-teal hover:bg-accent-teal/80 text-[#14171A] font-bold text-[10px] rounded transition-colors"
                  >
                    <Download className="w-3 h-3 stroke-[2.5]" />
                    <span>DOWNLOAD .JSON</span>
                  </button>
                </div>
              </div>

              {/* Formatted Code Block */}
              <pre className="p-3 bg-[#14171A] border border-[#262B30] rounded text-[10px] text-accent-teal max-h-80 overflow-y-auto leading-relaxed">
                {JSON.stringify(currentExportPlan, null, 2)}
              </pre>
            </div>
          ) : (
            <div className="space-y-3">
              {/* File Upload Input */}
              <div className="flex items-center gap-2">
                <label className="flex-1 cursor-pointer flex items-center justify-center gap-2 py-2 px-3 bg-[#14171A] border border-dashed border-[#262B30] hover:border-accent-teal rounded text-[#8E99A2] hover:text-[#E8E3DA] text-[11px] transition-colors">
                  <Upload className="w-4 h-4 text-accent-teal" />
                  <span>Choose JSON Plan File...</span>
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Raw JSON Paste Area */}
              <div>
                <div className="text-[#8E99A2] text-[10px] uppercase mb-1">
                  Or Paste Mission Plan JSON:
                </div>
                <textarea
                  value={importJsonText}
                  onChange={(e) => {
                    setImportJsonText(e.target.value);
                    handleParseImport(e.target.value);
                  }}
                  placeholder='Paste {"schema_version": "1.0.0", "facility_seed": 42, ...}'
                  rows={6}
                  className="w-full p-2.5 bg-[#14171A] border border-[#262B30] rounded text-[10px] text-[#E8E3DA] focus:outline-none focus:border-accent-teal font-mono resize-none"
                />
              </div>

              {/* Validation Status Error / Success */}
              {importError && (
                <div className="p-2.5 bg-accent-red/10 border border-accent-red text-accent-red text-[11px] rounded flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{importError}</span>
                </div>
              )}

              {parsedPlan && (
                <div className="p-3 bg-accent-teal/10 border border-accent-teal rounded space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-accent-teal font-bold text-xs flex items-center gap-1.5">
                      <Check className="w-4 h-4" />
                      SCHEMA V1.0.0 VALIDATED
                    </span>
                    <span className="text-[10px] text-[#8E99A2]">
                      Seed: {parsedPlan.facility_seed}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-[10px]">
                    <div className="p-1.5 bg-[#14171A] rounded border border-[#262B30]">
                      <div className="text-[#8E99A2]">WAYPOINTS:</div>
                      <div className="font-semibold text-[#E8E3DA]">
                        {parsedPlan.waypoints.length} pts
                      </div>
                    </div>
                    <div className="p-1.5 bg-[#14171A] rounded border border-[#262B30]">
                      <div className="text-[#8E99A2]">GAIT:</div>
                      <div className="font-semibold text-accent-teal">
                        {parsedPlan.mission_metadata.gait_profile}
                      </div>
                    </div>
                    <div className="p-1.5 bg-[#14171A] rounded border border-[#262B30]">
                      <div className="text-[#8E99A2]">MIN MARGIN:</div>
                      <div className="font-semibold text-accent-teal">
                        {(parsedPlan.mission_metadata.predicted_min_margin * 100).toFixed(0)}%
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleExecuteReplay}
                    className="w-full mt-2 py-2.5 bg-accent-teal hover:bg-accent-teal/80 text-[#14171A] font-bold text-xs rounded flex items-center justify-center gap-2 transition-colors"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>LOAD & REPLAY PLAN ON SEED {parsedPlan.facility_seed}</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

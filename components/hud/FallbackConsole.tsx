'use client';

import React, { useState, useEffect } from 'react';
import { ACTIVE_TOOLS } from '@/lib/webmcp/register';
import { ToolDescriptor, ToolResult } from '@/lib/webmcp/types';
import { useMissionStore } from '@/lib/state/missionStore';
import { Play, Copy, Check, Terminal, ChevronRight, AlertCircle, Sparkles } from 'lucide-react';

interface FallbackConsoleProps {
  isOpen: boolean;
  onClose: () => void;
}

const TOOL_PAYLOAD_PRESETS: Record<string, { label: string; payload: any }[]> = {
  get_system_status: [
    { label: 'Verbose Query', payload: { verbose: true } },
    { label: 'Standard Query', payload: { verbose: false } },
  ],
  get_robot_telemetry: [
    { label: 'Live Robot Telemetry', payload: {} },
  ],
  scan_spatial_environment: [
    { label: 'Standard 15m Scan', payload: { scan_mode: 'high_res', range_m: 15 } },
    { label: 'Fast 8m Scan', payload: { scan_mode: 'fast', range_m: 8 } },
    { label: 'Trigger 50m Out-of-Bounds Error', payload: { scan_mode: 'high_res', range_m: 50 } },
  ],
  evaluate_gait_feasibility: [
    {
      label: 'Level Hallway (CAUTIOUS_STEP)',
      payload: {
        path: [
          [0, 0, 0],
          [4, 0, 0],
          [8, 0, 0],
        ],
        gait_profile: 'CAUTIOUS_STEP',
      },
    },
    {
      label: 'Ramp Incline (DYNAMIC_BALANCE Error)',
      payload: {
        path: [
          [10, 0, 2],
          [10, 0.5, 4],
          [10, 2.0, 9],
        ],
        gait_profile: 'DYNAMIC_BALANCE',
      },
    },
    {
      label: 'Ramp Incline (CAUTIOUS_STEP Feasible)',
      payload: {
        path: [
          [10, 0, 2],
          [10, 0.5, 4],
          [10, 2.0, 9],
        ],
        gait_profile: 'CAUTIOUS_STEP',
      },
    },
  ],
  query_facility_state: [
    { label: 'Query Facility & Route Status', payload: {} },
  ],
  stage_locomotion_plan: [
    {
      label: 'Stage Walk to East Corridor [4, 0, 0]',
      payload: {
        target_waypoint: [4, 0, 0],
        gait_profile: 'CAUTIOUS_STEP',
      },
    },
    {
      label: 'Stage Walk to Extraction [18, 2.5, 19]',
      payload: {
        target_waypoint: [18, 2.5, 19],
        gait_profile: 'CAUTIOUS_STEP',
      },
    },
    {
      label: 'Stage Walk to Vault Alcove [2, 0, 2]',
      payload: {
        target_waypoint: [2, 0, 2],
        gait_profile: 'CAUTIOUS_STEP',
      },
    },
  ],
  execute_staged_proposal: [
    {
      label: 'Execute Active Staged Proposal',
      payload: {
        proposal_id: 'CURRENT_PROPOSAL_ID',
      },
    },
  ],
  override_facility_mechanism: [
    {
      label: 'Disarm laser_gate_02 (Corridor E)',
      payload: {
        mechanism_id: 'laser_gate_02',
        command: 'DEACTIVATE',
      },
    },
    {
      label: 'Open sealed_door_01 (With Auth Code)',
      payload: {
        mechanism_id: 'sealed_door_01',
        command: 'DIVERT_POWER',
        authorization_code: 'AEGIS-7749-AUTH',
      },
    },
    {
      label: 'Open sealed_door_01 (Without Code -> Fails)',
      payload: {
        mechanism_id: 'sealed_door_01',
        command: 'DIVERT_POWER',
      },
    },
    {
      label: 'Raise freight_lift_01 to Upper Level',
      payload: {
        mechanism_id: 'freight_lift_01',
        command: 'RAISE',
      },
    },
  ],
};

export function FallbackConsole({ isOpen, onClose }: FallbackConsoleProps) {
  const [selectedToolIndex, setSelectedToolIndex] = useState<number>(0);
  const [inputJson, setInputJson] = useState<string>('{}');
  const [executionResult, setExecutionResult] = useState<ToolResult | null>(null);
  const [executing, setExecuting] = useState<boolean>(false);
  const [executionTimeMs, setExecutionTimeMs] = useState<number | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [jsonError, setJsonError] = useState<string | null>(null);

  const stagedProposal = useMissionStore((state) => state.stagedProposal);

  const currentTool: ToolDescriptor = ACTIVE_TOOLS[selectedToolIndex] || ACTIVE_TOOLS[0];

  // Update input JSON when changing tools
  useEffect(() => {
    const presets = TOOL_PAYLOAD_PRESETS[currentTool.name];
    if (presets && presets.length > 0) {
      const p = { ...presets[0].payload };
      if (currentTool.name === 'execute_staged_proposal' && stagedProposal) {
        p.proposal_id = stagedProposal.id;
      }
      setInputJson(JSON.stringify(p, null, 2));
    } else {
      setInputJson('{}');
    }
    setExecutionResult(null);
    setJsonError(null);
  }, [currentTool.name, stagedProposal]);

  if (!isOpen) return null;

  const handleExecute = async () => {
    setJsonError(null);
    let parsedArgs: any = {};

    if (inputJson.trim().length > 0) {
      try {
        parsedArgs = JSON.parse(inputJson);
      } catch (err) {
        setJsonError(`Malformed JSON syntax: ${(err as Error).message}`);
        return;
      }
    }

    setExecuting(true);
    const start = performance.now();
    try {
      const result = await currentTool.execute(parsedArgs);
      const end = performance.now();
      setExecutionTimeMs(Math.round((end - start) * 100) / 100);
      setExecutionResult(result);
    } catch (err) {
      const end = performance.now();
      setExecutionTimeMs(Math.round((end - start) * 100) / 100);
      setExecutionResult({
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                status: 'INTERNAL_ERROR',
                reason: (err as Error).message,
                recoverable: false,
              },
              null,
              2
            ),
          },
        ],
        isError: true,
      });
    } finally {
      setExecuting(false);
    }
  };

  const handleCopy = () => {
    if (!executionResult || executionResult.content.length === 0) return;
    navigator.clipboard.writeText(executionResult.content[0].text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const presets = TOOL_PAYLOAD_PRESETS[currentTool.name] || [];

  return (
    <div className="fixed right-4 top-[100px] bottom-4 w-[480px] max-w-[calc(100vw-32px)] z-30 flex flex-col bg-[#1E2226] border border-[#262B30] shadow-2xl overflow-hidden font-mono text-xs">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-surface-raised border-b border-surface-border">
        <div className="flex items-center gap-2 text-foreground font-semibold tracking-wide">
          <Terminal className="w-4 h-4 text-accent-cyan" />
          <span>WEBMCP ACTION & READ HARNESS (§5, §6)</span>
        </div>
        <button
          onClick={onClose}
          className="text-foreground-muted hover:text-foreground px-2 py-0.5 rounded hover:bg-surface-border text-xs"
        >
          ESC / CLOSE
        </button>
      </div>

      {/* Tool Selector Tabs */}
      <div className="flex items-center gap-1 p-2 bg-surface-muted border-b border-surface-border overflow-x-auto">
        {ACTIVE_TOOLS.map((tool, idx) => (
          <button
            key={tool.name}
            onClick={() => {
              setSelectedToolIndex(idx);
            }}
            className={`px-3 py-1.5 rounded text-[11px] whitespace-nowrap transition-colors ${
              selectedToolIndex === idx
                ? 'bg-accent-teal text-foreground font-bold'
                : 'text-foreground-muted hover:bg-surface hover:text-foreground'
            }`}
          >
            {tool.name}
          </button>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col p-4 gap-3.5 overflow-y-auto">
        {/* Tool Doc & Contract */}
        <div className="p-3 rounded bg-surface-muted border border-surface-border text-[11px] space-y-1">
          <div className="text-accent-cyan font-semibold flex items-center gap-1">
            <ChevronRight className="w-3 h-3" />
            <span>TOOL CONTRACT & DESCRIPTION</span>
          </div>
          <p className="text-foreground-muted leading-relaxed text-[11px]">
            {currentTool.description}
          </p>
        </div>

        {/* Payload Presets */}
        {presets.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1 text-foreground-muted text-[10px] uppercase tracking-wider">
              <Sparkles className="w-3 h-3 text-accent-cyan" />
              <span>Quick Test Presets</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {presets.map((p, i) => {
                const payload = { ...p.payload };
                if (currentTool.name === 'execute_staged_proposal' && stagedProposal) {
                  payload.proposal_id = stagedProposal.id;
                }
                return (
                  <button
                    key={i}
                    onClick={() => setInputJson(JSON.stringify(payload, null, 2))}
                    className="px-2.5 py-1 rounded bg-surface hover:bg-surface-raised border border-surface-border text-foreground text-[10px] transition-colors"
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Input Parameters Editor */}
        <div className="flex flex-col gap-1.5 flex-1 min-h-[140px]">
          <div className="flex items-center justify-between text-foreground-muted text-[11px]">
            <span>INPUT JSON PAYLOAD</span>
            <span>JSON Schema Compliant</span>
          </div>
          <textarea
            value={inputJson}
            onChange={(e) => {
              setInputJson(e.target.value);
              setJsonError(null);
            }}
            spellCheck={false}
            className="w-full flex-1 p-2.5 bg-[#0E1012] border border-surface-border rounded text-foreground font-mono text-xs focus:outline-none focus:border-accent-cyan transition-colors resize-none"
          />
          {jsonError && (
            <div className="flex items-center gap-1.5 text-accent-red text-[11px]">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>{jsonError}</span>
            </div>
          )}
        </div>

        {/* Execute Button */}
        <div>
          <button
            onClick={handleExecute}
            disabled={executing}
            className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded bg-accent-teal hover:bg-accent-teal/80 text-foreground font-semibold transition-colors disabled:opacity-50 text-xs"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{executing ? 'EXECUTING...' : 'INVOKE TOOL DIRECTLY'}</span>
          </button>
        </div>

        {/* Result Area */}
        {executionResult && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-[11px] text-foreground-muted">
              <div className="flex items-center gap-2">
                <span>EXECUTION RESPONSE</span>
                {executionTimeMs !== null && (
                  <span className="text-accent-cyan">({executionTimeMs}ms)</span>
                )}
                <span
                  className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                    executionResult.isError
                      ? 'bg-accent-red/20 text-accent-red border border-accent-red'
                      : 'bg-accent-green/20 text-accent-green border border-accent-green'
                  }`}
                >
                  {executionResult.isError ? 'REJECTED / ERROR' : 'SCHEMA_VALID (200 OK)'}
                </span>
              </div>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 text-foreground-muted hover:text-foreground"
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3 text-accent-green" />
                    <span className="text-accent-green">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy JSON</span>
                  </>
                )}
              </button>
            </div>
            <pre className="p-3 bg-[#0E1012] border border-surface-border rounded text-foreground text-xs overflow-x-auto max-h-[220px]">
              {executionResult.content.map((c, i) => (
                <code key={i}>{c.text}</code>
              ))}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

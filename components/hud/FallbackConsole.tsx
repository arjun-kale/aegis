'use client';

import React, { useState } from 'react';
import { ACTIVE_TOOLS } from '@/lib/webmcp/register';
import { ToolDescriptor, ToolResult } from '@/lib/webmcp/types';
import { Play, Copy, Check, Terminal, ChevronRight, AlertCircle } from 'lucide-react';

interface FallbackConsoleProps {
  isOpen: boolean;
  onClose: () => void;
}

export function FallbackConsole({ isOpen, onClose }: FallbackConsoleProps) {
  const [selectedToolIndex, setSelectedToolIndex] = useState<number>(0);
  const [inputJson, setInputJson] = useState<string>('{\n  "verbose": true\n}');
  const [executionResult, setExecutionResult] = useState<ToolResult | null>(null);
  const [executing, setExecuting] = useState<boolean>(false);
  const [executionTimeMs, setExecutionTimeMs] = useState<number | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [jsonError, setJsonError] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentTool: ToolDescriptor = ACTIVE_TOOLS[selectedToolIndex] || ACTIVE_TOOLS[0];

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

  return (
    <div className="absolute right-4 top-16 bottom-4 w-[520px] max-w-[calc(100vw-32px)] z-30 flex flex-col bg-surface/95 backdrop-blur-md border border-surface-border rounded-lg shadow-2xl overflow-hidden font-mono text-xs">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-surface-raised border-b border-surface-border">
        <div className="flex items-center gap-2 text-foreground font-semibold tracking-wide">
          <Terminal className="w-4 h-4 text-accent-cyan" />
          <span>WEBMCP FALLBACK HARNESS</span>
        </div>
        <button
          onClick={onClose}
          className="text-foreground-muted hover:text-foreground px-2 py-0.5 rounded hover:bg-surface-border text-xs"
        >
          ESC / CLOSE
        </button>
      </div>

      {/* Tool Selector */}
      <div className="flex items-center gap-1 p-2 bg-surface-muted border-b border-surface-border overflow-x-auto">
        {ACTIVE_TOOLS.map((tool, idx) => (
          <button
            key={tool.name}
            onClick={() => {
              setSelectedToolIndex(idx);
              setExecutionResult(null);
            }}
            className={`px-3 py-1.5 rounded text-xs whitespace-nowrap transition-colors ${
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
      <div className="flex-1 flex flex-col p-4 gap-4 overflow-y-auto">
        {/* Tool Doc & Guidance */}
        <div className="p-3 rounded bg-surface-muted border border-surface-border text-[11px] space-y-1.5">
          <div className="text-accent-cyan font-semibold flex items-center gap-1">
            <ChevronRight className="w-3 h-3" />
            TOOL CONTRACT & DESCRIPTION
          </div>
          <p className="text-foreground-muted leading-relaxed">
            {currentTool.description}
          </p>
        </div>

        {/* Input Parameters Editor */}
        <div className="flex flex-col gap-1.5 flex-1 min-h-[160px]">
          <div className="flex items-center justify-between text-foreground-muted text-[11px]">
            <span>INPUT JSON SCHEMA</span>
            <span>args: Record&lt;string, any&gt;</span>
          </div>
          <textarea
            value={inputJson}
            onChange={(e) => {
              setInputJson(e.target.value);
              setJsonError(null);
            }}
            spellCheck={false}
            className="w-full flex-1 p-3 bg-[#0E1012] border border-surface-border rounded text-foreground font-mono text-xs focus:outline-none focus:border-accent-cyan transition-colors resize-none"
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
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded bg-accent-teal hover:bg-accent-teal/80 text-foreground font-semibold transition-colors disabled:opacity-50"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>{executing ? 'EXECUTING...' : 'INVOKE TOOL DIRECTLY'}</span>
          </button>
        </div>

        {/* Result Area */}
        {executionResult && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-[11px] text-foreground-muted">
              <div className="flex items-center gap-2">
                <span>EXECUTION OUTPUT</span>
                {executionTimeMs !== null && (
                  <span className="text-accent-cyan">({executionTimeMs}ms)</span>
                )}
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

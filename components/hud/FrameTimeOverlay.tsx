'use client';

import React, { useEffect, useRef, useState } from 'react';
import { getTelemetryBuffer } from '@/lib/state/telemetryBus';
import { TELEMETRY_OFFSETS } from '@/lib/state/telemetryOffsets';
import { Activity, X } from 'lucide-react';

interface FrameTimeOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

const HISTORY_LENGTH = 80;
const CANVAS_WIDTH = 280;
const CANVAS_HEIGHT = 90;
const MAX_FRAME_TIME_DISPLAY = 40; // ms

export function FrameTimeOverlay({ isOpen, onClose }: FrameTimeOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const historyRef = useRef<number[]>(new Array(HISTORY_LENGTH).fill(16.6));
  const [stats, setStats] = useState({ avg: 16.6, min: 16.6, max: 16.6, fps: 60, dropped: 0 });

  useEffect(() => {
    if (!isOpen) return;

    let animId: number;
    let lastSampleTime = performance.now();
    let droppedFramesCount = 0;

    const renderLoop = () => {
      const now = performance.now();
      
      // Sample from telemetry bus every ~50ms (20 Hz)
      if (now - lastSampleTime >= 50) {
        lastSampleTime = now;
        const buf = getTelemetryBuffer();
        const currentFrameTime = buf[TELEMETRY_OFFSETS.FRAME_TIME_MS] || 16.6;
        const currentFps = buf[TELEMETRY_OFFSETS.FPS] || 60;

        if (currentFrameTime > 18.0) {
          droppedFramesCount++;
        }

        const hist = historyRef.current;
        hist.push(currentFrameTime);
        if (hist.length > HISTORY_LENGTH) {
          hist.shift();
        }

        // Compute statistics
        let sum = 0;
        let min = 999;
        let max = 0;
        for (let i = 0; i < hist.length; i++) {
          const val = hist[i];
          sum += val;
          if (val < min) min = val;
          if (val > max) max = val;
        }

        setStats({
          avg: Math.round((sum / hist.length) * 10) / 10,
          min: Math.round(min * 10) / 10,
          max: Math.round(max * 10) / 10,
          fps: Math.round(currentFps),
          dropped: droppedFramesCount,
        });

        // Draw Canvas graph
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

          // Draw 16.6ms (60 FPS) guideline
          const y60 = CANVAS_HEIGHT - (16.6 / MAX_FRAME_TIME_DISPLAY) * CANVAS_HEIGHT;
          ctx.strokeStyle = 'rgba(46, 204, 113, 0.3)';
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(0, y60);
          ctx.lineTo(CANVAS_WIDTH, y60);
          ctx.stroke();

          // Draw 33.3ms (30 FPS) guideline
          const y30 = CANVAS_HEIGHT - (33.3 / MAX_FRAME_TIME_DISPLAY) * CANVAS_HEIGHT;
          ctx.strokeStyle = 'rgba(217, 138, 43, 0.3)';
          ctx.beginPath();
          ctx.moveTo(0, y30);
          ctx.lineTo(CANVAS_WIDTH, y30);
          ctx.stroke();
          ctx.setLineDash([]);

          // Draw Frame Time Sparkline
          ctx.beginPath();
          const step = CANVAS_WIDTH / (HISTORY_LENGTH - 1);
          for (let i = 0; i < hist.length; i++) {
            const val = Math.min(MAX_FRAME_TIME_DISPLAY, hist[i]);
            const x = i * step;
            const y = CANVAS_HEIGHT - (val / MAX_FRAME_TIME_DISPLAY) * CANVAS_HEIGHT;
            if (i === 0) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
          }
          ctx.strokeStyle = '#00E5FF';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          // Fill area under graph
          ctx.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT);
          ctx.lineTo(0, CANVAS_HEIGHT);
          ctx.closePath();
          ctx.fillStyle = 'rgba(0, 229, 255, 0.08)';
          ctx.fill();
        }
      }

      animId = requestAnimationFrame(renderLoop);
    };

    animId = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(animId);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed left-4 top-[100px] bottom-4 z-30 flex flex-col bg-[#1E2226] border border-[#262B30] shadow-2xl overflow-hidden font-mono text-xs w-[360px] max-w-[calc(100vw-32px)]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-surface-raised border-b border-surface-border">
        <div className="flex items-center gap-2 text-foreground font-semibold">
          <Activity className="w-4 h-4 text-accent-cyan" />
          <span>FRAME TIME TELEMETRY</span>
        </div>
        <button
          onClick={onClose}
          className="text-foreground-muted hover:text-foreground p-0.5 rounded hover:bg-surface-border"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Chart Canvas */}
      <div className="p-3 bg-[#0E1012] flex flex-col gap-2">
        <div className="relative">
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className="w-full h-[90px] block"
          />
          <div className="absolute right-1 top-1 text-[9px] text-accent-green opacity-70">
            16.6ms (60 FPS)
          </div>
          <div className="absolute right-1 top-[42px] text-[9px] text-accent-amber opacity-70">
            33.3ms (30 FPS)
          </div>
        </div>

        {/* Metrics readout */}
        <div className="grid grid-cols-4 gap-1 pt-1 border-t border-surface-border text-[10px]">
          <div>
            <div className="text-foreground-muted">AVG:</div>
            <div className="text-foreground font-semibold">{stats.avg}ms</div>
          </div>
          <div>
            <div className="text-foreground-muted">MIN:</div>
            <div className="text-accent-green font-semibold">{stats.min}ms</div>
          </div>
          <div>
            <div className="text-foreground-muted">MAX:</div>
            <div
              className={`font-semibold ${
                stats.max > 18 ? 'text-accent-redText' : 'text-foreground'
              }`}
            >
              {stats.max}ms
            </div>
          </div>
          <div>
            <div className="text-foreground-muted">FPS:</div>
            <div className="text-accent-cyan font-semibold">{stats.fps}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

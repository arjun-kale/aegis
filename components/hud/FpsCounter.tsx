'use client';

import React from 'react';
import { useTelemetry } from '@/lib/state/useTelemetry';
import { TELEMETRY_OFFSETS } from '@/lib/state/telemetryOffsets';
import { getSystemMetrics } from '@/lib/webmcp/systemMetrics';

export function FpsCounter() {
  // Read FPS and FRAME_TIME_MS from telemetryBus at 10 Hz via useTelemetry hook (§3.1)
  const [frameTimeMs, fps] = useTelemetry(TELEMETRY_OFFSETS.FRAME_TIME_MS, 2, 10);
  const metrics = getSystemMetrics();

  const currentFps = Math.round(fps || 60);
  const currentFrameTime = Math.round((frameTimeMs || 16.6) * 10) / 10;

  const fpsColor =
    currentFps >= 55
      ? 'text-accent-green'
      : currentFps >= 30
      ? 'text-accent-amber'
      : 'text-accent-redText';

  return (
    <div className="flex items-center gap-3 px-3 py-1.5 rounded bg-surface/80 border border-surface-border text-xs font-mono select-none">
      <div className="flex items-center gap-1.5">
        <span className="text-foreground-muted">FPS:</span>
        <span className={`font-semibold ${fpsColor}`}>{currentFps}</span>
      </div>
      <div className="h-3 w-px bg-surface-border" />
      <div className="flex items-center gap-1.5">
        <span className="text-foreground-muted">TIME:</span>
        <span className="text-foreground">{currentFrameTime}ms</span>
      </div>
      <div className="h-3 w-px bg-surface-border" />
      <div className="flex items-center gap-1.5">
        <span className="text-foreground-muted">OBJS:</span>
        <span className="text-foreground">{metrics.sceneObjectCount}</span>
      </div>
    </div>
  );
}

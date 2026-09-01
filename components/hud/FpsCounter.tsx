'use client';

import React, { useEffect, useState } from 'react';
import { getSystemMetrics, SystemMetricsData } from '@/lib/webmcp/systemMetrics';

export function FpsCounter() {
  const [metrics, setMetrics] = useState<SystemMetricsData>(getSystemMetrics());

  // Poll at 10 Hz (every 100ms) for smooth human-readable updates without 60Hz re-rendering
  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(getSystemMetrics());
    }, 100);
    return () => clearInterval(interval);
  }, []);

  const fpsColor =
    metrics.fps >= 55
      ? 'text-accent-green'
      : metrics.fps >= 30
      ? 'text-accent-amber'
      : 'text-accent-red';

  return (
    <div className="flex items-center gap-3 px-3 py-1.5 rounded bg-surface/80 border border-surface-border text-xs font-mono select-none">
      <div className="flex items-center gap-1.5">
        <span className="text-foreground-muted">FPS:</span>
        <span className={`font-semibold ${fpsColor}`}>{metrics.fps}</span>
      </div>
      <div className="h-3 w-px bg-surface-border" />
      <div className="flex items-center gap-1.5">
        <span className="text-foreground-muted">TIME:</span>
        <span className="text-foreground">{metrics.frameTimeMs}ms</span>
      </div>
      <div className="h-3 w-px bg-surface-border" />
      <div className="flex items-center gap-1.5">
        <span className="text-foreground-muted">OBJS:</span>
        <span className="text-foreground">{metrics.sceneObjectCount}</span>
      </div>
    </div>
  );
}

/**
 * Global telemetry and scene state holder for live system metrics.
 * Updated at 60 Hz in the R3F render loop without triggering React re-renders.
 */

export interface SystemMetricsData {
  fps: number;
  frameTimeMs: number;
  sceneObjectCount: number;
  meshCount: number;
  triangles: number;
  drawCalls: number;
  geometries: number;
  textures: number;
  lastUpdated: number;
}

const metrics: SystemMetricsData = {
  fps: 60,
  frameTimeMs: 16.6,
  sceneObjectCount: 0,
  meshCount: 0,
  triangles: 0,
  drawCalls: 0,
  geometries: 0,
  textures: 0,
  lastUpdated: Date.now(),
};

// Moving average buffer for FPS calculation
const FPS_SAMPLE_SIZE = 30;
const frameDeltas: number[] = [];

export function recordFrameMetrics(
  deltaSec: number,
  sceneStats?: {
    sceneObjects?: number;
    meshes?: number;
    triangles?: number;
    drawCalls?: number;
    geometries?: number;
    textures?: number;
  }
) {
  const frameMs = deltaSec * 1000;
  frameDeltas.push(frameMs);
  if (frameDeltas.length > FPS_SAMPLE_SIZE) {
    frameDeltas.shift();
  }

  const avgFrameMs = frameDeltas.reduce((a, b) => a + b, 0) / frameDeltas.length;
  metrics.frameTimeMs = Math.round(avgFrameMs * 10) / 10;
  metrics.fps = Math.min(120, Math.round(1000 / Math.max(1, avgFrameMs)));

  if (sceneStats) {
    if (sceneStats.sceneObjects !== undefined) metrics.sceneObjectCount = sceneStats.sceneObjects;
    if (sceneStats.meshes !== undefined) metrics.meshCount = sceneStats.meshes;
    if (sceneStats.triangles !== undefined) metrics.triangles = sceneStats.triangles;
    if (sceneStats.drawCalls !== undefined) metrics.drawCalls = sceneStats.drawCalls;
    if (sceneStats.geometries !== undefined) metrics.geometries = sceneStats.geometries;
    if (sceneStats.textures !== undefined) metrics.textures = sceneStats.textures;
  }

  metrics.lastUpdated = Date.now();
}

export function getSystemMetrics(): SystemMetricsData {
  return { ...metrics };
}

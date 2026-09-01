'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { recordFrameMetrics } from '@/lib/webmcp/systemMetrics';
import { writeTelemetrySingle } from '@/lib/state/telemetryBus';
import { TELEMETRY_OFFSETS } from '@/lib/state/telemetryOffsets';
import * as THREE from 'three';

let startTime = 0;

export function SceneMetricsTracker() {
  const { scene, gl } = useThree();

  useFrame((state, delta) => {
    if (startTime === 0) startTime = state.clock.getElapsedTime();
    const missionElapsedSec = state.clock.getElapsedTime() - startTime;

    let objectCount = 0;
    let meshCount = 0;

    scene.traverse((child) => {
      objectCount++;
      if ((child as THREE.Mesh).isMesh) {
        meshCount++;
      }
    });

    const info = gl.info;
    const frameMs = delta * 1000;
    const fps = Math.min(120, Math.round(1000 / Math.max(1, frameMs)));

    // 1. Write per-frame data into telemetryBus (Float32Array buffer)
    writeTelemetrySingle(TELEMETRY_OFFSETS.FRAME_TIME_MS, frameMs);
    writeTelemetrySingle(TELEMETRY_OFFSETS.FPS, fps);
    writeTelemetrySingle(TELEMETRY_OFFSETS.MISSION_TIME_SEC, missionElapsedSec);

    // 2. Update WebMCP diagnostic metrics
    recordFrameMetrics(delta, {
      sceneObjects: objectCount,
      meshes: meshCount,
      triangles: info.render.triangles,
      drawCalls: info.render.calls,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
    });
  });

  return null;
}

'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { recordFrameMetrics } from '@/lib/webmcp/systemMetrics';
import * as THREE from 'three';

export function SceneMetricsTracker() {
  const { scene, gl } = useThree();

  useFrame((_, delta) => {
    let objectCount = 0;
    let meshCount = 0;

    scene.traverse((child) => {
      objectCount++;
      if ((child as THREE.Mesh).isMesh) {
        meshCount++;
      }
    });

    const info = gl.info;

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

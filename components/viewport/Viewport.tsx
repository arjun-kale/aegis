'use client';

import React from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import { SceneMetricsTracker } from './SceneMetricsTracker';
import { Robot } from './Robot';
import { FullBodyKinematicState } from '@/lib/robot/kinematics';

interface ViewportProps {
  pose: FullBodyKinematicState;
  showTargetGizmos?: boolean;
}

export default function Viewport({ pose, showTargetGizmos = false }: ViewportProps) {
  return (
    <div className="relative w-full h-full bg-[#14171A] overflow-hidden select-none">
      <Canvas
        camera={{ position: [2.5, 1.8, 3.2], fov: 45 }}
        shadows
        gl={{
          antialias: true,
          powerPreference: 'high-performance',
        }}
      >
        <color attach="background" args={['#14171A']} />

        {/* Studio & Mission Lighting */}
        <ambientLight intensity={0.4} />
        <directionalLight
          position={[6, 10, 6]}
          intensity={1.4}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-bias={-0.0001}
        />
        <directionalLight
          position={[-6, 6, -4]}
          intensity={0.3}
          color="#3E7C79"
        />

        {/* 40m Technical Nav Grid */}
        <Grid
          position={[0, -0.001, 0]}
          args={[40, 40]}
          cellSize={0.5}
          cellThickness={1}
          cellColor="#262B30"
          sectionSize={2.5}
          sectionThickness={1.5}
          sectionColor="#3E7C79"
          fadeDistance={25}
          fadeStrength={1.5}
        />

        {/* Procedural Bipedal Robot Hierarchy */}
        <Robot pose={pose} showTargetGizmos={showTargetGizmos} />

        {/* Controls */}
        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.08}
          minDistance={1.2}
          maxDistance={25}
          target={[0, 0.75, 0]}
          maxPolarAngle={Math.PI / 2 - 0.02}
        />

        {/* Scene metrics tracker feeding WebMCP and telemetry bus */}
        <SceneMetricsTracker />
      </Canvas>
    </div>
  );
}

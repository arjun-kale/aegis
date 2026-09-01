'use client';

import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import { SceneMetricsTracker } from './SceneMetricsTracker';

export default function Viewport() {
  return (
    <div className="relative w-full h-full bg-[#14171A] overflow-hidden select-none">
      <Canvas
        camera={{ position: [8, 6, 8], fov: 45 }}
        shadows
        gl={{
          antialias: true,
          powerPreference: 'high-performance',
        }}
      >
        <color attach="background" args={['#14171A']} />
        
        {/* Lights */}
        <ambientLight intensity={0.4} />
        <directionalLight
          position={[10, 15, 10]}
          intensity={1.2}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-bias={-0.0001}
        />
        
        {/* Ground grid */}
        <Grid
          position={[0, -0.01, 0]}
          args={[40, 40]}
          cellSize={1}
          cellThickness={1}
          cellColor="#333A42"
          sectionSize={5}
          sectionThickness={1.5}
          sectionColor="#3E7C79"
          fadeDistance={30}
          fadeStrength={1.5}
        />

        {/* Phase 0 origin marker / calibration reference */}
        <group position={[0, 0.5, 0]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial
              color="#262B30"
              roughness={0.4}
              metalness={0.6}
              emissive="#3E7C79"
              emissiveIntensity={0.2}
            />
          </mesh>
        </group>

        {/* Controls */}
        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.08}
          minDistance={2}
          maxDistance={40}
          maxPolarAngle={Math.PI / 2 - 0.05} // Prevent camera going under floor
        />

        {/* Scene metrics tracker feeding WebMCP telemetry */}
        <SceneMetricsTracker />
      </Canvas>
    </div>
  );
}

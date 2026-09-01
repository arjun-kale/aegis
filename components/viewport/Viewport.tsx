'use client';

import React, { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Line } from '@react-three/drei';
import { SceneMetricsTracker } from './SceneMetricsTracker';
import { Robot } from './Robot';
import { FullBodyKinematicState } from '@/lib/robot/kinematics';
import { StabilityAnalysisResult, Point2D } from '@/lib/robot/stability';
import { LocomotionPathPoint } from '@/lib/robot/locomotion';
import * as THREE from 'three';

interface ViewportProps {
  pose: FullBodyKinematicState;
  stabilityState?: StabilityAnalysisResult;
  pathPoints?: LocomotionPathPoint[];
  showTargetGizmos?: boolean;
  showSupportPolygon?: boolean;
}

export default function Viewport({
  pose,
  stabilityState,
  pathPoints = [],
  showTargetGizmos = false,
  showSupportPolygon = true,
}: ViewportProps) {
  // Convert support polygon vertices to 3D line points on the ground plane
  const polygonPoints = useMemo(() => {
    if (!stabilityState || stabilityState.supportPolygon.length === 0) return [];
    const pts = stabilityState.supportPolygon.map((p) => new THREE.Vector3(p.x, 0.005, p.z));
    // Close the loop
    if (pts.length > 0) {
      pts.push(pts[0].clone());
    }
    return pts;
  }, [stabilityState]);

  // Convert trajectory path points to 3D line
  const pathLinePoints = useMemo(() => {
    if (!pathPoints || pathPoints.length < 2) return [];
    return pathPoints.map((p) => new THREE.Vector3(p.x, 0.01, p.z));
  }, [pathPoints]);

  return (
    <div className="relative w-full h-full bg-[#14171A] overflow-hidden select-none">
      <Canvas
        camera={{ position: [3.2, 2.2, 3.8], fov: 45 }}
        shadows
        gl={{
          antialias: true,
          powerPreference: 'high-performance',
        }}
      >
        <color attach="background" args={['#14171A']} />

        {/* Studio Lighting */}
        <ambientLight intensity={0.4} />
        <directionalLight
          position={[6, 12, 6]}
          intensity={1.4}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-bias={-0.0001}
        />
        <directionalLight
          position={[-6, 6, -4]}
          intensity={0.35}
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
          fadeDistance={30}
          fadeStrength={1.5}
        />

        {/* Trajectory Path Line */}
        {pathLinePoints.length > 1 && (
          <Line
            points={pathLinePoints}
            color="#3E7C79"
            lineWidth={2}
            dashed
            dashScale={5}
            dashSize={0.5}
            gapSize={0.2}
          />
        )}

        {/* 2D Support Polygon & CoM Ground Projection (§1.3) */}
        {showSupportPolygon && stabilityState && (
          <group>
            {/* Support Polygon Boundary Line */}
            {polygonPoints.length > 1 && (
              <Line
                points={polygonPoints}
                color={
                  stabilityState.stabilityMargin >= 0.6
                    ? '#2ECC71'
                    : stabilityState.stabilityMargin >= 0.4
                    ? '#D98A2B'
                    : '#C4472F'
                }
                lineWidth={2.5}
              />
            )}

            {/* CoM Ground Projection Marker */}
            <mesh position={stabilityState.comGround}>
              <cylinderGeometry args={[0.04, 0.04, 0.01, 16]} />
              <meshBasicMaterial
                color={
                  stabilityState.isInsidePolygon ? '#00E5FF' : '#C4472F'
                }
              />
            </mesh>
          </group>
        )}

        {/* Procedural Bipedal Robot */}
        <Robot pose={pose} showTargetGizmos={showTargetGizmos} />

        {/* Orbit Camera Controls */}
        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.08}
          minDistance={1.2}
          maxDistance={30}
          target={[0, 0.75, 0]}
          maxPolarAngle={Math.PI / 2 - 0.02}
        />

        {/* Telemetry and Frame Metrics Tracker */}
        <SceneMetricsTracker />
      </Canvas>
    </div>
  );
}

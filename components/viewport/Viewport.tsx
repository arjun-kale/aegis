'use client';

import React, { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Line } from '@react-three/drei';
import { SceneMetricsTracker } from './SceneMetricsTracker';
import { Robot } from './Robot';
import { Facility } from './Facility';
import { FullBodyKinematicState } from '@/lib/robot/kinematics';
import { StabilityAnalysisResult } from '@/lib/robot/stability';
import { LocomotionPathPoint } from '@/lib/robot/locomotion';
import { FacilityGeometryData } from '@/lib/world/generator';
import { MechanismRecord } from '@/lib/state/missionStore';
import * as THREE from 'three';

interface ViewportProps {
  pose: FullBodyKinematicState;
  stabilityState?: StabilityAnalysisResult;
  pathPoints?: [number, number, number][] | LocomotionPathPoint[];
  facilityData?: FacilityGeometryData;
  mechanismStates?: Record<string, MechanismRecord>;
  unexploredFrontiers?: [number, number, number][];
  showTargetGizmos?: boolean;
  showSupportPolygon?: boolean;
}

export default function Viewport({
  pose,
  stabilityState,
  pathPoints = [],
  facilityData,
  mechanismStates = {},
  unexploredFrontiers = [],
  showTargetGizmos = false,
  showSupportPolygon = true,
}: ViewportProps) {
  // Convert support polygon vertices to 3D line points on the ground plane
  const polygonPoints = useMemo(() => {
    if (!stabilityState || stabilityState.supportPolygon.length === 0) return [];
    const pts = stabilityState.supportPolygon.map((p) => new THREE.Vector3(p.x, 0.005, p.z));
    if (pts.length > 0) {
      pts.push(pts[0].clone());
    }
    return pts;
  }, [stabilityState]);

  // Convert trajectory path points to 3D line
  const pathLinePoints = useMemo(() => {
    if (!pathPoints || pathPoints.length < 2) return [];
    return pathPoints.map((p) => {
      if (Array.isArray(p)) {
        return new THREE.Vector3(p[0], p[1] + 0.02, p[2]);
      }
      return new THREE.Vector3(p.x, p.y + 0.02, p.z);
    });
  }, [pathPoints]);

  return (
    <div className="relative w-full h-full bg-[#14171A] overflow-hidden select-none">
      <Canvas
        camera={{ position: [8, 12, 18], fov: 45 }}
        shadows
        gl={{
          antialias: true,
          powerPreference: 'high-performance',
        }}
      >
        <color attach="background" args={['#14171A']} />

        {/* Studio & Facility Lighting */}
        <ambientLight intensity={0.45} />
        <directionalLight
          position={[12, 22, 14]}
          intensity={1.5}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-bias={-0.0001}
        />
        <directionalLight
          position={[-12, 14, -8]}
          intensity={0.4}
          color="#3E7C79"
        />

        {/* 60m Technical Nav Grid */}
        <Grid
          position={[0, -0.001, 0]}
          args={[60, 60]}
          cellSize={1.0}
          cellThickness={1}
          cellColor="#262B30"
          sectionSize={5.0}
          sectionThickness={1.5}
          sectionColor="#3E7C79"
          fadeDistance={45}
          fadeStrength={1.5}
        />

        {/* Instanced Facility Geometry & Mechanisms */}
        {facilityData && (
          <Facility
            geometryData={facilityData}
            mechanismStates={mechanismStates}
          />
        )}

        {/* Trajectory / A* Path Line */}
        {pathLinePoints.length > 1 && (
          <Line
            points={pathLinePoints}
            color="#00E5FF"
            lineWidth={3}
            dashed
            dashScale={4}
            dashSize={0.4}
            gapSize={0.2}
          />
        )}

        {/* Unexplored Frontier Markers (Cyan Pointers) */}
        {unexploredFrontiers.map((f, idx) => (
          <mesh key={`frontier_${idx}`} position={[f[0], f[1] + 0.1, f[2]]}>
            <coneGeometry args={[0.15, 0.4, 8]} />
            <meshStandardMaterial
              color="#00E5FF"
              emissive="#00E5FF"
              emissiveIntensity={1.2}
              wireframe
            />
          </mesh>
        ))}

        {/* 2D Support Polygon & CoM Ground Projection (§1.3) */}
        {showSupportPolygon && stabilityState && (
          <group>
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

            <mesh position={stabilityState.comGround}>
              <cylinderGeometry args={[0.05, 0.05, 0.01, 16]} />
              <meshBasicMaterial
                color={stabilityState.isInsidePolygon ? '#00E5FF' : '#C4472F'}
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
          minDistance={1.5}
          maxDistance={50}
          target={[4, 1.2, 6]}
          maxPolarAngle={Math.PI / 2 - 0.02}
        />

        {/* Telemetry and Frame Metrics Tracker */}
        <SceneMetricsTracker />
      </Canvas>
    </div>
  );
}

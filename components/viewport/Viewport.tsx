'use client';

import React, { useMemo, useState, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid, Line } from '@react-three/drei';
import { RefreshCw, WifiOff } from 'lucide-react';
import { SceneMetricsTracker } from './SceneMetricsTracker';
import { Robot } from './Robot';
import { Facility } from './Facility';
import { GhostTrajectory } from './GhostTrajectory';
import { Effects } from './Effects';
import { FullBodyKinematicState } from '@/lib/robot/kinematics';
import { StabilityAnalysisResult } from '@/lib/robot/stability';
import { LocomotionPathPoint } from '@/lib/robot/locomotion';
import { FacilityGeometryData } from '@/lib/world/generator';
import { MechanismRecord, StagedProposal, useMissionStore } from '@/lib/state/missionStore';
import * as THREE from 'three';

interface ViewportProps {
  pose: FullBodyKinematicState;
  stabilityState?: StabilityAnalysisResult;
  pathPoints?: [number, number, number][] | LocomotionPathPoint[];
  facilityData?: FacilityGeometryData;
  mechanismStates?: Record<string, MechanismRecord>;
  unexploredFrontiers?: [number, number, number][];
  stagedProposal?: StagedProposal | null;
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
  stagedProposal = null,
  showTargetGizmos = false,
  showSupportPolygon = true,
}: ViewportProps) {
  // WebGL context-loss recovery (Phase 10 §10 "Robustness"). The GPU driver
  // can drop the context under memory pressure or a tab-suspend/resume; the
  // canvas goes black silently unless we listen for it ourselves.
  const [contextLost, setContextLost] = useState(false);
  const [canvasKey, setCanvasKey] = useState(0);

  const handleCreated = useCallback(({ gl }: { gl: THREE.WebGLRenderer }) => {
    const canvasEl = gl.domElement;
    const onLost = (e: Event) => {
      e.preventDefault();
      console.warn('[A.E.G.I.S] WebGL context lost.');
      setContextLost(true);
    };
    const onRestored = () => {
      console.info('[A.E.G.I.S] WebGL context restored.');
      setContextLost(false);
    };
    canvasEl.addEventListener('webglcontextlost', onLost, false);
    canvasEl.addEventListener('webglcontextrestored', onRestored, false);
  }, []);

  const handleReloadCanvas = () => {
    setContextLost(false);
    setCanvasKey((k) => k + 1);
  };

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

  if (contextLost) {
    return (
      <div className="relative w-full h-full bg-[#14171A] overflow-hidden select-none">
        <div className="flex flex-col items-center justify-center gap-4 w-full h-full text-foreground font-mono text-xs px-6 text-center">
          <WifiOff className="w-8 h-8 text-accent-amber" />
          <div className="max-w-md space-y-1.5">
            <div className="text-sm font-semibold text-accent-amber">WEBGL CONTEXT LOST</div>
            <p className="text-foreground-muted leading-relaxed">
              The GPU rendering context was dropped by the browser (common after tab
              suspension or a driver reset). Mission state is preserved — reload the
              canvas to resume rendering.
            </p>
          </div>
          <button
            onClick={handleReloadCanvas}
            className="flex items-center gap-2 px-4 py-2 rounded bg-accent-teal hover:bg-accent-teal/80 text-white font-semibold transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>RELOAD CANVAS</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-[#14171A] overflow-hidden select-none">
      <Canvas
        key={canvasKey}
        camera={{ position: [4, 3.2, 6], fov: 45 }}
        shadows
        dpr={[1, 2]}
        gl={{
          antialias: true,
          powerPreference: 'high-performance',
        }}
        onCreated={handleCreated}
      >
        <color attach="background" args={['#14171A']} />

        {/* Studio & Facility Lighting — key + fill + a close rim light so the
            robot (the actual subject) reads clearly at the default framing,
            rather than disappearing into the dark facility around it. */}
        <ambientLight intensity={0.65} />
        <pointLight position={[0.5, 2.6, 1.8]} intensity={0.55} color="#E8E3DA" distance={9} decay={2} />
        <directionalLight
          position={[6, 10, 6]}
          intensity={2.1}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-bias={-0.0001}
        />
        <directionalLight
          position={[-8, 6, -4]}
          intensity={0.65}
          color="#3E7C79"
        />

        {/* 60m Technical Nav Grid (§7 palette) */}
        <Grid
          position={[0, -0.001, 0]}
          args={[60, 60]}
          cellSize={1.0}
          cellThickness={1}
          cellColor="#262B30"
          sectionSize={5.0}
          sectionThickness={1.5}
          sectionColor="#333A42"
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

        {/* 1. Staged Proposal Ghost Trajectory with One Bold Moment (§7, §6) */}
        {stagedProposal ? (
          <GhostTrajectory proposal={stagedProposal} />
        ) : (
          /* Active Trajectory Line fallback when not in staged proposal mode */
          pathLinePoints.length > 1 && (
            <Line
              points={pathLinePoints}
              color="#3E7C79"
              lineWidth={3}
              dashed
              dashScale={4}
              dashSize={0.4}
              gapSize={0.2}
            />
          )
        )}

        {/* Unexplored Frontier Markers (Teal Pointers) */}
        {unexploredFrontiers.map((f, idx) => (
          <mesh key={`frontier_${idx}`} position={[f[0], f[1] + 0.1, f[2]]}>
            <coneGeometry args={[0.15, 0.4, 8]} />
            <meshStandardMaterial
              color="#3E7C79"
              emissive="#3E7C79"
              emissiveIntensity={1.2}
              wireframe
            />
          </mesh>
        ))}

        {/* 2D Support Polygon & CoM Ground Projection (§1.3).
            Status color (safe/caution/critical) is semantic — green, not
            teal, to keep teal reserved for interactive/selection state. */}
        {showSupportPolygon && stabilityState && (
          <group>
            {polygonPoints.length > 1 && (
              <Line
                points={polygonPoints}
                color={
                  stabilityState.stabilityMargin >= 0.6
                    ? '#2ECC71'
                    : stabilityState.stabilityMargin >= 0.35
                    ? '#D98A2B'
                    : '#C4472F'
                }
                lineWidth={2.5}
              />
            )}

            <mesh position={stabilityState.comGround}>
              <cylinderGeometry args={[0.05, 0.05, 0.01, 16]} />
              <meshBasicMaterial
                color={stabilityState.isInsidePolygon ? '#2ECC71' : '#C4472F'}
              />
            </mesh>
          </group>
        )}

        {/* Procedural Bipedal Robot */}
        <Robot pose={pose} showTargetGizmos={showTargetGizmos} />

        {/* Camera Transition & Orbit Controls (§8) */}
        <CameraRig targetPos={pose.torsoPosition} />

        {/* Telemetry and Frame Metrics Tracker */}
        <SceneMetricsTracker />

        {/* Quality-gated Postprocessing (§1.5, §2, Phase 10) */}
        <Effects />
      </Canvas>
    </div>
  );
}

function CameraRig({ targetPos }: { targetPos: [number, number, number] }) {
  const disassemblyFactor = useMissionStore((state) => state.disassemblyFactor);
  const controlsRef = React.useRef<any>(null);

  useFrame((state, delta) => {
    if (controlsRef.current && disassemblyFactor > 0.05) {
      // Smoothly interpolate orbit target toward robot torso center for engineering inspection
      const curTarget = controlsRef.current.target;
      const targetVec = new THREE.Vector3(targetPos[0], targetPos[1], targetPos[2]);
      curTarget.lerp(targetVec, delta * 3.0);
      controlsRef.current.update();
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      minDistance={1.2}
      maxDistance={50}
      target={[0, 0.9, 0]}
      maxPolarAngle={Math.PI / 2 - 0.02}
    />
  );
}

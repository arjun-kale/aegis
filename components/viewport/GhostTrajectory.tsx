'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as THREE from 'three';
import { Line } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { StagedProposal } from '@/lib/state/missionStore';
import { solveFullBodyKinematics } from '@/lib/robot/kinematics';
import { Robot } from './Robot';

interface GhostTrajectoryProps {
  proposal: StagedProposal | null;
}

/**
 * Ghost Trajectory & One-Bold-Moment Reveal Component (§7, §6)
 *
 * Implements the "one bold moment" on proposal staging:
 * - The trajectory line smoothly draws forward from robot origin through waypoints.
 * - Respects prefers-reduced-motion media query to render instantly if requested.
 * - Renders waypoint rings with stability margin coloring.
 * - Renders a translucent ghost robot at the terminal destination pose.
 */
export function GhostTrajectory({ proposal }: GhostTrajectoryProps) {
  const [revealProgress, setRevealProgress] = useState<number>(1.0);
  const [isReducedMotion, setIsReducedMotion] = useState<boolean>(false);
  const lastProposalIdRef = useRef<string | null>(null);

  // Check prefers-reduced-motion media query
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      setIsReducedMotion(mediaQuery.matches);

      const handler = (e: MediaQueryListEvent) => setIsReducedMotion(e.matches);
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    }
  }, []);

  // Trigger one-time progressive reveal animation whenever a new proposal is staged
  useEffect(() => {
    if (proposal && proposal.id !== lastProposalIdRef.current) {
      lastProposalIdRef.current = proposal.id;
      if (!isReducedMotion) {
        setRevealProgress(0.0);
      } else {
        setRevealProgress(1.0);
      }
    }
  }, [proposal, isReducedMotion]);

  // Animate reveal progress from 0.0 to 1.0 over ~600ms
  useFrame((_, delta) => {
    if (revealProgress < 1.0) {
      setRevealProgress((prev) => Math.min(1.0, prev + delta * 2.2));
    }
  });

  // Extract raw 3D waypoint vectors
  const allPoints = useMemo(() => {
    if (!proposal || proposal.waypoints.length < 2) return [];
    return proposal.waypoints.map((w) => new THREE.Vector3(w.x, (w.y || 0) + 0.04, w.z));
  }, [proposal]);

  // Compute truncated path points according to current revealProgress
  const visiblePoints = useMemo(() => {
    if (allPoints.length < 2) return [];
    if (revealProgress >= 1.0) return allPoints;

    const totalSegments = allPoints.length - 1;
    const targetSegFloat = revealProgress * totalSegments;
    const fullSegsCount = Math.floor(targetSegFloat);
    const fraction = targetSegFloat - fullSegsCount;

    const pts = allPoints.slice(0, fullSegsCount + 1);
    if (fullSegsCount < totalSegments) {
      const p1 = allPoints[fullSegsCount];
      const p2 = allPoints[fullSegsCount + 1];
      const interpolated = p1.clone().lerp(p2, fraction);
      pts.push(interpolated);
    }
    return pts;
  }, [allPoints, revealProgress]);

  // Terminal Pose Ghost Robot Kinematics
  const ghostPose = useMemo(() => {
    if (!proposal || proposal.waypoints.length === 0) return null;
    const lastW = proposal.waypoints[proposal.waypoints.length - 1];
    const prevW =
      proposal.waypoints.length > 1
        ? proposal.waypoints[proposal.waypoints.length - 2]
        : { x: lastW.x, y: lastW.y, z: lastW.z - 1 };

    const dx = lastW.x - prevW.x;
    const dz = lastW.z - prevW.z;
    const heading = Math.atan2(dx, dz);

    const cosH = Math.cos(heading);
    const sinH = Math.sin(heading);
    const rightX = cosH;
    const rightZ = -sinH;
    const footSpacing = 0.14;

    return solveFullBodyKinematics({
      torsoPosition: [lastW.x, (lastW.y || 0) + 0.90, lastW.z],
      torsoRotationEuler: [0, heading, 0],
      footL: [lastW.x - rightX * footSpacing, lastW.y || 0, lastW.z - rightZ * footSpacing],
      footR: [lastW.x + rightX * footSpacing, lastW.y || 0, lastW.z + rightZ * footSpacing],
      headLookAt: [lastW.x + sinH * 3, (lastW.y || 0) + 1.2, lastW.z + cosH * 3],
    });
  }, [proposal]);

  if (!proposal || allPoints.length < 2) return null;

  // Margin color (Teal nominal, Amber cautionary, Red critical)
  const pathColor =
    proposal.predictedMinMargin >= 0.5
      ? '#3E7C79'
      : proposal.predictedMinMargin >= 0.3
      ? '#D98A2B'
      : '#C4472F';

  return (
    <group>
      {/* 1. Animated Trajectory Polyline */}
      {visiblePoints.length > 1 && (
        <Line
          points={visiblePoints}
          color={pathColor}
          lineWidth={4.0}
          dashed
          dashScale={3}
          dashSize={0.5}
          gapSize={0.25}
        />
      )}

      {/* 2. Intermediate Waypoint Rings */}
      {allPoints.map((pt, idx) => {
        if (idx === 0) return null; // Skip start node
        const isTerminal = idx === allPoints.length - 1;

        return (
          <group key={`wp_ring_${idx}`} position={pt}>
            {/* Horizontal Ring */}
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[isTerminal ? 0.35 : 0.18, isTerminal ? 0.45 : 0.24, 24]} />
              <meshBasicMaterial
                color={pathColor}
                side={THREE.DoubleSide}
                transparent
                opacity={isTerminal ? 0.9 : 0.6}
              />
            </mesh>

            {/* Target Waypoint Pulsing Beacon */}
            {isTerminal && (
              <mesh position={[0, 0.4, 0]}>
                <cylinderGeometry args={[0.02, 0.02, 0.8, 8]} />
                <meshBasicMaterial color="#E8E3DA" transparent opacity={0.7} />
              </mesh>
            )}
          </group>
        );
      })}

      {/* 3. Ghost Wireframe Robot at Destination Pose */}
      {ghostPose && (
        <group>
          <Robot pose={ghostPose} showTargetGizmos={false} />
        </group>
      )}
    </group>
  );
}

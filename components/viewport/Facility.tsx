'use client';

import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { FacilityGeometryData } from '@/lib/world/generator';
import { FACILITY_MECHANISMS } from '@/lib/world/mechanisms';
import { MechanismRecord } from '@/lib/state/missionStore';

interface FacilityProps {
  geometryData: FacilityGeometryData;
  mechanismStates: Record<string, MechanismRecord>;
}

const dummyMatrix = new THREE.Matrix4();
const dummyPosition = new THREE.Vector3();
const dummyQuaternion = new THREE.Quaternion();
const dummyScale = new THREE.Vector3();

export function Facility({ geometryData, mechanismStates }: FacilityProps) {
  const { wallTransforms, floorTransforms, rampTransforms, extractionPoint } = geometryData;

  const wallsMeshRef = useRef<THREE.InstancedMesh>(null);
  const floorsMeshRef = useRef<THREE.InstancedMesh>(null);

  // Setup InstancedMesh matrices for Walls
  useEffect(() => {
    if (!wallsMeshRef.current) return;
    const mesh = wallsMeshRef.current;

    wallTransforms.forEach((wt, idx) => {
      dummyPosition.set(wt.position[0], wt.position[1], wt.position[2]);
      dummyQuaternion.set(0, 0, 0, 1);
      dummyScale.set(wt.scale[0], wt.scale[1], wt.scale[2]);
      dummyMatrix.compose(dummyPosition, dummyQuaternion, dummyScale);
      mesh.setMatrixAt(idx, dummyMatrix);
    });

    mesh.instanceMatrix.needsUpdate = true;
  }, [wallTransforms]);

  // Setup InstancedMesh matrices for Floors
  useEffect(() => {
    if (!floorsMeshRef.current) return;
    const mesh = floorsMeshRef.current;

    floorTransforms.forEach((ft, idx) => {
      dummyPosition.set(ft.position[0], ft.position[1], ft.position[2]);
      dummyQuaternion.set(0, 0, 0, 1);
      dummyScale.set(ft.scale[0], ft.scale[1], ft.scale[2]);
      dummyMatrix.compose(dummyPosition, dummyQuaternion, dummyScale);
      mesh.setMatrixAt(idx, dummyMatrix);
    });

    mesh.instanceMatrix.needsUpdate = true;
  }, [floorTransforms]);

  return (
    <group>
      {/* 1. Instanced Walls (1 draw call for all facility walls) */}
      <instancedMesh
        ref={wallsMeshRef}
        args={[undefined, undefined, wallTransforms.length]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color="#1E2226"
          roughness={0.7}
          metalness={0.3}
        />
      </instancedMesh>

      {/* 2. Instanced Floors (1 draw call for all facility floors) */}
      <instancedMesh
        ref={floorsMeshRef}
        args={[undefined, undefined, floorTransforms.length]}
        receiveShadow
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color="#181B1E"
          roughness={0.8}
          metalness={0.2}
        />
      </instancedMesh>

      {/* 3. Incline Ramps */}
      {rampTransforms.map((rt, idx) => (
        <mesh
          key={`ramp_${idx}`}
          position={rt.position}
          rotation={rt.rotation}
          receiveShadow
          castShadow
        >
          <boxGeometry args={rt.scale} />
          <meshStandardMaterial
            color="#262B30"
            roughness={0.6}
            metalness={0.4}
          />
        </mesh>
      ))}

      {/* 4. Facility Mechanisms Rendering */}
      {Object.entries(FACILITY_MECHANISMS).map(([id, def]) => {
        const state = mechanismStates[id]?.state || def.defaultState;
        const isArmed = state === 'ARMED' || state === 'SEALED';

        if (def.type === 'LASER_GATE') {
          return (
            <group key={id} position={def.location}>
              {/* Emitter Pillars */}
              <mesh position={[-def.barrierDimensions[0] / 2, 1.4, 0]} castShadow>
                <boxGeometry args={[0.2, 2.8, 0.3]} />
                <meshStandardMaterial color="#333A42" metalness={0.8} roughness={0.3} />
              </mesh>
              <mesh position={[def.barrierDimensions[0] / 2, 1.4, 0]} castShadow>
                <boxGeometry args={[0.2, 2.8, 0.3]} />
                <meshStandardMaterial color="#333A42" metalness={0.8} roughness={0.3} />
              </mesh>

              {/* Laser Grid Barrier */}
              {isArmed ? (
                <group position={[0, 1.4, 0]}>
                  {/* Glowing Laser Beams */}
                  {[-0.8, -0.4, 0.0, 0.4, 0.8].map((yOff, i) => (
                    <mesh key={i} position={[0, yOff, 0]} rotation={[0, 0, Math.PI / 2]}>
                      <cylinderGeometry
                        args={[0.018, 0.018, def.barrierDimensions[0], 8]}
                      />
                      <meshStandardMaterial
                        color="#C4472F"
                        emissive="#C4472F"
                        emissiveIntensity={2.5}
                      />
                    </mesh>
                  ))}
                </group>
              ) : (
                <group position={[0, 1.4, 0]}>
                  {/* Disarmed Green Indicator Light */}
                  <mesh position={[0, 1.3, 0]}>
                    <sphereGeometry args={[0.06, 12, 12]} />
                    <meshStandardMaterial
                      color="#2ECC71"
                      emissive="#2ECC71"
                      emissiveIntensity={1.8}
                    />
                  </mesh>
                </group>
              )}
            </group>
          );
        }

        if (def.type === 'SEALED_DOOR') {
          return (
            <group key={id} position={def.location}>
              {/* Door Frame */}
              <mesh position={[0, 1.4, 0]} castShadow>
                <boxGeometry args={[0.3, 2.8, isArmed ? 3.8 : 0.4]} />
                <meshStandardMaterial
                  color={isArmed ? '#262B30' : '#3E7C79'}
                  roughness={0.4}
                  metalness={0.8}
                  emissive={isArmed ? '#C4472F' : '#2ECC71'}
                  emissiveIntensity={0.2}
                />
              </mesh>
            </group>
          );
        }

        if (def.type === 'FREIGHT_LIFT') {
          return (
            <group key={id} position={def.location}>
              {/* Lift Platform */}
              <mesh position={[0, state === 'RAISED' ? 2.5 : 0.05, 0]} castShadow receiveShadow>
                <boxGeometry args={def.barrierDimensions} />
                <meshStandardMaterial
                  color="#D98A2B"
                  roughness={0.5}
                  metalness={0.6}
                  emissive="#D98A2B"
                  emissiveIntensity={0.15}
                />
              </mesh>
            </group>
          );
        }

        return null;
      })}

      {/* 5. Extraction Zone Beacon */}
      <group position={extractionPoint}>
        {/* Ground Pad */}
        <mesh position={[0, 0.02, 0]} receiveShadow>
          <cylinderGeometry args={[1.5, 1.5, 0.05, 24]} />
          <meshStandardMaterial
            color="#1E2226"
            emissive="#00E5FF"
            emissiveIntensity={0.4}
            metalness={0.8}
          />
        </mesh>
        {/* Pulsating Extraction Pillar */}
        <mesh position={[0, 1.5, 0]}>
          <cylinderGeometry args={[0.08, 0.08, 3.0, 16]} />
          <meshStandardMaterial
            color="#00E5FF"
            emissive="#00E5FF"
            emissiveIntensity={2.0}
            transparent
            opacity={0.8}
          />
        </mesh>
      </group>
    </group>
  );
}

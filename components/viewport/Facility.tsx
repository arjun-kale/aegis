'use client';

import React, { useRef, useEffect, useMemo } from 'react';
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
const dummyColor = new THREE.Color();

// Deterministic hash (no Math.random) so wall tinting stays stable across
// re-renders and matches the app's seeded-generation approach elsewhere.
function hash(i: number): number {
  const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

// Trim geometry is purely a rendering embellishment — derived straight from
// wallTransforms rather than threaded through generator.ts — so it can never
// desync from the collider/navgrid data those transforms also drive.
const TRIM_PAD = 0.05;
const BASEBOARD_HEIGHT = 0.16;
const CAP_HEIGHT = 0.08;

export function Facility({ geometryData, mechanismStates }: FacilityProps) {
  const { wallTransforms, floorTransforms, rampTransforms, extractionPoint } = geometryData;

  const wallsMeshRef = useRef<THREE.InstancedMesh>(null);
  const floorsMeshRef = useRef<THREE.InstancedMesh>(null);
  const baseboardMeshRef = useRef<THREE.InstancedMesh>(null);
  const capMeshRef = useRef<THREE.InstancedMesh>(null);

  // Baseboard (grounding shadow line) + accent cap (technical trim, tying
  // into the facility's teal accent used elsewhere) for every wall segment —
  // two extra instanced draw calls total, independent of wall count.
  const trimTransforms = useMemo(() => {
    const baseboards: { position: [number, number, number]; scale: [number, number, number] }[] = [];
    const caps: { position: [number, number, number]; scale: [number, number, number] }[] = [];

    wallTransforms.forEach((wt) => {
      const [w, h, d] = wt.scale;
      const [x, y, z] = wt.position;
      const bottom = y - h / 2;
      const top = y + h / 2;

      baseboards.push({
        position: [x, bottom + BASEBOARD_HEIGHT / 2, z],
        scale: [w + TRIM_PAD, BASEBOARD_HEIGHT, d + TRIM_PAD],
      });
      caps.push({
        position: [x, top - CAP_HEIGHT / 2, z],
        scale: [w + TRIM_PAD, CAP_HEIGHT, d + TRIM_PAD],
      });
    });

    return { baseboards, caps };
  }, [wallTransforms]);

  // Setup InstancedMesh matrices + a subtle per-instance tint for Walls —
  // breaks up the flat, uniform slab look without any texture/asset loading.
  useEffect(() => {
    if (!wallsMeshRef.current) return;
    const mesh = wallsMeshRef.current;

    wallTransforms.forEach((wt, idx) => {
      dummyPosition.set(wt.position[0], wt.position[1], wt.position[2]);
      dummyQuaternion.set(0, 0, 0, 1);
      dummyScale.set(wt.scale[0], wt.scale[1], wt.scale[2]);
      dummyMatrix.compose(dummyPosition, dummyQuaternion, dummyScale);
      mesh.setMatrixAt(idx, dummyMatrix);

      const tint = 0.96 + hash(idx) * 0.07;
      dummyColor.setScalar(tint);
      mesh.setColorAt(idx, dummyColor);
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [wallTransforms]);

  // Setup InstancedMesh matrices for baseboards & accent caps
  useEffect(() => {
    if (!baseboardMeshRef.current || !capMeshRef.current) return;
    const baseboardMesh = baseboardMeshRef.current;
    const capMesh = capMeshRef.current;

    trimTransforms.baseboards.forEach((bt, idx) => {
      dummyPosition.set(bt.position[0], bt.position[1], bt.position[2]);
      dummyQuaternion.set(0, 0, 0, 1);
      dummyScale.set(bt.scale[0], bt.scale[1], bt.scale[2]);
      dummyMatrix.compose(dummyPosition, dummyQuaternion, dummyScale);
      baseboardMesh.setMatrixAt(idx, dummyMatrix);
    });
    baseboardMesh.instanceMatrix.needsUpdate = true;

    trimTransforms.caps.forEach((ct, idx) => {
      dummyPosition.set(ct.position[0], ct.position[1], ct.position[2]);
      dummyQuaternion.set(0, 0, 0, 1);
      dummyScale.set(ct.scale[0], ct.scale[1], ct.scale[2]);
      dummyMatrix.compose(dummyPosition, dummyQuaternion, dummyScale);
      capMesh.setMatrixAt(idx, dummyMatrix);
    });
    capMesh.instanceMatrix.needsUpdate = true;
  }, [trimTransforms]);

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
      {/* 1. Instanced Walls (1 draw call for all facility walls). Physical
          material picks up a faint clearcoat so panels catch the key light
          with a slight sheen instead of reading as flat matte slabs; the
          per-instance tint set in the matrices effect above breaks up
          large runs of wall into distinguishable panels. */}
      <instancedMesh
        ref={wallsMeshRef}
        args={[undefined, undefined, wallTransforms.length]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshPhysicalMaterial
          color="#EAEDF1"
          roughness={0.72}
          metalness={0.15}
          clearcoat={0.15}
          clearcoatRoughness={0.6}
        />
      </instancedMesh>

      {/* 1b. Baseboard trim — a dark, more metallic strip along the base of
          every wall to seat it against the floor with a real shadow line,
          rather than the wall appearing to float on the floor slab. */}
      <instancedMesh
        ref={baseboardMeshRef}
        args={[undefined, undefined, trimTransforms.baseboards.length]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#4B535B" roughness={0.5} metalness={0.55} />
      </instancedMesh>

      {/* 1c. Accent cap trim — thin teal strip along the top of every wall,
          echoing the facility's one deliberate accent color (nav grid,
          rim light, trajectory lines) so the architecture reads as the
          same designed system as the HUD/overlays. */}
      <instancedMesh
        ref={capMeshRef}
        args={[undefined, undefined, trimTransforms.caps.length]}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color="#3E7C79"
          emissive="#3E7C79"
          emissiveIntensity={0.35}
          roughness={0.4}
          metalness={0.3}
        />
      </instancedMesh>

      {/* 2. Instanced Floors (1 draw call for all facility floors) — a
          touch darker than the walls to ground the scene, per a light
          architectural-viz convention. */}
      <instancedMesh
        ref={floorsMeshRef}
        args={[undefined, undefined, floorTransforms.length]}
        receiveShadow
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshPhysicalMaterial
          color="#D6DBE1"
          roughness={0.8}
          metalness={0.1}
          clearcoat={0.08}
          clearcoatRoughness={0.7}
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
            color="#C7CCD3"
            roughness={0.6}
            metalness={0.25}
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
                  color="#262B30"
                  roughness={0.4}
                  metalness={0.8}
                  emissive={isArmed ? '#C4472F' : '#2ECC71'}
                  emissiveIntensity={0.25}
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

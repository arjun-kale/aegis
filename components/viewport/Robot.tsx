'use client';

import React, { useMemo } from 'react';
import * as THREE from 'three';
import { ROBOT_RIG } from '@/lib/robot/rig';
import { FullBodyKinematicState } from '@/lib/robot/kinematics';

interface RobotProps {
  pose: FullBodyKinematicState;
  showTargetGizmos?: boolean;
}

/**
 * Procedural Bipedal Robot Component (§1.2)
 *
 * Hard-surface primitive hierarchy constructed from ROBOT_RIG data and driven
 * directly by analytical IK solutions. No external rigged GLTF loader in critical path.
 */
export function Robot({ pose, showTargetGizmos = false }: RobotProps) {
  const { torsoPosition, torsoRotationEuler, legL, legR, armL, armR, headAngles } = pose;

  // Helper to build rotation matrix/quaternion pointing from A to B
  const getBoneOrientation = (
    from: [number, number, number],
    to: [number, number, number],
    up: [number, number, number] = [0, 0, 1]
  ) => {
    const dir = new THREE.Vector3(to[0] - from[0], to[1] - from[1], to[2] - from[2]).normalize();
    const upVec = new THREE.Vector3(up[0], up[1], up[2]);
    const matrix = new THREE.Matrix4();
    const right = new THREE.Vector3().crossVectors(dir, upVec).normalize();
    const correctedUp = new THREE.Vector3().crossVectors(right, dir).normalize();

    // Align local Y-axis (downwards) with dir
    matrix.makeBasis(right, dir.clone().negate(), correctedUp);
    const quat = new THREE.Quaternion().setFromRotationMatrix(matrix);
    return quat;
  };

  const legLUpperQuat = useMemo(() => getBoneOrientation(legL.root, legL.mid, [0, 0, 1]), [legL]);
  const legLLowerQuat = useMemo(() => getBoneOrientation(legL.mid, legL.end, [0, 0, 1]), [legL]);

  const legRUpperQuat = useMemo(() => getBoneOrientation(legR.root, legR.mid, [0, 0, 1]), [legR]);
  const legRLowerQuat = useMemo(() => getBoneOrientation(legR.mid, legR.end, [0, 0, 1]), [legR]);

  const armLUpperQuat = useMemo(() => getBoneOrientation(armL.root, armL.mid, [0, 0, -1]), [armL]);
  const armLLowerQuat = useMemo(() => getBoneOrientation(armL.mid, armL.end, [0, 0, -1]), [armL]);

  const armRUpperQuat = useMemo(() => getBoneOrientation(armR.root, armR.mid, [0, 0, -1]), [armR]);
  const armRLowerQuat = useMemo(() => getBoneOrientation(armR.mid, armR.end, [0, 0, -1]), [armR]);

  return (
    <group>
      {/* --- TORSO & CHASSIS --- */}
      <group
        position={torsoPosition}
        rotation={torsoRotationEuler}
      >
        {/* Main Torso Block */}
        <mesh castShadow receiveShadow>
          <boxGeometry args={ROBOT_RIG.parts.torso.dimensions} />
          <meshStandardMaterial
            color="#262B30"
            roughness={0.35}
            metalness={0.65}
          />
        </mesh>

        {/* Chest Armor Plate */}
        <mesh position={[0, 0.04, 0.115]} castShadow receiveShadow>
          <boxGeometry args={[0.26, 0.24, 0.02]} />
          <meshStandardMaterial
            color="#1E2226"
            roughness={0.3}
            metalness={0.8}
            emissive="#3E7C79"
            emissiveIntensity={0.15}
          />
        </mesh>

        {/* Power Core LED Reactor */}
        <mesh position={[0, 0.04, 0.128]}>
          <cylinderGeometry args={[0.035, 0.035, 0.01, 16]} />
          <meshStandardMaterial
            color="#00E5FF"
            emissive="#00E5FF"
            emissiveIntensity={1.2}
          />
        </mesh>

        {/* Sensor Head */}
        <group
          position={ROBOT_RIG.parts.head.offsetFromParent}
          rotation={[headAngles.pitch, headAngles.yaw, 0]}
        >
          <mesh castShadow receiveShadow>
            <boxGeometry args={ROBOT_RIG.parts.head.dimensions} />
            <meshStandardMaterial
              color="#1E2226"
              roughness={0.25}
              metalness={0.85}
            />
          </mesh>
          {/* Visor / Optical Bar */}
          <mesh position={[0, 0.01, 0.092]}>
            <boxGeometry args={[0.13, 0.025, 0.01]} />
            <meshStandardMaterial
              color="#00E5FF"
              emissive="#00E5FF"
              emissiveIntensity={1.5}
            />
          </mesh>
        </group>

        {/* Hip Joint Mount Spheres */}
        <mesh position={ROBOT_RIG.parts.hip_l.offsetFromParent} castShadow>
          <sphereGeometry args={[0.055, 16, 16]} />
          <meshStandardMaterial color="#4A525D" metalness={0.8} roughness={0.3} />
        </mesh>
        <mesh position={ROBOT_RIG.parts.hip_r.offsetFromParent} castShadow>
          <sphereGeometry args={[0.055, 16, 16]} />
          <meshStandardMaterial color="#4A525D" metalness={0.8} roughness={0.3} />
        </mesh>

        {/* Shoulder Joint Mount Spheres */}
        <mesh position={ROBOT_RIG.parts.shoulder_l.offsetFromParent} castShadow>
          <sphereGeometry args={[0.048, 16, 16]} />
          <meshStandardMaterial color="#4A525D" metalness={0.8} roughness={0.3} />
        </mesh>
        <mesh position={ROBOT_RIG.parts.shoulder_r.offsetFromParent} castShadow>
          <sphereGeometry args={[0.048, 16, 16]} />
          <meshStandardMaterial color="#4A525D" metalness={0.8} roughness={0.3} />
        </mesh>
      </group>

      {/* --- LEFT LEG --- */}
      {/* Thigh L */}
      <group position={legL.root} quaternion={legLUpperQuat}>
        <mesh position={[0, -ROBOT_RIG.limbs.legL.l1 / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.10, ROBOT_RIG.limbs.legL.l1, 0.11]} />
          <meshStandardMaterial color="#262B30" metalness={0.6} roughness={0.4} />
        </mesh>
      </group>

      {/* Knee L Joint Sphere */}
      <mesh position={legL.mid} castShadow>
        <sphereGeometry args={[0.052, 16, 16]} />
        <meshStandardMaterial
          color="#4A525D"
          metalness={0.85}
          roughness={0.25}
          emissive="#D98A2B"
          emissiveIntensity={0.2}
        />
      </mesh>

      {/* Shin L */}
      <group position={legL.mid} quaternion={legLLowerQuat}>
        <mesh position={[0, -ROBOT_RIG.limbs.legL.l2 / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.085, ROBOT_RIG.limbs.legL.l2, 0.095]} />
          <meshStandardMaterial color="#1E2226" metalness={0.65} roughness={0.35} />
        </mesh>
      </group>

      {/* Foot L Plate */}
      <group position={legL.end}>
        <mesh position={[0, 0.025, 0.03]} castShadow receiveShadow>
          <boxGeometry args={ROBOT_RIG.parts.foot_l.dimensions} />
          <meshStandardMaterial
            color="#14171A"
            metalness={0.9}
            roughness={0.2}
            emissive="#00E5FF"
            emissiveIntensity={0.15}
          />
        </mesh>
      </group>

      {/* --- RIGHT LEG --- */}
      {/* Thigh R */}
      <group position={legR.root} quaternion={legRUpperQuat}>
        <mesh position={[0, -ROBOT_RIG.limbs.legR.l1 / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.10, ROBOT_RIG.limbs.legR.l1, 0.11]} />
          <meshStandardMaterial color="#262B30" metalness={0.6} roughness={0.4} />
        </mesh>
      </group>

      {/* Knee R Joint Sphere */}
      <mesh position={legR.mid} castShadow>
        <sphereGeometry args={[0.052, 16, 16]} />
        <meshStandardMaterial
          color="#4A525D"
          metalness={0.85}
          roughness={0.25}
          emissive="#D98A2B"
          emissiveIntensity={0.2}
        />
      </mesh>

      {/* Shin R */}
      <group position={legR.mid} quaternion={legRLowerQuat}>
        <mesh position={[0, -ROBOT_RIG.limbs.legR.l2 / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.085, ROBOT_RIG.limbs.legR.l2, 0.095]} />
          <meshStandardMaterial color="#1E2226" metalness={0.65} roughness={0.35} />
        </mesh>
      </group>

      {/* Foot R Plate */}
      <group position={legR.end}>
        <mesh position={[0, 0.025, 0.03]} castShadow receiveShadow>
          <boxGeometry args={ROBOT_RIG.parts.foot_r.dimensions} />
          <meshStandardMaterial
            color="#14171A"
            metalness={0.9}
            roughness={0.2}
            emissive="#00E5FF"
            emissiveIntensity={0.15}
          />
        </mesh>
      </group>

      {/* --- LEFT ARM --- */}
      {/* Upper Arm L */}
      <group position={armL.root} quaternion={armLUpperQuat}>
        <mesh position={[0, -ROBOT_RIG.limbs.armL.l1 / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.075, ROBOT_RIG.limbs.armL.l1, 0.075]} />
          <meshStandardMaterial color="#262B30" metalness={0.6} roughness={0.4} />
        </mesh>
      </group>

      {/* Elbow L */}
      <mesh position={armL.mid} castShadow>
        <sphereGeometry args={[0.042, 16, 16]} />
        <meshStandardMaterial color="#4A525D" metalness={0.8} roughness={0.3} />
      </mesh>

      {/* Forearm L */}
      <group position={armL.mid} quaternion={armLLowerQuat}>
        <mesh position={[0, -ROBOT_RIG.limbs.armL.l2 / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.065, ROBOT_RIG.limbs.armL.l2, 0.065]} />
          <meshStandardMaterial color="#1E2226" metalness={0.65} roughness={0.35} />
        </mesh>
      </group>

      {/* Hand L Gripper */}
      <mesh position={armL.end} castShadow>
        <boxGeometry args={ROBOT_RIG.parts.hand_l.dimensions} />
        <meshStandardMaterial color="#333A42" metalness={0.8} roughness={0.3} />
      </mesh>

      {/* --- RIGHT ARM --- */}
      {/* Upper Arm R */}
      <group position={armR.root} quaternion={armRUpperQuat}>
        <mesh position={[0, -ROBOT_RIG.limbs.armR.l1 / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.075, ROBOT_RIG.limbs.armR.l1, 0.075]} />
          <meshStandardMaterial color="#262B30" metalness={0.6} roughness={0.4} />
        </mesh>
      </group>

      {/* Elbow R */}
      <mesh position={armR.mid} castShadow>
        <sphereGeometry args={[0.042, 16, 16]} />
        <meshStandardMaterial color="#4A525D" metalness={0.8} roughness={0.3} />
      </mesh>

      {/* Forearm R */}
      <group position={armR.mid} quaternion={armRLowerQuat}>
        <mesh position={[0, -ROBOT_RIG.limbs.armR.l2 / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.065, ROBOT_RIG.limbs.armR.l2, 0.065]} />
          <meshStandardMaterial color="#1E2226" metalness={0.65} roughness={0.35} />
        </mesh>
      </group>

      {/* Hand R Gripper */}
      <mesh position={armR.end} castShadow>
        <boxGeometry args={ROBOT_RIG.parts.hand_r.dimensions} />
        <meshStandardMaterial color="#333A42" metalness={0.8} roughness={0.3} />
      </mesh>

      {/* --- TARGET GIZMOS (DEV MODE) --- */}
      {showTargetGizmos && (
        <>
          <mesh position={legL.end}>
            <sphereGeometry args={[0.035, 12, 12]} />
            <meshBasicMaterial color="#00E5FF" wireframe />
          </mesh>
          <mesh position={legR.end}>
            <sphereGeometry args={[0.035, 12, 12]} />
            <meshBasicMaterial color="#00E5FF" wireframe />
          </mesh>
        </>
      )}
    </group>
  );
}

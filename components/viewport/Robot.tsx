'use client';

import React, { useMemo } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { ROBOT_RIG } from '@/lib/robot/rig';
import { FullBodyKinematicState } from '@/lib/robot/kinematics';
import { useMissionStore } from '@/lib/state/missionStore';
import { readTelemetry } from '@/lib/state/telemetryBus';
import { TELEMETRY_OFFSETS } from '@/lib/state/telemetryOffsets';

interface RobotProps {
  pose: FullBodyKinematicState;
  showTargetGizmos?: boolean;
}

/**
 * Procedural Bipedal Robot Component (§1.2, §8)
 *
 * Hard-surface primitive hierarchy constructed from ROBOT_RIG data and driven
 * directly by analytical IK solutions.
 * Supports smooth outward exploded engineering view (§8) with live joint stress visualization.
 */
export function Robot({ pose, showTargetGizmos = false }: RobotProps) {
  const { torsoPosition, torsoRotationEuler, legL, legR, armL, armR, headRotationEuler } = pose;
  const disassemblyFactor = useMissionStore((state) => state.disassemblyFactor);

  // Read joint torques for dynamic stress visualization (§8)
  const torques = readTelemetry(TELEMETRY_OFFSETS.TORQUES_START, 6);
  const torqueKneeL = torques[1] || 0;
  const torqueKneeR = torques[4] || 0;
  const torqueHipL = torques[0] || 0;
  const torqueHipR = torques[3] || 0;

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

  // Precomputed outward displacement vectors (§8)
  const df = disassemblyFactor;
  const dispHead: [number, number, number] = [0, 0.45 * df, 0.15 * df];
  const dispChest: [number, number, number] = [0, 0.05 * df, 0.35 * df];

  const dispHipL: [number, number, number] = [-0.30 * df, -0.05 * df, 0];
  const dispThighL: [number, number, number] = [-0.40 * df, -0.08 * df, 0];
  const dispKneeL: [number, number, number] = [-0.50 * df, -0.12 * df, 0];
  const dispShinL: [number, number, number] = [-0.60 * df, -0.16 * df, 0];
  const dispFootL: [number, number, number] = [-0.70 * df, -0.20 * df, 0.05 * df];

  const dispHipR: [number, number, number] = [0.30 * df, -0.05 * df, 0];
  const dispThighR: [number, number, number] = [0.40 * df, -0.08 * df, 0];
  const dispKneeR: [number, number, number] = [0.50 * df, -0.12 * df, 0];
  const dispShinR: [number, number, number] = [0.60 * df, -0.16 * df, 0];
  const dispFootR: [number, number, number] = [0.70 * df, -0.20 * df, 0.05 * df];

  const dispShoulderL: [number, number, number] = [-0.25 * df, 0.20 * df, 0];
  const dispUpperArmL: [number, number, number] = [-0.40 * df, 0.25 * df, 0];
  const dispElbowL: [number, number, number] = [-0.50 * df, 0.30 * df, 0];
  const dispForearmL: [number, number, number] = [-0.60 * df, 0.35 * df, 0];
  const dispHandL: [number, number, number] = [-0.70 * df, 0.40 * df, 0.05 * df];

  const dispShoulderR: [number, number, number] = [0.25 * df, 0.20 * df, 0];
  const dispUpperArmR: [number, number, number] = [0.40 * df, 0.25 * df, 0];
  const dispElbowR: [number, number, number] = [0.50 * df, 0.30 * df, 0];
  const dispForearmR: [number, number, number] = [0.60 * df, 0.35 * df, 0];
  const dispHandR: [number, number, number] = [0.70 * df, 0.40 * df, 0.05 * df];

  // Stress-based emissive color interpolation
  const getStressEmissive = (torque: number, rated: number = 220) => {
    const ratio = torque / rated;
    if (ratio >= 0.8) return { color: '#C4472F', intensity: 1.5 };
    if (ratio >= 0.5) return { color: '#D98A2B', intensity: 0.9 };
    return { color: '#3E7C79', intensity: 0.2 };
  };

  const kneeLStress = getStressEmissive(torqueKneeL, ROBOT_RIG.parts.knee_l.ratedTorqueNm);
  const kneeRStress = getStressEmissive(torqueKneeR, ROBOT_RIG.parts.knee_r.ratedTorqueNm);
  const hipLStress = getStressEmissive(torqueHipL, ROBOT_RIG.parts.hip_l.ratedTorqueNm);
  const hipRStress = getStressEmissive(torqueHipR, ROBOT_RIG.parts.hip_r.ratedTorqueNm);

  return (
    <group>
      {/* --- TORSO & CHASSIS --- */}
      <group position={torsoPosition} rotation={torsoRotationEuler}>
        {/* Main Torso Block */}
        <mesh castShadow receiveShadow>
          <boxGeometry args={ROBOT_RIG.parts.torso.dimensions} />
          <meshStandardMaterial color="#262B30" roughness={0.35} metalness={0.65} />
        </mesh>

        {/* Chest Armor Plate (Displaces forward in exploded view) */}
        <mesh
          position={[dispChest[0], 0.04 + dispChest[1], 0.115 + dispChest[2]]}
          castShadow
          receiveShadow
        >
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
        <mesh position={[dispChest[0], 0.04 + dispChest[1], 0.128 + dispChest[2]]}>
          <cylinderGeometry args={[0.035, 0.035, 0.01, 16]} />
          <meshStandardMaterial color="#3E7C79" emissive="#3E7C79" emissiveIntensity={1.2} />
        </mesh>

        {/* Sensor Head (Displaces up and forward) */}
        <group
          position={[
            ROBOT_RIG.parts.head.offsetFromParent[0] + dispHead[0],
            ROBOT_RIG.parts.head.offsetFromParent[1] + dispHead[1],
            ROBOT_RIG.parts.head.offsetFromParent[2] + dispHead[2],
          ]}
          rotation={headRotationEuler}
        >
          <mesh castShadow receiveShadow>
            <boxGeometry args={ROBOT_RIG.parts.head.dimensions} />
            <meshStandardMaterial color="#1E2226" roughness={0.25} metalness={0.85} />
          </mesh>
          {/* Visor / Optical Bar */}
          <mesh position={[0, 0.01, 0.092]}>
            <boxGeometry args={[0.13, 0.025, 0.01]} />
            <meshStandardMaterial color="#3E7C79" emissive="#3E7C79" emissiveIntensity={1.5} />
          </mesh>

          {/* Billboarded Label in Exploded View */}
          {df >= 0.25 && (
            <Html position={[0, 0.22, 0]} center distanceFactor={12}>
              <div className="bg-[#14171A]/90 border border-[#262B30] text-[#E8E3DA] font-mono text-[9px] px-1.5 py-0.5 whitespace-nowrap pointer-events-none select-none shadow">
                <span className="text-accent-teal font-bold">LIDAR / OPTICS</span> [75°C]
              </div>
            </Html>
          )}
        </group>

        {/* Hip Joint Mount Spheres */}
        <mesh
          position={[
            ROBOT_RIG.parts.hip_l.offsetFromParent[0] + dispHipL[0],
            ROBOT_RIG.parts.hip_l.offsetFromParent[1] + dispHipL[1],
            ROBOT_RIG.parts.hip_l.offsetFromParent[2] + dispHipL[2],
          ]}
          castShadow
        >
          <sphereGeometry args={[0.055, 16, 16]} />
          <meshStandardMaterial
            color="#4A525D"
            metalness={0.8}
            roughness={0.3}
            emissive={hipLStress.color}
            emissiveIntensity={hipLStress.intensity}
          />
        </mesh>
        <mesh
          position={[
            ROBOT_RIG.parts.hip_r.offsetFromParent[0] + dispHipR[0],
            ROBOT_RIG.parts.hip_r.offsetFromParent[1] + dispHipR[1],
            ROBOT_RIG.parts.hip_r.offsetFromParent[2] + dispHipR[2],
          ]}
          castShadow
        >
          <sphereGeometry args={[0.055, 16, 16]} />
          <meshStandardMaterial
            color="#4A525D"
            metalness={0.8}
            roughness={0.3}
            emissive={hipRStress.color}
            emissiveIntensity={hipRStress.intensity}
          />
        </mesh>

        {/* Shoulder Joint Mount Spheres */}
        <mesh
          position={[
            ROBOT_RIG.parts.shoulder_l.offsetFromParent[0] + dispShoulderL[0],
            ROBOT_RIG.parts.shoulder_l.offsetFromParent[1] + dispShoulderL[1],
            ROBOT_RIG.parts.shoulder_l.offsetFromParent[2] + dispShoulderL[2],
          ]}
          castShadow
        >
          <sphereGeometry args={[0.048, 16, 16]} />
          <meshStandardMaterial color="#4A525D" metalness={0.8} roughness={0.3} />
        </mesh>
        <mesh
          position={[
            ROBOT_RIG.parts.shoulder_r.offsetFromParent[0] + dispShoulderR[0],
            ROBOT_RIG.parts.shoulder_r.offsetFromParent[1] + dispShoulderR[1],
            ROBOT_RIG.parts.shoulder_r.offsetFromParent[2] + dispShoulderR[2],
          ]}
          castShadow
        >
          <sphereGeometry args={[0.048, 16, 16]} />
          <meshStandardMaterial color="#4A525D" metalness={0.8} roughness={0.3} />
        </mesh>
      </group>

      {/* --- LEFT LEG --- */}
      {/* Thigh L */}
      <group
        position={[
          legL.root[0] + dispThighL[0],
          legL.root[1] + dispThighL[1],
          legL.root[2] + dispThighL[2],
        ]}
        quaternion={legLUpperQuat}
      >
        <mesh position={[0, -ROBOT_RIG.limbs.legL.l1 / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.10, ROBOT_RIG.limbs.legL.l1, 0.11]} />
          <meshStandardMaterial color="#262B30" metalness={0.6} roughness={0.4} />
        </mesh>
      </group>

      {/* Knee L Joint Sphere */}
      <mesh
        position={[
          legL.mid[0] + dispKneeL[0],
          legL.mid[1] + dispKneeL[1],
          legL.mid[2] + dispKneeL[2],
        ]}
        castShadow
      >
        <sphereGeometry args={[0.052, 16, 16]} />
        <meshStandardMaterial
          color="#4A525D"
          metalness={0.85}
          roughness={0.25}
          emissive={kneeLStress.color}
          emissiveIntensity={kneeLStress.intensity}
        />
        {df >= 0.25 && (
          <Html position={[0, 0.15, 0]} center distanceFactor={12}>
            <div className="bg-[#14171A]/90 border border-[#262B30] text-[#E8E3DA] font-mono text-[9px] px-1.5 py-0.5 whitespace-nowrap pointer-events-none select-none shadow">
              <span className="text-accent-amber font-bold">KNEE_L</span> [{torqueKneeL.toFixed(0)} N·m]
            </div>
          </Html>
        )}
      </mesh>

      {/* Shin L */}
      <group
        position={[
          legL.mid[0] + dispShinL[0],
          legL.mid[1] + dispShinL[1],
          legL.mid[2] + dispShinL[2],
        ]}
        quaternion={legLLowerQuat}
      >
        <mesh position={[0, -ROBOT_RIG.limbs.legL.l2 / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.085, ROBOT_RIG.limbs.legL.l2, 0.095]} />
          <meshStandardMaterial color="#1E2226" metalness={0.65} roughness={0.35} />
        </mesh>
      </group>

      {/* Foot L Plate */}
      <group
        position={[
          legL.end[0] + dispFootL[0],
          legL.end[1] + dispFootL[1],
          legL.end[2] + dispFootL[2],
        ]}
      >
        <mesh position={[0, 0.025, 0.03]} castShadow receiveShadow>
          <boxGeometry args={ROBOT_RIG.parts.foot_l.dimensions} />
          <meshStandardMaterial
            color="#14171A"
            metalness={0.9}
            roughness={0.2}
            emissive="#3E7C79"
            emissiveIntensity={0.15}
          />
        </mesh>
      </group>

      {/* --- RIGHT LEG --- */}
      {/* Thigh R */}
      <group
        position={[
          legR.root[0] + dispThighR[0],
          legR.root[1] + dispThighR[1],
          legR.root[2] + dispThighR[2],
        ]}
        quaternion={legRUpperQuat}
      >
        <mesh position={[0, -ROBOT_RIG.limbs.legR.l1 / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.10, ROBOT_RIG.limbs.legR.l1, 0.11]} />
          <meshStandardMaterial color="#262B30" metalness={0.6} roughness={0.4} />
        </mesh>
      </group>

      {/* Knee R Joint Sphere */}
      <mesh
        position={[
          legR.mid[0] + dispKneeR[0],
          legR.mid[1] + dispKneeR[1],
          legR.mid[2] + dispKneeR[2],
        ]}
        castShadow
      >
        <sphereGeometry args={[0.052, 16, 16]} />
        <meshStandardMaterial
          color="#4A525D"
          metalness={0.85}
          roughness={0.25}
          emissive={kneeRStress.color}
          emissiveIntensity={kneeRStress.intensity}
        />
        {df >= 0.25 && (
          <Html position={[0, 0.15, 0]} center distanceFactor={12}>
            <div className="bg-[#14171A]/90 border border-[#262B30] text-[#E8E3DA] font-mono text-[9px] px-1.5 py-0.5 whitespace-nowrap pointer-events-none select-none shadow">
              <span className="text-accent-amber font-bold">KNEE_R</span> [{torqueKneeR.toFixed(0)} N·m]
            </div>
          </Html>
        )}
      </mesh>

      {/* Shin R */}
      <group
        position={[
          legR.mid[0] + dispShinR[0],
          legR.mid[1] + dispShinR[1],
          legR.mid[2] + dispShinR[2],
        ]}
        quaternion={legRLowerQuat}
      >
        <mesh position={[0, -ROBOT_RIG.limbs.legR.l2 / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.085, ROBOT_RIG.limbs.legR.l2, 0.095]} />
          <meshStandardMaterial color="#1E2226" metalness={0.65} roughness={0.35} />
        </mesh>
      </group>

      {/* Foot R Plate */}
      <group
        position={[
          legR.end[0] + dispFootR[0],
          legR.end[1] + dispFootR[1],
          legR.end[2] + dispFootR[2],
        ]}
      >
        <mesh position={[0, 0.025, 0.03]} castShadow receiveShadow>
          <boxGeometry args={ROBOT_RIG.parts.foot_r.dimensions} />
          <meshStandardMaterial
            color="#14171A"
            metalness={0.9}
            roughness={0.2}
            emissive="#3E7C79"
            emissiveIntensity={0.15}
          />
        </mesh>
      </group>

      {/* --- LEFT ARM --- */}
      {/* Upper Arm L */}
      <group
        position={[
          armL.root[0] + dispUpperArmL[0],
          armL.root[1] + dispUpperArmL[1],
          armL.root[2] + dispUpperArmL[2],
        ]}
        quaternion={armLUpperQuat}
      >
        <mesh position={[0, -ROBOT_RIG.limbs.armL.l1 / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.075, ROBOT_RIG.limbs.armL.l1, 0.075]} />
          <meshStandardMaterial color="#262B30" metalness={0.6} roughness={0.4} />
        </mesh>
      </group>

      {/* Elbow L */}
      <mesh
        position={[
          armL.mid[0] + dispElbowL[0],
          armL.mid[1] + dispElbowL[1],
          armL.mid[2] + dispElbowL[2],
        ]}
        castShadow
      >
        <sphereGeometry args={[0.042, 16, 16]} />
        <meshStandardMaterial color="#4A525D" metalness={0.8} roughness={0.3} />
      </mesh>

      {/* Forearm L */}
      <group
        position={[
          armL.mid[0] + dispForearmL[0],
          armL.mid[1] + dispForearmL[1],
          armL.mid[2] + dispForearmL[2],
        ]}
        quaternion={armLLowerQuat}
      >
        <mesh position={[0, -ROBOT_RIG.limbs.armL.l2 / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.065, ROBOT_RIG.limbs.armL.l2, 0.065]} />
          <meshStandardMaterial color="#1E2226" metalness={0.65} roughness={0.35} />
        </mesh>
      </group>

      {/* Hand L Gripper */}
      <mesh
        position={[
          armL.end[0] + dispHandL[0],
          armL.end[1] + dispHandL[1],
          armL.end[2] + dispHandL[2],
        ]}
        castShadow
      >
        <boxGeometry args={ROBOT_RIG.parts.hand_l.dimensions} />
        <meshStandardMaterial color="#333A42" metalness={0.8} roughness={0.3} />
      </mesh>

      {/* --- RIGHT ARM --- */}
      {/* Upper Arm R */}
      <group
        position={[
          armR.root[0] + dispUpperArmR[0],
          armR.root[1] + dispUpperArmR[1],
          armR.root[2] + dispUpperArmR[2],
        ]}
        quaternion={armRUpperQuat}
      >
        <mesh position={[0, -ROBOT_RIG.limbs.armR.l1 / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.075, ROBOT_RIG.limbs.armR.l1, 0.075]} />
          <meshStandardMaterial color="#262B30" metalness={0.6} roughness={0.4} />
        </mesh>
      </group>

      {/* Elbow R */}
      <mesh
        position={[
          armR.mid[0] + dispElbowR[0],
          armR.mid[1] + dispElbowR[1],
          armR.mid[2] + dispElbowR[2],
        ]}
        castShadow
      >
        <sphereGeometry args={[0.042, 16, 16]} />
        <meshStandardMaterial color="#4A525D" metalness={0.8} roughness={0.3} />
      </mesh>

      {/* Forearm R */}
      <group
        position={[
          armR.mid[0] + dispForearmR[0],
          armR.mid[1] + dispForearmR[1],
          armR.mid[2] + dispForearmR[2],
        ]}
        quaternion={armRLowerQuat}
      >
        <mesh position={[0, -ROBOT_RIG.limbs.armR.l2 / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.065, ROBOT_RIG.limbs.armR.l2, 0.065]} />
          <meshStandardMaterial color="#1E2226" metalness={0.65} roughness={0.35} />
        </mesh>
      </group>

      {/* Hand R Gripper */}
      <mesh
        position={[
          armR.end[0] + dispHandR[0],
          armR.end[1] + dispHandR[1],
          armR.end[2] + dispHandR[2],
        ]}
        castShadow
      >
        <boxGeometry args={ROBOT_RIG.parts.hand_r.dimensions} />
        <meshStandardMaterial color="#333A42" metalness={0.8} roughness={0.3} />
      </mesh>

      {/* --- TARGET GIZMOS (DEV MODE) --- */}
      {showTargetGizmos && (
        <>
          <mesh position={legL.end}>
            <sphereGeometry args={[0.035, 12, 12]} />
            <meshBasicMaterial color="#3E7C79" wireframe />
          </mesh>
          <mesh position={legR.end}>
            <sphereGeometry args={[0.035, 12, 12]} />
            <meshBasicMaterial color="#3E7C79" wireframe />
          </mesh>
        </>
      )}
    </group>
  );
}

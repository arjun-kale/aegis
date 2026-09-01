/**
 * Project A.E.G.I.S — Robot Mechanical Rig & Hierarchy Specification (§1.2, §2)
 *
 * Defines the complete procedural joint tree, link dimensions, masses,
 * segment lengths, rotation limits, rated torques, and thermal limits as pure data.
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface JointLimits {
  minRad: number;
  maxRad: number;
}

export interface PartDefinition {
  id: string;
  name: string;
  parentId: string | null;
  massKg: number;
  offsetFromParent: [number, number, number]; // [x, y, z] meters
  dimensions: [number, number, number];       // [w, h, d] meters
  visualShape: 'box' | 'cylinder' | 'capsule' | 'sphere';
  color: string;
  emissiveColor: string;
  ratedTorqueNm: number;
  ratedTempC: number;
  limits?: {
    pitch?: JointLimits;
    roll?: JointLimits;
    yaw?: JointLimits;
  };
}

export interface LimbChain {
  id: string;
  name: string;
  rootJointId: string;
  midJointId: string;
  endEffectorId: string;
  l1: number; // Upper segment length (m)
  l2: number; // Lower segment length (m)
  defaultPoleVector: [number, number, number];
  neutralTarget: [number, number, number];
}

export interface RobotRigDefinition {
  name: string;
  totalMassKg: number;
  rootId: string;
  standingHeightM: number;
  parts: Record<string, PartDefinition>;
  limbs: {
    legL: LimbChain;
    legR: LimbChain;
    armL: LimbChain;
    armR: LimbChain;
  };
}

export const ROBOT_RIG: RobotRigDefinition = {
  name: 'A.E.G.I.S Mk-IV Bipedal Scout',
  totalMassKg: 52.0,
  rootId: 'torso',
  standingHeightM: 1.48,

  parts: {
    // --- TORSO ROOT ---
    torso: {
      id: 'torso',
      name: 'Main Chassis / Avionics Core',
      parentId: null,
      massKg: 22.0,
      offsetFromParent: [0, 0.95, 0],
      dimensions: [0.34, 0.42, 0.22],
      visualShape: 'box',
      color: '#262B30',
      emissiveColor: '#3E7C79',
      ratedTorqueNm: 350,
      ratedTempC: 85,
    },

    // --- SENSOR TURRET / HEAD ---
    head: {
      id: 'head',
      name: 'LiDAR & Optical Sensor Head',
      parentId: 'torso',
      massKg: 2.8,
      offsetFromParent: [0, 0.28, 0.04],
      dimensions: [0.18, 0.14, 0.18],
      visualShape: 'box',
      color: '#1E2226',
      emissiveColor: '#00E5FF',
      ratedTorqueNm: 80,
      ratedTempC: 75,
      limits: {
        pitch: { minRad: -Math.PI / 4, maxRad: Math.PI / 4 },
        yaw: { minRad: -Math.PI / 2, maxRad: Math.PI / 2 },
      },
    },

    // --- LEFT LEG ---
    hip_l: {
      id: 'hip_l',
      name: 'Left Hip Actuator Complex',
      parentId: 'torso',
      massKg: 3.2,
      offsetFromParent: [-0.14, -0.21, 0.0],
      dimensions: [0.10, 0.10, 0.12],
      visualShape: 'sphere',
      color: '#333A42',
      emissiveColor: '#D98A2B',
      ratedTorqueNm: 280,
      ratedTempC: 90,
      limits: {
        pitch: { minRad: -Math.PI / 2, maxRad: Math.PI / 2 },
        roll: { minRad: -Math.PI / 6, maxRad: Math.PI / 4 },
        yaw: { minRad: -Math.PI / 4, maxRad: Math.PI / 4 },
      },
    },
    thigh_l: {
      id: 'thigh_l',
      name: 'Left Femur Structural Link',
      parentId: 'hip_l',
      massKg: 5.5,
      offsetFromParent: [0, -0.21, 0],
      dimensions: [0.11, 0.42, 0.12],
      visualShape: 'box',
      color: '#262B30',
      emissiveColor: '#3E7C79',
      ratedTorqueNm: 280,
      ratedTempC: 90,
    },
    knee_l: {
      id: 'knee_l',
      name: 'Left Knee Planetary Drive',
      parentId: 'thigh_l',
      massKg: 2.4,
      offsetFromParent: [0, -0.21, 0],
      dimensions: [0.09, 0.09, 0.10],
      visualShape: 'cylinder',
      color: '#4A525D',
      emissiveColor: '#D98A2B',
      ratedTorqueNm: 320,
      ratedTempC: 95,
      limits: {
        pitch: { minRad: 0.0, maxRad: 2.4 }, // Knee bends backwards (pitch > 0)
      },
    },
    shin_l: {
      id: 'shin_l',
      name: 'Left Tibia Structural Link',
      parentId: 'knee_l',
      massKg: 4.2,
      offsetFromParent: [0, -0.21, 0],
      dimensions: [0.09, 0.42, 0.10],
      visualShape: 'box',
      color: '#262B30',
      emissiveColor: '#3E7C79',
      ratedTorqueNm: 220,
      ratedTempC: 85,
    },
    foot_l: {
      id: 'foot_l',
      name: 'Left Tri-Axis Ground Contact Plate',
      parentId: 'shin_l',
      massKg: 1.8,
      offsetFromParent: [0, -0.21, 0.04],
      dimensions: [0.12, 0.05, 0.24],
      visualShape: 'box',
      color: '#1E2226',
      emissiveColor: '#00E5FF',
      ratedTorqueNm: 180,
      ratedTempC: 80,
      limits: {
        pitch: { minRad: -Math.PI / 4, maxRad: Math.PI / 4 },
        roll: { minRad: -Math.PI / 6, maxRad: Math.PI / 6 },
      },
    },

    // --- RIGHT LEG ---
    hip_r: {
      id: 'hip_r',
      name: 'Right Hip Actuator Complex',
      parentId: 'torso',
      massKg: 3.2,
      offsetFromParent: [0.14, -0.21, 0.0],
      dimensions: [0.10, 0.10, 0.12],
      visualShape: 'sphere',
      color: '#333A42',
      emissiveColor: '#D98A2B',
      ratedTorqueNm: 280,
      ratedTempC: 90,
      limits: {
        pitch: { minRad: -Math.PI / 2, maxRad: Math.PI / 2 },
        roll: { minRad: -Math.PI / 4, maxRad: Math.PI / 6 },
        yaw: { minRad: -Math.PI / 4, maxRad: Math.PI / 4 },
      },
    },
    thigh_r: {
      id: 'thigh_r',
      name: 'Right Femur Structural Link',
      parentId: 'hip_r',
      massKg: 5.5,
      offsetFromParent: [0, -0.21, 0],
      dimensions: [0.11, 0.42, 0.12],
      visualShape: 'box',
      color: '#262B30',
      emissiveColor: '#3E7C79',
      ratedTorqueNm: 280,
      ratedTempC: 90,
    },
    knee_r: {
      id: 'knee_r',
      name: 'Right Knee Planetary Drive',
      parentId: 'thigh_r',
      massKg: 2.4,
      offsetFromParent: [0, -0.21, 0],
      dimensions: [0.09, 0.09, 0.10],
      visualShape: 'cylinder',
      color: '#4A525D',
      emissiveColor: '#D98A2B',
      ratedTorqueNm: 320,
      ratedTempC: 95,
      limits: {
        pitch: { minRad: 0.0, maxRad: 2.4 },
      },
    },
    shin_r: {
      id: 'shin_r',
      name: 'Right Tibia Structural Link',
      parentId: 'knee_r',
      massKg: 4.2,
      offsetFromParent: [0, -0.21, 0],
      dimensions: [0.09, 0.42, 0.10],
      visualShape: 'box',
      color: '#262B30',
      emissiveColor: '#3E7C79',
      ratedTorqueNm: 220,
      ratedTempC: 85,
    },
    foot_r: {
      id: 'foot_r',
      name: 'Right Tri-Axis Ground Contact Plate',
      parentId: 'shin_r',
      massKg: 1.8,
      offsetFromParent: [0, -0.21, 0.04],
      dimensions: [0.12, 0.05, 0.24],
      visualShape: 'box',
      color: '#1E2226',
      emissiveColor: '#00E5FF',
      ratedTorqueNm: 180,
      ratedTempC: 80,
      limits: {
        pitch: { minRad: -Math.PI / 4, maxRad: Math.PI / 4 },
        roll: { minRad: -Math.PI / 6, maxRad: Math.PI / 6 },
      },
    },

    // --- LEFT ARM ---
    shoulder_l: {
      id: 'shoulder_l',
      name: 'Left Shoulder Gimbal',
      parentId: 'torso',
      massKg: 2.2,
      offsetFromParent: [-0.22, 0.16, 0.0],
      dimensions: [0.09, 0.09, 0.09],
      visualShape: 'sphere',
      color: '#333A42',
      emissiveColor: '#D98A2B',
      ratedTorqueNm: 140,
      ratedTempC: 85,
    },
    upper_arm_l: {
      id: 'upper_arm_l',
      name: 'Left Humerus Link',
      parentId: 'shoulder_l',
      massKg: 2.4,
      offsetFromParent: [0, -0.16, 0],
      dimensions: [0.08, 0.32, 0.08],
      visualShape: 'box',
      color: '#262B30',
      emissiveColor: '#3E7C79',
      ratedTorqueNm: 140,
      ratedTempC: 85,
    },
    elbow_l: {
      id: 'elbow_l',
      name: 'Left Elbow Drive',
      parentId: 'upper_arm_l',
      massKg: 1.4,
      offsetFromParent: [0, -0.16, 0],
      dimensions: [0.07, 0.07, 0.08],
      visualShape: 'cylinder',
      color: '#4A525D',
      emissiveColor: '#D98A2B',
      ratedTorqueNm: 120,
      ratedTempC: 85,
    },
    forearm_l: {
      id: 'forearm_l',
      name: 'Left Forearm Link',
      parentId: 'elbow_l',
      massKg: 1.8,
      offsetFromParent: [0, -0.15, 0],
      dimensions: [0.07, 0.30, 0.07],
      visualShape: 'box',
      color: '#262B30',
      emissiveColor: '#3E7C79',
      ratedTorqueNm: 90,
      ratedTempC: 80,
    },
    hand_l: {
      id: 'hand_l',
      name: 'Left Utility Gripper End-Effector',
      parentId: 'forearm_l',
      massKg: 0.8,
      offsetFromParent: [0, -0.15, 0.02],
      dimensions: [0.07, 0.08, 0.10],
      visualShape: 'box',
      color: '#1E2226',
      emissiveColor: '#00E5FF',
      ratedTorqueNm: 60,
      ratedTempC: 75,
    },

    // --- RIGHT ARM ---
    shoulder_r: {
      id: 'shoulder_r',
      name: 'Right Shoulder Gimbal',
      parentId: 'torso',
      massKg: 2.2,
      offsetFromParent: [0.22, 0.16, 0.0],
      dimensions: [0.09, 0.09, 0.09],
      visualShape: 'sphere',
      color: '#333A42',
      emissiveColor: '#D98A2B',
      ratedTorqueNm: 140,
      ratedTempC: 85,
    },
    upper_arm_r: {
      id: 'upper_arm_r',
      name: 'Right Humerus Link',
      parentId: 'shoulder_r',
      massKg: 2.4,
      offsetFromParent: [0, -0.16, 0],
      dimensions: [0.08, 0.32, 0.08],
      visualShape: 'box',
      color: '#262B30',
      emissiveColor: '#3E7C79',
      ratedTorqueNm: 140,
      ratedTempC: 85,
    },
    elbow_r: {
      id: 'elbow_r',
      name: 'Right Elbow Drive',
      parentId: 'upper_arm_r',
      massKg: 1.4,
      offsetFromParent: [0, -0.16, 0],
      dimensions: [0.07, 0.07, 0.08],
      visualShape: 'cylinder',
      color: '#4A525D',
      emissiveColor: '#D98A2B',
      ratedTorqueNm: 120,
      ratedTempC: 85,
    },
    forearm_r: {
      id: 'forearm_r',
      name: 'Right Forearm Link',
      parentId: 'elbow_r',
      massKg: 1.8,
      offsetFromParent: [0, -0.15, 0],
      dimensions: [0.07, 0.30, 0.07],
      visualShape: 'box',
      color: '#262B30',
      emissiveColor: '#3E7C79',
      ratedTorqueNm: 90,
      ratedTempC: 80,
    },
    hand_r: {
      id: 'hand_r',
      name: 'Right Utility Gripper End-Effector',
      parentId: 'forearm_r',
      massKg: 0.8,
      offsetFromParent: [0, -0.15, 0.02],
      dimensions: [0.07, 0.08, 0.10],
      visualShape: 'box',
      color: '#1E2226',
      emissiveColor: '#00E5FF',
      ratedTorqueNm: 60,
      ratedTempC: 75,
    },
  },

  limbs: {
    legL: {
      id: 'legL',
      name: 'Left Leg Kinetic Chain',
      rootJointId: 'hip_l',
      midJointId: 'knee_l',
      endEffectorId: 'foot_l',
      l1: 0.42, // thigh length
      l2: 0.42, // shin length
      defaultPoleVector: [0, 0, 1], // Knees point forward (+Z)
      neutralTarget: [-0.14, 0.0, 0.0],
    },
    legR: {
      id: 'legR',
      name: 'Right Leg Kinetic Chain',
      rootJointId: 'hip_r',
      midJointId: 'knee_r',
      endEffectorId: 'foot_r',
      l1: 0.42,
      l2: 0.42,
      defaultPoleVector: [0, 0, 1],
      neutralTarget: [0.14, 0.0, 0.0],
    },
    armL: {
      id: 'armL',
      name: 'Left Arm Kinetic Chain',
      rootJointId: 'shoulder_l',
      midJointId: 'elbow_l',
      endEffectorId: 'hand_l',
      l1: 0.32,
      l2: 0.30,
      defaultPoleVector: [0, 0, -1], // Elbows point backward (-Z)
      neutralTarget: [-0.26, 0.55, 0.0],
    },
    armR: {
      id: 'armR',
      name: 'Right Arm Kinetic Chain',
      rootJointId: 'shoulder_r',
      midJointId: 'elbow_r',
      endEffectorId: 'hand_r',
      l1: 0.32,
      l2: 0.30,
      defaultPoleVector: [0, 0, -1],
      neutralTarget: [0.26, 0.55, 0.0],
    },
  },
};

/**
 * Project A.E.G.I.S — Telemetry Buffer Schema & Layout (§3.1)
 *
 * Defines the fixed Float32Array offsets for 60Hz+ numeric simulation and hardware states.
 * All positions and velocities use SI units (meters, radians, m/s, rad/s).
 */

export const TELEMETRY_OFFSETS = {
  // --- Root Pose & Motion (Offsets 0 - 12) ---
  POS_X: 0,
  POS_Y: 1,
  POS_Z: 2,
  ROT_QX: 3,
  ROT_QY: 4,
  ROT_QZ: 5,
  ROT_QW: 6,
  VEL_X: 7,
  VEL_Y: 8,
  VEL_Z: 9,
  ANG_VEL_X: 10,
  ANG_VEL_Y: 11,
  ANG_VEL_Z: 12,

  // --- Center of Mass (CoM) in World Coordinates (Offsets 13 - 15) ---
  COM_X: 13,
  COM_Y: 14,
  COM_Z: 15,

  // --- Stability Margin & Gait Stance (Offsets 16 - 17) ---
  // stability_margin in [0, 1] (or negative if CoM outside support polygon)
  STABILITY_MARGIN: 16,
  // 0: DOUBLE_SUPPORT, 1: LEFT_STANCE, 2: RIGHT_STANCE, 3: FLIGHT
  STANCE_STATE: 17,

  // --- End-Effectors / Feet Positions & Ground Contacts (Offsets 18 - 25) ---
  FOOT_L_X: 18,
  FOOT_L_Y: 19,
  FOOT_L_Z: 20,
  FOOT_L_CONTACT: 21, // 1.0 = in contact, 0.0 = swing
  FOOT_R_X: 22,
  FOOT_R_Y: 23,
  FOOT_R_Z: 24,
  FOOT_R_CONTACT: 25,

  // --- System Diagnostics & Mission Time (Offsets 26 - 29) ---
  FRAME_TIME_MS: 26,
  FPS: 27,
  BATTERY_PERCENT: 28, // 0.0 - 100.0
  MISSION_TIME_SEC: 29,

  // --- Joint Angles in Radians (Offsets 30 - 51: 22 joints) ---
  JOINTS_START: 30,
  NUM_JOINTS: 22,

  // --- Joint Torques in N·m (Offsets 52 - 73: 22 joints) ---
  TORQUES_START: 52,

  // --- Joint Thermal Temperatures in °C (Offsets 74 - 95: 22 joints) ---
  THERMAL_START: 74,

  // --- Total Buffer Size (Padded to 128 floats = 512 bytes) ---
  BUFFER_SIZE: 128,
} as const;

export type TelemetryOffsetKey = keyof typeof TELEMETRY_OFFSETS;

import { TELEMETRY_OFFSETS } from './telemetryOffsets';

/**
 * Module-level high-performance telemetry buffer (§3.1).
 *
 * Dedicated Float32Array memory region for all 60Hz+ continuous physical state.
 * Never passes through React/Zustand state setters to protect framerate.
 */

// Singleton typed buffer
const telemetryBuffer = new Float32Array(TELEMETRY_OFFSETS.BUFFER_SIZE);

// Default initial values
telemetryBuffer[TELEMETRY_OFFSETS.STABILITY_MARGIN] = 1.0;
telemetryBuffer[TELEMETRY_OFFSETS.BATTERY_PERCENT] = 100.0;
telemetryBuffer[TELEMETRY_OFFSETS.FPS] = 60.0;
telemetryBuffer[TELEMETRY_OFFSETS.FRAME_TIME_MS] = 16.6;

/**
 * Fast non-allocating write for multiple consecutive values.
 */
export function writeTelemetry(offset: number, values: ArrayLike<number>): void {
  const len = values.length;
  for (let i = 0; i < len; i++) {
    telemetryBuffer[offset + i] = values[i];
  }
}

/**
 * Fast single float write.
 */
export function writeTelemetrySingle(offset: number, value: number): void {
  telemetryBuffer[offset] = value;
}

/**
 * Read a slice of telemetry values.
 * Pass `out` to reuse a target Float32Array without allocating new garbage.
 */
export function readTelemetry(
  offset: number,
  length: number,
  out?: Float32Array
): Float32Array {
  const target = out || new Float32Array(length);
  for (let i = 0; i < length; i++) {
    target[i] = telemetryBuffer[offset + i];
  }
  return target;
}

/**
 * Read a single float value.
 */
export function readTelemetrySingle(offset: number): number {
  return telemetryBuffer[offset];
}

/**
 * Returns a direct view of the underlying Float32Array.
 * Warning: Treat as read-only.
 */
export function getTelemetryBuffer(): Float32Array {
  return telemetryBuffer;
}

/**
 * Reset all telemetry values (primarily used in test suites or simulation restarts).
 */
export function resetTelemetry(): void {
  telemetryBuffer.fill(0);
  telemetryBuffer[TELEMETRY_OFFSETS.STABILITY_MARGIN] = 1.0;
  telemetryBuffer[TELEMETRY_OFFSETS.BATTERY_PERCENT] = 100.0;
  telemetryBuffer[TELEMETRY_OFFSETS.FPS] = 60.0;
  telemetryBuffer[TELEMETRY_OFFSETS.FRAME_TIME_MS] = 16.6;
}

export type TelemetrySubscriber = (buffer: Float32Array) => void;

interface SubscriptionRecord {
  callback: TelemetrySubscriber;
  intervalMs: number;
  lastFired: number;
}

const activeSubscriptions = new Set<SubscriptionRecord>();
let subscriptionTimerId: ReturnType<typeof setInterval> | null = null;

function tickSubscriptions(): void {
  const now = performance.now();
  for (const record of activeSubscriptions) {
    if (now - record.lastFired >= record.intervalMs) {
      record.lastFired = now;
      record.callback(telemetryBuffer);
    }
  }
}

/**
 * Subscribe to telemetry updates on a fixed interval rather than per frame (§3.1).
 * Default rate is 10 Hz (100ms) for smooth human-readable HUD displays.
 */
export function subscribeTelemetry(
  callback: TelemetrySubscriber,
  intervalHz: number = 10
): () => void {
  const intervalMs = Math.max(1, Math.round(1000 / intervalHz));
  const record: SubscriptionRecord = {
    callback,
    intervalMs,
    lastFired: 0,
  };

  activeSubscriptions.add(record);

  // Start background ticker if not running
  if (!subscriptionTimerId && typeof setInterval !== 'undefined') {
    // Tick at highest required resolution (min 16ms)
    subscriptionTimerId = setInterval(tickSubscriptions, 20);
  }

  // Return unregister callback
  return () => {
    activeSubscriptions.delete(record);
    if (activeSubscriptions.size === 0 && subscriptionTimerId) {
      clearInterval(subscriptionTimerId);
      subscriptionTimerId = null;
    }
  };
}

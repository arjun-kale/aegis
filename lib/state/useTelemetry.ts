'use client';

import { useState, useEffect, useRef } from 'react';
import { subscribeTelemetry, readTelemetry } from './telemetryBus';

/**
 * Custom React hook for HUD components to consume telemetry at a controlled, throttled frequency.
 *
 * @param offset Starting float offset in telemetryBus
 * @param length Number of consecutive floats to read
 * @param hz Update frequency in Hz (default 10 Hz = 100ms)
 * @returns Current Float32Array slice
 */
export function useTelemetry(
  offset: number,
  length: number,
  hz: number = 10
): Float32Array {
  // Initialize state with current slice
  const [slice, setSlice] = useState<Float32Array>(() => readTelemetry(offset, length));
  const bufferRef = useRef<Float32Array>(new Float32Array(length));

  useEffect(() => {
    // Initial read
    readTelemetry(offset, length, bufferRef.current);
    setSlice(new Float32Array(bufferRef.current));

    const unsubscribe = subscribeTelemetry((_fullBuffer) => {
      // Check if values in the requested slice changed before triggering state setter
      let hasChanged = false;
      for (let i = 0; i < length; i++) {
        const val = _fullBuffer[offset + i];
        if (bufferRef.current[i] !== val) {
          bufferRef.current[i] = val;
          hasChanged = true;
        }
      }

      if (hasChanged) {
        setSlice(new Float32Array(bufferRef.current));
      }
    }, hz);

    return () => {
      unsubscribe();
    };
  }, [offset, length, hz]);

  return slice;
}

/**
 * Convenience hook for reading a single float at throttled frequency.
 */
export function useTelemetrySingle(offset: number, hz: number = 10): number {
  const slice = useTelemetry(offset, 1, hz);
  return slice[0];
}

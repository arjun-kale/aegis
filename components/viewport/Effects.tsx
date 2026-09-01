'use client';

import React from 'react';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { useMissionStore } from '@/lib/state/missionStore';

/**
 * Project A.E.G.I.S — Postprocessing Quality Toggle (§1.5, §2, Phase 10)
 *
 * Bloom + vignette only, driving off the same emissive materials used for
 * joint-stress visualization. Gated behind qualityMode so the default
 * PERFORMANCE mode never pays the extra render-target cost.
 */
export function Effects() {
  const qualityMode = useMissionStore((state) => state.qualityMode);

  if (qualityMode !== 'HIGH') return null;

  return (
    <EffectComposer multisampling={0}>
      <Bloom
        intensity={0.6}
        luminanceThreshold={0.35}
        luminanceSmoothing={0.2}
        mipmapBlur
        blendFunction={BlendFunction.ADD}
      />
      <Vignette eskil={false} offset={0.25} darkness={0.6} />
    </EffectComposer>
  );
}

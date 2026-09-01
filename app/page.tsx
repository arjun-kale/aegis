'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Header } from '@/components/hud/Header';
import { FallbackConsole } from '@/components/hud/FallbackConsole';
import { FrameTimeOverlay } from '@/components/hud/FrameTimeOverlay';
import { registerWebMcpTools } from '@/lib/webmcp/register';

// Strict dynamic import with ssr: false to isolate Three.js runtime
const Viewport = dynamic(() => import('@/components/viewport/Viewport'), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col items-center justify-center w-full h-full bg-[#14171A] text-foreground-muted font-mono text-xs gap-3">
      <div className="w-8 h-8 border-2 border-accent-teal border-t-transparent rounded-full animate-spin" />
      <div>INITIALIZING 3D ENGINE & SCENE GRAPH...</div>
    </div>
  ),
});

export default function Home() {
  const [isConsoleOpen, setIsConsoleOpen] = useState<boolean>(false);
  const [isFrameTimeOpen, setIsFrameTimeOpen] = useState<boolean>(false);

  // Lifetime-scoped WebMCP tool registration
  useEffect(() => {
    const unregister = registerWebMcpTools();
    return () => {
      unregister();
    };
  }, []);

  // Keyboard shortcut listener for dev overlays (F2)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        setIsFrameTimeOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#14171A]">
      {/* Top Mission HUD Header */}
      <Header
        isConsoleOpen={isConsoleOpen}
        onToggleConsole={() => setIsConsoleOpen((prev) => !prev)}
        isFrameTimeOpen={isFrameTimeOpen}
        onToggleFrameTime={() => setIsFrameTimeOpen((prev) => !prev)}
      />

      {/* Main 3D Viewport Subtree */}
      <div className="w-full h-full pt-12">
        <Viewport />
      </div>

      {/* Fallback Console & Interactive Harness */}
      <FallbackConsole
        isOpen={isConsoleOpen}
        onClose={() => setIsConsoleOpen(false)}
      />

      {/* Dev-only Frame Time & Latency Sparkline */}
      <FrameTimeOverlay
        isOpen={isFrameTimeOpen}
        onClose={() => setIsFrameTimeOpen(false)}
      />
    </main>
  );
}

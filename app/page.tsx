'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Header } from '@/components/hud/Header';
import { FallbackConsole } from '@/components/hud/FallbackConsole';
import { registerWebMcpTools } from '@/lib/webmcp/register';

// Strict dynamic import with ssr: false to prevent Three.js server-side execution
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

  // Lifetime-scoped WebMCP tool registration
  useEffect(() => {
    const unregister = registerWebMcpTools();
    return () => {
      unregister();
    };
  }, []);

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#14171A]">
      {/* Top Mission HUD Header */}
      <Header
        isConsoleOpen={isConsoleOpen}
        onToggleConsole={() => setIsConsoleOpen((prev) => !prev)}
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
    </main>
  );
}

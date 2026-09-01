import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Project A.E.G.I.S — Mission Workbench',
  description: 'Autonomous Exploration & Gait Inversion Studio — Agent-native 3D robotics workbench on W3C WebMCP.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased bg-[#14171A] text-[#E8E3DA] h-screen w-screen overflow-hidden">
        {children}
      </body>
    </html>
  );
}

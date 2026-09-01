'use client';

import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ViewportErrorBoundaryProps {
  children: React.ReactNode;
}

interface ViewportErrorBoundaryState {
  error: Error | null;
  remountKey: number;
}

/**
 * Project A.E.G.I.S — Canvas Error Boundary (Phase 10 §10 "Robustness")
 *
 * Catches render-time failures anywhere in the 3D viewport subtree (a bad
 * IK solution slipping past its own guards, a WebGL driver quirk, a
 * malformed facility geometry) so one bad frame degrades to a recoverable
 * panel instead of a blank tab. "Reset" remounts the subtree via `key`
 * rather than reloading the page, so mission state in zustand survives.
 */
export class ViewportErrorBoundary extends React.Component<
  ViewportErrorBoundaryProps,
  ViewportErrorBoundaryState
> {
  state: ViewportErrorBoundaryState = { error: null, remountKey: 0 };

  static getDerivedStateFromError(error: Error): Partial<ViewportErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[A.E.G.I.S] Viewport render failure:', error, info.componentStack);
  }

  private handleReset = () => {
    this.setState((prev) => ({ error: null, remountKey: prev.remountKey + 1 }));
  };

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center gap-4 w-full h-full bg-[#14171A] text-foreground font-mono text-xs px-6 text-center">
          <AlertTriangle className="w-8 h-8 text-accent-red" />
          <div className="max-w-md space-y-1.5">
            <div className="text-sm font-semibold text-accent-red">
              3D VIEWPORT RENDER FAILURE
            </div>
            <p className="text-foreground-muted leading-relaxed">
              The scene encountered an unrecoverable rendering error and was stopped to
              protect mission state. Robot telemetry, staged proposals, and the mission
              log are unaffected — reset the viewport to resume.
            </p>
            <p className="text-foreground-muted/70 text-[10px] break-all">
              {this.state.error.message}
            </p>
          </div>
          <button
            onClick={this.handleReset}
            className="flex items-center gap-2 px-4 py-2 rounded bg-accent-teal hover:bg-accent-teal/80 text-foreground font-semibold transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>RESET VIEWPORT</span>
          </button>
        </div>
      );
    }

    return <React.Fragment key={this.state.remountKey}>{this.props.children}</React.Fragment>;
  }
}

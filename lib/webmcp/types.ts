/**
 * Types and interfaces for the WebMCP standard tool suite in Project A.E.G.I.S.
 */

export interface ToolTextContent {
  type: 'text';
  text: string;
}

export interface ToolResult {
  content: ToolTextContent[];
  isError?: boolean;
}

export interface ToolDescriptor<TArgs = any> {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties?: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
    [key: string]: unknown;
  };
  execute: (args: TArgs) => Promise<ToolResult> | ToolResult;
}

export interface ModelContext {
  registerTool: (tool: ToolDescriptor) => void;
  unregisterTool?: (name: string) => void;
}

export interface SystemStatusPayload {
  fps: number;
  frameTimeMs: number;
  sceneObjectCount: number;
  meshCount: number;
  drawCalls?: number;
  triangles?: number;
  geometries?: number;
  textures?: number;
  timestamp: number;
  webMcpActive: boolean;
  status: 'OK';
}

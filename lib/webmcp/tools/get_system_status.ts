import { ToolDescriptor, ToolResult } from '../types';
import { formatSuccessResponse, formatFailureResponse } from '../responses';
import { validateSchema } from '../schemas';
import { getSystemMetrics } from '../systemMetrics';
import { resolveModelContext } from '../register';

export interface GetSystemStatusArgs {
  verbose?: boolean;
}

const inputSchema = {
  type: 'object' as const,
  properties: {
    verbose: {
      type: 'boolean',
      description: 'Whether to include detailed render diagnostics (draw calls, triangles, memory).',
    },
  },
  additionalProperties: false,
};

export const getSystemStatusTool: ToolDescriptor<GetSystemStatusArgs> = {
  name: 'get_system_status',
  description:
    'Query real-time 3D runtime performance, framerate, scene object counts, and WebMCP protocol connectivity. Safe and read-only. Returns current FPS, average frame time in milliseconds, total objects in the scene graph, and connection status.',
  inputSchema,
  execute: async (args: GetSystemStatusArgs = {}): Promise<ToolResult> => {
    // Validate schema
    const validation = validateSchema(args, inputSchema);
    if (!validation.valid) {
      return formatFailureResponse(
        'INVALID_ARGUMENT',
        validation.errors.map((e) => e.message).join(' '),
        true,
        'Provide valid arguments conforming to the input schema.'
      );
    }

    const metrics = getSystemMetrics();
    const mc = resolveModelContext();

    const payload: Record<string, unknown> = {
      fps: metrics.fps,
      frame_time_ms: metrics.frameTimeMs,
      scene_object_count: metrics.sceneObjectCount,
      mesh_count: metrics.meshCount,
      webmcp_active: mc !== null,
      timestamp: Date.now(),
      status_summary: metrics.fps >= 55 ? 'OPTIMAL' : metrics.fps >= 30 ? 'ACCEPTABLE' : 'DEGRADED',
    };

    if (args.verbose) {
      payload.diagnostics = {
        triangles: metrics.triangles,
        draw_calls: metrics.drawCalls,
        geometries: metrics.geometries,
        textures: metrics.textures,
        last_metric_update_epoch: metrics.lastUpdated,
      };
    }

    return formatSuccessResponse(payload);
  },
};

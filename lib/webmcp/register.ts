import { ModelContext, ToolDescriptor } from './types';
import { getSystemStatusTool } from './tools/get_system_status';
import { getRobotTelemetryTool } from './tools/get_robot_telemetry';
import { scanSpatialEnvironmentTool } from './tools/scan_spatial_environment';
import { evaluateGaitFeasibilityTool } from './tools/evaluate_gait_feasibility';
import { queryFacilityStateTool } from './tools/query_facility_state';
import { stageLocomotionPlanTool } from './tools/stage_locomotion_plan';
import { executeStagedProposalTool } from './tools/execute_staged_proposal';
import { overrideFacilityMechanismTool } from './tools/override_facility_mechanism';
import { setExplodedEngineeringViewTool } from './tools/set_exploded_engineering_view';

/**
 * Safely resolves the W3C WebMCP Model Context from navigator or document.
 * Returns null if not in a SecureContext (e.g. unencrypted HTTP) or if WebMCP is unsupported.
 */
export function resolveModelContext(): ModelContext | null {
  if (typeof window === 'undefined') return null;
  if (!window.isSecureContext) return null;

  const nav = typeof navigator !== 'undefined' ? (navigator as any).modelContext : null;
  const doc = typeof document !== 'undefined' ? (document as any).modelContext : null;

  return nav ?? doc ?? null;
}

/**
 * Active WebMCP tool registry for Project A.E.G.I.S (§5, §6, §8).
 */
export const ACTIVE_TOOLS: ToolDescriptor[] = [
  getSystemStatusTool,
  getRobotTelemetryTool,
  scanSpatialEnvironmentTool,
  evaluateGaitFeasibilityTool,
  queryFacilityStateTool,
  stageLocomotionPlanTool,
  executeStagedProposalTool,
  overrideFacilityMechanismTool,
  setExplodedEngineeringViewTool,
];

/**
 * Register all tools into the WebMCP context if available.
 * Returns a cleanup function for React useEffect unmounting.
 */
export function registerWebMcpTools(tools: ToolDescriptor[] = ACTIVE_TOOLS): () => void {
  const mc = resolveModelContext();
  if (!mc || typeof mc.registerTool !== 'function') {
    return () => {};
  }

  tools.forEach((tool) => {
    try {
      mc.registerTool(tool);
    } catch (err) {
      console.warn(`[WebMCP] Failed to register tool ${tool.name}:`, err);
    }
  });

  return () => {
    if (typeof mc.unregisterTool === 'function') {
      tools.forEach((tool) => {
        try {
          mc.unregisterTool!(tool.name);
        } catch (err) {
          console.warn(`[WebMCP] Failed to unregister tool ${tool.name}:`, err);
        }
      });
    }
  };
}

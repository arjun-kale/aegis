import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resolveModelContext, registerWebMcpTools, ACTIVE_TOOLS } from '@/lib/webmcp/register';
import { getSystemStatusTool } from '@/lib/webmcp/tools/get_system_status';
import { formatSuccessResponse, formatFailureResponse } from '@/lib/webmcp/responses';
import { validateSchema } from '@/lib/webmcp/schemas';
import { recordFrameMetrics, getSystemMetrics } from '@/lib/webmcp/systemMetrics';

describe('WebMCP Foundation & Core Contracts (Phase 0)', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('resolveModelContext()', () => {
    it('returns null when window is undefined (SSR)', () => {
      vi.stubGlobal('window', undefined);
      expect(resolveModelContext()).toBeNull();
    });

    it('returns null when window.isSecureContext is false (plain HTTP)', () => {
      vi.stubGlobal('window', { isSecureContext: false });
      expect(resolveModelContext()).toBeNull();
    });

    it('returns navigator.modelContext when present in secure context', () => {
      const mockModelContext = { registerTool: vi.fn(), unregisterTool: vi.fn() };
      vi.stubGlobal('window', { isSecureContext: true });
      vi.stubGlobal('navigator', { modelContext: mockModelContext });

      const mc = resolveModelContext();
      expect(mc).toBe(mockModelContext);
    });

    it('falls back to document.modelContext if navigator does not have it', () => {
      const mockModelContext = { registerTool: vi.fn(), unregisterTool: vi.fn() };
      vi.stubGlobal('window', { isSecureContext: true });
      vi.stubGlobal('navigator', {});
      vi.stubGlobal('document', { modelContext: mockModelContext });

      const mc = resolveModelContext();
      expect(mc).toBe(mockModelContext);
    });
  });

  describe('Response Envelopes & Schema Validation', () => {
    it('formats success responses according to W3C WebMCP content envelope', () => {
      const resp = formatSuccessResponse({ testKey: 'testVal', count: 42 });
      expect(resp.content).toHaveLength(1);
      expect(resp.content[0].type).toBe('text');
      
      const parsed = JSON.parse(resp.content[0].text);
      expect(parsed.status).toBe('OK');
      expect(parsed.testKey).toBe('testVal');
      expect(parsed.count).toBe(42);
    });

    it('formats failure responses with structured recovery data', () => {
      const resp = formatFailureResponse(
        'REJECTED_STABILITY',
        'Stability margin too low',
        true,
        'Retry with CAUTIOUS_STEP',
        { margin: 0.41 }
      );
      expect(resp.isError).toBe(true);
      expect(resp.content).toHaveLength(1);
      
      const parsed = JSON.parse(resp.content[0].text);
      expect(parsed.status).toBe('REJECTED_STABILITY');
      expect(parsed.recoverable).toBe(true);
      expect(parsed.suggested_action).toBe('Retry with CAUTIOUS_STEP');
      expect(parsed.margin).toBe(0.41);
    });

    it('validates JSON schemas correctly', () => {
      const schema = {
        type: 'object',
        properties: {
          radius: { type: 'number' },
          mode: { type: 'string', enum: ['FAST', 'SLOW'] },
        },
        required: ['radius'],
      };

      const validResult = validateSchema({ radius: 10, mode: 'FAST' }, schema);
      expect(validResult.valid).toBe(true);

      const missingRequired = validateSchema({ mode: 'FAST' }, schema);
      expect(missingRequired.valid).toBe(false);
      expect(missingRequired.errors[0].field).toBe('radius');

      const invalidEnum = validateSchema({ radius: 5, mode: 'UNKNOWN' }, schema);
      expect(invalidEnum.valid).toBe(false);
      expect(invalidEnum.errors[0].field).toBe('mode');
    });
  });

  describe('get_system_status tool', () => {
    it('conforms to the ToolDescriptor specification (§3.2)', () => {
      expect(getSystemStatusTool.name).toBe('get_system_status');
      expect(typeof getSystemStatusTool.description).toBe('string');
      expect(getSystemStatusTool.description.length).toBeGreaterThan(20);
      expect(getSystemStatusTool.inputSchema.type).toBe('object');
      expect(typeof getSystemStatusTool.execute).toBe('function');
    });

    it('executes and returns real telemetry numbers', async () => {
      // Simulate 60fps frame delta
      recordFrameMetrics(0.0166, {
        sceneObjects: 15,
        meshes: 4,
        triangles: 1200,
        drawCalls: 5,
      });

      const result = await getSystemStatusTool.execute({ verbose: true });
      expect(result.content).toHaveLength(1);
      
      const payload = JSON.parse(result.content[0].text);
      expect(payload.status).toBe('OK');
      expect(payload.fps).toBeGreaterThanOrEqual(1);
      expect(payload.frame_time_ms).toBeGreaterThan(0);
      expect(payload.scene_object_count).toBe(15);
      expect(payload.mesh_count).toBe(4);
      expect(payload.diagnostics.triangles).toBe(1200);
      expect(payload.diagnostics.draw_calls).toBe(5);
    });

    it('rejects invalid inputs gracefully with structured failure', async () => {
      // @ts-ignore - passing bad argument type
      const result = await getSystemStatusTool.execute({ verbose: 'invalid_boolean' });
      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.status).toBe('INVALID_ARGUMENT');
      expect(parsed.recoverable).toBe(true);
    });
  });

  describe('Tool Registration Lifecycle', () => {
    it('registers and unregisters cleanly without throwing', () => {
      const registered: any[] = [];
      const unregistered: string[] = [];

      const mockModelContext = {
        registerTool: vi.fn((t) => registered.push(t)),
        unregisterTool: vi.fn((name) => unregistered.push(name)),
      };

      vi.stubGlobal('window', { isSecureContext: true });
      vi.stubGlobal('navigator', { modelContext: mockModelContext });

      const unregister = registerWebMcpTools(ACTIVE_TOOLS);
      expect(mockModelContext.registerTool).toHaveBeenCalledTimes(ACTIVE_TOOLS.length);
      expect(registered[0].name).toBe('get_system_status');

      unregister();
      expect(mockModelContext.unregisterTool).toHaveBeenCalledWith('get_system_status');
    });
  });
});

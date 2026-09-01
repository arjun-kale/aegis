import { ToolResult } from './types';

/**
 * Standard envelope formatters conforming to WebMCP specifications.
 * All tool responses are wrapped in `{ content: [{ type: 'text', text: string }] }`.
 */

export function formatSuccessResponse(payload: Record<string, unknown>): ToolResult {
  const body = {
    status: 'OK',
    ...payload,
  };
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(body, null, 2),
      },
    ],
    isError: false,
  };
}

export function formatFailureResponse(
  status: string,
  reason: string,
  recoverable: boolean = false,
  suggestedAction?: string,
  details?: Record<string, unknown>
): ToolResult {
  const body = {
    status,
    reason,
    recoverable,
    ...(suggestedAction ? { suggested_action: suggestedAction } : {}),
    ...(details || {}),
  };
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(body, null, 2),
      },
    ],
    isError: true,
  };
}

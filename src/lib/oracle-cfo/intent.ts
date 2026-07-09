// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle CFO™ — Intent Router
//
// Maps a natural-language user message → DetectedToolCall[] using:
//   1. Tool.detect() — regex + keyword scoring per tool
//   2. Tool.extractParams() — pull params from live business data
//   3. Missing-param detection — what the user still needs to provide
//   4. Confidence scoring — how sure we are this is the right tool
//
// The router NEVER invents params. If a required param is missing, it says so.
// ═══════════════════════════════════════════════════════════════════════════════

import { CFO_TOOLS, type Tool, type LiveBusinessData, type DetectedParam, type ToolContext } from './tools';

export interface DetectedToolCall {
  toolId: string;
  toolName: string;
  toolIcon: string;
  category: string;
  confidence: number; // 0-1
  extractedParams: DetectedParam[];
  missingParams: string[];
  preview?: Record<string, unknown>;
  approvalRequired: boolean;
}

export interface IntentRouterResult {
  detected: DetectedToolCall[];
  hasActionableIntent: boolean;
  summary: string;
}

/**
 * Route a user message to matching tools.
 * Loads live business data once, then runs every tool's detector + extractor.
 */
export async function routeIntent(
  message: string,
  ctx: ToolContext,
  liveData: LiveBusinessData,
): Promise<IntentRouterResult> {
  if (!message || message.trim().length < 3) {
    return { detected: [], hasActionableIntent: false, summary: 'Message too short to detect intent.' };
  }

  const detected: DetectedToolCall[] = [];

  for (const tool of CFO_TOOLS) {
    const { matches, score } = tool.detect(message);
    if (!matches || score < 0.5) continue;

    // Extract params from live data
    const extractedParams = tool.extractParams ? tool.extractParams(message, liveData) : [];

    // Detect missing required params
    const missingParams: string[] = [];
    for (const field of tool.inputSchema) {
      if (!field.required) continue;
      const hasParam = extractedParams.some((p) => p.key === field.key && p.value !== undefined && p.value !== '');
      const hasDefault = field.defaultValue !== undefined;
      if (!hasParam && !hasDefault) {
        missingParams.push(field.key);
      }
    }

    // Build the input map for dry-run preview
    const inputMap: Record<string, unknown> = {};
    for (const field of tool.inputSchema) {
      const extracted = extractedParams.find((p) => p.key === field.key);
      inputMap[field.key] = extracted?.value ?? field.defaultValue ?? '';
    }

    // Generate a dry-run preview (safe — no writes)
    let preview: Record<string, unknown> | undefined;
    try {
      preview = await tool.dryRun(inputMap, ctx);
    } catch {
      preview = undefined;
    }

    detected.push({
      toolId: tool.id,
      toolName: tool.name,
      toolIcon: tool.icon,
      category: tool.category,
      confidence: score,
      extractedParams,
      missingParams,
      preview,
      approvalRequired: tool.approvalRequired,
    });
  }

  // Sort by confidence descending
  detected.sort((a, b) => b.confidence - a.confidence);

  const hasActionableIntent = detected.length > 0;
  const summary = hasActionableIntent
    ? `Detected ${detected.length} actionable intent${detected.length > 1 ? 's' : ''}: ${detected.map((d) => d.toolName).join(', ')}.`
    : 'No actionable tool intent detected. Oracle will answer conversationally.';

  return { detected, hasActionableIntent, summary };
}

/**
 * Get the full tool definition for a detected tool call.
 */
export function resolveTool(toolId: string): Tool | undefined {
  return CFO_TOOLS.find((t) => t.id === toolId);
}

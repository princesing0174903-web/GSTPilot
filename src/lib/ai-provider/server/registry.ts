// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot AI Oracle™ & AI CFO™ — Provider Registry (SERVER-ONLY)
//
// The SINGLE switch-point between AI providers. Today returns MockAIProvider;
// when the `AI_PROVIDER` env var is set to one of the future provider names,
// the registry returns that provider.
//
// All existing pages communicate ONLY through IAIProvider (via the
// orchestrator). Switching to production later means changing exactly ONE env
// var — no service, hook, or UI code changes.
//
// This file is SERVER-ONLY — it imports the provider implementations.
// API routes / orchestrator are the only consumers.
// ═══════════════════════════════════════════════════════════════════════════════

import type { IAIProvider } from '../provider';
import type { AIProviderName, AIProviderDiagnostics } from '../types';
import { MockAIProvider } from './mock-provider';
import { createFutureProvider } from './future-providers';

let cachedProvider: IAIProvider | null = null;
let cachedName: AIProviderName | null = null;

/**
 * Resolve which provider to use based on the `AI_PROVIDER` env var.
 *   • 'mock' / undefined → MockAIProvider (default)
 *   • 'openai'           → FutureOpenAIProvider
 *   • 'gemini'           → FutureGeminiProvider
 *   • 'claude'           → FutureClaudeProvider
 */
export function getProviderName(): AIProviderName {
  const raw = (process.env.AI_PROVIDER ?? 'mock').toLowerCase().trim();
  const valid: AIProviderName[] = ['mock', 'openai', 'gemini', 'claude'];
  return (valid as string[]).includes(raw) ? (raw as AIProviderName) : 'mock';
}

/**
 * Get the active AI provider. The provider is cached for the process lifetime
 * — switching providers requires a server restart (which is correct: provider
 * changes are an ops concern, not a runtime concern).
 *
 * Server-only: callers MUST be API routes or server services.
 */
export function getAIProvider(): IAIProvider {
  const name = getProviderName();
  if (cachedProvider && cachedName === name) return cachedProvider;
  cachedProvider = name === 'mock' ? new MockAIProvider() : createFutureProvider(name);
  cachedName = name;
  return cachedProvider;
}

/**
 * For diagnostics — returns a description of the active provider.
 */
export function describeProvider(): AIProviderDiagnostics {
  const provider = getAIProvider();
  return {
    name: provider.name,
    provider: provider.provider,
    isLive: provider.isLive,
    configured: true,
  };
}

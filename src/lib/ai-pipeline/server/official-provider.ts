// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot AI Production Pipeline™ — FutureOfficialGenProvider (SERVER-ONLY)
//
// The placeholder for real production AI provider integrations (OpenAI,
// Anthropic, Google, Stability, Runway, ElevenLabs, etc.). Every method
// throws `NotImplementedError` so the system fails LOUDLY if you switch to
// this provider before implementing the real HTTP calls.
//
// WHEN YOU'RE READY TO GO LIVE:
//   1. Set env: AI_PROVIDER=official, plus provider-specific keys
//      (OPENAI_API_KEY, ANTHROPIC_API_KEY, etc.)
//   2. Implement each method below to call the real provider endpoint.
//      The request/response shapes are documented inline.
//   3. The service layer, hooks, and UI DO NOT CHANGE — they only talk to
//      IGenProvider. That's the whole point of the provider pattern.
//
// This file is SERVER-ONLY (it holds real HTTP client code + secrets).
// ═══════════════════════════════════════════════════════════════════════════════

import type { IGenProvider, CancelSignal, ProgressCallback } from '../provider';
import type { GenAssetType, GenJobInput, GenJobOutput, GenJobStatusReason, GenProviderName } from '../types';
import { NotImplementedError, AuthenticationError } from '../errors';

/**
 * Future provider that will route to real AI backends (OpenAI / Anthropic / etc.).
 *
 * Every method throws NotImplementedError today. When you implement each
 * method, replace the throw with a real `fetch()` call to the provider endpoint.
 * The contract (input/output shapes) is identical to MockGenProvider, so the
 * service layer doesn't change.
 *
 * Reference docs:
 *   - OpenAI: https://platform.openai.com/docs/api-reference
 *   - Anthropic: https://docs.anthropic.com/en/api/messages
 *   - Google Gemini: https://ai.google.dev/gemini-api/docs
 *   - Stability AI: https://platform.stability.ai/docs/api-reference
 *   - Runway: https://docs.dev.runwayml.com/
 *   - ElevenLabs: https://elevenlabs.io/docs/api-reference
 */
export class FutureOfficialGenProvider implements IGenProvider {
  readonly name = 'Official AI Provider (not yet implemented)';
  readonly providerName: GenProviderName = 'openai'; // overridden per-call
  readonly isLive = true;
  readonly supportedAssetTypes: GenAssetType[] = ['text', 'image', 'video', 'audio', 'code', 'structured'];
  readonly defaultModels = {
    text: 'gpt-4o',
    code: 'gpt-4o',
    structured: 'gpt-4o',
    image: 'dall-e-3',
    audio: 'tts-1',
    video: 'sora-1',
  };

  /**
   * Resolve the API key for the requested provider from env.
   * Throws if the required env var is missing.
   */
  private getApiKey(provider: GenProviderName): string {
    const envMap: Record<string, string | undefined> = {
      openai: process.env.OPENAI_API_KEY,
      anthropic: process.env.ANTHROPIC_API_KEY,
      google: process.env.GOOGLE_AI_API_KEY,
      stability: process.env.STABILITY_API_KEY,
      runway: process.env.RUNWAY_API_KEY,
      elevenlabs: process.env.ELEVENLABS_API_KEY,
      custom: process.env.CUSTOM_AI_API_KEY,
    };
    const key = envMap[provider];
    if (!key) {
      throw new AuthenticationError(
        `Missing API key for provider "${provider}". Set the corresponding env var (e.g. OPENAI_API_KEY).`,
      );
    }
    return key;
  }

  /**
   * POST https://api.openai.com/v1/chat/completions
   *   { model, messages: [{role:'system',...},{role:'user',content:prompt}], ... }
   * POST https://api.anthropic.com/v1/messages
   *   { model, system: systemPrompt, messages: [{role:'user',content:prompt}], ... }
   */
  async generate(
    input: GenJobInput,
    options: {
      assetType: GenAssetType;
      model: string;
      cancelSignal: CancelSignal;
      onProgress?: ProgressCallback;
    },
  ): Promise<{ output: GenJobOutput; statusReason: GenJobStatusReason }> {
    void this.getApiKey('openai'); // surfaces missing-key errors
    void input;
    void options;
    throw new NotImplementedError('Official AI generation');
  }

  async healthCheck(): Promise<boolean> {
    // Once implemented, ping each provider's health endpoint.
    return false;
  }
}

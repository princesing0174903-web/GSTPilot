// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Real Banking Foundation™ — Provider Registry (SERVER-ONLY)
//
// The SINGLE switch-point between providers. Today returns MockBankProvider;
// when BANK_PROVIDER env var is set to one of the future provider names, the
// registry returns that provider.
//
// All existing pages communicate ONLY through IBankProvider (via the service
// layer). Switching to production later means changing exactly ONE env var —
// no service, hook, or UI code changes.
//
// This file is SERVER-ONLY — it imports the providers which use `node:crypto`.
// API routes are the only consumers.
// ═══════════════════════════════════════════════════════════════════════════════

import type { IBankProvider } from '../provider';
import type { BankProviderName } from '../types';
import { MockBankProvider } from './mock-provider';
import { createFutureProvider } from './future-providers';

let cachedProvider: IBankProvider | null = null;
let cachedName: BankProviderName | null = null;

/**
 * Resolve which provider to use based on the `BANK_PROVIDER` env var.
 *   • 'mock' / undefined → MockBankProvider (default)
 *   • 'aa'               → FutureAAProvider
 *   • 'razorpayx'        → FutureRazorpayXProvider
 *   • 'setu'             → FutureSetuProvider
 *   • 'perfios'          → FuturePerfiosProvider
 *   • 'finvu'            → FutureFinvuProvider
 */
export function getProviderName(): BankProviderName {
  const raw = (process.env.BANK_PROVIDER ?? 'mock').toLowerCase().trim();
  const valid: BankProviderName[] = ['mock', 'aa', 'razorpayx', 'setu', 'perfios', 'finvu'];
  return (valid as string[]).includes(raw) ? (raw as BankProviderName) : 'mock';
}

/**
 * Get the active banking provider. The provider is cached for the process
 * lifetime — switching providers requires a server restart (which is correct:
 * provider changes are an ops concern, not a runtime concern).
 *
 * Server-only: callers MUST be API routes or server services.
 */
export function getBankProvider(): IBankProvider {
  const name = getProviderName();
  // Return cached if the name hasn't changed.
  if (cachedProvider && cachedName === name) return cachedProvider;
  cachedProvider = name === 'mock' ? new MockBankProvider() : createFutureProvider(name);
  cachedName = name;
  return cachedProvider;
}

/**
 * For diagnostics — returns a description of the active provider.
 */
export function describeProvider(): {
  name: string;
  provider: BankProviderName;
  isLive: boolean;
  configured: boolean;
} {
  const provider = getBankProvider();
  return {
    name: provider.name,
    provider: provider.provider,
    isLive: provider.isLive,
    configured: true,
  };
}

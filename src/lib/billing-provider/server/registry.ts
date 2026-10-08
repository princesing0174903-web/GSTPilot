// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Billing™ — Provider Registry (SERVER-ONLY)
//
// The SINGLE switch-point between providers. Today returns MockRazorpayProvider
// by default; when PAYMENT_PROVIDER env var is set to one of the future provider
// names, the registry returns that provider.
//
// All existing pages communicate ONLY through IPaymentProvider (via the service
// layer). Switching to production later means changing exactly ONE env var —
// no service, hook, or UI code changes.
//
// This file is SERVER-ONLY — it imports the providers which use `node:crypto`.
// API routes are the only consumers.
// ═══════════════════════════════════════════════════════════════════════════════

import type { IPaymentProvider } from '../provider';
import type { PaymentProviderName } from '../types';
import { MockRazorpayProvider } from './mock-razorpay-provider';
import { MockStripeProvider } from './mock-stripe-provider';
import { FutureRazorpayProvider, FutureStripeProvider } from './future-providers';

const VALID_PROVIDERS: PaymentProviderName[] = [
  'mock-razorpay',
  'mock-stripe',
  'razorpay',
  'stripe',
];

const cache = new Map<PaymentProviderName, IPaymentProvider>();

/**
 * Resolve which provider to use based on the `PAYMENT_PROVIDER` env var.
 *   • 'mock-razorpay' / 'auto' / undefined → MockRazorpayProvider (default)
 *   • 'mock-stripe'                          → MockStripeProvider
 *   • 'razorpay'                             → FutureRazorpayProvider
 *   • 'stripe'                               → FutureStripeProvider
 */
export function getPaymentProviderName(): PaymentProviderName {
  const raw = (process.env.PAYMENT_PROVIDER ?? 'auto').toLowerCase().trim();
  if (raw === 'auto' || raw === '') return 'mock-razorpay';
  return (VALID_PROVIDERS as string[]).includes(raw) ? (raw as PaymentProviderName) : 'mock-razorpay';
}

/**
 * Get the active payment provider. The provider is cached per name for the
 * process lifetime — switching providers requires a server restart (which is
 * correct: provider changes are an ops concern, not a runtime concern).
 *
 * Server-only: callers MUST be API routes or server services.
 */
export function getPaymentProvider(
  providerName?: PaymentProviderName,
): IPaymentProvider {
  const name = providerName ?? getPaymentProviderName();
  const cached = cache.get(name);
  if (cached) return cached;

  let provider: IPaymentProvider;
  switch (name) {
    case 'mock-razorpay':
      provider = new MockRazorpayProvider();
      break;
    case 'mock-stripe':
      provider = new MockStripeProvider();
      break;
    case 'razorpay':
      provider = new FutureRazorpayProvider();
      break;
    case 'stripe':
      provider = new FutureStripeProvider();
      break;
    default:
      provider = new MockRazorpayProvider();
  }
  cache.set(name, provider);
  return provider;
}

/**
 * For diagnostics — returns a description of the active payment provider.
 */
export function describePaymentProvider(): {
  name: string;
  provider: PaymentProviderName;
  isLive: boolean;
  configured: boolean;
} {
  const provider = getPaymentProvider();
  return {
    name: provider.name,
    provider: provider.provider,
    isLive: provider.isLive,
    configured: true,
  };
}

/**
 * For diagnostics — returns a billing-provider descriptor with the four fields
 * the /api/billing/provider route reads: `name`, `provider`, `isLive`, `mode`.
 *
 * `mode` is `'live'` when the active provider makes real network calls to a
 * payment gateway, otherwise `'mock'`. Mirrors {@link describePaymentProvider}
 * (which exposes the same data plus a `configured` flag) and is the
 * billing-side alias the diagnostics route imports.
 */
export function describeBillingProvider(): {
  name: string;
  provider: string;
  isLive: boolean;
  mode: string;
} {
  const desc = describePaymentProvider();
  return {
    name: desc.name,
    provider: desc.provider,
    isLive: desc.isLive,
    mode: desc.isLive ? 'live' : 'mock',
  };
}

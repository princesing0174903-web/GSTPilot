// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Gmail & WhatsApp Business Automation™ — Provider Registry (SERVER-ONLY)
//
// The SINGLE switch-point between providers. Today returns the mock providers;
// when env vars are set to one of the future provider names, the registry
// returns that provider.
//
// All existing pages communicate ONLY through IGmailProvider / IWhatsAppProvider
// (via the service layer). Switching to production later means changing exactly
// ONE env var — no service, hook, or UI code changes.
//
// This file is SERVER-ONLY — it imports the providers which use `node:crypto`.
// API routes are the only consumers.
// ═══════════════════════════════════════════════════════════════════════════════

import type { IGmailProvider, IWhatsAppProvider } from '../provider';
import type { GmailProviderName, WhatsAppProviderName } from '../types';
import { createGmailProvider, createWhatsAppProvider } from './future-providers';

let cachedGmail: IGmailProvider | null = null;
let cachedGmailName: GmailProviderName | null = null;
let cachedWhatsApp: IWhatsAppProvider | null = null;
let cachedWhatsAppName: WhatsAppProviderName | null = null;

/**
 * Resolve which Gmail provider to use based on the `COMMUNICATION_GMAIL_PROVIDER`
 * env var.
 *   • 'mock' / undefined → MockGmailProvider (default)
 *   • 'google'           → FutureGoogleProvider
 */
export function getGmailProviderName(): GmailProviderName {
  const raw = (process.env.COMMUNICATION_GMAIL_PROVIDER ?? 'mock').toLowerCase().trim();
  const valid: GmailProviderName[] = ['mock', 'google'];
  return (valid as string[]).includes(raw) ? (raw as GmailProviderName) : 'mock';
}

/**
 * Resolve which WhatsApp provider to use based on the
 * `COMMUNICATION_WHATSAPP_PROVIDER` env var.
 *   • 'mock' / undefined → MockWhatsAppProvider (default)
 *   • 'meta'             → FutureMetaProvider
 */
export function getWhatsAppProviderName(): WhatsAppProviderName {
  const raw = (process.env.COMMUNICATION_WHATSAPP_PROVIDER ?? 'mock').toLowerCase().trim();
  const valid: WhatsAppProviderName[] = ['mock', 'meta'];
  return (valid as string[]).includes(raw) ? (raw as WhatsAppProviderName) : 'mock';
}

/** Get the active Gmail provider. Server-only. */
export function getGmailProvider(): IGmailProvider {
  const name = getGmailProviderName();
  if (cachedGmail && cachedGmailName === name) return cachedGmail;
  cachedGmail = createGmailProvider(name);
  cachedGmailName = name;
  return cachedGmail;
}

/** Get the active WhatsApp provider. Server-only. */
export function getWhatsAppProvider(): IWhatsAppProvider {
  const name = getWhatsAppProviderName();
  if (cachedWhatsApp && cachedWhatsAppName === name) return cachedWhatsApp;
  cachedWhatsApp = createWhatsAppProvider(name);
  cachedWhatsAppName = name;
  return cachedWhatsApp;
}

/** For diagnostics. */
export function describeGmailProvider(): {
  name: string;
  provider: GmailProviderName;
  isLive: boolean;
  configured: boolean;
} {
  const provider = getGmailProvider();
  return {
    name: provider.name,
    provider: provider.provider,
    isLive: provider.isLive,
    configured: true,
  };
}

export function describeWhatsAppProvider(): {
  name: string;
  provider: WhatsAppProviderName;
  isLive: boolean;
  configured: boolean;
} {
  const provider = getWhatsAppProvider();
  return {
    name: provider.name,
    provider: provider.provider,
    isLive: provider.isLive,
    configured: true,
  };
}

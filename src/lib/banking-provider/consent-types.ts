// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Real Banking Foundation™ — Consent Management Types
//
// Type definitions for the Account Aggregator consent lifecycle UI.
// These types are PURE (no Firebase, no Node imports) — safe for client code.
//
// PREPARATION MODE: these types are structurally complete and will be used
// by the consent-management UI. They map to the existing BankConnection
// fields (consentExpiry, status) + the Setu consent metadata (consentId,
// vua, linkedAccounts) that will be available once Setu is live.
// ═══════════════════════════════════════════════════════════════════════════════

import type { BankProviderName } from './types';

/**
 * The lifecycle status of an AA consent.
 *
 * Mirrors the Setu consent status enum (SetuConsentStatus) but mapped to
 * GSTPilot's UI-friendly names. The mapping happens in the SetuAAProvider
 * adapter once it's wired.
 */
export type ConsentStatus =
  | 'pending'      // consent requested, awaiting user approval on AA app
  | 'active'       // consent approved — sync enabled
  | 'rejected'     // user denied the consent request
  | 'revoked'      // user revoked after approval
  | 'expired';     // consent window elapsed

/**
 * A linked account discovered under an AA consent.
 *
 * Setu returns this in `consent.detail.accounts[]` after approval. Each
 * linked account has a `linkRefNumber` used to fetch data from the FIP.
 */
export interface LinkedAccount {
  /** Masked account number (last 4 digits visible). */
  maskedAccNumber: string;
  /** Account type from the FIP (SAVINGS / CURRENT / etc.). */
  accType: string;
  /** FIP id (e.g. 'HDFC-SB'). */
  fipId: string;
  /** Financial information type (DEPOSIT_ACCOUNT / TERM-DEPOSIT / etc.). */
  fiType: string;
  /** Stable link reference number — used to fetch data for this account. */
  linkRefNumber: string;
}

/**
 * A consent record for the consent-management UI.
 *
 * Derived from BankConnection + the Setu session metadata. When the Mock
 * provider is active, consentId/vua/linkedAccounts are null (Mock has no
 * real AA consent). When Setu is live, these fields are populated from
 * the decrypted session metadata.
 */
export interface BankConsent {
  /** The BankConnection id. */
  connectionId: string;
  /** The Setu consent id (null for Mock provider). */
  consentId: string | null;
  /** The provider that issued this consent. */
  provider: BankProviderName;
  /** Current consent status. */
  status: ConsentStatus;
  /** The VUA (mobile number) the consent was requested for (null for Mock). */
  vua: string | null;
  /** Masked account number. */
  accountNumberMasked: string;
  /** Bank/FIP name. */
  bankName: string;
  /** Linked accounts discovered under this consent (empty for Mock). */
  linkedAccounts: LinkedAccount[];
  /** ISO timestamp when the consent was requested. */
  requestedAt: string;
  /** ISO timestamp when the consent expires (null if already expired/revoked). */
  consentExpiry: string | null;
  /** ISO timestamp when the consent was approved (null if pending). */
  approvedAt: string | null;
  /** ISO timestamp when the consent was revoked/expired (null if active). */
  revokedAt: string | null;
  /** Days remaining until expiry (negative if expired). */
  daysRemaining: number;
}

/**
 * The consent history entry — one row per consent lifecycle event.
 */
export interface ConsentHistoryEntry {
  id: string;
  consentId: string | null;
  connectionId: string;
  /** The event type. */
  event:
    | 'consent_requested'
    | 'consent_approved'
    | 'consent_rejected'
    | 'consent_revoked'
    | 'consent_expired'
    | 'consent_refreshed'
    | 'data_synced';
  /** ISO timestamp of the event. */
  timestamp: string;
  /** Human-readable description. */
  description: string;
  /** The provider that generated this event. */
  provider: BankProviderName;
}

/**
 * The full consent-management view model — returned by the consent API
 * and consumed by the BankingConsentManager component.
 */
export interface ConsentManagementState {
  /** Active consents (status='active' or 'pending'). */
  activeConsents: BankConsent[];
  /** Historical consents (status='revoked' or 'expired'). */
  consentHistory: BankConsent[];
  /** Lifecycle event log (most recent first). */
  events: ConsentHistoryEntry[];
  /** Whether the Setu provider is configured (false in preparation mode). */
  setuConfigured: boolean;
  /** Whether the current provider is live (false for Mock + preparation mode). */
  providerLive: boolean;
}

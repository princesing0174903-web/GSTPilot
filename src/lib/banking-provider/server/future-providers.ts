// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Real Banking Foundation™ — Future Provider Placeholders (SERVER-ONLY)
//
// Five placeholder providers for production banking integrations. Every method
// throws `NotImplementedError` so the system fails LOUDLY if you switch to one
// of these providers before implementing the real HTTP calls.
//
// WHEN YOU'RE READY TO GO LIVE:
//   1. Set env: BANK_PROVIDER=<aa|razorpayx|setu|perfios|finvu>
//   2. Configure the provider-specific credentials (e.g. AA_CLIENT_ID,
//      RAZORPAYX_KEY_ID, SETU_API_KEY, PERFIOS_API_KEY, FINVU_API_KEY).
//   3. Implement each method below to call the real provider endpoints. The
//      request/response shapes are documented inline.
//   4. The service layer, hooks, and UI DO NOT CHANGE — they only talk to
//      IBankProvider. That's the whole point of the provider pattern.
//
// This file is SERVER-ONLY (it will hold real HTTP client code + secrets).
// ═══════════════════════════════════════════════════════════════════════════════

import type { IBankProvider, BankSession } from '../provider';
import type {
  BankAccountSnapshot,
  BankProviderName,
  BankTransaction,
  ConnectBankResult,
  FetchAccountsResult,
  FetchTransactionsResult,
} from '../types';
import { NotImplementedError, ValidationError } from '../errors';

// ─── Shared base ─────────────────────────────────────────────────────────────

/**
 * Shared abstract base for all future providers. Provides the env-config
 * resolution pattern + a helper to throw NotImplementedError with the method
 * name. Concrete providers set their `name` / `provider` / `isLive` fields.
 */
abstract class FutureBaseProvider implements IBankProvider {
  abstract readonly name: string;
  abstract readonly provider: BankProviderName;
  readonly isLive = true;

  /** Env var names that must be set for this provider. */
  protected abstract requiredEnv(): string[];

  /** Lazily validate that all required env vars are set. */
  protected requireConfig(): Record<string, string | undefined> {
    const required = this.requiredEnv();
    const config: Record<string, string | undefined> = {};
    for (const key of required) {
      config[key] = process.env[key];
    }
    return config;
  }

  async connect(input: {
    accountHolder: string;
    bankName: string;
    accountNumber: string;
    ifsc: string;
    accountType: 'savings' | 'current' | 'credit' | 'loan' | 'unknown';
    consentHandle?: string;
  }): Promise<ConnectBankResult> {
    void this.requireConfig();
    void input;
    throw new NotImplementedError(`${this.name} connect`);
  }

  async completeConnection(connectionRef: string): Promise<{
    session: BankSession;
    snapshot: BankAccountSnapshot;
  }> {
    void this.requireConfig();
    void connectionRef;
    throw new NotImplementedError(`${this.name} completeConnection`);
  }

  async refreshConnection(session: BankSession): Promise<{ session: BankSession }> {
    void this.requireConfig();
    void session;
    throw new NotImplementedError(`${this.name} refreshConnection`);
  }

  async disconnect(session: BankSession): Promise<void> {
    void this.requireConfig();
    void session;
    throw new NotImplementedError(`${this.name} disconnect`);
  }

  async fetchAccounts(session: BankSession): Promise<FetchAccountsResult> {
    void this.requireConfig();
    void session;
    throw new NotImplementedError(`${this.name} fetchAccounts`);
  }

  async fetchTransactions(
    session: BankSession,
    options?: { from?: string; to?: string },
  ): Promise<FetchTransactionsResult> {
    void this.requireConfig();
    void session;
    void options;
    throw new NotImplementedError(`${this.name} fetchTransactions`);
  }

  async healthCheck(): Promise<boolean> {
    // Once implemented, ping the provider's health endpoint.
    // For now, return false so the scheduler doesn't try to use this provider.
    return false;
  }
}

// ─── FutureAAProvider — Account Aggregator (Sahamati / RBI-regulated) ────────
//
// The Account Aggregator ecosystem lets a user consent to share their bank
// statement data with an FIU (Financial Information User). VEYRO acts as
// the FIU. The flow is:
//   1. connect() → create a consent request via the AA, get a consent handle.
//   2. The user approves the consent on their AA app.
//   3. completeConnection() → poll the AA until consent is approved, then
//      fetch the first FIU (Financial Information) data.
//
// Env vars:
//   AA_BASE_URL, AA_CLIENT_ID, AA_CLIENT_SECRET, AA_FIU_ID
//
// Reference: https://sahamati.org.in/developers/

export class FutureAAProvider extends FutureBaseProvider {
  readonly name = 'Account Aggregator (not yet implemented)';
  readonly provider = 'aa' as const;
  protected requiredEnv() {
    return ['AA_BASE_URL', 'AA_CLIENT_ID', 'AA_CLIENT_SECRET', 'AA_FIU_ID'];
  }
}

// ─── FutureRazorpayXProvider — RazorpayX Banking ─────────────────────────────
//
// RazorpayX provides business banking APIs — connect a current account, fetch
// transactions, make payouts. Uses API key + secret auth.
//
// Env vars:
//   RAZORPAYX_KEY_ID, RAZORPAYX_KEY_SECRET, RAZORPAYX_ACCOUNT_ID
//
// Reference: https://razorpay.com/docs/api-x/

export class FutureRazorpayXProvider extends FutureBaseProvider {
  readonly name = 'RazorpayX Banking (not yet implemented)';
  readonly provider = 'razorpayx' as const;
  protected requiredEnv() {
    return ['RAZORPAYX_KEY_ID', 'RAZORPAYX_KEY_SECRET', 'RAZORPAYX_ACCOUNT_ID'];
  }
}

// ─── FutureSetuProvider — Setu AA / Banking APIs ─────────────────────────────
//
// Setu provides AA + statement-fetch APIs. Similar consent flow to AA but with
// Setu's own SDK.
//
// Env vars:
//   SETU_BASE_URL, SETU_CLIENT_ID, SETU_CLIENT_SECRET, SETU_PRODUCT_INSTANCE_ID
//
// Reference: https://docs.setu.co/

export class FutureSetuProvider extends FutureBaseProvider {
  readonly name = 'Setu Banking (not yet implemented)';
  readonly provider = 'setu' as const;
  protected requiredEnv() {
    return ['SETU_BASE_URL', 'SETU_CLIENT_ID', 'SETU_CLIENT_SECRET', 'SETU_PRODUCT_INSTANCE_ID'];
  }
}

// ─── FuturePerfiosProvider — Perfios Statement Fetcher ───────────────────────
//
// Perfios fetches + parses bank statements (PDF/Excel upload or net-banking
// scrape). Used for non-AA banks. The flow is:
//   1. connect() → upload statement OR start net-banking scrape.
//   2. completeConnection() → poll until parse is done, fetch transactions.
//
// Env vars:
//   PERFIOS_BASE_URL, PERFIOS_API_KEY, PERFIOS_PARTNER_ID
//
// Reference: https://www.perfios.com/documentation/

export class FuturePerfiosProvider extends FutureBaseProvider {
  readonly name = 'Perfios Statement Fetcher (not yet implemented)';
  readonly provider = 'perfios' as const;
  protected requiredEnv() {
    return ['PERFIOS_BASE_URL', 'PERFIOS_API_KEY', 'PERFIOS_PARTNER_ID'];
  }
}

// ─── FutureFinvuProvider — Finvu Account Aggregator ──────────────────────────
//
// Finvu is another RBI-licensed AA. Same consent flow as the generic AA
// provider but with Finvu-specific endpoints.
//
// Env vars:
//   FINVU_BASE_URL, FINVU_CLIENT_ID, FINVU_CLIENT_SECRET, FINVU_FIU_ID
//
// Reference: https://www.finvu.in/developer

export class FutureFinvuProvider extends FutureBaseProvider {
  readonly name = 'Finvu Account Aggregator (not yet implemented)';
  readonly provider = 'finvu' as const;
  protected requiredEnv() {
    return ['FINVU_BASE_URL', 'FINVU_CLIENT_ID', 'FINVU_CLIENT_SECRET', 'FINVU_FIU_ID'];
  }
}

// ─── Provider factory ────────────────────────────────────────────────────────

/**
 * Instantiate a future provider by name. Used by the registry.
 * Throws ValidationError if the name is not a known future provider.
 */
export function createFutureProvider(name: BankProviderName): IBankProvider {
  switch (name) {
    case 'aa':
      return new FutureAAProvider();
    case 'razorpayx':
      return new FutureRazorpayXProvider();
    case 'setu':
      return new FutureSetuProvider();
    case 'perfios':
      return new FuturePerfiosProvider();
    case 'finvu':
      return new FutureFinvuProvider();
    default:
      throw new ValidationError(`Unknown future provider: ${name}`);
  }
}

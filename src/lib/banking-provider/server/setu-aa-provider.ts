// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Real Banking Foundation™ — Setu AA Provider (SERVER-ONLY, REAL)
//
// Implements the FULL `IBankProvider` contract against the live Setu Account
// Aggregator gateway. Uses the existing Setu SDK (`src/lib/setu/*`) — no second
// implementation.
//
// Consent flow (AA):
//   1. connect(vua) → POST /v2/consents → returns consent.id + consent.url
//      - The consent.url is the Setu-hosted webview where the user approves.
//      - We return it as `redirectUrl` so the frontend can open it.
//      - The connection is NOT complete yet — status = consent_pending.
//   2. User approves in the Setu webview → Setu redirects to our /banking/consent/return
//      - Setu also fires CONSENT_STATUS_UPDATE to /api/webhooks/setu.
//   3. completeConnection(consentId) → polls consent status; if ACTIVE, creates
//      a data session, fetches FI, returns the session + initial snapshot.
//
// CRITICAL CONSTRAINTS:
//   - If Setu env vars are NOT configured, every method throws BankingError
//     (code: SETU_NOT_CONFIGURED). We NEVER silently fall back to Mock.
//   - If Setu IS configured, we make REAL outbound calls to the Setu gateway.
//   - We never invent credentials or fake bank data.
//
// This file is SERVER-ONLY — it imports the Setu SDK which uses node:crypto.
// ═══════════════════════════════════════════════════════════════════════════════

import type { IBankProvider, BankSession } from '../provider';
import type {
  BankAccountSnapshot,
  BankTransaction,
  BankTransactionType,
  BankProviderName,
  ConnectBankResult,
  FetchAccountsResult,
  FetchTransactionsResult,
  TransactionCategory,
} from '../types';
import {
  BankingError,
  ConsentRejectedError,
  ConnectionExpiredError,
  ValidationError,
  TimeoutError,
} from '../errors';
import {
  getSetuClient,
  isSetuConfigured,
  setuLogger,
  parseAmount,
  type SetuConsent,
  type SetuSession,
} from '@/lib/setu';
import { categorizeTransaction, extractCounterparty, extractReferenceNumber } from '@/lib/banking/categorize';
import { db } from '@/lib/db';

// ─── In-memory consent store ─────────────────────────────────────────────────
// Maps consentId → connect-time metadata so completeConnection can reconstruct
// the VUA + account holder info. In production, this would be persisted to the
// SetuConsent Prisma table (the webhook route does persist there). The in-memory
// store is the fast-path for the completeConnection call that happens right
// after the user returns from the Setu webview.

interface SetuConnectionEntry {
  consentId: string;
  vua: string;
  accountHolder: string;
  bankName: string;
  ifsc: string;
  accountType: 'savings' | 'current' | 'credit' | 'loan' | 'unknown';
  redirectUrl: string | null;
  createdAt: number;
}

const connectionStore = new Map<string, SetuConnectionEntry>();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function maskVua(vua: string): string {
  // Mask the mobile number: show last 4 digits.
  const digits = vua.replace(/\D/g, '');
  if (digits.length < 4) return `••••${digits}`;
  return `••••${digits.slice(-4)}`;
}

function isValidVua(vua: string): boolean {
  // VUA is a 10-digit Indian mobile number, optionally with @aa-handle suffix.
  const digits = vua.replace(/\D/g, '');
  return /^\d{10}$/.test(digits);
}

function resolveRedirectUrl(): string {
  // SETU_REDIRECT_URL takes priority; otherwise derive from NEXT_PUBLIC_APP_URL.
  const explicit = process.env.SETU_REDIRECT_URL?.trim();
  if (explicit) return explicit;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (appUrl) return `${appUrl.replace(/\/$/, '')}/banking/consent/return`;
  return '';
}

// ─── SetuAAProvider ──────────────────────────────────────────────────────────

/**
 * Real Setu Account Aggregator provider. Implements IBankProvider against the
 * live Setu AA gateway via the existing Setu SDK.
 *
 * Behaviour:
 *   - If Setu is not configured (missing env vars), every method throws
 *     BankingError(code: SETU_NOT_CONFIGURED). NO silent fallback to Mock.
 *   - If Setu IS configured, methods make real outbound HTTPS calls to the
 *     Setu gateway.
 */
export class SetuAAProvider implements IBankProvider {
  readonly name = 'Setu Account Aggregator';
  readonly provider = 'setu' as const;
  readonly isLive = true;

  /**
   * Ensure Setu is configured. Throws a clear, actionable error if not.
   * This is the GATE — every public method calls this first.
   */
  private ensureConfigured(): void {
    if (!isSetuConfigured()) {
      throw new BankingError(
        'Setu is not configured. Set the following environment variables to enable the Setu AA provider: ' +
          'SETU_CLIENT_ID, SETU_CLIENT_SECRET, SETU_PRODUCT_INSTANCE_ID, SETU_BASE_URL, SETU_AUTH_URL, ' +
          'SETU_WEBHOOK_SECRET, and SETU_REDIRECT_URL (or NEXT_PUBLIC_APP_URL). ' +
          'To continue using the Sandbox (Mock) provider instead, set BANK_PROVIDER=mock.',
        {
          code: 'SETU_NOT_CONFIGURED',
          statusCode: 503,
          retryable: false,
        },
      );
    }
  }

  private getClient() {
    this.ensureConfigured();
    const client = getSetuClient();
    if (!client) {
      // Defensive — isSetuConfigured() returned true but getSetuClient() failed.
      throw new BankingError(
        'Setu client could not be initialized despite configuration being present. Check the server logs for details.',
        { code: 'SETU_CLIENT_INIT_FAILED', statusCode: 503, retryable: false },
      );
    }
    return client;
  }

  // ─── connect() ─────────────────────────────────────────────────────────────

  async connect(input: {
    accountHolder: string;
    bankName: string;
    accountNumber: string;
    ifsc: string;
    accountType: 'savings' | 'current' | 'credit' | 'loan' | 'unknown';
    consentHandle?: string;
  }): Promise<ConnectBankResult> {
    // Validate input.
    if (!input.accountHolder || input.accountHolder.trim().length < 2) {
      throw new ValidationError('Account holder name must be at least 2 characters.');
    }

    // For the AA flow, `accountNumber` carries the VUA (mobile number).
    // The user enters their mobile number; the actual bank account details
    // are discovered AFTER the user approves consent and Setu delivers the FI.
    const vua = input.accountNumber.replace(/\s+/g, '');
    if (!isValidVua(vua)) {
      throw new ValidationError(
        'A valid 10-digit mobile number is required for Setu AA consent. ' +
          'The mobile number must be registered with an Account Aggregator.',
      );
    }

    // Check Setu configuration FIRST (throws SETU_NOT_CONFIGURED with the full
    // list of missing vars) — before the redirect-URL check. This way the user
    // sees ALL missing config at once, not just the redirect URL.
    const client = this.getClient();

    // Resolve the redirect URL (where Setu sends the user after consent).
    const redirectUrl = resolveRedirectUrl();
    if (!redirectUrl) {
      throw new BankingError(
        'SETU_REDIRECT_URL (or NEXT_PUBLIC_APP_URL) must be set so Setu knows where to redirect the user after consent approval. ' +
          'Example: SETU_REDIRECT_URL=https://your-domain.com/banking/consent/return',
        { code: 'SETU_REDIRECT_NOT_CONFIGURED', statusCode: 503, retryable: false },
      );
    }

    // Create the consent request. Default: 12 months consent, last 12 months of data.
    const now = new Date();
    const twelveMonthsAgo = new Date(now.getTime() - 12 * 30 * 24 * 60 * 60 * 1000);

    let consent: SetuConsent;
    try {
      consent = await client.createConsent({
        vua,
        consentDuration: { unit: 'MONTH', value: '12' },
        dataRange: { from: twelveMonthsAgo.toISOString(), to: now.toISOString() },
        redirectUrl,
      });
    } catch (err) {
      setuLogger.error('connect() — createConsent failed', {
        vua: maskVua(vua),
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }

    // Store the connect-time metadata so completeConnection can use it.
    const entry: SetuConnectionEntry = {
      consentId: consent.id,
      vua,
      accountHolder: input.accountHolder.trim(),
      bankName: input.bankName?.trim() || '',
      ifsc: input.ifsc?.toUpperCase() || '',
      accountType: input.accountType,
      redirectUrl: consent.url || consent.redirectUrl || null,
      createdAt: Date.now(),
    };
    connectionStore.set(consent.id, entry);

    setuLogger.info('connect() — consent created', {
      consentId: consent.id,
      vua: maskVua(vua),
      hasUrl: !!consent.url,
    });

    return {
      connectionRef: consent.id,
      consentSentTo: maskVua(vua),
      accountNumberMasked: maskVua(vua),
      accountSnapshot: null, // Not known until consent is approved + FI is fetched.
      redirectUrl: consent.url || consent.redirectUrl || null,
      message:
        'Setu consent initiated. Redirect the user to the approval URL to continue. ' +
        'The connection will complete automatically when the user approves consent.',
    };
  }

  // ─── completeConnection() ──────────────────────────────────────────────────

  async completeConnection(connectionRef: string): Promise<{
    session: BankSession;
    snapshot: BankAccountSnapshot;
  }> {
    if (!connectionRef) {
      throw new ValidationError('connectionRef (consentId) is required.');
    }

    const client = this.getClient();
    const entry = connectionStore.get(connectionRef);

    // Poll the consent status. In production, the webhook usually fires before
    // this is called, but we poll defensively (the user might return from the
    // Setu webview before the webhook arrives).
    let consent: SetuConsent;
    try {
      consent = await client.getConsent(connectionRef);
    } catch (err) {
      setuLogger.error('completeConnection() — getConsent failed', {
        consentId: connectionRef,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }

    // Map consent status to outcomes.
    if (consent.status === 'REJECTED') {
      throw new ConsentRejectedError('The user rejected the Setu consent request.');
    }
    if (consent.status === 'EXPIRED') {
      throw new ConnectionExpiredError('The Setu consent has expired. Please reconnect.');
    }
    if (consent.status === 'REVOKED') {
      throw new ConnectionExpiredError('The Setu consent was revoked.');
    }
    if (consent.status !== 'ACTIVE') {
      // PENDING / INITIATED / PAUSED — not ready yet.
      throw new BankingError(
        `Consent is not yet approved (current status: ${consent.status}). ` +
          'The user must approve the consent in the Setu webview first.',
        { code: 'CONSENT_PENDING', statusCode: 409, retryable: true },
      );
    }

    // Consent is ACTIVE — create a data session to fetch the FI.
    const now = new Date();
    const dataRange = consent.detail?.dataRange ?? {
      from: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      to: now.toISOString(),
    };

    let session: SetuSession;
    try {
      session = await client.createSession({
        consentId: consent.id,
        dataRange,
        format: 'json',
      });
    } catch (err) {
      setuLogger.error('completeConnection() — createSession failed', {
        consentId: consent.id,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }

    // Poll the session until COMPLETED / FAILED / EXPIRED.
    const completed = await this.pollSession(
      client,
      session.id,
      5 * 60 * 1000, // 5 min timeout
      3000, // 3s poll interval
    );

    if (completed.status !== 'COMPLETED' && completed.status !== 'PARTIAL') {
      throw new BankingError(
        `Setu data session did not complete (status: ${completed.status}).`,
        { code: 'SESSION_FAILED', statusCode: 502, retryable: true },
      );
    }

    // Extract the first delivered account as the initial snapshot.
    const firstAccount = completed.fips?.flatMap((f) => f.accounts).find((a) => a.status === 'DELIVERED' && a.data);

    const vua = entry?.vua ?? '';
    const consentExpiry =
      consent.detail?.consentExpiry || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

    const bankSession: BankSession = {
      accessToken: consent.id, // The consentId is the handle for subsequent calls.
      provider: 'setu' as BankProviderName,
      accountNumberMasked: firstAccount?.maskedAccNumber ?? maskVua(vua),
      ifsc: entry?.ifsc || '',
      expiresAt: consentExpiry,
      metadata: {
        consentId: consent.id,
        sessionId: completed.id,
        vua,
        accountHolder: entry?.accountHolder ?? '',
        bankName: entry?.bankName ?? '',
        accountType: entry?.accountType ?? 'unknown',
      },
    };

    const currentBalance = parseAmount(firstAccount?.data?.account?.summary?.currentBalance);
    const snapshot: BankAccountSnapshot = {
      availableBalance: currentBalance,
      currentBalance,
      currency: firstAccount?.data?.account?.summary?.currency || 'INR',
      asOf: new Date().toISOString(),
      overdraftLimit: parseAmount(firstAccount?.data?.account?.summary?.currentODLimit),
    };

    setuLogger.info('completeConnection() — success', {
      consentId: consent.id,
      sessionId: completed.id,
      balance: currentBalance,
    });

    return { session: bankSession, snapshot };
  }

  // ─── pollSession() ─────────────────────────────────────────────────────────

  private async pollSession(
    client: ReturnType<typeof getSetuClient>,
    sessionId: string,
    timeoutMs: number,
    pollIntervalMs: number,
  ): Promise<SetuSession> {
    if (!client) throw new BankingError('Setu client unavailable', { code: 'SETU_NOT_CONFIGURED', statusCode: 503 });
    const deadline = Date.now() + timeoutMs;
    let last: SetuSession | null = null;

    while (Date.now() < deadline) {
      const session = await client.getSession(sessionId);
      last = session;
      if (
        session.status === 'COMPLETED' ||
        session.status === 'PARTIAL' ||
        session.status === 'FAILED' ||
        session.status === 'EXPIRED'
      ) {
        return session;
      }
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    throw new TimeoutError(
      `Setu data session ${sessionId} did not complete within ${timeoutMs}ms (last status: ${last?.status ?? 'unknown'}).`,
    );
  }

  // ─── refreshConnection() ───────────────────────────────────────────────────

  async refreshConnection(session: BankSession): Promise<{ session: BankSession }> {
    this.ensureConfigured();
    // Setu consents are long-lived (up to 12 months). "Refreshing" means
    // checking the consent is still ACTIVE. If it expired, the user must
    // re-consent (reconnect).
    const client = this.getClient();
    const consentId = session.metadata?.consentId as string | undefined;
    if (!consentId) {
      throw new ConnectionExpiredError('No consentId on session — cannot refresh.');
    }
    try {
      const consent = await client.getConsent(consentId);
      if (consent.status !== 'ACTIVE') {
        throw new ConnectionExpiredError(`Setu consent is ${consent.status}. Please reconnect.`);
      }
      return { session };
    } catch (err) {
      if (err instanceof ConnectionExpiredError) throw err;
      throw new BankingError(
        `Failed to refresh Setu connection: ${err instanceof Error ? err.message : String(err)}`,
        { code: 'REFRESH_FAILED', statusCode: 502, retryable: true },
      );
    }
  }

  // ─── disconnect() ──────────────────────────────────────────────────────────

  async disconnect(session: BankSession): Promise<void> {
    this.ensureConfigured();
    const client = this.getClient();
    const consentId = session.metadata?.consentId as string | undefined;
    if (!consentId) {
      // Nothing to revoke — idempotent no-op.
      return;
    }
    try {
      await client.revokeConsent(consentId);
      connectionStore.delete(consentId);
      setuLogger.info('disconnect() — consent revoked', { consentId });
    } catch (err) {
      // Idempotent — don't throw if the consent is already revoked/expired.
      setuLogger.warn('disconnect() — revoke failed (non-fatal)', {
        consentId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // ─── fetchAccounts() ───────────────────────────────────────────────────────

  async fetchAccounts(session: BankSession): Promise<FetchAccountsResult> {
    this.ensureConfigured();
    const client = this.getClient();
    const consentId = session.metadata?.consentId as string | undefined;
    if (!consentId) {
      throw new ConnectionExpiredError('No consentId on session.');
    }

    // Create a fresh session to get the latest balances.
    const now = new Date();
    const session_ = await client.createSession({
      consentId,
      dataRange: {
        from: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        to: now.toISOString(),
      },
      format: 'json',
    });

    const completed = await this.pollSession(client, session_.id, 60_000, 3000);
    const firstAccount = completed.fips?.flatMap((f) => f.accounts).find((a) => a.status === 'DELIVERED' && a.data);

    const currentBalance = parseAmount(firstAccount?.data?.account?.summary?.currentBalance);
    return {
      snapshot: {
        availableBalance: currentBalance,
        currentBalance,
        currency: firstAccount?.data?.account?.summary?.currency || 'INR',
        asOf: new Date().toISOString(),
        overdraftLimit: parseAmount(firstAccount?.data?.account?.summary?.currentODLimit),
      },
    };
  }

  // ─── fetchTransactions() ───────────────────────────────────────────────────

  async fetchTransactions(
    session: BankSession,
    options?: { from?: string; to?: string },
  ): Promise<FetchTransactionsResult> {
    this.ensureConfigured();
    const client = this.getClient();
    const consentId = session.metadata?.consentId as string | undefined;
    if (!consentId) {
      throw new ConnectionExpiredError('No consentId on session.');
    }

    const now = new Date();
    const from = options?.from ?? new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const to = options?.to ?? now.toISOString();

    const session_ = await client.createSession({
      consentId,
      dataRange: { from, to },
      format: 'json',
    });

    const completed = await this.pollSession(client, session_.id, 5 * 60 * 1000, 3000);

    // Map Setu transactions → BankTransaction.
    const transactions: BankTransaction[] = [];
    const accountId = session.accountNumberMasked;
    const orgId = (session.metadata?.organizationId as string) ?? '';

    for (const fip of completed.fips ?? []) {
      for (const acc of fip.accounts) {
        if (acc.status !== 'DELIVERED' || !acc.data) continue;
        const setuTxns = acc.data.account?.transactions?.transaction ?? [];
        for (const tx of setuTxns) {
          const type: BankTransactionType = tx.type === 'CREDIT' ? 'credit' : 'debit';
          const amount = parseAmount(tx.amount);
          const description = tx.narration || tx.mode || `${type} transaction`;
          const date = (tx.transactionTimestamp || tx.valueDate || '').slice(0, 10);

          const category: TransactionCategory = categorizeTransaction({
            description,
            type,
            amount,
            counterparty: extractCounterparty(description),
          });

          transactions.push({
            id: tx.txnId || `${accountId}-${date}-${transactions.length}`,
            organizationId: orgId,
            connectionId: consentId,
            accountId,
            date,
            description,
            amount,
            type,
            balance: tx.currentBalance ? parseAmount(tx.currentBalance) : null,
            category,
            counterparty: extractCounterparty(description),
            referenceNumber: tx.reference || extractReferenceNumber(description),
            invoiceId: null,
            reconciled: 'unmatched',
            matchConfidence: 0,
            syncedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
      }
    }

    setuLogger.info('fetchTransactions() — fetched', {
      consentId,
      count: transactions.length,
    });

    return { transactions };
  }

  // ─── healthCheck() ─────────────────────────────────────────────────────────

  async healthCheck(): Promise<boolean> {
    if (!isSetuConfigured()) return false;
    try {
      const client = getSetuClient();
      if (!client) return false;
      const result = await client.healthCheck();
      return result.ok;
    } catch {
      return false;
    }
  }
}

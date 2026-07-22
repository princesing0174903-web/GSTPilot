// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Setu SDK — Account Mapping Helpers
// ═══════════════════════════════════════════════════════════════════════════════
//
// Converts Setu's nested `data.fips[].accounts[].data.account` structure into
// our flat `BankingAccount` shape (from `@/lib/banking-service/types`).
//
// Key mapping rules:
//   - Account id is namespaced `setu:${orgId}:${linkRefNumber}` so it can never
//     collide with mock-provider ids (`bacct-001`) or manual entries.
//   - Masked account numbers are normalized to `••••` style for UI consistency.
//   - SAVINGS→'savings', CURRENT→'current', *OD*→'overdraft', else 'current'.
//   - Available balance = ledger balance - holds (drawingLimit). For overdraft
//     accounts, available = balance + currentODLimit.
//   - status: ACTIVE→'connected', everything else→'error'.
// ═══════════════════════════════════════════════════════════════════════════════

import type { BankingAccount, AccountType, AccountStatus } from '@/lib/banking-service/types';
import type { SetuAccountData, SetuSession, SetuFIPAccount, SetuFIP } from './types';
import { parseAmount } from './utils';

/**
 * Flatten a session's `fips[].accounts[].data` into a flat list, preserving
 * the originating `fipId` on each entry (so callers can look up the bank name).
 *
 * Accounts without delivered data are still included (with `account` undefined)
 * so callers can see "this account exists but Setu didn't deliver data yet".
 */
export function fetchAccountsFromSession(
  session: SetuSession,
): Array<{ account?: SetuAccountData; fipId: string; linkRefNumber: string; maskedAccNumber: string; status: string }> {
  const out: Array<{
    account?: SetuAccountData;
    fipId: string;
    linkRefNumber: string;
    maskedAccNumber: string;
    status: string;
  }> = [];
  for (const fip of session.fips ?? []) {
    for (const acc of fip.accounts ?? []) {
      out.push({
        account: acc.data?.account,
        fipId: fip.fipID,
        linkRefNumber: acc.linkRefNumber,
        maskedAccNumber: acc.maskedAccNumber,
        status: acc.status,
      });
    }
  }
  return out;
}

/**
 * Convenience: collect just the delivered `SetuAccountData` payloads from a
 * session (skipping accounts that haven't reached DELIVERED yet).
 */
export function collectDeliveredAccounts(session: SetuSession): Array<{
  account: SetuAccountData;
  fipId: string;
  fipAccount: SetuFIPAccount;
}> {
  const out: Array<{ account: SetuAccountData; fipId: string; fipAccount: SetuFIPAccount }> = [];
  for (const fip of session.fips ?? []) {
    for (const acc of fip.accounts ?? []) {
      if (acc.data?.account) {
        out.push({ account: acc.data.account, fipId: fip.fipID, fipAccount: acc });
      }
    }
  }
  return out;
}

/**
 * Pull the FIP name from a session's fip block (used when callers have a
 * session in hand but not a separate FIP list call).
 */
export function fipNameFromSession(session: SetuSession, fipId: string): string | undefined {
  const fip = (session.fips ?? []).find((f: SetuFIP) => f.fipID === fipId);
  return fip?.fipID;
}

/**
 * Normalize a Setu masked account number to GSTPilot's `••••` style.
 *   "XXXXXX4373"  → "••••4373"
 *   "xxxxxx4373"  → "••••4373"
 *   "••••4373"    → "••••4373" (idempotent)
 *   ""            → "••••"
 */
export function normalizeMaskedAccount(raw: string | undefined): string {
  if (!raw) return '••••';
  // Strip leading X/x (Setu masks with XXXXXX). Keep last 4 chars.
  const stripped = raw.replace(/^[xX]+/, '');
  const tail = stripped.length >= 4 ? stripped.slice(-4) : stripped.padStart(4, '•');
  return `••••${tail}`;
}

/**
 * Map a Setu account type string to our canonical AccountType.
 *   SAVINGS              → 'savings'
 *   CURRENT              → 'current'
 *   (anything with OD)   → 'overdraft'
 *   (anything with CREDIT/CARD) → 'credit_card'
 *   else                 → 'current'
 */
export function mapAccountType(raw: string | undefined): AccountType {
  const t = (raw ?? '').toUpperCase();
  if (t.includes('SAVINGS')) return 'savings';
  if (t.includes('CURRENT')) return 'current';
  if (t.includes('OD') || t.includes('OVERDRAFT')) return 'overdraft';
  if (t.includes('CREDIT') || t.includes('CARD')) return 'credit_card';
  return 'current';
}

/**
 * Map a Setu account status string to our canonical AccountStatus.
 *   ACTIVE   → 'connected'
 *   anything → 'error'
 */
export function mapAccountStatus(raw: string | undefined): AccountStatus {
  const s = (raw ?? '').toUpperCase();
  if (s === 'ACTIVE') return 'connected';
  return 'error';
}

/**
 * THE KEY MAPPING. Convert a Setu account payload to our `BankingAccount`.
 *
 * @param setuAccount Setu's `data.account` object
 * @param fipId The originating FIP id (e.g. "HDFC001")
 * @param fipName Display name for the bank (e.g. "HDFC Bank") — falls back to fipId
 * @param orgId GSTPilot org id (used to namespace the account id)
 */
export function mapSetuAccountToBanking(
  setuAccount: SetuAccountData,
  fipId: string,
  fipName: string,
  orgId: string,
): BankingAccount {
  const summary = setuAccount.summary;
  const linkRefNumber =
    setuAccount.linkedAccRef ?? setuAccount.maskedAccNumber ?? fipId;
  const holderName = setuAccount.profile?.holders?.holder?.name;

  const accountType = mapAccountType(summary?.type);
  const balance = parseAmount(summary?.currentBalance);
  const drawingLimit = parseAmount(summary?.drawingLimit);
  const odLimit = parseAmount(summary?.currentODLimit);

  // Available balance logic per spec:
  //   - Overdraft accounts: balance + OD limit (you can draw down into the OD).
  //   - Otherwise: balance - drawingLimit (holds).
  let availableBalance: number;
  if (accountType === 'overdraft') {
    availableBalance = balance + odLimit;
  } else {
    availableBalance = balance - drawingLimit;
  }

  const bankLabel = fipName || fipId;
  const typeLabel = (summary?.type ?? 'ACCOUNT').toUpperCase();
  const accountName = holderName
    ? `${bankLabel} ${typeLabel} — ${holderName}`
    : `${bankLabel} ${typeLabel}`;

  const now = new Date().toISOString();
  const lastSyncAt = summary?.balanceDateTime ?? now;

  return {
    id: `setu:${orgId}:${linkRefNumber}`,
    bankName: bankLabel,
    accountName,
    accountMasked: normalizeMaskedAccount(setuAccount.maskedAccNumber ?? summary?.currentBalance),
    accountType,
    ifsc: summary?.ifscCode,
    balance,
    availableBalance,
    currency: summary?.currency || 'INR',
    overdraftLimit: odLimit > 0 ? odLimit : undefined,
    status: mapAccountStatus(summary?.status),
    lastSyncAt,
    createdAt: now,
    updatedAt: now,
  };
}

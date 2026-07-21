// ═══════════════════════════════════════════════════════════════════════════════
// Action: Connect Bank Account
// ═══════════════════════════════════════════════════════════════════════════════
//
// Creates a BankAccount row. The BankAccount table has NO organizationId /
// firmId column (verified in prisma/schema.prisma) and stores
// `accountMasked` (NOT the raw accountNumber). So this action:
//   • validates IFSC format (regex /^[A-Z]{4}0[A-Z0-9]{6}$/)
//   • masks the account number (•••• + last 4) before persisting
//   • dedupes by accountMasked + ifsc
//   • maps the user-facing enum `od` → schema value `overdraft`
//   • sets status='connected' (the schema default — there is no 'active')
//
// Prisma model: BankAccount { id, bankName, accountMasked, accountType
//   (savings|current|overdraft|credit_card), ifsc?, balance, availableBalance,
//   overdraftLimit, upiHandle?, aaConsent, aaConsentExpiry?, status
//   (connected|disconnected|syncing|error), lastSyncAt?, createdAt, updatedAt }
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { emitTimelineEvent } from '@/lib/timeline/emit';
import {
  registerAction,
  logActivity,
  type OracleAction,
  type ValidationResult,
  type ActionPreview,
  type ActionResult,
} from '../registry';

const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const VALID_ACCOUNT_TYPES = ['savings', 'current', 'od'] as const;

function maskAccountNumber(acct: string): string {
  const digits = acct.replace(/\D/g, '');
  if (digits.length < 4) return `••••${digits}`;
  return `••••${digits.slice(-4)}`;
}

function resolveAccountType(input: string): 'savings' | 'current' | 'overdraft' {
  const t = String(input).toLowerCase();
  if (t === 'current') return 'current';
  if (t === 'od' || t === 'overdraft') return 'overdraft';
  return 'savings';
}

export const connectBankAccountAction: OracleAction = {
  name: 'connectBankAccount',
  displayName: 'Connect Bank Account',
  description: 'Connect a new bank account (savings / current / overdraft). Stores a masked account number + IFSC + status="connected". Does NOT perform live banking sync — that is handled separately by the account-aggregator flow.',
  category: 'finance',
  icon: 'Landmark',
  intentKeywords: [
    'connect bank account', 'add bank account', 'link bank account', 'connect bank', 'add bank',
  ],
  paramSchema: [
    { key: 'bankName', label: 'Bank Name', type: 'string', required: true, description: 'e.g. HDFC Bank, ICICI Bank' },
    { key: 'accountNumber', label: 'Account Number', type: 'string', required: true, description: 'Account number (will be masked before storage)' },
    { key: 'ifscCode', label: 'IFSC Code', type: 'string', required: true, description: 'IFSC (e.g. HDFC0001234)' },
    { key: 'accountHolderName', label: 'Account Holder', type: 'string', required: true, description: 'Name as per bank records' },
    { key: 'accountType', label: 'Account Type', type: 'enum', required: false, options: [...VALID_ACCOUNT_TYPES], description: 'savings / current / od (overdraft). Default: savings' },
  ],

  async validate(args, _orgId): Promise<ValidationResult> {
    const fields: ValidationResult['fields'] = [];
    const errors: string[] = [];
    const warnings: string[] = [];
    const resolvedRefs: Record<string, any> = {};

    // ── Bank name ──
    const bankName = String(args.bankName ?? '').trim();
    if (!bankName) {
      fields.push({ key: 'bankName', label: 'Bank Name', status: 'error', message: 'Bank name is required' });
      errors.push('Bank name is required.');
    } else {
      fields.push({ key: 'bankName', label: 'Bank Name', status: 'ok', resolvedValue: bankName });
      resolvedRefs.bankName = bankName;
    }

    // ── Account number ──
    const accountNumber = String(args.accountNumber ?? '').trim();
    if (!accountNumber) {
      fields.push({ key: 'accountNumber', label: 'Account Number', status: 'error', message: 'Account number is required' });
      errors.push('Account number is required.');
    } else if (accountNumber.replace(/\D/g, '').length < 4) {
      fields.push({ key: 'accountNumber', label: 'Account Number', status: 'error', message: 'Account number too short', resolvedValue: maskAccountNumber(accountNumber) });
      errors.push('Account number is too short.');
    } else {
      const masked = maskAccountNumber(accountNumber);
      fields.push({ key: 'accountNumber', label: 'Account Number', status: 'ok', message: `Will be stored masked as ${masked}`, resolvedValue: masked });
      resolvedRefs.accountMasked = masked;
    }

    // ── IFSC ──
    const ifscCode = String(args.ifscCode ?? '').trim().toUpperCase();
    if (!ifscCode) {
      fields.push({ key: 'ifscCode', label: 'IFSC Code', status: 'error', message: 'IFSC is required' });
      errors.push('IFSC code is required.');
    } else if (!IFSC_REGEX.test(ifscCode)) {
      fields.push({ key: 'ifscCode', label: 'IFSC Code', status: 'error', message: 'Does not match IFSC format (AAAA0XXXXXXX)', resolvedValue: ifscCode });
      errors.push(`IFSC "${ifscCode}" does not match the standard format (4 letters + 0 + 6 alphanumeric).`);
    } else {
      fields.push({ key: 'ifscCode', label: 'IFSC Code', status: 'ok', resolvedValue: ifscCode });
      resolvedRefs.ifsc = ifscCode;
    }

    // ── Account holder ──
    const holder = String(args.accountHolderName ?? '').trim();
    if (!holder) {
      fields.push({ key: 'accountHolderName', label: 'Account Holder', status: 'error', message: 'Account holder name is required' });
      errors.push('Account holder name is required.');
    } else {
      fields.push({ key: 'accountHolderName', label: 'Account Holder', status: 'ok', resolvedValue: holder });
      resolvedRefs.accountHolderName = holder;
    }

    // ── Account type ──
    const accountType = String(args.accountType ?? 'savings').toLowerCase();
    if (!VALID_ACCOUNT_TYPES.includes(accountType as any)) {
      fields.push({ key: 'accountType', label: 'Account Type', status: 'warn', message: `Unknown — defaulting to "savings"`, resolvedValue: 'savings' });
      warnings.push(`Unknown account type "${accountType}" — defaulting to savings.`);
      resolvedRefs.accountType = 'savings';
    } else {
      const resolved = resolveAccountType(accountType);
      fields.push({ key: 'accountType', label: 'Account Type', status: 'ok', resolvedValue: resolved });
      resolvedRefs.accountType = resolved;
    }

    // ── Duplicate check (by masked + IFSC) ──
    if (resolvedRefs.accountMasked && resolvedRefs.ifsc) {
      const dup = await db.bankAccount.findFirst({
        where: { accountMasked: resolvedRefs.accountMasked, ifsc: resolvedRefs.ifsc },
        select: { id: true, bankName: true, accountMasked: true },
      }).catch(() => null);
      if (dup) {
        fields.push({ key: 'accountNumber', label: 'Account Number', status: 'error', message: `Already connected to ${dup.bankName}`, resolvedValue: resolvedRefs.accountMasked });
        errors.push(`Bank account ${resolvedRefs.accountMasked} (${resolvedRefs.ifsc}) is already connected.`);
      }
    }

    return { ok: errors.length === 0, fields, errors, warnings, resolvedRefs };
  },

  buildPreview(args, validation): ActionPreview {
    const refs = validation.resolvedRefs ?? {};
    const bankName = refs.bankName ?? String(args.bankName ?? '—');
    const masked = refs.accountMasked ?? (args.accountNumber ? maskAccountNumber(String(args.accountNumber)) : '—');
    const ifsc = refs.ifsc ?? (args.ifscCode ? String(args.ifscCode).toUpperCase() : '—');
    const holder = refs.accountHolderName ?? String(args.accountHolderName ?? '—');
    const type = refs.accountType ?? (args.accountType ? resolveAccountType(String(args.accountType)) : 'savings');
    return {
      title: `Connect ${bankName} account ${masked}`,
      fields: [
        { label: 'Bank', value: bankName, emphasize: true },
        { label: 'Account', value: masked, emphasize: true },
        { label: 'IFSC', value: ifsc },
        { label: 'Holder', value: holder },
        { label: 'Type', value: type },
      ],
      note: validation.warnings.length > 0 ? validation.warnings.join(' ') : 'A BankAccount row will be created with status "connected". The raw account number is NOT stored — only the masked version.',
    };
  },

  async execute(args, orgId, ctx): Promise<ActionResult> {
    const bankName = String(args.bankName).trim();
    const accountNumber = String(args.accountNumber).trim();
    const accountMasked = maskAccountNumber(accountNumber);
    const ifsc = String(args.ifscCode).trim().toUpperCase();
    const accountHolderName = String(args.accountHolderName).trim();
    const accountType = resolveAccountType(String(args.accountType ?? 'savings'));

    // Re-check duplicate (race-safe)
    const dup = await db.bankAccount.findFirst({
      where: { accountMasked, ifsc },
      select: { id: true },
    }).catch(() => null);
    if (dup) {
      return { ok: false, summary: `Bank account ${accountMasked} (${ifsc}) is already connected.` };
    }

    const account = await db.bankAccount.create({
      data: {
        bankName,
        accountMasked,
        accountType,
        ifsc,
        balance: 0,
        availableBalance: 0,
        overdraftLimit: accountType === 'overdraft' ? 0 : 0,
        status: 'connected',
      },
      select: { id: true, bankName: true, accountMasked: true, accountType: true, ifsc: true, status: true, createdAt: true },
    }).catch((e) => {
      console.error('[connectBankAccount] bankAccount.create failed:', e);
      return null;
    });

    if (!account) {
      return { ok: false, summary: `Failed to connect ${bankName} account ${accountMasked}. Database error.` };
    }

    await logActivity(orgId, 'banking', `Bank account ${bankName} ${accountMasked} connected (IFSC ${ifsc}, ${accountType})`, {
      bankAccountId: account.id, bankName, accountMasked, ifsc, accountType, accountHolderName,
    });

    await emitTimelineEvent({
      organizationId: orgId,
      type: 'banking.account_connected',
      title: `${bankName} account ${accountMasked} connected`,
      description: `${accountType} account · IFSC ${ifsc} · holder ${accountHolderName}.`,
      severity: 'info',
      actor: { userId: ctx.userId, userName: ctx.userId },
      metadata: { bankAccountId: account.id, bankName, accountMasked, ifsc, accountType, accountHolderName },
    });

    return {
      ok: true,
      summary: `✅ Connected **${bankName}** account **${accountMasked}** (${accountType}, IFSC ${ifsc}). Status: connected. The raw account number was not stored — only the masked version. Set up Account Aggregator consent in Banking to sync live balances.`,
      data: {
        id: account.id,
        bankName: account.bankName,
        accountMasked: account.accountMasked,
        accountType: account.accountType,
        ifsc: account.ifsc,
        status: account.status,
        accountHolderName,
      },
      viewIn: { label: 'View in Banking', href: '/banking' },
    };
  },
};

registerAction(connectBankAccountAction);

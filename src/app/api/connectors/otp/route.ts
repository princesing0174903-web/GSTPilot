// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/connectors/otp
//   Body: { userId, type, identifier, channel? }
//   Generates a fake-but-persisted OTP code for the multi-step connector workflow
//   (GSTN OTP-to-mobile, Bank Account Aggregator consent, etc.).
//
//   The OTP is stored in an in-memory Map keyed by `userId:type:identifier` for
//   ~5 minutes — long enough for a user to enter it in the verify step. It is
//   also persisted as an AuditLog entry so the action is fully traceable.
//
//   Returns: { otp, expiresAt, channel } — the OTP is intentionally returned so
//   the UI can display it (since we don't really send SMS).
//
//   GATING: Dev-only. Returns 503 when `NODE_ENV === 'production'` — the
//   fake-but-persisted OTP generator is a dev-workflow convenience and must
//   never run in production (where a real SMS / AA consent OTP gateway would
//   be used instead).
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { safeAudit } from '@/lib/audit/safe-write';

const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface OtpEntry {
  otp: string;
  expiresAt: number;
}

// In-memory store — keyed by `${userId}:${type}:${identifier}`
const otpStore = new Map<string, OtpEntry>();

// Periodic cleanup (every 5 min) — runs lazily on access too.
function cleanupOtpStore() {
  const now = Date.now();
  for (const [k, v] of otpStore.entries()) {
    if (v.expiresAt <= now) otpStore.delete(k);
  }
}

function generateOtp(): string {
  // 6-digit code
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(request: NextRequest) {
  // GATING: fake-but-persisted OTP is dev-only — never run in production.
  // A real SMS / AA consent OTP gateway must be wired up for production use.
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Fake OTP generator is dev-only. Configure a real SMS / Account Aggregator OTP gateway for production.' },
      { status: 503 },
    );
  }

  let body: {
    userId?: string;
    type?: string;
    identifier?: string;
    channel?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const userId = body.userId;
  const type = body.type ?? 'gstn';
  const identifier = body.identifier;
  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }
  if (!identifier) {
    return NextResponse.json({ error: 'identifier is required' }, { status: 400 });
  }

  cleanupOtpStore();

  const otp = generateOtp();
  const expiresAt = Date.now() + OTP_TTL_MS;
  const key = `${userId}:${type}:${identifier}`;
  otpStore.set(key, { otp, expiresAt });

  const channel = body.channel ?? (type === 'bank' ? 'Account Aggregator' : 'Registered Mobile');

  // Persist an AuditLog entry — fully traceable OTP generation event.
  try {
    await safeAudit({
      userId,
      action: 'OTP_GENERATED',
      entity: 'DataConnection',
      entityId: identifier,
      newValue: JSON.stringify({ type, identifier, channel, expiresAt: new Date(expiresAt).toISOString() }),
      details: `Generated OTP for ${type.toUpperCase()} ${identifier} via ${channel}`,
    });
  } catch (err) {
    console.warn('[OTP] AuditLog write failed:', err);
  }

  return NextResponse.json({
    success: true,
    otp,
    channel,
    expiresAt: new Date(expiresAt).toISOString(),
    message: `OTP sent to ${channel}`,
  });
}

// Exported helper for the verify endpoint / sync route — not exposed over HTTP.
export function _consumeOtp(userId: string, type: string, identifier: string, submitted: string): boolean {
  const key = `${userId}:${type}:${identifier}`;
  const entry = otpStore.get(key);
  if (!entry) return false;
  if (entry.expiresAt <= Date.now()) {
    otpStore.delete(key);
    return false;
  }
  if (entry.otp !== submitted) return false;
  // one-time use
  otpStore.delete(key);
  return true;
}

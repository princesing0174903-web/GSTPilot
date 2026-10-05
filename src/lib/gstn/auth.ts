// ═══════════════════════════════════════════════════════════════════════════════
// GSTN Auth — OTP + session token management (simulated)
// In production, integrate with GSTN's OTP-based auth flow.
// ═══════════════════════════════════════════════════════════════════════════════

export interface GstnSession {
  gstin: string;
  authToken: string;
  expiresAt: string;
  status: 'active' | 'expired' | 'pending_otp';
}

const sessions = new Map<string, GstnSession>();

export async function initiateOtp(gstin: string): Promise<{ sent: boolean; txnId: string }> {
  return { sent: true, txnId: `TXN${Date.now()}` };
}

export async function verifyOtp(gstin: string, _otp: string): Promise<GstnSession> {
  const session: GstnSession = {
    gstin,
    authToken: `AUTH${gstin.slice(0, 5)}${Date.now().toString(36)}`,
    expiresAt: new Date(Date.now() + 6 * 3600_000).toISOString(),
    status: 'active',
  };
  sessions.set(gstin, session);
  return session;
}

export async function getSession(gstin: string): Promise<GstnSession | null> {
  const s = sessions.get(gstin);
  if (!s) return null;
  if (new Date(s.expiresAt).getTime() < Date.now()) {
    s.status = 'expired';
    return s;
  }
  return s;
}

export async function requireSession(gstin: string): Promise<void> {
  const s = await getSession(gstin);
  if (!s || s.status !== 'active') {
    throw new Error(`GSTN session not active for ${gstin}. Initiate OTP first.`);
  }
}

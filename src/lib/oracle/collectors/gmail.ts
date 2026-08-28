// ═══════════════════════════════════════════════════════════════════════════════
// Oracle Intelligence Engine — Gmail Collector
//
// Reads recent Gmail messages via the Google Workspace token store. Classifies
// messages into loose business buckets (GST notices, vendor invoices, client
// invoices, tax communications) so downstream analyzers can act on them.
//
// Graceful contract: if Google Workspace is not connected, returns an empty
// GmailData with connected=false — never throws.
// ═══════════════════════════════════════════════════════════════════════════════

import 'server-only';

// Google integration removed — stub for rebuild
const getValidAccessToken = async () => ({ accessToken: null, error: 'Google integration rebuilding', permanent: false });
const loadTokens = async () => ({ tokens: null, stored: null });
const gmail = { listMessages: async () => ({ messages: [] }) };
import type {
  Collector,
  CollectorContext,
  CollectorResult,
  GmailBucket,
  GmailData,
  GmailMessageSummary,
} from '../types';

// ─── Bucket classifier ───────────────────────────────────────────────────────

const GST_NOTICE_PATTERNS = [
  /\bgst\s*(notice|asn|drc|show\s*cause|scn|order|summons)\b/i,
  /\bcircular\s*no\b/i,
  /\bcbic\b/i,
  /\bdepartment\s*of\s*revenue\b/i,
  /\bnotice\s*under\s*section\b/i,
];

const VENDOR_INVOICE_PATTERNS = [
  /\binvoice\s*from\b/i,
  /\bbill\s*from\b/i,
  /\bpurchase\s*invoice\b/i,
  /\bvendor\s*invoice\b/i,
  /\bbill\s*no\b/i,
];

const CLIENT_INVOICE_PATTERNS = [
  /\binvoice\s*(inv|num|no|#)\s*[\w-]/i,
  /\bpayment\s*due\b/i,
  /\bamount\s*payable\b/i,
  /\bthanks\s*for\s*your\s*business\b/i,
];

const TAX_COMMUNICATION_PATTERNS = [
  /\bgstr\b/i,
  /\bgst\s*return\b/i,
  /\btds\b/i,
  /\bincome\s*tax\b/i,
  /\bform\s*16\b/i,
  /\b16a\b/i,
  /\b26as\b/i,
  /\bintimation\s*u\/s\b/i,
];

function classifySubject(subject: string): GmailBucket {
  if (!subject) return 'other';
  if (GST_NOTICE_PATTERNS.some((re) => re.test(subject))) return 'gst_notice';
  if (TAX_COMMUNICATION_PATTERNS.some((re) => re.test(subject))) return 'tax_communication';
  if (VENDOR_INVOICE_PATTERNS.some((re) => re.test(subject))) return 'vendor_invoice';
  if (CLIENT_INVOICE_PATTERNS.some((re) => re.test(subject))) return 'client_invoice';
  return 'other';
}

function headerValue(
  headers: Array<{ name: string; value: string }> | undefined,
  name: string,
): string {
  if (!headers) return '';
  const h = headers.find((x) => x.name.toLowerCase() === name.toLowerCase());
  return h?.value ?? '';
}

function emptyData(): GmailData {
  return {
    email: null,
    messagesTotal: null,
    recent: [],
    buckets: { gst_notice: 0, vendor_invoice: 0, client_invoice: 0, tax_communication: 0, other: 0 },
  };
}

// ─── Collector ────────────────────────────────────────────────────────────────

export const gmailCollector: Collector<GmailData> = {
  id: 'gmail',
  label: 'Gmail',
  async collect(ctx: CollectorContext): Promise<CollectorResult<GmailData>> {
    const collectedAt = new Date().toISOString();

    // No org context → cannot look up tokens.
    if (!ctx.organizationId) {
      return {
        source: 'gmail',
        connected: false,
        recordCount: 0,
        data: emptyData(),
        collectedAt,
      };
    }

    // Confirm tokens exist at all (avoids a needless access-token refresh).
    const { tokens, stored } = await loadTokens(ctx.organizationId, ctx.userId);
    if (!tokens || !stored) {
      return {
        source: 'gmail',
        connected: false,
        recordCount: 0,
        data: emptyData(),
        collectedAt,
      };
    }

    // Get a valid (possibly refreshed) access token.
    const { accessToken, error: tokenError } = await getValidAccessToken(
      ctx.organizationId,
      ctx.userId,
    );
    if (tokenError || !accessToken) {
      return {
        source: 'gmail',
        connected: false,
        recordCount: 0,
        data: emptyData(),
        error: tokenError ?? 'No access token.',
        collectedAt,
      };
    }

    // Fetch profile + recent messages in parallel.
    const [profileRes, messagesRes] = await Promise.all([
      gmail.getProfile(accessToken),
      gmail.listMessages(accessToken, 30),
    ]);

    const email = profileRes.data?.emailAddress ?? stored.userEmail ?? null;
    const messagesTotal = profileRes.data?.messagesTotal ?? null;
    const rawMessages = messagesRes.data?.messages ?? [];

    const recent: GmailMessageSummary[] = rawMessages.map((m) => {
      const headers = m.payload?.headers ?? [];
      return {
        id: m.id,
        threadId: m.threadId,
        from: headerValue(headers, 'From'),
        to: headerValue(headers, 'To'),
        subject: headerValue(headers, 'Subject'),
        date: headerValue(headers, 'Date') || (m.internalDate ? new Date(Number(m.internalDate)).toISOString() : ''),
        snippet: m.snippet ?? '',
        labelIds: [],
      };
    });

    const buckets: Record<GmailBucket, number> = {
      gst_notice: 0,
      vendor_invoice: 0,
      client_invoice: 0,
      tax_communication: 0,
      other: 0,
    };
    for (const m of recent) {
      buckets[classifySubject(m.subject)] += 1;
    }

    const data: GmailData = {
      email,
      messagesTotal,
      recent,
      buckets,
    };

    return {
      source: 'gmail',
      connected: true,
      recordCount: recent.length,
      data,
      collectedAt,
    };
  },
};

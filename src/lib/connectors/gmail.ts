// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Gmail Connector™ — REAL Email Sync
// ═══════════════════════════════════════════════════════════════════════════════
//
// Uses a user-provided Google OAuth access token (with gmail.readonly scope) to:
//   1. Fetch the user's Gmail profile (email address)
//   2. Search for GST-related emails (notices, invoices, tax communications)
//   3. Parse each email's headers + body
//   4. Categorize (gst_notice, vendor_invoice, client_invoice, tax_communication)
//   5. Return structured records for storage
//
// The access token is obtained on the frontend via Google Identity Services (GIS)
// and sent to the backend API route. The backend NEVER stores the token — it only
// uses it for the immediate sync, then discards it. The synced email DATA is stored.
//
// This is REAL Gmail integration — no mock data.
// ═══════════════════════════════════════════════════════════════════════════════

const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

/** Gmail profile (email address). */
export interface GmailProfile {
  emailAddress: string;
  messagesTotal: number;
  threadsTotal: number;
}

/** A parsed Gmail message. */
export interface ParsedEmail {
  messageId: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  body: string;
  snippet: string;
  labels: string[];
  category: EmailCategory;
}

export type EmailCategory =
  | 'gst_notice'
  | 'vendor_invoice'
  | 'client_invoice'
  | 'tax_communication'
  | 'general';

/** Search queries for GST-related emails. */
const GST_EMAIL_QUERIES: { query: string; category: EmailCategory }[] = [
  // GST notices from the government
  { query: 'from:gst.gov.in OR from:cbic.gov.in OR subject:"GST notice" OR subject:"show cause" OR subject:"SCN"', category: 'gst_notice' },
  { query: 'subject:"GSTR" OR subject:"return filing" OR subject:"filing confirmation" OR subject:"ARN"', category: 'gst_notice' },
  // Vendor invoices (incoming bills)
  { query: 'subject:"invoice" OR subject:"bill" OR subject:"purchase" has:attachment', category: 'vendor_invoice' },
  // Client invoices (sent by us, replies/acknowledgments)
  { query: 'subject:"invoice" from:me OR subject:"payment received" OR subject:"payment confirmation"', category: 'client_invoice' },
  // Tax communications from CA/tax consultants
  { query: 'subject:"GST" OR subject:"tax" OR subject:"TDS" OR subject:"compliance"', category: 'tax_communication' },
];

/** Fetch the user's Gmail profile. */
export async function fetchGmailProfile(accessToken: string): Promise<GmailProfile | null> {
  try {
    const res = await fetch(`${GMAIL_API_BASE}/profile`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      console.warn('[Gmail] Profile fetch failed:', res.status, await res.text());
      return null;
    }
    return (await res.json()) as GmailProfile;
  } catch (err) {
    console.warn('[Gmail] Profile fetch error:', err);
    return null;
  }
}

/** List message IDs matching a query. */
async function listMessageIds(accessToken: string, query: string, maxResults = 20): Promise<string[]> {
  try {
    const url = `${GMAIL_API_BASE}/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { messages?: { id: string }[] };
    return data.messages?.map((m) => m.id) ?? [];
  } catch {
    return [];
  }
}

/** Fetch a single message by ID and parse it. */
async function fetchAndParseMessage(
  accessToken: string,
  messageId: string,
  category: EmailCategory,
): Promise<ParsedEmail | null> {
  try {
    const res = await fetch(`${GMAIL_API_BASE}/messages/${messageId}?format=full`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const msg = (await res.json()) as {
      id: string;
      threadId: string;
      snippet: string;
      labelIds: string[];
      payload?: {
        headers?: { name: string; value: string }[];
        body?: { data?: string };
        parts?: { body?: { data?: string }; mimeType?: string }[];
      };
    };

    const headers = msg.payload?.headers ?? [];
    const getHeader = (name: string) =>
      headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';

    // Extract body — prefer text/plain, fall back to snippet
    let body = '';
    const parts = msg.payload?.parts ?? [];
    const textPart = parts.find((p) => p.mimeType === 'text/plain');
    const bodyData = textPart?.body?.data ?? msg.payload?.body?.data;
    if (bodyData) {
      body = Buffer.from(bodyData, 'base64').toString('utf-8').slice(0, 2000);
    }

    return {
      messageId: msg.id,
      threadId: msg.threadId,
      from: getHeader('From'),
      to: getHeader('To'),
      subject: getHeader('Subject'),
      date: getHeader('Date'),
      body,
      snippet: msg.snippet,
      labels: msg.labelIds ?? [],
      category,
    };
  } catch {
    return null;
  }
}

/** Sync GST-related emails from Gmail. Returns parsed, categorized emails. */
export async function syncGmailEmails(
  accessToken: string,
  maxPerQuery = 10,
): Promise<{ profile: GmailProfile | null; emails: ParsedEmail[]; errors: string[] }> {
  const errors: string[] = [];
  const profile = await fetchGmailProfile(accessToken);
  if (!profile) {
    errors.push('Failed to fetch Gmail profile — token may be expired or insufficient permissions');
    return { profile: null, emails: [], errors };
  }

  const emails: ParsedEmail[] = [];
  const seenIds = new Set<string>();

  for (const { query, category } of GST_EMAIL_QUERIES) {
    const ids = await listMessageIds(accessToken, query, maxPerQuery);
    for (const id of ids) {
      if (seenIds.has(id)) continue;
      seenIds.add(id);
      const parsed = await fetchAndParseMessage(accessToken, id, category);
      if (parsed) emails.push(parsed);
    }
  }

  return { profile, emails, errors };
}

/** Convert parsed emails to SyncedRecord format for storage. */
export function emailsToRecords(
  emails: ParsedEmail[],
  connectionId: string,
  userId: string,
): Array<{
  connectionId: string;
  userId: string;
  sourceType: 'email';
  externalId: string;
  title: string | null;
  amount: number | null;
  date: string | null;
  rawData: Record<string, unknown>;
  category: string;
  processed: boolean;
}> {
  return emails.map((e) => {
    // Try to extract an invoice amount from the subject/body
    const amountMatch = e.subject.match(/₹\s*([\d,]+(?:\.\d+)?)/) ?? e.body.match(/₹\s*([\d,]+(?:\.\d+)?)/);
    const amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : null;

    return {
      connectionId,
      userId,
      sourceType: 'email' as const,
      externalId: e.messageId,
      title: e.subject,
      amount,
      date: e.date,
      rawData: {
        from: e.from,
        to: e.to,
        snippet: e.snippet,
        bodyPreview: e.body.slice(0, 500),
        threadId: e.threadId,
        labels: e.labels,
      },
      category: e.category,
      processed: true,
    };
  });
}

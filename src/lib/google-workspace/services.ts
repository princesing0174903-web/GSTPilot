// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Google Workspace Service Library
//
// Thin wrappers around Google's REST APIs for Gmail, Drive, Docs, Sheets, and
// Calendar. Every function takes a pre-resolved `accessToken` (from
// `getValidAccessToken`) so the auth/refresh logic stays in `auth.ts`.
//
// All functions return `{ data, error }` and NEVER throw — callers can
// destructure safely. Network/parse errors are surfaced as `error` strings.
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Shared helpers ──────────────────────────────────────────────────────────

interface ApiResult<T> {
  data: T | null;
  error: string | null;
  status: number;
}

async function googleFetch<T>(
  url: string,
  accessToken: string,
  init: RequestInit = {},
): Promise<ApiResult<T>> {
  try {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      ...(init.headers as Record<string, string> | undefined),
    };
    if (init.body && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }
    const resp = await fetch(url, { ...init, headers });
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      return {
        data: null,
        error: `Google API error ${resp.status}: ${text.slice(0, 500)}`,
        status: resp.status,
      };
    }
    // 204 No Content
    if (resp.status === 204) {
      return { data: null as T, error: null, status: resp.status };
    }
    const ct = resp.headers.get('content-type') ?? '';
    if (ct.includes('application/json')) {
      const json = (await resp.json()) as T;
      return { data: json, error: null, status: resp.status };
    }
    const text = await resp.text();
    return { data: text as unknown as T, error: null, status: resp.status };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Network error calling Google API.',
      status: 0,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GMAIL
// ═══════════════════════════════════════════════════════════════════════════════

const GMAIL_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

export interface GmailProfile {
  emailAddress: string;
  messagesTotal: number;
  threadsTotal: number;
  historyId: string;
}

export interface GmailMessage {
  id: string;
  threadId: string;
  snippet: string;
  payload?: {
    headers?: Array<{ name: string; value: string }>;
  };
  internalDate?: string;
}

export interface GmailSendInput {
  to: string;
  subject: string;
  body: string;
  cc?: string;
  bcc?: string;
  isHtml?: boolean;
}

export interface GmailDraftInput extends GmailSendInput {
  /** Optional existing draft id to update. */
  draftId?: string;
}

/** Build a raw RFC 2822 message and base64url-encode it for the Gmail API. */
function buildRawMessage(input: GmailSendInput): string {
  const lines: string[] = [];
  lines.push(`To: ${input.to}`);
  if (input.cc) lines.push(`Cc: ${input.cc}`);
  if (input.bcc) lines.push(`Bcc: ${input.bcc}`);
  lines.push(`Subject: ${input.subject}`);
  lines.push('MIME-Version: 1.0');
  if (input.isHtml) {
    lines.push('Content-Type: text/html; charset=utf-8');
  } else {
    lines.push('Content-Type: text/plain; charset=utf-8');
  }
  lines.push('');
  lines.push(input.body);
  const raw = lines.join('\r\n');
  // base64url encode
  return Buffer.from(raw, 'utf8').toString('base64url');
}

export const gmail = {
  /** Get the authenticated user's Gmail profile. */
  async getProfile(accessToken: string): Promise<ApiResult<GmailProfile>> {
    return googleFetch<GmailProfile>(`${GMAIL_BASE}/profile`, accessToken);
  },

  /** Send an email. Returns the message id. */
  async send(accessToken: string, input: GmailSendInput): Promise<ApiResult<{ id: string; threadId: string }>> {
    return googleFetch<{ id: string; threadId: string }>(
      `${GMAIL_BASE}/messages/send`,
      accessToken,
      {
        method: 'POST',
        body: JSON.stringify({ raw: buildRawMessage(input) }),
      },
    );
  },

  /** Create (or update) a draft. */
  async createDraft(accessToken: string, input: GmailDraftInput): Promise<ApiResult<{ id: string; message: { id: string } }>> {
    const message = { raw: buildRawMessage(input) };
    const url = input.draftId
      ? `${GMAIL_BASE}/drafts/${input.draftId}`
      : `${GMAIL_BASE}/drafts`;
    return googleFetch<{ id: string; message: { id: string } }>(url, accessToken, {
      method: input.draftId ? 'PUT' : 'POST',
      body: JSON.stringify({ message }),
    });
  },

  /** List recent messages (returns id/threadId; use getMessage for full content). */
  async listMessages(accessToken: string, max = 20): Promise<ApiResult<{ messages: GmailMessage[] }>> {
    const list = await googleFetch<{ messages: Array<{ id: string; threadId: string }> }>(
      `${GMAIL_BASE}/messages?maxResults=${max}`,
      accessToken,
    );
    if (list.error || !list.data) return { data: { messages: [] }, error: list.error, status: list.status };
    // Fetch snippets in parallel (bounded).
    const ids = list.data.messages.slice(0, max);
    const detailed = await Promise.all(
      ids.map((m) =>
        googleFetch<GmailMessage>(`${GMAIL_BASE}/messages/${m.id}?format=metadata`, accessToken),
      ),
    );
    const messages = detailed
      .filter((d): d is ApiResult<GmailMessage> & { data: GmailMessage } => d.data !== null)
      .map((d) => d.data);
    return { data: { messages }, error: null, status: 200 };
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// DRIVE
// ═══════════════════════════════════════════════════════════════════════════════

const DRIVE_BASE = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3';

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  webViewLink?: string;
  iconLink?: string;
  parents?: string[];
}

export const drive = {
  /** Create a folder. Returns the folder id. */
  async createFolder(accessToken: string, name: string, parentId?: string): Promise<ApiResult<DriveFile>> {
    const body: Record<string, unknown> = {
      name,
      mimeType: 'application/vnd.google-apps.folder',
    };
    if (parentId) body.parents = [parentId];
    return googleFetch<DriveFile>(`${DRIVE_BASE}/files`, accessToken, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  /** Upload a file (multipart upload). `content` is base64-encoded. */
  async uploadFile(
    accessToken: string,
    input: { name: string; mimeType: string; contentBase64: string; parentId?: string },
  ): Promise<ApiResult<DriveFile>> {
    const metadata: Record<string, unknown> = { name: input.name };
    if (input.parentId) metadata.parents = [input.parentId];
    const boundary = 'gstpilot-boundary-' + Math.random().toString(36).slice(2);
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`),
      Buffer.from(JSON.stringify(metadata)),
      Buffer.from(`\r\n--${boundary}\r\nContent-Type: ${input.mimeType}\r\nContent-Transfer-Encoding: base64\r\n\r\n`),
      Buffer.from(input.contentBase64),
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    return googleFetch<DriveFile>(
      `${DRIVE_UPLOAD}/files?uploadType=multipart`,
      accessToken,
      {
        method: 'POST',
        headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
        body,
      },
    );
  },

  /** List files (optionally filtered by folder parent). */
  async listFiles(accessToken: string, opts: { pageSize?: number; parentId?: string; q?: string } = {}): Promise<ApiResult<{ files: DriveFile[] }>> {
    const params = new URLSearchParams({
      pageSize: String(opts.pageSize ?? 25),
      fields: 'files(id,name,mimeType,modifiedTime,webViewLink,iconLink,parents)',
      orderBy: 'modifiedTime desc',
    });
    const qParts: string[] = [];
    if (opts.parentId) qParts.push(`'${opts.parentId}' in parents`);
    if (opts.q) qParts.push(opts.q);
    if (qParts.length) params.set('q', qParts.join(' and '));
    const res = await googleFetch<{ files: DriveFile[] }>(`${DRIVE_BASE}/files?${params}`, accessToken);
    return { data: { files: res.data?.files ?? [] }, error: res.error, status: res.status };
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// DOCS
// ═══════════════════════════════════════════════════════════════════════════════

const DOCS_BASE = 'https://docs.googleapis.com/v1/documents';

export interface CreatedDoc {
  documentId: string;
  revisionId: string;
}

export interface DocParagraph {
  text: string;
  heading?: 'TITLE' | 'HEADING_1' | 'HEADING_2' | 'NORMAL_TEXT';
}

/**
 * Create a Google Doc with optional initial content. Uses the batchUpdate API
 * to insert text + apply heading styles in a single request.
 */
export async function createDoc(
  accessToken: string,
  title: string,
  paragraphs: DocParagraph[] = [],
): Promise<ApiResult<CreatedDoc>> {
  // 1. Create the empty doc.
  const created = await googleFetch<{ documentId: string; revisionId: string }>(
    DOCS_BASE,
    accessToken,
    { method: 'POST', body: JSON.stringify({ title }) },
  );
  if (created.error || !created.data) return created;

  if (paragraphs.length === 0) return created;

  // 2. Build a batchUpdate with insertText + updateStyle requests.
  const requests: Array<Record<string, unknown>> = [];
  let cursor = 1; // start after the title (the doc already has the title text)
  // Insert a newline after the title first.
  requests.push({
    insertText: { location: { index: 1 }, text: '\n' },
  });
  cursor = 2;

  paragraphs.forEach((p, i) => {
    const text = p.text + (i < paragraphs.length - 1 ? '\n' : '');
    requests.push({
      insertText: { location: { index: cursor }, text },
    });
    if (p.heading) {
      requests.push({
        updateParagraphStyle: {
          range: { startIndex: cursor, endIndex: cursor + p.text.length },
          paragraphStyle: { namedStyleType: p.heading },
          fields: 'namedStyleType',
        },
      });
    }
    cursor += text.length;
  });

  const updated = await googleFetch<unknown>(
    `${DOCS_BASE}/${created.data.documentId}:batchUpdate`,
    accessToken,
    { method: 'POST', body: JSON.stringify({ requests }) },
  );
  if (updated.error) {
    return { data: created.data, error: `Doc created but styling failed: ${updated.error}`, status: updated.status };
  }
  return { data: created.data, error: null, status: 200 };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SHEETS
// ═══════════════════════════════════════════════════════════════════════════════

const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

export interface SheetRow {
  values: string[];
}

export interface SheetExportInput {
  title: string;
  /** rows[0] is treated as the header row (bold). */
  rows: SheetRow[];
  sheetName?: string;
}

/**
 * Create a spreadsheet + populate it with rows. The first row is bolded as a
 * header. Returns the spreadsheet id + webViewLink.
 */
export async function exportToSheet(
  accessToken: string,
  input: SheetExportInput,
): Promise<ApiResult<{ spreadsheetId: string; webViewLink: string }>> {
  // 1. Create the spreadsheet.
  const created = await googleFetch<{ spreadsheetId: string; spreadsheetUrl: string }>(
    SHEETS_BASE,
    accessToken,
    { method: 'POST', body: JSON.stringify({ properties: { title: input.title } }) },
  );
  if (created.error || !created.data) return created;

  const sheetId = created.data.spreadsheetId;
  const sheetName = input.sheetName ?? 'Sheet1';

  // 2. Write values (A1 notation).
  const values = input.rows.map((r) => r.values);
  const written = await googleFetch<unknown>(
    `${SHEETS_BASE}/${sheetId}/values/${encodeURIComponent(sheetName)}!A1?valueInputOption=RAW`,
    accessToken,
    { method: 'PUT', body: JSON.stringify({ values }) },
  );
  if (written.error) {
    return {
      data: { spreadsheetId: sheetId, webViewLink: created.data.spreadsheetUrl },
      error: `Sheet created but write failed: ${written.error}`,
      status: written.status,
    };
  }

  // 3. Bold the header row via batchUpdate (best-effort).
  if (values.length > 0) {
    try {
      await googleFetch<unknown>(
        `${SHEETS_BASE}/${sheetId}:batchUpdate`,
        accessToken,
        {
          method: 'POST',
          body: JSON.stringify({
            requests: [{
              repeatCell: {
                range: { sheetId: 0, startRowIndex: 0, endRowIndex: 1 },
                cell: { userEnteredFormat: { textFormat: { bold: true } } },
                fields: 'userEnteredFormat.textFormat.bold',
              },
            }],
          }),
        },
      );
    } catch {
      /* non-fatal */
    }
  }

  return {
    data: { spreadsheetId: sheetId, webViewLink: created.data.spreadsheetUrl },
    error: null,
    status: 200,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CALENDAR
// ═══════════════════════════════════════════════════════════════════════════════

const CAL_BASE = 'https://www.googleapis.com/calendar/v3';

export interface CalendarEventInput {
  summary: string;
  description?: string;
  start: string; // ISO 8601
  end: string; // ISO 8601
  attendees?: string[]; // email list
  location?: string;
  reminders?: { minutes: number; method?: 'email' | 'popup' }[];
}

export interface CalendarEvent {
  id: string;
  htmlLink: string;
  hangoutLink?: string;
  summary: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
}

export const calendar = {
  /** Create a calendar event. Returns the event id + htmlLink. */
  async createEvent(accessToken: string, input: CalendarEventInput): Promise<ApiResult<CalendarEvent>> {
    const body: Record<string, unknown> = {
      summary: input.summary,
      description: input.description ?? '',
      start: { dateTime: input.start, timeZone: 'Asia/Kolkata' },
      end: { dateTime: input.end, timeZone: 'Asia/Kolkata' },
    };
    if (input.location) body.location = input.location;
    if (input.attendees && input.attendees.length) {
      body.attendees = input.attendees.map((email) => ({ email }));
    }
    if (input.reminders && input.reminders.length) {
      body.reminders = {
        useDefault: false,
        overrides: input.reminders.map((r) => ({ minutes: r.minutes, method: r.method ?? 'email' })),
      };
    }
    return googleFetch<CalendarEvent>(`${CAL_BASE}/calendars/primary/events`, accessToken, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  /** List upcoming events. */
  async listEvents(accessToken: string, max = 20): Promise<ApiResult<{ events: CalendarEvent[] }>> {
    const params = new URLSearchParams({
      maxResults: String(max),
      singleEvents: 'true',
      orderBy: 'startTime',
      timeMin: new Date().toISOString(),
    });
    const res = await googleFetch<{ items: CalendarEvent[] }>(`${CAL_BASE}/calendars/primary/events?${params}`, accessToken);
    return { data: { events: res.data?.items ?? [] }, error: res.error, status: res.status };
  },
};

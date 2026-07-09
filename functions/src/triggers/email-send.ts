/**
 * email-send — onCall function for sending a transactional email.
 *
 * Uses a minimal SMTP submission client implemented with Node's built-in
 * `net` + `tls` modules (no `nodemailer` dependency — keeps the functions
 * bundle small). Supports STARTTLS on port 587 + AUTH LOGIN, which is what
 * SendGrid/Mailgun/AWS SES SMTP all accept.
 *
 * Configuration via secrets:
 *   SMTP_HOST, SMTP_PORT (default 587), SMTP_USER, SMTP_PASSWORD, SMTP_FROM
 *
 * All emails are audit-logged under /orgs/{orgId}/auditLogs.
 *
 * NOTE: For high-volume production, replace `sendViaSmtp` with a SendGrid
 * API call (`https` module) — the function signature is unchanged.
 */
import { onCall } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions';
import * as tls from 'tls';
import * as net from 'net';
import { adminDb } from '../admin';
import { requireOrgRole, PermissionError } from '../helpers/org-permission';

const SMTP_HOST = defineSecret('SMTP_HOST');
const SMTP_USER = defineSecret('SMTP_USER');
const SMTP_PASSWORD = defineSecret('SMTP_PASSWORD');

interface SendEmailInput {
  orgId: string;
  to: string;
  subject: string;
  textBody: string;
  htmlBody?: string;
  templateId?: string;
  templateVars?: Record<string, string>;
}

export const emailSend = onCall(
  {
    region: 'asia-south1',
    memory: '256MiB',
    timeoutSeconds: 30,
    secrets: [SMTP_HOST, SMTP_USER, SMTP_PASSWORD],
  },
  async (req) => {
    const callerUid = req.auth?.uid;
    const input = (req.data ?? {}) as SendEmailInput;

    if (!input.orgId || !input.to || !input.subject || !input.textBody) {
      return { ok: false, error: { code: 'INVALID_ARGUMENT', message: 'orgId, to, subject, textBody required.' } };
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.to)) {
      return { ok: false, error: { code: 'INVALID_EMAIL', message: 'Recipient address is malformed.' } };
    }

    try {
      await requireOrgRole(adminDb, callerUid, input.orgId, 'owner', 'admin', 'accountant');
    } catch (err) {
      if (err instanceof PermissionError) {
        return { ok: false, error: { code: err.code, message: err.message } };
      }
      throw err;
    }

    const host = SMTP_HOST.value();
    const user = SMTP_USER.value();
    const password = SMTP_PASSWORD.value();
    const from = process.env.SMTP_FROM || user;
    const port = Number(process.env.SMTP_PORT || '587');

    if (!host || !user || !password) {
      logger.error('emailSend: SMTP secrets missing');
      return { ok: false, error: { code: 'SMTP_NOT_CONFIGURED', message: 'SMTP secrets not set on the function.' } };
    }

    try {
      const messageId = await sendViaSmtp({
        host,
        port,
        username: user,
        password,
        from,
        to: input.to,
        subject: input.subject,
        text: input.textBody,
        html: input.htmlBody,
      });

      await adminDb.collection(`orgs/${input.orgId}/auditLogs`).add({
        orgId: input.orgId,
        actorUid: callerUid ?? null,
        actorEmail: null,
        action: 'email.sent',
        targetType: 'email',
        targetId: input.to,
        metadata: {
          subject: input.subject,
          messageId,
          templateId: input.templateId ?? null,
        },
        timestamp: Date.now(),
      });

      logger.info(
        `emailSend: org=${input.orgId} to=${input.to} subject="${input.subject}" caller=${callerUid}`,
      );
      return { ok: true, data: { messageId } };
    } catch (err) {
      logger.error('emailSend: SMTP send failed', err);
      return {
        ok: false,
        error: {
          code: 'SMTP_SEND_FAILED',
          message: err instanceof Error ? err.message : 'Unknown error',
        },
      };
    }
  },
);

interface SmtpArgs {
  host: string;
  port: number;
  username: string;
  password: string;
  from: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * Minimal STARTTLS + AUTH LOGIN SMTP submission client. Implemented without
 * nodemailer to keep deps small. Handles only the path used by SendGrid /
 * Mailgun / SES transactional SMTP.
 */
function sendViaSmtp(args: SmtpArgs): Promise<string> {
  return new Promise((resolve, reject) => {
    const messageId = `<${Date.now()}.${Math.random().toString(36).slice(2)}@gstpilot.app>`;
    const socket = net.connect(args.port, args.host);
    socket.setEncoding('utf8');
    socket.setTimeout(20000);

    let upgrade: (() => void) | null = null;
    let active: net.Socket | tls.TLSSocket = socket;

    /** Send one CRLF-terminated line on whichever socket is active. */
    const send = (line: string): void => {
      active.write(line + '\r\n');
    };

    /** SMTP servers can send multi-line replies; only the final line has
     *  a space after the 3-digit code (continuation lines use `-`). */
    const collectReply = (data: string, onComplete: (code: string, text: string) => void) => {
      const lines = data.split('\r\n').filter(Boolean);
      const last = lines[lines.length - 1] ?? '';
      if (last.length < 4 || last[3] !== ' ') return; // continuation pending
      const code = last.slice(0, 3);
      const text = lines.map((l) => l.slice(4)).join(' ');
      onComplete(code, text);
    };

    socket.on('connect', async () => {
      try {
        // 1. Wait for server greeting (220).
        const greeting = await once(socket, collectReply);
        if (greeting.code !== '220') throw new Error(`Expected 220, got ${greeting.code}`);

        // 2. EHLO.
        send('EHLO gstpilot.app');
        const ehlo = await once(socket, collectReply);
        if (ehlo.code !== '250') throw new Error(`EHLO failed: ${ehlo.code}`);

        // 3. STARTTLS.
        send('STARTTLS');
        const tlsReply = await once(socket, collectReply);
        if (tlsReply.code !== '220') throw new Error(`STARTTLS refused: ${tlsReply.code}`);

        // 4. Upgrade to TLS.
        const tlsSocket = tls.connect({ socket, servername: args.host }, () => {
          active = tlsSocket;
          upgrade?.();
        });
        tlsSocket.setEncoding('utf8');
        tlsSocket.setTimeout(20000);
        tlsSocket.on('error', (err) => reject(err));

        upgrade = async () => {
          try {
            // 5. EHLO again on the TLS connection.
            send('EHLO gstpilot.app');
            const ehlo2 = await once(tlsSocket, collectReply);
            if (ehlo2.code !== '250') throw new Error(`EHLO post-TLS failed: ${ehlo2.code}`);

            // 6. AUTH LOGIN.
            send('AUTH LOGIN');
            const a1 = await once(tlsSocket, collectReply);
            if (a1.code !== '334') throw new Error(`AUTH LOGIN refused: ${a1.code}`);

            send(Buffer.from(args.username).toString('base64'));
            const a2 = await once(tlsSocket, collectReply);
            if (a2.code !== '334') throw new Error(`AUTH username rejected: ${a2.code}`);

            send(Buffer.from(args.password).toString('base64'));
            const a3 = await once(tlsSocket, collectReply);
            if (a3.code !== '235') throw new Error(`AUTH password rejected: ${a3.code}`);

            // 7. Envelope.
            send(`MAIL FROM:<${args.from}>`);
            const m1 = await once(tlsSocket, collectReply);
            if (m1.code !== '250') throw new Error(`MAIL FROM rejected: ${m1.code}`);

            send(`RCPT TO:<${args.to}>`);
            const m2 = await once(tlsSocket, collectReply);
            if (m2.code !== '250' && m2.code !== '251') {
              throw new Error(`RCPT TO rejected: ${m2.code}`);
            }

            // 8. DATA.
            send('DATA');
            const d1 = await once(tlsSocket, collectReply);
            if (d1.code !== '354') throw new Error(`DATA rejected: ${d1.code}`);

            const headers = [
              `From: ${args.from}`,
              `To: ${args.to}`,
              `Subject: ${args.subject}`,
              `Message-ID: ${messageId}`,
              'MIME-Version: 1.0',
              args.html ? 'Content-Type: text/html; charset=UTF-8' : 'Content-Type: text/plain; charset=UTF-8',
              '',
            ];
            send(headers.join('\r\n'));
            const body = (args.html ?? args.text).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
            for (const line of body.split('\n')) {
              send(line.startsWith('.') ? '.' + line : line);
            }
            send('\r\n.');
            const d2 = await once(tlsSocket, collectReply);
            if (d2.code !== '250') throw new Error(`Message body rejected: ${d2.code}`);

            // 9. QUIT.
            send('QUIT');
            tlsSocket.end();
            resolve(messageId);
          } catch (err) {
            tlsSocket.destroy();
            reject(err);
          }
        };
      } catch (err) {
        socket.destroy();
        reject(err);
      }
    });

    socket.on('error', (err) => reject(err));
    socket.on('timeout', () => {
      socket.destroy();
      reject(new Error('SMTP connection timeout'));
    });
  });
}

/**
 * Wait for the next complete SMTP reply on a socket. Returns a promise that
 * resolves with the 3-digit code + aggregated text.
 */
function once(
  sock: net.Socket,
  collect: (data: string, cb: (code: string, text: string) => void) => void,
): Promise<{ code: string; text: string }> {
  return new Promise((resolve, reject) => {
    let buffer = '';
    const handler = (chunk: string): void => {
      buffer += chunk;
      collect(buffer, (code, text) => {
        buffer = '';
        sock.off('data', handler);
        sock.off('error', errHandler);
        resolve({ code, text });
      });
    };
    const errHandler = (err: Error): void => {
      sock.off('data', handler);
      reject(err);
    };
    sock.on('data', handler);
    sock.on('error', errHandler);
  });
}

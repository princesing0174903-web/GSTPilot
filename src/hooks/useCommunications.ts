'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Gmail & WhatsApp Business Automation™ — useCommunications() Hook
//
// The SINGLE hook every GSTPilot component uses to interact with communication
// data. Mirrors the useBanking() pattern:
//
//   • READ — real-time subscriptions to connections + messages + schedules
//     (org-scoped via onSnapshot)
//   • CONNECT_GMAIL — connect → complete → persist encrypted connection
//   • CONNECT_WHATSAPP — connect → complete → persist encrypted connection
//   • DISCONNECT — invalidate connection + cascade-delete all messages
//   • SYNC — pull latest emails / WhatsApp messages from the provider
//   • SEND — send an email or WhatsApp message
//   • REPLY — reply to an existing message
//   • SCHEDULE — schedule a new automated message
//   • CANCEL — cancel a scheduled message
//   • RUN_AUTOMATION — dispatch due scheduled messages (cron-style)
//
// All tenant scoping is automatic — components never touch `organizationId`.
//
// Architecture:
//   1. Mutations call /api/communication/{gmail,whatsapp,automation}/* routes
//      for provider work. The API returns plain data + encrypted sessions.
//   2. The hook persists the result to Firestore via the service layer.
//   3. Real-time onSnapshot subscriptions surface changes instantly.
//
// Security: encrypted sessions are stored in Firestore but can ONLY be decrypted
// by the server. The client passes them opaquely to API routes.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useOrg } from '@/contexts/OrgContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  subscribeToGmailConnections,
  subscribeToWhatsAppConnections,
  subscribeToGmailMessages,
  subscribeToWhatsAppMessages,
  subscribeToScheduledMessages,
  saveGmailConnection,
  updateGmailConnection,
  cascadeDisconnectGmail,
  saveGmailMessages,
  updateGmailMessage,
  saveWhatsAppConnection,
  updateWhatsAppConnection,
  cascadeDisconnectWhatsApp,
  saveWhatsAppMessages,
  updateWhatsAppMessage,
  updateScheduledMessage,
  deleteScheduledMessage,
  createSyncJob,
  updateSyncJob,
  computeCommunicationSummary,
  type GmailConnection,
  type GmailProviderName,
  type GmailMessage,
  type WhatsAppConnection,
  type WhatsAppProviderName,
  type WhatsAppMessage,
  type ScheduledMessage,
  type ScheduledMessageChannel,
  type ScheduledMessageStatus,
  type ScheduleRecurrence,
  type CommunicationSummary,
  type WhatsAppCategory,
  type EmailCategory,
} from '@/lib/communication-provider';

// ─── Hook return type ────────────────────────────────────────────────────────

export interface UseCommunicationsResult {
  // Real-time state
  gmailConnections: GmailConnection[];
  whatsappConnections: WhatsAppConnection[];
  gmailMessages: GmailMessage[];
  whatsappMessages: WhatsAppMessage[];
  scheduledMessages: ScheduledMessage[];

  // Memoized summary for dashboard consumption
  summary: CommunicationSummary;

  // Convenience flags
  gmailConnected: boolean;
  whatsappConnected: boolean;

  loading: boolean;
  error: string | null;
  saving: boolean;

  // ─── Gmail mutations ────────────────────────────────────────────────────
  connectGmail: (input: {
    provider?: GmailProviderName;
    email: string;
    displayName?: string;
  }) => Promise<boolean>;
  disconnectGmail: (connectionId: string) => Promise<boolean>;
  syncGmail: (connectionId: string, options?: { from?: string; to?: string }) => Promise<boolean>;
  sendEmail: (input: {
    connectionId: string;
    to: string;
    subject: string;
    bodyHtml: string;
    bodyText?: string;
    cc?: string;
    bcc?: string;
    replyToMessageId?: string;
  }) => Promise<boolean>;
  markEmailRead: (messageId: string, read: boolean) => Promise<boolean>;

  // ─── WhatsApp mutations ─────────────────────────────────────────────────
  connectWhatsApp: (input: {
    provider?: WhatsAppProviderName;
    phoneNumber: string;
    businessName?: string;
  }) => Promise<boolean>;
  disconnectWhatsApp: (connectionId: string) => Promise<boolean>;
  syncWhatsApp: (connectionId: string, options?: { from?: string; to?: string }) => Promise<boolean>;
  sendWhatsApp: (input: {
    connectionId: string;
    to: string;
    body: string;
    messageType?: 'text' | 'template' | 'document' | 'image';
    category?: WhatsAppCategory;
    clientId?: string | null;
    invoiceId?: string | null;
  }) => Promise<boolean>;
  markWhatsAppRead: (messageId: string) => Promise<boolean>;

  // ─── Automation mutations ───────────────────────────────────────────────
  scheduleMessage: (input: {
    channel: ScheduledMessageChannel;
    connectionId: string;
    recipient: string;
    recipientName?: string | null;
    subject?: string | null;
    body: string;
    category?: WhatsAppCategory | EmailCategory;
    trigger?: 'invoice_reminder' | 'gst_filing' | 'payment_followup' | 'recurring' | 'manual';
    linkedEntityId?: string | null;
    linkedEntityType?: 'invoice' | 'return' | 'client' | 'payment' | null;
    scheduledFor: string;
    recurrence?: ScheduleRecurrence;
  }) => Promise<string | null>;
  cancelScheduledMessage: (scheduleId: string) => Promise<boolean>;
  runAutomation: () => Promise<boolean>;
  generateReminders: () => Promise<boolean>;
  retryFailed: () => Promise<boolean>;

  retry: () => void;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useCommunications(): UseCommunicationsResult {
  const { organization, isPreviewMode } = useOrg();
  const { user } = useAuth();
  const orgId = organization?.id ?? null;

  const [gmailConnections, setGmailConnections] = useState<GmailConnection[]>([]);
  const [whatsappConnections, setWhatsappConnections] = useState<WhatsAppConnection[]>([]);
  const [gmailMessages, setGmailMessages] = useState<GmailMessage[]>([]);
  const [whatsappMessages, setWhatsAppMessages] = useState<WhatsAppMessage[]>([]);
  const [scheduledMessages, setScheduledMessages] = useState<ScheduledMessage[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [retryTick, setRetryTick] = useState(0);

  const unsubRefs = useRef<Array<(() => void) | null>>([null, null, null, null, null]);

  useEffect(() => {
    unsubRefs.current.forEach((unsub) => unsub?.());
    unsubRefs.current = [null, null, null, null, null];

    if (!orgId || isPreviewMode || orgId === 'preview-org') {
      setGmailConnections([]);
      setWhatsappConnections([]);
      setGmailMessages([]);
      setWhatsAppMessages([]);
      setScheduledMessages([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const onSubError = (err: Error) => {
      console.warn('[useCommunications] subscription error:', err.message);
      setError(err.message);
      setLoading(false);
    };

    unsubRefs.current[0] = subscribeToGmailConnections(
      orgId,
      (conns) => {
        setGmailConnections(conns);
        setLoading(false);
        setError(null);
      },
      { onError: onSubError },
    );

    unsubRefs.current[1] = subscribeToWhatsAppConnections(
      orgId,
      (conns) => {
        setWhatsappConnections(conns);
        setError(null);
      },
      { onError: onSubError },
    );

    unsubRefs.current[2] = subscribeToGmailMessages(
      orgId,
      (msgs) => {
        setGmailMessages(msgs);
        setError(null);
      },
      { onError: onSubError, limitCount: 200 },
    );

    unsubRefs.current[3] = subscribeToWhatsAppMessages(
      orgId,
      (msgs) => {
        setWhatsAppMessages(msgs);
        setError(null);
      },
      { onError: onSubError, limitCount: 200 },
    );

    unsubRefs.current[4] = subscribeToScheduledMessages(
      orgId,
      (schedules) => {
        setScheduledMessages(schedules);
        setError(null);
      },
      { onError: onSubError, limitCount: 100 },
    );

    return () => {
      unsubRefs.current.forEach((unsub) => unsub?.());
    };
  }, [orgId, isPreviewMode, retryTick]);

  const createdBy = {
    uid: user?.id ?? '',
    name: user?.name ?? 'Unknown',
    email: user?.email ?? '',
  };

  const gmailConn = gmailConnections.find((c) => c.authStatus === 'connected') ?? null;
  const waConn = whatsappConnections.find((c) => c.authStatus === 'connected') ?? null;

  // ─── Mutation: connectGmail ───────────────────────────────────────────────

  const connectGmail = useCallback(
    async (input: {
      provider?: GmailProviderName;
      email: string;
      displayName?: string;
    }): Promise<boolean> => {
      if (!orgId) return false;
      setSaving(true);
      setError(null);
      try {
        const res = await fetch('/api/communication/gmail/connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organizationId: orgId,
            provider: input.provider ?? 'mock',
            email: input.email,
            displayName: input.displayName,
            createdBy,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(data.error ?? 'Failed to connect Gmail.');
        }
        const { result, complete } = data;
        if (!complete) {
          throw new Error('Gmail connection could not be completed. Please try again.');
        }
        await saveGmailConnection(orgId, {
          organizationId: orgId,
          email: result.email,
          displayName: complete.profile.displayName ?? input.displayName ?? null,
          provider: input.provider ?? 'mock',
          authStatus: 'connected',
          lastSync: new Date().toISOString(),
          sessionExpiry: complete.sessionExpiry,
          encryptedConnection: complete.encryptedConnection,
          scopes: complete.scopes,
          lastError: null,
          createdBy,
        });
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        setError(msg);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [orgId, createdBy],
  );

  // ─── Mutation: disconnectGmail ────────────────────────────────────────────

  const disconnectGmail = useCallback(
    async (connectionId: string): Promise<boolean> => {
      if (!orgId) return false;
      const conn = gmailConnections.find((c) => c.id === connectionId);
      if (!conn) return false;
      setSaving(true);
      setError(null);
      try {
        await fetch('/api/communication/gmail/disconnect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ encryptedConnection: conn.encryptedConnection }),
        });
        await cascadeDisconnectGmail(orgId, connectionId);
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        setError(msg);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [orgId, gmailConnections],
  );

  // ─── Mutation: syncGmail ──────────────────────────────────────────────────

  const syncGmail = useCallback(
    async (connectionId: string, options?: { from?: string; to?: string }): Promise<boolean> => {
      if (!orgId) return false;
      const conn = gmailConnections.find((c) => c.id === connectionId);
      if (!conn?.encryptedConnection) return false;
      setSaving(true);
      setError(null);

      const jobId = await createSyncJob(orgId, {
        connectionId,
        channel: 'gmail',
        trigger: 'manual',
        maxRetries: 3,
      }).catch(() => null);

      try {
        const res = await fetch('/api/communication/gmail/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organizationId: orgId,
            connectionId,
            encryptedConnection: conn.encryptedConnection,
            from: options?.from,
            to: options?.to,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(data.error ?? 'Gmail sync failed.');
        }
        const { messages } = data.result;
        if (Array.isArray(messages)) {
          await saveGmailMessages(orgId, messages);
        }
        await updateGmailConnection(orgId, connectionId, {
          authStatus: 'connected',
          lastSync: new Date().toISOString(),
          lastError: null,
        });
        if (jobId) {
          await updateSyncJob(orgId, jobId, {
            status: 'completed',
            completedAt: new Date().toISOString(),
            result: { newCount: messages?.length ?? 0, totalCount: messages?.length ?? 0 },
          }).catch(() => {});
        }
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        setError(msg);
        if (jobId) {
          await updateSyncJob(orgId, jobId, {
            status: 'failed',
            completedAt: new Date().toISOString(),
            error: msg,
          }).catch(() => {});
        }
        return false;
      } finally {
        setSaving(false);
      }
    },
    [orgId, gmailConnections],
  );

  // ─── Mutation: sendEmail ──────────────────────────────────────────────────

  const sendEmail = useCallback(
    async (input: {
      connectionId: string;
      to: string;
      subject: string;
      bodyHtml: string;
      bodyText?: string;
      cc?: string;
      bcc?: string;
      replyToMessageId?: string;
    }): Promise<boolean> => {
      if (!orgId) return false;
      const conn = gmailConnections.find((c) => c.id === input.connectionId);
      if (!conn?.encryptedConnection) return false;
      setSaving(true);
      setError(null);
      try {
        const res = await fetch('/api/communication/gmail/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organizationId: orgId,
            connectionId: input.connectionId,
            encryptedConnection: conn.encryptedConnection,
            to: input.to,
            cc: input.cc,
            bcc: input.bcc,
            subject: input.subject,
            bodyHtml: input.bodyHtml,
            bodyText: input.bodyText,
            replyToMessageId: input.replyToMessageId,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(data.error ?? 'Failed to send email.');
        }
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        setError(msg);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [orgId, gmailConnections],
  );

  // ─── Mutation: markEmailRead ──────────────────────────────────────────────

  const markEmailRead = useCallback(
    async (messageId: string, read: boolean): Promise<boolean> => {
      if (!orgId) return false;
      try {
        await updateGmailMessage(orgId, messageId, {
          readStatus: read ? 'read' : 'unread',
        });
        return true;
      } catch {
        return false;
      }
    },
    [orgId],
  );

  // ─── Mutation: connectWhatsApp ────────────────────────────────────────────

  const connectWhatsApp = useCallback(
    async (input: {
      provider?: WhatsAppProviderName;
      phoneNumber: string;
      businessName?: string;
    }): Promise<boolean> => {
      if (!orgId) return false;
      setSaving(true);
      setError(null);
      try {
        const res = await fetch('/api/communication/whatsapp/connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organizationId: orgId,
            provider: input.provider ?? 'mock',
            phoneNumber: input.phoneNumber,
            businessName: input.businessName,
            createdBy,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(data.error ?? 'Failed to connect WhatsApp.');
        }
        const { result, complete } = data;
        if (!complete) {
          throw new Error('WhatsApp connection could not be completed.');
        }
        await saveWhatsAppConnection(orgId, {
          organizationId: orgId,
          phoneNumber: result.phoneNumber,
          businessName: complete.profile.businessName ?? input.businessName ?? null,
          displayPhoneNumber: complete.profile.displayPhoneNumber,
          provider: input.provider ?? 'mock',
          authStatus: 'connected',
          lastSync: new Date().toISOString(),
          sessionExpiry: complete.sessionExpiry,
          encryptedConnection: complete.encryptedConnection,
          phoneNumberId: result.phoneNumberId,
          wabaId: result.wabaId,
          qualityRating: complete.profile.qualityRating,
          messagingLimitTier: complete.profile.messagingLimitTier,
          lastError: null,
          createdBy,
        });
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        setError(msg);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [orgId, createdBy],
  );

  // ─── Mutation: disconnectWhatsApp ─────────────────────────────────────────

  const disconnectWhatsApp = useCallback(
    async (connectionId: string): Promise<boolean> => {
      if (!orgId) return false;
      const conn = whatsappConnections.find((c) => c.id === connectionId);
      if (!conn) return false;
      setSaving(true);
      setError(null);
      try {
        await fetch('/api/communication/whatsapp/disconnect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ encryptedConnection: conn.encryptedConnection }),
        });
        await cascadeDisconnectWhatsApp(orgId, connectionId);
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        setError(msg);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [orgId, whatsappConnections],
  );

  // ─── Mutation: syncWhatsApp ───────────────────────────────────────────────

  const syncWhatsApp = useCallback(
    async (connectionId: string, options?: { from?: string; to?: string }): Promise<boolean> => {
      if (!orgId) return false;
      const conn = whatsappConnections.find((c) => c.id === connectionId);
      if (!conn?.encryptedConnection) return false;
      setSaving(true);
      setError(null);

      const jobId = await createSyncJob(orgId, {
        connectionId,
        channel: 'whatsapp',
        trigger: 'manual',
        maxRetries: 3,
      }).catch(() => null);

      try {
        const res = await fetch('/api/communication/whatsapp/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organizationId: orgId,
            connectionId,
            encryptedConnection: conn.encryptedConnection,
            from: options?.from,
            to: options?.to,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(data.error ?? 'WhatsApp sync failed.');
        }
        const { messages } = data.result;
        if (Array.isArray(messages)) {
          await saveWhatsAppMessages(orgId, messages);
        }
        await updateWhatsAppConnection(orgId, connectionId, {
          authStatus: 'connected',
          lastSync: new Date().toISOString(),
          lastError: null,
        });
        if (jobId) {
          await updateSyncJob(orgId, jobId, {
            status: 'completed',
            completedAt: new Date().toISOString(),
            result: { newCount: messages?.length ?? 0, totalCount: messages?.length ?? 0 },
          }).catch(() => {});
        }
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        setError(msg);
        if (jobId) {
          await updateSyncJob(orgId, jobId, {
            status: 'failed',
            completedAt: new Date().toISOString(),
            error: msg,
          }).catch(() => {});
        }
        return false;
      } finally {
        setSaving(false);
      }
    },
    [orgId, whatsappConnections],
  );

  // ─── Mutation: sendWhatsApp ───────────────────────────────────────────────

  const sendWhatsApp = useCallback(
    async (input: {
      connectionId: string;
      to: string;
      body: string;
      messageType?: 'text' | 'template' | 'document' | 'image';
      category?: WhatsAppCategory;
      clientId?: string | null;
      invoiceId?: string | null;
    }): Promise<boolean> => {
      if (!orgId) return false;
      const conn = whatsappConnections.find((c) => c.id === input.connectionId);
      if (!conn?.encryptedConnection) return false;
      setSaving(true);
      setError(null);
      try {
        const res = await fetch('/api/communication/whatsapp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organizationId: orgId,
            connectionId: input.connectionId,
            encryptedConnection: conn.encryptedConnection,
            to: input.to,
            body: input.body,
            messageType: input.messageType ?? 'text',
            category: input.category,
            clientId: input.clientId ?? null,
            invoiceId: input.invoiceId ?? null,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(data.error ?? 'Failed to send WhatsApp message.');
        }
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        setError(msg);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [orgId, whatsappConnections],
  );

  // ─── Mutation: markWhatsAppRead ───────────────────────────────────────────

  const markWhatsAppRead = useCallback(
    async (messageId: string): Promise<boolean> => {
      if (!orgId) return false;
      try {
        await updateWhatsAppMessage(orgId, messageId, { status: 'read' });
        return true;
      } catch {
        return false;
      }
    },
    [orgId],
  );

  // ─── Mutation: scheduleMessage ────────────────────────────────────────────

  const scheduleMessage = useCallback(
    async (input: {
      channel: ScheduledMessageChannel;
      connectionId: string;
      recipient: string;
      recipientName?: string | null;
      subject?: string | null;
      body: string;
      category?: WhatsAppCategory | EmailCategory;
      trigger?: 'invoice_reminder' | 'gst_filing' | 'payment_followup' | 'recurring' | 'manual';
      linkedEntityId?: string | null;
      linkedEntityType?: 'invoice' | 'return' | 'client' | 'payment' | null;
      scheduledFor: string;
      recurrence?: ScheduleRecurrence;
    }): Promise<string | null> => {
      if (!orgId) return null;
      setSaving(true);
      setError(null);
      try {
        const res = await fetch('/api/communication/automation/schedule', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organizationId: orgId,
            channel: input.channel,
            connectionId: input.connectionId,
            recipient: input.recipient,
            recipientName: input.recipientName ?? null,
            subject: input.subject ?? null,
            body: input.body,
            category: input.category ?? 'general',
            trigger: input.trigger ?? 'manual',
            linkedEntityId: input.linkedEntityId ?? null,
            linkedEntityType: input.linkedEntityType ?? null,
            scheduledFor: input.scheduledFor,
            recurrence: input.recurrence,
            createdBy,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(data.error ?? 'Failed to schedule message.');
        }
        return data.scheduleId as string;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        setError(msg);
        return null;
      } finally {
        setSaving(false);
      }
    },
    [orgId, createdBy],
  );

  // ─── Mutation: cancelScheduledMessage ─────────────────────────────────────

  const cancelScheduledMessage = useCallback(
    async (scheduleId: string): Promise<boolean> => {
      if (!orgId) return false;
      setSaving(true);
      setError(null);
      try {
        const res = await fetch('/api/communication/automation/cancel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ organizationId: orgId, scheduleId }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(data.error ?? 'Failed to cancel scheduled message.');
        }
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        setError(msg);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [orgId],
  );

  // ─── Mutation: runAutomation ──────────────────────────────────────────────

  const runAutomation = useCallback(async (): Promise<boolean> => {
    if (!orgId) return false;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/communication/automation/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: orgId }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? 'Failed to run automation.');
      }
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(msg);
      return false;
    } finally {
      setSaving(false);
    }
  }, [orgId]);

  // ─── Mutation: generateReminders ──────────────────────────────────────────

  const generateReminders = useCallback(async (): Promise<boolean> => {
    if (!orgId) return false;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/communication/automation/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: orgId,
          gmailConnectionId: gmailConn?.id ?? null,
          whatsappConnectionId: waConn?.id ?? null,
          businessName: organization?.name ?? 'Your Business',
          preferredChannel: waConn ? 'whatsapp' : 'gmail',
          createdBy,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? 'Failed to generate reminders.');
      }
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(msg);
      return false;
    } finally {
      setSaving(false);
    }
  }, [orgId, gmailConn, waConn, organization?.name, createdBy]);

  // ─── Mutation: retryFailed ─────────────────────────────────────────────────

  const retryFailed = useCallback(async (): Promise<boolean> => {
    if (!orgId) return false;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/communication/automation/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: orgId }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? 'Failed to retry failed messages.');
      }
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(msg);
      return false;
    } finally {
      setSaving(false);
    }
  }, [orgId]);

  // ─── Mutation: retry (subscription) ────────────────────────────────────────

  const retry = useCallback(() => {
    setRetryTick((t) => t + 1);
  }, []);

  // ─── Derived state ────────────────────────────────────────────────────────

  const gmailConnected = gmailConnections.some((c) => c.authStatus === 'connected');
  const whatsappConnected = whatsappConnections.some((c) => c.authStatus === 'connected');

  const summary = useMemo(
    () =>
      computeCommunicationSummary(
        gmailConnections,
        whatsappConnections,
        gmailMessages,
        whatsappMessages,
        scheduledMessages,
      ),
    [gmailConnections, whatsappConnections, gmailMessages, whatsappMessages, scheduledMessages],
  );

  return {
    gmailConnections,
    whatsappConnections,
    gmailMessages,
    whatsappMessages,
    scheduledMessages,
    summary,
    gmailConnected,
    whatsappConnected,
    loading,
    error,
    saving,
    connectGmail,
    disconnectGmail,
    syncGmail,
    sendEmail,
    markEmailRead,
    connectWhatsApp,
    disconnectWhatsApp,
    syncWhatsApp,
    sendWhatsApp,
    markWhatsAppRead,
    scheduleMessage,
    cancelScheduledMessage,
    runAutomation,
    generateReminders,
    retryFailed,
    retry,
  };
}

// ─── Convenience re-exports ───────────────────────────────────────────────────

export type {
  GmailConnection,
  GmailMessage,
  WhatsAppConnection,
  WhatsAppMessage,
  ScheduledMessage,
  CommunicationSummary,
  ScheduledMessageChannel,
  ScheduledMessageStatus,
  ScheduleRecurrence,
} from '@/lib/communication-provider';

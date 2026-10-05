// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT BUSINESS GRAPH™ — Live Update Engine
// Phase 6 LIVE — whenever data syncs (invoice created, GST filed, bank synced,
// WhatsApp received, email received, task completed, report generated, Oracle
// answers), call notifyGraphEvent() to push a LiveGraphEvent and invalidate
// the in-memory cache. The graph UI auto-refreshes within 60s.
//
// Usage from any API route (POST /api/invoices etc.):
//
//   import { notifyGraphEvent } from '@/lib/graph/live-update';
//   await notifyGraphEvent({
//     source: 'invoices',
//     type: 'invoice_created',
//     title: `Invoice ${inv.invoiceNumber} created`,
//     description: `₹${inv.totalAmount} · ${inv.buyerName || 'Buyer'}`,
//     nodeId: `invoice:${inv.id}`,
//     relatedNodeIds: [`client:${inv.buyerGstin}`, 'business:firm'],
//     amount: inv.totalAmount,
//   });
//
// This module is safe to call from any server-side code. It never throws —
// event logging failures are swallowed to avoid breaking the calling route.
// ═══════════════════════════════════════════════════════════════════════════════

import { pushLiveEvent, invalidateGraphCache } from '@/lib/graph/cache';
import type { LiveEventSource, LiveEventType, LiveGraphEvent } from '@/lib/graph/types';

const uid = (p: string) => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
const nowISO = () => new Date().toISOString();

export interface NotifyGraphEventInput {
  source: LiveEventSource;
  type: LiveEventType;
  title: string;
  description?: string;
  nodeId?: string;
  relatedNodeIds?: string[];
  amount?: number;
}

/**
 * Push a LiveGraphEvent into the in-memory log and invalidate the graph cache.
 * Safe to call from any server route — never throws.
 */
export function notifyGraphEvent(input: NotifyGraphEventInput): void {
  try {
    const event: LiveGraphEvent = {
      id: uid('evt'),
      source: input.source,
      type: input.type,
      title: input.title,
      description: input.description,
      nodeId: input.nodeId,
      relatedNodeIds: input.relatedNodeIds,
      amount: input.amount,
      timestamp: nowISO(),
    };
    pushLiveEvent(event);
  } catch (err) {
    // Never let event logging break the calling route.
    console.error('[live-update] notifyGraphEvent failed', err);
  }
}

/**
 * Convenience helper: invalidate the graph cache without pushing an event.
 * Use this for bulk operations where individual events aren't needed.
 */
export function invalidateGraph(): void {
  try {
    invalidateGraphCache();
  } catch (err) {
    console.error('[live-update] invalidateGraph failed', err);
  }
}

// ─── Domain-specific helpers (one-liners for common events) ───────────────────

export const graphEvents = {
  invoiceCreated: (invoiceId: string, invoiceNumber: string, amount: number, buyerGstin?: string) =>
    notifyGraphEvent({
      source: 'invoices',
      type: 'invoice_created',
      title: `Invoice ${invoiceNumber} created`,
      description: `₹${amount.toLocaleString('en-IN')} invoice added to the graph`,
      nodeId: `invoice:${invoiceId}`,
      relatedNodeIds: [buyerGstin ? `client:${buyerGstin}` : 'business:firm', 'business:firm'],
      amount,
    }),

  invoicePaid: (invoiceId: string, invoiceNumber: string, amount: number) =>
    notifyGraphEvent({
      source: 'payments',
      type: 'invoice_paid',
      title: `Invoice ${invoiceNumber} paid`,
      description: `₹${amount.toLocaleString('en-IN')} collected`,
      nodeId: `invoice:${invoiceId}`,
      relatedNodeIds: [`payment:${invoiceId}`, 'bank-account:primary'],
      amount,
    }),

  gstFiled: (filingId: string, returnType: string, period: string, taxAmount: number) =>
    notifyGraphEvent({
      source: 'gstn',
      type: 'gst_filed',
      title: `${returnType} filed for ${period}`,
      description: `Output tax ₹${taxAmount.toLocaleString('en-IN')} filed with GSTN`,
      nodeId: `gst-return:${filingId}`,
      relatedNodeIds: ['business:firm', 'tax-payment:govt'],
      amount: taxAmount,
    }),

  gstNoticeReceived: (noticeId: string, noticeType: string, clientId?: string) =>
    notifyGraphEvent({
      source: 'gstn',
      type: 'gst_notice_received',
      title: `GST notice received: ${noticeType}`,
      description: 'Statutory response required within timeline',
      nodeId: `notice:${noticeId}`,
      relatedNodeIds: [clientId ? `client:${clientId}` : 'business:firm', 'business:firm'],
    }),

  bankSynced: (label: string, txCount: number) =>
    notifyGraphEvent({
      source: 'bank',
      type: 'bank_synced',
      title: `Bank sync: ${label}`,
      description: `${txCount} new transaction(s) imported`,
      nodeId: 'bank-account:primary',
      relatedNodeIds: ['business:firm'],
    }),

  paymentReceived: (paymentId: string, partyName: string, amount: number) =>
    notifyGraphEvent({
      source: 'payments',
      type: 'payment_received',
      title: `Payment received from ${partyName}`,
      description: `₹${amount.toLocaleString('en-IN')} collected`,
      nodeId: `collection:${paymentId}`,
      relatedNodeIds: ['bank-account:primary', 'business:firm'],
      amount,
    }),

  paymentMade: (paymentId: string, partyName: string, amount: number) =>
    notifyGraphEvent({
      source: 'payments',
      type: 'payment_made',
      title: `Payment made to ${partyName}`,
      description: `₹${amount.toLocaleString('en-IN')} paid`,
      nodeId: `payment:${paymentId}`,
      relatedNodeIds: ['bank-account:primary', 'business:firm'],
      amount,
    }),

  expenseRecorded: (expenseId: string, vendor: string, amount: number, category: string) =>
    notifyGraphEvent({
      source: 'expenses',
      type: 'expense_recorded',
      title: `Expense recorded: ${category}`,
      description: `₹${amount.toLocaleString('en-IN')} to ${vendor}`,
      nodeId: `expense:${expenseId}`,
      relatedNodeIds: ['bank-account:primary', 'business:firm'],
      amount,
    }),

  whatsappReceived: (msgId: string, from: string, body: string) =>
    notifyGraphEvent({
      source: 'whatsapp',
      type: 'whatsapp_received',
      title: `WhatsApp from ${from}`,
      description: body.slice(0, 80),
      nodeId: `conversation:${msgId}`,
      relatedNodeIds: ['conversation:whatsapp', 'business:firm'],
    }),

  whatsappSent: (msgId: string, to: string, body: string) =>
    notifyGraphEvent({
      source: 'whatsapp',
      type: 'whatsapp_sent',
      title: `WhatsApp sent to ${to}`,
      description: body.slice(0, 80),
      nodeId: `conversation:${msgId}`,
      relatedNodeIds: ['conversation:whatsapp', 'business:firm'],
    }),

  emailReceived: (msgId: string, from: string, subject: string) =>
    notifyGraphEvent({
      source: 'gmail',
      type: 'email_received',
      title: `Email from ${from}`,
      description: subject,
      nodeId: `conversation:${msgId}`,
      relatedNodeIds: ['conversation:gmail', 'business:firm'],
    }),

  emailSent: (msgId: string, to: string, subject: string) =>
    notifyGraphEvent({
      source: 'gmail',
      type: 'email_sent',
      title: `Email sent to ${to}`,
      description: subject,
      nodeId: `conversation:${msgId}`,
      relatedNodeIds: ['conversation:gmail', 'business:firm'],
    }),

  taskCompleted: (taskId: string, title: string) =>
    notifyGraphEvent({
      source: 'system',
      type: 'task_completed',
      title: `Task completed: ${title}`,
      nodeId: `task:${taskId}`,
      relatedNodeIds: ['business:firm'],
    }),

  reportGenerated: (reportId: string, reportType: string, title: string) =>
    notifyGraphEvent({
      source: 'reports',
      type: 'report_generated',
      title: `Report generated: ${title}`,
      description: `Type: ${reportType}`,
      nodeId: `report:${reportId}`,
      relatedNodeIds: ['business:firm', 'conversation:oracle'],
    }),

  oracleAnswered: (query: string) =>
    notifyGraphEvent({
      source: 'oracle',
      type: 'oracle_answered',
      title: 'Oracle answered a query',
      description: query.slice(0, 100),
      nodeId: 'conversation:oracle',
      relatedNodeIds: ['business:firm'],
    }),

  clientCreated: (clientId: string, name: string) =>
    notifyGraphEvent({
      source: 'clients',
      type: 'client_created',
      title: `Client added: ${name}`,
      nodeId: `client:${clientId}`,
      relatedNodeIds: ['business:firm'],
    }),

  vendorCreated: (vendorId: string, name: string) =>
    notifyGraphEvent({
      source: 'vendors',
      type: 'vendor_created',
      title: `Vendor added: ${name}`,
      nodeId: `vendor:${vendorId}`,
      relatedNodeIds: ['business:firm'],
    }),

  employeeAdded: (employeeId: string, name: string) =>
    notifyGraphEvent({
      source: 'employees',
      type: 'employee_added',
      title: `Employee added: ${name}`,
      nodeId: `employee:${employeeId}`,
      relatedNodeIds: ['business:firm'],
    }),

  itcClaimed: (purchaseBillId: string, amount: number) =>
    notifyGraphEvent({
      source: 'gstn',
      type: 'itc_claimed',
      title: `ITC claimed: ₹${amount.toLocaleString('en-IN')}`,
      description: 'Input tax credit recorded from purchase bill',
      nodeId: `itc-record:${purchaseBillId}`,
      relatedNodeIds: ['business:firm', 'gst-return:current'],
      amount,
    }),

  connectorSynced: (type: string, label: string) =>
    notifyGraphEvent({
      source: type as LiveEventSource,
      type: 'connector_synced',
      title: `Connector synced: ${label}`,
      description: `Source: ${type}`,
      nodeId: 'business:firm',
    }),

  // ── Phase: Real Business Graph Engine™ — additional helpers ──

  smsSent: (msgId: string, to: string, body: string) =>
    notifyGraphEvent({
      source: 'sms',
      type: 'sms_sent',
      title: `SMS sent to ${to}`,
      description: body.slice(0, 80),
      nodeId: `conversation:${msgId}`,
      relatedNodeIds: ['conversation:sms', 'business:firm'],
    }),

  returnCreated: (returnId: string, returnType: string, period: string, taxAmount: number) =>
    notifyGraphEvent({
      source: 'returns',
      type: 'gst_return_created',
      title: `${returnType} return created for ${period}`,
      description: `Draft return · output tax ₹${taxAmount.toLocaleString('en-IN')}`,
      nodeId: `gst-return:${returnId}`,
      relatedNodeIds: ['business:firm', 'tax-payment:govt'],
      amount: taxAmount,
    }),

  teamMemberAdded: (memberId: string, name: string, role: string) =>
    notifyGraphEvent({
      source: 'employees',
      type: 'team_member_added',
      title: `Team member added: ${name}`,
      description: `Role: ${role}`,
      nodeId: `employee:${memberId}`,
      relatedNodeIds: ['business:firm'],
    }),

  transactionRecorded: (txId: string, description: string, amount: number, type: 'credit' | 'debit') =>
    notifyGraphEvent({
      source: 'bank',
      type: 'transaction_recorded',
      title: `Bank ${type}: ${description.slice(0, 50)}`,
      description: `₹${amount.toLocaleString('en-IN')} ${type}`,
      nodeId: `transaction:${txId}`,
      relatedNodeIds: ['bank-account:primary', 'business:firm'],
      amount,
    }),
};

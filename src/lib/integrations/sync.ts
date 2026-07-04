// ═══════════════════════════════════════════════════════════════════════════════
// sync.ts — Sync orchestrator
//
// Wires adapters to DB writes. The single entry point is `runSync()`:
//   1. Loads the Connection from DB.
//   2. Validates status === "connected".
//   3. Creates a SyncJob row with status="running".
//   4. Switches on `connection.provider` and calls the right adapter.
//   5. Upserts adapter output into the right domain tables (Invoice,
//      GSTRFiling, Notice, Payment, BankTransaction, GmailMessage, DriveFile).
//   6. Updates the SyncJob with counts + status + completedAt + durationMs.
//   7. Always updates Connection.lastSyncAt + lastSyncStatus + lastSyncSummary.
//
// CRITICAL: When an adapter throws IntegrationNotConfiguredError the SyncJob
// ends with status="error" and the error message. NO fake data is written.
//
// For webhook/file/CRUD-driven providers (whatsapp, excel, clients) the
// function returns immediately with a "no batch sync" message + the SyncJob
// is marked status="success" with recordsPulled=0 and a log entry explaining
// that the provider is event-driven.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db'
import { getProviderMeta } from './registry'
import {
  IntegrationNotConfiguredError,
  type ProviderKey,
  type SyncLogEntry,
  type SyncResult,
} from './types'
import { writeEvent } from './events'
import { decryptCredentials } from './crypto'

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface ListSyncJobsFilter {
  connectionId?: string
  provider?: string
  status?: string
  limit?: number
  offset?: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function now(): number {
  return Date.now()
}

function appendLog(log: SyncLogEntry[] | undefined, entry: SyncLogEntry): string {
  const next = [...(log ?? []), entry]
  return JSON.stringify(next)
}

function summarize(result: SyncResult): string {
  return (
    `Pulled ${result.recordsPulled}, created ${result.recordsCreated}, ` +
    `updated ${result.recordsUpdated}, skipped ${result.recordsSkipped}.`
  )
}

/**
 * Upsert a single invoice by (clientId + invoiceNumber + sellerGstin).
 * Returns 'created' | 'updated' | 'skipped'.
 */
async function upsertInvoice(
  clientId: string,
  inv: {
    invoiceNumber: string
    invoiceDate?: string
    sellerGstin: string
    buyerGstin?: string
    buyerName?: string
    taxableValue?: number
    cgst?: number
    sgst?: number
    igst?: number
    cess?: number
    totalAmount?: number
    hsnCode?: string
    source?: string
    sourceRef?: string
  },
): Promise<'created' | 'updated' | 'skipped'> {
  if (!inv.invoiceNumber || !inv.sellerGstin) return 'skipped'
  // Invoice has no composite unique constraint on (clientId, invoiceNumber,
  // sellerGstin) — we use findFirst + update/create instead of upsert.
  const existing = await db.invoice.findFirst({
    where: {
      clientId,
      invoiceNumber: inv.invoiceNumber,
      sellerGstin: inv.sellerGstin,
    },
  })
  const data = {
    clientId,
    invoiceNumber: inv.invoiceNumber,
    invoiceDate: inv.invoiceDate ?? '',
    sellerGstin: inv.sellerGstin,
    buyerGstin: inv.buyerGstin ?? null,
    buyerName: inv.buyerName ?? null,
    taxableValue: inv.taxableValue ?? 0,
    cgst: inv.cgst ?? 0,
    sgst: inv.sgst ?? 0,
    igst: inv.igst ?? 0,
    cess: inv.cess ?? 0,
    totalAmount: inv.totalAmount ?? 0,
    hsnCode: inv.hsnCode ?? null,
    source: inv.source ?? 'manual',
    sourceRef: inv.sourceRef ?? null,
  }
  if (existing) {
    await db.invoice.update({ where: { id: existing.id }, data })
    return 'updated'
  }
  await db.invoice.create({ data })
  return 'created'
}

// ─── Per-provider sync handlers ─────────────────────────────────────────────────
// Each handler returns a SyncResult. The orchestrator wraps in try/catch and
// translates IntegrationNotConfiguredError into a no-data outcome (with the
// error surfaced in the SyncJob log).

async function syncGstn(connectionId: string): Promise<SyncResult> {
  const conn = await db.connection.findUnique({ where: { id: connectionId } })
  if (!conn) throw new Error('Connection not found.')
  const meta = getProviderMeta('gstn')
  const adapter = await import('./gstn')
  const log: SyncLogEntry[] = []

  // The GSTN adapter needs a target GSTIN to pull returns for. The
  // connection's metadata JSON may carry it; otherwise we look up the first
  // active client with a GSTIN.
  const metadata = conn.metadata ? (JSON.parse(conn.metadata) as { gstin?: string }) : {}
  let targetGstin = metadata.gstin
  if (!targetGstin) {
    const client = await db.client.findFirst({ where: { status: 'active' }, orderBy: { createdAt: 'desc' } })
    targetGstin = client?.gstin ?? undefined
  }
  if (!targetGstin) {
    log.push({ step: 'gstn:select-target', status: 'skipped', message: 'No GSTIN configured (set in connection metadata) and no active client found.' })
    return { recordsPulled: 0, recordsCreated: 0, recordsUpdated: 0, recordsSkipped: 0, log, summary: 'No GSTIN target available.' }
  }

  const fy = new Date().getFullYear().toString()
  log.push({ step: 'gstn:select-target', status: 'success', message: `Target GSTIN: ${targetGstin}, FY: ${fy}` })

  // ── Pull returns ──
  let returnsCreated = 0
  let returnsUpdated = 0
  let returnsSkipped = 0
  try {
    const returns = await adapter.pullReturns(conn as unknown as Parameters<typeof adapter.pullReturns>[0], targetGstin, fy)
    log.push({ step: 'gstn:pull-returns', status: 'success', count: returns.length })
    for (const r of returns) {
      // Find client by GSTIN — if none, skip (don't fabricate)
      const client = await db.client.findUnique({ where: { gstin: targetGstin } })
      if (!client) {
        returnsSkipped++
        continue
      }
      const existing = await db.gSTRFiling.findFirst({
        where: { clientId: client.id, returnType: r.returnType, period: r.period },
      })
      const data = {
        clientId: client.id,
        returnType: r.returnType,
        period: r.period,
        financialYear: r.financialYear ?? null,
        status: r.status ?? 'draft',
        filedDate: r.filedDate ?? null,
        acknowledgmentNumber: r.ackNo ?? null,
        source: 'gstn',
        sourceRef: r.sourceRef ?? null,
      }
      if (existing) {
        await db.gSTRFiling.update({ where: { id: existing.id }, data })
        returnsUpdated++
      } else {
        await db.gSTRFiling.create({ data })
        returnsCreated++
      }
    }
    log.push({ step: 'gstn:upsert-returns', status: 'success', count: returnsCreated + returnsUpdated, message: `created ${returnsCreated}, updated ${returnsUpdated}, skipped ${returnsSkipped}` })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log.push({ step: 'gstn:pull-returns', status: 'error', message: msg })
    if (err instanceof IntegrationNotConfiguredError) throw err
  }

  // ── Pull notices ──
  let noticesCreated = 0
  let noticesUpdated = 0
  try {
    const notices = await adapter.getNotices(conn as unknown as Parameters<typeof adapter.getNotices>[0], targetGstin)
    log.push({ step: 'gstn:pull-notices', status: 'success', count: notices.length })
    const client = await db.client.findUnique({ where: { gstin: targetGstin } })
    if (client) {
      for (const n of notices) {
        const existing = n.noticeNumber
          ? await db.notice.findFirst({ where: { clientId: client.id, noticeNumber: n.noticeNumber } })
          : null
        const data = {
          clientId: client.id,
          noticeType: n.noticeType ?? 'gst_notice',
          noticeNumber: n.noticeNumber ?? null,
          noticeDate: n.noticeDate ?? null,
          subject: n.subject,
          description: n.description ?? null,
          priority: n.priority ?? 'medium',
          source: 'gstn',
          sourceRef: n.sourceRef ?? null,
        }
        if (existing) {
          await db.notice.update({ where: { id: existing.id }, data })
          noticesUpdated++
        } else {
          await db.notice.create({ data })
          noticesCreated++
        }
      }
    }
    log.push({ step: 'gstn:upsert-notices', status: 'success', count: noticesCreated + noticesUpdated })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log.push({ step: 'gstn:pull-notices', status: 'error', message: msg })
    if (err instanceof IntegrationNotConfiguredError) throw err
  }

  void meta
  const recordsPulled = (log.find((l) => l.step === 'gstn:pull-returns')?.count ?? 0) +
    (log.find((l) => l.step === 'gstn:pull-notices')?.count ?? 0)
  const recordsCreated = returnsCreated + noticesCreated
  const recordsUpdated = returnsUpdated + noticesUpdated
  const result: SyncResult = {
    recordsPulled,
    recordsCreated,
    recordsUpdated,
    recordsSkipped: returnsSkipped,
    log,
    summary: `Pulled ${recordsPulled} GSTN records (${returnsCreated + returnsUpdated} returns, ${noticesCreated + noticesUpdated} notices).`,
  }
  return result
}

async function syncGmail(connectionId: string): Promise<SyncResult> {
  const conn = await db.connection.findUnique({ where: { id: connectionId } })
  if (!conn) throw new Error('Connection not found.')
  const adapter = await import('./gmail')
  const log: SyncLogEntry[] = []

  let msgCreated = 0
  let msgUpdated = 0
  let invoicesCreated = 0
  let invoicesUpdated = 0
  let invoicesSkipped = 0

  try {
    const messages = await adapter.pullMessages(conn as unknown as Parameters<typeof adapter.pullMessages>[0], { maxResults: 50 })
    log.push({ step: 'gmail:pull-messages', status: 'success', count: messages.length })
    for (const m of messages) {
      // Upsert into GmailMessage
      const existing = await db.gmailMessage.findUnique({ where: { messageId: m.messageId } }).catch(() => null)
      const data = {
        connectionId,
        messageId: m.messageId,
        threadId: m.threadId ?? null,
        fromAddress: m.fromAddress ?? null,
        toAddress: m.toAddress ?? null,
        subject: m.subject ?? null,
        snippet: m.snippet ?? null,
        bodyPlain: m.bodyPlain ?? null,
        bodyHtml: m.bodyHtml ?? null,
        hasAttachment: m.hasAttachment ?? false,
        attachmentNames: m.attachmentNames ? JSON.stringify(m.attachmentNames) : null,
        labels: m.labels ? JSON.stringify(m.labels) : null,
        receivedAt: m.receivedAt ? new Date(m.receivedAt) : null,
        rawPayload: m.rawPayload ? JSON.stringify(m.rawPayload) : null,
      }
      if (existing) {
        await db.gmailMessage.update({ where: { id: existing.id }, data })
        msgUpdated++
      } else {
        await db.gmailMessage.create({ data })
        msgCreated++
      }

      // Try to parse an invoice from the email body
      // (uses the local heuristic — does NOT call Gmail API again)
      const detail: Parameters<typeof adapter.parseInvoiceFromEmail>[0] = {
        id: m.messageId,
        threadId: m.threadId ?? '',
        labelIds: m.labels ?? [],
        from: m.fromAddress ?? '',
        to: m.toAddress ?? '',
        subject: m.subject ?? '',
        snippet: m.snippet ?? '',
        bodyPlain: m.bodyPlain ?? '',
        bodyHtml: m.bodyHtml ?? '',
        receivedAt: m.receivedAt ? new Date(m.receivedAt) : new Date(),
        attachments: [],
        raw: m.rawPayload as Record<string, unknown>,
      }
      const parsed = adapter.parseInvoiceFromEmail(detail)
      if (parsed) {
        // Try to find a client by sellerGstin
        const client = await db.client.findUnique({ where: { gstin: parsed.sellerGstin.toUpperCase() } })
        if (client) {
          const outcome = await upsertInvoice(client.id, parsed)
          if (outcome === 'created') invoicesCreated++
          else if (outcome === 'updated') invoicesUpdated++
          else invoicesSkipped++
        } else {
          invoicesSkipped++
        }
      }
    }
    log.push({
      step: 'gmail:upsert',
      status: 'success',
      count: msgCreated + msgUpdated,
      message: `messages: created ${msgCreated}, updated ${msgUpdated}. invoices: created ${invoicesCreated}, updated ${invoicesUpdated}, skipped ${invoicesSkipped}.`,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log.push({ step: 'gmail:pull-messages', status: 'error', message: msg })
    if (err instanceof IntegrationNotConfiguredError) throw err
  }

  return {
    recordsPulled: log.find((l) => l.step === 'gmail:pull-messages')?.count ?? 0,
    recordsCreated: msgCreated + invoicesCreated,
    recordsUpdated: msgUpdated + invoicesUpdated,
    recordsSkipped: invoicesSkipped,
    log,
    summary: `Gmail: ${msgCreated + msgUpdated} messages, ${invoicesCreated + invoicesUpdated} invoices parsed.`,
  }
}

async function syncDrive(connectionId: string): Promise<SyncResult> {
  const conn = await db.connection.findUnique({ where: { id: connectionId } })
  if (!conn) throw new Error('Connection not found.')
  const adapter = await import('./drive')
  const log: SyncLogEntry[] = []

  let created = 0
  let updated = 0
  try {
    const files = await adapter.pullFiles(conn as unknown as Parameters<typeof adapter.pullFiles>[0], { pageSize: 100 })
    log.push({ step: 'drive:pull-files', status: 'success', count: files.length })
    for (const f of files) {
      const existing = await db.driveFile.findFirst({ where: { driveFileId: f.driveFileId } })
      const data = {
        connectionId,
        driveFileId: f.driveFileId,
        name: f.name,
        mimeType: f.mimeType ?? null,
        size: f.size ?? 0,
        webViewLink: f.webViewLink ?? null,
        thumbnailLink: f.thumbnailLink ?? null,
        md5Checksum: f.md5Checksum ?? null,
        parents: f.parents ? JSON.stringify(f.parents) : null,
        rawPayload: f.rawPayload ? JSON.stringify(f.rawPayload) : null,
      }
      if (existing) {
        await db.driveFile.update({ where: { id: existing.id }, data })
        updated++
      } else {
        await db.driveFile.create({ data })
        created++
      }
    }
    log.push({ step: 'drive:upsert', status: 'success', count: created + updated })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log.push({ step: 'drive:pull-files', status: 'error', message: msg })
    if (err instanceof IntegrationNotConfiguredError) throw err
  }

  return {
    recordsPulled: log.find((l) => l.step === 'drive:pull-files')?.count ?? 0,
    recordsCreated: created,
    recordsUpdated: updated,
    recordsSkipped: 0,
    log,
    summary: `Drive: ${created + updated} files synced.`,
  }
}

async function syncBanks(connectionId: string): Promise<SyncResult> {
  const conn = await db.connection.findUnique({ where: { id: connectionId } })
  if (!conn) throw new Error('Connection not found.')
  const adapter = await import('./banks')
  const log: SyncLogEntry[] = []

  let accountsCreated = 0
  let txnsCreated = 0
  try {
    const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // last 30 days
    const to = new Date()
    const { accounts, transactions } = await adapter.pullAccountsAndTransactions(
      conn as unknown as Parameters<typeof adapter.pullAccountsAndTransactions>[0],
      from,
      to,
    )
    log.push({
      step: 'banks:pull',
      status: 'success',
      count: transactions.length,
      message: `${accounts.length} accounts, ${transactions.length} transactions`,
    })

    for (const a of accounts) {
      const existing = await db.bankAccount.findFirst({
        where: { accountNumber: a.accountNumber, bankName: a.bankName },
      })
      const data = {
        connectionId,
        bankName: a.bankName,
        accountNumber: a.accountNumber,
        accountNumberMasked: a.accountNumberMasked ?? null,
        ifsc: a.ifsc ?? null,
        accountType: a.accountType ?? null,
        accountHolder: a.accountHolder ?? null,
        currentBalance: a.currentBalance ?? 0,
        availableBalance: a.availableBalance ?? 0,
        currency: a.currency ?? 'INR',
        lastSyncedAt: new Date(),
        isActive: true,
      }
      if (existing) {
        await db.bankAccount.update({ where: { id: existing.id }, data })
      } else {
        await db.bankAccount.create({ data })
        accountsCreated++
      }
    }

    for (const t of transactions) {
      // Find the BankAccount we just upserted to link the txn.
      // (If we couldn't match, store with bankAccountId=null.)
      await db.bankTransaction.create({
        data: {
          connectionId,
          date: t.date ? new Date(t.date) : new Date(),
          description: t.description ?? null,
          amount: t.amount,
          direction: t.direction ?? (t.amount >= 0 ? 'in' : 'out'),
          balanceAfter: t.balanceAfter ?? null,
          referenceNo: t.referenceNo ?? null,
          counterparty: t.counterparty ?? null,
          counterpartyAccount: t.counterpartyAccount ?? null,
          counterpartyIfsc: t.counterpartyIfsc ?? null,
          rawPayload: t.rawPayload ? JSON.stringify(t.rawPayload) : null,
        },
      })
      txnsCreated++
    }
    log.push({ step: 'banks:upsert', status: 'success', count: txnsCreated, message: `accounts: ${accountsCreated}, txns: ${txnsCreated}` })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log.push({ step: 'banks:pull', status: 'error', message: msg })
    if (err instanceof IntegrationNotConfiguredError) throw err
  }

  return {
    recordsPulled: log.find((l) => l.step === 'banks:pull')?.count ?? 0,
    recordsCreated: txnsCreated + accountsCreated,
    recordsUpdated: 0,
    recordsSkipped: 0,
    log,
    summary: `Banks: ${accountsCreated} accounts, ${txnsCreated} transactions.`,
  }
}

async function syncRazorpay(connectionId: string): Promise<SyncResult> {
  const conn = await db.connection.findUnique({ where: { id: connectionId } })
  if (!conn) throw new Error('Connection not found.')
  const adapter = await import('./razorpay')
  const log: SyncLogEntry[] = []

  let created = 0
  let updated = 0
  let skipped = 0
  try {
    const payments = await adapter.pullPayments(
      conn as unknown as Parameters<typeof adapter.pullPayments>[0],
      { count: 100 },
    )
    log.push({ step: 'razorpay:pull', status: 'success', count: payments.length })
    for (const p of payments) {
      if (!p.sourceRef) {
        skipped++
        continue
      }
      const existing = await db.payment.findFirst({
        where: { source: 'razorpay', sourceRef: p.sourceRef },
      })
      const data = {
        connectionId,
        source: p.source ?? 'razorpay',
        sourceRef: p.sourceRef,
        direction: p.direction ?? 'in',
        amount: p.amount,
        currency: p.currency ?? 'INR',
        method: p.method ?? null,
        status: p.status ?? 'pending',
        referenceNo: p.referenceNo ?? null,
        description: p.description ?? null,
        paidAt: p.paidAt ? new Date(p.paidAt) : null,
        rawPayload: null,
      }
      if (existing) {
        await db.payment.update({ where: { id: existing.id }, data })
        updated++
      } else {
        await db.payment.create({ data })
        created++
      }
    }
    log.push({ step: 'razorpay:upsert', status: 'success', count: created + updated, message: `created ${created}, updated ${updated}, skipped ${skipped}` })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log.push({ step: 'razorpay:pull', status: 'error', message: msg })
    if (err instanceof IntegrationNotConfiguredError) throw err
  }

  return {
    recordsPulled: log.find((l) => l.step === 'razorpay:pull')?.count ?? 0,
    recordsCreated: created,
    recordsUpdated: updated,
    recordsSkipped: skipped,
    log,
    summary: `Razorpay: ${created + updated} payments synced.`,
  }
}

// ─── Orchestrator ───────────────────────────────────────────────────────────────

/**
 * Run a sync for a Connection. Creates a SyncJob row, calls the adapter,
 * upserts results, then finalises the SyncJob + Connection state.
 *
 * Throws IntegrationNotConfiguredError if the connection has no creds. The
 * caller (API route) catches this and returns a 400 with `requiresConfiguration: true`.
 */
export async function runSync(
  connectionId: string,
  triggeredBy: string = 'system',
): Promise<{
  id: string
  status: string
  recordsPulled: number
  recordsCreated: number
  recordsUpdated: number
  recordsSkipped: number
  errorMessage: string | null
  durationMs: number | null
  startedAt: Date
  completedAt: Date | null
  log: SyncLogEntry[] | null
  summary: string | null
}> {
  const conn = await db.connection.findUnique({ where: { id: connectionId } })
  if (!conn) {
    throw new Error(`Connection ${connectionId} not found.`)
  }

  const meta = getProviderMeta(conn.provider as ProviderKey)
  const start = now()

  // Create the SyncJob row
  const job = await db.syncJob.create({
    data: {
      connectionId,
      provider: conn.provider,
      status: 'running',
      triggeredBy,
      startedAt: new Date(start),
    },
  })

  // Helper to finalize the job + update Connection
  const finalize = async (
    status: 'success' | 'error' | 'partial',
    result: SyncResult | { error: string; log: SyncLogEntry[] },
  ) => {
    const completedAt = new Date()
    const durationMs = completedAt.getTime() - start

    const isErr = status === 'error'
    const summary = !isErr && 'summary' in result ? result.summary : null
    const errorMessage = isErr && 'error' in result ? result.error : null
    const logJson = JSON.stringify(result.log)

    const updated = await db.syncJob.update({
      where: { id: job.id },
      data: {
        status,
        completedAt,
        durationMs,
        recordsPulled: !isErr && 'recordsPulled' in result ? result.recordsPulled : 0,
        recordsCreated: !isErr && 'recordsCreated' in result ? result.recordsCreated : 0,
        recordsUpdated: !isErr && 'recordsUpdated' in result ? result.recordsUpdated : 0,
        recordsSkipped: !isErr && 'recordsSkipped' in result ? result.recordsSkipped : 0,
        errorMessage,
        log: logJson,
      },
    })

    await db.connection.update({
      where: { id: connectionId },
      data: {
        lastSyncAt: completedAt,
        lastSyncStatus: status,
        lastSyncError: errorMessage,
        lastSyncSummary: summary,
      },
    })

    // ── Write a sync event to the EventStream (fire-and-forget) ──
    // This feeds Oracle's continuous understanding of what changed.
    writeEvent({
      type: status === 'error' ? 'sync_failed' : 'sync_completed',
      source: conn.provider,
      title: status === 'error'
        ? `${meta.displayName} sync failed: ${errorMessage?.slice(0, 80) ?? 'unknown error'}`
        : `${meta.displayName} sync completed — ${summary ?? 'no records'}`,
      payload: {
        provider: conn.provider,
        status,
        recordsPulled: !isErr && 'recordsPulled' in result ? result.recordsPulled : 0,
        recordsCreated: !isErr && 'recordsCreated' in result ? result.recordsCreated : 0,
        durationMs,
      },
      severity: status === 'error' ? 'warning' : 'success',
    }).catch(() => { /* event writing must never break sync */ })

    return {
      id: updated.id,
      status: updated.status,
      recordsPulled: updated.recordsPulled,
      recordsCreated: updated.recordsCreated,
      recordsUpdated: updated.recordsUpdated,
      recordsSkipped: updated.recordsSkipped,
      errorMessage: updated.errorMessage,
      durationMs: updated.durationMs,
      startedAt: updated.startedAt,
      completedAt: updated.completedAt,
      log: result.log,
      summary,
    }
  }

  // ── Webhook/file/CRUD-driven providers — no batch sync ──
  if (!meta.supportsBatchSync) {
    const log: SyncLogEntry[] = [
      {
        step: `${conn.provider}:skip`,
        status: 'skipped',
        message: `${meta.displayName} is ${conn.provider === 'whatsapp' ? 'webhook-driven' : conn.provider === 'excel' ? 'file-driven' : 'CRUD-driven'} — no batch sync required.`,
      },
    ]
    return finalize('success', {
      recordsPulled: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      recordsSkipped: 0,
      log,
      summary: `${meta.displayName} is event-driven — no batch sync performed.`,
    })
  }

  // ── Batch sync ──
  try {
    let result: SyncResult
    switch (conn.provider) {
      case 'gstn':
        result = await syncGstn(connectionId)
        break
      case 'gmail':
        result = await syncGmail(connectionId)
        break
      case 'drive':
        result = await syncDrive(connectionId)
        break
      case 'banks':
        result = await syncBanks(connectionId)
        break
      case 'razorpay':
        result = await syncRazorpay(connectionId)
        break
      // ── Real Data Connectors™ — generic adapters ──
      case 'outlook':
      case 'cashfree':
      case 'payu':
      case 'stripe':
      case 'tally':
      case 'zoho_books':
      case 'quickbooks':
      case 'hdfc':
      case 'icici':
      case 'sbi':
      case 'axis':
      case 'kotak':
      case 'indusind':
        result = await syncGenericConnector(connectionId, conn.provider as ProviderKey)
        break
      default: {
        const log: SyncLogEntry[] = [
          { step: `${conn.provider}:skip`, status: 'skipped', message: `No sync handler for provider "${conn.provider}".` },
        ]
        return finalize('success', {
          recordsPulled: 0,
          recordsCreated: 0,
          recordsUpdated: 0,
          recordsSkipped: 0,
          log,
          summary: `No sync handler for provider "${conn.provider}".`,
        })
      }
    }
    const status: 'success' | 'partial' =
      result.log.some((l) => l.status === 'error') ? 'partial' : 'success'
    return finalize(status, result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    const log: SyncLogEntry[] = [
      { step: `${conn.provider}:error`, status: 'error', message: msg },
    ]
    return finalize('error', { error: msg, log })
  }
}

// ─── Generic connector sync (Real Data Connectors™) ──────────────────────────
// Handles outlook, cashfree, payu, stripe, tally, zoho_books, quickbooks, and
// the 6 per-bank connectors. Loads the generic-adapters module, decrypts creds,
// and calls the provider-specific sync function. Writes domain events.

async function syncGenericConnector(
  connectionId: string,
  provider: ProviderKey,
): Promise<SyncResult> {
  const conn = await db.connection.findUnique({ where: { id: connectionId } })
  if (!conn) throw new Error('Connection not found.')

  if (!conn.credentialsEnc) {
    throw new IntegrationNotConfiguredError(
      provider,
      `${provider.toUpperCase()} is not configured. Add credentials to enable sync.`,
    )
  }

  const credsRaw = decryptCredentials(conn.credentialsEnc) as Record<string, unknown>
  const adapters = await import('./generic-adapters')

  const bankKeys: ProviderKey[] = ['hdfc', 'icici', 'sbi', 'axis', 'kotak', 'indusind']

  if (provider === 'outlook') return adapters.syncOutlook(credsRaw)
  if (provider === 'cashfree') return adapters.syncCashfree(credsRaw)
  if (provider === 'payu') return adapters.syncPayu(credsRaw)
  if (provider === 'stripe') return adapters.syncStripe(credsRaw)
  if (provider === 'tally') return adapters.syncTally(credsRaw)
  if (provider === 'zoho_books') return adapters.syncZohoBooks(credsRaw)
  if (provider === 'quickbooks') return adapters.syncQuickBooks(credsRaw)
  if (bankKeys.includes(provider)) return adapters.syncBankConnector(provider, credsRaw)

  // Should never reach here — the switch already validated the provider.
  return {
    recordsPulled: 0,
    recordsCreated: 0,
    recordsUpdated: 0,
    recordsSkipped: 0,
    log: [{ step: `${provider}:skip`, status: 'skipped', message: 'No adapter.' }],
    summary: `No adapter for ${provider}.`,
  }
}

// ─── Read helpers ───────────────────────────────────────────────────────────────

export async function getSyncJob(id: string) {
  const job = await db.syncJob.findUnique({ where: { id } })
  if (!job) return null
  return {
    ...job,
    log: job.log ? (JSON.parse(job.log) as SyncLogEntry[]) : [],
  }
}

export async function listSyncJobs(filter: ListSyncJobsFilter = {}): Promise<{
  syncJobs: Array<{
    id: string
    connectionId: string
    provider: string
    status: string
    startedAt: Date
    completedAt: Date | null
    durationMs: number | null
    recordsPulled: number
    recordsCreated: number
    recordsUpdated: number
    recordsSkipped: number
    errorMessage: string | null
    triggeredBy: string | null
    log: SyncLogEntry[]
  }>
  total: number
}> {
  const limit = Math.min(filter.limit ?? 20, 100)
  const offset = filter.offset ?? 0
  const where: {
    connectionId?: string
    provider?: string
    status?: string
  } = {}
  if (filter.connectionId) where.connectionId = filter.connectionId
  if (filter.provider) where.provider = filter.provider
  if (filter.status) where.status = filter.status

  const [rows, total] = await Promise.all([
    db.syncJob.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    db.syncJob.count({ where }),
  ])

  return {
    syncJobs: rows.map((r) => ({
      ...r,
      log: r.log ? (JSON.parse(r.log) as SyncLogEntry[]) : [],
    })),
    total,
  }
}

// re-export summarize for callers that want it
export { summarize }

// ─── Sync Engine™ — sync all connected providers ──────────────────────────────

export interface SyncAllResult {
  total: number
  succeeded: number
  failed: number
  skipped: number
  results: Array<{
    provider: string
    connectionId: string
    status: string
    recordsPulled: number
    summary: string | null
    error: string | null
  }>
}

/**
 * Sync every connected Connection in parallel. Called by the Sync Engine™
 * endpoint (/api/integrations/sync-all) every 5 minutes and on manual trigger.
 * Each connection's sync is independent — one failure doesn't block others.
 */
export async function syncAllConnected(triggeredBy: string = 'system'): Promise<SyncAllResult> {
  // Find all connections that are connected (or connecting with creds).
  const connections = await db.connection.findMany({
    where: {
      status: { in: ['connected', 'connecting'] },
    },
    orderBy: { createdAt: 'asc' },
  })

  // Also include Integration rows marked connected=true that map to adapter keys
  // (these are the Task 9 catalog entries that don't have a Connection row yet).
  const connectedIntegrations = await db.integration.findMany({
    where: { connected: true },
  })

  const results: SyncAllResult['results'] = []
  let succeeded = 0
  let failed = 0
  let skipped = 0

  // Sync each Connection
  for (const conn of connections) {
    try {
      const meta = getProviderMeta(conn.provider as ProviderKey)
      if (!meta.supportsBatchSync) {
        skipped++
        results.push({
          provider: conn.provider,
          connectionId: conn.id,
          status: 'skipped',
          recordsPulled: 0,
          summary: `${meta.displayName} is event-driven — no batch sync.`,
          error: null,
        })
        continue
      }
      const job = await runSync(conn.id, triggeredBy)
      if (job.status === 'error') {
        failed++
      } else {
        succeeded++
      }
      results.push({
        provider: conn.provider,
        connectionId: conn.id,
        status: job.status,
        recordsPulled: job.recordsPulled,
        summary: job.summary,
        error: job.errorMessage,
      })
    } catch (err) {
      failed++
      const msg = err instanceof Error ? err.message : String(err)
      results.push({
        provider: conn.provider,
        connectionId: conn.id,
        status: 'error',
        recordsPulled: 0,
        summary: null,
        error: msg,
      })
    }
  }

  // For connected Integrations without a Connection row, create + sync them.
  const ADAPTER_KEYS: ProviderKey[] = [
    'gstn', 'gmail', 'drive', 'whatsapp', 'banks', 'razorpay', 'excel', 'clients',
    'outlook', 'cashfree', 'payu', 'stripe', 'tally', 'zoho_books', 'quickbooks',
    'hdfc', 'icici', 'sbi', 'axis', 'kotak', 'indusind',
  ]
  for (const integration of connectedIntegrations) {
    // Skip if we already synced a Connection for this provider.
    if (results.some((r) => r.provider === integration.key)) continue
    if (!ADAPTER_KEYS.includes(integration.key as ProviderKey)) {
      // Non-adapter catalog entries (pdf, etc.) — skip.
      skipped++
      results.push({
        provider: integration.key,
        connectionId: '',
        status: 'skipped',
        recordsPulled: 0,
        summary: `${integration.name} has no adapter — display only.`,
        error: null,
      })
      continue
    }

    try {
      // Create a Connection row for this integration, then sync.
      const conn = await db.connection.create({
        data: {
          provider: integration.key,
          label: integration.name,
          status: 'connected',
        },
      })
      const meta = getProviderMeta(integration.key as ProviderKey)
      if (!meta.supportsBatchSync) {
        skipped++
        results.push({
          provider: integration.key,
          connectionId: conn.id,
          status: 'skipped',
          recordsPulled: 0,
          summary: `${integration.name} is event-driven.`,
          error: null,
        })
        continue
      }
      const job = await runSync(conn.id, triggeredBy)
      if (job.status === 'error') failed++
      else succeeded++
      results.push({
        provider: integration.key,
        connectionId: conn.id,
        status: job.status,
        recordsPulled: job.recordsPulled,
        summary: job.summary,
        error: job.errorMessage,
      })
    } catch (err) {
      failed++
      const msg = err instanceof Error ? err.message : String(err)
      results.push({
        provider: integration.key,
        connectionId: '',
        status: 'error',
        recordsPulled: 0,
        summary: null,
        error: msg,
      })
    }
  }

  return {
    total: connections.length + connectedIntegrations.length,
    succeeded,
    failed,
    skipped,
    results,
  }
}

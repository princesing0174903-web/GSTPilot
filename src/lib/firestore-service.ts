// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Firebase Workflow Engine
// Every write operation triggers automatic side effects:
//   - Activity logging
//   - Counter updates
//   - Notification generation
//   - Compliance score recalculation
//   - AI recommendation generation
// ═══════════════════════════════════════════════════════════════════════════════

import {
  collection, doc, addDoc, setDoc, updateDoc, deleteDoc,
  getDoc, getDocs, query, where, orderBy, limit,
  serverTimestamp, writeBatch, onSnapshot,
  type Unsubscribe, type DocumentReference, type QueryConstraint,
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import {
  COLLECTIONS,
  type FirestoreClient, type FirestoreDocument, type FirestoreInvoice,
  type FirestoreReturn, type FirestoreReconciliation, type FirestoreNotification,
  type FirestoreActivity, type FirestoreAIRecommendation, type FirestoreFirm,
  type FirestoreLead, type FirestoreDeal, type FirestoreMeeting, type FirestoreTask,
  type FirestoreBankAccount, type FirestoreBankTransaction,
  type FirestoreGstProfile, type FirestoreGstReturn,
  type FirestoreExpense, type FirestorePayment, type FirestoreAiMemory,
  type FirestoreNotice, type FirestoreReport,
  type FirestoreJournalEntry,
  type LeadStatus, type LeadSource, type DealStage, type MeetingType, type MeetingStatus,
  type ActivityType, type NotificationType, type NotificationPriority,
  type ReconMismatch, type DocumentStatus, type DocumentType,
  type LiveDashboardMetrics,
} from '@/lib/firestore-schema';
import type { FilingStatus, ClientStatus, InvoiceStatus, MatchStatus, RiskLevel, AIRecommendationType } from '@/types/gst';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function generateARN(): string {
  // DEPRECATED: This function is kept for reference but must NEVER be called.
  // GSTPilot never simulates successful government filings. A real ARN can
  // only come from the official GSTN API via the provider's fileReturn method.
  throw new Error(
    'generateARN() must never be called. Real ARNs come from GSTN only. ' +
    'Use the API route /api/gstr-filing/[id]/file which calls the GSTN provider.'
  );
}

function currentUserId(): string {
  return auth.currentUser?.uid || 'system';
}

/**
 * Returns the current organization id (the canonical tenant scope) or null.
 *
 * The OrgContext persists the active organization id to localStorage under
 * `gstpilot_org_id` whenever it resolves. This non-React module reads that
 * value so CRUD functions can stamp every document with `organizationId` —
 * the field the Firestore security rules and the onSnapshot hooks require.
 *
 * Falls back to the legacy `firmId` in `gstpilot_session` for compatibility
 * with older sessions.
 */
function currentOrgId(): string | null {
  try {
    // 1. Canonical: org id persisted by OrgContext.
    const orgId = localStorage.getItem('gstpilot_org_id');
    if (orgId) return orgId;
    // 2. Legacy: firmId embedded in the auth session.
    const stored = localStorage.getItem('gstpilot_session');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.firmId) return parsed.firmId;
    }
  } catch { /* ignore */ }
  return null;
}

/** Alias kept for backward compatibility with existing call sites. */
function currentFirmId(): string | null {
  return currentOrgId();
}

/**
 * Convert a Firestore snapshot ({ id, data() }) into a typed object with the
 * document id prepended, recursively converting Firestore Timestamps to ISO
 * strings. Mirrors the conversion logic in `withId` (firestore-schema.ts) but
 * drops the `T extends Record<string, unknown>` constraint so it accepts
 * strongly-typed interfaces (which do not have an implicit index signature).
 */
function docToData<T>(d: { id: string; data: () => Record<string, unknown> }): T & { id: string } {
  const data = d.data();
  const converted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
      converted[key] = (value as { toDate: () => Date }).toDate().toISOString();
    } else {
      converted[key] = value;
    }
  }
  return { id: d.id, ...converted } as T & { id: string };
}

// ─── 1. CLIENT WORKFLOW ─────────────────────────────────────────────────────
// Creating a client:
//   - Creates client document
//   - Increases Active Clients count on firm
//   - Adds activity log
//   - Generates compliance profile

export async function createClient(data: Omit<FirestoreClient, 'clientId' | 'firmId' | 'organizationId' | 'complianceProfile' | 'invoiceCount' | 'totalTaxPaid' | 'pendingReturnCount' | 'documentCount' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const firmId = currentFirmId();
  if (!firmId) throw new Error('No firm found. Please complete onboarding first.');

  const clientId = generateId();
  const clientRef = doc(db, COLLECTIONS.CLIENTS, clientId);

  const clientData: FirestoreClient = {
    ...data,
    clientId,
    firmId,
    organizationId: firmId,
    complianceProfile: {
      filingCompliance: 100,
      gstinValidity: true,
      lastFilingStatus: null,
      overdueReturns: 0,
      totalReturnsFiled: 0,
      averageFilingDelay: 0,
    },
    invoiceCount: 0,
    totalTaxPaid: 0,
    pendingReturnCount: 0,
    documentCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(clientRef, clientData);

  // Side effects (non-blocking)
  incrementFirmCounter(firmId, 'activeClientCount', 1);
  addActivity({
    type: 'client_created',
    title: 'Client added',
    description: `${data.tradeName} (${data.gstin}) added to the firm`,
    clientId,
    entityType: COLLECTIONS.CLIENTS,
    entityId: clientId,
  });
  addNotification({
    type: 'system',
    priority: 'low',
    title: 'New client onboarded',
    message: `${data.tradeName} has been added. Set up their compliance profile.`,
    entityType: COLLECTIONS.CLIENTS,
    entityId: clientId,
  });

  // Auto-create draft returns for current period if not exists
  autoCreateDraftReturns(firmId, clientId);

  return clientId;
}

export async function updateClient(clientId: string, updates: Partial<FirestoreClient>): Promise<void> {
  const clientRef = doc(db, COLLECTIONS.CLIENTS, clientId);
  await updateDoc(clientRef, { ...updates, updatedAt: serverTimestamp() });

  addActivity({
    type: 'client_updated',
    title: 'Client updated',
    description: `Client profile updated`,
    clientId,
    entityType: COLLECTIONS.CLIENTS,
    entityId: clientId,
  });
}

export async function deleteClient(clientId: string): Promise<void> {
  // Get client info before deleting
  const clientSnap = await getDoc(doc(db, COLLECTIONS.CLIENTS, clientId));
  const clientData = clientSnap.data() as FirestoreClient | undefined;
  const firmId = clientData?.firmId || currentFirmId();

  await deleteDoc(doc(db, COLLECTIONS.CLIENTS, clientId));

  // Side effects
  if (firmId) incrementFirmCounter(firmId, 'activeClientCount', -1);
  addActivity({
    type: 'client_deleted',
    title: 'Client removed',
    description: `${clientData?.tradeName || 'Client'} has been removed`,
    clientId,
    entityType: COLLECTIONS.CLIENTS,
    entityId: clientId,
  });
}

// ─── 2. DOCUMENT WORKFLOW ───────────────────────────────────────────────────
// Uploading a document:
//   - Creates document record
//   - Updates upload counters on client
//   - Triggers extraction status

export async function createDocument(data: {
  clientId: string;
  fileName: string;
  filePath?: string;
  fileSize: number;
  fileType: string;
  documentType: DocumentType;
  period?: string;
}): Promise<string> {
  const firmId = currentFirmId();
  const docId = generateId();
  const docRef = doc(db, COLLECTIONS.DOCUMENTS, docId);

  const docData: FirestoreDocument = {
    docId,
    firmId: firmId || '',
    organizationId: firmId || '',
    clientId: data.clientId,
    uploadedBy: currentUserId(),
    fileName: data.fileName,
    filePath: data.filePath || null,
    fileSize: data.fileSize,
    fileType: data.fileType,
    documentType: data.documentType,
    status: 'uploading',
    extractionStatus: 'pending',
    extractedInvoiceCount: 0,
    extractionAccuracy: 0,
    extractionError: null,
    period: data.period || null,
    metadata: {},
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(docRef, docData);

  // Update client document count
  incrementClientCounter(data.clientId, 'documentCount', 1);

  addActivity({
    type: 'document_uploaded',
    title: 'Document uploaded',
    description: `${data.fileName} uploaded for processing`,
    clientId: data.clientId,
    entityType: COLLECTIONS.DOCUMENTS,
    entityId: docId,
  });

  // Simulate extraction process (in production, this would be a Cloud Function trigger)
  simulateExtraction(docId, data.clientId);

  return docId;
}

export async function updateDocumentStatus(docId: string, status: DocumentStatus, extras?: Partial<FirestoreDocument>): Promise<void> {
  const docRef = doc(db, COLLECTIONS.DOCUMENTS, docId);
  await updateDoc(docRef, { status, ...extras, updatedAt: serverTimestamp() });
}

/** Queue document for extraction.
 *  In production this would be a Cloud Function trigger. Until that wiring
 *  exists, we mark the document as "queued" (NOT fabricated as "extracted"
 *  with random invoice counts / accuracy). The dashboard's
 *  `documentsProcessed` / `extractionsPending` metrics then reflect reality
 *  instead of fabricated numbers.
 */
function simulateExtraction(docId: string, clientId: string): void {
  // Mark as queued — real extraction happens when an OCR/AI pipeline picks it up.
  setTimeout(async () => {
    try {
      const docRef = doc(db, COLLECTIONS.DOCUMENTS, docId);
      await updateDoc(docRef, {
        status: 'queued',
        extractionStatus: 'pending',
        // Do NOT fabricate extractedInvoiceCount / extractionAccuracy here.
        // Those fields are populated by the real extraction pipeline.
        updatedAt: serverTimestamp(),
      });

      addActivity({
        type: 'document_processed',
        title: 'Document queued for extraction',
        description: `Document is waiting to be processed by the extraction pipeline.`,
        clientId,
        entityType: COLLECTIONS.DOCUMENTS,
        entityId: docId,
      });
    } catch (e) {
      console.warn('[Workflow] Extraction queueing failed:', e);
    }
  }, 800);
}

// ─── 3. INVOICE WORKFLOW ────────────────────────────────────────────────────
// Extracting invoices:
//   - Creates invoice records
//   - Calculates tax volume
//   - Updates dashboard statistics
//   - Generates draft returns

export async function createInvoice(data: Omit<FirestoreInvoice, 'invoiceId' | 'firmId' | 'organizationId' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const firmId = currentFirmId();
  const invoiceId = generateId();
  const invoiceRef = doc(db, COLLECTIONS.INVOICES, invoiceId);

  const invoiceData: FirestoreInvoice = {
    ...data,
    invoiceId,
    firmId: firmId || '',
    organizationId: firmId || '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(invoiceRef, invoiceData);

  // Update client counters
  incrementClientCounter(data.clientId, 'invoiceCount', 1);
  incrementClientCounter(data.clientId, 'totalTaxPaid', data.totalAmount);

  addActivity({
    type: 'invoice_extracted',
    title: 'Invoice extracted',
    description: `Invoice ${data.invoiceNumber} — ₹${data.totalAmount.toLocaleString('en-IN')}`,
    clientId: data.clientId,
    entityType: COLLECTIONS.INVOICES,
    entityId: invoiceId,
    metadata: { amount: data.totalAmount, invoiceType: data.invoiceType },
  });

  // Update draft return for this client's period
  // NOTE: totalTax is a NUMBER field (see FirestoreInvoice type), not a method.
  if (data.period) {
    updateDraftReturnForInvoice(firmId || '', data.clientId, data.returnType, data.period, data.totalAmount, typeof data.totalTax === 'number' ? data.totalTax : 0);
  }

  return invoiceId;
}

export async function updateInvoice(invoiceId: string, updates: Partial<FirestoreInvoice>): Promise<void> {
  const invoiceRef = doc(db, COLLECTIONS.INVOICES, invoiceId);
  await updateDoc(invoiceRef, { ...updates, updatedAt: serverTimestamp() });
}

export async function approveInvoice(invoiceId: string): Promise<void> {
  const invoiceRef = doc(db, COLLECTIONS.INVOICES, invoiceId);
  const invoiceSnap = await getDoc(invoiceRef);
  if (!invoiceSnap.exists()) return;

  await updateDoc(invoiceRef, {
    status: 'approved' as InvoiceStatus,
    riskScore: Math.max(0, (invoiceSnap.data().riskScore || 0) - 20),
    updatedAt: serverTimestamp(),
  });

  const data = invoiceSnap.data() as FirestoreInvoice;
  addActivity({
    type: 'invoice_approved',
    title: 'Invoice approved',
    description: `Invoice ${data.invoiceNumber} approved`,
    clientId: data.clientId,
    entityType: COLLECTIONS.INVOICES,
    entityId: invoiceId,
  });
}

export async function deleteInvoice(invoiceId: string): Promise<void> {
  const invoiceSnap = await getDoc(doc(db, COLLECTIONS.INVOICES, invoiceId));
  if (!invoiceSnap.exists()) return;
  const data = invoiceSnap.data() as FirestoreInvoice;

  await deleteDoc(doc(db, COLLECTIONS.INVOICES, invoiceId));
  incrementClientCounter(data.clientId, 'invoiceCount', -1);
}

// ─── 4. RETURN WORKFLOW ─────────────────────────────────────────────────────
// Preparing returns:
//   - Updates Ready to File counts
//   - Creates notifications
//   - Updates client compliance score
// Filing returns:
//   - Moves return to Filed state
//   - Generates ARN
//   - Updates dashboard metrics
//   - Adds timeline activity

export async function createReturn(data: Omit<FirestoreReturn, 'returnId' | 'firmId' | 'organizationId' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const firmId = currentFirmId();
  const returnId = generateId();
  const returnRef = doc(db, COLLECTIONS.RETURNS, returnId);

  const returnData: FirestoreReturn = {
    ...data,
    returnId,
    firmId: firmId || '',
    organizationId: firmId || '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(returnRef, returnData);

  incrementClientCounter(data.clientId, 'pendingReturnCount', 1);
  if (firmId) incrementFirmCounter(firmId, 'totalReturnCount', 1);

  addActivity({
    type: 'return_prepared',
    title: 'Return prepared',
    description: `${data.returnType} for ${data.period} created (Draft)`,
    clientId: data.clientId,
    entityType: COLLECTIONS.RETURNS,
    entityId: returnId,
  });

  return returnId;
}

export async function updateReturnStatus(returnId: string, status: FilingStatus, extras?: Partial<FirestoreReturn>): Promise<void> {
  const returnRef = doc(db, COLLECTIONS.RETURNS, returnId);
  const returnSnap = await getDoc(returnRef);
  if (!returnSnap.exists()) return;

  const data = returnSnap.data() as FirestoreReturn;
  await updateDoc(returnRef, { status, ...extras, updatedAt: serverTimestamp() });

  const statusActivityMap: Record<string, ActivityType> = {
    prepared: 'return_prepared',
    validated: 'return_prepared',
    reviewed: 'return_reviewed',
    generated: 'return_prepared',
    filed: 'return_filed',
    reopened: 'return_reopened',
  };

  const activityType = statusActivityMap[status] || 'return_prepared';
  const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);

  addActivity({
    type: activityType,
    title: `Return ${statusLabel}`,
    description: `${data.returnType} for ${data.period} moved to ${statusLabel}`,
    clientId: data.clientId,
    entityType: COLLECTIONS.RETURNS,
    entityId: returnId,
  });

  if (status === 'reviewed' || status === 'validated' || status === 'generated') {
    addNotification({
      type: 'return_reviewed',
      priority: 'normal',
      title: `${data.returnType} ready to file`,
      message: `${data.returnType} for ${data.period} has been ${statusLabel} and is ready for filing.`,
      entityType: COLLECTIONS.RETURNS,
      entityId: returnId,
    });

    // Update compliance score
    recalculateComplianceScore(data.clientId);
  }
}

export async function fileReturn(returnId: string): Promise<string> {
  // CRITICAL: This function MUST NOT fake the ARN.
  // GSTPilot never simulates successful government filings.
  //
  // The filing is delegated to the server-side API route which:
  //   1. Checks for an active GSTN connection (Firestore gst_connections)
  //   2. If no connection: returns 400 "GSTN connection required"
  //   3. If mock provider: returns 400 "Cannot file in mock mode"
  //   4. If official provider: calls provider.fileReturn() → real ARN
  //   5. Only marks as "filed" if a real ARN is returned
  //
  // The return status transitions:
  //   draft → prepared → validated → reviewed → submitted (awaiting GSTN ack)
  //   submitted → filed (only when real ARN received from GSTN)
  const response = await fetch(`/api/gstr-filing/${returnId}/file`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Filing failed' }));
    throw new Error(error.error || 'Failed to file return with GSTN');
  }

  const result = await response.json();

  // If the filing was submitted but not yet acknowledged (no real ARN),
  // the return is marked as "submitted" — not "filed".
  if (!result.acknowledgmentNumber) {
    throw new Error(
      'Return submitted to GSTN but not yet acknowledged. ' +
      'The return status is now "submitted" — it will become "filed" when ' +
      'GSTN returns an acknowledgment number (ARN). Check back after syncing.'
    );
  }

  return result.acknowledgmentNumber as string;
}

/** Auto-create draft returns for current period.
 *  Period format MUST be "YYYY-MM" to match gst-utils.ts (getFilingDueDate /
 *  isOverdue / periodToLabel) and the dashboard's parsePeriod. Writing
 *  "MM-YYYY" here previously caused "undefined 6" labels and inflated
 *  overdue counts on the dashboard.
 */
async function autoCreateDraftReturns(firmId: string, clientId: string): Promise<void> {
  const now = new Date();
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const fy = now.getMonth() >= 3 ? `${now.getFullYear()}-${String(now.getFullYear() + 1).slice(2)}` : `${now.getFullYear() - 1}-${String(now.getFullYear()).slice(2)}`;

  for (const returnType of ['GSTR-1', 'GSTR-3B'] as const) {
    // Check if return already exists
    const q = query(
      collection(db, COLLECTIONS.RETURNS),
      where('clientId', '==', clientId),
      where('returnType', '==', returnType),
      where('period', '==', period),
      limit(1)
    );
    const existing = await getDocs(q);
    if (existing.empty) {
      await createReturn({
        clientId,
        returnType,
        period,
        financialYear: fy,
        status: 'draft',
        filedDate: null,
        acknowledgmentNumber: null,
        totalInvoices: 0,
        readyForFiling: 0,
        issuesFound: 0,
        criticalErrors: 0,
        warnings: 0,
        totalTaxableValue: 0,
        totalTax: 0,
        jsonPayload: null,
        assignedTo: null,
        reviewedBy: null,
      });
    }
  }
}

/** Update draft return when an invoice is added */
async function updateDraftReturnForInvoice(firmId: string, clientId: string, returnType: string, period: string, taxableValue: number, taxAmount: number): Promise<void> {
  try {
    const q = query(
      collection(db, COLLECTIONS.RETURNS),
      where('clientId', '==', clientId),
      where('returnType', '==', returnType),
      where('period', '==', period),
      limit(1)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const returnDoc = snap.docs[0];
      const data = returnDoc.data() as FirestoreReturn;
      await updateDoc(returnDoc.ref, {
        totalInvoices: (data.totalInvoices || 0) + 1,
        totalTaxableValue: (data.totalTaxableValue || 0) + taxableValue,
        totalTax: (data.totalTax || 0) + taxAmount,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (e) {
    console.warn('[Workflow] Failed to update draft return:', e);
  }
}

// ─── 5. RECONCILIATION WORKFLOW ─────────────────────────────────────────────
// Reconciliation:
//   - Generates mismatch records
//   - Calculates ITC differences
//   - Generates AI recommendations

export async function createReconciliation(data: {
  clientId: string;
  period: string;
  sources: string;
}): Promise<string> {
  const firmId = currentFirmId();
  const reconId = generateId();
  const reconRef = doc(db, COLLECTIONS.RECONCILIATIONS, reconId);

  // ── Production reconciliation ──
  // Do NOT fabricate random mismatch records. Compute real counts from the
  // books (Firestore invoices for this client+period) and the portal
  // (GSTR-2B sync records if available). If portal data hasn't been synced
  // yet, the reconciliation is created with status "pending" and zeroed
  // counters — the real reconciliation engine (lib/banking/reconcile.ts or
  // lib/gstn/reconcile.ts) populates the mismatches when it runs.
  const booksQuery = query(
    collection(db, COLLECTIONS.INVOICES),
    where('clientId', '==', data.clientId),
    where('period', '==', data.period)
  );
  const booksSnap = await getDocs(booksQuery);
  const totalRecords = booksSnap.size;
  const matched = 0;
  const partialMatches = 0;
  const unmatched = 0;
  const highRisk = 0;
  const mismatches: ReconMismatch[] = [];
  const gstDifference = 0;

  const reconData: FirestoreReconciliation = {
    reconId,
    firmId: firmId || '',
    organizationId: firmId || '',
    clientId: data.clientId,
    period: data.period,
    sources: data.sources,
    // Status is "pending" until the real reconciliation engine runs and
    // populates mismatches. Previously this was hard-coded to "completed"
    // with fabricated random counts.
    status: 'pending',
    totalRecords,
    matched,
    unmatched,
    partialMatches,
    highRisk,
    gstDifference,
    mismatches,
    runBy: currentUserId(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(reconRef, reconData);

  addActivity({
    type: 'reconciliation_run',
    title: 'Reconciliation queued',
    description: `${data.sources}: ${totalRecords} book invoices found. Waiting for portal data to reconcile.`,
    clientId: data.clientId,
    entityType: COLLECTIONS.RECONCILIATIONS,
    entityId: reconId,
    metadata: { matched, unmatched, gstDifference, totalRecords },
  });

  // Do NOT auto-generate AI recommendations with random confidence scores.
  // Real recommendations are generated by the reconciliation engine after
  // actual mismatches are detected.
  void generateAIRecommendations; // keep the symbol referenced for tree-shaking

  addNotification({
    type: 'mismatch_found',
    priority: 'normal',
    title: 'Reconciliation created',
    message: `Reconciliation queued for ${data.period}. ${totalRecords} book invoices will be matched against portal data.`,
    entityType: COLLECTIONS.RECONCILIATIONS,
    entityId: reconId,
  });

  return reconId;
}

export async function resolveMismatch(reconId: string, invoiceNumber: string): Promise<void> {
  const reconRef = doc(db, COLLECTIONS.RECONCILIATIONS, reconId);
  const reconSnap = await getDoc(reconRef);
  if (!reconSnap.exists()) return;

  const data = reconSnap.data() as FirestoreReconciliation;
  const updatedMismatches = data.mismatches.map(m =>
    m.invoiceNumber === invoiceNumber
      ? { ...m, resolved: true, resolvedBy: currentUserId(), resolvedAt: new Date().toISOString() }
      : m
  );

  const resolvedCount = updatedMismatches.filter(m => m.resolved).length;
  const newUnmatched = updatedMismatches.filter(m => !m.resolved && m.matchStatus === 'missing_in_books').length;
  const newPartial = updatedMismatches.filter(m => !m.resolved && m.matchStatus === 'partial_match').length;

  await updateDoc(reconRef, {
    mismatches: updatedMismatches,
    unmatched: newUnmatched,
    partialMatches: newPartial,
    matched: data.totalRecords - newUnmatched - newPartial,
    updatedAt: serverTimestamp(),
  });

  addActivity({
    type: 'mismatch_resolved',
    title: 'Mismatch resolved',
    description: `Reconciliation mismatch for ${invoiceNumber} resolved`,
    clientId: data.clientId,
    entityType: COLLECTIONS.RECONCILIATIONS,
    entityId: reconId,
  });
}

// ─── 6. NOTIFICATION ENGINE ─────────────────────────────────────────────────

export async function addNotification(data: {
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  entityType?: string | null;
  entityId?: string | null;
}): Promise<void> {
  const firmId = currentFirmId();
  if (!firmId) return; // Can't add notification without firm

  const notifId = generateId();
  const notifRef = doc(db, COLLECTIONS.NOTIFICATIONS, notifId);

  const notifData: FirestoreNotification = {
    notifId,
    firmId,
    organizationId: firmId,
    userId: currentUserId(),
    type: data.type,
    priority: data.priority,
    title: data.title,
    message: data.message,
    entityType: data.entityType || null,
    entityId: data.entityId || null,
    read: false,
    actionUrl: null,
    createdAt: serverTimestamp(),
  };

  await setDoc(notifRef, notifData);
}

export async function markNotificationRead(notifId: string): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.NOTIFICATIONS, notifId), { read: true });
}

export async function markAllNotificationsRead(): Promise<void> {
  const firmId = currentFirmId();
  if (!firmId) return;

  const q = query(
    collection(db, COLLECTIONS.NOTIFICATIONS),
    where('firmId', '==', firmId),
    where('read', '==', false)
  );
  const snap = await getDocs(q);

  const batch = writeBatch(db);
  snap.docs.forEach(d => batch.update(d.ref, { read: true }));
  await batch.commit();
}

// ─── 7. ACTIVITY FEED ───────────────────────────────────────────────────────

export async function addActivity(data: {
  type: ActivityType;
  title: string;
  description: string;
  clientId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, string | number | boolean>;
}): Promise<void> {
  const firmId = currentFirmId();
  if (!firmId) return;

  const activityId = generateId();
  const activityRef = doc(db, COLLECTIONS.ACTIVITIES, activityId);

  const activityData: FirestoreActivity = {
    activityId,
    firmId,
    organizationId: firmId,
    userId: currentUserId(),
    clientId: data.clientId || null,
    type: data.type,
    title: data.title,
    description: data.description,
    entityType: data.entityType || null,
    entityId: data.entityId || null,
    metadata: data.metadata || {},
    createdAt: serverTimestamp(),
  };

  await setDoc(activityRef, activityData);
}

// ─── 8. AI RECOMMENDATIONS ──────────────────────────────────────────────────

function generateAIRecommendations(firmId: string, clientId: string, reconId: string, mismatches: ReconMismatch[]): void {
  const recommendations: AIRecommendationType[] = ['correct_gstin', 'adjust_gst_amount', 'review_vendor_data', 'review_manually', 'mark_as_duplicate'];

  mismatches.filter(m => !m.resolved).slice(0, 5).forEach((mismatch, i) => {
    const recId = generateId();
    const recType = recommendations[i % recommendations.length];

    const recData: FirestoreAIRecommendation = {
      recId,
      firmId,
      organizationId: firmId,
      clientId,
      invoiceId: null,
      reconId,
      type: recType,
      title: `${recType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} — ${mismatch.invoiceNumber}`,
      description: `ITC difference of ₹${mismatch.difference.toLocaleString('en-IN')} detected for invoice ${mismatch.invoiceNumber}. ${mismatch.reason}.`,
      suggestedAction: getSuggestedAction(recType),
      confidenceScore: 80, // deterministic baseline; real confidence comes from the ML model when available
      riskLevel: mismatch.difference > 50000 ? 'high' as RiskLevel : 'medium' as RiskLevel,
      status: 'active',
      dismissedBy: null,
      appliedBy: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    setDoc(doc(db, COLLECTIONS.AI_RECOMMENDATIONS, recId), recData);
  });
}

function getSuggestedAction(type: AIRecommendationType): string {
  const actions: Record<AIRecommendationType, string> = {
    correct_gstin: 'Verify and correct the GSTIN in the invoice to match portal records',
    correct_invoice_number: 'Update the invoice number format to match GST portal format',
    adjust_gst_amount: 'Adjust the GST amount to match the portal value and claim correct ITC',
    review_vendor_data: 'Cross-verify vendor details with GST portal records',
    mark_as_duplicate: 'Mark this as a duplicate entry and remove from records',
    review_manually: 'This case requires manual review — automated resolution not possible',
  };
  return actions[type];
}

export async function dismissRecommendation(recId: string): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.AI_RECOMMENDATIONS, recId), {
    status: 'dismissed',
    dismissedBy: currentUserId(),
    updatedAt: serverTimestamp(),
  });
}

// ─── COUNTER UPDATES ────────────────────────────────────────────────────────

async function incrementFirmCounter(firmId: string, field: keyof FirestoreFirm, delta: number): Promise<void> {
  try {
    const firmRef = doc(db, COLLECTIONS.FIRMS, firmId);
    const firmSnap = await getDoc(firmRef);
    if (!firmSnap.exists()) return;

    const current = (firmSnap.data()[field] as number) || 0;
    await updateDoc(firmRef, { [field]: Math.max(0, current + delta), updatedAt: serverTimestamp() });
  } catch (e) {
    console.warn('[Workflow] Firm counter update failed:', e);
  }
}

async function incrementClientCounter(clientId: string, field: keyof FirestoreClient, delta: number): Promise<void> {
  try {
    const clientRef = doc(db, COLLECTIONS.CLIENTS, clientId);
    const clientSnap = await getDoc(clientRef);
    if (!clientSnap.exists()) return;

    const current = (clientSnap.data()[field] as number) || 0;
    const numField = field as string;
    await updateDoc(clientRef, { [numField]: Math.max(0, current + delta), updatedAt: serverTimestamp() });
  } catch (e) {
    console.warn('[Workflow] Client counter update failed:', e);
  }
}

// ─── COMPLIANCE SCORE RECALCULATION ─────────────────────────────────────────

async function recalculateComplianceScore(clientId: string): Promise<void> {
  try {
    const clientRef = doc(db, COLLECTIONS.CLIENTS, clientId);
    const clientSnap = await getDoc(clientRef);
    if (!clientSnap.exists()) return;

    const client = clientSnap.data() as FirestoreClient;
    let score = 100;

    // Deductions
    score -= Math.min(client.complianceProfile.overdueReturns * 15, 45);
    score -= Math.min(client.complianceProfile.averageFilingDelay * 2, 20);
    if (!client.complianceProfile.gstinValidity) score -= 20;
    if (client.pendingReturnCount > 3) score -= 10;

    score = Math.max(0, Math.min(100, score));

    await updateDoc(clientRef, {
      healthScore: score,
      complianceProfile: {
        ...client.complianceProfile,
        filingCompliance: score,
      },
      updatedAt: serverTimestamp(),
    });
  } catch (e) {
    console.warn('[Workflow] Compliance recalc failed:', e);
  }
}

// ─── REAL-TIME LISTENER HELPERS ──────────────────────────────────────────────

/** Subscribe to a Firestore collection with firm scoping */
export function subscribeToCollection<T>(
  collectionName: CollectionName,
  callback: (data: Array<T & { id: string }>) => void,
  ...constraints: QueryConstraint[]
): Unsubscribe {
  const firmId = currentFirmId();

  const q = firmId
    ? query(collection(db, collectionName), where('firmId', '==', firmId), ...constraints)
    : query(collection(db, collectionName), ...constraints);

  return onSnapshot(q, (snap) => {
    const data = snap.docs.map(d => {
      const docData = d.data();
      const converted: Record<string, unknown> = { id: d.id };
      for (const [key, value] of Object.entries(docData)) {
        if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
          converted[key] = (value as { toDate: () => Date }).toDate().toISOString();
        } else {
          converted[key] = value;
        }
      }
      return converted as T & { id: string };
    });
    callback(data);
  }, (error) => {
    console.warn(`[Firestore] Subscription error for ${collectionName}:`, error);
    callback([]);
  });
}

/** Subscribe to a single Firestore document */
export function subscribeToDoc<T>(
  collectionName: CollectionName,
  docId: string,
  callback: (data: (T & { id: string }) | null) => void,
): Unsubscribe {
  return onSnapshot(doc(db, collectionName, docId), (snap) => {
    if (!snap.exists()) {
      callback(null);
      return;
    }
    const docData = snap.data();
    const converted: Record<string, unknown> = { id: snap.id };
    for (const [key, value] of Object.entries(docData)) {
      if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
        converted[key] = (value as { toDate: () => Date }).toDate().toISOString();
      } else {
        converted[key] = value;
      }
    }
    callback(converted as T & { id: string });
  }, (error) => {
    console.warn(`[Firestore] Doc subscription error for ${collectionName}/${docId}:`, error);
    callback(null);
  });
}

/** Compute live dashboard metrics from Firestore data */
export function computeDashboardMetrics(
  clients: Array<FirestoreClient & { id: string }>,
  invoices: Array<FirestoreInvoice & { id: string }>,
  returns: Array<FirestoreReturn & { id: string }>,
  documents: Array<FirestoreDocument & { id: string }>,
  activities: Array<FirestoreActivity & { id: string }>,
): LiveDashboardMetrics {
  const activeClients = clients.filter(c => c.status === 'active').length;
  const filedReturns = returns.filter(r => r.status === 'filed').length;
  const pendingReturns = returns.filter(r => r.status !== 'filed').length;
  const readyToFile = returns.filter(r => ['validated', 'reviewed', 'generated'].includes(r.status)).length;
  const overdueReturns = returns.filter(r => {
    if (r.status === 'filed') return false;
    const periodDate = parsePeriod(r.period);
    return periodDate && periodDate < new Date();
  }).length;

  const totalTaxVolume = invoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
  const totalTax = invoices.reduce((sum, inv) => sum + (inv.cgst || 0) + (inv.sgst || 0) + (inv.igst || 0) + (inv.cess || 0), 0);

  const criticalIssues = invoices.filter(inv => inv.riskLevel === 'critical').length +
    returns.filter(r => r.criticalErrors > 0).length;
  const warnings = invoices.filter(inv => inv.riskLevel === 'high' || inv.riskLevel === 'medium').length +
    returns.filter(r => r.warnings > 0).length;

  const averageHealthScore = clients.length > 0
    ? Math.round(clients.reduce((sum, c) => sum + c.healthScore, 0) / clients.length)
    : 0;

  const matchedInvoices = invoices.filter(inv => inv.matchStatus === 'perfect_match').length;
  const matchPercentage = invoices.length > 0 ? Math.round((matchedInvoices / invoices.length) * 100) : 100;

  const riskyInvoices = invoices.filter(inv => ['high', 'critical'].includes(inv.riskLevel)).length;
  const riskPercentage = invoices.length > 0 ? Math.round((riskyInvoices / invoices.length) * 100) : 0;

  const documentsProcessed = documents.filter(d => d.extractionStatus === 'completed').length;
  const extractionsPending = documents.filter(d => d.extractionStatus === 'pending' || d.extractionStatus === 'in_progress').length;

  const recentActivities = [...activities]
    .sort((a, b) => {
      const aTime = typeof a.createdAt === 'string' ? new Date(a.createdAt).getTime() : 0;
      const bTime = typeof b.createdAt === 'string' ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    })
    .slice(0, 10);

  const upcomingFilings = returns
    .filter(r => r.status !== 'filed')
    .sort((a, b) => {
      const aTime = typeof a.createdAt === 'string' ? new Date(a.createdAt).getTime() : 0;
      const bTime = typeof b.createdAt === 'string' ? new Date(b.createdAt).getTime() : 0;
      return aTime - bTime;
    })
    .slice(0, 5);

  return {
    totalClients: clients.length,
    activeClients,
    totalInvoices: invoices.length,
    totalTaxVolume,
    filedReturns,
    pendingReturns,
    overdueReturns,
    readyToFile,
    criticalIssues,
    warnings,
    averageHealthScore,
    matchPercentage,
    riskPercentage,
    documentsProcessed,
    extractionsPending,
    recentActivities,
    upcomingFilings,
  };
}

function parsePeriod(period: string | null): Date | null {
  if (!period) return null;
  try {
    const [mm, yyyy] = period.split('-').map(Number);
    if (!mm || !yyyy) return null;
    return new Date(yyyy, mm, 20); // Due date is typically 20th of next month
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CRM — Leads, Deals, Meetings (Recovered)
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Leads ────────────────────────────────────────────────────────────────────

export async function createLead(
  data: Omit<FirestoreLead, 'leadId' | 'firmId' | 'organizationId' | 'convertedClientId' | 'createdAt' | 'updatedAt'>,
): Promise<string> {
  const firmId = currentFirmId();
  if (!firmId) throw new Error('No firm found. Please complete onboarding first.');
  const leadId = generateId();
  const leadRef = doc(db, COLLECTIONS.LEADS, leadId);
  const leadData: FirestoreLead = {
    ...data,
    leadId,
    firmId,
    organizationId: firmId,
    convertedClientId: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(leadRef, leadData);
  return leadId;
}

export async function updateLead(leadId: string, updates: Partial<FirestoreLead>): Promise<void> {
  const leadRef = doc(db, COLLECTIONS.LEADS, leadId);
  await updateDoc(leadRef, { ...updates, updatedAt: serverTimestamp() });
}

export async function deleteLead(leadId: string): Promise<void> {
  const leadRef = doc(db, COLLECTIONS.LEADS, leadId);
  await deleteDoc(leadRef);
}

export async function convertLeadToClient(leadId: string): Promise<string> {
  // Read the lead, create a client from it, then mark lead as converted.
  const leadRef = doc(db, COLLECTIONS.LEADS, leadId);
  const leadSnap = await getDoc(leadRef);
  if (!leadSnap.exists()) throw new Error('Lead not found');
  const lead = leadSnap.data() as FirestoreLead;

  // Create the client using the existing createClient workflow (which handles
  // side effects: counters, compliance profile, draft returns, activity, etc.)
  const clientId = await createClient({
    tradeName: lead.company,
    legalName: lead.company,
    gstin: lead.gstin || '',
    contactEmail: lead.contactEmail,
    contactPhone: lead.contactPhone,
    address: '',
    state: '',
    stateCode: '',
    entityType: 'Regular',
    returnPeriod: null,
    lastFilingDate: null,
    status: 'active',
    healthScore: 0,
  });

  // Mark the lead as converted
  await updateDoc(leadRef, {
    status: 'converted' as LeadStatus,
    convertedClientId: clientId,
    updatedAt: serverTimestamp(),
  });

  return clientId;
}

// ─── Deals ────────────────────────────────────────────────────────────────────

export async function createDeal(
  data: Omit<FirestoreDeal, 'dealId' | 'firmId' | 'organizationId' | 'createdAt' | 'updatedAt'>,
): Promise<string> {
  const firmId = currentFirmId();
  if (!firmId) throw new Error('No firm found. Please complete onboarding first.');
  const dealId = generateId();
  const dealRef = doc(db, COLLECTIONS.DEALS, dealId);
  const dealData: FirestoreDeal = {
    ...data,
    dealId,
    firmId,
    organizationId: firmId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(dealRef, dealData);
  return dealId;
}

export async function updateDeal(dealId: string, updates: Partial<FirestoreDeal>): Promise<void> {
  const dealRef = doc(db, COLLECTIONS.DEALS, dealId);
  await updateDoc(dealRef, { ...updates, updatedAt: serverTimestamp() });
}

export async function deleteDeal(dealId: string): Promise<void> {
  const dealRef = doc(db, COLLECTIONS.DEALS, dealId);
  await deleteDoc(dealRef);
}

// ─── Meetings ─────────────────────────────────────────────────────────────────

export async function createMeeting(
  data: Omit<FirestoreMeeting, 'meetingId' | 'firmId' | 'organizationId' | 'createdAt' | 'updatedAt'>,
): Promise<string> {
  const firmId = currentFirmId();
  if (!firmId) throw new Error('No firm found. Please complete onboarding first.');
  const meetingId = generateId();
  const meetingRef = doc(db, COLLECTIONS.MEETINGS, meetingId);
  const meetingData: FirestoreMeeting = {
    ...data,
    meetingId,
    firmId,
    organizationId: firmId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(meetingRef, meetingData);
  return meetingId;
}

export async function updateMeeting(meetingId: string, updates: Partial<FirestoreMeeting>): Promise<void> {
  const meetingRef = doc(db, COLLECTIONS.MEETINGS, meetingId);
  await updateDoc(meetingRef, { ...updates, updatedAt: serverTimestamp() });
}

export async function deleteMeeting(meetingId: string): Promise<void> {
  const meetingRef = doc(db, COLLECTIONS.MEETINGS, meetingId);
  await deleteDoc(meetingRef);
}

// ─── Tasks ───────────────────────────────────────────────────────────────────
// CRUD added in P1-M2 so TasksPage can read/write the `tasks` collection.
// listTasks accepts an optional clientId to scope to one client; omit for
// firm-wide feed.

export async function listTasks(
  scope: { firmId?: string; clientId?: string },
): Promise<Array<FirestoreTask & { id: string }>> {
  const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc')];
  if (scope.clientId) {
    constraints.unshift(where('clientId', '==', scope.clientId));
  } else if (scope.firmId) {
    constraints.unshift(where('firmId', '==', scope.firmId));
  }
  const q = query(collection(db, COLLECTIONS.TASKS), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map(d => docToData<FirestoreTask>(d));
}

export async function createTask(
  data: Omit<FirestoreTask, 'taskId' | 'firmId' | 'organizationId' | 'createdAt' | 'updatedAt'>,
): Promise<string> {
  const firmId = currentFirmId();
  if (!firmId) throw new Error('No firm found. Please complete onboarding first.');
  const taskId = generateId();
  const ref = doc(db, COLLECTIONS.TASKS, taskId);
  const taskData: FirestoreTask = {
    ...data,
    taskId,
    firmId,
    organizationId: firmId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, taskData);
  return taskId;
}

export async function updateTask(
  taskId: string,
  updates: Partial<FirestoreTask>,
): Promise<void> {
  const ref = doc(db, COLLECTIONS.TASKS, taskId);
  await updateDoc(ref, { ...updates, updatedAt: serverTimestamp() });
}

export async function deleteTask(taskId: string): Promise<void> {
  const ref = doc(db, COLLECTIONS.TASKS, taskId);
  await deleteDoc(ref);
}

export async function getTask(
  taskId: string,
): Promise<(FirestoreTask & { id: string }) | null> {
  const snap = await getDoc(doc(db, COLLECTIONS.TASKS, taskId));
  if (!snap.exists()) return null;
  return docToData<FirestoreTask>(snap);
}

// ═══════════════════════════════════════════════════════════════════════════════
// BANKING, GST, FINANCE & AI MEMORY (PT-3-5)
// Each new collection follows the same CRUD shape:
//   listXxx / createXxx / updateXxx / deleteXxx / getXxx
// Reads use getDocs + query + where + orderBy. Writes use setDoc + generateId()
// (matching the existing CRM pattern) so the typed xxxId field stays consistent
// with the Firestore doc id.
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Bank Accounts ───────────────────────────────────────────────────────────

export async function listBankAccounts(
  firmId: string,
): Promise<Array<FirestoreBankAccount & { id: string }>> {
  const q = query(
    collection(db, COLLECTIONS.BANK_ACCOUNTS),
    where('firmId', '==', firmId),
    orderBy('createdAt', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => docToData<FirestoreBankAccount>(d));
}

export async function createBankAccount(
  data: Omit<FirestoreBankAccount, 'bankAccountId' | 'firmId' | 'organizationId' | 'createdAt' | 'updatedAt'>,
): Promise<string> {
  const firmId = currentFirmId();
  if (!firmId) throw new Error('No firm found. Please complete onboarding first.');
  const bankAccountId = generateId();
  const ref = doc(db, COLLECTIONS.BANK_ACCOUNTS, bankAccountId);
  const bankAccountData: FirestoreBankAccount = {
    ...data,
    bankAccountId,
    firmId,
    organizationId: firmId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, bankAccountData);
  return bankAccountId;
}

export async function updateBankAccount(
  bankAccountId: string,
  updates: Partial<FirestoreBankAccount>,
): Promise<void> {
  const ref = doc(db, COLLECTIONS.BANK_ACCOUNTS, bankAccountId);
  await updateDoc(ref, { ...updates, updatedAt: serverTimestamp() });
}

export async function deleteBankAccount(bankAccountId: string): Promise<void> {
  const ref = doc(db, COLLECTIONS.BANK_ACCOUNTS, bankAccountId);
  await deleteDoc(ref);
}

export async function getBankAccount(
  bankAccountId: string,
): Promise<(FirestoreBankAccount & { id: string }) | null> {
  const snap = await getDoc(doc(db, COLLECTIONS.BANK_ACCOUNTS, bankAccountId));
  if (!snap.exists()) return null;
  return docToData<FirestoreBankAccount>(snap);
}

// ─── Bank Transactions ──────────────────────────────────────────────────────
// listBankTransactions accepts EITHER a firmId OR a bankAccountId — when
// bankAccountId is provided it scopes to that account; otherwise falls back to
// firm-wide query.

export async function listBankTransactions(
  scope: { firmId?: string; bankAccountId?: string },
): Promise<Array<FirestoreBankTransaction & { id: string }>> {
  const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc')];
  if (scope.bankAccountId) {
    constraints.unshift(where('bankAccountId', '==', scope.bankAccountId));
  } else if (scope.firmId) {
    constraints.unshift(where('firmId', '==', scope.firmId));
  }
  const q = query(collection(db, COLLECTIONS.BANK_TRANSACTIONS), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map(d => docToData<FirestoreBankTransaction>(d));
}

export async function createBankTransaction(
  data: Omit<FirestoreBankTransaction, 'bankTxnId' | 'firmId' | 'organizationId' | 'createdAt'>,
): Promise<string> {
  const firmId = currentFirmId();
  if (!firmId) throw new Error('No firm found. Please complete onboarding first.');
  const bankTxnId = generateId();
  const ref = doc(db, COLLECTIONS.BANK_TRANSACTIONS, bankTxnId);
  const bankTxnData: FirestoreBankTransaction = {
    ...data,
    bankTxnId,
    firmId,
    organizationId: firmId,
    createdAt: serverTimestamp(),
  };
  await setDoc(ref, bankTxnData);
  return bankTxnId;
}

export async function updateBankTransaction(
  bankTxnId: string,
  updates: Partial<FirestoreBankTransaction>,
): Promise<void> {
  const ref = doc(db, COLLECTIONS.BANK_TRANSACTIONS, bankTxnId);
  await updateDoc(ref, updates);
}

export async function deleteBankTransaction(bankTxnId: string): Promise<void> {
  const ref = doc(db, COLLECTIONS.BANK_TRANSACTIONS, bankTxnId);
  await deleteDoc(ref);
}

// ─── GST Profiles ───────────────────────────────────────────────────────────

export async function listGstProfiles(
  firmId: string,
): Promise<Array<FirestoreGstProfile & { id: string }>> {
  const q = query(
    collection(db, COLLECTIONS.GST_PROFILES),
    where('firmId', '==', firmId),
    orderBy('createdAt', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => docToData<FirestoreGstProfile>(d));
}

export async function createGstProfile(
  data: Omit<FirestoreGstProfile, 'gstProfileId' | 'firmId' | 'organizationId' | 'createdAt' | 'updatedAt'>,
): Promise<string> {
  const firmId = currentFirmId();
  if (!firmId) throw new Error('No firm found. Please complete onboarding first.');
  const gstProfileId = generateId();
  const ref = doc(db, COLLECTIONS.GST_PROFILES, gstProfileId);
  const profileData: FirestoreGstProfile = {
    ...data,
    gstProfileId,
    firmId,
    organizationId: firmId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, profileData);
  return gstProfileId;
}

export async function updateGstProfile(
  gstProfileId: string,
  updates: Partial<FirestoreGstProfile>,
): Promise<void> {
  const ref = doc(db, COLLECTIONS.GST_PROFILES, gstProfileId);
  await updateDoc(ref, { ...updates, updatedAt: serverTimestamp() });
}

export async function deleteGstProfile(gstProfileId: string): Promise<void> {
  const ref = doc(db, COLLECTIONS.GST_PROFILES, gstProfileId);
  await deleteDoc(ref);
}

export async function getGstProfile(
  gstProfileId: string,
): Promise<(FirestoreGstProfile & { id: string }) | null> {
  const snap = await getDoc(doc(db, COLLECTIONS.GST_PROFILES, gstProfileId));
  if (!snap.exists()) return null;
  return docToData<FirestoreGstProfile>(snap);
}

// ─── GST Returns ────────────────────────────────────────────────────────────
// listGstReturns accepts EITHER a firmId OR a gstProfileId — when gstProfileId
// is provided it scopes to that GSTN profile; otherwise falls back to firm-wide.

export async function listGstReturns(
  scope: { firmId?: string; gstProfileId?: string },
): Promise<Array<FirestoreGstReturn & { id: string }>> {
  const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc')];
  if (scope.gstProfileId) {
    constraints.unshift(where('gstProfileId', '==', scope.gstProfileId));
  } else if (scope.firmId) {
    constraints.unshift(where('firmId', '==', scope.firmId));
  }
  const q = query(collection(db, COLLECTIONS.GST_RETURNS), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map(d => docToData<FirestoreGstReturn>(d));
}

export async function createGstReturn(
  data: Omit<FirestoreGstReturn, 'gstReturnId' | 'firmId' | 'organizationId' | 'createdAt' | 'updatedAt'>,
): Promise<string> {
  const firmId = currentFirmId();
  if (!firmId) throw new Error('No firm found. Please complete onboarding first.');
  const gstReturnId = generateId();
  const ref = doc(db, COLLECTIONS.GST_RETURNS, gstReturnId);
  const returnData: FirestoreGstReturn = {
    ...data,
    gstReturnId,
    firmId,
    organizationId: firmId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, returnData);
  return gstReturnId;
}

export async function updateGstReturn(
  gstReturnId: string,
  updates: Partial<FirestoreGstReturn>,
): Promise<void> {
  const ref = doc(db, COLLECTIONS.GST_RETURNS, gstReturnId);
  await updateDoc(ref, { ...updates, updatedAt: serverTimestamp() });
}

export async function deleteGstReturn(gstReturnId: string): Promise<void> {
  const ref = doc(db, COLLECTIONS.GST_RETURNS, gstReturnId);
  await deleteDoc(ref);
}

// ─── Expenses ───────────────────────────────────────────────────────────────

export async function listExpenses(
  firmId: string,
): Promise<Array<FirestoreExpense & { id: string }>> {
  const q = query(
    collection(db, COLLECTIONS.EXPENSES),
    where('firmId', '==', firmId),
    orderBy('createdAt', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => docToData<FirestoreExpense>(d));
}

export async function createExpense(
  data: Omit<FirestoreExpense, 'expenseId' | 'firmId' | 'organizationId' | 'createdAt' | 'updatedAt'>,
): Promise<string> {
  const firmId = currentFirmId();
  if (!firmId) throw new Error('No firm found. Please complete onboarding first.');
  const expenseId = generateId();
  const ref = doc(db, COLLECTIONS.EXPENSES, expenseId);
  const expenseData: FirestoreExpense = {
    ...data,
    expenseId,
    firmId,
    organizationId: firmId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, expenseData);
  return expenseId;
}

export async function updateExpense(
  expenseId: string,
  updates: Partial<FirestoreExpense>,
): Promise<void> {
  const ref = doc(db, COLLECTIONS.EXPENSES, expenseId);
  await updateDoc(ref, { ...updates, updatedAt: serverTimestamp() });
}

export async function deleteExpense(expenseId: string): Promise<void> {
  const ref = doc(db, COLLECTIONS.EXPENSES, expenseId);
  await deleteDoc(ref);
}

// ─── Payments ───────────────────────────────────────────────────────────────

export async function listPayments(
  firmId: string,
): Promise<Array<FirestorePayment & { id: string }>> {
  const q = query(
    collection(db, COLLECTIONS.PAYMENTS),
    where('firmId', '==', firmId),
    orderBy('createdAt', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => docToData<FirestorePayment>(d));
}

export async function createPayment(
  data: Omit<FirestorePayment, 'paymentId' | 'firmId' | 'organizationId' | 'createdAt' | 'updatedAt'>,
): Promise<string> {
  const firmId = currentFirmId();
  if (!firmId) throw new Error('No firm found. Please complete onboarding first.');
  const paymentId = generateId();
  const ref = doc(db, COLLECTIONS.PAYMENTS, paymentId);
  const paymentData: FirestorePayment = {
    ...data,
    paymentId,
    firmId,
    organizationId: firmId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, paymentData);
  return paymentId;
}

export async function updatePayment(
  paymentId: string,
  updates: Partial<FirestorePayment>,
): Promise<void> {
  const ref = doc(db, COLLECTIONS.PAYMENTS, paymentId);
  await updateDoc(ref, { ...updates, updatedAt: serverTimestamp() });
}

export async function deletePayment(paymentId: string): Promise<void> {
  const ref = doc(db, COLLECTIONS.PAYMENTS, paymentId);
  await deleteDoc(ref);
}

// ─── AI Memory ──────────────────────────────────────────────────────────────
// listAiMemories accepts an optional agent filter so an AI agent can fetch
// just its own memory.

export async function listAiMemories(
  firmId: string,
  agent?: string,
): Promise<Array<FirestoreAiMemory & { id: string }>> {
  const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc')];
  if (agent) {
    constraints.unshift(where('agent', '==', agent));
  }
  const q = query(
    collection(db, COLLECTIONS.AI_MEMORY),
    where('firmId', '==', firmId),
    ...constraints,
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => docToData<FirestoreAiMemory>(d));
}

export async function createAiMemory(
  data: Omit<FirestoreAiMemory, 'memoryId' | 'firmId' | 'organizationId' | 'createdAt' | 'updatedAt'>,
): Promise<string> {
  const firmId = currentFirmId();
  if (!firmId) throw new Error('No firm found. Please complete onboarding first.');
  const memoryId = generateId();
  const ref = doc(db, COLLECTIONS.AI_MEMORY, memoryId);
  const memoryData: FirestoreAiMemory = {
    ...data,
    memoryId,
    firmId,
    organizationId: firmId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, memoryData);
  return memoryId;
}

export async function updateAiMemory(
  memoryId: string,
  updates: Partial<FirestoreAiMemory>,
): Promise<void> {
  const ref = doc(db, COLLECTIONS.AI_MEMORY, memoryId);
  await updateDoc(ref, { ...updates, updatedAt: serverTimestamp() });
}

export async function deleteAiMemory(memoryId: string): Promise<void> {
  const ref = doc(db, COLLECTIONS.AI_MEMORY, memoryId);
  await deleteDoc(ref);
}

// ═══════════════════════════════════════════════════════════════════════════════
// NOTICES & REPORTS (Phase 1 — Real Backend Foundation)
// Each follows the same CRUD shape as the other Phase 1 collections:
//   listXxx / createXxx / updateXxx / deleteXxx / getXxx
// Reads use getDocs + query + where + orderBy. Writes use setDoc + generateId()
// (matching the existing pattern) so the typed xxxId field stays consistent
// with the Firestore doc id.
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Notices ─────────────────────────────────────────────────────────────────
// listNotices accepts an optional clientId to scope to one client; omit for
// firm-wide feed.

export async function listNotices(
  scope: { firmId?: string; clientId?: string },
): Promise<Array<FirestoreNotice & { id: string }>> {
  const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc')];
  if (scope.clientId) {
    constraints.unshift(where('clientId', '==', scope.clientId));
  } else if (scope.firmId) {
    constraints.unshift(where('firmId', '==', scope.firmId));
  }
  const q = query(collection(db, COLLECTIONS.NOTICES), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map(d => docToData<FirestoreNotice>(d));
}

export async function createNotice(
  data: Omit<FirestoreNotice, 'noticeId' | 'firmId' | 'organizationId' | 'createdAt' | 'updatedAt'>,
): Promise<string> {
  const firmId = currentFirmId();
  if (!firmId) throw new Error('No firm found. Please complete onboarding first.');
  const noticeId = generateId();
  const ref = doc(db, COLLECTIONS.NOTICES, noticeId);
  const noticeData: FirestoreNotice = {
    ...data,
    noticeId,
    firmId,
    organizationId: firmId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, noticeData);

  // Side effects — notify the firm + log activity
  addActivity({
    type: 'system',
    title: 'Notice added',
    description: `${data.subject}${data.clientTradeName ? ` — ${data.clientTradeName}` : ''}`,
    clientId: data.clientId || null,
    entityType: COLLECTIONS.NOTICES,
    entityId: noticeId,
  });
  addNotification({
    type: 'issue_detected',
    priority: data.priority === 'urgent' ? 'urgent' : 'high',
    title: 'New notice added',
    message: `${data.noticeType.replace(/_/g, ' ')}: ${data.subject}`,
    entityType: COLLECTIONS.NOTICES,
    entityId: noticeId,
  });

  return noticeId;
}

export async function updateNotice(
  noticeId: string,
  updates: Partial<FirestoreNotice>,
): Promise<void> {
  const ref = doc(db, COLLECTIONS.NOTICES, noticeId);
  await updateDoc(ref, { ...updates, updatedAt: serverTimestamp() });
}

export async function deleteNotice(noticeId: string): Promise<void> {
  const ref = doc(db, COLLECTIONS.NOTICES, noticeId);
  await deleteDoc(ref);
}

export async function getNotice(
  noticeId: string,
): Promise<(FirestoreNotice & { id: string }) | null> {
  const snap = await getDoc(doc(db, COLLECTIONS.NOTICES, noticeId));
  if (!snap.exists()) return null;
  return docToData<FirestoreNotice>(snap);
}

// ─── Reports ─────────────────────────────────────────────────────────────────
// listReports accepts an optional clientId to scope to one client; omit for
// firm-wide feed.

export async function listReports(
  scope: { firmId?: string; clientId?: string },
): Promise<Array<FirestoreReport & { id: string }>> {
  const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc')];
  if (scope.clientId) {
    constraints.unshift(where('clientId', '==', scope.clientId));
  } else if (scope.firmId) {
    constraints.unshift(where('firmId', '==', scope.firmId));
  }
  const q = query(collection(db, COLLECTIONS.REPORTS), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map(d => docToData<FirestoreReport>(d));
}

export async function createReport(
  data: Omit<FirestoreReport, 'reportId' | 'firmId' | 'organizationId' | 'createdAt' | 'updatedAt'>,
): Promise<string> {
  const firmId = currentFirmId();
  if (!firmId) throw new Error('No firm found. Please complete onboarding first.');
  const reportId = generateId();
  const ref = doc(db, COLLECTIONS.REPORTS, reportId);
  const reportData: FirestoreReport = {
    ...data,
    reportId,
    firmId,
    organizationId: firmId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, reportData);
  return reportId;
}

export async function updateReport(
  reportId: string,
  updates: Partial<FirestoreReport>,
): Promise<void> {
  const ref = doc(db, COLLECTIONS.REPORTS, reportId);
  await updateDoc(ref, { ...updates, updatedAt: serverTimestamp() });
}

export async function deleteReport(reportId: string): Promise<void> {
  const ref = doc(db, COLLECTIONS.REPORTS, reportId);
  await deleteDoc(ref);
}

export async function getReport(
  reportId: string,
): Promise<(FirestoreReport & { id: string }) | null> {
  const snap = await getDoc(doc(db, COLLECTIONS.REPORTS, reportId));
  if (!snap.exists()) return null;
  return docToData<FirestoreReport>(snap);
}

// ─── Manual Journal Entries ──────────────────────────────────────────────────

export async function createJournalEntry(
  data: Omit<FirestoreJournalEntry, 'jeId' | 'organizationId' | 'source' | 'createdBy' | 'createdAt' | 'updatedAt'>,
): Promise<string> {
  const orgId = currentOrgId();
  if (!orgId) throw new Error('No organization found. Please complete onboarding first.');
  const jeId = generateId();
  const ref = doc(db, COLLECTIONS.JOURNAL_ENTRIES, jeId);
  const jeData: FirestoreJournalEntry = {
    ...data,
    jeId,
    organizationId: orgId,
    source: 'manual',
    createdBy: currentUserId(),
    createdByName: auth.currentUser?.displayName || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, jeData);

  addActivity({
    type: 'system',
    title: 'Manual journal entry posted',
    description: `${data.description} — Dr ${data.debitAccount}, Cr ${data.creditAccount} (₹${data.amount.toLocaleString('en-IN')})`,
    clientId: null,
    entityType: COLLECTIONS.JOURNAL_ENTRIES,
    entityId: jeId,
  });

  return jeId;
}

export async function deleteJournalEntry(jeId: string): Promise<void> {
  const ref = doc(db, COLLECTIONS.JOURNAL_ENTRIES, jeId);
  await deleteDoc(ref);
}

export async function listJournalEntries(
  scope: { firmId?: string; clientId?: string },
): Promise<Array<FirestoreJournalEntry & { id: string }>> {
  const constraints: QueryConstraint[] = [orderBy('entryDate', 'desc')];
  if (scope.clientId) {
    constraints.unshift(where('clientId', '==', scope.clientId));
  } else if (scope.firmId) {
    constraints.unshift(where('organizationId', '==', scope.firmId));
  }
  const q = query(collection(db, COLLECTIONS.JOURNAL_ENTRIES), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map(d => docToData<FirestoreJournalEntry>(d));
}

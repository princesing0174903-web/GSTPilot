/* eslint-disable react-hooks/set-state-in-effect -- Firestore onSnapshot hooks legitimately clear state synchronously on early-exit paths (no docId, preview mode, no user). The cascading-render concern doesn't apply here because these are deterministic single-pass resets, not derived-state updates. */
// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO — Real-time Firestore Hooks
// React hooks with onSnapshot listeners for live data + optimistic UI.
//
// ARCHITECTURE (Production-grade multi-tenant):
//   • Every query is scoped by `organizationId` from OrgContext — NEVER by the
//     legacy `firmId`. This matches the Firestore security rules, which require
//     every tenant-scoped document to carry `organizationId` and only allow
//     reads where `isOrgMember(resource.data.organizationId)` is true.
//   • If there is no organization (preview / demo mode, or not yet loaded),
//     hooks return empty data WITHOUT subscribing — so the UI renders premium
//     empty states instead of throwing permission errors.
//   • Permission errors (permission-denied / unauthenticated) are treated as
//     "no data available" — the hook clears its error and returns an empty
//     array. This is the graceful-degradation contract: the app NEVER shows a
//     "Missing or insufficient permissions" wall. Genuine errors (network,
//     index missing) still surface as `error`.
// ═══════════════════════════════════════════════════════════════════════════════

'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  collection, doc, onSnapshot, query, where, orderBy, limit,
  type Unsubscribe, type QueryConstraint,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useOrg } from '@/contexts/OrgContext';
import { isLocalOrgId } from '@/lib/gstpilot-data/local-workspace';
import {
  COLLECTIONS,
  type FirestoreClient, type FirestoreDocument, type FirestoreInvoice,
  type FirestoreReturn, type FirestoreReconciliation, type FirestoreNotification,
  type FirestoreActivity, type FirestoreAIRecommendation, type FirestoreFirm,
  type FirestorePrediction, type FirestorePriority, type FirestoreOrganization, type FirestoreMembership,
  type FirestoreLead, type FirestoreDeal, type FirestoreMeeting, type FirestoreTask,
  type FirestoreBankAccount, type FirestoreBankTransaction,
  type FirestoreGstProfile, type FirestoreGstReturn,
  type FirestoreExpense, type FirestorePayment, type FirestoreAiMemory,
  type FirestoreNotice, type FirestoreReport,
  type FirestoreJournalEntry,
  type LiveDashboardMetrics, type FirmExecutiveScores, type CollectionName,
} from '@/lib/firestore-schema';
import { computeDashboardMetrics } from '@/lib/firestore-service';

// ─── Permission-error detection (graceful degradation) ───────────────────────

/**
 * True if the given Firestore error is a permission / auth failure that we
 * should treat as "no data available" rather than a hard error. This is the
 * core of the never-show-a-permission-wall contract.
 */
function isPermissionError(err: unknown): boolean {
  if (!err) return false;
  const e = err as { code?: string; message?: string };
  const code = (e.code || '').toLowerCase();
  const message = (e.message || '').toLowerCase();
  if (
    code === 'permission-denied' ||
    code === 'unauthenticated' ||
    code === 'auth/operation-not-allowed' ||
    code === 'auth/user-not-found'
  ) {
    return true;
  }
  if (
    message.includes('missing or insufficient permissions') ||
    message.includes('permission-denied') ||
    message.includes('insufficient permissions') ||
    message.includes('not authorized') ||
    message.includes('unauthenticated')
  ) {
    return true;
  }
  return false;
}

// ─── Timestamp Converter ─────────────────────────────────────────────────────

function convertDoc<T extends Record<string, unknown>>(snapData: Record<string, unknown>): T {
  const converted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(snapData)) {
    if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
      converted[key] = (value as { toDate: () => Date }).toDate().toISOString();
    } else if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      // Recursively convert nested objects
      converted[key] = convertDoc(value as Record<string, unknown>);
    } else {
      converted[key] = value;
    }
  }
  return converted as T;
}

// ─── Generic Collection Hook ─────────────────────────────────────────────────
//
// The hook resolves the current `organizationId` from OrgContext. If the org
// isn't resolved yet (loading) OR we're in preview mode (no org), the hook
// returns empty data without subscribing. This guarantees no permission errors
// ever reach the UI in preview/offline mode.

function useFirestoreCollection<T>(
  collectionName: CollectionName,
  constraints: QueryConstraint[] = [],
  deps: unknown[] = [],
): { data: Array<T & { id: string }>; loading: boolean; error: string | null } {
  const { user } = useAuth();
  const { organization, isPreviewMode, loading: orgLoading } = useOrg();
  const organizationId = organization?.id ?? null;

  const [data, setData] = useState<Array<T & { id: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // No user → nothing to subscribe to (empty data).
    if (!user) {
      setData([]);
      setLoading(false);
      setError(null);
      return;
    }

    // Org still resolving — keep loading state true briefly, but never hang.
    // A safety timeout (OrgContext resolves in <3s for demo users and <15s for
    // real Firebase users via the DashboardTimeoutBoundary) means this branch
    // is a transient state, not a permanent one. If we ever land here with
    // orgLoading=false, clear loading so we don't sit on a spinner forever.
    if (orgLoading && !organizationId) {
      // Stay loading while org is genuinely resolving. OrgContext will fire
      // a re-render with `organization` set, which re-runs this effect.
      // Safety: ensure loading can't hang forever even if OrgContext stalls.
      const watchdog = setTimeout(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLoading(false);
      }, 30_000);
      return () => clearTimeout(watchdog);
    }
    // If we got here with no organization at all (e.g. local workspace,
    // preview mode, or post-sign-out), clear loading immediately.
    if (!organizationId) {
      setData([]);
      setLoading(false);
      setError(null);
      return;
    }

    // Local workspace, preview mode (no real org), OR no organization at all
    // → empty data, no subscription. This prevents permission-denied errors
    // when the user is on a local workspace (Firestore is unreachable).
    if (!organizationId || isPreviewMode || isLocalOrgId(organizationId)) {
      setData([]);
      setLoading(false);
      setError(null);
      return;
    }

    let unsub: Unsubscribe | null = null;

    // Scope EVERY query by organizationId. This is required by the Firestore
    // security rules — unbounded collection reads are denied.
    const baseConstraints: QueryConstraint[] = [
      where('organizationId', '==', organizationId),
      ...constraints,
    ];

    const q = query(collection(db, collectionName), ...baseConstraints);

    unsub = onSnapshot(q, (snap) => {
      const items = snap.docs.map(d => ({
        id: d.id,
        ...convertDoc<T>(d.data() as Record<string, unknown>),
      }));
      setData(items);
      setLoading(false);
      setError(null);
    }, (err) => {
      console.warn(`[Firestore] ${collectionName} subscription error:`, err);
      // Permission errors → graceful degradation (empty data, no error wall).
      if (isPermissionError(err)) {
        setData([]);
        setError(null);
        setLoading(false);
        return;
      }
      // Genuine errors (network, missing index) still surface.
      setError(err.message);
      setLoading(false);
    });

    return () => {
      if (unsub) unsub();
    };
  }, [user, organizationId, isPreviewMode, orgLoading, ...deps]);

  // When user is null, return empty data (not loading)
  if (!user && loading) {
    return { data: [], loading: false, error: null };
  }

  return { data, loading, error };
}

// ─── Generic Document Hook ───────────────────────────────────────────────────

function useFirestoreDoc<T>(
  collectionName: CollectionName,
  docId: string | null,
): { data: (T & { id: string }) | null; loading: boolean; error: string | null } {
  const { user } = useAuth();
  const { organization, isPreviewMode } = useOrg();
  const organizationId = organization?.id ?? null;

  const [data, setData] = useState<(T & { id: string }) | null>(null);
  const [loading, setLoading] = useState(!!docId);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!docId) {
      setData(null);
      setLoading(false);
      return;
    }

    // Local workspace, preview mode (no real org) → no doc, no subscription.
    if (!user || !organizationId || isPreviewMode || isLocalOrgId(organizationId)) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    const unsub = onSnapshot(doc(db, collectionName, docId), (snap) => {
      if (!snap.exists()) {
        setData(null);
        setLoading(false);
        return;
      }
      setData({
        id: snap.id,
        ...convertDoc<T>(snap.data() as Record<string, unknown>),
      });
      setLoading(false);
      setError(null);
    }, (err) => {
      console.warn(`[Firestore] ${collectionName}/${docId} doc error:`, err);
      if (isPermissionError(err)) {
        setData(null);
        setError(null);
        setLoading(false);
        return;
      }
      setError(err.message);
      setLoading(false);
    });

    return () => {
      if (unsub) unsub();
    };
  }, [collectionName, docId, user, organizationId, isPreviewMode]);

  return { data, loading, error };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC HOOKS — One per collection + computed hooks
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Clients ─────────────────────────────────────────────────────────────────

export function useFireClients() {
  return useFirestoreCollection<FirestoreClient>(COLLECTIONS.CLIENTS, [orderBy('createdAt', 'desc')]);
}

export function useFireClient(clientId: string | null) {
  return useFirestoreDoc<FirestoreClient>(COLLECTIONS.CLIENTS, clientId);
}

export function useFireActiveClients() {
  return useFirestoreCollection<FirestoreClient>(COLLECTIONS.CLIENTS, [
    where('status', '==', 'active'),
    orderBy('tradeName', 'asc'),
  ]);
}

// ─── Documents ───────────────────────────────────────────────────────────────

export function useFireDocuments(clientId?: string | null) {
  const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc')];
  if (clientId) {
    constraints.unshift(where('clientId', '==', clientId));
  }
  return useFirestoreCollection<FirestoreDocument>(COLLECTIONS.DOCUMENTS, constraints, [clientId]);
}

// ─── Invoices ────────────────────────────────────────────────────────────────

export function useFireInvoices(clientId?: string | null) {
  const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc')];
  if (clientId) {
    constraints.unshift(where('clientId', '==', clientId));
  }
  return useFirestoreCollection<FirestoreInvoice>(COLLECTIONS.INVOICES, constraints, [clientId]);
}

// ─── Returns ─────────────────────────────────────────────────────────────────

export function useFireReturns(clientId?: string | null) {
  const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc')];
  if (clientId) {
    constraints.unshift(where('clientId', '==', clientId));
  }
  return useFirestoreCollection<FirestoreReturn>(COLLECTIONS.RETURNS, constraints, [clientId]);
}

export function useFireReadyReturns() {
  return useFirestoreCollection<FirestoreReturn>(COLLECTIONS.RETURNS, [
    where('status', 'in', ['validated', 'reviewed', 'generated']),
    orderBy('createdAt', 'desc'),
  ]);
}

export function useFireFiledReturns() {
  return useFirestoreCollection<FirestoreReturn>(COLLECTIONS.RETURNS, [
    where('status', '==', 'filed'),
    orderBy('filedDate', 'desc'),
  ]);
}

// ─── Reconciliations ────────────────────────────────────────────────────────

export function useFireReconciliations(clientId?: string | null) {
  const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc')];
  if (clientId) {
    constraints.unshift(where('clientId', '==', clientId));
  }
  return useFirestoreCollection<FirestoreReconciliation>(COLLECTIONS.RECONCILIATIONS, constraints, [clientId]);
}

// ─── Notifications ───────────────────────────────────────────────────────────

export function useFireNotifications() {
  return useFirestoreCollection<FirestoreNotification>(COLLECTIONS.NOTIFICATIONS, [
    orderBy('createdAt', 'desc'),
    limit(50),
  ]);
}

export function useFireUnreadNotifications() {
  const { user } = useAuth();
  return useFirestoreCollection<FirestoreNotification>(COLLECTIONS.NOTIFICATIONS, [
    where('read', '==', false),
    orderBy('createdAt', 'desc'),
    limit(20),
  ], [user?.id]);
}

// ─── Activities ──────────────────────────────────────────────────────────────

export function useFireActivities(clientId?: string | null) {
  const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc'), limit(100)];
  if (clientId) {
    constraints.unshift(where('clientId', '==', clientId));
  }
  return useFirestoreCollection<FirestoreActivity>(COLLECTIONS.ACTIVITIES, constraints, [clientId]);
}

export function useFireRecentActivities(limitCount: number = 10) {
  return useFirestoreCollection<FirestoreActivity>(COLLECTIONS.ACTIVITIES, [
    orderBy('createdAt', 'desc'),
    limit(limitCount),
  ]);
}

// ─── AI Recommendations ─────────────────────────────────────────────────────

export function useFireAIRecommendations() {
  return useFirestoreCollection<FirestoreAIRecommendation>(COLLECTIONS.AI_RECOMMENDATIONS, [
    where('status', '==', 'active'),
    orderBy('createdAt', 'desc'),
  ]);
}

// ─── Firm ────────────────────────────────────────────────────────────────────
// NOTE: The legacy `firms` collection is vestigial. The real tenant root is
// `organizations`. We keep this hook for backwards compat but it resolves the
// org doc instead. Most callers should use `useOrg().organization` directly.

export function useFireFirm() {
  const { organization } = useOrg();
  return useFirestoreDoc<FirestoreFirm>(COLLECTIONS.ORGANIZATIONS, organization?.id || null);
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPUTED HOOKS — Dashboard metrics from live data
// ═══════════════════════════════════════════════════════════════════════════════

export function useLiveDashboardMetrics(): {
  metrics: LiveDashboardMetrics;
  loading: boolean;
  error: string | null;
} {
  const clients = useFireClients();
  const invoices = useFireInvoices();
  const returns = useFireReturns();
  const documents = useFireDocuments();
  const activities = useFireRecentActivities(20);

  const loading = clients.loading || invoices.loading || returns.loading || documents.loading || activities.loading;
  const error = clients.error || invoices.error || returns.error || documents.error || activities.error;

  const metrics = useMemo(() => {
    if (loading) {
      return {
        totalClients: 0, activeClients: 0, totalInvoices: 0, totalTaxVolume: 0,
        filedReturns: 0, pendingReturns: 0, overdueReturns: 0, readyToFile: 0,
        criticalIssues: 0, warnings: 0, averageHealthScore: 0, matchPercentage: 100,
        riskPercentage: 0, documentsProcessed: 0, extractionsPending: 0,
        recentActivities: [], upcomingFilings: [],
      } as LiveDashboardMetrics;
    }

    return computeDashboardMetrics(
      clients.data as unknown as Array<FirestoreClient & { id: string }>,
      invoices.data as unknown as Array<FirestoreInvoice & { id: string }>,
      returns.data as unknown as Array<FirestoreReturn & { id: string }>,
      documents.data as unknown as Array<FirestoreDocument & { id: string }>,
      activities.data as unknown as Array<FirestoreActivity & { id: string }>,
    );
  }, [clients.data, invoices.data, returns.data, documents.data, activities.data, loading]);

  return { metrics, loading, error };
}

// ═══════════════════════════════════════════════════════════════════════════════
// AI EXECUTIVE LAYER HOOKS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Predictions ────────────────────────────────────────────────────────────

export function useFirePredictions(type?: string) {
  const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc')];
  if (type) {
    constraints.unshift(where('type', '==', type));
  }
  return useFirestoreCollection<FirestorePrediction>(COLLECTIONS.PREDICTIONS, constraints, [type]);
}

// ─── Priority Queue ─────────────────────────────────────────────────────────

export function useFirePriorities(status?: string) {
  const constraints: QueryConstraint[] = [orderBy('priorityScore', 'desc')];
  if (status) {
    constraints.unshift(where('status', '==', status));
  }
  return useFirestoreCollection<FirestorePriority>(COLLECTIONS.PRIORITY_QUEUE, constraints, [status]);
}

// ─── Organizations ──────────────────────────────────────────────────────────

export function useFireOrganizations() {
  return useFirestoreCollection<FirestoreOrganization>(COLLECTIONS.ORGANIZATIONS, [orderBy('createdAt', 'desc')]);
}

// ─── Memberships ────────────────────────────────────────────────────────────
// NOTE: The canonical membership collection is `organization_members`. The
// `memberships` collection is vestigial. Callers should use `useOrg().members`
// for the one-shot roster loaded by OrgContext, or `useOrgMembers()` below for
// a real-time subscription with per-collection loading/error state.

export function useFireMemberships(_firmId?: string | null) {
  // Ignore the legacy firmId arg; members come from OrgContext.
  void _firmId;
  const { members } = useOrg();
  return {
    data: members as unknown as Array<FirestoreMembership & { id: string }>,
    loading: false,
    error: null,
  };
}

/**
 * Shape of an `organization_members/{orgId}_{uid}` document AFTER `convertDoc`
 * has run — Firestore Timestamps have been converted to ISO strings (or null).
 *
 * Mirrors `OrganizationMemberDoc` from `@/lib/auth/types` but with the
 * post-conversion timestamp representation.
 */
export interface FirestoreOrganizationMember {
  organizationId: string;
  userId: string;
  userEmail: string;
  userDisplayName: string;
  userPhotoURL: string | null;
  role: string; // OrgRole union, kept loose for graceful degradation
  status: string; // MemberStatus union, kept loose for graceful degradation
  invitedBy: string | null;
  invitedAt: string | null;
  joinedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

/**
 * Real-time subscription to the current organization's member roster.
 *
 * Subscribes to `organization_members` scoped by `organizationId`. Returns
 * the raw membership rows — callers are responsible for any UI-role mapping
 * (e.g. translating the Firestore `OrgRole` enum to the role labels shown in
 * the Settings page).
 *
 * In preview mode (no real org), returns an empty array without subscribing —
 * same graceful-degradation contract as every other hook in this file.
 */
export function useOrgMembers() {
  return useFirestoreCollection<FirestoreOrganizationMember>(
    COLLECTIONS.ORGANIZATION_MEMBERS,
    [orderBy('joinedAt', 'asc')],
  );
}

// ─── Executive Scores (computed from live data) ─────────────────────────────

export function useFirmExecutiveScores(): { scores: FirmExecutiveScores; loading: boolean } {
  const clientsHook = useFireClients();
  const returnsHook = useFireReturns();
  const invoicesHook = useFireInvoices();
  const reconciliationsHook = useFireReconciliations();
  const activitiesHook = useFireRecentActivities(50);

  const clients = clientsHook.data;
  const returns = returnsHook.data;
  const invoices = invoicesHook.data;
  const reconciliations = reconciliationsHook.data;
  const activities = activitiesHook.data;

  // Real loading flag — true until ALL 5 underlying hooks resolve their first
  // snapshot (or set loading=false on the no-org / permission-denied path).
  // The previous `clients.length === 0 && returns.length === 0` heuristic was
  // wrong: legitimately-empty data looked "loaded" and triggered fake "50"
  // fallback scores. Now we wait for every hook to finish its initial load.
  const loading =
    clientsHook.loading ||
    returnsHook.loading ||
    invoicesHook.loading ||
    reconciliationsHook.loading ||
    activitiesHook.loading;

  const scores = useMemo<FirmExecutiveScores>(() => {
    if (loading) {
      return { firmHealth: 0, revenue: 0, compliance: 0, teamEfficiency: 0, clientSatisfaction: 0, cashFlow: 0 };
    }

    // Firm Health: weighted avg of client health scores (0 if no active clients).
    const activeClients = clients.filter(c => c.status === 'active');
    const avgHealth = activeClients.length > 0
      ? activeClients.reduce((s, c) => s + (c.healthScore || 0), 0) / activeClients.length
      : 0;

    // Revenue Score: based on tax volume (0 if no invoices).
    const totalTax = invoices.reduce((s, i) => s + (i.totalTax || 0) + (i.cgst || 0) + (i.sgst || 0) + (i.igst || 0), 0);
    const revenueScore = Math.min(100, Math.round((totalTax / 1000000) * 100));

    // Compliance Score: filed vs total returns (0 if no returns).
    const filedReturns = returns.filter(r => r.status === 'filed').length;
    const complianceScore = returns.length > 0 ? Math.round((filedReturns / returns.length) * 100) : 0;

    // Team Efficiency: based on completed activities (0 if none).
    const completedActivities = activities.filter(a => a.type.includes('filed') || a.type.includes('completed') || a.type.includes('resolved')).length;
    const teamEfficiency = activities.length > 0 ? Math.min(100, Math.round((completedActivities / Math.max(activities.length, 1)) * 100)) : 0;

    // Client Satisfaction: inverse of overdue + health (0 if no active clients).
    const overdueClients = activeClients.filter(c => (c.pendingReturnCount || 0) > 0).length;
    const clientSatisfaction = activeClients.length > 0 ? Math.round(((activeClients.length - overdueClients) / activeClients.length) * 100) : 0;

    // Cash Flow: based on reconciliation match rate (0 if no records).
    const matchedRecons = reconciliations.filter(r => r.matched > 0);
    const totalMatched = matchedRecons.reduce((s, r) => s + r.matched, 0);
    const totalRecords = matchedRecons.reduce((s, r) => s + r.totalRecords, 0);
    const cashFlow = totalRecords > 0 ? Math.round((totalMatched / totalRecords) * 100) : 0;

    return {
      firmHealth: Math.round(avgHealth),
      revenue: revenueScore,
      compliance: complianceScore,
      teamEfficiency,
      clientSatisfaction,
      cashFlow,
    };
  }, [clients, returns, invoices, reconciliations, activities, loading]);

  return { scores, loading };
}

// ─── CRM: Leads ──────────────────────────────────────────────────────────────

export function useFireLeads() {
  return useFirestoreCollection<FirestoreLead>(COLLECTIONS.LEADS, [orderBy('createdAt', 'desc')]);
}

// ─── CRM: Deals ──────────────────────────────────────────────────────────────

export function useFireDeals() {
  return useFirestoreCollection<FirestoreDeal>(COLLECTIONS.DEALS, [orderBy('createdAt', 'desc')]);
}

// ─── CRM: Meetings ───────────────────────────────────────────────────────────

export function useFireMeetings() {
  return useFirestoreCollection<FirestoreMeeting>(COLLECTIONS.MEETINGS, [orderBy('dateTime', 'asc')]);
}

// ─── Tasks ───────────────────────────────────────────────────────────────────

export function useFireTasks() {
  return useFirestoreCollection<FirestoreTask>(COLLECTIONS.TASKS, [orderBy('createdAt', 'desc')]);
}

// ═══════════════════════════════════════════════════════════════════════════════
// BANKING, GST, FINANCE & AI MEMORY (PT-3-5)
// Each hook wires a COLLECTIONS.xxx entry to useFirestoreCollection /
// useFirestoreDoc with the appropriate organizationId scope filter.
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Bank Accounts ──────────────────────────────────────────────────────────

export function useFireBankAccounts() {
  return useFirestoreCollection<FirestoreBankAccount>(COLLECTIONS.BANK_ACCOUNTS, [
    orderBy('createdAt', 'desc'),
  ]);
}

export function useFireBankAccount(bankAccountId: string | null) {
  return useFirestoreDoc<FirestoreBankAccount>(COLLECTIONS.BANK_ACCOUNTS, bankAccountId);
}

// ─── Bank Transactions ──────────────────────────────────────────────────────
// Pass a bankAccountId to scope to one account; omit for org-wide feed.

export function useFireBankTransactions(bankAccountId?: string | null) {
  const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc')];
  if (bankAccountId) {
    constraints.unshift(where('bankAccountId', '==', bankAccountId));
  }
  return useFirestoreCollection<FirestoreBankTransaction>(COLLECTIONS.BANK_TRANSACTIONS, constraints, [bankAccountId]);
}

// ─── GST Profiles ───────────────────────────────────────────────────────────

export function useFireGstProfiles() {
  return useFirestoreCollection<FirestoreGstProfile>(COLLECTIONS.GST_PROFILES, [
    orderBy('createdAt', 'desc'),
  ]);
}

export function useFireGstProfile(gstProfileId: string | null) {
  return useFirestoreDoc<FirestoreGstProfile>(COLLECTIONS.GST_PROFILES, gstProfileId);
}

// ─── GST Returns ────────────────────────────────────────────────────────────
// Pass a gstProfileId to scope to one profile; omit for org-wide feed.

export function useFireGstReturns(gstProfileId?: string | null) {
  const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc')];
  if (gstProfileId) {
    constraints.unshift(where('gstProfileId', '==', gstProfileId));
  }
  return useFirestoreCollection<FirestoreGstReturn>(COLLECTIONS.GST_RETURNS, constraints, [gstProfileId]);
}

// ─── Expenses ───────────────────────────────────────────────────────────────

export function useFireExpenses() {
  return useFirestoreCollection<FirestoreExpense>(COLLECTIONS.EXPENSES, [
    orderBy('createdAt', 'desc'),
  ]);
}

// ─── Payments ───────────────────────────────────────────────────────────────

export function useFirePayments() {
  return useFirestoreCollection<FirestorePayment>(COLLECTIONS.PAYMENTS, [
    orderBy('createdAt', 'desc'),
  ]);
}

// ─── AI Memory ──────────────────────────────────────────────────────────────
// Pass an agent string to scope to one agent's memory; omit for org-wide.

export function useFireAiMemories(agent?: string) {
  const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc')];
  if (agent) {
    constraints.unshift(where('agent', '==', agent));
  }
  return useFirestoreCollection<FirestoreAiMemory>(COLLECTIONS.AI_MEMORY, constraints, [agent]);
}

// ═══════════════════════════════════════════════════════════════════════════════
// NOTICES & REPORTS (Phase 1 — Real Backend Foundation)
// Real-time onSnapshot listeners scoped to the current organization.
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Notices ─────────────────────────────────────────────────────────────────
// Pass a clientId to scope to one client; omit for org-wide feed.

export function useFireNotices(clientId?: string | null) {
  const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc')];
  if (clientId) {
    constraints.unshift(where('clientId', '==', clientId));
  }
  return useFirestoreCollection<FirestoreNotice>(COLLECTIONS.NOTICES, constraints, [clientId]);
}

export function useFireNotice(noticeId: string | null) {
  return useFirestoreDoc<FirestoreNotice>(COLLECTIONS.NOTICES, noticeId);
}

// ─── Reports ─────────────────────────────────────────────────────────────────
// Pass a clientId to scope to one client; omit for org-wide feed.

export function useFireReports(clientId?: string | null) {
  const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc')];
  if (clientId) {
    constraints.unshift(where('clientId', '==', clientId));
  }
  return useFirestoreCollection<FirestoreReport>(COLLECTIONS.REPORTS, constraints, [clientId]);
}

export function useFireReport(reportId: string | null) {
  return useFirestoreDoc<FirestoreReport>(COLLECTIONS.REPORTS, reportId);
}

// ─── Manual Journal Entries ──────────────────────────────────────────────────

export function useFireJournalEntries() {
  return useFirestoreCollection<FirestoreJournalEntry>(
    COLLECTIONS.JOURNAL_ENTRIES,
    [orderBy('entryDate', 'desc')],
    [],
  );
}

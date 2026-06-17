// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Real-time Firestore Hooks
// React hooks with onSnapshot listeners for live data + optimistic UI
// ═══════════════════════════════════════════════════════════════════════════════

'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  collection, doc, onSnapshot, query, where, orderBy, limit,
  type Unsubscribe, type QueryConstraint,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import {
  COLLECTIONS,
  type FirestoreClient, type FirestoreDocument, type FirestoreInvoice,
  type FirestoreReturn, type FirestoreReconciliation, type FirestoreNotification,
  type FirestoreActivity, type FirestoreAIRecommendation, type FirestoreFirm,
  type FirestorePrediction, type FirestorePriority, type FirestoreOrganization, type FirestoreMembership,
  type LiveDashboardMetrics, type FirmExecutiveScores, type CollectionName,
} from '@/lib/firestore-schema';
import { computeDashboardMetrics } from '@/lib/firestore-service';

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

function useFirestoreCollection<T>(
  collectionName: CollectionName,
  constraints: QueryConstraint[] = [],
  deps: unknown[] = [],
): { data: Array<T & { id: string }>; loading: boolean; error: string | null } {
  const { user } = useAuth();
  const [data, setData] = useState<Array<T & { id: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      return;
    }

    let unsub: Unsubscribe | null = null;

    // Get firmId from user
    const firmId = user.firmId;
    const baseConstraints = firmId
      ? [where('firmId', '==', firmId), ...constraints]
      : constraints;

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
      setError(err.message);
      setLoading(false);
    });

    return () => {
      if (unsub) unsub();
    };
  }, [user, ...deps]);

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
  const [data, setData] = useState<(T & { id: string }) | null>(null);
  const [loading, setLoading] = useState(!!docId);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!docId) {
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
      setError(err.message);
      setLoading(false);
    });

    return () => {
      if (unsub) unsub();
    };
  }, [collectionName, docId]);

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

export function useFireFirm() {
  const { user } = useAuth();
  return useFirestoreDoc<FirestoreFirm>(COLLECTIONS.FIRMS, user?.firmId || null);
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

export function useFireMemberships(firmId?: string | null) {
  const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc')];
  if (firmId) {
    constraints.unshift(where('firmId', '==', firmId));
  }
  return useFirestoreCollection<FirestoreMembership>(COLLECTIONS.MEMBERSHIPS, constraints, [firmId]);
}

// ─── Executive Scores (computed from live data) ─────────────────────────────

export function useFirmExecutiveScores(): { scores: FirmExecutiveScores; loading: boolean } {
  const { data: clients } = useFireClients();
  const { data: returns } = useFireReturns();
  const { data: invoices } = useFireInvoices();
  const { data: reconciliations } = useFireReconciliations();
  const { data: activities } = useFireRecentActivities(50);

  const loading = clients.length === 0 && returns.length === 0;

  const scores = useMemo<FirmExecutiveScores>(() => {
    if (loading) {
      return { firmHealth: 0, revenue: 0, compliance: 0, teamEfficiency: 0, clientSatisfaction: 0, cashFlow: 0 };
    }

    // Firm Health: weighted avg of client health scores
    const activeClients = clients.filter(c => c.status === 'active');
    const avgHealth = activeClients.length > 0
      ? activeClients.reduce((s, c) => s + (c.healthScore || 0), 0) / activeClients.length
      : 50;

    // Revenue Score: based on tax volume
    const totalTax = invoices.reduce((s, i) => s + (i.totalTax || 0) + (i.cgst || 0) + (i.sgst || 0) + (i.igst || 0), 0);
    const revenueScore = Math.min(100, Math.round((totalTax / 1000000) * 100));

    // Compliance Score: filed vs total returns
    const filedReturns = returns.filter(r => r.status === 'filed').length;
    const complianceScore = returns.length > 0 ? Math.round((filedReturns / returns.length) * 100) : 50;

    // Team Efficiency: based on completed activities
    const completedActivities = activities.filter(a => a.type.includes('filed') || a.type.includes('completed') || a.type.includes('resolved')).length;
    const teamEfficiency = activities.length > 0 ? Math.min(100, Math.round((completedActivities / Math.max(activities.length, 1)) * 100)) : 50;

    // Client Satisfaction: inverse of overdue + health
    const overdueClients = activeClients.filter(c => (c.pendingReturnCount || 0) > 0).length;
    const clientSatisfaction = activeClients.length > 0 ? Math.round(((activeClients.length - overdueClients) / activeClients.length) * 100) : 50;

    // Cash Flow: based on reconciliation match rate
    const matchedRecons = reconciliations.filter(r => r.matched > 0);
    const totalMatched = matchedRecons.reduce((s, r) => s + r.matched, 0);
    const totalRecords = matchedRecons.reduce((s, r) => s + r.totalRecords, 0);
    const cashFlow = totalRecords > 0 ? Math.round((totalMatched / totalRecords) * 100) : 50;

    return {
      firmHealth: Math.round(avgHealth) || 50,
      revenue: revenueScore || 50,
      compliance: complianceScore || 50,
      teamEfficiency: teamEfficiency || 50,
      clientSatisfaction: clientSatisfaction || 50,
      cashFlow: cashFlow || 50,
    };
  }, [clients, returns, invoices, reconciliations, activities, loading]);

  return { scores, loading };
}

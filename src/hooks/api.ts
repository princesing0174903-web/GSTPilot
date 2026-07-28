'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — React Query (TanStack Query) API Hooks
// Comprehensive data-fetching layer that replaces Zustand store reads.
// All hooks fetch from Next.js API routes and manage cache via React Query.
// ═══════════════════════════════════════════════════════════════════════════════

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
  type UseMutationOptions,
} from '@tanstack/react-query';
import type {
  Client,
  Invoice,
  GSTRFiling,
  ReconciliationResult,
  ReconciliationRun,
  Issue,
  AuditLogEntry,
  DashboardMetrics,
  FilingCalendarItem,
} from '@/types/gst';

// ─── API Fetch Helper ─────────────────────────────────────────────────────────
//
// Uses the production-grade `fetchWithTimeout` wrapper (AbortController +
// 30s timeout + retry on transient errors). On 401, broadcasts a global
// 'session-expired' event so AuthContext can force re-login.

import { fetchWithTimeout, FetchHttpError } from '@/lib/async';

function broadcastSessionExpired() {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent('gstpilot:session-expired'));
  } catch {
    // ignore — older browsers
  }
}

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  try {
    const res = await fetchWithTimeout(url, {
      headers: { 'Content-Type': 'application/json', ...options?.headers },
      ...options,
      // Retry once on transient (5xx/network) errors. 4xx are NOT retried.
      retries: 1,
    });
    // 204 No Content — nothing to parse.
    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
  } catch (err) {
    // Detect 401 SESSION_EXPIRED / AUTH_REQUIRED and broadcast so the
    // AuthContext can refresh the token or force re-login.
    if (err instanceof FetchHttpError) {
      if (err.status === 401) {
        broadcastSessionExpired();
      }
      // Re-throw with the friendly server-provided message (already extracted
      // by fetchWithTimeout from the JSON error body).
      throw err;
    }
    // Network error / timeout — surface a friendly message.
    throw err;
  }
}

// ─── Query Key Factory ────────────────────────────────────────────────────────

export const queryKeys = {
  dashboard: ['dashboard'] as const,
  clients: {
    all: ['clients'] as const,
    detail: (id: string) => ['clients', id] as const,
  },
  invoices: {
    all: (clientId?: string) =>
      ['invoices', clientId ?? 'all'] as const,
  },
  filings: {
    all: (clientId?: string, status?: string) =>
      ['filings', clientId ?? 'all', status ?? 'all'] as const,
    detail: (id: string) => ['filings', id] as const,
    events: (id: string) => ['filings', id, 'events'] as const,
  },
  reconciliation: {
    results: (filters?: Record<string, string>) =>
      ['reconciliation', 'results', filters ?? {}] as const,
    runs: (clientId?: string) =>
      ['reconciliation', 'runs', clientId ?? 'all'] as const,
    stats: (clientId?: string) =>
      ['reconciliation', 'stats', clientId ?? 'all'] as const,
  },
  documents: {
    all: (clientId?: string) =>
      ['documents', clientId ?? 'all'] as const,
  },
  notifications: {
    all: ['notifications'] as const,
  },
  auditLogs: {
    all: (clientId?: string) =>
      ['audit-logs', clientId ?? 'all'] as const,
  },
  issues: {
    all: (clientId?: string) =>
      ['issues', clientId ?? 'all'] as const,
  },
  notices: {
    all: (filters?: Record<string, string>) =>
      ['notices', filters ?? {}] as const,
  },
  activities: {
    all: (clientId?: string) =>
      ['activities', clientId ?? 'all'] as const,
  },
};

// ─── Type Definitions for API Responses ───────────────────────────────────────

interface DashboardResponse {
  totalClients: number;
  totalInvoices: number;
  filedReturns: number;
  pendingReturns: number;
  overdueReturns: number;
  averageHealthScore: number;
  criticalIssues: number;
  warnings: number;
  matchPercentage: number;
  riskPercentage: number;
  recentAuditLogs: AuditLogEntry[];
  filingCalendar: FilingCalendarItem[];
  monthlyFilingStatus: Array<{
    period: string;
    filed: number;
    pending: number;
    overdue: number;
  }>;
}

interface ClientsResponse {
  clients: Array<Client & {
    _aggregations: {
      totalInvoices: number;
      filedReturns: number;
      pendingReturns: number;
      matchPercentage: number;
    };
  }>;
}

interface ClientResponse {
  client: Client;
}

interface InvoicesResponse {
  invoices: Invoice[];
}

interface InvoiceResponse {
  invoice: Invoice;
}

interface FilingsResponse {
  filings: GSTRFiling[];
}

interface FilingResponse {
  filing: GSTRFiling;
}

interface FilingEventsResponse {
  events: GSTRFiling['events'];
}

interface ReconResultsResponse {
  results: ReconciliationResult[];
}

interface ReconRunsResponse {
  runs: ReconciliationRun[];
}

interface ReconStatsResponse {
  stats: {
    totalResults: number;
    matchBreakdown: Record<string, number>;
    unresolved: number;
    riskBreakdown: { high: number; critical: number; highAndCritical: number };
    workflowBreakdown: Record<string, number>;
    matchPercentage: number;
    riskPercentage: number;
    totalGstDifference: number;
    avgMatchScore: number;
    avgConfidenceScore: number;
    recentRuns: ReconciliationRun[];
  };
}

interface DocumentsResponse {
  documents: Array<Record<string, unknown>>;
}

interface DocumentResponse {
  document: Record<string, unknown>;
}

interface IssuesResponse {
  issues: Issue[];
}

interface IssueResponse {
  issue: Issue;
}

interface AuditLogsResponse {
  logs: AuditLogEntry[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

interface NoticesResponse {
  notices: Array<Record<string, unknown>>;
}

interface NoticeResponse {
  notice: Record<string, unknown>;
}

interface SuccessResponse {
  success: boolean;
  message?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD HOOKS
// ═══════════════════════════════════════════════════════════════════════════════

export function useDashboardMetrics(
  options?: Omit<
    UseQueryOptions<DashboardResponse, Error>,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery<DashboardResponse, Error>({
    queryKey: queryKeys.dashboard,
    queryFn: () => apiFetch<DashboardResponse>('/api/dashboard'),
    ...options,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLIENT HOOKS
// ═══════════════════════════════════════════════════════════════════════════════

export function useClients(
  options?: Omit<
    UseQueryOptions<ClientsResponse, Error>,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery<ClientsResponse, Error>({
    queryKey: queryKeys.clients.all,
    queryFn: () => apiFetch<ClientsResponse>('/api/clients'),
    ...options,
  });
}

export function useClient(
  id: string | undefined,
  options?: Omit<
    UseQueryOptions<ClientsResponse, Error>,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery<ClientsResponse, Error>({
    queryKey: queryKeys.clients.detail(id ?? ''),
    queryFn: () =>
      apiFetch<ClientsResponse>('/api/clients').then((res) => {
        // Filter to single client if id provided
        if (id && res.clients) {
          const client = res.clients.find((c: any) => c.id === id);
          return { client: client ?? null, clients: res.clients };
        }
        return res;
      }),
    enabled: !!id,
    ...options,
  });
}

export function useCreateClient(
  options?: Omit<
    UseMutationOptions<ClientResponse, Error, Partial<Client>>,
    'mutationFn'
  >
) {
  const queryClient = useQueryClient();

  return useMutation<ClientResponse, Error, Partial<Client>>({
    mutationFn: (data) =>
      apiFetch<ClientResponse>('/api/clients', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.clients.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      options?.onSuccess?.(...args);
    },
    ...options,
  });
}

export function useUpdateClient(
  options?: Omit<
    UseMutationOptions<ClientResponse, Error, Partial<Client> & { id: string }>,
    'mutationFn'
  >
) {
  const queryClient = useQueryClient();

  return useMutation<ClientResponse, Error, Partial<Client> & { id: string }>({
    mutationFn: ({ id, ...data }) =>
      apiFetch<ClientResponse>('/api/clients', {
        method: 'PATCH',
        body: JSON.stringify({ id, ...data }),
      }),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.clients.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.clients.detail(variables.id),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      options?.onSuccess?.(data, variables, context);
    },
    ...options,
  });
}

export function useDeleteClient(
  options?: Omit<
    UseMutationOptions<SuccessResponse, Error, string>,
    'mutationFn'
  >
) {
  const queryClient = useQueryClient();

  return useMutation<SuccessResponse, Error, string>({
    mutationFn: (id) =>
      apiFetch<SuccessResponse>(
        `/api/clients?id=${encodeURIComponent(id)}`,
        { method: 'DELETE' }
      ),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.clients.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.clients.detail(variables),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      options?.onSuccess?.(data, variables, context);
    },
    ...options,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// INVOICE HOOKS
// ═══════════════════════════════════════════════════════════════════════════════

export function useInvoices(
  clientId?: string,
  options?: Omit<
    UseQueryOptions<InvoicesResponse, Error>,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery<InvoicesResponse, Error>({
    queryKey: queryKeys.invoices.all(clientId),
    queryFn: () => {
      const params = new URLSearchParams();
      if (clientId) params.set('clientId', clientId);
      const qs = params.toString();
      return apiFetch<InvoicesResponse>(`/api/invoices${qs ? `?${qs}` : ''}`);
    },
    ...options,
  });
}

export function useCreateInvoice(
  options?: Omit<
    UseMutationOptions<InvoiceResponse, Error, Record<string, unknown>>,
    'mutationFn'
  >
) {
  const queryClient = useQueryClient();

  return useMutation<InvoiceResponse, Error, Record<string, unknown>>({
    mutationFn: (data) =>
      apiFetch<InvoiceResponse>('/api/invoices', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.invoices.all(variables.clientId as string | undefined),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      options?.onSuccess?.(data, variables, context);
    },
    ...options,
  });
}

export function useUpdateInvoice(
  options?: Omit<
    UseMutationOptions<
      InvoiceResponse,
      Error,
      Record<string, unknown> & { id: string }
    >,
    'mutationFn'
  >
) {
  const queryClient = useQueryClient();

  return useMutation<
    InvoiceResponse,
    Error,
    Record<string, unknown> & { id: string }
  >({
    mutationFn: ({ id, ...data }) =>
      apiFetch<InvoiceResponse>('/api/invoices', {
        method: 'PATCH',
        body: JSON.stringify({ id, ...data }),
      }),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.invoices.all(variables.clientId as string | undefined),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      options?.onSuccess?.(data, variables, context);
    },
    ...options,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// GSTR FILING HOOKS
// ═══════════════════════════════════════════════════════════════════════════════

export function useFilings(
  clientId?: string,
  status?: string,
  options?: Omit<
    UseQueryOptions<FilingsResponse, Error>,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery<FilingsResponse, Error>({
    queryKey: queryKeys.filings.all(clientId, status),
    queryFn: () => apiFetch<FilingsResponse>('/api/gstr-filing'),
    ...options,
  });
}

export function useCreateFiling(
  options?: Omit<
    UseMutationOptions<
      FilingResponse,
      Error,
      { clientId: string; returnType: string; period: string; financialYear?: string }
    >,
    'mutationFn'
  >
) {
  const queryClient = useQueryClient();

  return useMutation<
    FilingResponse,
    Error,
    { clientId: string; returnType: string; period: string; financialYear?: string }
  >({
    mutationFn: (data) =>
      apiFetch<FilingResponse>('/api/gstr-filing', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.filings.all(variables.clientId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.filings.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      options?.onSuccess?.(data, variables, context);
    },
    ...options,
  });
}

export function useUpdateFilingStatus(
  options?: Omit<
    UseMutationOptions<
      FilingResponse,
      Error,
      { id: string; status: string; [key: string]: unknown }
    >,
    'mutationFn'
  >
) {
  const queryClient = useQueryClient();

  return useMutation<
    FilingResponse,
    Error,
    { id: string; status: string; [key: string]: unknown }
  >({
    mutationFn: ({ id, ...data }) =>
      apiFetch<FilingResponse>('/api/gstr-filing', {
        method: 'PATCH',
        body: JSON.stringify({ id, ...data }),
      }),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.filings.detail(variables.id),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.filings.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      options?.onSuccess?.(data, variables, context);
    },
    ...options,
  });
}

export function useFileReturn(
  options?: Omit<
    UseMutationOptions<
      FilingResponse,
      Error,
      { id: string; [key: string]: unknown }
    >,
    'mutationFn'
  >
) {
  const queryClient = useQueryClient();

  return useMutation<
    FilingResponse,
    Error,
    { id: string; [key: string]: unknown }
  >({
    mutationFn: ({ id, ...data }) =>
      apiFetch<FilingResponse>(`/api/gstr-filing/${id}`, {
        method: 'POST',
        body: JSON.stringify({ action: 'file', ...data }),
      }),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.filings.detail(variables.id),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.filings.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      options?.onSuccess?.(data, variables, context);
    },
    ...options,
  });
}

export function useFilingEvents(
  filingId: string | undefined,
  options?: Omit<
    UseQueryOptions<FilingEventsResponse, Error>,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery<FilingEventsResponse, Error>({
    queryKey: queryKeys.filings.events(filingId ?? ''),
    queryFn: () =>
      apiFetch<FilingEventsResponse>(
        `/api/gstr-filing/${encodeURIComponent(filingId!)}/events`
      ),
    enabled: !!filingId,
    ...options,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// RECONCILIATION HOOKS
// ═══════════════════════════════════════════════════════════════════════════════

export function useReconResults(
  filters?: {
    clientId?: string;
    matchStatus?: string;
    runId?: string;
    workflowStatus?: string;
    riskLevel?: string;
    resolved?: string;
    search?: string;
  },
  options?: Omit<
    UseQueryOptions<ReconResultsResponse, Error>,
    'queryKey' | 'queryFn'
  >
) {
  const filterRecord: Record<string, string> = {};
  if (filters?.clientId) filterRecord.clientId = filters.clientId;
  if (filters?.matchStatus) filterRecord.matchStatus = filters.matchStatus;
  if (filters?.runId) filterRecord.runId = filters.runId;
  if (filters?.workflowStatus) filterRecord.workflowStatus = filters.workflowStatus;
  if (filters?.riskLevel) filterRecord.riskLevel = filters.riskLevel;
  if (filters?.resolved) filterRecord.resolved = filters.resolved;
  if (filters?.search) filterRecord.search = filters.search;

  return useQuery<ReconResultsResponse, Error>({
    queryKey: queryKeys.reconciliation.results(filterRecord),
    queryFn: () => {
      const params = new URLSearchParams(filterRecord);
      const qs = params.toString();
      return apiFetch<ReconResultsResponse>(
        `/api/reconciliation${qs ? `?${qs}` : ''}`
      );
    },
    ...options,
  });
}

export function useReconRuns(
  clientId?: string,
  options?: Omit<
    UseQueryOptions<ReconRunsResponse, Error>,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery<ReconRunsResponse, Error>({
    queryKey: queryKeys.reconciliation.runs(clientId),
    queryFn: () => {
      const params = new URLSearchParams({ action: 'runs' });
      if (clientId) params.set('clientId', clientId);
      return apiFetch<ReconRunsResponse>(`/api/reconciliation?${params.toString()}`);
    },
    ...options,
  });
}

export function useReconStats(
  clientId?: string,
  options?: Omit<
    UseQueryOptions<ReconStatsResponse, Error>,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery<ReconStatsResponse, Error>({
    queryKey: queryKeys.reconciliation.stats(clientId),
    queryFn: () => {
      const params = new URLSearchParams({ action: 'stats' });
      if (clientId) params.set('clientId', clientId);
      return apiFetch<ReconStatsResponse>(`/api/reconciliation?${params.toString()}`);
    },
    ...options,
  });
}

export function useCreateReconRun(
  options?: Omit<
    UseMutationOptions<
      Record<string, unknown>,
      Error,
      { clientId: string; period: string; sources?: string }
    >,
    'mutationFn'
  >
) {
  const queryClient = useQueryClient();

  return useMutation<
    Record<string, unknown>,
    Error,
    { clientId: string; period: string; sources?: string }
  >({
    mutationFn: (data) =>
      apiFetch<Record<string, unknown>>('/api/reconciliation', {
        method: 'POST',
        body: JSON.stringify({ action: 'run', ...data }),
      }),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.reconciliation.runs(variables.clientId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.reconciliation.results() });
      queryClient.invalidateQueries({
        queryKey: queryKeys.reconciliation.stats(variables.clientId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      options?.onSuccess?.(data, variables, context);
    },
    ...options,
  });
}

export function useUpdateReconWorkflow(
  options?: Omit<
    UseMutationOptions<
      Record<string, unknown>,
      Error,
      { id: string; workflowStatus: string; [key: string]: unknown }
    >,
    'mutationFn'
  >
) {
  const queryClient = useQueryClient();

  return useMutation<
    Record<string, unknown>,
    Error,
    { id: string; workflowStatus: string; [key: string]: unknown }
  >({
    mutationFn: ({ id, ...data }) =>
      apiFetch<Record<string, unknown>>('/api/reconciliation', {
        method: 'POST',
        body: JSON.stringify({ action: 'update_workflow', id, ...data }),
      }),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.reconciliation.results(),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.reconciliation.stats(),
      });
      options?.onSuccess?.(data, variables, context);
    },
    ...options,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// DOCUMENT / UPLOADED FILES HOOKS
// ═══════════════════════════════════════════════════════════════════════════════

export function useUploadedFiles(
  clientId?: string,
  options?: Omit<
    UseQueryOptions<any, Error>,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery<any, Error>({
    queryKey: queryKeys.documents.all(clientId),
    queryFn: () => {
      const params = new URLSearchParams();
      if (clientId) params.set('clientId', clientId);
      const qs = params.toString();
      return apiFetch<any>(`/api/upload${qs ? `?${qs}` : ''}`);
    },
    ...options,
  });
}

export function useUploadFile(
  options?: Omit<
    UseMutationOptions<DocumentResponse, Error, FormData | Record<string, unknown>>,
    'mutationFn'
  >
) {
  const queryClient = useQueryClient();

  return useMutation<DocumentResponse, Error, FormData | Record<string, unknown>>({
    mutationFn: (data) => {
      if (data instanceof FormData) {
        // FormData upload — don't set Content-Type (browser sets multipart boundary)
        return fetch('/api/upload', {
          method: 'POST',
          body: data,
        }).then(async (res) => {
          if (!res.ok) {
            const error = await res.json().catch(() => ({ error: 'Upload failed' }));
            throw new Error(error.error || `HTTP ${res.status}`);
          }
          return res.json();
        });
      }
      // JSON upload
      return apiFetch<DocumentResponse>('/api/documents', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: (data, variables, context) => {
      const clientId = variables instanceof FormData ? variables.get('clientId') as string : (variables as any).clientId;
      queryClient.invalidateQueries({
        queryKey: queryKeys.documents.all(clientId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.documents.all() });
      options?.onSuccess?.(data, variables, context);
    },
    ...options,
  });
}

export function useUpdateDocument(
  options?: Omit<
    UseMutationOptions<
      DocumentResponse,
      Error,
      { id: string; tags?: string; description?: string }
    >,
    'mutationFn'
  >
) {
  const queryClient = useQueryClient();

  return useMutation<
    DocumentResponse,
    Error,
    { id: string; tags?: string; description?: string }
  >({
    mutationFn: (data) =>
      apiFetch<DocumentResponse>('/api/documents', {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.documents.all() });
      options?.onSuccess?.(data, variables, context);
    },
    ...options,
  });
}

export function useDeleteDocument(
  options?: Omit<
    UseMutationOptions<SuccessResponse, Error, string>,
    'mutationFn'
  >
) {
  const queryClient = useQueryClient();

  return useMutation<SuccessResponse, Error, string>({
    mutationFn: (id) =>
      apiFetch<SuccessResponse>('/api/documents', {
        method: 'DELETE',
        body: JSON.stringify({ id }),
      }),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.documents.all() });
      options?.onSuccess?.(data, variables, context);
    },
    ...options,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFICATION HOOKS
// ═══════════════════════════════════════════════════════════════════════════════
// Backend: /api/notifications supports GET (list), POST (create), PATCH (update), DELETE (remove)
// The PATCH handler accepts both `read` and `isRead` fields for compatibility.

interface NotificationClient {
  id: string;
  tradeName: string;
  gstin: string;
  status: string;
}

interface Notification {
  id: string;
  userId: string | null;
  clientId: string | null;
  type: string;
  category: string;
  title: string;
  message: string;
  actionUrl: string | null;
  isRead: boolean;
  priority: string;
  dismissed: boolean;
  scheduledAt: string | null;
  sentAt: string | null;
  readAt: string | null;
  createdAt: string;
  updatedAt: string;
  client: NotificationClient | null;
  [key: string]: unknown;
}

interface NotificationsResponse {
  notifications: Notification[];
  unreadCount: number;
}

export function useNotifications(
  options?: Omit<
    UseQueryOptions<NotificationsResponse, Error>,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery<NotificationsResponse, Error>({
    queryKey: queryKeys.notifications.all,
    queryFn: () =>
      apiFetch<NotificationsResponse>('/api/notifications'),
    ...options,
  });
}

export function useMarkNotificationRead(
  options?: Omit<
    UseMutationOptions<
      Record<string, unknown>,
      Error,
      { id: string; isRead: boolean }
    >,
    'mutationFn'
  >
) {
  const queryClient = useQueryClient();

  return useMutation<Record<string, unknown>, Error, { id: string; isRead: boolean }>({
    mutationFn: ({ id, isRead }) =>
      apiFetch<Record<string, unknown>>('/api/notifications', {
        method: 'PATCH',
        body: JSON.stringify({ id, isRead }),
      }),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.all,
      });
      options?.onSuccess?.(data, variables, context);
    },
    ...options,
  });
}

export function useDismissNotification(
  options?: Omit<
    UseMutationOptions<
      Record<string, unknown>,
      Error,
      { id: string }
    >,
    'mutationFn'
  >
) {
  const queryClient = useQueryClient();

  return useMutation<Record<string, unknown>, Error, { id: string }>({
    mutationFn: ({ id }) =>
      apiFetch<Record<string, unknown>>('/api/notifications', {
        method: 'PATCH',
        body: JSON.stringify({ id, dismissed: true }),
      }),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.all,
      });
      options?.onSuccess?.(data, variables, context);
    },
    ...options,
  });
}

export function useCreateNotification(
  options?: Omit<
    UseMutationOptions<
      Record<string, unknown>,
      Error,
      Omit<Notification, 'id' | 'createdAt' | 'updatedAt' | 'client'>
    >,
    'mutationFn'
  >
) {
  const queryClient = useQueryClient();

  return useMutation<
    Record<string, unknown>,
    Error,
    Omit<Notification, 'id' | 'createdAt' | 'updatedAt' | 'client'>
  >({
    mutationFn: (data) =>
      apiFetch<Record<string, unknown>>('/api/notifications', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.all,
      });
      options?.onSuccess?.(data, variables, context);
    },
    ...options,
  });
}

export function useDeleteNotification(
  options?: Omit<
    UseMutationOptions<
      Record<string, unknown>,
      Error,
      { id: string }
    >,
    'mutationFn'
  >
) {
  const queryClient = useQueryClient();

  return useMutation<Record<string, unknown>, Error, { id: string }>({
    mutationFn: ({ id }) =>
      apiFetch<Record<string, unknown>>(`/api/notifications?id=${id}`, {
        method: 'DELETE',
      }),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.all,
      });
      options?.onSuccess?.(data, variables, context);
    },
    ...options,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUDIT LOG HOOKS
// ═══════════════════════════════════════════════════════════════════════════════

export function useAuditLogs(
  clientId?: string,
  options?: Omit<
    UseQueryOptions<AuditLogsResponse, Error>,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery<AuditLogsResponse, Error>({
    queryKey: queryKeys.auditLogs.all(clientId),
    queryFn: () => {
      const params = new URLSearchParams();
      if (clientId) params.set('clientId', clientId);
      const qs = params.toString();
      return apiFetch<AuditLogsResponse>(`/api/audit-logs${qs ? `?${qs}` : ''}`);
    },
    ...options,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// ISSUES / ERRORS HOOKS
// ═══════════════════════════════════════════════════════════════════════════════

export function useIssues(
  clientId?: string,
  options?: Omit<
    UseQueryOptions<IssuesResponse, Error>,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery<IssuesResponse, Error>({
    queryKey: queryKeys.issues.all(clientId),
    queryFn: () => {
      const params = new URLSearchParams();
      if (clientId) params.set('clientId', clientId);
      const qs = params.toString();
      return apiFetch<IssuesResponse>(`/api/errors${qs ? `?${qs}` : ''}`);
    },
    ...options,
  });
}

export function useCreateIssue(
  options?: Omit<
    UseMutationOptions<
      IssueResponse,
      Error,
      Record<string, unknown>
    >,
    'mutationFn'
  >
) {
  const queryClient = useQueryClient();

  return useMutation<IssueResponse, Error, Record<string, unknown>>({
    mutationFn: (data) =>
      apiFetch<IssueResponse>('/api/errors', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.issues.all(variables.clientId as string | undefined),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      options?.onSuccess?.(data, variables, context);
    },
    ...options,
  });
}

export function useUpdateIssue(
  options?: Omit<
    UseMutationOptions<
      IssueResponse,
      Error,
      { id: string; status?: string; assignedTo?: string; notes?: string }
    >,
    'mutationFn'
  >
) {
  const queryClient = useQueryClient();

  return useMutation<
    IssueResponse,
    Error,
    { id: string; status?: string; assignedTo?: string; notes?: string }
  >({
    mutationFn: (data) =>
      apiFetch<IssueResponse>('/api/errors', {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      options?.onSuccess?.(data, variables, context);
    },
    ...options,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// ACTIVITY HOOKS (reads from audit-logs)
// ═══════════════════════════════════════════════════════════════════════════════

export function useActivities(
  clientId?: string,
  options?: Omit<
    UseQueryOptions<AuditLogsResponse, Error>,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery<AuditLogsResponse, Error>({
    queryKey: queryKeys.activities.all(clientId),
    queryFn: () => {
      const params = new URLSearchParams({ limit: '50' });
      if (clientId) params.set('clientId', clientId);
      return apiFetch<AuditLogsResponse>(`/api/audit-logs?${params.toString()}`);
    },
    ...options,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// NOTICE HOOKS
// ═══════════════════════════════════════════════════════════════════════════════

export function useNotices(
  filters?: {
    clientId?: string;
    status?: string;
    noticeType?: string;
    assignedTo?: string;
  },
  options?: Omit<
    UseQueryOptions<NoticesResponse, Error>,
    'queryKey' | 'queryFn'
  >
) {
  const filterRecord: Record<string, string> = {};
  if (filters?.clientId) filterRecord.clientId = filters.clientId;
  if (filters?.status) filterRecord.status = filters.status;
  if (filters?.noticeType) filterRecord.noticeType = filters.noticeType;
  if (filters?.assignedTo) filterRecord.assignedTo = filters.assignedTo;

  return useQuery<NoticesResponse, Error>({
    queryKey: queryKeys.notices.all(filterRecord),
    queryFn: () => {
      const params = new URLSearchParams(filterRecord);
      const qs = params.toString();
      return apiFetch<NoticesResponse>(`/api/notices${qs ? `?${qs}` : ''}`);
    },
    ...options,
  });
}

export function useCreateNotice(
  options?: Omit<
    UseMutationOptions<NoticeResponse, Error, Record<string, unknown>>,
    'mutationFn'
  >
) {
  const queryClient = useQueryClient();

  return useMutation<NoticeResponse, Error, Record<string, unknown>>({
    mutationFn: (data) =>
      apiFetch<NoticeResponse>('/api/notices', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notices.all() });
      options?.onSuccess?.(data, variables, context);
    },
    ...options,
  });
}

export function useUpdateNotice(
  options?: Omit<
    UseMutationOptions<
      NoticeResponse,
      Error,
      { id: string; status?: string; assignedTo?: string; resolution?: string; notes?: string }
    >,
    'mutationFn'
  >
) {
  const queryClient = useQueryClient();

  return useMutation<
    NoticeResponse,
    Error,
    { id: string; status?: string; assignedTo?: string; resolution?: string; notes?: string }
  >({
    mutationFn: (data) =>
      apiFetch<NoticeResponse>('/api/notices', {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notices.all() });
      options?.onSuccess?.(data, variables, context);
    },
    ...options,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY: Invalidate all queries (useful after bulk operations)
// ═══════════════════════════════════════════════════════════════════════════════

export function useInvalidateAll() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries();
}

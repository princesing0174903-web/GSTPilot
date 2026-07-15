// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Centralized Zustand Store with Persistence
// Starts empty — all data comes from the API via React Query hooks.
// Only used by legacy components pending migration (ClientDetailPage, GlobalSearch).
// ═══════════════════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { FilingStatus } from '@/types/gst';

// ─── Inline Types (store-local; the legacy src/data/sample-data.ts module has
//     been removed in strict production mode — this store starts empty and all
//     data flows in from the Prisma-backed API via TanStack Query hooks) ──────

export interface SampleClient {
  id: string;
  gstin: string;
  tradeName: string;
  legalName: string;
  state: string;
  stateCode: string;
  entityType: string;
  returnPeriod: string;
  lastFilingDate: string;
  status: 'active' | 'inactive' | 'suspended';
  healthScore: number;
  contactEmail?: string;
  contactPhone?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SampleFiling {
  id: string;
  clientId: string;
  returnType: 'GSTR-1' | 'GSTR-3B';
  period: string;
  status: FilingStatus;
  filedDate?: string;
  acknowledgmentNumber?: string;
  totalInvoices: number;
  readyForFiling: number;
  issuesFound: number;
  criticalErrors: number;
  warnings: number;
  totalTaxableValue: number;
  totalTax: number;
  createdAt: string;
  updatedAt: string;
}

export interface SampleInvoice {
  id: string;
  clientId: string;
  invoiceNumber: string;
  date: string;
  customer: string;
  customerGstin?: string;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  status: 'validated' | 'warning' | 'error';
  errorDetail?: string;
  hsnCode?: string;
  placeOfSupply?: string;
}

export interface SampleValidationIssue {
  id: string;
  clientId: string;
  severity: 'critical' | 'warning' | 'info';
  category: string;
  description: string;
  invoiceRef: string;
  fixAction: string;
  resolved: boolean;
}

export interface SampleReconDrilldown {
  invoiceNumber: string;
  date: string;
  vendor: string;
  booksAmount: number;
  portalAmount: number;
  difference: number;
  reason: string;
}

export interface SampleReconCategory {
  label: string;
  count: number;
  amount: number;
  color: string;
  bgColor: string;
}

export interface SampleAIInsight {
  id: string;
  clientId: string;
  type: 'risk_alert' | 'missing_doc' | 'tax_anomaly' | 'filing_rec';
  title: string;
  description: string;
  suggestedAction: string;
  urgency: 'high' | 'medium' | 'info';
  dismissed: boolean;
}

export interface SampleActivity {
  id: string;
  clientId: string;
  type: 'invoice_uploaded' | 'return_prepared' | 'return_filed' | 'mismatch_resolved' | 'validation_completed' | 'document_uploaded' | 'payment_received';
  description: string;
  timestamp: string;
  amount?: number;
}

export interface SampleBlockingIssue {
  id: string;
  clientId: string;
  clientName: string;
  category: 'gstin_error' | 'missing_invoice' | 'recon_mismatch' | 'validation_failure';
  title: string;
  detail: string;
  invoiceRef?: string;
  amount?: number;
}

export interface SampleUpload {
  id: string;
  filename: string;
  uploadTime: string;
  status: 'processing' | 'extracted' | 'failed';
  clientName: string;
  clientId: string;
  rowCount?: number;
  invoiceCount?: number;
  accuracy?: number;
}

// ─── Counter for generating sequential IDs ────────────────────────────────────
let idCounter = Date.now();
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

// ─── Store Types ──────────────────────────────────────────────────────────────

interface GSTStore {
  // Data
  clients: SampleClient[];
  filings: SampleFiling[];
  invoices: Record<string, SampleInvoice[]>;
  issues: Record<string, SampleValidationIssue[]>;
  aiInsights: Record<string, SampleAIInsight[]>;
  reconDrilldowns: Record<string, Record<string, SampleReconDrilldown[]>>;
  reconSummary: Record<string, SampleReconCategory[]>;
  blockingIssues: SampleBlockingIssue[];
  uploads: SampleUpload[];
  activities: SampleActivity[];

  // Filing state tracking
  filedReturnIds: string[];
  filingInProgressIds: string[];

  // Prep workspace state (per client)
  prepWorkflowStep: Record<string, number>;

  // ─── Client Actions ────────────────────────────────────────────────────
  getClient: (id: string) => SampleClient | undefined;
  addClient: (client: Omit<SampleClient, 'id' | 'createdAt' | 'updatedAt'>) => SampleClient;
  updateClient: (id: string, updates: Partial<SampleClient>) => void;
  deleteClient: (id: string) => void;
  updateClientHealth: (id: string, score: number) => void;

  // ─── Filing Actions ────────────────────────────────────────────────────
  getFilingsForClient: (clientId: string) => SampleFiling[];
  addFiling: (filing: Omit<SampleFiling, 'id' | 'createdAt' | 'updatedAt'>) => SampleFiling;
  fileReturn: (filingId: string) => void;
  markFilingReady: (filingId: string) => void;
  updateFilingStatus: (filingId: string, status: SampleFiling['status']) => void;

  // ─── Invoice Actions ───────────────────────────────────────────────────
  getInvoicesForClient: (clientId: string) => SampleInvoice[];
  addInvoice: (clientId: string, invoice: Omit<SampleInvoice, 'id' | 'clientId'>) => void;
  approveInvoice: (clientId: string, invoiceId: string) => void;
  fixInvoiceError: (clientId: string, invoiceId: string) => void;
  deleteInvoice: (clientId: string, invoiceId: string) => void;

  // ─── Validation Issue Actions ──────────────────────────────────────────
  getIssuesForClient: (clientId: string) => SampleValidationIssue[];
  resolveIssue: (clientId: string, issueId: string) => void;
  resolveAllIssuesForInvoice: (clientId: string, invoiceRef: string) => void;

  // ─── AI Insight Actions ────────────────────────────────────────────────
  getInsightsForClient: (clientId: string) => SampleAIInsight[];
  dismissInsight: (clientId: string, insightId: string) => void;

  // ─── Reconciliation Actions ────────────────────────────────────────────
  getReconDrilldowns: (clientId: string) => Record<string, SampleReconDrilldown[]>;
  getReconSummary: (clientId: string) => SampleReconCategory[];
  resolveMismatch: (clientId: string, invoiceNumber: string) => void;

  // ─── Activity Actions ──────────────────────────────────────────────────
  getActivitiesForClient: (clientId: string) => SampleActivity[];
  getRecentActivities: (limit?: number) => SampleActivity[];
  addActivity: (activity: Omit<SampleActivity, 'id'>) => void;

  // ─── Upload Actions ────────────────────────────────────────────────────
  addUpload: (upload: Omit<SampleUpload, 'id'>) => void;
  updateUploadStatus: (id: string, status: SampleUpload['status'], extra?: Partial<SampleUpload>) => void;

  // ─── Prep Workflow Actions ─────────────────────────────────────────────
  getPrepStep: (clientId: string) => number;
  advancePrepStep: (clientId: string) => void;
  setPrepStep: (clientId: string, step: number) => void;

  // ─── Dashboard Computed ────────────────────────────────────────────────
  getDashboardMetrics: () => { readyToFile: number; criticalIssues: number; pendingReturns: number; filedThisMonth: number; totalReturns: number; totalTaxVolume: number; avgComplianceScore: number };
  getReadyToFileFilings: () => SampleFiling[];
  getBlockingIssues: () => SampleBlockingIssue[];
  getRecentUploads: () => SampleUpload[];

  // ─── Reset ─────────────────────────────────────────────────────────────
  resetStore: () => void;
}

// ─── Empty Initial State ──────────────────────────────────────────────────────

const EMPTY_STATE = {
  clients: [] as SampleClient[],
  filings: [] as SampleFiling[],
  invoices: {} as Record<string, SampleInvoice[]>,
  issues: {} as Record<string, SampleValidationIssue[]>,
  aiInsights: {} as Record<string, SampleAIInsight[]>,
  reconDrilldowns: {} as Record<string, Record<string, SampleReconDrilldown[]>>,
  reconSummary: {} as Record<string, SampleReconCategory[]>,
  blockingIssues: [] as SampleBlockingIssue[],
  uploads: [] as SampleUpload[],
  activities: [] as SampleActivity[],
  filedReturnIds: [] as string[],
  filingInProgressIds: [] as string[],
  prepWorkflowStep: {} as Record<string, number>,
};

// ─── Store Implementation ─────────────────────────────────────────────────────

export const useGSTStore = create<GSTStore>()(
  persist(
    (set, get) => ({
      ...EMPTY_STATE,

      // ── Client Actions ──
      getClient: (id) => get().clients.find(c => c.id === id),

      addClient: (clientData) => {
        const now = new Date().toISOString();
        const newClient: SampleClient = {
          ...clientData,
          id: nextId('client'),
          createdAt: now,
          updatedAt: now,
        };
        set(state => ({
          clients: [...state.clients, newClient],
        }));
        // Add initial activity
        get().addActivity({
          clientId: newClient.id,
          type: 'document_uploaded',
          description: `New client ${newClient.tradeName} added to the firm`,
          timestamp: now,
        });
        return newClient;
      },

      updateClient: (id, updates) => set(state => ({
        clients: state.clients.map(c =>
          c.id === id ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c
        ),
      })),

      deleteClient: (id) => set(state => ({
        clients: state.clients.filter(c => c.id !== id),
        filings: state.filings.filter(f => f.clientId !== id),
        invoices: Object.fromEntries(Object.entries(state.invoices).filter(([k]) => k !== id)),
        issues: Object.fromEntries(Object.entries(state.issues).filter(([k]) => k !== id)),
        aiInsights: Object.fromEntries(Object.entries(state.aiInsights).filter(([k]) => k !== id)),
        reconDrilldowns: Object.fromEntries(Object.entries(state.reconDrilldowns).filter(([k]) => k !== id)),
        reconSummary: Object.fromEntries(Object.entries(state.reconSummary).filter(([k]) => k !== id)),
        activities: state.activities.filter(a => a.clientId !== id),
      })),

      updateClientHealth: (id, score) => set(state => ({
        clients: state.clients.map(c => c.id === id ? { ...c, healthScore: score, updatedAt: new Date().toISOString() } : c),
      })),

      // ── Filing Actions ──
      getFilingsForClient: (clientId) => get().filings.filter(f => f.clientId === clientId),

      addFiling: (filingData) => {
        const now = new Date().toISOString();
        const newFiling: SampleFiling = {
          ...filingData,
          id: nextId('filing'),
          createdAt: now,
          updatedAt: now,
        };
        set(state => ({
          filings: [...state.filings, newFiling],
        }));
        return newFiling;
      },

      fileReturn: (filingId) => {
        const state = get();
        if (state.filedReturnIds.includes(filingId) || state.filingInProgressIds.includes(filingId)) return;

        set(state => ({
          filingInProgressIds: [...state.filingInProgressIds, filingId],
        }));

        // Simulate filing process
        setTimeout(() => {
          const currentState = get();
          const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
          const arn = `AA${dateStr.slice(6, 8)}${dateStr.slice(4, 6)}25${String(idCounter++ % 999999).padStart(6, '0')}`;

          const filing = currentState.filings.find(f => f.id === filingId);
          const client = filing ? currentState.getClient(filing.clientId) : undefined;

          set(state => ({
            filedReturnIds: [...state.filedReturnIds.filter(id => id !== filingId), filingId],
            filingInProgressIds: state.filingInProgressIds.filter(id => id !== filingId),
            filings: state.filings.map(f =>
              f.id === filingId
                ? { ...f, status: 'filed' as const, filedDate: new Date().toISOString().split('T')[0], acknowledgmentNumber: arn, updatedAt: new Date().toISOString() }
                : f
            ),
          }));

          // Add activity
          if (filing && client) {
            get().addActivity({
              clientId: filing.clientId,
              type: 'return_filed',
              description: `${filing.returnType} for ${filing.period} filed — ARN ${arn}`,
              timestamp: new Date().toISOString(),
              amount: filing.totalTaxableValue,
            });
          }
        }, 1500);
      },

      markFilingReady: (filingId) => set(state => ({
        filings: state.filings.map(f =>
          f.id === filingId
            ? { ...f, status: 'validated' as const, updatedAt: new Date().toISOString() }
            : f
        ),
      })),

      updateFilingStatus: (filingId, status) => set(state => ({
        filings: state.filings.map(f =>
          f.id === filingId
            ? { ...f, status, updatedAt: new Date().toISOString() }
            : f
        ),
      })),

      // ── Invoice Actions ──
      getInvoicesForClient: (clientId) => get().invoices[clientId] ?? [],

      addInvoice: (clientId, invoiceData) => {
        const newInvoice: SampleInvoice = {
          ...invoiceData,
          id: nextId('inv'),
          clientId,
        };
        set(state => ({
          invoices: {
            ...state.invoices,
            [clientId]: [...(state.invoices[clientId] ?? []), newInvoice],
          },
        }));
        get().addActivity({
          clientId,
          type: 'invoice_uploaded',
          description: `Invoice ${newInvoice.invoiceNumber} added for ${newInvoice.customer}`,
          timestamp: new Date().toISOString(),
          amount: newInvoice.taxableValue,
        });
      },

      approveInvoice: (clientId, invoiceId) => set(state => {
        const clientInvoices = state.invoices[clientId] ?? [];
        const invoice = clientInvoices.find(i => i.id === invoiceId);
        if (!invoice || invoice.status === 'validated') return state;

        const updatedInvoices = {
          ...state.invoices,
          [clientId]: clientInvoices.map(i =>
            i.id === invoiceId ? { ...i, status: 'validated' as const, errorDetail: undefined } : i
          ),
        };

        const clientIssues = state.issues[clientId] ?? [];
        const updatedIssues = {
          ...state.issues,
          [clientId]: clientIssues.map(iss =>
            iss.invoiceRef === invoice.invoiceNumber ? { ...iss, resolved: true } : iss
          ),
        };

        return { invoices: updatedInvoices, issues: updatedIssues };
      }),

      fixInvoiceError: (clientId, invoiceId) => set(state => {
        const clientInvoices = state.invoices[clientId] ?? [];
        const invoice = clientInvoices.find(i => i.id === invoiceId);
        if (!invoice) return state;

        // Fix the tax calculation
        const isInterState = invoice.placeOfSupply && invoice.placeOfSupply !== invoice.customerGstin?.substring(0, 2) && invoice.placeOfSupply !== getClientStateCode(clientId);
        const fixedInvoice = {
          ...invoice,
          status: 'validated' as const,
          errorDetail: undefined,
          cgst: isInterState ? 0 : Math.round(invoice.taxableValue * 0.09),
          sgst: isInterState ? 0 : Math.round(invoice.taxableValue * 0.09),
          igst: isInterState ? Math.round(invoice.taxableValue * 0.18) : 0,
        };

        return {
          invoices: {
            ...state.invoices,
            [clientId]: clientInvoices.map(i => i.id === invoiceId ? fixedInvoice : i),
          },
        };
      }),

      deleteInvoice: (clientId, invoiceId) => set(state => ({
        invoices: {
          ...state.invoices,
          [clientId]: (state.invoices[clientId] ?? []).filter(i => i.id !== invoiceId),
        },
      })),

      // ── Validation Issue Actions ──
      getIssuesForClient: (clientId) => get().issues[clientId] ?? [],

      resolveIssue: (clientId, issueId) => set(state => {
        const clientIssues = state.issues[clientId] ?? [];
        const issue = clientIssues.find(i => i.id === issueId);
        if (!issue || issue.resolved) return state;

        const clientInvoices = state.invoices[clientId] ?? [];
        const relatedInvoice = clientInvoices.find(i => i.invoiceNumber === issue.invoiceRef);

        const updatedIssues = {
          ...state.issues,
          [clientId]: clientIssues.map(i =>
            i.id === issueId ? { ...i, resolved: true } : i
          ),
        };

        const updatedInvoices = relatedInvoice ? {
          ...state.invoices,
          [clientId]: clientInvoices.map(i =>
            i.invoiceNumber === issue.invoiceRef ? { ...i, status: 'validated' as const, errorDetail: undefined } : i
          ),
        } : state.invoices;

        get().addActivity({
          clientId,
          type: 'mismatch_resolved',
          description: `${issue.category} issue resolved for ${issue.invoiceRef}`,
          timestamp: new Date().toISOString(),
        });

        return { issues: updatedIssues, invoices: updatedInvoices };
      }),

      resolveAllIssuesForInvoice: (clientId, invoiceRef) => set(state => {
        const clientIssues = state.issues[clientId] ?? [];
        const clientInvoices = state.invoices[clientId] ?? [];

        return {
          issues: {
            ...state.issues,
            [clientId]: clientIssues.map(i =>
              i.invoiceRef === invoiceRef ? { ...i, resolved: true } : i
            ),
          },
          invoices: {
            ...state.invoices,
            [clientId]: clientInvoices.map(i =>
              i.invoiceNumber === invoiceRef ? { ...i, status: 'validated' as const, errorDetail: undefined } : i
            ),
          },
        };
      }),

      // ── AI Insight Actions ──
      getInsightsForClient: (clientId) => get().aiInsights[clientId] ?? [],

      dismissInsight: (clientId, insightId) => set(state => {
        const clientInsights = state.aiInsights[clientId] ?? [];
        return {
          aiInsights: {
            ...state.aiInsights,
            [clientId]: clientInsights.map(i =>
              i.id === insightId ? { ...i, dismissed: true } : i
            ),
          },
        };
      }),

      // ── Reconciliation Actions ──
      getReconDrilldowns: (clientId) => get().reconDrilldowns[clientId] ?? {},
      getReconSummary: (clientId) => get().reconSummary[clientId] ?? [],

      resolveMismatch: (clientId, invoiceNumber) => {
        // Move from mismatch/partial to resolved
        set(state => {
          const drilldowns = state.reconDrilldowns[clientId] ?? {};
          const newDrilldowns = { ...drilldowns };

          // Remove from mismatch/partial categories
          for (const category of Object.keys(newDrilldowns)) {
            if (category !== 'Perfect Match') {
              newDrilldowns[category] = newDrilldowns[category].filter(
                d => d.invoiceNumber !== invoiceNumber
              );
            }
          }

          return {
            reconDrilldowns: {
              ...state.reconDrilldowns,
              [clientId]: newDrilldowns,
            },
          };
        });

        get().addActivity({
          clientId,
          type: 'mismatch_resolved',
          description: `Reconciliation mismatch for ${invoiceNumber} resolved`,
          timestamp: new Date().toISOString(),
        });
      },

      // ── Activity Actions ──
      getActivitiesForClient: (clientId) =>
        get().activities
          .filter(a => a.clientId === clientId)
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),

      getRecentActivities: (limit = 20) =>
        get().activities
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .slice(0, limit),

      addActivity: (activityData) => set(state => ({
        activities: [...state.activities, { ...activityData, id: nextId('act') }],
      })),

      // ── Upload Actions ──
      addUpload: (uploadData) => set(state => ({
        uploads: [...state.uploads, { ...uploadData, id: nextId('upload') }],
      })),

      updateUploadStatus: (id, status, extra) => set(state => ({
        uploads: state.uploads.map(u =>
          u.id === id ? { ...u, status, ...extra } : u
        ),
      })),

      // ── Prep Workflow Actions ──
      getPrepStep: (clientId) => get().prepWorkflowStep[clientId] ?? 1,

      advancePrepStep: (clientId) => set(state => {
        const current = state.prepWorkflowStep[clientId] ?? 1;
        if (current >= 6) return state;
        return {
          prepWorkflowStep: { ...state.prepWorkflowStep, [clientId]: current + 1 },
        };
      }),

      setPrepStep: (clientId, step) => set(state => ({
        prepWorkflowStep: { ...state.prepWorkflowStep, [clientId]: Math.max(0, Math.min(6, step)) },
      })),

      // ── Dashboard Computed ──
      getDashboardMetrics: () => {
        const state = get();
        const readyStatuses = ['validated', 'generated', 'reviewed'];
        const filedCount = state.filings.filter(f => f.status === 'filed').length;
        const readyCount = state.filings.filter(f => readyStatuses.includes(f.status)).length;
        const criticalCount = state.filings.filter(f => f.criticalErrors > 0).length;
        const pendingCount = state.filings.filter(f => f.status !== 'filed').length;
        const totalTaxVolume = state.filings.reduce((sum, f) => sum + f.totalTaxableValue, 0);
        const avgCompliance = state.clients.length > 0
          ? Math.round(state.clients.reduce((sum, c) => sum + c.healthScore, 0) / state.clients.length)
          : 0;

        return {
          readyToFile: readyCount,
          criticalIssues: criticalCount,
          pendingReturns: pendingCount,
          filedThisMonth: filedCount,
          totalReturns: state.filings.length,
          totalTaxVolume,
          avgComplianceScore: avgCompliance,
        };
      },

      getReadyToFileFilings: () => {
        const state = get();
        const readyStatuses = ['validated', 'generated', 'reviewed'];
        return state.filings.filter(f => readyStatuses.includes(f.status) && !state.filedReturnIds.includes(f.id));
      },

      getBlockingIssues: () => get().blockingIssues,

      getRecentUploads: () =>
        get().uploads.sort((a, b) =>
          new Date(b.uploadTime).getTime() - new Date(a.uploadTime).getTime()
        ),

      // ── Reset ──
      resetStore: () => set(EMPTY_STATE),
    }),
    {
      name: 'gstpilot-store-v3',
      partialize: (state) => ({
        clients: state.clients,
        filings: state.filings,
        invoices: state.invoices,
        issues: state.issues,
        aiInsights: state.aiInsights,
        reconDrilldowns: state.reconDrilldowns,
        reconSummary: state.reconSummary,
        blockingIssues: state.blockingIssues,
        uploads: state.uploads,
        activities: state.activities,
        filedReturnIds: state.filedReturnIds,
        filingInProgressIds: state.filingInProgressIds,
        prepWorkflowStep: state.prepWorkflowStep,
      }),
    }
  )
);

// ─── Helper ───────────────────────────────────────────────────────────────────
function getClientStateCode(clientId: string): string {
  // Look up from current store state
  const client = useGSTStore.getState().clients.find(c => c.id === clientId);
  return client?.stateCode ?? '27';
}

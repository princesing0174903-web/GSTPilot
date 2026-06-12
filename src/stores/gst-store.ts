// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Centralized Zustand Store
// Single source of truth for all business data. All components read/write here.
// State mutations trigger reactive UI updates across the entire app.
// ═══════════════════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import {
  SAMPLE_CLIENTS,
  SAMPLE_FILINGS,
  SAMPLE_INVOICES,
  SAMPLE_ISSUES,
  SAMPLE_AI_INSIGHTS,
  SAMPLE_RECON_DRILLDOWNS,
  SAMPLE_RECON_SUMMARY,
  SAMPLE_DASHBOARD_METRICS,
  SAMPLE_BLOCKING_ISSUES,
  SAMPLE_UPLOADS,
  type SampleClient,
  type SampleFiling,
  type SampleInvoice,
  type SampleValidationIssue,
  type SampleAIInsight,
  type SampleReconDrilldown,
  type SampleReconCategory,
  type SampleDashboardMetrics,
  type SampleBlockingIssue,
  type SampleUpload,
} from '@/data/sample-data';

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
  dashboardMetrics: SampleDashboardMetrics;
  blockingIssues: SampleBlockingIssue[];
  uploads: SampleUpload[];

  // Filing state tracking
  filedReturnIds: Set<string>;
  filingInProgressIds: Set<string>;

  // Prep workspace state (per client)
  prepWorkflowStep: Record<string, number>; // clientId -> current step (0-6)

  // ─── Actions ──────────────────────────────────────────────────────────────

  // Client
  getClient: (id: string) => SampleClient | undefined;
  updateClientHealth: (id: string, score: number) => void;

  // Filings
  getFilingsForClient: (clientId: string) => SampleFiling[];
  fileReturn: (filingId: string) => void;
  markFilingReady: (filingId: string) => void;
  updateFilingStatus: (filingId: string, status: SampleFiling['status']) => void;

  // Invoices
  getInvoicesForClient: (clientId: string) => SampleInvoice[];
  approveInvoice: (clientId: string, invoiceId: string) => void;
  fixInvoiceError: (clientId: string, invoiceId: string) => void;

  // Validation Issues
  getIssuesForClient: (clientId: string) => SampleValidationIssue[];
  resolveIssue: (clientId: string, issueId: string) => void;
  resolveAllIssuesForInvoice: (clientId: string, invoiceRef: string) => void;

  // AI Insights
  getInsightsForClient: (clientId: string) => SampleAIInsight[];
  dismissInsight: (clientId: string, insightId: string) => void;

  // Reconciliation
  getReconDrilldowns: (clientId: string) => Record<string, SampleReconDrilldown[]>;
  getReconSummary: (clientId: string) => SampleReconCategory[];

  // Prep workflow
  getPrepStep: (clientId: string) => number;
  advancePrepStep: (clientId: string) => void;
  setPrepStep: (clientId: string, step: number) => void;

  // Dashboard
  getDashboardMetrics: () => { readyToFile: number; criticalIssues: number; pendingReturns: number; filedThisMonth: number; totalReturns: number };
  getReadyToFileFilings: () => SampleFiling[];
  getBlockingIssues: () => SampleBlockingIssue[];
  getRecentUploads: () => SampleUpload[];

  // Bulk operations
  resetStore: () => void;
}

// ─── Store Implementation ─────────────────────────────────────────────────────

export const useGSTStore = create<GSTStore>((set, get) => ({
  // ── Initial Data ──
  clients: [...SAMPLE_CLIENTS],
  filings: [...SAMPLE_FILINGS],
  invoices: { ...SAMPLE_INVOICES },
  issues: { ...SAMPLE_ISSUES },
  aiInsights: { ...SAMPLE_AI_INSIGHTS },
  reconDrilldowns: { ...SAMPLE_RECON_DRILLDOWNS },
  reconSummary: { ...SAMPLE_RECON_SUMMARY },
  dashboardMetrics: { ...SAMPLE_DASHBOARD_METRICS },
  blockingIssues: [...SAMPLE_BLOCKING_ISSUES],
  uploads: [...SAMPLE_UPLOADS],
  filedReturnIds: new Set<string>(),
  filingInProgressIds: new Set<string>(),
  prepWorkflowStep: {},

  // ── Client Actions ──
  getClient: (id) => get().clients.find(c => c.id === id),

  updateClientHealth: (id, score) => set(state => ({
    clients: state.clients.map(c => c.id === id ? { ...c, healthScore: score, updatedAt: new Date().toISOString() } : c),
  })),

  // ── Filing Actions ──
  getFilingsForClient: (clientId) => get().filings.filter(f => f.clientId === clientId),

  fileReturn: (filingId) => {
    const state = get();
    if (state.filedReturnIds.has(filingId) || state.filingInProgressIds.has(filingId)) return;

    set(state => ({
      filingInProgressIds: new Set(state.filingInProgressIds).add(filingId),
    }));

    // Simulate filing process
    setTimeout(() => {
      set(state => {
        const newFiled = new Set(state.filedReturnIds).add(filingId);
        const newInProgress = new Set(state.filingInProgressIds);
        newInProgress.delete(filingId);

        const arn = `AA${String(new Date().getDate()).padStart(2, '0')}${String(new Date().getMonth() + 1).padStart(2, '0')}25${String(Math.floor(Math.random() * 999999)).padStart(6, '0')}`;

        return {
          filedReturnIds: newFiled,
          filingInProgressIds: newInProgress,
          filings: state.filings.map(f =>
            f.id === filingId
              ? { ...f, status: 'filed' as const, filedDate: new Date().toISOString().split('T')[0], acknowledgmentNumber: arn, updatedAt: new Date().toISOString() }
              : f
          ),
        };
      });
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
  getInvoicesForClient: (clientId) => {
    const existing = get().invoices[clientId];
    if (existing && existing.length > 0) return existing;
    // Auto-generate invoices for clients without pre-defined data
    const client = get().getClient(clientId);
    if (!client) return [];
    const count = Math.max(5, Math.floor(client.healthScore * 0.5));
    const vendors = ['Reliance Industries Ltd', 'Tata Consultancy Services', 'Mahindra & Mahindra Ltd', 'Infosys Technologies', 'Wipro Enterprises', 'HDFC Bank Ltd', 'Bajaj Finserv Ltd', 'Larsen & Toubro Ltd', 'Godrej Consumer Products', 'Maruti Suzuki India', 'Adani Ports & SEZ', 'Bharti Airtel Ltd', 'ICICI Lombard General', 'Hindustan Unilever Ltd', 'Asian Paints Ltd'];
    const hsnCodes = ['8471', '9983', '8703', '3304', '8479', '9997', '9999', '3401', '3209', '9984'];
    const states = ['27', '24', '29', '06', '33'];
    const generated: SampleInvoice[] = [];
    // Use a seeded pseudo-random for consistency
    let seed = clientId.charCodeAt(clientId.length - 1);
    const seededRandom = () => { seed = (seed * 16807 + 0) % 2147483647; return (seed - 1) / 2147483646; };
    for (let i = 0; i < count; i++) {
      const day = String(Math.min(28, (i * 2 + 1))).padStart(2, '0');
      const taxableValue = Math.round((50000 + seededRandom() * 450000) / 1000) * 1000;
      const isInterState = seededRandom() > 0.6;
      const pos = isInterState ? states[Math.floor(seededRandom() * states.length)] : client.stateCode;
      const hasIssue = i >= count - 2;
      const cgst = isInterState ? 0 : Math.round(taxableValue * 0.09);
      const sgst = isInterState ? 0 : Math.round(taxableValue * 0.09);
      const igst = isInterState ? Math.round(taxableValue * 0.18) : 0;
      generated.push({
        id: `gen-${clientId}-${i + 1}`,
        clientId,
        invoiceNumber: `INV-2025-${String(9001 + i).padStart(4, '0')}`,
        date: `2025-06-${day}`,
        customer: vendors[i % vendors.length],
        customerGstin: `${pos}AAAAA${String(1000 + i).padStart(4, '0')}1Z5`,
        taxableValue,
        cgst,
        sgst,
        igst,
        status: hasIssue ? (i === count - 1 ? 'error' : 'warning') : 'validated',
        errorDetail: hasIssue ? (i === count - 1 ? 'Tax calculation error detected' : 'Missing HSN code for line items') : undefined,
        hsnCode: hasIssue && i === count - 2 ? '' : hsnCodes[i % hsnCodes.length],
        placeOfSupply: pos,
      });
    }
    // Persist to store so mutations can work
    set(state => ({ invoices: { ...state.invoices, [clientId]: generated } }));
    return generated;
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

    // Also resolve corresponding issues
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

    const updatedInvoices = {
      ...state.invoices,
      [clientId]: clientInvoices.map(i =>
        i.id === invoiceId ? { ...i, status: 'validated' as const, errorDetail: undefined } : i
      ),
    };

    return { invoices: updatedInvoices };
  }),

  // ── Validation Issue Actions ──
  getIssuesForClient: (clientId) => {
    const existing = get().issues[clientId];
    if (existing && existing.length > 0) return existing;
    const client = get().getClient(clientId);
    if (!client) return [];
    const isHighRisk = client.healthScore < 60;
    const generated = [
      { id: `gen-v1-${clientId}`, clientId, severity: 'critical' as const, category: 'Invalid GSTIN', description: `Buyer GSTIN in INV-2025-9001 fails checksum validation`, invoiceRef: 'INV-2025-9001', fixAction: 'Correct GSTIN', resolved: false },
      { id: `gen-v2-${clientId}`, clientId, severity: 'warning' as const, category: 'Missing HSN Code', description: `Line items in INV-2025-9002 missing HSN/SAC codes required for GSTR-1 filing`, invoiceRef: 'INV-2025-9002', fixAction: 'Add HSN Codes', resolved: false },
      ...(isHighRisk ? [{ id: `gen-v3-${clientId}`, clientId, severity: 'critical' as const, category: 'Tax Calculation Error', description: `CGST amount in INV-2025-9003 does not match expected 9% of taxable value`, invoiceRef: 'INV-2025-9003', fixAction: 'Recalculate Tax', resolved: false }] : []),
    ];
    set(state => ({ issues: { ...state.issues, [clientId]: generated } }));
    return generated;
  },

  resolveIssue: (clientId, issueId) => set(state => {
    const clientIssues = state.issues[clientId] ?? [];
    const issue = clientIssues.find(i => i.id === issueId);
    if (!issue || issue.resolved) return state;

    // Also fix the related invoice
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
  getInsightsForClient: (clientId) => {
    const existing = get().aiInsights[clientId];
    if (existing && existing.length > 0) return existing;
    const client = get().getClient(clientId);
    if (!client) return [];
    const isHighRisk = client.healthScore < 60;
    const generated = [
      { id: `gen-ai1-${clientId}`, clientId, type: 'risk_alert' as const, title: 'GSTIN validation errors blocking filing', description: `${isHighRisk ? 'Multiple' : '1'} invoice(s) with invalid GSTIN must be corrected before filing.`, suggestedAction: 'Fix GSTIN', urgency: 'high' as const, dismissed: false },
      { id: `gen-ai2-${clientId}`, clientId, type: 'filing_rec' as const, title: `File ${isHighRisk ? 'overdue returns' : 'GSTR-1 before deadline'}`, description: isHighRisk ? 'Late fees accruing. File immediately to stop penalties.' : 'Filing deadline approaching. Resolve issues to achieve readiness.', suggestedAction: 'Resolve Issues', urgency: isHighRisk ? 'high' as const : 'medium' as const, dismissed: false },
      { id: `gen-ai3-${clientId}`, clientId, type: 'tax_anomaly' as const, title: 'Reconciliation mismatches detected', description: `${isHighRisk ? 'Multiple' : 'Minor'} discrepancies between books and GSTR-2B data. Review to protect ITC claims.`, suggestedAction: 'Run Reconciliation', urgency: isHighRisk ? 'medium' as const : 'info' as const, dismissed: false },
    ];
    set(state => ({ aiInsights: { ...state.aiInsights, [clientId]: generated } }));
    return generated;
  },

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
  getReconSummary: (clientId) => {
    const existing = get().reconSummary[clientId];
    if (existing && existing.length > 0) return existing;
    // Auto-generate recon summary for clients without pre-defined data
    const client = get().getClient(clientId);
    if (!client) return [];
    const hs = client.healthScore;
    const matchRate = hs > 80 ? 92 : hs > 50 ? 78 : 55;
    return [
      { label: 'Perfect Match', count: Math.floor(matchRate * 0.4), amount: Math.round(hs * 32000), color: 'text-emerald-700', bgColor: 'bg-emerald-50 border-emerald-200' },
      { label: 'Partial Match', count: Math.floor((100 - matchRate) * 0.1), amount: Math.round(hs * 4000), color: 'text-amber-700', bgColor: 'bg-amber-50 border-amber-200' },
      { label: 'Mismatch', count: Math.floor((100 - matchRate) * 0.05), amount: Math.round(hs * 3000), color: 'text-red-700', bgColor: 'bg-red-50 border-red-200' },
      { label: 'Missing in Books', count: Math.floor((100 - matchRate) * 0.03), amount: Math.round(hs * 1000), color: 'text-orange-700', bgColor: 'bg-orange-50 border-orange-200' },
      { label: 'Missing in Portal', count: Math.floor((100 - matchRate) * 0.04), amount: Math.round(hs * 2500), color: 'text-purple-700', bgColor: 'bg-purple-50 border-purple-200' },
    ];
  },

  // ── Prep Workflow Actions ──
  getPrepStep: (clientId) => get().prepWorkflowStep[clientId] ?? 1,

  advancePrepStep: (clientId) => set(state => {
    const current = state.prepWorkflowStep[clientId] ?? 1;
    if (current >= 6) return state; // Max is step 6 (Filed)
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

    return {
      readyToFile: readyCount,
      criticalIssues: criticalCount,
      pendingReturns: pendingCount,
      filedThisMonth: filedCount,
      totalReturns: state.filings.length,
    };
  },

  getReadyToFileFilings: () => {
    const state = get();
    const readyStatuses = ['validated', 'generated', 'reviewed'];
    return state.filings.filter(f => readyStatuses.includes(f.status) && !state.filedReturnIds.has(f.id));
  },

  getBlockingIssues: () => get().blockingIssues,

  getRecentUploads: () => get().uploads,

  // ── Reset ──
  resetStore: () => set({
    clients: [...SAMPLE_CLIENTS],
    filings: [...SAMPLE_FILINGS],
    invoices: { ...SAMPLE_INVOICES },
    issues: { ...SAMPLE_ISSUES },
    aiInsights: { ...SAMPLE_AI_INSIGHTS },
    reconDrilldowns: { ...SAMPLE_RECON_DRILLDOWNS },
    reconSummary: { ...SAMPLE_RECON_SUMMARY },
    dashboardMetrics: { ...SAMPLE_DASHBOARD_METRICS },
    blockingIssues: [...SAMPLE_BLOCKING_ISSUES],
    uploads: [...SAMPLE_UPLOADS],
    filedReturnIds: new Set<string>(),
    filingInProgressIds: new Set<string>(),
    prepWorkflowStep: {},
  }),
}));

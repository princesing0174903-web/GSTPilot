'use client'

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * DashboardViews — View Registry & Renderer (Product Mode · Step 0)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * GSTPilot is an AI Finance Operating System, not a collection of finance modules.
 * This file is the single point where "build jobs, not pages" becomes real:
 *
 *   • ONLY real, working views are imported. ~21 dynamic imports, not ~150.
 *   • Every fake / placeholder / vision-module view routes to ONE premium
 *     FeaturePlaceholder page — no dead links, no inconsistent "Coming Soon".
 *   • Duplicate implementations (6 Oracle variants, 3 Banking, 3 Clients, 3
 *     Invoices) are redirected to their single canonical view.
 *   • DISABLED_VIEWS is the feature-flag ledger — the component files for these
 *     views still exist on disk (NOT deleted). To re-enable a view once it
 *     passes the 8-Gate Constitution, add its dynamic import back here and
 *     remove its entry from DISABLED_VIEWS.
 *
 * WHY only ~21 imports: webpack resolves every dynamic() target at compile
 * time. ~150 imports blew the 4GB sandbox limit and the preview never loaded.
 * Trimming to the real views fixes the preview AND completes Step 0.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import dynamic from 'next/dynamic'
import type { ComponentType } from 'react'
import {
  Landmark, ShieldCheck, Wallet, BarChart3, Network,
  Workflow, GitBranch, Cpu, Boxes, Database, Sparkles,
  Building2, Globe, TrendingUp, type LucideIcon,
} from 'lucide-react'
import { FeaturePlaceholder } from '@/components/design-system/FeaturePlaceholder'
import { PremiumPageLoader } from '@/components/ui/premium-loading'

// ── Loading placeholder (premium page-level loader) ──────────────────────────
const PageLoader = () => <PremiumPageLoader />

// ═══════════════════════════════════════════════════════════════════════════════
// REAL VIEW COMPONENTS — the only dynamic imports in the build graph.
// Every view below has real data, real CRUD, real APIs, and real persistence.
// Adding a view here means it has passed the 8-Gate Constitution.
// ═══════════════════════════════════════════════════════════════════════════════

const DashboardHomePage = dynamic(() => import('@/components/dashboard/DashboardPage'), { loading: PageLoader, ssr: false })
const ClientRegistryPage = dynamic(() => import('@/components/clients/ClientRegistryPage'), { loading: PageLoader, ssr: false })
const ClientWorkspacePage = dynamic(() => import('@/components/clients/ClientWorkspacePage'), { loading: PageLoader, ssr: false })
const InvoiceWorkspacePage = dynamic(() => import('@/components/invoices/InvoiceWorkspacePage'), { loading: PageLoader, ssr: false })
const ReturnsPage = dynamic(() => import('@/components/returns/ReturnsPage'), { loading: PageLoader, ssr: false })
const ReturnPrepWorkspace = dynamic(() => import('@/components/returns/ReturnPrepWorkspace'), { loading: PageLoader, ssr: false })
const ReconciliationPage = dynamic(() => import('@/components/reconciliation/ReconciliationPage'), { loading: PageLoader, ssr: false })
const BankingPage = dynamic(() => import('@/components/banking/BankingPage'), { loading: PageLoader, ssr: false })
const ReportsPage = dynamic(() => import('@/components/reports/ReportsPage'), { loading: PageLoader, ssr: false })
const SettingsPage = dynamic(() => import('@/components/settings/SettingsPage'), { loading: PageLoader, ssr: false })
const GoogleWorkspacePage = dynamic(() => import('@/components/google-workspace/GoogleWorkspacePage'), { loading: PageLoader, ssr: false })
const ZohoBooksPage = dynamic(() => import('@/components/zoho-books/ZohoBooksPage'), { loading: PageLoader, ssr: false })
const OracleBrainPage = dynamic(() => import('@/components/oracle/OracleBrain'), { loading: PageLoader, ssr: false })
const TimelinePage = dynamic(() => import('@/components/timeline/TimelinePage'), { loading: PageLoader, ssr: false })
const TasksPage = dynamic(() => import('@/components/tasks/TasksPage'), { loading: PageLoader, ssr: false })
const DocumentVaultPage = dynamic(() => import('@/components/documents/DocumentVaultPage'), { loading: PageLoader, ssr: false })
const NoticeCenterPage = dynamic(() => import('@/components/notices/NoticeCenterPage'), { loading: PageLoader, ssr: false })
// ── GSTPilot Firestore-connected registries (real CRUD) ────────────────────────
const GSTpilotVendorsView = dynamic(() => import('@/components/gstpilot-data/VendorsView'), { loading: PageLoader, ssr: false })
const GSTpilotExpensesView = dynamic(() => import('@/components/gstpilot-data/ExpensesView'), { loading: PageLoader, ssr: false })
const GSTpilotPaymentsView = dynamic(() => import('@/components/gstpilot-data/PaymentsView'), { loading: PageLoader, ssr: false })
const GSTpilotProductsView = dynamic(() => import('@/components/gstpilot-data/ProductsView'), { loading: PageLoader, ssr: false })

// ═══════════════════════════════════════════════════════════════════════════════
// VIEW → COMPONENT MAP — only canonical, real views live here.
// ═══════════════════════════════════════════════════════════════════════════════

const VIEW_COMPONENTS: Record<string, ComponentType<any>> = {
  // ── Core product surface ──
  dashboard: DashboardHomePage,
  'oracle-brain': OracleBrainPage,

  // ── Finance workflows (the Invoice → Bank → GST → Oracle spine) ──
  invoices: InvoiceWorkspacePage,
  clients: ClientRegistryPage,
  'client-workspace': ClientWorkspacePage,
  returns: ReturnsPage,
  'return-prep': ReturnPrepWorkspace,
  reconcile: ReconciliationPage,
  banking: BankingPage,
  reports: ReportsPage,

  // ── Supporting registries (real Firestore CRUD) ──
  vendors: GSTpilotVendorsView,
  expenses: GSTpilotExpensesView,
  payments: GSTpilotPaymentsView,
  inventory: GSTpilotProductsView,
  timeline: TimelinePage,
  tasks: TasksPage,
  documents: DocumentVaultPage,
  notices: NoticeCenterPage,

  // ── Real integrations ──
  'google-workspace': GoogleWorkspacePage,
  'zoho-books': ZohoBooksPage,

  // ── System ──
  settings: SettingsPage,
}

// ═══════════════════════════════════════════════════════════════════════════════
// VIEW REDIRECTS — duplicate implementations collapse to their canonical view.
// Non-destructive: the duplicate component files remain on disk as dead code.
// To re-enable a duplicate (rare), delete its line below.
// ═══════════════════════════════════════════════════════════════════════════════

const VIEW_REDIRECTS: Record<string, string> = {
  // Oracle duplicates → canonical Oracle Brain (the only Oracle surface)
  'oracle-chat': 'oracle-brain',
  'oracle-ai': 'oracle-brain',
  'oracle-cfo': 'oracle-brain',
  'ai-business-copilot': 'oracle-brain',
  'oracle-intelligence': 'oracle-brain',
  'finos': 'oracle-brain',
  'ai-cfo': 'oracle-brain',

  // Banking duplicates → canonical Banking (Prisma-backed)
  'banking-intelligence': 'banking',

  // Client duplicates → canonical Clients (Prisma-backed)
  'crm': 'clients',

  // Invoice duplicates → canonical Invoices (Prisma-backed)
  'invoice-cloud': 'invoices',

  // Removed view → real integration page
  'connections': 'google-workspace',
}

// ═══════════════════════════════════════════════════════════════════════════════
// DISABLED VIEWS — feature-flag ledger.
//
// These views HAVE component files on disk (beautiful shells) but no real
// backend yet. They render FeaturePlaceholder instead. This is Gate 3 (Remove
// fake implementations) + Step 0 (hide fake modules, do not delete).
//
// To re-enable a view once it passes the 8-Gate Constitution:
//   1. Add its dynamic() import to the REAL VIEW COMPONENTS block above.
//   2. Add its entry to VIEW_COMPONENTS.
//   3. Remove its line from DISABLED_VIEWS.
// The component file is never deleted — only re-linked.
// ═══════════════════════════════════════════════════════════════════════════════

const DISABLED_VIEWS = new Set<string>([
  // ── AI duplicates (folding into Oracle Brain) ──
  'ai-reports', 'ai-compliance', 'ai-risk', 'ai-insights', 'ai-tasks',
  'ai-benchmark', 'ai-knowledge', 'ai-doc-chat', 'ai-predictions',
  'ai-operating-room', 'ai-priority-engine', 'ai-ca-manager',
  'ai-account-manager', 'ai-deadline-engine', 'ai-document-employee',
  'ai-voice-assistant', 'ai-firm-memory',

  // ── Vision modules (beautiful shells, no real backend) ──
  'ai-software-factory', 'autonomous-enterprise', 'enterprise-cloud-platform',
  'enterprise-ai-platform', 'global-enterprise-network', 'business-dna',
  'digital-twin', 'agent-os', 'event-engine', 'decision-engine', 'app-store',
  'gstpilot-network', 'data-cloud', 'run-india-business', 'universal-business-id',
  'credit-scoring-engine', 'invoice-exchange', 'financing-marketplace',
  'economic-graph', 'economic-war-room', 'run-my-company', 'run-my-business',
  'executive-war-room', 'business-graph', 'data-moat', 'embedded-finance',
  'working-capital', 'industry-benchmark', 'network-effects', 'mission-control',
  'multi-firm', 'autopilot', 'generate',

  // ── Phase 13 — Enterprise Command (placeholders) ──
  'enterprise-command-center', 'multi-company-workspace', 'team-collaboration',
  'workflow-engine', 'enterprise-documents', 'executive-calendar',
  'enterprise-search', 'enterprise-notifications', 'advanced-rbac',
  'cross-company-analytics', 'enterprise-audit',

  // ── Phase 14 — Global Expansion (placeholders) ──
  'multi-country-accounting', 'multi-tax-engine', 'multi-currency-system',
  'international-banking', 'global-compliance-engine', 'international-erp',
  'multi-language-platform', 'ai-global-advisor', 'global-dashboard',
  'cross-border-payments', 'international-reports', 'global-performance',

  // ── Phase 16 — Global Financial Cloud (placeholders) ──
  'global-financial-cloud', 'developer-platform', 'enterprise-api-gateway',
  'app-marketplace-cloud', 'global-integration-hub', 'financial-data-cloud',
  'event-streaming', 'automation-studio', 'data-warehouse', 'global-identity',
  'developer-analytics', 'enterprise-billing', 'multi-tenant-infra',
  'enterprise-security-cloud', 'global-financial-network', 'platform-intelligence',

  // ── Phase Delta — Autonomous Finance OS (placeholders) ──
  'autonomous-finance', 'workflow-studio', 'oracle-actions',
  'financial-intelligence', 'smart-reconciliation', 'predictive-compliance',
  'intelligent-collections',

  // ── Platform / marketplace (placeholders) ──
  'marketplace', 'white-label', 'client-portal', 'billing',
  'version-history', 'esignatures', 'agents', 'api-platform-v2',
  'automation-center', 'audit-resolution',

  // ── Business OS modules not yet built ──
  'accounting', 'payroll', 'hrms', 'e-invoicing', 'tds',
  'roc-compliance', 'legal-notices', 'team-performance',
  'firm-operations', 'workload', 'review', 'deadlines',
  'client-health', 'executive-analytics', 'analytics',
  'collaboration', 'approvals', 'automations', 'audit-trail',
  'team', 'firm-command-center',
])

// ── Placeholder metadata for known non-working views ──────────────────────────
// Gives the placeholder page a proper title, icon, and description.

const PLACEHOLDER_META: Record<string, { name: string; description: string; icon: LucideIcon; capabilities?: string[] }> = {
  banking: {
    name: 'Banking',
    description: 'Connect your bank accounts to automatically reconcile transactions, track cash flow, and sync payments with invoices.',
    icon: Landmark,
    capabilities: ['Auto bank reconciliation', 'Cash flow tracking', 'Payment matching', 'Transaction categorization'],
  },
  'e-invoicing': {
    name: 'E-Invoicing',
    description: 'Generate IRN and QR codes for GST-compliant e-invoices directly from the invoice workspace.',
    icon: ShieldCheck,
    capabilities: ['IRN generation', 'QR code embedding', 'GSTN e-invoice API', 'Auto-cancel & amend'],
  },
  tds: {
    name: 'TDS Management',
    description: 'Track TDS deductions, generate Form 26Q/24Q, and file TDS returns with the TRACES portal.',
    icon: ShieldCheck,
    capabilities: ['TDS deduction tracking', 'Form 26Q / 24Q', 'TRACES integration', 'Challan management'],
  },
  'roc-compliance': {
    name: 'ROC Compliance',
    description: 'Manage company filings with the Registrar of Companies — MGT-7, AOC-4, DIR-3, and more.',
    icon: ShieldCheck,
    capabilities: ['MGT-7 / AOC-4 filing', 'Director management', 'Annual return tracking', 'Event-based filings'],
  },
  payroll: {
    name: 'Payroll',
    description: 'Run payroll, generate payslips, and manage PF/PT/TDS deductions for your team.',
    icon: Wallet,
    capabilities: ['Payroll runs', 'Payslip generation', 'PF / PT / TDS', 'Salary structure management'],
  },
  hrms: {
    name: 'HRMS',
    description: 'Manage employee records, attendance, leave, and performance reviews in one place.',
    icon: ShieldCheck,
    capabilities: ['Employee database', 'Attendance tracking', 'Leave management', 'Performance reviews'],
  },
  accounting: {
    name: 'Accounting',
    description: 'Double-entry bookkeeping, chart of accounts, journal entries, and financial statements.',
    icon: BarChart3,
    capabilities: ['Chart of accounts', 'Journal entries', 'Trial balance', 'P&L and Balance Sheet'],
  },
  'legal-notices': {
    name: 'Legal Notices',
    description: 'Draft, track, and serve legal notices with templates and compliance tracking.',
    icon: ShieldCheck,
    capabilities: ['Notice templates', 'Service tracking', 'Deadline alerts', 'Response management'],
  },
  'executive-war-room': {
    name: 'Executive War Room',
    description: 'Real-time executive dashboard with live KPIs, risk alerts, and decision tracking.',
    icon: TrendingUp,
    capabilities: ['Live KPI monitoring', 'Risk alerts', 'Decision log', 'Scenario analysis'],
  },
  'business-graph': {
    name: 'Business Graph',
    description: 'Visualize relationships between customers, vendors, invoices, and payments in a graph.',
    icon: Network,
    capabilities: ['Entity relationships', 'Transaction flow', 'Risk concentration', 'Network analytics'],
  },
  'working-capital': {
    name: 'Working Capital',
    description: 'Monitor receivables, payables, and cash conversion cycle to optimize working capital.',
    icon: Wallet,
    capabilities: ['Receivables aging', 'Payables tracking', 'Cash conversion cycle', 'Forecasting'],
  },
  'data-moat': {
    name: 'Data Moat',
    description: 'Centralize and govern your business data with lineage tracking and access controls.',
    icon: Database,
    capabilities: ['Data lineage', 'Access governance', 'Quality scoring', 'Audit trail'],
  },
  'agent-os': {
    name: 'Agent OS',
    description: 'Build, deploy, and monitor autonomous AI agents for finance and compliance workflows.',
    icon: Cpu,
    capabilities: ['Agent builder', 'Workflow automation', 'Agent monitoring', 'Audit logs'],
  },
  'digital-twin': {
    name: 'Digital Twin',
    description: 'Create a digital replica of your business to simulate decisions before executing them.',
    icon: Boxes,
    capabilities: ['Business simulation', 'Scenario modeling', 'Impact prediction', 'What-if analysis'],
  },
  'app-store': {
    name: 'App Store',
    description: 'Extend GSTPilot with third-party apps and integrations from the marketplace.',
    icon: Boxes,
    capabilities: ['App catalog', 'One-click install', 'Unified billing', 'App management'],
  },
  'event-engine': {
    name: 'Event Engine',
    description: 'Event-driven automation that triggers workflows based on business events.',
    icon: Workflow,
    capabilities: ['Event triggers', 'Workflow automation', 'Webhook dispatch', 'Event replay'],
  },
  'decision-engine': {
    name: 'Decision Engine',
    description: 'Rule-based decision engine for approvals, thresholds, and policy enforcement.',
    icon: GitBranch,
    capabilities: ['Decision rules', 'Approval workflows', 'Policy enforcement', 'Audit trail'],
  },
  'run-india-business': {
    name: 'Run India Business',
    description: 'State-wise GST compliance, branch management, and local tax tracking.',
    icon: Globe,
    capabilities: ['State-wise GST', 'Branch management', 'Local tax rules', 'Inter-state reconciliation'],
  },
  'run-my-business': {
    name: 'Run My Business',
    description: 'Autopilot mode for daily operations — auto-file, auto-remind, auto-reconcile.',
    icon: Sparkles,
    capabilities: ['Autopilot filing', 'Auto reminders', 'Auto reconciliation', 'Exception alerts'],
  },
  'multi-firm': {
    name: 'Multi-Firm',
    description: 'Manage multiple firms or business entities from a single dashboard.',
    icon: Building2,
    capabilities: ['Multi-entity dashboard', 'Consolidated reports', 'Inter-entity transactions', 'Role-based access'],
  },
}

// ═══════════════════════════════════════════════════════════════════════════════
// DashboardViewRenderer — consumed by DashboardShell
// ═══════════════════════════════════════════════════════════════════════════════

export default function DashboardViews({ view }: { view: string }) {
  // Step 1: Redirect duplicates to their canonical view.
  const redirectedView = VIEW_REDIRECTS[view] ?? view;

  // Step 2: If the view is feature-flagged off, show FeaturePlaceholder.
  // This is Gate 3 (Remove fake implementations) + Step 0 (hide, don't delete).
  if (DISABLED_VIEWS.has(redirectedView)) {
    const meta = PLACEHOLDER_META[redirectedView];
    if (meta) {
      return (
        <FeaturePlaceholder
          featureName={meta.name}
          description={meta.description}
          icon={meta.icon}
          capabilities={meta.capabilities}
        />
      );
    }
    return (
      <FeaturePlaceholder
        featureName="This module is on the roadmap"
        description="GSTPilot is an AI Finance Operating System, focused on delivering one perfect workflow at a time. This module will be built once the core Invoice → Bank → GST → Oracle workflow is production-grade."
        icon={Sparkles}
      />
    );
  }

  // Step 3: Render the component for views that have a real implementation.
  const Component = VIEW_COMPONENTS[redirectedView];
  if (Component) {
    return <Component />;
  }

  // Step 4: Views without a component get the placeholder.
  const meta = PLACEHOLDER_META[redirectedView];
  if (meta) {
    return (
      <FeaturePlaceholder
        featureName={meta.name}
        description={meta.description}
        icon={meta.icon}
        capabilities={meta.capabilities}
      />
    );
  }

  // Unknown view → generic placeholder.
  return (
    <FeaturePlaceholder
      featureName="This module is on the roadmap"
      description="GSTPilot is an AI Finance Operating System, focused on delivering one perfect workflow at a time. This module will be built once the core Invoice → Bank → GST → Oracle workflow is production-grade."
      icon={Sparkles}
    />
  )
}

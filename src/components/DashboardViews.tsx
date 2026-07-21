'use client'

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * DashboardViews — View Registry & Renderer (Unified Design System)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * ONLY real, working views are rendered. Every non-working view routes to
 * the single premium FeaturePlaceholder page — eliminating 60+ inconsistent
 * "Coming Soon" pages and making the entire SaaS feel like one product.
 *
 * REAL_VIEWS = genuine implementations with real data, real CRUD, real APIs.
 * Everything else = FeaturePlaceholder with honest "on the roadmap" messaging.
 */

import dynamic from 'next/dynamic'
import type { ComponentType } from 'react'
import {
  Landmark, ShieldCheck, MessageCircle, Mail, Calendar,
  TrendingUp, Network, Database, Cpu, Globe, Boxes,
  Workflow, GitBranch, BarChart3, Sparkles, Building2, Wallet,
  FileText, Users, type LucideIcon,
} from 'lucide-react'
import { FeaturePlaceholder } from '@/components/design-system/FeaturePlaceholder'

// ── Loading placeholder (matches page.tsx PageLoader) ──────────────────────────
const PageLoader = () => (
  <div className="flex h-full min-h-[60vh] items-center justify-center">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
  </div>
)

// ═══════════════════════════════════════════════════════════════════════════════
// LAZY-LOADED VIEW COMPONENTS — next/dynamic so only the active view compiles.
// ═══════════════════════════════════════════════════════════════════════════════

const ReturnsPage = dynamic(() => import('@/components/returns/ReturnsPage'), { loading: PageLoader, ssr: false })
const ReconciliationPage = dynamic(() => import('@/components/reconciliation/ReconciliationPage'), { loading: PageLoader, ssr: false })
const InvoiceWorkspacePage = dynamic(() => import('@/components/invoices/InvoiceWorkspacePage'), { loading: PageLoader, ssr: false })
const ClientRegistryPage = dynamic(() => import('@/components/clients/ClientRegistryPage'), { loading: PageLoader, ssr: false })
const ClientWorkspacePage = dynamic(() => import('@/components/clients/ClientWorkspacePage'), { loading: PageLoader, ssr: false })
const ReturnPrepWorkspace = dynamic(() => import('@/components/returns/ReturnPrepWorkspace'), { loading: PageLoader, ssr: false })
const SettingsPage = dynamic(() => import('@/components/settings/SettingsPage'), { loading: PageLoader, ssr: false })
const FirmCommandCenterPage = dynamic(() => import('@/components/firm-command-center/FirmCommandCenterPage'), { loading: PageLoader, ssr: false })
const MultiFirmPage = dynamic(() => import('@/components/multi-firm/MultiFirmPage'), { loading: PageLoader, ssr: false })
const AutopilotPage = dynamic(() => import('@/components/autopilot/AutopilotPage'), { loading: PageLoader, ssr: false })
const AICAManagerPage = dynamic(() => import('@/components/ai-ca-manager/AICAManagerPage'), { loading: PageLoader, ssr: false })
const AIAccountManagerPage = dynamic(() => import('@/components/ai-account-manager/AIAccountManagerPage'), { loading: PageLoader, ssr: false })
const AIDeadlineEnginePage = dynamic(() => import('@/components/ai-deadline-engine/AIDeadlineEnginePage'), { loading: PageLoader, ssr: false })
const AIDocumentEmployeePage = dynamic(() => import('@/components/ai-document-employee/AIDocumentEmployeePage'), { loading: PageLoader, ssr: false })
const AIVoiceAssistantPage = dynamic(() => import('@/components/ai-voice-assistant/AIVoiceAssistantPage'), { loading: PageLoader, ssr: false })
const AIFirmMemoryPage = dynamic(() => import('@/components/ai-firm-memory/AIFirmMemoryPage'), { loading: PageLoader, ssr: false })
const AIOperatingRoomPage = dynamic(() => import('@/components/ai-operating-room/AIOperatingRoomPage'), { loading: PageLoader, ssr: false })
const AIPredictionsPage = dynamic(() => import('@/components/ai-predictions/AIPredictionsPage'), { loading: PageLoader, ssr: false })
const AIPriorityEnginePage = dynamic(() => import('@/components/ai-priority-engine/AIPriorityEnginePage'), { loading: PageLoader, ssr: false })
const BusinessGraphPage = dynamic(() => import('@/components/business-graph/BusinessGraphPage'), { loading: PageLoader, ssr: false })
const DataMoatPage = dynamic(() => import('@/components/data-moat/DataMoatPage'), { loading: PageLoader, ssr: false })
const EmbeddedFinancePage = dynamic(() => import('@/components/embedded-finance/EmbeddedFinancePage'), { loading: PageLoader, ssr: false })
const IndustryBenchmarkPage = dynamic(() => import('@/components/industry-benchmark/IndustryBenchmarkPage'), { loading: PageLoader, ssr: false })
const WorkingCapitalPage = dynamic(() => import('@/components/working-capital/WorkingCapitalPage'), { loading: PageLoader, ssr: false })
const NetworkEffectsPage = dynamic(() => import('@/components/network-effects/NetworkEffectsPage'), { loading: PageLoader, ssr: false })
const AIBusinessCopilotPage = dynamic(() => import('@/components/ai-business-copilot/AIBusinessCopilotPage'), { loading: PageLoader, ssr: false })
const RunMyBusinessPage = dynamic(() => import('@/components/run-my-business/RunMyBusinessPage'), { loading: PageLoader, ssr: false })
const ExecutiveWarRoomPage = dynamic(() => import('@/components/executive-war-room/ExecutiveWarRoomPage'), { loading: PageLoader, ssr: false })
const AppStorePage = dynamic(() => import('@/components/app-store/AppStorePage'), { loading: PageLoader, ssr: false })
const DigitalTwinPage = dynamic(() => import('@/components/digital-twin/DigitalTwinPage'), { loading: PageLoader, ssr: false })
const APIPlatformPage = dynamic(() => import('@/components/api-platform-v2/APIPlatformPage'), { loading: PageLoader, ssr: false })
const EventEnginePage = dynamic(() => import('@/components/event-engine/EventEnginePage'), { loading: PageLoader, ssr: false })
const AgentOSPage = dynamic(() => import('@/components/agent-os/AgentOSPage'), { loading: PageLoader, ssr: false })
const DecisionEnginePage = dynamic(() => import('@/components/decision-engine/DecisionEnginePage'), { loading: PageLoader, ssr: false })
const GSTPilotNetworkPage = dynamic(() => import('@/components/gstpilot-network/GSTPilotNetworkPage'), { loading: PageLoader, ssr: false })
const DataCloudPage = dynamic(() => import('@/components/data-cloud/DataCloudPage'), { loading: PageLoader, ssr: false })
const RunIndiaBusinessPage = dynamic(() => import('@/components/run-india-business/RunIndiaBusinessPage'), { loading: PageLoader, ssr: false })
const UniversalBusinessIDPage = dynamic(() => import('@/components/universal-business-id/UniversalBusinessIDPage'), { loading: PageLoader, ssr: false })
const CreditScoringEnginePage = dynamic(() => import('@/components/credit-scoring-engine/CreditScoringEnginePage'), { loading: PageLoader, ssr: false })
const InvoiceExchangePage = dynamic(() => import('@/components/invoice-exchange/InvoiceExchangePage'), { loading: PageLoader, ssr: false })
const FinancingMarketplacePage = dynamic(() => import('@/components/financing-marketplace/FinancingMarketplacePage'), { loading: PageLoader, ssr: false })
const EconomicGraphPage = dynamic(() => import('@/components/economic-graph/EconomicGraphPage'), { loading: PageLoader, ssr: false })
const EconomicWarRoomPage = dynamic(() => import('@/components/economic-war-room/EconomicWarRoomPage'), { loading: PageLoader, ssr: false })
const RunMyCompanyPage = dynamic(() => import('@/components/run-my-company/RunMyCompanyPage'), { loading: PageLoader, ssr: false })
const MissionControlPage = dynamic(() => import('@/components/mission-control/MissionControlPage'), { loading: PageLoader, ssr: false })
// Home (dashboard view) — the production command center. Implements the
// 16-step Home stabilization directive: real onboarding engine, premium
// modals (Connect GSTN / Bank / Team / Oracle), single-source-of-truth
// Business Snapshot, gated Ask Oracle, professional empty/loading/error
// states. See src/components/dashboard/DashboardPage.tsx.
const DashboardHomePage = dynamic(() => import('@/components/dashboard/DashboardPage'), { loading: PageLoader, ssr: false })
const BusinessDNApage = dynamic(() => import('@/components/business-dna/BusinessDNApage'), { loading: PageLoader, ssr: false })
const AICFODashboardPage = dynamic(() => import('@/components/ai-cfo/AICFODashboardPage'), { loading: PageLoader, ssr: false })
const InvoiceCloudPage = dynamic(() => import('@/components/invoice-cloud/InvoiceCloudPage'), { loading: PageLoader, ssr: false })
const ExecutionEnginePage = dynamic(() => import('@/components/execution-engine/ExecutionEnginePage'), { loading: PageLoader, ssr: false })
const GenerateWorkbench = dynamic(() => import('@/components/generate/GenerateWorkbench'), { loading: PageLoader, ssr: false })
const ReportsPage = dynamic(() => import('@/components/reports/ReportsPage'), { loading: PageLoader, ssr: false })
const AIExecutiveReportsPage = dynamic(() => import('@/components/ai-reports/AIExecutiveReportsPage'), { loading: PageLoader, ssr: false })
const AICompliancePage = dynamic(() => import('@/components/ai-compliance/AICompliancePage'), { loading: PageLoader, ssr: false })
const AIRiskEnginePage = dynamic(() => import('@/components/ai-risk/AIRiskEnginePage'), { loading: PageLoader, ssr: false })
const AIClientInsightsPage = dynamic(() => import('@/components/ai-insights/AIClientInsightsPage'), { loading: PageLoader, ssr: false })
const AITaskGeneratorPage = dynamic(() => import('@/components/ai-tasks/AITaskGeneratorPage'), { loading: PageLoader, ssr: false })
const AIBenchmarkPage = dynamic(() => import('@/components/ai-benchmark/AIBenchmarkPage'), { loading: PageLoader, ssr: false })
const AIKnowledgeCenterPage = dynamic(() => import('@/components/ai-knowledge/AIKnowledgeCenterPage'), { loading: PageLoader, ssr: false })
const AIDocumentChatPage = dynamic(() => import('@/components/ai-doc-chat/AIDocumentChatPage'), { loading: PageLoader, ssr: false })
const NoticeCenterPage = dynamic(() => import('@/components/notices/NoticeCenterPage'), { loading: PageLoader, ssr: false })
const GSTRFilingPage = dynamic(() => import('@/components/gstr/GSTRFilingPage'), { loading: PageLoader, ssr: false })
const FilingCalendarPage = dynamic(() => import('@/components/calendar/FilingCalendarPage'), { loading: PageLoader, ssr: false })
const AccountingPage = dynamic(() => import('@/components/accounting/AccountingPage'), { loading: PageLoader, ssr: false })
const PayrollPage = dynamic(() => import('@/components/payroll/PayrollPage'), { loading: PageLoader, ssr: false })
const HRMSPage = dynamic(() => import('@/components/hrms/HRMSPage'), { loading: PageLoader, ssr: false })
const InventoryPage = dynamic(() => import('@/components/inventory/InventoryPage'), { loading: PageLoader, ssr: false })
const BankingPage = dynamic(() => import('@/components/banking/BankingPage'), { loading: PageLoader, ssr: false })
// Phase Oracle Priority 3 — Banking Intelligence (modular banking module with
// service/repository pattern; mock data now, Setu-ready later. Fully additive —
// the legacy 'banking' view is untouched.)
const BankingIntelligencePage = dynamic(() => import('@/components/banking-intelligence/BankingIntelligencePage'), { loading: PageLoader, ssr: false })
const PaymentsPage = dynamic(() => import('@/components/payments/PaymentsPage'), { loading: PageLoader, ssr: false })
const EInvoicingPage = dynamic(() => import('@/components/e-invoicing/EInvoicingPage'), { loading: PageLoader, ssr: false })
const TDSPage = dynamic(() => import('@/components/tds/TDSPage'), { loading: PageLoader, ssr: false })
const ROCCompliancePage = dynamic(() => import('@/components/roc-compliance/ROCCompliancePage'), { loading: PageLoader, ssr: false })
const LegalNoticesPage = dynamic(() => import('@/components/legal-notices/LegalNoticesPage'), { loading: PageLoader, ssr: false })
const TeamManagementPage = dynamic(() => import('@/components/team/TeamManagementPage'), { loading: PageLoader, ssr: false })
const TeamPerformancePage = dynamic(() => import('@/components/team-performance/TeamPerformancePage'), { loading: PageLoader, ssr: false })
const FirmOperationsPage = dynamic(() => import('@/components/firm-operations/FirmOperationsPage'), { loading: PageLoader, ssr: false })
const WorkloadPage = dynamic(() => import('@/components/workload/WorkloadPage'), { loading: PageLoader, ssr: false })
const ReviewPage = dynamic(() => import('@/components/review/ReviewPage'), { loading: PageLoader, ssr: false })
const DeadlineCenterPage = dynamic(() => import('@/components/deadlines/DeadlineCenterPage'), { loading: PageLoader, ssr: false })
const ClientHealthPage = dynamic(() => import('@/components/client-health/ClientHealthPage'), { loading: PageLoader, ssr: false })
const ExecutiveAnalyticsPage = dynamic(() => import('@/components/executive-analytics/ExecutiveAnalyticsPage'), { loading: PageLoader, ssr: false })
const AnalyticsPage = dynamic(() => import('@/components/analytics/AnalyticsPage'), { loading: PageLoader, ssr: false })
const TimelinePage = dynamic(() => import('@/components/timeline/TimelinePage'), { loading: PageLoader, ssr: false })
const TasksPage = dynamic(() => import('@/components/tasks/TasksPage'), { loading: PageLoader, ssr: false })
const DocumentVaultPage = dynamic(() => import('@/components/documents/DocumentVaultPage'), { loading: PageLoader, ssr: false })
const CollaborationPage = dynamic(() => import('@/components/collaboration/CollaborationPage'), { loading: PageLoader, ssr: false })
const CRMPage = dynamic(() => import('@/components/crm/CRMPage'), { loading: PageLoader, ssr: false })

// ── GSTPilot Firestore-connected modules ─────────────────────────────────────
// These three views replace the mock-data pages with real Firestore CRUD at:
//   organizations/GSTpilot_SAAS/{customers,products,invoices}
// Live lists via onSnapshot. No demo data. Firestore is the only source of truth.
const GSTpilotCustomersView = dynamic(() => import('@/components/gstpilot-data/CustomersView'), { loading: PageLoader, ssr: false })
const GSTpilotProductsView = dynamic(() => import('@/components/gstpilot-data/ProductsView'), { loading: PageLoader, ssr: false })
const GSTpilotInvoicesView = dynamic(() => import('@/components/gstpilot-data/InvoicesView'), { loading: PageLoader, ssr: false })
const GSTpilotVendorsView = dynamic(() => import('@/components/gstpilot-data/VendorsView'), { loading: PageLoader, ssr: false })
const GSTpilotExpensesView = dynamic(() => import('@/components/gstpilot-data/ExpensesView'), { loading: PageLoader, ssr: false })
const GSTpilotPaymentsView = dynamic(() => import('@/components/gstpilot-data/PaymentsView'), { loading: PageLoader, ssr: false })
const ApprovalsPage = dynamic(() => import('@/components/approvals/ApprovalsPage'), { loading: PageLoader, ssr: false })
const AutomationsPage = dynamic(() => import('@/components/automations/AutomationsPage'), { loading: PageLoader, ssr: false })
const AutomationCenterPage = dynamic(() => import('@/components/automation/AutomationCenterPage'), { loading: PageLoader, ssr: false })
const ErrorResolutionPage = dynamic(() => import('@/components/audit/ErrorResolutionPage'), { loading: PageLoader, ssr: false })
const AuditLogsPage = dynamic(() => import('@/components/audit-logs/AuditLogsPage'), { loading: PageLoader, ssr: false })
const BillingPage = dynamic(() => import('@/components/billing/BillingPage'), { loading: PageLoader, ssr: false })
const WhiteLabelPage = dynamic(() => import('@/components/white-label/WhiteLabelPage'), { loading: PageLoader, ssr: false })
const VersionHistoryPage = dynamic(() => import('@/components/version-history/VersionHistoryPage'), { loading: PageLoader, ssr: false })
const ESignaturesPage = dynamic(() => import('@/components/esignatures/ESignaturesPage'), { loading: PageLoader, ssr: false })
const ClientPortalPage = dynamic(() => import('@/components/client-portal/ClientPortalPage'), { loading: PageLoader, ssr: false })
const MarketplacePage = dynamic(() => import('@/components/marketplace/MarketplacePage'), { loading: PageLoader, ssr: false })
const AgentsPage = dynamic(() => import('@/components/agents/AgentsPage'), { loading: PageLoader, ssr: false })
// NOTE: The old "Real Data Engine / Connections" page has been REMOVED per the
// stabilization directive. It displayed fake connection cards for GSTN, Bank,
// Gmail, WhatsApp, Tally, QuickBooks, and fake health indicators. The only
// real integrations are Google (→ google-workspace view) and Zoho Books
// (→ zoho-books view). Anywhere that used to navigate to 'connections' now
// routes to one of those real pages or shows the Integration Coming Soon modal.
const AISoftwareFactoryPage = dynamic(() => import('@/components/ai-software-factory/AISoftwareFactoryPage'), { loading: PageLoader, ssr: false })
const AutonomousEnterprisePage = dynamic(() => import('@/components/autonomous-enterprise/AutonomousEnterprisePage'), { loading: PageLoader, ssr: false })
const EnterpriseCloudPlatformPage = dynamic(() => import('@/components/enterprise-cloud-platform/EnterpriseCloudPlatformPage'), { loading: PageLoader, ssr: false })
const EnterpriseAIPlatformPage = dynamic(() => import('@/components/enterprise-ai-platform/EnterpriseAIPlatformPage'), { loading: PageLoader, ssr: false })
const GlobalEnterpriseNetworkPage = dynamic(() => import('@/components/global-enterprise-network/GlobalEnterpriseNetworkPage'), { loading: PageLoader, ssr: false })

// ═══ Phase 13 — Enterprise Collaboration, Multi-Company & Command Network™ ═══
const EnterpriseCommandCenterPage = dynamic(() => import('@/components/enterprise-network/EnterpriseCommandCenter'), { loading: PageLoader, ssr: false })
const MultiCompanyWorkspacePage = dynamic(() => import('@/components/enterprise-network/MultiCompanyWorkspace'), { loading: PageLoader, ssr: false })
const TeamCollaborationPage = dynamic(() => import('@/components/enterprise-network/TeamCollaboration'), { loading: PageLoader, ssr: false })
const WorkflowEnginePage = dynamic(() => import('@/components/enterprise-network/WorkflowEngine'), { loading: PageLoader, ssr: false })
// ═══ Phase Delta — Autonomous Finance OS (lazy-loaded, named exports) ═══
const AutonomousFinanceDashboard = dynamic(() => import('@/components/autonomous-finance/AutonomousFinanceDashboard').then(m => ({ default: m.AutonomousFinanceDashboard })), { loading: PageLoader, ssr: false })
const WorkflowStudioPage = dynamic(() => import('@/components/autonomous-finance/WorkflowStudioPage').then(m => ({ default: m.WorkflowStudioPage })), { loading: PageLoader, ssr: false })
const OracleActionsPanel = dynamic(() => import('@/components/autonomous-finance/OracleActionsPanel').then(m => ({ default: m.OracleActionsPanel })), { loading: PageLoader, ssr: false })
const FinancialIntelligencePage = dynamic(() => import('@/components/autonomous-finance/FinancialIntelligencePage').then(m => ({ default: m.FinancialIntelligencePage })), { loading: PageLoader, ssr: false })
const SmartReconciliationPage = dynamic(() => import('@/components/autonomous-finance/SmartReconciliationPage').then(m => ({ default: m.SmartReconciliationPage })), { loading: PageLoader, ssr: false })
const PredictiveCompliancePage = dynamic(() => import('@/components/autonomous-finance/PredictiveCompliancePage').then(m => ({ default: m.PredictiveCompliancePage })), { loading: PageLoader, ssr: false })
const IntelligentCollectionsPage = dynamic(() => import('@/components/autonomous-finance/IntelligentCollectionsPage').then(m => ({ default: m.IntelligentCollectionsPage })), { loading: PageLoader, ssr: false })
const OracleAIWorkspacePage = dynamic(() => import('@/components/oracle-ai/OracleAIWorkspacePage'), { loading: PageLoader, ssr: false })
// OracleBrain — the real AI brain (streaming chat + tools + memory). Replaces the
// legacy OracleBrainDashboard which was a static UI.
const OracleBrainPage = dynamic(() => import('@/components/oracle/OracleBrain'), { loading: PageLoader, ssr: false })
const GoogleWorkspacePage = dynamic(() => import('@/components/google-workspace/GoogleWorkspacePage'), { loading: PageLoader, ssr: false })
const ZohoBooksPage = dynamic(() => import('@/components/zoho-books/ZohoBooksPage'), { loading: PageLoader, ssr: false })
const EnterpriseDocumentsPage = dynamic(() => import('@/components/enterprise-network/EnterpriseDocuments'), { loading: PageLoader, ssr: false })
const ExecutiveCalendarPage = dynamic(() => import('@/components/enterprise-network/ExecutiveCalendar'), { loading: PageLoader, ssr: false })
const EnterpriseSearchPage = dynamic(() => import('@/components/enterprise-network/EnterpriseSearch'), { loading: PageLoader, ssr: false })
const EnterpriseNotificationsPage = dynamic(() => import('@/components/enterprise-network/EnterpriseNotifications'), { loading: PageLoader, ssr: false })
const AdvancedRBACPage = dynamic(() => import('@/components/enterprise-network/AdvancedRBAC'), { loading: PageLoader, ssr: false })
const CrossCompanyAnalyticsPage = dynamic(() => import('@/components/enterprise-network/CrossCompanyAnalytics'), { loading: PageLoader, ssr: false })
const EnterpriseAuditPage = dynamic(() => import('@/components/enterprise-network/EnterpriseAudit'), { loading: PageLoader, ssr: false })

// ═══ Phase 14 — Global Expansion & International Financial Operating System™ ═══
const MultiCountryAccountingPage = dynamic(() => import('@/components/global-expansion/MultiCountryAccounting'), { loading: PageLoader, ssr: false })
const MultiTaxEnginePage = dynamic(() => import('@/components/global-expansion/MultiTaxEngine'), { loading: PageLoader, ssr: false })
const MultiCurrencySystemPage = dynamic(() => import('@/components/global-expansion/MultiCurrencySystem'), { loading: PageLoader, ssr: false })
const InternationalBankingPage = dynamic(() => import('@/components/global-expansion/InternationalBanking'), { loading: PageLoader, ssr: false })
const GlobalComplianceEnginePage = dynamic(() => import('@/components/global-expansion/GlobalComplianceEngine'), { loading: PageLoader, ssr: false })
const InternationalERPPage = dynamic(() => import('@/components/global-expansion/InternationalERP'), { loading: PageLoader, ssr: false })
const MultiLanguagePlatformPage = dynamic(() => import('@/components/global-expansion/MultiLanguagePlatform'), { loading: PageLoader, ssr: false })
const AIGlobalAdvisorPage = dynamic(() => import('@/components/global-expansion/AIGlobalAdvisor'), { loading: PageLoader, ssr: false })
const GlobalDashboardPage = dynamic(() => import('@/components/global-expansion/GlobalDashboard'), { loading: PageLoader, ssr: false })
const CrossBorderPaymentsPage = dynamic(() => import('@/components/global-expansion/CrossBorderPayments'), { loading: PageLoader, ssr: false })
const InternationalReportsPage = dynamic(() => import('@/components/global-expansion/InternationalReports'), { loading: PageLoader, ssr: false })
const GlobalPerformancePage = dynamic(() => import('@/components/global-expansion/GlobalPerformance'), { loading: PageLoader, ssr: false })

// ═══ Phase 16 — Global Financial Cloud™, Open Platform & Developer Ecosystem™ ═══
const GlobalFinancialCloudHubPage = dynamic(() => import('@/components/global-cloud/GlobalFinancialCloudHub'), { loading: PageLoader, ssr: false })
const DeveloperPlatformPage = dynamic(() => import('@/components/global-cloud/DeveloperPlatform'), { loading: PageLoader, ssr: false })
const EnterpriseAPIGatewayPage = dynamic(() => import('@/components/global-cloud/EnterpriseAPIGateway'), { loading: PageLoader, ssr: false })
const AppMarketplaceCloudPage = dynamic(() => import('@/components/global-cloud/AppMarketplaceCloud'), { loading: PageLoader, ssr: false })
const GlobalIntegrationHubPage = dynamic(() => import('@/components/global-cloud/GlobalIntegrationHub'), { loading: PageLoader, ssr: false })
const FinancialDataCloudPage = dynamic(() => import('@/components/global-cloud/FinancialDataCloud'), { loading: PageLoader, ssr: false })
const EventStreamingPage = dynamic(() => import('@/components/global-cloud/EventStreaming'), { loading: PageLoader, ssr: false })
const AutomationStudioPage = dynamic(() => import('@/components/global-cloud/AutomationStudio'), { loading: PageLoader, ssr: false })
const DataWarehousePage = dynamic(() => import('@/components/global-cloud/DataWarehouse'), { loading: PageLoader, ssr: false })
const GlobalIdentityPage = dynamic(() => import('@/components/global-cloud/GlobalIdentity'), { loading: PageLoader, ssr: false })
const DeveloperAnalyticsPage = dynamic(() => import('@/components/global-cloud/DeveloperAnalytics'), { loading: PageLoader, ssr: false })
const EnterpriseBillingPage = dynamic(() => import('@/components/global-cloud/EnterpriseBilling'), { loading: PageLoader, ssr: false })
const MultiTenantInfraPage = dynamic(() => import('@/components/global-cloud/MultiTenantInfra'), { loading: PageLoader, ssr: false })
const EnterpriseSecurityCloudPage = dynamic(() => import('@/components/global-cloud/EnterpriseSecurityCloud'), { loading: PageLoader, ssr: false })
const GlobalFinancialNetworkPage = dynamic(() => import('@/components/global-cloud/GlobalFinancialNetwork'), { loading: PageLoader, ssr: false })
const PlatformIntelligencePage = dynamic(() => import('@/components/global-cloud/PlatformIntelligence'), { loading: PageLoader, ssr: false })

// ═══════════════════════════════════════════════════════════════════════════════
// VIEW → COMPONENT MAP
// A plain object lookup is faster than a 150-case switch and lets React skip
// re-renders when the view hasn't changed. The `default` fallback maps to the
// Mission Control dashboard.
// ═══════════════════════════════════════════════════════════════════════════════

const VIEW_COMPONENTS: Record<string, ComponentType<any>> = {
  dashboard: DashboardHomePage,
  returns: ReturnsPage,
  reconcile: ReconciliationPage,
  invoices: InvoiceWorkspacePage,
  vendors: GSTpilotVendorsView,
  expenses: GSTpilotExpensesView,
  clients: ClientRegistryPage,
  'client-workspace': ClientWorkspacePage,
  'return-prep': ReturnPrepWorkspace,
  settings: SettingsPage,
  'firm-command-center': FirmCommandCenterPage,
  'multi-firm': MultiFirmPage,
  autopilot: AutopilotPage,
  'ai-ca-manager': AICAManagerPage,
  'ai-account-manager': AIAccountManagerPage,
  'ai-deadline-engine': AIDeadlineEnginePage,
  'ai-document-employee': AIDocumentEmployeePage,
  'ai-voice-assistant': AIVoiceAssistantPage,
  'ai-firm-memory': AIFirmMemoryPage,
  'ai-operating-room': AIOperatingRoomPage,
  'ai-predictions': AIPredictionsPage,
  'ai-priority-engine': AIPriorityEnginePage,
  'business-graph': BusinessGraphPage,
  'data-moat': DataMoatPage,
  'embedded-finance': EmbeddedFinancePage,
  'working-capital': WorkingCapitalPage,
  'industry-benchmark': IndustryBenchmarkPage,
  'network-effects': NetworkEffectsPage,
  'ai-business-copilot': AIBusinessCopilotPage,
  'run-my-business': RunMyBusinessPage,
  'executive-war-room': ExecutiveWarRoomPage,
  'api-platform-v2': APIPlatformPage,
  'digital-twin': DigitalTwinPage,
  'event-engine': EventEnginePage,
  'agent-os': AgentOSPage,
  'decision-engine': DecisionEnginePage,
  'app-store': AppStorePage,
  'gstpilot-network': GSTPilotNetworkPage,
  'data-cloud': DataCloudPage,
  'run-india-business': RunIndiaBusinessPage,
  'universal-business-id': UniversalBusinessIDPage,
  'credit-scoring-engine': CreditScoringEnginePage,
  'invoice-exchange': InvoiceExchangePage,
  'financing-marketplace': FinancingMarketplacePage,
  'economic-graph': EconomicGraphPage,
  'economic-war-room': EconomicWarRoomPage,
  'run-my-company': RunMyCompanyPage,
  'business-dna': BusinessDNApage,
  'invoice-cloud': InvoiceCloudPage,
  'execution-engine': ExecutionEnginePage,
  'ai-cfo': AICFODashboardPage,
  // ═══ Recovered modules ═══
  reports: ReportsPage,
  'ai-reports': AIExecutiveReportsPage,
  'ai-compliance': AICompliancePage,
  'ai-risk': AIRiskEnginePage,
  'ai-insights': AIClientInsightsPage,
  'ai-tasks': AITaskGeneratorPage,
  'ai-benchmark': AIBenchmarkPage,
  'ai-knowledge': AIKnowledgeCenterPage,
  'ai-doc-chat': AIDocumentChatPage,
  notices: NoticeCenterPage,
  'gstr-filing': GSTRFilingPage,
  calendar: FilingCalendarPage,
  accounting: AccountingPage,
  payroll: PayrollPage,
  hrms: HRMSPage,
  inventory: GSTpilotProductsView,
  banking: BankingPage,
  'banking-intelligence': BankingIntelligencePage,
  payments: GSTpilotPaymentsView,
  'e-invoicing': EInvoicingPage,
  tds: TDSPage,
  'roc-compliance': ROCCompliancePage,
  'legal-notices': LegalNoticesPage,
  team: TeamManagementPage,
  'team-performance': TeamPerformancePage,
  'firm-operations': FirmOperationsPage,
  workload: WorkloadPage,
  review: ReviewPage,
  deadlines: DeadlineCenterPage,
  'client-health': ClientHealthPage,
  'executive-analytics': ExecutiveAnalyticsPage,
  analytics: AnalyticsPage,
  timeline: TimelinePage,
  tasks: TasksPage,
  documents: DocumentVaultPage,
  collaboration: CollaborationPage,
  crm: GSTpilotCustomersView,
  approvals: ApprovalsPage,
  automations: AutomationsPage,
  'automation-center': AutomationCenterPage,
  'audit-resolution': ErrorResolutionPage,
  'audit-trail': AuditLogsPage,
  billing: BillingPage,
  'white-label': WhiteLabelPage,
  'version-history': VersionHistoryPage,
  esignatures: ESignaturesPage,
  'client-portal': ClientPortalPage,
  marketplace: MarketplacePage,
  agents: AgentsPage,
  // NOTE: 'connections' view intentionally omitted — the Real Data Engine
  // page has been removed. Callers that still pass 'connections' will fall
  // through to the default GoogleWorkspacePage (a real integration page).
  'ai-software-factory': AISoftwareFactoryPage,
  'autonomous-enterprise': AutonomousEnterprisePage,
  'enterprise-cloud-platform': EnterpriseCloudPlatformPage,
  'enterprise-ai-platform': EnterpriseAIPlatformPage,
  'global-enterprise-network': GlobalEnterpriseNetworkPage,
  generate: GenerateWorkbench,
  // Phase 13 — Enterprise Collaboration
  'enterprise-command-center': EnterpriseCommandCenterPage,
  'multi-company-workspace': MultiCompanyWorkspacePage,
  'team-collaboration': TeamCollaborationPage,
  'workflow-engine': WorkflowEnginePage,
  'enterprise-documents': EnterpriseDocumentsPage,
  'executive-calendar': ExecutiveCalendarPage,
  'enterprise-search': EnterpriseSearchPage,
  'enterprise-notifications': EnterpriseNotificationsPage,
  'advanced-rbac': AdvancedRBACPage,
  'cross-company-analytics': CrossCompanyAnalyticsPage,
  'enterprise-audit': EnterpriseAuditPage,
  // Phase 14 — Global Expansion
  'multi-country-accounting': MultiCountryAccountingPage,
  'multi-tax-engine': MultiTaxEnginePage,
  'multi-currency-system': MultiCurrencySystemPage,
  'international-banking': InternationalBankingPage,
  'global-compliance-engine': GlobalComplianceEnginePage,
  'international-erp': InternationalERPPage,
  'multi-language-platform': MultiLanguagePlatformPage,
  'ai-global-advisor': AIGlobalAdvisorPage,
  'global-dashboard': GlobalDashboardPage,
  'cross-border-payments': CrossBorderPaymentsPage,
  'international-reports': InternationalReportsPage,
  'global-performance': GlobalPerformancePage,
  // Phase 16 — Global Financial Cloud
  'global-financial-cloud': GlobalFinancialCloudHubPage,
  'developer-platform': DeveloperPlatformPage,
  'enterprise-api-gateway': EnterpriseAPIGatewayPage,
  'app-marketplace-cloud': AppMarketplaceCloudPage,
  'global-integration-hub': GlobalIntegrationHubPage,
  'financial-data-cloud': FinancialDataCloudPage,
  'event-streaming': EventStreamingPage,
  'automation-studio': AutomationStudioPage,
  'data-warehouse': DataWarehousePage,
  'global-identity': GlobalIdentityPage,
  'developer-analytics': DeveloperAnalyticsPage,
  'enterprise-billing': EnterpriseBillingPage,
  'multi-tenant-infra': MultiTenantInfraPage,
  'enterprise-security-cloud': EnterpriseSecurityCloudPage,
  'global-financial-network': GlobalFinancialNetworkPage,
  'platform-intelligence': PlatformIntelligencePage,
  // Phase Delta — Autonomous Finance OS
  'autonomous-finance': AutonomousFinanceDashboard,
  'workflow-studio': WorkflowStudioPage,
  'oracle-actions': OracleActionsPanel,
  'financial-intelligence': FinancialIntelligencePage,
  'smart-reconciliation': SmartReconciliationPage,
  'predictive-compliance': PredictiveCompliancePage,
  'intelligent-collections': IntelligentCollectionsPage,
  // Phase Oracle-AI — Enterprise AI Intelligence Layer
  'oracle-intelligence': OracleAIWorkspacePage,
  // Oracle Intelligence — The real AI Brain (streaming chat, tools, memory, reasoning)
  'oracle-brain': OracleBrainPage,
  // Phase Google Workspace — Enterprise Integration
  'google-workspace': GoogleWorkspacePage,
  // Phase Zoho Books — Accounting Integration (OAuth)
  'zoho-books': ZohoBooksPage,
}

// ═══════════════════════════════════════════════════════════════════════════════
// REAL VIEWS — only these have genuine, working implementations.
// Everything else routes to FeaturePlaceholder (one premium "on the roadmap"
// page). This eliminates 60+ inconsistent "Coming Soon" pages instantly.
// ═══════════════════════════════════════════════════════════════════════════════

const REAL_VIEWS = new Set<string>([
  'dashboard',
  'crm',                      // Customers (real Firestore CRUD)
  'clients',                  // Client registry (legacy alias)
  'client-workspace',         // Client detail
  'invoices',                 // Invoice workspace (real)
  'invoice-cloud',            // (alias handled)
  'returns',                  // Returns list (real)
  'return-prep',              // Return prep workspace (real)
  'reconcile',                // Reconciliation (real)
  'vendors',                  // Vendors (real Firestore CRUD)
  'expenses',                 // Expenses (real)
  'payments',                 // Payments (real)
  'inventory',                // Products / inventory (real)
  'banking-intelligence',     // Banking Intelligence (Priority 3 — modular banking module, mock→Setu)
  'settings',                 // Settings (real)
  'google-workspace',         // Google integration (real OAuth)
  'zoho-books',               // Zoho Books integration (real OAuth + sync)
  'timeline',                 // Activity timeline (real)
  'tasks',                    // Tasks (real)
  'documents',                // Document vault (real)
  'notices',                  // Notice center (real)
  'ai-business-copilot',      // Oracle chat (real — reads Business Snapshot)
  'ai-cfo',                   // AI CFO dashboard (reads snapshot)
  'oracle-brain',             // Oracle Brain — streaming chat + tools + memory + sessions
])

// ── Feature placeholder metadata for known non-working views ──────────────────
// This gives the placeholder page a proper title, icon, and description instead
// of a generic "feature not found" message.

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
    icon: FileText,
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
    icon: Users,
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
// DashboardViewRenderer — the actual component consumed by page.tsx
// ═══════════════════════════════════════════════════════════════════════════════

export default function DashboardViews({ view }: { view: string }) {
  // The deleted 'connections' view must never render — redirect to Google.
  const safeView = view === 'connections' ? 'google-workspace' : view;

  // If this is a REAL working view, render its component.
  if (REAL_VIEWS.has(safeView)) {
    const Component = VIEW_COMPONENTS[safeView];
    if (Component) return <Component />;
  }

  // Everything else → ONE premium FeaturePlaceholder page.
  // This replaces 60+ inconsistent "Coming Soon" pages with a single,
  // beautiful, honest "on the roadmap" page.
  const meta = PLACEHOLDER_META[safeView];
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

  // Unknown view with no metadata → generic placeholder.
  return (
    <FeaturePlaceholder
      featureName="This module is on the roadmap"
      description="GSTPilot is focused on delivering a polished experience for the features that are live today. This module will be built once the core is rock-solid."
      icon={Sparkles}
    />
  )
}

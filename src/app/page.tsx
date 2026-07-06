'use client'

import React, { useEffect, useState } from 'react'
import { useApp } from '@/contexts/AppContext'
import { useAuth } from '@/contexts/AuthContext'
import { useOrg } from '@/contexts/OrgContext'
import dynamic from 'next/dynamic'

// ═══════════════════════════════════════════════════════════════════════════════
// LAZY-LOADED PAGE COMPONENTS — next/dynamic so only the active view compiles.
// Cuts initial compile memory by ~90%. UI behaves identically.
// ═══════════════════════════════════════════════════════════════════════════════

const PageLoader = () => (
  <div className="flex h-full min-h-[60vh] items-center justify-center">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
  </div>
)


const ReturnsPage = dynamic(() => import('@/components/returns/ReturnsPage'), { loading: PageLoader, ssr: false })
const ReconciliationPage = dynamic(() => import('@/components/reconciliation/ReconciliationPage'), { loading: PageLoader, ssr: false })
const InvoiceWorkspacePage = dynamic(() => import('@/components/invoices/InvoiceWorkspacePage'), { loading: PageLoader, ssr: false })
const ClientRegistryPage = dynamic(() => import('@/components/clients/ClientRegistryPage'), { loading: PageLoader, ssr: false })
const ClientWorkspacePage = dynamic(() => import('@/components/clients/ClientWorkspacePage'), { loading: PageLoader, ssr: false })
const ReturnPrepWorkspace = dynamic(() => import('@/components/returns/ReturnPrepWorkspace'), { loading: PageLoader, ssr: false })
const SettingsPage = dynamic(() => import('@/components/settings/SettingsPage'), { loading: PageLoader, ssr: false })
const LandingPage = dynamic(() => import('@/components/landing/LandingPage'), { loading: PageLoader, ssr: false })
const LoginPage = dynamic(() => import('@/components/auth/LoginPage'), { loading: PageLoader, ssr: false })
const OnboardingFlow = dynamic(() => import('@/components/onboarding/OnboardingFlow').then(m => ({ default: m.OnboardingFlow })), { loading: PageLoader, ssr: false })
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
const ConnectionsPage = dynamic(() => import('@/components/connections/ConnectionsPage'), { loading: PageLoader, ssr: false })
const AISoftwareFactoryPage = dynamic(() => import('@/components/ai-software-factory/AISoftwareFactoryPage'), { loading: PageLoader, ssr: false })
const AutonomousEnterprisePage = dynamic(() => import('@/components/autonomous-enterprise/AutonomousEnterprisePage'), { loading: PageLoader, ssr: false })
const EnterpriseCloudPlatformPage = dynamic(() => import('@/components/enterprise-cloud-platform/EnterpriseCloudPlatformPage'), { loading: PageLoader, ssr: false })
const EnterpriseAIPlatformPage = dynamic(() => import('@/components/enterprise-ai-platform/EnterpriseAIPlatformPage'), { loading: PageLoader, ssr: false })
const GlobalEnterpriseNetworkPage = dynamic(() => import('@/components/global-enterprise-network/GlobalEnterpriseNetworkPage'), { loading: PageLoader, ssr: false })

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Zap, LogOut, User, Settings, MailCheck, Search, Bell, Sun, Moon } from 'lucide-react'
import { useTheme } from 'next-themes'
import { LeftNav } from '@/components/layout/LeftNav'
import { FloatingDock } from '@/components/layout/FloatingDock'
import { NotificationsSheet } from '@/components/layout/NotificationsSheet'
import { OraclePanel } from '@/components/oracle/OraclePanel'
import { OracleDockSidebar, readInitialOracleState } from '@/components/oracle/OracleDockSidebar'
import { BrandLogo } from '@/components/brand'
import { AmbientBackground } from '@/components/layout/AmbientBackground'
import CommandPalette from '@/components/command-palette/CommandPalette'

// ═══ Recovered modules — previously disconnected from the router ═══

const VIEW_TITLES: Record<string, string> = {
  dashboard: 'Mission Control',
  'business-dna': 'Business DNA',
  'invoice-cloud': 'Invoice Cloud',
  'execution-engine': 'Execution Engine',
  'ai-cfo': 'AI CFO',
  returns: 'Returns',
  reconcile: 'Reconcile',
  invoices: 'Invoices',
  clients: 'Clients',
  settings: 'Settings',
  'client-workspace': 'Client Workspace',
  'return-prep': 'Return Preparation',
  'firm-command-center': 'AI CEO',
  'multi-firm': 'Multi-Firm',
  autopilot: 'RUN MY FIRM',
  'ai-ca-manager': 'AI CA Manager',
  'ai-account-manager': 'AI Account Manager',
  'ai-deadline-engine': 'AI Deadline Engine',
  'ai-document-employee': 'AI Doc Employee',
  'ai-voice-assistant': 'AI Voice Assistant',
  'ai-firm-memory': 'AI Firm Memory',
  'ai-operating-room': 'AI Operating Room',
  'ai-predictions': 'AI Predictions',
  'ai-priority-engine': 'AI Priority Engine',
  'business-graph': 'Business Graph',
  'data-moat': 'Data Moat',
  'embedded-finance': 'Payments™',
  'industry-benchmark': 'Industry Benchmark',
  'working-capital': 'Working Capital',
  'ai-business-copilot': 'AI Business Copilot',
  'run-my-business': 'RUN MY BUSINESS™',
  'network-effects': 'Network Effects',
  'executive-war-room': 'EXECUTIVE WAR ROOM',
  'api-platform-v2': 'API PLATFORM™',
  'digital-twin': 'BUSINESS DIGITAL TWIN™',
  'event-engine': 'Event Engine',
  'agent-os': 'AI Agent OS',
  'decision-engine': 'AI DECISION ENGINE™',
  'app-store': 'APP STORE™',
  'gstpilot-network': 'GSTPILOT NETWORK™',
  'data-cloud': 'FINANCIAL DATA CLOUD™',
  'run-india-business': "RUN INDIA'S BUSINESS™",
  'universal-business-id': 'UNIVERSAL BUSINESS ID™',
  'credit-scoring-engine': 'CREDIT SCORING ENGINE™',
  'invoice-exchange': 'INVOICE EXCHANGE™',
  'financing-marketplace': 'FINANCING MARKETPLACE™',
  'economic-graph': 'ECONOMIC GRAPH™',
  'economic-war-room': 'ECONOMIC WAR ROOM™',
  'run-my-company': 'RUN MY COMPANY™',
  // ═══ Recovered module titles ═══
  reports: 'Reports',
  'ai-reports': 'AI Executive Reports',
  'ai-compliance': 'AI Compliance',
  'ai-risk': 'AI Risk Engine',
  'ai-insights': 'AI Client Insights',
  'ai-tasks': 'AI Task Generator',
  'ai-benchmark': 'AI Benchmark',
  'ai-knowledge': 'AI Knowledge Center',
  'ai-doc-chat': 'AI Document Chat',
  notices: 'Notice Center',
  'gstr-filing': 'GSTR Filing',
  calendar: 'Filing Calendar',
  accounting: 'Accounting',
  payroll: 'Payroll',
  hrms: 'HRMS',
  inventory: 'Inventory',
  banking: 'Banking',
  payments: 'Payments',
  'e-invoicing': 'E-Invoicing',
  tds: 'TDS',
  'roc-compliance': 'ROC Compliance',
  'legal-notices': 'Legal Notices',
  team: 'Team',
  'team-performance': 'Team Performance',
  'firm-operations': 'Firm Operations',
  workload: 'Workload',
  review: 'Review',
  deadlines: 'Deadline Center',
  'client-health': 'Client Health',
  'executive-analytics': 'Executive Analytics',
  analytics: 'Analytics',
  timeline: 'Timeline',
  tasks: 'Tasks',
  documents: 'Document Vault',
  collaboration: 'Collaboration',
  crm: 'CRM',
  approvals: 'Approvals',
  automations: 'Automations',
  'automation-center': 'Automation Center',
  'audit-resolution': 'Error Resolution',
  'audit-trail': 'Audit Logs',
  billing: 'Billing',
  'white-label': 'White Label',
  'version-history': 'Version History',
  esignatures: 'E-Signatures',
  'client-portal': 'Client Portal',
  marketplace: 'Marketplace',
  agents: 'Agents',
  connections: 'Connections',
  'ai-software-factory': 'AI Software Factory™',
  'autonomous-enterprise': 'Autonomous Enterprise™',
  'enterprise-cloud-platform': 'Enterprise Cloud Platform™',
  'enterprise-ai-platform': 'Enterprise AI Platform™',
  'global-enterprise-network': 'Global Enterprise Network™',
}

function DashboardContent() {
  const { currentView, setCurrentView } = useApp()
  const { user, logout } = useAuth()

  // ── Oracle docked sidebar state (persisted to localStorage) ──────────────────
  // Lazy initial state — readInitialOracleState is SSR-safe (returns false on
  // the server) so this avoids the cascading-render effect entirely.
  const [oracleOpen, setOracleOpen] = useState(readInitialOracleState)
  const [notificationsOpen, setNotificationsOpen] = useState(false)

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <MissionControlPage />
      case 'returns':
        return <ReturnsPage />
      case 'reconcile':
        return <ReconciliationPage />
      case 'invoices':
        return <InvoiceWorkspacePage />
      case 'clients':
        return <ClientRegistryPage />
      case 'client-workspace':
        return <ClientWorkspacePage />
      case 'return-prep':
        return <ReturnPrepWorkspace />
      case 'settings':
        return <SettingsPage />
      case 'firm-command-center':
        return <FirmCommandCenterPage />
      case 'multi-firm':
        return <MultiFirmPage />
      case 'autopilot':
        return <AutopilotPage />
      case 'ai-ca-manager':
        return <AICAManagerPage />
      case 'ai-account-manager':
        return <AIAccountManagerPage />
      case 'ai-deadline-engine':
        return <AIDeadlineEnginePage />
      case 'ai-document-employee':
        return <AIDocumentEmployeePage />
      case 'ai-voice-assistant':
        return <AIVoiceAssistantPage />
      case 'ai-firm-memory':
        return <AIFirmMemoryPage />
      case 'ai-operating-room':
        return <AIOperatingRoomPage />
      case 'ai-predictions':
        return <AIPredictionsPage />
      case 'ai-priority-engine':
        return <AIPriorityEnginePage />
      case 'business-graph':
        return <BusinessGraphPage />
      case 'data-moat':
        return <DataMoatPage />
      case 'embedded-finance':
        return <EmbeddedFinancePage />
      case 'working-capital':
        return <WorkingCapitalPage />
      case 'industry-benchmark':
        return <IndustryBenchmarkPage />
      case 'network-effects':
        return <NetworkEffectsPage />
      case 'ai-business-copilot':
        return <AIBusinessCopilotPage />
      case 'run-my-business':
        return <RunMyBusinessPage />
      case 'executive-war-room':
        return <ExecutiveWarRoomPage />
      case 'api-platform-v2':
        return <APIPlatformPage />
      case 'digital-twin':
        return <DigitalTwinPage />
      case 'event-engine':
        return <EventEnginePage />
      case 'agent-os':
        return <AgentOSPage />
      case 'decision-engine':
        return <DecisionEnginePage />
      case 'app-store':
        return <AppStorePage />
      case 'gstpilot-network':
        return <GSTPilotNetworkPage />
      case 'data-cloud':
        return <DataCloudPage />
      case 'run-india-business':
        return <RunIndiaBusinessPage />
      case 'universal-business-id':
        return <UniversalBusinessIDPage />
      case 'credit-scoring-engine':
        return <CreditScoringEnginePage />
      case 'invoice-exchange':
        return <InvoiceExchangePage />
      case 'financing-marketplace':
        return <FinancingMarketplacePage />
      case 'economic-graph':
        return <EconomicGraphPage />
      case 'economic-war-room':
        return <EconomicWarRoomPage />
      case 'run-my-company':
        return <RunMyCompanyPage />
      case 'business-dna':
        return <BusinessDNApage />
      case 'invoice-cloud':
        return <InvoiceCloudPage />
      case 'execution-engine':
        return <ExecutionEnginePage />
      case 'ai-cfo':
        return <AICFODashboardPage />
      // ═══ Recovered modules — previously fell to default ═══
      case 'reports':
        return <ReportsPage />
      case 'ai-reports':
        return <AIExecutiveReportsPage />
      case 'ai-compliance':
        return <AICompliancePage />
      case 'ai-risk':
        return <AIRiskEnginePage />
      case 'ai-insights':
        return <AIClientInsightsPage />
      case 'ai-tasks':
        return <AITaskGeneratorPage />
      case 'ai-benchmark':
        return <AIBenchmarkPage />
      case 'ai-knowledge':
        return <AIKnowledgeCenterPage />
      case 'ai-doc-chat':
        return <AIDocumentChatPage />
      case 'notices':
        return <NoticeCenterPage />
      case 'gstr-filing':
        return <GSTRFilingPage />
      case 'calendar':
        return <FilingCalendarPage />
      case 'accounting':
        return <AccountingPage />
      case 'payroll':
        return <PayrollPage />
      case 'hrms':
        return <HRMSPage />
      case 'inventory':
        return <InventoryPage />
      case 'banking':
        return <BankingPage />
      case 'payments':
        return <PaymentsPage />
      case 'e-invoicing':
        return <EInvoicingPage />
      case 'tds':
        return <TDSPage />
      case 'roc-compliance':
        return <ROCCompliancePage />
      case 'legal-notices':
        return <LegalNoticesPage />
      case 'team':
        return <TeamManagementPage />
      case 'team-performance':
        return <TeamPerformancePage />
      case 'firm-operations':
        return <FirmOperationsPage />
      case 'workload':
        return <WorkloadPage />
      case 'review':
        return <ReviewPage />
      case 'deadlines':
        return <DeadlineCenterPage />
      case 'client-health':
        return <ClientHealthPage />
      case 'executive-analytics':
        return <ExecutiveAnalyticsPage />
      case 'analytics':
        return <AnalyticsPage />
      case 'timeline':
        return <TimelinePage />
      case 'tasks':
        return <TasksPage />
      case 'documents':
        return <DocumentVaultPage />
      case 'collaboration':
        return <CollaborationPage />
      case 'crm':
        return <CRMPage />
      case 'approvals':
        return <ApprovalsPage />
      case 'automations':
        return <AutomationsPage />
      case 'automation-center':
        return <AutomationCenterPage />
      case 'audit-resolution':
        return <ErrorResolutionPage />
      case 'audit-trail':
        return <AuditLogsPage />
      case 'billing':
        return <BillingPage />
      case 'white-label':
        return <WhiteLabelPage />
      case 'version-history':
        return <VersionHistoryPage />
      case 'esignatures':
        return <ESignaturesPage />
      case 'client-portal':
        return <ClientPortalPage />
      case 'marketplace':
        return <MarketplacePage />
      case 'agents':
        return <AgentsPage />
      case 'connections':
        return <ConnectionsPage />
      case 'ai-software-factory':
        return <AISoftwareFactoryPage />
      case 'autonomous-enterprise':
        return <AutonomousEnterprisePage />
      case 'enterprise-cloud-platform':
        return <EnterpriseCloudPlatformPage />
      case 'enterprise-ai-platform':
        return <EnterpriseAIPlatformPage />
      case 'global-enterprise-network':
        return <GlobalEnterpriseNetworkPage />
      case 'generate':
        return <GenerateWorkbench />
      default:
        return <MissionControlPage />
    }
  }

  const userInitials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : 'U'

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-background">
      {/* ═══ V16 Ambient Background — aurora + particles + network lines ═══ */}
      <AmbientBackground />

      {/* ═══ TOP BAR ═══ */}
      <header className="relative z-10 flex h-14 shrink-0 items-center gap-3 border-b border-white/[0.06] bg-background/60 px-4 backdrop-blur-xl md:px-6">
        {/* Brand + subtitle — official GSTPilot winged logo */}
        <button
          onClick={() => setCurrentView('dashboard')}
          className="flex items-center gap-2.5 rounded-lg outline-none transition-opacity hover:opacity-80"
          aria-label="GSTPilot Infinity — Home"
        >
          <BrandLogo variant="icon" theme="dark" size={28} animated={false} disableGlow />
          <div className="hidden flex-col items-start leading-none sm:flex">
            <span className="text-sm font-semibold tracking-tight text-foreground">
              GSTPilot Infinity<span className="accent-text">™</span>
            </span>
            <span className="text-[10px] font-medium text-muted-foreground">
              The Financial Brain of India
            </span>
          </div>
        </button>

        {/* Right cluster: Search · Notifications · Theme · Profile */}
        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
            className="flex h-8 items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 text-xs text-muted-foreground transition-colors hover:bg-white/[0.07] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
            aria-label="Search"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Search</span>
            <kbd className="hidden rounded bg-white/[0.06] px-1 py-0.5 text-[9px] font-semibold sm:inline">⌘K</kbd>
          </button>
          <button
            onClick={() => { setNotificationsOpen(true); setOracleOpen(false) }}
            className="relative flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/[0.05] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-cyan-400" />
          </button>
          <ThemeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg px-1.5 py-1 outline-none transition-colors hover:bg-white/[0.05]">
              <Avatar className="h-7 w-7">
                <AvatarImage src={user?.picture} alt={user?.name || 'User'} />
                <AvatarFallback className="accent-gradient-soft accent-text text-[11px] font-semibold">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <span className="hidden text-xs font-medium text-foreground sm:inline">
                {user?.name?.split(' ')[0] || 'User'}
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="flex items-center gap-2 p-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user?.picture} alt={user?.name || 'User'} />
                  <AvatarFallback className="accent-gradient-soft accent-text text-xs font-semibold">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{user?.name || 'User'}</p>
                  <p className="text-xs text-muted-foreground truncate">{user?.email || ''}</p>
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-2" onClick={() => setCurrentView('settings')}>
                <User className="h-4 w-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2" onClick={() => setCurrentView('settings')}>
                <Settings className="h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} className="gap-2 text-red-400 focus:text-red-300 focus:bg-red-500/10">
                <LogOut className="h-4 w-4" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* ═══ TWO-COLUMN WORKSPACE ═══ */}
      <div className="relative z-10 flex min-h-0 flex-1 gap-3 p-3">
        {/* LEFT NAV */}
        <div className="shrink-0">
          <LeftNav />
        </div>

        {/* MAIN WORKSPACE */}
        <main className="min-w-0 flex-1 overflow-y-auto rounded-3xl pb-24 custom-scrollbar">
          {renderView()}
        </main>
      </div>

      {/* ═══ PREMIUM FLOATING DOCK (Oracle · Notifications · Help) ═══ */}
      <FloatingDock
        onOracleToggle={() => {
          setOracleOpen((v) => !v)
          setNotificationsOpen(false)
        }}
        oracleOpen={oracleOpen}
        onNotificationsToggle={() => {
          setNotificationsOpen((v) => !v)
          setOracleOpen(false)
        }}
        notificationsOpen={notificationsOpen}
      />

      {/* ═══ ORACLE DOCKED SIDEBAR (slide-in right on desktop, bottom sheet on mobile) ═══ */}
      <OracleDockSidebar
        open={oracleOpen}
        onClose={() => setOracleOpen(false)}
      >
        <OraclePanel onNavigate={(view) => { setCurrentView(view); setOracleOpen(false) }} />
      </OracleDockSidebar>

      {/* ═══ NOTIFICATIONS SHEET (wired to /api/notifications) ═══ */}
      <NotificationsSheet
        open={notificationsOpen}
        onOpenChange={setNotificationsOpen}
        userId={user?.id}
      />

      {/* ═══ COMMAND PALETTE (⌘K) ═══ */}
      <CommandPalette />
    </div>
  )
}

// ─── Theme Toggle (inline) ─────────────────────────────────────────────────────
function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const isDark = theme === 'dark'
  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/[0.05] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
      aria-label="Toggle theme"
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  )
}

function EmailVerificationBanner() {
  const { user, logout } = useAuth()
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  const handleResend = async () => {
    setSending(true)
    try {
      const { sendVerificationEmail } = await import('@/lib/auth')
      const { error } = await sendVerificationEmail()
      if (!error) setSent(true)
    } catch {
      // ignore
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="bg-cyan-500/10 border-b border-cyan-500/25 px-4 py-3">
      <div className="flex items-center justify-between gap-3 max-w-7xl mx-auto">
        <div className="flex items-center gap-2.5">
          <MailCheck className="h-5 w-5 text-cyan-300 shrink-0" />
          <p className="text-sm text-cyan-100">
            {sent
              ? 'Verification email sent! Check your inbox.'
              : 'Please verify your email address to access all features.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!sent && (
            <button
              onClick={handleResend}
              disabled={sending}
              className="text-xs font-semibold text-cyan-200 hover:text-cyan-100 underline disabled:opacity-50"
            >
              {sending ? 'Sending...' : 'Resend email'}
            </button>
          )}
          <button
            onClick={logout}
            className="text-xs text-cyan-300 hover:text-cyan-100 font-medium"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}

function OnboardingScreen() {
  const { user } = useAuth()
  const { completeOnboarding } = useOrg()
  const { setCurrentScreen, setCurrentView } = useApp()
  const [saveError, setSaveError] = React.useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  // ── Create the organization + owner membership via the org service ──
  const createOrganizationForUser = async (
    data: import('@/components/onboarding/OnboardingFlow').OnboardingData
  ): Promise<{ orgId: string | null; error: string | null }> => {
    if (!user) return { orgId: null, error: 'No authenticated user found.' }

    const { createOrganization, updateUserProfile } = await import('@/lib/auth/organizations')
    const { doc, setDoc, serverTimestamp } = await import('firebase/firestore')
    const { db } = await import('@/lib/firebase')

    // 1. Create the organization + owner membership + set currentOrganizationId.
    const { organization, error: orgError } = await createOrganization({
      name: data.firmName,
      ownerId: user.id,
      ownerEmail: user.email,
      ownerDisplayName: data.fullName || user.name,
      ownerPhotoURL: user.picture || null,
      gstin: data.gstin || null,
      plan: 'free',
    })
    if (orgError || !organization) {
      return { orgId: null, error: orgError || 'Could not create your organization.' }
    }

    // 2. Enrich the user profile with onboarding metadata (best-effort).
    try {
      await updateUserProfile(user.id, {
        displayName: data.fullName,
        phone: data.phone,
        company: data.firmName,
        gstin: data.gstin || null,
      })
      // Persist the extended onboarding questionnaire for analytics.
      await setDoc(doc(db, 'onboarding', user.id), {
        ...data,
        organizationId: organization.id,
        completedAt: serverTimestamp(),
      }, { merge: true })
    } catch (err) {
      console.warn('[Onboarding] Profile enrichment failed:', err)
    }

    return { orgId: organization.id, error: null }
  }

  const handleOnboardingComplete = async (
    data: import('@/components/onboarding/OnboardingFlow').OnboardingData,
    destination?: import('@/components/onboarding/OnboardingFlow').OnboardingDestination
  ) => {
    setSaveError(null)
    if (!user) {
      setSaveError('No authenticated user found. Please sign in again.')
      return
    }

    setIsSubmitting(true)
    try {
      const { orgId, error: createError } = await createOrganizationForUser(data)
      if (createError || !orgId) {
        setSaveError(createError || 'Could not create your organization. Please try again.')
        setIsSubmitting(false)
        return
      }

      // Reload the org context so the rest of the app sees the new org.
      await completeOnboarding(orgId)

      // Navigate to the chosen destination.
      setCurrentView(destination || 'dashboard')
      setCurrentScreen('app')
    } catch (err) {
      setSaveError(
        err instanceof Error
          ? err.message
          : 'Something went wrong while setting up your workspace.'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSkip = async () => {
    setSaveError(null)
    if (!user) {
      setSaveError('No authenticated user found. Please sign in again.')
      return
    }

    setIsSubmitting(true)
    try {
      // Skipping still requires an organization — create a default one
      // using the user's name so the app is fully functional.
      const { createOrganization } = await import('@/lib/auth/organizations')
      const { organization, error: orgError } = await createOrganization({
        name: `${user.name}'s Workspace`,
        ownerId: user.id,
        ownerEmail: user.email,
        ownerDisplayName: user.name,
        ownerPhotoURL: user.picture || null,
        gstin: null,
        plan: 'free',
      })
      if (orgError || !organization) {
        setSaveError(orgError || 'Could not create your workspace. Please try again.')
        setIsSubmitting(false)
        return
      }
      await completeOnboarding(organization.id)
      setCurrentView('dashboard')
      setCurrentScreen('app')
    } catch (err) {
      setSaveError(
        err instanceof Error
          ? err.message
          : 'Something went wrong while setting up your workspace.'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <OnboardingFlow
      onComplete={handleOnboardingComplete}
      onSkip={handleSkip}
      userEmail={user?.email}
      userName={user?.name}
      error={saveError}
      onDismissError={() => setSaveError(null)}
    />
  )
}

function AppRouter() {
  const { currentScreen, setCurrentScreen } = useApp()
  const { isAuthenticated, isInitializing, needsEmailVerification } = useAuth()
  // ── PART 3 / PART 5 ── The org context is the source of truth for whether
  // the user has an organization. `needsOrganization` becomes the new
  // "needs onboarding" gate. `orgLoading` lets us hold the protected routes
  // until the tenant context is fully resolved so no page ever renders with a
  // null organizationId.
  const { needsOrganization, loading: orgLoading, organization, error: orgError, reload: reloadOrg } = useOrg()

  // Derived: a user needs onboarding when authenticated but without an org.
  const needsOnboarding = isAuthenticated && needsOrganization

  useEffect(() => {
    if (isInitializing) return
    // Only auto-redirect to the app when: authenticated, org context resolved,
    // and the user actually has an organization. Otherwise the OnboardingScreen
    // handles its own navigation.
    if (isAuthenticated && !needsOnboarding && !orgLoading && currentScreen !== 'app') {
      setCurrentScreen('app')
    }
  }, [isAuthenticated, isInitializing, currentScreen, setCurrentScreen, needsOnboarding, orgLoading])

  useEffect(() => {
    if (isInitializing) return
    // ── PART 5 ── Protected routes: kick unauthenticated users back to landing.
    if (!isAuthenticated && currentScreen === 'app') {
      setCurrentScreen('landing')
    }
  }, [isAuthenticated, isInitializing, currentScreen, setCurrentScreen])

  const handleGetStarted = () => setCurrentScreen('login')
  const handleBookDemo = () => setCurrentScreen('login')
  const handleBackToLanding = () => setCurrentScreen('landing')

  // ── PART 7 ── Loading state while authentication initializes.
  if (isInitializing && !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl glass-surface motion-pulse">
            <Zap className="h-5 w-5 accent-text" />
          </div>
          <span className="text-sm text-white/55 font-medium">Loading GSTPilot…</span>
        </div>
      </div>
    )
  }

  // ── PART 7 ── While the org context is resolving after auth, show a brief
  // loader so protected pages never mount with a null organization.
  if (isAuthenticated && orgLoading && !needsOnboarding) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl glass-surface motion-pulse">
            <Zap className="h-5 w-5 accent-text" />
          </div>
          <span className="text-sm text-white/55 font-medium">Loading your workspace…</span>
        </div>
      </div>
    )
  }

  // ── PART 2 ── Authenticated but no organization → onboarding creates one.
  // BUT: if there was a load error (e.g. Firestore unreachable), show a retry
  // screen instead of onboarding — onboarding would also fail to write.
  if (needsOnboarding && !orgError) {
    return <OnboardingScreen />
  }

  // ── PART 8 ── Org context failed to load after retries. Show a friendly
  // error with a retry button — BUT never for permission errors. Permission
  // errors mean the user is in preview/offline mode; OrgContext already falls
  // back to a demo org in that case, so we treat any residual permission error
  // as "preview mode" and render the app shell with empty states.
  const isOrgPermissionError = !!orgError && (
    /permission|insufficient|unauthenticated|not authorized|missing or/i.test(orgError)
  )
  if (isAuthenticated && !orgLoading && orgError && !organization && !isOrgPermissionError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black p-6">
        <div className="flex flex-col items-center gap-5 max-w-md text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/10 border border-red-500/20">
            <Zap className="h-6 w-6 text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-white">Couldn&apos;t load your workspace</h2>
          <p className="text-sm text-white/55 leading-relaxed">
            {orgError}
          </p>
          <button
            onClick={() => reloadOrg()}
            className="mt-2 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-black hover:bg-white/90 transition-colors"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  // ── PART 5 ── Protected route: render the app shell when authenticated AND
  // (the organization is loaded OR we're in preview/permission-error mode).
  // This guarantees the user never gets stuck behind a wall when Firestore is
  // unreachable — they see the dashboard with premium empty states instead.
  if (currentScreen === 'app' && isAuthenticated && (organization || isOrgPermissionError)) {
    return (
      <div className="flex min-h-screen flex-col">
        {needsEmailVerification && <EmailVerificationBanner />}
        <DashboardContent />
      </div>
    )
  }

  if (currentScreen === 'login') {
    return <LoginPage onBack={handleBackToLanding} onGetStarted={handleGetStarted} />
  }

  return <LandingPage onGetStarted={handleGetStarted} onBookDemo={handleBookDemo} />
}

export default function Home() {
  return <AppRouter />
}

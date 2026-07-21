'use client'

import React from 'react'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  LayoutDashboard,
  FileText,
  Search,
  FileScan,
  Users,
  Settings,
  Zap,
  Building2,
  LogOut,
  Bell,
  BarChart3,
  CreditCard,
  UserCog,
  CheckSquare,
  Bot,
  Brain,
  FolderOpen,
  Workflow,
  Briefcase,
  Globe,
  Palette,
  Store,
  Share2,
  FileSearch,
  CheckCircle,
  Code,
  BookOpen,
  Wallet,
  UserCircle,
  Package,
  Landmark,
  Receipt,
  FileOutput,
  FileCheck,
  ShieldCheck,
  Scale,
  Crown,
  ChevronDown,
  MonitorSmartphone,
  UserCheck,
  FileCode2,
  CalendarClock,
  Mic,
  Database,
  Building,
  Radio,
  Activity,
  Target,
  TrendingUp,
  Gauge,
  Network,
  Rocket,
  Banknote,
  Copy,
  Cpu,
  Cloud,
  Fingerprint,
  HandCoins,
  ArrowLeftRight,
  GitBranch,
  Radar,
  CalendarDays,
  Search as SearchIcon,
  Bell as BellIcon,
  Shield,
  MessageSquare,
  FileStack,
  ScrollText,
  BarChart,
  Command,
  Sparkles,
  Zap,
  ShieldAlert,
  GitCompareArrows,
  Brain as BrainIcon,
} from 'lucide-react'
import { BrandLogo } from '@/components/brand'
import { useApp, type AppView } from '@/contexts/AppContext'
import { useAuth } from '@/contexts/AuthContext'
import { useFireUnreadNotifications } from '@/hooks/use-firestore'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface NavItem {
  title: string
  view: AppView
  icon: React.ElementType
  subtitle?: string
  shortcut?: string
  isNew?: boolean
}

/* ────────────────────────────────────────────────────────────────────────────
 * 5 GROUPS · GSTPilot Infinity™ — The Financial Brain of India
 * Command · Intelligence · Finance · Business · Platform
 * ────────────────────────────────────────────────────────────────────────── */

// COMMAND — entry points + autonomous run modes
const commandItems: NavItem[] = [
  { title: 'Mission Control', view: 'dashboard', icon: LayoutDashboard, subtitle: 'The One Screen', shortcut: 'G+D' },
  { title: 'Oracle', view: 'oracle-brain', icon: Sparkles, subtitle: 'Ask · Reason · Act', shortcut: 'G+O', isNew: true },
  { title: 'Execution Engine™', view: 'execution-engine', icon: Zap, subtitle: 'Observe·Think·Execute·Learn', isNew: true },
  { title: 'Business DNA', view: 'business-dna', icon: Fingerprint, subtitle: '6 Scores · Digital DNA', isNew: true },
  { title: "RUN INDIA'S BUSINESS™", view: 'run-india-business', icon: Landmark, subtitle: 'Autonomous Enterprise', isNew: true },
  { title: 'RUN MY BUSINESS™', view: 'run-my-business', icon: Rocket, subtitle: 'One-Click Automation', isNew: true },
]

// AUTONOMOUS FINANCE OS — Phase Delta
const autonomousItems: NavItem[] = [
  { title: 'Autonomous Finance OS', view: 'autonomous-finance', icon: Sparkles, subtitle: 'AI Finance Team', isNew: true },
  { title: 'Workflow Studio', view: 'workflow-studio', icon: Workflow, subtitle: 'Visual Automation', isNew: true },
  { title: 'Oracle Actions', view: 'oracle-actions', icon: Zap, subtitle: 'Autonomous Execution', isNew: true },
  { title: 'Financial Intelligence', view: 'financial-intelligence', icon: BrainIcon, subtitle: 'AI Insights & Risks', isNew: true },
  { title: 'Smart Reconciliation', view: 'smart-reconciliation', icon: GitCompareArrows, subtitle: 'AI-Assisted Matching', isNew: true },
  { title: 'Predictive Compliance', view: 'predictive-compliance', icon: ShieldAlert, subtitle: 'Risk Forecasting', isNew: true },
  { title: 'Intelligent Collections', view: 'intelligent-collections', icon: Users, subtitle: 'Payment Scoring', isNew: true },
]

// INTELLIGENCE — AI Executive + AI Workforce merged
const intelligenceItems: NavItem[] = [
  { title: 'AI CEO', view: 'firm-command-center', icon: Crown, subtitle: 'Autonomous Partner', isNew: true },
  { title: 'Oracle AI', view: 'oracle-intelligence', icon: Sparkles, subtitle: 'Enterprise AI Workspace', isNew: true },
  { title: 'Operating Room', view: 'ai-operating-room', icon: Gauge, subtitle: '6 Live Scores', isNew: true },
  { title: 'Predictions', view: 'ai-predictions', icon: TrendingUp, subtitle: '6 Prediction Models', isNew: true },
  { title: 'Priority Engine', view: 'ai-priority-engine', icon: Target, subtitle: 'Daily Priorities', isNew: true },
  { title: 'Decision Engine', view: 'decision-engine', icon: Brain, subtitle: 'AI Scored Decisions', isNew: true },
  { title: 'AI CA Manager', view: 'ai-ca-manager', icon: MonitorSmartphone, subtitle: 'Runs Your Firm', isNew: true },
  { title: 'AI Account Mgr', view: 'ai-account-manager', icon: UserCheck, subtitle: 'Client Guardian', isNew: true },
  { title: 'AI Doc Employee', view: 'ai-document-employee', icon: FileCode2, subtitle: 'Auto Processes Docs', isNew: true },
  { title: 'AI Deadline Engine', view: 'ai-deadline-engine', icon: CalendarClock, subtitle: 'Predicts Deadlines', isNew: true },
  { title: 'AI Voice Assistant', view: 'ai-voice-assistant', icon: Mic, subtitle: 'Voice → Actions', isNew: true },
  { title: 'AI Firm Memory', view: 'ai-firm-memory', icon: Database, subtitle: 'Remembers Everything', isNew: true },
  { title: 'AI CFO', view: 'ai-cfo', icon: Brain, subtitle: 'Financial Intelligence' },
  { title: 'AI Workforce', view: 'agents', icon: Bot, subtitle: '7 AI Employees' },
  { title: 'AI Agent OS', view: 'agent-os', icon: Cpu, subtitle: 'Build AI Employees', isNew: true },
  { title: 'Automations', view: 'automations', icon: Workflow, subtitle: 'Workflow Rules' },
]

// FINANCE — Finance + People merged
const financeItems: NavItem[] = [
  { title: 'GST', view: 'returns', icon: FileText, subtitle: 'Returns & Filing', shortcut: 'G+R' },
  { title: 'Accounting', view: 'accounting', icon: BookOpen, subtitle: 'Double-Entry Books' },
  { title: 'TDS', view: 'tds', icon: FileCheck, subtitle: 'TDS Management' },
  { title: 'E-Invoicing', view: 'e-invoicing', icon: FileOutput, subtitle: 'IRN & E-Way Bill' },
  { title: 'Payments', view: 'payments', icon: Receipt, subtitle: 'Collect & Pay' },
  { title: 'Banking', view: 'banking', icon: Landmark, subtitle: 'Accounts & Reconcile' },
  { title: 'Invoices', view: 'invoices', icon: FileScan, subtitle: 'Processing Center' },
  { title: 'Reconcile', view: 'reconcile', icon: Search, subtitle: '2A/2B Matching' },
  { title: 'Payroll', view: 'payroll', icon: Wallet, subtitle: 'Salary & Compliance' },
  { title: 'HRMS', view: 'hrms', icon: UserCircle, subtitle: 'People Management' },
]

// BUSINESS — Business + Compliance merged
const businessNavItems: NavItem[] = [
  { title: 'CRM', view: 'crm', icon: Briefcase, subtitle: 'Lead Pipeline' },
  { title: 'Inventory', view: 'inventory', icon: Package, subtitle: 'Stock & Warehouse' },
  { title: 'Clients', view: 'clients', icon: Users, subtitle: 'Client Portfolio', shortcut: 'G+C' },
  { title: 'Client Portal', view: 'client-portal', icon: Globe, subtitle: 'Client Self-Service' },
  { title: 'ROC Compliance', view: 'roc-compliance', icon: ShieldCheck, subtitle: 'Company Law' },
  { title: 'Legal Notices', view: 'legal-notices', icon: Scale, subtitle: 'Notice Management' },
]

// PLATFORM — GFX + Fin Infrastructure + Fin Network + System merged
const platformItems: NavItem[] = [
  // Financial Exchange (GFX)
  { title: 'RUN MY COMPANY™', view: 'run-my-company', icon: Rocket, subtitle: 'Autonomous Company', isNew: true },
  { title: 'Economic War Room', view: 'economic-war-room', icon: Radar, subtitle: 'Macro Command Center', isNew: true },
  { title: 'Universal Business ID', view: 'universal-business-id', icon: Fingerprint, subtitle: 'India Business Identity', isNew: true },
  { title: 'Credit Scoring Engine', view: 'credit-scoring-engine', icon: Gauge, subtitle: 'CIBIL for Businesses', isNew: true },
  { title: 'Invoice Exchange', view: 'invoice-exchange', icon: ArrowLeftRight, subtitle: 'B2B Invoice Market', isNew: true },
  { title: 'Financing Marketplace', view: 'financing-marketplace', icon: HandCoins, subtitle: 'Capital Connect', isNew: true },
  { title: 'Economic Graph', view: 'economic-graph', icon: GitBranch, subtitle: 'Real-Time Business Graph', isNew: true },
  // Financial Infrastructure
  { title: 'War Room', view: 'executive-war-room', icon: Radio, subtitle: 'Palantir Command Center', isNew: true },
  { title: 'Business Graph', view: 'business-graph', icon: Network, subtitle: 'Entity Graph DB', isNew: true },
  { title: 'Data Moat', view: 'data-moat', icon: Database, subtitle: 'AI Business Memory', isNew: true },
  { title: 'Data Cloud', view: 'data-cloud', icon: Cloud, subtitle: 'Financial Intelligence', isNew: true },
  { title: 'Payments™', view: 'embedded-finance', icon: CreditCard, subtitle: 'Embedded Finance', isNew: true },
  { title: 'Working Capital', view: 'working-capital', icon: Banknote, subtitle: 'Finance & Credit Engine', isNew: true },
  { title: 'Industry Benchmark', view: 'industry-benchmark', icon: BarChart3, subtitle: 'Compare & Rank', isNew: true },
  { title: 'Digital Twin', view: 'digital-twin', icon: Copy, subtitle: 'Business Simulation', isNew: true },
  { title: 'Event Engine', view: 'event-engine', icon: Activity, subtitle: 'Real-Time Events', isNew: true },
  { title: 'Network', view: 'gstpilot-network', icon: Globe, subtitle: 'Viral Growth Loop', isNew: true },
  // Financial Network
  { title: 'API Platform™', view: 'api-platform-v2', icon: Code, subtitle: 'Stripe for India', isNew: true },
  { title: 'App Store™', view: 'app-store', icon: Store, subtitle: 'Financial App Ecosystem', isNew: true },
  { title: 'Agent OS™', view: 'agent-os', icon: Cpu, subtitle: 'Build AI Employees', isNew: true },
  { title: 'Network Effects', view: 'network-effects', icon: Share2, subtitle: 'Viral Growth Engine', isNew: true },
  // System
  { title: 'Multi-Firm', view: 'multi-firm', icon: Building, subtitle: 'Firm Switcher', isNew: true },
  { title: 'Tasks', view: 'tasks', icon: CheckSquare, subtitle: 'Workflow Tasks' },
  { title: 'Documents', view: 'documents', icon: FolderOpen, subtitle: 'Document Intel' },
  { title: 'Analytics', view: 'analytics', icon: BarChart3, subtitle: 'Insights & Reports' },
  { title: 'Marketplace', view: 'marketplace', icon: Store, subtitle: 'Platform Ecosystem' },
  { title: 'Team', view: 'team', icon: UserCog, subtitle: 'Members & Roles' },
  { title: 'Billing', view: 'billing', icon: CreditCard, subtitle: 'Plan & Usage' },
  { title: 'Audit Trail', view: 'audit-trail', icon: FileSearch, subtitle: 'Compliance & Logs' },
  { title: 'Approvals', view: 'approvals', icon: CheckCircle, subtitle: 'Workflow Approvals' },
  { title: 'White Label', view: 'white-label', icon: Palette, subtitle: 'Custom Branding' },
  { title: 'Settings', view: 'settings', icon: Settings, subtitle: 'Workspace' },
  { title: 'Google Workspace', view: 'google-workspace', icon: Cloud, subtitle: 'Gmail · Drive · Docs · Sheets · Calendar', isNew: true },
  { title: 'Zoho Books', view: 'zoho-books', icon: BookOpen, subtitle: 'Invoices · Customers · Bills · Banking', isNew: true },
]

// Phase 13 — Enterprise Collaboration, Multi-Company & Command Network™
const enterpriseNetworkItems: NavItem[] = [
  { title: 'Command Center™', view: 'enterprise-command-center', icon: Command, subtitle: 'Global Enterprise Dashboard', isNew: true },
  { title: 'Multi-Company', view: 'multi-company-workspace', icon: Building2, subtitle: 'Unlimited Companies & GSTINs', isNew: true },
  { title: 'Team Collaboration', view: 'team-collaboration', icon: MessageSquare, subtitle: 'Tasks · Chat · Approvals', isNew: true },
  { title: 'Workflow Engine', view: 'workflow-engine', icon: Workflow, subtitle: 'Multi-Level Approvals', isNew: true },
  { title: 'Enterprise Docs', view: 'enterprise-documents', icon: FileStack, subtitle: 'Versioned · OCR · Shared', isNew: true },
  { title: 'Executive Calendar', view: 'executive-calendar', icon: CalendarDays, subtitle: 'Unified Deadline Hub', isNew: true },
  { title: 'Universal Search', view: 'enterprise-search', icon: SearchIcon, subtitle: 'Search Everything', isNew: true },
  { title: 'Notifications', view: 'enterprise-notifications', icon: BellIcon, subtitle: 'Central Alert Hub', isNew: true },
  { title: 'Advanced RBAC', view: 'advanced-rbac', icon: Shield, subtitle: '9 Enterprise Roles', isNew: true },
  { title: 'Cross-Company Analytics', view: 'cross-company-analytics', icon: BarChart, subtitle: 'Compare All Entities', isNew: true },
  { title: 'Enterprise Audit', view: 'enterprise-audit', icon: ScrollText, subtitle: 'Track Every Action', isNew: true },
]

interface AppSidebarProps {
  onSearchOpen?: () => void
}

function SidebarNav({ onSearchOpen }: AppSidebarProps) {
  const { currentView, setCurrentView } = useApp()
  const { user, logout } = useAuth()
  const { setOpenMobile } = useSidebar()
  const { data: unreadNotifs } = useFireUnreadNotifications()
  const unreadCount = unreadNotifs.length

  // onSearchOpen is retained for API compatibility (the floating Intelligence orb now covers Copilot).
  void onSearchOpen

  const handleNavClick = (view: AppView) => {
    setCurrentView(view)
    setOpenMobile(false)
  }

  const userInitials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : 'U'

  const renderNavItem = (item: NavItem) => {
    const isActive = currentView === item.view || (currentView === 'client-workspace' && item.view === 'clients')
    return (
      <SidebarMenuItem key={item.view}>
        <SidebarMenuButton
          onClick={() => handleNavClick(item.view)}
          tooltip={item.title}
          className={`
            group/navitem relative h-9 rounded-lg gap-2 transition-all duration-200 ease-in-out
            ${
              isActive
                ? 'accent-gradient-soft text-foreground font-medium hover:text-foreground'
                : 'text-muted-foreground hover:bg-white/[0.04] hover:text-foreground'
            }
          `}
        >
          {isActive && (
            <div className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-full accent-gradient" />
          )}
          <item.icon
            className={`h-[16px] w-[16px] shrink-0 transition-colors duration-200 ${
              isActive
                ? 'text-foreground'
                : 'text-muted-foreground/70 group-hover/navitem:text-foreground'
            }`}
          />
          <span className="flex-1 min-w-0 text-[13px] leading-tight truncate">
            {item.title}
          </span>
          {item.shortcut && (
            <span className="text-[9px] text-muted-foreground/30 font-mono hidden group-hover/navitem:inline-flex items-center gap-0.5">
              {item.shortcut}
            </span>
          )}
        </SidebarMenuButton>
      </SidebarMenuItem>
    )
  }

  const renderGroup = (label: string, items: NavItem[], defaultOpen = false) => (
    <Collapsible defaultOpen={defaultOpen} className="group/collapsible">
      <SidebarGroup className="p-1.5">
        <CollapsibleTrigger className="group/label flex w-full items-center justify-between rounded-md px-2 h-8 hover:bg-white/[0.03] transition-colors outline-none focus-visible:ring-1 focus-visible:ring-ring/40">
          <span className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground/50">
            {label}
          </span>
          <ChevronDown className="h-3 w-3 text-muted-foreground/40 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent className="overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up">
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5 mt-1">
              {items.map(renderNavItem)}
            </SidebarMenu>
          </SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  )

  return (
    <>
      <SidebarHeader className="border-b border-sidebar-border/50 px-3 py-4">
        <div className="flex items-center gap-2.5">
          <BrandLogo variant="icon" theme="dark" size={32} disableGlow />
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-base font-bold tracking-tight text-foreground">
                GSTPilot
              </span>
              <span className="inline-flex items-center rounded-md accent-gradient-soft px-1.5 py-0.5 leading-none">
                <span className="text-[9px] font-bold uppercase tracking-wider accent-text">
                  Infinity
                </span>
              </span>
            </div>
            {user?.firmName ? (
              <span className="text-[10px] text-muted-foreground/60 truncate max-w-[150px]">
                {user.firmName}
              </span>
            ) : (
              <span className="text-[10px] text-muted-foreground/40">
                Financial Brain of India
              </span>
            )}
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-1.5 py-2 overflow-y-auto scrollbar-thin">
        {renderGroup('Command', commandItems, true)}
        {renderGroup('Autonomous Finance OS', autonomousItems, true)}
        {renderGroup('Intelligence', intelligenceItems)}
        {renderGroup('Finance', financeItems)}
        {renderGroup('Business', businessNavItems)}
        {renderGroup('Platform', platformItems)}
        {renderGroup('Enterprise Network™', enterpriseNetworkItems, true)}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border/50 p-3">
        <DropdownMenu>
          <DropdownMenuTrigger className="w-full flex items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-white/[0.04] transition-colors outline-none text-left">
            <Avatar className="h-7 w-7 shrink-0">
              <AvatarFallback className="bg-[#2563EB]/15 text-[#3B82F6] border border-[#2563EB]/25 text-[10px] font-semibold">
                {userInitials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0 hidden group-data-[collapsible=icon]:hidden">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-foreground truncate">{user?.name || 'User'}</span>
              </div>
              <span className="text-[9px] text-muted-foreground/50 truncate block">{user?.email || ''}</span>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="w-56">
            <div className="flex items-center gap-2 p-2">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="bg-[#2563EB]/15 text-[#3B82F6] border border-[#2563EB]/25 text-[10px] font-semibold">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{user?.name || 'User'}</p>
                <p className="text-[10px] text-muted-foreground truncate">{user?.email || ''}</p>
              </div>
            </div>
            {user?.firmName && (
              <>
                <DropdownMenuSeparator />
                <div className="flex items-center gap-2 px-2 py-1.5">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground truncate">{user.firmName}</span>
                </div>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleNavClick('settings')} className="gap-2">
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
        <div className="flex items-center justify-between mt-2 px-1 hidden group-data-[collapsible=icon]:hidden">
          <span className="text-[9px] font-medium text-muted-foreground/40">
            GSTPilot Infinity™
          </span>
          {unreadCount > 0 && (
            <div className="flex items-center gap-1">
              <Bell className="h-3 w-3 text-muted-foreground/50" />
              <span className="text-[9px] font-medium text-muted-foreground/60">{unreadCount}</span>
            </div>
          )}
        </div>
      </SidebarFooter>
    </>
  )
}

export function AppSidebar({ onSearchOpen }: AppSidebarProps) {
  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-sidebar-border/50"
    >
      <SidebarNav onSearchOpen={onSearchOpen} />
    </Sidebar>
  )
}

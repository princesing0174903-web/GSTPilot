'use client';

import React, { useEffect, useMemo, useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UserPlus,
  Upload,
  FileText,
  RefreshCw,
  BarChart3,
  ClipboardList,
  Bell,
  Users,
  CheckSquare,
  Bot,
  Zap,
  Building2,
  FileSpreadsheet,
  FolderOpen,
  Activity,
  Star,
  Clock,
  Pin,
  Search,
  ArrowRight,
  Receipt,
  Copy,
  Cpu,
  Crown,
  Cloud,
  Globe,
  Brain,
  ShieldCheck,
  Calendar,
  Network,
  GitBranch,
  ScrollText,
  Layers,
  LayoutDashboard,
  Globe2,
  Coins,
  Banknote,
  Warehouse,
  Languages,
  Plane,
  FileBarChart,
  Package,
  Server,
  Calculator,
  Code2,
  Store,
  Plug,
  Database,
  Radio,
  Workflow,
  Fingerprint,
  CreditCard,
  Share2,
  BrainCircuit,
  Boxes,
} from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import {
  useFireClients,
  useFireInvoices,
  useFireReturns,
  useFireDocuments,
  useFireRecentActivities,
} from '@/hooks/use-firestore';
import { useGSTpilotCustomers } from '@/hooks/useGSTpilotCustomers';
import { useGSTpilotProducts } from '@/hooks/useGSTpilotProducts';
import { useGSTpilotInvoices } from '@/hooks/useGSTpilotInvoices';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command';
import { modalEnterVariants, springModalTransition, backdropVariants } from '@/components/ui-pro';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface CommandAction {
  id: string;
  label: string;
  description?: string;
  icon: React.ElementType;
  shortcut?: string;
  action: () => void;
  group: string;
}

interface RecentItem {
  id: string;
  label: string;
  type: 'command' | 'client' | 'invoice' | 'return' | 'document' | 'activity';
  timestamp: number;
}

interface FavoriteItem {
  id: string;
  label: string;
  type: 'command';
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const RECENT_STORAGE_KEY = 'gstpilot-recent-commands';
const FAVORITES_STORAGE_KEY = 'gstpilot-favorite-commands';
const MAX_RECENT = 5;

// ═══════════════════════════════════════════════════════════════════════════════
// LOCAL STORAGE HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function loadRecent(): RecentItem[] {
  try {
    const raw = localStorage.getItem(RECENT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRecent(items: RecentItem[]) {
  try {
    localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(items.slice(0, MAX_RECENT)));
  } catch {
    // ignore quota errors
  }
}

function loadFavorites(): FavoriteItem[] {
  try {
    const raw = localStorage.getItem(FAVORITES_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveFavorites(items: FavoriteItem[]) {
  try {
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignore quota errors
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMMAND PALETTE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function CommandPalette() {
  const {
    setCurrentView,
    commandPaletteOpen,
    setCommandPaletteOpen,
    setSelectedClientId,
  } = useApp();

  const [query, setQuery] = useState('');
  const [recentItems, setRecentItems] = useState<RecentItem[]>(loadRecent);
  const [favorites, setFavorites] = useState<FavoriteItem[]>(loadFavorites);

  // ─── Firestore live data ──────────────────────────────────────────────────
  const { data: clients } = useFireClients();
  const { data: invoices } = useFireInvoices();
  const { data: returns } = useFireReturns();
  const { data: documents } = useFireDocuments();
  const { data: activities } = useFireRecentActivities(20);

  // ── GSTPilot live registry (organizations/GSTpilot_SAAS/*) ──
  const { customers: gstCustomers } = useGSTpilotCustomers();
  const { products: gstProducts } = useGSTpilotProducts();
  const { invoices: gstInvoices } = useGSTpilotInvoices();

  // ─── Keyboard shortcut: Ctrl+K ───────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (!commandPaletteOpen) {
          setQuery('');
        }
        setCommandPaletteOpen(!commandPaletteOpen);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [commandPaletteOpen, setCommandPaletteOpen]);

  // ─── Add to recent ───────────────────────────────────────────────────────
  const addToRecent = useCallback(
    (id: string, label: string, type: RecentItem['type']) => {
      setRecentItems((prev) => {
        const filtered = prev.filter((r) => r.id !== id);
        const updated = [{ id, label, type, timestamp: Date.now() }, ...filtered].slice(
          0,
          MAX_RECENT
        );
        saveRecent(updated);
        return updated;
      });
    },
    []
  );

  // ─── Toggle favorite ─────────────────────────────────────────────────────
  const toggleFavorite = useCallback((id: string, label: string) => {
    setFavorites((prev) => {
      const exists = prev.find((f) => f.id === id);
      const updated = exists
        ? prev.filter((f) => f.id !== id)
        : [...prev, { id, label, type: 'command' as const }];
      saveFavorites(updated);
      return updated;
    });
  }, []);

  // ─── Command actions ─────────────────────────────────────────────────────
  const commands: CommandAction[] = useMemo(
    () => [
      {
        id: 'cmd-create-client',
        label: 'Create Client',
        description: 'Add a new client to the registry',
        icon: UserPlus,
        shortcut: 'G C',
        action: () => {
          setCurrentView('clients');
          addToRecent('cmd-create-client', 'Create Client', 'command');
        },
        group: 'Commands',
      },
      {
        id: 'cmd-upload-invoice',
        label: 'Upload Invoice',
        description: 'Upload and extract invoice data',
        icon: Upload,
        shortcut: 'G I',
        action: () => {
          setCurrentView('invoices');
          addToRecent('cmd-upload-invoice', 'Upload Invoice', 'command');
        },
        group: 'Commands',
      },
      {
        id: 'cmd-invoice-cloud',
        label: 'Open Invoice Cloud',
        description: 'Sales · Purchase · Expenses · Receivables · Payables · Payments · TDS · Payroll · Forecast',
        icon: Receipt,
        shortcut: 'G C',
        action: () => {
          setCurrentView('invoice-cloud');
          addToRecent('cmd-invoice-cloud', 'Open Invoice Cloud', 'command');
        },
        group: 'Commands',
      },
      {
        id: 'cmd-execution-engine',
        label: 'Open Execution Engine',
        description: 'Observe · Think · Decide · Execute · Learn — Autonomous AI workforce',
        icon: Zap,
        shortcut: 'G E',
        action: () => {
          setCurrentView('execution-engine');
          addToRecent('cmd-execution-engine', 'Open Execution Engine', 'command');
        },
        group: 'Commands',
      },
      {
        id: 'cmd-digital-twin',
        label: 'Open Digital Twin™',
        description: 'Live business simulator — Mirror · Simulate · Predict · Replay history',
        icon: Copy,
        shortcut: 'G D',
        action: () => {
          setCurrentView('digital-twin');
          addToRecent('cmd-digital-twin', 'Open Digital Twin™', 'command');
        },
        group: 'Commands',
      },
      {
        id: 'cmd-create-return',
        label: 'Create Return',
        description: 'Prepare a new GST return',
        icon: FileText,
        action: () => {
          setCurrentView('returns');
          addToRecent('cmd-create-return', 'Create Return', 'command');
        },
        group: 'Commands',
      },
      {
        id: 'cmd-run-reconciliation',
        label: 'Run Reconciliation',
        description: 'Reconcile GSTR-2B with purchase register',
        icon: RefreshCw,
        action: () => {
          setCurrentView('reconcile');
          addToRecent('cmd-run-reconciliation', 'Run Reconciliation', 'command');
        },
        group: 'Commands',
      },
      {
        id: 'cmd-open-analytics',
        label: 'Open Analytics',
        description: 'View firm analytics and reports',
        icon: BarChart3,
        action: () => {
          setCurrentView('analytics');
          addToRecent('cmd-open-analytics', 'Open Analytics', 'command');
        },
        group: 'Commands',
      },
      {
        id: 'cmd-generate-filing-summary',
        label: 'Generate Filing Summary',
        description: 'Generate a filing summary report',
        icon: ClipboardList,
        action: () => {
          setCurrentView('returns');
          addToRecent('cmd-generate-filing-summary', 'Generate Filing Summary', 'command');
        },
        group: 'Commands',
      },
      {
        id: 'cmd-open-notifications',
        label: 'Open Notifications',
        description: 'View your notifications',
        icon: Bell,
        action: () => {
          setCommandPaletteOpen(false);
          addToRecent('cmd-open-notifications', 'Open Notifications', 'command');
        },
        group: 'Commands',
      },
      {
        id: 'cmd-invite-team-member',
        label: 'Invite Team Member',
        description: 'Send a team invitation',
        icon: Users,
        action: () => {
          setCurrentView('team');
          addToRecent('cmd-invite-team-member', 'Invite Team Member', 'command');
        },
        group: 'Commands',
      },
      {
        id: 'cmd-create-task',
        label: 'Create Task',
        description: 'Create a new task',
        icon: CheckSquare,
        action: () => {
          setCurrentView('tasks');
          addToRecent('cmd-create-task', 'Create Task', 'command');
        },
        group: 'Commands',
      },
      {
        id: 'cmd-open-ai-copilot',
        label: 'Open AI Copilot',
        description: 'Copilot is always visible in the sidebar',
        icon: Bot,
        action: () => {
          setCommandPaletteOpen(false);
          addToRecent('cmd-open-ai-copilot', 'Open AI Copilot', 'command');
        },
        group: 'Commands',
      },
      {
        id: 'cmd-open-generate',
        label: 'Open AI Generation Workbench',
        description: 'Production AI pipeline — queue, generate, retry, cancel, version history',
        icon: Zap,
        action: () => {
          setCurrentView('generate');
          addToRecent('cmd-open-generate', 'Open AI Generation Workbench', 'command');
        },
        group: 'Commands',
      },
      {
        id: 'cmd-run-autopilot',
        label: 'Run Autopilot',
        description: 'Launch automated workflow execution',
        icon: Zap,
        action: () => {
          setCurrentView('autopilot');
          addToRecent('cmd-run-autopilot', 'Run Autopilot', 'command');
        },
        group: 'Commands',
      },
      {
        id: 'cmd-open-software-factory',
        label: 'Open AI Software Factory™',
        description: 'Build apps from natural language — Oracle™ + 10 AI dev employees',
        icon: Cpu,
        action: () => {
          setCurrentView('ai-software-factory');
          addToRecent('cmd-open-software-factory', 'Open AI Software Factory™', 'command');
        },
        group: 'Commands',
      },
      {
        id: 'cmd-open-autonomous-enterprise',
        label: 'Open Autonomous Enterprise™',
        description: 'Self-running business OS — 9 AI executives plan, decide, execute, learn',
        icon: Crown,
        action: () => {
          setCurrentView('autonomous-enterprise');
          addToRecent('cmd-open-autonomous-enterprise', 'Open Autonomous Enterprise™', 'command');
        },
        group: 'Commands',
      },
      {
        id: 'cmd-open-enterprise-cloud-platform',
        label: 'Open Enterprise Cloud Platform™',
        description: 'Global SaaS infrastructure — multi-tenant, billing, marketplace, APIs, security',
        icon: Cloud,
        action: () => {
          setCurrentView('enterprise-cloud-platform');
          addToRecent('cmd-open-enterprise-cloud-platform', 'Open Enterprise Cloud Platform™', 'command');
        },
        group: 'Commands',
      },
      {
        id: 'cmd-open-enterprise-ai-platform',
        label: 'Open Enterprise AI Platform™',
        description: 'Developer platform — marketplace, webhooks, API keys, low-code studio, SDKs',
        icon: Cloud,
        action: () => {
          setCurrentView('enterprise-ai-platform');
          addToRecent('cmd-open-enterprise-ai-platform', 'Open Enterprise AI Platform™', 'command');
        },
        group: 'Commands',
      },
      {
        id: 'cmd-open-global-enterprise-network',
        label: 'Open Global Enterprise Network™',
        description: 'World business network — global business graph, suppliers, B2B commerce, trust scores, opportunities',
        icon: Globe,
        action: () => {
          setCurrentView('global-enterprise-network');
          addToRecent('cmd-open-global-enterprise-network', 'Open Global Enterprise Network™', 'command');
        },
        group: 'Commands',
      },
      // ─── Phase 13 — Enterprise Collaboration, Multi-Company & Command Network™ ───
      {
        id: 'cmd-open-enterprise-command-center',
        label: 'Open Enterprise Command Center™',
        description: 'Global command center — every company, financial health, GST, AI alerts, cash flow, risks, growth',
        icon: LayoutDashboard,
        action: () => {
          setCurrentView('enterprise-command-center');
          addToRecent('cmd-open-enterprise-command-center', 'Open Enterprise Command Center™', 'command');
        },
        group: 'Phase 13 — Enterprise',
      },
      {
        id: 'cmd-open-multi-company-workspace',
        label: 'Open Multi-Company Workspace™',
        description: 'Unlimited companies, GSTINs & branches — instant switching with complete data isolation',
        icon: Layers,
        action: () => {
          setCurrentView('multi-company-workspace');
          addToRecent('cmd-open-multi-company-workspace', 'Open Multi-Company Workspace™', 'command');
        },
        group: 'Phase 13 — Enterprise',
      },
      {
        id: 'cmd-open-team-collaboration',
        label: 'Open Team Collaboration™',
        description: 'Tasks, assignments, approvals, comments, mentions, internal chat & real-time activity feed',
        icon: Users,
        action: () => {
          setCurrentView('team-collaboration');
          addToRecent('cmd-open-team-collaboration', 'Open Team Collaboration™', 'command');
        },
        group: 'Phase 13 — Enterprise',
      },
      {
        id: 'cmd-open-workflow-engine',
        label: 'Open Enterprise Workflow Engine™',
        description: 'Multi-level approval workflows — invoices, expenses, payments, GST filings, vendors, POs, salary',
        icon: GitBranch,
        action: () => {
          setCurrentView('workflow-engine');
          addToRecent('cmd-open-workflow-engine', 'Open Enterprise Workflow Engine™', 'command');
        },
        group: 'Phase 13 — Enterprise',
      },
      {
        id: 'cmd-open-enterprise-documents',
        label: 'Open Enterprise Documents™',
        description: 'Shared document workspace — version history, access permissions, folders, approvals, OCR',
        icon: FolderOpen,
        action: () => {
          setCurrentView('enterprise-documents');
          addToRecent('cmd-open-enterprise-documents', 'Open Enterprise Documents™', 'command');
        },
        group: 'Phase 13 — Enterprise',
      },
      {
        id: 'cmd-open-executive-calendar',
        label: 'Open Executive Calendar™',
        description: 'Unified calendar — GST deadlines, meetings, approvals, tasks, payments, compliance, AI reminders',
        icon: Calendar,
        action: () => {
          setCurrentView('executive-calendar');
          addToRecent('cmd-open-executive-calendar', 'Open Executive Calendar™', 'command');
        },
        group: 'Phase 13 — Enterprise',
      },
      {
        id: 'cmd-open-enterprise-search',
        label: 'Open Enterprise Search™',
        description: 'Universal search across invoices, customers, vendors, companies, GST, reports, docs, tasks',
        icon: Search,
        action: () => {
          setCurrentView('enterprise-search');
          addToRecent('cmd-open-enterprise-search', 'Open Enterprise Search™', 'command');
        },
        group: 'Phase 13 — Enterprise',
      },
      {
        id: 'cmd-open-enterprise-notifications',
        label: 'Open Enterprise Notifications™',
        description: 'Central hub — assignments, approvals, AI alerts, GST deadlines, payments, risk & compliance',
        icon: Bell,
        action: () => {
          setCurrentView('enterprise-notifications');
          addToRecent('cmd-open-enterprise-notifications', 'Open Enterprise Notifications™', 'command');
        },
        group: 'Phase 13 — Enterprise',
      },
      {
        id: 'cmd-open-advanced-rbac',
        label: 'Open Advanced RBAC™',
        description: 'Enterprise permissions — CEO, CFO, Finance Manager, CA, Accountant, GST Executive, HR, Auditor',
        icon: ShieldCheck,
        action: () => {
          setCurrentView('advanced-rbac');
          addToRecent('cmd-open-advanced-rbac', 'Open Advanced RBAC™', 'command');
        },
        group: 'Phase 13 — Enterprise',
      },
      {
        id: 'cmd-open-cross-company-analytics',
        label: 'Open Cross-Company Analytics™',
        description: 'Compare revenue, expenses, profit, GST, compliance, growth, cash flow, risk & AI score',
        icon: BarChart3,
        action: () => {
          setCurrentView('cross-company-analytics');
          addToRecent('cmd-open-cross-company-analytics', 'Open Cross-Company Analytics™', 'command');
        },
        group: 'Phase 13 — Enterprise',
      },
      {
        id: 'cmd-open-enterprise-audit',
        label: 'Open Enterprise Audit™',
        description: 'Track every action — user & org activity, approvals, changes, AI actions, compliance logs',
        icon: ScrollText,
        action: () => {
          setCurrentView('enterprise-audit');
          addToRecent('cmd-open-enterprise-audit', 'Open Enterprise Audit™', 'command');
        },
        group: 'Phase 13 — Enterprise',
      },
      // ─── Phase 14 — Global Expansion & International Financial Operating System™ ───
      {
        id: 'cmd-open-multi-country-accounting',
        label: 'Open Multi-Country Accounting™',
        description: '10 countries (IN, US, CA, GB, AU, AE, SG, DE, FR, JP) with automatic country-specific rules',
        icon: Globe2,
        action: () => {
          setCurrentView('multi-country-accounting');
          addToRecent('cmd-open-multi-country-accounting', 'Open Multi-Country Accounting™', 'command');
        },
        group: 'Phase 14 — Global',
      },
      {
        id: 'cmd-open-multi-tax-engine',
        label: 'Open Multi-Tax Engine™',
        description: 'GST, VAT, Sales Tax, Corporate Tax, Payroll Tax, Import/Export Duty — country-specific calculations',
        icon: Calculator,
        action: () => {
          setCurrentView('multi-tax-engine');
          addToRecent('cmd-open-multi-tax-engine', 'Open Multi-Tax Engine™', 'command');
        },
        group: 'Phase 14 — Global',
      },
      {
        id: 'cmd-open-multi-currency-system',
        label: 'Open Multi-Currency System™',
        description: 'USD, INR, EUR, GBP, AED, CAD, JPY, AUD, SGD — live rates, conversion, historical trends',
        icon: Coins,
        action: () => {
          setCurrentView('multi-currency-system');
          addToRecent('cmd-open-multi-currency-system', 'Open Multi-Currency System™', 'command');
        },
        group: 'Phase 14 — Global',
      },
      {
        id: 'cmd-open-international-banking',
        label: 'Open International Banking™',
        description: 'Stripe, PayPal, Wise, Revolut, Mercury, Brex, HSBC, Citibank, JP Morgan, Razorpay, Cashfree',
        icon: Banknote,
        action: () => {
          setCurrentView('international-banking');
          addToRecent('cmd-open-international-banking', 'Open International Banking™', 'command');
        },
        group: 'Phase 14 — Global',
      },
      {
        id: 'cmd-open-global-compliance-engine',
        label: 'Open Global Compliance Engine™',
        description: 'India, USA, UK, EU, Singapore, Australia, Canada — automated compliance report generation',
        icon: ShieldCheck,
        action: () => {
          setCurrentView('global-compliance-engine');
          addToRecent('cmd-open-global-compliance-engine', 'Open Global Compliance Engine™', 'command');
        },
        group: 'Phase 14 — Global',
      },
      {
        id: 'cmd-open-international-erp',
        label: 'Open International ERP™',
        description: 'Global inventory, warehouses, branches, cross-border purchase orders & invoices',
        icon: Warehouse,
        action: () => {
          setCurrentView('international-erp');
          addToRecent('cmd-open-international-erp', 'Open International ERP™', 'command');
        },
        group: 'Phase 14 — Global',
      },
      {
        id: 'cmd-open-multi-language-platform',
        label: 'Open Multi-Language Platform™',
        description: 'English, Hindi, French, German, Spanish, Arabic, Japanese, Chinese — runtime switching',
        icon: Languages,
        action: () => {
          setCurrentView('multi-language-platform');
          addToRecent('cmd-open-multi-language-platform', 'Open Multi-Language Platform™', 'command');
        },
        group: 'Phase 14 — Global',
      },
      {
        id: 'cmd-open-ai-global-advisor',
        label: 'Open AI Global Advisor™',
        description: 'Oracle AI for country regulations, international taxation, currency risks, cross-border finance',
        icon: Brain,
        action: () => {
          setCurrentView('ai-global-advisor');
          addToRecent('cmd-open-ai-global-advisor', 'Open AI Global Advisor™', 'command');
        },
        group: 'Phase 14 — Global',
      },
      {
        id: 'cmd-open-global-dashboard',
        label: 'Open Global Dashboard™',
        description: 'Country-wise revenue, expenses, tax, exchange gains/losses, international cash flow, regional KPIs',
        icon: LayoutDashboard,
        action: () => {
          setCurrentView('global-dashboard');
          addToRecent('cmd-open-global-dashboard', 'Open Global Dashboard™', 'command');
        },
        group: 'Phase 14 — Global',
      },
      {
        id: 'cmd-open-cross-border-payments',
        label: 'Open Cross-Border Payments™',
        description: 'International invoices, collections, payouts & cross-border reconciliation',
        icon: Plane,
        action: () => {
          setCurrentView('cross-border-payments');
          addToRecent('cmd-open-cross-border-payments', 'Open Cross-Border Payments™', 'command');
        },
        group: 'Phase 14 — Global',
      },
      {
        id: 'cmd-open-international-reports',
        label: 'Open International Reports™',
        description: 'Country reports, currency reports, global cash flow, international P&L, regional analytics',
        icon: FileBarChart,
        action: () => {
          setCurrentView('international-reports');
          addToRecent('cmd-open-international-reports', 'Open International Reports™', 'command');
        },
        group: 'Phase 14 — Global',
      },
      {
        id: 'cmd-open-global-performance',
        label: 'Open Global Performance™',
        description: '10,000+ users, 100,000+ orgs, millions of invoices, worldwide scaling, CDN optimization',
        icon: Server,
        action: () => {
          setCurrentView('global-performance');
          addToRecent('cmd-open-global-performance', 'Open Global Performance™', 'command');
        },
        group: 'Phase 14 — Global',
      },
      // ─── Phase 16 — Global Financial Cloud™, Open Platform & Developer Ecosystem™ ───
      {
        id: 'cmd-open-global-financial-cloud',
        label: 'Open Global Financial Cloud™ Hub',
        description: 'The 15 pillars of the open platform — APIs, Marketplace, Integrations, Data, Events',
        icon: Cloud,
        action: () => {
          setCurrentView('global-financial-cloud');
          addToRecent('cmd-open-global-financial-cloud', 'Open Global Financial Cloud™ Hub', 'command');
        },
        group: 'Phase 16 — Cloud',
      },
      {
        id: 'cmd-open-developer-platform',
        label: 'Open Developer Platform™',
        description: 'REST, GraphQL, Webhooks, 8 SDKs, CLI, OAuth, API keys, Playground, Sandbox, Docs',
        icon: Code2,
        action: () => {
          setCurrentView('developer-platform');
          addToRecent('cmd-open-developer-platform', 'Open Developer Platform™', 'command');
        },
        group: 'Phase 16 — Cloud',
      },
      {
        id: 'cmd-open-enterprise-api-gateway',
        label: 'Open Enterprise API Gateway™',
        description: '13 secure service APIs: GST, Invoices, Accounting, ERP, CRM, HR, Payroll, Banking, AI',
        icon: Network,
        action: () => {
          setCurrentView('enterprise-api-gateway');
          addToRecent('cmd-open-enterprise-api-gateway', 'Open Enterprise API Gateway™', 'command');
        },
        group: 'Phase 16 — Cloud',
      },
      {
        id: 'cmd-open-app-marketplace-cloud',
        label: 'Open App Marketplace™',
        description: 'Apps, Extensions, Plugins, AI Skills, ERP Connectors, Industry Templates, Automation Packs',
        icon: Store,
        action: () => {
          setCurrentView('app-marketplace-cloud');
          addToRecent('cmd-open-app-marketplace-cloud', 'Open App Marketplace™', 'command');
        },
        group: 'Phase 16 — Cloud',
      },
      {
        id: 'cmd-open-global-integration-hub',
        label: 'Open Global Integration Hub™',
        description: 'SAP, Oracle, Dynamics, Zoho, Tally, QuickBooks, Xero, Salesforce, Slack, Stripe, Bank APIs',
        icon: Plug,
        action: () => {
          setCurrentView('global-integration-hub');
          addToRecent('cmd-open-global-integration-hub', 'Open Global Integration Hub™', 'command');
        },
        group: 'Phase 16 — Cloud',
      },
      {
        id: 'cmd-open-financial-data-cloud',
        label: 'Open Financial Data Cloud™',
        description: 'Unified financial data layer syncing 11 domains in real-time across every connected system',
        icon: Database,
        action: () => {
          setCurrentView('financial-data-cloud');
          addToRecent('cmd-open-financial-data-cloud', 'Open Financial Data Cloud™', 'command');
        },
        group: 'Phase 16 — Cloud',
      },
      {
        id: 'cmd-open-event-streaming',
        label: 'Open Event Streaming Platform™',
        description: 'Realtime events: Invoice Created, Payment Received, GST Filed, Bank Synced, Webhook Delivery',
        icon: Radio,
        action: () => {
          setCurrentView('event-streaming');
          addToRecent('cmd-open-event-streaming', 'Open Event Streaming Platform™', 'command');
        },
        group: 'Phase 16 — Cloud',
      },
      {
        id: 'cmd-open-automation-studio',
        label: 'Open Enterprise Automation Studio™',
        description: 'Visual drag-and-drop workflow builder with triggers, conditions, AI nodes, API nodes, schedules',
        icon: Workflow,
        action: () => {
          setCurrentView('automation-studio');
          addToRecent('cmd-open-automation-studio', 'Open Enterprise Automation Studio™', 'command');
        },
        group: 'Phase 16 — Cloud',
      },
      {
        id: 'cmd-open-data-warehouse',
        label: 'Open Enterprise Data Warehouse™',
        description: 'Petabyte-scale analytics: realtime, historical, custom SQL, BI dashboards, AI queries, data lake',
        icon: BarChart3,
        action: () => {
          setCurrentView('data-warehouse');
          addToRecent('cmd-open-data-warehouse', 'Open Enterprise Data Warehouse™', 'command');
        },
        group: 'Phase 16 — Cloud',
      },
      {
        id: 'cmd-open-global-identity',
        label: 'Open Global Identity Platform™',
        description: 'Enterprise SSO, OAuth, SAML, Azure AD, Google, Microsoft, MFA, passwordless WebAuthn',
        icon: Fingerprint,
        action: () => {
          setCurrentView('global-identity');
          addToRecent('cmd-open-global-identity', 'Open Global Identity Platform™', 'command');
        },
        group: 'Phase 16 — Cloud',
      },
      {
        id: 'cmd-open-developer-analytics',
        label: 'Open Developer Analytics™',
        description: 'API usage, errors, latency, revenue, apps, downloads, subscriptions, usage trends',
        icon: Activity,
        action: () => {
          setCurrentView('developer-analytics');
          addToRecent('cmd-open-developer-analytics', 'Open Developer Analytics™', 'command');
        },
        group: 'Phase 16 — Cloud',
      },
      {
        id: 'cmd-open-enterprise-billing',
        label: 'Open Enterprise Billing Platform™',
        description: 'Subscriptions, usage billing, marketplace revenue, partner revenue, API billing, enterprise contracts',
        icon: CreditCard,
        action: () => {
          setCurrentView('enterprise-billing');
          addToRecent('cmd-open-enterprise-billing', 'Open Enterprise Billing Platform™', 'command');
        },
        group: 'Phase 16 — Cloud',
      },
      {
        id: 'cmd-open-multi-tenant-infra',
        label: 'Open Multi-Tenant Cloud Infra™',
        description: 'Millions of orgs, billions of API calls, 10 regions, auto-scaling, load balancing, edge, CDN, HA',
        icon: Server,
        action: () => {
          setCurrentView('multi-tenant-infra');
          addToRecent('cmd-open-multi-tenant-infra', 'Open Multi-Tenant Cloud Infra™', 'command');
        },
        group: 'Phase 16 — Cloud',
      },
      {
        id: 'cmd-open-enterprise-security-cloud',
        label: 'Open Enterprise Security™',
        description: 'API security, Zero Trust, encryption, secrets, rate limiting, threat detection, audit, compliance',
        icon: ShieldCheck,
        action: () => {
          setCurrentView('enterprise-security-cloud');
          addToRecent('cmd-open-enterprise-security-cloud', 'Open Enterprise Security™', 'command');
        },
        group: 'Phase 16 — Cloud',
      },
      {
        id: 'cmd-open-global-financial-network',
        label: 'Open Global Financial Network™',
        description: 'Secure org-to-org network: invoices, POs, payments, approvals, documents, vendor & customer collab',
        icon: Share2,
        action: () => {
          setCurrentView('global-financial-network');
          addToRecent('cmd-open-global-financial-network', 'Open Global Financial Network™', 'command');
        },
        group: 'Phase 16 — Cloud',
      },
      {
        id: 'cmd-open-platform-intelligence',
        label: 'Open Platform Intelligence™',
        description: 'AI monitors performance, scaling, security, costs, reliability, developer experience',
        icon: BrainCircuit,
        action: () => {
          setCurrentView('platform-intelligence');
          addToRecent('cmd-open-platform-intelligence', 'Open Platform Intelligence™', 'command');
        },
        group: 'Phase 16 — Cloud',
      },
    ],
    [setCurrentView, setCommandPaletteOpen, addToRecent]
  );

  // ─── Search results grouped by type ──────────────────────────────────────
  const searchResults = useMemo(() => {
    if (!query.trim()) {
      return {
        clients: [],
        invoices: [],
        returns: [],
        documents: [],
        activities: [],
        gstCustomers: [],
        gstProducts: [],
        gstInvoices: [],
      };
    }

    const q = query.toLowerCase();

    const matchedClients = clients
      .filter(
        (c) =>
          c.tradeName?.toLowerCase().includes(q) ||
          c.gstin?.toLowerCase().includes(q) ||
          c.legalName?.toLowerCase().includes(q)
      )
      .slice(0, 5);

    const matchedInvoices = invoices
      .filter(
        (inv) =>
          inv.invoiceNumber?.toLowerCase().includes(q) ||
          inv.buyerName?.toLowerCase().includes(q) ||
          inv.sellerGstin?.toLowerCase().includes(q)
      )
      .slice(0, 5);

    const matchedReturns = returns
      .filter(
        (r) =>
          r.returnType?.toLowerCase().includes(q) ||
          r.period?.toLowerCase().includes(q) ||
          r.status?.toLowerCase().includes(q)
      )
      .slice(0, 5);

    const matchedDocuments = documents
      .filter(
        (d) =>
          d.fileName?.toLowerCase().includes(q) ||
          d.documentType?.toLowerCase().includes(q) ||
          d.status?.toLowerCase().includes(q)
      )
      .slice(0, 5);

    const matchedActivities = activities
      .filter(
        (a) =>
          a.title?.toLowerCase().includes(q) ||
          a.description?.toLowerCase().includes(q)
      )
      .slice(0, 5);

    // ── GSTPilot live registry (organizations/GSTpilot_SAAS/*) ──
    const matchedGstCustomers = gstCustomers
      .filter(
        (c) =>
          c.name?.toLowerCase().includes(q) ||
          (c.gstin ?? '')?.toLowerCase().includes(q) ||
          (c.email ?? '')?.toLowerCase().includes(q) ||
          (c.phone ?? '')?.toLowerCase().includes(q) ||
          (c.state ?? '')?.toLowerCase().includes(q) ||
          (c.pan ?? '')?.toLowerCase().includes(q)
      )
      .slice(0, 5);

    const matchedGstProducts = gstProducts
      .filter(
        (p) =>
          p.name?.toLowerCase().includes(q) ||
          (p.sku ?? '')?.toLowerCase().includes(q) ||
          (p.hsnSac ?? '')?.toLowerCase().includes(q) ||
          (p.description ?? '')?.toLowerCase().includes(q)
      )
      .slice(0, 5);

    const matchedGstInvoices = gstInvoices
      .filter(
        (inv) =>
          inv.invoiceNumber?.toLowerCase().includes(q) ||
          (inv.customerName ?? '')?.toLowerCase().includes(q) ||
          (inv.customerGstin ?? '')?.toLowerCase().includes(q)
      )
      .slice(0, 5);

    return {
      clients: matchedClients,
      invoices: matchedInvoices,
      returns: matchedReturns,
      documents: matchedDocuments,
      activities: matchedActivities,
      gstCustomers: matchedGstCustomers,
      gstProducts: matchedGstProducts,
      gstInvoices: matchedGstInvoices,
    };
  }, [query, clients, invoices, returns, documents, activities, gstCustomers, gstProducts, gstInvoices]);

  const hasSearchResults =
    searchResults.clients.length > 0 ||
    searchResults.invoices.length > 0 ||
    searchResults.returns.length > 0 ||
    searchResults.documents.length > 0 ||
    searchResults.activities.length > 0 ||
    searchResults.gstCustomers.length > 0 ||
    searchResults.gstProducts.length > 0 ||
    searchResults.gstInvoices.length > 0;

  // ─── Handle item selection ───────────────────────────────────────────────
  const handleSelect = useCallback(
    (callback: () => void) => {
      setCommandPaletteOpen(false);
      callback();
    },
    [setCommandPaletteOpen]
  );

  const handleClientSelect = useCallback(
    (clientId: string, tradeName: string) => {
      setCommandPaletteOpen(false);
      setSelectedClientId(clientId);
      setCurrentView('client-workspace');
      addToRecent(`client-${clientId}`, tradeName, 'client');
    },
    [setCommandPaletteOpen, setSelectedClientId, setCurrentView, addToRecent]
  );

  const handleInvoiceSelect = useCallback(
    (invoiceNumber: string) => {
      setCommandPaletteOpen(false);
      setCurrentView('invoices');
      addToRecent(`invoice-${invoiceNumber}`, invoiceNumber, 'invoice');
    },
    [setCommandPaletteOpen, setCurrentView, addToRecent]
  );

  const handleReturnSelect = useCallback(
    (returnLabel: string, clientId: string | null) => {
      setCommandPaletteOpen(false);
      if (clientId) {
        setSelectedClientId(clientId);
      }
      setCurrentView('returns');
      addToRecent(`return-${returnLabel}`, returnLabel, 'return');
    },
    [setCommandPaletteOpen, setSelectedClientId, setCurrentView, addToRecent]
  );

  const handleDocumentSelect = useCallback(
    (fileName: string) => {
      setCommandPaletteOpen(false);
      setCurrentView('documents');
      addToRecent(`doc-${fileName}`, fileName, 'document');
    },
    [setCommandPaletteOpen, setCurrentView, addToRecent]
  );

  // ─── Recent commands filtered ────────────────────────────────────────────
  const recentCommands = useMemo(() => {
    return recentItems
      .map((r) => {
        if (r.type === 'command') {
          const cmd = commands.find((c) => c.id === r.id);
          return cmd || null;
        }
        return null;
      })
      .filter(Boolean) as CommandAction[];
  }, [recentItems, commands]);

  // ─── Favorite commands resolved ──────────────────────────────────────────
  const favoriteCommands = useMemo(() => {
    return favorites
      .map((f) => {
        const cmd = commands.find((c) => c.id === f.id);
        return cmd || null;
      })
      .filter(Boolean) as CommandAction[];
  }, [favorites, commands]);

  // ─── Is searching ────────────────────────────────────────────────────────
  const isSearching = query.trim().length > 0;

  return (
    <AnimatePresence>
      {commandPaletteOpen && (
        <>
          {/* Dark overlay with blur */}
          <motion.div
            key="cmd-overlay"
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed inset-0 z-[60] premium-backdrop"
            onClick={() => setCommandPaletteOpen(false)}
          />

          {/* Centered modal */}
          <motion.div
            key="cmd-modal"
            variants={modalEnterVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={springModalTransition}
            className="fixed left-1/2 top-[12%] z-[70] w-full max-w-xl -translate-x-1/2"
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
          >
            <div className="glass-surface-strong rounded-2xl shadow-[0_24px_70px_-12px_rgba(0,0,0,0.8)] overflow-hidden">
              {/* Search input */}
              <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/[0.08] bg-white/[0.03] transition-colors focus-within:border-emerald-400/50 focus-within:ring-1 focus-within:ring-emerald-400/40">
                <Search className="h-4 w-4 text-muted-foreground shrink-0 transition-colors" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Type a command or search..."
                  aria-label="Search commands"
                  className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/70"
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setCommandPaletteOpen(false);
                    }
                  }}
                />
                <kbd className="badge-premium hidden sm:inline-flex font-mono text-[10px]">
                  ESC
                </kbd>
              </div>

              {/* Results list */}
              <div className="max-h-[420px] overflow-y-auto overscroll-contain scrollbar-thin">
                {/* Empty state */}
                {isSearching && !hasSearchResults && (
                  <div className="py-10 text-center">
                    <Search className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                    <p className="text-sm text-foreground/70">
                      No results found for &ldquo;{query}&rdquo;
                    </p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      Try searching for clients, invoices, returns, or documents
                    </p>
                  </div>
                )}

                {/* ─── Favorites Section ──────────────────────────────────── */}
                {!isSearching && favoriteCommands.length > 0 && (
                  <div className="p-2">
                    <div className="flex items-center gap-1.5 px-2 py-1.5">
                      <Star className="h-3 w-3 text-cyan-400" />
                      <span className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-[0.12em]">
                        Favorites
                      </span>
                    </div>
                    {favoriteCommands.map((cmd) => (
                      <CommandItemRow
                        key={cmd.id}
                        icon={cmd.icon}
                        label={cmd.label}
                        description={cmd.description}
                        shortcut={cmd.shortcut}
                        isFavorite={favorites.some((f) => f.id === cmd.id)}
                        onToggleFavorite={() => toggleFavorite(cmd.id, cmd.label)}
                        onSelect={() => handleSelect(cmd.action)}
                      />
                    ))}
                  </div>
                )}

                {/* ─── Recent Section ─────────────────────────────────────── */}
                {!isSearching && recentCommands.length > 0 && (
                  <div className="p-2">
                    <div className="flex items-center gap-1.5 px-2 py-1.5">
                      <Clock className="h-3 w-3 text-muted-foreground/70" />
                      <span className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-[0.12em]">
                        Recent
                      </span>
                    </div>
                    {recentCommands.map((cmd) => (
                      <CommandItemRow
                        key={cmd.id}
                        icon={cmd.icon}
                        label={cmd.label}
                        description={cmd.description}
                        shortcut={cmd.shortcut}
                        isFavorite={favorites.some((f) => f.id === cmd.id)}
                        onToggleFavorite={() => toggleFavorite(cmd.id, cmd.label)}
                        onSelect={() => handleSelect(cmd.action)}
                      />
                    ))}
                  </div>
                )}

                {/* ─── Commands Section ───────────────────────────────────── */}
                {!isSearching && (
                  <div className="p-2">
                    <div className="flex items-center gap-1.5 px-2 py-1.5">
                      <Zap className="h-3 w-3 text-muted-foreground/70" />
                      <span className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-[0.12em]">
                        Commands
                      </span>
                    </div>
                    {commands.map((cmd) => (
                      <CommandItemRow
                        key={cmd.id}
                        icon={cmd.icon}
                        label={cmd.label}
                        description={cmd.description}
                        shortcut={cmd.shortcut}
                        isFavorite={favorites.some((f) => f.id === cmd.id)}
                        onToggleFavorite={() => toggleFavorite(cmd.id, cmd.label)}
                        onSelect={() => handleSelect(cmd.action)}
                      />
                    ))}
                  </div>
                )}

                {/* ─── Search Results: GSTPilot Customers ─────────────────── */}
                {isSearching && searchResults.gstCustomers.length > 0 && (
                  <div className="p-2">
                    <div className="flex items-center gap-1.5 px-2 py-1.5">
                      <Users className="h-3 w-3 text-emerald-400" />
                      <span className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-[0.12em]">
                        Customers
                      </span>
                      <span className="text-[10px] text-muted-foreground/70 ml-auto">
                        {searchResults.gstCustomers.length} found
                      </span>
                    </div>
                    {searchResults.gstCustomers.map((c) => (
                      <CommandItemRow
                        key={c.id}
                        icon={Users}
                        label={c.name}
                        description={`${c.gstin || 'No GSTIN'}${c.state ? ` · ${c.state}` : ''}`}
                        onSelect={() => {
                          setCommandPaletteOpen(false);
                          setCurrentView('crm');
                        }}
                      />
                    ))}
                  </div>
                )}

                {/* ─── Search Results: GSTPilot Products ──────────────────── */}
                {isSearching && searchResults.gstProducts.length > 0 && (
                  <div className="p-2">
                    <div className="flex items-center gap-1.5 px-2 py-1.5">
                      <Package className="h-3 w-3 text-emerald-400" />
                      <span className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-[0.12em]">
                        Products
                      </span>
                      <span className="text-[10px] text-muted-foreground/70 ml-auto">
                        {searchResults.gstProducts.length} found
                      </span>
                    </div>
                    {searchResults.gstProducts.map((p) => (
                      <CommandItemRow
                        key={p.id}
                        icon={Package}
                        label={p.name}
                        description={`${p.sku || 'No SKU'} · ${p.hsnSac} · GST ${p.gstRate}%`}
                        onSelect={() => {
                          setCommandPaletteOpen(false);
                          setCurrentView('inventory');
                        }}
                      />
                    ))}
                  </div>
                )}

                {/* ─── Search Results: GSTPilot Invoices ──────────────────── */}
                {isSearching && searchResults.gstInvoices.length > 0 && (
                  <div className="p-2">
                    <div className="flex items-center gap-1.5 px-2 py-1.5">
                      <FileText className="h-3 w-3 text-cyan-400" />
                      <span className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-[0.12em]">
                        Invoices
                      </span>
                      <span className="text-[10px] text-muted-foreground/70 ml-auto">
                        {searchResults.gstInvoices.length} found
                      </span>
                    </div>
                    {searchResults.gstInvoices.map((inv) => (
                      <CommandItemRow
                        key={inv.id}
                        icon={FileText}
                        label={inv.invoiceNumber}
                        description={`${inv.customerName} · ₹${inv.grandTotal.toLocaleString('en-IN')} · ${inv.status}`}
                        onSelect={() => {
                          setCommandPaletteOpen(false);
                          setCurrentView('invoices');
                        }}
                      />
                    ))}
                  </div>
                )}

                {/* ─── Search Results: Clients ────────────────────────────── */}
                {isSearching && searchResults.clients.length > 0 && (
                  <div className="p-2">
                    <div className="flex items-center gap-1.5 px-2 py-1.5">
                      <Building2 className="h-3 w-3 text-emerald-400" />
                      <span className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-[0.12em]">
                        Clients
                      </span>
                      <span className="text-[10px] text-muted-foreground/70 ml-auto">
                        {searchResults.clients.length} found
                      </span>
                    </div>
                    {searchResults.clients.map((c) => (
                      <CommandItemRow
                        key={c.id}
                        icon={Building2}
                        label={c.tradeName || c.legalName || 'Unknown'}
                        description={`${c.gstin}${c.state ? ` · ${c.state}` : ''}`}
                        onSelect={() =>
                          handleClientSelect(c.id, c.tradeName || c.legalName || 'Unknown')
                        }
                      />
                    ))}
                  </div>
                )}

                {/* ─── Search Results: Invoices ───────────────────────────── */}
                {isSearching && searchResults.invoices.length > 0 && (
                  <div className="p-2">
                    <div className="flex items-center gap-1.5 px-2 py-1.5">
                      <FileSpreadsheet className="h-3 w-3 text-cyan-400" />
                      <span className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-[0.12em]">
                        Invoices
                      </span>
                      <span className="text-[10px] text-muted-foreground/70 ml-auto">
                        {searchResults.invoices.length} found
                      </span>
                    </div>
                    {searchResults.invoices.map((inv) => (
                      <CommandItemRow
                        key={inv.id}
                        icon={FileSpreadsheet}
                        label={inv.invoiceNumber || 'Unknown'}
                        description={`${inv.invoiceType} · ₹${(inv.totalAmount || 0).toLocaleString('en-IN')}`}
                        onSelect={() => handleInvoiceSelect(inv.invoiceNumber || inv.id)}
                      />
                    ))}
                  </div>
                )}

                {/* ─── Search Results: Returns ────────────────────────────── */}
                {isSearching && searchResults.returns.length > 0 && (
                  <div className="p-2">
                    <div className="flex items-center gap-1.5 px-2 py-1.5">
                      <FileText className="h-3 w-3 text-blue-400" />
                      <span className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-[0.12em]">
                        Returns
                      </span>
                      <span className="text-[10px] text-muted-foreground/70 ml-auto">
                        {searchResults.returns.length} found
                      </span>
                    </div>
                    {searchResults.returns.map((r) => (
                      <CommandItemRow
                        key={r.id}
                        icon={FileText}
                        label={`${r.returnType} · ${r.period}`}
                        description={`${r.status}`}
                        onSelect={() =>
                          handleReturnSelect(
                            `${r.returnType} · ${r.period}`,
                            r.clientId || null
                          )
                        }
                      />
                    ))}
                  </div>
                )}

                {/* ─── Search Results: Documents ──────────────────────────── */}
                {isSearching && searchResults.documents.length > 0 && (
                  <div className="p-2">
                    <div className="flex items-center gap-1.5 px-2 py-1.5">
                      <FolderOpen className="h-3 w-3 text-cyan-400" />
                      <span className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-[0.12em]">
                        Documents
                      </span>
                      <span className="text-[10px] text-muted-foreground/70 ml-auto">
                        {searchResults.documents.length} found
                      </span>
                    </div>
                    {searchResults.documents.map((d) => (
                      <CommandItemRow
                        key={d.id}
                        icon={FolderOpen}
                        label={d.fileName || 'Unknown document'}
                        description={`${d.documentType} · ${d.status}`}
                        onSelect={() => handleDocumentSelect(d.fileName || d.id)}
                      />
                    ))}
                  </div>
                )}

                {/* ─── Search Results: Activities ─────────────────────────── */}
                {isSearching && searchResults.activities.length > 0 && (
                  <div className="p-2">
                    <div className="flex items-center gap-1.5 px-2 py-1.5">
                      <Activity className="h-3 w-3 text-blue-400" />
                      <span className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-[0.12em]">
                        Activities
                      </span>
                      <span className="text-[10px] text-muted-foreground/70 ml-auto">
                        {searchResults.activities.length} found
                      </span>
                    </div>
                    {searchResults.activities.map((a) => (
                      <CommandItemRow
                        key={a.id}
                        icon={Activity}
                        label={a.title || 'Activity'}
                        description={a.description?.slice(0, 60) || ''}
                        onSelect={() => {
                          setCommandPaletteOpen(false);
                          addToRecent(`activity-${a.id}`, a.title || 'Activity', 'activity');
                          if (a.clientId) {
                            setSelectedClientId(a.clientId);
                            setCurrentView('client-workspace');
                          }
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Footer with keyboard hints */}
              <div className="border-t border-white/[0.06] px-4 py-2.5 flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <kbd className="badge-premium font-mono text-[10px]">↑↓</kbd>
                  Navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="badge-premium font-mono text-[10px]">↵</kbd>
                  Select
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="badge-premium font-mono text-[10px]">esc</kbd>
                  Close
                </span>
                <span className="ml-auto flex items-center gap-1">
                  <Pin className="h-2.5 w-2.5" /> Click star to favorite
                </span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMMAND ITEM ROW — Reusable row for each palette item
// ═══════════════════════════════════════════════════════════════════════════════

interface CommandItemRowProps {
  icon: React.ElementType;
  label: string;
  description?: string;
  shortcut?: string;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  onSelect: () => void;
}

function CommandItemRow({
  icon: Icon,
  label,
  description,
  shortcut,
  isFavorite,
  onToggleFavorite,
  onSelect,
}: CommandItemRowProps) {
  const [hovered, setHovered] = React.useState(false);

  return (
    <motion.div
      className="group relative flex items-center gap-3 rounded-lg px-3 py-2 cursor-pointer transition-colors duration-150 hover:bg-white/[0.06]"
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      whileHover={{ x: 2 }}
      transition={{ duration: 0.1 }}
    >
      {/* Active left accent bar */}
      <span className="absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-full bg-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity duration-150" />
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/[0.04] transition-colors group-hover:bg-emerald-400/10">
        <Icon className="h-3.5 w-3.5 text-muted-foreground transition-colors group-hover:text-emerald-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{label}</p>
        {description && (
          <p className="text-xs text-muted-foreground truncate">{description}</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {/* Favorite toggle for commands */}
        {onToggleFavorite && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite();
            }}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-white/[0.08] rounded"
            aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Star
              className={`h-3 w-3 ${
                isFavorite
                  ? 'fill-cyan-400 text-cyan-400'
                  : 'text-muted-foreground/70'
              }`}
            />
          </button>
        )}
        {shortcut && (
          <kbd className="badge-premium hidden sm:inline-flex font-mono text-[10px]">
            {shortcut}
          </kbd>
        )}
        <ArrowRight className="h-3 w-3 text-transparent group-hover:text-muted-foreground transition-colors" />
      </div>
    </motion.div>
  );
}

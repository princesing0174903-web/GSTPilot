'use client';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * GSTPilot Infinity™ — Unified Navigation Registry
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * ONE source of truth for:
 *   • Sidebar nav items (only REAL, working features — no dead links)
 *   • Page metadata (title, subtitle, icon, breadcrumb) for every view
 *   • Feature categorization (Core / Finance / Integrations / System)
 *
 * The sidebar shows ONLY items marked `inSidebar: true`.
 * Every view gets a breadcrumb + page header from its registry entry.
 *
 * This replaces the old 10-item nav that pointed to fake/coming-soon pages.
 * A premium product has a SHORT nav — everything else is reachable via Search.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import {
  Home,
  BrainCircuit,
  FileText,
  Users,
  ClipboardCheck,
  Cloud,
  BookOpen,
  Settings,
  Landmark,
  BarChart3,
  type LucideIcon,
} from 'lucide-react';
import type { AppView } from '@/contexts/AppContext';

export interface NavEntry {
  view: AppView;
  label: string;
  icon: LucideIcon;
  /** Show in the left sidebar (default false — only core features) */
  inSidebar?: boolean;
  /** External href (e.g. /oracle) — navigates via router instead of setCurrentView */
  href?: string;
  /** Short description for breadcrumb / page header subtitle */
  description?: string;
  /** Category for grouping */
  category?: 'core' | 'finance' | 'integrations' | 'system';
  /** Badge text (e.g. "Beta") */
  badge?: string;
}

/**
 * The canonical view registry. Every view in the app has an entry here.
 * Only views with `inSidebar: true` appear in the left navigation.
 */
export const VIEW_REGISTRY: Record<string, NavEntry> = {
  // ── Core ──
  dashboard: {
    view: 'dashboard',
    label: 'Home',
    icon: Home,
    inSidebar: true,
    description: 'Your business command center — KPIs, priorities, and live activity.',
    category: 'core',
  },
  'oracle-brain': {
    view: 'oracle-brain',
    label: 'Oracle AI',
    icon: BrainCircuit,
    inSidebar: true,
    href: '/oracle',
    description: 'Your AI financial brain — ask anything, get instant insights.',
    category: 'core',
    badge: 'AI',
  },

  // ── Finance (real, working) ──
  invoices: {
    view: 'invoices',
    label: 'Invoices',
    icon: FileText,
    inSidebar: true,
    description: 'Create, track, and manage GST-compliant invoices.',
    category: 'finance',
  },
  clients: {
    view: 'clients',
    label: 'Customers',
    icon: Users,
    inSidebar: true,
    description: 'Your customer registry — contacts, GSTIN, and transaction history.',
    category: 'finance',
  },
  returns: {
    view: 'returns',
    label: 'Returns',
    icon: ClipboardCheck,
    inSidebar: true,
    description: 'GST returns — create, validate, and file GSTR-1 and GSTR-3B.',
    category: 'finance',
  },
  banking: {
    view: 'banking',
    label: 'Banking',
    icon: Landmark,
    inSidebar: true,
    description: 'Bank accounts, transactions, reconciliation, and cash flow.',
    category: 'finance',
    badge: 'Sandbox',
  },
  reports: {
    view: 'reports',
    label: 'Reports',
    icon: BarChart3,
    inSidebar: true,
    description: 'Financial reports, filing summaries, and business analytics.',
    category: 'finance',
  },

  // ── Integrations (real, shown in secondary sidebar section) ──
  'google-workspace': {
    view: 'google-workspace',
    label: 'Google',
    icon: Cloud,
    inSidebar: true,
    description: 'Connect Google Workspace to sync Gmail, Drive, and Calendar data.',
    category: 'integrations',
  },
  'zoho-books': {
    view: 'zoho-books',
    label: 'Zoho Books',
    icon: BookOpen,
    inSidebar: true,
    description: 'Connect Zoho Books to sync invoices, customers, vendors, and payments.',
    category: 'integrations',
  },

  // ── System ──
  settings: {
    view: 'settings',
    label: 'Settings',
    icon: Settings,
    inSidebar: true,
    description: 'Manage your organization, team, billing, and integrations.',
    category: 'system',
  },

  // ── Non-sidebar views (still need metadata for breadcrumbs) ──
  'client-workspace': {
    view: 'client-workspace',
    label: 'Customer Details',
    icon: Users,
    description: 'Individual customer workspace.',
    category: 'finance',
  },
  'return-prep': {
    view: 'return-prep',
    label: 'Prepare Return',
    icon: ClipboardCheck,
    description: 'Prepare and file a GST return.',
    category: 'finance',
  },
  reconcile: {
    view: 'reconcile',
    label: 'Reconciliation',
    icon: ClipboardCheck,
    description: 'Reconcile invoices, payments, and bank transactions.',
    category: 'finance',
  },
  tasks: {
    view: 'tasks',
    label: 'Tasks',
    icon: ClipboardCheck,
    description: 'Your task queue and filing deadlines.',
    category: 'core',
  },
  timeline: {
    view: 'timeline',
    label: 'Timeline',
    icon: Home,
    description: 'Every business event, in chronological order.',
    category: 'core',
  },
  vendors: {
    view: 'vendors',
    label: 'Vendors',
    icon: Users,
    description: 'Your vendor registry.',
    category: 'finance',
  },
  expenses: {
    view: 'expenses',
    label: 'Expenses',
    icon: FileText,
    description: 'Track and categorize business expenses.',
    category: 'finance',
  },
  payments: {
    view: 'payments',
    label: 'Payments',
    icon: FileText,
    description: 'Track incoming and outgoing payments.',
    category: 'finance',
  },
  inventory: {
    view: 'inventory',
    label: 'Products',
    icon: FileText,
    description: 'Your product and services catalog.',
    category: 'finance',
  },
  'ai-business-copilot': {
    view: 'ai-business-copilot',
    label: 'Oracle Chat',
    icon: BrainCircuit,
    description: 'Chat with Oracle about your business.',
    category: 'core',
  },
};

/**
 * Sidebar items — only views with inSidebar: true, in the defined order.
 */
export const SIDEBAR_ITEMS: NavEntry[] = Object.values(VIEW_REGISTRY).filter(
  (v) => v.inSidebar,
);

/**
 * Get metadata for a view. Falls back to a generic entry for unknown views
 * (so breadcrumbs never break).
 */
export function getViewMeta(view: string): NavEntry {
  return (
    VIEW_REGISTRY[view] ?? {
      view: view as AppView,
      label: view.charAt(0).toUpperCase() + view.slice(1).replace(/-/g, ' '),
      icon: Home,
      description: '',
      category: 'core',
    }
  );
}

/**
 * Build a breadcrumb trail for a view.
 * Returns: [{ label: 'Home', onClick }, { label: 'Invoices' }]
 */
export function getBreadcrumbs(
  view: string,
  goHome: () => void,
  goToList?: (v: AppView) => void,
): { label: string; onClick?: () => void }[] {
  const meta = getViewMeta(view);
  const crumbs: { label: string; onClick?: () => void }[] = [
    { label: 'Home', onClick: goHome },
  ];

  // Detail views: Home > List > Detail
  if (view === 'client-workspace') {
    crumbs.push({
      label: 'Customers',
      onClick: goToList ? () => goToList('clients') : undefined,
    });
    crumbs.push({ label: 'Details' });
  } else if (view === 'return-prep') {
    crumbs.push({
      label: 'Returns',
      onClick: goToList ? () => goToList('returns') : undefined,
    });
    crumbs.push({ label: 'Prepare' });
  } else if (view !== 'dashboard') {
    crumbs.push({ label: meta.label });
  }

  return crumbs;
}

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
} from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import {
  useFireClients,
  useFireInvoices,
  useFireReturns,
  useFireDocuments,
  useFireRecentActivities,
} from '@/hooks/use-firestore';
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
    ],
    [setCurrentView, setCommandPaletteOpen, addToRecent]
  );

  // ─── Search results grouped by type ──────────────────────────────────────
  const searchResults = useMemo(() => {
    if (!query.trim()) return { clients: [], invoices: [], returns: [], documents: [], activities: [] };

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

    return {
      clients: matchedClients,
      invoices: matchedInvoices,
      returns: matchedReturns,
      documents: matchedDocuments,
      activities: matchedActivities,
    };
  }, [query, clients, invoices, returns, documents, activities]);

  const hasSearchResults =
    searchResults.clients.length > 0 ||
    searchResults.invoices.length > 0 ||
    searchResults.returns.length > 0 ||
    searchResults.documents.length > 0 ||
    searchResults.activities.length > 0;

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

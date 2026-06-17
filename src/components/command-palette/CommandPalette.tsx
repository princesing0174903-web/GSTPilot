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
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm"
            onClick={() => setCommandPaletteOpen(false)}
          />

          {/* Centered modal */}
          <motion.div
            key="cmd-modal"
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="fixed left-1/2 top-[12%] z-[70] w-full max-w-xl -translate-x-1/2"
          >
            <div className="rounded-xl border bg-background shadow-2xl overflow-hidden">
              {/* Search input */}
              <div className="flex items-center gap-3 px-4 py-3 border-b">
                <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Type a command or search..."
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setCommandPaletteOpen(false);
                    }
                  }}
                />
                <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                  ESC
                </kbd>
              </div>

              {/* Results list */}
              <div className="max-h-[420px] overflow-y-auto overscroll-contain scrollbar-thin">
                {/* Empty state */}
                {isSearching && !hasSearchResults && (
                  <div className="py-10 text-center">
                    <Search className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      No results found for &ldquo;{query}&rdquo;
                    </p>
                    <p className="text-xs text-muted-foreground/60 mt-1">
                      Try searching for clients, invoices, returns, or documents
                    </p>
                  </div>
                )}

                {/* ─── Favorites Section ──────────────────────────────────── */}
                {!isSearching && favoriteCommands.length > 0 && (
                  <div className="p-2">
                    <div className="flex items-center gap-1.5 px-2 py-1.5">
                      <Star className="h-3 w-3 text-amber-500" />
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
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
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
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
                      <Zap className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
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
                      <Building2 className="h-3 w-3 text-emerald-600" />
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Clients
                      </span>
                      <span className="text-[10px] text-muted-foreground/60 ml-auto">
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
                      <FileSpreadsheet className="h-3 w-3 text-amber-600" />
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Invoices
                      </span>
                      <span className="text-[10px] text-muted-foreground/60 ml-auto">
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
                      <FileText className="h-3 w-3 text-blue-600" />
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Returns
                      </span>
                      <span className="text-[10px] text-muted-foreground/60 ml-auto">
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
                      <FolderOpen className="h-3 w-3 text-orange-600" />
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Documents
                      </span>
                      <span className="text-[10px] text-muted-foreground/60 ml-auto">
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
                      <Activity className="h-3 w-3 text-purple-600" />
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Activities
                      </span>
                      <span className="text-[10px] text-muted-foreground/60 ml-auto">
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
              <div className="border-t bg-muted/30 px-4 py-2 flex items-center gap-4 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <kbd className="rounded border bg-background px-1 py-0.5 font-mono">↑↓</kbd>
                  Navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="rounded border bg-background px-1 py-0.5 font-mono">↵</kbd>
                  Select
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="rounded border bg-background px-1 py-0.5 font-mono">esc</kbd>
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
      className="group flex items-center gap-3 rounded-lg px-3 py-2 cursor-pointer transition-colors hover:bg-accent"
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      whileHover={{ x: 2 }}
      transition={{ duration: 0.1 }}
    >
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted/60">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{label}</p>
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
            className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-accent rounded"
            aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Star
              className={`h-3 w-3 ${
                isFavorite
                  ? 'fill-amber-400 text-amber-400'
                  : 'text-muted-foreground/60'
              }`}
            />
          </button>
        )}
        {shortcut && (
          <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
            {shortcut}
          </kbd>
        )}
        <ArrowRight className="h-3 w-3 text-muted-foreground/0 group-hover:text-muted-foreground/60 transition-colors" />
      </div>
    </motion.div>
  );
}

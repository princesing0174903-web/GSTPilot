'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useClients, useInvoices, useFilings, useIssues } from '@/hooks/api';
import { useApp } from '@/contexts/AppContext';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import {
  Building2,
  FileText,
  FileScan,
  GitCompareArrows,
  Search,
  ArrowRight,
  Loader2,
} from 'lucide-react';

const TYPE_CONFIG = {
  client: { label: 'Client', icon: Building2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  document: { label: 'Document', icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50' },
  return: { label: 'Return', icon: FileScan, color: 'text-amber-600', bg: 'bg-amber-50' },
  reconciliation: { label: 'Reconciliation', icon: GitCompareArrows, color: 'text-purple-600', bg: 'bg-purple-50' },
} as const;

interface SearchResult {
  type: string;
  id: string;
  clientId: string | null;
  title: string;
  subtitle: string;
}

export default function GlobalSearch() {
  const { setCurrentView, setSelectedClientId } = useApp();
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch data via React Query hooks
  const { data: clientsData, isLoading: clientsLoading } = useClients();
  const { data: invoicesData, isLoading: invoicesLoading } = useInvoices();
  const { data: filingsData, isLoading: filingsLoading } = useFilings();
  const { data: issuesData, isLoading: issuesLoading } = useIssues();

  const isLoading = clientsLoading || invoicesLoading || filingsLoading || issuesLoading;

  // Derive search results from React Query data
  const results = useMemo<SearchResult[]>(() => {
    if (!query.trim()) return [];

    const q = query.toLowerCase();
    const found: SearchResult[] = [];

    // Search clients
    const clients = clientsData?.clients ?? [];
    for (const client of clients) {
      if (
        client.tradeName?.toLowerCase().includes(q) ||
        client.gstin?.toLowerCase().includes(q) ||
        client.legalName?.toLowerCase().includes(q) ||
        client.state?.toLowerCase().includes(q)
      ) {
        found.push({
          type: 'client',
          id: client.id,
          clientId: client.id,
          title: client.tradeName,
          subtitle: `${client.gstin}${client.state ? ` · ${client.state}` : ''}`,
        });
      }
    }

    // Search invoices (documents)
    const invoices = invoicesData?.invoices ?? [];
    for (const inv of invoices) {
      if (
        inv.invoiceNumber?.toLowerCase().includes(q) ||
        inv.buyerName?.toLowerCase().includes(q) ||
        inv.sellerGstin?.toLowerCase().includes(q) ||
        inv.buyerGstin?.toLowerCase().includes(q) ||
        inv.hsnCode?.toLowerCase().includes(q)
      ) {
        found.push({
          type: 'document',
          id: inv.id,
          clientId: inv.clientId,
          title: inv.invoiceNumber,
          subtitle: `${inv.invoiceType} · ₹${inv.totalAmount.toLocaleString()}`,
        });
      }
    }

    // Search filings (returns)
    const filings = filingsData?.filings ?? [];
    for (const filing of filings) {
      if (
        filing.returnType?.toLowerCase().includes(q) ||
        filing.period?.toLowerCase().includes(q) ||
        filing.acknowledgmentNumber?.toLowerCase().includes(q) ||
        filing.status?.toLowerCase().includes(q)
      ) {
        found.push({
          type: 'return',
          id: filing.id,
          clientId: filing.clientId,
          title: `${filing.returnType} · ${filing.period}`,
          subtitle: `${filing.status} · ₹${filing.totalTaxableValue.toLocaleString()}`,
        });
      }
    }

    // Search issues (reconciliation)
    const issues = issuesData?.issues ?? [];
    for (const issue of issues) {
      if (
        issue.title?.toLowerCase().includes(q) ||
        issue.category?.toLowerCase().includes(q) ||
        issue.description?.toLowerCase().includes(q) ||
        issue.severity?.toLowerCase().includes(q)
      ) {
        found.push({
          type: 'reconciliation',
          id: issue.id,
          clientId: issue.clientId,
          title: issue.title,
          subtitle: `${issue.category} · ${issue.severity}`,
        });
      }
    }

    return found.slice(0, 20);
  }, [query, clientsData, invoicesData, filingsData, issuesData]);

  useEffect(() => {
    if (searchOpen) {
      const frame = requestAnimationFrame(() => {
        setQuery('');
        inputRef.current?.focus();
      });
      return () => cancelAnimationFrame(frame);
    }
  }, [searchOpen]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(prev => !prev);
      }
      if (e.key === 'Escape' && searchOpen) {
        setSearchOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [searchOpen]);

  const handleSelect = (result: SearchResult) => {
    setSearchOpen(false);
    if (result.clientId) {
      setSelectedClientId(result.clientId);
      setCurrentView('client-workspace');
    }
  };

  return (
    <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search clients, GSTIN, invoices, returns..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 rounded border bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
            ESC
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto">
          {/* Loading state */}
          {query.trim() && isLoading && (
            <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching...
            </div>
          )}

          {/* No results */}
          {query.trim() && !isLoading && results.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No results for &quot;{query}&quot;
            </div>
          )}

          {/* Empty prompt */}
          {!query.trim() && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              Start typing to search across clients, documents, returns, and reconciliations
            </div>
          )}

          {/* Results */}
          <AnimatePresence>
            {!isLoading && results.map(result => {
              const cfg = TYPE_CONFIG[result.type as keyof typeof TYPE_CONFIG] ?? TYPE_CONFIG.client;
              const Icon = cfg.icon;
              return (
                <motion.button
                  key={`${result.type}-${result.id}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors text-left"
                  onClick={() => handleSelect(result)}
                >
                  <div className={`flex items-center justify-center h-8 w-8 rounded-lg ${cfg.bg} shrink-0`}>
                    <Icon className={`h-4 w-4 ${cfg.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{result.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{result.subtitle}</p>
                  </div>
                  <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider shrink-0">
                    {cfg.label}
                  </span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                </motion.button>
              );
            })}
          </AnimatePresence>
        </div>

        <div className="px-4 py-2 border-t bg-slate-50/50">
          <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <kbd className="rounded border bg-white px-1 py-0.5 font-mono">↑↓</kbd> Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border bg-white px-1 py-0.5 font-mono">↵</kbd> Open
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border bg-white px-1 py-0.5 font-mono">⌘K</kbd> Search
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

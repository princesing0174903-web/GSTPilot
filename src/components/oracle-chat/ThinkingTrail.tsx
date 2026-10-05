'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// ORACLE CHAT — Thinking Trail (reasoning animation)
// ═══════════════════════════════════════════════════════════════════════════════
// Animated display of Oracle's tool orchestration: shows each tool call with
// a spinner while executing, then resolves with the record count and duration.
// ═══════════════════════════════════════════════════════════════════════════════

import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, CheckCircle2, Database, Search, Brain, Sparkles } from 'lucide-react';
import type { ToolCall, ToolResult } from '@/lib/oracle-chat/types';

const TOOL_ICONS: Record<string, typeof Database> = {
  memory_snapshot: Brain,
  search_invoices: Search,
  search_payments: Search,
  search_customers: Search,
  search_vendors: Search,
  search_expenses: Search,
  search_purchases: Search,
  search_gst_returns: Search,
  search_tds: Search,
  search_emails: Search,
  search_bank_transactions: Search,
  receivables_summary: Database,
  payables_summary: Database,
  cash_flow_summary: Database,
  gst_liability: Database,
  overdue_invoices: Database,
  customer_followups: Database,
  revenue_trend: Database,
  expense_breakdown: Database,
  executive_kpis: Database,
};

export function ThinkingTrail({
  toolCalls,
  toolResults,
  streaming,
}: {
  toolCalls: ToolCall[];
  toolResults: ToolResult[];
  streaming: boolean;
}) {
  if (toolCalls.length === 0 && !streaming) return null;

  const resultMap = new Map(toolResults.map((r) => [r.name, r]));

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="mb-3 overflow-hidden"
    >
      <div className="rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-transparent p-3">
        <div className="mb-2.5 flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
          <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">
            {streaming ? 'Oracle is reasoning' : 'Reasoning trail'}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <AnimatePresence mode="popLayout">
            {toolCalls.map((call, i) => {
              const result = resultMap.get(call.name);
              const done = !!result;
              const Icon = TOOL_ICONS[call.name] || Database;
              return (
                <motion.div
                  key={`${call.name}-${i}`}
                  layout
                  initial={{ opacity: 0, scale: 0.9, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ delay: i * 0.05 }}
                  className="group relative flex items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-1.5"
                  title={call.reason}
                >
                  <Icon className={`h-3.5 w-3.5 ${done ? 'text-emerald-400' : 'text-zinc-400'}`} />
                  <span className="text-xs font-medium text-zinc-300">{call.label}</span>
                  {done ? (
                    <span className="flex items-center gap-1 text-[11px] text-zinc-500">
                      <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                      {result.recordCount > 0 ? `${result.recordCount} records` : 'empty'}
                      <span className="text-zinc-600">·{result.durationMs}ms</span>
                    </span>
                  ) : (
                    <Loader2 className="h-3 w-3 animate-spin text-emerald-400" />
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

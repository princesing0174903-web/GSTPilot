'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// ORACLE CHAT — Confidence Meter & Sources Panel
// ═══════════════════════════════════════════════════════════════════════════════

import { motion } from 'framer-motion';
import { FileText, User, Building2, CreditCard, Receipt, Banknote, Mail, Calculator, Package, ShieldCheck } from 'lucide-react';
import type { SourceRef } from '@/lib/oracle-chat/types';

const KIND_ICON: Record<SourceRef['kind'], typeof FileText> = {
  invoice: FileText,
  client: User,
  vendor: Building2,
  payment: CreditCard,
  expense: Receipt,
  purchaseBill: Package,
  gstReturn: Calculator,
  gstFiling: Calculator,
  bankAccount: Banknote,
  bankTransaction: Banknote,
  email: Mail,
  tds: ShieldCheck,
  employee: User,
  payroll: Receipt,
  notice: FileText,
  task: FileText,
};

const KIND_COLOR: Record<SourceRef['kind'], string> = {
  invoice: 'text-sky-300 bg-sky-400/10 ring-sky-400/20',
  client: 'text-violet-300 bg-violet-400/10 ring-violet-400/20',
  vendor: 'text-amber-300 bg-amber-400/10 ring-amber-400/20',
  payment: 'text-emerald-300 bg-emerald-400/10 ring-emerald-400/20',
  expense: 'text-rose-300 bg-rose-400/10 ring-rose-400/20',
  purchaseBill: 'text-orange-300 bg-orange-400/10 ring-orange-400/20',
  gstReturn: 'text-cyan-300 bg-cyan-400/10 ring-cyan-400/20',
  gstFiling: 'text-cyan-300 bg-cyan-400/10 ring-cyan-400/20',
  bankAccount: 'text-teal-300 bg-teal-400/10 ring-teal-400/20',
  bankTransaction: 'text-teal-300 bg-teal-400/10 ring-teal-400/20',
  email: 'text-indigo-300 bg-indigo-400/10 ring-indigo-400/20',
  tds: 'text-fuchsia-300 bg-fuchsia-400/10 ring-fuchsia-400/20',
  employee: 'text-lime-300 bg-lime-400/10 ring-lime-400/20',
  payroll: 'text-lime-300 bg-lime-400/10 ring-lime-400/20',
  notice: 'text-red-300 bg-red-400/10 ring-red-400/20',
  task: 'text-zinc-300 bg-zinc-400/10 ring-zinc-400/20',
};

function inrFmt(n: number): string {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.round(n));
}

export function ConfidenceMeter({ score }: { score: number }) {
  const color = score >= 80 ? 'emerald' : score >= 60 ? 'amber' : score >= 40 ? 'orange' : 'rose';
  const colorMap: Record<string, { bar: string; text: string; ring: string }> = {
    emerald: { bar: 'bg-emerald-400', text: 'text-emerald-300', ring: 'ring-emerald-400/30' },
    amber: { bar: 'bg-amber-400', text: 'text-amber-300', ring: 'ring-amber-400/30' },
    orange: { bar: 'bg-orange-400', text: 'text-orange-300', ring: 'ring-orange-400/30' },
    rose: { bar: 'bg-rose-400', text: 'text-rose-300', ring: 'ring-rose-400/30' },
  };
  const c = colorMap[color];
  const label = score >= 90 ? 'Very High' : score >= 75 ? 'High' : score >= 60 ? 'Moderate' : score >= 40 ? 'Low' : 'Very Low';

  return (
    <div className={`flex items-center gap-3 rounded-lg bg-black/30 px-3 py-2 ring-1 ring-inset ${c.ring}`}>
      <div className="flex-1">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">Confidence</span>
          <span className={`text-sm font-bold ${c.text}`}>{score}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${score}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className={`h-full ${c.bar}`}
          />
        </div>
      </div>
      <span className={`text-[11px] font-medium ${c.text}`}>{label}</span>
    </div>
  );
}

export function SourcesPanel({ sources }: { sources: SourceRef[] }) {
  if (!sources || sources.length === 0) return null;
  // Group by kind
  const grouped = new Map<SourceRef['kind'], SourceRef[]>();
  for (const s of sources) {
    const arr = grouped.get(s.kind) ?? [];
    arr.push(s);
    grouped.set(s.kind, arr);
  }

  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
      <div className="mb-2.5 flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
          Source Records ({sources.length})
        </span>
        <span className="text-[11px] text-zinc-500">{grouped.size} types</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {Array.from(grouped.entries()).map(([kind, items]) => {
          const Icon = KIND_ICON[kind] || FileText;
          const color = KIND_COLOR[kind] || KIND_COLOR.task;
          const total = items.reduce((s, i) => s + (i.amount || 0), 0);
          return (
            <div
              key={kind}
              className={`group flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] ring-1 ring-inset ${color}`}
              title={`${items.length} ${kind} record(s)${total > 0 ? ` · ₹${inrFmt(total)}` : ''}`}
            >
              <Icon className="h-3 w-3" />
              <span className="font-medium capitalize">{kind.replace(/([A-Z])/g, ' $1').trim()}</span>
              <span className="opacity-70">{items.length}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

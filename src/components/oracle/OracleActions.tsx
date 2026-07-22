'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// Oracle Actions — Quick-action buttons below Oracle responses
//
// Instead of typing, users can click action buttons to trigger common tasks.
// Each button sends a pre-formed prompt to Oracle.
// ═══════════════════════════════════════════════════════════════════════════════

import { motion } from 'framer-motion';
import {
  FilePlus, IndianRupee, Bell, FileCheck, Mail, TrendingUp,
} from 'lucide-react';

interface ActionDef {
  icon: typeof FilePlus;
  label: string;
  prompt: string;
  color: string;
}

const ACTIONS: ActionDef[] = [
  { icon: FilePlus, label: 'Create Invoice', prompt: 'Create a new invoice', color: 'text-amber-400' },
  { icon: IndianRupee, label: 'Collect Payment', prompt: 'Show me outstanding payments to collect', color: 'text-emerald-400' },
  { icon: Bell, label: 'Send Reminder', prompt: 'Send payment reminders to overdue customers', color: 'text-cyan-400' },
  { icon: FileCheck, label: 'Generate GST Return', prompt: 'Generate my GST return for this period', color: 'text-violet-400' },
  { icon: Mail, label: 'Email Client', prompt: 'Draft an email to my top customer', color: 'text-amber-400' },
  { icon: TrendingUp, label: 'Forecast Cashflow', prompt: 'Forecast my cash flow for the next 30 days', color: 'text-emerald-400' },
];

export function OracleActions({ onAction }: { onAction: (prompt: string) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="mt-4"
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40 mb-2.5 px-1">
        Oracle Actions
      </p>
      <div className="flex flex-wrap gap-2">
        {ACTIONS.map((action, i) => {
          const Icon = action.icon;
          return (
            <motion.button
              key={action.label}
              whileHover={{ scale: 1.03, y: -1 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onAction(action.prompt)}
              className="group flex items-center gap-2 rounded-full border border-[#1F1F1F] bg-[#111111] px-3.5 py-2 transition-all hover:border-amber-500/30 hover:bg-[#161616]"
            >
              <Icon className={`h-3.5 w-3.5 ${action.color}`} />
              <span className="text-[12px] font-medium text-white/70 group-hover:text-white">
                {action.label}
              </span>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}

export default OracleActions;

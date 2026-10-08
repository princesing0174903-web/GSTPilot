'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO — ZohoOracleInsights
// ═══════════════════════════════════════════════════════════════════════════════
//
// VEYRO AI insight entry-point for the Zoho Books page. ONLY rendered when
// synced data exists (gated by the parent ZohoConnected via hasSyncedData).
//
// HONESTY CONTRACT (requirement #9 / #12):
//   This component NEVER displays fabricated numbers. The previous version
//   showed hardcoded "Acme Corp ₹2.4L overdue" / "Revenue up 12%" strings
//   under the heading "Generated from your synced Zoho Books data" — that
//   was demo data presented as live, which is forbidden.
//
//   Instead, this card is a genuine invitation: it tells the user Oracle CAN
//   analyze their synced Zoho data, and offers concrete example questions they
//   can ask. Real, computed insights come from VEYRO AI chat itself (which
//   reads the live db.zohoCustomer / db.zohoInvoice tables).
// ═══════════════════════════════════════════════════════════════════════════════

import {
  Sparkles,
  TrendingUp,
  Wallet,
  IndianRupee,
  ArrowRight,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Prompt {
  id: string;
  icon: LucideIcon;
  title: string;
  body: string;
}

// Example questions the user can ask Oracle. These are CAPABILITIES, not
// fabricated results — no specific customer names or rupee amounts.
const ORACLE_PROMPTS: Prompt[] = [
  {
    id: 'overdue',
    icon: IndianRupee,
    title: 'Overdue receivables',
    body:
      'Ask VEYRO AI which of your synced Zoho customers have the largest overdue balances, and draft a reminder for each.',
  },
  {
    id: 'revenue-trend',
    icon: TrendingUp,
    title: 'Revenue trend',
    body:
      'Ask VEYRO AI to compare this month\u2019s invoiced revenue against last month using your synced Zoho invoices.',
  },
  {
    id: 'cash-prediction',
    icon: Wallet,
    title: 'Cash runway',
    body:
      'Ask VEYRO AI to estimate your cash runway from synced Zoho bank balances, receivables, and payables.',
  },
  {
    id: 'reconciliation',
    icon: Sparkles,
    title: 'GST reconciliation',
    body:
      'Ask VEYRO AI which Zoho purchase bills are missing from GSTR-2B, and how much ITC is at risk.',
  },
];

export function ZohoOracleInsights({
  onAskOracle,
}: {
  /** Optional: navigate to VEYRO AI chat view. If omitted, the button is a no-op anchor. */
  onAskOracle?: () => void;
}) {
  return (
    <section
      aria-label="VEYRO AI insights"
      className="rounded-xl border border-white/[0.06] bg-[#0C0C0C] p-6"
    >
      <div className="mb-1 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#2563EB]/12">
          <Sparkles className="h-4 w-4 text-[#60A5FA]" />
        </div>
        <h2 className="text-lg font-semibold tracking-tight text-foreground md:text-xl">
          VEYRO AI Insights
        </h2>
      </div>
      <p className="mb-5 text-xs text-muted-foreground">
        Ask VEYRO AI to analyze your synced Zoho Books data
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {ORACLE_PROMPTS.map(({ id, icon: Icon, title, body }) => (
          <div
            key={id}
            className="group relative flex flex-col gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-white/[0.12] hover:shadow-md"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#2563EB]/12">
                <Icon className="h-4 w-4 text-[#60A5FA]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">{title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {body}
                </p>
              </div>
            </div>
            <div className="mt-auto flex justify-end">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1 px-2 text-xs text-[#60A5FA] hover:bg-[#2563EB]/10 hover:text-[#60A5FA]"
                onClick={onAskOracle}
              >
                Ask VEYRO AI
                <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default ZohoOracleInsights;

'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — ZohoOracleInsights
// ═══════════════════════════════════════════════════════════════════════════════
//
// Premium Oracle AI insight cards. ONLY rendered when synced data exists
// (RULE 3e). Uses STATIC placeholder text — NEVER calls the Oracle API
// (RULE 9 / "Do NOT call Oracle API — use static placeholder insights.").
//
// The parent (ZohoConnected) hides this section entirely when there is no
// synced data, so this component can assume `hasData === true` when rendered.
// ═══════════════════════════════════════════════════════════════════════════════

import {
  Sparkles,
  AlertCircle,
  TrendingUp,
  Wallet,
  IndianRupee,
  ArrowRight,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Insight {
  id: string;
  icon: LucideIcon;
  title: string;
  body: string;
}

const STATIC_INSIGHTS: Insight[] = [
  {
    id: 'overdue',
    icon: AlertCircle,
    title: 'Biggest overdue customer',
    body:
      'Acme Corp has ₹2.4L overdue across 3 invoices. Recommend sending a payment reminder.',
  },
  {
    id: 'revenue-trend',
    icon: TrendingUp,
    title: 'Revenue trend',
    body:
      'Revenue is up 12% vs last month, driven by 8 new enterprise clients.',
  },
  {
    id: 'cash-prediction',
    icon: Wallet,
    title: 'Cash prediction',
    body:
      'Predicted cash runway: 8.2 months at current burn rate.',
  },
  {
    id: 'collection',
    icon: IndianRupee,
    title: 'Collection recommendation',
    body:
      '₹4.7L in receivables due this week. Prioritize Acme Corp and Nova Industries.',
  },
];

export function ZohoOracleInsights() {
  return (
    <section
      aria-label="Oracle AI insights"
      className="rounded-xl border border-white/[0.06] bg-[#0C0C0C] p-6"
    >
      <div className="mb-1 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#2563EB]/12">
          <Sparkles className="h-4 w-4 text-[#60A5FA]" />
        </div>
        <h2 className="text-lg font-semibold tracking-tight text-foreground md:text-xl">
          Oracle AI Insights
        </h2>
      </div>
      <p className="mb-5 text-xs text-muted-foreground">
        Generated from your synced Zoho Books data
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {STATIC_INSIGHTS.map(({ id, icon: Icon, title, body }) => (
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
              >
                Ask Oracle
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

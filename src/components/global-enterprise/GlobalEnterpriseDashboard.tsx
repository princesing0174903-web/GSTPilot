'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT GLOBAL ENTERPRISE OPERATING SYSTEM™ — MULTI-COUNTRY BUSINESS CLOUD
//
// The World's First Global Enterprise Operating System.
// One Platform. Every Country. Every Company. Every Decision.
//
// 11 Integrated Subsystems:
//   1.  Global Organization Engine™       — unlimited orgs × countries × entities
//   2.  Multi-Country Support™            — 30 countries, tax/currency/lang/tz/fiscal
//   3.  Global Tax Engine™                — GST/VAT/SalesTax/Corporate/Payroll/Customs
//   4.  Multi-Currency Engine™            — live + historical FX + multi-currency exposure
//   5.  Global Compliance Engine™         — every jurisdiction's filing/audit/labor regs
//   6.  Global Payroll Engine™            — country-specific payroll structures
//   7.  Global Banking Engine™            — SWIFT/IBAN/local rails/treasury/pooling
//   8.  Global Consolidation Engine™      — auto-consolidate across companies × countries
//   9.  Global Executive Dashboard™       — real-time worldwide enterprise view
//   10. Cross-Border Digital Twin™        — 8 what-if scenarios
//   11. Global AI Executives™             — 7 AI executives (CEO/CFO/COO/Legal/HR/Mkt/Ops)
//
// Founder & Owner: Prince Singh. All values derived from REAL production data.
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useState, useCallback } from 'react';
import {
  Globe, Globe2, Building2, Wallet, Coins, Scale, Users,
  TrendingUp, TrendingDown, Activity, ShieldCheck, Sparkles,
  Loader2, RefreshCw, AlertTriangle, Lightbulb, Target, Gauge, BarChart3,
  Brain, Crown, Briefcase, Plane, MapPin, Banknote, AlertCircle, ChevronRight,
  CheckCircle2, Clock, FileText, Layers, Zap, Plus, type LucideIcon,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { PremiumPageLoader } from '@/components/ui/premium-loading';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// ─── Constants ───────────────────────────────────────────────────────────────

const FOUNDER = 'Prince Singh';
const TAGLINE = 'VEYRO™ — Global Enterprise Operating System';
const SUBTAGLINE = 'The World\'s First Global Enterprise Operating System — One Platform. Every Country. Every Company. Every Decision.';

// ─── Types (mirrors of src/lib/global-enterprise/types.ts) ────────────────────

interface DashboardData {
  asOfDate: string;
  baseCurrency: string;
  enterprise: {
    totalEntities: number;
    totalCountries: number;
    totalBankAccounts: number;
    totalEmployees: number;
    enterpriseHealthScore: number;
  };
  financials: {
    totalRevenueBase: number;
    totalProfitBase: number;
    totalCashBase: number;
    totalTaxExposureBase: number;
    totalPayrollBase: number;
    profitMarginPct: number;
    revenueChangePct: number;
  };
  byCountry: Array<{
    countryIso: string;
    countryName: string;
    currency: string;
    entityCount: number;
    revenueBase: number;
    profitBase: number;
    cashBase: number;
    payrollBase: number;
    complianceScore: number;
    growthPct: number;
    pctOfGroupRevenue: number;
    flag?: string;
  }>;
  byRegion: Array<{
    region: string;
    countryCount: number;
    revenueBase: number;
    profitBase: number;
    growthPct: number;
    pctOfGroupRevenue: number;
  }>;
  currencyExposure: {
    totalBase: number;
    byCurrency: Array<{ currency: string; localAmount: number; baseAmount: number; fxRate: number; fxAsOf: string; pctOfTotal: number }>;
    fxExposureUsd: number;
    baseCurrency: string;
    asOfDate: string;
  };
  compliance: {
    overallScore: number;
    criticalOpen: number;
    upcomingDeadlines: number;
    topRisks: Array<{ countryIso: string; title: string; riskLevel: string; daysUntil: number }>;
  };
  treasury: {
    totalCashBase: number;
    byCurrency: Array<{ currency: string; accountCount: number; totalLocal: number; totalBase: number; pctOfTotal: number }>;
    byCountry: Array<{ countryIso: string; accountCount: number; totalBase: number; pctOfTotal: number }>;
    byEntity: Array<{ entityId: string; legalName: string; accountCount: number; totalBase: number; pctOfTotal: number }>;
    cashPools: Array<{ poolId: string; accountCount: number; totalBase: number }>;
    currencyExposure: unknown;
    baseCurrency: string;
    asOfDate: string;
  };
  executives: {
    asOfDate: string;
    briefs: Array<ExecutiveBriefData>;
    crossExecutivePriorities: string[];
    oracleNarrative: string;
  };
  oracleNarrative: string;
  contributors: { founder: string; tagline: string };
}

interface ExecutiveBriefData {
  executiveRole: string;
  briefDate: string;
  headline: string;
  summary: string;
  keyActions: string[];
  risks: string[];
  opportunities: string[];
  confidencePct: number;
  contextScope: string;
  metrics: Record<string, number | string>;
}

interface CountryData {
  isoCode: string;
  name: string;
  region: string;
  taxSystem: string;
  currencyCode: string;
  language: string;
  timezone: string;
  fiscalYearStart: string;
  bankingStandard: string;
  payrollStandard: string;
  accountingStandard: string;
  taxAuthority?: string;
  entityCount?: number;
}

interface EntityData {
  id: string;
  legalName: string;
  tradeName?: string;
  entityKind: string;
  countryIso: string;
  baseCurrency: string;
  consolidated: boolean;
  ownershipPct: number;
  status: string;
  parentEntityId?: string;
}

interface EntityStats {
  totalEntities: number;
  byKind: Array<{ kind: string; count: number }>;
  byCountry: Array<{ countryIso: string; countryName: string; count: number }>;
  byStatus: Array<{ status: string; count: number }>;
  consolidatedCount: number;
  averageOwnershipPct: number;
  totalBankAccounts: number;
}

interface ConsolidationData {
  period: string;
  baseCurrency: string;
  totalRevenue: number;
  totalExpense: number;
  totalProfit: number;
  totalTax: number;
  totalPayroll: number;
  totalCashInflow: number;
  totalCashOutflow: number;
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  netCashFlow: number;
  profitMarginPct: number;
  effectiveTaxRatePct: number;
  byCountry: Array<{
    countryIso: string;
    countryName: string;
    currency: string;
    entityCount: number;
    revenue: number;
    expense: number;
    profit: number;
    tax: number;
    payroll: number;
    profitMarginPct: number;
    pctOfGroupRevenue: number;
  }>;
  byEntity: Array<{
    entityId: string;
    legalName: string;
    countryIso: string;
    currency: string;
    ownershipPct: number;
    revenue: number;
    expense: number;
    profit: number;
    consolidatedRevenue: number;
    consolidatedProfit: number;
  }>;
  oracleNarrative: string;
}

interface ComplianceData {
  overallScore: number;
  totalJurisdictions: number;
  totalDeadlines: number;
  criticalOpen: number;
  byCountry: Array<{
    countryIso: string;
    countryName: string;
    totalDeadlines: number;
    upcomingDeadlines: number;
    criticalOpen: number;
    complianceScore: number;
    nextDeadline?: { title: string; dueDate: string; daysUntil: number; riskLevel: string };
  }>;
  byRegulationType: Array<{ type: string; count: number; criticalOpen: number }>;
  oracleNarrative: string;
}

interface CurrencyData {
  baseCurrency: string;
  asOfDate: string;
  rates: Array<{ baseCurrency: string; quoteCurrency: string; rate: number; inverseRate: number; asOfDate: string; source: string }>;
}

interface PayrollData {
  totalMonthlyCostBase: number;
  totalAnnualCostBase: number;
  byCountry: Array<{
    countryIso: string;
    countryName: string;
    currency: string;
    employeeCount: number;
    totalGrossLocal: number;
    totalEmployerCostLocal: number;
    totalEmployerCostBase: number;
    avgGrossLocal: number;
    pctOfGlobalPayroll: number;
  }>;
  byRoleBand: Array<{ roleBand: string; employeeCount: number; totalCostBase: number; pctOfTotal: number }>;
  baseCurrency: string;
  asOfDate: string;
  oracleNarrative: string;
}

interface TreasuryData {
  totalCashBase: number;
  byCurrency: Array<{ currency: string; accountCount: number; totalLocal: number; totalBase: number; pctOfTotal: number }>;
  byCountry: Array<{ countryIso: string; accountCount: number; totalBase: number; pctOfTotal: number }>;
  byEntity: Array<{ entityId: string; legalName: string; accountCount: number; totalBase: number; pctOfTotal: number }>;
  cashPools: Array<{ poolId: string; accountCount: number; totalBase: number }>;
  baseCurrency: string;
  asOfDate: string;
}

interface ExpansionOpportunity {
  countryIso: string;
  countryName: string;
  region: string;
  expansionScore: number;
  marketAttractiveness: number;
  regulatoryComplexity: number;
  taxBurden: number;
  easeOfDoingBusiness: number;
  reasonsFor: string[];
  reasonsAgainst: string[];
  estimatedSetupCostUsd: number;
  estimatedTimeToOperationMonths: number;
  recommendedStructure: string;
  keyConsiderations: string[];
}

interface ExpansionData {
  total: number;
  opportunities: ExpansionOpportunity[];
}

interface SimulationData {
  scenarioType: string;
  scenarioName: string;
  targetCountryIso?: string;
  horizonMonths: number;
  projections: Array<{
    month: number;
    revenueBase: number;
    expenseBase: number;
    profitBase: number;
    cashFlowBase: number;
    taxLiabilityBase: number;
    riskScore: number;
    complianceScore: number;
  }>;
  cumulativeRevenue: number;
  cumulativeProfit: number;
  cumulativeCashFlow: number;
  cumulativeTaxLiability: number;
  avgRiskScore: number;
  avgComplianceScore: number;
  roiPct: number;
  paybackMonths: number | null;
  verdict: 'proceed' | 'caution' | 'avoid';
  rationale: string;
  complianceImpact: string[];
  recommendedActions: string[];
  methodology: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtINR(n: number): string {
  if (Math.abs(n) >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(2)}Cr`;
  if (Math.abs(n) >= 1_00_000) return `₹${(n / 1_00_000).toFixed(2)}L`;
  if (Math.abs(n) >= 1_000) return `₹${(n / 1_000).toFixed(1)}K`;
  return `₹${n.toFixed(0)}`;
}

function fmtUSD(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function fmtPct(n: number, decimals = 1): string {
  return `${n >= 0 ? '' : ''}${n.toFixed(decimals)}%`;
}

function verdictColor(v: string): string {
  if (v === 'proceed') return 'text-emerald-600 bg-emerald-50 border-emerald-200';
  if (v === 'caution') return 'text-amber-600 bg-amber-50 border-amber-200';
  return 'text-rose-600 bg-rose-50 border-rose-200';
}

// ─── Reusable components ─────────────────────────────────────────────────────

function KPICard({ icon: Icon, label, value, sub, color = 'emerald' }: {
  icon: LucideIcon; label: string; value: string | number; sub?: string;
  color?: 'emerald' | 'cyan' | 'blue' | 'amber' | 'purple' | 'rose' | 'slate';
}) {
  const colorMap: Record<string, string> = {
    emerald: 'from-emerald-500 to-emerald-600',
    cyan: 'from-cyan-500 to-cyan-600',
    blue: 'from-blue-500 to-blue-600',
    amber: 'from-amber-500 to-amber-600',
    purple: 'from-purple-500 to-purple-600',
    rose: 'from-rose-500 to-rose-600',
    slate: 'from-slate-500 to-slate-600',
  };
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className={cn('h-9 w-9 rounded-lg bg-gradient-to-br flex items-center justify-center', colorMap[color])}>
            <Icon className="h-4 w-4 text-white" />
          </div>
          {sub && <span className="text-[10px] text-muted-foreground">{sub}</span>}
        </div>
        <div className="text-xl font-bold tracking-tight">{value}</div>
        <div className="text-[11px] text-muted-foreground mt-0.5">{label}</div>
      </CardContent>
    </Card>
  );
}

function ScoreBadge({ score, suffix = '/100' }: { score: number; suffix?: string }) {
  const color = score >= 80 ? 'text-emerald-700 bg-emerald-100' : score >= 60 ? 'text-amber-700 bg-amber-100' : 'text-rose-700 bg-rose-100';
  return <Badge className={cn('text-[10px] font-semibold', color)} variant="outline">{score.toFixed(0)}{suffix}</Badge>;
}

function LoadingState({ label }: { label: string }) {
  return <PremiumPageLoader label={label} />;
}

function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <AlertCircle className="h-8 w-8 mb-3 text-rose-500" />
      <p className="text-sm text-rose-600 mb-3 max-w-md text-center">{message}</p>
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry
        </Button>
      )}
    </div>
  );
}

// ─── Executive role metadata ─────────────────────────────────────────────────

const EXEC_META: Record<string, { label: string; icon: LucideIcon; color: string }> = {
  ceo: { label: 'CEO', icon: Crown, color: 'from-purple-500 to-purple-600' },
  cfo: { label: 'CFO', icon: Wallet, color: 'from-emerald-500 to-emerald-600' },
  coo: { label: 'COO', icon: Briefcase, color: 'from-blue-500 to-blue-600' },
  legal: { label: 'Legal', icon: Scale, color: 'from-rose-500 to-rose-600' },
  hr: { label: 'HR', icon: Users, color: 'from-amber-500 to-amber-600' },
  marketing: { label: 'Marketing', icon: TrendingUp, color: 'from-cyan-500 to-cyan-600' },
  operations: { label: 'Operations', icon: Activity, color: 'from-slate-500 to-slate-600' },
};

// ─── Simulation scenarios ────────────────────────────────────────────────────

const SCENARIOS = [
  { type: 'open_country', label: 'Open New Country', icon: MapPin, magnitude: 0, horizon: 12 },
  { type: 'acquire_company', label: 'Acquire Company', icon: Building2, magnitude: 100, horizon: 12 },
  { type: 'hire_global', label: 'Hire Globally', icon: Users, magnitude: 0, horizon: 6 },
  { type: 'currency_shock', label: 'Currency Shock', icon: Coins, magnitude: 10, horizon: 6 },
  { type: 'tax_change', label: 'Tax Rate Change', icon: Scale, magnitude: 5, horizon: 12 },
  { type: 'downturn', label: 'Economic Downturn', icon: TrendingDown, magnitude: -15, horizon: 12 },
  { type: 'supply_disruption', label: 'Supply Disruption', icon: AlertTriangle, magnitude: 20, horizon: 6 },
  { type: 'expansion', label: 'Expansion Strategy', icon: Plane, magnitude: 25, horizon: 12 },
] as const;

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function GlobalEnterpriseDashboardPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [countries, setCountries] = useState<CountryData[]>([]);
  const [entities, setEntities] = useState<EntityData[] | null>(null);
  const [entityStats, setEntityStats] = useState<EntityStats | null>(null);
  const [consolidation, setConsolidation] = useState<ConsolidationData | null>(null);
  const [compliance, setCompliance] = useState<ComplianceData | null>(null);
  const [currency, setCurrency] = useState<CurrencyData | null>(null);
  const [payroll, setPayroll] = useState<PayrollData | null>(null);
  const [treasury, setTreasury] = useState<TreasuryData | null>(null);
  const [expansion, setExpansion] = useState<ExpansionData | null>(null);

  // Simulation state
  const [simScenario, setSimScenario] = useState<string>('open_country');
  const [simTarget, setSimTarget] = useState<string>('US');
  const [simMagnitude, setSimMagnitude] = useState<number>(10);
  const [simHorizon, setSimHorizon] = useState<number>(12);
  const [simInvestment, setSimInvestment] = useState<number>(5000000);
  const [simResult, setSimResult] = useState<SimulationData | null>(null);
  const [simulating, setSimulating] = useState(false);

  // New entity form
  const [newEntityName, setNewEntityName] = useState('');
  const [newEntityCountry, setNewEntityCountry] = useState('US');
  const [newEntityKind, setNewEntityKind] = useState('operating');
  const [creatingEntity, setCreatingEntity] = useState(false);

  const fetchAll = useCallback(async () => {
    setRefreshing(true);
    try {
      const [dashRes, countriesRes] = await Promise.all([
        fetch('/api/global/dashboard'),
        fetch('/api/global/countries'),
      ]);
      if (dashRes.ok) {
        const json = await dashRes.json();
        setDashboard(json.data ?? null);
      }
      if (countriesRes.ok) {
        const json = await countriesRes.json();
        setCountries((json.data?.countries ?? []) as CountryData[]);
      }
    } catch (err) {
      console.error('fetch dashboard failed:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ─── Tab-specific fetches ─────────────────────────────────────────────────

  const fetchEntities = useCallback(async () => {
    try {
      const [treeRes, statsRes] = await Promise.all([
        fetch('/api/global/entities'),
        fetch('/api/global/entities?view=stats'),
      ]);
      if (treeRes.ok) {
        const json = await treeRes.json();
        // Flatten tree for display
        const flat: EntityData[] = [];
        const walk = (nodes: any[]) => {
          for (const n of nodes) {
            flat.push(n.entity);
            if (n.childEntities?.length) walk(n.childEntities);
          }
        };
        walk(json.data ?? []);
        setEntities(flat);
      }
      if (statsRes.ok) {
        const json = await statsRes.json();
        setEntityStats(json.data ?? null);
      }
    } catch (err) { console.error('fetch entities failed:', err); }
  }, []);

  const fetchConsolidation = useCallback(async () => {
    try {
      const res = await fetch('/api/global/consolidation');
      if (res.ok) {
        const json = await res.json();
        setConsolidation(json.data ?? null);
      }
    } catch (err) { console.error('fetch consolidation failed:', err); }
  }, []);

  const fetchCompliance = useCallback(async () => {
    try {
      const res = await fetch('/api/global/compliance');
      if (res.ok) {
        const json = await res.json();
        setCompliance(json.data ?? null);
      }
    } catch (err) { console.error('fetch compliance failed:', err); }
  }, []);

  const fetchCurrency = useCallback(async () => {
    try {
      const res = await fetch('/api/global/currency');
      if (res.ok) {
        const json = await res.json();
        setCurrency(json.data ?? null);
      }
    } catch (err) { console.error('fetch currency failed:', err); }
  }, []);

  const fetchPayroll = useCallback(async () => {
    try {
      const res = await fetch('/api/global/payroll');
      if (res.ok) {
        const json = await res.json();
        setPayroll(json.data ?? null);
      }
    } catch (err) { console.error('fetch payroll failed:', err); }
  }, []);

  const fetchTreasury = useCallback(async () => {
    try {
      const res = await fetch('/api/global/treasury');
      if (res.ok) {
        const json = await res.json();
        setTreasury(json.data ?? null);
      }
    } catch (err) { console.error('fetch treasury failed:', err); }
  }, []);

  const fetchExpansion = useCallback(async () => {
    try {
      const res = await fetch('/api/global/expansion?limit=15');
      if (res.ok) {
        const json = await res.json();
        setExpansion(json.data ?? null);
      }
    } catch (err) { console.error('fetch expansion failed:', err); }
  }, []);

  // Lazy-load tab data on tab change
  useEffect(() => {
    if (activeTab === 'entities' && !entities) fetchEntities();
    if (activeTab === 'consolidation' && !consolidation) fetchConsolidation();
    if (activeTab === 'compliance' && !compliance) fetchCompliance();
    if (activeTab === 'currency' && !currency) fetchCurrency();
    if (activeTab === 'payroll' && !payroll) fetchPayroll();
    if (activeTab === 'treasury' && !treasury) fetchTreasury();
    if (activeTab === 'expansion' && !expansion) fetchExpansion();
  }, [activeTab, entities, consolidation, compliance, currency, payroll, treasury, expansion,
      fetchEntities, fetchConsolidation, fetchCompliance, fetchCurrency, fetchPayroll, fetchTreasury, fetchExpansion]);

  // ─── Actions ──────────────────────────────────────────────────────────────

  const runSimulation = async () => {
    setSimulating(true);
    try {
      const res = await fetch('/api/global/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenarioType: simScenario,
          targetCountryIso: ['open_country', 'acquire_company', 'expansion'].includes(simScenario) ? simTarget : undefined,
          hireCountryIso: simScenario === 'hire_global' ? simTarget : undefined,
          monthsAhead: simHorizon,
          magnitudePct: simMagnitude,
          investmentAmount: ['open_country', 'acquire_company', 'expansion'].includes(simScenario) ? simInvestment : undefined,
        }),
      });
      if (!res.ok) throw new Error('Simulation failed');
      const json = await res.json();
      setSimResult(json.data);
      toast({ title: 'Simulation complete', description: json.data?.verdict?.toUpperCase() });
    } catch {
      toast({ title: 'Simulation failed', variant: 'destructive' });
    } finally {
      setSimulating(false);
    }
  };

  const createNewEntity = async () => {
    if (!newEntityName.trim()) {
      toast({ title: 'Entity name required', variant: 'destructive' });
      return;
    }
    setCreatingEntity(true);
    try {
      const res = await fetch('/api/global/entity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          legalName: newEntityName,
          countryIso: newEntityCountry,
          entityKind: newEntityKind,
          baseCurrency: countries.find((c) => c.isoCode === newEntityCountry)?.currencyCode ?? 'INR',
        }),
      });
      if (!res.ok) throw new Error('Create failed');
      toast({ title: 'Entity created', description: `${newEntityName} in ${newEntityCountry}` });
      setNewEntityName('');
      fetchEntities();
      fetchAll();
    } catch {
      toast({ title: 'Failed to create entity', variant: 'destructive' });
    } finally {
      setCreatingEntity(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 flex flex-col">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-30">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-rose-500 via-orange-500 to-amber-500 rounded-xl blur-md opacity-60" />
                <div className="relative h-12 w-12 rounded-xl bg-gradient-to-br from-rose-500 via-orange-500 to-amber-500 flex items-center justify-center">
                  <Globe2 className="h-7 w-7 text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2 flex-wrap">
                  {TAGLINE}
                  <Badge variant="secondary" className="text-[10px]">Phase 9</Badge>
                </h1>
                <p className="text-xs text-muted-foreground">{SUBTAGLINE}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={fetchAll} disabled={refreshing}>
                <RefreshCw className={cn('h-3.5 w-3.5 mr-1', refreshing && 'animate-spin')} />
                Refresh
              </Button>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <ShieldCheck className="h-3 w-3 text-emerald-500" />
            <span>Zero-trust isolation · RBAC · Audit logging · Encryption</span>
            <span className="text-muted-foreground/60">·</span>
            <span>30+ countries · 9 tax systems · Multi-currency consolidation</span>
            <span className="text-muted-foreground/60">·</span>
            <span>Founded, developed & owned by <strong className="text-foreground">{FOUNDER}</strong></span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 flex-1">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-9 gap-1 h-auto p-1">
            <TabsTrigger value="overview" className="text-xs"><Gauge className="h-3.5 w-3.5 mr-1" />Overview</TabsTrigger>
            <TabsTrigger value="entities" className="text-xs"><Building2 className="h-3.5 w-3.5 mr-1" />Entities</TabsTrigger>
            <TabsTrigger value="countries" className="text-xs"><Globe className="h-3.5 w-3.5 mr-1" />Countries</TabsTrigger>
            <TabsTrigger value="consolidation" className="text-xs"><BarChart3 className="h-3.5 w-3.5 mr-1" />Consolidation</TabsTrigger>
            <TabsTrigger value="treasury" className="text-xs"><Banknote className="h-3.5 w-3.5 mr-1" />Treasury</TabsTrigger>
            <TabsTrigger value="compliance" className="text-xs"><Scale className="h-3.5 w-3.5 mr-1" />Compliance</TabsTrigger>
            <TabsTrigger value="currency" className="text-xs"><Coins className="h-3.5 w-3.5 mr-1" />Currency</TabsTrigger>
            <TabsTrigger value="executives" className="text-xs"><Crown className="h-3.5 w-3.5 mr-1" />Executives</TabsTrigger>
            <TabsTrigger value="simulate" className="text-xs"><Plane className="h-3.5 w-3.5 mr-1" />Simulate</TabsTrigger>
          </TabsList>

          {/* ═══ OVERVIEW ═══ */}
          <TabsContent value="overview" className="space-y-6">
            {loading ? <LoadingState label="Loading global dashboard" /> : !dashboard ? <ErrorState message="Failed to load dashboard" onRetry={fetchAll} /> : (
              <>
                {/* Oracle banner */}
                <Card className="overflow-hidden border-rose-500/30 bg-gradient-to-br from-rose-500/5 via-orange-500/5 to-amber-500/5">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="h-12 w-12 rounded-full bg-gradient-to-br from-rose-500 via-orange-500 to-amber-500 flex items-center justify-center flex-shrink-0">
                        <Sparkles className="h-6 w-6 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-semibold">Oracle Global Enterprise™</span>
                          <Badge variant="outline" className="text-[10px]">{dashboard.asOfDate}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">{dashboard.oracleNarrative}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* KPI Row */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  <KPICard icon={Building2} label="Entities" value={dashboard.enterprise.totalEntities} color="emerald" />
                  <KPICard icon={Globe} label="Countries" value={dashboard.enterprise.totalCountries} color="cyan" />
                  <KPICard icon={Banknote} label="Bank Accounts" value={dashboard.enterprise.totalBankAccounts} color="blue" />
                  <KPICard icon={Users} label="Employees" value={dashboard.enterprise.totalEmployees} color="amber" />
                  <KPICard icon={Gauge} label="Health Score" value={`${dashboard.enterprise.enterpriseHealthScore}/100`} color={dashboard.enterprise.enterpriseHealthScore >= 80 ? 'emerald' : 'amber'} />
                  <KPICard icon={Scale} label="Compliance" value={`${dashboard.compliance.overallScore}/100`} color={dashboard.compliance.overallScore >= 80 ? 'emerald' : 'rose'} />
                </div>

                {/* Financials row */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  <KPICard icon={TrendingUp} label="Revenue" value={fmtINR(dashboard.financials.totalRevenueBase)} sub={fmtPct(dashboard.financials.revenueChangePct)} color="emerald" />
                  <KPICard icon={Wallet} label="Profit" value={fmtINR(dashboard.financials.totalProfitBase)} sub={`${dashboard.financials.profitMarginPct.toFixed(1)}% margin`} color="cyan" />
                  <KPICard icon={Banknote} label="Cash" value={fmtINR(dashboard.financials.totalCashBase)} color="blue" />
                  <KPICard icon={Scale} label="Tax Exposure" value={fmtINR(dashboard.financials.totalTaxExposureBase)} color="rose" />
                  <KPICard icon={Users} label="Payroll" value={fmtINR(dashboard.financials.totalPayrollBase)} color="amber" />
                  <KPICard icon={Coins} label="FX Exposure" value={fmtUSD(dashboard.currencyExposure.fxExposureUsd)} color="purple" />
                </div>

                {/* Country Performance + Regions */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <Card className="lg:col-span-2">
                    <CardHeader>
                      <CardTitle className="text-sm flex items-center gap-2"><Globe className="h-4 w-4" />Country Performance</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {dashboard.byCountry.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-8 text-center">No operating countries yet. Onboard entities to begin.</p>
                      ) : (
                        <div className="space-y-3 max-h-80 overflow-y-auto">
                          {dashboard.byCountry.map((c) => (
                            <div key={c.countryIso} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-slate-400 to-slate-600 flex items-center justify-center text-[10px] font-bold text-white">
                                {c.countryIso}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium truncate">{c.countryName}</span>
                                  <Badge variant="outline" className="text-[10px]">{c.entityCount} ent.</Badge>
                                  <ScoreBadge score={c.complianceScore} />
                                </div>
                                <div className="text-[11px] text-muted-foreground mt-0.5">
                                  Rev {fmtINR(c.revenueBase)} · Profit {fmtINR(c.profitBase)} · {c.pctOfGroupRevenue.toFixed(1)}% of group
                                  {c.growthPct !== 0 && <span className={c.growthPct >= 0 ? 'text-emerald-600 ml-1' : 'text-rose-600 ml-1'}>({fmtPct(c.growthPct)})</span>}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm flex items-center gap-2"><MapPin className="h-4 w-4" />Regional Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {dashboard.byRegion.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-8 text-center">No regions yet.</p>
                      ) : (
                        <div className="space-y-3">
                          {dashboard.byRegion.map((r) => (
                            <div key={r.region} className="space-y-1">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-medium">{r.region}</span>
                                <span className="text-muted-foreground">{r.countryCount} countries · {fmtINR(r.revenueBase)}</span>
                              </div>
                              <Progress value={r.pctOfGroupRevenue} className="h-1.5" />
                              <div className="text-[10px] text-muted-foreground">{r.pctOfGroupRevenue.toFixed(1)}% of group revenue</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Compliance Risks + Executive Summary */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" />Top Compliance Risks</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {dashboard.compliance.topRisks.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-6 text-center">No critical compliance risks. Posture healthy.</p>
                      ) : (
                        <div className="space-y-2">
                          {dashboard.compliance.topRisks.map((r, i) => (
                            <div key={i} className="flex items-start gap-2 p-2 rounded border bg-card">
                              <Badge variant="outline" className={cn('text-[10px]', r.riskLevel === 'critical' ? 'text-rose-600' : 'text-amber-600')}>
                                {r.riskLevel}
                              </Badge>
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-medium truncate">{r.title}</div>
                                <div className="text-[10px] text-muted-foreground">{r.countryIso} · due in {r.daysUntil} days</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm flex items-center gap-2"><Crown className="h-4 w-4 text-purple-500" />Cross-Executive Priorities</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-48">
                        <div className="space-y-2">
                          {dashboard.executives.crossExecutivePriorities.map((p, i) => (
                            <div key={i} className="flex items-start gap-2 text-xs">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                              <span>{p}</span>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </TabsContent>

          {/* ═══ ENTITIES ═══ */}
          <TabsContent value="entities" className="space-y-6">
            {/* Create entity form */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2"><Building2 className="h-4 w-4" />Register New Entity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <Input
                    placeholder="Legal entity name"
                    value={newEntityName}
                    onChange={(e) => setNewEntityName(e.target.value)}
                    className="md:col-span-2"
                  />
                  <Select value={newEntityCountry} onValueChange={setNewEntityCountry}>
                    <SelectTrigger><SelectValue placeholder="Country" /></SelectTrigger>
                    <SelectContent>
                      {countries.map((c) => (
                        <SelectItem key={c.isoCode} value={c.isoCode}>{c.name} ({c.isoCode})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={newEntityKind} onValueChange={setNewEntityKind}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="operating">Operating</SelectItem>
                      <SelectItem value="holding">Holding</SelectItem>
                      <SelectItem value="branch">Branch</SelectItem>
                      <SelectItem value="subsidiary">Subsidiary</SelectItem>
                      <SelectItem value="jv">Joint Venture</SelectItem>
                      <SelectItem value="rep_office">Rep Office</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button className="mt-3" size="sm" onClick={createNewEntity} disabled={creatingEntity}>
                  {creatingEntity ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Plus className="h-3.5 w-3.5 mr-1.5" />}
                  Create Entity
                </Button>
              </CardContent>
            </Card>

            {/* Stats + list */}
            {entityStats && (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                <KPICard icon={Building2} label="Total Entities" value={entityStats.totalEntities} color="emerald" />
                <KPICard icon={Layers} label="Consolidated" value={entityStats.consolidatedCount} color="cyan" />
                <KPICard icon={Banknote} label="Bank Accounts" value={entityStats.totalBankAccounts} color="blue" />
                <KPICard icon={Globe} label="Countries" value={entityStats.byCountry.length} color="amber" />
                <KPICard icon={Briefcase} label="Entity Kinds" value={entityStats.byKind.length} color="purple" />
                <KPICard icon={Users} label="Avg Ownership" value={`${entityStats.averageOwnershipPct.toFixed(0)}%`} color="rose" />
              </div>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Entity Roster</CardTitle>
              </CardHeader>
              <CardContent>
                {!entities ? <LoadingState label="Loading entities" /> : entities.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-8 text-center">No entities registered yet. Create one above to begin.</p>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {entities.map((e) => (
                      <div key={e.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                        <div className="h-9 w-9 rounded bg-gradient-to-br from-slate-400 to-slate-600 flex items-center justify-center">
                          <Building2 className="h-4 w-4 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium truncate">{e.legalName}</span>
                            {e.tradeName && <span className="text-[11px] text-muted-foreground">({e.tradeName})</span>}
                            <Badge variant="outline" className="text-[10px]">{e.entityKind}</Badge>
                            <Badge variant="outline" className="text-[10px]">{e.countryIso}</Badge>
                            {e.consolidated && <Badge className="text-[10px] bg-emerald-100 text-emerald-700">Consolidated</Badge>}
                            <Badge variant="outline" className="text-[10px]">{e.status}</Badge>
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            {e.baseCurrency} · {e.ownershipPct}% ownership · ID: {e.id.slice(0, 8)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══ COUNTRIES ═══ */}
          <TabsContent value="countries" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2"><Globe className="h-4 w-4" />Multi-Country Support™ — {countries.length} Countries</CardTitle>
              </CardHeader>
              <CardContent>
                {countries.length === 0 ? <LoadingState label="Loading countries" /> : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[600px] overflow-y-auto">
                    {countries.map((c) => (
                      <div key={c.isoCode} className="p-3 rounded-lg border bg-card space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-rose-500 to-orange-500 flex items-center justify-center text-[10px] font-bold text-white">
                              {c.isoCode}
                            </div>
                            <div>
                              <div className="text-sm font-medium">{c.name}</div>
                              <div className="text-[10px] text-muted-foreground">{c.region}</div>
                            </div>
                          </div>
                          {c.entityCount !== undefined && c.entityCount > 0 && (
                            <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700">
                              {c.entityCount} ent.
                            </Badge>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-1 text-[10px] text-muted-foreground">
                          <div><span className="font-medium text-foreground">Tax:</span> {c.taxSystem.toUpperCase()}</div>
                          <div><span className="font-medium text-foreground">CCY:</span> {c.currencyCode}</div>
                          <div><span className="font-medium text-foreground">Lang:</span> {c.language.toUpperCase()}</div>
                          <div><span className="font-medium text-foreground">Bank:</span> {c.bankingStandard}</div>
                          <div><span className="font-medium text-foreground">Payroll:</span> {c.payrollStandard}</div>
                          <div><span className="font-medium text-foreground">Acct:</span> {c.accountingStandard.toUpperCase()}</div>
                          <div className="col-span-2"><span className="font-medium text-foreground">FY:</span> {c.fiscalYearStart} · <span className="font-medium text-foreground">TZ:</span> {c.timezone}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══ CONSOLIDATION ═══ */}
          <TabsContent value="consolidation" className="space-y-6">
            {!consolidation ? <LoadingState label="Loading consolidation report" /> : (
              <>
                <Card className="border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 to-cyan-500/5">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-3">
                      <Sparkles className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-1" />
                      <div>
                        <div className="text-sm font-semibold mb-1">Consolidation Report — {consolidation.period}</div>
                        <p className="text-sm text-muted-foreground">{consolidation.oracleNarrative}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <KPICard icon={TrendingUp} label="Revenue" value={fmtINR(consolidation.totalRevenue)} color="emerald" />
                  <KPICard icon={TrendingDown} label="Expense" value={fmtINR(consolidation.totalExpense)} color="rose" />
                  <KPICard icon={Wallet} label="Profit" value={fmtINR(consolidation.totalProfit)} sub={`${consolidation.profitMarginPct.toFixed(1)}% margin`} color="cyan" />
                  <KPICard icon={Scale} label="Tax" value={fmtINR(consolidation.totalTax)} sub={`${consolidation.effectiveTaxRatePct.toFixed(1)}% eff.`} color="amber" />
                  <KPICard icon={Users} label="Payroll" value={fmtINR(consolidation.totalPayroll)} color="purple" />
                  <KPICard icon={Banknote} label="Cash Inflow" value={fmtINR(consolidation.totalCashInflow)} color="blue" />
                  <KPICard icon={AlertCircle} label="Cash Outflow" value={fmtINR(consolidation.totalCashOutflow)} color="rose" />
                  <KPICard icon={Activity} label="Net Cash Flow" value={fmtINR(consolidation.netCashFlow)} color={consolidation.netCashFlow >= 0 ? 'emerald' : 'rose'} />
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">By Country</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {consolidation.byCountry.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-6 text-center">No consolidation data yet. Run consolidation after onboarding entities.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-left border-b text-muted-foreground">
                              <th className="py-2">Country</th>
                              <th className="text-right">Entities</th>
                              <th className="text-right">Revenue</th>
                              <th className="text-right">Expense</th>
                              <th className="text-right">Profit</th>
                              <th className="text-right">Margin</th>
                              <th className="text-right">% Group</th>
                            </tr>
                          </thead>
                          <tbody>
                            {consolidation.byCountry.map((c) => (
                              <tr key={c.countryIso} className="border-b">
                                <td className="py-2 font-medium">{c.countryName}</td>
                                <td className="text-right">{c.entityCount}</td>
                                <td className="text-right">{fmtINR(c.revenue)}</td>
                                <td className="text-right">{fmtINR(c.expense)}</td>
                                <td className="text-right">{fmtINR(c.profit)}</td>
                                <td className="text-right">{c.profitMarginPct.toFixed(1)}%</td>
                                <td className="text-right">{c.pctOfGroupRevenue.toFixed(1)}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* ═══ TREASURY ═══ */}
          <TabsContent value="treasury" className="space-y-6">
            {!treasury ? <LoadingState label="Loading treasury" /> : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <KPICard icon={Banknote} label="Total Cash" value={fmtINR(treasury.totalCashBase)} color="emerald" />
                  <KPICard icon={Coins} label="Currencies" value={treasury.byCurrency.length} color="cyan" />
                  <KPICard icon={Globe} label="Countries" value={treasury.byCountry.length} color="blue" />
                  <KPICard icon={Building2} label="Entities" value={treasury.byEntity.length} color="amber" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader><CardTitle className="text-sm">Cash by Currency</CardTitle></CardHeader>
                    <CardContent>
                      {treasury.byCurrency.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-6 text-center">No bank accounts connected.</p>
                      ) : (
                        <div className="space-y-2">
                          {treasury.byCurrency.map((c) => (
                            <div key={c.currency} className="space-y-1">
                              <div className="flex justify-between text-xs">
                                <span className="font-medium">{c.currency} <span className="text-muted-foreground">({c.accountCount} accts)</span></span>
                                <span>{fmtINR(c.totalBase)} <span className="text-muted-foreground">({c.pctOfTotal.toFixed(1)}%)</span></span>
                              </div>
                              <Progress value={c.pctOfTotal} className="h-1.5" />
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader><CardTitle className="text-sm">Cash by Country</CardTitle></CardHeader>
                    <CardContent>
                      {treasury.byCountry.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-6 text-center">No country data.</p>
                      ) : (
                        <div className="space-y-2">
                          {treasury.byCountry.map((c) => (
                            <div key={c.countryIso} className="space-y-1">
                              <div className="flex justify-between text-xs">
                                <span className="font-medium">{c.countryIso} <span className="text-muted-foreground">({c.accountCount} accts)</span></span>
                                <span>{fmtINR(c.totalBase)} <span className="text-muted-foreground">({c.pctOfTotal.toFixed(1)}%)</span></span>
                              </div>
                              <Progress value={c.pctOfTotal} className="h-1.5" />
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {treasury.cashPools.length > 0 && (
                  <Card>
                    <CardHeader><CardTitle className="text-sm">Treasury Cash Pools</CardTitle></CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {treasury.cashPools.map((p) => (
                          <div key={p.poolId} className="p-3 rounded-lg border bg-card">
                            <div className="text-[10px] text-muted-foreground">Pool ID</div>
                            <div className="text-sm font-mono font-medium">{p.poolId}</div>
                            <div className="text-xs mt-2">{p.accountCount} accounts</div>
                            <div className="text-sm font-bold mt-1">{fmtINR(p.totalBase)}</div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>

          {/* ═══ COMPLIANCE ═══ */}
          <TabsContent value="compliance" className="space-y-6">
            {!compliance ? <LoadingState label="Loading compliance report" /> : (
              <>
                <Card className="border-rose-500/30 bg-gradient-to-br from-rose-500/5 to-amber-500/5">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-3">
                      <ShieldCheck className="h-5 w-5 text-rose-500 flex-shrink-0 mt-1" />
                      <div>
                        <div className="text-sm font-semibold mb-1">Global Compliance Report</div>
                        <p className="text-sm text-muted-foreground">{compliance.oracleNarrative}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <KPICard icon={Gauge} label="Overall Score" value={`${compliance.overallScore}/100`} color={compliance.overallScore >= 80 ? 'emerald' : 'amber'} />
                  <KPICard icon={Globe} label="Jurisdictions" value={compliance.totalJurisdictions} color="cyan" />
                  <KPICard icon={FileText} label="Total Deadlines" value={compliance.totalDeadlines} color="blue" />
                  <KPICard icon={AlertTriangle} label="Critical Open" value={compliance.criticalOpen} color={compliance.criticalOpen === 0 ? 'emerald' : 'rose'} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader><CardTitle className="text-sm">By Country</CardTitle></CardHeader>
                    <CardContent>
                      <div className="space-y-2 max-h-80 overflow-y-auto">
                        {compliance.byCountry.map((c) => (
                          <div key={c.countryIso} className="flex items-center gap-2 p-2 rounded border bg-card">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium">{c.countryName}</span>
                                <ScoreBadge score={c.complianceScore} />
                                {c.criticalOpen > 0 && <Badge variant="outline" className="text-[10px] text-rose-600">{c.criticalOpen} critical</Badge>}
                              </div>
                              <div className="text-[10px] text-muted-foreground mt-0.5">
                                {c.totalDeadlines} total · {c.upcomingDeadlines} upcoming
                                {c.nextDeadline && ` · next: ${c.nextDeadline.title.slice(0, 30)}… in ${c.nextDeadline.daysUntil}d`}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader><CardTitle className="text-sm">By Regulation Type</CardTitle></CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {compliance.byRegulationType.map((r) => (
                          <div key={r.type} className="flex items-center justify-between p-2 rounded border bg-card text-xs">
                            <span className="font-medium">{r.type.replace(/_/g, ' ')}</span>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[10px]">{r.count} rules</Badge>
                              {r.criticalOpen > 0 && <Badge variant="outline" className="text-[10px] text-rose-600">{r.criticalOpen} critical</Badge>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </TabsContent>

          {/* ═══ CURRENCY ═══ */}
          <TabsContent value="currency" className="space-y-6">
            {!currency ? <LoadingState label="Loading currency rates" /> : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <KPICard icon={Coins} label="Base Currency" value={currency.baseCurrency} color="emerald" />
                  <KPICard icon={Activity} label="Tracked Currencies" value={currency.rates.length} color="cyan" />
                  <KPICard icon={Globe} label="As of Date" value={currency.asOfDate} color="blue" />
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2"><Coins className="h-4 w-4" />Live Exchange Rates</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {currency.rates.map((r) => (
                        <div key={r.quoteCurrency} className="p-3 rounded-lg border bg-card">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-bold">{r.quoteCurrency}</span>
                            <Badge variant="outline" className="text-[10px]">{r.source}</Badge>
                          </div>
                          <div className="text-xs text-muted-foreground">1 {r.baseCurrency} =</div>
                          <div className="text-lg font-bold">{r.rate.toFixed(4)} {r.quoteCurrency}</div>
                          <div className="text-[10px] text-muted-foreground mt-1">Inverse: {r.inverseRate.toFixed(4)} · {r.asOfDate}</div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {dashboard && dashboard.currencyExposure.byCurrency.length > 0 && (
                  <Card>
                    <CardHeader><CardTitle className="text-sm">Multi-Currency Exposure</CardTitle></CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {dashboard.currencyExposure.byCurrency.map((c) => (
                          <div key={c.currency} className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="font-medium">{c.currency}</span>
                              <span>{fmtINR(c.baseAmount)} <span className="text-muted-foreground">({c.pctOfTotal.toFixed(1)}%)</span></span>
                            </div>
                            <Progress value={c.pctOfTotal} className="h-1.5" />
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-200">
                        <div className="text-xs text-amber-700">
                          <strong>FX Exposure:</strong> {fmtUSD(dashboard.currencyExposure.fxExposureUsd)} in non-base currencies
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>

          {/* ═══ EXECUTIVES ═══ */}
          <TabsContent value="executives" className="space-y-6">
            {!dashboard ? <LoadingState label="Loading executive briefs" /> : (
              <>
                <Card className="border-purple-500/30 bg-gradient-to-br from-purple-500/5 to-blue-500/5">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-3">
                      <Crown className="h-5 w-5 text-purple-500 flex-shrink-0 mt-1" />
                      <div>
                        <div className="text-sm font-semibold mb-1">Global AI Executives™ — 7 AI Leaders</div>
                        <p className="text-sm text-muted-foreground">{dashboard.executives.oracleNarrative}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {dashboard.executives.briefs.map((b) => {
                    const meta = EXEC_META[b.executiveRole] ?? { label: b.executiveRole, icon: Brain, color: 'from-slate-500 to-slate-600' };
                    const Icon = meta.icon;
                    return (
                      <Card key={b.executiveRole}>
                        <CardHeader className="pb-2">
                          <div className="flex items-center gap-3">
                            <div className={cn('h-10 w-10 rounded-lg bg-gradient-to-br flex items-center justify-center', meta.color)}>
                              <Icon className="h-5 w-5 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <CardTitle className="text-sm">{meta.label}</CardTitle>
                                <Badge variant="outline" className="text-[10px]">{b.contextScope}</Badge>
                              </div>
                              <div className="text-[10px] text-muted-foreground">{b.briefDate}</div>
                            </div>
                            <Badge variant="outline" className={cn('text-[10px]', b.confidencePct >= 70 ? 'text-emerald-600' : 'text-amber-600')}>
                              {b.confidencePct.toFixed(0)}% conf.
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-2">
                          <div className="text-xs font-medium mb-1">{b.headline}</div>
                          <p className="text-[11px] text-muted-foreground leading-relaxed mb-3">{b.summary}</p>
                          {b.keyActions.length > 0 && (
                            <div className="mb-2">
                              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Key Actions</div>
                              <ul className="space-y-0.5">
                                {b.keyActions.slice(0, 3).map((a, i) => (
                                  <li key={i} className="text-[11px] flex items-start gap-1.5">
                                    <ChevronRight className="h-3 w-3 text-emerald-500 flex-shrink-0 mt-0.5" />
                                    <span>{a}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {b.risks.length > 0 && (
                            <div className="mb-2">
                              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Risks</div>
                              <ul className="space-y-0.5">
                                {b.risks.slice(0, 2).map((r, i) => (
                                  <li key={i} className="text-[11px] flex items-start gap-1.5">
                                    <AlertTriangle className="h-3 w-3 text-rose-500 flex-shrink-0 mt-0.5" />
                                    <span>{r}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {b.opportunities.length > 0 && (
                            <div>
                              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Opportunities</div>
                              <ul className="space-y-0.5">
                                {b.opportunities.slice(0, 2).map((o, i) => (
                                  <li key={i} className="text-[11px] flex items-start gap-1.5">
                                    <Lightbulb className="h-3 w-3 text-amber-500 flex-shrink-0 mt-0.5" />
                                    <span>{o}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </>
            )}
          </TabsContent>

          {/* ═══ SIMULATE (Cross-Border Digital Twin) ═══ */}
          <TabsContent value="simulate" className="space-y-6">
            {!expansion ? <LoadingState label="Loading expansion opportunities" /> : (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2"><Plane className="h-4 w-4" />Cross-Border Digital Twin™ — What-If Simulator</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-xs text-muted-foreground">
                      Simulate opening a new country, acquiring a company, hiring globally, currency shocks, tax changes,
                      economic downturns, supply chain disruptions, and expansion strategies. Predicts revenue, profit, risk,
                      compliance, ROI, and payback. Baseline derived from REAL consolidated data.
                    </p>

                    {/* Scenario selector */}
                    <div>
                      <label className="text-xs font-medium mb-2 block">Scenario</label>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {SCENARIOS.map((s) => {
                          const Icon = s.icon;
                          return (
                            <button
                              key={s.type}
                              onClick={() => {
                                setSimScenario(s.type);
                                setSimMagnitude(s.magnitude);
                                setSimHorizon(s.horizon);
                              }}
                              className={cn(
                                'flex flex-col items-center gap-1 p-2 rounded-lg border text-xs transition-colors',
                                simScenario === s.type ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-border hover:bg-muted/50'
                              )}
                            >
                              <Icon className="h-4 w-4" />
                              <span className="text-center leading-tight">{s.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Parameters */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                      <div>
                        <label className="text-xs font-medium mb-1 block">Target Country</label>
                        <Select value={simTarget} onValueChange={setSimTarget}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {expansion.opportunities.map((o) => (
                              <SelectItem key={o.countryIso} value={o.countryIso}>{o.countryName} (score: {o.expansionScore})</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-xs font-medium mb-1 block">Magnitude (%)</label>
                        <Input
                          type="number"
                          value={simMagnitude}
                          onChange={(e) => setSimMagnitude(Number(e.target.value))}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium mb-1 block">Horizon (months)</label>
                        <Input
                          type="number"
                          value={simHorizon}
                          onChange={(e) => setSimHorizon(Number(e.target.value))}
                          min={1}
                          max={36}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium mb-1 block">Investment (₹)</label>
                        <Input
                          type="number"
                          value={simInvestment}
                          onChange={(e) => setSimInvestment(Number(e.target.value))}
                        />
                      </div>
                    </div>

                    <Button onClick={runSimulation} disabled={simulating}>
                      {simulating ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Zap className="h-3.5 w-3.5 mr-1.5" />}
                      Run Simulation
                    </Button>
                  </CardContent>
                </Card>

                {/* Simulation result */}
                {simResult && (
                  <>
                    <Card className={cn('border-2', verdictColor(simResult.verdict))}>
                      <CardContent className="p-6">
                        <div className="flex items-start gap-3">
                          <Sparkles className="h-6 w-6 flex-shrink-0 mt-1" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <span className="text-base font-bold">{simResult.scenarioName}</span>
                              {simResult.targetCountryIso && <Badge variant="outline" className="text-[10px]">{simResult.targetCountryIso}</Badge>}
                              <Badge variant="outline" className={cn('text-xs font-bold uppercase', verdictColor(simResult.verdict))}>
                                {simResult.verdict}
                              </Badge>
                              <Badge variant="outline" className="text-[10px]">{simResult.horizonMonths}mo horizon</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground leading-relaxed mb-3">{simResult.rationale}</p>
                            <div className="text-[10px] text-muted-foreground italic">{simResult.methodology}</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                      <KPICard icon={TrendingUp} label="Cum. Revenue" value={fmtINR(simResult.cumulativeRevenue)} color="emerald" />
                      <KPICard icon={Wallet} label="Cum. Profit" value={fmtINR(simResult.cumulativeProfit)} color="cyan" />
                      <KPICard icon={Activity} label="Cum. Cash Flow" value={fmtINR(simResult.cumulativeCashFlow)} color="blue" />
                      <KPICard icon={Scale} label="Cum. Tax" value={fmtINR(simResult.cumulativeTaxLiability)} color="amber" />
                      <KPICard icon={Target} label="ROI" value={fmtPct(simResult.roiPct)} color={simResult.roiPct >= 15 ? 'emerald' : simResult.roiPct < 0 ? 'rose' : 'amber'} />
                      <KPICard icon={Clock} label="Payback" value={simResult.paybackMonths !== null ? `${simResult.paybackMonths}mo` : 'N/A'} color="purple" />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                      <Card>
                        <CardHeader><CardTitle className="text-sm">Risk & Compliance</CardTitle></CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            <div>
                              <div className="flex justify-between text-xs mb-1">
                                <span>Avg Risk Score</span>
                                <span className="font-medium">{simResult.avgRiskScore.toFixed(1)}/100</span>
                              </div>
                              <Progress value={simResult.avgRiskScore} className="h-2" />
                            </div>
                            <div>
                              <div className="flex justify-between text-xs mb-1">
                                <span>Avg Compliance Score</span>
                                <span className="font-medium">{simResult.avgComplianceScore.toFixed(1)}/100</span>
                              </div>
                              <Progress value={simResult.avgComplianceScore} className="h-2" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader><CardTitle className="text-sm">Recommended Actions</CardTitle></CardHeader>
                        <CardContent>
                          <ul className="space-y-1.5">
                            {simResult.recommendedActions.map((a, i) => (
                              <li key={i} className="text-[11px] flex items-start gap-1.5">
                                <CheckCircle2 className="h-3 w-3 text-emerald-500 flex-shrink-0 mt-0.5" />
                                <span>{a}</span>
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader><CardTitle className="text-sm">Compliance Impact</CardTitle></CardHeader>
                        <CardContent>
                          {simResult.complianceImpact.length === 0 ? (
                            <p className="text-[11px] text-muted-foreground">No specific compliance impacts detected.</p>
                          ) : (
                            <ul className="space-y-1.5">
                              {simResult.complianceImpact.map((c, i) => (
                                <li key={i} className="text-[11px] flex items-start gap-1.5">
                                  <Scale className="h-3 w-3 text-rose-500 flex-shrink-0 mt-0.5" />
                                  <span>{c}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </CardContent>
                      </Card>
                    </div>

                    {/* Monthly projections table */}
                    <Card>
                      <CardHeader><CardTitle className="text-sm">Monthly Projections (Base INR)</CardTitle></CardHeader>
                      <CardContent>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-left border-b text-muted-foreground">
                                <th className="py-2">Month</th>
                                <th className="text-right">Revenue</th>
                                <th className="text-right">Expense</th>
                                <th className="text-right">Profit</th>
                                <th className="text-right">Cash Flow</th>
                                <th className="text-right">Tax</th>
                                <th className="text-right">Risk</th>
                                <th className="text-right">Compliance</th>
                              </tr>
                            </thead>
                            <tbody>
                              {simResult.projections.map((p) => (
                                <tr key={p.month} className="border-b">
                                  <td className="py-1.5 font-medium">M{p.month}</td>
                                  <td className="text-right">{fmtINR(p.revenueBase)}</td>
                                  <td className="text-right">{fmtINR(p.expenseBase)}</td>
                                  <td className="text-right">{fmtINR(p.profitBase)}</td>
                                  <td className="text-right">{fmtINR(p.cashFlowBase)}</td>
                                  <td className="text-right">{fmtINR(p.taxLiabilityBase)}</td>
                                  <td className="text-right">{p.riskScore.toFixed(0)}</td>
                                  <td className="text-right">{p.complianceScore.toFixed(0)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </CardContent>
                    </Card>
                  </>
                )}

                {/* Expansion opportunities */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2"><MapPin className="h-4 w-4" />Top Expansion Opportunities</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[500px] overflow-y-auto">
                      {expansion.opportunities.slice(0, 9).map((o) => (
                        <div key={o.countryIso} className="p-3 rounded-lg border bg-card space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-[10px] font-bold text-white">
                                {o.countryIso}
                              </div>
                              <div>
                                <div className="text-sm font-medium">{o.countryName}</div>
                                <div className="text-[10px] text-muted-foreground">{o.region}</div>
                              </div>
                            </div>
                            <Badge variant="outline" className="text-[10px] font-bold">{o.expansionScore}/100</Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-1 text-[10px]">
                            <div>Market: <span className="font-medium">{o.marketAttractiveness}/100</span></div>
                            <div>Ease: <span className="font-medium">{o.easeOfDoingBusiness}/100</span></div>
                            <div>Regulatory: <span className="font-medium">{o.regulatoryComplexity}/100</span></div>
                            <div>Tax: <span className="font-medium">{o.taxBurden}/100</span></div>
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            Setup: {fmtUSD(o.estimatedSetupCostUsd)} · {o.estimatedTimeToOperationMonths}mo · {o.recommendedStructure}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* Sticky footer */}
      <footer className="mt-auto border-t bg-background/95 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-2 flex-wrap">
            <ShieldCheck className="h-3 w-3 text-emerald-500" />
            <span>13 Enterprise APIs · 9 Prisma models · 7 AI Executives · 8 simulation scenarios</span>
          </div>
          <div className="flex items-center gap-2">
            <span>Founded & owned by <strong className="text-foreground">{FOUNDER}</strong></span>
          </div>
        </div>
      </footer>
    </div>
  );
}

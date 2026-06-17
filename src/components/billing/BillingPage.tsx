'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  Check,
  Zap,
  Crown,
  Building2,
  Users,
  FileText,
  HardDrive,
  Sparkles,
  Shield,
  Palette,
  Code2,
  IndianRupee,
  TrendingUp,
} from 'lucide-react';
import {
  useFireClients,
  useFireInvoices,
  useFireDocuments,
  useFireFirm,
} from '@/hooks/use-firestore';

// ═══════════════════════════════════════════════════════════════════════════════
// PLAN DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

interface PlanFeature {
  text: string;
  icon?: React.ReactNode;
}

interface PlanDefinition {
  key: string;
  name: string;
  price: number;
  priceLabel: string;
  description: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  borderColor: string;
  buttonVariant: 'default' | 'outline';
  recommended?: boolean;
  limits: {
    clients: number | null;       // null = unlimited
    invoices: number | null;
    storage: number;              // GB
    teamMembers: number | null;
  };
  features: PlanFeature[];
}

const PLANS: PlanDefinition[] = [
  {
    key: 'starter',
    name: 'Starter',
    price: 2999,
    priceLabel: '₹2,999',
    description: 'For solo practitioners getting started with GST compliance.',
    icon: Zap,
    color: 'text-slate-600',
    bgColor: 'bg-slate-50',
    borderColor: 'border-slate-200',
    buttonVariant: 'outline',
    limits: {
      clients: 25,
      invoices: 500,
      storage: 5,
      teamMembers: 1,
    },
    features: [
      { text: 'Up to 25 clients', icon: <Users className="h-3.5 w-3.5" /> },
      { text: '500 invoices/mo', icon: <FileText className="h-3.5 w-3.5" /> },
      { text: '5 GB storage', icon: <HardDrive className="h-3.5 w-3.5" /> },
      { text: 'Email support', icon: <Shield className="h-3.5 w-3.5" /> },
    ],
  },
  {
    key: 'professional',
    name: 'Professional',
    price: 7999,
    priceLabel: '₹7,999',
    description: 'For growing practices that need AI power and team collaboration.',
    icon: Crown,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    buttonVariant: 'default',
    recommended: true,
    limits: {
      clients: 100,
      invoices: 5000,
      storage: 25,
      teamMembers: 5,
    },
    features: [
      { text: 'Up to 100 clients', icon: <Users className="h-3.5 w-3.5" /> },
      { text: '5,000 invoices/mo', icon: <FileText className="h-3.5 w-3.5" /> },
      { text: '25 GB storage', icon: <HardDrive className="h-3.5 w-3.5" /> },
      { text: 'Priority support', icon: <Shield className="h-3.5 w-3.5" /> },
      { text: 'AI Copilot', icon: <Sparkles className="h-3.5 w-3.5" /> },
      { text: 'Team (5 members)', icon: <Users className="h-3.5 w-3.5" /> },
    ],
  },
  {
    key: 'firm',
    name: 'Firm',
    price: 19999,
    priceLabel: '₹19,999',
    description: 'For established firms with unlimited scale and white-label needs.',
    icon: Building2,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    buttonVariant: 'outline',
    limits: {
      clients: null,
      invoices: null,
      storage: 100,
      teamMembers: null,
    },
    features: [
      { text: 'Unlimited clients', icon: <Users className="h-3.5 w-3.5" /> },
      { text: 'Unlimited invoices', icon: <FileText className="h-3.5 w-3.5" /> },
      { text: '100 GB storage', icon: <HardDrive className="h-3.5 w-3.5" /> },
      { text: 'Dedicated support', icon: <Shield className="h-3.5 w-3.5" /> },
      { text: 'AI Copilot', icon: <Sparkles className="h-3.5 w-3.5" /> },
      { text: 'Unlimited team', icon: <Users className="h-3.5 w-3.5" /> },
      { text: 'White-label', icon: <Palette className="h-3.5 w-3.5" /> },
      { text: 'API access', icon: <Code2 className="h-3.5 w-3.5" /> },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// SKELETON
// ═══════════════════════════════════════════════════════════════════════════════

function BillingSkeleton() {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-6 space-y-4">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-4 w-full" />
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, j) => (
                  <Skeleton key={j} className="h-4 w-3/4" />
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-2 w-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PLAN CARD
// ═══════════════════════════════════════════════════════════════════════════════

function PlanCard({
  plan,
  isCurrentPlan,
}: {
  plan: PlanDefinition;
  isCurrentPlan: boolean;
}) {
  const Icon = plan.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      <Card
        className={`relative flex flex-col h-full transition-shadow hover:shadow-lg ${
          plan.recommended
            ? 'border-emerald-300 shadow-emerald-100/50 shadow-md'
            : ''
        } ${isCurrentPlan ? 'ring-2 ring-emerald-500' : ''}`}
      >
        {/* Recommended badge */}
        {plan.recommended && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] px-3">
              Recommended
            </Badge>
          </div>
        )}

        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className={`h-10 w-10 rounded-lg ${plan.bgColor} flex items-center justify-center`}>
              <Icon className={`h-5 w-5 ${plan.color}`} />
            </div>
            {isCurrentPlan && (
              <Badge variant="outline" className="text-emerald-700 border-emerald-300 bg-emerald-50 text-[11px]">
                Current Plan
              </Badge>
            )}
          </div>
          <CardTitle className="text-lg mt-3">{plan.name}</CardTitle>
          <CardDescription className="text-xs">{plan.description}</CardDescription>
        </CardHeader>

        <CardContent className="flex-1">
          {/* Price */}
          <div className="flex items-baseline gap-1 mb-5">
            <span className="text-3xl font-bold text-foreground">{plan.priceLabel}</span>
            <span className="text-sm text-muted-foreground">/mo</span>
          </div>

          {/* Features */}
          <ul className="space-y-2.5">
            {plan.features.map((feat, i) => (
              <li key={i} className="flex items-center gap-2.5 text-sm">
                <span className="text-emerald-600 shrink-0">
                  <Check className="h-4 w-4" />
                </span>
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  {feat.icon}
                  {feat.text}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>

        <CardFooter className="pt-2 pb-6">
          <Button
            className={`w-full ${
              isCurrentPlan
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : plan.recommended
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : ''
            }`}
            variant={isCurrentPlan ? 'default' : plan.buttonVariant}
            disabled={isCurrentPlan}
          >
            {isCurrentPlan ? 'Current Plan' : `Upgrade to ${plan.name}`}
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// USAGE BAR
// ═══════════════════════════════════════════════════════════════════════════════

function UsageBar({
  label,
  current,
  limit,
  icon,
  unit,
}: {
  label: string;
  current: number;
  limit: number | null;
  icon: React.ReactNode;
  unit?: string;
}) {
  const displayLimit = limit ?? 0;
  const isUnlimited = limit === null;
  const percentage = isUnlimited
    ? Math.min((current / Math.max(current * 2, 100)) * 100, 100)
    : Math.min((current / Math.max(displayLimit, 1)) * 100, 100);

  const isNearLimit = !isUnlimited && percentage > 80;
  const isAtLimit = !isUnlimited && percentage >= 100;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          {icon}
          {label}
        </div>
        <span className={`text-xs font-medium ${isAtLimit ? 'text-red-600' : isNearLimit ? 'text-amber-600' : 'text-muted-foreground'}`}>
          {current.toLocaleString('en-IN')} {unit} / {isUnlimited ? 'Unlimited' : displayLimit.toLocaleString('en-IN')}
        </span>
      </div>
      <Progress
        value={percentage}
        className={`h-2 ${isAtLimit ? '[&>div]:bg-red-500' : isNearLimit ? '[&>div]:bg-amber-500' : ''}`}
      />
      {isNearLimit && !isAtLimit && (
        <p className="text-[11px] text-amber-600">
          Approaching your plan limit
        </p>
      )}
      {isAtLimit && (
        <p className="text-[11px] text-red-600">
          Plan limit reached — upgrade to add more
        </p>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function BillingPage() {
  // Live Firestore data
  const { data: clients, loading: clientsLoading } = useFireClients();
  const { data: invoices, loading: invoicesLoading } = useFireInvoices();
  const { data: documents, loading: documentsLoading } = useFireDocuments();
  const { data: firm, loading: firmLoading } = useFireFirm();

  const loading = clientsLoading || invoicesLoading || documentsLoading || firmLoading;

  // Derive current plan from firm data
  // FirestoreFirm doesn't have a plan field directly, so we derive from usage
  // Map firm data to a plan — using the firm's activeClientCount as a heuristic
  // In a real app, the plan would be stored on the firm or user document
  const currentPlan = useMemo(() => {
    // If firm data has a plan indication, use that
    // For now, derive from client count
    const clientCount = clients.length;
    if (clientCount > 100) return 'firm';
    if (clientCount > 25) return 'professional';
    return 'starter';
  }, [clients.length]);

  // Current plan limits
  const activePlanDef = useMemo(
    () => PLANS.find((p) => p.key === currentPlan) ?? PLANS[0],
    [currentPlan]
  );

  // Compute usage metrics from live data
  const clientCount = clients.length;
  const invoiceCount = invoices.length;
  const documentCount = documents.length;

  // Simulated storage based on document count (avg ~2MB per document)
  const storageUsedGB = useMemo(() => {
    const totalBytes = documents.reduce((sum, doc) => sum + (doc.fileSize || 0), 0);
    if (totalBytes > 0) {
      return parseFloat((totalBytes / (1024 * 1024 * 1024)).toFixed(2));
    }
    // Fallback: estimate ~2MB per doc
    return parseFloat((documentCount * 2 / 1024).toFixed(2));
  }, [documents, documentCount]);

  if (loading) {
    return <BillingSkeleton />;
  }

  return (
    <div className="space-y-8">
      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Billing & Usage
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage your subscription and monitor resource usage across your firm.
            </p>
          </div>
          <Badge variant="outline" className="gap-1.5 text-xs">
            <IndianRupee className="h-3 w-3" />
            {activePlanDef.name} Plan
          </Badge>
        </div>
      </motion.div>

      {/* ── Plan Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {PLANS.map((plan) => (
          <PlanCard
            key={plan.key}
            plan={plan}
            isCurrentPlan={currentPlan === plan.key}
          />
        ))}
      </div>

      {/* ── Usage Section ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.1 }}
      >
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
                <CardTitle className="text-base">Current Usage</CardTitle>
              </div>
              <Badge variant="secondary" className="text-[11px]">
                {activePlanDef.name} Plan Limits
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Live usage metrics synced from your firm's Firestore data in real-time.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <UsageBar
              label="Clients"
              current={clientCount}
              limit={activePlanDef.limits.clients}
              icon={<Users className="h-4 w-4 text-emerald-600" />}
            />
            <UsageBar
              label="Invoices"
              current={invoiceCount}
              limit={activePlanDef.limits.invoices}
              icon={<FileText className="h-4 w-4 text-blue-600" />}
              unit="/mo"
            />
            <UsageBar
              label="Documents"
              current={documentCount}
              limit={null}
              icon={<FileText className="h-4 w-4 text-amber-600" />}
            />
            <UsageBar
              label="Storage"
              current={storageUsedGB}
              limit={activePlanDef.limits.storage}
              icon={<HardDrive className="h-4 w-4 text-purple-600" />}
              unit="GB"
            />
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

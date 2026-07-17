'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  Brain,
  ShieldCheck,
  Landmark,
  Mail,
  FileText,
  CheckCircle2,
  Circle,
  AlertTriangle,
  Sparkles,
  Database,
  Activity,
  IndianRupee,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useOrg } from '@/contexts/OrgContext';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Activate Oracle — 4-Step Wizard
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Directive STEP 2 (Activate Oracle flow):
 *   Step 1 — Check required integrations (GSTN, Bank, Google, Invoices)
 *   Step 2 — Validate data quality
 *   Step 3 — Generate Business Snapshot
 *   Step 4 — Activate Oracle → status = Active
 *
 * On activation, persists an `oracleActivated` flag on the organisation via
 * PUT /api/firm-settings so the Home page (and Ask Oracle card) reflect the
 * new state. The flag gates the Ask Oracle advanced-analysis entry.
 */

interface ActivateOracleWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onActivated?: () => void;
  /** Live connection state — drives Step 1 readiness. */
  integrations: {
    gstn: boolean;
    bank: boolean;
    google: boolean;
    zoho?: boolean;
    invoices: boolean;
  };
  /** Live data-quality signals — drive Step 2 readiness. */
  dataQuality: {
    customers: number;
    invoices: number;
    hasRevenue: boolean;
  };
}

type Step = 1 | 2 | 3 | 4;

export function ActivateOracleWizard({
  open,
  onOpenChange,
  onActivated,
  integrations,
  dataQuality,
}: ActivateOracleWizardProps) {
  const { organization, reload: reloadOrg } = useOrg();
  const orgId = organization?.id ?? null;
  const [step, setStep] = useState<Step>(1);
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setStep(1);
      setActivating(false);
      setError(null);
    }
  }, [open]);

  // Per the stabilization directive: only Google + Zoho Books are real
  // integrations. GSTN and Banking are "Coming Soon" — they are NOT shown
  // as requirements here because the user cannot actually connect them yet.
  const integrationItems = [
    { id: 'google', label: 'Google Connected', done: integrations.google },
    { id: 'zoho', label: 'Zoho Books Connected', done: integrations.zoho ?? false },
    { id: 'invoices', label: 'Invoices Available', done: integrations.invoices },
  ] as const;
  const integrationsReady = integrationItems.every((i) => i.done);
  const integrationsDone = integrationItems.filter((i) => i.done).length;

  const qualityItems = [
    {
      id: 'customers',
      label: 'At least 1 customer',
      done: dataQuality.customers > 0,
      detail: `${dataQuality.customers} customer${dataQuality.customers === 1 ? '' : 's'}`,
    },
    {
      id: 'invoices',
      label: 'At least 1 invoice',
      done: dataQuality.invoices > 0,
      detail: `${dataQuality.invoices} invoice${dataQuality.invoices === 1 ? '' : 's'}`,
    },
    {
      id: 'revenue',
      label: 'Revenue data present',
      done: dataQuality.hasRevenue,
      detail: dataQuality.hasRevenue ? 'Revenue recorded' : 'No revenue yet',
    },
  ] as const;
  const qualityReady = qualityItems.every((i) => i.done);

  const handleActivate = async () => {
    setActivating(true);
    setError(null);
    if (!orgId) {
      setError('No organization is currently selected. Please reload the page and try again.');
      setActivating(false);
      return;
    }
    try {
      // Get the Firebase ID token for server-side authentication.
      const { auth } = await import('@/lib/firebase');
      const currentUser = auth.currentUser;
      if (!currentUser) {
        setError('Your session has expired. Please sign in again.');
        setActivating(false);
        return;
      }
      const idToken = await currentUser.getIdToken();

      // Call the real activation backend. This executes the full pipeline:
      // verify membership → generate Business Snapshot → calculate scores →
      // persist to Firestore → log activity → generate AI recommendations.
      const res = await fetch('/api/oracle/activate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ organizationId: orgId }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'We could not activate Oracle. Please try again.');
      }

      // Reload the org context so organization.integrations.oracle reflects
      // the persisted state (no temp state — Firestore is the source of truth).
      await reloadOrg();
      toast.success('Oracle Activated', {
        description: `Business Snapshot generated — Health Score ${data.snapshot?.healthScore ?? 0}/100. Oracle is now online.`,
      });
      onActivated?.();
      onOpenChange(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'We could not activate Oracle. Please try again.',
      );
    } finally {
      setActivating(false);
    }
  };

  const stepLabels = ['Integrations', 'Data Quality', 'Snapshot', 'Activate'];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="flex items-center justify-center h-9 w-9 rounded-xl accent-gradient">
              <Brain className="h-4 w-4 text-white" />
            </div>
            <div>
              <DialogTitle className="text-base">Activate Oracle</DialogTitle>
              <DialogDescription className="text-xs">
                Oracle turns your live business data into instant answers,
                predictions, and automated actions.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center gap-1.5 px-1">
          {stepLabels.map((label, i) => {
            const n = (i + 1) as Step;
            const isActive = step === n;
            const isDone = step > n;
            return (
              <React.Fragment key={label}>
                <div className="flex items-center gap-1.5">
                  <div
                    className={`flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-bold ${
                      isDone
                        ? 'bg-emerald-500 text-white'
                        : isActive
                          ? 'accent-gradient text-white'
                          : 'bg-white/[0.06] text-muted-foreground'
                    }`}
                  >
                    {isDone ? <CheckCircle2 className="h-3 w-3" /> : n}
                  </div>
                  <span
                    className={`text-[10px] hidden sm:inline ${
                      isActive ? 'text-foreground font-medium' : 'text-muted-foreground'
                    }`}
                  >
                    {label}
                  </span>
                </div>
                {i < stepLabels.length - 1 && (
                  <div
                    className={`h-px flex-1 ${isDone ? 'bg-emerald-500/40' : 'bg-white/[0.06]'}`}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>

        <div className="min-h-[180px]">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.25 }}
                className="space-y-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 accent-text" />
                  <h4 className="text-sm font-semibold text-foreground">
                    Step 1 · Required Integrations
                  </h4>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Oracle needs live data sources to generate accurate insights.
                  Connect these integrations to continue.
                </p>
                <ul className="space-y-1.5">
                  {integrationItems.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        {item.done ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        ) : (
                          <Circle className="h-4 w-4 text-muted-foreground/50" />
                        )}
                        <span className="text-xs text-foreground">{item.label}</span>
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-[9px] h-4 px-1.5 ${
                          item.done
                            ? 'border-emerald-500/30 text-emerald-400'
                            : 'border-amber-500/30 text-amber-400'
                        }`}
                      >
                        {item.done ? 'Ready' : 'Pending'}
                      </Badge>
                    </li>
                  ))}
                </ul>
                <p className="text-[11px] text-muted-foreground">
                  {integrationsDone}/4 integrations ready. You can still activate
                  Oracle with partial data — it will recommend connecting the rest.
                </p>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.25 }}
                className="space-y-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 accent-text" />
                  <h4 className="text-sm font-semibold text-foreground">
                    Step 2 · Data Quality
                  </h4>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Oracle analyses your customers, invoices, and revenue to build
                  a personalised business brain.
                </p>
                <ul className="space-y-1.5">
                  {qualityItems.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        {item.done ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-amber-400" />
                        )}
                        <span className="text-xs text-foreground">{item.label}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">{item.detail}</span>
                    </li>
                  ))}
                </ul>
                {!qualityReady && (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-amber-300/90 leading-relaxed">
                      Your data is partial. Oracle will activate but
                      recommendations will be limited until you create customers
                      and invoices.
                    </p>
                  </div>
                )}
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.25 }}
                className="space-y-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 accent-text" />
                  <h4 className="text-sm font-semibold text-foreground">
                    Step 3 · Business Snapshot
                  </h4>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Oracle will read from the central Business Snapshot — the
                  single source of truth for revenue, cash, GST, health score,
                  and risk across your entire workspace. The snapshot is fed
                  by real integrations (Google, Zoho Books) and your
                  invoice / customer / expense data.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Revenue', icon: IndianRupee },
                    { label: 'Cash Position', icon: Landmark },
                    { label: 'GST Liability', icon: FileText },
                    { label: 'Health Score', icon: ShieldCheck },
                  ].map((s) => {
                    const Icon = s.icon;
                    return (
                      <div
                        key={s.label}
                        className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2"
                      >
                        <Icon className="h-3.5 w-3.5 accent-text" />
                        <span className="text-[11px] text-foreground">{s.label}</span>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  The snapshot auto-refreshes every 60 seconds so Oracle always
                  sees your latest numbers.
                </p>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.25 }}
                className="space-y-3 py-2 text-center"
              >
                <div className="flex items-center justify-center h-14 w-14 rounded-2xl accent-gradient mx-auto">
                  <Sparkles className="h-6 w-6 text-white" />
                </div>
                <h4 className="text-sm font-semibold text-foreground">
                  Ready to Activate Oracle
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed max-w-[360px] mx-auto">
                  Oracle will analyse your live business data and generate
                  recommendations, predictions, and priority actions. You can
                  deactivate it anytime from Settings.
                </p>
                {error && (
                  <p className="text-xs text-red-400 leading-relaxed">{error}</p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => (step > 1 ? setStep((s) => (s - 1) as Step) : onOpenChange(false))}
            disabled={activating}
            className="border-border"
          >
            {step > 1 ? 'Back' : 'Cancel'}
          </Button>
          {step < 4 ? (
            <Button
              onClick={() => setStep((s) => (s + 1) as Step)}
              className="accent-gradient text-white hover:opacity-90 gap-1.5"
            >
              Continue
            </Button>
          ) : (
            <Button
              onClick={handleActivate}
              disabled={activating}
              className="accent-gradient text-white hover:opacity-90 gap-1.5"
            >
              {activating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              Activate Oracle
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Local icon import to avoid an extra named import in the map above.
// (Moved to top imports above.)

export default ActivateOracleWizard;

'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO — Oracle Autonomous Actions Panel (Phase Delta · 2)
// Grid of permission-gated AI actions: create invoice, generate report,
// schedule reminder, prepare GST return, etc. With dry-run + audit.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from 'react';
import { motion } from 'framer-motion';
import * as Icons from 'lucide-react';
import { Sparkles, Shield, Play, Eye, History, X } from 'lucide-react';
import { ORACLE_ACTIONS, type OracleAction } from '@/lib/autonomous-finance/oracle-actions-defs';
import { useOrg } from '@/contexts/OrgContext';
import { useAuth } from '@/contexts/AuthContext';
import { TrustBar } from '@/components/shared/TrustBar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const EASE = [0.16, 1, 0.3, 1] as const;

const PERM_COLOR: Record<string, string> = {
  admin: 'border-rose-400/30 text-rose-300',
  manager: 'border-amber-400/30 text-amber-300',
  staff: 'border-cyan-400/30 text-cyan-300',
  auto: 'border-emerald-400/30 text-emerald-300',
};

const CATEGORY_ACCENT: Record<string, string> = {
  invoicing: 'bg-emerald-500/15 text-emerald-300',
  gst: 'bg-amber-500/15 text-amber-300',
  banking: 'bg-cyan-500/15 text-cyan-300',
  collections: 'bg-rose-500/15 text-rose-300',
  communication: 'bg-cyan-500/15 text-cyan-300',
  reporting: 'bg-teal-500/15 text-teal-300',
  tasks: 'bg-cyan-500/15 text-cyan-300',
};

interface HistoryEntry {
  actionId: string; actionName: string; status: 'success' | 'error'; ts: string; dryRun: boolean; message: string;
}

export function OracleActionsPanel() {
  const { organization } = useOrg();
  const { user } = useAuth();
  const [activeAction, setActiveAction] = useState<OracleAction | null>(null);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [dryRunResult, setDryRunResult] = useState<unknown>(null);
  const [executing, setExecuting] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  function getIcon(name: string): Icons.LucideIcon {
    return (Icons as unknown as Record<string, Icons.LucideIcon>)[name] ?? Icons.Sparkles;
  }

  function openAction(action: OracleAction) {
    setActiveAction(action);
    setInputs({});
    setDryRunResult(null);
  }

  async function runAction(dryRun: boolean) {
    if (!activeAction) return;
    setExecuting(true);
    try {
      const res = await fetch('/api/oracle/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actionId: activeAction.id,
          input: inputs,
          dryRun,
          organizationId: organization?.id ?? 'preview-org',
          userId: user?.id ?? 'preview-user',
          userEmail: user?.email ?? 'preview@veyro.com',
        }),
      });
      const data = await res.json();
      if (dryRun) {
        setDryRunResult(data.output ?? data);
        toast.info('Dry run complete — preview ready');
      } else {
        if (data.success) {
          toast.success(`Oracle executed: ${activeAction.name}`);
          setHistory((h) => [{ actionId: activeAction.id, actionName: activeAction.name, status: 'success', ts: new Date().toISOString(), dryRun: false, message: (data.output as { message?: string })?.message ?? 'Completed' }, ...h].slice(0, 8));
          setActiveAction(null);
        } else {
          toast.error(data.error ?? 'Execution failed');
          setHistory((h) => [{ actionId: activeAction.id, actionName: activeAction.name, status: 'error', ts: new Date().toISOString(), dryRun: false, message: data.error ?? 'Failed' }, ...h].slice(0, 8));
        }
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Network error');
    } finally {
      setExecuting(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-8">
        <div className="mx-auto max-w-7xl space-y-6">
          {/* Header */}
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground md:text-3xl">Oracle Autonomous Actions</h1>
              <p className="mt-1 text-sm text-muted-foreground">AI-executed finance operations with permission gates and audit logging</p>
            </div>
            <TrustBar connected={history.length > 0} activityCount={history.length} />
          </div>

          {/* Action grid */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ORACLE_ACTIONS.map((action, i) => {
              const Icon = getIcon(action.icon);
              return (
                <motion.div
                  key={action.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: EASE, delay: i * 0.04 }}
                  className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 transition-colors hover:border-white/[0.12]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${CATEGORY_ACCENT[action.category] ?? 'bg-white/5 text-muted-foreground'}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <Badge variant="outline" className={`text-[10px] ${PERM_COLOR[action.permission]}`}>
                      <Shield className="mr-1 h-2.5 w-2.5" /> {action.permission}
                    </Badge>
                  </div>
                  <h3 className="mt-3 text-sm font-semibold text-foreground">{action.name}</h3>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{action.description}</p>
                  <Button size="sm" variant="outline" className="mt-3 w-full border-white/10 text-foreground hover:bg-white/5"
                    onClick={() => openAction(action)}>
                    <Play className="mr-1.5 h-3.5 w-3.5" /> Execute
                  </Button>
                </motion.div>
              );
            })}
          </div>

          {/* History */}
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
            <div className="mb-3 flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">Action History</h3>
            </div>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">No actions executed yet. Click "Execute" on any action above.</p>
            ) : (
              <div className="space-y-1.5">
                {history.map((h, i) => (
                  <div key={i} className="flex items-center gap-2.5 text-sm">
                    <span className={`h-1.5 w-1.5 rounded-full ${h.status === 'success' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                    <span className="flex-1 text-foreground">{h.actionName}</span>
                    <span className="text-xs text-muted-foreground">{h.message}</span>
                    <span className="text-xs text-muted-foreground">{new Date(h.ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action execution modal */}
      {activeAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setActiveAction(null)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2, ease: EASE }}
            className="w-full max-w-lg rounded-2xl border border-white/[0.08] bg-background p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${CATEGORY_ACCENT[activeAction.category]}`}>
                  {(() => { const I = getIcon(activeAction.icon); return <I className="h-4 w-4" />; })()}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{activeAction.name}</h3>
                  <Badge variant="outline" className={`mt-0.5 text-[10px] ${PERM_COLOR[activeAction.permission]}`}>
                    <Shield className="mr-1 h-2.5 w-2.5" /> Permission: {activeAction.permission}
                  </Badge>
                </div>
              </div>
              <button onClick={() => setActiveAction(null)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>

            <div className="space-y-3">
              {activeAction.inputSchema.map((field) => (
                <div key={field.key}>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    {field.label}{field.required && <span className="ml-0.5 text-rose-400">*</span>}
                  </label>
                  {field.type === 'textarea' ? (
                    <textarea
                      className="w-full rounded-md border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-emerald-400/40 focus:outline-none"
                      rows={3}
                      placeholder={field.placeholder}
                      value={inputs[field.key] ?? ''}
                      onChange={(e) => setInputs((p) => ({ ...p, [field.key]: e.target.value }))}
                    />
                  ) : field.type === 'select' ? (
                    <select
                      className="w-full rounded-md border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-sm text-foreground focus:border-emerald-400/40 focus:outline-none"
                      value={inputs[field.key] ?? ''}
                      onChange={(e) => setInputs((p) => ({ ...p, [field.key]: e.target.value }))}
                    >
                      <option value="">Select…</option>
                      {field.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  ) : (
                    <input
                      type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                      className="w-full rounded-md border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-emerald-400/40 focus:outline-none"
                      placeholder={field.placeholder}
                      value={inputs[field.key] ?? ''}
                      onChange={(e) => setInputs((p) => ({ ...p, [field.key]: e.target.value }))}
                    />
                  )}
                </div>
              ))}
            </div>

            {dryRunResult !== null && (
              <div className="mt-3 rounded-md border border-white/[0.08] bg-white/[0.02] p-3">
                <p className="mb-1 text-xs font-medium text-cyan-300">Dry Run Preview</p>
                <pre className="overflow-x-auto text-xs text-muted-foreground">{JSON.stringify(dryRunResult, null, 2)}</pre>
              </div>
            )}

            <div className="mt-4 flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-xs text-amber-300">
                <Sparkles className="h-3 w-3" /> All actions are audit-logged
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="border-white/10" disabled={executing} onClick={() => runAction(true)}>
                  <Eye className="mr-1.5 h-3.5 w-3.5" /> Dry Run
                </Button>
                <Button size="sm" className="bg-emerald-500 text-emerald-950 hover:bg-emerald-400" disabled={executing} onClick={() => runAction(false)}>
                  <Play className="mr-1.5 h-3.5 w-3.5" /> {executing ? 'Executing…' : 'Execute'}
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

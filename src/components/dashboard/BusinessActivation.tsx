'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ V13 — Business Activation
//
// V13 spec: "Business Activation: Connect GSTN · Connect Bank · Invite Team ·
//   Enable AI. Simple progress tracker. No huge cards."
//
// A clean horizontal 4-step tracker. Each step is a compact card with an icon,
// label, description, and a Connect/Connected toggle. A thin progress line at
// the top shows overall completion. Honest state — only marks complete when the
// user actually clicks Connect.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck, Landmark, Users, Sparkles, Check, Plus, ArrowRight,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useOracleStore } from '@/lib/oracle-store';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

// ─── Step definitions ─────────────────────────────────────────────────────────

interface ActivationStep {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  /** The action label when not connected */
  actionLabel: string;
}

const STEPS: ActivationStep[] = [
  {
    id: 'gstn',
    label: 'Connect GSTN',
    description: 'Pull returns & filings automatically',
    icon: ShieldCheck,
    actionLabel: 'Connect',
  },
  {
    id: 'bank',
    label: 'Connect Bank',
    description: 'Sync transactions for reconciliation',
    icon: Landmark,
    actionLabel: 'Connect',
  },
  {
    id: 'team',
    label: 'Invite Team',
    description: 'Add your CA team members',
    icon: Users,
    actionLabel: 'Invite',
  },
  {
    id: 'ai',
    label: 'Enable AI',
    description: 'Unlock Oracle autopilot & insights',
    icon: Sparkles,
    actionLabel: 'Enable',
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function BusinessActivation() {
  const { toast } = useToast();
  const openWorkspace = useOracleStore((s) => s.openWorkspace);
  const [connected, setConnected] = useState<Record<string, boolean>>({});
  const [inviteOpen, setInviteOpen] = useState(false);

  const completedCount = Object.values(connected).filter(Boolean).length;
  const progress = (completedCount / STEPS.length) * 100;
  const allDone = completedCount === STEPS.length;

  const handleStepClick = useCallback((step: ActivationStep) => {
    if (step.id === 'team') {
      setInviteOpen(true);
      return;
    }
    if (step.id === 'ai') {
      // "Enable AI" opens the Oracle with an activation query
      openWorkspace('Enable AI autopilot for my business');
      setConnected((s) => ({ ...s, [step.id]: true }));
      toast({
        title: 'AI Enabled',
        description: 'Oracle is now monitoring your business.',
      });
      return;
    }
    // GSTN / Bank — toggle connected
    setConnected((s) => {
      const next = { ...s, [step.id]: !s[step.id] };
      toast({
        title: next[step.id] ? `${step.label} connected` : `${step.label} disconnected`,
        description: next[step.id]
          ? 'Sync will begin shortly.'
          : 'Connection removed.',
      });
      return next;
    });
  }, [openWorkspace, toast]);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] as const }}
        className="glass-surface rounded-[24px] p-5"
      >
        {/* Header row: label + progress */}
        <div className="mb-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <h3 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Business Activation
            </h3>
            <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
              {completedCount}/{STEPS.length}
            </span>
          </div>
          {allDone && (
            <motion.span
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-1 text-[11px] font-medium text-[#00F5D4]"
            >
              <Check className="h-3 w-3" />
              Fully Activated
            </motion.span>
          )}
        </div>

        {/* Progress bar */}
        <div className="mb-5 h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
          <motion.div
            className="accent-gradient h-full rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] as const }}
          />
        </div>

        {/* Steps grid */}
        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          {STEPS.map((step, i) => {
            const isDone = connected[step.id];
            const Icon = step.icon;
            return (
              <motion.button
                key={step.id}
                type="button"
                onClick={() => handleStepClick(step)}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.06 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={cn(
                  'group relative flex flex-col items-start gap-2.5 rounded-2xl border p-3.5 text-left transition-all duration-200',
                  isDone
                    ? 'border-[#00F5D4]/25 bg-[#00F5D4]/[0.05]'
                    : 'border-white/[0.08] bg-white/[0.02] hover:border-white/[0.15] hover:bg-white/[0.04]',
                )}
              >
                {/* Icon */}
                <div className="flex w-full items-center justify-between">
                  <div
                    className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-xl transition-colors',
                      isDone ? 'accent-gradient' : 'bg-white/[0.05]',
                    )}
                  >
                    {isDone ? (
                      <Check className="h-4 w-4 text-black" />
                    ) : (
                      <Icon className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
                    )}
                  </div>
                  {/* Step number */}
                  <span className="text-[11px] font-medium text-muted-foreground/50">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                </div>

                {/* Label + description */}
                <div className="min-w-0">
                  <p
                    className={cn(
                      'text-sm font-medium leading-tight',
                      isDone ? 'text-foreground' : 'text-foreground/90',
                    )}
                  >
                    {step.label}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">
                    {step.description}
                  </p>
                </div>

                {/* Action label */}
                <span
                  className={cn(
                    'mt-auto flex items-center gap-1 text-[11px] font-medium transition-colors',
                    isDone
                      ? 'text-[#00F5D4]'
                      : 'text-muted-foreground group-hover:text-foreground',
                  )}
                >
                  {isDone ? (
                    <>Connected</>
                  ) : step.id === 'team' ? (
                    <>
                      <Plus className="h-3 w-3" />
                      {step.actionLabel}
                    </>
                  ) : (
                    <>
                      {step.actionLabel}
                      <ArrowRight className="h-3 w-3" />
                    </>
                  )}
                </span>
              </motion.button>
            );
          })}
        </div>
      </motion.div>

      {/* Invite Team Dialog */}
      <InviteTeamDialog open={inviteOpen} onOpenChange={setInviteOpen} onInvited={() => {
        setConnected((s) => ({ ...s, team: true }));
      }} />
    </>
  );
}

// ─── Invite Team Dialog ───────────────────────────────────────────────────────

function InviteTeamDialog({
  open,
  onOpenChange,
  onInvited,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInvited: () => void;
}) {
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('accountant');

  const handleSend = () => {
    if (!email.trim()) return;
    toast({
      title: 'Invitation sent',
      description: `${email} has been invited as ${role}.`,
    });
    setEmail('');
    onInvited();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Invite Team Member</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="invite-email">Email address</Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="colleague@firm.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            />
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin — full access</SelectItem>
                <SelectItem value="accountant">Accountant — manage clients & returns</SelectItem>
                <SelectItem value="viewer">Viewer — read only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={!email.trim()}
            className="accent-gradient text-black hover:opacity-90"
          >
            Send Invite
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default BusinessActivation;

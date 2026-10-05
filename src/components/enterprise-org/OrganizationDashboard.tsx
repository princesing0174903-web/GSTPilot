'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — OrganizationDashboard
//
// The premium "Organization Management" landing view. Owners / Admins land here
// to see their company workspace at a glance: profile, plan, members, recent
// activity, quick actions and notification preferences. All data comes from
// real hooks (useEnterpriseOrg / useOrg / usePermissions) — never mock.
//
// Visual standard: rounded-2xl cards with subtle borders, dark-mode compatible
// Tailwind tokens (bg-card, text-muted-foreground, border-border/60), staggered
// fade+slide-up entrance via framer-motion (guarded so SSR / motion failures
// can never crash the page).
//
// Permissions:
//   • `<PermissionGate permission="org.view">` wraps the whole view — non-org
//     members see the branded deny state.
//   • Edit / Save controls additionally check `usePermissions().isPrivileged`
//     (owner | admin) and are hidden for everyone else.
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

import {
  Building2,
  Pencil,
  Users,
  CreditCard,
  Activity,
  Zap,
  Bell,
  ChevronRight,
  Plus,
  ShieldCheck,
  KeyRound,
  FileClock,
  MapPin,
  Globe,
  Hash,
  Calendar,
  Briefcase,
  Layers,
  Mail,
  Sparkles,
  AlertTriangle,
  Inbox,
  Loader2,
  Clock,
} from 'lucide-react';

import { PermissionGate } from '@/components/enterprise-org/PermissionGate';
import { useEnterpriseOrg } from '@/hooks/useEnterpriseOrg';
import { usePermissions } from '@/hooks/usePermissions';
import { useApp } from '@/contexts/AppContext';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { ROLE_LABELS } from '@/lib/auth/types';
import type {
  OrgRole,
  MemberStatus,
  OrganizationDoc,
  OrganizationMemberDoc,
} from '@/lib/auth/types';
import type { AuditCategory } from '@/lib/enterprise-org';

// ─── Static dropdown options (Form options, NOT mock business data) ────────────
// These are enumeration vocabularies the user can pick FROM, not fabricated
// org data. They are necessary for the Edit form Selects.

const INDUSTRY_OPTIONS = [
  'Accounting',
  'Manufacturing',
  'Retail',
  'IT',
  'Consulting',
  'Finance',
  'Healthcare',
  'Education',
  'Other',
] as const;

const COMPANY_SIZE_OPTIONS = ['1-10', '11-50', '51-200', '201-1000', '1000+'] as const;

const TIMEZONE_OPTIONS = [
  'Asia/Kolkata',
  'America/New_York',
  'Europe/London',
  'Asia/Dubai',
  'Asia/Singapore',
  'UTC',
] as const;

const CURRENCY_OPTIONS = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD'] as const;

const COUNTRY_OPTIONS = [
  'India',
  'United States',
  'United Kingdom',
  'UAE',
  'Singapore',
  'Australia',
] as const;

const ENTITY_TYPE_OPTIONS = [
  'Proprietorship',
  'Partnership',
  'LLP',
  'Private Limited',
  'Public Limited',
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function orgInitials(name: string): string {
  if (!name) return 'WS';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || 'WS';
}

function planBadgeClass(plan: OrganizationDoc['plan']): string {
  switch (plan) {
    case 'enterprise':
      return 'border-purple-500/30 bg-purple-500/10 text-purple-500 dark:text-purple-400';
    case 'pro':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
    default:
      return 'border-border/60 bg-muted/40 text-muted-foreground';
  }
}

function statusBadgeClass(status: MemberStatus): string {
  switch (status) {
    case 'active':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
    case 'invited':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400';
    case 'suspended':
      return 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400';
    case 'removed':
    default:
      return 'border-border/60 bg-muted/40 text-muted-foreground';
  }
}

function memberInitials(name: string, email: string): string {
  const base = name || email || '';
  if (!base) return '?';
  const parts = base.trim().split(/[\s@]+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}

/**
 * Human-friendly relative time — "just now", "5m ago", "3h ago", "2d ago",
 * "Mar 4". Falls back to absolute date for anything older than a week.
 */
function relativeTime(iso: string): string {
  try {
    const ts = Date.parse(iso);
    if (Number.isNaN(ts)) return '—';
    const diff = Date.now() - ts;
    const sec = Math.max(0, Math.floor(diff / 1000));
    if (sec < 45) return 'just now';
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const day = Math.floor(hr / 24);
    if (day < 7) return `${day}d ago`;
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '—';
  }
}

function CategoryIcon({
  category,
  className,
}: {
  category: AuditCategory;
  className?: string;
}) {
  switch (category) {
    case 'auth':
    case 'security':
      return <ShieldCheck className={className} />;
    case 'member':
    case 'role':
      return <Users className={className} />;
    case 'settings':
    case 'organization':
      return <Building2 className={className} />;
    case 'billing':
    case 'subscription':
    case 'payment':
    case 'expense':
      return <CreditCard className={className} />;
    case 'api_key':
      return <KeyRound className={className} />;
    case 'integration':
      return <Layers className={className} />;
    case 'ai':
      return <Sparkles className={className} />;
    case 'invoice':
    case 'return':
    case 'document':
      return <FileClock className={className} />;
    case 'client':
      return <Briefcase className={className} />;
    default:
      return <Activity className={className} />;
  }
}

function formatValue(value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') return 'Not set';
  return value;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return 'Not set';
  try {
    const ts = Date.parse(value);
    if (Number.isNaN(ts)) return 'Not set';
    return new Date(ts).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return 'Not set';
  }
}

// ─── Safe motion wrapper ──────────────────────────────────────────────────────
// framer-motion crashes are very rare but in a long-lived dashboard view we
// don't want a single animation hiccup to blank the page. This wrapper falls
// back to plain divs if motion is unavailable.

const MotionDiv: React.ComponentType<Record<string, unknown>> =
  typeof motion !== 'undefined' && motion && (motion as { div?: unknown }).div
    ? ((motion as { div: React.ComponentType<Record<string, unknown>> }).div as React.ComponentType<
        Record<string, unknown>
      >)
    : ((props: Record<string, unknown>) => <div {...props} />);

function FadeIn({
  delay = 0,
  className,
  children,
}: {
  delay?: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <MotionDiv
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </MotionDiv>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function InfoRow({
  icon: Icon,
  label,
  value,
  muted,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 py-2">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted/40 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        <div
          className={`mt-0.5 truncate text-sm font-medium ${
            muted ? 'text-muted-foreground italic' : 'text-foreground'
          }`}
          title={value}
        >
          {value}
        </div>
      </div>
    </div>
  );
}

function MemberRow({ member }: { member: OrganizationMemberDoc }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <Avatar className="h-8 w-8 shrink-0">
        {member.userPhotoURL ? <AvatarImage src={member.userPhotoURL} alt="" /> : null}
        <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
          {memberInitials(member.userDisplayName, member.userEmail)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-foreground">
          {member.userDisplayName || member.userEmail}
        </div>
        <div className="truncate text-xs text-muted-foreground">{member.userEmail}</div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-medium">
          {ROLE_LABELS[member.role as OrgRole] ?? String(member.role ?? '—')}
        </Badge>
        <Badge
          variant="outline"
          className={`h-5 px-1.5 text-[10px] font-medium capitalize ${statusBadgeClass(
            (member.status as MemberStatus) ?? 'active',
          )}`}
        >
          {member.status ?? 'active'}
        </Badge>
      </div>
    </div>
  );
}

function ActivityRow({
  summary,
  category,
  actorName,
  timestamp,
}: {
  summary: string;
  category: AuditCategory;
  actorName: string | null;
  timestamp: string;
}) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <CategoryIcon category={category} className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm text-foreground" title={summary}>
          {summary}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="truncate">{actorName ?? 'System'}</span>
          <span aria-hidden>·</span>
          <span className="shrink-0">{relativeTime(timestamp)}</span>
        </div>
      </div>
    </div>
  );
}

function QuickActionButton({
  icon: Icon,
  label,
  description,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-start gap-3 rounded-xl border border-border/60 bg-card/40 p-3 text-left transition-all hover:border-border hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-foreground">{label}</div>
        <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{description}</div>
      </div>
      <ChevronRight className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
    </button>
  );
}

function NotificationToggle({
  label,
  description,
  enabled,
}: {
  label: string;
  description: string;
  enabled: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-foreground">{label}</div>
        <div className="mt-0.5 text-[11px] text-muted-foreground">{description}</div>
      </div>
      <Switch checked={enabled} disabled aria-label={label} />
    </div>
  );
}

function CardShell({
  title,
  description,
  icon: Icon,
  action,
  children,
}: {
  title: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="rounded-2xl border-border/60 bg-card/60 shadow-sm backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold tracking-tight">{title}</CardTitle>
              {description ? (
                <CardDescription className="mt-0.5 text-xs">{description}</CardDescription>
              ) : null}
            </div>
          </div>
          {action}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-card/60 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Skeleton className="h-14 w-14 rounded-2xl" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
        <Skeleton className="h-9 w-24 rounded-md" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="rounded-2xl border-border/60">
            <CardHeader className="pb-3">
              <Skeleton className="h-4 w-32" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
              <Skeleton className="h-3 w-3/5" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── Edit Company Dialog ──────────────────────────────────────────────────────

interface EditFormState {
  name: string;
  legalName: string;
  gstin: string;
  pan: string;
  industry: string;
  companySize: string;
  timezone: string;
  currency: string;
  country: string;
  entityType: string;
  officeAddress: string;
}

/**
 * Form body. This is rendered inside `<DialogContent>` which only mounts its
 * children when the dialog opens (Radix portals handle the open/close). As a
 * result, the lazy `useState` initializer below runs once per mount — i.e.
 * once per dialog open — with the freshest `organization` values. No
 * `useEffect` syncing is needed (which would trigger the
 * `react-hooks/set-state-in-effect` rule).
 *
 * The `key={organization.id}` on the form element guarantees a remount if the
 * organization changes (rare — only happens if the user switches orgs mid-edit,
 * which the UI prevents by closing the dialog on save).
 */
function EditCompanyForm({
  organization,
  onSave,
  onCancel,
  saving,
}: {
  organization: OrganizationDoc;
  onSave: (state: EditFormState) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<EditFormState>(() => ({
    name: organization.name ?? '',
    legalName: organization.legalName ?? '',
    gstin: organization.gstin ?? '',
    pan: organization.pan ?? '',
    industry: organization.industry ?? '',
    companySize: organization.companySize ?? '',
    timezone: organization.timezone ?? '',
    currency: organization.currency ?? '',
    country: organization.country ?? '',
    entityType: organization.entityType ?? '',
    officeAddress: organization.officeAddress ?? '',
  }));
  const [inlineError, setInlineError] = useState<string | null>(null);

  const update = useCallback(
    <K extends keyof EditFormState>(key: K, value: EditFormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const handleSave = useCallback(async () => {
    setInlineError(null);
    if (!form.name.trim()) {
      setInlineError('Organization name is required.');
      return;
    }
    try {
      await onSave(form);
    } catch (err) {
      setInlineError(err instanceof Error ? err.message : 'Could not save changes.');
    }
  }, [form, onSave]);

  return (
    <>
      <div className="grid gap-4 py-2">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="org-name">Display name</Label>
            <Input
              id="org-name"
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              placeholder="Acme Pvt Ltd"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="org-legal-name">Legal name</Label>
            <Input
              id="org-legal-name"
              value={form.legalName}
              onChange={(e) => update('legalName', e.target.value)}
              placeholder="Acme Private Limited"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="org-gstin">GSTIN</Label>
            <Input
              id="org-gstin"
              value={form.gstin}
              onChange={(e) => update('gstin', e.target.value)}
              placeholder="22AAAAA0000A1Z5"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="org-pan">PAN</Label>
            <Input
              id="org-pan"
              value={form.pan}
              onChange={(e) => update('pan', e.target.value)}
              placeholder="AAAAA0000A"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Industry</Label>
            <Select
              value={form.industry || undefined}
              onValueChange={(v) => update('industry', v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select industry" />
              </SelectTrigger>
              <SelectContent>
                {INDUSTRY_OPTIONS.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Company size</Label>
            <Select
              value={form.companySize || undefined}
              onValueChange={(v) => update('companySize', v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select size" />
              </SelectTrigger>
              <SelectContent>
                {COMPANY_SIZE_OPTIONS.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Timezone</Label>
            <Select
              value={form.timezone || undefined}
              onValueChange={(v) => update('timezone', v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select timezone" />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONE_OPTIONS.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Currency</Label>
            <Select
              value={form.currency || undefined}
              onValueChange={(v) => update('currency', v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select currency" />
              </SelectTrigger>
              <SelectContent>
                {CURRENCY_OPTIONS.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Country</Label>
            <Select
              value={form.country || undefined}
              onValueChange={(v) => update('country', v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select country" />
              </SelectTrigger>
              <SelectContent>
                {COUNTRY_OPTIONS.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Entity type</Label>
            <Select
              value={form.entityType || undefined}
              onValueChange={(v) => update('entityType', v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select entity type" />
              </SelectTrigger>
              <SelectContent>
                {ENTITY_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="org-address">Office address</Label>
          <Textarea
            id="org-address"
            value={form.officeAddress}
            onChange={(e) => update('officeAddress', e.target.value)}
            placeholder="123 Business Park, City, State, PIN"
            rows={3}
          />
        </div>

        {inlineError ? (
          <div className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-600 dark:text-rose-400">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span>{inlineError}</span>
          </div>
        ) : null}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
          Save changes
        </Button>
      </DialogFooter>
    </>
  );
}

function EditCompanyDialog({
  open,
  onOpenChange,
  organization,
  onSave,
  saving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organization: OrganizationDoc;
  onSave: (state: EditFormState) => Promise<void>;
  saving: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>Edit organization profile</DialogTitle>
          <DialogDescription>
            Update company identity, legal details, and localization preferences.
          </DialogDescription>
        </DialogHeader>
        {/*
          Radix Dialog only mounts DialogContent's children when `open` is true
          (it portals in/out). So the form below mounts fresh each time the
          dialog opens, and its lazy useState initializer reads the latest
          `organization` values. The `key` is a safety net in case the
          organization changes mid-session.
        */}
        <EditCompanyForm
          key={organization.id}
          organization={organization}
          onSave={async (state) => {
            await onSave(state);
            onOpenChange(false);
          }}
          onCancel={() => onOpenChange(false)}
          saving={saving}
        />
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function OrganizationDashboard() {
  return (
    <PermissionGate permission="org.view">
      <OrganizationDashboardInner />
    </PermissionGate>
  );
}

function OrganizationDashboardInner() {
  const {
    organization,
    members,
    role,
    activity,
    activityLoading,
    activityError,
    saveProfile,
    refreshActivity,
    saving,
  } = useEnterpriseOrg();
  const { isPrivileged } = usePermissions();
  const { setCurrentView } = useApp();

  const [editOpen, setEditOpen] = useState(false);

  const handleSaveProfile = useCallback(
    async (state: EditFormState) => {
      const { error } = await saveProfile({
        name: state.name.trim() || null,
        legalName: state.legalName.trim() || null,
        gstin: state.gstin.trim() || null,
        pan: state.pan.trim() || null,
        industry: state.industry || null,
        companySize: state.companySize || null,
        timezone: state.timezone || null,
        currency: state.currency || null,
        country: state.country || null,
        entityType: state.entityType || null,
        officeAddress: state.officeAddress.trim() || null,
      });
      if (error) {
        toast.error('Could not save profile', { description: error });
        throw new Error(error);
      }
      toast.success('Organization profile updated.');
    },
    [saveProfile],
  );

  const topMembers = useMemo(() => members.slice(0, 5), [members]);
  const recentActivity = useMemo(() => activity.slice(0, 8), [activity]);

  // Notifications preferences — read-only mirror of organization.notifications
  const notifications = organization?.notifications ?? null;

  // ── Loading state: organization still null ──
  if (!organization) {
    return <DashboardSkeleton />;
  }

  const plan = organization.plan ?? 'free';
  const subscription = organization.subscription ?? null;
  const seatsUsed = members.length;
  const seatsTotal = subscription?.seats ?? null;

  return (
    <div className="min-h-screen bg-background pb-12">
      <div className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
        {/* ─── Header ─── */}
        <FadeIn delay={0}>
          <div className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-card/60 p-6 shadow-sm backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-14 w-14 shrink-0 rounded-2xl">
                {organization.logoUrl ? (
                  <AvatarImage src={organization.logoUrl} alt={organization.name} />
                ) : null}
                <AvatarFallback className="rounded-2xl bg-primary/10 text-base font-bold text-primary">
                  {orgInitials(organization.name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="truncate text-xl font-semibold tracking-tight text-foreground">
                    {organization.name}
                  </h1>
                  <Badge
                    variant="outline"
                    className={`h-5 px-1.5 text-[10px] font-bold uppercase ${planBadgeClass(plan)}`}
                  >
                    {plan}
                  </Badge>
                  {organization.status === 'suspended' ? (
                    <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-bold uppercase">
                      Suspended
                    </Badge>
                  ) : null}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {organization.industry ? (
                    <span className="inline-flex items-center gap-1">
                      <Briefcase className="h-3 w-3" />
                      {organization.industry}
                    </span>
                  ) : null}
                  {organization.companySize ? (
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {organization.companySize} people
                    </span>
                  ) : null}
                  {organization.country ? (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {organization.country}
                    </span>
                  ) : null}
                  {role ? (
                    <span className="inline-flex items-center gap-1">
                      <ShieldCheck className="h-3 w-3" />
                      You are {ROLE_LABELS[role]}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isPrivileged ? (
                <Button variant="default" size="sm" onClick={() => setEditOpen(true)}>
                  <Pencil className="mr-1.5 h-3.5 w-3.5" />
                  Edit
                </Button>
              ) : null}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentView('enterprise-settings')}
              >
                Settings
              </Button>
            </div>
          </div>
        </FadeIn>

        {/* ─── Card grid ─── */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* Company Overview */}
          <FadeIn delay={0.05}>
            <CardShell
              title="Company overview"
              description="Identity, legal details, and address"
              icon={Building2}
              action={
                isPrivileged ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 px-2 text-xs"
                    onClick={() => setEditOpen(true)}
                  >
                    <Pencil className="h-3 w-3" />
                    Edit
                  </Button>
                ) : null
              }
            >
              <div className="divide-y divide-border/40">
                <InfoRow
                  icon={Building2}
                  label="Legal name"
                  value={formatValue(organization.legalName ?? organization.name)}
                  muted={!organization.legalName}
                />
                <InfoRow
                  icon={Hash}
                  label="GSTIN"
                  value={formatValue(organization.gstin)}
                  muted={!organization.gstin}
                />
                <InfoRow
                  icon={Hash}
                  label="PAN"
                  value={formatValue(organization.pan)}
                  muted={!organization.pan}
                />
                <InfoRow
                  icon={Briefcase}
                  label="Industry"
                  value={formatValue(organization.industry)}
                  muted={!organization.industry}
                />
                <InfoRow
                  icon={Users}
                  label="Company size"
                  value={formatValue(organization.companySize)}
                  muted={!organization.companySize}
                />
                <InfoRow
                  icon={Clock}
                  label="Timezone"
                  value={formatValue(organization.timezone)}
                  muted={!organization.timezone}
                />
                <InfoRow
                  icon={Globe}
                  label="Currency"
                  value={formatValue(organization.currency)}
                  muted={!organization.currency}
                />
                <InfoRow
                  icon={MapPin}
                  label="Country"
                  value={formatValue(organization.country)}
                  muted={!organization.country}
                />
                <InfoRow
                  icon={Layers}
                  label="Entity type"
                  value={formatValue(organization.entityType)}
                  muted={!organization.entityType}
                />
                <InfoRow
                  icon={MapPin}
                  label="Office address"
                  value={formatValue(organization.officeAddress)}
                  muted={!organization.officeAddress}
                />
              </div>
            </CardShell>
          </FadeIn>

          {/* Workspace */}
          <FadeIn delay={0.1}>
            <CardShell
              title="Workspace"
              description="Plan, seats, and subscription"
              icon={Layers}
              action={
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 px-2 text-xs"
                  onClick={() => setCurrentView('enterprise-settings')}
                >
                  Manage
                  <ChevronRight className="h-3 w-3" />
                </Button>
              }
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/30 p-3">
                  <div>
                    <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      Current plan
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={`h-5 px-1.5 text-[10px] font-bold uppercase ${planBadgeClass(plan)}`}
                      >
                        {plan}
                      </Badge>
                      {subscription?.status ? (
                        <span className="text-xs capitalize text-muted-foreground">
                          {subscription.status.replace('_', ' ')}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <CreditCard className="h-5 w-5 text-muted-foreground" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
                    <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      Members
                    </div>
                    <div className="mt-1 text-2xl font-semibold text-foreground">{seatsUsed}</div>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
                    <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      Seats
                    </div>
                    <div className="mt-1 text-2xl font-semibold text-foreground">
                      {seatsTotal ?? '∞'}
                    </div>
                  </div>
                </div>

                <div className="space-y-2 rounded-xl border border-border/60 bg-muted/30 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Renewal date</span>
                    <span className="font-medium text-foreground">
                      {formatDate(subscription?.renewalDate)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Billing cycle</span>
                    <span className="font-medium capitalize text-foreground">
                      {subscription?.interval ?? '—'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Workspace status</span>
                    <span className="font-medium capitalize text-foreground">
                      {organization.status ?? 'active'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={() => setCurrentView('team')}
                  >
                    <Users className="mr-1.5 h-3.5 w-3.5" />
                    Members
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={() => setCurrentView('enterprise-settings')}
                  >
                    <CreditCard className="mr-1.5 h-3.5 w-3.5" />
                    Billing
                  </Button>
                </div>
              </div>
            </CardShell>
          </FadeIn>

          {/* Members Preview */}
          <FadeIn delay={0.15}>
            <CardShell
              title="Members"
              description={`${members.length} ${members.length === 1 ? 'person' : 'people'} in this workspace`}
              icon={Users}
              action={
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 px-2 text-xs"
                  onClick={() => setCurrentView('team')}
                >
                  View all
                  <ChevronRight className="h-3 w-3" />
                </Button>
              }
            >
              {members.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/40">
                    <Users className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="text-sm font-medium text-foreground">No members yet</div>
                  <div className="text-xs text-muted-foreground">
                    Invite teammates to collaborate.
                  </div>
                  {isPrivileged ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-1 h-8"
                      onClick={() => setCurrentView('team')}
                    >
                      <Plus className="mr-1.5 h-3.5 w-3.5" />
                      Invite member
                    </Button>
                  ) : null}
                </div>
              ) : (
                <div className="divide-y divide-border/40">
                  {topMembers.map((m) => (
                    <MemberRow key={m.id} member={m} />
                  ))}
                </div>
              )}
            </CardShell>
          </FadeIn>

          {/* Recent Activity */}
          <FadeIn delay={0.2}>
            <CardShell
              title="Recent activity"
              description="Latest events in this workspace"
              icon={Activity}
              action={
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 px-2 text-xs"
                  onClick={() => setCurrentView('audit-trail')}
                >
                  View all
                  <ChevronRight className="h-3 w-3" />
                </Button>
              }
            >
              {activityError ? (
                <div className="flex flex-col items-center justify-center gap-3 py-6 text-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm font-medium text-foreground">
                      Could not load activity
                    </div>
                    <div className="text-xs text-muted-foreground">{activityError}</div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={() => {
                      void refreshActivity();
                    }}
                  >
                    Retry
                  </Button>
                </div>
              ) : activityLoading ? (
                <div className="space-y-3 py-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <Skeleton className="h-7 w-7 rounded-lg" />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-3 w-full" />
                        <Skeleton className="h-2.5 w-2/3" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : recentActivity.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/40">
                    <Inbox className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="text-sm font-medium text-foreground">No activity yet</div>
                  <div className="text-xs text-muted-foreground">
                    Actions performed in this workspace will appear here.
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-border/40">
                  {recentActivity.map((entry) => (
                    <ActivityRow
                      key={entry.id}
                      summary={entry.summary}
                      category={entry.category}
                      actorName={entry.actorName}
                      timestamp={entry.timestamp}
                    />
                  ))}
                </div>
              )}
            </CardShell>
          </FadeIn>

          {/* Quick Actions */}
          <FadeIn delay={0.25}>
            <CardShell
              title="Quick actions"
              description="Jump to common management tasks"
              icon={Zap}
            >
              <div className="grid gap-2 sm:grid-cols-2">
                <QuickActionButton
                  icon={Pencil}
                  label="Edit profile"
                  description="Update company identity"
                  onClick={() => {
                    if (isPrivileged) setEditOpen(true);
                    else setCurrentView('enterprise-settings');
                  }}
                />
                <QuickActionButton
                  icon={Users}
                  label="Manage members"
                  description="Invite, suspend, or remove"
                  onClick={() => setCurrentView('team')}
                />
                <QuickActionButton
                  icon={Building2}
                  label="Organization settings"
                  description="Branding, localization, billing"
                  onClick={() => setCurrentView('enterprise-settings')}
                />
                <QuickActionButton
                  icon={CreditCard}
                  label="Billing & subscription"
                  description="Plan, seats, payment method"
                  onClick={() => setCurrentView('billing')}
                />
                <QuickActionButton
                  icon={KeyRound}
                  label="API keys"
                  description="Programmatic access tokens"
                  onClick={() => setCurrentView('api-platform')}
                />
                <QuickActionButton
                  icon={FileClock}
                  label="Audit trail"
                  description="Full event history"
                  onClick={() => setCurrentView('audit-trail')}
                />
              </div>
            </CardShell>
          </FadeIn>

          {/* Preferences (notification mirror — read-only) */}
          <FadeIn delay={0.3}>
            <CardShell
              title="Notification preferences"
              description="Workspace-wide notification defaults"
              icon={Bell}
              action={
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 px-2 text-xs"
                  onClick={() => setCurrentView('enterprise-settings')}
                >
                  Configure
                  <ChevronRight className="h-3 w-3" />
                </Button>
              }
            >
              <div className="divide-y divide-border/40">
                <NotificationToggle
                  label="Email updates"
                  description="Product news and workspace digests"
                  enabled={!!notifications?.emailUpdates}
                />
                <NotificationToggle
                  label="GST reminders"
                  description="Filing due dates and overdue alerts"
                  enabled={!!notifications?.gstReminders}
                />
                <NotificationToggle
                  label="AI insights"
                  description="Recommendations from Oracle AI"
                  enabled={!!notifications?.aiInsights}
                />
                <NotificationToggle
                  label="Security alerts"
                  description="Sign-ins, role changes, API key usage"
                  enabled={!!notifications?.securityAlerts}
                />
              </div>
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-border/60 bg-muted/30 p-2.5 text-[11px] text-muted-foreground">
                <Mail className="mt-0.5 h-3 w-3 shrink-0" />
                <span>Configure notification rules in Organization Settings.</span>
              </div>
            </CardShell>
          </FadeIn>
        </div>
      </div>

      {/* ─── Edit Dialog ─── */}
      {isPrivileged ? (
        <EditCompanyDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          organization={organization}
          onSave={handleSaveProfile}
          saving={saving}
        />
      ) : null}
    </div>
  );
}

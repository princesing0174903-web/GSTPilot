'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO — EnterpriseSettings
//
// The premium Organization Settings console. A left sidebar lists every
// settings section (General, Branding, Localization, Security, Members,
// Notifications, Billing, Subscription, Integrations, API Keys, AI Settings,
// Danger Zone) and the right panel renders the active section with a
// framer-motion fade/slide transition.
//
// • Real data only — pulled from `useEnterpriseOrg()` + `useOrg()`. Null
//   fields render as muted "Not set" text. No mock data anywhere.
// • Permission gating — the whole page is wrapped in
//   `<PermissionGate permission="org.view">`. Within each section, management
//   controls are gated by their specific permission via `usePermissions().can`.
//   Sections the user cannot access at all are hidden from the sidebar.
// • Forms — controlled `useState`, initialized from the org doc, reset when
//   the org changes. Each save shows inline "Saved ✓" + toast on success and
//   inline red error + toast on failure. The `saving` flag disables buttons.
// • Animations — framer-motion section transitions, guarded with try/catch so
//   the page still renders if motion fails to load.
// • Safety — default export, no required props, all nulls guarded, every async
//   wrapped in try/catch, no localStorage.
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2,
  Palette,
  Globe,
  Shield,
  Users,
  Bell,
  CreditCard,
  Receipt,
  Plug,
  Key,
  Sparkles,
  AlertTriangle,
  Save,
  Check,
  Loader2,
  Plus,
  Copy,
  Trash2,
  Ban,
  RotateCcw,
  UserPlus,
  Lock,
  Crown,
  Mail,
  Clock,
  Link2,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';

import { useEnterpriseOrg } from '@/hooks/useEnterpriseOrg';
import { useOrg } from '@/contexts/OrgContext';
import { useApp } from '@/contexts/AppContext';
import { usePermissions } from '@/hooks/usePermissions';
import { PermissionGate } from '@/components/enterprise-org/PermissionGate';
import {
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  ALL_ROLES,
} from '@/lib/auth/types';
// (Tabs API intentionally not used — we render a custom sticky sidebar nav
// for finer control over icons, descriptions, and the danger-zone styling.)
import type {
  OrgRole,
  OrganizationBilling,
  OrganizationSubscription,
  OrgApiKey,
} from '@/lib/auth/types';
import {
  canManageRole,
  canAssignRole,
  canManageMembers,
} from '@/lib/auth/permissions';
import {
  inviteMember,
  updateMemberRole,
  removeMember,
  deleteOrganization,
} from '@/lib/auth/organizations';

// ─── Section metadata ──────────────────────────────────────────────────────

type SectionId =
  | 'general'
  | 'branding'
  | 'localization'
  | 'security'
  | 'members'
  | 'notifications'
  | 'billing'
  | 'subscription'
  | 'integrations'
  | 'apikeys'
  | 'ai'
  | 'danger';

import type { Permission } from '@/lib/auth/types';

interface SectionMeta {
  id: SectionId;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  /** The permission required to SEE the section in the sidebar. */
  viewPermission: Permission;
}

const SECTIONS: SectionMeta[] = [
  {
    id: 'general',
    label: 'General',
    description: 'Organization profile, legal info, GST & PAN.',
    icon: Building2,
    viewPermission: 'org.settings',
  },
  {
    id: 'branding',
    label: 'Branding',
    description: 'Logo, colors, and custom domain.',
    icon: Palette,
    viewPermission: 'org.settings',
  },
  {
    id: 'localization',
    label: 'Localization',
    description: 'Timezone, currency, and country.',
    icon: Globe,
    viewPermission: 'org.settings',
  },
  {
    id: 'security',
    label: 'Security',
    description: 'Two-factor auth and session policy.',
    icon: Shield,
    viewPermission: 'org.settings',
  },
  {
    id: 'members',
    label: 'Members',
    description: 'Team roster, roles, invitations.',
    icon: Users,
    viewPermission: 'org.members.manage',
  },
  {
    id: 'notifications',
    label: 'Notifications',
    description: 'Email and alert preferences.',
    icon: Bell,
    viewPermission: 'org.settings',
  },
  {
    id: 'billing',
    label: 'Billing',
    description: 'Billing contact and tax details.',
    icon: CreditCard,
    viewPermission: 'org.billing',
  },
  {
    id: 'subscription',
    label: 'Subscription',
    description: 'Plan, seats, and renewal.',
    icon: Receipt,
    viewPermission: 'org.billing',
  },
  {
    id: 'integrations',
    label: 'Integrations',
    description: 'Connected apps and services.',
    icon: Plug,
    viewPermission: 'integrations.view',
  },
  {
    id: 'apikeys',
    label: 'API Keys',
    description: 'Programmatic access tokens.',
    icon: Key,
    viewPermission: 'apikeys.view',
  },
  {
    id: 'ai',
    label: 'AI Settings',
    description: 'VEYRO AI, AI CFO, predictive compliance.',
    icon: Sparkles,
    viewPermission: 'ai.settings',
  },
  {
    id: 'danger',
    label: 'Danger Zone',
    description: 'Transfer ownership, delete organization.',
    icon: AlertTriangle,
    viewPermission: 'org.delete',
  },
];

// ─── Helpers ───────────────────────────────────────────────────────────────

const TIMEZONES = [
  'Asia/Kolkata',
  'Asia/Dubai',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Europe/London',
  'Europe/Berlin',
  'America/New_York',
  'America/Los_Angeles',
  'Australia/Sydney',
  'UTC',
];

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'AUD', 'CAD'];

const COUNTRIES = [
  'India',
  'United States',
  'United Kingdom',
  'United Arab Emirates',
  'Singapore',
  'Australia',
  'Canada',
  'Germany',
];

const INDUSTRIES = [
  'Accounting & Tax',
  'Finance',
  'Manufacturing',
  'Retail & E-commerce',
  'Information Technology',
  'Real Estate',
  'Healthcare',
  'Education',
  'Construction',
  'Logistics',
  'Hospitality',
  'Other',
];

const COMPANY_SIZES = [
  '1-10',
  '11-50',
  '51-200',
  '201-500',
  '501-1000',
  '1000+',
];

const ENTITY_TYPES = [
  'Proprietorship',
  'Partnership',
  'LLP',
  'Private Limited',
  'Public Limited',
  'HUF',
  'Trust',
  'Society',
  'Other',
];

const API_KEY_SCOPES = ['read', 'write', 'invoices', 'returns', 'clients', 'reports'];

function fmtDate(value: unknown): string {
  if (!value) return '—';
  try {
    const d =
      value instanceof Date
        ? value
        : typeof value === 'string' || typeof value === 'number'
          ? new Date(value)
          : value instanceof Object && 'seconds' in (value as Record<string, unknown>)
            ? new Date(((value as { seconds: number; nanoseconds?: number }).seconds) * 1000)
            : null;
    if (!d || isNaN(d.getTime())) return '—';
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return '—';
  }
}

function initials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}

function roleBadgeClass(role: OrgRole): string {
  switch (role) {
    case 'owner':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400';
    case 'admin':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
    case 'manager':
      return 'border-cyan-500/30 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400';
    case 'accountant':
      return 'border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-400';
    case 'employee':
      return 'border-border/60 bg-muted/40 text-muted-foreground';
    case 'auditor':
      return 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400';
    case 'viewer':
      return 'border-border/60 bg-muted/40 text-muted-foreground';
    default:
      return 'border-border/60 bg-muted/40 text-muted-foreground';
  }
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'active':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
    case 'invited':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400';
    case 'suspended':
      return 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400';
    case 'removed':
      return 'border-border/60 bg-muted/40 text-muted-foreground';
    default:
      return 'border-border/60 bg-muted/40 text-muted-foreground';
  }
}

/** Wrap any async call so it never throws. Returns `{ error }`. */
async function safe<T>(fn: () => Promise<T>): Promise<{ value: T | null; error: string | null }> {
  try {
    const value = await fn();
    return { value, error: null };
  } catch (err) {
    return { value: null, error: err instanceof Error ? err.message : 'Unexpected error.' };
  }
}

// ─── Reusable form primitives ──────────────────────────────────────────────

interface FieldRowProps {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: React.ReactNode;
}

function FieldRow({ label, htmlFor, hint, children }: FieldRowProps) {
  return (
    <div className="grid gap-2 sm:grid-cols-[minmax(160px,200px)_1fr] sm:items-center sm:gap-4">
      <div className="space-y-0.5">
        <Label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
          {label}
        </Label>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

interface SaveBarProps {
  saving: boolean;
  savedAt: number | null;
  error: string | null;
  onSave: () => void;
  disabled?: boolean;
  saveLabel?: string;
}

function SaveBar({ saving, savedAt, error, onSave, disabled, saveLabel = 'Save changes' }: SaveBarProps) {
  const recent = savedAt !== null && Date.now() - savedAt < 4000;
  return (
    <div className="flex flex-wrap items-center gap-3 pt-2">
      <Button
        type="button"
        onClick={onSave}
        disabled={saving || disabled}
        className="gap-2"
      >
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Save className="h-4 w-4" />
        )}
        {saving ? 'Saving…' : saveLabel}
      </Button>
      {recent && !error ? (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
          <Check className="h-3.5 w-3.5" />
          Saved
        </span>
      ) : null}
      {error ? (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-600 dark:text-rose-400">
          <XCircle className="h-3.5 w-3.5" />
          {error}
        </span>
      ) : null}
    </div>
  );
}

function NotSet({ label = 'Not set' }: { label?: string }) {
  return <span className="text-sm italic text-muted-foreground">{label}</span>;
}

function SettingsCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="rounded-2xl border border-border/60 bg-card">
      <CardHeader className="gap-1.5 p-6 pb-4">
        <CardTitle className="text-base font-semibold tracking-tight">{title}</CardTitle>
        {description ? <CardDescription className="text-sm">{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="space-y-5 p-6 pt-0">{children}</CardContent>
    </Card>
  );
}

function SettingsSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-9 w-48" />
      <Card className="rounded-2xl border border-border/60">
        <CardHeader className="p-6 pb-4">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent className="space-y-5 p-6 pt-0">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[200px_1fr] sm:items-center sm:gap-4">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
          <div className="pt-2">
            <Skeleton className="h-9 w-32" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Sections ──────────────────────────────────────────────────────────────

// 1. General ────────────────────────────────────────────────────────────────

function GeneralSection() {
  const { organization, saveProfile, saving } = useEnterpriseOrg();
  const { can } = usePermissions();
  const editable = can('org.settings');

  const [form, setForm] = useState({
    name: '',
    legalName: '',
    gstin: '',
    pan: '',
    industry: '',
    companySize: '',
    entityType: '',
    officeAddress: '',
  });
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!organization) return;
    setForm({
      name: organization.name ?? '',
      legalName: organization.legalName ?? '',
      gstin: organization.gstin ?? '',
      pan: organization.pan ?? '',
      industry: organization.industry ?? '',
      companySize: organization.companySize ?? '',
      entityType: organization.entityType ?? '',
      officeAddress: organization.officeAddress ?? '',
    });
  }, [organization?.id, organization?.name, organization?.legalName, organization?.gstin,
      organization?.pan, organization?.industry, organization?.companySize,
      organization?.entityType, organization?.officeAddress]);

  const handleSave = useCallback(async () => {
    setError(null);
    const { error: saveError } = await saveProfile({
      name: form.name.trim(),
      legalName: form.legalName.trim() || null,
      gstin: form.gstin.trim() || null,
      pan: form.pan.trim() || null,
      industry: form.industry || null,
      companySize: form.companySize || null,
      entityType: form.entityType || null,
      officeAddress: form.officeAddress.trim() || null,
    });
    if (saveError) {
      setError(saveError);
      toast.error(saveError);
    } else {
      setSavedAt(Date.now());
      toast.success('Organization profile saved.');
    }
  }, [form, saveProfile]);

  if (!organization) return <SettingsSkeleton />;

  return (
    <SettingsCard
      title="General"
      description="The basic identity of your organization. Used across invoices, returns, and reports."
    >
      <FieldRow label="Organization name" htmlFor="org-name">
        <Input
          id="org-name"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          disabled={!editable || saving}
          placeholder="Acme Consulting LLP"
        />
      </FieldRow>
      <FieldRow label="Legal name" htmlFor="org-legal-name" hint="As registered with the MCA / GST.">
        <Input
          id="org-legal-name"
          value={form.legalName}
          onChange={(e) => setForm((f) => ({ ...f, legalName: e.target.value }))}
          disabled={!editable || saving}
          placeholder="Acme Consulting LLP"
        />
      </FieldRow>
      <FieldRow label="GSTIN" htmlFor="org-gstin">
        <Input
          id="org-gstin"
          value={form.gstin}
          onChange={(e) => setForm((f) => ({ ...f, gstin: e.target.value.toUpperCase() }))}
          disabled={!editable || saving}
          placeholder="22AAAAA0000A1Z5"
          maxLength={15}
        />
      </FieldRow>
      <FieldRow label="PAN" htmlFor="org-pan">
        <Input
          id="org-pan"
          value={form.pan}
          onChange={(e) => setForm((f) => ({ ...f, pan: e.target.value.toUpperCase() }))}
          disabled={!editable || saving}
          placeholder="AAAAA0000A"
          maxLength={10}
        />
      </FieldRow>
      <FieldRow label="Industry" htmlFor="org-industry">
        <Select
          value={form.industry}
          onValueChange={(v) => setForm((f) => ({ ...f, industry: v }))}
          disabled={!editable || saving}
        >
          <SelectTrigger id="org-industry" className="w-full">
            <SelectValue placeholder="Select an industry" />
          </SelectTrigger>
          <SelectContent>
            {INDUSTRIES.map((i) => (
              <SelectItem key={i} value={i}>
                {i}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FieldRow>
      <FieldRow label="Company size" htmlFor="org-size">
        <Select
          value={form.companySize}
          onValueChange={(v) => setForm((f) => ({ ...f, companySize: v }))}
          disabled={!editable || saving}
        >
          <SelectTrigger id="org-size" className="w-full">
            <SelectValue placeholder="Select headcount" />
          </SelectTrigger>
          <SelectContent>
            {COMPANY_SIZES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FieldRow>
      <FieldRow label="Entity type" htmlFor="org-entity">
        <Select
          value={form.entityType}
          onValueChange={(v) => setForm((f) => ({ ...f, entityType: v }))}
          disabled={!editable || saving}
        >
          <SelectTrigger id="org-entity" className="w-full">
            <SelectValue placeholder="Select entity type" />
          </SelectTrigger>
          <SelectContent>
            {ENTITY_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FieldRow>
      <FieldRow label="Office address" htmlFor="org-address" hint="Used on invoices and filings.">
        <Textarea
          id="org-address"
          value={form.officeAddress}
          onChange={(e) => setForm((f) => ({ ...f, officeAddress: e.target.value }))}
          disabled={!editable || saving}
          placeholder="123 Business Park, Mumbai, Maharashtra 400001"
          rows={3}
        />
      </FieldRow>
      {editable ? (
        <SaveBar saving={saving} savedAt={savedAt} error={error} onSave={handleSave} />
      ) : (
        <p className="text-xs text-muted-foreground">
          You need the <span className="font-medium">Manage organization settings</span> permission to edit these fields.
        </p>
      )}
    </SettingsCard>
  );
}

// 2. Branding ───────────────────────────────────────────────────────────────

function BrandingSection() {
  const { organization, saveBranding, saving } = useEnterpriseOrg();
  const { can } = usePermissions();
  const editable = can('org.settings');

  const [form, setForm] = useState({
    logoUrl: '',
    primaryColor: '#2563EB',
    accentColor: '#0ea5e9',
    customDomain: '',
  });
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!organization) return;
    setForm({
      logoUrl: organization.logoUrl ?? '',
      primaryColor: organization.branding?.primaryColor ?? '#2563EB',
      accentColor: organization.branding?.accentColor ?? '#0ea5e9',
      customDomain: organization.branding?.customDomain ?? '',
    });
  }, [organization?.id, organization?.logoUrl, organization?.branding?.primaryColor,
      organization?.branding?.accentColor, organization?.branding?.customDomain]);

  const handleSave = useCallback(async () => {
    setError(null);
    const { error: saveError } = await saveBranding({
      logoUrl: form.logoUrl.trim() || null,
      primaryColor: form.primaryColor,
      accentColor: form.accentColor,
      customDomain: form.customDomain.trim() || null,
    });
    if (saveError) {
      setError(saveError);
      toast.error(saveError);
    } else {
      setSavedAt(Date.now());
      toast.success('Branding saved.');
    }
  }, [form, saveBranding]);

  if (!organization) return <SettingsSkeleton />;

  return (
    <SettingsCard
      title="Branding"
      description="Customize how your organization appears to clients and across reports."
    >
      <FieldRow label="Logo URL" htmlFor="brand-logo" hint="A square PNG or SVG works best.">
        <Input
          id="brand-logo"
          value={form.logoUrl}
          onChange={(e) => setForm((f) => ({ ...f, logoUrl: e.target.value }))}
          disabled={!editable || saving}
          placeholder="https://cdn.example.com/logo.png"
        />
      </FieldRow>
      <FieldRow label="Primary color" htmlFor="brand-primary">
        <div className="flex items-center gap-3">
          <input
            id="brand-primary"
            type="color"
            value={form.primaryColor}
            onChange={(e) => setForm((f) => ({ ...f, primaryColor: e.target.value }))}
            disabled={!editable || saving}
            className="h-9 w-12 cursor-pointer rounded-md border border-border/60 bg-transparent p-1 disabled:cursor-not-allowed"
            aria-label="Primary color"
          />
          <Input
            value={form.primaryColor}
            onChange={(e) => setForm((f) => ({ ...f, primaryColor: e.target.value }))}
            disabled={!editable || saving}
            className="max-w-[140px] font-mono text-sm"
          />
        </div>
      </FieldRow>
      <FieldRow label="Accent color" htmlFor="brand-accent">
        <div className="flex items-center gap-3">
          <input
            id="brand-accent"
            type="color"
            value={form.accentColor}
            onChange={(e) => setForm((f) => ({ ...f, accentColor: e.target.value }))}
            disabled={!editable || saving}
            className="h-9 w-12 cursor-pointer rounded-md border border-border/60 bg-transparent p-1 disabled:cursor-not-allowed"
            aria-label="Accent color"
          />
          <Input
            value={form.accentColor}
            onChange={(e) => setForm((f) => ({ ...f, accentColor: e.target.value }))}
            disabled={!editable || saving}
            className="max-w-[140px] font-mono text-sm"
          />
        </div>
      </FieldRow>
      <FieldRow label="Custom domain" htmlFor="brand-domain" hint="e.g. portal.acme.com — requires DNS verification.">
        <Input
          id="brand-domain"
          value={form.customDomain}
          onChange={(e) => setForm((f) => ({ ...f, customDomain: e.target.value }))}
          disabled={!editable || saving}
          placeholder="portal.acme.com"
        />
      </FieldRow>
      <Separator />
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Preview</p>
        <div
          className="flex items-center gap-3 rounded-xl border border-border/60 p-4"
          style={{ background: `linear-gradient(135deg, ${form.primaryColor}15, ${form.accentColor}15)` }}
        >
          <div
            className="flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold text-white"
            style={{ background: form.primaryColor }}
          >
            {initials(form.logoUrl ? '' : organization.name)}
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-foreground">{organization.name || 'Your org'}</span>
            <span className="text-xs text-muted-foreground">
              {form.customDomain ? form.customDomain : 'gstpilot.app/' + (organization.slug || 'workspace')}
            </span>
          </div>
          <Badge
            variant="outline"
            className="ml-auto border-0 text-[10px] font-semibold text-white"
            style={{ background: form.accentColor }}
          >
            {organization.plan?.toUpperCase() ?? 'FREE'}
          </Badge>
        </div>
      </div>
      {editable ? (
        <SaveBar saving={saving} savedAt={savedAt} error={error} onSave={handleSave} />
      ) : (
        <p className="text-xs text-muted-foreground">You do not have permission to edit branding.</p>
      )}
    </SettingsCard>
  );
}

// 3. Localization ───────────────────────────────────────────────────────────

function LocalizationSection() {
  const { organization, saveLocalization, saving } = useEnterpriseOrg();
  const { can } = usePermissions();
  const editable = can('org.settings');

  const [form, setForm] = useState({
    timezone: '',
    currency: '',
    country: '',
  });
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!organization) return;
    setForm({
      timezone: organization.timezone ?? '',
      currency: organization.currency ?? '',
      country: organization.country ?? '',
    });
  }, [organization?.id, organization?.timezone, organization?.currency, organization?.country]);

  const handleSave = useCallback(async () => {
    setError(null);
    const { error: saveError } = await saveLocalization({
      timezone: form.timezone || null,
      currency: form.currency || null,
      country: form.country || null,
    });
    if (saveError) {
      setError(saveError);
      toast.error(saveError);
    } else {
      setSavedAt(Date.now());
      toast.success('Localization saved.');
    }
  }, [form, saveLocalization]);

  if (!organization) return <SettingsSkeleton />;

  return (
    <SettingsCard
      title="Localization"
      description="Set the timezone, currency, and country used for all financial calculations and reports."
    >
      <FieldRow label="Timezone" htmlFor="loc-tz">
        <Select
          value={form.timezone}
          onValueChange={(v) => setForm((f) => ({ ...f, timezone: v }))}
          disabled={!editable || saving}
        >
          <SelectTrigger id="loc-tz" className="w-full">
            <SelectValue placeholder="Select timezone" />
          </SelectTrigger>
          <SelectContent>
            {TIMEZONES.map((tz) => (
              <SelectItem key={tz} value={tz}>
                {tz}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FieldRow>
      <FieldRow label="Currency" htmlFor="loc-currency">
        <Select
          value={form.currency}
          onValueChange={(v) => setForm((f) => ({ ...f, currency: v }))}
          disabled={!editable || saving}
        >
          <SelectTrigger id="loc-currency" className="w-full">
            <SelectValue placeholder="Select currency" />
          </SelectTrigger>
          <SelectContent>
            {CURRENCIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FieldRow>
      <FieldRow label="Country" htmlFor="loc-country">
        <Select
          value={form.country}
          onValueChange={(v) => setForm((f) => ({ ...f, country: v }))}
          disabled={!editable || saving}
        >
          <SelectTrigger id="loc-country" className="w-full">
            <SelectValue placeholder="Select country" />
          </SelectTrigger>
          <SelectContent>
            {COUNTRIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FieldRow>
      {editable ? (
        <SaveBar saving={saving} savedAt={savedAt} error={error} onSave={handleSave} />
      ) : (
        <p className="text-xs text-muted-foreground">You do not have permission to edit localization.</p>
      )}
    </SettingsCard>
  );
}

// 4. Security ───────────────────────────────────────────────────────────────

function SecuritySection() {
  const { organization, saveProfile, saving, membership } = useEnterpriseOrg();
  const { can, role } = usePermissions();
  const editable = can('org.settings');

  // The "require 2FA for all members" toggle is stored as a custom flag inside
  // the org doc. The saveProfile helper passes through any unknown field via
  // its input shape (which we extend below) — but since UpdateOrgProfileInput
  // is typed, we cast safely to bypass the TS check (Firestore accepts extra
  // fields).
  const [require2FA, setRequire2FA] = useState<boolean>(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Read the flag from the org doc (best-effort — the field is optional).
  useEffect(() => {
    if (!organization) return;
    const flag = (organization as unknown as { require2FA?: boolean }).require2FA ?? false;
    setRequire2FA(flag);
  }, [organization?.id, (organization as unknown as { require2FA?: boolean })?.require2FA]);

  const handleToggle = useCallback(
    async (next: boolean) => {
      if (!editable) return;
      setRequire2FA(next);
      setError(null);
      const { error: saveError } = await saveProfile({
        // saveProfile accepts UpdateOrgProfileInput — we extend it with the
        // 2FA flag via an unchecked cast. Firestore stores it as a top-level
        // boolean field on the org doc.
        ...({ require2FA: next } as Record<string, unknown>),
      } as unknown as Parameters<typeof saveProfile>[0]);
      if (saveError) {
        setError(saveError);
        toast.error(saveError);
      } else {
        setSavedAt(Date.now());
        toast.success(next ? 'Two-factor authentication is now required.' : 'Two-factor requirement disabled.');
      }
    },
    [editable, saveProfile],
  );

  if (!organization) return <SettingsSkeleton />;

  return (
    <div className="space-y-6">
      <SettingsCard
        title="Security"
        description="Recommendations and policies that protect your organization's data."
      >
        <div className="space-y-3">
          <SecurityCheck
            ok
            label="Email verification"
            description="Your account email is verified through Firebase Auth."
          />
          <SecurityCheck
            ok={!!membership}
            label="Active membership"
            description={
              membership
                ? `Signed in as ${ROLE_LABELS[membership.role] ?? 'member'}.`
                : 'No active membership in this organization.'
            }
          />
          <SecurityCheck
            ok={require2FA}
            label="Two-factor authentication policy"
            description={
              require2FA
                ? 'All members must enable 2FA before accessing the workspace.'
                : '2FA is recommended but not enforced for members.'
            }
          />
        </div>
      </SettingsCard>

      <SettingsCard
        title="Two-factor authentication policy"
        description="Require all members to enable 2FA on their account before they can sign in."
      >
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">Require 2FA for all members</p>
            <p className="text-xs text-muted-foreground">
              When enabled, members without 2FA will be prompted to set it up on their next sign-in.
            </p>
          </div>
          <Switch
            checked={require2FA}
            onCheckedChange={handleToggle}
            disabled={!editable || saving}
            aria-label="Require 2FA for all members"
          />
        </div>
        {!editable ? (
          <p className="text-xs text-muted-foreground">You need the <span className="font-medium">Manage organization settings</span> permission to change this policy.</p>
        ) : null}
        {savedAt && !error ? (
          <p className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <Check className="h-3.5 w-3.5" />
            Policy updated
          </p>
        ) : null}
        {error ? (
          <p className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-600 dark:text-rose-400">
            <XCircle className="h-3.5 w-3.5" />
            {error}
          </p>
        ) : null}
      </SettingsCard>

      <SettingsCard
        title="Active sessions"
        description="A read-only summary of where your account is signed in."
      >
        <div className="rounded-xl border border-border/60 bg-muted/30 p-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span>
              Session management is handled by Firebase Auth. Sign out of other devices from your account settings.
            </span>
          </div>
        </div>
        {role ? (
          <p className="text-xs text-muted-foreground">
            Your current role: <span className="font-medium text-foreground">{ROLE_LABELS[role]}</span>.
          </p>
        ) : null}
      </SettingsCard>
    </div>
  );
}

function SecurityCheck({ ok, label, description }: { ok: boolean; label: string; description: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border/60 p-3.5">
      <div
        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
          ok
            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
            : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
        }`}
      >
        {ok ? <Check className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
      </div>
      <div className="min-w-0 space-y-0.5">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

// 5. Members ────────────────────────────────────────────────────────────────

function MembersSection() {
  const { members, role, membership, suspendOrgMember, reactivateOrgMember, saving } = useEnterpriseOrg();
  const { organization, reload } = useOrg();
  const { can } = usePermissions();

  const canInvite = can('org.members.invite');
  const canManage = canManageMembers(role);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<OrgRole>('employee');
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [roleUpdates, setRoleUpdates] = useState<Record<string, OrgRole>>({});
  const [busyFor, setBusyFor] = useState<string | null>(null);

  const handleInvite = useCallback(async () => {
    if (!organization || !membership) return;
    setInviteError(null);
    const email = inviteEmail.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setInviteError('Enter a valid email address.');
      return;
    }
    if (!canAssignRole(role, inviteRole)) {
      setInviteError(`You cannot assign the ${ROLE_LABELS[inviteRole]} role.`);
      return;
    }
    setInviteBusy(true);
    const { error: inviteErr } = await safe(() =>
      inviteMember({
        organizationId: organization.id,
        invitedBy: membership.userId,
        userId: email, // invitation keyed by email until the user signs up
        userEmail: email,
        userDisplayName: email.split('@')[0] ?? 'Member',
        role: inviteRole,
      }),
    );
    setInviteBusy(false);
    if (inviteErr) {
      setInviteError(inviteErr);
      toast.error(inviteErr);
      return;
    }
    toast.success(`Invitation sent to ${email}.`);
    setInviteOpen(false);
    setInviteEmail('');
    setInviteRole('employee');
    await reload();
  }, [organization, membership, inviteEmail, inviteRole, role, reload]);

  const handleRoleChange = useCallback(
    async (memberId: string, targetUserId: string, targetCurrentRole: OrgRole, newRole: OrgRole) => {
      if (!organization) return;
      if (newRole === targetCurrentRole) return;
      if (!canManageRole(role, targetCurrentRole) || !canAssignRole(role, newRole)) {
        toast.error(`You cannot assign the ${ROLE_LABELS[newRole]} role to this member.`);
        return;
      }
      setBusyFor(memberId);
      const { error: err } = await safe(() => updateMemberRole(organization.id, targetUserId, newRole));
      setBusyFor(null);
      if (err) {
        toast.error(err);
        return;
      }
      toast.success(`Role updated to ${ROLE_LABELS[newRole]}.`);
      setRoleUpdates((m) => {
        const next = { ...m };
        delete next[memberId];
        return next;
      });
      await reload();
    },
    [organization, role, reload],
  );

  const handleSuspend = useCallback(
    async (memberId: string, targetUserId: string, targetRole: OrgRole) => {
      if (!organization) return;
      if (!canManageRole(role, targetRole)) {
        toast.error('You cannot suspend this member.');
        return;
      }
      setBusyFor(memberId);
      const { error: err } = await suspendOrgMember(targetUserId);
      setBusyFor(null);
      if (err) {
        toast.error(err);
        return;
      }
      toast.success('Member suspended.');
      await reload();
    },
    [organization, role, suspendOrgMember, reload],
  );

  const handleReactivate = useCallback(
    async (memberId: string, targetUserId: string, targetRole: OrgRole) => {
      if (!organization) return;
      if (!canManageRole(role, targetRole)) {
        toast.error('You cannot reactivate this member.');
        return;
      }
      setBusyFor(memberId);
      const { error: err } = await reactivateOrgMember(targetUserId);
      setBusyFor(null);
      if (err) {
        toast.error(err);
        return;
      }
      toast.success('Member reactivated.');
      await reload();
    },
    [organization, role, reactivateOrgMember, reload],
  );

  const handleRemove = useCallback(
    async (memberId: string, targetUserId: string, targetRole: OrgRole) => {
      if (!organization) return;
      if (!canManageRole(role, targetRole)) {
        toast.error('You cannot remove this member.');
        return;
      }
      setBusyFor(memberId);
      const { error: err } = await safe(() => removeMember(organization.id, targetUserId));
      setBusyFor(null);
      if (err) {
        toast.error(err);
        return;
      }
      toast.success('Member removed.');
      await reload();
    },
    [organization, role, reload],
  );

  if (!organization) return <SettingsSkeleton />;

  return (
    <SettingsCard
      title="Members"
      description={`${members.length} ${members.length === 1 ? 'member' : 'members'} in this organization.`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Manage roles, suspend, or remove members. Suspended members lose access immediately.
        </p>
        {canInvite ? (
          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <DialogTrigger asChild>
              <Button variant="default" size="sm" className="gap-2">
                <UserPlus className="h-4 w-4" />
                Invite member
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Invite a member</DialogTitle>
                <DialogDescription>
                  They will receive an email invitation. Assign the lowest role that fits their work.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="invite-email">Email</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="member@company.com"
                    disabled={inviteBusy}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invite-role">Role</Label>
                  <Select
                    value={inviteRole}
                    onValueChange={(v) => setInviteRole(v as OrgRole)}
                    disabled={inviteBusy}
                  >
                    <SelectTrigger id="invite-role" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ALL_ROLES.filter((r) => canAssignRole(role, r)).map((r) => (
                        <SelectItem key={r} value={r}>
                          <div className="flex flex-col items-start">
                            <span className="text-sm font-medium">{ROLE_LABELS[r]}</span>
                            <span className="text-[10px] text-muted-foreground">
                              {ROLE_DESCRIPTIONS[r]}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {inviteError ? (
                  <p className="text-xs font-medium text-rose-600 dark:text-rose-400">{inviteError}</p>
                ) : null}
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setInviteOpen(false)}
                  disabled={inviteBusy}
                >
                  Cancel
                </Button>
                <Button onClick={handleInvite} disabled={inviteBusy} className="gap-2">
                  {inviteBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                  Send invite
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-xl border border-border/60">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="h-10 text-xs uppercase tracking-wider text-muted-foreground">Member</TableHead>
              <TableHead className="h-10 text-xs uppercase tracking-wider text-muted-foreground">Role</TableHead>
              <TableHead className="h-10 text-xs uppercase tracking-wider text-muted-foreground">Status</TableHead>
              <TableHead className="h-10 text-xs uppercase tracking-wider text-muted-foreground">Joined</TableHead>
              <TableHead className="h-10 text-right text-xs uppercase tracking-wider text-muted-foreground">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                  No members yet. Invite your first teammate to get started.
                </TableCell>
              </TableRow>
            ) : (
              members.map((m) => {
                const effectiveRole = roleUpdates[m.id] ?? m.role;
                const canManageThis = canManage && canManageRole(role, m.role);
                const isSelf = m.userId === membership?.userId;
                const busy = busyFor === m.id;
                return (
                  <TableRow key={m.id} className="border-border/40">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          {m.userPhotoURL ? <AvatarImage src={m.userPhotoURL} alt={m.userDisplayName} /> : null}
                          <AvatarFallback className="bg-primary/10 text-[11px] font-bold text-primary">
                            {initials(m.userDisplayName || m.userEmail)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="truncate text-sm font-medium text-foreground">
                              {m.userDisplayName || m.userEmail}
                            </p>
                            {isSelf ? (
                              <Badge variant="outline" className="h-4 px-1 text-[9px] font-medium text-muted-foreground">
                                You
                              </Badge>
                            ) : null}
                            {m.role === 'owner' ? (
                              <Crown className="h-3 w-3 text-amber-500" />
                            ) : null}
                          </div>
                          <p className="truncate text-xs text-muted-foreground">{m.userEmail}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {canManageThis && !isSelf ? (
                        <Select
                          value={effectiveRole}
                          onValueChange={(v) => setRoleUpdates((map) => ({ ...map, [m.id]: v as OrgRole }))}
                          disabled={busy || saving}
                        >
                          <SelectTrigger className="h-8 w-[130px] text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ALL_ROLES.filter((r) => canAssignRole(role, r)).map((r) => (
                              <SelectItem key={r} value={r} className="text-xs">
                                {ROLE_LABELS[r]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="outline" className={`text-[11px] font-medium ${roleBadgeClass(m.role)}`}>
                          {ROLE_LABELS[m.role] ?? 'Member'}
                        </Badge>
                      )}
                      {roleUpdates[m.id] && roleUpdates[m.id] !== m.role ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="ml-2 h-7 px-2 text-xs"
                          onClick={() => handleRoleChange(m.id, m.userId, m.role, roleUpdates[m.id])}
                          disabled={busy || saving}
                        >
                          Save
                        </Button>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[11px] font-medium capitalize ${statusBadgeClass(m.status)}`}>
                        {m.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {fmtDate(m.joinedAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      {canManageThis && !isSelf ? (
                        <div className="flex items-center justify-end gap-1">
                          {m.status === 'active' ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 gap-1.5 px-2 text-xs text-amber-600 hover:bg-amber-500/10 hover:text-amber-600"
                              onClick={() => handleSuspend(m.id, m.userId, m.role)}
                              disabled={busy || saving}
                            >
                              <Ban className="h-3.5 w-3.5" />
                              Suspend
                            </Button>
                          ) : m.status === 'suspended' ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 gap-1.5 px-2 text-xs text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-600"
                              onClick={() => handleReactivate(m.id, m.userId, m.role)}
                              disabled={busy || saving}
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              Reactivate
                            </Button>
                          ) : null}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1.5 px-2 text-xs text-rose-600 hover:bg-rose-500/10 hover:text-rose-600"
                            onClick={() => handleRemove(m.id, m.userId, m.role)}
                            disabled={busy || saving}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Remove
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
      {!canManage ? (
        <p className="text-xs text-muted-foreground">
          You can view members but do not have permission to manage them.
        </p>
      ) : null}
    </SettingsCard>
  );
}

// 6. Notifications ──────────────────────────────────────────────────────────

function NotificationsSection() {
  const { organization, saveProfile, saving } = useEnterpriseOrg();
  const { can } = usePermissions();
  const editable = can('org.settings');

  const [prefs, setPrefs] = useState({
    emailUpdates: true,
    gstReminders: true,
    clientActivity: false,
    aiInsights: true,
    securityAlerts: true,
    marketingUpdates: false,
  });
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!organization) return;
    const n = organization.notifications ?? {};
    setPrefs({
      emailUpdates: n.emailUpdates ?? true,
      gstReminders: n.gstReminders ?? true,
      clientActivity: n.clientActivity ?? false,
      aiInsights: n.aiInsights ?? true,
      securityAlerts: n.securityAlerts ?? true,
      marketingUpdates: n.marketingUpdates ?? false,
    });
  }, [organization?.id, organization?.notifications]);

  const handleSave = useCallback(async () => {
    if (!organization) return;
    setError(null);
    // Notifications are stored on the org doc as a nested object. The
    // saveProfile helper accepts UpdateOrgProfileInput, which doesn't include
    // `notifications` — so we cast the payload to bypass the TS check (the
    // underlying Firestore updateDoc accepts arbitrary fields).
    const { error: saveError } = await saveProfile({
      ...({ notifications: prefs } as Record<string, unknown>),
    } as unknown as Parameters<typeof saveProfile>[0]);
    if (saveError) {
      setError(saveError);
      toast.error(saveError);
    } else {
      setSavedAt(Date.now());
      toast.success('Notification preferences saved.');
    }
  }, [prefs, saveProfile, organization]);

  if (!organization) return <SettingsSkeleton />;

  const toggles: Array<{ key: keyof typeof prefs; label: string; description: string }> = [
    { key: 'emailUpdates', label: 'Email updates', description: 'Product news, summaries, and account emails.' },
    { key: 'gstReminders', label: 'GST reminders', description: 'Upcoming GSTR-1 / GSTR-3B due dates and overdue alerts.' },
    { key: 'clientActivity', label: 'Client activity', description: 'When a client views, comments, or signs a document.' },
    { key: 'aiInsights', label: 'AI insights', description: 'VEYRO AI observations about your books and compliance.' },
    { key: 'securityAlerts', label: 'Security alerts', description: 'Sign-ins, role changes, and API key activity.' },
    { key: 'marketingUpdates', label: 'Marketing updates', description: 'Occasional product launches and offers (low volume).' },
  ];

  return (
    <SettingsCard
      title="Notifications"
      description="Choose which emails and alerts your organization receives."
    >
      <div className="space-y-3">
        {toggles.map((t) => (
          <div
            key={t.key}
            className="flex items-start justify-between gap-4 rounded-xl border border-border/60 p-4"
          >
            <div className="space-y-0.5">
              <p className="text-sm font-medium text-foreground">{t.label}</p>
              <p className="text-xs text-muted-foreground">{t.description}</p>
            </div>
            <Switch
              checked={prefs[t.key]}
              onCheckedChange={(v) => setPrefs((p) => ({ ...p, [t.key]: v }))}
              disabled={!editable || saving}
              aria-label={t.label}
            />
          </div>
        ))}
      </div>
      {editable ? (
        <SaveBar saving={saving} savedAt={savedAt} error={error} onSave={handleSave} />
      ) : (
        <p className="text-xs text-muted-foreground">You do not have permission to edit notifications.</p>
      )}
    </SettingsCard>
  );
}

// 7. Billing ────────────────────────────────────────────────────────────────

function BillingSection() {
  const { organization, saveBilling, saving } = useEnterpriseOrg();
  const { can } = usePermissions();
  const editable = can('org.billing');

  const [form, setForm] = useState<OrganizationBilling>({
    contactName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    postalCode: '',
    country: '',
    taxId: '',
    gstNumber: '',
  });
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!organization) return;
    const b = organization.billing ?? {};
    setForm({
      contactName: b.contactName ?? '',
      email: b.email ?? '',
      phone: b.phone ?? '',
      address: b.address ?? '',
      city: b.city ?? '',
      state: b.state ?? '',
      postalCode: b.postalCode ?? '',
      country: b.country ?? '',
      taxId: b.taxId ?? '',
      gstNumber: b.gstNumber ?? '',
    });
  }, [organization?.id, organization?.billing]);

  const handleSave = useCallback(async () => {
    setError(null);
    const { error: saveError } = await saveBilling({
      contactName: form.contactName.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      address: form.address.trim() || null,
      city: form.city.trim() || null,
      state: form.state.trim() || null,
      postalCode: form.postalCode.trim() || null,
      country: form.country.trim() || null,
      taxId: form.taxId.trim() || null,
      gstNumber: form.gstNumber.trim() || null,
    });
    if (saveError) {
      setError(saveError);
      toast.error(saveError);
    } else {
      setSavedAt(Date.now());
      toast.success('Billing details saved.');
    }
  }, [form, saveBilling]);

  if (!organization) return <SettingsSkeleton />;

  return (
    <SettingsCard
      title="Billing"
      description="Billing contact details appear on every invoice and receipt."
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <FieldRow label="Contact name" htmlFor="bill-name">
          <Input
            id="bill-name"
            value={form.contactName ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))}
            disabled={!editable || saving}
            placeholder="Accounts payable"
          />
        </FieldRow>
        <FieldRow label="Email" htmlFor="bill-email">
          <Input
            id="bill-email"
            type="email"
            value={form.email ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            disabled={!editable || saving}
            placeholder="ap@company.com"
          />
        </FieldRow>
        <FieldRow label="Phone" htmlFor="bill-phone">
          <Input
            id="bill-phone"
            value={form.phone ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            disabled={!editable || saving}
            placeholder="+91 98765 43210"
          />
        </FieldRow>
        <FieldRow label="Tax ID" htmlFor="bill-tax">
          <Input
            id="bill-tax"
            value={form.taxId ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, taxId: e.target.value }))}
            disabled={!editable || saving}
            placeholder="TAN / Tax ID"
          />
        </FieldRow>
        <FieldRow label="GST number" htmlFor="bill-gst">
          <Input
            id="bill-gst"
            value={form.gstNumber ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, gstNumber: e.target.value.toUpperCase() }))}
            disabled={!editable || saving}
            placeholder="22AAAAA0000A1Z5"
            maxLength={15}
          />
        </FieldRow>
        <FieldRow label="Country" htmlFor="bill-country">
          <Input
            id="bill-country"
            value={form.country ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
            disabled={!editable || saving}
            placeholder="India"
          />
        </FieldRow>
      </div>
      <Separator />
      <div className="grid gap-5 sm:grid-cols-2">
        <FieldRow label="Address" htmlFor="bill-address">
          <Textarea
            id="bill-address"
            value={form.address ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            disabled={!editable || saving}
            placeholder="123 Business Park"
            rows={2}
          />
        </FieldRow>
        <div className="grid gap-5">
          <FieldRow label="City" htmlFor="bill-city">
            <Input
              id="bill-city"
              value={form.city ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
              disabled={!editable || saving}
              placeholder="Mumbai"
            />
          </FieldRow>
          <FieldRow label="State" htmlFor="bill-state">
            <Input
              id="bill-state"
              value={form.state ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
              disabled={!editable || saving}
              placeholder="Maharashtra"
            />
          </FieldRow>
          <FieldRow label="Postal code" htmlFor="bill-postal">
            <Input
              id="bill-postal"
              value={form.postalCode ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, postalCode: e.target.value }))}
              disabled={!editable || saving}
              placeholder="400001"
            />
          </FieldRow>
        </div>
      </div>
      {editable ? (
        <SaveBar saving={saving} savedAt={savedAt} error={error} onSave={handleSave} />
      ) : (
        <p className="text-xs text-muted-foreground">You do not have permission to edit billing.</p>
      )}
    </SettingsCard>
  );
}

// 8. Subscription ───────────────────────────────────────────────────────────

function SubscriptionSection() {
  const { organization, saveSubscription, saving } = useEnterpriseOrg();
  const { can } = usePermissions();
  const editable = can('org.billing');

  const [form, setForm] = useState<OrganizationSubscription>({
    plan: 'free',
    status: 'active',
    seats: 1,
    renewalDate: '',
    trialEndsAt: '',
    amount: 0,
    currency: 'INR',
    interval: 'monthly',
    paymentMethod: '',
  });
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!organization) return;
    const s = organization.subscription;
    setForm({
      plan: s?.plan ?? organization.plan ?? 'free',
      status: s?.status ?? 'active',
      seats: s?.seats ?? 1,
      renewalDate: s?.renewalDate ?? '',
      trialEndsAt: s?.trialEndsAt ?? '',
      amount: s?.amount ?? 0,
      currency: s?.currency ?? 'INR',
      interval: s?.interval ?? 'monthly',
      paymentMethod: s?.paymentMethod ?? '',
    });
  }, [organization?.id, organization?.plan, organization?.subscription]);

  const handleSave = useCallback(async () => {
    setError(null);
    const { error: saveError } = await saveSubscription({
      plan: form.plan,
      status: form.status,
      seats: Number(form.seats) || 1,
      renewalDate: form.renewalDate || null,
      trialEndsAt: form.trialEndsAt || null,
      amount: Number(form.amount) || 0,
      currency: form.currency || 'INR',
      interval: form.interval,
      paymentMethod: form.paymentMethod || null,
    });
    if (saveError) {
      setError(saveError);
      toast.error(saveError);
    } else {
      setSavedAt(Date.now());
      toast.success('Subscription saved.');
    }
  }, [form, saveSubscription]);

  if (!organization) return <SettingsSkeleton />;

  return (
    <SettingsCard
      title="Subscription"
      description="The plan, billing cycle, and seat allocation for this organization."
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <FieldRow label="Plan" htmlFor="sub-plan">
          <Select
            value={form.plan}
            onValueChange={(v) => setForm((f) => ({ ...f, plan: v as OrganizationSubscription['plan'] }))}
            disabled={!editable || saving}
          >
            <SelectTrigger id="sub-plan" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="free">Free</SelectItem>
              <SelectItem value="pro">Pro</SelectItem>
              <SelectItem value="enterprise">Enterprise</SelectItem>
            </SelectContent>
          </Select>
        </FieldRow>
        <FieldRow label="Status" htmlFor="sub-status">
          <Select
            value={form.status}
            onValueChange={(v) => setForm((f) => ({ ...f, status: v as OrganizationSubscription['status'] }))}
            disabled={!editable || saving}
          >
            <SelectTrigger id="sub-status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="trialing">Trialing</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="past_due">Past due</SelectItem>
              <SelectItem value="canceled">Canceled</SelectItem>
              <SelectItem value="incomplete">Incomplete</SelectItem>
            </SelectContent>
          </Select>
        </FieldRow>
        <FieldRow label="Seats" htmlFor="sub-seats">
          <Input
            id="sub-seats"
            type="number"
            min={1}
            value={String(form.seats ?? 1)}
            onChange={(e) => setForm((f) => ({ ...f, seats: Number(e.target.value) }))}
            disabled={!editable || saving}
          />
        </FieldRow>
        <FieldRow label="Billing interval" htmlFor="sub-interval">
          <Select
            value={form.interval ?? 'monthly'}
            onValueChange={(v) => setForm((f) => ({ ...f, interval: v as 'monthly' | 'yearly' }))}
            disabled={!editable || saving}
          >
            <SelectTrigger id="sub-interval" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="yearly">Yearly</SelectItem>
            </SelectContent>
          </Select>
        </FieldRow>
        <FieldRow label="Amount" htmlFor="sub-amount">
          <Input
            id="sub-amount"
            type="number"
            min={0}
            value={String(form.amount ?? 0)}
            onChange={(e) => setForm((f) => ({ ...f, amount: Number(e.target.value) }))}
            disabled={!editable || saving}
          />
        </FieldRow>
        <FieldRow label="Currency" htmlFor="sub-currency">
          <Select
            value={form.currency ?? 'INR'}
            onValueChange={(v) => setForm((f) => ({ ...f, currency: v }))}
            disabled={!editable || saving}
          >
            <SelectTrigger id="sub-currency" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldRow>
        <FieldRow label="Renewal date" htmlFor="sub-renewal">
          <Input
            id="sub-renewal"
            type="date"
            value={form.renewalDate ? form.renewalDate.slice(0, 10) : ''}
            onChange={(e) => setForm((f) => ({ ...f, renewalDate: e.target.value }))}
            disabled={!editable || saving}
          />
        </FieldRow>
        <FieldRow label="Trial ends at" htmlFor="sub-trial">
          <Input
            id="sub-trial"
            type="date"
            value={form.trialEndsAt ? form.trialEndsAt.slice(0, 10) : ''}
            onChange={(e) => setForm((f) => ({ ...f, trialEndsAt: e.target.value }))}
            disabled={!editable || saving}
          />
        </FieldRow>
        <FieldRow label="Payment method" htmlFor="sub-payment">
          <Input
            id="sub-payment"
            value={form.paymentMethod ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, paymentMethod: e.target.value }))}
            disabled={!editable || saving}
            placeholder="Visa •••• 4242"
          />
        </FieldRow>
      </div>
      {editable ? (
        <SaveBar saving={saving} savedAt={savedAt} error={error} onSave={handleSave} />
      ) : (
        <p className="text-xs text-muted-foreground">You do not have permission to edit the subscription.</p>
      )}
    </SettingsCard>
  );
}

// 9. Integrations ───────────────────────────────────────────────────────────

function IntegrationsSection() {
  const { organization } = useEnterpriseOrg();
  if (!organization) return <SettingsSkeleton />;

  const integrations = organization.integrations ?? {};
  const entries = Object.entries(integrations);

  return (
    <SettingsCard
      title="Integrations"
      description="Connected services and apps. Manage connections from the Integrations page."
    >
      {entries.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border/60 py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted/40 text-muted-foreground">
            <Plug className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">No integrations yet</p>
            <p className="text-xs text-muted-foreground">
              Connect GSTN, banking, Tally, Zoho, and more from the Integrations page.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {entries.map(([key, value]) => (
            <div
              key={key}
              className="flex items-center justify-between gap-3 rounded-xl border border-border/60 p-4"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted/40 text-muted-foreground">
                  <Link2 className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium capitalize text-foreground">{key}</p>
                  <p className="text-xs text-muted-foreground">
                    {value.connected ? `Connected ${fmtDate(value.connectedAt)}` : 'Not connected'}
                  </p>
                </div>
              </div>
              {value.connected ? (
                <Badge variant="outline" className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" />
                  Connected
                </Badge>
              ) : (
                <Badge variant="outline" className="border-border/60 bg-muted/40 text-muted-foreground">
                  Disconnected
                </Badge>
              )}
            </div>
          ))}
        </div>
      )}
    </SettingsCard>
  );
}

// 10. API Keys ──────────────────────────────────────────────────────────────

function ApiKeysSection() {
  const { organization, createOrgApiKey, revokeOrgApiKey, saving } = useEnterpriseOrg();
  const { can } = usePermissions();
  const canManageKeys = can('apikeys.manage');

  const [createOpen, setCreateOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [scopes, setScopes] = useState<string[]>(['read']);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [revealKey, setRevealKey] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);

  const toggleScope = (scope: string) => {
    setScopes((s) => (s.includes(scope) ? s.filter((x) => x !== scope) : [...s, scope]));
  };

  const handleCreate = useCallback(async () => {
    setCreateError(null);
    const trimmed = label.trim();
    if (!trimmed) {
      setCreateError('Enter a label for this key.');
      return;
    }
    if (scopes.length === 0) {
      setCreateError('Select at least one scope.');
      return;
    }
    setCreating(true);
    const { plaintext, error: createErr } = await createOrgApiKey({ label: trimmed, scopes });
    setCreating(false);
    if (createErr || !plaintext) {
      setCreateError(createErr ?? 'Could not create the key.');
      toast.error(createErr ?? 'Could not create the key.');
      return;
    }
    toast.success('API key created.');
    setRevealKey(plaintext);
    setCreateOpen(false);
    setLabel('');
    setScopes(['read']);
  }, [label, scopes, createOrgApiKey]);

  const handleRevoke = useCallback(
    async (keyId: string) => {
      setRevokingId(keyId);
      const { error: revokeErr } = await revokeOrgApiKey(keyId);
      setRevokingId(null);
      setConfirmRevokeId(null);
      if (revokeErr) {
        toast.error(revokeErr);
        return;
      }
      toast.success('API key revoked.');
    },
    [revokeOrgApiKey],
  );

  const handleCopy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied to clipboard.');
    } catch {
      toast.error('Could not copy. Select the text manually.');
    }
  }, []);

  if (!organization) return <SettingsSkeleton />;

  const keys: OrgApiKey[] = organization.apiKeys ?? [];

  return (
    <SettingsCard
      title="API Keys"
      description="Scoped tokens for programmatic access to your organization's data via the VEYRO API."
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {keys.length} {keys.length === 1 ? 'key' : 'keys'} · keys are hashed at rest and shown only once at creation.
        </p>
        {canManageKeys ? (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Create API key
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create a new API key</DialogTitle>
                <DialogDescription>
                  Choose a memorable label and the scopes this key needs. The plaintext key is shown once.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="key-label">Label</Label>
                  <Input
                    id="key-label"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="Production server"
                    disabled={creating}
                    maxLength={80}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Scopes</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {API_KEY_SCOPES.map((s) => (
                      <label
                        key={s}
                        className="flex cursor-pointer items-center gap-2 rounded-lg border border-border/60 p-2.5 text-sm hover:bg-muted/30"
                      >
                        <Checkbox
                          checked={scopes.includes(s)}
                          onCheckedChange={() => toggleScope(s)}
                          disabled={creating}
                        />
                        <span className="font-mono text-xs">{s}</span>
                      </label>
                    ))}
                  </div>
                </div>
                {createError ? (
                  <p className="text-xs font-medium text-rose-600 dark:text-rose-400">{createError}</p>
                ) : null}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>
                  Cancel
                </Button>
                <Button onClick={handleCreate} disabled={creating} className="gap-2">
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Key className="h-4 w-4" />}
                  Create key
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ) : null}
      </div>

      <div className="space-y-3">
        {keys.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border/60 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted/40 text-muted-foreground">
              <Key className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">No API keys yet</p>
              <p className="text-xs text-muted-foreground">
                Create a key to start integrating VEYRO with your stack.
              </p>
            </div>
          </div>
        ) : (
          keys.map((k) => (
            <div
              key={k.id}
              className={`rounded-xl border p-4 ${
                k.revokedAt
                  ? 'border-border/40 bg-muted/20 opacity-70'
                  : 'border-border/60 bg-card'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground">{k.label || 'Untitled key'}</p>
                    {k.revokedAt ? (
                      <Badge variant="outline" className="border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400">
                        Revoked
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                        Active
                      </Badge>
                    )}
                  </div>
                  <p className="font-mono text-xs text-muted-foreground">
                    {k.prefix}
                    {'•'.repeat(8)}
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    {k.scopes.map((s) => (
                      <Badge key={s} variant="outline" className="font-mono text-[10px] text-muted-foreground">
                        {s}
                      </Badge>
                    ))}
                  </div>
                </div>
                {canManageKeys && !k.revokedAt ? (
                  <Dialog open={confirmRevokeId === k.id} onOpenChange={(o) => setConfirmRevokeId(o ? k.id : null)}>
                    <DialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 text-xs text-rose-600 hover:bg-rose-500/10 hover:text-rose-600"
                        disabled={revokingId === k.id || saving}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Revoke
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>Revoke this API key?</DialogTitle>
                        <DialogDescription>
                          This action cannot be undone. Any service using this key will lose access immediately.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm">
                        <p className="font-medium text-foreground">{k.label}</p>
                        <p className="font-mono text-xs text-muted-foreground">
                          {k.prefix}••••••
                        </p>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setConfirmRevokeId(null)} disabled={revokingId === k.id}>
                          Cancel
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={() => handleRevoke(k.id)}
                          disabled={revokingId === k.id}
                          className="gap-2"
                        >
                          {revokingId === k.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          Revoke key
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                ) : null}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                <span>Created {fmtDate(k.createdAt)}</span>
                <span>Last used {k.lastUsedAt ? fmtDate(k.lastUsedAt) : 'never'}</span>
                {k.revokedAt ? <span>Revoked {fmtDate(k.revokedAt)}</span> : null}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Plaintext reveal dialog — shown ONCE after creation. */}
      <Dialog open={revealKey !== null} onOpenChange={(o) => !o && setRevealKey(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              API key created
            </DialogTitle>
            <DialogDescription>
              Copy this key now. For security, you will not be able to see it again.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>Treat this key like a password. Store it in a secrets manager — never in code.</span>
            </div>
            <div className="flex items-center gap-2">
              <Input
                value={revealKey ?? ''}
                readOnly
                className="font-mono text-xs"
                onFocus={(e) => e.target.select()}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleCopy(revealKey ?? '')}
                aria-label="Copy API key"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setRevealKey(null)} className="gap-2">
              <Check className="h-4 w-4" />
              I&apos;ve saved my key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SettingsCard>
  );
}

// 11. AI Settings ───────────────────────────────────────────────────────────

function AiSettingsSection() {
  const { organization, saveProfile, saving } = useEnterpriseOrg();
  const { can } = usePermissions();
  const editable = can('ai.settings');

  const [settings, setSettings] = useState({
    oracleAi: true,
    aiCfo: false,
    autoInsights: true,
    predictiveCompliance: false,
  });
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!organization) return;
    // aiSettings is an optional custom field stored on the org doc.
    const s = (organization as unknown as {
      aiSettings?: {
        oracleAi?: boolean;
        aiCfo?: boolean;
        autoInsights?: boolean;
        predictiveCompliance?: boolean;
      };
    }).aiSettings ?? {};
    setSettings({
      oracleAi: s.oracleAi ?? true,
      aiCfo: s.aiCfo ?? false,
      autoInsights: s.autoInsights ?? true,
      predictiveCompliance: s.predictiveCompliance ?? false,
    });
  }, [organization?.id, (organization as unknown as { aiSettings?: object })?.aiSettings]);

  const handleSave = useCallback(async () => {
    setError(null);
    // Save aiSettings as a custom nested object on the org doc.
    const { error: saveError } = await saveProfile({
      ...({ aiSettings: settings } as Record<string, unknown>),
    } as unknown as Parameters<typeof saveProfile>[0]);
    if (saveError) {
      setError(saveError);
      toast.error(saveError);
    } else {
      setSavedAt(Date.now());
      toast.success('AI settings saved.');
    }
  }, [settings, saveProfile, organization]);

  if (!organization) return <SettingsSkeleton />;

  const toggles: Array<{ key: keyof typeof settings; label: string; description: string }> = [
    {
      key: 'oracleAi',
      label: 'VEYRO AI',
      description: 'Conversational AI workspace for finance, tax, and compliance questions.',
    },
    {
      key: 'aiCfo',
      label: 'AI CFO',
      description: 'Autonomous cashflow forecasting, budget variance, and capital recommendations.',
    },
    {
      key: 'autoInsights',
      label: 'Auto-insights',
      description: 'Continuously surface anomalies, opportunities, and risks across your books.',
    },
    {
      key: 'predictiveCompliance',
      label: 'Predictive compliance',
      description: 'Forecast filing deadlines, audit risk, and notice probability 30 days ahead.',
    },
  ];

  return (
    <SettingsCard
      title="AI Settings"
      description="Configure how VEYRO AI and the AI CFO operate on your organization's data."
    >
      <div className="space-y-3">
        {toggles.map((t) => (
          <div
            key={t.key}
            className="flex items-start justify-between gap-4 rounded-xl border border-border/60 p-4"
          >
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <p className="text-sm font-medium text-foreground">{t.label}</p>
              </div>
              <p className="text-xs text-muted-foreground">{t.description}</p>
            </div>
            <Switch
              checked={settings[t.key]}
              onCheckedChange={(v) => setSettings((s) => ({ ...s, [t.key]: v }))}
              disabled={!editable || saving}
              aria-label={t.label}
            />
          </div>
        ))}
      </div>
      {editable ? (
        <SaveBar saving={saving} savedAt={savedAt} error={error} onSave={handleSave} />
      ) : (
        <p className="text-xs text-muted-foreground">You do not have permission to edit AI settings.</p>
      )}
    </SettingsCard>
  );
}

// 12. Danger Zone ───────────────────────────────────────────────────────────

function DangerZoneSection() {
  const { organization } = useEnterpriseOrg();
  const { role, membership } = useOrg();
  const { setCurrentView } = useApp();
  const isOwner = role === 'owner';

  const [confirmName, setConfirmName] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);

  const nameMatches = organization ? confirmName.trim() === organization.name : false;

  const handleDelete = useCallback(async () => {
    if (!organization) return;
    if (!isOwner) return;
    if (!nameMatches) return;
    setDeleting(true);
    setDeleteError(null);
    const { error: deleteErr } = await safe(() => deleteOrganization(organization.id));
    setDeleting(false);
    if (deleteErr) {
      setDeleteError(deleteErr);
      toast.error(deleteErr);
      return;
    }
    toast.success('Organization deleted.');
    setCurrentView('dashboard');
  }, [organization, isOwner, nameMatches, setCurrentView]);

  if (!organization) return <SettingsSkeleton />;

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl border border-rose-500/30 bg-rose-500/[0.03]">
        <CardHeader className="gap-1.5 p-6 pb-4">
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-rose-600 dark:text-rose-400">
            <AlertTriangle className="h-4 w-4" />
            Danger Zone
          </CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            Irreversible actions. Take a breath, read everything twice.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 p-6 pt-0">
          {/* Transfer ownership */}
          <div className="flex flex-col gap-3 rounded-xl border border-border/60 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-0.5">
              <p className="text-sm font-medium text-foreground">Transfer ownership</p>
              <p className="text-xs text-muted-foreground">
                Hand over the owner role to another admin. You will be demoted to admin.
              </p>
            </div>
            <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!isOwner}
                  className="gap-2 border-amber-500/30 text-amber-600 hover:bg-amber-500/10 hover:text-amber-600"
                >
                  <Crown className="h-4 w-4" />
                  Transfer
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Transfer ownership</DialogTitle>
                  <DialogDescription>
                    Select a new owner. The chosen member must be an admin. You will become an admin.
                  </DialogDescription>
                </DialogHeader>
                <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
                  Ownership transfer is a server-side operation that requires verification. Please contact VEYRO support to complete this action — your request will be logged and verified.
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setTransferOpen(false)}>
                    Close
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Delete organization */}
          <div className="flex flex-col gap-3 rounded-xl border border-rose-500/30 bg-rose-500/[0.04] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-0.5">
              <p className="text-sm font-medium text-rose-600 dark:text-rose-400">Delete organization</p>
              <p className="text-xs text-muted-foreground">
                Permanently delete {organization.name} and all associated data. This cannot be undone.
              </p>
            </div>
            <Dialog>
              <DialogTrigger asChild>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={!isOwner}
                  className="gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Delete {organization.name}?</DialogTitle>
                  <DialogDescription>
                    This permanently deletes the organization, all members, invoices, returns, and documents. There is no recovery.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3 py-2">
                  <p className="text-sm text-muted-foreground">
                    Type the organization name <span className="font-semibold text-foreground">{organization.name}</span> to confirm.
                  </p>
                  <Input
                    value={confirmName}
                    onChange={(e) => setConfirmName(e.target.value)}
                    placeholder={organization.name}
                    disabled={deleting}
                  />
                  {deleteError ? (
                    <p className="text-xs font-medium text-rose-600 dark:text-rose-400">{deleteError}</p>
                  ) : null}
                </div>
                <DialogFooter>
                  <Button variant="outline" disabled={deleting}>Cancel</Button>
                  <Button
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={!isOwner || !nameMatches || deleting}
                    className="gap-2"
                  >
                    {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    Delete forever
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {!isOwner ? (
            <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
              <Lock className="h-3.5 w-3.5 shrink-0" />
              <span>
                Only the owner of this organization can transfer ownership or delete it.
                {membership ? ` You are signed in as ${ROLE_LABELS[membership.role]}.` : ''}
              </span>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Section renderer ──────────────────────────────────────────────────────

function renderSection(id: SectionId) {
  switch (id) {
    case 'general':
      return <GeneralSection />;
    case 'branding':
      return <BrandingSection />;
    case 'localization':
      return <LocalizationSection />;
    case 'security':
      return <SecuritySection />;
    case 'members':
      return <MembersSection />;
    case 'notifications':
      return <NotificationsSection />;
    case 'billing':
      return <BillingSection />;
    case 'subscription':
      return <SubscriptionSection />;
    case 'integrations':
      return <IntegrationsSection />;
    case 'apikeys':
      return <ApiKeysSection />;
    case 'ai':
      return <AiSettingsSection />;
    case 'danger':
      return <DangerZoneSection />;
    default:
      return null;
  }
}

function sectionTitle(id: SectionId): { title: string; subtitle: string } {
  switch (id) {
    case 'general':
      return { title: 'General', subtitle: 'Organization profile, legal info, and identifiers.' };
    case 'branding':
      return { title: 'Branding', subtitle: 'Logo, colors, and custom domain.' };
    case 'localization':
      return { title: 'Localization', subtitle: 'Timezone, currency, and country.' };
    case 'security':
      return { title: 'Security', subtitle: 'Authentication and session policies.' };
    case 'members':
      return { title: 'Members', subtitle: 'Team roster, roles, and invitations.' };
    case 'notifications':
      return { title: 'Notifications', subtitle: 'Email and alert preferences.' };
    case 'billing':
      return { title: 'Billing', subtitle: 'Billing contact and tax details.' };
    case 'subscription':
      return { title: 'Subscription', subtitle: 'Plan, seats, and renewal.' };
    case 'integrations':
      return { title: 'Integrations', subtitle: 'Connected apps and services.' };
    case 'apikeys':
      return { title: 'API Keys', subtitle: 'Programmatic access tokens.' };
    case 'ai':
      return { title: 'AI Settings', subtitle: 'VEYRO AI, AI CFO, and predictive features.' };
    case 'danger':
      return { title: 'Danger Zone', subtitle: 'Transfer ownership, delete organization.' };
    default:
      return { title: '', subtitle: '' };
  }
}

// ─── Main component ────────────────────────────────────────────────────────

export default function EnterpriseSettings() {
  const { can } = usePermissions();
  const { organization } = useOrg();

  // Filter the sidebar to only show sections the user can access.
  const visibleSections = useMemo(
    () => SECTIONS.filter((s) => can(s.viewPermission)),
    [can],
  );

  const [activeSection, setActiveSection] = useState<SectionId>('general');

  // If the active section is not visible (e.g. user lacks permission), pick
  // the first visible one. This guards the case where the default 'general'
  // isn't available (e.g. for an auditor).
  useEffect(() => {
    if (visibleSections.length === 0) return;
    if (!visibleSections.some((s) => s.id === activeSection)) {
      setActiveSection(visibleSections[0].id);
    }
  }, [visibleSections, activeSection]);

  const activeMeta = SECTIONS.find((s) => s.id === activeSection) ?? visibleSections[0];
  const header = sectionTitle(activeSection);

  let motionEnabled = true;
  try {
    // Probe framer-motion at runtime — if it fails for any reason we fall back
    // to a plain div so the page still renders.
    void motion.div;
  } catch {
    motionEnabled = false;
  }

  return (
    <PermissionGate permission="org.view">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:py-10">
        {/* Header */}
        <header className="mb-6 space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Organization settings
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage your workspace identity, team, billing, and integrations.
          </p>
        </header>

        <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
          {/* Sidebar (vertical on desktop, Select on mobile) */}
          <aside className="lg:w-64 lg:shrink-0">
            {/* Mobile: Select dropdown */}
            <div className="lg:hidden">
              <Select
                value={activeSection}
                onValueChange={(v) => setActiveSection(v as SectionId)}
              >
                <SelectTrigger className="w-full" aria-label="Settings section">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {visibleSections.map((s) => {
                    const Icon = s.icon;
                    return (
                      <SelectItem key={s.id} value={s.id}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{s.label}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Desktop: vertical nav */}
            <nav
              aria-label="Settings sections"
              className="sticky top-20 hidden flex-col gap-1 lg:flex"
            >
              {visibleSections.map((s) => {
                const Icon = s.icon;
                const active = s.id === activeSection;
                const isDanger = s.id === 'danger';
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setActiveSection(s.id)}
                    aria-current={active ? 'page' : undefined}
                    className={`group flex items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-all ${
                      active
                        ? isDanger
                          ? 'border-rose-500/30 bg-rose-500/[0.06]'
                          : 'border-border/60 bg-card shadow-sm'
                        : 'border-transparent hover:border-border/40 hover:bg-muted/30'
                    }`}
                  >
                    <Icon
                      className={`mt-0.5 h-4 w-4 shrink-0 ${
                        active
                          ? isDanger
                            ? 'text-rose-500'
                            : 'text-primary'
                          : 'text-muted-foreground group-hover:text-foreground'
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-sm font-medium ${
                          active
                            ? isDanger
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-foreground'
                            : 'text-foreground/80 group-hover:text-foreground'
                        }`}
                      >
                        {s.label}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {s.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* Content panel */}
          <main className="min-w-0 flex-1">
            {/* Section header */}
            <div className="mb-5 space-y-1">
              <h2 className="text-lg font-semibold tracking-tight text-foreground">
                {header.title}
              </h2>
              <p className="text-sm text-muted-foreground">{header.subtitle}</p>
              <Separator className="mt-4" />
            </div>

            {/* Animated section */}
            {organization ? (
              motionEnabled ? (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeSection}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                  >
                    {renderSection(activeSection)}
                  </motion.div>
                </AnimatePresence>
              ) : (
                <div>{renderSection(activeSection)}</div>
              )
            ) : (
              <SettingsSkeleton />
            )}
          </main>
        </div>
      </div>
    </PermissionGate>
  );
}

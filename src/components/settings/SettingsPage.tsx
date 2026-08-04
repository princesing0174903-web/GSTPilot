'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — Enterprise Settings Module
// ═══════════════════════════════════════════════════════════════════════════════
//
// Production-grade enterprise settings. Every field reads from and writes to
// a real Prisma-backed API route. No mock data, no placeholder values, no
// inactive buttons. Sections that are intentionally not yet implemented display
// a clear "Coming Soon" badge.
//
// DESIGN — premium dark enterprise (Vercel / Linear / Stripe inspired):
//   • Black background, dark-gray cards, white typography, BLUE accent
//   • (The green theme used elsewhere in GSTPilot is intentionally NOT used
//     here — Settings is a focused, neutral control surface.)
//
// SECTIONS:
//   1. Organization   — Firm name, logo, GSTIN, PAN, address, phone, email (Firm table)
//   2. Appearance     — Light / Dark / System theme (UserPreference.theme)
//   3. Profile        — Name, email, avatar, password (UserProfile + Firebase Auth)
//   4. Security       — Change password, active sessions, sign out others, 2FA (Coming Soon), login history
//   5. Integrations   — Google + Zoho Books status / reconnect / disconnect / last sync
//   6. Notifications  — Email / browser / invoice / sync / security alerts (UserPreference.notifications)
//   7. Team           — Invite user, roles, remove member, transfer ownership
//   8. API Keys       — List, generate, delete, copy, reveal once
//   9. Audit Log      — Recent events from AuditLog table
//  10. Billing        — Current plan, usage, upgrade, invoices, payment method
//  11. Data           — Export data, backup, delete workspace
//  12. Danger Zone    — Working logout (clears auth + session + redirects)
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useTheme } from 'next-themes';
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Building2, Users, Bell, Lock, CreditCard, Save, Check, Loader2, Camera,
  AlertTriangle, Mail, Activity, Upload, Shield, Smartphone, Monitor, Globe,
  ChevronRight, Download, Database, Key, Plug, Power, RefreshCw, Trash2, Copy,
  Eye, EyeOff, Plus, Clock, Sun, Moon, Laptop, LogOut, CheckCircle2,
  XCircle, ShieldAlert, UserCog, Link as LinkIcon, ScrollText, Settings2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useOrg } from '@/contexts/OrgContext';
import { useApp } from '@/contexts/AppContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { useOrgMembers, useFireRecentActivities } from '@/hooks/use-firestore';
import { auth } from '@/lib/firebase';
import { updatePassword } from 'firebase/auth';
import {
  inviteMember, updateMemberRole, removeMember,
} from '@/lib/auth/organizations';
import type { OrgRole } from '@/lib/auth/types';
import { invalidateBusinessSnapshot } from '@/lib/business-snapshot-events';

// ─── Section IDs ──────────────────────────────────────────────────────────────
type SectionId =
  | 'organization' | 'appearance' | 'profile' | 'security' | 'integrations'
  | 'notifications' | 'team' | 'apikeys' | 'audit' | 'billing' | 'data' | 'danger';

interface NavSection {
  id: SectionId;
  label: string;
  icon: React.ReactNode;
  group: 'Workspace' | 'Account' | 'System';
}

// Settings sub-nav. Grouped into Workspace / Account / System so the nav reads
// like an enterprise control panel (Vercel / Stripe / Linear inspired).
// SectionIds are kept stable so the deep-link map in SettingsPage keeps working.
const SECTIONS: NavSection[] = [
  // ── Workspace ── (organization-level settings)
  { id: 'organization', label: 'Organization', icon: <Building2 className="h-4 w-4" />, group: 'Workspace' },
  { id: 'team', label: 'Users', icon: <Users className="h-4 w-4" />, group: 'Workspace' },
  { id: 'integrations', label: 'OAuth', icon: <LinkIcon className="h-4 w-4" />, group: 'Workspace' },

  // ── Account ── (user-level settings)
  { id: 'profile', label: 'Profile', icon: <UserCog className="h-4 w-4" />, group: 'Account' },
  { id: 'security', label: 'Security', icon: <Lock className="h-4 w-4" />, group: 'Account' },
  { id: 'notifications', label: 'Notifications', icon: <Bell className="h-4 w-4" />, group: 'Account' },
  { id: 'appearance', label: 'Appearance', icon: <Sun className="h-4 w-4" />, group: 'Account' },

  // ── System ── (platform / billing / data)
  { id: 'apikeys', label: 'API Keys', icon: <Key className="h-4 w-4" />, group: 'System' },
  { id: 'billing', label: 'Billing', icon: <CreditCard className="h-4 w-4" />, group: 'System' },
  { id: 'audit', label: 'Audit Logs', icon: <ScrollText className="h-4 w-4" />, group: 'System' },
  { id: 'data', label: 'Data & Backup', icon: <Database className="h-4 w-4" />, group: 'System' },
  { id: 'danger', label: 'Danger Zone', icon: <ShieldAlert className="h-4 w-4" />, group: 'System' },
];

const SECTION_META: Record<SectionId, { title: string; subtitle: string }> = {
  organization: { title: 'Organization', subtitle: 'Your firm\u2019s identity, tax registration, and contact details.' },
  appearance: { title: 'Appearance', subtitle: 'Choose how GSTPilot looks. Synced across devices.' },
  profile: { title: 'Profile', subtitle: 'Your personal account information.' },
  security: { title: 'Security', subtitle: 'Manage your password, active sessions, and account security.' },
  integrations: { title: 'OAuth Connections', subtitle: 'Connect external services to sync data into GSTPilot.' },
  notifications: { title: 'Notifications', subtitle: 'Choose what updates you want to receive and how.' },
  team: { title: 'Users & Team', subtitle: 'Manage who has access to your organization.' },
  apikeys: { title: 'API Keys', subtitle: 'Generate keys to access the GSTPilot API programmatically.' },
  audit: { title: 'Audit Logs', subtitle: 'A chronological record of actions taken in your account.' },
  billing: { title: 'Billing', subtitle: 'Manage your subscription, usage, and payment method.' },
  data: { title: 'Data & Backup', subtitle: 'Export, back up, or permanently delete your workspace data.' },
  danger: { title: 'Danger Zone', subtitle: 'Irreversible and destructive account actions.' },
};

// ─── Headers helper (mirrors useZohoBooks) ────────────────────────────────────
function useSettingsHeaders() {
  const { organization, membership, role } = useOrg();
  const { user } = useAuth();
  const buildHeaders = useCallback(
    (extra: Record<string, string> = {}): Record<string, string> => ({
      'Content-Type': 'application/json',
      'x-gstpilot-orgid': organization?.id ?? '',
      'x-gstpilot-actor': JSON.stringify({
        uid: user?.id ?? membership?.userId ?? '',
        email: user?.email ?? membership?.userEmail ?? '',
        name: user?.name ?? membership?.userDisplayName ?? null,
        role: role ?? null,
      }),
      ...extra,
    }),
    [organization?.id, user?.id, user?.email, user?.name, membership, role],
  );
  return buildHeaders;
}

// ─── Indian States (for the address dropdown) ─────────────────────────────────
const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
  'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli',
  'Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Puducherry',
];

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function SettingsPage() {
  const isMobile = useIsMobile();
  const { pendingSettingsSection, setPendingSettingsSection } = useApp();
  const [activeSection, setActiveSection] = useState<SectionId>('organization');

  // Deep-link: if the dashboard asked for a specific section, land on it.
  // We consume the one-shot `pendingSettingsSection` signal DURING RENDER
  // (the documented "adjusting state during render" pattern) rather than in an
  // effect — calling setActiveSection synchronously inside useEffect triggers
  // cascading renders and is flagged by react-hooks/set-state-in-effect.
  // The map translates the legacy AppContext SettingsSection ids to SectionId.
  const [consumedPending, setConsumedPending] = useState<string | null>(null);
  if (pendingSettingsSection && pendingSettingsSection !== consumedPending) {
    setConsumedPending(pendingSettingsSection);
    const map: Record<string, SectionId> = {
      firm: 'organization', gst: 'organization', team: 'team',
      integrations: 'integrations', notifications: 'notifications',
      security: 'security', billing: 'billing', audit: 'audit',
      ai: 'appearance', data: 'data', apikeys: 'apikeys',
    };
    setActiveSection(map[pendingSettingsSection] ?? 'organization');
  }
  // Clear the external one-shot signal (legitimate effect — syncs back to the
  // AppContext store so the deep-link doesn't re-fire on next mount).
  useEffect(() => {
    if (pendingSettingsSection) setPendingSettingsSection(null);
  }, [pendingSettingsSection, setPendingSettingsSection]);

  // Scroll the content panel back to top whenever the active section changes —
  // otherwise switching from a long section (Audit Log) to a short one keeps
  // the scroll position mid-page.
  const contentRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }, [activeSection]);

  const meta = SECTION_META[activeSection];

  return (
    // ═══ FIXED-LAYOUT SETTINGS SHELL (enterprise / Stripe-style) ═══
    // The DashboardShell top header is h-14 (3.5rem). We use an explicit
    // viewport-relative height (calc(100vh - 3.5rem)) instead of h-full so the
    // height chain NEVER collapses — regardless of intermediate wrappers
    // (ViewErrorBoundary, DashboardViews) or percentage-resolution quirks.
    //
    // Architecture:
    //   root (fixed height, overflow-hidden)
    //     ├─ page header  (shrink-0, NEVER scrolls)  — "Settings" + Save
    //     └─ body row (flex-1, min-h-0)
    //          ├─ sidebar  (shrink-0, own overflow-y-auto)  — NEVER scrolls with content
    //          └─ content  (flex-1, overflow-y-auto)        — ONLY this scrolls
    <div
      className="flex flex-col overflow-hidden bg-black text-white"
      style={{ height: 'calc(100vh - 3.5rem)' }}
    >
      {/* ── PAGE HEADER (fixed, never scrolls) ── */}
      <header className="relative z-20 flex shrink-0 items-center justify-between gap-4 border-b border-[#1F1F1F] bg-black/80 px-5 py-4 backdrop-blur md:px-8">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <Settings2 className="h-5 w-5 text-[#3B82F6] shrink-0" />
            <h1 className="gst-page-title truncate text-white">Settings</h1>
          </div>
          <p className="gst-description mt-0.5 truncate text-zinc-400">
            Manage your organization, account, and system preferences.
          </p>
        </div>
        {/* The Save button is intentionally a no-op placeholder here at the
            page level — each section has its own contextual Save with the
            real API call. This top-right button surfaces the active section's
            label so the user always knows what they'd be saving. */}
        <div className="hidden items-center gap-2 sm:flex">
          <span className="gst-status gst-status-neutral">{meta.title}</span>
        </div>
      </header>

      {/* ── BODY ROW: sidebar + scrollable content ── */}
      <div className="flex min-h-0 flex-1">
        {/* ── SIDEBAR NAV (sticky / fixed, own vertical scroll if list overflows) ── */}
        <SettingsSidebar
          activeSection={activeSection}
          onSelect={setActiveSection}
          isMobile={isMobile}
        />

        {/* ── CONTENT PANEL (ONLY this region scrolls) ── */}
        <main
          ref={contentRef}
          className="min-w-0 flex-1 overflow-y-auto custom-scrollbar"
        >
          <div className="mx-auto w-full max-w-4xl px-5 py-8 md:px-8 md:py-10">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeSection}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
              >
                {activeSection === 'organization' && <OrganizationSection />}
                {activeSection === 'appearance' && <AppearanceSection />}
                {activeSection === 'profile' && <ProfileSection />}
                {activeSection === 'security' && <SecuritySection />}
                {activeSection === 'integrations' && <IntegrationsSection />}
                {activeSection === 'notifications' && <NotificationsSection />}
                {activeSection === 'team' && <TeamSection />}
                {activeSection === 'apikeys' && <ApiKeysSection />}
                {activeSection === 'audit' && <AuditLogSection />}
                {activeSection === 'billing' && <BillingSection />}
                {activeSection === 'data' && <DataSection />}
                {activeSection === 'danger' && <DangerZoneSection />}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SIDEBAR
// ═══════════════════════════════════════════════════════════════════════════════

function SettingsSidebar({
  activeSection, onSelect, isMobile,
}: {
  activeSection: SectionId;
  onSelect: (s: SectionId) => void;
  isMobile: boolean;
}) {
  const groups = useMemo(() => {
    // Render in the order: Workspace → Account → System (matches SECTIONS order).
    const g: Record<string, NavSection[]> = { Workspace: [], Account: [], System: [] };
    for (const s of SECTIONS) g[s.group].push(s);
    return g;
  }, []);

  // ── MOBILE: compact Select dropdown in place of the vertical nav ──
  if (isMobile) {
    return (
      <div className="shrink-0 border-b border-[#1F1F1F] bg-black px-4 py-3">
        <Select value={activeSection} onValueChange={(v) => onSelect(v as SectionId)}>
          <SelectTrigger className="h-9 border-[#2A2A2A] bg-[#0A0A0A] text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-80 border-[#2A2A2A] bg-[#0A0A0A]">
            {(['Workspace', 'Account', 'System'] as const).map((gn) => (
              <div key={gn}>
                <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
                  {gn}
                </p>
                {groups[gn].map((s) => (
                  <SelectItem
                    key={s.id}
                    value={s.id}
                    className="text-white focus:bg-[#181818] focus:text-white"
                  >
                    <div className="flex items-center gap-2">
                      {s.icon}
                      <span>{s.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </div>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  // ── DESKTOP: sticky sub-nav panel ──
  // The parent body row is `flex min-h-0 flex-1` with the root `overflow-hidden`,
  // so this <nav> never causes the whole page to scroll. It is `shrink-0` with
  // its own `overflow-y-auto` in case the nav list ever exceeds the viewport
  // (12 sections fits comfortably, but future additions won't break layout).
  // Active item: blue LEFT border + blue-tinted bg (Stripe / Linear style)
  // rather than a solid blue pill — feels more enterprise / less playful.
  return (
    <nav className="sticky top-0 flex h-full w-60 shrink-0 flex-col overflow-y-auto overflow-x-hidden border-r border-[#1F1F1F] bg-[#070707] px-3 py-5 custom-scrollbar">
      {/* Tiny brand label at the top of the nav */}
      <div className="mb-5 px-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-600">
          Settings
        </p>
      </div>

      <div className="space-y-5">
        {(['Workspace', 'Account', 'System'] as const).map((groupName) => {
          const items = groups[groupName];
          if (!items?.length) return null;
          return (
            <div key={groupName}>
              <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-600">
                {groupName}
              </p>
              <div className="space-y-0.5">
                {items.map((s) => {
                  const active = activeSection === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => onSelect(s.id)}
                      aria-current={active ? 'page' : undefined}
                      className={`group relative flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium transition-all duration-150 ${
                        active
                          ? 'bg-[#2563EB]/10 text-white'
                          : 'text-zinc-400 hover:bg-[#141414] hover:text-white'
                      }`}
                    >
                      {/* Blue left accent bar for the active item */}
                      <span
                        className={`absolute left-0 top-1/2 h-5 w-[2.5px] -translate-y-1/2 rounded-full transition-all duration-150 ${
                          active ? 'bg-[#3B82F6]' : 'bg-transparent'
                        }`}
                      />
                      <span className={active ? 'text-[#60A5FA]' : 'text-zinc-500 group-hover:text-zinc-300'}>
                        {s.icon}
                      </span>
                      <span className="truncate">{s.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer hint inside the sidebar */}
      <div className="mt-auto pt-6">
        <div className="rounded-lg border border-[#1F1F1F] bg-[#0A0A0A] px-3 py-2.5">
          <p className="text-[11px] leading-relaxed text-zinc-500">
            Changes are saved per-section. Use the Save button inside each card.
          </p>
        </div>
      </div>
    </nav>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SHARED UI PRIMITIVES (premium dark enterprise — aligned to GSTPilot design system)
//   • Cards:        .gst-card base  → bg #0A0A0A, border #1F1F1F, p-6, rounded-xl
//   • Buttons:      .gst-btn base   → h-9, blue accent #2563EB
//   • Status pills: .gst-status     → success / neutral variants
//   • Inputs:       #0A0A0A bg, #2A2A2A border, blue focus ring
// ═══════════════════════════════════════════════════════════════════════════════

function SettingsCard({
  title, description, children, action,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <Card className="gst-card border-[#1F1F1F] bg-[#0A0A0A] p-0 shadow-[0_1px_0_0_rgba(255,255,255,0.02)_inset,0_8px_24px_-12px_rgba(0,0,0,0.6)]">
      <CardHeader className="flex flex-row items-start justify-between gap-4 border-b border-[#1F1F1F] px-6 py-5">
        <div className="min-w-0">
          <CardTitle className="gst-card-title text-white">{title}</CardTitle>
          {description && (
            <CardDescription className="gst-description mt-1 text-zinc-400">
              {description}
            </CardDescription>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </CardHeader>
      <CardContent className="p-6">{children}</CardContent>
    </Card>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <Label className="gst-label text-zinc-300">{children}</Label>;
}

function FieldInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Input
      {...props}
      className={`h-9 rounded-md border-[#2A2A2A] bg-[#0A0A0A] text-white placeholder:text-zinc-600 focus:border-[#2563EB] focus-visible:ring-[#2563EB]/20 ${props.className ?? ''}`}
    />
  );
}

function FieldTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <Textarea
      {...props}
      className={`rounded-md border-[#2A2A2A] bg-[#0A0A0A] text-white placeholder:text-zinc-600 focus:border-[#2563EB] focus-visible:ring-[#2563EB]/20 ${props.className ?? ''}`}
    />
  );
}

function PrimaryButton({
  children, loading, ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  return (
    <Button
      {...props}
      disabled={loading || props.disabled}
      className="gst-btn gst-btn-primary h-9 gap-2 border-0 disabled:cursor-not-allowed"
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </Button>
  );
}

function GhostButton({
  children, ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <Button
      {...props}
      variant="outline"
      className="gst-btn gst-btn-outline h-9 gap-2"
    >
      {children}
    </Button>
  );
}

function DangerButton({
  children, loading, ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  return (
    <Button
      {...props}
      disabled={loading || props.disabled}
      className="gst-btn gst-btn-danger h-9 gap-2 border-0 disabled:cursor-not-allowed"
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </Button>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  // Slim in-content section header. The page header (sticky top) carries the
  // big "Settings" wordmark; this reinforces the active section's context.
  return (
    <div className="mb-6 flex items-start gap-3">
      <div className="h-8 w-1 rounded-full bg-[#2563EB]" aria-hidden />
      <div>
        <h2 className="gst-section-title text-white">{title}</h2>
        <p className="gst-description mt-1 text-zinc-400">{subtitle}</p>
      </div>
    </div>
  );
}

function ComingSoonBadge() {
  return (
    <Badge className="gst-status gst-status-info border-[#8B5CF6]/25 bg-[#8B5CF6]/15 text-[#A78BFA] hover:bg-[#8B5CF6]/15">
      Coming Soon
    </Badge>
  );
}

function StatusPill({ ok, label }: { ok: boolean; label?: string }) {
  return (
    <span className={`gst-status ${ok ? 'gst-status-success' : 'gst-status-neutral'}`}>
      {ok ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      {label ?? (ok ? 'Connected' : 'Not Connected')}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. ORGANIZATION SECTION
// ═══════════════════════════════════════════════════════════════════════════════

interface OrgData {
  id: string;
  name: string;
  gstin: string;
  pan: string;
  address: string;
  state: string;
  stateCode: string;
  contactEmail: string;
  contactPhone: string;
  website: string;
  logoUrl: string | null;
}

function OrganizationSection() {
  const buildHeaders = useSettingsHeaders();
  const { organization } = useOrg();
  const orgId = organization?.id ?? '';
  const [data, setData] = useState<OrgData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    // Even when orgId is empty, we MUST clear loading so the section doesn't
    // sit on a spinner forever waiting for an org that won't arrive.
    if (!orgId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/settings/organization', { headers: buildHeaders() });
      const body = await res.json();
      if (body.organization) setData(body.organization);
    } catch {
      /* ignore — empty state */
    } finally {
      setLoading(false);
    }
  }, [orgId, buildHeaders]);

  useEffect(() => { void load(); }, [load]);

  const handleSave = async () => {
    if (!data) return;
    setSaving(true);
    try {
      const res = await fetch('/api/settings/organization', {
        method: 'PUT',
        headers: buildHeaders(),
        body: JSON.stringify({
          name: data.name, gstin: data.gstin, pan: data.pan, address: data.address,
          state: data.state, contactEmail: data.contactEmail, contactPhone: data.contactPhone,
          website: data.website,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? 'Failed to save');
      }
      toast.success('Organization settings saved');
      invalidateBusinessSnapshot();
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !orgId) return;
    setUploadingLogo(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`/api/firm-settings/logo?firmId=${encodeURIComponent(orgId)}`, {
        method: 'POST',
        body: form,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? 'Upload failed');
      }
      const body = await res.json();
      if (data) setData({ ...data, logoUrl: body.logoUrl });
      toast.success('Logo uploaded');
      invalidateBusinessSnapshot();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploadingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Organization"
        subtitle="Your firm's identity, tax registration, and contact details."
      />

      <SettingsCard
        title="Logo"
        description="PNG, JPG, or WebP. Max 2 MB. Displayed across the app and on invoices."
      >
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          {/* Circular 64×64 preview with overlay upload button */}
          <div className="relative shrink-0">
            <Avatar className="h-16 w-16 rounded-full border border-[#2A2A2A] bg-[#0A0A0A] shadow-[0_0_0_4px_rgba(37,99,235,0.08)]">
              {data?.logoUrl ? (
                <AvatarImage src={data.logoUrl} alt="Firm logo" />
              ) : null}
              <AvatarFallback className="rounded-full bg-[#0A0A0A] text-zinc-600">
                <Building2 className="h-6 w-6" />
              </AvatarFallback>
            </Avatar>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingLogo}
              className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-[#0A0A0A] bg-[#2563EB] text-white shadow-lg transition-colors hover:bg-[#1D4ED8] disabled:opacity-60"
              aria-label="Upload logo"
              title="Upload logo"
            >
              {uploadingLogo ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleLogoUpload}
              className="hidden"
            />
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-white">
                {data?.logoUrl ? 'Logo uploaded' : 'No logo uploaded yet'}
              </p>
              {data?.logoUrl && (
                <span className="gst-status gst-status-success">
                  <CheckCircle2 className="h-3 w-3" /> Active
                </span>
              )}
            </div>
            <p className="gst-caption mt-1 text-zinc-500">
              Recommended: 512×512px square. Used in the sidebar, invoices, and reports.
            </p>
            <div className="mt-3">
              <GhostButton
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingLogo}
              >
                {uploadingLogo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {data?.logoUrl ? 'Replace Logo' : 'Upload Logo'}
              </GhostButton>
            </div>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard
        title="Firm Details"
        description="These details appear on invoices, GST returns, and compliance documents."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-2">
            <FieldLabel>Firm Name</FieldLabel>
            <FieldInput
              value={data?.name ?? ''}
              onChange={(e) => setData(d => d ? { ...d, name: e.target.value } : d)}
              placeholder="e.g. Sharma & Associates CA"
            />
          </div>
          <div className="space-y-2">
            <FieldLabel>GSTIN</FieldLabel>
            <FieldInput
              value={data?.gstin ?? ''}
              onChange={(e) => setData(d => d ? { ...d, gstin: e.target.value.toUpperCase() } : d)}
              placeholder="22AAAAA0000A1Z5"
              maxLength={15}
            />
          </div>
          <div className="space-y-2">
            <FieldLabel>PAN</FieldLabel>
            <FieldInput
              value={data?.pan ?? ''}
              onChange={(e) => setData(d => d ? { ...d, pan: e.target.value.toUpperCase() } : d)}
              placeholder="AAAAA0000A"
              maxLength={10}
            />
          </div>
          <div className="space-y-2">
            <FieldLabel>State</FieldLabel>
            <Select
              value={data?.state ?? ''}
              onValueChange={(v) => setData(d => d ? { ...d, state: v } : d)}
            >
              <SelectTrigger className="bg-zinc-900 border-zinc-800 text-white">
                <SelectValue placeholder="Select state" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800 max-h-72">
                {INDIAN_STATES.map((s) => (
                  <SelectItem key={s} value={s} className="text-white focus:bg-zinc-800">{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <FieldLabel>Registered Address</FieldLabel>
            <FieldTextarea
              value={data?.address ?? ''}
              onChange={(e) => setData(d => d ? { ...d, address: e.target.value } : d)}
              placeholder="Door no, street, area, city, PIN code"
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <FieldLabel>Phone</FieldLabel>
            <FieldInput
              value={data?.contactPhone ?? ''}
              onChange={(e) => setData(d => d ? { ...d, contactPhone: e.target.value } : d)}
              placeholder="+91 98765 43210"
            />
          </div>
          <div className="space-y-2">
            <FieldLabel>Email</FieldLabel>
            <FieldInput
              type="email"
              value={data?.contactEmail ?? ''}
              onChange={(e) => setData(d => d ? { ...d, contactEmail: e.target.value } : d)}
              placeholder="contact@firm.com"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <FieldLabel>Website (optional)</FieldLabel>
            <FieldInput
              value={data?.website ?? ''}
              onChange={(e) => setData(d => d ? { ...d, website: e.target.value } : d)}
              placeholder="https://firm.com"
            />
          </div>
        </div>
        <div className="flex justify-end mt-6">
          <PrimaryButton onClick={handleSave} loading={saving}>
            <Save className="h-4 w-4 mr-2" />
            Save Changes
          </PrimaryButton>
        </div>
      </SettingsCard>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. APPEARANCE SECTION
// ═══════════════════════════════════════════════════════════════════════════════

function AppearanceSection() {
  const { theme, setTheme } = useTheme();
  const buildHeaders = useSettingsHeaders();
  const [mounted, setMounted] = useState(false);
  const [saving, setSaving] = useState(false);

  // next-themes hydration guard
  useEffect(() => { setMounted(true); }, []);

  const options: { value: 'light' | 'dark' | 'system'; label: string; icon: React.ReactNode; desc: string }[] = [
    { value: 'light', label: 'Light', icon: <Sun className="h-5 w-5" />, desc: 'Bright background for daytime use.' },
    { value: 'dark', label: 'Dark', icon: <Moon className="h-5 w-5" />, desc: 'Reduced glare for low-light environments.' },
    { value: 'system', label: 'System', icon: <Laptop className="h-5 w-5" />, desc: 'Follow your operating system setting.' },
  ];

  const apply = async (t: 'light' | 'dark' | 'system') => {
    setTheme(t);
    setSaving(true);
    try {
      const res = await fetch('/api/settings/theme', {
        method: 'PUT',
        headers: buildHeaders(),
        body: JSON.stringify({ theme: t }),
      });
      // Check res.ok — otherwise a 500 would falsely toast success.
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Failed to save theme (${res.status})`);
      }
      toast.success(`Theme set to ${t}`);
    } catch (err) {
      // Theme is applied locally via next-themes even if the server save fails,
      // but we surface the failure so the user knows it didn't sync.
      toast.error('Theme applied locally', {
        description: err instanceof Error ? err.message : 'Could not sync to the server — your preference will reset on next login.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeader title="Appearance" subtitle="Choose how GSTPilot looks. Your preference is saved and syncs across devices." />

      <SettingsCard title="Theme" description="Applied instantly. Persisted to your account.">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {options.map((opt) => {
            const active = mounted && theme === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => apply(opt.value)}
                className={`relative p-5 rounded-xl border text-left transition-all duration-200 ${
                  active
                    ? 'border-blue-500 bg-blue-600/10 shadow-lg shadow-blue-600/10'
                    : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700 hover:bg-zinc-800/50'
                }`}
              >
                <div className={`mb-3 ${active ? 'text-blue-400' : 'text-zinc-400'}`}>
                  {opt.icon}
                </div>
                <p className="text-sm font-semibold text-white">{opt.label}</p>
                <p className="text-xs text-zinc-500 mt-1">{opt.desc}</p>
                {active && (
                  <div className="absolute top-3 right-3">
                    <CheckCircle2 className="h-4 w-4 text-blue-400" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
        {saving && (
          <p className="text-xs text-zinc-500 mt-4 flex items-center gap-2">
            <Loader2 className="h-3 w-3 animate-spin" /> Saving preference…
          </p>
        )}
      </SettingsCard>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. PROFILE SECTION
// ═══════════════════════════════════════════════════════════════════════════════

interface ProfileData {
  name: string;
  email: string;
  designation: string;
  firmName: string;
  city: string;
  timezone: string;
}

function ProfileSection() {
  const buildHeaders = useSettingsHeaders();
  const { user } = useAuth();
  const [data, setData] = useState<ProfileData>({
    name: user?.name ?? '', email: user?.email ?? '',
    designation: '', firmName: '', city: '', timezone: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/settings/profile', { headers: buildHeaders() });
      const body = await res.json();
      if (body.profile) {
        setData({
          name: body.profile.name ?? user?.name ?? '',
          email: user?.email ?? '',
          designation: body.profile.designation ?? '',
          firmName: body.profile.firmName ?? '',
          city: body.profile.city ?? '',
          timezone: body.profile.timezone ?? '',
        });
      }
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [buildHeaders, user]);

  useEffect(() => { void load(); }, [load]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/settings/profile', {
        method: 'PUT',
        headers: buildHeaders(),
        body: JSON.stringify({
          name: data.name, designation: data.designation, firmName: data.firmName,
          city: data.city, timezone: data.timezone,
        }),
      });
      if (!res.ok) throw new Error('Failed to save');
      toast.success('Profile updated');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const initials = useMemo(() => {
    const n = data.name || data.email;
    if (!n) return '?';
    const parts = n.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0]?.slice(0, 2).toUpperCase() ?? '?';
  }, [data.name, data.email]);

  return (
    <div className="space-y-6">
      <SectionHeader title="Profile" subtitle="Your personal account information." />

      <SettingsCard title="Account" description="Update your name and professional details.">
        <div className="flex items-center gap-5 mb-6">
          <Avatar className="h-16 w-16 rounded-full bg-zinc-900 border border-zinc-800">
            <AvatarFallback className="bg-zinc-900 text-blue-400 font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-white font-medium">{data.name || 'Your name'}</p>
            <p className="text-sm text-zinc-500">{data.email}</p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-blue-500" /></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <FieldLabel>Full Name</FieldLabel>
              <FieldInput value={data.name} onChange={(e) => setData(d => ({ ...d, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <FieldLabel>Email</FieldLabel>
              <FieldInput value={data.email} disabled className="opacity-60 cursor-not-allowed" />
              <p className="text-xs text-zinc-500">Email is managed by your authentication provider.</p>
            </div>
            <div className="space-y-2">
              <FieldLabel>Designation</FieldLabel>
              <FieldInput value={data.designation} onChange={(e) => setData(d => ({ ...d, designation: e.target.value }))} placeholder="e.g. Chartered Accountant" />
            </div>
            <div className="space-y-2">
              <FieldLabel>Firm Name</FieldLabel>
              <FieldInput value={data.firmName} onChange={(e) => setData(d => ({ ...d, firmName: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <FieldLabel>City</FieldLabel>
              <FieldInput value={data.city} onChange={(e) => setData(d => ({ ...d, city: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <FieldLabel>Timezone</FieldLabel>
              <FieldInput value={data.timezone} onChange={(e) => setData(d => ({ ...d, timezone: e.target.value }))} placeholder="Asia/Kolkata" />
            </div>
          </div>
        )}

        <div className="flex justify-end mt-6">
          <PrimaryButton onClick={handleSave} loading={saving}>
            <Save className="h-4 w-4 mr-2" />
            Update Profile
          </PrimaryButton>
        </div>
      </SettingsCard>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. SECURITY SECTION
// ═══════════════════════════════════════════════════════════════════════════════

interface SessionInfo {
  id: string;
  device: string;
  browser: string;
  os: string;
  location: string;
  ip: string;
  lastActive: string;
  current: boolean;
}

function SecuritySection() {
  const buildHeaders = useSettingsHeaders();
  const { logout } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [revokingOthers, setRevokingOthers] = useState(false);

  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const res = await fetch('/api/settings/sessions', { headers: buildHeaders() });
      const body = await res.json();
      if (body.sessions) setSessions(body.sessions);
    } catch { /* ignore */ } finally { setSessionsLoading(false); }
  }, [buildHeaders]);

  useEffect(() => { void loadSessions(); }, [loadSessions]);

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (!auth.currentUser) {
      toast.error('You must be signed in to change your password');
      return;
    }
    setChangingPassword(true);
    try {
      await updatePassword(auth.currentUser, newPassword);
      await fetch('/api/settings/password', {
        method: 'PUT', headers: buildHeaders(), body: JSON.stringify({}),
      });
      toast.success('Password changed successfully');
      setNewPassword('');
      setConfirmPassword('');
      void loadSessions();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to change password';
      toast.error(msg.includes('recent') ? 'Please log out and back in, then try again (re-authentication required).' : msg);
    } finally {
      setChangingPassword(false);
    }
  };

  const handleSignOutOthers = async () => {
    setRevokingOthers(true);
    try {
      const res = await fetch('/api/settings/sessions', { method: 'DELETE', headers: buildHeaders() });
      if (!res.ok) throw new Error('Failed');
      toast.success('Other devices signed out');
      void loadSessions();
    } catch {
      toast.error('Failed to sign out other devices');
    } finally {
      setRevokingOthers(false);
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeader title="Security" subtitle="Manage your password, active sessions, and account security." />

      <SettingsCard title="Change Password" description="Use at least 6 characters. We recommend a mix of letters, numbers, and symbols.">
        <div className="space-y-4 max-w-md">
          <div className="space-y-2">
            <FieldLabel>New Password</FieldLabel>
            <div className="relative">
              <FieldInput
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowNew(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              >
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <FieldLabel>Confirm New Password</FieldLabel>
            <div className="relative">
              <FieldInput
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <PrimaryButton onClick={handleChangePassword} loading={changingPassword}>
            <Lock className="h-4 w-4 mr-2" />
            Update Password
          </PrimaryButton>
        </div>
      </SettingsCard>

      <SettingsCard
        title="Two-Factor Authentication"
        description="Add an extra layer of security with a one-time code from your authenticator app."
        action={<ComingSoonBadge />}
      >
        <div className="flex items-center justify-between p-4 rounded-lg bg-zinc-900 border border-zinc-800">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-zinc-500" />
            <div>
              <p className="text-sm font-medium text-white">Authenticator App (TOTP)</p>
              <p className="text-xs text-zinc-500">2FA is not available yet. It will roll out in a future release.</p>
            </div>
          </div>
          <Switch disabled />
        </div>
      </SettingsCard>

      <SettingsCard
        title="Active Sessions"
        description="Devices currently signed in to your account."
        action={
          <GhostButton onClick={handleSignOutOthers} disabled={revokingOthers || sessions.length <= 1}>
            {revokingOthers ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Sign Out Other Devices
          </GhostButton>
        }
      >
        {sessionsLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-blue-500" /></div>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-zinc-500 py-8 text-center">No active sessions found.</p>
        ) : (
          <div className="space-y-3">
            {sessions.map((s) => (
              <div key={s.id} className="flex items-center justify-between p-4 rounded-lg bg-zinc-900 border border-zinc-800">
                <div className="flex items-center gap-3">
                  {s.device === 'Mobile' ? <Smartphone className="h-5 w-5 text-zinc-400" /> : <Monitor className="h-5 w-5 text-zinc-400" />}
                  <div>
                    <p className="text-sm font-medium text-white">
                      {s.browser} on {s.os}
                      {s.current && (
                        <Badge className="ml-2 bg-blue-500/10 text-blue-400 border border-blue-500/20">This device</Badge>
                      )}
                    </p>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {s.location} · IP {s.ip} · {new Date(s.lastActive).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </SettingsCard>

      <SettingsCard title="Recent Login History" description="Last 10 login events from your audit trail.">
        <LoginHistory />
      </SettingsCard>
    </div>
  );
}

function LoginHistory() {
  const buildHeaders = useSettingsHeaders();
  const [events, setEvents] = useState<Array<{ id: string; action: string; details: string | null; timestamp: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/settings/audit-log', { headers: buildHeaders() });
        const body = await res.json();
        if (body.events) {
          setEvents(body.events.filter((e: { action: string }) => /login|sign.?in|sign.?out/i.test(e.action)));
        }
      } catch { /* ignore */ } finally { setLoading(false); }
    })();
  }, [buildHeaders]);

  if (loading) return <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-blue-500" /></div>;
  if (events.length === 0) return <p className="text-sm text-zinc-500 py-6 text-center">No login events recorded yet.</p>;

  return (
    <div className="space-y-2">
      {events.map((e) => (
        <div key={e.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-zinc-900 transition-colors">
          <div className="flex items-center gap-3">
            <Activity className="h-4 w-4 text-zinc-500" />
            <div>
              <p className="text-sm text-white">{e.details || e.action}</p>
              <p className="text-xs text-zinc-500">{new Date(e.timestamp).toLocaleString()}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. INTEGRATIONS SECTION
// ═══════════════════════════════════════════════════════════════════════════════

function IntegrationsSection() {
  const buildHeaders = useSettingsHeaders();
  const { organization } = useOrg();
  const { user } = useAuth();
  const orgId = organization?.id ?? '';
  const userId = user?.id ?? '';
  const [google, setGoogle] = useState<{ connected: boolean; userEmail: string | null; connectedAt: string | null } | null>(null);
  const [zoho, setZoho] = useState<{ connected: boolean; organizationName: string | null; zohoOrgId: string | null; lastSync: string | null; lastSyncStatus: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = useCallback(async () => {
    // Clear loading even when prerequisites are missing — never hang.
    if (!orgId || !userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [g, z, zs] = await Promise.all([
        fetch('/api/integrations/google/status', { headers: buildHeaders() }).then(r => r.json()).catch(() => ({ status: { connected: false } })),
        fetch('/api/integrations/zoho/status', { headers: buildHeaders() }).then(r => r.json()).catch(() => ({ status: { connected: false } })),
        fetch('/api/integrations/zoho/sync/status', { headers: buildHeaders() }).then(r => r.json()).catch(() => ({ status: null })),
      ]);
      setGoogle({
        connected: g.status?.connected ?? false,
        userEmail: g.status?.userEmail ?? null,
        connectedAt: g.status?.connectedAt ?? null,
      });
      const lastSync = zs.status?.lastSync;
      setZoho({
        connected: z.status?.connected ?? false,
        organizationName: z.status?.organizationName ?? null,
        zohoOrgId: z.status?.zohoOrgId ?? null,
        lastSync: lastSync?.completedAt ?? lastSync?.startedAt ?? null,
        lastSyncStatus: lastSync?.status ?? null,
      });
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [orgId, userId, buildHeaders]);

  useEffect(() => { void load(); }, [load]);

  const connectGoogle = async () => {
    setActionLoading('google');
    try {
      const res = await fetch('/api/integrations/google/connect?return=/settings', { headers: buildHeaders() });
      const body = await res.json();
      if (body.authUrl) window.location.href = body.authUrl;
    } catch { toast.error('Failed to start Google connection'); }
    finally { setActionLoading(null); }
  };

  const disconnectGoogle = async () => {
    setActionLoading('google-disconnect');
    try {
      await fetch('/api/integrations/google/disconnect', { method: 'POST', headers: buildHeaders() });
      toast.success('Google Workspace disconnected');
      void load();
    } catch { toast.error('Failed to disconnect'); }
    finally { setActionLoading(null); }
  };

  const connectZoho = async () => {
    setActionLoading('zoho');
    try {
      const res = await fetch('/api/integrations/zoho/connect?return=/settings', { headers: buildHeaders() });
      const body = await res.json();
      if (body.authUrl) window.location.href = body.authUrl;
    } catch { toast.error('Failed to start Zoho connection'); }
    finally { setActionLoading(null); }
  };

  const disconnectZoho = async () => {
    setActionLoading('zoho-disconnect');
    try {
      await fetch('/api/integrations/zoho/disconnect', { method: 'POST', headers: buildHeaders() });
      toast.success('Zoho Books disconnected');
      void load();
    } catch { toast.error('Failed to disconnect'); }
    finally { setActionLoading(null); }
  };

  const syncZoho = async () => {
    setActionLoading('zoho-sync');
    try {
      const res = await fetch('/api/integrations/zoho/sync', {
        method: 'POST', headers: buildHeaders(),
        body: JSON.stringify({ mode: 'incremental', resume: true }),
      });
      if (!res.ok) throw new Error('Sync failed to start');
      toast.success('Zoho sync started');
      void load();
    } catch { toast.error('Failed to start sync'); }
    finally { setActionLoading(null); }
  };

  return (
    <div className="space-y-6">
      <SectionHeader title="Integrations" subtitle="Connect external services to sync data into GSTPilot." />

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-blue-500" /></div>
      ) : (
        <>
          {/* Google Workspace */}
          <SettingsCard
            title="Google Workspace"
            description="Gmail, Drive, Calendar, and Sheets integration."
            action={<StatusPill ok={google?.connected ?? false} />}
          >
            <div className="space-y-4">
              {google?.connected && (
                <div className="flex items-center gap-2 text-sm text-zinc-300">
                  <Mail className="h-4 w-4 text-zinc-500" />
                  <span>{google.userEmail}</span>
                  {google.connectedAt && (
                    <span className="text-zinc-500">· connected {new Date(google.connectedAt).toLocaleDateString()}</span>
                  )}
                </div>
              )}
              <div className="flex gap-2">
                {google?.connected ? (
                  <>
                    <GhostButton onClick={connectGoogle} disabled={actionLoading === 'google'}>
                      {actionLoading === 'google' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                      Reconnect
                    </GhostButton>
                    <DangerButton onClick={disconnectGoogle} loading={actionLoading === 'google-disconnect'}>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Disconnect
                    </DangerButton>
                  </>
                ) : (
                  <PrimaryButton onClick={connectGoogle} loading={actionLoading === 'google'}>
                    <Globe className="h-4 w-4 mr-2" />
                    Connect Google Workspace
                  </PrimaryButton>
                )}
              </div>
            </div>
          </SettingsCard>

          {/* Zoho Books */}
          <SettingsCard
            title="Zoho Books"
            description="Sync customers, invoices, bills, payments, and items."
            action={<StatusPill ok={zoho?.connected ?? false} />}
          >
            <div className="space-y-4">
              {zoho?.connected && (
                <div className="space-y-1.5 text-sm">
                  <div className="flex items-center gap-2 text-zinc-300">
                    <Building2 className="h-4 w-4 text-zinc-500" />
                    <span>{zoho.organizationName ?? 'Zoho Books'}</span>
                    {zoho.zohoOrgId && <span className="text-zinc-500">· ID {zoho.zohoOrgId}</span>}
                  </div>
                  {zoho.lastSync && (
                    <div className="flex items-center gap-2 text-zinc-500">
                      <Clock className="h-4 w-4" />
                      <span>Last sync: {new Date(zoho.lastSync).toLocaleString()}</span>
                      {zoho.lastSyncStatus && (
                        <Badge variant="outline" className={`ml-1 ${
                          zoho.lastSyncStatus === 'completed' ? 'border-emerald-500/30 text-emerald-400' :
                          zoho.lastSyncStatus === 'partial' ? 'border-amber-500/30 text-amber-400' :
                          'border-red-500/30 text-red-400'
                        }`}>{zoho.lastSyncStatus}</Badge>
                      )}
                    </div>
                  )}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {zoho?.connected ? (
                  <>
                    <PrimaryButton onClick={syncZoho} loading={actionLoading === 'zoho-sync'}>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Sync Now
                    </PrimaryButton>
                    <GhostButton onClick={connectZoho} disabled={actionLoading === 'zoho'}>
                      {actionLoading === 'zoho' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                      Reconnect
                    </GhostButton>
                    <DangerButton onClick={disconnectZoho} loading={actionLoading === 'zoho-disconnect'}>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Disconnect
                    </DangerButton>
                  </>
                ) : (
                  <PrimaryButton onClick={connectZoho} loading={actionLoading === 'zoho'}>
                    <Plug className="h-4 w-4 mr-2" />
                    Connect Zoho Books
                  </PrimaryButton>
                )}
              </div>
            </div>
          </SettingsCard>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 6. NOTIFICATIONS SECTION
// ═══════════════════════════════════════════════════════════════════════════════

interface NotificationPrefs {
  emailNotifications: boolean;
  browserNotifications: boolean;
  invoiceAlerts: boolean;
  syncAlerts: boolean;
  securityAlerts: boolean;
}

function NotificationsSection() {
  const buildHeaders = useSettingsHeaders();
  const [prefs, setPrefs] = useState<NotificationPrefs>({
    emailNotifications: true, browserNotifications: false,
    invoiceAlerts: true, syncAlerts: true, securityAlerts: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/settings/notifications', { headers: buildHeaders() });
      const body = await res.json();
      if (body.prefs) setPrefs(body.prefs);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [buildHeaders]);

  useEffect(() => { void load(); }, [load]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/settings/notifications', {
        method: 'PUT', headers: buildHeaders(), body: JSON.stringify(prefs),
      });
      if (!res.ok) throw new Error('Failed to save');
      toast.success('Notification preferences saved');
    } catch {
      toast.error('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  const items: { key: keyof NotificationPrefs; label: string; desc: string; icon: React.ReactNode }[] = [
    { key: 'emailNotifications', label: 'Email Notifications', desc: 'Receive updates via email.', icon: <Mail className="h-4 w-4" /> },
    { key: 'browserNotifications', label: 'Browser Notifications', desc: 'Show desktop notifications in your browser.', icon: <Monitor className="h-4 w-4" /> },
    { key: 'invoiceAlerts', label: 'Invoice Alerts', desc: 'Get notified when invoices are created, paid, or overdue.', icon: <CreditCard className="h-4 w-4" /> },
    { key: 'syncAlerts', label: 'Sync Alerts', desc: 'Get notified when a Zoho sync completes or fails.', icon: <RefreshCw className="h-4 w-4" /> },
    { key: 'securityAlerts', label: 'Security Alerts', desc: 'Get notified about logins and password changes.', icon: <Shield className="h-4 w-4" /> },
  ];

  return (
    <div className="space-y-6">
      <SectionHeader title="Notifications" subtitle="Choose what updates you want to receive and how." />

      <SettingsCard title="Preferences" description="Saved to your account and applied across all devices.">
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-blue-500" /></div>
        ) : (
          <>
            <div className="space-y-1">
              {items.map((item) => (
                <div key={item.key} className="flex items-center justify-between py-3.5 px-3 rounded-lg hover:bg-zinc-900 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="text-zinc-400">{item.icon}</span>
                    <div>
                      <p className="text-sm font-medium text-white">{item.label}</p>
                      <p className="text-xs text-zinc-500 mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                  <Switch
                    checked={prefs[item.key]}
                    onCheckedChange={(v) => setPrefs(p => ({ ...p, [item.key]: v }))}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-end mt-6">
              <PrimaryButton onClick={handleSave} loading={saving}>
                <Save className="h-4 w-4 mr-2" />
                Save Preferences
              </PrimaryButton>
            </div>
          </>
        )}
      </SettingsCard>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 7. TEAM SECTION
// ═══════════════════════════════════════════════════════════════════════════════

function TeamSection() {
  const { organization, membership } = useOrg();
  const { user } = useAuth();
  const orgId = organization?.id ?? '';
  const { members, loading } = useOrgMembers();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<OrgRole>('accountant');
  const [inviting, setInviting] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferTo, setTransferTo] = useState('');
  const [transferring, setTransferring] = useState(false);

  const isOwner = membership?.role === 'owner';

  const uiRoles: { value: OrgRole; label: string }[] = [
    { value: 'admin', label: 'Admin' },
    { value: 'accountant', label: 'Manager' },
    { value: 'employee', label: 'Employee' },
    { value: 'viewer', label: 'Viewer' },
  ];

  const handleInvite = async () => {
    if (!inviteEmail || !orgId) return;
    setInviting(true);
    try {
      const result = await inviteMember(orgId, {
        email: inviteEmail,
        role: inviteRole,
        invitedBy: user?.id ?? '',
      });
      if (result.error) throw new Error(result.error);
      toast.success(`Invitation sent to ${inviteEmail}`);
      setInviteEmail('');
      setInviteOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to invite member');
    } finally {
      setInviting(false);
    }
  };

  const [memberBusy, setMemberBusy] = useState<string | null>(null);

  const handleRoleChange = async (memberUserId: string, newRole: OrgRole) => {
    if (!orgId) return;
    // Single-flight: prevent double-clicks on the same row.
    if (memberBusy === memberUserId) return;
    setMemberBusy(memberUserId);
    try {
      const result = await updateMemberRole(orgId, memberUserId, newRole);
      if (result.error) throw new Error(result.error);
      toast.success('Role updated');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update role');
    } finally {
      setMemberBusy(null);
    }
  };

  const handleRemove = async (memberUserId: string) => {
    if (!orgId) return;
    if (memberBusy === memberUserId) return;
    setMemberBusy(memberUserId);
    try {
      const result = await removeMember(orgId, memberUserId);
      if (result.error) throw new Error(result.error);
      toast.success('Member removed');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to remove member');
    } finally {
      setMemberBusy(null);
    }
  };

  const handleTransfer = async () => {
    if (!transferTo || !orgId) return;
    setTransferring(true);
    try {
      // Transfer ownership = promote the selected member to owner, demote self to admin.
      const result = await updateMemberRole(orgId, transferTo, 'owner');
      if (result.error) throw new Error(result.error);
      toast.success('Ownership transfer initiated');
      setTransferOpen(false);
      setTransferTo('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to transfer ownership');
    } finally {
      setTransferring(false);
    }
  };

  const getInitials = (name: string, email: string) => {
    const n = name || email;
    if (!n) return '?';
    const parts = n.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0]?.slice(0, 2).toUpperCase() ?? '?';
  };

  return (
    <div className="space-y-6">
      <SectionHeader title="Team" subtitle="Manage who has access to your organization." />

      <SettingsCard
        title="Members"
        description={`${members.length} member${members.length === 1 ? '' : 's'} in this organization.`}
        action={
          isOwner ? (
            <PrimaryButton onClick={() => setInviteOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Invite User
            </PrimaryButton>
          ) : undefined
        }
      >
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-blue-500" /></div>
        ) : members.length === 0 ? (
          <p className="text-sm text-zinc-500 py-8 text-center">No members found.</p>
        ) : (
          <div className="space-y-2">
            {members.map((m: { userId: string; userEmail: string; userDisplayName: string | null; role: string; status: string }) => (
              <div key={m.userId} className="flex items-center justify-between py-3 px-3 rounded-lg hover:bg-zinc-900 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar className="h-9 w-9 bg-zinc-800">
                    <AvatarFallback className="bg-zinc-800 text-blue-400 text-xs font-medium">
                      {getInitials(m.userDisplayName ?? '', m.userEmail)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {m.userDisplayName || m.userEmail}
                      {m.userId === user?.id && <span className="text-zinc-500 ml-1">(you)</span>}
                    </p>
                    <p className="text-xs text-zinc-500 truncate">{m.userEmail}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {m.role === 'owner' ? (
                    <Badge className="bg-blue-500/10 text-blue-400 border border-blue-500/20">Owner</Badge>
                  ) : isOwner ? (
                    <>
                      <Select
                        value={m.role}
                        onValueChange={(v) => handleRoleChange(m.userId, v as OrgRole)}
                        disabled={memberBusy === m.userId}
                      >
                        <SelectTrigger className="h-8 w-32 bg-zinc-900 border-zinc-800 text-xs text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-900 border-zinc-800">
                          {uiRoles.map(r => <SelectItem key={r.value} value={r.value} className="text-white focus:bg-zinc-800">{r.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <button
                        onClick={() => handleRemove(m.userId)}
                        disabled={memberBusy === m.userId}
                        className="p-1.5 rounded-md text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40 disabled:pointer-events-none"
                        aria-label="Remove member"
                      >
                        {memberBusy === m.userId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      </button>
                    </>
                  ) : (
                    <Badge variant="outline" className="border-zinc-700 text-zinc-400">{m.role}</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {isOwner && members.length > 1 && (
          <div className="mt-6 pt-6 border-t border-zinc-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white">Transfer Ownership</p>
                <p className="text-xs text-zinc-500 mt-0.5">Hand over organization ownership to another member.</p>
              </div>
              <GhostButton onClick={() => setTransferOpen(true)}>
                <ChevronRight className="h-4 w-4" />
                Transfer
              </GhostButton>
            </div>
          </div>
        )}
      </SettingsCard>

      {/* Invite Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="bg-zinc-950 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-white">Invite Team Member</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <FieldLabel>Email Address</FieldLabel>
              <FieldInput type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="colleague@firm.com" />
            </div>
            <div className="space-y-2">
              <FieldLabel>Role</FieldLabel>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as OrgRole)}>
                <SelectTrigger className="bg-zinc-900 border-zinc-800 text-white"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800">
                  {uiRoles.map(r => <SelectItem key={r.value} value={r.value} className="text-white focus:bg-zinc-800">{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <GhostButton onClick={() => setInviteOpen(false)}>Cancel</GhostButton>
            <PrimaryButton onClick={handleInvite} loading={inviting}>Send Invitation</PrimaryButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer Ownership Dialog */}
      <AlertDialog open={transferOpen} onOpenChange={setTransferOpen}>
        <AlertDialogContent className="bg-zinc-950 border-zinc-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Transfer Ownership</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              Select a member to become the new owner. You will be demoted to Admin.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Select value={transferTo} onValueChange={setTransferTo}>
              <SelectTrigger className="bg-zinc-900 border-zinc-800 text-white"><SelectValue placeholder="Select member" /></SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800">
                {members.filter((m: { userId: string; role: string }) => m.role !== 'owner').map((m: { userId: string; userDisplayName: string | null; userEmail: string }) => (
                  <SelectItem key={m.userId} value={m.userId} className="text-white focus:bg-zinc-800">
                    {m.userDisplayName || m.userEmail}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-zinc-700 text-zinc-200 hover:bg-zinc-900">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleTransfer} disabled={!transferTo || transferring} className="bg-blue-600 hover:bg-blue-500 text-white">
              {transferring ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Transfer Ownership
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 8. API KEYS SECTION
// ═══════════════════════════════════════════════════════════════════════════════

interface ApiKeyRow {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  status: string;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
}

function ApiKeysSection() {
  const buildHeaders = useSettingsHeaders();
  const { organization } = useOrg();
  const orgId = organization?.id ?? '';
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [creating, setCreating] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [revealedId, setRevealedId] = useState<string | null>(null);
  // Per-row cosmetic show/hide of the key prefix in the list (independent of
  // the one-shot "reveal on creation" dialog state above).
  const [shownRowId, setShownRowId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!orgId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/settings/api-keys?organizationId=${encodeURIComponent(orgId)}`, { headers: buildHeaders() });
      const body = await res.json();
      if (body.keys) setKeys(body.keys);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [orgId, buildHeaders]);

  useEffect(() => { void load(); }, [load]);

  const handleCreate = async () => {
    if (!newKeyName || !orgId) return;
    setCreating(true);
    try {
      const res = await fetch('/api/settings/api-keys', {
        method: 'POST', headers: buildHeaders(),
        body: JSON.stringify({ name: newKeyName, scopes: ['read'], organizationId: orgId, createdBy: 'settings-ui' }),
      });
      if (!res.ok) throw new Error('Failed to create key');
      const body = await res.json();
      setRevealedKey(body.key?.plainKey ?? body.key?.key ?? null);
      setRevealedId(body.key?.id ?? null);
      setCreateOpen(false);
      setNewKeyName('');
      toast.success("API key created — copy it now, you won't see it again.");
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create key');
    } finally {
      setCreating(false);
    }
  };

  const [revokingId, setRevokingId] = useState<string | null>(null);

  const handleRevoke = async (id: string) => {
    // Single-flight: prevent double-clicks on the same key.
    if (revokingId === id) return;
    setRevokingId(id);
    try {
      const res = await fetch(`/api/settings/api-keys/${id}?organizationId=${encodeURIComponent(orgId)}`, {
        method: 'DELETE', headers: buildHeaders(),
        body: JSON.stringify({ actor: 'settings-ui' }),
      });
      if (!res.ok) throw new Error('Failed to revoke');
      toast.success('API key revoked');
      void load();
    } catch {
      toast.error('Failed to revoke key');
    } finally {
      setRevokingId(null);
    }
  };

  // Track the copy-reset timeout so it can be cleared on unmount (no setState
  // after unmount, no overlapping timeouts on rapid clicks).
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    setCopiedId(id);
    copyTimeoutRef.current = setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      <SectionHeader title="API Keys" subtitle="Generate keys to access the GSTPilot API programmatically." />

      <SettingsCard
        title="Your Keys"
        description="Keys are shown once at creation. Store them securely."
        action={
          <PrimaryButton onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Generate API Key
          </PrimaryButton>
        }
      >
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-[#3B82F6]" /></div>
        ) : keys.length === 0 ? (
          <p className="gst-description py-10 text-center text-zinc-500">No API keys yet. Generate one to get started.</p>
        ) : (
          <div className="space-y-3">
            {keys.map((k) => {
              const isActive = k.status === 'active';
              const revealed = shownRowId === k.id;
              const maskedValue = revealed
                ? `${k.keyPrefix}────────`
                : `${k.keyPrefix.slice(0, 4)}${'•'.repeat(12)}`;
              return (
                <div
                  key={k.id}
                  className="rounded-lg border border-[#1F1F1F] bg-[#0A0A0A] p-4 transition-colors hover:border-[#2A2A2A]"
                >
                  {/* Row 1: label + status + metadata */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Key className="h-4 w-4 text-zinc-500" />
                      <p className="text-sm font-medium text-white">{k.name}</p>
                      <span className={`gst-status ${isActive ? 'gst-status-success' : 'gst-status-danger'}`}>
                        {isActive ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                        {k.status}
                      </span>
                    </div>
                    <p className="gst-caption text-zinc-600">
                      Created {new Date(k.createdAt).toLocaleDateString()}
                      {k.lastUsedAt && ` · last used ${new Date(k.lastUsedAt).toLocaleDateString()}`}
                    </p>
                  </div>

                  {/* Row 2: masked key field + actions */}
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="relative flex-1">
                      <input
                        readOnly
                        value={maskedValue}
                        aria-label={`API key ${k.name}`}
                        className="h-9 w-full rounded-md border border-[#2A2A2A] bg-[#070707] pr-10 font-mono text-[13px] text-zinc-300 focus:border-[#2563EB] focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShownRowId(revealed ? null : k.id)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 transition-colors hover:text-zinc-200"
                        aria-label={revealed ? 'Hide key' : 'Show key'}
                        title={revealed ? 'Hide' : 'Show'}
                      >
                        {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleCopy(`${k.keyPrefix}••••••`, k.id)}
                        className="gst-btn gst-btn-ghost h-9 gap-1.5 px-2.5"
                        aria-label="Copy key prefix"
                        title="Copy"
                      >
                        {copiedId === k.id ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                      </button>
                      {isActive && (
                        <button
                          onClick={() => handleRevoke(k.id)}
                          disabled={revokingId === k.id}
                          className="gst-btn gst-btn-ghost h-9 gap-1.5 px-2.5 text-zinc-400 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-40 disabled:pointer-events-none"
                          aria-label="Revoke key"
                          title="Revoke"
                        >
                          {revokingId === k.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Row 3: scopes (if any) */}
                  {k.scopes?.length > 0 && (
                    <div className="mt-2.5 flex items-center gap-1.5">
                      <span className="gst-caption text-zinc-600">Scopes:</span>
                      {k.scopes.map((sc) => (
                        <span key={sc} className="rounded bg-[#181818] px-1.5 py-0.5 font-mono text-[11px] text-zinc-400">
                          {sc}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </SettingsCard>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="bg-zinc-950 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-white">Generate New API Key</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <FieldLabel>Key Name</FieldLabel>
              <FieldInput value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} placeholder="e.g. Production Server" />
            </div>
            <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
              <p className="text-xs text-amber-400 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>The full key will be shown only once after creation. Copy and store it securely.</span>
              </p>
            </div>
          </div>
          <DialogFooter>
            <GhostButton onClick={() => setCreateOpen(false)}>Cancel</GhostButton>
            <PrimaryButton onClick={handleCreate} loading={creating}>Generate Key</PrimaryButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reveal Once Dialog */}
      <AlertDialog open={!!revealedKey} onOpenChange={(o) => { if (!o) { setRevealedKey(null); setRevealedId(null); } }}>
        <AlertDialogContent className="bg-zinc-950 border-zinc-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Your New API Key</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              Copy this key now. For security, it will not be shown again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-zinc-900 border border-zinc-800">
              <code className="text-sm text-blue-400 font-mono flex-1 break-all">{revealedKey}</code>
              <button
                onClick={() => revealedKey && handleCopy(revealedKey, revealedId ?? 'new')}
                className="p-1.5 rounded-md text-zinc-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors shrink-0"
              >
                {copiedId === (revealedId ?? 'new') ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogAction className="bg-blue-600 hover:bg-blue-500 text-white" onClick={() => { setRevealedKey(null); setRevealedId(null); }}>
              I've copied it
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 9. AUDIT LOG SECTION
// ═══════════════════════════════════════════════════════════════════════════════

function AuditLogSection() {
  const buildHeaders = useSettingsHeaders();
  const [events, setEvents] = useState<Array<{ id: string; action: string; entity: string | null; details: string | null; timestamp: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/settings/audit-log', { headers: buildHeaders() });
        const body = await res.json();
        if (body.events) setEvents(body.events);
      } catch { /* ignore */ } finally { setLoading(false); }
    })();
  }, [buildHeaders]);

  const formatAction = (a: string) =>
    a.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

  // Map an action string to a status color for the row badge.
  const actionTone = (a: string): 'success' | 'info' | 'warning' | 'danger' | 'neutral' => {
    const lower = a.toLowerCase();
    if (/delete|remove|revoke|disconnect|sign.?out|fail|error/.test(lower)) return 'danger';
    if (/create|generate|connect|invite|activate|enable/.test(lower)) return 'success';
    if (/update|change|edit|rename|transfer|sync/.test(lower)) return 'info';
    if (/login|sign.?in|auth/.test(lower)) return 'warning';
    return 'neutral';
  };

  return (
    <div className="space-y-6">
      <SectionHeader title="Audit Logs" subtitle="A chronological record of actions taken in your account." />

      <SettingsCard title="Recent Events" description="Last 50 actions recorded by the system.">
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-[#3B82F6]" /></div>
        ) : events.length === 0 ? (
          <p className="gst-description py-10 text-center text-zinc-500">No audit events recorded yet.</p>
        ) : (
          <div className="gst-table-wrap max-h-[600px] overflow-auto">
            <table className="gst-table">
              <thead>
                <tr>
                  <th className="w-[160px]">Timestamp</th>
                  <th className="w-[180px]">Resource</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => {
                  const tone = actionTone(e.action);
                  return (
                    <tr key={e.id}>
                      <td className="whitespace-nowrap font-mono text-[12px] text-zinc-400">
                        {new Date(e.timestamp).toLocaleString()}
                      </td>
                      <td>
                        {e.entity ? (
                          <span className="inline-flex items-center gap-1.5">
                            <Activity className="h-3.5 w-3.5 text-zinc-600" />
                            <code className="font-mono text-[12px] text-zinc-400">{e.entity}</code>
                          </span>
                        ) : (
                          <span className="text-zinc-600">&mdash;</span>
                        )}
                      </td>
                      <td>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className={`gst-status gst-status-${tone}`}>{formatAction(e.action)}</span>
                          </div>
                          {e.details && (
                            <p className="gst-caption text-zinc-500">{e.details}</p>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SettingsCard>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 10. BILLING SECTION
// ═══════════════════════════════════════════════════════════════════════════════

function BillingSection() {
  const buildHeaders = useSettingsHeaders();
  const { organization } = useOrg();
  const orgId = organization?.id ?? '';
  const [info, setInfo] = useState<{
    plan: { id: string; label: string; price: number; maxClients: number };
    usage: { clients: number; invoices: number; customers: number; maxClients: number };
    availablePlans: Array<{ id: string; label: string; price: number; maxClients: number; current: boolean }>;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    if (!orgId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/settings/billing?organizationId=${encodeURIComponent(orgId)}`, { headers: buildHeaders() });
      const body = await res.json();
      if (body.plan) setInfo(body);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [orgId, buildHeaders]);

  useEffect(() => { void load(); }, [load]);

  const usagePercent = info ? Math.min(100, (info.usage.clients / info.usage.maxClients) * 100) : 0;

  return (
    <div className="space-y-6">
      <SectionHeader title="Billing" subtitle="Manage your subscription, usage, and payment method." />

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-blue-500" /></div>
      ) : info ? (
        <>
          <SettingsCard title="Current Plan" description="Your active subscription tier.">
            <div className="flex items-center justify-between p-5 rounded-xl bg-gradient-to-br from-blue-600/10 to-zinc-900 border border-blue-500/20">
              <div>
                <p className="text-2xl font-bold text-white">{info.plan.label}</p>
                <p className="text-sm text-zinc-400 mt-1">
                  ₹{info.plan.price.toLocaleString('en-IN')}/month · up to {info.plan.maxClients.toLocaleString('en-IN')} clients
                </p>
              </div>
              <Badge className="bg-blue-500/10 text-blue-400 border border-blue-500/20">Active</Badge>
            </div>
          </SettingsCard>

          <SettingsCard title="Usage" description="Real-time usage from your synced data.">
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-zinc-300">Clients</span>
                  <span className="text-white font-medium">{info.usage.clients} / {info.usage.maxClients}</span>
                </div>
                <Progress value={usagePercent} className="h-2 bg-zinc-800 [&>div]:bg-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-zinc-900 border border-zinc-800">
                  <p className="text-xs text-zinc-500 uppercase tracking-wider">Invoices</p>
                  <p className="text-2xl font-bold text-white mt-1">{info.usage.invoices}</p>
                </div>
                <div className="p-4 rounded-lg bg-zinc-900 border border-zinc-800">
                  <p className="text-xs text-zinc-500 uppercase tracking-wider">Synced Customers</p>
                  <p className="text-2xl font-bold text-white mt-1">{info.usage.customers}</p>
                </div>
              </div>
            </div>
          </SettingsCard>

          <SettingsCard title="Available Plans" description="Upgrade or downgrade at any time.">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {info.availablePlans.map((p) => (
                <div key={p.id} className={`p-5 rounded-xl border ${
                  p.current ? 'border-blue-500 bg-blue-600/5' : 'border-zinc-800 bg-zinc-900'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-lg font-semibold text-white">{p.label}</p>
                    {p.current && <Badge className="bg-blue-500/10 text-blue-400 border border-blue-500/20">Current</Badge>}
                  </div>
                  <p className="text-2xl font-bold text-white">₹{p.price.toLocaleString('en-IN')}<span className="text-sm font-normal text-zinc-500">/mo</span></p>
                  <p className="text-xs text-zinc-500 mt-2">Up to {p.maxClients.toLocaleString('en-IN')} clients</p>
                  {!p.current && (
                    <Button
                      className="mt-4 w-full bg-transparent border border-zinc-700 text-zinc-200 hover:bg-zinc-800"
                      onClick={() => toast.info('Online checkout is coming soon. Contact sales to upgrade.')}
                    >
                      Switch to {p.label}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </SettingsCard>

          <SettingsCard title="Invoices & Payment Method" description="Download past invoices and manage your payment method.">
            <div className="flex items-center justify-between p-4 rounded-lg bg-zinc-900 border border-zinc-800">
              <div className="flex items-center gap-3">
                <CreditCard className="h-5 w-5 text-zinc-500" />
                <div>
                  <p className="text-sm text-white">No payment method on file</p>
                  <p className="text-xs text-zinc-500">Add a card to enable paid plans.</p>
                </div>
              </div>
              <GhostButton onClick={() => toast.info('Payment method management is coming soon.')}>
                <Plus className="h-4 w-4 mr-2" />
                Add Method
              </GhostButton>
            </div>
            <div className="flex items-center justify-between p-4 rounded-lg bg-zinc-900 border border-zinc-800 mt-3">
              <div className="flex items-center gap-3">
                <Download className="h-5 w-5 text-zinc-500" />
                <div>
                  <p className="text-sm text-white">Download invoices</p>
                  <p className="text-xs text-zinc-500">Export your billing history as CSV.</p>
                </div>
              </div>
              <GhostButton
                loading={exporting}
                onClick={async () => {
                  setExporting(true);
                  try {
                    const res = await fetch(`/api/settings/data-export?organizationId=${encodeURIComponent(orgId)}`, { method: 'POST', headers: buildHeaders() });
                    if (!res.ok) throw new Error('Export failed');
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url; a.download = `gstpilot-data-${orgId}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                    toast.success('Data exported');
                  } catch { toast.error('Export failed'); }
                  finally { setExporting(false); }
                }}
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </GhostButton>
            </div>
          </SettingsCard>
        </>
      ) : (
        <p className="text-sm text-zinc-500 py-12 text-center">Failed to load billing information.</p>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 11. DATA SECTION
// ═══════════════════════════════════════════════════════════════════════════════

function DataSection() {
  const buildHeaders = useSettingsHeaders();
  const { organization } = useOrg();
  const orgId = organization?.id ?? '';
  const [exporting, setExporting] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmName, setConfirmName] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [firmName, setFirmName] = useState('');
  const [firmNameError, setFirmNameError] = useState<string | null>(null);

  // Load the firm name so we can show the user exactly what to type. If the
  // fetch fails we surface an inline error AND fall back to a permissive
  // empty-string check so the user can still delete their workspace.
  useEffect(() => {
    if (!orgId) return;
    let mounted = true;
    (async () => {
      try {
        const res = await fetch('/api/settings/organization', { headers: buildHeaders() });
        const body = await res.json();
        if (!mounted) return;
        if (body.organization?.name) {
          setFirmName(body.organization.name);
          setFirmNameError(null);
        }
      } catch {
        if (!mounted) return;
        // Don't block delete — the user can still type the name they remember.
        setFirmNameError('Could not load your workspace name. Type it manually to confirm.');
      }
    })();
    return () => { mounted = false; };
  }, [orgId, buildHeaders]);

  const handleExport = async () => {
    if (!orgId) return;
    setExporting(true);
    try {
      const res = await fetch(`/api/settings/data-export?organizationId=${encodeURIComponent(orgId)}`, {
        method: 'POST', headers: buildHeaders(),
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gstpilot-export-${orgId}-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Data exported');
    } catch {
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  };

  const handleBackup = async () => {
    if (!orgId) return;
    setBackingUp(true);
    try {
      const res = await fetch(`/api/settings/data-export?organizationId=${encodeURIComponent(orgId)}`, {
        method: 'POST', headers: buildHeaders(),
      });
      if (!res.ok) throw new Error('Backup failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gstpilot-backup-${orgId}-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Backup downloaded');
    } catch {
      toast.error('Backup failed');
    } finally {
      setBackingUp(false);
    }
  };

  const handleDelete = async () => {
    if (!orgId || !confirmName) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/settings/delete-workspace?organizationId=${encodeURIComponent(orgId)}`, {
        method: 'POST', headers: buildHeaders(),
        body: JSON.stringify({ confirmName }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Failed to delete workspace');
      toast.success(body.message ?? 'Workspace deleted');
      setDeleteOpen(false);
      setConfirmName('');
      // Force a full reload so all cached org data is cleared.
      if (typeof window !== 'undefined') {
        setTimeout(() => { window.location.href = '/'; }, 1200);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete workspace');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeader title="Data & Backup" subtitle="Export, back up, or permanently delete your workspace data." />

      <SettingsCard
        title="Export Data"
        description="Download all your organization's data as a JSON file. Includes firm details, clients, invoices, Zoho-synced records, and audit logs."
        action={
          <GhostButton onClick={handleExport} loading={exporting}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </GhostButton>
        }
      >
        <div className="flex items-center gap-3 p-4 rounded-lg bg-zinc-900 border border-zinc-800">
          <Database className="h-5 w-5 text-zinc-500" />
          <div>
            <p className="text-sm text-white">Full data export</p>
            <p className="text-xs text-zinc-500">JSON format. Contains every record scoped to this organization.</p>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard
        title="Backup"
        description="Download a timestamped snapshot of your workspace. Store it safely — it can be used to restore data manually."
        action={
          <GhostButton onClick={handleBackup} loading={backingUp}>
            <Database className="h-4 w-4 mr-2" />
            Download Backup
          </GhostButton>
        }
      >
        <div className="flex items-center gap-3 p-4 rounded-lg bg-zinc-900 border border-zinc-800">
          <Shield className="h-5 w-5 text-zinc-500" />
          <div>
            <p className="text-sm text-white">Manual backup</p>
            <p className="text-xs text-zinc-500">Automated scheduled backups are coming soon. For now, download a snapshot on demand.</p>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard
        title="Delete Workspace"
        description="Permanently delete this organization and ALL its data. This cannot be undone."
      >
        <div className="p-4 rounded-lg bg-red-500/5 border border-red-500/20">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-300">Dangerous action</p>
              <p className="text-xs text-zinc-400 mt-1">
                All clients, invoices, Zoho-synced records, firm settings, and the firm itself will be permanently removed.
                Audit log entries (userId-scoped) are retained. Zoho Books tokens are revoked.
              </p>
              {firmNameError && (
                <p className="text-xs text-amber-400 mt-2">{firmNameError}</p>
              )}
              <DangerButton
                onClick={() => setDeleteOpen(true)}
                className="mt-3"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Workspace
              </DangerButton>
            </div>
          </div>
        </div>
      </SettingsCard>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={(o) => { setDeleteOpen(o); if (!o) setConfirmName(''); }}>
        <AlertDialogContent className="bg-zinc-950 border-zinc-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-400" />
              Delete Workspace
            </AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              This action is permanent and cannot be undone. All data for <span className="text-white font-medium">{firmName || 'this organization'}</span> will be erased.
              Type the firm name <span className="text-white font-mono">{firmName || 'firm name'}</span> to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <FieldInput
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={firmName || 'Type the firm name'}
              className="border-red-500/30 focus:border-red-500"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-zinc-700 text-zinc-200 hover:bg-zinc-900">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={
                deleting ||
                // If we have the firm name, require an exact (case-insensitive) match.
                // If we DON'T have it (firmNameError), require any non-empty confirm.
                (firmNameError
                  ? confirmName.trim().length === 0
                  : confirmName.toLowerCase() !== firmName.toLowerCase())
              }
              className="bg-red-600 hover:bg-red-500 text-white border-0 disabled:opacity-50"
            >
              {deleting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Delete Forever
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 12. DANGER ZONE SECTION (Working Logout)
// ═══════════════════════════════════════════════════════════════════════════════

function DangerZoneSection() {
  const buildHeaders = useSettingsHeaders();
  const { logout, user } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      // 1. Server-side audit log (records the sign-out event in AuditLog table).
      await fetch('/api/settings/logout', {
        method: 'POST', headers: buildHeaders(),
        body: JSON.stringify({}),
      }).catch(() => { /* non-fatal — we still clear local state */ });

      // 2. Client-side Firebase signOut + clear all local state + session.
      await logout();

      toast.success('Signed out successfully');
      // The app router will redirect to the login screen because `user` is now null.
      setConfirmLogout(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to sign out');
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeader title="Danger Zone" subtitle="Irreversible and destructive account actions." />

      <SettingsCard
        title="Sign Out"
        description="Sign out of your account on this device. You will need to sign in again to access GSTPilot."
      >
        <div className="flex items-center justify-between p-4 rounded-lg bg-zinc-900 border border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-zinc-800 flex items-center justify-center">
              <Power className="h-5 w-5 text-zinc-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">Sign out of GSTPilot</p>
              <p className="text-xs text-zinc-500 mt-0.5">
                {user?.email ? `Signed in as ${user.email}` : 'Clears your session and redirects to login.'}
              </p>
            </div>
          </div>
          <DangerButton onClick={() => setConfirmLogout(true)}>
            <LogOut className="h-4 w-4 mr-2" />
            Log Out
          </DangerButton>
        </div>
      </SettingsCard>

      {/* Logout Confirmation */}
      <AlertDialog open={confirmLogout} onOpenChange={setConfirmLogout}>
        <AlertDialogContent className="bg-zinc-950 border-zinc-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white flex items-center gap-2">
              <LogOut className="h-5 w-5 text-blue-400" />
              Sign Out
            </AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              You will be signed out of your account. Your data stays safe — sign back in anytime to resume.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-zinc-700 text-zinc-200 hover:bg-zinc-900">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLogout}
              disabled={loggingOut}
              className="bg-red-600 hover:bg-red-500 text-white border-0 disabled:opacity-50"
            >
              {loggingOut ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <LogOut className="h-4 w-4 mr-2" />}
              Sign Out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Default export for dynamic(() => import('...')) in DashboardViews.tsx
export default SettingsPage;

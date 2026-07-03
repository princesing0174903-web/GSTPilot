'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Palette,
  Upload,
  Globe,
  Mail,
  Save,
  CheckCircle2,
  AlertCircle,
  Eye,
  ImageIcon,
  X,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  uploadFile,
  validateFile,
  friendlyStorageError,
} from '@/lib/firebase/storage-service';
import { useOrg } from '@/contexts/OrgContext';

// ─── Color Palette (Emerald/Teal — NO blue/indigo) ────────────────────────
const COLORS = {
  emerald: '#10b981',
  emeraldDark: '#059669',
  teal: '#14b8a6',
  amber: '#f59e0b',
  red: '#ef4444',
  slate: '#64748b',
};

// ─── Types ────────────────────────────────────────────────────────────────
interface FirmSettingsData {
  id?: string;
  firmName: string;
  logoUrl: string | null;
  primaryColor: string;
  accentColor: string;
  customDomain: string | null;
  emailFromName: string | null;
  emailTemplate: string | null;
}

type DomainStatus = 'not_configured' | 'pending' | 'active';

const DEFAULT_SETTINGS: FirmSettingsData = {
  firmName: 'GSTPilot Firm',
  logoUrl: null,
  primaryColor: '#059669',
  accentColor: '#7c3aed',
  customDomain: null,
  emailFromName: null,
  emailTemplate: null,
};

const EMAIL_TEMPLATE_OPTIONS = [
  { value: 'filing_confirmation', label: 'Filing Confirmation' },
  { value: 'notice_alert', label: 'Notice Alert' },
  { value: 'monthly_report', label: 'Monthly Report' },
];

// ─── Animated Card Wrapper ─────────────────────────────────────────────────
function AnimatedCard({
  children,
  delay = 0,
  className = '',
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5, ease: 'easeOut' }}
    >
      <Card
        className={`hover:shadow-lg hover:shadow-emerald-500/5 transition-all duration-300 border-border/50 backdrop-blur-sm bg-card/80 ${className}`}
      >
        {children}
      </Card>
    </motion.div>
  );
}

// ─── Skeleton Loaders ──────────────────────────────────────────────────────
function SettingsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Skeleton className="h-72 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </div>
  );
}

// ─── Live Preview Component ───────────────────────────────────────────────
function LivePreview({
  firmName,
  primaryColor,
  accentColor,
  logoUrl,
}: {
  firmName: string;
  primaryColor: string;
  accentColor: string;
  logoUrl: string | null;
}) {
  return (
    <div className="space-y-3">
      {/* Mock Sidebar */}
      <div className="rounded-xl border border-border/50 overflow-hidden shadow-sm">
        <div
          className="p-3 flex items-center gap-2"
          style={{ backgroundColor: primaryColor }}
        >
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="Firm Logo"
              className="h-6 w-6 rounded object-cover"
            />
          ) : (
            <div className="h-6 w-6 rounded bg-white/20 flex items-center justify-center">
              <Palette className="h-3.5 w-3.5 text-white" />
            </div>
          )}
          <span className="text-sm font-bold text-white truncate">
            {firmName || 'Your Firm'}
          </span>
        </div>
        <div className="bg-muted/30 p-2 space-y-1.5">
          {['Dashboard', 'Clients', 'Filing', 'Reports'].map((item, i) => (
            <div
              key={item}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-xs ${
                i === 0 ? 'font-medium' : 'text-muted-foreground'
              }`}
              style={
                i === 0
                  ? {
                      backgroundColor: `${primaryColor}15`,
                      color: primaryColor,
                    }
                  : undefined
              }
            >
              <div
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: i === 0 ? primaryColor : COLORS.slate }}
              />
              {item}
            </div>
          ))}
        </div>
      </div>

      {/* Mock Card Preview */}
      <div className="rounded-xl border border-border/50 overflow-hidden shadow-sm">
        <div className="p-3 border-b border-border/30">
          <div className="flex items-center gap-2">
            <div
              className="h-2 w-2 rounded-full animate-pulse"
              style={{ backgroundColor: accentColor }}
            />
            <span className="text-xs font-semibold text-foreground">
              Client Health Report
            </span>
          </div>
        </div>
        <div className="p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">
              Compliance Score
            </span>
            <span
              className="text-xs font-bold"
              style={{ color: primaryColor }}
            >
              87%
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted/30 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: '87%', backgroundColor: primaryColor }}
            />
          </div>
          <div className="flex gap-1.5 mt-1">
            {['Active', 'Pending', 'Filed'].map((tag, i) => (
              <span
                key={tag}
                className="text-[9px] font-medium px-1.5 py-0.5 rounded-full"
                style={{
                  backgroundColor:
                    i === 0
                      ? `${primaryColor}15`
                      : i === 1
                        ? `${accentColor}15`
                        : `${COLORS.slate}15`,
                  color:
                    i === 0
                      ? primaryColor
                      : i === 1
                        ? accentColor
                        : COLORS.slate,
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Mock Button Preview */}
      <div className="flex gap-2">
        <button
          className="text-[10px] font-medium px-3 py-1.5 rounded-lg text-white transition-colors"
          style={{ backgroundColor: primaryColor }}
        >
          Primary Action
        </button>
        <button
          className="text-[10px] font-medium px-3 py-1.5 rounded-lg border transition-colors"
          style={{ borderColor: accentColor, color: accentColor }}
        >
          Secondary
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
export default function WhiteLabelPage() {
  // ── State ────────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<FirmSettingsData>(DEFAULT_SETTINGS);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [domainStatus, setDomainStatus] = useState<DomainStatus>('not_configured');
  const [logoUploading, setLogoUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Organization (required for org-scoped Firebase Storage uploads) ──
  const { organization } = useOrg();

  // ── Data Fetching ────────────────────────────────────────────────────────
  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/firm-settings');
      if (res.ok) {
        const data = await res.json();
        const s = data.settings || data;
        setSettings({
          firmName: s.firmName ?? DEFAULT_SETTINGS.firmName,
          logoUrl: s.logoUrl ?? DEFAULT_SETTINGS.logoUrl,
          primaryColor: s.primaryColor ?? DEFAULT_SETTINGS.primaryColor,
          accentColor: s.accentColor ?? DEFAULT_SETTINGS.accentColor,
          customDomain: s.customDomain ?? DEFAULT_SETTINGS.customDomain,
          emailFromName: s.emailFromName ?? DEFAULT_SETTINGS.emailFromName,
          emailTemplate: s.emailTemplate ?? DEFAULT_SETTINGS.emailTemplate,
        });
        if (s.logoUrl) setLogoPreview(s.logoUrl);
        if (s.customDomain) {
          setDomainStatus('active');
        }
      }
    } catch (err) {
      console.error('Failed to fetch firm settings:', err);
      toast.error('Failed to load settings', {
        description: 'Using default values. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleSave = async () => {
    try {
      setSaving(true);
      const res = await fetch('/api/firm-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firmName: settings.firmName,
          logoUrl: settings.logoUrl,
          primaryColor: settings.primaryColor,
          accentColor: settings.accentColor,
          customDomain: settings.customDomain,
          emailFromName: settings.emailFromName,
          emailTemplate: settings.emailTemplate,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const s = data.settings || data;
        setSettings((prev) => ({
          ...prev,
          id: s.id,
          firmName: s.firmName ?? prev.firmName,
          logoUrl: s.logoUrl ?? prev.logoUrl,
          primaryColor: s.primaryColor ?? prev.primaryColor,
          accentColor: s.accentColor ?? prev.accentColor,
          customDomain: s.customDomain ?? prev.customDomain,
          emailFromName: s.emailFromName ?? prev.emailFromName,
          emailTemplate: s.emailTemplate ?? prev.emailTemplate,
        }));
        toast.success('Settings saved successfully', {
          description: 'Your white label branding has been updated.',
          icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
        });
      } else {
        throw new Error('Failed to save');
      }
    } catch {
      toast.error('Failed to save settings', {
        description: 'Please check your inputs and try again.',
        icon: <AlertCircle className="h-4 w-4 text-red-500" />,
      });
    } finally {
      setSaving(false);
    }
  };

  // ── Real Firebase Storage upload for the firm logo ──
  // Logos are branding assets (not "documents"), so we use the lower-level
  // uploadFile() from storage-service directly — no `documents` collection
  // entry is created. The upload is org-scoped via organization.id.
  const uploadLogoFile = async (file: File) => {
    if (logoUploading) return; // Prevent double-upload
    if (!organization?.id) {
      toast.error('No organization', {
        description: 'Please sign in to an organization to upload a logo.',
      });
      return;
    }

    // Pre-flight validation: 100MB max + PNG/JPG/JPEG only (matches Storage rules)
    const validationError = validateFile(file);
    if (validationError) {
      toast.error('Invalid file', {
        description: validationError,
      });
      return;
    }

    setLogoUploading(true);
    const toastId = toast.loading('Uploading logo...', {
      description: 'Your logo is being uploaded to secure storage.',
    });

    try {
      const result = await uploadFile(file, {
        organizationId: organization.id,
        category: 'documents',
        customMetadata: { purpose: 'logo' },
      });

      setLogoPreview(result.downloadURL);
      setSettings((prev) => ({ ...prev, logoUrl: result.downloadURL }));
      toast.success('Logo uploaded', {
        id: toastId,
        description: 'Save changes to apply your new branding.',
        icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : friendlyStorageError(err);
      toast.error('Upload failed', {
        id: toastId,
        description: message,
        icon: <AlertCircle className="h-4 w-4 text-red-500" />,
      });
    } finally {
      setLogoUploading(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    void uploadLogoFile(file);
  };

  const handleRemoveLogo = () => {
    setLogoPreview(null);
    setSettings((prev) => ({ ...prev, logoUrl: null }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      void uploadLogoFile(file);
    }
  };

  const getDomainStatusDisplay = () => {
    switch (domainStatus) {
      case 'active':
        return (
          <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200 gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Active
          </Badge>
        );
      case 'pending':
        return (
          <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200 gap-1">
            <AlertCircle className="h-3 w-3" />
            Pending
          </Badge>
        );
      default:
        return (
          <Badge className="bg-slate-50 text-slate-600 hover:bg-slate-100 border-slate-200 gap-1">
            <Globe className="h-3 w-3" />
            Not Configured
          </Badge>
        );
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Skeleton className="h-10 w-64 mb-2" />
          <Skeleton className="h-4 w-48" />
        </motion.div>
        <SettingsSkeleton />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* ═══ PAGE HEADER ═══ */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-md shadow-emerald-600/20">
            <Palette className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
              White Label Settings
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Customize your firm&apos;s branding and appearance
            </p>
          </div>
        </div>
        <Badge
          variant="outline"
          className="gap-1.5 px-3 py-1.5 w-fit border-emerald-200 text-emerald-700 bg-emerald-50/80 dark:border-emerald-800 dark:text-emerald-400 dark:bg-emerald-950/40 font-medium"
        >
          <Eye className="h-3.5 w-3.5" />
          Live Preview
        </Badge>
      </motion.div>

      {/* ═══ MAIN CONTENT: Settings + Preview ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* ─── LEFT: Settings Cards ─── */}
        <div className="lg:col-span-2 space-y-4">
          {/* Firm Branding Section */}
          <AnimatedCard delay={0.05}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Palette className="h-5 w-5 text-emerald-500" />
                Firm Branding
              </CardTitle>
              <CardDescription>
                Configure your firm name, logo, and brand colors
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Firm Name */}
              <div className="space-y-2">
                <Label htmlFor="firmName" className="text-sm font-medium">
                  Firm Name
                </Label>
                <Input
                  id="firmName"
                  value={settings.firmName}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, firmName: e.target.value }))
                  }
                  placeholder="Enter your firm name"
                  className="transition-all duration-200 focus:ring-2 focus:ring-emerald-500/20"
                />
                <p className="text-xs text-muted-foreground">
                  This name will appear in the sidebar and all client-facing pages
                </p>
              </div>

              <Separator />

              {/* Logo Upload */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Firm Logo</Label>
                <div
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  className="relative"
                >
                  {logoPreview ? (
                    <div className="flex items-center gap-4 p-4 rounded-xl border border-border/50 bg-muted/20">
                      <div className="h-16 w-16 rounded-xl overflow-hidden border border-border/50 shadow-sm shrink-0">
                        <img
                          src={logoPreview}
                          alt="Firm Logo"
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          Logo uploaded
                        </p>
                        <p className="text-xs text-muted-foreground">
                          PNG, JPG, or JPEG — Max 100MB
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleRemoveLogo}
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <label
                      htmlFor="logo-upload"
                      className="flex flex-col items-center justify-center h-32 rounded-xl border-2 border-dashed border-border/50 bg-muted/10 hover:bg-emerald-50/30 hover:border-emerald-300 dark:hover:bg-emerald-950/10 dark:hover:border-emerald-800 transition-all cursor-pointer group"
                    >
                      <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 mb-2 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/50 transition-colors">
                        <Upload className="h-5 w-5 text-emerald-500" />
                      </div>
                      <span className="text-sm font-medium text-muted-foreground group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                        Drag &amp; drop or click to upload
                      </span>
                      <span className="text-xs text-muted-foreground/60 mt-0.5">
                        PNG, JPG, or JPEG — Max 100MB
                      </span>
                    </label>
                  )}
                  <input
                    ref={fileInputRef}
                    id="logo-upload"
                    type="file"
                    accept=".png,.jpg,.jpeg"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                </div>
              </div>

              <Separator />

              {/* Color Pickers */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Primary Color */}
                <div className="space-y-2">
                  <Label
                    htmlFor="primaryColor"
                    className="text-sm font-medium flex items-center gap-2"
                  >
                    <div
                      className="h-3 w-3 rounded-full border border-white/20 shadow-sm"
                      style={{ backgroundColor: settings.primaryColor }}
                    />
                    Primary Color
                  </Label>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <input
                        type="color"
                        id="primaryColor"
                        value={settings.primaryColor}
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            primaryColor: e.target.value,
                          }))
                        }
                        className="h-10 w-12 rounded-lg border border-border/50 cursor-pointer appearance-none bg-transparent [&::-webkit-color-swatch-wrapper]:p-1 [&::-webkit-color-swatch]:rounded-md [&::-webkit-color-swatch]:border-none"
                      />
                    </div>
                    <Input
                      value={settings.primaryColor}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) {
                          setSettings((prev) => ({
                            ...prev,
                            primaryColor: val,
                          }));
                        }
                      }}
                      placeholder="#059669"
                      className="flex-1 font-mono text-sm"
                      maxLength={7}
                    />
                  </div>
                </div>

                {/* Accent Color */}
                <div className="space-y-2">
                  <Label
                    htmlFor="accentColor"
                    className="text-sm font-medium flex items-center gap-2"
                  >
                    <div
                      className="h-3 w-3 rounded-full border border-white/20 shadow-sm"
                      style={{ backgroundColor: settings.accentColor }}
                    />
                    Accent Color
                  </Label>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <input
                        type="color"
                        id="accentColor"
                        value={settings.accentColor}
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            accentColor: e.target.value,
                          }))
                        }
                        className="h-10 w-12 rounded-lg border border-border/50 cursor-pointer appearance-none bg-transparent [&::-webkit-color-swatch-wrapper]:p-1 [&::-webkit-color-swatch]:rounded-md [&::-webkit-color-swatch]:border-none"
                      />
                    </div>
                    <Input
                      value={settings.accentColor}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) {
                          setSettings((prev) => ({
                            ...prev,
                            accentColor: val,
                          }));
                        }
                      }}
                      placeholder="#7c3aed"
                      className="flex-1 font-mono text-sm"
                      maxLength={7}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </AnimatedCard>

          {/* Domain Settings Section */}
          <AnimatedCard delay={0.1}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Globe className="h-5 w-5 text-emerald-500" />
                Domain Settings
              </CardTitle>
              <CardDescription>
                Configure your custom domain for client access
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="customDomain" className="text-sm font-medium">
                  Custom Domain
                </Label>
                <div className="flex items-center gap-0">
                  <div className="flex items-center h-10 px-3 rounded-l-lg border border-r-0 border-border/50 bg-muted/30 text-sm text-muted-foreground">
                    https://
                  </div>
                  <Input
                    id="customDomain"
                    value={settings.customDomain || ''}
                    onChange={(e) => {
                      setSettings((prev) => ({
                        ...prev,
                        customDomain: e.target.value || null,
                      }));
                      setDomainStatus(
                        e.target.value ? 'pending' : 'not_configured'
                      );
                    }}
                    placeholder="yourfirm.gstpilot.com"
                    className="rounded-l-none font-mono text-sm"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Format: yourfirm.gstpilot.com or your custom domain
                </p>
              </div>

              {/* Domain Status */}
              <div className="flex items-center justify-between p-3 rounded-xl border border-border/50 bg-muted/10">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/30">
                    <Globe className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Domain Status
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {settings.customDomain
                        ? `Pointing to ${settings.customDomain}`
                        : 'No custom domain configured'}
                    </p>
                  </div>
                </div>
                {getDomainStatusDisplay()}
              </div>
            </CardContent>
          </AnimatedCard>

          {/* Email Templates Section */}
          <AnimatedCard delay={0.15}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Mail className="h-5 w-5 text-emerald-500" />
                Email Templates
              </CardTitle>
              <CardDescription>
                Configure email branding and template preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="emailFromName" className="text-sm font-medium">
                  Email From Name
                </Label>
                <Input
                  id="emailFromName"
                  value={settings.emailFromName || ''}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      emailFromName: e.target.value || null,
                    }))
                  }
                  placeholder="Your Firm Name"
                  className="transition-all duration-200 focus:ring-2 focus:ring-emerald-500/20"
                />
                <p className="text-xs text-muted-foreground">
                  Recipients will see this name in the &quot;From&quot; field
                </p>
              </div>

              <Separator />

              <div className="space-y-3">
                <Label className="text-sm font-medium">
                  Email Template Preview
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {EMAIL_TEMPLATE_OPTIONS.map((tmpl) => (
                    <motion.div
                      key={tmpl.value}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={`p-3 rounded-xl border cursor-pointer transition-all ${
                        settings.emailTemplate === tmpl.value
                          ? 'border-emerald-300 bg-emerald-50/50 dark:border-emerald-700 dark:bg-emerald-950/30 shadow-sm'
                          : 'border-border/50 hover:border-emerald-200 dark:hover:border-emerald-800'
                      }`}
                      onClick={() =>
                        setSettings((prev) => ({
                          ...prev,
                          emailTemplate: tmpl.value,
                        }))
                      }
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Mail
                            className="h-3.5 w-3.5"
                            style={{
                              color:
                                settings.emailTemplate === tmpl.value
                                  ? settings.primaryColor
                                  : COLORS.slate,
                            }}
                          />
                          <span
                            className={`text-xs font-semibold ${
                              settings.emailTemplate === tmpl.value
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : 'text-foreground'
                            }`}
                          >
                            {tmpl.label}
                          </span>
                        </div>
                        {settings.emailTemplate === tmpl.value && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                          >
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          </motion.div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </CardContent>
          </AnimatedCard>
        </div>

        {/* ─── RIGHT: Live Preview Panel ─── */}
        <div className="space-y-4">
          <AnimatedCard delay={0.1}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Eye className="h-5 w-5 text-emerald-500" />
                Live Preview
              </CardTitle>
              <CardDescription>
                See how your branding looks in real-time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LivePreview
                firmName={settings.firmName}
                primaryColor={settings.primaryColor}
                accentColor={settings.accentColor}
                logoUrl={settings.logoUrl}
              />
            </CardContent>
          </AnimatedCard>

          {/* Color Summary */}
          <AnimatedCard delay={0.15}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Color Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/20">
                <div
                  className="h-10 w-10 rounded-lg shadow-sm border border-white/10"
                  style={{ backgroundColor: settings.primaryColor }}
                />
                <div>
                  <p className="text-xs font-semibold text-foreground">
                    Primary
                  </p>
                  <p className="text-xs text-muted-foreground font-mono">
                    {settings.primaryColor}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/20">
                <div
                  className="h-10 w-10 rounded-lg shadow-sm border border-white/10"
                  style={{ backgroundColor: settings.accentColor }}
                />
                <div>
                  <p className="text-xs font-semibold text-foreground">
                    Accent
                  </p>
                  <p className="text-xs text-muted-foreground font-mono">
                    {settings.accentColor}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-5 gap-1.5 mt-2">
                {[
                  settings.primaryColor,
                  settings.accentColor,
                  `${settings.primaryColor}99`,
                  `${settings.accentColor}99`,
                  '#f1f5f9',
                ].map((color, i) => (
                  <div
                    key={i}
                    className="aspect-square rounded-md border border-border/30 shadow-sm"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </CardContent>
          </AnimatedCard>
        </div>
      </div>

      {/* ═══ SAVE BUTTON ═══ */}
      <AnimatedCard delay={0.2}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                Changes are applied to your firm&apos;s white label branding
              </span>
            </div>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white min-w-[140px]"
            >
              {saving ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{
                      duration: 1,
                      repeat: Infinity,
                      ease: 'linear',
                    }}
                    className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full"
                  />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save Settings
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </AnimatedCard>
    </div>
  );
}

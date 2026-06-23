'use client';

import { useState, useCallback } from 'react';
import { BrandLogo } from '@/components/brand';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap,
  ArrowRight,
  ArrowLeft,
  Check,
  Building2,
  User,
  Briefcase,
  Target,
  Sparkles,
  Upload,
  Rocket,
  X,
  AlertCircle,
} from 'lucide-react';
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
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { INDIAN_STATES } from '@/lib/constants';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OnboardingData {
  fullName: string;
  email: string;
  phone: string;
  ageGroup: string;
  profession: string;
  experience: string;
  firmName: string;
  organizationType: string;
  gstin: string;
  state: string;
  stateCode: string;
  icaiMembershipNo: string;
  officeAddress: string;
  clientCount: string;
  monthlyReturns: string;
  gstServices: string[];
  painPoints: string[];
  referralSource: string;
  trialReasons: string[];
  wantsUpdates: boolean;
}

export type OnboardingDestination = 'dashboard' | 'invoices';

interface OnboardingFlowProps {
  onComplete: (data: OnboardingData, destination?: OnboardingDestination) => void;
  onSkip?: () => void;
  userEmail?: string;
  userName?: string;
  error?: string | null;
  onDismissError?: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const AGE_GROUPS = ['18-24', '25-34', '35-44', '45-54', '55+'];

const PROFESSIONS = [
  'Chartered Accountant (CA)',
  'CA Firm Owner',
  'GST Practitioner',
  'Accountant',
  'Tax Consultant',
  'Business Owner',
  'Finance Manager',
  'Student',
  'Other',
];

const EXPERIENCE_LEVELS = [
  '0-1 years',
  '1-3 years',
  '3-5 years',
  '5-10 years',
  '10+ years',
];

const ORGANIZATION_TYPES = [
  'Solo CA Practice',
  'CA Partnership Firm',
  'LLP',
  'Private Limited Company',
  'GST Consultancy',
  'Freelancer',
  'Business Owner',
];

const CLIENT_COUNTS = ['1-10', '11-25', '26-50', '51-100', '100+'];

const MONTHLY_RETURNS = ['1-50', '51-100', '101-250', '251-500', '500+'];

const GST_SERVICES = [
  'GSTR-1',
  'GSTR-3B',
  'GSTR-9',
  'GSTR-9C',
  'Reconciliation',
  'Invoice Processing',
  'ITC Management',
];

const PAIN_POINTS = [
  'Manual Excel Work',
  'Invoice Extraction',
  'GST Reconciliation',
  'Late Filings',
  'Client Management',
  'Finding Errors',
  'Data Entry',
  'Team Collaboration',
];

const REFERRAL_SOURCES = [
  'Google Search',
  'YouTube',
  'LinkedIn',
  'Instagram',
  'Facebook',
  'Friend/Colleague',
  'CA Community',
  'WhatsApp',
  'Advertisement',
  'Other',
];

const TRIAL_REASONS = [
  'Save Time',
  'Reduce Errors',
  'Manage More Clients',
  'Automate GST Filing',
  'Scale My CA Firm',
  'Replace Excel',
  'Curious About AI',
];

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

// ─── Animation Variants ──────────────────────────────────────────────────────

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 300 : -300,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction < 0 ? 300 : -300,
    opacity: 0,
  }),
};

const stepTransition = {
  type: 'spring' as const,
  stiffness: 300,
  damping: 30,
};

// ─── Multi-Select Chip ────────────────────────────────────────────────────────

function MultiSelectChip({
  label,
  selected,
  onToggle,
}: {
  label: string;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`rounded-full border px-3 py-1.5 text-sm cursor-pointer transition-all duration-150 ${
        selected
          ? 'bg-[#3B82F6]/15 border-[#3B82F6]/40 text-[#3B82F6]'
          : 'bg-white/[0.03] border-white/[0.08] text-white/60 hover:border-[#3B82F6]/40 hover:text-white'
      }`}
    >
      {selected && <Check className="inline size-3 mr-1 -mt-0.5" />}
      {label}
    </button>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function OnboardingFlow({
  onComplete,
  onSkip,
  userEmail = '',
  userName = '',
  error = null,
  onDismissError,
}: OnboardingFlowProps) {
  const [currentStep, setCurrentStep] = useState(0); // 0=welcome, 1-4=steps, 5=final
  const [direction, setDirection] = useState(1);

  const [formData, setFormData] = useState<OnboardingData>({
    fullName: userName,
    email: userEmail,
    phone: '',
    ageGroup: '',
    profession: '',
    experience: '',
    firmName: '',
    organizationType: '',
    gstin: '',
    state: '',
    stateCode: '',
    icaiMembershipNo: '',
    officeAddress: '',
    clientCount: '',
    monthlyReturns: '',
    gstServices: [],
    painPoints: [],
    referralSource: '',
    trialReasons: [],
    wantsUpdates: true,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const updateField = useCallback(
    <K extends keyof OnboardingData>(field: K, value: OnboardingData[K]) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
      // Clear error on change
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    },
    []
  );

  const toggleArrayItem = useCallback(
    (field: 'gstServices' | 'painPoints' | 'trialReasons', item: string) => {
      setFormData((prev) => {
        const arr = prev[field] as string[];
        const next = arr.includes(item)
          ? arr.filter((i) => i !== item)
          : [...arr, item];
        return { ...prev, [field]: next };
      });
    },
    []
  );

  const goNext = useCallback(() => {
    setDirection(1);
    setCurrentStep((prev) => Math.min(prev + 1, 5));
  }, []);

  const goBack = useCallback(() => {
    setDirection(-1);
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  }, []);

  // ─── Validation ───────────────────────────────────────────────────────────

  const validateStep = useCallback(
    (step: number): boolean => {
      const newErrors: Record<string, string> = {};

      if (step === 1) {
        if (!formData.fullName.trim()) newErrors.fullName = 'Full name is required';
        if (!formData.email.trim()) newErrors.email = 'Email is required';
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
          newErrors.email = 'Enter a valid email';
        if (!formData.phone.trim()) newErrors.phone = 'Mobile number is required';
        else if (!/^\d{10}$/.test(formData.phone.replace(/\s/g, '')))
          newErrors.phone = 'Enter a valid 10-digit mobile number';
      }

      if (step === 2) {
        if (!formData.firmName.trim()) newErrors.firmName = 'Firm name is required';
      }

      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
    },
    [formData]
  );

  const handleNext = useCallback(() => {
    if (validateStep(currentStep)) {
      goNext();
    }
  }, [currentStep, validateStep, goNext]);

  // ─── GSTIN Validation ─────────────────────────────────────────────────────

  const getGstinStatus = useCallback(() => {
    const val = formData.gstin.trim();
    if (!val) return null;
    return GSTIN_REGEX.test(val) ? 'valid' : 'invalid';
  }, [formData.gstin]);

  // ─── State Code Lookup ────────────────────────────────────────────────────

  const handleStateChange = useCallback(
    (stateName: string) => {
      const stateObj = INDIAN_STATES.find((s) => s.name === stateName);
      setFormData((prev) => ({
        ...prev,
        state: stateName,
        stateCode: stateObj?.code ?? '',
      }));
      setErrors((prev) => {
        const next = { ...prev };
        delete next.state;
        return next;
      });
    },
    []
  );

  // ─── Progress ─────────────────────────────────────────────────────────────

  const totalSteps = 5;
  const progressPercent =
    currentStep === 0 ? 0 : (currentStep / totalSteps) * 100;

  // ─── Step Icons ───────────────────────────────────────────────────────────

  const stepIcons = [Zap, User, Building2, Briefcase, Target];

  // ─── Render Step Content ──────────────────────────────────────────────────

  const renderStep = () => {
    // Step 0 — Welcome
    if (currentStep === 0) {
      return (
        <motion.div
          key="step-0"
          custom={direction}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={stepTransition}
          className="flex flex-col items-center justify-center text-center py-8"
        >
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
            className="relative mb-8"
          >
            {/* Blue-purple glow behind logo (signup spec) */}
            <div className="brand-aura" aria-hidden />
            <BrandLogo
              variant="icon"
              theme="dark"
              size={96}
              className="relative drop-shadow-[0_0_30px_rgba(139,92,246,0.55)]"
            />
          </motion.div>
          <motion.h1
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-2xl font-bold tracking-tight text-white"
            style={{ fontFamily: 'var(--font-poppins), Poppins, sans-serif' }}
          >
            Welcome to GSTPilot<span style={{ color: '#22D3EE' }}>™</span>
          </motion.h1>
          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-white/55 mt-2 max-w-sm"
          >
            The Financial Brain of India™ — let’s set up your workspace in less than 2 minutes.
          </motion.p>
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mt-8"
          >
            <Button
              onClick={goNext}
              size="lg"
              className="bg-white text-black hover:bg-white/90 press-scale glow-accent-btn rounded-xl gap-2 px-8"
            >
              Get Started
              <ArrowRight className="size-4" />
            </Button>
          </motion.div>
        </motion.div>
      );
    }

    // Step 1 — About You
    if (currentStep === 1) {
      return (
        <motion.div
          key="step-1"
          custom={direction}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={stepTransition}
          className="py-4"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center">
              <User className="size-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">About You</h2>
              <p className="text-sm text-muted-foreground">
                Tell us about yourself so we can personalize your experience
              </p>
            </div>
          </div>

          <div className="space-y-5">
            {/* Full Name */}
            <div className="space-y-2">
              <Label htmlFor="fullName">
                Full Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="fullName"
                placeholder="Rajesh Kumar Sharma"
                value={formData.fullName}
                onChange={(e) => updateField('fullName', e.target.value)}
                aria-invalid={!!errors.fullName}
                className={errors.fullName ? 'border-destructive' : ''}
              />
              {errors.fullName && (
                <p className="text-xs text-destructive">{errors.fullName}</p>
              )}
            </div>

            {/* Work Email */}
            <div className="space-y-2">
              <Label htmlFor="email">
                Work Email <span className="text-destructive">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="rajesh@yourfirm.com"
                value={formData.email}
                onChange={(e) => updateField('email', e.target.value)}
                aria-invalid={!!errors.email}
                className={errors.email ? 'border-destructive' : ''}
              />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email}</p>
              )}
            </div>

            {/* Mobile Number */}
            <div className="space-y-2">
              <Label htmlFor="phone">
                Mobile Number <span className="text-destructive">*</span>
              </Label>
              <div className="flex">
                <div className="flex items-center rounded-l-md border border-r-0 bg-muted px-3 text-sm text-muted-foreground h-9">
                  +91
                </div>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="9876543210"
                  value={formData.phone}
                  onChange={(e) =>
                    updateField('phone', e.target.value.replace(/[^\d]/g, '').slice(0, 10))
                  }
                  aria-invalid={!!errors.phone}
                  className={`rounded-l-none ${errors.phone ? 'border-destructive' : ''}`}
                />
              </div>
              {errors.phone && (
                <p className="text-xs text-destructive">{errors.phone}</p>
              )}
            </div>

            {/* Age Group */}
            <div className="space-y-2">
              <Label>Age Group</Label>
              <Select
                value={formData.ageGroup}
                onValueChange={(v) => updateField('ageGroup', v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select age group" />
                </SelectTrigger>
                <SelectContent>
                  {AGE_GROUPS.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Profession */}
            <div className="space-y-2">
              <Label>Profession</Label>
              <Select
                value={formData.profession}
                onValueChange={(v) => updateField('profession', v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select your profession" />
                </SelectTrigger>
                <SelectContent>
                  {PROFESSIONS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Years of Experience */}
            <div className="space-y-2">
              <Label>Years of Experience</Label>
              <Select
                value={formData.experience}
                onValueChange={(v) => updateField('experience', v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select experience" />
                </SelectTrigger>
                <SelectContent>
                  {EXPERIENCE_LEVELS.map((e) => (
                    <SelectItem key={e} value={e}>
                      {e}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </motion.div>
      );
    }

    // Step 2 — Firm Information
    if (currentStep === 2) {
      const gstinStatus = getGstinStatus();
      return (
        <motion.div
          key="step-2"
          custom={direction}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={stepTransition}
          className="py-4"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center">
              <Building2 className="size-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Firm Information</h2>
              <p className="text-sm text-muted-foreground">
                Details about your CA firm or practice
              </p>
            </div>
          </div>

          <div className="space-y-5">
            {/* Firm Name */}
            <div className="space-y-2">
              <Label htmlFor="firmName">
                Firm Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="firmName"
                placeholder="Sharma & Associates"
                value={formData.firmName}
                onChange={(e) => updateField('firmName', e.target.value)}
                aria-invalid={!!errors.firmName}
                className={errors.firmName ? 'border-destructive' : ''}
              />
              {errors.firmName && (
                <p className="text-xs text-destructive">{errors.firmName}</p>
              )}
            </div>

            {/* Type of Organization */}
            <div className="space-y-2">
              <Label>Type of Organization</Label>
              <Select
                value={formData.organizationType}
                onValueChange={(v) => updateField('organizationType', v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select organization type" />
                </SelectTrigger>
                <SelectContent>
                  {ORGANIZATION_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* GSTIN */}
            <div className="space-y-2">
              <Label htmlFor="gstin">GSTIN</Label>
              <div className="relative">
                <Input
                  id="gstin"
                  placeholder="22AAAAA0000A1Z5"
                  value={formData.gstin}
                  onChange={(e) =>
                    updateField(
                      'gstin',
                      e.target.value.toUpperCase().slice(0, 15)
                    )
                  }
                  className={`pr-10 ${
                    gstinStatus === 'invalid'
                      ? 'border-red-400'
                      : gstinStatus === 'valid'
                      ? 'border-emerald-400'
                      : ''
                  }`}
                />
                {gstinStatus === 'valid' && (
                  <Check className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-emerald-500" />
                )}
                {gstinStatus === 'invalid' && (
                  <X className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-red-500" />
                )}
              </div>
              {gstinStatus === 'invalid' && (
                <p className="text-xs text-destructive">
                  Invalid GSTIN format (e.g., 22AAAAA0000A1Z5)
                </p>
              )}
            </div>

            {/* State */}
            <div className="space-y-2">
              <Label>State</Label>
              <Select
                value={formData.state}
                onValueChange={handleStateChange}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select your state" />
                </SelectTrigger>
                <SelectContent>
                  {INDIAN_STATES.map((s) => (
                    <SelectItem key={s.code} value={s.name}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* ICAI Membership Number */}
            <div className="space-y-2">
              <Label htmlFor="icaiMembershipNo">
                ICAI Membership Number{' '}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </Label>
              <Input
                id="icaiMembershipNo"
                placeholder="e.g., 123456"
                value={formData.icaiMembershipNo}
                onChange={(e) =>
                  updateField('icaiMembershipNo', e.target.value)
                }
              />
            </div>

            {/* Office Address */}
            <div className="space-y-2">
              <Label htmlFor="officeAddress">
                Office Address{' '}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </Label>
              <Textarea
                id="officeAddress"
                placeholder="123, MG Road, Mumbai, Maharashtra - 400001"
                value={formData.officeAddress}
                onChange={(e) =>
                  updateField('officeAddress', e.target.value)
                }
                rows={3}
              />
            </div>
          </div>
        </motion.div>
      );
    }

    // Step 3 — Business Usage
    if (currentStep === 3) {
      return (
        <motion.div
          key="step-3"
          custom={direction}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={stepTransition}
          className="py-4"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center">
              <Briefcase className="size-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Business Usage</h2>
              <p className="text-sm text-muted-foreground">
                Help us understand how you work with GST
              </p>
            </div>
          </div>

          <div className="space-y-6">
            {/* Client Count */}
            <div className="space-y-2">
              <Label>How many clients do you manage?</Label>
              <Select
                value={formData.clientCount}
                onValueChange={(v) => updateField('clientCount', v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select range" />
                </SelectTrigger>
                <SelectContent>
                  {CLIENT_COUNTS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Monthly Returns */}
            <div className="space-y-2">
              <Label>How many GST returns do you file every month?</Label>
              <Select
                value={formData.monthlyReturns}
                onValueChange={(v) => updateField('monthlyReturns', v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select range" />
                </SelectTrigger>
                <SelectContent>
                  {MONTHLY_RETURNS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* GST Services */}
            <div className="space-y-3">
              <Label>Which GST services do you use most?</Label>
              <div className="flex flex-wrap gap-2">
                {GST_SERVICES.map((service) => (
                  <MultiSelectChip
                    key={service}
                    label={service}
                    selected={formData.gstServices.includes(service)}
                    onToggle={() => toggleArrayItem('gstServices', service)}
                  />
                ))}
              </div>
            </div>

            {/* Pain Points */}
            <div className="space-y-3">
              <Label>What is your biggest pain point?</Label>
              <div className="flex flex-wrap gap-2">
                {PAIN_POINTS.map((point) => (
                  <MultiSelectChip
                    key={point}
                    label={point}
                    selected={formData.painPoints.includes(point)}
                    onToggle={() => toggleArrayItem('painPoints', point)}
                  />
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      );
    }

    // Step 4 — Marketing & Personalization
    if (currentStep === 4) {
      return (
        <motion.div
          key="step-4"
          custom={direction}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={stepTransition}
          className="py-4"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center">
              <Target className="size-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">
                Marketing &amp; Personalization
              </h2>
              <p className="text-sm text-muted-foreground">
                Almost there! Just a few more details
              </p>
            </div>
          </div>

          <div className="space-y-6">
            {/* Referral Source */}
            <div className="space-y-2">
              <Label>How did you hear about GSTPilot?</Label>
              <Select
                value={formData.referralSource}
                onValueChange={(v) => updateField('referralSource', v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a source" />
                </SelectTrigger>
                <SelectContent>
                  {REFERRAL_SOURCES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Trial Reasons */}
            <div className="space-y-3">
              <Label>Why are you trying GSTPilot?</Label>
              <div className="flex flex-wrap gap-2">
                {TRIAL_REASONS.map((reason) => (
                  <MultiSelectChip
                    key={reason}
                    label={reason}
                    selected={formData.trialReasons.includes(reason)}
                    onToggle={() =>
                      toggleArrayItem('trialReasons', reason)
                    }
                  />
                ))}
              </div>
            </div>

            {/* Updates Toggle */}
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label className="text-base">
                  Product updates &amp; GST reminders
                </Label>
                <p className="text-sm text-muted-foreground">
                  Stay informed about new features and filing deadlines
                </p>
              </div>
              <Switch
                checked={formData.wantsUpdates}
                onCheckedChange={(v) => updateField('wantsUpdates', v)}
              />
            </div>
          </div>
        </motion.div>
      );
    }

    // Step 5 — Final Screen
    return (
      <motion.div
        key="step-5"
        custom={direction}
        variants={slideVariants}
        initial="enter"
        animate="center"
        exit="exit"
        transition={stepTransition}
        className="flex flex-col items-center justify-center text-center py-8"
      >
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
          className="mb-6"
        >
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-600/30 glow-accent-btn">
            <Rocket className="size-10 text-white" />
          </div>
        </motion.div>

        <motion.h2
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-2xl font-bold tracking-tight"
        >
          Your GSTPilot Workspace Is Ready
        </motion.h2>
        <motion.p
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-muted-foreground mt-2 max-w-sm"
        >
          Here&apos;s a summary of your setup
        </motion.p>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="w-full mt-6"
        >
          <Card className="text-left">
            <CardContent className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Name</p>
                  <p className="font-medium truncate">
                    {formData.fullName || '—'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Firm Name</p>
                  <p className="font-medium truncate">
                    {formData.firmName || '—'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Profession</p>
                  <p className="font-medium truncate">
                    {formData.profession || '—'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Clients</p>
                  <p className="font-medium truncate">
                    {formData.clientCount || '—'}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-muted-foreground text-xs">State</p>
                  <p className="font-medium truncate">
                    {formData.state || '—'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Error display — shows exact Firestore/API error instead of infinite loading */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 rounded-lg bg-red-50 border border-red-200 p-3.5 flex items-start gap-3 w-full"
          >
            <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800">Setup failed</p>
              <p className="text-xs text-red-600 mt-0.5">{error}</p>
              <button
                type="button"
                onClick={onDismissError}
                className="text-xs text-red-600 hover:text-red-800 mt-1.5 underline font-medium"
              >
                Dismiss and try again
              </button>
            </div>
          </motion.div>
        )}

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="flex flex-col sm:flex-row gap-3 mt-8 w-full"
        >
          <Button
            type="button"
            onClick={() => onComplete(formData, 'dashboard')}
            size="lg"
            className="flex-1 bg-white text-black hover:bg-white/90 press-scale glow-accent-btn rounded-xl gap-2"
          >
            Go to Dashboard <ArrowRight className="size-4" />
          </Button>
          <Button
            type="button"
            onClick={() => onComplete(formData, 'invoices')}
            variant="outline"
            size="lg"
            className="flex-1 gap-2 glass-surface border-white/[0.10] text-white hover:bg-white/[0.06] press-scale rounded-xl"
          >
            <Upload className="size-4" />Upload First Document
          </Button>
        </motion.div>
      </motion.div>
    );
  };

  // ─── Main Render ──────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Progress Bar */}
      <div className="sticky top-0 z-10 glass-surface border-b border-white/[0.06]">
        <div className="max-w-[640px] mx-auto px-6 py-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {currentStep > 0 && (
                <span className="text-xs font-medium text-white/50">
                  Step {currentStep} of {totalSteps}
                </span>
              )}
            </div>
            {currentStep > 0 && currentStep < 5 && (
              <div className="flex gap-1">
                {Array.from({ length: totalSteps }, (_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      i < currentStep
                        ? 'w-8 bg-[#3B82F6]'
                        : i === currentStep
                        ? 'w-8 bg-[#3B82F6]/40'
                        : 'w-4 bg-white/[0.08]'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
          {currentStep > 0 && (
            <div className="h-1 w-full bg-white/[0.08] rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-[#3B82F6] to-[#60A5FA] rounded-full"
                initial={false}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 flex flex-col">
        <div className="max-w-[640px] mx-auto w-full px-6 flex-1">
          <AnimatePresence mode="wait" custom={direction}>
            {renderStep()}
          </AnimatePresence>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-white/[0.06] glass-surface">
        <div className="max-w-[640px] mx-auto px-6 py-4 flex items-center justify-between">
          {currentStep > 0 && currentStep < 5 ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={goBack}
              className="gap-1 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
              Back
            </Button>
          ) : currentStep === 5 ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={goBack}
              className="gap-1 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
              Back
            </Button>
          ) : (
            <div />
          )}

          {onSkip && currentStep < 5 && (
            <button
              type="button"
              onClick={onSkip}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              Skip for now
            </button>
          )}

          {currentStep > 0 && currentStep < 5 && (
            <Button
              onClick={handleNext}
              size="sm"
              className="bg-white text-black hover:bg-white/90 press-scale glow-accent-btn rounded-xl gap-1"
            >
              {currentStep === 4 ? 'Complete Setup' : 'Continue'}
              {currentStep === 4 ? (
                <Sparkles className="size-4" />
              ) : (
                <ArrowRight className="size-4" />
              )}
            </Button>
          )}

          {currentStep === 5 && <div />}
        </div>
      </div>
    </div>
  );
}

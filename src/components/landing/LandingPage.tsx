'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, useInView, useAnimation, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Zap,
  FileText,
  Upload,
  CheckCircle2,
  ArrowRight,
  Check,
  X,
  Star,
  ChevronRight,
  Play,
  Sparkles,
  Clock,
  ShieldCheck,
  Brain,
  RefreshCw,
  Users,
  BarChart3,
  Globe,
  Layers,
} from 'lucide-react';

interface LandingPageProps {
  onGetStarted: () => void;
  onBookDemo: () => void;
}

// ─── Animated Counter ────────────────────────────────────
function AnimatedCounter({ target, suffix = '', prefix = '' }: { target: number; suffix?: string; prefix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });

  useEffect(() => {
    if (!isInView) return;
    const duration = 2000;
    const steps = 60;
    const increment = target / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(current));
      }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [isInView, target]);

  return (
    <span ref={ref}>
      {prefix}{count.toLocaleString('en-IN')}{suffix}
    </span>
  );
}

// ─── Section Wrapper ─────────────────────────────────────
function Section({ children, className = '', id }: { children: React.ReactNode; className?: string; id?: string }) {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });
  const controls = useAnimation();

  useEffect(() => {
    if (isInView) {
      controls.start('visible');
    }
  }, [isInView, controls]);

  return (
    <motion.section
      id={id}
      ref={ref}
      initial="hidden"
      animate={controls}
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: 0.1 } },
      }}
      className={className}
    >
      {children}
    </motion.section>
  );
}

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};

const scaleUp = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
};

// ─── Navbar ──────────────────────────────────────────────
function Navbar({ onGetStarted }: { onGetStarted: () => void }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-white/90 backdrop-blur-xl shadow-lg shadow-slate-900/5 border-b border-slate-200/50'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-18">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-md shadow-emerald-600/20">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-slate-900 tracking-tight">
              GSTPilot
            </span>
          </div>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            <a href="#how-it-works" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">How It Works</a>
            <a href="#features" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Features</a>
            <a href="#pricing" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Pricing</a>
            <a href="#testimonials" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Testimonials</a>
          </div>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-3">
            <Button
              variant="ghost"
              onClick={onGetStarted}
              className="text-sm font-medium text-slate-700 hover:text-slate-900"
            >
              Sign In
            </Button>
            <Button
              onClick={onGetStarted}
              className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 text-sm font-semibold px-5"
            >
              Start Free Trial
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </div>

          {/* Mobile Hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-slate-100 transition-colors"
            aria-label="Toggle menu"
          >
            <div className="w-5 h-5 flex flex-col justify-center items-center gap-1">
              <span className={`block h-0.5 w-5 bg-slate-700 transition-all duration-300 ${mobileOpen ? 'rotate-45 translate-y-1.5' : ''}`} />
              <span className={`block h-0.5 w-5 bg-slate-700 transition-all duration-300 ${mobileOpen ? 'opacity-0' : ''}`} />
              <span className={`block h-0.5 w-5 bg-slate-700 transition-all duration-300 ${mobileOpen ? '-rotate-45 -translate-y-1.5' : ''}`} />
            </div>
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-white/95 backdrop-blur-xl border-b border-slate-200/50 overflow-hidden"
          >
            <div className="px-4 py-4 space-y-2">
              <a href="#how-it-works" onClick={() => setMobileOpen(false)} className="block py-2 text-sm font-medium text-slate-700">How It Works</a>
              <a href="#features" onClick={() => setMobileOpen(false)} className="block py-2 text-sm font-medium text-slate-700">Features</a>
              <a href="#pricing" onClick={() => setMobileOpen(false)} className="block py-2 text-sm font-medium text-slate-700">Pricing</a>
              <a href="#testimonials" onClick={() => setMobileOpen(false)} className="block py-2 text-sm font-medium text-slate-700">Testimonials</a>
              <div className="pt-3 border-t border-slate-200 space-y-2">
                <Button variant="outline" onClick={onGetStarted} className="w-full justify-center">Sign In</Button>
                <Button onClick={onGetStarted} className="w-full justify-center bg-emerald-600 hover:bg-emerald-700 text-white">Start Free Trial</Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}

// ─── Hero Section ────────────────────────────────────────
function HeroSection({ onGetStarted, onBookDemo }: { onGetStarted: () => void; onBookDemo: () => void }) {
  return (
    <Section className="relative min-h-screen flex items-center overflow-hidden pt-16" id="hero">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" />
      {/* Grid pattern */}
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }} />
      {/* Radial gradient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-emerald-500/10 rounded-full blur-3xl" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left: Content */}
          <motion.div variants={fadeUp} className="text-center lg:text-left">
            <motion.div variants={fadeUp} className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-4 py-1.5 mb-6">
              <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-sm font-medium text-emerald-400">Upload → File in Minutes</span>
            </motion.div>

            <motion.h1 variants={fadeUp} className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white leading-[1.1]">
              Prepare &amp; File GST Returns
              <br />
              <span className="bg-gradient-to-r from-emerald-400 to-emerald-300 bg-clip-text text-transparent">
                10x Faster
              </span>
            </motion.h1>

            <motion.p variants={fadeUp} className="mt-6 text-lg sm:text-xl text-slate-400 max-w-xl mx-auto lg:mx-0 leading-relaxed">
              Upload invoices. Get GST-ready returns in minutes. No spreadsheets, no manual work, no errors.
            </motion.p>

            <motion.div variants={fadeUp} className="mt-8 flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start">
              <Button
                size="lg"
                onClick={onGetStarted}
                className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white shadow-xl shadow-emerald-600/25 h-12 px-8 text-base font-semibold"
              >
                Start Free — No Card Needed
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={onBookDemo}
                className="w-full sm:w-auto border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white hover:border-slate-500 h-12 px-8 text-base font-semibold"
              >
                <Play className="mr-2 h-4 w-4" />
                Watch Demo
              </Button>
            </motion.div>

            <motion.div variants={fadeUp} className="mt-8 flex items-center gap-6 justify-center lg:justify-start">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span className="text-sm text-slate-400">14-day free trial</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span className="text-sm text-slate-400">No credit card</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span className="text-sm text-slate-400">Cancel anytime</span>
              </div>
            </motion.div>
          </motion.div>

          {/* Right: Product Preview */}
          <motion.div variants={scaleUp} className="relative">
            <div className="relative">
              {/* Main dashboard card */}
              <div className="rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl shadow-emerald-500/5 p-6 overflow-hidden">
                {/* Mock header */}
                <div className="flex items-center gap-3 mb-6">
                  <div className="h-3 w-3 rounded-full bg-red-400" />
                  <div className="h-3 w-3 rounded-full bg-amber-400" />
                  <div className="h-3 w-3 rounded-full bg-emerald-400" />
                  <div className="flex-1 h-6 rounded-md bg-white/5 ml-3" />
                </div>

                {/* Mock upload zone */}
                <div className="rounded-xl border-2 border-dashed border-emerald-500/30 bg-emerald-500/5 p-8 mb-4 text-center">
                  <Upload className="h-10 w-10 text-emerald-400 mx-auto mb-3" />
                  <p className="text-emerald-400 text-sm font-semibold">Drop invoices here</p>
                  <p className="text-slate-500 text-xs mt-1">PDF, Excel, CSV — AI extracts everything</p>
                </div>

                {/* Mock extracted data */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {[
                    { label: 'Invoices', value: '24', color: 'text-emerald-400' },
                    { label: 'Taxable', value: '₹18.4L', color: 'text-emerald-300' },
                    { label: 'GST', value: '₹3.3L', color: 'text-teal-400' },
                  ].map((card) => (
                    <div key={card.label} className="rounded-lg bg-white/5 border border-white/5 p-3 text-center">
                      <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">{card.label}</p>
                      <p className={`text-lg font-bold ${card.color}`}>{card.value}</p>
                    </div>
                  ))}
                </div>

                {/* Mock filing button */}
                <div className="rounded-lg bg-emerald-600 text-white text-center py-2.5 text-sm font-semibold">
                  <FileText className="h-4 w-4 inline mr-1.5" />
                  File GSTR-1 Now
                </div>
              </div>

              {/* Floating cards */}
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute -top-4 -right-4 rounded-xl bg-white/10 backdrop-blur-lg border border-white/10 p-3 shadow-xl"
              >
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                    <Clock className="h-4 w-4 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400">Time Saved</p>
                    <p className="text-sm font-bold text-white">4.5 hrs</p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                animate={{ y: [0, 6, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
                className="absolute -bottom-4 -left-4 rounded-xl bg-white/10 backdrop-blur-lg border border-white/10 p-3 shadow-xl"
              >
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                    <ShieldCheck className="h-4 w-4 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400">Accuracy</p>
                    <p className="text-sm font-bold text-white">99.9%</p>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    </Section>
  );
}

// ─── Trust Section ───────────────────────────────────────
function TrustSection() {
  const stats = [
    { value: 500, suffix: '+', label: 'CA Firms', icon: Users },
    { value: 2000, suffix: '+', label: 'Businesses', icon: Globe },
    { value: 500, prefix: '₹', suffix: 'Cr+', label: 'Invoices Processed', icon: BarChart3 },
    { value: 10, suffix: 'x', label: 'Faster Filing', icon: Clock },
  ];

  return (
    <Section className="py-16 lg:py-20 bg-white border-b border-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div variants={fadeUp} className="text-center mb-10">
          <p className="text-sm font-semibold uppercase tracking-widest text-emerald-600">Trusted by CA Firms Across India</p>
        </motion.div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((stat) => (
            <motion.div key={stat.label} variants={fadeUp} className="text-center">
              <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-emerald-50 mb-3">
                <stat.icon className="h-6 w-6 text-emerald-600" />
              </div>
              <p className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
                <AnimatedCounter
                  target={stat.value}
                  suffix={stat.suffix}
                  prefix={stat.prefix || ''}
                />
              </p>
              <p className="text-sm text-slate-500 mt-1 font-medium">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </Section>
  );
}

// ─── How It Works Section ────────────────────────────────
function HowItWorksSection() {
  const steps = [
    {
      step: 1,
      title: 'Upload Invoices',
      description: 'Drag & drop PDFs, Excel, CSV, or images. Our AI handles the rest.',
      icon: Upload,
    },
    {
      step: 2,
      title: 'AI Extracts & Validates',
      description: 'GSTIN, HSN, tax amounts — extracted and validated automatically.',
      icon: Brain,
    },
    {
      step: 3,
      title: 'Review & Reconcile',
      description: 'Fix mismatches. One-click reconciliation with GSTR-2A/2B.',
      icon: RefreshCw,
    },
    {
      step: 4,
      title: 'File Returns',
      description: 'Generate JSON, file GSTR-1/3B, download acknowledgement.',
      icon: FileText,
    },
  ];

  return (
    <Section className="py-20 lg:py-28 bg-white" id="how-it-works">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div variants={fadeUp} className="text-center max-w-2xl mx-auto mb-16">
          <Badge variant="outline" className="mb-4 border-emerald-200 text-emerald-700 bg-emerald-50/50">How It Works</Badge>
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
            4 steps.{' '}
            <span className="text-emerald-600">That&apos;s it.</span>
          </h2>
          <p className="mt-4 text-lg text-slate-500">
            From raw invoices to filed GST returns. No spreadsheets needed.
          </p>
        </motion.div>

        <div className="relative">
          {/* Connecting line */}
          <div className="hidden lg:block absolute top-1/2 left-[10%] right-[10%] h-0.5 bg-gradient-to-r from-emerald-200 via-emerald-300 to-emerald-200 -translate-y-1/2 z-0" />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 relative z-10">
            {steps.map((step) => (
              <motion.div key={step.step} variants={fadeUp} className="relative">
                <div className="flex flex-col items-center text-center">
                  <div className="relative mb-4">
                    <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                      <step.icon className="h-7 w-7 text-white" />
                    </div>
                    <div className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-white border-2 border-emerald-500 flex items-center justify-center text-[10px] font-bold text-emerald-600">
                      {step.step}
                    </div>
                  </div>
                  <h3 className="text-sm font-semibold text-slate-900 mb-1">{step.title}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed max-w-[200px]">{step.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </Section>
  );
}

// ─── Features Section ────────────────────────────────────
function FeaturesSection() {
  const features = [
    {
      icon: Upload,
      title: 'Upload & Extract',
      description: 'AI-powered extraction from PDFs, images, and Excel with 99.9% accuracy.',
      color: 'bg-emerald-50 text-emerald-600',
    },
    {
      icon: ShieldCheck,
      title: 'Auto-Validation',
      description: 'GSTIN verification, HSN code checks, and tax computation — all automatic.',
      color: 'bg-teal-50 text-teal-600',
    },
    {
      icon: RefreshCw,
      title: 'Smart Reconciliation',
      description: 'Auto-match GSTR-1 with GSTR-2A/2B. Find mismatches in seconds.',
      color: 'bg-amber-50 text-amber-600',
    },
    {
      icon: FileText,
      title: 'One-Click Filing',
      description: 'Generate GSTR-1/3B JSON, file directly, download acknowledgements.',
      color: 'bg-emerald-50 text-emerald-600',
    },
    {
      icon: Users,
      title: 'Multi-Client',
      description: 'Manage all your clients from one dashboard. Switch contexts instantly.',
      color: 'bg-violet-50 text-violet-600',
    },
    {
      icon: Layers,
      title: 'Section Classification',
      description: 'Auto-classify invoices into B2B, B2C, CDNR, Exports — ready for filing.',
      color: 'bg-rose-50 text-rose-600',
    },
  ];

  return (
    <Section className="py-20 lg:py-28 bg-slate-50" id="features">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div variants={fadeUp} className="text-center max-w-2xl mx-auto mb-16">
          <Badge variant="outline" className="mb-4 border-emerald-200 text-emerald-700 bg-emerald-50/50">Features</Badge>
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
            Everything you need.{' '}
            <span className="text-emerald-600">Nothing you don&apos;t.</span>
          </h2>
          <p className="mt-4 text-lg text-slate-500">
            Focused on one thing: preparing and filing GST returns faster.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => (
            <motion.div key={feature.title} variants={fadeUp}>
              <Card className="h-full hover:shadow-lg hover:shadow-emerald-500/5 transition-all duration-300 border-slate-200/80 group">
                <CardContent className="p-6">
                  <div className={`inline-flex items-center justify-center h-11 w-11 rounded-xl ${feature.color} mb-4 group-hover:scale-110 transition-transform duration-300`}>
                    <feature.icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">{feature.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{feature.description}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </Section>
  );
}

// ─── Comparison Section ──────────────────────────────────
function ComparisonSection() {
  const comparisons = [
    { feature: 'Invoice Processing', traditional: '4-6 hours', gstpilot: '< 5 minutes', saved: '98%' },
    { feature: 'Error Rate', traditional: '8-12%', gstpilot: '< 0.1%', saved: '99%' },
    { feature: 'Reconciliation', traditional: 'Manual matching', gstpilot: 'Auto AI matching', saved: '100%' },
    { feature: 'GSTR Filing', traditional: '2-3 days', gstpilot: '< 1 hour', saved: '95%' },
    { feature: 'Multi-Client', traditional: 'Spreadsheets & email', gstpilot: 'One dashboard', saved: '90%' },
  ];

  return (
    <Section className="py-20 lg:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div variants={fadeUp} className="text-center max-w-2xl mx-auto mb-16">
          <Badge variant="outline" className="mb-4 border-emerald-200 text-emerald-700 bg-emerald-50/50">Why GSTPilot</Badge>
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
            Stop doing GST returns{' '}
            <span className="text-emerald-600">the hard way</span>
          </h2>
        </motion.div>

        <motion.div variants={scaleUp}>
          <Card className="overflow-hidden border-slate-200/80">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left p-4 text-sm font-semibold text-slate-600">Task</th>
                    <th className="text-center p-4 text-sm font-semibold text-red-600 bg-red-50/50">
                      <div className="flex items-center justify-center gap-1.5">
                        <X className="h-4 w-4" />
                        Manual
                      </div>
                    </th>
                    <th className="text-center p-4 text-sm font-semibold text-emerald-600 bg-emerald-50/50">
                      <div className="flex items-center justify-center gap-1.5">
                        <Check className="h-4 w-4" />
                        GSTPilot
                      </div>
                    </th>
                    <th className="text-center p-4 text-sm font-semibold text-slate-600">Saved</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisons.map((row) => (
                    <tr key={row.feature} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors">
                      <td className="p-4 text-sm font-medium text-slate-700">{row.feature}</td>
                      <td className="p-4 text-center text-sm text-slate-500 bg-red-50/30">{row.traditional}</td>
                      <td className="p-4 text-center text-sm font-semibold text-emerald-700 bg-emerald-50/30">{row.gstpilot}</td>
                      <td className="p-4 text-center">
                        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 font-semibold">{row.saved}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </motion.div>
      </div>
    </Section>
  );
}

// ─── Testimonials Section ────────────────────────────────
function TestimonialsSection() {
  const testimonials = [
    {
      name: 'CA Suresh Menon',
      role: 'Managing Partner, Menon & Associates',
      content: 'We filed GSTR-1 for 80 clients in one afternoon. Before GSTPilot, this took our entire team a full week.',
      rating: 5,
    },
    {
      name: 'CA Deepika Rao',
      role: 'Founder, Rao GST Solutions',
      content: 'The upload → extract → file workflow is magic. My team went from dreading month-end to finishing before lunch.',
      rating: 5,
    },
    {
      name: 'Rahul Verma',
      role: 'CFO, TechBridge India',
      content: 'Reconciliation that used to take 3 days now takes 30 minutes. The auto-matching is incredibly accurate.',
      rating: 5,
    },
  ];

  return (
    <Section className="py-20 lg:py-28 bg-slate-50" id="testimonials">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div variants={fadeUp} className="text-center max-w-2xl mx-auto mb-16">
          <Badge variant="outline" className="mb-4 border-emerald-200 text-emerald-700 bg-emerald-50/50">Testimonials</Badge>
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
            CAs love{' '}
            <span className="text-emerald-600">the speed</span>
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((t) => (
            <motion.div key={t.name} variants={fadeUp}>
              <Card className="h-full hover:shadow-lg hover:shadow-emerald-500/5 transition-all duration-300 border-slate-200/80">
                <CardContent className="p-6">
                  <div className="flex items-center gap-0.5 mb-4">
                    {Array.from({ length: t.rating }).map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed mb-6">&ldquo;{t.content}&rdquo;</p>
                  <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white text-sm font-bold">
                      {t.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{t.name}</p>
                      <p className="text-xs text-slate-500">{t.role}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </Section>
  );
}

// ─── Pricing Section ─────────────────────────────────────
function PricingSection({ onGetStarted }: { onGetStarted: () => void }) {
  const [annual, setAnnual] = useState(true);

  const plans = [
    {
      name: 'Starter',
      price: annual ? 1499 : 1999,
      period: '/mo',
      description: 'For solo practitioners',
      features: ['Up to 10 clients', 'Invoice processing', 'GST validation', 'GSTR-1/3B filing', 'Email support', '1 user seat'],
      cta: 'Start Free Trial',
      popular: false,
    },
    {
      name: 'Professional',
      price: annual ? 4999 : 5999,
      period: '/mo',
      description: 'For growing CA practices',
      features: ['Up to 50 clients', 'AI extraction + validation', 'Smart reconciliation', 'GSTR-1/3B/9/9C filing', '5 user seats', 'Priority support'],
      cta: 'Start Free Trial',
      popular: true,
    },
    {
      name: 'Firm',
      price: annual ? 12999 : 15999,
      period: '/mo',
      description: 'For established CA firms',
      features: ['Unlimited clients', 'Full AI suite', 'Bulk operations', 'API access', '25 user seats', 'Dedicated support', 'Custom onboarding'],
      cta: 'Start Free Trial',
      popular: false,
    },
  ];

  return (
    <Section className="py-20 lg:py-28 bg-white" id="pricing">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div variants={fadeUp} className="text-center max-w-2xl mx-auto mb-12">
          <Badge variant="outline" className="mb-4 border-emerald-200 text-emerald-700 bg-emerald-50/50">Pricing</Badge>
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
            Simple pricing.{' '}
            <span className="text-emerald-600">No surprises.</span>
          </h2>
          <p className="mt-4 text-lg text-slate-500">
            Start free. Upgrade when you&apos;re ready.
          </p>
        </motion.div>

        {/* Toggle */}
        <motion.div variants={fadeUp} className="flex items-center justify-center gap-3 mb-12">
          <span className={`text-sm font-medium ${!annual ? 'text-slate-900' : 'text-slate-400'}`}>Monthly</span>
          <button
            onClick={() => setAnnual(!annual)}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-200 ${annual ? 'bg-emerald-600' : 'bg-slate-300'}`}
          >
            <span className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${annual ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
          <span className={`text-sm font-medium ${annual ? 'text-slate-900' : 'text-slate-400'}`}>
            Annual
            <Badge className="ml-1.5 bg-emerald-100 text-emerald-700 hover:bg-emerald-100 text-[10px]">Save 25%</Badge>
          </span>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {plans.map((plan) => (
            <motion.div key={plan.name} variants={fadeUp}>
              <Card className={`h-full relative overflow-hidden transition-all duration-300 hover:shadow-lg ${
                plan.popular
                  ? 'border-emerald-300 shadow-md shadow-emerald-500/10 ring-1 ring-emerald-200'
                  : 'border-slate-200/80'
              }`}>
                {plan.popular && (
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-emerald-400" />
                )}
                <CardContent className="p-6">
                  {plan.popular && (
                    <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 mb-3 -mt-1">Most Popular</Badge>
                  )}
                  <h3 className="text-lg font-bold text-slate-900">{plan.name}</h3>
                  <p className="text-sm text-slate-500 mt-1">{plan.description}</p>
                  <div className="mt-4 mb-6">
                    <div className="flex items-baseline gap-1">
                      <span className="text-sm text-slate-500">₹</span>
                      <span className="text-3xl font-bold text-slate-900">{plan.price.toLocaleString('en-IN')}</span>
                      <span className="text-sm text-slate-500">{plan.period}</span>
                    </div>
                  </div>
                  <Button
                    onClick={onGetStarted}
                    className={`w-full mb-6 ${
                      plan.popular
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20'
                        : 'bg-slate-900 hover:bg-slate-800 text-white'
                    }`}
                  >
                    {plan.cta}
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                  <ul className="space-y-2.5">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm text-slate-600">
                        <Check className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </Section>
  );
}

// ─── CTA Section ─────────────────────────────────────────
function CTASection({ onGetStarted }: { onGetStarted: () => void }) {
  return (
    <Section className="py-20 lg:py-28 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <motion.div variants={fadeUp}>
          <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
            Ready to file GST returns{' '}
            <span className="bg-gradient-to-r from-emerald-400 to-emerald-300 bg-clip-text text-transparent">10x faster?</span>
          </h2>
          <p className="mt-4 text-lg text-slate-400 max-w-2xl mx-auto">
            Join 500+ CA firms who have already switched. Start your free trial today.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              size="lg"
              onClick={onGetStarted}
              className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-xl shadow-emerald-600/25 h-12 px-8 text-base font-semibold"
            >
              Start Free Trial
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
          <p className="mt-4 text-sm text-slate-500">
            No credit card required • 14-day free trial • Cancel anytime
          </p>
        </motion.div>
      </div>
    </Section>
  );
}

// ─── Footer ──────────────────────────────────────────────
function Footer() {
  return (
    <footer className="bg-slate-950 text-slate-400 py-12 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold text-white tracking-tight">GSTPilot</span>
            </div>
            <p className="text-sm leading-relaxed max-w-xs">
              The fastest way to prepare and file GST returns. Built for CA firms.
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Product</h4>
            <ul className="space-y-2.5">
              {['Features', 'Pricing', 'How It Works', 'Changelog'].map((link) => (
                <li key={link}><a href="#" className="text-sm hover:text-white transition-colors">{link}</a></li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Support</h4>
            <ul className="space-y-2.5">
              {['Help Center', 'Contact Us', 'API Docs', 'Status'].map((link) => (
                <li key={link}><a href="#" className="text-sm hover:text-white transition-colors">{link}</a></li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Legal</h4>
            <ul className="space-y-2.5">
              {['Privacy Policy', 'Terms of Service', 'Security', 'GDPR'].map((link) => (
                <li key={link}><a href="#" className="text-sm hover:text-white transition-colors">{link}</a></li>
              ))}
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-slate-500">
            &copy; {new Date().getFullYear()} GSTPilot. All rights reserved.
          </p>
          <p className="text-sm text-slate-500">
            Made with ❤️ for Indian CA firms
          </p>
        </div>
      </div>
    </footer>
  );
}

// ─── Main Component ──────────────────────────────────────
export default function LandingPage({ onGetStarted, onBookDemo }: LandingPageProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1">
        <Navbar onGetStarted={onGetStarted} />
        <HeroSection onGetStarted={onGetStarted} onBookDemo={onBookDemo} />
        <TrustSection />
        <HowItWorksSection />
        <FeaturesSection />
        <ComparisonSection />
        <TestimonialsSection />
        <PricingSection onGetStarted={onGetStarted} />
        <CTASection onGetStarted={onGetStarted} />
      </div>
      <Footer />
    </div>
  );
}

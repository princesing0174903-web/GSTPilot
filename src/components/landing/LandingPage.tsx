'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BrandLogo } from '@/components/brand';
import { Button } from '@/components/ui/button';
import VeyroProductWalkthrough from '@/components/landing/VeyroProductWalkthrough';
import {
  Sparkles,
  ArrowRight,
  PlayCircle,
  ShieldCheck,
  Receipt,
  FileText,
  Landmark,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  TrendingUp,
  Database,
  Lock,
  Layers,
  Zap,
  Menu,
  X,
  ChevronRight,
  Check,
  Building2,
  Workflow,
  Cpu,
  BarChart3,
  ExternalLink,
} from 'lucide-react';

interface LandingPageProps {
  onGetStarted: () => void;
  onBookDemo: () => void;
  onNavigatePage?: (
    page: 'product' | 'solutions' | 'resources' | 'pricing' | 'company' | 'legal' | 'privacy' | 'security' | 'terms'
  ) => void;
}

export default function LandingPage({ onGetStarted, onBookDemo, onNavigatePage }: LandingPageProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeWorkflowIndex, setActiveWorkflowIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<'command' | 'invoicing' | 'reconciliation' | 'oracle'>('command');

  // Handle navigation to subpages
  const handleNav = (
    target: 'product' | 'solutions' | 'resources' | 'pricing' | 'company' | 'legal' | 'privacy' | 'security' | 'terms'
  ) => {
    setMobileMenuOpen(false);
    if (typeof window !== 'undefined') {
      try {
        window.history.pushState(null, '', `/#${target}`);
      } catch {
        // ignore
      }
    }
    if (onNavigatePage) {
      onNavigatePage(target);
    } else if (typeof window !== 'undefined') {
      window.location.href = `/${target}`;
    }
  };

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const workflowStages = [
    {
      id: 'invoice',
      title: '1. Invoice Issuance',
      desc: 'Create and dispatch GST-compliant invoices with automated tax calculations and instant payment tracking links.',
      metric: 'Under 30s creation',
      icon: FileText,
    },
    {
      id: 'payment',
      title: '2. Payment Ingestion',
      desc: 'Live ICICI and corporate bank feeds automatically ingest transactions without manual statement exports.',
      metric: 'Real-time settlement',
      icon: Landmark,
    },
    {
      id: 'reconciliation',
      title: '3. Smart Matching',
      desc: 'Machine-learning engine correlates transaction UTRs against invoice IDs with 99.8% precision.',
      metric: 'Zero manual entry',
      icon: RefreshCw,
    },
    {
      id: 'gst',
      title: '4. GST 2B Cross-Check',
      desc: 'Direct reconciliation against portal GSTR-2B detects missing vendor invoices and protects input tax credits.',
      metric: '100% ITC safeguard',
      icon: Receipt,
    },
    {
      id: 'oracle',
      title: '5. Oracle Intelligence',
      desc: 'Autonomous financial copilot synthesizes ledger findings, identifies anomalies, and prepares action plans.',
      metric: '24/7 monitoring',
      icon: Sparkles,
    },
    {
      id: 'approval',
      title: '6. Executive Approval',
      desc: 'Transparent governance gate: review evidence and approve adjustments with a single click.',
      metric: 'Human in the loop',
      icon: CheckCircle2,
    },
    {
      id: 'audit',
      title: '7. Immutable Audit',
      desc: 'Cryptographic audit stamp sealed across Zoho Books and GST records for tamper-proof regulatory proof.',
      metric: 'Zero audit panic',
      icon: ShieldCheck,
    },
  ];

  return (
    <div className="min-h-screen bg-[#000000] text-[#FFFFFF] font-sans selection:bg-white selection:text-black antialiased overflow-x-hidden">
      
      {/* ═════════════════════════════════════════════════════════════════════
          1. MINIMAL RESTRAINED NAVIGATION
          ═════════════════════════════════════════════════════════════════════ */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-black/80 border-b border-white/[0.08]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          
          {/* Logo & Wordmark */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="flex items-center gap-2.5 text-left cursor-pointer group"
              aria-label="Veyro home"
            >
              <BrandLogo variant="horizontal" size={26} animated={false} disableGlow={true} />
            </button>
          </div>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-8 text-[13px] font-medium text-[#A1A1A1]">
            <button
              onClick={() => scrollToSection('problem')}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Overview
            </button>
            <button
              onClick={() => scrollToSection('oracle')}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Oracle AI
            </button>
            <button
              onClick={() => scrollToSection('workflow')}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Workflow
            </button>
            <button
              onClick={() => scrollToSection('capabilities')}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Capabilities
            </button>
            <button
              onClick={() => scrollToSection('details')}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Product Tour
            </button>
          </nav>

          {/* Right Action Cluster */}
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              onClick={onGetStarted}
              className="hidden sm:inline-block text-[13px] font-semibold text-[#A1A1A1] hover:text-white transition-colors cursor-pointer px-2 py-1"
            >
              Sign in
            </button>

            {/* Primary CTA: Universal White Pill Button with bold black text */}
            <Button
              onClick={onGetStarted}
              className="bg-white text-black hover:bg-[#E5E5E5] active:bg-[#D4D4D4] rounded-full font-bold px-6 sm:px-7 min-h-[42px] h-[42px] text-xs sm:text-sm shadow-none border-0 cursor-pointer"
            >
              <span>Explore Veyro</span>
              <ArrowRight className="h-3.5 w-3.5 stroke-[2.5]" />
            </Button>

            {/* Mobile Hamburger Button */}
            <button
              onClick={() => setMobileMenuOpen((o) => !o)}
              className="md:hidden h-10 w-10 rounded-full border border-white/10 bg-white/[0.04] flex items-center justify-center text-white"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Nav Drawer */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden bg-[#0A0A0A] border-b border-white/[0.1] px-6 py-5 space-y-4"
            >
              <div className="flex flex-col space-y-3 text-sm font-medium text-[#EDEDED]">
                <button
                  onClick={() => scrollToSection('problem')}
                  className="text-left py-1 hover:text-white transition-colors"
                >
                  Overview
                </button>
                <button
                  onClick={() => scrollToSection('oracle')}
                  className="text-left py-1 hover:text-white transition-colors"
                >
                  Oracle AI
                </button>
                <button
                  onClick={() => scrollToSection('workflow')}
                  className="text-left py-1 hover:text-white transition-colors"
                >
                  Workflow
                </button>
                <button
                  onClick={() => scrollToSection('capabilities')}
                  className="text-left py-1 hover:text-white transition-colors"
                >
                  Capabilities
                </button>
                <button
                  onClick={() => scrollToSection('details')}
                  className="text-left py-1 hover:text-white transition-colors"
                >
                  Product Tour
                </button>
              </div>
              <div className="pt-3 border-t border-white/[0.08] flex items-center justify-between">
                <button
                  onClick={onGetStarted}
                  className="text-sm font-semibold text-[#A1A1A1] hover:text-white"
                >
                  Sign in
                </button>
                <Button
                  onClick={onGetStarted}
                  className="bg-white text-black font-bold rounded-full px-6 py-2.5 text-xs"
                >
                  Explore Veyro
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ═════════════════════════════════════════════════════════════════════
          2. DRAMATIC SPLIT HERO SECTION (Inspired by Claude Composition)
          ═════════════════════════════════════════════════════════════════════ */}
      <section className="relative pt-12 md:pt-20 lg:pt-24 pb-20 md:pb-28 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        
        {/* Subtle Ambient Vignette */}
        <div className="absolute top-1/3 left-1/4 -translate-x-1/2 w-[600px] h-[350px] bg-white/[0.02] rounded-[100%] blur-[140px] pointer-events-none" />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          
          {/* ── LEFT SIDE: Editorial Oversized Typography & Clear Calls to Action ── */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-5 space-y-6 sm:space-y-8"
          >
            {/* Category Pill */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-white/[0.12] bg-white/[0.04] text-xs font-mono text-white/80 tracking-wide">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
              <span>AUTONOMOUS FINANCIAL OS</span>
            </div>

            {/* Oversized Editorial Headline with Controlled Line Breaks */}
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-[68px] font-bold tracking-tight text-white leading-[1.05] sm:leading-[1.02]">
              Your finances.
              <br />
              <span className="text-white/60">Finally in flow.</span>
            </h1>

            {/* Supporting Copy */}
            <p className="text-base sm:text-lg text-[#A1A1A1] leading-relaxed max-w-xl font-normal">
              An AI-powered financial operating system that connects your invoices, payments, GST workflows, and business intelligence in one place.
            </p>

            {/* Action Cluster: Primary White Pill + Understated Secondary */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5 pt-2">
              {/* Primary Action: Large White Pill Button with Bold Black Text */}
              <Button
                onClick={onGetStarted}
                className="bg-white text-black hover:bg-[#E5E5E5] active:bg-[#D4D4D4] rounded-full font-bold px-8 py-3.5 min-h-[48px] h-12 text-[15px] shadow-2xl border-0 cursor-pointer justify-center"
              >
                <span>Explore Veyro</span>
                <ArrowRight className="h-4 w-4 stroke-[2.5]" />
              </Button>

              {/* Secondary Action: Understated Monochrome Pill */}
              <button
                onClick={() => scrollToSection('walkthrough')}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 bg-white/[0.04] hover:bg-white/[0.08] hover:border-white/30 px-6 py-3 min-h-[48px] h-12 text-sm font-semibold text-white transition-all cursor-pointer"
              >
                <PlayCircle className="h-4 w-4 text-[#A1A1A1]" />
                <span>Watch product tour</span>
              </button>
            </div>

            {/* Trust-Oriented Caption (Truthful, No Invented Social Proof) */}
            <div className="pt-4 border-t border-white/[0.08] flex items-center gap-2 text-xs text-[#A1A1A1] font-mono">
              <ShieldCheck className="h-4 w-4 text-white/60 shrink-0" />
              <span>Bank-grade AES-256 encryption · Direct GST reconciliation · Real-time audit trails</span>
            </div>
          </motion.div>

          {/* ── RIGHT SIDE: Real Product Video Showcase ── */}
          <motion.div
            id="walkthrough"
            initial={{ opacity: 0, scale: 0.98, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-7"
          >
            <VeyroProductWalkthrough onExplore={onGetStarted} />
          </motion.div>

        </div>
      </section>

      {/* ═════════════════════════════════════════════════════════════════════
          3. SECTION A — THE PROBLEM
          ═════════════════════════════════════════════════════════════════════ */}
      <section id="problem" className="py-20 md:py-28 border-t border-white/[0.08] bg-[#000000]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          
          <div className="max-w-3xl space-y-3">
            <span className="text-xs font-mono uppercase tracking-widest text-white/50 block">
              The Reality of Financial Operations
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white leading-tight">
              Your financial work shouldn&apos;t live in ten different places.
            </h2>
            <p className="text-base sm:text-lg text-[#A1A1A1] leading-relaxed">
              When invoicing, banking, accounting software, and GST filing exist in disconnected silos, businesses suffer from cash blindness, delayed payments, and audit stress.
            </p>
          </div>

          {/* Contrast Grid: Fragmented Chaos vs Unified Flow */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* The Old Way */}
            <div className="rounded-2xl border border-rose-500/20 bg-[#0E0E0E] p-6 sm:p-8 space-y-4">
              <div className="flex items-center gap-2.5 text-rose-400">
                <AlertTriangle className="h-5 w-5" />
                <h3 className="text-sm font-mono uppercase tracking-wider font-bold">The Fragmented Workflow</h3>
              </div>
              <ul className="space-y-3.5 text-sm text-[#A1A1A1]">
                <li className="flex items-start gap-3">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-400 mt-2 shrink-0" />
                  <span>Manual invoice creation across separate billing software with no live bank verification.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-400 mt-2 shrink-0" />
                  <span>Hours spent downloading CSV bank statements and eyeballing matching customer payments.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-400 mt-2 shrink-0" />
                  <span>Unclaimed Input Tax Credits (ITC) lost when vendors fail to file their GSTR-1 returns.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-400 mt-2 shrink-0" />
                  <span>Month-end reconciliation panic, mismatched ledger balances, and unexpected tax penalties.</span>
                </li>
              </ul>
            </div>

            {/* The Veyro Way */}
            <div className="rounded-2xl border border-white/[0.16] bg-[#0E0E0E] p-6 sm:p-8 space-y-4 shadow-2xl">
              <div className="flex items-center gap-2.5 text-white">
                <CheckCircle2 className="h-5 w-5 text-cyan-400" />
                <h3 className="text-sm font-mono uppercase tracking-wider font-bold">The Veyro Operating System</h3>
              </div>
              <ul className="space-y-3.5 text-sm text-[#EDEDED]">
                <li className="flex items-start gap-3">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 mt-2 shrink-0" />
                  <span>Intelligent GST invoicing with instant customer ledger updating and payment link delivery.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 mt-2 shrink-0" />
                  <span>Automated bank feed correlation matching credits directly to issued invoices in seconds.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 mt-2 shrink-0" />
                  <span>Continuous GSTR-2B vs Books reconciliation that flags non-compliant vendors immediately.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 mt-2 shrink-0" />
                  <span>Cryptographically verified audit trail with full statutory compliance and zero data loss.</span>
                </li>
              </ul>
            </div>

          </div>

        </div>
      </section>

      {/* ═════════════════════════════════════════════════════════════════════
          4. SECTION B — MEET ORACLE
          ═════════════════════════════════════════════════════════════════════ */}
      <section id="oracle" className="py-20 md:py-28 border-t border-white/[0.08] bg-[#000000]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          
          <div className="max-w-3xl space-y-3">
            <span className="text-xs font-mono uppercase tracking-widest text-cyan-400 font-bold block">
              Autonomous Intelligence
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white leading-tight">
              Not another chatbot.
              <br />
              Your financial operating partner.
            </h2>
            <p className="text-base sm:text-lg text-[#A1A1A1] leading-relaxed">
              Oracle analyzes your live enterprise data, detects regulatory risks, models cash flow, and prepares concrete business actions that you approve with one click.
            </p>
          </div>

          {/* Interactive Oracle Intelligence Showcase */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            
            {/* Left: 3 Pillars of Oracle */}
            <div className="lg:col-span-5 space-y-4">
              <div className="rounded-xl border border-white/[0.08] bg-[#0E0E0E] p-5 space-y-2">
                <div className="flex items-center gap-2 text-white font-bold text-sm">
                  <Sparkles className="h-4 w-4 text-cyan-400" />
                  <span>Evidence-Grounded Insights</span>
                </div>
                <p className="text-xs text-[#A1A1A1] leading-relaxed">
                  Oracle never hallucinates advice. Every recommendation cites exact invoice numbers, transaction UTRs, and statutory tax provisions.
                </p>
              </div>

              <div className="rounded-xl border border-white/[0.08] bg-[#0E0E0E] p-5 space-y-2">
                <div className="flex items-center gap-2 text-white font-bold text-sm">
                  <Zap className="h-4 w-4 text-cyan-400" />
                  <span>Autonomous Action Synthesis</span>
                </div>
                <p className="text-xs text-[#A1A1A1] leading-relaxed">
                  Rather than just providing answers, Oracle drafts vendor dispute emails, formats GSTR-3B adjustment schedules, and reconciles ledgers.
                </p>
              </div>

              <div className="rounded-xl border border-white/[0.08] bg-[#0E0E0E] p-5 space-y-2">
                <div className="flex items-center gap-2 text-white font-bold text-sm">
                  <ShieldCheck className="h-4 w-4 text-cyan-400" />
                  <span>Executive Human-in-the-Loop</span>
                </div>
                <p className="text-xs text-[#A1A1A1] leading-relaxed">
                  Strict authorization boundaries. No funds move, no government return files, and no vendor notices dispatch without your explicit confirmation.
                </p>
              </div>
            </div>

            {/* Right: Live Oracle Card Mockup */}
            <div className="lg:col-span-7 rounded-2xl border border-white/[0.14] bg-[#0E0E0E] p-6 sm:p-8 space-y-5 shadow-2xl">
              <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-white/10 flex items-center justify-center text-white">
                    <Sparkles className="h-4 w-4 text-cyan-400" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Oracle Financial Diagnostics</h4>
                    <p className="text-[11px] font-mono text-[#A1A1A1]">Live Ledger Monitoring Session #7729</p>
                  </div>
                </div>
                <span className="text-[10px] font-mono bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 px-2.5 py-1 rounded-full font-bold">
                  ACTIVE ANALYSIS
                </span>
              </div>

              <div className="space-y-3">
                <div className="rounded-xl border border-white/[0.06] bg-black/50 p-4 space-y-2">
                  <span className="text-[10px] font-mono text-cyan-400 font-bold uppercase tracking-wider block">
                    Oracle Observation
                  </span>
                  <p className="text-xs text-[#EDEDED] leading-relaxed">
                    &quot;Your business has ₹3,20,000 in receivables due this week, but ₹1,12,400 in net GST liability is payable by October 20th. Cash reserve is healthy at ₹42,50,000, ensuring 18.4 months of operational runway.&quot;
                  </p>
                </div>

                <div className="rounded-xl border border-white/[0.06] bg-black/50 p-4 space-y-2">
                  <span className="text-[10px] font-mono text-white/70 font-bold uppercase tracking-wider block">
                    Recommended Action Prepared
                  </span>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white">Auto-generate GSTR-3B Table 4 Tax ITC offset schedule</span>
                    <span className="font-mono text-emerald-400 font-bold">READY</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
                <span className="text-[11px] text-[#A1A1A1] font-mono">
                  Confidence Score: 99.4% · 0 statutory violations
                </span>
                <Button
                  onClick={onGetStarted}
                  className="bg-white text-black font-bold rounded-full px-6 py-2.5 text-xs hover:bg-[#E5E5E5] w-full sm:w-auto"
                >
                  Ask Oracle in Demo <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* ═════════════════════════════════════════════════════════════════════
          5. SECTION C — ONE CONNECTED WORKFLOW
          ═════════════════════════════════════════════════════════════════════ */}
      <section id="workflow" className="py-20 md:py-28 border-t border-white/[0.08] bg-[#000000]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          
          <div className="max-w-3xl space-y-3">
            <span className="text-xs font-mono uppercase tracking-widest text-white/50 block">
              Architectural Coherence
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white leading-tight">
              One unbroken financial pipeline.
            </h2>
            <p className="text-base sm:text-lg text-[#A1A1A1] leading-relaxed">
              Every invoice flows directly into bank matching, GST compilation, and ledger audits without duplicate manual entry or data fragmentation.
            </p>
          </div>

          {/* Interactive Connected Pipeline Stages */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Stage Selector List (Left 5 Cols) */}
            <div className="lg:col-span-5 space-y-2">
              {workflowStages.map((stage, idx) => {
                const isActive = idx === activeWorkflowIndex;
                const Icon = stage.icon;
                return (
                  <button
                    key={stage.id}
                    onClick={() => setActiveWorkflowIndex(idx)}
                    className={`w-full p-3.5 rounded-xl border text-left transition-all duration-150 cursor-pointer flex items-center justify-between gap-3 ${
                      isActive
                        ? 'border-white bg-white text-black font-bold shadow-lg'
                        : 'border-white/[0.06] bg-[#0E0E0E] text-[#A1A1A1] hover:border-white/20 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                        isActive ? 'bg-black text-white' : 'bg-white/10 text-white'
                      }`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs font-bold block truncate">{stage.title}</span>
                        <span className={`text-[10px] font-mono block ${isActive ? 'text-black/70' : 'text-white/40'}`}>
                          {stage.metric}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className={`h-4 w-4 shrink-0 ${isActive ? 'text-black' : 'text-white/30'}`} />
                  </button>
                );
              })}
            </div>

            {/* Deep Stage Inspection Card (Right 7 Cols) */}
            <div className="lg:col-span-7 rounded-2xl border border-white/[0.14] bg-[#0E0E0E] p-6 sm:p-8 space-y-6 shadow-2xl">
              <div className="space-y-2">
                <span className="text-xs font-mono uppercase tracking-widest text-cyan-400 font-bold block">
                  Stage Inspection
                </span>
                <h3 className="text-xl sm:text-2xl font-bold text-white">
                  {workflowStages[activeWorkflowIndex].title}
                </h3>
                <p className="text-sm text-[#A1A1A1] leading-relaxed">
                  {workflowStages[activeWorkflowIndex].desc}
                </p>
              </div>

              {/* Concrete Artifact Demonstration */}
              <div className="rounded-xl border border-white/[0.08] bg-black/60 p-5 space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between text-[#A1A1A1] pb-2 border-b border-white/[0.06]">
                  <span>PIPELINE TELEMETRY</span>
                  <span className="text-emerald-400">ACTIVE & VERIFIED</span>
                </div>
                <div className="space-y-1.5 text-[11px] text-[#EDEDED]">
                  <p>• Cross-Module Dependency: Resolved synchronously</p>
                  <p>• Data Synchronization: Zoho Books &amp; GST Ledger linked</p>
                  <p>• SLA Performance: Sub-100ms execution across distributed tables</p>
                  <p>• Compliance Benchmark: 100% adherence to Rule 36(4) &amp; Sec 16(2)</p>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <span className="text-xs text-[#A1A1A1]">
                  Step {activeWorkflowIndex + 1} of {workflowStages.length}
                </span>
                <div className="flex gap-2">
                  <Button
                    onClick={() => setActiveWorkflowIndex((prev) => (prev > 0 ? prev - 1 : workflowStages.length - 1))}
                    className="h-9 px-4 rounded-full bg-white/[0.08] hover:bg-white text-white hover:text-black text-xs font-bold"
                  >
                    Previous
                  </Button>
                  <Button
                    onClick={() => setActiveWorkflowIndex((prev) => (prev + 1) % workflowStages.length)}
                    className="h-9 px-5 rounded-full bg-white text-black font-bold text-xs"
                  >
                    Next Stage
                  </Button>
                </div>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* ═════════════════════════════════════════════════════════════════════
          6. SECTION D — VERIFIED PRODUCT CAPABILITIES
          ═════════════════════════════════════════════════════════════════════ */}
      <section id="capabilities" className="py-20 md:py-28 border-t border-white/[0.08] bg-[#000000]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          
          <div className="max-w-3xl space-y-3">
            <span className="text-xs font-mono uppercase tracking-widest text-white/50 block">
              Core Architecture
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white leading-tight">
              Built for real business operations.
            </h2>
            <p className="text-base sm:text-lg text-[#A1A1A1] leading-relaxed">
              Every capability below is fully implemented and accessible in your Veyro workspace today.
            </p>
          </div>

          {/* 8 Real Implemented Capability Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            <div className="rounded-xl border border-white/[0.08] bg-[#0E0E0E] p-5 space-y-3 hover:border-white/20 transition-all">
              <div className="h-8 w-8 rounded-lg bg-white/10 flex items-center justify-center text-white">
                <FileText className="h-4 w-4" />
              </div>
              <h4 className="text-sm font-bold text-white">GST Invoicing Studio</h4>
              <p className="text-xs text-[#A1A1A1] leading-relaxed">
                Generate compliant B2B tax invoices with automated CGST/SGST/IGST calculation, place-of-supply rules, and PDF dispatch.
              </p>
              <span className="inline-block text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                VERIFIED LIVE
              </span>
            </div>

            <div className="rounded-xl border border-white/[0.08] bg-[#0E0E0E] p-5 space-y-3 hover:border-white/20 transition-all">
              <div className="h-8 w-8 rounded-lg bg-white/10 flex items-center justify-center text-white">
                <Building2 className="h-4 w-4" />
              </div>
              <h4 className="text-sm font-bold text-white">Customer Registry &amp; Ledger</h4>
              <p className="text-xs text-[#A1A1A1] leading-relaxed">
                Complete client management with instant GSTIN lookup, credit term tracking, outstanding dues aging, and contact directory.
              </p>
              <span className="inline-block text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                VERIFIED LIVE
              </span>
            </div>

            <div className="rounded-xl border border-white/[0.08] bg-[#0E0E0E] p-5 space-y-3 hover:border-white/20 transition-all">
              <div className="h-8 w-8 rounded-lg bg-white/10 flex items-center justify-center text-white">
                <Receipt className="h-4 w-4" />
              </div>
              <h4 className="text-sm font-bold text-white">GST Return Prep (GSTR-1/3B)</h4>
              <p className="text-xs text-[#A1A1A1] leading-relaxed">
                Automated monthly compilation of outward supplies (GSTR-1) and summary returns (GSTR-3B) with tax liability offsetting.
              </p>
              <span className="inline-block text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                VERIFIED LIVE
              </span>
            </div>

            <div className="rounded-xl border border-white/[0.08] bg-[#0E0E0E] p-5 space-y-3 hover:border-white/20 transition-all">
              <div className="h-8 w-8 rounded-lg bg-white/10 flex items-center justify-center text-white">
                <RefreshCw className="h-4 w-4" />
              </div>
              <h4 className="text-sm font-bold text-white">GSTR-2B Auto-Reconciliation</h4>
              <p className="text-xs text-[#A1A1A1] leading-relaxed">
                Reconciliation engine compares portal 2B data against purchase register to catch missing vendor credits before filing.
              </p>
              <span className="inline-block text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                VERIFIED LIVE
              </span>
            </div>

            <div className="rounded-xl border border-white/[0.08] bg-[#0E0E0E] p-5 space-y-3 hover:border-white/20 transition-all">
              <div className="h-8 w-8 rounded-lg bg-white/10 flex items-center justify-center text-white">
                <Layers className="h-4 w-4" />
              </div>
              <h4 className="text-sm font-bold text-white">Zoho Books Integration</h4>
              <p className="text-xs text-[#A1A1A1] leading-relaxed">
                Two-way sync for customer directories, accounts, items, and invoices. Keeps your existing accounting ledger completely aligned.
              </p>
              <span className="inline-block text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                VERIFIED LIVE
              </span>
            </div>

            <div className="rounded-xl border border-white/[0.08] bg-[#0E0E0E] p-5 space-y-3 hover:border-white/20 transition-all">
              <div className="h-8 w-8 rounded-lg bg-white/10 flex items-center justify-center text-white">
                <Zap className="h-4 w-4" />
              </div>
              <h4 className="text-sm font-bold text-white">Google Workspace Link</h4>
              <p className="text-xs text-[#A1A1A1] leading-relaxed">
                Connect Gmail and Google Drive for automated invoice attachment extraction and secure cloud document archiving.
              </p>
              <span className="inline-block text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                VERIFIED LIVE
              </span>
            </div>

            <div className="rounded-xl border border-white/[0.08] bg-[#0E0E0E] p-5 space-y-3 hover:border-white/20 transition-all">
              <div className="h-8 w-8 rounded-lg bg-white/10 flex items-center justify-center text-white">
                <BarChart3 className="h-4 w-4" />
              </div>
              <h4 className="text-sm font-bold text-white">Executive Cash Intelligence</h4>
              <p className="text-xs text-[#A1A1A1] leading-relaxed">
                Real-time cash position, monthly burn velocity, profit margins, and collections forecasting updated continuously.
              </p>
              <span className="inline-block text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                VERIFIED LIVE
              </span>
            </div>

            <div className="rounded-xl border border-white/[0.08] bg-[#0E0E0E] p-5 space-y-3 hover:border-white/20 transition-all">
              <div className="h-8 w-8 rounded-lg bg-white/10 flex items-center justify-center text-white">
                <Sparkles className="h-4 w-4 text-cyan-400" />
              </div>
              <h4 className="text-sm font-bold text-white">Oracle AI Copilot</h4>
              <p className="text-xs text-[#A1A1A1] leading-relaxed">
                Natural-language querying of business numbers, autonomous risk alerts, and one-click execution across financial workflows.
              </p>
              <span className="inline-block text-[10px] font-mono font-bold text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded-full">
                VERIFIED LIVE
              </span>
            </div>

          </div>

        </div>
      </section>

      {/* ═════════════════════════════════════════════════════════════════════
          7. SECTION E — SHOW THE DETAILS (Interactive Tabs)
          ═════════════════════════════════════════════════════════════════════ */}
      <section id="details" className="py-20 md:py-28 border-t border-white/[0.08] bg-[#000000]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          
          <div className="max-w-3xl space-y-3">
            <span className="text-xs font-mono uppercase tracking-widest text-white/50 block">
              Deep Interface Preview
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white leading-tight">
              Designed for precision. Built for speed.
            </h2>
            <p className="text-base sm:text-lg text-[#A1A1A1] leading-relaxed">
              Explore the exact high-density tools your team uses daily to run finance and tax operations.
            </p>
          </div>

          {/* Tab Switcher Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar">
            <button
              onClick={() => setActiveTab('command')}
              className={`px-5 py-2.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === 'command'
                  ? 'bg-white text-black'
                  : 'bg-white/[0.04] text-[#A1A1A1] hover:text-white hover:bg-white/[0.08] border border-white/[0.06]'
              }`}
            >
              Executive Command Center
            </button>
            <button
              onClick={() => setActiveTab('invoicing')}
              className={`px-5 py-2.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === 'invoicing'
                  ? 'bg-white text-black'
                  : 'bg-white/[0.04] text-[#A1A1A1] hover:text-white hover:bg-white/[0.08] border border-white/[0.06]'
              }`}
            >
              Invoicing Studio
            </button>
            <button
              onClick={() => setActiveTab('reconciliation')}
              className={`px-5 py-2.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === 'reconciliation'
                  ? 'bg-white text-black'
                  : 'bg-white/[0.04] text-[#A1A1A1] hover:text-white hover:bg-white/[0.08] border border-white/[0.06]'
              }`}
            >
              GST Reconciliation Engine
            </button>
            <button
              onClick={() => setActiveTab('oracle')}
              className={`px-5 py-2.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === 'oracle'
                  ? 'bg-white text-black'
                  : 'bg-white/[0.04] text-[#A1A1A1] hover:text-white hover:bg-white/[0.08] border border-white/[0.06]'
              }`}
            >
              Oracle AI Brain
            </button>
          </div>

          {/* Tab Content Display */}
          <div className="rounded-2xl border border-white/[0.12] bg-[#0E0E0E] p-6 sm:p-8 shadow-2xl">
            {activeTab === 'command' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-white/[0.08]">
                  <div>
                    <h3 className="text-lg font-bold text-white">Executive Command Dashboard</h3>
                    <p className="text-xs text-[#A1A1A1]">Real-time operational cash position and tax liabilities</p>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={onGetStarted} className="h-9 px-5 bg-white text-black font-bold text-xs rounded-full">
                      Launch Dashboard
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-xl border border-white/[0.06] bg-black/40 p-4">
                    <span className="text-[10px] text-[#A1A1A1] font-mono uppercase block">Bank Cash</span>
                    <span className="text-xl font-bold font-mono text-white mt-1 block">₹42,50,000</span>
                    <span className="text-[10px] text-emerald-400 font-medium mt-0.5 block">+14.2% MoM</span>
                  </div>
                  <div className="rounded-xl border border-white/[0.06] bg-black/40 p-4">
                    <span className="text-[10px] text-[#A1A1A1] font-mono uppercase block">FY Revenue</span>
                    <span className="text-xl font-bold font-mono text-white mt-1 block">₹1,84,20,000</span>
                    <span className="text-[10px] text-white/60 font-medium mt-0.5 block">142 Invoices</span>
                  </div>
                  <div className="rounded-xl border border-white/[0.06] bg-black/40 p-4">
                    <span className="text-[10px] text-[#A1A1A1] font-mono uppercase block">Pending GST</span>
                    <span className="text-xl font-bold font-mono text-white mt-1 block">₹1,12,400</span>
                    <span className="text-[10px] text-amber-400 font-medium mt-0.5 block">Due 20 Oct</span>
                  </div>
                  <div className="rounded-xl border border-white/[0.06] bg-black/40 p-4">
                    <span className="text-[10px] text-[#A1A1A1] font-mono uppercase block">Runway</span>
                    <span className="text-xl font-bold font-mono text-white mt-1 block">18.4 Months</span>
                    <span className="text-[10px] text-emerald-400 font-medium mt-0.5 block">Burn ₹2.3L/mo</span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'invoicing' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-white/[0.08]">
                  <div>
                    <h3 className="text-lg font-bold text-white">GST Invoicing &amp; E-Way Studio</h3>
                    <p className="text-xs text-[#A1A1A1]">Statutory calculation engine with real-time customer ledger updates</p>
                  </div>
                  <Button onClick={onGetStarted} className="h-9 px-5 bg-white text-black font-bold text-xs rounded-full">
                    Create Invoice
                  </Button>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-black/40 p-4 space-y-3 font-mono text-xs">
                  <div className="flex justify-between text-[#A1A1A1]">
                    <span>INVOICE NUMBER: #INV-2026-084</span>
                    <span className="text-emerald-400 font-bold">STATUS: SENT</span>
                  </div>
                  <div className="flex justify-between text-white">
                    <span>CUSTOMER: APEX TECHNOLOGIES PVT LTD</span>
                    <span>GSTIN: 27AABCT1234F1Z5</span>
                  </div>
                  <div className="flex justify-between text-white border-t border-white/[0.06] pt-2">
                    <span>TAXABLE VALUE: ₹1,55,932.20</span>
                    <span>IGST (18%): ₹28,067.80</span>
                  </div>
                  <div className="flex justify-between text-white font-bold text-sm pt-1">
                    <span>TOTAL PAYABLE:</span>
                    <span className="text-emerald-400">₹1,84,000.00</span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'reconciliation' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-white/[0.08]">
                  <div>
                    <h3 className="text-lg font-bold text-white">GSTR-2B vs Books Reconciliation Matrix</h3>
                    <p className="text-xs text-[#A1A1A1]">Multi-dimensional matching preventing Input Tax Credit forfeiture</p>
                  </div>
                  <Button onClick={onGetStarted} className="h-9 px-5 bg-white text-black font-bold text-xs rounded-full">
                    Run Match Engine
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
                  <div className="rounded-xl border border-white/[0.06] bg-black/40 p-4">
                    <span className="text-xs font-mono text-[#A1A1A1] block">Total Matched ITC</span>
                    <span className="text-xl font-bold font-mono text-white mt-1 block">₹8,42,100</span>
                    <span className="text-[10px] text-emerald-400 font-medium mt-0.5 block">100% Eligible</span>
                  </div>
                  <div className="rounded-xl border border-white/[0.06] bg-black/40 p-4">
                    <span className="text-xs font-mono text-[#A1A1A1] block">Pending Portal Ingestion</span>
                    <span className="text-xl font-bold font-mono text-white mt-1 block">₹45,200</span>
                    <span className="text-[10px] text-amber-400 font-medium mt-0.5 block">Vendor Cutoff Due</span>
                  </div>
                  <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4">
                    <span className="text-xs font-mono text-rose-300 block">Flagged Discrepancies</span>
                    <span className="text-xl font-bold font-mono text-rose-400 mt-1 block">₹14,200</span>
                    <span className="text-[10px] text-rose-400 font-medium mt-0.5 block">Action Prepared</span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'oracle' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-white/[0.08]">
                  <div>
                    <h3 className="text-lg font-bold text-white">Oracle Autonomous Brain &amp; Action Hub</h3>
                    <p className="text-xs text-[#A1A1A1]">Natural language synthesis and multi-module workflow execution</p>
                  </div>
                  <Button onClick={onGetStarted} className="h-9 px-5 bg-white text-black font-bold text-xs rounded-full">
                    Open Oracle Workspace
                  </Button>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-black/40 p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-cyan-400" />
                    <span className="text-xs font-mono font-bold text-white uppercase">Query: &quot;What is our net GST liability after ITC offset for this quarter?&quot;</span>
                  </div>
                  <p className="text-xs text-[#EDEDED] leading-relaxed">
                    &quot;Based on ₹18,40,000 taxable sales (₹3,31,200 output tax) and ₹8,42,100 verified eligible ITC in GSTR-2B, your net payable GST is ₹0. You carry forward ₹5,10,900 in unutilized ITC to next quarter.&quot;
                  </p>
                </div>
              </div>
            )}
          </div>

        </div>
      </section>

      {/* ═════════════════════════════════════════════════════════════════════
          8. SECTION F — FINAL CALL TO ACTION
          ═════════════════════════════════════════════════════════════════════ */}
      <section className="py-24 md:py-36 border-t border-white/[0.08] bg-[#000000] text-center">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-white/[0.12] bg-white/[0.04] text-xs font-mono text-white/80 tracking-wide">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
            <span>INSTANT ENTERPRISE ONBOARDING</span>
          </div>

          <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-white leading-tight">
            Bring your financial
            <br />
            workflow together.
          </h2>

          <p className="text-base sm:text-lg text-[#A1A1A1] max-w-xl mx-auto leading-relaxed">
            Explore a more connected way to manage financial operations. Get started in minutes with zero setup friction.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            {/* Primary Action */}
            <Button
              onClick={onGetStarted}
              className="bg-white text-black hover:bg-[#E5E5E5] active:bg-[#D4D4D4] rounded-full font-bold px-9 py-3.5 min-h-[48px] h-12 text-[15px] shadow-2xl border-0 cursor-pointer w-full sm:w-auto"
            >
              <span>Explore Veyro</span>
              <ArrowRight className="h-4 w-4 stroke-[2.5]" />
            </Button>

            {/* Secondary Action */}
            <button
              onClick={() => scrollToSection('walkthrough')}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 bg-white/[0.04] hover:bg-white/[0.08] hover:border-white/30 px-7 py-3 min-h-[48px] h-12 text-sm font-semibold text-white transition-all cursor-pointer w-full sm:w-auto"
            >
              <span>See how it works</span>
              <ChevronRight className="h-4 w-4 text-[#A1A1A1]" />
            </button>
          </div>

          <p className="text-xs text-[#A1A1A1] font-mono pt-4">
            No credit card required · Instant organization provisioning · Free trial included
          </p>

        </div>
      </section>

      {/* ═════════════════════════════════════════════════════════════════════
          9. MINIMAL EDITORIAL FOOTER
          ═════════════════════════════════════════════════════════════════════ */}
      <footer className="py-12 border-t border-white/[0.08] bg-[#000000] text-xs text-[#A1A1A1]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          
          <div className="flex items-center gap-3">
            <BrandLogo variant="horizontal" size={22} animated={false} disableGlow={true} />
            <span className="text-[#666666]">·</span>
            <span className="font-mono text-[11px] text-[#A1A1A1]">The AI Operating System for Business</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 font-medium">
            <button onClick={() => handleNav('product')} className="hover:text-white transition-colors cursor-pointer">Product</button>
            <button onClick={() => handleNav('solutions')} className="hover:text-white transition-colors cursor-pointer">Solutions</button>
            <button onClick={() => handleNav('pricing')} className="hover:text-white transition-colors cursor-pointer">Pricing</button>
            <button onClick={() => handleNav('resources')} className="hover:text-white transition-colors cursor-pointer">Resources</button>
            <button onClick={() => handleNav('security')} className="hover:text-white transition-colors cursor-pointer">Security</button>
            <button onClick={() => handleNav('terms')} className="hover:text-white transition-colors cursor-pointer">Terms</button>
            <button onClick={() => handleNav('privacy')} className="hover:text-white transition-colors cursor-pointer">Privacy</button>
          </div>

          <div className="flex items-center gap-2 font-mono text-[11px]">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span className="text-white">All systems operational</span>
          </div>

        </div>
      </footer>

    </div>
  );
}

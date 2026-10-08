'use client'

import React, { useState } from 'react'
import { motion, type Variants } from 'framer-motion'
import {
  Sparkles,
  FileText,
  Landmark,
  GitCompare,
  BrainCircuit,
  CreditCard,
  MessageSquare,
  ShieldCheck,
  Lock,
  Building2,
  Banknote,
  Receipt,
  Send,
  ArrowRight,
  Check,
  Plus,
  Minus,
  Menu,
  TrendingUp,
  Zap,
  Twitter,
  Linkedin,
  Github,
  FileCheck,
  Plug,
  Users,
  Bot,
  ArrowUpRight,
  Bell,
  CheckCircle2,
  AlertCircle,
  Clock,
  X,
} from 'lucide-react'

/* ════════════════════════════════════════════════════════════════════════
   VEYROLanding — Luxury monochrome landing page
   20 sections · liquid-glass · cinematic · space-grade minimalism
   ════════════════════════════════════════════════════════════════════════ */

interface VEYROLandingProps {
  onGetStarted?: () => void
  onBookDemo?: () => void
}

/* ─── Motion presets ───────────────────────────────────────────────────── */

const VIEWPORT = { once: true, margin: '-80px' } as const

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20, filter: 'blur(8px)' },
  show: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.7, ease: 'easeOut' as const },
  },
}

const staggerParent: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
}

/* ─── Tiny helpers ─────────────────────────────────────────────────────── */

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full gp-glass px-3 py-1.5 text-xs font-medium tracking-wide text-white/70">
      <span className="h-1.5 w-1.5 rounded-full bg-white/80" />
      {children}
    </span>
  )
}

function PrimaryButton({
  children,
  onClick,
  className = '',
}: {
  children: React.ReactNode
  onClick?: () => void
  className?: string
}) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.2, ease: 'easeOut' as const }}
      className={`group inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition-shadow hover:shadow-[0_8px_32px_-8px_rgba(255,255,255,0.4)] ${className}`}
    >
      {children}
    </motion.button>
  )
}

function GhostButton({
  children,
  onClick,
  className = '',
}: {
  children: React.ReactNode
  onClick?: () => void
  className?: string
}) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.2, ease: 'easeOut' as const }}
      className={`inline-flex items-center justify-center gap-2 rounded-full gp-glass px-6 py-3 text-sm font-semibold text-white/90 transition-colors hover:text-white ${className}`}
    >
      {children}
    </motion.button>
  )
}

function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = 'center',
}: {
  eyebrow?: string
  title: React.ReactNode
  subtitle?: React.ReactNode
  align?: 'center' | 'left'
}) {
  return (
    <motion.div
      variants={staggerParent}
      initial="hidden"
      whileInView="show"
      viewport={VIEWPORT}
      className={`flex flex-col gap-5 ${align === 'center' ? 'items-center text-center' : 'items-start text-left'}`}
    >
      {eyebrow && (
        <motion.div variants={fadeUp}>
          <Eyebrow>{eyebrow}</Eyebrow>
        </motion.div>
      )}
      <motion.h2
        variants={fadeUp}
        className="max-w-4xl text-4xl font-semibold leading-[1.05] tracking-[-0.03em] text-white md:text-5xl lg:text-6xl"
      >
        {title}
      </motion.h2>
      {subtitle && (
        <motion.p
          variants={fadeUp}
          className={`max-w-2xl text-base leading-relaxed text-white/65 md:text-lg ${align === 'center' ? 'mx-auto' : ''}`}
        >
          {subtitle}
        </motion.p>
      )}
    </motion.div>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   TOP NAV
   ════════════════════════════════════════════════════════════════════════ */

function TopNav({ onGetStarted, onBookDemo }: VEYROLandingProps) {
  const [open, setOpen] = useState(false)
  const links = [
    { label: 'Product', href: '#features' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'Security', href: '#security' },
    { label: 'Customers', href: '#customers' },
  ]

  const handleNav = (href: string) => {
    setOpen(false)
    const el = document.querySelector(href)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-4 pt-4">
      <nav className="mx-auto flex max-w-7xl items-center justify-between rounded-full gp-glass-strong px-4 py-2.5 md:px-6">
        {/* Brand */}
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="flex items-center gap-2 text-sm font-semibold tracking-tight text-white"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-white text-black">
            <Sparkles className="h-4 w-4" />
          </span>
          <span className="hidden sm:inline">VEYRO™</span>
          <span className="sm:hidden">VEYRO</span>
        </button>

        {/* Center links */}
        <div className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <button
              key={l.label}
              onClick={() => handleNav(l.href)}
              className="rounded-full px-4 py-1.5 text-sm font-medium text-white/65 transition-colors hover:text-white"
            >
              {l.label}
            </button>
          ))}
        </div>

        {/* Right CTAs */}
        <div className="flex items-center gap-2">
          <button
            onClick={onBookDemo}
            className="hidden rounded-full px-4 py-1.5 text-sm font-medium text-white/70 transition-colors hover:text-white sm:inline-flex"
          >
            Book Demo
          </button>
          <button
            onClick={onGetStarted}
            className="rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-black transition-shadow hover:shadow-[0_4px_16px_-4px_rgba(255,255,255,0.4)]"
          >
            Start Free
          </button>
          <button
            onClick={() => setOpen((v) => !v)}
            className="ml-1 inline-flex h-8 w-8 items-center justify-center rounded-full text-white/70 md:hidden"
            aria-label="Toggle menu"
          >
            {open ? <Minus className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile drawer */}
      {open && (
        <div className="mx-auto mt-2 max-w-7xl rounded-2xl gp-glass-strong p-3 md:hidden">
          {links.map((l) => (
            <button
              key={l.label}
              onClick={() => handleNav(l.href)}
              className="block w-full rounded-lg px-4 py-2.5 text-left text-sm font-medium text-white/75 transition-colors hover:bg-white/5 hover:text-white"
            >
              {l.label}
            </button>
          ))}
          <button
            onClick={() => {
              setOpen(false)
              onBookDemo?.()
            }}
            className="mt-1 block w-full rounded-lg px-4 py-2.5 text-left text-sm font-medium text-white/75 transition-colors hover:bg-white/5 hover:text-white"
          >
            Book Demo
          </button>
        </div>
      )}
    </header>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   SECTION 1 — HERO
   ════════════════════════════════════════════════════════════════════════ */

function HeroProductMock() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30, filter: 'blur(12px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.9, ease: 'easeOut' as const, delay: 0.3 }}
      className="relative mx-auto mt-16 w-full max-w-6xl"
    >
      {/* Browser frame */}
      <div className="overflow-hidden rounded-2xl gp-glass-strong gp-ring shadow-[0_40px_120px_-20px_rgba(0,0,0,0.9)]">
        {/* Title bar */}
        <div className="flex items-center gap-3 border-b border-white/8 px-4 py-3">
          <div className="flex gap-1.5">
            <span className="h-3 w-3 rounded-full bg-white/20" />
            <span className="h-3 w-3 rounded-full bg-white/15" />
            <span className="h-3 w-3 rounded-full bg-white/10" />
          </div>
          <div className="mx-auto flex w-full max-w-md items-center gap-2 rounded-md bg-white/5 px-3 py-1.5 text-[11px] text-white/40">
            <Lock className="h-3 w-3" />
            app.veyro.comfinity/dashboard
          </div>
        </div>

        {/* Body: sidebar + main */}
        <div className="grid grid-cols-12">
          {/* Sidebar */}
          <aside className="col-span-3 hidden flex-col gap-1 border-r border-white/8 p-3 md:flex">
            <div className="mb-3 flex items-center gap-2 px-2">
              <div className="h-6 w-6 rounded bg-white/80" />
              <div className="h-2.5 w-20 rounded bg-white/30" />
            </div>
            {[
              { i: <LayoutsIcon />, l: 'Overview', active: true },
              { i: <FileText className="h-4 w-4" />, l: 'Returns' },
              { i: <GitCompare className="h-4 w-4" />, l: 'Reconcile' },
              { i: <Banknote className="h-4 w-4" />, l: 'Banking' },
              { i: <Receipt className="h-4 w-4" />, l: 'Invoices' },
              { i: <Bot className="h-4 w-4" />, l: 'Oracle' },
              { i: <Bell className="h-4 w-4" />, l: 'Notices' },
            ].map((item, idx) => (
              <div
                key={idx}
                className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs ${
                  item.active ? 'bg-white/10 text-white' : 'text-white/50'
                }`}
              >
                {item.i}
                <span>{item.l}</span>
              </div>
            ))}
          </aside>

          {/* Main */}
          <main className="col-span-12 p-4 md:col-span-9 md:p-6">
            {/* Top bar */}
            <div className="mb-5 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-white">
                  Good morning, Aarav
                </div>
                <div className="text-[11px] text-white/45">
                  Here&apos;s your finance at a glance.
                </div>
              </div>
              <div className="hidden items-center gap-2 sm:flex">
                <div className="rounded-md gp-glass px-2.5 py-1.5 text-[11px] text-white/60">
                  Aug 2026
                </div>
                <div className="rounded-md bg-white px-2.5 py-1.5 text-[11px] font-semibold text-black">
                  File now
                </div>
              </div>
            </div>

            {/* KPI cards */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                { l: 'GST Collected', v: '₹2.4Cr', d: '+12.4%' },
                { l: 'ITC Available', v: '₹1.9Cr', d: '+8.1%' },
                { l: 'Net Payable', v: '₹48L', d: '-3.2%' },
                { l: 'Reconciled', v: '99.8%', d: '+0.4%' },
              ].map((kpi, i) => (
                <div key={i} className="rounded-xl gp-glass p-3">
                  <div className="text-[10px] uppercase tracking-wider text-white/45">
                    {kpi.l}
                  </div>
                  <div className="mt-1 text-lg font-semibold text-white">
                    {kpi.v}
                  </div>
                  <div className="mt-0.5 text-[10px] text-white/55">
                    {kpi.d} vs last mo.
                  </div>
                </div>
              ))}
            </div>

            {/* Chart + side */}
            <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
              {/* Chart */}
              <div className="rounded-xl gp-glass p-4 lg:col-span-2">
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-xs font-medium text-white/70">
                    Cashflow · last 90 days
                  </div>
                  <div className="flex gap-1">
                    <span className="rounded bg-white/10 px-2 py-0.5 text-[10px] text-white">
                      90D
                    </span>
                    <span className="rounded px-2 py-0.5 text-[10px] text-white/40">
                      1Y
                    </span>
                  </div>
                </div>
                {/* Faux chart */}
                <svg viewBox="0 0 400 120" className="h-28 w-full">
                  <defs>
                    <linearGradient id="gp-fade" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgba(255,255,255,0.25)" />
                      <stop offset="100%" stopColor="rgba(255,255,255,0)" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M0,90 L40,70 L80,80 L120,55 L160,65 L200,40 L240,55 L280,30 L320,45 L360,20 L400,35 L400,120 L0,120 Z"
                    fill="url(#gp-fade)"
                  />
                  <path
                    d="M0,90 L40,70 L80,80 L120,55 L160,65 L200,40 L240,55 L280,30 L320,45 L360,20 L400,35"
                    fill="none"
                    stroke="rgba(255,255,255,0.85)"
                    strokeWidth="1.5"
                  />
                </svg>
              </div>

              {/* Activity */}
              <div className="rounded-xl gp-glass p-4">
                <div className="mb-3 text-xs font-medium text-white/70">
                  Live activity
                </div>
                <div className="space-y-3">
                  {[
                    { i: <CheckCircle2 className="h-3.5 w-3.5" />, t: 'GSTR-1 filed', s: '2m ago', c: 'text-white/80' },
                    { i: <AlertCircle className="h-3.5 w-3.5" />, t: '2A mismatch found', s: '14m ago', c: 'text-white/55' },
                    { i: <Banknote className="h-3.5 w-3.5" />, t: 'UPI autopay received', s: '38m ago', c: 'text-white/55' },
                    { i: <Bot className="h-3.5 w-3.5" />, t: 'Oracle insight ready', s: '1h ago', c: 'text-white/55' },
                  ].map((a, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <span className={`mt-0.5 ${a.c}`}>{a.i}</span>
                      <div>
                        <div className="text-[11px] text-white/80">{a.t}</div>
                        <div className="text-[10px] text-white/40">{a.s}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>

      {/* Subtle floor glow */}
      <div className="pointer-events-none absolute -bottom-10 left-1/2 h-32 w-3/4 -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
    </motion.div>
  )
}

function HeroSection({ onGetStarted, onBookDemo }: VEYROLandingProps) {
  return (
    <section
      id="hero"
      className="gp-grain relative overflow-hidden px-6 pb-20 pt-36 md:pt-44"
    >
      {/* Radial glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(60% 50% at 50% 0%, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.04) 30%, transparent 70%)',
        }}
      />

      <div className="relative mx-auto flex max-w-7xl flex-col items-center text-center">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' as const }}
        >
          <Eyebrow>The Financial Operating System for India</Eyebrow>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20, filter: 'blur(10px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.8, ease: 'easeOut' as const, delay: 0.05 }}
          className="mt-7 max-w-4xl text-6xl font-semibold leading-[0.98] tracking-[-0.04em] text-white md:text-7xl lg:text-8xl"
        >
          The AI Operating System
          <br />
          of India
          <sup className="ml-1 align-super text-2xl font-medium text-white/55 md:text-3xl lg:text-4xl">
            ™
          </sup>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16, filter: 'blur(8px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.8, ease: 'easeOut' as const, delay: 0.15 }}
          className="mt-7 max-w-2xl text-base leading-relaxed text-white/65 md:text-lg"
        >
          An autonomous financial operating system that files GST, reconciles
          transactions, predicts cash flow, and executes business operations
          automatically.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut' as const, delay: 0.25 }}
          className="mt-9 flex flex-col items-center gap-3 sm:flex-row"
        >
          <PrimaryButton onClick={onGetStarted} className="w-full sm:w-auto">
            Start Free
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </PrimaryButton>
          <GhostButton onClick={onBookDemo} className="w-full sm:w-auto">
            Book Demo
          </GhostButton>
        </motion.div>

        {/* Micro stats */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut' as const, delay: 0.35 }}
          className="mt-12 grid w-full max-w-4xl grid-cols-2 gap-px overflow-hidden rounded-2xl gp-glass md:grid-cols-4"
        >
          {[
            { v: '10,000+', l: 'CA Firms' },
            { v: '100,000+', l: 'Businesses' },
            { v: '1M+', l: 'Invoices' },
            { v: '99.99%', l: 'Uptime' },
          ].map((s) => (
            <div key={s.l} className="px-4 py-5">
              <div className="text-2xl font-semibold tracking-tight text-white md:text-3xl">
                {s.v}
              </div>
              <div className="mt-1 text-xs text-white/55">{s.l}</div>
            </div>
          ))}
        </motion.div>

        {/* Product mock */}
        <HeroProductMock />
      </div>
    </section>
  )
}

/* Small inline icon used in hero sidebar (avoids adding a Layout import) */
function LayoutsIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   SECTION 2 — TRUSTED BY (marquee)
   ════════════════════════════════════════════════════════════════════════ */

const TRUST_LOGOS = [
  'Northstar Capital',
  'Veridian Tech',
  'Meridian Foods',
  'Aurum Ventures',
  'Kestrel Logistics',
  'Sarvam Industries',
  'Pinnacle Retail',
  'Vantage Media',
  'Crestline Pharma',
  'Helix Mobility',
]

function TrustedBySection() {
  const list = [...TRUST_LOGOS, ...TRUST_LOGOS]
  return (
    <section
      id="customers"
      className="relative border-y border-white/8 py-20 md:py-24"
    >
      <div className="mx-auto max-w-7xl px-6">
        <motion.p
          initial={{ opacity: 0, y: 12, filter: 'blur(6px)' }}
          whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          viewport={VIEWPORT}
          transition={{ duration: 0.7, ease: 'easeOut' as const }}
          className="text-center text-sm font-medium uppercase tracking-[0.2em] text-white/45"
        >
          Trusted by India&apos;s most ambitious finance teams
        </motion.p>
      </div>

      {/* Marquee */}
      <div className="relative mt-10 overflow-hidden">
        {/* Side fades */}
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-32 bg-gradient-to-r from-black to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-32 bg-gradient-to-l from-black to-transparent" />
        <div className="flex w-max gp-marquee items-center gap-16 px-8">
          {list.map((name, i) => (
            <span
              key={`${name}-${i}`}
              className="whitespace-nowrap font-serif text-2xl font-medium tracking-tight text-white/45 transition-colors hover:text-white/80 md:text-3xl"
              style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
            >
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   SECTION 3 — FEATURES (6 cards)
   ════════════════════════════════════════════════════════════════════════ */

const FEATURES = [
  {
    icon: FileText,
    title: 'GST Filing',
    desc: 'GSTR-1, 3B, 2A/2B reconciled and filed — autonomously.',
  },
  {
    icon: Landmark,
    title: 'Banking',
    desc: 'Live feeds, UPI autopay, and instant reconciliation.',
  },
  {
    icon: GitCompare,
    title: 'Reconciliation',
    desc: 'Books to 2A/2B matched at 99.8% accuracy in seconds.',
  },
  {
    icon: BrainCircuit,
    title: 'AI Forecasting',
    desc: 'Predict cash flow, ITC, and tax liability 90 days out.',
  },
  {
    icon: CreditCard,
    title: 'Collections',
    desc: 'Auto reminders, payment links, and aging intelligence.',
  },
  {
    icon: Bot,
    title: 'Oracle',
    desc: 'An AI CFO that answers any question about your finance.',
  },
]

function FeaturesSection() {
  return (
    <section id="features" className="relative px-6 py-24 md:py-32">
      <div className="mx-auto max-w-7xl">
        <SectionHeading
          eyebrow="VEYRO"
          title="One platform. Every financial operation."
          subtitle="Six clouds working as one — replacing a dozen disconnected tools with a single autonomous system."
        />

        <motion.div
          variants={staggerParent}
          initial="hidden"
          whileInView="show"
          viewport={VIEWPORT}
          className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {FEATURES.map((f) => (
            <motion.div
              key={f.title}
              variants={fadeUp}
              whileHover={{ scale: 1.02, y: -2 }}
              transition={{ duration: 0.25, ease: 'easeOut' as const }}
              className="group relative overflow-hidden rounded-2xl gp-glass gp-ring p-6"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/8 text-white">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-5 text-lg font-semibold tracking-tight text-white">
                {f.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-white/55">
                {f.desc}
              </p>
              {/* Hover hint */}
              <div className="mt-5 flex items-center gap-1 text-xs font-medium text-white/40 transition-colors group-hover:text-white/80">
                Explore
                <ArrowUpRight className="h-3.5 w-3.5" />
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   SECTION 4 — PRODUCT DEMO (sticky left, scrolling right)
   ════════════════════════════════════════════════════════════════════════ */

function StickyPair({
  children,
  stickySide = 'left',
}: {
  children: [React.ReactNode, React.ReactNode]
  stickySide?: 'left' | 'right'
}) {
  return (
    <div className="grid grid-cols-1 items-start gap-12 lg:grid-cols-2 lg:gap-16">
      <div
        className={`lg:sticky lg:top-32 lg:h-fit ${stickySide === 'right' ? 'lg:order-2' : ''}`}
      >
        {children[0]}
      </div>
      <div className={stickySide === 'right' ? 'lg:order-1' : ''}>
        {children[1]}
      </div>
    </div>
  )
}

function StickyCopyBlock({
  eyebrow,
  title,
  body,
  bullets,
}: {
  eyebrow: string
  title: string
  body?: string
  bullets?: string[]
}) {
  return (
    <motion.div
      variants={staggerParent}
      initial="hidden"
      whileInView="show"
      viewport={VIEWPORT}
      className="flex flex-col gap-5"
    >
      <motion.div variants={fadeUp}>
        <Eyebrow>{eyebrow}</Eyebrow>
      </motion.div>
      <motion.h2
        variants={fadeUp}
        className="text-4xl font-semibold leading-[1.05] tracking-[-0.03em] text-white md:text-5xl"
      >
        {title}
      </motion.h2>
      {body && (
        <motion.p
          variants={fadeUp}
          className="max-w-xl text-base leading-relaxed text-white/65 md:text-lg"
        >
          {body}
        </motion.p>
      )}
      {bullets && (
        <motion.ul variants={fadeUp} className="mt-2 space-y-3">
          {bullets.map((b) => (
            <li key={b} className="flex items-start gap-3 text-sm text-white/75">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-white" />
              <span>{b}</span>
            </li>
          ))}
        </motion.ul>
      )}
    </motion.div>
  )
}

function ProductDemoSection() {
  return (
    <section id="product-demo" className="relative px-6 py-24 md:py-32">
      <div className="mx-auto max-w-7xl">
        <StickyPair stickySide="left">
          <StickyCopyBlock
            eyebrow="Product Demo"
            title="Watch the entire compliance workflow run itself."
            body="From ingestion to filing to reconciliation — every step executes autonomously. You review. Oracle decides."
            bullets={[
              'Auto-prepared from your books in seconds',
              'Mismatch resolution before filing',
              'ARN generated and archived',
            ]}
          />

          {/* Right: stacked glass panels */}
          <div className="flex flex-col gap-6">
            {[
              {
                tag: 'Step 01',
                title: 'Filing in progress',
                state: 'GSTR-3B · August 2026',
                body: (
                  <div className="space-y-2.5">
                    {[
                      { l: 'Pulling from books', done: true },
                      { l: 'Reconciling 2A/2B', done: true },
                      { l: 'Computing liability', done: false },
                      { l: 'Awaiting ARN', done: false },
                    ].map((s) => (
                      <div
                        key={s.l}
                        className="flex items-center justify-between rounded-lg bg-white/4 px-3 py-2"
                      >
                        <span className="text-xs text-white/70">{s.l}</span>
                        {s.done ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                        ) : (
                          <span className="h-3.5 w-3.5 animate-pulse rounded-full border border-white/30 border-t-white" />
                        )}
                      </div>
                    ))}
                  </div>
                ),
              },
              {
                tag: 'Step 02',
                title: 'Reconciled',
                state: '1,284 invoices · 99.8% match',
                body: (
                  <div>
                    <div className="mb-2 flex items-center justify-between text-xs text-white/55">
                      <span>Matched</span>
                      <span>1,282 / 1,284</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                      <div className="h-full w-[99.8%] bg-white" />
                    </div>
                    <div className="mt-3 text-[11px] text-white/45">
                      2 mismatches auto-flagged for review
                    </div>
                  </div>
                ),
              },
              {
                tag: 'Step 03',
                title: 'Oracle summary',
                state: 'AI CFO · Monthly briefing',
                body: (
                  <div className="space-y-2 text-xs leading-relaxed text-white/65">
                    <p>
                      <span className="text-white">Net liability:</span> ₹48L,
                      down 3.2% MoM due to higher ITC utilization.
                    </p>
                    <p>
                      <span className="text-white">Forecast:</span> Q3 collections
                      tracking 8% ahead of plan.
                    </p>
                  </div>
                ),
              },
            ].map((panel, i) => (
              <motion.div
                key={panel.title}
                initial={{ opacity: 0, y: 24, filter: 'blur(8px)' }}
                whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                viewport={VIEWPORT}
                transition={{
                  duration: 0.7,
                  ease: 'easeOut' as const,
                  delay: i * 0.1,
                }}
                whileHover={{ scale: 1.01 }}
                className="rounded-2xl gp-glass-strong gp-ring p-5"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-white/45">
                    {panel.tag}
                  </span>
                  <span className="text-[11px] text-white/55">
                    {panel.state}
                  </span>
                </div>
                <h3 className="mb-4 text-base font-semibold text-white">
                  {panel.title}
                </h3>
                {panel.body}
              </motion.div>
            ))}
          </div>
        </StickyPair>
      </div>
    </section>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   SECTION 5 — ORACLE (sticky right, left chat)
   ════════════════════════════════════════════════════════════════════════ */

function OracleSection() {
  return (
    <section id="oracle" className="relative px-6 py-24 md:py-32">
      <div className="mx-auto max-w-7xl">
        <StickyPair stickySide="right">
          {/* Left: chat mock */}
          <motion.div
            initial={{ opacity: 0, y: 24, filter: 'blur(8px)' }}
            whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            viewport={VIEWPORT}
            transition={{ duration: 0.8, ease: 'easeOut' as const }}
            className="rounded-2xl gp-glass-strong gp-ring p-5"
          >
            {/* Chat header */}
            <div className="mb-4 flex items-center gap-3 border-b border-white/8 pb-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-black">
                <Bot className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-semibold text-white">VEYRO AI</div>
                <div className="text-[10px] text-white/45">
                  AI Chief Financial Officer
                </div>
              </div>
              <span className="ml-auto flex items-center gap-1 rounded-full bg-white/8 px-2 py-0.5 text-[10px] text-white/70">
                <span className="h-1.5 w-1.5 rounded-full bg-white motion-pulse" />
                Online
              </span>
            </div>

            {/* User question */}
            <div className="mb-4 flex justify-end">
              <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-white/10 px-4 py-2.5 text-sm text-white/90">
                Why did collections drop 12% this quarter?
              </div>
            </div>

            {/* Oracle response */}
            <div className="flex gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-black">
                <Sparkles className="h-3.5 w-3.5" />
              </div>
              <div className="flex-1 rounded-2xl rounded-tl-sm bg-white/5 px-4 py-3">
                <p className="text-sm leading-relaxed text-white/85">
                  Collections dropped 12% due to three converging factors:
                </p>
                <div className="mt-3 space-y-2">
                  {[
                    {
                      n: '01',
                      t: 'Aging skew',
                      d: 'Three top accounts shifted to 60+ day aging.',
                    },
                    {
                      n: '02',
                      t: 'Cycle timing',
                      d: 'Q3 invoicing ran 9 days later than Q2.',
                    },
                    {
                      n: '03',
                      t: 'Refund spike',
                      d: '₹14L in refunds processed mid-quarter.',
                    },
                  ].map((r) => (
                    <div
                      key={r.n}
                      className="flex gap-3 rounded-lg bg-white/4 px-3 py-2"
                    >
                      <span className="font-mono text-xs text-white/45">
                        {r.n}
                      </span>
                      <div>
                        <div className="text-xs font-semibold text-white">
                          {r.t}
                        </div>
                        <div className="text-[11px] text-white/55">{r.d}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-2 text-[11px] text-white/55">
                  <Zap className="h-3 w-3" />
                  Suggested action: escalate the 3 accounts · draft reminders
                </div>
              </div>
            </div>
          </motion.div>

          {/* Right: copy */}
          <StickyCopyBlock
            eyebrow="AI Oracle"
            title="Meet Oracle. Your AI Chief Financial Officer."
            body="Ask anything. Oracle reads every transaction, every return, every reconciliation — and answers with the precision of a 20-year CA."
            bullets={[
              'Plain-English answers, grounded in your live data',
              'Causal analysis — not just summaries',
              'Proactive briefings before every deadline',
              'Approval chains for any action it takes',
            ]}
          />
        </StickyPair>
      </div>
    </section>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   SECTIONS 6–10 — STICKY FEATURE CLOUDS
   ════════════════════════════════════════════════════════════════════════ */

function GSTExecutionCloudSection() {
  return (
    <section id="gst-cloud" className="relative px-6 py-24 md:py-32">
      <div className="mx-auto max-w-7xl">
        <StickyPair stickySide="left">
          <StickyCopyBlock
            eyebrow="GST Execution Cloud™"
            title="File every return. Without thinking about it."
            bullets={[
              'GSTR-1 / 3B auto-prepared from your books',
              'e-Invoice + e-Way bill generation in one click',
              'Reconcile 2A / 2B before you file',
              'One-click filing with ARN archival',
            ]}
          />

          {/* Visual: return status stack */}
          <div className="flex flex-col gap-3">
            {[
              { r: 'GSTR-1', p: 'Aug 2026', s: 'Filed', c: 'text-white', d: true },
              { r: 'GSTR-3B', p: 'Aug 2026', s: 'Ready', c: 'text-white/80', d: true },
              { r: 'GSTR-2B', p: 'Aug 2026', s: 'Reconciling', c: 'text-white/55', d: false },
              { r: 'CMP-08', p: 'Q1 FY27', s: 'Scheduled', c: 'text-white/45', d: false },
            ].map((row, i) => (
              <motion.div
                key={row.r}
                initial={{ opacity: 0, y: 18, filter: 'blur(6px)' }}
                whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                viewport={VIEWPORT}
                transition={{ duration: 0.6, ease: 'easeOut' as const, delay: i * 0.08 }}
                whileHover={{ scale: 1.01 }}
                className="flex items-center justify-between rounded-xl gp-glass p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/8 text-white">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">
                      {row.r}
                    </div>
                    <div className="text-[11px] text-white/45">{row.p}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium ${row.c}`}>{row.s}</span>
                  {row.d ? (
                    <CheckCircle2 className="h-4 w-4 text-white" />
                  ) : (
                    <Clock className="h-4 w-4 text-white/40" />
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </StickyPair>
      </div>
    </section>
  )
}

function BankingCloudSection() {
  return (
    <section id="banking-cloud" className="relative px-6 py-24 md:py-32">
      <div className="mx-auto max-w-7xl">
        <StickyPair stickySide="right">
          {/* Left visual */}
          <motion.div
            initial={{ opacity: 0, y: 24, filter: 'blur(8px)' }}
            whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            viewport={VIEWPORT}
            transition={{ duration: 0.8, ease: 'easeOut' as const }}
            className="rounded-2xl gp-glass-strong gp-ring p-5"
          >
            {/* Balance */}
            <div className="mb-4 flex items-end justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-white/45">
                  Combined balance
                </div>
                <div className="mt-1 text-3xl font-semibold tracking-tight text-white">
                  ₹4.82 Cr
                </div>
              </div>
              <div className="flex items-center gap-1 rounded-full bg-white/8 px-2.5 py-1 text-[11px] text-white/70">
                <TrendingUp className="h-3 w-3" />
                +6.4%
              </div>
            </div>

            {/* Accounts */}
            <div className="mb-4 grid grid-cols-3 gap-2">
              {['ICICI', 'HDFC', 'Axis'].map((b) => (
                <div
                  key={b}
                  className="rounded-lg bg-white/4 px-3 py-2 text-center"
                >
                  <div className="text-[10px] text-white/45">{b}</div>
                  <div className="mt-0.5 text-sm font-semibold text-white">
                    ₹{b === 'ICICI' ? '2.1' : b === 'HDFC' ? '1.8' : '0.9'}Cr
                  </div>
                </div>
              ))}
            </div>

            {/* Transactions */}
            <div className="space-y-1.5">
              {[
                { t: 'UPI · Razorpay', s: 'Inflow', a: '+₹2,40,000' },
                { t: 'NEFT · Vendor', s: 'Outflow', a: '-₹84,500' },
                { t: 'UPI · Customer', s: 'Inflow', a: '+₹38,200' },
                { t: 'AutoPay · Cloud', s: 'Outflow', a: '-₹12,999' },
              ].map((tx, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg bg-white/4 px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`h-6 w-6 rounded-full ${tx.s === 'Inflow' ? 'bg-white/15' : 'bg-white/5'}`}
                    />
                    <div>
                      <div className="text-xs text-white/85">{tx.t}</div>
                      <div className="text-[10px] text-white/45">{tx.s}</div>
                    </div>
                  </div>
                  <div className="text-xs font-medium text-white/85">
                    {tx.a}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Right copy */}
          <StickyCopyBlock
            eyebrow="Banking Cloud™"
            title="Every account. One ledger. Live."
            bullets={[
              'Live bank feeds across all your accounts',
              'UPI autopay and recurring collections',
              'Auto-reconciliation with your books',
              'Cashflow forecasting 90 days out',
            ]}
          />
        </StickyPair>
      </div>
    </section>
  )
}

function InvoiceEngineSection() {
  return (
    <section id="invoice-engine" className="relative px-6 py-24 md:py-32">
      <div className="mx-auto max-w-7xl">
        <StickyPair stickySide="left">
          <StickyCopyBlock
            eyebrow="Real Invoice Engine™"
            title="Every invoice. Tracked to the rupee."
            bullets={[
              'Sales + purchase invoices in one ledger',
              'TDS computation and reconciliation',
              'Payroll and statutory compliance',
              'Receivables aging with payment links',
            ]}
          />

          {/* Visual: invoice list */}
          <motion.div
            initial={{ opacity: 0, y: 24, filter: 'blur(8px)' }}
            whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            viewport={VIEWPORT}
            transition={{ duration: 0.8, ease: 'easeOut' as const }}
            className="overflow-hidden rounded-2xl gp-glass-strong gp-ring"
          >
            <div className="flex items-center justify-between border-b border-white/8 px-5 py-3">
              <div className="text-sm font-semibold text-white">Invoices</div>
              <div className="flex gap-1">
                <span className="rounded bg-white/10 px-2 py-0.5 text-[10px] text-white">
                  All
                </span>
                <span className="rounded px-2 py-0.5 text-[10px] text-white/45">
                  Unpaid
                </span>
                <span className="rounded px-2 py-0.5 text-[10px] text-white/45">
                  Overdue
                </span>
              </div>
            </div>
            <div className="divide-y divide-white/6">
              {[
                { i: 'INV-2418', c: 'Meridian Foods', a: '₹4,80,000', s: 'Paid', st: 'text-white' },
                { i: 'INV-2417', c: 'Helix Mobility', a: '₹1,24,500', s: 'Sent', st: 'text-white/70' },
                { i: 'INV-2416', c: 'Crestline Pharma', a: '₹9,40,000', s: 'Overdue', st: 'text-white/55' },
                { i: 'INV-2415', c: 'Vantage Media', a: '₹68,200', s: 'Paid', st: 'text-white' },
                { i: 'INV-2414', c: 'Pinnacle Retail', a: '₹2,15,000', s: 'Draft', st: 'text-white/45' },
              ].map((row, i) => (
                <motion.div
                  key={row.i}
                  initial={{ opacity: 0, x: -8 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={VIEWPORT}
                  transition={{ duration: 0.4, delay: i * 0.06 }}
                  className="flex items-center justify-between px-5 py-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-7 w-7 rounded bg-white/8" />
                    <div>
                      <div className="text-xs font-medium text-white/85">
                        {row.i}
                      </div>
                      <div className="text-[11px] text-white/45">{row.c}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-xs font-semibold text-white">
                      {row.a}
                    </div>
                    <span className={`text-[10px] font-medium ${row.st}`}>
                      {row.s}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </StickyPair>
      </div>
    </section>
  )
}

function CommunicationCloudSection() {
  return (
    <section id="comm-cloud" className="relative px-6 py-24 md:py-32">
      <div className="mx-auto max-w-7xl">
        <StickyPair stickySide="right">
          {/* Left visual: message thread */}
          <motion.div
            initial={{ opacity: 0, y: 24, filter: 'blur(8px)' }}
            whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            viewport={VIEWPORT}
            transition={{ duration: 0.8, ease: 'easeOut' as const }}
            className="rounded-2xl gp-glass-strong gp-ring p-5"
          >
            <div className="mb-4 flex items-center gap-3 border-b border-white/8 pb-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white">
                <MessageSquare className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-semibold text-white">
                  Crestline Pharma
                </div>
                <div className="text-[10px] text-white/45">
                  WhatsApp · Auto-reminder
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-end">
                <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-white/10 px-3.5 py-2 text-xs text-white/90">
                  Reminder: INV-2416 (₹9,40,000) is 7 days overdue.
                </div>
              </div>
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-2xl rounded-bl-sm bg-white/5 px-3.5 py-2 text-xs text-white/85">
                  Processing this week. Can we get a payment link?
                </div>
              </div>
              <div className="flex justify-end">
                <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-white/10 px-3.5 py-2 text-xs text-white/90">
                  Link sent · UPI / NEFT / RTGS enabled.
                </div>
              </div>
              <div className="flex justify-end">
                <div className="flex items-center gap-1.5 rounded-full bg-white/8 px-3 py-1 text-[10px] text-white/60">
                  <CheckCircle2 className="h-3 w-3" />
                  Payment received · ₹9,40,000
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2 rounded-lg bg-white/4 px-3 py-2 text-[11px] text-white/55">
              <Send className="h-3 w-3" />
              Auto-managed by VEYRO · 0 human touches
            </div>
          </motion.div>

          {/* Right copy */}
          <StickyCopyBlock
            eyebrow="Communication Cloud™"
            title="Talk to every counterparty. Automatically."
            bullets={[
              'WhatsApp + email + SMS from one inbox',
              'Client portal with document access',
              'Automated reminders and dunning',
              'GST notice management and responses',
            ]}
          />
        </StickyPair>
      </div>
    </section>
  )
}

function ExecutionEngineSection() {
  return (
    <section id="execution-engine" className="relative px-6 py-24 md:py-32">
      <div className="mx-auto max-w-7xl">
        <StickyPair stickySide="left">
          <StickyCopyBlock
            eyebrow="Execution Engine™"
            title="Workflows that run themselves. Safely."
            bullets={[
              'Autonomous workflows with guardrails',
              'Deadline radar across all compliances',
              'Approval chains for any high-risk action',
              'Immutable audit trail for every event',
            ]}
          />

          {/* Visual: workflow node graph */}
          <motion.div
            initial={{ opacity: 0, y: 24, filter: 'blur(8px)' }}
            whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            viewport={VIEWPORT}
            transition={{ duration: 0.8, ease: 'easeOut' as const }}
            className="rounded-2xl gp-glass-strong gp-ring p-6"
          >
            <svg viewBox="0 0 500 280" className="w-full">
              {/* Connectors */}
              <line x1="80" y1="60" x2="220" y2="60" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
              <line x1="80" y1="60" x2="220" y2="140" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" />
              <line x1="220" y1="60" x2="360" y2="100" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
              <line x1="220" y1="140" x2="360" y2="100" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" />
              <line x1="360" y1="100" x2="440" y2="100" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
              <line x1="220" y1="140" x2="220" y2="220" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" />
              <line x1="220" y1="220" x2="360" y2="220" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" />
              <line x1="360" y1="220" x2="440" y2="100" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" strokeDasharray="4 4" />

              {/* Nodes */}
              {[
                { x: 20, y: 40, w: 120, h: 40, t: 'Trigger', s: 'Books sync', active: true },
                { x: 160, y: 40, w: 120, h: 40, t: 'Reconcile', s: '2A/2B', active: true },
                { x: 300, y: 80, w: 120, h: 40, t: 'Compute', s: 'Liability', active: true },
                { x: 420, y: 80, w: 60, h: 40, t: 'File', s: '✓', active: true },
                { x: 160, y: 120, w: 120, h: 40, t: 'Detect', s: 'Mismatch', active: false },
                { x: 160, y: 200, w: 120, h: 40, t: 'Notify', s: 'CA review', active: false },
                { x: 300, y: 200, w: 120, h: 40, t: 'Approve', s: 'Chain', active: false },
              ].map((n, i) => (
                <g key={i}>
                  <rect
                    x={n.x}
                    y={n.y}
                    width={n.w}
                    height={n.h}
                    rx="8"
                    fill={n.active ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.04)'}
                    stroke={n.active ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.15)'}
                    strokeWidth="1"
                  />
                  <text
                    x={n.x + n.w / 2}
                    y={n.y + 16}
                    textAnchor="middle"
                    fill="rgba(255,255,255,0.95)"
                    fontSize="10"
                    fontWeight="600"
                  >
                    {n.t}
                  </text>
                  <text
                    x={n.x + n.w / 2}
                    y={n.y + 30}
                    textAnchor="middle"
                    fill="rgba(255,255,255,0.55)"
                    fontSize="9"
                  >
                    {n.s}
                  </text>
                </g>
              ))}
            </svg>
            <div className="mt-2 flex items-center justify-between text-[10px] text-white/45">
              <span>Autonomous path · solid</span>
              <span>Exception path · dashed</span>
            </div>
          </motion.div>
        </StickyPair>
      </div>
    </section>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   SECTION 11 — MARKETPLACE
   ════════════════════════════════════════════════════════════════════════ */

const MARKETPLACE = [
  {
    icon: Landmark,
    title: 'Lenders',
    desc: 'Working capital, term loans, and invoice discounting — pre-underwritten with your live VEYRO data.',
  },
  {
    icon: ShieldCheck,
    title: 'Insurers',
    desc: 'Trade credit, cyber, and business insurance underwritten against your real-time financial health.',
  },
  {
    icon: Building2,
    title: 'Chartered Accountants',
    desc: 'A network of vetted CAs for review, audit, and advisory — directly inside your workflow.',
  },
]

function MarketplaceSection() {
  return (
    <section id="marketplace" className="relative px-6 py-24 md:py-32">
      <div className="mx-auto max-w-7xl">
        <SectionHeading
          eyebrow="Marketplace"
          title="A marketplace for Indian finance."
          subtitle="VEYRO isn't just software. It's a two-sided network connecting businesses with the financial institutions that serve them."
        />
        <motion.div
          variants={staggerParent}
          initial="hidden"
          whileInView="show"
          viewport={VIEWPORT}
          className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-3"
        >
          {MARKETPLACE.map((m) => (
            <motion.div
              key={m.title}
              variants={fadeUp}
              whileHover={{ scale: 1.02, y: -2 }}
              transition={{ duration: 0.25, ease: 'easeOut' as const }}
              className="rounded-2xl gp-glass gp-ring p-6"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/8 text-white">
                <m.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-5 text-lg font-semibold tracking-tight text-white">
                {m.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-white/55">
                {m.desc}
              </p>
              <div className="mt-5 flex items-center gap-1.5 text-xs font-medium text-white/50">
                <Users className="h-3.5 w-3.5" />
                Two-sided network
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   SECTION 12 — PRICING
   ════════════════════════════════════════════════════════════════════════ */

const PRICING = [
  {
    name: 'Free',
    price: '₹0',
    cadence: '/forever',
    features: ['1 business', 'Up to 50 invoices/mo', 'Basic GST filing', 'Community support'],
    cta: 'Start Free',
    highlight: false,
  },
  {
    name: 'Starter',
    price: '₹999',
    cadence: '/mo',
    features: ['Up to 3 businesses', '1,000 invoices/mo', 'GSTR-1 & 3B auto-file', 'Banking feeds', 'Email support'],
    cta: 'Choose Starter',
    highlight: false,
  },
  {
    name: 'Professional',
    price: '₹2,999',
    cadence: '/mo',
    features: ['Up to 10 businesses', 'Unlimited invoices', 'Full reconciliation suite', 'VEYRO AI CFO', 'Priority support'],
    cta: 'Start Free',
    highlight: true,
  },
  {
    name: 'Business',
    price: '₹9,999',
    cadence: '/mo',
    features: ['Unlimited businesses', 'Execution Engine', 'Approval chains', 'Marketplace access', 'Dedicated CSM'],
    cta: 'Choose Business',
    highlight: false,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    cadence: '',
    features: ['On-prem / VPC', 'SSO + audit exports', 'Custom workflows', 'SLA + 24/7 support', 'Onboarding included'],
    cta: 'Book Demo',
    highlight: false,
  },
]

function PricingSection({ onGetStarted, onBookDemo }: VEYROLandingProps) {
  return (
    <section id="pricing" className="relative px-6 py-24 md:py-32">
      <div className="mx-auto max-w-7xl">
        <SectionHeading
          eyebrow="Pricing"
          title="Pricing built for every stage."
          subtitle="From your first invoice to a thousand entities — pay only for what you run."
        />

        <motion.div
          variants={staggerParent}
          initial="hidden"
          whileInView="show"
          viewport={VIEWPORT}
          className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5"
        >
          {PRICING.map((p) => (
            <motion.div
              key={p.name}
              variants={fadeUp}
              whileHover={{ scale: 1.02, y: -2 }}
              transition={{ duration: 0.25, ease: 'easeOut' as const }}
              className={`relative flex flex-col rounded-2xl p-6 ${
                p.highlight
                  ? 'gp-glass-strong gp-ring lg:-mt-3 lg:mb-3'
                  : 'gp-glass'
              }`}
            >
              {p.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="rounded-full bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-black">
                    Most Popular
                  </span>
                </div>
              )}

              <div className="text-sm font-semibold text-white/80">
                {p.name}
              </div>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-3xl font-semibold tracking-tight text-white">
                  {p.price}
                </span>
                {p.cadence && (
                  <span className="text-xs text-white/45">{p.cadence}</span>
                )}
              </div>

              <ul className="mt-5 flex-1 space-y-2.5">
                {p.features.map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-2 text-xs text-white/65"
                  >
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/80" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={
                  p.highlight || p.cta === 'Start Free'
                    ? onGetStarted
                    : p.cta === 'Book Demo'
                      ? onBookDemo
                      : undefined
                }
                className={`mt-6 rounded-full px-4 py-2.5 text-xs font-semibold transition-shadow ${
                  p.highlight
                    ? 'bg-white text-black hover:shadow-[0_4px_16px_-4px_rgba(255,255,255,0.4)]'
                    : 'gp-glass text-white/90 hover:text-white'
                }`}
              >
                {p.cta}
              </button>
            </motion.div>
          ))}
        </motion.div>

        <motion.p
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={VIEWPORT}
          className="mt-8 text-center text-xs text-white/45"
        >
          All prices in INR. GST applicable.
        </motion.p>
      </div>
    </section>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   SECTION 13 — TESTIMONIALS
   ════════════════════════════════════════════════════════════════════════ */

const TESTIMONIALS = [
  {
    quote: 'VEYRO feels like hiring an AI CFO.',
    name: 'Aarav Mehta',
    role: 'CFO, Aurum Ventures',
    initials: 'AM',
  },
  {
    quote: 'It runs our compliance operations automatically.',
    name: 'Priya Nair',
    role: 'Head of Finance, Meridian Foods',
    initials: 'PN',
  },
  {
    quote: 'We spend less time filing and more time growing.',
    name: 'Rohan Kapoor',
    role: 'Founder, Helix Mobility',
    initials: 'RK',
  },
]

function TestimonialsSection() {
  return (
    <section id="testimonials" className="relative px-6 py-24 md:py-32">
      <div className="mx-auto max-w-7xl">
        <SectionHeading
          eyebrow="Testimonials"
          title="Loved by finance teams."
          subtitle="The operators running India's most demanding finance functions."
        />
        <motion.div
          variants={staggerParent}
          initial="hidden"
          whileInView="show"
          viewport={VIEWPORT}
          className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-3"
        >
          {TESTIMONIALS.map((t) => (
            <motion.figure
              key={t.name}
              variants={fadeUp}
              whileHover={{ scale: 1.02, y: -2 }}
              transition={{ duration: 0.25, ease: 'easeOut' as const }}
              className="flex flex-col rounded-2xl gp-glass gp-ring p-6"
            >
              <blockquote className="text-lg font-medium leading-snug tracking-tight text-white md:text-xl">
                &ldquo;{t.quote}&rdquo;
              </blockquote>
              <figcaption className="mt-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-white">
                  {t.initials}
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">
                    {t.name}
                  </div>
                  <div className="text-xs text-white/55">{t.role}</div>
                </div>
              </figcaption>
            </motion.figure>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   SECTION 14 — CASE STUDIES
   ════════════════════════════════════════════════════════════════════════ */

const CASE_STUDIES = [
  { stat: '3.2×', label: 'faster filing', context: 'A CA firm in Mumbai cut monthly GSTR-3B prep from 9 days to under 3.' },
  { stat: '₹47L', label: 'recovered in 90 days', context: 'A D2C brand reclaimed trapped ITC through automated 2A/2B reconciliation.' },
  { stat: '99.8%', label: 'reconciliation accuracy', context: 'A logistics operator achieved near-perfect match rates across 14 entities.' },
]

function CaseStudiesSection() {
  return (
    <section id="case-studies" className="relative px-6 py-24 md:py-32">
      <div className="mx-auto max-w-7xl">
        <SectionHeading
          eyebrow="Case Studies"
          title="Outcomes, not features."
          subtitle="Numbers from real finance teams running real money on VEYRO."
        />
        <motion.div
          variants={staggerParent}
          initial="hidden"
          whileInView="show"
          viewport={VIEWPORT}
          className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-3"
        >
          {CASE_STUDIES.map((c) => (
            <motion.div
              key={c.label}
              variants={fadeUp}
              whileHover={{ scale: 1.02, y: -2 }}
              transition={{ duration: 0.25, ease: 'easeOut' as const }}
              className="flex flex-col rounded-2xl gp-glass-strong gp-ring p-6"
            >
              <div className="text-5xl font-semibold tracking-[-0.04em] text-white md:text-6xl">
                {c.stat}
              </div>
              <div className="mt-2 text-sm font-medium text-white/80">
                {c.label}
              </div>
              <p className="mt-4 flex-1 text-sm leading-relaxed text-white/55">
                {c.context}
              </p>
              <button className="mt-6 inline-flex items-center gap-1.5 text-xs font-medium text-white/65 transition-colors hover:text-white">
                Read case study
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   SECTION 15 — SECURITY & COMPLIANCE
   ════════════════════════════════════════════════════════════════════════ */

const SECURITY = [
  { icon: ShieldCheck, title: 'ISO 27001', desc: 'Certified information security management.' },
  { icon: Lock, title: 'SOC 2 Type II', desc: 'Audited controls for trust services.' },
  { icon: FileCheck, title: 'GSTN-certified', desc: 'Authorized GST suvidha provider.' },
  { icon: Landmark, title: 'RBI-compliant AA', desc: 'Account Aggregator framework.' },
]

function SecuritySection() {
  return (
    <section id="security" className="relative px-6 py-24 md:py-32">
      <div className="mx-auto max-w-7xl">
        <SectionHeading
          eyebrow="Security & Compliance"
          title="Enterprise-grade security."
          subtitle="Your financial data is encrypted end-to-end and audited by India's most respected standards bodies."
        />

        <motion.div
          variants={staggerParent}
          initial="hidden"
          whileInView="show"
          viewport={VIEWPORT}
          className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          {SECURITY.map((s) => (
            <motion.div
              key={s.title}
              variants={fadeUp}
              whileHover={{ scale: 1.02, y: -2 }}
              transition={{ duration: 0.25, ease: 'easeOut' as const }}
              className="rounded-2xl gp-glass gp-ring p-5"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/8 text-white">
                <s.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-sm font-semibold text-white">
                {s.title}
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-white/55">
                {s.desc}
              </p>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={VIEWPORT}
          className="mx-auto mt-8 flex max-w-3xl items-center justify-center gap-3 rounded-full gp-glass px-5 py-3 text-center"
        >
          <Lock className="h-4 w-4 text-white/70" />
          <span className="text-xs text-white/65">
            End-to-end encryption · AES-256 at rest · TLS 1.3 in transit
          </span>
        </motion.div>
      </div>
    </section>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   SECTION 16 — INTEGRATIONS
   ════════════════════════════════════════════════════════════════════════ */

const INTEGRATIONS = [
  'GSTN',
  'Tally',
  'Zoho Books',
  'ICICI Bank',
  'HDFC',
  'Razorpay',
  'Pinecone',
  'Slack',
  'WhatsApp',
  'Gmail',
  'Google Drive',
  'QuickBooks',
]

function IntegrationsSection() {
  return (
    <section id="integrations" className="relative px-6 py-24 md:py-32">
      <div className="mx-auto max-w-7xl">
        <SectionHeading
          eyebrow="Integrations"
          title="Connects to everything."
          subtitle="Banks, ERPs, payment rails, communication channels — all native. No CSV exports, no manual sync."
        />
        <motion.div
          variants={staggerParent}
          initial="hidden"
          whileInView="show"
          viewport={VIEWPORT}
          className="mt-14 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6"
        >
          {INTEGRATIONS.map((name) => (
            <motion.div
              key={name}
              variants={fadeUp}
              whileHover={{ scale: 1.04, y: -2 }}
              transition={{ duration: 0.2, ease: 'easeOut' as const }}
              className="flex flex-col items-center justify-center gap-3 rounded-xl gp-glass px-4 py-6 text-center"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/8 text-white">
                <Plug className="h-4 w-4" />
              </div>
              <span className="text-xs font-medium text-white/55">{name}</span>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   SECTION 17 — WHY GSTPILOT (comparison)
   ════════════════════════════════════════════════════════════════════════ */

const COMPARISON = [
  {
    old: 'Manual data entry across Tally + Excel',
    new: 'Auto-pulled from your live books',
    result: '9 days → 3 hours saved monthly',
  },
  {
    old: 'Reconciliation in spreadsheets',
    new: '99.8% automated 2A/2B match',
    result: '₹47L trapped ITC recovered',
  },
  {
    old: 'Filing deadlines missed',
    new: 'Deadline radar + autonomous filing',
    result: 'Zero late filings, ever',
  },
  {
    old: 'Cashflow known at month-end',
    new: '90-day forecast updated daily',
    result: 'Decisions made in advance',
  },
  {
    old: 'Notices handled reactively',
    new: 'Notice detection + auto-response',
    result: 'Response time 14d → 2h',
  },
]

function WhyVEYROSection() {
  return (
    <section id="why" className="relative px-6 py-24 md:py-32">
      <div className="mx-auto max-w-7xl">
        <SectionHeading
          eyebrow="Why VEYRO"
          title="Why VEYRO."
          subtitle="The legacy stack vs. the autonomous stack — measured in outcomes."
        />

        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={VIEWPORT}
          className="mt-14 overflow-hidden rounded-2xl gp-glass-strong gp-ring"
        >
          {/* Header row */}
          <div className="grid grid-cols-1 gap-px bg-white/8 sm:grid-cols-3">
            <div className="bg-black/40 p-5">
              <div className="text-xs font-semibold uppercase tracking-wider text-white/45">
                The Old Way
              </div>
              <div className="mt-1 text-sm text-white/55">Spreadsheets & effort</div>
            </div>
            <div className="bg-white/4 p-5">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white">
                <Sparkles className="h-3.5 w-3.5" />
                VEYRO
              </div>
              <div className="mt-1 text-sm text-white/80">Autonomous operations</div>
            </div>
            <div className="bg-black/40 p-5">
              <div className="text-xs font-semibold uppercase tracking-wider text-white/45">
                Result
              </div>
              <div className="mt-1 text-sm text-white/55">What changes</div>
            </div>
          </div>

          {/* Rows */}
          <div className="divide-y divide-white/6">
            {COMPARISON.map((row, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={VIEWPORT}
                transition={{ duration: 0.5, delay: i * 0.06 }}
                className="grid grid-cols-1 gap-px bg-white/6 sm:grid-cols-3"
              >
                <div className="flex items-start gap-2 bg-black/40 p-5">
                  <span className="mt-0.5 text-white/30">
                    <X className="h-4 w-4" />
                  </span>
                  <span className="text-sm text-white/45 line-through decoration-white/20">
                    {row.old}
                  </span>
                </div>
                <div className="flex items-start gap-2 bg-white/4 p-5">
                  <span className="mt-0.5 text-white">
                    <Check className="h-4 w-4" />
                  </span>
                  <span className="text-sm text-white/90">{row.new}</span>
                </div>
                <div className="flex items-start gap-2 bg-black/40 p-5">
                  <span className="mt-0.5 text-white/60">
                    <TrendingUp className="h-4 w-4" />
                  </span>
                  <span className="text-sm font-medium text-white/75">
                    {row.result}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   SECTION 18 — FAQ
   ════════════════════════════════════════════════════════════════════════ */

const FAQS = [
  {
    q: 'Is my financial data secure?',
    a: 'Yes. All data is encrypted at rest with AES-256 and in transit with TLS 1.3. We are ISO 27001 certified and SOC 2 Type II audited. No human at VEYRO can read your transaction-level data without your explicit, time-boxed consent.',
  },
  {
    q: 'Do you support all GST return types?',
    a: 'Yes — GSTR-1, 3B, 2A, 2B, CMP-08, IFF, and annual returns including GSTR-9 and 9C. Every return type is auto-prepared, reconciled, and filed through the GSTN-authorized suvidha provider framework.',
  },
  {
    q: 'Can I connect my existing bank?',
    a: 'Yes. VEYRO connects to 60+ Indian banks via the RBI-compliant Account Aggregator framework, plus direct feeds for ICICI, HDFC, Axis, Kotak, and YES Bank. UPI autopay and NEFT/RTGS reconciliation are included on every plan.',
  },
  {
    q: 'How does the VEYRO AI work?',
    a: 'Oracle is a domain-trained model that reads every transaction, return, and reconciliation event in your workspace. It performs causal analysis — not just summarization — and surfaces proactive insights. Any action it proposes runs through your approval chain before execution.',
  },
  {
    q: 'Is there a free plan?',
    a: 'Yes. The Free plan supports one business with up to 50 invoices per month and basic GST filing. It never expires. Upgrade only when you outgrow it.',
  },
  {
    q: 'Do you offer onboarding for large firms?',
    a: 'Yes. Business and Enterprise plans include white-glove onboarding: schema migration from Tally/Zoho, historical data import, workflow configuration, and dedicated CSM support. Typical enterprise onboarding takes 2–3 weeks.',
  },
]

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="overflow-hidden rounded-2xl gp-glass">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
        aria-expanded={open}
      >
        <span className="text-sm font-semibold text-white md:text-base">
          {q}
        </span>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/8 text-white">
          {open ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        </span>
      </button>
      <motion.div
        initial={false}
        animate={{
          height: open ? 'auto' : 0,
          opacity: open ? 1 : 0,
        }}
        transition={{ duration: 0.3, ease: 'easeOut' as const }}
        className="overflow-hidden"
      >
        <p className="px-5 pb-5 text-sm leading-relaxed text-white/65">{a}</p>
      </motion.div>
    </div>
  )
}

function FAQSection() {
  return (
    <section id="faq" className="relative px-6 py-24 md:py-32">
      <div className="mx-auto max-w-3xl">
        <SectionHeading
          eyebrow="FAQ"
          title="Frequently asked questions."
        />
        <motion.div
          variants={staggerParent}
          initial="hidden"
          whileInView="show"
          viewport={VIEWPORT}
          className="mt-12 flex flex-col gap-3"
        >
          {FAQS.map((f) => (
            <motion.div key={f.q} variants={fadeUp}>
              <FAQItem q={f.q} a={f.a} />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   SECTION 19 — FINAL CTA
   ════════════════════════════════════════════════════════════════════════ */

function FinalCTASection({ onGetStarted, onBookDemo }: VEYROLandingProps) {
  return (
    <section
      id="final-cta"
      className="gp-grain relative overflow-hidden px-6 py-32 md:py-40"
    >
      {/* Radial white glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(50% 60% at 50% 50%, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.04) 40%, transparent 75%)',
        }}
      />
      <div className="relative mx-auto flex max-w-4xl flex-col items-center text-center">
        <motion.h2
          initial={{ opacity: 0, y: 20, filter: 'blur(10px)' }}
          whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          viewport={VIEWPORT}
          transition={{ duration: 0.8, ease: 'easeOut' as const }}
          className="text-4xl font-semibold leading-[1.05] tracking-[-0.03em] text-white md:text-6xl lg:text-7xl"
        >
          Start running your finance on autopilot.
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={VIEWPORT}
          transition={{ duration: 0.7, ease: 'easeOut' as const, delay: 0.1 }}
          className="mt-6 max-w-xl text-base text-white/65 md:text-lg"
        >
          Join 100,000+ businesses and 10,000+ CA firms running their finance on
          VEYRO.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={VIEWPORT}
          transition={{ duration: 0.7, ease: 'easeOut' as const, delay: 0.2 }}
          className="mt-9 flex flex-col items-center gap-3 sm:flex-row"
        >
          <PrimaryButton onClick={onGetStarted} className="w-full sm:w-auto">
            Start Free
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </PrimaryButton>
          <GhostButton onClick={onBookDemo} className="w-full sm:w-auto">
            Book Demo
          </GhostButton>
        </motion.div>
      </div>
    </section>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   SECTION 20 — FOOTER
   ════════════════════════════════════════════════════════════════════════ */

const FOOTER_COLS = [
  {
    title: 'Product',
    links: ['GST Execution Cloud', 'Banking Cloud', 'Invoice Engine', 'VEYRO AI', 'Pricing'],
  },
  {
    title: 'Company',
    links: ['About', 'Careers', 'Customers', 'Partners', 'Press'],
  },
  {
    title: 'Resources',
    links: ['Documentation', 'API Reference', 'Changelog', 'Status', 'Community'],
  },
  {
    title: 'Legal',
    links: ['Privacy', 'Terms', 'Security', 'Compliance', 'DPA'],
  },
]

function Footer() {
  return (
    <footer className="border-t border-white/8 px-6 pb-12 pt-20">
      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-6">
          {/* Brand */}
          <div className="col-span-2 md:col-span-2">
            <div className="flex items-center gap-2 text-base font-semibold tracking-tight text-white">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-white text-black">
                <Sparkles className="h-4 w-4" />
              </span>
              VEYRO™
            </div>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/55">
              The AI Operating System for Business™. An autonomous operating system for
              every finance team.
            </p>
            <div className="mt-5 flex items-center gap-2">
              {[Twitter, Linkedin, Github].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  className="flex h-9 w-9 items-center justify-center rounded-full gp-glass text-white/65 transition-colors hover:text-white"
                  aria-label="Social link"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {FOOTER_COLS.map((col) => (
            <div key={col.title}>
              <div className="text-xs font-semibold uppercase tracking-wider text-white/45">
                {col.title}
              </div>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((link) => (
                  <li key={link}>
                    <a
                      href="#"
                      className="text-sm text-white/65 transition-colors hover:text-white"
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom */}
        <div className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-white/8 pt-6 sm:flex-row">
          <p className="text-xs text-white/45">
            © 2026 VEYRO™. The AI Operating System for Business.
          </p>
          <div className="flex items-center gap-4 text-xs text-white/45">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-white motion-pulse" />
              All systems operational
            </span>
            <span>·</span>
            <span>Made in India</span>
          </div>
        </div>
      </div>
    </footer>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   ROOT COMPONENT
   ════════════════════════════════════════════════════════════════════════ */

export default function VEYROLanding({
  onGetStarted,
  onBookDemo,
}: VEYROLandingProps) {
  return (
    <div className="gp-landing relative min-h-screen bg-black text-white">
      <TopNav onGetStarted={onGetStarted} onBookDemo={onBookDemo} />

      <main>
        {/* 1 */}<HeroSection onGetStarted={onGetStarted} onBookDemo={onBookDemo} />
        {/* 2 */}<TrustedBySection />
        {/* 3 */}<FeaturesSection />
        {/* 4 */}<ProductDemoSection />
        {/* 5 */}<OracleSection />
        {/* 6 */}<GSTExecutionCloudSection />
        {/* 7 */}<BankingCloudSection />
        {/* 8 */}<InvoiceEngineSection />
        {/* 9 */}<CommunicationCloudSection />
        {/* 10 */}<ExecutionEngineSection />
        {/* 11 */}<MarketplaceSection />
        {/* 12 */}<PricingSection onGetStarted={onGetStarted} onBookDemo={onBookDemo} />
        {/* 13 */}<TestimonialsSection />
        {/* 14 */}<CaseStudiesSection />
        {/* 15 */}<SecuritySection />
        {/* 16 */}<IntegrationsSection />
        {/* 17 */}<WhyVEYROSection />
        {/* 18 */}<FAQSection />
        {/* 19 */}<FinalCTASection onGetStarted={onGetStarted} onBookDemo={onBookDemo} />
      </main>

      {/* 20 */}
      <Footer />
    </div>
  )
}

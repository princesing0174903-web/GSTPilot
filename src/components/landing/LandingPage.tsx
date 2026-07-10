'use client';

import React, { useEffect, useRef, useState } from 'react';
import { BrandLogo } from '@/components/brand';
import {
  motion,
  useInView,
  useScroll,
  useSpring,
  AnimatePresence,
  type Variants,
} from 'framer-motion';
import {
  Infinity as InfinityIcon,
  Zap,
  ArrowRight,
  ChevronDown,
  Check,
  Sparkles,
  Brain,
  ShieldCheck,
  FileText,
  Landmark,
  Receipt,
  Workflow,
  Bot,
  TrendingUp,
  IndianRupee,
  CalendarClock,
  FileSearch,
  Mic,
  Database,
  Target,
  LineChart,
  Building2,
  CreditCard,
  Users,
  Lock,
  Server,
  Globe,
  Cpu,
  Layers,
  Wallet,
  Bell,
  Quote,
  Star,
  Menu,
  X,
  Plus,
  Minus,
  Twitter,
  Github,
  Linkedin,
  ArrowUpRight,
} from 'lucide-react';

interface LandingPageProps {
  onGetStarted: () => void;
  onBookDemo: () => void;
}

/* ════════════════════════════════════════════════════════════════════════
   MOTION PRIMITIVES
   ════════════════════════════════════════════════════════════════════════ */

const EASE = [0.22, 1, 0.36, 1] as const;

const revealVariants: Variants = {
  hidden: { opacity: 0, y: 26, filter: 'blur(10px)' },
  visible: { opacity: 1, y: 0, filter: 'blur(0px)' },
};

function Reveal({
  children,
  delay = 0,
  className,
  as = 'div',
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  as?: 'div' | 'section' | 'li' | 'span' | 'h2' | 'p';
}) {
  const MotionTag = motion[as] as typeof motion.div;
  return (
    <MotionTag
      className={className}
      variants={revealVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.7, ease: EASE, delay }}
    >
      {children}
    </MotionTag>
  );
}

function StaggerGroup({
  children,
  className,
  stagger = 0.08,
}: {
  children: React.ReactNode;
  className?: string;
  stagger?: number;
}) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-60px' }}
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: stagger } },
      }}
    >
      {children}
    </motion.div>
  );
}

function StaggerItem({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div className={className} variants={revealVariants} transition={{ duration: 0.6, ease: EASE }}>
      {children}
    </motion.div>
  );
}

/* Top scroll-progress bar */
function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 30, restDelta: 0.001 });
  return (
    <motion.div
      style={{ scaleX }}
      className="fixed left-0 right-0 top-0 z-[60] h-[2px] origin-left accent-gradient"
    />
  );
}

/* Cinematic aurora background — drifts slowly behind content */
function Aurora({ className = '' }: { className?: string }) {
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden>
      <div className="aurora-blob absolute -left-32 top-0 h-[34rem] w-[34rem] rounded-full accent-gradient-soft blur-[120px] opacity-60" />
      <div
        className="aurora-blob absolute -right-24 top-40 h-[30rem] w-[30rem] rounded-full blur-[110px] opacity-50"
        style={{ backgroundImage: 'linear-gradient(135deg, rgba(6,182,212,0.18), rgba(59,130,246,0.14))' }}
      />
      <div
        className="aurora-blob absolute left-1/3 bottom-0 h-[26rem] w-[26rem] rounded-full blur-[120px] opacity-40"
        style={{ backgroundImage: 'linear-gradient(135deg, rgba(16,185,129,0.16), rgba(6,182,212,0.10))' }}
      />
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   SHARED UI
   ════════════════════════════════════════════════════════════════════════ */

function GlassIcon({ icon: Icon, size = 'md' }: { icon: React.ElementType; size?: 'sm' | 'md' | 'lg' }) {
  const dims = size === 'lg' ? 'h-12 w-12' : size === 'sm' ? 'h-8 w-8' : 'h-10 w-10';
  const ic = size === 'lg' ? 'h-6 w-6' : size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';
  return (
    <div className={`flex ${dims} items-center justify-center rounded-xl glass-surface`}>
      <Icon className={`${ic} accent-text`} />
    </div>
  );
}

function PrimaryButton({
  children,
  onClick,
  className = '',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition-all hover:bg-white/90 hover:scale-[1.02] active:scale-95 ${className}`}
    >
      {children}
    </button>
  );
}

function GhostButton({
  children,
  onClick,
  className = '',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-full glass-surface px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-white/10 hover:scale-[1.02] active:scale-95 ${className}`}
    >
      {children}
    </button>
  );
}

function SectionTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full glass-surface px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-white/70">
      {children}
    </span>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   NAVBAR
   ════════════════════════════════════════════════════════════════════════ */

function Navbar({ onGetStarted }: { onGetStarted: () => void }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const links = [
    { label: 'Features', href: '#features' },
    { label: 'Oracle AI', href: '#oracle' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'Security', href: '#security' },
  ];

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-4 pt-3 sm:px-6">
      <nav
        className={`mx-auto flex max-w-7xl items-center justify-between rounded-2xl px-4 py-2.5 transition-all duration-300 sm:px-5 ${
          scrolled ? 'glass-surface-strong shadow-premium' : 'bg-transparent'
        }`}
      >
        <BrandLogo
          variant="horizontal"
          theme="dark"
          size={40}
          asLink
          href="#top"
          showTagline
          className="brand-logo"
        />

        <div className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-lg px-3 py-1.5 text-sm text-white/70 transition-colors hover:bg-white/5 hover:text-white"
            >
              {l.label}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <button
            onClick={onGetStarted}
            className="text-sm font-medium text-white/70 transition-colors hover:text-white"
          >
            Sign in
          </button>
          <PrimaryButton onClick={onGetStarted} className="px-4 py-2">
            Get Started
            <ArrowRight className="h-3.5 w-3.5" />
          </PrimaryButton>
        </div>

        <button
          className="flex h-9 w-9 items-center justify-center rounded-lg glass-surface text-white md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
          aria-expanded={open}
        >
          {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="mx-auto mt-2 max-w-7xl rounded-2xl glass-surface-strong p-2 md:hidden"
          >
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="block rounded-lg px-4 py-2.5 text-sm text-white/80 transition-colors hover:bg-white/5 hover:text-white"
              >
                {l.label}
              </a>
            ))}
            <div className="mt-1 px-2 pb-1">
              <PrimaryButton onClick={onGetStarted} className="w-full">
                Get Started
                <ArrowRight className="h-3.5 w-3.5" />
              </PrimaryButton>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   1. HERO
   ════════════════════════════════════════════════════════════════════════ */

function HeroSection({ onGetStarted, onBookDemo }: LandingPageProps) {
  return (
    <section id="top" className="relative flex min-h-screen items-center overflow-hidden px-4 pt-28 sm:px-6">
      <Aurora />
      {/* subtle grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          maskImage: 'radial-gradient(ellipse 80% 60% at 50% 40%, black, transparent)',
        }}
      />

      <div className="relative z-10 mx-auto w-full max-w-5xl text-center">
        {/* Official GSTPilot™ logo — subtle, above headline */}
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.8, ease: EASE }}
          className="mb-8 flex justify-center"
        >
          <BrandLogo
            variant="icon"
            theme="dark"
            size={72}
            className="drop-shadow-[0_0_24px_rgba(59,130,246,0.4)]"
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE, delay: 0.1 }}
          className="flex justify-center"
        >
          <SectionTag>
            <Sparkles className="h-3 w-3" />
            The Financial Brain of India™
          </SectionTag>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 24, filter: 'blur(14px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.9, ease: EASE, delay: 0.08 }}
          className="mt-6 text-5xl font-semibold leading-[1.03] tracking-tight text-white sm:text-6xl md:text-7xl lg:text-8xl"
        >
          Run your entire
          <br className="hidden sm:block" /> financial operation on{' '}
          <span className="accent-text">one brain</span>.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.22 }}
          className="mx-auto mt-6 max-w-2xl text-base text-white/65 sm:text-lg"
        >
          GSTPilot Infinity unifies GST, Banking, Invoicing, Reconciliation and an AI CFO into a
          single, always-on operating system — purpose-built for India&apos;s Chartered Accountants
          and ambitious businesses.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.34 }}
          className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
        >
          <PrimaryButton onClick={onGetStarted} className="px-7 py-3.5 text-base">
            Start Free
            <ArrowRight className="h-4 w-4" />
          </PrimaryButton>
          <GhostButton onClick={onBookDemo} className="px-7 py-3.5 text-base">
            Book a Demo
          </GhostButton>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-white/45"
        >
          <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> SOC 2 Type II</span>
          <span className="inline-flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" /> GSTN Compliant</span>
          <span className="inline-flex items-center gap-1.5"><Landmark className="h-3.5 w-3.5" /> RBI Aligned</span>
          <span className="inline-flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" /> India-hosted</span>
        </motion.div>
      </div>

      {/* scroll cue */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 1 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/40"
      >
        <motion.div animate={{ y: [0, 6, 0] }} transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' as const }}>
          <ChevronDown className="h-5 w-5" />
        </motion.div>
      </motion.div>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   2. FEATURES
   ════════════════════════════════════════════════════════════════════════ */

function FeaturesSection() {
  const features = [
    { icon: Brain, title: 'AI CFO', desc: 'A chief financial officer that never sleeps — forecasting, advising, and executing across your entire firm.' },
    { icon: FileText, title: 'GST Cloud', desc: 'GSTR-1, 3B, 9, 9C and ITC reconciliation with auto-ARN generation and live compliance scoring.' },
    { icon: Landmark, title: 'Banking Cloud', desc: 'Live bank feeds, auto-reconciliation, payment tracking and working-capital intelligence in one place.' },
    { icon: Receipt, title: 'Invoice Cloud', desc: 'Create, track, reconcile and execute invoices — sales, purchase, TDS, payroll and receivables.' },
    { icon: Workflow, title: 'Reconciliation Engine', desc: 'Two-way matching across ledgers, bank statements and GST returns with AI-assisted mismatch resolution.' },
    { icon: Sparkles, title: 'Oracle AI', desc: 'Proactive intelligence that detects, predicts and prepares — so you never chase, you execute.' },
  ];

  return (
    <section id="features" className="relative section-gap px-4 py-24 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <Reveal className="mx-auto max-w-2xl text-center">
          <SectionTag><Layers className="h-3 w-3" /> Features</SectionTag>
          <h2 className="mt-5 text-3xl font-semibold tracking-tight text-white sm:text-4xl md:text-5xl">
            One platform. Every financial <span className="accent-text">superpower</span>.
          </h2>
          <p className="mt-4 text-white/60">
            Replace a dozen disconnected tools with a single, intelligent operating system designed
            for the realities of Indian finance.
          </p>
        </Reveal>

        <StaggerGroup className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <StaggerItem key={f.title}>
              <div className="group h-full rounded-3xl glass-surface p-6 hover-lift">
                <GlassIcon icon={f.icon} />
                <h3 className="mt-5 text-lg font-semibold text-white">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/60">{f.desc}</p>
              </div>
            </StaggerItem>
          ))}
        </StaggerGroup>
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   3. CAPABILITIES (bento)
   ════════════════════════════════════════════════════════════════════════ */

function CapabilitiesSection() {
  return (
    <section className="relative section-gap px-4 py-24 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <Reveal className="mx-auto max-w-2xl text-center">
          <SectionTag><Cpu className="h-3 w-3" /> Capabilities</SectionTag>
          <h2 className="mt-5 text-3xl font-semibold tracking-tight text-white sm:text-4xl md:text-5xl">
            Built to <span className="accent-text">execute</span>, not just display.
          </h2>
          <p className="mt-4 text-white/60">
            Every capability is wired to a real workflow — Oracle watches, decides, and acts.
          </p>
        </Reveal>

        <div className="mt-14 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* large card */}
          <Reveal className="lg:col-span-2">
            <div className="relative h-full overflow-hidden rounded-3xl glass-surface p-7 hover-lift">
              <div className="flex items-center gap-3">
                <GlassIcon icon={Workflow} size="lg" />
                <div>
                  <h3 className="text-xl font-semibold text-white">Real-time Reconciliation</h3>
                  <p className="text-sm text-white/55">Ledger × Bank × GST — matched in seconds.</p>
                </div>
              </div>
              {/* mock reconciliation panel */}
              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { l: 'Matched', v: '1,284', c: 'accent-text' },
                  { l: 'Mismatches', v: '23', c: 'text-amber-300' },
                  { l: 'ITC Gap', v: '₹1.2L', c: 'text-white' },
                  { l: 'Auto-resolved', v: '19', c: 'accent-text' },
                ].map((s) => (
                  <div key={s.l} className="rounded-2xl bg-white/[0.03] p-4">
                    <div className={`text-2xl font-semibold ${s.c}`}>{s.v}</div>
                    <div className="mt-1 text-[11px] uppercase tracking-wider text-white/45">{s.l}</div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.08}>
            <div className="h-full rounded-3xl glass-surface p-7 hover-lift">
              <GlassIcon icon={CalendarClock} size="lg" />
              <h3 className="mt-5 text-xl font-semibold text-white">Predictive Cash Flow</h3>
              <p className="mt-2 text-sm text-white/60">
                Oracle forecasts your 30/60/90-day position from receivables, payables and historical
                cadence — so you see the curve before it bends.
              </p>
              <div className="mt-5 flex items-end gap-1.5">
                {[40, 55, 48, 70, 62, 85, 78, 95].map((h, i) => (
                  <motion.div
                    key={i}
                    initial={{ height: 0 }}
                    whileInView={{ height: `${h}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: i * 0.05, ease: EASE }}
                    className="flex-1 rounded-t accent-gradient-soft"
                    style={{ minHeight: 8 }}
                  />
                ))}
              </div>
            </div>
          </Reveal>

          <Reveal>
            <div className="h-full rounded-3xl glass-surface p-7 hover-lift">
              <GlassIcon icon={Building2} size="lg" />
              <h3 className="mt-5 text-xl font-semibold text-white">Multi-Firm Command</h3>
              <p className="mt-2 text-sm text-white/60">
                Operate every client firm from one war room — bulk file, bulk reconcile, bulk advise.
              </p>
            </div>
          </Reveal>

          <Reveal delay={0.08}>
            <div className="h-full rounded-3xl glass-surface p-7 hover-lift">
              <GlassIcon icon={Mic} size="lg" />
              <h3 className="mt-5 text-xl font-semibold text-white">Voice-driven Operations</h3>
              <p className="mt-2 text-sm text-white/60">
                &ldquo;File GSTR-3B for all clients due tomorrow.&rdquo; Spoken. Understood. Executed.
              </p>
            </div>
          </Reveal>

          <Reveal delay={0.16}>
            <div className="h-full rounded-3xl glass-surface p-7 hover-lift">
              <GlassIcon icon={Target} size="lg" />
              <h3 className="mt-5 text-xl font-semibold text-white">Decision Engine</h3>
              <p className="mt-2 text-sm text-white/60">
                Priority-ranked actions across every firm — Oracle tells you what to do next, and why.
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   4. AI AGENTS
   ════════════════════════════════════════════════════════════════════════ */

function AIAgentsSection() {
  const agents = [
    { icon: Bot, name: 'AI CA Manager', role: 'Runs client practice end-to-end' },
    { icon: Users, name: 'AI Account Manager', role: 'Owns client relationships & renewals' },
    { icon: CalendarClock, name: 'AI Deadline Engine', role: 'Never misses a due date' },
    { icon: FileSearch, name: 'AI Document Employee', role: 'Reads, extracts, files everything' },
    { icon: Mic, name: 'AI Voice Assistant', role: 'Conversational command interface' },
    { icon: Database, name: 'AI Firm Memory', role: 'Remembers every client, forever' },
    { icon: Target, name: 'AI Priority Engine', role: 'Ranks what matters most, now' },
    { icon: TrendingUp, name: 'AI Predictions', role: 'Forecasts revenue, tax & cash' },
  ];

  return (
    <section className="relative section-gap px-4 py-24 sm:px-6">
      <Aurora className="opacity-50" />
      <div className="relative z-10 mx-auto max-w-7xl">
        <Reveal className="mx-auto max-w-2xl text-center">
          <SectionTag><Bot className="h-3 w-3" /> AI Agents</SectionTag>
          <h2 className="mt-5 text-3xl font-semibold tracking-tight text-white sm:text-4xl md:text-5xl">
            An army of AI agents, <span className="accent-text">trained for Indian finance</span>.
          </h2>
          <p className="mt-4 text-white/60">
            Each agent is a specialist. Together, they form a workforce that scales without hiring.
          </p>
        </Reveal>

        <StaggerGroup className="mt-14 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" stagger={0.05}>
          {agents.map((a) => (
            <StaggerItem key={a.name}>
              <div className="group h-full rounded-2xl glass-surface p-5 hover-lift">
                <GlassIcon icon={a.icon} size="sm" />
                <h3 className="mt-4 text-sm font-semibold text-white">{a.name}</h3>
                <p className="mt-1 text-xs leading-relaxed text-white/55">{a.role}</p>
              </div>
            </StaggerItem>
          ))}
        </StaggerGroup>
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   5–8. CLOUD SECTIONS (split layouts)
   ════════════════════════════════════════════════════════════════════════ */

function CloudSection({
  id,
  tag,
  icon,
  title,
  highlight,
  desc,
  bullets,
  reverse,
  mock,
}: {
  id?: string;
  tag: string;
  icon: React.ElementType;
  title: string;
  highlight: string;
  desc: string;
  bullets: string[];
  reverse?: boolean;
  mock: React.ReactNode;
}) {
  const Icon = icon;
  return (
    <section id={id} className="relative section-gap px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <div className={`grid grid-cols-1 items-center gap-10 lg:grid-cols-2 ${reverse ? 'lg:[&>*:first-child]:order-2' : ''}`}>
          <Reveal>
            <SectionTag>
              <Icon className="h-3 w-3" /> {tag}
            </SectionTag>
            <h2 className="mt-5 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              {title} <span className="accent-text">{highlight}</span>
            </h2>
            <p className="mt-4 text-white/60">{desc}</p>
            <ul className="mt-6 space-y-3">
              {bullets.map((b) => (
                <li key={b} className="flex items-start gap-3 text-sm text-white/75">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full accent-gradient-soft">
                    <Check className="h-3 w-3 accent-text" />
                  </span>
                  {b}
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={0.12}>{mock}</Reveal>
        </div>
      </div>
    </section>
  );
}

function ReturnsMock() {
  const rows = [
    { form: 'GSTR-1', client: 'Nexus Traders', status: 'Filed', tone: 'ok' },
    { form: 'GSTR-3B', client: 'Summit Finserv', status: 'In Review', tone: 'warn' },
    { form: 'GSTR-9', client: 'Pioneer Assoc.', status: 'Draft', tone: 'muted' },
    { form: 'GSTR-1', client: 'Vanta Capital', status: 'Filed', tone: 'ok' },
  ];
  return (
    <div className="rounded-3xl glass-surface-strong p-5 shadow-premium">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-white">Returns — Live</div>
        <span className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] font-medium text-white/60">ARN auto-generated</span>
      </div>
      <div className="mt-4 space-y-2">
        {rows.map((r) => (
          <div key={r.form + r.client} className="flex items-center justify-between rounded-xl bg-white/[0.03] px-4 py-3">
            <div>
              <div className="text-sm font-medium text-white">{r.form}</div>
              <div className="text-[11px] text-white/50">{r.client}</div>
            </div>
            <span
              className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                r.tone === 'ok'
                  ? 'bg-emerald-500/15 text-emerald-300'
                  : r.tone === 'warn'
                  ? 'bg-amber-500/15 text-amber-300'
                  : 'bg-white/5 text-white/55'
              }`}
            >
              {r.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BankMock() {
  return (
    <div className="rounded-3xl glass-surface-strong p-5 shadow-premium">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-white">Bank Feeds</div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[10px] font-medium text-emerald-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Live
        </span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {[
          { bank: 'HDFC', bal: '₹42.8L' },
          { bank: 'ICICI', bal: '₹18.4L' },
          { bank: 'SBI', bal: '₹9.1L' },
          { bank: 'Axis', bal: '₹3.6L' },
        ].map((b) => (
          <div key={b.bank} className="rounded-2xl bg-white/[0.03] p-4">
            <div className="text-[11px] uppercase tracking-wider text-white/45">{b.bank}</div>
            <div className="mt-1 text-lg font-semibold text-white">{b.bal}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-2xl bg-white/[0.03] p-4">
        <div className="flex items-center justify-between text-xs">
          <span className="text-white/55">Auto-reconciled today</span>
          <span className="font-semibold accent-text">312 of 318</span>
        </div>
      </div>
    </div>
  );
}

function InvoiceMock() {
  return (
    <div className="rounded-3xl glass-surface-strong p-5 shadow-premium">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-white">INV-2025-0418</div>
        <span className="rounded-full accent-gradient-soft px-2.5 py-1 text-[10px] font-semibold accent-text">₹2,48,000</span>
      </div>
      <div className="mt-4 space-y-2.5 text-xs">
        {[
          ['Client', 'Meridian Tax LLP'],
          ['GSTIN', '27ABCDE1234F1Z5'],
          ['CGST + SGST', '₹22,320 + ₹22,320'],
          ['Due', 'In 14 days'],
        ].map(([k, v]) => (
          <div key={k} className="flex items-center justify-between">
            <span className="text-white/50">{k}</span>
            <span className="font-medium text-white/85">{v}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 flex gap-2">
        <span className="rounded-lg bg-white/5 px-2.5 py-1 text-[10px] font-medium text-white/70">QR ready</span>
        <span className="rounded-lg bg-white/5 px-2.5 py-1 text-[10px] font-medium text-white/70">E-mailed</span>
        <span className="rounded-lg bg-white/5 px-2.5 py-1 text-[10px] font-medium text-white/70">WhatsApp</span>
      </div>
    </div>
  );
}

function WarRoomMock() {
  return (
    <div className="rounded-3xl glass-surface-strong p-5 shadow-premium">
      <div className="flex items-center gap-2 text-sm font-semibold text-white">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg accent-gradient-soft">
          <Target className="h-3.5 w-3.5 accent-text" />
        </span>
        Executive War Room
      </div>
      <div className="mt-4 space-y-2">
        {[
          { t: 'File 3B for 8 clients', p: 'Critical', tone: 'red' },
          { t: 'Reconcile HDFC feed', p: 'High', tone: 'amber' },
          { t: 'Send 12 reminders', p: 'Medium', tone: 'muted' },
          { t: 'Review ITC gap ₹1.2L', p: 'High', tone: 'amber' },
        ].map((a) => (
          <div key={a.t} className="flex items-center justify-between rounded-xl bg-white/[0.03] px-4 py-2.5">
            <span className="text-sm text-white/80">{a.t}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${
                a.tone === 'red'
                  ? 'bg-red-500/15 text-red-300'
                  : a.tone === 'amber'
                  ? 'bg-amber-500/15 text-amber-300'
                  : 'bg-white/5 text-white/55'
              }`}
            >
              {a.p}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   HOW IT WORKS — 4-step user journey
   ════════════════════════════════════════════════════════════════════════ */

function HowItWorksSection() {
  const steps = [
    {
      n: '01',
      icon: Database,
      title: 'Connect your data',
      desc: 'Link GST, bank, invoices and ledgers in minutes — securely, on India-hosted infrastructure.',
    },
    {
      n: '02',
      icon: Brain,
      title: 'Oracle AI analyzes',
      desc: 'Oracle reads every ledger, return and payment — detecting gaps, predicting cash, ranking actions.',
    },
    {
      n: '03',
      icon: Workflow,
      title: 'Automate compliance',
      desc: 'File returns, reconcile accounts and chase receivables on autopilot — with one-tap approval.',
    },
    {
      n: '04',
      icon: TrendingUp,
      title: 'Scale with confidence',
      desc: 'Operate hundreds of firms from one war room — Oracle scales your expertise without hiring.',
    },
  ];

  return (
    <section id="how-it-works" className="relative section-gap px-4 py-24 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <Reveal className="mx-auto max-w-2xl text-center">
          <SectionTag><Workflow className="h-3 w-3" /> How It Works</SectionTag>
          <h2 className="mt-5 text-3xl font-semibold tracking-tight text-white sm:text-4xl md:text-5xl">
            From chaos to clarity in <span className="accent-text">four moves</span>.
          </h2>
          <p className="mt-4 text-white/60">
            No migrations. No consultants. Connect, watch, automate, scale — and let Oracle handle the rest.
          </p>
        </Reveal>

        <div className="relative mt-16">
          {/* connecting gradient line — desktop only, runs through the step numbers */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-12 hidden h-px lg:block"
            style={{
              background:
                'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.16) 10%, rgba(59,130,246,0.40) 50%, rgba(255,255,255,0.16) 90%, transparent 100%)',
            }}
          />
          <StaggerGroup className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4" stagger={0.1}>
            {steps.map((s) => {
              const Icon = s.icon;
              return (
                <StaggerItem key={s.n}>
                  <div className="group relative h-full rounded-3xl glass-surface p-6 hover-lift">
                    <div className="flex items-center justify-between">
                      <span className="text-5xl font-bold leading-none tracking-tight accent-text">
                        {s.n}
                      </span>
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl glass-surface">
                        <Icon className="h-5 w-5 accent-text" />
                      </span>
                    </div>
                    <h3 className="mt-6 text-lg font-semibold text-white">{s.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-white/60">{s.desc}</p>
                  </div>
                </StaggerItem>
              );
            })}
          </StaggerGroup>
        </div>
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   DASHBOARD SHOWCASE — cinematic floating product mockup
   ════════════════════════════════════════════════════════════════════════ */

function DashboardShowcaseSection() {
  const sidebar = [Layers, FileText, Landmark, Receipt, Target];
  const kpis = [
    { label: 'Revenue', value: '₹4.2Cr', delta: '+12.4% QoQ', icon: TrendingUp, tone: 'accent-text' },
    { label: 'GST Liability', value: '₹12.4L', delta: 'Due 20th', icon: IndianRupee, tone: 'text-amber-300' },
    { label: 'Filings Due', value: '3', delta: 'This week', icon: CalendarClock, tone: 'text-white' },
  ];
  const activity = [
    { t: 'GSTR-3B filed', c: 'Nexus Traders', a: '₹1.2L', s: 'Done', tone: 'ok' },
    { t: 'Invoice paid', c: 'Summit Finserv', a: '₹2.4L', s: 'Cleared', tone: 'ok' },
    { t: 'ITC reconciled', c: 'Vanta Capital', a: '₹48K', s: 'Auto', tone: 'muted' },
    { t: 'Payment received', c: 'Pioneer Assoc.', a: '₹6.8L', s: 'Posted', tone: 'ok' },
  ];

  return (
    <section id="showcase" className="relative section-gap overflow-hidden px-4 py-24 sm:px-6">
      <Aurora className="opacity-40" />
      <div className="relative z-10 mx-auto max-w-7xl">
        <Reveal className="mx-auto max-w-2xl text-center">
          <SectionTag><Layers className="h-3 w-3" /> Product</SectionTag>
          <h2 className="mt-5 text-3xl font-semibold tracking-tight text-white sm:text-4xl md:text-5xl">
            The operating system for <span className="accent-text">Indian finance</span>.
          </h2>
          <p className="mt-4 text-white/60">
            Every firm, every return, every rupee — in one cinematic command center. This is where Oracle lives.
          </p>
        </Reveal>

        <Reveal delay={0.1} className="mt-14">
          {/* perspective parent → 3D tilt on the floating mockup */}
          <div style={{ perspective: '2000px' }}>
            <motion.div
              animate={{ y: [0, -8, 0], rotateX: 2 }}
              transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' as const }}
              style={{ transformOrigin: 'center center' }}
            >
              <div className="overflow-hidden rounded-3xl glass-surface-strong p-3 shadow-premium sm:p-4">
                {/* ── top bar ── */}
                <div className="flex items-center gap-3 rounded-2xl bg-white/[0.03] px-3 py-2.5 sm:px-4">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg accent-gradient-soft">
                    <Layers className="h-3.5 w-3.5 accent-text" />
                  </span>
                  <div className="flex flex-1 items-center gap-2 rounded-full bg-white/[0.04] px-3 py-1.5">
                    <FileSearch className="h-3.5 w-3.5 shrink-0 text-white/40" />
                    <span className="truncate text-xs text-white/40">Search firms, invoices, returns…</span>
                  </div>
                  <span className="hidden items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[10px] font-medium text-emerald-300 sm:inline-flex">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Live
                  </span>
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full glass-surface">
                    <Bell className="h-3.5 w-3.5 text-white/60" />
                  </span>
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full accent-gradient text-[10px] font-bold text-black">RM</span>
                </div>

                {/* ── body: sidebar + main ── */}
                <div className="mt-3 flex gap-3">
                  {/* sidebar */}
                  <div className="hidden w-14 flex-col items-center gap-2 rounded-2xl bg-white/[0.03] py-4 sm:flex">
                    {sidebar.map((Icon, i) => (
                      <span
                        key={i}
                        className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${
                          i === 0 ? 'accent-gradient-soft' : 'hover:bg-white/5'
                        }`}
                      >
                        <Icon className={`h-4 w-4 ${i === 0 ? 'accent-text' : 'text-white/55'}`} />
                      </span>
                    ))}
                  </div>

                  {/* main column */}
                  <div className="flex-1 space-y-3">
                    {/* KPI cards */}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      {kpis.map((k) => {
                        const Icon = k.icon;
                        return (
                          <div key={k.label} className="rounded-2xl bg-white/[0.03] p-4">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] uppercase tracking-wider text-white/45">{k.label}</span>
                              <Icon className={`h-4 w-4 ${k.tone}`} />
                            </div>
                            <div className="mt-2 text-2xl font-semibold tracking-tight text-white">{k.value}</div>
                            <div className={`mt-1 text-[11px] ${k.tone}`}>{k.delta}</div>
                          </div>
                        );
                      })}
                    </div>

                    {/* chart + activity table */}
                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
                      {/* revenue area chart */}
                      <div className="rounded-2xl bg-white/[0.03] p-4 lg:col-span-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-xs font-semibold text-white">Revenue this quarter</div>
                            <div className="text-[11px] text-white/45">₹4.2Cr · +12.4% vs last quarter</div>
                          </div>
                          <span className="rounded-full accent-gradient-soft px-2.5 py-1 text-[10px] font-semibold accent-text">Q3 FY25</span>
                        </div>
                        <svg viewBox="0 0 400 120" className="mt-3 h-28 w-full" preserveAspectRatio="none" aria-hidden>
                          <defs>
                            <linearGradient id="showcaseArea" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.45" />
                              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                            </linearGradient>
                            <linearGradient id="showcaseLine" x1="0" y1="0" x2="1" y2="0">
                              <stop offset="0%" stopColor="#10b981" />
                              <stop offset="50%" stopColor="#06b6d4" />
                              <stop offset="100%" stopColor="#3b82f6" />
                            </linearGradient>
                          </defs>
                          <path
                            d="M0,95 L40,78 L80,84 L120,58 L160,66 L200,42 L240,52 L280,32 L320,40 L360,22 L400,14 L400,120 L0,120 Z"
                            fill="url(#showcaseArea)"
                          />
                          <path
                            d="M0,95 L40,78 L80,84 L120,58 L160,66 L200,42 L240,52 L280,32 L320,40 L360,22 L400,14"
                            fill="none"
                            stroke="url(#showcaseLine)"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>

                      {/* recent activity */}
                      <div className="rounded-2xl bg-white/[0.03] p-4 lg:col-span-2">
                        <div className="text-xs font-semibold text-white">Recent activity</div>
                        <div className="mt-3 space-y-2">
                          {activity.map((row) => (
                            <div
                              key={row.t + row.c}
                              className="flex items-center justify-between gap-2 rounded-xl bg-white/[0.02] px-3 py-2"
                            >
                              <div className="min-w-0">
                                <div className="truncate text-xs font-medium text-white">{row.t}</div>
                                <div className="truncate text-[10px] text-white/45">{row.c}</div>
                              </div>
                              <div className="flex shrink-0 items-center gap-2">
                                <span className="text-[11px] font-semibold text-white/85">{row.a}</span>
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${
                                    row.tone === 'ok' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/5 text-white/55'
                                  }`}
                                >
                                  {row.s}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </Reveal>

        <p className="mt-8 text-center text-xs text-white/40">
          Live mockup — your dashboard, your firms, your numbers.
        </p>
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   9. ORACLE AI
   ════════════════════════════════════════════════════════════════════════ */

function OracleAISection() {
  const statements = [
    "I've detected ₹3.2 lakh pending receivables.",
    "I've forecasted ₹18 lakh revenue this month.",
    "I've identified 12 overdue invoices.",
    "I've prepared collection reminders, ready to send.",
  ];

  return (
    <section id="oracle" className="relative section-gap overflow-hidden px-4 py-28 sm:px-6">
      <Aurora />
      <div className="relative z-10 mx-auto max-w-5xl text-center">
        <Reveal>
          <SectionTag><Brain className="h-3 w-3" /> Oracle AI</SectionTag>
          <h2 className="mt-6 text-3xl font-semibold tracking-tight text-white sm:text-4xl md:text-5xl">
            Oracle AI — your always-on <span className="accent-text">financial mind</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-white/60">
            Oracle doesn&apos;t wait to be asked. It watches every ledger, predicts every curve, and
            prepares every action — then tells you what it has done.
          </p>
        </Reveal>

        {/* Oracle orb */}
        <Reveal delay={0.1} className="mt-12 flex justify-center">
          <div className="relative flex h-44 w-44 items-center justify-center">
            <div className="absolute inset-0 rounded-full accent-gradient-soft blur-2xl breathe-glow" />
            <div className="absolute inset-4 rounded-full glass-surface-strong motion-pulse" />
            <div className="relative flex h-20 w-20 items-center justify-center rounded-full accent-gradient">
              <Brain className="h-9 w-9 text-black" />
            </div>
            {/* orbiting dots */}
            {[0, 120, 240].map((deg) => (
              <span
                key={deg}
                className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/80"
                style={{
                  transform: `rotate(${deg}deg) translateX(5.5rem)`,
                  animation: 'oracle-pulse 2.6s ease-in-out infinite',
                }}
              />
            ))}
          </div>
        </Reveal>

        <StaggerGroup className="mt-14 grid grid-cols-1 gap-3 sm:grid-cols-2" stagger={0.1}>
          {statements.map((s) => (
            <StaggerItem key={s}>
              <div className="flex items-start gap-3 rounded-2xl glass-surface p-5 text-left hover-lift">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg accent-gradient-soft">
                  <Sparkles className="h-3.5 w-3.5 accent-text" />
                </span>
                <p className="text-sm leading-relaxed text-white/85">{s}</p>
              </div>
            </StaggerItem>
          ))}
        </StaggerGroup>

        <p className="mt-8 text-xs text-white/40">
          Proactive, never passive. Oracle acts — then informs.
        </p>
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   10. INTERACTIVE PRODUCT DEMO
   ════════════════════════════════════════════════════════════════════════ */

function InteractiveDemoSection({ onGetStarted }: { onGetStarted: () => void }) {
  return (
    <section className="relative section-gap px-4 py-24 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <Reveal className="text-center">
          <SectionTag><MessageSquareDemo /> Interactive Demo</SectionTag>
          <h2 className="mt-5 text-3xl font-semibold tracking-tight text-white sm:text-4xl md:text-5xl">
            Ask Oracle anything. <span className="accent-text">Get the answer — and the action.</span>
          </h2>
        </Reveal>

        <Reveal delay={0.1} className="mt-12">
          <div className="overflow-hidden rounded-3xl glass-surface-strong shadow-premium">
            <div className="flex items-center gap-2 border-b border-white/[0.06] px-5 py-3">
              <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
              <span className="ml-3 text-xs text-white/50">Oracle — live session</span>
            </div>
            <div className="space-y-4 p-6">
              {/* user */}
              <div className="flex justify-end">
                <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-white px-4 py-2.5 text-sm font-medium text-black">
                  What&apos;s my cash position right now?
                </div>
              </div>
              {/* oracle */}
              <div className="flex gap-3">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg accent-gradient">
                  <Brain className="h-3.5 w-3.5 text-black" />
                </span>
                <div className="max-w-[85%] rounded-2xl rounded-tl-sm glass-surface px-4 py-3">
                  <p className="oracle-prose text-sm text-white/85">
                    Your consolidated cash position is <strong className="text-white">₹73.9 lakh</strong> across
                    4 accounts. I&apos;ve flagged <strong className="text-white">₹3.2 lakh in pending
                    receivables</strong> due this week and prepared reminders — I can send them now.
                  </p>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {[
                      { l: 'Available', v: '₹73.9L' },
                      { l: 'Receivables', v: '₹3.2L' },
                      { l: 'Payables', v: '₹1.8L' },
                    ].map((s) => (
                      <div key={s.l} className="rounded-xl bg-white/[0.04] p-3 text-center">
                        <div className="text-sm font-semibold text-white">{s.v}</div>
                        <div className="text-[10px] uppercase tracking-wider text-white/45">{s.l}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="border-t border-white/[0.06] px-6 py-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/45">Oracle prepared 3 actions for you</span>
                <PrimaryButton onClick={onGetStarted} className="px-4 py-2 text-xs">
                  Try Oracle
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </PrimaryButton>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function MessageSquareDemo() {
  return <Sparkles className="h-3 w-3" />;
}

/* ════════════════════════════════════════════════════════════════════════
   11. STATISTICS
   ════════════════════════════════════════════════════════════════════════ */

function AnimatedCounter({ target, prefix = '', suffix = '', decimals = 0 }: { target: number; prefix?: string; suffix?: string; decimals?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  const [val, setVal] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const duration = 1800;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setVal(target * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else setVal(target);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, target]);

  const formatted =
    decimals > 0
      ? val.toFixed(decimals)
      : Math.round(val).toLocaleString('en-IN');

  return (
    <span ref={ref}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}

function StatisticsSection() {
  const stats = [
    { target: 2400, prefix: '₹', suffix: ' Cr+', label: 'Revenue tracked', decimals: 0 },
    { target: 8.5, suffix: ' Lakh+', label: 'Returns filed', decimals: 1 },
    { target: 12000, suffix: '+', label: 'Firms onboarded', decimals: 0 },
    { target: 99.97, suffix: '%', label: 'Uptime SLA', decimals: 2 },
  ];
  return (
    <section className="relative section-gap px-4 py-24 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-2 gap-3 rounded-3xl glass-surface p-8 sm:p-10 lg:grid-cols-4">
          {stats.map((s) => (
            <Reveal key={s.label} className="text-center">
              <div className="text-3xl font-semibold tracking-tight text-white sm:text-4xl md:text-5xl">
                <AnimatedCounter target={s.target} prefix={s.prefix} suffix={s.suffix} decimals={s.decimals} />
              </div>
              <div className="mt-2 text-xs uppercase tracking-wider text-white/50">{s.label}</div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   12. CUSTOMER LOGOS
   ════════════════════════════════════════════════════════════════════════ */

function LogosSection() {
  const logos = ['NEXUS CA', 'SUMMIT FINSERV', 'PIONEER ASSOC.', 'VANTA CAPITAL', 'MERIDIAN TAX', 'ASCENT ADVISORY'];
  return (
    <section className="relative section-gap px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-7xl text-center">
        <Reveal>
          <p className="text-xs uppercase tracking-[0.2em] text-white/40">Trusted by India&apos;s most ambitious firms</p>
          <div className="mt-8 grid grid-cols-2 items-center gap-x-6 gap-y-6 sm:grid-cols-3 lg:grid-cols-6">
            {logos.map((l) => (
              <div key={l} className="text-center text-sm font-semibold tracking-wide text-white/35 transition-colors hover:text-white/60">
                {l}
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   13. TESTIMONIALS
   ════════════════════════════════════════════════════════════════════════ */

function TestimonialsSection() {
  const quotes = [
    {
      q: 'GSTPilot replaced six tools and three accountants worth of manual work. Oracle files returns before I even remember they are due.',
      n: 'Rahul Mehta',
      r: 'Founder & CA, Nexus Associates',
    },
    {
      q: 'The Invoice Cloud is the first product that actually understands Indian receivables. We closed last quarter with zero overdue.',
      n: 'Priya Nair',
      r: 'CFO, Summit Finserv',
    },
    {
      q: 'I manage 48 client firms from one screen. The War Room tells me exactly what to do each morning. It feels like cheating.',
      n: 'Karthik Subramaniam',
      r: 'Partner, Meridian Tax LLP',
    },
  ];
  return (
    <section className="relative section-gap px-4 py-24 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <Reveal className="mx-auto max-w-2xl text-center">
          <SectionTag><Star className="h-3 w-3" /> Testimonials</SectionTag>
          <h2 className="mt-5 text-3xl font-semibold tracking-tight text-white sm:text-4xl md:text-5xl">
            Loved by the firms that <span className="accent-text">move India forward</span>
          </h2>
        </Reveal>

        <StaggerGroup className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-3" stagger={0.1}>
          {quotes.map((t) => (
            <StaggerItem key={t.n}>
              <figure className="flex h-full flex-col rounded-3xl glass-surface p-7 hover-lift">
                <Quote className="h-7 w-7 accent-text" />
                <blockquote className="mt-4 flex-1 text-sm leading-relaxed text-white/80">
                  &ldquo;{t.q}&rdquo;
                </blockquote>
                <figcaption className="mt-6 border-t border-white/[0.06] pt-4">
                  <div className="text-sm font-semibold text-white">{t.n}</div>
                  <div className="text-xs text-white/50">{t.r}</div>
                </figcaption>
              </figure>
            </StaggerItem>
          ))}
        </StaggerGroup>
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   14. PRICING
   ════════════════════════════════════════════════════════════════════════ */

function PricingSection({ onGetStarted }: { onGetStarted: () => void }) {
  const [yearly, setYearly] = useState(false);
  const tiers = [
    {
      name: 'Starter',
      price: 0,
      desc: 'For solo practitioners getting started.',
      features: ['1 firm', 'Up to 25 clients', 'GST Cloud basics', 'Oracle AI (limited)', 'Community support'],
      cta: 'Start Free',
      featured: false,
    },
    {
      name: 'Professional',
      price: yearly ? 3999 : 4999,
      desc: 'For growing firms that need every superpower.',
      features: ['Up to 5 firms', 'Unlimited clients', 'Full GST + Banking + Invoice Cloud', 'Oracle AI (unlimited)', 'All 8 AI Agents', 'Priority support'],
      cta: 'Get Started',
      featured: true,
    },
    {
      name: 'Enterprise',
      price: null,
      desc: 'For networks and large enterprises.',
      features: ['Unlimited firms', 'Dedicated Oracle tuning', 'SSO + audit logs', 'On-prem option', 'Dedicated CSM', '99.99% SLA'],
      cta: 'Talk to Sales',
      featured: false,
    },
  ];

  return (
    <section id="pricing" className="relative section-gap px-4 py-24 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <Reveal className="mx-auto max-w-2xl text-center">
          <SectionTag><IndianRupee className="h-3 w-3" /> Pricing</SectionTag>
          <h2 className="mt-5 text-3xl font-semibold tracking-tight text-white sm:text-4xl md:text-5xl">
            Simple pricing. <span className="accent-text">Serious leverage.</span>
          </h2>

          <div className="mt-7 inline-flex items-center gap-1 rounded-full glass-surface p-1">
            <button
              onClick={() => setYearly(false)}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${!yearly ? 'bg-white text-black' : 'text-white/70 hover:text-white'}`}
            >
              Monthly
            </button>
            <button
              onClick={() => setYearly(true)}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${yearly ? 'bg-white text-black' : 'text-white/70 hover:text-white'}`}
            >
              Yearly <span className="ml-1 text-[10px] text-white/50">−20%</span>
            </button>
          </div>
        </Reveal>

        <div className="mt-14 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {tiers.map((t, i) => (
            <Reveal key={t.name} delay={i * 0.08}>
              <div
                className={`flex h-full flex-col rounded-3xl p-7 hover-lift ${
                  t.featured ? 'glass-surface-strong accent-ring' : 'glass-surface'
                }`}
              >
                {t.featured && (
                  <span className="mb-4 inline-flex w-fit items-center gap-1.5 rounded-full accent-gradient-soft px-3 py-1 text-[10px] font-semibold uppercase tracking-wider accent-text">
                    <Sparkles className="h-3 w-3" /> Most popular
                  </span>
                )}
                <h3 className="text-lg font-semibold text-white">{t.name}</h3>
                <p className="mt-1 text-sm text-white/55">{t.desc}</p>
                <div className="mt-5 flex items-end gap-1">
                  {t.price === null ? (
                    <span className="text-3xl font-semibold text-white">Custom</span>
                  ) : (
                    <>
                      <span className="text-4xl font-semibold tracking-tight text-white">₹{t.price.toLocaleString('en-IN')}</span>
                      <span className="mb-1 text-sm text-white/50">/mo</span>
                    </>
                  )}
                </div>
                <ul className="mt-6 flex-1 space-y-3">
                  {t.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-white/75">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 accent-text" />
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-7">
                  {t.featured ? (
                    <PrimaryButton onClick={onGetStarted} className="w-full">
                      {t.cta}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </PrimaryButton>
                  ) : (
                    <GhostButton onClick={onGetStarted} className="w-full">
                      {t.cta}
                    </GhostButton>
                  )}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   15. SECURITY
   ════════════════════════════════════════════════════════════════════════ */

function SecuritySection() {
  const badges = ['GSTN Compliant', 'RBI Aligned', 'SOC 2 Type II', 'ISO 27001', '256-bit Encryption', 'Daily Backups', 'India-hosted', 'DPDPA Ready'];
  return (
    <section id="security" className="relative section-gap px-4 py-24 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <Reveal className="text-center">
          <SectionTag><ShieldCheck className="h-3 w-3" /> Security</SectionTag>
          <h2 className="mt-5 text-3xl font-semibold tracking-tight text-white sm:text-4xl md:text-5xl">
            Built for the trust <span className="accent-text">Indian finance demands</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-white/60">
            Your data never leaves Indian soil. Every layer — from transit to storage to backup — is
            encrypted, audited, and aligned with national standards.
          </p>
        </Reveal>

        <Reveal delay={0.1} className="mt-12">
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            {badges.map((b) => (
              <span key={b} className="inline-flex items-center gap-1.5 rounded-full glass-surface px-4 py-2 text-xs font-medium text-white/75">
                <Lock className="h-3 w-3 accent-text" />
                {b}
              </span>
            ))}
          </div>
        </Reveal>

        <Reveal delay={0.18} className="mt-12 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { icon: Server, t: 'India data residency', d: 'Mumbai + Hyderabad regions. No cross-border data flow.' },
            { icon: Globe, t: 'Sovereign-grade infra', d: 'Hosted on audited Indian cloud with private networking.' },
            { icon: Lock, t: 'Encryption everywhere', d: 'TLS 1.3 in transit, AES-256 at rest, HSM-backed keys.' },
          ].map((c) => (
            <div key={c.t} className="rounded-2xl glass-surface p-6 hover-lift">
              <GlassIcon icon={c.icon} />
              <h3 className="mt-4 text-sm font-semibold text-white">{c.t}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-white/55">{c.d}</p>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   16. FAQ
   ════════════════════════════════════════════════════════════════════════ */

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl glass-surface overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
        aria-expanded={open}
      >
        <span className="text-sm font-medium text-white">{q}</span>
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/5">
          {open ? <Minus className="h-3.5 w-3.5 text-white/70" /> : <Plus className="h-3.5 w-3.5 text-white/70" />}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="overflow-hidden"
          >
            <p className="px-5 pb-5 text-sm leading-relaxed text-white/60">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FAQSection() {
  const faqs = [
    { q: 'Is GSTPilot approved by GSTN?', a: 'GSTPilot operates as a GST Suvidha Provider–aligned workflow layer. We generate return payloads in GSTN-compatible formats and support ARN tracking. Full ASP/GSP certification is in progress for direct filing.' },
    { q: 'How does Oracle AI work?', a: 'Oracle is a deterministic intelligence layer — not a chatbot. It continuously evaluates your invoices, payments, receivables and returns, then surfaces proactive statements and prepared actions. It acts only with your approval.' },
    { q: 'Can I manage multiple firms?', a: 'Yes. The Multi-Firm Command and Executive War Room are built specifically for CAs and networks operating many client firms from a single screen, with bulk filing and bulk reconciliation.' },
    { q: 'Is my data secure?', a: 'All data is encrypted in transit (TLS 1.3) and at rest (AES-256), hosted on audited Indian cloud infrastructure in Mumbai and Hyderabad. We are SOC 2 Type II and ISO 27001 aligned, with daily encrypted backups.' },
    { q: 'Do you support all GST return types?', a: 'Yes — GSTR-1, GSTR-3B, GSTR-9, GSTR-9C, CMP-08 and more, with ITC reconciliation across GSTR-2B, ledger matching, and automated compliance scoring.' },
    { q: 'What is included in the free plan?', a: 'One firm, up to 25 clients, GST Cloud basics, and limited Oracle AI insights — enough to feel the difference. Upgrade anytime for unlimited firms and the full agent roster.' },
    { q: 'How fast can I get started?', a: 'Most firms are live within a day. Onboarding collects your firm and GSTIN details, Oracle begins analyzing immediately, and the first returns can be prepared the same session.' },
  ];
  return (
    <section className="relative section-gap px-4 py-24 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <Reveal className="text-center">
          <SectionTag><FileText className="h-3 w-3" /> FAQ</SectionTag>
          <h2 className="mt-5 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Questions, <span className="accent-text">answered</span>
          </h2>
        </Reveal>
        <StaggerGroup className="mt-12 space-y-3" stagger={0.05}>
          {faqs.map((f) => (
            <StaggerItem key={f.q}>
              <FAQItem q={f.q} a={f.a} />
            </StaggerItem>
          ))}
        </StaggerGroup>
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   17. CTA
   ════════════════════════════════════════════════════════════════════════ */

function CTASection({ onGetStarted, onBookDemo }: LandingPageProps) {
  return (
    <section className="relative section-gap overflow-hidden px-4 py-28 sm:px-6">
      <Aurora />
      <div className="relative z-10 mx-auto max-w-4xl text-center">
        <Reveal>
          <h2 className="text-4xl font-semibold leading-tight tracking-tight text-white sm:text-5xl md:text-6xl">
            Run your entire financial operation on <span className="accent-text">one brain</span>.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-white/60">
            Join the firms that have already replaced a dozen tools with GSTPilot Infinity. Start
            free — no card required.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <PrimaryButton onClick={onGetStarted} className="px-7 py-3.5 text-base">
              Get Started Free
              <ArrowRight className="h-4 w-4" />
            </PrimaryButton>
            <GhostButton onClick={onBookDemo} className="px-7 py-3.5 text-base">
              Talk to Sales
            </GhostButton>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   18. FOOTER
   ════════════════════════════════════════════════════════════════════════ */

function Footer() {
  const cols = [
    { h: 'Product', links: ['Features', 'Oracle AI', 'Pricing', 'Security', 'App Store'] },
    { h: 'Company', links: ['About', 'Careers', 'Blog', 'Press'] },
    { h: 'Resources', links: ['Docs', 'API', 'Guides', 'Status'] },
    { h: 'Legal', links: ['Privacy', 'Terms', 'GSTN Compliance', 'RBI Alignment'] },
  ];
  return (
    <footer className="mt-auto border-t border-white/[0.06] px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-5">
          <div className="col-span-2 md:col-span-1">
            <BrandLogo
              variant="horizontal"
              theme="dark"
              size={36}
              asLink
              href="#top"
              showTagline
              className="brand-logo"
            />
            <p className="mt-3 text-xs leading-relaxed text-white/45">
              The Financial Brain of India™ — the world's most premium Financial Operating System for Chartered Accountants and Indian Businesses.
            </p>
            <div className="mt-4 flex gap-2">
              {[Twitter, Github, Linkedin].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  className="flex h-8 w-8 items-center justify-center rounded-lg glass-surface text-white/60 transition-colors hover:text-white"
                  aria-label="Social link"
                >
                  <Icon className="h-3.5 w-3.5" />
                </a>
              ))}
            </div>
          </div>

          {cols.map((c) => (
            <div key={c.h}>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-white/50">{c.h}</h4>
              <ul className="mt-4 space-y-2.5">
                {c.links.map((l) => (
                  <li key={l}>
                    <a href="#" className="text-sm text-white/55 transition-colors hover:text-white">
                      {l}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-white/[0.06] pt-6 sm:flex-row">
          <p className="text-xs text-white/40">© 2025 GSTPilot Infinity. All rights reserved.</p>
          <p className="text-xs text-white/40">Made in India · GSTN Compliant · RBI Aligned</p>
        </div>
      </div>
    </footer>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   MAIN
   ════════════════════════════════════════════════════════════════════════ */

export default function LandingPage({ onGetStarted, onBookDemo }: LandingPageProps) {
  return (
    <div className="relative min-h-screen flex flex-col bg-black text-white">
      <ScrollProgress />
      <Navbar onGetStarted={onGetStarted} />
      <div className="flex-1">
        <HeroSection onGetStarted={onGetStarted} onBookDemo={onBookDemo} />
        <FeaturesSection />
        <CapabilitiesSection />
        <AIAgentsSection />
        <CloudSection
          tag="GST Cloud"
          icon={FileText}
          title="File every return,"
          highlight="flawlessly."
          desc="GSTR-1, 3B, 9, 9C and CMP-08 with automatic ITC reconciliation, ARN generation and live compliance scoring — across every client firm."
          bullets={[
            'Two-way ITC reconciliation against GSTR-2B',
            'Auto ARN generation & status tracking',
            'Live compliance scoring per client',
            'Bulk filing across hundreds of firms',
          ]}
          mock={<ReturnsMock />}
        />
        <CloudSection
          tag="Banking Cloud"
          icon={Landmark}
          title="Your bank, finally"
          highlight="in one place."
          desc="Live feeds from every account, auto-reconciliation against ledgers, payment tracking and working-capital intelligence — reconciled while you sleep."
          bullets={[
            'Live bank feeds across HDFC, ICICI, SBI, Axis & more',
            'Auto-reconciliation with ledger entries',
            'Payment tracking — partial, full, scheduled',
            'Working-capital & cash-position intelligence',
          ]}
          reverse
          mock={<BankMock />}
        />
        <CloudSection
          tag="Invoice Cloud"
          icon={Receipt}
          title="Create. Track. Reconcile."
          highlight="Execute."
          desc="The full invoice lifecycle — sales, purchase, receivables, payables, TDS and payroll — with QR-ready PDFs, e-mail & WhatsApp delivery, and auto-collections."
          bullets={[
            'Sales invoices + purchase bills in one engine',
            'Receivables & payables with due-date forecasting',
            'TDS Cloud + Payroll Cloud with payslips',
            'QR-ready PDFs, e-mail & WhatsApp delivery',
          ]}
          mock={<InvoiceMock />}
        />
        <CloudSection
          tag="Execution Cloud"
          icon={Workflow}
          title="From insight to"
          highlight="execution."
          desc="Autopilot, Executive War Room, Run-My-Business and the Decision Engine turn Oracle's intelligence into ranked, executable actions — across firms."
          bullets={[
            'Autopilot runs repeatable operations automatically',
            'Executive War Room prioritises every action',
            'Decision Engine ranks what to do next — and why',
            'Bulk execute across hundreds of firms',
          ]}
          reverse
          mock={<WarRoomMock />}
        />
        <HowItWorksSection />
        <DashboardShowcaseSection />
        <OracleAISection />
        <InteractiveDemoSection onGetStarted={onGetStarted} />
        <StatisticsSection />
        <LogosSection />
        <TestimonialsSection />
        <PricingSection onGetStarted={onGetStarted} />
        <SecuritySection />
        <FAQSection />
        <CTASection onGetStarted={onGetStarted} onBookDemo={onBookDemo} />
      </div>
      <Footer />
    </div>
  );
}

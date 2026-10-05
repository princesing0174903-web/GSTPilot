'use client'

import React from 'react'
import { motion } from 'framer-motion'
import FadingVideo from './FadingVideo'
import BlurText from './BlurText'
import { spaceHeading, spaceBody } from './space-fonts'
import './space-landing.css'

interface SpaceLandingProps {
  /** Called when the user clicks a primary CTA (e.g. navigate to login). */
  onGetStarted?: () => void
}

/* ─── Inline icon set (currentColor stroke / fill) ─────────────────────────── */

function ArrowUpRight({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M7 17L17 7" />
      <path d="M7 7h10v10" />
    </svg>
  )
}

function PlayIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <polygon points="6 4 20 12 6 20 6 4" />
    </svg>
  )
}

function ClockIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  )
}

function GlobeIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18Z" />
    </svg>
  )
}

/* Material-style icons for capability cards (fill currentColor) */
function ImageIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M5 21q-.825 0-1.412-.587T3 19V5q0-.825.588-1.412T5 3h14q.825 0 1.413.588T21 5v14q0 .825-.587 1.413T19 21H5Zm1-4h12l-3.75-5-3 4L9 13l-3 4Z" />
    </svg>
  )
}

function MovieIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M4 6.47 5.76 10H20v8H4V6.47M22 4h-4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.89-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4Z" />
    </svg>
  )
}

function LightbulbIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1Zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7Z" />
    </svg>
  )
}

/* ─── Navbar ──────────────────────────────────────────────────────────────── */

function Navbar({ onGetStarted }: { onGetStarted?: () => void }) {
  return (
    <nav className="fixed top-4 left-0 right-0 z-50 flex items-center justify-between px-8 lg:px-16">
      {/* Left: 48×48 liquid-glass circle with italic serif lowercase "a" */}
      <div className="liquid-glass flex h-12 w-12 shrink-0 items-center justify-center rounded-full">
        <span className="font-heading text-2xl italic leading-none text-white">
          a
        </span>
      </div>

      {/* Center (desktop only): pill with 5 links + Claim a Spot button */}
      <div className="liquid-glass hidden items-center gap-1 rounded-full px-1.5 py-1.5 md:flex">
        {['Home', 'Voyages', 'Worlds', 'Innovation', 'Plan Launch'].map(
          (label) => (
            <a
              key={label}
              href="#"
              className="rounded-full px-3 py-2 font-body text-sm font-medium text-white/90 transition-colors hover:text-white"
            >
              {label}
            </a>
          )
        )}
        <button
          onClick={onGetStarted}
          className="flex items-center gap-1 whitespace-nowrap rounded-full bg-white px-3 py-2 font-body text-sm font-medium text-black transition-transform hover:scale-[1.02]"
        >
          Claim a Spot
          <ArrowUpRight className="h-4 w-4" />
        </button>
      </div>

      {/* Right: 48×48 invisible spacer to balance the logo */}
      <div className="h-12 w-12 shrink-0" aria-hidden="true" />
    </nav>
  )
}

/* ─── Hero ─────────────────────────────────────────────────────────────────── */

const HERO_VIDEO_SRC =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260418_080021_d598092b-c4c2-4e53-8e46-94cf9064cd50.mp4'

const fadeUp = {
  initial: { filter: 'blur(10px)', opacity: 0, y: 20 },
  animate: { filter: 'blur(0px)', opacity: 1, y: 0 },
}

function Hero({ onGetStarted }: { onGetStarted?: () => void }) {
  return (
    <section className="relative min-h-screen w-full overflow-hidden bg-black">
      {/* Background video — 120% width/height, top-aligned, centered */}
      <FadingVideo
        src={HERO_VIDEO_SRC}
        className="absolute left-1/2 top-0 -translate-x-1/2 object-cover object-top z-0"
        style={{ width: '120%', height: '120%' }}
      />

      {/* z-10 content layer */}
      <div className="relative z-10 flex min-h-screen flex-col">
        <Navbar onGetStarted={onGetStarted} />

        {/* Hero content (flex-1, centered) */}
        <div className="flex flex-1 flex-col items-center justify-center px-4 pt-24 text-center">
          {/* Badge */}
          <motion.div
            initial={fadeUp.initial}
            animate={fadeUp.animate}
            transition={{ duration: 0.6, ease: 'easeOut' as const, delay: 0.4 }}
            className="liquid-glass flex items-center gap-2 rounded-full py-1 pl-1 pr-3"
          >
            <span className="rounded-full bg-white px-3 py-1 font-body text-xs font-semibold text-black">
              New
            </span>
            <span className="font-body text-sm text-white/90">
              Maiden Crewed Voyage to Mars Arrives 2026
            </span>
          </motion.div>

          {/* Headline — BlurText */}
          <BlurText
            text="Venture Past Our Sky Across the Universe"
            className="mt-6 max-w-2xl font-heading text-6xl italic text-white leading-[0.8] tracking-[-4px] md:text-7xl lg:text-[5.5rem]"
          />

          {/* Subheading */}
          <motion.p
            initial={fadeUp.initial}
            animate={fadeUp.animate}
            transition={{ duration: 0.6, ease: 'easeOut' as const, delay: 0.8 }}
            className="mt-4 max-w-2xl font-body text-sm font-light leading-tight text-white md:text-base"
          >
            Discover the universe in ways once unimaginable. Our pioneering
            vessels and breakthrough engineering bring deep-space exploration
            within reach—secure and extraordinary.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={fadeUp.initial}
            animate={fadeUp.animate}
            transition={{ duration: 0.6, ease: 'easeOut' as const, delay: 1.1 }}
            className="mt-6 flex items-center gap-6"
          >
            <button
              onClick={onGetStarted}
              className="liquid-glass-strong flex items-center gap-2 rounded-full px-5 py-2.5 font-body text-sm font-medium text-white transition-transform hover:scale-[1.02]"
            >
              Start Your Voyage
              <ArrowUpRight className="h-5 w-5" />
            </button>
            <button className="flex items-center gap-2 font-body text-sm font-medium text-white">
              <PlayIcon className="h-4 w-4" />
              View Liftoff
            </button>
          </motion.div>

          {/* Stats row */}
          <motion.div
            initial={fadeUp.initial}
            animate={fadeUp.animate}
            transition={{ duration: 0.6, ease: 'easeOut' as const, delay: 1.3 }}
            className="mt-8 flex items-stretch gap-4"
          >
            <StatCard
              icon={<ClockIcon className="h-7 w-7 text-white" />}
              value="34.5 Min"
              label="Average Videos Watch Time"
            />
            <StatCard
              icon={<GlobeIcon className="h-7 w-7 text-white" />}
              value="2.8B+"
              label="Users Across the Globe"
            />
          </motion.div>
        </div>

        {/* Partners */}
        <motion.div
          initial={fadeUp.initial}
          animate={fadeUp.animate}
          transition={{ duration: 0.6, ease: 'easeOut' as const, delay: 1.4 }}
          className="flex flex-col items-center gap-4 pb-8"
        >
          <div className="liquid-glass rounded-full px-3.5 py-1 font-body text-xs font-medium text-white">
            Collaborating with top aerospace pioneers globally
          </div>
          <div className="flex items-center gap-12 md:gap-16">
            {['Aeon', 'Vela', 'Apex', 'Orbit', 'Zeno'].map((name) => (
              <span
                key={name}
                className="font-heading text-2xl italic tracking-tight text-white md:text-3xl"
              >
                {name}
              </span>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}

function StatCard({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode
  value: string
  label: string
}) {
  return (
    <div className="liquid-glass flex w-[220px] flex-col rounded-[1.25rem] p-5">
      <div className="mb-auto">{icon}</div>
      <div className="mt-4">
        <div className="font-heading text-4xl italic leading-none tracking-[-1px] text-white">
          {value}
        </div>
        <div className="mt-2 font-body text-xs font-light text-white">
          {label}
        </div>
      </div>
    </div>
  )
}

/* ─── Capabilities ─────────────────────────────────────────────────────────── */

const CAPABILITIES_VIDEO_SRC =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260418_094631_d30ab262-45ee-4b7d-99f3-5d5848c8ef13.mp4'

interface CapabilityCard {
  icon: React.ReactNode
  tags: string[]
  title: string
  body: string
}

const CAPABILITIES: CapabilityCard[] = [
  {
    icon: <ImageIcon className="h-6 w-6 text-white" />,
    tags: ['Natural Context', 'Photo Realism', 'Infinite Settings', 'Eco-Vibe'],
    title: 'AI Scenery',
    body: 'AI analyzes your product to create indistinguishable natural environments — from Icelandic cliffs to misty forests.',
  },
  {
    icon: <MovieIcon className="h-6 w-6 text-white" />,
    tags: ['Scale Fast', 'Visual Consistency', 'Time Saver', 'Ready to Post'],
    title: 'Batch Production',
    body: 'Style your entire product line in minutes. Create a unified visual identity for catalogues and social media without weeks of retouching.',
  },
  {
    icon: <LightbulbIcon className="h-6 w-6 text-white" />,
    tags: ['Ray Tracing', 'Physical Shadows', 'Studio Quality', 'Sunlight Sync'],
    title: 'Smart Lighting',
    body: 'Automatic lighting and material adjustment. Achieve flawless integration with realistic shadows and sunlight.',
  },
]

function Capabilities() {
  return (
    <section className="relative min-h-screen w-full overflow-hidden bg-black">
      {/* Background video — full-bleed, no 120% scale */}
      <FadingVideo
        src={CAPABILITIES_VIDEO_SRC}
        className="absolute inset-0 z-0 h-full w-full object-cover"
      />

      {/* Content layer */}
      <div className="relative z-10 flex min-h-screen flex-col px-8 pt-24 pb-10 md:px-16 lg:px-20">
        {/* Header */}
        <div className="mb-auto">
          <p className="mb-6 font-body text-sm text-white/80">
            {'// Capabilities'}
          </p>
          <h2 className="font-heading text-6xl italic leading-[0.9] tracking-[-3px] text-white md:text-7xl lg:text-[6rem]">
            Production
            <br />
            evolved
          </h2>
        </div>

        {/* Three cards */}
        <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-3">
          {CAPABILITIES.map((card) => (
            <CapabilityCardItem key={card.title} card={card} />
          ))}
        </div>
      </div>
    </section>
  )
}

function CapabilityCardItem({ card }: { card: CapabilityCard }) {
  return (
    <div className="liquid-glass flex min-h-[360px] flex-col rounded-[1.25rem] p-6">
      {/* Top row */}
      <div className="flex items-start justify-between gap-4">
        <div className="liquid-glass flex h-11 w-11 shrink-0 items-center justify-center rounded-[0.75rem]">
          {card.icon}
        </div>
        <div className="flex max-w-[70%] flex-wrap justify-end gap-1.5">
          {card.tags.map((tag) => (
            <span
              key={tag}
              className="liquid-glass whitespace-nowrap rounded-full px-3 py-1 font-body text-[11px] text-white/90"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Middle spacer */}
      <div className="flex-1" />

      {/* Bottom */}
      <div className="mt-6">
        <h3 className="font-heading text-3xl italic leading-none tracking-[-1px] text-white md:text-4xl">
          {card.title}
        </h3>
        <p className="mt-3 max-w-[32ch] font-body text-sm font-light leading-snug text-white/90">
          {card.body}
        </p>
      </div>
    </div>
  )
}

/* ─── Page ─────────────────────────────────────────────────────────────────── */

export default function SpaceLanding({ onGetStarted }: SpaceLandingProps) {
  return (
    <main
      className={`space-landing ${spaceHeading.variable} ${spaceBody.variable} min-h-screen bg-black font-body text-white`}
    >
      <Hero onGetStarted={onGetStarted} />
      <Capabilities />
    </main>
  )
}

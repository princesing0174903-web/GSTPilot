/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * GSTPilot Infinity — Global Black & White Design System Tokens
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Visual standard:
 *   • Canvas: pure black rgb(0 0 0) / #000000
 *   • Primary action button: pure white #FFFFFF with bold black #000000 text in rounded-full pill
 *   • Primary text: pure white #FFFFFF
 *   • Secondary surfaces: dark grayscale (#0A0A0A, #0E0E0E, #141414, #181818)
 *   • Secondary / Instructional text: accessible neutral gray (#A1A1A1)
 *   • Borders: subtle grayscale borders (rgba(255, 255, 255, 0.08))
 *   • Loading: circular progress ring with blue/cyan active arc on black
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// ── CORE COLORS ───────────────────────────────────────────────────────────────
export const coreColors = {
  canvas: '#000000',
  surface: '#0E0E0E',
  surfaceMuted: '#141414',
  surfaceHover: '#181818',
  border: 'rgba(255, 255, 255, 0.08)',
  borderHover: 'rgba(255, 255, 255, 0.18)',
  textPrimary: '#FFFFFF',
  textSecondary: '#A1A1A1',
  textMuted: '#666666',
  buttonPrimaryBg: '#FFFFFF',
  buttonPrimaryText: '#000000',
} as const;

// ── SEMANTIC STATUS COLORS (Restrained) ────────────────────────────────────────
export const statusColors = {
  success: {
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    text: 'text-emerald-400',
    dot: 'bg-emerald-400',
    solid: 'bg-emerald-500',
  },
  warning: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    text: 'text-amber-400',
    dot: 'bg-amber-400',
    solid: 'bg-amber-500',
  },
  danger: {
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/20',
    text: 'text-rose-400',
    dot: 'bg-rose-400',
    solid: 'bg-rose-500',
  },
  info: {
    bg: 'bg-white/[0.04]',
    border: 'border-white/[0.12]',
    text: 'text-white',
    dot: 'bg-white/60',
    solid: 'bg-white',
  },
  neutral: {
    bg: 'bg-white/[0.03]',
    border: 'border-white/[0.08]',
    text: 'text-[#A1A1A1]',
    dot: 'bg-white/40',
    solid: 'bg-white/10',
  },
} as const;

export type StatusTone = keyof typeof statusColors;

// ── TYPOGRAPHY SCALE ──────────────────────────────────────────────────────────
export const typography = {
  h1: 'text-2xl sm:text-3xl font-bold tracking-tight text-white',
  h2: 'text-xl sm:text-2xl font-bold tracking-tight text-white',
  h3: 'text-base font-semibold tracking-tight text-white',
  body: 'text-sm text-white leading-relaxed',
  bodyMuted: 'text-sm text-[#A1A1A1] leading-relaxed',
  instructional: 'text-xs sm:text-sm text-[#A1A1A1] font-normal leading-relaxed',
  caption: 'text-xs text-[#A1A1A1]',
  label: 'text-[11px] font-medium uppercase tracking-wider text-[#A1A1A1]',
  stat: 'text-2xl md:text-3xl font-bold tracking-tight text-white tabular-nums',
} as const;

// ── INSTRUCTIONAL & CONTEXTUAL MICROCOPY ──────────────────────────────────────
// Canonical text style for "Customize your view", "Choose a client", etc.
export const instructionalText = typography.instructional;

// ── UNIVERSAL BUTTON SPECIFICATION ───────────────────────────────────────────
// Matches the white "Post" pill button reference screenshot
export const buttonSpec = {
  pill: 'rounded-full font-bold active:scale-[0.98] transition-all duration-150',
  primary:
    'bg-white text-black hover:bg-[#E5E5E5] active:bg-[#D4D4D4] rounded-full font-bold shadow-none border-0 min-h-[44px] px-8 py-3',
  secondary:
    'bg-white text-black hover:bg-[#E5E5E5] active:bg-[#D4D4D4] rounded-full font-bold shadow-none border-0 min-h-[44px] px-8 py-3',
  outline:
    'bg-white text-black hover:bg-[#E5E5E5] active:bg-[#D4D4D4] rounded-full font-bold shadow-none border-0 min-h-[44px] px-8 py-3',
  ghost:
    'bg-white/[0.08] text-white hover:bg-white hover:text-black rounded-full font-bold min-h-[44px] px-6 py-2.5',
} as const;

// ── CARD SPEC ─────────────────────────────────────────────────────────────────
export const cardSpec = {
  base: 'rounded-xl border border-white/[0.08] bg-[#0E0E0E]',
  padding: 'p-4 sm:p-5',
  paddingCompact: 'p-3 sm:p-4',
  title: 'text-sm font-semibold tracking-tight text-[#EDEDED]',
  subtitle: 'text-xs text-[#A1A1A1] leading-relaxed',
  header: 'flex items-center justify-between gap-3 mb-3',
  iconChip: 'flex items-center justify-center h-8 w-8 rounded-lg bg-white/[0.04] border border-white/[0.08] shrink-0 text-[#EDEDED]',
} as const;

// ── ANIMATION PRESETS ─────────────────────────────────────────────────────────
export const animations = {
  sectionEnter: {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.35, ease: 'easeOut' as const },
  },
  stagger: (index: number, base = 0.05) => ({
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.35, delay: index * base, ease: 'easeOut' as const },
  }),
  modalEnter: {
    initial: { opacity: 0, scale: 0.98, y: 6 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.98, y: 6 },
    transition: { type: 'spring' as const, damping: 25, stiffness: 200 },
  },
  backdropEnter: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
} as const;

// ── SPACING ───────────────────────────────────────────────────────────────────
export const spacing = {
  pageX: 'px-4 sm:px-6',
  pageY: 'py-5 md:py-6',
  sectionGap: 'gap-4 md:gap-5',
  cardGap: 'gap-3 md:gap-4',
} as const;

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * VEYRO™ — ONE Unified Design System
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * This is the SINGLE source of truth for every visual decision in VEYRO.
 * Every page MUST use these tokens and primitives. No exceptions.
 *
 * DESIGN PRINCIPLES:
 *   1. One spacing scale (4 / 6 / 8 / 12 / 16 / 24 / 32 / 48 px)
 *   2. One typography scale (H1 / H2 / H3 / Body / Caption)
 *   3. One color system (Primary blue, Success blue, Warning amber,
 *      Danger red, Info blue — NO random colors. ZERO green/indigo/purple/pink
 *      in the UI. The GREEN NEUTRALIZATION CASCADE in globals.css converts any
 *      stray emerald/green/teal to blue at runtime.)
 *   4. One radius scale (sm 8, md 12, lg 16, xl 20, 2xl 24)
 *   5. One shadow scale (sm, md, lg, glow)
 *   6. One animation system (150ms micro, 250ms standard, 400ms section)
 *   7. One card system (same padding, radius, shadow, title size)
 *
 * Reference: Stripe / Linear / Vercel / Apple Vision Pro
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// ── SEMANTIC STATUS COLORS ────────────────────────────────────────────────────
// One color per meaning. Never use random Tailwind colors for status.
// NOTE: emerald/cyan tokens below are remapped to blue at runtime by the
// GREEN NEUTRALIZATION CASCADE in globals.css. They are kept here as semantic
// hooks only — the rendered color is always blue.
export const statusColors = {
  success: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    text: 'text-blue-400',
    dot: 'bg-blue-400',
    solid: 'bg-blue-500',
  },
  warning: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    text: 'text-amber-400',
    dot: 'bg-amber-400',
    solid: 'bg-amber-500',
  },
  danger: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    text: 'text-red-400',
    dot: 'bg-red-400',
    solid: 'bg-red-500',
  },
  info: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    text: 'text-blue-400',
    dot: 'bg-blue-400',
    solid: 'bg-blue-500',
  },
  neutral: {
    bg: 'bg-white/[0.04]',
    border: 'border-white/[0.08]',
    text: 'text-muted-foreground',
    dot: 'bg-white/40',
    solid: 'bg-white/10',
  },
} as const;

export type StatusTone = keyof typeof statusColors;

// ── TYPOGRAPHY SCALE ──────────────────────────────────────────────────────────
// One heading system. Every page uses the same sizes.
export const typography = {
  h1: 'text-3xl md:text-4xl font-bold tracking-tight text-foreground',
  h2: 'text-xl md:text-2xl font-bold tracking-tight text-foreground',
  h3: 'text-base font-semibold tracking-tight text-foreground',
  body: 'text-sm text-foreground leading-relaxed',
  bodyMuted: 'text-sm text-muted-foreground leading-relaxed',
  caption: 'text-xs text-muted-foreground',
  label: 'text-[11px] font-medium uppercase tracking-wider text-muted-foreground',
  stat: 'text-2xl md:text-3xl font-bold tracking-tight text-foreground tabular-nums',
} as const;

// ── CARD SPEC ─────────────────────────────────────────────────────────────────
// Every card in the app uses the same padding, radius, shadow, title size.
export const cardSpec = {
  // The base card class — applies to ALL cards
  base: 'glass-surface rounded-2xl',
  // Standard content padding
  padding: 'p-6',
  // Compact content padding (for dense layouts)
  paddingCompact: 'p-4',
  // Card title (h3 equivalent)
  title: 'text-sm font-semibold tracking-tight text-foreground',
  // Card subtitle / description
  subtitle: 'text-xs text-muted-foreground leading-relaxed',
  // Card header row (title + optional action)
  header: 'flex items-center justify-between gap-3 mb-4',
  // Icon chip inside card header
  iconChip: 'flex items-center justify-center h-8 w-8 rounded-lg accent-gradient-soft shrink-0',
} as const;

// ── ANIMATION PRESETS ─────────────────────────────────────────────────────────
export const animations = {
  // Section entrance (fade + slide up)
  sectionEnter: {
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5, ease: 'easeOut' as const },
  },
  // Staggered children entrance
  stagger: (index: number, base = 0.08) => ({
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5, delay: index * base, ease: 'easeOut' as const },
  }),
  // Modal entrance (scale + fade)
  modalEnter: {
    initial: { opacity: 0, scale: 0.96, y: 8 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.97, y: 6 },
    transition: { type: 'spring' as const, damping: 20, stiffness: 90 },
  },
  // Backdrop entrance
  backdropEnter: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
} as const;

// ── SPACING ───────────────────────────────────────────────────────────────────
export const spacing = {
  pageX: 'px-4 md:px-6',
  pageY: 'py-8 md:py-10',
  sectionGap: 'gap-6 md:gap-8',
  cardGap: 'gap-4 md:gap-6',
} as const;

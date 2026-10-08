'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO™ Brand Identity System — Official Logo Component
// ═══════════════════════════════════════════════════════════════════════════════
// Brand:      VEYRO™
// Tagline:    The AI Operating System for Business™
// Variants:   full · horizontal · icon · iconText
// Themes:     dark (default, for black bg) · white (for light bg)
// Motion:     hover scale(1.05) + blue-purple glow + 300ms transition
// Fonts:      Poppins SemiBold (wordmark) · Inter (tagline)
// ═══════════════════════════════════════════════════════════════════════════════

import Image from 'next/image';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export type BrandLogoVariant = 'full' | 'horizontal' | 'icon' | 'iconText';
export type BrandLogoTheme = 'dark' | 'white';

export interface BrandLogoProps {
  variant?: BrandLogoVariant;
  theme?: BrandLogoTheme;
  /** Icon height in px. Wordmark + tagline scale proportionally. */
  size?: number;
  /** Clickable — navigates home by default. Set to false for non-link usage. */
  asLink?: boolean;
  href?: string;
  onNavigate?: () => void;
  /** Enable hover scale + glow motion. Default true. */
  animated?: boolean;
  /** Show tagline under wordmark (horizontal variant) or below (full variant). */
  showTagline?: boolean;
  /** Wordmark text override. Default: "VEYRO" */
  wordmark?: string;
  /** Tagline text override. Default: "The AI Operating System for Business" */
  tagline?: string;
  className?: string;
  /** Disable the premium glow filter (use in dense UI like collapsed sidebars). */
  disableGlow?: boolean;
}

// Brand tokens (kept here for single-source-of-truth, also mirrored in globals.css)
export const BRAND = {
  name: 'VEYRO',
  tagline: 'The AI Operating System for Business',
  colors: {
    blue: '#3B82F6',
    purple: '#8B5CF6',
    teal: '#22D3EE',
    bg: '#000000',
    text: '#FFFFFF',
  },
  fonts: {
    wordmark: 'var(--font-poppins), Poppins, ui-sans-serif, system-ui, sans-serif',
    heading: 'var(--font-sora), Sora, ui-sans-serif, system-ui, sans-serif',
    body: 'var(--font-geist-sans), Inter, ui-sans-serif, system-ui, sans-serif',
  },
  assets: {
    iconSrc: '/icon.png',
    iconWhite: '/icon.png',
    iconBlack: '/icon.png',
    iconSvg: '/icon.png',
    fullLogo: '/logo.png',
    fullLogoTransparent: '/logo.png',
    splash: '/logo.png',
  },
} as const;

export function BrandLogo({
  variant = 'horizontal',
  theme = 'dark',
  size = 32,
  asLink = false,
  href = '/',
  onNavigate,
  animated = true,
  showTagline = false,
  wordmark = 'VEYRO',
  tagline = 'The AI Operating System for Business',
  className,
  disableGlow = false,
}: BrandLogoProps) {
  const isWhite = theme === 'white';
  const iconSrc = isWhite ? BRAND.assets.iconWhite : BRAND.assets.iconSrc;

  // ── Motion wrapper ────────────────────────────────────────────────────────
  const MotionTag = animated ? motion.a : 'a';
  const motionProps = animated
    ? {
        whileHover: { scale: 1.05 },
        whileTap: { scale: 0.97 },
        transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] as const },
      }
    : {};

  const glowClass = disableGlow
    ? ''
    : isWhite
      ? 'hover:drop-shadow-[0_0_24px_rgba(139,92,246,0.45)]'
      : 'hover:drop-shadow-[0_0_30px_rgba(59,130,246,0.45)]';

  // ── ICON ONLY ─────────────────────────────────────────────────────────────
  if (variant === 'icon') {
    const content = (
      <Image
        src={iconSrc}
        alt="VEYRO logo"
        width={size}
        height={size}
        priority
        className={cn('shrink-0 transition-all duration-300', glowClass, className)}
      />
    );
    if (asLink) {
      return (
        <MotionTag
          href={href}
          onClick={onNavigate}
          aria-label="VEYRO home"
          {...motionProps}
          className="inline-flex"
        >
          {content}
        </MotionTag>
      );
    }
    return content;
  }

  // ── FULL (vertical: icon + wordmark + tagline, uses the official full logo PNG) ──
  if (variant === 'full') {
    const fullSrc = isWhite ? BRAND.assets.fullLogo : BRAND.assets.fullLogoTransparent;
    // Full logo height; width auto-scales (~1.06 aspect). size = icon height.
    const fullHeight = Math.round(size * 3.4);
    const content = (
      <Image
        src={fullSrc}
        alt="VEYRO — The AI Operating System for Business"
        width={Math.round(fullHeight * 1.06)}
        height={fullHeight}
        priority
        className={cn('shrink-0 transition-all duration-300', glowClass, className)}
      />
    );
    if (asLink) {
      return (
        <MotionTag
          href={href}
          onClick={onNavigate}
          aria-label="VEYRO home"
          {...motionProps}
          className="inline-flex"
        >
          {content}
        </MotionTag>
      );
    }
    return content;
  }

  // ── HORIZONTAL / ICON-TEXT (icon left + wordmark right) ───────────────────
  // 'iconText' = icon + wordmark inline (no tagline even if shown)
  // 'horizontal' = icon + wordmark, optional tagline stacked below wordmark
  const wordmarkSize = Math.round(size * 0.62);
  const taglineSize = Math.max(9, Math.round(size * 0.28));

  const content = (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <Image
        src={iconSrc}
        alt="VEYRO logo"
        width={size}
        height={size}
        priority
        className={cn('shrink-0 transition-all duration-300', glowClass)}
      />
      <span className="flex flex-col items-start leading-none">
        <span
          className="font-semibold tracking-tight"
          style={{
            fontFamily: BRAND.fonts.wordmark,
            fontSize: `${wordmarkSize}px`,
            color: isWhite ? '#000000' : '#FFFFFF',
            lineHeight: 1,
          }}
        >
          {wordmark}
          <span
            className="align-super ml-0.5"
            style={{
              fontSize: `${Math.round(wordmarkSize * 0.4)}px`,
              color: isWhite ? '#3B82F6' : '#22D3EE',
            }}
          >
            ™
          </span>
        </span>
        {showTagline && variant === 'horizontal' && (
          <span
            className="mt-1 font-medium"
            style={{
              fontFamily: BRAND.fonts.body,
              fontSize: `${taglineSize}px`,
              color: isWhite ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.55)',
              lineHeight: 1.2,
            }}
          >
            {tagline}
          </span>
        )}
      </span>
    </span>
  );

  if (asLink) {
    return (
      <MotionTag
        href={href}
        onClick={onNavigate}
        aria-label="VEYRO — The AI Operating System for Business"
        {...motionProps}
        className={cn('inline-flex cursor-pointer', glowClass)}
      >
        {content}
      </MotionTag>
    );
  }
  return content;
}

// ─── Animated brand logo for loading / splash screens ─────────────────────────
// Professional white-circle loader: brand icon centered inside a spinning
// gradient ring with a soft outer glow. Used by route loading screens.
export function BrandLogoPulse({
  size = 96,
  label,
  className,
}: {
  size?: number;
  label?: string;
  className?: string;
}) {
  // Ring dimensions — the SVG viewBox is 100×100; stroke scales with it.
  const ringSize = Math.round(size * 1.35);
  const iconSize = Math.round(size * 0.62);

  return (
    <div className={cn('flex flex-col items-center justify-center gap-7', className)}>
      {/* ── Spinning ring + centered icon ── */}
      <div className="relative" style={{ width: ringSize, height: ringSize }}>
        {/* Outer ambient glow (static, pulsing) */}
        <motion.div
          className="absolute inset-0 rounded-full"
          animate={{
            opacity: [0.35, 0.6, 0.35],
            scale: [0.96, 1.04, 0.96],
          }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            background:
              'radial-gradient(circle, rgba(59,130,246,0.25) 0%, rgba(139,92,246,0.18) 40%, transparent 70%)',
            filter: 'blur(12px)',
          }}
        />
        {/* Spinning gradient ring (SVG for crisp anti-aliasing) */}
        <motion.svg
          width={ringSize}
          height={ringSize}
          viewBox="0 0 100 100"
          className="absolute inset-0"
          animate={{ rotate: 360 }}
          transition={{ duration: 1.1, repeat: Infinity, ease: 'linear' }}
        >
          {/* Track — faint white ring */}
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="3"
          />
          {/* Active arc — white→cyan gradient with rounded cap */}
          <defs>
            <linearGradient id="loaderRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="50%" stopColor="#22D3EE" />
              <stop offset="100%" stopColor="#8B5CF6" />
            </linearGradient>
          </defs>
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="url(#loaderRingGrad)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="70 220"
            strokeDashoffset="0"
          />
        </motion.svg>
        {/* Centered brand icon (static, subtle breathe) */}
        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          animate={{ scale: [0.94, 1, 0.94] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Image
            src={BRAND.assets.iconWhite}
            alt="VEYRO"
            width={iconSize}
            height={iconSize}
            priority
            className="shrink-0 drop-shadow-[0_0_12px_rgba(255,255,255,0.3)]"
          />
        </motion.div>
      </div>

      {/* ── Label with staggered fade-in ── */}
      {label && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.25 }}
          className="flex flex-col items-center gap-2"
        >
          <span
            className="text-[15px] font-semibold tracking-tight text-white"
            style={{ fontFamily: BRAND.fonts.wordmark }}
          >
            {label}
          </span>
          {/* Three-dot breathing indicator under the label */}
          <div className="flex items-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="h-1 w-1 rounded-full bg-white/50"
                animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.1, 0.8] }}
                transition={{
                  duration: 1.2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                  delay: i * 0.2,
                }}
              />
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}

// ─── Sidebar brand (collapse-aware) ───────────────────────────────────────────
// Expanded: icon + "VEYRO" wordmark. Collapsed: icon only. Hover: glow.
export function SidebarBrand({
  collapsed = false,
  size = 32,
  onClick,
}: {
  collapsed?: boolean;
  size?: number;
  onClick?: () => void;
}) {
  const wordmarkSize = Math.round(size * 0.6);
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.3 }}
      className="group relative flex w-full items-center justify-center gap-2.5 rounded-2xl px-2 py-2 transition-all duration-300 hover:bg-white/[0.04] xl:justify-start"
      aria-label="VEYRO home"
    >
      <motion.div
        animate={{
          filter: [
            'drop-shadow(0 0 0px rgba(59,130,246,0))',
            'drop-shadow(0 0 18px rgba(139,92,246,0.5))',
            'drop-shadow(0 0 0px rgba(59,130,246,0))',
          ],
        }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' as const }}
        className="shrink-0"
      >
        <Image
          src={BRAND.assets.iconSrc}
          alt="VEYRO"
          width={size}
          height={size}
          priority
        />
      </motion.div>
      {!collapsed && (
        <div className="hidden xl:flex flex-col items-start leading-none">
          <span
            className="font-semibold tracking-tight text-foreground"
            style={{ fontFamily: BRAND.fonts.wordmark, fontSize: `${wordmarkSize}px`, lineHeight: 1 }}
          >
            VEYRO
            <span className="ml-0.5" style={{ color: '#22D3EE', fontSize: `${Math.round(wordmarkSize * 0.4)}px` }}>
              ™
            </span>
          </span>
          <span
            className="mt-1 font-medium uppercase tracking-wider text-muted-foreground/60"
            style={{ fontFamily: BRAND.fonts.body, fontSize: '9px' }}
          >
            Infinity
          </span>
        </div>
      )}
    </motion.button>
  );
}

export default BrandLogo;

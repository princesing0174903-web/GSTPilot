'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot™ Brand Identity System — Official Logo Component
// ═══════════════════════════════════════════════════════════════════════════════
// Brand:      GSTPilot™
// Tagline:    The Financial Brain of India™
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
  /** Wordmark text override. Default: "GSTPilot" */
  wordmark?: string;
  /** Tagline text override. Default: "The Financial Brain of India" */
  tagline?: string;
  className?: string;
  /** Disable the premium glow filter (use in dense UI like collapsed sidebars). */
  disableGlow?: boolean;
}

// Brand tokens (kept here for single-source-of-truth, also mirrored in globals.css)
export const BRAND = {
  name: 'GSTPilot',
  tagline: 'The Financial Brain of India',
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
    iconTransparent: '/brand/gstpilot-icon-transparent.png',
    iconWhite: '/brand/gstpilot-icon-white.png',
    iconBlack: '/brand/gstpilot-icon.png',
    iconSvg: '/brand/gstpilot-icon.svg',
    fullLogo: '/brand/gstpilot-logo-full.png',
    fullLogoTransparent: '/brand/gstpilot-logo-full-transparent.png',
    splash: '/brand/gstpilot-splash.png',
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
  wordmark = 'GSTPilot',
  tagline = 'The Financial Brain of India',
  className,
  disableGlow = false,
}: BrandLogoProps) {
  const isWhite = theme === 'white';
  const iconSrc = isWhite ? BRAND.assets.iconWhite : BRAND.assets.iconTransparent;

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
        alt="GSTPilot logo"
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
          aria-label="GSTPilot home"
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
        alt="GSTPilot — The Financial Brain of India"
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
          aria-label="GSTPilot home"
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
        alt="GSTPilot logo"
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
        aria-label="GSTPilot — The Financial Brain of India"
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
// Scale 0.95 → 1, glow blue → purple, 2s infinite. Used by loading screens.
export function BrandLogoPulse({
  size = 96,
  label,
  className,
}: {
  size?: number;
  label?: string;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-6', className)}>
      <motion.div
        animate={{
          scale: [0.95, 1, 0.95],
          filter: [
            'drop-shadow(0 0 20px rgba(59,130,246,0.5))',
            'drop-shadow(0 0 35px rgba(139,92,246,0.7))',
            'drop-shadow(0 0 20px rgba(59,130,246,0.5))',
          ],
        }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' as const }}
      >
        <Image
          src={BRAND.assets.iconTransparent}
          alt="GSTPilot"
          width={size}
          height={size}
          priority
          className="shrink-0"
        />
      </motion.div>
      {label && (
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="text-sm font-medium tracking-wide"
          style={{
            fontFamily: BRAND.fonts.body,
            color: 'rgba(255,255,255,0.6)',
          }}
        >
          {label}
        </motion.p>
      )}
    </div>
  );
}

// ─── Sidebar brand (collapse-aware) ───────────────────────────────────────────
// Expanded: icon + "GSTPilot" wordmark. Collapsed: icon only. Hover: glow.
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
      aria-label="GSTPilot home"
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
          src={BRAND.assets.iconTransparent}
          alt="GSTPilot"
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
            GSTPilot
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

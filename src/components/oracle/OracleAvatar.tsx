'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle™ — Dynamic Avatar (Phase 2 — Human Intelligence™)
//
// An animated SVG face that makes Oracle feel alive — like Claude, Apple
// Intelligence, and Perplexity Assistant. The avatar expresses six states
// tied to Oracle's reasoning pipeline + the user's emotional state:
//
//   idle       → gentle smile, slow blink, soft breathing glow
//   thinking   → raised brow, eyes looking up, soft pulse
//   reading    → eyes scanning left-right
//   analyzing  → focused, brow furrowed, steady
//   generating → bright, energetic, fast pulse
//   success    → big smile, happy eyes, emerald glow
//   attention  → alert, eyes wide, amber tint (user stressed/angry)
//   happy      → warm smile (user happy/excited)
//
// Animations are CSS-driven (globals.css) so they're smooth and cheap.
// The SVG is self-contained — no external assets.
// ═══════════════════════════════════════════════════════════════════════════════

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { AvatarFaceState } from './oracle-human';

export interface OracleAvatarProps {
  state?: AvatarFaceState;
  /** Pixel size of the avatar (square). Default 40. */
  size?: number;
  /** Render the breathing glow behind the face. Default true. */
  withGlow?: boolean;
  className?: string;
}

// ─── State → visual config ───────────────────────────────────────────────────

interface FaceConfig {
  /** Tailwind/CSS animation class applied to the root */
  animClass: string;
  /** Glow ring color (CSS color) */
  glowColor: string;
  /** Glow ring opacity 0-1 */
  glowOpacity: number;
  /** Mouth path `d` — the smile curve */
  mouthD: string;
  /** Left eye Y offset (for looking up/down) */
  eyeOffsetY: number;
  /** Eye height (squint vs wide) */
  eyeHeight: number;
  /** Brow rotation degrees (raised / furrowed) */
  browRotate: number;
  /** Brow Y offset */
  browOffsetY: number;
  /** Eye shape: 'round' | 'oval' | 'wide' | 'happy' */
  eyeShape: 'round' | 'oval' | 'wide' | 'happy';
  /** Face tint overlay color (for attention state) */
  tint?: string;
}

function faceConfig(state: AvatarFaceState): FaceConfig {
  switch (state) {
    case 'thinking':
      return {
        animClass: 'oracle-thinking',
        glowColor: 'var(--accent-mid)',
        glowOpacity: 0.35,
        mouthD: 'M 32 58 Q 40 54, 48 58',
        eyeOffsetY: -2,
        eyeHeight: 4,
        browRotate: -8,
        browOffsetY: -3,
        eyeShape: 'oval',
      };
    case 'reading':
      return {
        animClass: 'oracle-reading',
        glowColor: 'var(--accent-start)',
        glowOpacity: 0.3,
        mouthD: 'M 32 58 Q 40 56, 48 58',
        eyeOffsetY: 0,
        eyeHeight: 3,
        browRotate: 0,
        browOffsetY: 0,
        eyeShape: 'round',
      };
    case 'analyzing':
      return {
        animClass: 'oracle-analyzing',
        glowColor: 'var(--accent-end)',
        glowOpacity: 0.4,
        mouthD: 'M 32 58 L 48 58',
        eyeOffsetY: 0,
        eyeHeight: 3,
        browRotate: 6,
        browOffsetY: 2,
        eyeShape: 'oval',
      };
    case 'generating':
      return {
        animClass: 'oracle-generating',
        glowColor: 'var(--accent-mid)',
        glowOpacity: 0.5,
        mouthD: 'M 32 57 Q 40 53, 48 57',
        eyeOffsetY: -1,
        eyeHeight: 4,
        browRotate: -3,
        browOffsetY: -1,
        eyeShape: 'round',
      };
    case 'success':
      return {
        animClass: 'oracle-success',
        glowColor: 'var(--accent-start)',
        glowOpacity: 0.55,
        mouthD: 'M 30 56 Q 40 66, 50 56',
        eyeOffsetY: 0,
        eyeHeight: 2,
        browRotate: 0,
        browOffsetY: 0,
        eyeShape: 'happy',
      };
    case 'attention':
      return {
        animClass: 'oracle-attention',
        glowColor: '#f59e0b',
        glowOpacity: 0.5,
        mouthD: 'M 32 59 Q 40 55, 48 59',
        eyeOffsetY: 0,
        eyeHeight: 6,
        browRotate: -4,
        browOffsetY: -2,
        eyeShape: 'wide',
        tint: 'rgba(245, 158, 11, 0.08)',
      };
    case 'happy':
      return {
        animClass: 'oracle-happy',
        glowColor: 'var(--accent-start)',
        glowOpacity: 0.45,
        mouthD: 'M 30 56 Q 40 64, 50 56',
        eyeOffsetY: 0,
        eyeHeight: 2,
        browRotate: 0,
        browOffsetY: 0,
        eyeShape: 'happy',
      };
    case 'idle':
    default:
      return {
        animClass: 'oracle-idle',
        glowColor: 'var(--accent-start)',
        glowOpacity: 0.3,
        mouthD: 'M 32 57 Q 40 61, 48 57',
        eyeOffsetY: 0,
        eyeHeight: 4,
        browRotate: 0,
        browOffsetY: 0,
        eyeShape: 'round',
      };
  }
}

// ─── Eye renderer ────────────────────────────────────────────────────────────

function Eye({
  cx,
  cy,
  config,
  isLeft,
}: {
  cx: number;
  cy: number;
  config: FaceConfig;
  isLeft: boolean;
}) {
  const offsetY = config.eyeOffsetY;
  const h = config.eyeHeight;
  const w = config.eyeShape === 'wide' ? 5 : 4;

  // Happy eyes = upward arc (^ shape)
  if (config.eyeShape === 'happy') {
    return (
      <path
        d={`M ${cx - w} ${cy + 1} Q ${cx} ${cy - 3}, ${cx + w} ${cy + 1}`}
        stroke="url(#oracle-face-stroke)"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
        className="oracle-blink"
        style={{ transformOrigin: `${cx}px ${cy}px` }}
      />
    );
  }

  // Wide eyes = larger circle
  const rx = config.eyeShape === 'wide' ? 3 : 2.5;
  const ry = h / 2;

  return (
    <g
      className="oracle-blink"
      style={{ transformOrigin: `${cx}px ${cy + offsetY}px` }}
    >
      <ellipse
        cx={cx}
        cy={cy + offsetY}
        rx={rx}
        ry={ry}
        fill="url(#oracle-face-stroke)"
      />
      {/* Highlight */}
      <circle
        cx={cx + (isLeft ? 0.8 : -0.8)}
        cy={cy + offsetY - 0.8}
        r={0.8}
        fill="rgba(255,255,255,0.7)"
      />
    </g>
  );
}

// ─── Main Avatar ─────────────────────────────────────────────────────────────

export function OracleAvatar({
  state = 'idle',
  size = 40,
  withGlow = true,
  className,
}: OracleAvatarProps) {
  const config = faceConfig(state);

  // Use a stable gradient id so multiple avatars on the page don't clash.
  const gid = 'oracle-face-grad';
  const sid = 'oracle-face-stroke';

  return (
    <div
      className={cn('relative inline-flex items-center justify-center', className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Oracle avatar — ${state}`}
    >
      {/* Breathing glow */}
      {withGlow && (
        <div
          className="oracle-glow absolute inset-0 rounded-full breathe-glow"
          style={{
            background: `radial-gradient(circle, ${config.glowColor} 0%, transparent 70%)`,
            opacity: config.glowOpacity,
          }}
        />
      )}

      {/* Pulse ring for active states */}
      {(state === 'thinking' || state === 'generating') && (
        <div
          className="oracle-pulse-ring absolute inset-0 rounded-full"
          style={{
            border: `1.5px solid ${config.glowColor}`,
          }}
        />
      )}

      <motion.svg
        width={size}
        height={size}
        viewBox="0 0 80 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={cn('relative', config.animClass)}
        animate={{ scale: [1, 1.02, 1] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' as const }}
      >
        <defs>
          {/* Face fill: emerald → cyan → blue gradient */}
          <radialGradient id={gid} cx="0.35" cy="0.3" r="0.9">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="55%" stopColor="#06b6d4" />
            <stop offset="100%" stopColor="#3b82f6" />
          </radialGradient>
          <linearGradient id={sid} x1="0" y1="0" x2="80" y2="80">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#e0f2fe" />
          </linearGradient>
        </defs>

        {/* Optional amber tint for attention state */}
        {config.tint && (
          <circle cx="40" cy="40" r="34" fill={config.tint} />
        )}

        {/* Face circle */}
        <circle cx="40" cy="40" r="32" fill={`url(#${gid})`} />
        {/* Subtle inner ring */}
        <circle
          cx="40"
          cy="40"
          r="32"
          fill="none"
          stroke="rgba(255,255,255,0.18)"
          strokeWidth="0.8"
        />
        {/* Top highlight */}
        <ellipse cx="32" cy="24" rx="10" ry="5" fill="rgba(255,255,255,0.22)" />

        {/* Brows */}
        <g
          style={{
            transformBox: 'fill-box',
            transformOrigin: 'center',
          }}
        >
          <rect
            x="26"
            y={30 + config.browOffsetY}
            width="10"
            height="2.2"
            rx="1.1"
            fill="rgba(255,255,255,0.85)"
            transform={`rotate(${config.browRotate} 31 ${31 + config.browOffsetY})`}
          />
          <rect
            x="44"
            y={30 + config.browOffsetY}
            width="10"
            height="2.2"
            rx="1.1"
            fill="rgba(255,255,255,0.85)"
            transform={`rotate(${-config.browRotate} 49 ${31 + config.browOffsetY})`}
          />
        </g>

        {/* Eyes */}
        <Eye cx={31} cy={42} config={config} isLeft />
        <Eye cx={49} cy={42} config={config} isLeft={false} />

        {/* Mouth */}
        <path
          d={config.mouthD}
          stroke="rgba(255,255,255,0.9)"
          strokeWidth="2.4"
          strokeLinecap="round"
          fill="none"
        />

        {/* Cheek blush for happy / success states */}
        {(state === 'happy' || state === 'success') && (
          <>
            <circle cx="24" cy="52" r="2.5" fill="rgba(255,255,255,0.18)" />
            <circle cx="56" cy="52" r="2.5" fill="rgba(255,255,255,0.18)" />
          </>
        )}
      </motion.svg>
    </div>
  );
}

export default OracleAvatar;

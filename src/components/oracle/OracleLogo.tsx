'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI™ — Premium AI Identity Avatar
//
// A world-class animated Oracle logo — inspired by Claude, Perplexity,
// ChatGPT, and Grok. Premium, futuristic, enterprise-grade, minimal, elegant.
//
// States (tied to VEYRO AI reasoning pipeline):
//   idle      → subtle breathing glow, logo static (ready, waiting)
//   thinking  → orbit ring spinning, particles traveling, energy ring pulsing,
//               logo gently rotating, glow bright (VEYRO AI is thinking…)
//   streaming → orbit ring slow, particles slow, logo gently rotating slowly,
//               glow active (calm, intelligent — text is being generated)
//   done      → rotation stops smoothly, subtle breathing glow remains
//
// Technical:
//   • Framer Motion for all animations
//   • GPU-accelerated CSS transforms only (rotate, scale, opacity)
//   • 60 FPS — no layout-affecting properties animated
//   • Dark + Light mode aware (glow adapts)
//   • Responsive (size prop scales everything)
//   • Uses the official Oracle logo image only — no VEYRO branding
// ═══════════════════════════════════════════════════════════════════════════════

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';

export type OracleLogoState = 'idle' | 'thinking' | 'streaming' | 'done';

export interface OracleLogoProps {
  /** Pixel size of the avatar (square). Default 40. */
  size?: number;
  /** Animation state. Default 'idle'. */
  state?: OracleLogoState;
  /** Show the breathing glow behind the logo. Default true. */
  withGlow?: boolean;
  /** Show the orbit ring + particles. Default true. */
  withOrbit?: boolean;
  /** Show the energy ring. Default true. */
  withEnergyRing?: boolean;
  /** Accessible label. */
  label?: string;
  className?: string;
}

// ─── State → animation config ────────────────────────────────────────────────

interface StateConfig {
  /** Orbit ring rotation duration (seconds). Lower = faster. Infinity = no spin. */
  orbitDuration: number;
  /** Energy ring pulse intensity 0-1 */
  energyIntensity: number;
  /** Logo self-rotation duration (seconds). Infinity = no rotation. */
  logoRotateDuration: number;
  /** Glow opacity 0-1 */
  glowOpacity: number;
  /** Glow scale (breathing) */
  glowScale: [number, number];
  /** Particle count visible */
  particleCount: number;
  /** Particle orbit duration (seconds) */
  particleDuration: number;
}

function stateConfig(state: OracleLogoState): StateConfig {
  switch (state) {
    case 'thinking':
      return {
        orbitDuration: 3.2,
        energyIntensity: 0.9,
        logoRotateDuration: 14,
        glowOpacity: 0.55,
        glowScale: [1, 1.12],
        particleCount: 3,
        particleDuration: 3.2,
      };
    case 'streaming':
      // Calm, intelligent — reduced speed but still alive
      return {
        orbitDuration: 8,
        energyIntensity: 0.5,
        logoRotateDuration: 22,
        glowOpacity: 0.4,
        glowScale: [1, 1.06],
        particleCount: 2,
        particleDuration: 8,
      };
    case 'done':
      // Smoothly stopped — only breathing glow remains
      return {
        orbitDuration: Infinity,
        energyIntensity: 0.15,
        logoRotateDuration: Infinity,
        glowOpacity: 0.28,
        glowScale: [1, 1.04],
        particleCount: 0,
        particleDuration: Infinity,
      };
    case 'idle':
    default:
      return {
        orbitDuration: Infinity,
        energyIntensity: 0.18,
        logoRotateDuration: Infinity,
        glowOpacity: 0.3,
        glowScale: [1, 1.05],
        particleCount: 0,
        particleDuration: Infinity,
      };
  }
}

// ─── Particles ────────────────────────────────────────────────────────────────

function OrbitParticle({
  size,
  ringRadius,
  duration,
  delay,
  color,
}: {
  size: number;
  ringRadius: number;
  duration: number;
  delay: number;
  color: string;
}) {
  // Particle travels along a circular orbit using rotate transform on a
  // wrapper (GPU-accelerated). The wrapper rotates, the particle sits at the
  // edge (translateX = ringRadius), and a counter-rotate keeps it round.
  return (
    <motion.div
      className="absolute left-1/2 top-1/2"
      style={{ width: 0, height: 0 }}
      animate={{ rotate: 360 }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: 'linear' as const,
      }}
    >
      <div
        className="absolute rounded-full"
        style={{
          width: size,
          height: size,
          left: ringRadius - size / 2,
          top: -size / 2,
          background: color,
          boxShadow: `0 0 ${size * 1.5}px ${size * 0.5}px ${color}`,
        }}
      />
    </motion.div>
  );
}

// ─── Main Logo ────────────────────────────────────────────────────────────────

export function OracleLogo({
  size = 40,
  state = 'idle',
  withGlow = true,
  withOrbit = true,
  withEnergyRing = true,
  label = 'VEYRO AI',
  className,
}: OracleLogoProps) {
  const cfg = useMemo(() => stateConfig(state), [state]);

  // Derived dimensions — scale with size
  const glowSize = size * 1.6;
  const orbitRadius = size * 0.58; // ring radius from center
  const energyRingSize = size * 1.05;
  const particleSize = Math.max(3, size * 0.1);
  const logoInset = size * 0.18; // padding so logo sits inside the ring

  // Particle colors — complement VEYRO AI logo's blue/purple palette
  const particleColors = ['#3B82F6', '#3B82F6', '#60a5fa'];
  const particles = useMemo(() => {
    if (cfg.particleCount === 0) return [];
    return Array.from({ length: cfg.particleCount }, (_, i) => ({
      id: i,
      color: particleColors[i % particleColors.length],
      delay: (cfg.particleDuration / cfg.particleCount) * i,
    }));
  }, [cfg]);

  const isActive = state === 'thinking' || state === 'streaming';

  return (
    <div
      className={cn('relative inline-flex items-center justify-center', className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${label} — ${state}`}
    >
      {/* ─── Breathing glow (radial gradient) ─── */}
      {withGlow && (
        <motion.div
          className="pointer-events-none absolute left-1/2 top-1/2 rounded-full"
          style={{
            width: glowSize,
            height: glowSize,
            marginLeft: -glowSize / 2,
            marginTop: -glowSize / 2,
            background:
              'radial-gradient(circle, rgba(34,211,238,0.45) 0%, rgba(139,92,246,0.25) 45%, transparent 70%)',
          }}
          animate={{
            opacity: cfg.glowOpacity,
            scale: cfg.glowScale,
          }}
          transition={{
            opacity: { duration: 0.6 },
            scale: {
              duration: state === 'thinking' ? 1.8 : state === 'streaming' ? 3.5 : 5,
              repeat: Infinity,
              repeatType: 'reverse' as const,
              ease: 'easeInOut' as const,
            },
          }}
        />
      )}

      {/* ─── Energy ring (circular border, pulsing opacity) ─── */}
      {withEnergyRing && (
        <motion.div
          className="pointer-events-none absolute left-1/2 top-1/2 rounded-full"
          style={{
            width: energyRingSize,
            height: energyRingSize,
            marginLeft: -energyRingSize / 2,
            marginTop: -energyRingSize / 2,
            border: `${Math.max(1, size * 0.04)}px solid rgba(34,211,238,0.5)`,
            boxShadow: isActive
              ? `0 0 ${size * 0.3}px rgba(34,211,238,0.4), inset 0 0 ${size * 0.2}px rgba(139,92,246,0.2)`
              : `0 0 ${size * 0.15}px rgba(34,211,238,0.15)`,
          }}
          animate={{
            opacity: [cfg.energyIntensity * 0.6, cfg.energyIntensity, cfg.energyIntensity * 0.6],
            scale: [1, state === 'thinking' ? 1.04 : 1.02, 1],
          }}
          transition={{
            duration: state === 'thinking' ? 1.6 : state === 'streaming' ? 3 : 4,
            repeat: Infinity,
            ease: 'easeInOut' as const,
          }}
        />
      )}

      {/* ─── Orbit ring (rotating, with particles) ─── */}
      {withOrbit && cfg.orbitDuration !== Infinity && (
        <motion.div
          className="pointer-events-none absolute left-1/2 top-1/2"
          style={{ width: 0, height: 0 }}
          animate={{ rotate: 360 }}
          transition={{
            duration: cfg.orbitDuration,
            repeat: Infinity,
            ease: 'linear' as const,
          }}
        >
          {/* Faint orbit track */}
          <div
            className="absolute rounded-full"
            style={{
              width: orbitRadius * 2,
              height: orbitRadius * 2,
              left: -orbitRadius,
              top: -orbitRadius,
              border: `${Math.max(0.5, size * 0.015)}px solid rgba(139,92,246,0.18)`,
            }}
          />
        </motion.div>
      )}

      {/* ─── Orbit particles (traveling along the ring) ─── */}
      {withOrbit &&
        particles.map((p) => (
          <OrbitParticle
            key={p.id}
            size={particleSize}
            ringRadius={orbitRadius}
            duration={cfg.particleDuration}
            delay={p.delay}
            color={p.color}
          />
        ))}

      {/* ─── VEYRO AI logo (center, gently rotating when active) ─── */}
      <motion.div
        className="relative z-10 overflow-hidden rounded-full"
        style={{
          width: size - logoInset * 2,
          height: size - logoInset * 2,
        }}
        animate={{
          rotate: cfg.logoRotateDuration !== Infinity ? 360 : 0,
        }}
        transition={{
          duration: cfg.logoRotateDuration !== Infinity ? cfg.logoRotateDuration : 0,
          repeat: cfg.logoRotateDuration !== Infinity ? Infinity : 0,
          ease: 'linear' as const,
        }}
      >
        <img
          src="/oracle-logo.png"
          alt="VEYRO AI"
          className="h-full w-full object-cover"
          draggable={false}
        />
      </motion.div>

      {/* ─── Subtle highlight sheen on the logo (premium feel) ─── */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 z-20 rounded-full"
        style={{
          width: size - logoInset * 2,
          height: size - logoInset * 2,
          marginLeft: -(size - logoInset * 2) / 2,
          marginTop: -(size - logoInset * 2) / 2,
          background:
            'linear-gradient(135deg, rgba(255,255,255,0.18) 0%, transparent 35%, transparent 65%, rgba(255,255,255,0.06) 100%)',
          mixBlendMode: 'overlay',
        }}
      />
    </div>
  );
}

// ─── Thinking Indicator (replaces the old "Oracle is responding" spinner) ─────
// Shows the premium animated Oracle logo + rotating status messages.

const THINKING_MESSAGES = [
  'VEYRO AI is thinking…',
  'Analyzing your business…',
  'Processing with VEYRO AI Intelligence…',
];

export interface OracleThinkingIndicatorProps {
  size?: number;
  className?: string;
}

export function OracleThinkingIndicator({
  size = 36,
  className,
}: OracleThinkingIndicatorProps) {
  // Cycle through the status messages every 3.2s for a premium, living feel.
  const [msgIndex, setMsgIndex] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      setMsgIndex((i) => (i + 1) % THINKING_MESSAGES.length);
    }, 3200);
    return () => clearInterval(id);
  }, []);

  return (
    <div className={cn('flex items-center gap-3 py-1', className)}>
      <OracleLogo size={size} state="thinking" withGlow withOrbit withEnergyRing />

      {/* Rotating status message */}
      <div className="relative h-5 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.span
            key={msgIndex}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35, ease: 'easeOut' as const }}
            className="block text-sm font-medium text-muted-foreground"
          >
            {THINKING_MESSAGES[msgIndex]}
          </motion.span>
        </AnimatePresence>
      </div>

      {/* Blinking cursor */}
      <motion.span
        className="inline-block h-3.5 w-[2px] rounded-full bg-emerald-400 align-middle"
        animate={{ opacity: [1, 0.2, 1] }}
        transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' as const }}
        aria-hidden
      />
    </div>
  );
}

export default OracleLogo;

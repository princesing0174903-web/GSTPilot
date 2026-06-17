'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ V16 — Ambient Background
// Slow aurora gradients · drifting particles · financial network lines.
// Apple keynote / Palantir / Stripe / Perplexity reference. Everything moves slowly.
// Pure CSS + SVG. No videos. pointer-events-none. z-0 behind content.
// ═══════════════════════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface AmbientBackgroundProps {
  className?: string;
  /** Show the financial network lines (SVG) */
  showNetwork?: boolean;
  /** Show drifting particles */
  showParticles?: boolean;
  /** Particle count (default 24) */
  particleCount?: number;
}

export function AmbientBackground({
  className,
  showNetwork = true,
  showParticles = true,
  particleCount = 24,
}: AmbientBackgroundProps) {
  // Pre-compute particle positions so they don't re-randomize on re-render
  const particles = useMemo(
    () =>
      Array.from({ length: particleCount }).map((_, i) => ({
        id: i,
        left: Math.random() * 100,
        top: Math.random() * 100,
        size: 1 + Math.random() * 2.5,
        duration: 20 + Math.random() * 30,
        delay: Math.random() * 10,
        drift: (Math.random() - 0.5) * 40,
        isAccent: Math.random() > 0.6,
      })),
    [particleCount],
  );

  // Network nodes — fixed positions for the financial graph
  const networkNodes = useMemo(
    () => [
      { x: 15, y: 20 },
      { x: 35, y: 15 },
      { x: 60, y: 25 },
      { x: 80, y: 18 },
      { x: 25, y: 45 },
      { x: 50, y: 50 },
      { x: 75, y: 55 },
      { x: 15, y: 70 },
      { x: 40, y: 80 },
      { x: 65, y: 75 },
      { x: 85, y: 65 },
      { x: 30, y: 90 },
    ],
    [],
  );

  // Network edges — which nodes connect to which
  const networkEdges = useMemo(
    () => [
      [0, 1], [1, 2], [2, 3], [0, 4], [1, 4], [2, 5], [3, 6],
      [4, 5], [5, 6], [4, 7], [5, 8], [6, 9], [7, 8], [8, 9],
      [6, 10], [9, 10], [8, 11], [1, 5], [2, 6], [4, 8],
    ],
    [],
  );

  return (
    <div
      className={cn(
        'pointer-events-none fixed inset-0 z-0 overflow-hidden',
        className,
      )}
      aria-hidden="true"
    >
      {/* ── Layer 1: Aurora blobs (slow drifting gradient orbs) ── */}
      <div className="absolute inset-0">
        {/* Emerald aurora — top left */}
        <div
          className="aurora-blob absolute -left-32 -top-32 h-[500px] w-[500px] rounded-full opacity-20"
          style={{
            background: 'radial-gradient(circle, #10b981 0%, transparent 70%)',
            filter: 'blur(80px)',
          }}
        />
        {/* Cyan aurora — center right */}
        <div
          className="aurora-blob absolute right-[-10%] top-1/4 h-[600px] w-[600px] rounded-full opacity-15"
          style={{
            background: 'radial-gradient(circle, #06b6d4 0%, transparent 70%)',
            filter: 'blur(100px)',
            animationDelay: '-10s',
          }}
        />
        {/* Blue aurora — bottom left */}
        <div
          className="aurora-blob absolute bottom-[-15%] left-1/4 h-[550px] w-[550px] rounded-full opacity-12"
          style={{
            background: 'radial-gradient(circle, #3b82f6 0%, transparent 70%)',
            filter: 'blur(90px)',
            animationDelay: '-20s',
          }}
        />
      </div>

      {/* ── Layer 2: Financial network lines (SVG) ── */}
      {showNetwork && (
        <svg
          className="absolute inset-0 h-full w-full"
          preserveAspectRatio="none"
          viewBox="0 0 100 100"
        >
          <defs>
            <linearGradient id="net-line-grad" x1="0" y1="0" x2="100" y2="100">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
              <stop offset="50%" stopColor="#06b6d4" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.3" />
            </linearGradient>
          </defs>
          {/* Edges */}
          {networkEdges.map(([a, b], i) => (
            <line
              key={`edge-${i}`}
              x1={networkNodes[a].x}
              y1={networkNodes[a].y}
              x2={networkNodes[b].x}
              y2={networkNodes[b].y}
              stroke="url(#net-line-grad)"
              strokeWidth="0.08"
              className="network-line"
              style={{ animationDelay: `${i * 0.3}s` }}
            />
          ))}
          {/* Nodes */}
          {networkNodes.map((node, i) => (
            <circle
              key={`node-${i}`}
              cx={node.x}
              cy={node.y}
              r="0.25"
              fill="#06b6d4"
              opacity="0.4"
              className="network-line"
              style={{ animationDelay: `${i * 0.4}s` }}
            />
          ))}
        </svg>
      )}

      {/* ── Layer 3: Drifting particles ── */}
      {showParticles && (
        <div className="absolute inset-0">
          {particles.map((p) => (
            <div
              key={p.id}
              className="absolute rounded-full"
              style={{
                left: `${p.left}%`,
                top: `${p.top}%`,
                width: `${p.size}px`,
                height: `${p.size}px`,
                background: p.isAccent
                  ? 'linear-gradient(135deg, #10b981, #06b6d4)'
                  : 'rgba(255, 255, 255, 0.4)',
                boxShadow: p.isAccent
                  ? '0 0 8px rgba(16, 185, 129, 0.6)'
                  : '0 0 4px rgba(255, 255, 255, 0.3)',
                animation: `particle-float-${p.id} ${p.duration}s ease-in-out infinite`,
                animationDelay: `${p.delay}s`,
              }}
            />
          ))}
          {/* Inject keyframes for each particle's drift path */}
          <style>{particles
            .map((p) => `
              @keyframes particle-float-${p.id} {
                0%, 100% { transform: translate(0, 0); opacity: 0.3; }
                25% { transform: translate(${p.drift}px, -${Math.abs(p.drift) * 0.7}px); opacity: 0.8; }
                50% { transform: translate(${p.drift * 0.5}px, ${Math.abs(p.drift) * 0.5}px); opacity: 0.5; }
                75% { transform: translate(-${Math.abs(p.drift) * 0.6}px, ${p.drift * 0.3}px); opacity: 0.7; }
              }
            `)
            .join('\n')}
          </style>
        </div>
      )}

      {/* ── Layer 4: Subtle vignette to deepen edges ── */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.4) 100%)',
        }}
      />
    </div>
  );
}

export default AmbientBackground;

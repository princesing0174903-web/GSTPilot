'use client';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * GSTPilot Infinity™ — FeaturePlaceholder
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * The SINGLE, premium "not yet available" page for GSTPilot.
 *
 * Per the stabilization directive: "If something isn't implemented, show
 * 'Connect Google to begin syncing data' instead of fake values."
 *
 * Every view that is NOT a real, working feature routes here. This replaces
 * 60+ inconsistent "Coming Soon" pages with ONE beautiful, honest page.
 *
 * Design: glass card, subtle animated gradient, clear messaging, CTA to
 * connect real integrations. Feels like Linear/Vercel "not yet" states.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { motion } from 'framer-motion';
import { Sparkles, Cloud, BookOpen, ArrowRight, type LucideIcon } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { PageContainer } from '@/components/design-system';

export interface FeaturePlaceholderProps {
  /** Display name of the feature, e.g. "Banking", "GSTN", "WhatsApp" */
  featureName: string;
  /** One-line description of what this feature will do */
  description: string;
  /** Lucide icon for the feature */
  icon: LucideIcon;
  /** Optional list of capabilities that will be available */
  capabilities?: string[];
}

export function FeaturePlaceholder({
  featureName,
  description,
  icon: Icon,
  capabilities = [],
}: FeaturePlaceholderProps) {
  const { setCurrentView } = useApp();

  return (
    <PageContainer maxWidth="max-w-3xl">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <div className="glass-surface rounded-2xl overflow-hidden">
          {/* ── Animated header band ── */}
          <div className="relative h-32 overflow-hidden border-b border-white/[0.06]">
            <div
              className="absolute inset-0 opacity-60"
              style={{
                background:
                  'radial-gradient(ellipse at 30% 50%, rgba(16,185,129,0.15), transparent 60%), radial-gradient(ellipse at 70% 50%, rgba(6,182,212,0.12), transparent 60%)',
              }}
            />
            <motion.div
              animate={{
                backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
              }}
              transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute inset-0"
              style={{
                background:
                  'linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent)',
                backgroundSize: '200% 100%',
              }}
            />
            <div className="relative h-full flex items-center justify-center">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
                className="flex items-center justify-center h-16 w-16 rounded-2xl glass-surface-strong"
              >
                <Icon className="h-7 w-7 accent-text" />
              </motion.div>
            </div>
          </div>

          {/* ── Content ── */}
          <div className="p-8 md:p-10 text-center">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
            >
              <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-amber-400 mb-4">
                <Sparkles className="h-3 w-3" />
                On the roadmap
              </div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
                {featureName}
              </h1>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed max-w-md mx-auto">
                {description}
              </p>
            </motion.div>

            {capabilities.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.3 }}
                className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-md mx-auto"
              >
                {capabilities.map((cap) => (
                  <div
                    key={cap}
                    className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-left"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/60 shrink-0" />
                    <span className="text-xs text-muted-foreground">{cap}</span>
                  </div>
                ))}
              </motion.div>
            )}

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.4 }}
              className="mt-8 pt-6 border-t border-white/[0.06]"
            >
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-4">
                Available right now
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={() => setCurrentView('google-workspace')}
                  className="group flex items-center gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-left transition-all hover:bg-white/[0.06] hover:border-emerald-400/30"
                >
                  <div className="flex items-center justify-center h-9 w-9 rounded-lg accent-gradient-soft shrink-0">
                    <Cloud className="h-4 w-4 accent-text" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">Google Workspace</p>
                    <p className="text-[10px] text-muted-foreground">Sync emails, files, contacts</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
                </button>
                <button
                  onClick={() => setCurrentView('zoho-books')}
                  className="group flex items-center gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-left transition-all hover:bg-white/[0.06] hover:border-emerald-400/30"
                >
                  <div className="flex items-center justify-center h-9 w-9 rounded-lg accent-gradient-soft shrink-0">
                    <BookOpen className="h-4 w-4 accent-text" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">Zoho Books</p>
                    <p className="text-[10px] text-muted-foreground">Sync invoices, customers, payments</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
                </button>
              </div>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </PageContainer>
  );
}

export default FeaturePlaceholder;

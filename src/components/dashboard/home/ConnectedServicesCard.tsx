'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Cloud,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  Plug,
  type LucideIcon,
} from 'lucide-react';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * VEYRO Home — Connected Services (Honest, Real Integrations Only)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Stabilization directive: "The Home page must only show integrations that
 * actually exist. The only real integrations are Google and Zoho Books.
 * Everything else is 'Coming Soon' and should not appear in the workflow."
 *
 * Each service shows:
 *   • Logo (icon)
 *   • Status (Connected / Not Connected)
 *   • Last Sync (relative time or "—")
 *   • Account (email / org name)
 *   • Health (Healthy / Unknown)
 *   • Connect button (when not connected)
 *
 * No GSTN, Bank APIs, WhatsApp, Gmail, or Outlook cards — those integrations
 * are NOT shown on the Home page. Their "Connect" CTAs route to the
 * Integration Coming Soon modal instead.
 */

export interface ServiceRow {
  id: 'google' | 'zoho';
  name: string;
  icon: LucideIcon;
  /** Brand color for the icon chip */
  color: string;
  connected: boolean;
  /** ISO timestamp of last sync, or null */
  lastSync: string | null;
  /** Account identifier (email, org name, etc.) */
  account: string | null;
  /** 'healthy' | 'unknown' */
  health: 'healthy' | 'unknown';
}

interface ConnectedServicesCardProps {
  services: ServiceRow[];
  onConnect: (serviceId: 'google' | 'zoho') => void;
  onManage?: () => void;
}

function timeAgo(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

const healthConfig = {
  healthy: { label: 'Healthy', color: 'text-blue-400', dot: 'bg-blue-400' },
  unknown: { label: 'Unknown', color: 'text-muted-foreground', dot: 'bg-muted-foreground/40' },
} as const;

export function ConnectedServicesCard({
  services,
  onConnect,
  onManage,
}: ConnectedServicesCardProps) {
  const connectedCount = services.filter((s) => s.connected).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.4, ease: 'easeOut' as const }}
      className="glass-surface rounded-2xl h-full flex flex-col hover-lift"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 p-6 pb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex items-center justify-center h-8 w-8 rounded-lg accent-gradient-soft shrink-0">
            <Plug className="h-4 w-4 accent-text" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground tracking-tight truncate">
              Connected Services
            </h3>
            <p className="text-[11px] text-muted-foreground">
              {connectedCount}/{services.length} connected · Google · Zoho Books
            </p>
          </div>
        </div>
        {onManage && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onManage}
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            Manage
          </Button>
        )}
      </div>

      {/* Services list */}
      <div className="px-6 pb-6 flex-1 min-h-0 space-y-2">
        {services.map((service) => {
          const Icon = service.icon;
          const health = healthConfig[service.health];
          return (
            <div
              key={service.id}
              className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-3"
            >
              {/* Logo */}
              <div
                className="flex items-center justify-center h-10 w-10 rounded-lg shrink-0"
                style={{ backgroundColor: `${service.color}1a`, color: service.color }}
              >
                <Icon className="h-5 w-5" />
              </div>

              {/* Name + status + account */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-medium text-foreground truncate">
                    {service.name}
                  </p>
                  {service.connected ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                  ) : (
                    <AlertCircle className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      service.connected ? health.dot : 'bg-muted-foreground/40'
                    }`}
                  />
                  <span className="text-[11px] text-muted-foreground">
                    {service.connected
                      ? `Connected · ${timeAgo(service.lastSync)}`
                      : 'Not connected'}
                  </span>
                </div>
                {service.connected && service.account && (
                  <p className="text-[11px] text-muted-foreground/70 truncate mt-0.5">
                    {service.account}
                  </p>
                )}
              </div>

              {/* Action */}
              <div className="shrink-0">
                {service.connected ? (
                  <Badge
                    variant="outline"
                    className={`text-[11px] h-5 px-1.5 ${health.color} border-current/30`}
                  >
                    {service.health === 'healthy' ? 'Healthy' : 'Unknown'}
                  </Badge>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => onConnect(service.id)}
                    className="accent-gradient text-white hover:opacity-90 h-7 px-3 text-[11px] gap-1"
                  >
                    Connect
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

export default ConnectedServicesCard;

// Default service catalog (Google + Zoho Books only).
export const DEFAULT_SERVICES: Omit<ServiceRow, 'connected' | 'lastSync' | 'account' | 'health'>[] = [
  {
    id: 'google',
    name: 'Google',
    icon: Cloud,
    color: '#ea4335',
  },
  {
    id: 'zoho',
    name: 'Zoho Books',
    icon: BookOpen,
    color: '#e43536',
  },
];

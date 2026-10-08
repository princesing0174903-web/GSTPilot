// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Global AI App Marketplace™ — Plugin Engine™
// Plugins extend the platform WITHOUT modifying core: navigation, dashboards,
// reports, AI agents, widgets, commands, automation, notifications, menus,
// pages, settings, search.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { EXTENSION_POINTS_META, parseJsonArray, type AppPluginDTO, type ExtensionPoint, type PluginStatus } from './types';

/** Map a Prisma AppPlugin row to a DTO. */
export function mapPluginToDTO(plugin: {
  id: string; tenantId: string; installId: string | null; pluginKey: string;
  name: string; extensionPoints: string; config: string; status: string;
  enabled: boolean; createdAt: Date;
}): AppPluginDTO {
  return {
    id: plugin.id, tenantId: plugin.tenantId, installId: plugin.installId,
    pluginKey: plugin.pluginKey, name: plugin.name,
    extensionPoints: parseJsonArray<ExtensionPoint>(plugin.extensionPoints, []),
    config: plugin.config ? (JSON.parse(plugin.config) as Record<string, unknown>) : {},
    status: plugin.status as PluginStatus, enabled: plugin.enabled,
    createdAt: plugin.createdAt.toISOString(),
  };
}

/** Install a plugin for a tenant (usually auto-created when an app is installed). */
export async function installPlugin(opts: {
  tenantId: string; pluginKey: string; name: string;
  extensionPoints: ExtensionPoint[]; installId?: string;
  config?: Record<string, unknown>;
}): Promise<AppPluginDTO> {
  const existing = await db.appPlugin.findFirst({
    where: { tenantId: opts.tenantId, pluginKey: opts.pluginKey },
  });
  if (existing) throw new Error(`Plugin '${opts.pluginKey}' is already installed.`);

  const plugin = await db.appPlugin.create({
    data: {
      tenantId: opts.tenantId, installId: opts.installId ?? null,
      pluginKey: opts.pluginKey, name: opts.name,
      extensionPoints: JSON.stringify(opts.extensionPoints),
      config: JSON.stringify(opts.config ?? {}),
      status: 'active', enabled: true,
    },
  });
  return mapPluginToDTO(plugin);
}

/** Uninstall a plugin. */
export async function uninstallPlugin(pluginId: string, tenantId: string): Promise<{ success: boolean; pluginId: string }> {
  const plugin = await db.appPlugin.findUnique({ where: { id: pluginId } });
  if (!plugin) throw new Error('Plugin not found.');
  if (plugin.tenantId !== tenantId) throw new Error('Tenant mismatch.');
  await db.appPlugin.delete({ where: { id: pluginId } });
  return { success: true, pluginId };
}

/** Enable/disable a plugin. */
export async function togglePlugin(pluginId: string, enabled: boolean, tenantId: string): Promise<AppPluginDTO> {
  const plugin = await db.appPlugin.update({
    where: { id: pluginId },
    data: { enabled, status: enabled ? 'active' : 'disabled' },
  });
  return mapPluginToDTO(plugin);
}

/** List all plugins for a tenant. */
export async function listPlugins(tenantId: string): Promise<AppPluginDTO[]> {
  const plugins = await db.appPlugin.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' } });
  return plugins.map(mapPluginToDTO);
}

/** List plugins by extension point — used by the core platform to discover extensions. */
export async function listPluginsByExtensionPoint(tenantId: string, point: ExtensionPoint): Promise<AppPluginDTO[]> {
  const plugins = await db.appPlugin.findMany({
    where: { tenantId, enabled: true, status: 'active' },
  });
  return plugins
    .map(mapPluginToDTO)
    .filter((p) => p.extensionPoints.includes(point));
}

/** Get plugin stats for a tenant. */
export async function getPluginStats(tenantId: string): Promise<{
  total: number; active: number; disabled: number;
  byExtensionPoint: { point: ExtensionPoint; label: string; description: string; count: number }[];
}> {
  const plugins = await db.appPlugin.findMany({ where: { tenantId } });
  const total = plugins.length;
  const active = plugins.filter((p) => p.status === 'active').length;
  const disabled = plugins.filter((p) => p.status === 'disabled').length;

  const pointCounts: Record<string, number> = {};
  for (const p of plugins) {
    const points = parseJsonArray<ExtensionPoint>(p.extensionPoints, []);
    for (const pt of points) pointCounts[pt] = (pointCounts[pt] ?? 0) + 1;
  }

  const byExtensionPoint = EXTENSION_POINTS_META
    .filter((ep) => pointCounts[ep.key])
    .map((ep) => ({
      point: ep.key, label: ep.label, description: ep.description,
      count: pointCounts[ep.key] ?? 0,
    }));

  return { total, active, disabled, byExtensionPoint };
}

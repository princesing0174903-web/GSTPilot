// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Global AI App Marketplace™ — App Sandbox™
// Every application runs inside an isolated sandbox.
// Memory limits · CPU limits · Storage quotas · API quotas · Permission boundaries
// Network restrictions · Execution monitoring · Automatic shutdown
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import type { AppSandboxExecutionDTO, ShutdownReason } from './types';

/** Sandbox quota configuration for an install. */
export interface SandboxQuotas {
  memoryLimitMb: number;
  cpuLimitPct: number;
  storageQuotaMb: number;
  apiQuotaPerMin: number;
  networkRestricted: boolean;
}

/** Map a Prisma AppSandboxExecution row to a DTO. */
export function mapSandboxToDTO(exec: {
  id: string; tenantId: string; installId: string | null; appId: string | null;
  executionType: string; status: string; memoryUsedMb: number; cpuUsedPct: number;
  storageUsedMb: number; apiCallsMade: number; durationMs: number; triggeredBy: string;
  shutdownReason: string | null; errorMessage: string | null; startedAt: Date; completedAt: Date | null;
}): AppSandboxExecutionDTO {
  return {
    id: exec.id, tenantId: exec.tenantId, installId: exec.installId, appId: exec.appId,
    executionType: exec.executionType, status: exec.status as AppSandboxExecutionDTO['status'],
    memoryUsedMb: exec.memoryUsedMb, cpuUsedPct: exec.cpuUsedPct, storageUsedMb: exec.storageUsedMb,
    apiCallsMade: exec.apiCallsMade, durationMs: exec.durationMs, triggeredBy: exec.triggeredBy,
    shutdownReason: (exec.shutdownReason as ShutdownReason) ?? null,
    errorMessage: exec.errorMessage, startedAt: exec.startedAt.toISOString(),
    completedAt: exec.completedAt?.toISOString() ?? null,
  };
}

/** Start a sandboxed execution for an installed app. */
export async function startSandboxExecution(opts: {
  tenantId: string; installId?: string; appId?: string;
  executionType: 'install' | 'update' | 'invoke' | 'cron' | 'webhook_handler' | 'ai_builder';
  triggeredBy?: string;
}): Promise<AppSandboxExecutionDTO> {
  const exec = await db.appSandboxExecution.create({
    data: {
      tenantId: opts.tenantId, installId: opts.installId ?? null, appId: opts.appId ?? null,
      executionType: opts.executionType, status: 'running',
      triggeredBy: opts.triggeredBy ?? 'system',
    },
  });
  return mapSandboxToDTO(exec);
}

/** Complete a sandboxed execution successfully. */
export async function completeSandboxExecution(execId: string, opts: {
  memoryUsedMb?: number; cpuUsedPct?: number; storageUsedMb?: number;
  apiCallsMade?: number; durationMs?: number;
} = {}): Promise<AppSandboxExecutionDTO> {
  const exec = await db.appSandboxExecution.update({
    where: { id: execId },
    data: {
      status: 'completed', completedAt: new Date(),
      memoryUsedMb: opts.memoryUsedMb ?? 0, cpuUsedPct: opts.cpuUsedPct ?? 0,
      storageUsedMb: opts.storageUsedMb ?? 0, apiCallsMade: opts.apiCallsMade ?? 0,
      durationMs: opts.durationMs ?? 0,
    },
  });
  return mapSandboxToDTO(exec);
}

/** Fail a sandboxed execution. */
export async function failSandboxExecution(execId: string, errorMessage: string, opts: {
  memoryUsedMb?: number; cpuUsedPct?: number; storageUsedMb?: number;
  apiCallsMade?: number; durationMs?: number;
} = {}): Promise<AppSandboxExecutionDTO> {
  const exec = await db.appSandboxExecution.update({
    where: { id: execId },
    data: {
      status: 'failed', completedAt: new Date(), errorMessage,
      memoryUsedMb: opts.memoryUsedMb ?? 0, cpuUsedPct: opts.cpuUsedPct ?? 0,
      storageUsedMb: opts.storageUsedMb ?? 0, apiCallsMade: opts.apiCallsMade ?? 0,
      durationMs: opts.durationMs ?? 0,
    },
  });
  return mapSandboxToDTO(exec);
}

/** Automatically shut down a sandboxed execution (quota exceeded, timeout, etc.). */
export async function autoShutdownSandbox(execId: string, reason: Exclude<ShutdownReason, null>): Promise<AppSandboxExecutionDTO> {
  const exec = await db.appSandboxExecution.update({
    where: { id: execId },
    data: {
      status: 'shutdown', completedAt: new Date(),
      shutdownReason: reason,
      errorMessage: reason === 'quota_exceeded' ? 'Sandbox quota exceeded — execution terminated.'
        : reason === 'timeout' ? 'Sandbox execution timed out.'
        : reason === 'error' ? 'Sandbox execution terminated due to error.'
        : 'Sandbox execution terminated manually.',
    },
  });
  return mapSandboxToDTO(exec);
}

/** Check whether an install is within its sandbox quotas. */
export async function checkQuotaCompliance(installId: string, usage: {
  memoryMb: number; cpuPct: number; storageMb: number; apiCallsLastMin: number;
}): Promise<{ compliant: boolean; violations: string[] }> {
  const install = await db.appInstall.findUnique({ where: { id: installId } });
  if (!install) return { compliant: false, violations: ['Install not found.'] };
  const violations: string[] = [];
  if (usage.memoryMb > install.memoryLimitMb) violations.push(`Memory ${usage.memoryMb}MB exceeds limit ${install.memoryLimitMb}MB`);
  if (usage.cpuPct > install.cpuLimitPct) violations.push(`CPU ${usage.cpuPct}% exceeds limit ${install.cpuLimitPct}%`);
  if (usage.storageMb > install.storageQuotaMb) violations.push(`Storage ${usage.storageMb}MB exceeds limit ${install.storageQuotaMb}MB`);
  if (usage.apiCallsLastMin > install.apiQuotaPerMin) violations.push(`API calls ${usage.apiCallsLastMin}/min exceeds limit ${install.apiQuotaPerMin}/min`);
  return { compliant: violations.length === 0, violations };
}

/** List recent sandbox executions for a tenant. */
export async function listSandboxExecutions(tenantId: string, limit = 50): Promise<AppSandboxExecutionDTO[]> {
  const execs = await db.appSandboxExecution.findMany({
    where: { tenantId }, orderBy: { startedAt: 'desc' }, take: limit,
  });
  return execs.map(mapSandboxToDTO);
}

/** Get sandbox execution stats for a tenant. */
export async function getSandboxStats(tenantId: string): Promise<{
  total: number; running: number; completed: number; failed: number; shutdown: number;
  avgDurationMs: number; avgMemoryMb: number; avgCpuPct: number; totalApiCalls: number;
  byType: { type: string; count: number }[];
}> {
  const execs = await db.appSandboxExecution.findMany({ where: { tenantId }, take: 500 });
  const total = execs.length;
  const running = execs.filter((e) => e.status === 'running').length;
  const completed = execs.filter((e) => e.status === 'completed').length;
  const failed = execs.filter((e) => e.status === 'failed').length;
  const shutdown = execs.filter((e) => e.status === 'shutdown').length;
  const avgDurationMs = total > 0 ? Math.round(execs.reduce((sum, e) => sum + e.durationMs, 0) / total) : 0;
  const avgMemoryMb = total > 0 ? Math.round(execs.reduce((sum, e) => sum + e.memoryUsedMb, 0) / total) : 0;
  const avgCpuPct = total > 0 ? Math.round(execs.reduce((sum, e) => sum + e.cpuUsedPct, 0) / total) : 0;
  const totalApiCalls = execs.reduce((sum, e) => sum + e.apiCallsMade, 0);
  const typeMap: Record<string, number> = {};
  for (const e of execs) typeMap[e.executionType] = (typeMap[e.executionType] ?? 0) + 1;
  return {
    total, running, completed, failed, shutdown,
    avgDurationMs, avgMemoryMb, avgCpuPct, totalApiCalls,
    byType: Object.entries(typeMap).map(([type, count]) => ({ type, count })),
  };
}

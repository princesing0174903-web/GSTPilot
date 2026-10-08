'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI™ — Task Queue (Phase 3 — Agent Engine™)
//
// Persistent store for Oracle Tasks. Tasks are spawned when the user clicks an
// Action Card (or when Oracle proactively schedules one). They move through a
// lifecycle: pending → running → completed | failed | scheduled.
//
// Storage: localStorage (per-browser). Same pattern as oracle-storage.ts so
// Oracle is fully functional offline without Firestore writes.
//
// Public API:
//   • listTasks()                   → OracleTask[] (newest first)
//   • loadTask(id)                  → OracleTask | null
//   • saveTask(task)                → void (upsert)
//   • deleteTask(id)                → void
//   • createTask(kind, title, ...)  → OracleTask (persisted, status 'running')
//   • updateTask(id, patch)         → void
//   • scheduleTask(kind, title, ...)→ OracleTask (status 'scheduled')
//   • clearCompleted()              → void (drops all completed/failed tasks)
// ═══════════════════════════════════════════════════════════════════════════════

import type { OracleActionKind, OracleTask, OracleTaskStep } from './oracle-types';
import { buildInitialSteps } from './oracle-actions';

const STORAGE_KEY = 'gstpilot.oracle.tasks';
const MAX_TASKS = 60;

// ─── ID Generator ────────────────────────────────────────────────────────────

export function newTaskId(): string {
  return `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Safe JSON read/write ────────────────────────────────────────────────────

function safeRead<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeWrite<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota exceeded or storage disabled — fail silently.
  }
}

// ─── Task CRUD ───────────────────────────────────────────────────────────────

export function listTasks(): OracleTask[] {
  const all = safeRead<OracleTask[]>(STORAGE_KEY, []);
  return [...all].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function loadTask(id: string): OracleTask | null {
  const all = safeRead<OracleTask[]>(STORAGE_KEY, []);
  return all.find((t) => t.id === id) ?? null;
}

export function saveTask(task: OracleTask): void {
  const all = safeRead<OracleTask[]>(STORAGE_KEY, []);
  const idx = all.findIndex((t) => t.id === task.id);
  if (idx >= 0) {
    all[idx] = task;
  } else {
    all.unshift(task);
  }
  // Trim to MAX_TASKS (drop oldest).
  const trimmed = all.slice(0, MAX_TASKS);
  safeWrite(STORAGE_KEY, trimmed);
}

export function deleteTask(id: string): void {
  const all = safeRead<OracleTask[]>(STORAGE_KEY, []);
  const filtered = all.filter((t) => t.id !== id);
  safeWrite(STORAGE_KEY, filtered);
}

export function updateTask(id: string, patch: Partial<OracleTask>): void {
  const all = safeRead<OracleTask[]>(STORAGE_KEY, []);
  const idx = all.findIndex((t) => t.id === id);
  if (idx < 0) return;
  all[idx] = { ...all[idx], ...patch, updatedAt: new Date().toISOString() };
  safeWrite(STORAGE_KEY, all);
}

export function clearCompleted(): void {
  const all = safeRead<OracleTask[]>(STORAGE_KEY, []);
  const filtered = all.filter(
    (t) => t.status !== 'completed' && t.status !== 'failed',
  );
  safeWrite(STORAGE_KEY, filtered);
}

// ─── Task Factories ──────────────────────────────────────────────────────────

export function createTask(
  kind: OracleActionKind,
  title: string,
  description: string,
  opts: { scheduledFor?: string; resultView?: string } = {},
): OracleTask {
  const now = new Date().toISOString();
  const steps: OracleTaskStep[] = buildInitialSteps(kind);
  // Mark the first step as active.
  if (steps.length > 0) steps[0].state = 'active';

  const task: OracleTask = {
    id: newTaskId(),
    kind,
    title,
    description,
    status: opts.scheduledFor ? 'scheduled' : 'running',
    progress: opts.scheduledFor ? 0 : 5,
    steps,
    createdAt: now,
    updatedAt: now,
    scheduledFor: opts.scheduledFor,
    resultView: opts.resultView,
  };
  saveTask(task);
  return task;
}

// ─── Active Task Selector ────────────────────────────────────────────────────
// Returns the most recent running task (or null). Used by the Status Bar to
// reflect what Oracle is currently working on.

export function activeTask(): OracleTask | null {
  const all = listTasks();
  return all.find((t) => t.status === 'running') ?? null;
}

// ─── Status Counts (for the Agent Panel header) ──────────────────────────────

export function statusCounts(): {
  running: number;
  completed: number;
  failed: number;
  scheduled: number;
} {
  const all = listTasks();
  return {
    running: all.filter((t) => t.status === 'running').length,
    completed: all.filter((t) => t.status === 'completed').length,
    failed: all.filter((t) => t.status === 'failed').length,
    scheduled: all.filter((t) => t.status === 'scheduled').length,
  };
}

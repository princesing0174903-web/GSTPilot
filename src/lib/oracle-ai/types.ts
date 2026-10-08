// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI™ Intelligence Layer — Shared Type System
//
// Pure types — no runtime, no React, no Prisma. Safe to import from client or
// server. This is the single source of truth for the VEYRO AI workspace
// vocabulary.
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Sessions ────────────────────────────────────────────────────────────────

export type SessionStatus = 'active' | 'archived' | 'pinned' | 'deleted';

export interface OracleAISession {
  id: string;
  firmId: string;
  userId: string | null;
  title: string;
  summary: string | null;
  status: SessionStatus;
  agentId: string | null;
  modelUsed: string | null;
  messageCount: number;
  tokensUsed: number;
  metadata: SessionMetadata;
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SessionMetadata {
  language?: string;
  tags?: string[];
  pinned?: boolean;
  origin?: 'manual' | 'quick-ask' | 'agent-delegation' | 'template';
  [k: string]: unknown;
}

// ─── Messages ────────────────────────────────────────────────────────────────

export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';
export type MessageStatus = 'streaming' | 'completed' | 'error' | 'cancelled';

export type MessagePartKind =
  | 'text'
  | 'thinking'
  | 'artifact-ref'
  | 'tool-call'
  | 'tool-result'
  | 'citation'
  | 'agent-handoff';

export interface TextPart {
  kind: 'text';
  text: string;
}

export interface ThinkingPart {
  kind: 'thinking';
  text: string;
  confidence?: number;
  label?: string;
  durationMs?: number;
}

export interface ArtifactRefPart {
  kind: 'artifact-ref';
  artifactId: string;
  title: string;
  kind_hint: ArtifactKind;
}

export interface ToolCallPart {
  kind: 'tool-call';
  toolName: string;
  args: Record<string, unknown>;
  callId: string;
}

export interface ToolResultPart {
  kind: 'tool-result';
  callId: string;
  toolName: string;
  ok: boolean;
  result: unknown;
  durationMs: number;
  error?: string;
}

export interface CitationPart {
  kind: 'citation';
  sourceId: string;
  title: string;
  url?: string;
  snippet?: string;
  referenceNumber?: string;
}

export interface AgentHandoffPart {
  kind: 'agent-handoff';
  fromAgentId: string;
  toAgentId: string;
  reason: string;
}

export type MessagePart =
  | TextPart
  | ThinkingPart
  | ArtifactRefPart
  | ToolCallPart
  | ToolResultPart
  | CitationPart
  | AgentHandoffPart;

export interface OracleAIMessage {
  id: string;
  sessionId: string;
  firmId: string;
  userId: string | null;
  role: MessageRole;
  content: string;
  parts: MessagePart[];
  model: string | null;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
  status: MessageStatus;
  error: string | null;
  agentId: string | null;
  toolName: string | null;
  parentMessageId: string | null;
  createdAt: string;
}

// ─── Artifacts ───────────────────────────────────────────────────────────────

export type ArtifactKind =
  | 'table'
  | 'chart'
  | 'report'
  | 'document'
  | 'code'
  | 'json'
  | 'kanban'
  | 'metric';

export interface TableArtifactData {
  columns: { key: string; label: string; align?: 'left' | 'right' | 'center'; type?: 'text' | 'number' | 'currency' | 'date' | 'badge' }[];
  rows: Record<string, unknown>[];
  totals?: Record<string, number>;
  caption?: string;
}

export interface ChartArtifactData {
  type: 'line' | 'bar' | 'area' | 'pie' | 'radar' | 'scatter';
  title?: string;
  series: { name: string; data: number[]; color?: string }[];
  categories: string[];
  yLabel?: string;
  xLabel?: string;
  stacked?: boolean;
}

export interface ReportArtifactData {
  sections: { heading: string; body: string; bullets?: string[] }[];
  executiveSummary: string;
  keyMetrics?: { label: string; value: string; delta?: string }[];
  confidence?: number;
}

export interface DocumentArtifactData {
  format: 'markdown' | 'html' | 'plain';
  body: string;
  fileName?: string;
}

export interface CodeArtifactData {
  language: string;
  code: string;
  fileName?: string;
}

export interface JsonArtifactData {
  value: unknown;
  schema?: string;
}

export interface KanbanArtifactData {
  columns: { id: string; title: string; cards: { id: string; title: string; body?: string; tags?: string[]; priority?: 'low' | 'medium' | 'high' }[] }[];
}

export interface MetricArtifactData {
  label: string;
  value: string;
  unit?: string;
  delta?: number;
  deltaLabel?: string;
  trend?: number[];
  sparkline?: boolean;
}

export type ArtifactData =
  | TableArtifactData
  | ChartArtifactData
  | ReportArtifactData
  | DocumentArtifactData
  | CodeArtifactData
  | JsonArtifactData
  | KanbanArtifactData
  | MetricArtifactData;

export interface OracleAIArtifact {
  id: string;
  sessionId: string;
  messageId: string | null;
  firmId: string;
  userId: string | null;
  kind: ArtifactKind;
  title: string;
  description: string | null;
  data: ArtifactData;
  rendered: boolean;
  pinned: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Tasks ───────────────────────────────────────────────────────────────────

export type TaskType = 'reasoning' | 'research' | 'report' | 'data-fetch' | 'tool-call' | 'agent-run' | 'batch';
export type TaskStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface OracleAITask {
  id: string;
  firmId: string;
  userId: string | null;
  sessionId: string | null;
  messageId: string | null;
  type: TaskType;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: number;
  progress: number;
  payload: Record<string, unknown>;
  result: unknown | null;
  error: string | null;
  agentId: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Agents ──────────────────────────────────────────────────────────────────

export interface OracleAIAgent {
  id: string;
  firmId: string;
  name: string;
  role: string;
  description: string | null;
  systemPrompt: string;
  tools: string[];
  model: string | null;
  color: string;
  icon: string;
  temperature: number;
  isBuiltIn: boolean;
  isActive: boolean;
  invocationCount: number;
  lastInvokedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Knowledge ───────────────────────────────────────────────────────────────

export type KnowledgeCategory = 'gst' | 'compliance' | 'finance' | 'operations' | 'legal' | 'general';

export interface OracleAIKnowledge {
  id: string;
  firmId: string;
  title: string;
  content: string;
  category: KnowledgeCategory;
  tags: string[];
  source: string | null;
  sourceType: 'manual' | 'imported' | 'generated' | 'url';
  confidence: number;
  pinned: boolean;
  viewCount: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// ─── Tool Calls ──────────────────────────────────────────────────────────────

export type ToolCallStatus = 'pending' | 'success' | 'error' | 'timeout';

export interface OracleAIToolCall {
  id: string;
  messageId: string | null;
  sessionId: string | null;
  firmId: string;
  userId: string | null;
  toolName: string;
  args: Record<string, unknown>;
  result: unknown | null;
  status: ToolCallStatus;
  durationMs: number;
  error: string | null;
  createdAt: string;
}

// ─── Chat request / streaming ────────────────────────────────────────────────

export interface ChatRequest {
  sessionId: string;
  message: string;
  agentId?: string;
  attachments?: { name: string; type: string; size: number; dataUri?: string }[];
  dryRun?: boolean;
  model?: string;
}

export interface StreamEvent {
  type:
    | 'session'
    | 'message-start'
    | 'thinking'
    | 'text-delta'
    | 'artifact'
    | 'tool-call'
    | 'tool-result'
    | 'citation'
    | 'agent-handoff'
    | 'usage'
    | 'message-end'
    | 'error'
    | 'done';
  [k: string]: unknown;
}

// ─── Tool framework ──────────────────────────────────────────────────────────

export interface ToolDefinition<TArgs = Record<string, unknown>, TResult = unknown> {
  name: string;
  description: string;
  category: 'data' | 'action' | 'research' | 'analysis' | 'communication';
  parameters: ToolParameter[];
  requiresApproval?: boolean;
  execute: (args: TArgs, ctx: ToolContext) => Promise<ToolExecutionResult<TResult>>;
}

export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'enum';
  description: string;
  required: boolean;
  enum?: string[];
  default?: unknown;
}

export interface ToolContext {
  firmId: string;
  userId: string | null;
  sessionId: string;
  messageId: string;
}

export interface ToolExecutionResult<T = unknown> {
  ok: boolean;
  result?: T;
  error?: string;
  artifacts?: { kind: ArtifactKind; title: string; data: ArtifactData }[];
  citations?: { title: string; url?: string; snippet?: string; referenceNumber?: string }[];
}

// ─── Reasoning ───────────────────────────────────────────────────────────────

export interface ReasoningStep {
  label: string;
  detail: string;
  confidence: number;
  durationMs: number;
}

export interface ReasoningTrace {
  steps: ReasoningStep[];
  finalAnswer: string;
  confidence: number;
  modelUsed: string;
}

// ─── UI helpers ──────────────────────────────────────────────────────────────

export const ARTIFICT_KIND_LABEL: Record<ArtifactKind, string> = {
  table: 'Table',
  chart: 'Chart',
  report: 'Report',
  document: 'Document',
  code: 'Code',
  json: 'JSON',
  kanban: 'Board',
  metric: 'Metric',
};

export const TASK_STATUS_GLYPH: Record<TaskStatus, string> = {
  queued: '○',
  running: '◐',
  completed: '●',
  failed: '✕',
  cancelled: '⊘',
};

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  queued: 'Queued',
  running: 'Running',
  completed: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

export const KNOWLEDGE_CATEGORY_LABEL: Record<KnowledgeCategory, string> = {
  gst: 'GST',
  compliance: 'Compliance',
  finance: 'Finance',
  operations: 'Operations',
  legal: 'Legal',
  general: 'General',
};

export const KNOWLEDGE_CATEGORY_COLOR: Record<KnowledgeCategory, string> = {
  gst: 'emerald',
  compliance: 'amber',
  finance: 'teal',
  operations: 'sky',
  legal: 'rose',
  general: 'slate',
};

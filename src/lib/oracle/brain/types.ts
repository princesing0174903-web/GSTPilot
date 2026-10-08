// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI™ — AI Business Brain Types (PROMPT 6)
//
// Type definitions for the persistent memory system. These mirror the
// OracleBrain* Prisma models and are shared by the engine, API routes,
// and UI components.
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Memory types ─────────────────────────────────────────────────────────────

export type BrainMemoryType =
  | 'conversation'
  | 'business'
  | 'user'
  | 'task'
  | 'decision'
  | 'reminder'
  | 'report'
  | 'learning'
  | 'fact';

export type ConversationSubtype =
  | 'summary'
  | 'topics'
  | 'actions'
  | 'intent'
  | 'result'
  | 'full';

export type BusinessMemorySubtype =
  | 'revenue_trend'
  | 'gst_history'
  | 'collection_history'
  | 'cash_history'
  | 'expenses'
  | 'growth'
  | 'recurring_risk'
  | 'snapshot';

export type UserMemorySubtype =
  | 'preference'
  | 'writing_style'
  | 'favourite_action'
  | 'frequent_query'
  | 'profile';

export type TaskMemorySubtype =
  | 'collect_payment'
  | 'generate_report'
  | 'file_gst'
  | 'call_client'
  | 'review_vendor'
  | 'custom';

export interface BrainMemory {
  id: string;
  firmId: string;
  userId?: string | null;
  type: BrainMemoryType;
  subtype?: string | null;
  title: string;
  content: string;
  summary?: string | null;
  embedding?: number[] | null;
  tags: string[];
  importance: number;
  pinned: boolean;
  source: string;
  metadata: Record<string, unknown>;
  archived: boolean;
  expiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMemoryInput {
  firmId: string;
  userId?: string;
  type: BrainMemoryType;
  subtype?: string;
  title: string;
  content: string;
  summary?: string;
  tags?: string[];
  importance?: number;
  pinned?: boolean;
  source?: string;
  metadata?: Record<string, unknown>;
  expiresAt?: Date;
  /** Skip embedding generation (e.g. for high-volume writes). Default false. */
  skipEmbedding?: boolean;
}

// ─── Semantic search ──────────────────────────────────────────────────────────

export interface SemanticSearchResult {
  memory: BrainMemory;
  score: number; // 0-1 cosine similarity
}

export interface SemanticSearchParams {
  firmId: string;
  query: string;
  topK?: number;
  types?: BrainMemoryType[];
  minScore?: number;
  includeArchived?: boolean;
}

// ─── Tasks ────────────────────────────────────────────────────────────────────

export type TaskType =
  | 'collect_payment'
  | 'generate_report'
  | 'file_gst'
  | 'call_client'
  | 'review_vendor'
  | 'custom';

export type TaskStatus =
  | 'pending'
  | 'in_progress'
  | 'reminder_sent'
  | 'follow_up'
  | 'completed'
  | 'cancelled';

export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

export interface BrainTask {
  id: string;
  firmId: string;
  userId?: string | null;
  title: string;
  description: string;
  type: TaskType;
  status: TaskStatus;
  priority: TaskPriority;
  relatedType?: string | null;
  relatedId?: string | null;
  relatedLabel?: string | null;
  dueDate?: string | null;
  reminderSentAt?: string | null;
  followUpSentAt?: string | null;
  completedAt?: string | null;
  completedBy?: string | null;
  completionNote?: string | null;
  sourceMemoryId?: string | null;
  autonomous: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// ─── Decisions ────────────────────────────────────────────────────────────────

export type DecisionStatus =
  | 'recommended'
  | 'accepted'
  | 'rejected'
  | 'implemented'
  | 'superseded'
  | 'failed';

export type DecisionOutcome = 'success' | 'failure' | 'partial' | 'pending';

export interface BrainDecision {
  id: string;
  firmId: string;
  userId?: string | null;
  title: string;
  recommendation: string;
  reason: string;
  evidence: string[];
  expectedOutcome: string;
  confidence: number;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  status: DecisionStatus;
  outcome?: DecisionOutcome | null;
  outcomeNote?: string | null;
  decidedAt?: string | null;
  implementedAt?: string | null;
  sourceMemoryId?: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// ─── Reports ──────────────────────────────────────────────────────────────────

export type ReportType = 'daily' | 'weekly' | 'monthly';

export interface BrainReport {
  id: string;
  firmId: string;
  userId?: string | null;
  type: ReportType;
  period: string;
  title: string;
  summary: string;
  content: ReportContent;
  insights: ReportInsight[];
  recommendations: ReportRecommendation[];
  metrics: Record<string, number | string>;
  generatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReportSection {
  heading: string;
  body: string;
  bullets?: string[];
  metrics?: { label: string; value: string; tone?: 'positive' | 'negative' | 'neutral' | 'warning' }[];
}

export interface ReportContent {
  sections: ReportSection[];
}

export interface ReportInsight {
  headline: string;
  detail: string;
  severity: 'info' | 'watch' | 'warn' | 'critical';
}

export interface ReportRecommendation {
  title: string;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  action: string;
  reason: string;
  impact: string;
}

// ─── Reminders ────────────────────────────────────────────────────────────────

export type ReminderType =
  | 'gst_due'
  | 'customer_overdue'
  | 'low_balance'
  | 'cash_runway'
  | 'revenue_drop'
  | 'task_due'
  | 'custom';

export type ReminderSeverity = 'info' | 'watch' | 'warn' | 'critical';

export type ReminderStatus = 'active' | 'snoozed' | 'dismissed' | 'acted';

export interface BrainReminder {
  id: string;
  firmId: string;
  userId?: string | null;
  type: ReminderType;
  title: string;
  message: string;
  severity: ReminderSeverity;
  relatedType?: string | null;
  relatedId?: string | null;
  relatedLabel?: string | null;
  dueDate?: string | null;
  triggerDate?: string | null;
  status: ReminderStatus;
  actionTaken?: string | null;
  snoozedUntil?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Learning ─────────────────────────────────────────────────────────────────

export type LearningSignal =
  | 'edits_report'
  | 'exports_pdf'
  | 'ignores_advice'
  | 'prefers_short'
  | 'prefers_language'
  | 'frequent_query'
  | 'favourite_action'
  | 'custom';

export interface BrainLearning {
  id: string;
  firmId: string;
  userId?: string | null;
  signal: LearningSignal;
  pattern: string;
  observation: string;
  weight: number;
  occurrenceCount: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// ─── Timeline ─────────────────────────────────────────────────────────────────

export type TimelineBucket = 'today' | 'yesterday' | 'last_week' | 'last_month' | 'older';

export interface TimelineEntry {
  memory: BrainMemory;
  bucket: TimelineBucket;
}

export interface MemoryTimeline {
  today: BrainMemory[];
  yesterday: BrainMemory[];
  lastWeek: BrainMemory[];
  lastMonth: BrainMemory[];
  older: BrainMemory[];
  total: number;
}

// ─── Memory snapshot (sent to LLM as context) ─────────────────────────────────

export interface BrainContextSnapshot {
  /** Top pinned/important business facts (max 8). */
  businessFacts: BrainMemory[];
  /** Top recent user preferences (max 5). */
  userPreferences: BrainMemory[];
  /** Recent decisions still open (max 5). */
  openDecisions: BrainMemory[];
  /** Active tasks (max 6). */
  activeTasks: BrainMemory[];
  /** Semantically-relevant memories for the current query (max 5). */
  relevantMemories: BrainMemory[];
  /** Learned behavioural patterns (max 4). */
  learnings: BrainMemory[];
}

// ─── Conversation memory (stored after every chat exchange) ───────────────────

export interface ConversationMemoryRecord {
  firmId: string;
  userId?: string;
  conversationId: string;
  userMessage: string;
  oracleResponse: string;
  intent?: string;
  topics: string[];
  actions: string[];
  result?: string;
  summary: string;
  createdAt: Date;
}

// ─── Daily summary ────────────────────────────────────────────────────────────

export interface DailySummary {
  date: string;
  yesterdaySummary: string;
  todayPriorities: string[];
  pendingTasks: BrainTask[];
  upcomingGst: { title: string; dueDate: string; daysLeft: number }[];
  upcomingCollections: { title: string; amount: number; daysOverdue: number }[];
  businessHealthChanges: { metric: string; change: string; direction: 'up' | 'down' | 'flat' }[];
  activeReminders: BrainReminder[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI™ — Human Experience Types
// Shared type definitions for VEYRO AI conversational brain.
// ═══════════════════════════════════════════════════════════════════════════════

import type { StructuredQueryResult } from '@/lib/oracle/structured-query-types';

// ─── Oracle Modes (personas) ─────────────────────────────────────────────────
// Each mode is a specialized persona Oracle can switch between based on the
// user's question. Mode detection lives in oracle-memory.ts; the definitions
// live here so both client and server can read them.

export type OracleModeId =
  | 'gst-expert'
  | 'ai-cfo'
  | 'financial-analyst'
  | 'compliance-assistant'
  | 'business-strategist';

export interface OracleMode {
  id: OracleModeId;
  /** Human-readable name shown in the mode badge. */
  name: string;
  /** Short description of when this persona activates. */
  description: string;
  /** Background tint (CSS color) for the mode badge. */
  tint: string;
  /** Foreground color (CSS color) for the mode badge. */
  color: string;
  /** Keywords that trigger this mode via detectOracleMode(). */
  keywords: string[];
}

export const ORACLE_MODES: Record<OracleModeId, OracleMode> = {
  'gst-expert': {
    id: 'gst-expert',
    name: 'GST Expert',
    description: 'GST returns, ITC, reconciliation, e-invoicing.',
    tint: 'rgba(37,99,235,0.12)',
    color: '#2563EB',
    keywords: [
      'gst', 'gstr', 'itc', 'input tax', '2a', '2b', 'reconcile',
      'return', 'filing', 'e-invoice', 'e-way bill', 'irn',
      'hsn', 'sac', 'reverse charge', 'rcm',
    ],
  },
  'ai-cfo': {
    id: 'ai-cfo',
    name: 'AI CFO',
    description: 'Cash flow, runway, financial strategy.',
    tint: 'rgba(59,130,246,0.12)',
    color: '#3B82F6',
    keywords: [
      'cash flow', 'runway', 'cfo', 'burn', 'burn rate',
      'forecast', 'budget', 'p&l', 'profit', 'revenue',
      'ebitda', 'margin', 'working capital',
    ],
  },
  'financial-analyst': {
    id: 'financial-analyst',
    name: 'Financial Analyst',
    description: 'Ratios, trends, deep financial analysis.',
    tint: 'rgba(168,85,247,0.12)',
    color: '#A855F7',
    keywords: [
      'ratio', 'analysis', 'trend', 'compare', 'benchmark',
      'kpi', 'metric', 'growth', 'decline', 'variance',
      'year over year', 'qoq', 'yoy',
    ],
  },
  'compliance-assistant': {
    id: 'compliance-assistant',
    name: 'Compliance Assistant',
    description: 'Deadlines, notices, ROC, TDS, filings.',
    tint: 'rgba(245,158,11,0.12)',
    color: '#F59E0B',
    keywords: [
      'compliance', 'deadline', 'notice', 'roc', 'tds',
      'mca', 'due date', 'penalty', 'late fee', '26as',
      'traces', 'mgt-7', 'aoc-4',
    ],
  },
  'business-strategist': {
    id: 'business-strategist',
    name: 'Business Strategist',
    description: 'Growth, pricing, market positioning.',
    tint: 'rgba(236,72,153,0.12)',
    color: '#EC4899',
    keywords: [
      'strategy', 'growth', 'pricing', 'market', 'competitor',
      'positioning', 'expansion', 'plan', 'opportunity',
      'customer acquisition', 'go-to-market',
    ],
  },
};

export const ORACLE_MODE_LIST: OracleMode[] = Object.values(ORACLE_MODES);

// ─── Re-export the language & emotion value maps from oracle-human.ts ─────────
// These live in oracle-human.ts (which also contains the detection functions),
// but many components import the maps from oracle-types.ts directly. Re-exporting
// here keeps both import paths working without duplicating the data.
export {
  ORACLE_LANGUAGES,
  ORACLE_EMOTIONS,
  nativeLanguageLabel,
} from './oracle-human';

/** Languages Oracle understands and speaks. */
export type OracleLanguageId =
  | 'english'
  | 'hindi'
  | 'hinglish'
  | 'urdu'
  | 'punjabi'
  | 'gujarati'
  | 'marathi'
  | 'tamil'
  | 'telugu'
  | 'bengali';

export interface OracleLanguage {
  id: OracleLanguageId;
  label: string;
  nativeLabel: string;
  /** BCP-47 hint for any future TTS / locale work. */
  locale: string;
}

/** Micro-expression emotions shown subtly during responses. */
export type OracleEmotionId =
  | 'helpful'
  | 'thinking'
  | 'warning'
  | 'success'
  | 'opportunity'
  | 'risk';

export interface OracleEmotion {
  id: OracleEmotionId;
  glyph: string;
  label: string;
}

/** Dynamic avatar state derived from conversation context. */
export type OracleAvatarState =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'success'
  | 'warning';

/** A single chat message in an Oracle conversation. */
export interface OracleMessage {
  id: string;
  role: 'user' | 'oracle';
  content: string;
  /** Detected language of the message (user msgs) or response (oracle msgs). */
  language?: OracleLanguageId;
  /** Detected emotion for oracle responses. */
  emotion?: OracleEmotionId;
  /** True while VEYRO AI response is still streaming tokens. */
  streaming?: boolean;
  /** ISO timestamp. */
  createdAt: string;
  /** Optional follow-up suggestion chips attached to an oracle message. */
  followUps?: string[];
  /** Optional action chips — one-tap shortcuts that navigate the user to the
   *  right workspace (e.g. "File now" → returns, "Open reconcile" → reconcile). */
  actions?: OracleActionChip[];
  /**
   * Optional structured data card attached to an oracle message. When the
   * user's message matches a structured-query intent (e.g. "show unpaid
   * invoices"), the server emits the structured result as the FIRST SSE
   * event of the stream; the client stores it here and renders it ABOVE the
   * conversational text answer.
   */
  structuredQuery?: StructuredQueryResult;
}

/** A single action chip attached to an Oracle response. */
export interface OracleActionChip {
  label: string;
  intent: OracleActionIntent;
  /** AppView to navigate to, or a free-form target string. */
  view?: string;
}

export type OracleActionIntent =
  | 'file_now'
  | 'open_returns'
  | 'open_reconcile'
  | 'open_invoices'
  | 'open_clients'
  | 'open_reports'
  | 'open_banking'
  | 'open_notices'
  | 'open_compliance'
  | 'open_risk'
  | 'open_insights'
  | 'open_connections'
  | 'open_settings';

/** A concise memory snapshot sent to the API for personalisation. */
export interface OracleUserMemory {
  userName?: string;
  firmName?: string;
  gstin?: string;
  userId?: string;
  preferredLanguage?: OracleLanguageId;
  recentTopics?: string[];
}

/** Payload sent to /api/oracle/chat. */
export interface OracleChatRequest {
  messages: { role: 'user' | 'oracle'; content: string }[];
  memory?: OracleUserMemory;
  context?: {
    dashboardMetrics?: Record<string, number | string | undefined>;
    /** The current organization id — used to fetch the unified Business Snapshot. */
    organizationId?: string;
  };
}

/** A single streamed token chunk emitted by the API (SSE `data:` payload). */
export interface OracleStreamChunk {
  token?: string;
  language?: OracleLanguageId;
  emotion?: OracleEmotionId;
  done?: boolean;
  error?: string;
  /** Optional action chips the server suggests for the final response. */
  actions?: OracleActionChip[];
  /**
   * Server emits this as the FIRST SSE event when the user's message matches
   * a structured-query intent. Carries the full StructuredQueryResult so the
   * client can render a data card above the streaming text answer.
   */
  structured?: StructuredQueryResult;
}

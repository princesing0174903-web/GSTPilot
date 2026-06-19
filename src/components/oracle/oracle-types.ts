// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle™ — Human Experience Types
// Shared type definitions for the Oracle conversational brain.
// ═══════════════════════════════════════════════════════════════════════════════

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
  /** True while the oracle response is still streaming tokens. */
  streaming?: boolean;
  /** ISO timestamp. */
  createdAt: string;
  /** Optional follow-up suggestion chips attached to an oracle message. */
  followUps?: string[];
}

/** A concise memory snapshot sent to the API for personalisation. */
export interface OracleUserMemory {
  userName?: string;
  firmName?: string;
  gstin?: string;
  preferredLanguage?: OracleLanguageId;
  recentTopics?: string[];
}

/** Payload sent to /api/oracle/chat. */
export interface OracleChatRequest {
  messages: { role: 'user' | 'oracle'; content: string }[];
  memory?: OracleUserMemory;
  context?: {
    dashboardMetrics?: Record<string, number | string | undefined>;
  };
}

/** A single streamed token chunk emitted by the API (SSE `data:` payload). */
export interface OracleStreamChunk {
  token?: string;
  language?: OracleLanguageId;
  emotion?: OracleEmotionId;
  done?: boolean;
  error?: string;
}

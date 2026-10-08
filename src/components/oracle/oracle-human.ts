// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI™ — Human Intelligence Module
// Multilingual detection (10 languages), emotion detection (6 micro-expressions),
// and dynamic avatar state derivation. Keeps Oracle feeling alive & human.
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  OracleLanguageId,
  OracleLanguage,
  OracleEmotionId,
  OracleEmotion,
  OracleAvatarState,
} from './oracle-types';

// ─── Languages ────────────────────────────────────────────────────────────────

export const ORACLE_LANGUAGES: Record<OracleLanguageId, OracleLanguage> = {
  english: { id: 'english', label: 'English', nativeLabel: 'English', locale: 'en-IN' },
  hindi: { id: 'hindi', label: 'Hindi', nativeLabel: 'हिन्दी', locale: 'hi-IN' },
  hinglish: { id: 'hinglish', label: 'Hinglish', nativeLabel: 'Hinglish', locale: 'hi-IN' },
  urdu: { id: 'urdu', label: 'Urdu', nativeLabel: 'اُردُو', locale: 'ur-IN' },
  punjabi: { id: 'punjabi', label: 'Punjabi', nativeLabel: 'ਪੰਜਾਬੀ', locale: 'pa-IN' },
  gujarati: { id: 'gujarati', label: 'Gujarati', nativeLabel: 'ગુજરાતી', locale: 'gu-IN' },
  marathi: { id: 'marathi', label: 'Marathi', nativeLabel: 'मराठी', locale: 'mr-IN' },
  tamil: { id: 'tamil', label: 'Tamil', nativeLabel: 'தமிழ்', locale: 'ta-IN' },
  telugu: { id: 'telugu', label: 'Telugu', nativeLabel: 'తెలుగు', locale: 'te-IN' },
  bengali: { id: 'bengali', label: 'Bengali', nativeLabel: 'বাংলা', locale: 'bn-IN' },
};

/**
 * Detect the language of a user message. Strategy:
 *  1. Unicode script ranges tell us the native script (Hindi/Urdu/Punjabi/...).
 *  2. If romanised, detect Hinglish via a curated keyword list.
 *  3. Default to English.
 */
export function detectLanguage(text: string): OracleLanguageId {
  if (!text || !text.trim()) return 'english';
  const sample = text.slice(0, 500);

  // ── Devanagari covers Hindi & Marathi. Marathi has distinct markers, but for
  //    reply-language purposes we treat Devanagari as Hindi (Marathi readers
  //    read Devanagari fluently and the model can adapt tone).
  if (/[\u0900-\u097F]/.test(sample)) return 'hindi';
  // ── Arabic script → Urdu (Nastaliq). Also catches "Urdu in Arabic script".
  if (/[\u0600-\u06FF]/.test(sample)) return 'urdu';
  // ── Gurmukhi → Punjabi
  if (/[\u0A00-\u0A7F]/.test(sample)) return 'punjabi';
  // ── Gujarati
  if (/[\u0A80-\u0AFF]/.test(sample)) return 'gujarati';
  // ── Tamil
  if (/[\u0B80-\u0BFF]/.test(sample)) return 'tamil';
  // ── Telugu
  if (/[\u0C00-\u0C7F]/.test(sample)) return 'telugu';
  // ── Bengali
  if (/[\u0980-\u09FF]/.test(sample)) return 'bengali';

  // ── Romanised Hinglish detection: common conversational tokens mixed with
  //    English. We require at least 2 strong markers to avoid false positives
  //    on plain English GST questions.
  const hinglishMarkers = [
    'kya', 'hota', 'hoti', 'hai', 'hoon', 'raha', 'rahi', 'mera', 'meri',
    'aap', 'aapke', 'tum', 'tumhara', 'kyu', 'kyun', 'kaise', 'kaisa',
    'kaisi', 'kar', 'karo', 'karna', 'kuch', 'bahut', 'thoda', 'abhi',
    'kal', 'aaj', 'phir', 'lekin', 'magar', 'kyunki', 'bhi', 'nahi', 'nahin',
    'haan', 'theek', 'thik', 'acha', 'accha', 'bhai', 'sirf', 'sab', 'ek',
    'do', 'teen', 'paisa', 'paise', 'bahi', 'hisab', 'kitna', 'kitne',
    'jab', 'tab', 'agar', 'toh', 'matlab', 'zamana', 'samay', 'kaam',
  ];
  const lower = ` ${sample.toLowerCase()} `;
  let hits = 0;
  for (const m of hinglishMarkers) {
    if (new RegExp(`[^a-z]${m}[^a-z]`).test(lower)) hits++;
    if (hits >= 2) return 'hinglish';
  }

  return 'english';
}

/** Native label for a language, e.g. हिन्दी. */
export function nativeLanguageLabel(id: OracleLanguageId): string {
  return ORACLE_LANGUAGES[id]?.nativeLabel ?? 'English';
}

// ─── Emotions (subtle micro-expressions) ──────────────────────────────────────

export const ORACLE_EMOTIONS: Record<OracleEmotionId, OracleEmotion> = {
  helpful: { id: 'helpful', glyph: '🙂', label: 'Helpful' },
  thinking: { id: 'thinking', glyph: '🧠', label: 'Thinking' },
  warning: { id: 'warning', glyph: '⚠️', label: 'Warning' },
  success: { id: 'success', glyph: '✅', label: 'Success' },
  opportunity: { id: 'opportunity', glyph: '📈', label: 'Opportunity' },
  risk: { id: 'risk', glyph: '📉', label: 'Risk' },
};

/**
 * Detect the dominant emotion conveyed by Oracle's response so the UI can show
 * a single subtle micro-expression. Conservative — defaults to "helpful".
 */
export function detectEmotion(response: string): OracleEmotionId {
  if (!response) return 'thinking';
  const lower = response.toLowerCase();

  // Risk / warning signals
  if (/(penalt|late fee|overdue|risk|warning|caution|blocked|default|notice|scrutiny)/.test(lower)) {
    return 'warning';
  }
  if (/(cash flow down|decline|drop|loss|shortfall|negative|missed)/.test(lower)) {
    return 'risk';
  }

  // Opportunity signals
  if (/(opportunity|refund|optimi|saving|growth|healthy|strong|improve|eligible.*itc)/.test(lower)) {
    return 'opportunity';
  }

  // Success signals
  if (/(filed|completed|success|reconciled|matched|achieved|all clear|no issues)/.test(lower)) {
    return 'success';
  }

  // Thinking signals (rare in final text — only if explicitly analyzing)
  if (/(analyz|reviewing|let me check|based on.*information)/.test(lower)) {
    return 'thinking';
  }

  return 'helpful';
}

// ─── Avatar State ─────────────────────────────────────────────────────────────

/**
 * Derive the dynamic avatar state from conversation context.
 * Used to drive subtle avatar animations in the header.
 */
export function deriveAvatarState(opts: {
  isStreaming: boolean;
  hasInput: boolean;
  lastEmotion?: OracleEmotionId;
}): OracleAvatarState {
  if (opts.isStreaming) return 'speaking';
  if (opts.lastEmotion === 'warning' || opts.lastEmotion === 'risk') return 'warning';
  if (opts.lastEmotion === 'success' || opts.lastEmotion === 'opportunity') return 'success';
  if (opts.hasInput) return 'listening';
  return 'idle';
}

export const AVATAR_STATE_LABEL: Record<OracleAvatarState, string> = {
  idle: 'Ready',
  listening: 'Listening',
  thinking: 'Thinking',
  speaking: 'Responding',
  success: 'All clear',
  warning: 'Attention',
};

// ─── Suggested conversation starters (multilingual) ───────────────────────────

export interface OracleSuggestion {
  icon: 'sparkles' | 'shield' | 'trending' | 'receipt' | 'calendar' | 'brain';
  prompt: string;
  hint: string;
}

export const ORACLE_SUGGESTIONS: OracleSuggestion[] = [
  {
    icon: 'sparkles',
    prompt: 'GST kya hota hai?',
    hint: 'Multilingual · Hindi',
  },
  {
    icon: 'shield',
    prompt: 'मेरी GSTR-3B लेट हो गई, अब क्या करूं?',
    hint: 'Compliance · Hindi',
  },
  {
    icon: 'trending',
    prompt: 'What are the ITC eligibility rules for manufacturers?',
    hint: 'Advisory · English',
  },
  {
    icon: 'receipt',
    prompt: 'Mera cash flow down kyu hai?',
    hint: 'Finance · Hinglish',
  },
  {
    icon: 'calendar',
    prompt: 'GSTR-1 और GSTR-3B की last date क्या है?',
    hint: 'Deadlines · Hindi',
  },
  {
    icon: 'brain',
    prompt: 'Explain reverse charge mechanism under GST.',
    hint: 'Concept · English',
  },
];

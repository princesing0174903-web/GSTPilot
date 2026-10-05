// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle™ — Embedding Engine (PROMPT 6)
//
// A dependency-free, deterministic text embedding system using feature hashing
// (the "hashing trick") into a fixed-dimensional vector. No external API call
// is required — embeddings are computed locally and instantly, which keeps the
// memory system fast and free even in the sandbox.
//
// Design:
//   • Dimension: 256 (good balance of discrimination vs storage)
//   • Tokenizer: lowercase, split on non-alphanumeric, keep tokens ≥3 chars
//   • Unigrams + bigrams (bigrams capture multi-word concepts like "cash flow")
//   • Hash: FNV-1a (fast, good distribution)
//   • Sign: parity of hash decides +1/-1 (reduces collisions in cosine space)
//   • L2-normalized output (so cosine sim = dot product)
//
// Quality is more than sufficient for semantic search over a moderate corpus
// (hundreds to low-thousands of memory records). For larger corpora a real
// embedding model would be plugged in here without changing the interface.
// ═══════════════════════════════════════════════════════════════════════════════

export const EMBEDDING_DIM = 256;

// ─── Tokenizer ────────────────────────────────────────────────────────────────

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'if', 'then', 'else', 'when', 'at',
  'by', 'for', 'with', 'about', 'against', 'between', 'into', 'through',
  'during', 'before', 'after', 'above', 'below', 'to', 'from', 'up', 'down',
  'in', 'out', 'on', 'off', 'over', 'under', 'again', 'further', 'once',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
  'do', 'does', 'did', 'will', 'would', 'should', 'could', 'may', 'might',
  'must', 'shall', 'can', 'need', 'of', 'this', 'that', 'these', 'those',
  'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us',
  'them', 'my', 'your', 'his', 'its', 'our', 'their', 'as', 'so', 'than',
  'too', 'very', 'just', 'also', 'only', 'no', 'not', 'now', 'here', 'there',
  'what', 'which', 'who', 'whom', 'whose', 'why', 'how', 'all', 'any', 'both',
  'each', 'few', 'more', 'most', 'other', 'some', 'such',
]);

function tokenize(text: string): string[] {
  const lower = text.toLowerCase();
  // Split on non-alphanumeric (keeps numbers, strips punctuation).
  const raw = lower.split(/[^a-z0-9]+/).filter((t) => t.length >= 3);
  // Drop stopwords for unigrams (keep for bigrams where they add context).
  const unigrams = raw.filter((t) => !STOPWORDS.has(t));
  // Build bigrams from the non-stopword stream for tighter semantic pairs.
  const bigrams: string[] = [];
  for (let i = 0; i < unigrams.length - 1; i++) {
    bigrams.push(`${unigrams[i]}_${unigrams[i + 1]}`);
  }
  return [...unigrams, ...bigrams];
}

// ─── FNV-1a hash ──────────────────────────────────────────────────────────────

function fnv1a(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    // FNV prime (32-bit): multiply and keep as unsigned 32-bit.
    hash = Math.imul(hash, 0x01000193);
  }
  // Force unsigned.
  return hash >>> 0;
}

// ─── Embedding ────────────────────────────────────────────────────────────────

/**
 * Compute a 256-dimensional L2-normalized embedding for the given text.
 * Returns a Float32-style number[] (values in roughly [-0.4, 0.4]).
 * Returns null for empty/whitespace-only text.
 */
export function embed(text: string): number[] | null {
  if (!text || !text.trim()) return null;
  const tokens = tokenize(text);
  if (tokens.length === 0) return null;

  const vec = new Float32Array(EMBEDDING_DIM);
  for (const token of tokens) {
    const h = fnv1a(token);
    const bucket = h % EMBEDDING_DIM;
    // Sign: +1 if the second hash byte is even, else -1. Reduces collision bias.
    const sign = ((h >>> 8) & 1) === 0 ? 1 : -1;
    vec[bucket] += sign;
  }

  // L2 normalize so cosine similarity = dot product.
  let norm = 0;
  for (let i = 0; i < EMBEDDING_DIM; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm);
  if (norm === 0) return null;
  const out: number[] = new Array(EMBEDDING_DIM);
  for (let i = 0; i < EMBEDDING_DIM; i++) out[i] = vec[i] / norm;
  return out;
}

// ─── Similarity ───────────────────────────────────────────────────────────────

/**
 * Cosine similarity between two L2-normalized vectors. Equivalent to dot product.
 * Returns 0 if either vector is null/empty. Output range: [-1, 1] but for
 * text embeddings it's typically [0, 1].
 */
export function cosineSimilarity(a: number[] | null | undefined, b: number[] | null | undefined): number {
  if (!a || !b || a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}

// ─── Serialization helpers ────────────────────────────────────────────────────

export function serializeEmbedding(vec: number[] | null | undefined): string | null {
  if (!vec) return null;
  return JSON.stringify(vec);
}

export function deserializeEmbedding(s: string | null | undefined): number[] | null {
  if (!s) return null;
  try {
    const parsed = JSON.parse(s);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return parsed as number[];
  } catch {
    return null;
  }
}

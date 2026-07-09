// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — Scaling Layer Barrel (SERVER-ONLY)
//
// Re-exports everything from:
//   • firestore-scaling.ts   — sharding, batched writes, distributed counters,
//                              SWR cache, ref-counted listener multiplexer
//   • storage-optimization.ts — signed URLs, image-optimization heuristic,
//                              orphan cleanup, per-org usage aggregation
//   • ai-scaling.ts           — context cache, priority queue, token tracker,
//                              bounded-concurrency request submission
//
// NEVER import from a client component — all helpers bypass security rules.
// ═══════════════════════════════════════════════════════════════════════════════

export * from './firestore-scaling';
export * from './storage-optimization';
export * from './ai-scaling';

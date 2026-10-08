// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO™ — Google Workspace Integration (barrel)
// ═══════════════════════════════════════════════════════════════════════════════
// Single import surface for everything Google Workspace. Server-only — these
// modules touch the database + process.env, so they MUST NOT be imported from
// client components. API routes import directly from `./auth`; client hooks
// import NOTHING from here — they only call the API routes.
// ═══════════════════════════════════════════════════════════════════════════════

export * from './crypto';
export * from './auth';

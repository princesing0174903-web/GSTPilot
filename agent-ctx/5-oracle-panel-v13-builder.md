---
Task ID: 5
Agent: Oracle Panel V13 Builder
Task: Rewrite OraclePanel.tsx (right AI panel) to GSTPilot Infinity™ V13 spec — visible "Oracle Live™" card with 4 clean sections: Today's Focus / AI Activity / Recent Events / System Status.

Work Log:
- Read /home/z/my-project/worklog.md to understand prior context (V16 + V17 work logs confirmed: existing OraclePanel was V17 with 5 rotating monitors "Oracle Live™" + Today's Focus + AI Activity).
- Read existing /home/z/my-project/src/components/oracle/OraclePanel.tsx (438 lines, V17 layout).
- Verified available hooks: useLiveDashboardMetrics / useFireActivities / useFireRecentActivities (all in @/hooks/use-firestore).
- Verified AppView type from @/contexts/AppContext (includes 'reconcile', 'returns', 'invoices' used by FocusCards).
- Verified InfinitySymbol export from @/components/layout/InfinityMark.
- Verified V13 design utilities in globals.css: .glass-surface (rgba(255,255,255,0.04) + 28px blur + 0.08 border), .accent-gradient, .accent-gradient-soft, .accent-text, .custom-scrollbar, .hover-lift, rounded-[28px].
- Rewrote OraclePanel.tsx per V13 spec:
  * Header: InfinitySymbol in accent-gradient box (h-8 w-8 rounded-lg, shadow-[#00F5D4]/20) + "GSTPilot Oracle™" + pulsing mint "Live" dot using bg-[#00F5D4] + animate-ping.
  * Panel wrapper: motion.div with .glass-surface + .rounded-[28px] + flex h-full w-full flex-col (fills parent 360px column). Fade-in 0.25s with cubic-bezier(0.4,0,0.2,1).
  * Body: .custom-scrollbar flex-1 space-y-6 overflow-y-auto p-4 with all 4 sections.
  * Section 1 "Today's Focus" (Brain icon): 3 clickable FocusCards derived from useLiveDashboardMetrics — Recover Collections (reconcile), File Returns (returns), Review Expenses (invoices). Hints show real metrics (critical issues count, match %, pending/overdue returns).
  * Section 2 "AI Activity" (Activity icon): real AI activities from useFireActivities() filtered via isAiActivity() helper (document_processed/invoice_extracted/reconciliation_run/etc + types containing 'ai'/'workflow'/'automation'). Each shows icon + label + timeAgo. If empty → CalmEmpty with Cpu icon + pulsing mint dot + "Oracle is monitoring your business".
  * Section 3 "Recent Events" (Zap icon, NEW): useFireRecentActivities(5). Compact EventRows (icon + title + timeAgo), informational not clickable. If empty → CalmEmpty "No recent events yet".
  * Section 4 "System Status" (ShieldCheck icon, NEW): 2x2 grid of StatusTiles, always-healthy mint dots:
      - GST Network — Connected (Wifi)
      - Bank Sync — Active (CreditCard)
      - AI Engine — Online (Cpu, pulsing)
      - Compliance — Watching (Eye)
  * Kept helpers from existing file: timeAgo (Date | string | Firestore Timestamp), isAiActivity + AI_ACTIVITY_TYPES set.
  * Added activityIcon() type→LucideIcon mapper (invoice/document/return/filing→FileText, reconcil/mismatch→ShieldCheck, payment/collection→Wallet, ai/workflow→Cpu, default→Activity).
  * Kept 2.5s graceful loading timeout pattern: useState(timedOut) + useEffect setTimeout 2500ms. isLoading = (metricsLoading || activitiesLoading || recentLoading) && !timedOut. OracleSkeleton shows 4 stacked sections matching the final layout (3 focus card skeletons + activity skeleton + 2 event skeletons + 2x2 status tile skeletons).
  * Removed the V17 rotating MonitorRow + ORACLE_MONITORS + sweeping shimmer (no longer needed — System Status replaces them).
  * Removed unused imports: AnimatePresence, Sparkles, TrendingUp, Database. Final imports: motion, Brain, Wallet, FileText, Receipt, ChevronRight, Activity, ShieldCheck, CreditCard, Zap, Wifi, Cpu, Eye, type LucideIcon.
- Lint: ran `bun run lint` — clean (no errors, no warnings).
- Dev log check: dev server returning 200 for /, no compile errors after the rewrite.

Stage Summary:
- Delivered: /home/z/my-project/src/components/oracle/OraclePanel.tsx rewritten to V13 spec (~370 lines, lint-clean, dev-server-clean).
- Visible card: .glass-surface + rounded-[28px] makes the panel clearly visible against the Obsidian Black canvas (no more invisible square).
- 4 sections in exact V13 order: Today's Focus → AI Activity → Recent Events → System Status.
- Every section has a calm, premium fallback state (CalmEmpty component with pulsing mint dot) — panel never looks broken or empty.
- System Status = 2x2 grid of always-healthy tiles with mint #00F5D4 dots (AI Engine tile pulses to feel alive).
- Component signature preserved exactly: OraclePanelProps { onNavigate: (view: AppView) => void }, named export + default export.
- Design tokens honored: bg #050505 (parent), glass rgba(255,255,255,0.04), borders rgba(255,255,255,0.06-0.08), primary accent #00F5D4 (mint) via direct color + .accent-text gradient, secondary #00B8FF via .accent-text, 28px radius, 250ms max animations with cubic-bezier(0.4,0,0.2,1), .custom-scrollbar on body.
- Section labels: text-[10px] font-medium uppercase tracking-wider text-muted-foreground with a small h-3 w-3 leading icon (Brain/Activity/Zap/ShieldCheck).
- Header live indicator uses exact V13 mint #00F5D4 (was emerald-400 in V17), keeping the brand consistent.

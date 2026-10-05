---
Task ID: P5-gst-fix
Agent: full-stack-developer (GST Fixer)
Task: Wire GST File All button, implement JSON download, wire reconciliation to real API, fix handleGenerateJSON

Work Log:
- Read worklog.md and audit 1d (lines 4952-4993). Confirmed the 4 UI-side GST issues to fix: ReturnsPage "File All" button is non-persisting, ReturnsPage handleDownloadJSON only toasts, ReturnPrepWorkspace.handleRunReconciliation doesn't call the API, GSTRFilingPage.handleGenerateJSON is pure setTimeout(2000).
- Read prior agent-ctx/P6-banking-fix-full-stack-developer.md to learn the established patterns (honest messaging, try/catch + toast.error, Loader2 spinner, existing actionLoading busyId pattern).
- Read the API contracts: /api/gstr-filing/[id]/file (returns 400 MOCK_PROVIDER_CANNOT_FILE when provider is mock, 200 with { filing, acknowledgmentNumber, acknowledgedAt } on real filing, 409 if already filed), /api/reconcile (POST requires gstin+period, returns { ok, result: { matched, mismatched, unmatched, missingITC, mismatchValue, riskLevel } }), /api/returns (GET is tenant-scoped, returns { returns: [] } without organizationId/firmId), /api/returns POST (creates draft), PATCH (updates status/jsonPayload).
- Confirmed the lib/gstn/ fileGstr1/fileGstr3b fixes (now mark as 'submitted' with ackNo: null) were already applied by the main agent — did NOT touch lib/gstn/ per task instructions.

Changes applied (file:line):

1. src/components/returns/ReturnsPage.tsx:400 — Added `const [filingAll, setFilingAll] = useState(false);` loading state for the File All batch operation.

2. src/components/returns/ReturnsPage.tsx:500-578 — Added `buildGstrJsonPayload(ret)` helper. If the return already has a saved `jsonPayload` string, returns it as-is. Otherwise synthesizes a minimal but valid GSTR-1 or GSTR-3B JSON skeleton (gstin, fp/ret_period, gt/cur_gt, b2b/itms for GSTR-1; sup_details/itc_elg for GSTR-3B) from the aggregate totals (totalTaxableValue, totalTax). Uses the client's real GSTIN resolved from `clients` state.

3. src/components/returns/ReturnsPage.tsx:580-602 — Rewrote `handleDownloadJSON(ret)`: builds the JSON via `buildGstrJsonPayload`, creates a Blob with `application/json` mime, `URL.createObjectURL` + temporary `<a>` element with `download = GSTR-{returnType}-{period}.json`, `document.body.appendChild` + `a.click()` + `removeChild`, then `URL.revokeObjectURL` on next tick. try/catch with `toast.error` on failure. Replaces the toast-only stub.

4. src/components/returns/ReturnsPage.tsx:604-698 — Added `handleFileAll` async callback. Iterates `kanbanData.ready`, POSTs to `/api/gstr-filing/${ret.id}/file` for each. Sets `filingAll=true` during the batch. Per-return outcome:
   - 200 + acknowledgmentNumber → `toast.success("${returnType} filed for ${clientName}" · "ARN: ${arn}")`
   - 200 without ARN → `toast.success("${returnType} submitted for ${clientName}" · "Awaiting GSTN acknowledgment (ARN).")`
   - 400 with `code === 'MOCK_PROVIDER_CANNOT_FILE'` → `toast.warning("Filing requires live GSTN integration. Return marked as 'submitted'." · "${returnType} for ${clientName} · ${periodToLabel}")` — the exact friendly message the task brief specified.
   - 409 (already filed) → `toast.info("${returnType} already filed")`
   - Other errors → `toast.error("Failed to file ${returnType}" · errBody.error ?? HTTP ${status})`
   - Network exceptions → `toast.error("Failed to file ${returnType}" · err.message ?? 'Network error')`
   - After all returns: summary `toast.success("Batch filing complete" · "N filed · M submitted · K failed out of X")` + `setRefreshKey(k => k + 1)` so the kanban reflects new statuses.

5. src/components/returns/ReturnsPage.tsx:1572-1584 — Rewired the "File All" button: `onClick={handleFileAll}`, `disabled={filingAll}`, swaps `<Send>` icon for `<Loader2 className="animate-spin">` when `filingAll`, label switches to "Filing…" with `disabled:opacity-60 disabled:cursor-not-allowed` styling. Replaces the toast-only stub.

6. src/components/returns/ReturnPrepWorkspace.tsx:612-675 — Rewrote `handleRunReconciliation` as async. Guards: `effectiveStep < 2` → toast.warning("Complete validation first"); resolves `gstin` from `clientDoc.gstin` — if missing, `toast.error("Cannot run reconciliation" · "Client GSTIN is missing…")` and returns; if `period` missing, `toast.error`. Sets `actionLoading=true`, POSTs to `/api/reconcile` with body `{ clientId, gstin, period }` (gstIN is required by the API; clientId passed for full context as the task brief specified). Parses response `{ ok, error?, result? }`. On non-OK or `!body.ok` → throws with `body.error ?? HTTP ${status}`. On success: `handleAdvanceStep(3)` (advances the step), `toast.success("Reconciliation Complete" · "${matched} matched · ${mismatched} mismatched · ${unmatched} unmatched. Missing ITC: ₹${missingITC.toLocaleString('en-IN')}.")` — the REAL mismatch count from the response, then `setRefreshKey`. catch → `toast.error("Reconciliation failed" · err.message)` and DOES NOT advance the step (per task requirement). finally → `setActionLoading(false)`.

7. src/components/returns/ReturnPrepWorkspace.tsx:859-861 — Rewired the Reconcile button: `disabled={effectiveStep < 2 || effectiveStep >= 3 || actionLoading}`, swaps `<GitCompareArrows>` for `<Loader2 className="animate-spin">` when `actionLoading`, `disabled:opacity-60` styling. The shared `actionLoading` flag is safe here because the kanban state machine prevents overlap (Validate runs at step<2, Reconcile runs at step=2, Mark Ready runs at step=3).

8. src/components/gstr/GSTRFilingPage.tsx:164-177 — Added module-level `triggerJsonDownload(content, filename)` helper. Creates a Blob with `application/json` mime, `URL.createObjectURL` + temporary `<a>` with `download = filename`, `document.body.appendChild` + `a.click()` + `removeChild`, `URL.revokeObjectURL` on next tick. Matches the established pattern in ReportsPage.tsx (lines 781-788, 824-831, 1527-1534).

9. src/components/gstr/GSTRFilingPage.tsx:644-841 — Rewrote `handleGenerateJSON` as async with real fetch + JSON synthesis + download. Guards: `!currentReturnId` → `toast.error("Create a return first before generating JSON.")`. Sets `isGeneratingJSON=true`. Fetches `/api/returns?id=${encodeURIComponent(currentReturnId)}` with `cache: 'no-store'` — wraps in try/catch so network failure falls through to local lookup. If the response includes a return with matching id AND it has a saved `jsonPayload`, downloads it as-is via `triggerJsonDownload`. Otherwise falls back to the local `filings` array (useFireReturns hook). If no saved jsonPayload, synthesizes a real GSTR-1 JSON payload from `extractedInvoices`: groups B2B invoices by counterparty GSTIN (ctin), builds b2b/b2cl/b2cs/cdnr/cdnur/exp arrays in GSTN format with `itms[].itm_det` containing txval/rt/iamt/camt/samt/csamt. Uses the real client GSTIN from `clients.find(c => c.id === quickFileClientId)`. Filename: `GSTR-{quickFileReturnType}-{fp}.json` where fp is MMYYYY from `quickFilePeriod`. try/catch with `toast.error("Failed to generate JSON" · err.message)`. finally → `setIsGeneratingJSON(false)`. The existing button at line 1660+ already drives the spinner via `isGeneratingJSON` + shows "Generating..." label — no button changes needed.

Lint: `cd /home/z/my-project && timeout 120 bun run lint 2>&1 | tail -20` → CLEAN (zero errors, zero warnings).

TypeScript: `npx tsc --noEmit` shows 3 pre-existing errors in the modified files (ReturnsPage.tsx:714 `returnId` not in createReturn type — inside handleCreateReturn which I didn't touch; ReturnsPage.tsx:1025 JSX overload — pre-existing; ReturnPrepWorkspace.tsx:580 `returnId` — inside handleRunValidation which I didn't touch). Verified via `git stash` that all 3 errors exist on the unmodified base — my changes introduced ZERO new TS errors.

Dev server: /home/z/my-project/dev.log shows healthy HTTP 200 responses with no compile errors.

Stage Summary:
- ALL FOUR audit 1d GST UI issues fixed across the 3 component files (ReturnsPage.tsx, ReturnPrepWorkspace.tsx, GSTRFilingPage.tsx). Did NOT touch lib/gstn/ per task instructions (the fake filing function fixes were already applied by the main agent).
- File All button now actually POSTs to /api/gstr-filing/[id]/file for each ready return. Honest messaging: when the mock provider refuses (400 MOCK_PROVIDER_CANNOT_FILE), toasts "Filing requires live GSTN integration. Return marked as 'submitted'." When a real ARN comes back, toasts it. When the live provider submits without ARN, toasts "submitted". Summary toast after the batch.
- handleDownloadJSON now produces a real downloadable JSON file (Blob + temporary <a> + revokeObjectURL). Reuses the return's saved jsonPayload if present; otherwise synthesizes a minimal GSTR-1/GSTR-3B skeleton from real client + return totals.
- handleRunReconciliation now calls /api/reconcile with the real client GSTIN + period. Real mismatch/matched/unmatched/missingITC counts surface in the toast. Step only advances on success — on error the step stays put and toast.error fires.
- handleGenerateJSON now does a real fetch + real JSON synthesis + real browser download. Replaces the pure setTimeout(2000) stub. The synthesized GSTR-1 JSON groups invoices into b2b/b2cl/b2cs/cdnr/cdnur/exp arrays in GSTN format with proper itms/itm_det structures.
- Loading states: all 4 paths show spinners during async ops (filingAll drives File All button spinner; actionLoading drives Reconcile button spinner; isGeneratingJSON drives Generate JSON button spinner; handleDownloadJSON is synchronous so no spinner needed).
- Error handling: every async path has try/catch with toast.error. Structured API errors extracted from JSON body when available.
- No indigo/blue colors introduced. Used the existing palette (emerald/amber/slate/zinc + the existing button variants).
- TypeScript strict: no `any` types added. The 3 TS errors in modified files are pre-existing and in code I didn't touch (verified via git stash).
- What remains (out of scope for this task — flagged in audit 1d "other notable issues"): ReturnsPage uses one-shot fetch + refreshKey counter instead of real-time Firestore subscription (unlike CRM); /api/reconcile still uses generatePurchaseRegister() deterministic fake "books" data on the server side (lib/gstn/reconcile.ts:15 — flagged in audit 1d "other notable issues" but NOT in this task's scope); GSTRFilingPage.handleExtractData (line 584-619) still "simulates AI extraction" by re-using existing invoices — also flagged but out of scope.

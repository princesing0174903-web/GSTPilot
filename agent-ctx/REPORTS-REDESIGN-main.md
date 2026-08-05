# Task ID: REPORTS-REDESIGN
**Agent**: main (Reports Export Center Redesign)
**Task**: Completely redesign the Reports page from a developer-looking UI into a professional Export Center with premium report cards.

## Prior Context
- Read `/home/z/my-project/worklog.md` (last task was ORACLE-REDESIGN — Oracle redesigned into a premium AI CFO experience using the same `.gst-*` design system).
- The GSTPilot design system in `globals.css` provides: `.gst-page-title` (32px), `.gst-section-title` (20px), `.gst-card-title` (16px), `.gst-description`, `.gst-metric`, `.gst-body`, `.gst-btn` + variants, `.gst-card` (rounded-xl, border `#1F1F1F`, bg `#0A0A0A`), `.gst-card-hover`, `.gst-card-compact`, `.gst-container-wide` (max-w 1600px), `.gst-status` + variants, `.gst-animate-in`, `.gst-empty-state`. Blue `#2563EB` is the only accent.
- Dev server healthy (HTTP 200, port 3000).

## File Touched
- `src/components/reports/ReportsPage.tsx` only (no API routes, no other components).

## What Was Redesigned

### 1. Imports (lines 14-41)
Added: `Input` from `@/components/ui/input`, `cn` from `@/lib/utils`, and 12 new lucide-react icons (`Calendar`, `Receipt`, `History`, `Filter`, `ChevronDown`, `CheckCircle2`, `AlertCircle`, `Sparkles`, `ClipboardCheck`, `FileCheck2`, `type LucideIcon`). Removed: `BarChart3`, `Printer` (no longer used in the new render).

### 2. New: REPORT_CATALOG (lines 180-433)
A single source-of-truth catalog that drives every report card on the page. Each entry maps to an existing handler (or `null` = "Not Configured") so the UI reflects reality without ever touching the export API contract.

**5 categories, 16 report cards:**
1. **GST Filing Package** (4): GSTR-1 JSON Export (Ready → `handleGenerateJSON`), GSTR-3B JSON Export (Not Configured), GSTR-2B Reconciliation (Not Configured), Annual GSTR-9 Summary (Not Configured).
2. **Excel Export** (4): Sales Register (Ready → `handleGenerateExcel`), Purchase Register, Expense Summary, Tax Liability Summary (3 Not Configured).
3. **PDF Summary** (4): Monthly Business Summary (Ready → `handlePrintFinancial`), Tax Compliance Report (Ready → `handlePrintCompliance`), Audit Trail Report (Ready → `handlePrintGSTSummary`), Cash Flow Report (Ready → `handlePrintCashFlow`).
4. **Working Papers** (2): Working Papers Bundle (Ready → `handleGenerateWorkingPapers`), Reconciliation Working Papers (Not Configured).
5. **Audit Package** (2): Audit Package Bundle (Ready → `handleGeneratePDF`), CA Review Package (Not Configured).

All 8 existing handlers preserved and wired to Ready cards. 8 "Not Configured" cards show the spec'd reports that don't have handlers yet — they render with a "Coming Soon" button and "Not Configured" status pill.

Each card has: `id`, `title`, `description`, `icon` (LucideIcon), `exportType` (matches `EXPORT_TYPE_CONFIG` for last-generated lookup), `handler` (key or null), `fileType` (json/csv/pdf), `estimatedSize` (e.g. "~18 KB"), `accent` (blue/emerald/amber/purple/teal/rose/slate).

### 3. New: ReportCard component (lines 494-596)
Premium export-center card with:
- **Top row**: accent-tinted icon box + title + 2-line description (truncated).
- **Status pill**: `.gst-status-success` (Ready) / `.gst-status-warning` (Generating…) / `.gst-status-neutral` (Not Configured).
- **Spacer** (`flex-1`) pushes metadata + actions to the bottom for consistent card heights across the grid.
- **Metadata row** (grid-cols-2): "Last Generated" (relative time) + "Est. Size".
- **Action buttons**: primary "Generate" (with `Sparkles` icon, becomes `RefreshCw` spinner during generation) + secondary "Download" outline button (only shown when a JSON export with `data` exists in recentExports).

### 4. New: formatRelativeTime helper (lines 462-481)
Returns "Just now", "5 min ago", "3 hours ago", "2 days ago", etc. Returns "Never" for null/undefined/invalid input. Used by both ReportCard and the History tables.

### 5. New: ACCENT_BG / ACCENT_TEXT maps (lines 441-459)
Color lookup tables for each accent (blue/emerald/amber/purple/teal/rose/slate). Each accent uses a 10%-opacity bg + 25%-opacity border + a soft text color (e.g. `#60A5FA` for blue). Blue is the brand accent; the others are tasteful category differentiators that don't violate the "no indigo/blue unless specified" rule (the task explicitly says "blue accent" for this page).

### 6. New: Export Center state + derived memos (lines 779-784, 1126-1193)
- `historyTab` state (replaces old `activeTab` — now controls the Saved/Local sub-tabs in the History section).
- `searchQuery` state — drives the search input.
- `statusFilter` state ('all' | 'ready' | 'not_configured').
- `configOpen` state — collapses/expands the Export Configuration card.
- `findReportLastGenerated(exportType)` — searches both `recentExports` (localStorage) and `savedReports` (Firestore) for the most recent matching export timestamp.
- `hasDownloadForReport(exportType, fileType)` — returns true only for JSON exports with a persisted `data` payload (PDFs open in a print window, so no re-download).
- `lastGeneratedAny` — the most recent generation event across ALL reports, drives the header "Last Activity" KPI.
- `filteredCatalog` — applies search query + status filter to each category, dropping empty categories so the page never shows an empty section header.
- `totalFilteredReports` — count of reports after filtering (drives the empty-state).

### 7. New: Loading skeleton (lines 2039-2068)
Replaced the basic 4-skeleton layout with a premium version that mirrors the new Export Center structure: header skeleton + 4 KPI skeletons + filter bar skeleton + config card skeleton + 6 report-card skeletons (3-col grid).

### 8. New: Handler lookups (lines 2070-2099)
- `handlerFor(key)` — maps a catalog entry's `ReportHandlerKey` to its actual function (`'json'` → `handleGenerateJSON`, `'csv'` → `handleGenerateExcel`, etc.). Returns a no-op for `null` keys (Not Configured cards).
- `downloadFor(exportType)` — returns a closure that re-downloads the most recent matching JSON export from `recentExports`.

### 9. New: Render — Export Center (lines 2102-2786)
Complete rewrite of the JSX. Structure:
1. **Header** (`.gst-container-wide` wrapper): 12px blue-tinted icon box + `.gst-page-title` "Reports & Export Center" + `.gst-description` subtitle. Conditional "Last Activity" card (top-right, hidden on mobile) showing the most recent generation as relative time.
2. **Summary KPIs** (grid-cols-2 sm:grid-cols-4): Total Reports (16), Ready (8), Saved Reports (Firestore count), Local History (localStorage count). Each is a `.gst-card.gst-card-compact` with a 9px icon box + label + `tabular-nums` number.
3. **Filter Bar** (`.gst-card.gst-card-compact`): `Input` with search icon + clear button (✕) + 3 status filter buttons (All / Ready / Not Configured) that toggle `.gst-btn-primary` vs `.gst-btn-ghost`.
4. **Export Configuration** (collapsible `.gst-card`): Filter icon + section title + Expand/Collapse button (chevron rotates 180°). When open: 4-col grid of Selects (Client/Month/Year/Return Type) + Separator + 6-col grid of section checkboxes (B2B/B2CL/B2CS/CDNR/CDNUR/EXP) + Separator + 3-col preview row (Total Invoices / Taxable Value / Total Tax).
5. **Reports Catalog**: Either an empty-state card (when `totalFilteredReports === 0`, with "Clear Filters" CTA) OR a mapped list of category sections. Each section: 9px icon box + `.gst-section-title` + description + count badge. Below: 3-col responsive grid (`sm:grid-cols-2 lg:grid-cols-3`) of `ReportCard` components, each wrapped in a `div.gst-animate-in` with `style={{ animationDelay: '${(catIdx * 4 + idx) * 50}ms' }}` for staggered entrance.
6. **History & Saved Reports** section: 9px icon + section title + Tabs (Saved Reports | Local History) with count badges. Each TabsContent renders a `.gst-card` with:
   - **Saved Reports**: loading skeleton / error state / `.gst-empty-state` / scrollable table (`max-h-96 overflow-y-auto`) with Report Type / Client / Period / Generated (relative time) / Size / Actions (Download + Delete).
   - **Local History**: same structure + "Clear All" button in the header.
7. **Preview Dialog** (preserved): max-w-2xl dialog with JSON pretty-print or "Preview not available" message.

### Preserved (unchanged)
- All 8 report generation handlers: `handleGenerateJSON`, `handleGenerateExcel`, `handleGeneratePDF`, `handleGenerateWorkingPapers`, `handlePrintGSTSummary`, `handlePrintCompliance`, `handlePrintFinancial`, `handlePrintCashFlow`.
- All state: `invoices`, `filings`, `clients`, `loading`, `selectedClientId/Month/Year/returnType`, `includeSections`, `recentExports`, `generating`, `previewOpen`, `previewData`.
- All derived data: `filteredInvoices`, `sectionPreviews`, `totalTaxableValue`, `totalTax`, `totalInvoices`, `matchedFiling`, `gstFilingSummary`, `complianceSummary`, `financialSummary`, `cashFlowSummary`.
- All data sources: `useInvoices`, `useFireReturns`, `useFireReconciliations`, `useLiveDashboardMetrics`, `useGSTTransactions`, `useBanking`, `useFireReports`.
- All localStorage + Firestore persistence: `loadHistory`, `saveHistory`, `persistReportToFirestore`, `addRecentExport`, `handleDeleteExport`, `handleDeleteSavedReport`, `handleDownloadSavedReport`, `handleViewExport`, `handleDownloadExport`, `handleClearHistory`.
- All PDF export helpers: `buildPdfHtml`, `openPrintWindow`, `escapeHtml`.
- All constants: `EXPORT_TYPE_CONFIG`, `EXPORT_TYPE_TO_REPORT_TYPE`, `MONTHS`, `SECTION_KEYS`, `HISTORY_KEY`, `HISTORY_LIMIT`.
- All `/api/export` and `/api/invoices` and `/api/gstr-filing` fetch calls (unchanged).

## Lint Confirmation
`npx eslint src/components/reports/ReportsPage.tsx` → **EXIT 0** (0 errors, 0 warnings). Clean on first pass — no fixes needed.

## Dev Server
- HTTP 200 on `/` confirmed.
- No errors in `dev.log`.
- Page compiles in ~3ms (cached) after initial 11s cold compile.

## Issues
None. All 8 existing handlers preserved and wired to Ready cards. All 8 "Not Configured" cards render with a disabled "Coming Soon" button. No API endpoints touched. No other files modified.

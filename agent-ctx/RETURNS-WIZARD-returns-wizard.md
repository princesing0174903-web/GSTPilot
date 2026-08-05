# RETURNS-WIZARD — Returns Wizard Redesign

**Agent:** main
**Task ID:** RETURNS-WIZARD
**File:** `src/components/returns/ReturnsPage.tsx` (~2778 lines, already a partial wizard)

## Pre-Flight Audit

### What's already in the file
- 8 wizard steps defined (`WIZARD_STEPS` config) ✅
- Horizontal `StepIndicator` with check/current/upcoming circles + connector lines ✅
- Per-step content components (Step1..Step8) ✅
- Sticky bottom footer with Back + Next/File Return ✅
- `AnimatePresence` for step transitions ✅
- Honest filing: `MOCK_PROVIDER_CANNOT_FILE` → demo dialog with "Direct filing requires a configured GSTN API provider" copy ✅
- All API calls preserved (GET /api/returns, POST /api/returns, POST /api/gstr-filing/[id]/file, PATCH /api/gstr-filing/[id], GET /api/invoices) ✅
- Lint passes clean (`npx eslint` exit=0) ✅

### Issues to Fix (Polish Pass)

1. **Duplicate "Next" text bug** — Bottom nav renders `Next <ChevronRight>` *and then* a trailing `'Next'` literal → user sees "Next Next" on intermediate steps. Fix: collapse into one branch.

2. **Fixed-position footer overlays content** — `position: fixed; bottom: 0` floats over the scroll area on tall pages. Convert to sticky inside the page flow with proper bottom safe-area.

3. **Step indicator labels cramped at `max-w-[80px]`** — with 8 steps and a long label like "Calculate", text wraps mid-word. Widen labels and let the indicator wrap to two rows on smaller laptops.

4. **No progress percentage anywhere** — show "Step X of 8 · 38% complete" in the footer.

5. **Status badges in returns list use raw color classes** — switch to `.gst-status` system (`.gst-status-success`, `.gst-status-warning`, `.gst-status-danger`, `.gst-status-info`, `.gst-status-neutral`).

6. **Step content uses ad-hoc card divs** — switch to `.gst-card` + `.gst-card-hover` for hover affordance on selectable rows.

7. **`.gst-animate-in` staggered animation unused** — apply to client cards, return-type buttons, slab rows, KPI cards for a premium entrance.

8. **`KpiCard` icon `size-4.5` is invalid Tailwind** — replace with `size-4` or `size-5`.

9. **JSON preview is small** — give it a min-height, line numbers look, better syntax color.

10. **Step 7 download button** buried — promote to a primary outline button next to the Generate button.

11. **"Validation hint"** rendered below the wizard card — move inside the wizard card so the user sees it adjacent to the Next button.

12. **No "Cancel / Start Over" affordance** in the bottom nav — only Reset in the header.

13. **The "View All Returns" toggle hides the wizard focus** — keep the wizard always primary, returns list as a collapsible section below.

14. **The Returns list table** uses a custom 8-col grid that breaks on narrow viewports — use `.gst-table` instead.

## Plan
- Keep ALL existing API calls, state, handlers, types, mappers, JSON payload builder — these are battle-tested.
- Refactor `StepIndicator`, `StepHeader`, all 8 step content components, bottom nav, and DetailSheet to use design system classes consistently.
- Add `.gst-animate-in` for staggered card entrances.
- Use `.gst-status` pills instead of `PremiumStatusBadge`'s raw color classes.
- Fix the duplicate Next bug + convert fixed footer to sticky footer.
- Add a `ProgressMeter` mini-component (step X of 8 + percent bar).
- Add a "Start Over" affordance in the bottom nav alongside Back.

## Verification
- Run `npx eslint src/components/returns/ReturnsPage.tsx` → must exit 0.
- No API endpoint changes.
- Honest filing behavior preserved verbatim.

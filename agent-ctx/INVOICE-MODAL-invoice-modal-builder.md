# INVOICE-MODAL — InvoiceBuilder Zoho-style Rewrite

**Task ID:** INVOICE-MODAL
**Agent:** invoice-modal-builder
**File:** `src/components/invoices/InvoiceBuilder.tsx` (1888 → 2117 lines)
**Lint:** `npx eslint src/components/invoices/InvoiceBuilder.tsx` → **exit 0** (clean)

## Mission

Improve the Invoice creation modal to feel like **Zoho Books invoice creation** — better spacing, typography, inputs, GST Summary, Tax Breakdown, Buttons, and Live Preview. Keep ALL existing functionality (invoice creation, line items, GST calculation, save, etc.).

## What changed

### 1. Two-pane layout (Zoho-style)
- Dialog widened from `max-w-5xl` to **`max-w-7xl`** (1280px) + `h-[92vh]` fixed-height.
- Body split into **two columns on `lg+`**:
  - **Left (60%)** — scrollable form column (`overflow-y-auto`, `px-6 lg:px-8 py-8`, `space-y-6`).
  - **Right (40%)** — sticky live preview column (`overflow-y-auto`, `border-l border-[#1F1F1F]`, `bg-black`).
- **Mobile** (`<lg`): single column with a **Form/Preview tab switcher** in the header (`mobileTab` state, `'form' | 'preview'`). Tabs are blue when active.
- Both panes enter with Framer Motion (form: fade+y, preview: fade+x).

### 2. Sticky header
- `sticky top-0 z-30` header with `bg-black/95 backdrop-blur-xl`.
- Left: icon tile + `gst-card-title` title + invoice number + live total (`Total ₹X (incl. GST ₹Y)`).
- Center: GST-type status pill (`gst-status-success` for intra-state, `gst-status-warning` for inter-state) + (optional) "Editing · INV-…" pill.
- Right: **action buttons** (moved from footer to header per task spec):
  - `Cancel` — `gst-btn gst-btn-ghost` (X icon)
  - `Save as Draft` — `gst-btn gst-btn-secondary` (Save icon)
  - `Save & Send` — `gst-btn gst-btn-primary` (Send icon)
- Loading state via `gst-btn-loading` class (spinner replaces content).

### 3. Live A4 Preview (NEW)
- Imported `InvoiceA4Preview` from `./InvoiceA4Preview`.
- Built `livePreviewInvoice` (useMemo) — synthesizes a full `ApiInvoice`-shaped object from form state:
  - Top-level totals: `taxableValue`, `cgst`, `sgst`, `igst`, `cess`, `totalAmount`, `gstAmount`, `paidAmount`, `balanceAmount`, etc.
  - `items[]` array with per-line `cgstRate`/`sgstRate`/`igstRate` split based on `interState` flag.
  - `notes` (parsed as T&C list by InvoiceA4Preview), `notesFinance`, `reverseCharge`, `paymentMode`, `paymentLink`, etc.
- Built `livePreviewOrg` (useMemo) — derives `{ name, gstin, address }` from the `organization` prop, mapping `stateCode` → state name via `STATE_CODE_TO_NAME`.
- Wrapped `InvoiceA4Preview` in `max-w-[640px] [&>div>div:first-child]:hidden` to hide its built-in action toolbar (we render our own "Live Preview" sticky subheader above it with an eye icon + "Updates in real-time as you type" caption + "A4 · 1:1" status pill).
- Real-time: every keystroke in the form re-derives `livePreviewInvoice` → preview re-renders.

### 4. Typography & spacing (design system)
- Every section now uses `.gst-card` (pure black `#0A0A0A` bg, `#1F1F1F` border, `p-6`, `rounded-xl`) + `.gst-animate-in` (staggered fade-up).
- Section headers use `.gst-section-title` (was `text-sm font-semibold`).
- Section descriptions use `.gst-description` (was `text-[11px] text-zinc-400`).
- Field labels use `.gst-label` via `FieldLabel` (was `text-[11px] uppercase tracking-wider`).
- Captions / small hints use `.gst-caption`.
- Body rows use `.gst-body`.
- Section gap increased from `space-y-5` to `space-y-6`.
- SectionCard header gap increased from `mb-4` to `mb-5`; icon tile from `h-7 w-7` to `h-9 w-9`; icon-text gap from `gap-2.5` to `gap-3`.
- Form grid gap from `gap-3` to `gap-4`.

### 5. Inputs (taller + blue focus)
- All inputs now use **`h-10`** (was `h-9`).
- Premium input class constant:
  ```
  PREMIUM_INPUT_CLASSNAMES = h-10 rounded-lg border-[#1F1F1F] bg-[#0A0A0A]
                             text-foreground placeholder:text-muted-foreground/50
                             focus:border-[#2563EB] focus:ring-[#2563EB]/40
  ```
- `MoneyInput` and `NumberInput` forwardRef components: bumped to `h-10`, blue focus (`focus:border-[#2563EB] focus:ring-[#2563EB]/40`), `gst-input` text class, `px-3` padding.
- `ClientCombobox` trigger: `h-11`, `rounded-lg`, `bg-[#0A0A0A]`, blue focus on hover/active.
- `Select` triggers: `h-10 rounded-lg border-[#1F1F1F] bg-[#0A0A0A]` with `focus:border-[#2563EB] focus:ring-[#2563EB]/40`.
- `Select` content: `bg-[#0A0A0A]/95 backdrop-blur-xl border-[#1F1F1F]`, items focus to `bg-[#2563EB]/10 text-[#60A5FA]`.
- `Textarea`: same border/bg + blue focus ring.
- Date inputs (`type="date"`) styled with the same premium class.

### 6. GST Summary card (cleaner rows + gst-metric total)
- Rows now: `Subtotal (Taxable)` → `CGST`/`SGST` (or `IGST` inter-state) → `CESS` (if applicable) → `Round Off`.
- Each row: label left (`gst-body`), amount right (`tabular-nums font-medium`).
- **Total Amount** row: separated by `border-t border-[#1F1F1F] pt-4`, label uses `.gst-label` in `#60A5FA` (blue accent), amount uses **`.gst-metric`** (28px bold tabular-nums) in `#60A5FA`. Subtitle "incl. GST ₹X" uses `.gst-caption`.

### 7. Tax Breakdown (per-line + aggregate)
- Per-line tax columns in the line items `.gst-table`: `Taxable`, `CGST`, `SGST` (or `IGST`), `CESS` (if shown), `Total`. Each cell uses `text-[13px] tabular-nums`.
- Aggregate `tfoot` row spans all input columns and shows `formatCurrency(totals.subtotal)`, `formatCurrency(totals.cgst/sgst/igst/cess)`, and `formatCurrency(grand total)` in `#60A5FA` bold.
- Slab Breakdown card (right of GST Summary on `lg+`): colored horizontal bars per GST slab (0% zinc, 5% sky, 12% violet, 18% blue, 28% amber). Slab 18% recolored to `#2563EB` (brand blue) from emerald.

### 8. Line items table (`.gst-table`)
- Replaced ad-hoc `<table>` with `.gst-table` inside `.gst-table-wrap` (rounded-xl border, sticky thead, hover rows).
- Headers: `bg-[#0A0A0A]`, `text-[13px] font-semibold text-muted-foreground`, `border-b border-[#1F1F1F]`, `backdrop-blur-sm`.
- Body cells: `px-4 py-3 text-sm border-b border-[#161616]`.
- Hover rows: `bg-[#0F0F0F]`.
- Inline inputs in rows: `h-10 border-transparent bg-transparent focus:border-[#2563EB] focus:bg-[#0F0F0F] focus:ring-[#2563EB]/30` — they blend into the row but light up blue on focus.
- RowIconButton bumped from `h-7 w-7` to `h-8 w-8` for touch targets.

### 9. Buttons (`.gst-btn` system)
- All shadcn `<Button>` components replaced with native `<button>` elements using the `.gst-btn` classes:
  - `Cancel` → `gst-btn gst-btn-ghost`
  - `Save as Draft` → `gst-btn gst-btn-secondary`
  - `Save & Send` → `gst-btn gst-btn-primary`
  - `Add Row` → `gst-btn gst-btn-ghost gst-btn-sm`
  - `New client` → `gst-btn gst-btn-ghost gst-btn-sm`
- Loading state: `gst-btn-loading` class adds spinner.
- Removed unused `Button` import.
- Removed the `DialogFooter` (action buttons moved to header; status info moved inline at the bottom of the form column).

### 10. Color theme alignment
- Switched all surface colors to design-system tokens:
  - Dialog bg: `bg-black` (was `bg-zinc-950/95`)
  - Cards: `.gst-card` → `bg-[#0A0A0A] border-[#1F1F1F]`
  - Borders: `border-[#1F1F1F]` (was `border-white/[0.06]` or `border-white/[0.08]`)
  - Accent: `#2563EB` blue (was emerald-500) for focus rings, primary buttons, total amount, slab 18%, icon tiles.
  - Status pills: `.gst-status` system (was ad-hoc Badge variants).
  - Muted text: `text-muted-foreground` (was `text-zinc-400/500`).
  - Foreground: `text-foreground` (was `text-zinc-100/200`).

## Layout Architecture (final)

```
DialogContent (max-w-7xl, h-92vh, bg-black, p-0, flex flex-col)
├── DialogHeader (sticky top-0 z-30, bg-black/95 backdrop-blur, border-b)
│   ├── Row: [Icon+Title+Subtitle] [Status pills] [Cancel][Draft][Save&Send]
│   └── Mobile tab switcher (lg:hidden): Form | Preview
└── Body (flex-1, flex-col lg:flex-row, overflow-hidden)
    ├── Form column (lg:w-60%, flex-1, overflow-y-auto, p-6 lg:p-8, space-y-6)
    │   ├── Customer Details (.gst-card)
    │   ├── Invoice Details (.gst-card)
    │   ├── Line Items (.gst-card → .gst-table-wrap → .gst-table)
    │   ├── Grid: GST Summary (.gst-card w/ gst-metric) + Slab Breakdown (.gst-card)
    │   ├── Notes & Terms (.gst-card)
    │   ├── Payment (.gst-card)
    │   └── Status info row (line count + GST type)
    └── Preview aside (lg:w-40%, flex-1, overflow-y-auto, border-l, bg-black)
        ├── Sticky "Live Preview" header (eye icon + caption + A4 status)
        └── InvoiceA4Preview (max-w-640px, toolbar hidden via [&>div>div:first-child])
```

Mobile: tabs toggle between form (full width) and preview (full width).

## Issues encountered & resolved

1. **Duplicate sticky toolbars** — `InvoiceA4Preview` has its own `sticky top-0 z-30` action toolbar that would stack on top of our custom "Live Preview" header. Resolved by wrapping the preview in `[&>div>div:first-child]:hidden` to hide the built-in toolbar (we don't pass any action callbacks anyway).
2. **Two-column height collapse** — Initially the form column didn't scroll independently because the parent `flex-row` container had no `overflow-hidden`. Fixed by adding `overflow-hidden` to the body wrapper and `overflow-y-auto` to each pane.
3. **Mobile layout** — Two-column doesn't work on narrow screens. Added `mobileTab` state + a `Form | Preview` tab switcher visible only on `lg:hidden`. Each pane toggles `hidden lg:block` based on the active tab.
4. **Unused `Button` import** — After replacing all `<Button>` with native `<button>` + `.gst-btn` classes, removed the unused import.
5. **Footer duplication** — Moved action buttons from `DialogFooter` to `DialogHeader` (per the task spec layout). Removed the footer entirely; moved the status info ("3 line items · CGST+SGST") inline at the bottom of the form column.
6. **TypeScript strict typing** — `livePreviewInvoice` is typed as `ApiInvoice & { items: [...]; hsnCode; reverseCharge; notesFinance; paymentLink; paymentMode; paymentDate }` to satisfy `InvoiceA4Preview`'s prop type.

## Lint confirmation

```
$ npx eslint src/components/invoices/InvoiceBuilder.tsx
$ echo "exit=$?"
exit=0
```

Clean — 0 errors, 0 warnings.

## Constraints honored

- ✅ Did NOT change any API endpoints or invoice creation logic (`buildPayload`, `handleSubmit`, `onSubmit` signature all preserved).
- ✅ Kept all existing functionality: line items add/remove/duplicate/reorder, GST calc, CESS toggle, reverse charge, payment terms → due date sync, client combobox, edit-mode hydration, save as draft / save & send.
- ✅ Used existing shadcn/ui components (Dialog, Input, Textarea, Label, Checkbox, Switch, Badge, Select, Popover, Command).
- ✅ Used `lucide-react` icons throughout (added `Eye`, `Pencil`, `Save`, `Send`).
- ✅ Pure black bg / `#0A0A0A` cards / `#1F1F1F` borders / `#2563EB` blue accent.
- ✅ Responsive: 1 col w/ tabs on mobile → 2 cols (60/40) on `lg+`.
- ✅ Used `.gst-section-title`, `.gst-label`, `.gst-input`, `.gst-metric`, `.gst-card`, `.gst-table`, `.gst-btn`, `.gst-status`, `.gst-description`, `.gst-caption`, `.gst-body`, `.gst-card-title`, `.gst-animate-in`.
- ✅ Compiles cleanly (eslint exit 0).

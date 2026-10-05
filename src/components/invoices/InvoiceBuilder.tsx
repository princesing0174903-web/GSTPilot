'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — InvoiceBuilder  (REBUILT — enterprise-grade)
//
// A premium "Create Invoice" / "Edit Invoice" dialog rebuilt from scratch
// (Task INVOICE-REBUILD). The original 2,117-line single-file component has
// been split into a clean architecture of focused, reusable sub-components.
//
// Layout (per spec):
//   ┌─ Sticky Header ──────────────────────────────────────────────────────┐
//   │  Create Invoice       [Cancel] [Save Draft] [Save & Send]            │
//   ├──────────────────────────────────────────────────────────────────────┤
//   │  Customer Information (left)        |  Invoice Details (right)        │  ← 2-col
//   ├──────────────────────────────────────────────────────────────────────┤
//   │  Line Items (Full Width — sticky-header table, NO horizontal scroll)  │
//   ├──────────────────────────────────────────────────────────────────────┤
//   │  GST Summary  |  Totals  |  Notes & Terms                            │  ← 3-col
//   ├──────────────────────────────────────────────────────────────────────┤
//   │  Live Preview (collapsible)                                          │
//   └──────────────────────────────────────────────────────────────────────┘
//
// Hard rules honored:
//   • Modal width: 92vw with max-w-7xl cap.
//   • Desktop NEVER scrolls horizontally — table-fixed + colgroup.
//   • ONE scroll container — the body. No nested scroll.
//   • Inputs LARGE (h-12 = 48px), labels + placeholders + helpers everywhere.
//   • Buttons: primary "Save & Send", secondary "Save Draft", ghost "Cancel".
//   • Pure black bg / #171A21 cards / #2A2E36 borders / #2563EB blue accent.
//
// Architecture (clean split — each file < 500 lines):
//   builder/types.ts         — shared types & prop interface (1:1 with original)
//   builder/constants.ts     — GST rates, units, statuses, states, defaults
//   builder/gst.ts           — pure math helpers (computeLineItem, computeTotals…)
//   builder/ui.tsx           — SectionCard, FieldLabel, MoneyInput, NumberInput,
//                              PremiumInput, RowIconButton, shared classnames
//   builder/ClientCombobox.tsx — searchable customer picker (Popover + Command)
//   InvoiceCustomerPanel.tsx — left card (search + GSTIN + name + state + POS + email + phone + terms)
//   InvoiceHeaderPanel.tsx   — right card (number + dates + status + GST type + payment + currency + template)
//   InvoiceLineItems.tsx     — full-width enterprise grid
//   InvoiceGSTSummary.tsx    — 3-col premium cards (GST metrics + totals + notes)
//   InvoicePreview.tsx       — collapsible Live Preview wrapper around InvoiceA4Preview
//   InvoiceBuilder.tsx       — THIS FILE — the orchestrator
//
// Backward compat:
//   • `InvoiceBuilderProps` interface is UNCHANGED — InvoiceWorkspacePage.tsx
//     still passes the same props (open / onOpenChange / clients /
//     initialInvoice / organization / onSubmit / saving / onCreateClient).
//   • `InvoiceBuilderSubmitPayload` is UNCHANGED — the parent's
//     `handleBuilderSubmit` keeps working without edits.
//   • No API endpoints changed. No hooks changed. Only the UI layer rebuilt.
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  X,
  Save,
  Send,
  FileText,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/gst-utils';
import { toast } from 'sonner';
import type { ApiInvoice, ApiClient } from './builder/types';
import type { InvoiceBuilderProps, InvoiceBuilderSubmitPayload, LineItem } from './builder/types';
import {
  DEFAULT_NOTES,
  DEFAULT_TERMS,
  DEFAULT_BANK_DETAILS,
  STATE_CODE_TO_NAME,
} from './builder/constants';
import {
  NUMBER,
  todayISO,
  addDaysISO,
  generateInvoiceNumber,
  stateCodeFromGstin,
  isInterStateSupply,
  computeLineItem,
  computeTotals,
  makeEmptyLineItem,
  nextLineKey,
  lineItemFromApiItem,
} from './builder/gst';
import { InvoiceCustomerPanel } from './InvoiceCustomerPanel';
import { InvoiceHeaderPanel } from './InvoiceHeaderPanel';
import { InvoiceLineItems } from './InvoiceLineItems';
import { InvoiceGSTSummary } from './InvoiceGSTSummary';
import { InvoicePreview } from './InvoicePreview';

// ─── Main component ──────────────────────────────────────────────────────────

export function InvoiceBuilder({
  open,
  onOpenChange,
  clients,
  initialInvoice = null,
  organization = null,
  onSubmit,
  saving = false,
  onCreateClient,
}: InvoiceBuilderProps) {
  // ── Form state ────────────────────────────────────────────────────────────
  const [clientId, setClientId] = useState<string | null>(null);
  const [buyerGstin, setBuyerGstin] = useState<string>('');
  const [buyerName, setBuyerName] = useState<string>('');
  const [buyerEmail, setBuyerEmail] = useState<string>('');
  const [buyerPhone, setBuyerPhone] = useState<string>('');
  const [invoiceNumber, setInvoiceNumber] = useState<string>('');
  const [invoiceDate, setInvoiceDate] = useState<string>(todayISO());
  const [dueDate, setDueDate] = useState<string>(addDaysISO(todayISO(), 30));
  const [invoiceStatus, setInvoiceStatus] = useState<string>('draft');
  const [paymentStatus, setPaymentStatus] = useState<string>('unpaid');
  const [currency, setCurrency] = useState<string>('INR');
  const [template, setTemplate] = useState<string>('classic');
  const [placeOfSupply, setPlaceOfSupply] = useState<string>('');
  const [reverseCharge, setReverseCharge] = useState<boolean>(false);
  const [items, setItems] = useState<LineItem[]>(() => [makeEmptyLineItem()]);
  const [notes, setNotes] = useState<string>(DEFAULT_NOTES);
  const [notesFinance, setNotesFinance] = useState<string>('');
  const [terms, setTerms] = useState<string>(DEFAULT_TERMS);
  const [bankDetails, setBankDetails] = useState<string>(DEFAULT_BANK_DETAILS);
  const [paymentTermsDays, setPaymentTermsDays] = useState<string>('30');
  const [paymentModeHint, setPaymentModeHint] = useState<string>('UPI');
  const [showCess, setShowCess] = useState<boolean>(false);

  // ── Hydrate state when the dialog opens or initialInvoice changes ─────────
  // Uses the "adjusting state during render" pattern (per React docs:
  // https://react.dev/learn/you-might-not-need-an-effect) instead of a
  // setState-in-effect, which would trip the react-hooks/set-state-in-effect
  // lint rule. React discards the partial render output and re-renders
  // synchronously with the new state — no commit, no cascading renders.
  const lastInitIdRef = useRef<string | null>(null);

  if (open) {
    const initId = initialInvoice?.id ?? '__new__';
    if (lastInitIdRef.current !== initId) {
      lastInitIdRef.current = initId;

      if (initialInvoice) {
        setClientId(initialInvoice.clientId ?? null);
        setBuyerGstin(initialInvoice.buyerGstin ?? '');
        setBuyerName(initialInvoice.buyerName ?? '');
        setInvoiceNumber(initialInvoice.invoiceNumber ?? generateInvoiceNumber());
        setInvoiceDate(initialInvoice.invoiceDate?.slice(0, 10) ?? todayISO());
        setDueDate(initialInvoice.dueDate?.slice(0, 10) ?? addDaysISO(todayISO(), 30));
        setInvoiceStatus(initialInvoice.status ?? 'draft');
        setPaymentStatus(initialInvoice.paymentStatus ?? 'unpaid');
        setCurrency('INR');
        setTemplate('classic');
        setReverseCharge(
          Boolean((initialInvoice as ApiInvoice & { reverseCharge?: boolean }).reverseCharge),
        );
        setNotes(initialInvoice.notes ?? DEFAULT_NOTES);
        setNotesFinance(
          (initialInvoice as ApiInvoice & { notesFinance?: string }).notesFinance ?? '',
        );
        setTerms(DEFAULT_TERMS);
        setBankDetails(DEFAULT_BANK_DETAILS);

        // Build line items from invoice.items[] if available, else one aggregated row.
        const apiItems = (initialInvoice as ApiInvoice & {
          items?: Array<Record<string, unknown>>;
        }).items;
        const hydrateInterState = isInterStateSupply(
          initialInvoice.sellerGstin,
          initialInvoice.buyerGstin,
        );
        if (Array.isArray(apiItems) && apiItems.length > 0) {
          setItems(
            apiItems.map((it) =>
              lineItemFromApiItem(
                it as Parameters<typeof lineItemFromApiItem>[0],
                hydrateInterState,
              ),
            ),
          );
        } else {
          // Synthesize one aggregated row from invoice-level totals.
          const line = makeEmptyLineItem();
          line.description = 'Aggregated invoice total';
          line.unit = 'LOT';
          line.quantity = 1;
          line.unitPrice = NUMBER(initialInvoice.taxableValue);
          const taxable = NUMBER(initialInvoice.taxableValue);
          const gstTotal =
            NUMBER(initialInvoice.cgst) + NUMBER(initialInvoice.sgst) + NUMBER(initialInvoice.igst);
          const gstRate = taxable > 0 ? Math.round((gstTotal / taxable) * 100) : 0;
          line.gstRate = gstRate;
          const computed = computeLineItem(line, hydrateInterState);
          setItems([{ ...line, ...computed }]);
        }
        // Derive place of supply from buyerGstin first 2 digits.
        const code = stateCodeFromGstin(initialInvoice.buyerGstin);
        setPlaceOfSupply(code || '');
        // Payment terms derived from invoiceDate vs dueDate.
        const diffDays = Math.round(
          (new Date(initialInvoice.dueDate ?? todayISO()).getTime() -
            new Date(initialInvoice.invoiceDate ?? todayISO()).getTime()) /
            (1000 * 60 * 60 * 24),
        );
        if ([0, 7, 15, 30, 45, 60, 90].includes(diffDays)) {
          setPaymentTermsDays(String(diffDays));
        } else {
          setPaymentTermsDays('30');
        }
        // Try to derive email/phone from the matched client.
        const matchedClient = clients.find((c) => c.id === initialInvoice.clientId);
        if (matchedClient) {
          setBuyerEmail(matchedClient.contactEmail ?? '');
          setBuyerPhone(matchedClient.contactPhone ?? '');
        }
      } else {
        // Fresh invoice — sensible defaults.
        setClientId(null);
        setBuyerGstin('');
        setBuyerName('');
        setBuyerEmail('');
        setBuyerPhone('');
        setInvoiceNumber(generateInvoiceNumber());
        setInvoiceDate(todayISO());
        setDueDate(addDaysISO(todayISO(), 30));
        setInvoiceStatus('draft');
        setPaymentStatus('unpaid');
        setCurrency('INR');
        setTemplate('classic');
        setPlaceOfSupply('');
        setReverseCharge(false);
        setItems([makeEmptyLineItem()]);
        setNotes(DEFAULT_NOTES);
        setNotesFinance('');
        setTerms(DEFAULT_TERMS);
        setBankDetails(DEFAULT_BANK_DETAILS);
        setPaymentTermsDays('30');
        setPaymentModeHint('UPI');
      }
    }
  }

  // Reset the init tracker when the dialog closes so reopening re-hydrates.
  useEffect(() => {
    if (!open) {
      lastInitIdRef.current = null;
    }
  }, [open]);

  // ── Derived data ──────────────────────────────────────────────────────────

  const sellerGstin = organization?.gstin ?? '';
  const sellerStateCode = stateCodeFromGstin(sellerGstin);
  const buyerStateCode = stateCodeFromGstin(buyerGstin);
  const interState = useMemo(
    () => isInterStateSupply(sellerGstin, buyerGstin),
    [sellerGstin, buyerGstin],
  );

  // Recompute every line item with current inter-state flag.
  const computedItems = useMemo(
    () =>
      items.map((it) => {
        const c = computeLineItem(it, interState);
        return { ...it, ...c };
      }),
    [items, interState],
  );

  const totals = useMemo(() => computeTotals(computedItems), [computedItems]);

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === clientId) ?? null,
    [clients, clientId],
  );

  // Live GST amount (for header subtitle).
  const gstAmount = totals.cgst + totals.sgst + totals.igst + totals.cess;

  // ── Live preview invoice (built from form state) ─────────────────────────
  const livePreviewInvoice = useMemo(() => {
    return {
      id: initialInvoice?.id ?? '__live_preview__',
      clientId: clientId ?? '',
      invoiceNumber: invoiceNumber || 'INV-PREVIEW',
      invoiceDate,
      sellerGstin: sellerGstin,
      buyerGstin: buyerGstin || null,
      buyerName: buyerName || selectedClient?.tradeName || 'Valued Customer',
      invoiceType: 'B2B',
      taxableValue: totals.subtotal,
      cgst: totals.cgst,
      sgst: totals.sgst,
      igst: totals.igst,
      cess: totals.cess,
      totalAmount: totals.total,
      status: invoiceStatus,
      matchStatus: 'unmatched',
      riskLevel: 'low',
      riskScore: 0,
      notes: terms, // InvoiceA4Preview parses notes as T&C list
      period: invoiceDate?.slice(0, 7) ?? null,
      dueDate,
      gstAmount,
      paidAmount: 0,
      balanceAmount: totals.total,
      paymentStatus,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      // Extended props consumed by InvoiceA4Preview:
      items: computedItems.map((it, idx) => ({
        lineNumber: idx + 1,
        description: it.description || 'Item',
        hsnCode: it.hsnCode || null,
        quantity: it.quantity,
        unit: it.unit,
        unitPrice: it.unitPrice,
        taxableValue: it.taxableValue,
        cgstRate: interState ? 0 : it.gstRate / 2,
        sgstRate: interState ? 0 : it.gstRate / 2,
        igstRate: interState ? it.gstRate : 0,
        cessRate: it.cessRate,
        cgst: it.cgst,
        sgst: it.sgst,
        igst: it.igst,
        cess: it.cess,
        totalAmount: it.total,
      })),
      hsnCode: computedItems[0]?.hsnCode ?? null,
      reverseCharge,
      notesFinance,
      paymentLink: null,
      paymentMode: paymentModeHint,
      paymentDate: null,
    } as ApiInvoice & {
      items: Array<{
        lineNumber: number;
        description: string;
        hsnCode: string | null;
        quantity: number;
        unit: string;
        unitPrice: number;
        taxableValue: number;
        cgstRate: number;
        sgstRate: number;
        igstRate: number;
        cessRate: number;
        cgst: number;
        sgst: number;
        igst: number;
        cess: number;
        totalAmount: number;
      }>;
      hsnCode: string | null;
      reverseCharge: boolean;
      notesFinance: string;
      paymentLink: null;
      paymentMode: string;
      paymentDate: null;
    };
  }, [
    initialInvoice, clientId, invoiceNumber, invoiceDate, sellerGstin, buyerGstin,
    buyerName, selectedClient, totals, terms, dueDate, gstAmount, computedItems,
    interState, reverseCharge, notesFinance, paymentModeHint, invoiceStatus,
    paymentStatus,
  ]);

  const livePreviewOrg = useMemo(() => {
    if (!organization) return null;
    return {
      name: organization.name,
      gstin: organization.gstin,
      address: organization.stateCode
        ? `${STATE_CODE_TO_NAME[organization.stateCode] ?? 'India'} (${organization.stateCode})`
        : 'India',
    };
  }, [organization]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const selectClient = useCallback(
    (client: ApiClient) => {
      setClientId(client.id);
      setBuyerGstin(client.gstin ?? '');
      setBuyerName(client.tradeName ?? client.legalName ?? '');
      setBuyerEmail(client.contactEmail ?? '');
      setBuyerPhone(client.contactPhone ?? '');
      const code = stateCodeFromGstin(client.gstin);
      if (code) setPlaceOfSupply(code);
    },
    [],
  );

  const addLineItem = useCallback(() => {
    setItems((prev) => [...prev, makeEmptyLineItem()]);
  }, []);

  const removeLineItem = useCallback((key: string) => {
    setItems((prev) => {
      if (prev.length <= 1) {
        // Always keep at least one row — replace with a fresh empty row.
        return [makeEmptyLineItem()];
      }
      return prev.filter((it) => it.key !== key);
    });
  }, []);

  const duplicateLineItem = useCallback((key: string) => {
    setItems((prev) => {
      const idx = prev.findIndex((it) => it.key === key);
      if (idx === -1) return prev;
      const copy = { ...prev[idx], key: nextLineKey() };
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      return next;
    });
  }, []);

  const moveLineItem = useCallback((key: string, dir: 'up' | 'down') => {
    setItems((prev) => {
      const idx = prev.findIndex((it) => it.key === key);
      if (idx === -1) return prev;
      const target = dir === 'up' ? idx - 1 : idx + 1;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(idx, 1);
      next.splice(target, 0, moved);
      return next;
    });
  }, []);

  const updateLineItem = useCallback(
    <K extends keyof LineItem>(key: string, field: K, value: LineItem[K]) => {
      setItems((prev) =>
        prev.map((it) => (it.key === key ? { ...it, [field]: value } : it)),
      );
    },
    [],
  );

  const setDueDatePreset = useCallback(
    (days: number) => {
      setPaymentTermsDays(String(days));
      setDueDate(addDaysISO(invoiceDate, days));
    },
    [invoiceDate],
  );

  // When paymentTermsDays changes via the Customer Panel select, recompute due date.
  const onPaymentTermsChange = useCallback(
    (val: string) => {
      setPaymentTermsDays(val);
      const days = Number(val);
      if (Number.isFinite(days) && days >= 0) {
        setDueDate(addDaysISO(invoiceDate, days));
      }
    },
    [invoiceDate],
  );

  // When invoiceDate changes, also nudge dueDate to keep the same term gap.
  const onInvoiceDateChange = useCallback(
    (newDate: string) => {
      setInvoiceDate(newDate);
      const days = Number(paymentTermsDays);
      if (Number.isFinite(days) && days >= 0) {
        setDueDate(addDaysISO(newDate, days));
      }
    },
    [paymentTermsDays],
  );

  const buildPayload = useCallback(
    (status: 'draft' | 'sent'): InvoiceBuilderSubmitPayload => ({
      clientId: clientId ?? undefined,
      customerName: buyerName || selectedClient?.tradeName || 'Valued Customer',
      buyerGstin: buyerGstin || undefined,
      sellerGstin: sellerGstin || undefined,
      date: invoiceDate,
      dueDate,
      invoiceNumber,
      invoiceType: 'B2B',
      items: computedItems.map((it) => ({
        description: it.description || 'Line item',
        hsnCode: it.hsnCode || undefined,
        quantity: it.quantity,
        unit: it.unit,
        unitPrice: it.unitPrice,
        discountPct: it.discountPct,
        gstRate: it.gstRate,
        cessRate: it.cessRate,
      })),
      notes,
      notesFinance,
      terms,
      bankDetails,
      reverseCharge,
      placeOfSupply: placeOfSupply || buyerStateCode || undefined,
      status,
    }),
    [
      clientId, buyerName, selectedClient, buyerGstin, sellerGstin, invoiceDate,
      dueDate, invoiceNumber, computedItems, notes, notesFinance, terms,
      bankDetails, reverseCharge, placeOfSupply, buyerStateCode,
    ],
  );

  const handleSubmit = useCallback(
    async (status: 'draft' | 'sent') => {
      if (!buyerName && !selectedClient) {
        toast.error('Please pick a customer or enter a business name.', {
          description: 'The invoice needs a Bill-To before saving.',
        });
        return;
      }
      if (computedItems.every((it) => it.taxableValue === 0)) {
        toast.error('Add at least one item with a non-zero amount.', {
          description: 'Line items drive the taxable value on this invoice.',
        });
        return;
      }
      try {
        await onSubmit(buildPayload(status));
      } catch (err) {
        console.error('[InvoiceBuilder] onSubmit threw:', err);
        toast.error('Unable to save this invoice right now.', {
          description: err instanceof Error ? err.message : 'Please try again.',
        });
      }
    },
    [buyerName, selectedClient, computedItems, onSubmit, buildPayload],
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  const dialogTitle = initialInvoice ? 'Edit Invoice' : 'Create New Invoice';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className={cn(
          // ── WIDTH FIX (CRITICAL) ───────────────────────────────────────────
          // The base DialogContent ships with `sm:max-w-lg` (512px) which
          // tailwind-merge does NOT strip when we pass `max-w-7xl` (different
          // responsive variant). On desktop the media-query rule wins and the
          // modal ends up only 512px wide — squeezing every section.
          // We explicitly override at every breakpoint:
          //   mobile:  100vw - 1rem
          //   sm+:     100vw - 2rem
          //   lg+:     1100px
          //   xl+:     1240px   (target per spec: ~1100–1250px)
          'gap-0 overflow-hidden border-[#2A2E36] bg-[#0F1115] p-0 text-foreground',
          'flex flex-col h-[92vh] max-h-[92vh]',
          'w-[calc(100vw-1rem)] sm:w-[calc(100vw-2rem)]',
          'max-w-[calc(100vw-1rem)] sm:max-w-[calc(100vw-2rem)] lg:max-w-[1100px] xl:max-w-[1240px]',
        )}
      >
        {/* ── Sticky Header (shrink-0 — never collapses) ─────────────────────── */}
        <DialogHeader className="shrink-0 gap-0 border-b border-[#2A2E36] bg-[#0F1115]/95 px-4 py-3 backdrop-blur-xl sm:px-6 sm:py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#2563EB]/15 text-[#60A5FA] ring-1 ring-[#2563EB]/30 sm:h-11 sm:w-11">
                <FileText className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="gst-card-title truncate text-[16px] text-foreground sm:text-[18px]">
                  {dialogTitle}
                </DialogTitle>
                <DialogDescription className="gst-description mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-mono text-[11px] text-muted-foreground sm:text-[12px]">
                    {invoiceNumber || 'INV-PREVIEW'}
                  </span>
                  <span className="hidden text-muted-foreground/50 sm:inline">·</span>
                  <span className="text-[11px] text-muted-foreground sm:text-[12px]">
                    Total{' '}
                    <span className="font-semibold tabular-nums text-[#60A5FA]">
                      {formatCurrency(totals.total)}
                    </span>
                    <span className="ml-1 hidden text-muted-foreground/70 sm:inline">
                      (incl. GST {formatCurrency(gstAmount)})
                    </span>
                  </span>
                </DialogDescription>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  'gst-status hidden md:inline-flex',
                  interState ? 'gst-status-warning' : 'gst-status-success',
                )}
              >
                {interState ? (
                  <>
                    <AlertCircle className="h-3 w-3" />
                    Inter-state · IGST
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3 w-3" />
                    Intra-state · CGST+SGST
                  </>
                )}
              </span>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                disabled={saving}
                className="gst-btn gst-btn-ghost"
              >
                <X className="h-4 w-4" />
                <span className="hidden sm:inline">Cancel</span>
              </button>
              <button
                type="button"
                onClick={() => handleSubmit('draft')}
                disabled={saving}
                className={cn('gst-btn gst-btn-secondary', saving && 'gst-btn-loading')}
              >
                <Save className="h-4 w-4" />
                <span className="hidden sm:inline">Save Draft</span>
              </button>
              <button
                type="button"
                onClick={() => handleSubmit('sent')}
                disabled={saving}
                className={cn('gst-btn gst-btn-primary', saving && 'gst-btn-loading')}
              >
                <Send className="h-4 w-4" />
                <span className="hidden sm:inline">Save &amp; Send</span>
                <span className="sm:hidden">Send</span>
              </button>
            </div>
          </div>
        </DialogHeader>

        {/* ── Single-scroll body (overflow-x: hidden — only the line-item table may scroll horizontally) ── */}
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-[#0F1115]">
          <motion.form
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            onSubmit={(e) => {
              e.preventDefault();
              void handleSubmit('sent');
            }}
            className="mx-auto w-full max-w-[1200px] space-y-6 px-4 py-5 sm:px-6 sm:py-6 lg:px-8"
          >
            {/* ── Row 1: Customer Information (left) | Invoice Details (right) ─ */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <InvoiceCustomerPanel
                clients={clients}
                selectedClient={selectedClient}
                onSelectClient={selectClient}
                onCreateClient={onCreateClient}
                businessName={buyerName}
                onBusinessNameChange={setBuyerName}
                buyerGstin={buyerGstin}
                onBuyerGstinChange={setBuyerGstin}
                placeOfSupply={placeOfSupply}
                onPlaceOfSupplyChange={setPlaceOfSupply}
                email={buyerEmail}
                onEmailChange={setBuyerEmail}
                phone={buyerPhone}
                onPhoneChange={setBuyerPhone}
                paymentTermsDays={paymentTermsDays}
                onPaymentTermsChange={onPaymentTermsChange}
                dueDate={dueDate}
              />
              <InvoiceHeaderPanel
                invoiceNumber={invoiceNumber}
                onInvoiceNumberChange={setInvoiceNumber}
                invoiceDate={invoiceDate}
                onInvoiceDateChange={onInvoiceDateChange}
                dueDate={dueDate}
                onDueDateChange={setDueDate}
                onDueDatePreset={setDueDatePreset}
                paymentTermsDays={paymentTermsDays}
                invoiceStatus={invoiceStatus}
                onInvoiceStatusChange={setInvoiceStatus}
                paymentStatus={paymentStatus}
                onPaymentStatusChange={setPaymentStatus}
                currency={currency}
                onCurrencyChange={setCurrency}
                template={template}
                onTemplateChange={setTemplate}
                interState={interState}
                sellerGstin={sellerGstin}
                buyerGstin={buyerGstin}
                organization={organization}
                isEdit={Boolean(initialInvoice)}
                editInvoiceNumber={initialInvoice?.invoiceNumber}
              />
            </div>

            {/* ── Row 2: Line Items (Full Width) ─────────────────────────────── */}
            <InvoiceLineItems
              items={computedItems}
              interState={interState}
              showCess={showCess}
              onToggleCess={setShowCess}
              onAdd={addLineItem}
              onRemove={removeLineItem}
              onDuplicate={duplicateLineItem}
              onMoveUp={(key) => moveLineItem(key, 'up')}
              onMoveDown={(key) => moveLineItem(key, 'down')}
              onUpdate={updateLineItem}
              totals={totals}
            />

            {/* ── Row 3: GST Summary | Totals | Notes (3 cols) ──────────────── */}
            <InvoiceGSTSummary
              totals={totals}
              interState={interState}
              sellerStateCode={sellerStateCode}
              buyerStateCode={buyerStateCode}
              items={computedItems}
              notes={notes}
              onNotesChange={setNotes}
              notesFinance={notesFinance}
              onNotesFinanceChange={setNotesFinance}
              terms={terms}
              onTermsChange={setTerms}
              bankDetails={bankDetails}
              onBankDetailsChange={setBankDetails}
            />

            {/* ── Row 4: Live Preview (collapsible) ─────────────────────────── */}
            <InvoicePreview
              invoice={livePreviewInvoice}
              client={selectedClient}
              organization={livePreviewOrg}
            />

            {/* Bottom padding for breathing room above the sticky footer */}
            <div className="h-4" aria-hidden />
          </motion.form>
        </div>

        {/* ── Sticky Footer (shrink-0 — always visible, easy access to primary actions) ── */}
        <div className="shrink-0 border-t border-[#2A2E36] bg-[#0F1115]/95 px-4 py-3 backdrop-blur-xl sm:px-6">
          <div className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted-foreground">
              <span className="gst-status gst-status-neutral">
                {interState ? 'IGST' : 'CGST+SGST'}
              </span>
              <span className="hidden sm:inline">
                {computedItems.length} item{computedItems.length === 1 ? '' : 's'}
              </span>
              <span className="hidden text-muted-foreground/50 sm:inline">·</span>
              <span className="font-mono text-[11px] text-muted-foreground sm:text-[12px]">
                {invoiceNumber || 'INV-PREVIEW'}
              </span>
              <span className="hidden text-muted-foreground/50 sm:inline">·</span>
              <span>
                Grand Total{' '}
                <span className="font-bold tabular-nums text-[#60A5FA]">
                  {formatCurrency(totals.total)}
                </span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                disabled={saving}
                className="gst-btn gst-btn-ghost"
              >
                <X className="h-4 w-4" />
                <span className="hidden sm:inline">Cancel</span>
              </button>
              <button
                type="button"
                onClick={() => handleSubmit('draft')}
                disabled={saving}
                className={cn('gst-btn gst-btn-secondary', saving && 'gst-btn-loading')}
              >
                <Save className="h-4 w-4" />
                <span className="hidden sm:inline">Save Draft</span>
                <span className="sm:hidden">Draft</span>
              </button>
              <button
                type="button"
                onClick={() => handleSubmit('sent')}
                disabled={saving}
                className={cn('gst-btn gst-btn-primary', saving && 'gst-btn-loading')}
              >
                <Send className="h-4 w-4" />
                <span className="hidden sm:inline">Save &amp; Send</span>
                <span className="sm:hidden">Send</span>
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default InvoiceBuilder;

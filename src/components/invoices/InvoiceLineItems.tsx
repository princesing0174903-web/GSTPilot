'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — InvoiceLineItems
//
// Full-width enterprise line-item grid. Built on `.gst-table` so it inherits
// sticky headers, hover, premium borders automatically.
//
// Design goals (per INVOICE-REBUILD spec):
//   • All columns visible on desktop (max-w-7xl ≈ 1230px usable):
//       # | Description | HSN/SAC | Qty | Unit | Rate | Disc% | GST% | Taxable
//         | CGST | SGST | IGST | CESS | Amount | Actions
//   • NO horizontal scroll on desktop — uses w-full + table-fixed + explicit
//     <colgroup> widths that sum to exactly the container width.
//   • `overflow-x-auto` is wired as a SAFETY NET only — activates on tablet
//     and mobile where there genuinely isn't room.
//   • Inline inputs blend with the row (transparent border, blue focus ring).
//   • Sticky table header so the column labels stay visible when scrolling.
//   • Hover effect on rows.
//   • CESS column is hidden by default (toggle).
//   • Inter-state shows IGST; intra-state shows CGST + SGST (never both).
//
// Keyboard nav: pressing Enter in any input moves focus to the next focusable
// field in the row (so users can fill a line top-to-bottom without lifting
// their hands off the keyboard).
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useCallback } from 'react';
import {
  Plus,
  Trash2,
  Copy,
  ChevronUp,
  ChevronDown,
  CreditCard,
  GripVertical,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/gst-utils';
import { SectionCard, MoneyInput, NumberInput, RowIconButton } from './builder/ui';
import { PREMIUM_SELECT_CONTENT_CLASSNAMES } from './builder/ui';
import { GST_RATES, UNITS } from './builder/constants';
import type { LineItem } from './builder/types';

export interface InvoiceLineItemsProps {
  items: LineItem[];
  interState: boolean;
  showCess: boolean;
  onToggleCess: (v: boolean) => void;
  onAdd: () => void;
  onRemove: (key: string) => void;
  onDuplicate: (key: string) => void;
  onMoveUp: (key: string) => void;
  onMoveDown: (key: string) => void;
  onUpdate: <K extends keyof LineItem>(key: string, field: K, value: LineItem[K]) => void;
  // Totals for the footer row
  totals: {
    subtotal: number;
    cgst: number;
    sgst: number;
    igst: number;
    cess: number;
    total: number;
    roundOff: number;
  };
}

export function InvoiceLineItems({
  items,
  interState,
  showCess,
  onToggleCess,
  onAdd,
  onRemove,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  onUpdate,
  totals,
}: InvoiceLineItemsProps) {
  return (
    <SectionCard
      icon={<CreditCard className="h-5 w-5" />}
      title="Line Items"
      description="Auto CGST/SGST (intra-state) or IGST (inter-state). CESS is hidden by default."
      right={
        <div className="flex items-center gap-2">
          <label className="flex cursor-pointer items-center gap-1.5 rounded-md border border-[#2A2E36] bg-[#0F1115] px-2.5 py-2 text-[12px] text-muted-foreground">
            <Checkbox
              checked={showCess}
              onCheckedChange={(v) => onToggleCess(v === true)}
              className="border-[#3A3A3A] data-[state=checked]:bg-[#2563EB] data-[state=checked]:border-[#2563EB]"
            />
            CESS
          </label>
          <button type="button" onClick={onAdd} className="gst-btn gst-btn-ghost gst-btn-sm">
            <Plus className="h-3.5 w-3.5" />
            Add Row
          </button>
        </div>
      }
      bodyClassName="lg:-mx-2"
    >
      <div className="overflow-x-auto">
        <table className="gst-table w-full min-w-[860px] lg:min-w-0 lg:table-fixed">
          <colgroup>
            <col className="w-10" />
            <col className="min-w-[180px] lg:min-w-0 lg:w-auto" />
            <col className="w-24" />
            <col className="w-16" />
            <col className="w-20" />
            <col className="w-28" />
            <col className="w-16" />
            <col className="w-20" />
            <col className="w-28" />
            {interState ? (
              <col className="w-24" />
            ) : (
              <>
                <col className="w-20" />
                <col className="w-20" />
              </>
            )}
            {showCess ? <col className="w-20" /> : null}
            <col className="w-28" />
            <col className="w-24" />
          </colgroup>
          <thead>
            <tr>
              <th className="px-2 text-center">#</th>
              <th className="px-2">Description</th>
              <th className="px-2 text-left">HSN/SAC</th>
              <th className="px-2 text-right">Qty</th>
              <th className="px-2 text-left">Unit</th>
              <th className="px-2 text-right">Rate (₹)</th>
              <th className="px-2 text-right">Disc%</th>
              <th className="px-2 text-right">GST%</th>
              <th className="px-2 text-right">Taxable</th>
              {interState ? (
                <th className="px-2 text-right">IGST</th>
              ) : (
                <>
                  <th className="px-2 text-right">CGST</th>
                  <th className="px-2 text-right">SGST</th>
                </>
              )}
              {showCess ? <th className="px-2 text-right">CESS</th> : null}
              <th className="px-2 text-right">Amount</th>
              <th className="px-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, idx) => (
              <LineItemRow
                key={it.key}
                index={idx}
                item={it}
                interState={interState}
                showCess={showCess}
                canMoveUp={idx > 0}
                canMoveDown={idx < items.length - 1}
                onUpdate={(field, value) => onUpdate(it.key, field, value)}
                onRemove={() => onRemove(it.key)}
                onDuplicate={() => onDuplicate(it.key)}
                onMoveUp={() => onMoveUp(it.key)}
                onMoveDown={() => onMoveDown(it.key)}
              />
            ))}
            {items.length === 0 ? (
              <tr>
                <td colSpan={14} className="py-10 text-center text-[13px] text-muted-foreground">
                  No line items yet. Click <span className="font-medium text-[#60A5FA]">Add Row</span> to
                  begin.
                </td>
              </tr>
            ) : null}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-[#2A2E36] bg-[#0F1115] text-[13px] font-semibold">
              <td colSpan={8} className="px-2 py-3 text-right uppercase tracking-wider text-muted-foreground">
                Totals
              </td>
              <td className="px-2 py-3 text-right tabular-nums text-foreground">
                {formatCurrency(totals.subtotal)}
              </td>
              {interState ? (
                <td className="px-2 py-3 text-right tabular-nums text-foreground">
                  {formatCurrency(totals.igst)}
                </td>
              ) : (
                <>
                  <td className="px-2 py-3 text-right tabular-nums text-foreground">
                    {formatCurrency(totals.cgst)}
                  </td>
                  <td className="px-2 py-3 text-right tabular-nums text-foreground">
                    {formatCurrency(totals.sgst)}
                  </td>
                </>
              )}
              {showCess ? (
                <td className="px-2 py-3 text-right tabular-nums text-foreground">
                  {formatCurrency(totals.cess)}
                </td>
              ) : null}
              <td className="px-2 py-3 text-right tabular-nums text-[#60A5FA]">
                {formatCurrency(totals.total)}
              </td>
              <td className="px-2 py-3 text-right text-[11px] text-muted-foreground">
                {totals.roundOff >= 0 ? '+' : '−'}
                {formatCurrency(Math.abs(totals.roundOff))} round
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Status footer info inside form area */}
      <div className="mt-4 flex items-center justify-between px-1 gst-caption text-muted-foreground">
        <span>
          {items.length} line item{items.length === 1 ? '' : 's'} ·{' '}
          {interState ? 'IGST' : 'CGST+SGST'}
        </span>
        <span className="text-muted-foreground/70">Press Enter to move to the next field in a row.</span>
      </div>
    </SectionCard>
  );
}

// ─── Row component ────────────────────────────────────────────────────────────

interface LineItemRowProps {
  index: number;
  item: LineItem;
  interState: boolean;
  showCess: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onUpdate: <K extends keyof LineItem>(field: K, value: LineItem[K]) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

function LineItemRow({
  index,
  item,
  interState,
  showCess,
  canMoveUp,
  canMoveDown,
  onUpdate,
  onRemove,
  onDuplicate,
  onMoveUp,
  onMoveDown,
}: LineItemRowProps) {
  // Enter key moves focus to the next focusable input in the row.
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const form = (e.currentTarget as HTMLInputElement).form;
      if (!form) return;
      const focusables = Array.from(
        form.querySelectorAll<HTMLElement>(
          'input:not([disabled]), select:not([disabled]), button:not([disabled]), textarea:not([disabled])',
        ),
      );
      const idx = focusables.indexOf(e.currentTarget as HTMLInputElement);
      const next = focusables[idx + 1];
      if (next) {
        next.focus();
        if (next instanceof HTMLInputElement) next.select?.();
      }
    }
  }, []);

  // Premium inline-input classes that blend into the gst-table row.
  const INLINE_INPUT_CLASS =
    'h-10 border-transparent bg-transparent px-2 text-[14px] text-foreground placeholder:text-muted-foreground/50 ' +
    'focus:border-[#2563EB] focus:bg-[#0F1115] focus:ring-2 focus:ring-[#2563EB]/30';

  return (
    <tr className="group transition-colors hover:bg-[#0F1115]">
      <td className="px-2 py-1 text-center text-[12px] tabular-nums text-muted-foreground">
        <div className="flex items-center justify-center gap-0.5">
          <GripVertical className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-50" />
          <span>{index + 1}</span>
        </div>
      </td>
      <td className="px-2 py-1">
        <Input
          value={item.description}
          onChange={(e) => onUpdate('description', e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Item description"
          aria-label={`Line ${index + 1} description`}
          className={INLINE_INPUT_CLASS}
        />
      </td>
      <td className="px-2 py-1">
        <Input
          value={item.hsnCode}
          onChange={(e) => onUpdate('hsnCode', e.target.value.toUpperCase())}
          onKeyDown={handleKeyDown}
          placeholder="998314"
          aria-label={`Line ${index + 1} HSN/SAC`}
          className={cn(INLINE_INPUT_CLASS, 'font-mono text-[12px] uppercase')}
        />
      </td>
      <td className="px-2 py-1">
        <NumberInput
          value={item.quantity}
          onValueChange={(n) => onUpdate('quantity', n)}
          onKeyDown={handleKeyDown}
          aria-label={`Line ${index + 1} quantity`}
          className="h-10 px-2"
        />
      </td>
      <td className="px-2 py-1">
        <Select value={item.unit} onValueChange={(v) => onUpdate('unit', v)}>
          <SelectTrigger
            size="sm"
            aria-label={`Line ${index + 1} unit`}
            className={cn(INLINE_INPUT_CLASS, 'h-10 border-transparent focus:ring-[#2563EB]/30')}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent className={PREMIUM_SELECT_CONTENT_CLASSNAMES}>
            {UNITS.map((u) => (
              <SelectItem key={u} value={u} className="focus:bg-[#2563EB]/10 focus:text-[#60A5FA]">
                {u}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className="px-2 py-1">
        <MoneyInput
          value={item.unitPrice}
          onValueChange={(n) => onUpdate('unitPrice', n)}
          onKeyDown={handleKeyDown}
          aria-label={`Line ${index + 1} rate`}
          className="h-10 px-2"
        />
      </td>
      <td className="px-2 py-1">
        <NumberInput
          value={item.discountPct}
          onValueChange={(n) => onUpdate('discountPct', n)}
          onKeyDown={handleKeyDown}
          aria-label={`Line ${index + 1} discount percent`}
          className="h-10 px-2"
        />
      </td>
      <td className="px-2 py-1">
        <Select value={String(item.gstRate)} onValueChange={(v) => onUpdate('gstRate', Number(v))}>
          <SelectTrigger
            size="sm"
            aria-label={`Line ${index + 1} GST rate`}
            className={cn(INLINE_INPUT_CLASS, 'h-10 border-transparent focus:ring-[#2563EB]/30')}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent className={PREMIUM_SELECT_CONTENT_CLASSNAMES}>
            {GST_RATES.map((r) => (
              <SelectItem key={r} value={String(r)} className="focus:bg-[#2563EB]/10 focus:text-[#60A5FA]">
                {r}%
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className="px-2 py-2 text-right text-[14px] tabular-nums text-foreground">
        {formatCurrency(item.taxableValue)}
      </td>
      {interState ? (
        <td className="px-2 py-2 text-right text-[14px] tabular-nums text-muted-foreground">
          {formatCurrency(item.igst)}
        </td>
      ) : (
        <>
          <td className="px-2 py-2 text-right text-[14px] tabular-nums text-muted-foreground">
            {formatCurrency(item.cgst)}
          </td>
          <td className="px-2 py-2 text-right text-[14px] tabular-nums text-muted-foreground">
            {formatCurrency(item.sgst)}
          </td>
        </>
      )}
      {showCess ? (
        <td className="px-2 py-2 text-right text-[14px] tabular-nums text-muted-foreground">
          {formatCurrency(item.cess)}
        </td>
      ) : null}
      <td className="px-2 py-2 text-right text-[14px] font-semibold tabular-nums text-[#60A5FA]">
        {formatCurrency(item.total)}
      </td>
      <td className="px-2 py-1">
        <div className="flex items-center justify-end gap-0.5">
          <RowIconButton
            label="Move up"
            onClick={onMoveUp}
            disabled={!canMoveUp}
            icon={<ChevronUp className="h-3.5 w-3.5" />}
          />
          <RowIconButton
            label="Move down"
            onClick={onMoveDown}
            disabled={!canMoveDown}
            icon={<ChevronDown className="h-3.5 w-3.5" />}
          />
          <RowIconButton
            label="Duplicate"
            onClick={onDuplicate}
            icon={<Copy className="h-3.5 w-3.5" />}
          />
          <RowIconButton
            label="Delete"
            onClick={onRemove}
            icon={<Trash2 className="h-3.5 w-3.5" />}
            tone="danger"
          />
        </div>
      </td>
    </tr>
  );
}

'use client';

import React, { memo, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Search,
  FilterX,
  Save,
  Star,
  ChevronDown,
  X,
  Calendar,
  IndianRupee,
} from 'lucide-react';
import type { ApiClient } from '@/hooks/useClientsApi';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Invoice Filters (Premium)
//
// Search + filter bar with:
//   • Debounced multi-field search with clear button
//   • Status, Payment, Client, GST Rate, Risk filter dropdowns
//   • Date range + amount range advanced filter (popover)
//   • Save filter preset (localStorage)
//   • Reset all + active filter count badge
// ═══════════════════════════════════════════════════════════════════════════════

export interface InvoiceFiltersState {
  search: string;
  status: string;
  paymentStatus: string;
  clientId: string;
  gstRate: string;
  risk: string;
  dateFrom: string;
  dateTo: string;
  amountMin: string;
  amountMax: string;
}

export const DEFAULT_FILTERS: InvoiceFiltersState = {
  search: '',
  status: 'all',
  paymentStatus: 'all',
  clientId: 'all',
  gstRate: 'all',
  risk: 'all',
  dateFrom: '',
  dateTo: '',
  amountMin: '',
  amountMax: '',
};

interface InvoiceFiltersProps {
  filters: InvoiceFiltersState;
  onFiltersChange: (next: InvoiceFiltersState) => void;
  clients: ApiClient[];
  totalInvoices: number;
  filteredCount: number;
  selectedCount?: number;
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'viewed', label: 'Viewed' },
  { value: 'partially_paid', label: 'Partially Paid' },
  { value: 'paid', label: 'Paid' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'cancelled', label: 'Cancelled' },
];

const PAYMENT_OPTIONS = [
  { value: 'all', label: 'All Payments' },
  { value: 'paid', label: 'Paid' },
  { value: 'partially_paid', label: 'Partial' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'overdue', label: 'Overdue' },
];

const GST_RATE_OPTIONS = [
  { value: 'all', label: 'All GST Rates' },
  { value: '0', label: '0% (Exempt)' },
  { value: '5', label: '5%' },
  { value: '12', label: '12%' },
  { value: '18', label: '18%' },
  { value: '28', label: '28%' },
];

const RISK_OPTIONS = [
  { value: 'all', label: 'All Risk' },
  { value: 'low', label: 'Low Risk' },
  { value: 'medium', label: 'Medium Risk' },
  { value: 'high', label: 'High Risk' },
  { value: 'critical', label: 'Critical Risk' },
];

const FILTER_PRESETS_KEY = 'gstpilot:invoice-filter-presets';

export interface FilterPreset {
  id: string;
  name: string;
  filters: InvoiceFiltersState;
}

function loadPresets(): FilterPreset[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(FILTER_PRESETS_KEY);
    return raw ? (JSON.parse(raw) as FilterPreset[]) : [];
  } catch {
    return [];
  }
}

function savePresets(presets: FilterPreset[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(FILTER_PRESETS_KEY, JSON.stringify(presets));
}

const SELECT_TRIGGER_CLS =
  'h-9 bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.06] text-foreground text-xs justify-between font-medium';

function FilterSelect({
  value,
  onChange,
  options,
  className = '',
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={`${SELECT_TRIGGER_CLS} ${className}`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="bg-zinc-950 border-white/10">
        {options.map((opt) => (
          <SelectItem
            key={opt.value}
            value={opt.value}
            className="text-xs text-foreground focus:bg-white/[0.06] focus:text-foreground"
          >
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export const InvoiceFilters = memo(function InvoiceFilters({
  filters,
  onFiltersChange,
  clients,
  totalInvoices,
  filteredCount,
  selectedCount = 0,
}: InvoiceFiltersProps) {
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.status !== 'all') count += 1;
    if (filters.paymentStatus !== 'all') count += 1;
    if (filters.clientId !== 'all') count += 1;
    if (filters.gstRate !== 'all') count += 1;
    if (filters.risk !== 'all') count += 1;
    if (filters.dateFrom || filters.dateTo) count += 1;
    if (filters.amountMin || filters.amountMax) count += 1;
    return count;
  }, [filters]);

  const hasAdvanced = filters.dateFrom || filters.dateTo || filters.amountMin || filters.amountMax;

  const update = (patch: Partial<InvoiceFiltersState>) => {
    onFiltersChange({ ...filters, ...patch });
  };

  const reset = () => {
    onFiltersChange({ ...DEFAULT_FILTERS, search: filters.search });
  };

  const handleSavePreset = () => {
    const name = window.prompt('Name this filter preset:');
    if (!name) return;
    const presets = loadPresets();
    const newPreset: FilterPreset = {
      id: `preset-${Date.now()}`,
      name,
      filters: { ...filters },
    };
    savePresets([...presets, newPreset]);
  };

  const clientOptions = useMemo(
    () => [
      { value: 'all', label: 'All Clients' },
      ...clients.map((c) => ({
        value: c.id,
        label: c.tradeName.length > 24 ? c.tradeName.slice(0, 24) + '…' : c.tradeName,
      })),
    ],
    [clients],
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="glass-surface rounded-2xl border border-white/[0.06] p-3 md:p-4"
    >
      <div className="flex flex-wrap items-center gap-2 md:gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={filters.search}
            onChange={(e) => update({ search: e.target.value })}
            placeholder="Search invoice #, client, GSTIN, amount…"
            className="pl-9 pr-9 h-9 bg-white/[0.03] border-white/[0.08] text-foreground placeholder:text-muted-foreground text-sm focus-visible:ring-1 focus-visible:ring-emerald-500/40"
          />
          {filters.search && (
            <button
              onClick={() => update({ search: '' })}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Status */}
        <div className="w-[140px]">
          <FilterSelect
            value={filters.status}
            onChange={(v) => update({ status: v })}
            options={STATUS_OPTIONS}
          />
        </div>

        {/* Payment */}
        <div className="w-[140px] hidden md:block">
          <FilterSelect
            value={filters.paymentStatus}
            onChange={(v) => update({ paymentStatus: v })}
            options={PAYMENT_OPTIONS}
          />
        </div>

        {/* Client */}
        <div className="w-[160px] hidden lg:block">
          <FilterSelect
            value={filters.clientId}
            onChange={(v) => update({ clientId: v })}
            options={clientOptions}
          />
        </div>

        {/* GST Rate */}
        <div className="w-[140px] hidden lg:block">
          <FilterSelect
            value={filters.gstRate}
            onChange={(v) => update({ gstRate: v })}
            options={GST_RATE_OPTIONS}
          />
        </div>

        {/* Risk */}
        <div className="w-[130px] hidden xl:block">
          <FilterSelect
            value={filters.risk}
            onChange={(v) => update({ risk: v })}
            options={RISK_OPTIONS}
          />
        </div>

        {/* Advanced filter popover */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={`h-9 border-white/[0.08] text-xs font-medium ${
                hasAdvanced
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/15'
                  : 'bg-white/[0.03] hover:bg-white/[0.06] text-foreground'
              }`}
            >
              <Calendar className="h-3.5 w-3.5 mr-1.5" />
              Advanced
              {hasAdvanced && (
                <span className="ml-1.5 inline-flex items-center justify-center h-4 w-4 rounded-full bg-emerald-500 text-emerald-950 text-[10px] font-bold">
                  •
                </span>
              )}
              <ChevronDown className="h-3 w-3 ml-1" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 bg-zinc-950 border-white/10 p-4" align="end">
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-semibold text-foreground mb-3 uppercase tracking-wider">
                  Date Range
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-muted-foreground mb-1 block">From</label>
                    <Input
                      type="date"
                      value={filters.dateFrom}
                      onChange={(e) => update({ dateFrom: e.target.value })}
                      className="h-8 bg-white/[0.03] border-white/[0.08] text-xs text-foreground"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground mb-1 block">To</label>
                    <Input
                      type="date"
                      value={filters.dateTo}
                      onChange={(e) => update({ dateTo: e.target.value })}
                      className="h-8 bg-white/[0.03] border-white/[0.08] text-xs text-foreground"
                    />
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-foreground mb-3 uppercase tracking-wider">
                  Amount Range (₹)
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-muted-foreground mb-1 block">Min</label>
                    <div className="relative">
                      <IndianRupee className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                      <Input
                        type="number"
                        value={filters.amountMin}
                        onChange={(e) => update({ amountMin: e.target.value })}
                        placeholder="0"
                        className="h-8 pl-7 bg-white/[0.03] border-white/[0.08] text-xs text-foreground"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground mb-1 block">Max</label>
                    <div className="relative">
                      <IndianRupee className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                      <Input
                        type="number"
                        value={filters.amountMax}
                        onChange={(e) => update({ amountMax: e.target.value })}
                        placeholder="∞"
                        className="h-8 pl-7 bg-white/[0.03] border-white/[0.08] text-xs text-foreground"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {(filters.dateFrom || filters.dateTo || filters.amountMin || filters.amountMax) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs text-muted-foreground hover:text-foreground"
                  onClick={() =>
                    update({ dateFrom: '', dateTo: '', amountMin: '', amountMax: '' })
                  }
                >
                  <FilterX className="h-3 w-3 mr-1.5" />
                  Clear Advanced
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>

        {/* Save preset */}
        <Button
          variant="ghost"
          size="sm"
          className="h-9 text-xs text-muted-foreground hover:text-foreground"
          onClick={handleSavePreset}
          disabled={activeFilterCount === 0}
        >
          <Save className="h-3.5 w-3.5 mr-1" />
          <span className="hidden md:inline">Save</span>
        </Button>

        {/* Reset */}
        {activeFilterCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 text-xs text-muted-foreground hover:text-foreground"
            onClick={reset}
          >
            <FilterX className="h-3.5 w-3.5 mr-1" />
            Reset
            {activeFilterCount > 0 && (
              <Badge
                variant="secondary"
                className="ml-1.5 h-4 px-1.5 text-[10px] bg-emerald-500/20 text-emerald-300"
              >
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        )}

        {/* Count */}
        <div className="ml-auto text-xs text-muted-foreground hidden md:block">
          {selectedCount > 0 ? (
            <span className="text-emerald-300 font-medium">
              {selectedCount} selected
            </span>
          ) : (
            <>
              Showing{' '}
              <span className="text-foreground font-medium">{filteredCount}</span> of{' '}
              <span className="text-foreground font-medium">{totalInvoices}</span>
            </>
          )}
        </div>
      </div>

      {/* Active filter chips */}
      <AnimatePresence>
        {activeFilterCount > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 flex flex-wrap gap-1.5 overflow-hidden"
          >
            {filters.status !== 'all' && (
              <FilterChip
                label={`Status: ${STATUS_OPTIONS.find((s) => s.value === filters.status)?.label ?? filters.status}`}
                onRemove={() => update({ status: 'all' })}
              />
            )}
            {filters.paymentStatus !== 'all' && (
              <FilterChip
                label={`Payment: ${PAYMENT_OPTIONS.find((s) => s.value === filters.paymentStatus)?.label ?? filters.paymentStatus}`}
                onRemove={() => update({ paymentStatus: 'all' })}
              />
            )}
            {filters.clientId !== 'all' && (
              <FilterChip
                label={`Client: ${clients.find((c) => c.id === filters.clientId)?.tradeName ?? 'Selected'}`}
                onRemove={() => update({ clientId: 'all' })}
              />
            )}
            {filters.gstRate !== 'all' && (
              <FilterChip
                label={`GST: ${GST_RATE_OPTIONS.find((s) => s.value === filters.gstRate)?.label ?? filters.gstRate}`}
                onRemove={() => update({ gstRate: 'all' })}
              />
            )}
            {filters.risk !== 'all' && (
              <FilterChip
                label={`Risk: ${RISK_OPTIONS.find((s) => s.value === filters.risk)?.label ?? filters.risk}`}
                onRemove={() => update({ risk: 'all' })}
              />
            )}
            {(filters.dateFrom || filters.dateTo) && (
              <FilterChip
                label={`Date: ${filters.dateFrom || '…'} → ${filters.dateTo || '…'}`}
                onRemove={() => update({ dateFrom: '', dateTo: '' })}
              />
            )}
            {(filters.amountMin || filters.amountMax) && (
              <FilterChip
                label={`Amount: ₹${filters.amountMin || '0'} – ₹${filters.amountMax || '∞'}`}
                onRemove={() => update({ amountMin: '', amountMax: '' })}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-[11px] text-muted-foreground">
      <Star className="h-2.5 w-2.5 text-amber-400" />
      {label}
      <button
        onClick={onRemove}
        className="text-muted-foreground/60 hover:text-foreground"
        aria-label="Remove filter"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

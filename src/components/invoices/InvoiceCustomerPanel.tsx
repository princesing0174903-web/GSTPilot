'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — InvoiceCustomerPanel
//
// The LEFT card of the rebuilt Invoice Builder. Shows every customer field
// clearly without scrolling:
//   • Search customer (autocomplete, h-12 premium trigger)
//   • Business Name (free text — overrides the picked client's tradeName)
//   • GSTIN (auto-uppercased, drives Place of Supply + inter-state detection)
//   • State (derived from GSTIN first 2 digits — read-only badge)
//   • Place of Supply (select, auto from buyer GSTIN, override allowed)
//   • Email + Phone (auto-filled from client, editable)
//   • Payment Terms (Net 7/15/30/60/90 — drives Due Date)
//
// All inputs are LARGE (h-12 = 48px) with Label + Placeholder + Helper text
// + keyboard nav + visible focus states (blue ring).
// ═══════════════════════════════════════════════════════════════════════════════

import React from 'react';
import { Building2, UserPlus, Mail, Phone, MapPin, Landmark, CalendarClock } from 'lucide-react';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  SectionCard,
  FieldLabel,
  PremiumInput,
  HelperText,
  PREMIUM_SELECT_TRIGGER_CLASSNAMES,
  PREMIUM_SELECT_CONTENT_CLASSNAMES,
} from './builder/ui';
import { ClientCombobox } from './builder/ClientCombobox';
import { STATE_CODE_TO_NAME, STATE_LIST, PAYMENT_TERMS_OPTIONS } from './builder/constants';
import { stateCodeFromGstin, formatHumanDate } from './builder/gst';
import type { ApiClient } from './builder/types';

export interface InvoiceCustomerPanelProps {
  clients: ApiClient[];
  selectedClient: ApiClient | null;
  onSelectClient: (client: ApiClient) => void;
  onCreateClient?: () => void;

  businessName: string;
  onBusinessNameChange: (v: string) => void;

  buyerGstin: string;
  onBuyerGstinChange: (v: string) => void;

  placeOfSupply: string;
  onPlaceOfSupplyChange: (v: string) => void;

  email: string;
  onEmailChange: (v: string) => void;

  phone: string;
  onPhoneChange: (v: string) => void;

  paymentTermsDays: string;
  onPaymentTermsChange: (v: string) => void;

  dueDate: string;
}

export function InvoiceCustomerPanel({
  clients,
  selectedClient,
  onSelectClient,
  onCreateClient,
  businessName,
  onBusinessNameChange,
  buyerGstin,
  onBuyerGstinChange,
  placeOfSupply,
  onPlaceOfSupplyChange,
  email,
  onEmailChange,
  phone,
  onPhoneChange,
  paymentTermsDays,
  onPaymentTermsChange,
  dueDate,
}: InvoiceCustomerPanelProps) {
  // Derived state code shown as a read-only badge.
  const buyerStateCode = stateCodeFromGstin(buyerGstin);
  const buyerStateName = buyerStateCode ? STATE_CODE_TO_NAME[buyerStateCode] ?? '—' : '—';

  return (
    <SectionCard
      icon={<Building2 className="h-5 w-5" />}
      title="Customer Information"
      description="Pick a customer — GSTIN, state, and contact auto-fill. Override anything inline."
      right={
        <button
          type="button"
          onClick={() =>
            onCreateClient
              ? onCreateClient()
              : toast.info('Open the Customers module to add a new client.', {
                  description: 'New customers appear here instantly.',
                })
          }
          className="gst-btn gst-btn-ghost gst-btn-sm"
        >
          <UserPlus className="h-3.5 w-3.5" />
          New
        </button>
      }
    >
      {/* ── Search ─────────────────────────────────────────────────────────── */}
      <ClientCombobox
        clients={clients}
        value={selectedClient}
        onSelect={onSelectClient}
        onCreateClient={onCreateClient}
      />

      {/* ── Business name + GSTIN ─────────────────────────────────────────── */}
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <FieldLabel htmlFor="cust-biz-name" required>
            Business Name
          </FieldLabel>
          <PremiumInput
            id="cust-biz-name"
            value={businessName}
            onChange={(e) => onBusinessNameChange(e.target.value)}
            placeholder="e.g. Acme Industries Pvt. Ltd."
            autoComplete="organization"
          />
          <HelperText>Shown as the Bill-To on the invoice.</HelperText>
        </div>
        <div>
          <FieldLabel htmlFor="cust-gstin" hint="first 2 digits drive Place of Supply">
            GSTIN
          </FieldLabel>
          <PremiumInput
            id="cust-gstin"
            value={buyerGstin}
            onChange={(e) => onBuyerGstinChange(e.target.value.toUpperCase())}
            placeholder="29ABCDE1234F1Z5"
            maxLength={15}
            className="font-mono uppercase tracking-wide"
            autoComplete="off"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={cn(
                'border-[#2A2E36] bg-[#0F1115] text-[12px]',
                buyerStateCode ? 'text-[#60A5FA]' : 'text-muted-foreground',
              )}
            >
              <MapPin className="h-3 w-3" />
              {buyerStateCode ? `${buyerStateName} (${buyerStateCode})` : '— No state detected'}
            </Badge>
            {buyerGstin && buyerGstin.length === 15 ? (
              <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-[12px] text-emerald-300">
                <Landmark className="h-3 w-3" />
                15 chars · valid length
              </Badge>
            ) : null}
          </div>
        </div>
      </div>

      {/* ── Place of Supply + Payment Terms ──────────────────────────────── */}
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <FieldLabel hint="auto from buyer GSTIN" htmlFor="cust-pos">
            Place of Supply
          </FieldLabel>
          <Select
            value={placeOfSupply || '__none__'}
            onValueChange={(v) => onPlaceOfSupplyChange(v === '__none__' ? '' : v)}
          >
            <SelectTrigger id="cust-pos" className={cn(PREMIUM_SELECT_TRIGGER_CLASSNAMES, 'w-full')}>
              <SelectValue placeholder="Select state" />
            </SelectTrigger>
            <SelectContent className={PREMIUM_SELECT_CONTENT_CLASSNAMES}>
              <SelectItem value="__none__" className="focus:bg-[#2563EB]/10">
                — Auto (from GSTIN) —
              </SelectItem>
              {STATE_LIST.map((s) => (
                <SelectItem key={s.code} value={s.code} className="focus:bg-[#2563EB]/10 focus:text-[#60A5FA]">
                  {s.name} ({s.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <HelperText>Determines CGST+SGST vs IGST along with seller state.</HelperText>
        </div>
        <div>
          <FieldLabel htmlFor="cust-terms">Payment Terms</FieldLabel>
          <Select value={paymentTermsDays} onValueChange={onPaymentTermsChange}>
            <SelectTrigger id="cust-terms" className={cn(PREMIUM_SELECT_TRIGGER_CLASSNAMES, 'w-full')}>
              <SelectValue placeholder="Net 30" />
            </SelectTrigger>
            <SelectContent className={PREMIUM_SELECT_CONTENT_CLASSNAMES}>
              {PAYMENT_TERMS_OPTIONS.map((t) => (
                <SelectItem key={t.value} value={t.value} className="focus:bg-[#2563EB]/10 focus:text-[#60A5FA]">
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <HelperText>
            <CalendarClock className="mr-1 inline h-3 w-3" />
            Due date auto-set to{' '}
            <span className="font-medium text-foreground">{formatHumanDate(dueDate)}</span>.
          </HelperText>
        </div>
      </div>

      {/* ── Email + Phone ─────────────────────────────────────────────────── */}
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <FieldLabel htmlFor="cust-email">Email</FieldLabel>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <PremiumInput
              id="cust-email"
              type="email"
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
              placeholder="billing@acme.com"
              autoComplete="email"
              className="pl-10"
            />
          </div>
          <HelperText>Used to send the invoice when you click “Save &amp; Send”.</HelperText>
        </div>
        <div>
          <FieldLabel htmlFor="cust-phone">Phone</FieldLabel>
          <div className="relative">
            <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <PremiumInput
              id="cust-phone"
              type="tel"
              value={phone}
              onChange={(e) => onPhoneChange(e.target.value)}
              placeholder="+91 98765 43210"
              autoComplete="tel"
              className="pl-10"
            />
          </div>
          <HelperText>Optional — used by the WhatsApp send action.</HelperText>
        </div>
      </div>
    </SectionCard>
  );
}

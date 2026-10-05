'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Landmark, CheckCircle2, Building2, Smartphone } from 'lucide-react';
import { toast } from 'sonner';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Connect Bank — Premium Modal
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Directive STEP 2 (Connect Bank flow) + STEP 3 (premium dialog, no browser prompts).
 *
 * Step 1: Choose Bank (HDFC, ICICI, Axis, SBI, Kotak, PNB, Federal, IDFC, Yes, Other)
 * Step 2: Enter account details (holder, number, IFSC, type)
 * Step 3: POST /api/banking/connect → real persistence → status = Connected
 *
 * On success the parent refreshes state so Connected Services + Cash Position
 * reflect the new bank immediately.
 */

interface ConnectBankModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnected?: () => void;
  organizationId?: string | null;
  userId?: string | null;
  userName?: string | null;
  userEmail?: string | null;
}

// Provider selection: 'mock' = instant Sandbox connect; 'setu' = real Setu AA consent flow.
type ConnectProvider = 'mock' | 'setu';

const BANKS = [
  { id: 'hdfc', name: 'HDFC Bank', color: '#004C8F' },
  { id: 'icici', name: 'ICICI Bank', color: '#AE282E' },
  { id: 'axis', name: 'Axis Bank', color: '#97144D' },
  { id: 'sbi', name: 'State Bank of India', color: '#1E4D8C' },
  { id: 'kotak', name: 'Kotak Mahindra', color: '#ED1C24' },
  { id: 'pnb', name: 'Punjab National Bank', color: '#B5904C' },
  { id: 'federal', name: 'Federal Bank', color: '#1B5E20' },
  { id: 'idfc', name: 'IDFC FIRST Bank', color: '#0E4D92' },
  { id: 'yes', name: 'YES Bank', color: '#7B2D8E' },
  { id: 'other', name: 'Other Bank', color: '#475569' },
] as const;

const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;

export function ConnectBankModal({
  open,
  onOpenChange,
  onConnected,
  organizationId,
  userId,
  userName,
  userEmail,
}: ConnectBankModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [connectProvider, setConnectProvider] = useState<ConnectProvider>('mock');
  const [selectedBank, setSelectedBank] = useState<(typeof BANKS)[number] | null>(null);
  const [holder, setHolder] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [accountType, setAccountType] = useState<'savings' | 'current'>('savings');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset when modal opens.
  React.useEffect(() => {
    if (open) {
      setStep(1);
      setConnectProvider('mock');
      setSelectedBank(null);
      setHolder('');
      setAccountNumber('');
      setIfsc('');
      setAccountType('savings');
      setError(null);
      setSaving(false);
    }
  }, [open]);

  // For the Setu AA flow, `accountNumber` carries the mobile number (VUA).
  const isSetu = connectProvider === 'setu';
  const ifscValid = isSetu ? true : IFSC_REGEX.test(ifsc.trim().toUpperCase());
  const holderValid = holder.trim().length >= 2;
  const accountValid = isSetu
    ? /^\d{10}$/.test(accountNumber.trim())
    : accountNumber.trim().length >= 9;
  const formValid = ifscValid && holderValid && accountValid;

  const handleConnect = async () => {
    if (!selectedBank || !formValid) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/banking/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId,
          provider: connectProvider, // 'mock' = instant; 'setu' = AA consent redirect
          accountHolder: holder.trim(),
          bankName: selectedBank.name,
          // For Setu AA, accountNumber carries the mobile number (VUA).
          accountNumber: accountNumber.trim(),
          ifsc: isSetu ? 'NA' : ifsc.trim().toUpperCase(),
          accountType,
          createdBy: {
            uid: userId ?? 'unknown',
            name: userName ?? 'User',
            email: userEmail ?? '',
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        throw new Error(data?.error || `Could not connect bank (${res.status}).`);
      }

      // AA flow: if a redirectUrl is present, the connection is deferred —
      // open the Setu consent webview in a new tab.
      if (data.result?.redirectUrl) {
        window.open(data.result.redirectUrl, '_blank', 'noopener,noreferrer');
        toast.info('Consent Required', {
          description:
            'A new tab opened for Setu consent approval. Approve the data-sharing request, then return here — your bank connection will complete automatically.',
          duration: 8000,
        });
        onConnected?.();
        onOpenChange(false);
        return;
      }

      toast.success('Bank Connected', {
        description: `${selectedBank.name} account linked successfully.`,
      });
      onConnected?.();
      onOpenChange(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'We could not connect your bank. Please try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="flex items-center justify-center h-9 w-9 rounded-xl accent-gradient-soft">
              <Landmark className="h-4 w-4 accent-text" />
            </div>
            <div>
              <DialogTitle className="text-base">
                Connect Bank {step === 2 && `· ${selectedBank?.name}`}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {step === 1
                  ? 'Choose your bank to link your account and sync transactions.'
                  : 'Enter your account details to complete the connection.'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-1.5 px-1">
          <div className={`h-1 flex-1 rounded-full ${step >= 1 ? 'accent-gradient' : 'bg-white/[0.06]'}`} />
          <div className={`h-1 flex-1 rounded-full ${step >= 2 ? 'accent-gradient' : 'bg-white/[0.06]'}`} />
        </div>

        {step === 1 && (
          <div className="space-y-3 py-2">
            {/* Provider toggle: Sandbox (Mock) vs Setu AA */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setConnectProvider('mock')}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition-all ${
                  connectProvider === 'mock'
                    ? 'border-blue-500/40 bg-blue-500/[0.06]'
                    : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]'
                }`}
              >
                <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-blue-500/10 shrink-0">
                  <Building2 className="h-3.5 w-3.5 text-blue-400" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-medium text-foreground">Sandbox</div>
                  <div className="text-[10px] text-muted-foreground">Instant demo connect</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setConnectProvider('setu')}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition-all ${
                  connectProvider === 'setu'
                    ? 'border-blue-500/40 bg-blue-500/[0.06]'
                    : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]'
                }`}
              >
                <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-blue-500/10 shrink-0">
                  <Smartphone className="h-3.5 w-3.5 text-blue-400" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-medium text-foreground">Setu AA</div>
                  <div className="text-[10px] text-muted-foreground">Real bank consent</div>
                </div>
              </button>
            </div>

            {isSetu && (
              <div className="rounded-lg border border-blue-500/20 bg-blue-500/[0.04] px-3 py-2">
                <p className="text-[11px] text-blue-300/80 leading-relaxed">
                  Setu Account Aggregator uses your mobile number to initiate a
                  consent flow. You will be redirected to Setu's secure webview to
                  approve data sharing. Requires Setu sandbox credentials.
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 max-h-[260px] overflow-y-auto custom-scrollbar pr-1">
              {BANKS.map((bank) => (
                <button
                  key={bank.id}
                  type="button"
                  onClick={() => setSelectedBank(bank)}
                  className={`flex items-center gap-2.5 rounded-xl border px-3 py-3 text-left transition-all ${
                    selectedBank?.id === bank.id
                      ? 'border-blue-500/40 bg-blue-500/[0.06]'
                      : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]'
                  }`}
                >
                  <div
                    className="flex items-center justify-center h-8 w-8 rounded-lg shrink-0"
                    style={{ backgroundColor: `${bank.color}20`, color: bank.color }}
                  >
                    <Building2 className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-medium text-foreground truncate flex-1">
                    {bank.name}
                  </span>
                  {selectedBank?.id === bank.id && (
                    <CheckCircle2 className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3.5 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="bank-holder" className="text-xs">
                Account Holder Name <span className="text-red-400">*</span>
              </Label>
              <Input
                id="bank-holder"
                value={holder}
                onChange={(e) => setHolder(e.target.value)}
                placeholder="As per bank records"
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bank-number" className="text-xs">
                {isSetu ? (
                  <span className="flex items-center gap-1">
                    Mobile Number (VUA) <span className="text-red-400">*</span>
                  </span>
                ) : (
                  <span>
                    Account Number <span className="text-red-400">*</span>
                  </span>
                )}
              </Label>
              <Input
                id="bank-number"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value.replace(/\s/g, ''))}
                placeholder={isSetu ? '10-digit mobile number' : 'XXXXXXXXXX'}
                inputMode="numeric"
                maxLength={isSetu ? 10 : undefined}
                className="text-sm font-mono tracking-wider"
              />
              {isSetu && (
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  The mobile number registered with your bank / Account Aggregator.
                </p>
              )}
            </div>
            {!isSetu && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="bank-ifsc" className="text-xs">
                    IFSC <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    id="bank-ifsc"
                    value={ifsc}
                    onChange={(e) => setIfsc(e.target.value.toUpperCase())}
                    placeholder="HDFC0001234"
                    maxLength={11}
                    autoCapitalize="characters"
                    className="text-sm font-mono tracking-wider"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Account Type</Label>
                  <Select
                    value={accountType}
                    onValueChange={(v) => setAccountType(v as 'savings' | 'current')}
                  >
                    <SelectTrigger className="text-sm h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="savings">Savings</SelectItem>
                      <SelectItem value="current">Current</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            {isSetu && (
              <div className="rounded-lg border border-blue-500/20 bg-blue-500/[0.04] px-3 py-2">
                <p className="text-[11px] text-blue-300/80 leading-relaxed">
                  After clicking “Connect Bank”, a new tab will open for Setu consent
                  approval. Approve the data-sharing request there, then return to
                  GSTPilot — your bank connection will complete automatically.
                </p>
              </div>
            )}
            {error && (
              <p className="text-xs text-red-400 leading-relaxed">{error}</p>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => (step === 2 ? setStep(1) : onOpenChange(false))}
            disabled={saving}
            className="border-border"
          >
            {step === 2 ? 'Back' : 'Cancel'}
          </Button>
          {step === 1 ? (
            <Button
              onClick={() => setStep(2)}
              disabled={!selectedBank}
              className="accent-gradient text-white hover:opacity-90 gap-1.5"
            >
              Continue
            </Button>
          ) : (
            <Button
              onClick={handleConnect}
              disabled={!formValid || saving}
              className="accent-gradient text-white hover:opacity-90 gap-1.5"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Landmark className="h-3.5 w-3.5" />
              )}
              Connect Bank
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ConnectBankModal;

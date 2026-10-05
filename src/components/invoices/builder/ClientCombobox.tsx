'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — Invoice Builder · Client Combobox
//
// Searchable client picker (Popover + Command). Premium h-12 trigger, large
// list rows, health-pill, GSTIN-verified badge, and an inline "Add new client"
// CTA at the bottom. Falls back to a typed Customer name when no client is
// picked (the invoice still needs a Bill-To before save).
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useMemo, useState } from 'react';
import { Building2, Search, UserPlus, ShieldCheck, Mail, Phone, MapPin } from 'lucide-react';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover';
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { healthTone } from './gst';
import type { ApiClient } from './types';

export function ClientCombobox({
  clients,
  value,
  onSelect,
  onCreateClient,
}: {
  clients: ApiClient[];
  value: ApiClient | null;
  onSelect: (client: ApiClient) => void;
  onCreateClient?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) =>
      [c.tradeName, c.legalName, c.gstin, c.state]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }, [clients, query]);

  return (
    <div className="flex flex-col gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-label="Search customer"
            className={cn(
              'group flex h-12 w-full items-center justify-between gap-2 rounded-lg border border-[#2A2E36] bg-[#0F1115] px-3.5 text-left',
              'transition-all hover:border-[#2563EB]/40 hover:bg-[#171A21]',
              'focus:outline-none focus:ring-2 focus:ring-[#2563EB]/50 focus:border-[#2563EB]',
              value ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            <span className="flex min-w-0 items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#2563EB]/10 text-[#60A5FA] ring-1 ring-[#2563EB]/25">
                <Building2 className="h-4 w-4" />
              </span>
              <span className="min-w-0 truncate text-[15px]">
                {value ? (
                  <>
                    <span className="font-semibold text-foreground">{value.tradeName}</span>
                    {value.gstin ? (
                      <span className="ml-2 font-mono text-[12px] text-muted-foreground">
                        {value.gstin}
                      </span>
                    ) : null}
                  </>
                ) : (
                  'Search customer by name or GSTIN…'
                )}
              </span>
            </span>
            <Search className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-[#60A5FA]" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[--radix-popover-trigger-width] min-w-[340px] border-[#2A2E36] bg-[#171A21]/95 p-0 backdrop-blur-xl"
        >
          <Command shouldFilter={false} className="bg-transparent">
            <CommandInput
              placeholder="Type a name or GSTIN…"
              value={query}
              onValueChange={setQuery}
              className="text-[15px]"
            />
            <CommandList className="max-h-[320px]">
              <CommandEmpty className="py-6 text-center text-[13px] text-muted-foreground">
                No customers match “{query}”.
              </CommandEmpty>
              <CommandGroup heading="Customers" className="text-zinc-300">
                {filtered.map((c) => {
                  const tone = healthTone(c.healthScore ?? 0);
                  return (
                    <CommandItem
                      key={c.id}
                      value={c.id}
                      onSelect={() => {
                        onSelect(c);
                        setOpen(false);
                        setQuery('');
                      }}
                      className="gap-3 py-2.5 text-zinc-200 data-[selected=true]:bg-[#2563EB]/10 data-[selected=true]:text-[#60A5FA]"
                    >
                      <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-[14px] font-medium">
                          {c.tradeName}
                          {c.legalName && c.legalName !== c.tradeName ? (
                            <span className="ml-1.5 text-[12px] text-muted-foreground">
                              · {c.legalName}
                            </span>
                          ) : null}
                        </span>
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                          {c.gstin ? <span className="font-mono">{c.gstin}</span> : null}
                          {c.state ? (
                            <span className="inline-flex items-center gap-0.5">
                              <MapPin className="h-3 w-3" />
                              {c.state}
                            </span>
                          ) : null}
                          {c.contactEmail ? (
                            <span className="inline-flex items-center gap-0.5">
                              <Mail className="h-3 w-3" />
                              {c.contactEmail}
                            </span>
                          ) : null}
                          {c.contactPhone ? (
                            <span className="inline-flex items-center gap-0.5">
                              <Phone className="h-3 w-3" />
                              {c.contactPhone}
                            </span>
                          ) : null}
                        </span>
                      </span>
                      <span
                        className={cn(
                          'rounded-md border px-1.5 py-0.5 text-[10px] font-semibold',
                          tone.className,
                        )}
                      >
                        {tone.label}
                      </span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
            <div className="border-t border-[#2A2E36] p-2">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  if (onCreateClient) onCreateClient();
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-[13px] font-medium text-[#60A5FA] transition-colors hover:bg-[#2563EB]/10"
              >
                <UserPlus className="h-4 w-4" />
                Add new customer
              </button>
            </div>
          </Command>
        </PopoverContent>
      </Popover>

      {value ? (
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="border-[#2563EB]/30 bg-[#2563EB]/10 text-[#60A5FA]">
            <ShieldCheck className="h-3 w-3" />
            {value.gstin ? 'GSTIN verified' : 'No GSTIN'}
          </Badge>
          <Badge
            variant="outline"
            className={cn('border-[#2A2E36]', healthTone(value.healthScore ?? 0).className)}
          >
            Health {value.healthScore ?? 0}/100 · {healthTone(value.healthScore ?? 0).label}
          </Badge>
          {value.contactEmail ? (
            <span className="inline-flex items-center gap-1 text-[12px] text-muted-foreground">
              <Mail className="h-3 w-3" />
              {value.contactEmail}
            </span>
          ) : null}
          {value.contactPhone ? (
            <span className="inline-flex items-center gap-1 text-[12px] text-muted-foreground">
              <Phone className="h-3 w-3" />
              {value.contactPhone}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

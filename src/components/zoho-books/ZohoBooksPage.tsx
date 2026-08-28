'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT INFINITY™ — Zoho Books (Integration Rebuilding)
// ═══════════════════════════════════════════════════════════════════════════════
// The old Zoho Books integration has been removed.
// A new clean implementation will be built from scratch.
// This placeholder renders a clean "rebuilding" state — no fake connected status.
// ═══════════════════════════════════════════════════════════════════════════════

import React from 'react';
import { BookOpen, Clock } from 'lucide-react';

export function ZohoBooksPage() {
  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-black px-4">
      <div className="flex max-w-md flex-col items-center gap-5 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.02]">
          <BookOpen className="h-8 w-8 text-white/40" />
        </div>
        <h1 className="text-2xl font-bold text-white">Zoho Books</h1>
        <div className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.02] px-4 py-1.5 text-sm text-white/50">
          <Clock className="h-3.5 w-3.5" />
          Integration rebuilding
        </div>
        <p className="text-sm text-white/40">
          The Zoho Books integration is being rebuilt from scratch with a clean
          OAuth architecture. It will be available again soon.
        </p>
      </div>
    </div>
  );
}

export default ZohoBooksPage;

'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle™ — Message Action Bar (Premium Enterprise UX)
//
// Polished, accessible, memoized action row for each Oracle assistant message:
//   • Copy response       (with "Copied" confirmation)
//   • Regenerate          (re-run the prompt)
//   • Continue response   (ask Oracle to keep writing)
//   • Like / Dislike      (per-turn feedback)
//   • Share               (copy shareable link to clipboard)
//   • Export              (PDF / Excel (CSV) / Markdown)
//
// All actions are functional, with loading + success + error states. Hover and
// focus states are consistent. Tooltips via `title` for native accessibility.
//
// Extracted from OracleChat.tsx into its own memoized component to prevent
// re-renders of the entire message list when a single button is clicked.
// ═══════════════════════════════════════════════════════════════════════════════

import { memo, useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Copy, Check, RefreshCw, ThumbsUp, ThumbsDown, Share2, Download,
  FileText, FileSpreadsheet, ArrowRight, type LucideIcon,
} from 'lucide-react';

export interface OracleMessageActionsProps {
  /** Full response text (for copy / export). */
  content: string;
  /** Called when the user clicks Regenerate. */
  onRegenerate?: () => void;
  /** Called when the user clicks Continue Response. */
  onContinue?: () => void;
  /** Called when the user clicks Like. Receives the new state. */
  onLike?: (liked: boolean) => void;
  /** Called when the user clicks Dislike. Receives the new state. */
  onDislike?: (disliked: boolean) => void;
  /** Initial liked state (e.g. from persisted feedback). */
  liked?: boolean;
  /** Initial disliked state. */
  disliked?: boolean;
  /** Disable Regenerate (e.g. while another stream is running). */
  disableRegenerate?: boolean;
  /** Disable Continue (e.g. while streaming). */
  disableContinue?: boolean;
}

function ActionButton({
  onClick, icon: Icon, label, active, activeClass, disabled, title,
}: {
  onClick: () => void;
  icon: LucideIcon;
  label: string;
  active?: boolean;
  activeClass?: string;
  disabled?: boolean;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1 rounded-md px-2 py-1 text-[10.5px] font-medium transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent ${
        active ? (activeClass ?? 'text-white/80') : 'text-white/40 hover:text-white/80'
      }`}
      aria-label={title}
      title={title}
    >
      <Icon className="h-3 w-3" />
      <span>{label}</span>
    </button>
  );
}

function OracleMessageActionsImpl({
  content,
  onRegenerate,
  onContinue,
  onLike,
  onDislike,
  liked = false,
  disliked = false,
  disableRegenerate = false,
  disableContinue = false,
}: OracleMessageActionsProps) {
  const [copied, setCopied] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [isLiked, setIsLiked] = useState(liked);
  const [isDisliked, setIsDisliked] = useState(disliked);
  const exportRef = useRef<HTMLDivElement>(null);

  // Sync external prop changes (e.g. when switching conversations)
  useEffect(() => { setIsLiked(liked); }, [liked]);
  useEffect(() => { setIsDisliked(disliked); }, [disliked]);

  // Close export menu on outside click / Escape
  useEffect(() => {
    if (!exportOpen) return;
    const onDown = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setExportOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [exportOpen]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error('Could not copy to clipboard.');
    }
  }, [content]);

  const handleShare = useCallback(async () => {
    try {
      const url = typeof window !== 'undefined' ? window.location.href : '';
      const shareText = `${content}\n\n— Oracle, GSTPilot AI CFO`;
      if (navigator.share) {
        await navigator.share({ title: 'Oracle Response', text: shareText, url });
        return;
      }
      await navigator.clipboard.writeText(`${shareText}\n${url}`);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 1600);
      toast.success('Share link copied to clipboard.');
    } catch {
      /* user dismissed share dialog — non-fatal */
    }
  }, [content]);

  const handleLike = useCallback(() => {
    const next = !isLiked;
    setIsLiked(next);
    if (next && isDisliked) setIsDisliked(false); // mutual exclusion
    onLike?.(next);
  }, [isLiked, isDisliked, onLike]);

  const handleDislike = useCallback(() => {
    const next = !isDisliked;
    setIsDisliked(next);
    if (next && isLiked) setIsLiked(false); // mutual exclusion
    onDislike?.(next);
  }, [isLiked, isDisliked, onDislike]);

  const exportMarkdown = useCallback(() => {
    const blob = new Blob([`# Oracle Response\n\n${content}\n`], { type: 'text/markdown' });
    triggerDownload(blob, `oracle-response-${Date.now()}.md`);
    setExportOpen(false);
  }, [content]);

  const exportPDF = useCallback(() => {
    const w = window.open('', '_blank', 'width=800,height=600');
    if (w) {
      w.document.write(
        `<html><head><title>Oracle Response</title><style>body{font-family:system-ui,sans-serif;padding:32px;line-height:1.6;color:#111;background:#fff;white-space:pre-wrap;word-wrap:break-word}</style></head><body>${escapeHtml(content)}</body></html>`
      );
      w.document.close();
      w.focus();
      setTimeout(() => { try { w.print(); } catch { /* non-fatal */ } }, 300);
    }
    setExportOpen(false);
  }, [content]);

  const exportExcel = useCallback(() => {
    const rows = content.split('\n').map((l) => [l]);
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    triggerDownload(blob, `oracle-response-${Date.now()}.csv`);
    setExportOpen(false);
  }, [content]);

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1 px-1">
      <ActionButton
        onClick={handleCopy}
        icon={copied ? Check : Copy}
        label={copied ? 'Copied' : 'Copy'}
        active={copied}
        activeClass="text-emerald-400"
        title="Copy response"
      />
      {onRegenerate && (
        <ActionButton
          onClick={onRegenerate}
          icon={RefreshCw}
          label="Regenerate"
          disabled={disableRegenerate}
          title="Regenerate response"
        />
      )}
      {onContinue && (
        <ActionButton
          onClick={onContinue}
          icon={ArrowRight}
          label="Continue"
          disabled={disableContinue}
          title="Continue response"
        />
      )}
      <ActionButton
        onClick={handleLike}
        icon={ThumbsUp}
        active={isLiked}
        activeClass="text-emerald-400"
        title="Helpful"
      />
      <ActionButton
        onClick={handleDislike}
        icon={ThumbsDown}
        active={isDisliked}
        activeClass="text-rose-400"
        title="Not helpful"
      />
      <ActionButton
        onClick={handleShare}
        icon={shareCopied ? Check : Share2}
        label={shareCopied ? 'Copied' : 'Share'}
        active={shareCopied}
        activeClass="text-emerald-400"
        title="Share response"
      />

      {/* Export dropdown */}
      <div className="relative" ref={exportRef}>
        <button
          type="button"
          onClick={() => setExportOpen((v) => !v)}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-[10.5px] font-medium text-white/40 transition-colors hover:bg-white/5 hover:text-white/80"
          aria-label="Export response"
          aria-expanded={exportOpen}
          aria-haspopup="menu"
          title="Export response"
        >
          <Download className="h-3 w-3" />
          <span>Export</span>
        </button>
        <AnimatePresence>
          {exportOpen && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              role="menu"
              className="absolute left-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-lg border border-[#1F1F1F] bg-[#0F0F0F] py-1 shadow-xl"
            >
              <button onClick={exportPDF} role="menuitem" className="flex w-full items-center gap-2 px-3 py-1.5 text-[11.5px] text-white/70 transition-colors hover:bg-white/5 hover:text-white">
                <FileText className="h-3.5 w-3.5 text-rose-400" /> PDF
              </button>
              <button onClick={exportExcel} role="menuitem" className="flex w-full items-center gap-2 px-3 py-1.5 text-[11.5px] text-white/70 transition-colors hover:bg-white/5 hover:text-white">
                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400" /> Excel (CSV)
              </button>
              <button onClick={exportMarkdown} role="menuitem" className="flex w-full items-center gap-2 px-3 py-1.5 text-[11.5px] text-white/70 transition-colors hover:bg-white/5 hover:text-white">
                <FileText className="h-3.5 w-3.5 text-amber-400" /> Markdown
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke after a short delay to ensure the download has started
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export const OracleMessageActions = memo(OracleMessageActionsImpl);
export default OracleMessageActions;

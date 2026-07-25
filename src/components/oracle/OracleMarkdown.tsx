'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle™ — Premium Markdown Renderer
//
// ChatGPT Enterprise + Claude level markdown rendering for Oracle responses.
//   • Full GFM support (tables, strikethrough, task lists, autolinks)
//   • Premium tables: zebra striping, sticky header, hover highlight, amber headers
//   • Code blocks with copy button + language label
//   • Headings, lists, blockquotes, inline code — all gold-accented
//   • Streaming-safe: smooth blinking caret that never flickers
//   • Memoized components for 60 FPS during streaming
//
// Used by OracleChat to render Oracle's responses with professional typography.
// ═══════════════════════════════════════════════════════════════════════════════

import { memo, useState, type ReactNode, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Check, Copy } from 'lucide-react';

interface OracleMarkdownProps {
  content: string;
  /** When true, shows a smooth blinking caret at the end (streaming in progress). */
  streaming?: boolean;
}

// ─── Code block with copy button ─────────────────────────────────────────────

const CodeBlock = memo(function CodeBlock({ children, language }: { children: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(children);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked — non-fatal */
    }
  }, [children]);

  return (
    <div className="group relative my-3 overflow-hidden rounded-xl border border-[#232323] bg-[#0B0B0B]">
      <div className="flex items-center justify-between border-b border-[#1A1A1A] bg-[#101010] px-3 py-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
          {language || 'code'}
        </span>
        <button
          onClick={copy}
          className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium text-white/40 transition-colors hover:bg-white/5 hover:text-white/70 focus:outline-none focus:ring-1 focus:ring-amber-500/40"
          aria-label="Copy code"
          title="Copy code"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-emerald-400" strokeWidth={2.5} />
              <span className="text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 text-[12.5px] leading-relaxed">
        <code className="font-mono text-amber-100/90">{children}</code>
      </pre>
    </div>
  );
});

// ─── Inline node renderer (memoized for streaming performance) ───────────────

const components = {
  h1: ({ children }: { children?: ReactNode }) => (
    <h1 className="mt-4 mb-2 text-[20px] font-bold tracking-tight text-white first:mt-0">{children}</h1>
  ),
  h2: ({ children }: { children?: ReactNode }) => (
    <h2 className="mt-4 mb-2 text-[17px] font-bold tracking-tight text-white first:mt-0">{children}</h2>
  ),
  h3: ({ children }: { children?: ReactNode }) => (
    <h3 className="mt-3 mb-1.5 text-[15px] font-semibold tracking-tight text-white first:mt-0">{children}</h3>
  ),
  h4: ({ children }: { children?: ReactNode }) => (
    <h4 className="mt-3 mb-1 text-[14px] font-semibold text-white/90 first:mt-0">{children}</h4>
  ),
  p: ({ children }: { children?: ReactNode }) => (
    <p className="my-2 text-[14px] leading-relaxed text-white/90 first:mt-0 last:mb-0">{children}</p>
  ),
  ul: ({ children }: { children?: ReactNode }) => (
    <ul className="my-2 space-y-1.5 pl-1">{children}</ul>
  ),
  ol: ({ children }: { children?: ReactNode }) => (
    <ol className="my-2 space-y-1.5 pl-1 list-decimal list-inside marker:text-amber-400/70">{children}</ol>
  ),
  li: ({ children, ...props }: { children?: ReactNode; checked?: boolean | null }) => {
    // Task list item
    if (props.checked !== null && props.checked !== undefined) {
      return (
        <li className="flex items-start gap-2 text-[14px] leading-relaxed text-white/90">
          <span
            className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
              props.checked ? 'border-amber-500 bg-amber-500/20' : 'border-white/20 bg-transparent'
            }`}
          >
            {props.checked && <Check className="h-3 w-3 text-amber-400" strokeWidth={3} />}
          </span>
          <span className={props.checked ? 'text-white/50 line-through' : 'text-white/90'}>{children}</span>
        </li>
      );
    }
    return (
      <li className="flex items-start gap-2 text-[14px] leading-relaxed text-white/90">
        <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-amber-400/70" />
        <span className="flex-1">{children}</span>
      </li>
    );
  },
  strong: ({ children }: { children?: ReactNode }) => (
    <strong className="font-semibold text-white">{children}</strong>
  ),
  em: ({ children }: { children?: ReactNode }) => (
    <em className="italic text-white/80">{children}</em>
  ),
  del: ({ children }: { children?: ReactNode }) => (
    <del className="text-white/50 line-through">{children}</del>
  ),
  a: ({ children, href }: { children?: ReactNode; href?: string }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-amber-400 underline decoration-amber-400/40 underline-offset-2 transition-colors hover:text-amber-300 hover:decoration-amber-300"
    >
      {children}
    </a>
  ),
  blockquote: ({ children }: { children?: ReactNode }) => (
    <blockquote className="my-3 border-l-2 border-amber-500/40 bg-amber-500/[0.04] py-2 pl-3 pr-2 rounded-r-lg">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-4 border-t border-[#1F1F1F]" />,
  code: ({
    children,
    className,
  }: {
    children?: ReactNode;
    className?: string;
    inline?: boolean;
  }) => {
    // Extract language from className (e.g. "language-js")
    const match = /language-(\w+)/.exec(className || '');
    const text = String(children ?? '').replace(/\n$/, '');

    // Block code (has language or contains newline) → render CodeBlock
    if (match || text.includes('\n')) {
      return <CodeBlock language={match?.[1]}>{text}</CodeBlock>;
    }

    // Inline code
    return (
      <code className="rounded-md bg-amber-500/10 px-1.5 py-0.5 font-mono text-[12.5px] text-amber-200 ring-1 ring-amber-500/15">
        {children}
      </code>
    );
  },
  pre: ({ children }: { children?: ReactNode }) => <>{children}</>,
  // ── Premium tables ──
  table: ({ children }: { children?: ReactNode }) => (
    <div className="my-3 overflow-x-auto rounded-xl border border-[#232323] bg-[#0D0D0D] shadow-sm">
      <table className="w-full border-collapse text-[13px]">{children}</table>
    </div>
  ),
  thead: ({ children }: { children?: ReactNode }) => (
    <thead className="sticky top-0 z-10 bg-[#161208]">{children}</thead>
  ),
  th: ({ children }: { children?: ReactNode }) => (
    <th className="border-b border-amber-500/20 px-3.5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-amber-300/90 backdrop-blur-sm">
      {children}
    </th>
  ),
  td: ({ children }: { children?: ReactNode }) => (
    <td className="border-b border-[#1A1A1A] px-3.5 py-2 text-white/80">{children}</td>
  ),
  tr: ({ children }: { children?: ReactNode }) => (
    <tr className="transition-colors even:bg-white/[0.015] hover:bg-amber-500/[0.04]">{children}</tr>
  ),
};

// ─── Component ────────────────────────────────────────────────────────────────

function OracleMarkdownImpl({ content, streaming }: OracleMarkdownProps) {
  return (
    <div className="oracle-markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
      {streaming && (
        <span
          className="oracle-caret ml-0.5 inline-block h-4 w-[7px] translate-y-0.5 rounded-sm bg-amber-400 align-middle"
          aria-hidden="true"
        />
      )}
    </div>
  );
}

export const OracleMarkdown = memo(OracleMarkdownImpl);
export default OracleMarkdown;

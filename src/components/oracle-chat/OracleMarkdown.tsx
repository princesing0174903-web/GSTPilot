'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// ORACLE CHAT — Premium Markdown Renderer
// ═══════════════════════════════════════════════════════════════════════════════
// Renders Oracle's markdown with premium styling: tables, code blocks,
// inline code, lists, blockquotes, and emphasized text. Uses react-markdown
// with a custom components mapping.
// ═══════════════════════════════════════════════════════════════════════════════

import ReactMarkdown from 'react-markdown';
import { memo, useState } from 'react';
import { Check, Copy, ChevronRight } from 'lucide-react';

export const OracleMarkdown = memo(function OracleMarkdown({ content }: { content: string }) {
  return (
    <div className="oracle-markdown text-[15px] leading-relaxed text-zinc-200">
      <ReactMarkdown
        components={{
          h1: ({ children }) => <h1 className="mt-5 mb-3 text-2xl font-bold text-white first:mt-0">{children}</h1>,
          h2: ({ children }) => (
            <h2 className="mt-5 mb-2.5 flex items-center gap-2 text-lg font-semibold text-white first:mt-0">
              <ChevronRight className="h-4 w-4 text-emerald-400" />
              {children}
            </h2>
          ),
          h3: ({ children }) => <h3 className="mt-4 mb-2 text-base font-semibold text-zinc-100">{children}</h3>,
          p: ({ children }) => <p className="my-2.5 leading-relaxed">{children}</p>,
          ul: ({ children }) => <ul className="my-2.5 space-y-1.5 pl-1">{children}</ul>,
          ol: ({ children }) => <ol className="my-2.5 space-y-1.5 list-decimal pl-5 marker:text-emerald-400 marker:font-semibold">{children}</ol>,
          li: ({ children, ...props }) => {
            const ordered = props.index !== undefined;
            if (ordered) {
              return <li className="pl-1 leading-relaxed">{children}</li>;
            }
            return (
              <li className="flex gap-2.5 leading-relaxed">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                <span className="flex-1">{children}</span>
              </li>
            );
          },
          strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
          em: ({ children }) => <em className="text-zinc-300">{children}</em>,
          code: ({ className, children }) => {
            const isInline = !className;
            if (isInline) {
              return (
                <code className="rounded-md bg-white/[0.08] px-1.5 py-0.5 font-mono text-[13px] text-emerald-300 ring-1 ring-inset ring-white/10">
                  {children}
                </code>
              );
            }
            return <CodeBlock language={className?.replace('language-', '') || 'text'}>{String(children)}</CodeBlock>;
          },
          pre: ({ children }) => <>{children}</>,
          blockquote: ({ children }) => (
            <blockquote className="my-3 border-l-2 border-emerald-400/50 bg-emerald-400/[0.05] py-2 pl-4 pr-3 rounded-r-md text-zinc-300">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="my-4 overflow-x-auto rounded-xl ring-1 ring-white/10">
              <table className="w-full border-collapse text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-white/[0.06]">{children}</thead>,
          th: ({ children }) => (
            <th className="border-b border-white/10 px-4 py-2.5 text-left font-semibold text-white">{children}</th>
          ),
          td: ({ children }) => (
            <td className="border-b border-white/5 px-4 py-2.5 text-zinc-300 align-top">{children}</td>
          ),
          hr: () => <hr className="my-5 border-white/10" />,
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-emerald-400 underline underline-offset-2 hover:text-emerald-300">
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});

function CodeBlock({ language, children }: { language: string; children: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="my-3 overflow-hidden rounded-xl ring-1 ring-white/10 bg-black/40">
      <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.03] px-4 py-2">
        <span className="font-mono text-xs uppercase tracking-wider text-zinc-400">{language}</span>
        <button
          onClick={copy}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-zinc-400 transition hover:bg-white/10 hover:text-white"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="overflow-x-auto p-4">
        <code className="font-mono text-[13px] leading-relaxed text-emerald-200">{children}</code>
      </pre>
    </div>
  );
}

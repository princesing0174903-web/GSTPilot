import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Escape a string for safe interpolation into HTML.
// Use before passing user-generated or AI-generated content to dangerouslySetInnerHTML,
// BEFORE applying any markdown-style transforms.
// Escapes: ampersand, less-than, greater-than, double-quote, single-quote.
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

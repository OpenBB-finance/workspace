import DOMPurify from "dompurify";

/**
 * Global DOMPurify configuration for sanitizing HTML content.
 * This is the single source of truth for HTML sanitization across the app.
 * All components rendering user/AI/backend HTML should use this config
 * (or spread it as a base with context-specific overrides).
 *
 * - Strips dangerous tags (script, iframe, form, object, embed)
 * - Blocks event handler attributes (onerror, onload, onclick, onmouseover)
 * - Allows CSS style tags for rich formatting
 */
export const HTML_SANITIZE_CONFIG: DOMPurify.Config = {
  FORBID_TAGS: ["script", "iframe", "form", "object", "embed"],
  FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover"],
  ALLOW_DATA_ATTR: false,
};

/**
 * Allowlist-based DOMPurify config for markdown content from external sources
 * (skills, MCP tool descriptions). Only permits safe formatting tags.
 */
export const MARKDOWN_SANITIZE_CONFIG: DOMPurify.Config = {
  ALLOWED_TAGS: [
    "p",
    "br",
    "strong",
    "em",
    "u",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "ul",
    "ol",
    "li",
    "blockquote",
    "code",
    "pre",
    "a",
  ],
  ALLOWED_ATTR: ["href", "target", "rel"],
};

/**
 * Sanitizes HTML content for safe rendering.
 * Used for AI-generated HTML artifacts to prevent XSS attacks.
 *
 * @param html - The HTML string to sanitize
 * @returns Sanitized HTML string safe for rendering
 */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, HTML_SANITIZE_CONFIG);
}

/**
 * Sanitizes Markdown content for safe rendering.
 * Protects fenced code blocks and inline code from being stripped by DOMPurify
 * while maintaining security for the rest of the content.
 *
 * @param markdown - The raw markdown string
 * @returns Sanitized markdown string
 */
export function sanitizeMarkdown(markdown: string): string {
  if (!markdown) return markdown;

  const codeBlocks: string[] = [];
  // Use a random token to prevent placeholder collision
  const token = Math.random().toString(36).substring(2, 15);

  // Protect fenced code blocks (triple-backticks only)
  const processed = markdown.replace(/(```[\s\S]*?```)/g, (match) => {
    codeBlocks.push(match);
    return `__CODE_BLOCK_${token}_${codeBlocks.length - 1}__`;
  });

  // Sanitize the remaining markdown text using DOMPurify
  let sanitized = DOMPurify.sanitize(processed, MARKDOWN_SANITIZE_CONFIG);

  // Restore the code blocks
  codeBlocks.forEach((block, i) => {
    sanitized = sanitized.replace(`__CODE_BLOCK_${token}_${i}__`, () => block);
  });

  return sanitized;
}

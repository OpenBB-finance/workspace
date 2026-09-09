/**
 * Validation for URLs that originate outside the app — vendor-authored listing
 * fields, backend responses, form input. Anything rendered as an `href` or
 * handed to `window.open` must go through {@link safeExternalUrl} first: a
 * `javascript:` value in either position executes in the current origin, so a
 * marketplace submission could otherwise run script in a reviewer's session.
 */

/** Shape check for a user-entered link. Not a safety check — use {@link safeExternalUrl}. */
export const HTTP_URL_RE = /^https?:\/\/.+/i;

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SAFE_PROTOCOLS = new Set(["http:", "https:"]);

/**
 * The URL if it parses and uses http(s), else `null`. Parsing (rather than
 * regex-matching) is what rejects the tricky cases — leading whitespace,
 * embedded newlines, and `java\tscript:` style protocol obfuscation all
 * normalise away before the protocol is read.
 */
export function safeExternalUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return SAFE_PROTOCOLS.has(new URL(url).protocol) ? url : null;
  } catch {
    return null;
  }
}

/** Opens an external link in a new tab, silently ignoring unsafe protocols. */
export function openExternalUrl(url: string | null | undefined): void {
  const safe = safeExternalUrl(url);
  if (safe) window.open(safe, "_blank", "noopener,noreferrer");
}

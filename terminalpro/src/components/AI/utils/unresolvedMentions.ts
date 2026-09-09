/**
 * A mention is stored in message content as an opaque `@[id:...]` token and is
 * resolved to a display name at render time against the live widget/tab list.
 * When the id can't be resolved, `processMentions` leaves the raw token in the
 * text.
 *
 * Resolution is scoped, not global: `useMentions` only populates the options
 * map for the current dashboard and only when the selected copilot declares the
 * `widget-dashboard-select` / `widget-dashboard-search` features, and prompt
 * cards render this component off-dashboard entirely. So an unresolved token
 * means "can't be resolved here" — not "deleted".
 *
 * These helpers detect those leftovers so they can be rendered as a muted chip
 * instead of leaking the raw token into the chat.
 */

const UNRESOLVED_MENTION_PATTERN = /@\[id:[^\]\n]+\]/g;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const UNRESOLVED_MENTION_FALLBACK_LABEL = "@Unavailable";

/**
 * Ids are query-string shaped (`tab_id=X&inner_tab=Y`, `widget_id=X&uuid=Y`) or
 * a bare widget id. Only `inner_tab` round-trips to a name — tab ids are
 * `slugify(tab.name)` (see `Widgets/ui/NavigationBar.tsx`). The widget shapes
 * carry an API identifier, not a title (`portfolio_industries_custom_obb` is
 * not "Portfolio Exposure by Industry"), so they get the generic label rather
 * than an invented one.
 */
function getTabSlug(token: string): string | null {
  const id = token.slice("@[id:".length, -1);
  return id.match(/(?:^|&)inner_tab=([^&]*)/)?.[1] || null;
}

function humanizeSlug(slug: string): string | null {
  if (UUID_PATTERN.test(slug)) return null;
  const words = slug.split(/[-_\s]+/).filter(Boolean);
  if (words.length === 0 || !/[a-z]/i.test(slug)) return null;
  return words.map((word) => word[0].toUpperCase() + word.slice(1)).join(" ");
}

export function getUnresolvedMentionLabel(token: string): string {
  const slug = getTabSlug(token);
  const name = slug ? humanizeSlug(slug) : null;
  return name ? `@${name}` : UNRESOLVED_MENTION_FALLBACK_LABEL;
}

/** Maps every leftover `@[id:...]` token in `content` to its display label. */
export function findUnresolvedMentions(content: string): Map<string, string> {
  const tokens = content.match(UNRESOLVED_MENTION_PATTERN) || [];
  return new Map(
    tokens.map((token) => [token, getUnresolvedMentionLabel(token)] as const),
  );
}

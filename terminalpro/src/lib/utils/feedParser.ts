/**
 * Feed parsing utilities for RSS 2.0 and Atom feeds.
 *
 * Extracts a common interface from different feed formats:
 * - RSS 2.0: <item> elements with title, link, pubDate, description
 * - Atom: <entry> elements with title, link[@href], published/updated, content/summary
 */

export type FeedType = "rss" | "atom";

export interface ParsedFeedItem {
  title: string | null;
  link: string | null;
  pubDate: string | null;
  description: string | null;
  isAtomFeed: boolean;
}

/**
 * Detects whether the XML document is an RSS or Atom feed.
 *
 * Detection logic:
 * - If <item> elements exist, treat as RSS (even if <entry> also exists)
 * - If only <entry> elements exist, treat as Atom
 * - Default to RSS for empty or unknown feeds
 */
export function detectFeedType(xmlDoc: Document): FeedType {
  const rssItems = xmlDoc.getElementsByTagName("item");
  const atomEntries = xmlDoc.getElementsByTagName("entry");

  // Prefer RSS when both exist (for malformed feeds with mixed elements)
  if (rssItems.length > 0) {
    return "rss";
  }

  if (atomEntries.length > 0) {
    return "atom";
  }

  // Check for Atom feed root element
  const feedElement = xmlDoc.getElementsByTagName("feed")[0];
  if (feedElement) {
    return "atom";
  }

  return "rss";
}

/**
 * Parses a single feed item/entry element into a common structure.
 *
 * @param element - The <item> (RSS) or <entry> (Atom) element
 * @param isAtomFeed - Whether to parse as Atom format
 * @returns Parsed feed item with title, link, pubDate, and description
 */
export function parseFeedItem(element: Element, isAtomFeed: boolean): ParsedFeedItem {
  let title: string | null = null;
  let link: string | null = null;
  let pubDate: string | null = null;
  let description: string | null = null;

  if (isAtomFeed) {
    // Atom feed parsing
    title = element.getElementsByTagName("title")[0]?.textContent ?? null;

    // Atom uses <link href="..."> attribute
    const linkEl = element.getElementsByTagName("link")[0];
    link = linkEl?.getAttribute("href") || linkEl?.textContent || null;

    // Atom uses <published> or <updated> for dates
    pubDate =
      element.getElementsByTagName("published")[0]?.textContent ||
      element.getElementsByTagName("updated")[0]?.textContent ||
      null;

    // Atom uses <content> or <summary> for description
    description =
      element.getElementsByTagName("content")[0]?.textContent ||
      element.getElementsByTagName("summary")[0]?.textContent ||
      null;
  } else {
    // RSS 2.0 feed parsing
    title = element.getElementsByTagName("title")[0]?.textContent ?? null;
    link = element.getElementsByTagName("link")[0]?.textContent ?? null;
    pubDate = element.getElementsByTagName("pubDate")[0]?.textContent ?? null;
    description = element.getElementsByTagName("description")[0]?.textContent ?? null;
  }

  return { title, link, pubDate, description, isAtomFeed };
}

/**
 * Parses all items from an XML feed document.
 *
 * Automatically detects feed type (RSS vs Atom) and parses all items.
 *
 * @param xmlDoc - The parsed XML document
 * @returns Array of parsed feed items
 */
export function parseFeedXml(xmlDoc: Document): ParsedFeedItem[] {
  const feedType = detectFeedType(xmlDoc);
  const isAtomFeed = feedType === "atom";

  const rssItems = Array.from(xmlDoc.getElementsByTagName("item"));
  const atomEntries = Array.from(xmlDoc.getElementsByTagName("entry"));

  // Use RSS items if available, otherwise use Atom entries
  const items = isAtomFeed && rssItems.length === 0 ? atomEntries : rssItems;

  return items.map((item) => parseFeedItem(item, isAtomFeed));
}

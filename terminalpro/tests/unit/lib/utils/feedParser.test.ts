import { describe, expect, it } from "vitest";
import { detectFeedType, parseFeedItem, parseFeedXml } from "~/lib/utils/feedParser";

// Helper to create XML document from string
function createXmlDoc(xmlString: string): Document {
  const parser = new DOMParser();
  return parser.parseFromString(xmlString, "text/xml");
}

// Sample RSS 2.0 feed XML
const RSS_FEED_XML = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Example RSS Feed</title>
    <item>
      <title>RSS Article Title</title>
      <link>https://example.com/rss-article</link>
      <pubDate>Mon, 01 Jan 2024 12:00:00 GMT</pubDate>
      <description>This is the RSS article description.</description>
    </item>
    <item>
      <title>Second RSS Article</title>
      <link>https://example.com/rss-article-2</link>
      <pubDate>Tue, 02 Jan 2024 14:30:00 GMT</pubDate>
      <description>Second article description.</description>
    </item>
  </channel>
</rss>`;

// Sample Atom feed XML
const ATOM_FEED_XML = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Example Atom Feed</title>
  <entry>
    <title>Atom Article Title</title>
    <link href="https://example.com/atom-article"/>
    <published>2024-01-01T12:00:00Z</published>
    <content>This is the Atom article content.</content>
  </entry>
  <entry>
    <title>Second Atom Article</title>
    <link href="https://example.com/atom-article-2"/>
    <updated>2024-01-02T14:30:00Z</updated>
    <summary>Second article summary.</summary>
  </entry>
</feed>`;

// Atom feed with link as text content (edge case)
const ATOM_FEED_LINK_TEXT_XML = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Edge Case Atom Feed</title>
  <entry>
    <title>Article with text link</title>
    <link>https://example.com/text-link</link>
    <published>2024-01-01T12:00:00Z</published>
    <summary>Article summary.</summary>
  </entry>
</feed>`;

// Mixed feed with both <item> and <entry> elements
const MIXED_FEED_XML = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Mixed Feed</title>
    <item>
      <title>RSS Item</title>
      <link>https://example.com/rss-item</link>
      <pubDate>Mon, 01 Jan 2024 12:00:00 GMT</pubDate>
      <description>RSS description.</description>
    </item>
    <entry>
      <title>Atom Entry</title>
      <link href="https://example.com/atom-entry"/>
      <published>2024-01-02T12:00:00Z</published>
      <content>Atom content.</content>
    </entry>
  </channel>
</rss>`;

// Empty feed
const EMPTY_RSS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Empty Feed</title>
  </channel>
</rss>`;

const EMPTY_ATOM_XML = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Empty Atom Feed</title>
</feed>`;

describe("feedParser", () => {
  describe("detectFeedType", () => {
    it("detects RSS 2.0 feed type", () => {
      const xmlDoc = createXmlDoc(RSS_FEED_XML);
      expect(detectFeedType(xmlDoc)).toBe("rss");
    });

    it("detects Atom feed type", () => {
      const xmlDoc = createXmlDoc(ATOM_FEED_XML);
      expect(detectFeedType(xmlDoc)).toBe("atom");
    });

    it("prefers RSS when both <item> and <entry> elements exist", () => {
      const xmlDoc = createXmlDoc(MIXED_FEED_XML);
      expect(detectFeedType(xmlDoc)).toBe("rss");
    });

    it("returns rss for empty RSS feed", () => {
      const xmlDoc = createXmlDoc(EMPTY_RSS_XML);
      expect(detectFeedType(xmlDoc)).toBe("rss");
    });

    it("returns atom for empty Atom feed", () => {
      const xmlDoc = createXmlDoc(EMPTY_ATOM_XML);
      expect(detectFeedType(xmlDoc)).toBe("atom");
    });
  });

  describe("parseFeedItem - RSS 2.0", () => {
    it("parses RSS item title", () => {
      const xmlDoc = createXmlDoc(RSS_FEED_XML);
      const item = xmlDoc.getElementsByTagName("item")[0];
      const result = parseFeedItem(item, false);

      expect(result.title).toBe("RSS Article Title");
    });

    it("parses RSS item link", () => {
      const xmlDoc = createXmlDoc(RSS_FEED_XML);
      const item = xmlDoc.getElementsByTagName("item")[0];
      const result = parseFeedItem(item, false);

      expect(result.link).toBe("https://example.com/rss-article");
    });

    it("parses RSS item pubDate", () => {
      const xmlDoc = createXmlDoc(RSS_FEED_XML);
      const item = xmlDoc.getElementsByTagName("item")[0];
      const result = parseFeedItem(item, false);

      expect(result.pubDate).toBe("Mon, 01 Jan 2024 12:00:00 GMT");
    });

    it("parses RSS item description", () => {
      const xmlDoc = createXmlDoc(RSS_FEED_XML);
      const item = xmlDoc.getElementsByTagName("item")[0];
      const result = parseFeedItem(item, false);

      expect(result.description).toBe("This is the RSS article description.");
    });

    it("sets isAtomFeed to false for RSS items", () => {
      const xmlDoc = createXmlDoc(RSS_FEED_XML);
      const item = xmlDoc.getElementsByTagName("item")[0];
      const result = parseFeedItem(item, false);

      expect(result.isAtomFeed).toBe(false);
    });
  });

  describe("parseFeedItem - Atom", () => {
    it("parses Atom entry title", () => {
      const xmlDoc = createXmlDoc(ATOM_FEED_XML);
      const entry = xmlDoc.getElementsByTagName("entry")[0];
      const result = parseFeedItem(entry, true);

      expect(result.title).toBe("Atom Article Title");
    });

    it("parses Atom entry link from href attribute", () => {
      const xmlDoc = createXmlDoc(ATOM_FEED_XML);
      const entry = xmlDoc.getElementsByTagName("entry")[0];
      const result = parseFeedItem(entry, true);

      expect(result.link).toBe("https://example.com/atom-article");
    });

    it("parses Atom entry link from text content as fallback", () => {
      const xmlDoc = createXmlDoc(ATOM_FEED_LINK_TEXT_XML);
      const entry = xmlDoc.getElementsByTagName("entry")[0];
      const result = parseFeedItem(entry, true);

      expect(result.link).toBe("https://example.com/text-link");
    });

    it("parses Atom entry published date", () => {
      const xmlDoc = createXmlDoc(ATOM_FEED_XML);
      const entry = xmlDoc.getElementsByTagName("entry")[0];
      const result = parseFeedItem(entry, true);

      expect(result.pubDate).toBe("2024-01-01T12:00:00Z");
    });

    it("parses Atom entry updated date when published is not available", () => {
      const xmlDoc = createXmlDoc(ATOM_FEED_XML);
      const entry = xmlDoc.getElementsByTagName("entry")[1];
      const result = parseFeedItem(entry, true);

      expect(result.pubDate).toBe("2024-01-02T14:30:00Z");
    });

    it("parses Atom entry content", () => {
      const xmlDoc = createXmlDoc(ATOM_FEED_XML);
      const entry = xmlDoc.getElementsByTagName("entry")[0];
      const result = parseFeedItem(entry, true);

      expect(result.description).toBe("This is the Atom article content.");
    });

    it("parses Atom entry summary when content is not available", () => {
      const xmlDoc = createXmlDoc(ATOM_FEED_XML);
      const entry = xmlDoc.getElementsByTagName("entry")[1];
      const result = parseFeedItem(entry, true);

      expect(result.description).toBe("Second article summary.");
    });

    it("sets isAtomFeed to true for Atom entries", () => {
      const xmlDoc = createXmlDoc(ATOM_FEED_XML);
      const entry = xmlDoc.getElementsByTagName("entry")[0];
      const result = parseFeedItem(entry, true);

      expect(result.isAtomFeed).toBe(true);
    });
  });

  describe("parseFeedXml", () => {
    it("parses all items from RSS 2.0 feed with isAtomFeed=false", () => {
      const xmlDoc = createXmlDoc(RSS_FEED_XML);
      const results = parseFeedXml(xmlDoc);

      expect(results).toHaveLength(2);
      expect(results[0].title).toBe("RSS Article Title");
      expect(results[1].title).toBe("Second RSS Article");
      expect(results[0].isAtomFeed).toBe(false);
      expect(results[1].isAtomFeed).toBe(false);
    });

    it("parses all entries from Atom feed with isAtomFeed=true", () => {
      const xmlDoc = createXmlDoc(ATOM_FEED_XML);
      const results = parseFeedXml(xmlDoc);

      expect(results).toHaveLength(2);
      expect(results[0].title).toBe("Atom Article Title");
      expect(results[1].title).toBe("Second Atom Article");
      expect(results[0].isAtomFeed).toBe(true);
      expect(results[1].isAtomFeed).toBe(true);
    });

    it("returns empty array for empty RSS feed", () => {
      const xmlDoc = createXmlDoc(EMPTY_RSS_XML);
      const results = parseFeedXml(xmlDoc);

      expect(results).toEqual([]);
    });

    it("returns empty array for empty Atom feed", () => {
      const xmlDoc = createXmlDoc(EMPTY_ATOM_XML);
      const results = parseFeedXml(xmlDoc);

      expect(results).toEqual([]);
    });

    it("parses RSS items when both RSS and Atom elements exist (prefers RSS)", () => {
      const xmlDoc = createXmlDoc(MIXED_FEED_XML);
      const results = parseFeedXml(xmlDoc);

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe("RSS Item");
      expect(results[0].link).toBe("https://example.com/rss-item");
    });

    it("handles missing optional fields gracefully", () => {
      const xmlWithMissingFields = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <item>
      <title>Only Title</title>
    </item>
  </channel>
</rss>`;
      const xmlDoc = createXmlDoc(xmlWithMissingFields);
      const results = parseFeedXml(xmlDoc);

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe("Only Title");
      expect(results[0].link).toBeNull();
      expect(results[0].pubDate).toBeNull();
      expect(results[0].description).toBeNull();
    });
  });

  describe("RSS 2.0 regression tests", () => {
    it("correctly parses standard RSS 2.0 feed structure", () => {
      const standardRssFeed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Bloomberg Markets</title>
    <link>https://www.bloomberg.com/markets</link>
    <description>Bloomberg Markets News</description>
    <item>
      <title>Market Update: Stocks Rally</title>
      <link>https://www.bloomberg.com/news/articles/stocks-rally</link>
      <pubDate>Wed, 15 Jan 2025 09:30:00 -0500</pubDate>
      <description><![CDATA[<p>Stock markets rallied today...</p>]]></description>
    </item>
  </channel>
</rss>`;
      const xmlDoc = createXmlDoc(standardRssFeed);
      const results = parseFeedXml(xmlDoc);

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe("Market Update: Stocks Rally");
      expect(results[0].link).toBe(
        "https://www.bloomberg.com/news/articles/stocks-rally",
      );
      expect(results[0].pubDate).toBe("Wed, 15 Jan 2025 09:30:00 -0500");
      expect(results[0].description).toBe("<p>Stock markets rallied today...</p>");
    });

    it("parses multiple RSS items maintaining order", () => {
      const xmlDoc = createXmlDoc(RSS_FEED_XML);
      const results = parseFeedXml(xmlDoc);

      expect(results[0].title).toBe("RSS Article Title");
      expect(results[1].title).toBe("Second RSS Article");
    });
  });
});

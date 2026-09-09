import type { ChartTypeExCombo } from "ag-grid-community";
import tlds from "tlds";
import { getConfig } from "./runtimeConfig";
import type { Copilot } from "./state/copilot";
import type { McpServer } from "./state/mcpTools";

export const VERSION = import.meta.env.VITE_RELEASE_VERSION;

export const USER_AGENT_BACKEND = "pro";
export const REFRESH_WIDGET_INTERVAL = 1000 * 60 * 15; // 15 minutes
export const MODE: "web" | "native" = "web";

export const ENABLE_SHARING = "true";
export const MAX_COPILOT_LINKS = 4;

// Save-conversation-as-skill (save_skill copilot function call).
// Payload budget for the skill generation request; the backend enforces the
// model context budget and is the authority on what actually reaches the LLM.
export const MAX_SKILL_CONVERSATION_TOTAL_CHARS = 400_000;
export const MAX_SKILL_CONVERSATION_MESSAGE_CHARS = 20_000;
// Mirror the limits enforced by the skill form schema in AddSkillDialog.
export const MAX_SKILL_SLUG_LENGTH = 50;
export const MAX_SKILL_DESCRIPTION_LENGTH = 500;

// Global hover-reveal delay (ms) shared by the Radix TooltipProvider and
// HoverPopover. skip = window after one closes where the next opens instantly.
export const TOOLTIP_OPEN_DELAY_MS = 700;
export const TOOLTIP_SKIP_DELAY_MS = 300;

// The backend is configured to only accept these options, make sure to also add any of
// these options on the backend. Ordered documents -> tabular -> images so the
// derived "supported formats" strings read consistently across the workspace
// dropzone and the Copilot dropzone.
// biome-ignore format: off
export const ExtensionOptions = ["pdf","txt","md","docx","html","csv","json","xlsx","png","jpg","jpeg","gif"] as const;

export type Extension = (typeof ExtensionOptions)[number];

export function validImageExtension(value: string): value is Extension {
  return ["png", "jpg", "jpeg", "gif"].includes(value as Extension);
}

export function validExtension(value: string): value is Extension {
  return ExtensionOptions.includes(value as Extension);
}

// Accept list for Copilot's file upload — intentionally narrower than
// ExtensionOptions (Copilot doesn't ingest JSON/GIF). Same docs -> tabular ->
// images ordering as ExtensionOptions so the tooltip reads in lockstep with
// the dashboard "Supported formats" string.
export const COPILOT_ACCEPTED_MIME_TYPES = {
  "application/pdf": [".pdf"],
  "text/plain": [".txt"],
  "text/markdown": [".md", ".markdown"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "text/html": [".html"],
  "text/csv": [".csv"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
} as const;

export const COPILOT_ACCEPTED_EXTENSIONS = Array.from(
  new Set(Object.values(COPILOT_ACCEPTED_MIME_TYPES).flat()),
);

export const inSnowflakeNativeApp =
  import.meta.env.VITE_SNOWFLAKE_NATIVE_APP === "true";

// Runtime config accessors — safe to call at any point (falls back to import.meta.env)
export function getApiUrl() {
  return getConfig().urls.backend;
}
export function getPaymentsApiUrl() {
  return getConfig().urls.backend;
}
export function getAiApiUrl() {
  return getConfig().urls.ai;
}
export function getDataPlatformUrl() {
  return getConfig().urls.platform;
}

export const LETS_TALK_FORM_URL =
  "https://app.formbricks.com/s/cqx6ygvxkpy0gydm9jafz57w?embed=true";

// Formbricks form embedded in the "Contact" popup for marketplace apps (lite mode).
// TODO: replace the form id with the dedicated vendor-contact form id.
export const CONTACT_VENDOR_FORM_URL =
  "https://app.formbricks.com/s/cqx6ygvxkpy0gydm9jafz57w?embed=true";

export const IMAGE_FILE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif"];

/**
 * Copilot feature constants shared across components
 */

// All AI features that are available
export const ALL_AI_FEATURES = new Set([
  "streaming",
  "file-upload",
  "widget-dashboard-select",
  "widget-dashboard-search",
  "widget-global-search",
  "generative-ui",
  "mcp-tools",
  "agent-orchestration",
  "feedback",
]);

// Features that can be enabled by agents (user-specified in agent configs)
export const AGENT_ENABLED_FEATURES = new Set([
  "widget-dashboard-select",
  "widget-dashboard-search",
]);

/**
 * Default MCP server configuration
 * Added automatically for new users when VITE_MCP_DEFAULT_SERVER_ENABLED is true
 */
export const DEFAULT_MCP_SERVER: McpServer = {
  id: "openbb-docs-default",
  name: "OpenBB Documentation",
  url: "https://openbb-docs-mcp.external.openbb.app/mcp",
  enabled: true,
  clientName: "OpenBB Workspace",
  isLocal: false,
  tools: [],
  autoReconnect: true,
};

export const FILE_EXTENSIONS = [
  ".pdf",
  ...IMAGE_FILE_EXTENSIONS,
  ".txt",
  ".docx",
  ".md",
  ".html",
];

export const UNIQUE_AVATAR_COLORS = [
  "#3174ad", // Blue
  "#c75d5d", // Red
  "#8e5e9a", // Purple
  "#4a9e6c", // Green
  "#a89132", // Olive/gold
  "#a55353", // Darker red
  "#9e6c4a", // Brown/orange
  "#7a5a9e", // Different purple
  "#7a7a7a", // Gray
  "#6c8e4a", // Green-olive
];

// max file size for file upload in bytes
export const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

// total storage capacity for user in bytes
export const MAX_STORAGE_CAPACITY = 5 * 1024 * 1024 * 1024; // 5GB

// threshold for storage usage in percentage
export const STORAGE_THRESHOLD = 0.9;

const SUPPORTED_TLDs = tlds.join("|");

export const LINK_REGEX = new RegExp(
  `\\b((https?|ftp|file):\\/\\/[^\\s]+|[a-zA-Z0-9-]+(?:\\.[a-zA-Z0-9-]+)*\\.(?:${SUPPORTED_TLDs})\\S*)\\b`,
  "g",
);

// Email regex to identify and filter out email addresses
export const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;

export const BENZINGA_NEWS_IMG_URLS = [
  "https://cdn.benzinga.com/files/imagecache/1024x768xUP/images/story/2023/options_image_0.jpeg",
  "https://cdn.benzinga.com/files/imagecache/1024x768xUP/images/story/2023/options_image_2.jpeg",
  "https://cdn.benzinga.com/files/imagecache/250x187xUP/images/story/2023/options_image_4.jpeg",
  "https://cdn.benzinga.com/files/imagecache/1024x768xUP/images/story/2023/movers_image_0.jpeg",
  "https://cdn.benzinga.com/files/imagecache/1024x768xUP/images/story/2023/movers_image_1.jpeg",
  "https://cdn.benzinga.com/files/imagecache/1024x768xUP/images/story/2023/movers_image_5.jpeg",
  "https://cdn.benzinga.com/files/images/story/2024/untitled_9.jpeg?optimize=medium&dpr=2&auto=webp&width=260",
  "https://cdn.benzinga.com/files/images/story/2024/02/26/stock_art.jpg?optimize=medium&dpr=2&auto=webp&width=260",
  "https://cdn.benzinga.com/files/images/story/2024/02/26/image39.jpeg?optimize=medium&dpr=2&auto=webp&width=260",
  "https://cdn.benzinga.com/files/maxim-hopman-fixlqxahcfk-unsplash_8_4.jpg?optimize=medium&dpr=2&auto=webp&width=260",
];

export const BLOCKED_WIDGETS = [
  "analyst_price_target",
  "global_news",
  "company_news",
  "economic_overview",
  "country_indicators",
  "economic_indicators",
  "yield_curve",
  "analyst_estimates",
];

export const BLOCKED_WIDGET_IDS = new Set(BLOCKED_WIDGETS);

export const AI_SUPPORTED_FILE_TYPES = [
  "pdf",
  "jpg",
  "jpeg",
  "png",
  // "application/json", // not supported yet by endpoint
  "csv",
  "md",
  "txt",
  "xlsx",
  "docx",
  "html",
] as const;

export const AI_AT_COMMANDS = {
  "@sec": "Search SEC fillings ",
};

export const AI_PROMPTS = {
  "Based on the company profile, please list comparable peers along with bullet points detailing their respective activities and products.":
    ["Company Profile"],
  "Using the financial statements, assess the trend in revenue growth over the past few years. What factors contributed to any significant fluctuations?":
    ["Financial Statements"],
  "Using the financial statements, analyze the gross and net profit margin trend. Has there been any improvement or decline, and what could be the reasons behind it?":
    ["Financial Statements"],
  "Using the financial statements, investigate any significant changes in capital expenditure levels and the impact these changes have on the company's growth prospects.":
    ["Financial Statements"],
  "Using the financial statements, in specific gross profit margin how efficiently is the company producing goods or services.":
    ["Financial Statements"],
  "Using the financial statement, in specific operating profit margin how profitable is the company. Double check the math.":
    ["Financial Statements"],
  "Using the financial statement, in specific earnings per share (EPS) is the business growing? How has it changed over the years?":
    ["Financial Statements"],
  "Using the financial statement, assess the company's liquidity position by analyzing current and quick ratios. Are there any concerns regarding its short-term solvency":
    ["Financial Statements"],
  "Using the financial statement, investigate the trend in debt levels and debt-to-equity ratio. How does the company's leverage position compare to industry peers":
    ["Financial Statements"],
  "Using the financial statement, can you analyze the shareholders' equity and discuss if a rising equity value is generally seen as positive?":
    ["Financial Statements"],
  "Using the financial statement, can you indicate the cash generated from core business operations in the operating cash flow and discuss how operating cash flow reflects on the company financial health?":
    ["Financial Statements"],
  "Using the financial statement, can you show the cash spent or gained from investments in capital assets in the investing cash flow and discuss if high outflows indicate significant capital investments?":
    ["Financial Statements"],
  "Using the financial statement, can you reveal the cash flows related to financing activities such as issuing shares, taking on debt, and repaying loans in the financing cash flow and discuss if consistently high financing inflows signal reliance on external financing?":
    ["Financial Statements"],
  "Using the financial statement, can you calculate the free cash flow and indicate the cash available for discretionary use like dividends, share buybacks, or debt repayment? Explain the reasoning.":
    ["Financial Statements"],
  "For each piece of news, rate the sentiment from -1 to +1, based on whether it is likely to affect the share price. Give just the headline and rating. Order the articles based on their sentiment score and output the results as a markdown table.":
    ["Company News"],
  "From all the company news, what are the 3 headlines that I should not miss based on how they can impact the stock price.":
    ["Company News"],
  "Based on management team, review leadership's track record in terms of ownership and product launched. Use general knowledge information to highlight any past accomplishments or negative press from these.":
    ["Management Team"],
  "What are the trends observed in terms of the revenue per business line? Acknowledge most positive and negative highlights.":
    ["Revenue Per Business Line"],
  "What are the trends observed in terms of the revenue per geography? Where is the company being successful and failing to expand?":
    ["Revenue Per Geography"],
  "Based on valuation multiples, is this company under or overvalued?": [
    "Valuation Multiples",
  ],
  "Based on valuation multiples, what are the growth expectations of the company?": [
    "Valuation Multiples",
  ],
  "Based on valuation multiples, what can I say regarding company's profitability and efficiency":
    ["Valuation Multiples"],
  "Based on valuation multiples, what is the financial health of the company? And are there any major risks I should be aware of?":
    ["Valuation Multiples"],
  "Based on valuation multiples, what is the market sentiment and expectations towards this company?":
    ["Valuation Multiples"],
  "Based on valuation multiples, what is the company dividend yield and how has it changed over time.":
    ["Valuation Multiples"],
  "Using the comparison analysis, conduct a comparative analysis with industry peers to benchmark the company's financial performance.":
    ["Comparison Analysis"],
  "How does this company compares against its peers in broader terms? What are the biggest outliers?":
    ["Comparison Analysis"],
  "Using the institutional ownership, what are some trends to notice?": [
    "Institutional Ownership",
  ],
  "Based on the stock ownership, create a table with the top 10 investors that have the most shares of the company and sort them? The table must contain their market value, how much portfolio weight they have in the company and their average price?":
    ["Stock Ownership"],
  "Assess the concentration of ownership. Are there a few large institutions holding significant stakes, or is ownership more evenly distributed?":
    ["Stock Ownership"],
  "Investigate any clusters of insider buying or selling. Do multiple insiders engage in transactions around the same time, and what does this suggest about sentiment or outlook?":
    ["Insider Trading"],
  "Based on insider trading, who are the top 3 buyers in the past year? How many shares did they buy, which type and how much did they spend on it in total?":
    ["Insider Trading"],
  "Based on insider trading, who are the top 3 sellers in the past year? How many shares did they sell and how much did they make from it?":
    ["Insider Trading"],
  "Analyze the timing of insider transactions relative to key company events or announcements. Are insiders buying or selling shares before significant news is made public":
    ["Insider Trading", "Company News"],
  "Evaluate the accuracy of analyst revenue forecasts relative to actual reported revenue figures. Are analysts consistently overestimating or underestimating revenue?":
    ["Financial Statements", "Analyst Estimates"],
  "Based on the last 10 years of earnings history, how have analysts estimated EPS and revenue and how has the company performed against it? On average did the company beat or miss the EPS and earnings? And by how much?":
    ["Earnings History"],
  "How is the dividend payment of the company evolving over time?": [
    "Dividend Payment",
  ],
  "Analyze the trend in dividend payouts and dividend yield. How does the company's dividend policy align with its financial performance?":
    ["Dividend Payment", "Financial Statements"],
  "What can you say about the analyst estimates?": ["Analyst Estimates"],
  "Review recent changes in analyst recommendations (e.g., buy, hold, sell). Have there been any notable shifts in sentiment":
    ["Price Target By Analyst"],
  "Who are the analysts that changed their price target by a wider margin over the past 3 months?":
    ["Price Target By Analyst"],
  "Are there analysts that changed their rating over the past year? If so, what company do they work at?":
    ["Price Target By Analyst"],
  "Using analysts consensus dataset, are there any companies that changed their grades on the company in the last few weeks?":
    ["Analyst Consensus"],
  "Evaluate management's guidance for future performance, including revenue, earnings, and key operational metrics. How does management view the company's growth prospects and potential challenges in the upcoming quarters?":
    ["Earnings Transcripts"],
  "Examine management's discussion and commentary on the company's performance during the earnings period. What are the key drivers behind the results, and how do they align with previous guidance or expectations?":
    ["Earnings Transcripts"],
  "Summarize this earnings transcripts in 3 bullet points. Then, describe company's future strategic roadmap in terms of deadlines for short, medium and long term. Then in another section, highlight 3 sentences that I should be trying to research further before investing in the stock.":
    ["Earnings Transcripts"],
  "Analyze the current earnings transcript against the one from the quarter before. Are there any noticeable shift in terms of strategy? What about financial changes? Is there any topic that was given less emphasis or added this quarter?":
    ["Earnings Transcripts"],
  "Using the earnings transcript, create a table with columns: financial metric, value, sentence in the earnings where it was extracted from. Double check whether the information you are using is correct.":
    ["Earnings Transcripts"],
  "What are the biggest global news of today? Explain why the headline is important and how it can impact my investment":
    ["Global News"],
};

// Default copilot configuration, does not call backend for agents.json
let _defaultCopilot: Copilot | null = null;
export function getDefaultCopilot(): Copilot {
  if (!_defaultCopilot) {
    _defaultCopilot = {
      id: "openbb-copilot",
      name: "OpenBB Copilot",
      description: "OpenBB Copilot is the default agent for OpenBB Workspace.",
      image: "/assets/images/openbb.png",
      endpoints: {
        upload_docs: "",
        query: `${getAiApiUrl()}/v1/query`,
      },
      features: {
        streaming: true,
        "file-upload": true,
        "widget-dashboard-select": true,
        "widget-dashboard-search": true,
        "widget-global-search": true,
        "generative-ui": true,
        "mcp-tools": true,
        "agent-orchestration": true,
      },
    } as Copilot;

    if (!inSnowflakeNativeApp) {
      _defaultCopilot.features["workspace-web-search"] = {
        label: "Web Search",
        default: true,
        description: "Allows the copilot to search the web.",
      };
    }
  }
  return _defaultCopilot;
}

export const defaultGroup = {
  id: "35c413e5-a7ca-42a1-895f-97bfe46ab9e9",
  name: "Group 1",
  color: "#33BBFF",
  ticker: { symbol: "AAPL", id: "AAPL", category: "equity" },
};

export const RSS_FEEDS = [
  {
    tag: "Bloomberg",
    enabled: true,
    source: "Markets News",
    url: "https://feeds.bloomberg.com/markets/news.rss",
  },
  {
    tag: "Bloomberg",
    enabled: true,
    source: "Politics News",
    url: "https://feeds.bloomberg.com/politics/news.rss",
  },
  {
    tag: "Bloomberg",
    enabled: true,
    source: "Technology News",
    url: "https://feeds.bloomberg.com/technology/news.rss",
  },
  {
    tag: "Bloomberg",
    enabled: true,
    source: "Wealth News",
    url: "https://feeds.bloomberg.com/wealth/news.rss",
  },
  {
    tag: "Reuters",
    enabled: true,
    source: "General News",
    url: "https://www.reutersagency.com/feed/?taxonomy=best-sectors&post_type=best",
  },
  {
    tag: "New York Times",
    enabled: true,
    source: "General News",
    url: "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml",
  },
  {
    tag: "CNBC",
    enabled: true,
    source: "Business News",
    url: "https://www.cnbc.com/id/100003114/device/rss/rss.html",
  },
  {
    tag: "CNBC",
    enabled: true,
    source: "Top News",
    url: "https://www.cnbc.com/id/100727362/device/rss/rss.html",
  },
  {
    tag: "FED",
    enabled: true,
    source: "FED Press Releases",
    url: "https://www.federalreserve.gov/feeds/press_all.xml",
  },
];

export type RSSFeed = (typeof RSS_FEEDS)[number];
export type OldRSSFeed = {
  name: string;
  url: string;
  category: string;
  enabled: boolean;
};

export const butterflyTypes = [
  "Azure Morpho",
  "Luna Moth",
  "Crimson Rose",
  "Orchid Swallowtail",
  "Jewel Longwing",
  "Golden Helicon",
  "Emerald Peacock",
  "Amethyst Hairstreak",
  "Pearl Crescent",
  "Ruby Admiral",
  "Sapphire Daggerwing",
  "Citrus Swallowtail",
  "Topaz Glasswing",
  "Silver Azure",
  "Violet Tip",
  "Marigold Monarch",
  "Celestial Tiger",
  "Opal Skipper",
  "Scarlet Peacock",
  "Coral Hairstreak",
  "Velvet Emperor",
  "Harmony Fritillary",
  "Rainbow Tiger",
  "Sunburst Swallowtail",
  "Velvet Daggerwing",
  "Harmony Blue",
  "Crimson Daggerwing",
  "Citrine Sulphur",
  "Azure Glassy Tiger",
  "Jade Hairstreak",
  "Harmony Admiral",
  "Diamond Skipper",
  "Amberwing Swallowtail",
  "Garnet Fritillary",
  "Rose Petal",
  "Silver Rim",
  "Cobalt Clipper",
  "Lemon Drop",
  "Velvet Rose",
  "Turquoise Admiral",
  "Lavender Daggerwing",
  "Scarlet Oakleaf",
  "Gold Banded Forester",
  "Lemon Emperor",
  "Blue Argus",
  "Harmony Jewel",
  "Ivory Lacewing",
  "Mint Swallowtail",
  "Ruby Ringlet",
  "Lilac Nymph",
  "Golden Monarch",
  "Snowflake Butterfly",
  "Bronze Daggerwing",
  "Buttercup Tiger",
  "Harmony Crescent",
  "Coral Admiral",
  "Sapphire Hairstreak",
  "Sunflower Skipper",
  "Orchid Admiral",
  "Silver Jewel",
  "Velvet Swallowtail",
  "Crimson Glasswing",
  "Blue Tiger",
  "Sunbeam Fritillary",
  "Azure Tiger",
  "Emerald Admiral",
  "Velvet Azure",
  "Moonstone Swallowtail",
  "Opal Monarch",
  "Azure Hairstreak",
  "Lemon Swallowtail",
  "Harmony Swallowtail",
  "Obsidian Daggerwing",
  "Jewel Fritillary",
  "Velvet Helicon",
  "Coral Ringlet",
  "Emerald Hairstreak",
  "Citrus Daggerwing",
  "Celestial Peacock",
  "Luna Admiral",
  "Topaz Swallowtail",
  "Garnet Hairstreak",
  "Crimson Tiger",
  "Silver Peacock",
  "Marigold Hairstreak",
  "Ruby Nymph",
  "Velvet Ringlet",
  "Azure Crescent",
  "Sunbeam Admiral",
  "Opal Tiger",
  "Golden Hairstreak",
  "Harmony Glasswing",
  "Diamond Azure",
  "Coral Peacock",
  "Lilac Admiral",
  "Celestial Hairstreak",
  "Sapphire Monarch",
  "Velvet Skipper",
  "Lemon Crescent",
  "Harmony Skipper",
  "Orchid Nymph",
  "Moonstone Hairstreak",
  "Harmony Oakleaf",
  "Turquoise Crescent",
  "Silver Daggerwing",
  "Jade Tiger",
  "Crimson Nymph",
  "Sunburst Daggerwing",
  "Amethyst Swallowtail",
  "Amber Ringlet",
  "Velvet Fritillary",
  "Azure Skipper",
  "Ivory Swallowtail",
  "Lemon Hairstreak",
  "Ruby Tiger",
  "Harmony Peacock",
  "Coral Skipper",
  "Lilac Ringlet",
  "Celestial Swallowtail",
  "Cobalt Swallowtail",
  "Diamond Admiral",
  "Scarlet Glasswing",
  "Emerald Nymph",
  "Sunflower Peacock",
  "Sapphire Oakleaf",
  "Velvet Monarch",
  "Coral Fritillary",
  "Rose Petal",
  "Silver Rim",
  "Cobalt Clipper",
  "Lemon Drop",
  "Velvet Rose",
  "Turquoise Admiral",
  "Lavender Daggerwing",
  "Scarlet Oakleaf",
  "Gold Banded Forester",
  "Lemon Emperor",
  "Blue Argus",
  "Harmony Jewel",
  "Ivory Lacewing",
  "Mint Swallowtail",
  "Ruby Ringlet",
  "Lilac Nymph",
  "Golden Monarch",
  "Snowflake Butterfly",
  "Bronze Daggerwing",
  "Buttercup Tiger",
  "Harmony Crescent",
  "Coral Admiral",
  "Sapphire Hairstreak",
  "Sunflower Skipper",
  "Orchid Admiral",
  "Silver Jewel",
  "Velvet Swallowtail",
  "Crimson Glasswing",
  "Blue Tiger",
  "Sunbeam Fritillary",
  "Azure Tiger",
  "Emerald Admiral",
  "Velvet Azure",
  "Moonstone Swallowtail",
  "Opal Monarch",
  "Azure Hairstreak",
  "Lemon Swallowtail",
  "Harmony Swallowtail",
  "Obsidian Daggerwing",
  "Jewel Fritillary",
  "Velvet Helicon",
  "Coral Ringlet",
  "Emerald Hairstreak",
  "Citrus Daggerwing",
  "Celestial Peacock",
  "Luna Admiral",
  "Topaz Swallowtail",
  "Garnet Hairstreak",
  "Crimson Tiger",
  "Silver Peacock",
  "Marigold Hairstreak",
  "Ruby Nymph",
  "Velvet Ringlet",
  "Azure Crescent",
  "Sunbeam Admiral",
  "Opal Tiger",
  "Golden Hairstreak",
  "Harmony Glasswing",
  "Diamond Azure",
  "Coral Peacock",
  "Lilac Admiral",
  "Celestial Hairstreak",
  "Sapphire Monarch",
  "Velvet Skipper",
  "Lemon Crescent",
  "Harmony Skipper",
  "Orchid Nymph",
  "Moonstone Hairstreak",
  "Harmony Oakleaf",
  "Turquoise Crescent",
  "Silver Daggerwing",
  "Jade Tiger",
  "Crimson Nymph",
  "Sunburst Daggerwing",
  "Amethyst Swallowtail",
  "Amber Ringlet",
  "Velvet Fritillary",
  "Azure Skipper",
  "Ivory Swallowtail",
  "Lemon Hairstreak",
  "Ruby Tiger",
  "Harmony Peacock",
  "Coral Skipper",
  "Lilac Ringlet",
  "Celestial Swallowtail",
  "Cobalt Swallowtail",
  "Diamond Admiral",
  "Scarlet Glasswing",
  "Emerald Nymph",
  "Sunflower Peacock",
  "Sapphire Oakleaf",
  "Velvet Monarch",
  "Coral Fritillary",
  "Rose Petal",
  "Silver Rim",
  "Cobalt Clipper",
  "Lemon Drop",
  "Velvet Rose",
  "Turquoise Admiral",
  "Lavender Daggerwing",
  "Scarlet Oakleaf",
  "Gold Banded Forester",
  "Lemon Emperor",
  "Blue Argus",
  "Harmony Jewel",
  "Ivory Lacewing",
  "Mint Swallowtail",
  "Ruby Ringlet",
  "Lilac Nymph",
  "Golden Monarch",
  "Snowflake Butterfly",
  "Bronze Daggerwing",
  "Buttercup Tiger",
  "Harmony Crescent",
  "Coral Admiral",
  "Sapphire Hairstreak",
  "Sunflower Skipper",
  "Orchid Admiral",
  "Silver Jewel",
  "Velvet Swallowtail",
  "Crimson Glasswing",
  "Blue Tiger",
  "Sunbeam Fritillary",
  "Azure Tiger",
  "Emerald Admiral",
  "Velvet Azure",
  "Moonstone Swallowtail",
  "Opal Monarch",
  "Azure Hairstreak",
  "Lemon Swallowtail",
  "Harmony Swallowtail",
  "Obsidian Daggerwing",
];

// This is the json file from econdb :)
export const econdbCountries = [
  {
    region: "Africa",
    verbose: "Algeria",
    iso2: "DZ",
  },
  {
    region: "Latin America",
    verbose: "Argentina",
    iso2: "AR",
  },
  {
    region: "G20",
    verbose: "Argentina",
    iso2: "AR",
  },
  {
    region: "Oceania",
    verbose: "Australia",
    iso2: "AU",
  },
  {
    region: "G20",
    verbose: "Australia",
    iso2: "AU",
  },
  {
    region: "Europe",
    verbose: "Austria",
    iso2: "AT",
  },
  {
    region: "Central Asia",
    verbose: "Azerbaijan",
    iso2: "AZ",
  },
  {
    region: "South Asia",
    verbose: "Bangladesh",
    iso2: "BD",
  },
  {
    region: "Europe",
    verbose: "Belarus",
    iso2: "BY",
  },
  {
    region: "Europe",
    verbose: "Belgium",
    iso2: "BE",
  },
  {
    region: "Latin America",
    verbose: "Brazil",
    iso2: "BR",
  },
  {
    region: "G20",
    verbose: "Brazil",
    iso2: "BR",
  },
  {
    region: "Europe",
    verbose: "Bulgaria",
    iso2: "BG",
  },
  {
    region: "Southeast Asia",
    verbose: "Cambodia",
    iso2: "KH",
  },
  {
    region: "North America",
    verbose: "Canada",
    iso2: "CA",
  },
  {
    region: "G20",
    verbose: "Canada",
    iso2: "CA",
  },
  {
    region: "Latin America",
    verbose: "Chile",
    iso2: "CL",
  },
  {
    region: "East Asia",
    verbose: "China",
    iso2: "CN",
  },
  {
    region: "G20",
    verbose: "China",
    iso2: "CN",
  },
  {
    region: "Latin America",
    verbose: "Colombia",
    iso2: "CO",
  },
  {
    region: "Europe",
    verbose: "Croatia",
    iso2: "HR",
  },
  {
    region: "Latin America",
    verbose: "Cuba",
    iso2: "CU",
  },
  {
    region: "Europe",
    verbose: "Czechia",
    iso2: "CZ",
  },
  {
    region: "Europe",
    verbose: "Denmark",
    iso2: "DK",
  },
  {
    region: "Latin America",
    verbose: "Dominican Republic",
    iso2: "DO",
  },
  {
    region: "Latin America",
    verbose: "Ecuador",
    iso2: "EC",
  },
  {
    region: "Africa",
    verbose: "Egypt",
    iso2: "EG",
  },
  {
    region: "Europe",
    verbose: "Estonia",
    iso2: "EE",
  },
  {
    region: "Africa",
    verbose: "Ethiopia",
    iso2: "ET",
  },
  {
    region: "Europe",
    verbose: "European Union",
    iso2: "EU",
  },
  {
    region: "Europe",
    verbose: "Euro Area",
    iso2: "EA",
  },
  {
    region: "G20",
    verbose: "European Union",
    iso2: "EU",
  },
  {
    region: "Europe",
    verbose: "Finland",
    iso2: "FI",
  },
  {
    region: "Europe",
    verbose: "France",
    iso2: "FR",
  },
  {
    region: "G20",
    verbose: "France",
    iso2: "FR",
  },
  {
    region: "Europe",
    verbose: "Germany",
    iso2: "DE",
  },
  {
    region: "G20",
    verbose: "Germany",
    iso2: "DE",
  },
  {
    region: "Europe",
    verbose: "Greece",
    iso2: "GR",
  },
  {
    region: "Latin America",
    verbose: "Guatemala",
    iso2: "GT",
  },
  {
    region: "Latin America",
    verbose: "Honduras",
    iso2: "HN",
  },
  {
    region: "East Asia",
    verbose: "Hong Kong",
    iso2: "HK",
  },
  {
    region: "Europe",
    verbose: "Hungary",
    iso2: "HU",
  },
  {
    region: "G20",
    verbose: "India",
    iso2: "IN",
  },
  {
    region: "South Asia",
    verbose: "India",
    iso2: "IN",
  },
  {
    region: "G20",
    verbose: "Indonesia",
    iso2: "ID",
  },
  {
    region: "Southeast Asia",
    verbose: "Indonesia",
    iso2: "ID",
  },
  {
    region: "Middle East",
    verbose: "Iran",
    iso2: "IR",
  },
  {
    region: "Middle East",
    verbose: "Iraq",
    iso2: "IQ",
  },
  {
    region: "Europe",
    verbose: "Ireland",
    iso2: "IE",
  },
  {
    region: "Middle East",
    verbose: "Israel",
    iso2: "IL",
  },
  {
    region: "Europe",
    verbose: "Italy",
    iso2: "IT",
  },
  {
    region: "G20",
    verbose: "Italy",
    iso2: "IT",
  },
  {
    region: "East Asia",
    verbose: "Japan",
    iso2: "JP",
  },
  {
    region: "G20",
    verbose: "Japan",
    iso2: "JP",
  },
  {
    region: "Central Asia",
    verbose: "Kazakhstan",
    iso2: "KZ",
  },
  {
    region: "Africa",
    verbose: "Kenya",
    iso2: "KE",
  },
  {
    region: "Middle East",
    verbose: "Kuwait",
    iso2: "KW",
  },
  {
    region: "Europe",
    verbose: "Latvia",
    iso2: "LV",
  },
  {
    region: "Middle East",
    verbose: "Lebanon",
    iso2: "LB",
  },
  {
    region: "Europe",
    verbose: "Lithuania",
    iso2: "LT",
  },
  {
    region: "Europe",
    verbose: "Luxembourg",
    iso2: "LU",
  },
  {
    region: "Southeast Asia",
    verbose: "Malaysia",
    iso2: "MY",
  },
  {
    region: "North America",
    verbose: "Mexico",
    iso2: "MX",
  },
  {
    region: "G20",
    verbose: "Mexico",
    iso2: "MX",
  },
  {
    region: "Central Asia",
    verbose: "Mongolia",
    iso2: "MN",
  },
  {
    region: "Africa",
    verbose: "Morocco",
    iso2: "MA",
  },
  {
    region: "Europe",
    verbose: "Netherlands",
    iso2: "NL",
  },
  {
    region: "Oceania",
    verbose: "New Zealand",
    iso2: "NZ",
  },
  {
    region: "Africa",
    verbose: "Nigeria",
    iso2: "NG",
  },
  {
    region: "Europe",
    verbose: "North Macedonia",
    iso2: "MK",
  },
  {
    region: "Europe",
    verbose: "Norway",
    iso2: "NO",
  },
  {
    region: "Middle East",
    verbose: "Oman",
    iso2: "OM",
  },
  {
    region: "South Asia",
    verbose: "Pakistan",
    iso2: "PK",
  },
  {
    region: "Latin America",
    verbose: "Panama",
    iso2: "PA",
  },
  {
    region: "Latin America",
    verbose: "Paraguay",
    iso2: "PY",
  },
  {
    region: "Latin America",
    verbose: "Peru",
    iso2: "PE",
  },
  {
    region: "Southeast Asia",
    verbose: "Philippines",
    iso2: "PH",
  },
  {
    region: "Europe",
    verbose: "Poland",
    iso2: "PL",
  },
  {
    region: "Europe",
    verbose: "Portugal",
    iso2: "PT",
  },
  {
    region: "Middle East",
    verbose: "Qatar",
    iso2: "QA",
  },
  {
    region: "Europe",
    verbose: "Romania",
    iso2: "RO",
  },
  {
    region: "Europe",
    verbose: "Russian Federation",
    iso2: "RU",
  },
  {
    region: "G20",
    verbose: "Russian Federation",
    iso2: "RU",
  },
  {
    region: "Middle East",
    verbose: "Saudi Arabia",
    iso2: "SA",
  },
  {
    region: "G20",
    verbose: "Saudi Arabia",
    iso2: "SA",
  },
  {
    region: "Europe",
    verbose: "Serbia",
    iso2: "RS",
  },
  {
    region: "Southeast Asia",
    verbose: "Singapore",
    iso2: "SG",
  },
  {
    region: "Europe",
    verbose: "Slovakia",
    iso2: "SK",
  },
  {
    region: "Europe",
    verbose: "Slovenia",
    iso2: "SI",
  },
  {
    region: "Africa",
    verbose: "Tanzania",
    iso2: "TZ",
  },
  {
    region: "Africa",
    verbose: "Namibia",
    iso2: "NA",
  },
  {
    region: "Africa",
    verbose: "Libya",
    iso2: "LY",
  },
  {
    region: "Africa",
    verbose: "South Africa",
    iso2: "ZA",
  },
  {
    region: "G20",
    verbose: "South Africa",
    iso2: "ZA",
  },
  {
    region: "East Asia",
    verbose: "South Korea",
    iso2: "KR",
  },
  {
    region: "G20",
    verbose: "South Korea",
    iso2: "KR",
  },
  {
    region: "Europe",
    verbose: "Spain",
    iso2: "ES",
  },
  {
    region: "Europe",
    verbose: "Sweden",
    iso2: "SE",
  },
  {
    region: "Europe",
    verbose: "Switzerland",
    iso2: "CH",
  },
  {
    region: "East Asia",
    verbose: "Taiwan",
    iso2: "TW",
  },
  {
    region: "Southeast Asia",
    verbose: "Thailand",
    iso2: "TH",
  },
  {
    region: "Africa",
    verbose: "Tunisia",
    iso2: "TN",
  },
  {
    region: "Europe",
    verbose: "Turkey",
    iso2: "TR",
  },
  {
    region: "G20",
    verbose: "Turkey",
    iso2: "TR",
  },
  {
    region: "Europe",
    verbose: "Ukraine",
    iso2: "UA",
  },
  {
    region: "Middle East",
    verbose: "United Arab Emirates",
    iso2: "AE",
  },
  {
    region: "Europe",
    verbose: "United Kingdom",
    iso2: "UK",
  },
  {
    region: "G20",
    verbose: "United Kingdom",
    iso2: "UK",
  },
  {
    region: "North America",
    verbose: "United States",
    iso2: "US",
  },
  {
    region: "G20",
    verbose: "United States",
    iso2: "US",
  },
  {
    region: "Central Asia",
    verbose: "Uzbekistan",
    iso2: "UZ",
  },
  {
    region: "Latin America",
    verbose: "Venezuela",
    iso2: "VE",
  },
  {
    region: "Southeast Asia",
    verbose: "Vietnam",
    iso2: "VN",
  },
];

export const CHART_TYPE_TO_SERIES_TYPE = {
  column: "bar",
  groupedColumn: "bar",
  stackedColumn: "bar",
  normalizedColumn: "bar",
  bar: "bar",
  groupedBar: "bar",
  stackedBar: "bar",
  normalizedBar: "bar",
  line: "line",
  stackedLine: "line",
  normalizedLine: "line",
  scatter: "scatter",
  bubble: "bubble",
  pie: "pie",
  donut: "donut",
  doughnut: "donut",
  area: "area",
  stackedArea: "area",
  normalizedArea: "area",
  histogram: "histogram",
  radarLine: "radar-line",
  radarArea: "radar-area",
  nightingale: "nightingale",
  radialColumn: "radial-column",
  radialBar: "radial-bar",
  sunburst: "sunburst",
  rangeBar: "range-bar",
  rangeArea: "range-area",
  boxPlot: "box-plot",
  treemap: "treemap",
  heatmap: "heatmap",
  waterfall: "waterfall",
  funnel: "funnel",
  coneFunnel: "cone-funnel",
  pyramid: "pyramid",
} as const;

export const AG_CHART_TYPES = Object.keys(
  CHART_TYPE_TO_SERIES_TYPE,
) as ChartTypeExCombo[];

// For srcDoc= iframes (HtmlViewer, Artifact) — would inherit parent origin.
// On-prem with allowHtmlJsExecution enabled intentionally treats uploaded and
// fetched .html file widgets as trusted executable content. allow-same-origin
// is required so HTML widget API calls send the correct Origin header
// (not `null`).
export const IFRAME_SRCDOC_SANDBOX_ATTRIBUTES =
  "allow-scripts allow-forms allow-downloads allow-popups allow-same-origin";

// For src= iframes (Iframe.tsx) — external URL origin, NOT parent origin.
// allow-same-origin lets external site use its own cookies/storage.
// SAFE: different origin cannot access pro.openbb.co localStorage.
export const IFRAME_SANDBOX_ATTRIBUTES = `${IFRAME_SRCDOC_SANDBOX_ATTRIBUTES} allow-same-origin`;

// Widget Metadata Constants
export const WIDGET_STUDIO_TYPE = "widget_studio" as const;
export const WIDGET_METADATA_CONNECTION_TYPE = "widgetMetadata" as const;

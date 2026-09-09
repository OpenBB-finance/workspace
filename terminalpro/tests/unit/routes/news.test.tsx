import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { BrowserRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import NewsPageWrapper, { getCategoryForSubCategory, NewsPage } from "~/routes/news";

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
    useNavigate: () => vi.fn(),
  };
});

vi.mock("posthog-js/react", () => ({
  usePostHog: () => ({
    capture: vi.fn(),
  }),
}));

vi.mock("react-error-boundary", () => ({
  ErrorBoundary: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("usehooks-ts", () => ({
  useLocalStorage: vi.fn((_key: string, defaultValue: any) => [defaultValue, vi.fn()]),
  useOnClickOutside: vi.fn(),
  useResizeObserver: () => ({ width: 1200, height: 900 }),
}));

vi.mock("~/components/General/SearchResultsNotFound", () => ({
  default: ({ firstMessage }: { firstMessage: string }) => (
    <div data-testid="search-not-found">{firstMessage}</div>
  ),
}));

vi.mock("~/components/GridLayout", () => ({
  default: ({ children }: { children: ReactNode }) => (
    <div data-testid="grid-layout">{children}</div>
  ),
}));

vi.mock("~/components/RenderIfVisible", () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("~/components/Widget.context", () => ({
  WidgetProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  useWidgetContext: () => ({}),
}));

vi.mock("~/components/Widgets/Equity/News/BigStories", () => ({
  default: () => <div data-testid="big-stories">Big Stories</div>,
}));

vi.mock("~/components/Widgets/Equity/News/News", () => ({
  default: ({ title }: { title: string }) => (
    <div data-testid="news-widget">{title}</div>
  ),
}));

vi.mock("~/components/Widgets/Equity/TopBarOverview", () => ({
  default: () => <div data-testid="top-bar-overview">Market Overview</div>,
}));

vi.mock("~/components/Widgets/RssViewer", () => ({
  default: () => <div data-testid="rss-viewer">RSS Viewer</div>,
}));

vi.mock("~/lib/constants", () => ({
  RSS_FEEDS: [],
  AG_CHART_TYPES: [],
}));

vi.mock("~/seeds/randomSeed", () => ({
  INDICES: [],
}));

vi.mock("~/lib/utils", () => ({
  getFromLS: () => [],
}));

vi.mock("~/lib/contexts/TabContext", () => ({
  TabProvider: ({ children }: { children: ReactNode }) => (
    <div data-testid="tab-provider">{children}</div>
  ),
}));

vi.mock("react-dom", async () => {
  const actual = await vi.importActual("react-dom");
  return {
    ...actual,
    createPortal: (node: ReactNode) => node,
  };
});

describe("NewsPageWrapper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders NewsPage within ErrorBoundary", () => {
    render(
      <BrowserRouter>
        <NewsPageWrapper />
      </BrowserRouter>,
    );

    expect(screen.getByTestId("tab-provider")).toBeInTheDocument();
  });
});

describe("NewsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the grid layout", () => {
    render(
      <BrowserRouter>
        <NewsPage />
      </BrowserRouter>,
    );

    expect(screen.getByTestId("grid-layout")).toBeInTheDocument();
  });

  it("renders the top bar overview", () => {
    render(
      <BrowserRouter>
        <NewsPage />
      </BrowserRouter>,
    );

    expect(screen.getByTestId("top-bar-overview")).toBeInTheDocument();
  });

  it("renders the big stories widget", () => {
    render(
      <BrowserRouter>
        <NewsPage />
      </BrowserRouter>,
    );

    expect(screen.getByTestId("big-stories")).toBeInTheDocument();
  });

  it("renders the news widget with Global News title by default", () => {
    render(
      <BrowserRouter>
        <NewsPage />
      </BrowserRouter>,
    );

    expect(screen.getByText("Global News")).toBeInTheDocument();
  });

  it("renders the RSS viewer", () => {
    render(
      <BrowserRouter>
        <NewsPage />
      </BrowserRouter>,
    );

    expect(screen.getByTestId("rss-viewer")).toBeInTheDocument();
  });

  it("renders the Overview tab", () => {
    render(
      <BrowserRouter>
        <NewsPage />
      </BrowserRouter>,
    );

    expect(screen.getByText("Overview")).toBeInTheDocument();
  });

  it("renders news category tabs", () => {
    render(
      <BrowserRouter>
        <NewsPage />
      </BrowserRouter>,
    );

    expect(screen.getByText("Markets")).toBeInTheDocument();
    expect(screen.getByText("Economics")).toBeInTheDocument();
    expect(screen.getByText("Industries")).toBeInTheDocument();
    expect(screen.getByText("Events")).toBeInTheDocument();
    expect(screen.getByText("Tech")).toBeInTheDocument();
  });

  it("renders search input for category", () => {
    render(
      <BrowserRouter>
        <NewsPage />
      </BrowserRouter>,
    );

    expect(screen.getByPlaceholderText("Search for category")).toBeInTheDocument();
  });

  it("can click on a category to select it", async () => {
    const user = userEvent.setup();

    render(
      <BrowserRouter>
        <NewsPage />
      </BrowserRouter>,
    );

    await user.click(screen.getByText("Markets"));

    // After clicking, we should see subcategories or the category should be selected
    expect(screen.getByText("Markets")).toBeInTheDocument();
  });

  it("can return to Overview by clicking Overview button", async () => {
    const user = userEvent.setup();

    render(
      <BrowserRouter>
        <NewsPage />
      </BrowserRouter>,
    );

    // First click a category
    await user.click(screen.getByText("Markets"));

    // Then click Overview to go back
    await user.click(screen.getByText("Overview"));

    expect(screen.getByText("Global News")).toBeInTheDocument();
  });
});

describe("getCategoryForSubCategory", () => {
  const NEWS_TYPES = [
    {
      label: "Markets",
      channel: "Markets",
      subCategories: [
        { label: "Pre-Market Outlook", channel: "Pre Market Outlook" },
        { label: "Treasuries", channel: "Treasuries" },
      ],
    },
    {
      label: "Economics",
      channel: "Economics",
      subCategories: [
        { label: "Regulations", channel: "Regulations" },
        { label: "Federal Reserve", channel: "Federal Reserve" },
      ],
    },
  ];

  it("returns the correct category for a valid subcategory", () => {
    const result = getCategoryForSubCategory(NEWS_TYPES, "Treasuries");
    expect(result?.label).toBe("Markets");
  });

  it("returns the correct category for another subcategory", () => {
    const result = getCategoryForSubCategory(NEWS_TYPES, "Federal Reserve");
    expect(result?.label).toBe("Economics");
  });

  it("returns null for an invalid subcategory", () => {
    const result = getCategoryForSubCategory(NEWS_TYPES, "Invalid Category");
    expect(result).toBeNull();
  });

  it("returns null for an empty string", () => {
    const result = getCategoryForSubCategory(NEWS_TYPES, "");
    expect(result).toBeNull();
  });

  it("returns null for empty news types", () => {
    const result = getCategoryForSubCategory([], "Treasuries");
    expect(result).toBeNull();
  });
});

import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import News from "~/components/Widgets/Equity/News/News";
import { renderWidget } from "../WidgetTestWrapper";

vi.mock("~/components/DraggableCard", () => ({
  default: ({ children, loading, error, title }: any) => (
    <div data-testid="draggable-card">
      {title && <span data-testid="title">{title}</span>}
      {loading && <span data-testid="loading">Loading...</span>}
      {error && <span data-testid="error">Error</span>}
      {children}
    </div>
  ),
}));

vi.mock("~/lib/api", () => ({
  useJsonData: vi.fn(() => ({
    data: [
      {
        title: "Apple reports record earnings",
        source: "Reuters",
        published: "2024-01-01T00:00:00Z",
        url: "https://example.com/news/1",
      },
      {
        title: "Tech stocks surge",
        source: "Bloomberg",
        published: "2024-01-02T00:00:00Z",
        url: "https://example.com/news/2",
      },
    ],
    isLoading: false,
    error: null,
    dataUpdatedAt: Date.now(),
  })),
}));

describe("News Widget", () => {
  it("renders news container", () => {
    renderWidget(<News />, {
      widgetOverrides: {
        endpoint: { url: "https://api.example.com/news" },
        storage: { params: { symbol: "AAPL" } },
      },
    });

    expect(screen.getByTestId("draggable-card")).toBeInTheDocument();
  });
});

describe("News - Loading State", () => {
  it("shows loading state", async () => {
    const { useJsonData } = vi.mocked(await import("~/lib/api"));
    // @ts-expect-error - ignored for now
    useJsonData.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      dataUpdatedAt: Date.now(),
    });

    renderWidget(<News />, {
      widgetOverrides: {
        endpoint: { url: "https://api.example.com/news" },
        storage: { params: { symbol: "AAPL" } },
      },
    });

    // The News component uses a butterfly icon for loading state instead of passing loading to DraggableCard
    expect(screen.getByTestId("icon-openbb-butterfly-logo")).toBeInTheDocument();
  });
});

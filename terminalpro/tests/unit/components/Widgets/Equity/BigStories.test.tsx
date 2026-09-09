import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import BigStories from "~/components/Widgets/Equity/News/BigStories";
import { renderWidget } from "../WidgetTestWrapper";

vi.mock("~/components/DraggableCard", () => ({
  default: ({ children, loading, error }: any) => (
    <div data-testid="draggable-card">
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
        title: "Big Breaking Story",
        image: "https://example.com/image.jpg",
        source: "Reuters",
        published: "2024-01-01T00:00:00Z",
      },
    ],
    isLoading: false,
    error: null,
    dataUpdatedAt: Date.now(),
  })),
}));

describe("BigStories Widget", () => {
  it("renders big stories container", () => {
    renderWidget(<BigStories />, {
      widgetOverrides: {
        endpoint: { url: "https://api.example.com/stories" },
        storage: { params: {} },
      },
    });

    expect(screen.getByTestId("draggable-card")).toBeInTheDocument();
  });
});

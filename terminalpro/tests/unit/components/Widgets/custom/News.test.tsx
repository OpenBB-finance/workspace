import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CustomNews from "~/components/Widgets/custom/News";
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
        title: "News Item 1",
        excerpt: "Description 1",
        url: "https://example.com/1",
        date: "2024-01-15T10:00:00Z",
        author: "Test Author 1",
        body: "News body content 1",
      },
      {
        title: "News Item 2",
        excerpt: "Description 2",
        url: "https://example.com/2",
        date: "2024-01-16T11:00:00Z",
        author: "Test Author 2",
        body: "News body content 2",
      },
    ],
    isLoading: false,
    error: null,
    dataUpdatedAt: Date.now(),
  })),
}));

vi.mock("~/components/General/Table/NavBar/QueryParams", () => ({
  useWidgetParamsPositions: () => ({
    renderRow0Params: null,
    renderBelowNavbarRows: null,
  }),
}));

describe("CustomNews Widget", () => {
  it("renders custom news container", () => {
    renderWidget(<CustomNews />, {
      widgetOverrides: {
        endpoint: { url: "https://api.example.com/news" },
        storage: { params: {} },
      },
    });

    expect(screen.getByTestId("draggable-card")).toBeInTheDocument();
  });
});

describe("CustomNews - Loading State", () => {
  it("shows loading state", async () => {
    const { useJsonData } = vi.mocked(await import("~/lib/api"));
    // @ts-expect-error - ignored for now
    useJsonData.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      dataUpdatedAt: Date.now(),
    });

    renderWidget(<CustomNews />, {
      widgetOverrides: {
        endpoint: { url: "https://api.example.com/news" },
        storage: { params: {} },
      },
    });

    expect(screen.getByTestId("loading")).toBeInTheDocument();
  });
});

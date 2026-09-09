import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CompanyEvents from "~/components/Widgets/Equity/CompanyEvents";
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
      { event: "Earnings Call", date: "2024-01-25", time: "16:30" },
      { event: "Annual Meeting", date: "2024-02-15", time: "10:00" },
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

describe("CompanyEvents Widget", () => {
  it("renders company events container", () => {
    renderWidget(<CompanyEvents />, {
      widgetOverrides: {
        endpoint: { url: "https://api.example.com/events" },
        storage: { params: { symbol: "AAPL" } },
      },
    });

    expect(screen.getByTestId("draggable-card")).toBeInTheDocument();
  });
});

describe("CompanyEvents - Loading State", () => {
  it("shows loading state", async () => {
    const { useJsonData } = vi.mocked(await import("~/lib/api"));
    // @ts-expect-error - ignored for now
    useJsonData.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      dataUpdatedAt: Date.now(),
    });

    renderWidget(<CompanyEvents />, {
      widgetOverrides: {
        endpoint: { url: "https://api.example.com/events" },
        storage: { params: { symbol: "AAPL" } },
      },
    });

    expect(screen.getByTestId("loading")).toBeInTheDocument();
  });
});

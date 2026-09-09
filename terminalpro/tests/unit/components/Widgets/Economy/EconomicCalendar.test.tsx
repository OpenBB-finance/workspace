import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import EconomicCalendar from "~/components/Widgets/Economy/EconomicCalendar";
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
      { event: "GDP Report", date: "2024-01-15", impact: "High", country: "US" },
      { event: "CPI Data", date: "2024-01-20", impact: "High", country: "US" },
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

describe("EconomicCalendar Widget", () => {
  it("renders economic calendar container", () => {
    renderWidget(<EconomicCalendar />, {
      widgetOverrides: {
        endpoint: { url: "https://api.example.com/calendar" },
        storage: { params: {} },
      },
    });

    expect(screen.getByTestId("draggable-card")).toBeInTheDocument();
  });
});

describe("EconomicCalendar - Loading State", () => {
  it("shows loading state", async () => {
    const { useJsonData } = vi.mocked(await import("~/lib/api"));
    // @ts-expect-error - ignored for now
    useJsonData.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      dataUpdatedAt: Date.now(),
    });

    renderWidget(<EconomicCalendar />, {
      widgetOverrides: {
        endpoint: { url: "https://api.example.com/calendar" },
        storage: { params: {} },
      },
    });

    expect(screen.getByTestId("loading")).toBeInTheDocument();
  });
});

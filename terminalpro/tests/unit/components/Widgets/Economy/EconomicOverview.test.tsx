import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import EconomicOverview from "~/components/Widgets/Economy/EconomicOverview";
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
    data: {
      gdp: 25000000000000,
      inflation: 3.2,
      unemployment: 3.7,
      interest_rate: 5.25,
    },
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

describe("EconomicOverview Widget", () => {
  it("renders economic overview container", () => {
    renderWidget(<EconomicOverview />, {
      widgetOverrides: {
        endpoint: { url: "https://api.example.com/overview" },
        storage: { params: {} },
      },
    });

    expect(screen.getByTestId("draggable-card")).toBeInTheDocument();
  });
});

describe("EconomicOverview - Loading State", () => {
  it("shows loading state", async () => {
    const { useJsonData } = vi.mocked(await import("~/lib/api"));
    // @ts-expect-error - ignored for now
    useJsonData.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      dataUpdatedAt: Date.now(),
    });

    renderWidget(<EconomicOverview />, {
      widgetOverrides: {
        endpoint: { url: "https://api.example.com/overview" },
        storage: { params: {} },
      },
    });

    expect(screen.getByTestId("loading")).toBeInTheDocument();
  });
});

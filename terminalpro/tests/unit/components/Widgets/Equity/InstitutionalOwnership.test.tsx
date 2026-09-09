import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import InstitutionalOwnership from "~/components/Widgets/Equity/InstitutionalOwnership";
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
      { investor: "Vanguard Group", shares: 1200000000, percent: 8.5 },
      { investor: "BlackRock", shares: 1000000000, percent: 7.2 },
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

describe("InstitutionalOwnership Widget", () => {
  it("renders institutional ownership container", () => {
    renderWidget(<InstitutionalOwnership />, {
      widgetOverrides: {
        endpoint: { url: "https://api.example.com/ownership" },
        storage: { params: { symbol: "AAPL" } },
      },
    });

    expect(screen.getByTestId("draggable-card")).toBeInTheDocument();
  });
});

describe("InstitutionalOwnership - Loading State", () => {
  it("shows loading state", async () => {
    const { useJsonData } = vi.mocked(await import("~/lib/api"));
    // @ts-expect-error - ignored for now
    useJsonData.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      dataUpdatedAt: Date.now(),
    });

    renderWidget(<InstitutionalOwnership />, {
      widgetOverrides: {
        endpoint: { url: "https://api.example.com/ownership" },
        storage: { params: { symbol: "AAPL" } },
      },
    });

    expect(screen.getByTestId("loading")).toBeInTheDocument();
  });
});

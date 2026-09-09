import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MetricWidget from "~/components/Widgets/Metric";
import { useJsonData } from "~/lib/api";
import { renderWidget } from "./WidgetTestWrapper";

vi.mock("~/lib/api", () => ({
  useJsonData: vi.fn(),
}));

vi.mock("~/components/DraggableCard", () => ({
  default: ({ children, loading, error, errorMessage }: any) => (
    <div data-testid="draggable-card">
      {loading && <span>Loading...</span>}
      {error && <span>Error: {errorMessage}</span>}
      {children}
    </div>
  ),
}));

vi.mock("../General/Table/NavBar/QueryParams", () => ({
  useWidgetParamsPositions: () => ({}),
}));

describe("MetricWidget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading state", () => {
    vi.mocked(useJsonData).mockReturnValue({
      isLoading: true,
      data: null,
      error: null,
    } as any);

    renderWidget(<MetricWidget />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("renders metric data correctly", () => {
    vi.mocked(useJsonData).mockReturnValue({
      isLoading: false,
      data: { label: "Revenue", value: "$1M", delta: "10%" },
      error: null,
    } as any);

    renderWidget(<MetricWidget />);
    expect(screen.getByText("Revenue")).toBeInTheDocument();
    expect(screen.getByText("$1M")).toBeInTheDocument();
    expect(screen.getByText("↑ 10%")).toBeInTheDocument();
  });

  it("renders error state when no data", () => {
    vi.mocked(useJsonData).mockReturnValue({
      isLoading: false,
      data: null,
      error: new Error("Fail"),
    } as any);

    renderWidget(<MetricWidget />);
    expect(screen.getByText(/Error: No results found/)).toBeInTheDocument();
  });
});

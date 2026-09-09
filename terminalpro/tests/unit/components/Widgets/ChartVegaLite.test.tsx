import { screen, waitFor } from "@testing-library/react";
import { forwardRef } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ChartVegaLite from "~/components/Widgets/charting/ChartVegaLite";
import { useJsonData } from "~/lib/api";
import { renderWidget } from "./WidgetTestWrapper";

vi.mock("~/lib/api", () => ({
  useJsonData: vi.fn(),
}));

vi.mock("~/components/DraggableCard", () => ({
  default: ({
    children,
    loading,
    error,
    errorMessage,
    aiData,
    extraNavbarElements,
  }: any) => (
    <div
      data-testid="draggable-card"
      data-ai-data={aiData ? JSON.stringify(aiData) : ""}
    >
      {extraNavbarElements}
      {loading && <span>Loading...</span>}
      {error && <span>Error: {errorMessage}</span>}
      {children}
    </div>
  ),
  SetLoadingOnResize: ({ children }: any) => <>{children}</>,
}));

vi.mock("~/components/General/Table/NavBar/QueryParams", () => ({
  useWidgetParamsPositions: () => ({
    renderRow0Params: null,
    renderBelowNavbarRows: null,
  }),
}));

vi.mock("~/lib/state/theme", () => ({
  useShallowThemeStore: vi.fn((selector: any) => selector({ theme: "dark" })),
}));

vi.mock("react-vega", () => ({
  VegaEmbed: forwardRef<HTMLDivElement, any>((props, ref) => (
    <div
      ref={ref}
      data-testid="_vega-lite"
      data-spec={JSON.stringify(props.spec)}
      data-actions={String(props.options?.actions)}
      data-renderer={props.options?.renderer}
    />
  )),
}));

vi.mock("react-resize-detector", () => ({
  useResizeDetector: () => ({ width: 800, height: 500, ref: { current: null } }),
}));

vi.mock("~/components/General/Table/hooks", () => ({
  Table: ({ children }: any) => <div data-testid="_raw-table">{children}</div>,
  AgGridProvider: ({ rowData }: any) => (
    <div data-testid="_ag-grid" data-rows={JSON.stringify(rowData)} />
  ),
}));

vi.mock("~/components/General/Table/AgGridUtils", () => ({
  getColumnDefs: vi.fn(() => []),
  isDate: (_value: any) => false,
}));

const widgetOverrides = {
  endpoint: { url: "https://example.com/spec", query: { symbol: "AAPL" } },
};

describe("ChartVegaLite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading state", () => {
    vi.mocked(useJsonData).mockReturnValue({
      isLoading: true,
      data: null,
      error: null,
      dataUpdatedAt: 0,
    } as any);

    renderWidget(<ChartVegaLite />, { widgetOverrides });
    expect(screen.getByText("Loading...")).toBeInTheDocument();
    expect(screen.queryByTestId("_vega-lite")).not.toBeInTheDocument();
  });

  it("renders error state when no data", () => {
    vi.mocked(useJsonData).mockReturnValue({
      isLoading: false,
      data: null,
      error: new Error("fail"),
      dataUpdatedAt: 0,
    } as any);

    renderWidget(<ChartVegaLite />, { widgetOverrides });
    expect(screen.getByText(/Error: No results found/)).toBeInTheDocument();
    expect(screen.queryByTestId("_vega-lite")).not.toBeInTheDocument();
  });

  it("forwards fetched spec to VegaLite with canvas renderer and actions disabled", async () => {
    const spec = {
      mark: "bar",
      data: { values: [{ x: "A", y: 1 }] },
      encoding: {
        x: { field: "x", type: "nominal" },
        y: { field: "y", type: "quantitative" },
      },
    };
    vi.mocked(useJsonData).mockReturnValue({
      isLoading: false,
      data: spec,
      error: null,
      dataUpdatedAt: 123,
    } as any);

    renderWidget(<ChartVegaLite />, { widgetOverrides });

    const vega = await waitFor(() => screen.getByTestId("_vega-lite"));
    const passed = JSON.parse(vega.getAttribute("data-spec") ?? "null");
    expect(passed).toMatchObject(spec);
    expect(vega.getAttribute("data-actions")).toBe("false");
    expect(vega.getAttribute("data-renderer")).toBe("canvas");
  });

  it("sizes the spec to the measured container width and height", async () => {
    const spec = {
      mark: "bar",
      width: 100,
      height: 100,
      autosize: "pad",
      data: { values: [{ x: "A", y: 1 }] },
    };
    vi.mocked(useJsonData).mockReturnValue({
      isLoading: false,
      data: spec,
      error: null,
      dataUpdatedAt: 0,
    } as any);

    renderWidget(<ChartVegaLite />, { widgetOverrides });

    const vega = await waitFor(() => screen.getByTestId("_vega-lite"));
    const passed = JSON.parse(vega.getAttribute("data-spec") ?? "null");
    expect(passed.width).toBe(800);
    expect(passed.height).toBe(500);
    expect(passed.autosize).toBe("fit");
  });

  it("passes raw spec as aiData on DraggableCard", async () => {
    const spec = { mark: "bar", data: { values: [{ x: "A", y: 1 }] } };
    vi.mocked(useJsonData).mockReturnValue({
      isLoading: false,
      data: spec,
      error: null,
      dataUpdatedAt: 0,
    } as any);

    renderWidget(<ChartVegaLite />, { widgetOverrides });

    const card = screen.getByTestId("draggable-card");
    expect(JSON.parse(card.getAttribute("data-ai-data") ?? "null")).toEqual(spec);
  });

  it("does not render a raw-data toggle when the widget has no raw flag", () => {
    vi.mocked(useJsonData).mockReturnValue({
      isLoading: false,
      data: { mark: "bar" },
      error: null,
      dataUpdatedAt: 0,
    } as any);

    renderWidget(<ChartVegaLite />, { widgetOverrides });
    expect(screen.queryByTestId("_raw-table")).not.toBeInTheDocument();
    expect(document.getElementById("raw-data-toggle-button")).not.toBeInTheDocument();
  });

  it("renders a raw-data toggle and keeps the chart when raw flag is set", () => {
    vi.mocked(useJsonData).mockReturnValue({
      isLoading: false,
      data: { mark: "bar", data: { values: [{ x: "A", y: 1 }] } },
      error: null,
      dataUpdatedAt: 0,
    } as any);

    renderWidget(<ChartVegaLite />, {
      widgetOverrides: { ...widgetOverrides, raw: true },
    });

    expect(document.getElementById("raw-data-toggle-button")).toBeInTheDocument();
    expect(screen.getByTestId("_vega-lite")).toBeInTheDocument();
    expect(screen.queryByTestId("_raw-table")).not.toBeInTheDocument();
  });

  it("switches to a data table when rawDataView is enabled", () => {
    const records = [{ tokenSymbol: "ETH", tvl: 50 }];
    vi.mocked(useJsonData).mockReturnValue({
      isLoading: false,
      data: { results: records },
      error: null,
      dataUpdatedAt: 0,
    } as any);

    renderWidget(<ChartVegaLite />, {
      widgetOverrides: {
        ...widgetOverrides,
        raw: true,
        storage: { rawDataView: true },
      },
    });

    expect(screen.getByTestId("_raw-table")).toBeInTheDocument();
    expect(screen.queryByTestId("_vega-lite")).not.toBeInTheDocument();

    const grid = screen.getByTestId("_ag-grid");
    expect(JSON.parse(grid.getAttribute("data-rows") ?? "[]")).toEqual(records);

    const card = screen.getByTestId("draggable-card");
    expect(JSON.parse(card.getAttribute("data-ai-data") ?? "null")).toEqual(records);
  });

  it("injects theme into query params (Highcharts parity)", () => {
    vi.mocked(useJsonData).mockReturnValue({
      isLoading: false,
      data: { mark: "bar" },
      error: null,
      dataUpdatedAt: 0,
    } as any);

    renderWidget(<ChartVegaLite />, { widgetOverrides });

    const call = vi.mocked(useJsonData).mock.calls.at(-1);
    expect(call?.[0]?.params).toMatchObject({ symbol: "AAPL", theme: "dark" });
  });
});

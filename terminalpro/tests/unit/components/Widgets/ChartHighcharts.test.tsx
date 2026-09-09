import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ChartHighcharts from "~/components/Widgets/charting/ChartHighcharts";
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

vi.mock("highcharts-react-official", () => ({
  default: (props: any) => (
    <div
      data-testid="_highcharts"
      data-constructor={props.constructorType}
      data-options={JSON.stringify(props.options)}
    />
  ),
}));

vi.mock("highcharts/highcharts", () => ({ default: {} }));
vi.mock("highcharts/highcharts-gantt", () => ({ default: {} }));
vi.mock("highcharts/highmaps", () => ({ default: {} }));
vi.mock("highcharts/highstock", () => ({ default: {} }));

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
  endpoint: { url: "https://example.com/chart", query: { symbol: "AAPL" } },
};

const chartData = {
  constructorType: "chart",
  userOptions: { series: [{ data: [1, 2, 3] }] },
};

describe("ChartHighcharts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the Highcharts chart from fetched options", () => {
    vi.mocked(useJsonData).mockReturnValue({
      isLoading: false,
      data: chartData,
      error: null,
      dataUpdatedAt: 0,
    } as any);

    renderWidget(<ChartHighcharts />, { widgetOverrides });
    expect(screen.getByTestId("_highcharts")).toBeInTheDocument();
  });

  it("does not render a raw-data toggle when the widget has no raw flag", () => {
    vi.mocked(useJsonData).mockReturnValue({
      isLoading: false,
      data: chartData,
      error: null,
      dataUpdatedAt: 0,
    } as any);

    renderWidget(<ChartHighcharts />, { widgetOverrides });
    expect(document.getElementById("raw-data-toggle-button")).not.toBeInTheDocument();
    expect(screen.queryByTestId("_raw-table")).not.toBeInTheDocument();
  });

  it("renders a raw-data toggle and keeps the chart when raw flag is set", () => {
    vi.mocked(useJsonData).mockReturnValue({
      isLoading: false,
      data: chartData,
      error: null,
      dataUpdatedAt: 0,
    } as any);

    renderWidget(<ChartHighcharts />, {
      widgetOverrides: { ...widgetOverrides, raw: true },
    });

    expect(document.getElementById("raw-data-toggle-button")).toBeInTheDocument();
    expect(screen.getByTestId("_highcharts")).toBeInTheDocument();
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

    renderWidget(<ChartHighcharts />, {
      widgetOverrides: {
        ...widgetOverrides,
        raw: true,
        storage: { rawDataView: true },
      },
    });

    expect(screen.getByTestId("_raw-table")).toBeInTheDocument();
    expect(screen.queryByTestId("_highcharts")).not.toBeInTheDocument();

    const grid = screen.getByTestId("_ag-grid");
    expect(JSON.parse(grid.getAttribute("data-rows") ?? "[]")).toEqual(records);

    const card = screen.getByTestId("draggable-card");
    expect(JSON.parse(card.getAttribute("data-ai-data") ?? "null")).toEqual(records);
  });
});

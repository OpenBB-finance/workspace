import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AgChart from "~/components/Widgets/AgChart";

vi.mock("ag-charts-react", () => ({
  AgCharts: ({ options }: any) => (
    <div data-testid="ag-charts" data-options={JSON.stringify(options)}>
      AG Charts
    </div>
  ),
}));

vi.mock("~/lib/state/theme", () => ({
  useShallowThemeStore: () => ({
    theme: "dark",
  }),
}));

vi.mock("~/components/Widget.context", () => ({
  useWidgetContext: () => ({
    widget: {
      storage: {
        content: [
          { date: "2024-01-01", value: 100 },
          { date: "2024-01-02", value: 150 },
        ],
        chart_params: {
          chartType: "bar",
          xKey: "date",
          yKey: ["value"],
        },
      },
    },
  }),
}));

vi.mock("~/components/DraggableCard", () => ({
  default: ({ children }: any) => <div data-testid="draggable-card">{children}</div>,
  SetLoadingOnResize: ({ children }: any) => (
    <div data-testid="set-loading-on-resize">{children}</div>
  ),
}));

describe("AgChartWidget", () => {
  it("renders chart container", () => {
    render(<AgChart />);

    expect(screen.getByTestId("draggable-card")).toBeInTheDocument();
  });

  it("renders AG Charts component", () => {
    render(<AgChart />);

    expect(screen.getByTestId("ag-charts")).toBeInTheDocument();
  });

  it("wraps chart in SetLoadingOnResize", () => {
    render(<AgChart />);

    expect(screen.getByTestId("set-loading-on-resize")).toBeInTheDocument();
  });

  it("passes options to AG Charts", () => {
    render(<AgChart />);

    const chart = screen.getByTestId("ag-charts");
    const options = JSON.parse(chart.getAttribute("data-options") || "{}");

    expect(options.data).toEqual([
      { date: "2024-01-01", value: 100 },
      { date: "2024-01-02", value: 150 },
    ]);
  });

  it("uses dark theme when theme is dark", () => {
    render(<AgChart />);

    const chart = screen.getByTestId("ag-charts");
    const options = JSON.parse(chart.getAttribute("data-options") || "{}");

    expect(options.theme.baseTheme).toBe("ag-default-dark");
  });

  it("configures series based on yKey", () => {
    render(<AgChart />);

    const chart = screen.getByTestId("ag-charts");
    const options = JSON.parse(chart.getAttribute("data-options") || "{}");

    expect(options.series).toHaveLength(1);
    expect(options.series[0].type).toBe("bar");
    expect(options.series[0].xKey).toBe("date");
    expect(options.series[0].yKey).toBe("value");
  });

  it("configures legend", () => {
    render(<AgChart />);

    const chart = screen.getByTestId("ag-charts");
    const options = JSON.parse(chart.getAttribute("data-options") || "{}");

    expect(options.legend.enabled).toBe(true);
    expect(options.legend.position).toBe("top");
  });
});

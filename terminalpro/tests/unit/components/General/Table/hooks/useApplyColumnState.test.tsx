import { render } from "@testing-library/react";
import type { MutableRefObject } from "react";
import { describe, expect, it, vi } from "vitest";
import { AgGridContext } from "~/components/General/Table/hooks/useTableContext";
import { useApplyColumnState } from "~/components/General/Table/hooks/useUpdateColumnState";
import { WidgetContext } from "~/components/Widget.context";

// Saved widths for a table below the auto-fit threshold (6 columns) — the
// case where restoring used to wipe user widths on chart-view toggles
const savedWidths = [
  { colId: "a", width: 222 },
  { colId: "b", width: 333 },
];

const createWidget = (chartEnabled: boolean) => ({
  uuid: "test-uuid",
  id: "test-id",
  type: "custom",
  widgetId: "custom_widget",
  storage: {
    chartView: { enabled: chartEnabled },
  },
  data: {
    table: {
      columnState: {
        default: {
          columnOrder: { orderedColIds: ["a", "b"] },
          columnSizing: { columnSizingModel: savedWidths },
        },
      },
    },
  },
});

const createGridApi = () => ({
  isDestroyed: () => false,
  getColumnState: vi.fn(() => [
    { colId: "a", width: 300 },
    { colId: "b", width: 300 },
  ]),
  applyColumnState: vi.fn(),
  setFilterModel: vi.fn(),
  setRowGroupColumns: vi.fn(),
  getColumnGroupState: vi.fn(() => []),
  setColumnGroupState: vi.fn(),
  forEachNode: vi.fn(),
  openToolPanel: vi.fn(),
  getAllDisplayedColumns: vi.fn(() => [{}, {}]),
  sizeColumnsToFit: vi.fn(),
  autoSizeAllColumns: vi.fn(),
  autoSizeColumns: vi.fn(),
});

type HarnessOptions = {
  widget: ReturnType<typeof createWidget>;
  /** Simulates the store already holding a newer widget than the closure */
  liveWidget?: ReturnType<typeof createWidget>;
  previousChartEnabledRef: MutableRefObject<boolean | undefined>;
};

const renderApplyColumnState = ({
  widget,
  liveWidget,
  previousChartEnabledRef,
}: HarnessOptions) => {
  let applyColumnState: ReturnType<typeof useApplyColumnState>;

  const Harness = () => {
    applyColumnState = useApplyColumnState();
    return null;
  };

  const agGridValue = {
    gridRef: { current: null },
    chartRef: { current: null },
    chartViewElementRef: { current: null },
    columnDefsRef: { current: [] },
    getGridState: () => ({ columnDefs: [{ field: "a" }, { field: "b" }] }),
    updateAgGrid: vi.fn(),
    previousChartEnabledRef,
  };

  render(
    <WidgetContext.Provider
      value={
        {
          widget,
          widgetRef: { current: widget },
          activeDashboardId: "test-dashboard",
          updateWidget: vi.fn(),
          getWidget: () => liveWidget ?? widget,
        } as any
      }
    >
      <AgGridContext.Provider value={agGridValue as any}>
        <Harness />
      </AgGridContext.Provider>
    </WidgetContext.Provider>,
  );

  return applyColumnState!;
};

const flushRestore = () => new Promise((resolve) => setTimeout(resolve, 30));

describe("useApplyColumnState chart-view transitions", () => {
  it("keeps saved column widths when restoring the table as chart view closes", async () => {
    // Toggle-off flow: ChartViewButton's setView stamps the shared ref before
    // flipping storage, then handleChartViewToggle calls applyColumnState with
    // ignoreChart=true while the hook closure still sees enabled=true
    const api = createGridApi();
    const previousChartEnabledRef = { current: true };

    const applyColumnState = renderApplyColumnState({
      widget: createWidget(true),
      liveWidget: createWidget(false),
      previousChartEnabledRef,
    });

    applyColumnState({ api } as any, true);
    await flushRestore();

    expect(api.applyColumnState).toHaveBeenCalledWith(
      expect.objectContaining({
        state: expect.arrayContaining([
          expect.objectContaining({ colId: "a", width: 222 }),
          expect.objectContaining({ colId: "b", width: 333 }),
        ]),
      }),
    );
    expect(api.sizeColumnsToFit).not.toHaveBeenCalled();
    expect(api.autoSizeAllColumns).not.toHaveBeenCalled();
  });

  it("keeps saved column widths on the follow-up restore after the chart closed", async () => {
    // e.g. onNewColumnsLoaded fires after the toggle re-render: chart is off
    // everywhere, only the shared flag (cleared by setView's delayed reset)
    // says we just came back from chart view
    const api = createGridApi();
    const previousChartEnabledRef = { current: true };

    const applyColumnState = renderApplyColumnState({
      widget: createWidget(false),
      previousChartEnabledRef,
    });

    applyColumnState({ api } as any);
    await flushRestore();

    expect(api.sizeColumnsToFit).not.toHaveBeenCalled();
    expect(api.autoSizeAllColumns).not.toHaveBeenCalled();
  });

  it("still auto-fits small tables on restores unrelated to chart view", async () => {
    const api = createGridApi();
    const previousChartEnabledRef = { current: false };

    const applyColumnState = renderApplyColumnState({
      widget: createWidget(false),
      previousChartEnabledRef,
    });

    applyColumnState({ api } as any);
    await flushRestore();

    expect(api.sizeColumnsToFit).toHaveBeenCalled();
  });
});

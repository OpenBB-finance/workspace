import { describe, expect, it, vi } from "vitest";
import { getChartWidgetData } from "~/components/Widgets/Chart";

// Test the exported getChartWidgetData function
vi.mock("~/components/Charting/utils", () => ({
  downloadData: vi.fn(),
  getExportData: vi.fn(async (data) => data),
}));

vi.mock("~/components/Charting/ChartCallbacks", () => ({
  getChartCallback: vi.fn((callbackName: string) => {
    if (callbackName === "testCallback") {
      const testCallback = async (results: any, _symbol: string) => ({
        plotData: { data: [{ x: [1, 2], y: [3, 4] }], layout: {} },
        exportData: results,
      });
      return testCallback;
    }
    return undefined;
  }),
  // Add a placeholder for any callback access to avoid errors
  nonExistentCallback: undefined,
}));

describe("getChartWidgetData function", () => {
  it("returns data directly for non-SDK widgets", async () => {
    const widget = { sdkFunc: undefined };
    const results = { data: [{ x: 1, y: 2 }], layout: {} };

    const { data, exportData } = await getChartWidgetData(widget, results);

    expect(data).toEqual(results);
    expect(exportData).toEqual(results);
  });

  it("returns null for SDK widgets without matching callback", async () => {
    const widget = {
      sdkFunc: "someFunction",
      data: { chart: { callback: "nonExistentCallback" } },
    };
    const results = { some: "data" };

    const result = await getChartWidgetData(widget, results);

    expect(result.data).toBeNull();
    expect(result.exportData).toBeNull();
  });

  it("uses callback for SDK widgets with matching callback", async () => {
    const widget = {
      sdkFunc: "someFunction",
      data: { chart: { callback: "testCallback" } },
    };
    const results = { some: "data" };

    const { data, exportData } = await getChartWidgetData(widget, results, "AAPL");

    expect(data).toEqual({ data: [{ x: [1, 2], y: [3, 4] }], layout: {} });
    expect(exportData).toEqual(results);
  });

  it("handles undefined results for non-SDK widgets", async () => {
    const widget = { sdkFunc: undefined };

    const { data, exportData } = await getChartWidgetData(widget, undefined);

    // data is undefined (passed through), but exportData gets a fallback from getExportData
    expect(data).toBeUndefined();
    // exportData receives { data: [], layout: {} } as fallback
    expect(exportData).toEqual({ data: [], layout: {} });
  });
});

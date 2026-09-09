import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WidgetT } from "~/components/types";
import type { WidgetSignature } from "~/lib/state/copilot";
import type { DashboardWidgetData } from "~/lib/state/copilotData";

// Mock external dependencies
vi.mock("~/lib/utils/widgetParams", () => ({
  currentDateModifier: vi.fn((value) => value), // Default passthrough
}));

import * as utilsModule from "~/components/AI/hooks/utils";
import {
  compareSignatures,
  createSignatureMap,
  detectQueryMismatch,
} from "~/components/AI/hooks/utils";
// Import after mocking
import { currentDateModifier } from "~/lib/utils/widgetParams";

// Helper function to create test widgets with proper typing
const createTestWidget = (overrides: Partial<WidgetT> = {}): WidgetT => ({
  id: "test-widget",
  name: "Test Widget",
  type: "table",
  widgetId: "test_widget" as any,
  params: [] as any,
  ...overrides,
});

const mockCurrentDateModifier = vi.mocked(currentDateModifier);

// Spy on getWidgetOrigin function
const mockGetWidgetOrigin = vi.spyOn(utilsModule, "getWidgetOrigin");

describe("compareSignatures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("when both signatures are undefined or null", () => {
    it("should return false when sig1 is undefined", () => {
      const sig2: WidgetSignature = {
        origin: "OpenBB Sandbox",
        widgetId: "test-widget",
        args: { param1: "value1" },
      };

      expect(compareSignatures(undefined, sig2)).toBe(false);
    });

    it("should return false when sig2 is undefined", () => {
      const sig1: WidgetSignature = {
        origin: "OpenBB Sandbox",
        widgetId: "test-widget",
        args: { param1: "value1" },
      };

      expect(compareSignatures(sig1, undefined)).toBe(false);
    });

    it("should return false when both signatures are undefined", () => {
      expect(compareSignatures(undefined, undefined)).toBe(false);
    });
  });

  describe("when comparing valid signatures", () => {
    it("should return true when all fields match exactly", () => {
      const sig1: WidgetSignature = {
        origin: "OpenBB Sandbox",
        widgetId: "equity_price",
        args: { symbol: "AAPL", period: "1y" },
      };

      const sig2: WidgetSignature = {
        origin: "OpenBB Sandbox",
        widgetId: "equity_price",
        args: { symbol: "AAPL", period: "1y" },
      };

      expect(compareSignatures(sig1, sig2)).toBe(true);
    });

    it("should return false when origin differs", () => {
      const sig1: WidgetSignature = {
        origin: "OpenBB Sandbox",
        widgetId: "equity_price",
        args: { symbol: "AAPL" },
      };

      const sig2: WidgetSignature = {
        origin: "OpenBB Workspace",
        widgetId: "equity_price",
        args: { symbol: "AAPL" },
      };

      expect(compareSignatures(sig1, sig2)).toBe(false);
    });

    it("should return false when widgetId differs", () => {
      const sig1: WidgetSignature = {
        origin: "OpenBB Sandbox",
        widgetId: "equity_price",
        args: { symbol: "AAPL" },
      };

      const sig2: WidgetSignature = {
        origin: "OpenBB Sandbox",
        widgetId: "equity_chart",
        args: { symbol: "AAPL" },
      };

      expect(compareSignatures(sig1, sig2)).toBe(false);
    });

    it("should match prefixed and canonical widgetId forms for external widgets", () => {
      const sig1: WidgetSignature = {
        origin: "DTCC",
        widgetId: "DTCC-fixed_income/treasury_volumes",
        args: { time_period: "1M" },
      };

      const sig2: WidgetSignature = {
        origin: "DTCC",
        widgetId: "fixed_income/treasury_volumes",
        args: { time_period: "1M" },
      };

      expect(compareSignatures(sig1, sig2)).toBe(true);
    });

    it("should return false when args differ", () => {
      const sig1: WidgetSignature = {
        origin: "OpenBB Sandbox",
        widgetId: "equity_price",
        args: { symbol: "AAPL", period: "1y" },
      };

      const sig2: WidgetSignature = {
        origin: "OpenBB Sandbox",
        widgetId: "equity_price",
        args: { symbol: "TSLA", period: "1y" },
      };

      expect(compareSignatures(sig1, sig2)).toBe(false);
    });

    it("should return false when args have different structure", () => {
      const sig1: WidgetSignature = {
        origin: "OpenBB Sandbox",
        widgetId: "equity_price",
        args: { symbol: "AAPL" },
      };

      const sig2: WidgetSignature = {
        origin: "OpenBB Sandbox",
        widgetId: "equity_price",
        args: { symbol: "AAPL", period: "1y" },
      };

      expect(compareSignatures(sig1, sig2)).toBe(false);
    });

    it("should handle complex nested args objects", () => {
      const complexArgs = {
        symbol: "AAPL",
        config: {
          chart: { type: "line", colors: ["red", "blue"] },
          data: { normalize: true, limit: 100 },
        },
        filters: ["price", "volume"],
      };

      const sig1: WidgetSignature = {
        origin: "OpenBB Sandbox",
        widgetId: "complex_widget",
        args: complexArgs,
      };

      const sig2: WidgetSignature = {
        origin: "OpenBB Sandbox",
        widgetId: "complex_widget",
        args: { ...complexArgs },
      };

      expect(compareSignatures(sig1, sig2)).toBe(true);
    });

    it("should detect differences in nested args objects", () => {
      const sig1: WidgetSignature = {
        origin: "OpenBB Sandbox",
        widgetId: "complex_widget",
        args: {
          symbol: "AAPL",
          config: { chart: { type: "line" } },
        },
      };

      const sig2: WidgetSignature = {
        origin: "OpenBB Sandbox",
        widgetId: "complex_widget",
        args: {
          symbol: "AAPL",
          config: { chart: { type: "bar" } },
        },
      };

      expect(compareSignatures(sig1, sig2)).toBe(false);
    });

    it("should handle empty args objects", () => {
      const sig1: WidgetSignature = {
        origin: "OpenBB Workspace",
        widgetId: "simple_widget",
        args: {},
      };

      const sig2: WidgetSignature = {
        origin: "OpenBB Workspace",
        widgetId: "simple_widget",
        args: {},
      };

      expect(compareSignatures(sig1, sig2)).toBe(true);
    });
  });

  describe("regression tests for critical fields", () => {
    it("should fail comparison if origin is missing from sig1", () => {
      const sig1 = {
        widgetId: "equity_price",
        args: { symbol: "AAPL" },
      } as unknown as WidgetSignature;

      const sig2: WidgetSignature = {
        origin: "OpenBB Sandbox",
        widgetId: "equity_price",
        args: { symbol: "AAPL" },
      };

      expect(compareSignatures(sig1, sig2)).toBe(false);
    });

    it("should fail comparison if widgetId is missing from sig2", () => {
      const sig1: WidgetSignature = {
        origin: "OpenBB Sandbox",
        widgetId: "equity_price",
        args: { symbol: "AAPL" },
      };

      const sig2 = {
        origin: "OpenBB Sandbox",
        args: { symbol: "AAPL" },
      } as unknown as WidgetSignature;

      expect(compareSignatures(sig1, sig2)).toBe(false);
    });
  });

  describe("critical regression test for isEqual args comparison", () => {
    it("should return false when args comparison is disabled/commented out", () => {
      // This test ensures that if someone comments out the isEqual(sig1.args, sig2.args) line,
      // the test will fail, preventing the regression you experienced
      const sig1: WidgetSignature = {
        origin: "OpenBB Sandbox",
        widgetId: "equity_price",
        args: { symbol: "AAPL", period: "1y" },
      };

      const sig2: WidgetSignature = {
        origin: "OpenBB Sandbox",
        widgetId: "equity_price",
        args: { symbol: "TSLA", period: "6m" }, // Different args
      };

      // This MUST return false - if it returns true, the args comparison is broken
      expect(compareSignatures(sig1, sig2)).toBe(false);
    });

    it("should return true when all fields including args are identical", () => {
      const sig1: WidgetSignature = {
        origin: "OpenBB Sandbox",
        widgetId: "equity_price",
        args: { symbol: "AAPL", period: "1y", limit: 100 },
      };

      const sig2: WidgetSignature = {
        origin: "OpenBB Sandbox",
        widgetId: "equity_price",
        args: { symbol: "AAPL", period: "1y", limit: 100 },
      };

      // This MUST return true - if it returns false, the comparison logic is broken
      expect(compareSignatures(sig1, sig2)).toBe(true);
    });
  });
});

describe("createSignatureMap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetWidgetOrigin.mockReturnValue("OpenBB Sandbox");
    mockCurrentDateModifier.mockImplementation((value) => value);
  });

  it("should create an empty map when no widgets provided", () => {
    const result = createSignatureMap([], {});
    expect(result).toEqual({});
  });

  it("should create signature map for widgets without parameters", () => {
    const widgets = [
      createTestWidget({
        id: "widget-1",
        widgetId: "equity_price" as any,
      }),
    ];

    mockGetWidgetOrigin.mockReturnValue("OpenBB Sandbox");

    const result = createSignatureMap(widgets, {});

    expect(result).toEqual({
      "widget-1": {
        origin: "OpenBB Sandbox",
        widgetId: "equity_price",
        args: {},
      },
    });
  });

  it("should process widget parameters correctly", () => {
    const widgets = [
      createTestWidget({
        id: "widget-1",
        widgetId: "equity_price" as any,
        params: [
          {
            paramName: "symbol",
            value: "AAPL",
            type: "text",
          },
          {
            paramName: "period",
            value: "1y",
            type: "text",
          },
        ] as any,
      }),
    ];

    const dashboardWidgetsData: Record<string, DashboardWidgetData> = {};

    const result = createSignatureMap(widgets, dashboardWidgetsData);

    expect(result).toEqual({
      "widget-1": {
        origin: "OpenBB Sandbox",
        widgetId: "equity_price",
        args: {
          symbol: "AAPL",
          period: "1y",
        },
      },
    });
  });

  it("should normalize prefixed external widgetId in signature map", () => {
    const widgets = [
      createTestWidget({
        id: "widget-1",
        widgetId: "DTCC-fixed_income/treasury_volumes" as any,
        external: true as any,
        sourceName: "DTCC" as any,
      }),
    ];

    const result = createSignatureMap(widgets, {});

    expect(result["widget-1"]).toEqual({
      origin: "DTCC",
      widgetId: "fixed_income/treasury_volumes",
      args: {},
    });
  });

  it("should use dashboard widget data params when available", () => {
    const widgets = [
      createTestWidget({
        id: "widget-1",
        widgetId: "equity_price" as any,
        params: [
          {
            paramName: "symbol",
            value: "AAPL",
            type: "text",
          },
        ] as any,
      }),
    ];

    const dashboardWidgetsData: Record<string, DashboardWidgetData> = {
      "widget-1": {
        description: "Test widget",
        data: {},
        metadata: {
          params: {
            symbol: "TSLA", // Override the widget's default value
          },
        },
      },
    };

    const result = createSignatureMap(widgets, dashboardWidgetsData);

    expect(result["widget-1"].args).toEqual({
      symbol: "TSLA", // Should use dashboard data value
    });
  });

  it("should handle date parameters with currentDateModifier", () => {
    const widgets = [
      createTestWidget({
        id: "widget-1",
        widgetId: "equity_price" as any,
        params: [
          {
            paramName: "start_date",
            value: "today-30d",
            type: "date",
          },
          {
            paramName: "symbol",
            value: "AAPL",
            type: "text",
          },
        ] as any,
      }),
    ];

    mockCurrentDateModifier.mockReturnValue("2024-01-01");

    const result = createSignatureMap(widgets, {});

    expect(mockCurrentDateModifier).toHaveBeenCalledWith("today-30d");
    expect(result["widget-1"].args).toEqual({
      start_date: "2024-01-01",
      symbol: "AAPL",
    });
  });

  it("should handle widgets with different origins correctly", () => {
    const widgets = [
      createTestWidget({
        id: "workspace-widget",
        name: "Workspace Widget",
        type: "iframe",
        widgetId: "iframe-123" as any,
      }),
      createTestWidget({
        id: "sandbox-widget",
        name: "Sandbox Widget",
        type: "table",
        widgetId: "equity_price" as any,
      }),
    ];

    // Mock different origins for different widgets
    mockGetWidgetOrigin
      .mockReturnValueOnce("OpenBB Workspace")
      .mockReturnValueOnce("OpenBB Sandbox");

    const result = createSignatureMap(widgets, {});

    expect(result).toEqual({
      "workspace-widget": {
        origin: "OpenBB Workspace",
        widgetId: "workspace-widget", // Uses widget.id for Workspace widgets
        args: {},
      },
      "sandbox-widget": {
        origin: "OpenBB Sandbox",
        widgetId: "equity_price", // Uses widget.widgetId for Sandbox widgets
        args: {},
      },
    });
  });

  it("should handle missing widget params gracefully", () => {
    const widgets = [
      createTestWidget({
        id: "widget-1",
        widgetId: "equity_price" as any,
        params: undefined as any,
      }),
    ];

    const result = createSignatureMap(widgets, {});

    expect(result).toEqual({
      "widget-1": {
        origin: "OpenBB Sandbox",
        widgetId: "equity_price",
        args: {},
      },
    });
  });

  it("should handle missing dashboard widget data gracefully", () => {
    const widgets = [
      createTestWidget({
        id: "widget-1",
        widgetId: "equity_price" as any,
        params: [
          {
            paramName: "symbol",
            value: "AAPL",
            type: "text",
          },
        ] as any,
      }),
    ];

    // dashboardWidgetsData doesn't have this widget
    const dashboardWidgetsData: Record<string, DashboardWidgetData> = {};

    const result = createSignatureMap(widgets, dashboardWidgetsData);

    expect(result["widget-1"].args).toEqual({
      symbol: "AAPL", // Should fall back to widget's default value
    });
  });

  it("should handle Unknown widgetId when widgetId is missing", () => {
    const widgets = [
      createTestWidget({
        id: "widget-1",
        widgetId: undefined as any,
      }),
    ];

    const result = createSignatureMap(widgets, {});

    expect(result["widget-1"].widgetId).toBe("Unknown");
  });

  describe("regression tests for critical signature building", () => {
    it("should ensure origin is always included in signature", () => {
      const widgets = [
        createTestWidget({
          id: "widget-1",
          widgetId: "test" as any,
        }),
      ];

      const result = createSignatureMap(widgets, {});

      // Ensure origin is always present in the signature
      expect(result["widget-1"]).toHaveProperty("origin");
      expect(typeof result["widget-1"].origin).toBe("string");
      expect(result["widget-1"].origin.length).toBeGreaterThan(0);
    });

    it("should ensure widgetId logic follows origin-based rules", () => {
      const workspaceWidget = createTestWidget({
        id: "workspace-1",
        name: "Workspace Widget",
        type: "iframe",
        widgetId: "iframe-123" as any,
      });

      const sandboxWidget = createTestWidget({
        id: "sandbox-1",
        name: "Sandbox Widget",
        type: "table",
        widgetId: "equity_price" as any,
      });

      mockGetWidgetOrigin
        .mockReturnValueOnce("OpenBB Workspace")
        .mockReturnValueOnce("OpenBB Sandbox");

      const result = createSignatureMap([workspaceWidget, sandboxWidget], {});

      // Workspace widgets should use widget.id as widgetId
      expect(result["workspace-1"].widgetId).toBe("workspace-1");

      // Non-workspace widgets should use widget.widgetId
      expect(result["sandbox-1"].widgetId).toBe("equity_price");
    });

    it("should ensure all parameters are processed and included in args", () => {
      const widgets = [
        createTestWidget({
          id: "widget-1",
          widgetId: "complex_widget" as any,
          params: [
            { paramName: "param1", value: "value1", type: "text" },
            { paramName: "param2", value: "value2", type: "text" },
            { paramName: "date_param", value: "today", type: "date" },
          ] as any,
        }),
      ];

      mockCurrentDateModifier.mockReturnValue("2024-01-01");

      const result = createSignatureMap(widgets, {});

      // Ensure all parameters are present in args
      expect(Object.keys(result["widget-1"].args)).toHaveLength(3);
      expect(result["widget-1"].args).toEqual({
        param1: "value1",
        param2: "value2",
        date_param: "2024-01-01",
      });
    });

    it("should ensure date parameters are processed with currentDateModifier", () => {
      const widgets = [
        createTestWidget({
          id: "widget-1",
          widgetId: "test_widget" as any,
          params: [
            { paramName: "start_date", value: "today-1y", type: "date" },
            { paramName: "end_date", value: "today", type: "date" },
            { paramName: "symbol", value: "AAPL", type: "text" },
          ] as any,
        }),
      ];

      mockCurrentDateModifier
        .mockReturnValueOnce("2023-01-01") // for start_date
        .mockReturnValueOnce("2024-01-01"); // for end_date

      const result = createSignatureMap(widgets, {});

      expect(mockCurrentDateModifier).toHaveBeenCalledWith("today-1y");
      expect(mockCurrentDateModifier).toHaveBeenCalledWith("today");
      expect(mockCurrentDateModifier).toHaveBeenCalledTimes(2);

      expect(result["widget-1"].args).toEqual({
        start_date: "2023-01-01",
        end_date: "2024-01-01",
        symbol: "AAPL", // Non-date param should not be processed
      });
    });
  });
});

describe("detectQueryMismatch", () => {
  it("returns false when both queries are equal", () => {
    expect(detectQueryMismatch("SELECT 1", "SELECT 1")).toBe(false);
  });

  it("returns true when queries differ", () => {
    expect(detectQueryMismatch("SELECT 1", "SELECT 2")).toBe(true);
  });

  it("returns false when citation query is undefined", () => {
    expect(detectQueryMismatch(undefined, "SELECT 1")).toBe(false);
  });

  it("returns false when widget query is undefined", () => {
    expect(detectQueryMismatch("SELECT 1", undefined)).toBe(false);
  });

  it("returns false when both queries are undefined", () => {
    expect(detectQueryMismatch(undefined, undefined)).toBe(false);
  });

  it("returns false when citation query is empty string", () => {
    expect(detectQueryMismatch("", "SELECT 1")).toBe(false);
  });
});

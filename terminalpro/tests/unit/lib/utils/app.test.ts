import { describe, expect, it, vi } from "vitest";
import {
  checkIfWidgetsHaveMainTickerAndAreTheSame,
  createRootFolder,
  createTab,
  recursiveCleanKeys,
  updateWidgetGridLayout,
} from "~/lib/utils/app";

describe("app utils", () => {
  describe("checkIfWidgetsHaveMainTickerAndAreTheSame", () => {
    it("returns correct flags for widgets with same ticker", () => {
      const widgets = [
        { data: { mainTicker: { id: "AAPL", type: "stock" } } },
        { data: { mainTicker: { id: "AAPL", type: "stock" } } },
      ] as any;
      const result = checkIfWidgetsHaveMainTickerAndAreTheSame(widgets);
      expect(result.someHaveMainTicker).toBe(true);
      expect(result.allTheSame).toBe(true);
      expect(result.mainTicker.id).toBe("AAPL");
    });

    it("returns allTheSame false for different tickers", () => {
      const widgets = [
        { data: { mainTicker: { id: "AAPL", type: "stock" } } },
        { data: { mainTicker: { id: "MSFT", type: "stock" } } },
      ] as any;
      const result = checkIfWidgetsHaveMainTickerAndAreTheSame(widgets);
      expect(result.someHaveMainTicker).toBe(true);
      expect(result.allTheSame).toBe(false);
    });
  });

  describe("createTab", () => {
    it("calls addTab with new uuid and random name", () => {
      const addTab = vi.fn();
      createTab(addTab);
      expect(addTab).toHaveBeenCalledWith(
        expect.objectContaining({
          index: expect.any(String),
          data: expect.objectContaining({
            name: expect.any(String),
            type: "custom",
          }),
        }),
      );
    });
  });

  describe("createRootFolder", () => {
    it("creates a root folder structure", () => {
      const folder = createRootFolder();
      expect(folder.isRoot).toBe(true);
      expect(folder.name).toBe("root");
      expect(folder.isFolder).toBe(true);
    });
  });

  describe("recursiveCleanKeys", () => {
    it("removes _undefined from keys", () => {
      const data = {
        foo_undefined: "bar",
        nested: {
          baz_undefined: "qux",
        },
      };
      const cleaned = recursiveCleanKeys(data);
      expect(cleaned.foo).toBe("bar");
      expect(cleaned.nested.baz).toBe("qux");
      expect(cleaned.foo_undefined).toBeUndefined();
    });
  });

  describe("updateWidgetGridLayout", () => {
    it("removes the empty-dashboard-cta placeholder when a widget is added to the tab", () => {
      const gridLayout = {
        charts: [
          { i: "nav-bar", x: 0, y: 0, w: 40, h: 2, static: true },
          {
            i: "empty-dashboard-cta",
            x: 0,
            y: 2,
            w: 40,
            h: 20,
            isResizable: false,
            isDraggable: false,
          },
        ],
      } as any;

      const result = updateWidgetGridLayout({
        widget: { id: "chart-1", innerTab: "charts" } as any,
        gridLayout,
        currentTab: "charts",
      });

      const chartsLayout = result.charts;
      expect(chartsLayout.some((l) => l.i === "empty-dashboard-cta")).toBe(false);
      expect(chartsLayout.some((l) => l.i === "chart-1")).toBe(true);
    });
  });
});

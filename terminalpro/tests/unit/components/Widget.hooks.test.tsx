import { describe, expect, it } from "vitest";
import { updateWidgetParamOrder } from "~/components/DataConnectors/common/helpers";
import { shouldPersistWidgetUpdate } from "~/components/Widget.hooks";
import { createTestWidget } from "../helpers";

describe("shouldPersistWidgetUpdate", () => {
  const getParamName = (groupById: string) => groupById;

  it("does not persist when nothing changed", () => {
    const widget = createTestWidget({ name: "Same" });

    expect(shouldPersistWidgetUpdate(widget, { ...widget }, getParamName)).toBe(false);
  });

  it("persists when a grouped param value changes", () => {
    const currentWidget = createTestWidget({
      paramGroups: { symbol: "symbol" },
      storage: { params: { symbol: "AAPL" } },
    });
    const newWidget = createTestWidget({
      paramGroups: { symbol: "symbol" },
      storage: { params: { symbol: "MSFT" } },
    });

    expect(shouldPersistWidgetUpdate(currentWidget, newWidget, getParamName)).toBe(
      true,
    );
  });

  it("persists a name-only change (MCP/copilot update_widget rename)", () => {
    const currentWidget = createTestWidget({ name: "Old Name" });
    const newWidget = { ...currentWidget, name: "New Name" };

    expect(shouldPersistWidgetUpdate(currentWidget, newWidget, getParamName)).toBe(
      true,
    );
  });

  it("persists a description-only change", () => {
    const currentWidget = createTestWidget({ description: "old" });
    const newWidget = { ...currentWidget, description: "new" };

    expect(shouldPersistWidgetUpdate(currentWidget, newWidget, getParamName)).toBe(
      true,
    );
  });
});

describe("mergeExternalWidgetParamDefinitions", () => {
  it("preserves saved param order and visibility when refreshing external definitions", () => {
    const widget = createTestWidget({
      external: true,
      params: [
        {
          type: "endpoint",
          paramName: "selection",
          label: "Old Selection",
          value: "Sports",
          show: true,
        },
        {
          type: "text",
          paramName: "metric",
          label: "Metric",
          value: "volume_total",
          show: true,
        },
        {
          type: "endpoint",
          paramName: "selection",
          label: "Duplicate Selection",
          value: "Sports",
          show: false,
        },
      ],
    });
    const definitionWidget = createTestWidget({
      params: [
        {
          type: "text",
          paramName: "metric",
          label: "Updated Metric",
          value: "volume_24h",
          show: true,
        },
        {
          type: "endpoint",
          paramName: "selection",
          label: "Category / Tag / Event",
          value: "All",
          show: false,
          optionsEndpoint: "/options/selection-options",
        },
        {
          type: "boolean",
          paramName: "raw",
          label: "Raw",
          value: true,
          show: false,
        },
      ],
    });

    const params = updateWidgetParamOrder(definitionWidget.params, widget.params);

    expect(params?.map((param) => param.paramName)).toEqual([
      "selection",
      "metric",
      "raw",
    ]);
    expect(params?.[0]).toMatchObject({
      paramName: "selection",
      label: "Category / Tag / Event",
      show: true,
      optionsEndpoint: "/options/selection-options",
    });
    expect(params?.[1]).toMatchObject({
      paramName: "metric",
      label: "Updated Metric",
      show: true,
    });
  });

  it("updates refreshed external param layout metadata", () => {
    const widget = createTestWidget({
      external: true,
      params: [
        {
          type: "endpoint",
          paramName: "event_ticker",
          label: "Event",
          value: "KXEVENT",
          show: true,
          row: 0,
        },
      ],
    });
    const definitionWidget = createTestWidget({
      params: [
        {
          type: "endpoint",
          paramName: "event_ticker",
          label: "Event",
          value: "KXEVENT",
          show: true,
          row: 1,
          style: {
            popupWidth: 1425,
          },
        },
      ],
    });

    const params = updateWidgetParamOrder(definitionWidget.params, widget.params);

    expect(params?.[0]).toMatchObject({
      paramName: "event_ticker",
      value: "KXEVENT",
      row: 1,
      style: {
        popupWidth: 1425,
      },
    });
  });

  it("uses refreshed definition visibility when no saved override exists", () => {
    const widget = createTestWidget({
      external: true,
      params: [
        {
          type: "boolean",
          paramName: "raw",
          label: "Raw",
          value: true,
          show: false,
          hidden: false,
        },
      ],
    });
    const definitionWidget = createTestWidget({
      params: [
        {
          type: "boolean",
          paramName: "raw",
          label: "Raw",
          value: true,
          show: true,
        },
      ],
    });

    const params = updateWidgetParamOrder(definitionWidget.params, widget.params);

    expect(params?.[0]).toMatchObject({
      paramName: "raw",
      show: true,
    });
  });

  // it("updates refreshed external run-button behavior", () => {
  //   const widget = createTestWidget({
  //     external: true,
  //     runButton: true,
  //     params: [
  //       {
  //         type: "text",
  //         paramName: "sector",
  //         label: "Sector",
  //         show: false,
  //       },
  //     ],
  //   });
  //   const definitionWidget = createTestWidget({
  //     runButton: false,
  //     params: [
  //       {
  //         type: "text",
  //         paramName: "sector",
  //         label: "Sector",
  //         show: false,
  //       },
  //     ],
  //   });

  //   const mergedWidget = mergeExternalWidgetParamDefinitions(
  //     widget,
  //     definitionWidget,
  //   ) as WidgetT;

  //   expect(mergedWidget.runButton).toBe(false);
  // });
});

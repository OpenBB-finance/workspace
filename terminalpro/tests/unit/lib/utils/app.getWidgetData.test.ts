import { describe, expect, it } from "vitest";
import { getWidgetData } from "~/lib/utils/app";

const baseWidget = {
  widgetId: "custom_backend_table",
  external: true,
  name: "Custom table",
  endpoint: "table",
};

describe("getWidgetData enableAdvanced", () => {
  it("enables advanced when the definition sets enableAdvanced: true", () => {
    const widget = {
      ...baseWidget,
      type: "table",
      data: { table: { enableAdvanced: true } },
    } as any;

    expect(getWidgetData({ widget }).storage?.enableAdvanced).toBe(true);
  });

  it("disables advanced when the definition sets enableAdvanced: false", () => {
    const widget = {
      ...baseWidget,
      type: "table",
      data: { table: { enableAdvanced: false } },
    } as any;

    expect(getWidgetData({ widget }).storage?.enableAdvanced).toBe(false);
  });

  it("lets an explicit enableAdvanced: false override the SSRM default", () => {
    const widget = {
      ...baseWidget,
      type: "ssrm_table",
      data: { table: { enableAdvanced: false } },
    } as any;

    expect(getWidgetData({ widget }).storage?.enableAdvanced).toBe(false);
  });

  it("defaults SSRM widgets to advanced when the definition is silent", () => {
    const widget = {
      ...baseWidget,
      type: "ssrm_table",
      data: { table: {} },
    } as any;

    expect(getWidgetData({ widget }).storage?.enableAdvanced).toBe(true);
  });

  it("leaves advanced unset for plain tables when the definition is silent", () => {
    const widget = {
      ...baseWidget,
      type: "table",
      data: { table: {} },
    } as any;

    expect(getWidgetData({ widget }).storage?.enableAdvanced).toBeUndefined();
  });
});

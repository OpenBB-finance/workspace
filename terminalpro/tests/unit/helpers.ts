import type { WidgetT } from "~/components/types";

const DEFAULT_WIDGET: WidgetT = {
  id: "test-widget",
  // @ts-expect-error - ignored for now
  uuid: "test-uuid",
  name: "Test Widget",
  type: "custom",
  widgetId: "test-widget-id" as any,
  storage: {
    params: {},
  },
  data: {
    table: {
      columnsDefs: [],
    },
  },
};

export const createTestWidget = (overrides: Partial<WidgetT> = {}): WidgetT => ({
  ...DEFAULT_WIDGET,
  ...overrides,
});


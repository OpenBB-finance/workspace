import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type React from "react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import { WidgetContext } from "~/components/Widget.context";

export const createMockWidget = (overrides = {}) => ({
  uuid: "test-uuid",
  name: "Test Widget",
  type: "custom",
  widgetId: "test-widget-id",
  storage: {
    params: {},
  },
  data: {
    table: {
      columnsDefs: [],
    },
  },
  ...overrides,
});

export const WidgetTestWrapper = ({
  children,
  widgetOverrides = {},
  activeDashboardId = "test-dashboard-id",
  isShared = false,
  updateWidget = vi.fn(),
}: {
  children: React.ReactNode;
  widgetOverrides?: any;
  activeDashboardId?: string;
  isShared?: boolean;
  updateWidget?: any;
}) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  const widget = createMockWidget(widgetOverrides);
  const getWidget = vi.fn(() => widget);

  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <WidgetContext.Provider
          value={
            {
              widget,
              widgetRef: { current: widget },
              widgetFromJSON: widget,
              activeDashboardId,
              isShared,
              uuid: widget.uuid,
              updateWidget,
              getWidget,
            } as any
          }
        >
          {children}
        </WidgetContext.Provider>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

export const renderWidget = (
  ui: React.ReactElement,
  options: {
    widgetOverrides?: any;
    activeDashboardId?: string;
    isShared?: boolean;
    updateWidget?: any;
  } = {},
) => {
  return render(<WidgetTestWrapper {...options}>{ui}</WidgetTestWrapper>);
};

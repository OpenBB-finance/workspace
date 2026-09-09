import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ParamDef } from "~/components/types";

const mocks = vi.hoisted(() => ({
  widget: null as any,
  appGroups: [] as any[],
  updateWidget: vi.fn(),
  activeDashboardId: "dashboard-1",
  isShared: false,
  sharedGroups: [] as any[],
  updateGroup: vi.fn(),
  useQueries: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueries: mocks.useQueries,
}));

vi.mock("~/components/NewAdvancedSelect", async () => {
  const React = await import("react");

  return {
    AdvancedSelect: ({ label, selected, values, onSelect }: any) => {
      const selectedOption = values.find((value: any) => value.value === selected);
      const nextOption =
        values.find((value: any) => value.value !== selected) ?? values[0];

      return React.createElement(
        "button",
        { type: "button", onClick: () => onSelect(nextOption?.value) },
        selectedOption?.label ?? label,
      );
    },
  };
});

vi.mock("~/components/Widget.context", () => ({
  useWidgetContext: () => ({
    widget: mocks.widget,
    widgetFromJSON: mocks.widget,
    activeDashboardId: mocks.activeDashboardId,
    isShared: mocks.isShared,
    updateWidget: mocks.updateWidget,
  }),
}));

vi.mock("~/lib/state/app", () => ({
  useShallowAppStore: (selector: any) =>
    selector({
      getWidgetGroups: () => mocks.appGroups,
      getTabById: () => undefined,
      updateGroup: mocks.updateGroup,
    }),
}));

vi.mock("~/lib/state/sharedApp", () => ({
  useShallowSharedAppStore: (selector: any) =>
    selector({
      getWidgetGroups: () => mocks.sharedGroups,
      getDashboardById: () => undefined,
    }),
}));

vi.mock("~/components/Widgets/Helpers/GroupDropdown", async () => {
  const { createContext } = await import("react");

  return {
    GroupDropdownAnchorContext: createContext(null),
    default: ({
      children,
      paramDef,
    }: {
      children?: ReactNode;
      paramDef?: ParamDef;
    }) => (
      <div data-testid="group-dropdown" data-param-name={paramDef?.paramName}>
        {children ?? paramDef?.label ?? paramDef?.paramName}
      </div>
    ),
  };
});

vi.doUnmock("~/components/General/Table/NavBar/QueryParams");

const { RenderParamsForRow } = await import(
  "~/components/General/Table/NavBar/QueryParams"
);
const { useWidgetParamsPositions } = await import(
  "~/components/General/Table/NavBar/QueryParams"
);

function makeEndpointWidget(selection: string) {
  const selectionParam = {
    paramName: "selection",
    type: "endpoint",
    groupById: "selection-options",
    label: "Category / Tag / Event",
    optionsEndpoint: "/options/selection-options",
    value: "All",
    show: true,
    optionsParams: {
      field: "selection",
      selection: "$selection",
    },
  };

  return {
    id: "widget-1",
    widgetId: "volume_by_category",
    external: true,
    data: {},
    storage: {
      params: {
        selection,
      },
    },
    params: [selectionParam],
  };
}

function ParamsHarness() {
  const { renderRow0Params } = useWidgetParamsPositions();
  return <div>{renderRow0Params}</div>;
}

beforeEach(() => {
  mocks.widget = null as any;
  mocks.updateWidget = vi.fn();
  mocks.activeDashboardId = "dashboard-1";
  mocks.isShared = false;
  mocks.appGroups = [];
  mocks.sharedGroups = [];
  mocks.updateGroup.mockReset();
  mocks.useQueries.mockReset();
});

describe("RenderParamsForRow", () => {
  it("syncs rendered params when widget storage changes externally", async () => {
    mocks.useQueries.mockImplementation(({ queries }) =>
      queries.map(() => ({
        isLoading: false,
        isFetching: false,
        isError: false,
        data: [
          { label: "All categories", value: "All" },
          { label: "Crypto", value: "Crypto" },
        ],
        refetch: vi.fn(),
      })),
    );
    mocks.widget = makeEndpointWidget("All");

    const { rerender } = render(<ParamsHarness />);
    expect(screen.getByText("All categories")).toBeInTheDocument();

    mocks.widget = makeEndpointWidget("Crypto");
    rerender(<ParamsHarness />);

    await waitFor(() => {
      expect(screen.getByText("Crypto")).toBeInTheDocument();
    });
  });

  it("publishes visible grouped endpoint param changes to the group store", async () => {
    const user = userEvent.setup();
    mocks.useQueries.mockImplementation(({ queries }) =>
      queries.map(() => ({
        isLoading: false,
        isFetching: false,
        isError: false,
        data: [
          { label: "All categories", value: "All" },
          { label: "Sports", value: "Sports" },
        ],
        refetch: vi.fn(),
      })),
    );
    mocks.widget = makeEndpointWidget("All");
    mocks.appGroups = [
      {
        id: "group-1",
        type: "endpointParam",
        groupById: "selection-options",
        value: "All",
      },
    ];

    render(<ParamsHarness />);

    await user.click(screen.getByText("All categories"));

    await waitFor(() => {
      expect(mocks.updateGroup).toHaveBeenCalledWith(
        "dashboard-1",
        "group-1",
        expect.objectContaining({ value: "Sports" }),
      );
    });
    expect(mocks.updateWidget).not.toHaveBeenCalled();
  });

  it("wraps boolean params with GroupDropdown so grouping affordances render", () => {
    const booleanParam = {
      paramName: "include_history",
      label: "Include History",
      type: "boolean",
      row: 0,
      options: [
        { label: "On", value: true },
        { label: "Off", value: false },
      ],
    } as ParamDef;

    render(
      <RenderParamsForRow
        rowParams={[booleanParam]}
        state={{ localParams: { include_history: "true" }, mainTicker: undefined }}
        updateParams={vi.fn()}
        endpointOptions={{}}
        endpointParams={{}}
        invalidResponseRef={{ current: {} }}
      />,
    );

    expect(screen.getByTestId("group-dropdown")).toBeInTheDocument();
    expect(screen.getByText("Include History")).toBeInTheDocument();
  });

  it("renders hidden row params as group badges instead of full controls", () => {
    const hiddenMarketParam = {
      paramName: "market_key",
      label: "Market",
      type: "endpoint",
      row: 1,
      show: false,
      groupById: "market_key-options",
    } as ParamDef;

    render(
      <RenderParamsForRow
        rowParams={[hiddenMarketParam]}
        state={{ localParams: { market_key: "KXMARKET" }, mainTicker: undefined }}
        updateParams={vi.fn()}
        endpointOptions={{}}
        endpointParams={{}}
        invalidResponseRef={{ current: {} }}
      />,
    );

    expect(screen.getByTestId("group-dropdown")).toHaveAttribute(
      "data-param-name",
      "market_key",
    );
    expect(screen.getByText("Market")).toBeInTheDocument();
  });
});

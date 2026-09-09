import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  updateGroup: vi.fn(),
  updateWidget: vi.fn(),
  localGetWidgetGroups: vi.fn((..._args) => []),
  sharedGetWidgetGroups: vi.fn((..._args) => [
    {
      id: "group-1",
      type: "endpointParam",
      groupById: "selection-options",
      value: "All",
    },
  ]),
  widget: {
    id: "widget-1",
    widgetId: "volume_by_category",
    storage: { params: {} },
    data: { table: { columnsDefs: [] } },
    params: [
      {
        paramName: "selection",
        type: "endpoint",
        groupById: "selection-options",
      },
    ],
  },
}));

vi.mock("~/components/Widget.context", () => ({
  useWidgetContext: () => ({
    widget: mocks.widget,
    widgetFromJSON: mocks.widget,
    activeDashboardId: "shared-tab",
    isShared: true,
    updateWidget: mocks.updateWidget,
  }),
}));

vi.mock("~/lib/state/app", () => ({
  useShallowAppStore: (selector: any) =>
    selector({
      getWidgetGroups: vi.fn((...args) => {
        const [tabId, widgetId] = args;
        if (tabId === "shared-tab" && widgetId === "widget-1") {
          return mocks.sharedGetWidgetGroups(...args);
        }
        return mocks.localGetWidgetGroups(...args);
      }),
      updateGroup: mocks.updateGroup,
    }),
}));

vi.mock("~/lib/state/copilot", () => ({
  useShallowCopilotStore: (selector: any) =>
    selector({
      selectedCopilot: null,
      setCopilotById: vi.fn(),
    }),
}));

vi.mock("~/components/General/Table/CellRenderers/CellOnHover", () => ({
  default: ({ value }: { value: string }) => <span>{value}</span>,
}));

const { CellOnClickRenderer } = await import("~/components/General/Table/AgGrid");
const { getCellOnClickActionParamsFromAgGrid } = await import(
  "~/components/General/Table/hooks/useCellOnClickHandler"
);

function RenderCellOnClickRenderer(props: any) {
  return <CellOnClickRenderer {...props} />;
}

describe("CellOnClickRenderer", () => {
  beforeEach(() => {
    mocks.updateGroup.mockClear();
    mocks.updateWidget.mockClear();
    mocks.localGetWidgetGroups.mockClear();
    mocks.sharedGetWidgetGroups.mockClear();
    mocks.sharedGetWidgetGroups.mockReturnValue([
      {
        id: "group-1",
        type: "endpointParam",
        groupById: "selection-options",
        value: "All",
      },
    ]);
    mocks.widget.params = [
      {
        paramName: "selection",
        type: "endpoint",
        groupById: "selection-options",
      },
    ];
    mocks.widget.storage = { params: {} };
  });

  it("updates endpoint parameter groups from the shared store", () => {
    render(
      <RenderCellOnClickRenderer
        value="Crypto"
        data={{ selection: "Crypto" }}
        actionType="groupBy"
        groupBy={{ paramName: "selection", valueField: "selection" }}
        colDef={{ field: "label" }}
      />,
    );

    fireEvent.click(screen.getByText("Crypto"));

    expect(mocks.sharedGetWidgetGroups).toHaveBeenCalledWith("shared-tab", "widget-1");
    expect(mocks.updateGroup).toHaveBeenCalledWith(
      "shared-tab",
      "group-1",
      expect.objectContaining({
        id: "group-1",
        value: "Crypto",
      }),
    );
  });

  it("falls back to widget params when no matching group is found", () => {
    mocks.sharedGetWidgetGroups.mockReturnValue([]);

    render(
      <RenderCellOnClickRenderer
        value="Crypto"
        data={{ selection: "Crypto" }}
        actionType="groupBy"
        groupBy={{ paramName: "selection", valueField: "selection" }}
        colDef={{ field: "label" }}
      />,
    );

    fireEvent.click(screen.getByText("Crypto"));

    expect(mocks.updateGroup).not.toHaveBeenCalled();
    expect(mocks.updateWidget).toHaveBeenCalledWith(expect.any(Function), true);

    const updater = mocks.updateWidget.mock.calls[0][0];
    expect(updater(mocks.widget).storage.params.selection).toBe("Crypto");
  });

  it("uses the grouped value field even when the cell value is empty", () => {
    const { container } = render(
      <RenderCellOnClickRenderer
        value={undefined}
        data={{ selection: "Sports" }}
        actionType="groupBy"
        groupBy={{ paramName: "selection", valueField: "selection" }}
        colDef={{ field: "label" }}
      />,
    );

    fireEvent.click(container.firstElementChild as Element);

    expect(mocks.updateGroup).toHaveBeenCalledWith(
      "shared-tab",
      "group-1",
      expect.objectContaining({
        id: "group-1",
        value: "Sports",
      }),
    );
  });

  it("updates endpoint parameter groups when widget params are row-grouped", () => {
    mocks.widget.params = [
      [
        {
          paramName: "selection",
          type: "endpoint",
          groupById: "selection-options",
        },
      ],
    ] as any;

    render(
      <RenderCellOnClickRenderer
        value="Crypto"
        data={{ selection: "Crypto" }}
        actionType="groupBy"
        groupBy={{ paramName: "selection", valueField: "selection" }}
        colDef={{ field: "label" }}
      />,
    );

    fireEvent.click(screen.getByText("Crypto"));

    expect(mocks.updateGroup).toHaveBeenCalledWith(
      "shared-tab",
      "group-1",
      expect.objectContaining({
        id: "group-1",
        value: "Crypto",
      }),
    );
    expect(mocks.updateWidget).not.toHaveBeenCalled();
  });
});

describe("getCellOnClickActionParamsFromAgGrid", () => {
  it("returns group action params for clicks on the AG Grid cell body", () => {
    const target = document.createElement("div");

    const result = getCellOnClickActionParamsFromAgGrid({
      event: { target },
      colDef: {
        cellRendererParams: {
          actionType: "groupBy",
          groupBy: { paramName: "selection", valueField: "selection" },
        },
      },
      value: "Crypto",
      data: { selection: "Crypto" },
    } as any);

    expect(result).toEqual({
      actionType: "groupBy",
      groupBy: { paramName: "selection", valueField: "selection" },
      value: "Crypto",
      data: { selection: "Crypto" },
    });
  });

  it("skips clicks that already came from the inner cell-on-click renderer", () => {
    const renderer = document.createElement("div");
    renderer.dataset.cellOnClickRenderer = "true";
    const target = document.createElement("span");
    renderer.append(target);

    const result = getCellOnClickActionParamsFromAgGrid({
      event: { target },
      colDef: {
        cellRendererParams: {
          actionType: "groupBy",
          groupBy: { paramName: "selection", valueField: "selection" },
        },
      },
      value: "Crypto",
      data: { selection: "Crypto" },
    } as any);

    expect(result).toBeNull();
  });
});

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Group, ParamDef } from "~/components/types";
import {
  getGroupParamName,
  useParamGroupBindings,
} from "~/components/Widgets/Helpers/useParamGroupBindings";

const mocked = vi.hoisted(() => ({
  widget: { id: "widget-1", params: [] as ParamDef[] },
  activeDashboardId: "dash-1",
  isShared: false,
}));

const appStoreMock = vi.hoisted(() => ({
  getWidgetGroups: vi.fn((..._args) => [] as Group[]),
  getTabById: vi.fn(() => undefined as any),
  updateGroup: vi.fn(),
}));

const sharedAppStoreMock = vi.hoisted(() => ({
  getWidgetGroups: vi.fn((..._args) => [] as Group[]),
  getDashboardById: vi.fn(() => undefined as any),
}));

vi.mock("~/components/Widget.context", () => ({
  useWidgetContext: () => ({
    widget: mocked.widget,
    widgetFromJSON: mocked.widget,
    activeDashboardId: mocked.activeDashboardId,
    isShared: mocked.isShared,
    updateWidget: vi.fn(),
  }),
}));

vi.mock("~/lib/state/app", () => ({
  useShallowAppStore: (selector: any) =>
    selector({
      getWidgetGroups: vi.fn((...args) => {
        const [tabId] = args;
        if (tabId === "shared-tab") {
          return sharedAppStoreMock.getWidgetGroups(...args);
        }
        return appStoreMock.getWidgetGroups(...args);
      }),
      getTabById: appStoreMock.getTabById,
      updateGroup: appStoreMock.updateGroup,
    }),
}));

vi.mock("~/lib/state/sharedApp", () => ({
  useShallowSharedAppStore: () => sharedAppStoreMock.getDashboardById,
}));

const endpointParamDef: ParamDef = {
  type: "endpoint",
  paramName: "symbol",
  groupById: "group-by-symbol",
  label: "Symbol",
} as ParamDef;

const paramGroup = (overrides: Partial<Group> = {}): Group =>
  ({
    type: "param",
    id: "g-param",
    name: "Sector",
    color: "#fff",
    groupById: "sector",
    value: "tech",
    ...overrides,
  }) as Group;

const endpointGroup = (overrides: Partial<Group> = {}): Group =>
  ({
    type: "endpointParam",
    id: "g-endpoint",
    name: "Symbol",
    color: "#fff",
    groupById: "group-by-symbol",
    value: "AAPL",
    ...overrides,
  }) as Group;

const tickerGroup = (): Group =>
  ({
    type: "ticker",
    id: "g-ticker",
    name: "Ticker",
    color: "#fff",
    groupById: "ticker",
    value: { symbol: "AAPL", id: "AAPL" },
  }) as Group;

beforeEach(() => {
  mocked.isShared = false;
  mocked.activeDashboardId = "dash-1";
  mocked.widget.params = [];
  appStoreMock.getWidgetGroups.mockReturnValue([]);
  appStoreMock.getTabById.mockReturnValue(undefined);
  appStoreMock.updateGroup.mockReset();
  sharedAppStoreMock.getWidgetGroups.mockReturnValue([]);
  sharedAppStoreMock.getDashboardById.mockReturnValue(undefined);
});

describe("getGroupParamName", () => {
  it("resolves endpoint-param groups to their live param name", () => {
    expect(getGroupParamName(endpointGroup(), [endpointParamDef])).toBe("symbol");
  });

  it("falls back to groupById when the endpoint param def is missing", () => {
    expect(getGroupParamName(endpointGroup(), [])).toBe("group-by-symbol");
  });

  it("returns groupById for plain param groups", () => {
    expect(getGroupParamName(paramGroup(), [])).toBe("sector");
  });

  it("returns undefined for ticker groups", () => {
    expect(getGroupParamName(tickerGroup(), [endpointParamDef])).toBeUndefined();
  });
});

describe("useParamGroupBindings", () => {
  it("binds param and endpoint groups to their param names", () => {
    appStoreMock.getWidgetGroups.mockReturnValue([paramGroup(), endpointGroup()]);
    mocked.widget.params = [endpointParamDef];
    const { result } = renderHook(() => useParamGroupBindings());

    expect(result.current.bindings).toEqual([
      ["sector", expect.objectContaining({ id: "g-param" })],
      ["symbol", expect.objectContaining({ id: "g-endpoint" })],
    ]);
  });

  it("ignores ticker groups", () => {
    appStoreMock.getWidgetGroups.mockReturnValue([tickerGroup()]);

    const { result } = renderHook(() => useParamGroupBindings());

    expect(result.current.bindings).toEqual([]);
  });

  it("reads shared groups when the widget context is shared", () => {
    mocked.isShared = true;
    mocked.activeDashboardId = "shared-tab";
    sharedAppStoreMock.getWidgetGroups.mockReturnValue([paramGroup()]);

    const { result } = renderHook(() => useParamGroupBindings());

    expect(result.current.bindings).toEqual([
      ["sector", expect.objectContaining({ id: "g-param" })],
    ]);
  });

  it("excludes dashboard groups unless includeDashboardGroups is set", () => {
    appStoreMock.getWidgetGroups.mockReturnValue([]);
    appStoreMock.getTabById.mockReturnValue({ data: { groups: [paramGroup()] } });

    const { result, rerender } = renderHook(
      ({ include }: { include: boolean }) =>
        useParamGroupBindings({ includeDashboardGroups: include }),
      { initialProps: { include: false } },
    );

    expect(result.current.bindings).toEqual([]);

    rerender({ include: true });
    expect(result.current.bindings).toEqual([
      ["sector", expect.objectContaining({ id: "g-param" })],
    ]);
  });

  it("dedupes dashboard groups already bound at the widget level by id", () => {
    appStoreMock.getWidgetGroups.mockReturnValue([paramGroup()]);
    appStoreMock.getTabById.mockReturnValue({ data: { groups: [paramGroup()] } });

    const { result } = renderHook(() =>
      useParamGroupBindings({ includeDashboardGroups: true }),
    );

    expect(result.current.bindings).toHaveLength(1);
  });

  it("filters bindings by allowedParams when provided", () => {
    appStoreMock.getWidgetGroups.mockReturnValue([paramGroup(), endpointGroup()]);
    mocked.widget.params = [endpointParamDef];

    const { result } = renderHook(() =>
      useParamGroupBindings({ filterAllowedParams: true }),
    );

    expect(result.current.bindings).toEqual([
      ["symbol", expect.objectContaining({ id: "g-endpoint" })],
    ]);
  });

  it("keeps two distinct groups bound to the same param name", () => {
    appStoreMock.getWidgetGroups.mockReturnValue([
      paramGroup({ id: "g-a" }),
      paramGroup({ id: "g-b" }),
    ]);

    const { result } = renderHook(() => useParamGroupBindings());

    expect(result.current.bindings).toHaveLength(2);
  });

  it("updateGroupedParam writes the matched group and returns true", () => {
    appStoreMock.getWidgetGroups.mockReturnValue([paramGroup()]);

    const { result } = renderHook(() => useParamGroupBindings());

    let matched = false;
    act(() => {
      matched = result.current.updateGroupedParam("sector", "finance");
    });

    expect(matched).toBe(true);
    expect(appStoreMock.updateGroup).toHaveBeenCalledWith(
      "dash-1",
      "g-param",
      expect.objectContaining({ value: "finance" }),
    );
  });

  it("updateGroupedParam returns false when no group matches", () => {
    appStoreMock.getWidgetGroups.mockReturnValue([]);

    const { result } = renderHook(() => useParamGroupBindings());

    let matched = true;
    act(() => {
      matched = result.current.updateGroupedParam("missing", "x");
    });

    expect(matched).toBe(false);
    expect(appStoreMock.updateGroup).not.toHaveBeenCalled();
  });

  it("updateGroupedParams writes changed params and skips unchanged ones", () => {
    appStoreMock.getWidgetGroups.mockReturnValue([
      paramGroup({ value: "tech" }),
      endpointGroup({ value: "AAPL" }),
    ]);
    mocked.widget.params = [endpointParamDef];

    const { result } = renderHook(() => useParamGroupBindings());

    act(() => {
      result.current.updateGroupedParams({ sector: "tech", symbol: "MSFT" });
    });

    expect(appStoreMock.updateGroup).toHaveBeenCalledTimes(1);
    expect(appStoreMock.updateGroup).toHaveBeenCalledWith(
      "dash-1",
      "g-endpoint",
      expect.objectContaining({ value: "MSFT" }),
    );
  });

  it("updateGroupedParams ignores params with no bound group", () => {
    appStoreMock.getWidgetGroups.mockReturnValue([paramGroup()]);

    const { result } = renderHook(() => useParamGroupBindings());

    act(() => {
      result.current.updateGroupedParams({ unbound: "value" });
    });

    expect(appStoreMock.updateGroup).not.toHaveBeenCalled();
  });
});

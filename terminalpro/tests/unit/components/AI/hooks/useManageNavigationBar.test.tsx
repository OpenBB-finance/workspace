import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useManageNavigationBar } from "~/components/AI/hooks/useManageNavigationBar";
import type { InnerTab } from "~/lib/state/app";

const {
  mockUpdateInnerTabs,
  mockTriggerCustomEvent,
  mockGetAppState,
  mockGetJsonWidget,
} = vi.hoisted(() => ({
  mockUpdateInnerTabs: vi.fn(),
  mockTriggerCustomEvent: vi.fn((..._args: unknown[]) => true),
  mockGetAppState: vi.fn(),
  mockGetJsonWidget: vi.fn(),
}));

vi.mock("react-router-dom", () => ({
  useParams: () => ({ id: "dash-1" }),
}));

vi.mock("~/lib/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("~/lib/utils")>();
  return {
    ...actual,
    triggerCustomEvent: (...args: unknown[]) => mockTriggerCustomEvent(...args),
    getJsonWidget: (...args: unknown[]) => mockGetJsonWidget(...args),
  };
});

vi.mock("~/lib/state/app", () => ({
  useAppStore: { getState: () => mockGetAppState() },
}));

const navBarTabs: InnerTab[] = [
  { id: "overview", name: "Overview" },
  { id: "charts", name: "Charts" },
];

const navBar = {
  id: "navbar-uuid",
  widgetId: "navigation_bar",
  storage: { tabs: navBarTabs },
};

describe("useManageNavigationBar rename_tabs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAppState.mockReturnValue({
      items: { "dash-1": { data: { widgets: [navBar] } } },
      updateInnerTabs: mockUpdateInnerTabs,
      addWidgets: vi.fn(),
      removeWidget: vi.fn(),
    });
  });

  it("keeps the tab id stable when renaming (only the name changes)", async () => {
    const { result } = renderHook(() => useManageNavigationBar());

    const response = await result.current({
      operation: "rename_tabs",
      rename_map: { Charts: "Data" },
    });

    expect(response[0].status).toBe("success");

    // The nav bar's stored tabs must keep their original ids — held
    // references (widget.innerTab, current_tab_id, URLs) depend on them.
    const updateCall = mockTriggerCustomEvent.mock.calls.find(
      ([eventName]) => eventName === "updateWidget-navbar-uuid",
    );
    expect(updateCall).toBeDefined();
    const updater = updateCall?.[1] as (prev: typeof navBar) => typeof navBar;
    const updated = updater({ ...navBar, storage: { tabs: navBarTabs } });
    expect(updated.storage.tabs).toEqual([
      { id: "overview", name: "Overview" },
      { id: "charts", name: "Data" },
    ]);
  });

  it("passes no id migration to updateInnerTabs on rename", async () => {
    const { result } = renderHook(() => useManageNavigationBar());

    await result.current({
      operation: "rename_tabs",
      rename_map: { Charts: "Data" },
    });

    // A `newId` here drives the grid-layout/currentTab migration in the app
    // store — the mechanism that spawned phantom tabs with the stale id.
    expect(mockUpdateInnerTabs).toHaveBeenCalledWith("dash-1", {
      overview: { id: "overview", name: "Overview" },
      charts: { id: "charts", name: "Data" },
    });
    const passedInnerTabs = mockUpdateInnerTabs.mock.calls[0][1] as Record<
      string,
      InnerTab
    >;
    expect(passedInnerTabs.charts.newId).toBeUndefined();
  });

  it("returns the resulting tabs on a successful rename", async () => {
    const { result } = renderHook(() => useManageNavigationBar());

    const response = await result.current({
      operation: "rename_tabs",
      rename_map: { Charts: "Data" },
    });

    expect(response[0].status).toBe("success");
    expect(response[0].tabs).toEqual([
      { id: "overview", name: "Overview" },
      { id: "charts", name: "Data" },
    ]);
  });

  it("reports skipped old names that did not match any tab", async () => {
    const { result } = renderHook(() => useManageNavigationBar());

    const response = await result.current({
      operation: "rename_tabs",
      rename_map: { Charts: "Data", "No Such Tab": "Whatever" },
    });

    expect(response[0].status).toBe("success");
    expect(response[0].message).toContain('"Charts" → "Data"');
    expect(response[0].message).toContain("No Such Tab");
    expect(response[0].message).toContain("skipped");
    expect(response[0].tabs).toEqual([
      { id: "overview", name: "Overview" },
      { id: "charts", name: "Data" },
    ]);
  });

  it("errors when no old name matches, listing valid tab ids", async () => {
    const { result } = renderHook(() => useManageNavigationBar());

    const response = await result.current({
      operation: "rename_tabs",
      rename_map: { "No Such Tab": "Whatever" },
    });

    expect(response[0].status).toBe("error");
    expect(response[0].message).toContain("overview");
    expect(response[0].message).toContain("charts");
    expect(mockUpdateInnerTabs).not.toHaveBeenCalled();
    expect(mockTriggerCustomEvent).not.toHaveBeenCalled();
  });
});

describe("useManageNavigationBar authoritative tab state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAppState.mockReturnValue({
      items: { "dash-1": { data: { widgets: [navBar] } } },
      updateInnerTabs: mockUpdateInnerTabs,
      addWidgets: vi.fn(),
      removeWidget: vi.fn(),
    });
  });

  it("returns the resulting tabs after create", async () => {
    mockGetAppState.mockReturnValue({
      items: { "dash-1": { data: { widgets: [] } } },
      updateInnerTabs: mockUpdateInnerTabs,
      addWidgets: vi.fn(),
      removeWidget: vi.fn(),
    });
    mockGetJsonWidget.mockReturnValue({
      id: "navbar-def",
      widgetId: "navigation_bar",
      storage: {},
    });

    const { result } = renderHook(() => useManageNavigationBar());

    const response = await result.current({
      operation: "create",
      tabs: [{ name: "Overview" }, { name: "Charts" }],
    });

    expect(response[0].status).toBe("success");
    expect(response[0].tabs).toEqual([
      { id: "overview", name: "Overview" },
      { id: "charts", name: "Charts" },
    ]);
  });

  it("returns the resulting tabs after add_tabs", async () => {
    const { result } = renderHook(() => useManageNavigationBar());

    const response = await result.current({
      operation: "add_tabs",
      tabs: [{ name: "News" }],
    });

    expect(response[0].status).toBe("success");
    expect(response[0].tabs).toEqual([
      { id: "overview", name: "Overview" },
      { id: "charts", name: "Charts" },
      { id: "news", name: "News" },
    ]);
  });

  it("returns the remaining tabs after remove_tabs", async () => {
    const { result } = renderHook(() => useManageNavigationBar());

    const response = await result.current({
      operation: "remove_tabs",
      tabs: [{ name: "Charts" }],
    });

    expect(response[0].status).toBe("success");
    expect(response[0].tabs).toEqual([{ id: "overview", name: "Overview" }]);
  });
});

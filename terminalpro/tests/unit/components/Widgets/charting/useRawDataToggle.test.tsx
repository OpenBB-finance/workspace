import { render, renderHook, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useRawDataToggle } from "~/components/Widgets/charting/useRawDataToggle";
import { useJsonData } from "~/lib/api";
import { WidgetTestWrapper } from "../WidgetTestWrapper";

vi.mock("~/lib/api", () => ({
  useJsonData: vi.fn(),
}));

vi.mock("~/components/General/Table/hooks", () => ({
  Table: ({ children }: { children: ReactNode }) => (
    <div data-testid="_raw-table">{children}</div>
  ),
  AgGridProvider: ({ rowData }: { rowData: unknown[] }) => (
    <div data-testid="_ag-grid" data-rows={JSON.stringify(rowData)} />
  ),
}));

vi.mock("~/components/General/Table/AgGridUtils", () => ({
  getColumnDefs: vi.fn(() => []),
  isDate: (_value: any) => false,
}));

const baseOptions = { url: "https://example.com", params: { symbol: "AAPL" } };

const renderToggle = (widgetOverrides: object, updateWidget = vi.fn()) =>
  renderHook(() => useRawDataToggle({ baseOptions }), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <WidgetTestWrapper widgetOverrides={widgetOverrides} updateWidget={updateWidget}>
        {children}
      </WidgetTestWrapper>
    ),
  });

describe("useRawDataToggle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useJsonData).mockReturnValue({
      isLoading: false,
      data: null,
      error: null,
    } as never);
  });

  it("does not expose a toggle or table when the widget has no raw flag", () => {
    const { result } = renderToggle({ raw: false });

    expect(result.current.hasRawFlag).toBe(false);
    expect(result.current.showTable).toBe(false);
    expect(result.current.toggle).toBeNull();
    expect(result.current.tableNode).toBeNull();

    // raw query stays disabled
    const queryOpts = vi.mocked(useJsonData).mock.calls.at(-1)?.[1];
    expect(queryOpts?.enabled).toBe(false);
  });

  it("renders a toggle button but stays in chart view when raw flag is set and rawDataView is off", () => {
    const { result } = renderToggle({ raw: true, storage: { rawDataView: false } });

    expect(result.current.hasRawFlag).toBe(true);
    expect(result.current.showTable).toBe(false);
    expect(result.current.toggle).not.toBeNull();

    const queryOpts = vi.mocked(useJsonData).mock.calls.at(-1)?.[1];
    expect(queryOpts?.enabled).toBe(false);
  });

  it("fetches raw data with raw:true and derives table rows when rawDataView is on", () => {
    const records = [{ symbol: "ETH", tvl: 50 }];
    vi.mocked(useJsonData).mockReturnValue({
      isLoading: false,
      data: { results: records },
      error: null,
    } as never);

    const { result } = renderToggle({ raw: true, storage: { rawDataView: true } });

    expect(result.current.showTable).toBe(true);
    expect(result.current.rawData).toEqual(records);

    const lastCall = vi.mocked(useJsonData).mock.calls.at(-1);
    expect(lastCall?.[0]?.params).toMatchObject({ raw: true, symbol: "AAPL" });
    expect(lastCall?.[1]?.enabled).toBe(true);
    expect(lastCall?.[1]?.staleTime).toBe(0);
  });

  it("toggles widget storage.rawDataView when the button is clicked", () => {
    const updateWidget = vi.fn();
    const { result } = renderToggle(
      { raw: true, storage: { rawDataView: false } },
      updateWidget,
    );

    render(result.current.toggle);
    screen.getByRole("button").click();

    expect(updateWidget).toHaveBeenCalledTimes(1);
    const updater = updateWidget.mock.calls[0][0];
    const next = updater({ storage: { rawDataView: false } });
    expect(next.storage.rawDataView).toBe(true);
  });
});

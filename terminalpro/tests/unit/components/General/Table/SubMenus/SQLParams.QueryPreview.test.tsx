import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryPreview } from "~/components/General/Table/SubMenus/SQLParams";
import { SQLParamsProvider } from "~/components/General/Table/SubMenus/SQLParamsContext";
import type { SqlParamDef, SqlParamDefT, WidgetContextType } from "~/components/types";
import { WidgetContext } from "~/components/Widget.context";

const ENDPOINT_URL = "https://example.com/sql";

function makeWidget({
  sqlParamDefs,
  storedParams,
}: {
  sqlParamDefs?: SqlParamDef[];
  storedParams?: Record<string, unknown>;
}) {
  return {
    uuid: "test",
    id: "test",
    name: "Test",
    type: "custom",
    widgetId: "w1",
    endpoint: { url: ENDPOINT_URL, headers: {} },
    storage: {
      sqlParamDefs: sqlParamDefs ?? [],
      params: storedParams ?? {},
    },
    data: {},
  } as unknown as WidgetContextType["widget"];
}

function renderPreview({
  param,
  sqlParamDefs,
  storedParams,
}: {
  param: SqlParamDefT<"endpoint">;
  sqlParamDefs?: SqlParamDef[];
  storedParams?: Record<string, unknown>;
}) {
  const widget = makeWidget({
    sqlParamDefs: sqlParamDefs ?? [param as SqlParamDef],
    storedParams,
  });

  return render(
    <WidgetContext.Provider
      value={
        {
          widget,
          widgetRef: { current: widget },
          widgetFromJSON: null,
          activeDashboardId: "dash",
          isShared: false,
          isPreview: false,
          uuid: "test",
          updateWidget: vi.fn(),
          getWidget: () => widget,
        } as unknown as WidgetContextType
      }
    >
      <SQLParamsProvider>
        <QueryPreview param={param} />
      </SQLParamsProvider>
    </WidgetContext.Provider>,
  );
}

function getPreviewButton() {
  return screen.getByRole("button", { name: /preview/i });
}

function mockFetchOk(rowData: unknown[] = []) {
  const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => ({ rowData }),
  } as Response);
  return fetchSpy;
}

function readSentQuery(fetchSpy: ReturnType<typeof mockFetchOk>): string {
  const init = fetchSpy.mock.calls[0]?.[1] as RequestInit | undefined;
  const body = init?.body;
  if (typeof body !== "string") throw new Error("Expected fetch body to be string");
  const parsed = JSON.parse(body) as { query?: string };
  if (typeof parsed.query !== "string") {
    throw new Error("Expected body to contain a query string");
  }
  return parsed.query;
}

describe("QueryPreview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("substitutes {{Param}} placeholders with saved widget param values", async () => {
    const fetchSpy = mockFetchOk();

    const metricParam: SqlParamDefT<"endpoint"> = {
      paramName: "Metric",
      description: "",
      type: "endpoint",
      query: "SELECT label, value FROM t WHERE commodity = {{Commodity}}",
    };
    const commodityParam: SqlParamDef = {
      paramName: "Commodity",
      description: "",
      type: "text",
      value: "DraftDefault",
    };

    renderPreview({
      param: metricParam,
      sqlParamDefs: [commodityParam, metricParam as SqlParamDef],
      storedParams: { Commodity: "Wheat" },
    });

    fireEvent.click(getPreviewButton());

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    expect(readSentQuery(fetchSpy)).toBe(
      "SELECT label, value FROM t WHERE commodity = Wheat",
    );
  });

  it("falls back to draft default value when no saved param exists", async () => {
    const fetchSpy = mockFetchOk();

    const metricParam: SqlParamDefT<"endpoint"> = {
      paramName: "Metric",
      description: "",
      type: "endpoint",
      query: "SELECT * FROM t WHERE c = {{Commodity}}",
    };
    const commodityParam: SqlParamDef = {
      paramName: "Commodity",
      description: "",
      type: "text",
      value: "Corn",
    };

    renderPreview({
      param: metricParam,
      sqlParamDefs: [commodityParam, metricParam as SqlParamDef],
      storedParams: {},
    });

    fireEvent.click(getPreviewButton());

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    expect(readSentQuery(fetchSpy)).toBe("SELECT * FROM t WHERE c = Corn");
  });

  it("shows friendly error when a referenced param has no value, without calling fetch", async () => {
    const fetchSpy = mockFetchOk();

    const metricParam: SqlParamDefT<"endpoint"> = {
      paramName: "Metric",
      description: "",
      type: "endpoint",
      query: "SELECT * FROM t WHERE c = {{Commodity}}",
    };
    const commodityParam: SqlParamDef = {
      paramName: "Commodity",
      description: "",
      type: "text",
      value: "",
    };

    renderPreview({
      param: metricParam,
      sqlParamDefs: [commodityParam, metricParam as SqlParamDef],
      storedParams: {},
    });

    fireEvent.click(getPreviewButton());

    await waitFor(() => {
      expect(screen.getByText(/\{\{Commodity\}\}/)).toBeInTheDocument();
    });
    expect(screen.getByText(/has no value/i)).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("sends the query unchanged when there are no placeholders", async () => {
    const fetchSpy = mockFetchOk();

    const metricParam: SqlParamDefT<"endpoint"> = {
      paramName: "Metric",
      description: "",
      type: "endpoint",
      query: "SELECT 1 AS value, 'a' AS label",
    };

    renderPreview({ param: metricParam });

    fireEvent.click(getPreviewButton());

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    expect(readSentQuery(fetchSpy)).toBe("SELECT 1 AS value, 'a' AS label");
  });

  it("substitutes array values via getNewQuery (multi-select)", async () => {
    const fetchSpy = mockFetchOk();

    const metricParam: SqlParamDefT<"endpoint"> = {
      paramName: "Metric",
      description: "",
      type: "endpoint",
      query: "SELECT * FROM t WHERE c IN ({{Commodity}})",
    };
    const commodityParam: SqlParamDef = {
      paramName: "Commodity",
      description: "",
      type: "text",
      multiple: true,
      multiSelect: true,
      value: "",
    };

    renderPreview({
      param: metricParam,
      sqlParamDefs: [commodityParam, metricParam as SqlParamDef],
      storedParams: { Commodity: ["Wheat", "Corn"] },
    });

    fireEvent.click(getPreviewButton());

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    const sent = readSentQuery(fetchSpy);
    expect(sent).toContain("'Wheat'");
    expect(sent).toContain("'Corn'");
  });
});

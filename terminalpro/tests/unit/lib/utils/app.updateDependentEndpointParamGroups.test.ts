import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { updateDependentEndpointParamGroups } from "~/lib/utils/app";

describe("updateDependentEndpointParamGroups", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          { label: "All outcomes", value: "All" },
          {
            label: "Top outcome 1",
            selected: true,
            value: "KXPGATOUR|KXPGATOUR-RBBCAN26-ONE|KXPGATOUR-RBBCAN26",
          },
          {
            label: "Top outcome 2",
            selected: true,
            value: "KXPGATOUR|KXPGATOUR-RBBCAN26-TWO|KXPGATOUR-RBBCAN26",
          },
          {
            label: "Other outcome",
            value: "KXPGATOUR|KXPGATOUR-RBBCAN26-OTHER|KXPGATOUR-RBBCAN26",
          },
        ],
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("sets selected real options on a dependent multi-select group after the event group changes", async () => {
    const updateGroup = vi.fn();
    const groups = [
      {
        id: "event-group",
        type: "endpointParam",
        groupById: "event_ticker-options",
        value: "KXPGATOUR-RBBCAN26",
      },
      {
        id: "history-group",
        type: "endpointParam",
        groupById: "history_market_key-options",
        value: "KXPGATOUR|KXPGATOUR-TEXASOPEN26-SANT|KXPGATOUR-TEXASOPEN26",
      },
    ];

    const tab = {
      index: "dashboard-1",
      data: {
        groups,
        widgets: [
          {
            id: "event_history_chart",
            widgetId: "event_history_chart",
            endpoint: {},
            storage: {
              params: {
                event_ticker: "KXPGATOUR-TEXASOPEN26",
                history_market_key: [
                  "KXPGATOUR|KXPGATOUR-TEXASOPEN26-SANT|KXPGATOUR-TEXASOPEN26",
                ],
              },
            },
            paramGroups: {
              "event_ticker-options": "event-group",
              "history_market_key-options": "history-group",
            },
            params: [
              {
                paramName: "event_ticker",
                type: "endpoint",
                groupById: "event_ticker-options",
              },
              {
                paramName: "history_market_key",
                type: "endpoint",
                groupById: "history_market_key-options",
                multiSelect: true,
                optionsEndpoint: "http://127.0.0.1:7779/options",
                optionsParams: {
                  field: "market_key",
                  event_ticker: "$event_ticker",
                  include_all: "true",
                },
              },
            ],
          },
        ],
      },
    };

    await updateDependentEndpointParamGroups(tab as any, groups[0] as any, updateGroup);

    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:7779/options?field=market_key&event_ticker=KXPGATOUR-RBBCAN26&include_all=true",
      { headers: {} },
    );
    expect(updateGroup).toHaveBeenCalledWith(
      "dashboard-1",
      "history-group",
      expect.objectContaining({
        value: [
          "KXPGATOUR|KXPGATOUR-RBBCAN26-ONE|KXPGATOUR-RBBCAN26",
          "KXPGATOUR|KXPGATOUR-RBBCAN26-TWO|KXPGATOUR-RBBCAN26",
        ],
      }),
      false,
    );
    expect(groups[1].value).toEqual([
      "KXPGATOUR|KXPGATOUR-RBBCAN26-ONE|KXPGATOUR-RBBCAN26",
      "KXPGATOUR|KXPGATOUR-RBBCAN26-TWO|KXPGATOUR-RBBCAN26",
    ]);
  });

  it("does not pick the first dependent option when options are not explicitly selected", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { label: "First event", value: "KXFIRST" },
        { label: "Second event", value: "KXSECOND" },
      ],
    } as Response);

    const updateGroup = vi.fn();
    const groups = [
      {
        id: "category-group",
        type: "endpointParam",
        groupById: "category-options",
        value: "Sports",
      },
      {
        id: "event-group",
        type: "endpointParam",
        groupById: "event_ticker-options",
        value: "",
      },
    ];
    const tab = {
      index: "dashboard-1",
      data: {
        groups,
        widgets: [
          {
            id: "browse_markets",
            widgetId: "browse_markets",
            endpoint: {},
            storage: {
              params: {
                category: "All",
                event_ticker: "",
              },
            },
            paramGroups: {
              "category-options": "category-group",
              "event_ticker-options": "event-group",
            },
            params: [
              {
                paramName: "category",
                type: "endpoint",
                groupById: "category-options",
              },
              {
                paramName: "event_ticker",
                type: "endpoint",
                groupById: "event_ticker-options",
                optionsEndpoint: "http://127.0.0.1:7779/options",
                optionsParams: {
                  field: "event_ticker",
                  category: "$category",
                },
              },
            ],
          },
        ],
      },
    };

    await updateDependentEndpointParamGroups(tab as any, groups[0] as any, updateGroup);

    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:7779/options?field=event_ticker&category=Sports",
      { headers: {} },
    );
    expect(updateGroup).not.toHaveBeenCalled();
    expect(groups[1].value).toBe("");
  });

  it("clears stale dependent values through the endpoint chain", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { label: "First event", value: "KXFIRST" },
          { label: "Second event", value: "KXSECOND" },
        ],
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      } as Response);

    const updateGroup = vi.fn();
    const groups = [
      {
        id: "category-group",
        type: "endpointParam",
        groupById: "category-options",
        value: "Sports",
      },
      {
        id: "event-group",
        type: "endpointParam",
        groupById: "event_ticker-options",
        value: "KXOLD",
      },
      {
        id: "market-group",
        type: "endpointParam",
        groupById: "market_key-options",
        value: "KXOLD|KXOLD-MARKET|KXOLD",
      },
      {
        id: "history-group",
        type: "endpointParam",
        groupById: "history_market_key-options",
        value: ["KXOLD|KXOLD-HISTORY|KXOLD"],
      },
    ];
    const tab = {
      index: "dashboard-1",
      data: {
        groups,
        widgets: [
          {
            id: "browse_markets",
            widgetId: "browse_markets",
            endpoint: {},
            storage: {
              params: {
                category: "All",
                event_ticker: "KXOLD",
                market_key: "KXOLD|KXOLD-MARKET|KXOLD",
                history_market_key: ["KXOLD|KXOLD-HISTORY|KXOLD"],
              },
            },
            paramGroups: {
              "category-options": "category-group",
              "event_ticker-options": "event-group",
              "market_key-options": "market-group",
              "history_market_key-options": "history-group",
            },
            params: [
              {
                paramName: "category",
                type: "endpoint",
                groupById: "category-options",
              },
              {
                paramName: "event_ticker",
                type: "endpoint",
                groupById: "event_ticker-options",
                optionsEndpoint: "http://127.0.0.1:7779/options",
                optionsParams: {
                  field: "event_ticker",
                  category: "$category",
                },
              },
              {
                paramName: "market_key",
                type: "endpoint",
                groupById: "market_key-options",
                optionsEndpoint: "http://127.0.0.1:7779/options",
                optionsParams: {
                  field: "market_key",
                  event_ticker: "$event_ticker",
                  market_key: "$market_key",
                },
              },
              {
                paramName: "history_market_key",
                type: "endpoint",
                groupById: "history_market_key-options",
                multiSelect: true,
                optionsEndpoint: "http://127.0.0.1:7779/options",
                optionsParams: {
                  field: "market_key",
                  event_ticker: "$event_ticker",
                  market_key: "$history_market_key",
                },
              },
            ],
          },
        ],
      },
    };

    await updateDependentEndpointParamGroups(tab as any, groups[0] as any, updateGroup);

    expect(updateGroup).toHaveBeenNthCalledWith(
      1,
      "dashboard-1",
      "event-group",
      expect.objectContaining({ value: "" }),
      false,
    );
    expect(updateGroup).toHaveBeenNthCalledWith(
      2,
      "dashboard-1",
      "market-group",
      expect.objectContaining({ value: "" }),
      false,
    );
    expect(updateGroup).toHaveBeenNthCalledWith(
      3,
      "dashboard-1",
      "history-group",
      expect.objectContaining({ value: [] }),
      false,
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      "http://127.0.0.1:7779/options?field=market_key",
      { headers: {} },
    );
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(groups[1].value).toBe("");
    expect(groups[2].value).toBe("");
    expect(groups[3].value).toEqual([]);
  });

  it("continues clearing stale downstream values when an intermediate group is already empty", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { label: "First event", value: "KXFIRST" },
          { label: "Second event", value: "KXSECOND" },
        ],
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      } as Response);

    const updateGroup = vi.fn();
    const groups = [
      {
        id: "category-group",
        type: "endpointParam",
        groupById: "category-options",
        value: "Crypto",
      },
      {
        id: "event-group",
        type: "endpointParam",
        groupById: "event_ticker-options",
        value: "",
      },
      {
        id: "market-group",
        type: "endpointParam",
        groupById: "market_key-options",
        value: "KXOLD|KXOLD-MARKET|KXOLD",
      },
    ];
    const tab = {
      index: "dashboard-1",
      data: {
        groups,
        widgets: [
          {
            id: "browse_markets",
            widgetId: "browse_markets",
            endpoint: {},
            storage: {
              params: {
                category: "All",
                event_ticker: "",
                market_key: "KXOLD|KXOLD-MARKET|KXOLD",
              },
            },
            paramGroups: {
              "category-options": "category-group",
              "event_ticker-options": "event-group",
              "market_key-options": "market-group",
            },
            params: [
              {
                paramName: "category",
                type: "endpoint",
                groupById: "category-options",
              },
              {
                paramName: "event_ticker",
                type: "endpoint",
                groupById: "event_ticker-options",
                optionsEndpoint: "http://127.0.0.1:7779/options",
                optionsParams: {
                  field: "event_ticker",
                  category: "$category",
                },
              },
              {
                paramName: "market_key",
                type: "endpoint",
                groupById: "market_key-options",
                optionsEndpoint: "http://127.0.0.1:7779/options",
                optionsParams: {
                  field: "market_key",
                  event_ticker: "$event_ticker",
                  market_key: "$market_key",
                },
              },
            ],
          },
        ],
      },
    };

    await updateDependentEndpointParamGroups(tab as any, groups[0] as any, updateGroup);

    expect(updateGroup).toHaveBeenCalledTimes(1);
    expect(updateGroup).toHaveBeenCalledWith(
      "dashboard-1",
      "market-group",
      expect.objectContaining({ value: "" }),
      false,
    );
    expect(groups[2].value).toBe("");
  });
});

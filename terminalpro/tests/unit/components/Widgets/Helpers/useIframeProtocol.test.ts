import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockConfig } from "../../../../mocks/runtimeConfig";

function createMockIframeRef(contentWindow: Window | null = window, src = "") {
  return {
    current: { contentWindow, src },
  } as unknown as React.RefObject<HTMLIFrameElement>;
}

function postFromIframe(iframeRef: React.RefObject<HTMLIFrameElement>, data: unknown) {
  const event = new MessageEvent("message", {
    data,
    source: iframeRef.current?.contentWindow,
  });
  window.dispatchEvent(event);
}

vi.mock("~/components/Widget.context", () => ({
  useWidgetContext: vi.fn(() => ({ widget: {} })),
}));

describe("useIframeProtocol", () => {
  let useIframeProtocol: typeof import("~/components/Widgets/Helpers/useIframeProtocol").useIframeProtocol;

  beforeEach(async () => {
    vi.resetModules();
    vi.useFakeTimers();
    mockConfig.data.allowHtmlJsExecution = true;
    vi.doMock("~/lib/runtimeConfig", () => ({
      getConfig: () => mockConfig,
      _resetConfig: vi.fn(),
    }));
    const mod = await import("~/components/Widgets/Helpers/useIframeProtocol");
    useIframeProtocol = mod.useIframeProtocol;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts with null manifest", () => {
    const iframeRef = createMockIframeRef();
    const { result } = renderHook(() => useIframeProtocol({ iframeRef }));
    expect(result.current.manifest).toBeNull();
  });

  it("sets manifest on openbb-connect message", () => {
    const iframeRef = createMockIframeRef();
    const { result } = renderHook(() => useIframeProtocol({ iframeRef }));

    const widgets = [{ widgetId: "w1", name: "Widget 1", dataType: "table" as const }];

    act(() => {
      postFromIframe(iframeRef, { type: "openbb-connect", widgets });
    });

    expect(result.current.manifest).toEqual(widgets);
  });

  it("requestWidgetData sends openbb-request and resolves on response", async () => {
    const iframeRef = createMockIframeRef();
    const postMessageSpy = vi.fn();
    (iframeRef.current as any).contentWindow = {
      postMessage: postMessageSpy,
    };
    // Override source check — use the mocked contentWindow
    const mockWindow = (iframeRef.current as any).contentWindow;

    const { result } = renderHook(() => useIframeProtocol({ iframeRef }));

    let resolved: any;
    act(() => {
      resolved = result.current.requestWidgetData("w1");
    });

    expect(postMessageSpy).toHaveBeenCalledWith(
      { type: "openbb-request", widgetId: "w1" },
      "*",
    );

    const responseData = {
      type: "openbb-data",
      widgetId: "w1",
      dataType: "table",
      data: [{ a: 1 }],
    };

    act(() => {
      const event = new MessageEvent("message", {
        data: responseData,
        source: mockWindow,
      });
      window.dispatchEvent(event);
    });

    await expect(resolved).resolves.toEqual(responseData);
  });

  it("requestWidgetData rejects after timeout", async () => {
    const iframeRef = createMockIframeRef();
    const postMessageSpy = vi.fn();
    (iframeRef.current as any).contentWindow = {
      postMessage: postMessageSpy,
    };

    const { result } = renderHook(() => useIframeProtocol({ iframeRef }));

    let promise: Promise<any>;
    act(() => {
      promise = result.current.requestWidgetData("w1");
    });

    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    await expect(promise!).rejects.toThrow('Request for widget "w1" timed out');
  });

  it("openbb-error rejects pending requestWidgetData with error message", async () => {
    const iframeRef = createMockIframeRef();
    const postMessageSpy = vi.fn();
    (iframeRef.current as any).contentWindow = {
      postMessage: postMessageSpy,
    };
    const mockWindow = (iframeRef.current as any).contentWindow;

    const { result } = renderHook(() => useIframeProtocol({ iframeRef }));

    let promise: Promise<any>;
    act(() => {
      promise = result.current.requestWidgetData("w1");
    });

    act(() => {
      const event = new MessageEvent("message", {
        data: {
          type: "openbb-error",
          widgetId: "w1",
          error: "Data source unavailable",
        },
        source: mockWindow,
      });
      window.dispatchEvent(event);
    });

    await expect(promise!).rejects.toThrow("Data source unavailable");
  });

  it("openbb-error for unknown widget does not crash", () => {
    const iframeRef = createMockIframeRef();

    renderHook(() => useIframeProtocol({ iframeRef }));

    // Should not throw — no pending request for "unknown"
    act(() => {
      postFromIframe(iframeRef, {
        type: "openbb-error",
        widgetId: "unknown",
        error: "Not found",
      });
    });
  });

  it("ignores messages from wrong source", () => {
    const iframeRef = createMockIframeRef();
    const { result } = renderHook(() => useIframeProtocol({ iframeRef }));

    act(() => {
      // Post with null source (different from iframe's contentWindow)
      const event = new MessageEvent("message", {
        data: {
          type: "openbb-connect",
          widgets: [{ widgetId: "w1", name: "X", dataType: "table" }],
        },
        source: null,
      });
      window.dispatchEvent(event);
    });

    expect(result.current.manifest).toBeNull();
  });

  it("fires onAiData callback for aiData messages", () => {
    const iframeRef = createMockIframeRef();
    const onAiData = vi.fn();
    renderHook(() => useIframeProtocol({ iframeRef, onAiData }));

    act(() => {
      postFromIframe(iframeRef, { type: "aiData", data: { foo: "bar" } });
    });

    expect(onAiData).toHaveBeenCalledWith(JSON.stringify({ foo: "bar" }));
  });

  it("fires onParamsUpdate callback for iframe param update messages", () => {
    const iframeRef = createMockIframeRef();
    const onParamsUpdate = vi.fn();
    renderHook(() => useIframeProtocol({ iframeRef, onParamsUpdate }));

    act(() => {
      postFromIframe(iframeRef, {
        type: "openbb:widget-params:update",
        params: { event_ticker: "KXSB-27", reverse: false, limit: 40 },
      });
    });

    expect(onParamsUpdate).toHaveBeenCalledWith({
      event_ticker: "KXSB-27",
      reverse: "false",
      limit: "40",
    });
  });

  it("supports single paramName/value iframe param update messages", () => {
    const iframeRef = createMockIframeRef();
    const onParamsUpdate = vi.fn();
    renderHook(() => useIframeProtocol({ iframeRef, onParamsUpdate }));

    act(() => {
      postFromIframe(iframeRef, {
        type: "openbb:params:update",
        paramName: "event_ticker",
        value: "KXNBA-26",
      });
    });

    expect(onParamsUpdate).toHaveBeenCalledWith({
      event_ticker: "KXNBA-26",
    });
  });

  it("accepts openbb-connect from nested iframe via origin match", () => {
    const iframeRef = createMockIframeRef(
      {} as Window, // outer Streamlit window — won't match event.source
      "http://localhost:8501/app",
    );
    const { result } = renderHook(() => useIframeProtocol({ iframeRef }));

    const widgets = [
      { widgetId: "w1", name: "Nested Widget", dataType: "table" as const },
    ];

    act(() => {
      // Simulate message from nested sub-iframe with matching origin
      const event = new MessageEvent("message", {
        data: { type: "openbb-connect", widgets },
        source: { postMessage: vi.fn() } as unknown as Window,
        origin: "http://localhost:8501",
      });
      window.dispatchEvent(event);
    });

    expect(result.current.manifest).toEqual(widgets);
  });

  it("sends openbb-request to stored bridgeSource after handshake", async () => {
    const nestedPostMessage = vi.fn();
    const nestedWindow = {
      postMessage: nestedPostMessage,
    } as unknown as Window;
    const iframeRef = createMockIframeRef({} as Window, "http://localhost:8501/app");

    const { result } = renderHook(() => useIframeProtocol({ iframeRef }));

    // Simulate handshake from nested iframe
    act(() => {
      const event = new MessageEvent("message", {
        data: {
          type: "openbb-connect",
          widgets: [{ widgetId: "w1", name: "W", dataType: "table" }],
        },
        source: nestedWindow,
        origin: "http://localhost:8501",
      });
      window.dispatchEvent(event);
    });

    // Request should be sent to the nested source, not the outer iframe
    act(() => {
      result.current.requestWidgetData("w1");
    });

    expect(nestedPostMessage).toHaveBeenCalledWith(
      { type: "openbb-request", widgetId: "w1" },
      "http://localhost:8501",
    );
  });

  it("parses params from openbb-connect message", () => {
    const iframeRef = createMockIframeRef();
    const { result } = renderHook(() => useIframeProtocol({ iframeRef }));

    const widgets = [{ widgetId: "w1", name: "Widget 1", dataType: "table" as const }];
    const params = [
      {
        paramName: "sector",
        label: "Sector",
        type: "text" as const,
        value: "Technology",
        options: [
          { label: "Technology", value: "Technology" },
          { label: "Financials", value: "Financials" },
        ],
      },
    ];

    act(() => {
      postFromIframe(iframeRef, { type: "openbb-connect", widgets, params });
    });

    expect(result.current.paramDefs).toEqual(params);
  });

  it("parses number, date, and boolean param types from openbb-connect", () => {
    const iframeRef = createMockIframeRef();
    const { result } = renderHook(() => useIframeProtocol({ iframeRef }));

    const widgets = [{ widgetId: "w1", name: "Widget 1", dataType: "table" as const }];
    const params = [
      {
        paramName: "min_shares",
        label: "Min Shares",
        type: "number" as const,
        value: "100",
        min: 0,
        max: 10000,
        step: 10,
      },
      {
        paramName: "as_of_date",
        label: "As Of Date",
        type: "date" as const,
        value: "2026-01-01",
      },
      {
        paramName: "show_pnl",
        label: "Show PnL",
        type: "boolean" as const,
        value: "true",
      },
    ];

    act(() => {
      postFromIframe(iframeRef, { type: "openbb-connect", widgets, params });
    });

    expect(result.current.paramDefs).toEqual(params);
  });

  it("starts with null paramDefs", () => {
    const iframeRef = createMockIframeRef();
    const { result } = renderHook(() => useIframeProtocol({ iframeRef }));
    expect(result.current.paramDefs).toBeNull();
  });

  it("paramDefs remain null when openbb-connect has no params", () => {
    const iframeRef = createMockIframeRef();
    const { result } = renderHook(() => useIframeProtocol({ iframeRef }));

    act(() => {
      postFromIframe(iframeRef, {
        type: "openbb-connect",
        widgets: [{ widgetId: "w1", name: "W", dataType: "table" }],
      });
    });

    expect(result.current.paramDefs).toBeNull();
  });

  it("sendParamsUpdate posts openbb-params-update to bridge source", () => {
    const nestedPostMessage = vi.fn();
    const nestedWindow = {
      postMessage: nestedPostMessage,
    } as unknown as Window;
    const iframeRef = createMockIframeRef({} as Window, "http://localhost:8501/app");

    const { result } = renderHook(() => useIframeProtocol({ iframeRef }));

    // Handshake to establish bridge source
    act(() => {
      const event = new MessageEvent("message", {
        data: {
          type: "openbb-connect",
          widgets: [{ widgetId: "w1", name: "W", dataType: "table" }],
          params: [{ paramName: "sector", type: "text", value: "All" }],
        },
        source: nestedWindow,
        origin: "http://localhost:8501",
      });
      window.dispatchEvent(event);
    });

    act(() => {
      result.current.sendParamsUpdate({ sector: "Financials" });
    });

    expect(nestedPostMessage).toHaveBeenCalledWith(
      { type: "openbb-params-update", params: { sector: "Financials" } },
      "http://localhost:8501",
    );
  });

  it("sendParamsUpdate falls back to contentWindow when no bridge source", () => {
    const postMessageSpy = vi.fn();
    const iframeRef = createMockIframeRef();
    (iframeRef.current as any).contentWindow = { postMessage: postMessageSpy };

    const { result } = renderHook(() => useIframeProtocol({ iframeRef }));

    act(() => {
      result.current.sendParamsUpdate({ ticker: "MSFT" });
    });

    expect(postMessageSpy).toHaveBeenCalledWith(
      { type: "openbb-params-update", params: { ticker: "MSFT" } },
      "*",
    );
  });

  it("does not listen when disabled", () => {
    const iframeRef = createMockIframeRef();
    const onAiData = vi.fn();
    // mockGetConfig.mockReturnValue({ data: { allowHtmlJsExecution: false } });
    mockConfig.data.allowHtmlJsExecution = false;

    renderHook(() => useIframeProtocol({ iframeRef, onAiData }));

    act(() => {
      postFromIframe(iframeRef, { type: "aiData", data: { foo: "bar" } });
    });

    expect(onAiData).not.toHaveBeenCalled();
  });

  describe("message validation", () => {
    it("rejects openbb-connect with missing widgets array", () => {
      const iframeRef = createMockIframeRef();
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const { result } = renderHook(() => useIframeProtocol({ iframeRef }));

      act(() => {
        postFromIframe(iframeRef, { type: "openbb-connect" });
      });

      expect(result.current.manifest).toBeNull();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("invalid openbb-connect"),
        expect.any(Array),
      );
      warnSpy.mockRestore();
    });

    it("rejects openbb-connect with malformed widget entries", () => {
      const iframeRef = createMockIframeRef();
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const { result } = renderHook(() => useIframeProtocol({ iframeRef }));

      act(() => {
        postFromIframe(iframeRef, {
          type: "openbb-connect",
          widgets: [{ name: "Missing widgetId" }],
        });
      });

      expect(result.current.manifest).toBeNull();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("invalid openbb-connect"),
        expect.any(Array),
      );
      warnSpy.mockRestore();
    });

    it("rejects openbb-data with missing widgetId", async () => {
      const iframeRef = createMockIframeRef();
      const postMessageSpy = vi.fn();
      (iframeRef.current as any).contentWindow = {
        postMessage: postMessageSpy,
      };
      const mockWindow = (iframeRef.current as any).contentWindow;
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const { result } = renderHook(() => useIframeProtocol({ iframeRef }));

      let promise: Promise<any>;
      act(() => {
        promise = result.current.requestWidgetData("w1");
      });

      act(() => {
        const event = new MessageEvent("message", {
          data: { type: "openbb-data", data: [{ a: 1 }] },
          source: mockWindow,
        });
        window.dispatchEvent(event);
      });

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("invalid openbb-data"),
        expect.any(Array),
      );

      // Request should still be pending (not resolved by invalid message)
      act(() => {
        vi.advanceTimersByTime(10_000);
      });
      await expect(promise!).rejects.toThrow("timed out");
      warnSpy.mockRestore();
    });

    it("rejects openbb-error with missing error string", async () => {
      const iframeRef = createMockIframeRef();
      const postMessageSpy = vi.fn();
      (iframeRef.current as any).contentWindow = {
        postMessage: postMessageSpy,
      };
      const mockWindow = (iframeRef.current as any).contentWindow;
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const { result } = renderHook(() => useIframeProtocol({ iframeRef }));

      let promise: Promise<any>;
      act(() => {
        promise = result.current.requestWidgetData("w1");
      });

      act(() => {
        const event = new MessageEvent("message", {
          data: { type: "openbb-error", widgetId: "w1" },
          source: mockWindow,
        });
        window.dispatchEvent(event);
      });

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("invalid openbb-error"),
        expect.any(Array),
      );

      // Request should still be pending (not rejected by invalid message)
      act(() => {
        vi.advanceTimersByTime(10_000);
      });
      await expect(promise!).rejects.toThrow("timed out");
      warnSpy.mockRestore();
    });
  });
});

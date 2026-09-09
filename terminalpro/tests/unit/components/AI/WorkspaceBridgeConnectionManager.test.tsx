import { act, render, waitFor } from "@testing-library/react";
import type { AxiosResponse } from "axios";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "~/api/api";
import { WorkspaceBridgeConnectionManager } from "~/components/AI/WorkspaceBridgeConnectionManager";
import { useAuthStore } from "~/lib/state/auth";
import { useWorkspaceBridgeStore } from "~/lib/state/workspaceBridge";

const mockHandleCommand = vi.fn();
const routeMock = vi.hoisted(() => ({
  dashboardId: "dashboard-123",
  tabId: "tab-news",
  listeners: new Set<() => void>(),
  getSnapshot() {
    return `${this.dashboardId}:${this.tabId}`;
  },
  setRoute(dashboardId: string, tabId: string) {
    this.dashboardId = dashboardId;
    this.tabId = tabId;
    this.listeners.forEach((listener) => listener());
  },
}));

vi.mock("~/lib/runtimeConfig", () => ({
  getConfig: () => ({
    urls: { backend: "http://backend.test", ai: "", platform: "", database: "" },
    ui: { defaultTheme: "dark" },
    whiteLabel: {},
    data: { packageDataEnabled: false, allowedDataVendors: [], allowedDbTypes: [] },
    services: { cloudflareWorker: false },
    copilot: { openbbCopilot: false },
  }),
}));

vi.mock("react-router-dom", async () => {
  const React = await vi.importActual<typeof import("react")>("react");
  const subscribe = (listener: () => void) => {
    routeMock.listeners.add(listener);
    return () => routeMock.listeners.delete(listener);
  };

  return {
    useParams: vi.fn(() => {
      React.useSyncExternalStore(subscribe, () => routeMock.getSnapshot());
      return { id: routeMock.dashboardId };
    }),
    useSearchParams: vi.fn(() => {
      React.useSyncExternalStore(subscribe, () => routeMock.getSnapshot());
      return [new URLSearchParams(routeMock.tabId ? `tab=${routeMock.tabId}` : "")];
    }),
  };
});

vi.mock("~/components/AI/hooks/useWidgetsInCurrentDashboard", () => ({
  useSyncWidgetsInCurrentDashboard: vi.fn(),
}));

vi.mock("~/components/AI/hooks/useWorkspaceBridgeCommandHandler", () => ({
  useWorkspaceBridgeCommandHandler: () => mockHandleCommand,
}));

vi.mock("~/components/AI/hooks/useActiveWorkspaceDashboardId", async () => {
  const React = await vi.importActual<typeof import("react")>("react");

  return {
    useActiveWorkspaceDashboardId: () => {
      React.useSyncExternalStore(
        (listener) => {
          routeMock.listeners.add(listener);
          return () => routeMock.listeners.delete(listener);
        },
        () => routeMock.getSnapshot(),
      );
      return routeMock.dashboardId;
    },
  };
});

vi.mock("sonner", () => ({
  toast: {
    warning: vi.fn(),
    error: vi.fn(),
    dismiss: vi.fn(),
  },
}));

class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  static instances: MockWebSocket[] = [];

  url: string;
  readyState = MockWebSocket.OPEN;
  onopen: ((event?: unknown) => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: ((event?: unknown) => void) | null = null;
  onerror: ((event?: unknown) => void) | null = null;
  send = vi.fn();
  close = vi.fn(() => {
    this.readyState = MockWebSocket.CLOSED;
  });
  private messageListeners: ((event: { data: string }) => void)[] = [];

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  emitOpen() {
    this.onopen?.();
  }

  emitMessage(message: unknown) {
    // Real browser WebSockets never deliver messages once closed; failing
    // loudly here keeps tests from passing against a dead socket.
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error(
        `MockWebSocket: cannot deliver a message to a socket with readyState ${this.readyState}`,
      );
    }
    for (const listener of [...this.messageListeners])
      listener({ data: JSON.stringify(message) });
  }

  emitRawMessage(data: string) {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error(
        `MockWebSocket: cannot deliver a message to a socket with readyState ${this.readyState}`,
      );
    }
    for (const listener of [...this.messageListeners]) listener({ data });
  }

  emitClose() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.();
  }

  addEventListener(
    type: string,
    listener: (event: { data: string }) => void,
    options?: { signal?: AbortSignal },
  ) {
    if (type !== "message" || options?.signal?.aborted) return;
    this.messageListeners.push(listener);
    options?.signal?.addEventListener("abort", () => {
      this.messageListeners = this.messageListeners.filter(
        (registered) => registered !== listener,
      );
    });
  }

  emitError() {
    // A fatal socket error closes the connection; real sockets are never
    // usable again after firing onerror.
    this.readyState = MockWebSocket.CLOSED;
    this.onerror?.();
  }
}

describe("WorkspaceBridgeConnectionManager", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    routeMock.dashboardId = "dashboard-123";
    routeMock.tabId = "tab-news";
    MockWebSocket.instances = [];
    mockHandleCommand.mockResolvedValue({
      ok: true,
      command: "read_widget",
      message: "Widget loaded.",
    });
    vi.stubGlobal("WebSocket", MockWebSocket as unknown as typeof WebSocket);
    // apiClient is mocked globally in tests/mocks/api-client.ts; the session
    // bootstrap goes through apiClient.post via startBridgeSession.
    vi.mocked(apiClient.post).mockResolvedValue({
      status: 200,
      data: {
        session: {
          session_id: "session-123",
          token: "token-123",
          client_name: "workspace-ui",
          current_dashboard_id: "dashboard-123",
          current_tab_id: "tab-news",
        },
        websocket_url:
          "ws://127.0.0.1:8787/bridge/ws?session_id=session-123&token=token-123",
      },
    } as AxiosResponse);
    useAuthStore.setState({
      user: {
        email: "test@openbb.co",
        username: "test",
        token: "session-token",
        entity_name: null,
        role: null,
        uuid: "user-1",
      },
    });
    useWorkspaceBridgeStore.setState({
      isEnabled: false,
      status: "disabled",
      lastError: null,
      // The reconnecting toast is only surfaced while the modal is open, so the
      // toast-behavior cases below run with it open.
      isModalOpen: true,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    useAuthStore.setState({ user: null });
    act(() => {
      useWorkspaceBridgeStore.getState().disconnect();
    });
    vi.useRealTimers();
  });

  it("marks the bridge connected after session_ready", async () => {
    render(<WorkspaceBridgeConnectionManager />);

    act(() => {
      useWorkspaceBridgeStore.getState().connect();
    });
    await act(async () => {
      vi.runOnlyPendingTimers();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        "/pro/workspace-mcp/bridge/session/start",
        {
          client_name: "workspace-ui",
          current_dashboard_id: "dashboard-123",
          current_tab_id: "tab-news",
        },
        expect.objectContaining({ signal: expect.anything() }),
      );
    });
    await waitFor(() => {
      expect(MockWebSocket.instances).toHaveLength(1);
    });

    act(() => {
      MockWebSocket.instances[0].emitMessage({
        type: "session_ready",
        session: {
          session_id: "session-123",
          token: "token-123",
          client_name: "workspace-ui",
          current_dashboard_id: "dashboard-123",
          current_tab_id: "tab-news",
        },
      });
    });

    await waitFor(() => {
      expect(useWorkspaceBridgeStore.getState().status).toBe("connected");
      expect(useWorkspaceBridgeStore.getState().lastError).toBeNull();
    });
  });

  it("dispatches websocket command requests through the browser handler", async () => {
    render(<WorkspaceBridgeConnectionManager />);

    act(() => {
      useWorkspaceBridgeStore.getState().connect();
    });
    await act(async () => {
      vi.runOnlyPendingTimers();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(MockWebSocket.instances).toHaveLength(1);
    });

    const socket = MockWebSocket.instances[0];

    act(() => {
      socket.emitMessage({
        type: "session_ready",
        session: {
          session_id: "session-123",
          token: "token-123",
          client_name: "workspace-ui",
          current_dashboard_id: "dashboard-123",
          current_tab_id: "tab-news",
        },
      });
    });

    await waitFor(() => {
      expect(useWorkspaceBridgeStore.getState().status).toBe("connected");
    });

    act(() => {
      socket.emitMessage({
        type: "command_request",
        command: {
          command: "read_widget",
          request_id: "cmd-123",
          dashboard_id: "dashboard-123",
          widget_uuid: "widget-123",
        },
      });
    });

    await waitFor(() => {
      expect(mockHandleCommand).toHaveBeenCalledWith({
        command: "read_widget",
        request_id: "cmd-123",
        dashboard_id: "dashboard-123",
        widget_uuid: "widget-123",
      });
      expect(socket.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: "command_result",
          result: {
            ok: true,
            command: "read_widget",
            message: "Widget loaded.",
          },
        }),
      );
    });
  });

  it("fails the bridge when the server sends an invalid payload", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<WorkspaceBridgeConnectionManager />);

    act(() => {
      useWorkspaceBridgeStore.getState().connect();
    });
    await act(async () => {
      vi.runOnlyPendingTimers();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(MockWebSocket.instances).toHaveLength(1);
    });

    act(() => {
      MockWebSocket.instances[0].emitRawMessage("{not valid json");
    });

    await waitFor(() => {
      expect(useWorkspaceBridgeStore.getState().status).toBe("disabled");
      expect(useWorkspaceBridgeStore.getState().isEnabled).toBe(false);
      expect(useWorkspaceBridgeStore.getState().lastError).toContain(
        "invalid websocket payload",
      );
    });
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("fails the bridge when the server reports an error event", async () => {
    render(<WorkspaceBridgeConnectionManager />);

    act(() => {
      useWorkspaceBridgeStore.getState().connect();
    });
    await act(async () => {
      vi.runOnlyPendingTimers();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(MockWebSocket.instances).toHaveLength(1);
    });

    act(() => {
      MockWebSocket.instances[0].emitMessage({
        type: "error",
        error: { message: "session revoked" },
      });
    });

    await waitFor(() => {
      expect(useWorkspaceBridgeStore.getState().status).toBe("disabled");
      expect(useWorkspaceBridgeStore.getState().isEnabled).toBe(false);
      expect(useWorkspaceBridgeStore.getState().lastError).toBe("session revoked");
    });
  });

  it("retries after an unexpected close and clears the reconnecting toast on recovery", async () => {
    render(<WorkspaceBridgeConnectionManager />);

    act(() => {
      useWorkspaceBridgeStore.getState().connect();
    });
    await act(async () => {
      vi.runOnlyPendingTimers();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(MockWebSocket.instances).toHaveLength(1);
    });

    act(() => {
      MockWebSocket.instances[0].emitMessage({
        type: "session_ready",
        session: {
          session_id: "session-123",
          token: "token-123",
          client_name: "workspace-ui",
          current_dashboard_id: "dashboard-123",
          current_tab_id: "tab-news",
        },
      });
    });

    await waitFor(() => {
      expect(useWorkspaceBridgeStore.getState().status).toBe("connected");
    });

    act(() => {
      MockWebSocket.instances[0].emitClose();
    });

    await waitFor(() => {
      expect(useWorkspaceBridgeStore.getState().status).toBe("reconnecting");
      expect(toast.warning).toHaveBeenCalledWith(
        "Workspace MCP companion reconnecting",
        expect.objectContaining({
          id: "workspace-bridge-reconnecting",
          description: expect.stringContaining("Retrying in 1 second"),
        }),
      );
    });

    await act(async () => {
      vi.advanceTimersByTime(1000);
      await Promise.resolve();
    });

    // The reconnect must open a brand-new socket: a closed WebSocket can
    // never be reused, even when the backend returns the same URL.
    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledTimes(2);
      expect(MockWebSocket.instances).toHaveLength(2);
    });

    act(() => {
      MockWebSocket.instances[1].emitMessage({
        type: "session_ready",
        session: {
          session_id: "session-123",
          token: "token-123",
          client_name: "workspace-ui",
          current_dashboard_id: "dashboard-123",
          current_tab_id: "tab-news",
        },
      });
    });

    await waitFor(() => {
      expect(useWorkspaceBridgeStore.getState().status).toBe("connected");
      expect(toast.dismiss).toHaveBeenCalledWith("workspace-bridge-reconnecting");
    });
  });

  it("bootstraps the reconnect session with the latest dashboard context", async () => {
    render(<WorkspaceBridgeConnectionManager />);

    act(() => {
      useWorkspaceBridgeStore.getState().connect();
    });
    await act(async () => {
      vi.runOnlyPendingTimers();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(MockWebSocket.instances).toHaveLength(1);
    });

    act(() => {
      MockWebSocket.instances[0].emitMessage({
        type: "session_ready",
        session: {
          session_id: "session-123",
          token: "token-123",
          client_name: "workspace-ui",
          current_dashboard_id: "dashboard-123",
          current_tab_id: "tab-news",
        },
      });
    });

    await waitFor(() => {
      expect(useWorkspaceBridgeStore.getState().status).toBe("connected");
    });

    // Drop the connection first, then navigate during the backoff window:
    // the reconnect handshake must carry the new dashboard/tab, not the
    // context captured when the retry was scheduled.
    act(() => {
      MockWebSocket.instances[0].emitClose();
    });
    act(() => {
      routeMock.setRoute("dashboard-456", "tab-earnings");
    });

    await act(async () => {
      vi.advanceTimersByTime(1000);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenLastCalledWith(
        "/pro/workspace-mcp/bridge/session/start",
        {
          client_name: "workspace-ui",
          current_dashboard_id: "dashboard-456",
          current_tab_id: "tab-earnings",
        },
        expect.objectContaining({ signal: expect.anything() }),
      );
    });
  });

  it("reconnects silently without a toast while the modal is closed", async () => {
    useWorkspaceBridgeStore.setState({ isModalOpen: false });
    render(<WorkspaceBridgeConnectionManager />);

    act(() => {
      useWorkspaceBridgeStore.getState().connect();
    });
    await act(async () => {
      vi.runOnlyPendingTimers();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(MockWebSocket.instances).toHaveLength(1);
    });

    act(() => {
      MockWebSocket.instances[0].emitMessage({
        type: "session_ready",
        session: {
          session_id: "session-123",
          token: "token-123",
          client_name: "workspace-ui",
          current_dashboard_id: "dashboard-123",
          current_tab_id: "tab-news",
        },
      });
    });

    await waitFor(() => {
      expect(useWorkspaceBridgeStore.getState().status).toBe("connected");
    });

    act(() => {
      MockWebSocket.instances[0].emitClose();
    });

    // The drop still drives a background reconnect...
    await waitFor(() => {
      expect(useWorkspaceBridgeStore.getState().status).toBe("reconnecting");
    });
    // ...but no toast is shown because the modal is closed.
    expect(toast.warning).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1000);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(MockWebSocket.instances).toHaveLength(2);
    });
    expect(toast.warning).not.toHaveBeenCalled();
  });

  it("deactivates the bridge after bounded reconnect failures", async () => {
    render(<WorkspaceBridgeConnectionManager />);

    act(() => {
      useWorkspaceBridgeStore.getState().connect();
    });
    await act(async () => {
      vi.runOnlyPendingTimers();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(MockWebSocket.instances).toHaveLength(1);
    });

    act(() => {
      MockWebSocket.instances[0].emitMessage({
        type: "session_ready",
        session: {
          session_id: "session-123",
          token: "token-123",
          client_name: "workspace-ui",
          current_dashboard_id: "dashboard-123",
          current_tab_id: "tab-news",
        },
      });
    });

    await waitFor(() => {
      expect(useWorkspaceBridgeStore.getState().status).toBe("connected");
    });

    act(() => {
      MockWebSocket.instances[0].emitClose();
    });

    await waitFor(() => {
      expect(toast.warning).toHaveBeenCalledWith(
        "Workspace MCP companion reconnecting",
        expect.objectContaining({
          description: expect.stringContaining("Retrying in 1 second"),
        }),
      );
    });

    await act(async () => {
      vi.advanceTimersByTime(1000);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(MockWebSocket.instances).toHaveLength(2);
    });
    act(() => {
      MockWebSocket.instances[1].emitError();
    });

    await waitFor(() => {
      expect(toast.warning).toHaveBeenLastCalledWith(
        "Workspace MCP companion reconnecting",
        expect.objectContaining({
          description: expect.stringContaining("Retrying in 2 seconds"),
        }),
      );
    });

    await act(async () => {
      vi.advanceTimersByTime(2000);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(MockWebSocket.instances).toHaveLength(3);
    });
    act(() => {
      MockWebSocket.instances[2].emitError();
    });

    await waitFor(() => {
      expect(toast.warning).toHaveBeenLastCalledWith(
        "Workspace MCP companion reconnecting",
        expect.objectContaining({
          description: expect.stringContaining("Retrying in 4 seconds"),
        }),
      );
    });

    await act(async () => {
      vi.advanceTimersByTime(4000);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(MockWebSocket.instances).toHaveLength(4);
    });
    act(() => {
      MockWebSocket.instances[3].emitError();
    });

    await waitFor(() => {
      expect(useWorkspaceBridgeStore.getState().isEnabled).toBe(false);
      expect(useWorkspaceBridgeStore.getState().status).toBe("disabled");
      expect(useWorkspaceBridgeStore.getState().lastError).toContain(
        "Failed to reconnect after 3 attempts",
      );
      expect(toast.error).toHaveBeenCalledWith(
        "Workspace MCP companion disconnected",
        expect.objectContaining({
          description: expect.stringContaining("Failed to reconnect after 3 attempts"),
        }),
      );
    });
  });

  it("reconnects when the session start request times out", async () => {
    vi.mocked(apiClient.post).mockRejectedValueOnce(
      new DOMException("The operation was aborted due to timeout", "TimeoutError"),
    );
    render(<WorkspaceBridgeConnectionManager />);

    act(() => {
      useWorkspaceBridgeStore.getState().connect();
    });
    await act(async () => {
      vi.runOnlyPendingTimers();
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(useWorkspaceBridgeStore.getState().status).toBe("reconnecting");
      expect(toast.warning).toHaveBeenCalledWith(
        "Workspace MCP companion reconnecting",
        expect.anything(),
      );
    });
  });

  it("dismisses the reconnecting toast when the bridge is disconnected", async () => {
    render(<WorkspaceBridgeConnectionManager />);

    act(() => {
      useWorkspaceBridgeStore.getState().connect();
    });
    await act(async () => {
      vi.runOnlyPendingTimers();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(MockWebSocket.instances).toHaveLength(1);
    });

    act(() => {
      MockWebSocket.instances[0].emitClose();
    });

    await waitFor(() => {
      expect(useWorkspaceBridgeStore.getState().status).toBe("reconnecting");
      expect(toast.warning).toHaveBeenCalledWith(
        "Workspace MCP companion reconnecting",
        expect.anything(),
      );
    });

    vi.mocked(toast.dismiss).mockClear();

    act(() => {
      useWorkspaceBridgeStore.getState().disconnect();
    });

    await waitFor(() => {
      expect(toast.dismiss).toHaveBeenCalledWith("workspace-bridge-reconnecting");
    });
  });

  it("pushes session_context_changed when dashboard context changes", async () => {
    const { rerender } = render(<WorkspaceBridgeConnectionManager />);

    act(() => {
      useWorkspaceBridgeStore.getState().connect();
    });
    await act(async () => {
      vi.runOnlyPendingTimers();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(MockWebSocket.instances).toHaveLength(1);
    });

    const socket = MockWebSocket.instances[0];

    act(() => {
      socket.emitMessage({
        type: "session_ready",
        session: {
          session_id: "session-123",
          token: "token-123",
          client_name: "workspace-ui",
          current_dashboard_id: "dashboard-123",
          current_tab_id: "tab-news",
        },
      });
    });

    await waitFor(() => {
      expect(useWorkspaceBridgeStore.getState().status).toBe("connected");
    });

    act(() => {
      routeMock.setRoute("dashboard-456", "tab-earnings");
    });
    rerender(<WorkspaceBridgeConnectionManager />);

    await waitFor(() => {
      expect(socket.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: "session_context_changed",
          session: {
            current_dashboard_id: "dashboard-456",
            current_tab_id: "tab-earnings",
          },
        }),
      );
    });
  });

  it("does not push session context to legacy bridges", async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      status: 200,
      data: {
        session: {
          session_id: "session-123",
          token: "token-123",
          client_name: "workspace-ui",
        },
        websocket_url:
          "ws://127.0.0.1:8787/bridge/ws?session_id=session-123&token=token-123",
      },
    } as AxiosResponse);
    const { rerender } = render(<WorkspaceBridgeConnectionManager />);

    act(() => {
      useWorkspaceBridgeStore.getState().connect();
    });
    await act(async () => {
      vi.runOnlyPendingTimers();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(MockWebSocket.instances).toHaveLength(1);
    });

    const socket = MockWebSocket.instances[0];

    act(() => {
      socket.emitMessage({
        type: "session_ready",
        session: {
          session_id: "session-123",
          token: "token-123",
          client_name: "workspace-ui",
        },
      });
    });

    await waitFor(() => {
      expect(useWorkspaceBridgeStore.getState().status).toBe("connected");
    });

    act(() => {
      routeMock.setRoute("dashboard-456", "tab-earnings");
    });
    rerender(<WorkspaceBridgeConnectionManager />);

    expect(socket.send).not.toHaveBeenCalledWith(
      JSON.stringify({
        type: "session_context_changed",
        session: {
          current_dashboard_id: "dashboard-456",
          current_tab_id: "tab-earnings",
        },
      }),
    );
  });

  it("closes a dead socket when heartbeats go unanswered", async () => {
    render(<WorkspaceBridgeConnectionManager />);

    act(() => {
      useWorkspaceBridgeStore.getState().connect();
    });
    await act(async () => {
      vi.runOnlyPendingTimers();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(MockWebSocket.instances).toHaveLength(1);
    });

    const socket = MockWebSocket.instances[0];

    // The replacement socket opens successfully, which must reset the budget.
    act(() => {
      socket.emitOpen();
    });

    act(() => {
      socket.emitMessage({
        type: "session_ready",
        session: {
          session_id: "session-123",
          token: "token-123",
          client_name: "workspace-ui",
          current_dashboard_id: "dashboard-123",
          current_tab_id: "tab-news",
        },
      });
    });

    await waitFor(() => {
      expect(useWorkspaceBridgeStore.getState().status).toBe("connected");
    });

    // First two heartbeats send a ping but stay within the timeout window.
    await act(async () => {
      vi.advanceTimersByTime(15_000);
      await Promise.resolve();
    });
    expect(socket.send).toHaveBeenCalledWith(JSON.stringify({ type: "ping" }));
    await act(async () => {
      vi.advanceTimersByTime(15_000);
      await Promise.resolve();
    });
    expect(socket.close).not.toHaveBeenCalled();

    // Third tick crosses the 32s timeout with no pong: the socket is closed.
    await act(async () => {
      vi.advanceTimersByTime(15_000);
      await Promise.resolve();
    });
    expect(socket.close).toHaveBeenCalled();

    // The forced close drives the normal reconnect path.
    act(() => {
      socket.emitClose();
    });
    await waitFor(() => {
      expect(useWorkspaceBridgeStore.getState().status).toBe("reconnecting");
    });
  });

  it("keeps the connection alive while the bridge answers heartbeats", async () => {
    render(<WorkspaceBridgeConnectionManager />);

    act(() => {
      useWorkspaceBridgeStore.getState().connect();
    });
    await act(async () => {
      vi.runOnlyPendingTimers();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(MockWebSocket.instances).toHaveLength(1);
    });

    const socket = MockWebSocket.instances[0];

    act(() => {
      socket.emitMessage({
        type: "session_ready",
        session: {
          session_id: "session-123",
          token: "token-123",
          client_name: "workspace-ui",
          current_dashboard_id: "dashboard-123",
          current_tab_id: "tab-news",
        },
      });
    });

    await waitFor(() => {
      expect(useWorkspaceBridgeStore.getState().status).toBe("connected");
    });

    // Answer each ping with a pong so the timeout window keeps resetting.
    for (let tick = 0; tick < 3; tick += 1) {
      await act(async () => {
        vi.advanceTimersByTime(15_000);
        await Promise.resolve();
      });
      act(() => {
        socket.emitMessage({ type: "pong" });
      });
    }

    expect(socket.close).not.toHaveBeenCalled();
    expect(useWorkspaceBridgeStore.getState().status).toBe("connected");
  });

  it("closes the socket and clears all timers on unmount", async () => {
    const { unmount } = render(<WorkspaceBridgeConnectionManager />);

    act(() => {
      useWorkspaceBridgeStore.getState().connect();
    });
    await act(async () => {
      vi.runOnlyPendingTimers();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(MockWebSocket.instances).toHaveLength(1);
    });

    const socket = MockWebSocket.instances[0];

    // Opening starts the heartbeat interval.
    act(() => {
      socket.emitOpen();
      socket.emitMessage({
        type: "session_ready",
        session: {
          session_id: "session-123",
          token: "token-123",
          client_name: "workspace-ui",
          current_dashboard_id: "dashboard-123",
          current_tab_id: "tab-news",
        },
      });
    });

    await waitFor(() => {
      expect(useWorkspaceBridgeStore.getState().status).toBe("connected");
    });

    // Drop the connection so the bridge is mid-reconnect when unmounted.
    act(() => {
      socket.emitClose();
    });
    expect(useWorkspaceBridgeStore.getState().status).toBe("reconnecting");

    unmount();

    // Teardown must close the socket even though it is not currently
    // connected, and no reconnect timeout or heartbeat interval may survive.
    // Flushing remaining time first drains the one-shot AbortSignal.timeout
    // timer from session start, which is not cancellable; a leaked heartbeat
    // interval would keep rescheduling itself and still be counted.
    expect(socket.close).toHaveBeenCalled();
    vi.advanceTimersByTime(60_000);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("re-handshakes on remount when the store still reports connected", async () => {
    // Navigating to /admin unmounts the workspace layout (and this manager);
    // the unmount teardown closes the socket without touching store status,
    // so coming back to /app remounts with a stale "connected" status.
    const { unmount } = render(<WorkspaceBridgeConnectionManager />);

    act(() => {
      useWorkspaceBridgeStore.getState().connect();
    });
    await act(async () => {
      vi.runOnlyPendingTimers();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(MockWebSocket.instances).toHaveLength(1);
    });

    act(() => {
      MockWebSocket.instances[0].emitMessage({
        type: "session_ready",
        session: {
          session_id: "session-123",
          token: "token-123",
          client_name: "workspace-ui",
          current_dashboard_id: "dashboard-123",
          current_tab_id: "tab-news",
        },
      });
    });

    await waitFor(() => {
      expect(useWorkspaceBridgeStore.getState().status).toBe("connected");
    });

    unmount();
    expect(MockWebSocket.instances[0].close).toHaveBeenCalled();
    expect(useWorkspaceBridgeStore.getState().status).toBe("connected");

    render(<WorkspaceBridgeConnectionManager />);
    await act(async () => {
      vi.runOnlyPendingTimers();
      await Promise.resolve();
    });

    // The remount must start a fresh session on a brand-new socket.
    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledTimes(2);
      expect(MockWebSocket.instances).toHaveLength(2);
    });

    act(() => {
      MockWebSocket.instances[1].emitMessage({
        type: "session_ready",
        session: {
          session_id: "session-123",
          token: "token-123",
          client_name: "workspace-ui",
          current_dashboard_id: "dashboard-123",
          current_tab_id: "tab-news",
        },
      });
    });

    await waitFor(() => {
      expect(useWorkspaceBridgeStore.getState().status).toBe("connected");
    });
  });

  it("resets the reconnect budget when a reconnected socket opens", async () => {
    render(<WorkspaceBridgeConnectionManager />);

    act(() => {
      useWorkspaceBridgeStore.getState().connect();
    });
    await act(async () => {
      vi.runOnlyPendingTimers();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(MockWebSocket.instances).toHaveLength(1);
    });

    act(() => {
      MockWebSocket.instances[0].emitMessage({
        type: "session_ready",
        session: {
          session_id: "session-123",
          token: "token-123",
          client_name: "workspace-ui",
          current_dashboard_id: "dashboard-123",
          current_tab_id: "tab-news",
        },
      });
    });

    await waitFor(() => {
      expect(useWorkspaceBridgeStore.getState().status).toBe("connected");
    });

    // First drop -> attempt 1 -> backoff of 1 second.
    act(() => {
      MockWebSocket.instances[0].emitClose();
    });
    await waitFor(() => {
      expect(toast.warning).toHaveBeenLastCalledWith(
        "Workspace MCP companion reconnecting",
        expect.objectContaining({
          description: expect.stringContaining("Retrying in 1 second"),
        }),
      );
    });

    await act(async () => {
      vi.advanceTimersByTime(1000);
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(MockWebSocket.instances).toHaveLength(2);
    });

    // The replacement socket opens successfully, which must reset the budget.
    act(() => {
      MockWebSocket.instances[1].emitOpen();
    });

    // A subsequent drop starts the backoff at 1 second again rather than 2.
    act(() => {
      MockWebSocket.instances[1].emitClose();
    });
    await waitFor(() => {
      expect(toast.warning).toHaveBeenLastCalledWith(
        "Workspace MCP companion reconnecting",
        expect.objectContaining({
          description: expect.stringContaining("Retrying in 1 second"),
        }),
      );
    });
  });
});

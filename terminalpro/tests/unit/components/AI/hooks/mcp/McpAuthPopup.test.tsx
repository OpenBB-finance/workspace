import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import McpAuthPopup from "~/components/AI/hooks/mcp/McpAuthPopup";

type McpAuthPopupState = {
  serverName: string;
  serverUrlHash: string;
  url: string;
  authUrl: string;
  popupFeatures: string;
};

const { mockStoreState, mockMcpToolsState } = vi.hoisted(() => ({
  mockStoreState: {
    mcpAuthPopup: null as McpAuthPopupState | null,
    setMcpAuthPopup: vi.fn(),
  },
  mockMcpToolsState: {
    servers: [] as Array<{ id: string; url: string }>,
    disableServerAfterAuthCancel: vi.fn(),
  },
}));

vi.mock("~/lib/state/theme", () => ({
  useShallowThemeStore: (selector: (state: unknown) => unknown) =>
    selector(mockStoreState),
  useThemeStore: { getState: () => mockStoreState },
}));

vi.mock("~/lib/state/mcpTools", () => ({
  useMcpToolsStore: { getState: () => mockMcpToolsState },
}));

vi.mock("~/components/ds/dialogs/BaseDialog", () => ({
  BaseDialog: ({
    open,
    onClose,
    children,
  }: {
    open: boolean;
    onClose?: () => void;
    children: ReactNode;
  }) =>
    open ? (
      <div data-testid="base-dialog">
        <button type="button" data-testid="dialog-close" onClick={onClose} />
        {children}
      </div>
    ) : null,
}));

vi.mock("~/components/ds/dialogs/Dialog", () => ({
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));

const POPUP_VALUE: McpAuthPopupState = {
  serverName: "Test Server",
  serverUrlHash: "hash123",
  url: "https://mcp.example.com",
  authUrl: "https://auth.example.com/authorize",
  popupFeatures: "width=500,height=600",
};

describe("McpAuthPopup", () => {
  beforeEach(() => {
    mockStoreState.mcpAuthPopup = null;
    mockStoreState.setMcpAuthPopup.mockReset();
    mockMcpToolsState.servers = [];
    mockMcpToolsState.disableServerAfterAuthCancel.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("keeps the store value after the auth window opens successfully so it can be watched", () => {
    const focus = vi.fn();
    const openSpy = vi
      .spyOn(window, "open")
      .mockReturnValue({ closed: false, focus } as unknown as Window);
    mockStoreState.mcpAuthPopup = POPUP_VALUE;

    render(<McpAuthPopup />);

    expect(openSpy).toHaveBeenCalledWith(
      POPUP_VALUE.authUrl,
      `mcp_auth_${POPUP_VALUE.serverUrlHash}`,
      POPUP_VALUE.popupFeatures,
    );
    expect(focus).toHaveBeenCalled();
    // No longer cleared immediately — needed to detect a discard.
    expect(mockStoreState.setMcpAuthPopup).not.toHaveBeenCalled();
    expect(screen.queryByTestId("base-dialog")).not.toBeInTheDocument();

    openSpy.mockRestore();
  });

  it("disables the server when the user discards (closes) the popup", () => {
    vi.useFakeTimers();
    const popup = { closed: false, focus: vi.fn() };
    vi.spyOn(window, "open").mockReturnValue(popup as unknown as Window);
    mockMcpToolsState.servers = [{ id: "server-1", url: POPUP_VALUE.url }];
    mockStoreState.mcpAuthPopup = POPUP_VALUE;

    render(<McpAuthPopup />);

    // User closes the popup window.
    popup.closed = true;
    vi.advanceTimersByTime(500); // poll detects the close
    vi.advanceTimersByTime(1000); // grace period elapses

    expect(mockMcpToolsState.disableServerAfterAuthCancel).toHaveBeenCalledWith(
      "server-1",
    );
    expect(mockStoreState.setMcpAuthPopup).toHaveBeenCalledWith(null);
  });

  it("does not disable the server if auth succeeded before the grace period", () => {
    vi.useFakeTimers();
    const popup = { closed: false, focus: vi.fn() };
    vi.spyOn(window, "open").mockReturnValue(popup as unknown as Window);
    mockMcpToolsState.servers = [{ id: "server-1", url: POPUP_VALUE.url }];
    mockStoreState.mcpAuthPopup = POPUP_VALUE;

    render(<McpAuthPopup />);

    popup.closed = true;
    vi.advanceTimersByTime(500); // poll detects the close
    // Auth success clears the store slot before the grace period ends.
    mockStoreState.mcpAuthPopup = null;
    vi.advanceTimersByTime(1000);

    expect(mockMcpToolsState.disableServerAfterAuthCancel).not.toHaveBeenCalled();
  });

  it("opens the fallback dialog and keeps the store value when the popup is blocked", () => {
    vi.spyOn(window, "open").mockReturnValue(null);
    mockStoreState.mcpAuthPopup = POPUP_VALUE;

    render(<McpAuthPopup />);

    expect(mockStoreState.setMcpAuthPopup).not.toHaveBeenCalled();
    expect(screen.getByTestId("base-dialog")).toBeInTheDocument();
    expect(screen.getByText(/Authorization Popup Blocked/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Authorize MCP Connection/ })).toHaveAttribute(
      "href",
      POPUP_VALUE.authUrl,
    );
  });

  it("does nothing when there is no pending auth popup", () => {
    const openSpy = vi.spyOn(window, "open");
    mockStoreState.mcpAuthPopup = null;

    render(<McpAuthPopup />);

    expect(openSpy).not.toHaveBeenCalled();
    expect(mockStoreState.setMcpAuthPopup).not.toHaveBeenCalled();
    expect(screen.queryByTestId("base-dialog")).not.toBeInTheDocument();
  });
});

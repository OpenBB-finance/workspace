import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { McpCompanionModal } from "~/components/LayoutAuth/McpCompanionModal";
import { useWorkspaceBridgeStore } from "~/lib/state/workspaceBridge";

const captureMock = vi.fn();

vi.mock("posthog-js/react", () => ({
  usePostHog: () => ({ capture: captureMock }),
}));

function resetStore() {
  useWorkspaceBridgeStore.setState({
    isEnabled: false,
    status: "disabled",
    lastError: null,
    isModalOpen: false,
  });
}

// Cross-render status transitions need the live store: McpCompanionModal is
// memo()-wrapped, so a mocked-store rerender bails out and never re-runs the
// analytics effect. The real store re-renders via its subscription instead.
describe("McpCompanionModal analytics", () => {
  beforeEach(() => {
    captureMock.mockClear();
    resetStore();
  });

  afterEach(() => {
    act(() => {
      resetStore();
    });
  });

  it("captures an event when the bridge successfully connects", () => {
    render(<McpCompanionModal />);

    act(() => {
      useWorkspaceBridgeStore.getState().connect();
    });
    act(() => {
      useWorkspaceBridgeStore.getState().updateStatus("connected");
    });

    expect(captureMock).toHaveBeenCalledWith(
      "connected_mcp_companion",
      expect.objectContaining({ hosted: true }),
    );
  });

  it("does not capture a connect event for automatic reconnect recovery", () => {
    render(<McpCompanionModal />);

    act(() => {
      useWorkspaceBridgeStore.getState().connect();
      useWorkspaceBridgeStore.getState().updateStatus("reconnecting", "dropped");
    });
    captureMock.mockClear();

    act(() => {
      useWorkspaceBridgeStore.getState().updateStatus("connected");
    });

    expect(captureMock).not.toHaveBeenCalledWith(
      "connected_mcp_companion",
      expect.anything(),
    );
  });
});

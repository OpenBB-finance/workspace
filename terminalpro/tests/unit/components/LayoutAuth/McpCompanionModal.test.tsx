import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { McpCompanionModal } from "~/components/LayoutAuth/McpCompanionModal";

const ENDPOINT = "https://backend.test/mcp";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const { mockStoreState } = vi.hoisted(() => ({
  mockStoreState: {
    status: "disabled" as string,
    lastError: null as string | null,
    isModalOpen: true,
    setModalOpen: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
  },
}));

vi.mock("~/lib/state/workspaceBridge", () => ({
  useShallowWorkspaceBridgeStore: (selector: (state: unknown) => unknown) =>
    selector(mockStoreState),
}));

vi.mock("~/api/workspaceBridge.api", () => ({
  getWorkspaceMcpEndpoint: () => ENDPOINT,
}));

vi.mock("~/components/Icon", () => ({
  default: ({ id }: { id: string }) => <span data-testid={`icon-${id}`} />,
}));

vi.mock("~/components/Tooltip", () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
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
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
}));

vi.mock("~/components/ds/molecules/SettingsMenu", () => ({
  default: ({
    title,
    rightElement,
    children,
  }: {
    title: ReactNode;
    rightElement?: ReactNode;
    children: ReactNode;
  }) => (
    <section>
      <header>{title}</header>
      <div>{rightElement}</div>
      <div>{children}</div>
    </section>
  ),
}));

vi.mock("~/components/ds/atoms/Switch", () => ({
  Switch: ({
    checked,
    onCheckedChange,
  }: {
    checked?: boolean;
    onCheckedChange?: (next: boolean) => void;
  }) => (
    <button
      type="button"
      role="switch"
      data-testid="endpoint-switch"
      aria-checked={checked}
      onClick={() => onCheckedChange?.(!checked)}
    />
  ),
}));

vi.mock("~/components/ds/atoms/Input", () => ({
  Input: (props: { value?: string; readOnly?: boolean; copiable?: boolean }) => (
    <div>
      <input
        data-testid="endpoint-input"
        value={props.value ?? ""}
        readOnly={props.readOnly}
        onChange={() => {}}
      />
      {props.copiable ? <span data-testid="input-copiable" /> : null}
    </div>
  ),
}));

vi.mock("~/components/LayoutAuth/McpActiveTokens", () => ({
  McpActiveTokens: ({
    isConnected,
    endpoint,
  }: {
    isConnected: boolean;
    endpoint: string;
  }) => (
    <div
      data-testid="active-tokens"
      data-connected={String(isConnected)}
      data-endpoint={endpoint}
    />
  ),
}));

describe("McpCompanionModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreState.status = "disabled";
    mockStoreState.lastError = null;
    mockStoreState.isModalOpen = true;
  });

  it("shows the hosted endpoint read-only and copiable, tokens locked", () => {
    render(<McpCompanionModal />);

    expect(screen.getByTestId("endpoint-input")).toHaveValue(ENDPOINT);
    expect(screen.getByTestId("endpoint-input")).toHaveAttribute("readonly");
    expect(screen.getByTestId("input-copiable")).toBeInTheDocument();
    expect(screen.getByText("Not connected")).toBeInTheDocument();
    expect(screen.getByTestId("endpoint-switch")).toHaveAttribute(
      "aria-checked",
      "false",
    );
    expect(screen.getByTestId("active-tokens")).toHaveAttribute(
      "data-connected",
      "false",
    );
    expect(screen.getByTestId("active-tokens")).toHaveAttribute(
      "data-endpoint",
      ENDPOINT,
    );
  });

  it("connects the bridge when toggled on", () => {
    render(<McpCompanionModal />);

    fireEvent.click(screen.getByTestId("endpoint-switch"));

    expect(mockStoreState.connect).toHaveBeenCalledTimes(1);
  });

  it("unlocks tokens and checks the switch once connected", () => {
    mockStoreState.status = "connected";
    render(<McpCompanionModal />);

    expect(screen.getByText("Connected")).toBeInTheDocument();
    expect(screen.getByTestId("endpoint-switch")).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByTestId("active-tokens")).toHaveAttribute(
      "data-connected",
      "true",
    );
  });

  it("disconnects the bridge when toggled off", () => {
    mockStoreState.status = "connected";
    render(<McpCompanionModal />);

    fireEvent.click(screen.getByTestId("endpoint-switch"));

    expect(mockStoreState.disconnect).toHaveBeenCalledTimes(1);
  });

  it("shows the connecting indicator with the switch checked", () => {
    mockStoreState.status = "attempting";
    render(<McpCompanionModal />);

    expect(screen.getByText("Connecting…")).toBeInTheDocument();
    expect(screen.getByTestId("endpoint-switch")).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("shows a dropped notice with the last error", () => {
    mockStoreState.status = "disabled";
    mockStoreState.lastError = "Connection lost";
    render(<McpCompanionModal />);

    expect(screen.getByText("Bridge disconnected")).toBeInTheDocument();
    expect(screen.getByText("Connection lost")).toBeInTheDocument();
  });

  it("surfaces a success toast when the bridge connects", async () => {
    // React.memo skips re-renders when props are unchanged; the store
    // subscription drives the re-render in production. Pass a changing prop
    // (ignored by the component) to force a re-render without remounting (which
    // would reset the previous-status ref the transition check relies on).
    const Modal = McpCompanionModal as unknown as (props: {
      _tick?: number;
    }) => ReactNode;

    mockStoreState.status = "attempting";
    const { rerender } = render(<Modal _tick={0} />);
    expect(toast.success).not.toHaveBeenCalled();

    mockStoreState.status = "connected";
    rerender(<Modal _tick={1} />);

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        "Workspace MCP companion connected",
        expect.objectContaining({ description: expect.any(String) }),
      );
    });
  });

  it("does not toast when an automatic reconnect recovers", async () => {
    const Modal = McpCompanionModal as unknown as (props: {
      _tick?: number;
    }) => ReactNode;

    mockStoreState.status = "reconnecting";
    const { rerender } = render(<Modal _tick={0} />);

    mockStoreState.status = "connected";
    rerender(<Modal _tick={1} />);

    expect(screen.getByText("Connected")).toBeInTheDocument();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("cancels an in-progress attempt when the modal is closed", () => {
    mockStoreState.status = "attempting";
    render(<McpCompanionModal />);

    fireEvent.click(screen.getByTestId("dialog-close"));

    expect(mockStoreState.disconnect).toHaveBeenCalledTimes(1);
    expect(mockStoreState.setModalOpen).toHaveBeenCalledWith(false);
  });

  it("keeps an established connection alive when the modal is closed", () => {
    mockStoreState.status = "connected";
    render(<McpCompanionModal />);

    fireEvent.click(screen.getByTestId("dialog-close"));

    expect(mockStoreState.disconnect).not.toHaveBeenCalled();
    expect(mockStoreState.setModalOpen).toHaveBeenCalledWith(false);
  });
});

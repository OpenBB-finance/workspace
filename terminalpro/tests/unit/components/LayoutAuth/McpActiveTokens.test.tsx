import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { McpActiveTokens } from "~/components/LayoutAuth/McpActiveTokens";

const ENDPOINT = "https://backend.test/mcp";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const { tokensRef, deleteMutate, createDialogProps } = vi.hoisted(() => ({
  tokensRef: {
    current: [] as Array<{
      uuid: string;
      name: string;
      token_type: string;
      token_prefix: string;
      created_date?: string | null;
    }>,
  },
  deleteMutate: vi.fn(
    (_uuid: string, opts?: { onSuccess?: () => void }) => opts?.onSuccess?.(),
  ),
  createDialogProps: { current: null as { open: boolean } | null },
}));

vi.mock("~/components/LayoutAuth/useMcpTokens", () => ({
  useMcpTokens: () => ({ data: tokensRef.current }),
  useDeleteMcpToken: () => ({ mutate: deleteMutate }),
}));

vi.mock("~/components/LayoutAuth/McpCreateTokenDialog", () => ({
  McpCreateTokenDialog: (props: { open: boolean }) => {
    createDialogProps.current = props;
    return props.open ? <div data-testid="create-dialog" /> : null;
  },
}));

vi.mock("~/components/Icon", () => ({
  default: ({ id }: { id: string }) => <span data-testid={`icon-${id}`} />,
}));

vi.mock("~/components/Tooltip", () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
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

describe("McpActiveTokens", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tokensRef.current = [];
    createDialogProps.current = null;
  });

  it("renders the empty state when there are no tokens", () => {
    render(<McpActiveTokens isConnected endpoint={ENDPOINT} />);

    expect(screen.getByText("No tokens created")).toBeInTheDocument();
  });

  it("disables Create Token until the bridge is connected", () => {
    const { rerender } = render(
      <McpActiveTokens isConnected={false} endpoint={ENDPOINT} />,
    );
    expect(screen.getByRole("button", { name: "Create Token" })).toBeDisabled();

    rerender(<McpActiveTokens isConnected endpoint={ENDPOINT} />);
    expect(screen.getByRole("button", { name: "Create Token" })).toBeEnabled();
  });

  it("opens the create dialog when Create Token is clicked", () => {
    render(<McpActiveTokens isConnected endpoint={ENDPOINT} />);

    expect(screen.queryByTestId("create-dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Create Token" }));

    expect(screen.getByTestId("create-dialog")).toBeInTheDocument();
    expect(createDialogProps.current?.open).toBe(true);
  });

  it("lists tokens with name, masked prefix and formatted date", () => {
    tokensRef.current = [
      {
        uuid: "t1",
        name: "Equity Research",
        token_type: "workspace_mcp",
        token_prefix: "obb_mcp_a1b2c3",
        created_date: "2026-05-01T10:00:00.000Z",
      },
    ];
    render(<McpActiveTokens isConnected endpoint={ENDPOINT} />);

    expect(screen.getByText("Equity Research")).toBeInTheDocument();
    expect(screen.getByText("obb_mcp_a1b2c3...")).toBeInTheDocument();
    expect(screen.getByText("01/05/2026")).toBeInTheDocument();
  });

  it("revokes a token and surfaces a confirmation toast", () => {
    tokensRef.current = [
      {
        uuid: "t1",
        name: "Equity Research",
        token_type: "workspace_mcp",
        token_prefix: "obb_mcp_a1b2c3",
      },
    ];
    render(<McpActiveTokens isConnected endpoint={ENDPOINT} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Delete Equity Research token" }),
    );

    expect(deleteMutate).toHaveBeenCalledWith("t1", expect.any(Object));
    expect(toast.success).toHaveBeenCalledWith(
      "Token revoked",
      expect.objectContaining({
        description: expect.stringContaining("Equity Research"),
      }),
    );
  });
});

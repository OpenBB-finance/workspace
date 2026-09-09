import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { McpCreateTokenDialog } from "~/components/LayoutAuth/McpCreateTokenDialog";

const ENDPOINT = "https://backend.test/mcp";

interface MutationStub {
  mutate: ReturnType<typeof vi.fn>;
  reset: ReturnType<typeof vi.fn>;
  data: { token: string; name: string } | null;
  isPending: boolean;
  isError: boolean;
  error: Error | null;
}

const { mutationRef } = vi.hoisted(() => ({
  mutationRef: {
    current: {
      mutate: vi.fn(),
      reset: vi.fn(),
      data: null,
      isPending: false,
      isError: false,
      error: null,
    } as MutationStub,
  },
}));

vi.mock("~/components/LayoutAuth/useMcpTokens", () => ({
  useCreateMcpToken: () => mutationRef.current,
}));

vi.mock("~/components/LayoutAuth/McpConnectSnippets", () => ({
  McpConnectSnippets: ({ endpoint, token }: { endpoint: string; token: string }) => (
    <div data-testid="connect-snippets" data-endpoint={endpoint} data-token={token} />
  ),
}));

vi.mock("~/components/Icon", () => ({
  default: ({ id }: { id: string }) => <span data-testid={`icon-${id}`} />,
}));

vi.mock("~/components/ds/dialogs/BaseDialog", () => ({
  BaseDialog: ({ open, children }: { open: boolean; children: ReactNode }) =>
    open ? <div data-testid="base-dialog">{children}</div> : null,
}));

vi.mock("~/components/ds/dialogs/Dialog", () => ({
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

describe("McpCreateTokenDialog", () => {
  beforeEach(() => {
    mutationRef.current = {
      mutate: vi.fn(),
      reset: vi.fn(),
      data: null,
      isPending: false,
      isError: false,
      error: null,
    };
  });

  it("keeps Generate disabled until a name is entered, then mutates", () => {
    render(<McpCreateTokenDialog open onClose={vi.fn()} endpoint={ENDPOINT} />);

    expect(screen.getByRole("button", { name: "Generate Token" })).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText("Insert name"), {
      target: { value: "Equity Research" },
    });
    const generate = screen.getByRole("button", { name: "Generate Token" });
    expect(generate).toBeEnabled();

    fireEvent.click(generate);
    expect(mutationRef.current.mutate).toHaveBeenCalledWith("Equity Research");
  });

  it("shows the empty placeholder before a token is generated", () => {
    render(<McpCreateTokenDialog open onClose={vi.fn()} endpoint={ENDPOINT} />);

    expect(
      screen.getByText("Generate a token to connect your Workspace"),
    ).toBeInTheDocument();
  });

  it("reveals the secret, the connect snippets and the warning once generated", () => {
    mutationRef.current.data = {
      token: "obb_mcp_created123_secret",
      name: "Equity Research",
    };
    render(<McpCreateTokenDialog open onClose={vi.fn()} endpoint={ENDPOINT} />);

    expect(screen.getByDisplayValue("obb_mcp_created123_secret")).toBeInTheDocument();
    const snippets = screen.getByTestId("connect-snippets");
    expect(snippets).toHaveAttribute("data-token", "obb_mcp_created123_secret");
    expect(snippets).toHaveAttribute("data-endpoint", ENDPOINT);
    expect(
      screen.getByText(
        "Save the API key. This API key won't be accessible afterwards.",
      ),
    ).toBeInTheDocument();
  });

  it("calls onClose from Cancel and Done", () => {
    const onClose = vi.fn();
    render(<McpCreateTokenDialog open onClose={onClose} endpoint={ENDPOINT} />);

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Done" }));

    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("wipes the mutation state when the dialog closes, not just on reopen", () => {
    mutationRef.current.data = {
      token: "obb_mcp_created123_secret",
      name: "Equity Research",
    };
    const { rerender } = render(
      <McpCreateTokenDialog open onClose={vi.fn()} endpoint={ENDPOINT} />,
    );
    expect(mutationRef.current.reset).toHaveBeenCalledTimes(1);

    rerender(
      <McpCreateTokenDialog open={false} onClose={vi.fn()} endpoint={ENDPOINT} />,
    );

    // Closing must also reset, so the raw token does not linger in the
    // mutation cache while the dialog is hidden.
    expect(mutationRef.current.reset).toHaveBeenCalledTimes(2);
  });

  it("shows a spinner instead of the placeholder while the token is generating", () => {
    mutationRef.current.isPending = true;
    render(<McpCreateTokenDialog open onClose={vi.fn()} endpoint={ENDPOINT} />);

    expect(screen.getAllByTestId("icon-mdi-loading").length).toBeGreaterThan(0);
    expect(
      screen.queryByText("Generate a token to connect your Workspace"),
    ).not.toBeInTheDocument();
  });

  it("surfaces the creation error message", () => {
    mutationRef.current.isError = true;
    mutationRef.current.error = new Error("Token limit reached");
    render(<McpCreateTokenDialog open onClose={vi.fn()} endpoint={ENDPOINT} />);

    expect(screen.getByText("Token limit reached")).toBeInTheDocument();
  });

  it("falls back to a generic creation error message", () => {
    mutationRef.current.isError = true;
    mutationRef.current.error = null;
    render(<McpCreateTokenDialog open onClose={vi.fn()} endpoint={ENDPOINT} />);

    expect(screen.getByText("Failed to create token.")).toBeInTheDocument();
  });
});

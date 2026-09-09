import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AgentEditDialog } from "~/components/AI/AgentEditDialog";

const { mockFetchAgentsData } = vi.hoisted(() => ({
  mockFetchAgentsData: vi.fn(),
}));

vi.mock("~/api/auth.api", () => ({
  fetchAgentsData: (...args: unknown[]) => mockFetchAgentsData(...args),
}));

vi.mock("~/components/Icon", () => ({
  default: ({ id, className }: { id: string; className?: string }) => (
    <span data-testid={`icon-${id}`} className={className} />
  ),
}));

vi.mock("~/components/ds/atoms/Button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    loading,
    variant,
    size,
  }: {
    children: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    loading?: boolean;
    variant?: string;
    size?: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      data-variant={variant}
      data-size={size}
    >
      {loading ? "Loading..." : children}
    </button>
  ),
}));

vi.mock("~/components/ds/atoms/Input", () => ({
  Input: (props: {
    placeholder?: string;
    onChange?: (value: string) => void;
    defaultValue?: string;
    value?: string;
    size?: string;
  }) => (
    <input
      type="text"
      placeholder={props.placeholder}
      defaultValue={props.defaultValue}
      value={props.value}
      onChange={(e) => props.onChange?.(e.target.value)}
    />
  ),
}));

vi.mock("~/components/ds/dialogs/BaseDialog", () => ({
  BaseDialog: ({
    open,
    onClose,
    children,
  }: {
    open: boolean;
    onClose: () => void;
    children: ReactNode;
    className?: string;
  }) =>
    open ? (
      <div data-testid="base-dialog">
        {children}
        <button type="button" onClick={onClose} data-testid="base-dialog-close">
          Close
        </button>
      </div>
    ) : null,
}));

vi.mock("~/components/ds/dialogs/Dialog", () => ({
  DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  DialogFooter: ({
    children,
  }: {
    children: ReactNode;
    className?: string;
  }) => <div data-testid="dialog-footer">{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));

vi.mock("~/lib/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

const defaultEditGroup = {
  uuid: "test-uuid",
  url: "https://example.com/agents.json",
  headerPairs: [] as { key: string; value: string }[],
};

describe("AgentEditDialog", () => {
  const mockOnClose = vi.fn();
  const mockOnSave = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with pre-filled URL", () => {
    render(
      <AgentEditDialog
        editGroup={defaultEditGroup}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />,
    );

    const urlInput = screen.getByPlaceholderText("https://example.com/agents.json");
    expect(urlInput).toHaveValue("https://example.com/agents.json");
  });

  it("renders with header pairs", () => {
    const editGroup = {
      ...defaultEditGroup,
      headerPairs: [
        { key: "Authorization", value: "Bearer abc123" },
        { key: "X-Custom", value: "custom-value" },
      ],
    };

    render(
      <AgentEditDialog
        editGroup={editGroup}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />,
    );

    expect(screen.getByDisplayValue("Authorization")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Bearer abc123")).toBeInTheDocument();
    expect(screen.getByDisplayValue("X-Custom")).toBeInTheDocument();
    expect(screen.getByDisplayValue("custom-value")).toBeInTheDocument();
  });

  it("shows success message when test passes", async () => {
    const user = userEvent.setup();
    mockFetchAgentsData.mockResolvedValue([{ name: "agent1" }, { name: "agent2" }]);

    render(
      <AgentEditDialog
        editGroup={defaultEditGroup}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />,
    );

    const testButton = screen.getByRole("button", { name: "Test" });
    await user.click(testButton);

    await waitFor(() => {
      expect(screen.getByText("Test successful")).toBeInTheDocument();
      expect(screen.getByText("2 agents found")).toBeInTheDocument();
    });

    expect(mockFetchAgentsData).toHaveBeenCalledWith({
      url: "https://example.com/agents.json",
      headers: {},
    });
  });

  it("shows error message when test fails", async () => {
    const user = userEvent.setup();
    mockFetchAgentsData.mockRejectedValue(new Error("Connection refused"));

    render(
      <AgentEditDialog
        editGroup={defaultEditGroup}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />,
    );

    const testButton = screen.getByRole("button", { name: "Test" });
    await user.click(testButton);

    await waitFor(() => {
      expect(screen.getByText("Error")).toBeInTheDocument();
      expect(screen.getByText("Connection refused")).toBeInTheDocument();
    });
  });

  it("keeps Update button disabled until test passes", async () => {
    const user = userEvent.setup();
    mockFetchAgentsData.mockResolvedValue([{ name: "agent1" }]);

    render(
      <AgentEditDialog
        editGroup={defaultEditGroup}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />,
    );

    const updateButton = screen.getByRole("button", { name: "Update" });
    expect(updateButton).toBeDisabled();

    const testButton = screen.getByRole("button", { name: "Test" });
    await user.click(testButton);

    await waitFor(() => {
      expect(screen.getByText(/Test successful/)).toBeInTheDocument();
    });

    expect(updateButton).toBeEnabled();
  });

  it("calls onSave with editGroup data when Update is clicked", async () => {
    const user = userEvent.setup();
    mockFetchAgentsData.mockResolvedValue([{ name: "agent1" }]);

    render(
      <AgentEditDialog
        editGroup={defaultEditGroup}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />,
    );

    const testButton = screen.getByRole("button", { name: "Test" });
    await user.click(testButton);

    await waitFor(() => {
      expect(screen.getByText(/Test successful/)).toBeInTheDocument();
    });

    const updateButton = screen.getByRole("button", { name: "Update" });
    await user.click(updateButton);

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith(defaultEditGroup);
    });
  });

  it("calls onClose when close button is clicked", async () => {
    const user = userEvent.setup();

    render(
      <AgentEditDialog
        editGroup={defaultEditGroup}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />,
    );

    const closeButton = screen.getByTestId("base-dialog-close");
    await user.click(closeButton);

    expect(mockOnClose).toHaveBeenCalledOnce();
  });

  it("adds empty header pair when Add Authentication is clicked", async () => {
    const user = userEvent.setup();

    render(
      <AgentEditDialog
        editGroup={defaultEditGroup}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />,
    );

    expect(screen.queryByPlaceholderText("Authorization")).not.toBeInTheDocument();

    const addButton = screen.getByRole("button", { name: /Add Authentication/ });
    await user.click(addButton);

    expect(screen.getByPlaceholderText("Authorization")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Bearer token...")).toBeInTheDocument();
  });

  it("clears test result when URL changes", async () => {
    const user = userEvent.setup();
    mockFetchAgentsData.mockResolvedValue([{ name: "agent1" }]);

    render(
      <AgentEditDialog
        editGroup={defaultEditGroup}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />,
    );

    const testButton = screen.getByRole("button", { name: "Test" });
    await user.click(testButton);

    await waitFor(() => {
      expect(screen.getByText(/Test successful/)).toBeInTheDocument();
    });

    const urlInput = screen.getByPlaceholderText("https://example.com/agents.json");
    await user.clear(urlInput);
    await user.type(urlInput, "https://other.com/agents.json");

    expect(screen.queryByText(/Test successful/)).not.toBeInTheDocument();
  });
});

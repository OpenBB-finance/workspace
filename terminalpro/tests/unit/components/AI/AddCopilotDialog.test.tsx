import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AddCopilotDialog } from "~/components/AI/AddCopilotDialog";

const {
  mockFetchAgentsData,
  mockHasCopilotConflict,
  mockPutCustomCopilot,
  mockSetExternalCopilotHolders,
  mockSetSelectedCopilot,
  mockSetShowAddAgentsDialog,
  mockToast,
} = vi.hoisted(() => ({
  mockFetchAgentsData: vi.fn(),
  mockHasCopilotConflict: vi.fn(),
  mockPutCustomCopilot: vi.fn(),
  mockSetExternalCopilotHolders: vi.fn(),
  mockSetSelectedCopilot: vi.fn(),
  mockSetShowAddAgentsDialog: vi.fn(),
  mockToast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

let mockExternalCopilotHolders: Array<{ url: string; copilots?: unknown[] }> = [];

vi.mock("~/api/auth.api", () => ({
  fetchAgentsData: (...args: unknown[]) => mockFetchAgentsData(...args),
  hasCopilotConflict: (...args: unknown[]) => mockHasCopilotConflict(...args),
  putCustomCopilot: (...args: unknown[]) => mockPutCustomCopilot(...args),
}));

vi.mock("posthog-js", () => ({ default: { capture: vi.fn() } }));
vi.mock("sonner", () => ({ toast: mockToast }));

vi.mock("~/lib/api", () => ({
  convertHeadersToRecord: (headers: Record<string, string>) => ({ headers }),
}));

vi.mock("~/lib/utils", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    createURLString: (url: string) => url,
    uuidv4: () => "test-uuid",
  };
});

vi.mock("~/lib/state/copilot", () => ({
  useShallowCopilotStore: (selector: (state: unknown) => unknown) =>
    selector({
      externalCopilotHolders: mockExternalCopilotHolders,
      setExternalCopilotHolders: mockSetExternalCopilotHolders,
      setSelectedCopilot: mockSetSelectedCopilot,
    }),
}));

vi.mock("~/lib/state/theme", () => ({
  useShallowThemeStore: (selector: (state: unknown) => unknown) =>
    selector({
      showAddAgentsDialog: true,
      setShowAddAgentsDialog: mockSetShowAddAgentsDialog,
    }),
}));

vi.mock("~/components/Icon", () => ({
  default: ({ id, className }: { id: string; className?: string }) => (
    <span data-testid={`icon-${id}`} className={className} />
  ),
}));

vi.mock("~/components/DataConnectors/SingleWidget", () => ({
  EndpointHeadersForm: () => null,
}));

vi.mock("~/components/ds/dialogs/BaseDialog", () => ({
  BaseDialog: ({ open, children }: { open: boolean; children: ReactNode }) =>
    open ? <div data-testid="base-dialog">{children}</div> : null,
}));

vi.mock("~/components/ds/dialogs/Dialog", () => ({
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
}));

async function typeUrl(user: ReturnType<typeof userEvent.setup>, url: string) {
  const input = screen.getByPlaceholderText("https://example.com");
  await user.clear(input);
  await user.type(input, url);
}

describe("AddCopilotDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExternalCopilotHolders = [];
    mockHasCopilotConflict.mockReturnValue(false);
    mockPutCustomCopilot.mockResolvedValue(undefined);
  });

  it("keeps Add disabled until a successful test", async () => {
    const user = userEvent.setup();
    mockFetchAgentsData.mockResolvedValue([{ id: "a", name: "Agent A" }]);
    render(<AddCopilotDialog />);

    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();

    await typeUrl(user, "https://my-agent.com");
    await user.click(screen.getByRole("button", { name: "Test" }));

    await waitFor(() => {
      expect(screen.getByText("Test successful")).toBeInTheDocument();
      expect(screen.getByText("1 agent found")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Add" })).toBeEnabled();
    expect(mockFetchAgentsData).toHaveBeenCalledTimes(1);
  });

  it("shows an error result and keeps Add disabled when the test fails", async () => {
    const user = userEvent.setup();
    mockFetchAgentsData.mockRejectedValue(
      new Error("A valid /agents.json was not found"),
    );
    render(<AddCopilotDialog />);

    await typeUrl(user, "https://broken-agent.com");
    await user.click(screen.getByRole("button", { name: "Test" }));

    await waitFor(() => {
      expect(screen.getByText("Error")).toBeInTheDocument();
      expect(
        screen.getByText("A valid /agents.json was not found"),
      ).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
    expect(mockPutCustomCopilot).not.toHaveBeenCalled();
  });

  it("persists the agent and closes after a successful test + Add", async () => {
    const user = userEvent.setup();
    mockFetchAgentsData.mockResolvedValue([{ id: "a", name: "Agent A", features: {} }]);
    render(<AddCopilotDialog />);

    await typeUrl(user, "https://my-agent.com");
    await user.click(screen.getByRole("button", { name: "Test" }));
    await waitFor(() =>
      expect(screen.getByText("Test successful")).toBeInTheDocument(),
    );

    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => {
      expect(mockPutCustomCopilot).toHaveBeenCalledTimes(1);
      expect(mockSetExternalCopilotHolders).toHaveBeenCalled();
      expect(mockSetShowAddAgentsDialog).toHaveBeenCalledWith(false);
    });
    // Add reuses the tested holder — no second fetch.
    expect(mockFetchAgentsData).toHaveBeenCalledTimes(1);
    expect(mockToast.success).toHaveBeenCalledWith(
      "AI Agent successfully added",
      expect.any(Object),
    );
  });

  it("blocks the test for a duplicate URL", async () => {
    const user = userEvent.setup();
    mockExternalCopilotHolders = [{ url: "https://my-agent.com", copilots: [] }];
    render(<AddCopilotDialog />);

    await typeUrl(user, "https://my-agent.com");
    await user.click(screen.getByRole("button", { name: "Test" }));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith(
        "Agent URL already added.",
        expect.any(Object),
      );
    });
    expect(mockFetchAgentsData).not.toHaveBeenCalled();
  });
});

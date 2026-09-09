import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AddPromptDialog from "~/components/LayoutAuth/PromptLibrary/AddPromptDialog";
import type { Prompt } from "~/lib/state/promptLibrary";
import { usePromptLibraryStore } from "~/lib/state/promptLibrary";

const { mockGetUserPrompts, mockPostUserPrompts, mockToastSuccess, mockToastError } =
  vi.hoisted(() => ({
    mockGetUserPrompts: vi.fn().mockResolvedValue([]),
    mockPostUserPrompts: vi.fn().mockResolvedValue(undefined),
    mockToastSuccess: vi.fn(),
    mockToastError: vi.fn(),
  }));

vi.mock("sonner", () => ({
  toast: { success: mockToastSuccess, error: mockToastError },
}));

vi.mock("~/api/auth.api", () => ({
  getUserPrompts: mockGetUserPrompts,
  postUserPrompts: mockPostUserPrompts,
}));

vi.mock("~/lib/contexts/CopilotChatContext", () => ({
  CopilotProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("~/components/AI/TextArea", () => ({
  default: ({
    prompt,
    setPrompt,
    placeholder,
  }: {
    prompt: string;
    setPrompt: (value: string) => void;
    placeholder?: string;
  }) => (
    <textarea
      data-testid="prompt-textarea"
      value={prompt}
      placeholder={placeholder}
      onChange={(e) => setPrompt(e.target.value)}
    />
  ),
}));

vi.mock("~/components/ds/dialogs/BaseDialog", () => ({
  BaseDialog: ({
    open,
    children,
  }: {
    open: boolean;
    onClose: () => void;
    children: ReactNode;
    className?: string;
  }) => (open ? <div data-testid="base-dialog">{children}</div> : null),
}));

vi.mock("~/components/ds/dialogs/Dialog", () => ({
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  DialogFooter: ({ children }: { children: ReactNode; className?: string }) => (
    <div data-testid="dialog-footer">{children}</div>
  ),
}));

vi.mock("~/components/ds/atoms/Button", () => ({
  Button: ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
}));

const promptA: Prompt = {
  id: "prompt-1",
  prompt: "Old prompt text",
  widgets: [],
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

describe("AddPromptDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePromptLibraryStore.setState({
      prompts: [promptA],
      addPromptDialogOpen: false,
      editingPromptId: null,
    });
  });

  it("shows the prompt text when opened in edit mode", async () => {
    render(<AddPromptDialog />);

    act(() => {
      usePromptLibraryStore.getState().setEditingPromptId(promptA.id);
      usePromptLibraryStore.getState().setAddPromptDialogOpen(true);
    });

    expect(await screen.findByTestId("prompt-textarea")).toHaveValue("Old prompt text");
    expect(screen.getByText("Edit prompt")).toBeInTheDocument();
  });

  it("clears the form when reopened via Add Prompt after editing", async () => {
    render(<AddPromptDialog />);

    // Open in edit mode
    act(() => {
      usePromptLibraryStore.getState().setEditingPromptId(promptA.id);
      usePromptLibraryStore.getState().setAddPromptDialogOpen(true);
    });
    expect(await screen.findByTestId("prompt-textarea")).toHaveValue("Old prompt text");

    // Close the dialog
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByTestId("base-dialog")).not.toBeInTheDocument();

    // Reopen via "Add Prompt" (no prompt being edited)
    act(() => {
      usePromptLibraryStore.getState().setAddPromptDialogOpen(true);
    });

    expect(await screen.findByText("Add new prompt")).toBeInTheDocument();
    expect(screen.getByTestId("prompt-textarea")).toHaveValue("");
  });
});

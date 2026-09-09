import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AddSkillDialog from "~/components/AI/AddSkillDialog";
import { useSkillsLibraryStore } from "~/lib/state/skillsLibrary";
import type { Skill } from "~/types/auth.type";

const { mockCreateUserSkill, mockUpdateUserSkill, mockToastSuccess, mockToastError } =
  vi.hoisted(() => ({
    mockCreateUserSkill: vi.fn(),
    mockUpdateUserSkill: vi.fn(),
    mockToastSuccess: vi.fn(),
    mockToastError: vi.fn(),
  }));

vi.mock("sonner", () => ({
  toast: { success: mockToastSuccess, error: mockToastError },
}));

vi.mock("~/api/auth.api", () => ({
  createUserSkill: mockCreateUserSkill,
  updateUserSkill: mockUpdateUserSkill,
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
  Button: ({
    children,
    onClick,
    disabled,
    loading,
  }: {
    children: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    loading?: boolean;
  }) => (
    <button type="button" onClick={onClick} disabled={disabled || loading}>
      {children}
    </button>
  ),
}));

const skillA: Skill = {
  id: "skill-1",
  slug: "my-skill",
  description: "Skill A description",
  content: "Skill A content",
  createdDate: "2026-01-01T00:00:00Z",
  updatedDate: "2026-01-01T00:00:00Z",
};

describe("AddSkillDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSkillsLibraryStore.setState({
      skills: [skillA],
      skillDialogOpen: false,
      skillDialogPrefill: null,
    });
  });

  it("shows the skill values when opened in edit mode", async () => {
    render(<AddSkillDialog />);

    act(() => {
      useSkillsLibraryStore.getState().setSkillDialogOpen(skillA.id);
    });

    expect(await screen.findByDisplayValue("my-skill")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Skill A description")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Skill A content")).toBeInTheDocument();
    expect(screen.getByText("Edit skill")).toBeInTheDocument();
  });

  it("clears the form when reopened via Add Skill after editing", async () => {
    render(<AddSkillDialog />);

    // Open in edit mode
    act(() => {
      useSkillsLibraryStore.getState().setSkillDialogOpen(skillA.id);
    });
    expect(await screen.findByDisplayValue("my-skill")).toBeInTheDocument();

    // Close the dialog
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByTestId("base-dialog")).not.toBeInTheDocument();

    // Reopen via "Add Skill" (no skill being edited)
    act(() => {
      useSkillsLibraryStore.getState().setSkillDialogOpen(true);
    });

    expect(await screen.findByText("Add new skill")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("my-skill")).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue("Skill A description")).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue("Skill A content")).not.toBeInTheDocument();
  });

  it("prefills the form when opened in create mode with a prefill", async () => {
    render(<AddSkillDialog />);

    act(() => {
      useSkillsLibraryStore.getState().openSkillDialogWithPrefill({
        slug: "prefilled-slug",
        description: "Prefilled description",
        content: "Prefilled content",
      });
    });

    expect(await screen.findByText("Add new skill")).toBeInTheDocument();
    expect(screen.getByDisplayValue("prefilled-slug")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Prefilled description")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Prefilled content")).toBeInTheDocument();
  });

  it("clears the prefill when the dialog is closed", async () => {
    render(<AddSkillDialog />);

    act(() => {
      useSkillsLibraryStore.getState().openSkillDialogWithPrefill({
        slug: "prefilled-slug",
        content: "Prefilled content",
      });
    });
    expect(await screen.findByDisplayValue("prefilled-slug")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByTestId("base-dialog")).not.toBeInTheDocument();
    expect(useSkillsLibraryStore.getState().skillDialogPrefill).toBeNull();
    expect(useSkillsLibraryStore.getState().skillDialogOpen).toBe(false);

    // Reopening via "Add Skill" shows an empty form
    act(() => {
      useSkillsLibraryStore.getState().setSkillDialogOpen(true);
    });

    expect(await screen.findByText("Add new skill")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("prefilled-slug")).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue("Prefilled content")).not.toBeInTheDocument();
  });
});

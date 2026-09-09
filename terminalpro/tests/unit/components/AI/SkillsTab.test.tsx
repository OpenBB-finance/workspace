import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SkillsTab } from "~/components/AI/SkillsTab";

// --- vi.hoisted mocks ---

const {
  mockSetSkillDialogOpen,
  mockUpdateSkills,
  mockUseShallowSkillsLibraryStore,
  mockToastSuccess,
  mockToastError,
  mockDeleteUserSkills,
} = vi.hoisted(() => ({
  mockSetSkillDialogOpen: vi.fn(),
  mockUpdateSkills: vi.fn(),
  mockUseShallowSkillsLibraryStore: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
  mockDeleteUserSkills: vi.fn(),
}));

// --- External dependency mocks ---

vi.mock("sonner", () => ({
  toast: { success: mockToastSuccess, error: mockToastError },
}));

vi.mock("~/api/auth.api", () => ({
  deleteUserSkills: mockDeleteUserSkills,
}));

vi.mock("~/lib/state/skillsLibrary", () => ({
  useShallowSkillsLibraryStore: mockUseShallowSkillsLibraryStore,
}));

vi.mock("usehooks-ts", () => ({
  useDebounceValue: (value: unknown) => [value],
}));

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
  motion: {
    div: ({
      children,
      className,
      onClick,
    }: {
      children?: ReactNode;
      className?: string;
      onClick?: () => void;
    }) => (
      <div className={className} onClick={onClick}>
        {children}
      </div>
    ),
  },
}));

// --- Component mocks ---

vi.mock("~/components/General/SearchResultsNotFound", () => ({
  default: () => <div data-testid="results-not-found">No results found</div>,
}));

vi.mock("~/components/ds/atoms/Button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    variant,
    size,
    className,
  }: {
    children: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    variant?: string;
    size?: string;
    className?: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-variant={variant}
      data-size={size}
      className={className}
    >
      {children}
    </button>
  ),
}));

vi.mock("~/components/ds/atoms/Input", () => ({
  Input: (props: {
    placeholder?: string;
    onChange?: (value: string) => void;
    defaultValue?: string;
    className?: string;
    prefix?: ReactNode;
    clearable?: boolean;
    ref?: unknown;
  }) => (
    <div className={props.className}>
      {props.prefix}
      <input
        type="text"
        placeholder={props.placeholder}
        defaultValue={props.defaultValue}
        onChange={(e) => props.onChange?.(e.target.value)}
      />
    </div>
  ),
}));

vi.mock("~/components/ds/atoms/Tag", () => ({
  Tag: ({ children, color }: { children: ReactNode; color?: string }) => (
    <span className="BB-Tag" data-color={color}>
      {children}
    </span>
  ),
}));

vi.mock("~/components/ds/atoms/Checkbox", () => ({
  Checkbox: ({
    checked,
    onCheckedChange,
    disabled,
  }: {
    checked: boolean | "indeterminate";
    onCheckedChange?: (checked: boolean) => void;
    disabled?: boolean;
  }) => (
    <input
      type="checkbox"
      checked={checked === true}
      disabled={disabled}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
      data-indeterminate={checked === "indeterminate" ? "true" : undefined}
    />
  ),
}));

vi.mock("~/components/ds/dialogs/ConfirmDialog", () => ({
  ConfirmDialog: ({
    open,
    onClose,
    title,
    description,
    confirmButton,
    cancelText,
  }: {
    open: boolean;
    onClose: () => void;
    title: string;
    description: ReactNode;
    confirmButton: ReactNode;
    cancelText?: string;
  }) =>
    open ? (
      <div data-testid="confirm-dialog">
        <h2>{title}</h2>
        <div data-testid="confirm-dialog-description">{description}</div>
        {confirmButton}
        <button type="button" onClick={onClose}>
          {cancelText ?? "Cancel"}
        </button>
      </div>
    ) : null,
}));

vi.mock("~/components/Tooltip", () => ({
  default: ({ children, message }: { children: ReactNode; message: string }) => (
    <div title={message}>{children}</div>
  ),
}));

vi.mock("~/components/Icon", () => ({
  default: ({ id, className, ...rest }: { id: string; className?: string }) => (
    <svg data-testid={`icon-${id}`} className={className} {...rest}>
      <use href={`#${id}`} />
    </svg>
  ),
}));

vi.mock("markdown-to-jsx", () => ({
  default: ({ children }: { children: string }) => (
    <div data-testid="markdown-content">{children}</div>
  ),
}));

// --- Test data ---

const createMockSkill = (
  overrides: Partial<{
    id: string;
    slug: string;
    description: string;
    content: string;
    createdAt: string;
    updatedAt: string;
  }> = {},
) => ({
  id: overrides.id ?? "skill-1",
  slug: overrides.slug ?? "test-skill",
  description: overrides.description ?? "A test skill description",
  content: overrides.content ?? "# Test Skill\n\nThis is test content.",
  createdAt: overrides.createdAt ?? "2024-01-15T10:00:00Z",
  updatedAt: overrides.updatedAt ?? "2024-01-15T10:00:00Z",
});

const mockSkills = [
  createMockSkill({
    id: "skill-1",
    slug: "financial-analysis",
    description: "Analyze financial data",
    content: "# Financial Analysis\n\nPerform deep analysis.",
  }),
  createMockSkill({
    id: "skill-2",
    slug: "data-viz",
    description: "Create data visualizations",
    content: "# Data Viz\n\nVisualize your data.",
  }),
  createMockSkill({
    id: "skill-3",
    slug: "report-gen",
    description: "Generate reports",
    content: "# Report Gen\n\nGenerate detailed reports.",
  }),
];

// --- Test setup ---

function setupMocks(skillsOverride: typeof mockSkills = mockSkills) {
  mockDeleteUserSkills.mockResolvedValue(skillsOverride);
  mockUseShallowSkillsLibraryStore.mockImplementation(
    (selector: (state: unknown) => unknown) =>
      selector({
        setSkillDialogOpen: mockSetSkillDialogOpen,
        skills: skillsOverride,
        updateSkills: mockUpdateSkills,
      }),
  );
}

function renderSkillsTab() {
  return render(<SkillsTab />);
}

function getSkillHeader(slug: string) {
  return screen.getByRole("button", { name: new RegExp(slug, "i") });
}

// --- Tests ---

describe("SkillsTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
  });

  describe("Rendering", () => {
    it("renders the skills list", () => {
      renderSkillsTab();
      expect(screen.getByText("financial-analysis")).toBeInTheDocument();
      expect(screen.getByText("data-viz")).toBeInTheDocument();
      expect(screen.getByText("report-gen")).toBeInTheDocument();
    });

    it("renders skill descriptions", () => {
      renderSkillsTab();
      expect(screen.getByText("Analyze financial data")).toBeInTheDocument();
      expect(screen.getByText("Create data visualizations")).toBeInTheDocument();
      expect(screen.getByText("Generate reports")).toBeInTheDocument();
    });
  });

  describe("Empty state", () => {
    it("shows empty state when no skills exist", () => {
      setupMocks([]);
      renderSkillsTab();
      expect(screen.getByText("No Skills added")).toBeInTheDocument();
      expect(
        screen.getByText(
          /Skills are reusable instructions that help the AI handle specific tasks\./,
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          /in chat to activate them or let the agent pick them up on its own\./,
        ),
      ).toBeInTheDocument();
    });
  });

  describe("Add skill", () => {
    it("renders Add Skill button", () => {
      renderSkillsTab();
      expect(screen.getByText("Add Skill")).toBeInTheDocument();
    });

    it("opens add skill dialog when clicking Add Skill button", async () => {
      const user = userEvent.setup();
      renderSkillsTab();

      await user.click(screen.getByText("Add Skill"));
      expect(mockSetSkillDialogOpen).toHaveBeenCalledWith(true);
    });
  });

  describe("Skill card content", () => {
    it("renders skill slugs as plain text (not tags)", () => {
      renderSkillsTab();
      const slug = screen.getByText("financial-analysis");
      expect(slug.classList.contains("BB-Tag")).toBe(false);
    });

    it("does not render skill creation dates", () => {
      renderSkillsTab();
      expect(screen.queryByText(/Created on:/)).not.toBeInTheDocument();
    });
  });

  describe("Expand/collapse", () => {
    it("does not show markdown content when collapsed", () => {
      renderSkillsTab();
      expect(screen.queryAllByTestId("markdown-content")).toHaveLength(0);
    });

    it("shows markdown content when clicking a skill card header", async () => {
      const user = userEvent.setup();
      renderSkillsTab();

      await user.click(getSkillHeader("financial-analysis"));

      const markdownElements = screen.getAllByTestId("markdown-content");
      expect(markdownElements).toHaveLength(1);
      expect(markdownElements[0]).toHaveTextContent(
        "# Financial Analysis Perform deep analysis.",
      );
    });

    it("collapses content when clicking the same skill card header again", async () => {
      const user = userEvent.setup();
      renderSkillsTab();

      await user.click(getSkillHeader("financial-analysis"));
      expect(screen.getAllByTestId("markdown-content")).toHaveLength(1);

      await user.click(getSkillHeader("financial-analysis"));
      await waitFor(() =>
        expect(screen.queryAllByTestId("markdown-content")).toHaveLength(0),
      );
    });

    it("can expand multiple skill cards independently", async () => {
      const user = userEvent.setup();
      renderSkillsTab();

      await user.click(getSkillHeader("financial-analysis"));
      await user.click(getSkillHeader("data-viz"));

      const markdownElements = screen.getAllByTestId("markdown-content");
      expect(markdownElements).toHaveLength(2);
    });
  });

  describe("Single delete flow", () => {
    it("opens confirm dialog when clicking the delete button on a skill", async () => {
      const user = userEvent.setup();
      renderSkillsTab();

      const trashIcons = screen.getAllByTestId("icon-trash-02");
      await user.click(trashIcons[0].closest("button")!);

      expect(screen.getByTestId("confirm-dialog")).toBeInTheDocument();
      expect(screen.getByText("Delete Skill")).toBeInTheDocument();
      expect(
        screen.getByText("Are you sure you want to delete this skill?"),
      ).toBeInTheDocument();
    });

    it("calls deleteUserSkills API and updateSkills with the correct id and shows toast when confirmed", async () => {
      const user = userEvent.setup();
      const remainingSkills = mockSkills.slice(1);
      mockDeleteUserSkills.mockResolvedValue(remainingSkills);
      renderSkillsTab();

      const trashIcons = screen.getAllByTestId("icon-trash-02");
      await user.click(trashIcons[0].closest("button")!);

      await user.click(screen.getByRole("button", { name: "Delete" }));

      await waitFor(() => {
        expect(mockDeleteUserSkills).toHaveBeenCalledWith("skill-1");
        expect(mockUpdateSkills).toHaveBeenCalledWith(remainingSkills);
        expect(mockToastSuccess).toHaveBeenCalledWith("Skill deleted");
      });
    });

    it("closes dialog without deleting when cancel is clicked", async () => {
      const user = userEvent.setup();
      renderSkillsTab();

      const trashIcons = screen.getAllByTestId("icon-trash-02");
      await user.click(trashIcons[0].closest("button")!);

      expect(screen.getByTestId("confirm-dialog")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Cancel" }));

      expect(mockDeleteUserSkills).not.toHaveBeenCalled();
      expect(screen.queryByTestId("confirm-dialog")).not.toBeInTheDocument();
    });

    it("deletes the correct skill when clicking delete on a non-first skill", async () => {
      const user = userEvent.setup();
      const remainingSkills = mockSkills.slice(0, 2);
      mockDeleteUserSkills.mockResolvedValue(remainingSkills);
      renderSkillsTab();

      const trashIcons = screen.getAllByTestId("icon-trash-02");
      await user.click(trashIcons[2].closest("button")!);
      await user.click(screen.getByRole("button", { name: "Delete" }));

      await waitFor(() => {
        expect(mockDeleteUserSkills).toHaveBeenCalledWith("skill-3");
      });
    });
  });

  describe("Checkbox selection", () => {
    it("renders one checkbox per skill", () => {
      renderSkillsTab();

      const checkboxes = screen.getAllByRole("checkbox");
      expect(checkboxes).toHaveLength(3);
    });

    it("does not show bulk delete button when no skills are selected", () => {
      renderSkillsTab();

      expect(
        screen.queryByRole("button", { name: /Delete skill/ }),
      ).not.toBeInTheDocument();
    });

    it("shows Delete skill button after selecting one skill", async () => {
      const user = userEvent.setup();
      renderSkillsTab();

      const checkboxes = screen.getAllByRole("checkbox");
      await user.click(checkboxes[0].closest("div[onClick]") ?? checkboxes[0]);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /Delete skill$/ }),
        ).toBeInTheDocument();
      });
    });

    it("shows Delete skills (plural) button after selecting multiple skills", async () => {
      const user = userEvent.setup();
      renderSkillsTab();

      const checkboxes = screen.getAllByRole("checkbox");
      await user.click(checkboxes[0].closest("div[onClick]") ?? checkboxes[0]);
      await user.click(checkboxes[1].closest("div[onClick]") ?? checkboxes[1]);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /Delete skills/ }),
        ).toBeInTheDocument();
      });
    });

    it("deselects a skill when clicking its checkbox again", async () => {
      const user = userEvent.setup();
      renderSkillsTab();

      const checkboxes = screen.getAllByRole("checkbox");
      const clickTarget = checkboxes[0].closest("div[onClick]") ?? checkboxes[0];

      await user.click(clickTarget);
      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /Delete skill/ }),
        ).toBeInTheDocument();
      });

      await user.click(clickTarget);
      await waitFor(() => {
        expect(
          screen.queryByRole("button", { name: /Delete skill/ }),
        ).not.toBeInTheDocument();
      });
    });

    it("does not render checkboxes when there are no skills", () => {
      setupMocks([]);
      renderSkillsTab();

      const checkboxes = screen.queryAllByRole("checkbox");
      expect(checkboxes).toHaveLength(0);
    });
  });

  describe("Bulk delete flow", () => {
    it("opens bulk delete confirm dialog with selected count", async () => {
      const user = userEvent.setup();
      renderSkillsTab();

      const checkboxes = screen.getAllByRole("checkbox");
      await user.click(checkboxes[0].closest("div[onClick]") ?? checkboxes[0]);
      await user.click(checkboxes[1].closest("div[onClick]") ?? checkboxes[1]);

      const bulkDeleteBtn = await screen.findByRole("button", {
        name: /Delete skills/,
      });
      await user.click(bulkDeleteBtn);

      expect(screen.getByTestId("confirm-dialog")).toBeInTheDocument();
      expect(screen.getByText("Delete Skill(s)")).toBeInTheDocument();
      expect(screen.getByText("2")).toBeInTheDocument();
    });

    it("lists selected skills in the bulk delete dialog", async () => {
      const user = userEvent.setup();
      renderSkillsTab();

      const checkboxes = screen.getAllByRole("checkbox");
      await user.click(checkboxes[0].closest("div[onClick]") ?? checkboxes[0]);
      await user.click(checkboxes[1].closest("div[onClick]") ?? checkboxes[1]);

      const bulkDeleteBtn = await screen.findByRole("button", {
        name: /Delete skills/,
      });
      await user.click(bulkDeleteBtn);

      const descriptionEl = screen.getByTestId("confirm-dialog-description");
      expect(descriptionEl).toHaveTextContent(/\/financial-analysis/);
      expect(descriptionEl).toHaveTextContent(/\/data-viz/);
    });

    it("calls deleteUserSkills API with selected ids and shows toast on confirm", async () => {
      const user = userEvent.setup();
      const remainingSkills = [mockSkills[2]];
      mockDeleteUserSkills.mockResolvedValue(remainingSkills);
      renderSkillsTab();

      const checkboxes = screen.getAllByRole("checkbox");
      await user.click(checkboxes[0].closest("div[onClick]") ?? checkboxes[0]);
      await user.click(checkboxes[1].closest("div[onClick]") ?? checkboxes[1]);

      const bulkDeleteBtn = await screen.findByRole("button", {
        name: /Delete skills/,
      });
      await user.click(bulkDeleteBtn);

      await user.click(screen.getByRole("button", { name: "Yes, Delete" }));

      await waitFor(() => {
        expect(mockDeleteUserSkills).toHaveBeenCalledWith(
          expect.arrayContaining(["skill-1", "skill-2"]),
        );
        expect(mockUpdateSkills).toHaveBeenCalledWith(remainingSkills);
        expect(mockToastSuccess).toHaveBeenCalledWith(
          "Skills deleted",
          expect.objectContaining({
            description: expect.stringContaining("Successfully deleted 2 skill(s)."),
          }),
        );
      });
    });

    it("closes dialog and clears selection after bulk delete", async () => {
      const user = userEvent.setup();
      const remainingSkills = mockSkills.slice(1);
      mockDeleteUserSkills.mockResolvedValue(remainingSkills);
      renderSkillsTab();

      const checkboxes = screen.getAllByRole("checkbox");
      await user.click(checkboxes[0].closest("div[onClick]") ?? checkboxes[0]);

      const bulkDeleteBtn = await screen.findByRole("button", {
        name: /Delete skill$/,
      });
      await user.click(bulkDeleteBtn);
      await user.click(screen.getByRole("button", { name: "Yes, Delete" }));

      await waitFor(() => {
        expect(screen.queryByTestId("confirm-dialog")).not.toBeInTheDocument();
        expect(
          screen.queryByRole("button", { name: /Delete skill/ }),
        ).not.toBeInTheDocument();
      });
    });

    it("closes bulk delete dialog without deleting when cancel is clicked", async () => {
      const user = userEvent.setup();
      renderSkillsTab();

      const checkboxes = screen.getAllByRole("checkbox");
      await user.click(checkboxes[0].closest("div[onClick]") ?? checkboxes[0]);

      const bulkDeleteBtn = await screen.findByRole("button", {
        name: /Delete skill$/,
      });
      await user.click(bulkDeleteBtn);
      await user.click(screen.getByRole("button", { name: "Cancel" }));

      expect(mockDeleteUserSkills).not.toHaveBeenCalled();
      expect(screen.queryByTestId("confirm-dialog")).not.toBeInTheDocument();
    });
  });

  describe("Edit flow", () => {
    it("calls setEditingSkillId and opens the add skill dialog when edit is clicked", async () => {
      const user = userEvent.setup();
      renderSkillsTab();

      const editIcons = screen.getAllByTestId("icon-edit");
      await user.click(editIcons[0].closest("button")!);

      expect(mockSetSkillDialogOpen).toHaveBeenCalledWith("skill-1");
    });

    it("edits the correct skill when clicking edit on a different card", async () => {
      const user = userEvent.setup();
      renderSkillsTab();

      const editIcons = screen.getAllByTestId("icon-edit");
      await user.click(editIcons[1].closest("button")!);

      expect(mockSetSkillDialogOpen).toHaveBeenCalledWith("skill-2");
    });

    it("does not expand the card when clicking edit", async () => {
      const user = userEvent.setup();
      renderSkillsTab();

      const editIcons = screen.getAllByTestId("icon-edit");
      await user.click(editIcons[0].closest("button")!);

      expect(screen.queryAllByTestId("markdown-content")).toHaveLength(0);
    });
  });

  describe("Search filtering", () => {
    it("filters skills by slug when typing in the search input", async () => {
      const user = userEvent.setup();
      renderSkillsTab();

      const searchInput = screen.getByPlaceholderText("Search for skills");
      await user.type(searchInput, "financial");

      await waitFor(() => {
        expect(screen.getByText("financial-analysis")).toBeInTheDocument();
        expect(screen.queryByText("data-viz")).not.toBeInTheDocument();
        expect(screen.queryByText("report-gen")).not.toBeInTheDocument();
      });
    });

    it("filters skills by description", async () => {
      const user = userEvent.setup();
      renderSkillsTab();

      const searchInput = screen.getByPlaceholderText("Search for skills");
      await user.type(searchInput, "visualizations");

      await waitFor(() => {
        expect(screen.getByText("data-viz")).toBeInTheDocument();
        expect(screen.queryByText("financial-analysis")).not.toBeInTheDocument();
        expect(screen.queryByText("report-gen")).not.toBeInTheDocument();
      });
    });

    it("filters skills by content", async () => {
      const user = userEvent.setup();
      renderSkillsTab();

      const searchInput = screen.getByPlaceholderText("Search for skills");
      await user.type(searchInput, "detailed reports");

      await waitFor(() => {
        expect(screen.getByText("report-gen")).toBeInTheDocument();
        expect(screen.queryByText("financial-analysis")).not.toBeInTheDocument();
        expect(screen.queryByText("data-viz")).not.toBeInTheDocument();
      });
    });

    it("shows no results state when search matches nothing", async () => {
      const user = userEvent.setup();
      renderSkillsTab();

      const searchInput = screen.getByPlaceholderText("Search for skills");
      await user.type(searchInput, "nonexistent-xyz-search-term");

      await waitFor(() => {
        expect(screen.getByTestId("results-not-found")).toBeInTheDocument();
      });
    });

    it("search is case-insensitive", async () => {
      const user = userEvent.setup();
      renderSkillsTab();

      const searchInput = screen.getByPlaceholderText("Search for skills");
      await user.type(searchInput, "FINANCIAL");

      await waitFor(() => {
        expect(screen.getByText("financial-analysis")).toBeInTheDocument();
        expect(screen.queryByText("data-viz")).not.toBeInTheDocument();
      });
    });

    it("shows all skills when search is cleared", async () => {
      const user = userEvent.setup();
      renderSkillsTab();

      const searchInput = screen.getByPlaceholderText("Search for skills");
      await user.type(searchInput, "financial");

      await waitFor(() => {
        expect(screen.queryByText("data-viz")).not.toBeInTheDocument();
      });

      await user.clear(searchInput);

      await waitFor(() => {
        expect(screen.getByText("financial-analysis")).toBeInTheDocument();
        expect(screen.getByText("data-viz")).toBeInTheDocument();
        expect(screen.getByText("report-gen")).toBeInTheDocument();
      });
    });
  });
});

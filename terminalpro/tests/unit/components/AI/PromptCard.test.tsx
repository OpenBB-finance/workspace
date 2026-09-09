import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PromptCard } from "~/components/AI/PromptCard";

const { mockToast } = vi.hoisted(() => ({
  mockToast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("sonner", () => ({ toast: mockToast }));

vi.mock("~/components/AI/TextStyle", () => ({
  default: ({ content, className }: { content: string; className?: string }) => (
    <span data-testid="text-style" className={className}>
      {content}
    </span>
  ),
}));

vi.mock("~/components/General/Table/AgGridUtils", () => ({
  formatDate: (date: Date) => date.toISOString().split("T")[0],
  isDate: (_value: any) => false,
}));

vi.mock("~/components/Icon", () => ({
  default: ({ id, className }: { id: string; className?: string }) => (
    <span data-testid={`icon-${id}`} className={className} />
  ),
}));

vi.mock("~/components/Tooltip", () => ({
  default: ({ children, message }: { children: ReactNode; message: string }) => (
    <div title={message}>{children}</div>
  ),
}));

vi.mock("~/components/ds/atoms/Checkbox", () => ({
  Checkbox: ({
    checked,
    onCheckedChange,
    onClick,
  }: {
    checked: boolean;
    onCheckedChange: () => void;
    onClick?: (e: React.MouseEvent) => void;
  }) => (
    <input
      type="checkbox"
      checked={checked}
      onChange={onCheckedChange}
      onClick={onClick}
      data-testid="checkbox"
    />
  ),
}));

vi.mock("~/components/ds/molecules/LibraryList", () => ({
  LIBRARY_ROW_CLASS: "library-row-class",
  LIBRARY_CARD_CLASS: "library-card-class",
  LibraryRow: ({
    children,
    className,
  }: {
    children: ReactNode;
    className?: string;
  }) => (
    <div data-testid="library-row" className={className}>
      {children}
    </div>
  ),
  LibraryItem: ({
    children,
    leftSection,
    rightSection,
    description,
    variant,
    className,
  }: {
    children: ReactNode;
    leftSection?: ReactNode;
    rightSection?: ReactNode;
    description?: ReactNode;
    variant?: string;
    className?: string;
  }) => (
    <div data-testid="library-item" data-variant={variant} className={className}>
      {leftSection}
      {description}
      {rightSection}
      {children}
    </div>
  ),
}));

const defaultPrompt = {
  id: "prompt-1",
  prompt: "What is the market outlook?",
  widgets: ["chart", "table"],
  createdAt: "2024-01-15T10:00:00Z",
};

describe("PromptCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders edit and delete buttons when shared=false", () => {
    render(<PromptCard prompt={defaultPrompt} onEdit={vi.fn()} onDelete={vi.fn()} />);

    expect(screen.getByTestId("icon-edit")).toBeInTheDocument();
    expect(screen.getByTestId("icon-trash-02")).toBeInTheDocument();
  });

  it("hides edit and delete when shared=true", () => {
    render(
      <PromptCard prompt={defaultPrompt} onEdit={vi.fn()} onDelete={vi.fn()} shared />,
    );

    expect(screen.queryByTestId("icon-edit")).not.toBeInTheDocument();
    expect(screen.queryByTestId("icon-trash-02")).not.toBeInTheDocument();
  });

  it("shows duplicate button when shared=true and onDuplicate is provided", () => {
    render(
      <PromptCard
        prompt={defaultPrompt}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onDuplicate={vi.fn()}
        shared
      />,
    );

    expect(screen.getByTestId("icon-copy-03")).toBeInTheDocument();
  });

  it("calls onEdit with prompt.id when edit button is clicked", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();

    render(<PromptCard prompt={defaultPrompt} onEdit={onEdit} onDelete={vi.fn()} />);

    await user.click(screen.getByTestId("icon-edit").closest("button")!);

    expect(onEdit).toHaveBeenCalledWith("prompt-1");
  });

  it("calls onDelete with prompt.id when delete button is clicked", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();

    render(<PromptCard prompt={defaultPrompt} onEdit={vi.fn()} onDelete={onDelete} />);

    await user.click(screen.getByTestId("icon-trash-02").closest("button")!);

    expect(onDelete).toHaveBeenCalledWith("prompt-1");
  });

  it("calls onDuplicate with prompt text when duplicate button is clicked", async () => {
    const user = userEvent.setup();
    const onDuplicate = vi.fn();

    render(
      <PromptCard
        prompt={defaultPrompt}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onDuplicate={onDuplicate}
        shared
      />,
    );

    await user.click(screen.getByTestId("icon-copy-03").closest("button")!);

    expect(onDuplicate).toHaveBeenCalledWith("What is the market outlook?");
  });

  it("copies prompt text to clipboard and shows toast on copy click", async () => {
    const user = userEvent.setup();

    render(<PromptCard prompt={defaultPrompt} onEdit={vi.fn()} onDelete={vi.fn()} />);

    await user.click(screen.getByTestId("icon-clipboard-icon").closest("button")!);

    expect(mockToast.success).toHaveBeenCalledWith("Prompt copied to clipboard");
  });

  it("renders checkbox when shared=false and onToggleSelect is provided", () => {
    render(
      <PromptCard
        prompt={defaultPrompt}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onToggleSelect={vi.fn()}
      />,
    );

    expect(screen.getByTestId("checkbox")).toBeInTheDocument();
  });

  it("does not render checkbox when onToggleSelect is not provided", () => {
    render(<PromptCard prompt={defaultPrompt} onEdit={vi.fn()} onDelete={vi.fn()} />);

    expect(screen.queryByTestId("checkbox")).not.toBeInTheDocument();
  });

  it("calls onToggleSelect with prompt.id when checkbox is clicked", async () => {
    const user = userEvent.setup();
    const onToggleSelect = vi.fn();

    render(
      <PromptCard
        prompt={defaultPrompt}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onToggleSelect={onToggleSelect}
      />,
    );

    await user.click(screen.getByTestId("checkbox"));

    expect(onToggleSelect).toHaveBeenCalledWith("prompt-1");
  });

  describe("Reordering", () => {
    it("renders move up/down buttons when onMoveUp and onMoveDown are provided and shared=false", () => {
      render(
        <PromptCard
          prompt={defaultPrompt}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
          onMoveUp={vi.fn()}
          onMoveDown={vi.fn()}
          canMoveUp
          canMoveDown
        />,
      );

      expect(screen.getByTestId("icon-square-arrow-up")).toBeInTheDocument();
      expect(screen.getByTestId("icon-square-arrow-down")).toBeInTheDocument();
    });

    it("calls onMoveUp when move up button is clicked", async () => {
      const user = userEvent.setup();
      const onMoveUp = vi.fn();

      render(
        <PromptCard
          prompt={defaultPrompt}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
          onMoveUp={onMoveUp}
          onMoveDown={vi.fn()}
          canMoveUp
          canMoveDown
        />,
      );

      await user.click(screen.getByTestId("icon-square-arrow-up").closest("button")!);
      expect(onMoveUp).toHaveBeenCalled();
    });

    it("calls onMoveDown when move down button is clicked", async () => {
      const user = userEvent.setup();
      const onMoveDown = vi.fn();

      render(
        <PromptCard
          prompt={defaultPrompt}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
          onMoveUp={vi.fn()}
          onMoveDown={onMoveDown}
          canMoveUp
          canMoveDown
        />,
      );

      await user.click(screen.getByTestId("icon-square-arrow-down").closest("button")!);
      expect(onMoveDown).toHaveBeenCalled();
    });

    it("disables move up button when canMoveUp=false, disables move down button when canMoveDown=false", () => {
      render(
        <PromptCard
          prompt={defaultPrompt}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
          onMoveUp={vi.fn()}
          onMoveDown={vi.fn()}
          canMoveUp={false}
          canMoveDown={false}
        />,
      );

      const moveUpBtn = screen.getByTestId("icon-square-arrow-up").closest("button")!;
      const moveDownBtn = screen
        .getByTestId("icon-square-arrow-down")
        .closest("button")!;

      expect(moveUpBtn).toBeDisabled();
      expect(moveDownBtn).toBeDisabled();
    });

    it("does not render reorder buttons when shared=true", () => {
      render(
        <PromptCard
          prompt={defaultPrompt}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
          onMoveUp={vi.fn()}
          onMoveDown={vi.fn()}
          canMoveUp
          canMoveDown
          shared
        />,
      );

      expect(screen.queryByTestId("icon-square-arrow-up")).not.toBeInTheDocument();
      expect(screen.queryByTestId("icon-square-arrow-down")).not.toBeInTheDocument();
    });

    it("does not render reorder buttons when onMoveUp or onMoveDown is missing", () => {
      render(
        <PromptCard
          prompt={defaultPrompt}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
          canMoveUp
          canMoveDown
        />,
      );

      expect(screen.queryByTestId("icon-square-arrow-up")).not.toBeInTheDocument();
      expect(screen.queryByTestId("icon-square-arrow-down")).not.toBeInTheDocument();
    });
  });
});

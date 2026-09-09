import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BackendPromptCard } from "~/components/AI/BackendPromptCard";

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

vi.mock("~/components/Icon", () => ({
  default: ({ id, className }: { id: string; className?: string }) => (
    <span data-testid={`icon-${id}`} className={className} />
  ),
}));

vi.mock("~/components/Tooltip", () => ({
  default: ({
    children,
    message,
  }: {
    children: ReactNode;
    message: string;
  }) => <div title={message}>{children}</div>,
}));

vi.mock("~/components/ds/molecules/LibraryList", () => ({
  LIBRARY_CARD_CLASS: "library-card-class",
}));

describe("BackendPromptCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders prompt text", () => {
    render(<BackendPromptCard prompt="Hello world" onDuplicate={vi.fn()} />);

    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });

  it("calls onDuplicate with the prompt when duplicate button is clicked", async () => {
    const user = userEvent.setup();
    const onDuplicate = vi.fn();

    render(<BackendPromptCard prompt="Test prompt" onDuplicate={onDuplicate} />);

    const duplicateButton = screen.getByTestId("icon-copy-03").closest("button")!;
    await user.click(duplicateButton);

    expect(onDuplicate).toHaveBeenCalledWith("Test prompt");
    expect(onDuplicate).toHaveBeenCalledTimes(1);
  });

  it("shows toast when copy button is clicked", async () => {
    const user = userEvent.setup();

    render(<BackendPromptCard prompt="Copy me" onDuplicate={vi.fn()} />);

    const copyButton = screen.getByTestId("icon-clipboard-icon").closest("button")!;
    await user.click(copyButton);

    expect(mockToast.success).toHaveBeenCalledWith("Prompt copied to clipboard");
  });

  it("renders both tooltip buttons with correct messages", () => {
    render(<BackendPromptCard prompt="Any prompt" onDuplicate={vi.fn()} />);

    expect(screen.getByTitle("Duplicate to My Prompts")).toBeInTheDocument();
    expect(screen.getByTitle("Copy to clipboard")).toBeInTheDocument();
  });
});

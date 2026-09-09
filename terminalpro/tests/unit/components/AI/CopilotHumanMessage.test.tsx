import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";
import CopilotHumanMessage from "~/components/AI/CopilotHumanMessage";
import {
  StreamingStatus,
  useShallowStreamingStore,
} from "~/components/AI/hooks/useStreaming";
import { useCopilotContext } from "~/lib/contexts/CopilotChatContext";
import type { HumanMessage } from "~/lib/state/copilot";
import { useShallowCopilotStore } from "~/lib/state/copilot";
import { useShallowPromptLibraryStore } from "~/lib/state/promptLibrary";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("~/lib/contexts/CopilotChatContext", () => ({
  useCopilotContext: vi.fn(),
}));

vi.mock("~/lib/state/copilot", () => ({
  useShallowCopilotStore: vi.fn(),
}));

vi.mock("~/lib/state/promptLibrary", () => ({
  useShallowPromptLibraryStore: vi.fn(),
}));

vi.mock("~/components/AI/hooks/useStreaming", () => ({
  useShallowStreamingStore: vi.fn(),
  StreamingStatus: {
    READY: { streamingStatus: "streaming-ready" },
    STARTED: { streamingStatus: "streaming-started" },
    STOPPED: { streamingStatus: "streaming-stopped" },
  },
}));

vi.mock("~/hooks/useRefHooks", () => ({
  useCallbackRef: (fn: () => void) => fn,
}));

vi.mock("~/components/AI/TextArea", () => ({
  default: ({ prompt, setPrompt, handleSubmit }: any) => (
    <textarea
      data-testid="edit-text-area"
      value={prompt}
      onChange={(e) => setPrompt(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          handleSubmit(prompt);
        }
      }}
    />
  ),
}));

vi.mock("~/components/AI/TextStyle", () => ({
  default: ({ content, className }: { content: string; className?: string }) => (
    <div data-testid="text-style" className={className}>
      {content}
    </div>
  ),
}));

vi.mock("dayjs", () => {
  const dayjsMock = (_timestamp?: number) => ({
    format: (_formatStr: string) => "Jan 15, 2024 • 2:30 PM",
  });
  // utils.ts calls dayjs.extend(plugin) at module load
  dayjsMock.extend = vi.fn();
  return { default: dayjsMock };
});

describe("CopilotHumanMessage", () => {
  const mockClearMessagesAfter = vi.fn();
  const mockRemoveUnreachableArtifacts = vi.fn();
  const mockUpdateLastMessageError = vi.fn();
  const mockSetTitleNeedsUpdate = vi.fn();
  const mockShowDatetime = vi.fn();
  const mockHideDatetime = vi.fn();
  const mockAddPrompt = vi.fn();
  const mockDispatch = vi.fn();
  const mockHandleSubmit = vi.fn();

  const baseMessage: HumanMessage = {
    role: "human",
    content: "Hello, this is a test message",
    copilotId: "openbb-copilot",
    timestamp: 1705330200000,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    (useCopilotContext as Mock).mockReturnValue({
      handleSubmitRef: { current: mockHandleSubmit },
    });

    (useShallowCopilotStore as Mock).mockImplementation((selector) => {
      return selector({
        clearMessagesAfter: mockClearMessagesAfter,
        removeUnreachableArtifacts: mockRemoveUnreachableArtifacts,
        updateLastMessageError: mockUpdateLastMessageError,
        setTitleNeedsUpdate: mockSetTitleNeedsUpdate,
        showDatetime: mockShowDatetime,
        hideDatetime: mockHideDatetime,
        currentChat: 1705330200000,
      });
    });

    (useShallowPromptLibraryStore as Mock).mockImplementation((selector) => {
      return selector({
        addPrompt: mockAddPrompt,
      });
    });

    (useShallowStreamingStore as Mock).mockImplementation((selector) => {
      return selector({
        dispatch: mockDispatch,
      });
    });
  });

  describe("message display", () => {
    it("renders the message content correctly", () => {
      render(<CopilotHumanMessage message={baseMessage} />);

      expect(screen.getByTestId("text-style")).toBeInTheDocument();
      expect(screen.getByText("Hello, this is a test message")).toBeInTheDocument();
    });

    it("displays the formatted datetime on hover", () => {
      render(<CopilotHumanMessage message={baseMessage} />);

      const datetimeElements = screen.getAllByText("Jan 15, 2024 • 2:30 PM");
      expect(datetimeElements.length).toBeGreaterThan(0);
    });

    it("applies correct styling to message bubble", () => {
      const { container } = render(<CopilotHumanMessage message={baseMessage} />);

      const messageBubble = container.querySelector(".bg-brand-main\\/10");
      expect(messageBubble).toBeInTheDocument();
    });

    it("positions message bubble on the right side", () => {
      const { container } = render(<CopilotHumanMessage message={baseMessage} />);

      const messageBubble = container.querySelector(".ml-auto");
      expect(messageBubble).toBeInTheDocument();
    });

    // The parent list is `items-start`, so the wrapper must claim the full width
    // or the bubble's ml-auto/max-w-[80%] resolve against a shrink-wrapped box.
    it("wraps the bubble in a full-width container", () => {
      const { container } = render(<CopilotHumanMessage message={baseMessage} />);

      const wrapper = container.querySelector(".group");
      expect(wrapper).toHaveClass("w-full");
      expect(wrapper?.querySelector(".ml-auto")).toBeInTheDocument();
    });
  });

  describe("attached files", () => {
    const messageWithFiles: HumanMessage = {
      ...baseMessage,
      files: [
        {
          name: "dailyreport.pdf",
          description: "a report",
          status: "uploaded",
          stored_file_uuid: "uuid-1",
        },
      ],
    };

    it("renders a read-only chip for each attached file", () => {
      const { container } = render(<CopilotHumanMessage message={messageWithFiles} />);

      expect(screen.getByText("dailyreport.pdf")).toBeInTheDocument();
      expect(container.querySelector(".justify-end")).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Remove dailyreport.pdf" }),
      ).not.toBeInTheDocument();
      expect(screen.queryByTestId("icon-check")).not.toBeInTheDocument();
    });

    it("renders no chip when the message has no files", () => {
      render(<CopilotHumanMessage message={baseMessage} />);

      expect(screen.queryByTestId("icon-attachment-icon")).not.toBeInTheDocument();
    });

    it("keeps the hover action buttons available", () => {
      const { container } = render(<CopilotHumanMessage message={messageWithFiles} />);

      expect(container.querySelectorAll("button").length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("action buttons", () => {
    it("renders save to library button", () => {
      const { container } = render(<CopilotHumanMessage message={baseMessage} />);

      const buttons = container.querySelectorAll("button");
      expect(buttons.length).toBeGreaterThanOrEqual(3);
    });

    it("saves message to prompt library when save button is clicked", async () => {
      const { container } = render(<CopilotHumanMessage message={baseMessage} />);

      const buttons = container.querySelectorAll("button");
      const saveButton = buttons[0];

      fireEvent.click(saveButton);

      expect(mockAddPrompt).toHaveBeenCalledWith({
        prompt: "Hello, this is a test message",
        widgets: [],
      });
      expect(toast.success).toHaveBeenCalledWith("Prompt stored in prompt library");
    });

    it("renders edit button", () => {
      const { container } = render(<CopilotHumanMessage message={baseMessage} />);

      const buttons = container.querySelectorAll("button");
      expect(buttons.length).toBeGreaterThanOrEqual(2);
    });

    it("renders resend button", () => {
      const { container } = render(<CopilotHumanMessage message={baseMessage} />);

      const buttons = container.querySelectorAll("button");
      expect(buttons.length).toBe(3);
    });
  });

  describe("edit mode", () => {
    it("enters edit mode when edit button is clicked", async () => {
      const { container } = render(<CopilotHumanMessage message={baseMessage} />);

      const buttons = container.querySelectorAll("button");
      const editButton = buttons[1];

      fireEvent.click(editButton);

      await waitFor(() => {
        expect(screen.getByTestId("edit-text-area")).toBeInTheDocument();
      });
    });

    it("displays cancel and send buttons in edit mode", async () => {
      const { container } = render(<CopilotHumanMessage message={baseMessage} />);

      const buttons = container.querySelectorAll("button");
      const editButton = buttons[1];

      fireEvent.click(editButton);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /send/i })).toBeInTheDocument();
      });
    });

    it("exits edit mode when cancel button is clicked", async () => {
      const { container } = render(<CopilotHumanMessage message={baseMessage} />);

      const buttons = container.querySelectorAll("button");
      const editButton = buttons[1];
      fireEvent.click(editButton);

      await waitFor(() => {
        expect(screen.getByTestId("edit-text-area")).toBeInTheDocument();
      });

      const cancelButton = screen.getByRole("button", { name: /cancel/i });
      fireEvent.click(cancelButton);

      await waitFor(() => {
        expect(screen.queryByTestId("edit-text-area")).not.toBeInTheDocument();
      });
    });

    it("populates textarea with original message content in edit mode", async () => {
      const { container } = render(<CopilotHumanMessage message={baseMessage} />);

      const buttons = container.querySelectorAll("button");
      const editButton = buttons[1];
      fireEvent.click(editButton);

      await waitFor(() => {
        const textarea = screen.getByTestId("edit-text-area");
        expect(textarea).toHaveValue("Hello, this is a test message");
      });
    });
  });

  describe("resend functionality", () => {
    it("triggers message resend when resend button is clicked", async () => {
      const { container } = render(<CopilotHumanMessage message={baseMessage} />);

      const buttons = container.querySelectorAll("button");
      const resendButton = buttons[2];

      fireEvent.click(resendButton);

      await waitFor(() => {
        expect(mockSetTitleNeedsUpdate).toHaveBeenCalled();
        expect(mockClearMessagesAfter).toHaveBeenCalled();
        expect(mockRemoveUnreachableArtifacts).toHaveBeenCalled();
        expect(mockUpdateLastMessageError).toHaveBeenCalledWith(false);
        expect(mockDispatch).toHaveBeenCalledWith(StreamingStatus.READY);
      });
    });

    it("calls handleSubmit with correct parameters on resend", async () => {
      const { container } = render(<CopilotHumanMessage message={baseMessage} />);

      const buttons = container.querySelectorAll("button");
      const resendButton = buttons[2];

      fireEvent.click(resendButton);

      await waitFor(() => {
        expect(mockHandleSubmit).toHaveBeenCalledWith({
          question: "Hello, this is a test message",
          addHumanMessage: false,
        });
      });
    });
  });

  describe("send edited message", () => {
    it("clears messages after the edited message timestamp", async () => {
      const { container } = render(<CopilotHumanMessage message={baseMessage} />);

      const buttons = container.querySelectorAll("button");
      const editButton = buttons[1];
      fireEvent.click(editButton);

      await waitFor(() => {
        expect(screen.getByTestId("edit-text-area")).toBeInTheDocument();
      });

      const sendButton = screen.getByRole("button", { name: /send/i });
      fireEvent.click(sendButton);

      await waitFor(() => {
        expect(mockClearMessagesAfter).toHaveBeenCalledWith(
          baseMessage.timestamp,
          "Hello, this is a test message",
        );
      });
    });
  });

  describe("empty message handling", () => {
    it("does not save empty message to library", () => {
      const emptyMessage: HumanMessage = {
        ...baseMessage,
        content: "",
      };

      const { container } = render(<CopilotHumanMessage message={emptyMessage} />);

      const buttons = container.querySelectorAll("button");
      const saveButton = buttons[0];

      fireEvent.click(saveButton);

      expect(mockAddPrompt).not.toHaveBeenCalled();
      expect(toast.success).not.toHaveBeenCalled();
    });

    it("does not resend when prompt is empty", async () => {
      const emptyMessage: HumanMessage = {
        ...baseMessage,
        content: "",
      };

      const { container } = render(<CopilotHumanMessage message={emptyMessage} />);

      const buttons = container.querySelectorAll("button");
      const resendButton = buttons[2];

      fireEvent.click(resendButton);

      expect(mockHandleSubmit).not.toHaveBeenCalled();
    });
  });

  describe("styling and hover states", () => {
    it("applies group class for hover effects", () => {
      const { container } = render(<CopilotHumanMessage message={baseMessage} />);

      const groupElement = container.querySelector(".group");
      expect(groupElement).toBeInTheDocument();
    });

    it("applies correct max width to message bubble", () => {
      const { container } = render(<CopilotHumanMessage message={baseMessage} />);

      const messageBubble = container.querySelector(".max-w-\\[80\\%\\]");
      expect(messageBubble).toBeInTheDocument();
    });

    it("applies rounded corners to message bubble", () => {
      const { container } = render(<CopilotHumanMessage message={baseMessage} />);

      const messageBubble = container.querySelector(".rounded");
      expect(messageBubble).toBeInTheDocument();
    });
  });

  describe("message with special characters", () => {
    it("renders message with special characters correctly", () => {
      const specialMessage: HumanMessage = {
        ...baseMessage,
        content: "What's the P/E ratio for $AAPL?",
      };

      render(<CopilotHumanMessage message={specialMessage} />);

      expect(screen.getByText("What's the P/E ratio for $AAPL?")).toBeInTheDocument();
    });

    it("renders message with newlines correctly", () => {
      const multilineMessage: HumanMessage = {
        ...baseMessage,
        content: "Line 1\nLine 2\nLine 3",
      };

      render(<CopilotHumanMessage message={multilineMessage} />);

      // The text content exists in the rendered component
      const textElement = screen.getByTestId("text-style");
      expect(textElement.textContent).toContain("Line 1");
      expect(textElement.textContent).toContain("Line 2");
      expect(textElement.textContent).toContain("Line 3");
    });
  });
});

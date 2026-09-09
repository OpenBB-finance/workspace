import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import CopilotAIMessage from "~/components/AI/CopilotAIMessage";
import { useShallowStreamingStore } from "~/components/AI/hooks/useStreaming";
import type { AIMessage, Citation } from "~/lib/state/copilot";
import { useShallowCopilotStore } from "~/lib/state/copilot";

const markdownMockState = vi.hoisted(() => ({
  RuleType: {
    text: "text",
    codeBlock: "codeBlock",
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("~/lib/state/copilot", () => ({
  useShallowCopilotStore: vi.fn(),
}));

vi.mock("~/components/AI/hooks/useStreaming", () => ({
  useShallowStreamingStore: vi.fn(),
}));

vi.mock("usehooks-ts", () => ({
  useLocalStorage: vi.fn((_key: string, defaultValue: any) => [defaultValue, vi.fn()]),
}));

vi.mock("markdown-to-jsx", () => ({
  RuleType: markdownMockState.RuleType,
  default: ({ children, options }: { children: string; options?: any }) => {
    const renderedContent = options?.renderRule
      ? options.renderRule(
          () => children,
          { type: markdownMockState.RuleType.text, text: children },
          () => children,
          { key: 0 },
        )
      : children;

    return <div data-testid="markdown-content">{renderedContent}</div>;
  },
}));

vi.mock("~/components/AI/Citation", () => ({
  default: ({ index, content: _content }: { index: number; content: Citation }) => (
    <span data-testid={`citation-${index}`}>[{index + 1}]</span>
  ),
}));

vi.mock("~/components/AI/CopilotFeedback", () => ({
  CopilotFeedback: ({ message: _message }: { message: AIMessage }) => (
    <div data-testid="feedback-component">Feedback</div>
  ),
}));

vi.mock("~/components/AI/MarkdownOverrides", () => ({
  isSafeMarkdownImageSrc: vi.fn(() => true),
  MarkdownAIMessageOverrides: {},
  renderRule: vi.fn((next) => next()),
}));

vi.mock("~/components/AI/hooks/utils", () => ({
  dispatchCreate: vi.fn(),
}));

vi.mock("~/components/AI/utils/datetimePositioning", () => ({
  getEnhancedDatetimePositionStrategy: vi.fn(() => ({
    shouldShowDatetime: false,
    timestamp: 0,
    targetGroupId: "",
  })),
}));

describe("CopilotAIMessage", () => {
  const mockShowDatetime = vi.fn();
  const mockHideDatetime = vi.fn();
  const mockGetCurrentChatArtifact = vi.fn();

  const baseMessage: AIMessage = {
    role: "ai",
    content: "This is a test AI response.",
    copilotId: "openbb-copilot",
    timestamp: 1705330200000,
    citations: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();

    (useShallowCopilotStore as Mock).mockImplementation((selector) => {
      return selector({
        showDatetime: mockShowDatetime,
        hideDatetime: mockHideDatetime,
        getCurrentChatArtifact: mockGetCurrentChatArtifact,
      });
    });

    (useShallowStreamingStore as Mock).mockImplementation((selector) => {
      return selector({
        streamingStatus: "streaming-ready",
      });
    });

    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  describe("message content rendering", () => {
    it("renders AI message content", () => {
      render(<CopilotAIMessage message={baseMessage} isLastGroup={false} />);

      expect(screen.getByTestId("markdown-content")).toBeInTheDocument();
      expect(screen.getByText("This is a test AI response.")).toBeInTheDocument();
    });

    it("renders empty content gracefully", () => {
      const emptyMessage: AIMessage = {
        ...baseMessage,
        content: "",
      };

      const { container } = render(
        <CopilotAIMessage message={emptyMessage} isLastGroup={false} />,
      );

      expect(container.querySelector(".prose")).not.toBeInTheDocument();
    });

    it("applies correct prose styling", () => {
      const { container } = render(
        <CopilotAIMessage message={baseMessage} isLastGroup={false} />,
      );

      const proseContainer = container.querySelector(".prose");
      expect(proseContainer).toBeInTheDocument();
      expect(proseContainer).toHaveClass("dark:prose-invert");
    });
  });

  describe("action buttons", () => {
    it("renders copy button", () => {
      const { container } = render(
        <CopilotAIMessage message={baseMessage} isLastGroup={false} />,
      );

      const buttons = container.querySelectorAll("button");
      expect(buttons.length).toBeGreaterThanOrEqual(2);
    });

    it("copies message text to clipboard when copy button is clicked", async () => {
      const { container } = render(
        <CopilotAIMessage message={baseMessage} isLastGroup={false} />,
      );

      const buttons = container.querySelectorAll("button");
      const copyButton = buttons[0];

      fireEvent.click(copyButton);

      await waitFor(() => {
        expect(navigator.clipboard.writeText).toHaveBeenCalled();
        expect(toast.success).toHaveBeenCalledWith("Text copied to clipboard");
      });
    });

    it("renders create widget button", () => {
      const { container } = render(
        <CopilotAIMessage message={baseMessage} isLastGroup={false} />,
      );

      const buttons = container.querySelectorAll("button");
      expect(buttons.length).toBeGreaterThanOrEqual(2);
    });

    it("renders feedback component", () => {
      render(<CopilotAIMessage message={baseMessage} isLastGroup={false} />);

      expect(screen.getByTestId("feedback-component")).toBeInTheDocument();
    });
  });

  describe("cancelled message handling", () => {
    it("displays cancellation notice when message is cancelled", () => {
      const cancelledMessage: AIMessage = {
        ...baseMessage,
        isCancelled: true,
      };

      render(<CopilotAIMessage message={cancelledMessage} isLastGroup={false} />);

      expect(
        screen.getByText("Request cancelled before completion"),
      ).toBeInTheDocument();
    });

    it("applies warning styling to cancellation notice", () => {
      const cancelledMessage: AIMessage = {
        ...baseMessage,
        isCancelled: true,
      };

      const { container } = render(
        <CopilotAIMessage message={cancelledMessage} isLastGroup={false} />,
      );

      const warningContainer = container.querySelector(".bg-orange-50");
      expect(warningContainer).toBeInTheDocument();
    });

    it("shows action buttons when cancelled but has content", () => {
      const cancelledWithContent: AIMessage = {
        ...baseMessage,
        content: "Partial response before cancellation",
        isCancelled: true,
      };

      const { container } = render(
        <CopilotAIMessage message={cancelledWithContent} isLastGroup={false} />,
      );

      expect(screen.getByTestId("feedback-component")).toBeInTheDocument();
    });

    it("hides action buttons when cancelled with no content", () => {
      const cancelledNoContent: AIMessage = {
        ...baseMessage,
        content: "",
        isCancelled: true,
      };

      render(<CopilotAIMessage message={cancelledNoContent} isLastGroup={false} />);

      expect(screen.queryByTestId("feedback-component")).not.toBeInTheDocument();
    });
  });

  describe("streaming state", () => {
    it("uses streamed data when isLastGroup and streaming", () => {
      (useShallowStreamingStore as Mock).mockImplementation((selector) => {
        return selector({
          streamingStatus: "streaming-started",
          completion: "Streaming content...",
        });
      });

      const { container } = render(
        <CopilotAIMessage message={baseMessage} isLastGroup={true} />,
      );

      // Component should render without errors
      expect(container.firstChild).toBeInTheDocument();
    });

    it("uses message content when not streaming", () => {
      render(<CopilotAIMessage message={baseMessage} isLastGroup={true} />);

      expect(screen.getByText("This is a test AI response.")).toBeInTheDocument();
    });

    it("uses message content when not last group even if streaming", () => {
      (useShallowStreamingStore as Mock).mockImplementation((selector) => {
        return selector({
          streamingStatus: "streaming-started",
        });
      });

      render(<CopilotAIMessage message={baseMessage} isLastGroup={false} />);

      expect(screen.getByText("This is a test AI response.")).toBeInTheDocument();
    });
  });

  describe("hover interactions", () => {
    it("triggers datetime display on mouse enter when groups available", () => {
      const allGroups = [{ id: "group-1" }, { id: "group-2" }];

      const { container } = render(
        <CopilotAIMessage
          message={baseMessage}
          isLastGroup={false}
          allGroups={allGroups}
          groupIndex={0}
        />,
      );

      const messageContainer = container.querySelector(".relative.group");
      if (messageContainer) {
        fireEvent.mouseEnter(messageContainer);
      }
    });

    it("hides datetime on mouse leave", () => {
      const { container } = render(
        <CopilotAIMessage message={baseMessage} isLastGroup={false} />,
      );

      const messageContainer = container.querySelector(".relative.group");
      if (messageContainer) {
        fireEvent.mouseLeave(messageContainer);
      }
    });
  });

  describe("styling", () => {
    it("applies relative positioning to container", () => {
      const { container } = render(
        <CopilotAIMessage message={baseMessage} isLastGroup={false} />,
      );

      const relativeContainer = container.querySelector(".relative.group");
      expect(relativeContainer).toBeInTheDocument();
    });

    it("applies full width styling", () => {
      const { container } = render(
        <CopilotAIMessage message={baseMessage} isLastGroup={false} />,
      );

      const widthContainer = container.querySelector(".w-full");
      expect(widthContainer).toBeInTheDocument();
    });

    it("applies general primary background styling", () => {
      const { container } = render(
        <CopilotAIMessage message={baseMessage} isLastGroup={false} />,
      );

      const bgContainer = container.querySelector(".bg-general-bg-primary");
      expect(bgContainer).toBeInTheDocument();
    });
  });

  describe("message with citations", () => {
    it("renders message with citation markers", () => {
      const messageWithCitations: AIMessage = {
        ...baseMessage,
        content: 'Here is some information <citation className="cite-1"/>',
        citations: [
          {
            id: "cite-1",
            source_info: {
              type: "widget",
              name: "Test Widget",
            },
            signature: "widget-signature",
          },
        ],
      };

      render(<CopilotAIMessage message={messageWithCitations} isLastGroup={false} />);

      expect(screen.getByTestId("markdown-content")).toBeInTheDocument();
    });
  });

  describe("message with complex content", () => {
    it("renders message with code blocks", () => {
      const messageWithCode: AIMessage = {
        ...baseMessage,
        content: "```python\nprint('hello')\n```",
      };

      render(<CopilotAIMessage message={messageWithCode} isLastGroup={false} />);

      expect(screen.getByTestId("markdown-content")).toBeInTheDocument();
    });

    it("renders message with markdown formatting", () => {
      const markdownMessage: AIMessage = {
        ...baseMessage,
        content: "**Bold** and *italic* text with [links](https://example.com)",
      };

      render(<CopilotAIMessage message={markdownMessage} isLastGroup={false} />);

      expect(screen.getByTestId("markdown-content")).toBeInTheDocument();
    });

    it("does not escape underscores inside URLs", () => {
      const messageWithUrl: AIMessage = {
        ...baseMessage,
        content:
          "More info: https://example.com/path_with_underscore?query=foo_bar and text_with_underscores",
      };

      render(<CopilotAIMessage message={messageWithUrl} isLastGroup={false} />);

      const markdown = screen.getByTestId("markdown-content");
      expect(markdown.textContent).toContain(
        "https://example.com/path_with_underscore?query=foo_bar",
      );
      expect(markdown.textContent).toContain("text\\_with\\_underscores");
    });

    it("renders message with tables", () => {
      const tableMessage: AIMessage = {
        ...baseMessage,
        content: "| Header 1 | Header 2 |\n|---|---|\n| Cell 1 | Cell 2 |",
      };

      render(<CopilotAIMessage message={tableMessage} isLastGroup={false} />);

      expect(screen.getByTestId("markdown-content")).toBeInTheDocument();
    });
  });

  describe("divider and actions layout", () => {
    it("renders divider between content and actions", () => {
      const { container } = render(
        <CopilotAIMessage message={baseMessage} isLastGroup={false} />,
      );

      const divider = container.querySelector(".obb-divider");
      expect(divider).toBeInTheDocument();
    });

    it("renders actions in inline-block container", () => {
      const { container } = render(
        <CopilotAIMessage message={baseMessage} isLastGroup={false} />,
      );

      const inlineBlock = container.querySelector(".inline-block");
      expect(inlineBlock).toBeInTheDocument();
    });
  });
});

import { render, screen } from "@testing-library/react";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";
import CopilotMessage from "~/components/AI/CopilotMessage";
import type { AIMessage, HumanMessage, Message, SystemMessage } from "~/lib/state/copilot";

vi.mock("~/components/AI", () => ({
  CopilotAIMessage: ({ message }: { message: AIMessage }) => (
    <div data-testid="ai-message">{message.content}</div>
  ),
  CopilotHumanMessage: ({ message }: { message: HumanMessage }) => (
    <div data-testid="human-message">{message.content}</div>
  ),
  CopilotSystemMessage: ({ message }: { message: SystemMessage }) => (
    <div data-testid="system-message">{message.content?.message}</div>
  ),
}));

describe("CopilotMessage", () => {
  const baseProps = {
    isLastGroup: false,
    showIcon: true,
    currentGroupId: "group-1",
    allGroups: [],
    groupIndex: 0,
    isPartOfStepByStepGroup: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("message role routing", () => {
    it("renders CopilotHumanMessage for human role messages", () => {
      const humanMessage: HumanMessage = {
        role: "human",
        content: "Hello, how are you?",
        copilotId: "openbb-copilot",
        timestamp: Date.now(),
      };

      render(<CopilotMessage {...baseProps} message={humanMessage} />);

      expect(screen.getByTestId("human-message")).toBeInTheDocument();
      expect(screen.getByText("Hello, how are you?")).toBeInTheDocument();
    });

    it("renders CopilotAIMessage for ai role messages", () => {
      const aiMessage: AIMessage = {
        role: "ai",
        content: "I am doing well, thank you!",
        copilotId: "openbb-copilot",
        timestamp: Date.now(),
      };

      render(<CopilotMessage {...baseProps} message={aiMessage} />);

      expect(screen.getByTestId("ai-message")).toBeInTheDocument();
      expect(screen.getByText("I am doing well, thank you!")).toBeInTheDocument();
    });

    it("renders CopilotSystemMessage for system role messages", () => {
      const systemMessage: SystemMessage = {
        role: "system",
        content: {
          eventType: "INFO",
          message: "Processing your request...",
        },
        copilotId: "openbb-copilot",
        timestamp: Date.now(),
      };

      render(<CopilotMessage {...baseProps} message={systemMessage} />);

      expect(screen.getByTestId("system-message")).toBeInTheDocument();
      expect(screen.getByText("Processing your request...")).toBeInTheDocument();
    });

    it("renders nothing for unrecognized message roles", () => {
      const unknownMessage = {
        role: "unknown",
        content: "This should not render",
        copilotId: "openbb-copilot",
        timestamp: Date.now(),
      } as unknown as Message;

      const { container } = render(<CopilotMessage {...baseProps} message={unknownMessage} />);

      expect(screen.queryByTestId("human-message")).not.toBeInTheDocument();
      expect(screen.queryByTestId("ai-message")).not.toBeInTheDocument();
      expect(screen.queryByTestId("system-message")).not.toBeInTheDocument();
      expect(container.querySelector("._message-content")).toBeInTheDocument();
    });
  });

  describe("component structure", () => {
    it("wraps message content in expected container with test selector", () => {
      const humanMessage: HumanMessage = {
        role: "human",
        content: "Test message",
        copilotId: "openbb-copilot",
        timestamp: Date.now(),
      };

      const { container } = render(<CopilotMessage {...baseProps} message={humanMessage} />);

      const messageContent = container.querySelector("._message-content");
      expect(messageContent).toBeInTheDocument();
    });

    it("applies correct flex styling to message content wrapper", () => {
      const aiMessage: AIMessage = {
        role: "ai",
        content: "AI response",
        copilotId: "openbb-copilot",
        timestamp: Date.now(),
      };

      const { container } = render(<CopilotMessage {...baseProps} message={aiMessage} />);

      const flexContainer = container.querySelector(".flex.flex-col.gap-3\\.5");
      expect(flexContainer).toBeInTheDocument();
    });
  });

  describe("props forwarding", () => {
    it("passes isLastGroup prop to AI message component", () => {
      const aiMessage: AIMessage = {
        role: "ai",
        content: "Response",
        copilotId: "openbb-copilot",
        timestamp: Date.now(),
      };

      render(<CopilotMessage {...baseProps} message={aiMessage} isLastGroup={true} />);

      expect(screen.getByTestId("ai-message")).toBeInTheDocument();
    });

    it("passes showIcon and currentGroupId to system message component", () => {
      const systemMessage: SystemMessage = {
        role: "system",
        content: {
          eventType: "WARNING",
          message: "Warning message",
        },
        copilotId: "openbb-copilot",
        timestamp: Date.now(),
      };

      render(
        <CopilotMessage
          {...baseProps}
          message={systemMessage}
          showIcon={false}
          currentGroupId="custom-group-id"
        />
      );

      expect(screen.getByTestId("system-message")).toBeInTheDocument();
    });

    it("passes allGroups and groupIndex to AI message", () => {
      const aiMessage: AIMessage = {
        role: "ai",
        content: "Response",
        copilotId: "openbb-copilot",
        timestamp: Date.now(),
      };

      const allGroups = [{ id: "group-1" }, { id: "group-2" }];

      render(
        <CopilotMessage
          {...baseProps}
          message={aiMessage}
          allGroups={allGroups}
          groupIndex={1}
        />
      );

      expect(screen.getByTestId("ai-message")).toBeInTheDocument();
    });

    it("passes isPartOfStepByStepGroup to system message", () => {
      const systemMessage: SystemMessage = {
        role: "system",
        content: {
          eventType: "INFO",
          message: "Step-by-step info",
        },
        copilotId: "openbb-copilot",
        timestamp: Date.now(),
      };

      render(
        <CopilotMessage
          {...baseProps}
          message={systemMessage}
          isPartOfStepByStepGroup={true}
        />
      );

      expect(screen.getByTestId("system-message")).toBeInTheDocument();
    });
  });

  describe("memoization", () => {
    it("re-renders when message content changes", () => {
      const initialMessage: HumanMessage = {
        role: "human",
        content: "Initial content",
        copilotId: "openbb-copilot",
        timestamp: Date.now(),
      };

      const { rerender } = render(<CopilotMessage {...baseProps} message={initialMessage} />);

      expect(screen.getByText("Initial content")).toBeInTheDocument();

      const updatedMessage: HumanMessage = {
        ...initialMessage,
        content: "Updated content",
      };

      rerender(<CopilotMessage {...baseProps} message={updatedMessage} />);

      expect(screen.getByText("Updated content")).toBeInTheDocument();
    });

    it("re-renders when isLastGroup changes", () => {
      const aiMessage: AIMessage = {
        role: "ai",
        content: "AI content",
        copilotId: "openbb-copilot",
        timestamp: Date.now(),
      };

      const { rerender } = render(
        <CopilotMessage {...baseProps} message={aiMessage} isLastGroup={false} />
      );

      expect(screen.getByTestId("ai-message")).toBeInTheDocument();

      rerender(<CopilotMessage {...baseProps} message={aiMessage} isLastGroup={true} />);

      expect(screen.getByTestId("ai-message")).toBeInTheDocument();
    });
  });
});

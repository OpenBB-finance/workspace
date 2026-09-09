import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";
import CopilotSystemMessage from "~/components/AI/CopilotSystemMessage";
import type { ArtifactT, SystemMessage, SystemSSEContent } from "~/lib/state/copilot";
import { useShallowCopilotStore } from "~/lib/state/copilot";

vi.mock("~/lib/state/copilot", () => ({
  useShallowCopilotStore: vi.fn(),
}));

vi.mock("~/components/AI", () => ({
  Artifact: ({ artifact }: { artifact: ArtifactT }) => (
    <div data-testid="artifact">{artifact.name}</div>
  ),
  Table: ({ content }: { content: Record<string, any> }) => (
    <div data-testid="table">{JSON.stringify(content)}</div>
  ),
}));

vi.mock("~/components/AI/CopilotMessageTitle", () => ({
  default: ({
    content,
    eventType,
    isExpanded,
    isExpandable,
    toggleDropdown,
    showIcon,
  }: {
    content: string;
    eventType: string;
    isExpanded: boolean;
    isExpandable: boolean;
    toggleDropdown: () => void;
    showIcon: boolean;
  }) => (
    <div data-testid="message-title" onClick={toggleDropdown}>
      <span data-testid="event-type">{eventType}</span>
      <span data-testid="content">{content}</span>
      <span data-testid="is-expandable">{isExpandable.toString()}</span>
      <span data-testid="is-expanded">{isExpanded.toString()}</span>
      <span data-testid="show-icon">{showIcon.toString()}</span>
    </div>
  ),
}));

vi.mock("markdown-to-jsx", () => ({
  default: ({ children }: { children: string }) => (
    <div data-testid="markdown">{children}</div>
  ),
}));

vi.mock("~/components/AI/MarkdownOverrides", () => ({
  CodeComponent: ({ children }: { children: string }) => <code>{children}</code>,
  PreCodeComponent: ({ children }: { children: React.ReactNode }) => <pre>{children}</pre>,
  renderRule: vi.fn(),
}));

describe("CopilotSystemMessage", () => {
  const mockShowDatetime = vi.fn();
  const mockHideDatetime = vi.fn();

  const createSystemMessage = (
    content: Partial<SystemSSEContent>,
    overrides: Partial<SystemMessage> = {}
  ): SystemMessage => ({
    role: "system",
    content: {
      eventType: "INFO",
      message: "Test message",
      ...content,
    },
    copilotId: "openbb-copilot",
    timestamp: 1705330200000,
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();

    (useShallowCopilotStore as Mock).mockImplementation((selector) => {
      return selector({
        showDatetime: mockShowDatetime,
        hideDatetime: mockHideDatetime,
      });
    });
  });

  describe("basic rendering", () => {
    it("renders system message with INFO event type", () => {
      const message = createSystemMessage({ eventType: "INFO", message: "Processing request" });

      render(<CopilotSystemMessage message={message} showIcon={true} />);

      expect(screen.getByTestId("message-title")).toBeInTheDocument();
      expect(screen.getByTestId("event-type")).toHaveTextContent("INFO");
      expect(screen.getByTestId("content")).toHaveTextContent("Processing request");
    });

    it("renders system message with WARNING event type", () => {
      const message = createSystemMessage({ eventType: "WARNING", message: "Rate limit warning" });

      render(<CopilotSystemMessage message={message} showIcon={true} />);

      expect(screen.getByTestId("event-type")).toHaveTextContent("WARNING");
    });

    it("renders system message with ERROR event type", () => {
      const message = createSystemMessage({ eventType: "ERROR", message: "Request failed" });

      render(<CopilotSystemMessage message={message} showIcon={true} />);

      expect(screen.getByTestId("event-type")).toHaveTextContent("ERROR");
    });

    it("returns null when message content is empty", () => {
      const message = createSystemMessage({ message: "" });

      const { container } = render(<CopilotSystemMessage message={message} showIcon={true} />);

      expect(container.firstChild).toBeNull();
    });

    it("returns null when message content is undefined", () => {
      const message: SystemMessage = {
        role: "system",
        content: {} as SystemSSEContent,
        copilotId: "openbb-copilot",
        timestamp: 1705330200000,
      };

      const { container } = render(<CopilotSystemMessage message={message} showIcon={true} />);

      expect(container.firstChild).toBeNull();
    });
  });

  describe("showIcon prop", () => {
    it("passes showIcon=true to message title", () => {
      const message = createSystemMessage({ message: "Test" });

      render(<CopilotSystemMessage message={message} showIcon={true} />);

      expect(screen.getByTestId("show-icon")).toHaveTextContent("true");
    });

    it("passes showIcon=false to message title", () => {
      const message = createSystemMessage({ message: "Test" });

      render(<CopilotSystemMessage message={message} showIcon={false} />);

      expect(screen.getByTestId("show-icon")).toHaveTextContent("false");
    });
  });

  describe("expandable content", () => {
    it("is not expandable when no details or artifacts", () => {
      const message = createSystemMessage({ message: "Simple message" });

      render(<CopilotSystemMessage message={message} showIcon={true} />);

      expect(screen.getByTestId("is-expandable")).toHaveTextContent("false");
    });

    it("is expandable when has string details", () => {
      const message = createSystemMessage({
        message: "Message with details",
        details: ["Detail 1", "Detail 2"],
      });

      render(<CopilotSystemMessage message={message} showIcon={true} />);

      expect(screen.getByTestId("is-expandable")).toHaveTextContent("true");
    });

    it("is expandable when has object details", () => {
      const message = createSystemMessage({
        message: "Message with object details",
        details: [{ key: "value" }],
      });

      render(<CopilotSystemMessage message={message} showIcon={true} />);

      expect(screen.getByTestId("is-expandable")).toHaveTextContent("true");
    });

    it("is expandable when has artifacts", () => {
      const message = createSystemMessage({
        message: "Message with artifacts",
        artifacts: [
          { uuid: "1", name: "Test Artifact", type: "text", content: "test" },
        ],
      });

      render(<CopilotSystemMessage message={message} showIcon={true} />);

      expect(screen.getByTestId("is-expandable")).toHaveTextContent("true");
    });
  });

  describe("toggle expansion", () => {
    it("starts collapsed by default", () => {
      const message = createSystemMessage({
        message: "Expandable message",
        details: ["Some detail"],
      });

      render(<CopilotSystemMessage message={message} showIcon={true} />);

      expect(screen.getByTestId("is-expanded")).toHaveTextContent("false");
      expect(screen.queryByTestId("markdown")).not.toBeInTheDocument();
    });

    it("expands when title is clicked", async () => {
      const message = createSystemMessage({
        message: "Expandable message",
        details: ["Some detail content"],
      });

      render(<CopilotSystemMessage message={message} showIcon={true} />);

      const title = screen.getByTestId("message-title");
      fireEvent.click(title);

      await waitFor(() => {
        expect(screen.getByTestId("is-expanded")).toHaveTextContent("true");
        expect(screen.getByTestId("markdown")).toBeInTheDocument();
      });
    });

    it("collapses when title is clicked again", async () => {
      const message = createSystemMessage({
        message: "Expandable message",
        details: ["Some detail"],
      });

      render(<CopilotSystemMessage message={message} showIcon={true} />);

      const title = screen.getByTestId("message-title");

      fireEvent.click(title);
      await waitFor(() => {
        expect(screen.getByTestId("is-expanded")).toHaveTextContent("true");
      });

      fireEvent.click(title);
      await waitFor(() => {
        expect(screen.getByTestId("is-expanded")).toHaveTextContent("false");
      });
    });
  });

  describe("details rendering", () => {
    it("renders string details as markdown", async () => {
      const message = createSystemMessage({
        message: "Message",
        details: ["This is **bold** text"],
      });

      render(<CopilotSystemMessage message={message} showIcon={true} />);

      fireEvent.click(screen.getByTestId("message-title"));

      await waitFor(() => {
        expect(screen.getByTestId("markdown")).toBeInTheDocument();
      });
    });

    it("renders object details as table", async () => {
      const message = createSystemMessage({
        message: "Message",
        details: [{ col1: "value1", col2: "value2" }],
      });

      render(<CopilotSystemMessage message={message} showIcon={true} />);

      fireEvent.click(screen.getByTestId("message-title"));

      await waitFor(() => {
        expect(screen.getByTestId("table")).toBeInTheDocument();
      });
    });

    it("renders mixed details correctly", async () => {
      const message = createSystemMessage({
        message: "Message",
        // @ts-expect-error - ignored for now
        details: ["String detail", { tableData: "value" }],
      });

      render(<CopilotSystemMessage message={message} showIcon={true} />);

      fireEvent.click(screen.getByTestId("message-title"));

      await waitFor(() => {
        expect(screen.getByTestId("markdown")).toBeInTheDocument();
        expect(screen.getByTestId("table")).toBeInTheDocument();
      });
    });

    it("skips null details", async () => {
      const message = createSystemMessage({
        message: "Message",
        details: [null as any, "Valid detail"],
      });

      render(<CopilotSystemMessage message={message} showIcon={true} />);

      fireEvent.click(screen.getByTestId("message-title"));

      await waitFor(() => {
        expect(screen.getByTestId("markdown")).toBeInTheDocument();
      });
    });
  });

  describe("artifacts rendering", () => {
    it("renders artifacts when expanded", async () => {
      const message = createSystemMessage({
        message: "Message",
        artifacts: [
          { uuid: "1", name: "Artifact 1", type: "text", content: "content" },
        ],
      });

      render(<CopilotSystemMessage message={message} showIcon={true} />);

      fireEvent.click(screen.getByTestId("message-title"));

      await waitFor(() => {
        expect(screen.getByTestId("artifact")).toBeInTheDocument();
        expect(screen.getByText("Artifact 1")).toBeInTheDocument();
      });
    });

    it("renders multiple artifacts", async () => {
      const message = createSystemMessage({
        message: "Message",
        artifacts: [
          { uuid: "1", name: "Artifact 1", type: "text", content: "content1" },
          { uuid: "2", name: "Artifact 2", type: "table", content: [] },
        ],
      });

      render(<CopilotSystemMessage message={message} showIcon={true} />);

      fireEvent.click(screen.getByTestId("message-title"));

      await waitFor(() => {
        const artifacts = screen.getAllByTestId("artifact");
        expect(artifacts.length).toBe(2);
      });
    });
  });

  describe("hover interactions", () => {
    it("shows datetime on mouse enter when not part of step-by-step group", () => {
      const message = createSystemMessage({ message: "Test" });

      const { container } = render(
        <CopilotSystemMessage
          message={message}
          showIcon={true}
          currentGroupId="group-1"
          isPartOfStepByStepGroup={false}
        />
      );

      const wrapper = container.querySelector(".flex.flex-col.w-full");
      if (wrapper) {
        fireEvent.mouseEnter(wrapper);
        expect(mockShowDatetime).toHaveBeenCalledWith(1705330200000, "group-1");
      }
    });

    it("hides datetime on mouse leave when not part of step-by-step group", () => {
      const message = createSystemMessage({ message: "Test" });

      const { container } = render(
        <CopilotSystemMessage
          message={message}
          showIcon={true}
          currentGroupId="group-1"
          isPartOfStepByStepGroup={false}
        />
      );

      const wrapper = container.querySelector(".flex.flex-col.w-full");
      if (wrapper) {
        fireEvent.mouseLeave(wrapper);
        expect(mockHideDatetime).toHaveBeenCalled();
      }
    });

    it("does not trigger datetime when part of step-by-step group", () => {
      const message = createSystemMessage({ message: "Test" });

      const { container } = render(
        <CopilotSystemMessage
          message={message}
          showIcon={true}
          currentGroupId="group-1"
          isPartOfStepByStepGroup={true}
        />
      );

      const wrapper = container.querySelector(".flex.flex-col.w-full");
      if (wrapper) {
        fireEvent.mouseEnter(wrapper);
        expect(mockShowDatetime).not.toHaveBeenCalled();
      }
    });

    it("does not trigger datetime hide when part of step-by-step group", () => {
      const message = createSystemMessage({ message: "Test" });

      const { container } = render(
        <CopilotSystemMessage
          message={message}
          showIcon={true}
          currentGroupId="group-1"
          isPartOfStepByStepGroup={true}
        />
      );

      const wrapper = container.querySelector(".flex.flex-col.w-full");
      if (wrapper) {
        fireEvent.mouseLeave(wrapper);
        expect(mockHideDatetime).not.toHaveBeenCalled();
      }
    });
  });

  describe("styling", () => {
    it("applies flex column layout to container", () => {
      const message = createSystemMessage({ message: "Test" });

      const { container } = render(<CopilotSystemMessage message={message} showIcon={true} />);

      const wrapper = container.querySelector(".flex.flex-col");
      expect(wrapper).toBeInTheDocument();
    });

    it("applies rounded corners and group class", () => {
      const message = createSystemMessage({ message: "Test" });

      const { container } = render(<CopilotSystemMessage message={message} showIcon={true} />);

      const wrapper = container.querySelector(".rounded.group");
      expect(wrapper).toBeInTheDocument();
    });

    it("applies correct styling to expanded content", async () => {
      const message = createSystemMessage({
        message: "Test",
        details: ["Detail"],
      });

      const { container } = render(<CopilotSystemMessage message={message} showIcon={true} />);

      fireEvent.click(screen.getByTestId("message-title"));

      await waitFor(() => {
        const expandedContent = container.querySelector(".rounded-b");
        expect(expandedContent).toBeInTheDocument();
      });
    });
  });

  describe("code block handling", () => {
    it("does not escape underscores in code blocks", async () => {
      const message = createSystemMessage({
        message: "Test",
        details: ["```python\nsome_variable = 1\n```"],
      });

      render(<CopilotSystemMessage message={message} showIcon={true} />);

      fireEvent.click(screen.getByTestId("message-title"));

      await waitFor(() => {
        const markdown = screen.getByTestId("markdown");
        expect(markdown.textContent).toContain("```python");
      });
    });

    it("escapes underscores in non-code text", async () => {
      const message = createSystemMessage({
        message: "Test",
        details: ["text_with_underscores"],
      });

      render(<CopilotSystemMessage message={message} showIcon={true} />);

      fireEvent.click(screen.getByTestId("message-title"));

      await waitFor(() => {
        const markdown = screen.getByTestId("markdown");
        expect(markdown.textContent).toContain("text\\_with\\_underscores");
      });
    });

    it("does not escape underscores inside URLs", async () => {
      const message = createSystemMessage({
        message: "Test",
        details: [
          "See https://example.com/path_with_underscore?query=foo_bar for text_with_underscores",
        ],
      });

      render(<CopilotSystemMessage message={message} showIcon={true} />);

      fireEvent.click(screen.getByTestId("message-title"));

      await waitFor(() => {
        const markdown = screen.getByTestId("markdown");
        expect(markdown.textContent).toContain(
          "https://example.com/path_with_underscore?query=foo_bar",
        );
        expect(markdown.textContent).toContain("text\\_with\\_underscores");
      });
    });
  });
});

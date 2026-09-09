import { render, screen } from "@testing-library/react";
import Markdown from "markdown-to-jsx";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import Artifact from "~/components/AI/Artifact";
import CopilotAIMessage from "~/components/AI/CopilotAIMessage";
import { useShallowStreamingStore } from "~/components/AI/hooks/useStreaming";
import {
  MarkdownAIMessageOverrides,
  renderRule,
} from "~/components/AI/MarkdownOverrides";
import type { AIMessage, ArtifactT, Citation } from "~/lib/state/copilot";
import { useShallowCopilotStore } from "~/lib/state/copilot";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("usehooks-ts", () => ({
  useLocalStorage: vi.fn((_key: string, defaultValue: any) => [defaultValue, vi.fn()]),
}));

vi.mock("~/lib/state/copilot", () => ({
  useShallowCopilotStore: vi.fn(),
}));

vi.mock("~/components/AI/hooks/useStreaming", () => ({
  useShallowStreamingStore: vi.fn(),
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

vi.mock("~/components/AI/Citation", () => ({
  default: ({ index, content: _content }: { index: number; content: Citation }) => (
    <span data-testid={`citation-${index}`}>[{index + 1}]</span>
  ),
}));

vi.mock("~/components/AI/CopilotFeedback", () => ({
  CopilotFeedback: ({ message: _message }: { message: AIMessage }) => (
    <div data-testid="feedback-component" />
  ),
}));

describe("Copilot markdown security", () => {
  const getCurrentChatArtifact = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useShallowStreamingStore as Mock).mockImplementation((selector) =>
      selector({ streamingStatus: "idle" }),
    );
    (useShallowCopilotStore as Mock).mockImplementation((selector) =>
      selector({
        showDatetime: vi.fn(),
        hideDatetime: vi.fn(),
        getCurrentChatArtifact,
        hoveredCitationWidgetId: null,
      }),
    );
  });

  function renderAiMessage(message: Partial<AIMessage>) {
    return render(
      <CopilotAIMessage
        isLastGroup={false}
        message={{
          role: "ai",
          content: "",
          copilotId: "openbb-copilot",
          timestamp: 1705330200000,
          citations: [],
          ...message,
        }}
      />,
    );
  }

  it("renders only the frontend-owned self-closing citation marker", () => {
    renderAiMessage({
      content:
        'Good <citation className="live-citation"/> bad <citation:dead-citation>',
      citations: [
        {
          id: "live-citation",
          source_info: { type: "widget", name: "Live Citation" },
          signature: "live-signature",
        },
        {
          id: "dead-citation",
          source_info: { type: "widget", name: "Dead Citation" },
          signature: "dead-signature",
        },
      ],
    });

    expect(screen.getByTestId("citation-0")).toBeInTheDocument();
    expect(screen.queryByTestId("citation-1")).not.toBeInTheDocument();
  });

  it("renders underscore-bearing artifact markers as artifacts", () => {
    getCurrentChatArtifact.mockImplementation((artifactId: string) => {
      if (artifactId !== "html_ff467074") return undefined;
      return {
        type: "html",
        uuid: "artifact-html-1",
        name: "html_ff467074",
        content: "<html><body><h1>Report</h1></body></html>",
        description: "HTML report",
      } satisfies ArtifactT;
    });

    const { container } = renderAiMessage({
      content: 'Created <artifact className="html_ff467074" />',
    });

    expect(
      screen.queryByText(/<artifact className="html_ff467074"/),
    ).not.toBeInTheDocument();
    expect(
      container.querySelector('iframe[title="html_ff467074"]'),
    ).toBeInTheDocument();
  });

  it("keeps ordinary raw HTML inert in AI messages", () => {
    const { container } = renderAiMessage({
      content:
        '<meta http-equiv="refresh" content="0;url=https://evil.example"><input value="spoof"><script>alert(1)</script>',
    });

    expect(container.querySelector("meta")).not.toBeInTheDocument();
    expect(container.querySelector("input")).not.toBeInTheDocument();
    expect(container.querySelector("script")).not.toBeInTheDocument();
    expect(screen.getByText(/<meta http-equiv="refresh"/)).toBeInTheDocument();
  });

  it("renders safe raw img tags through the frontend image policy", () => {
    const { container } = renderAiMessage({
      content:
        'Logo <img src="https://example.com/logo.png" alt="Example" onerror="alert(1)">',
    });

    const image = screen.getByRole("img", { name: "Example" });
    expect(image).toHaveAttribute("src", "https://example.com/logo.png");
    expect(image).not.toHaveAttribute("onerror");
    expect(container.querySelector("meta")).not.toBeInTheDocument();
  });

  it("allows base64 raster images but blocks svg data images in AI messages", () => {
    renderAiMessage({
      content:
        "Raster ![pixel](data:image/png;base64,aGVsbG8=) SVG ![svg](data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=)",
    });

    expect(screen.getByRole("img", { name: "pixel" })).toHaveAttribute(
      "src",
      "data:image/png;base64,aGVsbG8=",
    );
    expect(screen.queryByRole("img", { name: "svg" })).not.toBeInTheDocument();
  });

  it("blocks unsafe markdown links explicitly", () => {
    renderAiMessage({
      content: "[bad](javascript:alert(1)) [good](https://example.com)",
    });

    expect(screen.getByText("bad")).not.toHaveAttribute("href");
    expect(screen.getByRole("link", { name: "good" })).toHaveAttribute(
      "href",
      "https://example.com",
    );
  });

  it("does not re-enable raw HTML inside fenced markdown blocks", () => {
    const { container } = render(
      <Markdown
        options={{
          disableParsingRawHTML: true,
          renderRule,
          overrides: MarkdownAIMessageOverrides,
        }}
      >
        {
          '```markdown\n<meta http-equiv="refresh" content="0;url=https://evil.example"><input value="spoof">\n```'
        }
      </Markdown>,
    );

    expect(container.querySelector("meta")).not.toBeInTheDocument();
    expect(container.querySelector("input")).not.toBeInTheDocument();
    expect(screen.getByText(/<meta http-equiv="refresh"/)).toBeInTheDocument();
  });

  it("keeps raw HTML inert in text artifacts", () => {
    const artifact: ArtifactT = {
      type: "text",
      uuid: "artifact-1",
      name: "artifact-1",
      content: '<input value="spoof"><script>alert(1)</script>',
    };

    const { container } = render(<Artifact artifact={artifact} />);

    expect(container.querySelector("input")).not.toBeInTheDocument();
    expect(container.querySelector("script")).not.toBeInTheDocument();
    expect(screen.getByText(/<input value="spoof"/)).toBeInTheDocument();
  });
});

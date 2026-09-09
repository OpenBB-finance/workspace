import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { useWidgetContext } from "~/components/Widget.context";
import Markdown, { MarkdownContent } from "~/components/Widgets/custom/Markdown";
import { useJsonData } from "~/lib/api";

// Mock dependencies
vi.mock("~/components/Widget.context", () => ({
  useWidgetContext: vi.fn(),
}));

vi.mock("~/lib/api", () => ({
  useJsonData: vi.fn(),
}));

vi.mock("~/components/AI/Citation", () => ({
  default: ({ index }: { index: number }) => (
    <span data-testid={`citation-${index}`}>[{index + 1}]</span>
  ),
}));

vi.mock("~/components/AI/Artifact", () => ({
  default: ({ artifact }: { artifact: { uuid: string } }) => (
    <div data-testid={`artifact-${artifact.uuid}`} />
  ),
}));

vi.mock("~/components/DraggableCard", () => ({
  __esModule: true,
  default: ({ children, title }: { children: React.ReactNode; title: string }) => (
    <div data-testid="draggable-card">
      <h1>{title}</h1>
      {children}
    </div>
  ),
}));

describe("Markdown Component", () => {
  const mockWidget = {
    name: "Test Widget",
    storage: {
      text: "# Test Content",
    },
    endpoint: {
      url: "test-url",
      headers: {},
      method: "GET",
      query: {},
    },
    staleTime: 1000,
    refetchInterval: 2000,
  };

  const queryClient = new QueryClient();

  beforeEach(() => {
    vi.clearAllMocks();
    (useWidgetContext as Mock).mockReturnValue({ widget: mockWidget });
    (useJsonData as Mock).mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
      dataUpdatedAt: Date.now(),
    });
  });

  const renderWithQueryClient = (ui: React.ReactElement) => {
    return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
  };

  it("renders markdown content from widget storage when no API data", () => {
    renderWithQueryClient(<Markdown />);

    expect(screen.getByTestId("draggable-card")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Test Content" })).toBeInTheDocument();
  });

  it("renders markdown content from API data when available", () => {
    (useJsonData as Mock).mockReturnValue({
      data: "# API Content",
      isLoading: false,
      error: null,
      dataUpdatedAt: Date.now(),
    });

    renderWithQueryClient(<Markdown />);

    expect(screen.getByRole("heading", { name: "API Content" })).toBeInTheDocument();
  });

  it("sanitizes content properly", () => {
    const unsafeContent = '<script>alert("xss")</script><style>body{color:red}</style>';
    (useJsonData as Mock).mockReturnValue({
      data: unsafeContent,
      isLoading: false,
      error: null,
      dataUpdatedAt: Date.now(),
    });

    renderWithQueryClient(<Markdown />);

    const content = screen.getByTestId("draggable-card").textContent;
    expect(content).not.toContain("<script>");
    expect(content).not.toContain("<style>");
  });

  it("handles loading state", () => {
    (useJsonData as Mock).mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
      dataUpdatedAt: Date.now(),
    });

    renderWithQueryClient(<Markdown />);

    const card = screen.getByTestId("draggable-card");
    expect(card).toHaveTextContent("Test Widget");
  });

  it("handles error state", () => {
    (useJsonData as Mock).mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error("Test error"),
      dataUpdatedAt: Date.now(),
    });

    renderWithQueryClient(<Markdown />);

    const card = screen.getByTestId("draggable-card");
    expect(card).toHaveTextContent("Test Widget");
  });

  it("renders links with proper security attributes", () => {
    const contentWithLink = "[Test Link](https://example.com)";
    (useWidgetContext as Mock).mockReturnValue({
      widget: {
        ...mockWidget,
        storage: { text: contentWithLink },
      },
    });

    renderWithQueryClient(<Markdown />);

    expect(screen.getByRole("button", { name: "Test Link" })).toBeInTheDocument();
  });

  it("renders AI citation markers with the citation component", async () => {
    const citationId = "6a097e6b-1d8c-4647-9863-57b23b1e8ad4";

    render(
      <MarkdownContent
        content={`Revenue increased. <|start_citation_id|>${citationId}<|end_citation_id|>`}
        citations={[
          {
            id: citationId,
            source_info: {
              type: "widget",
              name: "Test Widget",
            },
            signature: "widget-signature",
          },
        ]}
      />,
    );

    expect(screen.getByText(/Revenue increased/)).toBeInTheDocument();
    expect(await screen.findByTestId("citation-0")).toHaveTextContent("[1]");
  });

  it("renders AI artifact markers with the artifact component", async () => {
    const artifactId = "table_artifact_6725b";

    render(
      <MarkdownContent
        content={`See table. <|start_artifact_id|>${artifactId}<|end_artifact_id|>`}
        artifacts={[
          {
            uuid: artifactId,
            name: artifactId,
            type: "table",
            content: [{ country: "United States", weight: 67.61 }],
          },
        ]}
      />,
    );

    expect(screen.getByText(/See table/)).toBeInTheDocument();
    expect(await screen.findByTestId(`artifact-${artifactId}`)).toBeInTheDocument();
  });

  it("keeps citation-like text intact when no citations or artifacts are provided", () => {
    render(<MarkdownContent content="Hello <citation>world</citation> done" />);

    expect(screen.getByText(/Hello/)).toBeInTheDocument();
    expect(screen.getByText(/world/)).toBeInTheDocument();
  });
});

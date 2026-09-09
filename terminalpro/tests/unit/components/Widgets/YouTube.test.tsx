import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import YouTube from "~/components/Widgets/YouTube";
import { renderWidget } from "./WidgetTestWrapper";

vi.mock("~/components/DraggableCard", () => ({
  default: ({
    children,
    elementNextToTitle,
    extraNavbarElements,
    loading,
    title,
  }: any) => (
    <div data-testid="draggable-card">
      {title && <span data-testid="title">{title}</span>}
      {loading && <span data-testid="loading">Loading...</span>}
      {elementNextToTitle}
      {extraNavbarElements}
      {children}
    </div>
  ),
}));

vi.mock("~/components/General/SearchResultsNotFound", () => ({
  default: ({ firstMessage, secondMessage, children }: any) => (
    <div data-testid="search-not-found">
      <span>{firstMessage}</span>
      <span>{secondMessage}</span>
      {children}
    </div>
  ),
}));

vi.mock("~/components/General/Table/NavBar/QueryParams", () => ({
  useWidgetParamsPositions: () => ({
    renderRow0Params: null,
    renderBelowNavbarRows: null,
  }),
}));

vi.mock("~/lib/state/theme", () => ({
  useShallowThemeStore: () => "dark",
}));

vi.mock("~/lib/api", () => ({
  useJsonData: (config: any, options: any) => {
    // If query is disabled or no URL, return loading state
    if (!options?.enabled || !config?.url) {
      return {
        data: undefined,
        isLoading: !!options?.enabled,
        error: null,
      };
    }
    // Return mock data based on params
    if (config.params?.raw === "true") {
      return {
        data: "# Test Transcript\n\nThis is transcript content.",
        isLoading: false,
        error: null,
      };
    }
    // For video URL query
    return {
      data: "https://www.youtube.com/watch?v=backendVideo123",
      isLoading: false,
      error: null,
    };
  },
}));

vi.mock("~/components/Widgets/custom/Markdown", () => ({
  default: ({ content }: any) => <div data-testid="markdown-default">{content}</div>,
  MarkdownContent: ({ content }: any) => (
    <div data-testid="markdown-content">{content}</div>
  ),
}));

describe("YouTube Widget", () => {
  it("renders empty state form when no URL provided", () => {
    renderWidget(<YouTube />, {
      widgetOverrides: { storage: {} },
    });

    expect(screen.getByTestId("draggable-card")).toBeInTheDocument();
    expect(screen.getByLabelText("YouTube URL")).toBeInTheDocument();
  });

  it("renders iframe when URL is provided", () => {
    renderWidget(<YouTube />, {
      widgetOverrides: {
        storage: { youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
      },
    });

    const iframe = document.querySelector("iframe");
    expect(iframe).toBeInTheDocument();
    expect(iframe).toHaveAttribute(
      "src",
      "https://www.youtube.com/embed/dQw4w9WgXcQ?enablejsapi=1",
    );
  });

  it("displays URL in button when URL is set", () => {
    renderWidget(<YouTube />, {
      widgetOverrides: {
        storage: { youtubeUrl: "https://www.youtube.com/watch?v=abc123" },
      },
    });

    expect(
      screen.getByText("https://www.youtube.com/watch?v=abc123"),
    ).toBeInTheDocument();
  });

  it("handles youtu.be short URLs", () => {
    renderWidget(<YouTube />, {
      widgetOverrides: {
        storage: { youtubeUrl: "https://youtu.be/shortId123" },
      },
    });

    const iframe = document.querySelector("iframe");
    expect(iframe).toBeInTheDocument();
    expect(iframe).toHaveAttribute(
      "src",
      "https://www.youtube.com/embed/shortId123?enablejsapi=1",
    );
  });

  it("handles embed URLs", () => {
    renderWidget(<YouTube />, {
      widgetOverrides: {
        storage: { youtubeUrl: "https://www.youtube.com/embed/embedId456" },
      },
    });

    const iframe = document.querySelector("iframe");
    expect(iframe).toBeInTheDocument();
    expect(iframe).toHaveAttribute(
      "src",
      "https://www.youtube.com/embed/embedId456?enablejsapi=1",
    );
  });

  it("hides transcript button when backend transcript not configured", () => {
    renderWidget(<YouTube />, {
      widgetOverrides: {
        storage: { youtubeUrl: "https://www.youtube.com/watch?v=test" },
      },
    });

    // Without backend endpoint + raw, transcript button should not be rendered
    const transcriptButton = document.querySelector(
      'button[class*="obb-small-navbar-btn"]',
    );
    expect(transcriptButton).not.toBeInTheDocument();
  });

  it("shows transcript button when backend transcript is configured", () => {
    renderWidget(<YouTube />, {
      widgetOverrides: {
        endpoint: { url: "https://api.example.com/video" },
        raw: true,
        storage: { youtubeUrl: "https://www.youtube.com/watch?v=test" },
      },
    });

    const transcriptButton = document.querySelector(
      'button[class*="obb-small-navbar-btn"]',
    );
    expect(transcriptButton).toBeInTheDocument();
  });

  it("toggles transcript view with backend transcript", async () => {
    const user = userEvent.setup();
    renderWidget(<YouTube />, {
      widgetOverrides: {
        endpoint: { url: "https://api.example.com/video" },
        raw: true,
        storage: { youtubeUrl: "https://www.youtube.com/watch?v=test123" },
      },
    });

    // Initially shows iframe (video view)
    expect(document.querySelector("iframe")).toBeInTheDocument();

    // Click transcript toggle button
    const transcriptButton = document.querySelector(
      'button[class*="obb-small-navbar-btn"]',
    );
    expect(transcriptButton).toBeInTheDocument();

    await user.click(transcriptButton!);

    // After clicking, should show transcript area (loading or content)
    await waitFor(() => {
      // The transcript view should be shown (either loading or "No transcript available")
      const transcriptArea = document.querySelector(".overflow-y-auto");
      expect(transcriptArea).toBeInTheDocument();
    });
  });

  it("renders video from backend endpoint in backend mode", () => {
    renderWidget(<YouTube />, {
      widgetOverrides: {
        endpoint: { url: "https://api.example.com/video" },
        storage: {},
      },
    });

    // Should render iframe with URL from backend (mocked as backendVideo123)
    const iframe = document.querySelector("iframe");
    expect(iframe).toBeInTheDocument();
    expect(iframe).toHaveAttribute(
      "src",
      "https://www.youtube.com/embed/backendVideo123?enablejsapi=1",
    );
  });
});

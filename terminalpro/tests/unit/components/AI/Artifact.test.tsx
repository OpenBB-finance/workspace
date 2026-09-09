import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import Artifact from "~/components/AI/Artifact";
import { useCopilotContext } from "~/lib/contexts/CopilotChatContext";
import type { ArtifactT } from "~/lib/state/copilot";
import { useThemeStore } from "~/lib/state/theme";

// Global mocks
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock dependencies
vi.mock("~/lib/contexts/CopilotChatContext", () => ({
  useCopilotContext: vi.fn(),
}));

const mockCreateWidget = vi.mocked(vi.fn());

vi.mock("~/components/AI/hooks/utils", async (importActual) => {
  const actual = (await importActual()) as object;
  return {
    ...actual,
    dispatchCreate: (...args: any[]) => mockCreateWidget(...args),
  };
});

describe("Artifact Component", () => {
  // Scoped mocks
  beforeEach(() => {
    vi.clearAllMocks();
    (useCopilotContext as Mock).mockReturnValue({ hoveredCitationElementId: "" });
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it("renders text artifact correctly", () => {
    const artifact: ArtifactT = {
      uuid: "123",
      type: "text",
      content: "This is a test\ntext artifact",
      name: "Test Text Artifact",
      description: "This is a test text artifact",
    };

    render(<Artifact artifact={artifact} />);

    expect(screen.getAllByText("This is a testtext artifact")[0]).toBeInTheDocument();

    const createWidgetButton = screen.getByTestId("create-widget-from-text-button");
    fireEvent.click(createWidgetButton);
    expect(mockCreateWidget).toHaveBeenCalledWith({
      widgetType: "text",
      content: "This is a test  \ntext artifact",
      metadata: {
        uuid: "123",
        name: "Test Text Artifact",
        description: "This is a test text artifact",
      },
    });
  });

  it("renders table artifact correctly", async () => {
    const artifact: ArtifactT = {
      uuid: "123",
      type: "table",
      content: [{ col1: "data1", col2: "data2" }],
      name: "Test Table Artifact",
      description: "This is a test table artifact",
    };

    render(<Artifact artifact={artifact} />);

    expect(screen.getByText("data1")).toBeInTheDocument();
    expect(screen.getByText("data2")).toBeInTheDocument();

    const copyTableButton = screen.getByTestId("copy-table-button");
    fireEvent.click(copyTableButton);

    // The clipboard and toast are called in the same tick, so we need to wrap both into the same waitFor
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledTimes(1);
    });

    const createWidgetButton = screen.getByTestId("create-widget-from-table-button");
    fireEvent.click(createWidgetButton);
    expect(mockCreateWidget).toHaveBeenCalledWith({
      widgetType: "table",
      content: [{ col1: "data1", col2: "data2" }],
      metadata: {
        uuid: "123",
        name: "Test Table Artifact",
        description: "This is a test table artifact",
      },
    });
  });

  it("inherits decimalDigits formatting and readable headers in table artifacts", () => {
    // decimalDigits is an admin/user display setting on the theme store; the table
    // artifact must format numbers + humanize headers the same way widget tables do.
    useThemeStore.setState({ decimalDigits: 0 });

    const artifact: ArtifactT = {
      uuid: "fmt-1",
      type: "table",
      content: [{ market_cap: 1234.5678 }],
      name: "Numeric Table Artifact",
      description: "table with a numeric column",
    };

    render(<Artifact artifact={artifact} />);

    // decimalDigits=0 from the store -> "1,235", not the raw "1234.5678"
    expect(screen.getByText("1,235")).toBeInTheDocument();
    // snake_case key -> humanized header label
    expect(screen.getByText("Market Cap")).toBeInTheDocument();
  });

  it("keeps html artifacts in AI messages on the default height cap", async () => {
    const artifact: ArtifactT = {
      uuid: "html-123",
      type: "html",
      content: "<html><body><h1>Report</h1></body></html>",
      name: "Test HTML Artifact",
      description: "This is a test HTML artifact",
    };

    const { container } = render(<Artifact artifact={artifact} inAiMessage={true} />);
    const iframe = container.querySelector("iframe") as HTMLIFrameElement;
    const doc = iframe.contentDocument;

    Object.defineProperty(doc?.documentElement, "scrollHeight", {
      configurable: true,
      value: 2000,
    });
    Object.defineProperty(doc?.body, "scrollHeight", {
      configurable: true,
      value: 2000,
    });

    fireEvent.load(iframe);

    await waitFor(() => {
      expect(iframe).toHaveStyle({ height: "600px" });
    });
  });

  it("keeps html artifacts outside AI messages on the default height cap", async () => {
    const artifact: ArtifactT = {
      uuid: "html-456",
      type: "html",
      content: "<html><body><h1>Report</h1></body></html>",
      name: "Standalone HTML Artifact",
      description: "This is a standalone HTML artifact",
    };

    const { container } = render(<Artifact artifact={artifact} />);
    const iframe = container.querySelector("iframe") as HTMLIFrameElement;
    const doc = iframe.contentDocument;

    Object.defineProperty(doc?.documentElement, "scrollHeight", {
      configurable: true,
      value: 2000,
    });
    Object.defineProperty(doc?.body, "scrollHeight", {
      configurable: true,
      value: 2000,
    });

    fireEvent.load(iframe);

    await waitFor(() => {
      expect(iframe).toHaveStyle({ height: "600px" });
    });
  });

  it("returns null for unsupported artifact types", async () => {
    // @ts-expect-error - This is to test that the component returns null for unsupported artifact types
    const artifact: ArtifactT = { type: "unsupported", content: "Some content" };

    const { container } = render(<Artifact artifact={artifact} />);
    await expect(container.firstChild).toBeNull();
  });
});

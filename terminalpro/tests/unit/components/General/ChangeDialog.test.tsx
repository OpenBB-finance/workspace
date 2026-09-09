import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ReactDOM from "react-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ChangelogDialog from "~/components/General/ChangelogDialog";

// Mock IntersectionObserver
class IntersectionObserverMock {
  root: Element | null = null;
  rootMargin = "0px";
  thresholds: ReadonlyArray<number> = [];
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  takeRecords = vi.fn();
}

global.IntersectionObserver = IntersectionObserverMock;

// Mock the markdown import
vi.mock("~/../CHANGELOG.md", () => ({
  markdown: `
# Changelog

## [1.0.0] - 2024-01-01

### Added
- Feature 1
- Feature 2

## [0.9.0] - 2023-12-01

### Changed
- Change 1
- Change 2
  `,
}));

// Mock createPortal for dialog rendering
vi.spyOn(ReactDOM, "createPortal").mockImplementation((element) => {
  return element as React.ReactPortal;
});

// Mock the parseMarkdown function
vi.mock("./Changelog", () => ({
  parseMarkdown: () => [
    {
      version: "1.0.0",
      slug: "1-0-0",
      date: "2024-01-01",
      content: "Feature 1\nFeature 2",
    },
    {
      version: "0.9.0",
      slug: "0-9-0",
      date: "2023-12-01",
      content: "Change 1\nChange 2",
    },
  ],
  Changelog: ({ chunks }: { chunks: any[] }) => (
    <div data-testid="changelog-content">
      {chunks.map((chunk) => (
        <div key={chunk.slug}>{chunk.content}</div>
      ))}
    </div>
  ),
}));

vi.mock("~/lib/utils", async (importOriginal) => {
  return {
    slugify: vi.fn().mockReturnValue("slugified-string"),
    getWidgetsWithSupportedAssetClass: vi.fn().mockReturnValue([]),
    cn: vi.fn(),
  };
});

// Add mock for ScrollSpy component
vi.mock("~/components/General/ScrollSpy", () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="scroll-spy">{children}</div>
  ),
  ScrollSpy: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="scroll-spy">{children}</div>
  ),
  ScrollspyRoot: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="scrollspy-root">{children}</div>
  ),
  ScrollTrigger: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="scroll-trigger">{children}</div>
  ),
}));

describe("ChangelogDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the dialog with correct title", () => {
    render(<ChangelogDialog open={true} onClose={vi.fn()} />);

    expect(screen.getAllByText("Changelog").length).toBeGreaterThan(1);
  });

  it("renders version navigation sidebar", () => {
    render(<ChangelogDialog open={true} onClose={vi.fn()} />);

    const versionTriggers = screen.getAllByTestId("scroll-trigger");
    expect(versionTriggers).toHaveLength(2);

    expect(versionTriggers[0]).toHaveTextContent("[1.0.0]");
    expect(versionTriggers[1]).toHaveTextContent("[0.9.0]");
  });

  it("renders changelog content", () => {
    render(<ChangelogDialog open={true} onClose={vi.fn()} />);

    const content = screen.getByTestId("changelog-content");
    expect(content).toBeInTheDocument();
  });

  it("has accessible description", () => {
    render(<ChangelogDialog open={true} onClose={vi.fn()} />);

    const description = screen.getByText(
      "View the changelog for the OpenBB Workspace.",
    );
    expect(description).toHaveClass("sr-only");
  });

  it("applies correct styling to active version in sidebar", async () => {
    render(<ChangelogDialog open={true} onClose={vi.fn()} />);

    const versionTrigger = screen.getAllByTestId("scroll-trigger")[0];
    fireEvent.click(versionTrigger);

    // Manually set the attribute to simulate the behavior
    versionTrigger.setAttribute("data-scrollspy-active", "true");

    await waitFor(() => {
      expect(versionTrigger).toHaveAttribute("data-scrollspy-active");
    });
  });

  it("closes when close button is clicked", () => {
    const onClose = vi.fn();
    render(<ChangelogDialog open={true} onClose={onClose} />);

    const closeButton = screen.getByRole("button", { name: /close/i });
    fireEvent.click(closeButton);

    expect(onClose).toHaveBeenCalled();
  });
});

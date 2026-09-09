import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import RssViewer from "~/components/Widgets/RssViewer";
import { renderWidget } from "./WidgetTestWrapper";

vi.mock("~/components/DraggableCard", () => ({
  default: ({ children, loading, error, title }: any) => (
    <div data-testid="draggable-card">
      {title && <span data-testid="title">{title}</span>}
      {loading && <span data-testid="loading">Loading...</span>}
      {error && <span data-testid="error">Error</span>}
      {children}
    </div>
  ),
}));

vi.mock("~/components/Widgets/RssViewerHelpers/ContentTab", () => ({
  default: () => <div data-testid="content-tab">RSS Content</div>,
}));

vi.mock("~/components/Widgets/RssViewerHelpers/ManageFeedsTab", () => ({
  default: () => <div data-testid="manage-feeds-tab">Manage Feeds</div>,
}));

vi.mock("@radix-ui/react-tabs", () => ({
  Root: ({ children }: any) => <div data-testid="tabs-root">{children}</div>,
  List: ({ children }: any) => <div data-testid="tabs-list">{children}</div>,
  Trigger: ({ children, value }: any) => (
    <button data-testid={`tab-${value}`}>{children}</button>
  ),
  Content: ({ children, value }: any) => (
    <div data-testid={`tab-content-${value}`}>{children}</div>
  ),
}));

describe("RssViewer Widget", () => {
  it("renders RSS viewer container", () => {
    renderWidget(<RssViewer />, {
      widgetOverrides: {
        storage: { feeds: [] },
      },
    });

    expect(screen.getByTestId("draggable-card")).toBeInTheDocument();
  });

  it("renders tabs", () => {
    renderWidget(<RssViewer />, {
      widgetOverrides: {
        storage: { feeds: [] },
      },
    });

    expect(screen.getByTestId("tabs-root")).toBeInTheDocument();
  });

  it("renders Content tab", () => {
    renderWidget(<RssViewer />, {
      widgetOverrides: {
        storage: { feeds: [] },
      },
    });

    expect(screen.getByTestId("content-tab")).toBeInTheDocument();
  });
});

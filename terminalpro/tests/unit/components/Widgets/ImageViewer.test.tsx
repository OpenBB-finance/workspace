import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ImageViewer from "~/components/Widgets/ImageViewer";
import { useJsonData } from "~/lib/api";
import { renderWidget } from "./WidgetTestWrapper";

vi.mock("~/lib/api", () => ({
  useJsonData: vi.fn(),
}));

vi.mock("~/components/DraggableCard", () => {
  const DraggableCard = ({ children, loading, error }: any) => (
    <div data-testid="draggable-card">
      {loading && <span>Loading...</span>}
      {error && <span>Error</span>}
      {children}
    </div>
  );
  const SetLoadingOnResize = ({ children }: any) => <div>{children}</div>;
  return {
    default: DraggableCard,
    SetLoadingOnResize: SetLoadingOnResize,
  };
});

describe("ImageViewer Widget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders image once loaded", () => {
    vi.mocked(useJsonData).mockReturnValue({
      isLoading: false,
      data: "blob:mock-url",
      isError: false,
    } as any);

    renderWidget(<ImageViewer />, {
      widgetOverrides: { name: "Test Image", endpoint: { url: "test.png" } },
    });

    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", "blob:mock-url");
    expect(img).toHaveAttribute("alt", "Test Image");
  });

  it("shows loading state", () => {
    vi.mocked(useJsonData).mockReturnValue({
      isLoading: true,
      data: null,
      isError: false,
    } as any);

    renderWidget(<ImageViewer />, {
      widgetOverrides: { name: "Test Image", endpoint: { url: "test.png" } },
    });

    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });
});

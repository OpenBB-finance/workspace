import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import Sidebar from "~/components/General/Sidebar";

vi.mock("~/lib/onPremFeatureFlags", async (importOriginal) => {
  const actual = await importOriginal<typeof import("~/lib/onPremFeatureFlags")>();
  return {
    ...actual,
    getShowDemoRequestButton: () => true,
  };
});

vi.mock("~/lib/state/theme", () => ({
  useShallowThemeStore: (selector: any) =>
    selector({
      setBookingOpen: vi.fn(),
      bookingOpen: false,
    }),
}));

vi.mock("~/components/General/Feedback", () => ({
  default: () => <div data-testid="feedback">Feedback</div>,
}));

vi.mock("~/components/General/ChangelogDialog", () => ({
  default: () => null,
}));

vi.mock("~/components/Tooltip", () => ({
  default: ({ children }: any) => <div data-testid="tooltip">{children}</div>,
}));

vi.mock("~/components/ds/dialogs/BaseDialog", () => ({
  BaseDialog: ({ children, open }: any) =>
    open ? <div data-testid="base-dialog">{children}</div> : null,
  DialogContent: ({ children }: any) => <div>{children}</div>,
}));

const renderSidebar = (props = {}) => {
  return render(
    <BrowserRouter>
      <Sidebar {...props}>
        <div data-testid="sidebar-children">Sidebar content</div>
      </Sidebar>
    </BrowserRouter>,
  );
};

describe("Sidebar", () => {
  it("renders basic sidebar structure", () => {
    renderSidebar();

    expect(screen.getByTestId("sidebar-children")).toBeInTheDocument();
  });

  it("renders header when provided", () => {
    renderSidebar({
      header: <div data-testid="custom-header">Custom Header</div>,
    });

    expect(screen.getByTestId("custom-header")).toBeInTheDocument();
  });

  it("renders search when provided", () => {
    renderSidebar({
      search: <input data-testid="search-input" placeholder="Search" />,
    });

    expect(screen.getByTestId("search-input")).toBeInTheDocument();
  });

  it("renders children content", () => {
    renderSidebar();

    expect(screen.getByText("Sidebar content")).toBeInTheDocument();
  });

  it("renders feedback component", () => {
    renderSidebar();

    expect(screen.getByTestId("feedback")).toBeInTheDocument();
  });
});

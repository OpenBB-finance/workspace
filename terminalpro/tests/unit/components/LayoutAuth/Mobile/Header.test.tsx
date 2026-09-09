import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MobileHeader from "~/components/LayoutAuth/Mobile/Header";

const mockGetTabById = vi.fn();
let mockConfig = {
  whiteLabel: {
    leftSidebarLogo: "",
    leftSidebarLogoDark: "",
    name: "",
  },
};

vi.mock("~/lib/state/app", () => ({
  useShallowAppStore: vi.fn((selector) =>
    selector({
      getTabById: mockGetTabById,
    }),
  ),
}));

vi.mock("~/lib/state/theme", () => ({
  useShallowThemeStore: vi.fn((selector) => selector({ theme: "light" })),
}));

vi.mock("~/lib/runtimeConfig", () => ({
  getConfig: () => mockConfig,
}));

vi.mock("~/components/Icon", () => ({
  default: ({ id, className }: { id: string; className?: string }) => (
    <span data-testid={`icon-${id}`} className={className} />
  ),
}));

function renderHeader(path = "/app/dashboard-1") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/app/:id" element={<MobileHeader />} />
        <Route path="/app" element={<MobileHeader />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("MobileHeader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTabById.mockReturnValue(null);
    mockConfig = {
      whiteLabel: {
        leftSidebarLogo: "",
        leftSidebarLogoDark: "",
        name: "",
      },
    };
  });

  it("renders default title when no active tab", () => {
    mockGetTabById.mockReturnValue(null);
    renderHeader();

    expect(screen.getByText("OpenBB Workspace")).toBeInTheDocument();
  });

  it("renders tab name when activeTab has data.name", () => {
    mockGetTabById.mockReturnValue({ data: { name: "My Dashboard" } });
    renderHeader();

    expect(screen.getByText("My Dashboard")).toBeInTheDocument();
    expect(screen.queryByText("OpenBB Workspace")).not.toBeInTheDocument();
  });

  it("renders white-label logo as img when leftSidebarLogo is set", () => {
    mockConfig = {
      whiteLabel: {
        leftSidebarLogo: "https://example.com/logo.png",
        leftSidebarLogoDark: "",
        name: "Acme Corp",
      },
    };
    renderHeader();

    const img = screen.getByAltText("Acme Corp");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "https://example.com/logo.png");
  });

  it("swaps to dark logo when theme is dark and leftSidebarLogoDark is set", async () => {
    const { useShallowThemeStore } = await import("~/lib/state/theme");
    vi.mocked(useShallowThemeStore).mockImplementation((selector: Function) =>
      selector({ theme: "dark" }),
    );
    mockConfig = {
      whiteLabel: {
        leftSidebarLogo: "https://example.com/logo-light.png",
        leftSidebarLogoDark: "https://example.com/logo-dark.png",
        name: "Acme Corp",
      },
    };
    renderHeader();

    const img = screen.getByAltText("Acme Corp");
    expect(img).toHaveAttribute("src", "https://example.com/logo-dark.png");
  });

  it("renders fallback icon when no leftSidebarLogo", () => {
    renderHeader();

    expect(screen.getByTestId("icon-minimal-logo-icon")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("logo links to /app", () => {
    renderHeader();

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/app");
  });
});

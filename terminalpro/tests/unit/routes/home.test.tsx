import { render } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import HomePage from "~/routes/home";

const mockNavigate = vi.fn();

// The real `useShallowAuthStore` compares with `isEqual`, so the selected value keeps
// its identity across renders. A fresh object literal per render would not.
const LOGGED_IN_USER = { email: "test@test.com" };

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("~/lib/state/auth", () => ({
  useShallowAuthStore: vi.fn(),
}));

describe("HomePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to /app when user is logged in", async () => {
    const { useShallowAuthStore } = await import("~/lib/state/auth");
    vi.mocked(useShallowAuthStore).mockImplementation((selector: any) =>
      selector({ user: LOGGED_IN_USER }),
    );

    render(
      <BrowserRouter>
        <HomePage />
      </BrowserRouter>,
    );

    expect(mockNavigate).toHaveBeenCalledWith("/app", { replace: true });
  });

  it("redirects to /login when user is not logged in", async () => {
    const { useShallowAuthStore } = await import("~/lib/state/auth");
    vi.mocked(useShallowAuthStore).mockImplementation((selector: any) =>
      selector({ user: null }),
    );

    render(
      <BrowserRouter>
        <HomePage />
      </BrowserRouter>,
    );

    expect(mockNavigate).toHaveBeenCalledWith("/login", { replace: true });
  });

  // Regression guard: the redirect effect had no dependency array, so it re-fired on
  // every render. Each run was a history push, which under react-router v7's
  // transition-wrapped location updates can outrun the commit and spin.
  it("issues the redirect once, even across re-renders", async () => {
    const { useShallowAuthStore } = await import("~/lib/state/auth");
    vi.mocked(useShallowAuthStore).mockImplementation((selector: any) =>
      selector({ user: LOGGED_IN_USER }),
    );

    const { rerender } = render(
      <BrowserRouter>
        <HomePage />
      </BrowserRouter>,
    );
    rerender(
      <BrowserRouter>
        <HomePage />
      </BrowserRouter>,
    );

    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  // "/" only ever redirects, so leaving it on the stack makes Back bounce the user
  // straight forward again.
  it("replaces the entry for / instead of pushing", async () => {
    const { useShallowAuthStore } = await import("~/lib/state/auth");
    vi.mocked(useShallowAuthStore).mockImplementation((selector: any) =>
      selector({ user: LOGGED_IN_USER }),
    );

    render(
      <BrowserRouter>
        <HomePage />
      </BrowserRouter>,
    );

    expect(mockNavigate).toHaveBeenCalledWith("/app", { replace: true });
  });

  it("renders null (no visible content)", async () => {
    const { useShallowAuthStore } = await import("~/lib/state/auth");
    vi.mocked(useShallowAuthStore).mockImplementation((selector: any) =>
      selector({ user: null }),
    );

    const { container } = render(
      <BrowserRouter>
        <HomePage />
      </BrowserRouter>,
    );

    expect(container.innerHTML).toBe("");
  });
});

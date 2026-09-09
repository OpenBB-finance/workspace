import { render } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminHome from "~/routes/admin/index";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("~/lib/state/auth", () => ({
  useAuthStore: vi.fn(() => ({ user: null })),
}));

describe("AdminHome", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to /admin/users when user is logged in", async () => {
    const { useAuthStore } = await import("~/lib/state/auth");
    vi.mocked(useAuthStore).mockReturnValue({ user: { email: "admin@test.com" } });

    render(
      <BrowserRouter>
        <AdminHome />
      </BrowserRouter>,
    );

    expect(mockNavigate).toHaveBeenCalledWith("/admin/users");
  });

  it("redirects to /login when user is not logged in", async () => {
    const { useAuthStore } = await import("~/lib/state/auth");
    vi.mocked(useAuthStore).mockReturnValue({ user: null });

    render(
      <BrowserRouter>
        <AdminHome />
      </BrowserRouter>,
    );

    expect(mockNavigate).toHaveBeenCalledWith("/login");
  });

  it("renders null (no visible content)", async () => {
    const { useAuthStore } = await import("~/lib/state/auth");
    vi.mocked(useAuthStore).mockReturnValue({ user: null });

    const { container } = render(
      <BrowserRouter>
        <AdminHome />
      </BrowserRouter>,
    );

    expect(container.innerHTML).toBe("");
  });
});

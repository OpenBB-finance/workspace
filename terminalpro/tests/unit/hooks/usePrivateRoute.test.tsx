import { renderHook, waitFor } from "@testing-library/react";
import { act, type ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrivateRoute } from "~/hooks/usePrivateRoute";
import { useAuthStore } from "~/lib/state/auth";

// Mock validateUser API
vi.mock("~/api/auth.api", () => ({
  validateUser: vi.fn(),
}));

// Mock react-router-dom's useNavigate
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

import { validateUser } from "~/api/auth.api";

const wrapper = ({ children }: { children: ReactNode }) => (
  <MemoryRouter>{children}</MemoryRouter>
);

describe("usePrivateRoute", () => {
  const mockLogout = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset auth store to logged out state
    useAuthStore.setState({
      user: null,
      needsOnboarding: false,
      logout: mockLogout,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("when user is not logged in", () => {
    it("should call logout when user is null", () => {
      useAuthStore.setState({ user: null });

      renderHook(() => usePrivateRoute(), { wrapper });

      expect(mockLogout).toHaveBeenCalled();
    });

    it("should not call validateUser when user is null", () => {
      useAuthStore.setState({ user: null });

      renderHook(() => usePrivateRoute(), { wrapper });

      expect(validateUser).not.toHaveBeenCalled();
    });
  });

  describe("when user is logged in", () => {
    const mockUser = {
      email: "test@example.com",
      username: "testuser",
      token: "valid-token",
      entity_name: null,
      role: null,
      uuid: "uuid-123",
    };

    beforeEach(() => {
      useAuthStore.setState({
        user: mockUser,
        needsOnboarding: false,
        logout: mockLogout,
      });
    });

    it("should call validateUser when shouldValidate is true", async () => {
      (validateUser as any).mockResolvedValue({ success: true });

      renderHook(() => usePrivateRoute(true), { wrapper });

      await waitFor(() => {
        expect(validateUser).toHaveBeenCalled();
      });
    });

    it("should not call validateUser when shouldValidate is false", () => {
      renderHook(() => usePrivateRoute(false), { wrapper });

      expect(validateUser).not.toHaveBeenCalled();
    });

    it("should not logout when token is valid", async () => {
      (validateUser as any).mockResolvedValue({ success: true });

      renderHook(() => usePrivateRoute(true), { wrapper });

      await waitFor(() => {
        expect(validateUser).toHaveBeenCalled();
      });

      expect(mockLogout).not.toHaveBeenCalled();
    });

    it("should logout when token is invalid", async () => {
      (validateUser as any).mockResolvedValue({ success: false });

      renderHook(() => usePrivateRoute(true), { wrapper });

      await waitFor(() => {
        expect(mockLogout).toHaveBeenCalled();
      });
    });

    it("should navigate to onboarding when needsOnboarding and token invalid", async () => {
      useAuthStore.setState({
        user: mockUser,
        needsOnboarding: true,
        logout: mockLogout,
      });

      (validateUser as any).mockResolvedValue({ success: false });

      renderHook(() => usePrivateRoute(true), { wrapper });

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith("/onboarding");
      });
    });

    it("should logout when validateUser throws error", async () => {
      (validateUser as any).mockRejectedValue(new Error("Network error"));

      renderHook(() => usePrivateRoute(true), { wrapper });

      await waitFor(() => {
        expect(mockLogout).toHaveBeenCalled();
      });
    });
  });

  describe("default behavior", () => {
    it("should validate by default (shouldValidate defaults to true)", async () => {
      useAuthStore.setState({
        user: {
          email: "test@example.com",
          username: "testuser",
          token: "valid-token",
          entity_name: null,
          role: null,
          uuid: "uuid-123",
        },
        logout: mockLogout,
      });

      (validateUser as any).mockResolvedValue({ success: true });

      renderHook(() => usePrivateRoute(), { wrapper });

      await waitFor(() => {
        expect(validateUser).toHaveBeenCalled();
      });
    });
  });

  describe("effect dependencies", () => {
    it("should re-run effect when user changes", async () => {
      (validateUser as any).mockResolvedValue({ success: true });

      const { rerender } = renderHook(() => usePrivateRoute(true), { wrapper });

      // Initially logged out
      act(() => {
        useAuthStore.setState({ user: null, logout: mockLogout });
      });
      rerender();

      expect(mockLogout).toHaveBeenCalled();
      vi.clearAllMocks();

      // Then log in
      act(() => {
        useAuthStore.setState({
          user: {
            email: "test@example.com",
            username: "testuser",
            token: "new-token",
            entity_name: null,
            role: null,
            uuid: "uuid-456",
          },
          logout: mockLogout,
        });
      });
      rerender();

      await waitFor(() => {
        expect(validateUser).toHaveBeenCalled();
      });
    });
  });
});

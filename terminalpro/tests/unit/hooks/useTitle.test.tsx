/**
 * Tests for useGlobalTitleManager hook
 */

import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import useGlobalTitleManager from "~/hooks/useTitle";

// Mock react-router-dom
const mockUseLocation = vi.fn();
const mockUseMatches = vi.fn();
vi.mock("react-router-dom", () => ({
  useLocation: () => mockUseLocation(),
  useMatches: () => mockUseMatches(),
}));

// Mock runtimeConfig
const mockGetConfig = vi.fn();
vi.mock("~/lib/runtimeConfig", () => ({
  getConfig: () => mockGetConfig(),
}));

// Mock appState store
const mockUseShallowAppStore = vi.fn();
vi.mock("~/lib/state/app", () => ({
  useShallowAppStore: (selector: any) => mockUseShallowAppStore(selector),
}));

// Mock sharedAppState store
const mockUseShallowSharedAppStore = vi.fn();
vi.mock("~/lib/state/sharedApp", () => ({
  useShallowSharedAppStore: (selector: any) => mockUseShallowSharedAppStore(selector),
}));

describe("useGlobalTitleManager", () => {
  const originalTitle = document.title;

  beforeEach(() => {
    vi.clearAllMocks();
    document.title = "Initial Title";

    // Set default config
    mockGetConfig.mockReturnValue({
      whiteLabel: {
        name: undefined,
      },
    });

    // Set default location and matches
    mockUseLocation.mockReturnValue({ pathname: "/" });
    mockUseMatches.mockReturnValue([]);

    // Default store mocks (empty)
    mockUseShallowAppStore.mockImplementation((selector) => selector({}));
    mockUseShallowSharedAppStore.mockImplementation((selector) => selector({}));
  });

  afterEach(() => {
    document.title = originalTitle;
  });

  it("should set default brand name when path is root", () => {
    mockUseLocation.mockReturnValue({ pathname: "/" });

    renderHook(() => useGlobalTitleManager());

    expect(document.title).toBe("OpenBB Workspace");
  });

  it("should set custom brand name when path is root and white label name is configured", () => {
    mockUseLocation.mockReturnValue({ pathname: "/" });
    mockGetConfig.mockReturnValue({
      whiteLabel: {
        name: "My custom brand",
      },
    });

    renderHook(() => useGlobalTitleManager());

    expect(document.title).toBe("My custom brand");
  });

  it("should format static page titles correctly", () => {
    mockUseLocation.mockReturnValue({ pathname: "/login" });

    renderHook(() => useGlobalTitleManager());

    expect(document.title).toBe("Login | OpenBB Workspace");
  });

  it("should respect custom brand name in static page titles", () => {
    mockUseLocation.mockReturnValue({ pathname: "/app/settings" });
    mockGetConfig.mockReturnValue({
      whiteLabel: {
        name: "Custom Enterprise",
      },
    });

    renderHook(() => useGlobalTitleManager());

    expect(document.title).toBe("Settings | Custom Enterprise");
  });

  it("should resolve dynamic tab titles from standard app store", () => {
    mockUseLocation.mockReturnValue({ pathname: "/app/tab123" });
    mockUseMatches.mockReturnValue([
      { pathname: "/app/tab123", params: { id: "tab123" } },
    ]);

    mockUseShallowAppStore.mockImplementation((selector) =>
      selector({
        items: {
          tab123: { data: { name: "Dashboard alpha" } },
        },
      }),
    );

    renderHook(() => useGlobalTitleManager());

    expect(document.title).toBe("Dashboard alpha | OpenBB Workspace");
  });

  it("should resolve dynamic tab titles from shared app store", () => {
    mockUseLocation.mockReturnValue({ pathname: "/app/tab456" });
    mockUseMatches.mockReturnValue([
      { pathname: "/app/tab456", params: { id: "tab456" } },
    ]);

    // Regular store returns undefined
    mockUseShallowAppStore.mockImplementation((selector) => selector({}));

    // Shared store returns tab
    mockUseShallowSharedAppStore.mockImplementation((selector) =>
      selector({
        sharedItems: {
          tab456: { data: { name: "Shared Dashboard" } },
        },
      }),
    );

    renderHook(() => useGlobalTitleManager());

    expect(document.title).toBe("Shared Dashboard | OpenBB Workspace");
  });
});

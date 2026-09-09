import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MobileProvider } from "~/lib/providers/MobileProvider";

vi.mock("~/hooks/useIsMobile");
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useLocation: () => ({ pathname: "/app" }) };
});

import useIsMobile from "~/hooks/useIsMobile";

const mockUseIsMobile = vi.mocked(useIsMobile);

const renderProvider = () =>
  render(
    <MemoryRouter>
      <MobileProvider>
        <div>test</div>
      </MobileProvider>
    </MemoryRouter>,
  );

describe("MobileProvider visualViewport resize listener", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.documentElement.style.removeProperty("--mobile-viewport-height");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not set --mobile-viewport-height when not mobile", () => {
    mockUseIsMobile.mockReturnValue(false);

    renderProvider();

    expect(
      document.documentElement.style.getPropertyValue("--mobile-viewport-height"),
    ).toBe("");
  });

  it("sets --mobile-viewport-height on mount when mobile", () => {
    mockUseIsMobile.mockReturnValue(true);

    const mockVisualViewport = {
      height: 700,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    Object.defineProperty(window, "visualViewport", {
      value: mockVisualViewport,
      writable: true,
    });

    renderProvider();

    expect(
      document.documentElement.style.getPropertyValue("--mobile-viewport-height"),
    ).toBe("700px");
  });

  it("updates --mobile-viewport-height when visualViewport fires a resize event", () => {
    mockUseIsMobile.mockReturnValue(true);

    let capturedListener: (() => void) | null = null;
    const mockVisualViewport = {
      height: 700,
      addEventListener: vi.fn((event: string, handler: () => void) => {
        if (event === "resize") capturedListener = handler;
      }),
      removeEventListener: vi.fn(),
    };
    Object.defineProperty(window, "visualViewport", {
      value: mockVisualViewport,
      writable: true,
    });

    renderProvider();

    expect(
      document.documentElement.style.getPropertyValue("--mobile-viewport-height"),
    ).toBe("700px");

    mockVisualViewport.height = 500;
    capturedListener?.();

    expect(
      document.documentElement.style.getPropertyValue("--mobile-viewport-height"),
    ).toBe("500px");
  });

  it("removes the resize listener from visualViewport on unmount", () => {
    mockUseIsMobile.mockReturnValue(true);

    const mockVisualViewport = {
      height: 700,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    Object.defineProperty(window, "visualViewport", {
      value: mockVisualViewport,
      writable: true,
    });

    const { unmount } = renderProvider();

    unmount();

    expect(mockVisualViewport.removeEventListener).toHaveBeenCalledWith(
      "resize",
      expect.any(Function),
    );
  });
});

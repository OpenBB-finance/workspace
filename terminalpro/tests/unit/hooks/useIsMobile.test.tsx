/**
 * Tests for useIsMobile hook
 *
 * Tests mobile detection based on:
 * - Screen width (< 768px)
 * - User agent string detection
 */

import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import useIsMobile from "~/hooks/useIsMobile";

// Mock usehooks-ts
vi.mock("usehooks-ts", () => ({
  useWindowSize: vi.fn(() => ({ width: 1024, height: 768 })),
}));

import { useWindowSize } from "usehooks-ts";

const mockUseWindowSize = vi.mocked(useWindowSize);

describe("useIsMobile", () => {
  const originalUserAgent = window.navigator.userAgent;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset to desktop defaults
    mockUseWindowSize.mockReturnValue({ width: 1024, height: 768 });
  });

  afterEach(() => {
    // Restore original user agent
    Object.defineProperty(window.navigator, "userAgent", {
      value: originalUserAgent,
      writable: true,
    });
  });

  describe("width-based detection", () => {
    it("should return false for desktop width (>= 768px)", () => {
      mockUseWindowSize.mockReturnValue({ width: 1024, height: 768 });

      const { result } = renderHook(() => useIsMobile());

      expect(result.current).toBe(false);
    });

    it("should return true for mobile width (< 768px)", () => {
      mockUseWindowSize.mockReturnValue({ width: 767, height: 1024 });

      const { result } = renderHook(() => useIsMobile());

      expect(result.current).toBe(true);
    });

    it("should return false at exact breakpoint (768px)", () => {
      mockUseWindowSize.mockReturnValue({ width: 768, height: 1024 });

      const { result } = renderHook(() => useIsMobile());

      expect(result.current).toBe(false);
    });

    it("should return true for very small width", () => {
      mockUseWindowSize.mockReturnValue({ width: 320, height: 480 });

      const { result } = renderHook(() => useIsMobile());

      expect(result.current).toBe(true);
    });

    it("should return false for very large width", () => {
      mockUseWindowSize.mockReturnValue({ width: 2560, height: 1440 });

      const { result } = renderHook(() => useIsMobile());

      expect(result.current).toBe(false);
    });
  });

  describe("user agent-based detection", () => {
    it("should return true for Android user agent", () => {
      mockUseWindowSize.mockReturnValue({ width: 1024, height: 768 });
      Object.defineProperty(window.navigator, "userAgent", {
        value:
          "Mozilla/5.0 (Linux; Android 10; SM-G975F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36",
        writable: true,
      });

      const { result } = renderHook(() => useIsMobile());

      expect(result.current).toBe(true);
    });

    it("should return true for iPhone user agent", () => {
      mockUseWindowSize.mockReturnValue({ width: 1024, height: 768 });
      Object.defineProperty(window.navigator, "userAgent", {
        value:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1",
        writable: true,
      });

      const { result } = renderHook(() => useIsMobile());

      expect(result.current).toBe(true);
    });

    it("should return false for iPad user agent (iPads get desktop layout)", () => {
      mockUseWindowSize.mockReturnValue({ width: 1024, height: 768 });
      Object.defineProperty(window.navigator, "userAgent", {
        value:
          "Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1",
        writable: true,
      });

      const { result } = renderHook(() => useIsMobile());

      expect(result.current).toBe(false);
    });

    it("should return true for webOS user agent", () => {
      mockUseWindowSize.mockReturnValue({ width: 1024, height: 768 });
      Object.defineProperty(window.navigator, "userAgent", {
        value:
          "Mozilla/5.0 (webOS/2.0.0; U; en-US) AppleWebKit/532.2 (KHTML, like Gecko) Version/1.0 Safari/532.2 WEBOSBROWSER/2.0.0",
        writable: true,
      });

      const { result } = renderHook(() => useIsMobile());

      expect(result.current).toBe(true);
    });

    it("should return true for BlackBerry user agent", () => {
      mockUseWindowSize.mockReturnValue({ width: 1024, height: 768 });
      Object.defineProperty(window.navigator, "userAgent", {
        value:
          "Mozilla/5.0 (BlackBerry; U; BlackBerry 9900; en-US) AppleWebKit/534.11+ (KHTML, like Gecko) Version/7.1.0.346 Mobile Safari/534.11+",
        writable: true,
      });

      const { result } = renderHook(() => useIsMobile());

      expect(result.current).toBe(true);
    });

    it("should return true for Opera Mini user agent", () => {
      mockUseWindowSize.mockReturnValue({ width: 1024, height: 768 });
      Object.defineProperty(window.navigator, "userAgent", {
        value:
          "Opera/9.80 (Android; Opera Mini/7.5.33361/31.1350; U; en) Presto/2.8.119 Version/11.10",
        writable: true,
      });

      const { result } = renderHook(() => useIsMobile());

      expect(result.current).toBe(true);
    });

    it("should return false for desktop Chrome user agent", () => {
      mockUseWindowSize.mockReturnValue({ width: 1024, height: 768 });
      Object.defineProperty(window.navigator, "userAgent", {
        value:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        writable: true,
      });

      const { result } = renderHook(() => useIsMobile());

      expect(result.current).toBe(false);
    });

    it("should return false for desktop Firefox user agent", () => {
      mockUseWindowSize.mockReturnValue({ width: 1024, height: 768 });
      Object.defineProperty(window.navigator, "userAgent", {
        value:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0",
        writable: true,
      });

      const { result } = renderHook(() => useIsMobile());

      expect(result.current).toBe(false);
    });

    it("should return false for desktop Safari user agent", () => {
      mockUseWindowSize.mockReturnValue({ width: 1024, height: 768 });
      Object.defineProperty(window.navigator, "userAgent", {
        value:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15",
        writable: true,
      });

      const { result } = renderHook(() => useIsMobile());

      expect(result.current).toBe(false);
    });
  });

  describe("combined detection", () => {
    it("should return true when width is mobile even with desktop user agent", () => {
      mockUseWindowSize.mockReturnValue({ width: 400, height: 800 });
      Object.defineProperty(window.navigator, "userAgent", {
        value:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/91.0.4472.124",
        writable: true,
      });

      const { result } = renderHook(() => useIsMobile());

      expect(result.current).toBe(true);
    });

    it("should return true when user agent is mobile even with desktop width", () => {
      mockUseWindowSize.mockReturnValue({ width: 1024, height: 768 });
      Object.defineProperty(window.navigator, "userAgent", {
        value: "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)",
        writable: true,
      });

      const { result } = renderHook(() => useIsMobile());

      expect(result.current).toBe(true);
    });

    it("should return true when both width and user agent indicate mobile", () => {
      mockUseWindowSize.mockReturnValue({ width: 375, height: 812 });
      Object.defineProperty(window.navigator, "userAgent", {
        value: "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)",
        writable: true,
      });

      const { result } = renderHook(() => useIsMobile());

      expect(result.current).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("should handle width of 0", () => {
      mockUseWindowSize.mockReturnValue({ width: 0, height: 0 });

      const { result } = renderHook(() => useIsMobile());

      expect(result.current).toBe(true);
    });

    it("should handle negative width gracefully", () => {
      mockUseWindowSize.mockReturnValue({ width: -1, height: 768 });

      const { result } = renderHook(() => useIsMobile());

      expect(result.current).toBe(true);
    });
  });
});

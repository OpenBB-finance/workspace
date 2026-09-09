import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useDetectOS from "~/hooks/useDetectOS";

describe("useDetectOS", () => {
  const originalNavigator = { ...window.navigator };

  beforeEach(() => {
    vi.stubGlobal("navigator", { ...originalNavigator });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("modern userAgentData API", () => {
    it("should detect macOS via userAgentData", () => {
      vi.stubGlobal("navigator", {
        userAgent: "",
        userAgentData: { platform: "macOS" },
      });

      const { result } = renderHook(() => useDetectOS());

      expect(result.current.isMacOS).toBe(true);
      expect(result.current.isWindows).toBe(false);
      expect(result.current.isLinux).toBe(false);
      expect(result.current.isIOS).toBe(false);
      expect(result.current.isAndroid).toBe(false);
    });

    it("should detect Windows via userAgentData", () => {
      vi.stubGlobal("navigator", {
        userAgent: "",
        userAgentData: { platform: "Windows" },
      });

      const { result } = renderHook(() => useDetectOS());

      expect(result.current.isWindows).toBe(true);
      expect(result.current.isMacOS).toBe(false);
    });

    it("should detect Linux via userAgentData", () => {
      vi.stubGlobal("navigator", {
        userAgent: "",
        userAgentData: { platform: "Linux" },
      });

      const { result } = renderHook(() => useDetectOS());

      expect(result.current.isLinux).toBe(true);
      expect(result.current.isWindows).toBe(false);
      expect(result.current.isMacOS).toBe(false);
    });

    it("should detect iOS via userAgentData", () => {
      vi.stubGlobal("navigator", {
        userAgent: "",
        userAgentData: { platform: "iOS" },
      });

      const { result } = renderHook(() => useDetectOS());

      expect(result.current.isIOS).toBe(true);
    });

    it("should detect Android via userAgentData", () => {
      vi.stubGlobal("navigator", {
        userAgent: "",
        userAgentData: { platform: "Android" },
      });

      const { result } = renderHook(() => useDetectOS());

      expect(result.current.isAndroid).toBe(true);
    });
  });

  describe("legacy userAgent fallback", () => {
    it("should detect macOS via userAgent", () => {
      vi.stubGlobal("navigator", {
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        maxTouchPoints: 0,
      });

      const { result } = renderHook(() => useDetectOS());

      expect(result.current.isMacOS).toBe(true);
    });

    it("should detect Windows via userAgent", () => {
      vi.stubGlobal("navigator", {
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        maxTouchPoints: 0,
      });

      const { result } = renderHook(() => useDetectOS());

      expect(result.current.isWindows).toBe(true);
    });

    it("should detect Linux via userAgent", () => {
      vi.stubGlobal("navigator", {
        userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
        maxTouchPoints: 0,
      });

      const { result } = renderHook(() => useDetectOS());

      expect(result.current.isLinux).toBe(true);
    });

    it("should detect iPhone via userAgent", () => {
      vi.stubGlobal("navigator", {
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15",
        maxTouchPoints: 5,
      });

      const { result } = renderHook(() => useDetectOS());

      expect(result.current.isIOS).toBe(true);
    });

    it("should detect iPad via userAgent", () => {
      vi.stubGlobal("navigator", {
        userAgent:
          "Mozilla/5.0 (iPad; CPU OS 14_6 like Mac OS X) AppleWebKit/605.1.15",
        maxTouchPoints: 5,
      });

      const { result } = renderHook(() => useDetectOS());

      expect(result.current.isIOS).toBe(true);
    });

    it("should detect iPad on iOS 13+ (reports as Macintosh)", () => {
      vi.stubGlobal("navigator", {
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/605.1.15",
        maxTouchPoints: 5,
      });

      const { result } = renderHook(() => useDetectOS());

      expect(result.current.isIOS).toBe(true);
      expect(result.current.isMacOS).toBe(true); // Also true due to userAgent
    });

    it("should detect Android via userAgent", () => {
      vi.stubGlobal("navigator", {
        userAgent:
          "Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36",
        maxTouchPoints: 5,
      });

      const { result } = renderHook(() => useDetectOS());

      expect(result.current.isAndroid).toBe(true);
      expect(result.current.isLinux).toBe(true); // Also true since Android is Linux-based
    });
  });

  describe("edge cases", () => {
    it("should return all false for unknown platform", () => {
      vi.stubGlobal("navigator", {
        userAgent: "UnknownBrowser/1.0",
        maxTouchPoints: 0,
      });

      const { result } = renderHook(() => useDetectOS());

      expect(result.current.isMacOS).toBe(false);
      expect(result.current.isWindows).toBe(false);
      expect(result.current.isLinux).toBe(false);
      expect(result.current.isIOS).toBe(false);
      expect(result.current.isAndroid).toBe(false);
    });

    it("should handle case-insensitive userAgent matching", () => {
      vi.stubGlobal("navigator", {
        userAgent: "mozilla/5.0 (WINDOWS nt 10.0; win64; x64)",
        maxTouchPoints: 0,
      });

      const { result } = renderHook(() => useDetectOS());

      expect(result.current.isWindows).toBe(true);
    });
  });
});

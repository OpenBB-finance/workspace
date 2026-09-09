import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { scrollToAndHighlightWidget } from "~/lib/utils/widgetHighlight";

describe("widgetHighlight utils - Additional Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = "";
    document.head.innerHTML = "";
    vi.useFakeTimers();

    // Mock requestAnimationFrame
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((cb) => setTimeout(cb, 16)),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  describe("scrollToAndHighlightWidget with options", () => {
    it("should wait for layout when waitForLayout is true", async () => {
      const widgetId = "test-widget";
      const element = document.createElement("div");
      element.id = widgetId;
      document.body.appendChild(element);
      element.scrollIntoView = vi.fn();

      const promise = scrollToAndHighlightWidget(widgetId, {
        waitForLayout: true,
        layoutDelay: 100,
      });

      // Advance past layout delay
      await vi.advanceTimersByTimeAsync(100);
      // Advance for RAF checks
      await vi.advanceTimersByTimeAsync(100);
      // Advance for scroll completion fallback
      await vi.advanceTimersByTimeAsync(1100);
      // Advance for highlight cleanup
      await vi.advanceTimersByTimeAsync(1500);

      await promise;

      expect(element.scrollIntoView).toHaveBeenCalled();
    });

    it("should use custom layoutDelay", async () => {
      const widgetId = "test-widget";
      const element = document.createElement("div");
      element.id = widgetId;
      document.body.appendChild(element);
      element.scrollIntoView = vi.fn();

      const promise = scrollToAndHighlightWidget(widgetId, {
        waitForLayout: true,
        layoutDelay: 500,
      });

      // Should not have been called yet before delay
      expect(element.scrollIntoView).not.toHaveBeenCalled();

      // Advance past layout delay
      await vi.advanceTimersByTimeAsync(600);
      await vi.advanceTimersByTimeAsync(1200);
      await vi.advanceTimersByTimeAsync(1500);

      await promise;

      expect(element.scrollIntoView).toHaveBeenCalled();
    });
  });

  describe("highlight behavior", () => {
    it("should add highlight class to element", async () => {
      const widgetId = "test-widget-highlight";
      const element = document.createElement("div");
      element.id = widgetId;
      document.body.appendChild(element);
      element.scrollIntoView = vi.fn();

      const promise = scrollToAndHighlightWidget(widgetId);

      // Advance to get past element lookup and scroll
      await vi.advanceTimersByTimeAsync(100);
      await vi.advanceTimersByTimeAsync(1100);

      // Check highlight is added
      expect(element.classList.contains("widget-highlight")).toBe(true);

      // Advance to cleanup
      await vi.advanceTimersByTimeAsync(1500);

      await promise;

      // After cleanup, highlight class should be removed
      expect(element.classList.contains("widget-highlight")).toBe(false);
    });
  });

  describe("error handling", () => {
    it("should handle errors gracefully", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      // Create element that throws on scrollIntoView
      const widgetId = "error-widget";
      const element = document.createElement("div");
      element.id = widgetId;
      document.body.appendChild(element);
      element.scrollIntoView = vi.fn(() => {
        throw new Error("Scroll error");
      });

      const promise = scrollToAndHighlightWidget(widgetId);

      await vi.advanceTimersByTimeAsync(100);
      await vi.advanceTimersByTimeAsync(1100);
      await vi.advanceTimersByTimeAsync(1500);

      await promise;

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Error"),
        expect.any(Error),
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe("element not found", () => {
    it("should give up after max attempts", async () => {
      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const promise = scrollToAndHighlightWidget("nonexistent-widget");

      // Advance through multiple RAF cycles (10 attempts)
      for (let i = 0; i < 15; i++) {
        await vi.advanceTimersByTimeAsync(20);
      }

      // Advance for fallback timeout
      await vi.advanceTimersByTimeAsync(1100);

      await promise;

      expect(consoleWarnSpy).toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });
  });
});

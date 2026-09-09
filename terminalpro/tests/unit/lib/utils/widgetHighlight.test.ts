import { beforeEach, describe, expect, it, vi } from "vitest";
import { scrollToAndHighlightWidget } from "~/lib/utils/widgetHighlight";

describe("widgetHighlight utils", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = "";
    document.head.innerHTML = "";
    vi.useFakeTimers();
  });

  it("should scroll to and highlight a widget if it exists", async () => {
    const widgetId = "test-widget";
    const element = document.createElement("div");
    element.id = widgetId;
    document.body.appendChild(element);

    // @ts-ignore
    element.scrollIntoView = vi.fn();

    // Mock RAF
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((cb) => setTimeout(cb, 16)),
    );

    const promise = scrollToAndHighlightWidget(widgetId);

    // Advance time to resolve waitForElement
    await vi.advanceTimersByTimeAsync(100);
    // Advance time to resolve waitForScrollCompletion (fallback 1000ms)
    await vi.advanceTimersByTimeAsync(1100);
    // Advance time for highlight cleaning (1300ms)
    await vi.advanceTimersByTimeAsync(1500);

    await promise;

    expect(element.scrollIntoView).toHaveBeenCalled();
  });

  it("should warn if element is not found", async () => {
    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    // Mock RAF
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((cb) => setTimeout(cb, 16)),
    );

    const promise = scrollToAndHighlightWidget("non-existent");

    await vi.advanceTimersByTimeAsync(1000);

    await promise;

    expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining("not found"));
  });
});

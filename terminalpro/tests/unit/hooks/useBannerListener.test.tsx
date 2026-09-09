import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import useBannerListener from "~/hooks/useBannerListener";

vi.mock("~/lib/state/auth", () => ({
  useAuthStore: vi.fn(() => ({ user: { id: "1" } })),
}));

describe("useBannerListener", () => {
  it("should add event listeners to buttons with class try_copilot_btn", async () => {
    vi.useFakeTimers();

    // Create mock buttons
    const button1 = document.createElement("button");
    button1.className = "try_copilot_btn";
    const button2 = document.createElement("button");
    button2.className = "try_copilot_btn";

    document.body.appendChild(button1);
    document.body.appendChild(button2);

    const addEventListenerSpy1 = vi.spyOn(button1, "addEventListener");
    const addEventListenerSpy2 = vi.spyOn(button2, "addEventListener");

    renderHook(() => useBannerListener());

    // Fast-forward 1 second
    vi.advanceTimersByTime(1000);

    expect(addEventListenerSpy1).toHaveBeenCalledWith("click", expect.any(Function));
    expect(addEventListenerSpy2).toHaveBeenCalledWith("click", expect.any(Function));

    document.body.removeChild(button1);
    document.body.removeChild(button2);
    vi.useRealTimers();
  });
});

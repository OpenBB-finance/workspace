import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAutoHeightInput } from "~/components/ui/hooks/useAutoHeightInput";

describe("useAutoHeightInput", () => {
  let mockElement: any;

  beforeEach(() => {
    mockElement = {
      style: { height: "" },
      offsetWidth: 100,
      scrollHeight: 50,
      value: "",
    };

    // Mock getComputedStyle
    vi.stubGlobal("getComputedStyle", () => ({
      font: "16px Arial",
      lineHeight: "24px",
    }));
  });

  it("adjusts height based on scrollHeight", () => {
    const ref = { current: mockElement };
    renderHook(() => useAutoHeightInput(ref as any, { offset: 2 }));

    // Reset to auto, then scrollHeight + offset
    expect(mockElement.style.height).toBe("52px");
  });

  it("skips if offsetWidth is 0", () => {
    mockElement.offsetWidth = 0;
    const ref = { current: mockElement };
    renderHook(() => useAutoHeightInput(ref as any));

    expect(mockElement.style.height).toBe("");
  });

  it("adjusts height based on textContent", () => {
    const ref = { current: mockElement };

    // Mock offsetHeight on Div prototype
    const originalOffsetHeight = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      "offsetHeight",
    );
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
      configurable: true,
      value: 100,
    });

    renderHook(() =>
      useAutoHeightInput(ref as any, { textContent: "some text", offset: 0 }),
    );

    // Max of scrollHeight(50) and contentHeight(100)
    expect(mockElement.style.height).toBe("100px");

    // Restore
    if (originalOffsetHeight) {
      Object.defineProperty(
        HTMLElement.prototype,
        "offsetHeight",
        originalOffsetHeight,
      );
    }
  });
});

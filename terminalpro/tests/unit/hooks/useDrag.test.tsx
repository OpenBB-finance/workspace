import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDrag } from "~/hooks/useDrag";

// PointerEvent is not available in jsdom, so we polyfill it using MouseEvent
class MockPointerEvent extends MouseEvent {
  constructor(type: string, init?: MouseEventInit) {
    super(type, init);
  }
}

// Assign to global if not already present
if (typeof PointerEvent === "undefined") {
  (global as any).PointerEvent = MockPointerEvent;
}

describe("useDrag", () => {
  let addEventListenerSpy: ReturnType<typeof vi.spyOn>;
  let removeEventListenerSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    addEventListenerSpy = vi.spyOn(window, "addEventListener");
    removeEventListenerSpy = vi.spyOn(window, "removeEventListener");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const createMouseEvent = (
    clientX: number,
    clientY: number,
    options: Partial<React.MouseEvent> = {},
  ): React.MouseEvent => {
    return {
      clientX,
      clientY,
      preventDefault: vi.fn(),
      ...options,
    } as unknown as React.MouseEvent;
  };

  const createPointerMoveEvent = (clientX: number, clientY: number): MouseEvent => {
    return new MockPointerEvent("pointermove", {
      clientX,
      clientY,
      bubbles: true,
    });
  };

  const createPointerUpEvent = (): MouseEvent => {
    return new MockPointerEvent("pointerup", { bubbles: true });
  };

  describe("initial state", () => {
    it("should return isDragging as false initially", () => {
      const { result } = renderHook(() => useDrag());

      expect(result.current.isDragging).toBe(false);
    });

    it("should return startX as null initially", () => {
      const { result } = renderHook(() => useDrag());

      expect(result.current.startX).toBeNull();
    });

    it("should return startY as null initially", () => {
      const { result } = renderHook(() => useDrag());

      expect(result.current.startY).toBeNull();
    });

    it("should return dx as null initially", () => {
      const { result } = renderHook(() => useDrag());

      expect(result.current.dx).toBeNull();
    });

    it("should return dy as null initially", () => {
      const { result } = renderHook(() => useDrag());

      expect(result.current.dy).toBeNull();
    });

    it("should provide handleDragStart function", () => {
      const { result } = renderHook(() => useDrag());

      expect(typeof result.current.handleDragStart).toBe("function");
    });
  });

  describe("onMouseDown handler (handleDragStart)", () => {
    it("should start drag and set startX/startY on mouse down", () => {
      const { result } = renderHook(() => useDrag());
      const mouseEvent = createMouseEvent(100, 200);

      act(() => {
        result.current.handleDragStart(mouseEvent);
      });

      expect(result.current.isDragging).toBe(true);
      expect(result.current.startX).toBe(100);
      expect(result.current.startY).toBe(200);
    });

    it("should call preventDefault on the mouse event", () => {
      const { result } = renderHook(() => useDrag());
      const mouseEvent = createMouseEvent(100, 200);

      act(() => {
        result.current.handleDragStart(mouseEvent);
      });

      expect(mouseEvent.preventDefault).toHaveBeenCalled();
    });

    it("should register pointermove event listener on window", () => {
      const { result } = renderHook(() => useDrag());
      const mouseEvent = createMouseEvent(100, 200);

      act(() => {
        result.current.handleDragStart(mouseEvent);
      });

      expect(addEventListenerSpy).toHaveBeenCalledWith("pointermove", expect.any(Function));
    });

    it("should register pointerup event listener on window", () => {
      const { result } = renderHook(() => useDrag());
      const mouseEvent = createMouseEvent(100, 200);

      act(() => {
        result.current.handleDragStart(mouseEvent);
      });

      expect(addEventListenerSpy).toHaveBeenCalledWith("pointerup", expect.any(Function));
    });
  });

  describe("mouse move during drag", () => {
    it("should update dx and dy when pointer moves", () => {
      const { result } = renderHook(() => useDrag());
      const mouseEvent = createMouseEvent(100, 200);

      act(() => {
        result.current.handleDragStart(mouseEvent);
      });

      act(() => {
        window.dispatchEvent(createPointerMoveEvent(150, 250));
      });

      expect(result.current.dx).toBe(50); // 150 - 100
      expect(result.current.dy).toBe(50); // 250 - 200
    });

    it("should handle negative delta (moving left/up)", () => {
      const { result } = renderHook(() => useDrag());
      const mouseEvent = createMouseEvent(100, 200);

      act(() => {
        result.current.handleDragStart(mouseEvent);
      });

      act(() => {
        window.dispatchEvent(createPointerMoveEvent(50, 100));
      });

      expect(result.current.dx).toBe(-50); // 50 - 100
      expect(result.current.dy).toBe(-100); // 100 - 200
    });

    it("should update delta on multiple moves", () => {
      const { result } = renderHook(() => useDrag());
      const mouseEvent = createMouseEvent(100, 200);

      act(() => {
        result.current.handleDragStart(mouseEvent);
      });

      act(() => {
        window.dispatchEvent(createPointerMoveEvent(150, 250));
      });

      expect(result.current.dx).toBe(50);
      expect(result.current.dy).toBe(50);

      act(() => {
        window.dispatchEvent(createPointerMoveEvent(200, 300));
      });

      expect(result.current.dx).toBe(100); // 200 - 100
      expect(result.current.dy).toBe(100); // 300 - 200
    });

    it("should maintain isDragging true during movement", () => {
      const { result } = renderHook(() => useDrag());
      const mouseEvent = createMouseEvent(100, 200);

      act(() => {
        result.current.handleDragStart(mouseEvent);
      });

      act(() => {
        window.dispatchEvent(createPointerMoveEvent(150, 250));
      });

      expect(result.current.isDragging).toBe(true);
    });
  });

  describe("mouse up - end drag", () => {
    it("should reset isDragging to false on pointer up", () => {
      const { result } = renderHook(() => useDrag());
      const mouseEvent = createMouseEvent(100, 200);

      act(() => {
        result.current.handleDragStart(mouseEvent);
      });

      expect(result.current.isDragging).toBe(true);

      act(() => {
        window.dispatchEvent(createPointerUpEvent());
      });

      expect(result.current.isDragging).toBe(false);
    });

    it("should reset startX to null on pointer up", () => {
      const { result } = renderHook(() => useDrag());
      const mouseEvent = createMouseEvent(100, 200);

      act(() => {
        result.current.handleDragStart(mouseEvent);
      });

      act(() => {
        window.dispatchEvent(createPointerUpEvent());
      });

      expect(result.current.startX).toBeNull();
    });

    it("should reset startY to null on pointer up", () => {
      const { result } = renderHook(() => useDrag());
      const mouseEvent = createMouseEvent(100, 200);

      act(() => {
        result.current.handleDragStart(mouseEvent);
      });

      act(() => {
        window.dispatchEvent(createPointerUpEvent());
      });

      expect(result.current.startY).toBeNull();
    });

    it("should reset dx to null on pointer up", () => {
      const { result } = renderHook(() => useDrag());
      const mouseEvent = createMouseEvent(100, 200);

      act(() => {
        result.current.handleDragStart(mouseEvent);
      });

      act(() => {
        window.dispatchEvent(createPointerMoveEvent(150, 250));
      });

      expect(result.current.dx).toBe(50);

      act(() => {
        window.dispatchEvent(createPointerUpEvent());
      });

      expect(result.current.dx).toBeNull();
    });

    it("should reset dy to null on pointer up", () => {
      const { result } = renderHook(() => useDrag());
      const mouseEvent = createMouseEvent(100, 200);

      act(() => {
        result.current.handleDragStart(mouseEvent);
      });

      act(() => {
        window.dispatchEvent(createPointerMoveEvent(150, 250));
      });

      expect(result.current.dy).toBe(50);

      act(() => {
        window.dispatchEvent(createPointerUpEvent());
      });

      expect(result.current.dy).toBeNull();
    });

    it("should remove pointermove event listener on pointer up", () => {
      const { result } = renderHook(() => useDrag());
      const mouseEvent = createMouseEvent(100, 200);

      act(() => {
        result.current.handleDragStart(mouseEvent);
      });

      act(() => {
        window.dispatchEvent(createPointerUpEvent());
      });

      expect(removeEventListenerSpy).toHaveBeenCalledWith("pointermove", expect.any(Function));
    });

    it("should remove pointerup event listener on pointer up", () => {
      const { result } = renderHook(() => useDrag());
      const mouseEvent = createMouseEvent(100, 200);

      act(() => {
        result.current.handleDragStart(mouseEvent);
      });

      act(() => {
        window.dispatchEvent(createPointerUpEvent());
      });

      expect(removeEventListenerSpy).toHaveBeenCalledWith("pointerup", expect.any(Function));
    });
  });

  describe("event listener cleanup on unmount", () => {
    it("documents that listeners persist after unmount during active drag (known limitation)", () => {
      const { result, unmount } = renderHook(() => useDrag());
      const mouseEvent = createMouseEvent(100, 200);

      act(() => {
        result.current.handleDragStart(mouseEvent);
      });

      expect(result.current.isDragging).toBe(true);

      const addCallCount = addEventListenerSpy.mock.calls.filter(
        (call) => call[0] === "pointermove" || call[0] === "pointerup",
      ).length;
      expect(addCallCount).toBe(2);

      removeEventListenerSpy.mockClear();

      unmount();

      // KNOWN LIMITATION: The hook does not clean up listeners on unmount.
      // Listeners are only removed when pointerup fires.
      // This could cause memory leaks if component unmounts during drag.
      const removeCallCount = removeEventListenerSpy.mock.calls.filter(
        (call) => call[0] === "pointermove" || call[0] === "pointerup",
      ).length;
      expect(removeCallCount).toBe(0);
    });

    it("should clean up listeners if drag completes before unmount", () => {
      const { result, unmount } = renderHook(() => useDrag());
      const mouseEvent = createMouseEvent(100, 200);

      act(() => {
        result.current.handleDragStart(mouseEvent);
      });

      act(() => {
        window.dispatchEvent(createPointerUpEvent());
      });

      expect(removeEventListenerSpy).toHaveBeenCalledWith("pointermove", expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith("pointerup", expect.any(Function));

      removeEventListenerSpy.mockClear();

      unmount();

      expect(result.current.isDragging).toBe(false);
    });

    it("should not respond to pointer events after unmount (if drag completed)", () => {
      const { result, unmount } = renderHook(() => useDrag());
      const mouseEvent = createMouseEvent(100, 200);

      act(() => {
        result.current.handleDragStart(mouseEvent);
      });

      act(() => {
        window.dispatchEvent(createPointerUpEvent());
      });

      unmount();

      // Dispatching events after unmount should have no effect since listeners were removed
      act(() => {
        window.dispatchEvent(createPointerMoveEvent(999, 999));
      });

      // State remains at last known value (null after cleanup)
      expect(result.current.dx).toBeNull();
      expect(result.current.dy).toBeNull();
    });
  });

  describe("edge cases", () => {
    it("should handle zero movement (click without drag)", () => {
      const { result } = renderHook(() => useDrag());
      const mouseEvent = createMouseEvent(100, 200);

      act(() => {
        result.current.handleDragStart(mouseEvent);
      });

      // Move to same position
      act(() => {
        window.dispatchEvent(createPointerMoveEvent(100, 200));
      });

      expect(result.current.dx).toBe(0);
      expect(result.current.dy).toBe(0);
      expect(result.current.isDragging).toBe(true);
    });

    it("should handle rapid start/stop sequence", () => {
      const { result } = renderHook(() => useDrag());

      // First drag
      act(() => {
        result.current.handleDragStart(createMouseEvent(100, 100));
      });
      expect(result.current.isDragging).toBe(true);

      act(() => {
        window.dispatchEvent(createPointerUpEvent());
      });
      expect(result.current.isDragging).toBe(false);

      // Second drag immediately after
      act(() => {
        result.current.handleDragStart(createMouseEvent(200, 200));
      });
      expect(result.current.isDragging).toBe(true);
      expect(result.current.startX).toBe(200);
      expect(result.current.startY).toBe(200);

      act(() => {
        window.dispatchEvent(createPointerUpEvent());
      });
      expect(result.current.isDragging).toBe(false);
    });

    it("should handle large coordinate values", () => {
      const { result } = renderHook(() => useDrag());
      const mouseEvent = createMouseEvent(10000, 10000);

      act(() => {
        result.current.handleDragStart(mouseEvent);
      });

      act(() => {
        window.dispatchEvent(createPointerMoveEvent(20000, 20000));
      });

      expect(result.current.dx).toBe(10000);
      expect(result.current.dy).toBe(10000);
    });

    it("should handle negative coordinate values", () => {
      const { result } = renderHook(() => useDrag());
      const mouseEvent = createMouseEvent(-100, -100);

      act(() => {
        result.current.handleDragStart(mouseEvent);
      });

      act(() => {
        window.dispatchEvent(createPointerMoveEvent(-50, -50));
      });

      expect(result.current.dx).toBe(50); // -50 - (-100) = 50
      expect(result.current.dy).toBe(50);
    });

    it("should handle starting new drag while previous is active", () => {
      const { result } = renderHook(() => useDrag());

      // Start first drag
      act(() => {
        result.current.handleDragStart(createMouseEvent(100, 100));
      });

      act(() => {
        window.dispatchEvent(createPointerMoveEvent(150, 150));
      });

      expect(result.current.dx).toBe(50);

      // Start new drag without ending previous (edge case)
      act(() => {
        result.current.handleDragStart(createMouseEvent(200, 200));
      });

      expect(result.current.startX).toBe(200);
      expect(result.current.startY).toBe(200);

      act(() => {
        window.dispatchEvent(createPointerMoveEvent(250, 250));
      });

      // Delta should be relative to new start position
      expect(result.current.dx).toBe(50); // 250 - 200
      expect(result.current.dy).toBe(50);
    });

    it("should handle decimal coordinate values", () => {
      const { result } = renderHook(() => useDrag());
      const mouseEvent = createMouseEvent(100.5, 200.5);

      act(() => {
        result.current.handleDragStart(mouseEvent);
      });

      act(() => {
        window.dispatchEvent(createPointerMoveEvent(150.7, 250.3));
      });

      expect(result.current.dx).toBeCloseTo(50.2); // 150.7 - 100.5
      expect(result.current.dy).toBeCloseTo(49.8); // 250.3 - 200.5
    });
  });

  describe("complete drag workflow", () => {
    it("should complete full drag lifecycle correctly", () => {
      const { result } = renderHook(() => useDrag());

      // Initial state
      expect(result.current.isDragging).toBe(false);
      expect(result.current.startX).toBeNull();
      expect(result.current.startY).toBeNull();
      expect(result.current.dx).toBeNull();
      expect(result.current.dy).toBeNull();

      // Start drag
      act(() => {
        result.current.handleDragStart(createMouseEvent(100, 100));
      });

      expect(result.current.isDragging).toBe(true);
      expect(result.current.startX).toBe(100);
      expect(result.current.startY).toBe(100);
      expect(result.current.dx).toBeNull(); // dx is null until first move

      // First move
      act(() => {
        window.dispatchEvent(createPointerMoveEvent(120, 130));
      });

      expect(result.current.isDragging).toBe(true);
      expect(result.current.dx).toBe(20);
      expect(result.current.dy).toBe(30);

      // Second move
      act(() => {
        window.dispatchEvent(createPointerMoveEvent(180, 200));
      });

      expect(result.current.dx).toBe(80);
      expect(result.current.dy).toBe(100);

      // End drag
      act(() => {
        window.dispatchEvent(createPointerUpEvent());
      });

      expect(result.current.isDragging).toBe(false);
      expect(result.current.startX).toBeNull();
      expect(result.current.startY).toBeNull();
      expect(result.current.dx).toBeNull();
      expect(result.current.dy).toBeNull();
    });
  });

  describe("multiple drag cycles", () => {
    it("should handle three consecutive drag operations correctly", () => {
      const { result } = renderHook(() => useDrag());

      // First cycle
      act(() => {
        result.current.handleDragStart(createMouseEvent(0, 0));
      });
      act(() => {
        window.dispatchEvent(createPointerMoveEvent(100, 100));
      });
      expect(result.current.dx).toBe(100);
      expect(result.current.dy).toBe(100);
      act(() => {
        window.dispatchEvent(createPointerUpEvent());
      });
      expect(result.current.isDragging).toBe(false);

      // Second cycle - different starting point
      act(() => {
        result.current.handleDragStart(createMouseEvent(500, 500));
      });
      act(() => {
        window.dispatchEvent(createPointerMoveEvent(400, 400));
      });
      expect(result.current.dx).toBe(-100);
      expect(result.current.dy).toBe(-100);
      act(() => {
        window.dispatchEvent(createPointerUpEvent());
      });
      expect(result.current.isDragging).toBe(false);

      // Third cycle
      act(() => {
        result.current.handleDragStart(createMouseEvent(250, 250));
      });
      act(() => {
        window.dispatchEvent(createPointerMoveEvent(275, 225));
      });
      expect(result.current.dx).toBe(25);
      expect(result.current.dy).toBe(-25);
      act(() => {
        window.dispatchEvent(createPointerUpEvent());
      });
      expect(result.current.isDragging).toBe(false);
    });

    it("should register new event listeners for each drag cycle", () => {
      const { result } = renderHook(() => useDrag());

      // First cycle
      act(() => {
        result.current.handleDragStart(createMouseEvent(0, 0));
      });
      act(() => {
        window.dispatchEvent(createPointerUpEvent());
      });

      const addCallsAfterFirst = addEventListenerSpy.mock.calls.filter(
        (call) => call[0] === "pointermove" || call[0] === "pointerup",
      ).length;

      // Second cycle
      act(() => {
        result.current.handleDragStart(createMouseEvent(100, 100));
      });
      act(() => {
        window.dispatchEvent(createPointerUpEvent());
      });

      const addCallsAfterSecond = addEventListenerSpy.mock.calls.filter(
        (call) => call[0] === "pointermove" || call[0] === "pointerup",
      ).length;

      // Each cycle should add 2 listeners (pointermove + pointerup)
      expect(addCallsAfterSecond - addCallsAfterFirst).toBe(2);
    });

    it("should properly clean up listeners between cycles", () => {
      const { result } = renderHook(() => useDrag());

      // First cycle
      act(() => {
        result.current.handleDragStart(createMouseEvent(0, 0));
      });
      act(() => {
        window.dispatchEvent(createPointerUpEvent());
      });

      const removeCallsAfterFirst = removeEventListenerSpy.mock.calls.filter(
        (call) => call[0] === "pointermove" || call[0] === "pointerup",
      ).length;

      // Second cycle
      act(() => {
        result.current.handleDragStart(createMouseEvent(100, 100));
      });
      act(() => {
        window.dispatchEvent(createPointerUpEvent());
      });

      const removeCallsAfterSecond = removeEventListenerSpy.mock.calls.filter(
        (call) => call[0] === "pointermove" || call[0] === "pointerup",
      ).length;

      // Each cycle should remove 2 listeners
      expect(removeCallsAfterFirst).toBe(2);
      expect(removeCallsAfterSecond).toBe(4);
    });
  });

  describe("hook rerender behavior", () => {
    it("should maintain state across rerenders", () => {
      const { result, rerender } = renderHook(() => useDrag());

      act(() => {
        result.current.handleDragStart(createMouseEvent(100, 100));
      });

      act(() => {
        window.dispatchEvent(createPointerMoveEvent(150, 150));
      });

      expect(result.current.dx).toBe(50);
      expect(result.current.dy).toBe(50);

      // Trigger a rerender
      rerender();

      // State should persist
      expect(result.current.isDragging).toBe(true);
      expect(result.current.startX).toBe(100);
      expect(result.current.startY).toBe(100);
      expect(result.current.dx).toBe(50);
      expect(result.current.dy).toBe(50);
    });

    it("should continue receiving events after rerender", () => {
      const { result, rerender } = renderHook(() => useDrag());

      act(() => {
        result.current.handleDragStart(createMouseEvent(100, 100));
      });

      rerender();

      act(() => {
        window.dispatchEvent(createPointerMoveEvent(200, 200));
      });

      expect(result.current.dx).toBe(100);
      expect(result.current.dy).toBe(100);

      rerender();

      act(() => {
        window.dispatchEvent(createPointerUpEvent());
      });

      expect(result.current.isDragging).toBe(false);
    });
  });

  describe("handleDragStart function reference", () => {
    it("should create a new handleDragStart function on each render", () => {
      const { result, rerender } = renderHook(() => useDrag());

      const firstHandleDragStart = result.current.handleDragStart;

      rerender();

      const secondHandleDragStart = result.current.handleDragStart;

      // Function is recreated on each render (not memoized)
      expect(firstHandleDragStart).not.toBe(secondHandleDragStart);
    });
  });

  describe("boundary conditions", () => {
    it("should handle pointer up when not dragging (no-op)", () => {
      const { result } = renderHook(() => useDrag());

      // Dispatch pointerup without starting drag
      act(() => {
        window.dispatchEvent(createPointerUpEvent());
      });

      // Should remain in initial state
      expect(result.current.isDragging).toBe(false);
      expect(result.current.startX).toBeNull();
      expect(result.current.dx).toBeNull();
    });

    it("should handle pointermove when not dragging (no-op)", () => {
      const { result } = renderHook(() => useDrag());

      // Dispatch pointermove without starting drag
      act(() => {
        window.dispatchEvent(createPointerMoveEvent(100, 100));
      });

      // Should remain in initial state
      expect(result.current.isDragging).toBe(false);
      expect(result.current.dx).toBeNull();
      expect(result.current.dy).toBeNull();
    });

    it("should handle very rapid mouse movements", () => {
      const { result } = renderHook(() => useDrag());

      act(() => {
        result.current.handleDragStart(createMouseEvent(0, 0));
      });

      // Simulate rapid movements
      act(() => {
        for (let i = 1; i <= 100; i++) {
          window.dispatchEvent(createPointerMoveEvent(i, i));
        }
      });

      // Should reflect final position
      expect(result.current.dx).toBe(100);
      expect(result.current.dy).toBe(100);
    });
  });
});

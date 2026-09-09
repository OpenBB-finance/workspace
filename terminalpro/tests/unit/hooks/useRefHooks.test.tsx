/**
 * Tests for useRefHooks utilities
 *
 * Tests custom ref hooks:
 * - useRecordRef: Record-based ref management
 * - useCreateRef: Simple ref creation with auto-update
 * - useCallbackRef: Stable callback refs
 * - useComposeRefs: Compose multiple refs into one
 */

import { renderHook } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  useRecordRef,
  useCreateRef,
  useCallbackRef,
  useComposeRefs,
} from "~/hooks/useRefHooks";

describe("useRecordRef", () => {
  it("should store initial record value", () => {
    const initialValue = { name: "test", count: 1 };

    const { result } = renderHook(() => useRecordRef(initialValue));

    expect(result.current.current).toEqual(initialValue);
  });

  it("should update ref when value changes", () => {
    let value = { name: "first", count: 1 };

    const { result, rerender } = renderHook(() => useRecordRef(value));

    expect(result.current.current).toEqual({ name: "first", count: 1 });

    value = { name: "second", count: 2 };
    rerender();

    expect(result.current.current).toEqual({ name: "second", count: 2 });
  });

  it("should handle empty object", () => {
    const { result } = renderHook(() => useRecordRef({}));

    expect(result.current.current).toEqual({});
  });

  it("should handle complex nested objects", () => {
    const nested = {
      level1: {
        level2: {
          value: "deep",
        },
      },
      array: [1, 2, 3],
    };

    const { result } = renderHook(() => useRecordRef(nested));

    expect(result.current.current).toEqual(nested);
  });

  it("should maintain ref identity across rerenders", () => {
    const { result, rerender } = renderHook(() =>
      useRecordRef({ value: "test" }),
    );

    const firstRef = result.current;
    rerender();
    const secondRef = result.current;

    expect(firstRef).toBe(secondRef);
  });
});

describe("useCreateRef", () => {
  it("should store initial value", () => {
    const { result } = renderHook(() => useCreateRef("initial"));

    expect(result.current.current).toBe("initial");
  });

  it("should update ref when value changes", () => {
    let value = "first";

    const { result, rerender } = renderHook(() => useCreateRef(value));

    expect(result.current.current).toBe("first");

    value = "second";
    rerender();

    expect(result.current.current).toBe("second");
  });

  it("should handle null value", () => {
    const { result } = renderHook(() => useCreateRef(null));

    expect(result.current.current).toBeNull();
  });

  it("should handle object value", () => {
    const obj = { key: "value" };

    const { result } = renderHook(() => useCreateRef(obj));

    expect(result.current.current).toBe(obj);
  });

  it("should handle function value", () => {
    const fn = () => "result";

    const { result } = renderHook(() => useCreateRef(fn));

    expect(result.current.current).toBe(fn);
    expect(result.current.current()).toBe("result");
  });
});

describe("useCallbackRef", () => {
  it("should return stable function reference", () => {
    const callback = vi.fn(() => "result");

    const { result, rerender } = renderHook(() => useCallbackRef(callback));

    const firstRef = result.current;
    rerender();
    const secondRef = result.current;

    expect(firstRef).toBe(secondRef);
  });

  it("should call the current callback", () => {
    const callback = vi.fn((x: number) => x * 2);

    const { result } = renderHook(() => useCallbackRef(callback));

    const callResult = result.current(5);

    expect(callback).toHaveBeenCalledWith(5);
    expect(callResult).toBe(10);
  });

  it("should use updated callback after rerender", () => {
    const callback1 = vi.fn(() => "first");
    const callback2 = vi.fn(() => "second");

    let callback = callback1;
    const { result, rerender } = renderHook(() => useCallbackRef(callback));

    expect(result.current()).toBe("first");
    expect(callback1).toHaveBeenCalled();

    callback = callback2;
    rerender();

    expect(result.current()).toBe("second");
    expect(callback2).toHaveBeenCalled();
  });

  it("should handle undefined callback", () => {
    const { result } = renderHook(() => useCallbackRef(undefined));

    // Should not throw when called
    expect(() => result.current()).not.toThrow();
    expect(result.current()).toBeUndefined();
  });

  it("should pass multiple arguments", () => {
    const callback = vi.fn((a: number, b: string, c: boolean) => ({
      a,
      b,
      c,
    }));

    const { result } = renderHook(() => useCallbackRef(callback));

    const callResult = result.current(1, "test", true);

    expect(callback).toHaveBeenCalledWith(1, "test", true);
    expect(callResult).toEqual({ a: 1, b: "test", c: true });
  });

  it("should handle async callback", async () => {
    const callback = vi.fn(async () => "async result");

    const { result } = renderHook(() => useCallbackRef(callback));

    const callResult = await result.current();

    expect(callResult).toBe("async result");
  });
});

describe("useComposeRefs", () => {
  it("should compose multiple refs", () => {
    const ref1 = createRef<HTMLDivElement>();
    const ref2 = createRef<HTMLDivElement>();

    const { result } = renderHook(() => useComposeRefs(ref1, ref2));

    // Should return a function
    expect(typeof result.current).toBe("function");

    // Mock DOM element
    const mockElement = document.createElement("div");
    result.current?.(mockElement);

    expect(ref1.current).toBe(mockElement);
    expect(ref2.current).toBe(mockElement);
  });

  it("should handle null refs in the array", () => {
    const ref1 = createRef<HTMLDivElement>();

    const { result } = renderHook(() => useComposeRefs(ref1, null));

    const mockElement = document.createElement("div");
    result.current?.(mockElement);

    expect(ref1.current).toBe(mockElement);
  });

  it("should return null when all refs are null", () => {
    const { result } = renderHook(() => useComposeRefs(null, null));

    expect(result.current).toBeNull();
  });

  it("should work with single ref", () => {
    const ref = createRef<string>();

    const { result } = renderHook(() => useComposeRefs(ref));

    result.current?.("test value");

    expect(ref.current).toBe("test value");
  });

  it("should work with many refs", () => {
    const ref1 = createRef<number>();
    const ref2 = createRef<number>();
    const ref3 = createRef<number>();
    const ref4 = createRef<number>();

    const { result } = renderHook(() => useComposeRefs(ref1, ref2, ref3, ref4));

    result.current?.(42);

    expect(ref1.current).toBe(42);
    expect(ref2.current).toBe(42);
    expect(ref3.current).toBe(42);
    expect(ref4.current).toBe(42);
  });

  it("should update refs when composed setter is called multiple times", () => {
    const ref = createRef<string>();

    const { result } = renderHook(() => useComposeRefs(ref));

    result.current?.("first");
    expect(ref.current).toBe("first");

    result.current?.("second");
    expect(ref.current).toBe("second");
  });

  it("should be memoized based on refs", () => {
    const ref1 = createRef<string>();
    const ref2 = createRef<string>();

    const { result, rerender } = renderHook(
      ({ refs }) => useComposeRefs(...refs),
      {
        initialProps: { refs: [ref1, ref2] as const },
      },
    );

    const firstResult = result.current;
    rerender({ refs: [ref1, ref2] as const });
    const secondResult = result.current;

    // Same refs should give same composed function
    expect(firstResult).toBe(secondResult);
  });
});

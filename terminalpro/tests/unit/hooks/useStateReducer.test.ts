import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { reducerAction, useStateReducer } from "~/hooks/useStateReducer";

describe("reducerAction", () => {
  describe("function actions", () => {
    it("should apply function action to entire state", () => {
      const state = { count: 0, name: "test" };
      const action = (prev: typeof state) => ({ ...prev, count: prev.count + 1 });

      const result = reducerAction(state, action);

      expect(result.count).toBe(1);
      expect(result.name).toBe("test");
    });

    it("should replace state entirely with function return", () => {
      const state = { a: 1, b: 2 };
      const action = () => ({ a: 10, b: 20 });

      const result = reducerAction(state, action);

      expect(result).toEqual({ a: 10, b: 20 });
    });
  });

  describe("object actions", () => {
    it("should update specific keys with direct values", () => {
      const state = { count: 0, name: "test", active: false };
      const action = { count: 5, active: true };

      const result = reducerAction(state, action);

      expect(result.count).toBe(5);
      expect(result.name).toBe("test");
      expect(result.active).toBe(true);
    });

    it("should update specific keys with function values", () => {
      const state = { count: 10, multiplier: 2 };
      const action = {
        count: (prev: number) => prev * 2,
        multiplier: (prev: number) => prev + 1,
      };

      const result = reducerAction(state, action);

      expect(result.count).toBe(20);
      expect(result.multiplier).toBe(3);
    });

    it("should handle mixed direct and function values", () => {
      const state = { count: 5, name: "old", flag: false };
      const action = {
        count: (prev: number) => prev + 5,
        name: "new",
      };

      const result = reducerAction(state, action);

      expect(result.count).toBe(10);
      expect(result.name).toBe("new");
      expect(result.flag).toBe(false);
    });

    it("should preserve unmodified keys", () => {
      const state = { a: 1, b: 2, c: 3, d: 4 };
      const action = { b: 20 };

      const result = reducerAction(state, action);

      expect(result).toEqual({ a: 1, b: 20, c: 3, d: 4 });
    });
  });

  describe("immutability", () => {
    it("should return new object reference", () => {
      const state = { value: 1 };
      const action = { value: 2 };

      const result = reducerAction(state, action);

      expect(result).not.toBe(state);
    });

    it("should not mutate original state", () => {
      const state = { value: 1, nested: { x: 1 } };
      const action = { value: 2 };

      reducerAction(state, action);

      expect(state.value).toBe(1);
    });
  });

  describe("edge cases", () => {
    it("should handle empty action object", () => {
      const state = { a: 1, b: 2 };
      const action = {};

      const result = reducerAction(state, action);

      expect(result).toEqual({ a: 1, b: 2 });
    });

    it("should handle null values in action", () => {
      const state = { name: "test", value: 123 };
      const action = { name: null };

      const result = reducerAction(state, action as any);

      expect(result.name).toBeNull();
      expect(result.value).toBe(123);
    });

    it("should handle undefined values in action", () => {
      const state = { name: "test", value: 123 };
      const action = { name: undefined };

      const result = reducerAction(state, action as any);

      expect(result.name).toBeUndefined();
    });

    it("should handle array values", () => {
      const state = { items: [1, 2, 3], count: 3 };
      const action = { items: [4, 5, 6] };

      const result = reducerAction(state, action);

      expect(result.items).toEqual([4, 5, 6]);
    });

    it("should handle function that modifies array", () => {
      const state = { items: [1, 2, 3] };
      const action = { items: (prev: number[]) => [...prev, 4] };

      const result = reducerAction(state, action);

      expect(result.items).toEqual([1, 2, 3, 4]);
    });
  });
});

describe("useStateReducer", () => {
  it("should initialize with provided state", () => {
    const initialState = { count: 0, name: "test" };

    const { result } = renderHook(() => useStateReducer(initialState));

    expect(result.current[0]).toEqual(initialState);
  });

  it("should dispatch object action to update state", () => {
    const { result } = renderHook(() =>
      useStateReducer({ count: 0, name: "test" }),
    );

    act(() => {
      result.current[1]({ count: 5 });
    });

    expect(result.current[0].count).toBe(5);
    expect(result.current[0].name).toBe("test");
  });

  it("should dispatch function action to update state", () => {
    const { result } = renderHook(() =>
      useStateReducer({ count: 0, name: "test" }),
    );

    act(() => {
      result.current[1]((prev) => ({ ...prev, count: prev.count + 10 }));
    });

    expect(result.current[0].count).toBe(10);
  });

  it("should dispatch multiple updates", () => {
    const { result } = renderHook(() =>
      useStateReducer({ count: 0 }),
    );

    act(() => {
      result.current[1]({ count: 1 });
    });
    act(() => {
      result.current[1]({ count: (prev: number) => prev + 1 });
    });
    act(() => {
      result.current[1]((state) => ({ count: state.count * 2 }));
    });

    expect(result.current[0].count).toBe(4);
  });

  it("should work with initializer function", () => {
    const { result } = renderHook(() =>
      useStateReducer(
        { baseCount: 5 } as any,
        // @ts-expect-error - ignored for now
        (arg: { baseCount: number }) => ({
          count: arg.baseCount * 2,
          name: "initialized",
        }),
      ),
    );

    // @ts-expect-error - ignored for now
    expect(result.current[0].count).toBe(10);
    // @ts-expect-error - ignored for now
    expect(result.current[0].name).toBe("initialized");
  });

  it("should maintain stable dispatch reference", () => {
    const { result, rerender } = renderHook(() =>
      useStateReducer({ count: 0 }),
    );

    const firstDispatch = result.current[1];

    rerender();

    expect(result.current[1]).toBe(firstDispatch);
  });
});

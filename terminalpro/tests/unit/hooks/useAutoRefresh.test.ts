import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAutoRefresh } from "~/hooks/useAutoRefresh";

describe("useAutoRefresh", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should not call onRefresh when disabled", () => {
    const onRefresh = vi.fn();

    renderHook(() =>
      useAutoRefresh({ refreshEnabled: false, refreshRate: 30 }, onRefresh),
    );

    act(() => {
      vi.advanceTimersByTime(60000);
    });

    expect(onRefresh).not.toHaveBeenCalled();
  });

  it("should not call onRefresh when refreshData is undefined", () => {
    const onRefresh = vi.fn();

    renderHook(() => useAutoRefresh(undefined, onRefresh));

    act(() => {
      vi.advanceTimersByTime(60000);
    });

    expect(onRefresh).not.toHaveBeenCalled();
  });

  it("should not call onRefresh when rate is below minimum", () => {
    const onRefresh = vi.fn();

    renderHook(() =>
      useAutoRefresh({ refreshEnabled: true, refreshRate: 5 }, onRefresh),
    );

    act(() => {
      vi.advanceTimersByTime(60000);
    });

    expect(onRefresh).not.toHaveBeenCalled();
  });

  it("should call onRefresh at the specified interval when enabled", () => {
    const onRefresh = vi.fn();

    renderHook(() =>
      useAutoRefresh({ refreshEnabled: true, refreshRate: 30 }, onRefresh),
    );

    expect(onRefresh).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(30000);
    });

    expect(onRefresh).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(30000);
    });

    expect(onRefresh).toHaveBeenCalledTimes(2);
  });

  it("should return isAutoRefreshing true when enabled with valid rate", () => {
    const onRefresh = vi.fn();

    const { result } = renderHook(() =>
      useAutoRefresh({ refreshEnabled: true, refreshRate: 30 }, onRefresh),
    );

    expect(result.current.isAutoRefreshing).toBe(true);
  });

  it("should return isAutoRefreshing false when disabled", () => {
    const onRefresh = vi.fn();

    const { result } = renderHook(() =>
      useAutoRefresh({ refreshEnabled: false, refreshRate: 30 }, onRefresh),
    );

    expect(result.current.isAutoRefreshing).toBe(false);
  });

  it("should return correct nextRefreshIn countdown", () => {
    const onRefresh = vi.fn();

    const { result } = renderHook(() =>
      useAutoRefresh({ refreshEnabled: true, refreshRate: 30 }, onRefresh),
    );

    expect(result.current.nextRefreshIn).toBe(30);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.nextRefreshIn).toBe(29);

    act(() => {
      vi.advanceTimersByTime(10000);
    });

    expect(result.current.nextRefreshIn).toBe(19);
  });

  it("should reset countdown after refresh triggers", () => {
    const onRefresh = vi.fn();

    const { result } = renderHook(() =>
      useAutoRefresh({ refreshEnabled: true, refreshRate: 10 }, onRefresh),
    );

    expect(result.current.nextRefreshIn).toBe(10);

    act(() => {
      vi.advanceTimersByTime(10000);
    });

    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(result.current.nextRefreshIn).toBe(10);
  });

  it("should clear intervals on unmount", () => {
    const onRefresh = vi.fn();

    const { unmount } = renderHook(() =>
      useAutoRefresh({ refreshEnabled: true, refreshRate: 30 }, onRefresh),
    );

    unmount();

    act(() => {
      vi.advanceTimersByTime(60000);
    });

    expect(onRefresh).not.toHaveBeenCalled();
  });

  it("should clear and restart intervals when settings change", () => {
    const onRefresh = vi.fn();

    const { rerender } = renderHook(
      ({ refreshData }) => useAutoRefresh(refreshData, onRefresh),
      { initialProps: { refreshData: { refreshEnabled: true, refreshRate: 30 } } },
    );

    act(() => {
      vi.advanceTimersByTime(15000);
    });

    rerender({ refreshData: { refreshEnabled: true, refreshRate: 20 } });

    act(() => {
      vi.advanceTimersByTime(20000);
    });

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("should stop refreshing when disabled after being enabled", () => {
    const onRefresh = vi.fn();

    const { rerender } = renderHook(
      ({ refreshData }) => useAutoRefresh(refreshData, onRefresh),
      { initialProps: { refreshData: { refreshEnabled: true, refreshRate: 30 } } },
    );

    act(() => {
      vi.advanceTimersByTime(30000);
    });

    expect(onRefresh).toHaveBeenCalledTimes(1);

    rerender({ refreshData: { refreshEnabled: false, refreshRate: 30 } });

    act(() => {
      vi.advanceTimersByTime(60000);
    });

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("should return nextRefreshIn as 0 when disabled", () => {
    const onRefresh = vi.fn();

    const { result } = renderHook(() =>
      useAutoRefresh({ refreshEnabled: false, refreshRate: 30 }, onRefresh),
    );

    expect(result.current.nextRefreshIn).toBe(0);
  });

  it("should accept minimum refresh rate of 10 seconds", () => {
    const onRefresh = vi.fn();

    renderHook(() =>
      useAutoRefresh({ refreshEnabled: true, refreshRate: 10 }, onRefresh),
    );

    act(() => {
      vi.advanceTimersByTime(10000);
    });

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});

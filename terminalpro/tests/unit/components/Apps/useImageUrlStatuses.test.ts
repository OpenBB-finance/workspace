import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useImageUrlStatuses } from "~/components/Apps/useImageUrlStatuses";

/** Minimal stand-in for the browser `Image` — jsdom's never fires load/error. */
class MockImage {
  static instances: MockImage[] = [];
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  #src = "";
  set src(value: string) {
    this.#src = value;
    MockImage.instances.push(this);
  }
  get src() {
    return this.#src;
  }
}

const imageFor = (url: string) =>
  MockImage.instances.find((img) => img.src === url) as MockImage;

beforeEach(() => {
  MockImage.instances = [];
  vi.stubGlobal("Image", MockImage);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("useImageUrlStatuses", () => {
  it("marks a URL loading, then loaded once the image resolves", () => {
    vi.useFakeTimers();
    const { result } = renderHook(({ urls }) => useImageUrlStatuses(urls), {
      initialProps: { urls: ["https://x.com/a.png"] },
    });

    expect(result.current.statuses["https://x.com/a.png"]).toBe("loading");

    act(() => {
      vi.advanceTimersByTime(500); // debounce elapses → probe starts
    });
    act(() => {
      imageFor("https://x.com/a.png").onload?.();
    });

    expect(result.current.statuses["https://x.com/a.png"]).toBe("loaded");
  });

  it("marks a URL errored when the image fails to load", () => {
    vi.useFakeTimers();
    const { result } = renderHook(({ urls }) => useImageUrlStatuses(urls), {
      initialProps: { urls: ["https://x.com/broken.png"] },
    });

    act(() => {
      vi.advanceTimersByTime(500);
    });
    act(() => {
      imageFor("https://x.com/broken.png").onerror?.();
    });

    expect(result.current.statuses["https://x.com/broken.png"]).toBe("error");
  });

  it("ignores blank and non-http(s) URLs", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() =>
      useImageUrlStatuses(["", "  ", "ftp://x.com/a.png", "not a url"]),
    );

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current.statuses).toEqual({});
    expect(MockImage.instances).toHaveLength(0);
  });

  it("ensureSettled probes immediately and resolves once each URL settles", async () => {
    const { result } = renderHook(() => useImageUrlStatuses([]));

    let settled: Promise<Record<string, "loaded" | "error">>;
    act(() => {
      settled = result.current.ensureSettled(["https://x.com/a.png"]);
    });
    act(() => {
      imageFor("https://x.com/a.png").onerror?.();
    });

    await expect(settled!).resolves.toEqual({ "https://x.com/a.png": "error" });
  });

  it("resetErrors clears cached failures so they re-probe", async () => {
    const { result } = renderHook(() => useImageUrlStatuses([]));

    await act(async () => {
      const settled = result.current.ensureSettled(["https://x.com/a.png"]);
      imageFor("https://x.com/a.png").onerror?.();
      await settled;
    });
    expect(result.current.statuses["https://x.com/a.png"]).toBe("error");

    act(() => {
      result.current.resetErrors();
    });
    expect(result.current.statuses["https://x.com/a.png"]).toBeUndefined();
  });
});

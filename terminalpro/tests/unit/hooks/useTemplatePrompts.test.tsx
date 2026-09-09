import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/lib/state/backendConnector", () => ({
  useShallowBackendConnectorStore: vi.fn(),
}));

vi.mock("~/lib/state/userApps", () => ({
  useShallowUserAppsStore: vi.fn(),
}));

import { useTemplatePrompts } from "~/hooks/useTemplatePrompts";
import { useShallowBackendConnectorStore } from "~/lib/state/backendConnector";
import { useShallowUserAppsStore } from "~/lib/state/userApps";

type UserAppsRecord = Record<string, { content: { prompts?: string[] } }>;

const mockBackend = (prompts: string[]) => {
  (useShallowBackendConnectorStore as any).mockImplementation(
    (selector: (state: any) => any) =>
      selector({ getTemplatePrompts: () => prompts }),
  );
};

const mockUserApps = (userApps: UserAppsRecord, sharedUserApps: UserAppsRecord) => {
  (useShallowUserAppsStore as any).mockImplementation(
    (selector: (state: any) => any) => selector({ userApps, sharedUserApps }),
  );
};

describe("useTemplatePrompts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty array when templateId is empty and no backend prompts", () => {
    mockBackend([]);
    mockUserApps({}, {});

    const { result } = renderHook(() => useTemplatePrompts(""));

    expect(result.current).toEqual([]);
  });

  it("returns backend prompts when templateId does not start with 'custom-'", () => {
    mockBackend(["b1", "b2"]);
    mockUserApps(
      { "abc-123": { content: { prompts: ["u1"] } } },
      {},
    );

    const { result } = renderHook(() => useTemplatePrompts("equity"));

    expect(result.current).toEqual(["b1", "b2"]);
  });

  it("returns backend prompts when custom-prefix matches no user app", () => {
    mockBackend(["b1"]);
    mockUserApps({}, {});

    const { result } = renderHook(() => useTemplatePrompts("custom-missing-uuid"));

    expect(result.current).toEqual(["b1"]);
  });

  it("returns backend prompts when matched user app has no prompts", () => {
    mockBackend(["b1"]);
    mockUserApps(
      { "abc-123": { content: { prompts: [] } } },
      {},
    );

    const { result } = renderHook(() => useTemplatePrompts("custom-abc-123"));

    expect(result.current).toEqual(["b1"]);
  });

  it("returns user-app prompts only when there are no backend prompts", () => {
    mockBackend([]);
    mockUserApps(
      { "abc-123": { content: { prompts: ["u1", "u2"] } } },
      {},
    );

    const { result } = renderHook(() => useTemplatePrompts("custom-abc-123"));

    expect(result.current).toEqual(["u1", "u2"]);
  });

  it("merges backend and user-app prompts when both exist", () => {
    mockBackend(["b1", "b2"]);
    mockUserApps(
      { "abc-123": { content: { prompts: ["u1", "u2"] } } },
      {},
    );

    const { result } = renderHook(() => useTemplatePrompts("custom-abc-123"));

    expect(result.current).toEqual(["b1", "b2", "u1", "u2"]);
  });

  it("falls back to sharedUserApps when uuid is not in userApps", () => {
    mockBackend([]);
    mockUserApps(
      {},
      { "shared-uuid": { content: { prompts: ["s1"] } } },
    );

    const { result } = renderHook(() => useTemplatePrompts("custom-shared-uuid"));

    expect(result.current).toEqual(["s1"]);
  });

  it("prefers userApps over sharedUserApps when both contain the uuid", () => {
    mockBackend([]);
    mockUserApps(
      { "abc-123": { content: { prompts: ["owned"] } } },
      { "abc-123": { content: { prompts: ["shared"] } } },
    );

    const { result } = renderHook(() => useTemplatePrompts("custom-abc-123"));

    expect(result.current).toEqual(["owned"]);
  });

  it("memoizes the result across re-renders when inputs are stable", () => {
    mockBackend(["b1"]);
    mockUserApps(
      { "abc-123": { content: { prompts: ["u1"] } } },
      {},
    );

    const { result, rerender } = renderHook(() =>
      useTemplatePrompts("custom-abc-123"),
    );

    const first = result.current;
    rerender();
    const second = result.current;

    expect(first).toBe(second);
  });
});

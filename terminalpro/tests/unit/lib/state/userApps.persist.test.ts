import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type UserAppReturn, useUserAppsStore } from "~/lib/state/userApps";
import { getStorage } from "~/lib/utils/indexDB";

vi.mock("~/components/DataConnectors/common/helpers", () => ({
  patchSnowflakeWidgetsEndpoint: (widgets: unknown) => widgets,
}));

const STORAGE_KEY = "user-apps-storage";

async function readPersisted(): Promise<{
  userApps?: Record<string, UserAppReturn>;
  sharedUserApps?: Record<string, UserAppReturn>;
} | null> {
  const raw = await getStorage(STORAGE_KEY);
  if (!raw) return null;
  return JSON.parse(raw).state;
}

function makeApp(name: string): UserAppReturn {
  return {
    content: {
      name,
      description: `desc-${name}`,
      prompts: [],
      widgets: [],
      groups: [],
      gridLayout: {},
      storedFileUUIDs: [],
    },
    creator: true,
    createdBy: "user@example.com",
    isShared: false,
  };
}

describe("userApps persist", () => {
  beforeEach(() => {
    useUserAppsStore.persist.clearStorage();
    useUserAppsStore.setState({
      skipSyncUserApps: false,
      userApps: {},
      sharedUserApps: {},
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    useUserAppsStore.persist.clearStorage();
  });

  it("persists userApps to localStorage on state change", async () => {
    useUserAppsStore.setState({
      userApps: { "app-1": makeApp("My App") },
    });

    const persisted = await readPersisted();
    expect(persisted?.userApps?.["app-1"]?.content.name).toBe("My App");
  });

  it("persists sharedUserApps to localStorage on state change", async () => {
    useUserAppsStore.setState({
      sharedUserApps: { "shared-1": makeApp("Shared App") },
    });

    const persisted = await readPersisted();
    expect(persisted?.sharedUserApps?.["shared-1"]?.content.name).toBe("Shared App");
  });

  it("does not persist skipSyncUserApps flag", async () => {
    useUserAppsStore.setState({
      skipSyncUserApps: true,
      userApps: { a: makeApp("A") },
    });

    const persisted = (await readPersisted()) as Record<string, unknown> | null;
    expect(persisted).not.toHaveProperty("skipSyncUserApps");
  });

  it("updateUserApps from sync writes fresh data to storage", async () => {
    useUserAppsStore.setState({
      userApps: { stale: makeApp("Stale App") },
    });

    useUserAppsStore.getState().updateUserApps({
      owned: { fresh: makeApp("Fresh App") },
      shared: {},
    });

    const persisted = await readPersisted();
    expect(persisted?.userApps?.fresh?.content.name).toBe("Fresh App");
    expect(persisted?.userApps?.stale).toBeUndefined();
  });

  it("falls back gracefully when localStorage throws QuotaExceededError", () => {
    const originalSetItem = Storage.prototype.setItem;
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");
    let throwOnce = true;
    setItemSpy.mockImplementation(function (this: Storage, key: string, value: string) {
      if (throwOnce && key === STORAGE_KEY) {
        throwOnce = false;
        const err = new Error("Quota");
        err.name = "QuotaExceededError";
        throw err;
      }
      originalSetItem.call(this, key, value);
    });

    expect(() =>
      useUserAppsStore.setState({ userApps: { a: makeApp("A") } }),
    ).not.toThrow();

    setItemSpy.mockRestore();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type Source, useBackendConnectorStore } from "~/lib/state/backendConnector";
import { getStorage } from "~/lib/utils/indexDB";

vi.mock("sonner", () => ({
  toast: { warning: vi.fn(), success: vi.fn(), error: vi.fn() },
}));

const STORAGE_KEY = "backend-connector";

async function readPersisted(): Promise<{ apiSources: Source[] } | null> {
  const raw = await getStorage(STORAGE_KEY);
  if (!raw) return null;
  return JSON.parse(raw).state;
}

function makeSource(overrides: Partial<Source>): Source {
  return {
    id: overrides.id || "src",
    uuid: overrides.uuid || overrides.id || "src",
    name: overrides.name || "Test",
    url: "https://test.com",
    endpointHeaders: [],
    ...overrides,
  };
}

describe("backendConnector partialize", () => {
  beforeEach(() => {
    useBackendConnectorStore.persist.clearStorage();
    useBackendConnectorStore.setState({
      apiSources: [],
      isLoadingBackends: false,
      widgetMetadata: [],
      singleWidgets: [],
      storedFiles: [],
      queuedRefreshIds: [],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    useBackendConnectorStore.persist.clearStorage();
  });

  it("persists widgets and templates for sources with status success", async () => {
    const successSource = makeSource({
      id: "ok",
      status: "success",
      widgets: { foo: { name: "Foo Widget" } } as any,
      templates: [{ name: "T1" }] as any,
    });

    useBackendConnectorStore.setState({ apiSources: [successSource] });

    const persisted = await readPersisted();
    expect(persisted?.apiSources).toHaveLength(1);
    expect(persisted?.apiSources[0].id).toBe("ok");
    expect(persisted?.apiSources[0].widgets).toEqual({ foo: { name: "Foo Widget" } });
    expect(persisted?.apiSources[0].templates).toEqual([{ name: "T1" }]);
  });

  it("rewrites status to rehydrated for persisted sources", async () => {
    const source = makeSource({
      id: "ok",
      status: "success",
      widgets: {} as any,
      templates: [] as any,
    });

    useBackendConnectorStore.setState({ apiSources: [source] });

    const persisted = await readPersisted();
    expect(persisted?.apiSources[0].status).toBe("rehydrated");
  });

  it("does not persist sources with status pending", async () => {
    useBackendConnectorStore.setState({
      apiSources: [makeSource({ id: "p", status: "pending" })],
    });

    const persisted = await readPersisted();
    expect(persisted?.apiSources).toHaveLength(0);
  });

  it("does not persist sources with status error", async () => {
    useBackendConnectorStore.setState({
      apiSources: [makeSource({ id: "e", status: "error" })],
    });

    const persisted = await readPersisted();
    expect(persisted?.apiSources).toHaveLength(0);
  });

  it("does not persist sources with undefined status", async () => {
    useBackendConnectorStore.setState({
      apiSources: [makeSource({ id: "u", status: undefined })],
    });

    const persisted = await readPersisted();
    expect(persisted?.apiSources).toHaveLength(0);
  });

  it("filters mixed-status array to only success sources", async () => {
    useBackendConnectorStore.setState({
      apiSources: [
        makeSource({ id: "ok", status: "success" }),
        makeSource({ id: "p", status: "pending" }),
        makeSource({ id: "e", status: "error" }),
        makeSource({ id: "ok2", status: "success" }),
      ],
    });

    const persisted = await readPersisted();
    expect(persisted?.apiSources.map((s) => s.id)).toEqual(["ok", "ok2"]);
    expect(persisted?.apiSources.every((s) => s.status === "rehydrated")).toBe(true);
  });
});

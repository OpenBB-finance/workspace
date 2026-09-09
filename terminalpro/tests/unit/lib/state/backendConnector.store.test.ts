import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type Source, useBackendConnectorStore } from "~/lib/state/backendConnector";
import { useMcpToolsStore } from "~/lib/state/mcpTools";

vi.mock("sonner", () => ({
  toast: {
    warning: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockSource: Source = {
  id: "source-1",
  uuid: "source-1",
  name: "Test Backend",
  url: "https://test-backend.com",
  endpointHeaders: [],
};

function mockBackendResponsesWithUnrecognizedWidgetKey() {
  mockFetch
    .mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          test_widget: {
            name: "Test Widget",
            description: "Widget for testing warning propagation",
            endpoint: "/test-widget",
            params: [],
            unsupported_widget_option: true,
          },
        }),
      headers: new Headers(),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([]),
      headers: new Headers(),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([]),
      headers: new Headers(),
    });
}

describe("useBackendConnectorStore unrecognized-keys warning flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
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
  });

  it("shows warning toast during updateApiSource when unrecognized keys are detected", async () => {
    mockBackendResponsesWithUnrecognizedWidgetKey();

    const result = await useBackendConnectorStore
      .getState()
      .updateApiSource(mockSource);

    expect(result.unrecognizedKeysMessage).toEqual([
      {
        label: "[widgets.json]",
        entries: [
          {
            name: "Test Widget",
            keys: ["unsupported_widget_option"],
          },
        ],
      },
    ]);
    expect(toast.warning).toHaveBeenCalledWith(
      `Unrecognized fields: ${mockSource.name}`,
      expect.objectContaining({
        id: "backend-unrecognized-keys-source-1",
      }),
    );
  });

  it("shows warning toast during updateApiSources when showToastOnWarning is true", async () => {
    mockBackendResponsesWithUnrecognizedWidgetKey();

    const result = await useBackendConnectorStore
      .getState()
      .updateApiSources([mockSource], true);

    expect(result).toBe(true);
    expect(toast.warning).toHaveBeenCalledWith(
      `Unrecognized fields: ${mockSource.name}`,
      expect.objectContaining({
        id: "backend-unrecognized-keys-source-1",
      }),
    );
  });

  it("auto-registers MCP servers for custom backends with mcpServers in templates", async () => {
    useMcpToolsStore.setState({ servers: [], mcpConnectionRegistry: {} });

    mockFetch.mockImplementation((url: URL | string) => {
      const href = url.toString();
      if (href.endsWith("widgets.json")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
          headers: new Headers(),
        });
      }
      if (href.endsWith("apps.json")) {
        return Promise.resolve({
          ok: true,
          url: `${mockSource.url}/apps.json`,
          json: () =>
            Promise.resolve([
              {
                name: "Custom App",
                description: "App with MCP",
                tabs: { main: { id: "main", name: "Main", layout: [] } },
                mcp_servers: [
                  {
                    name: "AlphaCreek SEC",
                    description: "SEC tools",
                    url: "https://mcp.example.com/sse",
                  },
                ],
              },
            ]),
          headers: new Headers(),
        });
      }
      if (href.endsWith("agents.json")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
          headers: new Headers(),
        });
      }
      return Promise.resolve({ ok: false });
    });

    await useBackendConnectorStore.getState().updateApiSource(mockSource);

    const servers = useMcpToolsStore.getState().servers;
    expect(servers).toHaveLength(1);
    expect(servers[0]).toMatchObject({
      name: "AlphaCreek SEC",
      url: "https://mcp.example.com/sse",
      sourceId: mockSource.id,
    });
    expect(servers[0].vendorAppUuid).toBeUndefined();
  });

  it("does not re-register MCP on refresh after user removed it manually", async () => {
    useMcpToolsStore.setState({ servers: [], mcpConnectionRegistry: {} });

    const handler = (url: URL | string) => {
      const href = url.toString();
      if (href.endsWith("widgets.json")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
          headers: new Headers(),
        });
      }
      if (href.endsWith("apps.json")) {
        return Promise.resolve({
          ok: true,
          url: `${mockSource.url}/apps.json`,
          json: () =>
            Promise.resolve([
              {
                name: "Custom App",
                description: "App with MCP",
                tabs: { main: { id: "main", name: "Main", layout: [] } },
                mcpServers: [
                  { name: "MCP1", url: "https://mcp.example.com/sse" },
                ],
              },
            ]),
          headers: new Headers(),
        });
      }
      if (href.endsWith("agents.json")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
          headers: new Headers(),
        });
      }
      return Promise.resolve({ ok: false });
    };
    mockFetch.mockImplementation(handler);

    // Initial connect — MCP gets registered
    await useBackendConnectorStore.getState().updateApiSource(mockSource);
    expect(useMcpToolsStore.getState().servers).toHaveLength(1);

    // User removes the MCP from the AI tab
    const [registered] = useMcpToolsStore.getState().servers;
    useMcpToolsStore.getState().removeServer(registered.id);
    expect(useMcpToolsStore.getState().servers).toHaveLength(0);

    // Manual backend refresh must NOT bring it back
    await useBackendConnectorStore.getState().updateApiSource(mockSource);
    expect(useMcpToolsStore.getState().servers).toHaveLength(0);
  });

  it("finds and removes marketplace sources by vendorAppUuid", () => {
    useBackendConnectorStore.setState({
      apiSources: [
        {
          id: "source-1",
          uuid: "source-1",
          name: "Marketplace Backend",
          url: "https://test-backend.com",
          endpointHeaders: [],
          // @ts-expect-error
          vendorApp: {
            uuid: "listed-app-1",
            name: "Listed App 1",
          },
          hasApiKey: true,
        },
      ],
    });

    const store = useBackendConnectorStore.getState();

    expect(store.getApiSourceById("listed-app-1")?.id).toBe("source-1");

    store.removeApiSource("listed-app-1");

    expect(useBackendConnectorStore.getState().apiSources).toEqual([]);
  });
});

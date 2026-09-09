import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useListedAppConnect } from "~/hooks/useListedAppConnect";
import type { ListedApp } from "~/types/listedApps";

const {
  mockGetApiSources,
  mockPostApiSource,
  mockUpdateApiSource,
  mockDeleteApiSource,
  mockGetApiSourceById,
  mockValidateSource,
  mockDispatchSaveState,
  mockUuid,
  mockUseShallowBackendConnectorStore,
} = vi.hoisted(() => ({
  mockGetApiSources: vi.fn(),
  mockPostApiSource: vi.fn(),
  mockUpdateApiSource: vi.fn(),
  mockDeleteApiSource: vi.fn(),
  mockGetApiSourceById: vi.fn(),
  mockValidateSource: vi.fn(),
  mockDispatchSaveState: vi.fn(),
  mockUuid: vi.fn(),
  mockUseShallowBackendConnectorStore: vi.fn(),
}));

vi.mock("~/api/auth.api", () => ({
  getApiSources: mockGetApiSources,
  postApiSource: mockPostApiSource,
}));

vi.mock("~/components/DataConnectors/common/helpers", () => ({
  deleteSourceWidgets: vi.fn(),
  updateWidgetEndpoints: vi.fn(),
}));

vi.mock("~/lib/utils/validateBackend.ts", () => ({
  validateSource: mockValidateSource,
}));

vi.mock("~/lib/state/backendConnector", () => ({
  useShallowBackendConnectorStore: (selector: unknown) =>
    mockUseShallowBackendConnectorStore(selector),
}));

vi.mock("~/lib/utils/utils", () => ({
  dispatchSaveState: mockDispatchSaveState,
  uuidv4: mockUuid,
}));

describe("useListedAppConnect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUuid.mockReturnValue("source-uuid");
    mockGetApiSourceById.mockReturnValue(undefined);
    mockValidateSource.mockResolvedValue({ errorMessage: null });
    mockPostApiSource.mockResolvedValue({ status: 200 });
    mockGetApiSources.mockResolvedValue([]);
    mockUpdateApiSource.mockResolvedValue({
      templates: [],
      widgets: {},
      errorMessage: null,
    });
    mockUseShallowBackendConnectorStore.mockImplementation((selector: unknown) =>
      (selector as (state: unknown) => unknown)({
        updateApiSource: mockUpdateApiSource,
        addApiSource: vi.fn(),
        deleteApiSource: mockDeleteApiSource,
        getApiSourceById: mockGetApiSourceById,
      }),
    );
  });

  it("maps custom auth fields into endpoint headers", async () => {
    const app: ListedApp = {
      id: "app-1",
      vendorName: "Acme",
      appName: "Acme Data",
      description: "Test app",
      backendUrl: "https://example.com",
      thumbnail: "",
      authType: ["custom"],
      authFields: [
        { id: "api_key", label: "API Key", key: "Authorization", prefix: "Bearer " },
        { id: "client_id", label: "Client ID", key: "X-Client-Id" },
      ],
      widgets: [{ name: "Widget 1", description: "Test widget" }],
    };

    const { result } = renderHook(() => useListedAppConnect());

    await act(async () => {
      await result.current.connectApp(app, {
        authValues: [
          { id: "api_key", value: "secret" },
          { id: "client_id", value: "client-123" },
        ],
      });
    });

    expect(mockPostApiSource).toHaveBeenCalledWith(
      "source-uuid",
      expect.objectContaining({
        endpointHeaders: [
          { key: "Authorization", value: "Bearer secret", location: "headers" },
          { key: "X-Client-Id", value: "client-123", location: "headers" },
          { key: "X-OpenBB-Workspace", value: "true", location: "headers" },
          { key: "X-OpenBB-Listed-App-Id", value: "app-1", location: "headers" },
        ],
      }),
    );
  });

  it("keeps the legacy api_key flow working", async () => {
    const app: ListedApp = {
      id: "app-1",
      vendorName: "Acme",
      appName: "Acme Data",
      description: "Test app",
      backendUrl: "https://example.com",
      thumbnail: "",
      authType: ["api_key"],
      widgets: [{ name: "Widget 1", description: "Test widget" }],
    };

    const { result } = renderHook(() => useListedAppConnect());

    await act(async () => {
      await result.current.connectApp(app, {
        authValues: [{ id: "api_key", value: "secret" }],
      });
    });

    expect(mockPostApiSource).toHaveBeenCalledWith(
      "source-uuid",
      expect.objectContaining({
        endpointHeaders: expect.arrayContaining([
          { key: "Authorization", value: "Bearer secret", location: "headers" },
        ]),
      }),
    );
  });

  it("applies a timeout signal to the apiKeyUrl validation fetch", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", mockFetch);

    const app: ListedApp = {
      id: "app-1",
      vendorName: "Acme",
      appName: "Acme Data",
      description: "Test app",
      backendUrl: "https://example.com",
      apiKeyUrl: "https://example.com/validate-key",
      thumbnail: "",
      authType: ["api_key"],
      widgets: [{ name: "Widget 1", description: "Test widget" }],
    };

    const { result } = renderHook(() => useListedAppConnect());

    try {
      await act(async () => {
        await result.current.connectApp(app, {
          authValues: [{ id: "api_key", value: "secret" }],
        });
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://example.com/validate-key",
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("rejects incomplete custom auth input", async () => {
    const app: ListedApp = {
      id: "app-1",
      vendorName: "Acme",
      appName: "Acme Data",
      description: "Test app",
      backendUrl: "https://example.com",
      thumbnail: "",
      authType: ["custom"],
      authFields: [
        { id: "api_key", label: "API Key", key: "Authorization", prefix: "Bearer " },
        { id: "client_id", label: "Client ID", key: "X-Client-Id" },
      ],
      widgets: [{ name: "Widget 1", description: "Test widget" }],
    };

    const { result } = renderHook(() => useListedAppConnect());

    let connectResult:
      | { success: true }
      | { success: false; error: string }
      | undefined;

    await act(async () => {
      connectResult = await result.current.connectApp(app, {
        authValues: [{ id: "api_key", value: "secret" }],
      });
    });

    expect(connectResult).toEqual({
      success: false,
      error: "All authentication fields are required.",
    });
    expect(mockPostApiSource).not.toHaveBeenCalled();
  });
});

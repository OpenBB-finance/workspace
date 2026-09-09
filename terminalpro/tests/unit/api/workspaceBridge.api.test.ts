import type { AxiosResponse } from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "~/api/api";
import {
  createWorkspaceMcpToken,
  getWorkspaceMcpEndpoint,
  listWorkspaceMcpTokens,
  revokeWorkspaceMcpToken,
  startBridgeSession,
} from "~/api/workspaceBridge.api";
import queryClient from "~/queryClient";

vi.mock("~/lib/runtimeConfig", () => ({
  getConfig: () => ({ urls: { backend: "https://backend.test/" } }),
}));

// apiClient and queryClient are mocked globally in tests/mocks/api-client.ts.
const mockPost = vi.mocked(apiClient.post);
const mockGet = vi.mocked(apiClient.get);
const mockDelete = vi.mocked(apiClient.delete);

function axiosError(message: string, status: number) {
  return Object.assign(new Error(message), { response: { status } });
}

const body = {
  client_name: "workspace-ui",
  current_dashboard_id: null,
  current_tab_id: null,
};

describe("workspaceBridge api", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("returns the hosted MCP endpoint", () => {
    expect(getWorkspaceMcpEndpoint()).toBe("https://backend.test/mcp");
  });

  it("POSTs bridge bootstrap through the shared api client", async () => {
    const payload = {
      session: { session_id: "s1" },
      websocket_url: "wss://backend.test/pro/workspace-mcp/bridge/ws",
    };
    mockPost.mockResolvedValue({ status: 200, data: payload } as AxiosResponse);

    const result = await startBridgeSession(body);

    expect(mockPost).toHaveBeenCalledWith(
      "/pro/workspace-mcp/bridge/session/start",
      body,
      { signal: undefined },
    );
    expect(result).toEqual(payload);
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["workspace-mcp-tokens"],
    });
  });

  it("manages hosted MCP tokens", async () => {
    const tokenMetadata = {
      uuid: "token-1",
      name: "Claude Desktop",
      token_type: "workspace_mcp",
      token_prefix: "obb_mcp_12345678901",
    };
    const token = {
      ...tokenMetadata,
      token: "obb_mcp_12345678901_secret",
    };
    mockGet.mockResolvedValueOnce({
      status: 200,
      data: [tokenMetadata],
    } as AxiosResponse);
    mockPost.mockResolvedValueOnce({ status: 200, data: token } as AxiosResponse);
    mockDelete.mockResolvedValueOnce({ status: 204, data: "" } as AxiosResponse);

    await expect(listWorkspaceMcpTokens()).resolves.toEqual([tokenMetadata]);
    await expect(createWorkspaceMcpToken("Claude Desktop")).resolves.toEqual(token);
    await expect(revokeWorkspaceMcpToken("token-1")).resolves.toBeUndefined();

    expect(mockGet).toHaveBeenCalledWith("/pro/workspace-mcp/tokens");
    expect(mockPost).toHaveBeenCalledWith("/pro/workspace-mcp/tokens", {
      name: "Claude Desktop",
    });
    expect(mockDelete).toHaveBeenCalledWith("/pro/workspace-mcp/tokens/token-1");
  });

  it("throws the error message when a bridge request fails", async () => {
    const error = axiosError("Session limit reached", 403);
    mockPost.mockRejectedValue(error);
    mockGet.mockRejectedValue(error);

    await expect(startBridgeSession(body)).rejects.toThrow("Session limit reached");
    await expect(listWorkspaceMcpTokens()).rejects.toThrow("Session limit reached");
    await expect(createWorkspaceMcpToken("Claude Desktop")).rejects.toThrow(
      "Session limit reached",
    );
  });

  it("falls back to a status message when a failed request has no message", async () => {
    mockPost.mockRejectedValue(axiosError("", 500));

    await expect(startBridgeSession(body)).rejects.toThrow(
      "Workspace MCP request failed with status 500.",
    );
  });

  it("throws when a token revoke fails", async () => {
    mockDelete.mockRejectedValue(axiosError("", 404));

    await expect(revokeWorkspaceMcpToken("token-1")).rejects.toThrow(
      "Workspace MCP request failed with status 404.",
    );
  });

  it("throws when a request resolves with an unexpected status", async () => {
    mockDelete.mockResolvedValue({
      status: 200,
      statusText: "",
      data: "",
    } as AxiosResponse);

    await expect(revokeWorkspaceMcpToken("token-1")).rejects.toThrow(
      "Workspace MCP request failed with status 200.",
    );
  });
});

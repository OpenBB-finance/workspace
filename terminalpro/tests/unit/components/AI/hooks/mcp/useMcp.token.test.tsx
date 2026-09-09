import { renderHook, waitFor } from "@testing-library/react";
import { auth } from "@modelcontextprotocol/sdk/client/auth.js";
import { beforeAll, beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { useMcp, type UseMcpOptionsT } from "~/components/AI/hooks/mcp/useMcp";

// --- SDK mocks: force client.connect to reject with a 401 ---------------------

vi.mock("@modelcontextprotocol/sdk/client/auth.js", () => ({
  auth: vi.fn().mockResolvedValue("REDIRECT"),
  UnauthorizedError: class UnauthorizedError extends Error {},
}));

vi.mock("@modelcontextprotocol/sdk/client/index.js", () => ({
  Client: class {
    connect = vi.fn().mockRejectedValue(new Error("HTTP 401 Unauthorized"));
    request = vi.fn().mockResolvedValue({ tools: [] });
  },
}));

vi.mock("@modelcontextprotocol/sdk/client/streamableHttp.js", () => ({
  StreamableHTTPClientTransport: class {
    close = vi.fn().mockResolvedValue(undefined);
  },
  StreamableHTTPError: class extends Error {
    code?: number;
  },
}));

vi.mock("@modelcontextprotocol/sdk/client/sse.js", () => ({
  SSEClientTransport: class {
    close = vi.fn().mockResolvedValue(undefined);
  },
}));

vi.mock("@modelcontextprotocol/sdk/server/auth/errors", () => ({
  InvalidClientError: class extends Error {},
  InvalidGrantError: class extends Error {},
  InvalidRequestError: class extends Error {},
}));

vi.mock("~/components/AI/hooks/mcp/browser-provider", () => ({
  BrowserOAuthClientProvider: class {
    serverUrl: string;
    constructor(url: string) {
      this.serverUrl = url;
    }
    tokens = vi.fn().mockResolvedValue(undefined);
    clearStorage = vi.fn().mockReturnValue(0);
    getLastAttemptedAuthUrl = vi.fn().mockReturnValue(null);
    setPreventAutoAuth = vi.fn();
  },
  clearMcpAuthStorageForServer: vi.fn(),
}));

const authMock = auth as unknown as Mock;

// Stable references: useMcp memoizes on the options object identity, so a new
// object each render would re-trigger the connect effect in an infinite loop.
const tokenOptions: UseMcpOptionsT = {
  url: "https://token-server.example.com/mcp",
  serverName: "Demo Token MCP",
  autoReconnect: false,
  autoRetry: false,
  authType: "token",
};

const oauthOptions: UseMcpOptionsT = {
  url: "https://oauth-server.example.com/mcp",
  serverName: "Demo OAuth MCP",
  autoReconnect: false,
  autoRetry: false,
};

beforeAll(() => {
  if (typeof globalThis.BroadcastChannel === "undefined") {
    // @ts-expect-error minimal stub for jsdom
    globalThis.BroadcastChannel = class {
      addEventListener() {}
      removeEventListener() {}
      postMessage() {}
      close() {}
    };
  }
});

beforeEach(() => {
  authMock.mockClear();
});

describe("useMcp token auth", () => {
  it("fails with a token error and never triggers the OAuth flow on a 401", async () => {
    const { result } = renderHook(() => useMcp(tokenOptions));

    await waitFor(() => expect(result.current.state).toBe("failed"));

    expect(result.current.error).toMatch(/token/i);
    expect(authMock).not.toHaveBeenCalled();
  });

  it("still triggers the OAuth flow on a 401 when authType is absent", async () => {
    const { result } = renderHook(() => useMcp(oauthOptions));

    await waitFor(() => expect(authMock).toHaveBeenCalled());

    expect(result.current.state).not.toBe("failed");
  });
});

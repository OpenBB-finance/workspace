import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCodeGeneration } from "~/components/General/Table/hooks/useCodeGeneration";

// Mock the auth store
vi.mock("~/lib/state/auth", () => ({
  useShallowAuthStore: vi.fn(() => "mock-token-123"),
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("useCodeGeneration", () => {
  let queryClient: QueryClient;

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
        mutations: {
          retry: false,
        },
      },
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it("returns mutation functions", () => {
    const { result } = renderHook(() => useCodeGeneration(), { wrapper });

    expect(result.current.mutate).toBeDefined();
    expect(result.current.mutateAsync).toBeDefined();
    expect(result.current.isPending).toBe(false);
  });

  it("makes POST request to /v1/generate/code", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        generated_code: "SELECT * FROM users",
      }),
    });

    const { result } = renderHook(() => useCodeGeneration(), { wrapper });

    result.current.mutate({
      widget_uuid: "test-widget-123",
      user_prompt: "get all users",
      language: "sql",
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/v1/generate/code"),
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            Authorization: "Bearer mock-token-123",
          }),
        }),
      );
    });
  });

  it("sends correct payload for SQL generation", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        generated_code: "SELECT * FROM customers",
      }),
    });

    const { result } = renderHook(() => useCodeGeneration(), { wrapper });

    const params = {
      widget_uuid: "widget-123",
      user_prompt: "get all customers",
      language: "sql" as const,
      current_code: "SELECT * FROM users",
      sql_schema: { customers: ["id", "name"] },
    };

    result.current.mutate(params);

    await waitFor(() => {
      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);

      expect(body.widget_uuid).toBe("widget-123");
      expect(body.user_prompt).toBe("get all customers");
      expect(body.language).toBe("sql");
      expect(body.current_code).toBe("SELECT * FROM users");
      expect(body.sql_schema).toEqual({ customers: ["id", "name"] });
    });
  });

  it("sends correct payload for Python generation", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        generated_code: "df = session.table('users')",
      }),
    });

    const { result } = renderHook(() => useCodeGeneration(), { wrapper });

    const params = {
      widget_uuid: "widget-456",
      user_prompt: "load users table",
      language: "python" as const,
      current_code: "# existing code",
    };

    result.current.mutate(params);

    await waitFor(() => {
      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);

      expect(body.widget_uuid).toBe("widget-456");
      expect(body.user_prompt).toBe("load users table");
      expect(body.language).toBe("python");
      expect(body.current_code).toBe("# existing code");
    });
  });

  it("sends correct payload for text generation", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        generated_code: "bye",
      }),
    });

    const { result } = renderHook(() => useCodeGeneration(), { wrapper });

    const params = {
      widget_uuid: "widget-text",
      user_prompt: "update to bye",
      language: "text" as const,
      current_code: "Hello World",
    };

    result.current.mutate(params);

    await waitFor(() => {
      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);

      expect(body.widget_uuid).toBe("widget-text");
      expect(body.user_prompt).toBe("update to bye");
      expect(body.language).toBe("text");
      expect(body.current_code).toBe("Hello World");
    });
  });

  it("returns success response correctly", async () => {
    const mockResponse = {
      success: true,
      generated_code: "SELECT id, name FROM customers WHERE active = true",
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const { result } = renderHook(() => useCodeGeneration(), { wrapper });

    let responseData: unknown;
    result.current.mutate(
      {
        widget_uuid: "widget-123",
        user_prompt: "get active customers",
        language: "sql",
      },
      {
        onSuccess: (data) => {
          responseData = data;
        },
      },
    );

    await waitFor(() => {
      expect(responseData).toEqual(mockResponse);
    });
  });

  it("returns error response correctly", async () => {
    const mockResponse = {
      success: false,
      error_message: "Unable to generate code for the given request",
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const { result } = renderHook(() => useCodeGeneration(), { wrapper });

    let responseData: unknown;
    result.current.mutate(
      {
        widget_uuid: "widget-123",
        user_prompt: "invalid request",
        language: "sql",
      },
      {
        onSuccess: (data) => {
          responseData = data;
        },
      },
    );

    await waitFor(() => {
      expect(responseData).toEqual(mockResponse);
    });
  });

  it("handles network errors", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => "Internal Server Error",
    });

    const { result } = renderHook(() => useCodeGeneration(), { wrapper });

    let errorCaught: Error | undefined;
    result.current.mutate(
      {
        widget_uuid: "widget-123",
        user_prompt: "some prompt",
        language: "sql",
      },
      {
        onError: (error) => {
          errorCaught = error;
        },
      },
    );

    await waitFor(() => {
      expect(errorCaught).toBeDefined();
      expect(errorCaught?.message).toContain("500");
    });
  });

  it("handles authentication error when token is missing", async () => {
    // Override mock to return undefined token
    const authMock = await import("~/lib/state/auth");
    vi.mocked(authMock.useShallowAuthStore).mockReturnValueOnce(undefined);

    const { result } = renderHook(() => useCodeGeneration(), { wrapper });

    let errorCaught: Error | undefined;
    result.current.mutate(
      {
        widget_uuid: "widget-123",
        user_prompt: "some prompt",
        language: "sql",
      },
      {
        onError: (error) => {
          errorCaught = error;
        },
      },
    );

    await waitFor(() => {
      expect(errorCaught).toBeDefined();
      expect(errorCaught?.message).toContain("Authentication required");
    });
  });

  it("sets isPending to true while request is in progress", async () => {
    let resolvePromise: (value: unknown) => void;
    const promise = new Promise((resolve) => {
      resolvePromise = resolve;
    });

    mockFetch.mockReturnValueOnce(promise);

    const { result } = renderHook(() => useCodeGeneration(), { wrapper });

    result.current.mutate({
      widget_uuid: "widget-123",
      user_prompt: "some prompt",
      language: "sql",
    });

    await waitFor(() => {
      expect(result.current.isPending).toBe(true);
    });

    // Resolve the promise
    resolvePromise!({
      ok: true,
      json: async () => ({ success: true, generated_code: "SELECT 1" }),
    });

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });
  });
});

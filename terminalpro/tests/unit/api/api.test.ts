import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "~/api/api";
import type { AuthState } from "~/lib/state/auth";

vi.unmock("~/api/api");

// Global mocks
const mockLogout = vi.fn();

const mockAuthState: AuthState = {
  // @ts-expect-error - the user type is not fully implemented for the sake of mocking
  user: { token: "test-token" },
  logout: mockLogout,
};

vi.mock("~/lib/state/auth", () => {
  return {
    useAuthStore: {
      getState: vi.fn(() => mockAuthState),
    },
  };
});

vi.mock("axios", () => {
  const axiosInstance = {
    interceptors: {
      request: {
        use: vi.fn((fulfilled) => {
          axiosInstance.interceptors.request.handlers.push({ fulfilled });
        }),
        handlers: [],
      },
      response: {
        use: vi.fn((fulfilled, rejected) => {
          axiosInstance.interceptors.response.handlers.push({ fulfilled, rejected });
        }),
        handlers: [],
      },
    },
    get: vi.fn(),
    post: vi.fn(),
  };

  const axiosMock = {
    create: vi.fn(() => axiosInstance),
    isAxiosError: vi.fn(),
    ...axiosInstance,
  };

  return {
    default: axiosMock,
  };
});

const mockConsoleInfo = vi.spyOn(console, "info").mockImplementation(() => {});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("apiClient", () => {
  it("should add Authorization header if user token exists", async () => {
    const requestConfig = await apiClient.interceptors.request.handlers[0].fulfilled({
      headers: {},
      method: "get",
      url: "/test",
    } as any);

    expect(requestConfig.headers.Authorization).toBe("Bearer test-token");
  });

  it("strips an explicitly empty per-request Authorization header (opts out of auth)", async () => {
    // Real AxiosHeaders (the axios module is mocked above): in production the
    // interceptor receives the merged per-request headers as an AxiosHeaders
    // instance. `headers: { authorization: "" }` must result in NO header on
    // the wire — an empty Authorization header would still trigger a CORS
    // preflight, which the marketplace host rejects.
    const { AxiosHeaders } = await vi.importActual<typeof import("axios")>("axios");
    const requestConfig = await apiClient.interceptors.request.handlers[0].fulfilled({
      headers: new AxiosHeaders({ authorization: "" }),
      method: "get",
      url: "/marketplace/apps",
    } as any);

    expect(requestConfig.headers.has("Authorization")).toBe(false);
  });

  it("should log request details in development mode", async () => {
    import.meta.env.DEV = true;
    await apiClient.interceptors.request.handlers[0].fulfilled({
      headers: {},
      method: "get",
      url: "/test",
    } as any);

    expect(mockConsoleInfo).toHaveBeenCalledWith("[API req]", "[Authed]", "GET /test");
  });

  it("should log response details in development mode", async () => {
    import.meta.env.DEV = true;
    const response = { status: 200, config: { url: "/test" }, data: {} };
    // @ts-expect-error - the handlers type is not fully implemented for the sake of testing
    await apiClient.interceptors.response.handlers[0].fulfilled(response);

    expect(mockConsoleInfo).toHaveBeenCalledWith("[API res] 200 /test", {}, response);
  });

  it("should log error details and logout on 401 status", async () => {
    import.meta.env.DEV = true;
    const error = {
      response: { status: 401, config: { url: "/test" } },
      config: { url: "/test" },
    };

    await expect(
      apiClient.interceptors.response.handlers[0].rejected(error as any),
    ).rejects.toEqual(error);
    expect(mockConsoleInfo).toHaveBeenCalledWith("[API err] 401 /test", error);
    expect(mockConsoleInfo).toHaveBeenCalledTimes(1);
    expect(mockLogout).toHaveBeenCalled();
  });
});

/**
 * API Client Mock
 *
 * Mock for the axios-based API client.
 * Use MSW for more realistic API testing; this mock is for unit tests
 * that need to isolate components from network requests.
 */
import { vi } from "vitest";

vi.mock("~/api/api", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    put: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  },
}));

vi.mock("~/queryClient", () => ({
  default: { invalidateQueries: vi.fn(), refetchQueries: vi.fn() },
}));

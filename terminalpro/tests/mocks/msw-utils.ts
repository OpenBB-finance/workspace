import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "./server";

/**
 * Use this function in describe blocks that need MSW for API mocking.
 * It sets up the MSW server lifecycle for the test suite.
 *
 * @example
 * ```ts
 * import { describe, it, expect } from "vitest";
 * import { setupMSW } from "@/tests/mocks/msw-utils";
 *
 * describe("MyComponent", () => {
 *   setupMSW();
 *
 *   it("should fetch data", async () => {
 *     // MSW will intercept API calls
 *   });
 * });
 * ```
 */
export function setupMSW() {
  beforeAll(() => server.listen({ onUnhandledRequest: "warn" }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());
}

// Re-export useful items for tests
export { server, http, HttpResponse } from "./server";
export {
  createMockHandler,
  createErrorHandler,
  mockUser,
  mockValidateResponse,
  mockDashboardData,
  mockUsage,
  mockFeatureFlags,
} from "./handlers";
